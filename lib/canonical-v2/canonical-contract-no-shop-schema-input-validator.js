const { canonicalJson } = require('./canonical-bytes');

const NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND = 'NO_SHOP_SEMANTIC_SCHEMA_INPUT';
const NO_SHOP_SEMANTIC_SCHEMA_INPUT_VERSION = 'NO_SHOP_SEMANTIC_SCHEMA_INPUT/V1';
const COPY_DELIVERY_METRIC_STABLE_ID = 'NO_SHOP_COPY_DELIVERY_PERIOD_DAYS';
const COPY_DELIVERY_METRIC_DEFINITION = Object.freeze({
  metric_key: COPY_DELIVERY_METRIC_STABLE_ID,
  metric_version: 1,
  concept_key: 'NOSOL-NOTICE',
  owner_lineage_mode: 'RESULT_CLAIM',
  required_claim_definition_key: COPY_DELIVERY_METRIC_STABLE_ID,
  required_relationship_key: null,
  value_dimension: 'DURATION',
  canonical_unit: 'DAYS',
  basis_key: 'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT',
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING',
  allowed_day_bases: ['ELAPSED'],
  trigger: 'PROPOSAL_OR_REQUEST_RECEIPT',
  trigger_expression_operator: 'ANY_OF',
  trigger_operand_codes: [
    'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
    'RECEIPT_OF_SOURCE_DEFINED_COMPANY_REQUEST',
  ],
  trigger_operand_sufficiency: 'EACH_OPERAND_INDEPENDENTLY_SUFFICIENT',
  company_request_semantic_code:
    'NON_PUBLIC_INFORMATION_OR_ACCESS_REQUEST_REASONABLY_EXPECTED_TO_GIVE_RISE_TO_OR_RESULT_IN_COMPANY_ACQUISITION_PROPOSAL',
  interpretation_policy_version: 'CLAIM_INTERPRETATION_POLICY/V2',
  accepted_clarity_states: ['CLEAR', 'REASONABLE_BUT_AMBIGUOUS'],
  accepted_ambiguity_dimension_codes: ['REFERENT', 'SCOPE', 'CARDINALITY'],
  accepted_comparability_effect_codes: [
    'AMBIGUITY_AFFECTS_METRIC_OR_COHORT',
  ],
  metric_role: 'COPY_DEADLINE_FROM_PROPOSAL_OR_REQUEST_RECEIPT',
  display_label: 'Copy-delivery deadline after proposal/request receipt',
  trigger_label:
    'Receipt by the Company of a Company Acquisition Proposal or Company Request',
  display_value_policy: 'PROMPTLY_WITH_OUTSIDE_CAP',
  per_deal_rollup: 'DISTINCT_VALUE_SET',
  weighting: 'DEAL',
});

class CanonicalContractNoShopSchemaInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractNoShopSchemaInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(message, details = {}) {
  throw new CanonicalContractNoShopSchemaInputError(
    'INVALID_CANONICAL_BUNDLE_NO_SHOP_SEMANTIC_SCHEMA_INPUT',
    message,
    details,
  );
}

function validateNoShopSemanticSchemaInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('No-shop semantic schema input must be an object.');
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [
    'authored_schema',
    'object_kind',
    'schema_version',
    'stable_id',
  ];
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    fail('No-shop semantic schema input fields do not match the authored contract.', {
      actual: actualKeys,
      expected: expectedKeys,
    });
  }
  const authoredSchema = value.authored_schema;
  if (
    value.object_kind !== NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND
    || value.schema_version !== NO_SHOP_SEMANTIC_SCHEMA_INPUT_VERSION
    || !authoredSchema
    || typeof authoredSchema !== 'object'
    || Array.isArray(authoredSchema)
    || typeof authoredSchema.schema_key !== 'string'
    || authoredSchema.schema_key.length === 0
    || value.stable_id !== authoredSchema.schema_key
    || !Number.isSafeInteger(authoredSchema.schema_version)
    || authoredSchema.schema_version < 1
  ) {
    fail('No-shop semantic schema input does not match the authored envelope.', {
      stable_id: value.stable_id ?? null,
    });
  }
}

function canonicalValue(authoredMembers, objectKind, stableId) {
  return authoredMembers.find(
    (member) => member?.object_kind === objectKind
      && member.canonical_value?.stable_id === stableId,
  )?.canonical_value || null;
}

function validateCopyDeliveryMetricBinding(authoredMembers) {
  const notice = canonicalValue(
    authoredMembers,
    NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND,
    'NO_SHOP_NOTICE_OBLIGATION',
  );
  if (!notice) return;
  const claim = canonicalValue(
    authoredMembers,
    'CLAIM_DEFINITION',
    COPY_DELIVERY_METRIC_STABLE_ID,
  );
  const metric = canonicalValue(
    authoredMembers,
    'MARKET_METRIC_DEFINITION_INPUT',
    COPY_DELIVERY_METRIC_STABLE_ID,
  );
  const noticeSchema = notice.authored_schema;
  const metricContract = noticeSchema?.copy_clock_scope_contract
    ?.primary_metric_contract;
  if (
    noticeSchema?.record_schema !== 'NO_SHOP_NOTICE_OBLIGATION/V6'
    || noticeSchema.copy_timing_claim_definition_key
      !== COPY_DELIVERY_METRIC_STABLE_ID
    || metricContract?.metric_key !== COPY_DELIVERY_METRIC_STABLE_ID
    || metricContract.metric_version !== 1
    || metricContract.required_claim_definition_key
      !== COPY_DELIVERY_METRIC_STABLE_ID
    || metricContract.metric_role
      !== COPY_DELIVERY_METRIC_DEFINITION.metric_role
    || metricContract.required_basis_key
      !== COPY_DELIVERY_METRIC_DEFINITION.basis_key
    || metricContract.required_trigger
      !== COPY_DELIVERY_METRIC_DEFINITION.trigger
    || !claim
    || claim.claim_definition_key !== COPY_DELIVERY_METRIC_STABLE_ID
    || claim.version !== 1
    || claim.canonical_value_type !== 'NON_NEGATIVE_DECIMAL_STRING'
    || !metric
    || metric.object_kind !== 'MARKET_METRIC_DEFINITION_INPUT'
    || metric.schema_version !== 'MARKET_METRIC_DEFINITION_INPUT/V1'
    || canonicalJson(metric.authored_definition)
      !== canonicalJson(COPY_DELIVERY_METRIC_DEFINITION)
  ) {
    fail('The no-shop copy clock is not bound to its exact claim and market metric.');
  }
}

function validateAuthoredNoShopSchemaInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  for (const member of authoredMembers) {
    if (member?.object_kind === NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND) {
      validateNoShopSemanticSchemaInput(member.canonical_value);
    }
  }
  validateCopyDeliveryMetricBinding(authoredMembers);
}

module.exports = {
  COPY_DELIVERY_METRIC_DEFINITION,
  COPY_DELIVERY_METRIC_STABLE_ID,
  NO_SHOP_SEMANTIC_SCHEMA_INPUT_KIND,
  NO_SHOP_SEMANTIC_SCHEMA_INPUT_VERSION,
  CanonicalContractNoShopSchemaInputError,
  validateAuthoredNoShopSchemaInputs,
};
