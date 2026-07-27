// Offline-generation coverage. Runtime homepage tests live in
// home-snapshot.test.js.
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
