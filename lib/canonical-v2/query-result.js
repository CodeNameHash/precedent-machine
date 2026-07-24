const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  compileFixtureContract,
  compileFixtureContractV2,
  compileFixtureContractV3,
  compileFixtureContractV4,
  compileFixtureContractV5,
} = require('./contract-bundle');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { validateSharedServingRow } = require('./shared-serving-row');
const {
  SERVING_PROJECTION_VERSION_V1,
  SERVING_PROJECTION_VERSION_V2,
  validateQueryProjectionRecordContract,
} = require('./serving-projection-contract');
const {
  formatConditionExpression,
  terminationFeePathwayView,
} = require('./termination-fee-trigger-presentation');
const {
  isRejectedServingContractFingerprint,
} = require('./serving-contract-policy');

const SHA256_RE = /^[a-f0-9]{64}$/;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const MAX_COLUMNS = 30;
const MAX_CACHE_TTL_SECONDS = 3600;
const DEFAULT_TIMEOUT_MS = 2500;
const FIXTURE_CONTRACT_FINGERPRINT = compileFixtureContract().fingerprint;
const SUPPORTED_QUERY_CONTRACTS = Object.freeze([
  compileFixtureContract(),
  compileFixtureContractV2(),
  compileFixtureContractV3(),
  compileFixtureContractV4(),
  compileFixtureContractV5(),
]);
const INTENTS = Object.freeze(['MARKET_RANGE', 'FILTER_THEN_LIST']);
const FEE_METRIC = 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE';
const BUYER_FEE_METRIC = 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE';
const FEE_METRICS = Object.freeze([FEE_METRIC, BUYER_FEE_METRIC]);
const IOC_CAPEX_METRIC = 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE';
const MATERIAL_CONTRACT_METRIC = 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE';
const NO_SHOP_NOTICE_METRIC = 'NO_SHOP_NOTICE_PERIOD_DAYS';
// D3 widening (2026-07-23, DECISIONS 2026-07-23): serves the metric that
// already exists in lib/canonical-v2/serving-projection.js's
// METRIC_DEFINITIONS (NO_SHOP_INITIAL_MATCH_PERIOD_DAYS, metric_version 1,
// concept_key NOSOL-MATCH) — that frozen file is untouched by this change.
const NO_SHOP_INITIAL_MATCH_METRIC = 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS';
const DEAL_RELATIVE_MONEY_METRICS = Object.freeze([...FEE_METRICS, IOC_CAPEX_METRIC, MATERIAL_CONTRACT_METRIC]);
const QUERY_METRICS = Object.freeze([...DEAL_RELATIVE_MONEY_METRICS, NO_SHOP_NOTICE_METRIC, NO_SHOP_INITIAL_MATCH_METRIC]);
const ACTIVE_RELEASE_SELECTOR = 'ACTIVE';
const ACTIVE_IDENTITY_PLACEHOLDER = contentId('CANONICAL_ACTIVE_QUERY_IDENTITY_PLACEHOLDER/V1', ACTIVE_RELEASE_SELECTOR);
const LOGICAL_REQUEST_KEYS = Object.freeze([
  'intent',
  'metric_key',
  'metric_version',
  'concept_key',
  'party',
  'filters',
  'selected_columns',
  'column_filters',
  'page_size',
  'cursor',
]);

const VALUE_LABELS = Object.freeze({
  SELLER: 'Seller / target termination fee',
  BUYER: 'Buyer / reverse termination fee',
  PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR: 'Payments by or to the Company per fiscal year',
  ANY_COMPANY_CONTRACT: 'Any Company Contract',
  BY_OR_TO_COMPANY: 'By or to the Company',
  GREATER_THAN: 'Amount in excess of the threshold',
  FISCAL_2023_OR_ANY_SINGLE_FISCAL_YEAR_THEREAFTER: 'FY2023 or any single fiscal year thereafter',
  ELAPSED: 'Elapsed days',
  RECEIPT_OF_COMPETING_PROPOSAL: 'Receipt of competing proposal',
  // Same treatment as the notice metric's ELAPSED/RECEIPT_OF_COMPETING_PROPOSAL
  // pair above, for NO_SHOP_INITIAL_MATCH_PERIOD_DAYS's own day_basis/trigger
  // codes (METRIC_DEFINITIONS.NO_SHOP_INITIAL_MATCH_PERIOD_DAYS.allowed_day_bases
  // = ['BUSINESS'], .trigger = 'SUPERIOR_PROPOSAL_NOTICE' —
  // lib/canonical-v2/serving-projection.js:57-58).
  BUSINESS: 'Business days',
  SUPERIOR_PROPOSAL_NOTICE: 'Superior proposal notice',
});

const COLUMN_DEFINITIONS = Object.freeze({
  deal: Object.freeze({ label: 'Deal', value_kind: 'TEXT', refinement: { operator: 'EQ', request_field: 'deal' } }),
  buyer: Object.freeze({ label: 'Buyer', value_kind: 'TEXT', refinement: { operator: 'EQ', request_field: 'filters.buyer' } }),
  sector: Object.freeze({ label: 'Sector', value_kind: 'TEXT', refinement: { operator: 'EQ', request_field: 'filters.sector' } }),
  merger_form: Object.freeze({ label: 'Merger form', value_kind: 'TEXT', refinement: { operator: 'EQ', request_field: 'filters.merger_form' } }),
  announce_year: Object.freeze({ label: 'Announced', value_kind: 'YEAR', refinement: { operator: 'BETWEEN', request_field: 'filters.year' } }),
  deal_value_usd: Object.freeze({ label: 'Deal value', value_kind: 'USD_DECIMAL', refinement: { operator: 'BETWEEN', request_field: 'filters.deal_value_usd' } }),
  party: Object.freeze({ label: 'Legal side', value_kind: 'PARTY', refinement: { operator: 'EQ', request_field: 'party' } }),
  raw_value: Object.freeze({ label: 'Source amount', value_kind: 'SOURCE_TEXT', refinement: null }),
  percent_of_deal_value: Object.freeze({ label: '% of deal value', value_kind: 'DECIMAL_PERCENT', metrics: DEAL_RELATIVE_MONEY_METRICS, refinement: { operator: 'BETWEEN', request_field: 'column_filters.percent_of_deal_value' } }),
  deal_value_basis: Object.freeze({ label: 'Deal-value basis', value_kind: 'DENOMINATOR', metrics: DEAL_RELATIVE_MONEY_METRICS, refinement: null }),
  source: Object.freeze({ label: 'Source', value_kind: 'EXACT_SOURCE_ACTION', refinement: null }),
  duration: Object.freeze({ label: 'Duration', value_kind: 'DURATION', metrics: [NO_SHOP_NOTICE_METRIC, NO_SHOP_INITIAL_MATCH_METRIC], refinement: null }),
  day_basis: Object.freeze({ label: 'Day basis', value_kind: 'CODED_VALUE', metrics: [NO_SHOP_NOTICE_METRIC, NO_SHOP_INITIAL_MATCH_METRIC], refinement: null }),
  trigger: Object.freeze({ label: 'Trigger', value_kind: 'CODED_VALUE', metrics: [NO_SHOP_NOTICE_METRIC, NO_SHOP_INITIAL_MATCH_METRIC], refinement: null }),
  fee_side: Object.freeze({ label: 'Fee side', value_kind: 'CODED_VALUE', metrics: FEE_METRICS, refinement: { operator: 'EQ', request_field: 'column_filters.fee_side' } }),
  payer: Object.freeze({ label: 'Payer', value_kind: 'PARTY', metrics: FEE_METRICS, refinement: { operator: 'EQ', request_field: 'column_filters.payer_capacity' } }),
  payee: Object.freeze({ label: 'Payee', value_kind: 'PARTY', metrics: FEE_METRICS, refinement: { operator: 'EQ', request_field: 'column_filters.payee_capacity' } }),
  triggers: Object.freeze({
    label: 'Triggers and timing',
    value_kind: 'CANONICAL_SET',
    metrics: FEE_METRICS,
    refinement: { operator: 'CONTAINS', request_field: 'column_filters.trigger_code' },
    additional_refinements: Object.freeze([
      Object.freeze({ operator: 'CONTAINS', request_field: 'column_filters.payment_timing' }),
      Object.freeze({ operator: 'CONTAINS', request_field: 'column_filters.trigger_condition' }),
    ]),
  }),
  material_contract_criterion: Object.freeze({ label: 'Criterion', value_kind: 'CODED_VALUE', metrics: [MATERIAL_CONTRACT_METRIC], refinement: { operator: 'EQ', request_field: 'column_filters.criterion_code' } }),
  contract_scope: Object.freeze({ label: 'Contract scope', value_kind: 'CODED_VALUE', metrics: [MATERIAL_CONTRACT_METRIC], refinement: { operator: 'EQ', request_field: 'column_filters.contract_scope_code' } }),
  cash_flow_direction: Object.freeze({ label: 'Cash-flow direction', value_kind: 'CODED_VALUE', metrics: [MATERIAL_CONTRACT_METRIC], refinement: { operator: 'EQ', request_field: 'column_filters.cash_flow_direction_code' } }),
  measurement_period: Object.freeze({ label: 'Measurement period', value_kind: 'CODED_VALUE', metrics: [MATERIAL_CONTRACT_METRIC], refinement: { operator: 'EQ', request_field: 'column_filters.measurement_period_code' } }),
  threshold_operator: Object.freeze({ label: 'Threshold rule', value_kind: 'CODED_VALUE', metrics: [MATERIAL_CONTRACT_METRIC], refinement: { operator: 'EQ', request_field: 'column_filters.comparison_operator' } }),
});

const DEFAULT_COLUMNS = Object.freeze({
  [FEE_METRIC]: Object.freeze([
    'deal',
    'buyer',
    'percent_of_deal_value',
    'raw_value',
    'fee_side',
    'payer',
    'payee',
    'triggers',
    'source',
  ]),
  [BUYER_FEE_METRIC]: Object.freeze([
    'deal',
    'buyer',
    'percent_of_deal_value',
    'raw_value',
    'fee_side',
    'payer',
    'payee',
    'triggers',
    'source',
  ]),
  [MATERIAL_CONTRACT_METRIC]: Object.freeze([
    'deal',
    'buyer',
    'percent_of_deal_value',
    'raw_value',
    'material_contract_criterion',
    'measurement_period',
    'source',
  ]),
  [IOC_CAPEX_METRIC]: Object.freeze([
    'deal',
    'buyer',
    'percent_of_deal_value',
    'raw_value',
    'party',
    'source',
  ]),
  [NO_SHOP_NOTICE_METRIC]: Object.freeze([
    'deal',
    'buyer',
    'party',
    'duration',
    'day_basis',
    'trigger',
    'source',
  ]),
  // Modeled on NO_SHOP_NOTICE_METRIC directly above (same day-value metric
  // shape) — reuses its exact column keys, invents none.
  [NO_SHOP_INITIAL_MATCH_METRIC]: Object.freeze([
    'deal',
    'buyer',
    'party',
    'duration',
    'day_basis',
    'trigger',
    'source',
  ]),
});

const COLUMN_FILTER_KEYS = Object.freeze([
  'min_percent_of_deal_value',
  'max_percent_of_deal_value',
  'fee_side',
  'payer_capacity',
  'payee_capacity',
  'trigger_code',
  'payment_timing',
  'trigger_condition',
  'criterion_code',
  'contract_scope_code',
  'cash_flow_direction_code',
  'measurement_period_code',
  'comparison_operator',
]);

class CanonicalQueryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CanonicalQueryError';
    this.code = code;
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) throw new CanonicalQueryError('INVALID_REQUEST', `${label} must be a full SHA-256 content ID.`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new CanonicalQueryError('INVALID_REQUEST', `${label} must be a non-empty string.`);
  return value.trim();
}

function optionalText(value, label) {
  return value == null || value === '' ? null : requireText(value, label);
}

function optionalDecimal(value, label) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new CanonicalQueryError('INVALID_REQUEST', `${label} must be a non-negative canonical decimal string.`);
  }
  return value;
}

function compareDecimals(left, right) {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftScaled = BigInt(`${leftInteger}${leftFraction.padEnd(scale, '0')}`);
  const rightScaled = BigInt(`${rightInteger}${rightFraction.padEnd(scale, '0')}`);
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

function exactKeys(value, keys, label, errorCode = 'INVALID_REQUEST') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CanonicalQueryError(errorCode, `${label} must be an object.`);
  }
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new CanonicalQueryError(errorCode, `${label} fields do not match the canonical query contract.`);
  }
}

function normaliseColumnFilters(filters = {}, metricKey) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'column_filters must be an object.');
  }
  const unknown = Object.keys(filters).filter((key) => !COLUMN_FILTER_KEYS.includes(key));
  if (unknown.length) throw new CanonicalQueryError('INVALID_REQUEST', `Unsupported column filters: ${unknown.sort().join(', ')}.`);
  const result = {
    min_percent_of_deal_value: optionalDecimal(filters.min_percent_of_deal_value, 'column_filters.min_percent_of_deal_value'),
    max_percent_of_deal_value: optionalDecimal(filters.max_percent_of_deal_value, 'column_filters.max_percent_of_deal_value'),
    fee_side: optionalText(filters.fee_side, 'column_filters.fee_side'),
    payer_capacity: optionalText(filters.payer_capacity, 'column_filters.payer_capacity'),
    payee_capacity: optionalText(filters.payee_capacity, 'column_filters.payee_capacity'),
    trigger_code: optionalText(filters.trigger_code, 'column_filters.trigger_code'),
    payment_timing: optionalText(filters.payment_timing, 'column_filters.payment_timing'),
    trigger_condition: optionalText(filters.trigger_condition, 'column_filters.trigger_condition'),
    criterion_code: optionalText(filters.criterion_code, 'column_filters.criterion_code'),
    contract_scope_code: optionalText(filters.contract_scope_code, 'column_filters.contract_scope_code'),
    cash_flow_direction_code: optionalText(filters.cash_flow_direction_code, 'column_filters.cash_flow_direction_code'),
    measurement_period_code: optionalText(filters.measurement_period_code, 'column_filters.measurement_period_code'),
    comparison_operator: optionalText(filters.comparison_operator, 'column_filters.comparison_operator'),
  };
  if (result.min_percent_of_deal_value !== null && result.max_percent_of_deal_value !== null
    && compareDecimals(result.min_percent_of_deal_value, result.max_percent_of_deal_value) > 0) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'minimum percentage cannot exceed maximum percentage.');
  }
  if (!DEAL_RELATIVE_MONEY_METRICS.includes(metricKey)
    && (result.min_percent_of_deal_value !== null || result.max_percent_of_deal_value !== null)) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'percentage refinements require a governed deal-relative money metric.');
  }
  const feeKeys = [
    'fee_side',
    'payer_capacity',
    'payee_capacity',
    'trigger_code',
    'payment_timing',
    'trigger_condition',
  ];
  const materialKeys = [
    'criterion_code',
    'contract_scope_code',
    'cash_flow_direction_code',
    'measurement_period_code',
    'comparison_operator',
  ];
  if (!FEE_METRICS.includes(metricKey) && feeKeys.some((key) => result[key] !== null)) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'fee refinements require a governed termination fee metric.');
  }
  const pathwayFilters = [
    result.trigger_code,
    result.payment_timing,
    result.trigger_condition,
  ].filter((value) => value !== null);
  if (pathwayFilters.length > 1) {
    throw new CanonicalQueryError(
      'INVALID_REQUEST',
      'Only one trigger-pathway refinement may be applied until pathway-tuple comparability is governed.',
    );
  }
  if (metricKey !== MATERIAL_CONTRACT_METRIC && materialKeys.some((key) => result[key] !== null)) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'Material Contracts refinements require the Material Contracts metric.');
  }
  return result;
}

function normaliseColumns(columns, metricKey) {
  const selected = columns == null ? DEFAULT_COLUMNS[metricKey] : columns;
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > MAX_COLUMNS) {
    throw new CanonicalQueryError('INVALID_REQUEST', `selected_columns must contain between 1 and ${MAX_COLUMNS} entries.`);
  }
  const unique = [...new Set(selected.map((key) => requireText(key, 'selected_columns[]')))];
  if (unique.length !== selected.length) throw new CanonicalQueryError('INVALID_REQUEST', 'selected_columns cannot contain duplicates.');
  for (const key of unique) {
    const definition = COLUMN_DEFINITIONS[key];
    if (!definition || (definition.metrics && !definition.metrics.includes(metricKey))) {
      throw new CanonicalQueryError('INVALID_REQUEST', `Column ${key} is not governed for ${metricKey}.`);
    }
  }
  return unique;
}

function normaliseCursor(cursor) {
  if (cursor == null) return null;
  exactKeys(cursor, ['governed_deal_key', 'row_serving_key'], 'cursor');
  return {
    governed_deal_key: requireText(cursor.governed_deal_key, 'cursor.governed_deal_key'),
    row_serving_key: requireDigest(cursor.row_serving_key, 'cursor.row_serving_key'),
  };
}

function contractForFingerprint(fingerprint) {
  return SUPPORTED_QUERY_CONTRACTS.find((contract) => contract.fingerprint === fingerprint) || null;
}

function contractSupportsMetric(contract, metricKey, conceptKey) {
  if (!contract
    || isRejectedServingContractFingerprint(contract.fingerprint)
    || !contract.concepts.some((entry) => entry.concept_key === conceptKey)
    || !contract.claim_definitions.some((entry) => entry.claim_definition_key === metricKey)) {
    return false;
  }
  if (metricKey !== BUYER_FEE_METRIC) return true;
  return contract.serving_metric_operation_bindings?.some((binding) => (
    binding.metric_key === BUYER_FEE_METRIC
      && binding.concept_key === conceptKey
      && binding.fee_side === 'BUYER'
      && binding.trigger_path_schema_key === 'TERMINATION_FEE_TRIGGER_PATH'
      && binding.trigger_path_schema_version === 2
  )) === true;
}

function earliestContractForMetric(metricKey, conceptKey) {
  return SUPPORTED_QUERY_CONTRACTS.find(
    (contract) => contractSupportsMetric(contract, metricKey, conceptKey),
  ) || null;
}

function compileCanonicalQueryRequest(request) {
  exactKeys(request, [
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    ...LOGICAL_REQUEST_KEYS,
  ], 'request');
  if (!INTENTS.includes(request.intent)) throw new CanonicalQueryError('INVALID_REQUEST', 'intent is not a governed query intent.');
  const contract = contractForFingerprint(request.contract_fingerprint);
  if (!contract) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'contract_fingerprint does not match a frozen serving contract.');
  }
  if (!contractSupportsMetric(contract, request.metric_key, request.concept_key)) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'the selected serving contract does not support this governed metric and concept.');
  }
  const cohort = compileMarketCohortRequest({
    serving_namespace_id: request.serving_namespace_id,
    corpus_release_id: request.corpus_release_id,
    contract_fingerprint: request.contract_fingerprint,
    metric_key: request.metric_key,
    metric_version: request.metric_version,
    concept_key: request.concept_key,
    party: request.party,
    subject_deal_key: null,
    filters: request.filters,
  });
  if (!QUERY_METRICS.includes(cohort.metric_key)) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'the fixture query contract does not support this governed metric.');
  }
  const pageSize = request.page_size == null ? DEFAULT_PAGE_SIZE : request.page_size;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new CanonicalQueryError('INVALID_REQUEST', `page_size must be between 1 and ${MAX_PAGE_SIZE}.`);
  }
  const selectedColumns = normaliseColumns(request.selected_columns, cohort.metric_key);
  const columnFilters = normaliseColumnFilters(request.column_filters, cohort.metric_key);
  const cursor = normaliseCursor(request.cursor);
  const semantics = {
    schema_version: 'CANONICAL_QUERY_SEMANTICS/V1',
    serving_namespace_id: cohort.serving_namespace_id,
    corpus_release_id: cohort.corpus_release_id,
    contract_fingerprint: cohort.contract_fingerprint,
    intent: request.intent,
    metric_key: cohort.metric_key,
    metric_version: cohort.metric_version,
    concept_key: cohort.concept_key,
    party: cohort.party,
    basis_key: cohort.basis_key,
    filters: cohort.filters,
    selected_columns: selectedColumns,
    column_filters: columnFilters,
    sort: [
      { column_key: 'deal', direction: 'ASC' },
      { column_key: 'row_serving_key', direction: 'ASC' },
    ],
  };
  const physicalSemantics = { ...semantics };
  delete physicalSemantics.selected_columns;
  const querySemanticsDigest = contentId(
    'CANONICAL_QUERY_PHYSICAL_SEMANTICS/V1',
    physicalSemantics,
  );
  const pagePositionDigest = contentId('CANONICAL_QUERY_PAGE_POSITION/V1', cursor || 'FIRST_PAGE');
  const cacheKey = contentId('CANONICAL_QUERY_PAGE_CACHE/V2', {
    serving_namespace_id: cohort.serving_namespace_id,
    corpus_release_id: cohort.corpus_release_id,
    query_semantics_digest: querySemanticsDigest,
    page_size: pageSize,
    page_position_digest: pagePositionDigest,
  });
  return Object.freeze({
    ...semantics,
    query_semantics_digest: querySemanticsDigest,
    page_size: pageSize,
    cursor,
    page_position_digest: pagePositionDigest,
    cache_key: cacheKey,
  });
}

function compileCanonicalActiveQueryRequest(request) {
  exactKeys(request, LOGICAL_REQUEST_KEYS, 'request');
  const contract = earliestContractForMetric(request.metric_key, request.concept_key);
  if (!contract) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'no frozen serving contract supports this governed metric and concept.');
  }
  const pinned = compileCanonicalQueryRequest({
    serving_namespace_id: ACTIVE_IDENTITY_PLACEHOLDER,
    corpus_release_id: ACTIVE_IDENTITY_PLACEHOLDER,
    contract_fingerprint: contract.fingerprint,
    ...request,
  });
  const semantics = {
    schema_version: 'CANONICAL_ACTIVE_QUERY_SEMANTICS/V1',
    release_selector: ACTIVE_RELEASE_SELECTOR,
    contract_fingerprint: contract.fingerprint,
    intent: pinned.intent,
    metric_key: pinned.metric_key,
    metric_version: pinned.metric_version,
    concept_key: pinned.concept_key,
    party: pinned.party,
    basis_key: pinned.basis_key,
    filters: pinned.filters,
    selected_columns: pinned.selected_columns,
    column_filters: pinned.column_filters,
    sort: pinned.sort,
  };
  const physicalSemantics = { ...semantics };
  delete physicalSemantics.selected_columns;
  const querySemanticsDigest = contentId(
    'CANONICAL_ACTIVE_QUERY_PHYSICAL_SEMANTICS/V1',
    physicalSemantics,
  );
  return Object.freeze({
    ...semantics,
    query_semantics_digest: querySemanticsDigest,
    page_size: pinned.page_size,
    cursor: pinned.cursor,
    page_position_digest: pinned.page_position_digest,
    cache_key: null,
  });
}

function logicalRpcParams(request) {
  const filters = request.filters;
  const columns = request.column_filters;
  return {
    p_contract_fingerprint: request.contract_fingerprint,
    p_query_semantics_digest: request.query_semantics_digest,
    p_metric_key: request.metric_key,
    p_metric_version: request.metric_version,
    p_concept_key: request.concept_key,
    p_party_role: request.party.role,
    p_party_value: request.party.value,
    p_party_capacity: request.party.capacity,
    p_basis_key: request.basis_key,
    p_sector: filters.sector,
    p_buyer: filters.buyer,
    p_merger_form: filters.merger_form,
    p_adviser_either: filters.adviser_either,
    p_lawyer_either: filters.lawyer_either,
    p_year_from: filters.year_from,
    p_year_to: filters.year_to,
    p_min_value_usd: filters.min_value_usd,
    p_max_value_usd: filters.max_value_usd,
    p_min_canonical_value: columns.min_percent_of_deal_value,
    p_max_canonical_value: columns.max_percent_of_deal_value,
    p_fee_side: columns.fee_side,
    p_payer_capacity: columns.payer_capacity,
    p_payee_capacity: columns.payee_capacity,
    p_trigger_code: columns.trigger_code,
    p_payment_timing: columns.payment_timing,
    p_trigger_condition: columns.trigger_condition,
    p_criterion_code: columns.criterion_code,
    p_contract_scope_code: columns.contract_scope_code,
    p_cash_flow_direction_code: columns.cash_flow_direction_code,
    p_measurement_period_code: columns.measurement_period_code,
    p_comparison_operator: columns.comparison_operator,
    p_page_size: request.page_size,
    p_after_governed_deal_key: request.cursor?.governed_deal_key || null,
    p_after_row_serving_key: request.cursor?.row_serving_key || null,
  };
}

function rpcParams(request) {
  return {
    p_environment: 'staging',
    p_serving_namespace_id: request.serving_namespace_id,
    p_corpus_release_id: request.corpus_release_id,
    ...logicalRpcParams(request),
  };
}

function activeRpcParams(request) {
  return {
    p_environment: 'staging',
    ...logicalRpcParams(request),
  };
}

function codedValue(code) {
  return code == null ? null : { code, label: VALUE_LABELS[code] || code };
}

function triggerValues(component) {
  return component.bounded_relationship_effects
    .filter((relationship) => relationship.relationship_definition_key === 'TRIGGERED_BY')
    .map((relationship) => {
      const effect = relationship.effect;
      const governedV2 = Array.isArray(effect.indexed_facts);
      const presentation = terminationFeePathwayView(effect);
      return {
        pathway_code: effect.pathway_code || null,
        pathway_label: presentation.pathway,
        trigger_code: effect.trigger_code,
        trigger_label: presentation.trigger,
        terminating_party: effect.terminating_party,
        terminating_party_label: presentation.terminating_party,
        payment_timing: effect.payment_timing,
        payment_timing_label: presentation.payment_timing,
        indexed_facts: [...(governedV2 ? effect.indexed_facts : effect.conditions)],
        condition_expression: governedV2 ? effect.condition_expression : null,
        condition_expression_text: governedV2
          ? formatConditionExpression(effect.condition_expression, effect)
          : presentation.conditions,
      };
    })
    .sort((left, right) => (
      String(left.pathway_code || '').localeCompare(String(right.pathway_code || ''))
        || left.trigger_code.localeCompare(right.trigger_code)
    ));
}

function sortedTriggerFieldValues(triggers, field) {
  const values = field === 'indexed_facts'
    ? triggers.flatMap((trigger) => trigger.indexed_facts)
    : triggers.map((trigger) => trigger[field]);
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))].sort();
}

function projectSharedServingRowRecord({
  row,
  serving_namespace_id,
  projection_version = SERVING_PROJECTION_VERSION_V2,
}) {
  validateSharedServingRow(row);
  const servingNamespaceId = requireDigest(serving_namespace_id, 'serving_namespace_id');
  const body = row.canonical_result;
  const market = body.market_context;
  const component = body.components[0];
  const attributes = component.claim_attributes;
  const dimensions = body.refinable_dimensions;
  const triggers = triggerValues(component);
  const record = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: row.corpus_release_id,
    row_serving_key: row.row_serving_key,
    contract_fingerprint: row.provenance.contract_fingerprint,
    governed_deal_key: row.governed_deal_key,
    concept_key: body.concept_key,
    metric_key: market.metric_key,
    metric_version: market.metric_version,
    party_role: body.party.role,
    party_value: body.party.value,
    party_capacity: body.party.capacity,
    basis_key: market.subject_observation.basis_key,
    sector: dimensions.sector,
    buyer: dimensions.buyer,
    merger_form: dimensions.merger_form,
    adviser_firms: [...dimensions.adviser_firms],
    lawyers: [...dimensions.lawyers],
    announce_year: dimensions.announce_year,
    deal_value_usd: dimensions.deal_value_usd,
    canonical_numeric_value: typeof component.canonical_value === 'string'
      && /^(0|[1-9]\d*)(\.\d+)?$/.test(component.canonical_value)
      ? component.canonical_value
      : null,
    fee_side: attributes.fee_side || null,
    payer_capacity: attributes.fee_side ? body.party.capacity : null,
    payee_capacity: attributes.payee_capacity || null,
    trigger_codes: sortedTriggerFieldValues(triggers, 'trigger_code'),
    payment_timings: sortedTriggerFieldValues(triggers, 'payment_timing'),
    trigger_conditions: sortedTriggerFieldValues(triggers, 'indexed_facts'),
    criterion_code: attributes.criterion_code || null,
    contract_scope_code: attributes.contract_scope_code || null,
    cash_flow_direction_code: attributes.cash_flow_direction_code || null,
    measurement_period_code: attributes.measurement_period_code || null,
    comparison_operator: attributes.comparison_operator || null,
    canonical_payload: row,
    canonical_payload_digest: row.canonical_payload_digest,
  };
  if (projection_version === SERVING_PROJECTION_VERSION_V1) {
    delete record.payment_timings;
    delete record.trigger_conditions;
  }
  validateQueryProjectionRecordContract(record, projection_version);
  return Object.freeze(record);
}

function allCells(row) {
  const body = row.canonical_result;
  const component = body.components[0];
  const dimensions = body.refinable_dimensions;
  const attributes = component.claim_attributes;
  return {
    deal: row.governed_deal_key,
    buyer: dimensions.buyer,
    sector: dimensions.sector,
    merger_form: dimensions.merger_form,
    announce_year: dimensions.announce_year,
    deal_value_usd: dimensions.deal_value_usd,
    party: { ...body.party },
    raw_value: component.raw_value,
    percent_of_deal_value: component.canonical_value,
    deal_value_basis: component.denominator ? { ...component.denominator } : null,
    source: row.source_actions[0] ? { ...row.source_actions[0] } : null,
    duration: component.unit === 'DAYS' ? {
      canonical_value: component.canonical_value,
      canonical_unit: component.unit,
      raw_value: component.raw_value,
      raw_magnitude: attributes.raw_magnitude || null,
      raw_unit: attributes.raw_unit || null,
    } : null,
    day_basis: codedValue(component.day_basis),
    trigger: codedValue(attributes.trigger),
    fee_side: codedValue(attributes.fee_side),
    payer: attributes.fee_side ? { ...body.party } : null,
    payee: attributes.payee_value ? {
      role: 'FEE_PAYEE',
      value: attributes.payee_value,
      capacity: attributes.payee_capacity,
    } : null,
    triggers: triggerValues(component),
    material_contract_criterion: codedValue(attributes.criterion_code),
    contract_scope: codedValue(attributes.contract_scope_code),
    cash_flow_direction: codedValue(attributes.cash_flow_direction_code),
    measurement_period: codedValue(attributes.measurement_period_code),
    threshold_operator: codedValue(attributes.comparison_operator),
  };
}

function rowMatchesRequest(row, request) {
  const body = row.canonical_result;
  const market = body.market_context;
  if (row.corpus_release_id !== request.corpus_release_id
    || row.provenance.contract_fingerprint !== request.contract_fingerprint
    || body.concept_key !== request.concept_key
    || market.metric_key !== request.metric_key
    || market.metric_version !== request.metric_version
    || canonicalJson(body.party) !== canonicalJson(request.party)
    || market.subject_observation.basis_key !== request.basis_key) return false;
  const dimensions = body.refinable_dimensions;
  const filters = request.filters;
  if ((filters.sector && dimensions.sector !== filters.sector)
    || (filters.buyer && dimensions.buyer !== filters.buyer)
    || (filters.merger_form && dimensions.merger_form !== filters.merger_form)
    || (filters.adviser_either && !dimensions.adviser_firms.includes(filters.adviser_either))
    || (filters.lawyer_either && !dimensions.lawyers.includes(filters.lawyer_either))
    || (filters.year_from && dimensions.announce_year < filters.year_from)
    || (filters.year_to && dimensions.announce_year > filters.year_to)
    || (filters.min_value_usd && compareDecimals(dimensions.deal_value_usd, filters.min_value_usd) < 0)
    || (filters.max_value_usd && compareDecimals(dimensions.deal_value_usd, filters.max_value_usd) > 0)) return false;
  const component = body.components[0];
  const attributes = component.claim_attributes;
  const columnFilters = request.column_filters;
  const triggers = triggerValues(component);
  if ((columnFilters.min_percent_of_deal_value
      && compareDecimals(component.canonical_value, columnFilters.min_percent_of_deal_value) < 0)
    || (columnFilters.max_percent_of_deal_value
      && compareDecimals(component.canonical_value, columnFilters.max_percent_of_deal_value) > 0)
    || (columnFilters.fee_side && attributes.fee_side !== columnFilters.fee_side)
    || (columnFilters.payer_capacity && body.party.capacity !== columnFilters.payer_capacity)
    || (columnFilters.payee_capacity && attributes.payee_capacity !== columnFilters.payee_capacity)
    || (columnFilters.criterion_code && attributes.criterion_code !== columnFilters.criterion_code)
    || (columnFilters.contract_scope_code && attributes.contract_scope_code !== columnFilters.contract_scope_code)
    || (columnFilters.cash_flow_direction_code && attributes.cash_flow_direction_code !== columnFilters.cash_flow_direction_code)
    || (columnFilters.measurement_period_code && attributes.measurement_period_code !== columnFilters.measurement_period_code)
    || (columnFilters.comparison_operator && attributes.comparison_operator !== columnFilters.comparison_operator)
    || (columnFilters.trigger_code
      && !triggers.some((trigger) => trigger.trigger_code === columnFilters.trigger_code))
    || (columnFilters.payment_timing
      && !triggers.some((trigger) => trigger.payment_timing === columnFilters.payment_timing))
    || (columnFilters.trigger_condition
      && !triggers.some((trigger) => trigger.indexed_facts.includes(columnFilters.trigger_condition)))) return false;
  return true;
}

function rowTuple(row) {
  return [row.governed_deal_key, row.row_serving_key];
}

function compareTuple(left, right) {
  const deal = left[0].localeCompare(right[0]);
  return deal || left[1].localeCompare(right[1]);
}

function responseDecimal(value, label) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new CanonicalQueryError('INVALID_RESPONSE', `${label} is not a canonical decimal.`);
  }
  return value;
}

function validateSummaryCounts(counts, totalCount) {
  exactKeys(counts, [
    'result_rows',
    'distinct_deals',
    'numeric_result_rows',
    'numeric_distinct_deals',
    'multi_value_deals',
    'approximate_result_rows',
    'approximate_distinct_deals',
  ], 'query cohort summary counts', 'INVALID_RESPONSE');
  for (const key of Object.keys(counts)) {
    if (!Number.isInteger(counts[key]) || counts[key] < 0) {
      throw new CanonicalQueryError('INVALID_RESPONSE', 'query cohort summary counts are invalid.');
    }
  }
  if (counts.result_rows !== totalCount
    || counts.distinct_deals > counts.result_rows
    || counts.numeric_result_rows > counts.result_rows
    || counts.numeric_distinct_deals > counts.distinct_deals
    || counts.numeric_distinct_deals > counts.numeric_result_rows
    || counts.multi_value_deals > counts.distinct_deals
    || counts.multi_value_deals > counts.numeric_distinct_deals
    || counts.approximate_result_rows > counts.result_rows
    || counts.approximate_distinct_deals > counts.distinct_deals
    || counts.approximate_distinct_deals > counts.approximate_result_rows) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'query cohort summary counts are inconsistent.');
  }
}

function validateSummaryGroups(groups, label, valueKey, counts) {
  if (!Array.isArray(groups) || groups.length > 50) {
    throw new CanonicalQueryError('INVALID_RESPONSE', `${label} exceeds its bounded group contract.`);
  }
  const seen = new Set();
  let previous = null;
  for (const group of groups) {
    exactKeys(
      group,
      [valueKey, 'result_count', 'deal_count'],
      `${label} group`,
      'INVALID_RESPONSE',
    );
    const value = valueKey === 'canonical_value'
      ? responseDecimal(group[valueKey], `${label}.${valueKey}`)
      : group[valueKey];
    if (typeof value !== 'string' || !value.trim()) {
      throw new CanonicalQueryError('INVALID_RESPONSE', `${label}.${valueKey} is invalid.`);
    }
    if (!Number.isInteger(group.result_count) || group.result_count < 1
      || !Number.isInteger(group.deal_count) || group.deal_count < 1
      || group.deal_count > group.result_count
      || group.result_count > counts.result_rows
      || group.deal_count > counts.distinct_deals
      || seen.has(value)
      || (previous !== null && (
        valueKey === 'canonical_value'
          ? compareDecimals(previous, value) >= 0
          : previous.localeCompare(value) >= 0
      ))) {
      throw new CanonicalQueryError('INVALID_RESPONSE', `${label} groups are invalid.`);
    }
    seen.add(value);
    previous = value;
  }
}

function validateSummaryStatistics(statistics, counts) {
  exactKeys(statistics, [
    'state',
    'derivation_version',
    'n_deals',
    'min',
    'p25',
    'median',
    'mean',
    'p75',
    'max',
  ], 'query cohort statistics', 'INVALID_RESPONSE');
  const states = [
    'AVAILABLE',
    'NO_VALUES',
    'INCOMPLETE_NUMERIC_DOMAIN',
    'NOT_DEFINED_MULTI_VALUE_PER_DEAL',
  ];
  if (!states.includes(statistics.state)
    || !Number.isInteger(statistics.n_deals)
    || statistics.n_deals < 0) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'query cohort statistics state is invalid.');
  }
  const keys = ['min', 'p25', 'median', 'mean', 'p75', 'max'];
  const expectedState = counts.result_rows === 0
    ? 'NO_VALUES'
    : counts.multi_value_deals > 0
      ? 'NOT_DEFINED_MULTI_VALUE_PER_DEAL'
      : counts.numeric_result_rows !== counts.result_rows
        || counts.numeric_distinct_deals !== counts.distinct_deals
        ? 'INCOMPLETE_NUMERIC_DOMAIN'
        : 'AVAILABLE';
  if (statistics.state !== expectedState) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'query cohort statistics state contradicts its counts.');
  }
  if (statistics.state !== 'AVAILABLE') {
    if (statistics.derivation_version !== null
      || statistics.n_deals !== 0
      || keys.some((key) => statistics[key] !== null)) {
      throw new CanonicalQueryError('INVALID_RESPONSE', 'unavailable query cohort statistics contain values.');
    }
    return;
  }
  if (statistics.derivation_version !== 'DECIMAL_PERCENTILE_CONT_LINEAR_SCALE_8/V1'
    || statistics.n_deals !== counts.distinct_deals
    || counts.result_rows < 1
    || counts.numeric_result_rows !== counts.result_rows
    || counts.numeric_distinct_deals !== counts.distinct_deals
    || counts.multi_value_deals !== 0) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'available query cohort statistics contradict their counts.');
  }
  const values = keys.map((key) => responseDecimal(statistics[key], `query cohort statistics.${key}`));
  if (compareDecimals(values[0], values[1]) > 0
    || compareDecimals(values[1], values[2]) > 0
    || compareDecimals(values[2], values[4]) > 0
    || compareDecimals(values[4], values[5]) > 0
    || compareDecimals(values[0], values[3]) > 0
    || compareDecimals(values[3], values[5]) > 0) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'query cohort statistics are not ordered.');
  }
}

function validateCanonicalQueryCohortSummary(summary, result, request) {
  exactKeys(summary, [
    'schema_version',
    'scope',
    'query_semantics_digest',
    'metric_key',
    'metric_version',
    'basis_key',
    'counts',
    'statistics',
    'facets',
  ], 'query cohort summary', 'INVALID_RESPONSE');
  if (summary.schema_version !== 'CANONICAL_QUERY_COHORT_SUMMARY/V1'
    || summary.scope !== 'FULL_FILTERED_COMPARABLE_QUERY_RESULTS'
    || summary.query_semantics_digest !== request.query_semantics_digest
    || summary.metric_key !== request.metric_key
    || summary.metric_version !== request.metric_version
    || summary.basis_key !== request.basis_key) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'query cohort summary does not match its request.');
  }
  validateSummaryCounts(summary.counts, result.total_count);
  validateSummaryStatistics(summary.statistics, summary.counts);
  exactKeys(summary.facets, [
    'trigger_codes',
    'payment_timings',
    'trigger_conditions',
  ], 'query cohort facets', 'INVALID_RESPONSE');
  for (const [key, groups] of Object.entries(summary.facets)) {
    validateSummaryGroups(groups, `query cohort facets.${key}`, 'value', summary.counts);
  }
  return summary;
}

function validateCanonicalQueryPage(result, request) {
  exactKeys(result, [
    'schema_version',
    'cache_state',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'query_semantics_digest',
    'total_count',
    'page_count',
    'cohort_summary',
    'rows',
    'next_cursor',
  ], 'query result', 'INVALID_RESPONSE');
  if (result.schema_version !== 'CANONICAL_QUERY_PAGE_RESULT/V2'
    || !['HIT', 'MISS'].includes(result.cache_state)
    || result.serving_namespace_id !== request.serving_namespace_id
    || result.corpus_release_id !== request.corpus_release_id
    || result.contract_fingerprint !== request.contract_fingerprint
    || result.query_semantics_digest !== request.query_semantics_digest) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'query result does not match the compiled request.');
  }
  if (!Number.isInteger(result.total_count) || result.total_count < 0
    || !Number.isInteger(result.page_count) || result.page_count < 0
    || !Array.isArray(result.rows)
    || result.rows.length !== result.page_count
    || result.page_count > request.page_size
    || result.total_count < result.page_count) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'query result counts exceed the bounded page contract.');
  }
  validateCanonicalQueryCohortSummary(result.cohort_summary, result, request);
  const seen = new Set();
  let previous = request.cursor ? [request.cursor.governed_deal_key, request.cursor.row_serving_key] : null;
  for (const row of result.rows) {
    try {
      validateSharedServingRow(row);
    } catch {
      throw new CanonicalQueryError('INVALID_RESPONSE', 'query result contains an invalid shared serving row.');
    }
    let inScope = false;
    try {
      inScope = rowMatchesRequest(row, request);
    } catch {
      inScope = false;
    }
    if (seen.has(row.row_serving_key) || !inScope) {
      throw new CanonicalQueryError('INVALID_RESPONSE', 'query result contains a duplicate or out-of-scope row.');
    }
    const tuple = rowTuple(row);
    if (previous && compareTuple(previous, tuple) >= 0) {
      throw new CanonicalQueryError('INVALID_RESPONSE', 'query result rows violate the stable keyset order.');
    }
    seen.add(row.row_serving_key);
    previous = tuple;
  }
  let nextCursor;
  try {
    nextCursor = normaliseCursor(result.next_cursor);
  } catch {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'next_cursor is outside the canonical query contract.');
  }
  if (nextCursor) {
    if (!result.rows.length
      || result.page_count !== request.page_size
      || result.total_count <= result.page_count
      || canonicalJson(nextCursor) !== canonicalJson({
        governed_deal_key: result.rows.at(-1).governed_deal_key,
        row_serving_key: result.rows.at(-1).row_serving_key,
      })) {
      throw new CanonicalQueryError('INVALID_RESPONSE', 'next_cursor is not the last complete row key.');
    }
  }
  return result;
}

function resolveActiveQueryPage(result, request) {
  exactKeys(result, [
    'schema_version',
    'cache_state',
    'pointer_id',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'query_semantics_digest',
    'total_count',
    'page_count',
    'cohort_summary',
    'rows',
    'next_cursor',
  ], 'active query result', 'INVALID_RESPONSE');
  let pointerId;
  let servingNamespaceId;
  let corpusReleaseId;
  let releaseContractFingerprint;
  try {
    pointerId = requireDigest(result.pointer_id, 'pointer_id');
    servingNamespaceId = requireDigest(result.serving_namespace_id, 'serving_namespace_id');
    corpusReleaseId = requireDigest(result.corpus_release_id, 'corpus_release_id');
    // Release-declared fingerprint (contract-amendment serving fix, see
    // docs/handoffs/SPEC-CONTRACT-AMENDMENT-PATH-2026-07-23.md option 1):
    // the ACTIVE release governs what is served, so we accept whatever
    // contract_fingerprint the release itself declares here rather than
    // requiring it equal the app-compiled request.contract_fingerprint --
    // the compiled contract governs candidate BUILDING only. Every row is
    // then validated against THIS declared fingerprint below (unchanged
    // digest recomputation, row-shape, and keyset-order checks).
    releaseContractFingerprint = requireDigest(result.contract_fingerprint, 'contract_fingerprint');
  } catch {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'active query result has an invalid release identity.');
  }
  if (result.query_semantics_digest !== request.query_semantics_digest) {
    throw new CanonicalQueryError('INVALID_RESPONSE', 'active query result does not match the compiled request.');
  }
  const releaseContract = contractForFingerprint(releaseContractFingerprint);
  if (!contractSupportsMetric(releaseContract, request.metric_key, request.concept_key)) {
    throw new CanonicalQueryError(
      'INVALID_RESPONSE',
      'the active release contract does not support the requested governed metric and concept.',
    );
  }
  const resolvedRequest = Object.freeze({
    ...request,
    pointer_id: pointerId,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: releaseContractFingerprint,
    cache_key: contentId('CANONICAL_ACTIVE_QUERY_PAGE_CACHE/V2', {
      pointer_id: pointerId,
      serving_namespace_id: servingNamespaceId,
      corpus_release_id: corpusReleaseId,
      contract_fingerprint: releaseContractFingerprint,
      query_semantics_digest: request.query_semantics_digest,
      page_size: request.page_size,
      page_position_digest: request.page_position_digest,
    }),
  });
  const { pointer_id: _pointerId, ...page } = result;
  validateCanonicalQueryPage(page, resolvedRequest);
  return Object.freeze({ request: resolvedRequest, result: page });
}

function buildCanonicalQueryResultView(result, request) {
  validateCanonicalQueryPage(result, request);
  const columns = request.selected_columns.map((key) => ({
    column_key: key,
    label: COLUMN_DEFINITIONS[key].label,
    value_kind: COLUMN_DEFINITIONS[key].value_kind,
    refinement: COLUMN_DEFINITIONS[key].refinement,
  }));
  return Object.freeze({
    schema_version: 'CANONICAL_QUERY_RESULT_VIEW/V2',
    release_selector: request.release_selector || 'PINNED',
    pointer_id: request.pointer_id || null,
    serving_namespace_id: result.serving_namespace_id,
    corpus_release_id: result.corpus_release_id,
    contract_fingerprint: result.contract_fingerprint,
    intent: request.intent,
    metric_key: request.metric_key,
    metric_version: request.metric_version,
    concept_key: request.concept_key,
    party: { ...request.party },
    query_semantics_digest: request.query_semantics_digest,
    total_count: result.total_count,
    page_count: result.page_count,
    cohort_summary: JSON.parse(JSON.stringify(result.cohort_summary)),
    next_cursor: result.next_cursor ? { ...result.next_cursor } : null,
    columns,
    refinements: request.selected_columns.flatMap((columnKey) => {
      const definition = COLUMN_DEFINITIONS[columnKey];
      return [definition.refinement, ...(definition.additional_refinements || [])]
        .filter(Boolean)
        .map((refinement) => ({ column_key: columnKey, ...refinement }));
    }),
    rows: result.rows.map((row) => {
      const values = allCells(row);
      const denominatorPrecision = row.canonical_result?.components?.[0]
        ?.claim_attributes?.denominator_precision || null;
      return {
        row_serving_key: row.row_serving_key,
        governed_deal_key: row.governed_deal_key,
        cells: Object.fromEntries(request.selected_columns.map((key) => [key, values[key]])),
        display_metadata: { denominator_precision: denominatorPrecision },
        source_actions: row.source_actions.map((action) => ({ ...action })),
      };
    }),
  });
}

async function withDeadline(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new CanonicalQueryError('DEADLINE_EXCEEDED', 'Canonical query exceeded its deadline.')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function queryCanonicalResultPage({
  client,
  cache = null,
  request,
  releaseSelector = 'PINNED',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cacheTtlSeconds = MAX_CACHE_TTL_SECONDS,
}) {
  if (!client || typeof client.rpc !== 'function') {
    throw new CanonicalQueryError('DATA_SOURCE_NOT_CONFIGURED', 'A canonical query RPC client is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'timeoutMs must be between 1 and 10000.');
  }
  if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds < 1 || cacheTtlSeconds > MAX_CACHE_TTL_SECONDS) {
    throw new CanonicalQueryError('INVALID_REQUEST', `cacheTtlSeconds must be between 1 and ${MAX_CACHE_TTL_SECONDS}.`);
  }
  if (!['PINNED', ACTIVE_RELEASE_SELECTOR].includes(releaseSelector)) {
    throw new CanonicalQueryError('INVALID_REQUEST', 'releaseSelector must be PINNED or ACTIVE.');
  }
  const active = releaseSelector === ACTIVE_RELEASE_SELECTOR;
  const compiled = active
    ? compileCanonicalActiveQueryRequest(request)
    : compileCanonicalQueryRequest(request);
  if (!active && cache && typeof cache.get === 'function') {
    const cached = await cache.get(compiled.cache_key);
    if (cached != null) {
      const result = validateCanonicalQueryPage(cached, compiled);
      return { request: compiled, result: buildCanonicalQueryResultView(result, compiled), cache: 'HIT' };
    }
  }
  let response;
  try {
    response = await withDeadline(
      Promise.resolve(client.rpc(
        active ? 'canonical_v2_active_query_page_v2' : 'canonical_v2_query_page_v2',
        active ? activeRpcParams(compiled) : rpcParams(compiled),
      )),
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof CanonicalQueryError) throw error;
    throw new CanonicalQueryError('DATA_SOURCE_ERROR', 'The canonical query page could not be read.');
  }
  if (!response || response.error) {
    if (response?.error?.code === 'AT_CAPACITY') {
      throw new CanonicalQueryError('AT_CAPACITY', 'Canonical Query is at capacity.');
    }
    throw new CanonicalQueryError('DATA_SOURCE_ERROR', 'The canonical query page could not be read.');
  }
  const resolved = active
    ? resolveActiveQueryPage(response.data, compiled)
    : { request: compiled, result: validateCanonicalQueryPage(response.data, compiled) };
  if (!active && cache && typeof cache.set === 'function') {
    await cache.set(resolved.request.cache_key, resolved.result, cacheTtlSeconds);
  }
  return {
    request: resolved.request,
    result: buildCanonicalQueryResultView(resolved.result, resolved.request),
    cache: resolved.result.cache_state,
  };
}

module.exports = {
  COLUMN_DEFINITIONS,
  COLUMN_FILTER_KEYS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_TIMEOUT_MS,
  BUYER_FEE_METRIC,
  FEE_METRIC,
  FEE_METRICS,
  FIXTURE_CONTRACT_FINGERPRINT,
  IOC_CAPEX_METRIC,
  INTENTS,
  MATERIAL_CONTRACT_METRIC,
  NO_SHOP_NOTICE_METRIC,
  NO_SHOP_INITIAL_MATCH_METRIC,
  MAX_CACHE_TTL_SECONDS,
  MAX_COLUMNS,
  MAX_PAGE_SIZE,
  QUERY_METRICS,
  ACTIVE_RELEASE_SELECTOR,
  CanonicalQueryError,
  buildCanonicalQueryResultView,
  compileCanonicalActiveQueryRequest,
  compileCanonicalQueryRequest,
  projectSharedServingRowRecord,
  queryCanonicalResultPage,
  resolveActiveQueryPage,
  validateCanonicalQueryCohortSummary,
  validateCanonicalQueryPage,
};
