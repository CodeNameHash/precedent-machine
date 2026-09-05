#!/usr/bin/env node
// Shared Work 6 gate. Every report script selects a registration explicitly
// (--registration <path> or --manifest <path>), refuses if any bound file
// drifted, reads only sealed members, and writes only under
// evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/work6/.
// No default registration id. No model calls. No compiler import.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

export const WORK6_OUTPUT_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/work6';
export const REGISTRATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
export const REGISTRATION_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
export const SEALED_LEDGERS = Object.freeze({
  known_loss_244: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/known-loss-244-ledger.json',
    byte_length: 231047,
    sha256: '521dfec7073a5d0b3d86d239a4b92906ec4836f0fd1b29f4e0606d1dd9e390be',
    schema_version: 'STAGE_2Y_KNOWN_LOSS_LEDGER/V1',
    expected_member_count: 244,
  }),
  historical_limbs_69: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/red-hat-69-ledger.json',
    byte_length: 72309,
    sha256: '66f171464f154d6d7ac9126e85914c819a70d71fb7cd673db8c94ee958fd8a2d',
    schema_version: 'STAGE_2Y_RED_HAT_LIMB_LEDGER/V1',
    expected_member_count: 69,
  }),
  parser_ambiguities_23: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/m2-inline-23-ledger.json',
    byte_length: 19265,
    sha256: 'cd4cca768ffe4f371d8b68824cb3f179b38ca727f7a75694e6c2690b81348793',
    schema_version: 'STAGE_2Y_M2_INLINE_AMBIGUITY_LEDGER/V1',
    expected_member_count: 23,
  }),
  ten_agreement_set: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json',
    byte_length: 6054,
    sha256: 'e215c1df7f1dba82f27704e5cfddf62e931e9d44ef5cae60b3d7772314c42d97',
    schema_version: 'AGREEMENT_ANALYSIS_SET/V1',
    expected_member_count: 10,
  }),
  additive_three: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-generalisation-comparison-entry-correction/additive-open-world.json',
    byte_length: 7455,
    sha256: '4ae03b6248cba6ffebb3068bfdedf9ae66984bacb539f16c1c5545e1d90b0b9e',
    git_blob_oid: 'a282eb67c488dc4c12aca6ebe17a360d5d14c312',
    schema_version: 'STAGE_2Y_M7_ADDITIVE_OPEN_WORLD_LEDGER/V1',
    expected_member_count: 16,
  }),
  claim_closure: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/claim-closure.json',
    byte_length: 510054,
    sha256: 'a34f7c50aa7b989b6b99755144eb37019e7eaa8c2392b74e36a2e0266b262b72',
    schema_version: 'STAGE_2Y_CLAIM_CLOSURE/V1',
    expected_member_count: 1684,
  }),
  source_coverage: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/source-coverage.json',
    byte_length: 4805,
    sha256: '116c10733b111af434da985ece6fc651a38de0de3c745598e8addce2f788d959',
    schema_version: 'STAGE_2Y_SOURCE_COVERAGE/V1',
    expected_member_count: 10,
  }),
  output_ownership: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/output-ownership.json',
    byte_length: 383653,
    sha256: '122c6a764c3a07c924309f8e94f36c9193d492456d9394c9ca79e106a84052ea',
    schema_version: 'STAGE_2Y_OUTPUT_OWNERSHIP/V1',
    expected_member_count: 1494,
  }),
  resolution_set_diff: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/resolution-set-diff.json',
    byte_length: 4202,
    sha256: '9808d93e8258a08556c2134e5b5ce0008b2ee295e3f8c44cc1f3bfaca9d265cc',
    schema_version: 'STAGE_2Y_CORPUS_RESOLUTION_SET_DIFF/V1',
  }),
  row_field_preservation: Object.freeze({
    path: 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/row-field-preservation.json',
    byte_length: 679517,
    sha256: '51d61f49d85929a5040e9c094ecfc00b56cb0d105d1b1cdcc3b308bb11c5aa17',
    schema_version: 'STAGE_2Y_ROW_FIELD_PRESERVATION/V1',
    expected_member_count: 1494,
  }),
});
export const COMBINED_TEN_CORPUS_DIGEST =
  'b8825b712ab905a175cfc4a86c3504705f1d8bf509ddcee40f951764c3cf6e3d';

const HEX_256 = /^[0-9a-f]{64}$/;
const REPO_ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

export class Work6Error extends Error {
  constructor(code, detail, repositoryPath = '.') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work6Error';
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
      throw new Work6Error('WORK6_INVALID', 'repoRoot');
    }
    if (real !== resolved) throw new Work6Error('WORK6_INVALID', 'symlinked repoRoot');
    return real;
  }
  return REPO_ROOT;
}

export function parseWork6Argv(argv) {
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
      throw new Work6Error('WORK6_INVALID', token);
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

export function listRegistrationFiles(root) {
  try {
    return fs.readdirSync(path.join(root, REGISTRATION_ROOT))
      .filter((name) => name.endsWith('.json') && HEX_256.test(name.slice(0, -5)))
      .sort()
      .map((name) => `${REGISTRATION_ROOT}/${name}`);
  } catch {
    return [];
  }
}

export function resolveSelection(root, options) {
  const hasRegistration = typeof options.registrationPath === 'string' && options.registrationPath.length > 0;
  const hasManifest = typeof options.manifestPath === 'string' && options.manifestPath.length > 0;
  if (!hasRegistration && !hasManifest) {
    throw new Work6Error(
      'SELECTION_REQUIRED',
      'select --registration <path> or --manifest <path>; discovery and default IDs are forbidden',
      REGISTRATION_ROOT,
    );
  }
  let registrationPath = hasRegistration ? options.registrationPath : null;
  if (hasManifest) {
    const bytes = readWorkingBytes(root, options.manifestPath);
    if (bytes === null) throw new Work6Error('BINDING_PATH_MISSING', 'manifest of record is absent', options.manifestPath);
    const manifest = parseJson(bytes);
    const derived = manifest?.candidate_registration_binding?.registration_binding;
    if (typeof derived?.path !== 'string') {
      throw new Work6Error('SELECTION_REQUIRED', 'manifest has no candidate_registration_binding.registration_binding.path', options.manifestPath);
    }
    if (registrationPath && registrationPath !== derived.path) {
      throw new Work6Error(
        'REGISTRATION_IDENTITY_MISMATCH',
        `--registration ${registrationPath} != manifest registration ${derived.path}`,
        options.manifestPath,
      );
    }
    registrationPath = derived.path;
  }
  return {
    registrationPath,
    manifestPath: hasManifest ? options.manifestPath : null,
    supersededRegistrations: listRegistrationFiles(root).filter((pathName) => pathName !== registrationPath),
  };
}

export function loadSelectedRegistration(root, options) {
  const selection = resolveSelection(root, options);
  const bytes = readWorkingBytes(root, selection.registrationPath);
  if (bytes === null) {
    throw new Work6Error('BINDING_PATH_MISSING', 'registration file is absent', selection.registrationPath);
  }
  const registration = parseJson(bytes);
  if (registration === null || registration.schema_version !== REGISTRATION_SCHEMA) {
    throw new Work6Error('REGISTRATION_IDENTITY_MISMATCH', 'registration is not a V1 candidate record', selection.registrationPath);
  }
  const unsigned = { ...registration };
  delete unsigned.candidate_registration_id;
  const recomputedId = contentId(REGISTRATION_SCHEMA, unsigned);
  if (registration.candidate_registration_id !== recomputedId) {
    throw new Work6Error(
      'REGISTRATION_IDENTITY_MISMATCH',
      `${registration.candidate_registration_id} != recomputed ${recomputedId}`,
      selection.registrationPath,
    );
  }
  for (const binding of collectFileBindings(registration)) {
    const fileBytes = readWorkingBytes(root, binding.path);
    if (fileBytes === null) {
      throw new Work6Error('TREE_DRIFT', `${binding.path} is absent`, binding.path);
    }
    const digest = sha256Hex(fileBytes);
    if (typeof binding.sha256 === 'string' && binding.sha256 !== digest) {
      throw new Work6Error(
        'TREE_DRIFT',
        `${binding.path} sha256 ${digest} != bound ${binding.sha256}`,
        binding.path,
      );
    }
    if (Number.isSafeInteger(binding.byte_length) && binding.byte_length !== fileBytes.length) {
      throw new Work6Error(
        'TREE_DRIFT',
        `${binding.path} bytes ${fileBytes.length} != bound ${binding.byte_length}`,
        binding.path,
      );
    }
  }
  return {
    ...selection,
    registration,
    registrationBytes: bytes,
    candidateRegistrationId: registration.candidate_registration_id,
  };
}

export function readSealedLedger(root, spec) {
  const bytes = readWorkingBytes(root, spec.path);
  if (bytes === null) throw new Work6Error('BINDING_PATH_MISSING', 'sealed ledger is absent', spec.path);
  const digest = sha256Hex(bytes);
  if (bytes.length !== spec.byte_length || digest !== spec.sha256) {
    throw new Work6Error(
      'LEDGER_DIGEST_MISMATCH',
      `ledger ${bytes.length}/${digest} != sealed ${spec.byte_length}/${spec.sha256}`,
      spec.path,
    );
  }
  const record = parseJson(bytes);
  if (record === null || record.schema_version !== spec.schema_version) {
    throw new Work6Error('LEDGER_DIGEST_MISMATCH', `ledger schema ${record?.schema_version ?? 'absent'}`, spec.path);
  }
  if (Number.isSafeInteger(spec.expected_member_count)) {
    if (!Array.isArray(record.members) || record.members.length !== spec.expected_member_count) {
      throw new Work6Error(
        'COUNT_MISMATCH',
        `members ${record.members?.length ?? 'absent'} != ${spec.expected_member_count}`,
        spec.path,
      );
    }
  }
  return { bytes, record, digest, git_blob_oid: gitBlobOid(bytes) };
}

export function gitBlobOid(bytes) {
  return crypto.createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

export function tally(values) {
  const counts = {};
  for (const value of values) {
    const key = value == null ? '(none)' : String(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.keys(counts).sort().map((key) => [key, counts[key]]));
}

export function membersDigest(members) {
  return sha256Hex(canonicalJson(members));
}

export function identifyReport(schema, record, idField) {
  const unsigned = { ...record };
  delete unsigned[idField];
  return { ...record, [idField]: contentId(schema, unsigned) };
}

export function outputPathFor(reportFileName) {
  if (typeof reportFileName !== 'string' || reportFileName.includes('/') || reportFileName.includes('\\')) {
    throw new Work6Error('WORK6_INVALID', 'report file name');
  }
  return `${WORK6_OUTPUT_ROOT}/${reportFileName}`;
}

export function writeOrCheck(root, repositoryPath, record, options) {
  if (!repositoryPath.startsWith(`${WORK6_OUTPUT_ROOT}/`)) {
    throw new Work6Error('WORK6_INVALID', `refusing write outside ${WORK6_OUTPUT_ROOT}`, repositoryPath);
  }
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  const absolute = path.join(root, repositoryPath);
  if (options.check) {
    const existing = readWorkingBytes(root, repositoryPath);
    if (existing === null) {
      throw new Work6Error('CHECK_MISMATCH', 'report is absent', repositoryPath);
    }
    if (!existing.equals(bytes)) {
      throw new Work6Error('CHECK_MISMATCH', 'recomputed bytes differ', repositoryPath);
    }
    return { wrote: false, bytes };
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, bytes);
  return { wrote: true, bytes };
}

export function failResult(error, extra = {}) {
  return {
    status: 'FAIL',
    findings: [{
      code: error.code ?? 'WORK6_INVALID',
      path: error.path ?? '.',
      detail: error.message,
      severity: 'FAIL',
    }],
    ...extra,
  };
}

export function runReport(argv, build) {
  try {
    const options = parseWork6Argv(argv);
    const root = rootPath(options.repoRoot);
    const selected = loadSelectedRegistration(root, options);
    const built = build(root, selected, options);
    const outputPath = outputPathFor(built.fileName);
    const identified = identifyReport(built.schema, built.record, built.idField);
    writeOrCheck(root, outputPath, identified, options);
    const result = {
      status: 'PASS',
      findings: [],
      report_path: outputPath,
      report_id: identified[built.idField],
      candidate_registration_id: selected.candidateRegistrationId,
      superseded_registrations: selected.supersededRegistrations,
      check: options.check === true,
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result;
  } catch (error) {
    const result = failResult(error);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = 1;
    return result;
  }
}
