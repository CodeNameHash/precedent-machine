const test = require('node:test');
const assert = require('node:assert/strict');

let mod;
test.before(async () => {
  mod = await import('../components/review-v2/rowMarketContext.js');
});

test('buildRowMarketContext resolves every declared row feature in row order', () => {
  const row = {
    id: 'ioc-ordinary-course',
    titleText: 'Conduct business in ordinary course',
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
  assert.equal(context.marketKey, 'term.conduct-business-in-ordinary-course');
  assert.equal(context.peerSetSize, 40);
  assert.equal(context.termDealCount, 36);
  assert.deepEqual(context.treatments.map((s) => s.attribute), ['effortsStandard']);
  assert.deepEqual(context.exceptions.map((s) => s.attribute), ['requiredByLawException', 'consentException']);
  assert.equal(context.exceptions[0].values[0].denominator, 36, 'exception prevalence uses deals containing the term');
});

test('known IOC exception features are classified without per-row role metadata', () => {
  const row = { code: 'IOC-DIVIDENDS', featureKeys: ['restrictionComponents', 'permittedExceptions', 'dollarThreshold'] };
  const marketColumn = {
    stats: {
      peerSetSize: 40,
      dealsWithCode: 31,
      featureSummary: [
        { attribute: 'permittedExceptions', kind: 'categorical', values: [{ label: 'Existing awards', count: 18 }] },
        { attribute: 'dollarThreshold', kind: 'numeric', median: 10000000 },
        { attribute: 'restrictionComponents', kind: 'categorical', values: [{ label: 'Dividends', count: 31 }] },
      ],
    },
  };
  const context = mod.buildRowMarketContext(row, marketColumn);
  assert.equal(context.marketKey, 'provision.ioc-dividends');
  assert.deepEqual(context.treatments.map((s) => s.attribute), ['restrictionComponents']);
  assert.deepEqual(context.exceptions.map((s) => s.attribute), ['permittedExceptions']);
  assert.deepEqual(context.metrics.map((s) => s.attribute), ['dollarThreshold']);
});

test('sidebar rowContext is preferred over compact featureSummary', () => {
  const row = {
    marketKey: 'ioc.affirmative.ordinary-course',
    featureKeys: ['effortsStandard'],
    marketFeatureRoles: { effortsStandard: 'treatment' },
  };
  const marketColumn = {
    stats: {
      peerSetSize: 40,
      dealsWithCode: 36,
      featureSummary: [{ attribute: 'effortsStandard', kind: 'categorical', values: [{ label: 'Wrong compact value', count: 99 }] }],
      rowContext: {
        scope: 'subtype',
        distributions: [{ attribute: 'effortsStandard', kind: 'categorical', values: [{ label: 'Direct obligation', count: 21, denominator: 36 }] }],
        deals: [{ dealId: 'deal-1', dealName: 'Buyer / Target' }],
      },
    },
  };
  const context = mod.buildRowMarketContext(row, marketColumn);
  assert.equal(context.primarySummary.values[0].label, 'Direct obligation');
  assert.equal(context.scope, 'subtype');
  assert.equal(context.deals.length, 1);
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
