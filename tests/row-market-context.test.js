const test = require('node:test');
const assert = require('node:assert/strict');

let mod;
test.before(async () => {
  mod = await import('../components/review-v2/rowMarketContext.js');
});

test('buildRowMarketContext resolves every declared row feature, not just the first match', () => {
  const row = {
    id: 'ioc-ordinary-course',
    label: 'Ordinary-course covenant',
    featureKeys: ['effortsStandard', 'requiredByLawException', 'consentException'],
    marketFeatureRoles: {
      effortsStandard: 'treatment',
      requiredByLawException: 'exception',
      consentException: 'exception',
    },
  };
  const marketColumn = {
    stats: {
      peerSetSize: 40,
      dealsWithCode: 36,
      featureSummary: [
        { attribute: 'consentException', kind: 'categorical', total: 24, values: [{ value: 'YES', label: 'Prior written consent', count: 24 }] },
        { attribute: 'effortsStandard', kind: 'categorical', total: 36, values: [{ value: 'CR', label: 'Commercially reasonable efforts', count: 21 }] },
        { attribute: 'requiredByLawException', kind: 'categorical', total: 29, values: [{ value: 'YES', label: 'Required by law', count: 29 }] },
      ],
    },
  };

  const context = mod.buildRowMarketContext(row, marketColumn);
  assert.equal(context.marketKey, 'ioc-ordinary-course');
  assert.equal(context.peerSetSize, 40);
  assert.equal(context.termDealCount, 36);
  assert.deepEqual(context.treatments.map((s) => s.attribute), ['effortsStandard']);
  assert.deepEqual(context.exceptions.map((s) => s.attribute), ['requiredByLawException', 'consentException']);
  assert.equal(context.exceptions[0].values[0].denominator, 29);
});

test('marketSummaryForRowContext preserves existing compact-cell behavior', () => {
  const row = { featureKeys: ['noticePeriod', 'consentException'] };
  const marketColumn = {
    stats: {
      featureSummary: [
        { attribute: 'consentException', kind: 'categorical', values: [] },
        { attribute: 'noticePeriod', kind: 'numeric', p25: 5, p75: 15 },
      ],
    },
  };
  assert.equal(mod.marketSummaryForRowContext(row, marketColumn).attribute, 'noticePeriod');
});

test('buildRowMarketContext returns null when a row has no stable market features', () => {
  assert.equal(mod.buildRowMarketContext({}, { stats: { featureSummary: [] } }), null);
});
