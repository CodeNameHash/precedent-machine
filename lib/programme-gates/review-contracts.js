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

const REVIEW_SET_FACT_INPUTS = Object.freeze([
  input('ExactDigestReviewSetAttestation', '/review_set_evidence_id'),
  input('ExactDigestReviewSetAttestation', '/reviewed_root'),
  input('ExactDigestReviewSetAttestation', '/reviewed_code_commit'),
  input('ExactDigestReviewSetAttestation', '/review_artifact_sha256'),
  input('ExactDigestReviewSetAttestation', '/review_artifact_byte_size'),
  input('ExactDigestReviewSetAttestation', '/lane_outcomes'),
  input('ExactDigestReviewSetAttestation', '/full_review_disposition'),
  input('ExactDigestReviewSetAttestation', '/full_review_pass_claimed'),
  input('ColdReviewOutput', '/disposition'),
  input('ColdReviewOutput', '/findings'),
  input('TrustedReviewControllerRecord', '/controller_id'),
  input('TrustedReviewControllerRecord', '/controller_version'),
  input('TrustedReviewControllerRecord', '/review_runtime_version'),
  input('TrustedReviewControllerRecord', '/review_runtime_binary_digest'),
  input('TrustedReviewControllerRecord', '/fixed_controller_runtime_context_digest'),
  input('TrustedReviewControllerRecord', '/controller_supplied_input_manifest'),
  input('TrustedReviewControllerRecord', '/fixed_controller_runtime_context'),
  input('TrustedReviewControllerRecord', '/controller_supplied_input_manifest_digest'),
  input('TrustedReviewControllerRecord', '/exact_input_context_digest'),
  input('TrustedReviewControllerRecord', '/immutable_task_id'),
  input('TrustedReviewControllerRecord', '/immutable_session_id'),
  input('TrustedReviewControllerRecord', '/immutable_review_id'),
  input('TrustedReviewControllerRecord', '/registered_prompt_id'),
  input('TrustedReviewControllerRecord', '/cold_review_prompt_digest'),
  input('TrustedReviewControllerRecord', '/nonce'),
  input('TrustedReviewControllerRecord', '/review_start_time'),
  input('TrustedReviewControllerRecord', '/review_end_time'),
  input('TrustedReviewControllerRecord', '/reviewer_source_control_identity_set'),
  input('TrustedReviewControllerRecord', '/reviewer_principal_id'),
  input('TrustedReviewControllerRecord', '/reviewer_disposition'),
  input('TrustedReviewControllerRecord', '/exact_specification_root'),
  input('TrustedReviewControllerRecord', '/input_context_digest_before_review'),
  input('TrustedReviewControllerRecord', '/input_context_digest_after_review'),
  input('TrustedReviewControllerRecord', '/reviewer_edit_set_root'),
  input('TrustedReviewControllerRecord', '/parent_session_state'),
  input('TrustedReviewControllerRecord', '/no_earlier_review_conclusions_were_inputs'),
  input('TrustedReviewControllerRecord', '/controller_key_id'),
  input('TrustedReviewControllerRecord', '/controller_signature'),
  input('ReviewerIndependenceAttestation', '/reviewer_principal_id'),
  input('ReviewerIndependenceAttestation', '/immutable_session_id'),
  input('ReviewerIndependenceAttestation', '/session_parent_or_genesis'),
  input('ReviewerIndependenceAttestation', '/exact_input_context_digest'),
  input('ReviewerIndependenceAttestation', '/source_control_history_scope'),
  input('ReviewerIndependenceAttestation', '/reviewed_code_commit'),
  input('ReviewerIndependenceAttestation', '/source_control_authorship_events'),
  input('ReviewerIndependenceAttestation', '/source_control_authorship_event_set_root'),
  input('ReviewerIndependenceAttestation', '/prior_conclusion_input_set'),
  input('ReviewerIndependenceAttestation', '/authoring_event_intersection_root'),
  input('ReviewerIndependenceAttestation', '/prior_conclusion_intersection_root'),
  input('ReviewerIndependenceAttestation', '/reviewer_edit_set_root'),
  input('ReviewerIndependenceAttestation', '/validator_key_id'),
  input('ReviewerIndependenceAttestation', '/signature'),
]);

const REVIEW_CONTRACT_CONFIGURATIONS = Object.freeze([
  Object.freeze({
    gate_id: 'G0_EXACT_DIGEST_REVIEW_SET',
    evidence_contract: REVIEW_SET_CONTRACT,
    evidence_schema_id: 'ExactDigestReviewSetAttestation/V2',
    evidence_subject_type: 'ExactDigestReviewSetSubject',
    evidence_subject_identity_fields: Object.freeze([
      'gate_id',
      'reviewed_root',
      'reviewed_code_commit',
      'review_set_evidence_id',
    ]),
    universe_id: 'G0_EXACT_DIGEST_REVIEW_SET_MEMBERS',
    member_schema_set: memberSchemaSetForReview(REVIEW_SET_CONTRACT),
    member_enumerator_executable_digest: REVIEW_ENUMERATOR_EXECUTABLE_DIGEST,
    claim_paths: Object.freeze({}),
    claim_inputs: Object.freeze({
      five_named_lane_outcomes_recorded_same_root: Object.freeze([
        ...REVIEW_SET_FACT_INPUTS,
      ]),
      review_outputs_match_signed_controller_digests: Object.freeze([
        ...REVIEW_SET_FACT_INPUTS,
      ]),
      eligible_legal_reviewer: Object.freeze([
        ...REVIEW_SET_FACT_INPUTS,
        input('TrustedReviewControllerRecord', '/exact_model_identifier'),
        input('TrustedReviewControllerRecord', '/reasoning_level'),
      ]),
      reviewer_independence_recomputed: Object.freeze([
        ...REVIEW_SET_FACT_INPUTS,
      ]),
      full_review_pass_not_claimed: Object.freeze([
        ...REVIEW_SET_FACT_INPUTS,
      ]),
    }),
  }),
  Object.freeze({
    gate_id: 'G0_BEN_SPEC_APPROVAL',
    evidence_contract: BEN_APPROVAL_CONTRACT,
    evidence_schema_id: 'BenSpecificationApprovalEvidence/V2',
    evidence_subject_type: 'BenSpecificationApprovalSubject',
    evidence_subject_identity_fields: Object.freeze([
      'gate_id',
      'approved_root',
      'approved_code_commit',
      'approval_evidence_id',
    ]),
    universe_id: 'G0_BEN_SPEC_APPROVAL_MEMBERS',
    member_schema_set: memberSchemaSetForReview(BEN_APPROVAL_CONTRACT),
    member_enumerator_executable_digest: REVIEW_ENUMERATOR_EXECUTABLE_DIGEST,
    claim_paths: Object.freeze({}),
    claim_inputs: Object.freeze({
      approved_root_and_commit_exact: Object.freeze([
        input('BenSpecificationApprovalEvidence', '/approved_root'),
        input('BenSpecificationApprovalEvidence', '/approved_code_commit'),
        input('BenSpecificationApproval', '/approved_root'),
        input('BenSpecificationApproval', '/approved_code_commit'),
      ]),
      review_outcome_set_acknowledged: Object.freeze([
        input('BenSpecificationApprovalEvidence', '/review_set_evidence_id'),
        input('BenSpecificationApprovalEvidence', '/reviewed_root'),
        input('BenSpecificationApprovalEvidence', '/reviewed_code_commit'),
        input('BenSpecificationApprovalEvidence', '/review_artifact_sha256'),
        input('BenSpecificationApprovalEvidence', '/review_artifact_byte_size'),
        input('BenSpecificationApproval', '/review_set_evidence_id'),
        input('BenSpecificationApproval', '/reviewed_root'),
        input('BenSpecificationApproval', '/reviewed_code_commit'),
        input('BenSpecificationApproval', '/review_artifact_sha256'),
        input('BenSpecificationApproval', '/review_artifact_byte_size'),
        input('ExactDigestReviewSetAttestation', '/review_set_evidence_id'),
        input('ExactDigestReviewSetAttestation', '/reviewed_root'),
        input('ExactDigestReviewSetAttestation', '/reviewed_code_commit'),
        input('ExactDigestReviewSetAttestation', '/review_artifact_sha256'),
        input('ExactDigestReviewSetAttestation', '/review_artifact_byte_size'),
        input('ExactDigestReviewSetAttestation', '/lane_outcomes'),
      ]),
      ben_identity_and_signature_valid: Object.freeze([
        input('BenSpecificationApproval', '/approver_identity'),
        input('BenSpecificationApproval', '/approver_key_id'),
        input('BenSpecificationApproval', '/signature'),
        input('BenSpecificationApproval', '/github_actor_login'),
        input('BenSpecificationApproval', '/github_actor_id'),
        input('BenSpecificationApproval', '/github_run_id'),
        input('BenSpecificationApproval', '/approval_intent'),
      ]),
      authorisation_scope_bounded: Object.freeze([
        input('BenSpecificationApprovalEvidence', '/authorisation_scope'),
        input('BenSpecificationApprovalEvidence', '/permitted_actions'),
        input('BenSpecificationApprovalEvidence', '/prohibited_actions'),
        input('BenSpecificationApprovalEvidence', '/review_findings_disposition'),
        input('BenSpecificationApprovalEvidence', '/p1_p9_gate_state'),
        input('BenSpecificationApprovalEvidence', '/governance_diff_digest'),
        input('BenSpecificationApproval', '/authorisation_scope'),
        input('BenSpecificationApproval', '/permitted_actions'),
        input('BenSpecificationApproval', '/prohibited_actions'),
        input('BenSpecificationApproval', '/review_findings_disposition'),
        input('BenSpecificationApproval', '/p1_p9_gate_state'),
        input('BenSpecificationApproval', '/governance_diff'),
        input('BenSpecificationApprovalEvidence', '/conditions'),
        input('BenSpecificationApproval', '/conditions'),
      ]),
      full_review_pass_not_claimed: Object.freeze([
        input('BenSpecificationApprovalEvidence', '/full_review_pass_claimed'),
        input('BenSpecificationApproval', '/full_review_pass_claimed'),
        input('ExactDigestReviewSetAttestation', '/full_review_pass_claimed'),
        input('ExactDigestReviewSetAttestation', '/full_review_disposition'),
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
