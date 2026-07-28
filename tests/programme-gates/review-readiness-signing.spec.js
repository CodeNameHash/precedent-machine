const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const test = require('node:test');

const { domainDigest, signatureBytes } = require('../../lib/programme-gates/bytes');
const {
  REGISTRY_DIGESTS,
  REVIEW_CONTROLLER_POLICY,
  REVIEW_LANES,
} = require('../../lib/programme-gates/registry');
const {
  evaluateAcceptanceClaims,
} = require('../../lib/programme-gates/predicates');
const {
  BEN_APPROVAL_DOMAIN,
  BEN_APPROVAL_ROLE,
  CONTROLLER_DOMAIN,
  CONTROLLER_ROLE,
  EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT,
  EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT,
  EMPTY_REVIEWER_EDIT_SET_ROOT,
  INDEPENDENCE_DOMAIN,
  INDEPENDENCE_ROLE,
  verifyReviewSetEvidence,
} = require('../../lib/programme-gates/review-evidence');
const {
  REVIEW_GATE_ORDER,
  buildReviewApprovalReadiness,
  createReviewApprovalReadinessAuthority,
} = require('../../lib/programme-gates/review-readiness');
const {
  buildReviewApprovalSigningRequest,
  createReviewApprovalSigningAuthority,
  preflightReviewApprovalSignature,
} = require('../../lib/programme-gates/review-signing');
const {
  EVIDENCE_SIGNATURE_DOMAIN,
  EVIDENCE_SIGNATURE_ROLE,
} = require('../../lib/programme-gates/validator');
const {
  expectedTestExecutableDigest,
} = require('../../lib/programme-gates/test-executable-registry');
const {
  enumerateCompleteGitAuthorshipUniverse,
} = require('../../lib/programme-gates/git-authorship');

const ROOT = 'a'.repeat(64);
const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const COMMIT = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: REPOSITORY_ROOT,
  encoding: 'utf8',
}).trim();
const AUTHORSHIP_EVENTS = enumerateCompleteGitAuthorshipUniverse({
  repositoryRoot: REPOSITORY_ROOT,
  expectedCommit: COMMIT,
});
const DIGEST_B = 'b'.repeat(64);
const DIGEST_C = 'c'.repeat(64);
const DIGEST_D = 'd'.repeat(64);
const OBSERVED_AT = '2026-07-28T12:00:00.000Z';
const VERIFICATION_TIME = '2026-07-28T12:01:00.000Z';
const VALIDATOR_DIGEST = 'e'.repeat(64);

function sign(privateKey, domain, role, payload) {
  return crypto.sign(
    null,
    signatureBytes({ domain, role, payload }),
    privateKey,
  ).toString('base64');
}

function unsigned(record, signatureField) {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== signatureField),
  );
}

function keyEntry({
  keyId,
  publicKey,
  roles,
  domains,
}) {
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

function fixture() {
  const controller = crypto.generateKeyPairSync('ed25519');
  const independence = crypto.generateKeyPairSync('ed25519');
  const ben = crypto.generateKeyPairSync('ed25519');
  const evidence = crypto.generateKeyPairSync('ed25519');
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [
      keyEntry({
        keyId: 'CONTROLLER_KEY',
        publicKey: controller.publicKey,
        roles: [CONTROLLER_ROLE],
        domains: [CONTROLLER_DOMAIN],
      }),
      keyEntry({
        keyId: 'INDEPENDENCE_KEY',
        publicKey: independence.publicKey,
        roles: [INDEPENDENCE_ROLE],
        domains: [INDEPENDENCE_DOMAIN],
      }),
      keyEntry({
        keyId: 'BEN_KEY',
        publicKey: ben.publicKey,
        roles: [BEN_APPROVAL_ROLE],
        domains: [BEN_APPROVAL_DOMAIN],
      }),
      keyEntry({
        keyId: 'EVIDENCE_KEY',
        publicKey: evidence.publicKey,
        roles: [EVIDENCE_SIGNATURE_ROLE],
        domains: [EVIDENCE_SIGNATURE_DOMAIN],
      }),
    ],
  };
  const reviewAuthority = {
    key_registry: keyRegistry,
    allowed_controllers: [{
      controller_id: 'CODEX_CLI_REVIEW_CONTROLLER',
      controller_version: 'LOCAL_REVIEW_CONTROLLER/V1',
    }],
    allowed_runtimes: [{
      review_runtime_version: REVIEW_CONTROLLER_POLICY.review_runtime_version,
      review_runtime_binary_digest: REVIEW_CONTROLLER_POLICY.review_runtime_binary_digest,
      fixed_controller_runtime_context_digest: DIGEST_C,
    }],
    allowed_prompts: REVIEW_LANES.map((lane) => ({
      lane_id: lane.lane_id,
      registered_prompt_id: lane.registered_prompt_id,
      cold_review_prompt_digest: REVIEW_CONTROLLER_POLICY.prompt_digests[lane.lane_id],
    })),
    allowed_independence_validators: [{
      validator_executable_digest: DIGEST_B,
      validator_configuration_digest: DIGEST_C,
      validator_key_id: 'INDEPENDENCE_KEY',
    }],
    fable_model_identifiers: ['fable-legal-reviewer'],
    other_lane_model_identifiers: ['gpt-5.6-sol'],
  };
  const members = REVIEW_LANES.map((lane, index) => {
    const controllerRecord = {
      schema_version: 'TrustedReviewControllerRecord/V1',
      controller_id: 'CODEX_CLI_REVIEW_CONTROLLER',
      controller_version: 'LOCAL_REVIEW_CONTROLLER/V1',
      review_runtime_version: REVIEW_CONTROLLER_POLICY.review_runtime_version,
      review_runtime_binary_digest: REVIEW_CONTROLLER_POLICY.review_runtime_binary_digest,
      fixed_controller_runtime_context_digest: DIGEST_C,
      controller_supplied_input_manifest: {
        manifest_version: 'TrustedReviewTaskManifest/V1',
        lane_id: lane.lane_id,
        exact_specification_root: ROOT,
        frozen_specification: {
          manifest_id: 'codex-program-specification-manifest/v1',
          manifest_digest: DIGEST_B,
          file_count: 6,
          immutable: true,
        },
        registered_prompt: {
          prompt_id: lane.registered_prompt_id,
          path: `/tmp/prompt-${index}.txt`,
          payload_digest: REVIEW_CONTROLLER_POLICY.prompt_digests[lane.lane_id],
          byte_length: 1,
          immutable: true,
          contains_prior_review_conclusions: false,
        },
        output_schema: {
          schema_id: 'ColdReviewOutput/V1',
          path: `/tmp/schema-${index}.json`,
          payload_digest: DIGEST_D,
          byte_length: 1,
          immutable: true,
        },
      },
      fixed_controller_runtime_context: {
        context_version: 'TrustedReviewRuntimeContext/V1',
        review_runtime_binary_path: REVIEW_CONTROLLER_POLICY.review_runtime_binary_path,
        review_runtime_version: REVIEW_CONTROLLER_POLICY.review_runtime_version,
        review_runtime_binary_digest: REVIEW_CONTROLLER_POLICY.review_runtime_binary_digest,
        working_directory: '/tmp/review',
        operating_system: REVIEW_CONTROLLER_POLICY.operating_system,
        architecture: REVIEW_CONTROLLER_POLICY.architecture,
        home_path: '/tmp/home',
        codex_home_path: '/tmp/codex-home',
        tmpdir_path: '/tmp/review-tmp',
        path_value: REVIEW_CONTROLLER_POLICY.path_value,
        lang: REVIEW_CONTROLLER_POLICY.locale,
        lc_all: REVIEW_CONTROLLER_POLICY.locale,
        term: REVIEW_CONTROLLER_POLICY.terminal,
      },
      exact_specification_root: ROOT,
      exact_model_identifier: 'gpt-5.6-sol',
      reasoning_level: 'xhigh',
      immutable_task_id: `task-${index}`,
      immutable_session_id: `session-${index}`,
      immutable_review_id: `review-${index}`,
      registered_prompt_id: lane.registered_prompt_id,
      cold_review_prompt_digest: REVIEW_CONTROLLER_POLICY.prompt_digests[lane.lane_id],
      controller_supplied_input_manifest_digest: DIGEST_B,
      exact_input_context_digest: DIGEST_C,
      input_context_digest_before_review: DIGEST_C,
      input_context_digest_after_review: DIGEST_C,
      review_output_digest: DIGEST_D,
      review_start_time: '2026-07-28T10:00:00.000Z',
      review_end_time: '2026-07-28T10:30:00.000Z',
      reviewer_principal_id: `controller-${index}/session-${index}`,
      reviewer_source_control_identity_set: [`reviewer-${index}@example.test`],
      reviewer_disposition: 'PASS',
      reviewer_edit_set_root: EMPTY_REVIEWER_EDIT_SET_ROOT,
      parent_session_state: 'GENESIS',
      no_earlier_review_conclusions_were_inputs: true,
      nonce: `nonce-${index}`,
      signature_algorithm: 'Ed25519',
      controller_key_id: 'CONTROLLER_KEY',
      controller_signature: '',
    };
    controllerRecord.controller_supplied_input_manifest_digest = domainDigest(
      'PROGRAMME_GATE_REVIEW_TASK_MANIFEST/V1',
      controllerRecord.controller_supplied_input_manifest,
    );
    controllerRecord.fixed_controller_runtime_context_digest = domainDigest(
      'PROGRAMME_GATE_REVIEW_RUNTIME_CONTEXT/V1',
      controllerRecord.fixed_controller_runtime_context,
    );
    controllerRecord.exact_input_context_digest = domainDigest(
      'PROGRAMME_GATE_REVIEW_EXACT_INPUT_CONTEXT/V1',
      {
        context_version: 'TrustedReviewExactInputContext/V1',
        task_manifest_digest: controllerRecord.controller_supplied_input_manifest_digest,
        exact_specification_root: ROOT,
        frozen_specification_manifest_digest:
          controllerRecord.controller_supplied_input_manifest
            .frozen_specification.manifest_digest,
        registered_prompt_digest:
          controllerRecord.controller_supplied_input_manifest.registered_prompt.payload_digest,
        output_schema_digest:
          controllerRecord.controller_supplied_input_manifest.output_schema.payload_digest,
        fixed_runtime_context_digest:
          controllerRecord.fixed_controller_runtime_context_digest,
      },
    );
    controllerRecord.input_context_digest_before_review =
      controllerRecord.exact_input_context_digest;
    controllerRecord.input_context_digest_after_review =
      controllerRecord.exact_input_context_digest;
    controllerRecord.controller_signature = sign(
      controller.privateKey,
      CONTROLLER_DOMAIN,
      CONTROLLER_ROLE,
      unsigned(controllerRecord, 'controller_signature'),
    );
    const independenceRecord = {
      schema_version: 'ReviewerIndependenceAttestation/V1',
      reviewer_principal_id: controllerRecord.reviewer_principal_id,
      immutable_session_id: controllerRecord.immutable_session_id,
      session_parent_or_genesis: 'GENESIS',
      exact_input_context_digest: controllerRecord.exact_input_context_digest,
      reviewed_code_commit: COMMIT,
      source_control_history_scope: 'ALL_REFS_FROM_REPOSITORY_GENESIS',
      source_control_authorship_events: AUTHORSHIP_EVENTS,
      source_control_authorship_event_set_root: '',
      prior_conclusion_input_set: [],
      authoring_event_intersection_root: EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT,
      prior_conclusion_intersection_root: EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT,
      reviewer_edit_set_root: EMPTY_REVIEWER_EDIT_SET_ROOT,
      validator_executable_digest: DIGEST_B,
      validator_configuration_digest: DIGEST_C,
      validator_key_id: 'INDEPENDENCE_KEY',
      signature_algorithm: 'Ed25519',
      signature: '',
    };
    independenceRecord.source_control_authorship_event_set_root = domainDigest(
      'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
      independenceRecord.source_control_authorship_events,
    );
    independenceRecord.signature = sign(
      independence.privateKey,
      INDEPENDENCE_DOMAIN,
      INDEPENDENCE_ROLE,
      unsigned(independenceRecord, 'signature'),
    );
    return {
      lane_id: lane.lane_id,
      controller_record: controllerRecord,
      independence_attestation: independenceRecord,
    };
  });
  reviewAuthority.allowed_runtimes[0].fixed_controller_runtime_context_digest =
    members[0].controller_record.fixed_controller_runtime_context_digest;
  const review = verifyReviewSetEvidence({
    expected_specification_root: ROOT,
    members,
    authority: reviewAuthority,
    at: VERIFICATION_TIME,
  });
  assert.equal(review.valid, true);
  const approvalRecord = {
    schema_version: 'BenSpecificationApproval/V1',
    approved_root: ROOT,
    passing_review_set_evidence_id: review.evidence_id,
    approver_identity: 'BEN_GOODCHILD',
    conditions: [],
    approved_at: '2026-07-28T11:00:00.000Z',
    nonce: 'ben-approval-1',
    signature_algorithm: 'Ed25519',
    approver_key_id: 'BEN_KEY',
    signature: '',
  };
  approvalRecord.signature = sign(
    ben.privateKey,
    BEN_APPROVAL_DOMAIN,
    BEN_APPROVAL_ROLE,
    unsigned(approvalRecord, 'signature'),
  );
  return {
    approvalRecord,
    benAuthority: { key_registry: keyRegistry },
    controllerPrivateKey: controller.privateKey,
    evidencePrivateKey: evidence.privateKey,
    independencePrivateKey: independence.privateKey,
    keyRegistry,
    members,
    reviewAuthority,
  };
}

function resignController(sample, index) {
  const record = sample.members[index].controller_record;
  record.controller_signature = sign(
    sample.controllerPrivateKey,
    CONTROLLER_DOMAIN,
    CONTROLLER_ROLE,
    unsigned(record, 'controller_signature'),
  );
}

function resignIndependence(sample, index) {
  const record = sample.members[index].independence_attestation;
  record.signature = sign(
    sample.independencePrivateKey,
    INDEPENDENCE_DOMAIN,
    INDEPENDENCE_ROLE,
    unsigned(record, 'signature'),
  );
}

function reviewClaims(sample) {
  const verification = verifyReviewSetEvidence({
    expected_specification_root: ROOT,
    members: sample.members,
    authority: sample.reviewAuthority,
    at: VERIFICATION_TIME,
  });
  assert.equal(verification.valid, true);
  return evaluateAcceptanceClaims({
    gate_id: 'G0_EXACT_DIGEST_REVIEW_SET',
    evidence: {
      review_set_evidence_id: verification.evidence_id,
      reviewed_root: ROOT,
    },
    context: {
      specificationRoot: ROOT,
      codeCommit: COMMIT,
      environment: 'PRODUCTION',
      expectedSpecificationRoot: ROOT,
      expectedCodeCommit: COMMIT,
      expectedEnvironment: 'PRODUCTION',
      observed_at: OBSERVED_AT,
      clock: { now: () => VERIFICATION_TIME },
      immutableMembers: sample.members.flatMap((member) => [
        {
          member_id: `controller:${member.lane_id}`,
          member_type: 'TrustedReviewControllerRecord',
          payload: member.controller_record,
        },
        {
          member_id: `independence:${member.lane_id}`,
          member_type: 'ReviewerIndependenceAttestation',
          payload: member.independence_attestation,
        },
      ]),
      keyRegistry: sample.keyRegistry,
      verifySignature: require('../../lib/programme-gates/signatures').verifySignature,
      domainDigest,
    },
  });
}

test('the legal-semantic lane accepts the frozen Fable profile while other lanes remain Sol', () => {
  const sample = fixture();
  const legalIndex = sample.members.findIndex((member) => member.lane_id === 'LEGAL_SEMANTIC');
  sample.members[legalIndex].controller_record.exact_model_identifier =
    'fable-legal-reviewer';
  sample.members[legalIndex].controller_record.reasoning_level = 'provider_default';
  resignController(sample, legalIndex);
  assert.deepEqual(
    reviewClaims(sample).map((claim) => claim.typed_value),
    [true, true, true, true],
  );
});

test('the exact-review predicate rejects a signed but under-enumerated Git authorship set', () => {
  const sample = fixture();
  const independence = sample.members[0].independence_attestation;
  independence.source_control_authorship_events =
    independence.source_control_authorship_events.slice(0, 1);
  independence.source_control_authorship_event_set_root = domainDigest(
    'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
    independence.source_control_authorship_events,
  );
  resignIndependence(sample, 0);
  assert.ok(reviewClaims(sample).some((claim) => claim.typed_value === false));
});

function testResult(testId) {
  return {
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: testId,
    code_commit: COMMIT,
    environment: 'PRODUCTION',
    command_digest: 'f'.repeat(64),
    executable_digest: expectedTestExecutableDigest(testId),
    started_at: '2026-07-28T11:30:00.000Z',
    completed_at: '2026-07-28T11:45:00.000Z',
    exit_code: 0,
    output_digest: '2'.repeat(64),
  };
}

function readiness(sample = fixture()) {
  return buildReviewApprovalReadiness({
    authority: createReviewApprovalReadinessAuthority({
      specificationRoot: ROOT,
      codeCommit: COMMIT,
      environment: 'PRODUCTION',
      observedAt: OBSERVED_AT,
      verificationTime: VERIFICATION_TIME,
    }),
    reviewSet: {
      members: sample.members,
      authority: sample.reviewAuthority,
    },
    benApproval: {
      record: sample.approvalRecord,
      authority: sample.benAuthority,
    },
    gateTestResult: testResult('GATE-01'),
    reviewContextTestResult: testResult('REVIEW-CONTEXT-01'),
  });
}

function signingAuthority(sample) {
  return createReviewApprovalSigningAuthority({
    keyRegistry: sample.keyRegistry,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest: VALIDATOR_DIGEST,
    validatorKeyId: 'EVIDENCE_KEY',
    verificationTime: VERIFICATION_TIME,
    reviewSetAuthority: sample.reviewAuthority,
    benApprovalAuthority: sample.benAuthority,
  });
}

function evidenceSignature(request, privateKey) {
  return crypto.sign(
    null,
    Buffer.from(request.signing_frame_base64, 'base64'),
    privateKey,
  ).toString('base64');
}

test('verified review and Ben approval become two exact unsigned readiness candidates', () => {
  const bundle = readiness();
  assert.deepEqual(bundle.candidates.map((candidate) => candidate.gate_id), REVIEW_GATE_ORDER);
  assert.equal(bundle.readiness_state, 'READY_FOR_SIGNATURE');
  assert.equal(bundle.formal_gate_state, 'OPEN');
  assert.equal(bundle.private_key_used, false);
  assert.equal(bundle.status_publication_attempted, false);
  assert.deepEqual(
    bundle.candidates.map((candidate) => (
      candidate.test_results.map((entry) => entry.test_id)
    )),
    [
      ['GATE-01', 'REVIEW-CONTEXT-01'],
      ['GATE-01'],
    ],
  );
  assert.ok(bundle.candidates.every(
    (candidate) => candidate.exact_acceptance_claims.every(
      (claim) => claim.typed_value === true,
    ),
  ));
});

test('the exact-review predicate rejects an unallowlisted task context after valid signatures', () => {
  const sample = fixture();
  const record = sample.members[0].controller_record;
  record.controller_supplied_input_manifest.output_schema.schema_id = 'InjectedOutput/V1';
  record.controller_supplied_input_manifest_digest = domainDigest(
    'PROGRAMME_GATE_REVIEW_TASK_MANIFEST/V1',
    record.controller_supplied_input_manifest,
  );
  record.exact_input_context_digest = domainDigest(
    'PROGRAMME_GATE_REVIEW_EXACT_INPUT_CONTEXT/V1',
    {
      context_version: 'TrustedReviewExactInputContext/V1',
      task_manifest_digest: record.controller_supplied_input_manifest_digest,
      exact_specification_root: ROOT,
      frozen_specification_manifest_digest:
        record.controller_supplied_input_manifest.frozen_specification.manifest_digest,
      registered_prompt_digest:
        record.controller_supplied_input_manifest.registered_prompt.payload_digest,
      output_schema_digest:
        record.controller_supplied_input_manifest.output_schema.payload_digest,
      fixed_runtime_context_digest: record.fixed_controller_runtime_context_digest,
    },
  );
  record.input_context_digest_before_review = record.exact_input_context_digest;
  record.input_context_digest_after_review = record.exact_input_context_digest;
  sample.members[0].independence_attestation.exact_input_context_digest =
    record.exact_input_context_digest;
  resignController(sample, 0);
  resignIndependence(sample, 0);
  assert.ok(reviewClaims(sample).every((claim) => claim.typed_value === false));
});

test('the exact-review predicate rejects reused task IDs and non-concurrent lanes', () => {
  const reused = fixture();
  reused.members[1].controller_record.immutable_task_id =
    reused.members[0].controller_record.immutable_task_id;
  resignController(reused, 1);
  assert.ok(reviewClaims(reused).every((claim) => claim.typed_value === false));

  const sequential = fixture();
  sequential.members[0].controller_record.review_start_time =
    '2026-07-28T11:00:00.000Z';
  sequential.members[0].controller_record.review_end_time =
    '2026-07-28T11:30:00.000Z';
  resignController(sequential, 0);
  assert.ok(reviewClaims(sequential).every((claim) => claim.typed_value === false));
});

test('both externally signed review envelopes pass the complete validator', () => {
  const sample = fixture();
  const bundle = readiness(sample);
  const authority = signingAuthority(sample);
  for (const candidate of bundle.candidates) {
    const signingRequest = buildReviewApprovalSigningRequest({
      authority,
      bundle,
      candidate,
    });
    const result = preflightReviewApprovalSignature({
      authority,
      bundle,
      candidate,
      signingRequest,
      signature: evidenceSignature(signingRequest, sample.evidencePrivateKey),
    });
    assert.equal(result.evidence_validation.valid, true);
    assert.equal(result.evidence_validation.state, 'PASS');
    assert.equal(result.signed_envelope.gate_id, candidate.gate_id);
    assert.equal(result.formal_gate_state, 'OPEN');
    assert.equal(result.status_publication_attempted, false);
  }
});

test('missing review lanes, invalid Ben links and future records fail readiness', () => {
  const missing = fixture();
  missing.members.pop();
  assert.throws(() => readiness(missing), /review set is OPEN/);

  const wrongLink = fixture();
  wrongLink.approvalRecord.passing_review_set_evidence_id = DIGEST_D;
  assert.throws(() => readiness(wrongLink), /Ben approval is OPEN/);

  const future = fixture();
  future.approvalRecord.approved_at = '2026-07-28T13:00:00.000Z';
  assert.throws(() => readiness(future), /newer than the evidence observation/);
});

test('member, verification, request and signature drift all fail closed', () => {
  const sample = fixture();
  const bundle = readiness(sample);
  const authority = signingAuthority(sample);
  const candidate = bundle.candidates[0];
  const signingRequest = buildReviewApprovalSigningRequest({
    authority,
    bundle,
    candidate,
  });
  const validSignature = evidenceSignature(signingRequest, sample.evidencePrivateKey);

  const badSignature = preflightReviewApprovalSignature({
    authority,
    bundle,
    candidate,
    signingRequest,
    signature: Buffer.alloc(64, 1).toString('base64'),
  });
  assert.equal(badSignature.evidence_validation.state, 'OPEN');

  const driftedRequest = structuredClone(signingRequest);
  driftedRequest.signing_frame_sha256 = '0'.repeat(64);
  assert.equal(preflightReviewApprovalSignature({
    authority,
    bundle,
    candidate,
    signingRequest: driftedRequest,
    signature: validSignature,
  }).evidence_validation.reason_code, 'SIGNING_REQUEST_MISMATCH');

  assert.equal(Object.hasOwn(bundle, 'verified_review_set'), false);
  assert.equal(Object.hasOwn(bundle, 'verified_ben_approval'), false);

  const driftedMemberBundle = structuredClone(bundle);
  driftedMemberBundle.candidates[0].members[0].payload.controller_signature = 'invalid';
  assert.throws(
    () => buildReviewApprovalSigningRequest({
      authority,
      bundle: driftedMemberBundle,
      candidate: driftedMemberBundle.candidates[0],
    }),
    /review set no longer verifies/,
  );
});

test('the review signing module exposes no private-key operation', () => {
  const exported = require('../../lib/programme-gates/review-signing');
  assert.deepEqual(Object.keys(exported).sort(), [
    'SIGNING_REQUEST_DOMAIN',
    'buildReviewApprovalSigningRequest',
    'createReviewApprovalSigningAuthority',
    'preflightReviewApprovalSignature',
    'recomputeReviewApprovalVerifications',
  ]);
});
