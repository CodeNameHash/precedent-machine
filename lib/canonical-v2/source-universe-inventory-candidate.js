'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  validateReceiptRecord: validateRoutineReceiptRecord,
  validateCohortAssociations,
} = require('./routine-primary-source-disposition-policy');
const { INVENTORY_SCHEMA } = require('./source-universe-inventory-planner');
const {
  validateV2DealIdentityAuthorityEvidence,
} = require('./governed-identity-proposal-packet');
const { requireIssuedIdentityConsumerEvidence } = require('./deal-identity-allocation-readiness');

const CANDIDATE_SCHEMA = 'M3_SOURCE_UNIVERSE_INVENTORY_CANDIDATE/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;

class SourceUniverseInventoryCandidateError extends Error {
  constructor(code, message) { super(message); this.name = 'SourceUniverseInventoryCandidateError'; this.code = code; }
}

function fail(code, message) { throw new SourceUniverseInventoryCandidateError(code, message); }
function isDigest(value) { return typeof value === 'string' && DIGEST_RE.test(value); }
function exactKeys(value, keys) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }

function validateReceiptRecord(record) {
  try { return validateRoutineReceiptRecord(record); } catch (error) {
    fail(error?.code || 'INVALID_RECEIPT_RECORD', error?.message || 'receipt record failed independent validation.');
  }
}

function validateV2DealIdentityEvidenceSet(identityEvidence, receiptDealIds) {
  if (!Array.isArray(identityEvidence) || identityEvidence.length === 0) {
    fail('BLOCKING_UNRESOLVED_GOVERNED_DEAL_IDENTITY', 'each captured production deal requires validated V2 identity evidence.');
  }
  const byProductionId = new Map();
  for (const record of identityEvidence) {
    if (!exactKeys(record, [
      'production_deal_id', 'deal_identity_manifest', 'approval_signing_request',
      'approval_signature_evidence', 'issued_allocation_receipt', 'issued_reviewed_bridge',
    ]) || typeof record.production_deal_id !== 'string' || !receiptDealIds.has(record.production_deal_id)
      || byProductionId.has(record.production_deal_id)) {
      fail('INVALID_V2_GOVERNED_DEAL_IDENTITY_EVIDENCE', 'V2 identity evidence must cover one captured production deal per closed record.');
    }
    let validated;
    try {
      validated = validateV2DealIdentityAuthorityEvidence({
        deal_identity_manifest: record.deal_identity_manifest,
        approval_signing_request: record.approval_signing_request,
        approval_signature_evidence: record.approval_signature_evidence,
      });
      requireIssuedIdentityConsumerEvidence({
        allocation_receipt: record.issued_allocation_receipt,
        reviewed_bridge: record.issued_reviewed_bridge,
        production_deal_id: record.production_deal_id,
        governed_deal_key: validated.governed_deal_key,
        manifest_id: validated.deal_identity_manifest_id,
      });
    } catch (error) {
      fail(error?.code || 'INVALID_V2_GOVERNED_DEAL_IDENTITY_EVIDENCE', error?.message || 'V2 identity evidence failed independent validation.');
    }
    byProductionId.set(record.production_deal_id, Object.freeze({
      production_deal_id: record.production_deal_id,
      governed_deal_key: validated.governed_deal_key,
      deal_identity_manifest_id: validated.deal_identity_manifest_id,
      identity_authority_kind: validated.authority_kind,
      identity_authority_status: validated.authority_status,
    }));
  }
  if (byProductionId.size !== receiptDealIds.size) {
    fail('BLOCKING_UNRESOLVED_GOVERNED_DEAL_IDENTITY', 'every captured production deal requires one validated V2 identity manifest and attestation or issuer proof.');
  }
  return byProductionId;
}

function buildSourceUniverseInventoryCandidate({
  cohort_manifest: cohortManifest,
  receipt_records: receiptRecords,
  governed_deal_identity_evidence: governedDealIdentityEvidence,
} = {}) {
  let records;
  try { records = validateCohortAssociations(cohortManifest, receiptRecords); } catch (error) {
    fail(error?.code || 'INVALID_COHORT_MANIFEST', error?.message || 'cohort receipt proof is invalid.');
  }
  const receiptDealIds = new Set(records.map(({ discovery }) => discovery.deal_id));
  const identityByProductionId = validateV2DealIdentityEvidenceSet(governedDealIdentityEvidence, receiptDealIds);
  const occurrences = records.map(({ receipt, discovery }) => {
    const identity = identityByProductionId.get(discovery.deal_id);
    if (!identity) fail('BLOCKING_UNRESOLVED_GOVERNED_DEAL_IDENTITY', `no V2 identity evidence exists for ${discovery.deal_id}.`);
    const additional = discovery.occurrence_kind === 'DECLARED_ADDITIONAL_SEC_OCCURRENCE';
    if (additional && (discovery.stored_full_text_sha256 !== null || discovery.primary_occurrence_relationship?.status !== 'UNCOMPARED')) {
      fail('INVALID_ADDITIONAL_OCCURRENCE', 'additional occurrence must remain explicitly un-compared to the metadata primary source.');
    }
    return Object.freeze({
      occurrence_id: discovery.occurrence_id,
      governed_deal_key: identity.governed_deal_key,
      deal_identity_manifest_id: identity.deal_identity_manifest_id,
      source_locator: discovery.source_metadata.source_url,
      raw_sha256: receipt.raw_sha256,
      capture_receipt_id: receipt.receipt_id,
      occurrence_state: additional ? 'UNRESOLVED_BLOCKING_REVIEW_REQUIRED' : 'CAPTURED_UNREVIEWED',
      blocker_code: additional ? 'MULTIPLE_SEC_OCCURRENCES_REQUIRE_REVIEWED_DISPOSITION' : null,
      primary_occurrence_relationship: discovery.primary_occurrence_relationship,
      source_admission_status: 'NOT_ATTEMPTED',
      deal_admission_status: 'NOT_ATTEMPTED',
    });
  }).sort((left, right) => left.occurrence_id.localeCompare(right.occurrence_id));
  const roster = [...identityByProductionId.values()]
    .sort((left, right) => left.governed_deal_key.localeCompare(right.governed_deal_key))
    .map(({ governed_deal_key, deal_identity_manifest_id, identity_authority_kind, identity_authority_status }) => Object.freeze({
      governed_deal_key, deal_identity_manifest_id, identity_authority_kind, identity_authority_status,
    }));
  const body = {
    schema_version: CANDIDATE_SCHEMA,
    candidate_for_inventory_schema: INVENTORY_SCHEMA,
    cohort_capture_manifest_id: cohortManifest.cohort_capture_manifest_id,
    governed_deal_roster: roster,
    received_source_occurrences: occurrences,
    source_admission_status: 'NOT_ATTEMPTED',
    deal_admission_status: 'NOT_ATTEMPTED',
    execution_status: 'BLOCKED_PENDING_REVIEWED_SOURCE_DISPOSITIONS',
    execution_blockers: [
      'ROUTINE_PRIMARY_SOURCE_DISPOSITION_AUTHORITY_REQUIRED',
      'TOPBUILD_MULTI_OCCURRENCE_SOURCE_DISPOSITION_REQUIRED',
    ],
  };
  return Object.freeze({ ...body, source_universe_inventory_candidate_id: contentId(CANDIDATE_SCHEMA, body) });
}

module.exports = {
  CANDIDATE_SCHEMA,
  SourceUniverseInventoryCandidateError,
  validateReceiptRecord,
  validateV2DealIdentityEvidenceSet,
  buildSourceUniverseInventoryCandidate,
};
