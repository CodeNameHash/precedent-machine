#!/usr/bin/env node
// Work4 validator: closes the Work4 receipt against the post-transition
// execution manifest without trusting the finaliser. It re-reads the receipt
// bytes, checks their canonical form and content identity, checks every
// lineage field against the manifest (manifest identity and digest, the
// candidate ordering authority, the candidate registration and the one-shot
// transition), re-derives every count from the same permitted inputs with
// its own code and requires them to agree with what the registration declares,
// validates the view policy against the projection contract, and requires the
// exact zero-effect envelope. It shares no derivation code with the finaliser.
// It writes nothing and launches no process of its own; the two validators it
// imports read on their own contracts.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import m7V2ContractModule from '../lib/canonical-v2/m7-v2-contract.js';
import { validateExecutionManifest } from './stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
import { verifyRegisteredCandidate } from './stage-2y-structure-m7-v2-repair-verify-candidate.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const { validateViewPolicyForProjection } = m7V2ContractModule;
const require = createRequire(import.meta.url);

const REPO_ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const MANIFEST_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-work4-execution-manifest.json`;
const TRANSITION_AUTHORITY_PATH =
  `${MIGRATION_ROOT}/control/m7-v2-repair-work4-candidate-transition-authority.json`;
const RECEIPT_PATH = `${MIGRATION_ROOT}/receipts/stage-2y-structure-m7-v2-repair-work4-fixture.json`;
const VIEW_POLICY_PATH = `${MIGRATION_ROOT}/m7-v2-repair/v2-view-policy.json`;
const PROFILE_SET_PATH = `${MIGRATION_ROOT}/control/m7-v2-repair-family-work3-approved-profile-set.json`;
const PROJECTOR_PATH = 'lib/canonical-v2/agreement-projection.js';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V1';
const RECEIPT_ID_FIELD = 'work4_receipt_id';
const RESULT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK4_VALIDATION/V1';
const RECEIPT_KEYS = Object.freeze([
  'schema_version', 'state', 'status', 'work', 'execution_manifest_id',
  'execution_manifest_digest', 'candidate_ordering_correction_authority_binding',
  'candidate_registration_id', 'candidate_transition', 'counts', 'effects',
  RECEIPT_ID_FIELD,
]);
const COUNT_KEYS = Object.freeze([
  'approved_family_profile_count', 'candidate_code_file_count',
  'candidate_predecessor_receipt_count', 'candidate_runner_count',
  'candidate_semantic_input_count', 'candidate_subtype_tree_count',
  'candidate_test_count', 'candidate_unique_bound_path_count', 'exact_command_count',
  'independent_verification_check_count', 'permitted_read_path_count',
  'permitted_write_path_count', 'projector_v1_rejection_count', 'transition_run_count',
  'view_policy_formatter_count', 'view_policy_label_count', 'view_policy_layout_count',
]);
const CODE_SINGLETON_ROLES = Object.freeze([
  'compiler', 'contract_validator', 'deterministic_generator', 'independent_verifier', 'projector',
]);
const EXPECTED_EFFECTS = Object.freeze({
  candidate_registration_writes: 0,
  candidate_transition_writes: 0,
  database_writes: 0,
  files_written: 1,
  m0_m4_mutations: 0,
  m8_actions: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  product_writes: 0,
  receipt_writes: 1,
  semantic_runs: 0,
  v2_shadow_projection_runs: 0,
});

export class Work4ValidationError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work4ValidationError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new Work4ValidationError(code, detail);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalBytes(record) {
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function exactKeys(record, keys) {
  return record !== null && typeof record === 'object' && !Array.isArray(record)
    && same(Object.keys(record).sort(), [...keys].sort());
}

function rootPath(selectedRoot) {
  if (typeof selectedRoot !== 'string' || selectedRoot.length === 0) {
    fail('WORK4_VALIDATION_INVALID', 'repoRoot');
  }
  const resolved = path.resolve(selectedRoot);
  let real;
  try {
    real = fs.realpathSync(resolved);
  } catch {
    fail('WORK4_VALIDATION_INVALID', 'repoRoot');
  }
  if (real !== resolved) fail('WORK4_VALIDATION_INVALID', 'symlinked repoRoot');
  return real;
}

function safeAbsolute(root, repositoryPath) {
  const parts = repositoryPath.split('/');
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      fail('WORK4_RECEIPT_ABSENT', repositoryPath);
    }
    if (stat.isSymbolicLink()) fail('WORK4_RECEIPT_DRIFT', `${repositoryPath} crosses a symlink`);
    if (index < parts.length - 1 && !stat.isDirectory()) fail('WORK4_RECEIPT_DRIFT', repositoryPath);
    if (index === parts.length - 1 && !stat.isFile()) fail('WORK4_RECEIPT_DRIFT', repositoryPath);
  }
  return current;
}

function readRegularFile(root, repositoryPath) {
  return fs.readFileSync(safeAbsolute(root, repositoryPath));
}

function parseCanonical(bytes, repositoryPath) {
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('WORK4_RECEIPT_DRIFT', `${repositoryPath} is not JSON`);
  }
  if (!bytes.equals(canonicalBytes(record))) fail('WORK4_RECEIPT_DRIFT', `${repositoryPath} bytes`);
  return record;
}

function readScopedBytes(root, manifest, repositoryPath) {
  if (!manifest.permitted_read_paths.includes(repositoryPath)) {
    fail('WORK4_READ_SCOPE', repositoryPath);
  }
  return readRegularFile(root, repositoryPath);
}

function readScoped(root, manifest, repositoryPath) {
  const bytes = readScopedBytes(root, manifest, repositoryPath);
  return { bytes, record: parseCanonical(bytes, repositoryPath) };
}

function requireBinding(binding, bytes, record, repositoryPath) {
  if (binding?.path !== repositoryPath
      || binding.byte_length !== bytes.length
      || binding.sha256 !== sha256Hex(bytes)
      || (binding.record_id_field !== null
        && record?.[binding.record_id_field] !== binding.record_id)) {
    fail('WORK4_BINDING_DRIFT', repositoryPath);
  }
}

// Pure receipt check against a manifest and independently derived expectations.
// Exported so the receipt contract can be exercised without a repository.
export function validateWork4Receipt(receipt, { manifest, expectedCounts, expectedEffects = EXPECTED_EFFECTS }) {
  if (!exactKeys(receipt, RECEIPT_KEYS)) fail('WORK4_RECEIPT_DRIFT', 'receipt keys');
  const unsigned = { ...receipt };
  delete unsigned[RECEIPT_ID_FIELD];
  if (receipt.schema_version !== RECEIPT_SCHEMA
      || receipt[RECEIPT_ID_FIELD] !== contentId(RECEIPT_SCHEMA, unsigned)) {
    fail('WORK4_RECEIPT_DRIFT', 'receipt identity');
  }
  if (receipt.state !== 'PASS_WORK4' || receipt.status !== 'PASS' || receipt.work !== 'WORK4') {
    fail('WORK4_RECEIPT_DRIFT', 'receipt state');
  }
  const registrationId = manifest.candidate_registration_binding?.registration_binding?.record_id;
  if (receipt.execution_manifest_id !== manifest.execution_manifest_id
      || receipt.execution_manifest_digest !== manifest.execution_manifest_digest
      || !same(receipt.candidate_ordering_correction_authority_binding,
        manifest.candidate_ordering_correction_authority_binding)
      || typeof registrationId !== 'string'
      || receipt.candidate_registration_id !== registrationId
      || !same(receipt.candidate_transition, manifest.candidate_transition)
      || receipt.candidate_transition?.state !== 'PASS') {
    fail('WORK4_LINEAGE_DRIFT', 'receipt lineage');
  }
  if (!exactKeys(receipt.counts, COUNT_KEYS)
      || COUNT_KEYS.some((key) => !Number.isSafeInteger(receipt.counts[key]) || receipt.counts[key] < 0)
      || !same(receipt.counts, expectedCounts)) {
    fail('WORK4_COUNT_DRIFT', 'receipt counts');
  }
  if (!same(receipt.effects, expectedEffects)) fail('WORK4_EFFECT_DRIFT', 'receipt effects');
  return true;
}

function projectorRefusesV1BySchemaGate(root, manifest, registration, viewPolicy) {
  const bytes = readScopedBytes(root, manifest, PROJECTOR_PATH);
  requireBinding(registration.code_bindings?.projector, bytes, null, PROJECTOR_PATH);
  const { projectAgreement } = require(safeAbsolute(root, PROJECTOR_PATH));
  const outcome = (analysis) => {
    try {
      projectAgreement(analysis, viewPolicy);
    } catch (error) {
      return { code: error?.code ?? null, message: String(error?.message ?? '') };
    }
    return null;
  };
  const v1 = outcome({ schema_version: 'AGREEMENT_ANALYSIS/V1' });
  const v2 = outcome({ schema_version: 'AGREEMENT_ANALYSIS/V2' });
  const gate = /requires AGREEMENT_ANALYSIS\/V2/u;
  return v1?.code === 'M7_V2_SCHEMA' && gate.test(v1.message) && v2 !== null && !gate.test(v2.message)
    ? 1
    : 0;
}

function boundPathCount(registration) {
  const paths = new Set();
  const add = (binding) => {
    if (typeof binding?.path === 'string') paths.add(binding.path);
    if (typeof binding?.container_path === 'string') paths.add(binding.container_path);
  };
  const collections = [
    [registration.parent_authority_binding],
    [registration.activation_receipt_binding],
    [registration.work0_evidence_root_binding],
    CODE_SINGLETON_ROLES.map((role) => registration.code_bindings[role]),
    registration.code_bindings.runners,
    registration.code_bindings.tests,
    registration.semantic_input_bindings.map((entry) => entry.binding ?? entry),
    [registration.family_profile_set_binding],
    registration.subtype_tree_bindings.map((entry) => entry.binding ?? entry),
    [registration.structure_disposition_set_binding],
    [registration.view_policy_binding],
    registration.predecessor_receipt_bindings.map((entry) => entry.binding ?? entry),
  ];
  for (const collection of collections) for (const binding of collection) add(binding);
  return paths.size;
}

export async function validateWork4(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some((key) => key !== 'repoRoot')) {
    fail('WORK4_VALIDATION_INVALID', 'options');
  }
  const root = rootPath(options.repoRoot ?? REPO_ROOT);
  const manifestBytes = readRegularFile(root, MANIFEST_PATH);
  const manifest = parseCanonical(manifestBytes, MANIFEST_PATH);
  if (manifest.work !== 'WORK4' || manifest.work_receipt_path !== RECEIPT_PATH
      || !manifest.permitted_write_paths?.includes(RECEIPT_PATH)) {
    fail('WORK4_STATE', 'manifest is not the Work4 post-transition manifest');
  }
  const validation = await validateExecutionManifest({ repoRoot: root, manifestPath: MANIFEST_PATH });
  if (validation.candidate_stage_state !== 'VERIFIED_CANDIDATE_BOUND'
      || validation.execution_manifest_id !== manifest.execution_manifest_id
      || validation.execution_manifest_digest !== manifest.execution_manifest_digest) {
    fail('WORK4_STATE', validation.candidate_stage_state);
  }
  const registrationBinding = manifest.candidate_registration_binding.registration_binding;
  const registrationState = readScoped(root, manifest, registrationBinding.path);
  requireBinding(registrationBinding, registrationState.bytes, registrationState.record,
    registrationBinding.path);
  const verification = verifyRegisteredCandidate({
    repoRoot: root,
    registrationPath: registrationBinding.path,
  });
  if (verification.state !== 'PASS_CANDIDATE_REGISTRATION'
      || !same(verification, manifest.candidate_registration_binding.independent_verification)) {
    fail('WORK4_STATE', 'independent candidate verification');
  }
  const transitionState = readScoped(root, manifest, TRANSITION_AUTHORITY_PATH);
  requireBinding(manifest.candidate_transition.authority_binding, transitionState.bytes,
    transitionState.record, TRANSITION_AUTHORITY_PATH);
  const registration = registrationState.record;
  const viewPolicyState = readScoped(root, manifest, VIEW_POLICY_PATH);
  requireBinding(registration.view_policy_binding, viewPolicyState.bytes, viewPolicyState.record,
    VIEW_POLICY_PATH);
  validateViewPolicyForProjection(viewPolicyState.record);
  const profileSetState = readScoped(root, manifest, PROFILE_SET_PATH);
  requireBinding(registration.family_profile_set_binding, profileSetState.bytes,
    profileSetState.record, PROFILE_SET_PATH);
  if (!Array.isArray(profileSetState.record.profiles)) fail('WORK4_RECEIPT_DRIFT', 'profile set');
  const code = registration.code_bindings;
  const registrationCounts = {
    code_file_count: CODE_SINGLETON_ROLES.length + code.runners.length + code.tests.length,
    predecessor_receipt_count: registration.predecessor_receipt_bindings.length,
    runner_count: code.runners.length,
    semantic_input_count: registration.semantic_input_bindings.length,
    subtype_tree_count: registration.subtype_tree_bindings.length,
    test_count: code.tests.length,
    unique_bound_path_count: boundPathCount(registration),
  };
  if (!same(registrationCounts, registration.counts) || !same(verification.counts, registration.counts)) {
    fail('WORK4_COUNT_DRIFT', 'candidate registration counts');
  }
  const expectedCounts = {
    approved_family_profile_count: profileSetState.record.profiles.length,
    candidate_code_file_count: registrationCounts.code_file_count,
    candidate_predecessor_receipt_count: registrationCounts.predecessor_receipt_count,
    candidate_runner_count: registrationCounts.runner_count,
    candidate_semantic_input_count: registrationCounts.semantic_input_count,
    candidate_subtype_tree_count: registrationCounts.subtype_tree_count,
    candidate_test_count: registrationCounts.test_count,
    candidate_unique_bound_path_count: registrationCounts.unique_bound_path_count,
    exact_command_count: manifest.exact_argv_with_run_limits.length,
    independent_verification_check_count: verification.checks.length,
    permitted_read_path_count: manifest.permitted_read_paths.length,
    permitted_write_path_count: manifest.permitted_write_paths.length,
    projector_v1_rejection_count: projectorRefusesV1BySchemaGate(
      root, manifest, registration, viewPolicyState.record,
    ),
    transition_run_count: manifest.candidate_transition.transition_run_count,
    view_policy_formatter_count: viewPolicyState.record.formatters.length,
    view_policy_label_count: viewPolicyState.record.labels.length,
    view_policy_layout_count: viewPolicyState.record.layouts.length,
  };
  const receiptBytes = readRegularFile(root, RECEIPT_PATH);
  const receipt = parseCanonical(receiptBytes, RECEIPT_PATH);
  validateWork4Receipt(receipt, { manifest, expectedCounts });
  return {
    schema_version: RESULT_SCHEMA,
    status: 'PASS',
    work4_receipt_id: receipt[RECEIPT_ID_FIELD],
    candidate_registration_id: receipt.candidate_registration_id,
    execution_manifest_id: manifest.execution_manifest_id,
    receipt_byte_length: receiptBytes.length,
    receipt_sha256: sha256Hex(receiptBytes),
    counts: receipt.counts,
  };
}

export {
  COUNT_KEYS,
  EXPECTED_EFFECTS,
  RECEIPT_KEYS,
  RECEIPT_PATH,
  RECEIPT_SCHEMA,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) fail('WORK4_VALIDATION_INVALID', 'CLI arguments');
    const result = await validateWork4();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
