import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const REGISTRATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
const VERIFICATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1';
const REGISTRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json';
const ACTIVATION_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json';
const WORK0_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json';
const WORK1_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json';
const OUTPUT_ROOT_PREFIX = 'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/';
const AUTHORITY_ID = 'ba63c1e57e5eb486e666e31e193a1dc21cf24f7a3918eace0ae6a6949f9359f7';
const AUTHORITY_DIGEST = '25ac58d418638432586a5cb24c1cfb766ba1440b77d992afc434ed71d1055afc';
const AUTHORITY_SHA256 = '7e858b96fc46a69d7533e8b5ac3cad4a6142c2f30fd71ecfbd8771709e0cdd3c';
const ACTIVATION_ID = '7821c19a5aaae6f974599cefc8460fb88b8f2302fcefbdde4c0efbadbdea0d7a';
const ACTIVATION_DIGEST = 'cc0e8dbf4ae94ef34cc7b21eecf2122aba76309ba0441a8a062ca81a05224176';
const ACTIVATION_SHA256 = 'f0401bb7f75fe72b7719663573ab75581aecffeb2949618b991ec41e54f1c578';
const WORK0_ID = '885d404502276d85af385fce20cd93b601f09a30a3300c371df870337f7d5fab';
const WORK0_SHA256 = '04e010105dcb4b449b7f8e3aa05fb3bec69cdada8d385999e7c86a8150eaff83';
const HEX_256 = /^[0-9a-f]{64}$/;
const BINDING_KEYS = [
  'byte_length',
  'git_blob_oid',
  'path',
  'record_id',
  'record_id_field',
  'schema_version',
  'sha256',
];
const RECORD_KEYS = [
  'activation_receipt_binding',
  'allowed_output_root',
  'candidate_registration_id',
  'code_bindings',
  'counts',
  'effects',
  'family_profile_set_binding',
  'lifecycle_state',
  'parent_authority_binding',
  'predecessor_receipt_bindings',
  'schema_version',
  'semantic_input_bindings',
  'stage',
  'structure_disposition_set_binding',
  'subtype_tree_bindings',
  'view_policy_binding',
  'work0_evidence_root_binding',
];
const CODE_KEYS = [
  'compiler',
  'contract_validator',
  'deterministic_generator',
  'independent_verifier',
  'projector',
  'runners',
  'tests',
];
const REQUIRED_RUNNERS = Object.freeze([
  'scripts/stage-2y-structure-family-aggregate.mjs',
  'scripts/stage-2y-structure-generalisation-shadow.mjs',
  'scripts/stage-2y-structure-m6-project.mjs',
]);
const WORK1_TESTS = Object.freeze([
  'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
  'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js',
  'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
]);
const SEMANTIC_INPUTS = Object.freeze([
  Object.freeze(['BASE_ANALYSIS_SET', 'AGREEMENT_ANALYSIS_SET/V1']),
  Object.freeze(['AGREEMENT_INDEX_SET', 'AGREEMENT_INDEX_SET/V1']),
  Object.freeze(['CONTEXT_COMPILATION_SET', 'CONTEXT_COMPILATION_SET/V1']),
  Object.freeze(['APPROVED_FAMILY_PACKET_SET', 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1']),
  Object.freeze(['APPROVED_FAMILY_PROFILE_SET', 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1']),
  Object.freeze(['APPROVED_STRUCTURE_DISPOSITION_SET', 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1']),
]);
const FAMILIES = Object.freeze([
  'ANTITRUST_REGULATORY',
  'APPRAISAL_DISSENTERS_RIGHTS',
  'CAPITALISATION',
  'CLOSING_CONDITIONS',
  'CONSIDERATION',
  'DIVIDENDS',
  'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS',
  'FINANCING_COVENANTS',
  'GENERAL_COVENANTS',
  'GUARANTY_FINANCING_PARTY',
  'INTERIM_OPERATING',
  'KEY_DEFINED_TERMS',
  'MAE_DEFINITION',
  'MATERIAL_CONTRACTS',
  'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE',
  'NO_OTHER_REPS_FRAUD',
  'NO_SHOP',
  'PROXY_MEETING',
  'REPRESENTATIONS',
  'SPECIFIC_PERFORMANCE_REMEDIES',
  'TAX_MATTERS',
  'TERMINATION',
  'TERMINATION_FEE',
]);
const CHECK_IDS = Object.freeze([
  'REGISTRATION_SELF_IDENTITY',
  'AUTHORITY_AND_WORK0_BINDINGS',
  'REQUIRED_COMPONENT_BINDINGS',
  'SIX_SEMANTIC_INPUT_BINDINGS',
  'TWENTY_FIVE_SUBTYPE_TREE_BINDINGS',
  'PREDECESSOR_AND_OUTPUT_SCOPE',
  'ZERO_PROHIBITED_EFFECTS',
]);
const EXPECTED_REGISTRATION_EFFECTS = Object.freeze({
  registration_file_writes: 1,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
});
const VERIFICATION_EFFECTS = Object.freeze({
  files_written: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
});
const EXECUTING_VERIFIER_BYTES = fs.readFileSync(fileURLToPath(import.meta.url));

class CandidateVerificationError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'CandidateVerificationError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new CandidateVerificationError(code, detail);
}

function assert(condition, code, detail = '') {
  if (!condition) fail(code, detail);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  return isPlainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function same(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
}

function gitBlobOid(bytes) {
  return crypto.createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function normaliseRoot(repoRoot) {
  assert(typeof repoRoot === 'string' && repoRoot.length > 0, 'INVALID_OPTIONS', 'repoRoot');
  const resolved = path.resolve(repoRoot);
  let real;
  try {
    real = fs.realpathSync.native(resolved);
  } catch {
    fail('PATH_SAFETY', 'repoRoot');
  }
  const stat = fs.lstatSync(real);
  assert(resolved === real && stat.isDirectory() && !stat.isSymbolicLink(), 'PATH_SAFETY', 'repoRoot');
  return real;
}

function validateRepositoryPath(repositoryPath) {
  assert(typeof repositoryPath === 'string' && repositoryPath.length > 0,
    'PATH_SAFETY', String(repositoryPath));
  assert(!path.posix.isAbsolute(repositoryPath), 'PATH_SAFETY', repositoryPath);
  assert(!repositoryPath.includes('\\') && !repositoryPath.includes('\0'), 'PATH_SAFETY', repositoryPath);
  const segments = repositoryPath.split('/');
  assert(segments.every((segment) => segment && segment !== '.' && segment !== '..'),
    'PATH_SAFETY', repositoryPath);
  assert(!/[?*\[\]{}]/.test(repositoryPath), 'PATH_SAFETY', repositoryPath);
  return repositoryPath;
}

function resolvePath(root, repositoryPath, { allowMissingLeaf = false } = {}) {
  validateRepositoryPath(repositoryPath);
  const segments = repositoryPath.split('/');
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (allowMissingLeaf && error.code === 'ENOENT') return path.join(root, ...segments);
      fail('PATH_SAFETY', repositoryPath);
    }
    assert(!stat.isSymbolicLink(), 'PATH_SAFETY', repositoryPath);
    if (index < segments.length - 1) assert(stat.isDirectory(), 'PATH_SAFETY', repositoryPath);
  }
  return current;
}

function readBytes(root, repositoryPath, code = 'BINDING_DRIFT') {
  let absolute;
  try {
    absolute = resolvePath(root, repositoryPath);
  } catch (error) {
    if (error instanceof CandidateVerificationError && error.code === 'PATH_SAFETY') {
      fail(code, repositoryPath);
    }
    throw error;
  }
  const stat = fs.lstatSync(absolute);
  assert(stat.isFile() && !stat.isSymbolicLink(), code, repositoryPath);
  return fs.readFileSync(absolute);
}

function parseJson(bytes, code, detail) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code, detail);
  }
}

function verifyBinding(root, binding, expected = {}) {
  assert(exactKeys(binding, BINDING_KEYS), 'REGISTRATION_CONTRACT_DRIFT', 'binding members');
  validateRepositoryPath(binding.path);
  assert(Number.isSafeInteger(binding.byte_length) && binding.byte_length > 0
    && HEX_256.test(binding.sha256 || '')
    && /^[0-9a-f]{40}$/.test(binding.git_blob_oid || ''),
  'REGISTRATION_CONTRACT_DRIFT', binding.path);
  if (binding.schema_version === null) {
    assert(binding.record_id_field === null && binding.record_id === null,
      'REGISTRATION_CONTRACT_DRIFT', binding.path);
  } else {
    assert(typeof binding.schema_version === 'string'
      && typeof binding.record_id_field === 'string'
      && HEX_256.test(binding.record_id || ''),
    'REGISTRATION_CONTRACT_DRIFT', binding.path);
  }
  if (expected.path !== undefined) assert(binding.path === expected.path, 'REGISTRATION_CONTRACT_DRIFT', binding.path);
  if (expected.schema_version !== undefined) {
    const code = expected.v1_forbidden && /AGREEMENT_ANALYSIS\/V1|AGREEMENT_PROJECTION\/V1|STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA\/V1/.test(binding.schema_version || '')
      ? 'V1_SEMANTIC_FALLBACK' : 'REGISTRATION_CONTRACT_DRIFT';
    assert(binding.schema_version === expected.schema_version, code, binding.path);
  }
  if (expected.record_id_field !== undefined) {
    assert(binding.record_id_field === expected.record_id_field,
      'REGISTRATION_CONTRACT_DRIFT', binding.path);
  }
  const bytes = readBytes(root, binding.path);
  assert(bytes.length === binding.byte_length
    && sha256Hex(bytes) === binding.sha256
    && gitBlobOid(bytes) === binding.git_blob_oid,
  'BINDING_DRIFT', binding.path);
  if (binding.schema_version !== null) {
    const value = parseJson(bytes, 'BINDING_DRIFT', binding.path);
    assert(bytes.equals(canonicalBytes(value)), 'BINDING_DRIFT', `${binding.path}:canonical`);
    assert(value?.schema_version === binding.schema_version
      && value?.[binding.record_id_field] === binding.record_id,
    'BINDING_DRIFT', binding.path);
    const unsigned = structuredClone(value);
    delete unsigned[binding.record_id_field];
    assert(contentId(binding.schema_version, unsigned) === binding.record_id,
      'BINDING_DRIFT', `${binding.path}:self_identity`);
  }
  return bytes;
}

function requiredTests(predecessorCount) {
  const later = Array.from({ length: predecessorCount }, (_, index) => (
    `tests/stage-2y-structure-m7-v2-repair-work${index + 2}.test.js`
  ));
  return [...WORK1_TESTS, ...later].sort();
}

function verifyCode(root, code, predecessorCount) {
  assert(exactKeys(code, CODE_KEYS), 'REGISTRATION_CONTRACT_DRIFT', 'code_bindings');
  for (const key of CODE_KEYS.slice(0, 5)) verifyBinding(root, code[key]);
  assert(code.compiler.path === 'lib/canonical-v2/agreement-analysis-consolidation.js'
    && code.deterministic_generator.path === 'lib/canonical-v2/m7-v2-deterministic-generator.js'
    && code.contract_validator.path === 'lib/canonical-v2/m7-v2-contract.js'
    && code.projector.path === 'lib/canonical-v2/agreement-projection.js'
    && code.independent_verifier.path === 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
  'REGISTRATION_CONTRACT_DRIFT', 'code paths');
  const registeredVerifierBytes = readBytes(root, code.independent_verifier.path);
  assert(registeredVerifierBytes.equals(EXECUTING_VERIFIER_BYTES),
    'BINDING_DRIFT', 'executing independent verifier');
  for (const key of ['runners', 'tests']) {
    assert(Array.isArray(code[key]) && code[key].length > 0, 'REGISTRATION_CONTRACT_DRIFT', key);
    const paths = code[key].map((binding) => binding.path);
    assert(new Set(paths).size === paths.length
      && same(paths, [...paths].sort()), 'REGISTRATION_CONTRACT_DRIFT', `${key}:order`);
    for (const binding of code[key]) verifyBinding(root, binding);
  }
  assert(code.runners.every((binding) => binding.path.startsWith('scripts/') && binding.path.endsWith('.mjs')),
    'REGISTRATION_CONTRACT_DRIFT', 'runners');
  assert(code.tests.every((binding) => binding.path.startsWith('tests/') && binding.path.endsWith('.test.js')),
    'REGISTRATION_CONTRACT_DRIFT', 'tests');
  assert(same(code.runners.map((binding) => binding.path), [...REQUIRED_RUNNERS].sort())
    && same(code.tests.map((binding) => binding.path), requiredTests(predecessorCount)),
  'REGISTRATION_CONTRACT_DRIFT', 'code closed set');
}

function verifySemanticInputs(root, entries) {
  assert(Array.isArray(entries) && entries.length === SEMANTIC_INPUTS.length,
    'REGISTRATION_CONTRACT_DRIFT', 'semantic_input_bindings');
  assert(same(entries.map((entry) => entry.input_role), SEMANTIC_INPUTS.map(([role]) => role)),
    'REGISTRATION_CONTRACT_DRIFT', 'semantic input role order');
  for (let index = 0; index < SEMANTIC_INPUTS.length; index += 1) {
    const [role, schemaVersion] = SEMANTIC_INPUTS[index];
    const entry = entries[index];
    assert(exactKeys(entry, ['binding', 'input_role']) && entry.input_role === role,
      'REGISTRATION_CONTRACT_DRIFT', role);
    verifyBinding(root, entry.binding, { schema_version: schemaVersion, v1_forbidden: true });
  }
}

function verifySubtypeTrees(root, entries) {
  assert(Array.isArray(entries) && entries.length === FAMILIES.length,
    'REGISTRATION_CONTRACT_DRIFT', 'subtype_tree_bindings');
  assert(same(entries.map((entry) => entry.family_key), FAMILIES),
    'REGISTRATION_CONTRACT_DRIFT', 'subtype tree family order');
  for (const entry of entries) {
    assert(exactKeys(entry, ['binding', 'family_key']), 'REGISTRATION_CONTRACT_DRIFT', entry.family_key);
    const bytes = verifyBinding(root, entry.binding, {
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1',
      record_id_field: 'subtype_tree_id',
    });
    const value = parseJson(bytes, 'BINDING_DRIFT', entry.binding.path);
    assert(value.family_key === entry.family_key, 'BINDING_DRIFT', `${entry.family_key}:family_key`);
  }
}

function executionManifestPath(work) {
  return `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-${work.toLowerCase()}-execution-manifest.json`;
}

function validateExecutionManifestBasis(root, work) {
  const repositoryPath = executionManifestPath(work);
  const bytes = readBytes(root, repositoryPath, 'BINDING_DRIFT');
  const record = parseJson(bytes, 'BINDING_DRIFT', repositoryPath);
  assert(bytes.equals(canonicalBytes(record)), 'BINDING_DRIFT', `${repositoryPath}:canonical`);
  assert(record?.schema_version === 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V1'
    && record.work === work
    && record.state === 'PRE_WORK_BOOTSTRAP_ONLY'
    && typeof record.execution_manifest_digest === 'string'
    && HEX_256.test(record.execution_manifest_id || ''),
  'BINDING_DRIFT', `${repositoryPath}:contract`);
  const unsigned = structuredClone(record);
  delete unsigned.execution_manifest_digest;
  delete unsigned.execution_manifest_id;
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, execution_manifest_digest: digest };
  assert(record.execution_manifest_digest === digest
    && record.execution_manifest_id === contentId(record.schema_version, withDigest)
    && record.parent_authority_binding?.authority_id === AUTHORITY_ID
    && record.parent_authority_binding?.authority_digest === AUTHORITY_DIGEST
    && record.parent_authority_binding?.sha256 === AUTHORITY_SHA256,
  'BINDING_DRIFT', `${repositoryPath}:authority`);
  validateRepositoryPath(record.work_receipt_path);
  assert(new RegExp(`^evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-${work.toLowerCase()}-[a-z0-9-]+\\.json$`).test(
    record.work_receipt_path,
  ), 'BINDING_DRIFT', `${repositoryPath}:receipt path`);
  return record.work_receipt_path;
}

function expectedReceiptContract(root, work) {
  const number = Number(work.slice(4));
  if (number === 1) {
    return {
      path: WORK1_RECEIPT_PATH,
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1',
      record_id_field: 'work1_contract_receipt_id',
    };
  }
  return {
    path: validateExecutionManifestBasis(root, work),
    schema_version: `STAGE_2Y_M7_V2_REPAIR_WORK${number}_RECEIPT/V1`,
    record_id_field: `work${number}_receipt_id`,
  };
}

function verifyPredecessors(root, entries) {
  assert(Array.isArray(entries) && entries.length > 0 && entries.length <= 5,
    'REGISTRATION_CONTRACT_DRIFT', 'predecessor_receipt_bindings');
  const expectedOrder = [...entries].sort(
    (left, right) => Number(left.work.slice(4)) - Number(right.work.slice(4)),
  );
  assert(same(entries, expectedOrder), 'REGISTRATION_CONTRACT_DRIFT', 'predecessor order');
  assert(same(entries.map((entry) => entry.work),
    Array.from({ length: entries.length }, (_, index) => `WORK${index + 1}`)),
  'REGISTRATION_CONTRACT_DRIFT', 'predecessor closed set');
  const works = new Set();
  for (const entry of entries) {
    assert(exactKeys(entry, ['binding', 'work']) && /^WORK[1-7]$/.test(entry.work) && !works.has(entry.work),
      'REGISTRATION_CONTRACT_DRIFT', 'predecessor work');
    works.add(entry.work);
    const expected = expectedReceiptContract(root, entry.work);
    assert(entry.binding.path === expected.path
      && entry.binding.schema_version === expected.schema_version
      && entry.binding.record_id_field === expected.record_id_field,
    'REGISTRATION_CONTRACT_DRIFT', `${entry.work}:receipt contract`);
    const bytes = verifyBinding(root, entry.binding, expected);
    const receipt = parseJson(bytes, 'BINDING_DRIFT', entry.binding.path);
    assert(receipt.status === 'PASS'
      && typeof receipt.state === 'string' && receipt.state.startsWith('PASS')
      && (receipt.stage === undefined || receipt.stage === `M7_V2_REPAIR_${entry.work}`)
      && (receipt.work === undefined || receipt.work === entry.work),
    'BINDING_DRIFT', `${entry.work}:receipt state`);
  }
}

function currentFixedBinding(root, repositoryPath, schemaVersion, idField) {
  const bytes = readBytes(root, repositoryPath, 'AUTHORITY_BINDING_DRIFT');
  const value = parseJson(bytes, 'AUTHORITY_BINDING_DRIFT', repositoryPath);
  assert(bytes.equals(canonicalBytes(value)), 'AUTHORITY_BINDING_DRIFT', `${repositoryPath}:canonical`);
  assert(value?.schema_version === schemaVersion && HEX_256.test(value?.[idField] || ''),
    'AUTHORITY_BINDING_DRIFT', repositoryPath);
  const unsigned = structuredClone(value);
  delete unsigned[idField];
  assert(contentId(schemaVersion, unsigned) === value[idField],
    'AUTHORITY_BINDING_DRIFT', `${repositoryPath}:identity`);
  return {
    value,
    binding: {
      path: repositoryPath,
      schema_version: schemaVersion,
      record_id_field: idField,
      record_id: value[idField],
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      git_blob_oid: gitBlobOid(bytes),
    },
  };
}

function verifyGovernance(root, registration) {
  const authority = currentFixedBinding(
    root,
    AUTHORITY_PATH,
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1',
    'authority_id',
  );
  const activation = currentFixedBinding(
    root,
    ACTIVATION_PATH,
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1',
    'activation_receipt_id',
  );
  const work0 = currentFixedBinding(
    root,
    WORK0_PATH,
    'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1',
    'evidence_root_id',
  );
  assert(same(registration.parent_authority_binding, authority.binding)
    && same(registration.activation_receipt_binding, activation.binding)
    && same(registration.work0_evidence_root_binding, work0.binding)
    && activation.value.state === 'PASS_AUTHORITY_ACTIVATION'
    && authority.value.authority_id === AUTHORITY_ID
    && authority.value.authority_digest === AUTHORITY_DIGEST
    && authority.binding.sha256 === AUTHORITY_SHA256
    && activation.value.activation_receipt_id === ACTIVATION_ID
    && activation.value.activation_receipt_digest === ACTIVATION_DIGEST
    && activation.binding.sha256 === ACTIVATION_SHA256
    && work0.value.evidence_root_id === WORK0_ID
    && work0.binding.sha256 === WORK0_SHA256
    && activation.value.authority_binding?.record_id === authority.value.authority_id
    && authority.value.work0_evidence_root_binding?.evidence_root_id === work0.value.evidence_root_id,
  'AUTHORITY_BINDING_DRIFT', 'governance chain');
}

function flattenedBindings(registration) {
  return [
    registration.parent_authority_binding,
    registration.activation_receipt_binding,
    registration.work0_evidence_root_binding,
    registration.code_bindings.compiler,
    registration.code_bindings.deterministic_generator,
    registration.code_bindings.contract_validator,
    registration.code_bindings.projector,
    registration.code_bindings.independent_verifier,
    ...registration.code_bindings.runners,
    ...registration.code_bindings.tests,
    ...registration.semantic_input_bindings.map((entry) => entry.binding),
    ...registration.subtype_tree_bindings.map((entry) => entry.binding),
    registration.view_policy_binding,
    ...registration.predecessor_receipt_bindings.map((entry) => entry.binding),
  ];
}

function verifyRegistration(root, registration) {
  assert(exactKeys(registration, RECORD_KEYS)
    && registration.schema_version === REGISTRATION_SCHEMA
    && registration.stage === 'M7_V2_REPAIR'
    && registration.lifecycle_state === 'CANDIDATE_PENDING_REVIEW'
    && same(registration.effects, EXPECTED_REGISTRATION_EFFECTS),
  'REGISTRATION_CONTRACT_DRIFT', 'registration envelope');
  verifyGovernance(root, registration);
  verifyCode(root, registration.code_bindings, registration.predecessor_receipt_bindings.length);
  verifySemanticInputs(root, registration.semantic_input_bindings);
  const profileBinding = registration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  ).binding;
  const structureBinding = registration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_STRUCTURE_DISPOSITION_SET',
  ).binding;
  assert(same(registration.family_profile_set_binding, profileBinding)
    && same(registration.structure_disposition_set_binding, structureBinding),
  'REGISTRATION_CONTRACT_DRIFT', 'direct semantic bindings');
  verifySubtypeTrees(root, registration.subtype_tree_bindings);
  verifyBinding(root, registration.view_policy_binding, {
    schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1',
    record_id_field: 'view_policy_id',
  });
  verifyPredecessors(root, registration.predecessor_receipt_bindings);
  validateRepositoryPath(registration.allowed_output_root);
  assert(registration.allowed_output_root.startsWith(OUTPUT_ROOT_PREFIX),
    'REGISTRATION_CONTRACT_DRIFT', 'allowed_output_root');
  const outputAbsolute = resolvePath(root, registration.allowed_output_root, { allowMissingLeaf: true });
  if (fs.existsSync(outputAbsolute)) {
    const stat = fs.lstatSync(outputAbsolute);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), 'PATH_SAFETY', registration.allowed_output_root);
  }
  const expectedCounts = {
    code_file_count: 5 + registration.code_bindings.runners.length + registration.code_bindings.tests.length,
    runner_count: registration.code_bindings.runners.length,
    test_count: registration.code_bindings.tests.length,
    semantic_input_count: registration.semantic_input_bindings.length,
    subtype_tree_count: registration.subtype_tree_bindings.length,
    predecessor_receipt_count: registration.predecessor_receipt_bindings.length,
    unique_bound_path_count: new Set(flattenedBindings(registration).map((binding) => binding.path)).size,
  };
  assert(same(registration.counts, expectedCounts), 'REGISTRATION_CONTRACT_DRIFT', 'counts');
  for (const binding of flattenedBindings(registration)) verifyBinding(root, binding);
}

function registrationBinding(repositoryPath, bytes, registration) {
  return {
    path: repositoryPath,
    schema_version: REGISTRATION_SCHEMA,
    record_id_field: 'candidate_registration_id',
    record_id: registration.candidate_registration_id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

export function verifyRegisteredCandidate({ repoRoot, registrationPath } = {}) {
  const root = normaliseRoot(repoRoot);
  validateRepositoryPath(registrationPath);
  const match = new RegExp(`^${REGISTRATION_ROOT}/([0-9a-f]{64})\\.json$`).exec(registrationPath);
  assert(match, 'REGISTRATION_PATH_DRIFT', registrationPath);
  const bytes = readBytes(root, registrationPath, 'REGISTRATION_MISSING');
  const registration = parseJson(bytes, 'REGISTRATION_IDENTITY_DRIFT', registrationPath);
  assert(bytes.equals(canonicalBytes(registration)), 'REGISTRATION_IDENTITY_DRIFT', 'canonical bytes');
  const unsigned = structuredClone(registration);
  delete unsigned.candidate_registration_id;
  const expectedId = contentId(REGISTRATION_SCHEMA, unsigned);
  assert(registration.schema_version === REGISTRATION_SCHEMA
    && registration.candidate_registration_id === expectedId,
  'REGISTRATION_IDENTITY_DRIFT', registrationPath);
  assert(match[1] === expectedId, 'REGISTRATION_PATH_DRIFT', registrationPath);
  verifyRegistration(root, registration);
  const counts = structuredClone(registration.counts);
  const unsignedResult = {
    schema_version: VERIFICATION_SCHEMA,
    state: 'PASS_CANDIDATE_REGISTRATION',
    candidate_registration_id: registration.candidate_registration_id,
    registration_binding: registrationBinding(registrationPath, bytes, registration),
    checks: CHECK_IDS.map((check_id) => ({ check_id, status: 'PASS' })),
    counts,
    effects: VERIFICATION_EFFECTS,
  };
  return {
    schema_version: VERIFICATION_SCHEMA,
    verification_id: contentId(VERIFICATION_SCHEMA, unsignedResult),
    ...Object.fromEntries(Object.entries(unsignedResult).filter(([key]) => key !== 'schema_version')),
  };
}
