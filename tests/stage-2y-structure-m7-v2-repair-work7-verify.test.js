'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRATION_ID = '0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e';
const REGISTRATION_PATH = `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations/${REGISTRATION_ID}.json`;
const WORK4_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work4-fixture.json';
const PINNED_BASE = 'b11388ab7c9605b1df872b1c6cd2e927d1a2dbab';

function gitBlobOid(bytes) {
  const crypto = require('node:crypto');
  return crypto.createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function writeBytes(root, repositoryPath, bytes) {
  const absolute = path.join(root, repositoryPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, bytes);
  return bytes;
}

function writeCanonical(root, repositoryPath, record) {
  return writeBytes(root, repositoryPath, Buffer.from(`${canonicalJson(record)}\n`, 'utf8'));
}

function fileBinding(root, repositoryPath, record, schemaVersion, idField) {
  const bytes = writeCanonical(root, repositoryPath, record);
  return {
    path: repositoryPath,
    schema_version: schemaVersion,
    record_id_field: idField,
    record_id: idField ? record[idField] : null,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function identify(schema, record, idField) {
  const unsigned = { ...record };
  delete unsigned[idField];
  const identified = { ...record, [idField]: contentId(schema, unsigned) };
  return identified;
}

function memberBinding(packagePath, member, familyKey) {
  const memberBytes = Buffer.from(canonicalJson(member), 'utf8');
  return {
    schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1',
    container_path: packagePath,
    member_field: 'subtype_tree',
    member_index: null,
    member_schema_version: member.schema_version,
    member_record_id_field: 'subtype_tree_id',
    member_record_id: member.subtype_tree_id,
    member_byte_length: memberBytes.length,
    member_sha256: sha256Hex(memberBytes),
  };
}

function commitTree(root) {
  execFileSync('git', ['-C', root, 'init'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
  execFileSync('git', [
    '-C', root,
    '-c', 'user.name=work7',
    '-c', 'user.email=work7@test.invalid',
    'commit', '-m', 'synthetic candidate',
  ], { stdio: 'ignore' });
}

function buildSyntheticCandidate(root) {
  const sourcePath = 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/tiny.agreement-analysis.json';
  const sourceRecord = identify('AGREEMENT_ANALYSIS/V1', { schema_version: 'AGREEMENT_ANALYSIS/V1', body: 'source' }, 'agreement_analysis_id');
  const sourceBinding = fileBinding(root, sourcePath, sourceRecord, 'AGREEMENT_ANALYSIS/V1', 'agreement_analysis_id');

  const analysisSetPath = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-analysis-set.json';
  const analysisSet = identify('AGREEMENT_ANALYSIS_SET/V1', {
    schema_version: 'AGREEMENT_ANALYSIS_SET/V1',
    members: [{ agreement_id: 'tiny', agreement_analysis_binding: sourceBinding }],
  }, 'agreement_analysis_set_id');
  const analysisBinding = fileBinding(root, analysisSetPath, analysisSet, 'AGREEMENT_ANALYSIS_SET/V1', 'agreement_analysis_set_id');

  const packetPath = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-packet-set.json';
  const packetSet = identify('STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1', {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
    families: [],
  }, 'family_packet_set_id');
  const packetBinding = fileBinding(root, packetPath, packetSet, 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1', 'family_packet_set_id');

  const packagePath = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-termination.json';
  const subtypeTree = identify('STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1', {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1',
    family_key: 'TERMINATION',
    nodes: ['root'],
  }, 'subtype_tree_id');
  const profile = { profile_key: 'TERMINATION:TEST', profile_id: 'p1', family_key: 'TERMINATION' };
  const packageRecord = identify('STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2', {
    schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2',
    state: 'APPROVED',
    family_key: 'TERMINATION',
    profile_set_version: 1,
    family_approval: 'BEN',
    legal_decisions: [],
    profiles: [profile],
    subtype_tree: subtypeTree,
    match_fixtures: [],
    dimension_evidence: [],
    structure_fixture_members: [],
  }, 'family_profile_package_id');
  const packageBinding = fileBinding(root, packagePath, packageRecord, 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2', 'family_profile_package_id');

  const profileSetPath = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-approved-profile-set.json';
  const profileSet = identify('STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1', {
    schema_version: 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1',
    state: 'BEN_APPROVED_PROFILE_SET',
    family_profile_package_bindings: [packageBinding],
    profiles: [profile],
    dimension_evidence_bindings: [],
    subtype_tree_bindings: [{ family_key: 'TERMINATION', binding: memberBinding(packagePath, subtypeTree) }],
  }, 'family_profile_set_id');
  const profileBinding = fileBinding(root, profileSetPath, profileSet, 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1', 'family_profile_set_id');

  const dispositionPath = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-structure-disposition-set.json';
  const fixtureMember = { match_fixture_id: 'f1', schema_version: 'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1', body: 'fixture' };
  const fixtureBytes = Buffer.from(canonicalJson(fixtureMember), 'utf8');
  packageRecord.match_fixtures = [fixtureMember];
  const rewrittenPackage = identify('STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2', {
    ...packageRecord,
  }, 'family_profile_package_id');
  const rewrittenPackageBinding = fileBinding(root, packagePath, rewrittenPackage, 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE/V2', 'family_profile_package_id');
  const disposition = identify('STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1', {
    schema_version: 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1',
    state: 'BEN_APPROVED_STRUCTURE_DISPOSITION_SET',
    members: [{
      schema_version: 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1',
      structure_disposition_id: 'd1',
      inclusion_fixture_bindings: [{
        schema_version: 'STAGE_2Y_M7_V2_FAMILY_PROFILE_PACKAGE_MEMBER_BINDING/V1',
        container_path: packagePath,
        member_field: 'match_fixtures',
        member_index: 0,
        member_schema_version: 'STAGE_2Y_M7_V2_MATCH_FIXTURE/V1',
        member_record_id_field: 'match_fixture_id',
        member_record_id: 'f1',
        member_byte_length: fixtureBytes.length,
        member_sha256: sha256Hex(fixtureBytes),
      }],
    }],
  }, 'structure_disposition_set_id');
  const dispositionBinding = fileBinding(root, dispositionPath, disposition, 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1', 'structure_disposition_set_id');

  const viewPath = 'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/v2-view-policy.json';
  const viewPolicy = identify('STAGE_2Y_M7_V2_VIEW_POLICY/V1', {
    schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1',
    labels: [],
    formatters: [],
    layouts: [],
  }, 'view_policy_id');
  const viewBinding = fileBinding(root, viewPath, viewPolicy, 'STAGE_2Y_M7_V2_VIEW_POLICY/V1', 'view_policy_id');

  const codeFiles = {
    compiler: 'lib/canonical-v2/agreement-analysis-consolidation.js',
    contract_validator: 'lib/canonical-v2/m7-v2-contract.js',
    deterministic_generator: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
    independent_verifier: 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
    projector: 'lib/canonical-v2/agreement-projection.js',
  };
  const codeBindings = {};
  for (const [role, repositoryPath] of Object.entries(codeFiles)) {
    const bytes = writeBytes(root, repositoryPath, Buffer.from(`// ${role}\n`, 'utf8'));
    codeBindings[role] = {
      path: repositoryPath,
      schema_version: null,
      record_id_field: null,
      record_id: null,
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      git_blob_oid: gitBlobOid(bytes),
    };
  }
  const runnerPath = 'scripts/stage-2y-structure-family-aggregate.mjs';
  const runnerBytes = writeBytes(root, runnerPath, Buffer.from('// runner\n', 'utf8'));
  const testPath = 'tests/stage-2y-structure-m7-v2-repair-work4.test.js';
  const testBytes = writeBytes(root, testPath, Buffer.from('// test\n', 'utf8'));
  codeBindings.runners = [{
    path: runnerPath,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: runnerBytes.length,
    sha256: sha256Hex(runnerBytes),
    git_blob_oid: gitBlobOid(runnerBytes),
  }];
  codeBindings.tests = [{
    path: testPath,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: testBytes.length,
    sha256: sha256Hex(testBytes),
    git_blob_oid: gitBlobOid(testBytes),
  }];

  const work0 = identify('STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1', {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1',
    state: 'PASS',
  }, 'evidence_root_id');
  const work0Binding = fileBinding(
    root,
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json',
    work0,
    'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1',
    'evidence_root_id',
  );

  const activationUnsigned = {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1',
    state: 'PASS_AUTHORITY_ACTIVATION',
    evidence_root_id: work0.evidence_root_id,
  };
  const activationDigest = sha256Hex(canonicalJson(activationUnsigned));
  const activation = identify(
    activationUnsigned.schema_version,
    { ...activationUnsigned, activation_receipt_digest: activationDigest },
    'activation_receipt_id',
  );
  const activationBinding = fileBinding(
    root,
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json',
    activation,
    activation.schema_version,
    'activation_receipt_id',
  );

  const work1Unsigned = {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1',
    status: 'PASS',
    activation_receipt_id: activation.activation_receipt_id,
  };
  const work1 = identify(
    work1Unsigned.schema_version,
    { ...work1Unsigned, work1_contract_receipt_digest: sha256Hex(canonicalJson(work1Unsigned)) },
    'work1_contract_receipt_id',
  );
  const work1Binding = fileBinding(
    root,
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json',
    work1,
    work1.schema_version,
    'work1_contract_receipt_id',
  );

  const work2 = identify('STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_RECEIPT/V1', {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_RECEIPT/V1',
    status: 'PASS',
    predecessor: work1.work1_contract_receipt_id,
  }, 'work2_receipt_id');
  const work2Binding = fileBinding(
    root,
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work2-compiler.json',
    work2,
    work2.schema_version,
    'work2_receipt_id',
  );

  const work3 = identify('STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2', {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_RECEIPT/V2',
    status: 'PASS',
    predecessor: work2.work2_receipt_id,
  }, 'work3_receipt_id');
  const work3Binding = fileBinding(
    root,
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-profile.json',
    work3,
    work3.schema_version,
    'work3_receipt_id',
  );

  const authority = identify('STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1', {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1',
    authority_digest: '00'.repeat(32),
  }, 'authority_id');
  const authorityBinding = fileBinding(
    root,
    'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json',
    authority,
    authority.schema_version,
    'authority_id',
  );

  const registrationPath = `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations/${'ab'.repeat(32)}.json`;
  const registrationUnsigned = {
    schema_version: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1',
    stage: 'M7_V2_REPAIR',
    lifecycle_state: 'CANDIDATE_PENDING_REVIEW',
    allowed_output_root: 'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/v2-candidate',
    effects: { model_calls: 0 },
    parent_authority_binding: authorityBinding,
    activation_receipt_binding: activationBinding,
    work0_evidence_root_binding: work0Binding,
    code_bindings: codeBindings,
    semantic_input_bindings: [
      { input_role: 'BASE_ANALYSIS_SET', binding: analysisBinding },
      { input_role: 'APPROVED_FAMILY_PACKET_SET', binding: packetBinding },
      { input_role: 'APPROVED_FAMILY_PROFILE_SET', binding: profileBinding },
      { input_role: 'APPROVED_STRUCTURE_DISPOSITION_SET', binding: dispositionBinding },
    ],
    family_profile_set_binding: profileBinding,
    structure_disposition_set_binding: dispositionBinding,
    view_policy_binding: viewBinding,
    subtype_tree_bindings: [{ family_key: 'TERMINATION', binding: memberBinding(packagePath, subtypeTree) }],
    predecessor_receipt_bindings: [
      { work: 'WORK1', binding: work1Binding },
      { work: 'WORK2', binding: work2Binding },
      { work: 'WORK3', binding: work3Binding },
    ],
    counts: {
      code_file_count: 7,
      runner_count: 1,
      test_count: 1,
      semantic_input_count: 4,
      subtype_tree_count: 1,
      predecessor_receipt_count: 3,
      unique_bound_path_count: 0,
    },
  };
  const uniquePaths = new Set();
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.path === 'string') uniquePaths.add(value.path);
    if (typeof value.container_path === 'string') uniquePaths.add(value.container_path);
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }
    for (const item of Object.values(value)) collect(item);
  };
  collect(registrationUnsigned);
  registrationUnsigned.counts.unique_bound_path_count = uniquePaths.size;
  const registration = identify('STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1', registrationUnsigned, 'candidate_registration_id');
  writeCanonical(root, registrationPath, registration);

  const work4 = identify('STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V1', {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V1',
    status: 'PASS',
    work: 'WORK4',
    candidate_registration_id: registration.candidate_registration_id,
  }, 'work4_receipt_id');
  writeCanonical(root, WORK4_RECEIPT_PATH, work4);

  // Package binding inside the profile set still names the first package digest.
  // Rewrite the profile set against the package that now contains the fixture.
  const refreshedProfileSet = identify('STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1', {
    ...profileSet,
    family_profile_package_bindings: [rewrittenPackageBinding],
  }, 'family_profile_set_id');
  const refreshedProfileBinding = fileBinding(
    root,
    profileSetPath,
    refreshedProfileSet,
    refreshedProfileSet.schema_version,
    'family_profile_set_id',
  );
  registration.family_profile_set_binding = refreshedProfileBinding;
  registration.semantic_input_bindings = registration.semantic_input_bindings.map((entry) => (
    entry.input_role === 'APPROVED_FAMILY_PROFILE_SET'
      ? { ...entry, binding: refreshedProfileBinding }
      : entry
  ));
  const restamped = identify('STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1', registration, 'candidate_registration_id');
  writeCanonical(root, registrationPath, restamped);
  const restampedWork4 = identify('STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V1', {
    ...work4,
    candidate_registration_id: restamped.candidate_registration_id,
  }, 'work4_receipt_id');
  writeCanonical(root, WORK4_RECEIPT_PATH, restampedWork4);

  commitTree(root);
  return {
    registrationPath,
    registrationId: restamped.candidate_registration_id,
    testPath,
    work4Path: WORK4_RECEIPT_PATH,
  };
}

async function loadVerifier() {
  return import('../scripts/stage-2y-structure-m7-v2-repair-work7-verify.mjs');
}

function failCodes(result) {
  return result.findings.filter((entry) => entry.severity !== 'INFO').map((entry) => entry.code).sort();
}

test('byte-identical registered candidate passes independent Work 7 verification', async () => {
  const { verifyWork7 } = await loadVerifier();
  const result = verifyWork7({ repoRoot: REPO_ROOT, registrationId: REGISTRATION_ID });
  assert.equal(result.schema_version, 'STAGE_2Y_M7_V2_REPAIR_WORK7_VERIFICATION/V1');
  assert.equal(
    result.status,
    'PASS',
    JSON.stringify(result.findings.filter((entry) => entry.severity !== 'INFO'), null, 2),
  );
  assert.equal(result.candidate_registration_id, REGISTRATION_ID);
  assert.equal(result.counts.unique_bound_path_count, 53);
  assert.equal(result.counts.subtype_tree_count, 24);
  assert.equal(result.counts.semantic_input_count, 6);
  assert.equal(result.recomputations.some((entry) => entry.name === 'subtype_trees' && entry.status === 'RECOMPUTED'), true);
  assert.equal(result.recomputations.some((entry) => entry.name === 'family_profile_set' && entry.status === 'RECOMPUTED'), true);
  assert.equal(result.recomputations.some((entry) => (
    entry.name === 'view_policy' && entry.status === 'NO_INDEPENDENT_SOURCE'
  )), true);
});

test('synthetic byte-identical tree passes', async (t) => {
  const { verifyWork7 } = await loadVerifier();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work7-pass-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const built = buildSyntheticCandidate(root);
  const result = verifyWork7({ repoRoot: root, registrationPath: built.registrationPath });
  assert.equal(result.status, 'PASS', JSON.stringify(result.findings.filter((entry) => entry.severity !== 'INFO'), null, 2));
});

test('one bound byte changed fails with BINDING_BYTE_MISMATCH', async (t) => {
  const { verifyWork7 } = await loadVerifier();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work7-byte-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const built = buildSyntheticCandidate(root);
  const target = path.join(root, built.testPath);
  const bytes = fs.readFileSync(target);
  bytes[0] = bytes[0] === 47 ? 48 : 47;
  fs.writeFileSync(target, bytes);
  const result = verifyWork7({ repoRoot: root, registrationPath: built.registrationPath });
  assert.equal(result.status, 'FAIL');
  assert.equal(failCodes(result).includes('BINDING_BYTE_MISMATCH'), true);
  assert.equal(failCodes(result).includes('WORKING_TREE_GIT_DRIFT'), true);
});

test('a path added to the registration fails with BINDING_PATH_ADDED', async (t) => {
  const { verifyWork7 } = await loadVerifier();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work7-added-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const built = buildSyntheticCandidate(root);
  const extraPath = 'tests/stage-2y-structure-m7-v2-repair-work3.test.js';
  const extra = Buffer.from('// extra\n', 'utf8');
  writeBytes(root, extraPath, extra);
  const registration = JSON.parse(fs.readFileSync(path.join(root, built.registrationPath), 'utf8'));
  registration.code_bindings.tests.push({
    path: extraPath,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: extra.length,
    sha256: sha256Hex(extra),
    git_blob_oid: gitBlobOid(extra),
  });
  writeCanonical(root, built.registrationPath, registration);
  const result = verifyWork7({ repoRoot: root, registrationPath: built.registrationPath });
  assert.equal(result.status, 'FAIL');
  assert.equal(failCodes(result).includes('BINDING_PATH_ADDED'), true);
});

test('a registered path removed from the tree fails with BINDING_PATH_MISSING', async (t) => {
  const { verifyWork7 } = await loadVerifier();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work7-removed-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const built = buildSyntheticCandidate(root);
  fs.rmSync(path.join(root, built.testPath));
  const result = verifyWork7({ repoRoot: root, registrationPath: built.registrationPath });
  assert.equal(result.status, 'FAIL');
  assert.equal(failCodes(result).includes('BINDING_PATH_MISSING'), true);
});

test('an altered receipt identity fails with RECEIPT_IDENTITY_MISMATCH', async (t) => {
  const { verifyWork7 } = await loadVerifier();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work7-receipt-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const built = buildSyntheticCandidate(root);
  const receipt = JSON.parse(fs.readFileSync(path.join(root, built.work4Path), 'utf8'));
  receipt.work4_receipt_id = 'ff'.repeat(32);
  writeCanonical(root, built.work4Path, receipt);
  const result = verifyWork7({ repoRoot: root, registrationPath: built.registrationPath });
  assert.equal(result.status, 'FAIL');
  assert.equal(failCodes(result).includes('RECEIPT_IDENTITY_MISMATCH'), true);
});

test('an edited count fails with COUNT_MISMATCH', async (t) => {
  const { verifyWork7 } = await loadVerifier();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'm7-v2-work7-count-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const built = buildSyntheticCandidate(root);
  const registration = JSON.parse(fs.readFileSync(path.join(root, built.registrationPath), 'utf8'));
  registration.counts.test_count = registration.counts.test_count + 1;
  writeCanonical(root, built.registrationPath, registration);
  const result = verifyWork7({ repoRoot: root, registrationPath: built.registrationPath });
  assert.equal(result.status, 'FAIL');
  assert.equal(failCodes(result).includes('COUNT_MISMATCH'), true);
});

test('Work 7 verifier does not change candidate-bound bytes on the pinned base', async () => {
  const { verifyWork7 } = await loadVerifier();
  const result = verifyWork7({ repoRoot: REPO_ROOT, registrationId: REGISTRATION_ID });
  const boundPaths = result.unique_bound_paths;
  assert.equal(boundPaths.length, 53);
  const diff = execFileSync('git', [
    '-C', REPO_ROOT,
    'diff', '--stat', PINNED_BASE, '--',
    ...boundPaths,
  ], { encoding: 'utf8' });
  assert.equal(diff, '');
});
