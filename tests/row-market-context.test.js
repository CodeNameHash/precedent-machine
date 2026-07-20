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

test('typed duration context is registered under its exact market row key', () => {
  const resolution = {
    rowKey: 'nosol-fiduciary-notice-period',
    label: 'Notice period',
    metrics: [
      { metricKey: 'notice.presence', label: 'Notice prevalence', comparison: { kind: 'presence' } },
      { metricKey: 'notice.value', label: 'Notice period', comparison: { kind: 'duration' }, semantics: { unit: 'business_days' } },
    ],
  };
  const coverage = { cohortCount: 40, eligibleCount: 40, presentCount: 13, absentCount: 27 };
  const data = {
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'notice.presence': { state: 'ready', coverage, prevalence: { eligibleCount: 40 } },
          'notice.value': {
            state: 'ready',
            coverage,
            distribution: {
              cohorts: [{ semantics: { unit: 'business_days' }, stats: { n: 13, min: 3, p25: 4, median: 4, p75: 5, max: 5 } }],
            },
          },
        },
      },
    },
  };

  const context = mod.buildTypedRowMarketContext(resolution, data);
  assert.equal(context.marketRowKey, resolution.rowKey);
  assert.equal(context.metrics[0].unit, 'business_days');
  assert.equal(context.metrics[0].median, 4);
  assert.equal(
    mod.exactMarketContextForRowKey([{ marketRowKey: 'wrong' }, context], resolution.rowKey),
    context,
  );
});

test('typed money context exposes only the subject deal\'s same-basis percentage cohort', () => {
  const resolution = {
    rowKey: 'material-contracts:aggregate-payments:annual',
    label: 'Aggregate payments',
    metrics: [
      { metricKey: 'material.threshold', label: 'Threshold', comparison: { kind: 'money' } },
    ],
  };
  const data = {
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'material.threshold': {
            state: 'ready',
            coverage: { cohortCount: 40, presentCount: 13 },
            subject: { dealValueBasis: 'equity_value' },
            distribution: {
              raw: { unit: 'usd', stats: { n: 13, median: 10000000 } },
              normalised: {
                cohorts: [
                  { basis: 'enterprise_value', percent: { stats: { n: 8, min: 0.1, median: 0.2, max: 0.3 } } },
                  { basis: 'equity_value', percent: { stats: { n: 5, min: 0.05, p25: 0.08, median: 0.1, p75: 0.12, max: 0.2 } } },
                ],
              },
            },
          },
        },
      },
    },
  };

  const context = mod.buildTypedRowMarketContext(resolution, data);
  assert.equal(context.metrics.length, 1);
  assert.equal(context.metrics[0].unit, 'percent');
  assert.equal(context.metrics[0].median, 0.1);
  assert.match(context.metrics[0].label, /equity value/);
  assert.notEqual(context.metrics[0].median, 10000000);
});

test('typed row context prioritises substantive term detail and excludes prevalence from treatments', () => {
  const resolution = {
    rowKey: 'ioc:ordinary-course',
    label: 'Ordinary-course covenant',
    metrics: [
      { metricKey: 'ioc.presence', label: 'Ordinary-course prevalence', comparison: { kind: 'presence' } },
      { metricKey: 'ioc.standard', label: 'Ordinary-course standard', comparison: { kind: 'categorical' } },
    ],
  };
  const coverage = { cohortCount: 40, eligibleCount: 40, presentCount: 30, absentCount: 10 };
  const data = {
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'ioc.presence': { state: 'ready', coverage, prevalence: { eligibleCount: 40, presentCount: 30 } },
          'ioc.standard': {
            state: 'ready',
            coverage,
            distribution: {
              denominatorCount: 30,
              values: [{ value: 'ORDINARY_COURSE', count: 22, rate: 22 / 30 }],
            },
          },
        },
      },
    },
  };

  const context = mod.buildTypedRowMarketContext(resolution, data);
  assert.equal(context.treatments.length, 1);
  assert.equal(context.treatments[0].attribute, 'ioc.standard');
  assert.equal(context.primarySummary.attribute, 'ioc.standard');
  assert.equal(context.treatments.some((summary) => summary.attribute === 'ioc.presence'), false);
  assert.equal(context.termDealCount, 30);
});

test('typed row context uses the legacy term distribution when the contract only has prevalence', () => {
  const resolution = {
    rowKey: 'rep:capitalisation',
    label: 'Capitalisation',
    metrics: [{ metricKey: 'rep.presence', label: 'Prevalence', comparison: { kind: 'presence' } }],
  };
  const coverage = { eligibleCount: 40, presentCount: 36, absentCount: 4 };
  const data = { byRow: { [resolution.rowKey]: { metrics: { 'rep.presence': { coverage, prevalence: coverage } } } } };
  const fallback = {
    attribute: 'materialityQualifier',
    label: 'Materiality qualifier',
    kind: 'categorical',
    values: [{ value: 'MAT_NO_QUALIFIER', label: 'No materiality qualifier', count: 20 }],
  };

  const context = mod.buildTypedRowMarketContext(resolution, data, fallback);
  assert.equal(context.primarySummary.attribute, 'materialityQualifier');
  assert.equal(context.treatments[0].values[0].label, 'No materiality qualifier');
  assert.equal(context.termDealCount, 36);
});
