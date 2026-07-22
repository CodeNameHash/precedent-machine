const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { buildLandosMaterialContractsServingFixture } = require('../__fixtures__/canonical-v2/landos-material-contracts-row');
const { buildLandosIocCapexServingFixture } = require('../__fixtures__/canonical-v2/landos-ioc-capex-row');
const { buildLandosTerminationFeeServingFixture } = require('../__fixtures__/canonical-v2/landos-termination-fee-row');
const { buildMultiDealCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/multi-deal-candidate-release');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalQueryRequest,
  projectSharedServingRowRecord,
  queryCanonicalResultPage,
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
    schema_version: 'CANONICAL_QUERY_PAGE_RESULT/V1',
    serving_namespace_id: params.p_serving_namespace_id,
    corpus_release_id: params.p_corpus_release_id,
    contract_fingerprint: params.p_contract_fingerprint,
    query_semantics_digest: params.p_query_semantics_digest,
    total_count: rows.length,
    page_count: rows.length,
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
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION',
      trigger_condition: 'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
    },
  });
  const cache = new MemoryCache();
  const first = await queryCanonicalResultPage({ client, cache, request });
  const second = await queryCanonicalResultPage({ client, cache, request });

  assert.equal(first.cache, 'MISS');
  assert.equal(second.cache, 'HIT');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'canonical_v2_query_page');
  assert.equal(calls[0].params.p_environment, 'staging');
  assert.equal(calls[0].params.p_min_canonical_value, '5');
  assert.equal(calls[0].params.p_trigger_code, 'ACQUISITION_PROPOSAL_TAIL');
  assert.equal(calls[0].params.p_payment_timing, 'TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION');
  assert.equal(calls[0].params.p_trigger_condition, 'FIFTY_PERCENT_ACQUISITION_THRESHOLD');
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
  assert.equal(calls[0].name, 'canonical_v2_query_page');
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

  assert.notEqual(base.query_semantics_digest, columns.query_semantics_digest);
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

test('the staging query projection is indexed, keyset-paged and served by one bounded SQL RPC', () => {
  const sql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const source = fs.readFileSync('lib/canonical-v2/query-result.js', 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.shared_serving_rows/);
  assert.match(sql, /canonical_numeric_value numeric/);
  assert.match(sql, /trigger_codes text\[\]/);
  assert.match(sql, /payment_timings text\[\]/);
  assert.match(sql, /trigger_conditions text\[\]/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonical_v2_query_page/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.canonical_v2_active_query_page/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET statement_timeout = '2500ms'/);
  assert.match(sql, /LIMIT p_page_size \+ 1/);
  assert.match(sql, /\(row\.governed_deal_key, row\.row_serving_key\) > \(p_after_governed_deal_key, p_after_row_serving_key\)/);
  assert.match(sql, /row\.trigger_codes @> ARRAY\[p_trigger_code\]::text\[\]/);
  assert.match(sql, /row\.payment_timings @> ARRAY\[p_payment_timing\]::text\[\]/);
  assert.match(sql, /row\.trigger_conditions @> ARRAY\[p_trigger_condition\]::text\[\]/);
  assert.match(sql, /canonical_v2_shared_rows_payment_timings_idx[\s\S]*USING gin \(payment_timings\)/);
  assert.match(sql, /canonical_v2_shared_rows_trigger_conditions_idx[\s\S]*USING gin \(trigger_conditions\)/);
  assert.match(sql, /REVOKE ALL ON TABLE canonical_v2_staging\.shared_serving_rows/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_active_query_page[\s\S]*TO canonical_v2_serving/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_query_page\([\s\S]*?\) TO canonical_v2_serving/);
  assert.doesNotMatch(sql, /\bOFFSET\b/i);
  assert.doesNotMatch(sql, /\bLOOP\b/i);
  assert.doesNotMatch(sql, /\bEXECUTE\s+format\s*\(/i);
  assert.match(source, /active \? 'canonical_v2_active_query_page' : 'canonical_v2_query_page'/);
  assert.doesNotMatch(source, /provision_cards|loadContext|\.from\(['"]claims['"]\)/);
});
