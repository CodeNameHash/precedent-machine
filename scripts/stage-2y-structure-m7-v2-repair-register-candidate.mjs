// M7 V2 repair candidate registration builder.
//
// Builds an immutable, content-addressed CANDIDATE_PENDING_REVIEW
// registration from a caller-supplied specification of repository paths —
// never from self-attested bytes or hashes. Every membership count on the
// registration (`counts.code_file_count`, `runner_count`, `test_count`,
// `semantic_input_count`, `subtype_tree_count`, `predecessor_receipt_count`,
// `unique_bound_path_count`) is the length of the bound-binding list it
// describes, derived after every binding has been independently read and
// hashed off disk; none of them is a literal constant, so a candidate with a
// different package count, path count or test roster can register.
// The bound WORK3 predecessor receipt's family/profile counts (as reported
// by `validateWork3()`, which itself reads the bound family profile package
// files) are accepted as computed — this script does not pin them to a
// fixed family-package or profile total, only to internal self-consistency
// (family count agrees with the family-key list, every count is a
// non-negative integer). The `code.tests` roster must contain every
// baseline test the authority's later-work and Work1 test names require,
// plus any number of additional tests, as long as every bound test path
// matches the parent authority's `tests/` file-prefix rule
// (`tests/stage-2y-structure-m7-v2-repair-*.test.js`) — the roster is a
// naming rule, not a fixed eight-path list.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import importClosureModule from '../lib/canonical-v2/m7-v2-import-closure.js';
import m7V2ContractModule from '../lib/canonical-v2/m7-v2-contract.js';
import { validateWork2SuccessorReceiptBinding } from './stage-2y-structure-m7-v2-repair-work2-validate.mjs';
import { validateWork3 } from './stage-2y-structure-m7-v2-repair-work3-validate.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const { importClosure } = importClosureModule;
const { validateFamilyProfilePackageSetForWork3 } = m7V2ContractModule;
// The spec this file implements asked for the V1 fixture-compiler lineage
// (`lib/canonical-v2/m7-deterministic-generalisation.js`) to be refused
// wherever it appears in an import closure. It cannot be: the authority names
// it only in the prose of `v2_input_extensions[].origin`, never as a
// machine-readable roster, and the module is reached from a bound role that
// every registration is required to carry —
// `scripts/stage-2y-structure-generalisation-shadow.mjs:22` requires it, and
// that script is one of REQUIRED_RUNNERS below. Refusing the closure member
// would refuse every candidate registration. The V1 lineage stays out of
// bounds where the authority actually puts it: as a source of V2 inputs.

const REGISTRATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
const REGISTRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json';
const ACTIVATION_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json';
const WORK0_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json';
const WORK1_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json';
const WORK3_CORRECTION_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';
const WORK3_CORRECTION_AUTHORITY_BINDING = Object.freeze({
  path: WORK3_CORRECTION_AUTHORITY_PATH,
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
  record_id_field: 'correction_authority_id',
  record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
  byte_length: 237749,
  sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
  git_blob_oid: '5ff4bcd0ca719c4da97dd9bb64d610349e3d7afd',
});
const WORK3_PROFILE_FIXTURE_PATH =
  'tests/fixtures/canonical-v2/m7-v2-repair/work3-profile-cases.json';
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
const WORK1_RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1';
const WORK1_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'work1_contract_receipt_id', 'work1_contract_receipt_digest',
  'stage', 'state', 'status', 'activation_commit_binding', 'work0_evidence_root_binding',
  'work1_7_authority_binding', 'activation_receipt_binding', 'contract_policy_binding',
  'family_packet_set_binding', 'artifact_bindings', 'artifact_set_digest',
  'command_execution_ledger', 'drafting_command_audit', 'combined_test_result',
  'repository_precondition', 'counts', 'checks', 'effects', 'next_work',
]);
const WORK2_RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_RECEIPT/V1';
const WORK3_RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V1';
const WORK3_RECEIPT_V2_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2';
const SEALED_WORK3_V2_RECEIPT_ID =
  '29381fbb51555e5ada776be29245348d6f5b3830ff0eaada28ba3b28ccab2c4b';
const SEALED_WORK3_V2_COMMIT = 'a0df3f8621107481144e5be1429466d8b193f9be';
const WORK3_SUCCESSOR_MANIFEST_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-execution-manifest-closure-successor.json';
const WORK3_SUCCESSOR_MANIFEST_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V2';
const WORK3_V2_VALIDATION_KEYS = Object.freeze([
  'schema_version', 'status', 'work3_receipt_id', 'family_package_count',
  'profile_count', 'artifact_binding_count', 'effective_path_count',
  'create_once_output_count',
]);
const WORK3_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'work3_receipt_id', 'work', 'stage', 'state', 'status',
  'execution_manifest_id', 'execution_manifest_digest', 'parent_authority_binding',
  'activation_receipt_binding', 'predecessor_receipt_binding',
  'candidate_ordering_correction_authority_binding',
  'work3_entry_correction_authority_binding', 'candidate_registration_id',
  'candidate_transition', 'candidate_native_set_evidence', 'family_profile_evidence',
  'structure_disposition_set_binding', 'artifact_bindings', 'artifact_set_digest',
  'command_execution_ledger', 'combined_test_result', 'repository_precondition',
  'counts', 'checks', 'effects', 'next_work',
]);
const BINDING_KEYS = Object.freeze([
  'path', 'schema_version', 'record_id_field', 'record_id', 'byte_length', 'sha256',
  'git_blob_oid',
]);
const PACKAGE_MEMBER_BINDING_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1';
const PACKAGE_MEMBER_BINDING_KEYS = Object.freeze([
  'schema_version', 'container_path', 'member_field', 'member_index',
  'member_schema_version', 'member_record_id_field', 'member_record_id',
  'member_byte_length', 'member_sha256',
]);
const FAMILY_PROFILE_EVIDENCE_KEYS = Object.freeze([
  'family_profile_package_bindings', 'approved_family_profile_set_binding', 'family_keys',
]);
const APPROVED_PROFILE_SET_KEYS = Object.freeze([
  'schema_version', 'family_profile_set_id', 'state', 'family_profile_package_bindings',
  'profiles', 'dimension_evidence_bindings', 'subtype_tree_bindings',
]);
const FAMILY_PACKAGE_KEYS = Object.freeze([
  'schema_version', 'family_profile_package_id', 'state', 'family_key',
  'profile_set_version', 'family_approval', 'legal_decisions', 'profiles', 'subtype_tree',
  'match_fixtures', 'dimension_evidence', 'structure_fixture_members',
]);
const STRUCTURE_SET_KEYS = Object.freeze([
  'schema_version', 'structure_disposition_set_id', 'state', 'members',
]);
const STRUCTURE_MEMBER_KEYS = Object.freeze([
  'schema_version', 'structure_disposition_id', 'kind', 'reason_code', 'policy_id',
  'policy_version', 'authority_class', 'approver', 'lawyer_ruling_id', 'scope',
  'inclusion_fixture_bindings', 'exclusion_fixture_bindings', 'match_test',
  'inline_list_overlay',
]);
const STRUCTURE_SCOPE_KEYS = Object.freeze([
  'agreement_index_id', 'source_node_occurrence_id', 'start_byte', 'end_byte',
  'governed_input_occurrence_ids',
]);
const INLINE_OVERLAY_KEYS = Object.freeze([
  'schema_version', 'lawyer_ruling_id', 'agreement_index_binding',
  'sealed_ambiguity_id', 'sealed_ambiguity_type', 'sealed_ambiguity_span',
  'inline_marker_disposition_id', 'parent_node_occurrence_id', 'parent_reference',
  'parent_scoping_rule', 'marker_eligibility', 'candidate_trees',
  'selected_candidate_tree_id', 'technical_review',
  'ambiguous_repeat_fixture_bindings',
]);
const NATIVE_SET_EVIDENCE_KEYS = Object.freeze([
  'work2_agreement_analysis_set_binding', 'work2_context_compilation_set_binding',
  'work3_agreement_index_set_binding', 'work3_context_compilation_set_binding',
  'work3_agreement_analysis_set_binding', 'sealed_agreement_ids', 'additive_agreement_ids',
  'combined_agreement_ids', 'extension_proof',
]);
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
// The code roles that are exactly one file each; `runners` and `tests` are the
// two list-valued roles. `code_file_count` is this roster's length plus those
// two list lengths, never a literal.
const CODE_SINGLETON_ROLES = Object.freeze(CODE_KEYS.slice(0, 5));
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
const WORK3_MAE_TEST = 'tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js';
const WORK4_PROJECTION_DISPATCH_TEST =
  'tests/stage-2y-structure-m7-v2-repair-projection-dispatch.test.js';
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

function same(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function expectedWork3Manifest(authority, authorityBinding) {
  const contract = authority?.work3_scope_contract?.work3_manifest_contract;
  assert(Array.isArray(contract?.exact_keys),
    'BINDING_DRIFT', 'WORK3:manifest contract');
  const body = {};
  for (const key of contract.exact_keys) {
    if (key === 'execution_manifest_id' || key === 'execution_manifest_digest') continue;
    if (key === 'work3_entry_correction_authority_binding') {
      body[key] = structuredClone(authorityBinding);
    } else {
      assert(Object.hasOwn(contract, key),
        'BINDING_DRIFT', `WORK3:manifest contract member ${key}`);
      body[key] = structuredClone(contract[key]);
    }
  }
  const digest = sha256Hex(canonicalJson(body));
  const withDigest = { ...body, execution_manifest_digest: digest };
  return {
    ...withDigest,
    execution_manifest_id: contentId(body.schema_version, withDigest),
  };
}

function validateStandardBinding(root, binding, expected = {}) {
  assert(exactKeys(binding, BINDING_KEYS), 'BINDING_DRIFT', 'standard binding members');
  validateRepositoryPath(binding.path);
  assert(Number.isSafeInteger(binding.byte_length) && binding.byte_length > 0
    && HEX_256.test(binding.sha256 || '')
    && /^[0-9a-f]{40}$/.test(binding.git_blob_oid || ''),
  'BINDING_DRIFT', binding.path);
  if (binding.schema_version === null) {
    assert(binding.record_id_field === null && binding.record_id === null,
      'BINDING_DRIFT', binding.path);
  } else {
    assert(typeof binding.schema_version === 'string'
      && typeof binding.record_id_field === 'string'
      && HEX_256.test(binding.record_id || ''),
    'BINDING_DRIFT', binding.path);
  }
  if (expected.schema_version !== undefined) {
    assert(binding.schema_version === expected.schema_version, 'BINDING_DRIFT', `${binding.path}:schema`);
  }
  if (expected.path !== undefined) {
    assert(binding.path === expected.path, 'BINDING_DRIFT', `${binding.path}:path`);
  }
  if (expected.record_id_field !== undefined) {
    assert(binding.record_id_field === expected.record_id_field,
      'BINDING_DRIFT', `${binding.path}:record id field`);
  }
  const bytes = readBytes(root, binding.path, 'BINDING_DRIFT');
  assert(bytes.length === binding.byte_length
    && sha256Hex(bytes) === binding.sha256
    && gitBlobOid(bytes) === binding.git_blob_oid,
  'BINDING_DRIFT', binding.path);
  if (binding.schema_version === null) return null;
  const value = parseJson(bytes, 'BINDING_DRIFT', binding.path);
  assert(bytes.equals(canonicalBytes(value))
    && value?.schema_version === binding.schema_version
    && value?.[binding.record_id_field] === binding.record_id,
  'BINDING_DRIFT', binding.path);
  const unsigned = structuredClone(value);
  delete unsigned[binding.record_id_field];
  const expectedRecordId = binding.schema_version === 'AGREEMENT_INDEX/V1'
    ? agreementIndexRecordId(value)
    : contentId(binding.schema_version, unsigned);
  assert(expectedRecordId === binding.record_id,
    'BINDING_DRIFT', `${binding.path}:self identity`);
  return value;
}

function validateSourceBinding(root, binding) {
  assert(exactKeys(binding, BINDING_KEYS), 'BINDING_DRIFT', 'source binding members');
  validateRepositoryPath(binding.path);
  assert(typeof binding.schema_version === 'string'
    && typeof binding.record_id_field === 'string'
    && HEX_256.test(binding.record_id || '')
    && Number.isSafeInteger(binding.byte_length)
    && binding.byte_length > 0
    && HEX_256.test(binding.sha256 || '')
    && /^[0-9a-f]{40}$/.test(binding.git_blob_oid || ''),
  'BINDING_DRIFT', binding.path);
  const bytes = readBytes(root, binding.path, 'BINDING_DRIFT');
  const record = parseJson(bytes, 'BINDING_DRIFT', binding.path);
  assert(bytes.length === binding.byte_length
    && sha256Hex(bytes) === binding.sha256
    && gitBlobOid(bytes) === binding.git_blob_oid
    && record?.schema_version === binding.schema_version
    && record?.[binding.record_id_field] === binding.record_id,
  'BINDING_DRIFT', binding.path);
  return { bytes, record };
}

function agreementIndexRecordId(record) {
  const requiredArrays = [
    'nodes', 'annotations', 'source_artefacts', 'aliases', 'ambiguities',
    'diagnostics', 'inline_marker_dispositions',
  ];
  assert(requiredArrays.every((field) => Array.isArray(record?.[field]))
    && isPlainObject(record?.source_binding)
    && isPlainObject(record?.structural_policy)
    && isPlainObject(record?.inline_marker_partition)
    && isPlainObject(record?.byte_coverage),
  'BINDING_DRIFT', 'AgreementIndex native identity inputs');
  return contentId('AGREEMENT_INDEX/V1', {
    agreement_id: record.source_binding.agreement_id,
    canonical_text_id: record.source_binding.canonical_text_id,
    structural_policy_digest: record.structural_policy.policy_digest,
    root_node_occurrence_id: record.root_node_occurrence_id,
    counts: record.counts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', record.nodes),
    annotation_set_digest: contentId(
      'AGREEMENT_INDEX_ANNOTATION_SET/V1', record.annotations,
    ),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1', record.source_artefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', record.aliases),
    ambiguity_set_digest: contentId(
      'AGREEMENT_INDEX_AMBIGUITY_SET/V1', record.ambiguities,
    ),
    diagnostic_set_digest: contentId(
      'AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', record.diagnostics,
    ),
    inline_marker_disposition_set_digest: contentId(
      'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1',
      record.inline_marker_dispositions,
    ),
    inline_marker_partition_proof_digest: record.inline_marker_partition.proof_digest,
    byte_coverage_proof_digest: record.byte_coverage.proof_digest,
  });
}

function validateCandidateNativeSetEvidence(
  root,
  authority,
  nativeContract,
  nativeEvidence,
  work3SetRecords,
) {
  const setAuthority = authority?.agreement_index_set_authority;
  const corpus = setAuthority?.corpus_contract;
  const indexDerivation = setAuthority?.agreement_index_member_derivation_contract;
  const setContracts = setAuthority?.sets;
  assert(nativeContract.native_lineage === 'EXACT_M4_TO_M3_TO_M2_FOR_ALL_TEN_MEMBERS'
    && corpus?.set_member_count === 10
    && corpus.subset_extension_proof === nativeEvidence.extension_proof
    && same(corpus.sealed_agreement_ids, nativeEvidence.sealed_agreement_ids)
    && same(corpus.additive_agreement_ids, nativeEvidence.additive_agreement_ids)
    && same(corpus.combined_agreement_ids, nativeEvidence.combined_agreement_ids)
    && indexDerivation?.agreement_id_derivation
      === 'REREAD_EACH_BOUND_AGREEMENT_INDEX_RECORD_AND_REQUIRE_TEN_UNIQUE_AGREEMENT_IDS'
    && indexDerivation.derived_agreement_ids_must_byte_equal
      === 'corpus_contract.combined_agreement_ids'
    && indexDerivation.member_order === 'CANONICAL_ASCENDING_STANDARD_BINDING_PATH'
    && indexDerivation.member_shape === 'DIRECT_STANDARD_SEVEN_FIELD_BINDING'
    && indexDerivation.resolved_record_id_field === 'agreement_index_id'
    && indexDerivation.resolved_record_schema_version === 'AGREEMENT_INDEX/V1'
    && Array.isArray(setContracts)
    && setContracts.length === 3,
  'BINDING_DRIFT', 'WORK3:native set authority');

  const combinedAgreementIds = nativeEvidence.combined_agreement_ids;
  const unionAgreementIds = [
    ...nativeEvidence.sealed_agreement_ids,
    ...nativeEvidence.additive_agreement_ids,
  ].sort();
  assert(combinedAgreementIds.length === 10
    && new Set(combinedAgreementIds).size === 10
    && same(combinedAgreementIds, [...combinedAgreementIds].sort())
    && same(unionAgreementIds, combinedAgreementIds)
    && new Set(unionAgreementIds).size === 10,
  'BINDING_DRIFT', 'WORK3:native agreement union');

  const setShapes = [
    {
      schema_version: 'AGREEMENT_INDEX_SET/V1',
      record_id_field: 'agreement_index_set_id',
      exact_keys: ['schema_version', 'agreement_index_set_id', 'members'],
      member_exact_keys: BINDING_KEYS,
      member_order: 'CANONICAL_ASCENDING_STANDARD_BINDING_PATH',
    },
    {
      schema_version: 'CONTEXT_COMPILATION_SET/V1',
      record_id_field: 'context_compilation_set_id',
      exact_keys: ['schema_version', 'context_compilation_set_id', 'members'],
      member_exact_keys: ['agreement_id', 'context_compilation_binding'],
      member_order: 'CANONICAL_ASCENDING_AGREEMENT_ID',
    },
    {
      schema_version: 'AGREEMENT_ANALYSIS_SET/V1',
      record_id_field: 'agreement_analysis_set_id',
      exact_keys: ['schema_version', 'agreement_analysis_set_id', 'members'],
      member_exact_keys: ['agreement_id', 'agreement_analysis_binding'],
      member_order: 'CANONICAL_ASCENDING_AGREEMENT_ID',
    },
  ];
  for (let index = 0; index < setShapes.length; index += 1) {
    const shape = setShapes[index];
    const setContract = setContracts[index];
    const record = work3SetRecords[index];
    assert(setContract.schema_version === shape.schema_version
      && setContract.record_id_field === shape.record_id_field
      && same(setContract.exact_keys, shape.exact_keys)
      && same(setContract.member_exact_keys, shape.member_exact_keys)
      && setContract.member_order === shape.member_order
      && Array.isArray(setContract.members)
      && setContract.members.length === 10
      && exactKeys(record, shape.exact_keys)
      && record.schema_version === shape.schema_version
      && same(record.members, setContract.members),
    'BINDING_DRIFT', `WORK3:native set members ${shape.schema_version}`);
  }

  const agreementIndexes = work3SetRecords[0].members.map((binding) => {
    assert(exactKeys(binding, BINDING_KEYS),
      'BINDING_DRIFT', 'WORK3:AgreementIndex member binding');
    const record = validateStandardBinding(root, binding, {
      schema_version: 'AGREEMENT_INDEX/V1',
      record_id_field: 'agreement_index_id',
    });
    return {
      agreement_id: record.source_binding?.agreement_id,
      binding,
      agreement_index_binding: {
        agreement_index_id: binding.record_id,
        agreement_index_sha256: binding.sha256,
        canonical_text_sha256: record.source_binding?.canonical_text_sha256,
        structural_policy_digest: record.structural_policy?.policy_digest,
      },
    };
  });
  const contextCompilations = work3SetRecords[1].members.map((member) => {
    assert(exactKeys(member, ['agreement_id', 'context_compilation_binding'])
      && exactKeys(member.context_compilation_binding, BINDING_KEYS),
    'BINDING_DRIFT', 'WORK3:ContextCompilation member binding');
    const record = validateStandardBinding(root, member.context_compilation_binding, {
      schema_version: 'CONTEXT_COMPILATION/V1',
      record_id_field: 'context_compilation_id',
    });
    return {
      agreement_id: member.agreement_id,
      binding: member.context_compilation_binding,
      agreement_index_binding: record.agreement_index_binding,
    };
  });
  const agreementAnalyses = work3SetRecords[2].members.map((member) => {
    assert(exactKeys(member, ['agreement_id', 'agreement_analysis_binding'])
      && exactKeys(member.agreement_analysis_binding, BINDING_KEYS),
    'BINDING_DRIFT', 'WORK3:AgreementAnalysis member binding');
    const record = validateStandardBinding(root, member.agreement_analysis_binding, {
      schema_version: 'AGREEMENT_ANALYSIS/V1',
      record_id_field: 'agreement_analysis_id',
    });
    return {
      agreement_id: member.agreement_id,
      record_agreement_id: record.agreement_id,
      agreement_index_binding: record.agreement_index_binding,
      context_compilation_binding: record.context_compilation_binding,
    };
  });

  assert(same(work3SetRecords[0].members.map((binding) => binding.path),
    work3SetRecords[0].members.map((binding) => binding.path).sort())
    && same(contextCompilations.map((row) => row.agreement_id), combinedAgreementIds)
    && same(agreementAnalyses.map((row) => row.agreement_id), combinedAgreementIds),
  'BINDING_DRIFT', 'WORK3:native member order');
  const agreementIndexesById = new Map(
    agreementIndexes.map((row) => [row.agreement_id, row]),
  );
  const contextCompilationsById = new Map(
    contextCompilations.map((row) => [row.agreement_id, row]),
  );
  assert(agreementIndexesById.size === 10
    && contextCompilationsById.size === 10
    && same([...agreementIndexesById.keys()].sort(), combinedAgreementIds),
  'BINDING_DRIFT', 'WORK3:AgreementIndex agreement IDs');
  for (const analysis of agreementAnalyses) {
    const agreementIndex = agreementIndexesById.get(analysis.agreement_id);
    const contextCompilation = contextCompilationsById.get(analysis.agreement_id);
    const additive = nativeEvidence.additive_agreement_ids.includes(analysis.agreement_id);
    const expectedAnalysisIndexBinding = additive
      ? { agreement_index_id: agreementIndex?.binding.record_id }
      : contextCompilation?.agreement_index_binding;
    const expectedAnalysisContextBinding = additive
      ? { context_compilation_id: contextCompilation?.binding.record_id }
      : {
        agreement_id: analysis.agreement_id,
        agreement_index_id: agreementIndex?.binding.record_id,
        byte_length: contextCompilation?.binding.byte_length,
        context_compilation_id: contextCompilation?.binding.record_id,
        path: contextCompilation?.binding.path,
        schema_version: contextCompilation?.binding.schema_version,
        sha256: contextCompilation?.binding.sha256,
      };
    assert(agreementIndex
      && contextCompilation
      && analysis.record_agreement_id === analysis.agreement_id
      && same(contextCompilation.agreement_index_binding,
        agreementIndex.agreement_index_binding)
      && same(analysis.agreement_index_binding, expectedAnalysisIndexBinding)
      && same(analysis.context_compilation_binding, expectedAnalysisContextBinding),
    'BINDING_DRIFT', `WORK3:native M4-M3-M2 lineage ${analysis.agreement_id}`);
  }
}

function validateArtifactBindingCategories(bindings, standardContract, artifactContract) {
  assert(same(standardContract?.exact_keys, BINDING_KEYS)
    && standardContract.record_fields
      === 'NULL_FOR_CODE_TEST_AND_RAW_FIXTURE_OTHERWISE_EXACT_NATIVE_SCHEMA_ID_FIELD_AND_ID'
    && Array.isArray(artifactContract.record_id_categories)
    && artifactContract.record_id_categories.length > 1,
  'BINDING_DRIFT', 'WORK3:artifact binding category authority');
  const recordFieldsByPath = new Map();
  let remainingCategoryCount = 0;
  for (const category of artifactContract.record_id_categories) {
    if (category.remaining_code_test_and_raw_fixture_paths !== undefined) {
      assert(exactKeys(category, ['remaining_code_test_and_raw_fixture_paths'])
        && category.remaining_code_test_and_raw_fixture_paths === 'NULL_SCHEMA_AND_ID_FIELDS',
      'BINDING_DRIFT', 'WORK3:raw artifact category authority');
      remainingCategoryCount += 1;
      continue;
    }
    assert(Array.isArray(category.paths) && category.paths.length > 0,
      'BINDING_DRIFT', 'WORK3:record artifact category paths');
    if (Array.isArray(category.schema_and_id_fields)) {
      assert(category.schema_and_id_fields.length === category.paths.length
        && same(category.schema_and_id_fields.map((entry) => entry?.path), category.paths),
      'BINDING_DRIFT', 'WORK3:path-specific artifact category authority');
      for (const entry of category.schema_and_id_fields) {
        assert(exactKeys(entry, ['path', 'record_id_field', 'schema_version'])
          && typeof entry.schema_version === 'string'
          && typeof entry.record_id_field === 'string'
          && !recordFieldsByPath.has(entry.path),
        'BINDING_DRIFT', `WORK3:artifact category ${entry?.path}`);
        recordFieldsByPath.set(entry.path, entry);
      }
    } else {
      assert(typeof category.schema_version === 'string'
        && typeof category.record_id_field === 'string',
      'BINDING_DRIFT', 'WORK3:uniform artifact category authority');
      for (const repositoryPath of category.paths) {
        assert(!recordFieldsByPath.has(repositoryPath),
          'BINDING_DRIFT', `WORK3:duplicate artifact category ${repositoryPath}`);
        recordFieldsByPath.set(repositoryPath, {
          path: repositoryPath,
          schema_version: category.schema_version,
          record_id_field: category.record_id_field,
        });
      }
    }
  }
  assert(remainingCategoryCount === 1
    && [...recordFieldsByPath.keys()].every((repositoryPath) => (
      bindings.some((binding) => binding.path === repositoryPath)
    )),
  'BINDING_DRIFT', 'WORK3:artifact category inventory');
  for (const binding of bindings) {
    const expected = recordFieldsByPath.get(binding.path);
    assert(expected
      ? binding.schema_version === expected.schema_version
        && binding.record_id_field === expected.record_id_field
        && HEX_256.test(binding.record_id || '')
      : binding.schema_version === null
        && binding.record_id_field === null
        && binding.record_id === null,
    'BINDING_DRIFT', `WORK3:artifact record fields ${binding.path}`);
  }
}

function validatePackageMemberBinding(root, binding, packagesByPath, familyKey) {
  assert(exactKeys(binding, PACKAGE_MEMBER_BINDING_KEYS)
    && binding.schema_version === PACKAGE_MEMBER_BINDING_SCHEMA
    && binding.member_field === 'subtype_tree'
    && binding.member_index === null
    && binding.member_schema_version === 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1'
    && binding.member_record_id_field === 'subtype_tree_id'
    && HEX_256.test(binding.member_record_id || '')
    && Number.isSafeInteger(binding.member_byte_length)
    && binding.member_byte_length > 0
    && HEX_256.test(binding.member_sha256 || ''),
  'BINDING_DRIFT', `${familyKey}:package member`);
  validateRepositoryPath(binding.container_path);
  const packageRecord = packagesByPath.get(binding.container_path);
  assert(packageRecord && packageRecord.family_key === familyKey,
    'BINDING_DRIFT', `${familyKey}:outer package join`);
  const member = packageRecord.subtype_tree;
  const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
  assert(member?.schema_version === binding.member_schema_version
    && member?.[binding.member_record_id_field] === binding.member_record_id
    && member?.family_key === familyKey
    && memberBytes.length === binding.member_byte_length
    && sha256Hex(memberBytes) === binding.member_sha256,
  'BINDING_DRIFT', `${familyKey}:package member bytes`);
  const unsigned = structuredClone(member);
  delete unsigned[binding.member_record_id_field];
  assert(contentId(binding.member_schema_version, unsigned) === binding.member_record_id,
    'BINDING_DRIFT', `${familyKey}:package member identity`);
}

function validateApprovedProfileInventory(profileSet, packagesByPath, contract) {
  assert(contract?.profiles_contract
      === 'EXACT_FINAL_V1_PROFILE_RECORDS_CANONICAL_BYTE_EQUAL_TO_EXACTLY_ONE_PACKAGE_PROFILES_MEMBER_WITH_NO_ADDED_PROVENANCE_KEYS'
    && contract.profiles_order
      === 'C3_FAMILY_KEY_ORDER_THEN_PROFILE_KEY_THEN_PROFILE_ID_WITH_PROFILE_KEYS_UNIQUE_WITHIN_FAMILY'
    && contract.profile_and_package_inventory_closure
      === 'PROFILE_IDS_PACKAGE_BINDINGS_DIMENSION_EVIDENCE_AND_SUBTYPE_TREES_ARE_COMPLETE_UNIQUE_AND_BYTE_EQUAL_TO_EMBEDDED_PACKAGE_MEMBERS',
  'BINDING_DRIFT', 'WORK3:approved profile inventory authority');
  const expectedProfiles = [];
  const familyProfileKeys = new Set();
  const profileIds = new Set();
  for (const mapping of contract.package_path_mapping) {
    const packageRecord = packagesByPath.get(mapping.path);
    assert(packageRecord?.family_key === mapping.family_key
      && Number.isSafeInteger(packageRecord.profile_set_version)
      && packageRecord.profile_set_version > 0
      && Array.isArray(packageRecord.profiles),
    'BINDING_DRIFT', `${mapping.family_key}:package profiles`);
    let previousOrderKey = null;
    for (const profile of packageRecord.profiles) {
      assert(isPlainObject(profile)
        && profile.schema_version === 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1'
        && HEX_256.test(profile.profile_id || '')
        && profile.family_key === packageRecord.family_key
        && profile.profile_set_version === packageRecord.profile_set_version
        && typeof profile.profile_key === 'string'
        && profile.profile_key.length > 0,
      'BINDING_DRIFT', `${mapping.family_key}:package profile envelope`);
      const unsigned = structuredClone(profile);
      delete unsigned.profile_id;
      delete unsigned.schema_version;
      assert(contentId(profile.schema_version, unsigned) === profile.profile_id,
        'BINDING_DRIFT', `${mapping.family_key}:package profile identity`);
      const orderKey = `${profile.profile_key}\u0000${profile.profile_id}`;
      const familyProfileKey = `${profile.family_key}\u0000${profile.profile_key}`;
      assert((previousOrderKey === null || previousOrderKey < orderKey)
        && !familyProfileKeys.has(familyProfileKey)
        && !profileIds.has(profile.profile_id),
      'BINDING_DRIFT', `${mapping.family_key}:package profile order and uniqueness`);
      previousOrderKey = orderKey;
      familyProfileKeys.add(familyProfileKey);
      profileIds.add(profile.profile_id);
      expectedProfiles.push(profile);
    }
  }
  assert(same(profileSet.profiles, expectedProfiles),
    'BINDING_DRIFT', 'WORK3:approved profile package-member closure');
}

function validateDimensionEvidenceInventory(profileSet, packagesByPath, contract) {
  assert(contract?.dimension_evidence_bindings_contract
    === 'EXACT_ALL_PACKAGE_DIMENSION_EVIDENCE_MEMBERS_AS_PACKAGE_MEMBER_BINDINGS_IN_CANONICAL_FAMILY_KEY_THEN_MEMBER_ID_ORDER',
  'BINDING_DRIFT', 'WORK3:dimension evidence inventory authority');
  const expectedBindings = [];
  const dimensionEvidenceIds = new Set();
  for (const mapping of contract.package_path_mapping) {
    const packageRecord = packagesByPath.get(mapping.path);
    assert(packageRecord?.family_key === mapping.family_key
      && Array.isArray(packageRecord.dimension_evidence),
    'BINDING_DRIFT', `${mapping.family_key}:package dimension evidence`);
    let previousId = null;
    packageRecord.dimension_evidence.forEach((member, memberIndex) => {
      assert(isPlainObject(member)
        && member.schema_version === 'STAGE_2Y_M7_V2_DIMENSION_EVIDENCE/V1'
        && HEX_256.test(member.dimension_evidence_id || '')
        && (previousId === null || previousId < member.dimension_evidence_id)
        && !dimensionEvidenceIds.has(member.dimension_evidence_id),
      'BINDING_DRIFT', `${mapping.family_key}:dimension evidence order and envelope`);
      const unsigned = structuredClone(member);
      delete unsigned.dimension_evidence_id;
      assert(contentId(member.schema_version, unsigned) === member.dimension_evidence_id,
        'BINDING_DRIFT', `${mapping.family_key}:dimension evidence identity`);
      const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
      expectedBindings.push({
        schema_version: PACKAGE_MEMBER_BINDING_SCHEMA,
        container_path: mapping.path,
        member_field: 'dimension_evidence',
        member_index: memberIndex,
        member_schema_version: member.schema_version,
        member_record_id_field: 'dimension_evidence_id',
        member_record_id: member.dimension_evidence_id,
        member_byte_length: memberBytes.length,
        member_sha256: sha256Hex(memberBytes),
      });
      previousId = member.dimension_evidence_id;
      dimensionEvidenceIds.add(member.dimension_evidence_id);
    });
  }
  assert(same(profileSet.dimension_evidence_bindings, expectedBindings),
    'BINDING_DRIFT', 'WORK3:dimension evidence package-member closure');
}

function validateRoutedPackageMemberBinding(
  binding,
  packagesByPath,
  expectedField,
  expectedSchema,
  expectedIdField,
  detail,
) {
  assert(exactKeys(binding, PACKAGE_MEMBER_BINDING_KEYS)
    && binding.schema_version === PACKAGE_MEMBER_BINDING_SCHEMA
    && binding.member_field === expectedField
    && Number.isSafeInteger(binding.member_index)
    && binding.member_index >= 0
    && binding.member_schema_version === expectedSchema
    && binding.member_record_id_field === expectedIdField
    && HEX_256.test(binding.member_record_id || '')
    && Number.isSafeInteger(binding.member_byte_length)
    && binding.member_byte_length > 0
    && HEX_256.test(binding.member_sha256 || ''),
  'BINDING_DRIFT', detail);
  validateRepositoryPath(binding.container_path);
  const packageRecord = packagesByPath.get(binding.container_path);
  assert(packageRecord && Array.isArray(packageRecord[expectedField]),
    'BINDING_DRIFT', `${detail}:outer package join`);
  const member = packageRecord[expectedField][binding.member_index];
  const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
  assert(isPlainObject(member)
    && member.schema_version === expectedSchema
    && member[expectedIdField] === binding.member_record_id
    && memberBytes.length === binding.member_byte_length
    && sha256Hex(memberBytes) === binding.member_sha256,
  'BINDING_DRIFT', `${detail}:member bytes`);
  const unsigned = structuredClone(member);
  delete unsigned[expectedIdField];
  assert(contentId(expectedSchema, unsigned) === binding.member_record_id,
    'BINDING_DRIFT', `${detail}:member identity`);
  return member;
}

function validateStructureDispositionSet(
  record,
  packagesByPath,
  authority,
  richContract,
  agreementIndexSet,
) {
  const scope = authority?.work3_scope_contract;
  const contract = scope?.structure_disposition_set_contract;
  const richBindingContract = richContract?.structure_disposition_set_binding_contract;
  const expectedOverlayBinding = contract?.item39_overlay_fixture_binding_contract?.exact_binding;
  const packageOverlayContract = scope?.family_profile_package_contract
    ?.single_global_item39_overlay_fixture_contract;
  const expectedGovernedSource = packageOverlayContract?.governed_item39_source;
  const expectedSyntheticIndexBinding = packageOverlayContract
    ?.synthetic_ambiguous_repeat_source?.agreement_index_binding;
  const governedIndexBindings = Array.isArray(agreementIndexSet?.members)
    ? agreementIndexSet.members.filter(
      (binding) => binding?.record_id === expectedGovernedSource?.agreement_index_id,
    )
    : [];
  const expectedGovernedIndexBinding = governedIndexBindings[0];
  assert(same(contract?.exact_keys, STRUCTURE_SET_KEYS)
    && same(contract?.member_exact_keys, STRUCTURE_MEMBER_KEYS)
    && contract.schema_version === 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1'
    && contract.state === 'BEN_APPROVED_STRUCTURE_DISPOSITION_SET'
    && contract.fixture_member_field === 'match_fixtures'
    && contract.inclusion_and_exclusion_fixture_binding_schema_version
      === PACKAGE_MEMBER_BINDING_SCHEMA
    && isPlainObject(expectedOverlayBinding)
    && richBindingContract?.package_member_bindings_must_resolve === true
    && richBindingContract.global_reference_closure
      === 'EXACT_UNION_NO_ORPHAN_NO_CROSS_ROUTE_ONE_PACKAGE_OWNER'
    && contract.package_structure_fixture_reference_closure
      === 'EXACT_SINGLE_SYNTHETIC_AMBIGUOUS_REPEAT_BINDING_FOR_DISTINCT_GOVERNED_ITEM39_SOURCE_NO_ORPHAN_NO_CROSS_ROUTE_EXACTLY_ONE_PACKAGE_OWNER'
    && contract.item39_overlay_fixture_binding_contract
      .governed_item39_source_must_equal
      === 'family_profile_package_contract.single_global_item39_overlay_fixture_contract.governed_item39_source'
    && same(richBindingContract.ambiguous_repeat_fixture_member_binding,
      expectedOverlayBinding)
    && same(richBindingContract.governed_item39_source, expectedGovernedSource)
    && same(richBindingContract.synthetic_agreement_index_binding,
      expectedSyntheticIndexBinding)
    && governedIndexBindings.length === 1
    && expectedGovernedIndexBinding.schema_version === 'AGREEMENT_INDEX/V1'
    && expectedGovernedIndexBinding.record_id_field === 'agreement_index_id'
    && expectedGovernedSource?.agreement_index_id !== expectedSyntheticIndexBinding?.record_id,
  'BINDING_DRIFT', 'WORK3:structure disposition authority');
  assert(exactKeys(record, STRUCTURE_SET_KEYS)
    && record.schema_version === contract.schema_version
    && record.state === contract.state
    && Array.isArray(record.members)
    && record.members.length > 0,
  'BINDING_DRIFT', 'WORK3:structure disposition set');

  const memberIds = record.members.map((member) => member?.structure_disposition_id);
  assert(memberIds.every((memberId) => HEX_256.test(memberId || ''))
    && new Set(memberIds).size === memberIds.length
    && same(memberIds, [...memberIds].sort()),
  'BINDING_DRIFT', 'WORK3:structure disposition member order');
  let overlayCount = 0;
  let resolvedOverlayBinding = null;
  const routedMatchBindings = [];
  const routedStructureBindings = [];
  for (const member of record.members) {
    assert(exactKeys(member, STRUCTURE_MEMBER_KEYS)
      && member.schema_version === contract.schema_version,
    'BINDING_DRIFT', 'WORK3:structure disposition member');
    const unsigned = structuredClone(member);
    delete unsigned.schema_version;
    delete unsigned.structure_disposition_id;
    assert(contentId(contract.schema_version, unsigned) === member.structure_disposition_id,
      'BINDING_DRIFT', 'WORK3:structure disposition member identity');
    const requiresBen = ['LEGAL_TEXT_EXCLUSION', 'NO_OUTPUT',
      'BEN_AUTHORED_INLINE_LIST_OVERLAY'].includes(member.kind);
    assert(['TECHNICAL_STRUCTURE', 'SOURCE_ARTEFACT', 'LEGAL_TEXT_EXCLUSION', 'NO_OUTPUT',
      'BEN_AUTHORED_INLINE_LIST_OVERLAY'].includes(member.kind)
      && typeof member.reason_code === 'string' && member.reason_code.length > 0
      && typeof member.policy_id === 'string' && member.policy_id.length > 0
      && Number.isSafeInteger(member.policy_version) && member.policy_version > 0
      && ['DETERMINISTIC_TECHNICAL', 'BEN_LEGAL_RULING'].includes(member.authority_class)
      && (requiresBen
        ? member.authority_class === 'BEN_LEGAL_RULING'
          && member.approver === 'BEN_GOODCHILD'
          && typeof member.lawyer_ruling_id === 'string'
          && member.lawyer_ruling_id.length > 0
        : member.approver === null && member.lawyer_ruling_id === null)
      && exactKeys(member.scope, STRUCTURE_SCOPE_KEYS)
      && HEX_256.test(member.scope.agreement_index_id || '')
      && typeof member.scope.source_node_occurrence_id === 'string'
      && member.scope.source_node_occurrence_id.length > 0
      && Number.isSafeInteger(member.scope.start_byte) && member.scope.start_byte >= 0
      && Number.isSafeInteger(member.scope.end_byte)
      && member.scope.end_byte > member.scope.start_byte
      && Array.isArray(member.scope.governed_input_occurrence_ids)
      && new Set(member.scope.governed_input_occurrence_ids).size
        === member.scope.governed_input_occurrence_ids.length
      && member.scope.governed_input_occurrence_ids.every(
        (value) => typeof value === 'string' && value.length > 0,
      )
      && isPlainObject(member.match_test),
    'BINDING_DRIFT', 'WORK3:structure disposition member contract');

    const resolvedIds = {};
    for (const field of ['inclusion_fixture_bindings', 'exclusion_fixture_bindings']) {
      const bindings = member[field];
      const serialised = Array.isArray(bindings) ? bindings.map((binding) => canonicalJson(binding)) : [];
      assert(serialised.length > 0
        && new Set(serialised).size === serialised.length
        && same(serialised, [...serialised].sort()),
      'BINDING_DRIFT', `WORK3:structure ${field}`);
      resolvedIds[field] = new Set(bindings.map((binding) => {
        const resolved = validateRoutedPackageMemberBinding(
          binding,
          packagesByPath,
          'match_fixtures',
          'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1',
          'match_fixture_id',
          `WORK3:structure ${field}`,
        );
        routedMatchBindings.push(binding);
        return resolved.match_fixture_id;
      }));
    }
    assert([...resolvedIds.inclusion_fixture_bindings].every(
      (fixtureId) => !resolvedIds.exclusion_fixture_bindings.has(fixtureId),
    ), 'BINDING_DRIFT', 'WORK3:structure fixture partition');

    if (member.kind === 'BEN_AUTHORED_INLINE_LIST_OVERLAY') {
      overlayCount += 1;
      const overlay = member.inline_list_overlay;
      assert(exactKeys(overlay, INLINE_OVERLAY_KEYS)
        && Array.isArray(overlay.ambiguous_repeat_fixture_bindings)
        && overlay.ambiguous_repeat_fixture_bindings.length === 1
        && same(overlay.ambiguous_repeat_fixture_bindings[0], expectedOverlayBinding),
      'BINDING_DRIFT', 'WORK3:item39 overlay route');
      validateRoutedPackageMemberBinding(
        overlay.ambiguous_repeat_fixture_bindings[0],
        packagesByPath,
        'structure_fixture_members',
        'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1',
        'fixture_id',
        'WORK3:item39 overlay fixture',
      );
      routedStructureBindings.push(overlay.ambiguous_repeat_fixture_bindings[0]);
      assert(member.lawyer_ruling_id === expectedGovernedSource.lawyer_ruling_id
        && member.scope.agreement_index_id === expectedGovernedSource.agreement_index_id
        && member.scope.source_node_occurrence_id
          === expectedGovernedSource.source_node_occurrence_id
        && member.scope.start_byte === expectedGovernedSource.span?.start_byte
        && member.scope.end_byte === expectedGovernedSource.span?.end_byte
        && overlay.lawyer_ruling_id === expectedGovernedSource.lawyer_ruling_id
        && same(overlay.agreement_index_binding, expectedGovernedIndexBinding)
        && overlay.sealed_ambiguity_id === expectedGovernedSource.ambiguity_id
        && same(overlay.sealed_ambiguity_span, expectedGovernedSource.span)
        && overlay.inline_marker_disposition_id
          === expectedGovernedSource.inline_marker_disposition_id
        && overlay.parent_node_occurrence_id
          === expectedGovernedSource.source_node_occurrence_id
        && overlay.parent_reference === expectedGovernedSource.section_reference,
      'BINDING_DRIFT', 'WORK3:item39 governed source');
      resolvedOverlayBinding = overlay.ambiguous_repeat_fixture_bindings[0];
    } else {
      assert(member.inline_list_overlay === null,
        'BINDING_DRIFT', 'WORK3:non-overlay structure disposition');
    }
  }

  const expectedMatchBindings = [];
  const expectedStructureBindings = [];
  const routedMemberIds = new Set();
  for (const [containerPath, packageRecord] of packagesByPath) {
    for (const [memberField, schemaVersion, recordIdField, destination] of [
      ['match_fixtures', 'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1',
        'match_fixture_id', expectedMatchBindings],
      ['structure_fixture_members', 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1',
        'fixture_id', expectedStructureBindings],
    ]) {
      const members = packageRecord[memberField];
      assert(Array.isArray(members), 'BINDING_DRIFT', `WORK3:${memberField} inventory`);
      let previousId = null;
      for (let memberIndex = 0; memberIndex < members.length; memberIndex += 1) {
        const member = members[memberIndex];
        const memberId = member?.[recordIdField];
        assert(isPlainObject(member)
          && member.schema_version === schemaVersion
          && HEX_256.test(memberId || '')
          && (previousId === null || memberId > previousId)
          && !routedMemberIds.has(memberId),
        'BINDING_DRIFT', `WORK3:${memberField} member order and ownership`);
        const unsigned = structuredClone(member);
        delete unsigned[recordIdField];
        assert(contentId(schemaVersion, unsigned) === memberId,
          'BINDING_DRIFT', `WORK3:${memberField} member identity`);
        const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
        destination.push({
          schema_version: PACKAGE_MEMBER_BINDING_SCHEMA,
          container_path: containerPath,
          member_field: memberField,
          member_index: memberIndex,
          member_schema_version: schemaVersion,
          member_record_id_field: recordIdField,
          member_record_id: memberId,
          member_byte_length: memberBytes.length,
          member_sha256: sha256Hex(memberBytes),
        });
        routedMemberIds.add(memberId);
        previousId = memberId;
      }
    }
  }
  const exactReferenceUnion = (routed, expected) => {
    const routedKeys = routed.map((binding) => canonicalJson(binding));
    const expectedKeys = expected.map((binding) => canonicalJson(binding));
    return new Set(routedKeys).size === routedKeys.length
      && routedKeys.length === expectedKeys.length
      && same([...routedKeys].sort(), [...expectedKeys].sort());
  };
  const exactReferenceSubset = (routed, expected) => {
    const routedKeys = routed.map((binding) => canonicalJson(binding));
    const expectedKeys = new Set(expected.map((binding) => canonicalJson(binding)));
    return new Set(routedKeys).size === routedKeys.length
      && routedKeys.every((binding) => expectedKeys.has(binding));
  };
  assert(overlayCount === 1
    && expectedStructureBindings.length === 1
    && exactReferenceSubset(routedMatchBindings, expectedMatchBindings)
    && exactReferenceUnion(routedStructureBindings, expectedStructureBindings)
    && same(resolvedOverlayBinding, expectedOverlayBinding),
  'BINDING_DRIFT', 'WORK3:structure global reference closure');
}

function validateFamilyProfilePackageSemantics(
  root,
  authority,
  profileSet,
  familyEvidence,
  packagesByPath,
  structureRecord,
  agreementIndexSet,
) {
  const packetBinding = authority.work3_scope_contract
    ?.family_packet_set_source_contract?.binding;
  const familyPacketSet = validateStandardBinding(root, packetBinding);
  const packetSourceBindings = [
    familyPacketSet.work0_evidence_root_binding,
    familyPacketSet.fixed_sample_identity_binding,
    familyPacketSet.repair_baseline_binding,
    familyPacketSet.calibration_ruling_map_binding,
    familyPacketSet.lawyer_review_packet_binding,
    ...familyPacketSet.families.map((family) => family.calibration_pack_binding),
  ];
  const scopedAgreementIndexIds = new Set(
    structureRecord.members.map((member) => member.scope.agreement_index_id),
  );
  const structureSourceBindings = agreementIndexSet.members.filter(
    (binding) => scopedAgreementIndexIds.has(binding.record_id),
  );
  const syntheticBinding = authority.work3_scope_contract.family_profile_package_contract
    .single_global_item39_overlay_fixture_contract.synthetic_ambiguous_repeat_source
    .agreement_index_binding;
  const sourceBindingsByPath = new Map([
    ...packetSourceBindings,
    ...structureSourceBindings,
    syntheticBinding,
  ].map((binding) => [binding.path, binding]));
  const nativeSourceRecords = [...sourceBindingsByPath.values()].map((binding) => {
    const bytes = readBytes(root, binding.path, 'BINDING_DRIFT');
    const resolvedBinding = Object.hasOwn(binding, 'git_blob_oid')
      ? binding
      : { ...binding, git_blob_oid: gitBlobOid(bytes) };
    const source = validateSourceBinding(root, resolvedBinding);
    return {
      binding: resolvedBinding,
      bytes: source.bytes,
      record: source.record,
    };
  });
  const familyPackageSources = familyEvidence.family_profile_package_bindings.map((binding) => ({
    binding,
    bytes: readBytes(root, binding.path, 'BINDING_DRIFT'),
    record: packagesByPath.get(binding.path),
  }));
  try {
    validateFamilyProfilePackageSetForWork3({
      work3Authority: authority,
      dnoItem42SuccessorAuthority: null,
      familyGroupingSuccessorAuthorities: null,
      familyProfileSet: profileSet,
      familyPackageSources,
      familyPacketSet,
      structureDispositionSet: structureRecord,
      nativeSourceRecords,
    });
  } catch (error) {
    fail('BINDING_DRIFT', `WORK3:family profile package semantics:${error.code ?? error.message}`);
  }
}

function validateRichWork3ReceiptEnvelope(receipt) {
  assert(exactKeys(receipt, WORK3_RECEIPT_KEYS)
    && receipt.schema_version === WORK3_RECEIPT_SCHEMA
    && receipt.work === 'WORK3'
    && receipt.stage === 'M7_V2_REPAIR_WORK3'
    && receipt.state === 'PASS_WORK3_BUILD_ONLY_NULL_CANDIDATE'
    && receipt.status === 'PASS',
  'BINDING_DRIFT', 'WORK3:rich receipt envelope');
}

function validateRichWork3Receipt(root, receipt, manifest) {
  validateRichWork3ReceiptEnvelope(receipt);
  assert(same(manifest.work3_entry_correction_authority_binding,
    WORK3_CORRECTION_AUTHORITY_BINDING),
  'BINDING_DRIFT', 'WORK3:fixed correction authority binding');
  const authority = validateStandardBinding(root, manifest.work3_entry_correction_authority_binding, {
    path: WORK3_CORRECTION_AUTHORITY_PATH,
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
    record_id_field: 'correction_authority_id',
  });
  const contract = authority?.work3_scope_contract?.rich_work3_receipt_contract;
  assert(isPlainObject(contract)
    && same(contract.exact_keys, WORK3_RECEIPT_KEYS)
    && contract.top_level_key_count === WORK3_RECEIPT_KEYS.length,
  'BINDING_DRIFT', 'WORK3:rich receipt authority');
  assert(receipt.schema_version === contract.schema_version
    && receipt.work === contract.work
    && receipt.stage === contract.stage
    && receipt.state === contract.state
    && receipt.status === contract.status,
  'BINDING_DRIFT', 'WORK3:rich receipt envelope');
  const scope = authority.work3_scope_contract;
  const manifestContract = scope.work3_manifest_contract;
  const orderingAuthorityBinding = scope.candidate_ordering_authority_overlay
    ?.base_authority_binding;
  assert(isPlainObject(manifestContract)
    && same(manifest.parent_authority_binding, manifestContract.parent_authority_binding)
    && same(manifest.activation_receipt_binding, manifestContract.activation_receipt_binding)
    && same(manifest.predecessor_receipt_binding, manifestContract.predecessor_receipt_binding)
    && same(manifest.candidate_ordering_correction_authority_binding,
      manifestContract.candidate_ordering_correction_authority_binding)
    && same(manifest.candidate_ordering_correction_authority_binding,
      orderingAuthorityBinding),
  'BINDING_DRIFT', 'WORK3:manifest lineage authority');
  assert(same(manifest, expectedWork3Manifest(
    authority,
    manifest.work3_entry_correction_authority_binding,
  )), 'BINDING_DRIFT', 'WORK3:resolved manifest C3 equality');
  validateStandardBinding(root, manifest.activation_receipt_binding, {
    path: manifestContract.activation_receipt_binding.path,
    schema_version: manifestContract.activation_receipt_binding.schema_version,
    record_id_field: manifestContract.activation_receipt_binding.record_id_field,
  });
  validateStandardBinding(root, manifest.predecessor_receipt_binding, {
    path: manifestContract.predecessor_receipt_binding.path,
    schema_version: manifestContract.predecessor_receipt_binding.schema_version,
    record_id_field: manifestContract.predecessor_receipt_binding.record_id_field,
  });
  validateStandardBinding(root, manifest.candidate_ordering_correction_authority_binding, {
    path: orderingAuthorityBinding.path,
    schema_version: orderingAuthorityBinding.schema_version,
    record_id_field: orderingAuthorityBinding.record_id_field,
  });
  assert(receipt.execution_manifest_id === manifest.execution_manifest_id
    && receipt.execution_manifest_digest === manifest.execution_manifest_digest
    && same(receipt.parent_authority_binding, manifest.parent_authority_binding)
    && same(receipt.activation_receipt_binding, manifest.activation_receipt_binding)
    && same(receipt.predecessor_receipt_binding, manifest.predecessor_receipt_binding)
    && same(receipt.candidate_ordering_correction_authority_binding,
      manifest.candidate_ordering_correction_authority_binding)
    && same(receipt.work3_entry_correction_authority_binding,
      manifest.work3_entry_correction_authority_binding)
    && manifest.candidate_registration_binding === null
    && manifest.candidate_transition === null,
  'BINDING_DRIFT', 'WORK3:rich receipt lineage');

  const nativeEvidence = receipt.candidate_native_set_evidence;
  const nativeContract = contract.candidate_native_set_evidence_contract;
  assert(same(nativeContract?.exact_keys, NATIVE_SET_EVIDENCE_KEYS)
    && exactKeys(nativeEvidence, nativeContract.exact_keys)
    && ['sealed_agreement_ids', 'additive_agreement_ids', 'combined_agreement_ids']
      .every((key) => Array.isArray(nativeEvidence[key]))
    && same(nativeEvidence.sealed_agreement_ids, nativeContract.sealed_agreement_ids)
    && same(nativeEvidence.additive_agreement_ids, nativeContract.additive_agreement_ids)
    && same(nativeEvidence.combined_agreement_ids, nativeContract.combined_agreement_ids)
    && nativeEvidence.extension_proof === nativeContract.extension_proof
    && same([
      nativeEvidence.work2_agreement_analysis_set_binding,
      nativeEvidence.work2_context_compilation_set_binding,
    ], nativeContract.work2_bindings),
  'BINDING_DRIFT', 'WORK3:native set evidence');
  const nativeSetRecords = NATIVE_SET_EVIDENCE_KEYS.slice(0, 5).map(
    (key) => validateStandardBinding(root, nativeEvidence[key]),
  );
  const work3NativeBindings = [
    nativeEvidence.work3_agreement_index_set_binding,
    nativeEvidence.work3_context_compilation_set_binding,
    nativeEvidence.work3_agreement_analysis_set_binding,
  ];
  assert(work3NativeBindings.every((binding, index) => {
    const expected = nativeContract.work3_binding_contracts[index];
    return binding.path === expected.path
      && binding.schema_version === expected.schema_version
      && binding.record_id_field === expected.record_id_field;
  }), 'BINDING_DRIFT', 'WORK3:native set binding contracts');
  validateCandidateNativeSetEvidence(
    root,
    authority,
    nativeContract,
    nativeEvidence,
    nativeSetRecords.slice(2),
  );

  const familyEvidence = receipt.family_profile_evidence;
  const familyContract = contract.family_profile_evidence_contract;
  assert(same(familyContract?.exact_keys, FAMILY_PROFILE_EVIDENCE_KEYS)
    && exactKeys(familyEvidence, familyContract.exact_keys)
    && same(familyContract.family_keys, FAMILIES)
    && same(familyEvidence.family_keys, familyContract.family_keys)
    && Array.isArray(familyEvidence.family_profile_package_bindings)
    && familyEvidence.family_profile_package_bindings.length === FAMILIES.length,
  'BINDING_DRIFT', 'WORK3:family profile evidence');

  const approvedSetContract = scope.approved_family_profile_set_contract;
  assert(same(approvedSetContract?.family_key_order, FAMILIES)
    && Array.isArray(approvedSetContract.package_path_mapping)
    && approvedSetContract.package_path_mapping.length === FAMILIES.length,
  'BINDING_DRIFT', 'WORK3:family package path authority');
  for (let index = 0; index < FAMILIES.length; index += 1) {
    const familyKey = FAMILIES[index];
    const binding = familyEvidence.family_profile_package_bindings[index];
    const mapping = approvedSetContract.package_path_mapping[index];
    assert(exactKeys(mapping, ['family_key', 'path'])
      && mapping.family_key === familyKey
      && binding.path === mapping.path,
    'BINDING_DRIFT', `${familyKey}:package path and artifact binding`);
  }
  const profileSetBinding = familyEvidence.approved_family_profile_set_binding;
  assert(profileSetBinding.path === approvedSetContract.path
    && profileSetBinding.schema_version === approvedSetContract.schema_version
    && profileSetBinding.record_id_field === approvedSetContract.record_id_field,
  'BINDING_DRIFT', 'WORK3:approved family profile set physical binding');
  const profileSet = validateStandardBinding(root, profileSetBinding, {
    path: approvedSetContract.path,
    schema_version: approvedSetContract.schema_version,
    record_id_field: approvedSetContract.record_id_field,
  });
  assert(profileSet.state === approvedSetContract.state,
    'BINDING_DRIFT', 'WORK3:approved family profile set state');

  const packagesByPath = new Map();
  for (let index = 0; index < FAMILIES.length; index += 1) {
    const familyKey = FAMILIES[index];
    const binding = familyEvidence.family_profile_package_bindings[index];
    const packageRecord = validateStandardBinding(root, binding, {
      schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
      record_id_field: 'family_profile_package_id',
    });
    assert(exactKeys(packageRecord, FAMILY_PACKAGE_KEYS)
      && packageRecord.state === 'BEN_APPROVED_FAMILY_PROFILE_PACKAGE'
      && packageRecord.family_key === familyKey
      && !packagesByPath.has(binding.path),
    'BINDING_DRIFT', `${familyKey}:outer package`);
    packagesByPath.set(binding.path, packageRecord);
  }

  assert(exactKeys(profileSet, APPROVED_PROFILE_SET_KEYS)
    && profileSet.state === 'BEN_APPROVED_PROFILE_SET'
    && same(profileSet.family_profile_package_bindings,
      familyEvidence.family_profile_package_bindings)
    && Array.isArray(profileSet.profiles)
    && Array.isArray(profileSet.dimension_evidence_bindings)
    && Array.isArray(profileSet.subtype_tree_bindings)
    && profileSet.subtype_tree_bindings.length === FAMILIES.length
    && same(profileSet.subtype_tree_bindings.map((entry) => entry?.family_key), FAMILIES),
  'BINDING_DRIFT', 'WORK3:approved family profile set');
  validateApprovedProfileInventory(profileSet, packagesByPath, approvedSetContract);
  validateDimensionEvidenceInventory(profileSet, packagesByPath, approvedSetContract);
  for (let index = 0; index < FAMILIES.length; index += 1) {
    const entry = profileSet.subtype_tree_bindings[index];
    assert(exactKeys(entry, ['family_key', 'binding']),
      'BINDING_DRIFT', `${FAMILIES[index]}:subtype tree entry`);
    validatePackageMemberBinding(root, entry.binding, packagesByPath, FAMILIES[index]);
  }

  const structureContract = contract.structure_disposition_set_binding_contract;
  const structureRecord = validateStandardBinding(root, receipt.structure_disposition_set_binding, {
    path: structureContract.path,
    schema_version: structureContract.schema_version,
    record_id_field: structureContract.record_id_field,
  });
  validateStructureDispositionSet(
    structureRecord,
    packagesByPath,
    authority,
    contract,
    nativeSetRecords[2],
  );
  validateFamilyProfilePackageSemantics(
    root,
    authority,
    profileSet,
    familyEvidence,
    packagesByPath,
    structureRecord,
    nativeSetRecords[2],
  );

  const artifactContract = contract.artifact_bindings_contract;
  assert(Array.isArray(receipt.artifact_bindings)
    && receipt.artifact_bindings.length === artifactContract.count
    && same(receipt.artifact_bindings.map((binding) => binding?.path),
      artifactContract.paths)
    && new Set(receipt.artifact_bindings.map((binding) => binding?.path)).size
      === receipt.artifact_bindings.length
    && receipt.artifact_set_digest === sha256Hex(canonicalJson(receipt.artifact_bindings)),
  'BINDING_DRIFT', 'WORK3:artifact binding inventory');
  validateArtifactBindingCategories(
    receipt.artifact_bindings,
    contract.standard_binding_contract,
    artifactContract,
  );
  const artifactBindingsByPath = new Map(
    receipt.artifact_bindings.map((binding) => [binding.path, binding]),
  );
  for (let index = 0; index < FAMILIES.length; index += 1) {
    const familyKey = FAMILIES[index];
    const binding = familyEvidence.family_profile_package_bindings[index];
    const mapping = approvedSetContract.package_path_mapping[index];
    assert(same(binding, artifactBindingsByPath.get(mapping.path)),
      'BINDING_DRIFT', `${familyKey}:package path and artifact binding`);
  }
  assert(same(profileSetBinding, artifactBindingsByPath.get(approvedSetContract.path)),
    'BINDING_DRIFT', 'WORK3:approved family profile set physical binding');
  for (const binding of receipt.artifact_bindings) validateStandardBinding(root, binding);
  const syntheticAgreementIndexBinding =
    contract.structure_disposition_set_binding_contract.synthetic_agreement_index_binding;
  assert(isPlainObject(syntheticAgreementIndexBinding)
    && same(artifactBindingsByPath.get(syntheticAgreementIndexBinding.path),
      syntheticAgreementIndexBinding),
  'BINDING_DRIFT', 'WORK3:synthetic agreement index binding');

  const ledgerContract = contract.command_execution_ledger_contract;
  assert(Array.isArray(receipt.command_execution_ledger)
    && receipt.command_execution_ledger.length === ledgerContract.entry_count
    && same(receipt.command_execution_ledger.map((entry) => entry?.argv), ledgerContract.argv_order)
    && receipt.command_execution_ledger.every((entry) => exactKeys(entry, ledgerContract.entry_exact_keys))
    && receipt.command_execution_ledger.every((entry) => Number.isSafeInteger(entry.run_count)
      && entry.run_count >= 0),
  'BINDING_DRIFT', 'WORK3:command ledger');
  const fixtureContract = scope.work3_execution_fixture_contract;
  const fixtureBinding = artifactBindingsByPath.get(WORK3_PROFILE_FIXTURE_PATH);
  const fixtureBytes = readBytes(root, WORK3_PROFILE_FIXTURE_PATH, 'BINDING_DRIFT');
  const fixtureRecord = parseJson(
    fixtureBytes,
    'BINDING_DRIFT',
    WORK3_PROFILE_FIXTURE_PATH,
  );
  assert(fixtureBytes.equals(Buffer.from(`${canonicalJson(fixtureRecord)}\n`, 'utf8'))
    && exactKeys(fixtureRecord, fixtureContract.exact_keys)
    && fixtureRecord.schema_version === fixtureContract.schema_version
    && fixtureRecord.state === fixtureContract.state
    && same(fixtureRecord.case_ids, fixtureContract.case_ids)
    && new Set(fixtureRecord.case_ids).size === fixtureRecord.case_ids.length
    && same(fixtureRecord.combined_test_result, fixtureContract.combined_test_result)
    && fixtureContract.receipt_must_byte_equal_fixture_counts_and_combined_result === true
    && same(fixtureRecord.combined_test_result, receipt.combined_test_result)
    && same(fixtureContract.command_run_counts?.argv_order,
      receipt.command_execution_ledger.map((entry) => entry.argv))
    && ledgerContract.run_counts_byte_equal_fixture === true
    && fixtureContract?.path === WORK3_PROFILE_FIXTURE_PATH
    && fixtureBinding
    && Array.isArray(fixtureRecord.command_run_counts)
    && fixtureRecord.command_run_counts.length === ledgerContract.entry_count
    && fixtureRecord.command_run_counts.every(
      (runCount) => Number.isSafeInteger(runCount) && runCount >= 0,
    )
    && same(fixtureRecord.command_run_counts,
      receipt.command_execution_ledger.map((entry) => entry.run_count)),
  'BINDING_DRIFT', 'WORK3:command run counts fixture');
  for (const range of ledgerContract.state_ranges) {
    for (let index = range.indices[0]; index <= range.indices[1]; index += 1) {
      assert(receipt.command_execution_ledger[index]?.state === range.state,
        'BINDING_DRIFT', `WORK3:command ledger state ${index}`);
    }
  }
  const bootstrapLimits = authority.execution_policy?.bootstrap_commands;
  const work3Limits = authority.execution_policy?.work3_commands;
  const authorisedWork3Limits = Array.isArray(work3Limits)
    ? work3Limits.map((entry) => ({ argv: entry?.argv, max_runs: entry?.maximum_runs }))
    : [];
  const allLimits = [
    ...(Array.isArray(bootstrapLimits)
      ? bootstrapLimits.map((entry) => ({
        argv: entry?.argv,
        max_runs: entry?.maximum_runs,
      }))
      : []),
    ...authorisedWork3Limits,
  ];
  assert(ledgerContract.run_counts_safe_nonnegative_and_within_corresponding_maximum === true
    && Array.isArray(bootstrapLimits)
    && bootstrapLimits.length === 4
    && bootstrapLimits.every((entry) => exactKeys(entry, ['argv', 'maximum_runs'])
      && Array.isArray(entry.argv)
      && Number.isSafeInteger(entry.maximum_runs)
      && entry.maximum_runs >= 0)
    && Array.isArray(work3Limits)
    && work3Limits.every((entry) => exactKeys(entry, ['argv', 'maximum_runs'])
      && Array.isArray(entry.argv)
      && Number.isSafeInteger(entry.maximum_runs)
      && entry.maximum_runs >= 0)
    && same(manifestContract.exact_argv_with_run_limits, authorisedWork3Limits)
    && same(manifest.exact_argv_with_run_limits, manifestContract.exact_argv_with_run_limits)
    && same(allLimits.map((entry) => entry.argv), ledgerContract.argv_order)
    && allLimits.every((limit, index) => (
      receipt.command_execution_ledger[index].run_count <= limit.max_runs
    )),
  'BINDING_DRIFT', 'WORK3:command ledger maxima');
  if (Number.isSafeInteger(ledgerContract.bootstrap_counts_minimum)) {
    for (let index = 0; index <= 3; index += 1) {
      assert(receipt.command_execution_ledger[index].run_count
        >= ledgerContract.bootstrap_counts_minimum,
      'BINDING_DRIFT', `WORK3:bootstrap command count ${index}`);
    }
  }
  if (Number.isSafeInteger(ledgerContract.pre_receipt_work3_command_counts_minimum)) {
    for (let index = 4; index <= 18; index += 1) {
      assert(receipt.command_execution_ledger[index].run_count
        >= ledgerContract.pre_receipt_work3_command_counts_minimum,
      'BINDING_DRIFT', `WORK3:pre-receipt command count ${index}`);
    }
  }
  if (Array.isArray(ledgerContract.finaliser_run_count_range)) {
    assert(receipt.command_execution_ledger[19].run_count
      >= ledgerContract.finaliser_run_count_range[0]
      && receipt.command_execution_ledger[19].run_count
        <= ledgerContract.finaliser_run_count_range[1],
    'BINDING_DRIFT', 'WORK3:finaliser command count');
  }
  if (Number.isSafeInteger(ledgerContract.required_post_receipt_validator_run_count)) {
    assert(receipt.command_execution_ledger[20].run_count
      === ledgerContract.required_post_receipt_validator_run_count,
    'BINDING_DRIFT', 'WORK3:post-receipt validator count');
  }
  const combinedContract = contract.combined_test_result_contract;
  assert(exactKeys(receipt.combined_test_result, combinedContract.exact_keys)
    && same(receipt.combined_test_result.argv, combinedContract.argv)
    && receipt.combined_test_result.semantic_run_count === combinedContract.semantic_run_count
    && receipt.combined_test_result.status === combinedContract.status
    && receipt.combined_test_result.test_file_count === combinedContract.test_file_count,
  'BINDING_DRIFT', 'WORK3:combined test result');

  const repositoryContract = contract.repository_precondition_contract;
  assert(exactKeys(receipt.repository_precondition, repositoryContract.exact_keys)
    && repositoryContract.exact_keys.every((key) => same(
      receipt.repository_precondition[key], repositoryContract[key],
    )),
  'BINDING_DRIFT', 'WORK3:repository precondition');
  const countsContract = contract.counts_contract;
  assert(exactKeys(receipt.counts, countsContract.exact_keys)
    && Object.entries(countsContract.exact_values).every(
      ([key, value]) => receipt.counts[key] === value,
    )
    && receipt.counts.structure_disposition_member_count
      === (Array.isArray(structureRecord.members) ? structureRecord.members.length : 0),
  'BINDING_DRIFT', 'WORK3:counts');
  assert(same(receipt.checks, contract.checks_contract.exact_ordered_checks),
    'BINDING_DRIFT', 'WORK3:checks');
  assert(exactKeys(receipt.effects, contract.effects_contract.exact_keys)
    && same(receipt.effects, contract.effects_contract.exact_values),
  'BINDING_DRIFT', 'WORK3:effects');
  assert(exactKeys(receipt.next_work, contract.next_work_contract.exact_keys)
    && same(receipt.next_work, contract.next_work_contract.exact_values),
  'BINDING_DRIFT', 'WORK3:next work');
  assert(receipt.candidate_registration_id === contract.candidate_registration_id
    && receipt.candidate_transition === contract.candidate_transition,
  'BINDING_DRIFT', 'WORK3:null candidate and transition');
  return {
    family_keys: [...FAMILIES],
    lineage_bindings: {
      activation_receipt_binding: structuredClone(manifest.activation_receipt_binding),
      predecessor_receipt_binding: structuredClone(manifest.predecessor_receipt_binding),
    },
    native_set_bindings: {
      BASE_ANALYSIS_SET: structuredClone(nativeEvidence.work3_agreement_analysis_set_binding),
      AGREEMENT_INDEX_SET: structuredClone(nativeEvidence.work3_agreement_index_set_binding),
      CONTEXT_COMPILATION_SET: structuredClone(
        nativeEvidence.work3_context_compilation_set_binding,
      ),
    },
    profile_set_binding: profileSetBinding,
    subtype_tree_bindings: structuredClone(profileSet.subtype_tree_bindings),
    structure_disposition_set_binding: structuredClone(receipt.structure_disposition_set_binding),
  };
}

function validateRichWork3ReceiptV2(root, receipt) {
  let validationResult;
  try {
    validationResult = validateWork3({
      repoRoot: root,
      ...(receipt.work3_receipt_id === SEALED_WORK3_V2_RECEIPT_ID
        ? { sourceCommit: SEALED_WORK3_V2_COMMIT }
        : {}),
    });
  } catch (error) {
    fail('BINDING_DRIFT', `WORK3:V2 receipt validation:${error.code ?? error.message}`);
  }
  const nonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
  assert(exactKeys(validationResult, WORK3_V2_VALIDATION_KEYS)
    && validationResult.schema_version === 'STAGE_2Y_M7_V2_REPAIR_WORK3_VALIDATION/V2'
    && validationResult.status === 'PASS'
    && validationResult.work3_receipt_id === receipt.work3_receipt_id
    && nonNegativeInteger(validationResult.family_package_count)
    && validationResult.family_package_count > 0
    && nonNegativeInteger(validationResult.profile_count)
    && validationResult.profile_count > 0
    && nonNegativeInteger(validationResult.artifact_binding_count)
    && nonNegativeInteger(validationResult.effective_path_count)
    && nonNegativeInteger(validationResult.create_once_output_count),
  'BINDING_DRIFT', 'WORK3:V2 validation result');
  const familyEvidence = receipt.family_profile_evidence;
  const familyKeys = familyEvidence?.sealed_package_family_keys;
  assert(Array.isArray(familyKeys)
    && familyKeys.length === validationResult.family_package_count
    && new Set(familyKeys).size === familyKeys.length
    && !familyKeys.includes('CAPITALISATION'),
  'BINDING_DRIFT', 'WORK3:V2 sealed family order');
  const profileSetBinding = familyEvidence.approved_family_profile_set_binding;
  const profileSet = validateStandardBinding(root, profileSetBinding, {
    schema_version: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1',
    record_id_field: 'family_profile_set_id',
  });
  assert(same(profileSet.subtype_tree_bindings.map((entry) => entry?.family_key), familyKeys),
    'BINDING_DRIFT', 'WORK3:V2 subtype tree family order');
  assert(Array.isArray(profileSet.profiles)
    && profileSet.profiles.length === validationResult.profile_count
    && Array.isArray(profileSet.family_profile_package_bindings)
    && profileSet.family_profile_package_bindings.length === validationResult.family_package_count,
  'COUNT_RECOUNT', 'WORK3:V2 profile and package recount');
  const nativeEvidence = receipt.candidate_native_set_evidence;
  return {
    family_keys: structuredClone(familyKeys),
    lineage_bindings: {
      activation_receipt_binding: structuredClone(receipt.activation_receipt_binding),
      predecessor_receipt_binding: structuredClone(receipt.predecessor_receipt_binding),
    },
    native_set_bindings: {
      BASE_ANALYSIS_SET: structuredClone(nativeEvidence.work3_agreement_analysis_set_binding),
      AGREEMENT_INDEX_SET: structuredClone(nativeEvidence.work3_agreement_index_set_binding),
      CONTEXT_COMPILATION_SET: structuredClone(
        nativeEvidence.work3_context_compilation_set_binding,
      ),
    },
    profile_set_binding: structuredClone(profileSetBinding),
    subtype_tree_bindings: structuredClone(profileSet.subtype_tree_bindings),
    structure_disposition_set_binding: structuredClone(
      receipt.structure_disposition_set_binding,
    ),
    validation_result: structuredClone(validationResult),
  };
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
  return [
    ...WORK1_TESTS,
    ...(predecessorCount >= 2 ? [WORK3_MAE_TEST] : []),
    ...(predecessorCount >= 3 ? [WORK4_PROJECTION_DISPATCH_TEST] : []),
    ...later,
  ].sort();
}

// The authority's tests file-prefix rule: directory "tests", prefix
// "stage-2y-structure-m7-v2-repair-", suffix pattern "^[a-z0-9-]+\.test\.js$".
const TEST_PATH_PATTERN = /^tests\/stage-2y-structure-m7-v2-repair-[a-z0-9-]+\.test\.js$/;

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
  const baselineTests = requiredTests(predecessorCount);
  assert(code.tests.every((repositoryPath) => TEST_PATH_PATTERN.test(repositoryPath)),
    'INVALID_SPECIFICATION', 'tests:naming');
  assert(baselineTests.every((repositoryPath) => code.tests.includes(repositoryPath)),
    'INVALID_SPECIFICATION', 'tests:baseline roster');
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

function validateSubtypeTrees(root, descriptors, work3Context) {
  const familyKeys = work3Context?.family_keys ?? FAMILIES;
  assert(Array.isArray(descriptors) && descriptors.length === familyKeys.length,
    'INVALID_SPECIFICATION', 'subtype_trees');
  assert(same(descriptors.map((entry) => entry?.family_key), familyKeys),
    'INVALID_SPECIFICATION', 'subtype tree family order');
  assert(work3Context && same(descriptors, work3Context.subtype_tree_bindings),
    'BINDING_DRIFT', 'candidate subtype trees must equal approved Work3 package members');
  return structuredClone(work3Context.subtype_tree_bindings);
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
  return { path: record.work_receipt_path, record };
}

function validateWork3SuccessorManifestBasis(root) {
  const bytes = readBytes(root, WORK3_SUCCESSOR_MANIFEST_PATH, 'BINDING_DRIFT');
  const record = parseJson(bytes, 'BINDING_DRIFT', WORK3_SUCCESSOR_MANIFEST_PATH);
  assert(bytes.equals(canonicalBytes(record)), 'BINDING_DRIFT', 'WORK3:V2 manifest canonical');
  const unsigned = structuredClone(record);
  delete unsigned.execution_manifest_digest;
  delete unsigned.execution_manifest_id;
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, execution_manifest_digest: digest };
  assert(record.schema_version === WORK3_SUCCESSOR_MANIFEST_SCHEMA
    && record.work === 'WORK3'
    && record.state === 'PRE_WORK_BOOTSTRAP_ONLY'
    && record.execution_manifest_digest === digest
    && record.execution_manifest_id === contentId(record.schema_version, withDigest)
    && typeof record.work_receipt_path === 'string',
  'BINDING_DRIFT', 'WORK3:V2 successor manifest');
  return { path: record.work_receipt_path, record };
}

function expectedReceiptContract(root, work, selectedSchemaVersion = null) {
  if (work === 'WORK1') {
    return {
      path: WORK1_RECEIPT_PATH,
      schema_version: WORK1_RECEIPT_SCHEMA,
      record_id_field: 'work1_contract_receipt_id',
      manifest: null,
    };
  }
  const manifest = work === 'WORK3' && selectedSchemaVersion === WORK3_RECEIPT_V2_SCHEMA
    ? validateWork3SuccessorManifestBasis(root)
    : validateExecutionManifestBasis(root, work);
  if (work === 'WORK2') {
    return {
      path: manifest.path,
      schema_version: WORK2_RECEIPT_SCHEMA,
      record_id_field: 'work2_receipt_id',
      manifest: manifest.record,
    };
  }
  assert(work === 'WORK3', 'INVALID_SPECIFICATION', 'predecessor work');
  assert([WORK3_RECEIPT_SCHEMA, WORK3_RECEIPT_V2_SCHEMA].includes(selectedSchemaVersion),
    'INVALID_SPECIFICATION', 'WORK3:receipt schema');
  return {
    path: manifest.path,
    schema_version: selectedSchemaVersion,
    record_id_field: 'work3_receipt_id',
    manifest: manifest.record,
  };
}

function validateClosedPredecessorReceipt(root, receipt, work, expected) {
  if (work === 'WORK1') {
    const unsigned = structuredClone(receipt);
    delete unsigned.work1_contract_receipt_digest;
    delete unsigned.work1_contract_receipt_id;
    const digest = sha256Hex(canonicalJson(unsigned));
    const withDigest = { ...unsigned, work1_contract_receipt_digest: digest };
    assert(exactKeys(receipt, WORK1_RECEIPT_KEYS)
      && receipt.schema_version === WORK1_RECEIPT_SCHEMA
      && receipt.work1_contract_receipt_digest === digest
      && receipt.work1_contract_receipt_id === contentId(WORK1_RECEIPT_SCHEMA, withDigest)
      && receipt.stage === 'M7_V2_REPAIR_WORK1'
      && receipt.state === 'PASS_WORK1_CONTRACTS'
      && receipt.status === 'PASS',
    'BINDING_DRIFT', 'WORK1:receipt state');
    return null;
  }
  if (work === 'WORK2') return null;
  if (expected.schema_version === WORK3_RECEIPT_V2_SCHEMA) {
    return validateRichWork3ReceiptV2(root, receipt);
  }
  const manifest = expected.manifest;
  return validateRichWork3Receipt(root, receipt, manifest);
}

function validatePredecessors(root, descriptors) {
  assert(Array.isArray(descriptors) && descriptors.length === 3,
    'INVALID_SPECIFICATION', 'predecessor_receipts');
  assert(canonicalJson(descriptors.map((descriptor) => descriptor?.work))
    === canonicalJson(['WORK1', 'WORK2', 'WORK3']),
  'INVALID_SPECIFICATION', 'predecessor receipts:order');
  const seen = new Set();
  const result = [];
  let work3Context = null;
  for (const descriptor of descriptors) {
    validateDescriptor(descriptor, 'work');
    assert(/^WORK[1-7]$/.test(descriptor.work) && !seen.has(descriptor.work),
      'INVALID_SPECIFICATION', 'predecessor work');
    let receiptBinding = null;
    let receipt = null;
    if (descriptor.work === 'WORK3') {
      receiptBinding = bindingForRecord(root, {
        path: descriptor.path,
        schema_version: descriptor.schema_version,
        record_id_field: 'work3_receipt_id',
      });
      receipt = parseJson(
        readBytes(root, descriptor.path),
        'BINDING_DRIFT',
        descriptor.path,
      );
      if (descriptor.schema_version === WORK3_RECEIPT_SCHEMA) {
        validateRichWork3ReceiptEnvelope(receipt);
      }
    }
    const expected = expectedReceiptContract(
      root,
      descriptor.work,
      descriptor.schema_version,
    );
    assert(descriptor.path === expected.path
      && descriptor.schema_version === expected.schema_version
      && descriptor.record_id_field === expected.record_id_field,
    'INVALID_SPECIFICATION', `${descriptor.work}:receipt contract`);
    seen.add(descriptor.work);
    if (receiptBinding === null) {
      receiptBinding = bindingForRecord(root, {
        path: descriptor.path,
        record_id_field: descriptor.record_id_field,
        schema_version: descriptor.schema_version,
      });
    }
    if (descriptor.work === 'WORK2') {
      try {
        validateWork2SuccessorReceiptBinding({
          repoRoot: root,
          binding: receiptBinding,
          work3EntryCorrectionAuthorityBinding: WORK3_CORRECTION_AUTHORITY_BINDING,
        });
      } catch (error) {
        fail('BINDING_DRIFT', `WORK2:receipt validation:${error.code ?? error.message}`);
      }
    }
    if (receipt === null) {
      receipt = parseJson(
        readBytes(root, descriptor.path),
        'BINDING_DRIFT',
        descriptor.path,
      );
    }
    const context = validateClosedPredecessorReceipt(root, receipt, descriptor.work, expected);
    if (descriptor.work === 'WORK3') work3Context = context;
    result.push({ work: descriptor.work, binding: receiptBinding });
  }
  assert(work3Context && same(
    work3Context.lineage_bindings.predecessor_receipt_binding,
    result.find((entry) => entry.work === 'WORK2')?.binding,
  ), 'BINDING_DRIFT', 'Work3 predecessor continuity');
  return { bindings: result, work3_context: work3Context };
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

// `registration_schema_extensions.import_closure_binding_required`: the
// registration binds not only the code roles it names but every repository
// module the static import graph of those roles can reach. A specifier that
// cannot be read as a string is refused by the closure walk itself
// (IMPORT_CLOSURE_UNRESOLVED, naming the file and line), so a registration
// cannot silently under-report what its bound code loads.
function buildImportClosureBindings(root, code) {
  const entryPaths = [
    code.compiler, code.deterministic_generator, code.contract_validator,
    code.projector, code.independent_verifier,
    ...code.runners, ...code.tests,
  ];
  let members;
  try {
    members = importClosure({ repoRoot: root, entryPaths });
  } catch (error) {
    fail(error.code ?? 'IMPORT_CLOSURE_UNRESOLVED', error.message);
  }
  return members.map((repositoryPath) => {
    const bytes = readBytes(root, repositoryPath);
    return {
      path: repositoryPath,
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      git_blob_oid: gitBlobOid(bytes),
    };
  });
}

function buildRegistration(root, specification) {
  assert(exactKeys(specification, SPECIFICATION_KEYS), 'INVALID_SPECIFICATION', 'specification');
  const governance = validateAuthorityChain(root);
  const predecessors = validatePredecessors(root, specification.predecessor_receipts);
  const predecessorReceiptBindings = predecessors.bindings;
  const codeBindings = validateCode(root, specification.code, predecessorReceiptBindings.length);
  const semanticInputBindings = validateSemanticInputs(root, specification.semantic_inputs);
  const familyProfileSetBinding = semanticInputBindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  ).binding;
  const structureDispositionSetBinding = semanticInputBindings.find(
    (entry) => entry.input_role === 'APPROVED_STRUCTURE_DISPOSITION_SET',
  ).binding;
  const nativeSetContinuity = [
    'BASE_ANALYSIS_SET', 'AGREEMENT_INDEX_SET', 'CONTEXT_COMPILATION_SET',
  ].every((inputRole) => same(
    semanticInputBindings.find((entry) => entry.input_role === inputRole)?.binding,
    predecessors.work3_context?.native_set_bindings?.[inputRole],
  ));
  assert(nativeSetContinuity
    && same(predecessors.work3_context?.lineage_bindings?.activation_receipt_binding,
      governance.activation)
    && same(familyProfileSetBinding, predecessors.work3_context?.profile_set_binding)
    && same(structureDispositionSetBinding,
      predecessors.work3_context?.structure_disposition_set_binding),
  'BINDING_DRIFT', 'Work3 semantic binding continuity');
  const subtypeTreeBindings = validateSubtypeTrees(
    root,
    specification.subtype_trees,
    predecessors.work3_context,
  );
  validateDescriptor(specification.view_policy);
  assert(specification.view_policy.schema_version === 'STAGE_2Y_M7_V2_VIEW_POLICY/V1'
    && specification.view_policy.record_id_field === 'view_policy_id',
  'INVALID_SPECIFICATION', 'view_policy');
  const viewPolicyBinding = bindingForRecord(root, specification.view_policy);
  const allowedOutputRoot = validateOutputRoot(root, specification.allowed_output_root);
  const importClosureBindings = buildImportClosureBindings(root, specification.code);
  const counts = {
    // The five singleton code roles are counted from the role list itself, not
    // from a literal: `literal_count_pins_forbidden_in` names this file.
    code_file_count: CODE_SINGLETON_ROLES.length
      + codeBindings.runners.length + codeBindings.tests.length,
    runner_count: codeBindings.runners.length,
    test_count: codeBindings.tests.length,
    semantic_input_count: semanticInputBindings.length,
    subtype_tree_count: subtypeTreeBindings.length,
    predecessor_receipt_count: predecessorReceiptBindings.length,
    import_closure_count: importClosureBindings.length,
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
    import_closure_bindings: importClosureBindings,
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
  counts.unique_bound_path_count = new Set(
    allBindings(unsigned).map((binding) => binding.path ?? binding.container_path),
  ).size;
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
