#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fchmodSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  rmdirSync,
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
const WORK0_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json`;
const PARENT_AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-work1-7-authority.json`;
const ACTIVATION_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json`;
const CONTRACT_POLICY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-contract-policy.json`;
const FAMILY_PACKET_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-family-packet-set.json`;
const RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json`;
const CORRECTION_AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-contract-work1-correction-authority.json`;
const FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-finalise.mjs';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-validate.mjs';
const RUNNER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs';
const EXECUTION_MANIFEST_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js';
const CORRECTION_AUTHORITY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_CORRECTION_AUTHORITY/V1';
const CORRECTION_APPROVAL_ID = 'BEN-STAGE-2Y-M7-V2-WORK1-RECOVERY-2026-08-15';
const PARENT_AUTHORITY_ID = 'ba63c1e57e5eb486e666e31e193a1dc21cf24f7a3918eace0ae6a6949f9359f7';
const ACTIVATION_ID = '7821c19a5aaae6f974599cefc8460fb88b8f2302fcefbdde4c0efbadbdea0d7a';
const ACTIVATION_COMMIT = '6162798202bda37169917400b8fbebad8e1bdb9a';
const BRANCH = 'codex/recover-m7-20260812';

const PARENT_WORK1_PATHS = Object.freeze([
  'lib/canonical-v2/m7-v2-contract.js',
  'scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs',
  FINALISER_PATH,
  VALIDATOR_PATH,
  'tests/fixtures/canonical-v2/m7-v2-repair/work1-acceptance-cases.json',
  'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
  'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
  EXECUTION_MANIFEST_TEST_PATH,
  CONTRACT_POLICY_PATH,
  FAMILY_PACKET_PATH,
  RECEIPT_PATH,
]);

const TARGET_PATHS = Object.freeze([CONTRACT_POLICY_PATH, FAMILY_PACKET_PATH, RECEIPT_PATH]);
const PATH_EXTENSION = Object.freeze([CORRECTION_AUTHORITY_PATH, RUNNER_PATH]);
const EXECUTABLE_PATHS = Object.freeze([
  FINALISER_PATH,
  VALIDATOR_PATH,
  RUNNER_PATH,
  EXECUTION_MANIFEST_TEST_PATH,
]);
const STALE_OUTPUT_BINDINGS = Object.freeze([
  Object.freeze({
    path: CONTRACT_POLICY_PATH,
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_POLICY/V1',
    record_id_field: 'contract_policy_id',
    record_id: '7190007634a40b59e578eb8e1c25cc5d605d2472b8ccc0aeac519dabc57b7dda',
    byte_length: 50362,
    sha256: '797aa66a73376be0f8ccac4602b6dc68f789c972ec764d708435fb5ca785814e',
    git_blob_oid: 'e441f0d43361a956ae766da135bc85aac020d33a',
  }),
  Object.freeze({
    path: FAMILY_PACKET_PATH,
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
    record_id_field: 'family_packet_set_id',
    record_id: '30808afe05e4ab1b9f84fbf537804229c5d9b2ecc888d317a2075bf00712aec2',
    byte_length: 136079,
    sha256: '1bb5f78417360d558ec4ce917b670e6494eed9525321380fc71f7d4095080e39',
    git_blob_oid: '7e195d257bec5044867073b6905a69f7b708dc36',
  }),
  Object.freeze({
    path: RECEIPT_PATH,
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1',
    record_id_field: 'work1_contract_receipt_id',
    record_id: '852213a4535910c5cb9bfe68dc06387e7fc1ba98787db3c8468ff61437b7c46c',
    byte_length: 46687,
    sha256: 'd5500d0c7b444968618558c23766fba11bf0509f3081160b024d3be035a05488',
    git_blob_oid: '5ede81234ed4c65778f005dd0a42e2fd571fe3c5',
  }),
]);
const AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state',
  'approved_on', 'approver', 'ben_approval_id', 'approval_text', 'discovered_defect',
  'parent_authority_binding', 'activation_receipt_binding', 'stale_output_bindings',
  'executable_bindings', 'authorised_scope', 'exact_path_extension',
  'effective_work1_paths', 'command_extension', 'allowed_effects',
  'prohibited_effects', 'rollback', 'success_conditions',
]);
const BINDING_KEYS = Object.freeze([
  'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length', 'sha256',
  'git_blob_oid',
]);
const AUTHORISED_SCOPE = Object.freeze([
  'PRESERVE_PARENT_AUTHORITY_AND_ACTIVATION_BYTES',
  'REPLACE_ONLY_THE_THREE_UNCOMMITTED_WORK1_GENERATED_OUTPUTS',
  'RUN_WORK1_FINALISER_EXACTLY_ONCE_MORE',
  'RUN_WORK1_VALIDATOR_EXACTLY_ONCE_IN_RECOVERY',
  'COMMIT_AND_PUSH_THE_EFFECTIVE_FIFTEEN_PATH_WORK1_DELTA_ONLY',
]);
const COMMAND_EXTENSION = Object.freeze({
  recovery_argv: ['node', RUNNER_PATH, '--authority', CORRECTION_AUTHORITY_PATH],
  recovery_run_limit: 1,
  additional_work1_finaliser_runs: 1,
  work1_finaliser_cumulative_run_count: 2,
  work1_validator_cumulative_run_count: 2,
  parent_work1_validator_limit: 3,
  additional_git_add_commit_push_runs: 0,
});
const ALLOWED_EFFECTS = Object.freeze({
  deterministic_local_reads: true,
  system_temp_backup_directories: 1,
  work1_generated_output_replacements: 3,
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
const ROLLBACK = Object.freeze({
  backup_root: 'SYSTEM_TEMP_MKDTEMP_ONLY',
  backup_mode: 'EXACT_BYTES_BEFORE_ANY_REMOVAL',
  restore_on_finaliser_or_validator_failure: true,
  remove_only_new_outputs_before_restore: true,
  retain_backup_on_restore_failure: true,
  second_attempt: 'REJECT_BEFORE_MUTATION',
  protected_paths_never_removed: [WORK0_PATH, PARENT_AUTHORITY_PATH, ACTIVATION_PATH],
});
const SUCCESS_CONDITIONS = Object.freeze([
  'THREE_OUTPUTS_REGENERATED',
  'VALIDATOR_PASS',
  'RECEIPT_BINDS_CURRENT_FIFTEEN_PATH_SET',
  'PRIOR_RECEIPT_LINEAGE_BOUND',
  'BACKUP_REMOVED',
  'ZERO_EXTERNAL_EFFECTS',
]);
const ZERO_EFFECTS = Object.freeze({
  system_temp_backup_directories: 0,
  work1_generated_output_replacements: 0,
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

class Work1RecoveryError extends Error {
  constructor(code, detail = '') {
    super(detail === '' ? code : `${code}: ${detail}`);
    this.name = 'Work1RecoveryError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new Work1RecoveryError(code, detail);
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

function recordIdField(record) {
  const fixed = {
    [CORRECTION_AUTHORITY_SCHEMA]: 'correction_authority_id',
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1': 'authority_id',
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1':
      'activation_receipt_id',
    'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1': 'evidence_root_id',
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_POLICY/V1': 'contract_policy_id',
    'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1': 'family_packet_set_id',
    'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1': 'work1_contract_receipt_id',
  }[record?.schema_version];
  return fixed ?? Object.keys(record ?? {}).find(
    (key) => key.endsWith('_id') && typeof record[key] === 'string',
  ) ?? null;
}

function standardBinding(repositoryPath, bytes, record = null) {
  const idField = record === null ? null : recordIdField(record);
  return {
    path: repositoryPath,
    schema_version: record?.schema_version ?? null,
    record_id_field: idField,
    record_id: idField === null ? null : record[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
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

function resolveRepositoryPath(root, repositoryPath) {
  const parts = splitRepositoryPath(repositoryPath);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
      if (index < parts.length - 1 && !stat.isDirectory()) {
        fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
      }
    } catch (error) {
      if (error instanceof Work1RecoveryError) throw error;
      fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
    }
  }
  return current;
}

function readRepositoryFile(root, repositoryPath, code = 'RECOVERY_BINDING_DRIFT') {
  let absolute;
  try {
    absolute = resolveRepositoryPath(root, repositoryPath);
    const stat = lstatSync(absolute);
    if (!stat.isFile()) fail(code, repositoryPath);
    return { absolute, stat, bytes: readFileSync(absolute) };
  } catch (error) {
    if (error instanceof Work1RecoveryError && error.code === code) throw error;
    fail(code, repositoryPath);
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
  if (!canonicalBytes(record).equals(loaded.bytes)) fail(code, `${repositoryPath} canonical`);
  return { ...loaded, record };
}

function currentBinding(root, repositoryPath, code = 'RECOVERY_BINDING_DRIFT') {
  const loaded = readRepositoryFile(root, repositoryPath, code);
  let record = null;
  if (repositoryPath.endsWith('.json')) {
    try { record = JSON.parse(loaded.bytes.toString('utf8')); } catch { fail(code, repositoryPath); }
  }
  return standardBinding(repositoryPath, loaded.bytes, record);
}

function requireExactBinding(root, expected, code = 'RECOVERY_BINDING_DRIFT') {
  if (!exactKeys(expected, BINDING_KEYS) || !same(currentBinding(root, expected.path, code), expected)) {
    fail(code, expected?.path ?? 'binding');
  }
}

function authorityId(record) {
  const unsigned = JSON.parse(JSON.stringify(record));
  delete unsigned.correction_authority_id;
  return contentId(record.schema_version, unsigned);
}

function contentIdentityMatches(record, idField, digestField) {
  const unsigned = JSON.parse(JSON.stringify(record));
  delete unsigned[idField];
  delete unsigned[digestField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return record[digestField] === digest
    && record[idField] === contentId(record.schema_version, withDigest);
}

function parseStatusEntries(output) {
  if (output === '') return [];
  const entries = [];
  for (const line of output.trimEnd().split('\n')) {
    const status = line.slice(0, 2);
    if (!['??', ' M', ' D'].includes(status) || line[2] !== ' ' || line.length <= 3) {
      fail('RECOVERY_PATH_SCOPE', line);
    }
    entries.push({ status, path: line.slice(3) });
  }
  return entries.sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
}

function cleanChildEnvironment(extra = {}) {
  const environment = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    LANG: process.env.LANG ?? 'C',
    LC_ALL: 'C',
    TZ: process.env.TZ ?? 'UTC',
    ...extra,
  };
  return environment;
}

function worktreeState(root) {
  const environment = cleanChildEnvironment({
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
  });
  const result = spawnSync('/usr/bin/git', [
    'status', '--porcelain=v1', '--untracked-files=all',
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: environment,
  });
  if (result.status !== 0 || result.error) fail('RECOVERY_PATH_SCOPE', 'git status');
  const entries = parseStatusEntries(result.stdout);
  return { entries, paths: entries.map((entry) => entry.path) };
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
      if (prefix === '' && name === '.git') continue;
      const repositoryPath = prefix === '' ? name : `${prefix}/${name}`;
      const absolute = path.join(directory, name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        inventory[repositoryPath] = {
          kind: 'SYMLINK',
          target: readlinkSync(absolute),
          mode: stat.mode & 0o777,
        };
      } else if (stat.isDirectory()) {
        inventory[repositoryPath] = { kind: 'DIRECTORY', mode: stat.mode & 0o777 };
        visit(absolute, repositoryPath);
      } else if (stat.isFile()) {
        inventory[repositoryPath] = {
          kind: 'FILE',
          mode: stat.mode & 0o777,
          byte_length: stat.size,
          mtime_ms: stat.mtimeMs,
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

function inventoryDrift(before, after, excludedPaths) {
  const excluded = new Set(excludedPaths);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((repositoryPath) => !excluded.has(repositoryPath))
    .filter((repositoryPath) => !same(before[repositoryPath] ?? null, after[repositoryPath] ?? null))
    .sort();
}

function readGitRef(gitDirectory, ref) {
  const loosePath = path.join(gitDirectory, ...ref.split('/'));
  if (existsSync(loosePath)) return readFileSync(loosePath, 'utf8').trim();
  const packedPath = path.join(gitDirectory, 'packed-refs');
  if (!existsSync(packedPath)) fail('RECOVERY_PATH_SCOPE', ref);
  const line = readFileSync(packedPath, 'utf8').split('\n').find(
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
  if (readFileSync(path.join(gitDirectory, 'HEAD'), 'utf8').trim() !== `ref: ${branchRef}`
      || readGitRef(gitDirectory, branchRef) !== ACTIVATION_COMMIT
      || readGitRef(gitDirectory, `refs/remotes/origin/${BRANCH}`) !== ACTIVATION_COMMIT) {
    fail('RECOVERY_PATH_SCOPE', 'branch/head/origin');
  }
}

function validateAuthority(root, authorityPath) {
  if (authorityPath !== CORRECTION_AUTHORITY_PATH) fail('RECOVERY_PATH_SCOPE', authorityPath);
  const loaded = parseCanonicalRecord(root, authorityPath, 'RECOVERY_AUTHORITY_INVALID');
  const authority = loaded.record;
  if (!exactKeys(authority, AUTHORITY_KEYS)
      || authority.schema_version !== CORRECTION_AUTHORITY_SCHEMA
      || authority.correction_authority_id !== authorityId(authority)
      || authority.stage !== 'M7_V2_REPAIR_WORK1_CORRECTION'
      || authority.authority_state !== 'BEN_AUTHORISED_SINGLE_WORK1_RECOVERY'
      || authority.approved_on !== '2026-08-15'
      || authority.approver !== 'BEN_GOODCHILD'
      || authority.ben_approval_id !== CORRECTION_APPROVAL_ID
      || authority.approval_text !== 'Authorise Work1 recovery'
      || authority.discovered_defect
        !== 'WORK1_VALIDATOR_STATIC_BOUNDARY_FS_MEMBER_ACCESS_FALSE_POSITIVE_AFTER_FIRST_FINALISATION') {
    fail('RECOVERY_AUTHORITY_INVALID');
  }
  if (!Array.isArray(authority.stale_output_bindings)
      || !Array.isArray(authority.executable_bindings)
      || !Array.isArray(authority.authorised_scope)
      || !Array.isArray(authority.exact_path_extension)
      || !Array.isArray(authority.effective_work1_paths)
      || !Array.isArray(authority.success_conditions)) {
    fail('RECOVERY_AUTHORITY_INVALID', 'shape');
  }
  if (![authority.parent_authority_binding, authority.activation_receipt_binding,
    ...authority.stale_output_bindings, ...authority.executable_bindings]
    .every((binding) => exactKeys(binding, BINDING_KEYS))) {
    fail('RECOVERY_BINDING_DRIFT', 'binding shape');
  }
  const parent = parseCanonicalRecord(root, PARENT_AUTHORITY_PATH, 'RECOVERY_BINDING_DRIFT');
  const activation = parseCanonicalRecord(root, ACTIVATION_PATH, 'RECOVERY_BINDING_DRIFT');
  if (!same(authority.parent_authority_binding,
    standardBinding(PARENT_AUTHORITY_PATH, parent.bytes, parent.record))
      || !same(authority.activation_receipt_binding,
        standardBinding(ACTIVATION_PATH, activation.bytes, activation.record))) {
    fail('RECOVERY_BINDING_DRIFT', 'parent');
  }
  if (parent.record.schema_version !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1'
      || parent.record.authority_id !== PARENT_AUTHORITY_ID
      || !contentIdentityMatches(parent.record, 'authority_id', 'authority_digest')
      || activation.record.schema_version
        !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1'
      || activation.record.activation_receipt_id !== ACTIVATION_ID
      || !contentIdentityMatches(
        activation.record,
        'activation_receipt_id',
        'activation_receipt_digest',
      )) {
    fail('RECOVERY_BINDING_DRIFT', 'parent identity');
  }
  const parentPaths = parent.record?.command_policy?.work1_exact_changed_paths;
  const effectivePaths = [...PARENT_WORK1_PATHS, ...PATH_EXTENSION];
  if (!same(parentPaths, PARENT_WORK1_PATHS)
      || !same(authority.exact_path_extension, PATH_EXTENSION)
      || !same(authority.effective_work1_paths, effectivePaths)
      || authority.effective_work1_paths.length !== 15
      || new Set(authority.effective_work1_paths).size !== 15
      || !same(authority.stale_output_bindings?.map((entry) => entry.path), TARGET_PATHS)
      || !same(authority.executable_bindings?.map((entry) => entry.path), EXECUTABLE_PATHS)) {
    fail('RECOVERY_PATH_SCOPE');
  }
  if (!same(authority.authorised_scope, AUTHORISED_SCOPE)
      || !same(authority.command_extension, COMMAND_EXTENSION)
      || !same(authority.rollback, ROLLBACK)
      || !same(authority.success_conditions, SUCCESS_CONDITIONS)) {
    fail('RECOVERY_AUTHORITY_INVALID', 'contract');
  }
  if (!same(authority.allowed_effects, ALLOWED_EFFECTS)
      || !same(authority.prohibited_effects, PROHIBITED_EFFECTS)) {
    fail('RECOVERY_EFFECT_DRIFT', 'authority effects');
  }
  for (const binding of [
    authority.parent_authority_binding,
    authority.activation_receipt_binding,
    ...authority.stale_output_bindings,
    ...authority.executable_bindings,
  ]) {
    if (!exactKeys(binding, BINDING_KEYS)) fail('RECOVERY_BINDING_DRIFT', 'binding shape');
  }
  if (!same(authority.stale_output_bindings, STALE_OUTPUT_BINDINGS)) {
    fail('RECOVERY_BINDING_DRIFT', 'stale outputs');
  }
  for (const binding of authority.executable_bindings) requireExactBinding(root, binding);
  return { authority, bytes: loaded.bytes };
}

function receiptAlreadyRecovered(root, correctionAuthorityId) {
  try {
    const receipt = parseCanonicalRecord(root, RECEIPT_PATH, 'RECOVERY_OUTPUT_SAFETY').record;
    return receipt.repository_precondition?.recovery?.correction_authority_binding?.record_id
      === correctionAuthorityId;
  } catch (error) {
    if (error instanceof Work1RecoveryError) return false;
    throw error;
  }
}

function validateStaleOutputs(root, authority) {
  for (const binding of authority.stale_output_bindings) {
    const loaded = readRepositoryFile(root, binding.path, 'RECOVERY_OUTPUT_SAFETY');
    if (!loaded.stat.isFile()) fail('RECOVERY_OUTPUT_SAFETY', binding.path);
    let record = null;
    try { record = JSON.parse(loaded.bytes.toString('utf8')); } catch {
      fail('RECOVERY_BINDING_DRIFT', binding.path);
    }
    if (!canonicalBytes(record).equals(loaded.bytes)
        || !same(standardBinding(binding.path, loaded.bytes, record), binding)) {
      fail('RECOVERY_BINDING_DRIFT', binding.path);
    }
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
      || !same(state.paths, [...authority.effective_work1_paths].sort())) {
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

function fsyncDirectory(directory) {
  const descriptor = openSync(directory, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY);
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function writeAll(descriptor, bytes) {
  let offset = 0;
  while (offset < bytes.length) offset += writeSync(descriptor, bytes, offset);
}

function writeExclusiveAbsolute(absolute, bytes, mode = 0o600) {
  const descriptor = openSync(
    absolute,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
    mode,
  );
  try {
    fchmodSync(descriptor, mode);
    writeAll(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(path.dirname(absolute));
}

function unlinkRegular(absolute, repositoryPath) {
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
  unlinkSync(absolute);
  fsyncDirectory(path.dirname(absolute));
}

function createBackups(root, protectedPaths) {
  let systemTempRoot;
  try { systemTempRoot = realpathSync(tmpdir()); } catch { fail('RECOVERY_OUTPUT_SAFETY', 'temp'); }
  if (systemTempRoot === root || systemTempRoot.startsWith(`${root}${path.sep}`)) {
    fail('RECOVERY_OUTPUT_SAFETY', 'temp inside repository');
  }
  const backupRoot = mkdtempSync(path.join(systemTempRoot, 'm7-v2-work1-recovery-'));
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
        if (!readFileSync(backupPath).equals(loaded.bytes)) {
          fail('RECOVERY_OUTPUT_SAFETY', 'backup');
        }
        let record = null;
        if (repositoryPath.endsWith('.json')) {
          try { record = JSON.parse(loaded.bytes.toString('utf8')); } catch {
            fail('RECOVERY_BINDING_DRIFT', repositoryPath);
          }
        }
        destination.push({
          repositoryPath,
          absolute: loaded.absolute,
          backupPath,
          bytes: loaded.bytes,
          mode: loaded.stat.mode & 0o777,
          binding: standardBinding(repositoryPath, loaded.bytes, record),
        });
      }
    }
    return { backupRoot, targetBackups, protectedBackups };
  } catch (error) {
    rmSync(backupRoot, { recursive: true, force: true });
    throw error;
  }
}

function runGovernedChild(root, repositoryPath, failureCode) {
  const environment = cleanChildEnvironment({
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_OPTIONAL_LOCKS: '0',
  });
  const result = spawnSync(process.execPath, [repositoryPath], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: environment,
  });
  if (result.status !== 0 || result.error) {
    fail(failureCode, (result.stderr || result.error?.message || '').trim());
  }
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  let record;
  try { record = JSON.parse(lines.at(-1)); } catch { fail(failureCode, 'result'); }
  return record;
}

function assertTargetFiles(root) {
  for (const repositoryPath of TARGET_PATHS) {
    const loaded = readRepositoryFile(root, repositoryPath, 'RECOVERY_OUTPUT_SAFETY');
    if (!loaded.stat.isFile()) fail('RECOVERY_OUTPUT_SAFETY', repositoryPath);
  }
}

function sealDigestRecord(record, digestField, idField) {
  const unsigned = JSON.parse(JSON.stringify(record));
  delete unsigned[digestField];
  delete unsigned[idField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return { ...withDigest, [idField]: contentId(record.schema_version, withDigest) };
}

function validateRecoveredReceipt(root, authority) {
  const loaded = parseCanonicalRecord(root, RECEIPT_PATH, 'RECOVERY_BINDING_DRIFT');
  const receipt = loaded.record;
  if (!same(receipt, sealDigestRecord(
    receipt,
    'work1_contract_receipt_digest',
    'work1_contract_receipt_id',
  ))) fail('RECOVERY_BINDING_DRIFT', 'receipt identity');
  const recovery = receipt.repository_precondition?.recovery;
  const expectedRecovery = {
    correction_authority_binding: currentBinding(root, CORRECTION_AUTHORITY_PATH),
    superseded_receipt_binding: authority.stale_output_bindings[2],
    recovery_argv: authority.command_extension.recovery_argv,
    recovery_run_count: 1,
    finaliser_cumulative_run_count: 2,
    validator_cumulative_run_count: 2,
    replaced_output_paths: [...TARGET_PATHS],
    backup_state: 'REMOVED_AFTER_VALIDATOR_PASS',
    rollback_state: 'AVAILABLE_DURING_TRANSACTION_ONLY',
  };
  if (!same(recovery, expectedRecovery)) fail('RECOVERY_BINDING_DRIFT', 'lineage');
  const artifactPaths = authority.effective_work1_paths.filter(
    (repositoryPath) => repositoryPath !== RECEIPT_PATH,
  );
  const expectedArtifacts = artifactPaths.map((repositoryPath) => currentBinding(root, repositoryPath));
  if (!same(receipt.artifact_bindings, expectedArtifacts)
      || receipt.artifact_bindings.length !== 14
      || new Set(receipt.artifact_bindings.map((entry) => entry.path)).size !== 14
      || receipt.artifact_set_digest !== sha256Hex(canonicalJson(expectedArtifacts))
      || !same(receipt.contract_policy_binding, currentBinding(root, CONTRACT_POLICY_PATH))
      || !same(receipt.family_packet_set_binding, currentBinding(root, FAMILY_PACKET_PATH))) {
    fail('RECOVERY_BINDING_DRIFT', 'artifacts');
  }
  const repositoryPrecondition = receipt.repository_precondition;
  if (!same(repositoryPrecondition?.observed_before_receipt?.authorised_delta_paths,
    authority.effective_work1_paths)
      || !same(repositoryPrecondition?.required_after_receipt?.worktree_delta_paths,
        authority.effective_work1_paths)
      || !same(repositoryPrecondition?.required_commit_and_push?.commit_delta_paths,
        authority.effective_work1_paths)
      || !same(repositoryPrecondition?.required_commit_and_push?.exact_argv?.[0],
        ['git', 'add', '--', ...authority.effective_work1_paths])) {
    fail('RECOVERY_PATH_SCOPE', 'receipt paths');
  }
  const ledger = receipt.command_execution_ledger;
  const finaliserEntry = ledger?.find((entry) => same(entry.argv, ['node', FINALISER_PATH]));
  const validatorEntry = ledger?.find((entry) => same(entry.argv, ['node', VALIDATOR_PATH]));
  if (!Array.isArray(ledger)
      || finaliserEntry?.run_count !== 2
      || validatorEntry?.run_count !== 2
      || !same(ledger.at(-1), {
        argv: authority.command_extension.recovery_argv,
        run_count: 1,
        state: 'RUNNER_WRITES_THIS_RECEIPT_AND_COMPLETES_AFTER_VALIDATOR_PASS',
      })) fail('RECOVERY_BINDING_DRIFT', 'ledger');
}

function assertProtectedBackups(root, protectedBackups) {
  for (const backup of protectedBackups) {
    if (!same(currentBinding(root, backup.repositoryPath, 'RECOVERY_EFFECT_DRIFT'),
      backup.binding)) {
      fail('RECOVERY_EFFECT_DRIFT', backup.repositoryPath);
    }
  }
}

function removeAddedWorktreePaths(root, beforeState, protectedPaths) {
  const afterState = worktreeState(root);
  const beforePaths = new Set(beforeState.paths);
  const protectedPathSet = new Set(protectedPaths);
  const unsafe = [];
  for (const entry of afterState.entries.filter((candidate) => !beforePaths.has(candidate.path))) {
    if (entry.status !== '??') {
      if (!protectedPathSet.has(entry.path)) unsafe.push(entry.path);
      continue;
    }
    // Only bound synchronous children run between the two status snapshots.
    const absolute = resolveRepositoryPath(root, entry.path);
    const stat = lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('ROLLBACK_FAILED', entry.path);
    unlinkSync(absolute);
    fsyncDirectory(path.dirname(absolute));
  }
  return unsafe;
}

function removeNewInventoryPaths(root, beforeInventory) {
  const afterInventory = repositoryInventory(root);
  const addedPaths = Object.keys(afterInventory)
    .filter((repositoryPath) => !Object.hasOwn(beforeInventory, repositoryPath))
    .sort((left, right) => {
      const depth = right.split('/').length - left.split('/').length;
      return depth !== 0 ? depth : right < left ? -1 : right > left ? 1 : 0;
    });
  for (const repositoryPath of addedPaths) {
    const absolute = path.join(root, ...splitRepositoryPath(repositoryPath));
    const stat = lstatSync(absolute);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      rmdirSync(absolute);
    } else {
      unlinkSync(absolute);
    }
    fsyncDirectory(path.dirname(absolute));
  }
}

function restoreBackupEntry(backup) {
  if (existsSync(backup.absolute)) {
    const stat = lstatSync(backup.absolute);
    if (stat.isDirectory()) fail('ROLLBACK_FAILED', backup.repositoryPath);
    unlinkSync(backup.absolute);
    fsyncDirectory(path.dirname(backup.absolute));
  }
  const bytes = readFileSync(backup.backupPath);
  if (!bytes.equals(backup.bytes)) fail('ROLLBACK_FAILED', 'backup drift');
  writeExclusiveAbsolute(backup.absolute, bytes, backup.mode);
  if (!readFileSync(backup.absolute).equals(backup.bytes)) {
    fail('ROLLBACK_FAILED', backup.repositoryPath);
  }
}

function backupEntryChanged(backup) {
  try {
    const stat = lstatSync(backup.absolute);
    return !stat.isFile() || stat.isSymbolicLink()
      || (stat.mode & 0o777) !== backup.mode
      || !readFileSync(backup.absolute).equals(backup.bytes);
  } catch {
    return true;
  }
}

function restoreTransaction(root, transaction, beforeState) {
  const failures = [];
  let unsafeTrackedPaths = [];
  try {
    unsafeTrackedPaths = removeAddedWorktreePaths(
      root,
      beforeState,
      transaction.protectedBackups.map((backup) => backup.repositoryPath),
    );
  } catch (error) {
    failures.push(error.message);
  }
  try { removeNewInventoryPaths(root, transaction.beforeInventory); } catch (error) {
    failures.push(error.message);
  }
  for (const backup of transaction.targetBackups) {
    try { restoreBackupEntry(backup); } catch (error) { failures.push(error.message); }
  }
  for (const backup of transaction.protectedBackups) {
    if (!backupEntryChanged(backup)) continue;
    try { restoreBackupEntry(backup); } catch (error) { failures.push(error.message); }
  }
  failures.push(...unsafeTrackedPaths.map((repositoryPath) => `unrestored ${repositoryPath}`));
  const protectedPaths = [
    ...transaction.targetBackups,
    ...transaction.protectedBackups,
  ].map((backup) => backup.repositoryPath);
  try {
    failures.push(...inventoryDrift(
      transaction.beforeInventory,
      repositoryInventory(root),
      protectedPaths,
    ).map((repositoryPath) => `unrestored ${repositoryPath}`));
  } catch (error) {
    failures.push(error.message);
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

export function recoverWork1(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some((key) => !['repoRoot', 'authorityPath', 'write'].includes(key))) {
    fail('RECOVERY_AUTHORITY_INVALID', 'options');
  }
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const authorityPath = options.authorityPath ?? CORRECTION_AUTHORITY_PATH;
  const write = options.write ?? false;
  if (typeof repoRoot !== 'string' || typeof authorityPath !== 'string'
      || typeof write !== 'boolean') fail('RECOVERY_AUTHORITY_INVALID', 'options');
  const requestedRoot = path.resolve(repoRoot);
  let root;
  try { root = realpathSync(requestedRoot); } catch { fail('RECOVERY_PATH_SCOPE', 'root'); }
  if (root !== requestedRoot) fail('RECOVERY_PATH_SCOPE', 'root symlink');

  const { authority } = validateAuthority(root, authorityPath);
  const beforeState = validatePreflight(root, authority);
  if (!write) {
    return resultRecord('PASS_WORK1_RECOVERY_PREVIEW', authority, {
      ...ZERO_EFFECTS,
      local_subprocess_runs: 1,
    });
  }

  const protectedPaths = [...new Set([
    ...authority.effective_work1_paths.filter(
      (repositoryPath) => !TARGET_PATHS.includes(repositoryPath),
    ),
    WORK0_PATH,
    PARENT_AUTHORITY_PATH,
    ACTIVATION_PATH,
  ])];
  const beforeInventory = repositoryInventory(root);
  const transaction = createBackups(root, protectedPaths);
  transaction.beforeInventory = beforeInventory;
  let primaryError = null;
  try {
    for (const backup of transaction.targetBackups) {
      unlinkRegular(backup.absolute, backup.repositoryPath);
    }
    const finaliserResult = runGovernedChild(root, FINALISER_PATH, 'FINALISER_FAILED');
    if (finaliserResult.status !== 'PASS_WORK1_FINALISATION') fail('FINALISER_FAILED', 'status');
    assertTargetFiles(root);
    assertProtectedBackups(root, transaction.protectedBackups);
    const validatorResult = runGovernedChild(root, VALIDATOR_PATH, 'VALIDATOR_FAILED');
    if (validatorResult.status !== 'PASS_WORK1_CONTRACTS') fail('VALIDATOR_FAILED', 'status');
    validateRecoveredReceipt(root, authority);
    assertProtectedBackups(root, transaction.protectedBackups);
    validateProductionRepositoryIdentity(root);
    if (inventoryDrift(beforeInventory, repositoryInventory(root), TARGET_PATHS).length !== 0) {
      fail('RECOVERY_EFFECT_DRIFT', 'repository inventory');
    }
    if (!same(worktreeState(root).entries, beforeState.entries)) {
      fail('RECOVERY_EFFECT_DRIFT', 'post-validator worktree');
    }
  } catch (error) {
    primaryError = error instanceof Work1RecoveryError
      ? error
      : new Work1RecoveryError('RECOVERY_EFFECT_DRIFT', error.message);
  }
  if (primaryError !== null) {
    restoreTransaction(root, transaction, beforeState);
    throw primaryError;
  }
  try {
    rmSync(transaction.backupRoot, { recursive: true, force: false });
  } catch (error) {
    const cleanupError = new Work1RecoveryError('RECOVERY_EFFECT_DRIFT', 'backup cleanup');
    restoreTransaction(root, transaction, beforeState);
    throw cleanupError;
  }
  return resultRecord('PASS_WORK1_RECOVERY', authority, {
    ...ZERO_EFFECTS,
    system_temp_backup_directories: 1,
    work1_generated_output_replacements: 3,
    local_subprocess_runs: 4,
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4
      || process.argv[2] !== '--authority'
      || process.argv[3] !== CORRECTION_AUTHORITY_PATH) {
    process.stderr.write('RECOVERY_AUTHORITY_INVALID\n');
    process.exitCode = 1;
  } else {
    try {
      process.stdout.write(`${canonicalJson(recoverWork1({
        repoRoot: process.cwd(),
        authorityPath: process.argv[3],
        write: true,
      }))}\n`);
    } catch (error) {
      process.stderr.write(`${error instanceof Work1RecoveryError ? error.code : 'RECOVERY_EFFECT_DRIFT'}\n`);
      process.exitCode = 1;
    }
  }
}
