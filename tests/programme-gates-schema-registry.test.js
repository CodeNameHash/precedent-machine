const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  SCHEMA_IDS,
  schemaFor,
  validateSchema,
} = require('../lib/programme-gates/schema-registry');
const {
  ACCEPTANCE_DEFINITION_DESCRIPTORS,
  REGISTRY_DIGESTS,
  REVIEWER_PROFILES,
  REVIEW_LANE_REGISTRY,
  REVIEW_LANES,
  TRUSTED_PUBLIC_KEY_REGISTRY,
  VALIDATOR_CONFIGURATION,
  acceptanceDescriptorForContract,
} = require('../lib/programme-gates/registry');

const DIGEST = 'a'.repeat(64);

function controllerRecord() {
  return {
    schema_version: 'TrustedReviewControllerRecord/V1',
    controller_id: 'GITHUB_REVIEW_CONTROLLER',
    controller_version: '1.0.0',
    review_runtime_version: 'codex-cli/0.145.0',
    review_runtime_binary_digest: DIGEST,
    fixed_controller_runtime_context_digest: DIGEST,
    controller_supplied_input_manifest: {
      manifest_version: 'TrustedReviewTaskManifest/V1',
      lane_id: 'LEGAL_SEMANTIC',
      exact_specification_root: DIGEST,
      frozen_specification: {
        manifest_id: 'codex-program-specification-manifest/v1',
        manifest_digest: DIGEST,
        file_count: 6,
        immutable: true,
      },
      registered_prompt: {
        prompt_id: 'COLD_LEGAL_SEMANTIC_REVIEW/V1',
        path: '/tmp/prompt.txt',
        payload_digest: DIGEST,
        byte_length: 1,
        immutable: true,
        contains_prior_review_conclusions: false,
      },
      output_schema: {
        schema_id: 'ColdReviewOutput/V1',
        path: '/tmp/output.json',
        payload_digest: DIGEST,
        byte_length: 1,
        immutable: true,
      },
    },
    fixed_controller_runtime_context: {
      context_version: 'TrustedReviewRuntimeContext/V1',
      review_runtime_binary_path: '/opt/homebrew/bin/codex',
      review_runtime_version: 'codex-cli/0.145.0',
      review_runtime_binary_digest: DIGEST,
      controller_run_root: '/tmp/g0-cold-review-schema',
      lane_run_root: '/tmp/g0-cold-review-schema/legal_semantic-lane',
      working_directory: '/tmp/g0-cold-review-schema/legal_semantic-lane/specification',
      operating_system: 'darwin',
      architecture: 'arm64',
      home_path: '/tmp/g0-cold-review-schema/legal_semantic-lane/home',
      codex_home_path: '/tmp/g0-cold-review-schema/legal_semantic-lane/codex-home',
      tmpdir_path: '/tmp/g0-cold-review-schema/legal_semantic-lane/tmp',
      path_value: '/opt/homebrew/bin:/usr/bin:/bin',
      lang: 'en_US.UTF-8',
      lc_all: 'en_US.UTF-8',
      term: 'dumb',
    },
    exact_specification_root: DIGEST,
    exact_model_identifier: 'gpt-5.6-sol',
    reasoning_level: 'xhigh',
    immutable_task_id: 'task-1',
    immutable_session_id: 'session-1',
    immutable_review_id: 'review-1',
    registered_prompt_id: 'COLD_LEGAL_SEMANTIC_REVIEW/V1',
    cold_review_prompt_digest: DIGEST,
    controller_supplied_input_manifest_digest: DIGEST,
    exact_input_context_digest: DIGEST,
    input_context_digest_before_review: DIGEST,
    input_context_digest_after_review: DIGEST,
    review_output_digest: DIGEST,
    review_start_time: '2026-07-27T10:00:00.000Z',
    review_end_time: '2026-07-27T10:30:00.000Z',
    reviewer_principal_id: 'controller-run-1/session-1',
    reviewer_source_control_identity_set: ['reviewer@example.test'],
    reviewer_disposition: 'PASS',
    reviewer_edit_set_root: DIGEST,
    parent_session_state: 'GENESIS',
    no_earlier_review_conclusions_were_inputs: true,
    nonce: 'run-1-review-1',
    signature_algorithm: 'Ed25519',
    controller_key_id: 'TEST_REVIEW_CONTROLLER_KEY',
    controller_signature: Buffer.alloc(64, 1).toString('base64'),
  };
}

test('the schema registry is closed and rejects unknown schema IDs', () => {
  assert.deepEqual(SCHEMA_IDS, VALIDATOR_CONFIGURATION.schema_registry_ids);
  assert.equal(SCHEMA_IDS.length, 31);
  for (const schemaId of SCHEMA_IDS) {
    assert.equal(schemaFor(schemaId).$id, schemaId);
    assert.equal(schemaFor(schemaId).additionalProperties, false);
  }
  assert.throws(() => schemaFor('ProgrammeGateEvidenceEnvelope/V3'), /unknown programme-gate schema ID/);
  assert.throws(() => validateSchema('InventedSchema/V1', {}), /unknown programme-gate schema ID/);
});

test('the controller schema includes fixed runtime context and rejects missing or extra fields', () => {
  const record = controllerRecord();
  assert.equal(validateSchema('TrustedReviewControllerRecord/V1', record), true);

  const missingRuntimeDigest = { ...record };
  delete missingRuntimeDigest.review_runtime_binary_digest;
  assert.throws(
    () => validateSchema('TrustedReviewControllerRecord/V1', missingRuntimeDigest),
    /review_runtime_binary_digest/,
  );

  assert.throws(
    () => validateSchema('TrustedReviewControllerRecord/V1', {
      ...record,
      provider_attested_model_build: true,
    }),
    /additional properties/,
  );
  assert.throws(
    () => validateSchema('TrustedReviewControllerRecord/V1', {
      ...record,
      no_earlier_review_conclusions_were_inputs: false,
    }),
    /must be equal to constant/,
  );
});

test('nested programme status rows are closed', () => {
  const status = {
    schema_version: 'ProgrammeGateStatusArtefact/V2',
    specification_root: DIGEST,
    code_commit: 'b'.repeat(40),
    environment: 'STAGING',
    generation: 1,
    predecessor_status_id: 'NONE',
    gate_registry_digest: DIGEST,
    ordered_gate_projection: [{
      gate_id: 'G0_MARKET_STATS_CONTAINED',
      state: 'OPEN',
      evidence_envelope_id: null,
      evidence_payload_digest: null,
    }],
    ordered_work_class_projection: [{
      work_class: 'canonical_work_start',
      state: 'OPEN',
    }],
    validator_executable_digest: DIGEST,
    validator_configuration_digest: DIGEST,
    validator_key_id: 'TEST_VALIDATOR_KEY',
    signature_algorithm: 'Ed25519',
    signature: Buffer.alloc(64, 2).toString('base64'),
  };

  assert.equal(validateSchema('ProgrammeGateStatusArtefact/V2', status), true);
  assert.throws(
    () => validateSchema('ProgrammeGateStatusArtefact/V2', {
      ...status,
      ordered_gate_projection: [{
        ...status.ordered_gate_projection[0],
        owner_deemed: true,
      }],
    }),
    /additional properties/,
  );
});

test('the ten G0 and pre-bundle P1 bootstrap descriptors are active', () => {
  assert.equal(ACCEPTANCE_DEFINITION_DESCRIPTORS.length, 11);
  assert.equal(
    new Set(ACCEPTANCE_DEFINITION_DESCRIPTORS.map((entry) => entry.evidence_contract)).size,
    11,
  );
  assert.deepEqual(
    ACCEPTANCE_DEFINITION_DESCRIPTORS
      .filter((entry) => entry.activation_state === 'ACTIVE')
      .map((entry) => entry.gate_id),
    [
      'G0_MARKET_STATS_CONTAINED',
      'G0_BROAD_CORPUS_ROUTES_CONTAINED',
      'G0_ZAYO_DISPOSITION',
      'G0_CLAUDE_CREDENTIAL_ROTATION',
      'G0_SUPABASE_SECRET_DISPOSITION',
      'G0_STAGING_SUPABASE_ISOLATED',
      'G0_STAGING_VERCEL_ISOLATED',
      'G0_STAGING_ACCESS_PROTECTED',
      'G0_EXACT_DIGEST_REVIEW_SET',
      'G0_BEN_SPEC_APPROVAL',
      'P1_CONTRACT_FREEZE_ATTESTED',
    ],
  );
  assert.equal(
    acceptanceDescriptorForContract('route-disabled-code-test-live-response/v1').gate_id,
    'G0_MARKET_STATS_CONTAINED',
  );
  assert.throws(() => acceptanceDescriptorForContract('unknown/v1'), /unknown or ambiguous/);
});

test('trust configuration contains only the four approved public signing keys', () => {
  assert.equal(validateSchema(
    'ProgrammeGateValidatorConfiguration/V1',
    VALIDATOR_CONFIGURATION,
  ), true);
  assert.equal(validateSchema(
    'TrustedProgrammeGatePublicKeys/V1',
    TRUSTED_PUBLIC_KEY_REGISTRY,
  ), true);
  assert.equal(validateSchema(
    'ProgrammeGateReviewLaneRegistry/V1',
    REVIEW_LANE_REGISTRY,
  ), true);
  assert.equal(TRUSTED_PUBLIC_KEY_REGISTRY.registry_state, 'ACTIVE');
  assert.deepEqual(
    TRUSTED_PUBLIC_KEY_REGISTRY.keys.map((key) => key.key_id),
    [
      'PROGRAMME_GATE_VALIDATOR_2026_07',
      'PROGRAMME_STATUS_PUBLISHER_2026_07',
      'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07',
      'PROGRAMME_GATE_BEN_APPROVER_2026_07',
    ],
  );
  assert.deepEqual(
    TRUSTED_PUBLIC_KEY_REGISTRY.keys.map((key) => key.permitted_domains),
    [
      [
        'PROGRAMME_GATE_EVIDENCE/V2',
        'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1',
        'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT/V1',
      ],
      ['PROGRAMME_GATE_STATUS/V2', 'PROGRAMME_GATE_PUBLICATION_HEAD/V1'],
      [
        'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1',
        'PROGRAMME_GATE_CONTRACT_DIFF_REVIEW/V1',
      ],
      [
        'PROGRAMME_GATE_BEN_APPROVAL/V1',
        'PROGRAMME_GATE_CONTRACT_FREEZE_APPROVAL/V1',
      ],
    ],
  );
  assert.deepEqual(
    TRUSTED_PUBLIC_KEY_REGISTRY.keys.map((key) => key.permitted_roles),
    [
      ['VALIDATOR'],
      ['STATUS_PUBLISHER', 'VALIDATOR'],
      ['REVIEW_CONTROLLER'],
      ['BEN_APPROVER'],
    ],
  );
  for (const key of TRUSTED_PUBLIC_KEY_REGISTRY.keys) {
    assert.equal(crypto.createPublicKey(key.public_key_pem).asymmetricKeyType, 'ed25519');
    assert.equal(key.valid_from, '2026-07-28T07:08:01.000Z');
    assert.equal(key.valid_until, '2026-10-26T07:08:01.000Z');
    assert.equal(key.revoked_at, null);
    assert.equal(key.public_key_pem.includes('PRIVATE KEY'), false);
  }
  assert.deepEqual(
    REVIEW_LANES.map((lane) => lane.lane_id),
    ['ARCHITECTURE', 'LEGAL_SEMANTIC', 'QUERY_EFFICIENCY', 'OPEN_WORLD', 'RELEASE_PROPAGATION'],
  );
  assert.deepEqual(REVIEWER_PROFILES.SOL_5_6_EXTRA_HIGH_ELIGIBLE, {
    reviewer_identity_class: 'OPENAI_MODEL',
    exact_model_identifier: 'gpt-5.6-sol',
    exact_reasoning_level: 'xhigh',
  });
  for (const value of Object.values(REGISTRY_DIGESTS)) assert.match(value, /^[a-f0-9]{64}$/);
});
