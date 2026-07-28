const { domainDigest } = require('./bytes');
const { createAcceptanceContractBundle } = require('./containment-contracts');

const CONTRACT_FREEZE_CONTRACT =
  'exact-contract-freeze-attestation-and-status-generation/v7';

const CONTRACT_FREEZE_MEMBER_SCHEMA_SET = Object.freeze([
  Object.freeze({
    member_type: 'ContractFreezeAuthorityManifest',
    schema_id: 'ContractFreezeAuthorityManifest/V1',
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

function enumerateContractFreezeExpectedMembers({ evidenceObject }) {
  return Object.freeze([
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
      input('ContractFreezeAttestation', '/frozen_contract_pair_digest'),
      input('ContractFreezeAttestation', '/compilation_receipt_id'),
      input('ContractFreezeAuthorityManifest', '/compiler_version'),
      input('ContractFreezeAuthorityManifest', '/generator_version'),
      input('ContractFreezeAuthorityManifest', '/generated_outputs'),
      input('ContractFreezeAuthorityManifest', '/compile_report_digest'),
      input('ContractFreezeAuthorityManifest', '/cycle_report_digest'),
      input('ContractFreezeAuthorityManifest', '/drift_report_digest'),
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
      input('ContractDiffReviewAttestation', '/semantic_identity_diff_digest'),
      input('ContractDiffReviewAttestation', '/review_scope'),
      input('ContractDiffReviewAttestation', '/review_disposition'),
      input('ContractDiffReviewAttestation', '/blocking_finding_count'),
      input('ContractDiffReviewAttestation', '/blocking_finding_ids'),
      input('ContractDiffReviewAttestation', '/reviewer_identity'),
      input('ContractDiffReviewAttestation', '/reviewer_model_identifier'),
      input('ContractDiffReviewAttestation', '/reasoning_level'),
      input('ContractDiffReviewAttestation', '/reviewer_eligibility_digest'),
      input('ContractDiffReviewAttestation', '/review_set_root'),
      input('ContractDiffReviewAttestation', '/signature'),
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
