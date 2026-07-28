const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { signatureBytes } = require('../../lib/programme-gates/bytes');
const {
  REGISTRY_DIGESTS,
  REVIEW_LANES,
} = require('../../lib/programme-gates/registry');
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

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
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
      controller_version: '1.0.0',
    }],
    allowed_runtimes: [{
      review_runtime_version: 'codex-cli/0.145.0',
      review_runtime_binary_digest: DIGEST_B,
      fixed_controller_runtime_context_digest: DIGEST_C,
    }],
    allowed_prompts: REVIEW_LANES.map((lane) => ({
      lane_id: lane.lane_id,
      registered_prompt_id: lane.registered_prompt_id,
      cold_review_prompt_digest: DIGEST_D,
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
      controller_version: '1.0.0',
      review_runtime_version: 'codex-cli/0.145.0',
      review_runtime_binary_digest: DIGEST_B,
      fixed_controller_runtime_context_digest: DIGEST_C,
      exact_specification_root: ROOT,
      exact_model_identifier: 'gpt-5.6-sol',
      reasoning_level: 'xhigh',
      immutable_task_id: `task-${index}`,
      immutable_session_id: `session-${index}`,
      immutable_review_id: `review-${index}`,
      registered_prompt_id: lane.registered_prompt_id,
      cold_review_prompt_digest: DIGEST_D,
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
      authoring_event_intersection_root: EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT,
      prior_conclusion_intersection_root: EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT,
      reviewer_edit_set_root: EMPTY_REVIEWER_EDIT_SET_ROOT,
      validator_executable_digest: DIGEST_B,
      validator_configuration_digest: DIGEST_C,
      validator_key_id: 'INDEPENDENCE_KEY',
      signature_algorithm: 'Ed25519',
      signature: '',
    };
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
    evidencePrivateKey: evidence.privateKey,
    keyRegistry,
    members,
    reviewAuthority,
  };
}

function testResult(testId) {
  return {
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: testId,
    code_commit: COMMIT,
    environment: 'PRODUCTION',
    command_digest: 'f'.repeat(64),
    executable_digest: '1'.repeat(64),
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

  const driftedBundle = structuredClone(bundle);
  driftedBundle.verified_review_set.reviewed_root = DIGEST_D;
  assert.throws(
    () => buildReviewApprovalSigningRequest({
      authority,
      bundle: driftedBundle,
      candidate: driftedBundle.candidates[0],
    }),
    /verification facts have drifted/,
  );

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
  ]);
});
