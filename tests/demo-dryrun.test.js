// tests/demo-dryrun.test.js — WP-7 (M5-06) demo-dryrun unit coverage.
//
// scripts/demo-dryrun.js's ingest/QA/query steps shell out to other scripts
// and need a live Supabase + LLM CLI backend, so they aren't unit-tested
// here. What IS pure/DB-mockable and load-bearing enough to regression-test
// without a live environment:
//   - teardownStagingDeal(): deletes only the target deal_id's rows across
//     every deal_id-keyed table, is idempotent, fails soft on a table this
//     env doesn't have, and reports residual counts truthfully.
//   - checkStagingInvisible(): the hard staging-invisibility assertion.
//   - checkReviewSurface(): the review-surface step's card/span logic.
//   - isMissingTableError() / parseArgs().

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DIRECT_DEAL_ID_TABLES,
  parseArgs,
  isMissingTableError,
  isMissingColumnError,
  isCleanSkipError,
  QA_STAGING_NAME_PREFIX,
  countByDealId,
  teardownStagingDeal,
  checkStagingInvisible,
  checkReviewSurface,
} = require('../scripts/demo-dryrun');

const MISSING = Symbol('missing-table');

function missingErr(table) {
  return { message: `Could not find the table 'public.${table}' in the schema cache`, code: '42P01' };
}

// Minimal in-memory Supabase mock covering exactly the chains
// teardownStagingDeal / checkStagingInvisible / checkReviewSurface use:
// select(...).eq().in().order().range().single()/.maybeSingle()/then, and
// delete().eq()/.in(). Tables can be marked MISSING to simulate a
// not-yet-migrated table (42P01), exercising the fail-soft path.
function createMockSupabase(initial = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(initial)) {
    tables[name] = rows === MISSING ? MISSING : rows.map((r) => ({ ...r }));
  }
  function ensure(table) {
    if (!(table in tables)) tables[table] = [];
    return tables[table];
  }

  function makeQuery(rows, opts) {
    let filtered = rows;
    const api = {
      eq(col, val) { filtered = filtered.filter((r) => r[col] === val); return api; },
      in(col, vals) { const set = new Set(vals); filtered = filtered.filter((r) => set.has(r[col])); return api; },
      order() { return api; },
      range() { return api; },
      async single() {
        if (filtered.length !== 1) return { data: null, error: { message: 'no rows' } };
        return { data: { ...filtered[0] }, error: null };
      },
      async maybeSingle() {
        if (filtered.length === 0) return { data: null, error: null };
        return { data: { ...filtered[0] }, error: null };
      },
      then(resolve, reject) {
        const result = opts && opts.count
          ? { data: opts.head ? null : filtered.map((r) => ({ ...r })), count: filtered.length, error: null }
          : { data: filtered.map((r) => ({ ...r })), error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return api;
  }

  function missingQuery(table) {
    const err = missingErr(table);
    const api = {
      eq() { return api; },
      in() { return api; },
      order() { return api; },
      range() { return api; },
      async single() { return { data: null, error: err }; },
      async maybeSingle() { return { data: null, error: err }; },
      then(resolve, reject) {
        return Promise.resolve({ data: null, count: null, error: err }).then(resolve, reject);
      },
    };
    return api;
  }

  return {
    tables,
    from(table) {
      return {
        select(cols, opts = {}) {
          if (tables[table] === MISSING) return missingQuery(table);
          return makeQuery(ensure(table), opts);
        },
        delete() {
          if (tables[table] === MISSING) {
            const err = missingErr(table);
            return { eq: () => Promise.resolve({ error: err }), in: () => Promise.resolve({ error: err }) };
          }
          return {
            eq(col, val) {
              tables[table] = ensure(table).filter((r) => r[col] !== val);
              return Promise.resolve({ error: null });
            },
            in(col, vals) {
              const set = new Set(vals);
              tables[table] = ensure(table).filter((r) => !set.has(r[col]));
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

test('DIRECT_DEAL_ID_TABLES lists provisions and ingest_jobs first (no cascade from deals — must precede the deals delete)', () => {
  assert.equal(DIRECT_DEAL_ID_TABLES[0], 'provisions');
  assert.equal(DIRECT_DEAL_ID_TABLES[1], 'ingest_jobs');
  assert.ok(DIRECT_DEAL_ID_TABLES.includes('provision_cards'));
  assert.ok(DIRECT_DEAL_ID_TABLES.includes('claims'));
  assert.ok(DIRECT_DEAL_ID_TABLES.includes('parser_regions'));
});

test('isMissingTableError recognizes 42P01 and the PostgREST message variants', () => {
  assert.equal(isMissingTableError({ code: '42P01' }), true);
  assert.equal(isMissingTableError({ message: 'relation "x" does not exist' }), true);
  assert.equal(isMissingTableError({ message: "Could not find the table 'public.x' in the schema cache" }), true);
  assert.equal(isMissingTableError({ message: 'permission denied' }), false);
  assert.equal(isMissingTableError(null), false);
});

test('parseArgs: defaults to codex backend and the pinned fixture', () => {
  const args = parseArgs(['node', 'demo-dryrun.js']);
  assert.equal(args.backend, 'codex');
  assert.match(args.fixture, /landos-abbvie-agreement\.txt$/);
  assert.equal(args.json, null);
  assert.equal(args.reportDb, null);
});

test('parseArgs: --backend / --fixture / --no-report-db override defaults', () => {
  const args = parseArgs(['node', 'demo-dryrun.js', '--backend', 'claude', '--fixture', '/tmp/x.txt', '--no-report-db']);
  assert.equal(args.backend, 'claude');
  assert.equal(args.fixture, '/tmp/x.txt');
  assert.equal(args.reportDb, false);
});

test('teardownStagingDeal deletes only the target deal_id across every table, never touches a sibling deal', async () => {
  const dealId = 'deal-staging-1';
  const otherId = 'deal-live-1';
  const sb = createMockSupabase({
    deals: [{ id: dealId, metadata: { ingest_status: 'staging' } }, { id: otherId, metadata: {} }],
    provisions: [{ id: 'p1', deal_id: dealId }, { id: 'p2', deal_id: otherId }],
    provision_cards: [{ id: 'c1', deal_id: dealId }, { id: 'c2', deal_id: otherId }],
    claims: [{ id: 'cl1', deal_id: dealId }, { id: 'cl2', deal_id: otherId }],
    parser_regions: [{ id: 'r1', deal_id: dealId }, { id: 'r2', deal_id: otherId }],
    ingest_jobs: [{ id: 'j1', deal_id: dealId }],
    consideration_equity_provisions: [],
    deal_candidates: [],
  });

  const result = await teardownStagingDeal(sb, dealId);

  assert.equal(result.clean, true);
  assert.deepEqual(result.residualRowCounts, {});
  // the staging deal and only its rows are gone
  assert.equal(sb.tables.deals.some((d) => d.id === dealId), false);
  assert.equal(sb.tables.provisions.some((p) => p.deal_id === dealId), false);
  assert.equal(sb.tables.provision_cards.some((c) => c.deal_id === dealId), false);
  // the sibling deal's rows are untouched
  assert.equal(sb.tables.deals.some((d) => d.id === otherId), true);
  assert.equal(sb.tables.provisions.some((p) => p.deal_id === otherId), true);
  assert.equal(sb.tables.provision_cards.some((c) => c.deal_id === otherId), true);
  assert.equal(sb.tables.claims.some((c) => c.deal_id === otherId), true);
  assert.equal(sb.tables.parser_regions.some((r) => r.deal_id === otherId), true);
});

test('teardownStagingDeal is idempotent: a second call on an already-torn-down deal finds nothing and still reports clean', async () => {
  const dealId = 'deal-staging-2';
  const sb = createMockSupabase({
    deals: [{ id: dealId, metadata: { ingest_status: 'staging' } }],
    provisions: [{ id: 'p1', deal_id: dealId }],
    provision_cards: [],
    claims: [],
    parser_regions: [],
    consideration_equity_provisions: [],
    deal_candidates: [],
  });

  const first = await teardownStagingDeal(sb, dealId);
  assert.equal(first.clean, true);

  const second = await teardownStagingDeal(sb, dealId);
  assert.equal(second.clean, true);
  assert.deepEqual(second.residualRowCounts, {});
});

test('teardownStagingDeal fails soft on a table this env has not migrated yet (42P01) and still tears down the rest', async () => {
  const dealId = 'deal-staging-3';
  const sb = createMockSupabase({
    deals: [{ id: dealId, metadata: { ingest_status: 'staging' } }],
    provisions: [{ id: 'p1', deal_id: dealId }],
    provision_cards: [{ id: 'c1', deal_id: dealId }],
    claims: MISSING, // e.g. schema-05-claims.sql not yet applied in this env
    parser_regions: [],
    consideration_equity_provisions: [],
    deal_candidates: [],
  });

  const result = await teardownStagingDeal(sb, dealId);

  // A missing table is not a residual row — it's excluded from the count
  // (null), not flagged as dirty.
  assert.equal(result.clean, true);
  assert.equal(sb.tables.deals.some((d) => d.id === dealId), false);
  assert.equal(sb.tables.provisions.some((p) => p.deal_id === dealId), false);
});

test('teardownStagingDeal walks the election_mechanisms/election_options/proration_rules chain off consideration_equity_provisions', async () => {
  const dealId = 'deal-staging-4';
  const sb = createMockSupabase({
    deals: [{ id: dealId, metadata: { ingest_status: 'staging' } }],
    provisions: [],
    provision_cards: [],
    claims: [],
    parser_regions: [],
    deal_candidates: [],
    consideration_equity_provisions: [{ id: 'cep1', deal_id: dealId }],
    election_mechanisms: [{ id: 'em1', provision_id: 'cep1', proration_rule_id: 'pr1' }],
    election_options: [{ id: 'eo1', election_mechanism_id: 'em1' }],
    proration_rules: [{ id: 'pr1' }],
    consideration_treatments: [{ id: 'ct1', provision_id: 'cep1' }],
  });

  const result = await teardownStagingDeal(sb, dealId);

  assert.equal(result.clean, true);
  assert.deepEqual(sb.tables.election_options, []);
  assert.deepEqual(sb.tables.election_mechanisms, []);
  assert.deepEqual(sb.tables.proration_rules, []);
  assert.deepEqual(sb.tables.consideration_treatments, []);
  assert.deepEqual(sb.tables.consideration_equity_provisions, []);
});

test('checkStagingInvisible passes for a deal tagged ingest_status:staging and excluded from the live set', async () => {
  const dealId = 'deal-staging-5';
  const sb = createMockSupabase({
    deals: [
      { id: dealId, metadata: { ingest_status: 'staging' } },
      { id: 'deal-live', metadata: {} },
    ],
  });
  const result = await checkStagingInvisible(sb, dealId);
  assert.equal(result.excludedFromLiveSet, true);
  assert.equal(result.ingestStatus, 'staging');
});

test('checkStagingInvisible throws if the deal is missing the staging flag', async () => {
  const dealId = 'deal-not-staging';
  const sb = createMockSupabase({ deals: [{ id: dealId, metadata: {} }] });
  await assert.rejects(() => checkStagingInvisible(sb, dealId), /ingest_status: 'staging'/);
});

test('checkReviewSurface resolves at least one card span and throws when there are zero cards', async () => {
  const dealId = 'deal-review-1';
  const fullText = 'The Company shall pay the Termination Fee within two Business Days.';
  const sbWithCard = createMockSupabase({
    deals: [{ id: dealId, metadata: { full_text: fullText } }],
    provision_cards: [{
      id: 'card1',
      deal_id: dealId,
      kind: 'standard',
      section_ref: '1.1',
      short_title: 'Termination Fee',
      primary_quote: 'the Termination Fee within two Business Days',
      primary_quote_start: 0,
      primary_quote_end: 0,
      region_full_text: '',
      references: [],
      excerpt_id: 'card1',
    }],
    claims: [],
  });
  const result = await checkReviewSurface(sbWithCard, dealId);
  assert.equal(result.cardCount, 1);
  assert.equal(result.resolvedCardId, 'card1');
  assert.notEqual(result.resolvedStatus, 'unresolved');

  const sbEmpty = createMockSupabase({
    deals: [{ id: dealId, metadata: { full_text: fullText } }],
    provision_cards: [],
    claims: [],
  });
  await assert.rejects(() => checkReviewSurface(sbEmpty, dealId), /0 cards/);
});

// ── DEFECT 1/2/3 fixes (2026-07-19 live-gate run 1 findings) ───────────────

test('QA_STAGING_NAME_PREFIX is the substring ingest-local.js --staging stamps into the deal target name', () => {
  // ingest-qa.js's --deal flag matches by NAME SUBSTRING (see DEFECT 1),
  // not by id — this constant is what makes that substring resolve to
  // exactly our staging deal and nothing else.
  assert.equal(QA_STAGING_NAME_PREFIX, 'DRYRUN');
});

test('isMissingColumnError recognizes 42703 and the PostgREST "column ... does not exist" message shapes', () => {
  assert.equal(isMissingColumnError({ code: '42703' }), true);
  assert.equal(isMissingColumnError({ message: 'column "deal_id" of relation "x" does not exist' }), true);
  assert.equal(isMissingColumnError({ message: "Could not find the 'deal_id' column of 'x' in the schema cache" }), true);
  assert.equal(isMissingColumnError({ message: 'permission denied' }), false);
  assert.equal(isMissingColumnError(null), false);
});

test('isCleanSkipError is missing-table OR missing-column, and correctly rejects a genuinely unexplained error', () => {
  assert.equal(isCleanSkipError({ code: '42P01' }), true);
  assert.equal(isCleanSkipError({ code: '42703' }), true);
  assert.equal(isCleanSkipError({ message: 'connection reset' }), false);
  // Defense-in-depth: an error with an EMPTY message but a real 42703 code
  // must still classify as a clean skip (code alone is enough — the fix
  // must not depend on message content being present). Kept as a generic
  // regression guard even though DEFECT 3's actual root cause (below)
  // turned out not to be a missing-table/missing-column case at all.
  assert.equal(isCleanSkipError({ code: '42703', message: '' }), true);
});

test('countByDealId selects "*", never a named column — deal_quality_metrics has no "id" column (its PK is deal_id, not id)', async () => {
  const dealId = 'deal-defect3-cols';
  const fakeSb = {
    from(table) {
      assert.equal(table, 'deal_quality_metrics');
      return {
        select(cols, opts) {
          assert.equal(cols, '*');
          assert.deepEqual(opts, { count: 'exact', head: true });
          return { eq: () => Promise.resolve({ count: 1, error: null }) };
        },
      };
    },
  };
  const count = await countByDealId(fakeSb, 'deal_quality_metrics', dealId);
  assert.equal(count, 1);
});

test('countByDealId: DEFECT 3 real root cause (live-gate run 2) — selecting a column a table does not have (\'id\' on deal_quality_metrics, whose PK is deal_id) fails a HEAD request with an empty-body error; select(\'*\') sidesteps it entirely', async () => {
  const dealId = 'deal-defect3-real';
  // Reproduces the actual bug: querying the NAMED column 'id' on a HEAD
  // request against a table that has no such column returns PostgREST's
  // empty-body error (`{"message":""}` — no usable code either, since a
  // HEAD response never carries a body to explain itself). This is why the
  // 42P01/42703 clean-skip classification alone did NOT fix the original
  // symptom: the error shape from THIS bug doesn't reliably carry a code at
  // all. The real fix is structural — never select('id', ...) here.
  const fakeSb = {
    from() {
      return {
        select(cols) {
          if (cols === 'id') return { eq: () => Promise.resolve({ count: null, error: { message: '' } }) };
          if (cols === '*') return { eq: () => Promise.resolve({ count: 0, error: null }) };
          throw new Error(`unexpected select(${JSON.stringify(cols)})`);
        },
      };
    },
  };
  const count = await countByDealId(fakeSb, 'deal_quality_metrics', dealId);
  assert.equal(count, 0); // succeeds — countByDealId never takes the select('id', ...) path
});

test('countByDealId: a genuinely unexplained error still fails, and the thrown message carries the FULL stringified error (not just a possibly-empty .message)', async () => {
  const dealId = 'deal-defect3b';
  const fakeSb = {
    from() {
      return {
        select() {
          return { eq: () => Promise.resolve({ count: null, error: { code: 'XX000', message: '', details: 'unexpected server error' } }) };
        },
      };
    },
  };
  await assert.rejects(
    () => countByDealId(fakeSb, 'some_table', dealId),
    (err) => {
      assert.match(err.message, /some_table count failed/);
      assert.match(err.message, /unexpected server error/); // full error surfaced, not swallowed by an empty .message
      return true;
    },
  );
});
