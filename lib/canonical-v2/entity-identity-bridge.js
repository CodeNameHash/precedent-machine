const { canonicalJson, contentId } = require('./canonical-bytes');

const ENTITY_IDENTITY_BRIDGE_SCHEMA_VERSION = 'ENTITY_IDENTITY_BRIDGE/V1';
const ENTITY_IDENTITY_BRIDGE_REVISION_SCHEMA_VERSION = 'ENTITY_IDENTITY_BRIDGE_REVISION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const RELATIONSHIP_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);
const IDENTITY_DISPOSITIONS = Object.freeze([
  'NAMED',
  'GOVERNED_BRIDGE_CONFIRMED',
  'SOURCE_LOCAL_ONLY',
  'CONFLICTING',
  'NO_BRIDGE_WITNESS',
]);
const OCCURRENCE_INPUT_KEYS = Object.freeze([
  'bridge_rule_key',
  'expected_identity_bridge_slot_key',
  'governed_ordinal',
  'source_local_subject_occurrence_id',
]);
const OCCURRENCE_KEYS = Object.freeze([
  'schema_version',
  'entity_identity_bridge_id',
  ...OCCURRENCE_INPUT_KEYS,
]);
const REVISION_INPUT_KEYS = Object.freeze([
  'entity_identity_bridge',
  'bridge_rule_and_version',
  'conflict_checks',
  'evidence_edges',
  'identity_disposition',
  'review_evidence',
  'selected_entity_subject_id',
  'state',
  'supersession',
]);
const REVISION_KEYS = Object.freeze([
  'schema_version',
  'entity_identity_bridge_revision_id',
  'entity_identity_bridge_id',
  'bridge_rule_and_version',
  'conflict_checks',
  'evidence_edges',
  'identity_disposition',
  'review_evidence',
  'selected_entity_subject_id',
  'state',
  'supersession',
  'terminal_eligible',
]);
const REVIEW_EVIDENCE_KEYS = Object.freeze([
  'decision',
  'review_record_id',
  'reviewer_eligibility_evidence_id',
  'complete_scope_id',
  'applicability_evidence_ids',
  'failure_detail',
]);
const CONFLICT_CHECK_KEYS = Object.freeze([
  'check_key',
  'outcome',
  'evidence_edge_ids',
]);

class EntityIdentityBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'EntityIdentityBridgeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new EntityIdentityBridgeError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_ENTITY_IDENTITY_BRIDGE', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(
      'INVALID_ENTITY_IDENTITY_BRIDGE',
      `${label} fields do not match the closed contract.`,
      { label },
    );
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail(
      'INVALID_ENTITY_IDENTITY_BRIDGE',
      `${label} must be a SHA-256 content ID.`,
      { label },
    );
  }
  return value;
}

function requireGovernedKey(value, label) {
  if (typeof value !== 'string' || !GOVERNED_KEY_RE.test(value)) {
    fail(
      'INVALID_ENTITY_IDENTITY_BRIDGE',
      `${label} must be a governed uppercase key.`,
      { label },
    );
  }
  return value;
}

function uniqueSortedDigests(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_ENTITY_IDENTITY_BRIDGE', `${label} must be an array.`, { label });
  }
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`))
    .sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_ENTITY_BRIDGE_EVIDENCE', `${label} contains a duplicate.`, {
      label,
    });
  }
  return selected;
}

function buildEntityIdentityBridge(input = {}) {
  requireExactKeys(input, OCCURRENCE_INPUT_KEYS, 'entity identity bridge input');
  const bridgeRuleKey = requireGovernedKey(input.bridge_rule_key, 'bridge_rule_key');
  const expectedSlotKey = requireGovernedKey(
    input.expected_identity_bridge_slot_key,
    'expected_identity_bridge_slot_key',
  );
  if (!Number.isSafeInteger(input.governed_ordinal) || input.governed_ordinal < 0) {
    fail(
      'INVALID_ENTITY_IDENTITY_BRIDGE',
      'governed_ordinal must be a non-negative safe integer.',
    );
  }
  const body = {
    bridge_rule_key: bridgeRuleKey,
    expected_identity_bridge_slot_key: expectedSlotKey,
    governed_ordinal: input.governed_ordinal,
    source_local_subject_occurrence_id: requireDigest(
      input.source_local_subject_occurrence_id,
      'source_local_subject_occurrence_id',
    ),
  };
  return deepFreeze({
    schema_version: ENTITY_IDENTITY_BRIDGE_SCHEMA_VERSION,
    entity_identity_bridge_id: contentId('ENTITY_IDENTITY_BRIDGE/V1', body),
    ...body,
  });
}

function validateEntityIdentityBridge(bridge) {
  requireExactKeys(bridge, OCCURRENCE_KEYS, 'entity identity bridge');
  const rebuilt = buildEntityIdentityBridge({
    bridge_rule_key: bridge.bridge_rule_key,
    expected_identity_bridge_slot_key: bridge.expected_identity_bridge_slot_key,
    governed_ordinal: bridge.governed_ordinal,
    source_local_subject_occurrence_id: bridge.source_local_subject_occurrence_id,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(bridge)) {
    fail('STALE_ENTITY_IDENTITY_BRIDGE', 'Entity identity bridge identity or content is stale.');
  }
  return true;
}

function normaliseBridgeRule(value, bridge) {
  requireExactKeys(value, ['bridge_rule_key', 'bridge_rule_version'], 'bridge_rule_and_version');
  if (value.bridge_rule_key !== bridge.bridge_rule_key) {
    fail(
      'UNBOUND_ENTITY_BRIDGE_RULE',
      'The bridge revision must use the occurrence bridge rule.',
    );
  }
  if (!Number.isSafeInteger(value.bridge_rule_version) || value.bridge_rule_version < 1) {
    fail(
      'INVALID_ENTITY_IDENTITY_BRIDGE',
      'bridge_rule_version must be a positive safe integer.',
    );
  }
  return {
    bridge_rule_key: value.bridge_rule_key,
    bridge_rule_version: value.bridge_rule_version,
  };
}

function normaliseConflictChecks(values, evidenceEdges) {
  if (!Array.isArray(values)) {
    fail('INVALID_ENTITY_IDENTITY_BRIDGE', 'conflict_checks must be an array.');
  }
  const selected = values.map((value, index) => {
    const label = `conflict_checks[${index}]`;
    requireExactKeys(value, CONFLICT_CHECK_KEYS, label);
    if (!['CLEAR', 'CONFLICT'].includes(value.outcome)) {
      fail('INVALID_ENTITY_BRIDGE_CONFLICT_CHECK', `${label}.outcome is not governed.`);
    }
    const evidenceEdgeIds = uniqueSortedDigests(
      value.evidence_edge_ids,
      `${label}.evidence_edge_ids`,
    );
    if (evidenceEdgeIds.length === 0
      || evidenceEdgeIds.some((id) => !evidenceEdges.includes(id))) {
      fail(
        'UNBOUND_ENTITY_BRIDGE_CONFLICT_EVIDENCE',
        'Each conflict check requires evidence in the revision evidence set.',
      );
    }
    return {
      check_key: requireGovernedKey(value.check_key, `${label}.check_key`),
      outcome: value.outcome,
      evidence_edge_ids: evidenceEdgeIds,
    };
  }).sort((left, right) => left.check_key.localeCompare(right.check_key));
  if (new Set(selected.map((item) => item.check_key)).size !== selected.length) {
    fail('DUPLICATE_ENTITY_BRIDGE_CONFLICT_CHECK', 'conflict_checks contains a duplicate key.');
  }
  return selected;
}

function normaliseFailureDetail(value) {
  if (value === null) return null;
  requireExactKeys(value, ['failure_code', 'attempted_rule'], 'review_evidence.failure_detail');
  return {
    failure_code: requireGovernedKey(
      value.failure_code,
      'review_evidence.failure_detail.failure_code',
    ),
    attempted_rule: requireGovernedKey(
      value.attempted_rule,
      'review_evidence.failure_detail.attempted_rule',
    ),
  };
}

function normaliseReviewEvidence(value) {
  requireExactKeys(value, REVIEW_EVIDENCE_KEYS, 'review_evidence');
  if (!['PASS', 'BLOCK', 'NOT_REVIEWED'].includes(value.decision)) {
    fail('INVALID_ENTITY_BRIDGE_REVIEW', 'review_evidence.decision is not governed.');
  }
  const reviewed = ['PASS', 'BLOCK'].includes(value.decision);
  const reviewRecordId = value.review_record_id === null
    ? null
    : requireDigest(value.review_record_id, 'review_evidence.review_record_id');
  const reviewerEligibilityEvidenceId = value.reviewer_eligibility_evidence_id === null
    ? null
    : requireDigest(
      value.reviewer_eligibility_evidence_id,
      'review_evidence.reviewer_eligibility_evidence_id',
    );
  if (reviewed && (!reviewRecordId || !reviewerEligibilityEvidenceId)) {
    fail(
      'INVALID_ENTITY_BRIDGE_REVIEW',
      'A reviewed bridge requires the review record and reviewer eligibility evidence.',
    );
  }
  if (!reviewed && (reviewRecordId || reviewerEligibilityEvidenceId)) {
    fail(
      'INVALID_ENTITY_BRIDGE_REVIEW',
      'A not-reviewed bridge cannot assert review authority.',
    );
  }
  return {
    decision: value.decision,
    review_record_id: reviewRecordId,
    reviewer_eligibility_evidence_id: reviewerEligibilityEvidenceId,
    complete_scope_id: value.complete_scope_id === null
      ? null
      : requireDigest(value.complete_scope_id, 'review_evidence.complete_scope_id'),
    applicability_evidence_ids: uniqueSortedDigests(
      value.applicability_evidence_ids,
      'review_evidence.applicability_evidence_ids',
    ),
    failure_detail: normaliseFailureDetail(value.failure_detail),
  };
}

function normaliseSupersession(value) {
  if (value === null) return null;
  requireExactKeys(
    value,
    ['predecessor_revision_id', 'review_record_id'],
    'supersession',
  );
  return {
    predecessor_revision_id: requireDigest(
      value.predecessor_revision_id,
      'supersession.predecessor_revision_id',
    ),
    review_record_id: requireDigest(
      value.review_record_id,
      'supersession.review_record_id',
    ),
  };
}

function requireEvidenceSubset(values, evidenceEdges, code, message) {
  if (values.some((id) => !evidenceEdges.includes(id))) {
    fail(code, message);
  }
}

function validateDispositionRules({
  conflictChecks,
  evidenceEdges,
  identityDisposition,
  reviewEvidence,
  selectedEntitySubjectId,
  state,
}) {
  const hasConflict = conflictChecks.some((check) => check.outcome === 'CONFLICT');
  const combination = `${state}:${identityDisposition ?? 'NONE'}`;
  const terminalCombinations = new Set([
    'PRESENT:NAMED',
    'PRESENT:GOVERNED_BRIDGE_CONFIRMED',
    'ABSENT:NO_BRIDGE_WITNESS',
    'NOT_EXAMINED:SOURCE_LOCAL_ONLY',
    'NOT_APPLICABLE:SOURCE_LOCAL_ONLY',
    'FAILED:NONE',
  ]);

  if (state !== 'ABSENT' && reviewEvidence.complete_scope_id !== null) {
    fail(
      'INVALID_ENTITY_BRIDGE_REVIEW',
      'Only an absent bridge can contain a complete-scope identity.',
    );
  }
  if (state !== 'NOT_APPLICABLE'
    && reviewEvidence.applicability_evidence_ids.length !== 0) {
    fail(
      'INVALID_ENTITY_BRIDGE_REVIEW',
      'Only a not-applicable bridge can contain applicability evidence.',
    );
  }
  if (identityDisposition === 'CONFLICTING') {
    if (state !== 'PRESENT'
      || selectedEntitySubjectId !== null
      || !hasConflict
      || evidenceEdges.length === 0
      || reviewEvidence.decision !== 'BLOCK') {
      fail(
        'INVALID_CONFLICTING_ENTITY_BRIDGE',
        'A conflicting candidate must block selection and bind reviewed conflict evidence.',
      );
    }
    return false;
  }
  if (!terminalCombinations.has(combination)) {
    fail(
      'INVALID_ENTITY_BRIDGE_COMBINATION',
      `The state and identity disposition combination ${combination} is not governed.`,
    );
  }
  if (hasConflict) {
    fail(
      'ENTITY_BRIDGE_CONFLICT_BLOCKS_SELECTION',
      'A conflict blocks terminal entity selection.',
    );
  }

  if (['NAMED', 'GOVERNED_BRIDGE_CONFIRMED'].includes(identityDisposition)) {
    if (!selectedEntitySubjectId
      || evidenceEdges.length === 0
      || reviewEvidence.decision !== 'PASS'
      || conflictChecks.length === 0) {
      fail(
        'ENTITY_BRIDGE_EVIDENCE_REQUIRED',
        'A present entity bridge requires a selected subject, exact evidence, review, and conflict checks.',
      );
    }
  } else if (selectedEntitySubjectId !== null) {
    fail(
      'PROHIBITED_ENTITY_BRIDGE_SELECTION',
      'This bridge disposition cannot select an entity subject.',
    );
  }

  if (combination === 'ABSENT:NO_BRIDGE_WITNESS') {
    if (!reviewEvidence.complete_scope_id
      || reviewEvidence.decision !== 'PASS'
      || evidenceEdges.length === 0) {
      fail(
        'INCOMPLETE_ENTITY_BRIDGE_ABSENCE',
        'NO_BRIDGE_WITNESS requires a complete reviewed scope and exact evidence.',
      );
    }
  }
  if (combination === 'NOT_EXAMINED:SOURCE_LOCAL_ONLY'
    && reviewEvidence.decision !== 'NOT_REVIEWED') {
    fail(
      'INVALID_ENTITY_BRIDGE_REVIEW',
      'A not-examined source-local identity cannot assert a completed review.',
    );
  }
  if (combination === 'NOT_APPLICABLE:SOURCE_LOCAL_ONLY') {
    if (reviewEvidence.decision !== 'PASS'
      || reviewEvidence.applicability_evidence_ids.length === 0) {
      fail(
        'ENTITY_BRIDGE_EVIDENCE_REQUIRED',
        'NOT_APPLICABLE requires reviewed applicability evidence.',
      );
    }
    requireEvidenceSubset(
      reviewEvidence.applicability_evidence_ids,
      evidenceEdges,
      'UNBOUND_ENTITY_BRIDGE_APPLICABILITY_EVIDENCE',
      'Applicability evidence must be in the revision evidence set.',
    );
  }
  if (combination === 'FAILED:NONE') {
    if (!reviewEvidence.failure_detail
      || reviewEvidence.decision !== 'NOT_REVIEWED'
      || evidenceEdges.length !== 0) {
      fail(
        'INVALID_ENTITY_BRIDGE_FAILURE',
        'A failed bridge requires failure detail and cannot assert bridge evidence.',
      );
    }
  } else if (reviewEvidence.failure_detail !== null) {
    fail(
      'INVALID_ENTITY_BRIDGE_FAILURE',
      'Only a failed bridge can contain failure detail.',
    );
  }
  return true;
}

function buildEntityIdentityBridgeRevision(input = {}) {
  requireExactKeys(input, REVISION_INPUT_KEYS, 'entity identity bridge revision input');
  validateEntityIdentityBridge(input.entity_identity_bridge);
  if (!RELATIONSHIP_STATES.includes(input.state)) {
    fail('INVALID_ENTITY_BRIDGE_STATE', 'state is not governed.');
  }
  if (input.identity_disposition !== null
    && !IDENTITY_DISPOSITIONS.includes(input.identity_disposition)) {
    fail('INVALID_ENTITY_BRIDGE_DISPOSITION', 'identity_disposition is not governed.');
  }
  const evidenceEdges = uniqueSortedDigests(input.evidence_edges, 'evidence_edges');
  const conflictChecks = normaliseConflictChecks(input.conflict_checks, evidenceEdges);
  const reviewEvidence = normaliseReviewEvidence(input.review_evidence);
  const selectedEntitySubjectId = input.selected_entity_subject_id === null
    ? null
    : requireDigest(input.selected_entity_subject_id, 'selected_entity_subject_id');
  const bridgeRuleAndVersion = normaliseBridgeRule(
    input.bridge_rule_and_version,
    input.entity_identity_bridge,
  );
  const supersession = normaliseSupersession(input.supersession);
  const terminalEligible = validateDispositionRules({
    conflictChecks,
    evidenceEdges,
    identityDisposition: input.identity_disposition,
    reviewEvidence,
    selectedEntitySubjectId,
    state: input.state,
  });
  const body = {
    bridge_rule_and_version: bridgeRuleAndVersion,
    conflict_checks: conflictChecks,
    entity_identity_bridge_id: input.entity_identity_bridge.entity_identity_bridge_id,
    evidence_edges: evidenceEdges,
    identity_disposition: input.identity_disposition,
    review_evidence: reviewEvidence,
    selected_entity_subject_id: selectedEntitySubjectId,
    state: input.state,
    supersession,
  };
  return deepFreeze({
    schema_version: ENTITY_IDENTITY_BRIDGE_REVISION_SCHEMA_VERSION,
    entity_identity_bridge_revision_id: contentId(
      'ENTITY_IDENTITY_BRIDGE_REVISION/V1',
      body,
    ),
    ...body,
    terminal_eligible: terminalEligible,
  });
}

function validateEntityIdentityBridgeRevision({
  revision,
  entity_identity_bridge: entityIdentityBridge,
} = {}) {
  requireExactKeys(revision, REVISION_KEYS, 'entity identity bridge revision');
  validateEntityIdentityBridge(entityIdentityBridge);
  if (revision.entity_identity_bridge_id
    !== entityIdentityBridge.entity_identity_bridge_id) {
    fail(
      'STALE_ENTITY_IDENTITY_BRIDGE_REVISION',
      'Entity bridge revision refers to another occurrence.',
    );
  }
  const rebuilt = buildEntityIdentityBridgeRevision({
    entity_identity_bridge: entityIdentityBridge,
    bridge_rule_and_version: revision.bridge_rule_and_version,
    conflict_checks: revision.conflict_checks,
    evidence_edges: revision.evidence_edges,
    identity_disposition: revision.identity_disposition,
    review_evidence: revision.review_evidence,
    selected_entity_subject_id: revision.selected_entity_subject_id,
    state: revision.state,
    supersession: revision.supersession,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail(
      'STALE_ENTITY_IDENTITY_BRIDGE_REVISION',
      'Entity bridge revision identity or content is stale.',
    );
  }
  return true;
}

module.exports = {
  ENTITY_IDENTITY_BRIDGE_REVISION_SCHEMA_VERSION,
  ENTITY_IDENTITY_BRIDGE_SCHEMA_VERSION,
  EntityIdentityBridgeError,
  IDENTITY_DISPOSITIONS,
  RELATIONSHIP_STATES,
  buildEntityIdentityBridge,
  buildEntityIdentityBridgeRevision,
  validateEntityIdentityBridge,
  validateEntityIdentityBridgeRevision,
};
