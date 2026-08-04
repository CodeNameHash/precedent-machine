'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { isSecHttpsUrl, validateCaptureReceipt, validateCohortCaptureManifest } = require('./corpus-source-discovery-capture');
const { validateSecEdgarIntakeCapture } = require('./sec-edgar-intake-capture');
const { verifySecHtmlCanonicalText } = require('./sec-html-canonical-text-verifier');

const POLICY_SCHEMA = 'M3_ROUTINE_PRIMARY_SOURCE_DISPOSITION_POLICY/V2';
const DIGEST_RE = /^[a-f0-9]{64}$/;

class RoutinePrimarySourceDispositionPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoutinePrimarySourceDispositionPolicyError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new RoutinePrimarySourceDispositionPolicyError(code, message);
}

function isDigest(value) {
  return typeof value === 'string' && DIGEST_RE.test(value);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail('INVALID_DISCOVERY_RECORD', `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function validateDiscoveryRecord(discovery) {
  const keys = [
    'occurrence_id', 'deal_id', 'acquirer', 'target', 'occurrence_kind',
    'stored_full_text_sha256', 'primary_occurrence_relationship', 'source_metadata',
    'admission_authority', 'deal_admission_status', 'source_admission_status', 'discovery_id',
  ];
  if (!exactKeys(discovery, keys)
    || !['METADATA_PRIMARY_SEC_OCCURRENCE', 'DECLARED_ADDITIONAL_SEC_OCCURRENCE'].includes(discovery.occurrence_kind)
    || discovery.admission_authority !== 'NOT_ADMISSION_AUTHORITY'
    || discovery.deal_admission_status !== 'NOT_ATTEMPTED'
    || discovery.source_admission_status !== 'NOT_ATTEMPTED'
    || !isDigest(discovery.discovery_id)) {
    fail('INVALID_DISCOVERY_RECORD', 'discovery record does not use the closed non-admission shape.');
  }
  requireText(discovery.occurrence_id, 'discovery.occurrence_id');
  requireText(discovery.deal_id, 'discovery.deal_id');
  if (!exactKeys(discovery.source_metadata, ['source_url', 'accession_number', 'filing_date'])
    || !isSecHttpsUrl(discovery.source_metadata.source_url)) {
    fail('INVALID_DISCOVERY_RECORD', 'discovery record must name one exact SEC HTTPS source URL.');
  }
  const body = { ...discovery };
  delete body.discovery_id;
  if (discovery.discovery_id !== contentId('M3_CORPUS_SOURCE_DISCOVERY_RECORD/V1', body)) {
    fail('DISCOVERY_ID_MISMATCH', 'discovery record identity does not bind its full payload.');
  }
  if (discovery.occurrence_kind === 'METADATA_PRIMARY_SEC_OCCURRENCE') {
    if (!isDigest(discovery.stored_full_text_sha256) || discovery.primary_occurrence_relationship !== null) {
      fail('INVALID_PRIMARY_OCCURRENCE', 'primary occurrence must bind the stored source and have no primary relationship.');
    }
  } else if (discovery.stored_full_text_sha256 !== null
    || !exactKeys(discovery.primary_occurrence_relationship, ['status', 'primary_occurrence_id'])
    || discovery.primary_occurrence_relationship.status !== 'UNCOMPARED'
    || typeof discovery.primary_occurrence_relationship.primary_occurrence_id !== 'string') {
    fail('INVALID_ADDITIONAL_OCCURRENCE', 'additional occurrence must remain un-compared to a named primary occurrence.');
  }
  return discovery;
}

function validateRecord(record) {
  if (!exactKeys(record, ['receipt', 'discovery', 'capture', 'conversion', 'verification'])) {
    fail('INVALID_RECEIPT_RECORD', 'receipt record must contain receipt, discovery, capture, conversion and verification only.');
  }
  try {
    validateCaptureReceipt(record.receipt);
    validateSecEdgarIntakeCapture(record.capture);
  } catch (error) {
    fail('INVALID_RECEIPT_RECORD', `receipt or capture is invalid: ${error.message}`);
  }
  const discovery = validateDiscoveryRecord(record.discovery);
  const { receipt, capture, conversion, verification } = record;
  if (receipt.discovery_id !== discovery.discovery_id
    || receipt.occurrence_id !== discovery.occurrence_id
    || receipt.raw_sha256 !== capture.response_bytes_sha256
    || receipt.capture_id !== capture.intake_capture_receipt_id
    || receipt.conversion_id !== conversion?.canonical_text_id
    || receipt.verification_id !== verification?.verification_manifest_id) {
    fail('RECEIPT_ASSOCIATION_MISMATCH', 'receipt must bind the exact discovery, raw bytes, capture, conversion and verification records.');
  }
  if (capture.retrieval_url_sha256 !== sha256Hex(discovery.source_metadata.source_url)) {
    fail('SOURCE_URL_HASH_MISMATCH', 'capture retrieval URL digest does not bind the discovered SEC URL.');
  }
  if (capture.source_host !== 'www.sec.gov' || capture.http_status !== 200 || capture.redirect_count !== 0
    || capture.response_byte_length <= 0 || capture.response_bytes_sha256 !== receipt.raw_sha256) {
    fail('PRIMARY_SOURCE_PROOF_FAILED', 'source capture must be a direct non-empty SEC 200 response with matching bytes.');
  }
  let verificationResult;
  try {
    verificationResult = verifySecHtmlCanonicalText({ capture, conversion });
  } catch (error) {
    fail('CANONICAL_VERIFICATION_FAILED', `canonical text verification failed: ${error.message}`);
  }
  if (verificationResult.verification_status !== 'PASS'
    || canonicalJson(verification) !== canonicalJson(verificationResult)) {
    fail('CANONICAL_VERIFICATION_FAILED', 'stored canonical verification must exactly reproduce a passing independent verification.');
  }
  return { receipt, discovery, capture, conversion, verification };
}

function validateCohortAssociations(cohortManifest, receiptRecords) {
  try {
    validateCohortCaptureManifest(cohortManifest);
  } catch (error) {
    fail('INVALID_COHORT_MANIFEST', error.message);
  }
  if (!Array.isArray(receiptRecords) || receiptRecords.length === 0) {
    fail('MISSING_RECEIPT', 'every cohort receipt record is required.');
  }
  const associations = new Map();
  for (const association of cohortManifest.receipt_associations) {
    if (associations.has(association.occurrence_id)) {
      fail('DUPLICATE_MANIFEST_OCCURRENCE', 'cohort manifest contains an occurrence more than once.');
    }
    associations.set(association.occurrence_id, association);
  }
  const seenOccurrenceIds = new Set();
  const seenReceiptIds = new Set();
  const validated = receiptRecords.map(validateRecord);
  for (const record of validated) {
    const association = associations.get(record.receipt.occurrence_id);
    if (!association) fail('EXTRA_RECEIPT', `receipt ${record.receipt.occurrence_id} is outside the exact cohort manifest.`);
    if (seenOccurrenceIds.has(record.receipt.occurrence_id) || seenReceiptIds.has(record.receipt.receipt_id)) {
      fail('DUPLICATE_RECEIPT', 'cohort receipt records must preserve each occurrence and receipt exactly once.');
    }
    if (association.receipt_id !== record.receipt.receipt_id
      || association.discovery_id !== record.discovery.discovery_id) {
      fail('RECEIPT_ASSOCIATION_MISMATCH', 'cohort manifest association does not bind this receipt and discovery record.');
    }
    seenOccurrenceIds.add(record.receipt.occurrence_id);
    seenReceiptIds.add(record.receipt.receipt_id);
  }
  if (seenOccurrenceIds.size !== associations.size) {
    fail('MISSING_RECEIPT', 'cohort manifest contains a receipt association with no supplied receipt record.');
  }
  return validated;
}

function buildRoutinePrimaryDispositionProposal({ cohort_manifest: cohortManifest, receipt_records: receiptRecords } = {}) {
  const records = validateCohortAssociations(cohortManifest, receiptRecords);
  const recordsByDeal = new Map();
  const occurrenceIds = new Set();
  const sourceUrls = new Map();
  for (const record of records) {
    const { discovery } = record;
    if (occurrenceIds.has(discovery.occurrence_id)) fail('DUPLICATE_OCCURRENCE', 'cohort preserves the same occurrence more than once.');
    occurrenceIds.add(discovery.occurrence_id);
    const priorOccurrence = sourceUrls.get(discovery.source_metadata.source_url);
    if (priorOccurrence) {
      fail('DUPLICATE_SOURCE_URL', `the same SEC URL appears in ${priorOccurrence} and ${discovery.occurrence_id}.`);
    }
    sourceUrls.set(discovery.source_metadata.source_url, discovery.occurrence_id);
    const forDeal = recordsByDeal.get(discovery.deal_id) || [];
    forDeal.push(record);
    recordsByDeal.set(discovery.deal_id, forDeal);
  }
  const rows = [...recordsByDeal.entries()].map(([dealId, dealRecords]) => {
    const primaries = dealRecords.filter(({ discovery }) => discovery.occurrence_kind === 'METADATA_PRIMARY_SEC_OCCURRENCE');
    if (primaries.length !== 1) {
      fail('MISSING_OR_AMBIGUOUS_PRIMARY', `deal ${dealId} must have exactly one metadata-primary SEC occurrence.`);
    }
    const primary = primaries[0].discovery;
    const additional = dealRecords.filter(({ discovery }) => discovery.occurrence_kind === 'DECLARED_ADDITIONAL_SEC_OCCURRENCE');
    return Object.freeze({
      deal_id: dealId,
      primary_occurrence_id: primary.occurrence_id,
      primary_source_url_sha256: sha256Hex(primary.source_metadata.source_url),
      additional_occurrence_ids: additional.map(({ discovery }) => discovery.occurrence_id).sort(),
      proposed_disposition: additional.length === 0
        ? 'PROPOSED_ROUTINE_PRIMARY_DISPOSITION_REVIEW_REQUIRED'
        : 'PROPOSED_ORDINARY_MULTI_OCCURRENCE_INCLUSION_REVIEW_REQUIRED',
      admission_authority: 'NOT_ADMISSION_AUTHORITY',
      source_admission_status: 'NOT_ATTEMPTED',
      deal_admission_status: 'NOT_ATTEMPTED',
    });
  }).sort((left, right) => left.deal_id.localeCompare(right.deal_id));
  const body = {
    schema_version: POLICY_SCHEMA,
    status: 'PROPOSED_NOT_AUTHORITY',
    cohort_capture_manifest_id: cohortManifest.cohort_capture_manifest_id,
    routine_primary_source_dispositions: rows,
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    source_admission_status: 'NOT_ATTEMPTED',
    deal_admission_status: 'NOT_ATTEMPTED',
  };
  return Object.freeze({ ...body, policy_id: contentId(POLICY_SCHEMA, body) });
}

module.exports = {
  POLICY_SCHEMA,
  RoutinePrimarySourceDispositionPolicyError,
  validateDiscoveryRecord,
  validateReceiptRecord: validateRecord,
  validateCohortAssociations,
  buildRoutinePrimaryDispositionProposal,
};
