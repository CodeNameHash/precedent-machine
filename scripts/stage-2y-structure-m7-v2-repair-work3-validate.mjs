#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import contractModule from '../lib/canonical-v2/m7-v2-contract.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const {
  validateWork3PhysicalClosureV2,
  validateWork3ReceiptV2: validateWork3ReceiptV2Shared,
} = contractModule;

const REPO_ROOT = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const AMENDMENT_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-execution-manifest-closure-amendment.json`;
const EXTERNAL_REVIEW_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work3-execution-manifest-closure-amendment-external-review-receipt.json`;
const PROFILE_SET_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-family-work3-approved-profile-set.json`;
const AMENDMENT_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK3_EXECUTION_MANIFEST_CLOSURE_AMENDMENT/V1';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2';
const FROZEN_AMENDMENT_BINDING = Object.freeze({
  path: AMENDMENT_PATH,
  schema_version: AMENDMENT_SCHEMA,
  record_id_field: 'closure_amendment_id',
  record_id: '06b879b44497653b8a3a0e698448efb833efc83cbd8591d0e8ff879cc2071ab4',
  byte_length: 207090,
  sha256: 'e5a8610b596edb567f13624551715ba102f7daaa9ef19f438093a2564123fe47',
  git_blob_oid: '4013eb82d7234534e15e39cd85d9582fa3d2d9c0',
});
const FROZEN_EXTERNAL_REVIEW_BINDING = Object.freeze({
  path: EXTERNAL_REVIEW_PATH,
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_EXTERNAL_REVIEW_RECEIPT/V1',
  record_id_field: 'work3_closure_amendment_external_review_receipt_id',
  record_id: 'a2344bb49e37bcae328479835ffe7d2e5477430ff89b4abf8c1af972594a3a14',
  byte_length: 4547,
  sha256: 'd5511ea3224a4cc685518e22a4ae4032ee678e2829ff1d4e2476a03d4de6932b',
  git_blob_oid: 'fd5ef798299211aaf015c72979cb3c5fe9048c98',
});

export class Work3ValidationError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'Work3ValidationError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new Work3ValidationError(code, detail);
}

function same(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function rootPath(selectedRoot) {
  const selected = path.resolve(selectedRoot);
  let selectedStat;
  try {
    selectedStat = lstatSync(selected);
  } catch {
    fail('WORK3_INPUT_DRIFT', 'repoRoot');
  }
  if (!selectedStat.isDirectory() || selectedStat.isSymbolicLink()) {
    fail('WORK3_INPUT_DRIFT', 'repoRoot');
  }
  const resolved = realpathSync(selected);
  if (selected !== resolved) fail('WORK3_INPUT_DRIFT', 'repoRoot symbolic-link ancestry');
  const stat = lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('WORK3_INPUT_DRIFT', 'repoRoot');
  }
  return resolved;
}

function repositoryPath(selectedPath) {
  if (typeof selectedPath !== 'string'
      || selectedPath.length === 0
      || path.posix.isAbsolute(selectedPath)
      || selectedPath.split('/').some((member) => member === '' || member === '..')) {
    fail('WORK3_INPUT_DRIFT', 'repository path');
  }
  return selectedPath;
}

function resolveExisting(root, selectedPath) {
  repositoryPath(selectedPath);
  let current = root;
  for (const member of selectedPath.split('/')) {
    current = path.join(current, member);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      fail('WORK3_INPUT_DRIFT', selectedPath);
    }
    if (stat.isSymbolicLink()) fail('WORK3_INPUT_DRIFT', selectedPath);
  }
  const stat = lstatSync(current);
  if (!stat.isFile()) fail('WORK3_INPUT_DRIFT', selectedPath);
  return current;
}

function readBytes(root, selectedPath) {
  return readFileSync(resolveExisting(root, selectedPath));
}

function git(root, argv) {
  const environment = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  for (const name of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_WORK_TREE',
  ]) delete environment[name];
  return execFileSync('git', argv, {
    cwd: root,
    encoding: null,
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// The execution-manifest validator and the candidate verifier may not import a
// subprocess module themselves; their fixed Git observations go through the two
// exported seams below — `gitReadText` for trimmed text, `gitReadBytes` for an
// object's exact bytes — each of which refuses any command head that is not a
// read-only inspection and any option that would make one write, read caller
// configuration or run an external program.
const READ_ONLY_GIT_HEADS = Object.freeze(new Set([
  'cat-file', 'diff-tree', 'log', 'ls-tree', 'merge-base', 'rev-list', 'rev-parse',
]));
// Options that make an otherwise read-only Git command write a file, run an
// external program or take configuration from the caller.
const GIT_OPTION_REFUSAL = /^(?:-c$|-c=|-C$|-O|--config-env|--exec|--ext-diff|--git-dir|--no-pager$|--output|--textconv|--upload-pack|--work-tree)/u;

export function gitReadText(root, argv) {
  if (!Array.isArray(argv) || argv.length === 0 || !READ_ONLY_GIT_HEADS.has(argv[0])
    || argv.some((value) => typeof value !== 'string' || GIT_OPTION_REFUSAL.test(value))) {
    fail('GIT_READ_ONLY_SEAM', 'non-read-only Git inspection refused');
  }
  const environment = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  for (const name of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_CONFIG_COUNT',
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_PARAMETERS',
    'GIT_CONFIG_SYSTEM',
    'GIT_DIR',
    'GIT_EXTERNAL_DIFF',
    'GIT_OBJECT_DIRECTORY',
    'GIT_WORK_TREE',
  ]) delete environment[name];
  return execFileSync('git', argv, {
    cwd: root,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

// The same read-only seam for callers that need the object's exact bytes
// rather than a trimmed text line — a historical binding is verified against
// the Git object it names, so the bytes must survive byte for byte.
export function gitReadBytes(root, argv) {
  if (!Array.isArray(argv) || argv.length === 0 || !READ_ONLY_GIT_HEADS.has(argv[0])
    || argv.some((value) => typeof value !== 'string' || GIT_OPTION_REFUSAL.test(value))) {
    fail('GIT_READ_ONLY_SEAM', 'non-read-only Git inspection refused');
  }
  const environment = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  for (const name of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_CONFIG_COUNT',
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_PARAMETERS',
    'GIT_CONFIG_SYSTEM',
    'GIT_DIR',
    'GIT_EXTERNAL_DIFF',
    'GIT_OBJECT_DIRECTORY',
    'GIT_WORK_TREE',
  ]) delete environment[name];
  return execFileSync('git', argv, {
    cwd: root,
    encoding: null,
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function pinnedTreeSource(root, sourceCommit) {
  if (typeof sourceCommit !== 'string' || !/^[0-9a-f]{40}$/u.test(sourceCommit)) {
    fail('WORK3_INPUT_DRIFT', 'sourceCommit');
  }
  let treeBytes;
  try {
    git(root, ['cat-file', '-e', `${sourceCommit}^{commit}`]);
    treeBytes = git(root, ['ls-tree', '-rz', '--full-tree', sourceCommit, '--']);
  } catch {
    fail('WORK3_INPUT_DRIFT', 'sourceCommit Git tree');
  }
  if (treeBytes.length === 0 || treeBytes.at(-1) !== 0) {
    fail('WORK3_INPUT_DRIFT', 'sourceCommit Git tree encoding');
  }
  const entries = new Map();
  const directories = new Set();
  let offset = 0;
  while (offset < treeBytes.length) {
    const terminator = treeBytes.indexOf(0, offset);
    if (terminator < 0) fail('WORK3_INPUT_DRIFT', 'sourceCommit Git tree encoding');
    const record = treeBytes.subarray(offset, terminator);
    offset = terminator + 1;
    const separator = record.indexOf(0x09);
    if (separator <= 0 || separator === record.length - 1) {
      fail('WORK3_INPUT_DRIFT', 'sourceCommit Git tree entry');
    }
    const metadata = record.subarray(0, separator).toString('ascii').split(' ');
    const pathBytes = record.subarray(separator + 1);
    const selectedPath = pathBytes.toString('utf8');
    if (metadata.length !== 3
        || !/^(?:100644|100755|120000|160000)$/u.test(metadata[0])
        || !['blob', 'commit'].includes(metadata[1])
        || !/^[0-9a-f]{40}$/u.test(metadata[2])
        || !Buffer.from(selectedPath, 'utf8').equals(pathBytes)
        || entries.has(selectedPath)) {
      fail('WORK3_INPUT_DRIFT', 'sourceCommit Git tree entry');
    }
    entries.set(selectedPath, {
      mode: metadata[0],
      object: metadata[2],
      type: metadata[1],
    });
    const members = selectedPath.split('/');
    for (let index = 1; index < members.length; index += 1) {
      directories.add(members.slice(0, index).join('/'));
    }
  }
  const blobs = new Map();
  return Object.freeze({
    pathExists(selectedPath) {
      repositoryPath(selectedPath);
      const members = selectedPath.split('/');
      for (let index = 1; index < members.length; index += 1) {
        if (entries.has(members.slice(0, index).join('/'))) {
          fail('WORK3_INPUT_DRIFT', selectedPath);
        }
      }
      return entries.has(selectedPath) || directories.has(selectedPath);
    },
    readBytes(selectedPath) {
      repositoryPath(selectedPath);
      const entry = entries.get(selectedPath);
      if (!entry || entry.type !== 'blob' || entry.mode !== '100644') {
        fail('WORK3_INPUT_DRIFT', selectedPath);
      }
      if (!blobs.has(entry.object)) {
        let selectedBytes;
        try {
          selectedBytes = git(root, ['cat-file', 'blob', entry.object]);
        } catch {
          fail('WORK3_INPUT_DRIFT', selectedPath);
        }
        blobs.set(entry.object, selectedBytes);
      }
      return blobs.get(entry.object);
    },
  });
}

function inputSource(options) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some((key) => !['repoRoot', 'sourceCommit'].includes(key))) {
    fail('WORK3_RECEIPT_INVALID', 'options');
  }
  const root = rootPath(options.repoRoot ?? REPO_ROOT);
  if (options.sourceCommit !== undefined) return pinnedTreeSource(root, options.sourceCommit);
  return Object.freeze({
    pathExists(selectedPath) {
      return selectedPathExists(root, selectedPath);
    },
    readBytes(selectedPath) {
      return readBytes(root, selectedPath);
    },
  });
}

function readCanonicalRecord(source, selectedPath, schemaVersion = null, idField = null) {
  const bytes = source.readBytes(selectedPath);
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('WORK3_INPUT_DRIFT', `${selectedPath} is not JSON`);
  }
  if (!bytes.equals(Buffer.from(`${canonicalJson(record)}\n`, 'utf8'))) {
    fail('WORK3_INPUT_DRIFT', `${selectedPath} is not canonical JSON plus LF`);
  }
  if (schemaVersion !== null) {
    if (record.schema_version !== schemaVersion || idField === null) {
      fail('WORK3_INPUT_DRIFT', `${selectedPath} envelope`);
    }
    const unsigned = { ...record };
    delete unsigned[idField];
    if (record[idField] !== contentId(schemaVersion, unsigned)) {
      fail('WORK3_INPUT_DRIFT', `${selectedPath} identity`);
    }
  }
  return { bytes, record };
}

function selectedPathExists(root, selectedPath) {
  repositoryPath(selectedPath);
  let current = root;
  const members = selectedPath.split('/');
  for (let index = 0; index < members.length; index += 1) {
    current = path.join(current, members[index]);
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      fail('WORK3_INPUT_DRIFT', selectedPath);
    }
    if (stat.isSymbolicLink()) fail('WORK3_INPUT_DRIFT', selectedPath);
    if (index < members.length - 1 && !stat.isDirectory()) {
      fail('WORK3_INPUT_DRIFT', selectedPath);
    }
  }
  return true;
}

function mapContractError(error) {
  if (error instanceof Work3ValidationError) return error;
  const code = typeof error?.code === 'string' ? error.code : 'WORK3_INPUT_DRIFT';
  const prefix = `${code}: `;
  const message = typeof error?.message === 'string' && error.message.startsWith(prefix)
    ? error.message.slice(prefix.length)
    : 'physical closure validation failed';
  return new Work3ValidationError(code, message);
}

export const validateWork3ReceiptV2 = validateWork3ReceiptV2Shared;

function validateWork3PhysicalSource(source) {
  const amendmentInput = readCanonicalRecord(
    source,
    AMENDMENT_PATH,
    AMENDMENT_SCHEMA,
    'closure_amendment_id',
  );
  const amendment = amendmentInput.record;
  if (amendmentInput.bytes.length !== FROZEN_AMENDMENT_BINDING.byte_length
      || sha256Hex(amendmentInput.bytes) !== FROZEN_AMENDMENT_BINDING.sha256
      || gitBlobOid(amendmentInput.bytes) !== FROZEN_AMENDMENT_BINDING.git_blob_oid
      || amendment.closure_amendment_id !== FROZEN_AMENDMENT_BINDING.record_id) {
    fail('WORK3_INPUT_DRIFT', 'frozen closure amendment');
  }
  if (amendment.effective_family_package_closure === null
      || typeof amendment.effective_family_package_closure !== 'object'
      || Array.isArray(amendment.effective_family_package_closure)) {
    fail('WORK3_INPUT_DRIFT', 'closure amendment physical contract');
  }
  const familyProfileSet = readCanonicalRecord(source, PROFILE_SET_PATH).record;
  let physical;
  try {
    physical = validateWork3PhysicalClosureV2({
      closure: amendment.effective_family_package_closure,
      familyProfileSet,
      resolveBinding(binding) {
        return source.readBytes(binding.path);
      },
      pathExists(selectedPath) {
        return source.pathExists(selectedPath);
      },
    });
  } catch (error) {
    throw mapContractError(error);
  }
  const { status: _status, ...counts } = physical;
  return Object.freeze({
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_PHYSICAL_VALIDATION/V1',
    status: 'PASS',
    closure_amendment_id: amendment.closure_amendment_id,
    ...counts,
  });
}

export function validateWork3PhysicalInputs(options = {}) {
  return validateWork3PhysicalSource(inputSource(options));
}

export function validateWork3(options = {}) {
  const source = inputSource(options);
  const physicalResult = validateWork3PhysicalSource(source);
  const amendment = readCanonicalRecord(
    source,
    AMENDMENT_PATH,
    AMENDMENT_SCHEMA,
    'closure_amendment_id',
  ).record;
  const receiptPath = amendment.receipt_contract_overlay?.work3_receipt_path;
  if (typeof receiptPath !== 'string') {
    fail('WORK3_RECEIPT_INVALID', 'receipt path contract');
  }
  const receipt = readCanonicalRecord(
    source,
    receiptPath,
    RECEIPT_SCHEMA,
    'work3_receipt_id',
  ).record;
  if (!same(receipt.closure_amendment_binding, FROZEN_AMENDMENT_BINDING)
      || !same(receipt.external_review_receipt_binding,
        FROZEN_EXTERNAL_REVIEW_BINDING)) {
    fail('WORK3_RECEIPT_INVALID', 'frozen closure authority bindings');
  }
  const work3EntryBinding = receipt.work3_entry_correction_authority_binding;
  if (work3EntryBinding === null || typeof work3EntryBinding !== 'object') {
    fail('WORK3_RECEIPT_INVALID', 'Work3 entry authority binding');
  }
  const work3EntryAuthority = readCanonicalRecord(
    source,
    work3EntryBinding.path,
    work3EntryBinding.schema_version,
    work3EntryBinding.record_id_field,
  ).record;
  const physicalValidation = {
    status: 'PASS_WORK3_PHYSICAL_CLOSURE_V2',
    family_package_count: physicalResult.family_package_count,
    parked_family_count: physicalResult.parked_family_count,
    profile_count: physicalResult.profile_count,
    dimension_evidence_count: physicalResult.dimension_evidence_count,
    subtype_tree_count: physicalResult.subtype_tree_count,
    match_fixture_count: physicalResult.match_fixture_count,
    structure_fixture_member_count: physicalResult.structure_fixture_member_count,
    package_member_count: physicalResult.package_member_count,
  };
  return validateWork3ReceiptV2({
    amendment,
    pathExists(selectedPath) {
      return source.pathExists(selectedPath);
    },
    physicalValidation,
    receipt,
    resolveBinding(binding) {
      return source.readBytes(binding.path);
    },
    work3EntryAuthority,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) fail('WORK3_RECEIPT_INVALID', 'CLI arguments');
    process.stdout.write(`${JSON.stringify(validateWork3())}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
