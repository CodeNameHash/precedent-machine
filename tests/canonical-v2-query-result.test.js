const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosMaterialContractsServingFixture } = require('../__fixtures__/canonical-v2/landos-material-contracts-row');
const { buildLandosIocCapexServingFixture } = require('../__fixtures__/canonical-v2/landos-ioc-capex-row');
const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { buildMultiDealCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/multi-deal-candidate-release');
const { buildQueryCohortSummary } = require('../__fixtures__/canonical-v2/query-cohort-summary');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileFixtureContract,
  compileFixtureContractV2,
  compileFixtureContractV3,
  compileFixtureContractV4,
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const {
  compileCanonicalActiveQueryRequest,
  compileCanonicalQueryRequest,
  projectSharedServingRowRecord,
  queryCanonicalResultPage,
  resolveActiveQueryPage,
  validateCanonicalQueryCohortSummary,
} = require('../lib/canonical-v2/query-result');

const namespaceId = contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture');

function requestFor(row, overrides = {}) {
  const body = row.canonical_result;
  const market = body.market_context;
  return {
    serving_namespace_id: namespaceId,
    corpus_release_id: row.corpus_release_id,
    contract_fingerprint: row.provenance.contract_fingerprint,
    intent: 'MARKET_RANGE',
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    concept_key: body.concept_key,
    party: body.party,
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
    ...overrides,
  };
}

function resultFor(params, rows, overrides = {}) {
  return {
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V2',
    cache_state: 'MISS',
    serving_namespace_id: params.p_serving_namespace_id,
    corpus_release_id: params.p_corpus_release_id,
    contract_fingerprint: params.p_contract_fingerprint,
    query_semantics_digest: params.p_query_semantics_digest,
    total_count: rows.length,
    page_count: rows.length,
    cohort_summary: buildQueryCohortSummary({ params, rows }),
    rows,
    next_cursor: null,
    ...overrides,
  };
}

class MemoryCache {
  constructor() {
    this.values = new Map();
    this.writes = [];
  }

  async get(key) {
    return this.values.get(key) || null;
  }

  async set(key, value, ttl) {
    this.values.set(key, value);
    this.writes.push({ key, ttl });
  }
}

function reverseFeeBody(overrides = {}) {
  return {
    intent: 'MARKET_RANGE',
    metric_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    metric_version: 1,
    concept_key: 'TERMF-REVERSE',
    party: { role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' },
    filters: {},
    selected_columns: null,
    column_filters: {},
    page_size: 25,
    cursor: null,
    ...overrides,
  };
}

test('active query selects a publishable frozen contract that supports the requested metric', () => {
  const sellerRow = buildLandosTerminationFeeServingFixture().row;
  const sellerBody = requestFor(sellerRow);
  for (const key of ['serving_namespace_id', 'corpus_release_id', 'contract_fingerprint']) delete sellerBody[key];
  assert.equal(
    compileCanonicalActiveQueryRequest(sellerBody).contract_fingerprint,
    compileFixtureContract().fingerprint,
  );

  const buyer = compileCanonicalActiveQueryRequest(reverseFeeBody());
  assert.equal(buyer.contract_fingerprint, compileFixtureContractV4().fingerprint);
  assert.deepEqual(
    buyer.selected_columns,
    ['deal', 'buyer', 'percent_of_deal_value', 'raw_value', 'fee_side', 'payer', 'payee', 'triggers', 'source'],
  );
  assert.equal(buyer.basis_key, 'PERCENT_OF_DEAL_VALUE:HEADLINE_TRANSACTION_VALUE:USD');
});

test('pinned buyer-fee requests require the corrected F4 trigger contract', () => {
  const physical = {
    serving_namespace_id: namespaceId,
    corpus_release_id: contentId('CORPUS_RELEASE/V1', 'reverse-fee-release'),
    ...reverseFeeBody(),
  };
  assert.equal(
    compileCanonicalQueryRequest({
      ...physical,
      contract_fingerprint: compileFixtureContractV4().fingerprint,
    }).contract_fingerprint,
    compileFixtureContractV4().fingerprint,
  );
  for (const contract of [
    compileFixtureContract(),
    compileFixtureContractV2(),
    compileFixtureContractV3(),
  ]) {
    assert.throws(
      () => compileCanonicalQueryRequest({ ...physical, contract_fingerprint: contract.fingerprint }),
      /does not support this governed metric and concept/,
    );
  }
});

test('F5 pinned queries preserve governed approximate denominator precision', async () => {
  const contract = compileFixtureContractV5();
  const row = buildLandosIocCapexServingFixture({ contractBundle: contract }).row;
  const request = requestFor(row);
  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({ data: resultFor(params, [row]), error: null });
    },
  };

  const response = await queryCanonicalResultPage({ client, request });

  assert.equal(response.request.contract_fingerprint, contract.fingerprint);
  assert.equal(response.result.contract_fingerprint, contract.fingerprint);
  assert.equal(response.result.rows[0].display_metadata.denominator_precision, 'APPROXIMATE');
  assert.equal(response.result.cohort_summary.counts.approximate_result_rows, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_query_page_v2');
});

test('active query validation accepts an F5 release-declared serving contract', () => {
  const contract = compileFixtureContractV5();
  const row = buildLandosIocCapexServingFixture({ contractBundle: contract }).row;
  const logical = requestFor(row);
  for (const key of ['serving_namespace_id', 'corpus_release_id', 'contract_fingerprint']) {
    delete logical[key];
  }
  const request = compileCanonicalActiveQueryRequest(logical);
  const summaryParams = {
    p_query_semantics_digest: request.query_semantics_digest,
    p_metric_key: request.metric_key,
    p_metric_version: request.metric_version,
    p_basis_key: request.basis_key,
  };
  const activeResult = {
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V2',
    cache_state: 'MISS',
    pointer_id: contentId('ACTIVE_POINTER/V1', 'f5-release-declared'),
    serving_namespace_id: namespaceId,
    corpus_release_id: row.corpus_release_id,
    contract_fingerprint: contract.fingerprint,
    query_semantics_digest: request.query_semantics_digest,
    total_count: 1,
    page_count: 1,
    cohort_summary: buildQueryCohortSummary({ params: summaryParams, rows: [row] }),
    rows: [row],
    next_cursor: null,
  };

  const resolved = resolveActiveQueryPage(activeResult, request);
  assert.equal(resolved.request.contract_fingerprint, contract.fingerprint);
  assert.equal(resolved.result.rows[0].row_serving_key, row.row_serving_key);
});

test('active buyer-fee query rejects an active release whose contract predates the metric', () => {
  const request = compileCanonicalActiveQueryRequest(reverseFeeBody());
  const summaryParams = {
    p_query_semantics_digest: request.query_semantics_digest,
    p_metric_key: request.metric_key,
    p_metric_version: request.metric_version,
    p_basis_key: request.basis_key,
  };
  const activeResult = {
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V2',
    cache_state: 'MISS',
    pointer_id: contentId('ACTIVE_POINTER/V1', 'buyer-fee'),
    serving_namespace_id: namespaceId,
    corpus_release_id: contentId('CORPUS_RELEASE/V1', 'active-before-f4'),
    contract_fingerprint: compileFixtureContractV2().fingerprint,
    query_semantics_digest: request.query_semantics_digest,
    total_count: 0,
    page_count: 0,
    cohort_summary: buildQueryCohortSummary({ params: summaryParams, rows: [] }),
    rows: [],
    next_cursor: null,
  };
  assert.throws(
    () => resolveActiveQueryPage(activeResult, request),
    (error) => error.code === 'INVALID_RESPONSE' && /does not support/.test(error.message),
  );
  assert.doesNotThrow(() => resolveActiveQueryPage({
    ...activeResult,
    contract_fingerprint: compileFixtureContractV4().fingerprint,
  }, request));
});

test('termination-fee query returns percentage, legal side, triggers and source in one bounded cached request', async () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({ data: resultFor(params, [row]), error: null });
    },
  };
  const request = requestFor(row, {
    filters: { buyer: 'AbbVie', sector: 'Biopharma' },
    column_filters: {
      min_percent_of_deal_value: '5',
      max_percent_of_deal_value: '6',
      fee_side: 'SELLER',
      payer_capacity: 'TARGET',
      payee_capacity: 'BUYER',
      trigger_code: 'ACQUISITION_PROPOSAL_TAIL',
    },
  });
  const cache = new MemoryCache();
  const first = await queryCanonicalResultPage({ client, cache, request });
  const second = await queryCanonicalResultPage({ client, cache, request });

  assert.equal(first.cache, 'MISS');
  assert.equal(second.cache, 'HIT');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_query_page_v2');
  assert.equal(calls[0].params.p_environment, 'staging');
  assert.equal(calls[0].params.p_min_canonical_value, '5');
  assert.equal(calls[0].params.p_trigger_code, 'ACQUISITION_PROPOSAL_TAIL');
  assert.equal(calls[0].params.p_payment_timing, null);
  assert.equal(calls[0].params.p_trigger_condition, null);
  assert.equal(cache.writes.length, 1);
  assert.equal(cache.writes[0].ttl, 3600);
  const cells = first.result.rows[0].cells;
  assert.equal(cells.percent_of_deal_value, '5.09090909');
  assert.equal(cells.raw_value, '$7,000,000');
  assert.deepEqual(cells.fee_side, { code: 'SELLER', label: 'Seller / target termination fee' });
  assert.deepEqual(cells.payer, { role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' });
  assert.deepEqual(cells.payee, { role: 'FEE_PAYEE', value: 'PARENT', capacity: 'BUYER' });
  assert.deepEqual(cells.triggers.map((trigger) => trigger.trigger_code), [
    'ACQUISITION_PROPOSAL_TAIL',
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'SUPERIOR_PROPOSAL_TERMINATION',
  ]);
  assert.equal(cells.source.detail_kind, 'CLAIM_EVIDENCE');
  assert.equal(Object.hasOwn(first.result.rows[0], 'shared_row'), false);
  assert.deepEqual(first.result.rows[0].display_metadata, { denominator_precision: null });
  assert.equal(first.result.cohort_summary.statistics.state, 'AVAILABLE');
  assert.equal(first.result.cohort_summary.statistics.median, '5.09090909');
  assert.equal(first.result.cohort_summary.counts.distinct_deals, 1);
  assert.deepEqual(
    first.result.cohort_summary.facets.trigger_codes.map((entry) => entry.value),
    [
      'ACQUISITION_PROPOSAL_TAIL',
      'CHANGE_IN_RECOMMENDATION_TERMINATION',
      'SUPERIOR_PROPOSAL_TERMINATION',
    ],
  );
  assert.ok(first.result.refinements.some((item) => item.column_key === 'triggers' && item.operator === 'CONTAINS'));
  assert.ok(first.result.refinements.some((item) => item.request_field === 'column_filters.payment_timing'));
  assert.ok(first.result.refinements.some((item) => item.request_field === 'column_filters.trigger_condition'));
});

test('Material Contracts query exposes the governed criterion primitives and relative threshold as refinable columns', async () => {
  const row = buildLandosMaterialContractsServingFixture().row;
  const request = requestFor(row, {
    selected_columns: [
      'deal',
      'percent_of_deal_value',
      'raw_value',
      'material_contract_criterion',
      'contract_scope',
      'cash_flow_direction',
      'measurement_period',
      'threshold_operator',
      'source',
    ],
    column_filters: {
      criterion_code: 'PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR',
      contract_scope_code: 'ANY_COMPANY_CONTRACT',
      cash_flow_direction_code: 'BY_OR_TO_COMPANY',
      measurement_period_code: 'FISCAL_2023_OR_ANY_SINGLE_FISCAL_YEAR_THEREAFTER',
      comparison_operator: 'GREATER_THAN',
    },
  });
  const client = {
    rpc(name, params) {
      assert.equal(params.p_criterion_code, 'PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR');
      return Promise.resolve({ data: resultFor(params, [row]), error: null });
    },
  };
  const response = await queryCanonicalResultPage({ client, request });
  const cells = response.result.rows[0].cells;

  assert.equal(cells.percent_of_deal_value, '0.07272727');
  assert.equal(cells.raw_value, '$100,000');
  assert.equal(cells.material_contract_criterion.code, 'PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR');
  assert.equal(cells.contract_scope.code, 'ANY_COMPANY_CONTRACT');
  assert.equal(cells.cash_flow_direction.code, 'BY_OR_TO_COMPANY');
  assert.equal(cells.measurement_period.code, 'FISCAL_2023_OR_ANY_SINGLE_FISCAL_YEAR_THEREAFTER');
  assert.equal(cells.threshold_operator.code, 'GREATER_THAN');
  assert.deepEqual(
    response.result.columns.map((column) => column.column_key),
    request.selected_columns,
  );
  assert.ok(response.result.refinements.some((item) => item.column_key === 'measurement_period'));
});

test('deal-value basis renders from the governed denominator without exposing the full serving row', async () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const request = requestFor(row, { selected_columns: ['deal', 'deal_value_basis'] });
  const client = {
    rpc(name, params) {
      return Promise.resolve({ data: resultFor(params, [row]), error: null });
    },
  };
  const response = await queryCanonicalResultPage({ client, request });
  const rendered = require('../lib/canonical-v2/legacy-query-mapper')
    .mapCanonicalRowForRender(response.result.rows[0], response.result.columns);
  assert.equal(rendered.error, null);
  assert.equal(
    rendered.cells.find((cell) => cell.column_key === 'deal_value_basis').display,
    'USD 137,500,000 · headline transaction value (denominator precision not captured)',
  );
  assert.equal(Object.hasOwn(response.result.rows[0], 'shared_row'), false);
});

test('no-shop notice query returns comparable days without discarding the source hours in one bounded cached request', async () => {
  const fixture = buildMultiDealCandidateReleaseFixture();
  const rows = fixture.release.shared_rows
    .filter((row) => row.row_kind === 'CANONICAL_RESULT'
      && row.canonical_result.market_context.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS')
    .sort((left, right) => left.governed_deal_key.localeCompare(right.governed_deal_key));
  const request = requestFor(rows[0]);
  const calls = [];
  const client = {
    rpc(name, params) {
      calls.push({ name, params });
      return Promise.resolve({ data: resultFor(params, rows), error: null });
    },
  };
  const cache = new MemoryCache();
  const first = await queryCanonicalResultPage({ client, cache, request });
  const second = await queryCanonicalResultPage({ client, cache, request });

  assert.equal(first.cache, 'MISS');
  assert.equal(second.cache, 'HIT');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_query_page_v2');
  assert.equal(calls[0].params.p_corpus_release_id, fixture.corpusReleaseId);
  assert.equal(calls[0].params.p_metric_key, 'NO_SHOP_NOTICE_PERIOD_DAYS');
  assert.equal(calls[0].params.p_basis_key, 'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL');
  assert.equal(calls[0].params.p_party_role, 'COVENANT_OBLIGOR');
  assert.equal(calls[0].params.p_party_value, 'COMPANY');
  assert.equal(calls[0].params.p_party_capacity, 'TARGET');
  assert.deepEqual(
    first.result.columns.map((column) => column.column_key),
    ['deal', 'buyer', 'party', 'duration', 'day_basis', 'trigger', 'source'],
  );
  assert.deepEqual(first.result.rows.map((row) => row.cells.buyer), ['AbbVie', 'QXO']);
  for (const row of first.result.rows) {
    assert.equal(row.cells.duration.canonical_value, '1');
    assert.equal(row.cells.duration.canonical_unit, 'DAYS');
    assert.equal(row.cells.duration.raw_magnitude, '24');
    assert.equal(row.cells.duration.raw_unit, 'HOURS');
    assert.match(row.cells.duration.raw_value, /twenty-four \(24\) hours/i);
    assert.deepEqual(row.cells.day_basis, { code: 'ELAPSED', label: 'Elapsed days' });
    assert.deepEqual(row.cells.trigger, {
      code: 'RECEIPT_OF_COMPETING_PROPOSAL',
      label: 'Receipt of competing proposal',
    });
    assert.deepEqual(row.cells.party, {
      role: 'COVENANT_OBLIGOR',
      value: 'COMPANY',
      capacity: 'TARGET',
    });
    assert.equal(row.cells.source.detail_kind, 'CLAIM_EVIDENCE');
  }
  assert.equal(first.result.refinements.some((item) => item.column_key === 'duration'), false);
  for (const row of first.result.rows) {
    const rendered = require('../lib/canonical-v2/legacy-query-mapper')
      .mapCanonicalRowForRender(row, first.result.columns);
    assert.equal(rendered.error, null);
    assert.equal(
      rendered.cells.find((cell) => cell.column_key === 'duration').display,
      '1 day (source: 24 hours)',
    );
  }
});

test('no-shop notice query refuses percentage-only columns and refinements', () => {
  const fixture = buildMultiDealCandidateReleaseFixture();
  const row = fixture.release.shared_rows.find((candidate) => candidate.row_kind === 'CANONICAL_RESULT'
    && candidate.canonical_result.market_context.metric_key === 'NO_SHOP_NOTICE_PERIOD_DAYS');

  assert.throws(
    () => compileCanonicalQueryRequest(requestFor(row, { selected_columns: ['deal', 'percent_of_deal_value'] })),
    /not governed/,
  );
  assert.throws(
    () => compileCanonicalQueryRequest(requestFor(row, {
      column_filters: { min_percent_of_deal_value: '0.5' },
    })),
    /percentage refinements require/,
  );
});

test('the offline release projection produces the exact typed physical query records', () => {
  const feeRow = buildLandosTerminationFeeServingFixture().row;
  const iocRow = buildLandosIocCapexServingFixture().row;
  const materialRow = buildLandosMaterialContractsServingFixture().row;
  const fee = projectSharedServingRowRecord({ row: feeRow, serving_namespace_id: namespaceId });
  const ioc = projectSharedServingRowRecord({ row: iocRow, serving_namespace_id: namespaceId });
  const material = projectSharedServingRowRecord({ row: materialRow, serving_namespace_id: namespaceId });

  assert.equal(fee.canonical_numeric_value, '5.09090909');
  assert.equal(fee.fee_side, 'SELLER');
  assert.equal(fee.payer_capacity, 'TARGET');
  assert.equal(fee.payee_capacity, 'BUYER');
  assert.deepEqual(fee.trigger_codes, [
    'ACQUISITION_PROPOSAL_TAIL',
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'SUPERIOR_PROPOSAL_TERMINATION',
  ]);
  assert.deepEqual(fee.payment_timings, [
    'CONCURRENT_WITH_TERMINATION',
    'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
    'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
  ]);
  assert.deepEqual(fee.trigger_conditions, [
    'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
    'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
    'PUBLIC_COMPANY_ALTERNATIVE_TRANSACTION_NOT_WITHDRAWN',
  ]);
  assert.equal(ioc.canonical_numeric_value, '0.07272727');
  assert.equal(compileCanonicalQueryRequest(requestFor(iocRow)).selected_columns.includes('percent_of_deal_value'), true);
  assert.equal(material.canonical_numeric_value, '0.07272727');
  assert.equal(material.criterion_code, 'PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR');
  assert.equal(material.measurement_period_code, 'FISCAL_2023_OR_ANY_SINGLE_FISCAL_YEAR_THEREAFTER');
  assert.equal(material.canonical_payload, materialRow);
  assert.equal(material.canonical_payload_digest, materialRow.canonical_payload_digest);
});

test('release, selected columns, refinements, page size and keyset cursor have the correct identities', () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const base = compileCanonicalQueryRequest(requestFor(row));
  const columns = compileCanonicalQueryRequest(requestFor(row, { selected_columns: ['deal', 'triggers'] }));
  const refined = compileCanonicalQueryRequest(requestFor(row, { column_filters: { fee_side: 'SELLER' } }));
  const pageSize = compileCanonicalQueryRequest(requestFor(row, { page_size: 10 }));
  const cursor = compileCanonicalQueryRequest(requestFor(row, {
    cursor: { governed_deal_key: row.governed_deal_key, row_serving_key: row.row_serving_key },
  }));
  const release = compileCanonicalQueryRequest(requestFor(row, {
    corpus_release_id: contentId('CORPUS_RELEASE/V1', 'later-release'),
  }));

  assert.equal(base.query_semantics_digest, columns.query_semantics_digest);
  assert.equal(base.cache_key, columns.cache_key);
  assert.notEqual(base.query_semantics_digest, refined.query_semantics_digest);
  assert.equal(base.query_semantics_digest, pageSize.query_semantics_digest);
  assert.equal(base.query_semantics_digest, cursor.query_semantics_digest);
  assert.notEqual(base.cache_key, pageSize.cache_key);
  assert.notEqual(base.cache_key, cursor.cache_key);
  assert.notEqual(base.query_semantics_digest, release.query_semantics_digest);
  assert.notEqual(base.cache_key, release.cache_key);
});

test('query request and response fail closed on unsupported fields, cross-metric refinements and broad or out-of-scope rows', async () => {
  const feeRow = buildLandosTerminationFeeServingFixture().row;
  const materialRow = buildLandosMaterialContractsServingFixture().row;
  assert.throws(
    () => compileCanonicalQueryRequest({ ...requestFor(feeRow), observations: [] }),
    /fields do not match/,
  );
  assert.throws(
    () => compileCanonicalQueryRequest(requestFor(feeRow, { selected_columns: ['material_contract_criterion'] })),
    /not governed/,
  );
  assert.throws(
    () => compileCanonicalQueryRequest(requestFor(materialRow, { column_filters: { fee_side: 'SELLER' } })),
    /fee refinements require/,
  );
  assert.throws(
    () => compileCanonicalQueryRequest(requestFor(materialRow, {
      column_filters: { payment_timing: 'CONCURRENT_WITH_TERMINATION' },
    })),
    /fee refinements require/,
  );
  assert.throws(
    () => compileCanonicalQueryRequest(requestFor(feeRow, {
      column_filters: {
        trigger_code: 'ACQUISITION_PROPOSAL_TAIL',
        payment_timing: 'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
      },
    })),
    /Only one trigger-pathway refinement/,
  );

  const broadClient = {
    rpc(name, params) {
      return Promise.resolve({ data: { ...resultFor(params, [feeRow]), claims: [] }, error: null });
    },
  };
  await assert.rejects(
    queryCanonicalResultPage({ client: broadClient, request: requestFor(feeRow) }),
    (error) => error.code === 'INVALID_RESPONSE',
  );

  const wrongMetricClient = {
    rpc(name, params) {
      return Promise.resolve({ data: resultFor(params, [materialRow]), error: null });
    },
  };
  await assert.rejects(
    queryCanonicalResultPage({ client: wrongMetricClient, request: requestFor(feeRow) }),
    (error) => error.code === 'INVALID_RESPONSE' && /out-of-scope/.test(error.message),
  );
});

test('query database failures are not retried', async () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  let calls = 0;
  const client = {
    rpc() {
      calls += 1;
      return Promise.resolve({ data: null, error: { message: 'capacity' } });
    },
  };
  await assert.rejects(
    queryCanonicalResultPage({ client, request: requestFor(row) }),
    (error) => error.code === 'DATA_SOURCE_ERROR',
  );
  assert.equal(calls, 1);
});

test('query cohort summary fails closed on malformed counts, statistics, groups and semantics', () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const request = compileCanonicalQueryRequest(requestFor(row));
  const params = {
    p_query_semantics_digest: request.query_semantics_digest,
    p_metric_key: request.metric_key,
    p_metric_version: request.metric_version,
    p_basis_key: request.basis_key,
  };
  const summary = buildQueryCohortSummary({ params, rows: [row] });
  const result = { total_count: 1 };

  assert.equal(validateCanonicalQueryCohortSummary(summary, result, request), summary);
  for (const invalid of [
    { ...summary, query_semantics_digest: 'f'.repeat(64) },
    { ...summary, counts: { ...summary.counts, result_rows: 2 } },
    {
      ...summary,
      statistics: {
        ...summary.statistics,
        state: 'NOT_DEFINED_MULTI_VALUE_PER_DEAL',
        derivation_version: null,
        n_deals: 0,
      },
    },
    {
      ...summary,
      facets: {
        ...summary.facets,
        trigger_codes: [...summary.facets.trigger_codes, summary.facets.trigger_codes[0]],
      },
    },
  ]) {
    assert.throws(
      () => validateCanonicalQueryCohortSummary(invalid, result, request),
      (error) => error.code === 'INVALID_RESPONSE',
    );
  }
});

test('query cohort summary exposes typed non-statistical states without plausible percentiles', () => {
  const row = buildLandosTerminationFeeServingFixture().row;
  const request = compileCanonicalQueryRequest(requestFor(row));
  const base = {
    schema_version: 'CANONICAL_QUERY_COHORT_SUMMARY/V1',
    scope: 'FULL_FILTERED_COMPARABLE_QUERY_RESULTS',
    query_semantics_digest: request.query_semantics_digest,
    metric_key: request.metric_key,
    metric_version: request.metric_version,
    basis_key: request.basis_key,
    facets: { trigger_codes: [], payment_timings: [], trigger_conditions: [] },
  };
  const unavailableStatistics = (state) => ({
    state,
    derivation_version: null,
    n_deals: 0,
    min: null,
    p25: null,
    median: null,
    mean: null,
    p75: null,
    max: null,
  });
  const cases = [
    {
      state: 'NO_VALUES',
      result: { total_count: 0 },
      counts: {
        result_rows: 0,
        distinct_deals: 0,
        numeric_result_rows: 0,
        numeric_distinct_deals: 0,
        multi_value_deals: 0,
        approximate_result_rows: 0,
        approximate_distinct_deals: 0,
      },
    },
    {
      state: 'INCOMPLETE_NUMERIC_DOMAIN',
      result: { total_count: 1 },
      counts: {
        result_rows: 1,
        distinct_deals: 1,
        numeric_result_rows: 0,
        numeric_distinct_deals: 0,
        multi_value_deals: 0,
        approximate_result_rows: 0,
        approximate_distinct_deals: 0,
      },
    },
    {
      state: 'NOT_DEFINED_MULTI_VALUE_PER_DEAL',
      result: { total_count: 2 },
      counts: {
        result_rows: 2,
        distinct_deals: 1,
        numeric_result_rows: 2,
        numeric_distinct_deals: 1,
        multi_value_deals: 1,
        approximate_result_rows: 0,
        approximate_distinct_deals: 0,
      },
    },
  ];
  for (const item of cases) {
    assert.doesNotThrow(() => validateCanonicalQueryCohortSummary({
      ...base,
      counts: item.counts,
      statistics: unavailableStatistics(item.state),
    }, item.result, request));
  }
});

test('the staging query projection is indexed, keyset-paged and served by one bounded SQL RPC', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const source = fs.readFileSync('lib/canonical-v2/query-result.js', 'utf8');
  const queryStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_query_page_v2');
  const activeStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_query_page(');
  const queryFunction = sql.slice(queryStart, activeStart);

  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.shared_serving_rows/);
  assert.match(sql, /canonical_numeric_value numeric/);
  assert.match(sql, /trigger_codes text\[\]/);
  assert.match(sql, /payment_timings text\[\]/);
  assert.match(sql, /trigger_conditions text\[\]/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonical_v2_query_page/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonical_v2_active_query_page/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET statement_timeout = '2500ms'/);
  assert.match(queryFunction, /p_page_size IS NULL/);
  assert.match(queryFunction, /p_metric_version IS NULL/);
  assert.match(sql, /LIMIT p_page_size \+ 1/);
  assert.match(sql, /\(row\.governed_deal_key, row\.row_serving_key\) > \(p_after_governed_deal_key, p_after_row_serving_key\)/);
  assert.match(sql, /row\.trigger_codes @> ARRAY\[p_trigger_code\]::text\[\]/);
  assert.match(sql, /row\.payment_timings @> ARRAY\[p_payment_timing\]::text\[\]/);
  assert.match(sql, /row\.trigger_conditions @> ARRAY\[p_trigger_condition\]::text\[\]/);
  assert.match(sql, /row\.adviser_firms @> ARRAY\[p_adviser_either\]::text\[\]/);
  assert.match(sql, /row\.lawyers @> ARRAY\[p_lawyer_either\]::text\[\]/);
  assert.match(sql, /canonical_v2_shared_rows_payment_timings_idx[\s\S]*USING gin \(payment_timings\)/);
  assert.match(sql, /canonical_v2_shared_rows_trigger_conditions_idx[\s\S]*USING gin \(trigger_conditions\)/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS row_kind text\s+GENERATED ALWAYS AS \(canonical_payload->>'row_kind'\) STORED/);
  assert.match(sql, /canonical_result,components,0,denominator,precision/);
  assert.match(sql, /incomplete_canonical_result,components,0,denominator,precision/);
  assert.match(sql, /canonical_result,components,0,claim_attributes,denominator_precision/);
  assert.match(sql, /incomplete_canonical_result,components,0,claim_attributes,denominator_precision/);
  assert.match(sql, /denominator_precision IN \('EXACT', 'APPROXIMATE'\)/);
  assert.match(sql, /canonical_v2_shared_serving_rows_f5_money_precision_check/);
  assert.equal(
    (sql.match(/CREATE INDEX[\s\S]*?;/gi) || [])
      .some((statement) => /\bdenominator_precision\b/i.test(statement)),
    false,
  );
  assert.match(sql, /canonical_v2_shared_rows_query_v2_idx[\s\S]*WHERE row_kind = 'CANONICAL_RESULT'/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.query_response_cache/);
  assert.match(queryFunction, /cache\.physical_request = physical_request_body/);
  assert.match(queryFunction, /cache\.expires_at > clock_timestamp\(\)/);
  assert.match(queryFunction, /pg_try_advisory_xact_lock\(query_lock_id\)/);
  assert.match(queryFunction, /pg_try_advisory_xact_lock\(20260724, 1\)/);
  assert.match(queryFunction, /pg_try_advisory_xact_lock\(20260724, 2\)/);
  assert.match(queryFunction, /canonical query cache-miss capacity is exhausted/);
  assert.match(queryFunction, /clock_timestamp\(\) \+ interval '1 hour'/);
  assert.match(queryFunction, /jsonb_set\(cached_result, '\{cache_state\}', '"HIT"'::jsonb\)/);
  assert.match(queryFunction, /WITH matching_keys AS MATERIALIZED/);
  assert.match(queryFunction, /CANONICAL_QUERY_PAGE_RESULT\/V2/);
  assert.match(queryFunction, /CANONICAL_QUERY_COHORT_SUMMARY\/V1/);
  assert.doesNotMatch(queryFunction, /matching_rows/);
  assert.equal((queryFunction.match(/row\.canonical_payload/g) || []).length, 1);
  assert.match(queryFunction, /FROM page_row_keys page[\s\S]*JOIN canonical_v2_staging\.shared_serving_rows row/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.shared_serving_rows \([\s\S]*canonical_payload_digest[\s\S]*FROM jsonb_populate_recordset/);
  assert.doesNotMatch(sql, /INSERT INTO canonical_v2_staging\.shared_serving_rows\s+SELECT \*/);
  assert.match(sql, /REVOKE ALL ON TABLE canonical_v2_staging\.shared_serving_rows/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_active_query_page[\s\S]*TO canonical_v2_serving/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_query_page\([\s\S]*?\) TO canonical_v2_serving/);
  assert.doesNotMatch(sql, /\bOFFSET\b/i);
  assert.doesNotMatch(sql, /\bLOOP\b/i);
  assert.doesNotMatch(sql, /\bEXECUTE\s+format\s*\(/i);
  assert.doesNotMatch(queryFunction, /percentile_cont\s*\(/i);
  assert.doesNotMatch(sql, /DROP FUNCTION IF EXISTS public\.canonical_v2_(active_)?query_page_v2/);
  assert.match(source, /active \? 'canonical_v2_active_query_page_v2' : 'canonical_v2_query_page_v2'/);
  assert.doesNotMatch(source, /provision_cards|loadContext|\.from\(['"]claims['"]\)/);
});
