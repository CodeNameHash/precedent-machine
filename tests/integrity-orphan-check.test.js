const test = require('node:test');
const assert = require('node:assert/strict');

let mod;

test.before(async () => {
  mod = await import('../scripts/integrity-orphan-check.mjs');
});

// ── evaluateOrphanCheck (threshold logic, stubbed rows, no DB) ─────────────

test('evaluateOrphanCheck: matches the reported v1 production claims orphan rate', () => {
  // 73,712 resolvable of 74,852 total claims -> ~1.523% orphan rate, well
  // documented in the spec as the live corpus finding this script exists to
  // catch. Modelled at 1/100th scale here: 737 ids present out of 748 total,
  // 11 orphans.
  const total = 748;
  const resolvableCount = 737;
  const parentKeySet = new Set(Array.from({ length: resolvableCount }, (_, i) => `provision-${i}`));
  const childRows = Array.from({ length: total }, (_, i) => ({
    id: `claim-${i}`,
    source_provision_id: i < resolvableCount ? `provision-${i}` : `missing-provision-${i}`,
  }));

  const result = mod.evaluateOrphanCheck(childRows, parentKeySet, {
    idColumn: 'id',
    fkColumn: 'source_provision_id',
  });

  assert.equal(result.total, 748);
  assert.equal(result.resolvable, 737);
  assert.equal(result.orphanCount, 11);
  assert.ok(Math.abs(result.orphanPct - 1.4706) < 0.001);
});

test('evaluateOrphanCheck: null/undefined fk values are excluded from total (not orphans)', () => {
  const parentKeySet = new Set(['p1']);
  const childRows = [
    { id: 'c1', fk: 'p1' },
    { id: 'c2', fk: null },
    { id: 'c3', fk: undefined },
    { id: 'c4' }, // fk key absent entirely
  ];

  const result = mod.evaluateOrphanCheck(childRows, parentKeySet, { idColumn: 'id', fkColumn: 'fk' });

  assert.equal(result.total, 1);
  assert.equal(result.resolvable, 1);
  assert.equal(result.orphanCount, 0);
  assert.equal(result.orphanPct, 0);
});

test('evaluateOrphanCheck: empty child set gives 0% orphan rate, not NaN/division-by-zero', () => {
  const result = mod.evaluateOrphanCheck([], new Set(), { idColumn: 'id', fkColumn: 'fk' });
  assert.deepEqual(result, { total: 0, resolvable: 0, orphanCount: 0, orphanPct: 0, sampleOrphanIds: [] });
});

test('evaluateOrphanCheck: samples at most 10 orphan ids, in encounter order', () => {
  const childRows = Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, fk: `missing-${i}` }));
  const result = mod.evaluateOrphanCheck(childRows, new Set(), { idColumn: 'id', fkColumn: 'fk' });
  assert.equal(result.orphanCount, 25);
  assert.equal(result.sampleOrphanIds.length, 10);
  assert.deepEqual(result.sampleOrphanIds, ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9']);
});

test('evaluateOrphanCheck: all rows resolvable gives 100% resolvable, 0 orphans', () => {
  const parentKeySet = new Set(['p1', 'p2']);
  const childRows = [{ id: 'c1', fk: 'p1' }, { id: 'c2', fk: 'p2' }];
  const result = mod.evaluateOrphanCheck(childRows, parentKeySet, { idColumn: 'id', fkColumn: 'fk' });
  assert.equal(result.orphanCount, 0);
  assert.equal(result.orphanPct, 0);
});

// ── decideGate (exit-code logic) ────────────────────────────────────────────

test('decideGate: passes when every check is at or under the threshold', () => {
  const results = [
    { name: 'a', orphanPct: 2.0 },
    { name: 'b', orphanPct: 0 },
  ];
  const gate = mod.decideGate(results, 2.0);
  assert.equal(gate.ok, true);
  assert.deepEqual(gate.failing, []);
});

test('decideGate: fails when any check strictly exceeds the threshold', () => {
  const results = [
    { name: 'a', orphanPct: 1.523 },
    { name: 'b', orphanPct: 2.5 },
  ];
  const gate = mod.decideGate(results, 2.0);
  assert.equal(gate.ok, false);
  assert.deepEqual(gate.failing.map((r) => r.name), ['b']);
});

test('decideGate: default threshold (2.0) matches the documented v1 claims orphan rate as passing', () => {
  // The spec's live finding is ~1.523% orphaned claims. At the default 2.0%
  // ceiling that should PASS today (it's a gate for regressions, not a
  // report that the current corpus is already broken).
  const gate = mod.decideGate([{ name: 'claims.source_provision_id -> provisions.id', orphanPct: 1.523 }], 2.0);
  assert.equal(gate.ok, true);
});

// ── parseArgs / resolveSupabaseConfig ───────────────────────────────────────

test('parseArgs: defaults maxOrphanPct to 2.0 and json to false', () => {
  const args = mod.parseArgs([]);
  assert.equal(args.maxOrphanPct, 2.0);
  assert.equal(args.json, false);
  assert.equal(args.projectUrl, null);
  assert.equal(args.serviceKey, null);
});

test('parseArgs: reads --project-url, --service-key, --max-orphan-pct, --json', () => {
  const args = mod.parseArgs([
    '--project-url', 'https://example.supabase.co',
    '--service-key', 'secret-key',
    '--max-orphan-pct', '1.5',
    '--json',
  ]);
  assert.equal(args.projectUrl, 'https://example.supabase.co');
  assert.equal(args.serviceKey, 'secret-key');
  assert.equal(args.maxOrphanPct, 1.5);
  assert.equal(args.json, true);
});

test('parseArgs: rejects an unknown flag', () => {
  assert.throws(() => mod.parseArgs(['--bogus']), /Unknown arg/);
});

test('parseArgs: rejects a non-numeric --max-orphan-pct', () => {
  assert.throws(() => mod.parseArgs(['--max-orphan-pct', 'nope']), /non-negative number/);
});

test('resolveSupabaseConfig: CLI flags win over env vars', () => {
  const env = { SUPABASE_URL: 'env-url', SUPABASE_SERVICE_ROLE_KEY: 'env-key' };
  const config = mod.resolveSupabaseConfig({ projectUrl: 'cli-url', serviceKey: 'cli-key' }, env);
  assert.deepEqual(config, { url: 'cli-url', key: 'cli-key' });
});

test('resolveSupabaseConfig: falls back to SUPABASE_URL, then NEXT_PUBLIC_SUPABASE_URL, then SUPABASE_SERVICE_ROLE_KEY', () => {
  assert.deepEqual(
    mod.resolveSupabaseConfig({ projectUrl: null, serviceKey: null }, { SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }),
    { url: 'u', key: 'k' },
  );
  assert.deepEqual(
    mod.resolveSupabaseConfig({ projectUrl: null, serviceKey: null }, { NEXT_PUBLIC_SUPABASE_URL: 'u2', SUPABASE_SERVICE_ROLE_KEY: 'k2' }),
    { url: 'u2', key: 'k2' },
  );
});

test('resolveSupabaseConfig: missing config resolves to nulls, not a throw', () => {
  assert.deepEqual(mod.resolveSupabaseConfig({ projectUrl: null, serviceKey: null }, {}), { url: null, key: null });
});

// ── runChecks against a stubbed (non-DB) Supabase-shaped client ────────────

function makeStubClient(rowsByTable) {
  // Minimal stand-in for the subset of the supabase-js query builder this
  // script uses: .from(table).select(cols)[.not(col,'is',null)].order(col,
  // {ascending}).range(from,to) -> Promise<{ data, error }>. No network, no
  // DB -- just returns fixed in-memory rows (one row set per table, exactly
  // as a real table would have all its columns on every row), paginated by
  // `range`. Used both as "parent" (selecting the referenced key column) and
  // "child" (selecting id + fk column) depending on which check is running.
  return {
    from(table) {
      const builder = {
        _notNullCol: null,
        select() { return builder; },
        not(col) { builder._notNullCol = col; return builder; },
        order() { return builder; },
        async range(from, to) {
          const source = rowsByTable[table];
          if (!source) return { data: null, error: { message: `no stub rows for ${table}` } };
          let rows = source;
          if (builder._notNullCol) {
            rows = rows.filter((row) => row[builder._notNullCol] !== null && row[builder._notNullCol] !== undefined);
          }
          const page = rows.slice(from, to + 1);
          return { data: page, error: null };
        },
      };
      return builder;
    },
  };
}

test('runChecks: computes per-check totals/orphans end to end against a stubbed client', async () => {
  const client = makeStubClient({
    provisions: [{ id: 'prov-1' }, { id: 'prov-2' }],
    provision_cards: [
      { id: 'card-1', excerpt_id: 'exc-1', deal_id: 'deal-1' },
      { id: 'card-2', excerpt_id: 'exc-2', deal_id: 'deal-missing' },
    ],
    deals: [{ id: 'deal-1' }],
    claims: [
      { id: 'claim-1', source_provision_id: 'prov-1', excerpt_id: 'exc-1' },
      { id: 'claim-2', source_provision_id: 'prov-missing', excerpt_id: 'exc-1' },
    ],
  });

  const checks = [
    {
      name: 'claims.source_provision_id -> provisions.id',
      childTable: 'claims', childIdColumn: 'id', childFkColumn: 'source_provision_id',
      parentTable: 'provisions', parentKeyColumn: 'id',
    },
    {
      name: 'claims.excerpt_id -> provision_cards.excerpt_id',
      childTable: 'claims', childIdColumn: 'id', childFkColumn: 'excerpt_id',
      parentTable: 'provision_cards', parentKeyColumn: 'excerpt_id',
    },
    {
      name: 'provision_cards.deal_id -> deals.id',
      childTable: 'provision_cards', childIdColumn: 'id', childFkColumn: 'deal_id',
      parentTable: 'deals', parentKeyColumn: 'id',
    },
  ];

  const results = await mod.runChecks(client, checks);

  const byName = Object.fromEntries(results.map((r) => [r.name, r]));
  assert.equal(byName['claims.source_provision_id -> provisions.id'].orphanCount, 1);
  assert.equal(byName['claims.excerpt_id -> provision_cards.excerpt_id'].orphanCount, 0);
  assert.equal(byName['provision_cards.deal_id -> deals.id'].orphanCount, 1);

  const gate = mod.decideGate(results, 2.0);
  // claims.source_provision_id: 1/2 = 50% orphaned in this tiny stub -> fails a 2% gate.
  assert.equal(gate.ok, false);
  assert.ok(gate.failing.some((r) => r.name === 'claims.source_provision_id -> provisions.id'));
});

test('runChecks: surfaces a query error instead of silently returning zeroes', async () => {
  const client = makeStubClient({});
  await assert.rejects(
    () => mod.runChecks(client, [{
      name: 'x', childTable: 'nope', childIdColumn: 'id', childFkColumn: 'fk',
      parentTable: 'alsoNope', parentKeyColumn: 'id',
    }]),
    /no stub rows for/,
  );
});

// ── CHECKS: the minimum set the spec requires ───────────────────────────────

test('CHECKS includes at least the four required relationships', () => {
  const names = mod.CHECKS.map((c) => c.name);
  assert.ok(names.includes('claims.source_provision_id -> provisions.id'));
  assert.ok(names.includes('claims.excerpt_id -> provision_cards.excerpt_id'));
  assert.ok(names.includes('provision_cards.deal_id -> deals.id'));
  assert.ok(names.includes('provisions.deal_id -> deals.id'));
});
