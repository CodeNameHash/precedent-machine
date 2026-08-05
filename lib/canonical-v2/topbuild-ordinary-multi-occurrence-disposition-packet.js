'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { validateCohortAssociations } = require('./routine-primary-source-disposition-policy');

const PACKET_SCHEMA = 'M3_TOPBUILD_ORDINARY_MULTI_OCCURRENCE_DISPOSITION_PACKET/V1';
const TOPBUILD_SECOND_OCCURRENCE_ID = 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE';

class TopBuildOrdinaryMultiOccurrenceDispositionPacketError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TopBuildOrdinaryMultiOccurrenceDispositionPacketError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new TopBuildOrdinaryMultiOccurrenceDispositionPacketError(code, message);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    fail('INVALID_PACKET_INPUT', `${label} must be non-empty trimmed text.`);
  }
  return value;
}

function selectTopBuildRecords(records, primaryOccurrenceId) {
  const byOccurrence = new Map(records.map((record) => [record.discovery.occurrence_id, record]));
  const primary = byOccurrence.get(primaryOccurrenceId);
  const corroborating = byOccurrence.get(TOPBUILD_SECOND_OCCURRENCE_ID);
  if (!primary || !corroborating || primary === corroborating
    || primary.discovery.occurrence_kind !== 'METADATA_PRIMARY_SEC_OCCURRENCE'
    || corroborating.discovery.occurrence_kind !== 'DECLARED_ADDITIONAL_SEC_OCCURRENCE'
    || primary.discovery.deal_id !== corroborating.discovery.deal_id
    || corroborating.discovery.primary_occurrence_relationship?.primary_occurrence_id !== primaryOccurrenceId) {
    fail('TOPBUILD_OCCURRENCE_BINDING_INVALID', 'TopBuild primary and declared corroborating occurrences must be preserved in the same cohort and deal.');
  }
  return { primary, corroborating };
}

function validateLegalFindings(findings, { primaryOccurrenceId, corroboratingOccurrenceId }) {
  const required = [
    'same_executed_agreement', 'matched_section_count', 'total_section_count',
    'redaction_delta', 'unredacted_occurrence_id', 'redacted_occurrence_id',
  ];
  if (!exactKeys(findings, required)
    || findings.same_executed_agreement !== true
    || findings.matched_section_count !== 62
    || findings.total_section_count !== 63
    || findings.unredacted_occurrence_id !== primaryOccurrenceId
    || findings.redacted_occurrence_id !== corroboratingOccurrenceId
    || !exactKeys(findings.redaction_delta, [
      'section_reference', 'redacted_item_count', 'redaction_kind',
    ])
    || findings.redaction_delta.section_reference !== '7.7'
    || findings.redaction_delta.redacted_item_count !== 2
    || findings.redaction_delta.redaction_kind !== 'EMAIL_ADDRESS_ONLY') {
    fail('TOPBUILD_LEGAL_FINDING_INVALID', 'TopBuild legal findings must bind the same executed agreement, 62 of 63 section identity, and only two Section 7.7 email redactions.');
  }
  return Object.freeze({
    same_executed_agreement: true,
    matched_section_count: 62,
    total_section_count: 63,
    section_7_7_redaction_delta: Object.freeze({
      redacted_item_count: 2,
      redaction_kind: 'EMAIL_ADDRESS_ONLY',
    }),
  });
}

function recordBinding(record, evidenceRole) {
  return Object.freeze({
    occurrence_id: record.discovery.occurrence_id,
    discovery_id: record.discovery.discovery_id,
    receipt_id: record.receipt.receipt_id,
    source_url: record.discovery.source_metadata.source_url,
    raw_sha256: record.receipt.raw_sha256,
    canonical_text_sha256: record.conversion.canonical_text_sha256,
    evidence_role: evidenceRole,
  });
}

function buildTopBuildOrdinaryMultiOccurrenceDispositionPacket({
  cohort_manifest: cohortManifest,
  receipt_records: receiptRecords,
  primary_occurrence_id: primaryOccurrenceId,
  legal_findings: legalFindings,
} = {}) {
  text(primaryOccurrenceId, 'primary_occurrence_id');
  let records;
  try { records = validateCohortAssociations(cohortManifest, receiptRecords); } catch (error) {
    fail(error?.code || 'INVALID_COHORT_PROOF', error?.message || 'cohort proof is invalid.');
  }
  const { primary, corroborating } = selectTopBuildRecords(records, primaryOccurrenceId);
  const findings = validateLegalFindings(legalFindings, {
    primaryOccurrenceId,
    corroboratingOccurrenceId: corroborating.discovery.occurrence_id,
  });
  const body = {
    schema_version: PACKET_SCHEMA,
    status: 'NOT_ISSUED',
    cohort_capture_manifest_id: cohortManifest.cohort_capture_manifest_id,
    deal_id: primary.discovery.deal_id,
    occurrences: Object.freeze([
      recordBinding(primary, 'PRIMARY_EVIDENCE_UNREDACTED_TOPBUILD'),
      recordBinding(corroborating, 'CORROBORATING_EVIDENCE_REDACTED_QXO'),
    ]),
    legal_findings: findings,
    proposed_treatment: 'ORDINARY_MULTI_OCCURRENCE_INCLUSION',
    non_conclusions: Object.freeze({
      exclusion: 'NOT_CONCLUDED',
      exact_duplicate: 'NOT_CONCLUDED',
      separate_version: 'NOT_CONCLUDED',
    }),
    execution_sources: Object.freeze([]),
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    source_admission_status: 'NOT_ATTEMPTED',
    deal_admission_status: 'NOT_ATTEMPTED',
  };
  return Object.freeze({ ...body, packet_id: contentId(PACKET_SCHEMA, body) });
}

function validateTopBuildOrdinaryMultiOccurrenceDispositionPacket(packet) {
  const keys = [
    'schema_version', 'status', 'cohort_capture_manifest_id', 'deal_id', 'occurrences',
    'legal_findings', 'proposed_treatment', 'non_conclusions', 'execution_sources',
    'admission_authority', 'source_admission_status', 'deal_admission_status', 'packet_id',
  ];
  if (!exactKeys(packet, keys) || packet.schema_version !== PACKET_SCHEMA
    || packet.status !== 'NOT_ISSUED' || packet.proposed_treatment !== 'ORDINARY_MULTI_OCCURRENCE_INCLUSION'
    || packet.admission_authority !== 'NOT_ADMISSION_AUTHORITY'
    || packet.source_admission_status !== 'NOT_ATTEMPTED' || packet.deal_admission_status !== 'NOT_ATTEMPTED'
    || !Array.isArray(packet.execution_sources) || packet.execution_sources.length !== 0
    || !Array.isArray(packet.occurrences) || packet.occurrences.length !== 2
    || !exactKeys(packet.non_conclusions, ['exclusion', 'exact_duplicate', 'separate_version'])
    || Object.values(packet.non_conclusions).some((value) => value !== 'NOT_CONCLUDED')) {
    fail('INVALID_PROPOSAL_PACKET', 'TopBuild disposition packet cannot issue authority, execution sources, exclusion, duplicate, or version conclusions.');
  }
  if (!isDigest(packet.cohort_capture_manifest_id) || typeof packet.deal_id !== 'string' || !packet.deal_id) {
    fail('INVALID_PROPOSAL_PACKET', 'TopBuild disposition packet must bind one exact cohort and deal.');
  }
  const [primary, corroborating] = packet.occurrences;
  const occurrenceKeys = [
    'occurrence_id', 'discovery_id', 'receipt_id', 'source_url', 'raw_sha256',
    'canonical_text_sha256', 'evidence_role',
  ];
  if (!exactKeys(primary, occurrenceKeys) || !exactKeys(corroborating, occurrenceKeys)
    || primary.evidence_role !== 'PRIMARY_EVIDENCE_UNREDACTED_TOPBUILD'
    || corroborating.evidence_role !== 'CORROBORATING_EVIDENCE_REDACTED_QXO'
    || corroborating.occurrence_id !== TOPBUILD_SECOND_OCCURRENCE_ID
    || primary.occurrence_id === corroborating.occurrence_id
    || [primary, corroborating].some((item) => (
      typeof item.occurrence_id !== 'string' || !item.occurrence_id
      || typeof item.source_url !== 'string' || !item.source_url
      || !isDigest(item.discovery_id) || !isDigest(item.receipt_id)
      || !isDigest(item.raw_sha256) || !isDigest(item.canonical_text_sha256)
    ))) {
    fail('INVALID_PROPOSAL_PACKET', 'TopBuild disposition packet must preserve the exact primary and corroborating evidence bindings.');
  }
  const findings = packet.legal_findings;
  if (!exactKeys(findings, [
    'same_executed_agreement', 'matched_section_count', 'total_section_count',
    'section_7_7_redaction_delta',
  ]) || findings.same_executed_agreement !== true
    || findings.matched_section_count !== 62 || findings.total_section_count !== 63
    || !exactKeys(findings.section_7_7_redaction_delta, ['redacted_item_count', 'redaction_kind'])
    || findings.section_7_7_redaction_delta.redacted_item_count !== 2
    || findings.section_7_7_redaction_delta.redaction_kind !== 'EMAIL_ADDRESS_ONLY') {
    fail('INVALID_PROPOSAL_PACKET', 'TopBuild disposition packet legal findings are incomplete or changed.');
  }
  const body = { ...packet };
  delete body.packet_id;
  if (packet.packet_id !== contentId(PACKET_SCHEMA, body)) {
    fail('STALE_PROPOSAL_PACKET_ID', 'TopBuild disposition packet content identity is stale.');
  }
  return Object.freeze({ ...packet });
}

module.exports = {
  PACKET_SCHEMA,
  TOPBUILD_SECOND_OCCURRENCE_ID,
  TopBuildOrdinaryMultiOccurrenceDispositionPacketError,
  buildTopBuildOrdinaryMultiOccurrenceDispositionPacket,
  validateTopBuildOrdinaryMultiOccurrenceDispositionPacket,
};
