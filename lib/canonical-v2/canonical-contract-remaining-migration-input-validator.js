const SERVING_METRIC_OPERATION_BINDING_INPUT_KIND =
  'SERVING_METRIC_OPERATION_BINDING_INPUT';
const SERVING_METRIC_OPERATION_BINDING_INPUT_VERSION =
  'SERVING_METRIC_OPERATION_BINDING_INPUT/V1';
const SERVING_TRIGGER_PATH_SCHEMA_INPUT_KIND = 'SERVING_TRIGGER_PATH_SCHEMA_INPUT';
const SERVING_TRIGGER_PATH_SCHEMA_INPUT_VERSION = 'SERVING_TRIGGER_PATH_SCHEMA_INPUT/V1';
const SOURCE_FIXTURE = 'FIXTURE_CONTRACT_INPUT_V12';
const MIGRATION_INPUT_AUTHORITY = 'MIGRATION_INPUT_ONLY';

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

function validateMetricBindingInput(value) {
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
      validateMetricBindingInput(value);
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
