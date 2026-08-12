#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePreparation } from './stage-2y-structure-m5-preparation-finalise.mjs';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m5-preparation.json`;
const AUTHORITY_PATH = `${MIGRATION_ROOT}/control/m5-preparation-authority.json`;
const POLICY_PATH = `${MIGRATION_ROOT}/control/m5-calibration-policy.json`;
const RECEIPT_SCHEMA = 'STAGE_2Y_M5_PREPARATION_RECEIPT/V1';
const PACK_SCHEMA = 'STAGE_2Y_FAMILY_CALIBRATION_PACK/V1';
const PROPOSAL_SCHEMA = 'STAGE_2Y_PROPOSED_FAMILY_REQUIRED_ROLE_SCHEMA/V1';
const PROPOSAL_STATUS = 'PROPOSED_AWAITING_BEN_APPROVAL';

function fail(code, detail) {
  throw new Error(`STAGE_2Y_M5_PREPARATION_VALIDATE:${code}: ${detail}`);
}

function repoPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath).split('\\').join('/');
  if (!value || value === '..' || value.startsWith('../')) {
    fail('PATH_OUTSIDE_REPOSITORY', absolutePath);
  }
  return value;
}

function exactPath(repositoryPath, label) {
  if (typeof repositoryPath !== 'string' || repositoryPath.length === 0
    || isAbsolute(repositoryPath)) {
    fail('INVALID_PATH', label);
  }
  const absolutePath = resolve(REPO_ROOT, repositoryPath);
  if (repoPath(absolutePath) !== repositoryPath) fail('PATH_NOT_NORMALISED', label);
  return absolutePath;
}

function assertNoSymlink(absolutePath, label) {
  let cursor = REPO_ROOT;
  for (const component of repoPath(absolutePath).split('/')) {
    cursor = resolve(cursor, component);
    if (!existsSync(cursor)) fail('MISSING_PATH', label);
    if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK_COMPONENT', label);
  }
}

function readBytes(repositoryPath, label) {
  const absolutePath = exactPath(repositoryPath, label);
  assertNoSymlink(absolutePath, label);
  if (!lstatSync(absolutePath).isFile()) fail('NOT_A_FILE', label);
  return readFileSync(absolutePath);
}

function readJson(repositoryPath, label, { canonical = false } = {}) {
  const bytes = readBytes(repositoryPath, label);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail('INVALID_JSON', `${label}: ${error.message}`);
  }
  if (canonical && !bytes.equals(Buffer.from(`${canonicalJson(value)}\n`, 'utf8'))) {
    fail('NON_CANONICAL_JSON', label);
  }
  return { bytes, value };
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_OBJECT', label);
  }
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    fail('KEY_SET_DRIFT', label);
  }
}

function same(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail('VALUE_DRIFT', label);
}

function requireDigest(value, label) {
  if (!/^[0-9a-f]{64}$/.test(value || '')) fail('INVALID_DIGEST', label);
}

function baseBinding(repositoryPath, label) {
  const bytes = readBytes(repositoryPath, label);
  return {
    path: repositoryPath,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  };
}

function validateBoundFile(binding, label) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    fail('INVALID_BINDING', label);
  }
  const actual = baseBinding(binding.path, label);
  if (binding.byte_length !== actual.byte_length || binding.sha256 !== actual.sha256) {
    fail('BINDING_DRIFT', label);
  }
  return readJson(binding.path, label).value;
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--receipt' || argv[1] !== RECEIPT_PATH) {
    fail('INVALID_ARGUMENTS', `expected --receipt ${RECEIPT_PATH}`);
  }
  return argv[1];
}

function currentChangedFiles() {
  const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))].sort();
}

function validateControlBytes(receipt, authority, policy) {
  const authorityBinding = {
    ...baseBinding(AUTHORITY_PATH, 'M5 preparation authority'),
    schema_version: authority.schema_version,
    authority_version: authority.authority_version,
    authority_digest: authority.authority_digest,
  };
  same(receipt.authority_binding, authorityBinding, 'receipt authority binding');
  same(receipt.calibration_policy_binding, authority.bindings.calibration_policy,
    'receipt calibration policy binding');
  same(receipt.full_contract_review_binding, authority.bindings.full_contract_review,
    'receipt full-contract review binding');
  same(receipt.predecessor_receipt_bindings, {
    m2: authority.bindings.m2_receipt,
    m3: authority.bindings.m3_receipt,
    m4: authority.bindings.m4_receipt,
  }, 'receipt predecessor bindings');
  same(receipt.family_manifest_binding, authority.bindings.family_keys,
    'receipt family manifest binding');
  same(receipt.control_manifest_binding, authority.bindings.control_manifest,
    'receipt control manifest binding');
  same(receipt.diff_contract_binding, authority.bindings.diff_contract,
    'receipt diff contract binding');
  validateBoundFile(receipt.authority_binding, 'receipt authority binding');
  validateBoundFile(receipt.calibration_policy_binding, 'receipt policy binding');
  validateBoundFile(receipt.full_contract_review_binding, 'receipt review binding');
  for (const [stage, binding] of Object.entries(receipt.predecessor_receipt_bindings)) {
    validateBoundFile(binding, `receipt predecessor ${stage}`);
  }
  validateBoundFile(receipt.family_manifest_binding, 'receipt family manifest');
  validateBoundFile(receipt.control_manifest_binding, 'receipt control manifest');
  validateBoundFile(receipt.diff_contract_binding, 'receipt diff contract');
  if (authority.base_commit !== policy.repository_contract.base_commit
    || receipt.base_commit !== authority.base_commit) {
    fail('BASE_COMMIT_DRIFT', receipt.base_commit);
  }
}

function validatePreparationState(receipt, policy) {
  const contract = policy.preparation_receipt_contract;
  exactKeys(receipt, contract.exact_top_level_members, 'preparation receipt');
  if (receipt.schema_version !== RECEIPT_SCHEMA
    || receipt.stage !== 'M5_PREPARATION'
    || receipt.lifecycle_state !== 'SEALED_PREPARATION_ONLY'
    || receipt.status !== 'PASS_PREPARATION_ONLY'
    || receipt.m5_family_execution_state !== 'NOT_AUTHORISED'
    || receipt.runner_eligible_family_count !== 0
    || receipt.approved_role_schema_count !== 0) {
    fail('NON_PREPARATION_STATE', 'receipt lifecycle or execution state');
  }
  exactKeys(receipt.metrics, contract.metrics_exact_members, 'receipt metrics');
  for (const [field, value] of Object.entries(contract.metrics_required)) {
    if (receipt.metrics[field] !== value) fail('METRIC_DRIFT', field);
  }
  if (receipt.metrics.supplemental_input_count < 0
    || receipt.metrics.open_legal_question_count < 0) {
    fail('METRIC_DRIFT', 'supplemental or legal-question count');
  }
  exactKeys(receipt.effects, contract.effects_exact_members, 'receipt effects');
  for (const [field, value] of Object.entries(receipt.effects)) {
    if (value !== 0) fail('NON_ZERO_EFFECT', field);
  }
  if (receipt.metrics.model_call_count !== 0 || receipt.metrics.family_runner_call_count !== 0) {
    fail('NON_ZERO_EFFECT', 'receipt metric call count');
  }
  if (!Array.isArray(receipt.checks) || receipt.checks.length === 0) {
    fail('CHECK_SET_DRIFT', 'checks');
  }
  for (const check of receipt.checks) {
    exactKeys(check, contract.check_exact_members, `check ${check?.check_id}`);
    if (check.status !== 'PASS') fail('CHECK_NOT_PASS', check.check_id);
  }
  if (!Array.isArray(receipt.diagnostics)) fail('DIAGNOSTIC_SET_DRIFT', 'diagnostics');
  for (const diagnostic of receipt.diagnostics) {
    exactKeys(diagnostic, contract.diagnostic_exact_members,
      `diagnostic ${diagnostic?.code}`);
  }
}

function validateOutputSet(receipt, authority, policy) {
  const contract = policy.preparation_receipt_contract;
  if (!Array.isArray(receipt.output_bindings)
    || receipt.output_bindings.length !== contract.output_binding_count) {
    fail('OUTPUT_COUNT_DRIFT', String(receipt.output_bindings?.length));
  }
  const expectedPaths = policy.family_order_contract.families.flatMap((family) => [
    family.calibration_pack_path,
    family.proposed_role_schema_path,
  ]);
  same(expectedPaths, policy.repository_contract.preparation_outputs,
    'policy preparation output order');
  const ids = [];
  for (let index = 0; index < receipt.output_bindings.length; index += 1) {
    const binding = receipt.output_bindings[index];
    const family = policy.family_order_contract.families[Math.floor(index / 2)];
    exactKeys(binding, contract.output_binding_exact_members, `output binding ${index}`);
    if (binding.path !== expectedPaths[index] || binding.family_key !== family.family_key
      || binding.status !== PROPOSAL_STATUS) {
      fail('OUTPUT_ORDER_OR_STATE_DRIFT', `${index}`);
    }
    const record = validateBoundFile(binding, `output binding ${index}`);
    const packPosition = index % 2 === 0;
    const expectedSchema = packPosition ? PACK_SCHEMA : PROPOSAL_SCHEMA;
    const idField = packPosition ? 'calibration_pack_id' : 'proposed_role_schema_id';
    const digestField = packPosition ? 'calibration_pack_digest' : 'proposal_digest';
    if (binding.schema_version !== expectedSchema || record.schema_version !== expectedSchema
      || record.family_key !== family.family_key || record.status !== PROPOSAL_STATUS
      || binding.record_id !== record[idField] || binding.record_digest !== record[digestField]) {
      fail('OUTPUT_RECORD_DRIFT', binding.path);
    }
    requireDigest(binding.record_id, `${binding.path} record ID`);
    requireDigest(binding.record_digest, `${binding.path} record digest`);
    ids.push(binding.record_id);
    if (!packPosition && (record.runner_eligible !== false
      || record.complete_transition_authorised !== false
      || record.approval_id !== null || record.schema_authority !== null
      || record.renderability_rule !== 'NEVER_RENDER_FROM_PROPOSAL')) {
      fail('PROPOSAL_ASSERTS_AUTHORITY', binding.path);
    }
  }
  if (new Set(ids).size !== ids.length) fail('DUPLICATE_OUTPUT_ID', 'output bindings');
  if (receipt.output_set_digest !== sha256Hex(canonicalJson(receipt.output_bindings))) {
    fail('OUTPUT_SET_DIGEST_DRIFT', receipt.output_set_digest);
  }
  same(receipt.family_order, authority.preparation_family_order, 'receipt family order');
}

function validateScopeAndAbsence(receipt, authority, policy) {
  if (!Array.isArray(receipt.changed_files) || receipt.changed_files.length !== 58
    || authority.permitted_changed_files.length !== 58) {
    fail('CHANGED_FILE_COUNT_DRIFT', String(receipt.changed_files?.length));
  }
  same(receipt.changed_files, authority.permitted_changed_files, 'exact 58 changed files');
  const actualChanged = currentChangedFiles();
  same(actualChanged, [...authority.permitted_changed_files].sort(),
    'repository exact 58 changed files');
  for (const repositoryPath of receipt.changed_files) {
    const absolutePath = exactPath(repositoryPath, `changed file ${repositoryPath}`);
    assertNoSymlink(absolutePath, `changed file ${repositoryPath}`);
    if (!lstatSync(absolutePath).isFile()) fail('CHANGED_PATH_NOT_FILE', repositoryPath);
  }
  for (const repositoryPath of policy.no_run_contract.required_absent_paths) {
    const absolutePath = exactPath(repositoryPath, `prohibited path ${repositoryPath}`);
    let cursor = REPO_ROOT;
    for (const component of repoPath(absolutePath).split('/')) {
      cursor = resolve(cursor, component);
      if (!existsSync(cursor)) break;
      if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK_COMPONENT', repositoryPath);
    }
    if (existsSync(absolutePath)) fail('PROHIBITED_EXECUTION_PATH_PRESENT', repositoryPath);
  }
  if (authority.permitted_command.family_runner !== null
    || authority.permitted_command.aggregate_runner !== null
    || authority.command_run_limit.family_runner !== 0
    || authority.command_run_limit.aggregate_runner !== 0
    || authority.command_run_limit.model_calls !== 0
    || authority.command_run_limit.phase_b_calls !== 0) {
    fail('EXECUTION_AUTHORITY_PRESENT', 'authority command limits');
  }
  if (Object.values(authority.zero_effect_expectations).some((value) => value !== 0)) {
    fail('NON_ZERO_AUTHORITY_EFFECT', 'zero_effect_expectations');
  }
}

function validateIdentity(receipt) {
  requireDigest(receipt.receipt_digest, 'receipt digest');
  requireDigest(receipt.receipt_id, 'receipt ID');
  const unsigned = structuredClone(receipt);
  delete unsigned.receipt_id;
  delete unsigned.receipt_digest;
  const digest = sha256Hex(canonicalJson(unsigned));
  if (receipt.receipt_digest !== digest) fail('RECEIPT_DIGEST_DRIFT', receipt.receipt_digest);
  const id = contentId(receipt.schema_version, { ...unsigned, receipt_digest: digest });
  if (receipt.receipt_id !== id) fail('RECEIPT_ID_DRIFT', receipt.receipt_id);
}

function validateReceipt(receipt, authority, policy) {
  validatePreparationState(receipt, policy);
  validateControlBytes(receipt, authority, policy);
  validateOutputSet(receipt, authority, policy);
  validateScopeAndAbsence(receipt, authority, policy);
  validateIdentity(receipt);
  const rebuilt = validatePreparation(authority, policy);
  same(receipt, rebuilt, 'receipt deterministic reconstruction');
  return receipt;
}

function main() {
  const receiptPath = parseArgs(process.argv.slice(2));
  const receipt = readJson(receiptPath, 'M5 preparation receipt', { canonical: true }).value;
  const authority = readJson(AUTHORITY_PATH, 'M5 preparation authority').value;
  const policy = readJson(POLICY_PATH, 'M5 calibration policy').value;
  validateReceipt(receipt, authority, policy);
  process.stdout.write(`${canonicalJson({
    stage: receipt.stage,
    status: receipt.status,
    lifecycle_state: receipt.lifecycle_state,
    output_set_digest: receipt.output_set_digest,
    receipt: receiptPath,
    validation: 'PASS_READ_ONLY',
  })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { validateReceipt };

