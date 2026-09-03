#!/usr/bin/env node
// Shared Work 5 gate. Explicit --registration or --manifest, refuse tree
// drift, write only under m7-v2-repair/work5/. No model calls.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

export const WORK5_OUTPUT_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/work5';
export const REGISTRATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
export const REGISTRATION_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
export const SEALED_INPUTS = Object.freeze({
  identity_manifest: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-fixed-sample-identity-manifest.json',
    byte_length: 79758,
    sha256: 'dc6024da8b7b3e8e31fbd99406693b676c2785c6b3fdf2bfe41552336f128c37',
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_FIXED_SAMPLE_IDENTITY_MANIFEST/V1',
    expected_member_count: 50,
  }),
  lawyer_review_packet: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/lawyer-review-packet.json',
    byte_length: 143864,
    sha256: '7a3fb9e78bd3fb12743cbcf37f96127ceb9ecb69fa0f92c6d066a35a3e6adaeb',
    schema_version: 'STAGE_2Y_LAWYER_REVIEW_PACKET/V1',
    expected_item_count: 50,
  }),
  lawyer_decision_ledger: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/lawyer-decision-ledger.json',
    byte_length: 24422,
    sha256: 'd9caf0eafa84591f8df410f9636956e0de422fefa451f0cdcfbc8d653bfc49e0',
    schema_version: 'STAGE_2Y_LAWYER_DECISION_LEDGER/V1',
    expected_decision_count: 50,
  }),
});

const HEX_256 = /^[0-9a-f]{64}$/;
const REPO_ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

export class Work5Error extends Error {
  constructor(code, detail, repositoryPath = '.') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work5Error';
    this.code = code;
    this.path = repositoryPath;
  }
}

export function rootPath(selectedRoot) {
  if (typeof selectedRoot === 'string' && selectedRoot.length > 0) {
    const resolved = path.resolve(selectedRoot);
    let real;
    try {
      real = fs.realpathSync(resolved);
    } catch {
      throw new Work5Error('WORK5_INVALID', 'repoRoot');
    }
    if (real !== resolved) throw new Work5Error('WORK5_INVALID', 'symlinked repoRoot');
    return real;
  }
  return REPO_ROOT;
}

export function parseWork5Argv(argv) {
  const options = { check: false };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--registration') {
      options.registrationPath = argv[index + 1];
      index += 1;
    } else if (token === '--manifest') {
      options.manifestPath = argv[index + 1];
      index += 1;
    } else if (token === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (token === '--check') {
      options.check = true;
    } else {
      throw new Work5Error('WORK5_INVALID', token);
    }
  }
  return options;
}

export function safeAbsolute(root, repositoryPath) {
  if (typeof repositoryPath !== 'string' || repositoryPath.length === 0
      || repositoryPath.startsWith('/') || repositoryPath.includes('\0')
      || repositoryPath.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    return null;
  }
  let current = root;
  const parts = repositoryPath.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch {
      return null;
    }
    if (stat.isSymbolicLink()) return null;
    if (index < parts.length - 1 && !stat.isDirectory()) return null;
    if (index === parts.length - 1 && !stat.isFile()) return null;
  }
  return current;
}

export function readWorkingBytes(root, repositoryPath) {
  const absolute = safeAbsolute(root, repositoryPath);
  if (absolute === null) return null;
  return fs.readFileSync(absolute);
}

function parseJson(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFileBinding(value) {
  return isPlainObject(value)
    && typeof value.path === 'string'
    && typeof value.sha256 === 'string'
    && Number.isSafeInteger(value.byte_length);
}

function collectFileBindings(registration) {
  const files = [];
  const add = (binding) => {
    if (isFileBinding(binding) || (isPlainObject(binding) && typeof binding.path === 'string')) {
      files.push(binding);
    }
  };
  add(registration.parent_authority_binding);
  add(registration.activation_receipt_binding);
  add(registration.work0_evidence_root_binding);
  add(registration.family_profile_set_binding);
  add(registration.structure_disposition_set_binding);
  add(registration.view_policy_binding);
  const code = registration.code_bindings ?? {};
  for (const role of ['compiler', 'contract_validator', 'deterministic_generator', 'independent_verifier', 'projector']) {
    add(code[role]);
  }
  for (const binding of code.runners ?? []) add(binding);
  for (const binding of code.tests ?? []) add(binding);
  for (const entry of registration.semantic_input_bindings ?? []) add(entry.binding ?? entry);
  for (const entry of registration.predecessor_receipt_bindings ?? []) add(entry.binding ?? entry);
  return files;
}

export function resolveSelection(root, options) {
  const hasRegistration = typeof options.registrationPath === 'string' && options.registrationPath.length > 0;
  const hasManifest = typeof options.manifestPath === 'string' && options.manifestPath.length > 0;
  if (!hasRegistration && !hasManifest) {
    throw new Work5Error(
      'SELECTION_REQUIRED',
      'select --registration <path> or --manifest <path>; discovery and default IDs are forbidden',
      REGISTRATION_ROOT,
    );
  }
  let registrationPath = hasRegistration ? options.registrationPath : null;
  if (hasManifest) {
    const bytes = readWorkingBytes(root, options.manifestPath);
    if (bytes === null) throw new Work5Error('BINDING_PATH_MISSING', 'manifest of record is absent', options.manifestPath);
    const manifest = parseJson(bytes);
    const derived = manifest?.candidate_registration_binding?.registration_binding;
    if (typeof derived?.path !== 'string') {
      throw new Work5Error('SELECTION_REQUIRED', 'manifest has no candidate_registration_binding.registration_binding.path', options.manifestPath);
    }
    registrationPath = derived.path;
  }
  return { registrationPath, manifestPath: hasManifest ? options.manifestPath : null };
}

export function loadSelectedRegistration(root, options) {
  const selection = resolveSelection(root, options);
  const bytes = readWorkingBytes(root, selection.registrationPath);
  if (bytes === null) throw new Work5Error('BINDING_PATH_MISSING', 'registration file is absent', selection.registrationPath);
  const registration = parseJson(bytes);
  if (registration === null || registration.schema_version !== REGISTRATION_SCHEMA) {
    throw new Work5Error('REGISTRATION_IDENTITY_MISMATCH', 'registration is not a V1 candidate record', selection.registrationPath);
  }
  const unsigned = { ...registration };
  delete unsigned.candidate_registration_id;
  const recomputedId = contentId(REGISTRATION_SCHEMA, unsigned);
  if (registration.candidate_registration_id !== recomputedId) {
    throw new Work5Error(
      'REGISTRATION_IDENTITY_MISMATCH',
      `${registration.candidate_registration_id} != recomputed ${recomputedId}`,
      selection.registrationPath,
    );
  }
  for (const binding of collectFileBindings(registration)) {
    const fileBytes = readWorkingBytes(root, binding.path);
    if (fileBytes === null) throw new Work5Error('TREE_DRIFT', `${binding.path} is absent`, binding.path);
    const digest = sha256Hex(fileBytes);
    if (typeof binding.sha256 === 'string' && binding.sha256 !== digest) {
      throw new Work5Error('TREE_DRIFT', `${binding.path} sha256 ${digest} != bound ${binding.sha256}`, binding.path);
    }
  }
  return {
    ...selection,
    registration,
    candidateRegistrationId: registration.candidate_registration_id,
  };
}

export function readSealedRecord(root, spec) {
  const bytes = readWorkingBytes(root, spec.path);
  if (bytes === null) throw new Work5Error('BINDING_PATH_MISSING', 'sealed input is absent', spec.path);
  const digest = sha256Hex(bytes);
  if (bytes.length !== spec.byte_length || digest !== spec.sha256) {
    throw new Work5Error(
      'LEDGER_DIGEST_MISMATCH',
      `input ${bytes.length}/${digest} != sealed ${spec.byte_length}/${spec.sha256}`,
      spec.path,
    );
  }
  const record = parseJson(bytes);
  if (record === null || record.schema_version !== spec.schema_version) {
    throw new Work5Error('LEDGER_DIGEST_MISMATCH', `schema ${record?.schema_version ?? 'absent'}`, spec.path);
  }
  return { bytes, record, digest };
}

export function writeOrCheck(root, repositoryPath, text, options) {
  if (!repositoryPath.startsWith(`${WORK5_OUTPUT_ROOT}/`)) {
    throw new Work5Error('WORK5_INVALID', `refusing write outside ${WORK5_OUTPUT_ROOT}`, repositoryPath);
  }
  const bytes = Buffer.from(text, 'utf8');
  const absolute = path.join(root, repositoryPath);
  if (options.check) {
    const existing = readWorkingBytes(root, repositoryPath);
    if (existing === null) throw new Work5Error('CHECK_MISMATCH', 'report is absent', repositoryPath);
    if (!existing.equals(bytes)) throw new Work5Error('CHECK_MISMATCH', 'recomputed bytes differ', repositoryPath);
    return { wrote: false, bytes };
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, bytes);
  return { wrote: true, bytes };
}

export function runWork5(argv, build) {
  try {
    const options = parseWork5Argv(argv);
    const root = rootPath(options.repoRoot);
    const selected = loadSelectedRegistration(root, options);
    const built = build(root, selected, options);
    writeOrCheck(root, built.outputPath, built.text, options);
    const result = {
      status: 'PASS',
      findings: [],
      report_path: built.outputPath,
      candidate_registration_id: selected.candidateRegistrationId,
      item_count: built.itemCount,
      check: options.check === true,
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result;
  } catch (error) {
    const result = {
      status: 'FAIL',
      findings: [{
        code: error.code ?? 'WORK5_INVALID',
        path: error.path ?? '.',
        detail: error.message,
        severity: 'FAIL',
      }],
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = 1;
    return result;
  }
}

export { sha256Hex, canonicalJson, contentId };
