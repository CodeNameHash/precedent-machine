const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findExistingCleanDealByParties,
  normalizeDealPartyName,
} = require('../scripts/ingest-local');

function makeDealsSupabase(rows, options = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'deals');
      const filters = [];
      const chain = {
        select(columns) {
          calls.push({ method: 'select', columns });
          return chain;
        },
        eq(column, value) {
          calls.push({ method: 'eq', column, value });
          filters.push({ column, value });
          return chain;
        },
        limit(n) {
          calls.push({ method: 'limit', n });
          if (options.failJsonFilter && filters.some((f) => f.column === 'metadata->>ingest_status')) {
            return Promise.resolve({ data: null, error: { message: 'json filter unsupported' } });
          }
          let data = rows;
          for (const filter of filters) {
            if (filter.column === 'metadata->>ingest_status') {
              data = data.filter((row) => row.metadata && row.metadata.ingest_status === filter.value);
            }
          }
          return Promise.resolve({ data, error: null });
        },
      };
      return chain;
    },
  };
}

test('normalizes deal party suffixes and punctuation', () => {
  assert.equal(normalizeDealPartyName('Theravance Biopharma, Inc.'), 'theravance biopharma');
  assert.equal(normalizeDealPartyName('Zymeworks Inc.'), 'zymeworks');
});

test('party-pair duplicate guard matches existing clean deals only', async () => {
  const clean = {
    id: 'deal-clean',
    acquirer: 'Zymeworks Inc.',
    target: 'Theravance Biopharma, Inc.',
    announce_date: '2026-06-28',
    metadata: { ingest_status: 'clean', source_url: 'https://sec.example/a.htm' },
  };
  const sb = makeDealsSupabase([
    {
      id: 'deal-staging',
      acquirer: 'Zymeworks Inc.',
      target: 'Theravance Biopharma, Inc.',
      announce_date: '2026-06-28',
      metadata: { ingest_status: 'staging' },
    },
    clean,
  ]);

  const result = await findExistingCleanDealByParties(sb, {
    acquirer: 'Zymeworks Incorporated',
    target: 'Theravance Biopharma',
    signing_date: '2026-06-28',
  });

  assert.equal(result, clean);
});

test('party-pair duplicate guard does not merge different signing dates', async () => {
  const sb = makeDealsSupabase([
    {
      id: 'old-deal',
      acquirer: 'Buyer Inc.',
      target: 'Target Inc.',
      announce_date: '2024-01-01',
      metadata: { ingest_status: 'clean' },
    },
  ]);

  const result = await findExistingCleanDealByParties(sb, {
    acquirer: 'Buyer Inc.',
    target: 'Target Inc.',
    signing_date: '2026-01-01',
  });

  assert.equal(result, null);
});

test('party-pair duplicate guard falls back when JSON filter is unsupported', async () => {
  const clean = {
    id: 'deal-clean',
    acquirer: 'Acquirer Corp.',
    target: 'Target LLC',
    announce_date: null,
    metadata: { ingest_status: 'clean' },
  };
  const sb = makeDealsSupabase([clean], { failJsonFilter: true });

  const result = await findExistingCleanDealByParties(sb, {
    acquirer: 'Acquirer',
    target: 'Target',
    signing_date: '2026-01-01',
  });

  assert.equal(result, clean);
  assert.equal(sb.calls.filter((call) => call.method === 'limit').length, 2);
});
