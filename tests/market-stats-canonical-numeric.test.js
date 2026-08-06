const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { loadMarketDataset } = require('../lib/row-market-stats/source');

function numericSpec() {
  return {
    contractVersion: 1,
    rowKey: 'numeric-row',
    metricKey: 'numeric-row.value',
    label: 'Numeric value',
    comparison: { status: 'comparable', kind: 'numeric' },
    cohort: { scope: 'all_deals', eligibility: 'all_deals' },
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['numericFeature'], missingState: 'unknown' },
      value: { strategy: 'feature_value', featureKeys: ['numericFeature'] },
    },
    denominator: { prevalence: 'eligible_deals', distribution: 'present_deals' },
    semantics: { unit: 'count' },
  };
}

test('market-stats production path neither selects nor reads the optional canonical numeric cache', () => {
  const source = fs.readFileSync('lib/row-market-stats/source.js', 'utf8');
  const observations = fs.readFileSync('lib/row-market-stats/observations.js', 'utf8');
  const cacheColumn = ['canonical', 'numeric'].join('_');

  assert.equal(source.includes(cacheColumn), false);
  assert.equal(observations.includes(cacheColumn), false);
});

test('market-stats claim loading uses the migrated base-column projection only', async () => {
  const selects = [];
  const rows = {
    deals: [{ id: 'd1', acquirer: 'Buyer', target: 'Target', metadata: {} }],
    claims: [{ id: 'claim-1', deal_id: 'd1', excerpt_id: null, attribute: 'numericFeature', canonical: '5' }],
    provision_cards: [],
  };
  const supabase = {
    from(table) {
      const query = {
        select(columns) { selects.push({ table, columns }); return query; },
        in() { return query; },
        order() { return query; },
        range() { return Promise.resolve({ data: rows[table] || [], error: null }); },
      };
      return query;
    },
  };

  await loadMarketDataset(supabase, [numericSpec()]);

  const claimSelects = selects.filter(({ table }) => table === 'claims');
  assert.equal(claimSelects.length, 1);
  // The guard this test exists for: the projection must not reach for a
  // canonical_numeric cache column. State that directly rather than leaving it
  // implied by a byte-exact list, which any legitimate column addition breaks.
  assert.doesNotMatch(claimSelects[0].columns, /canonical_numeric/);
  // provision_instance_id is required: claim-to-card binding composes
  // deal_id + excerpt_id + provision_instance_id, because an excerpt is not a
  // unique card identity. Without it selected, that binding is inert.
  assert.equal(claimSelects[0].columns, 'id, deal_id, excerpt_id, provision_instance_id, attribute, canonical, verbatim, evidence_quote, provenance');
});

test('market-stats derives numeric values from loaded claim fields rather than an optional cache property', () => {
  const result = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: null,
    filters: {},
    specs: [numericSpec()],
  }, {
    deals: [{ id: 'd1', acquirer: 'Buyer', target: 'Target', metadata: {} }],
    cards: [],
    claims: [{
      id: 'claim-1',
      deal_id: 'd1',
      attribute: 'numericFeature',
      canonical: '5',
      canonical_numeric: { value: 99, unit: 'count' },
    }],
  }).byRow['numeric-row'].metrics['numeric-row.value'];

  assert.equal(result.distribution.cohorts[0].stats.median, 5);
});
