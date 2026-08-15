import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V1';
const RESULT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST_VALIDATION/V1';
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json';
const ACTIVATION_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json';
const WORK1_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json';
const WORK0_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json';
const BRANCH = 'codex/recover-m7-20260812';
const ACTIVATION_COMMIT = '6162798202bda37169917400b8fbebad8e1bdb9a';
const WORK1_COMMIT_MESSAGE = 'Define M7 V2 repair Work 1 contracts';
const AUTHORITY_ID = 'ba63c1e57e5eb486e666e31e193a1dc21cf24f7a3918eace0ae6a6949f9359f7';
const AUTHORITY_DIGEST = '25ac58d418638432586a5cb24c1cfb766ba1440b77d992afc434ed71d1055afc';
const AUTHORITY_SHA256 = '7e858b96fc46a69d7533e8b5ac3cad4a6142c2f30fd71ecfbd8771709e0cdd3c';
const ACTIVATION_ID = '7821c19a5aaae6f974599cefc8460fb88b8f2302fcefbdde4c0efbadbdea0d7a';
const ACTIVATION_DIGEST = 'cc0e8dbf4ae94ef34cc7b21eecf2122aba76309ba0441a8a062ca81a05224176';
const ACTIVATION_SHA256 = 'f0401bb7f75fe72b7719663573ab75581aecffeb2949618b991ec41e54f1c578';
const WORK0_ID = '885d404502276d85af385fce20cd93b601f09a30a3300c371df870337f7d5fab';
const WORK0_SHA256 = '04e010105dcb4b449b7f8e3aa05fb3bec69cdada8d385999e7c86a8150eaff83';
const DEFERRED_GIT_PROOF = 'EXTERNAL_MILESTONE_ATTESTATION_NOT_INDEPENDENTLY_RECOMPUTED';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
const CANDIDATE_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
const CANDIDATE_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const WORKS = Object.freeze(['WORK2', 'WORK3', 'WORK4', 'WORK5', 'WORK6', 'WORK7']);
const HASH_40 = /^[0-9a-f]{40}$/;
const HASH_64 = /^[0-9a-f]{64}$/;
const RECORD_BINDING_KEYS = Object.freeze([
  'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length',
  'sha256', 'git_blob_oid',
]);
const BASE_TIP_KEYS = Object.freeze([
  'commit', 'branch', 'parent_commit', 'commit_message', 'milestone_attestation',
]);
const ACTIVATION_COMMIT_KEYS = Object.freeze([
  'commit', 'parent_commit', 'branch', 'activation_receipt_id',
]);
const RUN_KEYS = Object.freeze(['argv', 'max_runs']);
const ATTESTATION_KEYS = Object.freeze([
  'attestation_scope', 'state', 'attestor', 'predecessor_work', 'commit', 'parent_commit', 'branch',
  'commit_message', 'origin_ref', 'predecessor_receipt_binding',
  'predecessor_execution_manifest_binding', 'predecessor_validation_result',
  'exact_commit_delta_paths', 'repository_observation', 'checks',
  'observed_command_result_ledger',
]);
const ATTESTATION_CHECK_IDS = Object.freeze([
  'SINGLE_PARENT', 'EXPECTED_PARENT', 'EXPECTED_MESSAGE', 'EXACT_TREE_DELTA',
  'RECEIPT_BLOB_IN_COMMIT', 'ORIGIN_REF_EQUALS_COMMIT', 'NO_SHALLOW_HISTORY',
  'NO_GRAFTS', 'NO_LOOSE_REPLACE_REFS', 'NO_PACKED_REPLACE_REFS',
  'FIXED_CWD_AND_GIT_ENVIRONMENT',
]);
const ATTESTATION_COMMAND_CHECK_IDS = Object.freeze(ATTESTATION_CHECK_IDS.slice(0, 6));
const CANDIDATE_WRAPPER_KEYS = Object.freeze([
  'registration_binding', 'independent_verification',
]);
const CANDIDATE_VERIFICATION_SCHEMA =
  'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1';
const CANDIDATE_VERIFICATION_CHECK_IDS = Object.freeze([
  'REGISTRATION_SELF_IDENTITY', 'AUTHORITY_AND_WORK0_BINDINGS',
  'REQUIRED_COMPONENT_BINDINGS', 'SIX_SEMANTIC_INPUT_BINDINGS',
  'TWENTY_FIVE_SUBTYPE_TREE_BINDINGS', 'PREDECESSOR_AND_OUTPUT_SCOPE',
  'ZERO_PROHIBITED_EFFECTS',
]);
const CANDIDATE_RECORD_KEYS = Object.freeze([
  'schema_version', 'candidate_registration_id', 'stage', 'lifecycle_state',
  'parent_authority_binding', 'activation_receipt_binding', 'work0_evidence_root_binding',
  'code_bindings', 'semantic_input_bindings', 'family_profile_set_binding',
  'subtype_tree_bindings', 'structure_disposition_set_binding', 'view_policy_binding',
  'predecessor_receipt_bindings', 'allowed_output_root', 'counts', 'effects',
]);
const CANDIDATE_CODE_KEYS = Object.freeze([
  'compiler', 'deterministic_generator', 'contract_validator', 'projector',
  'independent_verifier', 'runners', 'tests',
]);
const CANDIDATE_INPUT_ROLES = Object.freeze([
  'BASE_ANALYSIS_SET', 'AGREEMENT_INDEX_SET', 'CONTEXT_COMPILATION_SET',
  'APPROVED_FAMILY_PACKET_SET', 'APPROVED_FAMILY_PROFILE_SET',
  'APPROVED_STRUCTURE_DISPOSITION_SET',
]);
const CANDIDATE_INPUT_SCHEMAS = Object.freeze({
  BASE_ANALYSIS_SET: 'AGREEMENT_ANALYSIS_SET/V1',
  AGREEMENT_INDEX_SET: 'AGREEMENT_INDEX_SET/V1',
  CONTEXT_COMPILATION_SET: 'CONTEXT_COMPILATION_SET/V1',
  APPROVED_FAMILY_PACKET_SET: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
  APPROVED_FAMILY_PROFILE_SET: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1',
  APPROVED_STRUCTURE_DISPOSITION_SET: 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1',
});
const CANDIDATE_FAMILIES = Object.freeze([
  'ANTITRUST_REGULATORY', 'APPRAISAL_DISSENTERS_RIGHTS', 'CAPITALISATION',
  'CLOSING_CONDITIONS', 'CONSIDERATION', 'DIVIDENDS', 'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS', 'FINANCING_COVENANTS', 'GENERAL_COVENANTS',
  'GUARANTY_FINANCING_PARTY', 'INTERIM_OPERATING', 'KEY_DEFINED_TERMS',
  'MAE_DEFINITION', 'MATERIAL_CONTRACTS', 'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP', 'PROXY_MEETING',
  'REPRESENTATIONS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'TAX_MATTERS',
  'TERMINATION', 'TERMINATION_FEE',
]);
const CANDIDATE_EFFECTS = Object.freeze({
  registration_file_writes: 1, model_calls: 0, network_reads: 0, network_writes: 0,
  database_writes: 0, product_writes: 0, m0_m4_mutations: 0, m8_actions: 0,
});
const CANDIDATE_VERIFICATION_EFFECTS = Object.freeze({
  files_written: 0, model_calls: 0, network_reads: 0, network_writes: 0,
  database_writes: 0, product_writes: 0, m0_m4_mutations: 0, m8_actions: 0,
});
const WORK1_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'work1_contract_receipt_id', 'work1_contract_receipt_digest',
  'stage', 'state', 'status', 'activation_commit_binding', 'work0_evidence_root_binding',
  'work1_7_authority_binding', 'activation_receipt_binding', 'contract_policy_binding',
  'family_packet_set_binding', 'artifact_bindings', 'artifact_set_digest',
  'command_execution_ledger', 'drafting_command_audit', 'combined_test_result',
  'repository_precondition', 'counts', 'checks', 'effects', 'next_work',
]);
const LATER_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'state', 'status', 'work', 'execution_manifest_id',
  'execution_manifest_digest', 'counts', 'effects',
]);
const RESULT_KEYS = Object.freeze([
  'schema_version', 'status', 'work', 'manifest_path', 'execution_manifest_id',
  'execution_manifest_digest', 'candidate_registration_id', 'deferred_proofs',
]);
const CANONICAL_ROOT = realpathSync(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..',
));

export class WorkExecutionManifestValidationError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'WorkExecutionManifestValidationError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new WorkExecutionManifestValidationError(code, detail);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && same(Object.keys(value).sort(), [...keys].sort());
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function workNumber(work) {
  return Number(work.slice(4));
}

function executionManifestPath(work) {
  return `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work${workNumber(work)}-execution-manifest.json`;
}

function normaliseRoot(repoRoot) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) fail('INVALID_OPTIONS', 'repoRoot');
  let root;
  try {
    root = realpathSync(repoRoot);
  } catch {
    fail('PATH_SAFETY', 'repoRoot');
  }
  if (root !== path.resolve(repoRoot)) fail('PATH_SAFETY', 'symlinked repoRoot');
  return root;
}

function normaliseRepositoryPath(repositoryPath, code = 'PATH_SAFETY') {
  if (typeof repositoryPath !== 'string' || repositoryPath.length === 0
    || path.posix.isAbsolute(repositoryPath) || repositoryPath.includes('\\')
    || /[\0*?\[\]{}]/.test(repositoryPath)) {
    fail(code, String(repositoryPath));
  }
  const parts = repositoryPath.split('/');
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..')
    || path.posix.normalize(repositoryPath) !== repositoryPath) {
    fail(code, repositoryPath);
  }
  return repositoryPath;
}

function inspectSafePath(root, repositoryPath, mustExist) {
  normaliseRepositoryPath(repositoryPath);
  const parts = repositoryPath.split('/');
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (!mustExist && error.code === 'ENOENT') return current;
      fail('PATH_SAFETY', repositoryPath);
    }
    if (stat.isSymbolicLink()) fail('PATH_SAFETY', repositoryPath);
    if (index < parts.length - 1 && !stat.isDirectory()) fail('PATH_SAFETY', repositoryPath);
    if (index === parts.length - 1 && !stat.isFile()) fail('PATH_SAFETY', repositoryPath);
  }
  return current;
}

function readSafe(root, repositoryPath) {
  return readFileSync(inspectSafePath(root, repositoryPath, true));
}

function parseCanonical(bytes, code, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code, label);
  }
  if (!bytes.equals(canonicalBytes(value))) fail(code, label);
  return value;
}

function restampedIdentity(record, digestField, idField) {
  const unsigned = clone(record);
  delete unsigned[digestField];
  delete unsigned[idField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return { digest, id: contentId(record.schema_version, withDigest) };
}

function validateContentIdOnly(record, idField, code, label) {
  if (typeof record?.schema_version !== 'string' || typeof record?.[idField] !== 'string') {
    fail(code, label);
  }
  const unsigned = clone(record);
  delete unsigned[idField];
  if (record[idField] !== contentId(record.schema_version, unsigned)) fail(code, label);
}

function validateAuthority(root) {
  const bytes = readSafe(root, AUTHORITY_PATH);
  const authority = parseCanonical(bytes, 'AUTHORITY_BINDING_DRIFT', AUTHORITY_PATH);
  const identity = restampedIdentity(authority, 'authority_digest', 'authority_id');
  const policy = authority.per_work_execution_manifest_policy;
  if (authority.authority_digest !== identity.digest || authority.authority_id !== identity.id
    || authority.authority_id !== AUTHORITY_ID
    || authority.authority_digest !== AUTHORITY_DIGEST
    || sha256Hex(bytes) !== AUTHORITY_SHA256
    || authority.schema_version !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1'
    || !policy || policy.schema_version !== SCHEMA
    || !same(policy.applies_to, WORKS)
    || policy.create_once_no_overwrite !== true
    || policy.authoring_manifest_is_only_pre_work_bootstrap_write !== true
    || !same(policy.exact_paths, WORKS.map(executionManifestPath))
    || !same(policy.parent_authority_binding_fields,
      ['path', 'schema_version', 'authority_id', 'authority_digest', 'byte_length', 'sha256'])
    || !authority.command_policy?.later_work_entrypoints
    || !authority.command_policy?.later_work_tests
    || authority.prohibited_effects?.model_calls !== 0
    || authority.next_stage_lock?.m8_authorised !== false) {
    fail('AUTHORITY_BINDING_DRIFT', AUTHORITY_PATH);
  }
  return { authority, bytes };
}

function expectedAuthorityBinding(authority, bytes) {
  return {
    path: AUTHORITY_PATH,
    schema_version: authority.schema_version,
    authority_id: authority.authority_id,
    authority_digest: authority.authority_digest,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  };
}

function validateRecordBinding(root, binding, code) {
  if (!exactKeys(binding, RECORD_BINDING_KEYS)
    || typeof binding.schema_version !== 'string'
    || typeof binding.record_id_field !== 'string'
    || typeof binding.record_id !== 'string'
    || !Number.isSafeInteger(binding.byte_length) || binding.byte_length <= 0
    || !HASH_64.test(binding.sha256)
    || !HASH_40.test(binding.git_blob_oid)) {
    fail(code, 'binding shape');
  }
  const bytes = readSafe(root, binding.path);
  const record = parseCanonical(bytes, code, binding.path);
  if (record.schema_version !== binding.schema_version
    || record[binding.record_id_field] !== binding.record_id
    || bytes.length !== binding.byte_length
    || sha256Hex(bytes) !== binding.sha256
    || gitBlobOid(bytes) !== binding.git_blob_oid) {
    fail(code, binding.path);
  }
  return { record, bytes };
}

function recordBinding(repositoryPath, bytes, record, idField) {
  return {
    path: repositoryPath,
    schema_version: record.schema_version,
    record_id_field: idField,
    record_id: record[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function validateActivation(root, authority, binding, commitBinding) {
  const { record, bytes } = validateRecordBinding(root, binding, 'ACTIVATION_BINDING_DRIFT');
  const identity = restampedIdentity(record, 'activation_receipt_digest', 'activation_receipt_id');
  if (binding.path !== ACTIVATION_PATH
    || binding.record_id_field !== 'activation_receipt_id'
    || record.activation_receipt_digest !== identity.digest
    || record.activation_receipt_id !== identity.id
    || record.activation_receipt_id !== ACTIVATION_ID
    || record.activation_receipt_digest !== ACTIVATION_DIGEST
    || sha256Hex(bytes) !== ACTIVATION_SHA256
    || record.state !== 'PASS_AUTHORITY_ACTIVATION'
    || record.authority_binding?.record_id !== authority.authority_id
    || record.authority_binding?.record_digest !== authority.authority_digest
    || !exactKeys(commitBinding, ACTIVATION_COMMIT_KEYS)
    || commitBinding.commit !== ACTIVATION_COMMIT
    || commitBinding.parent_commit !== authority.base_commit
    || commitBinding.branch !== BRANCH
    || commitBinding.activation_receipt_id !== record.activation_receipt_id) {
    fail('ACTIVATION_BINDING_DRIFT', ACTIVATION_PATH);
  }
  return record;
}

function validateManifestIdentity(record, policy, expectedWork) {
  if (!exactKeys(record, policy.exact_members)
    || record.schema_version !== SCHEMA
    || record.work !== expectedWork
    || record.state !== 'PRE_WORK_BOOTSTRAP_ONLY') {
    fail('MANIFEST_CONTRACT_DRIFT', expectedWork);
  }
  const identity = restampedIdentity(record, 'execution_manifest_digest', 'execution_manifest_id');
  if (record.execution_manifest_digest !== identity.digest || record.execution_manifest_id !== identity.id) {
    fail('MANIFEST_IDENTITY_DRIFT', expectedWork);
  }
}

function readPriorManifest(root, authority, work) {
  const previousWork = `WORK${workNumber(work) - 1}`;
  const repositoryPath = executionManifestPath(previousWork);
  const bytes = readSafe(root, repositoryPath);
  const record = parseCanonical(bytes, 'PREDECESSOR_BINDING_DRIFT', repositoryPath);
  validateManifestIdentity(record, authority.per_work_execution_manifest_policy, previousWork);
  return { record, bytes, repositoryPath };
}

function isSortedUnique(values) {
  return Array.isArray(values) && values.length > 0
    && values.every((value) => typeof value === 'string')
    && same(values, [...new Set(values)].sort());
}

function underPrefix(repositoryPath, prefix) {
  const normalised = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return repositoryPath === prefix.replace(/\/$/, '') || repositoryPath.startsWith(normalised);
}

function validateReadPaths(root, authority, manifestPath, manifest, priorPath) {
  const paths = manifest.permitted_read_paths;
  if (!isSortedUnique(paths)) fail('PATH_SCOPE_DRIFT', 'permitted_read_paths');
  const prefixes = authority.permitted_reads.repository_relative_prefixes;
  for (const repositoryPath of paths) {
    normaliseRepositoryPath(repositoryPath, 'PATH_SCOPE_DRIFT');
    if (!prefixes.some((prefix) => underPrefix(repositoryPath, prefix))) {
      fail('PATH_SCOPE_DRIFT', repositoryPath);
    }
  }
  if (typeof manifest.predecessor_receipt_binding?.path !== 'string') {
    fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
  }
  const required = [
    manifestPath,
    AUTHORITY_PATH,
    ACTIVATION_PATH,
    manifest.predecessor_receipt_binding.path,
  ];
  if (priorPath) required.push(priorPath);
  if (manifest.candidate_registration_binding) {
    required.push(manifest.candidate_registration_binding.registration_binding?.path);
  }
  if (required.some((repositoryPath) => !paths.includes(repositoryPath))) {
    fail('PATH_SCOPE_DRIFT', 'required read binding absent');
  }
  for (const repositoryPath of paths) {
    inspectSafePath(root, repositoryPath, true);
  }
}

function matchesFileRule(repositoryPath, rule) {
  if (path.posix.dirname(repositoryPath) !== rule.directory) return false;
  const filename = path.posix.basename(repositoryPath);
  if (!filename.startsWith(rule.prefix)) return false;
  return new RegExp(rule.suffix_pattern).test(filename.slice(rule.prefix.length));
}

function parentAllowsWrite(authority, repositoryPath) {
  const policy = authority.permitted_writes;
  return policy.exact_paths.includes(repositoryPath)
    || policy.creation_only_exact_paths.includes(repositoryPath)
    || policy.file_prefix_rules.some((rule) => matchesFileRule(repositoryPath, rule))
    || policy.repository_relative_prefixes.some((prefix) => underPrefix(repositoryPath, prefix));
}

function validateWritePaths(root, authority, manifestPath, manifest) {
  const paths = manifest.permitted_write_paths;
  if (!isSortedUnique(paths)) fail('PATH_SCOPE_DRIFT', 'permitted_write_paths');
  const immutablePaths = new Set(authority.immutable_paths);
  const work1Paths = new Set(authority.command_policy.work1_exact_changed_paths);
  const allManifestPaths = new Set(authority.per_work_execution_manifest_policy.exact_paths);
  const number = workNumber(manifest.work);
  const candidateWritePaths = paths.filter((repositoryPath) => underPrefix(
    repositoryPath,
    CANDIDATE_ROOT,
  ));
  if (candidateWritePaths.length > 1
      || (candidateWritePaths.length === 1 && (
        number >= 5
        || manifest.candidate_registration_binding !== null
        || requiresCandidate(manifest)
      ))) {
    fail('PATH_SCOPE_DRIFT', 'candidate registration write phase');
  }
  for (const repositoryPath of paths) {
    normaliseRepositoryPath(repositoryPath, 'PATH_SCOPE_DRIFT');
    const absolute = inspectSafePath(root, repositoryPath, false);
    if (repositoryPath === 'docs/core/PLAN.md'
        || repositoryPath === 'docs/core/OPERATING-RULES.md') {
      fail('PATH_SCOPE_DRIFT', 'core document region cannot be represented by this manifest');
    }
    if (underPrefix(repositoryPath, CANDIDATE_ROOT)) {
      if (!new RegExp(`^${CANDIDATE_ROOT}/[0-9a-f]{64}\\.json$`).test(repositoryPath)) {
        fail('PATH_SCOPE_DRIFT', repositoryPath);
      }
      try {
        lstatSync(absolute);
        fail('WRITE_ONCE_DRIFT', repositoryPath);
      } catch (error) {
        if (error instanceof WorkExecutionManifestValidationError) throw error;
        if (error.code !== 'ENOENT') fail('PATH_SAFETY', repositoryPath);
      }
    }
    if (allManifestPaths.has(repositoryPath)) fail('WRITE_ONCE_DRIFT', repositoryPath);
    if (!parentAllowsWrite(authority, repositoryPath)
      || immutablePaths.has(repositoryPath)
      || authority.immutable_prefixes.some((prefix) => repositoryPath.startsWith(prefix))
      || work1Paths.has(repositoryPath)
      || /(?:^|[/_-])m8(?:[/_.-]|$)/i.test(repositoryPath)) {
      fail('PATH_SCOPE_DRIFT', repositoryPath);
    }
    const referencedWork = /m7-v2-repair-work([1-7])(?:-|\.)/.exec(repositoryPath)?.[1];
    if (referencedWork && Number(referencedWork) !== number) fail('PATH_SCOPE_DRIFT', repositoryPath);
  }
  if (paths.includes(manifestPath)) fail('WRITE_ONCE_DRIFT', manifestPath);
  const receiptPattern = new RegExp(`^evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work${number}-[a-z0-9-]+\\.json$`);
  if (!receiptPattern.test(manifest.work_receipt_path)
    || !paths.includes(manifest.work_receipt_path)) {
    fail('PATH_SCOPE_DRIFT', 'work_receipt_path');
  }
}

function safeToken(token) {
  return typeof token === 'string' && token.length > 0
    && !/[\0\r\n`$;&|<>*?\[\]{}]/.test(token);
}

function pathIsInScope(repositoryPath, manifest) {
  return manifest.permitted_read_paths.includes(repositoryPath)
    || manifest.permitted_write_paths.includes(repositoryPath);
}

function boundGitObjects(authority, manifest) {
  return new Set([
    authority.base_commit,
    ACTIVATION_COMMIT,
    manifest.base_tip_binding.commit,
    manifest.base_tip_binding.parent_commit,
    manifest.activation_receipt_binding.git_blob_oid,
    manifest.predecessor_receipt_binding.git_blob_oid,
    manifest.candidate_registration_binding?.registration_binding?.git_blob_oid,
  ].filter(Boolean));
}

function validateGitReadArgv(argv, authority, manifest) {
  const boundObjects = boundGitObjects(authority, manifest);
  const exact = (...tokens) => same(argv, ['git', ...tokens]);
  if (exact('status', '--short', '--branch')
    || exact('diff', '--check')
    || exact('diff', '--cached', '--name-only')
    || exact('rev-parse', 'HEAD')
    || exact('rev-parse', '--show-toplevel')
    || exact('rev-parse', '--git-common-dir')
    || exact('rev-parse', `refs/remotes/origin/${BRANCH}`)) return true;
  if (argv[1] === 'rev-list' && same(argv.slice(2, 5), ['--parents', '-n', '1'])
    && argv.length === 6 && boundObjects.has(argv[5])) return true;
  if (argv[1] === 'cat-file' && argv.length === 4
    && ['-p', '-s', '-t'].includes(argv[2]) && boundObjects.has(argv[3])) return true;
  if (argv[1] === 'diff-tree' && argv.length === 6
    && same(argv.slice(2, 5), ['--no-commit-id', '--name-only', '-r'])
    && boundObjects.has(argv[5])) return true;
  if (argv[1] === 'hash-object' && argv.length === 4 && argv[2] === '--') {
    return pathIsInScope(argv[3], manifest);
  }
  if (argv[1] === 'show' && argv.length === 3) {
    const match = /^([0-9a-f]{40}):(.+)$/.exec(argv[2]);
    return Boolean(match && boundObjects.has(match[1]) && pathIsInScope(match[2], manifest));
  }
  if (argv[1] === 'ls-files' && argv.length === 5
    && same(argv.slice(2, 4), ['-s', '--'])) return pathIsInScope(argv[4], manifest);
  if (argv[1] === 'ls-tree' && argv.length >= 5
    && same(argv.slice(2, 4), ['-r', '--full-tree']) && boundObjects.has(argv[4])) {
    return argv.length === 5 || (argv.length === 7 && argv[5] === '--' && pathIsInScope(argv[6], manifest));
  }
  if (argv[1] === 'diff' && argv[2] === '--name-only' && boundObjects.has(argv[3])) {
    return argv.length === 4 || (argv[4] === '--'
      && argv.slice(5).length > 0 && argv.slice(5).every((item) => pathIsInScope(item, manifest)));
  }
  if (argv[1] === 'log' && argv.length === 6 && /^--format=/.test(argv[2])
    && argv[3] === '-n' && /^[1-9][0-9]*$/.test(argv[4]) && boundObjects.has(argv[5])) return true;
  return false;
}

function validateRunArgv(argv, authority, manifest) {
  if (!Array.isArray(argv) || argv.length < 2 || !argv.every(safeToken)) return false;
  if (same(argv, ['node', VALIDATOR_PATH, executionManifestPath(manifest.work)])) return true;
  if (argv[0] === 'node' && argv[1] === '--check' && argv.length === 3) {
    return /\.(?:js|mjs)$/.test(argv[2]) && pathIsInScope(argv[2], manifest);
  }
  if (argv[0] === 'node' && argv[1] === '--test' && argv.length >= 3) {
    return argv.slice(2).every((repositoryPath) => authority.command_policy.later_work_tests.includes(repositoryPath)
      && repositoryPath.includes(`work${workNumber(manifest.work)}.test.js`)
      && pathIsInScope(repositoryPath, manifest));
  }
  if (argv[0] === 'node' && argv.length === 2) {
    return authority.command_policy.later_work_entrypoints.includes(argv[1])
      && (argv[1].includes(`work${workNumber(manifest.work)}-`)
        || [
          'scripts/stage-2y-structure-family-aggregate.mjs',
          'scripts/stage-2y-structure-m6-project.mjs',
          'scripts/stage-2y-structure-generalisation-shadow.mjs',
        ].includes(argv[1]))
      && pathIsInScope(argv[1], manifest);
  }
  return argv[0] === 'git' && validateGitReadArgv(argv, authority, manifest);
}

function validateCommands(authority, manifestPath, manifest) {
  const entries = manifest.exact_argv_with_run_limits;
  if (!Array.isArray(entries) || entries.length === 0
    || entries.some((entry) => !exactKeys(entry, RUN_KEYS)
      || !Number.isSafeInteger(entry.max_runs) || entry.max_runs <= 0
      || !validateRunArgv(entry.argv, authority, manifest))) {
    fail('COMMAND_SCOPE_DRIFT', 'exact_argv_with_run_limits');
  }
  if (!same(entries[0].argv, ['node', VALIDATOR_PATH, manifestPath])) {
    fail('COMMAND_SCOPE_DRIFT', 'manifest validator must be first');
  }
  const serialised = entries.map((entry) => canonicalJson(entry.argv));
  if (new Set(serialised).size !== serialised.length) fail('COMMAND_SCOPE_DRIFT', 'duplicate argv');
  const commands = manifest.exact_git_commit_and_push_argv;
  if (!Array.isArray(commands) || commands.length !== 3
    || commands.some((argv) => !Array.isArray(argv) || !argv.every(safeToken))) {
    fail('COMMAND_SCOPE_DRIFT', 'git commands');
  }
  const expectedAddPaths = [manifestPath, ...manifest.permitted_write_paths].sort();
  if (!same(commands[0], ['git', 'add', '--', ...expectedAddPaths])
    || commands[1].length !== 4 || !same(commands[1].slice(0, 3), ['git', 'commit', '-m'])
    || !commands[1][3].includes(`Work ${workNumber(manifest.work)}`)
    || !same(commands[2], ['git', 'push', 'origin', BRANCH])) {
    fail('COMMAND_SCOPE_DRIFT', 'commit and push');
  }
}

function validateAllowedEffects(parent, child, work) {
  if (!exactKeys(child, Object.keys(parent))) fail('EFFECT_SCOPE_DRIFT', 'allowed effect keys');
  for (const [key, parentValue] of Object.entries(parent)) {
    const childValue = child[key];
    if (key === 'repository_pushes') {
      if (!exactKeys(childValue, ['branch', 'maximum', 'remote'])
        || childValue.branch !== parentValue.branch || childValue.remote !== parentValue.remote
        || !Number.isSafeInteger(childValue.maximum) || childValue.maximum < 1
        || childValue.maximum > parentValue.maximum) fail('EFFECT_SCOPE_DRIFT', key);
    } else if (typeof parentValue === 'boolean') {
      if (typeof childValue !== 'boolean' || (childValue && !parentValue)) fail('EFFECT_SCOPE_DRIFT', key);
    } else if (typeof parentValue === 'number') {
      if (!Number.isSafeInteger(childValue) || childValue < 0 || childValue > parentValue) {
        fail('EFFECT_SCOPE_DRIFT', key);
      }
    } else {
      fail('EFFECT_SCOPE_DRIFT', key);
    }
  }
  if (child.local_commits !== 1 || child.repository_pushes.maximum !== 1
    || (child.lawyer_review_packet_writes && work !== 'WORK5')) {
    fail('EFFECT_SCOPE_DRIFT', 'work effect');
  }
}

function validateStopConditions(parent, child) {
  if (!exactKeys(child, Object.keys(parent))) fail('EFFECT_SCOPE_DRIFT', 'stop condition keys');
  for (const [scope, required] of Object.entries(parent)) {
    const actual = child[scope];
    if (!Array.isArray(actual) || actual.some((item) => typeof item !== 'string')
      || new Set(actual).size !== actual.length
      || required.some((item) => !actual.includes(item))) {
      fail('EFFECT_SCOPE_DRIFT', `stop conditions ${scope}`);
    }
  }
}

function validateSuccessConditions(conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0
    || new Set(conditions).size !== conditions.length
    || conditions.some((item) => typeof item !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(item))
    || !conditions.includes(DEFERRED_GIT_PROOF)) {
    fail('BASE_TIP_DRIFT', 'deferred Git proof');
  }
}

function validateBaseTip(root, authority, manifest, priorState, predecessorReceipt) {
  const binding = manifest.base_tip_binding;
  if (!exactKeys(binding, BASE_TIP_KEYS) || !HASH_40.test(binding.commit)
    || !HASH_40.test(binding.parent_commit) || binding.commit === binding.parent_commit
    || binding.branch !== BRANCH || typeof binding.commit_message !== 'string'
    || binding.commit_message.length === 0 || /[\r\n]/.test(binding.commit_message)) {
    fail('BASE_TIP_DRIFT', manifest.work);
  }
  const prior = priorState?.record ?? null;
  const predecessorWork = `WORK${workNumber(manifest.work) - 1}`;
  let expectedParent;
  let expectedMessage;
  let expectedDeltaPaths;
  let expectedPriorManifestBinding;
  if (manifest.work === 'WORK2') {
    expectedParent = root === CANONICAL_ROOT ? ACTIVATION_COMMIT : binding.parent_commit;
    expectedMessage = root === CANONICAL_ROOT ? WORK1_COMMIT_MESSAGE : binding.commit_message;
    expectedDeltaPaths = authority.command_policy.exact_work1_commit_argv[0].slice(3).sort();
    expectedPriorManifestBinding = null;
  } else {
    const priorCommitCommand = prior?.exact_git_commit_and_push_argv?.[1];
    if (!Array.isArray(priorCommitCommand) || priorCommitCommand.length !== 4) {
      fail('BASE_TIP_DRIFT', manifest.work);
    }
    expectedParent = prior.base_tip_binding.commit;
    expectedMessage = priorCommitCommand[3];
    expectedDeltaPaths = [priorState.repositoryPath, ...prior.permitted_write_paths].sort();
    expectedPriorManifestBinding = recordBinding(
      priorState.repositoryPath,
      priorState.bytes,
      prior,
      'execution_manifest_id',
    );
  }
  if (binding.parent_commit !== expectedParent || binding.commit_message !== expectedMessage) {
    fail('BASE_TIP_DRIFT', manifest.work);
  }
  const attestation = binding.milestone_attestation;
  if (!exactKeys(attestation, ATTESTATION_KEYS)
      || attestation.attestation_scope !== (root === CANONICAL_ROOT
        ? 'EXTERNAL_REPOSITORY_OBSERVATION'
        : 'STRUCTURAL_TEST_FIXTURE_NOT_GIT_PROOF')
      || attestation.state !== 'EXTERNAL_ORCHESTRATOR_ATTESTED_COMMITTED_AND_PUSHED'
      || attestation.attestor !== 'ROOT_ORCHESTRATOR'
      || attestation.predecessor_work !== predecessorWork
      || attestation.commit !== binding.commit
      || attestation.parent_commit !== binding.parent_commit
      || attestation.branch !== binding.branch
      || attestation.commit_message !== binding.commit_message
      || attestation.origin_ref !== `refs/remotes/origin/${BRANCH}`
      || !same(attestation.predecessor_receipt_binding,
        manifest.predecessor_receipt_binding)
      || !same(attestation.predecessor_execution_manifest_binding,
        expectedPriorManifestBinding)
      || !same(attestation.exact_commit_delta_paths, expectedDeltaPaths)) {
    fail('BASE_TIP_DRIFT', 'external milestone attestation');
  }
  const expectedObservation = {
    repository_cwd: root,
    git_dir_unset: true,
    git_work_tree_unset: true,
    git_no_replace_objects: '1',
    shallow_history: false,
    grafts_present: false,
    loose_replace_refs_present: false,
    packed_replace_refs_present: false,
  };
  if (!same(attestation.repository_observation, expectedObservation)) {
    fail('BASE_TIP_DRIFT', 'Git safety observation');
  }
  const expectedValidationResult = manifest.work === 'WORK2'
    ? {
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_VALIDATION/V1',
      status: 'PASS_WORK1_CONTRACTS',
      contract_policy_id: predecessorReceipt.contract_policy_binding?.record_id,
      family_packet_set_id: predecessorReceipt.family_packet_set_binding?.record_id,
      work1_contract_receipt_id: predecessorReceipt.work1_contract_receipt_id,
      counts: predecessorReceipt.counts,
      effects: predecessorReceipt.effects,
    }
    : {
      schema_version:
        `STAGE_2Y_M7_V2_REPAIR_WORK${workNumber(manifest.work) - 1}_VALIDATION/V1`,
      status: `PASS_WORK${workNumber(manifest.work) - 1}`,
      work: predecessorWork,
      receipt_id_field: manifest.predecessor_receipt_binding.record_id_field,
      receipt_id: manifest.predecessor_receipt_binding.record_id,
    };
  if (!same(attestation.predecessor_validation_result, expectedValidationResult)) {
    fail('PREDECESSOR_BINDING_DRIFT', 'predecessor validator PASS result');
  }
  const expectedChecks = ATTESTATION_CHECK_IDS.map((check_id) => ({
    check_id,
    state: 'EXTERNALLY_ATTESTED',
  }));
  if (!same(attestation.checks, expectedChecks)) {
    fail('BASE_TIP_DRIFT', 'external milestone checks');
  }
  const expectedResult = {
    SINGLE_PARENT: `${binding.commit} ${binding.parent_commit}`,
    EXPECTED_PARENT: `${binding.commit} ${binding.parent_commit}`,
    EXPECTED_MESSAGE: binding.commit_message,
    EXACT_TREE_DELTA: expectedDeltaPaths,
    RECEIPT_BLOB_IN_COMMIT: manifest.predecessor_receipt_binding.git_blob_oid,
    ORIGIN_REF_EQUALS_COMMIT: binding.commit,
  };
  const expectedArgv = {
    SINGLE_PARENT: ['git', 'rev-list', '--parents', '-n', '1', binding.commit],
    EXPECTED_PARENT: ['git', 'rev-list', '--parents', '-n', '1', binding.commit],
    EXPECTED_MESSAGE: ['git', 'log', '--format=%s', '-n', '1', binding.commit],
    EXACT_TREE_DELTA: [
      'git', 'diff-tree', '--no-commit-id', '--name-only', '-r', binding.commit,
    ],
    RECEIPT_BLOB_IN_COMMIT: [
      'git', 'ls-tree', '-r', '--full-tree', binding.commit, '--',
      manifest.predecessor_receipt_binding.path,
    ],
    ORIGIN_REF_EQUALS_COMMIT: ['git', 'rev-parse', `refs/remotes/origin/${BRANCH}`],
  };
  const expectedLedger = ATTESTATION_COMMAND_CHECK_IDS.map((check_id) => ({
    check_id,
    argv: expectedArgv[check_id],
    exit_code: 0,
    observed_result: expectedResult[check_id],
  }));
  if (!same(attestation.observed_command_result_ledger, expectedLedger)) {
    fail('BASE_TIP_DRIFT', 'external milestone command ledger');
  }
}

function requiresCandidate(manifest) {
  if (workNumber(manifest.work) >= 5
    || manifest.allowed_effects.v2_shadow_analysis_runs
    || manifest.allowed_effects.v2_shadow_projection_runs) return true;
  const evidenceEntrypoints = new Set([
    'scripts/stage-2y-structure-family-aggregate.mjs',
    'scripts/stage-2y-structure-m6-project.mjs',
    'scripts/stage-2y-structure-generalisation-shadow.mjs',
  ]);
  return manifest.exact_argv_with_run_limits.some((entry) => evidenceEntrypoints.has(entry.argv[1]));
}

function validateCandidateInnerBinding(binding, label) {
  if (!exactKeys(binding, RECORD_BINDING_KEYS)
      || typeof binding.path !== 'string'
      || !Number.isSafeInteger(binding.byte_length) || binding.byte_length <= 0
      || !HASH_64.test(binding.sha256) || !HASH_40.test(binding.git_blob_oid)
      || ((binding.schema_version === null) !== (binding.record_id_field === null))
      || ((binding.record_id_field === null) !== (binding.record_id === null))
      || (binding.schema_version !== null && typeof binding.schema_version !== 'string')
      || (binding.record_id_field !== null && typeof binding.record_id_field !== 'string')
      || (binding.record_id !== null && !HASH_64.test(binding.record_id))) {
    fail('CANDIDATE_BINDING_DRIFT', label);
  }
  normaliseRepositoryPath(binding.path, 'CANDIDATE_BINDING_DRIFT');
}

function resolveCandidateComponent(root, binding, permittedReadPaths) {
  validateCandidateInnerBinding(binding, binding.path);
  if (!permittedReadPaths.includes(binding.path)) {
    fail('PATH_SCOPE_DRIFT', `candidate component read is not permitted: ${binding.path}`);
  }
  const selectedBytes = readSafe(root, binding.path);
  if (selectedBytes.length !== binding.byte_length
      || sha256Hex(selectedBytes) !== binding.sha256
      || gitBlobOid(selectedBytes) !== binding.git_blob_oid) {
    fail('CANDIDATE_BINDING_DRIFT', `${binding.path} bytes`);
  }
  if (binding.schema_version !== null) {
    const selectedRecord = parseCanonical(
      selectedBytes,
      'CANDIDATE_BINDING_DRIFT',
      binding.path,
    );
    if (selectedRecord.schema_version !== binding.schema_version
        || selectedRecord[binding.record_id_field] !== binding.record_id) {
      fail('CANDIDATE_BINDING_DRIFT', `${binding.path} envelope`);
    }
    validateContentIdOnly(
      selectedRecord,
      binding.record_id_field,
      'CANDIDATE_BINDING_DRIFT',
      binding.path,
    );
    return selectedRecord;
  }
  return null;
}

function validateCandidatePredecessorReceipt(
  root, authority, entry, index, permittedReadPaths,
) {
  const receipt = resolveCandidateComponent(root, entry.binding, permittedReadPaths);
  if (index === 0) {
    const identity = restampedIdentity(
      receipt,
      'work1_contract_receipt_digest',
      'work1_contract_receipt_id',
    );
    if (!exactKeys(receipt, WORK1_RECEIPT_KEYS)
        || receipt.work1_contract_receipt_digest !== identity.digest
        || receipt.work1_contract_receipt_id !== identity.id
        || receipt.stage !== 'M7_V2_REPAIR_WORK1'
        || receipt.state !== 'PASS_WORK1_CONTRACTS'
        || receipt.status !== 'PASS'
        || receipt.next_work
          ?.work2_predecessor_pass_effective_only_after_exact_commit_push_origin_proof !== true
        || receipt.next_work?.work2_start_state_at_receipt_write
          !== 'LOCKED_PENDING_WORK1_MILESTONE_PROOF') {
      fail('CANDIDATE_BINDING_DRIFT', 'Work1 predecessor receipt state');
    }
    return;
  }

  const priorManifestPath = executionManifestPath(entry.work);
  if (!permittedReadPaths.includes(priorManifestPath)) {
    fail('PATH_SCOPE_DRIFT', `candidate predecessor manifest read is not permitted: ${priorManifestPath}`);
  }
  const priorManifest = parseCanonical(
    readSafe(root, priorManifestPath),
    'CANDIDATE_BINDING_DRIFT',
    priorManifestPath,
  );
  const priorIdentity = restampedIdentity(
    priorManifest,
    'execution_manifest_digest',
    'execution_manifest_id',
  );
  if (!exactKeys(priorManifest, authority.per_work_execution_manifest_policy.exact_members)
      || priorManifest.schema_version !== SCHEMA
      || priorManifest.work !== entry.work
      || priorManifest.state !== 'PRE_WORK_BOOTSTRAP_ONLY'
      || priorManifest.execution_manifest_digest !== priorIdentity.digest
      || priorManifest.execution_manifest_id !== priorIdentity.id) {
    fail('CANDIDATE_BINDING_DRIFT', `${entry.work} execution manifest`);
  }
  const authorityBytes = readSafe(root, AUTHORITY_PATH);
  const receiptIdField = `work${index + 1}_receipt_id`;
  if (!same(priorManifest.parent_authority_binding,
    expectedAuthorityBinding(authority, authorityBytes))
      || priorManifest.work_receipt_path !== entry.binding.path
      || !exactKeys(receipt, [...LATER_RECEIPT_KEYS, receiptIdField])
      || receipt.status !== 'PASS'
      || typeof receipt.state !== 'string' || !receipt.state.startsWith('PASS')
      || receipt.work !== entry.work
      || (receipt.stage !== undefined && receipt.stage !== `M7_V2_REPAIR_${entry.work}`)
      || receipt.execution_manifest_id !== priorManifest.execution_manifest_id
      || receipt.execution_manifest_digest !== priorManifest.execution_manifest_digest) {
    fail('CANDIDATE_BINDING_DRIFT', `${entry.work} predecessor receipt state`);
  }
}

function validateFullCandidateRecord(root, authority, record, permittedReadPaths) {
  if (!exactKeys(record, CANDIDATE_RECORD_KEYS)
      || record.schema_version !== CANDIDATE_SCHEMA
      || record.stage !== 'M7_V2_REPAIR'
      || record.lifecycle_state !== 'CANDIDATE_PENDING_REVIEW'
      || !exactKeys(record.code_bindings, CANDIDATE_CODE_KEYS)
      || !Array.isArray(record.code_bindings.runners)
      || !Array.isArray(record.code_bindings.tests)
      || !Array.isArray(record.semantic_input_bindings)
      || !Array.isArray(record.subtype_tree_bindings)
      || !Array.isArray(record.predecessor_receipt_bindings)
      || !exactKeys(record.counts, [
        'code_file_count', 'runner_count', 'test_count', 'semantic_input_count',
        'subtype_tree_count', 'predecessor_receipt_count', 'unique_bound_path_count',
      ])
      || !same(record.effects, CANDIDATE_EFFECTS)) {
    fail('CANDIDATE_BINDING_DRIFT', 'full candidate registration contract');
  }
  const fixed = [
    [record.parent_authority_binding, AUTHORITY_PATH,
      'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1', 'authority_id', AUTHORITY_ID,
      AUTHORITY_SHA256],
    [record.activation_receipt_binding, ACTIVATION_PATH,
      'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1',
      'activation_receipt_id', ACTIVATION_ID, ACTIVATION_SHA256],
    [record.work0_evidence_root_binding, WORK0_PATH,
      'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1', 'evidence_root_id', WORK0_ID,
      WORK0_SHA256],
  ];
  for (const [binding, repositoryPath, schemaVersion, idField, id, sha] of fixed) {
    validateCandidateInnerBinding(binding, repositoryPath);
    if (binding.path !== repositoryPath || binding.schema_version !== schemaVersion
        || binding.record_id_field !== idField || binding.record_id !== id
        || binding.sha256 !== sha) {
      fail('CANDIDATE_BINDING_DRIFT', repositoryPath);
    }
  }
  const expectedCodePaths = {
    compiler: 'lib/canonical-v2/agreement-analysis-consolidation.js',
    deterministic_generator: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
    contract_validator: 'lib/canonical-v2/m7-v2-contract.js',
    projector: 'lib/canonical-v2/agreement-projection.js',
    independent_verifier: 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
  };
  const flattened = [];
  for (const [role, repositoryPath] of Object.entries(expectedCodePaths)) {
    const binding = record.code_bindings[role];
    validateCandidateInnerBinding(binding, role);
    if (binding.path !== repositoryPath || binding.schema_version !== null) {
      fail('CANDIDATE_BINDING_DRIFT', role);
    }
    flattened.push(binding);
  }
  const expectedRunners = [
    'scripts/stage-2y-structure-family-aggregate.mjs',
    'scripts/stage-2y-structure-generalisation-shadow.mjs',
    'scripts/stage-2y-structure-m6-project.mjs',
  ];
  const predecessorCount = record.predecessor_receipt_bindings.length;
  const expectedTests = [
    'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
    'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js',
    'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
    ...Array.from({ length: predecessorCount }, (_, index) => (
      `tests/stage-2y-structure-m7-v2-repair-work${index + 2}.test.js`
    )),
  ];
  for (const [bindings, expected, label] of [
    [record.code_bindings.runners, expectedRunners, 'runners'],
    [record.code_bindings.tests, expectedTests, 'tests'],
  ]) {
    if (!same(bindings.map((binding) => binding.path), expected)) {
      fail('CANDIDATE_BINDING_DRIFT', label);
    }
    bindings.forEach((binding) => validateCandidateInnerBinding(binding, label));
    if (bindings.some((binding) => binding.schema_version !== null)) {
      fail('CANDIDATE_BINDING_DRIFT', label);
    }
    flattened.push(...bindings);
  }
  if (!same(record.semantic_input_bindings.map((entry) => entry.input_role),
    CANDIDATE_INPUT_ROLES)) {
    fail('CANDIDATE_BINDING_DRIFT', 'six semantic inputs');
  }
  for (const entry of record.semantic_input_bindings) {
    if (!exactKeys(entry, ['input_role', 'binding'])) {
      fail('CANDIDATE_BINDING_DRIFT', 'semantic input');
    }
    validateCandidateInnerBinding(entry.binding, entry.input_role);
    if (entry.binding.schema_version !== CANDIDATE_INPUT_SCHEMAS[entry.input_role]) {
      fail('CANDIDATE_BINDING_DRIFT', `${entry.input_role} schema`);
    }
    flattened.push(entry.binding);
  }
  if (!same(record.subtype_tree_bindings.map((entry) => entry.family_key),
    CANDIDATE_FAMILIES)) {
    fail('CANDIDATE_BINDING_DRIFT', '25 subtype trees');
  }
  for (const entry of record.subtype_tree_bindings) {
    if (!exactKeys(entry, ['family_key', 'binding'])
        || entry.binding.schema_version !== 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1'
        || entry.binding.record_id_field !== 'subtype_tree_id') {
      fail('CANDIDATE_BINDING_DRIFT', 'subtype tree');
    }
    validateCandidateInnerBinding(entry.binding, entry.family_key);
    const tree = resolveCandidateComponent(root, entry.binding, permittedReadPaths);
    if (tree.family_key !== entry.family_key) {
      fail('CANDIDATE_BINDING_DRIFT', `${entry.family_key} subtype tree family`);
    }
    flattened.push(entry.binding);
  }
  const profileInput = record.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  )?.binding;
  const structureInput = record.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_STRUCTURE_DISPOSITION_SET',
  )?.binding;
  if (!same(record.family_profile_set_binding, profileInput)
      || !same(record.structure_disposition_set_binding, structureInput)) {
    fail('CANDIDATE_BINDING_DRIFT', 'direct semantic bindings');
  }
  validateCandidateInnerBinding(record.view_policy_binding, 'view policy');
  if (record.view_policy_binding.schema_version !== 'STAGE_2Y_M7_V2_VIEW_POLICY/V1'
      || record.view_policy_binding.record_id_field !== 'view_policy_id') {
    fail('CANDIDATE_BINDING_DRIFT', 'view policy');
  }
  flattened.push(record.view_policy_binding);
  if (predecessorCount < 1 || predecessorCount > 5) {
    fail('CANDIDATE_BINDING_DRIFT', 'predecessor receipts');
  }
  record.predecessor_receipt_bindings.forEach((entry, index) => {
    if (!exactKeys(entry, ['work', 'binding']) || entry.work !== `WORK${index + 1}`) {
      fail('CANDIDATE_BINDING_DRIFT', 'predecessor receipt order');
    }
    validateCandidateInnerBinding(entry.binding, entry.work);
    if (index === 0) {
      if (entry.binding.path !== WORK1_RECEIPT_PATH
          || entry.binding.schema_version
            !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1'
          || entry.binding.record_id_field !== 'work1_contract_receipt_id') {
        fail('CANDIDATE_BINDING_DRIFT', 'Work1 predecessor receipt');
      }
    } else if (!new RegExp(
      `^evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work${index + 1}-[a-z0-9-]+\\.json$`,
    ).test(entry.binding.path)
      || entry.binding.schema_version
        !== `STAGE_2Y_M7_V2_REPAIR_WORK${index + 1}_RECEIPT/V1`
      || entry.binding.record_id_field !== `work${index + 1}_receipt_id`) {
      fail('CANDIDATE_BINDING_DRIFT', `${entry.work} predecessor receipt`);
    }
    validateCandidatePredecessorReceipt(
      root, authority, entry, index, permittedReadPaths,
    );
    flattened.push(entry.binding);
  });
  if (typeof record.allowed_output_root !== 'string'
      || !record.allowed_output_root.startsWith(
        'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/',
      )) {
    fail('CANDIDATE_BINDING_DRIFT', 'allowed output root');
  }
  flattened.unshift(
    record.parent_authority_binding,
    record.activation_receipt_binding,
    record.work0_evidence_root_binding,
  );
  const expectedCounts = {
    code_file_count: 5 + expectedRunners.length + expectedTests.length,
    runner_count: expectedRunners.length,
    test_count: expectedTests.length,
    semantic_input_count: CANDIDATE_INPUT_ROLES.length,
    subtype_tree_count: CANDIDATE_FAMILIES.length,
    predecessor_receipt_count: predecessorCount,
    unique_bound_path_count: new Set(flattened.map((binding) => binding.path)).size,
  };
  if (!same(record.counts, expectedCounts)) {
    fail('CANDIDATE_BINDING_DRIFT', 'candidate counts');
  }
  if (flattened.some((binding) => !permittedReadPaths.includes(binding.path))) {
    fail('PATH_SCOPE_DRIFT', 'candidate component read is absent from permitted_read_paths');
  }
  flattened.forEach((binding) => resolveCandidateComponent(
    root, binding, permittedReadPaths,
  ));
}

function validateCandidateVerification(verification, record, binding) {
  if (!exactKeys(verification, [
    'schema_version', 'verification_id', 'state', 'candidate_registration_id',
    'registration_binding', 'checks', 'counts', 'effects',
  ])
      || verification.schema_version !== CANDIDATE_VERIFICATION_SCHEMA
      || verification.state !== 'PASS_CANDIDATE_REGISTRATION'
      || verification.candidate_registration_id !== record.candidate_registration_id
      || !same(verification.registration_binding, binding)
      || !same(verification.checks, CANDIDATE_VERIFICATION_CHECK_IDS.map(
        (check_id) => ({ check_id, status: 'PASS' }),
      ))
      || !same(verification.counts, record.counts)
      || !same(verification.effects, CANDIDATE_VERIFICATION_EFFECTS)) {
    fail('CANDIDATE_BINDING_DRIFT', 'independent candidate verification');
  }
  validateContentIdOnly(
    verification,
    'verification_id',
    'CANDIDATE_BINDING_DRIFT',
    'independent candidate verification',
  );
}

function validateCandidate(root, authority, manifest, prior) {
  const wrapper = manifest.candidate_registration_binding;
  if (wrapper === null) {
    if (requiresCandidate(manifest)) fail('CANDIDATE_BINDING_DRIFT', manifest.work);
    return null;
  }
  if (!exactKeys(wrapper, CANDIDATE_WRAPPER_KEYS)) {
    fail('CANDIDATE_BINDING_DRIFT', 'candidate wrapper');
  }
  const binding = wrapper.registration_binding;
  if (!manifest.permitted_read_paths.includes(binding.path)) {
    fail('PATH_SCOPE_DRIFT', 'candidate registration read is absent from permitted_read_paths');
  }
  const { record } = validateRecordBinding(root, binding, 'CANDIDATE_BINDING_DRIFT');
  const expectedPath = `${CANDIDATE_ROOT}/${binding.record_id}.json`;
  if (binding.path !== expectedPath || binding.schema_version !== CANDIDATE_SCHEMA
    || binding.record_id_field !== 'candidate_registration_id'
    || record.lifecycle_state !== authority.candidate_registration_policy.lifecycle_state) {
    fail('CANDIDATE_BINDING_DRIFT', binding.path);
  }
  validateContentIdOnly(record, 'candidate_registration_id', 'CANDIDATE_BINDING_DRIFT', binding.path);
  validateFullCandidateRecord(root, authority, record, manifest.permitted_read_paths);
  validateCandidateVerification(wrapper.independent_verification, record, binding);
  if (workNumber(manifest.work) >= 6
    && !same(wrapper, prior?.candidate_registration_binding)) {
    fail('CANDIDATE_BINDING_DRIFT', 'Work5-7 continuity');
  }
  return binding.record_id;
}

function validatePredecessor(root, authority, manifest) {
  if (manifest.predecessor_receipt_binding === null) {
    fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
  }
  if (!Array.isArray(manifest.permitted_read_paths)
      || !manifest.permitted_read_paths.includes(
        manifest.predecessor_receipt_binding.path,
      )) {
    fail('PATH_SCOPE_DRIFT', 'predecessor receipt read is absent from permitted_read_paths');
  }
  if (manifest.work !== 'WORK2') {
    const priorManifestPath = executionManifestPath(
      `WORK${workNumber(manifest.work) - 1}`,
    );
    if (!manifest.permitted_read_paths.includes(priorManifestPath)) {
      fail('PATH_SCOPE_DRIFT', 'prior manifest read is absent from permitted_read_paths');
    }
  }
  const { record } = validateRecordBinding(
    root,
    manifest.predecessor_receipt_binding,
    'PREDECESSOR_BINDING_DRIFT',
  );
  if (manifest.work === 'WORK2') {
    const identity = restampedIdentity(
      record,
      'work1_contract_receipt_digest',
      'work1_contract_receipt_id',
    );
    if (manifest.predecessor_receipt_binding.path !== WORK1_RECEIPT_PATH
      || manifest.predecessor_receipt_binding.schema_version
        !== 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1'
      || manifest.predecessor_receipt_binding.record_id_field !== 'work1_contract_receipt_id'
      || !exactKeys(record, WORK1_RECEIPT_KEYS)
      || record.work1_contract_receipt_digest !== identity.digest
      || record.work1_contract_receipt_id !== identity.id
      || record.stage !== 'M7_V2_REPAIR_WORK1'
      || record.state !== 'PASS_WORK1_CONTRACTS'
      || record.status !== 'PASS'
      || record.next_work?.work2_predecessor_pass_effective_only_after_exact_commit_push_origin_proof
        !== true
      || record.next_work?.work2_start_state_at_receipt_write
        !== 'LOCKED_PENDING_WORK1_MILESTONE_PROOF') {
      fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
    }
    validateContentIdOnly(record, 'work1_contract_receipt_id',
      'PREDECESSOR_BINDING_DRIFT', WORK1_RECEIPT_PATH);
    return {
      prior: null, priorPath: null, priorState: null, predecessorReceipt: record,
    };
  }
  const priorState = readPriorManifest(root, authority, manifest.work);
  const { record: prior, repositoryPath: priorPath } = priorState;
  const predecessorNumber = workNumber(manifest.work) - 1;
  const predecessorIdField = `work${predecessorNumber}_receipt_id`;
  if (manifest.predecessor_receipt_binding.path !== prior.work_receipt_path
    || manifest.predecessor_receipt_binding.schema_version
      !== `STAGE_2Y_M7_V2_REPAIR_WORK${predecessorNumber}_RECEIPT/V1`
    || manifest.predecessor_receipt_binding.record_id_field !== predecessorIdField
    || !exactKeys(record, [...LATER_RECEIPT_KEYS, predecessorIdField])
    || record.status !== 'PASS'
    || typeof record.state !== 'string' || !record.state.startsWith('PASS')
    || record.work !== `WORK${predecessorNumber}`
    || record.execution_manifest_id !== prior.execution_manifest_id
    || record.execution_manifest_digest !== prior.execution_manifest_digest) {
    fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
  }
  validateContentIdOnly(record, predecessorIdField,
    'PREDECESSOR_BINDING_DRIFT', prior.work_receipt_path);
  return { prior, priorPath, priorState, predecessorReceipt: record };
}

export async function validateExecutionManifest(options) {
  if (!exactKeys(options, ['repoRoot', 'manifestPath'])) fail('INVALID_OPTIONS', 'options');
  const root = normaliseRoot(options.repoRoot);
  const manifestPath = normaliseRepositoryPath(options.manifestPath);
  const authorityState = validateAuthority(root);
  const { authority } = authorityState;
  if (!authority.per_work_execution_manifest_policy.exact_paths.includes(manifestPath)) {
    fail('PATH_SCOPE_DRIFT', manifestPath);
  }
  const bytes = readSafe(root, manifestPath);
  const manifest = parseCanonical(bytes, 'MANIFEST_BYTES_DRIFT', manifestPath);
  if (!WORKS.includes(manifest.work) || manifestPath !== executionManifestPath(manifest.work)) {
    fail('MANIFEST_CONTRACT_DRIFT', manifestPath);
  }
  validateManifestIdentity(manifest, authority.per_work_execution_manifest_policy, manifest.work);
  if (!same(manifest.parent_authority_binding,
    expectedAuthorityBinding(authority, authorityState.bytes))) {
    fail('AUTHORITY_BINDING_DRIFT', AUTHORITY_PATH);
  }
  const declaredPriorPath = manifest.work === 'WORK2'
    ? null
    : executionManifestPath(`WORK${workNumber(manifest.work) - 1}`);
  validateReadPaths(root, authority, manifestPath, manifest, declaredPriorPath);
  validateActivation(root, authority, manifest.activation_receipt_binding,
    manifest.activation_commit_binding);
  const {
    prior, priorPath, priorState, predecessorReceipt,
  } = validatePredecessor(root, authority, manifest);
  if (priorPath !== declaredPriorPath) fail('PREDECESSOR_BINDING_DRIFT', manifest.work);
  validateBaseTip(root, authority, manifest, priorState, predecessorReceipt);
  validateSuccessConditions(manifest.success_conditions);
  validateWritePaths(root, authority, manifestPath, manifest);
  validateCommands(authority, manifestPath, manifest);
  validateAllowedEffects(authority.allowed_effects, manifest.allowed_effects, manifest.work);
  if (!same(manifest.prohibited_effects, authority.prohibited_effects)) {
    fail('EFFECT_SCOPE_DRIFT', 'prohibited_effects');
  }
  validateStopConditions(authority.stop_conditions, manifest.stop_conditions);
  const candidateId = validateCandidate(root, authority, manifest, prior);
  const result = {
    schema_version: RESULT_SCHEMA,
    status: 'PASS_NARROWING_EXECUTION_MANIFEST',
    work: manifest.work,
    manifest_path: manifestPath,
    execution_manifest_id: manifest.execution_manifest_id,
    execution_manifest_digest: manifest.execution_manifest_digest,
    candidate_registration_id: candidateId,
    deferred_proofs: [DEFERRED_GIT_PROOF],
  };
  if (!exactKeys(result, RESULT_KEYS)) fail('MANIFEST_CONTRACT_DRIFT', 'result');
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const expectedInvokedPath = path.join(process.cwd(), ...VALIDATOR_PATH.split('/'));
if (invokedPath === expectedInvokedPath) {
  try {
    if (process.argv.length !== 3) fail('INVALID_OPTIONS', 'CLI arguments');
    const result = await validateExecutionManifest({
      repoRoot: process.cwd(),
      manifestPath: process.argv[2],
    });
    process.stdout.write(`${canonicalJson(result)}\n`);
  } catch (error) {
    const code = error instanceof WorkExecutionManifestValidationError
      ? error.code : 'MANIFEST_CONTRACT_DRIFT';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
