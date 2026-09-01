#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PREDECESSOR_MANIFEST_PATH = `${CONTROL}/m7-v2-repair-work3-execution-manifest.json`;
const AMENDMENT_PATH =
  `${CONTROL}/m7-v2-repair-work3-execution-manifest-closure-amendment.json`;
const REVIEW_RECEIPT_PATH =
  `${CONTROL}/m7-v2-repair-work3-execution-manifest-closure-amendment-external-review-receipt.json`;
const APPLICATION_RECEIPT_PATH =
  `${CONTROL}/m7-v2-repair-work3-execution-manifest-closure-amendment-application-receipt.json`;
const SUCCESSOR_MANIFEST_PATH =
  `${CONTROL}/m7-v2-repair-work3-execution-manifest-closure-successor.json`;
const REVIEW_TARGET_REMOTE_REF = 'origin/codex/recover-m7-20260812';
const APPLICATION_RECEIPT_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_APPLICATION_RECEIPT/V1';
const APPLICATION_RECEIPT_ID_FIELD =
  'work3_closure_amendment_application_receipt_id';
const SUCCESSOR_MANIFEST_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V2';

const INPUT_BINDINGS = Object.freeze({
  amendment: Object.freeze({
    path: AMENDMENT_PATH,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_WORK3_EXECUTION_MANIFEST_CLOSURE_AMENDMENT/V1',
    record_id_field: 'closure_amendment_id',
    record_id: '06b879b44497653b8a3a0e698448efb833efc83cbd8591d0e8ff879cc2071ab4',
    byte_length: 207090,
    sha256: 'e5a8610b596edb567f13624551715ba102f7daaa9ef19f438093a2564123fe47',
    git_blob_oid: '4013eb82d7234534e15e39cd85d9582fa3d2d9c0',
  }),
  predecessor: Object.freeze({
    path: PREDECESSOR_MANIFEST_PATH,
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V1',
    record_id_field: 'execution_manifest_id',
    record_id: 'e73e3071c8a3e93d57df68de31e9f46d0157f08627aaa2b7d40b9634b3485690',
    byte_length: 36178,
    sha256: 'b9767780df291de43a212b248dfbefbce1e05e8b6056d10b6776cb551b01fb2e',
    git_blob_oid: 'aa9e6de0b236246673cbcf737659f31261dd896b',
  }),
  review: Object.freeze({
    path: REVIEW_RECEIPT_PATH,
    schema_version:
      'STAGE_2Y_M7_V2_REPAIR_WORK3_CLOSURE_AMENDMENT_EXTERNAL_REVIEW_RECEIPT/V1',
    record_id_field: 'work3_closure_amendment_external_review_receipt_id',
    record_id: 'a2344bb49e37bcae328479835ffe7d2e5477430ff89b4abf8c1af972594a3a14',
    byte_length: 4547,
    sha256: 'd5511ea3224a4cc685518e22a4ae4032ee678e2829ff1d4e2476a03d4de6932b',
    git_blob_oid: 'fd5ef798299211aaf015c72979cb3c5fe9048c98',
  }),
});

export class Work3ClosureApplicationError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work3ClosureApplicationError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new Work3ClosureApplicationError(code, detail);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function canonicalBytes(record) {
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function identified(schemaVersion, idField, body) {
  const unsigned = { schema_version: schemaVersion, ...structuredClone(body) };
  return { ...unsigned, [idField]: contentId(schemaVersion, unsigned) };
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

function repositoryRoot(selectedRoot) {
  const absolute = path.resolve(selectedRoot);
  let stat;
  try {
    stat = lstatSync(absolute);
  } catch {
    fail('WORK3_CLOSURE_PATH_SAFETY', 'repository root');
  }
  if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(absolute) !== absolute) {
    fail('WORK3_CLOSURE_PATH_SAFETY', 'repository root');
  }
  return absolute;
}

function readInput(root, expected) {
  const absolute = path.join(root, ...expected.path.split('/'));
  let bytes;
  try {
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      fail('WORK3_CLOSURE_INPUT_INVALID', expected.path);
    }
    bytes = readFileSync(absolute);
  } catch (error) {
    if (error instanceof Work3ClosureApplicationError) throw error;
    fail('WORK3_CLOSURE_INPUT_INVALID', expected.path);
  }
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('WORK3_CLOSURE_INPUT_INVALID', expected.path);
  }
  if (!bytes.equals(canonicalBytes(record))
      || bytes.length !== expected.byte_length
      || sha256Hex(bytes) !== expected.sha256
      || gitBlobOid(bytes) !== expected.git_blob_oid
      || record.schema_version !== expected.schema_version
      || record[expected.record_id_field] !== expected.record_id) {
    fail('WORK3_CLOSURE_INPUT_INVALID', expected.path);
  }
  const unsigned = structuredClone(record);
  delete unsigned[expected.record_id_field];
  if (record[expected.record_id_field] !== contentId(record.schema_version, unsigned)) {
    fail('WORK3_CLOSURE_INPUT_INVALID', `${expected.path} identity`);
  }
  return { bytes, record };
}

function git(root, argv, options = {}) {
  const environment = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  delete environment.GIT_DIR;
  delete environment.GIT_WORK_TREE;
  return execFileSync('git', argv, {
    cwd: root,
    encoding: 'utf8',
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function validateHistoricalReview(root, review, amendment) {
  if (!same(review.reviewed_artifact_bindings?.amendment_binding, INPUT_BINDINGS.amendment)
      || review.status !== 'PASS'
      || review.review_state !== 'EXTERNAL_CROSS_VENDOR_REVIEW_COMPLETE') {
    fail('WORK3_CLOSURE_REVIEW_INVALID', REVIEW_RECEIPT_PATH);
  }
  const binding = review.review_target_commit_binding;
  const commit = binding?.commit_sha;
  try {
    git(root, ['cat-file', '-e', `${commit}^{commit}`]);
    const parents = git(root, ['show', '-s', '--format=%P', commit]).split(/\s+/).filter(Boolean);
    const tree = git(root, ['show', '-s', '--format=%T', commit]);
    const changedPaths = git(
      root,
      ['diff-tree', '--no-commit-id', '--name-only', '-r', commit],
    ).split('\n').filter(Boolean).sort();
    if (parents.length !== 1
        || parents[0] !== binding.parent_commit_sha
        || tree !== binding.tree_sha
        || !same(changedPaths, binding.changed_paths)) {
      fail('WORK3_CLOSURE_HISTORICAL_REVIEW_INVALID', commit);
    }
    for (const pathBinding of binding.path_blob_bindings) {
      const line = git(root, [
        'ls-tree', '-r', '--full-tree', commit, '--', pathBinding.path,
      ]);
      if (line !== `100644 blob ${pathBinding.git_blob_oid}\t${pathBinding.path}`) {
        fail('WORK3_CLOSURE_HISTORICAL_REVIEW_INVALID', pathBinding.path);
      }
    }
    if (amendment.closure_amendment_id
        !== review.reviewed_artifact_bindings.amendment_binding.record_id) {
      fail('WORK3_CLOSURE_REVIEW_INVALID', 'amendment identity');
    }
  } catch (error) {
    if (error instanceof Work3ClosureApplicationError) throw error;
    fail('WORK3_CLOSURE_HISTORICAL_REVIEW_INVALID', commit);
  }

  let remoteTip;
  try {
    if (binding.remote_ref !== REVIEW_TARGET_REMOTE_REF) {
      fail('WORK3_CLOSURE_REMOTE_HISTORY_INVALID', 'remote ref');
    }
    remoteTip = git(root, ['rev-parse', '--verify', `${REVIEW_TARGET_REMOTE_REF}^{commit}`]);
    git(root, ['merge-base', '--is-ancestor', commit, remoteTip]);
  } catch (error) {
    if (error instanceof Work3ClosureApplicationError) throw error;
    fail('WORK3_CLOSURE_REMOTE_HISTORY_INVALID', remoteTip ?? REVIEW_TARGET_REMOTE_REF);
  }
  return remoteTip;
}

function buildApplicationReceipt(amendment) {
  return identified(APPLICATION_RECEIPT_SCHEMA, APPLICATION_RECEIPT_ID_FIELD, {
    state: 'IMMUTABLE_ZERO_EFFECT_APPLICATION',
    closure_amendment_binding: structuredClone(INPUT_BINDINGS.amendment),
    external_review_receipt_binding: structuredClone(INPUT_BINDINGS.review),
    zero_effect_boundary: structuredClone(amendment.zero_effect_boundary),
  });
}

function buildSuccessorManifest(predecessor, amendment, applicationReceipt, applicationBytes) {
  const overlay = amendment.successor_manifest_contract_overlay;
  const changedFields = [
    'allowed_effects',
    'exact_argv_with_run_limits',
    'exact_git_commit_and_push_argv',
    'permitted_read_paths',
    'permitted_write_paths',
    'stop_conditions',
    'success_conditions',
  ];
  const unsigned = structuredClone(predecessor);
  delete unsigned.execution_manifest_digest;
  delete unsigned.execution_manifest_id;
  unsigned.schema_version = SUCCESSOR_MANIFEST_SCHEMA;
  for (const field of changedFields) unsigned[field] = structuredClone(overlay[field]);
  Object.assign(unsigned, {
    predecessor_execution_manifest_binding: structuredClone(INPUT_BINDINGS.predecessor),
    closure_amendment_binding: structuredClone(INPUT_BINDINGS.amendment),
    external_review_receipt_binding: structuredClone(INPUT_BINDINGS.review),
    closure_application_receipt_binding: recordBinding(
      APPLICATION_RECEIPT_PATH,
      applicationBytes,
      applicationReceipt,
      APPLICATION_RECEIPT_ID_FIELD,
    ),
  });
  if (overlay.schema_version !== SUCCESSOR_MANIFEST_SCHEMA
      || !same(Object.keys({
        ...unsigned,
        execution_manifest_digest: null,
        execution_manifest_id: null,
      }).sort(), overlay.record_exact_keys)) {
    fail('WORK3_CLOSURE_SUCCESSOR_INVALID', 'successor overlay');
  }
  const executionManifestDigest = sha256Hex(canonicalJson(unsigned));
  const withDigest = {
    ...unsigned,
    execution_manifest_digest: executionManifestDigest,
  };
  return {
    ...withDigest,
    execution_manifest_id: contentId(SUCCESSOR_MANIFEST_SCHEMA, withDigest),
  };
}

function outputTarget(root, repositoryPath) {
  let current = root;
  for (const part of path.posix.dirname(repositoryPath).split('/')) {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      fail('WORK3_CLOSURE_OUTPUT_SAFETY', repositoryPath);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fail('WORK3_CLOSURE_OUTPUT_SAFETY', repositoryPath);
    }
  }
  return path.join(current, path.posix.basename(repositoryPath));
}

function preflightOutputs(root) {
  const targets = [APPLICATION_RECEIPT_PATH, SUCCESSOR_MANIFEST_PATH].map(
    (repositoryPath) => {
      const absolute = outputTarget(root, repositoryPath);
      let stat;
      try {
        stat = lstatSync(absolute);
      } catch (error) {
        if (error.code === 'ENOENT') return { repositoryPath, absolute, exists: false };
        fail('WORK3_CLOSURE_OUTPUT_SAFETY', repositoryPath);
      }
      if (stat.isSymbolicLink() || !stat.isFile()) {
        fail('WORK3_CLOSURE_OUTPUT_SAFETY', repositoryPath);
      }
      return { repositoryPath, absolute, exists: true };
    },
  );
  if (targets.every((target) => target.exists)) {
    fail('WORK3_CLOSURE_ALREADY_APPLIED', APPLICATION_RECEIPT_PATH);
  }
  if (targets.some((target) => target.exists)) {
    fail('WORK3_CLOSURE_OUTPUT_STATE_DRIFT', 'partial outputs');
  }
  return targets;
}

function writeAll(descriptor, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const written = writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (written <= 0) fail('WORK3_CLOSURE_WRITE_FAILED', 'short write');
    offset += written;
  }
}

function fsyncParent(absolute) {
  const descriptor = openSync(
    path.dirname(absolute),
    fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
  );
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function writeOutputs(targets, applicationBytes, successorBytes) {
  const bytesByPath = new Map([
    [APPLICATION_RECEIPT_PATH, applicationBytes],
    [SUCCESSOR_MANIFEST_PATH, successorBytes],
  ]);
  const created = [];
  try {
    for (const target of targets) {
      const descriptor = openSync(
        target.absolute,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY
          | fsConstants.O_NOFOLLOW,
        0o644,
      );
      created.push(target.absolute);
      try {
        writeAll(descriptor, bytesByPath.get(target.repositoryPath));
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      fsyncParent(target.absolute);
    }
  } catch (error) {
    let rollbackError;
    for (const absolute of [...created].reverse()) {
      try {
        unlinkSync(absolute);
        fsyncParent(absolute);
      } catch (selectedError) {
        rollbackError ??= selectedError;
      }
    }
    if (rollbackError) fail('WORK3_CLOSURE_ROLLBACK_FAILED', rollbackError.message);
    if (error instanceof Work3ClosureApplicationError) throw error;
    fail('WORK3_CLOSURE_WRITE_FAILED', error.message);
  }
}

export function applyWork3Closure(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some((key) => key !== 'repoRoot')) {
    fail('WORK3_CLOSURE_OPTIONS_INVALID', 'options');
  }
  const root = repositoryRoot(options.repoRoot ?? process.cwd());
  const targets = preflightOutputs(root);
  const amendment = readInput(root, INPUT_BINDINGS.amendment).record;
  const review = readInput(root, INPUT_BINDINGS.review).record;
  const predecessor = readInput(root, INPUT_BINDINGS.predecessor).record;
  validateHistoricalReview(root, review, amendment);
  const applicationReceipt = buildApplicationReceipt(amendment);
  const applicationBytes = canonicalBytes(applicationReceipt);
  const successorManifest = buildSuccessorManifest(
    predecessor,
    amendment,
    applicationReceipt,
    applicationBytes,
  );
  const successorBytes = canonicalBytes(successorManifest);
  writeOutputs(targets, applicationBytes, successorBytes);
  return {
    status: 'PASS_WORK3_CLOSURE_APPLICATION',
    work3_closure_amendment_application_receipt_id:
      applicationReceipt[APPLICATION_RECEIPT_ID_FIELD],
    successor_execution_manifest_id: successorManifest.execution_manifest_id,
    target_paths: [APPLICATION_RECEIPT_PATH, SUCCESSOR_MANIFEST_PATH],
    effects: {
      files_written: 2,
      legal_semantic_change_count: 0,
      product_write_count: 0,
      database_write_count: 0,
      serving_change_count: 0,
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) fail('WORK3_CLOSURE_OPTIONS_INVALID', 'CLI arguments');
    process.stdout.write(`${JSON.stringify(applyWork3Closure())}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
