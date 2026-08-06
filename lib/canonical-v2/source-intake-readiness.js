'use strict';

const { contentId } = require('./canonical-bytes');
const { validateCohortAssociations } = require('./routine-primary-source-disposition-policy');
const {
  TRUSTED_CONTROLLER_BLOCKER,
  buildSourceExceptionApprovalReadiness,
} = require('./source-exception-approval-contract');

const READINESS_SCHEMA = 'M3_SOURCE_INTAKE_READINESS_RECEIPT/V2';
const AUTHORITY_READINESS_SCHEMA = 'M3_SOURCE_INTAKE_AUTHORITY_READINESS/V1';
const REQUIRED_DEAL_COUNT = 40;
const TOPBUILD_SECOND_OCCURRENCE_ID = 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE';
const INITIAL_IMPORT_PACKET_SCHEMA = 'GOVERNED_DEAL_IDENTITY_INITIAL_IMPORT_PROPOSAL/V2';
const INITIAL_IMPORT_POLICY_STATUS = 'ADOPTED_IDENTITY_SEED_POLICY_NO_ISSUANCE_OR_ADMISSION_AUTHORITY';
const INITIAL_IMPORT_POLICY_ONLY_BLOCKER = 'ADOPTED_INITIAL_IMPORT_SEED_POLICY_NOT_IDENTITY_AUTHORITY';
const TRUSTED_AUTHORITY_VERIFIER_BLOCKER = 'SOURCE_INTAKE_TRUSTED_CONTROLLER_AND_REGISTRY_VERIFIER_REQUIRED';
const ROUTINE_PRIMARY_POLICY_BLOCKER = 'ROUTINE_PRIMARY_POLICY_NOT_ADOPTED';
const TOPBUILD_DISPOSITION_BLOCKER = 'TOPBUILD_MULTI_OCCURRENCE_DISPOSITION_NOT_ISSUED';
const SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS = Object.freeze([
  TRUSTED_AUTHORITY_VERIFIER_BLOCKER,
  ROUTINE_PRIMARY_POLICY_BLOCKER,
  TOPBUILD_DISPOSITION_BLOCKER,
]);

function cohortState({ cohort_manifest: cohortManifest, receipt_records: receiptRecords }) {
  try {
    const records = validateCohortAssociations(cohortManifest, receiptRecords);
    const occurrenceIds = new Set(records.map(({ discovery }) => discovery.occurrence_id));
    const dealIds = new Set(records.map(({ discovery }) => discovery.deal_id));
    if (occurrenceIds.size !== REQUIRED_DEAL_COUNT + 1 || dealIds.size !== REQUIRED_DEAL_COUNT
      || !occurrenceIds.has(TOPBUILD_SECOND_OCCURRENCE_ID)) {
      return { valid: false, code: 'COHORT_OCCURRENCES_INCOMPLETE_OR_HIDDEN' };
    }
    return { valid: true, dealIds, occurrenceIds };
  } catch (_) {
    return { valid: false, code: 'COHORT_CAPTURE_PROOF_INVALID' };
  }
}

function buildSourceIntakeAuthorityReadiness() {
  const body = {
    schema_version: AUTHORITY_READINESS_SCHEMA,
    status: 'BLOCKED_EXTERNAL_TRUSTED_VERIFIER_NOT_IMPLEMENTED',
    authority: 'NONE',
    trusted_controller_verifier: 'UNAVAILABLE_IN_PHASE1',
    trusted_registry_verifier: 'UNAVAILABLE_IN_PHASE1',
    routine_primary_policy_adoption_authority: 'NONE',
    topbuild_disposition_issuance_authority: 'NONE',
    blocker_codes: SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
  };
  return Object.freeze({ ...body, authority_readiness_id: contentId(AUTHORITY_READINESS_SCHEMA, body) });
}

function callerAuthorityDiagnostics({ routinePrimaryPolicy, topBuildDispositionPacket, ordinaryReviewedDispositions }) {
  return Object.freeze({
    status: 'CALLER_INPUT_DIAGNOSTIC_ONLY',
    authority: 'NONE',
    routine_primary_policy_input: routinePrimaryPolicy === undefined ? 'NOT_SUPPLIED' : 'UNTRUSTED_CALLER_INPUT',
    topbuild_disposition_packet_input: topBuildDispositionPacket === undefined ? 'NOT_SUPPLIED' : 'UNTRUSTED_CALLER_INPUT',
    ordinary_reviewed_dispositions_input: ordinaryReviewedDispositions === undefined ? 'NOT_SUPPLIED' : 'UNTRUSTED_CALLER_INPUT',
  });
}

function buildSourceIntakeReadiness({
  cohort_manifest: cohortManifest,
  receipt_records: receiptRecords,
  governed_deal_identity_authority: governedDealIdentityAuthority,
  routine_primary_policy: routinePrimaryPolicy,
  topbuild_disposition_packet: topBuildDispositionPacket,
  ordinary_reviewed_dispositions: ordinaryReviewedDispositions,
  source_exception_approval_proposal: sourceExceptionApprovalProposal = null,
} = {}) {
  const blockers = [];
  const cohort = cohortState({ cohort_manifest: cohortManifest, receipt_records: receiptRecords });
  const sourceIntakeAuthority = buildSourceIntakeAuthorityReadiness();
  const callerAuthorityDiagnostic = callerAuthorityDiagnostics({
    routinePrimaryPolicy,
    topBuildDispositionPacket,
    ordinaryReviewedDispositions,
  });
  if (governedDealIdentityAuthority && typeof governedDealIdentityAuthority === 'object'
    && governedDealIdentityAuthority.schema_version === INITIAL_IMPORT_PACKET_SCHEMA
    && governedDealIdentityAuthority.status === INITIAL_IMPORT_POLICY_STATUS) {
    blockers.push(INITIAL_IMPORT_POLICY_ONLY_BLOCKER);
  }
  if (governedDealIdentityAuthority && typeof governedDealIdentityAuthority === 'object'
    && (governedDealIdentityAuthority.schema_version === 'GOVERNED_DEAL_IDENTITY_MANIFEST/V1'
      || Object.hasOwn(governedDealIdentityAuthority, 'authority')
      || Object.hasOwn(governedDealIdentityAuthority, 'value')
      || Object.hasOwn(governedDealIdentityAuthority, 'deal_identity_authority_attestation_id'))) {
    blockers.push('OBSOLETE_V1_DEAL_IDENTITY_AUTHORITY_REJECTED');
  }
  blockers.push('UNISSUED_DEAL_IDENTITIES');
  blockers.push(...SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS);
  const sourceExceptionApproval = buildSourceExceptionApprovalReadiness({ proposal: sourceExceptionApprovalProposal });
  if (sourceExceptionApproval.proposal_id !== null) blockers.push(TRUSTED_CONTROLLER_BLOCKER);
  if (!cohort.valid) blockers.push(cohort.code);
  const frozenBlockers = Object.freeze([...blockers]);
  const body = {
    schema_version: READINESS_SCHEMA,
    status: frozenBlockers.length === 0 ? 'READY' : 'BLOCKED',
    blockers: frozenBlockers,
    execution_sources: Object.freeze([]),
    admission_authority: 'NOT_ADMISSION_AUTHORITY',
    source_admission_status: 'NOT_ATTEMPTED',
    deal_admission_status: 'NOT_ATTEMPTED',
    source_intake_authority: sourceIntakeAuthority,
    caller_authority_diagnostic: callerAuthorityDiagnostic,
    source_exception_approval: sourceExceptionApproval,
  };
  return Object.freeze({ ...body, readiness_receipt_id: contentId(READINESS_SCHEMA, body) });
}

module.exports = {
  READINESS_SCHEMA,
  AUTHORITY_READINESS_SCHEMA,
  INITIAL_IMPORT_PACKET_SCHEMA,
  INITIAL_IMPORT_POLICY_ONLY_BLOCKER,
  INITIAL_IMPORT_POLICY_STATUS,
  REQUIRED_DEAL_COUNT,
  ROUTINE_PRIMARY_POLICY_BLOCKER,
  SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
  TOPBUILD_SECOND_OCCURRENCE_ID,
  TOPBUILD_DISPOSITION_BLOCKER,
  TRUSTED_AUTHORITY_VERIFIER_BLOCKER,
  buildSourceIntakeAuthorityReadiness,
  buildSourceIntakeReadiness,
};
