const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  validateBidderTrackIdentity,
} = require('./process-bidder-track-identity');
const phaseContract = require(
  '../../contracts/canonical-v2/successor/process/phases/process-phase.v1.json',
);

const PHASE_IDENTITY_SCHEMA = 'PROCESS_PHASE_IDENTITY/V1';
const PHASE_ID_DOMAIN = 'PROCESS_PHASE/V1';
const PHASE_IDENTITY_PAYLOAD_DOMAIN = 'PROCESS_PHASE_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'ProcessPhase';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

const PHASE_IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'phase_scope_kind_and_id',
  'process_phase_slot_key',
  'governed_ordinal',
]);

const DEAL_SCOPE_KEYS = Object.freeze([
  'scope_kind',
  'governed_deal_admission_id',
]);

const BIDDER_TRACK_SCOPE_KEYS = Object.freeze([
  'scope_kind',
  'bidder_track_id',
]);

const BIDDER_TRACK_BINDING_KEYS = Object.freeze([
  'bidder_track_identity',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  ...phaseContract.definition.phase_identity.prohibited_inputs,
  'candidate_values',
  'expected_occurrence_id',
  'precomputed_process_phase_id',
  'slot_binding',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  phase_code: 'NONE',
  phase_state: 'NONE',
  event_membership: 'NONE',
  temporal_expression: 'NONE',
  occurrence_slot_resolution: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessPhaseIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPhaseIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPhaseIdentityError(code, message, details);
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
      'PROCESS_PHASE_VALUE_DERIVED_IDENTITY',
      'Phase values, event membership, extracted values and slot assertions cannot define ProcessPhase identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function validateBidderTrackScopeBinding(input, bindings) {
  const code = 'INVALID_PROCESS_PHASE_BIDDER_TRACK_SCOPE';
  requireExactKeys(
    bindings,
    BIDDER_TRACK_BINDING_KEYS,
    'Process phase bidder-track scope binding',
    code,
  );
  let validated;
  try {
    validated = validateBidderTrackIdentity(bindings.bidder_track_identity);
  } catch (error) {
    fail(code, 'The governed BidderTrack identity is invalid.', {
      cause_code: error.code || error.name,
    });
  }
  requireObject(validated, 'Validated BidderTrack identity', code);
  if (
    validated.bidder_track_id
      !== input.phase_scope_kind_and_id.bidder_track_id
    || validated.frozen_contract_pair_digest
      !== input.frozen_contract_pair_digest
    || validated.governed_deal_admission_id
      !== input.governed_deal_admission_id
  ) {
    fail(
      'PROCESS_PHASE_BIDDER_TRACK_SCOPE_MISMATCH',
      'The governed BidderTrack identity must bind the exact phase scope, contract pair and admitted deal.',
    );
  }
}

function validatePhaseScope(input, bindings) {
  const code = 'INVALID_PROCESS_PHASE_SCOPE';
  const scope = input.phase_scope_kind_and_id;
  requireObject(scope, 'Process phase scope', code);
  if (scope.scope_kind === 'DEAL') {
    requireExactKeys(scope, DEAL_SCOPE_KEYS, 'Deal-scoped Process phase', code);
    if (scope.governed_deal_admission_id !== input.governed_deal_admission_id) {
      fail(
        'PROCESS_PHASE_DEAL_SCOPE_MISMATCH',
        'A deal-scoped ProcessPhase must bind its exact admitted deal.',
      );
    }
    if (bindings !== undefined) {
      requireExactKeys(
        bindings,
        [],
        'Deal-scoped Process phase binding',
        code,
      );
    }
    return scope;
  }
  if (scope.scope_kind === 'BIDDER_TRACK') {
    requireExactKeys(
      scope,
      BIDDER_TRACK_SCOPE_KEYS,
      'Bidder-track-scoped Process phase',
      code,
    );
    requireDigest(scope.bidder_track_id, 'BidderTrack ID', code);
    validateBidderTrackScopeBinding(input, bindings);
    return scope;
  }
  fail(code, 'ProcessPhase scope must be DEAL or BIDDER_TRACK.');
}

function phaseIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    phase_scope_kind_and_id: input.phase_scope_kind_and_id,
    process_phase_slot_key: input.process_phase_slot_key,
    governed_ordinal: input.governed_ordinal,
  };
}

function validatePhaseIdentityInput(input, bindings) {
  const code = 'INVALID_PROCESS_PHASE_IDENTITY';
  requireObject(input, 'Process phase identity input', code);
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    PHASE_IDENTITY_INPUT_KEYS,
    'Process phase identity input',
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
  validatePhaseScope(input, bindings);
  requireGovernedKey(
    input.process_phase_slot_key,
    'Process phase slot key',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(code, 'The governed phase ordinal must be a non-negative safe integer.');
  }
  return input;
}

function buildProcessPhaseIdentity(input, bindings) {
  validatePhaseIdentityInput(input, bindings);
  const identity = cloneCanonical(
    phaseIdentity(input),
    'Process phase identity',
    'INVALID_PROCESS_PHASE_IDENTITY',
  );
  const body = {
    schema_version: PHASE_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    frozen_contract_pair_digest: identity.frozen_contract_pair_digest,
    governed_deal_admission_id: identity.governed_deal_admission_id,
    phase_scope_kind_and_id: identity.phase_scope_kind_and_id,
    process_phase_slot_key: identity.process_phase_slot_key,
    governed_ordinal: identity.governed_ordinal,
    materialisation_state: 'IDENTITY_ONLY',
    expected_occurrence_slot_binding_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'Process phase authority limits',
      'INVALID_PROCESS_PHASE_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    process_phase_id: contentId(
      PHASE_ID_DOMAIN,
      phaseIdentity(body),
    ),
    canonical_payload_digest: contentId(
      PHASE_IDENTITY_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateProcessPhaseIdentity(value, bindings) {
  const code = 'INVALID_PROCESS_PHASE_IDENTITY';
  requireExactKeys(value, [
    'schema_version',
    'logical_type',
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'phase_scope_kind_and_id',
    'process_phase_slot_key',
    'governed_ordinal',
    'materialisation_state',
    'expected_occurrence_slot_binding_state',
    'authority_limits',
    'process_phase_id',
    'canonical_payload_digest',
  ], 'Process phase identity', code);
  if (
    value.schema_version !== PHASE_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.expected_occurrence_slot_binding_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The Process phase identity type or boundary state is invalid.');
  }
  validatePhaseIdentityInput(phaseIdentity(value), bindings);
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'Process phase authority limits',
    code,
  );
  const expectedPhaseId = contentId(
    PHASE_ID_DOMAIN,
    phaseIdentity(value),
  );
  if (value.process_phase_id !== expectedPhaseId) {
    fail(
      'PROCESS_PHASE_ID_MISMATCH',
      'The phase ID does not bind the exact frozen scope and slot identity.',
    );
  }
  const body = { ...value };
  delete body.process_phase_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    PHASE_IDENTITY_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'PROCESS_PHASE_PAYLOAD_MISMATCH',
      'The phase identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  ProcessPhaseIdentityError,
  buildProcessPhaseIdentity,
  validateProcessPhaseIdentity,
};
