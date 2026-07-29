const { canonicalJson, contentId } = require('./canonical-bytes');

const ENTITY_SUBJECT_SCHEMA_VERSION = 'ENTITY_SUBJECT/V1';
const ENTITY_SUBJECT_REVISION_SCHEMA_VERSION = 'ENTITY_SUBJECT_REVISION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;
const LEI_RE = /^[A-Z0-9]{20}$/;
const SEC_CIK_RE = /^[0-9]{10}$/;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const IDENTITY_AUTHORITY_TYPES = Object.freeze([
  'SEC_CIK',
  'LEI',
  'BEN_APPROVED_IMMUTABLE_IMPORT_SEED',
]);
const SUBJECT_CLASSES = Object.freeze([
  'NATURAL_PERSON',
  'ORGANISATION',
  'GOVERNMENT_BODY',
]);
const CLASSIFICATION_CODES = Object.freeze([
  'PUBLIC_COMPANY',
  'PRIVATE_COMPANY',
  'INVESTMENT_FIRM',
  'LAW_FIRM',
  'FINANCIAL_SERVICES_FIRM',
  'OTHER_ORGANISATION',
]);
const REVISION_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);
const SUBJECT_INPUT_KEYS = Object.freeze([
  'identity_authority_type',
  'identity_authority_value',
  'identity_authority_evidence',
]);
const SUBJECT_KEYS = Object.freeze([
  'schema_version',
  'entity_subject_id',
  ...SUBJECT_INPUT_KEYS,
]);
const REVISION_INPUT_KEYS = Object.freeze([
  'entity_subject',
  'classification_revisions',
  'display_label',
  'evidence_edges',
  'revision_status',
]);
const REVISION_KEYS = Object.freeze([
  'schema_version',
  'entity_subject_revision_id',
  'entity_subject_id',
  'classification_revisions',
  'display_label',
  'evidence_edges',
  'revision_status',
]);
const CLASSIFICATION_KEYS = Object.freeze([
  'subject_class',
  'classification_code',
  'evidence_edge_id',
  'effective_time_scope_id',
]);

class EntitySubjectError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'EntitySubjectError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new EntitySubjectError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_ENTITY_SUBJECT', `${label} must be an object.`, { label });
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  requireObject(value, label);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail('INVALID_ENTITY_SUBJECT', `${label} fields do not match the closed contract.`, {
      label,
    });
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_ENTITY_SUBJECT', `${label} must be a SHA-256 content ID.`, { label });
  }
  return value;
}

function requireText(value, label, maximumBytes = 512) {
  if (typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes) {
    fail(
      'INVALID_ENTITY_SUBJECT',
      `${label} must be trimmed, non-empty text of at most ${maximumBytes} UTF-8 bytes.`,
      { label },
    );
  }
  return value;
}

function uniqueSortedDigests(values, label) {
  if (!Array.isArray(values)) {
    fail('INVALID_ENTITY_SUBJECT', `${label} must be an array.`, { label });
  }
  const selected = values.map((value, index) => requireDigest(value, `${label}[${index}]`))
    .sort();
  if (new Set(selected).size !== selected.length) {
    fail('DUPLICATE_ENTITY_SUBJECT_EVIDENCE', `${label} contains a duplicate.`, {
      label,
    });
  }
  return selected;
}

function normaliseAuthorityValue(authorityType, value) {
  const selected = requireText(value, 'identity_authority_value');
  if (authorityType === 'SEC_CIK' && !SEC_CIK_RE.test(selected)) {
    fail('INVALID_ENTITY_SUBJECT_AUTHORITY', 'SEC_CIK requires a zero-padded 10-digit CIK.');
  }
  if (authorityType === 'LEI' && !LEI_RE.test(selected)) {
    fail('INVALID_ENTITY_SUBJECT_AUTHORITY', 'LEI requires a 20-character uppercase identifier.');
  }
  if (authorityType === 'BEN_APPROVED_IMMUTABLE_IMPORT_SEED') {
    if (!GOVERNED_KEY_RE.test(selected) || UUID_RE.test(selected)) {
      fail(
        'PROHIBITED_ENTITY_SUBJECT_SEED',
        'The immutable import seed must be a governed key and cannot be an application UUID.',
      );
    }
  }
  return selected;
}

function normaliseAuthorityEvidence(authorityType, evidence) {
  requireObject(evidence, 'identity_authority_evidence');
  if (authorityType === 'BEN_APPROVED_IMMUTABLE_IMPORT_SEED') {
    requireExactKeys(
      evidence,
      ['evidence_kind', 'approval_attestation_id'],
      'identity_authority_evidence',
    );
    if (evidence.evidence_kind !== 'GOVERNED_APPROVAL_ATTESTATION') {
      fail(
        'MISSING_ENTITY_SUBJECT_AUTHORITY',
        'An immutable import seed requires a governed approval attestation.',
      );
    }
    return {
      evidence_kind: evidence.evidence_kind,
      approval_attestation_id: requireDigest(
        evidence.approval_attestation_id,
        'approval_attestation_id',
      ),
    };
  }

  requireExactKeys(
    evidence,
    ['evidence_kind', 'source_occurrence_id'],
    'identity_authority_evidence',
  );
  if (evidence.evidence_kind !== 'EXACT_SOURCE_OCCURRENCE') {
    fail(
      'MISSING_ENTITY_SUBJECT_AUTHORITY',
      `${authorityType} requires an exact source occurrence.`,
    );
  }
  return {
    evidence_kind: evidence.evidence_kind,
    source_occurrence_id: requireDigest(
      evidence.source_occurrence_id,
      'source_occurrence_id',
    ),
  };
}

function buildEntitySubject(input = {}) {
  requireExactKeys(input, SUBJECT_INPUT_KEYS, 'entity subject input');
  if (!IDENTITY_AUTHORITY_TYPES.includes(input.identity_authority_type)) {
    fail(
      'INVALID_ENTITY_SUBJECT_AUTHORITY',
      'identity_authority_type is not governed.',
      { identity_authority_type: input.identity_authority_type },
    );
  }
  const identityAuthorityValue = normaliseAuthorityValue(
    input.identity_authority_type,
    input.identity_authority_value,
  );
  const identityAuthorityEvidence = normaliseAuthorityEvidence(
    input.identity_authority_type,
    input.identity_authority_evidence,
  );
  const identity = {
    identity_authority_type: input.identity_authority_type,
    identity_authority_value: identityAuthorityValue,
  };
  return deepFreeze({
    schema_version: ENTITY_SUBJECT_SCHEMA_VERSION,
    entity_subject_id: contentId('ENTITY_SUBJECT/V1', identity),
    ...identity,
    identity_authority_evidence: identityAuthorityEvidence,
  });
}

function validateEntitySubject(subject) {
  requireExactKeys(subject, SUBJECT_KEYS, 'entity subject');
  const rebuilt = buildEntitySubject({
    identity_authority_type: subject.identity_authority_type,
    identity_authority_value: subject.identity_authority_value,
    identity_authority_evidence: subject.identity_authority_evidence,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(subject)) {
    fail('STALE_ENTITY_SUBJECT', 'Entity subject identity or content is stale.');
  }
  return true;
}

function normaliseClassification(item, index) {
  const label = `classification_revisions[${index}]`;
  requireExactKeys(item, CLASSIFICATION_KEYS, label);
  if (!SUBJECT_CLASSES.includes(item.subject_class)) {
    fail('INVALID_ENTITY_SUBJECT_CLASS', `${label}.subject_class is not governed.`);
  }
  if (item.subject_class === 'ORGANISATION') {
    if (!CLASSIFICATION_CODES.includes(item.classification_code)) {
      fail('INVALID_ENTITY_CLASSIFICATION', `${label}.classification_code is not governed.`);
    }
  } else if (item.classification_code !== null) {
    fail(
      'INVALID_ENTITY_CLASSIFICATION',
      `${label}.classification_code must be null for this subject class.`,
    );
  }
  return {
    subject_class: item.subject_class,
    classification_code: item.classification_code,
    evidence_edge_id: requireDigest(item.evidence_edge_id, `${label}.evidence_edge_id`),
    effective_time_scope_id: requireDigest(
      item.effective_time_scope_id,
      `${label}.effective_time_scope_id`,
    ),
  };
}

function normaliseClassifications(values) {
  if (!Array.isArray(values)) {
    fail('INVALID_ENTITY_SUBJECT', 'classification_revisions must be an array.');
  }
  const selected = values.map(normaliseClassification)
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  if (new Set(selected.map(canonicalJson)).size !== selected.length) {
    fail('DUPLICATE_ENTITY_CLASSIFICATION', 'classification_revisions contains a duplicate.');
  }
  if (new Set(selected.map((item) => item.subject_class)).size > 1) {
    fail(
      'CONFLICTING_ENTITY_SUBJECT_CLASS',
      'One entity revision cannot contain different stable subject classes.',
    );
  }
  return selected;
}

function normaliseRevisionStatus(status) {
  requireObject(status, 'revision_status');
  if (!REVISION_STATES.includes(status.state)) {
    fail('INVALID_ENTITY_REVISION_STATE', 'revision_status.state is not governed.');
  }
  const keysByState = {
    PRESENT: ['state'],
    ABSENT: ['state', 'complete_scope_id'],
    NOT_APPLICABLE: ['state', 'applicability_evidence_ids'],
    NOT_EXAMINED: ['state', 'reason'],
    FAILED: ['state', 'failure_code', 'attempted_operation'],
  };
  requireExactKeys(status, keysByState[status.state], 'revision_status');
  if (status.state === 'ABSENT') {
    return {
      state: status.state,
      complete_scope_id: requireDigest(status.complete_scope_id, 'complete_scope_id'),
    };
  }
  if (status.state === 'NOT_APPLICABLE') {
    const applicabilityEvidenceIds = uniqueSortedDigests(
      status.applicability_evidence_ids,
      'applicability_evidence_ids',
    );
    if (applicabilityEvidenceIds.length === 0) {
      fail(
        'INVALID_ENTITY_REVISION_STATE',
        'NOT_APPLICABLE requires applicability evidence.',
      );
    }
    return {
      state: status.state,
      applicability_evidence_ids: applicabilityEvidenceIds,
    };
  }
  if (status.state === 'NOT_EXAMINED') {
    return {
      state: status.state,
      reason: requireText(status.reason, 'revision_status.reason', 256),
    };
  }
  if (status.state === 'FAILED') {
    return {
      state: status.state,
      failure_code: requireText(status.failure_code, 'revision_status.failure_code', 128),
      attempted_operation: requireText(
        status.attempted_operation,
        'revision_status.attempted_operation',
        256,
      ),
    };
  }
  return { state: status.state };
}

function buildEntitySubjectRevision(input = {}) {
  requireExactKeys(input, REVISION_INPUT_KEYS, 'entity subject revision input');
  validateEntitySubject(input.entity_subject);
  const classifications = normaliseClassifications(input.classification_revisions);
  const evidenceEdges = uniqueSortedDigests(input.evidence_edges, 'evidence_edges');
  const revisionStatus = normaliseRevisionStatus(input.revision_status);
  const isPresent = revisionStatus.state === 'PRESENT';
  const displayLabel = isPresent
    ? requireText(input.display_label, 'display_label', 512)
    : input.display_label;

  if (isPresent && (classifications.length === 0 || evidenceEdges.length === 0)) {
    fail(
      'ENTITY_SUBJECT_EVIDENCE_REQUIRED',
      'A present entity revision requires classification and exact evidence.',
    );
  }
  if (!isPresent && (displayLabel !== null || classifications.length !== 0)) {
    fail(
      'NON_PRESENT_ENTITY_VALUE',
      'A non-present entity revision cannot assert a label or classification.',
    );
  }
  if (['ABSENT', 'NOT_APPLICABLE'].includes(revisionStatus.state)
    && evidenceEdges.length === 0) {
    fail(
      'ENTITY_SUBJECT_EVIDENCE_REQUIRED',
      `${revisionStatus.state} requires exact evidence.`,
    );
  }
  const referencedClassificationEvidence = classifications.map(
    (item) => item.evidence_edge_id,
  );
  if (referencedClassificationEvidence.some((id) => !evidenceEdges.includes(id))) {
    fail(
      'UNBOUND_ENTITY_CLASSIFICATION_EVIDENCE',
      'Each classification evidence edge must be in the revision evidence set.',
    );
  }
  if (revisionStatus.state === 'NOT_APPLICABLE'
    && revisionStatus.applicability_evidence_ids.some((id) => !evidenceEdges.includes(id))) {
    fail(
      'UNBOUND_ENTITY_APPLICABILITY_EVIDENCE',
      'Each applicability evidence edge must be in the revision evidence set.',
    );
  }

  const body = {
    entity_subject_id: input.entity_subject.entity_subject_id,
    classification_revisions: classifications,
    display_label: displayLabel,
    evidence_edges: evidenceEdges,
    revision_status: revisionStatus,
  };
  return deepFreeze({
    schema_version: ENTITY_SUBJECT_REVISION_SCHEMA_VERSION,
    entity_subject_revision_id: contentId('ENTITY_SUBJECT_REVISION/V1', body),
    ...body,
  });
}

function validateEntitySubjectRevision({ revision, entity_subject: entitySubject } = {}) {
  requireExactKeys(revision, REVISION_KEYS, 'entity subject revision');
  validateEntitySubject(entitySubject);
  if (revision.entity_subject_id !== entitySubject.entity_subject_id) {
    fail('STALE_ENTITY_SUBJECT_REVISION', 'Entity revision refers to a different subject.');
  }
  const rebuilt = buildEntitySubjectRevision({
    entity_subject: entitySubject,
    classification_revisions: revision.classification_revisions,
    display_label: revision.display_label,
    evidence_edges: revision.evidence_edges,
    revision_status: revision.revision_status,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(revision)) {
    fail('STALE_ENTITY_SUBJECT_REVISION', 'Entity revision identity or content is stale.');
  }
  return true;
}

module.exports = {
  CLASSIFICATION_CODES,
  ENTITY_SUBJECT_REVISION_SCHEMA_VERSION,
  ENTITY_SUBJECT_SCHEMA_VERSION,
  EntitySubjectError,
  IDENTITY_AUTHORITY_TYPES,
  REVISION_STATES,
  SUBJECT_CLASSES,
  buildEntitySubject,
  buildEntitySubjectRevision,
  validateEntitySubject,
  validateEntitySubjectRevision,
};
