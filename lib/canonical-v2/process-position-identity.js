const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const positionContract = require(
  '../../contracts/canonical-v2/successor/process/positions/process-position.v1.json',
);

const POSITION_IDENTITY_SCHEMA = 'PROCESS_POSITION_IDENTITY/V1';
const POSITION_ID_DOMAIN = 'PROCESS_POSITION/V1';
const POSITION_PAYLOAD_DOMAIN = 'PROCESS_POSITION_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessPosition';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

const IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'process_position_slot_key',
  'governed_ordinal',
]);

const IDENTITY_KEYS = Object.freeze([
  'schema_version',
  'logical_type',
  ...IDENTITY_INPUT_KEYS,
  'materialisation_state',
  'expected_occurrence_slot_binding_state',
  'subject_binding_state',
  'term_registry_state',
  'position_value_registry_state',
  'event_link_state',
  'consideration_link_state',
  'temporal_binding_state',
  'authority_limits',
  'process_position_id',
  'canonical_payload_digest',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  ...positionContract.definition.position_identity.prohibited_inputs,
  'candidate_values',
  'evidence_edges',
  'expected_occurrence_id',
  'exact_source_formulation',
  'failure_detail',
  'position_state',
  'precomputed_process_position_id',
  'slot_binding',
  'subject_reference',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  expected_occurrence_slot_binding: 'NONE',
  subject_binding: 'NONE',
  term_registry: 'NONE',
  position_value_registry: 'NONE',
  event_link: 'NONE',
  consideration_link: 'NONE',
  temporal_binding: 'NONE',
  position_revision: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessPositionIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPositionIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPositionIdentityError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
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
    fail(code, `${label} is not the approved value.`, {
      expected,
      actual,
    });
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

function validateContractBinding() {
  const code = 'INVALID_PROCESS_POSITION_CONTRACT_BINDING';
  const definition = positionContract.definition;
  if (
    positionContract.object_kind !== 'PROCESS_LOGICAL_TYPE_INPUT'
    || positionContract.stable_id !== 'PROCESS_POSITION'
    || positionContract.schema_version !== 'PROCESS_LOGICAL_TYPE_INPUT/V1'
    || definition?.logical_type !== LOGICAL_TYPE
    || definition?.logical_type_version !== 1
  ) {
    fail(code, 'The ProcessPosition contract identity is invalid.');
  }
  requireExactValue(
    definition.position_identity.stable_id_inputs,
    IDENTITY_INPUT_KEYS,
    'ProcessPosition stable ID inputs',
    code,
  );
  requireExactValue(
    definition.subject_contract.allowed_subject_logical_types,
    ['BidderTrack', 'ProcessParticipant'],
    'ProcessPosition subject logical types',
    code,
  );
  requireExactValue(
    definition.subject_contract.allowed_subject_definition_stable_ids,
    ['BIDDER_TRACK', 'PROCESS_PARTICIPANT'],
    'ProcessPosition subject definitions',
    code,
  );
  const slot = definition.occurrence_slot_contract;
  const subject = definition.subject_contract;
  const term = definition.term_contract;
  const position = definition.position_value_contract;
  if (
    slot.slot_key_field !== 'process_position_slot_key'
    || slot.slot_frozen_before_candidate_values !== true
    || slot.slot_key_is_self_authorising !== false
    || slot.precomputed_expected_occurrence_id_binding_required !== true
    || slot.unresolved_or_missing_slot_blocks_materialisation !== true
    || slot.identity_only_kernel_grants_materialisation_authority !== false
    || subject.exactly_one_typed_subject_required_when_present !== true
    || subject.same_frozen_contract_pair_required !== true
    || subject.same_governed_deal_required !== true
    || subject.free_text_label_can_create_subject !== false
    || term.term_code_registry_required_before_materialisation !== true
    || term.unknown_term_code_has_runtime_path !== false
    || term.free_text_term_label_can_create_code !== false
    || position.position_code_registry_required_before_materialisation !== true
    || position.silence_can_create_express_refusal !== false
    || position.no_recorded_grant_can_create_express_refusal !== false
  ) {
    fail(code, 'The ProcessPosition identity or value boundary is weakened.');
  }
  const authority = definition.authority_contract;
  if (
    authority.creates_runtime_position !== false
    || authority.creates_writer_authority !== false
    || authority.creates_serving_authority !== false
    || authority.creates_release_authority !== false
    || authority.creates_contract_freeze_authority !== false
  ) {
    fail(code, 'The ProcessPosition definition grants prohibited authority.');
  }
}

function rejectProhibitedIdentityInputs(input) {
  requireObject(
    input,
    'ProcessPosition identity input',
    'INVALID_PROCESS_POSITION_IDENTITY',
  );
  const prohibited = Object.keys(input)
    .filter((key) => PROHIBITED_IDENTITY_INPUTS.has(key))
    .sort();
  if (prohibited.length > 0) {
    fail(
      'PROCESS_POSITION_VALUE_DERIVED_IDENTITY',
      'Subjects, values, links, evidence and model output cannot define ProcessPosition identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function positionIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    process_position_slot_key: input.process_position_slot_key,
    governed_ordinal: input.governed_ordinal,
  };
}

function validateProcessPositionIdentityInput(input) {
  const code = 'INVALID_PROCESS_POSITION_IDENTITY';
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    IDENTITY_INPUT_KEYS,
    'ProcessPosition identity input',
    code,
  );
  validateContractBinding();
  requireDigest(
    input.frozen_contract_pair_digest,
    'Frozen contract pair digest',
    code,
  );
  requireDigest(
    input.governed_deal_admission_id,
    'Governed deal admission ID',
    code,
  );
  requireGovernedKey(
    input.process_position_slot_key,
    'ProcessPosition slot key',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(
      code,
      'The governed ProcessPosition ordinal must be a non-negative safe integer.',
    );
  }
  return input;
}

function buildProcessPositionIdentity(input) {
  validateProcessPositionIdentityInput(input);
  const identity = cloneCanonical(
    positionIdentity(input),
    'ProcessPosition identity',
    'INVALID_PROCESS_POSITION_IDENTITY',
  );
  const body = {
    schema_version: POSITION_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    ...identity,
    materialisation_state: 'IDENTITY_ONLY',
    expected_occurrence_slot_binding_state: 'UNRESOLVED',
    subject_binding_state: 'UNRESOLVED',
    term_registry_state: 'UNRESOLVED',
    position_value_registry_state: 'UNRESOLVED',
    event_link_state: 'UNRESOLVED',
    consideration_link_state: 'UNRESOLVED',
    temporal_binding_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'ProcessPosition authority limits',
      'INVALID_PROCESS_POSITION_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    process_position_id: contentId(
      POSITION_ID_DOMAIN,
      positionIdentity(body),
    ),
    canonical_payload_digest: contentId(
      POSITION_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessPositionIdentity(value) {
  const code = 'INVALID_PROCESS_POSITION_IDENTITY';
  requireExactKeys(
    value,
    IDENTITY_KEYS,
    'ProcessPosition identity',
    code,
  );
  if (
    value.schema_version !== POSITION_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.expected_occurrence_slot_binding_state !== 'UNRESOLVED'
    || value.subject_binding_state !== 'UNRESOLVED'
    || value.term_registry_state !== 'UNRESOLVED'
    || value.position_value_registry_state !== 'UNRESOLVED'
    || value.event_link_state !== 'UNRESOLVED'
    || value.consideration_link_state !== 'UNRESOLVED'
    || value.temporal_binding_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The ProcessPosition identity type or boundary state is invalid.');
  }
  validateProcessPositionIdentityInput(positionIdentity(value));
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'ProcessPosition authority limits',
    code,
  );
  const expectedId = contentId(
    POSITION_ID_DOMAIN,
    positionIdentity(value),
  );
  if (value.process_position_id !== expectedId) {
    fail(
      'PROCESS_POSITION_ID_MISMATCH',
      'The ProcessPosition ID does not bind the exact frozen identity.',
    );
  }
  const body = { ...value };
  delete body.process_position_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    POSITION_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_POSITION_PAYLOAD_MISMATCH',
      'The ProcessPosition identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  AUTHORITY_LIMITS,
  ProcessPositionIdentityError,
  buildProcessPositionIdentity,
  validateProcessPositionIdentity,
};
