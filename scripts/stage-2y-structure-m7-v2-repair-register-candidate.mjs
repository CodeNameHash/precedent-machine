import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const REGISTRATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
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
const DESCRIPTOR_KEYS = ['path', 'record_id_field', 'schema_version'];
const SPECIFICATION_KEYS = [
  'allowed_output_root',
  'code',
  'predecessor_receipts',
  'semantic_inputs',
  'subtype_trees',
  'view_policy',
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
const ZERO_EFFECTS = Object.freeze({
  registration_file_writes: 1,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
});

class CandidateRegistrationError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'CandidateRegistrationError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new CandidateRegistrationError(code, detail);
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

function validateRepositoryPath(repositoryPath, code = 'PATH_SAFETY') {
  assert(typeof repositoryPath === 'string' && repositoryPath.length > 0, code, String(repositoryPath));
  assert(!path.posix.isAbsolute(repositoryPath), code, repositoryPath);
  assert(!repositoryPath.includes('\\') && !repositoryPath.includes('\0'), code, repositoryPath);
  const segments = repositoryPath.split('/');
  assert(segments.every((segment) => segment && segment !== '.' && segment !== '..'), code, repositoryPath);
  assert(!/[?*\[\]{}]/.test(repositoryPath), code, repositoryPath);
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
  const absolute = resolvePath(root, repositoryPath);
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

function standardBinding(repositoryPath, bytes, schemaVersion = null, recordIdField = null, recordId = null) {
  return {
    path: repositoryPath,
    schema_version: schemaVersion,
    record_id_field: recordIdField,
    record_id: recordId,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function bindingForCode(root, repositoryPath) {
  validateRepositoryPath(repositoryPath);
  return standardBinding(repositoryPath, readBytes(root, repositoryPath));
}

function validateDescriptor(descriptor, extraKey = null) {
  const keys = extraKey ? [...DESCRIPTOR_KEYS, extraKey] : DESCRIPTOR_KEYS;
  assert(exactKeys(descriptor, keys), 'INVALID_SPECIFICATION', extraKey || 'record descriptor');
  validateRepositoryPath(descriptor.path);
  assert(typeof descriptor.schema_version === 'string' && descriptor.schema_version.length > 0,
    'INVALID_SPECIFICATION', `${descriptor.path}:schema_version`);
  assert(typeof descriptor.record_id_field === 'string' && descriptor.record_id_field.length > 0,
    'INVALID_SPECIFICATION', `${descriptor.path}:record_id_field`);
}

function bindingForRecord(root, descriptor) {
  validateDescriptor(descriptor);
  const bytes = readBytes(root, descriptor.path);
  const value = parseJson(bytes, 'BINDING_DRIFT', descriptor.path);
  assert(bytes.equals(canonicalBytes(value)), 'BINDING_DRIFT', `${descriptor.path}:canonical`);
  assert(value?.schema_version === descriptor.schema_version, 'BINDING_DRIFT', `${descriptor.path}:schema_version`);
  const recordId = value?.[descriptor.record_id_field];
  assert(typeof recordId === 'string' && HEX_256.test(recordId), 'BINDING_DRIFT', `${descriptor.path}:record_id`);
  const unsigned = structuredClone(value);
  delete unsigned[descriptor.record_id_field];
  assert(contentId(descriptor.schema_version, unsigned) === recordId,
    'BINDING_DRIFT', `${descriptor.path}:self_identity`);
  return standardBinding(
    descriptor.path,
    bytes,
    descriptor.schema_version,
    descriptor.record_id_field,
    recordId,
  );
}

function fixedRecordBinding(root, repositoryPath, expectedSchema, idField) {
  const bytes = readBytes(root, repositoryPath, 'AUTHORITY_BINDING_DRIFT');
  const value = parseJson(bytes, 'AUTHORITY_BINDING_DRIFT', repositoryPath);
  assert(bytes.equals(canonicalBytes(value)), 'AUTHORITY_BINDING_DRIFT', `${repositoryPath}:canonical`);
  assert(value?.schema_version === expectedSchema, 'AUTHORITY_BINDING_DRIFT', repositoryPath);
  assert(typeof value?.[idField] === 'string' && HEX_256.test(value[idField]),
    'AUTHORITY_BINDING_DRIFT', `${repositoryPath}:${idField}`);
  const unsigned = structuredClone(value);
  delete unsigned[idField];
  assert(contentId(expectedSchema, unsigned) === value[idField], 'AUTHORITY_BINDING_DRIFT', `${repositoryPath}:identity`);
  return { value, binding: standardBinding(repositoryPath, bytes, expectedSchema, idField, value[idField]) };
}

function validateAuthorityChain(root) {
  const authority = fixedRecordBinding(
    root,
    AUTHORITY_PATH,
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1',
    'authority_id',
  );
  const activation = fixedRecordBinding(
    root,
    ACTIVATION_PATH,
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1',
    'activation_receipt_id',
  );
  const work0 = fixedRecordBinding(
    root,
    WORK0_PATH,
    'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1',
    'evidence_root_id',
  );
  assert(activation.value.state === 'PASS_AUTHORITY_ACTIVATION', 'AUTHORITY_BINDING_DRIFT', 'activation state');
  assert(authority.value.authority_id === AUTHORITY_ID
    && authority.value.authority_digest === AUTHORITY_DIGEST
    && authority.binding.sha256 === AUTHORITY_SHA256
    && activation.value.activation_receipt_id === ACTIVATION_ID
    && activation.value.activation_receipt_digest === ACTIVATION_DIGEST
    && activation.binding.sha256 === ACTIVATION_SHA256
    && work0.value.evidence_root_id === WORK0_ID
    && work0.binding.sha256 === WORK0_SHA256,
  'AUTHORITY_BINDING_DRIFT', 'fixed programme records');
  assert(activation.value.authority_binding?.record_id === authority.value.authority_id
    && activation.value.authority_binding?.sha256 === authority.binding.sha256,
  'AUTHORITY_BINDING_DRIFT', 'activation authority binding');
  assert(authority.value.work0_evidence_root_binding?.evidence_root_id === work0.value.evidence_root_id
    && authority.value.work0_evidence_root_binding?.sha256 === work0.binding.sha256,
  'AUTHORITY_BINDING_DRIFT', 'Work0 evidence root');
  return { authority: authority.binding, activation: activation.binding, work0: work0.binding };
}

function requiredTests(predecessorCount) {
  const later = Array.from({ length: predecessorCount }, (_, index) => (
    `tests/stage-2y-structure-m7-v2-repair-work${index + 2}.test.js`
  ));
  return [...WORK1_TESTS, ...later].sort();
}

function validateCode(root, code, predecessorCount) {
  assert(exactKeys(code, CODE_KEYS), 'INVALID_SPECIFICATION', 'code');
  for (const key of CODE_KEYS.slice(0, 5)) {
    assert(typeof code[key] === 'string', 'INVALID_SPECIFICATION', `code.${key}`);
    validateRepositoryPath(code[key]);
  }
  for (const key of ['runners', 'tests']) {
    assert(Array.isArray(code[key]) && code[key].length > 0
      && code[key].every((entry) => typeof entry === 'string'), 'INVALID_SPECIFICATION', `code.${key}`);
    assert(new Set(code[key]).size === code[key].length, 'INVALID_SPECIFICATION', `code.${key}:duplicate`);
    code[key].forEach((repositoryPath) => validateRepositoryPath(repositoryPath));
  }
  assert(code.compiler === 'lib/canonical-v2/agreement-analysis-consolidation.js',
    'INVALID_SPECIFICATION', 'compiler');
  assert(code.deterministic_generator === 'lib/canonical-v2/m7-v2-deterministic-generator.js',
    'INVALID_SPECIFICATION', 'deterministic generator');
  assert(code.contract_validator === 'lib/canonical-v2/m7-v2-contract.js',
    'INVALID_SPECIFICATION', 'contract validator');
  assert(code.projector === 'lib/canonical-v2/agreement-projection.js',
    'INVALID_SPECIFICATION', 'projector');
  assert(code.independent_verifier === 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
    'INVALID_SPECIFICATION', 'independent verifier');
  assert(canonicalJson([...code.runners].sort()) === canonicalJson([...REQUIRED_RUNNERS].sort()),
    'INVALID_SPECIFICATION', 'runners:closed set');
  assert(canonicalJson([...code.tests].sort()) === canonicalJson(requiredTests(predecessorCount)),
    'INVALID_SPECIFICATION', 'tests:closed set');
  return {
    compiler: bindingForCode(root, code.compiler),
    deterministic_generator: bindingForCode(root, code.deterministic_generator),
    contract_validator: bindingForCode(root, code.contract_validator),
    projector: bindingForCode(root, code.projector),
    independent_verifier: bindingForCode(root, code.independent_verifier),
    runners: [...code.runners].sort().map((repositoryPath) => bindingForCode(root, repositoryPath)),
    tests: [...code.tests].sort().map((repositoryPath) => bindingForCode(root, repositoryPath)),
  };
}

function validateSemanticInputs(root, descriptors) {
  assert(Array.isArray(descriptors) && descriptors.length === SEMANTIC_INPUTS.length,
    'INVALID_SPECIFICATION', 'semantic_inputs');
  const byRole = new Map();
  for (const descriptor of descriptors) {
    validateDescriptor(descriptor, 'input_role');
    assert(typeof descriptor.input_role === 'string' && !byRole.has(descriptor.input_role),
      'INVALID_SPECIFICATION', 'semantic input role');
    byRole.set(descriptor.input_role, descriptor);
  }
  return SEMANTIC_INPUTS.map(([inputRole, schemaVersion]) => {
    const descriptor = byRole.get(inputRole);
    const forbiddenV1 = /^(?:AGREEMENT_ANALYSIS|AGREEMENT_PROJECTION|AGREEMENT_ANALYSIS_ROLE|STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA)\/V1$/.test(
      descriptor?.schema_version || '',
    );
    assert(descriptor && descriptor.schema_version === schemaVersion,
      forbiddenV1 ? 'V1_SEMANTIC_FALLBACK' : 'INVALID_SPECIFICATION', inputRole);
    return {
      input_role: inputRole,
      binding: bindingForRecord(root, {
        path: descriptor.path,
        record_id_field: descriptor.record_id_field,
        schema_version: descriptor.schema_version,
      }),
    };
  });
}

function validateSubtypeTrees(root, descriptors) {
  assert(Array.isArray(descriptors) && descriptors.length === FAMILIES.length,
    'INVALID_SPECIFICATION', 'subtype_trees');
  const byFamily = new Map();
  for (const descriptor of descriptors) {
    validateDescriptor(descriptor, 'family_key');
    assert(typeof descriptor.family_key === 'string' && !byFamily.has(descriptor.family_key),
      'INVALID_SPECIFICATION', 'subtype tree family');
    byFamily.set(descriptor.family_key, descriptor);
  }
  return FAMILIES.map((familyKey) => {
    const descriptor = byFamily.get(familyKey);
    assert(descriptor
      && descriptor.schema_version === 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1'
      && descriptor.record_id_field === 'subtype_tree_id',
    'INVALID_SPECIFICATION', familyKey);
    const binding = bindingForRecord(root, {
      path: descriptor.path,
      record_id_field: descriptor.record_id_field,
      schema_version: descriptor.schema_version,
    });
    const record = parseJson(readBytes(root, descriptor.path), 'BINDING_DRIFT', descriptor.path);
    assert(record.family_key === familyKey, 'BINDING_DRIFT', `${familyKey}:family_key`);
    return { family_key: familyKey, binding };
  });
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

function validatePredecessors(root, descriptors) {
  assert(Array.isArray(descriptors) && descriptors.length > 0 && descriptors.length <= 5,
    'INVALID_SPECIFICATION', 'predecessor_receipts');
  const seen = new Set();
  const result = [];
  for (const descriptor of descriptors) {
    validateDescriptor(descriptor, 'work');
    assert(/^WORK[1-7]$/.test(descriptor.work) && !seen.has(descriptor.work),
      'INVALID_SPECIFICATION', 'predecessor work');
    const expected = expectedReceiptContract(root, descriptor.work);
    assert(descriptor.path === expected.path
      && descriptor.schema_version === expected.schema_version
      && descriptor.record_id_field === expected.record_id_field,
    'INVALID_SPECIFICATION', `${descriptor.work}:receipt contract`);
    seen.add(descriptor.work);
    const receiptBinding = bindingForRecord(root, {
      path: descriptor.path,
      record_id_field: descriptor.record_id_field,
      schema_version: descriptor.schema_version,
    });
    const receipt = parseJson(readBytes(root, descriptor.path), 'BINDING_DRIFT', descriptor.path);
    assert(receipt.status === 'PASS'
      && typeof receipt.state === 'string' && receipt.state.startsWith('PASS')
      && (receipt.stage === undefined || receipt.stage === `M7_V2_REPAIR_${descriptor.work}`)
      && (receipt.work === undefined || receipt.work === descriptor.work),
    'BINDING_DRIFT', `${descriptor.work}:receipt state`);
    result.push({ work: descriptor.work, binding: receiptBinding });
  }
  const ordered = result.sort((left, right) => Number(left.work.slice(4)) - Number(right.work.slice(4)));
  const expectedWorks = Array.from({ length: ordered.length }, (_, index) => `WORK${index + 1}`);
  assert(canonicalJson(ordered.map((entry) => entry.work)) === canonicalJson(expectedWorks),
    'INVALID_SPECIFICATION', 'predecessor receipts:closed set');
  return ordered;
}

function validateOutputRoot(root, repositoryPath) {
  validateRepositoryPath(repositoryPath);
  assert(repositoryPath.startsWith(OUTPUT_ROOT_PREFIX), 'INVALID_SPECIFICATION', 'allowed_output_root');
  const absolute = resolvePath(root, repositoryPath, { allowMissingLeaf: true });
  if (fs.existsSync(absolute)) {
    const stat = fs.lstatSync(absolute);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), 'PATH_SAFETY', repositoryPath);
  }
  return repositoryPath;
}

function allBindings(registration) {
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

function buildRegistration(root, specification) {
  assert(exactKeys(specification, SPECIFICATION_KEYS), 'INVALID_SPECIFICATION', 'specification');
  const governance = validateAuthorityChain(root);
  const predecessorReceiptBindings = validatePredecessors(root, specification.predecessor_receipts);
  const codeBindings = validateCode(root, specification.code, predecessorReceiptBindings.length);
  const semanticInputBindings = validateSemanticInputs(root, specification.semantic_inputs);
  const subtypeTreeBindings = validateSubtypeTrees(root, specification.subtype_trees);
  validateDescriptor(specification.view_policy);
  assert(specification.view_policy.schema_version === 'STAGE_2Y_M7_V2_VIEW_POLICY/V1'
    && specification.view_policy.record_id_field === 'view_policy_id',
  'INVALID_SPECIFICATION', 'view_policy');
  const viewPolicyBinding = bindingForRecord(root, specification.view_policy);
  const allowedOutputRoot = validateOutputRoot(root, specification.allowed_output_root);
  const familyProfileSetBinding = semanticInputBindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  ).binding;
  const structureDispositionSetBinding = semanticInputBindings.find(
    (entry) => entry.input_role === 'APPROVED_STRUCTURE_DISPOSITION_SET',
  ).binding;
  const counts = {
    code_file_count: 5 + codeBindings.runners.length + codeBindings.tests.length,
    runner_count: codeBindings.runners.length,
    test_count: codeBindings.tests.length,
    semantic_input_count: semanticInputBindings.length,
    subtype_tree_count: subtypeTreeBindings.length,
    predecessor_receipt_count: predecessorReceiptBindings.length,
    unique_bound_path_count: 0,
  };
  const unsigned = {
    schema_version: REGISTRATION_SCHEMA,
    stage: 'M7_V2_REPAIR',
    lifecycle_state: 'CANDIDATE_PENDING_REVIEW',
    parent_authority_binding: governance.authority,
    activation_receipt_binding: governance.activation,
    work0_evidence_root_binding: governance.work0,
    code_bindings: codeBindings,
    semantic_input_bindings: semanticInputBindings,
    family_profile_set_binding: familyProfileSetBinding,
    subtype_tree_bindings: subtypeTreeBindings,
    structure_disposition_set_binding: structureDispositionSetBinding,
    view_policy_binding: viewPolicyBinding,
    predecessor_receipt_bindings: predecessorReceiptBindings,
    allowed_output_root: allowedOutputRoot,
    counts,
    effects: ZERO_EFFECTS,
  };
  counts.unique_bound_path_count = new Set(allBindings(unsigned).map((binding) => binding.path)).size;
  return {
    schema_version: REGISTRATION_SCHEMA,
    candidate_registration_id: contentId(REGISTRATION_SCHEMA, unsigned),
    ...Object.fromEntries(Object.entries(unsigned).filter(([key]) => key !== 'schema_version')),
  };
}

function registrationBinding(repositoryPath, bytes, registration) {
  return standardBinding(
    repositoryPath,
    bytes,
    REGISTRATION_SCHEMA,
    'candidate_registration_id',
    registration.candidate_registration_id,
  );
}

function ensureRegistrationRoot(root) {
  const absolute = path.join(root, ...REGISTRATION_ROOT.split('/'));
  if (fs.existsSync(absolute)) {
    resolvePath(root, REGISTRATION_ROOT);
    assert(fs.lstatSync(absolute).isDirectory(), 'PATH_SAFETY', REGISTRATION_ROOT);
    return absolute;
  }
  const parentPath = path.posix.dirname(REGISTRATION_ROOT);
  const parent = resolvePath(root, parentPath);
  try {
    fs.mkdirSync(absolute, { mode: 0o700 });
    const descriptor = fs.openSync(parent, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (error) {
    if (error.code !== 'EEXIST') fail('WRITE_FAILED', REGISTRATION_ROOT);
  }
  return resolvePath(root, REGISTRATION_ROOT);
}

function writeExclusive(root, repositoryPath, bytes) {
  const directory = ensureRegistrationRoot(root);
  const target = path.join(root, ...repositoryPath.split('/'));
  const temporary = `${target}.pending`;
  let descriptor;
  let linked = false;
  try {
    descriptor = fs.openSync(
      temporary,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < bytes.length) offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.linkSync(temporary, target);
    linked = true;
    const directoryDescriptor = fs.openSync(directory, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
    assert(fs.readFileSync(target).equals(bytes), 'WRITE_FAILED', repositoryPath);
    fs.unlinkSync(temporary);
    const finalDirectoryDescriptor = fs.openSync(directory, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(finalDirectoryDescriptor);
    } finally {
      fs.closeSync(finalDirectoryDescriptor);
    }
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch {}
    }
    try { fs.unlinkSync(temporary); } catch {}
    if (linked) {
      try { fs.unlinkSync(target); } catch {}
    }
    if (error.code === 'EEXIST') fail('REGISTRATION_ALREADY_EXISTS', repositoryPath);
    if (error instanceof CandidateRegistrationError) throw error;
    fail('WRITE_FAILED', repositoryPath);
  }
}

export function registerCandidate({ repoRoot, specification, write = false } = {}) {
  assert(typeof write === 'boolean', 'INVALID_OPTIONS', 'write');
  const root = normaliseRoot(repoRoot);
  const registration = buildRegistration(root, specification);
  const registrationPath = `${REGISTRATION_ROOT}/${registration.candidate_registration_id}.json`;
  const bytes = canonicalBytes(registration);
  const absolute = path.join(root, ...registrationPath.split('/'));
  if (write) {
    if (fs.existsSync(absolute)) fail('REGISTRATION_ALREADY_EXISTS', registrationPath);
    writeExclusive(root, registrationPath, bytes);
  } else if (fs.existsSync(absolute)) {
    const existing = readBytes(root, registrationPath);
    assert(existing.equals(bytes), 'REGISTRATION_ALREADY_EXISTS', registrationPath);
  }
  return {
    registration_path: registrationPath,
    registration,
    bytes,
    binding: registrationBinding(registrationPath, bytes, registration),
    counts: structuredClone(registration.counts),
    effects: {
      files_written: write ? 1 : 0,
      model_calls: 0,
      network_reads: 0,
      network_writes: 0,
      database_writes: 0,
      product_writes: 0,
      m0_m4_mutations: 0,
      m8_actions: 0,
    },
  };
}
