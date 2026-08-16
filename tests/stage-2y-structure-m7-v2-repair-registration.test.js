'use strict';

const assert = require('node:assert/strict');
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

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1';
const VERIFICATION_SCHEMA = 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1';
const REGISTRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
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
const WORK3_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-fixture.json';
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

function makeFixture(t, work2Template) {
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
      'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
      'tests/stage-2y-structure-m7-v2-repair-work2.test.js',
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

test('M7 V2 candidate registration is immutable, content-addressed and independently verified', async (t) => {
  const builder = await import('../scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs');
  const verifier = await import('../scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs');
  const finaliser = await import('../scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs');
  const work2Template = prepareWork2Template(t, finaliser);

  await t.test('the two modules expose one deep public seam each', () => {
    assert.deepEqual(Object.keys(builder), ['registerCandidate']);
    assert.deepEqual(Object.keys(verifier), ['verifyRegisteredCandidate']);
    assert.equal(typeof builder.registerCandidate, 'function');
    assert.equal(typeof verifier.verifyRegisteredCandidate, 'function');

    const verifierSource = fs.readFileSync(path.join(
      ROOT,
      'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
    ), 'utf8');
    const specifiers = [
      ...verifierSource.matchAll(/^import[\s\S]*?from ['"]([^'"]+)['"];$/gm),
    ].map((match) => match[1]);
    assert.ok(!specifiers.some((value) => /register-candidate|m7-v2-contract|agreement-analysis-consolidation|agreement-projection/.test(value)));
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
});
