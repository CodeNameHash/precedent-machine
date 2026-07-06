const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CLAIMABLE_KINDS,
  findExistingDealBySourceUrl,
  jobUrl,
  parseArgs,
  refreshCoverageBackfillsForDeal,
  seedMetadata,
  truncate,
} = require('../scripts/ingest-worker');

test('worker CLI caps concurrency at the production hard cap', () => {
  const args = parseArgs(['node', 'script', '--concurrency', '28', '--backend', 'codex']);
  assert.equal(args.concurrency, 8);
  assert.equal(args.backend, 'codex');
});

test('worker validates requested job kinds', () => {
  assert.doesNotThrow(() => parseArgs(['node', 'script', '--kinds', [...CLAIMABLE_KINDS].join(',')]));
  assert.throws(
    () => parseArgs(['node', 'script', '--kinds', 'deal-prepare,unknown']),
    /Unknown job kind/,
  );
});

test('jobUrl reads current and legacy payload shapes', () => {
  assert.equal(jobUrl({ payload: { url: 'https://sec.example/a.htm' } }), 'https://sec.example/a.htm');
  assert.equal(
    jobUrl({ payload: { candidate: { agreement_exhibit_url: 'https://sec.example/b.htm' } } }),
    'https://sec.example/b.htm',
  );
});

test('seed metadata follows run and candidate identity', () => {
  const meta = seedMetadata({
    run_id: 'run-1',
    candidate_id: 'candidate-1',
    payload: {
      deal_key: 'deal-key',
      priority_reasons: ['reason'],
    },
  }, { backend: 'codex', model: 'gpt-5.5' });

  assert.deepEqual(meta, {
    run_id: 'run-1',
    candidate_id: 'candidate-1',
    deal_key: 'deal-key',
    priority_reasons: ['reason'],
    priority_verification: null,
    ingested_by: 'codex',
    extraction_model: 'gpt-5.5',
  });
});

test('truncate keeps worker error payloads bounded', () => {
  const value = truncate('x'.repeat(1300), 12);
  assert.equal(value.length, 12);
  assert.match(value, /\.\.\.$/);
});

test('source-url lookup uses a targeted metadata JSON filter', async () => {
  const calls = [];
  const match = {
    id: 'deal-1',
    acquirer: 'Acquirer',
    target: 'Target',
    metadata: { source_url: 'https://sec.example/exhibit.htm' },
  };
  const sb = {
    from(table) {
      calls.push({ method: 'from', table });
      return {
        select(columns) {
          calls.push({ method: 'select', columns });
          return this;
        },
        eq(column, value) {
          calls.push({ method: 'eq', column, value });
          return this;
        },
        limit(n) {
          calls.push({ method: 'limit', n });
          return Promise.resolve({ data: [match], error: null });
        },
      };
    },
  };

  const result = await findExistingDealBySourceUrl(sb, ' https://sec.example/exhibit.htm ');

  assert.equal(result, match);
  assert.deepEqual(calls, [
    { method: 'from', table: 'deals' },
    { method: 'select', columns: 'id,acquirer,target,metadata' },
    { method: 'eq', column: 'metadata->>source_url', value: 'https://sec.example/exhibit.htm' },
    { method: 'limit', n: 1 },
  ]);
});

test('source-url lookup falls back to legacy metadata scan when JSON filter errors', async () => {
  let query = 0;
  const legacyMatch = {
    id: 'deal-legacy',
    acquirer: 'Legacy Acquirer',
    target: 'Legacy Target',
    metadata: { source_url: ' https://sec.example/legacy.htm ' },
  };
  const sb = {
    from() {
      query += 1;
      if (query === 1) {
        return {
          select() { return this; },
          eq() { return this; },
          limit() {
            return Promise.resolve({ data: null, error: { message: 'unsupported json path filter' } });
          },
        };
      }
      return {
        select() {
          return Promise.resolve({
            data: [
              { id: 'other', metadata: { source_url: 'https://sec.example/other.htm' } },
              legacyMatch,
            ],
            error: null,
          });
        },
      };
    },
  };

  const result = await findExistingDealBySourceUrl(sb, 'https://sec.example/legacy.htm');

  assert.equal(result, legacyMatch);
  assert.equal(query, 2);
});

function makeBackfillSupabase({ deal, provisions }) {
  const state = {
    deal,
    provisions: provisions.map((p) => ({ ...p })),
    annotationsDeleted: [],
    inserted: [],
  };

  const matches = (row, filters) => {
    for (const [key, value] of Object.entries(filters.eq || {})) {
      if (row[key] !== value) return false;
    }
    for (const [key, values] of Object.entries(filters.in || {})) {
      if (!values.includes(row[key])) return false;
    }
    return true;
  };

  return {
    state,
    from(table) {
      const filters = { eq: {}, in: {} };
      let op = 'select';
      const chain = {
        select() { op = 'select'; return chain; },
        eq(key, value) { filters.eq[key] = value; return chain; },
        in(key, values) { filters.in[key] = values; return chain; },
        delete() { op = 'delete'; return chain; },
        range(start, end) {
          if (table !== 'provisions') return Promise.resolve({ data: [], error: null });
          const rows = state.provisions.filter((row) => matches(row, filters));
          return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
        },
        single: async () => {
          if (table === 'deals') return { data: state.deal, error: null };
          return { data: null, error: null };
        },
        insert(rows) {
          const list = Array.isArray(rows) ? rows : [rows];
          state.inserted.push(...list);
          state.provisions.push(...list.map((row, i) => ({
            id: row.id || `inserted-${state.inserted.length}-${i}`,
            ...row,
          })));
          return {
            select: async () => ({ data: list.map((_, i) => ({ id: `inserted-${i}` })), error: null }),
          };
        },
        then(resolve, reject) {
          let result;
          if (op === 'delete') {
            if (table === 'annotations') {
              state.annotationsDeleted.push(...(filters.in.provision_id || []));
              result = { data: [], error: null };
            } else if (table === 'provisions') {
              const before = state.provisions.length;
              state.provisions = state.provisions.filter((row) => !matches(row, filters));
              result = { data: Array.from({ length: before - state.provisions.length }, (_, i) => ({ id: `deleted-${i}` })), error: null };
            } else {
              result = { data: [], error: null };
            }
          } else if (table === 'provisions') {
            result = { data: state.provisions.filter((row) => matches(row, filters)), error: null };
          } else {
            result = { data: [], error: null };
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

test('coverage backfill refresh stores only OTHER catch-all rows and leaves typed rows intact', async () => {
  const sectionOne = [
    'Section 1.1. Organization.',
    'The Company is duly organized and validly existing.',
    'The Company has all permits required to conduct its business.',
    'The Company owns no subsidiaries.',
  ].join(' ');
  const sectionTwo = [
    'Section 1.2. Conduct.',
    'The Company shall operate the business in the ordinary course.',
    'The Company shall preserve its relationships with customers and suppliers.',
  ].join(' ');
  const fullText = `${sectionOne}\n\n${sectionTwo}`;
  const sectionTwoStart = fullText.indexOf(sectionTwo);
  const deal = {
    id: 'deal-1',
    metadata: {
      full_text: fullText,
      classified_sections: [
        {
          type: 'REP-T',
          sectionNumber: '1.1',
          title: 'Organization',
          text: sectionOne,
          startChar: 0,
        },
        {
          type: 'COV',
          sectionNumber: '1.2',
          title: 'Conduct',
          text: sectionTwo,
          startChar: sectionTwoStart,
        },
      ],
    },
  };
  const typedText = 'Section 1.1. Organization. The Company is duly organized and validly existing.';
  const sb = makeBackfillSupabase({
    deal,
    provisions: [
      {
        id: 'rep-1',
        deal_id: 'deal-1',
        type: 'REP-T',
        category: 'Organization',
        full_text: typedText,
        ai_favorability: 'neutral',
        ai_metadata: {
          code: 'REP-T-ORG',
          startChar: 0,
          features: { canonicalCode: 'REP-T-ORG' },
        },
      },
      {
        id: 'old-other',
        deal_id: 'deal-1',
        type: 'OTHER',
        category: 'Old Other',
        full_text: 'old catch all',
        ai_metadata: {},
      },
      {
        id: 'old-leftover',
        deal_id: 'deal-1',
        type: 'SECTION-LEFTOVER',
        category: 'Old Leftover',
        full_text: 'old leftover',
        ai_metadata: {},
      },
    ],
  });

  const result = await refreshCoverageBackfillsForDeal(sb, deal);
  const typedRows = sb.state.provisions.filter((row) => row.type === 'REP-T');
  const catchAllRows = sb.state.provisions.filter((row) => ['OTHER', 'SECTION-LEFTOVER'].includes(row.type));

  assert.equal(result.skipped, false);
  assert.equal(typedRows.length, 1);
  assert.equal(typedRows[0].id, 'rep-1');
  assert.ok(!catchAllRows.some((row) => row.id === 'old-other' || row.id === 'old-leftover'));
  assert.ok(catchAllRows.some((row) => row.type === 'SECTION-LEFTOVER'));
  assert.ok(catchAllRows.some((row) => row.type === 'OTHER'));
  assert.equal(result.inserted, catchAllRows.length);
});
