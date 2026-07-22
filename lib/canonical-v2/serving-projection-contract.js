const { canonicalJson, contentId } = require('./canonical-bytes');

const SERVING_PROJECTION_VERSION_V1 = 'canonical-v2-serving/v1';
const SERVING_PROJECTION_VERSION_V2 = 'canonical-v2-serving/v2';
const QUERY_PROJECTION_RECORD_FIELDS_V1 = Object.freeze([
  'adviser_firms',
  'announce_year',
  'basis_key',
  'buyer',
  'canonical_numeric_value',
  'canonical_payload',
  'canonical_payload_digest',
  'cash_flow_direction_code',
  'comparison_operator',
  'concept_key',
  'contract_fingerprint',
  'contract_scope_code',
  'corpus_release_id',
  'criterion_code',
  'deal_value_usd',
  'fee_side',
  'governed_deal_key',
  'lawyers',
  'measurement_period_code',
  'merger_form',
  'metric_key',
  'metric_version',
  'party_capacity',
  'party_role',
  'party_value',
  'payee_capacity',
  'payer_capacity',
  'row_serving_key',
  'sector',
  'serving_namespace_id',
  'trigger_codes',
]);
const QUERY_PROJECTION_RECORD_FIELDS_V2 = Object.freeze([
  'adviser_firms',
  'announce_year',
  'basis_key',
  'buyer',
  'canonical_numeric_value',
  'canonical_payload',
  'canonical_payload_digest',
  'cash_flow_direction_code',
  'comparison_operator',
  'concept_key',
  'contract_fingerprint',
  'contract_scope_code',
  'corpus_release_id',
  'criterion_code',
  'deal_value_usd',
  'fee_side',
  'governed_deal_key',
  'lawyers',
  'measurement_period_code',
  'merger_form',
  'metric_key',
  'metric_version',
  'party_capacity',
  'party_role',
  'party_value',
  'payee_capacity',
  'payer_capacity',
  'payment_timings',
  'row_serving_key',
  'sector',
  'serving_namespace_id',
  'trigger_codes',
  'trigger_conditions',
]);
const QUERY_PROJECTION_CONTRACT_V2 = Object.freeze({
  schema_version: 'CANONICAL_QUERY_PROJECTION_CONTRACT/V2',
  projection_version: SERVING_PROJECTION_VERSION_V2,
  record_fields: QUERY_PROJECTION_RECORD_FIELDS_V2,
});
const QUERY_PROJECTION_CONTRACT_DIGEST_V2 = contentId(
  'CANONICAL_QUERY_PROJECTION_CONTRACT/V2',
  QUERY_PROJECTION_CONTRACT_V2,
);
const SERVING_PROJECTION_VERSION = SERVING_PROJECTION_VERSION_V2;
const QUERY_PROJECTION_RECORD_FIELDS = QUERY_PROJECTION_RECORD_FIELDS_V2;
const QUERY_PROJECTION_CONTRACT = QUERY_PROJECTION_CONTRACT_V2;
const QUERY_PROJECTION_CONTRACT_DIGEST = QUERY_PROJECTION_CONTRACT_DIGEST_V2;

function validateQueryProjectionRecordContract(record, projectionVersion = SERVING_PROJECTION_VERSION_V2) {
  const fields = projectionVersion === SERVING_PROJECTION_VERSION_V1
    ? QUERY_PROJECTION_RECORD_FIELDS_V1
    : projectionVersion === SERVING_PROJECTION_VERSION_V2
      ? QUERY_PROJECTION_RECORD_FIELDS_V2
      : null;
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || fields === null
    || canonicalJson(Object.keys(record).sort()) !== canonicalJson(fields)) {
    throw new TypeError('query projection record does not match its governed projection contract');
  }
  return true;
}

module.exports = {
  QUERY_PROJECTION_CONTRACT,
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  QUERY_PROJECTION_CONTRACT_DIGEST,
  QUERY_PROJECTION_CONTRACT_V2,
  QUERY_PROJECTION_RECORD_FIELDS,
  QUERY_PROJECTION_RECORD_FIELDS_V1,
  QUERY_PROJECTION_RECORD_FIELDS_V2,
  SERVING_PROJECTION_VERSION,
  SERVING_PROJECTION_VERSION_V1,
  SERVING_PROJECTION_VERSION_V2,
  validateQueryProjectionRecordContract,
};
