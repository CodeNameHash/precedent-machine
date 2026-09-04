#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  copyFileSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const PARENT_AUTHORITY_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work1-7-authority.json`;
const ACTIVATION_PATH =
  `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json`;
const WORK0_PATH =
  `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json`;
const WORK1_RECEIPT_PATH =
  `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json`;
const ENTRY_AUTHORITY_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work2-entry-correction-authority.json`;
const ORDERING_AUTHORITY_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work2-4-candidate-ordering-correction-authority.json`;
const CORRECTION_AUTHORITY_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work2-recovery-authority.json`;
const MANIFEST_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work2-execution-manifest.json`;
const AGREEMENT_SET_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work2-agreement-analysis-set.json`;
const CONTEXT_SET_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work2-context-compilation-set.json`;
const RECEIPT_PATH =
  `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work2-compiler.json`;
const GENERALISATION_PATH = 'scripts/stage-2y-structure-generalisation-shadow.mjs';
const EXECUTION_MANIFEST_VALIDATOR_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
const FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs';
const RUNNER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-recover.mjs';
const EXECUTION_MANIFEST_TEST_PATH =
  'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js';
const WORK2_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-work2.test.js';
const CORRECTION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK2_COMMIT_DELTA_RECOVERY_AUTHORITY/V1';
const CORRECTION_APPROVAL_ID =
  'BEN-M7-V2-WORK2-COMMIT-DELTA-RECOVERY-20260815';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_RECEIPT/V1';
const RECEIPT_RECOVERY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK2_RECEIPT_RECOVERY/V1';
const BRANCH = 'codex/recover-m7-20260812';
const WORK1_COMMIT = '21d9c29c47130090dbbf345dd028e030b61b9e44';
const TARGET_PATHS = Object.freeze([AGREEMENT_SET_PATH, CONTEXT_SET_PATH, RECEIPT_PATH]);
const PATH_REMOVAL = Object.freeze([GENERALISATION_PATH]);
const PATH_EXTENSION = Object.freeze([CORRECTION_AUTHORITY_PATH, RUNNER_PATH]);
const EXECUTABLE_PATHS = Object.freeze([
  EXECUTION_MANIFEST_VALIDATOR_PATH,
  FINALISER_PATH,
  VALIDATOR_PATH,
  RUNNER_PATH,
  EXECUTION_MANIFEST_TEST_PATH,
  WORK2_TEST_PATH,
]);
const BINDING_KEYS = Object.freeze([
  'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length', 'sha256',
  'git_blob_oid',
]);
const AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state',
  'approved_on', 'approver', 'ben_approval_id', 'approval_text', 'discovered_defect',
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
const STALE_RECEIPT_RUN_COUNTS = Object.freeze([
  4, 1, 1, 1, 1, 1, 1, 1, 13, 3, 8, 2, 1, 0,
]);
const PRIOR_RECOVERY_RUN_COUNTS = Object.freeze([
  5, 1, 1, 1, 1, 1, 10, 10, 22, 3, 10, 3, 1, 1,
]);
const RECOVERED_RECEIPT_RUN_COUNTS = Object.freeze([
  5, 1, 1, 1, 1, 1, 10, 10, 22, 3, 10, 3, 2, 2, 1,
]);
const COMMAND_EXTENSION = Object.freeze({
  base_command_count: 14,
  run_limit_overrides: [
    { command_index: 0, max_runs: 5 },
    { command_index: 10, max_runs: 10 },
    { command_index: 11, max_runs: 3 },
    { command_index: 12, max_runs: 2 },
  ],
  appended_argv_with_run_limits: [{
    argv: ['node', RUNNER_PATH, '--authority', CORRECTION_AUTHORITY_PATH],
    max_runs: 1,
  }],
  prior_receipt_run_counts: PRIOR_RECOVERY_RUN_COUNTS,
  prior_post_receipt_validator_run_count: 1,
  recovered_receipt_run_counts: RECOVERED_RECEIPT_RUN_COUNTS,
  required_validator_cumulative_run_count: 2,
  additional_git_add_commit_push_runs: 0,
});
const AUTHORISED_SCOPE = Object.freeze([
  'PRESERVE_PARENT_AUTHORITIES_MANIFEST_AND_GENERALISATION_BYTES',
  'SUPERSEDE_ONLY_THE_UNCOMMITTED_WORK2_COMMIT_DELTA',
  'EXCLUDE_UNCHANGED_BUILD_ONLY_GENERALISATION_RUNNER',
  'ADD_ONLY_THIS_AUTHORITY_AND_THE_ONE_SHOT_RECOVERY_RUNNER',
  'REPLACE_ONLY_THE_THREE_UNCOMMITTED_WORK2_GENERATED_OUTPUTS',
  'RUN_WORK2_FINALISER_EXACTLY_ONCE_MORE',
  'RUN_WORK2_VALIDATOR_EXACTLY_ONCE_IN_RECOVERY',
  'COMMIT_AND_PUSH_THE_EFFECTIVE_TWENTY_THREE_PATH_WORK2_DELTA_ONLY',
]);
const ALLOWED_EFFECTS = Object.freeze({
  deterministic_local_reads: true,
  system_temp_backup_directories: 1,
  work2_generated_output_replacements: 3,
  local_subprocess_runs: 5,
  repository_commits: 0,
  repository_pushes: 0,
});
const PROHIBITED_EFFECTS = Object.freeze({
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
const SUCCESS_CONDITIONS = Object.freeze([
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
  { path: EXECUTION_MANIFEST_VALIDATOR_PATH, schema_version: null,
    record_id_field: null, record_id: null, byte_length: 105736,
    sha256: '6e46378ce965c404e05a1da6c18cfc08c6a050087540e77fbc763f8d3ed19ec6',
    git_blob_oid: '26ab05f929918296f8195d98ca000c2fe998f043' },
  { path: WORK2_TEST_PATH, schema_version: null, record_id_field: null, record_id: null,
    byte_length: 26780, sha256: '47b4201f950ef9e32d77605ddadca4305b56a51447925efd245b28439531d990',
    git_blob_oid: 'c1bd0d78fea7210f589e74e0fa4f70553ab3c0bf' },
  { path: EXECUTION_MANIFEST_TEST_PATH, schema_version: null,
    record_id_field: null, record_id: null, byte_length: 159488,
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
const ROLLBACK = Object.freeze({
  backup_root: 'SYSTEM_TEMP_MKDTEMP_ONLY',
  backup_mode: 'EXACT_BYTES_BEFORE_ANY_REMOVAL',
  restore_on_finaliser_or_validator_failure: true,
  remove_only_new_outputs_before_restore: true,
  retain_backup_on_restore_failure: true,
  second_attempt: 'REJECT_BEFORE_MUTATION',
  protected_paths_never_removed: [
    WORK0_PATH,
    PARENT_AUTHORITY_PATH,
    ACTIVATION_PATH,
    WORK1_RECEIPT_PATH,
    ENTRY_AUTHORITY_PATH,
    ORDERING_AUTHORITY_PATH,
    MANIFEST_PATH,
    CORRECTION_AUTHORITY_PATH,
    GENERALISATION_PATH,
  ],
});
const ZERO_EFFECTS = Object.freeze({
  system_temp_backup_directories: 0,
  work2_generated_output_replacements: 0,
  local_subprocess_runs: 0,
  repository_commits: 0,
  repository_pushes: 0,
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

export class Work2RecoveryError extends Error {
  constructor(code, detail = '') {
    super(detail === '' ? code : `${code}: ${detail}`);
    this.name = 'Work2RecoveryError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new Work2RecoveryError(code, detail);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function exactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && same(Object.keys(value).sort(), [...keys].sort());
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

function splitRepositoryPath(repositoryPath) {
  if (typeof repositoryPath !== 'string' || repositoryPath === ''
      || path.isAbsolute(repositoryPath) || repositoryPath.includes('\\')) {
    fail('RECOVERY_PATH_SCOPE', String(repositoryPath));
  }
  const parts = repositoryPath.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    fail('RECOVERY_PATH_SCOPE', repositoryPath);
  }
  return parts;
}

function sameInode(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function closeDescriptors(descriptors) {
  for (const descriptor of [...descriptors].reverse()) {
    try { closeSync(descriptor); } catch { /* the public boundary reports the primary failure */ }
  }
}

function directoryGuard(root, repositoryPath, code = 'RECOVERY_OUTPUT_SAFETY') {
  const parts = splitRepositoryPath(repositoryPath);
  const directories = [root, ...parts.slice(0, -1).map(
    (_, index) => path.join(root, ...parts.slice(0, index + 1)),
  )];
  const guarded = [];
  try {
    for (const absolute of directories) {
      const descriptor = openSync(
        absolute,
        fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
      );
      const descriptorStat = fstatSync(descriptor);
      const pathStat = lstatSync(absolute);
      if (!descriptorStat.isDirectory() || pathStat.isSymbolicLink()
          || !pathStat.isDirectory() || !sameInode(descriptorStat, pathStat)) {
        closeSync(descriptor);
        fail(code, repositoryPath);
      }
      guarded.push({ absolute, descriptor, stat: descriptorStat });
    }
  } catch (error) {
    closeDescriptors(guarded.map((entry) => entry.descriptor));
    if (error instanceof Work2RecoveryError) throw error;
    fail(code, repositoryPath);
  }
  const validate = () => {
    try {
      for (const entry of guarded) {
        const descriptorStat = fstatSync(entry.descriptor);
        const pathStat = lstatSync(entry.absolute);
        if (!descriptorStat.isDirectory() || pathStat.isSymbolicLink()
            || !pathStat.isDirectory() || !sameInode(entry.stat, descriptorStat)
            || !sameInode(descriptorStat, pathStat)) {
          fail(code, repositoryPath);
        }
      }
    } catch (error) {
      if (error instanceof Work2RecoveryError) throw error;
      fail(code, repositoryPath);
    }
  };
  return {
    absolute: path.join(root, ...parts),
    parentDescriptor: guarded.at(-1).descriptor,
    validate,
    close: () => closeDescriptors(guarded.map((entry) => entry.descriptor)),
  };
}

function readDescriptor(descriptor) {
  const chunks = [];
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  for (;;) {
    const count = readSync(descriptor, buffer, 0, buffer.length, null);
    if (count === 0) break;
    chunks.push(Buffer.from(buffer.subarray(0, count)));
  }
  return Buffer.concat(chunks);
}

function readRepositoryFile(
  root,
  repositoryPath,
  code = 'RECOVERY_BINDING_DRIFT',
  safetyCode = code,
) {
  let guard;
  let descriptor;
  try {
    guard = directoryGuard(root, repositoryPath, safetyCode);
    descriptor = openSync(
      guard.absolute,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW,
    );
    const stat = fstatSync(descriptor);
    const pathStat = lstatSync(guard.absolute);
    if (!stat.isFile() || pathStat.isSymbolicLink() || !pathStat.isFile()
        || !sameInode(stat, pathStat)) {
      fail(safetyCode, repositoryPath);
    }
    guard.validate();
    const bytes = readDescriptor(descriptor);
    const finalStat = fstatSync(descriptor);
    guard.validate();
    if (!sameInode(stat, finalStat) || stat.size !== finalStat.size) {
      fail(safetyCode, repositoryPath);
    }
    return { absolute: guard.absolute, stat: finalStat, bytes };
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail(safetyCode, repositoryPath);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* the public boundary catches a later failure */ }
    }
    guard?.close();
  }
}

function parseCanonicalRecord(root, repositoryPath, code) {
  const loaded = readRepositoryFile(root, repositoryPath, code);
  let record;
  try {
    record = JSON.parse(loaded.bytes.toString('utf8'));
  } catch {
    fail(code, repositoryPath);
  }
  if (!loaded.bytes.equals(canonicalBytes(record))) fail(code, `${repositoryPath} canonical`);
  return { ...loaded, record };
}

function standardBinding(repositoryPath, bytes, record = null, idField = null) {
  return {
    path: repositoryPath,
    schema_version: idField === null ? null : record?.schema_version,
    record_id_field: idField,
    record_id: idField === null ? null : record?.[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function currentBinding(
  root,
  repositoryPath,
  idField = null,
  code = 'RECOVERY_BINDING_DRIFT',
  safetyCode = code,
) {
  const loaded = readRepositoryFile(root, repositoryPath, code, safetyCode);
  if (idField === null) return standardBinding(repositoryPath, loaded.bytes);
  let record;
  try { record = JSON.parse(loaded.bytes.toString('utf8')); } catch { fail(code, repositoryPath); }
  if (typeof record.schema_version !== 'string' || typeof record[idField] !== 'string') {
    fail(code, repositoryPath);
  }
  return standardBinding(repositoryPath, loaded.bytes, record, idField);
}

function requireExactBinding(
  root,
  expected,
  code = 'RECOVERY_BINDING_DRIFT',
  safetyCode = code,
) {
  if (!exactKeys(expected, BINDING_KEYS)
      || !same(currentBinding(
        root,
        expected.path,
        expected.record_id_field,
        code,
        safetyCode,
      ), expected)) {
    fail(code, expected?.path ?? 'binding');
  }
}

function authorityId(record) {
  const unsigned = structuredClone(record);
  delete unsigned.correction_authority_id;
  return contentId(record.schema_version, unsigned);
}

function manifestIdentity(record) {
  const unsigned = structuredClone(record);
  delete unsigned.execution_manifest_id;
  delete unsigned.execution_manifest_digest;
  const digest = sha256Hex(canonicalJson(unsigned));
  return {
    digest,
    id: contentId(record.schema_version, { ...unsigned, execution_manifest_digest: digest }),
  };
}

function effectivePaths(basePaths) {
  if (basePaths.length !== 22 || new Set(basePaths).size !== 22
      || !basePaths.includes(GENERALISATION_PATH)
      || !basePaths.includes(ENTRY_AUTHORITY_PATH)
      || !basePaths.includes(VALIDATOR_PATH)
      || basePaths.includes(CORRECTION_AUTHORITY_PATH)
      || basePaths.includes(RUNNER_PATH)) {
    fail('RECOVERY_PATH_SCOPE', 'base paths');
  }
  const selected = basePaths.filter((repositoryPath) => repositoryPath !== GENERALISATION_PATH);
  selected.splice(selected.indexOf(ENTRY_AUTHORITY_PATH) + 1, 0, CORRECTION_AUTHORITY_PATH);
  selected.splice(selected.indexOf(VALIDATOR_PATH) + 1, 0, RUNNER_PATH);
  if (selected.length !== 23 || new Set(selected).size !== 23) {
    fail('RECOVERY_PATH_SCOPE', 'effective paths');
  }
  return selected;
}

function executableBindings(root) {
  return EXECUTABLE_PATHS.map((repositoryPath) => currentBinding(root, repositoryPath));
}

function validateAuthority(root, authorityPath) {
  if (authorityPath !== CORRECTION_AUTHORITY_PATH) fail('RECOVERY_PATH_SCOPE', authorityPath);
  const loaded = parseCanonicalRecord(root, authorityPath, 'RECOVERY_AUTHORITY_INVALID');
  const authority = loaded.record;
  if (!exactKeys(authority, AUTHORITY_KEYS)
      || authority.schema_version !== CORRECTION_AUTHORITY_SCHEMA
      || authority.correction_authority_id !== authorityId(authority)
      || authority.stage !== 'M7_V2_REPAIR_WORK2_COMMIT_DELTA_RECOVERY'
      || authority.authority_state !== 'BEN_AUTHORISED_SINGLE_WORK2_PRE_COMMIT_RECOVERY'
      || authority.approved_on !== '2026-08-15'
      || authority.approver !== 'BEN_GOODCHILD'
      || authority.ben_approval_id !== CORRECTION_APPROVAL_ID
      || authority.approval_text
        !== 'Hokay, proceed and keep proceeding. You should merge as you see fir'
      || authority.discovered_defect
        !== 'WORK2_EFFECTIVE_DELTA_INCLUDED_UNCHANGED_BUILD_ONLY_GENERALISATION_RUNNER'
      || !same(authority.authorised_scope, AUTHORISED_SCOPE)
      || !same(authority.command_extension, COMMAND_EXTENSION)
      || !same(authority.allowed_effects, ALLOWED_EFFECTS)
      || !same(authority.prohibited_effects, PROHIBITED_EFFECTS)
      || !same(authority.rollback, ROLLBACK)
      || !same(authority.success_conditions, SUCCESS_CONDITIONS)
      || !same(authority.prior_execution_state, PRIOR_EXECUTION_STATE)) {
    fail('RECOVERY_AUTHORITY_INVALID');
  }
  const manifestInput = parseCanonicalRecord(root, MANIFEST_PATH, 'RECOVERY_BINDING_DRIFT');
  const manifest = manifestInput.record;
  const identity = manifestIdentity(manifest);
  const addArgv = manifest.exact_git_commit_and_push_argv?.[0];
  if (manifest.schema_version !== 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V1'
      || manifest.work !== 'WORK2' || manifest.state !== 'PRE_WORK_BOOTSTRAP_ONLY'
      || manifest.candidate_registration_binding !== null || manifest.candidate_transition !== null
      || manifest.execution_manifest_digest !== identity.digest
      || manifest.execution_manifest_id !== identity.id
      || !Array.isArray(addArgv) || !same(addArgv.slice(0, 3), ['git', 'add', '--'])) {
    fail('RECOVERY_BINDING_DRIFT', MANIFEST_PATH);
  }
  const basePaths = addArgv.slice(3);
  const selectedPaths = effectivePaths(basePaths);
  const expectedGit = [
    ['git', 'add', '--', ...selectedPaths],
    manifest.exact_git_commit_and_push_argv[1],
    manifest.exact_git_commit_and_push_argv[2],
  ];
  const expectedBindings = {
    parent: currentBinding(root, PARENT_AUTHORITY_PATH, 'authority_id'),
    activation: currentBinding(root, ACTIVATION_PATH, 'activation_receipt_id'),
    work1: currentBinding(root, WORK1_RECEIPT_PATH, 'work1_contract_receipt_id'),
    entry: currentBinding(root, ENTRY_AUTHORITY_PATH, 'correction_authority_id'),
    ordering: currentBinding(root, ORDERING_AUTHORITY_PATH, 'correction_authority_id'),
    manifest: currentBinding(root, MANIFEST_PATH, 'execution_manifest_id'),
  };
  if (!same(authority.parent_authority_binding, expectedBindings.parent)
      || !same(authority.activation_receipt_binding, expectedBindings.activation)
      || !same(authority.work1_receipt_binding, expectedBindings.work1)
      || !same(authority.work2_entry_correction_authority_binding, expectedBindings.entry)
      || !same(authority.candidate_ordering_correction_authority_binding,
        expectedBindings.ordering)
      || !same(authority.execution_manifest_binding, expectedBindings.manifest)
      || !same(authority.stale_output_bindings, STALE_OUTPUT_BINDINGS)
      || !same(authority.excluded_generalisation_binding,
        EXCLUDED_GENERALISATION_BINDING)
      || !same(authority.source_precondition_bindings, SOURCE_PRECONDITION_BINDINGS)
      || !same(authority.executable_bindings, executableBindings(root))) {
    fail('RECOVERY_BINDING_DRIFT');
  }
  for (const binding of [
    authority.parent_authority_binding,
    authority.activation_receipt_binding,
    authority.work1_receipt_binding,
    authority.work2_entry_correction_authority_binding,
    authority.candidate_ordering_correction_authority_binding,
    authority.execution_manifest_binding,
    ...authority.stale_output_bindings,
    authority.excluded_generalisation_binding,
    ...authority.source_precondition_bindings,
    ...authority.executable_bindings,
  ]) {
    if (!exactKeys(binding, BINDING_KEYS)) fail('RECOVERY_BINDING_DRIFT', 'binding shape');
  }
  if (!same(authority.base_effective_work2_paths, basePaths)
      || !same(authority.exact_path_removal, PATH_REMOVAL)
      || !same(authority.exact_path_extension, PATH_EXTENSION)
      || !same(authority.effective_work2_paths, selectedPaths)
      || !same(authority.exact_git_commit_and_push_argv, expectedGit)) {
    fail('RECOVERY_PATH_SCOPE');
  }
  requireExactBinding(root, authority.excluded_generalisation_binding);
  return { authority, manifest, selectedPaths };
}

function receiptAlreadyRecovered(root, correctionAuthorityId) {
  try {
    const receipt = parseCanonicalRecord(root, RECEIPT_PATH, 'RECOVERY_OUTPUT_SAFETY').record;
    return receipt.repository_precondition?.recovery?.correction_authority_binding?.record_id
      === correctionAuthorityId;
  } catch (error) {
    if (error instanceof Work2RecoveryError) return false;
    throw error;
  }
}

function validateStaleOutputs(root, authority) {
  for (const binding of authority.stale_output_bindings) {
    requireExactBinding(
      root,
      binding,
      'RECOVERY_BINDING_DRIFT',
      'RECOVERY_OUTPUT_SAFETY',
    );
  }
}

function cleanChildEnvironment(extra = {}) {
  return {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    LANG: process.env.LANG ?? 'C',
    LC_ALL: 'C',
    TZ: process.env.TZ ?? 'UTC',
    ...extra,
  };
}

function parseStatusEntries(output) {
  if (output === '') return [];
  const entries = [];
  for (const line of output.trimEnd().split('\n')) {
    const status = line.slice(0, 2);
    if (!['??', ' M'].includes(status) || line[2] !== ' ' || line.length <= 3) {
      fail('RECOVERY_PATH_SCOPE', line);
    }
    entries.push({ status, path: line.slice(3) });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function worktreeState(root) {
  const result = spawnSync('/usr/bin/git', [
    'status', '--porcelain=v1', '--untracked-files=all',
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: cleanChildEnvironment({
      GIT_NO_REPLACE_OBJECTS: '1',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
    }),
  });
  if (result.status !== 0 || result.error) fail('RECOVERY_PATH_SCOPE', 'git status');
  const entries = parseStatusEntries(result.stdout);
  return { entries, paths: entries.map((entry) => entry.path) };
}

function readGitRef(gitDirectory, ref) {
  const loosePath = path.join(gitDirectory, ...ref.split('/'));
  try {
    lstatSync(loosePath);
    return readAbsoluteRegular(loosePath, 'RECOVERY_PATH_SCOPE').bytes.toString('utf8').trim();
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    if (error?.code !== 'ENOENT') fail('RECOVERY_PATH_SCOPE', ref);
  }
  const packedPath = path.join(gitDirectory, 'packed-refs');
  let packedBytes;
  try {
    packedBytes = readAbsoluteRegular(packedPath, 'RECOVERY_PATH_SCOPE').bytes;
  } catch {
    fail('RECOVERY_PATH_SCOPE', ref);
  }
  const line = packedBytes.toString('utf8').split('\n').find(
    (entry) => !entry.startsWith('#') && !entry.startsWith('^') && entry.endsWith(` ${ref}`),
  );
  if (!line) fail('RECOVERY_PATH_SCOPE', ref);
  return line.slice(0, 40);
}

function validateProductionRepositoryIdentity(root) {
  if (root !== REPO_ROOT) return;
  const gitDirectory = path.join(root, '.git');
  let stat;
  try { stat = lstatSync(gitDirectory); } catch { fail('RECOVERY_PATH_SCOPE', '.git'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('RECOVERY_PATH_SCOPE', '.git');
  const branchRef = `refs/heads/${BRANCH}`;
  if (readAbsoluteRegular(
    path.join(gitDirectory, 'HEAD'),
    'RECOVERY_PATH_SCOPE',
  ).bytes.toString('utf8').trim() !== `ref: ${branchRef}`
      || readGitRef(gitDirectory, branchRef) !== WORK1_COMMIT
      || readGitRef(gitDirectory, `refs/remotes/origin/${BRANCH}`) !== WORK1_COMMIT) {
    fail('RECOVERY_PATH_SCOPE', 'branch/head/origin');
  }
}

function validatePreflight(root, authority) {
  if (receiptAlreadyRecovered(root, authority.correction_authority_id)) {
    fail('RECOVERY_ALREADY_APPLIED');
  }
  validateStaleOutputs(root, authority);
  validateProductionRepositoryIdentity(root);
  const state = worktreeState(root);
  if (state.entries.some((entry) => !['??', ' M'].includes(entry.status))
      || !same(state.paths, [...authority.effective_work2_paths].sort())) {
    fail('RECOVERY_PATH_SCOPE', 'worktree');
  }
  return state;
}

function resultRecord(status, authority, effects) {
  return Object.freeze({
    status,
    correction_authority_id: authority.correction_authority_id,
    target_paths: Object.freeze([...TARGET_PATHS]),
    finaliser_argv: Object.freeze(['node', FINALISER_PATH]),
    validator_argv: Object.freeze(['node', VALIDATOR_PATH]),
    effects: Object.freeze({ ...effects }),
  });
}

function writeAll(descriptor, bytes) {
  let offset = 0;
  while (offset < bytes.length) offset += writeSync(descriptor, bytes, offset);
}

function writeExclusiveAbsolute(absolute, bytes, mode = 0o600) {
  const parent = path.dirname(absolute);
  const parentDescriptor = openSync(
    parent,
    fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
  );
  let descriptor;
  try {
    const parentStat = fstatSync(parentDescriptor);
    const parentPathStat = lstatSync(parent);
    if (!parentStat.isDirectory() || parentPathStat.isSymbolicLink()
        || !parentPathStat.isDirectory() || !sameInode(parentStat, parentPathStat)) {
      fail('RECOVERY_OUTPUT_SAFETY', absolute);
    }
    descriptor = openSync(
      absolute,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY
        | fsConstants.O_NOFOLLOW,
      mode,
    );
    fchmodSync(descriptor, mode);
    writeAll(descriptor, bytes);
    fsyncSync(descriptor);
    const descriptorStat = fstatSync(descriptor);
    const pathStat = lstatSync(absolute);
    if (!descriptorStat.isFile() || pathStat.isSymbolicLink() || !pathStat.isFile()
        || !sameInode(descriptorStat, pathStat)) {
      fail('RECOVERY_OUTPUT_SAFETY', absolute);
    }
    const finalParentStat = fstatSync(parentDescriptor);
    const finalParentPathStat = lstatSync(parent);
    if (!sameInode(parentStat, finalParentStat)
        || !sameInode(finalParentStat, finalParentPathStat)) {
      fail('RECOVERY_OUTPUT_SAFETY', absolute);
    }
    fsyncSync(parentDescriptor);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    closeSync(parentDescriptor);
  }
}

function readAbsoluteRegular(absolute, code = 'RECOVERY_OUTPUT_SAFETY') {
  const parent = path.dirname(absolute);
  let parentDescriptor;
  let descriptor;
  try {
    parentDescriptor = openSync(
      parent,
      fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
    );
    const parentStat = fstatSync(parentDescriptor);
    const parentPathStat = lstatSync(parent);
    if (!parentStat.isDirectory() || parentPathStat.isSymbolicLink()
        || !parentPathStat.isDirectory() || !sameInode(parentStat, parentPathStat)) {
      fail(code, absolute);
    }
    descriptor = openSync(absolute, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    const pathStat = lstatSync(absolute);
    if (!stat.isFile() || pathStat.isSymbolicLink() || !pathStat.isFile()
        || !sameInode(stat, pathStat)) {
      fail(code, absolute);
    }
    const bytes = readDescriptor(descriptor);
    const finalStat = fstatSync(descriptor);
    const finalParentStat = fstatSync(parentDescriptor);
    const finalParentPathStat = lstatSync(parent);
    if (!sameInode(stat, finalStat) || stat.size !== finalStat.size
        || !sameInode(parentStat, finalParentStat)
        || !sameInode(finalParentStat, finalParentPathStat)) {
      fail(code, absolute);
    }
    return { bytes, stat: finalStat };
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail(code, absolute);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* the hash comparison catches truncation */ }
    }
    if (parentDescriptor !== undefined) {
      try { closeSync(parentDescriptor); } catch { /* the path guard already ran */ }
    }
  }
}

function unlinkAbsoluteLeaf(absolute, code = 'RECOVERY_OUTPUT_SAFETY') {
  const parent = path.dirname(absolute);
  let parentDescriptor;
  try {
    parentDescriptor = openSync(
      parent,
      fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
    );
    const parentStat = fstatSync(parentDescriptor);
    const parentPathStat = lstatSync(parent);
    const pathStat = lstatSync(absolute);
    if (!parentStat.isDirectory() || parentPathStat.isSymbolicLink()
        || !parentPathStat.isDirectory() || !sameInode(parentStat, parentPathStat)
        || pathStat.isDirectory()) {
      fail(code, absolute);
    }
    unlinkSync(absolute);
    const finalParentStat = fstatSync(parentDescriptor);
    const finalParentPathStat = lstatSync(parent);
    if (!sameInode(parentStat, finalParentStat)
        || !sameInode(finalParentStat, finalParentPathStat)) {
      fail(code, absolute);
    }
    fsyncSync(parentDescriptor);
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail(code, absolute);
  } finally {
    if (parentDescriptor !== undefined) {
      try { closeSync(parentDescriptor); } catch { /* absence is checked by the caller */ }
    }
  }
}

function cloneOrCopyRegularBackup(loaded, backupPath) {
  let copied = false;
  try {
    copyFileSync(
      loaded.absolute,
      backupPath,
      fsConstants.COPYFILE_FICLONE | fsConstants.COPYFILE_EXCL,
    );
    copied = true;
    const backup = readAbsoluteRegular(backupPath);
    if (backup.bytes.length === loaded.bytes.length
        && sha256Hex(backup.bytes) === sha256Hex(loaded.bytes)) {
      return;
    }
  } catch {
    // The descriptor-backed fallback below is the portable exact-byte path.
  }
  if (copied) {
    unlinkAbsoluteLeaf(backupPath);
  } else {
    try {
      lstatSync(backupPath);
      unlinkAbsoluteLeaf(backupPath);
    } catch (error) {
      if (error instanceof Work2RecoveryError) throw error;
      if (error?.code !== 'ENOENT') fail('RECOVERY_OUTPUT_SAFETY', backupPath);
    }
  }
  writeExclusiveAbsolute(backupPath, loaded.bytes);
  const backup = readAbsoluteRegular(backupPath);
  if (backup.bytes.length !== loaded.bytes.length
      || sha256Hex(backup.bytes) !== sha256Hex(loaded.bytes)) {
    fail('RECOVERY_OUTPUT_SAFETY', backupPath);
  }
}

function writeExclusiveRepository(
  root,
  repositoryPath,
  bytes,
  mode = 0o600,
  code = 'ROLLBACK_FAILED',
) {
  let guard;
  let descriptor;
  try {
    guard = directoryGuard(root, repositoryPath, code);
    descriptor = openSync(
      guard.absolute,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY
        | fsConstants.O_NOFOLLOW,
      mode,
    );
    fchmodSync(descriptor, mode);
    writeAll(descriptor, bytes);
    fsyncSync(descriptor);
    const descriptorStat = fstatSync(descriptor);
    const pathStat = lstatSync(guard.absolute);
    if (!descriptorStat.isFile() || pathStat.isSymbolicLink() || !pathStat.isFile()
        || !sameInode(descriptorStat, pathStat)) {
      fail(code, repositoryPath);
    }
    guard.validate();
    fsyncSync(guard.parentDescriptor);
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail(code, repositoryPath);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* the caller verifies the restored bytes */ }
    }
    guard?.close();
  }
}

function unlinkRepositoryLeaf(
  root,
  repositoryPath,
  code = 'RECOVERY_OUTPUT_SAFETY',
  allowSymbolicLink = false,
) {
  let guard;
  let descriptor;
  try {
    guard = directoryGuard(root, repositoryPath, code);
    const pathStat = lstatSync(guard.absolute);
    if (pathStat.isDirectory()) fail(code, repositoryPath);
    if (pathStat.isSymbolicLink()) {
      if (!allowSymbolicLink) fail(code, repositoryPath);
    } else {
      descriptor = openSync(guard.absolute, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
      const descriptorStat = fstatSync(descriptor);
      const checkedPathStat = lstatSync(guard.absolute);
      if (!descriptorStat.isFile() || checkedPathStat.isSymbolicLink()
          || !checkedPathStat.isFile() || !sameInode(descriptorStat, checkedPathStat)) {
        fail(code, repositoryPath);
      }
    }
    guard.validate();
    unlinkSync(guard.absolute);
    guard.validate();
    fsyncSync(guard.parentDescriptor);
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail(code, repositoryPath);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* the path result is verified by the caller */ }
    }
    guard?.close();
  }
}

function sha256File(absolute) {
  const descriptor = openSync(absolute, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest('hex');
}

function repositoryInventory(root) {
  const inventory = {};
  function visit(directory, prefix = '') {
    for (const name of readdirSync(directory).sort()) {
      const repositoryPath = prefix === '' ? name : `${prefix}/${name}`;
      const absolute = path.join(directory, name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        inventory[repositoryPath] = {
          kind: 'SYMLINK', target: readlinkSync(absolute), mode: stat.mode & 0o777,
        };
      } else if (stat.isDirectory()) {
        inventory[repositoryPath] = { kind: 'DIRECTORY', mode: stat.mode & 0o777 };
        visit(absolute, repositoryPath);
      } else if (stat.isFile()) {
        inventory[repositoryPath] = {
          kind: 'FILE',
          mode: stat.mode & 0o777,
          byte_length: stat.size,
          sha256: sha256File(absolute),
        };
      } else {
        inventory[repositoryPath] = { kind: 'OTHER', mode: stat.mode & 0o777 };
      }
    }
  }
  visit(root);
  return inventory;
}

function gitMetadataInventory(inventory) {
  return Object.fromEntries(Object.entries(inventory).filter(
    ([repositoryPath]) => repositoryPath === '.git' || repositoryPath.startsWith('.git/'),
  ));
}

function readRepositorySymlink(root, repositoryPath, code = 'RECOVERY_OUTPUT_SAFETY') {
  let guard;
  try {
    guard = directoryGuard(root, repositoryPath, code);
    const stat = lstatSync(guard.absolute);
    if (!stat.isSymbolicLink()) fail(code, repositoryPath);
    const target = readlinkSync(guard.absolute);
    const finalStat = lstatSync(guard.absolute);
    guard.validate();
    if (!finalStat.isSymbolicLink() || !sameInode(stat, finalStat)) {
      fail(code, repositoryPath);
    }
    return { stat: finalStat, target };
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail(code, repositoryPath);
  } finally {
    guard?.close();
  }
}

function backupGitMetadata(root, beforeInventory, backupRoot) {
  const inventory = gitMetadataInventory(beforeInventory);
  if (inventory['.git']?.kind !== 'DIRECTORY') {
    fail('RECOVERY_OUTPUT_SAFETY', '.git');
  }
  const entries = [];
  for (const [repositoryPath, expected] of Object.entries(inventory)) {
    if (!['DIRECTORY', 'FILE', 'SYMLINK'].includes(expected.kind)) {
      fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
    }
    if (expected.kind === 'DIRECTORY') {
      entries.push({
        path: repositoryPath,
        kind: expected.kind,
        mode: expected.mode,
      });
      continue;
    }
    if (expected.kind === 'SYMLINK') {
      const loaded = readRepositorySymlink(root, repositoryPath);
      if ((loaded.stat.mode & 0o777) !== expected.mode || loaded.target !== expected.target) {
        fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
      }
      entries.push({
        path: repositoryPath,
        kind: expected.kind,
        mode: expected.mode,
        target: expected.target,
      });
      continue;
    }
    const loaded = readRepositoryFile(
      root,
      repositoryPath,
      'RECOVERY_OUTPUT_SAFETY',
      'RECOVERY_OUTPUT_SAFETY',
    );
    if ((loaded.stat.mode & 0o777) !== expected.mode
        || loaded.bytes.length !== expected.byte_length
        || sha256Hex(loaded.bytes) !== expected.sha256) {
      fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
    }
    const backupName = `git-${String(entries.length).padStart(6, '0')}.bin`;
    cloneOrCopyRegularBackup(loaded, path.join(backupRoot, backupName));
    entries.push({
      path: repositoryPath,
      kind: expected.kind,
      mode: expected.mode,
      byte_length: expected.byte_length,
      sha256: expected.sha256,
      backup_name: backupName,
    });
  }
  const metadataBytes = Buffer.from(`${canonicalJson(entries)}\n`, 'utf8');
  const metadataPath = path.join(backupRoot, 'git-metadata.json');
  writeExclusiveAbsolute(metadataPath, metadataBytes);
  if (!readAbsoluteRegular(metadataPath).bytes.equals(metadataBytes)) {
    fail('RECOVERY_OUTPUT_SAFETY', 'Git metadata backup');
  }
  return { entries, inventory, metadataBytes, metadataPath };
}

function inventoryDrift(before, after, excludedPaths) {
  const excluded = new Set(excludedPaths);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((repositoryPath) => !excluded.has(repositoryPath))
    .filter((repositoryPath) => !same(before[repositoryPath] ?? null, after[repositoryPath] ?? null))
    .sort();
}

function createBackups(root, protectedPaths, beforeInventory) {
  let systemTempRoot;
  try { systemTempRoot = realpathSync(tmpdir()); } catch { fail('RECOVERY_OUTPUT_SAFETY', 'temp'); }
  if (systemTempRoot === root || systemTempRoot.startsWith(`${root}${path.sep}`)) {
    fail('RECOVERY_OUTPUT_SAFETY', 'temp inside repository');
  }
  const backupRoot = mkdtempSync(path.join(systemTempRoot, 'm7-v2-work2-recovery-'));
  const targetBackups = [];
  const protectedBackups = [];
  try {
    for (const [kind, repositoryPaths, destination] of [
      ['target', TARGET_PATHS, targetBackups],
      ['protected', protectedPaths, protectedBackups],
    ]) {
      for (let index = 0; index < repositoryPaths.length; index += 1) {
        const repositoryPath = repositoryPaths[index];
        const loaded = readRepositoryFile(root, repositoryPath, 'RECOVERY_OUTPUT_SAFETY');
        const backupPath = path.join(backupRoot, `${kind}-${index}.bin`);
        writeExclusiveAbsolute(backupPath, loaded.bytes);
        if (!readAbsoluteRegular(backupPath).bytes.equals(loaded.bytes)) {
          fail('RECOVERY_OUTPUT_SAFETY', 'backup');
        }
        destination.push({
          repositoryPath,
          absolute: loaded.absolute,
          backupPath,
          bytes: loaded.bytes,
          mode: loaded.stat.mode & 0o777,
        });
      }
    }
    const gitMetadata = backupGitMetadata(root, beforeInventory, backupRoot);
    return { backupRoot, targetBackups, protectedBackups, gitMetadata };
  } catch (error) {
    rmSync(backupRoot, { recursive: true, force: true });
    throw error;
  }
}

function runGovernedChild(root, repositoryPath, failureCode) {
  const result = spawnSync(process.execPath, [repositoryPath], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: cleanChildEnvironment({
      GIT_NO_REPLACE_OBJECTS: '1',
      GIT_OPTIONAL_LOCKS: '0',
    }),
  });
  if (result.status !== 0 || result.error) {
    fail(failureCode, (result.stderr || result.error?.message || '').trim());
  }
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  try {
    return JSON.parse(lines.at(-1));
  } catch {
    fail(failureCode, 'result');
  }
}

function artifactIdField(repositoryPath) {
  return new Map([
    [ORDERING_AUTHORITY_PATH, 'correction_authority_id'],
    [ENTRY_AUTHORITY_PATH, 'correction_authority_id'],
    [CORRECTION_AUTHORITY_PATH, 'correction_authority_id'],
    [MANIFEST_PATH, 'execution_manifest_id'],
    [AGREEMENT_SET_PATH, 'agreement_analysis_set_id'],
    [CONTEXT_SET_PATH, 'context_compilation_set_id'],
  ]).get(repositoryPath) ?? null;
}

function validateRecoveredReceipt(root, authority, manifest) {
  const loaded = parseCanonicalRecord(root, RECEIPT_PATH, 'RECOVERY_BINDING_DRIFT');
  const receipt = loaded.record;
  const unsigned = structuredClone(receipt);
  delete unsigned.work2_receipt_id;
  const recovery = receipt.repository_precondition?.recovery;
  const runnerBinding = authority.executable_bindings.find(
    (binding) => binding.path === RUNNER_PATH,
  );
  const expectedRecovery = {
    schema_version: RECEIPT_RECOVERY_SCHEMA,
    correction_authority_binding: currentBinding(
      root, CORRECTION_AUTHORITY_PATH, 'correction_authority_id',
    ),
    recovery_runner_binding: runnerBinding,
    superseded_receipt_binding: authority.stale_output_bindings[2],
    superseded_source_set_bindings: authority.stale_output_bindings.slice(0, 2),
    excluded_generalisation_binding: authority.excluded_generalisation_binding,
    prior_command_run_counts: PRIOR_RECOVERY_RUN_COUNTS,
    prior_post_receipt_validator_run_count: 1,
    recovery_argv: authority.command_extension.appended_argv_with_run_limits[0].argv,
    recovery_run_count: 1,
    finaliser_cumulative_run_count: 2,
    validator_cumulative_run_count: 2,
    replaced_output_paths: [...TARGET_PATHS],
    effective_work2_paths: [...authority.effective_work2_paths],
    backup_state: 'REMOVED_AFTER_VALIDATOR_PASS',
    rollback_state: 'AVAILABLE_DURING_TRANSACTION_ONLY',
  };
  if (receipt.schema_version !== RECEIPT_SCHEMA
      || receipt.work2_receipt_id !== contentId(RECEIPT_SCHEMA, unsigned)
      || receipt.state !== 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE'
      || receipt.status !== 'PASS'
      || receipt.execution_manifest_id !== manifest.execution_manifest_id
      || receipt.execution_manifest_digest !== manifest.execution_manifest_digest
      || !exactKeys(recovery, RECEIPT_RECOVERY_KEYS)
      || !same(recovery, expectedRecovery)) {
    fail('RECOVERY_BINDING_DRIFT', 'receipt lineage');
  }
  const artifactPaths = authority.effective_work2_paths.filter(
    (repositoryPath) => repositoryPath !== RECEIPT_PATH,
  );
  const artifacts = artifactPaths.map((repositoryPath) => currentBinding(
    root, repositoryPath, artifactIdField(repositoryPath),
  ));
  if (artifacts.length !== 22
      || new Set(artifacts.map((binding) => binding.path)).size !== 22
      || !same(receipt.artifact_bindings, artifacts)
      || receipt.artifact_set_digest !== sha256Hex(canonicalJson(artifacts))
      || !same(receipt.repository_precondition?.effective_work2_paths,
        authority.effective_work2_paths)
      || !same(receipt.repository_precondition?.exact_git_commit_and_push_argv,
        authority.exact_git_commit_and_push_argv)
      || receipt.counts?.effective_work2_path_count !== 23
      || receipt.counts?.artifact_binding_count !== 22) {
    fail('RECOVERY_EFFECT_DRIFT', 'receipt inventory');
  }
  if (!same(receipt.command_execution_ledger?.map((entry) => entry.run_count),
    RECOVERED_RECEIPT_RUN_COUNTS)
      || !same(receipt.command_execution_ledger?.slice(12).map((entry) => entry.state), [
        'CUMULATIVE_ONE_INITIAL_ONE_RECOVERY_WRITES_THIS_RECEIPT',
        'CUMULATIVE_ONE_INITIAL_ONE_REQUIRED_AFTER_THIS_RECEIPT',
        'RUNNER_WRITES_THIS_RECEIPT_AND_COMPLETES_AFTER_VALIDATOR_PASS',
      ])
      || !same(receipt.command_execution_ledger?.at(-1)?.argv,
        COMMAND_EXTENSION.appended_argv_with_run_limits[0].argv)
      || receipt.source_set_evidence?.agreement_analysis_set_binding?.record_id
        !== STALE_OUTPUT_BINDINGS[0].record_id
      || receipt.source_set_evidence?.context_compilation_set_binding?.record_id
        !== STALE_OUTPUT_BINDINGS[1].record_id) {
    fail('RECOVERY_BINDING_DRIFT', 'receipt evidence');
  }
}

function assertTargetFiles(root) {
  for (const repositoryPath of TARGET_PATHS) {
    const loaded = readRepositoryFile(root, repositoryPath, 'RECOVERY_OUTPUT_SAFETY');
    if (!loaded.stat.isFile() || loaded.stat.isSymbolicLink()) {
      fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
    }
  }
}

function backupChanged(root, backup) {
  try {
    const loaded = readRepositoryFile(
      root,
      backup.repositoryPath,
      'RECOVERY_EFFECT_DRIFT',
      'RECOVERY_EFFECT_DRIFT',
    );
    return (loaded.stat.mode & 0o777) !== backup.mode || !loaded.bytes.equals(backup.bytes);
  } catch {
    return true;
  }
}

function assertProtectedBackups(root, protectedBackups) {
  for (const backup of protectedBackups) {
    if (backupChanged(root, backup)) fail('RECOVERY_EFFECT_DRIFT', backup.repositoryPath);
  }
}

function removeRepositoryDirectory(root, repositoryPath, code = 'ROLLBACK_FAILED') {
  let guard;
  let descriptor;
  try {
    guard = directoryGuard(root, repositoryPath, code);
    descriptor = openSync(
      guard.absolute,
      fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
    );
    const descriptorStat = fstatSync(descriptor);
    const pathStat = lstatSync(guard.absolute);
    if (!descriptorStat.isDirectory() || pathStat.isSymbolicLink()
        || !pathStat.isDirectory() || !sameInode(descriptorStat, pathStat)) {
      fail(code, repositoryPath);
    }
    guard.validate();
    rmdirSync(guard.absolute);
    guard.validate();
    fsyncSync(guard.parentDescriptor);
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail(code, repositoryPath);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* the directory absence is checked by inventory */ }
    }
    guard?.close();
  }
}

function normaliseRepositoryRegularAccess(root, repositoryPath) {
  let guard;
  try {
    guard = directoryGuard(root, repositoryPath, 'ROLLBACK_FAILED');
    const stat = lstatSync(guard.absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) return;
    if ((stat.mode & 0o400) === 0) chmodSync(guard.absolute, (stat.mode & 0o777) | 0o400);
    const finalStat = lstatSync(guard.absolute);
    guard.validate();
    if (!finalStat.isFile() || finalStat.isSymbolicLink()
        || !sameInode(stat, finalStat) || (finalStat.mode & 0o400) === 0) {
      fail('ROLLBACK_FAILED', repositoryPath);
    }
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail('ROLLBACK_FAILED', repositoryPath);
  } finally {
    guard?.close();
  }
}

function normaliseGitTreeAccess(root, repositoryPath) {
  const absolute = path.join(root, ...splitRepositoryPath(repositoryPath));
  let stat;
  try { stat = lstatSync(absolute); } catch { fail('ROLLBACK_FAILED', repositoryPath); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('ROLLBACK_FAILED', repositoryPath);
  }
  if ((stat.mode & 0o700) !== 0o700) {
    ensureRepositoryDirectory(root, repositoryPath, (stat.mode & 0o777) | 0o700);
  }
  let names;
  try { names = readdirSync(absolute).sort(); } catch { fail('ROLLBACK_FAILED', repositoryPath); }
  for (const name of names) {
    const childPath = `${repositoryPath}/${name}`;
    let childStat;
    try { childStat = lstatSync(path.join(absolute, name)); } catch {
      fail('ROLLBACK_FAILED', childPath);
    }
    if (childStat.isDirectory() && !childStat.isSymbolicLink()) {
      normaliseGitTreeAccess(root, childPath);
    } else if (childStat.isFile() && !childStat.isSymbolicLink()) {
      normaliseRepositoryRegularAccess(root, childPath);
    }
  }
}

function normaliseGitRollbackAccess(root, gitMetadata) {
  for (const entry of gitMetadata.entries
    .filter((candidate) => candidate.kind === 'DIRECTORY')
    .sort((left, right) => left.path.split('/').length - right.path.split('/').length)) {
    ensureRepositoryDirectory(root, entry.path, entry.mode | 0o700);
  }
  normaliseGitTreeAccess(root, '.git');
}

function removeNewInventoryPaths(root, beforeInventory) {
  const afterInventory = repositoryInventory(root);
  const addedPaths = Object.keys(afterInventory)
    .filter((repositoryPath) => !Object.hasOwn(beforeInventory, repositoryPath))
    .sort((left, right) => {
      const depth = right.split('/').length - left.split('/').length;
      return depth !== 0 ? depth : right.localeCompare(left);
    });
  for (const repositoryPath of addedPaths) {
    const absolute = path.join(root, ...splitRepositoryPath(repositoryPath));
    const stat = lstatSync(absolute);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      removeRepositoryDirectory(root, repositoryPath);
    } else {
      unlinkRepositoryLeaf(root, repositoryPath, 'ROLLBACK_FAILED', true);
    }
  }
}

function ensureRepositoryDirectory(root, repositoryPath, mode) {
  const absolute = path.join(root, ...splitRepositoryPath(repositoryPath));
  try {
    const stat = lstatSync(absolute);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      if (stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o400) === 0) {
        normaliseRepositoryRegularAccess(root, repositoryPath);
      }
      unlinkRepositoryLeaf(root, repositoryPath, 'ROLLBACK_FAILED', true);
    } else if ((stat.mode & mode & 0o700) !== (mode & 0o700)) {
      const accessGuard = directoryGuard(root, repositoryPath, 'ROLLBACK_FAILED');
      try {
        chmodSync(accessGuard.absolute, (stat.mode & 0o777) | (mode & 0o700));
        const accessibleStat = lstatSync(accessGuard.absolute);
        accessGuard.validate();
        if (!accessibleStat.isDirectory() || accessibleStat.isSymbolicLink()
            || !sameInode(stat, accessibleStat)) {
          fail('ROLLBACK_FAILED', repositoryPath);
        }
      } finally {
        accessGuard.close();
      }
    }
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    if (error?.code !== 'ENOENT') fail('ROLLBACK_FAILED', repositoryPath);
  }
  let guard;
  let descriptor;
  try {
    guard = directoryGuard(root, repositoryPath, 'ROLLBACK_FAILED');
    try {
      lstatSync(guard.absolute);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      mkdirSync(guard.absolute, { mode });
    }
    descriptor = openSync(
      guard.absolute,
      fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
    );
    const descriptorStat = fstatSync(descriptor);
    const pathStat = lstatSync(guard.absolute);
    if (!descriptorStat.isDirectory() || pathStat.isSymbolicLink()
        || !pathStat.isDirectory() || !sameInode(descriptorStat, pathStat)) {
      fail('ROLLBACK_FAILED', repositoryPath);
    }
    fchmodSync(descriptor, mode);
    fsyncSync(descriptor);
    guard.validate();
    fsyncSync(guard.parentDescriptor);
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail('ROLLBACK_FAILED', repositoryPath);
  } finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* final inventory verifies the mode */ }
    }
    guard?.close();
  }
}

function createRepositorySymlink(root, repositoryPath, target, expectedMode) {
  let guard;
  try {
    guard = directoryGuard(root, repositoryPath, 'ROLLBACK_FAILED');
    symlinkSync(target, guard.absolute);
    const stat = lstatSync(guard.absolute);
    if (!stat.isSymbolicLink() || readlinkSync(guard.absolute) !== target
        || (stat.mode & 0o777) !== expectedMode) {
      fail('ROLLBACK_FAILED', repositoryPath);
    }
    guard.validate();
    fsyncSync(guard.parentDescriptor);
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    fail('ROLLBACK_FAILED', repositoryPath);
  } finally {
    guard?.close();
  }
}

function removeRepositoryEntryIfPresent(root, repositoryPath, kind) {
  if (kind === undefined) return;
  if (kind === 'DIRECTORY') removeRepositoryDirectory(root, repositoryPath);
  else unlinkRepositoryLeaf(root, repositoryPath, 'ROLLBACK_FAILED', true);
}

function restoreGitMetadata(root, gitMetadata) {
  const metadata = readAbsoluteRegular(
    gitMetadata.metadataPath,
    'ROLLBACK_FAILED',
  ).bytes;
  if (!metadata.equals(gitMetadata.metadataBytes)) {
    fail('ROLLBACK_FAILED', 'Git metadata manifest drift');
  }
  let current = gitMetadataInventory(repositoryInventory(root));
  for (const entry of gitMetadata.entries) {
    if (entry.kind === 'DIRECTORY') continue;
    if (current[entry.path]?.kind === 'DIRECTORY') {
      removeRepositoryDirectory(root, entry.path);
      delete current[entry.path];
    }
  }
  for (const entry of gitMetadata.entries
    .filter((candidate) => candidate.kind === 'DIRECTORY')
    .sort((left, right) => left.path.split('/').length - right.path.split('/').length)) {
    if (current[entry.path] !== undefined
        && current[entry.path].kind !== 'DIRECTORY') {
      removeRepositoryEntryIfPresent(root, entry.path, current[entry.path].kind);
      delete current[entry.path];
    }
    ensureRepositoryDirectory(root, entry.path, entry.mode);
  }
  current = gitMetadataInventory(repositoryInventory(root));
  for (const entry of gitMetadata.entries.filter(
    (candidate) => candidate.kind !== 'DIRECTORY',
  )) {
    const currentEntry = current[entry.path];
    if (entry.kind === 'FILE'
        && currentEntry?.kind === 'FILE'
        && currentEntry.mode === entry.mode
        && currentEntry.byte_length === entry.byte_length
        && currentEntry.sha256 === entry.sha256) {
      continue;
    }
    if (entry.kind === 'SYMLINK'
        && currentEntry?.kind === 'SYMLINK'
        && currentEntry.mode === entry.mode
        && currentEntry.target === entry.target) {
      continue;
    }
    removeRepositoryEntryIfPresent(root, entry.path, currentEntry?.kind);
    if (entry.kind === 'SYMLINK') {
      createRepositorySymlink(root, entry.path, entry.target, entry.mode);
      continue;
    }
    const backupPath = path.join(path.dirname(gitMetadata.metadataPath), entry.backup_name);
    const bytes = readAbsoluteRegular(backupPath, 'ROLLBACK_FAILED').bytes;
    if (bytes.length !== entry.byte_length || sha256Hex(bytes) !== entry.sha256) {
      fail('ROLLBACK_FAILED', entry.path);
    }
    writeExclusiveRepository(root, entry.path, bytes, entry.mode);
    const restored = readRepositoryFile(
      root,
      entry.path,
      'ROLLBACK_FAILED',
      'ROLLBACK_FAILED',
    );
    if ((restored.stat.mode & 0o777) !== entry.mode
        || restored.bytes.length !== entry.byte_length
        || sha256Hex(restored.bytes) !== entry.sha256) {
      fail('ROLLBACK_FAILED', entry.path);
    }
  }
  if (!same(gitMetadataInventory(repositoryInventory(root)), gitMetadata.inventory)) {
    fail('ROLLBACK_FAILED', 'Git metadata inventory');
  }
}

function assertGitMetadata(root, expectedInventory) {
  if (!same(gitMetadataInventory(repositoryInventory(root)), expectedInventory)) {
    fail('RECOVERY_EFFECT_DRIFT', 'Git metadata inventory');
  }
}

function restoreBackup(root, backup) {
  try {
    lstatSync(backup.absolute);
    unlinkRepositoryLeaf(root, backup.repositoryPath, 'ROLLBACK_FAILED', true);
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    if (error?.code !== 'ENOENT') fail('ROLLBACK_FAILED', backup.repositoryPath);
  }
  const bytes = readAbsoluteRegular(backup.backupPath, 'ROLLBACK_FAILED').bytes;
  if (!bytes.equals(backup.bytes)) fail('ROLLBACK_FAILED', 'backup drift');
  writeExclusiveRepository(root, backup.repositoryPath, bytes, backup.mode);
  if (!readRepositoryFile(
    root,
    backup.repositoryPath,
    'ROLLBACK_FAILED',
    'ROLLBACK_FAILED',
  ).bytes.equals(backup.bytes)) {
    fail('ROLLBACK_FAILED', backup.repositoryPath);
  }
}

function restoreTransaction(root, transaction) {
  const failures = [];
  let gitAccessReady = false;
  try { normaliseGitRollbackAccess(root, transaction.gitMetadata); } catch (error) {
    failures.push(error.message);
  }
  if (failures.length === 0) {
    gitAccessReady = true;
    try { removeNewInventoryPaths(root, transaction.beforeInventory); } catch (error) {
      failures.push(error.message);
    }
    try { restoreGitMetadata(root, transaction.gitMetadata); } catch (error) {
      failures.push(error.message);
    }
  }
  for (const backup of transaction.targetBackups) {
    try { restoreBackup(root, backup); } catch (error) { failures.push(error.message); }
  }
  for (const backup of transaction.protectedBackups) {
    if (!backupChanged(root, backup)) continue;
    try { restoreBackup(root, backup); } catch (error) { failures.push(error.message); }
  }
  const excluded = [...transaction.targetBackups, ...transaction.protectedBackups]
    .map((backup) => backup.repositoryPath);
  if (gitAccessReady) {
    try {
      failures.push(...inventoryDrift(
        transaction.beforeInventory,
        repositoryInventory(root),
        excluded,
      ).map((repositoryPath) => `unrestored ${repositoryPath}`));
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (failures.length !== 0) {
    fail('ROLLBACK_FAILED', `${transaction.backupRoot}: ${failures.join('; ')}`);
  }
  try {
    rmSync(transaction.backupRoot, { recursive: true, force: false });
  } catch (error) {
    fail('ROLLBACK_FAILED', `${transaction.backupRoot}: ${error.message}`);
  }
}

function recoverWork2Transaction(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some(
        (key) => !['repoRoot', 'authorityPath', 'write'].includes(key),
      )) {
    fail('RECOVERY_AUTHORITY_INVALID', 'options');
  }
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const authorityPath = options.authorityPath ?? CORRECTION_AUTHORITY_PATH;
  const write = options.write ?? false;
  if (typeof repoRoot !== 'string' || typeof authorityPath !== 'string'
      || typeof write !== 'boolean') {
    fail('RECOVERY_AUTHORITY_INVALID', 'options');
  }
  const requestedRoot = path.resolve(repoRoot);
  let root;
  try { root = realpathSync(requestedRoot); } catch { fail('RECOVERY_PATH_SCOPE', 'root'); }
  if (root !== requestedRoot) fail('RECOVERY_PATH_SCOPE', 'root symlink');

  const { authority, manifest } = validateAuthority(root, authorityPath);
  const beforeState = validatePreflight(root, authority);
  if (!write) {
    return resultRecord('PASS_WORK2_RECOVERY_PREVIEW', authority, {
      ...ZERO_EFFECTS,
      local_subprocess_runs: 1,
    });
  }

  const protectedPaths = [...new Set([
    ...authority.effective_work2_paths.filter(
      (repositoryPath) => !TARGET_PATHS.includes(repositoryPath),
    ),
    ...manifest.permitted_read_paths,
    GENERALISATION_PATH,
    WORK0_PATH,
    PARENT_AUTHORITY_PATH,
    ACTIVATION_PATH,
    WORK1_RECEIPT_PATH,
  ])].filter((repositoryPath) => !TARGET_PATHS.includes(repositoryPath));
  const beforeInventory = repositoryInventory(root);
  const transaction = createBackups(root, protectedPaths, beforeInventory);
  transaction.beforeInventory = beforeInventory;
  let primaryError = null;
  try {
    for (const backup of transaction.targetBackups) {
      unlinkRepositoryLeaf(root, backup.repositoryPath);
    }
    const finaliserResult = runGovernedChild(root, FINALISER_PATH, 'FINALISER_FAILED');
    if (finaliserResult.status !== 'PASS_WORK2_FINALISATION') {
      fail('FINALISER_FAILED', 'status');
    }
    assertTargetFiles(root);
    assertProtectedBackups(root, transaction.protectedBackups);
    assertGitMetadata(root, transaction.gitMetadata.inventory);
    const validatorResult = runGovernedChild(root, VALIDATOR_PATH, 'VALIDATOR_FAILED');
    if (validatorResult.status !== 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE') {
      fail('VALIDATOR_FAILED', 'status');
    }
    validateRecoveredReceipt(root, authority, manifest);
    assertProtectedBackups(root, transaction.protectedBackups);
    assertGitMetadata(root, transaction.gitMetadata.inventory);
    validateProductionRepositoryIdentity(root);
    if (!same(worktreeState(root).entries, beforeState.entries)) {
      fail('RECOVERY_EFFECT_DRIFT', 'post-validator worktree');
    }
    if (inventoryDrift(beforeInventory, repositoryInventory(root), TARGET_PATHS).length !== 0) {
      fail('RECOVERY_EFFECT_DRIFT', 'repository inventory');
    }
  } catch (error) {
    primaryError = error instanceof Work2RecoveryError
      ? error
      : new Work2RecoveryError('RECOVERY_EFFECT_DRIFT', error.message);
  }
  if (primaryError !== null) {
    restoreTransaction(root, transaction);
    throw primaryError;
  }
  try {
    rmSync(transaction.backupRoot, { recursive: true, force: false });
  } catch {
    const cleanupError = new Work2RecoveryError('RECOVERY_EFFECT_DRIFT', 'backup cleanup');
    restoreTransaction(root, transaction);
    throw cleanupError;
  }
  return resultRecord('PASS_WORK2_RECOVERY', authority, {
    ...ZERO_EFFECTS,
    system_temp_backup_directories: 1,
    work2_generated_output_replacements: 3,
    local_subprocess_runs: 4,
  });
}

export function recoverWork2(options = {}) {
  try {
    return recoverWork2Transaction(options);
  } catch (error) {
    if (error instanceof Work2RecoveryError) throw error;
    throw new Work2RecoveryError(
      'RECOVERY_OUTPUT_SAFETY',
      error instanceof Error ? error.message : String(error),
    );
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4
      || process.argv[2] !== '--authority'
      || process.argv[3] !== CORRECTION_AUTHORITY_PATH) {
    process.stderr.write('RECOVERY_AUTHORITY_INVALID\n');
    process.exitCode = 1;
  } else {
    try {
      process.stdout.write(`${canonicalJson(recoverWork2({
        repoRoot: process.cwd(),
        authorityPath: process.argv[3],
        write: true,
      }))}\n`);
    } catch (error) {
      process.stderr.write(`${
        error instanceof Work2RecoveryError ? error.code : 'RECOVERY_EFFECT_DRIFT'
      }\n`);
      process.exitCode = 1;
    }
  }
}
