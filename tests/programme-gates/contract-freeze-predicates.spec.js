const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { domainDigest, signatureBytes } = require('../../lib/programme-gates/bytes');
const {
  evaluateAcceptanceClaims,
} = require('../../lib/programme-gates/predicates');
const { verifySignature } = require('../../lib/programme-gates/signatures');

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const OBSERVED_AT = '2026-07-28T12:00:00.000Z';
const VERIFICATION_TIME = '2026-07-28T12:01:00.000Z';

function sign(privateKey, domain, role, payload) {
  return crypto.sign(
    null,
    signatureBytes({ domain, role, payload }),
    privateKey,
  ).toString('base64');
}

function keyEntry({ keyId, publicKey, role, domain }) {
  return {
    key_id: keyId,
    algorithm: 'Ed25519',
    public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
    permitted_roles: [role],
    permitted_domains: [domain],
    valid_from: '2026-07-28T00:00:00.000Z',
    valid_until: '2026-07-29T00:00:00.000Z',
    revoked_at: null,
  };
}

function fixture() {
  const ben = crypto.generateKeyPairSync('ed25519');
  const publisher = crypto.generateKeyPairSync('ed25519');
  const validator = crypto.generateKeyPairSync('ed25519');
  const controller = crypto.generateKeyPairSync('ed25519');
  const contractBundleId = 'c'.repeat(64);
  const contractBundleDigest = 'd'.repeat(64);
  const frozenPairDigest = 'e'.repeat(64);
  const approvalId = '2'.repeat(64);
  const generatedOutputs = [{
    path: 'generated/contracts.json',
    payload_digest: contractBundleDigest,
  }];
  const authorityManifest = {
    schema_version: 'ContractFreezeAuthorityManifest/V1',
    authority_manifest_id: '',
    specification_root: ROOT,
    contract_bundle_id: contractBundleId,
    contract_bundle_digest: contractBundleDigest,
    frozen_contract_pair_digest: frozenPairDigest,
    root_manifest_digest: '0'.repeat(64),
    predecessor_attestation_id: 'GENESIS',
    semantic_identity_diff_digest: '1'.repeat(64),
    compiler_version: 'canonical-compiler/1',
    generator_version: 'canonical-generator/1',
    compile_report_digest: 'a'.repeat(64),
    cycle_report_digest: 'b'.repeat(64),
    drift_report_digest: 'c'.repeat(64),
    generated_outputs: generatedOutputs,
    governing_specification_members: [{
      path: 'docs/CODEX-PROGRAM.md',
      byte_length: 1,
      payload_digest: ROOT,
    }],
    g0_review_set_evidence_id: '3'.repeat(64),
    g0_review_set_payload_digest: '4'.repeat(64),
    g0_ben_approval_evidence_id: '5'.repeat(64),
    g0_ben_approval_payload_digest: '6'.repeat(64),
    independent_semantic_question_catalogue_authorship_id: '7'.repeat(64),
    independent_semantic_question_catalogue_input_access_id: '6'.repeat(64),
    independent_semantic_question_catalogue_review_id: '8'.repeat(64),
    independent_composition_catalogue_authorship_id: '9'.repeat(64),
    independent_composition_catalogue_input_access_id: '8'.repeat(64),
    independent_composition_catalogue_review_id: 'a'.repeat(64),
    semantic_question_catalogue_reconciliation_digest: 'b'.repeat(64),
    neutral_projection_digest: 'c'.repeat(64),
    pre_freeze_semantic_stage_output_set_roots: ['d'.repeat(64)],
    pre_freeze_neutral_projection_set_roots: ['e'.repeat(64)],
    relationship_effect_field_universe_set_root: 'f'.repeat(64),
    reviewer_eligibility_set_root: '1'.repeat(64),
    independent_reviewer_bindings: [],
    ben_taxonomy_codebook_decision_set_root: '2'.repeat(64),
  };
  const compilationUnsignedIdentity = {
    schema_version: 'ContractBundleCompilationReceipt/V1',
    contract_bundle_id: contractBundleId,
    contract_bundle_digest: contractBundleDigest,
    frozen_contract_pair_digest: frozenPairDigest,
    compiler_version: authorityManifest.compiler_version,
    generator_version: authorityManifest.generator_version,
    compile_report_digest: authorityManifest.compile_report_digest,
    cycle_report_digest: authorityManifest.cycle_report_digest,
    drift_report_digest: authorityManifest.drift_report_digest,
    generated_outputs: generatedOutputs,
    compile_errors: [],
    cycle_errors: [],
    drift_errors: [],
    terminal_state: 'PASS',
    validator_key_id: 'VALIDATOR_KEY',
    signature_algorithm: 'Ed25519',
  };
  const compilationReceiptId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT_ID/V1',
    compilationUnsignedIdentity,
  );
  const compilationUnsigned = {
    ...compilationUnsignedIdentity,
    receipt_id: compilationReceiptId,
  };
  const compilation = {
    ...compilationUnsigned,
    signature: sign(
      validator.privateKey,
      'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT/V1',
      'VALIDATOR',
      compilationUnsigned,
    ),
  };
  const reviewUnsignedIdentity = {
    schema_version: 'ContractDiffReviewAttestation/V1',
    contract_bundle_id: contractBundleId,
    contract_bundle_digest: contractBundleDigest,
    frozen_contract_pair_digest: frozenPairDigest,
    semantic_identity_diff_digest: authorityManifest.semantic_identity_diff_digest,
    review_scope: 'SEMANTIC_AND_IDENTITY_DIFF',
    review_disposition: 'PASS',
    blocking_finding_count: 0,
    blocking_finding_ids: [],
    reviewer_identity: 'independent-sol-reviewer',
    reviewer_model_identifier: 'gpt-5.6-sol',
    reasoning_level: 'xhigh',
    reviewer_eligibility_digest: authorityManifest.reviewer_eligibility_set_root,
    review_set_root: ROOT,
    controller_key_id: 'CONTROLLER_KEY',
    signature_algorithm: 'Ed25519',
  };
  const reviewId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_ID/V1',
    reviewUnsignedIdentity,
  );
  const reviewUnsigned = {
    ...reviewUnsignedIdentity,
    review_id: reviewId,
  };
  const review = {
    ...reviewUnsigned,
    signature: sign(
      controller.privateKey,
      'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
      'REVIEW_CONTROLLER',
      reviewUnsigned,
    ),
  };
  authorityManifest.independent_reviewer_bindings = [{
    reviewer_identity: review.reviewer_identity,
    eligibility_evidence_digest: review.reviewer_eligibility_digest,
    review_disposition_id: review.review_id,
  }];
  authorityManifest.authority_manifest_id = domainDigest(
    'PROGRAMME_GATE_CONTRACT_FREEZE_AUTHORITY_MANIFEST_ID/V1',
    Object.fromEntries(
      Object.entries(authorityManifest).filter(([key]) => key !== 'authority_manifest_id'),
    ),
  );
  const approvalUnsigned = {
    schema_version: 'ContractFreezeApproval/V1',
    approval_id: approvalId,
    authority_manifest_id: authorityManifest.authority_manifest_id,
    frozen_contract_pair_digest: frozenPairDigest,
    approver_identity: 'BEN_GOODCHILD',
    conditions: [],
    approved_at: '2026-07-28T11:00:00.000Z',
    approver_key_id: 'BEN_KEY',
    signature_algorithm: 'Ed25519',
  };
  const approval = {
    ...approvalUnsigned,
    signature: sign(
      ben.privateKey,
      'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1',
      'BEN_APPROVER',
      approvalUnsigned,
    ),
  };
  const statusUnsigned = {
    schema_version: 'ProgrammeGateStatusArtefact/V2',
    specification_root: ROOT,
    code_commit: COMMIT,
    environment: 'STAGING',
    generation: 1,
    predecessor_status_id: 'NONE',
    gate_registry_digest: '4'.repeat(64),
    ordered_gate_projection: [{
      gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
      state: 'PASS',
      evidence_envelope_id: '5'.repeat(64),
      evidence_payload_digest: '6'.repeat(64),
    }],
    ordered_work_class_projection: [{
      work_class: 'canonical_work_start',
      state: 'PASS',
    }],
    validator_executable_digest: '7'.repeat(64),
    validator_configuration_digest: '8'.repeat(64),
    validator_key_id: 'STATUS_KEY',
    signature_algorithm: 'Ed25519',
  };
  const status = {
    ...statusUnsigned,
    signature: sign(
      publisher.privateKey,
      'PROGRAMME_GATE_STATUS/V2',
      'STATUS_PUBLISHER',
      statusUnsigned,
    ),
  };
  const evidence = {
    schema_version: 'ContractFreezeAttestation/V1',
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    specification_root: ROOT,
    code_commit: COMMIT,
    environment: 'STAGING',
    observed_at: OBSERVED_AT,
    contract_bundle_id: contractBundleId,
    contract_bundle_digest: contractBundleDigest,
    frozen_contract_pair_digest: frozenPairDigest,
    contract_authority_manifest_id: authorityManifest.authority_manifest_id,
    contract_authority_manifest_digest: domainDigest(
      'PROGRAMME_GATE_CONTRACT_FREEZE_AUTHORITY_MANIFEST_PAYLOAD/V1',
      authorityManifest,
    ),
    compilation_receipt_id: compilationReceiptId,
    semantic_identity_review_id: reviewId,
    legal_semantic_review_disposition_id: reviewId,
    identity_review_disposition_id: reviewId,
    freeze_gate_approval_id: approvalId,
    ben_bundle_approval_evidence_id: approvalId,
    status_generation: 1,
    status_payload_digest: domainDigest(
      'PROGRAMME_GATE_STATUS_ARTEFACT_PAYLOAD/V2',
      status,
    ),
  };
  const immutableMembers = [
    {
      member_id: `authority:${authorityManifest.authority_manifest_id}`,
      member_type: 'ContractFreezeAuthorityManifest',
      payload: authorityManifest,
    },
    {
      member_id: `compilation:${compilationReceiptId}`,
      member_type: 'ContractBundleCompilationReceipt',
      payload: compilation,
    },
    {
      member_id: `review:${reviewId}`,
      member_type: 'ContractDiffReviewAttestation',
      payload: review,
    },
    {
      member_id: `approval:${approvalId}`,
      member_type: 'ContractFreezeApproval',
      payload: approval,
    },
    {
      member_id: 'status:1',
      member_type: 'ProgrammeGateStatusArtefact',
      payload: status,
    },
  ];
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [
      keyEntry({
        keyId: 'VALIDATOR_KEY',
        publicKey: validator.publicKey,
        role: 'VALIDATOR',
        domain: 'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT/V1',
      }),
      keyEntry({
        keyId: 'CONTROLLER_KEY',
        publicKey: controller.publicKey,
        role: 'REVIEW_CONTROLLER',
        domain: 'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
      }),
      keyEntry({
        keyId: 'BEN_KEY',
        publicKey: ben.publicKey,
        role: 'BEN_APPROVER',
        domain: 'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1',
      }),
      keyEntry({
        keyId: 'STATUS_KEY',
        publicKey: publisher.publicKey,
        role: 'STATUS_PUBLISHER',
        domain: 'PROGRAMME_GATE_STATUS/V2',
      }),
    ],
  };
  return { evidence, immutableMembers, keyRegistry };
}

function context(sample, overrides = {}) {
  return {
    specificationRoot: ROOT,
    codeCommit: COMMIT,
    environment: 'STAGING',
    expectedSpecificationRoot: ROOT,
    expectedCodeCommit: COMMIT,
    expectedEnvironment: 'STAGING',
    observed_at: OBSERVED_AT,
    clock: { now: () => VERIFICATION_TIME },
    immutableMembers: sample.immutableMembers,
    keyRegistry: sample.keyRegistry,
    verifySignature,
    domainDigest,
    ...overrides,
  };
}

test('contract freeze predicates recompute all authority from immutable members', () => {
  const sample = fixture();
  const claims = evaluateAcceptanceClaims({
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    evidence: sample.evidence,
    context: context(sample),
  });
  assert.deepEqual(claims.map((claim) => claim.typed_value), [true, true, true, true]);
});

test('caller summaries cannot replace members and status signatures', () => {
  const sample = fixture();
  const noMembers = evaluateAcceptanceClaims({
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    evidence: sample.evidence,
    context: context(sample, {
      immutableMembers: [],
      verifiedContractFreeze: {
        bundle_compiles: true,
        semantic_and_identity_diff_reviewed: true,
        freeze_gate_approved: true,
        status_generation_matches: true,
      },
    }),
  });
  assert.deepEqual(noMembers.map((claim) => claim.typed_value), [false, false, false, false]);

  const badStatus = structuredClone(sample);
  badStatus.immutableMembers.find(
    (member) => member.member_type === 'ProgrammeGateStatusArtefact',
  ).payload.signature = Buffer.alloc(64, 1).toString('base64');
  const badSignatureClaims = evaluateAcceptanceClaims({
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    evidence: badStatus.evidence,
    context: context(badStatus),
  });
  assert.equal(badSignatureClaims.at(-1).typed_value, false);
});

test('unsigned compilation and asserted review summaries cannot authorise P1', () => {
  for (const mutate of [
    (sample) => {
      sample.immutableMembers.find(
        (member) => member.member_type === 'ContractBundleCompilationReceipt',
      ).payload.signature = Buffer.alloc(64, 1).toString('base64');
    },
    (sample) => {
      sample.immutableMembers.find(
        (member) => member.member_type === 'ContractBundleCompilationReceipt',
      ).payload.compile_errors = ['ignored compiler error'];
    },
    (sample) => {
      sample.immutableMembers.find(
        (member) => member.member_type === 'ContractDiffReviewAttestation',
      ).payload.signature = Buffer.alloc(64, 1).toString('base64');
    },
    (sample) => {
      sample.immutableMembers.find(
        (member) => member.member_type === 'ContractFreezeAuthorityManifest',
      ).payload.semantic_identity_diff_digest = '9'.repeat(64);
    },
  ]) {
    const sample = structuredClone(fixture());
    mutate(sample);
    const claims = evaluateAcceptanceClaims({
      gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
      evidence: sample.evidence,
      context: context(sample),
    });
    assert.equal(
      claims[0].typed_value && claims[1].typed_value && claims[2].typed_value,
      false,
    );
  }
});
