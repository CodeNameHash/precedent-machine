// F3 gate: proves pages/api/home.js and pages/index.js's getStaticProps
// build the *same* { deals, search_index } shape from the *same*
// lib/home-data.js code path (no duplicated shaping logic to drift), and
// that getStaticProps fails soft (never throws) when Supabase env is
// absent, per DEALS-INDEX-SPEC F3.
const test = require('node:test');
const assert = require('node:assert/strict');

// A tiny fake Supabase client covering exactly the query shapes
// lib/home-data.js issues: deals select+order, provisions
// select+order+range (paged), and quality-metrics select+in.
function fakeSupabase({ deals = [], provisions = [], qualityMetrics = [] } = {}) {
  return {
    from(table) {
      if (table === 'deals') {
        return {
          select() {
            return {
              order() {
                return Promise.resolve({ data: deals, error: null });
              },
            };
          },
        };
      }
      if (table === 'provisions') {
        return {
          select() {
            return {
              order() {
                return {
                  range(start, end) {
                    return Promise.resolve({ data: provisions.slice(start, end + 1), error: null });
                  },
                };
              },
            };
          },
        };
      }
      // deal_quality_metrics (QUALITY_METRICS_TABLE)
      return {
        select() {
          return {
            in(_col, ids) {
              return Promise.resolve({
                data: qualityMetrics.filter((row) => ids.includes(row.deal_id)),
                error: null,
              });
            },
          };
        },
      };
    },
  };
}

function sampleDealRow() {
  return {
    id: 'deal-1',
    acquirer: 'Acme Buyer Corp',
    target: 'Acme Target Inc',
    value_usd: 5_000_000_000,
    announce_date: '2026-01-15',
    sector: 'Technology',
    ingest_status: null,
    acquirer_display: null,
    ultimateParent: null,
    ultimate_parent: null,
    parent_entity: null,
    target_display: null,
    target_entity: null,
    headlineConsiderationType: null,
    considerationType: 'CASH',
    deal_facts: null,
    buyer_profile: 'strategic',
    merger_form: null,
    value_provenance: null,
    advisors_v2: null,
    advisors: null,
  };
}

test('fetchHomeData: shapes deals + search_index, filters staging deals', async () => {
  const { fetchHomeData } = require('../lib/home-data');
  const sb = fakeSupabase({
    deals: [sampleDealRow(), { ...sampleDealRow(), id: 'deal-2', ingest_status: 'staging' }],
    provisions: [],
    qualityMetrics: [{ deal_id: 'deal-1', provision_count: 42 }],
  });

  const payload = await fetchHomeData(sb);

  assert.equal(payload.deals.length, 1, 'staging deal is excluded');
  const deal = payload.deals[0];
  assert.equal(deal.id, 'deal-1');
  assert.equal(deal.value, 5_000_000_000);
  assert.equal(deal.value_band, '$1B-$10B');
  assert.equal(deal.consideration_type, 'CASH');
  assert.equal(deal.provision_count, 42);
  assert.ok(Array.isArray(payload.search_index));
  assert.ok(payload.search_index.some((hit) => hit.type === 'deal'));
});

test('fetchHomeData: derives canonical deal structure from provisions and omits provision-term payload', async () => {
  const { fetchHomeData } = require('../lib/home-data');
  const provisions = [
    {
      id: 'p-structure', deal_id: 'deal-1', type: 'STRUCT', category: 'The Merger',
      ai_metadata: { features: { dealStructure: { value: 'TWO_STEP_TENDER_OFFER', quotes: ['the Offer followed by the Merger'] } } },
    },
    {
      id: 'p-terms', deal_id: 'deal-1', type: 'TERMINATION_FEE', category: 'TERMF-TARGET',
      ai_metadata: { features: { companyTerminationFee: { amount: '$30,000,000' }, goShopPresent: true } },
    },
  ];
  const sb = fakeSupabase({ deals: [sampleDealRow()], provisions, qualityMetrics: [] });

  const payload = await fetchHomeData(sb);
  const deal = payload.deals[0];

  assert.equal(deal.structure, 'TWO_STEP_TENDER_OFFER');
  for (const key of ['termination_fee', 'reverse_termination_fee', 'outside_date_months', 'go_shop']) {
    assert.equal(Object.prototype.hasOwnProperty.call(deal, key), false, `${key} must not ship on the deal index payload`);
  }
  assert.ok(!JSON.stringify(payload).includes('companyTerminationFee'), 'raw provision features must not leak into the payload');
});

test('fetchHomeData: a deal with no canonical structure provision gets null structure', async () => {
  const { fetchHomeData } = require('../lib/home-data');
  const sb = fakeSupabase({ deals: [sampleDealRow()], provisions: [], qualityMetrics: [] });
  const payload = await fetchHomeData(sb);
  const deal = payload.deals[0];
  assert.equal(deal.structure, null);
});

test('computeDealStructures unwraps tagged/citable values and prefers a specific code over OTHER', () => {
  const { computeDealStructures } = require('../lib/home-data');
  const structures = computeDealStructures([
    { deal_id: 'deal-1', ai_metadata: { features: { dealStructure: 'OTHER' } } },
    { deal_id: 'deal-1', ai_metadata: { features: { dealStructure: { value: { code: 'ONE_STEP_MERGER' } } } } },
    { deal_id: 'deal-2', ai_metadata: { features: { dealStructure: { code: 'TWO_STEP_TENDER_OFFER' } } } },
  ]);
  assert.equal(structures.get('deal-1'), 'ONE_STEP_MERGER');
  assert.equal(structures.get('deal-2'), 'TWO_STEP_TENDER_OFFER');
});

test('fetchHomeData falls back to a provision merger form when deal metadata is blank', async () => {
  const { fetchHomeData } = require('../lib/home-data');
  const provisions = [{
    id: 'p-form', deal_id: 'deal-1', type: 'STRUCT', category: 'The Merger',
    ai_metadata: { features: { mergerForm: { code: 'REVERSE_TRIANGULAR_MERGER' } } },
  }];
  const payload = await fetchHomeData(fakeSupabase({ deals: [sampleDealRow()], provisions }));
  assert.equal(payload.deals[0].merger_form, 'REVERSE_TRIANGULAR_MERGER');
});

test('pages/api/home.js and getStaticProps both build the payload via fetchHomeData (single source of truth)', async () => {
  // Both pages/api/home.js and lib/home-static-props.js require lib/home-data
  // — assert they resolve to the exact same file (Node's require cache
  // dedupes by resolved path) so a change to shaping logic can't drift
  // between the API route and the ISR snapshot.
  const homeDataPath = require.resolve('../lib/home-data');
  const apiRoutePath = require.resolve('../pages/api/home.js');
  const staticPropsPath = require.resolve('../lib/home-static-props');
  assert.ok(homeDataPath, 'lib/home-data.js resolves');
  // Load the source text of each consumer and confirm both import from
  // the shared module rather than re-implementing the fetch/shape logic.
  const fs = require('fs');
  const apiSrc = fs.readFileSync(apiRoutePath, 'utf8');
  const staticSrc = fs.readFileSync(require.resolve('../lib/home-static-props'), 'utf8');
  assert.match(apiSrc, /require\(['"]\.\.\/\.\.\/lib\/home-data['"]\)/,
    'pages/api/home.js must import fetchHomeData from lib/home-data, not duplicate the query logic');
  assert.match(staticSrc, /require\(['"]\.\/home-data['"]\)/,
    'lib/home-static-props.js must import fetchHomeData from lib/home-data, not duplicate the query logic');
  assert.equal(staticPropsPath, require.resolve('../lib/home-static-props'));
});

test('getHomeStaticProps: fails soft to empty props + revalidate when sbFactory() returns null (Supabase env absent)', async () => {
  const { getHomeStaticProps } = require('../lib/home-static-props');
  // pages/index.js's getStaticProps calls getHomeStaticProps(getServiceSupabase);
  // getServiceSupabase() itself returns null when Supabase env vars are
  // absent (see lib/supabase.js) — this is that exact contract, isolated
  // from the JSX page so it's requireable under plain node:test.
  const result = await getHomeStaticProps(() => null);
  assert.deepEqual(result, { props: { initialData: null }, revalidate: 300 });
});

test('getHomeStaticProps: fails soft to empty props + revalidate when the Supabase query throws', async () => {
  const { getHomeStaticProps } = require('../lib/home-static-props');
  const throwingSb = { from() { throw new Error('connection refused'); } };
  const result = await getHomeStaticProps(() => throwingSb);
  assert.deepEqual(result, { props: { initialData: null }, revalidate: 300 });
});

test('lib/supabase.js getServiceSupabase(): returns null when env vars are absent (build-time / CI fail-soft contract)', async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevSupabaseUrl = process.env.SUPABASE_URL;
  const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prevService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete require.cache[require.resolve('../lib/supabase')];
    const { getServiceSupabase } = require('../lib/supabase');
    assert.equal(getServiceSupabase(), null);
  } finally {
    if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevSupabaseUrl !== undefined) process.env.SUPABASE_URL = prevSupabaseUrl;
    if (prevAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
    if (prevService !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevService;
    delete require.cache[require.resolve('../lib/supabase')];
  }
});

test('getHomeStaticProps: with Supabase configured, produces the same payload shape as fetchHomeData (== /api/home body)', async () => {
  const { getHomeStaticProps } = require('../lib/home-static-props');
  const { fetchHomeData } = require('../lib/home-data');

  // getHomeStaticProps takes an injectable sbFactory (defaults to the real
  // getServiceSupabase in production) precisely so tests can prove its
  // output matches fetchHomeData() — the same function pages/api/home.js
  // calls — without depending on a live Supabase connection.
  const sb = fakeSupabase({ deals: [sampleDealRow()], provisions: [], qualityMetrics: [] });
  const staticResult = await getHomeStaticProps(() => sb);
  const apiPayload = await fetchHomeData(sb);

  assert.deepEqual(staticResult.props.initialData, apiPayload,
    'getStaticProps initialData must match the exact shape /api/home returns as its JSON body');
  assert.equal(staticResult.revalidate, 300);
});
