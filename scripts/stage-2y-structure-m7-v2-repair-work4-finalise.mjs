#!/usr/bin/env node
// Work4 finaliser: writes the one Work4 receipt, create-once, after the
// candidate transition. Work4 is the V2 formatter and render reconciliation
// work. Its governed outputs (the V2 projector, the V2 view policy and the
// projection-dispatch proof) were committed at the pushed preparation tip and
// are bound by the candidate registration, so the receipt binds lineage and
// counts only: the exact post-transition execution manifest, the candidate
// registration, the one-shot transition, and counts re-derived from those
// records, the V2 view policy, the approved profile set and the projector's
// public seam.
//
// What this script fences and what it does not. The six records it reads
// itself (manifest, registration, transition authority, view policy, profile
// set, projector source) are each checked against the manifest's
// permitted_read_paths and against the bindings the registration carries, and
// the projector is required through its bound path. The two validators it
// imports (the execution-manifest validator and the independent candidate
// verifier) read on their own contracts, which the manifest validator itself
// enforces. It performs no model call, network read, database write or
// product write, and it never overwrites.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
const RECEIPT_STATE = 'PASS_WORK4';
const EXPECTED_STAGE_STATE = 'VERIFIED_CANDIDATE_BOUND';
const CODE_SINGLETONS = Object.freeze([
  'compiler', 'deterministic_generator', 'contract_validator', 'projector', 'independent_verifier',
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

export class Work4ReceiptError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work4ReceiptError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new Work4ReceiptError(code, detail);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalBytes(record) {
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function rootPath(selectedRoot) {
  if (typeof selectedRoot !== 'string' || selectedRoot.length === 0) {
    fail('WORK4_RECEIPT_INVALID', 'repoRoot');
  }
  const resolved = path.resolve(selectedRoot);
  let real;
  try {
    real = fs.realpathSync(resolved);
  } catch {
    fail('WORK4_RECEIPT_INVALID', 'repoRoot');
  }
  if (real !== resolved) fail('WORK4_RECEIPT_INVALID', 'symlinked repoRoot');
  return real;
}

// Walks every component below the root so a symlinked directory anywhere on
// the path is refused, not only the immediate parent.
function safeAbsolute(root, repositoryPath, mustExist) {
  const parts = repositoryPath.split('/');
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT' && index === parts.length - 1 && !mustExist) return current;
      fail(mustExist ? 'WORK4_INPUT_ABSENT' : 'WORK4_OUTPUT_PATH', repositoryPath);
    }
    if (stat.isSymbolicLink()) fail('WORK4_INPUT_DRIFT', `${repositoryPath} crosses a symlink`);
    if (index < parts.length - 1 && !stat.isDirectory()) fail('WORK4_INPUT_DRIFT', repositoryPath);
    if (index === parts.length - 1 && !stat.isFile()) fail('WORK4_INPUT_DRIFT', repositoryPath);
  }
  return current;
}

function readRegularFile(root, repositoryPath) {
  return fs.readFileSync(safeAbsolute(root, repositoryPath, true));
}

function parseCanonical(bytes, repositoryPath) {
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('WORK4_INPUT_DRIFT', `${repositoryPath} is not JSON`);
  }
  if (!bytes.equals(canonicalBytes(record))) fail('WORK4_INPUT_DRIFT', `${repositoryPath} bytes`);
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

// The projector's public seam must refuse a V1 analysis by its schema gate,
// not by falling through to V2 validation: the refusal message is matched,
// and a V2-labelled but empty analysis must be refused for a different reason.
function probeProjectorSeam(root, manifest, registration, viewPolicy) {
  const bytes = readScopedBytes(root, manifest, PROJECTOR_PATH);
  requireBinding(registration.code_bindings?.projector, bytes, null, PROJECTOR_PATH);
  const { projectAgreement } = require(safeAbsolute(root, PROJECTOR_PATH, true));
  const refusal = (analysis) => {
    try {
      projectAgreement(analysis, viewPolicy);
    } catch (error) {
      return { code: error?.code ?? null, message: String(error?.message ?? '') };
    }
    return null;
  };
  const v1 = refusal({ schema_version: 'AGREEMENT_ANALYSIS/V1' });
  const v2 = refusal({ schema_version: 'AGREEMENT_ANALYSIS/V2' });
  if (v1?.code !== 'M7_V2_SCHEMA' || !/requires AGREEMENT_ANALYSIS\/V2/u.test(v1.message)
      || v2 === null || /requires AGREEMENT_ANALYSIS\/V2/u.test(v2.message)) {
    fail('WORK4_PROJECTOR_SEAM', 'V1 analysis is not refused by the schema gate');
  }
  return 1;
}

function uniqueBoundPaths(registration) {
  const paths = new Set();
  const add = (binding) => {
    if (typeof binding?.path === 'string') paths.add(binding.path);
    if (typeof binding?.container_path === 'string') paths.add(binding.container_path);
  };
  add(registration.parent_authority_binding);
  add(registration.activation_receipt_binding);
  add(registration.work0_evidence_root_binding);
  for (const key of CODE_SINGLETONS) add(registration.code_bindings[key]);
  for (const binding of registration.code_bindings.runners) add(binding);
  for (const binding of registration.code_bindings.tests) add(binding);
  for (const entry of registration.semantic_input_bindings) add(entry.binding ?? entry);
  add(registration.family_profile_set_binding);
  for (const entry of registration.subtype_tree_bindings) add(entry.binding ?? entry);
  add(registration.structure_disposition_set_binding);
  add(registration.view_policy_binding);
  for (const entry of registration.predecessor_receipt_bindings) add(entry.binding ?? entry);
  return paths.size;
}

// Counts are re-derived from the registration's own arrays and then required
// to agree with the counts the registration declares and the independent
// verifier re-verified; a disagreement is drift, not a number to copy.
export function deriveWork4Counts({
  manifest, registration, verification, viewPolicy, profileSet, projectorV1RejectionCount,
}) {
  const code = registration.code_bindings;
  const derived = {
    code_file_count: CODE_SINGLETONS.length + code.runners.length + code.tests.length,
    predecessor_receipt_count: registration.predecessor_receipt_bindings.length,
    runner_count: code.runners.length,
    semantic_input_count: registration.semantic_input_bindings.length,
    subtype_tree_count: registration.subtype_tree_bindings.length,
    test_count: code.tests.length,
    unique_bound_path_count: uniqueBoundPaths(registration),
  };
  if (!same(derived, registration.counts) || !same(verification.counts, registration.counts)) {
    fail('WORK4_COUNT_DRIFT', 'candidate registration counts');
  }
  return {
    approved_family_profile_count: profileSet.profiles.length,
    candidate_code_file_count: derived.code_file_count,
    candidate_predecessor_receipt_count: derived.predecessor_receipt_count,
    candidate_runner_count: derived.runner_count,
    candidate_semantic_input_count: derived.semantic_input_count,
    candidate_subtype_tree_count: derived.subtype_tree_count,
    candidate_test_count: derived.test_count,
    candidate_unique_bound_path_count: derived.unique_bound_path_count,
    exact_command_count: manifest.exact_argv_with_run_limits.length,
    independent_verification_check_count: verification.checks.length,
    permitted_read_path_count: manifest.permitted_read_paths.length,
    permitted_write_path_count: manifest.permitted_write_paths.length,
    projector_v1_rejection_count: projectorV1RejectionCount,
    transition_run_count: manifest.candidate_transition.transition_run_count,
    view_policy_formatter_count: viewPolicy.formatters.length,
    view_policy_label_count: viewPolicy.labels.length,
    view_policy_layout_count: viewPolicy.layouts.length,
  };
}

async function buildWork4Receipt(root) {
  const manifestBytes = readRegularFile(root, MANIFEST_PATH);
  const manifest = parseCanonical(manifestBytes, MANIFEST_PATH);
  if (manifest.work !== 'WORK4' || manifest.work_receipt_path !== RECEIPT_PATH
      || !manifest.permitted_write_paths?.includes(RECEIPT_PATH)
      || !manifest.permitted_read_paths?.includes(MANIFEST_PATH)) {
    fail('WORK4_STATE', 'manifest is not the Work4 post-transition manifest');
  }
  const validation = await validateExecutionManifest({ repoRoot: root, manifestPath: MANIFEST_PATH });
  if (validation.candidate_stage_state !== EXPECTED_STAGE_STATE
      || validation.execution_manifest_id !== manifest.execution_manifest_id
      || validation.execution_manifest_digest !== manifest.execution_manifest_digest) {
    fail('WORK4_STATE', validation.candidate_stage_state);
  }
  const transition = manifest.candidate_transition;
  const registrationBinding = manifest.candidate_registration_binding?.registration_binding;
  if (transition?.state !== 'PASS' || transition.transition_run_count !== 1
      || validation.candidate_registration_id !== registrationBinding?.record_id) {
    fail('WORK4_STATE', 'candidate transition');
  }
  const registrationState = readScoped(root, manifest, registrationBinding.path);
  requireBinding(registrationBinding, registrationState.bytes, registrationState.record,
    registrationBinding.path);
  const registration = registrationState.record;
  const verification = verifyRegisteredCandidate({
    repoRoot: root,
    registrationPath: registrationBinding.path,
  });
  if (verification.state !== 'PASS_CANDIDATE_REGISTRATION'
      || !same(verification, manifest.candidate_registration_binding.independent_verification)) {
    fail('WORK4_STATE', 'independent candidate verification');
  }
  const transitionState = readScoped(root, manifest, TRANSITION_AUTHORITY_PATH);
  requireBinding(transition.authority_binding, transitionState.bytes, transitionState.record,
    TRANSITION_AUTHORITY_PATH);
  if (!same(transitionState.record.candidate_registration_binding, registrationBinding)) {
    fail('WORK4_STATE', 'transition authority candidate binding');
  }
  const viewPolicyState = readScoped(root, manifest, VIEW_POLICY_PATH);
  requireBinding(registration.view_policy_binding, viewPolicyState.bytes, viewPolicyState.record,
    VIEW_POLICY_PATH);
  validateViewPolicyForProjection(viewPolicyState.record);
  const profileSetState = readScoped(root, manifest, PROFILE_SET_PATH);
  requireBinding(registration.family_profile_set_binding, profileSetState.bytes,
    profileSetState.record, PROFILE_SET_PATH);
  if (!Array.isArray(profileSetState.record.profiles)) {
    fail('WORK4_INPUT_DRIFT', 'approved profile set profiles');
  }
  const counts = deriveWork4Counts({
    manifest,
    registration,
    verification,
    viewPolicy: viewPolicyState.record,
    profileSet: profileSetState.record,
    projectorV1RejectionCount: probeProjectorSeam(root, manifest, registration, viewPolicyState.record),
  });
  const unsigned = {
    schema_version: RECEIPT_SCHEMA,
    state: RECEIPT_STATE,
    status: 'PASS',
    work: 'WORK4',
    execution_manifest_id: manifest.execution_manifest_id,
    execution_manifest_digest: manifest.execution_manifest_digest,
    candidate_ordering_correction_authority_binding:
      structuredClone(manifest.candidate_ordering_correction_authority_binding),
    candidate_registration_id: registrationBinding.record_id,
    candidate_transition: structuredClone(transition),
    counts,
    effects: { ...EXPECTED_EFFECTS },
  };
  return { ...unsigned, [RECEIPT_ID_FIELD]: contentId(RECEIPT_SCHEMA, unsigned) };
}

// Create-once and crash-safe: the bytes land in a temporary file beside the
// target, are fsynced, and are then hard-linked to the target, which fails
// atomically if the target already exists; a partial write never carries the
// receipt's name.
function writeExclusive(root, repositoryPath, bytes) {
  const target = safeAbsolute(root, repositoryPath, false);
  const directory = path.dirname(target);
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`,
  );
  const descriptor = fs.openSync(temporary, 'wx', 0o644);
  try {
    fs.writeSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.linkSync(temporary, target);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    if (error.code === 'EEXIST') fail('WORK4_OUTPUT_EXISTS', repositoryPath);
    throw error;
  }
  fs.rmSync(temporary, { force: true });
  const directoryDescriptor = fs.openSync(directory, 'r');
  try {
    fs.fsyncSync(directoryDescriptor);
  } finally {
    fs.closeSync(directoryDescriptor);
  }
}

export async function finaliseWork4(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
      || Object.keys(options).some((key) => !['repoRoot', 'write'].includes(key))) {
    fail('WORK4_RECEIPT_INVALID', 'options');
  }
  const root = rootPath(options.repoRoot ?? REPO_ROOT);
  const write = options.write ?? true;
  if (typeof write !== 'boolean') fail('WORK4_RECEIPT_INVALID', 'write option');
  const receipt = await buildWork4Receipt(root);
  const bytes = canonicalBytes(receipt);
  const target = safeAbsolute(root, RECEIPT_PATH, false);
  let existing = null;
  try {
    existing = fs.readFileSync(target);
  } catch (error) {
    if (error.code !== 'ENOENT') fail('WORK4_OUTPUT_PATH', RECEIPT_PATH);
  }
  if (existing !== null) {
    if (write) fail('WORK4_OUTPUT_EXISTS', RECEIPT_PATH);
    if (!existing.equals(bytes)) fail('WORK4_RECEIPT_DRIFT', RECEIPT_PATH);
  }
  if (write) writeExclusive(root, RECEIPT_PATH, bytes);
  return {
    status: write ? 'PASS_WORK4_FINALISATION' : 'PASS_WORK4_FINALISATION_PREVIEW',
    receipt_path: RECEIPT_PATH,
    work4_receipt_id: receipt[RECEIPT_ID_FIELD],
    candidate_registration_id: receipt.candidate_registration_id,
    execution_manifest_id: receipt.execution_manifest_id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    effects: {
      files_written: write ? 1 : 0,
      receipt_writes: write ? 1 : 0,
    },
  };
}

export {
  EXPECTED_EFFECTS,
  MANIFEST_PATH,
  PROFILE_SET_PATH,
  RECEIPT_ID_FIELD,
  RECEIPT_PATH,
  RECEIPT_SCHEMA,
  RECEIPT_STATE,
  TRANSITION_AUTHORITY_PATH,
  VIEW_POLICY_PATH,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) fail('WORK4_RECEIPT_INVALID', 'CLI arguments');
    const result = await finaliseWork4();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
