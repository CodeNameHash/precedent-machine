const { domainDigest } = require('./bytes');
const { createAcceptanceContractBundle } = require('./containment-contracts');

const CONTRACT_FREEZE_CONTRACT =
  'exact-contract-freeze-attestation-and-status-generation/v10';

const CONTRACT_FREEZE_MEMBER_SCHEMA_SET = Object.freeze([
  Object.freeze({
    member_type: 'ContractFreezeAuthorityManifest',
    schema_id: 'ContractFreezeAuthorityManifest/V1',
  }),
  Object.freeze({
    member_type: 'ContractFreezeAttestationIdentity',
    schema_id: 'ContractFreezeAttestationIdentity/V1',
  }),
  Object.freeze({
    member_type: 'CanonicalContractBundleMember',
    schema_id: 'CanonicalContractBundleMember/V1',
  }),
  Object.freeze({
    member_type: 'ContractFreezeGoverningSpecificationMember',
    schema_id: 'ContractFreezeGoverningSpecificationMember/V1',
  }),
  Object.freeze({
    member_type: 'ContractFreezeAuthorityEvidence',
    schema_id: 'ContractFreezeAuthorityEvidence/V1',
  }),
  Object.freeze({
    member_type: 'ExactDigestReviewSetAttestation',
    schema_id: 'ExactDigestReviewSetAttestation/V1',
  }),
  Object.freeze({
    member_type: 'BenSpecificationApprovalEvidence',
    schema_id: 'BenSpecificationApprovalEvidence/V1',
  }),
  Object.freeze({
    member_type: 'ProgrammeGateEvidenceEnvelope',
    schema_id: 'ProgrammeGateEvidenceEnvelope/V2',
  }),
  Object.freeze({
    member_type: 'TrustedReviewControllerRecord',
    schema_id: 'TrustedReviewControllerRecord/V1',
  }),
  Object.freeze({
    member_type: 'ReviewerIndependenceAttestation',
    schema_id: 'ReviewerIndependenceAttestation/V1',
  }),
  Object.freeze({
    member_type: 'BenSpecificationApproval',
    schema_id: 'BenSpecificationApproval/V1',
  }),
  Object.freeze({
    member_type: 'ContractBundleCompilationReceipt',
    schema_id: 'ContractBundleCompilationReceipt/V1',
  }),
  Object.freeze({
    member_type: 'ContractDiffReviewAttestation',
    schema_id: 'ContractDiffReviewAttestation/V1',
  }),
  Object.freeze({
    member_type: 'ContractFreezeApproval',
    schema_id: 'ContractFreezeApproval/V1',
  }),
  Object.freeze({
    member_type: 'ProgrammeGateStatusArtefact',
    schema_id: 'ProgrammeGateStatusArtefact/V2',
  }),
]);

function input(memberType, jsonPointer) {
  return Object.freeze({
    member_type: memberType,
    json_pointer: jsonPointer,
  });
}

const CONTRACT_FREEZE_ATTESTATION_IDENTITY_INPUTS = Object.freeze([
  '/schema_version',
  '/contract_freeze_attestation_id',
  '/specification_root',
  '/code_commit',
  '/environment',
  '/predecessor_contract_bundle_id',
  '/predecessor_contract_bundle_digest',
  '/predecessor_canonical_contract_bundle_member_root',
  '/predecessor_canonical_contract_bundle_member_count',
  '/contract_bundle_id',
  '/contract_bundle_digest',
  '/approval_epoch_nonce',
].map((jsonPointer) => input(
  'ContractFreezeAttestationIdentity',
  jsonPointer,
)));

const PREDECESSOR_CONTRACT_DIFF_REVIEW_INPUTS = Object.freeze([
  '/predecessor_contract_bundle_id',
  '/predecessor_contract_bundle_digest',
  '/predecessor_contract_members',
  '/predecessor_canonical_contract_bundle_members',
].map((jsonPointer) => input(
  'ContractDiffReviewAttestation',
  jsonPointer,
)));

function enumerateContractFreezeExpectedMembers({ evidenceObject }) {
  if (!Array.isArray(evidenceObject.authority_member_inventory)
    || evidenceObject.authority_member_inventory.length === 0) {
    throw new Error('contract freeze authority-member inventory is required');
  }
  return Object.freeze([
    Object.freeze({
      member_id: `freeze-identity:${evidenceObject.contract_freeze_attestation_id}`,
      member_type: 'ContractFreezeAttestationIdentity',
    }),
    Object.freeze({
      member_id: `authority:${evidenceObject.contract_authority_manifest_id}`,
      member_type: 'ContractFreezeAuthorityManifest',
    }),
    Object.freeze({
      member_id: `compilation:${evidenceObject.compilation_receipt_id}`,
      member_type: 'ContractBundleCompilationReceipt',
    }),
    Object.freeze({
      member_id: `review:${evidenceObject.semantic_identity_review_id}`,
      member_type: 'ContractDiffReviewAttestation',
    }),
    Object.freeze({
      member_id: `approval:${evidenceObject.freeze_gate_approval_id}`,
      member_type: 'ContractFreezeApproval',
    }),
    Object.freeze({
      member_id: `status:${evidenceObject.status_generation}`,
      member_type: 'ProgrammeGateStatusArtefact',
    }),
    ...evidenceObject.authority_member_inventory.map((entry) => Object.freeze({
      member_id: entry.member_id,
      member_type: entry.member_type,
    })),
  ]);
}

const CONTRACT_FREEZE_ENUMERATOR_EXECUTABLE_DIGEST = domainDigest(
  'PROGRAMME_GATE_CONTRACT_FREEZE_ENUMERATOR_EXECUTABLE/V1',
  { source: enumerateContractFreezeExpectedMembers.toString() },
);

const CONTRACT_FREEZE_CONTRACT_CONFIGURATION = Object.freeze({
  gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
  evidence_contract: CONTRACT_FREEZE_CONTRACT,
  evidence_schema_id: 'ContractFreezeAttestation/V1',
  evidence_subject_type: 'ContractFreezeAttestationSubject',
  evidence_subject_identity_fields: Object.freeze([
    'gate_id',
    'specification_root',
    'contract_bundle_id',
    'contract_bundle_digest',
    'contract_freeze_attestation_id',
    'frozen_contract_pair_digest',
    'contract_authority_manifest_id',
    'contract_authority_manifest_digest',
  ]),
  universe_id: 'P1_CONTRACT_FREEZE_ATTESTED_MEMBERS',
  member_schema_set: CONTRACT_FREEZE_MEMBER_SCHEMA_SET,
  member_enumerator_executable_digest: CONTRACT_FREEZE_ENUMERATOR_EXECUTABLE_DIGEST,
  claim_paths: Object.freeze({}),
  claim_inputs: Object.freeze({
    bundle_compiles: Object.freeze([
      input('ContractFreezeAttestation', '/contract_authority_manifest_id'),
      input('ContractFreezeAttestation', '/contract_authority_manifest_digest'),
      input('ContractFreezeAttestation', '/contract_bundle_id'),
      input('ContractFreezeAttestation', '/contract_bundle_digest'),
      input('ContractFreezeAttestation', '/contract_freeze_attestation_id'),
      input('ContractFreezeAttestation', '/frozen_contract_pair_digest'),
      input('ContractFreezeAttestation', '/compilation_receipt_id'),
      input('ContractFreezeAttestation', '/authority_member_inventory'),
      input('ContractFreezeAuthorityManifest', '/compiler_version'),
      input('ContractFreezeAuthorityManifest', '/generator_version'),
      input('ContractFreezeAuthorityManifest', '/generated_outputs'),
      input('ContractFreezeAuthorityManifest', '/compile_report_digest'),
      input('ContractFreezeAuthorityManifest', '/cycle_report_digest'),
      input('ContractFreezeAuthorityManifest', '/drift_report_digest'),
      input('ContractFreezeGoverningSpecificationMember', '/source_bytes_base64'),
      ...CONTRACT_FREEZE_ATTESTATION_IDENTITY_INPUTS,
      ...PREDECESSOR_CONTRACT_DIFF_REVIEW_INPUTS,
      input('CanonicalContractBundleMember', '/source_bytes_base64'),
      input('ExactDigestReviewSetAttestation', '/review_set_evidence_id'),
      input('ExactDigestReviewSetAttestation', '/reviewed_root'),
      input('BenSpecificationApprovalEvidence', '/approval_evidence_id'),
      input('BenSpecificationApprovalEvidence', '/approved_root'),
      input('BenSpecificationApprovalEvidence', '/passing_review_set_evidence_id'),
      input('ProgrammeGateEvidenceEnvelope', '/gate_id'),
      input('ProgrammeGateEvidenceEnvelope', '/evidence_contract'),
      input('ProgrammeGateEvidenceEnvelope', '/required_evidence_object_payload_digest'),
      input('ProgrammeGateEvidenceEnvelope', '/exact_acceptance_claims'),
      input('ProgrammeGateEvidenceEnvelope', '/immutable_member_root'),
      input('ProgrammeGateEvidenceEnvelope', '/terminal_state'),
      input('ProgrammeGateEvidenceEnvelope', '/signature'),
      input('TrustedReviewControllerRecord', '/fixed_controller_runtime_context'),
      input('TrustedReviewControllerRecord', '/exact_input_context_digest'),
      input('TrustedReviewControllerRecord', '/reviewer_disposition'),
      input('TrustedReviewControllerRecord', '/controller_signature'),
      input('ReviewerIndependenceAttestation', '/source_control_authorship_events'),
      input('ReviewerIndependenceAttestation', '/signature'),
      input('BenSpecificationApproval', '/approved_root'),
      input('BenSpecificationApproval', '/passing_review_set_evidence_id'),
      input('BenSpecificationApproval', '/conditions'),
      input('BenSpecificationApproval', '/signature'),
      input('ContractFreezeAuthorityEvidence', '/authority_payload'),
      input('ContractFreezeAuthorityEvidence', '/actor_identity'),
      input('ContractFreezeAuthorityEvidence', '/disposition'),
      input('ContractFreezeAuthorityEvidence', '/related_authority_ids'),
      input('ContractFreezeAuthorityEvidence', '/signature'),
      input('ContractBundleCompilationReceipt', '/compiler_version'),
      input('ContractBundleCompilationReceipt', '/generator_version'),
      input('ContractBundleCompilationReceipt', '/generated_outputs'),
      input('ContractBundleCompilationReceipt', '/compile_report_digest'),
      input('ContractBundleCompilationReceipt', '/cycle_report_digest'),
      input('ContractBundleCompilationReceipt', '/drift_report_digest'),
      input('ContractBundleCompilationReceipt', '/compile_errors'),
      input('ContractBundleCompilationReceipt', '/cycle_errors'),
      input('ContractBundleCompilationReceipt', '/drift_errors'),
      input('ContractBundleCompilationReceipt', '/terminal_state'),
      input('ContractBundleCompilationReceipt', '/signature'),
    ]),
    semantic_and_identity_diff_reviewed: Object.freeze([
      input('ContractFreezeAttestation', '/contract_authority_manifest_id'),
      input('ContractFreezeAttestation', '/semantic_identity_review_id'),
      input('ContractFreezeAuthorityManifest', '/semantic_identity_diff_digest'),
      input('ContractFreezeAttestation', '/legal_semantic_review_disposition_id'),
      input('ContractFreezeAttestation', '/identity_review_disposition_id'),
      input('ContractFreezeAuthorityManifest', '/reviewer_eligibility_set_root'),
      input('ContractFreezeAuthorityManifest', '/independent_reviewer_bindings'),
      input('ContractFreezeAuthorityEvidence', '/authority_kind'),
      input('ContractFreezeAuthorityEvidence', '/authority_subject_id'),
      input('ContractFreezeAuthorityEvidence', '/authority_payload'),
      input('ContractFreezeAuthorityEvidence', '/authority_payload_digest'),
      input('ContractFreezeAuthorityEvidence', '/actor_identity'),
      input('ContractFreezeAuthorityEvidence', '/disposition'),
      input('ContractFreezeAuthorityEvidence', '/related_authority_ids'),
      input('ContractFreezeAuthorityEvidence', '/signature'),
      ...CONTRACT_FREEZE_ATTESTATION_IDENTITY_INPUTS,
      ...PREDECESSOR_CONTRACT_DIFF_REVIEW_INPUTS,
      input('ContractDiffReviewAttestation', '/contract_bundle_members'),
      input('ContractDiffReviewAttestation', '/canonical_contract_bundle_members'),
      input('ContractDiffReviewAttestation', '/exact_review_input_schema_version'),
      input('ContractDiffReviewAttestation', '/reviewed_contract_source_set_digest'),
      input('ContractDiffReviewAttestation', '/semantic_identity_diff'),
      input('ContractDiffReviewAttestation', '/semantic_identity_diff_digest'),
      input('ContractDiffReviewAttestation', '/review_scope'),
      input('ContractDiffReviewAttestation', '/review_disposition'),
      input('ContractDiffReviewAttestation', '/blocking_finding_count'),
      input('ContractDiffReviewAttestation', '/blocking_finding_ids'),
      input('ContractDiffReviewAttestation', '/reviewer_identity'),
      input('ContractDiffReviewAttestation', '/reviewer_model_identifier'),
      input('ContractDiffReviewAttestation', '/reasoning_level'),
      input('ContractDiffReviewAttestation', '/reviewer_principal_id'),
      input('ContractDiffReviewAttestation', '/immutable_session_id'),
      input('ContractDiffReviewAttestation', '/reviewer_source_control_identity_set'),
      input('ContractDiffReviewAttestation', '/reviewer_eligibility_digest'),
      input('ContractDiffReviewAttestation', '/review_set_root'),
      input('ContractDiffReviewAttestation', '/exact_input_context_digest'),
      input('ContractDiffReviewAttestation', '/independence_attestation_id'),
      input('ContractDiffReviewAttestation', '/independence_attestation_payload_digest'),
      input('ContractDiffReviewAttestation', '/signature'),
      input('ReviewerIndependenceAttestation', '/reviewer_principal_id'),
      input('ReviewerIndependenceAttestation', '/immutable_session_id'),
      input('ReviewerIndependenceAttestation', '/exact_input_context_digest'),
      input('ReviewerIndependenceAttestation', '/source_control_authorship_events'),
      input('ReviewerIndependenceAttestation', '/source_control_authorship_event_set_root'),
      input('ReviewerIndependenceAttestation', '/authoring_event_intersection_root'),
      input('ReviewerIndependenceAttestation', '/prior_conclusion_intersection_root'),
      input('ReviewerIndependenceAttestation', '/reviewer_edit_set_root'),
      input('ReviewerIndependenceAttestation', '/signature'),
    ]),
    freeze_gate_approved: Object.freeze([
      input('ContractFreezeAttestation', '/contract_authority_manifest_id'),
      input('ContractFreezeAttestation', '/freeze_gate_approval_id'),
      input('ContractFreezeAttestation', '/ben_bundle_approval_evidence_id'),
      input('ContractFreezeApproval', '/authority_manifest_id'),
      input('ContractFreezeApproval', '/approver_identity'),
      input('ContractFreezeApproval', '/conditions'),
      input('ContractFreezeApproval', '/signature'),
    ]),
    status_generation_matches: Object.freeze([
      input('ContractFreezeAttestation', '/status_generation'),
      input('ContractFreezeAttestation', '/status_payload_digest'),
      input('ProgrammeGateStatusArtefact', '/generation'),
      input('ProgrammeGateStatusArtefact', '/ordered_gate_projection'),
      input('ProgrammeGateEvidenceEnvelope', '/gate_id'),
      input('ProgrammeGateEvidenceEnvelope', '/signature'),
    ]),
  }),
});

function createContractFreezeContractBundle({ specificationRoot }) {
  return createAcceptanceContractBundle({
    configurations: [CONTRACT_FREEZE_CONTRACT_CONFIGURATION],
    specificationRoot,
  });
}

module.exports = {
  CONTRACT_FREEZE_CONTRACT,
  CONTRACT_FREEZE_CONTRACT_CONFIGURATION,
  CONTRACT_FREEZE_ENUMERATOR_EXECUTABLE_DIGEST,
  CONTRACT_FREEZE_MEMBER_SCHEMA_SET,
  createContractFreezeContractBundle,
  enumerateContractFreezeExpectedMembers,
};
