const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { domainDigest, signatureBytes } = require('../../lib/programme-gates/bytes');
const { REVIEW_LANES } = require('../../lib/programme-gates/registry');
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
  projectBenApprovalEvidence,
  projectReviewSetAttestation,
  verifyBenApprovalEvidence,
  verifyReviewSetEvidence,
} = require('../../lib/programme-gates/review-evidence');

const ROOT = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const DIGEST_C = 'c'.repeat(64);
const DIGEST_D = 'd'.repeat(64);
const NOW = '2026-07-27T12:00:00.000Z';

function keys() {
  const controller = crypto.generateKeyPairSync('ed25519');
  const validator = crypto.generateKeyPairSync('ed25519');
  const ben = crypto.generateKeyPairSync('ed25519');
  const records = [
    ['CONTROLLER_KEY', controller.publicKey, [CONTROLLER_ROLE], [CONTROLLER_DOMAIN]],
    ['VALIDATOR_KEY', validator.publicKey, [INDEPENDENCE_ROLE], [INDEPENDENCE_DOMAIN]],
    ['BEN_KEY', ben.publicKey, [BEN_APPROVAL_ROLE], [BEN_APPROVAL_DOMAIN]],
  ].map(([key_id, publicKey, permitted_roles, permitted_domains]) => ({
    key_id,
    algorithm: 'Ed25519',
    public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
    permitted_roles,
    permitted_domains,
    valid_from: '2026-07-27T00:00:00.000Z',
    valid_until: '2026-07-28T00:00:00.000Z',
    revoked_at: null,
  }));
  return {
    private: {
      CONTROLLER_KEY: controller.privateKey,
      VALIDATOR_KEY: validator.privateKey,
      BEN_KEY: ben.privateKey,
    },
    registry: {
      schema_version: 'TrustedProgrammeGatePublicKeys/V1',
      registry_state: 'ACTIVE',
      keys: records,
    },
  };
}

function sign(privateKey, domain, role, payload) {
  return crypto.sign(
    null,
    signatureBytes({ domain, role, payload }),
    privateKey,
  ).toString('base64');
}

function fixture() {
  const keySet = keys();
  const authority = {
    key_registry: keySet.registry,
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
      validator_key_id: 'VALIDATOR_KEY',
    }],
    fable_model_identifiers: ['fable-legal-reviewer'],
    other_lane_model_identifiers: ['gpt-5.6-sol'],
  };
  const members = REVIEW_LANES.map((lane, index) => {
    const controller = {
      schema_version: 'TrustedReviewControllerRecord/V1',
      controller_id: 'CODEX_CLI_REVIEW_CONTROLLER',
      controller_version: '1.0.0',
      review_runtime_version: 'codex-cli/0.145.0',
      review_runtime_binary_digest: DIGEST_B,
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
          path: `/tmp/g0-cold-review-evidence/${lane.lane_id.toLowerCase()}-lane/prompt.txt`,
          payload_digest: DIGEST_D,
          byte_length: 1,
          immutable: true,
          contains_prior_review_conclusions: false,
        },
        output_schema: {
          schema_id: 'ColdReviewOutput/V1',
          path:
            `/tmp/g0-cold-review-evidence/${lane.lane_id.toLowerCase()}-lane/output-schema.json`,
          payload_digest: DIGEST_D,
          byte_length: 1,
          immutable: true,
        },
      },
      fixed_controller_runtime_context: {
        context_version: 'TrustedReviewRuntimeContext/V1',
        review_runtime_binary_path: '/opt/homebrew/bin/codex',
        review_runtime_version: 'codex-cli/0.145.0',
        review_runtime_binary_digest: DIGEST_B,
        controller_run_root: '/tmp/g0-cold-review-evidence',
        lane_run_root: `/tmp/g0-cold-review-evidence/${lane.lane_id.toLowerCase()}-lane`,
        working_directory:
          `/tmp/g0-cold-review-evidence/${lane.lane_id.toLowerCase()}-lane/specification`,
        operating_system: 'darwin',
        architecture: 'arm64',
        home_path: `/tmp/g0-cold-review-evidence/${lane.lane_id.toLowerCase()}-lane/home`,
        codex_home_path:
          `/tmp/g0-cold-review-evidence/${lane.lane_id.toLowerCase()}-lane/codex-home`,
        tmpdir_path: `/tmp/g0-cold-review-evidence/${lane.lane_id.toLowerCase()}-lane/tmp`,
        path_value: '/opt/homebrew/bin:/usr/bin:/bin',
        lang: 'en_US.UTF-8',
        lc_all: 'en_US.UTF-8',
        term: 'dumb',
      },
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
      review_start_time: '2026-07-27T10:00:00.000Z',
      review_end_time: '2026-07-27T10:30:00.000Z',
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
    controller.controller_signature = sign(
      keySet.private.CONTROLLER_KEY,
      CONTROLLER_DOMAIN,
      CONTROLLER_ROLE,
      Object.fromEntries(
        Object.entries(controller).filter(([key]) => key !== 'controller_signature'),
      ),
    );
    const independence = {
      schema_version: 'ReviewerIndependenceAttestation/V1',
      reviewer_principal_id: controller.reviewer_principal_id,
      immutable_session_id: controller.immutable_session_id,
      session_parent_or_genesis: 'GENESIS',
      exact_input_context_digest: controller.exact_input_context_digest,
      reviewed_code_commit: 'f'.repeat(40),
      source_control_history_scope: 'ALL_REFS_FROM_REPOSITORY_GENESIS',
      source_control_authorship_events: [{
        commit_id: `${index + 1}`.repeat(40),
        identity_set: ['Ben Goodchild', 'bengoodchild@gmail.com'],
      }],
      source_control_authorship_event_set_root: '',
      prior_conclusion_input_set: [],
      authoring_event_intersection_root: EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT,
      prior_conclusion_intersection_root: EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT,
      reviewer_edit_set_root: EMPTY_REVIEWER_EDIT_SET_ROOT,
      validator_executable_digest: DIGEST_B,
      validator_configuration_digest: DIGEST_C,
      validator_key_id: 'VALIDATOR_KEY',
      signature_algorithm: 'Ed25519',
      signature: '',
    };
    independence.source_control_authorship_event_set_root = domainDigest(
      'PROGRAMME_GATE_SOURCE_CONTROL_AUTHORSHIP_EVENT_SET_ROOT/V1',
      independence.source_control_authorship_events,
    );
    independence.signature = sign(
      keySet.private.VALIDATOR_KEY,
      INDEPENDENCE_DOMAIN,
      INDEPENDENCE_ROLE,
      Object.fromEntries(Object.entries(independence).filter(([key]) => key !== 'signature')),
    );
    return {
      lane_id: lane.lane_id,
      controller_record: controller,
      independence_attestation: independence,
    };
  });
  return { authority, keySet, members };
}

function verifyReview(sample) {
  return verifyReviewSetEvidence({
    expected_specification_root: ROOT,
    members: sample.members,
    authority: sample.authority,
    at: NOW,
  });
}

test('five signed cold lanes and independence attestations produce one reviewed evidence ID', () => {
  const result = verifyReview(fixture());
  assert.equal(result.state, 'PASS');
  assert.equal(result.facts.reviewed_root, ROOT);
  assert.deepEqual(result.facts.lane_ids, REVIEW_LANES.map((lane) => lane.lane_id));
  assert.match(result.evidence_id, /^[a-f0-9]{64}$/);
  assert.deepEqual(projectReviewSetAttestation(result), {
    review_set_evidence_id: result.evidence_id,
    reviewed_root: ROOT,
  });
});

test('missing, duplicate, boolean-substitute and reused review members stay OPEN', () => {
  const missing = fixture();
  missing.members.pop();
  assert.equal(verifyReview(missing).state, 'OPEN');

  const duplicate = fixture();
  duplicate.members[4] = duplicate.members[3];
  assert.equal(verifyReview(duplicate).state, 'OPEN');

  const booleanSubstitute = fixture();
  booleanSubstitute.members[0] = {
    lane_id: 'ARCHITECTURE',
    eligible_reviewer: true,
    independence_pass: true,
  };
  assert.equal(verifyReview(booleanSubstitute).state, 'OPEN');

  const reused = fixture();
  reused.members[1].controller_record.nonce = reused.members[0].controller_record.nonce;
  assert.equal(verifyReview(reused).state, 'OPEN');
});

test('wrong root, Sol reasoning, signatures and non-empty independence roots stay OPEN', () => {
  for (const mutate of [
    (sample) => { sample.members[0].controller_record.exact_specification_root = DIGEST_B; },
    (sample) => { sample.members[1].controller_record.reasoning_level = 'high'; },
    (sample) => { sample.members[2].controller_record.controller_signature = 'invalid'; },
    (sample) => { sample.members[3].independence_attestation.signature = 'invalid'; },
    (sample) => { sample.members[4].independence_attestation.authoring_event_intersection_root = DIGEST_D; },
  ]) {
    const sample = fixture();
    mutate(sample);
    assert.equal(verifyReview(sample).state, 'OPEN');
  }
});

function benRecord(sample, passingReviewSetId, overrides = {}) {
  const record = {
    schema_version: 'BenSpecificationApproval/V1',
    approved_root: ROOT,
    passing_review_set_evidence_id: passingReviewSetId,
    approver_identity: 'BEN_GOODCHILD',
    conditions: [],
    approved_at: '2026-07-27T11:00:00.000Z',
    nonce: 'ben-approval-1',
    signature_algorithm: 'Ed25519',
    approver_key_id: 'BEN_KEY',
    signature: '',
    ...overrides,
  };
  record.signature = sign(
    sample.keySet.private.BEN_KEY,
    BEN_APPROVAL_DOMAIN,
    BEN_APPROVAL_ROLE,
    Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'signature')),
  );
  return record;
}

test('Ben approval must be signed, unconditional and bound to the passing review set', () => {
  const sample = fixture();
  const review = verifyReview(sample);
  const record = benRecord(sample, review.evidence_id);
  const result = verifyBenApprovalEvidence({
    record,
    expected_specification_root: ROOT,
    passing_review_set_evidence_id: review.evidence_id,
    authority: { key_registry: sample.keySet.registry },
    at: NOW,
  });
  assert.equal(result.state, 'PASS');
  assert.equal(result.facts.passing_review_set_evidence_id, review.evidence_id);
  assert.deepEqual(projectBenApprovalEvidence(result, record), {
    approval_evidence_id: result.evidence_id,
    approved_root: ROOT,
    passing_review_set_evidence_id: review.evidence_id,
    conditions: [],
  });

  for (const changed of [
    { record: benRecord(sample, review.evidence_id, { conditions: ['subject to changes'] }) },
    { record: { ...record, signature: 'invalid' } },
    { record: benRecord(sample, DIGEST_B) },
    { record: { ...record, ben_identity_verified: true } },
  ]) {
    assert.equal(verifyBenApprovalEvidence({
      ...changed,
      expected_specification_root: ROOT,
      passing_review_set_evidence_id: review.evidence_id,
      authority: { key_registry: sample.keySet.registry },
      at: NOW,
    }).state, 'OPEN');
  }
});

test('only passing verification results can enter formal evidence projections', () => {
  assert.throws(
    () => projectReviewSetAttestation({ valid: false, state: 'OPEN' }),
    /passing review-set verification/,
  );
  assert.throws(
    () => projectBenApprovalEvidence({ valid: false, state: 'OPEN' }, {}),
    /passing Ben approval verification/,
  );
});
