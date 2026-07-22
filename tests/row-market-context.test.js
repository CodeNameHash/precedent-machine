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
    dealDirectory: {
      'peer-1': { dealId: 'peer-1', dealName: 'Buyer One / Target One' },
      'peer-2': { dealId: 'peer-2', dealName: 'Buyer Two / Target Two' },
    },
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'notice.presence': { state: 'ready', coverage, prevalence: { eligibleCount: 40 } },
          'notice.value': {
            state: 'ready',
            coverage,
            subject: {
              legalTerms: [
                { key: 'notice', label: 'Notice', value: '4 business days' },
                { key: 'trigger', label: 'Trigger', value: 'Competing proposal' },
              ],
            },
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
  assert.deepEqual(context.currentDealTerms, [
    { key: 'notice', label: 'Notice', value: '4 business days' },
    { key: 'trigger', label: 'Trigger', value: 'Competing proposal' },
  ]);
  assert.equal(
    mod.exactMarketContextForRowKey([{ marketRowKey: 'wrong' }, context], resolution.rowKey),
    context,
  );
  const cell = {};
  const attached = mod.attachTypedRowMarketContext(cell, resolution, data);
  const staleRegistryContext = { ...context, label: 'Stale registry context' };
  assert.equal(
    mod.exactMarketContextForCell(cell, [staleRegistryContext], resolution.rowKey),
    attached,
    'the rendered cell owns the exact current context even when the global registry is stale',
  );
});

test('typed duration context never substitutes a different legal-clock cohort', () => {
  const resolution = {
    rowKey: 'sec-meeting:proxy-filing-deadline',
    label: 'Proxy filing deadline',
    metrics: [{
      metricKey: 'proxy.deadline',
      label: 'Proxy filing deadline',
      comparison: { kind: 'duration' },
      semantics: { unit: 'days_equivalent' },
    }],
  };
  const data = {
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'proxy.deadline': {
            state: 'unique',
            coverage: { eligibleCount: 2, presentCount: 2, comparableCount: 2 },
            subject: {
              value: 10,
              semantics: { unit: 'days_equivalent', calendarBasis: 'mixed', trigger: 'SIGNING' },
            },
            distribution: {
              cohorts: [{
                semantics: { unit: 'days_equivalent', calendarBasis: 'mixed', trigger: 'EFFECTIVENESS' },
                stats: { n: 2, min: 4, median: 5, max: 6 },
              }],
            },
          },
        },
      },
    },
  };

  const context = mod.buildTypedRowMarketContext(resolution, data);
  assert.equal(context.metrics[0].comparisonUnavailable, true);
  assert.equal(context.metrics[0].median, undefined);
  assert.equal(context.metrics[0].subjectValue, 10);
  assert.match(context.metrics[0].comparisonUnavailableReason, /same unit, calendar basis, trigger, and cadence/);
});

test('typed money context exposes only the subject deal\'s same-basis and same-cadence percentage cohort', () => {
  const resolution = {
    rowKey: 'material-contracts:aggregate-payments:annual',
    label: 'Aggregate payments',
    metrics: [
      { metricKey: 'material.threshold', label: 'Threshold', comparison: { kind: 'money' } },
    ],
  };
  const data = {
    dealDirectory: {
      'enterprise-peer': { dealId: 'enterprise-peer', dealName: 'Enterprise Buyer / Target' },
      'equity-annual-peer': { dealId: 'equity-annual-peer', dealName: 'Annual Buyer / Target' },
      'equity-peer': { dealId: 'equity-peer', dealName: 'Equity Buyer / Target' },
    },
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'material.threshold': {
            state: 'ready',
            coverage: { cohortCount: 40, presentCount: 13 },
            subject: {
              dealValueBasis: 'equity_value',
              semantics: { unit: 'usd', cadence: 'specified_year' },
              percentOfDealValue: 0.08,
            },
            distribution: {
              raw: { unit: 'usd', stats: { n: 13, median: 10000000 } },
              normalised: {
                cohorts: [
                  { basis: 'enterprise_value', semantics: { unit: 'usd', cadence: 'specified_year' }, percent: { stats: { n: 8, min: 0.1, median: 0.2, max: 0.3 } }, dealIds: ['enterprise-peer'] },
                  { basis: 'equity_value', semantics: { unit: 'usd', cadence: 'annual' }, percent: { stats: { n: 6, min: 0.1, median: 0.4, max: 0.8 } }, dealIds: ['equity-annual-peer'] },
                  { basis: 'equity_value', semantics: { unit: 'usd', cadence: 'specified_year' }, percent: { stats: { n: 5, min: 0.05, p25: 0.08, median: 0.1, p75: 0.12, max: 0.2 } }, dealIds: ['equity-peer'] },
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
  assert.match(context.metrics[0].label, /specified year/i);
  assert.notEqual(context.metrics[0].median, 10000000);
  assert.equal(context.metrics[0].comparisonCohorts.length, 3);
  assert.deepEqual(context.deals, [data.dealDirectory['equity-peer']]);
});

test('typed money context states when no peer shares both basis and cadence', () => {
  const resolution = {
    rowKey: 'material-contracts:aggregate-payments:specified-year',
    label: 'Aggregate payments',
    metrics: [{
      metricKey: 'material.threshold',
      label: 'Threshold',
      comparison: { kind: 'money' },
      semantics: { stratifyDimensions: ['cadence'] },
    }],
  };
  const data = {
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'material.threshold': {
            state: 'unique',
            coverage: { presentCount: 1 },
            subject: {
              dealValueBasis: 'equity_value',
              semantics: { unit: 'usd', cadence: 'specified_year' },
              percentOfDealValue: 0.08,
            },
            distribution: {
              normalised: {
                cohorts: [{
                  basis: 'equity_value',
                  semantics: { unit: 'usd', cadence: 'annual' },
                  percent: { stats: { n: 1, median: 0.4 } },
                }],
              },
            },
          },
        },
      },
    },
  };

  const context = mod.buildTypedRowMarketContext(resolution, data);
  assert.equal(context.metrics[0].comparisonUnavailable, true);
  assert.equal(context.metrics[0].subjectValue, 0.08);
  assert.match(context.metrics[0].comparisonUnavailableReason, /same deal-value basis and cadence/);
  assert.equal(context.metrics[0].comparisonCohorts[0].selected, false);
});

test('typed rep bring-down context uses reviewer-facing labels for every applicable tier', () => {
  const resolution = {
    rowKey: 'parent-representations-qualifiers:capitalization',
    label: 'Capitalization',
    metrics: [{
      metricKey: 'rep.capitalization.bring-down',
      label: 'Bring-down standard',
      comparison: { kind: 'multi_select' },
      presentation: { role: 'treatment' },
    }],
  };
  const data = {
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'rep.capitalization.bring-down': {
            state: 'ready',
            coverage: { presentCount: 20 },
            subject: {
              values: ['MAT_ALL_RESPECTS_DE_MINIMIS', 'MAT_MATERIALITY_SCRAPE'],
            },
            distribution: {
              kind: 'multi_select',
              denominatorCount: 20,
              values: [
                { value: 'MAT_ALL_RESPECTS_DE_MINIMIS', count: 8 },
                { value: 'MAT_MATERIALITY_SCRAPE', count: 12 },
              ],
            },
          },
        },
      },
    },
  };

  const context = mod.buildTypedRowMarketContext(resolution, data);
  assert.deepEqual(context.treatments[0].values.map((entry) => entry.label), [
    'True except for de minimis inaccuracies',
    'Materiality qualifiers disregarded',
  ]);
  assert.equal(
    context.treatments[0].subjectLabel,
    'True except for de minimis inaccuracies, Materiality qualifiers disregarded',
  );
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
    dealDirectory: {
      'peer-1': { dealId: 'peer-1', dealName: 'Buyer One / Target One' },
      'peer-2': { dealId: 'peer-2', dealName: 'Buyer Two / Target Two' },
    },
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'ioc.presence': { state: 'ready', coverage, prevalence: { eligibleCount: 40, presentCount: 30 } },
          'ioc.standard': {
            state: 'ready',
            coverage,
            dealIdsByStatus: { present: ['peer-1', 'peer-2'] },
            distribution: {
              denominatorCount: 30,
              values: [{ value: 'ORDINARY_COURSE', count: 22, rate: 22 / 30, dealIds: ['peer-1'] }],
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
  assert.deepEqual(context.treatments[0].values[0].deals, [data.dealDirectory['peer-1']]);
  assert.deepEqual(context.deals, [data.dealDirectory['peer-1']]);
});

test('typed row context attaches exact supporting cards and upgrades deal-only prevalence links', () => {
  const resolution = {
    rowKey: 'term:exact-support',
    label: 'Exact support',
    metrics: [
      { metricKey: 'term.presence', label: 'Prevalence', comparison: { kind: 'presence' } },
      { metricKey: 'term.treatment', label: 'Treatment', comparison: { kind: 'categorical' } },
    ],
  };
  const coverage = { eligibleCount: 2, presentCount: 1, absentCount: 1 };
  const dealDirectory = {
    peer: { dealId: 'peer', dealName: 'Buyer / Target' },
    absent: { dealId: 'absent', dealName: 'Other Buyer / Other Target' },
  };
  const data = {
    dealDirectory,
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'term.presence': {
            state: 'unique',
            coverage,
            prevalence: coverage,
            dealIdsByStatus: { present: ['peer'], absent: ['absent'], unknown: [], not_applicable: [] },
            dealRefsByStatus: {
              present: [{ dealId: 'peer' }],
              absent: [{ dealId: 'absent' }],
              unknown: [],
              not_applicable: [],
            },
          },
          'term.treatment': {
            state: 'unique',
            coverage,
            distribution: {
              denominatorCount: 1,
              values: [{
                value: 'EXACT',
                count: 1,
                dealIds: ['peer'],
                dealRefs: [{ dealId: 'peer', cardId: 'card-exact' }],
              }],
            },
          },
        },
      },
    },
  };

  const context = mod.buildTypedRowMarketContext(resolution, data);
  assert.deepEqual(context.treatments[0].values[0].deals, [
    { ...dealDirectory.peer, cardId: 'card-exact' },
  ]);
  assert.deepEqual(context.deals.find((deal) => deal.dealId === 'peer'), {
    ...dealDirectory.peer,
    cardId: 'card-exact',
  });
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

test('typed row context retains a legacy term distribution when the typed batch fails', () => {
  const resolution = {
    rowKey: 'rep:capitalisation',
    label: 'Capitalisation',
    metrics: [{ metricKey: 'rep.presence', label: 'Prevalence', comparison: { kind: 'presence' } }],
  };
  const fallback = {
    attribute: 'knowledgeQualifier',
    label: 'Knowledge qualifier',
    kind: 'categorical',
    values: [{ value: 'NONE', label: 'No knowledge qualifier', count: 31, denominator: 40 }],
  };

  const context = mod.buildTypedRowMarketContext(resolution, { error: 'Timed out', byRow: {} }, fallback);
  assert.equal(context.primarySummary.attribute, 'knowledgeQualifier');
  assert.equal(context.treatments[0].values[0].label, 'No knowledge qualifier');
});

test('typed presence subterms remain substantive while prevalence stays metadata during progressive loading', () => {
  const resolution = {
    rowKey: 'equity-awards:stock-options',
    label: 'Stock Options',
    metrics: [
      { metricKey: 'equity.options.presence', label: 'Stock Options prevalence', comparison: { kind: 'presence' }, presentation: { role: 'prevalence' } },
      { metricKey: 'equity.options.cvr', label: 'CVR entitlement', comparison: { kind: 'presence' }, presentation: { role: 'treatment' } },
    ],
  };
  const data = {
    loading: true,
    dealDirectory: {
      'peer-cvr': { dealId: 'peer-cvr', dealName: 'Buyer / CVR Target' },
      'peer-no-cvr': { dealId: 'peer-no-cvr', dealName: 'Buyer / Cash Target' },
    },
    byRow: {
      [resolution.rowKey]: {
        metrics: {
          'equity.options.presence': {
            state: 'ready',
            coverage: { eligibleCount: 40, presentCount: 22, absentCount: 18 },
            prevalence: { eligibleCount: 40, presentCount: 22 },
          },
          'equity.options.cvr': {
            state: 'ready',
            coverage: { eligibleCount: 22, presentCount: 8, absentCount: 14 },
            prevalence: { eligibleCount: 22, presentCount: 8 },
            subject: { status: 'present', present: true },
            dealIdsByStatus: { present: ['peer-cvr'], absent: ['peer-no-cvr'] },
          },
        },
      },
    },
  };

  const context = mod.buildTypedRowMarketContext(resolution, data);
  assert.equal(context.treatments.length, 1);
  assert.equal(context.treatments[0].attribute, 'equity.options.cvr');
  assert.equal(context.termDealCount, 22);
  assert.equal(context.primarySummary.attribute, 'equity.options.cvr');
  assert.deepEqual(context.treatments[0].subjectValues, ['present']);
  assert.equal(context.treatments[0].values[0].deals[0].dealId, 'peer-cvr');
  assert.equal(context.treatments[0].values[1].deals[0].dealId, 'peer-no-cvr');
});
