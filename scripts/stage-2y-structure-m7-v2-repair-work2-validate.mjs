#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const REPO_ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const MANIFEST_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-work2-execution-manifest.json`;
const ORDERING_AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work2-4-candidate-ordering-correction-authority.json`;
const ENTRY_AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work2-entry-correction-authority.json`;
const RECOVERY_AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work2-recovery-authority.json`;
const PARENT_AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-work1-7-authority.json`;
const ACTIVATION_RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json`;
const WORK1_RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json`;
const WORK0_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json`;
const M3_RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m3-context-compilation.json`;
const M4_RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m4-agreement-analysis.json`;
const AGREEMENT_SET_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-work2-agreement-analysis-set.json`;
const CONTEXT_SET_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-work2-context-compilation-set.json`;
const RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work2-compiler.json`;
const CANDIDATE_ROOT = `${MIGRATION_ROOT}/control/m7-v2-repair-candidate-registrations`;
const EXECUTION_FIXTURE_PATH = 'tests/fixtures/canonical-v2/m7-v2-repair/work2-compiler-cases.json';
const GENERALISATION_PATH = 'scripts/stage-2y-structure-generalisation-shadow.mjs';
const EXECUTION_MANIFEST_VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
const FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs';
const RECOVERY_RUNNER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-recover.mjs';
const EXECUTION_MANIFEST_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js';
const WORK2_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-work2.test.js';

const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_RECEIPT/V1';
const RECOVERY_AUTHORITY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK2_COMMIT_DELTA_RECOVERY_AUTHORITY/V1';
const RECEIPT_RECOVERY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK2_RECEIPT_RECOVERY/V1';
const RECOVERY_APPROVAL_ID = 'BEN-M7-V2-WORK2-COMMIT-DELTA-RECOVERY-20260815';
const AGREEMENT_IDS = Object.freeze([
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a',
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154',
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116',
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb',
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363',
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c',
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c',
]);
const CASE_IDS = Object.freeze([
  'native-seven-source-sets',
  'work0-m3-m4-authority-continuity',
  'build-only-null-candidate-preview',
  'three-output-create-once-transaction',
  'receipt-and-source-set-independent-validation',
  'execution-case-list-drift-rejection',
  'partial-output-preflight-rejection',
  'symlinked-repository-root-rejection',
  'real-filesystem-write-failure-rollback',
]);
const OUTPUT_PATHS = Object.freeze([AGREEMENT_SET_PATH, CONTEXT_SET_PATH, RECEIPT_PATH]);
const STANDARD_BINDING_KEYS = Object.freeze([
  'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length', 'sha256',
  'git_blob_oid',
]);
const RECOVERY_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state', 'approved_on',
  'approver', 'ben_approval_id', 'approval_text', 'discovered_defect',
  'parent_authority_binding', 'activation_receipt_binding', 'work1_receipt_binding',
  'work2_entry_correction_authority_binding',
  'candidate_ordering_correction_authority_binding', 'execution_manifest_binding',
  'stale_output_bindings', 'excluded_generalisation_binding',
  'source_precondition_bindings', 'executable_bindings', 'authorised_scope',
  'base_effective_work2_paths', 'exact_path_removal', 'exact_path_extension',
  'effective_work2_paths', 'prior_execution_state', 'command_extension',
  'exact_git_commit_and_push_argv', 'allowed_effects', 'prohibited_effects', 'rollback',
  'success_conditions',
]);
const RECEIPT_RECOVERY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_binding', 'recovery_runner_binding',
  'superseded_receipt_binding', 'superseded_source_set_bindings',
  'excluded_generalisation_binding', 'prior_command_run_counts',
  'prior_post_receipt_validator_run_count', 'recovery_argv', 'recovery_run_count',
  'finaliser_cumulative_run_count', 'validator_cumulative_run_count',
  'replaced_output_paths', 'effective_work2_paths', 'backup_state', 'rollback_state',
]);
const RECOVERY_PATH_REMOVAL = Object.freeze([GENERALISATION_PATH]);
const RECOVERY_PATH_EXTENSION = Object.freeze([RECOVERY_AUTHORITY_PATH, RECOVERY_RUNNER_PATH]);
const STALE_RECEIPT_RUN_COUNTS = Object.freeze([
  4, 1, 1, 1, 1, 1, 1, 1, 13, 3, 8, 2, 1, 0,
]);
const PRIOR_RECOVERY_RUN_COUNTS = Object.freeze([
  5, 1, 1, 1, 1, 1, 10, 10, 22, 3, 10, 3, 1, 1,
]);
const RECOVERED_RECEIPT_RUN_COUNTS = Object.freeze([
  5, 1, 1, 1, 1, 1, 10, 10, 22, 3, 10, 3, 2, 2, 1,
]);
const RECOVERY_COMMAND_EXTENSION = Object.freeze({
  base_command_count: 14,
  run_limit_overrides: [
    { command_index: 0, max_runs: 5 },
    { command_index: 10, max_runs: 10 },
    { command_index: 11, max_runs: 3 },
    { command_index: 12, max_runs: 2 },
  ],
  appended_argv_with_run_limits: [{
    argv: ['node', RECOVERY_RUNNER_PATH, '--authority', RECOVERY_AUTHORITY_PATH],
    max_runs: 1,
  }],
  prior_receipt_run_counts: PRIOR_RECOVERY_RUN_COUNTS,
  prior_post_receipt_validator_run_count: 1,
  recovered_receipt_run_counts: RECOVERED_RECEIPT_RUN_COUNTS,
  required_validator_cumulative_run_count: 2,
  additional_git_add_commit_push_runs: 0,
});
const RECOVERY_AUTHORISED_SCOPE = Object.freeze([
  'PRESERVE_PARENT_AUTHORITIES_MANIFEST_AND_GENERALISATION_BYTES',
  'SUPERSEDE_ONLY_THE_UNCOMMITTED_WORK2_COMMIT_DELTA',
  'EXCLUDE_UNCHANGED_BUILD_ONLY_GENERALISATION_RUNNER',
  'ADD_ONLY_THIS_AUTHORITY_AND_THE_ONE_SHOT_RECOVERY_RUNNER',
  'REPLACE_ONLY_THE_THREE_UNCOMMITTED_WORK2_GENERATED_OUTPUTS',
  'RUN_WORK2_FINALISER_EXACTLY_ONCE_MORE',
  'RUN_WORK2_VALIDATOR_EXACTLY_ONCE_IN_RECOVERY',
  'COMMIT_AND_PUSH_THE_EFFECTIVE_TWENTY_THREE_PATH_WORK2_DELTA_ONLY',
]);
const RECOVERY_ALLOWED_EFFECTS = Object.freeze({
  deterministic_local_reads: true,
  system_temp_backup_directories: 1,
  work2_generated_output_replacements: 3,
  local_subprocess_runs: 5,
  repository_commits: 0,
  repository_pushes: 0,
});
const RECOVERY_PROHIBITED_EFFECTS = Object.freeze({
  non_target_repository_writes: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
  serving_changes: 0,
  publication_changes: 0,
});
const RECOVERY_SUCCESS_CONDITIONS = Object.freeze([
  'UNCHANGED_GENERALISATION_RUNNER_EXCLUDED_FROM_CURRENT_WORK2_DELTA',
  'PRIOR_WORK2_MANIFEST_AND_RECEIPT_LINEAGE_BOUND',
  'THREE_OUTPUTS_REGENERATED',
  'VALIDATOR_PASS',
  'RECEIPT_BINDS_EFFECTIVE_TWENTY_THREE_PATH_SET',
  'RECEIPT_BINDS_TWENTY_TWO_ARTIFACTS',
  'SOURCE_SET_IDENTITIES_PRESERVED',
  'BACKUP_REMOVED',
  'WORK3_HISTORICAL_RECEIPT_VALIDATION_PASS',
  'ZERO_EXTERNAL_EFFECTS',
]);
const SOURCE_PRECONDITION_BINDINGS = Object.freeze([
  { path: FINALISER_PATH, schema_version: null, record_id_field: null, record_id: null,
    byte_length: 33604, sha256: '7aabd0ede779a7300e8deb04f1c65f4e0ee9da96f9fb3a5ba8f6d8b85f71b042',
    git_blob_oid: '5ca2c2e4bc66e105bd18c92ad0c649ecc45bd9e8' },
  { path: VALIDATOR_PATH, schema_version: null, record_id_field: null, record_id: null,
    byte_length: 33512, sha256: '5eeab2481c4c11a3b28d82494458acd8cb06443f9bee0a739a0d27bfed14e0e9',
    git_blob_oid: '29729cfa67c9620f2897a9c0ee7e8e91df68a34f' },
  { path: EXECUTION_MANIFEST_VALIDATOR_PATH, schema_version: null, record_id_field: null,
    record_id: null, byte_length: 105736,
    sha256: '6e46378ce965c404e05a1da6c18cfc08c6a050087540e77fbc763f8d3ed19ec6',
    git_blob_oid: '26ab05f929918296f8195d98ca000c2fe998f043' },
  { path: WORK2_TEST_PATH, schema_version: null, record_id_field: null, record_id: null,
    byte_length: 26780, sha256: '47b4201f950ef9e32d77605ddadca4305b56a51447925efd245b28439531d990',
    git_blob_oid: 'c1bd0d78fea7210f589e74e0fa4f70553ab3c0bf' },
  { path: EXECUTION_MANIFEST_TEST_PATH, schema_version: null, record_id_field: null,
    record_id: null, byte_length: 159488,
    sha256: '7ece01cadd4463946f1e448b9a8886cf334b8e7e8ec3671938ca5ccf58841612',
    git_blob_oid: '0ca13d88425825ac1f87f8dccc72dbed95c75f62' },
]);
const STALE_OUTPUT_BINDINGS = Object.freeze([
  {
    path: AGREEMENT_SET_PATH,
    schema_version: 'AGREEMENT_ANALYSIS_SET/V1',
    record_id_field: 'agreement_analysis_set_id',
    record_id: '1ff809cfe48a2b25d778a1f94869babf8bd1221513ff1b7ce8bf9a4ed06fe3cf',
    byte_length: 4298,
    sha256: 'f607e73359077f34e2dd0ab9f33584e31fba554c8bcd293d3a4dc21bfa420533',
    git_blob_oid: 'd955a36981a27b1b9d5ec6a9313bddca7f61c3f8',
  },
  {
    path: CONTEXT_SET_PATH,
    schema_version: 'CONTEXT_COMPILATION_SET/V1',
    record_id_field: 'context_compilation_set_id',
    record_id: 'dec1de2bfab7d59c518b6a16e37fa6ced7ab3835255ee860d01c9d3f730152dc',
    byte_length: 4335,
    sha256: '5bdbbd951e1dfcd8fede583bc0c6264406108c679cadf2c87ca079ec641aff91',
    git_blob_oid: 'd2e8b3da492d8dbdb6d30adef72df3343ed99c99',
  },
  {
    path: RECEIPT_PATH,
    schema_version: RECEIPT_SCHEMA,
    record_id_field: 'work2_receipt_id',
    record_id: 'f1a64eb3838d622441b0c278c1013ca5c7c37f694576038e1dec0b1a7e50fca5',
    byte_length: 22370,
    sha256: '1588a4a221c4460324be34755ac430ab22c153ed024edc8419fa8ca1e83a3504',
    git_blob_oid: '154ea212112db266bde266b121f5c21cf515d75b',
  },
]);
const EXCLUDED_GENERALISATION_BINDING = Object.freeze({
  path: GENERALISATION_PATH,
  schema_version: null,
  record_id_field: null,
  record_id: null,
  byte_length: 18372,
  sha256: 'c5ba1e970cb0b40837c7e7da3af2bd0bb9f28c2a5d946cba08a8548ddebffec2',
  git_blob_oid: '56f6f4062db5e93de49430f51b72f0b3a6703cee',
});
const PRIOR_EXECUTION_STATE = Object.freeze({
  receipt_command_run_counts: STALE_RECEIPT_RUN_COUNTS,
  post_receipt_validator_run_count: 1,
  work2_receipt_id: STALE_OUTPUT_BINDINGS[2].record_id,
  agreement_analysis_set_id: STALE_OUTPUT_BINDINGS[0].record_id,
  context_compilation_set_id: STALE_OUTPUT_BINDINGS[1].record_id,
  semantic_run_count: 0,
});
const RECOVERY_ROLLBACK = Object.freeze({
  backup_root: 'SYSTEM_TEMP_MKDTEMP_ONLY',
  backup_mode: 'EXACT_BYTES_BEFORE_ANY_REMOVAL',
  restore_on_finaliser_or_validator_failure: true,
  remove_only_new_outputs_before_restore: true,
  retain_backup_on_restore_failure: true,
  second_attempt: 'REJECT_BEFORE_MUTATION',
  protected_paths_never_removed: [
    WORK0_PATH, PARENT_AUTHORITY_PATH, ACTIVATION_RECEIPT_PATH, WORK1_RECEIPT_PATH,
    ENTRY_AUTHORITY_PATH, ORDERING_AUTHORITY_PATH, MANIFEST_PATH, RECOVERY_AUTHORITY_PATH,
    GENERALISATION_PATH,
  ],
});
const RECEIPT_KEYS = Object.freeze([
  'schema_version', 'work2_receipt_id', 'work', 'stage', 'state', 'status',
  'execution_manifest_id', 'execution_manifest_digest', 'parent_authority_binding',
  'activation_receipt_binding', 'predecessor_receipt_binding',
  'work2_entry_correction_authority_binding',
  'candidate_ordering_correction_authority_binding', 'candidate_registration_id',
  'candidate_transition', 'source_set_evidence', 'compiler_evidence',
  'artifact_bindings', 'artifact_set_digest', 'command_execution_ledger',
  'combined_test_result', 'repository_precondition', 'counts', 'checks', 'effects',
  'next_work',
]);
const CHECK_IDS = Object.freeze([
  'WORK1_LINEAGE_AND_WORK2_AUTHORITIES',
  'EXECUTION_MANIFEST',
  'SEALED_M3_M4_SOURCE_CONTINUITY',
  'SOURCE_SET_OUTPUTS',
  'SEVEN_INPUT_COMPILER',
  'LEGACY_ADAPTER',
  'BUILD_ONLY_CANDIDATE_ORDERING',
  'ARTIFACT_INVENTORY',
  'COMMAND_LEDGER',
  'ZERO_EXTERNAL_PRODUCT_AND_SEMANTIC_EFFECTS',
]);
const EXTERNAL_ZERO_EFFECTS = Object.freeze({
  candidate_registration_writes: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
  v2_shadow_analysis_runs: 0,
  v2_shadow_projection_runs: 0,
});

export class Work2ValidationError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work2ValidationError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new Work2ValidationError(code, detail);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalBytes(record) {
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function repositoryPath(value, code) {
  if (typeof value !== 'string' || value.length === 0 || path.posix.isAbsolute(value)
      || value.includes('\\') || value.includes('\0') || /[?*\[\]{}]/u.test(value)
      || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    fail(code, String(value));
  }
  return value;
}

function rootPath(repoRoot) {
  const selected = path.resolve(repoRoot);
  let selectedStat;
  try {
    selectedStat = lstatSync(selected);
  } catch {
    fail('WORK2_RECEIPT_SAFETY', 'repoRoot');
  }
  if (!selectedStat.isDirectory() || selectedStat.isSymbolicLink()) {
    fail('WORK2_RECEIPT_SAFETY', 'repoRoot');
  }
  let resolved;
  try {
    resolved = realpathSync(selected);
  } catch {
    fail('WORK2_RECEIPT_SAFETY', 'repoRoot');
  }
  const stat = lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('WORK2_RECEIPT_SAFETY', 'repoRoot');
  }
  return resolved;
}

function resolveExisting(root, selectedPath, code) {
  repositoryPath(selectedPath, code);
  let current = root;
  for (const part of selectedPath.split('/')) {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      fail(code, selectedPath);
    }
    if (stat.isSymbolicLink()) fail(code, selectedPath);
  }
  const stat = lstatSync(current);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(code, selectedPath);
  return current;
}

function readBytes(root, selectedPath, code) {
  return readFileSync(resolveExisting(root, selectedPath, code));
}

function readCanonical(root, selectedPath, code) {
  const bytes = readBytes(root, selectedPath, code);
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code, selectedPath);
  }
  if (!bytes.equals(canonicalBytes(record))) fail(code, `${selectedPath} canonical bytes`);
  return { bytes, record };
}

function readOptionalCanonical(root, selectedPath, code) {
  repositoryPath(selectedPath, code);
  const absolute = path.join(root, ...selectedPath.split('/'));
  try {
    lstatSync(absolute);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    fail(code, selectedPath);
  }
  return readCanonical(root, selectedPath, code);
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && same(Object.keys(value).sort(), [...keys].sort());
}

function binding(selectedPath, bytes, schemaVersion = null, idField = null, id = null) {
  return {
    path: selectedPath,
    schema_version: schemaVersion,
    record_id_field: idField,
    record_id: id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function standardRecordBinding(selectedPath, input, idField) {
  if (typeof input.record?.schema_version !== 'string'
      || typeof input.record?.[idField] !== 'string') {
    fail('WORK2_RECOVERY_BINDING_DRIFT', selectedPath);
  }
  return binding(
    selectedPath, input.bytes, input.record.schema_version, idField, input.record[idField],
  );
}

function executableBindings(root) {
  return [
    EXECUTION_MANIFEST_VALIDATOR_PATH,
    FINALISER_PATH,
    VALIDATOR_PATH,
    RECOVERY_RUNNER_PATH,
    EXECUTION_MANIFEST_TEST_PATH,
    WORK2_TEST_PATH,
  ].map((selectedPath) => binding(
    selectedPath, readBytes(root, selectedPath, 'WORK2_RECOVERY_BINDING_DRIFT'),
  ));
}

function baseEffectivePaths(manifest) {
  const addArgv = manifest.exact_git_commit_and_push_argv?.[0];
  if (!Array.isArray(addArgv) || !same(addArgv.slice(0, 3), ['git', 'add', '--'])) {
    fail('WORK2_MANIFEST_BINDING_DRIFT', 'Git add argv');
  }
  return addArgv.slice(3);
}

function derivedRecoveryPaths(basePaths) {
  if (basePaths.length !== 22 || new Set(basePaths).size !== 22
      || !basePaths.includes(GENERALISATION_PATH)
      || !basePaths.includes(ENTRY_AUTHORITY_PATH) || !basePaths.includes(VALIDATOR_PATH)
      || basePaths.includes(RECOVERY_AUTHORITY_PATH)
      || basePaths.includes(RECOVERY_RUNNER_PATH)) {
    fail('WORK2_RECOVERY_PATH_SCOPE', 'base paths');
  }
  const effective = basePaths.filter((selectedPath) => selectedPath !== GENERALISATION_PATH);
  effective.splice(effective.indexOf(ENTRY_AUTHORITY_PATH) + 1, 0, RECOVERY_AUTHORITY_PATH);
  effective.splice(effective.indexOf(VALIDATOR_PATH) + 1, 0, RECOVERY_RUNNER_PATH);
  if (effective.length !== 23 || new Set(effective).size !== 23) {
    fail('WORK2_RECOVERY_PATH_SCOPE', 'effective paths');
  }
  return effective;
}

function effectiveCommandPolicy(manifest, recoveryAuthority) {
  if (!recoveryAuthority) return manifest.exact_argv_with_run_limits;
  const commands = structuredClone(manifest.exact_argv_with_run_limits);
  if (commands.length !== RECOVERY_COMMAND_EXTENSION.base_command_count) {
    fail('WORK2_COMMAND_LEDGER_DRIFT', 'base command count');
  }
  for (const override of RECOVERY_COMMAND_EXTENSION.run_limit_overrides) {
    commands[override.command_index].max_runs = override.max_runs;
  }
  commands.push(...structuredClone(RECOVERY_COMMAND_EXTENSION.appended_argv_with_run_limits));
  return commands;
}

function effectiveCommitArgv(manifest, effectivePaths, recoveryAuthority) {
  if (!recoveryAuthority) return manifest.exact_git_commit_and_push_argv;
  const parent = manifest.exact_git_commit_and_push_argv;
  if (!Array.isArray(parent) || parent.length !== 3
      || !same(parent[0], ['git', 'add', '--', ...baseEffectivePaths(manifest)])) {
    fail('WORK2_RECOVERY_PATH_SCOPE', 'base Git argv');
  }
  return [['git', 'add', '--', ...effectivePaths], parent[1], parent[2]];
}

function validateRecoveryAuthority(root, input, manifestInput, orderingInput, entryInput) {
  if (!input) return null;
  const authority = input.record;
  const unsigned = structuredClone(authority);
  delete unsigned.correction_authority_id;
  const manifest = manifestInput.record;
  const basePaths = baseEffectivePaths(manifest);
  const effectivePaths = derivedRecoveryPaths(basePaths);
  const parentInput = readCanonical(root, PARENT_AUTHORITY_PATH, 'WORK2_RECOVERY_BINDING_DRIFT');
  const activationInput = readCanonical(
    root, ACTIVATION_RECEIPT_PATH, 'WORK2_RECOVERY_BINDING_DRIFT',
  );
  const work1Input = readCanonical(root, WORK1_RECEIPT_PATH, 'WORK2_RECOVERY_BINDING_DRIFT');
  const expectedBindings = {
    parent: standardRecordBinding(PARENT_AUTHORITY_PATH, parentInput, 'authority_id'),
    activation: standardRecordBinding(
      ACTIVATION_RECEIPT_PATH, activationInput, 'activation_receipt_id',
    ),
    work1: standardRecordBinding(WORK1_RECEIPT_PATH, work1Input, 'work1_contract_receipt_id'),
    entry: standardRecordBinding(
      ENTRY_AUTHORITY_PATH, entryInput, 'correction_authority_id',
    ),
    ordering: standardRecordBinding(
      ORDERING_AUTHORITY_PATH, orderingInput, 'correction_authority_id',
    ),
    manifest: standardRecordBinding(MANIFEST_PATH, manifestInput, 'execution_manifest_id'),
  };
  const exactGit = effectiveCommitArgv(manifest, effectivePaths, authority);
  if (!exactKeys(authority, RECOVERY_AUTHORITY_KEYS)
      || authority.schema_version !== RECOVERY_AUTHORITY_SCHEMA
      || authority.correction_authority_id !== contentId(RECOVERY_AUTHORITY_SCHEMA, unsigned)
      || authority.stage !== 'M7_V2_REPAIR_WORK2_COMMIT_DELTA_RECOVERY'
      || authority.authority_state !== 'BEN_AUTHORISED_SINGLE_WORK2_PRE_COMMIT_RECOVERY'
      || authority.approved_on !== '2026-08-15'
      || authority.approver !== 'BEN_GOODCHILD'
      || authority.ben_approval_id !== RECOVERY_APPROVAL_ID
      || authority.approval_text
        !== 'Hokay, proceed and keep proceeding. You should merge as you see fir'
      || authority.discovered_defect
        !== 'WORK2_EFFECTIVE_DELTA_INCLUDED_UNCHANGED_BUILD_ONLY_GENERALISATION_RUNNER'
      || !same(authority.authorised_scope, RECOVERY_AUTHORISED_SCOPE)
      || !same(authority.allowed_effects, RECOVERY_ALLOWED_EFFECTS)
      || !same(authority.prohibited_effects, RECOVERY_PROHIBITED_EFFECTS)
      || !same(authority.rollback, RECOVERY_ROLLBACK)
      || !same(authority.success_conditions, RECOVERY_SUCCESS_CONDITIONS)
      || !same(authority.prior_execution_state, PRIOR_EXECUTION_STATE)
      || !same(authority.command_extension, RECOVERY_COMMAND_EXTENSION)) {
    fail('WORK2_RECOVERY_AUTHORITY_INVALID');
  }
  if (!same(authority.base_effective_work2_paths, basePaths)
      || !same(authority.exact_path_removal, RECOVERY_PATH_REMOVAL)
      || !same(authority.exact_path_extension, RECOVERY_PATH_EXTENSION)
      || !same(authority.effective_work2_paths, effectivePaths)
      || !same(authority.exact_git_commit_and_push_argv, exactGit)) {
    fail('WORK2_RECOVERY_PATH_SCOPE');
  }
  if (!same(authority.parent_authority_binding, expectedBindings.parent)
      || !same(authority.activation_receipt_binding, expectedBindings.activation)
      || !same(authority.work1_receipt_binding, expectedBindings.work1)
      || !same(authority.work2_entry_correction_authority_binding, expectedBindings.entry)
      || !same(
        authority.candidate_ordering_correction_authority_binding, expectedBindings.ordering,
      )
      || !same(authority.execution_manifest_binding, expectedBindings.manifest)
      || !same(authority.stale_output_bindings, STALE_OUTPUT_BINDINGS)
      || !same(authority.excluded_generalisation_binding, EXCLUDED_GENERALISATION_BINDING)
      || !same(
        authority.excluded_generalisation_binding,
        binding(
          GENERALISATION_PATH,
          readBytes(root, GENERALISATION_PATH, 'WORK2_RECOVERY_BINDING_DRIFT'),
        ),
      )
      || !same(authority.source_precondition_bindings, SOURCE_PRECONDITION_BINDINGS)
      || !same(authority.executable_bindings, executableBindings(root))
      || [authority.parent_authority_binding, authority.activation_receipt_binding,
        authority.work1_receipt_binding, authority.work2_entry_correction_authority_binding,
        authority.candidate_ordering_correction_authority_binding,
        authority.execution_manifest_binding, ...authority.stale_output_bindings,
        authority.excluded_generalisation_binding, ...authority.source_precondition_bindings,
        ...authority.executable_bindings].some(
        (selected) => !exactKeys(selected, STANDARD_BINDING_KEYS),
      )) {
    fail('WORK2_RECOVERY_BINDING_DRIFT');
  }
  return { authority, input, effectivePaths, exactGit };
}

function expectedRecoveryPrecondition(recovery) {
  if (!recovery) return null;
  const runnerBinding = recovery.authority.executable_bindings.find(
    (selected) => selected.path === RECOVERY_RUNNER_PATH,
  );
  if (!runnerBinding) fail('WORK2_RECOVERY_BINDING_DRIFT', RECOVERY_RUNNER_PATH);
  return {
    schema_version: RECEIPT_RECOVERY_SCHEMA,
    correction_authority_binding: standardRecordBinding(
      RECOVERY_AUTHORITY_PATH, recovery.input, 'correction_authority_id',
    ),
    recovery_runner_binding: structuredClone(runnerBinding),
    superseded_receipt_binding: structuredClone(STALE_OUTPUT_BINDINGS[2]),
    superseded_source_set_bindings: structuredClone(STALE_OUTPUT_BINDINGS.slice(0, 2)),
    excluded_generalisation_binding: structuredClone(EXCLUDED_GENERALISATION_BINDING),
    prior_command_run_counts: [...PRIOR_RECOVERY_RUN_COUNTS],
    prior_post_receipt_validator_run_count: 1,
    recovery_argv: structuredClone(
      RECOVERY_COMMAND_EXTENSION.appended_argv_with_run_limits[0].argv,
    ),
    recovery_run_count: 1,
    finaliser_cumulative_run_count: 2,
    validator_cumulative_run_count: 2,
    replaced_output_paths: [...OUTPUT_PATHS],
    effective_work2_paths: [...recovery.effectivePaths],
    backup_state: 'REMOVED_AFTER_VALIDATOR_PASS',
    rollback_state: 'AVAILABLE_DURING_TRANSACTION_ONLY',
  };
}

function validateReceiptRecoveryPrecondition(actual, expected) {
  if (expected === null) {
    if (actual !== undefined) fail('WORK2_RECEIPT_INVALID', 'unexpected recovery');
    return;
  }
  if (!exactKeys(actual, RECEIPT_RECOVERY_KEYS)
      || actual.schema_version !== RECEIPT_RECOVERY_SCHEMA) {
    fail('WORK2_RECEIPT_INVALID', 'receipt recovery contract');
  }
  if (!same({
    correction_authority_binding: actual.correction_authority_binding,
    recovery_runner_binding: actual.recovery_runner_binding,
    superseded_receipt_binding: actual.superseded_receipt_binding,
    superseded_source_set_bindings: actual.superseded_source_set_bindings,
    excluded_generalisation_binding: actual.excluded_generalisation_binding,
  }, {
    correction_authority_binding: expected.correction_authority_binding,
    recovery_runner_binding: expected.recovery_runner_binding,
    superseded_receipt_binding: expected.superseded_receipt_binding,
    superseded_source_set_bindings: expected.superseded_source_set_bindings,
    excluded_generalisation_binding: expected.excluded_generalisation_binding,
  })) {
    fail('WORK2_RECOVERY_BINDING_DRIFT', 'receipt recovery bindings');
  }
  if (!same(actual.replaced_output_paths, expected.replaced_output_paths)
      || !same(actual.effective_work2_paths, expected.effective_work2_paths)) {
    fail('WORK2_RECOVERY_PATH_SCOPE', 'receipt recovery paths');
  }
  if (!same({
    prior_command_run_counts: actual.prior_command_run_counts,
    prior_post_receipt_validator_run_count:
      actual.prior_post_receipt_validator_run_count,
    recovery_argv: actual.recovery_argv,
    recovery_run_count: actual.recovery_run_count,
    finaliser_cumulative_run_count: actual.finaliser_cumulative_run_count,
    validator_cumulative_run_count: actual.validator_cumulative_run_count,
  }, {
    prior_command_run_counts: expected.prior_command_run_counts,
    prior_post_receipt_validator_run_count:
      expected.prior_post_receipt_validator_run_count,
    recovery_argv: expected.recovery_argv,
    recovery_run_count: expected.recovery_run_count,
    finaliser_cumulative_run_count: expected.finaliser_cumulative_run_count,
    validator_cumulative_run_count: expected.validator_cumulative_run_count,
  })) {
    fail('WORK2_COMMAND_LEDGER_DRIFT', 'receipt recovery command evidence');
  }
  if (actual.backup_state !== expected.backup_state
      || actual.rollback_state !== expected.rollback_state) {
    fail('WORK2_RECEIPT_INVALID', 'receipt recovery transaction state');
  }
}

function recordBinding(selectedPath, bytes, record, idField, code) {
  if (record.schema_version === undefined || record[idField] === undefined) {
    fail(code, `${selectedPath} record identity`);
  }
  const unsigned = structuredClone(record);
  delete unsigned[idField];
  if (contentId(record.schema_version, unsigned) !== record[idField]) {
    fail(code, `${selectedPath} content identity`);
  }
  return binding(selectedPath, bytes, record.schema_version, idField, record[idField]);
}

function identified(schemaVersion, idField, body) {
  const unsigned = { schema_version: schemaVersion, ...body };
  return { ...unsigned, [idField]: contentId(schemaVersion, unsigned) };
}

function validateManifestIdentity(manifest) {
  const unsigned = structuredClone(manifest);
  delete unsigned.execution_manifest_id;
  delete unsigned.execution_manifest_digest;
  const digest = sha256Hex(canonicalJson(unsigned));
  const id = contentId(manifest.schema_version, {
    ...unsigned,
    execution_manifest_digest: digest,
  });
  if (manifest.execution_manifest_digest !== digest || manifest.execution_manifest_id !== id) {
    fail('WORK2_MANIFEST_BINDING_DRIFT', 'manifest identity');
  }
}

function selectedNativeBindings(receipt, schemaVersion, excludedSchema, excludedPath) {
  if (receipt.schema_version !== 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1'
      || receipt.status !== 'PASS' || receipt.lifecycle_state !== 'SEALED'
      || !Array.isArray(receipt.output_bindings)) {
    fail('WORK2_SOURCE_SET_DRIFT', `${receipt.packet_id} receipt state`);
  }
  const selected = receipt.output_bindings.filter(
    (entry) => entry.schema_version === schemaVersion,
  );
  const excluded = receipt.output_bindings.filter(
    (entry) => entry.schema_version !== schemaVersion,
  );
  if (selected.length !== 7 || excluded.length !== 1
      || excluded[0].schema_version !== excludedSchema || excluded[0].path !== excludedPath
      || !same([...selected].map((entry) => entry.agreement_id).sort(), AGREEMENT_IDS)) {
    fail('WORK2_SOURCE_SET_DRIFT', `${receipt.packet_id} output selection`);
  }
  return selected;
}

function expectedSourceSets(root) {
  const m3 = readCanonical(root, M3_RECEIPT_PATH, 'WORK2_SOURCE_SET_DRIFT');
  const m4 = readCanonical(root, M4_RECEIPT_PATH, 'WORK2_SOURCE_SET_DRIFT');
  if (m3.record.packet_id !== 'stage-2y-structure-m3-context-compilation'
      || m4.record.packet_id !== 'stage-2y-structure-m4-agreement-analysis') {
    fail('WORK2_SOURCE_SET_DRIFT', 'native receipt packet IDs');
  }
  const m3Bindings = selectedNativeBindings(
    m3.record, 'CONTEXT_COMPILATION/V1', 'STAGE_2Y_M3_CONTEXT_DIAGNOSTICS/V1',
    `${MIGRATION_ROOT}/shadow/m3/context-compilation-diagnostics.json`,
  );
  const m4Bindings = selectedNativeBindings(
    m4.record, 'AGREEMENT_ANALYSIS/V1', 'STAGE_2Y_M4_RESOLUTION_SET_DIFF/V1',
    `${MIGRATION_ROOT}/shadow/m4/resolution-set-diff.json`,
  );
  const contexts = new Map();
  for (const receiptBinding of m3Bindings) {
    const source = readCanonical(root, receiptBinding.path, 'WORK2_SOURCE_SET_DRIFT');
    const selectedBinding = recordBinding(
      receiptBinding.path, source.bytes, source.record, 'context_compilation_id',
      'WORK2_SOURCE_SET_DRIFT',
    );
    if (source.record.schema_version !== receiptBinding.schema_version
        || source.record.context_compilation_id !== receiptBinding.context_compilation_id
        || source.record.agreement_index_binding?.agreement_index_id
          !== receiptBinding.agreement_index_id
        || source.bytes.length !== receiptBinding.byte_length
        || sha256Hex(source.bytes) !== receiptBinding.sha256) {
      fail('WORK2_SOURCE_SET_DRIFT', `${receiptBinding.path} binding`);
    }
    contexts.set(receiptBinding.agreement_id, { receiptBinding, selectedBinding });
  }
  const agreementMembers = [];
  const contextMembers = [];
  for (const receiptBinding of m4Bindings) {
    const source = readCanonical(root, receiptBinding.path, 'WORK2_SOURCE_SET_DRIFT');
    const selectedBinding = recordBinding(
      receiptBinding.path, source.bytes, source.record, 'agreement_analysis_id',
      'WORK2_SOURCE_SET_DRIFT',
    );
    const context = contexts.get(receiptBinding.agreement_id);
    if (!context || source.record.schema_version !== receiptBinding.schema_version
        || source.record.agreement_analysis_id !== receiptBinding.agreement_analysis_id
        || source.record.agreement_id !== receiptBinding.agreement_id
        || source.bytes.length !== receiptBinding.byte_length
        || sha256Hex(source.bytes) !== receiptBinding.sha256
        || !same(source.record.context_compilation_binding, context.receiptBinding)) {
      fail('WORK2_SOURCE_SET_DRIFT', `${receiptBinding.path} continuity`);
    }
    agreementMembers.push({
      agreement_id: receiptBinding.agreement_id,
      agreement_analysis_binding: selectedBinding,
    });
    contextMembers.push({
      agreement_id: receiptBinding.agreement_id,
      context_compilation_binding: context.selectedBinding,
    });
  }
  agreementMembers.sort((left, right) => left.agreement_id.localeCompare(right.agreement_id));
  contextMembers.sort((left, right) => left.agreement_id.localeCompare(right.agreement_id));
  return {
    m3,
    m4,
    agreementSet: identified('AGREEMENT_ANALYSIS_SET/V1', 'agreement_analysis_set_id', {
      members: agreementMembers,
    }),
    contextSet: identified('CONTEXT_COMPILATION_SET/V1', 'context_compilation_set_id', {
      members: contextMembers,
    }),
  };
}

function validateWork0SourceContinuity(root, work1, m3, m4) {
  if (work1.record.schema_version
      !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1'
      || work1.record.state !== 'PASS_WORK1_CONTRACTS' || work1.record.status !== 'PASS') {
    fail('WORK2_PREDECESSOR_BINDING_DRIFT', 'Work1 receipt state');
  }
  const work0 = readCanonical(root, WORK0_PATH, 'WORK2_SOURCE_SET_DRIFT');
  const expectedWork0Binding = recordBinding(
    WORK0_PATH, work0.bytes, work0.record, 'evidence_root_id', 'WORK2_SOURCE_SET_DRIFT',
  );
  if (!same(work1.record.work0_evidence_root_binding, expectedWork0Binding)
      || work0.record.schema_version
        !== 'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1'
      || work0.record.lifecycle_state !== 'SEALED_WORK0_ONLY'
      || work0.record.status !== 'PASS_WORK0_EVIDENCE_ROOT_ONLY'
      || !Array.isArray(work0.record.evidence_input_bindings)) {
    fail('WORK2_SOURCE_SET_DRIFT', 'Work0 evidence-root continuity');
  }
  const expected = [
    {
      ordinal: 11,
      role: 'M3_SEALED_RECEIPT',
      path: M3_RECEIPT_PATH,
      source: m3,
      packetId: 'stage-2y-structure-m3-context-compilation',
    },
    {
      ordinal: 12,
      role: 'M4_SEALED_RECEIPT',
      path: M4_RECEIPT_PATH,
      source: m4,
      packetId: 'stage-2y-structure-m4-agreement-analysis',
    },
  ];
  for (const spec of expected) {
    const matches = work0.record.evidence_input_bindings.filter(
      (entry) => entry.ordinal === spec.ordinal,
    );
    const entry = matches[0];
    if (matches.length !== 1 || entry.role !== spec.role || entry.path !== spec.path
        || entry.schema_version !== 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1'
        || entry.record_id_field !== 'packet_id' || entry.record_id !== spec.packetId
        || entry.byte_length !== spec.source.bytes.length
        || entry.sha256 !== sha256Hex(spec.source.bytes)
        || entry.binding_source !== 'ADOPTED_PLAN_COMMIT_BLOB'
        || entry.purpose !== 'PROVENANCE_ONLY' || entry.v2_admissible !== false
        || spec.source.record.packet_id !== spec.packetId) {
      fail('WORK2_SOURCE_SET_DRIFT', `${spec.role} Work0 binding`);
    }
  }
}

function validateStandardClaimedBinding(root, claimed, expectedPath, code) {
  if (claimed?.path !== expectedPath || typeof claimed.record_id_field !== 'string') {
    fail(code, expectedPath);
  }
  const source = readCanonical(root, expectedPath, code);
  const expected = recordBinding(
    expectedPath, source.bytes, source.record, claimed.record_id_field, code,
  );
  if (!same(claimed, expected)) fail(code, expectedPath);
  return source;
}

function validateParentAuthority(root, claimed) {
  if (claimed?.path !== PARENT_AUTHORITY_PATH || typeof claimed.authority_id !== 'string'
      || typeof claimed.authority_digest !== 'string') {
    fail('WORK2_AUTHORITY_BINDING_DRIFT', 'parent authority shape');
  }
  const source = readCanonical(root, claimed.path, 'WORK2_AUTHORITY_BINDING_DRIFT');
  if (source.record.schema_version !== claimed.schema_version
      || source.record.authority_id !== claimed.authority_id
      || source.record.authority_digest !== claimed.authority_digest
      || source.bytes.length !== claimed.byte_length
      || sha256Hex(source.bytes) !== claimed.sha256) {
    fail('WORK2_AUTHORITY_BINDING_DRIFT', 'parent authority binding');
  }
}

function validateBuildOnlyState(root, manifest, orderingAuthority, inspectCurrentCandidateRoot) {
  validateManifestIdentity(manifest);
  if (manifest.work !== 'WORK2' || manifest.state !== 'PRE_WORK_BOOTSTRAP_ONLY'
      || manifest.work_receipt_path !== RECEIPT_PATH
      || manifest.candidate_registration_binding !== null
      || manifest.candidate_transition !== null
      || manifest.candidate_ordering_correction_authority_binding?.record_id
        !== orderingAuthority.correction_authority_id) {
    fail('WORK2_BUILD_ONLY_ORDERING_DRIFT', 'manifest state');
  }
  const candidateAbsolute = path.join(root, CANDIDATE_ROOT);
  if (inspectCurrentCandidateRoot && existsSync(candidateAbsolute)) {
    const stat = lstatSync(candidateAbsolute);
    if (!stat.isDirectory() || stat.isSymbolicLink() || readdirSync(candidateAbsolute).length !== 0) {
      fail('WORK2_BUILD_ONLY_ORDERING_DRIFT', 'candidate registration root');
    }
  }
}

function artifactIdentity(selectedPath, bytes, record = null) {
  const known = new Map([
    [ORDERING_AUTHORITY_PATH, 'correction_authority_id'],
    [ENTRY_AUTHORITY_PATH, 'correction_authority_id'],
    [RECOVERY_AUTHORITY_PATH, 'correction_authority_id'],
    [MANIFEST_PATH, 'execution_manifest_id'],
    [AGREEMENT_SET_PATH, 'agreement_analysis_set_id'],
    [CONTEXT_SET_PATH, 'context_compilation_set_id'],
  ]);
  const idField = known.get(selectedPath);
  return idField === undefined
    ? binding(selectedPath, bytes)
    : binding(selectedPath, bytes, record.schema_version, idField, record[idField]);
}

function expectedLedger(manifest, executionFixture, recoveryAuthority) {
  const commandRunCounts = executionFixture.command_run_counts;
  const commands = effectiveCommandPolicy(manifest, recoveryAuthority);
  const expectedCounts = recoveryAuthority
    ? RECOVERED_RECEIPT_RUN_COUNTS : STALE_RECEIPT_RUN_COUNTS;
  if (!Array.isArray(commands)
      || !Array.isArray(commandRunCounts)
      || commands.length !== commandRunCounts.length
      || commandRunCounts.some(
        (count) => !Number.isSafeInteger(count) || count < 0,
      )
      || commandRunCounts.some(
        (count, index) => count > commands[index].max_runs,
      )
      || !same(commandRunCounts, expectedCounts)) {
    fail('WORK2_COMMAND_LEDGER_DRIFT', 'manifest argv or counts');
  }
  return commands.map((entry, index) => ({
    argv: structuredClone(entry.argv),
    run_count: commandRunCounts[index],
    state: index < 12 ? 'COMPLETED_BEFORE_RECEIPT' : recoveryAuthority
      ? index === 12 ? 'CUMULATIVE_ONE_INITIAL_ONE_RECOVERY_WRITES_THIS_RECEIPT'
        : index === 13 ? 'CUMULATIVE_ONE_INITIAL_ONE_REQUIRED_AFTER_THIS_RECEIPT'
          : 'RUNNER_WRITES_THIS_RECEIPT_AND_COMPLETES_AFTER_VALIDATOR_PASS'
      : index === 12 ? 'WRITES_TWO_SOURCE_SETS_AND_THIS_RECEIPT'
        : 'REQUIRED_AFTER_THIS_RECEIPT',
  }));
}

function validateReceiptIdentity(receipt) {
  if (Object.keys(receipt).length !== RECEIPT_KEYS.length
      || !RECEIPT_KEYS.every((key) => Object.hasOwn(receipt, key))) {
    fail('WORK2_RECEIPT_INVALID', 'receipt members');
  }
  const unsigned = structuredClone(receipt);
  delete unsigned.work2_receipt_id;
  if (receipt.schema_version !== RECEIPT_SCHEMA
      || receipt.work2_receipt_id !== contentId(RECEIPT_SCHEMA, unsigned)) {
    fail('WORK2_RECEIPT_INVALID', 'receipt identity');
  }
}

function validateReceipt(root, {
  claimedReceiptBinding = null,
  inspectCurrentCandidateRoot = true,
} = {}) {
  const manifestInput = readCanonical(root, MANIFEST_PATH, 'WORK2_MANIFEST_BINDING_DRIFT');
  const orderingInput = readCanonical(
    root, ORDERING_AUTHORITY_PATH, 'WORK2_AUTHORITY_BINDING_DRIFT',
  );
  const entryInput = readCanonical(root, ENTRY_AUTHORITY_PATH, 'WORK2_AUTHORITY_BINDING_DRIFT');
  const recoveryInput = readOptionalCanonical(
    root, RECOVERY_AUTHORITY_PATH, 'WORK2_RECOVERY_AUTHORITY_INVALID',
  );
  const executionFixtureInput = readCanonical(
    root, EXECUTION_FIXTURE_PATH, 'WORK2_COMMAND_LEDGER_DRIFT',
  );
  const receiptInput = readCanonical(root, RECEIPT_PATH, 'WORK2_RECEIPT_INVALID');
  const agreementInput = readCanonical(root, AGREEMENT_SET_PATH, 'WORK2_SOURCE_SET_DRIFT');
  const contextInput = readCanonical(root, CONTEXT_SET_PATH, 'WORK2_SOURCE_SET_DRIFT');
  const manifest = manifestInput.record;
  const orderingAuthority = orderingInput.record;
  const executionFixture = executionFixtureInput.record;
  const receipt = receiptInput.record;
  if (executionFixture.schema_version
      !== 'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_CASES/V1'
      || executionFixture.state !== 'BUILD_ONLY_SOURCE_SET_AND_RECEIPT_ACCEPTANCE'
      || !same(executionFixture.case_ids, CASE_IDS)
      || !same(Object.keys(executionFixture).sort(), [
        'case_ids', 'combined_test_result', 'command_run_counts', 'schema_version', 'state',
      ])
      || !same(Object.keys(executionFixture.combined_test_result ?? {}).sort(), [
        'semantic_run_count', 'status', 'test_file_count',
      ])
      || executionFixture.combined_test_result.status !== 'PASS'
      || executionFixture.combined_test_result.semantic_run_count !== 0
      || executionFixture.combined_test_result.test_file_count !== 2
      || executionFixture.command_run_counts?.[8] < 1) {
    fail('WORK2_COMMAND_LEDGER_DRIFT', 'execution fixture');
  }
  if (orderingAuthority.schema_version
      !== 'STAGE_2Y_M7_V2_REPAIR_WORK2_4_CANDIDATE_ORDERING_CORRECTION_AUTHORITY/V1'
      || orderingAuthority.authority_state
        !== 'BEN_AUTHORISED_SINGLE_WORK2_4_CANDIDATE_ORDERING_CORRECTION'
      || orderingAuthority.approver !== 'BEN_GOODCHILD') {
    fail('WORK2_AUTHORITY_BINDING_DRIFT', 'ordering authority state');
  }
  if (entryInput.record.schema_version
      !== 'STAGE_2Y_M7_V2_REPAIR_WORK2_ENTRY_CORRECTION_AUTHORITY/V1'
      || entryInput.record.authority_state !== 'BEN_AUTHORISED_SINGLE_WORK2_ENTRY_CORRECTION'
      || entryInput.record.approver !== 'BEN_GOODCHILD') {
    fail('WORK2_AUTHORITY_BINDING_DRIFT', 'entry authority state');
  }
  validateReceiptIdentity(receipt);
  if (claimedReceiptBinding !== null) {
    const expectedReceiptBinding = recordBinding(
      RECEIPT_PATH,
      receiptInput.bytes,
      receipt,
      'work2_receipt_id',
      'WORK2_RECEIPT_INVALID',
    );
    if (!same(claimedReceiptBinding, expectedReceiptBinding)) {
      fail('WORK2_RECEIPT_INVALID', 'receipt binding');
    }
  }
  validateBuildOnlyState(root, manifest, orderingAuthority, inspectCurrentCandidateRoot);

  const orderingBinding = recordBinding(
    ORDERING_AUTHORITY_PATH, orderingInput.bytes, orderingAuthority,
    'correction_authority_id', 'WORK2_AUTHORITY_BINDING_DRIFT',
  );
  const entryBinding = recordBinding(
    ENTRY_AUTHORITY_PATH, entryInput.bytes, entryInput.record,
    'correction_authority_id', 'WORK2_AUTHORITY_BINDING_DRIFT',
  );
  if (!same(manifest.candidate_ordering_correction_authority_binding, orderingBinding)
      || !same(orderingAuthority.work2_entry_correction_authority_binding, entryBinding)) {
    fail('WORK2_AUTHORITY_BINDING_DRIFT', 'correction authorities');
  }
  const recovery = validateRecoveryAuthority(
    root, recoveryInput, manifestInput, orderingInput, entryInput,
  );
  validateReceiptRecoveryPrecondition(
    receipt.repository_precondition?.recovery,
    expectedRecoveryPrecondition(recovery),
  );
  validateParentAuthority(root, manifest.parent_authority_binding);
  validateStandardClaimedBinding(
    root, manifest.activation_receipt_binding, ACTIVATION_RECEIPT_PATH,
    'WORK2_AUTHORITY_BINDING_DRIFT',
  );
  const work1Input = validateStandardClaimedBinding(
    root, manifest.predecessor_receipt_binding, WORK1_RECEIPT_PATH,
    'WORK2_PREDECESSOR_BINDING_DRIFT',
  );
  if (!same(orderingAuthority.parent_authority_binding, manifest.parent_authority_binding)
      || !same(orderingAuthority.activation_receipt_binding, manifest.activation_receipt_binding)
      || !same(orderingAuthority.work1_receipt_binding, manifest.predecessor_receipt_binding)
      || !same(entryInput.record.activation_receipt_binding,
        manifest.activation_receipt_binding)
      || !same(entryInput.record.work1_receipt_binding, manifest.predecessor_receipt_binding)
      || entryInput.record.parent_authority_binding?.path
        !== manifest.parent_authority_binding.path
      || entryInput.record.parent_authority_binding?.record_id
        !== manifest.parent_authority_binding.authority_id
      || entryInput.record.parent_authority_binding?.sha256
        !== manifest.parent_authority_binding.sha256) {
    fail('WORK2_AUTHORITY_BINDING_DRIFT', 'authority lineage');
  }

  const sources = expectedSourceSets(root);
  validateWork0SourceContinuity(root, work1Input, sources.m3, sources.m4);
  recordBinding(
    AGREEMENT_SET_PATH, agreementInput.bytes, agreementInput.record,
    'agreement_analysis_set_id', 'WORK2_SOURCE_SET_DRIFT',
  );
  recordBinding(
    CONTEXT_SET_PATH, contextInput.bytes, contextInput.record,
    'context_compilation_set_id', 'WORK2_SOURCE_SET_DRIFT',
  );
  if (!same(agreementInput.record, sources.agreementSet)
      || !same(contextInput.record, sources.contextSet)) {
    fail('WORK2_SOURCE_SET_DRIFT', 'source-set records');
  }

  const effectivePaths = recovery ? recovery.effectivePaths : baseEffectivePaths(manifest);
  const expectedPaths = [MANIFEST_PATH, ...manifest.permitted_write_paths].sort();
  if ((!recovery && (effectivePaths.length !== 22 || !same(effectivePaths, expectedPaths)))
      || (recovery && (effectivePaths.length !== 23
        || !same(effectivePaths, recovery.authority.effective_work2_paths)))
      || !same(effectivePaths.filter((entry) => OUTPUT_PATHS.includes(entry)), OUTPUT_PATHS)) {
    fail('WORK2_MANIFEST_BINDING_DRIFT', 'effective Work2 paths');
  }

  const artifactBindings = [];
  for (const selectedPath of effectivePaths.filter((entry) => entry !== RECEIPT_PATH)) {
    const selected = readBytes(root, selectedPath, 'WORK2_ARTIFACT_BINDING_DRIFT');
    let record = null;
    if ([ORDERING_AUTHORITY_PATH, ENTRY_AUTHORITY_PATH, RECOVERY_AUTHORITY_PATH, MANIFEST_PATH,
      AGREEMENT_SET_PATH, CONTEXT_SET_PATH].includes(selectedPath)) {
      try {
        record = JSON.parse(selected.toString('utf8'));
      } catch {
        fail('WORK2_ARTIFACT_BINDING_DRIFT', selectedPath);
      }
    }
    artifactBindings.push(artifactIdentity(selectedPath, selected, record));
  }
  const expectedArtifactCount = recovery ? 22 : 21;
  if (artifactBindings.length !== expectedArtifactCount
      || new Set(artifactBindings.map((entry) => entry.path)).size !== expectedArtifactCount
      || !same(receipt.artifact_bindings, artifactBindings)
      || receipt.artifact_set_digest !== sha256Hex(canonicalJson(artifactBindings))) {
    fail('WORK2_ARTIFACT_BINDING_DRIFT', 'artifact inventory');
  }
  const artifactByPath = new Map(artifactBindings.map((entry) => [entry.path, entry]));
  const expectedSourceEvidence = {
    m3_context_compilation_receipt_binding: binding(M3_RECEIPT_PATH, sources.m3.bytes),
    m4_agreement_analysis_receipt_binding: binding(M4_RECEIPT_PATH, sources.m4.bytes),
    agreement_analysis_set_binding: artifactByPath.get(AGREEMENT_SET_PATH),
    context_compilation_set_binding: artifactByPath.get(CONTEXT_SET_PATH),
    agreement_ids: [...AGREEMENT_IDS],
  };
  if (!same(receipt.source_set_evidence, expectedSourceEvidence)) {
    fail('WORK2_SOURCE_SET_DRIFT', 'receipt evidence');
  }

  const expectedCompilerEvidence = {
    compiler_binding: artifactByPath.get('lib/canonical-v2/agreement-analysis-consolidation.js'),
    deterministic_generator_binding: artifactByPath.get('lib/canonical-v2/m7-v2-deterministic-generator.js'),
    contract_validator_binding: artifactByPath.get('lib/canonical-v2/m7-v2-contract.js'),
    contract_test_binding: artifactByPath.get('tests/stage-2y-structure-m7-v2-repair-contract.test.js'),
    work2_test_binding: artifactByPath.get('tests/stage-2y-structure-m7-v2-repair-work2.test.js'),
    public_exports: ['buildSourceSets', 'consolidateAnalysis', 'consolidateLegacyAnalysisV1'],
    input_members: [
      'baseAnalysis', 'agreementIndex', 'contextCompilation', 'approvedFamilyPackets',
      'approvedFamilyProfileSet', 'approvedStructureDispositions', 'governance',
    ],
    output_schema_version: 'AGREEMENT_ANALYSIS/V2',
    source_set_ids: {
      agreement_analysis_set_id: agreementInput.record.agreement_analysis_set_id,
      context_compilation_set_id: contextInput.record.context_compilation_set_id,
    },
    proof_states: {
      independent_oracle_equality: true,
      repeat_determinism: true,
      input_immutability: true,
      public_validator_pass: true,
    },
  };
  if (!same(receipt.compiler_evidence, expectedCompilerEvidence)) {
    fail('WORK2_COMPILER_EVIDENCE_DRIFT', 'compiler evidence');
  }

  const ledger = expectedLedger(manifest, executionFixture, recovery);
  if (!same(receipt.command_execution_ledger, ledger)
      || !same(receipt.combined_test_result, {
        argv: structuredClone(manifest.exact_argv_with_run_limits[8].argv),
        ...structuredClone(executionFixture.combined_test_result),
      })) {
    fail('WORK2_COMMAND_LEDGER_DRIFT', 'execution evidence');
  }

  const expectedRepository = {
    proof_state: recovery
      ? 'ORCHESTRATOR_VERIFIED_PRE_COMMIT_RECOVERY_EXTERNAL_TO_FINALISER'
      : 'ORCHESTRATOR_VERIFIED_EXTERNAL_TO_FINALISER',
    effective_work2_paths: effectivePaths,
    generated_paths_absent: [...OUTPUT_PATHS],
    candidate_registration_root_state: 'EMPTY',
    exact_git_commit_and_push_argv: structuredClone(
      effectiveCommitArgv(manifest, effectivePaths, recovery),
    ),
    required_validator_argv: structuredClone(manifest.exact_argv_with_run_limits[13].argv),
  };
  const recoveryMember = expectedRecoveryPrecondition(recovery);
  if (recoveryMember) expectedRepository.recovery = recoveryMember;
  const expectedCounts = {
    effective_work2_path_count: recovery ? 23 : 22,
    artifact_binding_count: expectedArtifactCount,
    source_set_output_count: 2,
    agreement_analysis_set_member_count: 7,
    context_compilation_set_member_count: 7,
    compiler_public_export_count: 3,
    candidate_registration_count: 0,
    candidate_transition_count: 0,
    semantic_run_count: 0,
  };
  const expectedEffects = {
    files_written: 3,
    source_set_writes: 2,
    receipt_writes: 1,
    ...EXTERNAL_ZERO_EFFECTS,
  };
  const expectedNext = {
    work3_authorised_under_parent_authority: true,
    work3_execution_manifest_required_before_first_command: true,
    work3_candidate_registration_id: null,
    work3_candidate_transition: null,
    first_candidate_stage: 'WORK4',
    work4_must_bind_exact_work2_source_sets: true,
  };
  if (receipt.work !== 'WORK2' || receipt.stage !== 'M7_V2_REPAIR_WORK2'
      || receipt.state !== 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE' || receipt.status !== 'PASS'
      || receipt.execution_manifest_id !== manifest.execution_manifest_id
      || receipt.execution_manifest_digest !== manifest.execution_manifest_digest
      || !same(receipt.parent_authority_binding, manifest.parent_authority_binding)
      || !same(receipt.activation_receipt_binding, manifest.activation_receipt_binding)
      || !same(receipt.predecessor_receipt_binding, manifest.predecessor_receipt_binding)
      || !same(receipt.work2_entry_correction_authority_binding, entryBinding)
      || !same(receipt.candidate_ordering_correction_authority_binding, orderingBinding)
      || receipt.candidate_registration_id !== null || receipt.candidate_transition !== null
      || !same(receipt.repository_precondition, expectedRepository)
      || !same(receipt.counts, expectedCounts)
      || !same(receipt.checks, CHECK_IDS.map((check_id) => ({ check_id, status: 'PASS' })))
      || !same(receipt.effects, expectedEffects)
      || !same(receipt.next_work, expectedNext)) {
    fail('WORK2_RECEIPT_INVALID', 'receipt contract');
  }
  return { receipt, agreementSet: agreementInput.record, contextSet: contextInput.record };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const member of Object.values(value)) deepFreeze(member);
    Object.freeze(value);
  }
  return value;
}

export function validateWork2(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    fail('WORK2_RECEIPT_INVALID', 'options');
  }
  const keys = Object.keys(options);
  if (keys.some((key) => key !== 'repoRoot')) fail('WORK2_RECEIPT_INVALID', 'options');
  const root = rootPath(options.repoRoot ?? REPO_ROOT);
  const validated = validateReceipt(root);
  return validationResult(validated);
}

function validationResult(validated) {
  return deepFreeze({
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK2_VALIDATION/V1',
    status: 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE',
    work2_receipt_id: validated.receipt.work2_receipt_id,
    execution_manifest_id: validated.receipt.execution_manifest_id,
    agreement_analysis_set_id: validated.agreementSet.agreement_analysis_set_id,
    context_compilation_set_id: validated.contextSet.context_compilation_set_id,
    counts: structuredClone(validated.receipt.counts),
    effects: structuredClone(validated.receipt.effects),
  });
}

export function validateWork2ReceiptBinding(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || !same(Object.keys(options).sort(), ['binding', 'repoRoot'])
      || typeof options.repoRoot !== 'string' || options.repoRoot.length === 0) {
    fail('WORK2_RECEIPT_INVALID', 'options');
  }
  const binding = options.binding;
  if (binding?.path !== RECEIPT_PATH
      || binding.schema_version !== RECEIPT_SCHEMA
      || binding.record_id_field !== 'work2_receipt_id') {
    fail('WORK2_RECEIPT_INVALID', 'receipt binding contract');
  }
  const root = rootPath(options.repoRoot);
  const validated = validateReceipt(root, {
    claimedReceiptBinding: binding,
    inspectCurrentCandidateRoot: false,
  });
  return validationResult(validated);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) fail('WORK2_RECEIPT_INVALID', 'CLI arguments');
    process.stdout.write(`${JSON.stringify(validateWork2())}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
