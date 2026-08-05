'use strict';

const { canonicalJson, contentId, utf8Slice } = require('./canonical-bytes');
const { validateReceiptRecord } = require('./routine-primary-source-disposition-policy');
const { sectionizeAdmittedSource, findSectionByReference } = require('./native-producer/deterministic-sectionizer');
const { getProducerPromptModule } = require('./native-producer/producer-prompt-registry');
const { PROFILES } = require('./native-producer/codex-cli-provider');

const METSERA_DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';
const METSERA_OCCURRENCE_ID = `METADATA/${METSERA_DEAL_ID}`;
const FAMILY_ID = 'ANTITRUST_REGULATORY';
const SECTION_REFERENCE = '6.03';
const REVIEW_PACKET_SCHEMA = 'M3_METSERA_PILOT_EXTENSION_SELECTION_REVIEW_PACKET/V1';
const MANIFEST_SCHEMA = 'M3_METSERA_PILOT_EXTENSION_MANIFEST_PROPOSAL/V1';
const SUPERSEDED_STATUS = 'SUPERSEDED_INCOMPLETE_SCOPE';

class MetseraPilotExtensionProposalError extends Error {
  constructor(code, message) { super(message); this.name = 'MetseraPilotExtensionProposalError'; this.code = code; }
}

function fail(code, message) { throw new MetseraPilotExtensionProposalError(code, message); }
function exactKeys(value, keys) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }

function selectMetseraAntitrustCandidate({ receipt_record: receiptRecord, model_profile_id: modelProfileId = 'TERRA_MEDIUM' } = {}) {
  let record;
  try { record = validateReceiptRecord(receiptRecord); } catch (error) {
    fail(error?.code || 'INVALID_METSERA_RECEIPT', error?.message || 'Metsera receipt record is invalid.');
  }
  if (record.discovery.deal_id !== METSERA_DEAL_ID
    || record.discovery.occurrence_id !== METSERA_OCCURRENCE_ID
    || record.discovery.occurrence_kind !== 'METADATA_PRIMARY_SEC_OCCURRENCE') {
    fail('METSERA_SOURCE_IDENTITY_MISMATCH', 'proposal requires the exact captured Metsera primary SEC occurrence.');
  }
  const profile = PROFILES[modelProfileId];
  const promptBuilder = getProducerPromptModule(FAMILY_ID);
  if (!profile || !promptBuilder) fail('METSERA_EXTENSION_CONFIGURATION_INVALID', 'registered antitrust prompt and model profile are required.');
  const tree = sectionizeAdmittedSource({
    source_text: record.conversion.canonical_text,
    document_hash: record.capture.response_bytes_sha256,
  });
  const section = findSectionByReference(tree, SECTION_REFERENCE);
  if (!section || section.heading !== 'Reasonable Best Efforts; Notification') {
    fail('METSERA_SECTION_IDENTITY_MISMATCH', 'Metsera extension requires the exact Section 6.03 regulatory-efforts section.');
  }
  const sourceText = utf8Slice(record.conversion.canonical_text, section.start, section.end);
  const prompt = promptBuilder({ source_text: sourceText, governed_scope: {
    document_hash: record.capture.response_bytes_sha256,
    section_reference: section.reference,
    section_id: section.section_id,
    source_text: sourceText,
  }, known_definitions: [] });
  return Object.freeze({
    source_occurrence_id: record.discovery.occurrence_id,
    receipt_id: record.receipt.receipt_id,
    raw_sha256: record.receipt.raw_sha256,
    canonical_text_sha256: record.conversion.canonical_text_sha256,
    section_pin: Object.freeze({ section_reference: section.reference, section_id: section.section_id, section_text_sha256: section.text_sha256 }),
    family_id: FAMILY_ID,
    prompt_id: prompt.prompt_id,
    prompt_version: prompt.prompt_version,
    model_profile: Object.freeze({ profile_id: profile.profile_id, model: profile.model, reasoning_effort: profile.reasoning_effort }),
  });
}

function buildMetseraPilotExtensionProposal({ receipt_record: receiptRecord, model_profile_id: modelProfileId } = {}) {
  const candidate = selectMetseraAntitrustCandidate({ receipt_record: receiptRecord, model_profile_id: modelProfileId });
  const reviewBody = {
    schema_version: REVIEW_PACKET_SCHEMA,
    status: 'REVIEW_REQUIRED_NOT_AUTHORITY',
    requested_area: FAMILY_ID,
    smallest_candidate_work_item_set: Object.freeze([candidate]),
    selection_reason: 'USER_REQUESTED_ANTITRUST_REGULATORY_COVERAGE',
    execution_authority: 'NOT_GRANTED',
  };
  const reviewPacket = Object.freeze({ ...reviewBody, review_packet_id: contentId(REVIEW_PACKET_SCHEMA, reviewBody) });
  const manifestBody = {
    schema_version: MANIFEST_SCHEMA,
    status: SUPERSEDED_STATUS,
    separate_from_pilot_work_item_set: 'M3_12_CALL_PILOT',
    source_occurrence_id: candidate.source_occurrence_id,
    source_receipt_id: candidate.receipt_id,
    source_raw_sha256: candidate.raw_sha256,
    source_canonical_text_sha256: candidate.canonical_text_sha256,
    selection_review_packet: reviewPacket,
    proposed_work_items: Object.freeze([]),
    execution_authority: 'NOT_GRANTED',
    source_admission_status: 'NOT_ATTEMPTED',
    superseded_by: 'M3_METSERA_COMPREHENSIVE_SELECTION_REVIEW/V1',
  };
  return Object.freeze({ ...manifestBody, extension_manifest_id: contentId(MANIFEST_SCHEMA, manifestBody) });
}

module.exports = {
  FAMILY_ID,
  MANIFEST_SCHEMA,
  METSERA_DEAL_ID,
  METSERA_OCCURRENCE_ID,
  MetseraPilotExtensionProposalError,
  REVIEW_PACKET_SCHEMA,
  SECTION_REFERENCE,
  SUPERSEDED_STATUS,
  buildMetseraPilotExtensionProposal,
  selectMetseraAntitrustCandidate,
};
