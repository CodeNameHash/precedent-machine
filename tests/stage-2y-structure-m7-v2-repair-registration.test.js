'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const acceptanceCases = require(
  './fixtures/canonical-v2/m7-v2-repair/work1-acceptance-cases.json'
);
const {
  buildLawfulWork3FamilyPackageSetFixture,
} = require('./helpers/m7-v2-work3-family-package-fixture');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
const VERIFICATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1';
const REGISTRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const CANDIDATE_REPLACEMENT_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-candidate-replacement-authority.json';
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json';
const ACTIVATION_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json';
const WORK0_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json';
const WORK1_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json';
const WORK2_MANIFEST_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-execution-manifest.json';
const WORK2_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work2-compiler.json';
const WORK2_AGREEMENT_SET_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-agreement-analysis-set.json';
const WORK2_CONTEXT_SET_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-context-compilation-set.json';
const WORK2_EXECUTION_FIXTURE_PATH = 'tests/fixtures/canonical-v2/m7-v2-repair/work2-compiler-cases.json';
const WORK2_CREATE_ONCE_OUTPUT_PATHS = Object.freeze([
  WORK2_AGREEMENT_SET_PATH,
  WORK2_CONTEXT_SET_PATH,
  WORK2_RECEIPT_PATH,
]);
const WORK2_STALE_RECEIPT_RUN_COUNTS = Object.freeze([
  4, 1, 1, 1, 1, 1, 1, 1, 13, 3, 8, 2, 1, 0,
]);
const WORK3_MANIFEST_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-execution-manifest.json';
const WORK3_CORRECTION_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';
const WORK3_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-profile.json';
const PACKAGE_MEMBER_SCHEMA = 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1';
const MATCH_FIXTURE_SCHEMA = 'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1';
const STRUCTURE_FIXTURE_SCHEMA = 'STAGE_2Y_M7_V2_STRUCTURE_OVERLAY_FIXTURE/V1';
const STRUCTURE_SET_SCHEMA = 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1';
const STRUCTURE_SET_KEYS = [
  'schema_version', 'structure_disposition_set_id', 'state', 'members',
];
const STRUCTURE_MEMBER_KEYS = [
  'schema_version', 'structure_disposition_id', 'kind', 'reason_code', 'policy_id',
  'policy_version', 'authority_class', 'approver', 'lawyer_ruling_id', 'scope',
  'inclusion_fixture_bindings', 'exclusion_fixture_bindings', 'match_test',
  'inline_list_overlay',
];
const INLINE_OVERLAY_KEYS = [
  'schema_version', 'lawyer_ruling_id', 'agreement_index_binding',
  'sealed_ambiguity_id', 'sealed_ambiguity_type', 'sealed_ambiguity_span',
  'inline_marker_disposition_id', 'parent_node_occurrence_id', 'parent_reference',
  'parent_scoping_rule', 'marker_eligibility', 'candidate_trees',
  'selected_candidate_tree_id', 'technical_review',
  'ambiguous_repeat_fixture_bindings',
];
const RICH_WORK3_RECEIPT_KEYS = [
  'schema_version', 'work3_receipt_id', 'work', 'stage', 'state', 'status',
  'execution_manifest_id', 'execution_manifest_digest', 'parent_authority_binding',
  'activation_receipt_binding', 'predecessor_receipt_binding',
  'candidate_ordering_correction_authority_binding',
  'work3_entry_correction_authority_binding', 'candidate_registration_id',
  'candidate_transition', 'candidate_native_set_evidence', 'family_profile_evidence',
  'structure_disposition_set_binding', 'artifact_bindings', 'artifact_set_digest',
  'command_execution_ledger', 'combined_test_result', 'repository_precondition',
  'counts', 'checks', 'effects', 'next_work',
];
const FAMILIES = [
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
];
const SEMANTIC_ROLES = [
  ['BASE_ANALYSIS_SET', 'AGREEMENT_ANALYSIS_SET/V1', 'analysis_set_id'],
  ['AGREEMENT_INDEX_SET', 'AGREEMENT_INDEX_SET/V1', 'agreement_index_set_id'],
  ['CONTEXT_COMPILATION_SET', 'CONTEXT_COMPILATION_SET/V1', 'context_compilation_set_id'],
  ['APPROVED_FAMILY_PACKET_SET', 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1', 'family_packet_set_id'],
  ['APPROVED_FAMILY_PROFILE_SET', 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1', 'family_profile_set_id'],
  ['APPROVED_STRUCTURE_DISPOSITION_SET', 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1', 'structure_disposition_set_id'],
];
const CANDIDATE_CONTINUITY_CASE = acceptanceCases.public_seam_positive_cases.find(
  (entry) => entry.case_id === 'candidate-registration-is-fully-verified-and-continuous',
);

function write(root, repositoryPath, bytes) {
  const absolute = path.join(root, repositoryPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, bytes);
}

function copyRepositoryFile(root, repositoryPath) {
  const source = path.join(ROOT, repositoryPath);
  if (!fs.existsSync(source)) return;
  const destination = path.join(root, repositoryPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function descriptorForRecord(root, repositoryPath, idField) {
  const value = JSON.parse(fs.readFileSync(path.join(root, repositoryPath), 'utf8'));
  return {
    path: repositoryPath,
    schema_version: value.schema_version,
    record_id_field: idField,
  };
}

function prepareWork2Template(t, finaliser) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-registration-work2-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const requiredPaths = new Set([
    WORK2_MANIFEST_PATH,
    ...manifest.permitted_read_paths,
    ...manifest.permitted_write_paths,
  ]);
  assert.deepEqual(
    manifest.permitted_write_paths.filter(
      (repositoryPath) => WORK2_CREATE_ONCE_OUTPUT_PATHS.includes(repositoryPath),
    ),
    [...WORK2_CREATE_ONCE_OUTPUT_PATHS],
  );
  assert.equal(
    [...requiredPaths].some(
      (repositoryPath) => repositoryPath === REGISTRATION_ROOT
        || repositoryPath.startsWith(`${REGISTRATION_ROOT}/`),
    ),
    false,
  );
  for (const repositoryPath of requiredPaths) {
    if (!WORK2_CREATE_ONCE_OUTPUT_PATHS.includes(repositoryPath)) {
      copyRepositoryFile(root, repositoryPath);
    }
  }
  for (const repositoryPath of WORK2_CREATE_ONCE_OUTPUT_PATHS) {
    assert.equal(fs.existsSync(path.join(root, repositoryPath)), false);
  }
  assert.equal(fs.existsSync(path.join(root, REGISTRATION_ROOT)), false);
  for (const receiptPath of [
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m3-context-compilation.json',
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m4-agreement-analysis.json',
  ]) {
    const receipt = JSON.parse(fs.readFileSync(path.join(root, receiptPath), 'utf8'));
    for (const binding of receipt.output_bindings) copyRepositoryFile(root, binding.path);
  }
  const executionFixture = JSON.parse(
    fs.readFileSync(path.join(root, WORK2_EXECUTION_FIXTURE_PATH), 'utf8'),
  );
  executionFixture.state = 'BUILD_ONLY_SOURCE_SET_AND_RECEIPT_ACCEPTANCE';
  executionFixture.combined_test_result = {
    semantic_run_count: 0,
    status: 'PASS',
    test_file_count: 2,
  };
  assert.equal(manifest.exact_argv_with_run_limits.length, 14);
  executionFixture.command_run_counts = [...WORK2_STALE_RECEIPT_RUN_COUNTS];
  write(root, WORK2_EXECUTION_FIXTURE_PATH, `${canonicalJson(executionFixture)}\n`);
  for (const repositoryPath of WORK2_CREATE_ONCE_OUTPUT_PATHS) {
    assert.equal(fs.existsSync(path.join(root, repositoryPath)), false);
  }
  assert.equal(fs.existsSync(path.join(root, REGISTRATION_ROOT)), false);
  const result = finaliser.finaliseWork2({ repoRoot: root, write: true });
  assert.equal(result.status, 'PASS_WORK2_FINALISATION');
  assert.deepEqual(result.target_paths, [...WORK2_CREATE_ONCE_OUTPUT_PATHS]);
  for (const repositoryPath of WORK2_CREATE_ONCE_OUTPUT_PATHS) {
    const stat = fs.lstatSync(path.join(root, repositoryPath));
    assert.equal(stat.isFile(), true);
    assert.equal(stat.isSymbolicLink(), false);
  }
  assert.equal(fs.existsSync(path.join(root, REGISTRATION_ROOT)), false);
  return root;
}

function record(schemaVersion, idField, body) {
  const unsigned = { schema_version: schemaVersion, ...body };
  return {
    schema_version: schemaVersion,
    [idField]: contentId(schemaVersion, unsigned),
    ...body,
  };
}

function nativeAgreementIndexRecord(agreementId) {
  const canonicalTextId = sha256Hex(`synthetic-canonical-text:${agreementId}`);
  const structuralPolicyDigest = sha256Hex(`synthetic-structural-policy:${agreementId}`);
  const body = {
    aliases: [],
    ambiguities: [],
    annotations: [],
    byte_coverage: { proof_digest: sha256Hex(`synthetic-byte-coverage:${agreementId}`) },
    counts: { nodes: 0 },
    diagnostics: [],
    inline_marker_dispositions: [],
    inline_marker_partition: {
      proof_digest: sha256Hex(`synthetic-inline-marker-partition:${agreementId}`),
    },
    nodes: [],
    root_node_occurrence_id: `synthetic-root:${agreementId}`,
    source_artefacts: [],
    source_binding: {
      agreement_id: agreementId,
      canonical_text_id: canonicalTextId,
      canonical_text_sha256: sha256Hex(`synthetic-canonical-bytes:${agreementId}`),
    },
    structural_policy: { policy_digest: structuralPolicyDigest },
  };
  const agreementIndexId = contentId('AGREEMENT_INDEX/V1', {
    agreement_id: agreementId,
    canonical_text_id: canonicalTextId,
    structural_policy_digest: structuralPolicyDigest,
    root_node_occurrence_id: body.root_node_occurrence_id,
    counts: body.counts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', body.nodes),
    annotation_set_digest: contentId('AGREEMENT_INDEX_ANNOTATION_SET/V1', body.annotations),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1', body.source_artefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', body.aliases),
    ambiguity_set_digest: contentId('AGREEMENT_INDEX_AMBIGUITY_SET/V1', body.ambiguities),
    diagnostic_set_digest: contentId('AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', body.diagnostics),
    inline_marker_disposition_set_digest: contentId(
      'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1',
      body.inline_marker_dispositions,
    ),
    inline_marker_partition_proof_digest: body.inline_marker_partition.proof_digest,
    byte_coverage_proof_digest: body.byte_coverage.proof_digest,
  });
  return {
    schema_version: 'AGREEMENT_INDEX/V1',
    agreement_index_id: agreementIndexId,
    ...body,
  };
}

function writeRecord(root, repositoryPath, schemaVersion, idField, body = {}) {
  const value = record(schemaVersion, idField, body);
  write(root, repositoryPath, `${canonicalJson(value)}\n`);
  return { path: repositoryPath, schema_version: schemaVersion, record_id_field: idField };
}

function writeDigestRecord(root, repositoryPath, schemaVersion, digestField, idField, body = {}) {
  const unsigned = { schema_version: schemaVersion, ...body };
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  const value = { ...withDigest, [idField]: contentId(schemaVersion, withDigest) };
  write(root, repositoryPath, `${canonicalJson(value)}\n`);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function restampRegistration(value) {
  const unsigned = clone(value);
  delete unsigned.candidate_registration_id;
  return {
    ...unsigned,
    candidate_registration_id: contentId(SCHEMA, unsigned),
  };
}

function restampRecord(value, idField) {
  const unsigned = clone(value);
  delete unsigned[idField];
  return {
    ...unsigned,
    [idField]: contentId(unsigned.schema_version, unsigned),
  };
}

function restampDigestRecord(value, digestField, idField) {
  const unsigned = clone(value);
  delete unsigned[digestField];
  delete unsigned[idField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return {
    ...withDigest,
    [idField]: contentId(unsigned.schema_version, withDigest),
  };
}

function structureDispositionMember(body) {
  return {
    schema_version: STRUCTURE_SET_SCHEMA,
    structure_disposition_id: contentId(STRUCTURE_SET_SCHEMA, body),
    ...body,
  };
}

function restampStructureDispositionMember(value) {
  const body = clone(value);
  delete body.schema_version;
  delete body.structure_disposition_id;
  return structureDispositionMember(body);
}

function restampWork1Receipt(value) {
  const unsigned = clone(value);
  delete unsigned.work1_contract_receipt_digest;
  delete unsigned.work1_contract_receipt_id;
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, work1_contract_receipt_digest: digest };
  return {
    ...withDigest,
    work1_contract_receipt_id: contentId(unsigned.schema_version, withDigest),
  };
}

function writeCanonicalRecord(root, repositoryPath, value) {
  write(root, repositoryPath, `${canonicalJson(value)}\n`);
}

function bindingForRecordPath(root, repositoryPath, idField) {
  const bytes = fs.readFileSync(path.join(root, repositoryPath));
  const value = JSON.parse(bytes);
  return {
    path: repositoryPath,
    schema_version: value.schema_version,
    record_id_field: idField,
    record_id: value[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function bindingForRawPath(root, repositoryPath) {
  const bytes = fs.readFileSync(path.join(root, repositoryPath));
  return {
    path: repositoryPath,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function packageMemberBinding(containerPath, member, {
  memberField = 'subtype_tree',
  memberIndex = null,
  recordIdField = 'subtype_tree_id',
} = {}) {
  const bytes = Buffer.from(canonicalJson(member), 'utf8');
  return {
    schema_version: PACKAGE_MEMBER_SCHEMA,
    container_path: containerPath,
    member_field: memberField,
    member_index: memberIndex,
    member_schema_version: member.schema_version,
    member_record_id_field: recordIdField,
    member_record_id: member[recordIdField],
    member_byte_length: bytes.length,
    member_sha256: sha256Hex(bytes),
  };
}

function predecessorSemanticMutationCases() {
  return [
    {
      label: 'Work1 state',
      index: 0,
      path: WORK1_RECEIPT_PATH,
      idField: 'work1_contract_receipt_id',
      mutate: (value) => { value.state = 'PASS_WORK1_OTHER'; },
      restamp: restampWork1Receipt,
    },
    {
      label: 'Work1 key set',
      index: 0,
      path: WORK1_RECEIPT_PATH,
      idField: 'work1_contract_receipt_id',
      mutate: (value) => { value.unapproved_field = true; },
      restamp: restampWork1Receipt,
    },
    {
      label: 'Work1 digest',
      index: 0,
      path: WORK1_RECEIPT_PATH,
      idField: 'work1_contract_receipt_id',
      mutate: (value) => { value.work1_contract_receipt_digest = '0'.repeat(64); },
      restamp: (value) => restampRecord(value, 'work1_contract_receipt_id'),
    },
    {
      label: 'Work2 historical candidate-root attestation',
      index: 1,
      path: WORK2_RECEIPT_PATH,
      idField: 'work2_receipt_id',
      mutate: (value) => {
        value.repository_precondition.candidate_registration_root_state = 'NON_EMPTY';
      },
      restamp: (value) => restampRecord(value, 'work2_receipt_id'),
    },
    {
      label: 'Work3 state',
      index: 2,
      path: WORK3_RECEIPT_PATH,
      idField: 'work3_receipt_id',
      mutate: (value) => { value.state = 'PASS_WORK3_OTHER'; },
      restamp: (value) => restampRecord(value, 'work3_receipt_id'),
    },
    {
      label: 'Work3 key set',
      index: 2,
      path: WORK3_RECEIPT_PATH,
      idField: 'work3_receipt_id',
      mutate: (value) => { value.unapproved_field = true; },
      restamp: (value) => restampRecord(value, 'work3_receipt_id'),
    },
    {
      label: 'Work3 manifest continuity',
      index: 2,
      path: WORK3_RECEIPT_PATH,
      idField: 'work3_receipt_id',
      mutate: (value) => { value.execution_manifest_digest = '0'.repeat(64); },
      restamp: (value) => restampRecord(value, 'work3_receipt_id'),
    },
  ];
}

function gitBlobOid(bytes) {
  return crypto.createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function assertCode(action, code) {
  assert.throws(action, (error) => {
    assert.equal(error?.code, code);
    return true;
  });
}

function makeBaseFixture(t, work2Template) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-registration-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  fs.cpSync(work2Template, root, { recursive: true });

  const code = {
    compiler: 'lib/canonical-v2/agreement-analysis-consolidation.js',
    deterministic_generator: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
    contract_validator: 'lib/canonical-v2/m7-v2-contract.js',
    projector: 'lib/canonical-v2/agreement-projection.js',
    independent_verifier: 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
    runners: [
      'scripts/stage-2y-structure-family-aggregate.mjs',
      'scripts/stage-2y-structure-generalisation-shadow.mjs',
      'scripts/stage-2y-structure-m6-project.mjs',
    ],
    tests: [
      'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
      'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js',
      'tests/stage-2y-structure-m7-v2-repair-projection-dispatch.test.js',
      'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work2.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work4.test.js',
    ],
  };
  for (const repositoryPath of [
    code.compiler,
    code.deterministic_generator,
    code.contract_validator,
    code.projector,
    code.independent_verifier,
    ...code.runners,
    ...code.tests,
  ]) {
    if (!fs.existsSync(path.join(root, repositoryPath))) copyRepositoryFile(root, repositoryPath);
    if (!fs.existsSync(path.join(root, repositoryPath))) {
      write(root, repositoryPath, Buffer.from(`fixture:${repositoryPath}\n`, 'utf8'));
    }
  }

  const semantic_inputs = SEMANTIC_ROLES.map(([input_role, schemaVersion, idField]) => {
    if (input_role === 'BASE_ANALYSIS_SET') {
      return {
        input_role,
        ...descriptorForRecord(root, WORK2_AGREEMENT_SET_PATH, 'agreement_analysis_set_id'),
      };
    }
    if (input_role === 'CONTEXT_COMPILATION_SET') {
      return {
        input_role,
        ...descriptorForRecord(root, WORK2_CONTEXT_SET_PATH, 'context_compilation_set_id'),
      };
    }
    return {
      input_role,
      ...writeRecord(
        root,
        `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/inputs/${input_role.toLowerCase()}.json`,
        schemaVersion,
        idField,
        { state: 'FIXTURE' },
      ),
    };
  });
  const subtype_trees = FAMILIES.map((family_key) => ({
    family_key,
    ...writeRecord(
      root,
      `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/profiles/${family_key}.subtype-tree.json`,
      'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1',
      'subtype_tree_id',
      { family_key, state: 'TREE_OUTPUT_COMPLETE' },
    ),
  }));
  const view_policy = writeRecord(
    root,
    'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/policies/view-policy.json',
    'STAGE_2Y_M7_V2_VIEW_POLICY/V1',
    'view_policy_id',
    { state: 'APPROVED' },
  );
  const authorityBytes = fs.readFileSync(path.join(root, AUTHORITY_PATH));
  const authority = JSON.parse(authorityBytes);
  const authorityBinding = {
    path: AUTHORITY_PATH,
    schema_version: authority.schema_version,
    authority_id: authority.authority_id,
    authority_digest: authority.authority_digest,
    byte_length: authorityBytes.length,
    sha256: sha256Hex(authorityBytes),
  };
  const work2Manifest = JSON.parse(fs.readFileSync(path.join(root, WORK2_MANIFEST_PATH), 'utf8'));
  const work3Manifest = writeDigestRecord(
    root,
    WORK3_MANIFEST_PATH,
    'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V1',
    'execution_manifest_digest',
    'execution_manifest_id',
    {
      work: 'WORK3',
      state: 'PRE_WORK_BOOTSTRAP_ONLY',
      parent_authority_binding: authorityBinding,
      work_receipt_path: WORK3_RECEIPT_PATH,
      candidate_ordering_correction_authority_binding:
        clone(work2Manifest.candidate_ordering_correction_authority_binding),
      candidate_registration_binding: null,
      candidate_transition: null,
    },
  );
  writeRecord(
    root,
    WORK3_RECEIPT_PATH,
    'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V1',
    'work3_receipt_id',
    {
      state: 'PASS_WORK3_BUILD_ONLY_NULL_CANDIDATE',
      status: 'PASS',
      work: 'WORK3',
      execution_manifest_id: work3Manifest.execution_manifest_id,
      execution_manifest_digest: work3Manifest.execution_manifest_digest,
      candidate_ordering_correction_authority_binding:
        clone(work3Manifest.candidate_ordering_correction_authority_binding),
      candidate_registration_id: null,
      candidate_transition: null,
      counts: { fixture: 1 },
      effects: { files_written: 1 },
    },
  );
  const predecessor_receipts = [
    {
      work: 'WORK1',
      ...descriptorForRecord(root, WORK1_RECEIPT_PATH, 'work1_contract_receipt_id'),
    },
    {
      work: 'WORK2',
      ...descriptorForRecord(root, WORK2_RECEIPT_PATH, 'work2_receipt_id'),
    },
    {
      work: 'WORK3',
      ...descriptorForRecord(root, WORK3_RECEIPT_PATH, 'work3_receipt_id'),
    },
  ];
  const allowed_output_root = 'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/candidate-output';
  fs.mkdirSync(path.join(root, allowed_output_root), { recursive: true });

  return {
    root,
    specification: {
      code,
      semantic_inputs,
      subtype_trees,
      view_policy,
      predecessor_receipts,
      allowed_output_root,
    },
  };
}

function makeRichWork3Fixture(t, work2Template) {
  const fixture = makeBaseFixture(t, work2Template);
  const { root, specification } = fixture;
  const lawful = buildLawfulWork3FamilyPackageSetFixture({ useOnDiskFamilyPackages: false });
  for (const [repositoryPath, bytes] of lawful.filesByPath) {
    write(root, repositoryPath, bytes);
  }
  const structureRecord = restampRecord({
    ...clone(lawful.structureSetSource.record),
    members: lawful.structureSetSource.record.members.filter(
      (member) => member.kind === 'BEN_AUTHORED_INLINE_LIST_OVERLAY',
    ),
  }, 'structure_disposition_set_id');
  writeCanonicalRecord(root, lawful.structureSetSource.binding.path, structureRecord);
  const structureBinding = bindingForRecordPath(
    root,
    lawful.structureSetSource.binding.path,
    'structure_disposition_set_id',
  );
  for (const repositoryPath of [
    WORK2_RECEIPT_PATH,
    WORK2_AGREEMENT_SET_PATH,
    WORK2_CONTEXT_SET_PATH,
  ]) {
    copyRepositoryFile(root, repositoryPath);
  }

  const authority = lawful.authoritySource.record;
  const scope = authority.work3_scope_contract;
  const receiptContract = scope.rich_work3_receipt_contract;
  const nativeContract = receiptContract.candidate_native_set_evidence_contract;
  const setBindings = [];
  for (const setContract of authority.agreement_index_set_authority.sets) {
    for (const member of setContract.members) {
      const binding = member.path
        ? member
        : member.context_compilation_binding ?? member.agreement_analysis_binding;
      if (!fs.existsSync(path.join(root, binding.path))) copyRepositoryFile(root, binding.path);
      assert.equal(fs.existsSync(path.join(root, binding.path)), true);
    }
    writeRecord(
      root,
      setContract.path,
      setContract.schema_version,
      setContract.record_id_field,
      { members: clone(setContract.members) },
    );
    setBindings.push(bindingForRecordPath(
      root,
      setContract.path,
      setContract.record_id_field,
    ));
  }
  const [indexBinding, contextBinding, analysisBinding] = setBindings;

  const fixtureContract = scope.work3_execution_fixture_contract;
  const runCounts = Array(fixtureContract.command_run_counts.length).fill(1);
  const work3ExecutionFixture = {
    schema_version: fixtureContract.schema_version,
    state: fixtureContract.state,
    case_ids: clone(fixtureContract.case_ids),
    combined_test_result: clone(fixtureContract.combined_test_result),
    command_run_counts: runCounts,
  };
  writeCanonicalRecord(root, fixtureContract.path, work3ExecutionFixture);

  const manifestContract = scope.work3_manifest_contract;
  const manifestUnsigned = {};
  for (const key of manifestContract.exact_keys) {
    if (key === 'execution_manifest_id' || key === 'execution_manifest_digest') continue;
    manifestUnsigned[key] = key === 'work3_entry_correction_authority_binding'
      ? clone(lawful.authoritySource.binding)
      : clone(manifestContract[key]);
  }
  const manifestDigest = sha256Hex(canonicalJson(manifestUnsigned));
  const manifestWithDigest = {
    ...manifestUnsigned,
    execution_manifest_digest: manifestDigest,
  };
  const richManifest = {
    ...manifestWithDigest,
    execution_manifest_id: contentId(manifestUnsigned.schema_version, manifestWithDigest),
  };
  writeCanonicalRecord(root, WORK3_MANIFEST_PATH, richManifest);

  for (const repositoryPath of receiptContract.artifact_bindings_contract.paths) {
    if (!fs.existsSync(path.join(root, repositoryPath))) copyRepositoryFile(root, repositoryPath);
    if (!fs.existsSync(path.join(root, repositoryPath))) {
      write(root, repositoryPath, Buffer.from(`fixture:${repositoryPath}\n`, 'utf8'));
    }
    assert.equal(fs.existsSync(path.join(root, repositoryPath)), true, repositoryPath);
  }
  const recordFieldsByPath = new Map();
  for (const category of receiptContract.artifact_bindings_contract.record_id_categories) {
    if (category.remaining_code_test_and_raw_fixture_paths !== undefined) continue;
    if (Array.isArray(category.schema_and_id_fields)) {
      for (const entry of category.schema_and_id_fields) {
        recordFieldsByPath.set(entry.path, entry);
      }
    } else {
      for (const repositoryPath of category.paths) {
        recordFieldsByPath.set(repositoryPath, {
          path: repositoryPath,
          schema_version: category.schema_version,
          record_id_field: category.record_id_field,
        });
      }
    }
  }
  const artifactBindings = receiptContract.artifact_bindings_contract.paths.map(
    (repositoryPath) => {
      const recordFields = recordFieldsByPath.get(repositoryPath);
      return recordFields
        ? bindingForRecordPath(root, repositoryPath, recordFields.record_id_field)
        : bindingForRawPath(root, repositoryPath);
    },
  );

  const ledgerContract = receiptContract.command_execution_ledger_contract;
  const commandLedger = ledgerContract.argv_order.map((argv, index) => ({
    argv: clone(argv),
    run_count: runCounts[index],
    state: ledgerContract.state_ranges.find(
      (range) => index >= range.indices[0] && index <= range.indices[1],
    ).state,
  }));
  const counts = Object.fromEntries(receiptContract.counts_contract.exact_keys.map((key) => [
    key,
    key === 'structure_disposition_member_count'
      ? structureRecord.members.length
      : receiptContract.counts_contract.exact_values[key],
  ]));
  const nativeEvidence = {
    work2_agreement_analysis_set_binding: clone(nativeContract.work2_bindings[0]),
    work2_context_compilation_set_binding: clone(nativeContract.work2_bindings[1]),
    work3_agreement_index_set_binding: indexBinding,
    work3_context_compilation_set_binding: contextBinding,
    work3_agreement_analysis_set_binding: analysisBinding,
    sealed_agreement_ids: clone(nativeContract.sealed_agreement_ids),
    additive_agreement_ids: clone(nativeContract.additive_agreement_ids),
    combined_agreement_ids: clone(nativeContract.combined_agreement_ids),
    extension_proof: nativeContract.extension_proof,
  };
  const receiptBody = {
    work: receiptContract.work,
    stage: receiptContract.stage,
    state: receiptContract.state,
    status: receiptContract.status,
    execution_manifest_id: richManifest.execution_manifest_id,
    execution_manifest_digest: richManifest.execution_manifest_digest,
    parent_authority_binding: clone(richManifest.parent_authority_binding),
    activation_receipt_binding: clone(richManifest.activation_receipt_binding),
    predecessor_receipt_binding: clone(richManifest.predecessor_receipt_binding),
    candidate_ordering_correction_authority_binding:
      clone(richManifest.candidate_ordering_correction_authority_binding),
    work3_entry_correction_authority_binding:
      clone(richManifest.work3_entry_correction_authority_binding),
    candidate_registration_id: receiptContract.candidate_registration_id,
    candidate_transition: receiptContract.candidate_transition,
    candidate_native_set_evidence: nativeEvidence,
    family_profile_evidence: {
      family_profile_package_bindings: lawful.familyPackageSources.map(
        (source) => clone(source.binding),
      ),
      approved_family_profile_set_binding: clone(lawful.profileSetSource.binding),
      family_keys: clone(receiptContract.family_profile_evidence_contract.family_keys),
    },
    structure_disposition_set_binding: clone(structureBinding),
    artifact_bindings: artifactBindings,
    artifact_set_digest: sha256Hex(canonicalJson(artifactBindings)),
    command_execution_ledger: commandLedger,
    combined_test_result: clone(fixtureContract.combined_test_result),
    repository_precondition: Object.fromEntries(
      receiptContract.repository_precondition_contract.exact_keys.map(
        (key) => [key, clone(receiptContract.repository_precondition_contract[key])],
      ),
    ),
    counts,
    checks: clone(receiptContract.checks_contract.exact_ordered_checks),
    effects: clone(receiptContract.effects_contract.exact_values),
    next_work: clone(receiptContract.next_work_contract.exact_values),
  };
  writeRecord(
    root,
    WORK3_RECEIPT_PATH,
    receiptContract.schema_version,
    'work3_receipt_id',
    receiptBody,
  );

  const semanticDescriptors = new Map(specification.semantic_inputs.map(
    (entry) => [entry.input_role, entry],
  ));
  const bindDescriptor = (inputRole, binding) => Object.assign(
    semanticDescriptors.get(inputRole),
    {
      path: binding.path,
      schema_version: binding.schema_version,
      record_id_field: binding.record_id_field,
    },
  );
  bindDescriptor('BASE_ANALYSIS_SET', analysisBinding);
  bindDescriptor('AGREEMENT_INDEX_SET', indexBinding);
  bindDescriptor('CONTEXT_COMPILATION_SET', contextBinding);
  bindDescriptor('APPROVED_FAMILY_PACKET_SET', lawful.familyPacketSource.binding);
  bindDescriptor('APPROVED_FAMILY_PROFILE_SET', lawful.profileSetSource.binding);
  bindDescriptor('APPROVED_STRUCTURE_DISPOSITION_SET', structureBinding);
  specification.subtype_trees = clone(lawful.profileSetSource.record.subtype_tree_bindings);
  specification.predecessor_receipts[2] = {
    work: 'WORK3',
    ...descriptorForRecord(root, WORK3_RECEIPT_PATH, 'work3_receipt_id'),
  };

  return {
    ...fixture,
    expectedSubtypeTreeBindings: clone(lawful.profileSetSource.record.subtype_tree_bindings),
    artifactCategoryPaths: {
      governedRecord: analysisBinding.path,
      code: 'lib/canonical-v2/agreement-analysis-consolidation.js',
      rawFixture: fixtureContract.path,
      syntheticAgreementIndex: receiptContract.structure_disposition_set_binding_contract
        .synthetic_agreement_index_binding.path,
    },
    nativeSetPaths: {
      AGREEMENT_INDEX_SET: indexBinding.path,
      CONTEXT_COMPILATION_SET: contextBinding.path,
      BASE_ANALYSIS_SET: analysisBinding.path,
    },
    structurePath: lawful.structureSetSource.binding.path,
  };
}

function makeFixture(t, work2Template) {
  return makeRichWork3Fixture(t, work2Template);
}

test('M7 V2 candidate registration is immutable, content-addressed and independently verified', async (t) => {
  const builder = await import('../scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs');
  const verifier = await import('../scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs');
  const finaliser = await import('../scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs');
  const work2Template = prepareWork2Template(t, finaliser);

  // The builder now has a second deep seam, `registerInterimCandidate`: the
  // replacement authority's interim registration policy mints one registration
  // before every evidence run, and that command derives its own specification
  // from the registration it supersedes rather than taking one from a caller.
  // It is still one seam per mechanism; nothing below it is exported.
  await t.test('the two modules expose their deep public seams and nothing else', () => {
    assert.deepEqual(Object.keys(builder), ['registerCandidate', 'registerInterimCandidate']);
    assert.deepEqual(Object.keys(verifier), ['verifyRegisteredCandidate']);
    assert.equal(typeof builder.registerCandidate, 'function');
    assert.equal(typeof builder.registerInterimCandidate, 'function');
    assert.equal(typeof verifier.verifyRegisteredCandidate, 'function');

    const verifierSource = fs.readFileSync(path.join(
      ROOT,
      'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
    ), 'utf8');
    const specifiers = [
      ...verifierSource.matchAll(/^import[\s\S]*?from ['"]([^'"]+)['"];$/gm),
    ].map((match) => match[1]);
    assert.ok(!specifiers.some((value) => /register-candidate|agreement-analysis-consolidation|agreement-projection/.test(value)));
    assert.equal(specifiers.filter(
      (value) => value === '../lib/canonical-v2/m7-v2-contract.js',
    ).length, 1);
    assert.ok(!/\beval\s*\(|new\s+Function\s*\(|import\s*\(\s*[^'"\s]/.test(verifierSource));
  });

  await t.test(CANDIDATE_CONTINUITY_CASE.case_id, () => {
    assert.equal(CANDIDATE_CONTINUITY_CASE.public_seam, 'verifyRegisteredCandidate');
    assert.equal(CANDIDATE_CONTINUITY_CASE.expected_result, 'PASS');
    assert.deepEqual(CANDIDATE_CONTINUITY_CASE.requirements, [
      'SIX_INPUT_BINDINGS_RECOMPUTED',
      'EXACT_25_SUBTYPE_TREES',
      'VIEW_POLICY_BOUND',
      'PREDECESSOR_RECEIPTS_PASS',
      'CANDIDATE_ID_CONTINUITY',
    ]);
    const fixture = makeFixture(t, work2Template);
    // The bound family profile set here carries a real profile count that is
    // neither the historical Work3 V2 literal (1382) nor its 24-package
    // count — proof that registration derives every count from the bytes it
    // binds rather than pinning a fixture-derived total.
    const profileSetDescriptor = fixture.specification.semantic_inputs.find(
      (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
    );
    const boundProfileSet = JSON.parse(
      fs.readFileSync(path.join(fixture.root, profileSetDescriptor.path), 'utf8'),
    );
    assert.ok(boundProfileSet.profiles.length > 0);
    assert.notEqual(boundProfileSet.profiles.length, 1382);
    assert.notEqual(boundProfileSet.family_profile_package_bindings.length, 24);

    const preview = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: false,
    });
    const repeated = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: false,
    });
    assert.deepEqual(repeated, preview);
    assert.equal(preview.registration.schema_version, SCHEMA);
    assert.equal(preview.registration.lifecycle_state, 'CANDIDATE_PENDING_REVIEW');
    assert.equal(preview.registration.semantic_input_bindings.length, 6);
    assert.equal(preview.registration.subtype_tree_bindings.length, 25);
    assert.deepEqual(
      preview.registration.semantic_input_bindings.map((entry) => entry.input_role),
      SEMANTIC_ROLES.map(([inputRole]) => inputRole),
    );
    assert.deepEqual(
      preview.registration.subtype_tree_bindings.map((entry) => entry.family_key),
      FAMILIES,
    );
    assert.equal(preview.registration.view_policy_binding.path,
      fixture.specification.view_policy.path);
    assert.equal(preview.registration.view_policy_binding.schema_version,
      fixture.specification.view_policy.schema_version);
    assert.deepEqual(
      preview.registration.predecessor_receipt_bindings.map((entry) => entry.work),
      ['WORK1', 'WORK2', 'WORK3'],
    );
    assert.equal(preview.registration.counts.semantic_input_count, 6);
    assert.equal(preview.registration.counts.subtype_tree_count, 25);
    assert.equal(
      preview.registration.candidate_registration_id,
      contentId(SCHEMA, Object.fromEntries(Object.entries(preview.registration)
        .filter(([key]) => key !== 'candidate_registration_id'))),
    );
    assert.equal(
      preview.registration_path,
      `${REGISTRATION_ROOT}/${preview.registration.candidate_registration_id}.json`,
    );
    assert.equal(preview.bytes.toString('utf8'), `${canonicalJson(preview.registration)}\n`);

    const written = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    });
    assert.deepEqual(written.registration, preview.registration);
    assert.equal(written.effects.files_written, 1);
    assert.deepEqual(
      fs.readFileSync(path.join(fixture.root, written.registration_path)),
      preview.bytes,
    );
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    }), 'REGISTRATION_ALREADY_EXISTS');

    const result = verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: written.registration_path,
    });
    assert.equal(result.schema_version, VERIFICATION_SCHEMA);
    assert.equal(result.state, 'PASS_CANDIDATE_REGISTRATION');
    assert.equal(result.candidate_registration_id, preview.registration.candidate_registration_id);
    assert.equal(result.registration_binding.path, preview.registration_path);
    assert.equal(result.registration_binding.sha256, sha256Hex(preview.bytes));
    assert.equal(result.registration_binding.git_blob_oid, gitBlobOid(preview.bytes));
    assert.equal(result.counts.semantic_input_count, 6);
    assert.equal(result.counts.subtype_tree_count, 25);
    assert.equal(result.counts.predecessor_receipt_count, 3);
    assert.deepEqual(result.effects, {
      files_written: 0,
      model_calls: 0,
      network_reads: 0,
      network_writes: 0,
      database_writes: 0,
      product_writes: 0,
      m0_m4_mutations: 0,
      m8_actions: 0,
    });
    assert.equal(
      result.verification_id,
      contentId(VERIFICATION_SCHEMA, Object.fromEntries(Object.entries(result)
        .filter(([key]) => key !== 'verification_id'))),
    );
  });

  await t.test('the builder accepts paths, not self-attested bytes or hashes', () => {
    const fixture = makeFixture(t, work2Template);
    const changed = clone(fixture.specification);
    changed.code.compiler = {
      path: fixture.specification.code.compiler,
      sha256: '0'.repeat(64),
    };
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: changed,
      write: false,
    }), 'INVALID_SPECIFICATION');
  });

  await t.test('runner, test and predecessor membership comes from the closed programme contract', () => {
    const fixture = makeFixture(t, work2Template);
    for (const field of ['runners', 'tests']) {
      const changed = clone(fixture.specification);
      changed.code[field].pop();
      assertCode(() => builder.registerCandidate({
        repoRoot: fixture.root,
        specification: changed,
        write: false,
      }), 'INVALID_SPECIFICATION');
    }
    const changed = clone(fixture.specification);
    changed.predecessor_receipts.splice(1, 1);
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: changed,
      write: false,
    }), 'INVALID_SPECIFICATION');

    const reordered = clone(fixture.specification);
    [reordered.predecessor_receipts[1], reordered.predecessor_receipts[2]] =
      [reordered.predecessor_receipts[2], reordered.predecessor_receipts[1]];
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: reordered,
      write: false,
    }), 'INVALID_SPECIFICATION');

    const obsoleteWork2Schema = clone(fixture.specification);
    obsoleteWork2Schema.predecessor_receipts[1].schema_version =
      'STAGE_2Y_M7_V2_REPAIR_WORK2_RECEIPT/V1';
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: obsoleteWork2Schema,
      write: false,
    }), 'INVALID_SPECIFICATION');

    const extra = clone(fixture.specification);
    extra.predecessor_receipts.push(clone(extra.predecessor_receipts[2]));
    extra.predecessor_receipts[3].work = 'WORK4';
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: extra,
      write: false,
    }), 'INVALID_SPECIFICATION');
  });

  await t.test('a candidate binding a test roster larger than the required baseline registers and verifies', () => {
    const fixture = makeFixture(t, work2Template);
    const extraTestPath = 'tests/stage-2y-structure-m7-v2-repair-extra-roster-check.test.js';
    write(fixture.root, extraTestPath, Buffer.from('fixture: extra roster test\n', 'utf8'));
    const changed = clone(fixture.specification);
    changed.code = { ...changed.code, tests: [...changed.code.tests, extraTestPath].sort() };
    assert.equal(changed.code.tests.length, 9);

    const preview = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: changed,
      write: true,
    });
    assert.equal(preview.registration.code_bindings.tests.length, 9);
    assert.equal(preview.registration.counts.test_count, 9);
    assert.ok(preview.registration.code_bindings.tests.some(
      (binding) => binding.path === extraTestPath,
    ));

    const result = verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: preview.registration_path,
    });
    assert.equal(result.state, 'PASS_CANDIDATE_REGISTRATION');
    assert.equal(result.counts.test_count, 9);
  });

  await t.test('a registration whose declared count differs from its bound bytes fails verify with COUNT_RECOUNT', () => {
    const fixture = makeFixture(t, work2Template);
    const written = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    });
    const tampered = restampRegistration({
      ...written.registration,
      counts: {
        ...written.registration.counts,
        test_count: written.registration.counts.test_count + 1,
      },
    });
    const tamperedPath = `${REGISTRATION_ROOT}/${tampered.candidate_registration_id}.json`;
    writeCanonicalRecord(fixture.root, tamperedPath, tampered);
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: tamperedPath,
    }), 'COUNT_RECOUNT');
  });

  await t.test('the builder closes each predecessor receipt contract before registration', () => {
    for (const scenario of predecessorSemanticMutationCases()) {
      const fixture = makeFixture(t, work2Template);
      const receipt = JSON.parse(fs.readFileSync(path.join(fixture.root, scenario.path), 'utf8'));
      scenario.mutate(receipt);
      writeCanonicalRecord(fixture.root, scenario.path, scenario.restamp(receipt));
      assertCode(() => builder.registerCandidate({
        repoRoot: fixture.root,
        specification: fixture.specification,
        write: false,
      }), 'BINDING_DRIFT', scenario.label);
    }
  });

  await t.test('the verifier independently closes each predecessor receipt contract', () => {
    for (const scenario of predecessorSemanticMutationCases()) {
      const fixture = makeFixture(t, work2Template);
      const written = builder.registerCandidate({
        repoRoot: fixture.root,
        specification: fixture.specification,
        write: true,
      });
      const receipt = JSON.parse(fs.readFileSync(path.join(fixture.root, scenario.path), 'utf8'));
      scenario.mutate(receipt);
      writeCanonicalRecord(fixture.root, scenario.path, scenario.restamp(receipt));

      const registration = clone(written.registration);
      registration.predecessor_receipt_bindings[scenario.index].binding = bindingForRecordPath(
        fixture.root,
        scenario.path,
        scenario.idField,
      );
      const restamped = restampRegistration(registration);
      const registrationPath = `${REGISTRATION_ROOT}/${restamped.candidate_registration_id}.json`;
      writeCanonicalRecord(fixture.root, registrationPath, restamped);
      assertCode(() => verifier.verifyRegisteredCandidate({
        repoRoot: fixture.root,
        registrationPath,
      }), 'BINDING_DRIFT', scenario.label);
    }
  });

  await t.test('record bindings require their one canonical byte representation', () => {
    const fixture = makeFixture(t, work2Template);
    const descriptor = fixture.specification.semantic_inputs[0];
    const absolute = path.join(fixture.root, descriptor.path);
    const value = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: false,
    }), 'BINDING_DRIFT');
  });

  await t.test('changed, missing or redirected candidate bytes fail independent recomputation', () => {
    const fixture = makeFixture(t, work2Template);
    const written = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    });
    fs.appendFileSync(path.join(fixture.root, fixture.specification.code.compiler), 'changed\n');
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: written.registration_path,
    }), 'BINDING_DRIFT');
    fs.rmSync(path.join(fixture.root, fixture.specification.code.compiler));
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: written.registration_path,
    }), 'BINDING_DRIFT');
  });

  await t.test('the registration ID, filename, six-input set and all-25 tree set are closed', () => {
    const fixture = makeFixture(t, work2Template);
    const written = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    });
    const originalPath = path.join(fixture.root, written.registration_path);
    const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));

    const wrongName = `${REGISTRATION_ROOT}/${'f'.repeat(64)}.json`;
    write(fixture.root, wrongName, fs.readFileSync(originalPath));
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: wrongName,
    }), 'REGISTRATION_PATH_DRIFT');

    const missingRole = clone(original);
    missingRole.semantic_input_bindings.pop();
    missingRole.counts.semantic_input_count = 5;
    const restampedRole = restampRegistration(missingRole);
    const missingRolePath = `${REGISTRATION_ROOT}/${restampedRole.candidate_registration_id}.json`;
    write(fixture.root, missingRolePath, `${canonicalJson(restampedRole)}\n`);
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: missingRolePath,
    }), 'REGISTRATION_CONTRACT_DRIFT');

    const duplicateTree = clone(original);
    duplicateTree.subtype_tree_bindings[24].family_key = duplicateTree.subtype_tree_bindings[23].family_key;
    const restampedTree = restampRegistration(duplicateTree);
    const duplicateTreePath = `${REGISTRATION_ROOT}/${restampedTree.candidate_registration_id}.json`;
    write(fixture.root, duplicateTreePath, `${canonicalJson(restampedTree)}\n`);
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: duplicateTreePath,
    }), 'REGISTRATION_CONTRACT_DRIFT');
  });

  await t.test('a direct V1 analysis cannot masquerade as the V2 base-analysis set', () => {
    const fixture = makeFixture(t, work2Template);
    const v1 = writeRecord(
      fixture.root,
      'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/inputs/v1-analysis.json',
      'AGREEMENT_ANALYSIS/V1',
      'agreement_analysis_id',
      { agreement_id: 'a'.repeat(64) },
    );
    const changed = clone(fixture.specification);
    changed.semantic_inputs[0] = { input_role: 'BASE_ANALYSIS_SET', ...v1 };
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: changed,
      write: false,
    }), 'V1_SEMANTIC_FALLBACK');
  });

  await t.test('path escape and symlink routes fail closed', () => {
    const fixture = makeFixture(t, work2Template);
    const written = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    });
    const linkedRoot = `${fixture.root}-link`;
    fs.symlinkSync(fixture.root, linkedRoot);
    t.after(() => fs.rmSync(linkedRoot, { force: true }));
    assertCode(() => builder.registerCandidate({
      repoRoot: linkedRoot,
      specification: fixture.specification,
      write: false,
    }), 'PATH_SAFETY');
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: linkedRoot,
      registrationPath: written.registration_path,
    }), 'PATH_SAFETY');

    const escaped = clone(fixture.specification);
    escaped.code.compiler = '../outside.js';
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: escaped,
      write: false,
    }), 'PATH_SAFETY');

    const target = path.join(fixture.root, fixture.specification.code.projector);
    const real = `${target}.real`;
    fs.renameSync(target, real);
    fs.symlinkSync(real, target);
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: false,
    }), 'PATH_SAFETY');
  });

  // `registration_schema_extensions.import_closure_binding_required` on the
  // candidate replacement authority: a registration binds not only the code
  // roles it names but every repository module their static import graph can
  // reach, and the verifier recomputes that graph rather than trusting it.
  await t.test('the registration binds the static import closure of its bound code', () => {
    const fixture = makeFixture(t, work2Template);
    const written = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    });
    const code = written.registration.code_bindings;
    const codePaths = [
      code.compiler.path,
      code.deterministic_generator.path,
      code.contract_validator.path,
      code.projector.path,
      code.independent_verifier.path,
      ...code.runners.map((binding) => binding.path),
      ...code.tests.map((binding) => binding.path),
    ];
    const closure = written.registration.import_closure_bindings;
    const closurePaths = closure.map((binding) => binding.path);
    assert.ok(closure.length > 0);
    assert.deepEqual(closurePaths, [...closurePaths].sort());
    assert.equal(new Set(closurePaths).size, closurePaths.length);
    assert.equal(written.registration.counts.import_closure_count, closure.length);
    for (const repositoryPath of codePaths) {
      assert.ok(closurePaths.includes(repositoryPath), repositoryPath);
    }
    for (const binding of closure) {
      assert.deepEqual(Object.keys(binding).sort(), [
        'byte_length', 'git_blob_oid', 'path', 'sha256',
      ]);
      const bytes = fs.readFileSync(path.join(fixture.root, binding.path));
      assert.equal(binding.byte_length, bytes.length);
      assert.equal(binding.sha256, sha256Hex(bytes));
      assert.equal(binding.git_blob_oid, gitBlobOid(bytes));
    }
    assert.equal(
      verifier.verifyRegisteredCandidate({
        repoRoot: fixture.root,
        registrationPath: written.registration_path,
      }).state,
      'PASS_CANDIDATE_REGISTRATION',
    );

    // One member short of the closure the verifier recomputes, and the
    // difference is named by its path.
    const dropped = closurePaths.find(
      (repositoryPath) => !codePaths.includes(repositoryPath),
    ) ?? closurePaths[0];
    const tampered = restampRegistration({
      ...written.registration,
      import_closure_bindings: closure.filter((binding) => binding.path !== dropped),
      counts: {
        ...written.registration.counts,
        import_closure_count: closure.length - 1,
      },
    });
    const tamperedPath =
      `${REGISTRATION_ROOT}/${tampered.candidate_registration_id}.json`;
    writeCanonicalRecord(fixture.root, tamperedPath, tampered);
    assert.throws(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: tamperedPath,
    }), (error) => {
      assert.equal(error.code, 'BINDING_DRIFT');
      assert.ok(error.message.includes(dropped), error.message);
      return true;
    });
  });

  // A specifier assembled at runtime is not an edge this walk can follow, and
  // is not a refusal either: the bound Work 2 and Work 3 test roles use the
  // pattern themselves. What the closure must not do is claim the target.
  await t.test('a specifier assembled at runtime is not a closure member', () => {
    const fixture = makeFixture(t, work2Template);
    const computedPath =
      'tests/stage-2y-structure-m7-v2-repair-computed-specifier.test.js';
    const namedPath =
      'tests/stage-2y-structure-m7-v2-repair-computed-specifier-target.js';
    write(fixture.root, namedPath, Buffer.from('module.exports = { fixture: true };\n', 'utf8'));
    write(fixture.root, computedPath, Buffer.from(
      "const suffix = '-target';\n"
      + "const loaded = require(`./stage-2y-structure-m7-v2-repair-computed-specifier${suffix}.js`);\n"
      + 'module.exports = loaded;\n',
      'utf8',
    ));
    const changed = clone(fixture.specification);
    changed.code = {
      ...changed.code,
      tests: [...changed.code.tests, computedPath].sort(),
    };
    const written = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: changed,
      write: true,
    });
    const closurePaths = written.registration.import_closure_bindings.map(
      (binding) => binding.path,
    );
    assert.ok(closurePaths.includes(computedPath));
    assert.ok(!closurePaths.includes(namedPath));
    assert.equal(
      verifier.verifyRegisteredCandidate({
        repoRoot: fixture.root,
        registrationPath: written.registration_path,
      }).state,
      'PASS_CANDIDATE_REGISTRATION',
    );
  });

  // Ben, 2026-09-04: unlike a test role, one of the five single-file compiler
  // roles is refused if a specifier assembled at runtime appears in ITS OWN
  // entry text — naming the file and the line the pattern was found on.
  await t.test(
    'a specifier assembled at runtime in a compiler role is refused, naming file and line',
    () => {
      const fixture = makeFixture(t, work2Template);
      const compilerPath = fixture.specification.code.compiler;
      const originalText = fs.readFileSync(path.join(fixture.root, compilerPath), 'utf8');
      const injectedLine = originalText.endsWith('\n')
        ? originalText.split('\n').length
        : originalText.split('\n').length + 1;
      const injectedText = `${originalText}${originalText.endsWith('\n') ? '' : '\n'}`
        + 'const computedSpecifierProbe = require(process.env.M7_V2_TEST_PROBE_PATH);\n';
      write(fixture.root, compilerPath, Buffer.from(injectedText, 'utf8'));
      assert.throws(() => builder.registerCandidate({
        repoRoot: fixture.root,
        specification: fixture.specification,
        write: false,
      }), (error) => {
        assert.equal(error.code, 'IMPORT_CLOSURE_COMPUTED_SPECIFIER');
        assert.ok(error.message.includes(`${compilerPath}:${injectedLine}`), error.message);
        return true;
      });
      write(fixture.root, compilerPath, Buffer.from(originalText, 'utf8'));

      // The same pattern, in the same fixture with the compiler role
      // restored, in a bound TEST role rather than a compiler role, still
      // registers — the refusal is scoped to exactly the five singleton
      // roles, not the whole closure.
      const testProbePath =
        'tests/stage-2y-structure-m7-v2-repair-computed-specifier-role-probe.test.js';
      write(fixture.root, testProbePath, Buffer.from(
        'require(process.env.M7_V2_TEST_PROBE_PATH);\n',
        'utf8',
      ));
      const withTestProbe = clone(fixture.specification);
      withTestProbe.code = {
        ...withTestProbe.code,
        tests: [...withTestProbe.code.tests, testProbePath].sort(),
      };
      assert.equal(
        builder.registerCandidate({
          repoRoot: fixture.root,
          specification: withTestProbe,
          write: false,
        }).registration.lifecycle_state,
        'CANDIDATE_PENDING_REVIEW',
      );
    },
  );

  // The two registrations the replacement authority supersedes predate both
  // the import closure and the authority's permission to edit the files they
  // bind. They still verify, from the Git objects they named, and they say so.
  await t.test('a superseded registration verifies historically and says so', () => {
    const authority = JSON.parse(fs.readFileSync(
      path.join(ROOT, CANDIDATE_REPLACEMENT_AUTHORITY_PATH), 'utf8',
    ));
    const superseded = authority.superseded_candidate_registration_ids;
    assert.ok(superseded.length > 0);
    for (const candidateRegistrationId of superseded) {
      const registrationPath = `${REGISTRATION_ROOT}/${candidateRegistrationId}.json`;
      const written = [];
      const realWrite = process.stderr.write.bind(process.stderr);
      process.stderr.write = (chunk, ...rest) => {
        written.push(String(chunk));
        return realWrite(chunk, ...rest);
      };
      let result;
      try {
        result = verifier.verifyRegisteredCandidate({
          repoRoot: ROOT,
          registrationPath,
        });
      } finally {
        process.stderr.write = realWrite;
      }
      assert.equal(result.state, 'PASS_CANDIDATE_REGISTRATION');
      assert.equal(result.candidate_registration_id, candidateRegistrationId);
      const lines = written.join('');
      assert.ok(
        lines.includes(`HISTORICAL_SUPERSEDED_REGISTRATION ${candidateRegistrationId}`),
        lines,
      );
      assert.ok(
        lines.includes(`IMPORT_CLOSURE_ABSENT_HISTORICAL ${candidateRegistrationId}`),
        lines,
      );
    }
  });

  // The historical rule keys on the authority's own list, so a registration
  // that is not on it stays bound to the working tree even with the authority
  // present: an edited bound file is still drift.
  await t.test('a registration the authority does not supersede still fails on an edited bound file', () => {
    const fixture = makeFixture(t, work2Template);
    copyRepositoryFile(fixture.root, CANDIDATE_REPLACEMENT_AUTHORITY_PATH);
    const written = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    });
    const authority = JSON.parse(fs.readFileSync(
      path.join(fixture.root, CANDIDATE_REPLACEMENT_AUTHORITY_PATH), 'utf8',
    ));
    assert.ok(!authority.superseded_candidate_registration_ids.includes(
      written.registration.candidate_registration_id,
    ));
    const edited = written.registration.code_bindings.compiler.path;
    const bytes = fs.readFileSync(path.join(fixture.root, edited));
    write(fixture.root, edited, Buffer.concat([bytes, Buffer.from('\n// edited\n', 'utf8')]));
    assert.throws(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: written.registration_path,
    }), (error) => {
      assert.equal(error.code, 'BINDING_DRIFT');
      assert.ok(error.message.includes(edited), error.message);
      return true;
    });
  });

  // A superseded registration is verified against the Git objects it named, so
  // a tree that has the evidence but not the objects cannot prove it.
  await t.test('a superseded registration whose bound blobs are absent fails BINDING_BYTE_MISMATCH', () => {
    const root = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-historical-no-objects-')),
    );
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const migration = 'evidence/canonical-v2/stage-2y-structure-migration';
    for (const directory of ['control', 'receipts']) {
      fs.cpSync(
        path.join(ROOT, migration, directory),
        path.join(root, migration, directory),
        { recursive: true },
      );
    }
    const authority = JSON.parse(fs.readFileSync(
      path.join(root, CANDIDATE_REPLACEMENT_AUTHORITY_PATH), 'utf8',
    ));
    for (const candidateRegistrationId of authority.superseded_candidate_registration_ids) {
      assert.throws(() => verifier.verifyRegisteredCandidate({
        repoRoot: root,
        registrationPath: `${REGISTRATION_ROOT}/${candidateRegistrationId}.json`,
      }), (error) => {
        assert.equal(error.code, 'BINDING_BYTE_MISMATCH');
        return true;
      });
    }
  });
});

test('Work4 candidate consumes the rich Work3 receipt and package-member bindings', async (t) => {
  const builder = await import('../scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs');
  const verifier = await import('../scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs');
  const finaliser = await import('../scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs');
  const work2Template = prepareWork2Template(t, finaliser);
  const fixture = makeRichWork3Fixture(t, work2Template);
  const preview = builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  });
  assert.deepEqual(
    preview.registration.subtype_tree_bindings,
    fixture.expectedSubtypeTreeBindings,
  );
  assert.deepEqual(
    preview.registration.code_bindings.tests.map((binding) => binding.path),
    [
      'tests/stage-2y-structure-m7-v2-repair-contract.test.js',
      'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js',
      'tests/stage-2y-structure-m7-v2-repair-projection-dispatch.test.js',
      'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work2.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work3-mae.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work3.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work4.test.js',
    ],
  );
  assert.equal(
    Object.keys(JSON.parse(fs.readFileSync(path.join(fixture.root, WORK3_RECEIPT_PATH), 'utf8'))).length,
    27,
  );
  const written = builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: true,
  });
  const verified = verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: written.registration_path,
  });
  assert.equal(verified.state, 'PASS_CANDIDATE_REGISTRATION');

  const originalStructureSet = JSON.parse(
    fs.readFileSync(path.join(fixture.root, fixture.structurePath), 'utf8'),
  );
  const originalRichReceipt = JSON.parse(
    fs.readFileSync(path.join(fixture.root, WORK3_RECEIPT_PATH), 'utf8'),
  );
  const orderedOriginalWork3Manifest = JSON.parse(
    fs.readFileSync(path.join(fixture.root, WORK3_MANIFEST_PATH), 'utf8'),
  );
  const assertEarliestReceiptGateThroughBothConsumers = (
    receipt,
    detail,
    updateRegistration = () => {},
  ) => {
    writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, receipt);
    let registrationError;
    try {
      builder.registerCandidate({
        repoRoot: fixture.root,
        specification: fixture.specification,
        write: false,
      });
    } catch (error) {
      registrationError = error;
    }

    const registration = clone(written.registration);
    updateRegistration(registration);
    registration.predecessor_receipt_bindings[2].binding = bindingForRecordPath(
      fixture.root,
      WORK3_RECEIPT_PATH,
      'work3_receipt_id',
    );
    const restamped = restampRegistration(registration);
    const registrationPath = `${REGISTRATION_ROOT}/${restamped.candidate_registration_id}.json`;
    writeCanonicalRecord(fixture.root, registrationPath, restamped);
    let verificationError;
    try {
      verifier.verifyRegisteredCandidate({
        repoRoot: fixture.root,
        registrationPath,
      });
    } catch (error) {
      verificationError = error;
    }
    for (const error of [registrationError, verificationError]) {
      assert.equal(error?.code, 'BINDING_DRIFT');
      assert.equal(error?.message, `BINDING_DRIFT: ${detail}`);
    }
  };
  const invalidOrderedWork3Manifest = clone(orderedOriginalWork3Manifest);
  invalidOrderedWork3Manifest.state = 'DRIFTED_MANIFEST_STATE';
  writeCanonicalRecord(
    fixture.root,
    WORK3_MANIFEST_PATH,
    invalidOrderedWork3Manifest,
  );
  assertEarliestReceiptGateThroughBothConsumers(
    restampRecord({
      ...clone(originalRichReceipt),
      unapproved_field: true,
    }, 'work3_receipt_id'),
    'WORK3:rich receipt envelope',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_MANIFEST_PATH,
    orderedOriginalWork3Manifest,
  );
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const overlayMemberIndex = originalStructureSet.members.findIndex(
    (member) => member.kind === 'BEN_AUTHORED_INLINE_LIST_OVERLAY',
  );
  assert.notEqual(overlayMemberIndex, -1);
  const invalidOrderedStructureSet = restampRecord({
    ...clone(originalStructureSet),
    unapproved_field: true,
  }, 'structure_disposition_set_id');
  writeCanonicalRecord(fixture.root, fixture.structurePath, invalidOrderedStructureSet);
  const invalidOrderedStructureBinding = bindingForRecordPath(
    fixture.root,
    fixture.structurePath,
    'structure_disposition_set_id',
  );
  const structureAndArtifactDrift = clone(originalRichReceipt);
  structureAndArtifactDrift.structure_disposition_set_binding = invalidOrderedStructureBinding;
  structureAndArtifactDrift.artifact_set_digest = '0'.repeat(64);
  assertEarliestReceiptGateThroughBothConsumers(
    restampRecord(structureAndArtifactDrift, 'work3_receipt_id'),
    'WORK3:structure disposition set',
    (registration) => {
      registration.structure_disposition_set_binding = invalidOrderedStructureBinding;
      registration.semantic_input_bindings.find(
        (entry) => entry.input_role === 'APPROVED_STRUCTURE_DISPOSITION_SET',
      ).binding = invalidOrderedStructureBinding;
    },
  );
  writeCanonicalRecord(fixture.root, fixture.structurePath, originalStructureSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const structureClosureDrift = clone(originalStructureSet);
  structureClosureDrift.members[overlayMemberIndex].inline_list_overlay
    .ambiguous_repeat_fixture_bindings[0].member_sha256 = '0'.repeat(64);
  structureClosureDrift.members[overlayMemberIndex] = restampStructureDispositionMember(
    structureClosureDrift.members[overlayMemberIndex],
  );
  const restampedStructureClosureDrift = restampRecord(
    structureClosureDrift,
    'structure_disposition_set_id',
  );
  writeCanonicalRecord(
    fixture.root,
    fixture.structurePath,
    restampedStructureClosureDrift,
  );
  const changedStructureBinding = bindingForRecordPath(
    fixture.root,
    fixture.structurePath,
    'structure_disposition_set_id',
  );
  const changedRichReceipt = clone(originalRichReceipt);
  changedRichReceipt.structure_disposition_set_binding = changedStructureBinding;
  changedRichReceipt.artifact_bindings = changedRichReceipt.artifact_bindings.map(
    (binding) => binding.path === fixture.structurePath ? changedStructureBinding : binding,
  );
  changedRichReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    changedRichReceipt.artifact_bindings,
  ));
  const restampedChangedRichReceipt = restampRecord(
    changedRichReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedChangedRichReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, fixture.structurePath, originalStructureSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const nativeIndexSetPath = fixture.nativeSetPaths.AGREEMENT_INDEX_SET;
  const originalNativeIndexSet = JSON.parse(
    fs.readFileSync(path.join(fixture.root, nativeIndexSetPath), 'utf8'),
  );
  const overlayBindingSwapStructureSet = clone(originalStructureSet);
  overlayBindingSwapStructureSet.members[overlayMemberIndex]
    .inline_list_overlay.agreement_index_binding =
    clone(originalNativeIndexSet.members[1]);
  overlayBindingSwapStructureSet.members[overlayMemberIndex] = restampStructureDispositionMember(
    overlayBindingSwapStructureSet.members[overlayMemberIndex],
  );
  const restampedOverlayBindingSwapStructureSet = restampRecord(
    overlayBindingSwapStructureSet,
    'structure_disposition_set_id',
  );
  writeCanonicalRecord(
    fixture.root,
    fixture.structurePath,
    restampedOverlayBindingSwapStructureSet,
  );
  const overlayBindingSwapStructureBinding = bindingForRecordPath(
    fixture.root,
    fixture.structurePath,
    'structure_disposition_set_id',
  );
  const overlayBindingSwapReceipt = clone(originalRichReceipt);
  overlayBindingSwapReceipt.structure_disposition_set_binding =
    overlayBindingSwapStructureBinding;
  overlayBindingSwapReceipt.artifact_bindings = overlayBindingSwapReceipt.artifact_bindings.map(
    (binding) => binding.path === fixture.structurePath
      ? overlayBindingSwapStructureBinding
      : binding,
  );
  overlayBindingSwapReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    overlayBindingSwapReceipt.artifact_bindings,
  ));
  const restampedOverlayBindingSwapReceipt = restampRecord(
    overlayBindingSwapReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedOverlayBindingSwapReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, fixture.structurePath, originalStructureSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const syntheticAgreementIndexPath = fixture.artifactCategoryPaths.syntheticAgreementIndex;
  const originalSyntheticAgreementIndex = JSON.parse(
    fs.readFileSync(path.join(fixture.root, syntheticAgreementIndexPath), 'utf8'),
  );
  const swappedSyntheticAgreementIndex = nativeAgreementIndexRecord(
    sha256Hex('swapped-synthetic-ambiguous-repeat-agreement'),
  );
  writeCanonicalRecord(
    fixture.root,
    syntheticAgreementIndexPath,
    swappedSyntheticAgreementIndex,
  );
  const swappedSyntheticAgreementIndexBinding = bindingForRecordPath(
    fixture.root,
    syntheticAgreementIndexPath,
    'agreement_index_id',
  );
  const swappedSyntheticAgreementIndexReceipt = clone(originalRichReceipt);
  swappedSyntheticAgreementIndexReceipt.artifact_bindings =
    swappedSyntheticAgreementIndexReceipt.artifact_bindings.map(
      (binding) => binding.path === syntheticAgreementIndexPath
        ? swappedSyntheticAgreementIndexBinding
        : binding,
    );
  swappedSyntheticAgreementIndexReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    swappedSyntheticAgreementIndexReceipt.artifact_bindings,
  ));
  const restampedSwappedSyntheticAgreementIndexReceipt = restampRecord(
    swappedSyntheticAgreementIndexReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedSwappedSyntheticAgreementIndexReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(
    fixture.root,
    syntheticAgreementIndexPath,
    originalSyntheticAgreementIndex,
  );
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const wrongMemberNativeIndexSet = clone(originalNativeIndexSet);
  [wrongMemberNativeIndexSet.members[0], wrongMemberNativeIndexSet.members[1]] = [
    wrongMemberNativeIndexSet.members[1],
    wrongMemberNativeIndexSet.members[0],
  ];
  const restampedWrongMemberNativeIndexSet = restampRecord(
    wrongMemberNativeIndexSet,
    'agreement_index_set_id',
  );
  writeCanonicalRecord(
    fixture.root,
    nativeIndexSetPath,
    restampedWrongMemberNativeIndexSet,
  );
  const wrongMemberNativeIndexSetBinding = bindingForRecordPath(
    fixture.root,
    nativeIndexSetPath,
    'agreement_index_set_id',
  );
  const wrongMemberRichReceipt = clone(originalRichReceipt);
  wrongMemberRichReceipt.candidate_native_set_evidence
    .work3_agreement_index_set_binding = wrongMemberNativeIndexSetBinding;
  wrongMemberRichReceipt.artifact_bindings = wrongMemberRichReceipt.artifact_bindings.map(
    (binding) => binding.path === nativeIndexSetPath
      ? wrongMemberNativeIndexSetBinding
      : binding,
  );
  wrongMemberRichReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    wrongMemberRichReceipt.artifact_bindings,
  ));
  const restampedWrongMemberRichReceipt = restampRecord(
    wrongMemberRichReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedWrongMemberRichReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, nativeIndexSetPath, originalNativeIndexSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const profileSetPath = originalRichReceipt.family_profile_evidence
    .approved_family_profile_set_binding.path;
  const originalProfileSet = JSON.parse(
    fs.readFileSync(path.join(fixture.root, profileSetPath), 'utf8'),
  );
  const invalidOrderedProfileSet = restampRecord({
    ...clone(originalProfileSet),
    state: 'UNAPPROVED_PROFILE_SET',
  }, 'family_profile_set_id');
  writeCanonicalRecord(fixture.root, profileSetPath, invalidOrderedProfileSet);
  const invalidOrderedProfileBinding = bindingForRecordPath(
    fixture.root,
    profileSetPath,
    'family_profile_set_id',
  );
  const familyAndArtifactDrift = clone(originalRichReceipt);
  familyAndArtifactDrift.family_profile_evidence.approved_family_profile_set_binding =
    invalidOrderedProfileBinding;
  familyAndArtifactDrift.artifact_set_digest = '0'.repeat(64);
  assertEarliestReceiptGateThroughBothConsumers(
    restampRecord(familyAndArtifactDrift, 'work3_receipt_id'),
    'WORK3:approved family profile set state',
    (registration) => {
      registration.family_profile_set_binding = invalidOrderedProfileBinding;
      registration.semantic_input_bindings.find(
        (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
      ).binding = invalidOrderedProfileBinding;
    },
  );
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const antitrustPackagePath =
    originalRichReceipt.family_profile_evidence.family_profile_package_bindings[0].path;
  const originalAntitrustPackage = JSON.parse(
    fs.readFileSync(path.join(fixture.root, antitrustPackagePath), 'utf8'),
  );
  let orphanMatchFixtureSuffix = 0;
  let orphanMatchFixture;
  do {
    orphanMatchFixtureSuffix += 1;
    orphanMatchFixture = record(MATCH_FIXTURE_SCHEMA, 'match_fixture_id', {
      fixture_kind: 'WRONG_SUBTYPE',
      family_key: 'ANTITRUST_REGULATORY',
      input_occurrence_id: `synthetic-orphan-occurrence-${orphanMatchFixtureSuffix}`,
    });
  } while (orphanMatchFixture.match_fixture_id
    <= originalAntitrustPackage.match_fixtures.at(-1).match_fixture_id);
  const orphanMatchFixturePackage = clone(originalAntitrustPackage);
  orphanMatchFixturePackage.match_fixtures.push(orphanMatchFixture);
  const restampedOrphanMatchFixturePackage = restampRecord(
    orphanMatchFixturePackage,
    'family_profile_package_id',
  );
  writeCanonicalRecord(
    fixture.root,
    antitrustPackagePath,
    restampedOrphanMatchFixturePackage,
  );
  const orphanMatchFixturePackageBinding = bindingForRecordPath(
    fixture.root,
    antitrustPackagePath,
    'family_profile_package_id',
  );
  const orphanMatchFixtureProfileSet = clone(originalProfileSet);
  orphanMatchFixtureProfileSet.family_profile_package_bindings[0] =
    orphanMatchFixturePackageBinding;
  const restampedOrphanMatchFixtureProfileSet = restampRecord(
    orphanMatchFixtureProfileSet,
    'family_profile_set_id',
  );
  writeCanonicalRecord(
    fixture.root,
    profileSetPath,
    restampedOrphanMatchFixtureProfileSet,
  );
  const orphanMatchFixtureProfileSetBinding = bindingForRecordPath(
    fixture.root,
    profileSetPath,
    'family_profile_set_id',
  );
  const orphanMatchFixtureReceipt = clone(originalRichReceipt);
  orphanMatchFixtureReceipt.family_profile_evidence.family_profile_package_bindings[0] =
    orphanMatchFixturePackageBinding;
  orphanMatchFixtureReceipt.family_profile_evidence.approved_family_profile_set_binding =
    orphanMatchFixtureProfileSetBinding;
  orphanMatchFixtureReceipt.artifact_bindings = orphanMatchFixtureReceipt.artifact_bindings.map(
    (binding) => {
      if (binding.path === antitrustPackagePath) return orphanMatchFixturePackageBinding;
      if (binding.path === profileSetPath) return orphanMatchFixtureProfileSetBinding;
      return binding;
    },
  );
  orphanMatchFixtureReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    orphanMatchFixtureReceipt.artifact_bindings,
  ));
  const restampedOrphanMatchFixtureReceipt = restampRecord(
    orphanMatchFixtureReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedOrphanMatchFixtureReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, antitrustPackagePath, originalAntitrustPackage);
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const appraisalPackageBinding = originalRichReceipt.family_profile_evidence
    .family_profile_package_bindings[1];
  const rogueAppraisalPackagePath =
    'evidence/canonical-v2/stage-2y-structure-migration/control/work3-synthetic-appraisal-rogue-copy.json';
  write(
    fixture.root,
    rogueAppraisalPackagePath,
    fs.readFileSync(path.join(fixture.root, appraisalPackageBinding.path)),
  );
  const rogueAppraisalPackageBinding = bindingForRecordPath(
    fixture.root,
    rogueAppraisalPackagePath,
    'family_profile_package_id',
  );
  const roguePackageProfileSet = clone(originalProfileSet);
  roguePackageProfileSet.family_profile_package_bindings[1] = rogueAppraisalPackageBinding;
  roguePackageProfileSet.subtype_tree_bindings[1].binding.container_path =
    rogueAppraisalPackagePath;
  const restampedRoguePackageProfileSet = restampRecord(
    roguePackageProfileSet,
    'family_profile_set_id',
  );
  writeCanonicalRecord(
    fixture.root,
    profileSetPath,
    restampedRoguePackageProfileSet,
  );
  const roguePackageProfileSetBinding = bindingForRecordPath(
    fixture.root,
    profileSetPath,
    'family_profile_set_id',
  );
  const roguePackageRichReceipt = clone(originalRichReceipt);
  roguePackageRichReceipt.family_profile_evidence.family_profile_package_bindings[1] =
    rogueAppraisalPackageBinding;
  roguePackageRichReceipt.family_profile_evidence.approved_family_profile_set_binding =
    roguePackageProfileSetBinding;
  roguePackageRichReceipt.artifact_bindings = roguePackageRichReceipt.artifact_bindings.map(
    (binding) => binding.path === profileSetPath ? roguePackageProfileSetBinding : binding,
  );
  roguePackageRichReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    roguePackageRichReceipt.artifact_bindings,
  ));
  const restampedRoguePackageRichReceipt = restampRecord(
    roguePackageRichReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedRoguePackageRichReceipt,
  );
  const roguePackageSpecification = clone(fixture.specification);
  roguePackageSpecification.subtype_trees[1].binding.container_path =
    rogueAppraisalPackagePath;
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: roguePackageSpecification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const rogueProfileSetPath =
    'evidence/canonical-v2/stage-2y-structure-migration/control/work3-synthetic-approved-profile-set-rogue-copy.json';
  write(
    fixture.root,
    rogueProfileSetPath,
    fs.readFileSync(path.join(fixture.root, profileSetPath)),
  );
  const rogueProfileSetBinding = bindingForRecordPath(
    fixture.root,
    rogueProfileSetPath,
    'family_profile_set_id',
  );
  const rogueProfileSetRichReceipt = clone(originalRichReceipt);
  rogueProfileSetRichReceipt.family_profile_evidence.approved_family_profile_set_binding =
    rogueProfileSetBinding;
  const restampedRogueProfileSetRichReceipt = restampRecord(
    rogueProfileSetRichReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedRogueProfileSetRichReceipt,
  );
  const rogueProfileSetSpecification = clone(fixture.specification);
  const rogueProfileSetDescriptor = rogueProfileSetSpecification.semantic_inputs.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  );
  rogueProfileSetDescriptor.path = rogueProfileSetPath;
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: rogueProfileSetSpecification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const rogueApprovedProfile = record(
    'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE/V1',
    'profile_id',
    {
      family_key: 'APPRAISAL_DISSENTERS_RIGHTS',
      profile_key: 'ROGUE_PROFILE_NOT_IN_PACKAGE',
      profile_set_version: 'V1',
    },
  );
  const rogueProfileInventorySet = clone(originalProfileSet);
  rogueProfileInventorySet.profiles.push(rogueApprovedProfile);
  const restampedRogueProfileInventorySet = restampRecord(
    rogueProfileInventorySet,
    'family_profile_set_id',
  );
  writeCanonicalRecord(
    fixture.root,
    profileSetPath,
    restampedRogueProfileInventorySet,
  );
  const rogueProfileInventorySetBinding = bindingForRecordPath(
    fixture.root,
    profileSetPath,
    'family_profile_set_id',
  );
  const rogueProfileInventoryReceipt = clone(originalRichReceipt);
  rogueProfileInventoryReceipt.family_profile_evidence.approved_family_profile_set_binding =
    rogueProfileInventorySetBinding;
  rogueProfileInventoryReceipt.artifact_bindings =
    rogueProfileInventoryReceipt.artifact_bindings.map(
      (binding) => binding.path === profileSetPath
        ? rogueProfileInventorySetBinding
        : binding,
    );
  rogueProfileInventoryReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    rogueProfileInventoryReceipt.artifact_bindings,
  ));
  const restampedRogueProfileInventoryReceipt = restampRecord(
    rogueProfileInventoryReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedRogueProfileInventoryReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const dimensionEvidenceDriftCases = [
    {
      label: 'omitted',
      members: [],
    },
    {
      label: 'extra',
      members: [
        ...originalProfileSet.dimension_evidence_bindings,
        originalProfileSet.dimension_evidence_bindings[0],
      ],
    },
    {
      label: 'reordered',
      members: [...originalProfileSet.dimension_evidence_bindings].reverse(),
    },
  ].map((driftCase) => {
    const changedSet = clone(originalProfileSet);
    changedSet.dimension_evidence_bindings = driftCase.members;
    const restampedSet = restampRecord(changedSet, 'family_profile_set_id');
    writeCanonicalRecord(fixture.root, profileSetPath, restampedSet);
    const setBinding = bindingForRecordPath(
      fixture.root,
      profileSetPath,
      'family_profile_set_id',
    );
    const changedReceipt = clone(originalRichReceipt);
    changedReceipt.family_profile_evidence.approved_family_profile_set_binding = setBinding;
    changedReceipt.artifact_bindings = changedReceipt.artifact_bindings.map(
      (binding) => binding.path === profileSetPath ? setBinding : binding,
    );
    changedReceipt.artifact_set_digest = sha256Hex(canonicalJson(
      changedReceipt.artifact_bindings,
    ));
    return {
      ...driftCase,
      restampedSet,
      setBinding,
      restampedReceipt: restampRecord(changedReceipt, 'work3_receipt_id'),
    };
  });
  for (const driftCase of dimensionEvidenceDriftCases) {
    writeCanonicalRecord(fixture.root, profileSetPath, driftCase.restampedSet);
    writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, driftCase.restampedReceipt);
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: false,
    }), 'BINDING_DRIFT');
  }
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const governedRecordAsRaw = clone(
    originalRichReceipt.artifact_bindings.find(
      (binding) => binding.path === fixture.artifactCategoryPaths.governedRecord,
    ),
  );
  governedRecordAsRaw.schema_version = null;
  governedRecordAsRaw.record_id_field = null;
  governedRecordAsRaw.record_id = null;
  const rawArtifactAsRecord = (repositoryPath) => {
    const changed = clone(originalRichReceipt.artifact_bindings.find(
      (binding) => binding.path === repositoryPath,
    ));
    changed.schema_version = 'SYNTHETIC_ARTIFACT_RECORD/V1';
    changed.record_id_field = 'artifact_id';
    changed.record_id = '0'.repeat(64);
    return changed;
  };
  const artifactCategoryDriftCases = [
    governedRecordAsRaw,
    rawArtifactAsRecord(fixture.artifactCategoryPaths.code),
    rawArtifactAsRecord(fixture.artifactCategoryPaths.rawFixture),
  ].map((changedBinding) => {
    const changedReceipt = clone(originalRichReceipt);
    changedReceipt.artifact_bindings = changedReceipt.artifact_bindings.map(
      (binding) => binding.path === changedBinding.path ? changedBinding : binding,
    );
    changedReceipt.artifact_set_digest = sha256Hex(canonicalJson(
      changedReceipt.artifact_bindings,
    ));
    return {
      changedBinding,
      restampedReceipt: restampRecord(changedReceipt, 'work3_receipt_id'),
    };
  });
  for (const driftCase of artifactCategoryDriftCases) {
    writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, driftCase.restampedReceipt);
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: false,
    }), 'BINDING_DRIFT');
  }
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const inRangeCommandCountReceipt = clone(originalRichReceipt);
  inRangeCommandCountReceipt.command_execution_ledger[4].run_count = 2;
  const restampedInRangeCommandCountReceipt = restampRecord(
    inRangeCommandCountReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedInRangeCommandCountReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const commandFixturePath = fixture.artifactCategoryPaths.rawFixture;
  const originalCommandFixture = JSON.parse(
    fs.readFileSync(path.join(fixture.root, commandFixturePath), 'utf8'),
  );
  const wrongStateCommandFixture = clone(originalCommandFixture);
  wrongStateCommandFixture.state = 'BUILD_ONLY_OTHER_ACCEPTANCE';
  writeCanonicalRecord(
    fixture.root,
    commandFixturePath,
    wrongStateCommandFixture,
  );
  const wrongStateCommandFixtureBinding = bindingForRawPath(
    fixture.root,
    commandFixturePath,
  );
  const wrongStateCommandFixtureReceipt = clone(originalRichReceipt);
  wrongStateCommandFixtureReceipt.artifact_bindings =
    wrongStateCommandFixtureReceipt.artifact_bindings.map(
      (binding) => binding.path === commandFixturePath
        ? wrongStateCommandFixtureBinding
        : binding,
    );
  wrongStateCommandFixtureReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    wrongStateCommandFixtureReceipt.artifact_bindings,
  ));
  const restampedWrongStateCommandFixtureReceipt = restampRecord(
    wrongStateCommandFixtureReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedWrongStateCommandFixtureReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, commandFixturePath, originalCommandFixture);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const bootstrapCommandCountFixture = clone(originalCommandFixture);
  bootstrapCommandCountFixture.command_run_counts[0] = 6;
  const restampedBootstrapCommandCountFixture = bootstrapCommandCountFixture;
  writeCanonicalRecord(
    fixture.root,
    commandFixturePath,
    restampedBootstrapCommandCountFixture,
  );
  const bootstrapCommandFixtureBinding = bindingForRawPath(
    fixture.root,
    commandFixturePath,
  );
  const bootstrapCommandCountReceipt = clone(originalRichReceipt);
  bootstrapCommandCountReceipt.command_execution_ledger[0].run_count = 6;
  bootstrapCommandCountReceipt.artifact_bindings =
    bootstrapCommandCountReceipt.artifact_bindings.map(
      (binding) => binding.path === commandFixturePath
        ? bootstrapCommandFixtureBinding
        : binding,
    );
  bootstrapCommandCountReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    bootstrapCommandCountReceipt.artifact_bindings,
  ));
  const restampedBootstrapCommandCountReceipt = restampRecord(
    bootstrapCommandCountReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedBootstrapCommandCountReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, commandFixturePath, originalCommandFixture);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const nativeSetDriftCases = [
    {
      inputRole: 'BASE_ANALYSIS_SET',
      schemaVersion: 'AGREEMENT_ANALYSIS_SET/V1',
      idField: 'agreement_analysis_set_id',
    },
    {
      inputRole: 'AGREEMENT_INDEX_SET',
      schemaVersion: 'AGREEMENT_INDEX_SET/V1',
      idField: 'agreement_index_set_id',
    },
    {
      inputRole: 'CONTEXT_COMPILATION_SET',
      schemaVersion: 'CONTEXT_COMPILATION_SET/V1',
      idField: 'context_compilation_set_id',
    },
  ].map((entry) => {
    const repositoryPath = `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/inputs/drift-${entry.inputRole.toLowerCase()}.json`;
    writeRecord(
      fixture.root,
      repositoryPath,
      entry.schemaVersion,
      entry.idField,
      { members: [] },
    );
    return { ...entry, repositoryPath };
  });
  for (const driftCase of nativeSetDriftCases) {
    const changedNativeSet = clone(fixture.specification);
    const descriptor = changedNativeSet.semantic_inputs.find(
      (entry) => entry.input_role === driftCase.inputRole,
    );
    descriptor.path = driftCase.repositoryPath;
    descriptor.schema_version = driftCase.schemaVersion;
    descriptor.record_id_field = driftCase.idField;
    assertCode(() => builder.registerCandidate({
      repoRoot: fixture.root,
      specification: changedNativeSet,
      write: false,
    }), 'BINDING_DRIFT');
  }

  const originalWork3Manifest = JSON.parse(
    fs.readFileSync(path.join(fixture.root, WORK3_MANIFEST_PATH), 'utf8'),
  );
  const originalWork3CorrectionAuthority = JSON.parse(
    fs.readFileSync(path.join(fixture.root, WORK3_CORRECTION_AUTHORITY_PATH), 'utf8'),
  );
  const rogueWork3CorrectionAuthority = clone(originalWork3CorrectionAuthority);
  rogueWork3CorrectionAuthority.rogue_authority_marker = true;
  const restampedRogueWork3CorrectionAuthority = restampRecord(
    rogueWork3CorrectionAuthority,
    'correction_authority_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_CORRECTION_AUTHORITY_PATH,
    restampedRogueWork3CorrectionAuthority,
  );
  const rogueWork3CorrectionAuthorityBinding = bindingForRecordPath(
    fixture.root,
    WORK3_CORRECTION_AUTHORITY_PATH,
    'correction_authority_id',
  );
  const rogueAuthorityManifest = clone(originalWork3Manifest);
  rogueAuthorityManifest.work3_entry_correction_authority_binding =
    rogueWork3CorrectionAuthorityBinding;
  const restampedRogueAuthorityManifest = restampDigestRecord(
    rogueAuthorityManifest,
    'execution_manifest_digest',
    'execution_manifest_id',
  );
  const rogueAuthorityReceipt = clone(originalRichReceipt);
  rogueAuthorityReceipt.execution_manifest_id =
    restampedRogueAuthorityManifest.execution_manifest_id;
  rogueAuthorityReceipt.execution_manifest_digest =
    restampedRogueAuthorityManifest.execution_manifest_digest;
  rogueAuthorityReceipt.work3_entry_correction_authority_binding =
    rogueWork3CorrectionAuthorityBinding;
  rogueAuthorityReceipt.artifact_bindings = rogueAuthorityReceipt.artifact_bindings.map(
    (binding) => binding.path === WORK3_CORRECTION_AUTHORITY_PATH
      ? rogueWork3CorrectionAuthorityBinding
      : binding,
  );
  rogueAuthorityReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    rogueAuthorityReceipt.artifact_bindings,
  ));
  const restampedRogueAuthorityReceipt = restampRecord(
    rogueAuthorityReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_MANIFEST_PATH,
    restampedRogueAuthorityManifest,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedRogueAuthorityReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(
    fixture.root,
    WORK3_CORRECTION_AUTHORITY_PATH,
    originalWork3CorrectionAuthority,
  );
  writeCanonicalRecord(fixture.root, WORK3_MANIFEST_PATH, originalWork3Manifest);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const raisedWork3MaximumManifest = clone(originalWork3Manifest);
  raisedWork3MaximumManifest.exact_argv_with_run_limits[0].max_runs = 6;
  const restampedRaisedWork3MaximumManifest = restampDigestRecord(
    raisedWork3MaximumManifest,
    'execution_manifest_digest',
    'execution_manifest_id',
  );
  const raisedWork3CommandCountFixture = clone(originalCommandFixture);
  raisedWork3CommandCountFixture.command_run_counts[4] = 6;
  const restampedRaisedWork3CommandCountFixture = raisedWork3CommandCountFixture;
  writeCanonicalRecord(
    fixture.root,
    commandFixturePath,
    restampedRaisedWork3CommandCountFixture,
  );
  const raisedWork3CommandFixtureBinding = bindingForRawPath(
    fixture.root,
    commandFixturePath,
  );
  const raisedWork3MaximumReceipt = clone(originalRichReceipt);
  raisedWork3MaximumReceipt.execution_manifest_id =
    restampedRaisedWork3MaximumManifest.execution_manifest_id;
  raisedWork3MaximumReceipt.execution_manifest_digest =
    restampedRaisedWork3MaximumManifest.execution_manifest_digest;
  raisedWork3MaximumReceipt.command_execution_ledger[4].run_count = 6;
  raisedWork3MaximumReceipt.artifact_bindings =
    raisedWork3MaximumReceipt.artifact_bindings.map(
      (binding) => binding.path === commandFixturePath
        ? raisedWork3CommandFixtureBinding
        : binding,
    );
  raisedWork3MaximumReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    raisedWork3MaximumReceipt.artifact_bindings,
  ));
  const restampedRaisedWork3MaximumReceipt = restampRecord(
    raisedWork3MaximumReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_MANIFEST_PATH,
    restampedRaisedWork3MaximumManifest,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedRaisedWork3MaximumReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, commandFixturePath, originalCommandFixture);
  writeCanonicalRecord(fixture.root, WORK3_MANIFEST_PATH, originalWork3Manifest);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const changedManifestScope = clone(originalWork3Manifest);
  changedManifestScope.work_receipt_path =
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/foreign-work3.json';
  const restampedChangedManifestScope = restampDigestRecord(
    changedManifestScope,
    'execution_manifest_digest',
    'execution_manifest_id',
  );
  const changedManifestScopeReceipt = clone(originalRichReceipt);
  changedManifestScopeReceipt.execution_manifest_id =
    restampedChangedManifestScope.execution_manifest_id;
  changedManifestScopeReceipt.execution_manifest_digest =
    restampedChangedManifestScope.execution_manifest_digest;
  const restampedChangedManifestScopeReceipt = restampRecord(
    changedManifestScopeReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_MANIFEST_PATH,
    restampedChangedManifestScope,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedChangedManifestScopeReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, WORK3_MANIFEST_PATH, originalWork3Manifest);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const foreignWork2ReceiptPath =
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/foreign-work2-lineage.json';
  writeRecord(
    fixture.root,
    foreignWork2ReceiptPath,
    'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_RECEIPT/V1',
    'work2_receipt_id',
    { state: 'FOREIGN_TEST_LINEAGE' },
  );
  const foreignWork2ReceiptBinding = bindingForRecordPath(
    fixture.root,
    foreignWork2ReceiptPath,
    'work2_receipt_id',
  );
  const changedLineageManifest = clone(originalWork3Manifest);
  changedLineageManifest.predecessor_receipt_binding = foreignWork2ReceiptBinding;
  const restampedChangedLineageManifest = restampDigestRecord(
    changedLineageManifest,
    'execution_manifest_digest',
    'execution_manifest_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_MANIFEST_PATH,
    restampedChangedLineageManifest,
  );
  const changedLineageReceipt = clone(originalRichReceipt);
  changedLineageReceipt.execution_manifest_id =
    restampedChangedLineageManifest.execution_manifest_id;
  changedLineageReceipt.execution_manifest_digest =
    restampedChangedLineageManifest.execution_manifest_digest;
  changedLineageReceipt.predecessor_receipt_binding = foreignWork2ReceiptBinding;
  const restampedChangedLineageReceipt = restampRecord(
    changedLineageReceipt,
    'work3_receipt_id',
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedChangedLineageReceipt,
  );
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, WORK3_MANIFEST_PATH, originalWork3Manifest);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const changed = clone(fixture.specification);
  changed.subtype_trees[0].binding.member_sha256 = '0'.repeat(64);
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: changed,
    write: false,
  }), 'BINDING_DRIFT');

  writeCanonicalRecord(
    fixture.root,
    nativeIndexSetPath,
    restampedWrongMemberNativeIndexSet,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedWrongMemberRichReceipt,
  );
  const wrongMemberNativeSetRegistration = clone(written.registration);
  wrongMemberNativeSetRegistration.predecessor_receipt_bindings[2].binding =
    bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
  wrongMemberNativeSetRegistration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'AGREEMENT_INDEX_SET',
  ).binding = wrongMemberNativeIndexSetBinding;
  const restampedWrongMemberNativeSetRegistration = restampRegistration(
    wrongMemberNativeSetRegistration,
  );
  const wrongMemberNativeSetRegistrationPath =
    `${REGISTRATION_ROOT}/${restampedWrongMemberNativeSetRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    wrongMemberNativeSetRegistrationPath,
    restampedWrongMemberNativeSetRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: wrongMemberNativeSetRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, nativeIndexSetPath, originalNativeIndexSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  writeCanonicalRecord(
    fixture.root,
    profileSetPath,
    restampedRoguePackageProfileSet,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedRoguePackageRichReceipt,
  );
  const roguePackageRegistration = clone(written.registration);
  roguePackageRegistration.predecessor_receipt_bindings[2].binding = bindingForRecordPath(
    fixture.root,
    WORK3_RECEIPT_PATH,
    'work3_receipt_id',
  );
  roguePackageRegistration.family_profile_set_binding = roguePackageProfileSetBinding;
  roguePackageRegistration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  ).binding = roguePackageProfileSetBinding;
  roguePackageRegistration.subtype_tree_bindings[1].binding.container_path =
    rogueAppraisalPackagePath;
  const restampedRoguePackageRegistration = restampRegistration(
    roguePackageRegistration,
  );
  const roguePackageRegistrationPath =
    `${REGISTRATION_ROOT}/${restampedRoguePackageRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    roguePackageRegistrationPath,
    restampedRoguePackageRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: roguePackageRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedRogueProfileSetRichReceipt,
  );
  const rogueProfileSetRegistration = clone(written.registration);
  rogueProfileSetRegistration.predecessor_receipt_bindings[2].binding =
    bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
  rogueProfileSetRegistration.family_profile_set_binding = rogueProfileSetBinding;
  rogueProfileSetRegistration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  ).binding = rogueProfileSetBinding;
  const restampedRogueProfileSetRegistration = restampRegistration(
    rogueProfileSetRegistration,
  );
  const rogueProfileSetRegistrationPath =
    `${REGISTRATION_ROOT}/${restampedRogueProfileSetRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    rogueProfileSetRegistrationPath,
    restampedRogueProfileSetRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: rogueProfileSetRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  writeCanonicalRecord(
    fixture.root,
    profileSetPath,
    restampedRogueProfileInventorySet,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedRogueProfileInventoryReceipt,
  );
  const rogueProfileInventoryRegistration = clone(written.registration);
  rogueProfileInventoryRegistration.predecessor_receipt_bindings[2].binding =
    bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
  rogueProfileInventoryRegistration.family_profile_set_binding =
    rogueProfileInventorySetBinding;
  rogueProfileInventoryRegistration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  ).binding = rogueProfileInventorySetBinding;
  const restampedRogueProfileInventoryRegistration = restampRegistration(
    rogueProfileInventoryRegistration,
  );
  const rogueProfileInventoryRegistrationPath =
    `${REGISTRATION_ROOT}/${restampedRogueProfileInventoryRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    rogueProfileInventoryRegistrationPath,
    restampedRogueProfileInventoryRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: rogueProfileInventoryRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  for (const driftCase of dimensionEvidenceDriftCases) {
    writeCanonicalRecord(fixture.root, profileSetPath, driftCase.restampedSet);
    writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, driftCase.restampedReceipt);
    const invalidDimensionEvidenceRegistration = clone(written.registration);
    invalidDimensionEvidenceRegistration.predecessor_receipt_bindings[2].binding =
      bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
    invalidDimensionEvidenceRegistration.family_profile_set_binding = driftCase.setBinding;
    invalidDimensionEvidenceRegistration.semantic_input_bindings.find(
      (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
    ).binding = driftCase.setBinding;
    const restampedInvalidDimensionEvidenceRegistration = restampRegistration(
      invalidDimensionEvidenceRegistration,
    );
    const invalidDimensionEvidenceRegistrationPath =
      `${REGISTRATION_ROOT}/${restampedInvalidDimensionEvidenceRegistration.candidate_registration_id}.json`;
    writeCanonicalRecord(
      fixture.root,
      invalidDimensionEvidenceRegistrationPath,
      restampedInvalidDimensionEvidenceRegistration,
    );
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: invalidDimensionEvidenceRegistrationPath,
    }), 'BINDING_DRIFT');
  }
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  for (const driftCase of artifactCategoryDriftCases) {
    writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, driftCase.restampedReceipt);
    const invalidArtifactCategoryRegistration = clone(written.registration);
    invalidArtifactCategoryRegistration.predecessor_receipt_bindings[2].binding =
      bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
    const restampedInvalidArtifactCategoryRegistration = restampRegistration(
      invalidArtifactCategoryRegistration,
    );
    const invalidArtifactCategoryRegistrationPath =
      `${REGISTRATION_ROOT}/${restampedInvalidArtifactCategoryRegistration.candidate_registration_id}.json`;
    writeCanonicalRecord(
      fixture.root,
      invalidArtifactCategoryRegistrationPath,
      restampedInvalidArtifactCategoryRegistration,
    );
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: invalidArtifactCategoryRegistrationPath,
    }), 'BINDING_DRIFT');
  }
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const commandReceiptDriftCases = [
    {
      label: 'fixture-contract-state',
      fixtureRecord: wrongStateCommandFixture,
      receipt: restampedWrongStateCommandFixtureReceipt,
    },
    {
      label: 'fixture-count-mismatch',
      receipt: restampedInRangeCommandCountReceipt,
    },
    {
      label: 'bootstrap-maximum',
      fixtureRecord: restampedBootstrapCommandCountFixture,
      receipt: restampedBootstrapCommandCountReceipt,
    },
    {
      label: 'raised-work3-maximum',
      fixtureRecord: restampedRaisedWork3CommandCountFixture,
      manifest: restampedRaisedWork3MaximumManifest,
      receipt: restampedRaisedWork3MaximumReceipt,
    },
    {
      label: 'manifest-scope',
      manifest: restampedChangedManifestScope,
      receipt: restampedChangedManifestScopeReceipt,
    },
    {
      label: 'rogue-c3-authority',
      authority: restampedRogueWork3CorrectionAuthority,
      manifest: restampedRogueAuthorityManifest,
      receipt: restampedRogueAuthorityReceipt,
    },
  ];
  for (const driftCase of commandReceiptDriftCases) {
    if (driftCase.authority) {
      writeCanonicalRecord(
        fixture.root,
        WORK3_CORRECTION_AUTHORITY_PATH,
        driftCase.authority,
      );
    }
    if (driftCase.fixtureRecord) {
      writeCanonicalRecord(fixture.root, commandFixturePath, driftCase.fixtureRecord);
    }
    if (driftCase.manifest) {
      writeCanonicalRecord(fixture.root, WORK3_MANIFEST_PATH, driftCase.manifest);
    }
    writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, driftCase.receipt);
    const invalidCommandReceiptRegistration = clone(written.registration);
    invalidCommandReceiptRegistration.predecessor_receipt_bindings[2].binding =
      bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
    const restampedInvalidCommandReceiptRegistration = restampRegistration(
      invalidCommandReceiptRegistration,
    );
    const invalidCommandReceiptRegistrationPath =
      `${REGISTRATION_ROOT}/${restampedInvalidCommandReceiptRegistration.candidate_registration_id}.json`;
    writeCanonicalRecord(
      fixture.root,
      invalidCommandReceiptRegistrationPath,
      restampedInvalidCommandReceiptRegistration,
    );
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: invalidCommandReceiptRegistrationPath,
    }), 'BINDING_DRIFT');
    writeCanonicalRecord(fixture.root, commandFixturePath, originalCommandFixture);
    writeCanonicalRecord(
      fixture.root,
      WORK3_CORRECTION_AUTHORITY_PATH,
      originalWork3CorrectionAuthority,
    );
    writeCanonicalRecord(fixture.root, WORK3_MANIFEST_PATH, originalWork3Manifest);
    writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);
  }

  for (const driftCase of nativeSetDriftCases) {
    const invalidNativeSetRegistration = clone(written.registration);
    invalidNativeSetRegistration.semantic_input_bindings.find(
      (entry) => entry.input_role === driftCase.inputRole,
    ).binding = bindingForRecordPath(
      fixture.root,
      driftCase.repositoryPath,
      driftCase.idField,
    );
    const restampedInvalidNativeSetRegistration = restampRegistration(
      invalidNativeSetRegistration,
    );
    const invalidNativeSetRegistrationPath = `${REGISTRATION_ROOT}/${restampedInvalidNativeSetRegistration.candidate_registration_id}.json`;
    writeCanonicalRecord(
      fixture.root,
      invalidNativeSetRegistrationPath,
      restampedInvalidNativeSetRegistration,
    );
    assertCode(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: invalidNativeSetRegistrationPath,
    }), 'REGISTRATION_CONTRACT_DRIFT');
  }

  writeCanonicalRecord(
    fixture.root,
    WORK3_MANIFEST_PATH,
    restampedChangedLineageManifest,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedChangedLineageReceipt,
  );
  const invalidLineageRegistration = clone(written.registration);
  invalidLineageRegistration.predecessor_receipt_bindings[2].binding = bindingForRecordPath(
    fixture.root,
    WORK3_RECEIPT_PATH,
    'work3_receipt_id',
  );
  const restampedInvalidLineageRegistration = restampRegistration(
    invalidLineageRegistration,
  );
  const invalidLineageRegistrationPath = `${REGISTRATION_ROOT}/${restampedInvalidLineageRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    invalidLineageRegistrationPath,
    restampedInvalidLineageRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: invalidLineageRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, WORK3_MANIFEST_PATH, originalWork3Manifest);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  writeCanonicalRecord(
    fixture.root,
    fixture.structurePath,
    restampedStructureClosureDrift,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedChangedRichReceipt,
  );
  const invalidClosureRegistration = clone(written.registration);
  invalidClosureRegistration.predecessor_receipt_bindings[2].binding = bindingForRecordPath(
    fixture.root,
    WORK3_RECEIPT_PATH,
    'work3_receipt_id',
  );
  invalidClosureRegistration.structure_disposition_set_binding = changedStructureBinding;
  invalidClosureRegistration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_STRUCTURE_DISPOSITION_SET',
  ).binding = changedStructureBinding;
  const restampedInvalidClosureRegistration = restampRegistration(
    invalidClosureRegistration,
  );
  const invalidClosureRegistrationPath = `${REGISTRATION_ROOT}/${restampedInvalidClosureRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    invalidClosureRegistrationPath,
    restampedInvalidClosureRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: invalidClosureRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, fixture.structurePath, originalStructureSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  writeCanonicalRecord(
    fixture.root,
    fixture.structurePath,
    restampedOverlayBindingSwapStructureSet,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedOverlayBindingSwapReceipt,
  );
  const invalidOverlayBindingRegistration = clone(written.registration);
  invalidOverlayBindingRegistration.predecessor_receipt_bindings[2].binding =
    bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
  invalidOverlayBindingRegistration.structure_disposition_set_binding =
    overlayBindingSwapStructureBinding;
  invalidOverlayBindingRegistration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_STRUCTURE_DISPOSITION_SET',
  ).binding = overlayBindingSwapStructureBinding;
  const restampedInvalidOverlayBindingRegistration = restampRegistration(
    invalidOverlayBindingRegistration,
  );
  const invalidOverlayBindingRegistrationPath =
    `${REGISTRATION_ROOT}/${restampedInvalidOverlayBindingRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    invalidOverlayBindingRegistrationPath,
    restampedInvalidOverlayBindingRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: invalidOverlayBindingRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, fixture.structurePath, originalStructureSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  writeCanonicalRecord(
    fixture.root,
    syntheticAgreementIndexPath,
    swappedSyntheticAgreementIndex,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedSwappedSyntheticAgreementIndexReceipt,
  );
  const invalidSyntheticAgreementIndexRegistration = clone(written.registration);
  invalidSyntheticAgreementIndexRegistration.predecessor_receipt_bindings[2].binding =
    bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
  const restampedInvalidSyntheticAgreementIndexRegistration = restampRegistration(
    invalidSyntheticAgreementIndexRegistration,
  );
  const invalidSyntheticAgreementIndexRegistrationPath =
    `${REGISTRATION_ROOT}/${restampedInvalidSyntheticAgreementIndexRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    invalidSyntheticAgreementIndexRegistrationPath,
    restampedInvalidSyntheticAgreementIndexRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: invalidSyntheticAgreementIndexRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(
    fixture.root,
    syntheticAgreementIndexPath,
    originalSyntheticAgreementIndex,
  );
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  writeCanonicalRecord(
    fixture.root,
    antitrustPackagePath,
    restampedOrphanMatchFixturePackage,
  );
  writeCanonicalRecord(
    fixture.root,
    profileSetPath,
    restampedOrphanMatchFixtureProfileSet,
  );
  writeCanonicalRecord(
    fixture.root,
    WORK3_RECEIPT_PATH,
    restampedOrphanMatchFixtureReceipt,
  );
  const invalidOrphanMatchFixtureRegistration = clone(written.registration);
  invalidOrphanMatchFixtureRegistration.predecessor_receipt_bindings[2].binding =
    bindingForRecordPath(fixture.root, WORK3_RECEIPT_PATH, 'work3_receipt_id');
  invalidOrphanMatchFixtureRegistration.family_profile_set_binding =
    orphanMatchFixtureProfileSetBinding;
  invalidOrphanMatchFixtureRegistration.semantic_input_bindings.find(
    (entry) => entry.input_role === 'APPROVED_FAMILY_PROFILE_SET',
  ).binding = orphanMatchFixtureProfileSetBinding;
  const restampedInvalidOrphanMatchFixtureRegistration = restampRegistration(
    invalidOrphanMatchFixtureRegistration,
  );
  const invalidOrphanMatchFixtureRegistrationPath =
    `${REGISTRATION_ROOT}/${restampedInvalidOrphanMatchFixtureRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    invalidOrphanMatchFixtureRegistrationPath,
    restampedInvalidOrphanMatchFixtureRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: invalidOrphanMatchFixtureRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, antitrustPackagePath, originalAntitrustPackage);
  writeCanonicalRecord(fixture.root, profileSetPath, originalProfileSet);
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalRichReceipt);

  const originalReceipt = JSON.parse(
    fs.readFileSync(path.join(fixture.root, WORK3_RECEIPT_PATH), 'utf8'),
  );
  const changedReceipt = clone(originalReceipt);
  changedReceipt.counts.candidate_registration_count = 1;
  const restampedReceipt = restampRecord(changedReceipt, 'work3_receipt_id');
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, restampedReceipt);
  assertCode(() => builder.registerCandidate({
    repoRoot: fixture.root,
    specification: fixture.specification,
    write: false,
  }), 'BINDING_DRIFT');

  const receiptDriftRegistration = clone(written.registration);
  receiptDriftRegistration.predecessor_receipt_bindings[2].binding = bindingForRecordPath(
    fixture.root,
    WORK3_RECEIPT_PATH,
    'work3_receipt_id',
  );
  const restampedReceiptDriftRegistration = restampRegistration(receiptDriftRegistration);
  const receiptDriftRegistrationPath = `${REGISTRATION_ROOT}/${restampedReceiptDriftRegistration.candidate_registration_id}.json`;
  writeCanonicalRecord(
    fixture.root,
    receiptDriftRegistrationPath,
    restampedReceiptDriftRegistration,
  );
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: receiptDriftRegistrationPath,
  }), 'BINDING_DRIFT');
  writeCanonicalRecord(fixture.root, WORK3_RECEIPT_PATH, originalReceipt);

  const registration = clone(written.registration);
  registration.subtype_tree_bindings[0].binding.member_sha256 = 'f'.repeat(64);
  const restamped = restampRegistration(registration);
  const registrationPath = `${REGISTRATION_ROOT}/${restamped.candidate_registration_id}.json`;
  writeCanonicalRecord(fixture.root, registrationPath, restamped);
  assertCode(() => verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath,
  }), 'REGISTRATION_CONTRACT_DRIFT');
});

// ---------------------------------------------------------------------------
// Interim registration under the candidate replacement authority.
//
// `interim_registration_policy` mints one registration before every evidence
// run, each superseding the last, all of them retained. These cases prove the
// command's behaviour on a prepared tree; `evidence/` is never touched.
//
// A registration fixture is about half a gigabyte, so each case that needs one
// builds it under its own subtest context and it is removed when that subtest
// ends.
//
// The whole tree is committed, not just the code: the Work 7 verifier compares
// every binding a registration carries against HEAD, evidence records
// included, so a fixture whose evidence is untracked cannot prove anything
// about a registration taken out over it.
function commitFixtureCode(root) {
  childProcess.execFileSync('git', ['-C', root, 'init', '--quiet'], { stdio: 'ignore' });
  childProcess.execFileSync('git', ['-C', root, 'add', '-A', '-f'], { stdio: 'ignore' });
  childProcess.execFileSync('git', [
    '-C', root,
    '-c', 'user.name=interim',
    '-c', 'user.email=interim@test.invalid',
    'commit', '--quiet', '-m', 'interim registration fixture',
  ], { stdio: 'ignore' });
}

function expectedReplacementAuthorityBinding() {
  const bytes = fs.readFileSync(path.join(ROOT, CANDIDATE_REPLACEMENT_AUTHORITY_PATH));
  const record = JSON.parse(bytes.toString('utf8'));
  return {
    path: CANDIDATE_REPLACEMENT_AUTHORITY_PATH,
    schema_version: record.schema_version,
    record_id_field: 'replacement_authority_id',
    record_id: record.replacement_authority_id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function captureWarnings(action) {
  const captured = [];
  const realWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    captured.push(String(chunk));
    return realWrite(chunk, ...rest);
  };
  try {
    return { result: action(), warnings: captured.join('') };
  } finally {
    process.stderr.write = realWrite;
  }
}

function registrationFileNames(root) {
  return fs.readdirSync(path.join(root, REGISTRATION_ROOT)).sort();
}

test('interim candidate registration supersedes the last one and binds the current tree', async (t) => {
  const builder = await import('../scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs');
  const verifier = await import('../scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs');
  const finaliser = await import('../scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs');
  const work2Template = prepareWork2Template(t, finaliser);

  // A tree with the replacement authority in it and exactly one registration
  // in the candidate root, its code committed. That registration is the
  // latest, so it is what the next interim one supersedes.
  function prepareInterimTree(subtest) {
    const fixture = makeFixture(subtest, work2Template);
    copyRepositoryFile(fixture.root, CANDIDATE_REPLACEMENT_AUTHORITY_PATH);
    const previous = builder.registerCandidate({
      repoRoot: fixture.root,
      specification: fixture.specification,
      write: true,
    });
    commitFixtureCode(fixture.root);
    return { fixture, previous };
  }

  await t.test('the minted registration is content-addressed, current and chains', async (subtest) => {
    const { fixture, previous } = prepareInterimTree(subtest);
    const previousBytes = fs.readFileSync(path.join(fixture.root, previous.registration_path));
    const written = builder.registerInterimCandidate({
      repoRoot: fixture.root,
      supersedes: previous.registration.candidate_registration_id,
      write: true,
    });
    const registration = written.registration;

    assert.equal(registration.schema_version, SCHEMA);
    assert.equal(registration.lifecycle_state, 'CANDIDATE_PENDING_REVIEW');
    assert.deepEqual(
      registration.candidate_replacement_authority_binding,
      expectedReplacementAuthorityBinding(),
    );
    assert.equal(
      registration.supersedes_candidate_registration_id,
      previous.registration.candidate_registration_id,
    );
    assert.ok(Array.isArray(registration.import_closure_bindings));
    assert.ok(registration.import_closure_bindings.length > 0);
    assert.equal(
      registration.counts.import_closure_count,
      registration.import_closure_bindings.length,
    );
    // The five fixed roles plus the runners and tests, as the registrar
    // enumerates them, are what it bound — re-read from the working tree, not
    // copied from the registration it supersedes.
    assert.deepEqual(
      registration.code_bindings.runners.map((binding) => binding.path),
      previous.registration.code_bindings.runners.map((binding) => binding.path),
    );
    assert.deepEqual(
      registration.code_bindings.tests.map((binding) => binding.path),
      previous.registration.code_bindings.tests.map((binding) => binding.path),
    );
    assert.equal(
      registration.counts.code_file_count,
      5 + registration.code_bindings.runners.length + registration.code_bindings.tests.length,
    );
    const closurePaths = registration.import_closure_bindings.map((binding) => binding.path);
    assert.deepEqual(closurePaths, [...closurePaths].sort());
    for (const codePath of [
      ...['compiler', 'contract_validator', 'deterministic_generator',
        'independent_verifier', 'projector'].map(
        (role) => registration.code_bindings[role].path,
      ),
      ...registration.code_bindings.runners.map((binding) => binding.path),
      ...registration.code_bindings.tests.map((binding) => binding.path),
    ]) {
      assert.ok(closurePaths.includes(codePath), codePath);
    }

    // Content-addressed over the whole record, the two new members included.
    const unsigned = clone(registration);
    delete unsigned.candidate_registration_id;
    assert.equal(contentId(SCHEMA, unsigned), registration.candidate_registration_id);
    assert.notEqual(
      registration.candidate_registration_id,
      previous.registration.candidate_registration_id,
    );
    assert.equal(
      written.registration_path,
      `${REGISTRATION_ROOT}/${registration.candidate_registration_id}.json`,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(fixture.root, written.registration_path)),
      Buffer.from(`${canonicalJson(registration)}\n`, 'utf8'),
    );
    // Same candidate root, both files retained, the superseded one untouched.
    assert.deepEqual(registrationFileNames(fixture.root), [
      `${previous.registration.candidate_registration_id}.json`,
      `${registration.candidate_registration_id}.json`,
    ].sort());
    assert.deepEqual(
      fs.readFileSync(path.join(fixture.root, previous.registration_path)),
      previousBytes,
    );

    // The independent verifier reads it against the working tree and says so.
    const current = captureWarnings(() => verifier.verifyRegisteredCandidate({
      repoRoot: fixture.root,
      registrationPath: written.registration_path,
    }));
    assert.equal(current.result.state, 'PASS_CANDIDATE_REGISTRATION');
    assert.equal(
      current.result.candidate_registration_id,
      registration.candidate_registration_id,
    );
    assert.ok(
      current.warnings.includes(
        `CURRENT_REGISTRATION ${registration.candidate_registration_id}`,
      ),
      current.warnings,
    );
    assert.ok(
      current.warnings.includes(
        `IMPORT_CLOSURE_PRESENT ${registration.candidate_registration_id} `
        + `${registration.import_closure_bindings.length}`,
      ),
      current.warnings,
    );
    assert.ok(!current.warnings.includes('HISTORICAL_SUPERSEDED_REGISTRATION'), current.warnings);

    // And the Work 7 verifier, which re-derives every binding from the working
    // tree and from HEAD, passes on it.
    const { verifyWork7 } = await import(
      '../scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs'
    );
    const work7 = verifyWork7({
      repoRoot: fixture.root,
      registrationPath: written.registration_path,
    });
    assert.equal(
      work7.status,
      'PASS',
      JSON.stringify(work7.findings.filter((entry) => entry.severity !== 'INFO'), null, 2),
    );

    // The next one must supersede this one, not the one this one superseded.
    assert.throws(() => builder.registerInterimCandidate({
      repoRoot: fixture.root,
      supersedes: previous.registration.candidate_registration_id,
      write: true,
    }), (error) => {
      assert.equal(error.code, 'SUPERSEDES_DRIFT');
      assert.ok(error.message.includes(registration.candidate_registration_id), error.message);
      return true;
    });
    assert.equal(registrationFileNames(fixture.root).length, 2);

    // One command line mints the next link in the chain. The registrar is run
    // from the repository that holds it, against the prepared tree as its
    // working directory, which is how the interim command is issued.
    const output = childProcess.execFileSync('node', [
      path.join(ROOT, 'scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs'),
      '--authority', CANDIDATE_REPLACEMENT_AUTHORITY_PATH,
      '--supersedes', registration.candidate_registration_id,
    ], { cwd: fixture.root, encoding: 'utf8' });
    const result = JSON.parse(output);
    assert.equal(
      result.supersedes_candidate_registration_id,
      registration.candidate_registration_id,
    );
    assert.equal(
      result.registration_path,
      `${REGISTRATION_ROOT}/${result.candidate_registration_id}.json`,
    );
    assert.equal(registrationFileNames(fixture.root).length, 3);
    const third = JSON.parse(fs.readFileSync(
      path.join(fixture.root, result.registration_path), 'utf8',
    ));
    assert.equal(third.lifecycle_state, 'CANDIDATE_PENDING_REVIEW');
    assert.deepEqual(
      third.candidate_replacement_authority_binding,
      expectedReplacementAuthorityBinding(),
    );
    assert.equal(
      verifier.verifyRegisteredCandidate({
        repoRoot: fixture.root,
        registrationPath: result.registration_path,
      }).state,
      'PASS_CANDIDATE_REGISTRATION',
    );
    // Every earlier registration file is still byte-identical.
    assert.deepEqual(
      fs.readFileSync(path.join(fixture.root, previous.registration_path)),
      previousBytes,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(fixture.root, written.registration_path)),
      Buffer.from(`${canonicalJson(registration)}\n`, 'utf8'),
    );
  });

  await t.test('a bound code role that is not the byte at HEAD refuses DIRTY_BOUND_ROLE', (subtest) => {
    const { fixture, previous } = prepareInterimTree(subtest);
    const before = registrationFileNames(fixture.root);

    // Edited in the working tree and not committed.
    const edited = fixture.specification.code.contract_validator;
    const editedAbsolute = path.join(fixture.root, edited);
    const editedBytes = fs.readFileSync(editedAbsolute);
    fs.appendFileSync(editedAbsolute, '\n// uncommitted\n');
    assert.throws(() => builder.registerInterimCandidate({
      repoRoot: fixture.root,
      supersedes: previous.registration.candidate_registration_id,
      write: true,
    }), (error) => {
      assert.equal(error.code, 'DIRTY_BOUND_ROLE');
      assert.ok(error.message.includes(edited), error.message);
      return true;
    });
    fs.writeFileSync(editedAbsolute, editedBytes);

    // Present in the working tree but absent from HEAD altogether.
    const untracked = fixture.specification.code.tests[0];
    childProcess.execFileSync('git', [
      '-C', fixture.root, 'rm', '--quiet', '--cached', '--', untracked,
    ], { stdio: 'ignore' });
    childProcess.execFileSync('git', [
      '-C', fixture.root,
      '-c', 'user.name=interim',
      '-c', 'user.email=interim@test.invalid',
      'commit', '--quiet', '-m', 'drop a bound test role from the tree',
    ], { stdio: 'ignore' });
    assert.throws(() => builder.registerInterimCandidate({
      repoRoot: fixture.root,
      supersedes: previous.registration.candidate_registration_id,
      write: true,
    }), (error) => {
      assert.equal(error.code, 'DIRTY_BOUND_ROLE');
      assert.ok(error.message.includes(untracked), error.message);
      return true;
    });

    // Neither refusal wrote anything.
    assert.deepEqual(registrationFileNames(fixture.root), before);
  });

  // The other half of the same distinction, on the repository itself: the
  // registration the authority stopped is historical, and the correction
  // record beside the authority is recognised on the same run.
  await t.test('the stopped registration is read as historical, and the correction as pending', () => {
    const authority = JSON.parse(fs.readFileSync(
      path.join(ROOT, CANDIDATE_REPLACEMENT_AUTHORITY_PATH), 'utf8',
    ));
    const stopped = authority.stop_record.stopped_candidate_registration_id;
    const historical = captureWarnings(() => verifier.verifyRegisteredCandidate({
      repoRoot: ROOT,
      registrationPath: `${REGISTRATION_ROOT}/${stopped}.json`,
    }));
    assert.equal(historical.result.state, 'PASS_CANDIDATE_REGISTRATION');
    assert.ok(
      historical.warnings.includes(`HISTORICAL_SUPERSEDED_REGISTRATION ${stopped}`),
      historical.warnings,
    );
    assert.ok(
      !historical.warnings.includes(`CURRENT_REGISTRATION ${stopped}`),
      historical.warnings,
    );
    const correction = JSON.parse(fs.readFileSync(path.join(
      ROOT,
      'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-candidate-replacement-authority-correction-1.json',
    ), 'utf8'));
    assert.equal(correction.approval.state, 'PENDING_BEN');
    assert.ok(
      historical.warnings.includes(`CORRECTION_PENDING_BEN ${correction.correction_id}`),
      historical.warnings,
    );
  });
});
