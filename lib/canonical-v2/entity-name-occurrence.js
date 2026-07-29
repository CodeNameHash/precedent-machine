const { canonicalJson, contentId } = require('./canonical-bytes');

const ENTITY_NAME_OCCURRENCE_SCHEMA_VERSION = 'ENTITY_NAME_OCCURRENCE/V1';
const ENTITY_NAME_REVISION_SCHEMA_VERSION = 'ENTITY_NAME_REVISION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const LANGUAGE_RE = /^(?:und|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/;
const NAME_ROLES = Object.freeze([
  'LEGAL_NAME',
  'SHORT_NAME',
  'SOURCE_LOCAL_LABEL',
]);
const EVIDENCE_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);
const OCCURRENCE_INPUT_KEYS = Object.freeze([
  'expected_name_slot_key',
  'governed_ordinal',
  'name_role',
  'source_occurrence_id',
]);
const OCCURRENCE_KEYS = Object.freeze([
  'schema_version',
  'entity_name_occurrence_id',
  ...OCCURRENCE_INPUT_KEYS,
]);
const REVISION_INPUT_KEYS = Object.freeze([
  'entity_name_occurrence',
  'entity_subject_id',
  'evidence_state',
  'exact_name_text',
  'extraction_version',
  'language',
  'source_interval',
]);
const REVISION_KEYS = Object.freeze([
  'schema_version',
  'entity_name_revision_id',
  'entity_name_occurrence_id',
  'entity_subject_id',
  'evidence_state',
  'exact_name_text',
  'extraction_version',
  'language',
  'source_interval',
]);
const SOURCE_INTERVAL_KEYS = Object.freeze([
  'source_occurrence_id',
  'start_byte',
  'end_byte',
  'evidence_edge_id',
]);

class EntityNameOccurrenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'EntityNameOccurrenceError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new EntityNameOccurrenceError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_ENTITY_NAME', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_ENTITY_NAME', `${label} fields do not match the closed contract.`, {
      label,
    });
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_ENTITY_NAME', `${label} must be a SHA-256 content ID.`, { label });
  }
  return value;
}

function requireGovernedKey(value, label) {
  if (typeof value !== 'string' || !GOVERNED_KEY_RE.test(value)) {
    fail('INVALID_ENTITY_NAME', `${label} must be a governed uppercase key.`, { label });
  }
  return value;
}

function requireText(value, label, maximumBytes) {
  if (typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes) {
    fail(
      'INVALID_ENTITY_NAME',
      `${label} must be trimmed, non-empty text of at most ${maximumBytes} UTF-8 bytes.`,
      { label },
    );
  }
  return value;
}

function buildEntityNameOccurrence(input = {}) {
  requireExactKeys(input, OCCURRENCE_INPUT_KEYS, 'entity name occurrence input');
  const expectedNameSlotKey = requireGovernedKey(
    input.expected_name_slot_key,
    'expected_name_slot_key',
  );
  if (!Number.isSafeInteger(input.governed_ordinal) || input.governed_ordinal < 0) {
    fail('INVALID_ENTITY_NAME', 'governed_ordinal must be a non-negative safe integer.');
  }
  if (!NAME_ROLES.includes(input.name_role)) {
    fail('INVALID_ENTITY_NAME_ROLE', 'name_role is not governed.');
  }
  const body = {
    expected_name_slot_key: expectedNameSlotKey,
    governed_ordinal: input.governed_ordinal,
    name_role: input.name_role,
    source_occurrence_id: requireDigest(
      input.source_occurrence_id,
      'source_occurrence_id',
    ),
  };
  return deepFreeze({
    schema_version: ENTITY_NAME_OCCURRENCE_SCHEMA_VERSION,
    entity_name_occurrence_id: contentId('ENTITY_NAME_OCCURRENCE/V1', body),
    ...body,
  });
}

function validateEntityNameOccurrence(occurrence) {
  requireExactKeys(occurrence, OCCURRENCE_KEYS, 'entity name occurrence');
  const rebuilt = buildEntityNameOccurrence({
    expected_name_slot_key: occurrence.expected_name_slot_key,
    governed_ordinal: occurrence.governed_ordinal,
    name_role: occurrence.name_role,
    source_occurrence_id: occurrence.source_occurrence_id,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(occurrence)) {
    fail('STALE_ENTITY_NAME_OCCURRENCE', 'Entity name occurrence identity or content is stale.');
  }
  return true;
}

function uniqueSortedDigests(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_ENTITY_NAME', `${label} must be an array.`, { label });
  }
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`))
    .sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_ENTITY_NAME_EVIDENCE', `${label} contains a duplicate.`, { label });
  }
  return selected;
}

function normaliseEvidenceState(value) {
  requireObject(value, 'evidence_state');
  if (!EVIDENCE_STATES.includes(value.state)) {
    fail('INVALID_ENTITY_NAME_STATE', 'evidence_state.state is not governed.');
  }
  const keysByState = {
    PRESENT: ['state'],
    ABSENT: ['state', 'complete_scope_id', 'evidence_edge_ids'],
    NOT_APPLICABLE: ['state', 'applicability_evidence_ids'],
    NOT_EXAMINED: ['state', 'reason'],
    FAILED: ['state', 'failure_code', 'attempted_extractor'],
  };
  requireExactKeys(value, keysByState[value.state], 'evidence_state');
  if (value.state === 'ABSENT') {
    const evidenceEdgeIds = uniqueSortedDigests(
      value.evidence_edge_ids,
      'evidence_state.evidence_edge_ids',
    );
    if (evidenceEdgeIds.length === 0) {
      fail('INVALID_ENTITY_NAME_STATE', 'ABSENT requires exact evidence.');
    }
    return {
      state: value.state,
      complete_scope_id: requireDigest(value.complete_scope_id, 'complete_scope_id'),
      evidence_edge_ids: evidenceEdgeIds,
    };
  }
  if (value.state === 'NOT_APPLICABLE') {
    const evidenceIds = uniqueSortedDigests(
      value.applicability_evidence_ids,
      'applicability_evidence_ids',
    );
    if (evidenceIds.length === 0) {
      fail('INVALID_ENTITY_NAME_STATE', 'NOT_APPLICABLE requires evidence.');
    }
    return {
      state: value.state,
      applicability_evidence_ids: evidenceIds,
    };
  }
  if (value.state === 'NOT_EXAMINED') {
    return {
      state: value.state,
      reason: requireText(value.reason, 'evidence_state.reason', 256),
    };
  }
  if (value.state === 'FAILED') {
    return {
      state: value.state,
      failure_code: requireGovernedKey(
        value.failure_code,
        'evidence_state.failure_code',
      ),
      attempted_extractor: requireText(
        value.attempted_extractor,
        'evidence_state.attempted_extractor',
        256,
      ),
    };
  }
  return { state: value.state };
}

function normaliseSourceInterval(value, occurrence, exactNameText) {
  requireExactKeys(value, SOURCE_INTERVAL_KEYS, 'source_interval');
  if (value.source_occurrence_id !== occurrence.source_occurrence_id) {
    fail(
      'UNBOUND_ENTITY_NAME_SOURCE',
      'source_interval must use the admitted source occurrence.',
    );
  }
  if (!Number.isSafeInteger(value.start_byte)
    || !Number.isSafeInteger(value.end_byte)
    || value.start_byte < 0
    || value.end_byte <= value.start_byte) {
    fail(
      'INVALID_ENTITY_NAME_INTERVAL',
      'source_interval must use valid half-open UTF-8 byte offsets.',
    );
  }
  if (Buffer.byteLength(exactNameText, 'utf8') !== value.end_byte - value.start_byte) {
    fail(
      'INVALID_ENTITY_NAME_INTERVAL',
      'The exact name text byte length must equal the source interval length.',
    );
  }
  return {
    source_occurrence_id: value.source_occurrence_id,
    start_byte: value.start_byte,
    end_byte: value.end_byte,
    evidence_edge_id: requireDigest(value.evidence_edge_id, 'source_interval.evidence_edge_id'),
  };
}

function buildEntityNameRevision(input = {}) {
  requireExactKeys(input, REVISION_INPUT_KEYS, 'entity name revision input');
  validateEntityNameOccurrence(input.entity_name_occurrence);
  const evidenceState = normaliseEvidenceState(input.evidence_state);
  const isPresent = evidenceState.state === 'PRESENT';
  const exactNameText = isPresent
    ? requireText(input.exact_name_text, 'exact_name_text', 2048)
    : input.exact_name_text;
  const entitySubjectId = input.entity_subject_id === null
    ? null
    : requireDigest(input.entity_subject_id, 'entity_subject_id');
  const extractionVersion = requireText(
    input.extraction_version,
    'extraction_version',
    256,
  );
  if (typeof input.language !== 'string' || !LANGUAGE_RE.test(input.language)) {
    fail('INVALID_ENTITY_NAME_LANGUAGE', 'language must be a governed BCP 47 language tag.');
  }

  if (!isPresent && (exactNameText !== null || entitySubjectId !== null)) {
    fail(
      'NON_PRESENT_ENTITY_NAME_VALUE',
      'A non-present name revision cannot assert name text or an entity subject.',
    );
  }
  let sourceInterval = null;
  if (isPresent) {
    sourceInterval = normaliseSourceInterval(
      input.source_interval,
      input.entity_name_occurrence,
      exactNameText,
    );
  } else if (input.source_interval !== null) {
    fail(
      'NON_PRESENT_ENTITY_NAME_VALUE',
      'A non-present name revision cannot assert a source interval.',
    );
  }

  const body = {
    entity_name_occurrence_id: input.entity_name_occurrence.entity_name_occurrence_id,
    entity_subject_id: entitySubjectId,
    evidence_state: evidenceState,
    exact_name_text: exactNameText,
    extraction_version: extractionVersion,
    language: input.language,
    source_interval: sourceInterval,
  };
  return deepFreeze({
    schema_version: ENTITY_NAME_REVISION_SCHEMA_VERSION,
    entity_name_revision_id: contentId('ENTITY_NAME_REVISION/V1', body),
    ...body,
  });
}

function validateEntityNameRevision({
  revision,
  entity_name_occurrence: entityNameOccurrence,
} = {}) {
  requireExactKeys(revision, REVISION_KEYS, 'entity name revision');
  validateEntityNameOccurrence(entityNameOccurrence);
  if (revision.entity_name_occurrence_id
    !== entityNameOccurrence.entity_name_occurrence_id) {
    fail('STALE_ENTITY_NAME_REVISION', 'Entity name revision refers to another occurrence.');
  }
  const rebuilt = buildEntityNameRevision({
    entity_name_occurrence: entityNameOccurrence,
    entity_subject_id: revision.entity_subject_id,
    evidence_state: revision.evidence_state,
    exact_name_text: revision.exact_name_text,
    extraction_version: revision.extraction_version,
    language: revision.language,
    source_interval: revision.source_interval,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail('STALE_ENTITY_NAME_REVISION', 'Entity name revision identity or content is stale.');
  }
  return true;
}

module.exports = {
  ENTITY_NAME_OCCURRENCE_SCHEMA_VERSION,
  ENTITY_NAME_REVISION_SCHEMA_VERSION,
  EVIDENCE_STATES,
  EntityNameOccurrenceError,
  NAME_ROLES,
  buildEntityNameOccurrence,
  buildEntityNameRevision,
  validateEntityNameOccurrence,
  validateEntityNameRevision,
};
