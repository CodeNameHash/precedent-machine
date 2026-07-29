const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const IDENTITY_SCHEMA = 'TEMPORAL_EXPRESSION_IDENTITY/V1';
const DRAFT_SCHEMA = 'TEMPORAL_EXPRESSION_LOSSLESS_DRAFT/V1';
const ID_DOMAIN = 'TEMPORAL_EXPRESSION/V1';
const IDENTITY_PAYLOAD_DOMAIN = 'TEMPORAL_EXPRESSION_IDENTITY_PAYLOAD/V1';
const DRAFT_PAYLOAD_DOMAIN = 'TEMPORAL_EXPRESSION_LOSSLESS_DRAFT_PAYLOAD/V1';
const LOGICAL_TYPE = 'TemporalExpression';
const COORDINATE_SPACE = 'ADMITTED_SOURCE_UTF8_BYTES';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const MAX_SOURCE_EXPRESSION_BYTES = 16384;

const TEMPORAL_DEFINITION = Object.freeze({
  definition_key: 'TEMPORAL_EXPRESSION',
  definition_version: 1,
});

const CONSUMER_DOMAINS = Object.freeze([
  'DEAL_FACT',
  'PARTICIPANT_ROLE',
  'PROFESSIONAL_ASSIGNMENT',
  'PROCESS_EVENT',
  'CVR_MILESTONE',
]);

const COARSE_TEMPORAL_STATES = Object.freeze([
  'EXPLICIT_DATE',
  'STATED_DURATION',
  'RELATIVE_OR_CONDITIONAL',
  'UNRESOLVED',
]);

const IDENTITY_INPUT_KEYS = Object.freeze([
  'admitted_source_occurrence_id',
  'expected_temporal_slot_key',
  'governed_ordinal',
  'governed_subject_id',
  'governed_subject_type',
  'temporal_definition_and_version',
]);

const IDENTITY_KEYS = Object.freeze([
  'schema_version',
  'logical_type',
  ...IDENTITY_INPUT_KEYS,
  'materialisation_state',
  'expected_occurrence_slot_binding_state',
  'authority_limits',
  'temporal_expression_id',
  'canonical_payload_digest',
]);

const SOURCE_INTERVAL_KEYS = Object.freeze([
  'coordinate_space',
  'admitted_source_occurrence_id',
  'document_hash',
  'absolute_start',
  'absolute_end',
  'exact_bytes_digest',
  'evidence_edge_id',
]);

const DRAFT_INPUT_KEYS = Object.freeze([
  'temporal_expression_identity',
  'coarse_temporal_state',
  'raw_source_expression',
  'source_interval',
  'structured_nodes',
  'computed_value',
  'computed_derivation',
]);

const DRAFT_KEYS = Object.freeze([
  'schema_version',
  'logical_type',
  'temporal_expression_identity',
  'temporal_expression_id',
  'state',
  'coarse_temporal_state',
  'raw_source_expression',
  'source_interval',
  'temporal_registry_version',
  'structured_nodes',
  'computed_value',
  'computed_derivation',
  'materialisation_state',
  'authority_limits',
  'canonical_payload_digest',
]);

const PROHIBITED_INTERPRETATION_INPUTS = new Set([
  'business_day_basis',
  'calendar_basis',
  'candidate_values',
  'duration_days',
  'extracted_attributes',
  'model_output',
  'normalised_date',
  'normalised_duration',
  'resolved_value',
  'selected_revision_id',
  'timezone',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  extraction: 'NONE',
  expected_occurrence_slot_binding: 'NONE',
  structured_interpretation: 'NONE',
  computation: 'NONE',
  revision: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessTemporalExpressionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessTemporalExpressionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessTemporalExpressionError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} does not have the exact required keys.`, {
      expected: required,
      actual,
    });
  }
}

function requireExactValue(actual, expected, label, code) {
  let equal = false;
  try {
    equal = canonicalJson(actual) === canonicalJson(expected);
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, { cause: error.message });
  }
  if (!equal) {
    fail(code, `${label} is not the approved value.`, { expected, actual });
  }
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
}

function requireGovernedKey(value, label, code) {
  if (
    typeof value !== 'string'
    || !GOVERNED_KEY_RE.test(value)
    || Buffer.byteLength(value, 'utf8') > 128
  ) {
    fail(code, `${label} must be a bounded governed upper-case key.`);
  }
}

function cloneCanonical(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, { cause: error.message });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function rejectInterpretationInputs(input) {
  requireObject(input, 'TemporalExpression input', 'INVALID_TEMPORAL_EXPRESSION');
  const prohibited = Object.keys(input)
    .filter((key) => PROHIBITED_INTERPRETATION_INPUTS.has(key))
    .sort();
  if (prohibited.length > 0) {
    fail(
      'TEMPORAL_EXPRESSION_UNGOVERNED_INTERPRETATION',
      'Normalised time, inferred values and model output cannot enter the empty temporal registry.',
      { prohibited_inputs: prohibited },
    );
  }
}

function temporalIdentity(input) {
  return {
    admitted_source_occurrence_id: input.admitted_source_occurrence_id,
    expected_temporal_slot_key: input.expected_temporal_slot_key,
    governed_ordinal: input.governed_ordinal,
    governed_subject_id: input.governed_subject_id,
    governed_subject_type: input.governed_subject_type,
    temporal_definition_and_version: input.temporal_definition_and_version,
  };
}

function validateIdentityInput(input) {
  const code = 'INVALID_TEMPORAL_EXPRESSION_IDENTITY';
  requireObject(input, 'TemporalExpression identity input', code);
  rejectInterpretationInputs(input);
  requireExactKeys(
    input,
    IDENTITY_INPUT_KEYS,
    'TemporalExpression identity input',
    code,
  );
  requireDigest(
    input.admitted_source_occurrence_id,
    'Admitted source occurrence ID',
    code,
  );
  requireGovernedKey(
    input.expected_temporal_slot_key,
    'Expected temporal slot key',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(code, 'The governed temporal ordinal must be a non-negative safe integer.');
  }
  requireDigest(input.governed_subject_id, 'Governed subject ID', code);
  if (!CONSUMER_DOMAINS.includes(input.governed_subject_type)) {
    fail(code, 'The governed temporal subject type is not admitted.');
  }
  requireExactValue(
    input.temporal_definition_and_version,
    TEMPORAL_DEFINITION,
    'Temporal definition identity',
    code,
  );
  return input;
}

function buildProcessTemporalExpressionIdentity(input) {
  validateIdentityInput(input);
  const identity = cloneCanonical(
    temporalIdentity(input),
    'TemporalExpression identity',
    'INVALID_TEMPORAL_EXPRESSION_IDENTITY',
  );
  const body = {
    schema_version: IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    ...identity,
    materialisation_state: 'IDENTITY_ONLY',
    expected_occurrence_slot_binding_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'TemporalExpression authority limits',
      'INVALID_TEMPORAL_EXPRESSION_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    temporal_expression_id: contentId(ID_DOMAIN, identity),
    canonical_payload_digest: contentId(IDENTITY_PAYLOAD_DOMAIN, body),
  });
}

function validateProcessTemporalExpressionIdentity(value) {
  const code = 'INVALID_TEMPORAL_EXPRESSION_IDENTITY';
  requireExactKeys(value, IDENTITY_KEYS, 'TemporalExpression identity', code);
  if (
    value.schema_version !== IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.expected_occurrence_slot_binding_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The TemporalExpression identity type or boundary state is invalid.');
  }
  const identity = temporalIdentity(value);
  validateIdentityInput(identity);
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'TemporalExpression authority limits',
    code,
  );
  if (value.temporal_expression_id !== contentId(ID_DOMAIN, identity)) {
    fail(
      'TEMPORAL_EXPRESSION_ID_MISMATCH',
      'The TemporalExpression ID does not bind the exact governed slot identity.',
    );
  }
  const body = { ...value };
  delete body.temporal_expression_id;
  delete body.canonical_payload_digest;
  if (
    value.canonical_payload_digest
    !== contentId(IDENTITY_PAYLOAD_DOMAIN, body)
  ) {
    fail(
      'TEMPORAL_EXPRESSION_IDENTITY_PAYLOAD_MISMATCH',
      'The TemporalExpression identity payload digest is invalid.',
    );
  }
  return value;
}

function validateSourceInterval(interval, identity, rawSourceExpression) {
  const code = 'INVALID_TEMPORAL_EXPRESSION_SOURCE_INTERVAL';
  requireExactKeys(
    interval,
    SOURCE_INTERVAL_KEYS,
    'TemporalExpression source interval',
    code,
  );
  if (interval.coordinate_space !== COORDINATE_SPACE) {
    fail(code, 'The temporal source interval uses the wrong coordinate space.');
  }
  requireDigest(
    interval.admitted_source_occurrence_id,
    'Source interval admitted occurrence ID',
    code,
  );
  requireDigest(interval.document_hash, 'Source interval document hash', code);
  requireDigest(
    interval.exact_bytes_digest,
    'Source interval exact bytes digest',
    code,
  );
  requireDigest(interval.evidence_edge_id, 'Source interval evidence edge ID', code);
  if (
    !Number.isSafeInteger(interval.absolute_start)
    || interval.absolute_start < 0
    || !Number.isSafeInteger(interval.absolute_end)
    || interval.absolute_end <= interval.absolute_start
  ) {
    fail(code, 'The temporal source interval has invalid half-open UTF-8 offsets.');
  }
  if (
    interval.admitted_source_occurrence_id
    !== identity.admitted_source_occurrence_id
  ) {
    fail(
      'TEMPORAL_EXPRESSION_SOURCE_OCCURRENCE_MISMATCH',
      'The temporal words do not bind the admitted source occurrence used by identity.',
    );
  }
  const sourceBytes = Buffer.from(rawSourceExpression, 'utf8');
  if (interval.absolute_end - interval.absolute_start !== sourceBytes.length) {
    fail(
      'TEMPORAL_EXPRESSION_SOURCE_LENGTH_MISMATCH',
      'The temporal source interval length does not match the exact UTF-8 words.',
    );
  }
  if (interval.exact_bytes_digest !== sha256Hex(sourceBytes)) {
    fail(
      'TEMPORAL_EXPRESSION_SOURCE_BYTES_MISMATCH',
      'The temporal source digest does not match the exact UTF-8 words.',
    );
  }
  return interval;
}

function validateRawSourceExpression(value) {
  if (
    typeof value !== 'string'
    || Buffer.byteLength(value, 'utf8') === 0
    || Buffer.byteLength(value, 'utf8') > MAX_SOURCE_EXPRESSION_BYTES
    || value.includes('\u0000')
  ) {
    fail(
      'INVALID_TEMPORAL_EXPRESSION_SOURCE_TEXT',
      'The temporal source expression must preserve bounded, non-empty UTF-8 text.',
    );
  }
}

function draftBody(input) {
  return {
    schema_version: DRAFT_SCHEMA,
    logical_type: LOGICAL_TYPE,
    temporal_expression_identity: input.temporal_expression_identity,
    temporal_expression_id: input.temporal_expression_identity.temporal_expression_id,
    state: 'PRESENT',
    coarse_temporal_state: input.coarse_temporal_state,
    raw_source_expression: input.raw_source_expression,
    source_interval: input.source_interval,
    temporal_registry_version: 1,
    structured_nodes: input.structured_nodes,
    computed_value: input.computed_value,
    computed_derivation: input.computed_derivation,
    materialisation_state: 'DRAFT_ONLY',
    authority_limits: AUTHORITY_LIMITS,
  };
}

function validateDraftInput(input) {
  const code = 'INVALID_TEMPORAL_EXPRESSION_DRAFT';
  requireObject(input, 'Lossless TemporalExpression draft input', code);
  rejectInterpretationInputs(input);
  requireExactKeys(
    input,
    DRAFT_INPUT_KEYS,
    'Lossless TemporalExpression draft input',
    code,
  );
  validateProcessTemporalExpressionIdentity(input.temporal_expression_identity);
  if (!COARSE_TEMPORAL_STATES.includes(input.coarse_temporal_state)) {
    fail(code, 'The coarse temporal state is not governed.');
  }
  validateRawSourceExpression(input.raw_source_expression);
  validateSourceInterval(
    input.source_interval,
    input.temporal_expression_identity,
    input.raw_source_expression,
  );
  requireExactValue(
    input.structured_nodes,
    [],
    'TemporalExpression structured nodes',
    code,
  );
  if (input.computed_value !== null || input.computed_derivation !== null) {
    fail(
      'TEMPORAL_EXPRESSION_COMPUTATION_NOT_ADMITTED',
      'The empty temporal registry cannot produce a computed temporal value.',
    );
  }
  return input;
}

function buildLosslessTemporalExpressionDraft(input) {
  validateDraftInput(input);
  const body = cloneCanonical(
    draftBody(input),
    'Lossless TemporalExpression draft',
    'INVALID_TEMPORAL_EXPRESSION_DRAFT',
  );
  return deepFreeze({
    ...body,
    canonical_payload_digest: contentId(DRAFT_PAYLOAD_DOMAIN, body),
  });
}

function validateLosslessTemporalExpressionDraft(value) {
  const code = 'INVALID_TEMPORAL_EXPRESSION_DRAFT';
  requireExactKeys(value, DRAFT_KEYS, 'Lossless TemporalExpression draft', code);
  if (
    value.schema_version !== DRAFT_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.state !== 'PRESENT'
    || value.temporal_registry_version !== 1
    || value.materialisation_state !== 'DRAFT_ONLY'
  ) {
    fail(code, 'The lossless TemporalExpression draft boundary is invalid.');
  }
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'TemporalExpression authority limits',
    code,
  );
  validateDraftInput({
    temporal_expression_identity: value.temporal_expression_identity,
    coarse_temporal_state: value.coarse_temporal_state,
    raw_source_expression: value.raw_source_expression,
    source_interval: value.source_interval,
    structured_nodes: value.structured_nodes,
    computed_value: value.computed_value,
    computed_derivation: value.computed_derivation,
  });
  if (
    value.temporal_expression_id
    !== value.temporal_expression_identity.temporal_expression_id
  ) {
    fail(
      'TEMPORAL_EXPRESSION_DRAFT_ID_MISMATCH',
      'The lossless draft does not bind its validated TemporalExpression identity.',
    );
  }
  const body = { ...value };
  delete body.canonical_payload_digest;
  if (value.canonical_payload_digest !== contentId(DRAFT_PAYLOAD_DOMAIN, body)) {
    fail(
      'TEMPORAL_EXPRESSION_DRAFT_PAYLOAD_MISMATCH',
      'The lossless TemporalExpression draft payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  ProcessTemporalExpressionError,
  buildLosslessTemporalExpressionDraft,
  buildProcessTemporalExpressionIdentity,
  validateLosslessTemporalExpressionDraft,
  validateProcessTemporalExpressionIdentity,
};
