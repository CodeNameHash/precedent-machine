/* Tests for the minimal export refactor of
   scripts/reprocess/rematerialize-claims.js (SPEC-MECHANICAL-HARDENING-
   2026-07-23 part A, group 3): fetchProvisions / fetchCards / writeDealClaims
   are now exported so scripts/reprocess.js can drive the same planner/writer
   under --rematerialize, WITHOUT any change to this script's own CLI
   behavior. tests/reprocess-rematerialize-claims.test.js (the pre-existing
   suite) is left completely unmodified and must keep passing as-is — this
   file only adds coverage for the newly-exported entry points. */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchProvisions,
  fetchCards,
  writeDealClaims,
  buildDealPlan,
} = require('../scripts/reprocess/rematerialize-claims');

const DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';

test('fetchProvisions / fetchCards / writeDealClaims are now exported functions', () => {
  assert.equal(typeof fetchProvisions, 'function');
  assert.equal(typeof fetchCards, 'function');
  assert.equal(typeof writeDealClaims, 'function');
});

/* ── fake supabase client, mirroring the shape rematerialize-claims.js's own
   main() uses (sb.from(table).select(...).eq(...)) ───────────────────────── */

function makeFakeSbForFetch({ provisions = [], cards = [] } = {}) {
  return {
    from(table) {
      if (table === 'provisions') {
        return { select: () => ({ eq: () => Promise.resolve({ data: provisions, error: null }) }) };
      }
      if (table === 'provision_cards') {
        return { select: () => ({ eq: () => Promise.resolve({ data: cards, error: null }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

test('fetchProvisions selects provisions scoped to the given deal id', async () => {
  const provisions = [
    { id: 'p1', type: 'NOSOL', category: 'No Solicitation', full_text: 'text one', ai_metadata: {}, created_at: '2026-01-01' },
  ];
  const sb = makeFakeSbForFetch({ provisions });
  const out = await fetchProvisions(sb, DEAL_ID);
  assert.deepEqual(out, provisions);
});

test('fetchCards selects provision_cards scoped to the given deal id', async () => {
  const cards = [
    { id: 'c1', excerpt_id: 'excerpt-1', provision_instance_id: 'inst-1', region_id: 'region-1', provision_type: 'COVENANT_NO_SOLICITATION', short_title: 'No Solicitation', region_full_text: 'text one' },
  ];
  const sb = makeFakeSbForFetch({ cards });
  const out = await fetchCards(sb, DEAL_ID);
  assert.deepEqual(out, cards);
});

test('fetchProvisions surfaces a real (non-fetch) error rather than swallowing it', async () => {
  const sb = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }) }) };
  await assert.rejects(() => fetchProvisions(sb, DEAL_ID), /Provision fetch failed: boom/);
});

/* ── writeDealClaims: same mock-sb pattern as the existing (unmodified) test
   suite's makeMockSb(), used here only to exercise the newly-exported
   wrapper's own return value / no-provision_cards-writes contract. ───────── */

function card(overrides = {}) {
  return {
    id: 'card-1',
    excerpt_id: 'excerpt-1',
    provision_instance_id: 'instance-1',
    region_id: 'region-1',
    provision_type: 'COVENANT_NO_SOLICITATION',
    short_title: 'No Solicitation',
    region_full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ...overrides,
  };
}

function provision(overrides = {}) {
  return {
    id: 'prov-1',
    type: 'NOSOL',
    category: 'No Solicitation',
    full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ai_metadata: {},
    extraction_version: 'v2',
    extracted_at: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockSb() {
  const tables = { claims: [], provision_cards: [] };
  const calls = { provision_cards: [] };
  return {
    tables,
    calls,
    from(table) {
      if (table === 'provision_cards') {
        return {
          insert: (...a) => { calls.provision_cards.push(['insert', ...a]); return Promise.resolve({ error: null }); },
          update: (...a) => { calls.provision_cards.push(['update', ...a]); return Promise.resolve({ error: null }); },
          upsert: (...a) => { calls.provision_cards.push(['upsert', ...a]); return Promise.resolve({ error: null }); },
          delete: (...a) => {
            calls.provision_cards.push(['delete', ...a]);
            return { eq: () => ({ in: () => Promise.resolve({ error: null }) }) };
          },
          select: () => ({ eq: () => Promise.resolve({ data: tables.provision_cards, error: null }) }),
        };
      }
      return {
        upsert(rows, options) {
          for (const row of rows) {
            const idx = tables.claims.findIndex((r) => r[options.onConflict] === row[options.onConflict]);
            if (idx >= 0) tables.claims[idx] = { ...tables.claims[idx], ...row };
            else tables.claims.push({ ...row });
          }
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq(column, value) {
              const filtered = tables.claims.filter((r) => r[column] === value);
              return {
                in(column2, values) {
                  const valueSet = new Set(values);
                  return Promise.resolve({ data: filtered.filter((r) => valueSet.has(r[column2])), error: null });
                },
              };
            },
          };
        },
        delete() {
          return {
            eq(column, value) {
              return {
                in(column2, values) {
                  const valueSet = new Set(values);
                  tables.claims = tables.claims.filter((r) => !(r[column] === value && valueSet.has(r[column2])));
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('writeDealClaims: upserts claim rows and cleans up stale claims for matched excerpt_ids only, no provision_cards writes', async () => {
  const sb = makeMockSb();
  sb.tables.claims.push({ id: 'stale-claim', deal_id: DEAL_ID, excerpt_id: 'excerpt-1', attribute: 'oldAttr' });
  sb.tables.claims.push({ id: 'untouched-claim', deal_id: DEAL_ID, excerpt_id: 'excerpt-untouched', attribute: 'x' });

  const richProvision = provision({
    id: 'prov-rich',
    ai_metadata: {
      features: {
        carveouts: [{ code: 'PANDEMIC', label: 'Pandemic', text: 'pandemic', quotes: ['except for any pandemic'] }],
      },
    },
  });
  const plan = buildDealPlan(DEAL_ID, [card()], [richProvision]);
  assert.equal(plan.ok, true);
  assert.ok(plan.claimRows.length > 0);

  const staleDeleted = await writeDealClaims(sb, plan);

  assert.equal(staleDeleted, 1);
  assert.ok(!sb.tables.claims.some((r) => r.id === 'stale-claim'));
  assert.ok(sb.tables.claims.some((r) => r.id === 'untouched-claim'));
  assert.equal(sb.calls.provision_cards.length, 0, 'no provision_cards writes, ever');
});
