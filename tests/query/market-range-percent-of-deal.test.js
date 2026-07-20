// r13 (Ben, "% of deal value"): MARKET_RANGE's "global calculation" —
// alongside the existing dollar-basis stats/distribution/deal_points, a
// money-typed field (registry type 'usd'/'currency') should ALSO get a
// parallel percent-basis distribution (amount / that deal's own
// deals.value_usd), with deals lacking value_usd excluded and counted.
const test = require('node:test');
const assert = require('node:assert/strict');

const { executeMarketRange } = require('../../lib/query/executors/market-range');

function feature(value) {
  return { value, quotes: ['supporting quote'] };
}

const deals = [
  { id: 'd1', acquirer: 'Buyer One', target: 'Target One', value_usd: 1000000000, announce_date: '2025-01-15', sector: 'Tech' },
  { id: 'd2', acquirer: 'Buyer Two', target: 'Target Two', value_usd: 2000000000, announce_date: '2025-02-15', sector: 'Tech' },
  { id: 'd3', acquirer: 'Buyer Three', target: 'Target Three', value_usd: 500000000, announce_date: '2024-03-15', sector: 'Tech' },
  // No value_usd on file — excluded from the percent basis, but still
  // counted in the dollar-basis stats/n exactly as before.
  { id: 'd4', acquirer: 'Buyer Four', target: 'Target Four', value_usd: null, announce_date: '2024-06-01', sector: 'Tech' },
];

function termfProvision(dealId, id, feeAmount) {
  return {
    id,
    deal_id: dealId,
    type: 'TERMF',
    category: 'Termination fee',
    full_text: 'Company shall pay Parent a termination fee.',
    ai_metadata: { features: { feeAmount: feature(feeAmount) } },
  };
}

const provisions = [
  termfProvision('d1', 'p1', '$30,000,000'), // 3.0% of 1,000,000,000
  termfProvision('d2', 'p2', '$60,000,000'), // 3.0% of 2,000,000,000
  termfProvision('d3', 'p3', '$100,000,000'), // 20.0% of 500,000,000
  termfProvision('d4', 'p4', '$10,000,000'), // no value_usd -> excluded
];

test('MARKET_RANGE adds a parallel percent-of-deal-value distribution for a money field', () => {
  const result = executeMarketRange(
    { provision_type: 'TERMINATION_FEE', field_path: 'feeAmount', deal_filter: {} },
    { deals, provisions },
  );

  // Existing dollar-basis fields are untouched: all four deals have a value.
  assert.equal(result.n, 4);
  assert.equal(result.deal_points.length, 4);
  assert.equal(result.stats.n, 4);

  // New percent-basis fields.
  assert.ok(result.percentStats, 'percentStats should be present for a money field');
  assert.equal(result.percentStats.excludedCount, 1);
  assert.equal(result.percentStats.n, 3);
  assert.equal(result.percentStats.median, 3);
  assert.equal(result.percentStats.min, 3);
  assert.equal(result.percentStats.max, 20);

  // Per-deal percent on the underlying list.
  const byDeal = new Map(result.deal_points.map((point) => [point.deal_id, point]));
  assert.equal(byDeal.get('d1').percent, 3);
  assert.equal(byDeal.get('d2').percent, 3);
  assert.equal(byDeal.get('d3').percent, 20);
  assert.equal(byDeal.get('d4').percent, null);
});

test('MARKET_RANGE does not add percentStats for a non-money field', () => {
  const nonMoneyDeals = [
    { id: 'd1', acquirer: 'Buyer One', target: 'Target One', value_usd: 1000000000 },
    { id: 'd2', acquirer: 'Buyer Two', target: 'Target Two', value_usd: 2000000000 },
  ];
  const nonMoneyProvisions = [
    {
      id: 'p1',
      deal_id: 'd1',
      type: 'IOC',
      category: 'Interim operating covenant',
      full_text: 'Four business days.',
      ai_metadata: { features: { initialMatchPeriodDays: feature(4) } },
    },
    {
      id: 'p2',
      deal_id: 'd2',
      type: 'IOC',
      category: 'Interim operating covenant',
      full_text: 'Three business days.',
      ai_metadata: { features: { initialMatchPeriodDays: feature(3) } },
    },
  ];
  const result = executeMarketRange(
    { provision_type: 'COVENANT_INTERIM_OPERATING', field_path: 'initialMatchPeriodDays', deal_filter: {} },
    { deals: nonMoneyDeals, provisions: nonMoneyProvisions },
  );
  assert.equal(result.percentStats, null);
  assert.equal(result.deal_points.every((point) => !('percent' in point) || point.percent === undefined), true);
});

test('termination-fee percentage results retain fee side, USD amount and nested triggers', () => {
  const feeDeals = [{
    id: 'd1', acquirer: 'Shell Buyer, Inc.', target: 'Target, Inc.', value_usd: 1_000_000_000,
    metadata: { acquirer_display: 'Acme', target_display: 'Target' },
  }];
  const feeProvisions = [{
    id: 'p1', deal_id: 'd1', type: 'TERMF', category: 'Termination fee',
    ai_metadata: { features: { companyTerminationFee: {
      amount: '$30,000,000', triggers: [{ code: 'SUPERIOR_PROPOSAL', label: 'Superior proposal', text: 'Company terminates for a Superior Proposal.' }],
    } } },
  }];
  const result = executeMarketRange(
    { provision_type: 'TERMINATION_FEE', field_path: 'feePctOfDealValue', deal_filter: {} },
    { deals: feeDeals, provisions: feeProvisions },
  );
  assert.equal(result.primary_basis, 'percent_of_deal_value');
  assert.equal(result.fee_context.label, 'Company / target termination fee');
  assert.equal(result.deal_points[0].deal_name, 'Acme / Target');
  assert.equal(result.deal_points[0].value, 3);
  assert.equal(result.deal_points[0].amount_usd, 30_000_000);
  assert.equal(result.deal_points[0].triggers[0].label, 'Superior proposal');
});
