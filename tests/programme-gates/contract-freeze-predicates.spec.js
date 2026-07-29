const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');

const { domainDigest, signatureBytes } = require('../../lib/programme-gates/bytes');
const {
  CONTRACT_FREEZE_MEMBER_SCHEMA_SET,
} = require('../../lib/programme-gates/contract-freeze-contracts');
const {
  enumerateCompleteGitAuthorshipUniverse,
} = require('../../lib/programme-gates/git-authorship');
const {
  contractDiffReviewIsMechanicallyBound,
  contractReviewIndependenceIsValid,
  evaluateAcceptanceClaims,
} = require('../../lib/programme-gates/predicates');
const { verifySignature } = require('../../lib/programme-gates/signatures');
const {
  REVIEW_CONTROLLER_POLICY,
  REVIEW_LANES,
} = require('../../lib/programme-gates/registry');
const {
  specificationRootFromMembers,
} = require('../../lib/programme-gates/review-controller');

const SPECIFICATION_MEMBERS = Object.freeze([
  'docs/codex-program/specification-manifest.json',
  'docs/CODEX-PROGRAM.md',
  'docs/codex-program/programme-gates.yaml',
  'docs/codex-program/bootstrap-acceptance-source.json',
  'docs/codex-program/canonical-contracts.md',
  'docs/codex-program/adversarial-tests.md',
].map((memberPath, index) => {
  const bytes = Buffer.from(String(index + 1));
  return Object.freeze({
    order: index + 1,
    path: memberPath,
    byte_length: bytes.length,
    payload_digest: crypto.createHash('sha256').update(bytes).digest('hex'),
    source_bytes_base64: bytes.toString('base64'),
  });
}));
const ROOT = specificationRootFromMembers(SPECIFICATION_MEMBERS);
const OUTPUT_SCHEMA_BYTES = Buffer.from('{}');
const OUTPUT_SCHEMA_DIGEST =
  crypto.createHash('sha256').update(OUTPUT_SCHEMA_BYTES).digest('hex');
const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const COMMIT = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: REPOSITORY_ROOT,
  encoding: 'utf8',
}).trim();
const AUTHORSHIP_EVENTS = enumerateCompleteGitAuthorshipUniverse({
  repositoryRoot: REPOSITORY_ROOT,
  expectedCommit: COMMIT,
});
const OBSERVED_AT = '2026-07-28T12:00:00.000Z';
const VERIFICATION_TIME = '2026-07-28T12:01:00.000Z';

test('P1 member schema bindings are unique and validator-satisfiable', () => {
  const memberTypes = CONTRACT_FREEZE_MEMBER_SCHEMA_SET.map((entry) => entry.member_type);
  assert.equal(new Set(memberTypes).size, memberTypes.length);
  assert.equal(
    memberTypes.filter((memberType) => memberType === 'ReviewerIndependenceAttestation').length,
    1,
  );
});

function sign(privateKey, domain, role, payload) {
  return crypto.sign(
    null,
    signatureBytes({ domain, role, payload }),
    privateKey,
  ).toString('base64');
}

function keyEntry({ keyId, publicKey, roles, domains }) {
  return {
    key_id: keyId,
    algorithm: 'Ed25519',
    public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
    permitted_roles: roles,
    permitted_domains: domains,
    valid_from: '2026-07-28T00:00:00.000Z',
    valid_until: '2026-07-29T00:00:00.000Z',
    revoked_at: null,
  };
}

function unsigned(record, signatureField = 'signature') {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== signatureField),
  );
}

function compareMembers(left, right) {
  return Buffer.compare(
    Buffer.from(`${left.member_type}\0${left.member_id}`, 'utf8'),
    Buffer.from(`${right.member_type}\0${right.member_id}`, 'utf8'),
  );
}

function g0Envelope({
  gateId,
  evidenceContract,
  subjectType,
  objectType,
  evidenceObject,
  claims,
  members,
  validatorPrivateKey,
}) {
  const envelopeUnsigned = {
    schema_version: 'ProgrammeGateEvidenceEnvelope/V2',
    gate_id: gateId,
    evidence_contract: evidenceContract,
    acceptance_definition_id: domainDigest(
      'TEST_ACCEPTANCE_DEFINITION_ID/V1',
      { gate_id: gateId },
    ),
    acceptance_definition_digest: domainDigest(
      'TEST_ACCEPTANCE_DEFINITION_PAYLOAD/V1',
      { gate_id: gateId, evidence_contract: evidenceContract },
    ),
    specification_root: ROOT,
    code_commit: COMMIT,
    environment: 'STAGING',
    evidence_subject_type: subjectType,
    evidence_subject_id: domainDigest(
      'TEST_EVIDENCE_SUBJECT_ID/V1',
      { gate_id: gateId },
    ),
    evidence_subject_payload_digest: domainDigest(
      'TEST_EVIDENCE_SUBJECT_PAYLOAD/V1',
      { gate_id: gateId },
    ),
    required_evidence_object_type: objectType,
    required_evidence_object_payload_digest: domainDigest(
      'PROGRAMME_GATE_EVIDENCE_OBJECT_PAYLOAD/V1',
      evidenceObject,
    ),
    exact_acceptance_claims: claims.map((claimKey) => ({
      claim_key: claimKey,
      result_type: 'BOOLEAN',
      typed_value: true,
    })),
    immutable_member_root: domainDigest(
      'PROGRAMME_GATE_IMMUTABLE_MEMBER_ROOT/V1',
      [...members].sort(compareMembers),
    ),
    test_result_root: '7'.repeat(64),
    validator_executable_digest: '8'.repeat(64),
    validator_configuration_digest: '9'.repeat(64),
    validator_key_id: 'VALIDATOR_KEY',
    terminal_state: 'PASS',
    signature_algorithm: 'Ed25519',
  };
  return {
    ...envelopeUnsigned,
    signature: sign(
      validatorPrivateKey,
      'PROGRAMME_GATE_EVIDENCE/V2',
      'VALIDATOR',
      envelopeUnsigned,
    ),
  };
}

function fixture({ includePrivateKeys = false } = {}) {
  const ben = crypto.generateKeyPairSync('ed25519');
  const publisher = crypto.generateKeyPairSync('ed25519');
  const validator = crypto.generateKeyPairSync('ed25519');
  const controller = crypto.generateKeyPairSync('ed25519');
  const predecessorContractMembers = [
    {
      member_key: 'CLAIM_ALPHA',
      semantic_digest: '1'.repeat(64),
      identity_digest: '2'.repeat(64),
    },
    {
      member_key: 'CLAIM_BETA',
      semantic_digest: '3'.repeat(64),
      identity_digest: '4'.repeat(64),
    },
  ];
  const contractBundleMembers = [
    {
      member_key: 'CLAIM_ALPHA',
      semantic_digest: '5'.repeat(64),
      identity_digest: '2'.repeat(64),
    },
    {
      member_key: 'CLAIM_GAMMA',
      semantic_digest: '6'.repeat(64),
      identity_digest: '7'.repeat(64),
    },
  ];
  const predecessorContractBundleDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    predecessorContractMembers,
  );
  const contractBundleDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    contractBundleMembers,
  );
  const predecessorContractBundleId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: predecessorContractBundleDigest },
  );
  const contractBundleId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: contractBundleDigest },
  );
  const frozenPairDigest = domainDigest(
    'PROGRAMME_GATE_FROZEN_CONTRACT_PAIR/V1',
    {
      predecessor_contract_bundle_id: predecessorContractBundleId,
      predecessor_contract_bundle_digest: predecessorContractBundleDigest,
      successor_contract_bundle_id: contractBundleId,
      successor_contract_bundle_digest: contractBundleDigest,
    },
  );
  const semanticIdentityDiff = {
    predecessor_contract_bundle_id: predecessorContractBundleId,
    successor_contract_bundle_id: contractBundleId,
    added_member_keys: ['CLAIM_GAMMA'],
    removed_member_keys: ['CLAIM_BETA'],
    semantic_changed_member_keys: ['CLAIM_ALPHA'],
    identity_changed_member_keys: [],
  };
  const semanticIdentityDiffDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
    semanticIdentityDiff,
  );
  const exactReviewInputContextDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      specification_root: ROOT,
      code_commit: COMMIT,
      predecessor_contract_bundle_id: predecessorContractBundleId,
      predecessor_contract_bundle_digest: predecessorContractBundleDigest,
      contract_bundle_id: contractBundleId,
      contract_bundle_digest: contractBundleDigest,
      frozen_contract_pair_digest: frozenPairDigest,
      semantic_identity_diff_digest: semanticIdentityDiffDigest,
    },
  );
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
    root_manifest_digest: '',
    predecessor_attestation_id: 'GENESIS',
    semantic_identity_diff_digest: semanticIdentityDiffDigest,
    compiler_version: 'canonical-compiler/1',
    generator_version: 'canonical-generator/1',
    compile_report_digest: 'a'.repeat(64),
    cycle_report_digest: 'b'.repeat(64),
    drift_report_digest: 'c'.repeat(64),
    generated_outputs: generatedOutputs,
    governing_specification_members: [{
      path: 'docs/codex-program/specification-manifest.json',
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
  const governingSource = Buffer.from('a');
  authorityManifest.governing_specification_members[0].payload_digest =
    crypto.createHash('sha256').update(governingSource).digest('hex');
  authorityManifest.root_manifest_digest =
    authorityManifest.governing_specification_members[0].payload_digest;
  const governingUnsigned = {
    schema_version: 'ContractFreezeGoverningSpecificationMember/V1',
    path: authorityManifest.governing_specification_members[0].path,
    byte_length: governingSource.length,
    payload_digest: authorityManifest.governing_specification_members[0].payload_digest,
    source_bytes_base64: governingSource.toString('base64'),
  };
  const governingMember = {
    ...governingUnsigned,
    specification_member_id: domainDigest(
      'PROGRAMME_GATE_GOVERNING_SPECIFICATION_MEMBER_ID/V1',
      governingUnsigned,
    ),
  };
  const g0Review = {
    review_set_evidence_id: authorityManifest.g0_review_set_evidence_id,
    reviewed_root: ROOT,
  };
  authorityManifest.g0_review_set_payload_digest = domainDigest(
    'PROGRAMME_GATE_G0_REVIEW_SET_PAYLOAD/V1',
    g0Review,
  );
  const g0Approval = {
    approval_evidence_id: authorityManifest.g0_ben_approval_evidence_id,
    approved_root: ROOT,
    passing_review_set_evidence_id: g0Review.review_set_evidence_id,
    conditions: [],
  };
  const emptyReviewRoot = domainDigest('PROGRAMME_GATE_REVIEWER_EDIT_SET_ROOT/V1', []);
  const emptyAuthorRoot = domainDigest(
    'PROGRAMME_GATE_AUTHORING_EVENT_INTERSECTION_ROOT/V1',
    [],
  );
  const emptyPriorRoot = domainDigest(
    'PROGRAMME_GATE_PRIOR_CONCLUSION_INTERSECTION_ROOT/V1',
    [],
  );
  const g0ReviewMembers = REVIEW_LANES.flatMap((lane, index) => {
    const laneRoot =
      `/tmp/g0-cold-review-contract/${lane.lane_id.toLowerCase()}-lane`;
    const manifest = {
      manifest_version: 'TrustedReviewTaskManifest/V1',
      lane_id: lane.lane_id,
      exact_specification_root: ROOT,
      frozen_specification: {
        manifest_id: REVIEW_CONTROLLER_POLICY.frozen_specification_manifest_id,
        manifest_digest: SPECIFICATION_MEMBERS[0].payload_digest,
        file_count: SPECIFICATION_MEMBERS.length,
        ordered_members: SPECIFICATION_MEMBERS,
        immutable: true,
      },
      registered_prompt: {
        prompt_id: lane.registered_prompt_id,
        path: `${laneRoot}/prompt.txt`,
        payload_digest: REVIEW_CONTROLLER_POLICY.prompt_digests[lane.lane_id],
        byte_length: 1,
        immutable: true,
        contains_prior_review_conclusions: false,
      },
      output_schema: {
        schema_id: REVIEW_CONTROLLER_POLICY.output_schema_id,
        path: `${laneRoot}/output-schema.json`,
        payload_digest: OUTPUT_SCHEMA_DIGEST,
        byte_length: OUTPUT_SCHEMA_BYTES.length,
        source_bytes_base64: OUTPUT_SCHEMA_BYTES.toString('base64'),
        immutable: true,
      },
    };
    const runtime = {
      context_version: 'TrustedReviewRuntimeContext/V1',
      review_runtime_binary_path: REVIEW_CONTROLLER_POLICY.review_runtime_binary_path,
      review_runtime_version: REVIEW_CONTROLLER_POLICY.review_runtime_version,
      review_runtime_binary_digest: REVIEW_CONTROLLER_POLICY.review_runtime_binary_digest,
      controller_run_root: '/tmp/g0-cold-review-contract',
      lane_run_root: laneRoot,
      working_directory: `${laneRoot}/specification`,
      operating_system: REVIEW_CONTROLLER_POLICY.operating_system,
      architecture: REVIEW_CONTROLLER_POLICY.architecture,
      home_path: `${laneRoot}/home`,
      codex_home_path: `${laneRoot}/codex-home`,
      tmpdir_path: `${laneRoot}/tmp`,
      path_value: REVIEW_CONTROLLER_POLICY.path_value,
      lang: REVIEW_CONTROLLER_POLICY.locale,
      lc_all: REVIEW_CONTROLLER_POLICY.locale,
      term: REVIEW_CONTROLLER_POLICY.terminal,
    };
    const manifestDigest = domainDigest(
      'PROGRAMME_GATE_REVIEW_TASK_MANIFEST/V1',
      manifest,
    );
    const runtimeDigest = domainDigest(
      'PROGRAMME_GATE_REVIEW_RUNTIME_CONTEXT/V1',
      runtime,
    );
    const exactInputDigest = domainDigest(
      'PROGRAMME_GATE_REVIEW_EXACT_INPUT_CONTEXT/V1',
      {
        context_version: 'TrustedReviewExactInputContext/V1',
        task_manifest_digest: manifestDigest,
        exact_specification_root: ROOT,
        frozen_specification_manifest_digest: manifest.frozen_specification.manifest_digest,
        registered_prompt_digest: manifest.registered_prompt.payload_digest,
        output_schema_digest: manifest.output_schema.payload_digest,
        fixed_runtime_context_digest: runtimeDigest,
      },
    );
    const controllerUnsigned = {
      schema_version: 'TrustedReviewControllerRecord/V1',
      controller_id: REVIEW_CONTROLLER_POLICY.controller_id,
      controller_version: REVIEW_CONTROLLER_POLICY.controller_version,
      review_runtime_version: REVIEW_CONTROLLER_POLICY.review_runtime_version,
      review_runtime_binary_digest: REVIEW_CONTROLLER_POLICY.review_runtime_binary_digest,
      fixed_controller_runtime_context_digest: runtimeDigest,
      controller_supplied_input_manifest: manifest,
      fixed_controller_runtime_context: runtime,
      exact_specification_root: ROOT,
      exact_model_identifier: REVIEW_CONTROLLER_POLICY.exact_model_identifier,
      reasoning_level: REVIEW_CONTROLLER_POLICY.reasoning_level,
      immutable_task_id: `contract-task-${index}`,
      immutable_session_id: `contract-session-${index}`,
      immutable_review_id: `contract-review-${index}`,
      registered_prompt_id: lane.registered_prompt_id,
      cold_review_prompt_digest: REVIEW_CONTROLLER_POLICY.prompt_digests[lane.lane_id],
      controller_supplied_input_manifest_digest: manifestDigest,
      exact_input_context_digest: exactInputDigest,
      input_context_digest_before_review: exactInputDigest,
      input_context_digest_after_review: exactInputDigest,
      review_output_digest: 'd'.repeat(64),
      review_start_time: '2026-07-28T10:00:00.000Z',
      review_end_time: '2026-07-28T10:30:00.000Z',
      reviewer_principal_id: `contract-controller-${index}/session-${index}`,
      reviewer_source_control_identity_set: [`contract-reviewer-${index}@example.test`],
      reviewer_disposition: 'PASS',
      reviewer_edit_set_root: emptyReviewRoot,
      parent_session_state: 'GENESIS',
      no_earlier_review_conclusions_were_inputs: true,
      nonce: `contract-nonce-${index}`,
      signature_algorithm: 'Ed25519',
      controller_key_id: 'CONTROLLER_KEY',
    };
    const controllerRecord = {
      ...controllerUnsigned,
      controller_signature: sign(
        controller.privateKey,
        'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1',
        'REVIEW_CONTROLLER',
        controllerUnsigned,
      ),
    };
    const independenceUnsigned = {
      schema_version: 'ReviewerIndependenceAttestation/V1',
      reviewer_principal_id: controllerRecord.reviewer_principal_id,
      immutable_session_id: controllerRecord.immutable_session_id,
      session_parent_or_genesis: 'GENESIS',
      exact_input_context_digest: exactInputDigest,
      reviewed_code_commit: COMMIT,
      source_control_history_scope: 'ALL_REFS_FROM_REPOSITORY_GENESIS',
      source_control_authorship_events: AUTHORSHIP_EVENTS,
      source_control_authorship_event_set_root: domainDigest(
        'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
        AUTHORSHIP_EVENTS,
      ),
      prior_conclusion_input_set: [],
      authoring_event_intersection_root: emptyAuthorRoot,
      prior_conclusion_intersection_root: emptyPriorRoot,
      reviewer_edit_set_root: emptyReviewRoot,
      validator_executable_digest: 'e'.repeat(64),
      validator_configuration_digest: 'f'.repeat(64),
      validator_key_id: 'VALIDATOR_KEY',
      signature_algorithm: 'Ed25519',
    };
    const independenceRecord = {
      ...independenceUnsigned,
      signature: sign(
        validator.privateKey,
        'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1',
        'VALIDATOR',
        independenceUnsigned,
      ),
    };
    return [
      {
        member_id: `controller:${lane.lane_id}`,
        member_type: 'TrustedReviewControllerRecord',
        payload: controllerRecord,
      },
      {
        member_id: `independence:${lane.lane_id}`,
        member_type: 'ReviewerIndependenceAttestation',
        payload: independenceRecord,
      },
    ];
  });
  g0Review.review_set_evidence_id = domainDigest(
    'PROGRAMME_GATE_REVIEW_SET/V1',
    REVIEW_LANES.map((lane) => ({
      lane_id: lane.lane_id,
      controller_record: g0ReviewMembers.find(
        (member) => member.member_id === `controller:${lane.lane_id}`,
      ).payload,
      independence_attestation: g0ReviewMembers.find(
        (member) => member.member_id === `independence:${lane.lane_id}`,
      ).payload,
    })),
  );
  authorityManifest.g0_review_set_evidence_id = g0Review.review_set_evidence_id;
  g0Approval.passing_review_set_evidence_id = g0Review.review_set_evidence_id;
  const benApprovalUnsigned = {
    schema_version: 'BenSpecificationApproval/V1',
    approved_root: ROOT,
    passing_review_set_evidence_id: g0Review.review_set_evidence_id,
    approver_identity: 'BEN_GOODCHILD',
    conditions: [],
    approved_at: '2026-07-28T11:00:00.000Z',
    nonce: 'g0-ben-approval',
    signature_algorithm: 'Ed25519',
    approver_key_id: 'BEN_KEY',
  };
  const benApprovalRecord = {
    ...benApprovalUnsigned,
    signature: sign(
      ben.privateKey,
      'PROGRAMME_GATE_BEN_APPROVAL/V1',
      'BEN_APPROVER',
      benApprovalUnsigned,
    ),
  };
  g0Approval.approval_evidence_id = domainDigest(
    'PROGRAMME_GATE_BEN_APPROVAL_ID/V1',
    benApprovalRecord,
  );
  authorityManifest.g0_ben_approval_evidence_id = g0Approval.approval_evidence_id;
  const g0ApprovalMembers = [
    {
      member_id: `approval:${g0Approval.approval_evidence_id}`,
      member_type: 'BenSpecificationApproval',
      payload: benApprovalRecord,
    },
    {
      member_id: `review-set:${g0Review.review_set_evidence_id}`,
      member_type: 'ExactDigestReviewSetAttestation',
      payload: g0Review,
    },
  ];
  const g0ReviewEnvelope = g0Envelope({
    gateId: 'G0_EXACT_DIGEST_REVIEW_SET',
    evidenceContract:
      'five-lane-provider-attested-exact-specification-root-review-set/v3',
    subjectType: 'ExactDigestReviewSetSubject',
    objectType: 'ExactDigestReviewSetAttestation',
    evidenceObject: g0Review,
    claims: [
      'five_named_lanes_pass_same_root',
      'eligible_legal_reviewer',
      'reviewer_independence_recomputed',
      'root_unchanged_before_and_after',
    ],
    members: g0ReviewMembers,
    validatorPrivateKey: validator.privateKey,
  });
  const g0ApprovalEnvelope = g0Envelope({
    gateId: 'G0_BEN_SPEC_APPROVAL',
    evidenceContract: 'ben-approved-reviewed-specification-root/v3',
    subjectType: 'BenSpecificationApprovalSubject',
    objectType: 'BenSpecificationApproval',
    evidenceObject: g0Approval,
    claims: [
      'approved_root_equals_passing_review_root',
      'ben_identity_and_signature_valid',
      'approval_unconditional',
    ],
    members: g0ApprovalMembers,
    validatorPrivateKey: validator.privateKey,
  });
  authorityManifest.g0_review_set_payload_digest = domainDigest(
    'PROGRAMME_GATE_EVIDENCE_PAYLOAD/V2',
    unsigned(g0ReviewEnvelope),
  );
  authorityManifest.g0_ben_approval_payload_digest = domainDigest(
    'PROGRAMME_GATE_EVIDENCE_PAYLOAD/V2',
    unsigned(g0ApprovalEnvelope),
  );
  const authorityEvidence = [];
  const authoritySigning = {
    VALIDATOR: {
      keyId: 'VALIDATOR_KEY',
      domain: 'PROGRAMME_GATE_EVIDENCE/V2',
      privateKey: validator.privateKey,
    },
    REVIEW_CONTROLLER: {
      keyId: 'CONTROLLER_KEY',
      domain: 'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
      privateKey: controller.privateKey,
    },
    BEN_APPROVER: {
      keyId: 'BEN_KEY',
      domain: 'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1',
      privateKey: ben.privateKey,
    },
  };
  function addAuthority({
    kind,
    subjectId,
    payload,
    actorIdentity,
    disposition = 'PASS',
    attestorRole = 'VALIDATOR',
    relatedAuthorityIds = [],
  }) {
    const signer = authoritySigning[attestorRole];
    const unsignedIdentity = {
      schema_version: 'ContractFreezeAuthorityEvidence/V1',
      authority_kind: kind,
      authority_subject_id: subjectId,
      authority_payload: payload,
      authority_payload_digest: domainDigest(
        'PROGRAMME_GATE_CONTRACT_AUTHORITY_PAYLOAD/V1',
        payload,
      ),
      actor_identity: actorIdentity,
      disposition,
      related_authority_ids: relatedAuthorityIds,
      conditions: [],
      attestor_role: attestorRole,
      attestor_key_id: signer.keyId,
      signature_algorithm: 'Ed25519',
    };
    const authorityEvidenceId = domainDigest(
        'PROGRAMME_GATE_CONTRACT_AUTHORITY_EVIDENCE_ID/V1',
        unsignedIdentity,
    );
    const unsigned = {
      ...unsignedIdentity,
      authority_evidence_id: authorityEvidenceId,
    };
    const record = {
      ...unsigned,
      signature: sign(signer.privateKey, signer.domain, attestorRole, unsigned),
    };
    authorityEvidence.push(record);
    return record;
  }
  function addCatalogueAuthorities({
    prefix,
    catalogueKind,
    catalogueRoot,
    authorPrincipalId,
    reviewerPrincipalId,
    reviewScope,
    authorshipField,
    accessField,
    reviewField,
  }) {
    const authorship = addAuthority({
      kind: `${prefix}_CATALOGUE_AUTHORSHIP`,
      subjectId: authorityManifest[authorshipField],
      payload: {
        disposition_id: authorityManifest[authorshipField],
        catalogue_kind: catalogueKind,
        catalogue_root: catalogueRoot,
        author_principal_id: authorPrincipalId,
        input_isolation_disposition_id: authorityManifest[accessField],
        authorship_method: 'INDEPENDENT_COLD_AUTHORSHIP',
      },
      actorIdentity: `INDEPENDENT_${prefix}_CATALOGUE_AUTHOR`,
    });
    const access = addAuthority({
      kind: `${prefix}_CATALOGUE_INPUT_ACCESS`,
      subjectId: authorityManifest[accessField],
      payload: {
        disposition_id: authorityManifest[accessField],
        catalogue_kind: catalogueKind,
        catalogue_root: catalogueRoot,
        author_principal_id: authorPrincipalId,
        access_mode: 'NO_FROZEN_CATALOGUE_OR_PRIOR_REVIEW_ACCESS',
        observed_input_set_root: '3'.repeat(64),
      },
      actorIdentity: 'INPUT_ISOLATION_VALIDATOR',
      relatedAuthorityIds: [authorship.authority_evidence_id],
    });
    return addAuthority({
      kind: `${prefix}_CATALOGUE_REVIEW`,
      subjectId: authorityManifest[reviewField],
      payload: {
        disposition_id: authorityManifest[reviewField],
        catalogue_kind: catalogueKind,
        catalogue_root: catalogueRoot,
        reviewer_principal_id: reviewerPrincipalId,
        authorship_disposition_id: authorityManifest[authorshipField],
        input_access_disposition_id: authorityManifest[accessField],
        review_scope: reviewScope,
        blocking_finding_ids: [],
      },
      actorIdentity: `INDEPENDENT_${prefix}_CATALOGUE_REVIEWER`,
      attestorRole: 'REVIEW_CONTROLLER',
      relatedAuthorityIds: [
        authorship.authority_evidence_id,
        access.authority_evidence_id,
      ],
    });
  }
  const semanticCatalogueRoot = '4'.repeat(64);
  const compositionCatalogueRoot = '5'.repeat(64);
  const semanticReview = addCatalogueAuthorities({
    prefix: 'SEMANTIC_QUESTION',
    catalogueKind: 'SEMANTIC_QUESTION',
    catalogueRoot: semanticCatalogueRoot,
    authorPrincipalId: 'semantic-catalogue-author',
    reviewerPrincipalId: 'semantic-catalogue-reviewer',
    reviewScope: 'LEGAL_SEMANTIC_COMPLETENESS',
    authorshipField: 'independent_semantic_question_catalogue_authorship_id',
    accessField: 'independent_semantic_question_catalogue_input_access_id',
    reviewField: 'independent_semantic_question_catalogue_review_id',
  });
  const compositionReview = addCatalogueAuthorities({
    prefix: 'COMPOSITION',
    catalogueKind: 'COMPOSITION',
    catalogueRoot: compositionCatalogueRoot,
    authorPrincipalId: 'composition-catalogue-author',
    reviewerPrincipalId: 'composition-catalogue-reviewer',
    reviewScope: 'LEGAL_COMPOSITION_COMPLETENESS',
    authorshipField: 'independent_composition_catalogue_authorship_id',
    accessField: 'independent_composition_catalogue_input_access_id',
    reviewField: 'independent_composition_catalogue_review_id',
  });
  const semanticStageOutput = addAuthority({
    kind: 'PRE_FREEZE_SEMANTIC_STAGE_OUTPUT_SET',
    subjectId: contractBundleId,
    payload: {
      stage_id: 'SEMANTIC_QUESTION_CATALOGUE_OUTPUT',
      catalogue_kind: 'SEMANTIC_QUESTION',
      catalogue_root: semanticCatalogueRoot,
      catalogue_review_disposition_id:
        authorityManifest.independent_semantic_question_catalogue_review_id,
      output_set_root: '7'.repeat(64),
      output_member_count: 2,
      failed_member_ids: [],
    },
    actorIdentity: 'SEMANTIC_STAGE_EXECUTOR',
    relatedAuthorityIds: [semanticReview.authority_evidence_id],
  });
  const compositionStageOutput = addAuthority({
    kind: 'PRE_FREEZE_SEMANTIC_STAGE_OUTPUT_SET',
    subjectId: contractBundleId,
    payload: {
      stage_id: 'COMPOSITION_CATALOGUE_OUTPUT',
      catalogue_kind: 'COMPOSITION',
      catalogue_root: compositionCatalogueRoot,
      catalogue_review_disposition_id:
        authorityManifest.independent_composition_catalogue_review_id,
      output_set_root: '8'.repeat(64),
      output_member_count: 2,
      failed_member_ids: [],
    },
    actorIdentity: 'SEMANTIC_STAGE_EXECUTOR',
    relatedAuthorityIds: [compositionReview.authority_evidence_id],
  });
  authorityManifest.pre_freeze_semantic_stage_output_set_roots = [
    semanticStageOutput.authority_payload.output_set_root,
    compositionStageOutput.authority_payload.output_set_root,
  ];
  const reconciliation = addAuthority({
    kind: 'SEMANTIC_QUESTION_CATALOGUE_RECONCILIATION',
    subjectId: contractBundleId,
    payload: {
      semantic_question_catalogue_root: semanticCatalogueRoot,
      composition_catalogue_root: compositionCatalogueRoot,
      semantic_review_disposition_id:
        authorityManifest.independent_semantic_question_catalogue_review_id,
      composition_review_disposition_id:
        authorityManifest.independent_composition_catalogue_review_id,
      semantic_question_stage_output_set_root:
        semanticStageOutput.authority_payload.output_set_root,
      composition_stage_output_set_root:
        compositionStageOutput.authority_payload.output_set_root,
      reconciliation_status: 'NO_UNRESOLVED_CONFLICTS',
      conflict_ids: [],
    },
    actorIdentity: 'CATALOGUE_RECONCILIATION_VALIDATOR',
    disposition: 'RECONCILED',
    relatedAuthorityIds: [
      semanticStageOutput.authority_evidence_id,
      compositionStageOutput.authority_evidence_id,
    ],
  });
  authorityManifest.semantic_question_catalogue_reconciliation_digest =
    reconciliation.authority_payload_digest;
  const neutralProjection = addAuthority({
    kind: 'NEUTRAL_PROJECTION',
    subjectId: contractBundleId,
    payload: {
      source_reconciliation_digest: reconciliation.authority_payload_digest,
      projection_root: '6'.repeat(64),
      projection_mode: 'SEMANTICALLY_NEUTRAL',
      excluded_inference_ids: [],
    },
    actorIdentity: 'NEUTRAL_PROJECTION_COMPILER',
    relatedAuthorityIds: [reconciliation.authority_evidence_id],
  });
  authorityManifest.neutral_projection_digest = neutralProjection.authority_payload_digest;
  const projectionSet = addAuthority({
    kind: 'PRE_FREEZE_NEUTRAL_PROJECTION_SET',
    subjectId: contractBundleId,
    payload: {
      neutral_projection_digest: neutralProjection.authority_payload_digest,
      neutral_projection_set_root: '9'.repeat(64),
      projection_member_count: 2,
      unresolved_member_ids: [],
    },
    actorIdentity: 'NEUTRAL_PROJECTION_COMPILER',
    relatedAuthorityIds: [neutralProjection.authority_evidence_id],
  });
  authorityManifest.pre_freeze_neutral_projection_set_roots = [
    projectionSet.authority_payload.neutral_projection_set_root,
  ];
  const fieldUniverse = addAuthority({
    kind: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
    subjectId: contractBundleId,
    payload: {
      field_universe_set_root: 'a'.repeat(64),
      relationship_definition_set_root: 'a'.repeat(64),
      effect_schema_set_root: 'b'.repeat(64),
      unresolved_field_ids: [],
    },
    actorIdentity: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE_COMPILER',
  });
  authorityManifest.relationship_effect_field_universe_set_root =
    fieldUniverse.authority_payload.field_universe_set_root;
  const reviewerEligibility = addAuthority({
    kind: 'REVIEWER_ELIGIBILITY_SET',
    subjectId: contractBundleId,
    payload: {
      eligibility_set_root: 'c'.repeat(64),
      eligible_reviewers: [{
        reviewer_identity: 'independent-sol-reviewer',
        reviewer_model_identifier: 'gpt-5.6-sol',
        reasoning_level: 'xhigh',
      }],
      excluded_reviewer_ids: [],
    },
    actorIdentity: 'REVIEW_ELIGIBILITY_VALIDATOR',
  });
  authorityManifest.reviewer_eligibility_set_root =
    reviewerEligibility.authority_payload.eligibility_set_root;
  const benDecisions = addAuthority({
    kind: 'BEN_TAXONOMY_CODEBOOK_DECISION_SET',
    subjectId: contractBundleId,
    payload: {
      decision_set_root: 'd'.repeat(64),
      approver_identity: 'BEN_GOODCHILD',
      approved_taxonomy_version: 'CanonicalContractBundle/V1',
      decision_ids: ['e'.repeat(64)],
      unresolved_decision_ids: [],
    },
    actorIdentity: 'BEN_GOODCHILD',
    disposition: 'APPROVED',
    attestorRole: 'BEN_APPROVER',
  });
  authorityManifest.ben_taxonomy_codebook_decision_set_root =
    benDecisions.authority_payload.decision_set_root;
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
  const reviewerSourceControlIdentitySet = ['independent-sol-reviewer'];
  const sourceControlAuthorshipEvents = enumerateCompleteGitAuthorshipUniverse({
    repositoryRoot: process.cwd(),
    expectedCommit: COMMIT,
  });
  const independenceUnsigned = {
    schema_version: 'ReviewerIndependenceAttestation/V1',
    reviewer_principal_id: 'independent-sol-reviewer-principal',
    immutable_session_id: 'contract-diff-review-session-1',
    session_parent_or_genesis: 'GENESIS',
    exact_input_context_digest: exactReviewInputContextDigest,
    reviewed_code_commit: COMMIT,
    source_control_history_scope: 'ALL_REFS_FROM_REPOSITORY_GENESIS',
    source_control_authorship_events: sourceControlAuthorshipEvents,
    source_control_authorship_event_set_root: domainDigest(
      'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
      sourceControlAuthorshipEvents,
    ),
    prior_conclusion_input_set: [],
    authoring_event_intersection_root: domainDigest(
      'PROGRAMME_GATE_AUTHORING_EVENT_INTERSECTION_ROOT/V1',
      [],
    ),
    prior_conclusion_intersection_root: domainDigest(
      'PROGRAMME_GATE_PRIOR_CONCLUSION_INTERSECTION_ROOT/V1',
      [],
    ),
    reviewer_edit_set_root: domainDigest(
      'PROGRAMME_GATE_REVIEWER_EDIT_SET_ROOT/V1',
      [],
    ),
    validator_executable_digest: 'f'.repeat(64),
    validator_configuration_digest: '1'.repeat(64),
    validator_key_id: 'VALIDATOR_KEY',
    signature_algorithm: 'Ed25519',
  };
  const independence = {
    ...independenceUnsigned,
    signature: sign(
      validator.privateKey,
      'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1',
      'VALIDATOR',
      independenceUnsigned,
    ),
  };
  const independenceAttestationId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_REVIEW_INDEPENDENCE_ATTESTATION_ID/V1',
    independence,
  );
  const independencePayloadDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_REVIEW_INDEPENDENCE_PAYLOAD/V1',
    independence,
  );
  const reviewUnsignedIdentity = {
    schema_version: 'ContractDiffReviewAttestation/V1',
    predecessor_contract_bundle_id: predecessorContractBundleId,
    predecessor_contract_bundle_digest: predecessorContractBundleDigest,
    predecessor_contract_members: predecessorContractMembers,
    contract_bundle_id: contractBundleId,
    contract_bundle_digest: contractBundleDigest,
    contract_bundle_members: contractBundleMembers,
    frozen_contract_pair_digest: frozenPairDigest,
    semantic_identity_diff: semanticIdentityDiff,
    semantic_identity_diff_digest: authorityManifest.semantic_identity_diff_digest,
    review_scope: 'SEMANTIC_AND_IDENTITY_DIFF',
    review_disposition: 'PASS',
    blocking_finding_count: 0,
    blocking_finding_ids: [],
    reviewer_identity: 'independent-sol-reviewer',
    reviewer_model_identifier: 'gpt-5.6-sol',
    reasoning_level: 'xhigh',
    reviewer_principal_id: independence.reviewer_principal_id,
    immutable_session_id: independence.immutable_session_id,
    reviewer_source_control_identity_set: reviewerSourceControlIdentitySet,
    reviewer_eligibility_digest: authorityManifest.reviewer_eligibility_set_root,
    review_set_root: ROOT,
    exact_input_context_digest: exactReviewInputContextDigest,
    independence_attestation_id: independenceAttestationId,
    independence_attestation_payload_digest: independencePayloadDigest,
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
    ordered_gate_projection: [
      {
        gate_id: 'G0_EXACT_DIGEST_REVIEW_SET',
        state: 'PASS',
        evidence_envelope_id: domainDigest(
          'PROGRAMME_GATE_EVIDENCE_ENVELOPE/V2',
          g0ReviewEnvelope,
        ),
        evidence_payload_digest: authorityManifest.g0_review_set_payload_digest,
      },
      {
        gate_id: 'G0_BEN_SPEC_APPROVAL',
        state: 'PASS',
        evidence_envelope_id: domainDigest(
          'PROGRAMME_GATE_EVIDENCE_ENVELOPE/V2',
          g0ApprovalEnvelope,
        ),
        evidence_payload_digest: authorityManifest.g0_ben_approval_payload_digest,
      },
      {
        gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
        state: 'PASS',
        evidence_envelope_id: '5'.repeat(64),
        evidence_payload_digest: '6'.repeat(64),
      },
    ],
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
    authority_member_inventory: [
      {
        member_id: `governing:${governingMember.specification_member_id}`,
        member_type: 'ContractFreezeGoverningSpecificationMember',
      },
      {
        member_id: `review-set:${g0Review.review_set_evidence_id}`,
        member_type: 'ExactDigestReviewSetAttestation',
      },
      {
        member_id: `g0-approval:${g0Approval.approval_evidence_id}`,
        member_type: 'BenSpecificationApprovalEvidence',
      },
      {
        member_id: 'g0-envelope:G0_EXACT_DIGEST_REVIEW_SET',
        member_type: 'ProgrammeGateEvidenceEnvelope',
      },
      {
        member_id: 'g0-envelope:G0_BEN_SPEC_APPROVAL',
        member_type: 'ProgrammeGateEvidenceEnvelope',
      },
      ...g0ReviewMembers.map(({ member_id, member_type }) => ({
        member_id,
        member_type,
      })),
      {
        member_id: `approval:${g0Approval.approval_evidence_id}`,
        member_type: 'BenSpecificationApproval',
      },
      {
        member_id: `review-independence:${independenceAttestationId}`,
        member_type: 'ReviewerIndependenceAttestation',
      },
      ...authorityEvidence.map((record) => ({
        member_id: `authority-evidence:${record.authority_evidence_id}`,
        member_type: 'ContractFreezeAuthorityEvidence',
      })),
    ],
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
    {
      member_id: `governing:${governingMember.specification_member_id}`,
      member_type: 'ContractFreezeGoverningSpecificationMember',
      payload: governingMember,
    },
    {
      member_id: `review-set:${g0Review.review_set_evidence_id}`,
      member_type: 'ExactDigestReviewSetAttestation',
      payload: g0Review,
    },
    {
      member_id: `g0-approval:${g0Approval.approval_evidence_id}`,
      member_type: 'BenSpecificationApprovalEvidence',
      payload: g0Approval,
    },
    {
      member_id: 'g0-envelope:G0_EXACT_DIGEST_REVIEW_SET',
      member_type: 'ProgrammeGateEvidenceEnvelope',
      payload: g0ReviewEnvelope,
    },
    {
      member_id: 'g0-envelope:G0_BEN_SPEC_APPROVAL',
      member_type: 'ProgrammeGateEvidenceEnvelope',
      payload: g0ApprovalEnvelope,
    },
    ...g0ReviewMembers,
    {
      member_id: `approval:${g0Approval.approval_evidence_id}`,
      member_type: 'BenSpecificationApproval',
      payload: benApprovalRecord,
    },
    {
      member_id: `review-independence:${independenceAttestationId}`,
      member_type: 'ReviewerIndependenceAttestation',
      payload: independence,
    },
    ...authorityEvidence.map((record) => ({
      member_id: `authority-evidence:${record.authority_evidence_id}`,
      member_type: 'ContractFreezeAuthorityEvidence',
      payload: record,
    })),
  ];
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [
      keyEntry({
        keyId: 'VALIDATOR_KEY',
        publicKey: validator.publicKey,
        roles: ['VALIDATOR'],
        domains: [
          'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT/V1',
          'PROGRAMME_GATE_EVIDENCE/V2',
          'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1',
        ],
      }),
      keyEntry({
        keyId: 'CONTROLLER_KEY',
        publicKey: controller.publicKey,
        roles: ['REVIEW_CONTROLLER'],
        domains: [
          'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
          'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1',
        ],
      }),
      keyEntry({
        keyId: 'BEN_KEY',
        publicKey: ben.publicKey,
        roles: ['BEN_APPROVER'],
        domains: [
          'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1',
          'PROGRAMME_GATE_BEN_APPROVAL/V1',
        ],
      }),
      keyEntry({
        keyId: 'STATUS_KEY',
        publicKey: publisher.publicKey,
        roles: ['STATUS_PUBLISHER'],
        domains: ['PROGRAMME_GATE_STATUS/V2'],
      }),
    ],
  };
  const sample = {
    evidence,
    immutableMembers,
    keyRegistry,
    publisherPrivateKey: publisher.privateKey,
  };
  if (includePrivateKeys) {
    sample.privateKeys = {
      ben: ben.privateKey,
      controller: controller.privateKey,
      validator: validator.privateKey,
    };
  }
  return sample;
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

function resealAuthority(sample, member) {
  const previousId = member.payload.authority_evidence_id;
  const identityPayload = Object.fromEntries(Object.entries(member.payload).filter(
    ([key]) => key !== 'authority_evidence_id' && key !== 'signature',
  ));
  const nextId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_AUTHORITY_EVIDENCE_ID/V1',
    identityPayload,
  );
  member.payload.authority_evidence_id = nextId;
  const signer = member.payload.attestor_role === 'BEN_APPROVER'
    ? sample.privateKeys.ben
    : member.payload.attestor_role === 'REVIEW_CONTROLLER'
      ? sample.privateKeys.controller
      : sample.privateKeys.validator;
  const domain = member.payload.attestor_role === 'BEN_APPROVER'
    ? 'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1'
    : member.payload.attestor_role === 'REVIEW_CONTROLLER'
      ? 'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1'
      : 'PROGRAMME_GATE_EVIDENCE/V2';
  const unsigned = Object.fromEntries(Object.entries(member.payload).filter(
    ([key]) => key !== 'signature',
  ));
  member.payload.signature = sign(
    signer,
    domain,
    member.payload.attestor_role,
    unsigned,
  );
  member.member_id = `authority-evidence:${nextId}`;
  const inventory = sample.evidence.authority_member_inventory.find(
    (entry) => entry.member_id === `authority-evidence:${previousId}`,
  );
  inventory.member_id = member.member_id;
}

function resealReview(sample, review) {
  const identityPayload = Object.fromEntries(Object.entries(review).filter(
    ([key]) => key !== 'review_id' && key !== 'signature',
  ));
  review.review_id = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_ID/V1',
    identityPayload,
  );
  const unsigned = Object.fromEntries(Object.entries(review).filter(
    ([key]) => key !== 'signature',
  ));
  review.signature = sign(
    sample.privateKeys.controller,
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
    'REVIEW_CONTROLLER',
    unsigned,
  );
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

test('trusted signatures cannot turn an untyped or wrongly authored authority into proof', () => {
  for (const mutate of [
    (record) => { record.actor_identity = 'INDEPENDENT_AUTHORITY'; },
    (record) => {
      record.authority_payload = {
        ...record.authority_payload,
        self_asserted_approval: true,
      };
      record.authority_payload_digest = domainDigest(
        'PROGRAMME_GATE_CONTRACT_AUTHORITY_PAYLOAD/V1',
        record.authority_payload,
      );
    },
  ]) {
    const sample = fixture({ includePrivateKeys: true });
    const member = sample.immutableMembers.find((candidate) => (
      candidate.member_type === 'ContractFreezeAuthorityEvidence'
      && candidate.payload.authority_kind === 'BEN_TAXONOMY_CODEBOOK_DECISION_SET'
    ));
    mutate(member.payload);
    resealAuthority(sample, member);
    const claims = evaluateAcceptanceClaims({
      gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
      evidence: sample.evidence,
      context: context(sample),
    });
    assert.equal(claims[0].typed_value, false);
  }
});

test('a controller-signed asserted diff cannot replace the mechanically derived bundle diff', () => {
  const sample = fixture({ includePrivateKeys: true });
  const review = sample.immutableMembers.find(
    (member) => member.member_type === 'ContractDiffReviewAttestation',
  ).payload;
  review.semantic_identity_diff.added_member_keys = [
    'CLAIM_FABRICATED',
    'CLAIM_GAMMA',
  ];
  review.semantic_identity_diff_digest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_SEMANTIC_IDENTITY_DIFF/V1',
    review.semantic_identity_diff,
  );
  review.exact_input_context_digest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      specification_root: sample.evidence.specification_root,
      code_commit: sample.evidence.code_commit,
      predecessor_contract_bundle_id: review.predecessor_contract_bundle_id,
      predecessor_contract_bundle_digest: review.predecessor_contract_bundle_digest,
      contract_bundle_id: review.contract_bundle_id,
      contract_bundle_digest: review.contract_bundle_digest,
      frozen_contract_pair_digest: review.frozen_contract_pair_digest,
      semantic_identity_diff_digest: review.semantic_identity_diff_digest,
    },
  );
  resealReview(sample, review);
  assert.equal(
    verifySignature({
      keyRegistry: sample.keyRegistry,
      keyId: review.controller_key_id,
      role: 'REVIEW_CONTROLLER',
      domain: 'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
      payload: Object.fromEntries(Object.entries(review).filter(([key]) => key !== 'signature')),
      signature: review.signature,
      at: VERIFICATION_TIME,
    }),
    true,
  );
  assert.equal(
    contractDiffReviewIsMechanicallyBound(review, sample.evidence, context(sample)),
    false,
  );
});

test('signed incomplete authorship history cannot prove reviewer independence', () => {
  const sample = fixture({ includePrivateKeys: true });
  const review = sample.immutableMembers.find(
    (member) => member.member_type === 'ContractDiffReviewAttestation',
  ).payload;
  const member = sample.immutableMembers.find(
    (candidate) => candidate.member_type === 'ReviewerIndependenceAttestation',
  );
  const independence = member.payload;
  independence.source_control_authorship_events =
    independence.source_control_authorship_events.slice(1);
  independence.source_control_authorship_event_set_root = domainDigest(
    'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
    independence.source_control_authorship_events,
  );
  const unsigned = Object.fromEntries(Object.entries(independence).filter(
    ([key]) => key !== 'signature',
  ));
  independence.signature = sign(
    sample.privateKeys.validator,
    'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1',
    'VALIDATOR',
    unsigned,
  );
  review.independence_attestation_id = domainDigest(
    'PROGRAMME_GATE_CONTRACT_REVIEW_INDEPENDENCE_ATTESTATION_ID/V1',
    independence,
  );
  review.independence_attestation_payload_digest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_REVIEW_INDEPENDENCE_PAYLOAD/V1',
    independence,
  );
  member.member_id = `review-independence:${review.independence_attestation_id}`;
  resealReview(sample, review);
  assert.equal(
    contractReviewIndependenceIsValid(review, sample.evidence, context(sample)),
    false,
  );
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

test('P1 stays OPEN when any enumerated legal-authority member is missing or opaque', () => {
  const missing = fixture();
  missing.immutableMembers = missing.immutableMembers.filter(
    (member) => member.member_type !== 'BenSpecificationApprovalEvidence',
  );
  assert.ok(evaluateAcceptanceClaims({
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    evidence: missing.evidence,
    context: context(missing),
  }).some((claim) => claim.typed_value === false));

  const opaque = fixture();
  const authority = opaque.immutableMembers.find(
    (member) => member.member_type === 'ContractFreezeAuthorityEvidence',
  );
  authority.payload.authority_payload = { asserted_digest_only: true };
  assert.ok(evaluateAcceptanceClaims({
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    evidence: opaque.evidence,
    context: context(opaque),
  }).some((claim) => claim.typed_value === false));
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

test('P1 rejects substituted G0 authority and non-PASS G0 status rows', () => {
  const tamperedController = fixture();
  tamperedController.immutableMembers.find(
    (member) => member.member_type === 'TrustedReviewControllerRecord',
  ).payload.controller_signature = Buffer.alloc(64, 1).toString('base64');
  const tamperedClaims = evaluateAcceptanceClaims({
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    evidence: tamperedController.evidence,
    context: context(tamperedController),
  });
  assert.deepEqual(
    tamperedClaims.map((claim) => claim.typed_value),
    [false, false, false, true],
  );

  const openStatus = fixture();
  const status = openStatus.immutableMembers.find(
    (member) => member.member_type === 'ProgrammeGateStatusArtefact',
  ).payload;
  status.ordered_gate_projection.find(
    (row) => row.gate_id === 'G0_EXACT_DIGEST_REVIEW_SET',
  ).state = 'OPEN';
  status.ordered_gate_projection.find(
    (row) => row.gate_id === 'G0_EXACT_DIGEST_REVIEW_SET',
  ).evidence_envelope_id = null;
  status.ordered_gate_projection.find(
    (row) => row.gate_id === 'G0_EXACT_DIGEST_REVIEW_SET',
  ).evidence_payload_digest = null;
  status.signature = sign(
    openStatus.publisherPrivateKey,
    'PROGRAMME_GATE_STATUS/V2',
    'STATUS_PUBLISHER',
    unsigned(status),
  );
  openStatus.evidence.status_payload_digest = domainDigest(
    'PROGRAMME_GATE_STATUS_ARTEFACT_PAYLOAD/V2',
    status,
  );
  const openClaims = evaluateAcceptanceClaims({
    gate_id: 'P1_CONTRACT_FREEZE_ATTESTED',
    evidence: openStatus.evidence,
    context: context(openStatus),
  });
  assert.deepEqual(
    openClaims.map((claim) => claim.typed_value),
    [false, false, false, true],
  );
});
