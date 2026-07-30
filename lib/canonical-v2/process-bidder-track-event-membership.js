const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateProcessRelationshipIdentity,
} = require('./process-relationship');
const relationshipContract = require(
  '../../contracts/canonical-v2/successor/process/relationships/process-relationship.v2.json',
);
const controlledCodeRegistryContract = require(
  '../../contracts/canonical-v2/successor/process/registries/process-controlled-code-registry.v2.json',
);

const MEMBERSHIP_INPUT_SCHEMA =
  'PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_INPUT/V1';
const RELATIONSHIP_REVISION_SCHEMA = 'PROCESS_RELATIONSHIP_REVISION/V2';
const EVIDENCE_EDGE_SCHEMA = 'PROCESS_EXACT_EVIDENCE_EDGE/V1';
const RELATIONSHIP_TYPE_CODE = 'BIDDER_TRACK_EVENT_MEMBERSHIP';
const RELATIONSHIP_EFFECT = Object.freeze({
  effect_code: 'EVENT_MEMBER_OF_BIDDER_TRACK',
});
const SHA256_RE = /^[a-f0-9]{64}$/;

const INPUT_KEYS = Object.freeze([
  'schema_version',
  'process_relationship_identity',
  'bidder_track_id',
  'process_event_id',
  'relationship_state',
  'relationship_effect',
  'evidence_edges',
  'temporal_expression_revision_id',
]);

const EVIDENCE_EDGE_KEYS = Object.freeze([
  'schema_version',
  'evidence_edge_id',
  'evidence_role_key',
  'admitted_source_occurrence_id',
  'source_document_identity',
  'source_revision_id',
  'document_hash',
  'document_ordinal',
  'start_utf8_byte',
  'end_utf8_byte',
  'exact_text_digest',
  'evidence_validation_receipt_id',
  'validation_state',
  'authority_state',
]);

const REVISION_IMMUTABLE_INPUTS = Object.freeze([
  'evidence_edges',
  'process_relationship_id',
  'relationship_effect',
  'relationship_state',
  'relationship_type_code',
  'source_process_object_kind_and_id',
  'target_process_object_kind_and_id',
  'temporal_expression_revision_id',
]);

const REVISION_KEYS = Object.freeze([
  'schema_version',
  'process_relationship_revision_id',
  ...REVISION_IMMUTABLE_INPUTS,
  'validation_state',
  'authority_state',
  'canonical_payload_digest',
]);

class ProcessBidderTrackEventMembershipError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessBidderTrackEventMembershipError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessBidderTrackEventMembershipError(code, message, details);
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
      actual,
      expected: required,
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
  if (!equal) fail(code, `${label} is not the approved value.`);
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
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

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function compareEvidenceEdges(left, right) {
  return left.document_ordinal - right.document_ordinal
    || left.start_utf8_byte - right.start_utf8_byte
    || left.end_utf8_byte - right.end_utf8_byte
    || compareText(left.evidence_role_key, right.evidence_role_key)
    || compareText(left.evidence_edge_id, right.evidence_edge_id);
}

function validateContractBinding() {
  const code = 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_CONTRACT';
  const definition = relationshipContract.definition;
  const membership = definition?.bidder_track_event_membership_contract;
  const registry = controlledCodeRegistryContract.definition
    ?.process_owned_registries
    ?.find((entry) => (
      entry.registry_stable_id === 'PROCESS_RELATIONSHIP_TYPE_REGISTRY'
    ));
  if (
    relationshipContract.stable_id !== 'PROCESS_RELATIONSHIP'
    || definition?.logical_type_version !== 2
    || definition?.relationship_identity?.stable_id_domain
      !== 'PROCESS_RELATIONSHIP/V1'
    || definition?.revision_identity?.revision_id_domain
      !== RELATIONSHIP_REVISION_SCHEMA
    || canonicalJson(definition?.revision_identity?.immutable_inputs)
      !== canonicalJson(REVISION_IMMUTABLE_INPUTS)
    || canonicalJson(definition?.revision_identity?.prohibited_inputs)
      !== canonicalJson(['source_revision_id', 'target_revision_id'])
    || membership?.relationship_type_code !== RELATIONSHIP_TYPE_CODE
    || canonicalJson(membership?.relationship_effect)
      !== canonicalJson(RELATIONSHIP_EFFECT)
    || membership?.relationship_state !== 'PRESENT'
    || membership?.source_logical_type !== 'BidderTrack'
    || membership?.source_definition_stable_id !== 'BIDDER_TRACK'
    || membership?.target_logical_type !== 'ProcessEvent'
    || membership?.target_definition_stable_id !== 'PROCESS_EVENT'
    || membership?.one_membership_per_stable_track_event_pair !== true
    || membership?.same_frozen_contract_pair_required !== true
    || membership?.same_governed_deal_required !== true
    || membership?.exact_evidence_edges_required !== true
    || membership
      ?.chronology_date_economics_names_or_labels_can_establish_membership
      !== false
    || controlledCodeRegistryContract.definition?.registry_version !== 2
    || !registry?.codes?.includes(RELATIONSHIP_TYPE_CODE)
  ) {
    fail(code, 'The governed membership contract binding is invalid.');
  }
}

function validateEvidenceEdge(edge, index) {
  const code = 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EVIDENCE';
  const label = `Membership evidence edge ${index}`;
  requireExactKeys(edge, EVIDENCE_EDGE_KEYS, label, code);
  if (
    edge.schema_version !== EVIDENCE_EDGE_SCHEMA
    || edge.validation_state !== 'EXTERNALLY_VALIDATED'
    || edge.authority_state !== 'NOT_GRANTED'
    || typeof edge.evidence_role_key !== 'string'
    || edge.evidence_role_key.length === 0
    || !Number.isSafeInteger(edge.document_ordinal)
    || edge.document_ordinal < 0
    || !Number.isSafeInteger(edge.start_utf8_byte)
    || edge.start_utf8_byte < 0
    || !Number.isSafeInteger(edge.end_utf8_byte)
    || edge.end_utf8_byte <= edge.start_utf8_byte
  ) {
    fail(code, `${label} is not exact externally validated evidence.`);
  }
  for (const [key, keyLabel] of [
    ['evidence_edge_id', 'ID'],
    ['admitted_source_occurrence_id', 'source occurrence ID'],
    ['source_document_identity', 'source document identity'],
    ['source_revision_id', 'source revision ID'],
    ['document_hash', 'document hash'],
    ['exact_text_digest', 'exact text digest'],
    ['evidence_validation_receipt_id', 'validation receipt ID'],
  ]) {
    requireDigest(edge[key], `${label} ${keyLabel}`, code);
  }
  const body = { ...edge };
  delete body.evidence_edge_id;
  if (edge.evidence_edge_id !== contentId(EVIDENCE_EDGE_SCHEMA, body)) {
    fail(code, `${label} ID does not bind its exact evidence payload.`);
  }
  return edge;
}

function validateEvidenceEdges(edges) {
  const code = 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EVIDENCE';
  if (!Array.isArray(edges) || edges.length < 1 || edges.length > 256) {
    fail(code, 'Membership requires one or more bounded evidence edges.');
  }
  edges.forEach(validateEvidenceEdge);
  const sorted = [...edges].sort(compareEvidenceEdges);
  const ids = edges.map((edge) => edge.evidence_edge_id);
  if (
    new Set(ids).size !== ids.length
    || canonicalJson(edges) !== canonicalJson(sorted)
  ) {
    fail(code, 'Membership evidence edges must be sorted and unique.');
  }
  return edges;
}

function validateMembershipInput(input) {
  const code = 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_INPUT';
  requireExactKeys(input, INPUT_KEYS, 'Membership input', code);
  validateContractBinding();
  if (input.schema_version !== MEMBERSHIP_INPUT_SCHEMA) {
    fail(code, 'The membership input schema is not supported.');
  }
  requireDigest(input.bidder_track_id, 'BidderTrack ID', code);
  requireDigest(input.process_event_id, 'ProcessEvent ID', code);
  try {
    validateProcessRelationshipIdentity(input.process_relationship_identity);
  } catch (error) {
    fail(code, 'The membership relationship identity is invalid.', {
      cause: error.code || error.message,
    });
  }
  const identity = input.process_relationship_identity;
  const source = identity.source_process_object_kind_and_id;
  const target = identity.target_process_object_kind_and_id;
  if (
    source.logical_type !== 'BidderTrack'
    || source.definition_stable_id !== 'BIDDER_TRACK'
    || source.stable_object_id !== input.bidder_track_id
    || target.logical_type !== 'ProcessEvent'
    || target.definition_stable_id !== 'PROCESS_EVENT'
    || target.stable_object_id !== input.process_event_id
  ) {
    fail(
      'PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_ENDPOINT_MISMATCH',
      'Membership must run from the exact stable BidderTrack to the exact stable ProcessEvent.',
    );
  }
  if (input.relationship_state !== 'PRESENT') {
    fail(
      'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_STATE',
      'Membership state must be PRESENT.',
    );
  }
  requireExactValue(
    input.relationship_effect,
    RELATIONSHIP_EFFECT,
    'Membership relationship effect',
    'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EFFECT',
  );
  if (input.temporal_expression_revision_id !== null) {
    fail(
      'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_TEMPORAL',
      'The synthetic membership pilot requires a null temporal expression.',
    );
  }
  validateEvidenceEdges(input.evidence_edges);
  return input;
}

function membershipRevisionPayload(input) {
  return {
    evidence_edges: input.evidence_edges,
    process_relationship_id:
      input.process_relationship_identity.process_relationship_id,
    relationship_effect: input.relationship_effect,
    relationship_state: input.relationship_state,
    relationship_type_code: RELATIONSHIP_TYPE_CODE,
    source_process_object_kind_and_id:
      input.process_relationship_identity.source_process_object_kind_and_id,
    target_process_object_kind_and_id:
      input.process_relationship_identity.target_process_object_kind_and_id,
    temporal_expression_revision_id:
      input.temporal_expression_revision_id,
  };
}

function buildProcessBidderTrackEventMembershipRevision(input) {
  validateMembershipInput(input);
  const payload = cloneCanonical(
    membershipRevisionPayload(input),
    'Membership revision payload',
    'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_INPUT',
  );
  const body = {
    schema_version: RELATIONSHIP_REVISION_SCHEMA,
    process_relationship_revision_id: contentId(
      RELATIONSHIP_REVISION_SCHEMA,
      payload,
    ),
    ...payload,
    validation_state: 'VALIDATED_PURE_RUNTIME',
    authority_state: 'NOT_GRANTED',
  };
  return deepFreeze({
    ...body,
    canonical_payload_digest: contentId(
      `${RELATIONSHIP_REVISION_SCHEMA}_PAYLOAD`,
      body,
    ),
  });
}

function buildProcessBidderTrackEventMembershipRevisions(inputs) {
  const code = 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_SET';
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 256) {
    fail(code, 'Membership inputs must be a non-empty bounded array.');
  }
  const seenPairs = new Set();
  const revisions = inputs.map((input) => {
    validateMembershipInput(input);
    const pair = `${input.bidder_track_id}:${input.process_event_id}`;
    if (seenPairs.has(pair)) {
      fail(
        'DUPLICATE_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP',
        'Only one membership is permitted for each stable BidderTrack and ProcessEvent pair.',
      );
    }
    seenPairs.add(pair);
    return buildProcessBidderTrackEventMembershipRevision(input);
  });
  return deepFreeze(revisions);
}

function validateProcessBidderTrackEventMembershipRevision(value, input) {
  const code = 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_REVISION';
  requireExactKeys(value, REVISION_KEYS, 'Membership revision', code);
  const rebuilt = buildProcessBidderTrackEventMembershipRevision(input);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(code, 'The membership revision was changed.');
  }
  return value;
}

module.exports = {
  EVIDENCE_EDGE_SCHEMA,
  MEMBERSHIP_INPUT_SCHEMA,
  RELATIONSHIP_EFFECT,
  RELATIONSHIP_REVISION_SCHEMA,
  RELATIONSHIP_TYPE_CODE,
  ProcessBidderTrackEventMembershipError,
  buildProcessBidderTrackEventMembershipRevision,
  buildProcessBidderTrackEventMembershipRevisions,
  validateProcessBidderTrackEventMembershipRevision,
};
