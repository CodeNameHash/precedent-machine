import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARKET_METRIC_CONTRACT_VERSION,
  assignMarketRowKeys,
  assertMarketMetricCoverage,
  buildMarketMetricBatchRequest,
  comparableMetric,
  enumerateMarketSectionRows,
  groupMarketMetricResults,
  mergeMarketMetricBatchResponses,
  resolveMarketMetricRow,
  resolveMarketSectionRows,
  runMarketMetricBatchPool,
  splitMarketMetricBatchRequest,
  stableMarketRowKey,
  validateMarketMetricResult,
  validateMarketMetricSpec,
} from '../lib/market-metrics/index.js';
import rowMarketStatsService from '../lib/row-market-stats/service.js';
import rowMarketStatsRequest from '../lib/row-market-stats/request.js';
import { considerationHeroConfig } from '../components/review/table-configs/consideration-hero.config.js';
import { representationsQualifiersConfig } from '../components/review/table-configs/representations-qualifiers.config.js';
import { structureMechanicsConfig } from '../components/review/table-configs/structure-mechanics.config.js';

const { calculateMarketStats } = rowMarketStatsService;
const { parseMarketStatsRequest } = rowMarketStatsRequest;

const allDeals = { scope: 'all_deals', eligibility: 'all_deals' };
const denominator = { prevalence: 'eligible_deals', distribution: 'present_deals' };

test('definition market rows exclude ingestion fragments hidden by the review UI', () => {
  const rows = enumerateMarketSectionRows(
    { id: '__definitions', title: 'Definitions' },
    {
      definitions: [
        { defined_term: 'Business Day', defined_value: 'A day other than Saturday or Sunday.' },
        { defined_term: 'business day', defined_value: 'fragment' },
        { defined_term: 'under common control with', defined_value: 'fragment' },
        { defined_term: 'Willful and Material Breach', defined_value: 'A material breach that is deliberate.' },
        { defined_term: 'to the extent', defined_value: 'fragment' },
      ],
    },
  );

  assert.deepEqual(rows.map(({ row }) => row.defined_term), [
    'Business Day',
    'Willful and Material Breach',
  ]);
});

test('deal-level Knowledge compares its standard and covered persons', () => {
  const reviewDeal = {
    cards: [{
      id: 'knowledge-definition',
      kind: 'definition',
      provision_type: 'DEFINED_TERM',
      provision_subtype: 'DEF-KNOWLEDGE',
      defined_term: 'Knowledge',
      primary_quote: 'Knowledge means the actual knowledge of the executive officers.',
      features: {
        knowledgeStandard: 'actual-knowledge',
        knowledgePersons: ['EXECUTIVE_OFFICERS'],
        knowledgeScope: 'the actual knowledge of the executive officers',
      },
    }],
  };
  const section = resolveMarketSectionRows({
    id: 'representations-company',
    title: 'Representations & Warranties — Company',
    config: representationsQualifiersConfig,
  }, reviewDeal);
  const knowledge = section.rows.find((entry) => entry.row.kind === 'knowledge-summary');

  assert.equal(knowledge.resolution, 'semantic_row');
  assert.deepEqual(knowledge.metrics.slice(1).map((metric) => [metric.label, metric.comparison.kind]), [
    ['Knowledge standard', 'categorical'],
    ['Persons included', 'multi_select'],
  ]);
});

test('market metric contract enforces explicit absence and duration semantics', () => {
  const missingState = validateMarketMetricSpec({
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey: 'notice-period',
    metricKey: 'nosol.notice-period',
    label: 'Notice period',
    comparison: { status: 'comparable', kind: 'duration' },
    cohort: allDeals,
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['noticePeriod'] },
      value: { strategy: 'feature_value', featureKeys: ['noticePeriod'] },
    },
    denominator,
    semantics: { unit: 'business_days', calendarBasis: 'business', trigger: 'notice' },
  });
  assert.equal(missingState.valid, false);
  assert.ok(missingState.errors.some((error) => error.path === 'observation.presence.missingState'));

  const ambiguousClock = validateMarketMetricSpec({
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey: 'notice-period',
    metricKey: 'nosol.notice-period',
    label: 'Notice period',
    comparison: { status: 'comparable', kind: 'duration' },
    cohort: allDeals,
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['noticePeriod'], missingState: 'unknown' },
      value: { strategy: 'feature_value', featureKeys: ['noticePeriod'] },
    },
    denominator,
    semantics: { unit: 'business_days', calendarBasis: 'business' },
  });
  assert.equal(ambiguousClock.valid, false);
  assert.ok(ambiguousClock.errors.some((error) => error.path === 'semantics.trigger'));

  const observedTriggerClock = validateMarketMetricSpec({
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey: 'proxy-deadline',
    metricKey: 'sec.proxy-deadline',
    label: 'Proxy deadline',
    comparison: { status: 'comparable', kind: 'duration' },
    cohort: allDeals,
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['proxyFilingDeadline'], missingState: 'unknown' },
      value: { strategy: 'feature_value', featureKeys: ['proxyFilingDeadline'], normalizer: 'deadline_duration' },
    },
    denominator,
    semantics: {
      unit: 'days_equivalent',
      calendarBasis: 'mixed',
      requiredDimensions: ['unit', 'calendarBasis', 'trigger'],
      normalisation: { type: 'duration_to_days', hoursPerDay: 24 },
    },
  });
  assert.equal(observedTriggerClock.valid, true);
});

test('market metric contract permits title-scoped observations for uncoded provisions', () => {
  const titleScoped = validateMarketMetricSpec({
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey: 'parent-board-appointment',
    metricKey: 'general-covenants.parent-board-appointment.treatments',
    label: 'Provision treatments',
    comparison: { status: 'comparable', kind: 'multi_select' },
    cohort: { scope: 'provision_family', provisionFamily: 'COV', eligibility: 'family_present' },
    observation: {
      scope: { shortTitleIncludes: 'Board Appointment' },
      presence: { strategy: 'card_exists', shortTitleIncludes: 'Board Appointment', missingState: 'absent' },
      value: {
        strategy: 'feature_value',
        featureKeys: ['mainConcept'],
        normalizer: 'covenant_treatments',
        profile: 'boardAppointment',
      },
    },
    denominator,
  });

  assert.equal(titleScoped.valid, true);
});

test('money metrics require deal-value normalisation stratified by denominator basis', () => {
  assert.throws(() => comparableMetric({
    rowKey: 'fee',
    metricKey: 'termination.fee',
    label: 'Termination fee',
    kind: 'money',
    cohort: allDeals,
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['feeAmount'], missingState: 'unknown' },
      value: { strategy: 'feature_value', featureKeys: ['feeAmount'] },
    },
    denominator,
    semantics: { unit: 'usd' },
  }), /normalisation policy/);
});

test('market metric contracts reject object-prototype row and metric keys', () => {
  const base = {
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey: 'safe-row',
    metricKey: 'safe-metric',
    label: 'Safe metric',
    comparison: { status: 'comparable', kind: 'presence' },
    cohort: allDeals,
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['feature'], missingState: 'absent' },
    },
    denominator,
  };

  for (const reserved of ['__proto__', 'prototype', 'constructor']) {
    assert.equal(validateMarketMetricSpec({ ...base, rowKey: reserved }).valid, false);
    assert.equal(validateMarketMetricSpec({ ...base, metricKey: reserved }).valid, false);
  }
});

test('market result coverage keeps prevalence and value comparability separate', () => {
  const valid = validateMarketMetricResult({
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey: 'material-contracts:customer',
    metricKey: 'material-contracts.bucket.customer.threshold',
    state: 'ready',
    coverage: {
      cohortCount: 40,
      eligibleCount: 38,
      presentCount: 20,
      absentCount: 15,
      unknownCount: 3,
      notApplicableCount: 2,
      classifiedCount: 35,
      observedCount: 18,
      valueUnknownCount: 2,
      comparableCount: 15,
      excludedCount: 3,
    },
    distribution: { kind: 'money', count: 15 },
  });
  assert.equal(valid.valid, true);

  const invalid = validateMarketMetricResult({
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey: 'material-contracts:customer',
    metricKey: 'material-contracts.bucket.customer.threshold',
    state: 'ready',
    coverage: {
      cohortCount: 40,
      eligibleCount: 38,
      presentCount: 20,
      absentCount: 15,
      unknownCount: 3,
      notApplicableCount: 2,
      classifiedCount: 35,
      observedCount: 18,
      valueUnknownCount: 2,
      comparableCount: 17,
      excludedCount: 3,
    },
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.path === 'coverage.observedCount'));
});

test('market result deal attribution matches coverage and distribution counts', () => {
  const coverage = {
    cohortCount: 3,
    eligibleCount: 3,
    presentCount: 2,
    absentCount: 1,
    unknownCount: 0,
    notApplicableCount: 0,
    classifiedCount: 3,
    observedCount: 2,
    valueUnknownCount: 0,
    comparableCount: 2,
    excludedCount: 0,
  };
  const base = {
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey: 'row',
    metricKey: 'row.value',
    state: 'ready',
    coverage,
    distribution: {
      kind: 'categorical',
      values: [{ value: 'A', count: 2, dealIds: ['d1', 'd2'] }],
    },
  };
  assert.equal(validateMarketMetricResult(base).valid, true);
  const attributed = validateMarketMetricResult({
    ...base,
    distribution: {
      kind: 'categorical',
      values: [{
        value: 'A',
        count: 2,
        dealIds: ['d1', 'd2'],
        dealRefs: [{ dealId: 'd1', cardId: 'card-1' }, { dealId: 'd2', cardId: 'card-2' }],
      }],
    },
  });
  assert.equal(attributed.valid, true);
  const invalidDistribution = validateMarketMetricResult({
    ...base,
    distribution: { kind: 'categorical', values: [{ value: 'A', count: 2, dealIds: ['d1'] }] },
  });
  assert.ok(invalidDistribution.errors.some((error) => error.path === 'distribution.values.0.dealIds'));
  const mismatchedRefs = validateMarketMetricResult({
    ...base,
    distribution: {
      kind: 'categorical',
      values: [{
        value: 'A',
        count: 2,
        dealIds: ['d1', 'd2'],
        dealRefs: [{ dealId: 'd2', cardId: 'card-2' }, { dealId: 'd1', cardId: 'card-1' }],
      }],
    },
  });
  assert.ok(mismatchedRefs.errors.some((error) => error.path === 'distribution.values.0.dealRefs'));

  const numericAttribution = validateMarketMetricResult({
    ...base,
    distribution: {
      kind: 'numeric',
      cohorts: [{
        stats: { n: 2 },
        dealIds: ['d1', 'd2'],
        dealRefs: [{ dealId: 'd1', cardId: 'card-1' }, { dealId: 'd2', cardId: 'card-2' }],
      }],
    },
  });
  assert.equal(numericAttribution.valid, true);

  const moneyAttribution = validateMarketMetricResult({
    ...base,
    distribution: {
      kind: 'money',
      normalised: {
        cohorts: [{
          percent: { stats: { n: 2 } },
          dealIds: ['d1', 'd2'],
          dealRefs: [{ dealId: 'd1', cardId: 'card-1' }, { dealId: 'd2', cardId: 'card-2' }],
        }],
      },
    },
  });
  assert.equal(moneyAttribution.valid, true);

  const invalidCardRef = validateMarketMetricResult({
    ...base,
    distribution: {
      kind: 'categorical',
      values: [{ value: 'A', count: 2, dealIds: ['d1', 'd2'], dealRefs: [{ dealId: 'd1', cardId: '' }, { dealId: 'd2' }] }],
    },
  });
  assert.ok(invalidCardRef.errors.some((error) => error.path === 'distribution.values.0.dealRefs.0.cardId'));

  const presence = validateMarketMetricResult({
    ...base,
    distribution: { kind: 'presence' },
    dealIdsByStatus: { present: ['d1', 'd2'], absent: ['d3'], unknown: [], not_applicable: [] },
    dealRefsByStatus: {
      present: [{ dealId: 'd1', cardId: 'card-1' }, { dealId: 'd2', cardId: 'card-2' }],
      absent: [{ dealId: 'd3' }],
      unknown: [],
      not_applicable: [],
    },
  });
  assert.equal(presence.valid, true);
  const overlapping = validateMarketMetricResult({
    ...base,
    distribution: { kind: 'presence' },
    dealIdsByStatus: { present: ['d1', 'd2'], absent: ['d2'], unknown: [], not_applicable: [] },
  });
  assert.ok(overlapping.errors.some((error) => error.path === 'dealIdsByStatus'));
});

test('material-contract rows use stable bucket keys and conditional money metrics', () => {
  const one = resolveMarketMetricRow({
    id: 'material-contracts-CUSTOMER-17',
    code: 'CUSTOMER',
    label: 'Customer contracts',
    threshold: '$10,000,000 per annum',
  });
  const two = resolveMarketMetricRow({
    id: 'material-contracts-CUSTOMER-2',
    code: 'CUSTOMER',
    label: 'Customer contracts',
    threshold: '$5,000,000',
  });
  const three = resolveMarketMetricRow({
    id: 'material-contracts-CUSTOMER-3',
    code: 'CUSTOMER',
    label: 'Customer contracts',
    threshold: '$7,500,000 per year',
  });
  assert.equal(one.rowKey, 'material-contracts:customer:annual:10-000-000-per-annum');
  assert.equal(two.rowKey, 'material-contracts:customer:aggregate:5-000-000');
  assert.equal(three.rowKey, 'material-contracts:customer:annual:7-500-000-per-year');
  assert.notEqual(three.rowKey, one.rowKey);
  assert.notEqual(two.metrics[0].metricKey, one.metrics[0].metricKey);
  assert.notEqual(three.metrics[0].metricKey, one.metrics[0].metricKey);
  assert.equal(one.resolution, 'manifest');
  assert.deepEqual(one.metrics.map((metric) => metric.comparison.kind), ['presence', 'categorical', 'money']);
  assert.equal(one.metrics[1].observation.value.normalizer, 'material_contract_threshold_type');
  assert.equal(one.metrics[2].observation.presence.itemCode, 'CUSTOMER');
  assert.deepEqual(one.metrics[2].observation.value.featureKeys, ['materialContractsBuckets']);
  assert.equal(one.metrics[2].observation.value.path, 'threshold');
  assert.equal(one.metrics[2].semantics.cadence, 'annual');
  assert.deepEqual(one.metrics[2].semantics.stratifyDimensions, ['cadence']);
  assert.equal(one.metrics[2].semantics.normalisation.basisPolicy, 'stratify_by_basis');
  assert.equal(one.metrics[2].denominator.conditionalOn.metricKey, one.metrics[0].metricKey);
});

test('visible-row keys stay deterministic and unique when ids or semantic labels repeat', () => {
  const rows = [
    { id: 'employee-benefits-severance', label: 'Severance' },
    { id: 'employee-benefits-severance', label: 'Severance' },
    { id: 'representations-qualifiers-11111111-1111-4111-8111-111111111111', label: 'Material Contracts' },
    { id: 'representations-qualifiers-22222222-2222-4222-8222-222222222222', label: 'Material Contracts' },
  ];
  const context = { sectionId: 'employee-benefits', configId: 'employee-benefits' };
  const firstPass = assignMarketRowKeys(rows, context);
  const secondPass = assignMarketRowKeys(rows.map((row) => ({ ...row })), context);

  assert.deepEqual(secondPass, firstPass);
  assert.equal(new Set(firstPass).size, rows.length);
  assert.equal(firstPass[1], `${firstPass[0]}~1`);
  assert.equal(firstPass[3], `${firstPass[2]}~1`);
});

test('QXO consideration rows compare economics and election terms instead of card presence alone', () => {
  const reviewDeal = {
    cards: [
      {
        id: 'qxo-convert',
        provision_type: 'CONSIDERATION',
        provision_subtype: 'CONSID-CONVERT',
        primary_quote: 'Each Company Share converts into $505.00 in cash or 20.200 Parent Shares.',
        features: {
          considerationType: 'mixed-cash-and-stock',
          perShareAmount: 505,
          exchangeRatio: '20.200 Parent Shares per Company Share',
          prorationMechanics: {
            electionType: 'CASH_OR_STOCK',
            text: 'Cash elections are capped at 45% and stock elections at 55%.',
            oversubscriptionTreatment: 'If Cash Election Shares exceed the Maximum Cash Election Number, those elections are prorated; if Stock Election Shares exceed the Maximum Stock Election Number, those elections are prorated.',
          },
        },
      },
      {
        id: 'qxo-exchange',
        provision_type: 'CONSIDERATION',
        provision_subtype: 'CONSID-EXCHANGE',
        primary_quote: 'The exchange agent shall deliver the merger consideration.',
        features: { considerationType: 'mixed-cash-and-stock' },
      },
    ],
  };
  const section = resolveMarketSectionRows({
    id: 'consideration-hero',
    title: 'Consideration',
    config: considerationHeroConfig,
  }, reviewDeal);

  assert.deepEqual(section.rows.map((entry) => entry.row.id), [
    'consideration-hero-headline',
    'consideration-hero-per-share',
    'consideration-hero-exchangeRatio',
    'consideration-hero-prorationMechanics',
    'consideration-hero-other-provisions',
  ]);
  assert.ok(section.rows.every((entry) => entry.resolution === 'semantic_row'));
  assert.ok(section.rows.every((entry) => entry.metrics.some((metric) => metric.comparison.kind !== 'presence')));
  const cash = section.rows.find((entry) => entry.row.id === 'consideration-hero-per-share')
    .metrics.find((metric) => metric.label === 'Cash per share');
  assert.equal(cash.comparison.kind, 'money');
  assert.equal(cash.semantics.normalisation.basisPolicy, 'stratify_by_basis');
});

test('multi-step merger forms compare each legal form instead of excluding the deal as scalar', () => {
  const reviewDeal = {
    cards: [
      {
        id: 'reverse-step',
        provision_type: 'STRUCTURE_MECHANICS',
        provision_subtype: 'STRUCT-MERGER',
        features: { mergerForm: 'REVERSE_TRIANGULAR_MERGER' },
      },
      {
        id: 'forward-step',
        provision_type: 'STRUCTURE_MECHANICS',
        provision_subtype: 'STRUCT-MERGER',
        features: { mergerForm: 'FORWARD_TRIANGULAR_MERGER' },
      },
    ],
  };
  const section = resolveMarketSectionRows({
    id: 'structure-mechanics',
    title: 'Structure & Mechanics',
    config: structureMechanicsConfig,
  }, reviewDeal);
  const mergerForm = section.rows.find((entry) => entry.row.id === 'structure-mechanics-merger-form');
  const treatment = mergerForm.metrics.find((metric) => metric.presentation.role === 'treatment');

  assert.equal(mergerForm.resolution, 'semantic_row');
  assert.equal(treatment.label, 'Merger forms used');
  assert.equal(treatment.comparison.kind, 'multi_select');
  assert.deepEqual(treatment.observation.value.featureKeys, ['mergerForm']);
});

test('QXO-style duplicate material-contract rows retain one row and metric contract each', () => {
  const visibleRows = [
    {
      id: 'material-contracts-AGGREGATE_PAYMENTS-1',
      code: 'AGGREGATE_PAYMENTS',
      label: 'Contracts above an aggregate-payments threshold',
      threshold: '$10,000,000',
      evidence: 'Expenditures or receipts of more than $10,000,000 in 2025.',
    },
    {
      id: 'material-contracts-AGGREGATE_PAYMENTS-4',
      code: 'AGGREGATE_PAYMENTS',
      label: 'Contracts above an aggregate-payments threshold',
      threshold: '$10,000,000 per annum',
      evidence: 'Services or goods in excess of $10,000,000 per annum.',
    },
    {
      id: 'material-contracts-OTHER-3',
      code: 'OTHER',
      label: 'Other material contracts',
      threshold: 'Any',
    },
    {
      id: 'material-contracts-OTHER-16',
      code: 'OTHER',
      label: 'Other material contracts',
      threshold: 'Any',
    },
  ];
  const section = resolveMarketSectionRows({
    id: 'material-contracts',
    title: 'Material Contracts',
    config: { id: 'material-contracts', selectRows: () => visibleRows },
  }, { cards: [] });
  const uiKeys = assignMarketRowKeys(visibleRows, { sectionId: 'material-contracts', configId: 'material-contracts' });
  const request = buildMarketMetricBatchRequest(section);
  const expectedMetricCount = section.rows.reduce((count, row) => count + row.metrics.length, 0);
  const available = new Set(request.specs.map((spec) => spec.metricKey));

  assert.equal(section.rowCount, visibleRows.length);
  assert.deepEqual(section.rows.map((row) => row.rowKey), uiKeys);
  assert.equal(new Set(section.rows.map((row) => row.rowKey)).size, visibleRows.length);
  assert.notEqual(section.rows[0].rowKey, section.rows[1].rowKey);
  assert.match(section.rows[0].rowKey, /:specified-year:/);
  assert.match(section.rows[1].rowKey, /:annual:/);
  assert.equal(section.rows[0].metrics[2].semantics.cadence, 'specified_year');
  assert.equal(section.rows[1].metrics[2].semantics.cadence, 'annual');
  assert.equal(section.rows[3].rowKey, `${section.rows[2].rowKey}~1`);
  assert.equal(request.specs.length, expectedMetricCount);
  assert.equal(available.size, expectedMetricCount);
  for (const spec of request.specs) {
    const dependency = spec.denominator?.conditionalOn?.metricKey;
    if (dependency) assert.equal(available.has(dependency), true, `missing ${dependency}`);
  }
});

test('affirmative IOC limbs key by semantic label and expose conditional scope and efforts metrics', () => {
  const cardId = '2dc3a05f-b170-4d59-a255-b7103cca16e1';
  const resolved = resolveMarketMetricRow({
    id: `ioc-aff-${cardId}-0`,
    label: 'Conduct business in ordinary course',
  });
  assert.equal(resolved.rowKey, 'ioc:affirmative:conduct-business-in-ordinary-course');
  assert.deepEqual(resolved.metrics.map((metric) => metric.metricKey.split('.').at(-1)), ['presence', 'scope', 'efforts-standard']);
  assert.equal(resolved.metrics[1].observation.value.path, 'appliesTo');
  assert.equal(resolved.metrics[0].observation.presence.strategy, 'list_item');
  assert.equal(resolved.metrics[0].observation.presence.itemIdentity, 'conduct-business-in-ordinary-course');
  assert.equal(resolved.metrics[1].observation.value.itemIdentity, 'conduct-business-in-ordinary-course');
  assert.equal(resolved.metrics[1].observation.value.strategy, 'list_item_field');
  assert.equal(resolved.metrics[2].comparison.kind, 'multi_select');
  assert.equal(resolved.metrics[2].denominator.conditionalOn.metricKey, resolved.metrics[0].metricKey);
});

test('affirmative IOC prevalence and value metrics stay scoped to the selected obligation', () => {
  const ordinary = resolveMarketMetricRow({
    id: 'ioc-aff-ordinary-0',
    label: 'Conduct business in ordinary course',
    evidence: 'The Company shall conduct its business in the ordinary course.',
  }, { configId: 'ioc-exceptions' });
  const preserve = resolveMarketMetricRow({
    id: 'ioc-aff-preserve-0',
    label: 'Preserve business organization & relationships',
    evidence: 'The Company shall preserve its business organization and relationships with employees.',
  }, { configId: 'ioc-exceptions' });
  const request = buildMarketMetricBatchRequest([ordinary, preserve]);
  const claim = (id, dealId, featureValue) => ({
    id,
    deal_id: dealId,
    attribute: 'positiveObligations',
    canonical: null,
    verbatim: JSON.stringify(featureValue),
    provenance: { feature_value: featureValue },
  });
  const dataset = {
    deals: [
      { id: 'ordinary-flat', metadata: {} },
      { id: 'preserve-cre', metadata: {} },
      { id: 'ordinary-rbe', metadata: {} },
    ],
    cards: [],
    claims: [
      claim('ordinary-flat', 'ordinary-flat', {
        obligation: 'conduct its business in the ordinary course',
        appliesTo: [{ code: 'BUSINESS' }],
        efforts_standard: 'FLAT',
      }),
      claim('preserve-cre', 'preserve-cre', {
        obligation: 'preserve its business organization and relationships with employees',
        appliesTo: [{ code: 'PERSONNEL' }],
        efforts_standard: 'CRE',
      }),
      claim('ordinary-rbe', 'ordinary-rbe', {
        obligation: 'operate in the ordinary course of business',
        appliesTo: [{ code: 'OPERATIONS' }],
        efforts_standard: 'RBE',
      }),
    ],
  };

  const response = calculateMarketStats(request, dataset);
  const ordinaryResults = response.byRow[ordinary.rowKey].metrics;
  const preserveResults = response.byRow[preserve.rowKey].metrics;
  assert.equal(ordinaryResults[ordinary.metrics[0].metricKey].coverage.presentCount, 2);
  assert.equal(preserveResults[preserve.metrics[0].metricKey].coverage.presentCount, 1);
  assert.deepEqual(
    ordinaryResults[ordinary.metrics[1].metricKey].distribution.values.map((item) => item.value).sort(),
    ['BUSINESS', 'OPERATIONS'],
  );
  assert.deepEqual(
    preserveResults[preserve.metrics[1].metricKey].distribution.values.map((item) => item.value),
    ['PERSONNEL'],
  );
});

test('code-backed term prevalence retains deals where the term is absent', () => {
  const resolved = resolveMarketMetricRow({
    id: 'termination-fees-COMPANY_TERMINATION_FEE',
    label: 'Company termination fee',
  });
  assert.equal(resolved.metrics[0].cohort.eligibility, 'all_deals');
  assert.equal(resolved.metrics[0].observation.presence.strategy, 'card_exists');
  assert.equal(resolved.metrics[0].observation.presence.missingState, 'absent');

  const request = buildMarketMetricBatchRequest([resolved]);
  const dataset = {
    deals: [
      { id: 'with-fee', value_usd: 100000000, metadata: { deal_value_basis: 'equity_value' } },
      { id: 'without-fee-1', value_usd: 200000000, metadata: { deal_value_basis: 'equity_value' } },
      { id: 'without-fee-2', value_usd: 300000000, metadata: { deal_value_basis: 'equity_value' } },
    ],
    cards: [{ deal_id: 'with-fee', excerpt_id: 'fee-card', provision_subtype: 'TERMF-TARGET' }],
    claims: [{
      id: 'fee-claim',
      deal_id: 'with-fee',
      excerpt_id: 'fee-card',
      attribute: 'companyTerminationFee',
      canonical: null,
      verbatim: '1000000',
      provenance: { code: 'TERMF-TARGET', feature_value: { amount: 1000000 } },
    }],
  };
  const response = calculateMarketStats(request, dataset);
  const presence = response.byRow[resolved.rowKey].metrics[resolved.metrics[0].metricKey];
  const value = response.byRow[resolved.rowKey].metrics[resolved.metrics[1].metricKey];
  assert.equal(presence.coverage.eligibleCount, 3);
  assert.equal(presence.coverage.presentCount, 1);
  assert.equal(presence.coverage.absentCount, 2);
  assert.equal(value.coverage.comparableCount, 1);
  assert.equal(value.subject, null);
});

test('negative IOC rows expose code-scoped restrictions, exceptions and deal-relative thresholds', () => {
  const resolved = resolveMarketMetricRow({
    id: 'ioc-neg-company-IOC-MERGE',
    code: 'IOC-MERGE',
    label: 'Mergers and acquisitions',
    featureKeys: ['restrictionComponents', 'permittedExceptions', 'dollarThreshold'],
  });
  assert.equal(resolved.resolution, 'manifest');
  assert.deepEqual(
    resolved.metrics.map((metric) => metric.comparison.kind),
    ['presence', 'multi_select', 'multi_select', 'money'],
  );
  const [presence, restrictions, exceptions, threshold] = resolved.metrics;
  assert.deepEqual(presence.observation.presence.provisionCodes, ['IOC-MERGE']);
  for (const metric of [restrictions, exceptions, threshold]) {
    assert.deepEqual(metric.observation.scope.provisionCodes, ['IOC-MERGE']);
    assert.equal(metric.denominator.conditionalOn.metricKey, presence.metricKey);
  }
  assert.deepEqual(restrictions.observation.value.featureKeys, ['restrictionComponents']);
  assert.deepEqual(exceptions.observation.value.featureKeys, ['permittedExceptions']);
  assert.equal(restrictions.observation.presence.missingState, 'absent');
  assert.equal(exceptions.observation.presence.missingState, 'absent');
  assert.equal(threshold.observation.presence.strategy, 'optional_money');
  assert.equal(threshold.observation.presence.missingState, 'absent');
  assert.equal(threshold.observation.value.normalizer, 'ioc_dollar_threshold');
  assert.equal(threshold.semantics.unit, 'usd');
  assert.deepEqual(threshold.semantics.stratifyDimensions, ['cadence']);
  assert.equal(threshold.semantics.normalisation.type, 'percent_of_deal_value');
  assert.equal(threshold.semantics.normalisation.basisPolicy, 'stratify_by_basis');

  const liveGroupedShape = resolveMarketMetricRow({
    id: 'ioc-neg-4.1-IOC-MERGE',
    label: 'Mergers and acquisitions',
  });
  assert.deepEqual(liveGroupedShape.metrics.map((metric) => metric.comparison.kind), ['presence', 'multi_select', 'multi_select', 'money']);
  assert.deepEqual(liveGroupedShape.metrics[0].observation.presence.provisionCodes, ['IOC-MERGE']);

  const capex = resolveMarketMetricRow({ id: 'ioc-neg-company-IOC-CAPEX', code: 'IOC-CAPEX', label: 'Capital expenditures' });
  const charter = resolveMarketMetricRow({ id: 'ioc-neg-company-IOC-CHARTER', code: 'IOC-CHARTER', label: 'Charter / Bylaws' });
  const request = buildMarketMetricBatchRequest([capex, charter], { subjectDealId: 'qxo' });
  const dataset = {
    deals: [{ id: 'qxo', value_usd: 1e9, metadata: { deal_value_basis: 'headline_transaction_value' } }],
    cards: [
      { id: 'capex-card', deal_id: 'qxo', excerpt_id: 'capex', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-CAPEX' },
      { id: 'charter-card', deal_id: 'qxo', excerpt_id: 'charter', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-CHARTER' },
    ],
    claims: [{
      id: 'capex-exceptions',
      deal_id: 'qxo',
      excerpt_id: 'capex',
      attribute: 'permittedExceptions',
      canonical: null,
      verbatim: null,
      provenance: {
        code: 'IOC-CAPEX',
        feature_value: [{
          code: 'MONETARY_THRESHOLD',
          thresholdIndividual: 5e6,
          thresholdAggregate: 20e6,
          text: 'up to $5,000,000 individually or $20,000,000 in the aggregate',
        }],
      },
    }],
  };
  const response = calculateMarketStats(request, dataset);
  const capexThreshold = response.byRow[capex.rowKey].metrics[capex.metrics[3].metricKey];
  assert.equal(capexThreshold.subject.rawUsd, 20e6);
  assert.equal(capexThreshold.subject.semantics.cadence, 'aggregate');
  assert.equal(capexThreshold.subject.percentOfDealValue, 2);
  for (const metric of charter.metrics.slice(1)) {
    assert.equal(response.byRow[charter.rowKey].metrics[metric.metricKey].subject.status, 'absent');
  }

  const malformed = structuredClone(dataset);
  malformed.claims[0].provenance.feature_value = [{ code: 'MONETARY_THRESHOLD', text: 'subject to an uncaptured monetary cap' }];
  const malformedResponse = calculateMarketStats(
    buildMarketMetricBatchRequest([capex], { subjectDealId: 'qxo' }),
    malformed,
  );
  const malformedThreshold = malformedResponse.byRow[capex.rowKey].metrics[capex.metrics[3].metricKey];
  assert.equal(malformedThreshold.subject.status, 'present');
  assert.equal(malformedThreshold.subject.valueState, 'value_unknown');
});

test('definitions are compared by canonical defined-term identity', () => {
  const resolved = resolveMarketMetricRow({
    id: 'deal-specific-card-id',
    defined_term: 'Company Material Adverse Effect',
    defined_value: 'means any event...',
  }, { sectionId: '__definitions' });
  assert.equal(resolved.rowKey, 'definitions:company-material-adverse-effect');
  assert.equal(resolved.metrics[0].observation.presence.strategy, 'definition_term');
  assert.equal(resolved.metrics[0].observation.presence.term, 'Company Material Adverse Effect');
  assert.equal(resolved.metrics[0].presentation.role, 'prevalence');
});

test('duplicate and slug-colliding definitions retain globally unique metric identities', () => {
  const section = resolveMarketSectionRows(
    { id: '__definitions', title: 'Definitions', config: null },
    {
      definitions: [
        { id: 'd1', defined_term: 'Knowledge', defined_value: 'means actual knowledge' },
        { id: 'd2', defined_term: 'Knowledge', defined_value: 'means constructive knowledge' },
        { id: 'd3', defined_term: 'Knowledge / Parties', defined_value: 'means the listed persons' },
        { id: 'd4', defined_term: 'Knowledge Parties', defined_value: 'means the listed officers' },
      ],
    },
  );
  const request = buildMarketMetricBatchRequest(section);
  assert.equal(request.specs.length, 4);
  assert.equal(new Set(request.specs.map((metric) => metric.metricKey)).size, 4);
  assert.doesNotThrow(() => parseMarketStatsRequest(request, validateMarketMetricSpec));
});

test('no-sol notice periods use the explicit day-equivalent policy while triggers remain split', () => {
  const notice = resolveMarketMetricRow({ id: 'nosol-fiduciary-notice-period', label: 'Notice period' });
  const initial = resolveMarketMetricRow({ id: 'nosol-fiduciary-initial-match', label: 'Initial match period' });
  const hours = resolveMarketMetricRow({ id: 'nosol-noshop-notice-hours', label: 'Notice' });
  const intervening = resolveMarketMetricRow({ id: 'nosol-intervening-notice-period', label: 'Notice period' });

  assert.equal(notice.metrics[1].semantics.unit, 'days_equivalent');
  assert.equal(notice.metrics[1].semantics.calendarBasis, 'mixed');
  assert.deepEqual(notice.metrics[1].semantics.normalisation, { type: 'duration_to_days', hoursPerDay: 24 });
  assert.equal(hours.metrics[1].semantics.unit, 'elapsed_hours');
  assert.notEqual(notice.metrics[1].semantics.trigger, initial.metrics[1].semantics.trigger);
  assert.notEqual(notice.metrics[1].semantics.trigger, intervening.metrics[1].semantics.trigger);
  assert.notEqual(notice.metrics[1].metricKey, intervening.metrics[1].metricKey);
  assert.equal(notice.metrics[1].cohort.provisionFamily, 'NOSOL');
  assert.equal(notice.metrics[1].cohort.scope, 'provision_codes');
  assert.equal(notice.metrics[1].cohort.eligibility, 'family_present');
  assert.equal(notice.metrics[1].cohort.provisionCodes.includes('NOSOL-NOTICE'), false);
  assert.deepEqual(notice.metrics[1].observation.scope.provisionCodes, notice.metrics[1].cohort.provisionCodes);
});

test('feature adapter supplies presence and refuses to pool ambiguous registry days', () => {
  const resolved = resolveMarketMetricRow({
    id: 'custom-cure-period',
    label: 'Cure period',
    featureKey: 'curePeriod',
  }, { configId: 'termination-rights' });
  assert.equal(resolved.resolution, 'feature_registry');
  assert.equal(resolved.metrics[0].comparison.kind, 'presence');
  const value = resolved.metrics.find((metric) => metric.metricKey.endsWith('.value'));
  if (value?.comparison.status === 'non_comparable') {
    assert.equal(value.comparison.reason.code, 'ambiguous_time_basis');
  }
});

test('batch requests preserve several metrics under one row key', () => {
  const resolution = resolveMarketMetricRow({
    id: 'material-contracts-SUPPLIER-0',
    code: 'SUPPLIER',
    label: 'Supplier contracts',
    threshold: '$10,000,000',
  });
  const filters = { yearFrom: 2022, minValueUsd: 500000000 };
  const request = buildMarketMetricBatchRequest([resolution, resolution], {
    subjectDealId: 'subject-deal',
    filters,
  });
  assert.equal(request.contractVersion, 1);
  assert.equal(request.subjectDealId, 'subject-deal');
  assert.deepEqual(request.filters, filters);
  assert.equal(request.specs.length, 3);
  assert.equal(new Set(request.specs.map((spec) => spec.rowKey)).size, 1);

  const grouped = groupMarketMetricResults(request.specs.map((spec) => ({
    rowKey: spec.rowKey,
    metricKey: spec.metricKey,
    state: 'ready',
  })));
  assert.equal(grouped.get(resolution.rowKey).size, 3);
});

test('large market requests split on row boundaries and merge without coverage loss', () => {
  const specs = Array.from({ length: 767 }, (_, index) => ({
    rowKey: `row-${Math.floor(index / 2)}`,
    metricKey: `metric-${index}`,
  }));
  const request = { contractVersion: 1, subjectDealId: 'subject', filters: {}, specs };
  const batches = splitMarketMetricBatchRequest(request, 400);

  assert.deepEqual(batches.map((batch) => batch.specs.length), [400, 367]);
  const firstBatchRows = new Set(batches[0].specs.map((spec) => spec.rowKey));
  const secondBatchRows = new Set(batches[1].specs.map((spec) => spec.rowKey));
  assert.equal([...firstBatchRows].some((rowKey) => secondBatchRows.has(rowKey)), false);

  const responses = batches.map((batch, batchIndex) => ({
    cohort: { subjectDealId: 'subject' },
    dealDirectory: { [`deal-${batchIndex}`]: { dealId: `deal-${batchIndex}` } },
    byRow: Object.fromEntries([...new Set(batch.specs.map((spec) => spec.rowKey))].map((rowKey) => [rowKey, { batchIndex }])),
    errors: [],
  }));
  const merged = mergeMarketMetricBatchResponses(responses, request);
  assert.equal(merged.rowOrder.length, 384);
  assert.equal(Object.keys(merged.byRow).length, 384);
  assert.equal(merged.cohort.subjectDealId, 'subject');
  assert.deepEqual(Object.keys(merged.dealDirectory).sort(), ['deal-0', 'deal-1']);
});

test('large market requests keep cross-row conditional dependencies in one batch', () => {
  const makeSpec = (metricKey, rowKey, dependency = null) => ({
    rowKey,
    metricKey,
    ...(dependency ? { denominator: { conditionalOn: { metricKey: dependency, state: 'present' } } } : {}),
  });
  const specs = [makeSpec('parent', 'parent-row')];
  for (let index = 0; index < 399; index += 1) {
    specs.push(makeSpec(`filler-${index}`, `filler-row-${index}`));
  }
  specs.push(makeSpec('child', 'child-row', 'parent'));

  const batches = splitMarketMetricBatchRequest({ contractVersion: 1, specs }, 400);
  assert.equal(batches.every((batch) => batch.specs.length <= 400), true);
  assert.equal(batches.flatMap((batch) => batch.specs).length, specs.length);
  const dependencyBatch = batches.find((batch) => batch.specs.some((spec) => spec.metricKey === 'child'));
  assert.equal(dependencyBatch.specs.some((spec) => spec.metricKey === 'parent'), true);
});

test('batch splitting fails only when one dependency component exceeds the limit', () => {
  const specs = Array.from({ length: 401 }, (_, index) => ({
    rowKey: `row-${index}`,
    metricKey: `metric-${index}`,
    ...(index ? {
      denominator: { conditionalOn: { metricKey: `metric-${index - 1}`, state: 'present' } },
    } : {}),
  }));

  assert.throws(
    () => splitMarketMetricBatchRequest({ contractVersion: 1, specs }, 400),
    /dependency component.*exceeds the batch limit/,
  );
});

test('market batch pool bounds concurrency, retries locally, and reports each result', async () => {
  const requests = [0, 1, 2, 3, 4];
  const attempts = new Map();
  const completed = [];
  let active = 0;
  let maxActive = 0;

  const settled = await runMarketMetricBatchPool(requests, async (value) => {
    attempts.set(value, (attempts.get(value) || 0) + 1);
    active += 1;
    maxActive = Math.max(maxActive, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (value === 1 && attempts.get(value) === 1) throw new Error('transient');
      return value * 2;
    } finally {
      active -= 1;
    }
  }, {
    concurrency: 2,
    retries: 1,
    onSettled: (result, index) => completed.push([index, result.status]),
  });

  assert.equal(maxActive, 2);
  assert.equal(attempts.get(1), 2);
  assert.deepEqual(settled.map((result) => result.value), [0, 2, 4, 6, 8]);
  assert.deepEqual(completed.sort((left, right) => left[0] - right[0]), [
    [0, 'fulfilled'],
    [1, 'fulfilled'],
    [2, 'fulfilled'],
    [3, 'fulfilled'],
    [4, 'fulfilled'],
  ]);
});

test('batch metric keys are unique across dynamic IOC rows and conditional dependencies are included', () => {
  const first = resolveMarketMetricRow(
    { id: 'ioc-aff-11111111-1111-4111-8111-111111111111-0', label: 'Conduct business in ordinary course' },
    { configId: 'ioc-exceptions' },
  );
  const second = resolveMarketMetricRow(
    { id: 'ioc-aff-22222222-2222-4222-8222-222222222222-1', label: 'Maintain permits and licences' },
    { configId: 'ioc-exceptions' },
  );
  const parentSameLabel = resolveMarketMetricRow(
    { id: 'ioc-aff-33333333-3333-4333-8333-333333333333-0', label: 'Conduct business in ordinary course' },
    { configId: 'parent-ioc-exceptions' },
  );
  const exceptions = resolveMarketMetricRow({ id: 'ioc-exceptions-affirmative', label: 'Exceptions to affirmative covenants' });
  const request = buildMarketMetricBatchRequest([first, second, parentSameLabel, exceptions]);
  assert.equal(new Set(request.specs.map((spec) => spec.metricKey)).size, request.specs.length);
  const available = new Set(request.specs.map((spec) => spec.metricKey));
  for (const spec of request.specs) {
    const dependency = spec.denominator?.conditionalOn?.metricKey;
    if (dependency) assert.equal(available.has(dependency), true, `missing ${dependency}`);
  }
});

test('coverage audit reports unidentified rows instead of fabricating prevalence', () => {
  const good = { id: 'source-backed', label: 'Source backed', sourceCard: { id: 'c1', provision_subtype: 'MISC-ASSIGNMENT' } };
  const gap = { id: 'computed-only', label: 'Computed only' };
  assert.throws(() => assertMarketMetricCoverage([good, gap]), /no comparable metric/);
  const audit = assertMarketMetricCoverage([good, gap], { requireComparable: false, requirePresence: false });
  assert.equal(audit.rowCount, 2);
  assert.equal(audit.nonComparableRowCount, 1);
  assert.equal(audit.gaps[0].rowKey, 'computed-only');
});

test('section resolver expands definitions, grouped bodies and generic configs', () => {
  const definitions = resolveMarketSectionRows(
    { id: '__definitions', title: 'Definitions', config: null },
    { definitions: [{ defined_term: 'Knowledge', defined_value: 'means...' }] },
  );
  assert.equal(definitions.rowCount, 1);
  assert.equal(definitions.rows[0].rowKey, 'definitions:knowledge');

  const termination = resolveMarketSectionRows({
    id: 'termination-rights',
    title: 'Termination Rights',
    config: {
      id: 'termination-rights',
      selectRows: () => [{
        id: 'termination-rights-body',
        groups: [{ id: 'timing', rows: [{ id: 'termination-rights-outside', label: 'Outside date', featureKeys: ['outsideDate'] }] }],
      }],
    },
  }, { cards: [] });
  assert.equal(termination.rowCount, 1);
  assert.equal(termination.rows[0].row.id, 'termination-rights-outside');

  const generic = resolveMarketSectionRows({
    id: 'misc-boilerplate',
    title: 'Miscellaneous',
    config: {
      id: 'misc-boilerplate',
      selectRows: () => [
        { id: 'misc-heading', label: 'Presentation heading', marketSkip: true },
        { id: 'misc-assignment', label: 'Assignment', sourceCard: { id: 'a1', provision_subtype: 'MISC-ASSIGNMENT' } },
      ],
    },
  }, { cards: [] });
  assert.equal(generic.rowCount, 1);
  assert.equal(generic.rows[0].resolution, 'card_presence');
});

test('section resolver expands live no-sol and IOC custom group builders', () => {
  const nosolDeal = {
    cards: [{
      id: 'n1',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-RECOMMEND',
      short_title: 'Change of recommendation',
      primary_quote: 'The Company shall give Parent four business days notice before changing its recommendation.',
      features: { noticePeriod: 4 },
    }],
  };
  const nosol = resolveMarketSectionRows({ id: 'nosol', title: 'No-Solicitation', config: { id: 'nosol' } }, nosolDeal);
  assert.ok(nosol.rows.some((entry) => entry.row.id === 'nosol-fiduciary-notice-period'));

  const iocDeal = {
    cards: [{
      id: 'i1',
      provision_type: 'COVENANT_INTERIM_OPERATING',
      provision_subtype: 'IOC-ORDINARY',
      short_title: 'Ordinary course',
      section_ref: '5.1(a)',
      primary_quote: 'The Company shall conduct its business in the ordinary course.',
      features: {
        positiveObligations: [{
          obligation: 'conduct its business in the ordinary course',
          appliesTo: [{ code: 'BUSINESS', label: 'Business' }],
          efforts_standard: 'FLAT',
        }],
      },
    }],
  };
  const ioc = resolveMarketSectionRows({ id: 'ioc-exceptions', title: 'Interim Operating Covenants', config: { id: 'ioc-exceptions' } }, iocDeal);
  const affirmative = ioc.rows.find((entry) => String(entry.row.id).startsWith('ioc-aff-'));
  assert.ok(affirmative);
  assert.equal(affirmative.metrics.length, 3);
});

test('section resolver expands the live closing-conditions grouped body', () => {
  const reviewDeal = {
    cards: [{
      id: 'c1',
      provision_type: 'CLOSING_CONDITION',
      provision_subtype: 'COND-M-STOCKHOLDER',
      short_title: 'Stockholder Approval',
      primary_quote: 'The Company Stockholder Approval shall have been obtained.',
      features: { stockholderApprovalCondition: true },
    }],
  };
  const section = resolveMarketSectionRows({ id: 'conditions', title: 'Closing Conditions', config: { id: 'conditions' } }, reviewDeal);
  assert.equal(section.rowCount, 1);
  assert.match(section.rows[0].row.id, /^conditions-m-/);
  assert.equal(section.rows[0].resolution, 'semantic_row');
  assert.ok(section.rows[0].metrics.some((metric) => metric.comparison.kind === 'categorical'));
});

test('QXO antitrust, S-4, listing and certificate conditions expose their operative terms', () => {
  const reviewDeal = {
    cards: [
      {
        id: 'reg', provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-M-REG', short_title: 'Antitrust',
        primary_quote: 'The HSR waiting period shall have expired and scheduled approvals shall have been obtained.',
        features: {
          mainCondition: 'HSR waiting period must expire and scheduled governmental approvals must be obtained.',
          hsrClearance: true,
          antitrustApprovals: [
            { code: 'HSR', label: 'HSR Act waiting period expired or terminated' },
            { code: 'SCHEDULED_APPROVALS', label: 'Other scheduled regulatory approvals obtained' },
          ],
        },
      },
      {
        id: 's4', provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-M-S4', short_title: 'Form S-4 Effectiveness',
        primary_quote: 'The Form S-4 shall be effective and no stop order shall be in effect.',
        features: { mainCondition: 'The Form S-4 must be declared effective, with no SEC stop order.' },
      },
      {
        id: 'listing', provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-M-LISTING', short_title: 'Stock Exchange Listing',
        primary_quote: 'Parent shares shall be approved for NYSE listing, subject to official notice of issuance.',
        features: { mainCondition: 'Parent shares must be approved for NYSE listing, subject to official notice of issuance.' },
      },
      {
        id: 'buyer-cert', provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-B-CERT', short_title: "Officer's Certificate (Target)",
        primary_quote: 'Parent shall receive an officer certificate covering covenant compliance, rep bring-down and no MAE.',
        features: { certificationRequired: true, mainCondition: 'Certificate covers covenant compliance, rep bring-down and no MAE.' },
      },
      {
        id: 'seller-cert', provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-S-CERT', short_title: "Officer's Certificate (Buyer)",
        primary_quote: 'The Company shall receive an officer certificate covering the closing conditions.',
        features: { certificationRequired: true, mainCondition: 'Parent officer certificate confirms the closing conditions.' },
      },
    ],
  };
  const section = resolveMarketSectionRows({ id: 'conditions', title: 'Closing Conditions', config: { id: 'conditions' } }, reviewDeal);
  const qxoRows = section.rows.filter((entry) => /Antitrust|S-4|Stock Exchange|Officer/.test(entry.label));

  assert.equal(qxoRows.length, 5);
  assert.ok(qxoRows.every((entry) => entry.resolution === 'semantic_row'));
  assert.ok(qxoRows.every((entry) => entry.metrics.some((metric) => metric.comparison.kind !== 'presence')));
  assert.deepEqual(
    qxoRows.find((entry) => entry.label === 'Antitrust / Regulatory Clearance').metrics.slice(1).map((metric) => metric.label),
    ['Required approvals', 'HSR clearance condition'],
  );
});

test('accuracy-of-reps conditions expose each bring-down tier as its own presence distribution', () => {
  const reviewDeal = {
    cards: [{
      id: 'accuracy',
      provision_type: 'CLOSING_CONDITION',
      provision_subtype: 'COND-B-REP',
      short_title: 'Accuracy of representations',
      primary_quote: 'The representations shall be true at closing.',
      features: {
        bringDownTiers: [
          { standard: 'ALL_RESPECTS', reps_covered: 'Fundamental representations' },
          { standard: 'MAT_ALL_MATERIAL', reps_covered: 'All other representations' },
          { standard: 'MAE_QUALIFIED', reps_covered: 'Specified representations' },
        ],
      },
    }],
  };
  const section = resolveMarketSectionRows({ id: 'conditions', title: 'Closing Conditions', config: { id: 'conditions' } }, reviewDeal);
  const accuracy = section.rows.find((entry) => entry.row.id === 'conditions-b-Reps Bring-Down');
  assert.equal(accuracy.resolution, 'semantic_row');
  assert.deepEqual(accuracy.metrics.slice(1).map((metric) => metric.label), [
    'True in all respects',
    'True in all material respects',
    'True except where failure would not cause an MAE',
  ]);
  assert.ok(accuracy.metrics.slice(1).every((metric) => (
    metric.comparison.kind === 'presence' && metric.presentation.role === 'treatment'
  )));
});

test('stable row keys never retain deal UUIDs or display indices', () => {
  const key = stableMarketRowKey({
    id: 'equity-awards-7dc3a05f-b170-4d59-a255-b7103cca16e1-4',
    instrumentCode: 'RSU',
    label: 'Restricted stock units',
  });
  assert.equal(key, 'equity-awards:rsu');
});
