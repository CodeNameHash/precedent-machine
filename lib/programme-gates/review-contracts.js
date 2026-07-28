const { domainDigest } = require('./bytes');
const { createAcceptanceContractBundle } = require('./containment-contracts');
const {
  BEN_APPROVAL_CONTRACT,
  REVIEW_SET_CONTRACT,
  enumerateReviewExpectedMembers,
  memberSchemaSetForReview,
} = require('./review-enumerator');

const REVIEW_ENUMERATOR_EXECUTABLE_DIGEST = domainDigest(
  'PROGRAMME_GATE_REVIEW_ENUMERATOR_EXECUTABLE/V1',
  { source: enumerateReviewExpectedMembers.toString() },
);

function input(memberType, jsonPointer) {
  return Object.freeze({
    member_type: memberType,
    json_pointer: jsonPointer,
  });
}

const REVIEW_CONTRACT_CONFIGURATIONS = Object.freeze([
  Object.freeze({
    gate_id: 'G0_EXACT_DIGEST_REVIEW_SET',
    evidence_contract: REVIEW_SET_CONTRACT,
    evidence_schema_id: 'ExactDigestReviewSetAttestation/V1',
    evidence_subject_type: 'ExactDigestReviewSetSubject',
    evidence_subject_identity_fields: Object.freeze([
      'gate_id',
      'reviewed_root',
      'review_set_evidence_id',
    ]),
    universe_id: 'G0_EXACT_DIGEST_REVIEW_SET_MEMBERS',
    member_schema_set: memberSchemaSetForReview(REVIEW_SET_CONTRACT),
    member_enumerator_executable_digest: REVIEW_ENUMERATOR_EXECUTABLE_DIGEST,
    claim_paths: Object.freeze({}),
    claim_inputs: Object.freeze({
      five_named_lanes_pass_same_root: Object.freeze([
        input('ExactDigestReviewSetAttestation', '/reviewed_root'),
        input('TrustedReviewControllerRecord', '/registered_prompt_id'),
        input('TrustedReviewControllerRecord', '/exact_specification_root'),
        input('TrustedReviewControllerRecord', '/reviewer_disposition'),
      ]),
      eligible_legal_reviewer: Object.freeze([
        input('TrustedReviewControllerRecord', '/registered_prompt_id'),
        input('TrustedReviewControllerRecord', '/exact_model_identifier'),
        input('TrustedReviewControllerRecord', '/reasoning_level'),
      ]),
      reviewer_independence_recomputed: Object.freeze([
        input('ReviewerIndependenceAttestation', '/reviewer_principal_id'),
        input('ReviewerIndependenceAttestation', '/immutable_session_id'),
        input('ReviewerIndependenceAttestation', '/authoring_event_intersection_root'),
        input('ReviewerIndependenceAttestation', '/prior_conclusion_intersection_root'),
        input('ReviewerIndependenceAttestation', '/reviewer_edit_set_root'),
        input('ReviewerIndependenceAttestation', '/signature'),
      ]),
      root_unchanged_before_and_after: Object.freeze([
        input('ExactDigestReviewSetAttestation', '/reviewed_root'),
        input('TrustedReviewControllerRecord', '/exact_specification_root'),
        input('TrustedReviewControllerRecord', '/input_context_digest_before_review'),
        input('TrustedReviewControllerRecord', '/input_context_digest_after_review'),
      ]),
    }),
  }),
  Object.freeze({
    gate_id: 'G0_BEN_SPEC_APPROVAL',
    evidence_contract: BEN_APPROVAL_CONTRACT,
    evidence_schema_id: 'BenSpecificationApprovalEvidence/V1',
    evidence_subject_type: 'BenSpecificationApprovalSubject',
    evidence_subject_identity_fields: Object.freeze([
      'gate_id',
      'approved_root',
      'approval_evidence_id',
    ]),
    universe_id: 'G0_BEN_SPEC_APPROVAL_MEMBERS',
    member_schema_set: memberSchemaSetForReview(BEN_APPROVAL_CONTRACT),
    member_enumerator_executable_digest: REVIEW_ENUMERATOR_EXECUTABLE_DIGEST,
    claim_paths: Object.freeze({}),
    claim_inputs: Object.freeze({
      approved_root_equals_passing_review_root: Object.freeze([
        input('BenSpecificationApprovalEvidence', '/approved_root'),
        input('BenSpecificationApprovalEvidence', '/passing_review_set_evidence_id'),
        input('BenSpecificationApproval', '/approved_root'),
        input('BenSpecificationApproval', '/passing_review_set_evidence_id'),
        input('ExactDigestReviewSetAttestation', '/review_set_evidence_id'),
        input('ExactDigestReviewSetAttestation', '/reviewed_root'),
      ]),
      ben_identity_and_signature_valid: Object.freeze([
        input('BenSpecificationApproval', '/approver_identity'),
        input('BenSpecificationApproval', '/approver_key_id'),
        input('BenSpecificationApproval', '/signature'),
      ]),
      approval_unconditional: Object.freeze([
        input('BenSpecificationApprovalEvidence', '/conditions'),
        input('BenSpecificationApproval', '/conditions'),
      ]),
    }),
  }),
]);

function createReviewContractBundle({ specificationRoot }) {
  return createAcceptanceContractBundle({
    configurations: REVIEW_CONTRACT_CONFIGURATIONS,
    specificationRoot,
  });
}

module.exports = {
  REVIEW_CONTRACT_CONFIGURATIONS,
  REVIEW_ENUMERATOR_EXECUTABLE_DIGEST,
  createReviewContractBundle,
};
