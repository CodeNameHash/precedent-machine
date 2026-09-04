import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  fsyncSync,
  existsSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const CANONICAL_ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const BASE_COMMIT = 'dbaa62d0bde0d36a755ef8032d49c4475a1c7248';
const BRANCH = 'codex/recover-m7-20260812';
const ORIGIN_REF = `refs/remotes/origin/${BRANCH}`;
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json';
const WORK0_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json';
const ACTIVATION_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json';
const ADOPTED_PLAN_PATH = 'docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md';
const PLAN_PATH = 'docs/core/PLAN.md';
const OPERATING_PATH = 'docs/core/OPERATING-RULES.md';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-7-authority-validate.mjs';
const TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-work1-7-authority.test.js';
const AUTHORITY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1';
const RESULT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_VALIDATION/V1';
const PRODUCTION_AUTHORITY = Object.freeze({
  byte_length: 29_144,
  sha256: '7e858b96fc46a69d7533e8b5ac3cad4a6142c2f30fd71ecfbd8771709e0cdd3c',
  authority_digest: '25ac58d418638432586a5cb24c1cfb766ba1440b77d992afc434ed71d1055afc',
  authority_id: 'ba63c1e57e5eb486e666e31e193a1dc21cf24f7a3918eace0ae6a6949f9359f7',
});
const POST_DOCUMENTS = Object.freeze({
  [PLAN_PATH]: Object.freeze({
    permitted_region: 'CURRENT_M7_STATUS_AND_STAGE_TABLE_ONLY',
    pre_work_byte_length: 89_279,
    pre_work_sha256: 'd02b85aec4acc0dc8a041c91592c95c34816e2dbc3f2163e63eea68ebe9acbff',
    pre_work_git_blob_oid: '52a6606cdf2e4d060f05384c890bcb86a72b1906',
    byte_length: 89_724,
    sha256: '1d1ddbc3f7374252a8cbe50a45a26eae6b8ea0ac2fb6c13ad28d7d4b2fc7bfb8',
    git_blob_oid: 'ab25b6069b89ad9e449552242690b62aa129d40b',
  }),
  [OPERATING_PATH]: Object.freeze({
    permitted_region: 'CURRENT_NARROWER_RULE_2026_08_14_ONLY',
    pre_work_byte_length: 53_877,
    pre_work_sha256: 'de15fec1cecb96479fe8f71da05260a51f92eeab684c2ead63453af7cfd4e3e6',
    pre_work_git_blob_oid: '6746919a5da2fb3bb6a02cab9af5d7df46a52fb1',
    byte_length: 54_288,
    sha256: 'e98d4f079f75689e7821dfd8fd7c87bb5989f9065a99427bdef714d9f4b6dd09',
    git_blob_oid: 'afa9cad46005c85c734ee3a3fe5803b9c8b31624',
  }),
});
const CHECK_IDS = Object.freeze([
  'EXACT_AUTHORITY_BYTES_ID_DIGEST_SHA_AND_GIT_BLOB',
  'EXACT_WORK0_EVIDENCE_ROOT',
  'ADOPTED_PLAN_AND_BASE_COMMIT',
  'VALIDATOR_AND_TEST_BYTES_SHA_AND_GIT_BLOBS',
  'PLAN_AND_OPERATING_RULES_PRE_AND_POST_BINDINGS',
  'EXACT_ACTIVATION_PATH_SET',
  'ZERO_EXTERNAL_AND_PRODUCT_EFFECTS',
  'ALL_ACTIVATION_CHECKS_PASS',
]);
const RECEIPT_EFFECTS = Object.freeze({
  activation_receipt_writes: 1,
  semantic_runs: 0,
  database_writes: 0,
  deployment_actions: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
  model_calls: 0,
  network_writes_other_than_exact_git_push: 0,
  phase_b_actions: 0,
  production_data_writes: 0,
  publication_changes: 0,
  selector_changes: 0,
  serving_changes: 0,
  unbound_network_reads: 0,
  v1_semantic_consumption: 0,
});
const NEXT_STATE = Object.freeze({
  authority_state: 'PENDING_EXACT_ACTIVATION_COMMIT_PERSISTENT_PASS_AND_PUSH',
  work1_authorised: false,
  required_sequence: Object.freeze([
    'STAGED_VALIDATOR_PASS',
    'EXACT_ACTIVATION_SET_COMMITTED',
    'COMMITTED_VALIDATOR_PASS',
    'EXACT_BRANCH_PUSH_SUCCEEDS',
    'PERSISTENT_VALIDATOR_PASS',
  ]),
  work2_work7_require_preexisting_execution_manifest: true,
});
const MODES = new Set(['READY_TO_STAGE', 'STAGED', 'COMMITTED', 'PERSISTENT']);
const RECEIPT_KEYS = Object.freeze([
  'activation_receipt_digest', 'activation_receipt_id', 'adopted_plan_binding',
  'authority_binding', 'base_commit', 'checks', 'core_document_bindings', 'effects',
  'exact_activation_paths', 'next_state', 'schema_version', 'snapshot_bindings',
  'stage', 'state', 'test_binding', 'validator_binding', 'work',
  'work0_evidence_root_binding',
]);
const BINDING_KEYS = Object.freeze([
  'byte_length', 'git_blob_oid', 'path', 'record_id', 'record_id_field',
  'schema_version', 'sha256',
]);
const AUTHORITY_BINDING_KEYS = Object.freeze([
  ...BINDING_KEYS, 'record_digest', 'record_digest_field',
]);
const ADOPTED_PLAN_BINDING_KEYS = Object.freeze([...BINDING_KEYS, 'source_commit']);
const CORE_DOCUMENT_BINDING_KEYS = Object.freeze([
  'path', 'permitted_region', 'pre_work_byte_length', 'pre_work_git_blob_oid',
  'pre_work_sha256', 'post_work_byte_length', 'post_work_git_blob_oid',
  'post_work_sha256',
]);

export class Work17AuthorityValidationError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work17AuthorityValidationError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new Work17AuthorityValidationError(code, detail);
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

function gitEnvironment() {
  const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return env;
}

function git(root, args, encoding = 'utf8') {
  try {
    return execFileSync('git', args, {
      cwd: root,
      env: gitEnvironment(),
      encoding,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    fail('ACTIVATION_COMMIT_DRIFT', `${args.join(' ')}: ${error.status ?? 'failed'}`);
  }
}

function normaliseRoot(repoRoot) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) fail('INVALID_OPTIONS', 'repoRoot');
  let root;
  try {
    root = realpathSync(repoRoot);
  } catch {
    fail('PATH_SAFETY', 'repository root');
  }
  if (path.resolve(repoRoot) !== root) fail('PATH_SAFETY', 'symlinked repository root');
  if (git(root, ['rev-parse', '--show-toplevel']).trim() !== root) fail('PATH_SAFETY', 'repository root mismatch');
  return root;
}

function absolutePath(root, repositoryPath, allowMissingLeaf = false) {
  if (typeof repositoryPath !== 'string' || repositoryPath.length === 0 || path.isAbsolute(repositoryPath)) {
    fail('PATH_SAFETY', repositoryPath);
  }
  const parts = repositoryPath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) fail('PATH_SAFETY', repositoryPath);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) fail('PATH_SAFETY', repositoryPath);
      if (index < parts.length - 1 && !stat.isDirectory()) fail('PATH_SAFETY', repositoryPath);
      if (index === parts.length - 1 && !stat.isFile()) fail('PATH_SAFETY', repositoryPath);
    } catch (error) {
      if (error instanceof Work17AuthorityValidationError) throw error;
      if (allowMissingLeaf && index === parts.length - 1 && error.code === 'ENOENT') return current;
      fail('PATH_SAFETY', repositoryPath);
    }
  }
  return current;
}

function inspectOptionalPathNoSymlinks(base, relativeParts) {
  let current = base;
  for (let index = 0; index < relativeParts.length; index += 1) {
    current = path.join(current, relativeParts[index]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') return { exists: false, path: current };
      fail('ACTIVATION_COMMIT_DRIFT', current);
    }
    if (stat.isSymbolicLink()) fail('ACTIVATION_COMMIT_DRIFT', current);
    if (index < relativeParts.length - 1 && !stat.isDirectory()) {
      fail('ACTIVATION_COMMIT_DRIFT', current);
    }
    if (index === relativeParts.length - 1) return { exists: true, path: current, stat };
  }
  return { exists: true, path: current, stat: lstatSync(current) };
}

function readCurrent(root, repositoryPath) {
  return readFileSync(absolutePath(root, repositoryPath));
}

function readCommit(root, commit, repositoryPath, code) {
  try {
    return execFileSync('git', ['show', `${commit}:${repositoryPath}`], {
      cwd: root,
      env: gitEnvironment(),
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    fail(code, `${commit}:${repositoryPath}`);
  }
}

function parseCanonical(bytes, code, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code, label);
  }
  if (!bytes.equals(canonicalBytes(value))) fail(code, `${label}: noncanonical`);
  return value;
}

function standardBinding(repositoryPath, bytes, metadata = {}) {
  const binding = {
    path: repositoryPath,
    schema_version: metadata.schema_version ?? null,
    record_id_field: metadata.record_id_field ?? null,
    record_id: metadata.record_id ?? null,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
  if (metadata.record_digest_field) {
    binding.record_digest_field = metadata.record_digest_field;
    binding.record_digest = metadata.record_digest;
  }
  if (metadata.source_commit) binding.source_commit = metadata.source_commit;
  return binding;
}

function restampedIdentity(record, digestField, idField) {
  const unsigned = JSON.parse(JSON.stringify(record));
  delete unsigned[digestField];
  delete unsigned[idField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return { digest, id: contentId(record.schema_version, withDigest) };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateFixtureAuthority(authority) {
  const production = parseCanonical(
    readFileSync(path.join(CANONICAL_ROOT, AUTHORITY_PATH)),
    'AUTHORITY_BYTES_DRIFT',
    AUTHORITY_PATH,
  );
  const comparable = clone(authority);
  comparable.base_commit = production.base_commit;
  comparable.activation_policy.activation_commit_parent = production.activation_policy.activation_commit_parent;
  comparable.permitted_reads.git_object_policy.base_commit = production.permitted_reads.git_object_policy.base_commit;
  comparable.adopted_plan_binding.commit = production.adopted_plan_binding.commit;
  delete comparable.authority_digest;
  delete comparable.authority_id;
  const expected = clone(production);
  delete expected.authority_digest;
  delete expected.authority_id;
  if (!same(comparable, expected)) fail('AUTHORITY_CONTRACT_DRIFT', 'fixture relaxation');
}

function validateAuthority(root, production) {
  const bytes = readCurrent(root, AUTHORITY_PATH);
  const authority = parseCanonical(bytes, 'AUTHORITY_BYTES_DRIFT', AUTHORITY_PATH);
  const identity = restampedIdentity(authority, 'authority_digest', 'authority_id');
  if (authority.authority_digest !== identity.digest || authority.authority_id !== identity.id) {
    fail('AUTHORITY_IDENTITY_DRIFT', AUTHORITY_PATH);
  }
  if (production && (bytes.length !== PRODUCTION_AUTHORITY.byte_length
    || sha256Hex(bytes) !== PRODUCTION_AUTHORITY.sha256
    || authority.authority_digest !== PRODUCTION_AUTHORITY.authority_digest
    || authority.authority_id !== PRODUCTION_AUTHORITY.authority_id)) {
    fail('AUTHORITY_BYTES_DRIFT', AUTHORITY_PATH);
  }
  if (!production) validateFixtureAuthority(authority);
  if (authority.schema_version !== AUTHORITY_SCHEMA
    || authority.authority_state !== 'CONDITIONALLY_EFFECTIVE_AFTER_ACTIVATION_RECEIPT_PASS_COMMIT_AND_PUSH'
    || authority.activation_policy.work1_before_activation !== 'FORBIDDEN'
    || !same(authority.activation_policy.allowed_modes, [...MODES])
    || authority.authorisation?.verbatim_instruction !== "approved. I don't really know what these sealed approvals are - I have no idea. Just proceed"
    || authority.authorisation?.approver !== 'BEN_GOODCHILD'
    || authority.authorisation?.exact_byte_reconfirmation_required !== false
    || !authority.immutable_paths?.includes(AUTHORITY_PATH)
    || !authority.immutable_paths?.includes(VALIDATOR_PATH)
    || !authority.immutable_paths?.includes(TEST_PATH)
    || authority.permitted_writes?.exact_paths?.includes(AUTHORITY_PATH)
    || authority.next_stage_lock?.m8_authorised !== false
    || authority.prohibited_effects?.model_calls !== 0
    || authority.prohibited_effects?.database_writes !== 0
    || authority.prohibited_effects?.v1_semantic_consumption !== 0) {
    fail('AUTHORITY_CONTRACT_DRIFT', AUTHORITY_PATH);
  }
  return { authority, bytes };
}

function validateWork0(root, authority) {
  const bytes = readCurrent(root, WORK0_RECEIPT_PATH);
  const receipt = parseCanonical(bytes, 'WORK0_BINDING_DRIFT', WORK0_RECEIPT_PATH);
  const binding = authority.work0_evidence_root_binding;
  if (!same(binding, {
    path: WORK0_RECEIPT_PATH,
    schema_version: receipt.schema_version,
    evidence_root_id: receipt.evidence_root_id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  })) fail('WORK0_BINDING_DRIFT', WORK0_RECEIPT_PATH);
  return { receipt, bytes };
}

function validatePlan(root, authority) {
  const binding = authority.adopted_plan_binding;
  const bytes = readCurrent(root, ADOPTED_PLAN_PATH);
  const committed = readCommit(root, binding.commit, ADOPTED_PLAN_PATH, 'ADOPTED_PLAN_DRIFT');
  if (!bytes.equals(committed) || binding.path !== ADOPTED_PLAN_PATH
    || binding.byte_length !== bytes.length || binding.sha256 !== sha256Hex(bytes)) {
    fail('ADOPTED_PLAN_DRIFT', ADOPTED_PLAN_PATH);
  }
  return bytes;
}

function validateDocuments(root, authority) {
  return [PLAN_PATH, OPERATING_PATH].map((repositoryPath) => {
    const expected = POST_DOCUMENTS[repositoryPath];
    const policy = authority.core_document_policy?.[repositoryPath];
    const before = readCommit(root, authority.base_commit, repositoryPath, 'CORE_DOC_REGION_DRIFT');
    const after = readCurrent(root, repositoryPath);
    if (!policy || policy.permitted_region !== expected.permitted_region
      || policy.pre_work_sha256 !== expected.pre_work_sha256
      || before.length !== expected.pre_work_byte_length
      || sha256Hex(before) !== expected.pre_work_sha256
      || gitBlobOid(before) !== expected.pre_work_git_blob_oid
      || after.length !== expected.byte_length
      || sha256Hex(after) !== expected.sha256
      || gitBlobOid(after) !== expected.git_blob_oid) {
      fail('CORE_DOC_REGION_DRIFT', repositoryPath);
    }
    return {
      path: repositoryPath,
      permitted_region: expected.permitted_region,
      pre_work_byte_length: before.length,
      pre_work_sha256: sha256Hex(before),
      pre_work_git_blob_oid: gitBlobOid(before),
      post_work_byte_length: after.length,
      post_work_sha256: sha256Hex(after),
      post_work_git_blob_oid: gitBlobOid(after),
    };
  });
}

function validateStaticDependencies(root) {
  const validatorSource = readCurrent(root, VALIDATOR_PATH).toString('utf8');
  const testSource = readCurrent(root, TEST_PATH).toString('utf8');
  const validatorImports = [...validatorSource.matchAll(/^import[\s\S]*?from '([^']+)';$/gm)]
    .map((match) => match[1]).sort();
  const expectedValidatorImports = [
    'node:child_process', 'node:crypto', 'node:fs', 'node:path', 'node:url',
    '../lib/canonical-v2/canonical-bytes.js',
  ].sort();
  const testRequires = [...testSource.matchAll(/require\('([^']+)'\)/g)].map((match) => match[1]).sort();
  const expectedTestRequires = [
    'node:assert/strict', 'node:child_process', 'node:crypto', 'node:fs', 'node:os',
    'node:path', 'node:test', '../lib/canonical-v2/canonical-bytes.js',
  ].sort();
  const dynamicImports = [...testSource.matchAll(/import\(([^)]+)\)/g)].map((match) => match[1]);
  if (!same(validatorImports, expectedValidatorImports)
    || !same(testRequires, expectedTestRequires)
    || dynamicImports.length !== 1
    || dynamicImports[0] !== "'../scripts/stage-2y-structure-m7-v2-repair-work1-7-authority-validate.mjs'") {
    fail('FORBIDDEN_EFFECT', 'static dependency boundary');
  }
}

function buildReceipt(root, authorityState) {
  const { authority, bytes: authorityBytes } = authorityState;
  const work0 = validateWork0(root, authority);
  const adoptedPlanBytes = validatePlan(root, authority);
  const coreDocumentBindings = validateDocuments(root, authority);
  const activationPaths = authority.activation_policy.exact_activation_paths;
  const expectedPaths = [AUTHORITY_PATH, PLAN_PATH, OPERATING_PATH, VALIDATOR_PATH, TEST_PATH, ACTIVATION_RECEIPT_PATH];
  if (!same(activationPaths, expectedPaths)) fail('AUTHORITY_CONTRACT_DRIFT', 'activation paths');
  const snapshotBindings = activationPaths.slice(0, 5).map((repositoryPath) => {
    const bytes = readCurrent(root, repositoryPath);
    return standardBinding(repositoryPath, bytes, repositoryPath === AUTHORITY_PATH ? {
      schema_version: AUTHORITY_SCHEMA,
      record_id_field: 'authority_id',
      record_id: authority.authority_id,
      record_digest_field: 'authority_digest',
      record_digest: authority.authority_digest,
    } : {});
  });
  const byPath = new Map(snapshotBindings.map((binding) => [binding.path, binding]));
  const unsigned = {
    schema_version: RECEIPT_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION',
    work: 'WORK1_7_AUTHORITY_ACTIVATION',
    state: 'PASS_AUTHORITY_ACTIVATION',
    base_commit: authority.base_commit,
    authority_binding: byPath.get(AUTHORITY_PATH),
    work0_evidence_root_binding: standardBinding(WORK0_RECEIPT_PATH, work0.bytes, {
      schema_version: work0.receipt.schema_version,
      record_id_field: 'evidence_root_id',
      record_id: work0.receipt.evidence_root_id,
    }),
    adopted_plan_binding: standardBinding(ADOPTED_PLAN_PATH, adoptedPlanBytes, {
      source_commit: authority.adopted_plan_binding.commit,
    }),
    validator_binding: byPath.get(VALIDATOR_PATH),
    test_binding: byPath.get(TEST_PATH),
    core_document_bindings: coreDocumentBindings,
    exact_activation_paths: activationPaths,
    snapshot_bindings: snapshotBindings,
    checks: CHECK_IDS.map((check_id) => ({ check_id, status: 'PASS' })),
    effects: RECEIPT_EFFECTS,
    next_state: NEXT_STATE,
  };
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, activation_receipt_digest: digest };
  return { ...withDigest, activation_receipt_id: contentId(RECEIPT_SCHEMA, withDigest) };
}

function receiptBinding(receipt) {
  const bytes = canonicalBytes(receipt);
  return standardBinding(ACTIVATION_RECEIPT_PATH, bytes, {
    schema_version: RECEIPT_SCHEMA,
    record_id_field: 'activation_receipt_id',
    record_id: receipt.activation_receipt_id,
  });
}

function readAndValidateReceipt(root, expected) {
  let bytes;
  try {
    bytes = readCurrent(root, ACTIVATION_RECEIPT_PATH);
  } catch (error) {
    if (error instanceof Work17AuthorityValidationError && error.code === 'PATH_SAFETY') {
      const candidate = path.join(root, ACTIVATION_RECEIPT_PATH);
      try {
        lstatSync(candidate);
      } catch (inner) {
        if (inner.code === 'ENOENT') fail('RECEIPT_MISSING', ACTIVATION_RECEIPT_PATH);
      }
    }
    throw error;
  }
  const receipt = parseCanonical(bytes, 'RECEIPT_IDENTITY_DRIFT', ACTIVATION_RECEIPT_PATH);
  const identity = restampedIdentity(receipt, 'activation_receipt_digest', 'activation_receipt_id');
  if (receipt.activation_receipt_digest !== identity.digest || receipt.activation_receipt_id !== identity.id
    || !bytes.equals(canonicalBytes(expected))) {
    fail('RECEIPT_IDENTITY_DRIFT', ACTIVATION_RECEIPT_PATH);
  }
  return bytes;
}

function readReceiptIdentity(root) {
  let bytes;
  try {
    bytes = readCurrent(root, ACTIVATION_RECEIPT_PATH);
  } catch (error) {
    if (error instanceof Work17AuthorityValidationError && error.code === 'PATH_SAFETY') {
      try {
        lstatSync(path.join(root, ACTIVATION_RECEIPT_PATH));
      } catch (inner) {
        if (inner.code === 'ENOENT') fail('RECEIPT_MISSING', ACTIVATION_RECEIPT_PATH);
      }
    }
    throw error;
  }
  const receipt = parseCanonical(bytes, 'RECEIPT_IDENTITY_DRIFT', ACTIVATION_RECEIPT_PATH);
  const identity = restampedIdentity(receipt, 'activation_receipt_digest', 'activation_receipt_id');
  if (receipt.activation_receipt_digest !== identity.digest || receipt.activation_receipt_id !== identity.id) {
    fail('RECEIPT_IDENTITY_DRIFT', ACTIVATION_RECEIPT_PATH);
  }
  return { receipt, bytes };
}

function validatePersistentReceiptContract(root, receipt, authorityState) {
  const { authority, bytes: authorityBytes } = authorityState;
  const work0 = validateWork0(root, authority);
  const adoptedPlanBytes = validatePlan(root, authority);
  const expectedAuthority = standardBinding(AUTHORITY_PATH, authorityBytes, {
    schema_version: AUTHORITY_SCHEMA,
    record_id_field: 'authority_id',
    record_id: authority.authority_id,
    record_digest_field: 'authority_digest',
    record_digest: authority.authority_digest,
  });
  const expectedWork0 = standardBinding(WORK0_RECEIPT_PATH, work0.bytes, {
    schema_version: work0.receipt.schema_version,
    record_id_field: 'evidence_root_id',
    record_id: work0.receipt.evidence_root_id,
  });
  const expectedPlan = standardBinding(ADOPTED_PLAN_PATH, adoptedPlanBytes, {
    source_commit: authority.adopted_plan_binding.commit,
  });
  const expectedDocuments = Object.entries(POST_DOCUMENTS).map(([repositoryPath, expected]) => ({
    path: repositoryPath,
    permitted_region: expected.permitted_region,
    pre_work_byte_length: expected.pre_work_byte_length,
    pre_work_sha256: expected.pre_work_sha256,
    pre_work_git_blob_oid: expected.pre_work_git_blob_oid,
    post_work_byte_length: expected.byte_length,
    post_work_sha256: expected.sha256,
    post_work_git_blob_oid: expected.git_blob_oid,
  }));
  if (!exactKeys(receipt, RECEIPT_KEYS)
    || !Array.isArray(receipt.snapshot_bindings)
    || receipt.snapshot_bindings.length !== 5
    || receipt.snapshot_bindings.some((binding) => binding.path === AUTHORITY_PATH
      ? !exactKeys(binding, AUTHORITY_BINDING_KEYS) : !exactKeys(binding, BINDING_KEYS))
    || !exactKeys(receipt.authority_binding, AUTHORITY_BINDING_KEYS)
    || !exactKeys(receipt.work0_evidence_root_binding, BINDING_KEYS)
    || !exactKeys(receipt.adopted_plan_binding, ADOPTED_PLAN_BINDING_KEYS)
    || !exactKeys(receipt.validator_binding, BINDING_KEYS)
    || !exactKeys(receipt.test_binding, BINDING_KEYS)
    || !Array.isArray(receipt.core_document_bindings)
    || receipt.core_document_bindings.some((binding) => !exactKeys(binding, CORE_DOCUMENT_BINDING_KEYS))
    || receipt.schema_version !== RECEIPT_SCHEMA
    || receipt.stage !== 'M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION'
    || receipt.work !== 'WORK1_7_AUTHORITY_ACTIVATION'
    || receipt.state !== 'PASS_AUTHORITY_ACTIVATION'
    || receipt.base_commit !== authority.base_commit
    || !same(receipt.authority_binding, expectedAuthority)
    || !same(receipt.work0_evidence_root_binding, expectedWork0)
    || !same(receipt.adopted_plan_binding, expectedPlan)
    || !same(receipt.core_document_bindings, expectedDocuments)
    || !same(receipt.exact_activation_paths, authority.activation_policy.exact_activation_paths)
    || !same(receipt.checks, CHECK_IDS.map((check_id) => ({ check_id, status: 'PASS' })))
    || !same(receipt.effects, RECEIPT_EFFECTS)
    || !same(receipt.next_state, NEXT_STATE)) {
    fail('RECEIPT_IDENTITY_DRIFT', ACTIVATION_RECEIPT_PATH);
  }
  const snapshotByPath = new Map(receipt.snapshot_bindings.map((binding) => [binding.path, binding]));
  const expectedDocumentSnapshots = new Map(Object.entries(POST_DOCUMENTS).map(
    ([repositoryPath, expected]) => [repositoryPath, {
      path: repositoryPath,
      schema_version: null,
      record_id_field: null,
      record_id: null,
      byte_length: expected.byte_length,
      sha256: expected.sha256,
      git_blob_oid: expected.git_blob_oid,
    }],
  ));
  if (snapshotByPath.size !== 5
    || !same(receipt.snapshot_bindings.map((binding) => binding.path),
      authority.activation_policy.exact_activation_paths.slice(0, 5))
    || !same(receipt.authority_binding, snapshotByPath.get(AUTHORITY_PATH))
    || !same(snapshotByPath.get(PLAN_PATH), expectedDocumentSnapshots.get(PLAN_PATH))
    || !same(snapshotByPath.get(OPERATING_PATH), expectedDocumentSnapshots.get(OPERATING_PATH))
    || !same(receipt.validator_binding, snapshotByPath.get(VALIDATOR_PATH))
    || !same(receipt.test_binding, snapshotByPath.get(TEST_PATH))) {
    fail('RECEIPT_IDENTITY_DRIFT', 'snapshot cross-links');
  }
}

function repositoryStatus(root) {
  const lines = git(root, ['status', '--short', '--branch']).split('\n').filter(Boolean);
  if (lines.length === 0 || !lines[0].startsWith('## ')) fail('ACTIVATION_DELTA_DRIFT', 'status header');
  const branch = lines[0].slice(3).split('...')[0].trim();
  const entries = lines.slice(1).map((line) => ({
    index: line[0],
    worktree: line[1],
    path: line.slice(3),
  }));
  return { branch, entries };
}

function exactSet(actual, expected) {
  return same([...actual].sort(), [...expected].sort());
}

function validateReadyDelta(root, activationPaths, receiptExists) {
  const status = repositoryStatus(root);
  if (status.branch !== BRANCH) fail('ACTIVATION_DELTA_DRIFT', 'branch');
  if (status.entries.some((entry) => entry.index !== ' ' && entry.index !== '?')) {
    fail('ACTIVATION_DELTA_DRIFT', 'staged index not empty');
  }
  const expected = receiptExists ? activationPaths : activationPaths.slice(0, 5);
  if (!exactSet(status.entries.map((entry) => entry.path), expected)) {
    fail('ACTIVATION_DELTA_DRIFT', 'dirty path set');
  }
}

function indexBlob(root, repositoryPath) {
  const line = git(root, ['ls-files', '-s', '--', repositoryPath]).trim();
  const match = /^100644 ([0-9a-f]{40}) 0\t/.exec(line);
  if (!match) fail('STAGED_BLOB_DRIFT', repositoryPath);
  return match[1];
}

function validateStaged(root, receipt, binding) {
  const paths = receipt.exact_activation_paths;
  const status = repositoryStatus(root);
  if (status.branch !== BRANCH) fail('STAGED_SET_DRIFT', 'branch');
  const staged = status.entries.filter((entry) => entry.index !== ' ' && entry.index !== '?');
  if (!exactSet(staged.map((entry) => entry.path), paths)) fail('STAGED_SET_DRIFT', 'staged path set');
  if (status.entries.some((entry) => entry.worktree !== ' ' || entry.index === '?')
    || !exactSet(status.entries.map((entry) => entry.path), paths)) {
    fail('ACTIVATION_DELTA_DRIFT', 'unstaged or untracked path');
  }
  const expectedBindings = new Map(receipt.snapshot_bindings.map((item) => [item.path, item]));
  expectedBindings.set(ACTIVATION_RECEIPT_PATH, binding);
  for (const repositoryPath of paths) {
    if (indexBlob(root, repositoryPath) !== expectedBindings.get(repositoryPath).git_blob_oid) {
      fail('STAGED_BLOB_DRIFT', repositoryPath);
    }
  }
}

function commitParents(root, commit) {
  const fields = git(root, ['rev-list', '--parents', '-n', '1', commit]).trim().split(/\s+/);
  return fields.slice(1);
}

function commitMessage(root, commit) {
  return git(root, ['log', '--format=%s', '-n', '1', commit]).trim();
}

function commitChangedPaths(root, commit) {
  return git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', commit])
    .split('\n').filter(Boolean).sort();
}

function commitBlob(root, commit, repositoryPath, missingCode = 'ACTIVATION_COMMIT_DRIFT') {
  return readCommit(root, commit, repositoryPath, missingCode);
}

function commitEntry(root, commit, repositoryPath) {
  const line = git(root, ['ls-tree', '-r', '--full-tree', commit, '--', repositoryPath]).trim();
  const match = /^100644 blob ([0-9a-f]{40})\t(.+)$/.exec(line);
  if (!match || match[2] !== repositoryPath) fail('ACTIVATION_COMMIT_DRIFT', repositoryPath);
  return { git_blob_oid: match[1] };
}

function findActivationCommit(root, base, head, expectedPaths, production) {
  const reversed = [];
  let cursor = head;
  for (let depth = 0; depth < 12 && cursor !== base; depth += 1) {
    const parents = commitParents(root, cursor);
    if (parents.length !== 1) fail('ACTIVATION_COMMIT_DRIFT', 'merge or missing parent');
    reversed.push(cursor);
    cursor = parents[0];
  }
  if (cursor !== base) fail('ACTIVATION_COMMIT_DRIFT', 'base ancestry');
  const commits = reversed.reverse();
  for (const commit of commits) {
    if (!same(commitParents(root, commit), [base])) continue;
    if (!exactSet(commitChangedPaths(root, commit), expectedPaths)) continue;
    if (production && commitMessage(root, commit) !== 'Authorise M7 V2 repair Work 1-7') continue;
    if (!production && commitMessage(root, commit) !== 'fixture') continue;
    return commit;
  }
  fail('ACTIVATION_COMMIT_DRIFT', 'activation commit not found');
}

function validateActivationTree(root, commit, receipt, receiptBytes) {
  const expected = new Map(receipt.snapshot_bindings.map((binding) => [binding.path, binding]));
  expected.set(ACTIVATION_RECEIPT_PATH, receiptBinding(receipt));
  for (const repositoryPath of receipt.exact_activation_paths) {
    const entry = commitEntry(root, commit, repositoryPath);
    const bytes = commitBlob(root, commit, repositoryPath,
      repositoryPath === ACTIVATION_RECEIPT_PATH ? 'RECEIPT_MISSING' : 'ACTIVATION_COMMIT_DRIFT');
    const binding = expected.get(repositoryPath);
    if (bytes.length !== binding.byte_length || sha256Hex(bytes) !== binding.sha256
      || gitBlobOid(bytes) !== binding.git_blob_oid
      || entry.git_blob_oid !== binding.git_blob_oid) fail('ACTIVATION_COMMIT_DRIFT', repositoryPath);
  }
  if (!commitBlob(root, commit, ACTIVATION_RECEIPT_PATH, 'RECEIPT_MISSING').equals(receiptBytes)) {
    fail('RECEIPT_IDENTITY_DRIFT', ACTIVATION_RECEIPT_PATH);
  }
}

function writeReceiptExclusive(root, receipt) {
  const destination = absolutePath(root, ACTIVATION_RECEIPT_PATH, true);
  try {
    lstatSync(destination);
    fail('RECEIPT_ALREADY_EXISTS', ACTIVATION_RECEIPT_PATH);
  } catch (error) {
    if (error instanceof Work17AuthorityValidationError) throw error;
    if (error.code !== 'ENOENT') fail('PATH_SAFETY', ACTIVATION_RECEIPT_PATH);
  }
  const bytes = canonicalBytes(receipt);
  const parent = path.dirname(destination);
  let descriptor;
  let created = false;
  try {
    descriptor = openSync(destination,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
      0o600);
    created = true;
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset);
      if (written <= 0) fail('FORBIDDEN_EFFECT', 'zero-byte receipt write');
      offset += written;
    }
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    const parentDescriptor = openSync(parent, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY);
    fsyncSync(parentDescriptor);
    closeSync(parentDescriptor);
    const rebuilt = readReceiptIdentity(root);
    const rebuiltAuthority = validateAuthority(root, root === CANONICAL_ROOT);
    const rebuiltExpected = buildReceipt(root, rebuiltAuthority);
    if (!rebuilt.bytes.equals(bytes) || !same(rebuilt.receipt, rebuiltExpected)) {
      fail('RECEIPT_IDENTITY_DRIFT', ACTIVATION_RECEIPT_PATH);
    }
    validateReadyDelta(root, receipt.exact_activation_paths, true);
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch {}
    }
    if (created) {
      try {
        unlinkSync(destination);
        const parentDescriptor = openSync(parent, fsConstants.O_RDONLY | fsConstants.O_DIRECTORY);
        fsyncSync(parentDescriptor);
        closeSync(parentDescriptor);
      } catch {}
    }
    if (error instanceof Work17AuthorityValidationError) throw error;
    if (error.code === 'EEXIST') fail('RECEIPT_ALREADY_EXISTS', ACTIVATION_RECEIPT_PATH);
    fail('PATH_SAFETY', ACTIVATION_RECEIPT_PATH);
  }
}

function validateRepositoryHistoryState(root) {
  const commonValue = git(root, ['rev-parse', '--git-common-dir']).trim();
  const unresolvedCommon = path.isAbsolute(commonValue) ? commonValue : path.resolve(root, commonValue);
  let common;
  try {
    common = realpathSync(unresolvedCommon);
  } catch {
    fail('ACTIVATION_COMMIT_DRIFT', 'git common directory');
  }
  if (common !== path.resolve(unresolvedCommon) || !lstatSync(common).isDirectory()) {
    fail('ACTIVATION_COMMIT_DRIFT', 'git common directory');
  }
  for (const relativeParts of [['shallow'], ['info', 'grafts']]) {
    const candidate = inspectOptionalPathNoSymlinks(common, relativeParts);
    if (candidate.exists) {
      if (!candidate.stat.isFile() || readFileSync(candidate.path).length > 0) {
        fail('ACTIVATION_COMMIT_DRIFT', candidate.path);
      }
    }
  }
  const packedRefs = inspectOptionalPathNoSymlinks(common, ['packed-refs']);
  if (packedRefs.exists) {
    if (!packedRefs.stat.isFile()) fail('ACTIVATION_COMMIT_DRIFT', packedRefs.path);
    const lines = readFileSync(packedRefs.path, 'utf8').split('\n');
    if (lines.some((line) => line.includes(' refs/replace/'))) {
      fail('ACTIVATION_COMMIT_DRIFT', packedRefs.path);
    }
  }
  const replaceRoot = inspectOptionalPathNoSymlinks(common, ['refs', 'replace']);
  if (replaceRoot.exists) {
    if (!replaceRoot.stat.isDirectory() || readdirSync(replaceRoot.path).length > 0) {
      fail('ACTIVATION_COMMIT_DRIFT', replaceRoot.path);
    }
  }
}

function resultFor(root, mode, receipt, authorityBinding, writes) {
  return {
    schema_version: RESULT_SCHEMA,
    status: `PASS_${mode}`,
    mode,
    repository: {
      root,
      head: git(root, ['rev-parse', 'HEAD']).trim(),
      branch: BRANCH,
    },
    authority_binding: authorityBinding,
    activation_receipt: receipt,
    activation_receipt_binding: receiptBinding(receipt),
    checks: receipt.checks,
    effects: { ...RECEIPT_EFFECTS, activation_receipt_writes: writes },
  };
}

export async function validateWork17AuthorityActivation(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('INVALID_OPTIONS', 'options');
  const keys = Object.keys(options).sort();
  if (!same(keys, ['mode', 'repoRoot', 'writeReceipt'].filter((key) => key !== 'writeReceipt' || key in options).sort())) {
    fail('INVALID_OPTIONS', 'option keys');
  }
  const { repoRoot, mode, writeReceipt = false } = options;
  if (!MODES.has(mode)) fail('INVALID_MODE', mode);
  if (typeof writeReceipt !== 'boolean' || (writeReceipt && mode !== 'READY_TO_STAGE')) {
    fail('INVALID_OPTIONS', 'writeReceipt');
  }
  const root = normaliseRoot(repoRoot);
  validateRepositoryHistoryState(root);
  const production = root === CANONICAL_ROOT;
  const authorityState = validateAuthority(root, production);
  const { authority } = authorityState;
  if (git(root, ['cat-file', '-t', authority.base_commit]).trim() !== 'commit') {
    fail('AUTHORITY_CONTRACT_DRIFT', 'base commit');
  }
  const receiptAbsolute = path.join(root, ACTIVATION_RECEIPT_PATH);
  let receiptExists = false;
  try {
    const stat = lstatSync(receiptAbsolute);
    if (stat.isSymbolicLink() || !stat.isFile()) fail('PATH_SAFETY', ACTIVATION_RECEIPT_PATH);
    receiptExists = true;
  } catch (error) {
    if (error instanceof Work17AuthorityValidationError) throw error;
    if (error.code !== 'ENOENT') fail('PATH_SAFETY', ACTIVATION_RECEIPT_PATH);
  }

  if (mode === 'PERSISTENT') {
    if (!receiptExists) fail('RECEIPT_MISSING', ACTIVATION_RECEIPT_PATH);
    const status = repositoryStatus(root);
    if (status.branch !== BRANCH || status.entries.length !== 0) {
      fail('ACTIVATION_DELTA_DRIFT', 'persistent repository state');
    }
    const persistentReceipt = readReceiptIdentity(root);
    validatePersistentReceiptContract(root, persistentReceipt.receipt, authorityState);
    const head = git(root, ['rev-parse', 'HEAD']).trim();
    const activationCommit = findActivationCommit(
      root,
      authority.base_commit,
      head,
      persistentReceipt.receipt.exact_activation_paths,
      production,
    );
    if (head !== activationCommit) fail('ACTIVATION_COMMIT_DRIFT', 'unbound descendant');
    validateActivationTree(root, activationCommit, persistentReceipt.receipt, persistentReceipt.bytes);
    let origin;
    try {
      origin = git(root, ['rev-parse', ORIGIN_REF]).trim();
    } catch {
      fail('PUSH_STATE_DRIFT', ORIGIN_REF);
    }
    if (origin !== head) fail('PUSH_STATE_DRIFT', ORIGIN_REF);
    const currentAuthority = commitBlob(root, head, AUTHORITY_PATH);
    const activationAuthority = commitBlob(root, activationCommit, AUTHORITY_PATH);
    if (!currentAuthority.equals(activationAuthority)) fail('AUTHORITY_BYTES_DRIFT', AUTHORITY_PATH);
    for (const repositoryPath of [VALIDATOR_PATH, TEST_PATH]) {
      const current = commitBlob(root, head, repositoryPath);
      const activation = commitBlob(root, activationCommit, repositoryPath);
      if (!current.equals(activation)) fail('ACTIVATION_COMMIT_DRIFT', repositoryPath);
    }
    const currentReceipt = commitBlob(root, head, ACTIVATION_RECEIPT_PATH, 'RECEIPT_MISSING');
    if (!currentReceipt.equals(persistentReceipt.bytes)) {
      fail('RECEIPT_IDENTITY_DRIFT', ACTIVATION_RECEIPT_PATH);
    }
    return resultFor(root, mode, persistentReceipt.receipt,
      persistentReceipt.receipt.authority_binding, 0);
  }

  if (mode === 'READY_TO_STAGE') {
    const receipt = buildReceipt(root, authorityState);
    if (git(root, ['rev-parse', 'HEAD']).trim() !== authority.base_commit) {
      fail('ACTIVATION_DELTA_DRIFT', 'HEAD is not base');
    }
    validateStaticDependencies(root);
    git(root, ['diff', '--check']);
    validateReadyDelta(root, authority.activation_policy.exact_activation_paths, receiptExists);
    if (receiptExists) readAndValidateReceipt(root, receipt);
    if (writeReceipt) {
      if (receiptExists) fail('RECEIPT_ALREADY_EXISTS', ACTIVATION_RECEIPT_PATH);
      writeReceiptExclusive(root, receipt);
    }
    return resultFor(root, mode, receipt, receipt.authority_binding, writeReceipt ? 1 : 0);
  }

  if (!receiptExists) fail('RECEIPT_MISSING', ACTIVATION_RECEIPT_PATH);
  const frozenReceipt = readReceiptIdentity(root);
  validatePersistentReceiptContract(root, frozenReceipt.receipt, authorityState);
  const receipt = frozenReceipt.receipt;
  const receiptBytes = frozenReceipt.bytes;
  const binding = receiptBinding(receipt);

  if (mode === 'STAGED') {
    if (git(root, ['rev-parse', 'HEAD']).trim() !== authority.base_commit) {
      fail('ACTIVATION_COMMIT_DRIFT', 'HEAD is not base');
    }
    validateStaged(root, receipt, binding);
    return resultFor(root, mode, receipt, receipt.authority_binding, 0);
  }

  const head = git(root, ['rev-parse', 'HEAD']).trim();
  const committedStatus = repositoryStatus(root);
  if (committedStatus.branch !== BRANCH || committedStatus.entries.length !== 0) {
    fail('ACTIVATION_DELTA_DRIFT', 'committed repository state');
  }
  const activationCommit = findActivationCommit(
    root,
    authority.base_commit,
    head,
    receipt.exact_activation_paths,
    production,
  );
  validateActivationTree(root, activationCommit, receipt, receiptBytes);
  if (mode === 'COMMITTED' && head !== activationCommit) {
    fail('ACTIVATION_COMMIT_DRIFT', 'HEAD is not activation commit');
  }
  return resultFor(root, mode, receipt, receipt.authority_binding, 0);
}

function parseCli(argv) {
  if (argv.length !== 2 && argv.length !== 3) fail('INVALID_OPTIONS', 'CLI arguments');
  if (argv[0] !== '--mode') fail('INVALID_OPTIONS', 'CLI mode');
  const mode = argv[1];
  const writeReceipt = argv.length === 3;
  if (writeReceipt && argv[2] !== '--write-receipt') fail('INVALID_OPTIONS', 'CLI write flag');
  return { mode, writeReceipt };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { mode, writeReceipt } = parseCli(process.argv.slice(2));
    const result = await validateWork17AuthorityActivation({
      repoRoot: CANONICAL_ROOT,
      mode,
      writeReceipt,
    });
    process.stdout.write(`${canonicalJson(result)}\n`);
  } catch (error) {
    const code = error instanceof Work17AuthorityValidationError ? error.code : 'FORBIDDEN_EFFECT';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
