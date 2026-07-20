const test = require('node:test');
const assert = require('node:assert/strict');

const { aggregateMetric } = require('../lib/row-market-stats/aggregate');
const { cardMatchesFamily } = require('../lib/row-market-stats/families');
const { indexDataset } = require('../lib/row-market-stats/observations');
const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { collectSourceRequirements, loadPagedRows } = require('../lib/row-market-stats/source');

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
    { value: 'YES', count: 2, rate: 2 / 3 },
    { value: 'NO', count: 1, rate: 1 / 3 },
  ]);
  assert.equal(categorical.coverage.comparableCount, 3);

  const multi = aggregateMetric(spec('multi_select'), [
    entry(deal('d1'), 'present', [{ value: 'A' }, { value: 'A' }, { value: 'B' }]),
    entry(deal('d2'), 'present', [{ value: 'B' }, { value: 'C' }]),
    entry(deal('d3'), 'present', []),
  ]);
  assert.equal(multi.distribution.multiSelect, true);
  assert.deepEqual(multi.distribution.values, [
    { value: 'B', count: 2, rate: 2 / 3 },
    { value: 'A', count: 1, rate: 1 / 3 },
    { value: 'C', count: 1, rate: 1 / 3 },
  ]);
  assert.equal(multi.coverage.valueUnknownCount, 1);
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

test('material-contract bucket thresholds use their own structured threshold and cadence', () => {
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
      cadence: 'annual',
      requiredDimensions: ['cadence'],
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
        verbatim: 'Customer contracts above $10,000,000 per annum',
        provenance: { feature_value: { code: 'CUSTOMER', threshold: '$10,000,000', text: 'payments in excess of $10,000,000 per annum' } },
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
  const cohort = result.distribution.normalised.cohorts[0];
  assert.equal(cohort.basis, 'headline_transaction_value');
  assert.equal(cohort.percent.stats.median, 0.05);
  assert.equal(cohort.percent.stats.n, 1);
  assert.deepEqual(result.distribution.normalised.exclusions, [{ reason: 'incompatible_cadence', count: 1 }]);
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
    { value: 'CRE', count: 1, rate: 1 },
  ]);
  assert.equal(row.metrics['ioc.affirmative.efforts'].subject.value, 'RBE');
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

test('definition presence uses exact canonical terms, not substring matches', () => {
  const definition = spec('presence', {
    metricKey: 'definition.knowledge',
    observation: {
      presence: { strategy: 'definition_term', term: 'Knowledge', missingState: 'absent' },
    },
  });
  const dataset = {
    deals: [deal('exact'), deal('longer')],
    cards: [
      { deal_id: 'exact', excerpt_id: 'e1', provision_type: 'DEFINITION', defined_term: '“Knowledge”', short_title: 'Knowledge' },
      { deal_id: 'longer', excerpt_id: 'e2', provision_type: 'DEFINITION', defined_term: 'Knowledge Parties', short_title: 'Knowledge Parties' },
    ],
    claims: [],
  };
  const result = calculateMarketStats({
    contractVersion: 1, subjectDealId: null, filters: {}, specs: [definition],
  }, dataset).byRow['row-1'].metrics['definition.knowledge'];
  assert.equal(result.coverage.presentCount, 1);
  assert.equal(result.coverage.absentCount, 1);
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
