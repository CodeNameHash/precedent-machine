const path = require('node:path');

const {
  canonicalBytes,
  domainDigest,
  signatureBytes,
} = require('./bytes');

const PLAN_VERSION = 'TrustedReviewControllerPlan/V1';
const TASK_MANIFEST_VERSION = 'TrustedReviewTaskManifest/V1';
const RUNTIME_CONTEXT_VERSION = 'TrustedReviewRuntimeContext/V1';
const CONTROLLER_ID = 'CODEX_CLI_REVIEW_CONTROLLER';
const CONTROLLER_RECORD_DOMAIN = 'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1';
const CONTROLLER_RECORD_ROLE = 'REVIEW_CONTROLLER';
const MODEL_IDENTIFIER = 'gpt-5.6-sol';
const REASONING_LEVEL = 'xhigh';
const SIGNATURE_ALGORITHM = 'Ed25519';
const REVIEWER_EDIT_SET_ROOT_DOMAIN = 'PROGRAMME_GATE_REVIEWER_EDIT_SET_ROOT/V1';
const REVIEW_TASK_MANIFEST_DOMAIN = 'PROGRAMME_GATE_REVIEW_TASK_MANIFEST/V1';
const REVIEW_RUNTIME_CONTEXT_DOMAIN = 'PROGRAMME_GATE_REVIEW_RUNTIME_CONTEXT/V1';
const REVIEW_EXACT_INPUT_CONTEXT_DOMAIN = 'PROGRAMME_GATE_REVIEW_EXACT_INPUT_CONTEXT/V1';
const REVIEW_OUTPUT_DOMAIN = 'PROGRAMME_GATE_REVIEW_OUTPUT/V1';
const CONTROLLER_RECORD_PAYLOAD_DOMAIN =
  'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD_PAYLOAD/V1';
const EMPTY_REVIEW_EDIT_SET_ROOT = domainDigest(REVIEWER_EDIT_SET_ROOT_DOMAIN, []);
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const TOKEN_PATTERN = /^[A-Z][A-Z0-9_./:-]{0,127}$/;
const DENIED_ENVIRONMENT_NAME = /(?:^|_)(?:ANTHROPIC|API_KEY|AUTH|CLAUDE|CREDENTIAL|DATABASE|DB|GITHUB|KEYCHAIN|OPENAI|PASSWORD|PGDATABASE|PGHOST|PGPASSFILE|PGPASSWORD|PGPORT|PGSERVICE|PGSSLMODE|PGUSER|PRIVATE_KEY|SECRET|SSH|SUPABASE|TOKEN|VERCEL)(?:_|$)/i;

const TASK_MANIFEST_KEYS = Object.freeze([
  'manifest_version',
  'lane_id',
  'exact_specification_root',
  'frozen_specification',
  'registered_prompt',
  'output_schema',
]);
const FROZEN_SPECIFICATION_KEYS = Object.freeze([
  'manifest_id',
  'manifest_digest',
  'file_count',
  'immutable',
]);
const REGISTERED_PROMPT_KEYS = Object.freeze([
  'prompt_id',
  'path',
  'payload_digest',
  'byte_length',
  'immutable',
  'contains_prior_review_conclusions',
]);
const OUTPUT_SCHEMA_KEYS = Object.freeze([
  'schema_id',
  'path',
  'payload_digest',
  'byte_length',
  'immutable',
]);
const RUNTIME_CONTEXT_KEYS = Object.freeze([
  'context_version',
  'review_runtime_binary_path',
  'review_runtime_version',
  'review_runtime_binary_digest',
  'working_directory',
  'operating_system',
  'architecture',
  'home_path',
  'codex_home_path',
  'tmpdir_path',
  'path_value',
  'lang',
  'lc_all',
  'term',
]);
const PLAN_INPUT_KEYS = Object.freeze([
  'controller_version',
  'controller_run_id',
  'immutable_task_id',
  'nonce',
  'controller_key_id',
  'task_manifest',
  'runtime_context',
]);
const PLAN_KEYS = Object.freeze([
  'plan_version',
  'controller_id',
  'controller_version',
  'controller_run_id',
  'immutable_task_id',
  'nonce',
  'controller_key_id',
  'task_manifest',
  'controller_supplied_input_manifest_digest',
  'fixed_runtime_context',
  'fixed_controller_runtime_context_digest',
  'exact_input_context_digest',
  'reviewer_principal_rule',
  'invocation',
  'execution_authority',
]);
const INVOCATION_KEYS = Object.freeze([
  'executable',
  'arguments',
  'working_directory',
  'stdin',
  'parent_environment',
]);
const STDIN_KEYS = Object.freeze([
  'source',
  'payload_digest',
  'byte_length',
]);
const OBSERVATION_KEYS = Object.freeze([
  'immutable_session_id',
  'immutable_review_id',
  'review_start_time',
  'review_end_time',
  'input_context_digest_before_review',
  'input_context_digest_after_review',
  'review_output',
  'reviewer_source_control_identity_set',
  'reviewer_edit_set',
  'parent_session_state',
  'no_earlier_review_conclusions_were_inputs',
  'fresh_cli_session_observed',
  'read_only_execution_observed',
  'controller_direct_execution_observed',
]);

function requireExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const extra = keys.filter((key) => !expectedKeys.includes(key));
  const missing = expectedKeys.filter((key) => !keys.includes(key));
  if (extra.length > 0) throw new Error(`${label} has unsupported fields: ${extra.join(', ')}`);
  if (missing.length > 0) throw new Error(`${label} is missing fields: ${missing.join(', ')}`);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function requireToken(value, label) {
  if (typeof value !== 'string' || !TOKEN_PATTERN.test(value)) {
    throw new TypeError(`${label} must be an uppercase token`);
  }
  return value;
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a SHA-256 digest`);
  }
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function requireAbsolutePath(value, label) {
  requireNonEmptyString(value, label);
  if (!path.isAbsolute(value) || path.normalize(value) !== value) {
    throw new TypeError(`${label} must be a normalised absolute path`);
  }
  return value;
}

function requireCanonicalTimestamp(value, label) {
  requireNonEmptyString(value, label);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical UTC timestamp`);
  }
  return milliseconds;
}

function freezeRecord(value) {
  if (!value
    || typeof value !== 'object'
    || Object.isFrozen(value)
    || ArrayBuffer.isView(value)) return value;
  for (const nested of Object.values(value)) freezeRecord(nested);
  return Object.freeze(value);
}

function validateTaskManifest(manifest) {
  requireExactKeys(manifest, TASK_MANIFEST_KEYS, 'review task manifest');
  if (manifest.manifest_version !== TASK_MANIFEST_VERSION) {
    throw new Error(`review task manifest must use ${TASK_MANIFEST_VERSION}`);
  }
  requireToken(manifest.lane_id, 'review lane ID');
  requireDigest(manifest.exact_specification_root, 'exact specification root');

  requireExactKeys(
    manifest.frozen_specification,
    FROZEN_SPECIFICATION_KEYS,
    'frozen specification',
  );
  requireNonEmptyString(manifest.frozen_specification.manifest_id, 'specification manifest ID');
  requireDigest(manifest.frozen_specification.manifest_digest, 'specification manifest digest');
  requireNonNegativeInteger(manifest.frozen_specification.file_count, 'specification file count');
  if (manifest.frozen_specification.file_count === 0) {
    throw new Error('frozen specification must contain at least one file');
  }
  if (manifest.frozen_specification.immutable !== true) {
    throw new Error('frozen specification input must be immutable');
  }

  requireExactKeys(manifest.registered_prompt, REGISTERED_PROMPT_KEYS, 'registered prompt');
  requireToken(manifest.registered_prompt.prompt_id, 'registered prompt ID');
  requireAbsolutePath(manifest.registered_prompt.path, 'registered prompt path');
  requireDigest(manifest.registered_prompt.payload_digest, 'registered prompt digest');
  requireNonNegativeInteger(manifest.registered_prompt.byte_length, 'registered prompt byte length');
  if (manifest.registered_prompt.byte_length === 0) {
    throw new Error('registered prompt must not be empty');
  }
  if (manifest.registered_prompt.immutable !== true) {
    throw new Error('registered prompt input must be immutable');
  }
  if (manifest.registered_prompt.contains_prior_review_conclusions !== false) {
    throw new Error('registered prompt must contain no prior review conclusions');
  }

  requireExactKeys(manifest.output_schema, OUTPUT_SCHEMA_KEYS, 'review output schema');
  requireNonEmptyString(manifest.output_schema.schema_id, 'review output schema ID');
  requireAbsolutePath(manifest.output_schema.path, 'review output schema path');
  requireDigest(manifest.output_schema.payload_digest, 'review output schema digest');
  requireNonNegativeInteger(manifest.output_schema.byte_length, 'review output schema byte length');
  if (manifest.output_schema.byte_length === 0) {
    throw new Error('review output schema must not be empty');
  }
  if (manifest.output_schema.immutable !== true) {
    throw new Error('review output schema input must be immutable');
  }

  return true;
}

function validateRuntimeContext(context) {
  requireExactKeys(context, RUNTIME_CONTEXT_KEYS, 'fixed review runtime context');
  if (context.context_version !== RUNTIME_CONTEXT_VERSION) {
    throw new Error(`fixed review runtime context must use ${RUNTIME_CONTEXT_VERSION}`);
  }
  requireAbsolutePath(context.review_runtime_binary_path, 'review runtime binary path');
  requireNonEmptyString(context.review_runtime_version, 'review runtime version');
  requireDigest(context.review_runtime_binary_digest, 'review runtime binary digest');
  requireAbsolutePath(context.working_directory, 'review working directory');
  requireNonEmptyString(context.operating_system, 'review operating system');
  requireNonEmptyString(context.architecture, 'review architecture');
  const scratchPaths = [
    requireAbsolutePath(context.home_path, 'fresh HOME path'),
    requireAbsolutePath(context.codex_home_path, 'fresh CODEX_HOME path'),
    requireAbsolutePath(context.tmpdir_path, 'fresh TMPDIR path'),
  ];
  if (new Set(scratchPaths).size !== scratchPaths.length) {
    throw new Error('HOME, CODEX_HOME and TMPDIR must be separate fresh directories');
  }
  requireNonEmptyString(context.path_value, 'PATH value');
  requireNonEmptyString(context.lang, 'LANG value');
  requireNonEmptyString(context.lc_all, 'LC_ALL value');
  requireNonEmptyString(context.term, 'TERM value');
  return true;
}

function environmentAssignments(context) {
  return [
    `HOME=${context.home_path}`,
    `CODEX_HOME=${context.codex_home_path}`,
    `TMPDIR=${context.tmpdir_path}`,
    `PATH=${context.path_value}`,
    `LANG=${context.lang}`,
    `LC_ALL=${context.lc_all}`,
    `TERM=${context.term}`,
  ];
}

function codexArguments(manifest) {
  return [
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
    MODEL_IDENTIFIER,
    '-c',
    `model_reasoning_effort="${REASONING_LEVEL}"`,
    '--disable',
    'multi_agent',
    '--disable',
    'multi_agent_v2',
    '--json',
    '--output-schema',
    manifest.output_schema.path,
    '-',
  ];
}

function expectedInvocation(manifest, context) {
  return {
    executable: '/usr/bin/env',
    arguments: [
      '-i',
      ...environmentAssignments(context),
      context.review_runtime_binary_path,
      ...codexArguments(manifest),
    ],
    working_directory: context.working_directory,
    stdin: {
      source: 'REGISTERED_PROMPT_EXACT_BYTES',
      payload_digest: manifest.registered_prompt.payload_digest,
      byte_length: manifest.registered_prompt.byte_length,
    },
    parent_environment: 'EMPTY_ENV_I',
  };
}

function exactInputContext(taskManifest, runtimeContext) {
  return {
    context_version: 'TrustedReviewExactInputContext/V1',
    task_manifest_digest: domainDigest(REVIEW_TASK_MANIFEST_DOMAIN, taskManifest),
    exact_specification_root: taskManifest.exact_specification_root,
    frozen_specification_manifest_digest: taskManifest.frozen_specification.manifest_digest,
    registered_prompt_digest: taskManifest.registered_prompt.payload_digest,
    output_schema_digest: taskManifest.output_schema.payload_digest,
    fixed_runtime_context_digest: domainDigest(REVIEW_RUNTIME_CONTEXT_DOMAIN, runtimeContext),
  };
}

function validateEnvironmentArguments(arguments_) {
  if (!Array.isArray(arguments_) || arguments_[0] !== '-i') {
    throw new Error('review invocation must start with env -i');
  }
  const firstCommandIndex = arguments_.findIndex((value, index) => index > 0 && !value.includes('='));
  if (firstCommandIndex < 0) throw new Error('review invocation is missing the Codex command');
  for (const assignment of arguments_.slice(1, firstCommandIndex)) {
    const separator = assignment.indexOf('=');
    const name = assignment.slice(0, separator);
    if (DENIED_ENVIRONMENT_NAME.test(name)) {
      throw new Error(`review invocation leaks prohibited environment variable ${name}`);
    }
  }
}

function buildTrustedReviewPlan(input) {
  requireExactKeys(input, PLAN_INPUT_KEYS, 'review-controller planning input');
  requireNonEmptyString(input.controller_version, 'controller version');
  requireNonEmptyString(input.controller_run_id, 'controller run ID');
  requireNonEmptyString(input.immutable_task_id, 'immutable task ID');
  requireNonEmptyString(input.nonce, 'controller nonce');
  requireToken(input.controller_key_id, 'controller key ID');
  validateTaskManifest(input.task_manifest);
  validateRuntimeContext(input.runtime_context);

  const taskManifest = freezeRecord(structuredClone(input.task_manifest));
  const runtimeContext = freezeRecord(structuredClone(input.runtime_context));
  const inputContext = exactInputContext(taskManifest, runtimeContext);
  const plan = {
    plan_version: PLAN_VERSION,
    controller_id: CONTROLLER_ID,
    controller_version: input.controller_version,
    controller_run_id: input.controller_run_id,
    immutable_task_id: input.immutable_task_id,
    nonce: input.nonce,
    controller_key_id: input.controller_key_id,
    task_manifest: taskManifest,
    controller_supplied_input_manifest_digest: domainDigest(
      REVIEW_TASK_MANIFEST_DOMAIN,
      taskManifest,
    ),
    fixed_runtime_context: runtimeContext,
    fixed_controller_runtime_context_digest: domainDigest(
      REVIEW_RUNTIME_CONTEXT_DOMAIN,
      runtimeContext,
    ),
    exact_input_context_digest: domainDigest(REVIEW_EXACT_INPUT_CONTEXT_DOMAIN, inputContext),
    reviewer_principal_rule: 'CONTROLLER_RUN_ID/FRESH_CLI_SESSION_ID',
    invocation: expectedInvocation(taskManifest, runtimeContext),
    execution_authority: 'EXTERNAL_PROTECTED_CONTROLLER_ONLY',
  };
  validateTrustedReviewPlan(plan);
  return freezeRecord(plan);
}

function validateTrustedReviewPlan(plan) {
  requireExactKeys(plan, PLAN_KEYS, 'trusted review-controller plan');
  if (plan.plan_version !== PLAN_VERSION) throw new Error(`review plan must use ${PLAN_VERSION}`);
  if (plan.controller_id !== CONTROLLER_ID) throw new Error('review plan has the wrong controller ID');
  requireNonEmptyString(plan.controller_version, 'controller version');
  requireNonEmptyString(plan.controller_run_id, 'controller run ID');
  requireNonEmptyString(plan.immutable_task_id, 'immutable task ID');
  requireNonEmptyString(plan.nonce, 'controller nonce');
  requireToken(plan.controller_key_id, 'controller key ID');
  validateTaskManifest(plan.task_manifest);
  validateRuntimeContext(plan.fixed_runtime_context);
  if (plan.controller_supplied_input_manifest_digest
    !== domainDigest(REVIEW_TASK_MANIFEST_DOMAIN, plan.task_manifest)) {
    throw new Error('review task manifest digest does not match the exact manifest');
  }
  if (plan.fixed_controller_runtime_context_digest
    !== domainDigest(REVIEW_RUNTIME_CONTEXT_DOMAIN, plan.fixed_runtime_context)) {
    throw new Error('fixed runtime context digest does not match the exact context');
  }
  if (plan.exact_input_context_digest
    !== domainDigest(
      REVIEW_EXACT_INPUT_CONTEXT_DOMAIN,
      exactInputContext(plan.task_manifest, plan.fixed_runtime_context),
    )) {
    throw new Error('exact review input-context digest does not match');
  }
  if (plan.reviewer_principal_rule !== 'CONTROLLER_RUN_ID/FRESH_CLI_SESSION_ID') {
    throw new Error('reviewer principal rule must bind the controller run and fresh CLI session');
  }
  requireExactKeys(plan.invocation, INVOCATION_KEYS, 'review invocation');
  requireExactKeys(plan.invocation.stdin, STDIN_KEYS, 'review invocation stdin');
  validateEnvironmentArguments(plan.invocation.arguments);
  const expected = expectedInvocation(plan.task_manifest, plan.fixed_runtime_context);
  if (!canonicalBytes(plan.invocation).equals(canonicalBytes(expected))) {
    throw new Error('review invocation flags, values or order do not match the fixed CLI audit');
  }
  if (plan.execution_authority !== 'EXTERNAL_PROTECTED_CONTROLLER_ONLY') {
    throw new Error('review plan cannot grant local execution authority');
  }
  return true;
}

function buildUnsignedTrustedReviewControllerRecord({ plan, observation }) {
  validateTrustedReviewPlan(plan);
  requireExactKeys(observation, OBSERVATION_KEYS, 'review execution observation');
  requireNonEmptyString(observation.immutable_session_id, 'immutable session ID');
  requireNonEmptyString(observation.immutable_review_id, 'immutable review ID');
  const startedAt = requireCanonicalTimestamp(observation.review_start_time, 'review start time');
  const endedAt = requireCanonicalTimestamp(observation.review_end_time, 'review end time');
  if (endedAt <= startedAt) throw new Error('review end time must be after review start time');
  requireDigest(
    observation.input_context_digest_before_review,
    'input context digest before review',
  );
  requireDigest(
    observation.input_context_digest_after_review,
    'input context digest after review',
  );
  if (observation.input_context_digest_before_review !== plan.exact_input_context_digest
    || observation.input_context_digest_after_review !== plan.exact_input_context_digest) {
    throw new Error('review input changed before, during or after execution');
  }
  if (!observation.review_output
    || typeof observation.review_output !== 'object'
    || Array.isArray(observation.review_output)
    || !['PASS', 'FAIL'].includes(observation.review_output.disposition)) {
    throw new Error('review output must contain terminal disposition PASS or FAIL');
  }
  if (!Array.isArray(observation.reviewer_source_control_identity_set)
    || observation.reviewer_source_control_identity_set.length === 0
    || observation.reviewer_source_control_identity_set.some(
      (identity) => typeof identity !== 'string' || identity.length === 0,
    )
    || new Set(observation.reviewer_source_control_identity_set).size
      !== observation.reviewer_source_control_identity_set.length) {
    throw new Error('reviewer source-control identity set must be complete and unique');
  }
  if (!Array.isArray(observation.reviewer_edit_set)) {
    throw new TypeError('reviewer edit set must be an array');
  }
  if (observation.reviewer_edit_set.length !== 0
    || domainDigest(REVIEWER_EDIT_SET_ROOT_DOMAIN, observation.reviewer_edit_set)
      !== EMPTY_REVIEW_EDIT_SET_ROOT) {
    throw new Error('reviewer edit set must be the exact empty set');
  }
  if (observation.parent_session_state !== 'GENESIS') {
    throw new Error('cold review session must start from GENESIS');
  }
  if (observation.no_earlier_review_conclusions_were_inputs !== true) {
    throw new Error('cold review cannot receive earlier review conclusions');
  }
  if (observation.fresh_cli_session_observed !== true) {
    throw new Error('review must use one fresh CLI session');
  }
  if (observation.read_only_execution_observed !== true) {
    throw new Error('review must be observed as read-only');
  }
  if (observation.controller_direct_execution_observed !== true) {
    throw new Error('protected controller must directly observe the review execution');
  }

  const reviewerPrincipalId = `${plan.controller_run_id}/${observation.immutable_session_id}`;
  const unsignedRecordPayload = {
    schema_version: 'TrustedReviewControllerRecord/V1',
    controller_id: plan.controller_id,
    controller_version: plan.controller_version,
    review_runtime_version: plan.fixed_runtime_context.review_runtime_version,
    review_runtime_binary_digest: plan.fixed_runtime_context.review_runtime_binary_digest,
    fixed_controller_runtime_context_digest: plan.fixed_controller_runtime_context_digest,
    controller_supplied_input_manifest: plan.task_manifest,
    fixed_controller_runtime_context: plan.fixed_runtime_context,
    exact_specification_root: plan.task_manifest.exact_specification_root,
    exact_model_identifier: MODEL_IDENTIFIER,
    reasoning_level: REASONING_LEVEL,
    immutable_task_id: plan.immutable_task_id,
    immutable_session_id: observation.immutable_session_id,
    immutable_review_id: observation.immutable_review_id,
    registered_prompt_id: plan.task_manifest.registered_prompt.prompt_id,
    cold_review_prompt_digest: plan.task_manifest.registered_prompt.payload_digest,
    controller_supplied_input_manifest_digest: plan.controller_supplied_input_manifest_digest,
    exact_input_context_digest: plan.exact_input_context_digest,
    input_context_digest_before_review: observation.input_context_digest_before_review,
    input_context_digest_after_review: observation.input_context_digest_after_review,
    review_output_digest: domainDigest(REVIEW_OUTPUT_DOMAIN, observation.review_output),
    review_start_time: observation.review_start_time,
    review_end_time: observation.review_end_time,
    reviewer_principal_id: reviewerPrincipalId,
    reviewer_source_control_identity_set: [
      ...observation.reviewer_source_control_identity_set,
    ].sort(),
    reviewer_disposition: observation.review_output.disposition,
    reviewer_edit_set_root: EMPTY_REVIEW_EDIT_SET_ROOT,
    parent_session_state: 'GENESIS',
    no_earlier_review_conclusions_were_inputs: true,
    nonce: plan.nonce,
    signature_algorithm: SIGNATURE_ALGORITHM,
    controller_key_id: plan.controller_key_id,
  };
  const signingBytes = signatureBytes({
    domain: CONTROLLER_RECORD_DOMAIN,
    role: CONTROLLER_RECORD_ROLE,
    payload: unsignedRecordPayload,
  });

  return freezeRecord({
    unsigned_record_payload: unsignedRecordPayload,
    signing_frame: {
      frame_version: 'ProgrammeGateSignatureFrame/V1',
      domain: CONTROLLER_RECORD_DOMAIN,
      role: CONTROLLER_RECORD_ROLE,
      payload_digest: domainDigest(CONTROLLER_RECORD_PAYLOAD_DOMAIN, unsignedRecordPayload),
      byte_length: signingBytes.length,
      bytes_base64: signingBytes.toString('base64'),
    },
  });
}

module.exports = {
  CONTROLLER_ID,
  CONTROLLER_RECORD_PAYLOAD_DOMAIN,
  CONTROLLER_RECORD_DOMAIN,
  CONTROLLER_RECORD_ROLE,
  EMPTY_REVIEW_EDIT_SET_ROOT,
  MODEL_IDENTIFIER,
  PLAN_VERSION,
  REASONING_LEVEL,
  REVIEWER_EDIT_SET_ROOT_DOMAIN,
  RUNTIME_CONTEXT_VERSION,
  TASK_MANIFEST_VERSION,
  buildTrustedReviewPlan,
  buildUnsignedTrustedReviewControllerRecord,
  validateTaskManifest,
  validateTrustedReviewPlan,
};
