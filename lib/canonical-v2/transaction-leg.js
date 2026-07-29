const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  LEGAL_ROLES,
  ROLE_LAYERS,
  TRANSACTION_ROLES,
} = require('./deal-participant-relationship');

const SOURCE_TRANSACTION_LEG_OCCURRENCE_SCHEMA_VERSION = 'SOURCE_TRANSACTION_LEG_OCCURRENCE/V1';
const SOURCE_TRANSACTION_LEG_REVISION_SCHEMA_VERSION = 'SOURCE_TRANSACTION_LEG_REVISION/V1';
const TRANSACTION_LEG_RESOLUTION_OCCURRENCE_SCHEMA_VERSION = 'TRANSACTION_LEG_RESOLUTION_OCCURRENCE/V1';
const TRANSACTION_LEG_RESOLUTION_REVISION_SCHEMA_VERSION = 'TRANSACTION_LEG_RESOLUTION_REVISION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const LEG_TYPES = Object.freeze([
  'DIRECT_MERGER',
  'FORWARD_TRIANGULAR_MERGER',
  'REVERSE_TRIANGULAR_MERGER',
  'TENDER_OFFER',
  'SECOND_STEP_MERGER',
  'DISTRIBUTION_OR_SPIN_OFF',
  'CONTRIBUTION',
  'SHARE_EXCHANGE',
  'SHARE_PURCHASE',
  'ASSET_TRANSFER',
  'NEW_HOLDCO_FORMATION',
  'OTHER_GOVERNED_STEP',
]);
const LEG_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);
const CONFLICT_DISPOSITIONS = Object.freeze([
  'CLEAR',
  'CONFLICTING',
  'UNRECONCILED_DUPLICATE',
  'UNRESOLVED_ENDPOINT',
]);
const SOURCE_OCCURRENCE_INPUT_KEYS = Object.freeze([
  'admitted_source_occurrence_id',
  'expected_source_leg_slot_key',
  'governed_deal_id',
  'governed_repeatable_ordinal',
  'leg_definition_and_version',
]);
const SOURCE_OCCURRENCE_KEYS = Object.freeze([
  'schema_version',
  'source_transaction_leg_occurrence_id',
  ...SOURCE_OCCURRENCE_INPUT_KEYS,
]);
const SOURCE_REVISION_INPUT_KEYS = Object.freeze([
  'source_transaction_leg_occurrence',
  'closing_condition',
  'effective_time_expression',
  'evidence_edges',
  'leg_type',
  'observed_participant_roles',
  'predecessor_and_successor_occurrence_ids',
  'resolver_version',
  'source_endpoints',
  'source_order',
  'state',
]);
const SOURCE_REVISION_KEYS = Object.freeze([
  'schema_version',
  'source_transaction_leg_revision_id',
  'source_transaction_leg_occurrence_id',
  'closing_condition',
  'effective_time_expression',
  'evidence_edges',
  'leg_type',
  'observed_participant_roles',
  'predecessor_and_successor_occurrence_ids',
  'resolver_version',
  'source_endpoints',
  'source_order',
  'state',
]);
const RESOLUTION_OCCURRENCE_INPUT_KEYS = Object.freeze([
  'expected_deal_leg_slot_key',
  'governed_deal_id',
  'governed_repeatable_ordinal',
  'leg_definition_and_version',
]);
const RESOLUTION_OCCURRENCE_KEYS = Object.freeze([
  'schema_version',
  'transaction_leg_resolution_occurrence_id',
  ...RESOLUTION_OCCURRENCE_INPUT_KEYS,
]);
const RESOLUTION_REVISION_INPUT_KEYS = Object.freeze([
  'transaction_leg_resolution_occurrence',
  'closing_conditions',
  'conflict_disposition',
  'effective_time_expression',
  'evidence_edges',
  'predecessor_and_successor_occurrence_ids',
  'resolved_participant_relationships',
  'resolved_source_and_target_entities',
  'resolver_version',
  'state',
  'supporting_source_leg_revisions',
]);
const RESOLUTION_REVISION_KEYS = Object.freeze([
  'schema_version',
  'transaction_leg_resolution_revision_id',
  'transaction_leg_resolution_occurrence_id',
  'closing_conditions',
  'conflict_disposition',
  'effective_time_expression',
  'evidence_edges',
  'predecessor_and_successor_occurrence_ids',
  'resolved_leg_type',
  'resolved_participant_relationships',
  'resolved_source_and_target_entities',
  'resolver_version',
  'state',
  'supporting_source_leg_revisions',
  'terminal_eligible',
]);
const ENDPOINT_KEYS = Object.freeze([
  'endpoint_slot_key',
  'endpoint_role',
  'entity_subject_id',
  'source_local_subject_occurrence_id',
]);
const PARTICIPANT_REF_KEYS = Object.freeze([
  'deal_participant_relationship_revision_id',
  'role_code',
  'role_layer',
]);
const SOURCE_LEG_REF_KEYS = Object.freeze([
  'source_transaction_leg_revision_id',
  'leg_type',
  'source_order',
]);

class TransactionLegError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TransactionLegError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new TransactionLegError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_TRANSACTION_LEG', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_TRANSACTION_LEG', `${label} fields do not match the closed contract.`, {
      label,
    });
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_TRANSACTION_LEG', `${label} must be a SHA-256 content ID.`, {
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
    fail('INVALID_TRANSACTION_LEG', `${label} must be a governed uppercase key.`, {
      label,
    });
  }
  return value;
}

function requireText(value, label, maximumBytes = 256) {
  if (typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes) {
    fail('INVALID_TRANSACTION_LEG', `${label} must be bounded, trimmed text.`, {
      label,
    });
  }
  return value;
}

function uniqueSortedDigests(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_TRANSACTION_LEG', `${label} must be an array.`, { label });
  }
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`))
    .sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_TRANSACTION_LEG_INPUT', `${label} contains a duplicate.`);
  }
  return selected;
}

function normaliseDefinition(value, label) {
  requireExactKeys(value, ['definition_key', 'definition_version'], label);
  if (!Number.isSafeInteger(value.definition_version) || value.definition_version < 1) {
    fail('INVALID_TRANSACTION_LEG', `${label}.definition_version must be positive.`);
  }
  return {
    definition_key: requireGovernedKey(value.definition_key, `${label}.definition_key`),
    definition_version: value.definition_version,
  };
}

function normaliseState(value) {
  requireObject(value, 'state');
  if (!LEG_STATES.includes(value.code)) {
    fail('INVALID_TRANSACTION_LEG_STATE', 'state.code is not governed.');
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
      fail('INVALID_TRANSACTION_LEG_STATE', 'NOT_APPLICABLE requires evidence.');
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

function normaliseLinks(value, ownOccurrenceId, label) {
  requireExactKeys(value, ['predecessor_occurrence_ids', 'successor_occurrence_ids'], label);
  const predecessorIds = uniqueSortedDigests(
    value.predecessor_occurrence_ids,
    `${label}.predecessor_occurrence_ids`,
  );
  const successorIds = uniqueSortedDigests(
    value.successor_occurrence_ids,
    `${label}.successor_occurrence_ids`,
  );
  if (predecessorIds.includes(ownOccurrenceId)
    || successorIds.includes(ownOccurrenceId)
    || predecessorIds.some((id) => successorIds.includes(id))) {
    fail(
      'INVALID_TRANSACTION_LEG_TOPOLOGY',
      'A leg cannot reference itself or use the same leg as predecessor and successor.',
    );
  }
  return {
    predecessor_occurrence_ids: predecessorIds,
    successor_occurrence_ids: successorIds,
  };
}

function validateRole(roleLayer, roleCode, label) {
  if (!ROLE_LAYERS.includes(roleLayer)) {
    fail('INVALID_TRANSACTION_LEG_ROLE', `${label}.role_layer is not governed.`);
  }
  const roles = roleLayer === 'LEGAL_DOCUMENT_ROLE' ? LEGAL_ROLES : TRANSACTION_ROLES;
  if (!roles.includes(roleCode)) {
    fail(
      'INVALID_TRANSACTION_LEG_ROLE',
      `${roleCode} is not permitted in ${roleLayer}.`,
    );
  }
}

function normaliseParticipantRefs(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_TRANSACTION_LEG', `${label} must be an array.`);
  }
  const selected = values.map((value, index) => {
    const itemLabel = `${label}[${index}]`;
    requireExactKeys(value, PARTICIPANT_REF_KEYS, itemLabel);
    validateRole(value.role_layer, value.role_code, itemLabel);
    return {
      deal_participant_relationship_revision_id: requireDigest(
        value.deal_participant_relationship_revision_id,
        `${itemLabel}.deal_participant_relationship_revision_id`,
      ),
      role_code: value.role_code,
      role_layer: value.role_layer,
    };
  }).sort((left, right) => (
    left.deal_participant_relationship_revision_id
      .localeCompare(right.deal_participant_relationship_revision_id)
  ));
  if (new Set(selected.map(
    (item) => item.deal_participant_relationship_revision_id,
  )).size !== selected.length) {
    fail('DUPLICATE_TRANSACTION_LEG_INPUT', `${label} contains a duplicate revision.`);
  }
  return selected;
}

function normaliseEndpoints(values) {
  if (!Array.isArray(values)) {
    fail('INVALID_TRANSACTION_LEG', 'source_endpoints must be an array.');
  }
  const selected = values.map((value, index) => {
    const label = `source_endpoints[${index}]`;
    requireExactKeys(value, ENDPOINT_KEYS, label);
    const entitySubjectId = optionalDigest(
      value.entity_subject_id,
      `${label}.entity_subject_id`,
    );
    const sourceLocalId = optionalDigest(
      value.source_local_subject_occurrence_id,
      `${label}.source_local_subject_occurrence_id`,
    );
    if ([entitySubjectId, sourceLocalId].filter(Boolean).length !== 1) {
      fail(
        'INVALID_TRANSACTION_LEG_ENDPOINT',
        'Each source endpoint requires exactly one governed or source-local subject.',
      );
    }
    return {
      endpoint_slot_key: requireGovernedKey(
        value.endpoint_slot_key,
        `${label}.endpoint_slot_key`,
      ),
      endpoint_role: requireGovernedKey(value.endpoint_role, `${label}.endpoint_role`),
      entity_subject_id: entitySubjectId,
      source_local_subject_occurrence_id: sourceLocalId,
    };
  }).sort((left, right) => left.endpoint_slot_key.localeCompare(right.endpoint_slot_key));
  if (new Set(selected.map((item) => item.endpoint_slot_key)).size !== selected.length) {
    fail('DUPLICATE_TRANSACTION_LEG_INPUT', 'source_endpoints contains a duplicate slot.');
  }
  return selected;
}

function buildSourceTransactionLegOccurrence(input = {}) {
  requireExactKeys(input, SOURCE_OCCURRENCE_INPUT_KEYS, 'source transaction leg input');
  if (!Number.isSafeInteger(input.governed_repeatable_ordinal)
    || input.governed_repeatable_ordinal < 0) {
    fail(
      'INVALID_TRANSACTION_LEG',
      'governed_repeatable_ordinal must be a non-negative safe integer.',
    );
  }
  const body = {
    admitted_source_occurrence_id: requireDigest(
      input.admitted_source_occurrence_id,
      'admitted_source_occurrence_id',
    ),
    expected_source_leg_slot_key: requireGovernedKey(
      input.expected_source_leg_slot_key,
      'expected_source_leg_slot_key',
    ),
    governed_deal_id: requireDigest(input.governed_deal_id, 'governed_deal_id'),
    governed_repeatable_ordinal: input.governed_repeatable_ordinal,
    leg_definition_and_version: normaliseDefinition(
      input.leg_definition_and_version,
      'leg_definition_and_version',
    ),
  };
  return deepFreeze({
    schema_version: SOURCE_TRANSACTION_LEG_OCCURRENCE_SCHEMA_VERSION,
    source_transaction_leg_occurrence_id: contentId(
      'SOURCE_TRANSACTION_LEG_OCCURRENCE/V1',
      body,
    ),
    ...body,
  });
}

function validateSourceTransactionLegOccurrence(occurrence) {
  requireExactKeys(occurrence, SOURCE_OCCURRENCE_KEYS, 'source transaction leg occurrence');
  const rebuilt = buildSourceTransactionLegOccurrence({
    admitted_source_occurrence_id: occurrence.admitted_source_occurrence_id,
    expected_source_leg_slot_key: occurrence.expected_source_leg_slot_key,
    governed_deal_id: occurrence.governed_deal_id,
    governed_repeatable_ordinal: occurrence.governed_repeatable_ordinal,
    leg_definition_and_version: occurrence.leg_definition_and_version,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(occurrence)) {
    fail('STALE_SOURCE_TRANSACTION_LEG', 'Source leg occurrence identity or content is stale.');
  }
  return true;
}

function buildSourceTransactionLegRevision(input = {}) {
  requireExactKeys(input, SOURCE_REVISION_INPUT_KEYS, 'source transaction leg revision input');
  validateSourceTransactionLegOccurrence(input.source_transaction_leg_occurrence);
  const occurrence = input.source_transaction_leg_occurrence;
  const state = normaliseState(input.state);
  const evidenceEdges = uniqueSortedDigests(input.evidence_edges, 'evidence_edges');
  const endpoints = normaliseEndpoints(input.source_endpoints);
  const participantRoles = normaliseParticipantRefs(
    input.observed_participant_roles,
    'observed_participant_roles',
  );
  const isPresent = state.code === 'PRESENT';
  const legType = input.leg_type;
  const sourceOrder = input.source_order;
  const closingCondition = optionalDigest(input.closing_condition, 'closing_condition');
  const effectiveTimeExpression = optionalDigest(
    input.effective_time_expression,
    'effective_time_expression',
  );
  const links = normaliseLinks(
    input.predecessor_and_successor_occurrence_ids,
    occurrence.source_transaction_leg_occurrence_id,
    'predecessor_and_successor_occurrence_ids',
  );
  if (isPresent && !LEG_TYPES.includes(legType)) {
    fail('INVALID_TRANSACTION_LEG_TYPE', 'leg_type is not governed.');
  }
  if (isPresent && (!Number.isSafeInteger(sourceOrder) || sourceOrder < 0)) {
    fail('INVALID_TRANSACTION_LEG', 'A present source leg requires source_order.');
  }
  if (isPresent
    && (endpoints.length < 2 || participantRoles.length < 2 || evidenceEdges.length === 0)) {
    fail(
      'SOURCE_TRANSACTION_LEG_EVIDENCE_REQUIRED',
      'A present source leg requires endpoints, participant roles, order, and evidence.',
    );
  }
  if (!isPresent && (
    legType !== null
    || endpoints.length !== 0
    || participantRoles.length !== 0
    || sourceOrder !== null
    || closingCondition !== null
    || effectiveTimeExpression !== null
    || links.predecessor_occurrence_ids.length !== 0
    || links.successor_occurrence_ids.length !== 0
  )) {
    fail(
      'NON_PRESENT_TRANSACTION_LEG_VALUE',
      'A non-present source leg cannot assert leg values.',
    );
  }
  if (['ABSENT', 'NOT_APPLICABLE'].includes(state.code) && evidenceEdges.length === 0) {
    fail('SOURCE_TRANSACTION_LEG_EVIDENCE_REQUIRED', `${state.code} requires evidence.`);
  }
  if (state.code === 'NOT_APPLICABLE'
    && state.applicability_evidence_ids.some((id) => !evidenceEdges.includes(id))) {
    fail(
      'UNBOUND_TRANSACTION_LEG_EVIDENCE',
      'Applicability evidence must be in the source-leg evidence set.',
    );
  }
  const body = {
    closing_condition: closingCondition,
    effective_time_expression: effectiveTimeExpression,
    evidence_edges: evidenceEdges,
    leg_type: legType,
    observed_participant_roles: participantRoles,
    predecessor_and_successor_occurrence_ids: links,
    resolver_version: requireText(input.resolver_version, 'resolver_version'),
    source_endpoints: endpoints,
    source_order: sourceOrder,
    source_transaction_leg_occurrence_id:
      occurrence.source_transaction_leg_occurrence_id,
    state,
  };
  return deepFreeze({
    schema_version: SOURCE_TRANSACTION_LEG_REVISION_SCHEMA_VERSION,
    source_transaction_leg_revision_id: contentId(
      'SOURCE_TRANSACTION_LEG_REVISION/V1',
      body,
    ),
    ...body,
  });
}

function validateSourceTransactionLegRevision({
  revision,
  source_transaction_leg_occurrence: occurrence,
} = {}) {
  requireExactKeys(revision, SOURCE_REVISION_KEYS, 'source transaction leg revision');
  validateSourceTransactionLegOccurrence(occurrence);
  if (revision.source_transaction_leg_occurrence_id
    !== occurrence.source_transaction_leg_occurrence_id) {
    fail('STALE_SOURCE_TRANSACTION_LEG_REVISION', 'Revision refers to another source leg.');
  }
  const rebuilt = buildSourceTransactionLegRevision({
    source_transaction_leg_occurrence: occurrence,
    closing_condition: revision.closing_condition,
    effective_time_expression: revision.effective_time_expression,
    evidence_edges: revision.evidence_edges,
    leg_type: revision.leg_type,
    observed_participant_roles: revision.observed_participant_roles,
    predecessor_and_successor_occurrence_ids:
      revision.predecessor_and_successor_occurrence_ids,
    resolver_version: revision.resolver_version,
    source_endpoints: revision.source_endpoints,
    source_order: revision.source_order,
    state: revision.state,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail('STALE_SOURCE_TRANSACTION_LEG_REVISION', 'Revision identity or content is stale.');
  }
  return true;
}

function buildTransactionLegResolutionOccurrence(input = {}) {
  requireExactKeys(
    input,
    RESOLUTION_OCCURRENCE_INPUT_KEYS,
    'transaction leg resolution input',
  );
  if (!Number.isSafeInteger(input.governed_repeatable_ordinal)
    || input.governed_repeatable_ordinal < 0) {
    fail(
      'INVALID_TRANSACTION_LEG',
      'governed_repeatable_ordinal must be a non-negative safe integer.',
    );
  }
  const body = {
    expected_deal_leg_slot_key: requireGovernedKey(
      input.expected_deal_leg_slot_key,
      'expected_deal_leg_slot_key',
    ),
    governed_deal_id: requireDigest(input.governed_deal_id, 'governed_deal_id'),
    governed_repeatable_ordinal: input.governed_repeatable_ordinal,
    leg_definition_and_version: normaliseDefinition(
      input.leg_definition_and_version,
      'leg_definition_and_version',
    ),
  };
  return deepFreeze({
    schema_version: TRANSACTION_LEG_RESOLUTION_OCCURRENCE_SCHEMA_VERSION,
    transaction_leg_resolution_occurrence_id: contentId(
      'TRANSACTION_LEG_RESOLUTION_OCCURRENCE/V1',
      body,
    ),
    ...body,
  });
}

function validateTransactionLegResolutionOccurrence(occurrence) {
  requireExactKeys(
    occurrence,
    RESOLUTION_OCCURRENCE_KEYS,
    'transaction leg resolution occurrence',
  );
  const rebuilt = buildTransactionLegResolutionOccurrence({
    expected_deal_leg_slot_key: occurrence.expected_deal_leg_slot_key,
    governed_deal_id: occurrence.governed_deal_id,
    governed_repeatable_ordinal: occurrence.governed_repeatable_ordinal,
    leg_definition_and_version: occurrence.leg_definition_and_version,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(occurrence)) {
    fail(
      'STALE_TRANSACTION_LEG_RESOLUTION',
      'Transaction leg resolution identity or content is stale.',
    );
  }
  return true;
}

function normaliseSourceLegRefs(values) {
  if (!Array.isArray(values)) {
    fail('INVALID_TRANSACTION_LEG', 'supporting_source_leg_revisions must be an array.');
  }
  const selected = values.map((value, index) => {
    const label = `supporting_source_leg_revisions[${index}]`;
    requireExactKeys(value, SOURCE_LEG_REF_KEYS, label);
    if (!LEG_TYPES.includes(value.leg_type)
      || !Number.isSafeInteger(value.source_order)
      || value.source_order < 0) {
      fail('INVALID_TRANSACTION_LEG', `${label} is not a governed source-leg reference.`);
    }
    return {
      source_transaction_leg_revision_id: requireDigest(
        value.source_transaction_leg_revision_id,
        `${label}.source_transaction_leg_revision_id`,
      ),
      leg_type: value.leg_type,
      source_order: value.source_order,
    };
  }).sort((left, right) => (
    left.source_order - right.source_order
      || left.source_transaction_leg_revision_id
        .localeCompare(right.source_transaction_leg_revision_id)
  ));
  if (new Set(selected.map(
    (item) => item.source_transaction_leg_revision_id,
  )).size !== selected.length) {
    fail(
      'DUPLICATE_TRANSACTION_LEG_INPUT',
      'supporting_source_leg_revisions contains a duplicate revision.',
    );
  }
  return selected;
}

function normaliseResolvedEndpoints(value) {
  requireExactKeys(
    value,
    ['source_entity_ids', 'target_entity_ids'],
    'resolved_source_and_target_entities',
  );
  return {
    source_entity_ids: uniqueSortedDigests(
      value.source_entity_ids,
      'resolved_source_and_target_entities.source_entity_ids',
    ),
    target_entity_ids: uniqueSortedDigests(
      value.target_entity_ids,
      'resolved_source_and_target_entities.target_entity_ids',
    ),
  };
}

function buildTransactionLegResolutionRevision(input = {}) {
  requireExactKeys(
    input,
    RESOLUTION_REVISION_INPUT_KEYS,
    'transaction leg resolution revision input',
  );
  validateTransactionLegResolutionOccurrence(input.transaction_leg_resolution_occurrence);
  const occurrence = input.transaction_leg_resolution_occurrence;
  const state = normaliseState(input.state);
  if (!CONFLICT_DISPOSITIONS.includes(input.conflict_disposition)) {
    fail('INVALID_TRANSACTION_LEG_CONFLICT', 'conflict_disposition is not governed.');
  }
  const sourceLegRefs = normaliseSourceLegRefs(input.supporting_source_leg_revisions);
  const participantRefs = normaliseParticipantRefs(
    input.resolved_participant_relationships,
    'resolved_participant_relationships',
  );
  const endpoints = normaliseResolvedEndpoints(input.resolved_source_and_target_entities);
  const evidenceEdges = uniqueSortedDigests(input.evidence_edges, 'evidence_edges');
  const closingConditions = uniqueSortedDigests(
    input.closing_conditions,
    'closing_conditions',
  );
  const effectiveTimeExpression = optionalDigest(
    input.effective_time_expression,
    'effective_time_expression',
  );
  const legTypes = [...new Set(sourceLegRefs.map((item) => item.leg_type))];
  const resolvedLegType = legTypes.length === 1 ? legTypes[0] : null;
  const isPresent = state.code === 'PRESENT';
  const terminalEligible = isPresent && input.conflict_disposition === 'CLEAR';
  const links = normaliseLinks(
    input.predecessor_and_successor_occurrence_ids,
    occurrence.transaction_leg_resolution_occurrence_id,
    'predecessor_and_successor_occurrence_ids',
  );

  if (terminalEligible && (
    sourceLegRefs.length === 0
    || participantRefs.length < 2
    || endpoints.source_entity_ids.length === 0
    || endpoints.target_entity_ids.length === 0
    || evidenceEdges.length === 0
    || resolvedLegType === null
  )) {
    fail(
      'TRANSACTION_LEG_RESOLUTION_INCOMPLETE',
      'A terminal transaction leg requires complete sources, roles, endpoints, and evidence.',
    );
  }
  if (isPresent && input.conflict_disposition !== 'CLEAR') {
    if (evidenceEdges.length === 0) {
      fail(
        'TRANSACTION_LEG_RESOLUTION_INCOMPLETE',
        'A blocked transaction-leg candidate requires conflict evidence.',
      );
    }
  }
  if (!isPresent && (
    sourceLegRefs.length !== 0
    || participantRefs.length !== 0
    || endpoints.source_entity_ids.length !== 0
    || endpoints.target_entity_ids.length !== 0
    || closingConditions.length !== 0
    || effectiveTimeExpression !== null
    || input.conflict_disposition !== 'CLEAR'
    || links.predecessor_occurrence_ids.length !== 0
    || links.successor_occurrence_ids.length !== 0
  )) {
    fail(
      'NON_PRESENT_TRANSACTION_LEG_VALUE',
      'A non-present transaction-leg resolution cannot assert leg values.',
    );
  }
  if (['ABSENT', 'NOT_APPLICABLE'].includes(state.code) && evidenceEdges.length === 0) {
    fail('TRANSACTION_LEG_RESOLUTION_INCOMPLETE', `${state.code} requires evidence.`);
  }
  if (state.code === 'NOT_APPLICABLE'
    && state.applicability_evidence_ids.some((id) => !evidenceEdges.includes(id))) {
    fail(
      'UNBOUND_TRANSACTION_LEG_EVIDENCE',
      'Applicability evidence must be in the resolved-leg evidence set.',
    );
  }

  const body = {
    closing_conditions: closingConditions,
    conflict_disposition: input.conflict_disposition,
    effective_time_expression: effectiveTimeExpression,
    evidence_edges: evidenceEdges,
    predecessor_and_successor_occurrence_ids: links,
    resolved_participant_relationships: participantRefs,
    resolved_source_and_target_entities: endpoints,
    resolver_version: requireText(input.resolver_version, 'resolver_version'),
    state,
    supporting_source_leg_revisions: sourceLegRefs,
    transaction_leg_resolution_occurrence_id:
      occurrence.transaction_leg_resolution_occurrence_id,
  };
  return deepFreeze({
    schema_version: TRANSACTION_LEG_RESOLUTION_REVISION_SCHEMA_VERSION,
    transaction_leg_resolution_revision_id: contentId(
      'TRANSACTION_LEG_RESOLUTION_REVISION/V1',
      body,
    ),
    ...body,
    resolved_leg_type: resolvedLegType,
    terminal_eligible: terminalEligible,
  });
}

function validateTransactionLegResolutionRevision({
  revision,
  transaction_leg_resolution_occurrence: occurrence,
} = {}) {
  requireExactKeys(revision, RESOLUTION_REVISION_KEYS, 'transaction leg resolution revision');
  validateTransactionLegResolutionOccurrence(occurrence);
  if (revision.transaction_leg_resolution_occurrence_id
    !== occurrence.transaction_leg_resolution_occurrence_id) {
    fail('STALE_TRANSACTION_LEG_RESOLUTION_REVISION', 'Revision refers to another leg.');
  }
  const rebuilt = buildTransactionLegResolutionRevision({
    transaction_leg_resolution_occurrence: occurrence,
    closing_conditions: revision.closing_conditions,
    conflict_disposition: revision.conflict_disposition,
    effective_time_expression: revision.effective_time_expression,
    evidence_edges: revision.evidence_edges,
    predecessor_and_successor_occurrence_ids:
      revision.predecessor_and_successor_occurrence_ids,
    resolved_participant_relationships: revision.resolved_participant_relationships,
    resolved_source_and_target_entities: revision.resolved_source_and_target_entities,
    resolver_version: revision.resolver_version,
    state: revision.state,
    supporting_source_leg_revisions: revision.supporting_source_leg_revisions,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail(
      'STALE_TRANSACTION_LEG_RESOLUTION_REVISION',
      'Revision identity or content is stale.',
    );
  }
  return true;
}

module.exports = {
  CONFLICT_DISPOSITIONS,
  LEG_STATES,
  LEG_TYPES,
  SOURCE_TRANSACTION_LEG_OCCURRENCE_SCHEMA_VERSION,
  SOURCE_TRANSACTION_LEG_REVISION_SCHEMA_VERSION,
  TRANSACTION_LEG_RESOLUTION_OCCURRENCE_SCHEMA_VERSION,
  TRANSACTION_LEG_RESOLUTION_REVISION_SCHEMA_VERSION,
  TransactionLegError,
  buildSourceTransactionLegOccurrence,
  buildSourceTransactionLegRevision,
  buildTransactionLegResolutionOccurrence,
  buildTransactionLegResolutionRevision,
  validateSourceTransactionLegOccurrence,
  validateSourceTransactionLegRevision,
  validateTransactionLegResolutionOccurrence,
  validateTransactionLegResolutionRevision,
};
