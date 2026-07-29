const { canonicalJson, contentId } = require('./canonical-bytes');

const BIDDER_TRACK_IDENTITY_SCHEMA = 'BIDDER_TRACK_IDENTITY/V1';
const BIDDER_TRACK_ID_DOMAIN = 'BIDDER_TRACK/V1';
const BIDDER_TRACK_IDENTITY_PAYLOAD_DOMAIN =
  'BIDDER_TRACK_IDENTITY_PAYLOAD/V1';
const LOGICAL_TYPE = 'BidderTrack';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

const BIDDER_TRACK_IDENTITY_INPUT_KEYS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'bidder_track_slot_key',
  'governed_ordinal',
]);

const PROHIBITED_IDENTITY_INPUTS = new Set([
  'candidate_values',
  'cleaned_name',
  'display_name',
  'entity_identity_bridge_revision_id',
  'entity_subject_id',
  'event_ids',
  'extracted_attributes',
  'first_event_date',
  'identity_state',
  'matching_economics',
  'model_output',
  'process_participant_ids',
  'source_local_label',
  'track_state',
]);

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  expected_occurrence_slot_binding: 'NONE',
  subject_binding: 'NONE',
  identity_bridge: 'NONE',
  participant_membership: 'NONE',
  event_membership: 'NONE',
  track_state: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class BidderTrackIdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'BidderTrackIdentityError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new BidderTrackIdentityError(code, message, details);
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
      'BIDDER_TRACK_VALUE_DERIVED_IDENTITY',
      'Names, dates, economics, subjects, memberships, track state and model output cannot define BidderTrack identity.',
      { prohibited_identity_inputs: prohibited },
    );
  }
}

function bidderTrackIdentity(input) {
  return {
    frozen_contract_pair_digest: input.frozen_contract_pair_digest,
    governed_deal_admission_id: input.governed_deal_admission_id,
    bidder_track_slot_key: input.bidder_track_slot_key,
    governed_ordinal: input.governed_ordinal,
  };
}

function validateBidderTrackIdentityInput(input) {
  const code = 'INVALID_BIDDER_TRACK_IDENTITY';
  requireObject(input, 'BidderTrack identity input', code);
  rejectProhibitedIdentityInputs(input);
  requireExactKeys(
    input,
    BIDDER_TRACK_IDENTITY_INPUT_KEYS,
    'BidderTrack identity input',
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
    input.bidder_track_slot_key,
    'BidderTrack slot key',
    code,
  );
  if (
    !Number.isSafeInteger(input.governed_ordinal)
    || input.governed_ordinal < 0
  ) {
    fail(code, 'The governed BidderTrack ordinal must be a non-negative safe integer.');
  }
  return input;
}

function buildBidderTrackIdentity(input) {
  validateBidderTrackIdentityInput(input);
  const identity = cloneCanonical(
    bidderTrackIdentity(input),
    'BidderTrack identity',
    'INVALID_BIDDER_TRACK_IDENTITY',
  );
  const body = {
    schema_version: BIDDER_TRACK_IDENTITY_SCHEMA,
    logical_type: LOGICAL_TYPE,
    frozen_contract_pair_digest: identity.frozen_contract_pair_digest,
    governed_deal_admission_id: identity.governed_deal_admission_id,
    bidder_track_slot_key: identity.bidder_track_slot_key,
    governed_ordinal: identity.governed_ordinal,
    materialisation_state: 'IDENTITY_ONLY',
    expected_occurrence_slot_binding_state: 'UNRESOLVED',
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'BidderTrack authority limits',
      'INVALID_BIDDER_TRACK_IDENTITY',
    ),
  };
  return deepFreeze({
    ...body,
    bidder_track_id: contentId(
      BIDDER_TRACK_ID_DOMAIN,
      bidderTrackIdentity(body),
    ),
    canonical_payload_digest: contentId(
      BIDDER_TRACK_IDENTITY_PAYLOAD_DOMAIN,
      body,
    ),
  });
}

function validateBidderTrackIdentity(value) {
  const code = 'INVALID_BIDDER_TRACK_IDENTITY';
  requireExactKeys(value, [
    'schema_version',
    'logical_type',
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'bidder_track_slot_key',
    'governed_ordinal',
    'materialisation_state',
    'expected_occurrence_slot_binding_state',
    'authority_limits',
    'bidder_track_id',
    'canonical_payload_digest',
  ], 'BidderTrack identity', code);
  if (
    value.schema_version !== BIDDER_TRACK_IDENTITY_SCHEMA
    || value.logical_type !== LOGICAL_TYPE
    || value.materialisation_state !== 'IDENTITY_ONLY'
    || value.expected_occurrence_slot_binding_state !== 'UNRESOLVED'
  ) {
    fail(code, 'The BidderTrack identity type or boundary state is invalid.');
  }
  validateBidderTrackIdentityInput(bidderTrackIdentity(value));
  requireExactValue(
    value.authority_limits,
    AUTHORITY_LIMITS,
    'BidderTrack authority limits',
    code,
  );
  const expectedBidderTrackId = contentId(
    BIDDER_TRACK_ID_DOMAIN,
    bidderTrackIdentity(value),
  );
  if (value.bidder_track_id !== expectedBidderTrackId) {
    fail(
      'BIDDER_TRACK_ID_MISMATCH',
      'The BidderTrack ID does not bind the exact frozen slot identity.',
    );
  }
  const body = { ...value };
  delete body.bidder_track_id;
  delete body.canonical_payload_digest;
  const expectedPayloadDigest = contentId(
    BIDDER_TRACK_IDENTITY_PAYLOAD_DOMAIN,
    body,
  );
  if (value.canonical_payload_digest !== expectedPayloadDigest) {
    fail(
      'BIDDER_TRACK_PAYLOAD_MISMATCH',
      'The BidderTrack identity payload digest is invalid.',
    );
  }
  return value;
}

module.exports = {
  BidderTrackIdentityError,
  buildBidderTrackIdentity,
  validateBidderTrackIdentity,
};
