#!/usr/bin/env node
// Work 7 independent verifier. Re-reads a selected Work 4 candidate
// registration (--registration <path> or --manifest <path>) and re-derives
// every binding from the working tree and Git objects: path, byte length,
// SHA-256, Git blob OID, and counts. Rebuilds the 24 subtype trees and the
// approved profile set from the family-profile packages named by the
// registration. Nested sources named by the six semantic input sets and the
// structure disposition set are re-hashed; those set envelopes are labelled
// NO_INDEPENDENT_SOURCE and are not treated as independently derived
// membership oracles. Checks the Work 0 → Work 3 receipt chain, then the
// selected registration, then the Work 4 receipt named by the manifest
// (V1 or V2), by recomputing each receipt identity. A selected manifest's
// execution_manifest_id and execution_manifest_digest are recomputed with
// the published restamp rule (digest of canonical JSON without those two
// fields; id is contentId of the record-with-digest). A V2 Work 4 receipt's
// superseded_work4_receipt_binding is checked as a file binding; that V1
// receipt's candidate_registration_id is the only derived
// superseded_registrations entry. Other files in the registration root are
// other_registrations, not a supersession claim. Predecessor hops compare
// exact named fields, not a deep "id appears anywhere" walk. The Work 0
// evidence root's evidence_input_bindings / input_set_digest stay unused
// as an independent set-envelope oracle; that is a noted limitation, not
// a silent recompute. Collects every finding; never stops at the first.
//
// This script does not write, does not call a model, does not use the
// network, and does not import the compiler, the bound candidate verifier,
// or the Work 2–4 validators. The only shared imports are the canonical
// JSON serialiser and hash helper in lib/canonical-v2/canonical-bytes.js.
// gitBlobOid, path safety, binding walk and receipt-identity rules below
// are copies of the published algorithms, not imports from the artefacts
// under verification.
//
// Git is read-only and only through gitReadOnly(): cat-file, ls-tree,
// rev-parse. GIT_DIR, GIT_WORK_TREE and GIT_CONFIG_* are scrubbed.
//
// Output: one JSON object, schema STAGE_2Y_M7_V2_REPAIR_WORK7_VERIFICATION/V1,
// status PASS or FAIL, complete findings array. Exit 0 only on PASS.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const RESULT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK7_VERIFICATION/V1';
const REGISTRATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
const REGISTRATION_ROOT =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const GIT_COMMANDS = new Set(['cat-file', 'ls-tree', 'rev-parse']);
const WORK4_RECEIPT_SCHEMAS = new Set([
  'STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V1',
  'STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V2',
]);
const PREDECESSOR_BIND_FIELDS = Object.freeze({
  ACTIVATION: Object.freeze(['evidence_root_id', 'work0_evidence_root_binding']),
  WORK1: Object.freeze(['activation_receipt_id', 'activation_receipt_binding']),
  WORK2: Object.freeze(['predecessor', 'work1_contract_receipt_id', 'predecessor_receipt_binding']),
  WORK3: Object.freeze(['predecessor', 'work2_receipt_id', 'predecessor_receipt_binding']),
});
const GIT_ENV_SCRUB = Object.freeze([
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
]);
const CODE_SINGLETONS = Object.freeze([
  'compiler', 'contract_validator', 'deterministic_generator', 'independent_verifier', 'projector',
]);
const MEMBER_BINDING_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1';
const HEX_256 = /^[0-9a-f]{64}$/;
const RECEIPT_CHAIN = Object.freeze([
  {
    work: 'WORK0',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json',
    idField: 'evidence_root_id',
    digestField: null,
  },
  {
    work: 'ACTIVATION',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json',
    idField: 'activation_receipt_id',
    digestField: 'activation_receipt_digest',
  },
  {
    work: 'WORK1',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json',
    idField: 'work1_contract_receipt_id',
    digestField: 'work1_contract_receipt_digest',
  },
  {
    work: 'WORK2',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work2-compiler.json',
    idField: 'work2_receipt_id',
    digestField: null,
  },
  {
    work: 'WORK3',
    path: 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-profile.json',
    idField: 'work3_receipt_id',
    digestField: null,
  },
]);
const WORK4_RECEIPT_SPEC = Object.freeze({
  work: 'WORK4',
  idField: 'work4_receipt_id',
  digestField: null,
});

const REPO_ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

function gitBlobOid(bytes) {
  return crypto.createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function gitEnvironment() {
  const environment = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  for (const name of GIT_ENV_SCRUB) delete environment[name];
  for (const name of Object.keys(environment)) {
    if (name.startsWith('GIT_CONFIG_')) delete environment[name];
  }
  return environment;
}

function gitReadOnly(root, args) {
  if (!Array.isArray(args) || args.length === 0 || !GIT_COMMANDS.has(args[0])) {
    throw new Error(`WORK7_GIT_COMMAND: ${args?.[0] ?? 'missing'}`);
  }
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'buffer',
    env: gitEnvironment(),
    maxBuffer: 80 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function rootPath(selectedRoot) {
  if (typeof selectedRoot !== 'string' || selectedRoot.length === 0) {
    throw new Error('WORK7_INVALID: repoRoot');
  }
  const resolved = path.resolve(selectedRoot);
  let real;
  try {
    real = fs.realpathSync(resolved);
  } catch {
    throw new Error('WORK7_INVALID: repoRoot');
  }
  if (real !== resolved) throw new Error('WORK7_INVALID: symlinked repoRoot');
  return real;
}

function safeAbsolute(root, repositoryPath) {
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

function readWorkingBytes(root, repositoryPath) {
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

function cachedJson(cache, repositoryPath, bytes) {
  const key = `json\0${repositoryPath}`;
  if (cache.has(key)) return cache.get(key);
  const parsed = bytes ? parseJson(bytes) : null;
  cache.set(key, parsed);
  return parsed;
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

function isMemberBinding(value) {
  return isPlainObject(value)
    && (value.schema_version === MEMBER_BINDING_SCHEMA || typeof value.container_path === 'string')
    && typeof value.container_path === 'string'
    && typeof value.member_field === 'string'
    && typeof value.member_sha256 === 'string'
    && Number.isSafeInteger(value.member_byte_length);
}

function walk(value, visit, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, seen);
    return;
  }
  for (const item of Object.values(value)) walk(item, visit, seen);
}

function finding(code, pathName, detail, severity = 'FAIL') {
  return {
    code,
    path: pathName,
    detail,
    severity,
  };
}

function gitHeadBlobOid(root, repositoryPath) {
  try {
    const listed = gitReadOnly(root, ['ls-tree', '-r', '-z', 'HEAD', '--', repositoryPath]);
    const entries = listed.toString('utf8').split('\0').filter((entry) => entry.length > 0);
    for (const entry of entries) {
      const tab = entry.indexOf('\t');
      if (tab === -1) continue;
      const meta = entry.slice(0, tab);
      const entryPath = entry.slice(tab + 1);
      if (entryPath !== repositoryPath) continue;
      const match = /^(?:[0-7]{6}) blob ([0-9a-f]{40})$/u.exec(meta);
      if (match) return match[1];
    }
    return null;
  } catch {
    return undefined;
  }
}

function gitBlobBytes(root, oid) {
  if (typeof oid !== 'string' || !/^[0-9a-f]{40}$/.test(oid)) return null;
  try {
    return gitReadOnly(root, ['cat-file', 'blob', oid]);
  } catch {
    return null;
  }
}

function deriveFile(bytes) {
  return {
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function collectRegistrationBindings(registration) {
  const files = [];
  const members = [];
  const addFile = (role, binding) => {
    if (isFileBinding(binding) || (isPlainObject(binding) && typeof binding.path === 'string')) {
      files.push({ role, binding });
    }
  };
  const addMember = (role, binding) => {
    if (isMemberBinding(binding)) members.push({ role, binding });
  };
  addFile('parent_authority', registration.parent_authority_binding);
  addFile('activation_receipt', registration.activation_receipt_binding);
  addFile('work0_evidence_root', registration.work0_evidence_root_binding);
  addFile('family_profile_set', registration.family_profile_set_binding);
  addFile('structure_disposition_set', registration.structure_disposition_set_binding);
  addFile('view_policy', registration.view_policy_binding);
  for (const role of CODE_SINGLETONS) {
    addFile(`code.${role}`, registration.code_bindings?.[role]);
  }
  for (const [index, binding] of (registration.code_bindings?.runners ?? []).entries()) {
    addFile(`code.runners[${index}]`, binding);
  }
  for (const [index, binding] of (registration.code_bindings?.tests ?? []).entries()) {
    addFile(`code.tests[${index}]`, binding);
  }
  for (const entry of registration.semantic_input_bindings ?? []) {
    addFile(`semantic.${entry.input_role}`, entry.binding ?? entry);
  }
  for (const entry of registration.subtype_tree_bindings ?? []) {
    addMember(`subtype_tree.${entry.family_key}`, entry.binding ?? entry);
  }
  for (const entry of registration.predecessor_receipt_bindings ?? []) {
    addFile(`predecessor.${entry.work}`, entry.binding ?? entry);
  }
  return { files, members };
}

function uniqueBoundPaths(registration) {
  const paths = new Set();
  const { files, members } = collectRegistrationBindings(registration);
  for (const item of files) {
    if (typeof item.binding?.path === 'string') paths.add(item.binding.path);
  }
  for (const item of members) {
    if (typeof item.binding?.container_path === 'string') paths.add(item.binding.container_path);
  }
  return paths;
}

function expectedCounts(registration) {
  const code = registration.code_bindings ?? {};
  const runners = Array.isArray(code.runners) ? code.runners : [];
  const tests = Array.isArray(code.tests) ? code.tests : [];
  return {
    code_file_count: CODE_SINGLETONS.length + runners.length + tests.length,
    runner_count: runners.length,
    test_count: tests.length,
    semantic_input_count: (registration.semantic_input_bindings ?? []).length,
    subtype_tree_count: (registration.subtype_tree_bindings ?? []).length,
    predecessor_receipt_count: (registration.predecessor_receipt_bindings ?? []).length,
    unique_bound_path_count: uniqueBoundPaths(registration).size,
  };
}

function checkFileBinding(root, role, binding, findings, cache) {
  const repositoryPath = binding.path;
  if (typeof repositoryPath !== 'string') {
    findings.push(finding('BINDING_PATH_MISSING', role, 'binding has no path'));
    return null;
  }
  let bytes = cache.get(repositoryPath);
  if (bytes === undefined) {
    bytes = readWorkingBytes(root, repositoryPath);
    cache.set(repositoryPath, bytes);
  }
  if (bytes === null) {
    findings.push(finding('BINDING_PATH_MISSING', repositoryPath, `${role} is absent from the working tree`));
    return null;
  }
  const derived = deriveFile(bytes);
  if (binding.byte_length !== derived.byte_length || binding.sha256 !== derived.sha256) {
    findings.push(finding(
      'BINDING_BYTE_MISMATCH',
      repositoryPath,
      `${role} working-tree bytes ${derived.byte_length}/${derived.sha256} != bound ${binding.byte_length}/${binding.sha256}`,
    ));
  }
  if (typeof binding.git_blob_oid === 'string' && binding.git_blob_oid !== derived.git_blob_oid) {
    findings.push(finding(
      'GIT_BLOB_MISMATCH',
      repositoryPath,
      `${role} working-tree blob ${derived.git_blob_oid} != bound ${binding.git_blob_oid}`,
    ));
  }
  const headOid = gitHeadBlobOid(root, repositoryPath);
  if (headOid === undefined) {
    findings.push(finding('GIT_UNAVAILABLE', repositoryPath, `${role} could not be observed through read-only Git`));
  } else if (headOid === null) {
    findings.push(finding('GIT_BLOB_MISMATCH', repositoryPath, `${role} is absent from HEAD`));
  } else {
    if (headOid !== derived.git_blob_oid) {
      findings.push(finding(
        'WORKING_TREE_GIT_DRIFT',
        repositoryPath,
        `${role} working-tree blob ${derived.git_blob_oid} != HEAD ${headOid}`,
      ));
    }
    if (typeof binding.git_blob_oid === 'string' && binding.git_blob_oid !== headOid) {
      findings.push(finding(
        'GIT_BLOB_MISMATCH',
        repositoryPath,
        `${role} HEAD blob ${headOid} != bound ${binding.git_blob_oid}`,
      ));
    }
    const blob = gitBlobBytes(root, headOid);
    if (blob === null) {
      findings.push(finding('GIT_BLOB_MISMATCH', repositoryPath, `${role} cat-file blob ${headOid} failed`));
    } else {
      const fromGit = deriveFile(blob);
      if (fromGit.sha256 !== derived.sha256 || fromGit.byte_length !== derived.byte_length) {
        findings.push(finding(
          'WORKING_TREE_GIT_DRIFT',
          repositoryPath,
          `${role} cat-file sha256 ${fromGit.sha256} != working-tree ${derived.sha256}`,
        ));
      }
      if (fromGit.sha256 !== binding.sha256 || fromGit.byte_length !== binding.byte_length) {
        findings.push(finding(
          'BINDING_BYTE_MISMATCH',
          repositoryPath,
          `${role} cat-file sha256 ${fromGit.sha256} != bound ${binding.sha256}`,
        ));
      }
    }
  }
  if (typeof binding.record_id_field === 'string' && binding.record_id_field.length > 0) {
    const record = cachedJson(cache, repositoryPath, bytes);
    if (record?.[binding.record_id_field] !== binding.record_id) {
      findings.push(finding(
        'RECEIPT_IDENTITY_MISMATCH',
        repositoryPath,
        `${role} record_id ${record?.[binding.record_id_field] ?? 'absent'} != bound ${binding.record_id}`,
      ));
    }
  }
  return { bytes, derived };
}

function extractMember(container, binding) {
  const field = container?.[binding.member_field];
  if (binding.member_index === null || binding.member_index === undefined) return field;
  if (!Array.isArray(field)) return undefined;
  return field[binding.member_index];
}

function checkMemberBinding(root, role, binding, findings, cache) {
  const containerPath = binding.container_path;
  let bytes = cache.get(containerPath);
  if (bytes === undefined) {
    bytes = readWorkingBytes(root, containerPath);
    cache.set(containerPath, bytes);
  }
  if (bytes === null) {
    findings.push(finding('BINDING_PATH_MISSING', containerPath, `${role} container is absent`));
    return;
  }
  const container = cachedJson(cache, containerPath, bytes);
  if (container === null) {
    findings.push(finding('SEMANTIC_DIGEST_MISMATCH', containerPath, `${role} container is not JSON`));
    return;
  }
  const member = extractMember(container, binding);
  if (member === undefined) {
    findings.push(finding('SEMANTIC_DIGEST_MISMATCH', containerPath, `${role} member ${binding.member_field} is absent`));
    return;
  }
  const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
  if (memberBytes.length !== binding.member_byte_length || sha256Hex(memberBytes) !== binding.member_sha256) {
    findings.push(finding(
      'SEMANTIC_DIGEST_MISMATCH',
      containerPath,
      `${role} recomputed ${memberBytes.length}/${sha256Hex(memberBytes)} != bound ${binding.member_byte_length}/${binding.member_sha256}`,
    ));
  }
  if (typeof binding.member_record_id_field === 'string' && binding.member_record_id_field.length > 0) {
    if (member?.[binding.member_record_id_field] !== binding.member_record_id) {
      findings.push(finding(
        'RECEIPT_IDENTITY_MISMATCH',
        containerPath,
        `${role} member identity ${member?.[binding.member_record_id_field] ?? 'absent'} != bound ${binding.member_record_id}`,
      ));
    } else if (HEX_256.test(binding.member_record_id || '')) {
      const unsigned = { ...member };
      delete unsigned[binding.member_record_id_field];
      const recomputedId = contentId(binding.member_schema_version ?? member?.schema_version, unsigned);
      if (recomputedId !== binding.member_record_id) {
        findings.push(finding(
          'RECEIPT_IDENTITY_MISMATCH',
          containerPath,
          `${role} member content-id ${recomputedId} != bound ${binding.member_record_id}`,
        ));
      }
    }
  }
}

function checkReceiptIdentity(root, spec, findings, cache) {
  let bytes = cache.get(spec.path);
  if (bytes === undefined) {
    bytes = readWorkingBytes(root, spec.path);
    cache.set(spec.path, bytes);
  }
  if (bytes === null) {
    findings.push(finding('BINDING_PATH_MISSING', spec.path, `${spec.work} receipt is absent`));
    return null;
  }
  const record = cachedJson(cache, spec.path, bytes);
  if (record === null) {
    findings.push(finding('RECEIPT_IDENTITY_MISMATCH', spec.path, `${spec.work} receipt is not JSON`));
    return null;
  }
  if (spec.work === 'WORK4' && !WORK4_RECEIPT_SCHEMAS.has(record.schema_version)) {
    findings.push(finding(
      'RECEIPT_IDENTITY_MISMATCH',
      spec.path,
      `Work 4 receipt schema ${record.schema_version ?? 'absent'} is not V1 or V2`,
    ));
    return null;
  }
  const unsigned = { ...record };
  delete unsigned[spec.idField];
  const recomputedId = contentId(record.schema_version, unsigned);
  if (record[spec.idField] !== recomputedId) {
    findings.push(finding(
      'RECEIPT_IDENTITY_MISMATCH',
      spec.path,
      `${spec.work} ${spec.idField} ${record[spec.idField]} != recomputed ${recomputedId}`,
    ));
  }
  if (typeof spec.digestField === 'string' && spec.digestField in record) {
    const unsignedDigest = { ...record };
    delete unsignedDigest[spec.idField];
    delete unsignedDigest[spec.digestField];
    const recomputedDigest = sha256Hex(canonicalJson(unsignedDigest));
    if (record[spec.digestField] !== recomputedDigest) {
      findings.push(finding(
        'RECEIPT_IDENTITY_MISMATCH',
        spec.path,
        `${spec.work} ${spec.digestField} ${record[spec.digestField]} != recomputed ${recomputedDigest}`,
      ));
    }
  }
  return record;
}

function recomputeProfileSet(root, registration, findings, recomputations, cache) {
  const binding = registration.family_profile_set_binding;
  if (!binding?.path) {
    recomputations.push({
      name: 'family_profile_set',
      status: 'NO_INDEPENDENT_SOURCE',
      detail: 'registration has no family_profile_set_binding',
      path: null,
    });
    findings.push(finding('NO_INDEPENDENT_SOURCE', registration.allowed_output_root ?? '.', 'no family_profile_set_binding', 'INFO'));
    return;
  }
  const setBytes = cache.get(binding.path) ?? readWorkingBytes(root, binding.path);
  cache.set(binding.path, setBytes);
  if (setBytes === null) return;
  const profileSet = cachedJson(cache, binding.path, setBytes);
  const packagePaths = (registration.subtype_tree_bindings ?? [])
    .map((entry) => entry.binding?.container_path)
    .filter((repositoryPath) => typeof repositoryPath === 'string');
  if (packagePaths.length === 0) {
    recomputations.push({
      name: 'family_profile_set',
      status: 'NO_INDEPENDENT_SOURCE',
      detail: 'registration subtype_tree_bindings name no package containers',
      path: binding.path,
    });
    findings.push(finding('NO_INDEPENDENT_SOURCE', binding.path, 'no package containers on the registration', 'INFO'));
    return;
  }
  const rebuilt = [];
  for (const packagePath of packagePaths) {
    let packageBytes = cache.get(packagePath);
    if (packageBytes === undefined) {
      packageBytes = readWorkingBytes(root, packagePath);
      cache.set(packagePath, packageBytes);
    }
    const packageRecord = cachedJson(cache, packagePath, packageBytes);
    if (!Array.isArray(packageRecord?.profiles)) {
      findings.push(finding('SEMANTIC_DIGEST_MISMATCH', packagePath, 'package profiles absent'));
      continue;
    }
    rebuilt.push(...packageRecord.profiles);
  }
  const rebuiltDigest = sha256Hex(canonicalJson(rebuilt));
  const boundDigest = sha256Hex(canonicalJson(profileSet.profiles ?? null));
  if (rebuiltDigest !== boundDigest || rebuilt.length !== (profileSet.profiles ?? []).length) {
    findings.push(finding(
      'SEMANTIC_DIGEST_MISMATCH',
      binding.path,
      `rebuilt profile digest ${rebuiltDigest} (${rebuilt.length}) != bound ${boundDigest} (${(profileSet.profiles ?? []).length})`,
    ));
    recomputations.push({
      name: 'family_profile_set',
      status: 'FAIL',
      rebuilt_digest: rebuiltDigest,
      bound_digest: boundDigest,
      path: binding.path,
    });
    return;
  }
  const registrationTrees = canonicalJson((registration.subtype_tree_bindings ?? []).map((entry) => ({
    family_key: entry.family_key,
    binding: entry.binding,
  })));
  const setTrees = canonicalJson(profileSet.subtype_tree_bindings ?? null);
  if (registrationTrees !== setTrees) {
    findings.push(finding(
      'SEMANTIC_DIGEST_MISMATCH',
      binding.path,
      'registration subtype_tree_bindings != profile-set subtype_tree_bindings',
    ));
  }
  recomputations.push({
    name: 'family_profile_set',
    status: 'RECOMPUTED',
    source: 'registration.subtype_tree_bindings.container_path profiles',
    digest: rebuiltDigest,
    profile_count: rebuilt.length,
    path: binding.path,
  });
}

function recomputeSubtypeTrees(root, registration, findings, recomputations, cache) {
  const entries = registration.subtype_tree_bindings ?? [];
  if (entries.length === 0) {
    recomputations.push({
      name: 'subtype_trees',
      status: 'NO_INDEPENDENT_SOURCE',
      detail: 'none declared',
      path: registration.family_profile_set_binding?.path ?? '.',
    });
    findings.push(finding(
      'NO_INDEPENDENT_SOURCE',
      registration.family_profile_set_binding?.path ?? '.',
      'no subtype_tree_bindings',
      'INFO',
    ));
    return;
  }
  let matched = 0;
  const before = findings.length;
  for (const entry of entries) {
    const binding = entry.binding ?? entry;
    const failBefore = findings.length;
    checkMemberBinding(root, `subtype_tree.${entry.family_key}`, binding, findings, cache);
    if (findings.length === failBefore) matched += 1;
  }
  recomputations.push({
    name: 'subtype_trees',
    status: matched === entries.length && findings.length === before ? 'RECOMPUTED' : 'FAIL',
    source: 'family_profile_package.subtype_tree',
    tree_count: matched,
    path: registration.family_profile_set_binding?.path ?? entries[0]?.binding?.container_path,
  });
}

function recomputeSemanticInputs(root, registration, findings, recomputations, cache) {
  const entries = registration.semantic_input_bindings ?? [];
  if (entries.length === 0) {
    recomputations.push({
      name: 'semantic_inputs',
      status: 'NO_INDEPENDENT_SOURCE',
      detail: 'none declared',
      path: '.',
    });
    findings.push(finding('NO_INDEPENDENT_SOURCE', '.', 'no semantic_input_bindings', 'INFO'));
    return;
  }
  for (const entry of entries) {
    const binding = entry.binding ?? entry;
    const role = entry.input_role ?? binding.path;
    const bytes = cache.get(binding.path);
    const record = cachedJson(cache, binding.path, bytes);
    let sourceCount = 0;
    walk(record, (value) => {
      if (isFileBinding(value) && value.path !== binding.path) {
        sourceCount += 1;
        checkFileBinding(root, `${role}.${value.path}`, value, findings, cache);
      } else if (isMemberBinding(value)) {
        sourceCount += 1;
        checkMemberBinding(root, `${role}.${value.container_path}`, value, findings, cache);
      }
    });
    if (sourceCount === 0) {
      recomputations.push({
        name: `semantic.${role}`,
        status: 'NO_INDEPENDENT_SOURCE',
        detail: 'no independent member list or nested source bindings',
        path: binding.path,
      });
      findings.push(finding(
        'NO_INDEPENDENT_SOURCE',
        binding.path,
        `${role} set envelope has no independent source; bound bytes were hashed, not treated as a membership oracle`,
        'INFO',
      ));
    } else {
      findings.push(finding(
        'NO_INDEPENDENT_SOURCE',
        binding.path,
        `${role} membership list is taken from the bound set; ${sourceCount} nested source files or package members were re-hashed independently`,
        'INFO',
      ));
      recomputations.push({
        name: `semantic.${role}`,
        status: 'MEMBERS_CHECKED',
        set_envelope: 'NO_INDEPENDENT_SOURCE',
        source: 'nested source files and package members named by the bound set',
        source_count: sourceCount,
        path: binding.path,
      });
    }
  }
}

function recomputeDispositionSet(root, registration, findings, recomputations, cache) {
  const binding = registration.structure_disposition_set_binding;
  if (!binding?.path) {
    recomputations.push({ name: 'structure_disposition_set', status: 'NO_INDEPENDENT_SOURCE', detail: 'no binding' });
    findings.push(finding('NO_INDEPENDENT_SOURCE', 'structure_disposition_set', 'no binding', 'INFO'));
    return;
  }
  const bytes = cache.get(binding.path);
  const record = cachedJson(cache, binding.path, bytes);
  let sourceCount = 0;
  walk(record, (value) => {
    if (isMemberBinding(value)) {
      sourceCount += 1;
      checkMemberBinding(root, `disposition.${value.container_path}`, value, findings, cache);
    } else if (isFileBinding(value) && value.path !== binding.path) {
      sourceCount += 1;
      checkFileBinding(root, `disposition.${value.path}`, value, findings, cache);
    }
  });
  if (sourceCount === 0) {
    recomputations.push({
      name: 'structure_disposition_set',
      status: 'NO_INDEPENDENT_SOURCE',
      detail: 'disposition set has no nested source bindings',
      path: binding.path,
    });
    findings.push(finding('NO_INDEPENDENT_SOURCE', binding.path, 'no nested source bindings', 'INFO'));
    return;
  }
  findings.push(finding(
    'NO_INDEPENDENT_SOURCE',
    binding.path,
    `disposition membership list is taken from the bound set; ${sourceCount} nested sources were re-hashed independently`,
    'INFO',
  ));
  recomputations.push({
    name: 'structure_disposition_set',
    status: 'MEMBERS_CHECKED',
    set_envelope: 'NO_INDEPENDENT_SOURCE',
    source: 'nested fixture and index bindings named by the bound set',
    source_count: sourceCount,
    path: binding.path,
  });
}

function listRegistrationFiles(root) {
  try {
    return fs.readdirSync(path.join(root, REGISTRATION_ROOT))
      .filter((name) => name.endsWith('.json') && HEX_256.test(name.slice(0, -5)))
      .sort()
      .map((name) => `${REGISTRATION_ROOT}/${name}`);
  } catch {
    return [];
  }
}

function resolveSelection(root, options, findings, cache) {
  const hasRegistration = typeof options.registrationPath === 'string' && options.registrationPath.length > 0;
  const hasManifest = typeof options.manifestPath === 'string' && options.manifestPath.length > 0;
  if (!hasRegistration && !hasManifest) {
    findings.push(finding(
      'SELECTION_REQUIRED',
      REGISTRATION_ROOT,
      'select --registration <path> or --manifest <path>; discovery and default IDs are forbidden',
    ));
    return null;
  }
  let registrationPath = hasRegistration ? options.registrationPath : null;
  let work4ReceiptPath = null;
  let manifest = null;
  if (hasManifest) {
    const manifestBytes = readWorkingBytes(root, options.manifestPath);
    cache.set(options.manifestPath, manifestBytes);
    if (manifestBytes === null) {
      findings.push(finding('BINDING_PATH_MISSING', options.manifestPath, 'manifest of record is absent'));
      return null;
    }
    manifest = parseJson(manifestBytes);
    const identity = restampedManifestIdentity(manifest);
    if (identity === null) {
      findings.push(finding('RECEIPT_IDENTITY_MISMATCH', options.manifestPath, 'manifest is not JSON'));
    } else if (
      manifest.execution_manifest_digest !== identity.digest
      || manifest.execution_manifest_id !== identity.id
    ) {
      findings.push(finding(
        'RECEIPT_IDENTITY_MISMATCH',
        options.manifestPath,
        `execution_manifest_id/digest ${manifest.execution_manifest_id}/${manifest.execution_manifest_digest} != recomputed ${identity.id}/${identity.digest}`,
      ));
    }
    const derived = manifest?.candidate_registration_binding?.registration_binding;
    if (!isFileBinding(derived) && typeof derived?.path !== 'string') {
      findings.push(finding('SELECTION_REQUIRED', options.manifestPath, 'manifest has no candidate_registration_binding.registration_binding.path'));
      return null;
    }
    checkFileBinding(root, 'manifest.candidate_registration_binding', derived, findings, cache);
    if (registrationPath && registrationPath !== derived.path) {
      findings.push(finding(
        'REGISTRATION_IDENTITY_MISMATCH',
        options.manifestPath,
        `--registration ${registrationPath} != manifest registration ${derived.path}`,
      ));
    }
    registrationPath = derived.path;
    if (typeof manifest.work_receipt_path === 'string') work4ReceiptPath = manifest.work_receipt_path;
  }
  return {
    registrationPath,
    work4ReceiptPath,
    manifestPath: hasManifest ? options.manifestPath : null,
    manifest,
    manifestBytes: hasManifest ? cache.get(options.manifestPath) : null,
  };
}

export function verifyWork7(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('WORK7_INVALID: options');
  }
  const root = rootPath(options.repoRoot ?? REPO_ROOT);
  const findings = [];
  const recomputations = [];
  const cache = new Map();
  const selection = resolveSelection(root, options, findings, cache);
  if (selection === null) {
    return finish(findings, recomputations, {
      candidate_registration_id: null,
      registration_path: options.registrationPath ?? null,
      other_registrations: listRegistrationFiles(root),
      superseded_registrations: [],
      counts: null,
    });
  }
  const { registrationPath, work4ReceiptPath } = selection;
  const registrationBytes = readWorkingBytes(root, registrationPath);
  if (registrationBytes === null) {
    findings.push(finding('BINDING_PATH_MISSING', registrationPath, 'registration file is absent'));
    return finish(findings, recomputations, {
      candidate_registration_id: null,
      registration_path: registrationPath,
      counts: null,
    });
  }
  const registration = parseJson(registrationBytes);
  if (registration === null || registration.schema_version !== REGISTRATION_SCHEMA) {
    findings.push(finding('REGISTRATION_IDENTITY_MISMATCH', registrationPath, 'registration is not a V1 candidate record'));
    return finish(findings, recomputations, {
      candidate_registration_id: null,
      registration_path: registrationPath,
      counts: null,
    });
  }
  const unsigned = { ...registration };
  delete unsigned.candidate_registration_id;
  const recomputedRegistrationId = contentId(REGISTRATION_SCHEMA, unsigned);
  if (registration.candidate_registration_id !== recomputedRegistrationId) {
    findings.push(finding(
      'REGISTRATION_IDENTITY_MISMATCH',
      registrationPath,
      `${registration.candidate_registration_id} != recomputed ${recomputedRegistrationId}`,
    ));
  }
  const otherRegistrations = listRegistrationFiles(root).filter((pathName) => pathName !== registrationPath);

  const { files, members } = collectRegistrationBindings(registration);
  const declaredPaths = uniqueBoundPaths(registration);
  const recomputed = expectedCounts(registration);
  const declared = registration.counts ?? {};
  for (const key of Object.keys(recomputed).sort()) {
    if (declared[key] !== recomputed[key]) {
      findings.push(finding(
        'COUNT_MISMATCH',
        registrationPath,
        `${key} declared ${declared[key]} != recomputed ${recomputed[key]}`,
      ));
    }
  }
  if ((declared.unique_bound_path_count ?? 0) < recomputed.unique_bound_path_count) {
    findings.push(finding(
      'BINDING_PATH_ADDED',
      registrationPath,
      `registration bindings name ${recomputed.unique_bound_path_count} paths [${[...declaredPaths].sort().join(', ')}]; counts declare ${declared.unique_bound_path_count}`,
    ));
  }
  if ((declared.unique_bound_path_count ?? 0) > recomputed.unique_bound_path_count) {
    findings.push(finding(
      'BINDING_PATH_MISSING',
      registrationPath,
      `counts declare ${declared.unique_bound_path_count} paths; bindings name ${recomputed.unique_bound_path_count}`,
    ));
  }

  for (const item of files) {
    checkFileBinding(root, item.role, item.binding, findings, cache);
  }
  for (const item of members) {
    checkMemberBinding(root, item.role, item.binding, findings, cache);
  }
  observeAllowedOutputRoot(root, registration.allowed_output_root, findings);

  recomputeSemanticInputs(root, registration, findings, recomputations, cache);
  recomputeSubtypeTrees(root, registration, findings, recomputations, cache);
  recomputeProfileSet(root, registration, findings, recomputations, cache);
  recomputeDispositionSet(root, registration, findings, recomputations, cache);
  if (!registration.view_policy_binding?.path) {
    findings.push(finding('NO_INDEPENDENT_SOURCE', 'view_policy', 'no binding', 'INFO'));
    recomputations.push({ name: 'view_policy', status: 'NO_INDEPENDENT_SOURCE', detail: 'no binding' });
  } else {
    findings.push(finding(
      'NO_INDEPENDENT_SOURCE',
      registration.view_policy_binding.path,
      'view policy has no producer independent of the bound projector',
      'INFO',
    ));
    recomputations.push({
      name: 'view_policy',
      status: 'NO_INDEPENDENT_SOURCE',
      detail: 'no producer independent of the bound projector',
      path: registration.view_policy_binding.path,
    });
  }

  const receiptChain = work4ReceiptPath
    ? [...RECEIPT_CHAIN, { ...WORK4_RECEIPT_SPEC, path: work4ReceiptPath }]
    : [...RECEIPT_CHAIN];
  const receiptRecords = [];
  for (const spec of receiptChain) {
    receiptRecords.push(checkReceiptIdentity(root, spec, findings, cache));
  }
  for (let index = 1; index < RECEIPT_CHAIN.length; index += 1) {
    const current = receiptRecords[index];
    const predecessor = receiptRecords[index - 1];
    if (!current || !predecessor) continue;
    const predecessorId = predecessor[receiptChain[index - 1].idField];
    const fieldNames = PREDECESSOR_BIND_FIELDS[receiptChain[index].work] ?? [];
    if (!namedFieldEquals(current, fieldNames, predecessorId)) {
      findings.push(finding(
        'RECEIPT_IDENTITY_MISMATCH',
        receiptChain[index].path,
        `${receiptChain[index].work} does not bind predecessor ${receiptChain[index - 1].work} ${predecessorId} on ${fieldNames.join('|')}`,
      ));
    }
  }
  const work3 = receiptRecords[4];
  const work3Id = work3?.[RECEIPT_CHAIN[4].idField];
  if (work3Id && !registrationBindsWork3(registration, work3Id)) {
    findings.push(finding(
      'RECEIPT_IDENTITY_MISMATCH',
      registrationPath,
      `registration predecessor_receipt_bindings WORK3.record_id does not bind ${work3Id}`,
    ));
  }
  let supersededRegistrations = [];
  if (!work4ReceiptPath) {
    findings.push(finding(
      'NO_INDEPENDENT_SOURCE',
      registrationPath,
      'Work 4 receipt-of-record is a manifest parameter; pass --manifest to select it',
      'INFO',
    ));
  } else {
    const work4 = receiptRecords[5];
    if (work4 && work4.candidate_registration_id !== registration.candidate_registration_id) {
      findings.push(finding(
        'RECEIPT_IDENTITY_MISMATCH',
        work4ReceiptPath,
        `Work 4 candidate_registration_id ${work4.candidate_registration_id} != selected ${registration.candidate_registration_id}`,
      ));
    }
    supersededRegistrations = deriveSupersededRegistrations(
      root,
      work4,
      registration.candidate_registration_id,
      findings,
      cache,
    );
    findings.push(finding(
      'NO_INDEPENDENT_SOURCE',
      work4ReceiptPath,
      'Work 4 receipt does not embed the Work 3 receipt id; the hop is Work 3 → registration → Work 4',
      'INFO',
    ));
  }

  try {
    gitReadOnly(root, ['rev-parse', 'HEAD']);
  } catch {
    findings.push(finding('GIT_UNAVAILABLE', '.', 'rev-parse HEAD failed'));
  }

  const sortedFindings = findings
    .map((entry, index) => ({ ...entry, order: index }))
    .sort((left, right) => {
      if (left.path !== right.path) return left.path < right.path ? -1 : 1;
      if (left.code !== right.code) return left.code < right.code ? -1 : 1;
      return left.order - right.order;
    })
    .map(({ order, ...entry }) => entry);

  return finish(sortedFindings, recomputations, {
    candidate_registration_id: registration.candidate_registration_id,
    registration_path: registrationPath,
    registration_byte_length: registrationBytes.length,
    registration_sha256: sha256Hex(registrationBytes),
    counts: recomputed,
    declared_counts: declared,
    unique_bound_paths: [...declaredPaths].sort(),
    predecessor_chain: work4ReceiptPath
      ? ['WORK0', 'ACTIVATION', 'WORK1', 'WORK2', 'WORK3', 'REGISTRATION', 'WORK4']
      : ['WORK0', 'ACTIVATION', 'WORK1', 'WORK2', 'WORK3', 'REGISTRATION'],
    other_registrations: otherRegistrations,
    superseded_registrations: supersededRegistrations,
    work4_receipt_path: work4ReceiptPath,
    manifest_path: selection.manifestPath,
    manifest_id: selection.manifest?.execution_manifest_id ?? null,
    manifest_sha256: selection.manifestBytes ? sha256Hex(selection.manifestBytes) : null,
  });
}

function restampedManifestIdentity(record) {
  if (!isPlainObject(record) || typeof record.schema_version !== 'string') return null;
  const unsigned = { ...record };
  delete unsigned.execution_manifest_digest;
  delete unsigned.execution_manifest_id;
  const digest = sha256Hex(canonicalJson(unsigned));
  return {
    digest,
    id: contentId(record.schema_version, { ...unsigned, execution_manifest_digest: digest }),
  };
}

function deriveSupersededRegistrations(root, work4, selectedId, findings, cache) {
  const binding = work4?.superseded_work4_receipt_binding;
  if (!binding) return [];
  if (!isFileBinding(binding) && typeof binding.path !== 'string') {
    findings.push(finding(
      'BINDING_PATH_MISSING',
      work4.schema_version ?? 'WORK4',
      'V2 superseded_work4_receipt_binding has no path',
    ));
    return [];
  }
  checkFileBinding(root, 'work4.superseded_work4_receipt_binding', binding, findings, cache);
  const bytes = cache.get(binding.path);
  const record = cachedJson(cache, binding.path, bytes);
  const supersededId = record?.candidate_registration_id;
  if (typeof supersededId !== 'string' || !HEX_256.test(supersededId)) {
    findings.push(finding(
      'RECEIPT_IDENTITY_MISMATCH',
      binding.path,
      'superseded Work 4 receipt has no candidate_registration_id',
    ));
    return [];
  }
  if (supersededId === selectedId) {
    findings.push(finding(
      'RECEIPT_IDENTITY_MISMATCH',
      binding.path,
      `superseded Work 4 receipt candidate_registration_id equals the selected registration ${selectedId}`,
    ));
  }
  return [`${REGISTRATION_ROOT}/${supersededId}.json`];
}

function namedFieldEquals(record, fieldNames, identifier) {
  if (!isPlainObject(record) || typeof identifier !== 'string') return false;
  for (const name of fieldNames) {
    const value = record[name];
    if (value === identifier) return true;
    if (isPlainObject(value) && value.record_id === identifier) return true;
  }
  return false;
}

function registrationBindsWork3(registration, work3Id) {
  for (const entry of registration.predecessor_receipt_bindings ?? []) {
    if (entry.work !== 'WORK3') continue;
    const binding = entry.binding ?? entry;
    if (binding.record_id === work3Id) return true;
  }
  return false;
}

function observeAllowedOutputRoot(root, outputRoot, findings) {
  if (typeof outputRoot !== 'string' || outputRoot.length === 0) {
    findings.push(finding('NO_INDEPENDENT_SOURCE', '.', 'allowed_output_root is absent', 'INFO'));
    return;
  }
  if (outputRoot.startsWith('/') || outputRoot.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    findings.push(finding('BINDING_PATH_MISSING', outputRoot, 'allowed_output_root is not a repository-relative directory'));
    return;
  }
  const absolute = path.join(root, outputRoot);
  if (!fs.existsSync(absolute)) {
    findings.push(finding(
      'NO_INDEPENDENT_SOURCE',
      outputRoot,
      'allowed_output_root does not exist yet; 0 files observed',
      'INFO',
    ));
    return;
  }
  const files = [];
  const visit = (directory) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const full = path.join(directory, name);
      let stat;
      try {
        stat = fs.lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) visit(full);
      else if (stat.isFile()) files.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  visit(absolute);
  findings.push(finding(
    'NO_INDEPENDENT_SOURCE',
    outputRoot,
    `allowed_output_root observed ${files.length} file(s)`,
    'INFO',
  ));
}

function finish(findings, recomputations, extra) {
  const failFindings = findings.filter((entry) => entry.severity !== 'INFO');
  const status = failFindings.length === 0 ? 'PASS' : 'FAIL';
  return {
    schema_version: RESULT_SCHEMA,
    status,
    findings,
    recomputations: [...recomputations].sort((left, right) => (left.name < right.name ? -1 : 1)),
    ...extra,
  };
}

function parseArgv(argv) {
  const options = {};
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
    } else {
      throw new Error(`WORK7_INVALID: ${token}`);
    }
  }
  return options;
}

export {
  RESULT_SCHEMA,
  gitBlobOid,
  gitReadOnly,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = verifyWork7(parseArgv(process.argv));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      schema_version: RESULT_SCHEMA,
      status: 'FAIL',
      findings: [{
        code: 'WORK7_INVALID',
        path: '.',
        detail: error.message,
        severity: 'FAIL',
      }],
      recomputations: [],
    })}\n`);
    process.exitCode = 1;
  }
}
