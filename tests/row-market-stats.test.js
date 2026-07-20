const test = require('node:test');
const assert = require('node:assert/strict');

const { aggregateMetric } = require('../lib/row-market-stats/aggregate');
const { cardMatchesFamily } = require('../lib/row-market-stats/families');
const { indexDataset } = require('../lib/row-market-stats/observations');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const {
  collectSourceRequirements,
  loadMarketDataset,
  loadPagedRows,
  runTaskPool,
} = require('../lib/row-market-stats/source');

function deal(id, valueUsd = 1e9, basis = 'equity_value') {
  return {
    id,
    acquirer: `Buyer ${id}`,
    target: `Target ${id}`,
    sector: 'Tech',
    announce_date: '2026-01-01',
    value_usd: valueUsd,
    metadata: basis ? { deal_value_basis: basis } : {},
  };
}

function spec(kind, overrides = {}) {
  return {
    contractVersion: 1,
    rowKey: overrides.rowKey || 'row-1',
    metricKey: overrides.metricKey || `row-1.${kind}`,
    label: overrides.label || 'Metric',
    comparison: { status: 'comparable', kind },
    cohort: overrides.cohort || { scope: 'all_deals', eligibility: 'all_deals' },
    observation: overrides.observation || {
      presence: { strategy: 'feature_non_empty', featureKeys: ['feature'], missingState: 'absent' },
      ...(kind === 'presence' ? {} : { value: { strategy: 'feature_value', featureKeys: ['feature'] } }),
    },
    denominator: overrides.denominator || { prevalence: 'eligible_deals', distribution: 'present_deals' },
    ...(overrides.semantics ? { semantics: overrides.semantics } : {}),
  };
}

function entry(dealRow, status, values = []) {
  return { deal: dealRow, dealId: dealRow.id, status, values };
}

test('market source pagination reads past the database default row cap', async () => {
  const source = Array.from({ length: 2305 }, (_, index) => ({ id: index }));
  const calls = [];
  const rows = await loadPagedRows(async (from, to) => {
    calls.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  }, 'test_rows', ['all']);
  assert.equal(rows.length, source.length);
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('market source task pool bounds DB reads and preserves result order', async () => {
  let active = 0;
  let maxActive = 0;
  const tasks = Array.from({ length: 7 }, (_, index) => async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return index;
    } finally {
      active -= 1;
    }
  });

  const results = await runTaskPool(tasks, 99);
  assert.equal(maxActive, 2);
  assert.deepEqual(results, [0, 1, 2, 3, 4, 5, 6]);
});

test('market source task pool stops scheduling queued DB reads after a failure', async () => {
  const started = [];
  const failure = new Error('source failed');
  const tasks = Array.from({ length: 6 }, (_, index) => async () => {
    started.push(index);
    if (index === 0) throw failure;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return index;
  });

  await assert.rejects(runTaskPool(tasks, 2), (error) => error === failure);
  assert.deepEqual(started, [0, 1]);
});

test('market source selects the provision card id needed for exact review deep links', async () => {
  const selects = [];
  const rows = {
    deals: [deal('d1')],
    provision_cards: [{
      id: 'card-1',
      deal_id: 'd1',
      excerpt_id: 'excerpt-1',
      provision_type: 'COVENANT',
      provision_subtype: 'COV-EXACT',
    }],
    claims: [],
  };
  const supabase = {
    from(table) {
      const query = {
        select(columns) {
          selects.push({ table, columns });
          return query;
        },
        in() { return query; },
        order() { return query; },
        range() { return Promise.resolve({ data: rows[table] || [], error: null }); },
      };
      return query;
    },
  };
  const metric = spec('presence', {
    cohort: { scope: 'provision_codes', eligibility: 'code_present', provisionCodes: ['COV-EXACT'] },
    observation: {
      presence: { strategy: 'card_exists', provisionCodes: ['COV-EXACT'], missingState: 'absent' },
    },
  });
  const dataset = await loadMarketDataset(supabase, [metric]);
  assert.equal(dataset.cards[0].id, 'card-1');
  assert.ok(selects.some(({ table, columns }) => table === 'provision_cards' && columns.startsWith('id, deal_id')));
});

test('market source backfills exact cards for claim metrics with an all-deals cohort', async () => {
  const calls = [];
  const poolCalls = [];
  const rows = {
    deals: [deal('d1')],
    provision_cards: [{ id: 'card-claim', deal_id: 'd1', excerpt_id: 'excerpt-claim' }],
    claims: [{ id: 'claim-1', deal_id: 'd1', excerpt_id: 'excerpt-claim', attribute: 'feature', canonical: 'YES' }],
  };
  const supabase = {
    from(table) {
      const query = {
        select() { return query; },
        in(column, values) {
          calls.push({ table, column, values });
          return query;
        },
        order() { return query; },
        range() { return Promise.resolve({ data: rows[table] || [], error: null }); },
      };
      return query;
    },
  };

  const dataset = await loadMarketDataset(supabase, [spec('categorical')], {
    taskPool: async (tasks, concurrency) => {
      poolCalls.push({ taskCount: tasks.length, concurrency });
      return runTaskPool(tasks, concurrency);
    },
  });
  assert.equal(dataset.cards[0].id, 'card-claim');
  assert.deepEqual(poolCalls, [
    { taskCount: 2, concurrency: 2 },
    { taskCount: 1, concurrency: 2 },
  ]);
  assert.ok(calls.some(({ table, column, values }) => (
    table === 'provision_cards'
      && column === 'excerpt_id'
      && values.includes('excerpt-claim')
  )));
});

test('presence coverage uses distinct peer deals and returns the subject separately', () => {
  const subject = deal('subject');
  const metric = spec('presence');
  const result = aggregateMetric(metric, [
    entry(subject, 'present'),
    entry(deal('present'), 'present'),
    entry(deal('absent'), 'absent'),
    entry(deal('unknown'), 'unknown'),
    entry(deal('na'), 'not_applicable'),
  ], subject.id);

  assert.deepEqual(result.coverage, {
    cohortCount: 4,
    eligibleCount: 3,
    presentCount: 1,
    absentCount: 1,
    unknownCount: 1,
    notApplicableCount: 1,
    classifiedCount: 2,
    observedCount: 1,
    valueUnknownCount: 0,
    comparableCount: 1,
    excludedCount: 0,
  });
  assert.equal(result.prevalence.rate, 1 / 3);
  assert.deepEqual(result.dealIdsByStatus, {
    present: ['present'], absent: ['absent'], unknown: ['unknown'], not_applicable: ['na'],
  });
  assert.deepEqual(result.subject, {
    dealId: 'subject', status: 'present', present: true, valueState: 'comparable',
  });
});

test('categorical and multi-select distributions deduplicate within each deal', () => {
  const categorical = aggregateMetric(spec('categorical'), [
    entry(deal('d1'), 'present', [{ value: 'YES' }, { value: 'YES' }]),
    entry(deal('d2'), 'present', [{ value: 'YES' }]),
    entry(deal('d3'), 'present', [{ value: 'NO' }]),
  ]);
  assert.deepEqual(categorical.distribution.values, [
    { value: 'YES', count: 2, dealIds: ['d1', 'd2'], rate: 2 / 3 },
    { value: 'NO', count: 1, dealIds: ['d3'], rate: 1 / 3 },
  ]);
  assert.equal(categorical.coverage.comparableCount, 3);

  const multi = aggregateMetric(spec('multi_select'), [
    entry(deal('d1'), 'present', [{ value: 'A' }, { value: 'A' }, { value: 'B' }]),
    entry(deal('d2'), 'present', [{ value: 'B' }, { value: 'C' }]),
    entry(deal('d3'), 'present', []),
  ]);
  assert.equal(multi.distribution.multiSelect, true);
  assert.deepEqual(multi.distribution.values, [
    { value: 'B', count: 2, dealIds: ['d1', 'd2'], rate: 2 / 3 },
    { value: 'A', count: 1, dealIds: ['d1'], rate: 1 / 3 },
    { value: 'C', count: 1, dealIds: ['d2'], rate: 1 / 3 },
  ]);
  assert.equal(multi.coverage.valueUnknownCount, 1);
});

test('declared multiplier metrics extract a single ratio from descriptive claim text', () => {
  const metric = spec('numeric', {
    rowKey: 'exchange-ratio',
    metricKey: 'exchange-ratio.value',
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['exchangeRatio'], missingState: 'unknown' },
      value: { strategy: 'feature_value', featureKeys: ['exchangeRatio'] },
    },
    semantics: { unit: 'multiplier' },
  });
  const subject = deal('subject');
  const peer = deal('peer');
  const citationOnly = deal('citation-only');
  const result = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: subject.id,
    filters: {},
    specs: [metric],
  }, {
    deals: [subject, peer, citationOnly],
    cards: [],
    claims: [
      {
        id: 'subject-ratio',
        deal_id: subject.id,
        excerpt_id: 'subject-excerpt',
        attribute: 'exchangeRatio',
        canonical: '20.200 Parent Shares per Company Share',
      },
      {
        id: 'peer-ratio',
        deal_id: peer.id,
        excerpt_id: 'peer-excerpt',
        attribute: 'exchangeRatio',
        canonical: '0.6275 shares of Parent Common Stock per Company Share',
      },
      {
        id: 'citation-only-ratio',
        deal_id: citationOnly.id,
        excerpt_id: 'citation-only-excerpt',
        attribute: 'exchangeRatio',
        canonical: 'The exchange ratio is subject to adjustment under Section 2.5.',
      },
    ],
  }).byRow['exchange-ratio'].metrics['exchange-ratio.value'];

  assert.equal(result.subject.valueState, 'comparable');
  assert.equal(result.subject.value, 20.2);
  assert.equal(result.subject.semantics.unit, 'multiplier');
  assert.equal(result.distribution.cohorts[0].stats.median, 0.6275);
  assert.equal(result.coverage.valueUnknownCount, 1);
});

test('market distributions retain exact value-specific card attribution without changing deal counts', () => {
  const categorical = aggregateMetric(spec('categorical'), [
    entry(deal('d1'), 'present', [
      { value: 'YES' },
      { value: 'YES', cardId: 'card-d1-yes' },
    ]),
    entry(deal('d2'), 'present', [{ value: 'YES', cardId: 'card-d2-yes' }]),
  ]);
  assert.equal(categorical.distribution.values[0].count, 2);
  assert.deepEqual(categorical.distribution.values[0].dealIds, ['d1', 'd2']);
  assert.deepEqual(categorical.distribution.values[0].dealRefs, [
    { dealId: 'd1', cardId: 'card-d1-yes' },
    { dealId: 'd2', cardId: 'card-d2-yes' },
  ]);

  const multi = aggregateMetric(spec('multi_select'), [
    entry(deal('d1'), 'present', [
      { value: 'A', cardId: 'card-d1-a' },
      { value: 'B', cardId: 'card-d1-b' },
      { value: 'B', cardId: 'card-d1-b-duplicate' },
    ]),
    entry(deal('d2'), 'present', [{ value: 'B', cardId: 'card-d2-b' }]),
  ]);
  const valueA = multi.distribution.values.find((item) => item.value === 'A');
  const valueB = multi.distribution.values.find((item) => item.value === 'B');
  assert.deepEqual(valueA.dealRefs, [{ dealId: 'd1', cardId: 'card-d1-a' }]);
  assert.equal(valueB.count, 2);
  assert.deepEqual(valueB.dealRefs, [
    { dealId: 'd1', cardId: 'card-d1-b' },
    { dealId: 'd2', cardId: 'card-d2-b' },
  ]);

  const duration = aggregateMetric(spec('duration', {
    semantics: { unit: 'business_days' },
  }), [
    entry(deal('d1'), 'present', [{ value: 4, unit: 'business_days', cardId: 'card-d1-days' }]),
  ]);
  assert.deepEqual(duration.distribution.cohorts[0].dealRefs, [
    { dealId: 'd1', cardId: 'card-d1-days' },
  ]);

  const money = aggregateMetric(spec('money', {
    semantics: {
      unit: 'usd',
      normalisation: { type: 'percent_of_deal_value', stratifyBy: 'deal_value_basis' },
    },
  }), [
    entry(deal('d1'), 'present', [{ value: 10e6, unit: 'usd', cardId: 'card-d1-money' }]),
  ]);
  assert.deepEqual(money.distribution.normalised.cohorts[0].dealRefs, [
    { dealId: 'd1', cardId: 'card-d1-money' },
  ]);

  const presenceEntries = [
    { ...entry(deal('d1'), 'present'), cardId: 'card-d1-presence' },
    entry(deal('d2'), 'absent'),
  ];
  const presence = aggregateMetric(spec('presence'), presenceEntries);
  assert.deepEqual(presence.dealRefsByStatus, {
    present: [{ dealId: 'd1', cardId: 'card-d1-presence' }],
    absent: [{ dealId: 'd2' }],
    unknown: [],
    not_applicable: [],
  });
});

test('market service joins claim excerpts to exact provision cards for supporting links', () => {
  const metric = spec('categorical');
  const result = calculateMarketStats({ contractVersion: 1, filters: {}, specs: [metric] }, {
    deals: [deal('d1'), deal('d2')],
    cards: [
      { id: 'card-d1', deal_id: 'd1', excerpt_id: 'excerpt-d1' },
      { id: 'card-d2', deal_id: 'd2', excerpt_id: 'excerpt-d2' },
    ],
    claims: [
      { id: 'claim-d1', deal_id: 'd1', excerpt_id: 'excerpt-d1', attribute: 'feature', canonical: 'YES' },
      { id: 'claim-d2', deal_id: 'd2', excerpt_id: 'excerpt-d2', attribute: 'feature', canonical: 'NO' },
    ],
  });
  const values = result.byRow['row-1'].metrics['row-1.categorical'].distribution.values;
  assert.deepEqual(values.find((item) => item.value === 'YES').dealRefs, [{ dealId: 'd1', cardId: 'card-d1' }]);
  assert.deepEqual(values.find((item) => item.value === 'NO').dealRefs, [{ dealId: 'd2', cardId: 'card-d2' }]);
});

test('employee-benefit list-item metrics match nested benefit types and alias paths', () => {
  const metric = spec('categorical', {
    metricKey: 'employee.base-salary.standard',
    observation: {
      presence: { strategy: 'list_item', featureKeys: ['compensationItems'], itemCode: 'BASE_SALARY', missingState: 'absent' },
      value: {
        strategy: 'list_item_field',
        featureKeys: ['compensationItems'],
        itemCode: 'BASE_SALARY',
        path: 'standard_code',
        paths: ['standard_code', 'standardCode', 'standard_codes', 'standardCodes'],
      },
    },
  });
  const dataset = {
    deals: [deal('benefits')],
    cards: [],
    claims: [{
      id: 'benefits-claim',
      deal_id: 'benefits',
      attribute: 'compensationItems',
      canonical: null,
      verbatim: null,
      provenance: {
        feature_value: [{
          benefit_types: [{ code: 'BASE_SALARY' }],
          standardCodes: ['NO_LESS_FAVORABLE'],
        }],
      },
    }],
  };
  const result = calculateMarketStats({ contractVersion: 1, filters: {}, specs: [metric] }, dataset)
    .byRow['row-1'].metrics['employee.base-salary.standard'];
  assert.equal(result.coverage.presentCount, 1);
  assert.deepEqual(
    result.distribution.values.map(({ value, count, rate }) => ({ value, count, rate })),
    [{ value: 'NO_LESS_FAVORABLE', count: 1, rate: 1 }],
  );
});

test('semantic market normalizers produce comparable benefit, Abry and covenant treatments', () => {
  const metrics = [
    spec('duration', {
      rowKey: 'benefit-period',
      metricKey: 'benefit-period.value',
      observation: {
        presence: { strategy: 'feature_non_empty', featureKeys: ['protectionPeriodMonths'], missingState: 'unknown' },
        value: { strategy: 'feature_value', featureKeys: ['protectionPeriodMonths'], normalizer: 'employee_benefit_period' },
      },
      semantics: { unit: 'months', calendarBasis: 'elapsed', trigger: 'closing', requiredDimensions: ['unit'] },
    }),
    spec('numeric', {
      rowKey: 'insurance-cap',
      metricKey: 'insurance-cap.value',
      observation: {
        presence: { strategy: 'feature_non_empty', featureKeys: ['insuranceCap'], missingState: 'unknown' },
        value: { strategy: 'feature_value', featureKeys: ['insuranceCap'], normalizer: 'insurance_cap_multiplier' },
      },
      semantics: { unit: 'multiplier' },
    }),
    spec('multi_select', {
      rowKey: 'acquisition-types',
      metricKey: 'acquisition-types.value',
      observation: {
        presence: { strategy: 'feature_non_empty', featureKeys: ['acquisitionTransactionDefinition'], missingState: 'unknown' },
        value: { strategy: 'feature_value', featureKeys: ['acquisitionTransactionDefinition'], normalizer: 'acquisition_transaction_types' },
      },
    }),
    spec('categorical', {
      rowKey: 'transactions-exclusion',
      metricKey: 'transactions-exclusion.value',
      observation: {
        presence: { strategy: 'feature_non_empty', featureKeys: ['acquisitionTransactionDefinition'], missingState: 'unknown' },
        value: { strategy: 'feature_value', featureKeys: ['acquisitionTransactionDefinition'], normalizer: 'transactions_exclusion' },
      },
    }),
    spec('categorical', {
      rowKey: 'approval-mechanism',
      metricKey: 'approval-mechanism.value',
      observation: {
        presence: { strategy: 'feature_non_empty', featureKeys: ['mainConcept'], missingState: 'unknown' },
        value: { strategy: 'feature_value', featureKeys: ['mainConcept'], normalizer: 'parent_approval_mechanism' },
      },
    }),
  ];
  const claims = [
    ['benefit', 'protectionPeriodMonths', 12],
    ['insurance', 'insuranceCap', 'Premium cap of 300% of the current annual premium.'],
    ['acquisition', 'acquisitionTransactionDefinition', 'Any asset acquisition, voting-power acquisition, merger or tender offer, other than the Transactions.'],
    ['approval', 'mainConcept', 'Parent, as sole stockholder of Merger Sub, shall approve and adopt the agreement by written consent.'],
    ['approval-all', 'mainConcept', 'Parent shall cause a written consent to be executed by all of the record holders of the stock of Merger Sub.'],
  ].map(([dealId, attribute, value]) => ({
    id: `${dealId}-${attribute}`,
    deal_id: dealId,
    attribute,
    canonical: typeof value === 'number' ? String(value) : value,
    verbatim: typeof value === 'number' ? String(value) : value,
    provenance: { feature_value: value },
  }));
  const result = calculateMarketStats({ contractVersion: 1, filters: {}, specs: metrics }, {
    deals: ['benefit', 'insurance', 'acquisition', 'approval', 'approval-all'].map((id) => deal(id)),
    cards: [],
    claims,
  });
  assert.equal(result.byRow['benefit-period'].metrics['benefit-period.value'].distribution.cohorts[0].stats.median, 12);
  assert.equal(result.byRow['insurance-cap'].metrics['insurance-cap.value'].distribution.cohorts[0].stats.median, 3);
  assert.deepEqual(
    result.byRow['acquisition-types'].metrics['acquisition-types.value'].distribution.values.map((entry) => entry.value),
    ['ASSET_OR_BUSINESS_TRANSACTION', 'EQUITY_OR_VOTING_POWER_ACQUISITION', 'MERGER_OR_BUSINESS_COMBINATION', 'TENDER_OR_EXCHANGE_OFFER'],
  );
  assert.equal(
    result.byRow['transactions-exclusion'].metrics['transactions-exclusion.value'].distribution.values[0].value,
    'TRANSACTIONS_EXPRESSLY_EXCLUDED',
  );
  assert.deepEqual(
    result.byRow['approval-mechanism'].metrics['approval-mechanism.value'].distribution.values.map((entry) => entry.value).sort(),
    ['ALL_RECORD_HOLDERS_WRITTEN_CONSENT', 'SOLE_HOLDER_WRITTEN_CONSENT'],
  );
});

test('feature_matches measures the directional Abry question instead of mere card existence', () => {
  const metric = spec('presence', {
    metricKey: 'abry.buyer-non-reliance',
    observation: {
      presence: {
        strategy: 'feature_matches',
        featureKeys: ['noOtherRepsParty'],
        values: ['COMPANY', 'BOTH'],
        missingState: 'absent',
      },
    },
  });
  const claims = [
    ['company', 'COMPANY'],
    ['parent', 'PARENT'],
    ['both', 'BOTH'],
  ].map(([dealId, value]) => ({
    id: `${dealId}-party`, deal_id: dealId, attribute: 'noOtherRepsParty', canonical: value, verbatim: value,
    provenance: { feature_value: { code: value, label: value } },
  }));
  const result = calculateMarketStats({ contractVersion: 1, filters: {}, specs: [metric] }, {
    deals: ['company', 'parent', 'both'].map((id) => deal(id)), cards: [], claims,
  }).byRow['row-1'].metrics['abry.buyer-non-reliance'];
  assert.equal(result.coverage.presentCount, 2);
  assert.equal(result.coverage.absentCount, 1);
});

test('duration values with incompatible clocks are excluded instead of pooled', () => {
  const duration = spec('duration', {
    semantics: { unit: 'business_days', calendarBasis: 'business', trigger: 'matching_period' },
  });
  const result = aggregateMetric(duration, [
    entry(deal('d1'), 'present', [{ value: 4, unit: 'business_days', calendarBasis: 'business', trigger: 'matching_period' }]),
    entry(deal('d2'), 'present', [{ value: 96, unit: 'hours', calendarBasis: 'elapsed', trigger: 'inbound_notice' }]),
    entry(deal('d3'), 'present', []),
  ]);

  assert.equal(result.coverage.presentCount, 3);
  assert.equal(result.coverage.comparableCount, 1);
  assert.equal(result.coverage.excludedCount, 1);
  assert.equal(result.coverage.valueUnknownCount, 1);
  assert.deepEqual(result.distribution.cohorts[0].stats, {
    n: 1, min: 4, p25: 4, median: 4, p75: 4, max: 4, mean: 4,
  });
  assert.deepEqual(result.exclusions, [{ reason: 'incompatible_unit', count: 1 }]);
});

test('bare duration numbers require evidence and never inherit the requested or cached clock', () => {
  const duration = spec('duration', {
    metricKey: 'notice.match-period',
    semantics: {
      unit: 'business_days',
      calendarBasis: 'business',
      trigger: 'matching_period',
      requiredDimensions: ['unit', 'calendarBasis'],
    },
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['noticePeriod'], missingState: 'unknown' },
      value: { strategy: 'feature_value', featureKeys: ['noticePeriod'] },
    },
  });
  const dataset = {
    deals: [deal('business'), deal('hours'), deal('legacy-cache')],
    cards: [],
    claims: [
      {
        id: 'business-claim', deal_id: 'business', attribute: 'noticePeriod', canonical: '4', verbatim: '4',
        canonical_numeric: { value: 4, unit: 'business_days' }, evidence_quote: 'four (4) Business Days', provenance: {},
      },
      {
        id: 'hours-claim', deal_id: 'hours', attribute: 'noticePeriod', canonical: '24', verbatim: '24',
        evidence_quote: 'at least 24 hours before discussions begin', provenance: {},
      },
      {
        id: 'legacy-cache-claim', deal_id: 'legacy-cache', attribute: 'noticePeriod', canonical: '4', verbatim: '4',
        canonical_numeric: { value: 4, unit: 'business_days' }, provenance: {},
      },
    ],
  };
  const result = calculateMarketStats({
    contractVersion: 1, subjectDealId: null, filters: {}, specs: [duration],
  }, dataset).byRow['row-1'].metrics['notice.match-period'];

  assert.equal(result.coverage.comparableCount, 1);
  assert.equal(result.coverage.excludedCount, 1);
  assert.equal(result.coverage.valueUnknownCount, 1);
  assert.equal(result.distribution.cohorts[0].semantics.unit, 'business_days');
  assert.equal(result.distribution.cohorts[0].stats.median, 4);
  assert.deepEqual(result.exclusions, [{ reason: 'incompatible_unit', count: 1 }]);
});

test('elapsed-hour values remain in an elapsed-hour cohort', () => {
  const duration = spec('duration', {
    metricKey: 'notice.elapsed-hours',
    semantics: {
      unit: 'elapsed_hours',
      calendarBasis: 'elapsed',
      trigger: 'discussion_initiated',
      requiredDimensions: ['unit', 'calendarBasis'],
    },
  });
  const result = aggregateMetric(duration, [
    entry(deal('d1'), 'present', [{ value: 96, unit: 'hours', calendarBasis: 'elapsed', trigger: 'discussion_initiated' }]),
  ]);
  assert.equal(result.coverage.comparableCount, 1);
  assert.equal(result.distribution.cohorts[0].semantics.unit, 'elapsed_hours');
  assert.equal(result.distribution.cohorts[0].stats.median, 96);
});

test('day-equivalent duration policy converts 24 hours to one day before aggregation', () => {
  const duration = spec('duration', {
    semantics: {
      unit: 'days_equivalent',
      calendarBasis: 'mixed',
      trigger: 'notice_period',
      requiredDimensions: ['unit', 'calendarBasis'],
      normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
    },
  });
  const result = aggregateMetric(duration, [
    entry(deal('hours'), 'present', [{ value: 24, unit: 'elapsed_hours', calendarBasis: 'elapsed', trigger: 'notice_period' }]),
    entry(deal('business-day'), 'present', [{ value: 1, unit: 'business_days', calendarBasis: 'business', trigger: 'notice_period' }]),
    entry(deal('calendar-days'), 'present', [{ value: 2, unit: 'calendar_days', calendarBasis: 'calendar', trigger: 'notice_period' }]),
  ]);

  assert.equal(result.coverage.comparableCount, 3);
  assert.deepEqual(result.distribution.cohorts[0].semantics, {
    unit: 'days_equivalent',
    calendarBasis: 'mixed',
    trigger: 'notice_period',
    cadence: null,
  });
  assert.deepEqual(result.distribution.cohorts[0].stats, {
    n: 3, min: 1, p25: 1, median: 1, p75: 1.5, max: 2, mean: 4 / 3,
  });
});

test('SEC deadlines normalise hours to days but retain separate observed legal-trigger cohorts', () => {
  const deadline = spec('duration', {
    metricKey: 'sec.proxy.deadline',
    semantics: {
      unit: 'days_equivalent',
      calendarBasis: 'mixed',
      requiredDimensions: ['unit', 'calendarBasis', 'trigger'],
      normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
    },
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['proxyFilingDeadline'], missingState: 'unknown' },
      value: {
        strategy: 'feature_value',
        featureKeys: ['proxyFilingDeadline'],
        normalizer: 'deadline_duration',
      },
    },
  });
  const deadlineClaim = (dealId, value) => ({
    id: `${dealId}-deadline`,
    deal_id: dealId,
    attribute: 'proxyFilingDeadline',
    canonical: null,
    verbatim: null,
    provenance: { feature_value: value },
  });
  const dataset = {
    deals: [deal('subject'), deal('effective-days'), deal('effective-hours'), deal('agreement-date')],
    cards: [],
    claims: [
      deadlineClaim('subject', { days: 5, unit: 'BUSINESS_DAYS', trigger: 'Form S-4 effectiveness' }),
      deadlineClaim('effective-days', { days: 4, unit: 'CALENDAR_DAYS', trigger: 'EFFECTIVENESS' }),
      deadlineClaim('effective-hours', { hours: 24, trigger: 'date the Form S-4 is declared effective' }),
      deadlineClaim('agreement-date', { days: 30, unit: 'BUSINESS_DAYS', trigger: 'DATE_OF_THIS_AGREEMENT' }),
    ],
  };

  const result = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: 'subject',
    filters: {},
    specs: [deadline],
  }, dataset).byRow['row-1'].metrics['sec.proxy.deadline'];

  assert.equal(result.subject.value, 5);
  assert.equal(result.subject.semantics.trigger, 'EFFECTIVENESS');
  assert.deepEqual(result.distribution.cohorts.map((cohort) => cohort.semantics.trigger), [
    'AGREEMENT_DATE',
    'EFFECTIVENESS',
  ]);
  const effective = result.distribution.cohorts.find((cohort) => cohort.semantics.trigger === 'EFFECTIVENESS');
  assert.deepEqual(effective.stats, {
    n: 2, min: 1, p25: 1.75, median: 2.5, p75: 3.25, max: 4, mean: 2.5,
  });
});

test('adjournment metrics select one stable party item instead of leaking the full rights list', () => {
  const item = (party) => ({ itemIdentity: `ADJOURNMENT_PARTY:${party}`, identityKind: 'adjournment_party' });
  const observation = (party, path) => ({
    presence: {
      strategy: 'list_item',
      featureKeys: ['adjournmentRights'],
      ...item(party),
      missingState: 'absent',
    },
    value: {
      strategy: 'list_item_field',
      featureKeys: ['adjournmentRights'],
      ...item(party),
      path,
    },
  });
  const companyParty = spec('categorical', {
    metricKey: 'adjournment.company.party',
    observation: observation('COMPANY', 'party'),
  });
  const companyReasons = spec('multi_select', {
    metricKey: 'adjournment.company.reasons',
    observation: observation('COMPANY', 'reasons'),
  });
  const companyLimit = spec('numeric', {
    metricKey: 'adjournment.company.limit',
    observation: observation('COMPANY', 'maxAdjournments'),
  });
  const parentParty = spec('categorical', {
    metricKey: 'adjournment.parent.party',
    observation: observation('PARENT', 'party'),
  });
  const aggregatePeriod = (party) => spec('duration', {
    metricKey: `adjournment.${party.toLowerCase()}.aggregate-period`,
    observation: {
      presence: observation(party, 'maxDaysTotal').presence,
      value: {
        ...observation(party, 'maxDaysTotal').value,
        normalizer: 'adjournment_duration',
        trigger: 'meeting_adjournment',
      },
    },
    semantics: {
      unit: 'days_equivalent',
      calendarBasis: 'mixed',
      trigger: 'meeting_adjournment',
      requiredDimensions: ['unit', 'calendarBasis'],
      normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
    },
  });
  const companyAggregatePeriod = aggregatePeriod('COMPANY');
  const parentAggregatePeriod = aggregatePeriod('PARENT');
  const rights = [
    {
      party: 'COMPANY',
      reasons: [{ code: 'QUORUM_ABSENT', label: 'Quorum absent' }],
      maxAdjournments: 3,
      maxDaysPerAdjournment: 10,
      text: 'The Company may adjourn up to three times for no more than 10 Business Days each time.',
    },
    {
      party: 'PARENT',
      reasons: [{ code: 'SUPPLEMENTAL_DISCLOSURE', label: 'Supplemental disclosure' }],
      maxAdjournments: 3,
      maxDaysPerAdjournment: 10,
      text: 'Parent may adjourn up to three times for no more than 10 Business Days each time.',
    },
  ];
  const dataset = {
    deals: [deal('qxo'), deal('peer')],
    cards: [],
    claims: ['qxo', 'peer'].map((dealId) => ({
      id: `${dealId}-adjournment`,
      deal_id: dealId,
      attribute: 'adjournmentRights',
      canonical: null,
      verbatim: null,
      provenance: { feature_value: rights },
    })),
  };

  const metrics = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: 'qxo',
    filters: {},
    specs: [companyParty, companyReasons, companyLimit, parentParty, companyAggregatePeriod, parentAggregatePeriod],
  }, dataset).byRow['row-1'].metrics;

  assert.equal(metrics['adjournment.company.party'].subject.value, 'COMPANY');
  assert.equal(metrics['adjournment.company.party'].subject.exclusionReason, undefined);
  assert.deepEqual(metrics['adjournment.company.reasons'].subject.values, ['QUORUM_ABSENT']);
  assert.equal(metrics['adjournment.company.limit'].subject.value, 3);
  assert.equal(metrics['adjournment.parent.party'].subject.value, 'PARENT');
  assert.equal(metrics['adjournment.company.aggregate-period'].subject.value, 30);
  assert.equal(metrics['adjournment.company.aggregate-period'].subject.semantics.unit, 'days_equivalent');
  assert.equal(metrics['adjournment.parent.aggregate-period'].subject.value, 30);
  assert.equal(metrics['adjournment.parent.aggregate-period'].subject.semantics.unit, 'days_equivalent');
});

test('optional extension periods normalise to months while an uncaptured optional term remains absent', () => {
  const extension = spec('duration', {
    metricKey: 'outside.extension-length',
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['extensionMonths', 'extensionPeriod'], missingState: 'absent' },
      value: {
        strategy: 'feature_value',
        featureKeys: ['extensionMonths', 'extensionPeriod'],
        normalizer: 'period_months',
        trigger: 'outside_date',
      },
    },
    semantics: { unit: 'months', calendarBasis: 'elapsed', trigger: 'outside_date', requiredDimensions: ['unit'] },
  });
  const dataset = {
    deals: [deal('with-extension'), deal('without-extension')],
    cards: [],
    claims: [{
      id: 'extension-period',
      deal_id: 'with-extension',
      attribute: 'extensionPeriod',
      canonical: '90 days',
      verbatim: 'a 90-day extension',
      provenance: { feature_value: '90 days' },
    }],
  };
  const withExtension = calculateMarketStats({
    contractVersion: 1, subjectDealId: 'with-extension', filters: {}, specs: [extension],
  }, dataset).byRow['row-1'].metrics[extension.metricKey];
  assert.equal(withExtension.subject.value, 3);
  assert.equal(withExtension.subject.semantics.unit, 'months');

  const withoutExtension = calculateMarketStats({
    contractVersion: 1, subjectDealId: 'without-extension', filters: {}, specs: [extension],
  }, dataset).byRow['row-1'].metrics[extension.metricKey];
  assert.equal(withoutExtension.subject.status, 'absent');
});

test('bare numeric values inherit an explicitly declared percent unit', () => {
  const percentage = spec('numeric', {
    metricKey: 'threshold.percent',
    semantics: { unit: 'percent' },
  });
  const dataset = {
    deals: [deal('d1')],
    cards: [],
    claims: [{
      id: 'percent-claim',
      deal_id: 'd1',
      attribute: 'feature',
      canonical: '50',
      verbatim: '50',
      provenance: { feature_value: 50 },
    }],
  };
  const result = calculateMarketStats({
    contractVersion: 1, subjectDealId: null, filters: {}, specs: [percentage],
  }, dataset).byRow['row-1'].metrics['threshold.percent'];

  assert.equal(result.coverage.comparableCount, 1);
  assert.equal(result.distribution.cohorts[0].semantics.unit, 'percent');
  assert.equal(result.distribution.cohorts[0].stats.median, 50);
});

test('money reports raw USD and stratified percent/bps cohorts with explicit exclusions', () => {
  const money = spec('money', {
    semantics: {
      unit: 'usd',
      normalisation: {
        type: 'percent_of_deal_value',
        denominator: 'deal_value_usd',
        basisPolicy: 'stratify_by_basis',
        missingPolicy: 'exclude',
      },
    },
  });
  const subject = deal('qxo', 17e9, 'headline_transaction_value');
  const missingValue = deal('missing', null, 'equity_value');
  missingValue.value_usd = null;
  const unknownBasis = deal('unknown', 100e6, null);
  const result = aggregateMetric(money, [
    entry(subject, 'present', [{ value: 10e6, unit: 'usd' }]),
    entry(deal('eq1', 100e6, 'equity_value'), 'present', [{ value: 1e6, unit: 'usd' }]),
    entry(deal('eq2', 200e6, 'equity_value'), 'present', [{ value: 4e6, unit: 'usd' }]),
    entry(deal('ev1', 100e6, 'enterprise_value'), 'present', [{ value: 1e6, unit: 'usd' }]),
    entry(unknownBasis, 'present', [{ value: 2e6, unit: 'usd' }]),
    entry(missingValue, 'present', [{ value: 3e6, unit: 'usd' }]),
  ], subject.id);

  assert.equal(result.coverage.comparableCount, 3);
  assert.equal(result.coverage.excludedCount, 2);
  assert.equal(result.distribution.raw.stats.n, 5);
  assert.deepEqual(result.distribution.normalised.cohorts.map((cohort) => cohort.basis), [
    'enterprise_value', 'equity_value',
  ]);
  const equity = result.distribution.normalised.cohorts.find((cohort) => cohort.basis === 'equity_value');
  assert.equal(equity.percent.stats.median, 1.5);
  assert.equal(equity.basisPoints.stats.median, 150);
  assert.deepEqual(result.distribution.normalised.exclusions, [
    { reason: 'missing_deal_value', count: 1 },
    { reason: 'unknown_deal_value_basis', count: 1 },
  ]);
  assert.equal(result.subject.dealValueBasis, 'headline_transaction_value');
  assert.ok(Math.abs(result.subject.percentOfDealValue - 0.058823529411764705) < 1e-12);
  assert.ok(Math.abs(result.subject.basisPointsOfDealValue - 5.88235294117647) < 1e-12);
});

test('QXO material-contract thresholds select the same-basis and same-cadence percentage cohort without dropping other cadences', () => {
  const threshold = spec('money', {
    rowKey: 'material-contracts:customer',
    metricKey: 'material-contracts.bucket.customer.threshold',
    observation: {
      presence: {
        strategy: 'list_item',
        featureKeys: ['materialContractsBuckets'],
        itemCode: 'CUSTOMER',
        missingState: 'unknown',
      },
      value: {
        strategy: 'list_item_field',
        featureKeys: ['materialContractsBuckets'],
        itemCode: 'CUSTOMER',
        path: 'threshold',
      },
    },
    semantics: {
      unit: 'usd',
      cadence: 'specified_year',
      requiredDimensions: ['cadence'],
      stratifyDimensions: ['cadence'],
      normalisation: {
        type: 'percent_of_deal_value',
        denominator: 'deal_value_usd',
        basisPolicy: 'stratify_by_basis',
        missingPolicy: 'exclude',
      },
    },
  });
  const subject = deal('qxo', 17e9, 'headline_transaction_value');
  const peer = deal('peer', 10e9, 'headline_transaction_value');
  const specifiedYearPeer = deal('specified-year-peer', 20e9, 'headline_transaction_value');
  const dataset = {
    deals: [subject, peer, specifiedYearPeer],
    cards: [],
    claims: [
      {
        id: 'qxo-customer', deal_id: subject.id, attribute: 'materialContractsBuckets', canonical: 'CUSTOMER',
        verbatim: 'Customer contracts involving more than $10,000,000 in 2025',
        provenance: { feature_value: { code: 'CUSTOMER', threshold: '$10,000,000', text: 'receipts of more than $10,000,000 in 2025' } },
      },
      {
        id: 'qxo-customer-annual', deal_id: subject.id, attribute: 'materialContractsBuckets', canonical: 'CUSTOMER',
        verbatim: 'Customer contracts above $7,000,000 per annum',
        provenance: { feature_value: { code: 'CUSTOMER', threshold: '$7,000,000', text: 'payments in excess of $7,000,000 per annum' } },
      },
      {
        id: 'peer-customer', deal_id: peer.id, attribute: 'materialContractsBuckets', canonical: 'CUSTOMER',
        verbatim: 'Customer contracts above $5,000,000 per annum',
        provenance: { feature_value: { code: 'CUSTOMER', threshold: '$5,000,000', text: 'payments in excess of $5,000,000 per annum' } },
      },
      {
        id: 'specified-year-customer', deal_id: specifiedYearPeer.id, attribute: 'materialContractsBuckets', canonical: 'CUSTOMER',
        verbatim: 'Customer contracts involving more than $40,000,000 in 2025',
        provenance: { feature_value: { code: 'CUSTOMER', threshold: '$40,000,000', text: 'receipts of more than $40,000,000 in 2025' } },
      },
    ],
  };
  const result = calculateMarketStats({
    contractVersion: 1, subjectDealId: subject.id, filters: {}, specs: [threshold],
  }, dataset).byRow['material-contracts:customer'].metrics[threshold.metricKey];

  assert.equal(result.subject.rawUsd, 10e6);
  assert.ok(Math.abs(result.subject.percentOfDealValue - 0.058823529411764705) < 1e-12);
  assert.equal(result.subject.semantics.cadence, 'specified_year');
  const cohorts = result.distribution.normalised.cohorts;
  assert.deepEqual(cohorts.map((cohort) => cohort.semantics.cadence), ['annual', 'specified_year']);
  assert.ok(cohorts.every((cohort) => cohort.basis === 'headline_transaction_value'));
  assert.equal(cohorts.find((cohort) => cohort.semantics.cadence === 'annual').percent.stats.median, 0.05);
  assert.equal(cohorts.find((cohort) => cohort.semantics.cadence === 'specified_year').percent.stats.median, 0.2);
  assert.deepEqual(result.distribution.normalised.exclusions, []);
});

test('material-contract bucket thresholds recover one isolated dollar amount from the bucket quote', () => {
  const threshold = spec('money', {
    rowKey: 'material-contracts:customer',
    metricKey: 'material-contracts.bucket.customer.threshold',
    observation: {
      presence: { strategy: 'list_item', featureKeys: ['materialContractsBuckets'], itemCode: 'CUSTOMER', missingState: 'unknown' },
      value: { strategy: 'list_item_field', featureKeys: ['materialContractsBuckets'], itemCode: 'CUSTOMER', path: 'threshold' },
    },
    semantics: {
      unit: 'usd', cadence: 'annual', requiredDimensions: ['cadence'],
      normalisation: { type: 'percent_of_deal_value', denominator: 'deal_value_usd', basisPolicy: 'stratify_by_basis', missingPolicy: 'exclude' },
    },
  });
  const subject = deal('qxo', 10e9, 'headline_transaction_value');
  const peer = deal('peer', 5e9, 'headline_transaction_value');
  const dataset = {
    deals: [subject, peer], cards: [], claims: [
      {
        id: 'qxo-customer', deal_id: subject.id, attribute: 'materialContractsBuckets', canonical: 'CUSTOMER',
        provenance: { feature_value: { code: 'CUSTOMER', quotes: ['payments in excess of $10,000,000 per annum'] } },
      },
      {
        id: 'peer-customer', deal_id: peer.id, attribute: 'materialContractsBuckets', canonical: 'CUSTOMER',
        provenance: { feature_value: { code: 'CUSTOMER', quotes: ['payments in excess of $5 million per annum'] } },
      },
    ],
  };
  const result = calculateMarketStats({ contractVersion: 1, subjectDealId: subject.id, filters: {}, specs: [threshold] }, dataset)
    .byRow['material-contracts:customer'].metrics[threshold.metricKey];

  assert.equal(result.subject.rawUsd, 10e6);
  assert.equal(result.distribution.normalised.cohorts[0].percent.stats.median, 0.1);
});

test('material-contract threshold structure distinguishes aggregate, annual and type-based buckets', () => {
  const thresholdType = spec('categorical', {
    metricKey: 'material-contracts.bucket.indebtedness.threshold-structure',
    observation: {
      presence: {
        strategy: 'list_item',
        featureKeys: ['materialContractsBuckets'],
        itemCode: 'INDEBTEDNESS',
        missingState: 'absent',
      },
      value: {
        strategy: 'list_item_field',
        featureKeys: ['materialContractsBuckets'],
        itemCode: 'INDEBTEDNESS',
        path: 'threshold',
        normalizer: 'material_contract_threshold_type',
      },
    },
  });
  const deals = [deal('aggregate'), deal('annual'), deal('type-based')];
  const claims = [
    ['aggregate', { code: 'INDEBTEDNESS', threshold: '$10,000,000', text: 'indebtedness in excess of $10,000,000' }],
    ['annual', { code: 'INDEBTEDNESS', threshold: '$5,000,000 per annum', text: 'annual payments over $5,000,000' }],
    ['type-based', { code: 'INDEBTEDNESS', threshold: null, text: 'any credit agreement evidencing indebtedness' }],
  ].map(([dealId, featureValue]) => ({
    id: `${dealId}-threshold`,
    deal_id: dealId,
    attribute: 'materialContractsBuckets',
    canonical: 'INDEBTEDNESS',
    verbatim: JSON.stringify(featureValue),
    provenance: { feature_value: featureValue },
  }));
  const result = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: null,
    filters: {},
    specs: [thresholdType],
  }, { deals, cards: [], claims }).byRow['row-1'].metrics[thresholdType.metricKey];
  const distribution = Object.fromEntries(result.distribution.values.map((item) => [item.value, item.count]));

  assert.deepEqual(distribution, {
    DOLLAR_THRESHOLD_AGGREGATE: 1,
    DOLLAR_THRESHOLD_ANNUAL: 1,
    NO_NUMERIC_THRESHOLD: 1,
  });
});

test('one row can carry presence plus a conditional value metric without overwrite', () => {
  const presence = spec('presence', {
    rowKey: 'ioc-affirmative',
    metricKey: 'ioc.affirmative.presence',
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['positiveObligations'], missingState: 'absent' },
    },
  });
  const efforts = spec('categorical', {
    rowKey: 'ioc-affirmative',
    metricKey: 'ioc.affirmative.efforts',
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['positiveObligations'], missingState: 'absent' },
      value: { strategy: 'object_field', featureKeys: ['positiveObligations'], path: 'efforts_standard' },
    },
    denominator: {
      prevalence: 'eligible_deals',
      distribution: 'present_deals',
      conditionalOn: { metricKey: 'ioc.affirmative.presence', state: 'present' },
    },
  });
  const dataset = {
    deals: [deal('subject'), deal('peer-present'), deal('peer-absent')],
    cards: [],
    claims: [
      { id: 'c1', deal_id: 'subject', attribute: 'positiveObligations', canonical: null, verbatim: '{}', provenance: { feature_value: { efforts_standard: 'RBE' } } },
      { id: 'c2', deal_id: 'peer-present', attribute: 'positiveObligations', canonical: null, verbatim: '{}', provenance: { feature_value: { efforts_standard: 'CRE' } } },
    ],
  };
  const response = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: 'subject',
    filters: {},
    specs: [efforts, presence],
  }, dataset);

  const row = response.byRow['ioc-affirmative'];
  assert.deepEqual(Object.keys(row.metrics).sort(), ['ioc.affirmative.efforts', 'ioc.affirmative.presence']);
  assert.equal(row.metrics['ioc.affirmative.presence'].coverage.eligibleCount, 2);
  assert.equal(row.metrics['ioc.affirmative.presence'].coverage.presentCount, 1);
  assert.equal(row.metrics['ioc.affirmative.efforts'].coverage.cohortCount, 1);
  assert.deepEqual(row.metrics['ioc.affirmative.efforts'].distribution.values, [
    { value: 'CRE', count: 1, dealIds: ['peer-present'], rate: 1 },
  ]);
  assert.equal(row.metrics['ioc.affirmative.efforts'].subject.value, 'RBE');
  assert.equal(response.dealDirectory['peer-present'].dealName, 'Buyer peer-present / Target peer-present');
});

test('source requirements include exact presence codes and canonical family aliases', () => {
  const codePresence = spec('presence', {
    metricKey: 'ioc.capex.presence',
    observation: {
      presence: { strategy: 'card_exists', provisionCodes: ['IOC-CAPEX'], missingState: 'absent' },
    },
  });
  const familyValue = spec('categorical', {
    metricKey: 'nosol.standard',
    cohort: { scope: 'provision_family', provisionFamily: 'NOSOL', eligibility: 'family_present' },
  });
  const requirements = collectSourceRequirements([codePresence, familyValue]);
  assert.deepEqual(requirements.provisionCodes, ['IOC-CAPEX']);
  assert.deepEqual(requirements.provisionFamilies, ['NOSOL']);
});

test('observation scope selects the exact source subtype without changing the denominator cohort', () => {
  const notice = spec('duration', {
    metricKey: 'nosol.match.notice',
    observation: {
      scope: { provisionCodes: ['NOSOL-MATCH'] },
      presence: { strategy: 'feature_non_empty', featureKeys: ['noticePeriod'], missingState: 'unknown' },
      value: { strategy: 'feature_value', featureKeys: ['noticePeriod'] },
    },
    semantics: {
      unit: 'business_days',
      calendarBasis: 'business',
      trigger: 'matching_period',
      requiredDimensions: ['unit', 'calendarBasis'],
    },
  });
  const dataset = {
    deals: [deal('d1')],
    cards: [
      { deal_id: 'd1', excerpt_id: 'match', provision_type: 'COVENANT_NO_SOLICITATION', provision_subtype: 'NOSOL-MATCH' },
      { deal_id: 'd1', excerpt_id: 'intervening', provision_type: 'COVENANT_NO_SOLICITATION', provision_subtype: 'NOSOL-INTERVENING' },
    ],
    claims: [
      { id: 'm', deal_id: 'd1', excerpt_id: 'match', attribute: 'noticePeriod', canonical: '4', canonical_numeric: { value: 4, unit: 'business_days' }, evidence_quote: 'four (4) business days', provenance: { code: 'NOSOL-MATCH' } },
      { id: 'i', deal_id: 'd1', excerpt_id: 'intervening', attribute: 'noticePeriod', canonical: '96', canonical_numeric: { value: 96, unit: 'elapsed_hours' }, evidence_quote: '96 hours', provenance: { code: 'NOSOL-INTERVENING' } },
    ],
  };
  const result = calculateMarketStats({
    contractVersion: 1, subjectDealId: null, filters: {}, specs: [notice],
  }, dataset).byRow['row-1'].metrics['nosol.match.notice'];
  assert.equal(result.coverage.eligibleCount, 1);
  assert.equal(result.distribution.cohorts[0].stats.median, 4);
});

test('title-scoped uncoded covenants compare clause treatments without mixing other covenant claims', () => {
  const controlTreatments = spec('multi_select', {
    metricKey: 'general-covenants.control-operations.treatments',
    cohort: { scope: 'provision_family', provisionFamily: 'COV', eligibility: 'family_present' },
    observation: {
      scope: { shortTitleIncludes: 'Control of Operations' },
      presence: { strategy: 'card_exists', shortTitleIncludes: 'Control of Operations', missingState: 'absent' },
      value: {
        strategy: 'feature_value',
        featureKeys: ['mainConcept'],
        normalizer: 'covenant_treatments',
        profile: 'controlOperations',
      },
    },
  });
  const dataset = {
    deals: [deal('qxo'), deal('peer'), deal('other')],
    cards: [
      {
        deal_id: 'qxo', excerpt_id: 'qxo-control', provision_type: 'COVENANT_OTHER', short_title: 'Consultation; Control of Operations',
        primary_quote: 'The Company shall provide regular updates at agreed intervals, but retains complete control. Failure shall not affect a closing condition or give rise to termination except for a willful and material breach.',
      },
      {
        deal_id: 'peer', excerpt_id: 'peer-control', provision_type: 'COVENANT_OTHER', short_title: 'Control of Operations',
        primary_quote: 'Neither party may control or direct the operations of the other before the Effective Time. Each retains complete control.',
      },
      {
        deal_id: 'other', excerpt_id: 'other-cov', provision_type: 'COVENANT_OTHER', short_title: 'Information Rights',
        primary_quote: 'Parent may control operations and receives regular updates.',
      },
    ],
    claims: [
      { id: 'q', deal_id: 'qxo', excerpt_id: 'qxo-control', attribute: 'mainConcept', verbatim: 'Regular operational updates while the Company retains pre-closing control.' },
      { id: 'p', deal_id: 'peer', excerpt_id: 'peer-control', attribute: 'mainConcept', verbatim: 'Each party retains pre-closing operational control.' },
      { id: 'o', deal_id: 'other', excerpt_id: 'other-cov', attribute: 'mainConcept', verbatim: 'Regular updates and operational control.' },
    ],
  };

  const result = calculateMarketStats({
    contractVersion: 1, subjectDealId: null, filters: {}, specs: [controlTreatments],
  }, dataset).byRow['row-1'].metrics['general-covenants.control-operations.treatments'];

  assert.equal(result.coverage.eligibleCount, 3);
  assert.equal(result.coverage.presentCount, 2);
  assert.equal(result.coverage.absentCount, 1);
  assert.deepEqual(result.distribution.values.find((item) => item.value === 'OPERATIONAL_UPDATES')?.dealIds, ['qxo']);
  assert.deepEqual(result.distribution.values.find((item) => item.value === 'PARTY_RETAINS_PRE_CLOSING_CONTROL')?.dealIds, ['qxo', 'peer']);
});

test('definition presence uses exact canonical terms, not substring matches', () => {
  const definition = spec('presence', {
    metricKey: 'definition.knowledge',
    observation: {
      presence: { strategy: 'definition_term', term: 'Knowledge', missingState: 'absent' },
    },
  });
  const dataset = {
    deals: [deal('exact'), deal('claims-corrected'), deal('longer')],
    cards: [
      { id: 'exact-card', deal_id: 'exact', excerpt_id: 'e1', provision_type: 'DEFINITION', defined_term: '“Knowledge”', short_title: 'Knowledge' },
      { id: 'corrected-card', deal_id: 'claims-corrected', excerpt_id: 'e2', provision_type: 'DEFINITION', defined_term: 'Acting Holders', short_title: 'Acting Holders' },
      { id: 'longer-card', deal_id: 'longer', excerpt_id: 'e3', provision_type: 'DEFINITION', defined_term: 'Knowledge Parties', short_title: 'Knowledge Parties' },
    ],
    claims: [{
      id: 'canonical-term',
      deal_id: 'claims-corrected',
      excerpt_id: 'e2',
      attribute: 'canonicalTerm',
      canonical: null,
      verbatim: 'Knowledge',
      provenance: { feature_value: 'Knowledge' },
    }],
  };
  const result = calculateMarketStats({
    contractVersion: 1, subjectDealId: null, filters: {}, specs: [definition],
  }, dataset).byRow['row-1'].metrics['definition.knowledge'];
  assert.equal(result.coverage.presentCount, 2);
  assert.equal(result.coverage.absentCount, 1);
  assert.deepEqual(result.dealRefsByStatus.present, [
    { dealId: 'exact', cardId: 'exact-card' },
    { dealId: 'claims-corrected', cardId: 'corrected-card' },
  ]);
  const requirements = collectSourceRequirements([definition]);
  assert.ok(requirements.provisionFamilies.includes('DEFINITION'));
  assert.ok(requirements.featureKeys.includes('canonicalTerm'));
});

test('family aliases match live provision_type values', () => {
  const index = indexDataset({
    deals: [deal('d1')],
    cards: [{ deal_id: 'd1', excerpt_id: 'e1', provision_type: 'COVENANT_NO_SOLICITATION', provision_subtype: 'NOSOL-MATCH' }],
    claims: [],
  });
  assert.equal(index.cardsByDeal.get('d1').length, 1);
  assert.equal(cardMatchesFamily(index.cardsByDeal.get('d1')[0], 'NOSOL'), true);
  assert.equal(cardMatchesFamily({ provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: null }, 'IOC'), true);
  assert.equal(cardMatchesFamily({ provision_type: 'REPRESENTATION', provision_subtype: 'REP-B-PROXY' }, 'REP-T'), false);
});

test('equity instrument cohorts keep CVR prevalence conditional on that instrument', () => {
  const instrumentCohort = {
    scope: 'provision_codes',
    provisionCodes: ['CONSID-EQUITY'],
    eligibility: 'instrument_present',
    instrumentCode: 'STOCK_OPTIONS',
    instrumentFeatureKeys: ['outstandingInstruments', 'instrumentType', 'equityAwardTreatment', 'optionsCvrEarnIn'],
  };
  const parent = spec('presence', {
    metricKey: 'equity.options.presence',
    observation: {
      scope: { provisionCodes: ['CONSID-EQUITY'] },
      presence: {
        strategy: 'instrument_item',
        featureKeys: instrumentCohort.instrumentFeatureKeys,
        instrumentCode: 'STOCK_OPTIONS',
        missingState: 'absent',
      },
    },
  });
  const consideration = spec('categorical', {
    metricKey: 'equity.options.consideration',
    cohort: instrumentCohort,
    observation: {
      scope: { provisionCodes: ['CONSID-EQUITY'] },
      presence: {
        strategy: 'instrument_item',
        featureKeys: ['equityAwardTreatment'],
        instrumentCode: 'STOCK_OPTIONS',
        missingState: 'unknown',
      },
      value: {
        strategy: 'feature_value',
        featureKeys: ['equityAwardTreatment'],
        normalizer: 'equity_consideration',
        instrumentCode: 'STOCK_OPTIONS',
      },
    },
  });
  const cvr = spec('presence', {
    metricKey: 'equity.options.cvr',
    cohort: instrumentCohort,
    observation: {
      scope: { provisionCodes: ['CONSID-EQUITY'] },
      presence: {
        strategy: 'feature_non_empty',
        featureKeys: ['optionsCvrEarnIn'],
        absentValues: ['NOT_SPECIFIED'],
        missingState: 'absent',
      },
    },
  });
  const deals = [deal('cash'), deal('rollover'), deal('rsu-only')];
  const cards = deals.map((dealRow) => ({
    deal_id: dealRow.id,
    excerpt_id: `${dealRow.id}-equity`,
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
  }));
  const claim = (id, dealId, attribute, featureValue) => ({
    id,
    deal_id: dealId,
    excerpt_id: `${dealId}-equity`,
    attribute,
    canonical: typeof featureValue === 'string' ? featureValue : null,
    verbatim: JSON.stringify(featureValue),
    provenance: { code: 'CONSID-EQUITY', feature_value: featureValue },
  });
  const claims = [
    claim('cash-instrument', 'cash', 'outstandingInstruments', [{ code: 'STOCK_OPTIONS' }]),
    claim('cash-treatment', 'cash', 'equityAwardTreatment', { stockOptions: 'Options are cancelled for cash equal to the spread.' }),
    claim('cash-cvr', 'cash', 'optionsCvrEarnIn', 'MUST_BE_ITM'),
    claim('roll-instrument', 'rollover', 'instrumentType', { code: 'STOCK_OPTIONS' }),
    claim('roll-treatment', 'rollover', 'equityAwardTreatment', { code: 'ASSUMED_BY_BUYER' }),
    claim('roll-cvr', 'rollover', 'optionsCvrEarnIn', 'NOT_SPECIFIED'),
    claim('rsu-instrument', 'rsu-only', 'outstandingInstruments', [{ code: 'RSU' }]),
    claim('rsu-treatment', 'rsu-only', 'equityAwardTreatment', { rsu: 'RSUs fully vest at closing.' }),
  ];

  const response = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: null,
    filters: {},
    specs: [parent, consideration, cvr],
  }, { deals, cards, claims }).byRow['row-1'].metrics;

  assert.equal(response['equity.options.presence'].coverage.presentCount, 2);
  assert.equal(response['equity.options.presence'].coverage.absentCount, 1);
  assert.equal(response['equity.options.cvr'].coverage.eligibleCount, 2);
  assert.equal(response['equity.options.cvr'].coverage.presentCount, 1);
  assert.equal(response['equity.options.cvr'].coverage.absentCount, 1);
  assert.equal(response['equity.options.cvr'].coverage.notApplicableCount, 1);
  assert.deepEqual(response['equity.options.consideration'].distribution.values, [
    { value: 'ASSUMED_OR_ROLLED_OVER', count: 1, dealIds: ['rollover'], rate: 0.5 },
    { value: 'CASHED_OUT', count: 1, dealIds: ['cash'], rate: 0.5 },
  ]);

  const requirements = collectSourceRequirements([cvr]);
  assert.deepEqual(requirements.featureKeys, instrumentCohort.instrumentFeatureKeys.slice().sort());
});

test('rep bring-down retains every applicable tier as a multi-select treatment', () => {
  const bringDown = spec('multi_select', {
    rowKey: 'representations-qualifiers:capitalization',
    metricKey: 'representations.capitalization.bring-down',
    cohort: { scope: 'provision_codes', provisionCodes: ['COND-B-REP'], eligibility: 'code_present' },
    observation: {
      scope: { provisionCodes: ['COND-B-REP'] },
      presence: { strategy: 'feature_non_empty', featureKeys: ['bringDownTiers'], missingState: 'unknown' },
      value: {
        strategy: 'feature_value',
        featureKeys: ['bringDownTiers'],
        normalizer: 'bring_down_for_rep',
        repLabel: 'Capitalization (public buyer)',
        repCode: 'REP-B-CAP',
        repSection: '3.2(b)',
      },
    },
  });
  const qxo = deal('qxo');
  const multiPeer = deal('multi-peer');
  const generalPeer = deal('general-peer');
  const cards = [qxo, multiPeer, generalPeer].map((dealRow) => ({
    deal_id: dealRow.id,
    excerpt_id: `${dealRow.id}-condition`,
    provision_type: 'CLOSING_CONDITION',
    provision_subtype: 'COND-B-REP',
  }));
  const tiers = [
    { standard: 'MAT_MAE_QUALIFIED', reps_covered: 'All other representations and warranties of Parent' },
    { standard: 'MAT_ALL_RESPECTS_DE_MINIMIS', reps_covered: 'Section 3.2(b)(i) and Section 3.2(b)(iv) (Capital Structure)' },
    { standard: 'MAT_ALL_RESPECTS', reps_covered: 'Section 3.2(f)(i)(B) (Absence of Certain Changes)' },
    { standard: 'MAT_MATERIALITY_SCRAPE', reps_covered: 'Section 3.2(b) (Capital Structure) other than Section 3.2(b)(i) and Section 3.2(b)(iv)' },
  ];
  const splitTierClaims = (dealRow) => tiers.map((tier, index) => ({
    id: `${dealRow.id}-tier-${index}`,
    deal_id: dealRow.id,
    excerpt_id: `${dealRow.id}-condition`,
    attribute: 'bringDownTiers',
    verbatim: JSON.stringify(tier),
    provenance: { code: 'COND-B-REP', feature_value: tier },
  }));
  const claims = [
    ...splitTierClaims(qxo),
    ...splitTierClaims(multiPeer),
    { id: 'general-tier', deal_id: generalPeer.id, excerpt_id: 'general-peer-condition', attribute: 'bringDownTiers', verbatim: 'All Company representations in all material respects', provenance: { code: 'COND-B-REP', feature_value: [{ standard: 'MAT_ALL_MATERIAL', reps_covered: 'All Company representations' }] } },
  ];

  const result = calculateMarketStats({
    contractVersion: 1, subjectDealId: qxo.id, filters: {}, specs: [bringDown],
  }, { deals: [qxo, multiPeer, generalPeer], cards, claims })
    .byRow[bringDown.rowKey].metrics[bringDown.metricKey];

  assert.deepEqual(result.subject.values, ['MAT_ALL_RESPECTS_DE_MINIMIS', 'MAT_MATERIALITY_SCRAPE']);
  assert.equal(result.subject.valueState, 'comparable');
  assert.equal(result.coverage.comparableCount, 2);
  assert.equal(result.coverage.excludedCount, 0);
  assert.deepEqual(result.distribution.values.map(({ value, count }) => ({ value, count })), [
    { value: 'MAT_ALL_MATERIAL', count: 1 },
    { value: 'MAT_ALL_RESPECTS_DE_MINIMIS', count: 1 },
    { value: 'MAT_MATERIALITY_SCRAPE', count: 1 },
  ]);
});

test('future outside dates and historical rep dates normalise on opposite sides of signing', () => {
  const outside = spec('duration', {
    metricKey: 'termination.outside.months',
    cohort: { scope: 'provision_codes', provisionCodes: ['TERMR-OUTSIDE'], eligibility: 'code_present' },
    observation: {
      scope: { provisionCodes: ['TERMR-OUTSIDE'] },
      presence: { strategy: 'feature_non_empty', featureKeys: ['outsideDate', 'outsideDateISO'], missingState: 'unknown' },
      value: {
        strategy: 'feature_value',
        featureKeys: ['outsideDate', 'outsideDateISO'],
        normalizer: 'forward_period_months',
      },
    },
    semantics: {
      unit: 'months',
      calendarBasis: 'elapsed',
      trigger: 'signing_date',
      requiredDimensions: ['unit', 'calendarBasis'],
    },
  });
  const lookback = spec('duration', {
    metricKey: 'rep.lookback.months',
    cohort: { scope: 'provision_codes', provisionCodes: ['REP-T-ORG'], eligibility: 'code_present' },
    observation: {
      scope: { provisionCodes: ['REP-T-ORG'] },
      presence: { strategy: 'feature_non_empty', featureKeys: ['lookbackDateISO'], missingState: 'unknown' },
      value: { strategy: 'feature_value', featureKeys: ['lookbackDateISO'], normalizer: 'relative_period_months' },
    },
    semantics: {
      unit: 'months',
      calendarBasis: 'elapsed',
      trigger: 'signing_date',
      requiredDimensions: ['unit', 'calendarBasis'],
    },
  });
  const deals = [
    { ...deal('iso-outside'), announce_date: '2025-09-21' },
    { ...deal('long-outside'), announce_date: '2025-09-21' },
    { ...deal('rep'), announce_date: '2025-07-01' },
  ];
  const cards = [
    { deal_id: 'iso-outside', excerpt_id: 'iso-card', provision_subtype: 'TERMR-OUTSIDE' },
    { deal_id: 'long-outside', excerpt_id: 'long-card', provision_subtype: 'TERMR-OUTSIDE' },
    { deal_id: 'rep', excerpt_id: 'rep-card', provision_subtype: 'REP-T-ORG' },
  ];
  const claims = [
    { id: 'iso', deal_id: 'iso-outside', excerpt_id: 'iso-card', attribute: 'outsideDateISO', canonical: '2026-03-21', verbatim: '2026-03-21', provenance: { code: 'TERMR-OUTSIDE' } },
    { id: 'long', deal_id: 'long-outside', excerpt_id: 'long-card', attribute: 'outsideDate', canonical: 'March 21, 2026', verbatim: 'March 21, 2026', provenance: { code: 'TERMR-OUTSIDE' } },
    { id: 'lookback', deal_id: 'rep', excerpt_id: 'rep-card', attribute: 'lookbackDateISO', canonical: '2024-01-01', verbatim: '2024-01-01', provenance: { code: 'REP-T-ORG' } },
  ];
  const metrics = calculateMarketStats({ contractVersion: 1, filters: {}, specs: [outside, lookback] }, { deals, cards, claims })
    .byRow['row-1'].metrics;

  assert.equal(metrics['termination.outside.months'].distribution.cohorts[0].stats.median, 6);
  assert.equal(metrics['termination.outside.months'].coverage.comparableCount, 2);
  assert.equal(metrics['rep.lookback.months'].distribution.cohorts[0].stats.median, 18);
});
