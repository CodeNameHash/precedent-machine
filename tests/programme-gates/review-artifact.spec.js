const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const { domainDigest, signatureBytes } = require('../../lib/programme-gates/bytes');
const { COLD_REVIEW_TASKS } = require('../../lib/programme-gates/cold-review-tasks');
const {
  CONTROLLER_DOMAIN,
  CONTROLLER_ROLE,
  EMPTY_REVIEWER_EDIT_SET_ROOT,
} = require('../../lib/programme-gates/review-evidence');
const {
  buildBenApproval,
  buildReviewSetInput,
} = require('../../lib/programme-gates/review-artifact');
const { REVIEW_LANES } = require('../../lib/programme-gates/registry');

const ROOT = 'a'.repeat(64);
const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const COMMIT = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: REPOSITORY_ROOT,
  encoding: 'utf8',
}).trim();
const VALIDATOR_DIGEST = 'c'.repeat(64);
const CONFIGURATION_DIGEST = 'd'.repeat(64);
const AT = '2026-07-28T12:00:00.000Z';

function keyEntry(keyId, keyPair, roles, domains) {
  return {
    key_id: keyId,
    algorithm: 'Ed25519',
    public_key_pem: keyPair.publicKey.export({
      type: 'spki',
      format: 'pem',
    }).toString(),
    permitted_roles: roles,
    permitted_domains: domains,
    valid_from: '2026-07-28T00:00:00.000Z',
    valid_until: '2026-07-29T00:00:00.000Z',
    revoked_at: null,
  };
}

function sign(key, domain, role, payload) {
  return crypto.sign(
    null,
    signatureBytes({ domain, role, payload }),
    key.privateKey,
  ).toString('base64');
}

function fixture() {
  const controller = crypto.generateKeyPairSync('ed25519');
  const validator = crypto.generateKeyPairSync('ed25519');
  const ben = crypto.generateKeyPairSync('ed25519');
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [
      keyEntry(
        'CONTROLLER_KEY',
        controller,
        ['REVIEW_CONTROLLER'],
        ['PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1'],
      ),
      keyEntry(
        'VALIDATOR_KEY',
        validator,
        ['VALIDATOR'],
        ['PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1'],
      ),
      keyEntry(
        'BEN_KEY',
        ben,
        ['BEN_APPROVER'],
        ['PROGRAMME_GATE_BEN_APPROVAL/V1'],
      ),
    ],
  };
  const reviews = REVIEW_LANES.map((lane, index) => {
    const task = COLD_REVIEW_TASKS.find((entry) => entry.lane_id === lane.lane_id);
    const reviewOutput = { disposition: 'PASS', findings: [] };
    const record = {
      schema_version: 'TrustedReviewControllerRecord/V1',
      controller_id: 'CODEX_CLI_REVIEW_CONTROLLER',
      controller_version: 'LOCAL_REVIEW_CONTROLLER/V1',
      review_runtime_version: 'codex-cli/0.145.0',
      review_runtime_binary_digest: '1'.repeat(64),
      fixed_controller_runtime_context_digest: `${index + 2}`.repeat(64),
      controller_supplied_input_manifest: {
        manifest_version: 'TrustedReviewTaskManifest/V1',
        lane_id: lane.lane_id,
        exact_specification_root: ROOT,
        frozen_specification: {
          manifest_id: 'codex-program-specification-manifest/v1',
          manifest_digest: '7'.repeat(64),
          file_count: 6,
          ordered_members: [
            'docs/codex-program/specification-manifest.json',
            'docs/CODEX-PROGRAM.md',
            'docs/codex-program/programme-gates.yaml',
            'docs/codex-program/bootstrap-acceptance-source.json',
            'docs/codex-program/canonical-contracts.md',
            'docs/codex-program/adversarial-tests.md',
          ].map((memberPath, memberIndex) => ({
            order: memberIndex + 1,
            path: memberPath,
            byte_length: 1,
            payload_digest: '7'.repeat(64),
            source_bytes_base64: 'YQ==',
          })),
          immutable: true,
        },
        registered_prompt: {
          prompt_id: lane.registered_prompt_id,
          path: `/tmp/g0-cold-review-artifact/${lane.lane_id.toLowerCase()}-lane/prompt.txt`,
          payload_digest: crypto.createHash('sha256').update(task.prompt).digest('hex'),
          byte_length: Buffer.byteLength(task.prompt),
          immutable: true,
          contains_prior_review_conclusions: false,
        },
        output_schema: {
          schema_id: 'ColdReviewOutput/V1',
          path:
            `/tmp/g0-cold-review-artifact/${lane.lane_id.toLowerCase()}-lane/output-schema.json`,
          payload_digest: '6'.repeat(64),
          byte_length: 1,
          source_bytes_base64: 'YQ==',
          immutable: true,
        },
      },
      fixed_controller_runtime_context: {
        context_version: 'TrustedReviewRuntimeContext/V1',
        review_runtime_binary_path: '/opt/homebrew/bin/codex',
        review_runtime_version: 'codex-cli/0.145.0',
        review_runtime_binary_digest: '1'.repeat(64),
        controller_run_root: '/tmp/g0-cold-review-artifact',
        lane_run_root: `/tmp/g0-cold-review-artifact/${lane.lane_id.toLowerCase()}-lane`,
        working_directory:
          `/tmp/g0-cold-review-artifact/${lane.lane_id.toLowerCase()}-lane/specification`,
        operating_system: 'darwin',
        architecture: 'arm64',
        home_path: `/tmp/g0-cold-review-artifact/${lane.lane_id.toLowerCase()}-lane/home`,
        codex_home_path:
          `/tmp/g0-cold-review-artifact/${lane.lane_id.toLowerCase()}-lane/codex-home`,
        tmpdir_path: `/tmp/g0-cold-review-artifact/${lane.lane_id.toLowerCase()}-lane/tmp`,
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
      cold_review_prompt_digest: crypto.createHash('sha256').update(task.prompt).digest('hex'),
      controller_supplied_input_manifest_digest: '8'.repeat(64),
      exact_input_context_digest: '9'.repeat(64),
      input_context_digest_before_review: '9'.repeat(64),
      input_context_digest_after_review: '9'.repeat(64),
      review_output_digest: domainDigest(
        'PROGRAMME_GATE_REVIEW_OUTPUT/V1',
        reviewOutput,
      ),
      review_start_time: '2026-07-28T10:00:00.000Z',
      review_end_time: '2026-07-28T10:30:00.000Z',
      reviewer_principal_id: `principal-${index}`,
      reviewer_source_control_identity_set: [`reviewer-${index}@example.test`],
      reviewer_disposition: 'PASS',
      reviewer_edit_set_root: EMPTY_REVIEWER_EDIT_SET_ROOT,
      parent_session_state: 'GENESIS',
      no_earlier_review_conclusions_were_inputs: true,
      nonce: `nonce-${index}`,
      signature_algorithm: 'Ed25519',
      controller_key_id: 'CONTROLLER_KEY',
    };
    return {
      lane_id: lane.lane_id,
      controller_record: {
        ...record,
        controller_signature: sign(
          controller,
          CONTROLLER_DOMAIN,
          CONTROLLER_ROLE,
          record,
        ),
      },
      review_output: reviewOutput,
    };
  });
  return {
    ben,
    bundle: {
      schema_version: 'ProgrammeGateColdReviewControllerBundle/V1',
      code_commit: COMMIT,
      specification_root: ROOT,
      reviews,
    },
    keyRegistry,
    validator,
  };
}

function reviewSet(sample) {
  return buildReviewSetInput({
    at: AT,
    bundle: sample.bundle,
    expectedCodeCommit: COMMIT,
    expectedSpecificationRoot: ROOT,
    keyRegistry: sample.keyRegistry,
    repositoryRoot: REPOSITORY_ROOT,
    signIndependence: (bytes) => (
      crypto.sign(null, bytes, sample.validator.privateKey).toString('base64')
    ),
    validatorConfigurationDigest: CONFIGURATION_DIGEST,
    validatorExecutableDigest: VALIDATOR_DIGEST,
    validatorKeyId: 'VALIDATOR_KEY',
  });
}

test('a closed passing review artefact becomes verified review and Ben approval inputs', () => {
  const sample = fixture();
  const review = reviewSet(sample);
  assert.equal(review.verification.valid, true);
  assert.equal(review.members.length, 5);

  const approval = buildBenApproval({
    approvedAt: AT,
    approvedRoot: ROOT,
    approverKeyId: 'BEN_KEY',
    keyRegistry: sample.keyRegistry,
    nonce: 'approval-1',
    passingReviewSetEvidenceId: review.verification.evidence_id,
    signApproval: (bytes) => (
      crypto.sign(null, bytes, sample.ben.privateKey).toString('base64')
    ),
    verificationTime: AT,
  });
  assert.equal(approval.verification.valid, true);
  assert.deepEqual(approval.record.conditions, []);
});

test('review preparation rejects a failed lane and reviewer authorship overlap', () => {
  const failed = fixture();
  failed.bundle.reviews[0].review_output.disposition = 'FAIL';
  assert.throws(() => reviewSet(failed), /not an exact passing cold review/);

  const overlap = fixture();
  overlap.bundle.reviews[0].controller_record.reviewer_source_control_identity_set = [
    'bengoodchild@gmail.com',
  ];
  assert.throws(() => reviewSet(overlap), /intersects reviewed-byte authorship/);
});
