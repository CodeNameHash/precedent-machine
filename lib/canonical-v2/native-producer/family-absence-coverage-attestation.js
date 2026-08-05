'use strict';

const { canonicalJson, contentId, sha256Hex, utf8Slice } = require('../canonical-bytes');

const ATTESTATION_SCHEMA = 'NATIVE_SOURCE_FAMILY_ABSENCE_COVERAGE_ATTESTATION/V1';
const TRUSTED_ABSENCE_EVIDENCE_SCHEMA = 'NATIVE_TRUSTED_FAMILY_ABSENCE_EVIDENCE/V1';

class FamilyAbsenceCoverageAttestationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FamilyAbsenceCoverageAttestationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new FamilyAbsenceCoverageAttestationError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    fail('INVALID_ABSENCE_COVERAGE_ATTESTATION', `${label} must be a non-empty trimmed string.`);
  }
}

function expectedAtomicIntervals(admitted) {
  const sourceText = admitted.context.canonical_text.text;
  const boundaries = new Set([0, Buffer.byteLength(sourceText, 'utf8')]);
  for (const node of admitted.tree.nodes) {
    boundaries.add(node.start);
    boundaries.add(node.end);
  }
  const sorted = [...boundaries].sort((left, right) => left - right);
  return Object.freeze(sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    const value = utf8Slice(sourceText, start, end);
    return Object.freeze({ start, end, text_sha256: sha256Hex(value) });
  }).filter((interval) => interval.end > interval.start));
}

function expectedSectionIds(admitted) {
  return Object.freeze(admitted.tree.nodes
    .filter((node) => typeof node.reference === 'string' && node.reference.length > 0)
    .map((node) => node.section_id)
    .sort());
}

function requireTrustedAbsenceEvidence(value, attestationDigest) {
  if (!exactKeys(value, [
    'schema_version', 'status', 'controller_receipt_id', 'attestation_digest',
    'trusted_absence_evidence_id',
  ]) || value.schema_version !== TRUSTED_ABSENCE_EVIDENCE_SCHEMA
    || value.status !== 'ISSUED' || value.attestation_digest !== attestationDigest) {
    fail('TRUSTED_FAMILY_ABSENCE_EVIDENCE_REQUIRED', 'A controller-issued family-absence evidence record is required before NOT_PRESENT.');
  }
  text(value.controller_receipt_id, 'trusted absence evidence.controller_receipt_id');
  const body = { ...value };
  delete body.trusted_absence_evidence_id;
  if (value.trusted_absence_evidence_id !== contentId(TRUSTED_ABSENCE_EVIDENCE_SCHEMA, body)) {
    fail('TRUSTED_FAMILY_ABSENCE_EVIDENCE_REQUIRED', 'Trusted family-absence evidence identity is invalid.');
  }
  fail('TRUSTED_FAMILY_ABSENCE_EVIDENCE_VERIFIER_UNAVAILABLE', 'Caller-supplied review and approval strings cannot issue family-absence authority.');
}

function validateFamilyAbsenceCoverageAttestation({ attestation, admitted, source_id: sourceId, family_id: familyId, draft_profile: draftProfile } = {}) {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)
    || !admitted || !draftProfile) {
    fail('FAMILY_ABSENCE_NOT_PROVED', 'a complete source-family coverage attestation is required before NOT_PRESENT.');
  }
  const keys = [
    'schema_version', 'source_id', 'family_id', 'admitted_semantic_source_context_id',
    'document_hash', 'canonical_text_sha256', 'section_tree_digest', 'draft_profile_digest',
    'routed_section_ids', 'reviewed_atomic_intervals', 'no_family_occurrence', 'review_id',
    'approval_id', 'trusted_absence_evidence', 'attestation_digest',
  ];
  if (!exactKeys(attestation, keys) || attestation.schema_version !== ATTESTATION_SCHEMA
    || attestation.source_id !== sourceId || attestation.family_id !== familyId
    || attestation.admitted_semantic_source_context_id !== admitted.context.admitted_semantic_source_context_id
    || attestation.document_hash !== admitted.context.document_hash
    || attestation.canonical_text_sha256 !== admitted.context.canonical_text_sha256
    || attestation.section_tree_digest !== contentId('DETERMINISTIC_SECTION_TREE/V1', admitted.tree)
    || attestation.draft_profile_digest !== draftProfile.profile_digest
    || attestation.no_family_occurrence !== true) {
    fail('FAMILY_ABSENCE_NOT_PROVED', 'coverage attestation does not bind this exact source, tree and draft detection profile.');
  }
  text(attestation.review_id, 'coverage attestation.review_id');
  text(attestation.approval_id, 'coverage attestation.approval_id');
  const sections = expectedSectionIds(admitted);
  if (!Array.isArray(attestation.routed_section_ids)
    || canonicalJson(attestation.routed_section_ids) !== canonicalJson(sections)) {
    fail('FAMILY_ABSENCE_NOT_PROVED', 'coverage attestation must route every deterministic section.');
  }
  const intervals = expectedAtomicIntervals(admitted);
  if (!Array.isArray(attestation.reviewed_atomic_intervals)
    || canonicalJson(attestation.reviewed_atomic_intervals) !== canonicalJson(intervals)) {
    fail('FAMILY_ABSENCE_NOT_PROVED', 'coverage attestation must review every atomic source interval.');
  }
  const body = { ...attestation };
  delete body.attestation_digest;
  if (attestation.attestation_digest !== contentId(ATTESTATION_SCHEMA, body)) {
    fail('FAMILY_ABSENCE_NOT_PROVED', 'coverage attestation content identity is invalid.');
  }
  requireTrustedAbsenceEvidence(attestation.trusted_absence_evidence, attestation.attestation_digest);
  return Object.freeze({ ...attestation });
}

module.exports = {
  ATTESTATION_SCHEMA,
  TRUSTED_ABSENCE_EVIDENCE_SCHEMA,
  FamilyAbsenceCoverageAttestationError,
  expectedAtomicIntervals,
  expectedSectionIds,
  validateFamilyAbsenceCoverageAttestation,
};
