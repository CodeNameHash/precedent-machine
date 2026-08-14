#!/usr/bin/env node

import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import canonicalBytes from '../lib/canonical-v2/canonical-bytes.js';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = canonicalBytes;

const DEFAULT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_COMMIT = 'b78a2b8c1f25b78f35116d2620c491b69215d0b6';
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const MANIFEST_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-pre-work0-evidence-input-manifest.json`;
const AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-work0-bootstrap-authority.json`;
const FIXED_SAMPLE_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-fixed-sample-identity-manifest.json`;
const BASELINE_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-baseline-ledger.json`;
const RULING_MAP_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-calibration-question-ruling-map.json`;
const SUPERSESSION_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-legacy-output-supersession-ledger.json`;
const RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json`;
const FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work0-finalise.mjs';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work0-validate.mjs';
const TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-work0.test.js';

const MANIFEST_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_PRE_WORK0_EVIDENCE_INPUT_MANIFEST/V1';
const AUTHORITY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK0_BOOTSTRAP_AUTHORITY/V1';
const FIXED_SAMPLE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_FIXED_SAMPLE_IDENTITY_MANIFEST/V1';
const BASELINE_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_BASELINE_LEDGER/V1';
const RULING_MAP_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_CALIBRATION_QUESTION_RULING_MAP/V1';
const SUPERSESSION_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_LEGACY_OUTPUT_SUPERSESSION_LEDGER/V1';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1';
const LATER_AUTHORITY_PATH_PATTERN = /m7-v2-repair.*work(?:1-7|1)(?:[^0-9]|$).*authority/i;

const EXPECTED_MANIFEST = Object.freeze({
  byte_length: 40307,
  sha256: '5a6608c9b05571557c08507c0c11ac415108b671c0eea91777b410c2e9ae0af7',
  manifest_id: '98aa64006364072d38cf6ccd4e0d26e6f343875d6fbe105bd6d31348c60923b6',
  manifest_digest: '3c90294de248c60f4e421723473cc315d64f70a3402fe756668f1fe778ecb358',
});
const EXPECTED_AUTHORITY = Object.freeze({
  byte_length: 19241,
  sha256: '7bb1396792d1893ed4ecd3c28ab6610697674344fac8fb37f3ee01fba26256ec',
  authority_id: '6be158afbf7bb5f98197005ba42c8ede1359d604bdd03c93f0949841dfacf2f5',
  authority_digest: '87cb76f5a6a50a96c2265427ef551ac1f2d8bd3d7a4badf56a8aeab4cd6a81c0',
});
const EXPECTED_ACTIVATION = Object.freeze({
  state: 'CONFIRMED_WORK0_ONLY',
  approver: 'BEN_GOODCHILD',
  confirmed_on: '2026-08-14',
  verbatim_confirmation: 'On 2026-08-14, I confirm for Work 0 only: authority path evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work0-bootstrap-authority.json, schema STAGE_2Y_M7_V2_REPAIR_WORK0_BOOTSTRAP_AUTHORITY/V1, 19241 bytes, SHA-256 7bb1396792d1893ed4ecd3c28ab6610697674344fac8fb37f3ee01fba26256ec, ID 6be158afbf7bb5f98197005ba42c8ede1359d604bdd03c93f0949841dfacf2f5; manifest path evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-pre-work0-evidence-input-manifest.json, schema STAGE_2Y_M7_V2_REPAIR_PRE_WORK0_EVIDENCE_INPUT_MANIFEST/V1, 40307 bytes, SHA-256 5a6608c9b05571557c08507c0c11ac415108b671c0eea91777b410c2e9ae0af7, ID 98aa64006364072d38cf6ccd4e0d26e6f343875d6fbe105bd6d31348c60923b6.',
  authority_binding: Object.freeze({
    path: AUTHORITY_PATH,
    schema_version: AUTHORITY_SCHEMA,
    byte_length: EXPECTED_AUTHORITY.byte_length,
    sha256: EXPECTED_AUTHORITY.sha256,
    authority_id: EXPECTED_AUTHORITY.authority_id,
  }),
  manifest_binding: Object.freeze({
    path: MANIFEST_PATH,
    schema_version: MANIFEST_SCHEMA,
    byte_length: EXPECTED_MANIFEST.byte_length,
    sha256: EXPECTED_MANIFEST.sha256,
    manifest_id: EXPECTED_MANIFEST.manifest_id,
  }),
});

const OUTPUT_CONTRACTS = Object.freeze([
  Object.freeze({
    path: FIXED_SAMPLE_PATH,
    schema_version: FIXED_SAMPLE_SCHEMA,
    id_field: 'fixed_sample_identity_manifest_id',
  }),
  Object.freeze({
    path: BASELINE_PATH,
    schema_version: BASELINE_SCHEMA,
    id_field: 'repair_baseline_ledger_id',
  }),
  Object.freeze({
    path: RULING_MAP_PATH,
    schema_version: RULING_MAP_SCHEMA,
    id_field: 'calibration_question_ruling_map_id',
  }),
  Object.freeze({
    path: SUPERSESSION_PATH,
    schema_version: SUPERSESSION_SCHEMA,
    id_field: 'legacy_output_supersession_ledger_id',
  }),
]);

const RECEIPT_KEYS = Object.freeze([
  'schema_version',
  'evidence_root_id',
  'stage',
  'lifecycle_state',
  'status',
  'base_commit',
  'activation_confirmation',
  'pre_work0_manifest_binding',
  'bootstrap_authority_binding',
  'evidence_input_bindings',
  'input_set_digest',
  'work0_record_bindings',
  'snapshot_bindings',
  'snapshot_set_digest',
  'counts',
  'effects',
  'checks',
  'next_authority',
]);
const SNAPSHOT_BINDING_KEYS = Object.freeze([
  'path',
  'schema_version',
  'record_id_field',
  'record_id',
  'byte_length',
  'sha256',
  'git_blob_oid',
]);
const COUNTS = Object.freeze({
  direct_input_binding_count: 73,
  fixed_sample_member_count: 50,
  repair_item_count: 38,
  control_item_count: 12,
  calibration_family_count: 25,
  calibration_question_count: 75,
  programme_ruling_count: 3,
  legacy_analysis_registration_count: 7,
  legacy_projection_registration_count: 7,
  legacy_support_binding_count: 8,
  legacy_row_registration_count: 1111,
  snapshot_binding_count: 11,
});
const CHECK_IDS = Object.freeze([
  'ACTIVATION_CONFIRMATION',
  'BASE_INPUT_BINDINGS',
  'CORE_STATUS_DOCS',
  'FIXED_SAMPLE_IDENTITY',
  'REPAIR_BASELINE',
  'CALIBRATION_RULING_MAP',
  'LEGACY_V1_SUPERSESSION',
  'STATIC_DEPENDENCY_BOUNDARY',
  'ZERO_EFFECTS',
  'FINALISATION_SCOPE',
  'PERSISTENT_SNAPSHOT',
]);
const NEXT_AUTHORITY = Object.freeze({
  work1_7_authorised: false,
  m8_authorised: false,
  required_before_work1: 'SEPARATE_AUTHORITY_BINDING_COMPLETED_WORK0_EVIDENCE_ROOT',
  required_binding_field: 'work0_evidence_root_binding',
});
const REPAIR_CLASS_ORDINALS = Object.freeze({
  MATERIAL_MEANING_OMITTED_OR_HIDDEN: Object.freeze([
    1, 2, 4, 6, 7, 8, 9, 10, 13, 18, 19, 22, 23, 24, 25, 28, 31, 34, 35, 36, 44,
  ]),
  CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE: Object.freeze([
    14, 20, 27, 33, 38, 40, 42, 43, 45, 46, 47, 48, 49, 50,
  ]),
  SOURCE_ARTEFACT: Object.freeze([15]),
  FALSE_PARSER_AMBIGUITY: Object.freeze([39]),
  APPROVED_NO_COMPARISON: Object.freeze([41]),
  CLEAN_CONTROL: Object.freeze([3, 5, 11, 12, 16, 17, 21, 26, 29, 30, 32, 37]),
});
const FRESH_QUESTION_ORDINALS = Object.freeze([2, 4, 45]);
const CORE_STATUS_CONTRACTS = Object.freeze({
  'docs/core/OPERATING-RULES.md': Object.freeze({
    byte_length: 53877,
    sha256: 'de15fec1cecb96479fe8f71da05260a51f92eeab684c2ead63453af7cfd4e3e6',
    required_text: Object.freeze([
      '`FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR`.',
      'Ben adopted the M7 V2 repair plan and authorised Work 0 only. Work 0 passed',
      'Work 1 to Work 7, M8,',
    ]),
  }),
  'docs/core/PLAN.md': Object.freeze({
    byte_length: 89279,
    sha256: 'd02b85aec4acc0dc8a041c91592c95c34816e2dbc3f2163e63eea68ebe9acbff',
    required_text: Object.freeze([
      'Work 1 to Work 7 remain locked.',
      'Model calls remain zero.',
      'M8 is not authorised and remains locked.',
      '| M7 | Failed lawyer review; Work 0 passed; Work 1-7 locked |',
    ]),
  }),
});
const EXPECTED_SNAPSHOT_PATHS = Object.freeze([
  MANIFEST_PATH,
  AUTHORITY_PATH,
  'docs/core/OPERATING-RULES.md',
  'docs/core/PLAN.md',
  FIXED_SAMPLE_PATH,
  BASELINE_PATH,
  RULING_MAP_PATH,
  SUPERSESSION_PATH,
  FINALISER_PATH,
  VALIDATOR_PATH,
  TEST_PATH,
]);

const MANIFEST_KEYS = Object.freeze([
  'adopted_plan_commit',
  'constraints',
  'effects',
  'input_bindings',
  'input_set_digest',
  'intended_evidence_root',
  'manifest_digest',
  'manifest_id',
  'prepared_sequence',
  'purpose',
  'schema_version',
  'stage',
  'state',
]);
const INPUT_BINDING_KEYS = Object.freeze([
  'binding_source',
  'byte_length',
  'ordinal',
  'path',
  'purpose',
  'record_id',
  'record_id_field',
  'role',
  'schema_version',
  'sha256',
  'v2_admissible',
]);
const AUTHORITY_KEYS = Object.freeze([
  'adopted_plan_binding',
  'adoption_instruction',
  'authority_digest',
  'authority_id',
  'authority_state',
  'authority_version',
  'base_commit',
  'command_run_limits',
  'intended_evidence_root',
  'next_authority_requirement',
  'permitted_changed_paths',
  'permitted_commands',
  'permitted_commit_paths',
  'permitted_output_paths',
  'permitted_read_paths',
  'pre_work0_candidate_paths',
  'pre_work0_manifest_binding',
  'prepared_sequence',
  'prohibitions',
  'repository_actions',
  'required_activation',
  'rollback',
  'schema_version',
  'stage',
  'stop_conditions',
  'validation_modes',
  'zero_effect_expectations',
]);

export class Work0ValidationError extends Error {
  constructor(code, detail) {
    super(`STAGE_2Y_M7_V2_REPAIR_WORK0_VALIDATE:${code}: ${detail}`);
    this.name = 'Work0ValidationError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new Work0ValidationError(code, detail);
}

function same(actual, expected, code, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(code, label);
}

function exactKeys(value, expected, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, label);
  same(Object.keys(value).sort(), [...expected].sort(), code, label);
}

function requireDigest(value, code, label) {
  if (!/^[0-9a-f]{64}$/.test(value || '')) fail(code, label);
}

function requireGitObjectId(value, code, label) {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value || '')) fail(code, label);
}

function normaliseRoot(repoRoot) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) {
    fail('INVALID_OPTIONS', 'repoRoot must be a non-empty string');
  }
  const root = resolve(repoRoot);
  if (!existsSync(root) || !lstatSync(root).isDirectory()) {
    fail('INVALID_OPTIONS', 'repoRoot must be an existing directory');
  }
  let actual;
  try {
    actual = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    fail('INVALID_OPTIONS', `repoRoot is not a Git worktree: ${error.message}`);
  }
  if (resolve(actual) !== root) fail('INVALID_OPTIONS', 'repoRoot is not the Git worktree root');
  return root;
}

function repoPath(root, absolutePath) {
  const value = relative(root, absolutePath).split('\\').join('/');
  if (!value || value === '..' || value.startsWith('../')) {
    fail('INVALID_OPTIONS', `path outside repository: ${absolutePath}`);
  }
  return value;
}

function exactPath(root, repositoryPath) {
  if (typeof repositoryPath !== 'string' || repositoryPath.length === 0
    || isAbsolute(repositoryPath)) {
    fail('INVALID_OPTIONS', `invalid repository path: ${String(repositoryPath)}`);
  }
  const absolutePath = resolve(root, repositoryPath);
  if (repoPath(root, absolutePath) !== repositoryPath) {
    fail('INVALID_OPTIONS', `non-normalised repository path: ${repositoryPath}`);
  }
  return absolutePath;
}

function assertNoSymlink(root, absolutePath, { allowMissing = false } = {}) {
  let cursor = root;
  for (const component of repoPath(root, absolutePath).split('/')) {
    cursor = resolve(cursor, component);
    if (!existsSync(cursor)) {
      if (allowMissing) return;
      fail('GENERATED_RECORD_DRIFT', `missing path: ${repoPath(root, cursor)}`);
    }
    if (lstatSync(cursor).isSymbolicLink()) {
      fail('GENERATED_RECORD_DRIFT', `symlink path: ${repoPath(root, cursor)}`);
    }
  }
}

function readCurrentBytes(root, repositoryPath, code = 'GENERATED_RECORD_DRIFT') {
  const absolutePath = exactPath(root, repositoryPath);
  assertNoSymlink(root, absolutePath);
  if (!lstatSync(absolutePath).isFile()) fail(code, `not a file: ${repositoryPath}`);
  return readFileSync(absolutePath);
}

function parseJsonBytes(bytes, code, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail(code, `${label}: invalid JSON: ${error.message}`);
  }
}

function readCurrentJson(root, repositoryPath, code = 'GENERATED_RECORD_DRIFT') {
  const bytes = readCurrentBytes(root, repositoryPath, code);
  const value = parseJsonBytes(bytes, code, repositoryPath);
  return { bytes, value };
}

function readCommitBlob(root, commit, repositoryPath) {
  try {
    return execFileSync('git', ['show', `${commit}:${repositoryPath}`], {
      cwd: root,
      encoding: null,
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch (error) {
    fail('BASE_BLOB_DRIFT', `${repositoryPath}: ${error.message}`);
  }
}

function readGitBlob(root, objectId) {
  requireGitObjectId(objectId, 'SNAPSHOT_BINDING_DRIFT', 'git blob OID');
  try {
    return execFileSync('git', ['cat-file', 'blob', objectId], {
      cwd: root,
      encoding: null,
      maxBuffer: 128 * 1024 * 1024,
    });
  } catch (error) {
    fail('SNAPSHOT_BINDING_DRIFT', `${objectId}: ${error.message}`);
  }
}

function gitObjectFormat(root) {
  try {
    const format = execFileSync('git', ['rev-parse', '--show-object-format'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    if (format !== 'sha1' && format !== 'sha256') {
      fail('SNAPSHOT_BINDING_DRIFT', `unsupported Git object format: ${format}`);
    }
    return format;
  } catch (error) {
    if (error instanceof Work0ValidationError) throw error;
    fail('SNAPSHOT_BINDING_DRIFT', `cannot read Git object format: ${error.message}`);
  }
}

function gitBlobOid(bytes, objectFormat) {
  return createHash(objectFormat)
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function canonicalRecordBytes(record) {
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function simpleRecordId(record, idField) {
  const unsigned = structuredClone(record);
  delete unsigned[idField];
  return contentId(record.schema_version, unsigned);
}

function digestAndId(record, digestField, idField) {
  const unsigned = structuredClone(record);
  delete unsigned[digestField];
  delete unsigned[idField];
  const digest = sha256Hex(canonicalJson(unsigned));
  return {
    digest,
    id: contentId(record.schema_version, { ...unsigned, [digestField]: digest }),
  };
}

export function validateCanonicalRecord({ record, bytes, schemaVersion, idField }) {
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || !Buffer.isBuffer(bytes) || typeof schemaVersion !== 'string'
    || typeof idField !== 'string') {
    fail('INVALID_OPTIONS', 'validateCanonicalRecord options');
  }
  if (!bytes.equals(canonicalRecordBytes(record))) {
    fail('CANONICAL_JSON_DRIFT', schemaVersion);
  }
  if (record.schema_version !== schemaVersion
    || record[idField] !== simpleRecordId(record, idField)) {
    fail('RECORD_IDENTITY_DRIFT', schemaVersion);
  }
  return true;
}

export function validateInputBinding({ binding, bytes }) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)
    || !Buffer.isBuffer(bytes)) {
    fail('INVALID_OPTIONS', 'validateInputBinding options');
  }
  if (binding.byte_length !== bytes.length || binding.sha256 !== sha256Hex(bytes)) {
    fail('BASE_BLOB_DRIFT', binding.path || 'input binding');
  }
  if (binding.schema_version === null || binding.record_id_field === null
    || binding.record_id === null) {
    if (!(binding.schema_version === null && binding.record_id_field === null
      && binding.record_id === null)) {
      fail('BASE_BLOB_DRIFT', `${binding.path}: partial record identity`);
    }
    return true;
  }
  const record = parseJsonBytes(bytes, 'BASE_BLOB_DRIFT', binding.path);
  if (record.schema_version !== binding.schema_version
    || record[binding.record_id_field] !== binding.record_id) {
    fail('BASE_BLOB_DRIFT', `${binding.path}: record identity`);
  }
  return true;
}

export function validateStagedAllowlist({ actual, expected }) {
  if (!Array.isArray(actual) || !Array.isArray(expected)
    || actual.some((value) => typeof value !== 'string')
    || expected.some((value) => typeof value !== 'string')) {
    fail('INVALID_OPTIONS', 'validateStagedAllowlist options');
  }
  if (new Set(actual).size !== actual.length || new Set(expected).size !== expected.length) {
    fail('STAGED_ALLOWLIST_DRIFT', 'duplicate staged path');
  }
  same([...actual].sort(), [...expected].sort(), 'STAGED_ALLOWLIST_DRIFT', 'staged path set');
  return true;
}

export function validateIndexBlobBindings({ actual, expected }) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    fail('INVALID_OPTIONS', 'validateIndexBlobBindings options');
  }
  for (const [label, bindings] of [['actual', actual], ['expected', expected]]) {
    for (const binding of bindings) {
      exactKeys(binding, ['path', 'git_blob_oid'], 'SNAPSHOT_BINDING_DRIFT', `${label} blob binding`);
      if (typeof binding.path !== 'string') {
        fail('SNAPSHOT_BINDING_DRIFT', `${label} blob path`);
      }
      requireGitObjectId(binding.git_blob_oid, 'SNAPSHOT_BINDING_DRIFT', `${binding.path}: blob OID`);
    }
    if (new Set(bindings.map((binding) => binding.path)).size !== bindings.length) {
      fail('SNAPSHOT_BINDING_DRIFT', `${label} duplicate blob path`);
    }
  }
  same(actual, expected, 'SNAPSHOT_BINDING_DRIFT', 'blob binding set');
  return true;
}

export function validateLaterAuthority({ authorityRecords, receipt, receiptBytes }) {
  if (!Array.isArray(authorityRecords)
    || !receipt || typeof receipt !== 'object' || Array.isArray(receipt)
    || !Buffer.isBuffer(receiptBytes)) {
    fail('INVALID_OPTIONS', 'validateLaterAuthority options');
  }
  if (authorityRecords.length === 0) return true;
  if (authorityRecords.length !== 1) {
    fail('LATER_AUTHORITY_DRIFT', 'expected at most one later Work 1-7 authority');
  }
  const authorityRecord = authorityRecords[0];
  exactKeys(authorityRecord, ['path', 'bytes'], 'LATER_AUTHORITY_DRIFT', 'later authority input');
  if (typeof authorityRecord.path !== 'string' || !Buffer.isBuffer(authorityRecord.bytes)
    || !LATER_AUTHORITY_PATH_PATTERN.test(authorityRecord.path)) {
    fail('LATER_AUTHORITY_DRIFT', 'invalid later authority path or bytes');
  }
  const authority = parseJsonBytes(
    authorityRecord.bytes,
    'LATER_AUTHORITY_DRIFT',
    authorityRecord.path,
  );
  if (!authorityRecord.bytes.equals(canonicalRecordBytes(authority))) {
    fail('LATER_AUTHORITY_DRIFT', `${authorityRecord.path}: noncanonical JSON`);
  }
  const binding = authority.work0_evidence_root_binding;
  exactKeys(binding, [
    'path',
    'schema_version',
    'evidence_root_id',
    'byte_length',
    'sha256',
  ], 'LATER_AUTHORITY_DRIFT', 'work0_evidence_root_binding');
  same(binding, {
    path: RECEIPT_PATH,
    schema_version: RECEIPT_SCHEMA,
    evidence_root_id: receipt.evidence_root_id,
    byte_length: receiptBytes.length,
    sha256: sha256Hex(receiptBytes),
  }, 'LATER_AUTHORITY_DRIFT', 'work0 evidence-root binding');
  return true;
}

function validateManifest(bytes) {
  if (bytes.length !== EXPECTED_MANIFEST.byte_length
    || sha256Hex(bytes) !== EXPECTED_MANIFEST.sha256) {
    fail('BASE_BLOB_DRIFT', MANIFEST_PATH);
  }
  const manifest = parseJsonBytes(bytes, 'BASE_BLOB_DRIFT', MANIFEST_PATH);
  if (!bytes.equals(canonicalRecordBytes(manifest))) {
    fail('CANONICAL_JSON_DRIFT', MANIFEST_PATH);
  }
  exactKeys(manifest, MANIFEST_KEYS, 'BASE_BLOB_DRIFT', 'manifest members');
  if (manifest.schema_version !== MANIFEST_SCHEMA
    || manifest.stage !== 'M7_V2_REPAIR_WORK0'
    || manifest.state !== 'PREPARED_NON_AUTHORITATIVE'
    || manifest.prepared_sequence !== 1
    || manifest.adopted_plan_commit !== BASE_COMMIT
    || manifest.purpose
      !== 'Bind every byte Work 0 may inspect without admitting any V1 semantic output into M7 V2.') {
    fail('BASE_BLOB_DRIFT', 'manifest state');
  }
  same(manifest.constraints, {
    direct_binding_count: 73,
    m8_authorised: false,
    transitive_admission: 'NONE',
    v1_semantic_admission: 'FORBIDDEN',
    work0_only: true,
    work1_7_authorised: false,
  }, 'BASE_BLOB_DRIFT', 'manifest constraints');
  same(manifest.effects, {
    database_writes: 0,
    m0_m4_mutations: 0,
    m8_actions: 0,
    model_calls: 0,
    network_reads: 0,
    product_writes: 0,
    publication_changes: 0,
    selector_changes: 0,
    serving_changes: 0,
  }, 'ZERO_EFFECT_VIOLATION', 'manifest effects');
  same(manifest.intended_evidence_root, {
    path: RECEIPT_PATH,
    schema_version: RECEIPT_SCHEMA,
  }, 'BASE_BLOB_DRIFT', 'manifest receipt target');
  const identity = digestAndId(manifest, 'manifest_digest', 'manifest_id');
  if (manifest.manifest_digest !== EXPECTED_MANIFEST.manifest_digest
    || manifest.manifest_id !== EXPECTED_MANIFEST.manifest_id
    || manifest.manifest_digest !== identity.digest
    || manifest.manifest_id !== identity.id) {
    fail('RECORD_IDENTITY_DRIFT', MANIFEST_SCHEMA);
  }
  if (!Array.isArray(manifest.input_bindings)
    || manifest.input_bindings.length !== COUNTS.direct_input_binding_count
    || sha256Hex(canonicalJson(manifest.input_bindings)) !== manifest.input_set_digest) {
    fail('COUNT_DRIFT', 'manifest input bindings');
  }
  return manifest;
}

function validateAuthority(bytes, manifest) {
  if (bytes.length !== EXPECTED_AUTHORITY.byte_length
    || sha256Hex(bytes) !== EXPECTED_AUTHORITY.sha256) {
    fail('BASE_BLOB_DRIFT', AUTHORITY_PATH);
  }
  const authority = parseJsonBytes(bytes, 'BASE_BLOB_DRIFT', AUTHORITY_PATH);
  if (!bytes.equals(canonicalRecordBytes(authority))) {
    fail('CANONICAL_JSON_DRIFT', AUTHORITY_PATH);
  }
  exactKeys(authority, AUTHORITY_KEYS, 'BASE_BLOB_DRIFT', 'authority members');
  if (authority.schema_version !== AUTHORITY_SCHEMA
    || authority.stage !== 'M7_V2_REPAIR_WORK0'
    || authority.authority_version !== 1
    || authority.prepared_sequence !== 2
    || authority.base_commit !== BASE_COMMIT
    || authority.authority_state
      !== 'EFFECTIVE_ONLY_AFTER_REQUIRED_ACTIVATION_IS_SATISFIED_AND_PERSISTED') {
    fail('BASE_BLOB_DRIFT', 'authority state');
  }
  const identity = digestAndId(authority, 'authority_digest', 'authority_id');
  if (authority.authority_digest !== EXPECTED_AUTHORITY.authority_digest
    || authority.authority_id !== EXPECTED_AUTHORITY.authority_id
    || authority.authority_digest !== identity.digest
    || authority.authority_id !== identity.id) {
    fail('RECORD_IDENTITY_DRIFT', AUTHORITY_SCHEMA);
  }
  const manifestBinding = authority.pre_work0_manifest_binding;
  if (!manifestBinding
    || manifestBinding.path !== MANIFEST_PATH
    || manifestBinding.schema_version !== MANIFEST_SCHEMA
    || manifestBinding.byte_length !== EXPECTED_MANIFEST.byte_length
    || manifestBinding.sha256 !== EXPECTED_MANIFEST.sha256
    || manifestBinding.manifest_id !== manifest.manifest_id
    || manifestBinding.manifest_digest !== manifest.manifest_digest) {
    fail('BASE_BLOB_DRIFT', 'authority manifest binding');
  }
  if (authority.adopted_plan_binding.commit !== BASE_COMMIT
    || authority.adopted_plan_binding.path
      !== 'docs/codex-program/notes/M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md') {
    fail('BASE_BLOB_DRIFT', 'authority adopted plan binding');
  }
  same(authority.intended_evidence_root, manifest.intended_evidence_root,
    'BASE_BLOB_DRIFT', 'authority receipt target');
  same(authority.pre_work0_candidate_paths, [MANIFEST_PATH, AUTHORITY_PATH],
    'FINALISATION_DELTA_DRIFT', 'pre-Work0 candidate paths');
  same(authority.permitted_output_paths, OUTPUT_CONTRACTS.map(({ path }) => path).concat(RECEIPT_PATH),
    'FINALISATION_DELTA_DRIFT', 'permitted output paths');
  same(authority.permitted_commit_paths, [
    ...authority.pre_work0_candidate_paths,
    ...authority.permitted_changed_paths,
  ], 'FINALISATION_DELTA_DRIFT', 'permitted commit paths');
  if (new Set(authority.permitted_commit_paths).size !== authority.permitted_commit_paths.length
    || !authority.permitted_changed_paths.includes(FINALISER_PATH)
    || !authority.permitted_changed_paths.includes(VALIDATOR_PATH)
    || !authority.permitted_changed_paths.includes(TEST_PATH)) {
    fail('FINALISATION_DELTA_DRIFT', 'authority path set');
  }
  same(authority.repository_actions, {
    finalisation_repository_delta: 'MUST_EQUAL_PERMITTED_COMMIT_PATHS_EXACTLY',
    local_commit_to_branch: 'codex/recover-m7-20260812',
    post_add_cached_diff: 'MUST_EQUAL_PERMITTED_COMMIT_PATHS_EXACTLY',
    pre_add_cached_diff: 'MUST_BE_EMPTY',
    push_to_remote_branch: 'NOT_AUTHORISED_WORK0',
  }, 'ZERO_EFFECT_VIOLATION', 'repository actions');
  if (authority.command_run_limits.repository_pushes !== 0
    || authority.command_run_limits.model_commands !== 0
    || authority.command_run_limits.m5_m6_m7_runners !== 0
    || authority.command_run_limits.m8_commands !== 0
    || authority.command_run_limits.work1_7_commands !== 0
    || authority.command_run_limits.cached_diff_read !== 2
    || authority.permitted_commands.some((command) => command[0] === 'git' && command[1] === 'push')
    || !authority.permitted_commands.some((command) => canonicalJson(command)
      === canonicalJson(['git', 'diff', '--cached', '--name-only']))) {
    fail('ZERO_EFFECT_VIOLATION', 'authority command limits');
  }
  if (!authority.prohibitions.includes('NO_MODEL_CALLS')
    || !authority.prohibitions.includes('NO_WORK1_7')
    || !authority.prohibitions.includes('NO_M8')
    || !authority.prohibitions.includes('NO_NETWORK_WRITES_OR_PUSH')
    || Object.values(authority.zero_effect_expectations).some((value) => value !== 0)) {
    fail('ZERO_EFFECT_VIOLATION', 'authority prohibitions or effects');
  }
  same(authority.required_activation.evidence_root_confirmation_record_required, {
    authority_binding_fields: ['path', 'schema_version', 'byte_length', 'sha256', 'authority_id'],
    confirmation_date: true,
    confirmation_state: 'CONFIRMED_WORK0_ONLY',
    manifest_binding_fields: ['path', 'schema_version', 'byte_length', 'sha256', 'manifest_id'],
    preserve_verbatim_confirmation: true,
  }, 'ACTIVATION_CONFIRMATION_DRIFT', 'authority activation persistence');
  if (authority.required_activation.approver !== 'BEN_GOODCHILD'
    || authority.required_activation.scope !== 'WORK0_ONLY'
    || Object.entries(authority.required_activation)
      .filter(([key]) => key.startsWith('confirmation_must_name_'))
      .some(([, value]) => value !== true)) {
    fail('ACTIVATION_CONFIRMATION_DRIFT', 'authority activation contract');
  }
  same(authority.validation_modes, {
    finalisation: {
      later_work1_7_authority_must_be_absent: true,
      repository_delta: 'EXACT_PERMITTED_COMMIT_PATHS',
      staged_index_after_add: 'EXACT_PERMITTED_COMMIT_PATHS',
      staged_index_before_add: 'EMPTY',
    },
    persistent: {
      base_inputs: 'READ_FROM_ADOPTED_PLAN_COMMIT_BLOBS',
      later_unrelated_repository_paths: 'IGNORED',
      later_work1_7_authority: 'ABSENT_OR_BINDS_EXACT_EVIDENCE_ROOT',
      receipt: 'VERIFY_CANONICAL_SELF_IDENTITY_AND_ANY_DOWNSTREAM_BINDING',
      work0_prepared_controls_and_outputs: 'READ_FROM_RECEIPT_BOUND_GIT_BLOB_OIDS',
      worktree_dirty_set: 'NOT_A_PERSISTENT_CONDITION',
    },
    receipt_snapshot_requirement: {
      bind_each_non_receipt_work0_file: SNAPSHOT_BINDING_KEYS,
      receipt_self_binding: 'CANONICAL_IDENTITY_ONLY_NON_CIRCULAR',
      snapshot_set: 'PRE_WORK0_CANDIDATE_PATHS_PLUS_PERMITTED_CHANGED_PATHS',
    },
  }, 'SNAPSHOT_BINDING_DRIFT', 'authority validation modes');
  return authority;
}

function validateBaseInputs(root, manifest) {
  const seenPaths = new Set();
  const records = new Map();
  for (let index = 0; index < manifest.input_bindings.length; index += 1) {
    const binding = manifest.input_bindings[index];
    exactKeys(binding, INPUT_BINDING_KEYS, 'BASE_BLOB_DRIFT', `input binding ${index + 1}`);
    if (binding.ordinal !== index + 1
      || binding.binding_source !== 'ADOPTED_PLAN_COMMIT_BLOB'
      || binding.v2_admissible !== false
      || seenPaths.has(binding.path)
      || binding.path === MANIFEST_PATH
      || binding.path === AUTHORITY_PATH
      || binding.path === RECEIPT_PATH) {
      fail('BASE_BLOB_DRIFT', `input binding ${index + 1}`);
    }
    exactPath(root, binding.path);
    seenPaths.add(binding.path);
    const bytes = readCommitBlob(root, BASE_COMMIT, binding.path);
    validateInputBinding({ binding, bytes });
    records.set(binding.path, {
      binding,
      bytes,
      value: binding.schema_version === null
        ? null
        : parseJsonBytes(bytes, 'BASE_BLOB_DRIFT', binding.path),
    });
  }
  if (seenPaths.size !== COUNTS.direct_input_binding_count
    || sha256Hex(canonicalJson(manifest.input_bindings)) !== manifest.input_set_digest) {
    fail('COUNT_DRIFT', 'base input set');
  }
  const roleCount = (role) => manifest.input_bindings.filter((binding) => binding.role === role).length;
  if (roleCount('LAWYER_REVIEW_PACKET') !== 1
    || roleCount('LAWYER_DECISION_LEDGER') !== 1
    || roleCount('M5_CALIBRATION_PACK') !== COUNTS.calibration_family_count
    || roleCount('FAILED_M5_V1_ANALYSIS') !== COUNTS.legacy_analysis_registration_count
    || roleCount('FAILED_M6_V1_PROJECTION') !== COUNTS.legacy_projection_registration_count
    || roleCount('FAILED_M6_V1_SUPPORT') !== COUNTS.legacy_support_binding_count) {
    fail('COUNT_DRIFT', 'required manifest roles');
  }
  return records;
}

function inputByRole(manifest, records, role) {
  const bindings = manifest.input_bindings.filter((binding) => binding.role === role);
  return bindings.map((binding) => records.get(binding.path));
}

function oneInputByRole(manifest, records, role) {
  const values = inputByRole(manifest, records, role);
  if (values.length !== 1) fail('COUNT_DRIFT', role);
  return values[0];
}

function recordBinding(binding) {
  return {
    path: binding.path,
    schema_version: binding.schema_version,
    record_id_field: binding.record_id_field,
    record_id: binding.record_id,
    byte_length: binding.byte_length,
    sha256: binding.sha256,
  };
}

function manifestRecordBinding() {
  return {
    path: MANIFEST_PATH,
    schema_version: MANIFEST_SCHEMA,
    record_id_field: 'manifest_id',
    record_id: EXPECTED_MANIFEST.manifest_id,
    byte_length: EXPECTED_MANIFEST.byte_length,
    sha256: EXPECTED_MANIFEST.sha256,
  };
}

function authorityRecordBinding() {
  return {
    path: AUTHORITY_PATH,
    schema_version: AUTHORITY_SCHEMA,
    record_id_field: 'authority_id',
    record_id: EXPECTED_AUTHORITY.authority_id,
    byte_length: EXPECTED_AUTHORITY.byte_length,
    sha256: EXPECTED_AUTHORITY.sha256,
  };
}

function indexMapFromInputs(manifest, records) {
  const result = new Map();
  for (const role of ['SAMPLED_SEALED_AGREEMENT_INDEX', 'SAMPLED_ADDITIVE_AGREEMENT_INDEX']) {
    for (const input of inputByRole(manifest, records, role)) {
      const agreementId = input.value?.source_binding?.agreement_id;
      if (!/^[0-9a-f]{64}$/.test(agreementId || '') || result.has(agreementId)) {
        fail('SAMPLE_IDENTITY_DRIFT', `agreement index ${input.binding.path}`);
      }
      result.set(agreementId, {
        value: input.value,
        binding: recordBinding(input.binding),
      });
    }
  }
  return result;
}

function spanBytes(index, span, label) {
  if (!span || span.coordinate_system !== 'UTF8_CANONICAL_TEXT_HALF_OPEN'
    || !Number.isInteger(span.start_byte) || !Number.isInteger(span.end_byte)
    || span.start_byte < 0 || span.end_byte < span.start_byte) {
    fail('SAMPLE_IDENTITY_DRIFT', `${label}: invalid span`);
  }
  const canonicalText = Buffer.from(index.source_binding.canonical_text, 'utf8');
  if (canonicalText.length !== index.source_binding.canonical_text_byte_length
    || sha256Hex(canonicalText) !== index.source_binding.canonical_text_sha256
    || span.end_byte > canonicalText.length) {
    fail('SAMPLE_IDENTITY_DRIFT', `${label}: canonical source drift`);
  }
  const selected = canonicalText.subarray(span.start_byte, span.end_byte);
  if (sha256Hex(selected) !== span.text_sha256) {
    fail('SAMPLE_IDENTITY_DRIFT', `${label}: slice hash drift`);
  }
  return selected;
}

function expectedFixedSampleMembers(reviewPacket, sourceIndexes) {
  if (!reviewPacket || !Array.isArray(reviewPacket.items)
    || reviewPacket.items.length !== COUNTS.fixed_sample_member_count) {
    fail('SAMPLE_IDENTITY_DRIFT', 'review packet items');
  }
  return reviewPacket.items.map((item, index) => {
    if (item.sample_ordinal !== index + 1) {
      fail('SAMPLE_IDENTITY_DRIFT', `packet ordinal ${index + 1}`);
    }
    const indexEntry = sourceIndexes.get(item.agreement_id);
    const agreementIndex = indexEntry?.value || indexEntry?.index || indexEntry;
    if (!agreementIndex || agreementIndex.source_binding?.agreement_id !== item.agreement_id) {
      fail('SAMPLE_IDENTITY_DRIFT', `agreement index ${item.agreement_id}`);
    }
    const sourceSpans = [];
    const selectedSourceBytes = [];
    let ambiguityId = null;
    if (item.item_kind === 'PARSER_AMBIGUITY') {
      ambiguityId = item.lineage?.ambiguity_id || null;
      const ambiguity = agreementIndex.ambiguities?.find((value) => value.ambiguity_id === ambiguityId);
      if (!ambiguity || !Array.isArray(ambiguity.node_occurrence_ids)
        || ambiguity.node_occurrence_ids.length !== 1
        || canonicalJson(ambiguity.span) !== canonicalJson(item.source_span)) {
        fail('SAMPLE_IDENTITY_DRIFT', `ambiguity ${ambiguityId}`);
      }
      selectedSourceBytes.push(
        spanBytes(agreementIndex, item.source_span, `ambiguity ${ambiguityId}`),
      );
      sourceSpans.push({
        source_node_occurrence_id: null,
        ...item.source_span,
      });
    } else {
      if (!Array.isArray(item.source_node_occurrence_ids)
        || item.source_node_occurrence_ids.length === 0) {
        fail('SAMPLE_IDENTITY_DRIFT', `source nodes ${item.sample_ordinal}`);
      }
      for (const nodeOccurrenceId of item.source_node_occurrence_ids) {
        const node = agreementIndex.nodes?.find(
          (value) => value.node_occurrence_id === nodeOccurrenceId,
        );
        if (!node) fail('SAMPLE_IDENTITY_DRIFT', `node ${nodeOccurrenceId}`);
        selectedSourceBytes.push(
          spanBytes(agreementIndex, node.extent_span, `node ${nodeOccurrenceId}`),
        );
        sourceSpans.push({
          source_node_occurrence_id: nodeOccurrenceId,
          ...node.extent_span,
        });
      }
    }
    const sourceBinding = agreementIndex.source_binding;
    if (!Buffer.concat(selectedSourceBytes).equals(Buffer.from(item.source_excerpt, 'utf8'))) {
      fail('SAMPLE_IDENTITY_DRIFT', `source excerpt ${item.sample_ordinal}`);
    }
    const agreementIndexBinding = indexEntry?.binding;
    if (!agreementIndexBinding) {
      fail('SAMPLE_IDENTITY_DRIFT', `agreement index binding ${item.agreement_id}`);
    }
    return {
      sample_ordinal: item.sample_ordinal,
      review_item_id: item.review_item_id,
      agreement_id: item.agreement_id,
      candidate_key: item.candidate_key,
      family_key: item.family_key,
      item_kind: item.item_kind,
      source_kind: item.source_kind,
      prior_row_id: item.row_id,
      source_node_occurrence_ids: item.source_node_occurrence_ids,
      ambiguity_id: ambiguityId,
      source_excerpt_sha256: sha256Hex(Buffer.from(item.source_excerpt, 'utf8')),
      agreement_index_binding: agreementIndexBinding,
      canonical_source_binding: {
        canonical_text_id: sourceBinding.canonical_text_id,
        canonical_text_byte_length: sourceBinding.canonical_text_byte_length,
        canonical_text_sha256: sourceBinding.canonical_text_sha256,
      },
      source_spans: sourceSpans,
    };
  });
}

export function validateFixedSampleIdentity({ record, reviewPacket, sourceIndexes }) {
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || !(sourceIndexes instanceof Map)) {
    fail('INVALID_OPTIONS', 'validateFixedSampleIdentity options');
  }
  const expectedMembers = expectedFixedSampleMembers(reviewPacket, sourceIndexes);
  same(record.members, expectedMembers, 'SAMPLE_IDENTITY_DRIFT', 'fixed sample members');
  const expectedCounts = {
    total_items: 50,
    source_to_row_items: reviewPacket.items.filter((item) => item.item_kind === 'SOURCE_TO_ROW').length,
    review_only_no_normal_row_items: reviewPacket.items
      .filter((item) => item.item_kind === 'REVIEW_ONLY_NO_NORMAL_ROW').length,
    parser_ambiguity_items: reviewPacket.items
      .filter((item) => item.item_kind === 'PARSER_AMBIGUITY').length,
    source_span_count: expectedMembers.reduce((total, member) => total + member.source_spans.length, 0),
    unique_agreement_count: new Set(reviewPacket.items.map((item) => item.agreement_id)).size,
  };
  same(record.counts, expectedCounts, 'SAMPLE_IDENTITY_DRIFT', 'fixed sample counts');
  return true;
}

function withSimpleId(body, idField) {
  return {
    ...body,
    [idField]: contentId(body.schema_version, body),
  };
}

function classByOrdinal() {
  const result = new Map();
  for (const [repairClass, ordinals] of Object.entries(REPAIR_CLASS_ORDINALS)) {
    for (const ordinal of ordinals) {
      if (result.has(ordinal)) fail('GENERATED_RECORD_DRIFT', `duplicate repair ordinal ${ordinal}`);
      result.set(ordinal, repairClass);
    }
  }
  if (result.size !== COUNTS.fixed_sample_member_count) {
    fail('COUNT_DRIFT', 'repair class ordinals');
  }
  return result;
}

function expectedFixedSampleRecord(manifest, records, sourceIndexes) {
  const policy = oneInputByRole(manifest, records, 'LAWYER_SAMPLE_POLICY');
  const packet = oneInputByRole(manifest, records, 'LAWYER_REVIEW_PACKET');
  const ledger = oneInputByRole(manifest, records, 'LAWYER_DECISION_LEDGER');
  const members = expectedFixedSampleMembers(packet.value, sourceIndexes);
  const body = {
    schema_version: FIXED_SAMPLE_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK0',
    state: 'FROZEN_RESAMPLE_REQUIRES_NEW_AUTHORITY',
    bootstrap_authority_binding: authorityRecordBinding(),
    pre_work0_manifest_binding: manifestRecordBinding(),
    lawyer_sample_policy_binding: recordBinding(policy.binding),
    lawyer_review_packet_binding: recordBinding(packet.binding),
    lawyer_decision_ledger_binding: recordBinding(ledger.binding),
    combined_ten_corpus_digest: packet.value.combined_ten_corpus_digest,
    counts: {
      total_items: 50,
      source_to_row_items: packet.value.items
        .filter((item) => item.item_kind === 'SOURCE_TO_ROW').length,
      review_only_no_normal_row_items: packet.value.items
        .filter((item) => item.item_kind === 'REVIEW_ONLY_NO_NORMAL_ROW').length,
      parser_ambiguity_items: packet.value.items
        .filter((item) => item.item_kind === 'PARSER_AMBIGUITY').length,
      source_span_count: members.reduce((total, member) => total + member.source_spans.length, 0),
      unique_agreement_count: new Set(packet.value.items.map((item) => item.agreement_id)).size,
    },
    members,
  };
  return withSimpleId(body, 'fixed_sample_identity_manifest_id');
}

function expectedBaselineRecord(manifest, records) {
  const packet = oneInputByRole(manifest, records, 'LAWYER_REVIEW_PACKET');
  const ledger = oneInputByRole(manifest, records, 'LAWYER_DECISION_LEDGER');
  const readableQa = oneInputByRole(manifest, records, 'READABLE_QA_TRANSCRIPT');
  const classes = classByOrdinal();
  if (ledger.value.decisions.length !== 50 || packet.value.items.length !== 50) {
    fail('COUNT_DRIFT', 'baseline source rows');
  }
  const entries = ledger.value.decisions.map((decision, index) => {
    const item = packet.value.items[index];
    if (decision.sample_ordinal !== index + 1 || item.sample_ordinal !== index + 1
      || decision.review_item_id !== item.review_item_id) {
      fail('GENERATED_RECORD_DRIFT', `baseline source ordinal ${index + 1}`);
    }
    const repairClass = classes.get(index + 1);
    const fresh = FRESH_QUESTION_ORDINALS.includes(index + 1);
    return {
      sample_ordinal: index + 1,
      review_item_id: item.review_item_id,
      lawyer_decision_id: decision.lawyer_decision_id,
      reviewer: decision.reviewer,
      original_decision: decision.decision,
      original_note: decision.note,
      repair_class: repairClass,
      repair_membership: repairClass === 'CLEAN_CONTROL' ? 'CONTROL' : 'REPAIR',
      requires_fresh_work5_question: fresh,
      fresh_work5_question_state: fresh
        ? 'REQUIRED_CONTRADICTORY_OR_INSUFFICIENT_RECORD'
        : 'NOT_REQUIRED_BY_WORK0',
    };
  });
  const repairClassCounts = Object.fromEntries(Object.keys(REPAIR_CLASS_ORDINALS)
    .map((repairClass) => [repairClass, entries.filter(
      (entry) => entry.repair_class === repairClass,
    ).length]));
  const body = {
    schema_version: BASELINE_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK0',
    state: 'FAILED_HUMAN_REVIEW_REPAIR_BASELINE_FROZEN',
    bootstrap_authority_binding: authorityRecordBinding(),
    pre_work0_manifest_binding: manifestRecordBinding(),
    lawyer_review_packet_binding: recordBinding(packet.binding),
    lawyer_decision_ledger_binding: recordBinding(ledger.binding),
    readable_qa_binding: recordBinding(readableQa.binding),
    gate_state: 'FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR',
    counts: {
      total_items: 50,
      repair_items: entries.filter((entry) => entry.repair_membership === 'REPAIR').length,
      control_items: entries.filter((entry) => entry.repair_membership === 'CONTROL').length,
      correct_decisions: entries.filter((entry) => entry.original_decision === 'CORRECT').length,
      incorrect_decisions: entries.filter((entry) => entry.original_decision === 'INCORRECT').length,
      fresh_work5_questions: entries.filter(
        (entry) => entry.requires_fresh_work5_question,
      ).length,
      repair_class_counts: repairClassCounts,
    },
    entries,
  };
  return withSimpleId(body, 'repair_baseline_ledger_id');
}

function expectedRulingMapRecord(manifest, records) {
  const programmeRulings = oneInputByRole(manifest, records, 'M5_PROGRAMME_RULINGS');
  const schemaReceipt = oneInputByRole(manifest, records, 'M5_PROGRAMME_RULING_SEAL_PROOF');
  const preparationReceipt = oneInputByRole(manifest, records, 'M5_PREPARATION_RECEIPT');
  if (!Array.isArray(programmeRulings.value.rulings)
    || programmeRulings.value.rulings.length !== COUNTS.programme_ruling_count) {
    fail('COUNT_DRIFT', 'programme rulings');
  }
  const rulingByQuestion = new Map(programmeRulings.value.rulings.map(
    (ruling) => [ruling.programme_question_id, ruling],
  ));
  const packInputs = inputByRole(manifest, records, 'M5_CALIBRATION_PACK');
  const families = packInputs.map((input) => {
    const pack = input.value;
    if (!Array.isArray(pack.narrow_legal_questions)
      || pack.narrow_legal_questions.length !== 3) {
      fail('COUNT_DRIFT', `calibration questions ${pack.family_key}`);
    }
    const questionMappings = pack.narrow_legal_questions.map((question, index) => {
      const programmeQuestionId = `PROGRAMME-Q${String(index + 1).padStart(2, '0')}`;
      const ruling = rulingByQuestion.get(programmeQuestionId);
      if (!ruling || question.question_id !== `${pack.family_key}-Q${String(index + 1).padStart(2, '0')}`) {
        fail('GENERATED_RECORD_DRIFT', `calibration question ${question.question_id}`);
      }
      return {
        family_question_id: question.question_id,
        question: question.question,
        historical_status: question.status,
        historical_ben_ruling_id: question.ben_ruling_id,
        programme_question_id: programmeQuestionId,
        ruling_id: ruling.ruling_id,
        selection: ruling.selection,
        legal_rule: ruling.legal_rule,
      };
    });
    return {
      family_key: pack.family_key,
      wave: pack.wave,
      calibration_pack_binding: recordBinding(input.binding),
      question_mappings: questionMappings,
    };
  }).sort((left, right) => (
    left.family_key < right.family_key ? -1 : left.family_key > right.family_key ? 1 : 0
  ));
  const body = {
    schema_version: RULING_MAP_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK0',
    state: 'SEALED_PROGRAMME_RULINGS_REBOUND_NO_HISTORICAL_PACK_REWRITE',
    bootstrap_authority_binding: authorityRecordBinding(),
    pre_work0_manifest_binding: manifestRecordBinding(),
    programme_ruling_binding: recordBinding(programmeRulings.binding),
    schema_approval_receipt_binding: recordBinding(schemaReceipt.binding),
    m5_preparation_receipt_binding: recordBinding(preparationReceipt.binding),
    counts: {
      family_count: families.length,
      question_count: families.reduce((total, family) => total + family.question_mappings.length, 0),
      programme_ruling_count: programmeRulings.value.rulings.length,
    },
    families,
  };
  return withSimpleId(body, 'calibration_question_ruling_map_id');
}

function expectedSupersessionRecord(manifest, records) {
  const m6Receipt = oneInputByRole(manifest, records, 'M6_FINAL_V1_RECEIPT');
  const m7Receipt = oneInputByRole(manifest, records, 'M7_FINAL_ADDITIVE_RECEIPT');
  const supersessionState = 'FAILED_HUMAN_REVIEW_NOT_CONSUMABLE';
  const analysisInputs = inputByRole(manifest, records, 'FAILED_M5_V1_ANALYSIS');
  const projectionInputs = inputByRole(manifest, records, 'FAILED_M6_V1_PROJECTION');
  const supportInputs = inputByRole(manifest, records, 'FAILED_M6_V1_SUPPORT');
  const projectionByAgreement = new Map(projectionInputs.map(
    (input) => [input.value.agreement_id, input],
  ));
  const analysisRegistrations = [];
  const projectionRegistrations = [];
  const rowRegistrations = [];
  for (const input of analysisInputs) {
    const analysis = input.value;
    const projectionInput = projectionByAgreement.get(analysis.agreement_id);
    const projection = projectionInput?.value;
    if (!projection || projection.agreement_analysis_id !== analysis.agreement_analysis_id) {
      fail('GENERATED_RECORD_DRIFT', `legacy pair ${analysis.agreement_id}`);
    }
    const propositionIds = new Set(
      analysis.compound_propositions.map((entry) => entry.compound_proposition_id),
    );
    const rowPropositionIds = new Set(
      projection.rows.map((row) => row.source_compound_proposition_id),
    );
    const omissionByRow = new Map(projection.omissions.map((entry) => [entry.row_id, entry]));
    if (propositionIds.size !== analysis.compound_propositions.length
      || rowPropositionIds.size !== projection.rows.length
      || propositionIds.size !== rowPropositionIds.size
      || [...propositionIds].some((id) => !rowPropositionIds.has(id))
      || projection.review_rows.length !== 0
      || projection.rows.length !== projection.omissions.length
      || omissionByRow.size !== projection.omissions.length) {
      fail('GENERATED_RECORD_DRIFT', `legacy coverage ${analysis.agreement_id}`);
    }
    for (const row of projection.rows) {
      const omission = omissionByRow.get(row.row_id);
      if (omission?.compound_proposition_id !== row.source_compound_proposition_id) {
        fail('GENERATED_RECORD_DRIFT', `legacy omission ${row.row_id}`);
      }
      rowRegistrations.push({
        agreement_id: row.agreement_id,
        agreement_projection_id: projection.agreement_projection_id,
        row_id: row.row_id,
        source_compound_proposition_id: row.source_compound_proposition_id,
        family_key: row.family_key,
        row_state: row.row_state,
        supersession_state: supersessionState,
        v2_admissible: false,
      });
    }
    analysisRegistrations.push({
      agreement_id: analysis.agreement_id,
      agreement_analysis_id: analysis.agreement_analysis_id,
      binding: recordBinding(input.binding),
      compound_proposition_count: analysis.compound_propositions.length,
      supersession_state: supersessionState,
      v2_admissible: false,
    });
    projectionRegistrations.push({
      agreement_id: projection.agreement_id,
      agreement_projection_id: projection.agreement_projection_id,
      agreement_analysis_id: projection.agreement_analysis_id,
      binding: recordBinding(projectionInput.binding),
      normal_row_count: projection.rows.length,
      omission_record_count: projection.omissions.length,
      review_row_count: projection.review_rows.length,
      supersession_state: supersessionState,
      v2_admissible: false,
    });
  }
  const supportLedgerBindings = supportInputs.map((input) => ({
    role: basename(input.binding.path, '.json').replaceAll('-', '_').toUpperCase(),
    binding: recordBinding(input.binding),
    supersession_state: supersessionState,
    v2_admissible: false,
  }));
  const body = {
    schema_version: SUPERSESSION_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK0',
    state: supersessionState,
    bootstrap_authority_binding: authorityRecordBinding(),
    pre_work0_manifest_binding: manifestRecordBinding(),
    m6_receipt_binding: recordBinding(m6Receipt.binding),
    m7_additive_receipt_binding: recordBinding(m7Receipt.binding),
    v2_consumer_gate: {
      v1_semantic_admission: 'FORBIDDEN',
      active_m7_v2_dispatch_count: 0,
      enforcement_state: 'AUTHORITY_REJECTS_V1_INPUT',
    },
    counts: {
      analysis_files: analysisRegistrations.length,
      projection_files: projectionRegistrations.length,
      compound_propositions: analysisRegistrations.reduce(
        (total, entry) => total + entry.compound_proposition_count,
        0,
      ),
      normal_rows: projectionRegistrations.reduce(
        (total, entry) => total + entry.normal_row_count,
        0,
      ),
      omission_records: projectionRegistrations.reduce(
        (total, entry) => total + entry.omission_record_count,
        0,
      ),
      support_ledgers: supportLedgerBindings.length,
    },
    analysis_registrations: analysisRegistrations,
    projection_registrations: projectionRegistrations,
    support_ledger_bindings: supportLedgerBindings,
    row_registrations: rowRegistrations,
  };
  return withSimpleId(body, 'legacy_output_supersession_ledger_id');
}

function expectedGeneratedRecords(manifest, records) {
  const sourceIndexes = indexMapFromInputs(manifest, records);
  return {
    fixed: expectedFixedSampleRecord(manifest, records, sourceIndexes),
    baseline: expectedBaselineRecord(manifest, records),
    rulingMap: expectedRulingMapRecord(manifest, records),
    supersession: expectedSupersessionRecord(manifest, records),
    sourceIndexes,
  };
}

function validateGeneratedRecords(generated, expected, manifest, records) {
  const packet = oneInputByRole(manifest, records, 'LAWYER_REVIEW_PACKET').value;
  validateFixedSampleIdentity({
    record: generated.fixed.value,
    reviewPacket: packet,
    sourceIndexes: expected.sourceIndexes,
  });
  const pairs = [
    ['fixed sample', generated.fixed, expected.fixed, OUTPUT_CONTRACTS[0], 'SAMPLE_IDENTITY_DRIFT'],
    ['repair baseline', generated.baseline, expected.baseline, OUTPUT_CONTRACTS[1], 'GENERATED_RECORD_DRIFT'],
    ['ruling map', generated.rulingMap, expected.rulingMap, OUTPUT_CONTRACTS[2], 'GENERATED_RECORD_DRIFT'],
    ['supersession ledger', generated.supersession, expected.supersession, OUTPUT_CONTRACTS[3], 'GENERATED_RECORD_DRIFT'],
  ];
  for (const [label, actual, wanted, contract, semanticCode] of pairs) {
    if (!actual.bytes.equals(canonicalRecordBytes(actual.value))) {
      fail('CANONICAL_JSON_DRIFT', label);
    }
    const actualUnsigned = structuredClone(actual.value);
    delete actualUnsigned[contract.id_field];
    const wantedUnsigned = structuredClone(wanted);
    delete wantedUnsigned[contract.id_field];
    same(actualUnsigned, wantedUnsigned, semanticCode, label);
    validateCanonicalRecord({
      record: actual.value,
      bytes: actual.bytes,
      schemaVersion: contract.schema_version,
      idField: contract.id_field,
    });
    if (actual.value[contract.id_field] !== wanted[contract.id_field]) {
      fail('RECORD_IDENTITY_DRIFT', label);
    }
  }
  if (generated.fixed.value.counts.total_items !== COUNTS.fixed_sample_member_count
    || generated.baseline.value.counts.repair_items !== COUNTS.repair_item_count
    || generated.baseline.value.counts.control_items !== COUNTS.control_item_count
    || generated.rulingMap.value.counts.family_count !== COUNTS.calibration_family_count
    || generated.rulingMap.value.counts.question_count !== COUNTS.calibration_question_count
    || generated.supersession.value.counts.normal_rows !== COUNTS.legacy_row_registration_count) {
    fail('COUNT_DRIFT', 'generated record counts');
  }
  return true;
}

function validateCoreStatusDocs(files) {
  for (const [repositoryPath, contract] of Object.entries(CORE_STATUS_CONTRACTS)) {
    const bytes = files.get(repositoryPath);
    if (!Buffer.isBuffer(bytes)
      || bytes.length !== contract.byte_length
      || sha256Hex(bytes) !== contract.sha256) {
      fail('CORE_STATUS_DRIFT', repositoryPath);
    }
    const text = bytes.toString('utf8');
    if (contract.required_text.some((required) => !text.includes(required))) {
      fail('CORE_STATUS_DRIFT', `${repositoryPath}: required state`);
    }
  }
  return true;
}

function literalModuleSpecifiers(source) {
  const result = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) result.push(match[1]);
  }
  return [...new Set(result)];
}

function validateStaticDependencies(files) {
  const scriptPaths = [FINALISER_PATH, VALIDATOR_PATH];
  const allowedCanonical = new Set([
    '../lib/canonical-v2/canonical-bytes',
    '../lib/canonical-v2/canonical-bytes.js',
  ]);
  for (const repositoryPath of [...scriptPaths, TEST_PATH]) {
    const bytes = files.get(repositoryPath);
    if (!Buffer.isBuffer(bytes)) {
      fail('STATIC_DEPENDENCY_VIOLATION', `missing source ${repositoryPath}`);
    }
    const source = bytes.toString('utf8');
    const specifiers = literalModuleSpecifiers(source);
    for (const specifier of specifiers) {
      const allowed = specifier.startsWith('node:')
        || allowedCanonical.has(specifier)
        || (repositoryPath === TEST_PATH && new Set([
          '../scripts/stage-2y-structure-m7-v2-repair-work0-finalise.mjs',
          '../scripts/stage-2y-structure-m7-v2-repair-work0-validate.mjs',
        ]).has(specifier));
      if (!allowed) {
        fail('STATIC_DEPENDENCY_VIOLATION', `${repositoryPath}: ${specifier}`);
      }
      if (/family-compound-adapter|agreement-projection|m7-deterministic-generalisation/i
        .test(specifier)) {
        fail('STATIC_DEPENDENCY_VIOLATION', `${repositoryPath}: semantic module`);
      }
      if (/openai|anthropic|ollama|langchain|postgres|sqlite|mysql|mongodb|supabase|fetch|axios/i
        .test(specifier)) {
        fail('STATIC_DEPENDENCY_VIOLATION', `${repositoryPath}: external dependency`);
      }
    }
    const nonLiteralDynamicImports = [...source.matchAll(/\bimport\s*\(([^)]*)\)/g)]
      .filter((match) => !/^\s*['"][^'"]+['"]\s*$/.test(match[1]));
    if (nonLiteralDynamicImports.length > 0) {
      fail('STATIC_DEPENDENCY_VIOLATION', `${repositoryPath}: dynamic import`);
    }
    if (scriptPaths.includes(repositoryPath)) {
      const shellCalls = [...source.matchAll(/\bexecFileSync\s*\(\s*['"]([^'"]+)['"]/g)]
        .map((match) => match[1]);
      if (shellCalls.some((command) => command !== 'git')) {
        fail('STATIC_DEPENDENCY_VIOLATION', `${repositoryPath}: external command`);
      }
    }
  }
  return true;
}

function gitText(root, args, code) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    fail(code, `${args.join(' ')}: ${error.message}`);
  }
}

function currentHead(root) {
  return gitText(root, ['rev-parse', 'HEAD'], 'FINALISATION_DELTA_DRIFT').trim();
}

function repositoryDelta(root) {
  const paths = new Set(gitText(
    root,
    ['diff', '--name-only', BASE_COMMIT],
    'FINALISATION_DELTA_DRIFT',
  ).split('\n').filter(Boolean));
  const status = gitText(
    root,
    ['status', '--short', '--branch'],
    'FINALISATION_DELTA_DRIFT',
  );
  for (const line of status.split('\n')) {
    if (!line || line.startsWith('## ')) continue;
    if (line.length < 4) fail('FINALISATION_DELTA_DRIFT', `invalid status: ${line}`);
    const repositoryPath = line.slice(3);
    if (repositoryPath.includes(' -> ') || repositoryPath.startsWith('"')) {
      fail('FINALISATION_DELTA_DRIFT', `unsupported status path: ${repositoryPath}`);
    }
    paths.add(repositoryPath);
  }
  return [...paths];
}

function stagedPaths(root) {
  return gitText(
    root,
    ['diff', '--cached', '--name-only'],
    'STAGED_ALLOWLIST_DRIFT',
  ).split('\n').filter(Boolean);
}

function indexBlobBinding(root, repositoryPath) {
  const line = gitText(
    root,
    ['ls-files', '-s', '--', repositoryPath],
    'SNAPSHOT_BINDING_DRIFT',
  ).trim();
  const match = line.match(/^100644 ([0-9a-f]{40}|[0-9a-f]{64}) 0\t(.+)$/);
  if (!match || match[2] !== repositoryPath) {
    fail('SNAPSHOT_BINDING_DRIFT', `${repositoryPath}: staged blob`);
  }
  return { path: repositoryPath, git_blob_oid: match[1] };
}

function expectedCommitBlobBindings(authority, snapshotBindings, receipt, objectFormat) {
  const byPath = new Map(snapshotBindings.map((binding) => [binding.path, binding.git_blob_oid]));
  byPath.set(RECEIPT_PATH, gitBlobOid(canonicalRecordBytes(receipt), objectFormat));
  return authority.permitted_commit_paths.map((repositoryPath) => {
    const gitObjectId = byPath.get(repositoryPath);
    if (!gitObjectId) fail('SNAPSHOT_BINDING_DRIFT', `${repositoryPath}: expected blob`);
    return { path: repositoryPath, git_blob_oid: gitObjectId };
  });
}

function validateFinalisationDelta(root, authority, {
  receiptPresent,
  snapshotBindings = null,
  receipt = null,
  objectFormat = null,
}) {
  const expected = authority.permitted_commit_paths.filter(
    (repositoryPath) => receiptPresent || repositoryPath !== RECEIPT_PATH,
  );
  validateStagedAllowlist({ actual: repositoryDelta(root), expected });
  const staged = stagedPaths(root);
  const validStagedSets = receiptPresent
    ? [[], authority.permitted_commit_paths]
    : [[]];
  if (!validStagedSets.some((candidate) => (
    canonicalJson([...candidate].sort()) === canonicalJson([...staged].sort())
  ))) {
    fail('STAGED_ALLOWLIST_DRIFT', 'staged index does not match finalisation state');
  }
  if (staged.length === authority.permitted_commit_paths.length) {
    if (!snapshotBindings || !receipt || !objectFormat) {
      fail('SNAPSHOT_BINDING_DRIFT', 'staged snapshot context absent');
    }
    const expectedBlobs = expectedCommitBlobBindings(
      authority,
      snapshotBindings,
      receipt,
      objectFormat,
    );
    const actualBlobs = authority.permitted_commit_paths.map(
      (repositoryPath) => indexBlobBinding(root, repositoryPath),
    );
    validateIndexBlobBindings({ actual: actualBlobs, expected: expectedBlobs });
  }
  const laterAuthority = worktreeLaterAuthorityPaths(root);
  if (laterAuthority.length > 0) {
    fail('FINALISATION_DELTA_DRIFT', `later authority present: ${laterAuthority.join(',')}`);
  }
  try {
    execFileSync('git', ['diff', '--check'], { cwd: root, encoding: 'utf8' });
  } catch (error) {
    fail('FINALISATION_DELTA_DRIFT', `git diff --check: ${error.message}`);
  }
  return true;
}

function commitTreeBlobBinding(root, commit, repositoryPath) {
  const line = gitText(
    root,
    ['ls-tree', commit, '--', repositoryPath],
    'SNAPSHOT_BINDING_DRIFT',
  ).trim();
  const match = line.match(/^100644 blob ([0-9a-f]{40}|[0-9a-f]{64})\t(.+)$/);
  if (!match || match[2] !== repositoryPath) {
    fail('SNAPSHOT_BINDING_DRIFT', `${repositoryPath}: Work 0 commit tree blob`);
  }
  return { path: repositoryPath, git_blob_oid: match[1] };
}

function validatePersistentCommitTree(root, authority, snapshotBindings, receipt, objectFormat) {
  const work0Commit = gitText(
    root,
    ['rev-list', '-1', 'HEAD', '--', RECEIPT_PATH],
    'SNAPSHOT_BINDING_DRIFT',
  ).trim();
  requireGitObjectId(work0Commit, 'SNAPSHOT_BINDING_DRIFT', 'Work 0 commit');
  const ancestry = gitText(
    root,
    ['rev-list', '--parents', '-n', '1', work0Commit],
    'SNAPSHOT_BINDING_DRIFT',
  ).trim().split(/\s+/);
  if (ancestry.length !== 2 || ancestry[0] !== work0Commit || ancestry[1] !== BASE_COMMIT) {
    fail('SNAPSHOT_BINDING_DRIFT', 'Work 0 commit must have the adopted base as its sole parent');
  }
  const expectedBlobs = expectedCommitBlobBindings(
    authority,
    snapshotBindings,
    receipt,
    objectFormat,
  );
  const actualBlobs = authority.permitted_commit_paths.map(
    (repositoryPath) => commitTreeBlobBinding(root, work0Commit, repositoryPath),
  );
  validateIndexBlobBindings({ actual: actualBlobs, expected: expectedBlobs });
  const committedDelta = gitText(
    root,
    ['diff-tree', '--no-commit-id', '--name-only', '-r', work0Commit],
    'SNAPSHOT_BINDING_DRIFT',
  ).split('\n').filter(Boolean);
  validateStagedAllowlist({ actual: committedDelta, expected: authority.permitted_commit_paths });
  return true;
}

function readHeadBytes(root, repositoryPath) {
  try {
    return execFileSync('git', ['show', `HEAD:${repositoryPath}`], {
      cwd: root,
      encoding: null,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    fail('LATER_AUTHORITY_DRIFT', `${repositoryPath}: ${error.message}`);
  }
}

function worktreeLaterAuthorityPaths(root, directoryPath = `${MIGRATION_ROOT}/control`) {
  const absoluteDirectory = exactPath(root, directoryPath);
  let directoryStat;
  try {
    directoryStat = lstatSync(absoluteDirectory);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    fail('LATER_AUTHORITY_DRIFT', `${directoryPath}: ${error.message}`);
  }
  if (directoryStat.isSymbolicLink()) {
    fail('LATER_AUTHORITY_DRIFT', `${directoryPath}: symlink control directory`);
  }
  if (!directoryStat.isDirectory()) {
    fail('LATER_AUTHORITY_DRIFT', `${directoryPath}: control path is not a directory`);
  }
  let directoryEntries;
  try {
    directoryEntries = readdirSync(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    fail('LATER_AUTHORITY_DRIFT', `${directoryPath}: ${error.message}`);
  }
  const result = [];
  for (const entry of directoryEntries) {
    const repositoryPath = `${directoryPath}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      if (LATER_AUTHORITY_PATH_PATTERN.test(repositoryPath)) {
        fail('LATER_AUTHORITY_DRIFT', `${repositoryPath}: symlink authority path`);
      }
      continue;
    }
    if (entry.isDirectory()) {
      result.push(...worktreeLaterAuthorityPaths(root, repositoryPath));
    } else if (entry.isFile()
      && LATER_AUTHORITY_PATH_PATTERN.test(repositoryPath)) {
      result.push(repositoryPath);
    }
  }
  return result;
}

function currentLaterAuthorityRecords(root) {
  const records = new Map();
  const committedPaths = gitText(
    root,
    ['ls-tree', '-r', '--name-only', 'HEAD', '--', `${MIGRATION_ROOT}/control`],
    'LATER_AUTHORITY_DRIFT',
  ).split('\n').filter(
    (repositoryPath) => LATER_AUTHORITY_PATH_PATTERN.test(repositoryPath),
  );
  for (const repositoryPath of committedPaths) {
    records.set(repositoryPath, readHeadBytes(root, repositoryPath));
  }
  const worktreePaths = worktreeLaterAuthorityPaths(root).sort();
  for (const repositoryPath of worktreePaths) {
    const bytes = readCurrentBytes(root, repositoryPath);
    const committed = records.get(repositoryPath);
    if (committed && !committed.equals(bytes)) {
      fail('LATER_AUTHORITY_DRIFT', `${repositoryPath}: committed/worktree byte mismatch`);
    }
    records.set(repositoryPath, bytes);
  }
  return [...records.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([repositoryPath, bytes]) => ({ path: repositoryPath, bytes }));
}

function snapshotMetadata(repositoryPath, value = null) {
  if (repositoryPath === MANIFEST_PATH) {
    return {
      schema_version: MANIFEST_SCHEMA,
      record_id_field: 'manifest_id',
      record_id: EXPECTED_MANIFEST.manifest_id,
    };
  }
  if (repositoryPath === AUTHORITY_PATH) {
    return {
      schema_version: AUTHORITY_SCHEMA,
      record_id_field: 'authority_id',
      record_id: EXPECTED_AUTHORITY.authority_id,
    };
  }
  const output = OUTPUT_CONTRACTS.find((contract) => contract.path === repositoryPath);
  if (output) {
    if (!value || value.schema_version !== output.schema_version
      || value[output.id_field] !== simpleRecordId(value, output.id_field)) {
      fail('SNAPSHOT_BINDING_DRIFT', `${repositoryPath}: record metadata`);
    }
    return {
      schema_version: output.schema_version,
      record_id_field: output.id_field,
      record_id: value[output.id_field],
    };
  }
  return {
    schema_version: null,
    record_id_field: null,
    record_id: null,
  };
}

function snapshotBinding(repositoryPath, bytes, objectFormat) {
  let value = null;
  if (repositoryPath.endsWith('.json')) {
    value = parseJsonBytes(bytes, 'SNAPSHOT_BINDING_DRIFT', repositoryPath);
  }
  return {
    path: repositoryPath,
    ...snapshotMetadata(repositoryPath, value),
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes, objectFormat),
  };
}

function validateSnapshotBinding(binding, bytes, repositoryPath, objectFormat) {
  exactKeys(binding, SNAPSHOT_BINDING_KEYS, 'SNAPSHOT_BINDING_DRIFT', repositoryPath);
  if (binding.path !== repositoryPath
    || binding.byte_length !== bytes.length
    || binding.sha256 !== sha256Hex(bytes)
    || binding.git_blob_oid !== gitBlobOid(bytes, objectFormat)) {
    fail('SNAPSHOT_BINDING_DRIFT', repositoryPath);
  }
  let value = null;
  if (repositoryPath.endsWith('.json')) {
    value = parseJsonBytes(bytes, 'SNAPSHOT_BINDING_DRIFT', repositoryPath);
  }
  same({
    schema_version: binding.schema_version,
    record_id_field: binding.record_id_field,
    record_id: binding.record_id,
  }, snapshotMetadata(repositoryPath, value), 'SNAPSHOT_BINDING_DRIFT', `${repositoryPath}: metadata`);
  return true;
}

function currentSnapshotFiles(root) {
  return new Map(EXPECTED_SNAPSHOT_PATHS.map(
    (repositoryPath) => [repositoryPath, readCurrentBytes(root, repositoryPath)],
  ));
}

function snapshotBindingsFromFiles(files, objectFormat) {
  return EXPECTED_SNAPSHOT_PATHS.map((repositoryPath) => {
    const bytes = files.get(repositoryPath);
    if (!Buffer.isBuffer(bytes)) fail('SNAPSHOT_BINDING_DRIFT', repositoryPath);
    return snapshotBinding(repositoryPath, bytes, objectFormat);
  });
}

function validatePreliminaryReceipt(bytes) {
  const receipt = parseJsonBytes(bytes, 'RECEIPT_IDENTITY_DRIFT', RECEIPT_PATH);
  if (!bytes.equals(canonicalRecordBytes(receipt))) {
    fail('CANONICAL_JSON_DRIFT', RECEIPT_PATH);
  }
  exactKeys(receipt, RECEIPT_KEYS, 'RECEIPT_IDENTITY_DRIFT', 'receipt members');
  if (receipt.schema_version !== RECEIPT_SCHEMA
    || receipt.evidence_root_id !== simpleRecordId(receipt, 'evidence_root_id')) {
    fail('RECEIPT_IDENTITY_DRIFT', RECEIPT_PATH);
  }
  if (!Array.isArray(receipt.snapshot_bindings)
    || receipt.snapshot_bindings.length !== COUNTS.snapshot_binding_count
    || canonicalJson(receipt.snapshot_bindings.map((binding) => binding.path))
      !== canonicalJson(EXPECTED_SNAPSHOT_PATHS)) {
    fail('SNAPSHOT_BINDING_DRIFT', 'receipt snapshot paths');
  }
  return receipt;
}

function persistentSnapshotFiles(root, receipt, objectFormat) {
  const files = new Map();
  for (let index = 0; index < EXPECTED_SNAPSHOT_PATHS.length; index += 1) {
    const repositoryPath = EXPECTED_SNAPSHOT_PATHS[index];
    const binding = receipt.snapshot_bindings[index];
    const bytes = readGitBlob(root, binding.git_blob_oid);
    validateSnapshotBinding(binding, bytes, repositoryPath, objectFormat);
    files.set(repositoryPath, bytes);
  }
  return files;
}

function generatedFromFiles(files) {
  const entries = OUTPUT_CONTRACTS.map((contract) => {
    const bytes = files.get(contract.path);
    if (!Buffer.isBuffer(bytes)) fail('GENERATED_RECORD_DRIFT', contract.path);
    return [contract.path, {
      bytes,
      value: parseJsonBytes(bytes, 'GENERATED_RECORD_DRIFT', contract.path),
    }];
  });
  const byPath = new Map(entries);
  return {
    fixed: byPath.get(FIXED_SAMPLE_PATH),
    baseline: byPath.get(BASELINE_PATH),
    rulingMap: byPath.get(RULING_MAP_PATH),
    supersession: byPath.get(SUPERSESSION_PATH),
  };
}

function work0Bindings(snapshotBindings) {
  return OUTPUT_CONTRACTS.map((contract) => {
    const binding = snapshotBindings.find((candidate) => candidate.path === contract.path);
    if (!binding) fail('SNAPSHOT_BINDING_DRIFT', contract.path);
    return binding;
  });
}

function buildReceipt({ manifest, authority, snapshotBindings }) {
  const unsigned = {
    schema_version: RECEIPT_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK0',
    lifecycle_state: 'SEALED_WORK0_ONLY',
    status: 'PASS_WORK0_EVIDENCE_ROOT_ONLY',
    base_commit: BASE_COMMIT,
    activation_confirmation: EXPECTED_ACTIVATION,
    pre_work0_manifest_binding: manifestRecordBinding(),
    bootstrap_authority_binding: authorityRecordBinding(),
    evidence_input_bindings: manifest.input_bindings,
    input_set_digest: manifest.input_set_digest,
    work0_record_bindings: work0Bindings(snapshotBindings),
    snapshot_bindings: snapshotBindings,
    snapshot_set_digest: sha256Hex(canonicalJson(snapshotBindings)),
    counts: COUNTS,
    effects: authority.zero_effect_expectations,
    checks: CHECK_IDS.map((check_id) => ({ check_id, status: 'PASS' })),
    next_authority: NEXT_AUTHORITY,
  };
  return {
    schema_version: RECEIPT_SCHEMA,
    evidence_root_id: contentId(RECEIPT_SCHEMA, unsigned),
    ...Object.fromEntries(Object.entries(unsigned).filter(([key]) => key !== 'schema_version')),
  };
}

function validateReceipt(receipt, expected, snapshotFiles, objectFormat) {
  exactKeys(receipt, RECEIPT_KEYS, 'RECEIPT_IDENTITY_DRIFT', 'receipt members');
  for (let index = 0; index < expected.snapshot_bindings.length; index += 1) {
    const binding = receipt.snapshot_bindings[index];
    const repositoryPath = EXPECTED_SNAPSHOT_PATHS[index];
    validateSnapshotBinding(binding, snapshotFiles.get(repositoryPath), repositoryPath, objectFormat);
  }
  same(receipt, expected, 'RECEIPT_IDENTITY_DRIFT', 'receipt content');
  if (receipt.evidence_root_id !== simpleRecordId(receipt, 'evidence_root_id')) {
    fail('RECEIPT_IDENTITY_DRIFT', 'receipt self identity');
  }
  return true;
}

function validateActivationConfirmation(value) {
  exactKeys(value, [
    'state',
    'approver',
    'confirmed_on',
    'verbatim_confirmation',
    'authority_binding',
    'manifest_binding',
  ], 'ACTIVATION_CONFIRMATION_DRIFT', 'activation confirmation members');
  same(value, EXPECTED_ACTIVATION, 'ACTIVATION_CONFIRMATION_DRIFT', 'activation confirmation');
  return true;
}

function validateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail('INVALID_OPTIONS', 'validateWork0 options');
  }
  exactKeys(options, ['repoRoot', 'writeReceipt'], 'INVALID_OPTIONS', 'validateWork0 options');
  if (options.writeReceipt !== true && options.writeReceipt !== false) {
    fail('INVALID_OPTIONS', 'writeReceipt must be boolean');
  }
}

function removeCreatedReceipt(absolutePath, priorError) {
  try {
    unlinkSync(absolutePath);
  } catch (cleanupError) {
    fail('FINALISATION_DELTA_DRIFT',
      `receipt cleanup failed after ${priorError.message}: ${cleanupError.message}`);
  }
}

function writeReceiptExclusive(absolutePath, bytes) {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) {
    fail('FINALISATION_DELTA_DRIFT', 'O_NOFOLLOW is unavailable');
  }
  let descriptor = null;
  let created = false;
  try {
    descriptor = openSync(
      absolutePath,
      fsConstants.O_WRONLY
        | fsConstants.O_CREAT
        | fsConstants.O_EXCL
        | fsConstants.O_NOFOLLOW,
      0o644,
    );
    created = true;
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (!Number.isInteger(written) || written <= 0) {
        fail('FINALISATION_DELTA_DRIFT', 'receipt write made no progress');
      }
      offset += written;
    }
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
  } catch (error) {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch {
        // Cleanup below is the fail-closed operation.
      }
    }
    if (created) removeCreatedReceipt(absolutePath, error);
    if (error instanceof Work0ValidationError) throw error;
    fail('FINALISATION_DELTA_DRIFT', `cannot write receipt: ${error.message}`);
  }
  return true;
}

export function validateWork0(options) {
  validateOptions(options);
  const root = normaliseRoot(options.repoRoot);
  const receiptAbsolutePath = exactPath(root, RECEIPT_PATH);
  const receiptPresent = existsSync(receiptAbsolutePath);
  const objectFormat = gitObjectFormat(root);
  const head = currentHead(root);
  let existingReceipt = null;
  let existingReceiptBytes = null;
  let snapshotFiles;

  if (receiptPresent) {
    existingReceiptBytes = readCurrentBytes(root, RECEIPT_PATH, 'RECEIPT_IDENTITY_DRIFT');
    existingReceipt = validatePreliminaryReceipt(existingReceiptBytes);
    if (head === BASE_COMMIT) {
      snapshotFiles = currentSnapshotFiles(root);
      for (let index = 0; index < EXPECTED_SNAPSHOT_PATHS.length; index += 1) {
        validateSnapshotBinding(
          existingReceipt.snapshot_bindings[index],
          snapshotFiles.get(EXPECTED_SNAPSHOT_PATHS[index]),
          EXPECTED_SNAPSHOT_PATHS[index],
          objectFormat,
        );
      }
    } else {
      snapshotFiles = persistentSnapshotFiles(root, existingReceipt, objectFormat);
    }
  } else {
    if (head !== BASE_COMMIT) {
      fail('FINALISATION_DELTA_DRIFT', 'receipt absent outside adopted base commit');
    }
    snapshotFiles = currentSnapshotFiles(root);
  }

  const manifest = validateManifest(snapshotFiles.get(MANIFEST_PATH));
  const authority = validateAuthority(snapshotFiles.get(AUTHORITY_PATH), manifest);
  validateActivationConfirmation(EXPECTED_ACTIVATION);
  const baseRecords = validateBaseInputs(root, manifest);
  const expectedGenerated = expectedGeneratedRecords(manifest, baseRecords);
  const generated = generatedFromFiles(snapshotFiles);
  validateGeneratedRecords(generated, expectedGenerated, manifest, baseRecords);
  validateCoreStatusDocs(snapshotFiles);
  validateStaticDependencies(snapshotFiles);

  const snapshotBindings = snapshotBindingsFromFiles(snapshotFiles, objectFormat);
  const proposedReceipt = buildReceipt({ manifest, authority, snapshotBindings });
  validateActivationConfirmation(proposedReceipt.activation_confirmation);
  same(proposedReceipt.counts, COUNTS, 'COUNT_DRIFT', 'receipt counts');
  same(proposedReceipt.effects, authority.zero_effect_expectations,
    'ZERO_EFFECT_VIOLATION', 'receipt effects');

  let mode;
  if (existingReceipt) {
    validateReceipt(existingReceipt, proposedReceipt, snapshotFiles, objectFormat);
    if (head === BASE_COMMIT) {
      validateFinalisationDelta(root, authority, {
        receiptPresent: true,
        snapshotBindings,
        receipt: existingReceipt,
        objectFormat,
      });
    } else {
      validatePersistentCommitTree(
        root,
        authority,
        snapshotBindings,
        existingReceipt,
        objectFormat,
      );
      validateLaterAuthority({
        authorityRecords: currentLaterAuthorityRecords(root),
        receipt: existingReceipt,
        receiptBytes: existingReceiptBytes,
      });
    }
    mode = 'PERSISTENT_READ_ONLY';
  } else {
    validateFinalisationDelta(root, authority, {
      receiptPresent: false,
      snapshotBindings,
      receipt: proposedReceipt,
      objectFormat,
    });
    if (options.writeReceipt) {
      assertNoSymlink(root, receiptAbsolutePath, { allowMissing: true });
      const proposedReceiptBytes = canonicalRecordBytes(proposedReceipt);
      writeReceiptExclusive(receiptAbsolutePath, proposedReceiptBytes);
      try {
        const writtenBytes = readCurrentBytes(root, RECEIPT_PATH, 'RECEIPT_IDENTITY_DRIFT');
        if (!writtenBytes.equals(proposedReceiptBytes)) {
          fail('RECEIPT_IDENTITY_DRIFT', 'receipt changed after exclusive write');
        }
        validateFinalisationDelta(root, authority, {
          receiptPresent: true,
          snapshotBindings,
          receipt: proposedReceipt,
          objectFormat,
        });
      } catch (error) {
        removeCreatedReceipt(receiptAbsolutePath, error);
        throw error;
      }
      mode = 'FINALISATION_WRITTEN';
    } else {
      mode = 'FINALISATION_PREVIEW';
    }
  }

  return {
    ok: true,
    mode,
    receipt_path: RECEIPT_PATH,
    receipt_id: proposedReceipt.evidence_root_id,
    manifest_id: manifest.manifest_id,
    authority_id: authority.authority_id,
    counts: COUNTS,
    receipt: proposedReceipt,
  };
}

function runCli() {
  if (process.argv.length !== 2) fail('INVALID_ARGUMENTS', 'CLI accepts no arguments');
  const result = validateWork0({ repoRoot: DEFAULT_REPO_ROOT, writeReceipt: true });
  process.stdout.write(`${canonicalJson({
    ok: result.ok,
    mode: result.mode,
    receipt_path: result.receipt_path,
    receipt_id: result.receipt_id,
    counts: result.counts,
  })}\n`);
}

if (process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    runCli();
  } catch (error) {
    const code = error instanceof Work0ValidationError ? error.code : 'UNEXPECTED_FAILURE';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
