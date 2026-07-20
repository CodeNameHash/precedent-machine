import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARKET_METRIC_CONTRACT_VERSION,
  assertMarketMetricCoverage,
  buildMarketMetricBatchRequest,
  comparableMetric,
  groupMarketMetricResults,
  mergeMarketMetricBatchResponses,
  resolveMarketMetricRow,
  resolveMarketSectionRows,
  splitMarketMetricBatchRequest,
  stableMarketRowKey,
  validateMarketMetricResult,
  validateMarketMetricSpec,
} from '../lib/market-metrics/index.js';
import rowMarketStatsService from '../lib/row-market-stats/service.js';

const { calculateMarketStats } = rowMarketStatsService;

const allDeals = { scope: 'all_deals', eligibility: 'all_deals' };
const denominator = { prevalence: 'eligible_deals', distribution: 'present_deals' };

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
  assert.equal(one.rowKey, 'material-contracts:customer:annual');
  assert.equal(two.rowKey, 'material-contracts:customer:aggregate');
  assert.equal(three.rowKey, one.rowKey);
  assert.notEqual(two.metrics[0].metricKey, one.metrics[0].metricKey);
  assert.equal(one.resolution, 'manifest');
  assert.deepEqual(one.metrics.map((metric) => metric.comparison.kind), ['presence', 'money']);
  assert.equal(one.metrics[1].observation.presence.itemCode, 'CUSTOMER');
  assert.deepEqual(one.metrics[1].observation.value.featureKeys, ['materialContractsBuckets']);
  assert.equal(one.metrics[1].observation.value.path, 'threshold');
  assert.equal(one.metrics[1].semantics.cadence, 'annual');
  assert.equal(one.metrics[1].semantics.normalisation.basisPolicy, 'stratify_by_basis');
  assert.equal(one.metrics[1].denominator.conditionalOn.metricKey, one.metrics[0].metricKey);
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
  assert.equal(threshold.semantics.unit, 'usd');
  assert.equal(threshold.semantics.normalisation.type, 'percent_of_deal_value');
  assert.equal(threshold.semantics.normalisation.basisPolicy, 'stratify_by_basis');

  const liveGroupedShape = resolveMarketMetricRow({
    id: 'ioc-neg-4.1-IOC-MERGE',
    label: 'Mergers and acquisitions',
  });
  assert.deepEqual(liveGroupedShape.metrics.map((metric) => metric.comparison.kind), ['presence', 'multi_select', 'multi_select', 'money']);
  assert.deepEqual(liveGroupedShape.metrics[0].observation.presence.provisionCodes, ['IOC-MERGE']);
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
});

test('no-sol notice clocks remain split by trigger and unit', () => {
  const notice = resolveMarketMetricRow({ id: 'nosol-fiduciary-notice-period', label: 'Notice period' });
  const initial = resolveMarketMetricRow({ id: 'nosol-fiduciary-initial-match', label: 'Initial match period' });
  const hours = resolveMarketMetricRow({ id: 'nosol-noshop-notice-hours', label: 'Notice' });
  const intervening = resolveMarketMetricRow({ id: 'nosol-intervening-notice-period', label: 'Notice period' });

  assert.equal(notice.metrics[1].semantics.unit, 'business_days');
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
  assert.equal(request.specs.length, 2);
  assert.equal(new Set(request.specs.map((spec) => spec.rowKey)).size, 1);

  const grouped = groupMarketMetricResults(request.specs.map((spec) => ({
    rowKey: spec.rowKey,
    metricKey: spec.metricKey,
    state: 'ready',
  })));
  assert.equal(grouped.get(resolution.rowKey).size, 2);
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
    byRow: Object.fromEntries([...new Set(batch.specs.map((spec) => spec.rowKey))].map((rowKey) => [rowKey, { batchIndex }])),
    errors: [],
  }));
  const merged = mergeMarketMetricBatchResponses(responses, request);
  assert.equal(merged.rowOrder.length, 384);
  assert.equal(Object.keys(merged.byRow).length, 384);
  assert.equal(merged.cohort.subjectDealId, 'subject');
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
      selectRows: () => [{ id: 'misc-assignment', label: 'Assignment', sourceCard: { id: 'a1', provision_subtype: 'MISC-ASSIGNMENT' } }],
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
  assert.equal(section.rows[0].resolution, 'card_presence');
});

test('stable row keys never retain deal UUIDs or display indices', () => {
  const key = stableMarketRowKey({
    id: 'equity-awards-7dc3a05f-b170-4d59-a255-b7103cca16e1-4',
    instrumentCode: 'RSU',
    label: 'Restricted stock units',
  });
  assert.equal(key, 'equity-awards:rsu');
});
