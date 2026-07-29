const { canonicalJson, contentId } = require('./canonical-bytes');

const PARTICIPANT_IDENTITY_SCHEMA = 'PROCESS_PARTICIPANT_IDENTITY/V1';
const PARTICIPANT_ID_DOMAIN = 'PROCESS_PARTICIPANT/V1';
const PARTICIPANT_IDENTITY_PAYLOAD_DOMAIN =
  'PROCESS_PARTICIPANT_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessParticipant';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

const PARTICIPANT_IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'process_event_slot_key',
  'process_participant_slot_key',
  'governed_ordinal',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  'bidder_track_id',
  'candidate_values',
  'cleaned_name',
  'display_name',
  'entity_subject_id',
  'event_role_code',
  'extracted_attributes',
  'legal_role_code',
  'model_output',
  'source_local_label',
  'transaction_role_code',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  participant_role: 'NONE',
  subject_binding: 'NONE',
  bidder_track: 'NONE',
  event_materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessParticipantIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessParticipantIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessParticipantIdentityError(code, message, details);
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
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
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
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function rejectProhibitedIdentityInputs(input) {
  const prohibited = Object.keys(input)
    .filter((key) => PROHIBITED_IDENTITY_INPUTS.has(key))
    .sort();
  if (prohibited.length > 0) {
    fail(
      'PROCESS_PARTICIPANT_VALUE_DERIVED_IDENTITY',
      'Names, roles, bidder tracks, extracted values and model output cannot define participant identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function participantIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    process_event_slot_key: input.process_event_slot_key,
    process_participant_slot_key: input.process_participant_slot_key,
    governed_ordinal: input.governed_ordinal,
  };
}

function validateParticipantIdentityInput(input) {
  const code = 'INVALID_PROCESS_PARTICIPANT_IDENTITY';
  requireObject(input, 'Process participant identity input', code);
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    PARTICIPANT_IDENTITY_INPUT_KEYS,
    'Process participant identity input',
    code,
  );
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
    input.process_event_slot_key,
    'Process event slot key',
    code,
  );
  requireGovernedKey(
    input.process_participant_slot_key,
    'Process participant slot key',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(code, 'The governed participant ordinal must be a non-negative safe integer.');
  }
  return input;
}

function buildProcessParticipantIdentity(input) {
  validateParticipantIdentityInput(input);
  const identity = cloneCanonical(
    participantIdentity(input),
    'Process participant identity',
    'INVALID_PROCESS_PARTICIPANT_IDENTITY',
  );
  const body = {
    schema_version: PARTICIPANT_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    frozen_contract_pair_digest: identity.frozen_contract_pair_digest,
    governed_deal_admission_id: identity.governed_deal_admission_id,
    process_event_slot_key: identity.process_event_slot_key,
    process_participant_slot_key: identity.process_participant_slot_key,
    governed_ordinal: identity.governed_ordinal,
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'Process participant authority limits',
      'INVALID_PROCESS_PARTICIPANT_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    process_participant_id: contentId(
      PARTICIPANT_ID_DOMAIN,
      participantIdentity(body),
    ),
    canonical_payload_digest: contentId(
      PARTICIPANT_IDENTITY_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessParticipantIdentity(value) {
  const code = 'INVALID_PROCESS_PARTICIPANT_IDENTITY';
  requireExactKeys(value, [
    'schema_version',
    'logical_type',
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'process_event_slot_key',
    'process_participant_slot_key',
    'governed_ordinal',
    'authority_limits',
    'process_participant_id',
    'canonical_payload_digest',
  ], 'Process participant identity', code);
  if (
    value.schema_version !== PARTICIPANT_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
  ) {
    fail(code, 'The Process participant identity type is invalid.');
  }
  validateParticipantIdentityInput(participantIdentity(value));
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'Process participant authority limits',
    code,
  );
  const expectedParticipantId = contentId(
    PARTICIPANT_ID_DOMAIN,
    participantIdentity(value),
  );
  if (value.process_participant_id !== expectedParticipantId) {
    fail(
      'PROCESS_PARTICIPANT_ID_MISMATCH',
      'The participant ID does not bind the exact frozen slot identity.',
    );
  }
  const body = { ...value };
  delete body.process_participant_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    PARTICIPANT_IDENTITY_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_PARTICIPANT_PAYLOAD_MISMATCH',
      'The participant identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  ProcessParticipantIdentityError,
  buildProcessParticipantIdentity,
  validateProcessParticipantIdentity,
};
