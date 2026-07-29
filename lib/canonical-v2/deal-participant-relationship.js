const { canonicalJson, contentId } = require('./canonical-bytes');

const DEAL_PARTICIPANT_RELATIONSHIP_SCHEMA_VERSION = 'DEAL_PARTICIPANT_RELATIONSHIP/V1';
const DEAL_PARTICIPANT_RELATIONSHIP_REVISION_SCHEMA_VERSION = 'DEAL_PARTICIPANT_RELATIONSHIP_REVISION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const ROLE_LAYERS = Object.freeze([
  'LEGAL_DOCUMENT_ROLE',
  'TRANSACTION_ROLE',
]);
const LEGAL_ROLES = Object.freeze([
  'COMPANY',
  'PARENT',
  'MERGER_SUB',
  'ACQUIROR',
  'ISSUER',
  'SELLER',
  'SURVIVING_ENTITY',
  'CONSTITUENT_ENTITY',
  'NEW_HOLDCO',
  'DISTRIBUTING_PARENT',
  'SPINCO',
  'REMAINCO',
  'OTHER_LEGAL_PARTY',
]);
const TRANSACTION_ROLES = Object.freeze([
  'TARGET',
  'BUYER',
  'BIDDER',
  'COMBINATION_PARTY',
  'SPONSOR',
  'CONSORTIUM_MEMBER',
  'DIVESTING_PARENT',
  'CONTRIBUTING_PARTY',
  'ACQUIRED_BUSINESS',
  'ACQUIRED_ENTITY',
  'SELLING_SHAREHOLDER',
  'MERGER_COUNTERPARTY',
  'OTHER_COUNTERPARTY',
]);
const RELATIONSHIP_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);
const OCCURRENCE_INPUT_KEYS = Object.freeze([
  'bidder_track_slot_key',
  'expected_participant_slot_key',
  'governed_deal_id',
  'governed_ordinal',
  'participant_endpoint_slot_key',
  'role_code',
  'role_layer',
  'transaction_leg_slot_key',
]);
const OCCURRENCE_KEYS = Object.freeze([
  'schema_version',
  'deal_participant_relationship_id',
  ...OCCURRENCE_INPUT_KEYS,
]);
const REVISION_INPUT_KEYS = Object.freeze([
  'deal_participant_relationship',
  'bidder_track_id',
  'effective_time_scope',
  'entity_subject_id',
  'evidence_edges',
  'relationship_definition_and_version',
  'resolver_version',
  'source_local_subject_occurrence_id',
  'state',
  'transaction_leg_resolution_occurrence_id',
]);
const REVISION_KEYS = Object.freeze([
  'schema_version',
  'deal_participant_relationship_revision_id',
  'deal_participant_relationship_id',
  'bidder_track_id',
  'effective_time_scope',
  'entity_subject_id',
  'evidence_edges',
  'relationship_definition_and_version',
  'resolver_version',
  'role_code',
  'role_layer',
  'source_local_subject_occurrence_id',
  'state',
  'transaction_leg_resolution_occurrence_id',
]);

class DealParticipantRelationshipError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DealParticipantRelationshipError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new DealParticipantRelationshipError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_DEAL_PARTICIPANT', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_DEAL_PARTICIPANT', `${label} fields do not match the closed contract.`, {
      label,
    });
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_DEAL_PARTICIPANT', `${label} must be a SHA-256 content ID.`, {
      label,
    });
  }
  return value;
}

function optionalDigest(value, label) {
  return value === null ? null : requireDigest(value, label);
}

function requireGovernedKey(value, label) {
  if (typeof value !== 'string' || !GOVERNED_KEY_RE.test(value)) {
    fail('INVALID_DEAL_PARTICIPANT', `${label} must be a governed uppercase key.`, {
      label,
    });
  }
  return value;
}

function optionalGovernedKey(value, label) {
  return value === null ? null : requireGovernedKey(value, label);
}

function requireText(value, label, maximumBytes = 256) {
  if (typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes) {
    fail('INVALID_DEAL_PARTICIPANT', `${label} must be bounded, trimmed text.`, {
      label,
    });
  }
  return value;
}

function uniqueSortedDigests(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_DEAL_PARTICIPANT', `${label} must be an array.`, { label });
  }
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`))
    .sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_DEAL_PARTICIPANT_EVIDENCE', `${label} contains a duplicate.`);
  }
  return selected;
}

function validateRole(roleLayer, roleCode) {
  if (!ROLE_LAYERS.includes(roleLayer)) {
    fail('INVALID_DEAL_PARTICIPANT_ROLE', 'role_layer is not governed.');
  }
  const permitted = roleLayer === 'LEGAL_DOCUMENT_ROLE' ? LEGAL_ROLES : TRANSACTION_ROLES;
  if (!permitted.includes(roleCode)) {
    fail(
      'INVALID_DEAL_PARTICIPANT_ROLE',
      `${roleCode} is not permitted in ${roleLayer}.`,
    );
  }
}

function buildDealParticipantRelationship(input = {}) {
  requireExactKeys(input, OCCURRENCE_INPUT_KEYS, 'deal participant relationship input');
  validateRole(input.role_layer, input.role_code);
  if (!Number.isSafeInteger(input.governed_ordinal) || input.governed_ordinal < 0) {
    fail(
      'INVALID_DEAL_PARTICIPANT',
      'governed_ordinal must be a non-negative safe integer.',
    );
  }
  const body = {
    bidder_track_slot_key: optionalGovernedKey(
      input.bidder_track_slot_key,
      'bidder_track_slot_key',
    ),
    expected_participant_slot_key: requireGovernedKey(
      input.expected_participant_slot_key,
      'expected_participant_slot_key',
    ),
    governed_deal_id: requireDigest(input.governed_deal_id, 'governed_deal_id'),
    governed_ordinal: input.governed_ordinal,
    participant_endpoint_slot_key: requireGovernedKey(
      input.participant_endpoint_slot_key,
      'participant_endpoint_slot_key',
    ),
    role_code: input.role_code,
    role_layer: input.role_layer,
    transaction_leg_slot_key: optionalGovernedKey(
      input.transaction_leg_slot_key,
      'transaction_leg_slot_key',
    ),
  };
  return deepFreeze({
    schema_version: DEAL_PARTICIPANT_RELATIONSHIP_SCHEMA_VERSION,
    deal_participant_relationship_id: contentId(
      'DEAL_PARTICIPANT_RELATIONSHIP/V1',
      body,
    ),
    ...body,
  });
}

function validateDealParticipantRelationship(relationship) {
  requireExactKeys(relationship, OCCURRENCE_KEYS, 'deal participant relationship');
  const rebuilt = buildDealParticipantRelationship({
    bidder_track_slot_key: relationship.bidder_track_slot_key,
    expected_participant_slot_key: relationship.expected_participant_slot_key,
    governed_deal_id: relationship.governed_deal_id,
    governed_ordinal: relationship.governed_ordinal,
    participant_endpoint_slot_key: relationship.participant_endpoint_slot_key,
    role_code: relationship.role_code,
    role_layer: relationship.role_layer,
    transaction_leg_slot_key: relationship.transaction_leg_slot_key,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(relationship)) {
    fail('STALE_DEAL_PARTICIPANT', 'Participant relationship identity or content is stale.');
  }
  return true;
}

function normaliseState(value) {
  requireObject(value, 'state');
  if (!RELATIONSHIP_STATES.includes(value.code)) {
    fail('INVALID_DEAL_PARTICIPANT_STATE', 'state.code is not governed.');
  }
  const keysByCode = {
    PRESENT: ['code'],
    ABSENT: ['code', 'complete_scope_id'],
    NOT_APPLICABLE: ['code', 'applicability_evidence_ids'],
    NOT_EXAMINED: ['code', 'reason'],
    FAILED: ['code', 'failure_code', 'attempted_resolver'],
  };
  requireExactKeys(value, keysByCode[value.code], 'state');
  if (value.code === 'ABSENT') {
    return {
      code: value.code,
      complete_scope_id: requireDigest(value.complete_scope_id, 'state.complete_scope_id'),
    };
  }
  if (value.code === 'NOT_APPLICABLE') {
    const evidenceIds = uniqueSortedDigests(
      value.applicability_evidence_ids,
      'state.applicability_evidence_ids',
    );
    if (evidenceIds.length === 0) {
      fail('INVALID_DEAL_PARTICIPANT_STATE', 'NOT_APPLICABLE requires evidence.');
    }
    return { code: value.code, applicability_evidence_ids: evidenceIds };
  }
  if (value.code === 'NOT_EXAMINED') {
    return { code: value.code, reason: requireText(value.reason, 'state.reason') };
  }
  if (value.code === 'FAILED') {
    return {
      code: value.code,
      failure_code: requireGovernedKey(value.failure_code, 'state.failure_code'),
      attempted_resolver: requireText(
        value.attempted_resolver,
        'state.attempted_resolver',
      ),
    };
  }
  return { code: value.code };
}

function normaliseDefinition(value, relationship) {
  requireExactKeys(
    value,
    ['relationship_definition_key', 'relationship_definition_version'],
    'relationship_definition_and_version',
  );
  if (value.relationship_definition_key !== relationship.expected_participant_slot_key
    || !Number.isSafeInteger(value.relationship_definition_version)
    || value.relationship_definition_version < 1) {
    fail(
      'UNBOUND_DEAL_PARTICIPANT_DEFINITION',
      'The relationship definition must bind the expected participant slot.',
    );
  }
  return { ...value };
}

function buildDealParticipantRelationshipRevision(input = {}) {
  requireExactKeys(input, REVISION_INPUT_KEYS, 'deal participant revision input');
  validateDealParticipantRelationship(input.deal_participant_relationship);
  const relationship = input.deal_participant_relationship;
  const state = normaliseState(input.state);
  const evidenceEdges = uniqueSortedDigests(input.evidence_edges, 'evidence_edges');
  const entitySubjectId = optionalDigest(input.entity_subject_id, 'entity_subject_id');
  const sourceLocalSubjectOccurrenceId = optionalDigest(
    input.source_local_subject_occurrence_id,
    'source_local_subject_occurrence_id',
  );
  const bidderTrackId = optionalDigest(input.bidder_track_id, 'bidder_track_id');
  const transactionLegId = optionalDigest(
    input.transaction_leg_resolution_occurrence_id,
    'transaction_leg_resolution_occurrence_id',
  );
  const effectiveTimeScope = optionalDigest(
    input.effective_time_scope,
    'effective_time_scope',
  );
  const isPresent = state.code === 'PRESENT';
  const endpointCount = [entitySubjectId, sourceLocalSubjectOccurrenceId]
    .filter(Boolean).length;

  if (isPresent && (endpointCount !== 1 || evidenceEdges.length === 0)) {
    fail(
      'DEAL_PARTICIPANT_EVIDENCE_REQUIRED',
      'A present participant requires one endpoint and exact evidence.',
    );
  }
  if (!isPresent && (endpointCount !== 0 || effectiveTimeScope !== null)) {
    fail(
      'NON_PRESENT_DEAL_PARTICIPANT_VALUE',
      'A non-present participant cannot assert an endpoint or effective time.',
    );
  }
  if (['ABSENT', 'NOT_APPLICABLE'].includes(state.code) && evidenceEdges.length === 0) {
    fail(
      'DEAL_PARTICIPANT_EVIDENCE_REQUIRED',
      `${state.code} requires exact evidence.`,
    );
  }
  if (state.code === 'NOT_APPLICABLE'
    && state.applicability_evidence_ids.some((id) => !evidenceEdges.includes(id))) {
    fail(
      'UNBOUND_DEAL_PARTICIPANT_EVIDENCE',
      'Applicability evidence must be in the relationship evidence set.',
    );
  }
  if ((relationship.bidder_track_slot_key === null) !== (bidderTrackId === null)) {
    fail(
      'UNBOUND_DEAL_PARTICIPANT_BIDDER_TRACK',
      'Bidder-track identity must follow the occurrence bidder-track slot.',
    );
  }
  if ((relationship.transaction_leg_slot_key === null) !== (transactionLegId === null)) {
    fail(
      'UNBOUND_DEAL_PARTICIPANT_LEG',
      'Transaction-leg identity must follow the occurrence transaction-leg slot.',
    );
  }
  const body = {
    bidder_track_id: bidderTrackId,
    deal_participant_relationship_id: relationship.deal_participant_relationship_id,
    effective_time_scope: effectiveTimeScope,
    entity_subject_id: entitySubjectId,
    evidence_edges: evidenceEdges,
    relationship_definition_and_version: normaliseDefinition(
      input.relationship_definition_and_version,
      relationship,
    ),
    resolver_version: requireText(input.resolver_version, 'resolver_version'),
    role_code: relationship.role_code,
    role_layer: relationship.role_layer,
    source_local_subject_occurrence_id: sourceLocalSubjectOccurrenceId,
    state,
    transaction_leg_resolution_occurrence_id: transactionLegId,
  };
  return deepFreeze({
    schema_version: DEAL_PARTICIPANT_RELATIONSHIP_REVISION_SCHEMA_VERSION,
    deal_participant_relationship_revision_id: contentId(
      'DEAL_PARTICIPANT_RELATIONSHIP_REVISION/V1',
      body,
    ),
    ...body,
  });
}

function validateDealParticipantRelationshipRevision({
  revision,
  deal_participant_relationship: relationship,
} = {}) {
  requireExactKeys(revision, REVISION_KEYS, 'deal participant relationship revision');
  validateDealParticipantRelationship(relationship);
  if (revision.deal_participant_relationship_id
    !== relationship.deal_participant_relationship_id) {
    fail('STALE_DEAL_PARTICIPANT_REVISION', 'Revision refers to another relationship.');
  }
  const rebuilt = buildDealParticipantRelationshipRevision({
    deal_participant_relationship: relationship,
    bidder_track_id: revision.bidder_track_id,
    effective_time_scope: revision.effective_time_scope,
    entity_subject_id: revision.entity_subject_id,
    evidence_edges: revision.evidence_edges,
    relationship_definition_and_version: revision.relationship_definition_and_version,
    resolver_version: revision.resolver_version,
    source_local_subject_occurrence_id: revision.source_local_subject_occurrence_id,
    state: revision.state,
    transaction_leg_resolution_occurrence_id:
      revision.transaction_leg_resolution_occurrence_id,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail('STALE_DEAL_PARTICIPANT_REVISION', 'Revision identity or content is stale.');
  }
  return true;
}

module.exports = {
  DEAL_PARTICIPANT_RELATIONSHIP_REVISION_SCHEMA_VERSION,
  DEAL_PARTICIPANT_RELATIONSHIP_SCHEMA_VERSION,
  DealParticipantRelationshipError,
  LEGAL_ROLES,
  RELATIONSHIP_STATES,
  ROLE_LAYERS,
  TRANSACTION_ROLES,
  buildDealParticipantRelationship,
  buildDealParticipantRelationshipRevision,
  validateDealParticipantRelationship,
  validateDealParticipantRelationshipRevision,
};
