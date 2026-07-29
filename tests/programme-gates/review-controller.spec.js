const assert = require('node:assert/strict');
const test = require('node:test');

const { domainDigest, signatureBytes } = require('../../lib/programme-gates/bytes');
const { validateSchema } = require('../../lib/programme-gates/schema-registry');
const {
  CONTROLLER_RECORD_DOMAIN,
  CONTROLLER_RECORD_PAYLOAD_DOMAIN,
  CONTROLLER_RECORD_ROLE,
  EMPTY_REVIEW_EDIT_SET_ROOT,
  MODEL_IDENTIFIER,
  REASONING_LEVEL,
  buildTrustedReviewPlan,
  buildUnsignedTrustedReviewControllerRecord,
  validateTrustedReviewPlan,
} = require('../../lib/programme-gates/review-controller');

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const DIGEST_C = 'c'.repeat(64);
const DIGEST_D = 'd'.repeat(64);

function taskManifest(overrides = {}) {
  return {
    manifest_version: 'TrustedReviewTaskManifest/V1',
    lane_id: 'LEGAL_SEMANTIC',
    exact_specification_root: DIGEST_A,
    frozen_specification: {
      manifest_id: 'canonical-specification-root/v1',
      manifest_digest: DIGEST_B,
      file_count: 5,
      immutable: true,
    },
    registered_prompt: {
      prompt_id: 'COLD_LEGAL_SEMANTIC_REVIEW/V1',
      path: '/immutable/review/legal-semantic.txt',
      payload_digest: DIGEST_C,
      byte_length: 512,
      immutable: true,
      contains_prior_review_conclusions: false,
    },
    output_schema: {
      schema_id: 'ColdReviewOutput/V1',
      path: '/immutable/review/output-schema.json',
      payload_digest: DIGEST_D,
      byte_length: 256,
      immutable: true,
    },
    ...overrides,
  };
}

function runtimeContext(overrides = {}) {
  return {
    context_version: 'TrustedReviewRuntimeContext/V1',
    review_runtime_binary_path: '/opt/homebrew/bin/codex',
    review_runtime_version: 'codex-cli/0.145.0',
    review_runtime_binary_digest: DIGEST_D,
    controller_run_root: '/private/tmp/g0-cold-review-test',
    lane_run_root: '/private/tmp/g0-cold-review-test/legal_semantic-lane',
    working_directory: '/private/tmp/g0-cold-review-test/legal_semantic-lane/specification',
    operating_system: 'darwin',
    architecture: 'arm64',
    home_path: '/private/tmp/g0-cold-review-test/legal_semantic-lane/home',
    codex_home_path: '/private/tmp/g0-cold-review-test/legal_semantic-lane/codex-home',
    tmpdir_path: '/private/tmp/g0-cold-review-test/legal_semantic-lane/tmp',
    path_value: '/opt/homebrew/bin:/usr/bin:/bin',
    lang: 'C.UTF-8',
    lc_all: 'C.UTF-8',
    term: 'dumb',
    ...overrides,
  };
}

function planInput(overrides = {}) {
  return {
    controller_version: '1.0.0',
    controller_run_id: 'controller-run-1',
    immutable_task_id: 'task-legal-1',
    nonce: 'nonce-legal-1',
    controller_key_id: 'REVIEW_CONTROLLER_KEY',
    task_manifest: taskManifest(),
    runtime_context: runtimeContext(),
    ...overrides,
  };
}

function observation(plan, overrides = {}) {
  return {
    immutable_session_id: 'session-1',
    immutable_review_id: 'review-1',
    review_start_time: '2026-07-27T10:00:00.000Z',
    review_end_time: '2026-07-27T10:30:00.000Z',
    input_context_digest_before_review: plan.exact_input_context_digest,
    input_context_digest_after_review: plan.exact_input_context_digest,
    review_output: { disposition: 'PASS', findings: [] },
    reviewer_source_control_identity_set: ['sol-reviewer@controller.invalid'],
    reviewer_edit_set: [],
    parent_session_state: 'GENESIS',
    no_earlier_review_conclusions_were_inputs: true,
    fresh_cli_session_observed: true,
    read_only_execution_observed: true,
    controller_direct_execution_observed: true,
    ...overrides,
  };
}

function mutableClone(value) {
  return structuredClone(value);
}

test('plans the exact read-only fresh Codex CLI audit under env -i', () => {
  const plan = buildTrustedReviewPlan(planInput());
  assert.equal(validateTrustedReviewPlan(plan), true);
  assert.equal(plan.invocation.executable, '/usr/bin/env');
  assert.deepEqual(plan.invocation.arguments.slice(0, 10), [
    '-i',
    'HOME=/private/tmp/g0-cold-review-test/legal_semantic-lane/home',
    'CODEX_HOME=/private/tmp/g0-cold-review-test/legal_semantic-lane/codex-home',
    'TMPDIR=/private/tmp/g0-cold-review-test/legal_semantic-lane/tmp',
    'PATH=/opt/homebrew/bin:/usr/bin:/bin',
    'LANG=C.UTF-8',
    'LC_ALL=C.UTF-8',
    'TERM=dumb',
    '/opt/homebrew/bin/codex',
    '-s',
  ]);
  const codex = plan.invocation.arguments.slice(8);
  assert.deepEqual(codex, [
    '/opt/homebrew/bin/codex',
    '-s',
    'read-only',
    '-a',
    'never',
    '--strict-config',
    'exec',
    '--ephemeral',
    '--ignore-user-config',
    '--ignore-rules',
    '--skip-git-repo-check',
    '-m',
    'gpt-5.6-sol',
    '-c',
    'model_reasoning_effort="xhigh"',
    '--disable',
    'multi_agent',
    '--disable',
    'multi_agent_v2',
    '--json',
    '--output-schema',
    '/immutable/review/output-schema.json',
    '-',
  ]);
  assert.equal(plan.invocation.parent_environment, 'EMPTY_ENV_I');
  assert.equal(plan.execution_authority, 'EXTERNAL_PROTECTED_CONTROLLER_ONLY');
});

test('rejects any wrong flag, value or ordering', () => {
  const base = buildTrustedReviewPlan(planInput());
  const cases = [
    (arguments_) => {
      const sandboxIndex = arguments_.indexOf('read-only');
      arguments_[sandboxIndex] = 'workspace-write';
    },
    (arguments_) => {
      const execIndex = arguments_.indexOf('exec');
      const strictIndex = arguments_.indexOf('--strict-config');
      [arguments_[execIndex], arguments_[strictIndex]] = [
        arguments_[strictIndex],
        arguments_[execIndex],
      ];
    },
    (arguments_) => {
      arguments_.splice(arguments_.indexOf('--ephemeral'), 1);
    },
    (arguments_) => {
      arguments_.push('resume');
    },
    (arguments_) => {
      arguments_[arguments_.indexOf(MODEL_IDENTIFIER)] = 'gpt-5.6-terra';
    },
    (arguments_) => {
      arguments_[arguments_.indexOf(`model_reasoning_effort="${REASONING_LEVEL}"`)]
        = 'model_reasoning_effort="high"';
    },
    (arguments_) => {
      arguments_.splice(arguments_.indexOf('multi_agent_v2') - 1, 2);
    },
  ];

  for (const change of cases) {
    const plan = mutableClone(base);
    change(plan.invocation.arguments);
    assert.throws(() => validateTrustedReviewPlan(plan), /flags, values or order/);
  }
});

test('rejects mutable task inputs and extra task input', () => {
  assert.throws(
    () => buildTrustedReviewPlan(planInput({
      task_manifest: taskManifest({
        frozen_specification: {
          ...taskManifest().frozen_specification,
          immutable: false,
        },
      }),
    })),
    /must be immutable/,
  );
  assert.throws(
    () => buildTrustedReviewPlan(planInput({
      task_manifest: {
        ...taskManifest(),
        prior_review_summary: { disposition: 'PASS' },
      },
    })),
    /unsupported fields: prior_review_summary/,
  );
  assert.throws(
    () => buildTrustedReviewPlan(planInput({
      task_manifest: taskManifest({
        registered_prompt: {
          ...taskManifest().registered_prompt,
          contains_prior_review_conclusions: true,
        },
      }),
    })),
    /no prior review conclusions/,
  );
});

test('rejects unknown context, shared paths and paths outside the signed run root', () => {
  assert.throws(
    () => buildTrustedReviewPlan(planInput({
      runtime_context: {
        ...runtimeContext(),
        inherited_shell_profile: true,
      },
    })),
    /unsupported fields: inherited_shell_profile/,
  );
  assert.throws(
    () => buildTrustedReviewPlan(planInput({
      runtime_context: runtimeContext({
        codex_home_path: '/private/tmp/g0-cold-review-test/legal_semantic-lane/home',
      }),
    })),
    /must be distinct/,
  );
  assert.throws(
    () => buildTrustedReviewPlan(planInput({
      runtime_context: runtimeContext({
        tmpdir_path: '/private/tmp/outside-run/tmp',
      }),
    })),
    /exact provenance/,
  );
});

test('rejects leaked credentials and sensitive parent environment names', () => {
  const plan = mutableClone(buildTrustedReviewPlan(planInput()));
  plan.invocation.arguments.splice(2, 0, 'GITHUB_TOKEN=secret');
  assert.throws(
    () => validateTrustedReviewPlan(plan),
    /leaks prohibited environment variable GITHUB_TOKEN/,
  );

  for (const name of [
    'DATABASE_URL',
    'DB_PASSWORD',
    'PGPASSWORD',
    'VERCEL_TOKEN',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLAUDE_API_KEY',
    'SSH_AUTH_SOCK',
    'KEYCHAIN_PASSWORD',
  ]) {
    const changed = mutableClone(buildTrustedReviewPlan(planInput()));
    changed.invocation.arguments.splice(2, 0, `${name}=secret`);
    assert.throws(() => validateTrustedReviewPlan(changed), /leaks prohibited environment variable/);
  }
});

test('produces an unsigned record and exact external signing frame', () => {
  const plan = buildTrustedReviewPlan(planInput());
  const result = buildUnsignedTrustedReviewControllerRecord({
    plan,
    observation: observation(plan),
  });
  const record = result.unsigned_record_payload;

  assert.equal(record.exact_model_identifier, MODEL_IDENTIFIER);
  assert.equal(record.reasoning_level, REASONING_LEVEL);
  assert.equal(record.reviewer_principal_id, 'controller-run-1/session-1');
  assert.equal(record.parent_session_state, 'GENESIS');
  assert.equal(record.reviewer_edit_set_root, EMPTY_REVIEW_EDIT_SET_ROOT);
  assert.equal(record.reviewer_disposition, 'PASS');
  assert.equal('controller_signature' in record, false);
  assert.equal(validateSchema('TrustedReviewControllerRecord/V1', {
    ...record,
    controller_signature: Buffer.alloc(64, 1).toString('base64'),
  }), true);
  assert.equal(result.signing_frame.domain, CONTROLLER_RECORD_DOMAIN);
  assert.equal(result.signing_frame.role, CONTROLLER_RECORD_ROLE);
  assert.equal(
    result.signing_frame.payload_digest,
    domainDigest(CONTROLLER_RECORD_PAYLOAD_DOMAIN, record),
  );
  const signingFrameBytes = Buffer.from(result.signing_frame.bytes_base64, 'base64');
  assert.equal(result.signing_frame.byte_length, signingFrameBytes.length);
  assert.deepEqual(
    signingFrameBytes,
    signatureBytes({
      domain: CONTROLLER_RECORD_DOMAIN,
      role: CONTROLLER_RECORD_ROLE,
      payload: record,
    }),
  );
});

test('rejects changed inputs and any non-empty reviewer edit set', () => {
  const plan = buildTrustedReviewPlan(planInput());
  assert.throws(
    () => buildUnsignedTrustedReviewControllerRecord({
      plan,
      observation: observation(plan, {
        input_context_digest_after_review: DIGEST_D,
      }),
    }),
    /review input changed/,
  );
  assert.throws(
    () => buildUnsignedTrustedReviewControllerRecord({
      plan,
      observation: observation(plan, {
        reviewer_edit_set: ['docs/CODEX-PROGRAM.md'],
      }),
    }),
    /exact empty set/,
  );
});

test('rejects resumed sessions, prior conclusions and unobserved controller execution', () => {
  const plan = buildTrustedReviewPlan(planInput());
  for (const overrides of [
    { parent_session_state: 'RESUMED' },
    { no_earlier_review_conclusions_were_inputs: false },
    { fresh_cli_session_observed: false },
    { read_only_execution_observed: false },
    { controller_direct_execution_observed: false },
  ]) {
    assert.throws(
      () => buildUnsignedTrustedReviewControllerRecord({
        plan,
        observation: observation(plan, overrides),
      }),
      /GENESIS|earlier review conclusions|fresh CLI session|read-only|directly observe/,
    );
  }
});

test('rejects injected model or reasoning settings even when digests are recomputed', () => {
  for (const replacement of ['gpt-5.6-terra', 'model_reasoning_effort="high"']) {
    const plan = mutableClone(buildTrustedReviewPlan(planInput()));
    if (replacement.startsWith('gpt-')) {
      plan.invocation.arguments[plan.invocation.arguments.indexOf(MODEL_IDENTIFIER)] = replacement;
    } else {
      plan.invocation.arguments[
        plan.invocation.arguments.indexOf(`model_reasoning_effort="${REASONING_LEVEL}"`)
      ] = replacement;
    }
    assert.throws(() => validateTrustedReviewPlan(plan), /flags, values or order/);
  }
});
