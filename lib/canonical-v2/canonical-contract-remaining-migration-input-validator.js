const { canonicalJson } = require('./canonical-bytes');

const SERVING_METRIC_OPERATION_BINDING_INPUT_KIND =
  'SERVING_METRIC_OPERATION_BINDING_INPUT';
const SERVING_METRIC_OPERATION_BINDING_INPUT_VERSION =
  'SERVING_METRIC_OPERATION_BINDING_INPUT/V1';
const SERVING_TRIGGER_PATH_SCHEMA_INPUT_KIND = 'SERVING_TRIGGER_PATH_SCHEMA_INPUT';
const SERVING_TRIGGER_PATH_SCHEMA_INPUT_VERSION = 'SERVING_TRIGGER_PATH_SCHEMA_INPUT/V1';
const SOURCE_FIXTURE = 'FIXTURE_CONTRACT_INPUT_V12';
const MIGRATION_INPUT_AUTHORITY = 'MIGRATION_INPUT_ONLY';
const MARKET_METRIC_DEFINITION_INPUT_KIND =
  'MARKET_METRIC_DEFINITION_INPUT';
const MARKET_METRIC_DEFINITION_INPUT_VERSION =
  'MARKET_METRIC_DEFINITION_INPUT/V1';
const TERMINATION_FEE_BINDING_CONTRACTS = Object.freeze({
  'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2': Object.freeze({
    concept_key: 'TERMF-REVERSE',
    fee_side: 'BUYER',
    legal_operation: 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER',
    metric_key: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    payee: Object.freeze({
      capacity: 'TARGET',
      role: 'FEE_PAYEE',
      value: 'COMPANY',
    }),
    payer: Object.freeze({
      capacity: 'BUYER',
      role: 'FEE_PAYER',
      value: 'PARENT',
    }),
  }),
  'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE/V2': Object.freeze({
    concept_key: 'TERMF-TARGET',
    fee_side: 'SELLER',
    legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
    metric_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    payee: Object.freeze({
      capacity: 'BUYER',
      role: 'FEE_PAYEE',
      value: 'PARENT',
    }),
    payer: Object.freeze({
      capacity: 'TARGET',
      role: 'FEE_PAYER',
      value: 'COMPANY',
    }),
  }),
});

class CanonicalContractRemainingMigrationInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractRemainingMigrationInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractRemainingMigrationInputError(code, message, details);
}

function requireExactObject(value, keys, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} fields do not match the migration-input contract.`, {
      actual,
      expected,
    });
  }
}

function requireOrderedUniqueStrings(value, code, label) {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some((entry) => typeof entry !== 'string' || entry.length === 0)
    || new Set(value).size !== value.length
  ) {
    fail(code, `${label} must be a non-empty ordered array of unique strings.`);
  }
}

function validateTerminationFeeMetricBinding(value, authoredMembers) {
  const code = 'INVALID_CANONICAL_BUNDLE_SERVING_METRIC_OPERATION_BINDING_INPUT';
  const binding = value.authored_binding;
  const expected = TERMINATION_FEE_BINDING_CONTRACTS[binding.binding_key];
  if (!expected) return;
  requireExactObject(binding, [
    'binding_key',
    'concept_key',
    'fee_side',
    'legal_operation',
    'metric_definition_identity',
    'metric_key',
    'metric_version',
    'payee',
    'payer',
    'relationship_key',
    'required_claim_definition_key',
    'trigger_path_schema_key',
    'trigger_path_schema_version',
  ], code, 'termination-fee metric-operation binding');
  requireExactObject(binding.metric_definition_identity, [
    'metric_version',
    'object_kind',
    'schema_version',
    'stable_id',
  ], code, 'termination-fee MetricDefinition identity');
  requireExactObject(binding.payer, [
    'capacity',
    'role',
    'value',
  ], code, 'termination-fee payer');
  requireExactObject(binding.payee, [
    'capacity',
    'role',
    'value',
  ], code, 'termination-fee payee');

  const metricMembers = authoredMembers.filter((member) => (
    member?.object_kind === MARKET_METRIC_DEFINITION_INPUT_KIND
    && member.canonical_value?.stable_id === expected.metric_key
  ));
  const metric = metricMembers[0]?.canonical_value;
  const definition = metric?.authored_definition;
  const identity = binding.metric_definition_identity;
  if (
    metricMembers.length !== 1
    || identity.object_kind !== MARKET_METRIC_DEFINITION_INPUT_KIND
    || identity.schema_version !== MARKET_METRIC_DEFINITION_INPUT_VERSION
    || identity.stable_id !== expected.metric_key
    || identity.metric_version !== 1
    || metric.object_kind !== identity.object_kind
    || metric.schema_version !== identity.schema_version
    || metric.stable_id !== identity.stable_id
    || definition?.metric_version !== identity.metric_version
    || binding.metric_key !== expected.metric_key
    || binding.metric_version !== identity.metric_version
    || binding.required_claim_definition_key !== expected.metric_key
    || binding.concept_key !== expected.concept_key
    || binding.fee_side !== expected.fee_side
    || binding.legal_operation !== expected.legal_operation
    || binding.relationship_key !== 'TRIGGERED_BY'
    || binding.trigger_path_schema_key !== 'TERMINATION_FEE_TRIGGER_PATH'
    || binding.trigger_path_schema_version !== 2
    || canonicalJson(binding.payer) !== canonicalJson(expected.payer)
    || canonicalJson(binding.payee) !== canonicalJson(expected.payee)
    || definition.fee_side !== binding.fee_side
    || definition.concept_key !== binding.concept_key
    || definition.required_claim_definition_key
      !== binding.required_claim_definition_key
    || definition.required_relationship_key !== binding.relationship_key
    || definition.required_relationship_version !== 2
    || canonicalJson(definition.payer) !== canonicalJson(binding.payer)
    || canonicalJson(definition.payee) !== canonicalJson(binding.payee)
  ) {
    fail(
      code,
      'Termination-fee serving binding does not match its exact MetricDefinition identity and legal semantics.',
      { binding_key: binding.binding_key },
    );
  }
}

function validateMetricBindingInput(value, authoredMembers) {
  const code = 'INVALID_CANONICAL_BUNDLE_SERVING_METRIC_OPERATION_BINDING_INPUT';
  requireExactObject(value, [
    'authored_binding',
    'object_kind',
    'schema_version',
    'stable_id',
  ], code, 'serving metric-operation binding input');
  const binding = value.authored_binding;
  if (
    value.object_kind !== SERVING_METRIC_OPERATION_BINDING_INPUT_KIND
    || value.schema_version !== SERVING_METRIC_OPERATION_BINDING_INPUT_VERSION
    || !binding
    || typeof binding !== 'object'
    || Array.isArray(binding)
    || typeof binding.binding_key !== 'string'
    || binding.binding_key.length === 0
    || value.stable_id !== binding.binding_key
    || !Number.isSafeInteger(binding.metric_version)
    || binding.metric_version < 1
    || !Number.isSafeInteger(binding.trigger_path_schema_version)
    || binding.trigger_path_schema_version < 1
  ) {
    fail(code, 'Serving metric-operation binding input does not match its envelope.', {
      stable_id: value.stable_id ?? null,
    });
  }
  validateTerminationFeeMetricBinding(value, authoredMembers);
}

function validateTriggerPathSchemaInput(value) {
  const code = 'INVALID_CANONICAL_BUNDLE_SERVING_TRIGGER_PATH_SCHEMA_INPUT';
  requireExactObject(value, [
    'authored_schema',
    'object_kind',
    'schema_version',
    'stable_id',
  ], code, 'serving trigger-path schema input');
  const schema = value.authored_schema;
  if (
    value.object_kind !== SERVING_TRIGGER_PATH_SCHEMA_INPUT_KIND
    || value.schema_version !== SERVING_TRIGGER_PATH_SCHEMA_INPUT_VERSION
    || !schema
    || typeof schema !== 'object'
    || Array.isArray(schema)
    || typeof schema.schema_key !== 'string'
    || schema.schema_key.length === 0
    || value.stable_id !== schema.schema_key
    || !Number.isSafeInteger(schema.schema_version)
    || schema.schema_version < 1
  ) {
    fail(code, 'Serving trigger-path schema input does not match its envelope.', {
      stable_id: value.stable_id ?? null,
    });
  }
}

const CODEBOOK_INPUTS = Object.freeze({
  CLAIM_STATE_CODEBOOK_MIGRATION_INPUT: Object.freeze({
    object_kind: 'CLAIM_STATE_CODEBOOK_MIGRATION_INPUT',
    schema_version: 'CLAIM_STATE_CODEBOOK_MIGRATION_INPUT/V1',
    stable_id: 'FIXTURE_CONTRACT_INPUT_V12_CLAIM_STATES',
    ordered_field: 'ordered_values',
  }),
  PARTY_TUPLE_SHAPE_MIGRATION_INPUT: Object.freeze({
    object_kind: 'PARTY_TUPLE_SHAPE_MIGRATION_INPUT',
    schema_version: 'PARTY_TUPLE_SHAPE_MIGRATION_INPUT/V1',
    stable_id: 'FIXTURE_CONTRACT_INPUT_V12_PARTY_TUPLE_FIELDS',
    ordered_field: 'ordered_fields',
  }),
  RESIDUAL_REASON_CODEBOOK_MIGRATION_INPUT: Object.freeze({
    object_kind: 'RESIDUAL_REASON_CODEBOOK_MIGRATION_INPUT',
    schema_version: 'RESIDUAL_REASON_CODEBOOK_MIGRATION_INPUT/V1',
    stable_id: 'FIXTURE_CONTRACT_INPUT_V12_RESIDUAL_REASON_CODES',
    ordered_field: 'ordered_values',
  }),
});

function validateCodebookInput(value, config) {
  const code = `INVALID_CANONICAL_BUNDLE_${value.object_kind}`;
  requireExactObject(value, [
    'authority',
    'object_kind',
    config.ordered_field,
    'schema_version',
    'source_fixture',
    'stable_id',
  ], code, 'codebook or shape migration input');
  if (
    value.object_kind !== config.object_kind
    || value.schema_version !== config.schema_version
    || value.stable_id !== config.stable_id
    || value.source_fixture !== SOURCE_FIXTURE
    || value.authority !== MIGRATION_INPUT_AUTHORITY
  ) {
    fail(code, 'Codebook or shape migration input constants do not match.', {
      stable_id: value.stable_id ?? null,
    });
  }
  requireOrderedUniqueStrings(
    value[config.ordered_field],
    code,
    `codebook or shape migration input.${config.ordered_field}`,
  );
}

function validateAuthoredRemainingMigrationInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  for (const member of authoredMembers) {
    const value = member?.canonical_value;
    if (member?.object_kind === SERVING_METRIC_OPERATION_BINDING_INPUT_KIND) {
      validateMetricBindingInput(value, authoredMembers);
    } else if (member?.object_kind === SERVING_TRIGGER_PATH_SCHEMA_INPUT_KIND) {
      validateTriggerPathSchemaInput(value);
    } else if (CODEBOOK_INPUTS[member?.object_kind]) {
      validateCodebookInput(value, CODEBOOK_INPUTS[member.object_kind]);
    }
  }
}

module.exports = {
  SERVING_METRIC_OPERATION_BINDING_INPUT_KIND,
  SERVING_METRIC_OPERATION_BINDING_INPUT_VERSION,
  SERVING_TRIGGER_PATH_SCHEMA_INPUT_KIND,
  SERVING_TRIGGER_PATH_SCHEMA_INPUT_VERSION,
  CanonicalContractRemainingMigrationInputError,
  validateAuthoredRemainingMigrationInputs,
};
