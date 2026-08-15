const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V1';
const RESULT_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST_VALIDATION/V1';
const AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work1-7-authority.json';
const ACTIVATION_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json';
const WORK0_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-evidence-root.json';
const WORK1_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work1-contract.json';
const BRANCH = 'codex/recover-m7-20260812';
const ACTIVATION_COMMIT = '6162798202bda37169917400b8fbebad8e1bdb9a';
const DEFERRED_GIT_PROOF = 'EXTERNAL_MILESTONE_ATTESTATION_NOT_INDEPENDENTLY_RECOMPUTED';
const EXECUTION_MANIFEST_VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
const WORK1_FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-finalise.mjs';
const WORK1_VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-validate.mjs';
const WORK1_RECOVERY_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs';
const WORK1_CORRECTION_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work1-correction-authority.json';
const CONTRACT_POLICY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-policy.json';
const FAMILY_PACKET_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-packet-set.json';
const EXECUTION_MANIFEST_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js';
const CANONICAL_BYTES_PATH = 'lib/canonical-v2/canonical-bytes.js';
const CORRECTION_AUTHORITY_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK1_CORRECTION_AUTHORITY/V1';
const CORRECTION_APPROVAL_ID = 'BEN-STAGE-2Y-M7-V2-WORK1-RECOVERY-2026-08-15';
const RECOVERY_TARGET_PATHS = [CONTRACT_POLICY_PATH, FAMILY_PACKET_PATH, WORK1_RECEIPT_PATH];
const ZERO_RECOVERY_EFFECTS = Object.freeze({
  system_temp_backup_directories: 0,
  work1_generated_output_replacements: 0,
  local_subprocess_runs: 0,
  repository_commits: 0,
  repository_pushes: 0,
  non_target_repository_writes: 0,
  model_calls: 0,
  network_reads: 0,
  network_writes: 0,
  database_writes: 0,
  product_writes: 0,
  m0_m4_mutations: 0,
  m8_actions: 0,
  serving_changes: 0,
  publication_changes: 0,
});
const CANDIDATE_ROOT_FOR_TESTS = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const ORIGIN_REF = `refs/remotes/origin/${BRANCH}`;
const ATTESTATION_CHECK_IDS = [
  'SINGLE_PARENT',
  'EXPECTED_PARENT',
  'EXPECTED_MESSAGE',
  'EXACT_TREE_DELTA',
  'RECEIPT_BLOB_IN_COMMIT',
  'ORIGIN_REF_EQUALS_COMMIT',
  'NO_SHALLOW_HISTORY',
  'NO_GRAFTS',
  'NO_LOOSE_REPLACE_REFS',
  'NO_PACKED_REPLACE_REFS',
  'FIXED_CWD_AND_GIT_ENVIRONMENT',
];
const ATTESTATION_COMMAND_CHECK_IDS = ATTESTATION_CHECK_IDS.slice(0, 6);
const CANDIDATE_VERIFICATION_CHECK_IDS = [
  'REGISTRATION_SELF_IDENTITY',
  'AUTHORITY_AND_WORK0_BINDINGS',
  'REQUIRED_COMPONENT_BINDINGS',
  'SIX_SEMANTIC_INPUT_BINDINGS',
  'TWENTY_FIVE_SUBTYPE_TREE_BINDINGS',
  'PREDECESSOR_AND_OUTPUT_SCOPE',
  'ZERO_PROHIBITED_EFFECTS',
];
const FAMILIES = [
  'ANTITRUST_REGULATORY', 'APPRAISAL_DISSENTERS_RIGHTS', 'CAPITALISATION',
  'CLOSING_CONDITIONS', 'CONSIDERATION', 'DIVIDENDS', 'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS', 'FINANCING_COVENANTS', 'GENERAL_COVENANTS',
  'GUARANTY_FINANCING_PARTY', 'INTERIM_OPERATING', 'KEY_DEFINED_TERMS',
  'MAE_DEFINITION', 'MATERIAL_CONTRACTS', 'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE', 'NO_OTHER_REPS_FRAUD', 'NO_SHOP', 'PROXY_MEETING',
  'REPRESENTATIONS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'TAX_MATTERS',
  'TERMINATION', 'TERMINATION_FEE',
];

let validatorPromise;
let recoveryPromise;

function loadValidator() {
  validatorPromise ??= import('../scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs');
  return validatorPromise;
}

function loadRecovery() {
  recoveryPromise ??= import('../scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs');
  return recoveryPromise;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function absolute(root, repositoryPath) {
  return path.join(root, ...repositoryPath.split('/'));
}

function writeBytes(root, repositoryPath, bytes) {
  const destination = absolute(root, repositoryPath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
}

function writeCanonical(root, repositoryPath, value) {
  writeBytes(root, repositoryPath, canonicalBytes(value));
}

function copyRepositoryFile(root, repositoryPath) {
  const destination = absolute(root, repositoryPath);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(REPO_ROOT, repositoryPath), destination);
}

function standardBinding(repositoryPath, bytes, schemaVersion, idField, id) {
  return {
    path: repositoryPath,
    schema_version: schemaVersion,
    record_id_field: idField,
    record_id: id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function parentAuthorityBinding(authority, bytes) {
  return {
    path: AUTHORITY_PATH,
    schema_version: authority.schema_version,
    authority_id: authority.authority_id,
    authority_digest: authority.authority_digest,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  };
}

function sealRecord(unsigned, idField) {
  return {
    ...unsigned,
    [idField]: contentId(unsigned.schema_version, unsigned),
  };
}

function sealManifest(value) {
  const unsigned = clone(value);
  delete unsigned.execution_manifest_id;
  delete unsigned.execution_manifest_digest;
  const execution_manifest_digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, execution_manifest_digest };
  return {
    ...withDigest,
    execution_manifest_id: contentId(SCHEMA, withDigest),
  };
}

function sealDigestRecord(value, digestField, idField) {
  const unsigned = clone(value);
  delete unsigned[digestField];
  delete unsigned[idField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return { ...withDigest, [idField]: contentId(value.schema_version, withDigest) };
}

function workNumber(work) {
  return Number(work.slice(4));
}

function manifestPath(work) {
  return `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work${workNumber(work)}-execution-manifest.json`;
}

function workReceiptPath(work) {
  return `evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work${workNumber(work)}-fixture.json`;
}

function milestoneAttestation({
  repoRoot,
  predecessorWork,
  commit,
  parentCommit,
  commitMessage,
  predecessorReceiptBinding,
  predecessorExecutionManifestBinding,
  predecessorValidationResult,
  exactCommitDeltaPaths,
  scope = 'STRUCTURAL_TEST_FIXTURE_NOT_GIT_PROOF',
}) {
  const results = {
    SINGLE_PARENT: `${commit} ${parentCommit}`,
    EXPECTED_PARENT: `${commit} ${parentCommit}`,
    EXPECTED_MESSAGE: commitMessage,
    EXACT_TREE_DELTA: exactCommitDeltaPaths,
    RECEIPT_BLOB_IN_COMMIT: predecessorReceiptBinding.git_blob_oid,
    ORIGIN_REF_EQUALS_COMMIT: commit,
  };
  const argv = {
    SINGLE_PARENT: ['git', 'rev-list', '--parents', '-n', '1', commit],
    EXPECTED_PARENT: ['git', 'rev-list', '--parents', '-n', '1', commit],
    EXPECTED_MESSAGE: ['git', 'log', '--format=%s', '-n', '1', commit],
    EXACT_TREE_DELTA: ['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', commit],
    RECEIPT_BLOB_IN_COMMIT: [
      'git', 'ls-tree', '-r', '--full-tree', commit, '--', predecessorReceiptBinding.path,
    ],
    ORIGIN_REF_EQUALS_COMMIT: ['git', 'rev-parse', ORIGIN_REF],
  };
  return {
    attestation_scope: scope,
    state: 'EXTERNAL_ORCHESTRATOR_ATTESTED_COMMITTED_AND_PUSHED',
    attestor: 'ROOT_ORCHESTRATOR',
    predecessor_work: predecessorWork,
    commit,
    parent_commit: parentCommit,
    branch: BRANCH,
    commit_message: commitMessage,
    origin_ref: ORIGIN_REF,
    predecessor_receipt_binding: clone(predecessorReceiptBinding),
    predecessor_execution_manifest_binding: predecessorExecutionManifestBinding,
    predecessor_validation_result: clone(predecessorValidationResult),
    exact_commit_delta_paths: [...exactCommitDeltaPaths],
    repository_observation: {
      repository_cwd: repoRoot,
      git_dir_unset: true,
      git_work_tree_unset: true,
      git_no_replace_objects: '1',
      shallow_history: false,
      grafts_present: false,
      loose_replace_refs_present: false,
      packed_replace_refs_present: false,
    },
    checks: ATTESTATION_CHECK_IDS.map((check_id) => ({
      check_id,
      state: 'EXTERNALLY_ATTESTED',
    })),
    observed_command_result_ledger: ATTESTATION_COMMAND_CHECK_IDS.map((check_id) => ({
      check_id,
      argv: argv[check_id],
      exit_code: 0,
      observed_result: results[check_id],
    })),
  };
}

function fixtureBinding(seed, repositoryPath, schemaVersion = null, idField = null) {
  const bytes = Buffer.from(`${seed}\n`, 'utf8');
  return {
    path: repositoryPath,
    schema_version: schemaVersion,
    record_id_field: idField,
    record_id: idField === null ? null : sha256Hex(`id:${seed}`),
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function predecessorValidationResult(work, binding, fixture) {
  if (work === 'WORK1') return clone(fixture.work1ValidationResult);
  const number = workNumber(work);
  return {
    schema_version: `STAGE_2Y_M7_V2_REPAIR_WORK${number}_VALIDATION/V1`,
    status: `PASS_WORK${number}`,
    work,
    receipt_id_field: binding.record_id_field,
    receipt_id: binding.record_id,
  };
}

function runFixtureGit(root, args) {
  const environment = {
    ...process.env,
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_AUTHOR_NAME: 'M7 V2 Test',
    GIT_AUTHOR_EMAIL: 'm7-v2-test@example.invalid',
    GIT_COMMITTER_NAME: 'M7 V2 Test',
    GIT_COMMITTER_EMAIL: 'm7-v2-test@example.invalid',
  };
  delete environment.GIT_DIR;
  delete environment.GIT_WORK_TREE;
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: environment,
  }).trimEnd();
}

function deriveRealMilestone(fixture) {
  const root = fixture.root;
  runFixtureGit(root, ['init']);
  runFixtureGit(root, ['add', '--', AUTHORITY_PATH, ACTIVATION_PATH, WORK0_PATH]);
  runFixtureGit(root, ['commit', '-m', 'fixture']);
  const expectedPaths = fixture.authority.command_policy.exact_work1_commit_argv[0].slice(3);
  for (const repositoryPath of expectedPaths) {
    writeBytes(
      root,
      repositoryPath,
      repositoryPath === WORK1_RECEIPT_PATH
        ? fixture.work1Bytes : Buffer.from(`${repositoryPath}\n`, 'utf8'),
    );
  }
  runFixtureGit(root, ['add', '--', ...expectedPaths]);
  runFixtureGit(root, ['commit', '-m', 'fixture']);
  const commit = runFixtureGit(root, ['rev-parse', 'HEAD']);
  const commitObject = runFixtureGit(root, ['cat-file', '-p', commit]);
  const headerLines = commitObject.split('\n\n', 1)[0].split('\n');
  const parentLines = headerLines.filter((line) => line.startsWith('parent '));
  assert.equal(parentLines.length, 1);
  const parentCommit = parentLines[0].slice('parent '.length);
  const commitMessage = commitObject.slice(commitObject.indexOf('\n\n') + 2).trim();
  const singleParentObservation = `${commit} ${parentCommit}`;
  const expectedParentObservation = singleParentObservation;
  const exactCommitDeltaPaths = runFixtureGit(
    root,
    ['diff-tree', '--no-commit-id', '--name-only', '-r', commit],
  ).split('\n').filter(Boolean);
  const receiptTreeLine = runFixtureGit(
    root,
    ['ls-tree', '-r', '--full-tree', commit, '--', WORK1_RECEIPT_PATH],
  );
  const originPath = path.join(root, '.git', 'refs', 'remotes', 'origin', ...BRANCH.split('/'));
  mkdirSync(path.dirname(originPath), { recursive: true });
  writeFileSync(originPath, `${commit}\n`);
  const originCommit = readFileSync(originPath, 'utf8').trim();
  const packedRefsPath = path.join(root, '.git', 'packed-refs');
  const packedRefs = existsSync(packedRefsPath) ? readFileSync(packedRefsPath, 'utf8') : '';
  return {
    commit,
    parentCommit,
    commitMessage,
    exactCommitDeltaPaths,
    receiptBlobOid: receiptTreeLine.split(/\s+/)[2],
    originCommit,
    singleParentObservation,
    expectedParentObservation,
    repositoryObservation: {
      shallow_history: existsSync(path.join(root, '.git', 'shallow')),
      grafts_present: existsSync(path.join(root, '.git', 'info', 'grafts')),
      loose_replace_refs_present: existsSync(path.join(root, '.git', 'refs', 'replace')),
      packed_replace_refs_present: /\srefs\/replace\//.test(packedRefs),
    },
  };
}

function makeFixture(t) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'm7-v2-work-manifest-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  copyRepositoryFile(root, AUTHORITY_PATH);
  copyRepositoryFile(root, ACTIVATION_PATH);
  copyRepositoryFile(root, WORK0_PATH);
  const authorityBytes = readFileSync(absolute(root, AUTHORITY_PATH));
  const authority = JSON.parse(authorityBytes);
  const activationBytes = readFileSync(absolute(root, ACTIVATION_PATH));
  const activation = JSON.parse(activationBytes);
  const work0Bytes = readFileSync(absolute(root, WORK0_PATH));
  const work0 = JSON.parse(work0Bytes);
  const work1Receipt = sealDigestRecord({
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1',
    stage: 'M7_V2_REPAIR_WORK1',
    state: 'PASS_WORK1_CONTRACTS',
    status: 'PASS',
    activation_commit_binding: {},
    work0_evidence_root_binding: {},
    work1_7_authority_binding: {},
    activation_receipt_binding: {},
    contract_policy_binding: { record_id: 'c'.repeat(64) },
    family_packet_set_binding: { record_id: 'f'.repeat(64) },
    artifact_bindings: [],
    artifact_set_digest: sha256Hex('fixture-artifacts'),
    command_execution_ledger: [],
    drafting_command_audit: [],
    combined_test_result: { status: 'PASS' },
    repository_precondition: { status: 'PASS' },
    counts: { fixture: 1 },
    checks: [{ check_id: 'FIXTURE', status: 'PASS' }],
    effects: { files_written: 3 },
    next_work: {
      work2_predecessor_pass_effective_only_after_exact_commit_push_origin_proof: true,
      work2_start_state_at_receipt_write: 'LOCKED_PENDING_WORK1_MILESTONE_PROOF',
    },
  }, 'work1_contract_receipt_digest', 'work1_contract_receipt_id');
  writeCanonical(root, WORK1_RECEIPT_PATH, work1Receipt);
  const work1Bytes = readFileSync(absolute(root, WORK1_RECEIPT_PATH));
  const work1ValidationResult = {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_VALIDATION/V1',
    status: 'PASS_WORK1_CONTRACTS',
    contract_policy_id: work1Receipt.contract_policy_binding.record_id,
    family_packet_set_id: work1Receipt.family_packet_set_binding.record_id,
    work1_contract_receipt_id: work1Receipt.work1_contract_receipt_id,
    counts: clone(work1Receipt.counts),
    effects: clone(work1Receipt.effects),
  };
  return {
    root,
    authority,
    authorityBytes,
    activation,
    activationBytes,
    work0,
    work0Bytes,
    work1Receipt,
    work1Bytes,
    work1ValidationResult,
  };
}

function allowedEffects(authority) {
  return {
    deterministic_local_reads: true,
    lawyer_review_packet_writes: false,
    local_commits: 1,
    named_repository_writes: true,
    repository_pushes: {
      branch: BRANCH,
      maximum: 1,
      remote: 'origin',
    },
    temporary_test_writes: true,
    v2_shadow_analysis_runs: false,
    v2_shadow_projection_runs: false,
  };
}

function baseWork2Manifest(fixture) {
  const work = 'WORK2';
  const currentManifestPath = manifestPath(work);
  const receiptPath = workReceiptPath(work);
  const compilerPath = 'lib/canonical-v2/m7-v2-compiler.js';
  const finaliserPath = 'scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs';
  const validatorPath = 'scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs';
  const testPath = 'tests/stage-2y-structure-m7-v2-repair-work2.test.js';
  const writePaths = [compilerPath, finaliserPath, validatorPath, testPath, receiptPath];
  const activationBinding = standardBinding(
    ACTIVATION_PATH,
    fixture.activationBytes,
    fixture.activation.schema_version,
    'activation_receipt_id',
    fixture.activation.activation_receipt_id,
  );
  const predecessorBinding = standardBinding(
    WORK1_RECEIPT_PATH,
    fixture.work1Bytes,
    fixture.work1Receipt.schema_version,
    'work1_contract_receipt_id',
    fixture.work1Receipt.work1_contract_receipt_id,
  );
  const commit = '1'.repeat(40);
  const commitMessage = 'Define M7 V2 repair Work 1 contracts';
  const exactCommitDeltaPaths = fixture.authority.command_policy.exact_work1_commit_argv[0]
    .slice(3).sort();
  return sealManifest({
    schema_version: SCHEMA,
    work,
    state: 'PRE_WORK_BOOTSTRAP_ONLY',
    parent_authority_binding: parentAuthorityBinding(fixture.authority, fixture.authorityBytes),
    predecessor_receipt_binding: predecessorBinding,
    base_tip_binding: {
      commit,
      branch: BRANCH,
      parent_commit: ACTIVATION_COMMIT,
      commit_message: commitMessage,
      milestone_attestation: milestoneAttestation({
        repoRoot: fixture.root,
        predecessorWork: 'WORK1',
        commit,
        parentCommit: ACTIVATION_COMMIT,
        commitMessage,
        predecessorReceiptBinding: predecessorBinding,
        predecessorExecutionManifestBinding: null,
        predecessorValidationResult: fixture.work1ValidationResult,
        exactCommitDeltaPaths,
      }),
    },
    permitted_read_paths: [
      currentManifestPath,
      AUTHORITY_PATH,
      ACTIVATION_PATH,
      WORK1_RECEIPT_PATH,
    ].sort(),
    permitted_write_paths: [...writePaths].sort(),
    exact_argv_with_run_limits: [
      { argv: ['node', EXECUTION_MANIFEST_VALIDATOR_PATH, currentManifestPath], max_runs: 3 },
      { argv: ['node', '--check', compilerPath], max_runs: 20 },
      { argv: ['node', '--check', finaliserPath], max_runs: 20 },
      { argv: ['node', '--check', validatorPath], max_runs: 20 },
      { argv: ['node', '--test', testPath], max_runs: 30 },
      { argv: ['node', finaliserPath], max_runs: 1 },
      { argv: ['node', validatorPath], max_runs: 3 },
    ],
    exact_git_commit_and_push_argv: [
      ['git', 'add', '--', ...[currentManifestPath, ...writePaths].sort()],
      ['git', 'commit', '-m', 'Implement M7 V2 repair Work 2'],
      ['git', 'push', 'origin', BRANCH],
    ],
    allowed_effects: allowedEffects(fixture.authority),
    prohibited_effects: clone(fixture.authority.prohibited_effects),
    stop_conditions: clone(fixture.authority.stop_conditions),
    activation_receipt_binding: activationBinding,
    activation_commit_binding: {
      commit: ACTIVATION_COMMIT,
      parent_commit: fixture.authority.base_commit,
      branch: BRANCH,
      activation_receipt_id: fixture.activation.activation_receipt_id,
    },
    candidate_registration_binding: null,
    work_receipt_path: receiptPath,
    success_conditions: [DEFERRED_GIT_PROOF, 'WORK2_RECEIPT_PASS'],
  });
}

function writeManifest(fixture, manifest) {
  const repositoryPath = manifestPath(manifest.work);
  writeCanonical(fixture.root, repositoryPath, manifest);
  return repositoryPath;
}

function restamp(manifest) {
  return sealManifest(manifest);
}

async function assertCode(validator, fn, code) {
  await assert.rejects(fn, (error) => {
    assert.ok(error instanceof validator.WorkExecutionManifestValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

function writeFixtureRecord(root, repositoryPath, schemaVersion, idField, body = {}) {
  const record = sealRecord({ schema_version: schemaVersion, ...body }, idField);
  writeCanonical(root, repositoryPath, record);
  return { path: repositoryPath, schema_version: schemaVersion, record_id_field: idField };
}

async function makeCandidate(fixture, seed = 'candidate-a') {
  const builder = await import('../scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs');
  const verifier = await import('../scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs');
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
    ],
  };
  for (const repositoryPath of [
    code.compiler, code.deterministic_generator, code.contract_validator, code.projector,
    ...code.runners, ...code.tests,
  ]) writeBytes(fixture.root, repositoryPath, Buffer.from(`fixture:${seed}:${repositoryPath}\n`));
  copyRepositoryFile(fixture.root, code.independent_verifier);
  const semantic_inputs = [
    ['BASE_ANALYSIS_SET', 'AGREEMENT_ANALYSIS_SET/V1', 'analysis_set_id'],
    ['AGREEMENT_INDEX_SET', 'AGREEMENT_INDEX_SET/V1', 'agreement_index_set_id'],
    ['CONTEXT_COMPILATION_SET', 'CONTEXT_COMPILATION_SET/V1', 'context_compilation_set_id'],
    ['APPROVED_FAMILY_PACKET_SET', 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1', 'family_packet_set_id'],
    ['APPROVED_FAMILY_PROFILE_SET', 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1', 'family_profile_set_id'],
    ['APPROVED_STRUCTURE_DISPOSITION_SET', 'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1', 'structure_disposition_set_id'],
  ].map(([input_role, schemaVersion, idField]) => ({
    input_role,
    ...writeFixtureRecord(
      fixture.root,
      `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/inputs/${seed}-${input_role.toLowerCase()}.json`,
      schemaVersion,
      idField,
      { state: 'FIXTURE' },
    ),
  }));
  const subtype_trees = FAMILIES.map((family_key) => ({
    family_key,
    ...writeFixtureRecord(
      fixture.root,
      `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/profiles/${seed}-${family_key}.subtype-tree.json`,
      'STAGE_2Y_M7_V2_REPAIR_SUBTYPE_TREE/V1',
      'subtype_tree_id',
      { family_key, state: 'TREE_OUTPUT_COMPLETE' },
    ),
  }));
  const view_policy = writeFixtureRecord(
    fixture.root,
    `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/policies/${seed}-view-policy.json`,
    'STAGE_2Y_M7_V2_VIEW_POLICY/V1',
    'view_policy_id',
    { state: 'APPROVED' },
  );
  const allowed_output_root =
    `evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/${seed}`;
  mkdirSync(absolute(fixture.root, allowed_output_root), { recursive: true });
  const written = builder.registerCandidate({
    repoRoot: fixture.root,
    specification: {
      code,
      semantic_inputs,
      subtype_trees,
      view_policy,
      predecessor_receipts: [{
        work: 'WORK1',
        path: WORK1_RECEIPT_PATH,
        schema_version: fixture.work1Receipt.schema_version,
        record_id_field: 'work1_contract_receipt_id',
      }],
      allowed_output_root,
    },
    write: true,
  });
  const independentVerification = verifier.verifyRegisteredCandidate({
    repoRoot: fixture.root,
    registrationPath: written.registration_path,
  });
  return {
    record: written.registration,
    repositoryPath: written.registration_path,
    binding: written.binding,
    wrapper: {
      registration_binding: written.binding,
      independent_verification: independentVerification,
    },
  };
}

function restampCandidateVariant(fixture, candidate, mutate) {
  const unsigned = clone(candidate.record);
  delete unsigned.candidate_registration_id;
  mutate(unsigned);
  const record = sealRecord(unsigned, 'candidate_registration_id');
  const repositoryPath =
    `${CANDIDATE_ROOT_FOR_TESTS}/${record.candidate_registration_id}.json`;
  writeCanonical(fixture.root, repositoryPath, record);
  const bytes = readFileSync(absolute(fixture.root, repositoryPath));
  const binding = standardBinding(
    repositoryPath,
    bytes,
    record.schema_version,
    'candidate_registration_id',
    record.candidate_registration_id,
  );
  const verificationUnsigned = clone(candidate.wrapper.independent_verification);
  delete verificationUnsigned.verification_id;
  verificationUnsigned.candidate_registration_id = record.candidate_registration_id;
  verificationUnsigned.registration_binding = binding;
  verificationUnsigned.counts = clone(record.counts);
  const independentVerification = sealRecord(verificationUnsigned, 'verification_id');
  return {
    record,
    repositoryPath,
    binding,
    wrapper: { registration_binding: binding, independent_verification: independentVerification },
  };
}

function manifestWithCandidate(manifest, oldCandidatePath, candidate) {
  const selected = clone(manifest);
  selected.candidate_registration_binding = candidate.wrapper;
  selected.permitted_read_paths = selected.permitted_read_paths
    .filter((repositoryPath) => repositoryPath !== oldCandidatePath);
  selected.permitted_read_paths.push(candidate.repositoryPath);
  selected.permitted_read_paths.sort();
  return restamp(selected);
}

function candidateReadPaths(candidate) {
  const record = candidate.record;
  return [...new Set([
    candidate.repositoryPath,
    record.parent_authority_binding.path,
    record.activation_receipt_binding.path,
    record.work0_evidence_root_binding.path,
    record.code_bindings.compiler.path,
    record.code_bindings.deterministic_generator.path,
    record.code_bindings.contract_validator.path,
    record.code_bindings.projector.path,
    record.code_bindings.independent_verifier.path,
    ...record.code_bindings.runners.map((binding) => binding.path),
    ...record.code_bindings.tests.map((binding) => binding.path),
    ...record.semantic_input_bindings.map((entry) => entry.binding.path),
    record.family_profile_set_binding.path,
    ...record.subtype_tree_bindings.map((entry) => entry.binding.path),
    record.structure_disposition_set_binding.path,
    record.view_policy_binding.path,
    ...record.predecessor_receipt_bindings.map((entry) => entry.binding.path),
    ...record.predecessor_receipt_bindings
      .filter((entry) => entry.work !== 'WORK1')
      .map((entry) => manifestPath(entry.work)),
  ])].sort();
}

function priorManifestFor(fixture, work, candidateBinding) {
  const number = workNumber(work);
  const previousWork = `WORK${number - 1}`;
  const previous = baseWork2Manifest(fixture);
  previous.work = previousWork;
  previous.state = 'PRE_WORK_BOOTSTRAP_ONLY';
  previous.work_receipt_path = workReceiptPath(previousWork);
  previous.candidate_registration_binding = candidateBinding;
  previous.base_tip_binding = {
    commit: `${number - 1}`.repeat(40).slice(0, 40),
    branch: BRANCH,
    parent_commit: `${number - 2}`.repeat(40).slice(0, 40),
    commit_message: `Implement M7 V2 repair Work ${number - 2}`,
    milestone_attestation: milestoneAttestation({
      repoRoot: fixture.root,
      predecessorWork: `WORK${number - 2}`,
      commit: `${number - 1}`.repeat(40).slice(0, 40),
      parentCommit: `${number - 2}`.repeat(40).slice(0, 40),
      commitMessage: `Implement M7 V2 repair Work ${number - 2}`,
      predecessorReceiptBinding: previous.predecessor_receipt_binding,
      predecessorExecutionManifestBinding: null,
      predecessorValidationResult: predecessorValidationResult(
        `WORK${number - 2}`,
        previous.predecessor_receipt_binding,
        fixture,
      ),
      exactCommitDeltaPaths: ['fixture-prior-path'],
    }),
  };
  previous.exact_git_commit_and_push_argv[1] = [
    'git', 'commit', '-m', `Implement M7 V2 repair Work ${number - 1}`,
  ];
  previous.permitted_read_paths = [
    manifestPath(previousWork), AUTHORITY_PATH, ACTIVATION_PATH, WORK1_RECEIPT_PATH,
  ].sort();
  return restamp(previous);
}

function recoveryRecordIdField(record) {
  return ({
    [CORRECTION_AUTHORITY_SCHEMA]: 'correction_authority_id',
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1': 'authority_id',
    'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1':
      'activation_receipt_id',
    'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1': 'evidence_root_id',
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_POLICY/V1': 'contract_policy_id',
    'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1': 'family_packet_set_id',
    'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1': 'work1_contract_receipt_id',
  })[record.schema_version] ?? Object.keys(record).find(
    (key) => key.endsWith('_id') && typeof record[key] === 'string',
  ) ?? null;
}

function recoveryBinding(root, repositoryPath) {
  const bytes = readFileSync(absolute(root, repositoryPath));
  let schemaVersion = null;
  let recordIdField = null;
  let recordId = null;
  if (repositoryPath.endsWith('.json')) {
    const record = JSON.parse(bytes);
    schemaVersion = record.schema_version;
    recordIdField = recoveryRecordIdField(record);
    recordId = recordIdField === null ? null : record[recordIdField];
  }
  return standardBinding(
    repositoryPath,
    bytes,
    schemaVersion,
    recordIdField,
    recordId,
  );
}

function recoveryFinaliserSource(staleReceipt, outcome) {
  return `#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const authorityPath = ${JSON.stringify(WORK1_CORRECTION_AUTHORITY_PATH)};
const contractPath = ${JSON.stringify(CONTRACT_POLICY_PATH)};
const familyPath = ${JSON.stringify(FAMILY_PACKET_PATH)};
const receiptPath = ${JSON.stringify(WORK1_RECEIPT_PATH)};
const finaliserPath = ${JSON.stringify(WORK1_FINALISER_PATH)};
const validatorPath = ${JSON.stringify(WORK1_VALIDATOR_PATH)};
const protectedPath = ${JSON.stringify(WORK0_PATH)};
const staleReceipt = ${JSON.stringify(staleReceipt)};
const outcome = ${JSON.stringify(outcome)};

if (process.env.NODE_OPTIONS !== undefined || process.env.NODE_PATH !== undefined) {
  process.stderr.write('fixture finaliser inherited Node injection environment\\n');
  process.exit(40);
}

function absolute(repositoryPath) {
  return path.join(process.cwd(), ...repositoryPath.split('/'));
}

function canonicalBytes(value) {
  return Buffer.from(canonicalJson(value) + '\\n', 'utf8');
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + '\\0', 'utf8'))
    .update(bytes)
    .digest('hex');
}

function binding(repositoryPath, bytes) {
  let schemaVersion = null;
  let recordIdField = null;
  let recordId = null;
  if (repositoryPath.endsWith('.json')) {
    const record = JSON.parse(bytes);
    schemaVersion = record.schema_version;
    recordIdField = ({
      'STAGE_2Y_M7_V2_REPAIR_WORK1_CORRECTION_AUTHORITY/V1': 'correction_authority_id',
      'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY/V1': 'authority_id',
      'STAGE_2Y_M7_V2_REPAIR_WORK1_7_AUTHORITY_ACTIVATION_RECEIPT/V1':
        'activation_receipt_id',
      'STAGE_2Y_M7_V2_REPAIR_EVIDENCE_ROOT_RECEIPT/V1': 'evidence_root_id',
      'STAGE_2Y_M7_V2_REPAIR_CONTRACT_POLICY/V1': 'contract_policy_id',
      'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1': 'family_packet_set_id',
      'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1': 'work1_contract_receipt_id',
    })[record.schema_version] ?? Object.keys(record).find(
      (key) => key.endsWith('_id') && typeof record[key] === 'string',
    ) ?? null;
    recordId = recordIdField === null ? null : record[recordIdField];
  }
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

function sealDigestRecord(record, digestField, idField) {
  const unsigned = JSON.parse(JSON.stringify(record));
  delete unsigned[digestField];
  delete unsigned[idField];
  const digest = sha256Hex(canonicalJson(unsigned));
  const withDigest = { ...unsigned, [digestField]: digest };
  return { ...withDigest, [idField]: contentId(record.schema_version, withDigest) };
}

function writeExclusive(repositoryPath, bytes) {
  const destination = absolute(repositoryPath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, bytes, { flag: 'wx' });
}

const authorityBytes = readFileSync(absolute(authorityPath));
const authority = JSON.parse(authorityBytes);
const contract = sealDigestRecord({
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_POLICY/V1',
  stage: 'M7_V2_REPAIR_WORK1',
  state: 'RECOVERED_FIXTURE',
}, 'contract_policy_digest', 'contract_policy_id');
const family = sealDigestRecord({
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1',
  stage: 'M7_V2_REPAIR_WORK1',
  state: 'RECOVERED_FIXTURE',
}, 'family_packet_set_digest', 'family_packet_set_id');
const contractBytes = canonicalBytes(contract);
const familyBytes = canonicalBytes(family);
const generated = new Map([
  [contractPath, contractBytes],
  [familyPath, familyBytes],
]);
const artifactBindings = authority.effective_work1_paths
  .filter((repositoryPath) => repositoryPath !== receiptPath)
  .map((repositoryPath) => binding(
    repositoryPath,
    generated.get(repositoryPath) ?? readFileSync(absolute(repositoryPath)),
  ));
const receipt = JSON.parse(JSON.stringify(staleReceipt));
receipt.contract_policy_binding = binding(contractPath, contractBytes);
receipt.family_packet_set_binding = binding(familyPath, familyBytes);
receipt.artifact_bindings = artifactBindings;
receipt.artifact_set_digest = sha256Hex(canonicalJson(artifactBindings));
receipt.command_execution_ledger = [
  ...receipt.command_execution_ledger.slice(0, 7),
  {
    argv: ['node', finaliserPath],
    run_count: 2,
    state: 'CUMULATIVE_ONE_INITIAL_ONE_CORRECTION_WRITES_THIS_RECEIPT',
  },
  {
    argv: ['node', validatorPath],
    run_count: 2,
    state: 'CUMULATIVE_ONE_FAILED_ONE_REQUIRED_AFTER_THIS_RECEIPT',
  },
  {
    argv: authority.command_extension.recovery_argv,
    run_count: 1,
    state: 'RUNNER_WRITES_THIS_RECEIPT_AND_COMPLETES_AFTER_VALIDATOR_PASS',
  },
];
const parentCommitArgv = receipt.repository_precondition.required_commit_and_push.exact_argv;
receipt.repository_precondition = {
  ...receipt.repository_precondition,
  observed_before_receipt: {
    ...receipt.repository_precondition.observed_before_receipt,
    worktree_delta_paths: authority.effective_work1_paths.filter(
      (repositoryPath) => ![contractPath, familyPath, receiptPath].includes(repositoryPath),
    ),
    generated_paths_absent: [contractPath, familyPath, receiptPath],
    authorised_delta_paths: authority.effective_work1_paths,
  },
  required_after_receipt: {
    ...receipt.repository_precondition.required_after_receipt,
    worktree_delta_paths: authority.effective_work1_paths,
  },
  required_commit_and_push: {
    ...receipt.repository_precondition.required_commit_and_push,
    exact_argv: [
      ['git', 'add', '--', ...authority.effective_work1_paths],
      parentCommitArgv[1],
      parentCommitArgv[2],
    ],
    commit_delta_paths: authority.effective_work1_paths,
  },
  recovery: {
    correction_authority_binding: binding(authorityPath, authorityBytes),
    superseded_receipt_binding: authority.stale_output_bindings[2],
    recovery_argv: authority.command_extension.recovery_argv,
    recovery_run_count: 1,
    finaliser_cumulative_run_count: 2,
    validator_cumulative_run_count: 2,
    replaced_output_paths: [contractPath, familyPath, receiptPath],
    backup_state: 'REMOVED_AFTER_VALIDATOR_PASS',
    rollback_state: 'AVAILABLE_DURING_TRANSACTION_ONLY',
  },
};
const sealedReceipt = sealDigestRecord(
  receipt,
  'work1_contract_receipt_digest',
  'work1_contract_receipt_id',
);
const receiptBytes = canonicalBytes(sealedReceipt);
generated.set(receiptPath, receiptBytes);

writeExclusive(contractPath, contractBytes);
if (outcome === 'FAIL') {
  process.stderr.write('fixture finaliser failure\\n');
  process.exit(41);
}
writeExclusive(familyPath, familyBytes);
writeExclusive(receiptPath, receiptBytes);
if (outcome === 'EXTRA_EFFECT') {
  writeExclusive(
    'evidence/canonical-v2/stage-2y-structure-migration/control/unapproved-fourth-output.json',
    Buffer.from('{"unexpected":true}\\n', 'utf8'),
  );
}
if (outcome === 'PROTECTED_EFFECT') {
  writeFileSync(
    absolute(protectedPath),
    Buffer.concat([readFileSync(absolute(protectedPath)), Buffer.from(' ', 'utf8')]),
  );
}
if (outcome === 'IGNORED_FILE_EFFECT') {
  writeExclusive(
    'ignored-recovery-effect.json',
    Buffer.from('{"unexpected":true}\\n', 'utf8'),
  );
}
if (outcome === 'EMPTY_DIRECTORY_EFFECT') {
  mkdirSync(absolute('unapproved-empty-directory'));
}
process.stdout.write(JSON.stringify({
  status: 'PASS_WORK1_FINALISATION',
  contract_policy_id: contract.contract_policy_id,
  family_packet_set_id: family.family_packet_set_id,
  work1_contract_receipt_id: sealedReceipt.work1_contract_receipt_id,
  outputs: [...generated].map(([repositoryPath, bytes]) => ({
    path: repositoryPath,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
  })),
}) + '\\n');
`;
}

function recoveryValidatorSource(outcome) {
  return `#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const authorityPath = ${JSON.stringify(WORK1_CORRECTION_AUTHORITY_PATH)};
const receiptPath = ${JSON.stringify(WORK1_RECEIPT_PATH)};
const validatorPath = ${JSON.stringify(WORK1_VALIDATOR_PATH)};
const outcome = ${JSON.stringify(outcome)};

if (process.env.NODE_OPTIONS !== undefined || process.env.NODE_PATH !== undefined) {
  process.stderr.write('fixture validator inherited Node injection environment\\n');
  process.exit(40);
}

function absolute(repositoryPath) {
  return path.join(process.cwd(), ...repositoryPath.split('/'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

if (outcome === 'FAIL') {
  process.stderr.write('fixture validator failure\\n');
  process.exit(42);
}
const authority = JSON.parse(readFileSync(absolute(authorityPath)));
const receipt = JSON.parse(readFileSync(absolute(receiptPath)));
const recovery = receipt.repository_precondition?.recovery;
if (recovery?.correction_authority_binding?.record_id !== authority.correction_authority_id
  || recovery?.superseded_receipt_binding?.record_id
    !== authority.stale_output_bindings[2].record_id
  || recovery?.recovery_run_count !== 1
  || recovery?.finaliser_cumulative_run_count !== 2
  || recovery?.validator_cumulative_run_count !== 2) {
  process.stderr.write('fixture recovery receipt drift\\n');
  process.exit(43);
}
const validatorBytes = readFileSync(absolute(validatorPath));
const validatorBinding = receipt.artifact_bindings.find(
  (entry) => entry.path === validatorPath,
);
if (validatorBinding?.sha256 !== sha256(validatorBytes)
  || validatorBinding?.byte_length !== validatorBytes.length) {
  process.stderr.write('fixture validator binding drift\\n');
  process.exit(44);
}
process.stdout.write(JSON.stringify({
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_VALIDATION/V1',
  status: 'PASS_WORK1_CONTRACTS',
  work1_contract_receipt_id: receipt.work1_contract_receipt_id,
  effects: { files_written: 0 },
}) + '\\n');
`;
}

function buildCorrectionAuthority(root, parentAuthority, parentBytes, activation, activationBytes) {
  const originalPaths = parentAuthority.command_policy.work1_exact_changed_paths;
  assert.equal(originalPaths.length, 13);
  const exactPathExtension = [WORK1_CORRECTION_AUTHORITY_PATH, WORK1_RECOVERY_PATH];
  const effectivePaths = [...originalPaths, ...exactPathExtension];
  assert.equal(new Set(effectivePaths).size, 15);
  const unsigned = {
    schema_version: CORRECTION_AUTHORITY_SCHEMA,
    stage: 'M7_V2_REPAIR_WORK1_CORRECTION',
    authority_state: 'BEN_AUTHORISED_SINGLE_WORK1_RECOVERY',
    approved_on: '2026-08-15',
    approver: 'BEN_GOODCHILD',
    ben_approval_id: CORRECTION_APPROVAL_ID,
    approval_text: 'Authorise Work1 recovery',
    discovered_defect:
      'WORK1_VALIDATOR_STATIC_BOUNDARY_FS_MEMBER_ACCESS_FALSE_POSITIVE_AFTER_FIRST_FINALISATION',
    parent_authority_binding: standardBinding(
      AUTHORITY_PATH,
      parentBytes,
      parentAuthority.schema_version,
      'authority_id',
      parentAuthority.authority_id,
    ),
    activation_receipt_binding: standardBinding(
      ACTIVATION_PATH,
      activationBytes,
      activation.schema_version,
      'activation_receipt_id',
      activation.activation_receipt_id,
    ),
    stale_output_bindings: RECOVERY_TARGET_PATHS.map(
      (repositoryPath) => recoveryBinding(root, repositoryPath),
    ),
    executable_bindings: [
      WORK1_FINALISER_PATH,
      WORK1_VALIDATOR_PATH,
      WORK1_RECOVERY_PATH,
      EXECUTION_MANIFEST_TEST_PATH,
    ].map((repositoryPath) => recoveryBinding(root, repositoryPath)),
    authorised_scope: [
      'PRESERVE_PARENT_AUTHORITY_AND_ACTIVATION_BYTES',
      'REPLACE_ONLY_THE_THREE_UNCOMMITTED_WORK1_GENERATED_OUTPUTS',
      'RUN_WORK1_FINALISER_EXACTLY_ONCE_MORE',
      'RUN_WORK1_VALIDATOR_EXACTLY_ONCE_IN_RECOVERY',
      'COMMIT_AND_PUSH_THE_EFFECTIVE_FIFTEEN_PATH_WORK1_DELTA_ONLY',
    ],
    exact_path_extension: exactPathExtension,
    effective_work1_paths: effectivePaths,
    command_extension: {
      recovery_argv: [
        'node', WORK1_RECOVERY_PATH, '--authority', WORK1_CORRECTION_AUTHORITY_PATH,
      ],
      recovery_run_limit: 1,
      additional_work1_finaliser_runs: 1,
      work1_finaliser_cumulative_run_count: 2,
      work1_validator_cumulative_run_count: 2,
      parent_work1_validator_limit: 3,
      additional_git_add_commit_push_runs: 0,
    },
    allowed_effects: {
      deterministic_local_reads: true,
      system_temp_backup_directories: 1,
      work1_generated_output_replacements: 3,
      local_subprocess_runs: 5,
      repository_commits: 0,
      repository_pushes: 0,
    },
    prohibited_effects: {
      non_target_repository_writes: 0,
      model_calls: 0,
      network_reads: 0,
      network_writes: 0,
      database_writes: 0,
      product_writes: 0,
      m0_m4_mutations: 0,
      m8_actions: 0,
      serving_changes: 0,
      publication_changes: 0,
    },
    rollback: {
      backup_root: 'SYSTEM_TEMP_MKDTEMP_ONLY',
      backup_mode: 'EXACT_BYTES_BEFORE_ANY_REMOVAL',
      restore_on_finaliser_or_validator_failure: true,
      remove_only_new_outputs_before_restore: true,
      retain_backup_on_restore_failure: true,
      second_attempt: 'REJECT_BEFORE_MUTATION',
      protected_paths_never_removed: [WORK0_PATH, AUTHORITY_PATH, ACTIVATION_PATH],
    },
    success_conditions: [
      'THREE_OUTPUTS_REGENERATED',
      'VALIDATOR_PASS',
      'RECEIPT_BINDS_CURRENT_FIFTEEN_PATH_SET',
      'PRIOR_RECEIPT_LINEAGE_BOUND',
      'BACKUP_REMOVED',
      'ZERO_EXTERNAL_EFFECTS',
    ],
  };
  return sealRecord(unsigned, 'correction_authority_id');
}

function makeRecoveryFixture(t, {
  finaliserOutcome = 'PASS',
  validatorOutcome = 'PASS',
} = {}) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'm7-v2-work1-recovery-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const repositoryPath of [AUTHORITY_PATH, ACTIVATION_PATH, WORK0_PATH, CANONICAL_BYTES_PATH]) {
    copyRepositoryFile(root, repositoryPath);
  }
  runFixtureGit(root, ['init']);
  writeFileSync(
    path.join(root, '.git', 'info', 'exclude'),
    'ignored-recovery-effect.json\n',
  );
  runFixtureGit(root, ['add', '--', AUTHORITY_PATH, ACTIVATION_PATH, WORK0_PATH, CANONICAL_BYTES_PATH]);
  runFixtureGit(root, ['commit', '-m', 'fixture recovery baseline']);

  const parentBytes = readFileSync(absolute(root, AUTHORITY_PATH));
  const parentAuthority = JSON.parse(parentBytes);
  const activationBytes = readFileSync(absolute(root, ACTIVATION_PATH));
  const activation = JSON.parse(activationBytes);
  const originalPaths = parentAuthority.command_policy.work1_exact_changed_paths;
  for (const repositoryPath of originalPaths) {
    if (RECOVERY_TARGET_PATHS.includes(repositoryPath)
      || repositoryPath === WORK1_FINALISER_PATH
      || repositoryPath === WORK1_VALIDATOR_PATH
      || repositoryPath === EXECUTION_MANIFEST_TEST_PATH) continue;
    copyRepositoryFile(root, repositoryPath);
  }
  for (const repositoryPath of RECOVERY_TARGET_PATHS) copyRepositoryFile(root, repositoryPath);
  const staleReceipt = JSON.parse(readFileSync(absolute(root, WORK1_RECEIPT_PATH)));
  writeBytes(
    root,
    WORK1_FINALISER_PATH,
    Buffer.from(recoveryFinaliserSource(staleReceipt, finaliserOutcome), 'utf8'),
  );
  writeBytes(
    root,
    WORK1_VALIDATOR_PATH,
    Buffer.from(recoveryValidatorSource(validatorOutcome), 'utf8'),
  );
  copyRepositoryFile(root, EXECUTION_MANIFEST_TEST_PATH);
  copyRepositoryFile(root, WORK1_RECOVERY_PATH);
  const authority = buildCorrectionAuthority(
    root,
    parentAuthority,
    parentBytes,
    activation,
    activationBytes,
  );
  writeCanonical(root, WORK1_CORRECTION_AUTHORITY_PATH, authority);
  for (const repositoryPath of authority.effective_work1_paths) {
    assert.equal(lstatSync(absolute(root, repositoryPath)).isFile(), true, repositoryPath);
  }
  assert.deepEqual(recoveryWorktreePaths(root), [...authority.effective_work1_paths].sort());
  return {
    root,
    parentAuthority,
    authority,
    staleOutputBytes: new Map(RECOVERY_TARGET_PATHS.map(
      (repositoryPath) => [repositoryPath, readFileSync(absolute(root, repositoryPath))],
    )),
  };
}

function restampCorrectionAuthority(fixture, mutate) {
  const unsigned = clone(fixture.authority);
  delete unsigned.correction_authority_id;
  mutate(unsigned);
  const authority = sealRecord(unsigned, 'correction_authority_id');
  writeCanonical(fixture.root, WORK1_CORRECTION_AUTHORITY_PATH, authority);
  return authority;
}

function recoveryWorktreePaths(root) {
  const status = runFixtureGit(root, ['status', '--porcelain=v1', '--untracked-files=all']);
  return status === '' ? [] : status.split('\n').map((line) => line.slice(3)).sort();
}

function snapshotRepository(root) {
  const snapshot = {};
  function visit(directory, prefix = '') {
    for (const name of readdirSync(directory).sort()) {
      if (prefix === '' && name === '.git') continue;
      const relative = prefix === '' ? name : `${prefix}/${name}`;
      const absolutePath = path.join(directory, name);
      const stat = lstatSync(absolutePath);
      if (stat.isDirectory()) {
        snapshot[relative] = { kind: 'DIRECTORY', mode: stat.mode & 0o777 };
        visit(absolutePath, relative);
      } else if (stat.isSymbolicLink()) {
        snapshot[relative] = { kind: 'SYMLINK', target: readlinkSync(absolutePath) };
      } else {
        const bytes = readFileSync(absolutePath);
        snapshot[relative] = {
          kind: 'FILE',
          mode: stat.mode & 0o777,
          byte_length: bytes.length,
          sha256: sha256Hex(bytes),
        };
      }
    }
  }
  visit(root);
  return snapshot;
}

function changedSnapshotPaths(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((repositoryPath) => {
      const beforeValue = Object.hasOwn(before, repositoryPath)
        ? canonicalJson(before[repositoryPath])
        : null;
      const afterValue = Object.hasOwn(after, repositoryPath)
        ? canonicalJson(after[repositoryPath])
        : null;
      return beforeValue !== afterValue;
    })
    .sort();
}

function assertStaleOutputsRestored(fixture) {
  for (const [repositoryPath, bytes] of fixture.staleOutputBytes) {
    assert.deepEqual(readFileSync(absolute(fixture.root, repositoryPath)), bytes);
  }
}

async function assertRecoveryCode(recovery, fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(typeof error, 'object');
    assert.notEqual(error, null);
    assert.equal(error.code, code);
    return true;
  });
}

function assertRecoveryResult(result, status, authority, effects) {
  assert.deepEqual(Object.keys(result).sort(), [
    'correction_authority_id',
    'effects',
    'finaliser_argv',
    'status',
    'target_paths',
    'validator_argv',
  ]);
  assert.equal(result.status, status);
  assert.equal(result.correction_authority_id, authority.correction_authority_id);
  assert.deepEqual(result.target_paths, RECOVERY_TARGET_PATHS);
  assert.deepEqual(result.finaliser_argv, ['node', WORK1_FINALISER_PATH]);
  assert.deepEqual(result.validator_argv, ['node', WORK1_VALIDATOR_PATH]);
  assert.deepEqual(result.effects, effects);
}

test('Work2-7 manifests bind an external milestone attestation without claiming independent Git proof', async (t) => {
  const validator = await loadValidator();
  const fixture = makeFixture(t);
  const manifest = baseWork2Manifest(fixture);
  const repositoryPath = writeManifest(fixture, manifest);

  const result = await validator.validateExecutionManifest({
    repoRoot: fixture.root,
    manifestPath: repositoryPath,
  });

  assert.deepEqual(Object.keys(result).sort(), [
    'candidate_registration_id',
    'deferred_proofs',
    'execution_manifest_digest',
    'execution_manifest_id',
    'manifest_path',
    'schema_version',
    'status',
    'work',
  ]);
  assert.equal(result.schema_version, RESULT_SCHEMA);
  assert.equal(result.status, 'PASS_NARROWING_EXECUTION_MANIFEST');
  assert.equal(result.work, 'WORK2');
  assert.equal(result.execution_manifest_id, manifest.execution_manifest_id);
  assert.equal(result.execution_manifest_digest, manifest.execution_manifest_digest);
  assert.equal(result.candidate_registration_id, null);
  assert.deepEqual(result.deferred_proofs, [DEFERRED_GIT_PROOF]);
});

test('structural attestation fixture derives commit, tree and local origin values from disposable Git', async (t) => {
  const validator = await loadValidator();
  const fixture = makeFixture(t);
  const observed = deriveRealMilestone(fixture);
  const manifest = baseWork2Manifest(fixture);
  assert.equal(observed.receiptBlobOid, manifest.predecessor_receipt_binding.git_blob_oid);
  assert.equal(observed.originCommit, observed.commit);
  assert.equal(observed.singleParentObservation, `${observed.commit} ${observed.parentCommit}`);
  assert.equal(observed.expectedParentObservation, observed.singleParentObservation);
  assert.deepEqual(observed.repositoryObservation, {
    shallow_history: false,
    grafts_present: false,
    loose_replace_refs_present: false,
    packed_replace_refs_present: false,
  });
  manifest.base_tip_binding = {
    commit: observed.commit,
    parent_commit: observed.parentCommit,
    branch: BRANCH,
    commit_message: observed.commitMessage,
    milestone_attestation: milestoneAttestation({
      repoRoot: fixture.root,
      predecessorWork: 'WORK1',
      commit: observed.commit,
      parentCommit: observed.parentCommit,
      commitMessage: observed.commitMessage,
      predecessorReceiptBinding: manifest.predecessor_receipt_binding,
      predecessorExecutionManifestBinding: null,
      predecessorValidationResult: fixture.work1ValidationResult,
      exactCommitDeltaPaths: observed.exactCommitDeltaPaths,
    }),
  };
  const repositoryPath = writeManifest(fixture, restamp(manifest));
  const result = await validator.validateExecutionManifest({
    repoRoot: fixture.root,
    manifestPath: repositoryPath,
  });
  assert.equal(result.status, 'PASS_NARROWING_EXECUTION_MANIFEST');
  assert.deepEqual(result.deferred_proofs, [DEFERRED_GIT_PROOF]);
});

test('schema, exact members, canonical bytes, state, digest and ID are closed', async (t) => {
  const validator = await loadValidator();
  const cases = [
    ['MANIFEST_CONTRACT_DRIFT', (record) => { record.extra = true; }],
    ['MANIFEST_CONTRACT_DRIFT', (record) => { record.schema_version = `${SCHEMA}-OTHER`; }],
    ['MANIFEST_CONTRACT_DRIFT', (record) => { record.state = 'ACTIVE'; }],
    ['MANIFEST_IDENTITY_DRIFT', (record) => { record.execution_manifest_digest = '0'.repeat(64); }],
    ['MANIFEST_IDENTITY_DRIFT', (record) => { record.execution_manifest_id = '0'.repeat(64); }],
  ];
  for (const [code, mutate] of cases) {
    const fixture = makeFixture(t);
    const record = baseWork2Manifest(fixture);
    mutate(record);
    const repositoryPath = writeManifest(fixture, record);
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: repositoryPath,
    }), code);
  }

  const fixture = makeFixture(t);
  const record = baseWork2Manifest(fixture);
  const repositoryPath = writeManifest(fixture, record);
  writeFileSync(absolute(fixture.root, repositoryPath), ` ${canonicalJson(record)}\n`);
  await assertCode(validator, () => validator.validateExecutionManifest({
    repoRoot: fixture.root,
    manifestPath: repositoryPath,
  }), 'MANIFEST_BYTES_DRIFT');
});

test('authority, activation, predecessor and declared tip bindings are exact', async (t) => {
  const validator = await loadValidator();
  const cases = [
    ['AUTHORITY_BINDING_DRIFT', (record) => { record.parent_authority_binding.sha256 = '0'.repeat(64); }],
    ['ACTIVATION_BINDING_DRIFT', (record) => { record.activation_receipt_binding.record_id = '0'.repeat(64); }],
    ['ACTIVATION_BINDING_DRIFT', (record) => { record.activation_commit_binding.commit = '0'.repeat(40); }],
    ['PREDECESSOR_BINDING_DRIFT', (record) => { record.predecessor_receipt_binding.byte_length += 1; }],
    ['PREDECESSOR_BINDING_DRIFT', (record) => {
      record.predecessor_receipt_binding.schema_version = 'TEST_WORK1_RECEIPT/V1';
    }],
    ['BASE_TIP_DRIFT', (record) => { record.base_tip_binding.parent_commit = '0'.repeat(40); }],
    ['BASE_TIP_DRIFT', (record) => { delete record.base_tip_binding.milestone_attestation; }],
    ['BASE_TIP_DRIFT', (record) => {
      record.base_tip_binding.milestone_attestation.predecessor_receipt_binding.sha256 = '0'.repeat(64);
    }],
    ['BASE_TIP_DRIFT', (record) => {
      record.base_tip_binding.milestone_attestation.checks.pop();
    }],
    ['BASE_TIP_DRIFT', (record) => {
      record.base_tip_binding.milestone_attestation.observed_command_result_ledger[5]
        .observed_result = '0'.repeat(40);
    }],
    ['BASE_TIP_DRIFT', (record) => { record.success_conditions = ['WORK2_RECEIPT_PASS']; }],
  ];
  for (const [code, mutate] of cases) {
    const fixture = makeFixture(t);
    const record = baseWork2Manifest(fixture);
    mutate(record);
    const sealedWork5 = restamp(record);
    const repositoryPath = writeManifest(fixture, sealedWork5);
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: repositoryPath,
    }), code);
  }

  const substituted = makeFixture(t);
  const replacementAuthority = sealDigestRecord({
    ...substituted.authority,
    fixture_substitution: true,
  }, 'authority_digest', 'authority_id');
  writeCanonical(substituted.root, AUTHORITY_PATH, replacementAuthority);
  const replacementBytes = readFileSync(absolute(substituted.root, AUTHORITY_PATH));
  const replacementManifest = baseWork2Manifest(substituted);
  replacementManifest.parent_authority_binding = parentAuthorityBinding(
    replacementAuthority,
    replacementBytes,
  );
  const replacementPath = writeManifest(substituted, restamp(replacementManifest));
  await assertCode(validator, () => validator.validateExecutionManifest({
    repoRoot: substituted.root,
    manifestPath: replacementPath,
  }), 'AUTHORITY_BINDING_DRIFT');
});

test('read, write and create-once paths stay inside the parent authority and reject symlinks', async (t) => {
  const validator = await loadValidator();
  const cases = [
    ['PATH_SCOPE_DRIFT', (record) => { record.permitted_read_paths.push('../escape'); }],
    ['PATH_SCOPE_DRIFT', (record) => { record.permitted_write_paths.push('docs/core/PLAN.md'); }],
    ['PATH_SCOPE_DRIFT', (record) => { record.permitted_write_paths.push('docs/core/OPERATING-RULES.md'); }],
    ['WRITE_ONCE_DRIFT', (record) => { record.permitted_write_paths.push(manifestPath('WORK2')); }],
    ['PATH_SCOPE_DRIFT', (record) => { record.permitted_write_paths.push('evidence/canonical-v2/stage-2y-structure-migration/shadow/m4/forbidden.json'); }],
    ['PATH_SCOPE_DRIFT', (record) => { record.work_receipt_path = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-wrong.json'; }],
  ];
  for (const [code, mutate] of cases) {
    const fixture = makeFixture(t);
    const record = baseWork2Manifest(fixture);
    mutate(record);
    record.permitted_read_paths = [...new Set(record.permitted_read_paths)].sort();
    record.permitted_write_paths = [...new Set(record.permitted_write_paths)].sort();
    const repositoryPath = writeManifest(fixture, restamp(record));
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: repositoryPath,
    }), code);
  }

  const undeclaredPredecessorFixture = makeFixture(t);
  const undeclaredPredecessor = baseWork2Manifest(undeclaredPredecessorFixture);
  const undeclaredPredecessorPath =
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/undeclared-predecessor.json';
  symlinkSync('unreadable-predecessor', absolute(
    undeclaredPredecessorFixture.root,
    undeclaredPredecessorPath,
  ));
  undeclaredPredecessor.predecessor_receipt_binding.path = undeclaredPredecessorPath;
  const undeclaredManifestPath = writeManifest(
    undeclaredPredecessorFixture,
    restamp(undeclaredPredecessor),
  );
  await assertCode(validator, () => validator.validateExecutionManifest({
    repoRoot: undeclaredPredecessorFixture.root,
    manifestPath: undeclaredManifestPath,
  }), 'PATH_SCOPE_DRIFT');

  const outsidePrefixFixture = makeFixture(t);
  const outsidePrefix = baseWork2Manifest(outsidePrefixFixture);
  const outsidePrefixPath = 'outside-parent-authority-read-prefix.json';
  symlinkSync('unreadable-outside-prefix', absolute(
    outsidePrefixFixture.root,
    outsidePrefixPath,
  ));
  outsidePrefix.predecessor_receipt_binding.path = outsidePrefixPath;
  outsidePrefix.permitted_read_paths.push(outsidePrefixPath);
  outsidePrefix.permitted_read_paths.sort();
  const outsidePrefixManifestPath = writeManifest(
    outsidePrefixFixture,
    restamp(outsidePrefix),
  );
  await assertCode(validator, () => validator.validateExecutionManifest({
    repoRoot: outsidePrefixFixture.root,
    manifestPath: outsidePrefixManifestPath,
  }), 'PATH_SCOPE_DRIFT');

  const missingPriorFixture = makeFixture(t);
  const missingPrior = baseWork2Manifest(missingPriorFixture);
  missingPrior.work = 'WORK3';
  missingPrior.permitted_read_paths = missingPrior.permitted_read_paths.map(
    (repositoryReadPath) => repositoryReadPath === manifestPath('WORK2')
      ? manifestPath('WORK3') : repositoryReadPath,
  );
  const missingPriorPath = writeManifest(missingPriorFixture, restamp(missingPrior));
  await assertCode(validator, () => validator.validateExecutionManifest({
    repoRoot: missingPriorFixture.root,
    manifestPath: missingPriorPath,
  }), 'PATH_SCOPE_DRIFT');

  const fixture = makeFixture(t);
  const record = baseWork2Manifest(fixture);
  const safePath = 'lib/canonical-v2/symlink-target.js';
  writeBytes(fixture.root, safePath, Buffer.from('safe\n'));
  const linkPath = 'lib/canonical-v2/symlink-read.js';
  symlinkSync(absolute(fixture.root, safePath), absolute(fixture.root, linkPath));
  record.permitted_read_paths.push(linkPath);
  record.permitted_read_paths.sort();
  const repositoryPath = writeManifest(fixture, restamp(record));
  await assertCode(validator, () => validator.validateExecutionManifest({
    repoRoot: fixture.root,
    manifestPath: repositoryPath,
  }), 'PATH_SAFETY');

  const existingFixture = makeFixture(t);
  const existingRecord = baseWork2Manifest(existingFixture);
  const candidateWritePath = `${CANDIDATE_ROOT_FOR_TESTS}/${'a'.repeat(64)}.json`;
  writeCanonical(existingFixture.root, candidateWritePath, { occupied: true });
  existingRecord.permitted_write_paths.push(candidateWritePath);
  existingRecord.permitted_write_paths.sort();
  const existingPath = writeManifest(existingFixture, restamp(existingRecord));
  await assertCode(validator, () => validator.validateExecutionManifest({
    repoRoot: existingFixture.root,
    manifestPath: existingPath,
  }), 'WRITE_ONCE_DRIFT');
});

test('commands are literal, work-scoped and finitely bounded', async (t) => {
  const validator = await loadValidator();
  const cases = [
    ['COMMAND_SCOPE_DRIFT', (record) => { record.exact_argv_with_run_limits[0].max_runs = 0; }],
    ['COMMAND_SCOPE_DRIFT', (record) => { record.exact_argv_with_run_limits[0].argv = ['bash', '-c', 'node anything']; }],
    ['COMMAND_SCOPE_DRIFT', (record) => { record.exact_argv_with_run_limits[0].argv[2] = 'scripts/stage-2y-structure-m7-v2-repair-work3-finalise.mjs'; }],
    ['COMMAND_SCOPE_DRIFT', (record) => { record.exact_argv_with_run_limits[0].argv.push('$(touch bad)'); }],
    ['COMMAND_SCOPE_DRIFT', (record) => { record.exact_argv_with_run_limits[0].argv = ['git', 'cat-file', '-p', 'f'.repeat(40)]; }],
    ['COMMAND_SCOPE_DRIFT', (record) => { record.exact_argv_with_run_limits.shift(); }],
    ['COMMAND_SCOPE_DRIFT', (record) => { record.exact_git_commit_and_push_argv[0].push('docs/core/PLAN.md'); }],
    ['COMMAND_SCOPE_DRIFT', (record) => { record.exact_git_commit_and_push_argv[2] = ['git', 'push', 'elsewhere', BRANCH]; }],
  ];
  for (const [code, mutate] of cases) {
    const fixture = makeFixture(t);
    const record = baseWork2Manifest(fixture);
    mutate(record);
    const repositoryPath = writeManifest(fixture, restamp(record));
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: repositoryPath,
    }), code);
  }
});

test('allowed effects only narrow and prohibited effects and stop conditions cannot weaken', async (t) => {
  const validator = await loadValidator();
  const cases = [
    ['EFFECT_SCOPE_DRIFT', (record) => { record.allowed_effects.local_commits = 13; }],
    ['EFFECT_SCOPE_DRIFT', (record) => { record.allowed_effects.repository_pushes.remote = 'elsewhere'; }],
    ['EFFECT_SCOPE_DRIFT', (record) => { record.prohibited_effects.model_calls = 1; }],
    ['EFFECT_SCOPE_DRIFT', (record) => { record.stop_conditions.whole_repair.pop(); }],
    ['EFFECT_SCOPE_DRIFT', (record) => { record.allowed_effects.extra_effect = true; }],
  ];
  for (const [code, mutate] of cases) {
    const fixture = makeFixture(t);
    const record = baseWork2Manifest(fixture);
    mutate(record);
    const repositoryPath = writeManifest(fixture, restamp(record));
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: repositoryPath,
    }), code);
  }
});

test('candidate records are content-addressed and Work5-7 keep one exact registration', async (t) => {
  const validator = await loadValidator();
  {
    const fixture = makeFixture(t);
    const record = baseWork2Manifest(fixture);
    record.allowed_effects.v2_shadow_analysis_runs = true;
    const repositoryPath = writeManifest(fixture, restamp(record));
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: repositoryPath,
    }), 'CANDIDATE_BINDING_DRIFT');
  }
  {
    const fixture = makeFixture(t);
    const minimal = sealRecord({
      schema_version: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1',
      lifecycle_state: 'CANDIDATE_PENDING_REVIEW',
    }, 'candidate_registration_id');
    const repositoryPath = `${CANDIDATE_ROOT_FOR_TESTS}/${minimal.candidate_registration_id}.json`;
    writeCanonical(fixture.root, repositoryPath, minimal);
    const minimalBytes = readFileSync(absolute(fixture.root, repositoryPath));
    const registrationBinding = standardBinding(
      repositoryPath,
      minimalBytes,
      minimal.schema_version,
      'candidate_registration_id',
      minimal.candidate_registration_id,
    );
    const independentVerification = sealRecord({
      schema_version: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION_VERIFICATION/V1',
      state: 'PASS_CANDIDATE_REGISTRATION',
      candidate_registration_id: minimal.candidate_registration_id,
      registration_binding: registrationBinding,
      checks: CANDIDATE_VERIFICATION_CHECK_IDS.map((check_id) => ({ check_id, status: 'PASS' })),
      counts: {},
      effects: {
        files_written: 0, model_calls: 0, network_reads: 0, network_writes: 0,
        database_writes: 0, product_writes: 0, m0_m4_mutations: 0, m8_actions: 0,
      },
    }, 'verification_id');
    const record = baseWork2Manifest(fixture);
    record.allowed_effects.v2_shadow_analysis_runs = true;
    record.candidate_registration_binding = {
      registration_binding: registrationBinding,
      independent_verification: independentVerification,
    };
    record.permitted_read_paths.push(repositoryPath);
    record.permitted_read_paths.sort();
    const manifestRepositoryPath = writeManifest(fixture, restamp(record));
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: manifestRepositoryPath,
    }), 'CANDIDATE_BINDING_DRIFT');
  }
  {
    const fixture = makeFixture(t);
    const candidate = await makeCandidate(fixture);
    const prior = priorManifestFor(fixture, 'WORK5', null);
    writeManifest(fixture, prior);
    const priorReceipt = sealRecord({
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK4_RECEIPT/V1',
      state: 'PASS_WORK4',
      status: 'PASS',
      work: 'WORK4',
      execution_manifest_id: prior.execution_manifest_id,
      execution_manifest_digest: prior.execution_manifest_digest,
      counts: { fixture: 1 },
      effects: { files_written: 1 },
    }, 'work4_receipt_id');
    writeCanonical(fixture.root, prior.work_receipt_path, priorReceipt);
    const priorReceiptBytes = readFileSync(absolute(fixture.root, prior.work_receipt_path));
    const record = priorManifestFor(fixture, 'WORK6', candidate.wrapper);
    record.work = 'WORK5';
    record.predecessor_receipt_binding = standardBinding(
      prior.work_receipt_path,
      priorReceiptBytes,
      priorReceipt.schema_version,
      'work4_receipt_id',
      priorReceipt.work4_receipt_id,
    );
    record.candidate_registration_binding = candidate.wrapper;
    record.permitted_read_paths = [...new Set([
      manifestPath('WORK5'), manifestPath('WORK4'), AUTHORITY_PATH, ACTIVATION_PATH,
      prior.work_receipt_path, ...candidateReadPaths(candidate),
    ])].sort();
    record.work_receipt_path = workReceiptPath('WORK5');
    record.permitted_write_paths = record.permitted_write_paths.map((entry) => entry.replace(/work2/g, 'work5'));
    record.permitted_write_paths = [...new Set([...record.permitted_write_paths, record.work_receipt_path])].sort();
    record.exact_argv_with_run_limits = [
      { argv: ['node', EXECUTION_MANIFEST_VALIDATOR_PATH, manifestPath('WORK5')], max_runs: 3 },
      { argv: ['node', '--test', 'tests/stage-2y-structure-m7-v2-repair-work5.test.js'], max_runs: 30 },
      { argv: ['node', 'scripts/stage-2y-structure-m7-v2-repair-work5-finalise.mjs'], max_runs: 1 },
      { argv: ['node', 'scripts/stage-2y-structure-m7-v2-repair-work5-validate.mjs'], max_runs: 3 },
    ];
    for (const command of record.exact_argv_with_run_limits) {
      const commandPath = command.argv.at(-1);
      if (commandPath === manifestPath('WORK5')) continue;
      if (!record.permitted_write_paths.includes(commandPath)) record.permitted_write_paths.push(commandPath);
    }
    record.permitted_write_paths.sort();
    assert.equal(record.permitted_write_paths.includes(manifestPath('WORK5')), false);
    assert.equal(existsSync(absolute(fixture.root, record.work_receipt_path)), false);
    record.base_tip_binding = {
      commit: '5'.repeat(40),
      branch: BRANCH,
      parent_commit: prior.base_tip_binding.commit,
      commit_message: prior.exact_git_commit_and_push_argv[1][3],
      milestone_attestation: milestoneAttestation({
        repoRoot: fixture.root,
        predecessorWork: 'WORK4',
        commit: '5'.repeat(40),
        parentCommit: prior.base_tip_binding.commit,
        commitMessage: prior.exact_git_commit_and_push_argv[1][3],
        predecessorReceiptBinding: record.predecessor_receipt_binding,
        predecessorExecutionManifestBinding: standardBinding(
          manifestPath('WORK4'),
          canonicalBytes(prior),
          SCHEMA,
          'execution_manifest_id',
          prior.execution_manifest_id,
        ),
        predecessorValidationResult: predecessorValidationResult(
          'WORK4',
          record.predecessor_receipt_binding,
          fixture,
        ),
        exactCommitDeltaPaths: [manifestPath('WORK4'), ...prior.permitted_write_paths].sort(),
      }),
    };
    record.exact_git_commit_and_push_argv = [
      ['git', 'add', '--', ...[manifestPath('WORK5'), ...record.permitted_write_paths].sort()],
      ['git', 'commit', '-m', 'Implement M7 V2 repair Work 5'],
      ['git', 'push', 'origin', BRANCH],
    ];
    record.success_conditions = [DEFERRED_GIT_PROOF, 'WORK5_RECEIPT_PASS'];
    const sealedWork5 = restamp(record);
    const repositoryPath = writeManifest(fixture, sealedWork5);
    const result = await validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: repositoryPath,
    });
    assert.equal(result.candidate_registration_id, candidate.record.candidate_registration_id);

    const missingTreeRead = clone(sealedWork5);
    const omittedTreePath = candidate.record.subtype_tree_bindings[0].binding.path;
    const omittedTreeBytes = readFileSync(absolute(fixture.root, omittedTreePath));
    missingTreeRead.permitted_read_paths = missingTreeRead.permitted_read_paths.filter(
      (repositoryReadPath) => repositoryReadPath
        !== omittedTreePath,
    );
    rmSync(absolute(fixture.root, omittedTreePath));
    symlinkSync('unreadable-omitted-tree', absolute(fixture.root, omittedTreePath));
    const missingTreeReadPath = writeManifest(fixture, restamp(missingTreeRead));
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: missingTreeReadPath,
    }), 'PATH_SCOPE_DRIFT');
    rmSync(absolute(fixture.root, omittedTreePath));
    writeBytes(fixture.root, omittedTreePath, omittedTreeBytes);
    writeManifest(fixture, sealedWork5);

    const relabelledTreeCandidate = restampCandidateVariant(
      fixture,
      candidate,
      (candidateRecord) => {
        const first = candidateRecord.subtype_tree_bindings[0].binding;
        candidateRecord.subtype_tree_bindings[0].binding =
          candidateRecord.subtype_tree_bindings[1].binding;
        candidateRecord.subtype_tree_bindings[1].binding = first;
      },
    );
    const relabelledTreeManifest = manifestWithCandidate(
      sealedWork5,
      candidate.repositoryPath,
      relabelledTreeCandidate,
    );
    const relabelledTreePath = writeManifest(fixture, relabelledTreeManifest);
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: relabelledTreePath,
    }), 'CANDIDATE_BINDING_DRIFT');
    writeManifest(fixture, sealedWork5);

    const failedWork1Receipt = sealDigestRecord({
      ...clone(fixture.work1Receipt),
      state: 'FAIL_WORK1_CONTRACTS',
      status: 'FAIL',
    }, 'work1_contract_receipt_digest', 'work1_contract_receipt_id');
    writeCanonical(fixture.root, WORK1_RECEIPT_PATH, failedWork1Receipt);
    const failedWork1Bytes = readFileSync(absolute(fixture.root, WORK1_RECEIPT_PATH));
    const failedPredecessorCandidate = restampCandidateVariant(
      fixture,
      candidate,
      (candidateRecord) => {
        candidateRecord.predecessor_receipt_bindings[0].binding = standardBinding(
          WORK1_RECEIPT_PATH,
          failedWork1Bytes,
          failedWork1Receipt.schema_version,
          'work1_contract_receipt_id',
          failedWork1Receipt.work1_contract_receipt_id,
        );
      },
    );
    const failedPredecessorManifest = manifestWithCandidate(
      sealedWork5,
      candidate.repositoryPath,
      failedPredecessorCandidate,
    );
    const failedPredecessorPath = writeManifest(fixture, failedPredecessorManifest);
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: failedPredecessorPath,
    }), 'CANDIDATE_BINDING_DRIFT');
    writeCanonical(fixture.root, WORK1_RECEIPT_PATH, fixture.work1Receipt);
    writeManifest(fixture, sealedWork5);

    const candidateWrite = clone(sealedWork5);
    candidateWrite.permitted_write_paths.push(
      `${CANDIDATE_ROOT_FOR_TESTS}/${'b'.repeat(64)}.json`,
    );
    candidateWrite.permitted_write_paths.sort();
    const candidateWritePath = writeManifest(fixture, restamp(candidateWrite));
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: candidateWritePath,
    }), 'PATH_SCOPE_DRIFT');
    writeManifest(fixture, sealedWork5);

    const different = await makeCandidate(fixture, 'candidate-b');
    const work6 = clone(sealedWork5);
    work6.work = 'WORK6';
    work6.candidate_registration_binding = different.wrapper;
    work6.predecessor_receipt_binding.path = record.work_receipt_path;
    work6.permitted_read_paths = [...new Set([
      manifestPath('WORK6'), manifestPath('WORK5'), AUTHORITY_PATH, ACTIVATION_PATH,
      record.work_receipt_path, ...candidateReadPaths(different),
    ])].sort();
    writeCanonical(fixture.root, record.work_receipt_path, sealRecord({
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK5_RECEIPT/V1',
      state: 'PASS_WORK5',
      status: 'PASS',
      work: 'WORK5',
      execution_manifest_id: sealedWork5.execution_manifest_id,
      execution_manifest_digest: sealedWork5.execution_manifest_digest,
      counts: { fixture: 1 },
      effects: { files_written: 1 },
    }, 'work5_receipt_id'));
    const work5Receipt = JSON.parse(readFileSync(absolute(fixture.root, record.work_receipt_path)));
    const work5Bytes = readFileSync(absolute(fixture.root, record.work_receipt_path));
    work6.predecessor_receipt_binding = standardBinding(
      record.work_receipt_path,
      work5Bytes,
      work5Receipt.schema_version,
      'work5_receipt_id',
      work5Receipt.work5_receipt_id,
    );
    work6.work_receipt_path = workReceiptPath('WORK6');
    work6.permitted_write_paths = work6.permitted_write_paths.map((entry) => entry.replace(/work5/g, 'work6'));
    work6.exact_argv_with_run_limits = work6.exact_argv_with_run_limits.map((entry) => ({
      ...entry,
      argv: entry.argv.map((token) => token.replace(/work5/g, 'work6')),
    }));
    work6.base_tip_binding = {
      commit: '6'.repeat(40),
      branch: BRANCH,
      parent_commit: sealedWork5.base_tip_binding.commit,
      commit_message: sealedWork5.exact_git_commit_and_push_argv[1][3],
      milestone_attestation: milestoneAttestation({
        repoRoot: fixture.root,
        predecessorWork: 'WORK5',
        commit: '6'.repeat(40),
        parentCommit: sealedWork5.base_tip_binding.commit,
        commitMessage: sealedWork5.exact_git_commit_and_push_argv[1][3],
        predecessorReceiptBinding: work6.predecessor_receipt_binding,
        predecessorExecutionManifestBinding: standardBinding(
          manifestPath('WORK5'),
          canonicalBytes(sealedWork5),
          SCHEMA,
          'execution_manifest_id',
          sealedWork5.execution_manifest_id,
        ),
        predecessorValidationResult: predecessorValidationResult(
          'WORK5',
          work6.predecessor_receipt_binding,
          fixture,
        ),
        exactCommitDeltaPaths: [manifestPath('WORK5'), ...sealedWork5.permitted_write_paths].sort(),
      }),
    };
    work6.exact_git_commit_and_push_argv = [
      ['git', 'add', '--', ...[manifestPath('WORK6'), ...work6.permitted_write_paths].sort()],
      ['git', 'commit', '-m', 'Implement M7 V2 repair Work 6'],
      ['git', 'push', 'origin', BRANCH],
    ];
    work6.success_conditions = [DEFERRED_GIT_PROOF, 'WORK6_RECEIPT_PASS'];
    const work6Path = writeManifest(fixture, restamp(work6));
    await assertCode(validator, () => validator.validateExecutionManifest({
      repoRoot: fixture.root,
      manifestPath: work6Path,
    }), 'CANDIDATE_BINDING_DRIFT');
  }
});

test('validator dependencies are local, read-only and free of semantic or subprocess imports', () => {
  const source = readFileSync(
    path.join(REPO_ROOT, 'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs'),
    'utf8',
  );
  const imports = [...source.matchAll(/^import[\s\S]*?from '([^']+)';$/gm)]
    .map((match) => match[1]).sort();
  assert.deepEqual(imports, [
    'node:crypto',
    'node:fs',
    'node:path',
    'node:url',
    '../lib/canonical-v2/canonical-bytes.js',
  ].sort());
  assert.doesNotMatch(source, /node:child_process|node:http|node:https|\bfetch\s*\(|\beval\s*\(|new Function|writeFile|appendFile|openSync|execFile|spawn/i);
  assert.match(source, /tree\.family_key !== entry\.family_key/);
  assert.match(source, /receipt\.status !== 'PASS'/);
  assert.match(source, /priorManifest\.work_receipt_path !== entry\.binding\.path/);
});

test('Work1 correction authority is canonical, content-addressed and extends the exact Work1 path set to fifteen', () => {
  const authorityBytes = readFileSync(path.join(REPO_ROOT, WORK1_CORRECTION_AUTHORITY_PATH));
  const authority = JSON.parse(authorityBytes);
  const parent = JSON.parse(readFileSync(path.join(REPO_ROOT, AUTHORITY_PATH)));
  assert.deepEqual(authorityBytes, canonicalBytes(authority));
  assert.deepEqual(Object.keys(authority).sort(), [
    'schema_version', 'correction_authority_id', 'stage', 'authority_state',
    'approved_on', 'approver', 'ben_approval_id', 'approval_text', 'discovered_defect',
    'parent_authority_binding', 'activation_receipt_binding', 'stale_output_bindings',
    'executable_bindings', 'authorised_scope', 'exact_path_extension',
    'effective_work1_paths', 'command_extension', 'allowed_effects',
    'prohibited_effects', 'rollback', 'success_conditions',
  ].sort());
  const unsigned = clone(authority);
  delete unsigned.correction_authority_id;
  assert.equal(
    authority.correction_authority_id,
    contentId(authority.schema_version, unsigned),
  );
  assert.equal(authority.schema_version, CORRECTION_AUTHORITY_SCHEMA);
  assert.equal(authority.stage, 'M7_V2_REPAIR_WORK1_CORRECTION');
  assert.equal(authority.authority_state, 'BEN_AUTHORISED_SINGLE_WORK1_RECOVERY');
  assert.equal(authority.approved_on, '2026-08-15');
  assert.equal(authority.approver, 'BEN_GOODCHILD');
  assert.equal(authority.ben_approval_id, CORRECTION_APPROVAL_ID);
  assert.equal(authority.approval_text, 'Authorise Work1 recovery');
  assert.equal(
    authority.discovered_defect,
    'WORK1_VALIDATOR_STATIC_BOUNDARY_FS_MEMBER_ACCESS_FALSE_POSITIVE_AFTER_FIRST_FINALISATION',
  );
  assert.deepEqual(authority.exact_path_extension, [
    WORK1_CORRECTION_AUTHORITY_PATH,
    WORK1_RECOVERY_PATH,
  ]);
  assert.deepEqual(authority.effective_work1_paths, [
    ...parent.command_policy.work1_exact_changed_paths,
    ...authority.exact_path_extension,
  ]);
  assert.equal(authority.effective_work1_paths.length, 15);
  assert.equal(new Set(authority.effective_work1_paths).size, 15);
  assert.deepEqual(
    authority.stale_output_bindings.map((binding) => binding.path),
    RECOVERY_TARGET_PATHS,
  );
  assert.deepEqual(
    authority.executable_bindings.map((binding) => binding.path),
    [
      WORK1_FINALISER_PATH,
      WORK1_VALIDATOR_PATH,
      WORK1_RECOVERY_PATH,
      EXECUTION_MANIFEST_TEST_PATH,
    ],
  );
  for (const binding of [
    authority.parent_authority_binding,
    authority.activation_receipt_binding,
    ...authority.stale_output_bindings,
    ...authority.executable_bindings,
  ]) {
    assert.deepEqual(Object.keys(binding).sort(), [
      'path', 'schema_version', 'record_id_field', 'record_id',
      'byte_length', 'sha256', 'git_blob_oid',
    ].sort());
  }
  assert.deepEqual(authority.command_extension, {
    recovery_argv: [
      'node', WORK1_RECOVERY_PATH, '--authority', WORK1_CORRECTION_AUTHORITY_PATH,
    ],
    recovery_run_limit: 1,
    additional_work1_finaliser_runs: 1,
    work1_finaliser_cumulative_run_count: 2,
    work1_validator_cumulative_run_count: 2,
    parent_work1_validator_limit: 3,
    additional_git_add_commit_push_runs: 0,
  });
  assert.deepEqual(authority.authorised_scope, [
    'PRESERVE_PARENT_AUTHORITY_AND_ACTIVATION_BYTES',
    'REPLACE_ONLY_THE_THREE_UNCOMMITTED_WORK1_GENERATED_OUTPUTS',
    'RUN_WORK1_FINALISER_EXACTLY_ONCE_MORE',
    'RUN_WORK1_VALIDATOR_EXACTLY_ONCE_IN_RECOVERY',
    'COMMIT_AND_PUSH_THE_EFFECTIVE_FIFTEEN_PATH_WORK1_DELTA_ONLY',
  ]);
  assert.deepEqual(authority.allowed_effects, {
    deterministic_local_reads: true,
    system_temp_backup_directories: 1,
    work1_generated_output_replacements: 3,
    local_subprocess_runs: 5,
    repository_commits: 0,
    repository_pushes: 0,
  });
  assert.deepEqual(authority.prohibited_effects, {
    non_target_repository_writes: 0,
    model_calls: 0,
    network_reads: 0,
    network_writes: 0,
    database_writes: 0,
    product_writes: 0,
    m0_m4_mutations: 0,
    m8_actions: 0,
    serving_changes: 0,
    publication_changes: 0,
  });
  assert.deepEqual(authority.rollback, {
    backup_root: 'SYSTEM_TEMP_MKDTEMP_ONLY',
    backup_mode: 'EXACT_BYTES_BEFORE_ANY_REMOVAL',
    restore_on_finaliser_or_validator_failure: true,
    remove_only_new_outputs_before_restore: true,
    retain_backup_on_restore_failure: true,
    second_attempt: 'REJECT_BEFORE_MUTATION',
    protected_paths_never_removed: [WORK0_PATH, AUTHORITY_PATH, ACTIVATION_PATH],
  });
  assert.deepEqual(authority.success_conditions, [
    'THREE_OUTPUTS_REGENERATED',
    'VALIDATOR_PASS',
    'RECEIPT_BINDS_CURRENT_FIFTEEN_PATH_SET',
    'PRIOR_RECEIPT_LINEAGE_BOUND',
    'BACKUP_REMOVED',
    'ZERO_EXTERNAL_EFFECTS',
  ]);
  for (const binding of [
    authority.parent_authority_binding,
    authority.activation_receipt_binding,
    ...authority.stale_output_bindings,
    ...authority.executable_bindings,
  ]) {
    assert.deepEqual(binding, recoveryBinding(REPO_ROOT, binding.path));
  }
});

test('Work1 recovery preview validates the sealed transaction with zero effects', async (t) => {
  const recovery = await loadRecovery();
  const fixture = makeRecoveryFixture(t);
  const before = snapshotRepository(fixture.root);
  const result = await recovery.recoverWork1({
    repoRoot: fixture.root,
    authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
    write: false,
  });
  assertRecoveryResult(
    result,
    'PASS_WORK1_RECOVERY_PREVIEW',
    fixture.authority,
    {
      ...ZERO_RECOVERY_EFFECTS,
      local_subprocess_runs: 1,
    },
  );
  assert.deepEqual(snapshotRepository(fixture.root), before);
});

test('Work1 recovery accepts an exact mixed tracked and untracked path set', async (t) => {
  const recovery = await loadRecovery();
  const fixture = makeRecoveryFixture(t);
  const trackedPath = WORK1_RECOVERY_PATH;
  const governedBytes = readFileSync(absolute(fixture.root, trackedPath));
  writeFileSync(
    absolute(fixture.root, trackedPath),
    Buffer.from('#!/usr/bin/env node\nthrow new Error("tracked fixture baseline");\n', 'utf8'),
  );
  runFixtureGit(fixture.root, ['add', '--', trackedPath]);
  runFixtureGit(fixture.root, ['commit', '-m', 'fixture tracked Work1 path baseline']);
  writeFileSync(absolute(fixture.root, trackedPath), governedBytes);
  const statusLines = runFixtureGit(
    fixture.root,
    ['status', '--porcelain=v1', '--untracked-files=all'],
  ).split('\n');
  assert.equal(statusLines.includes(' M ' + trackedPath), true);
  assert.equal(statusLines.some((line) => line.startsWith('?? ')), true);
  assert.deepEqual(
    recoveryWorktreePaths(fixture.root),
    [...fixture.authority.effective_work1_paths].sort(),
  );
  const before = snapshotRepository(fixture.root);
  const result = await recovery.recoverWork1({
    repoRoot: fixture.root,
    authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
    write: false,
  });
  assertRecoveryResult(result, 'PASS_WORK1_RECOVERY_PREVIEW', fixture.authority, {
    ...ZERO_RECOVERY_EFFECTS,
    local_subprocess_runs: 1,
  });
  assert.deepEqual(snapshotRepository(fixture.root), before);
});

test('Work1 recovery replaces exactly three outputs, rebinds the receipt and rejects reuse before mutation', async (t) => {
  const recovery = await loadRecovery();
  const fixture = makeRecoveryFixture(t);
  const before = snapshotRepository(fixture.root);
  const result = await recovery.recoverWork1({
    repoRoot: fixture.root,
    authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
    write: true,
  });
  assertRecoveryResult(result, 'PASS_WORK1_RECOVERY', fixture.authority, {
    ...ZERO_RECOVERY_EFFECTS,
    system_temp_backup_directories: 1,
    work1_generated_output_replacements: 3,
    local_subprocess_runs: 4,
  });
  const after = snapshotRepository(fixture.root);
  assert.deepEqual(changedSnapshotPaths(before, after), [...RECOVERY_TARGET_PATHS].sort());
  assert.deepEqual(
    recoveryWorktreePaths(fixture.root),
    [...fixture.authority.effective_work1_paths].sort(),
  );
  for (const [repositoryPath, staleBytes] of fixture.staleOutputBytes) {
    assert.notDeepEqual(readFileSync(absolute(fixture.root, repositoryPath)), staleBytes);
  }

  const receiptBytes = readFileSync(absolute(fixture.root, WORK1_RECEIPT_PATH));
  const receipt = JSON.parse(receiptBytes);
  assert.deepEqual(receiptBytes, canonicalBytes(receipt));
  assert.deepEqual(
    receipt,
    sealDigestRecord(
      receipt,
      'work1_contract_receipt_digest',
      'work1_contract_receipt_id',
    ),
  );
  const receiptRecovery = receipt.repository_precondition.recovery;
  assert.deepEqual(Object.keys(receiptRecovery).sort(), [
    'correction_authority_binding', 'superseded_receipt_binding', 'recovery_argv',
    'recovery_run_count', 'finaliser_cumulative_run_count',
    'validator_cumulative_run_count', 'replaced_output_paths', 'backup_state',
    'rollback_state',
  ].sort());
  assert.deepEqual(
    receiptRecovery.correction_authority_binding,
    recoveryBinding(fixture.root, WORK1_CORRECTION_AUTHORITY_PATH),
  );
  assert.deepEqual(
    receiptRecovery.superseded_receipt_binding,
    fixture.authority.stale_output_bindings[2],
  );
  assert.deepEqual(receiptRecovery.recovery_argv, fixture.authority.command_extension.recovery_argv);
  assert.equal(receiptRecovery.recovery_run_count, 1);
  assert.equal(receiptRecovery.finaliser_cumulative_run_count, 2);
  assert.equal(receiptRecovery.validator_cumulative_run_count, 2);
  assert.deepEqual(receiptRecovery.replaced_output_paths, RECOVERY_TARGET_PATHS);
  assert.equal(receiptRecovery.backup_state, 'REMOVED_AFTER_VALIDATOR_PASS');
  assert.equal(receiptRecovery.rollback_state, 'AVAILABLE_DURING_TRANSACTION_ONLY');
  const validatorBinding = receipt.artifact_bindings.find(
    (binding) => binding.path === WORK1_VALIDATOR_PATH,
  );
  assert.deepEqual(validatorBinding, recoveryBinding(fixture.root, WORK1_VALIDATOR_PATH));
  const artifactPaths = receipt.artifact_bindings.map((binding) => binding.path);
  const expectedArtifactPaths = fixture.authority.effective_work1_paths.filter(
    (repositoryPath) => repositoryPath !== WORK1_RECEIPT_PATH,
  );
  assert.equal(receipt.artifact_bindings.length, 14);
  assert.equal(new Set(artifactPaths).size, 14);
  assert.deepEqual(artifactPaths, expectedArtifactPaths);
  assert.deepEqual(
    [...artifactPaths, WORK1_RECEIPT_PATH].sort(),
    [...fixture.authority.effective_work1_paths].sort(),
  );
  assert.equal(
    receipt.command_execution_ledger.find(
      (entry) => entry.argv.length === 2
        && entry.argv[0] === 'node'
        && entry.argv[1] === WORK1_FINALISER_PATH,
    ).run_count,
    2,
  );
  assert.equal(
    receipt.command_execution_ledger.find(
      (entry) => entry.argv.length === 2
        && entry.argv[0] === 'node'
        && entry.argv[1] === WORK1_VALIDATOR_PATH,
    ).run_count,
    2,
  );
  assert.deepEqual(receipt.command_execution_ledger.at(-1), {
    argv: fixture.authority.command_extension.recovery_argv,
    run_count: 1,
    state: 'RUNNER_WRITES_THIS_RECEIPT_AND_COMPLETES_AFTER_VALIDATOR_PASS',
  });
  assert.deepEqual(
    receipt.repository_precondition.observed_before_receipt.authorised_delta_paths,
    fixture.authority.effective_work1_paths,
  );
  assert.deepEqual(
    receipt.repository_precondition.required_after_receipt.worktree_delta_paths,
    fixture.authority.effective_work1_paths,
  );
  assert.deepEqual(
    receipt.repository_precondition.required_commit_and_push.commit_delta_paths,
    fixture.authority.effective_work1_paths,
  );
  assert.deepEqual(
    receipt.repository_precondition.required_commit_and_push.exact_argv[0],
    ['git', 'add', '--', ...fixture.authority.effective_work1_paths],
  );

  const beforeSecondAttempt = snapshotRepository(fixture.root);
  await assertRecoveryCode(recovery, () => recovery.recoverWork1({
    repoRoot: fixture.root,
    authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
    write: true,
  }), 'RECOVERY_ALREADY_APPLIED');
  assert.deepEqual(snapshotRepository(fixture.root), beforeSecondAttempt);
});

test('Work1 recovery CLI clears Node injection environment and returns success', (t) => {
  const fixture = makeRecoveryFixture(t);
  const systemTempRoot = realpathSync(mkdtempSync(path.join(tmpdir(), 'm7-v2-recovery-tmp-')));
  const injectionRoot = realpathSync(mkdtempSync(path.join(tmpdir(), 'm7-v2-node-options-')));
  const preloadPath = path.join(injectionRoot, 'child-injection.cjs');
  const sentinelPath = path.join(injectionRoot, 'child-injection-ran');
  writeFileSync(preloadPath, [
    "const { writeFileSync } = require('node:fs');",
    'if (process.argv[1]?.endsWith(' + JSON.stringify(WORK1_FINALISER_PATH) + ')',
    '    || process.argv[1]?.endsWith(' + JSON.stringify(WORK1_VALIDATOR_PATH) + ')) {',
    '  writeFileSync(' + JSON.stringify(sentinelPath) + ', "inherited");',
    '}',
    '',
  ].join('\n'));
  t.after(() => rmSync(systemTempRoot, { recursive: true, force: true }));
  t.after(() => rmSync(injectionRoot, { recursive: true, force: true }));
  const before = snapshotRepository(fixture.root);
  const stdout = execFileSync(process.execPath, [
    path.join(REPO_ROOT, WORK1_RECOVERY_PATH),
    '--authority',
    WORK1_CORRECTION_AUTHORITY_PATH,
  ], {
    cwd: fixture.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: systemTempRoot,
      NODE_OPTIONS: '--require=' + preloadPath,
      NODE_PATH: injectionRoot,
    },
  });
  const result = JSON.parse(stdout.trim().split('\n').at(-1));
  assertRecoveryResult(result, 'PASS_WORK1_RECOVERY', fixture.authority, {
    ...ZERO_RECOVERY_EFFECTS,
    system_temp_backup_directories: 1,
    work1_generated_output_replacements: 3,
    local_subprocess_runs: 4,
  });
  assert.deepEqual(
    changedSnapshotPaths(before, snapshotRepository(fixture.root)),
    [...RECOVERY_TARGET_PATHS].sort(),
  );
  assert.equal(existsSync(sentinelPath), false);
  assert.deepEqual(readdirSync(systemTempRoot), []);
});

test('Work1 recovery CLI rejects a backup root inside the repository before mutation', (t) => {
  const fixture = makeRecoveryFixture(t);
  const insideTempRoot = path.join(fixture.root, 'recovery-temp-inside-repository');
  mkdirSync(insideTempRoot);
  const environment = { ...process.env, TMPDIR: insideTempRoot };
  delete environment.NODE_OPTIONS;
  delete environment.NODE_PATH;
  const before = snapshotRepository(fixture.root);
  assert.throws(() => execFileSync(process.execPath, [
    path.join(REPO_ROOT, WORK1_RECOVERY_PATH),
    '--authority',
    WORK1_CORRECTION_AUTHORITY_PATH,
  ], {
    cwd: fixture.root,
    encoding: 'utf8',
    env: environment,
  }), (error) => {
    assert.equal(error.status, 1);
    assert.equal(error.stderr.trim(), 'RECOVERY_OUTPUT_SAFETY');
    return true;
  });
  assert.equal(lstatSync(insideTempRoot).isDirectory(), true);
  assert.deepEqual(readdirSync(insideTempRoot), []);
  assert.deepEqual(snapshotRepository(fixture.root), before);
});

test('Work1 recovery rejects authority identity and stale-byte drift before mutation', async (t) => {
  const recovery = await loadRecovery();
  await t.test('authority self-ID drift', async (subtest) => {
    const fixture = makeRecoveryFixture(subtest);
    const positive = await recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: false,
    });
    assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
    const invalid = clone(fixture.authority);
    invalid.correction_authority_id = 'f'.repeat(64);
    writeCanonical(fixture.root, WORK1_CORRECTION_AUTHORITY_PATH, invalid);
    const before = snapshotRepository(fixture.root);
    await assertRecoveryCode(recovery, () => recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: true,
    }), 'RECOVERY_AUTHORITY_INVALID');
    assert.deepEqual(snapshotRepository(fixture.root), before);
  });

  await t.test('stale output binding drift', async (subtest) => {
    const fixture = makeRecoveryFixture(subtest);
    const positive = await recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: false,
    });
    assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
    const contractPath = absolute(fixture.root, CONTRACT_POLICY_PATH);
    writeFileSync(contractPath, Buffer.concat([
      readFileSync(contractPath),
      Buffer.from(' ', 'utf8'),
    ]));
    const before = snapshotRepository(fixture.root);
    await assertRecoveryCode(recovery, () => recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: true,
    }), 'RECOVERY_BINDING_DRIFT');
    assert.deepEqual(snapshotRepository(fixture.root), before);
  });

  await t.test('current validator executable binding drift', async (subtest) => {
    const fixture = makeRecoveryFixture(subtest);
    const positive = await recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: false,
    });
    assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
    const validatorPath = absolute(fixture.root, WORK1_VALIDATOR_PATH);
    writeFileSync(validatorPath, Buffer.concat([
      readFileSync(validatorPath),
      Buffer.from('\n// executable binding drift\n', 'utf8'),
    ]));
    const before = snapshotRepository(fixture.root);
    await assertRecoveryCode(recovery, () => recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: true,
    }), 'RECOVERY_BINDING_DRIFT');
    assert.deepEqual(snapshotRepository(fixture.root), before);
  });
});

test('Work1 recovery rejects a missing, reordered or extra target before mutation', async (t) => {
  const recovery = await loadRecovery();
  const variants = [
    ['missing target', (authority) => { authority.stale_output_bindings.pop(); }],
    ['reordered targets', (authority) => {
      [authority.stale_output_bindings[0], authority.stale_output_bindings[1]] =
        [authority.stale_output_bindings[1], authority.stale_output_bindings[0]];
    }],
    ['extra target', (authority, fixture) => {
      authority.stale_output_bindings.push(recoveryBinding(fixture.root, WORK0_PATH));
    }],
  ];
  for (const [name, mutate] of variants) {
    await t.test(name, async (subtest) => {
      const fixture = makeRecoveryFixture(subtest);
      const positive = await recovery.recoverWork1({
        repoRoot: fixture.root,
        authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
        write: false,
      });
      assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
      restampCorrectionAuthority(fixture, (authority) => mutate(authority, fixture));
      const before = snapshotRepository(fixture.root);
      await assertRecoveryCode(recovery, () => recovery.recoverWork1({
        repoRoot: fixture.root,
        authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
        write: true,
      }), 'RECOVERY_PATH_SCOPE');
      assert.deepEqual(snapshotRepository(fixture.root), before);
    });
  }
});

test('Work1 recovery rejects symlink and non-regular outputs before backup or removal', async (t) => {
  const recovery = await loadRecovery();
  await t.test('symlink output', async (subtest) => {
    const fixture = makeRecoveryFixture(subtest);
    const positive = await recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: false,
    });
    assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
    const target = absolute(fixture.root, CONTRACT_POLICY_PATH);
    rmSync(target);
    symlinkSync(absolute(fixture.root, WORK0_PATH), target);
    const before = snapshotRepository(fixture.root);
    await assertRecoveryCode(recovery, () => recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: true,
    }), 'RECOVERY_OUTPUT_SAFETY');
    assert.deepEqual(snapshotRepository(fixture.root), before);
  });

  await t.test('directory output', async (subtest) => {
    const fixture = makeRecoveryFixture(subtest);
    const positive = await recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: false,
    });
    assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
    const target = absolute(fixture.root, FAMILY_PACKET_PATH);
    rmSync(target);
    mkdirSync(target);
    const before = snapshotRepository(fixture.root);
    await assertRecoveryCode(recovery, () => recovery.recoverWork1({
      repoRoot: fixture.root,
      authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
      write: true,
    }), 'RECOVERY_OUTPUT_SAFETY');
    assert.equal(lstatSync(target).isDirectory(), true);
    assert.deepEqual(snapshotRepository(fixture.root), before);
  });
});

test('Work1 recovery restores all stale outputs after a real finaliser or validator failure', async (t) => {
  const recovery = await loadRecovery();
  for (const [name, fixtureOptions, expectedCode] of [
    ['finaliser failure', { finaliserOutcome: 'FAIL' }, 'FINALISER_FAILED'],
    ['validator failure', { validatorOutcome: 'FAIL' }, 'VALIDATOR_FAILED'],
  ]) {
    await t.test(name, async (subtest) => {
      const fixture = makeRecoveryFixture(subtest, fixtureOptions);
      const positive = await recovery.recoverWork1({
        repoRoot: fixture.root,
        authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
        write: false,
      });
      assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
      const before = snapshotRepository(fixture.root);
      await assertRecoveryCode(recovery, () => recovery.recoverWork1({
        repoRoot: fixture.root,
        authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
        write: true,
      }), expectedCode);
      assertStaleOutputsRestored(fixture);
      assert.deepEqual(snapshotRepository(fixture.root), before);
    });
  }
});

test('Work1 recovery rolls back an unapproved fourth repository effect', async (t) => {
  const recovery = await loadRecovery();
  const fixture = makeRecoveryFixture(t, { finaliserOutcome: 'EXTRA_EFFECT' });
  const positive = await recovery.recoverWork1({
    repoRoot: fixture.root,
    authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
    write: false,
  });
  assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
  const before = snapshotRepository(fixture.root);
  await assertRecoveryCode(recovery, () => recovery.recoverWork1({
    repoRoot: fixture.root,
    authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
    write: true,
  }), 'RECOVERY_EFFECT_DRIFT');
  assertStaleOutputsRestored(fixture);
  assert.deepEqual(snapshotRepository(fixture.root), before);
});

test('Work1 recovery rolls back ignored files and new empty directories', async (t) => {
  const recovery = await loadRecovery();
  for (const [name, finaliserOutcome, repositoryPath] of [
    ['ignored file', 'IGNORED_FILE_EFFECT', 'ignored-recovery-effect.json'],
    ['empty directory', 'EMPTY_DIRECTORY_EFFECT', 'unapproved-empty-directory'],
  ]) {
    await t.test(name, async (subtest) => {
      const fixture = makeRecoveryFixture(subtest, { finaliserOutcome });
      if (finaliserOutcome === 'IGNORED_FILE_EFFECT') {
        assert.equal(
          readFileSync(path.join(fixture.root, '.git', 'info', 'exclude'), 'utf8'),
          'ignored-recovery-effect.json\n',
        );
      }
      const positive = await recovery.recoverWork1({
        repoRoot: fixture.root,
        authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
        write: false,
      });
      assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
      const before = snapshotRepository(fixture.root);
      await assertRecoveryCode(recovery, () => recovery.recoverWork1({
        repoRoot: fixture.root,
        authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
        write: true,
      }), 'RECOVERY_EFFECT_DRIFT');
      assert.equal(existsSync(absolute(fixture.root, repositoryPath)), false);
      assertStaleOutputsRestored(fixture);
      assert.deepEqual(snapshotRepository(fixture.root), before);
    });
  }
});

test('Work1 recovery restores a mutated existing protected file', async (t) => {
  const recovery = await loadRecovery();
  const fixture = makeRecoveryFixture(t, { finaliserOutcome: 'PROTECTED_EFFECT' });
  const positive = await recovery.recoverWork1({
    repoRoot: fixture.root,
    authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
    write: false,
  });
  assert.equal(positive.status, 'PASS_WORK1_RECOVERY_PREVIEW');
  const before = snapshotRepository(fixture.root);
  await assertRecoveryCode(recovery, () => recovery.recoverWork1({
    repoRoot: fixture.root,
    authorityPath: WORK1_CORRECTION_AUTHORITY_PATH,
    write: true,
  }), 'RECOVERY_EFFECT_DRIFT');
  assertStaleOutputsRestored(fixture);
  assert.deepEqual(snapshotRepository(fixture.root), before);
});
