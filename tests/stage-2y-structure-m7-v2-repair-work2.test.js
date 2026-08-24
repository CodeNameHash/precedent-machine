'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  chmodSync,
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const consolidation = require('../lib/canonical-v2/agreement-analysis-consolidation');

const REPO_ROOT = join(__dirname, '..');
const M3_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m3-context-compilation.json';
const M4_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m4-agreement-analysis.json';
const ORDERING_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work2-4-candidate-ordering-correction-authority.json';
const WORK2_ENTRY_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work2-entry-correction-authority.json';
const WORK3_ENTRY_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json';
const WORK2_MANIFEST_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-execution-manifest.json';
const AGREEMENT_ANALYSIS_SET_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-agreement-analysis-set.json';
const CONTEXT_COMPILATION_SET_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work2-context-compilation-set.json';
const WORK2_RECEIPT_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work2-compiler.json';
const CANDIDATE_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-candidate-registrations';
const WORK2_FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs';
const WORK2_VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs';
const WORK2_RECOVERY_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work2-recover.mjs';
const WORK2_RECOVERY_AUTHORITY_PATH = 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work2-recovery-authority.json';
const GENERALISATION_SHADOW_PATH = 'scripts/stage-2y-structure-generalisation-shadow.mjs';
const WORK2_EXECUTION_FIXTURE_PATH = 'tests/fixtures/canonical-v2/m7-v2-repair/work2-compiler-cases.json';
const WORK3_ENTRY_AUTHORITY_BINDING = Object.freeze({
  path: WORK3_ENTRY_AUTHORITY_PATH,
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
  record_id_field: 'correction_authority_id',
  record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
  byte_length: 237749,
  sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
  git_blob_oid: '5ff4bcd0ca719c4da97dd9bb64d610349e3d7afd',
});
const WORK2_OUTPUT_PATHS = Object.freeze([
  AGREEMENT_ANALYSIS_SET_PATH,
  CONTEXT_COMPILATION_SET_PATH,
  WORK2_RECEIPT_PATH,
]);
const WORK2_CASE_IDS = Object.freeze([
  'native-seven-source-sets',
  'work0-m3-m4-authority-continuity',
  'build-only-null-candidate-preview',
  'three-output-create-once-transaction',
  'receipt-and-source-set-independent-validation',
  'execution-case-list-drift-rejection',
  'partial-output-preflight-rejection',
  'symlinked-repository-root-rejection',
  'real-filesystem-write-failure-rollback',
]);
const WORK2_RECEIPT_KEYS = Object.freeze([
  'schema_version', 'work2_receipt_id', 'work', 'stage', 'state', 'status',
  'execution_manifest_id', 'execution_manifest_digest', 'parent_authority_binding',
  'activation_receipt_binding', 'predecessor_receipt_binding',
  'work2_entry_correction_authority_binding',
  'candidate_ordering_correction_authority_binding', 'candidate_registration_id',
  'candidate_transition', 'source_set_evidence', 'compiler_evidence',
  'artifact_bindings', 'artifact_set_digest', 'command_execution_ledger',
  'combined_test_result', 'repository_precondition', 'counts', 'checks', 'effects',
  'next_work',
]);
const WORK2_RECOVERY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_binding', 'recovery_runner_binding',
  'superseded_receipt_binding', 'superseded_source_set_bindings',
  'excluded_generalisation_binding', 'prior_command_run_counts',
  'prior_post_receipt_validator_run_count', 'recovery_argv', 'recovery_run_count',
  'finaliser_cumulative_run_count', 'validator_cumulative_run_count',
  'replaced_output_paths', 'effective_work2_paths', 'backup_state', 'rollback_state',
]);
const WORK2_RECOVERY_AUTHORITY_KEYS = Object.freeze([
  'schema_version', 'correction_authority_id', 'stage', 'authority_state',
  'approved_on', 'approver', 'ben_approval_id', 'approval_text', 'discovered_defect',
  'parent_authority_binding', 'activation_receipt_binding', 'work1_receipt_binding',
  'work2_entry_correction_authority_binding',
  'candidate_ordering_correction_authority_binding', 'execution_manifest_binding',
  'stale_output_bindings', 'excluded_generalisation_binding',
  'source_precondition_bindings', 'executable_bindings', 'authorised_scope',
  'base_effective_work2_paths', 'exact_path_removal', 'exact_path_extension',
  'effective_work2_paths', 'prior_execution_state', 'command_extension',
  'exact_git_commit_and_push_argv', 'allowed_effects', 'prohibited_effects',
  'rollback', 'success_conditions',
]);
const WORK2_RECOVERY_RUN_COUNTS = Object.freeze([
  5, 1, 1, 1, 1, 1, 10, 10, 22, 3, 10, 3, 2, 2, 1,
]);
const WORK2_PRIOR_RUN_COUNTS = Object.freeze([
  5, 1, 1, 1, 1, 1, 10, 10, 22, 3, 10, 3, 1, 1,
]);
const WORK2_STALE_RECEIPT_RUN_COUNTS = Object.freeze([
  4, 1, 1, 1, 1, 1, 1, 1, 13, 3, 8, 2, 1, 0,
]);
const WORK2_STALE_ADDITIONAL_ARTIFACT_BINDINGS = Object.freeze([
  Object.freeze({
    path: WORK2_EXECUTION_FIXTURE_PATH,
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 610,
    sha256: 'ee8ca1fd7e8cda7055552c2529d8495807d2c9e6f8d6912feb118888f82323f0',
    git_blob_oid: '00bd492f3e456c042448fe91bdee940d4924b474',
  }),
  Object.freeze({
    path: 'tests/stage-2y-structure-m7-v2-repair-registration.test.js',
    schema_version: null,
    record_id_field: null,
    record_id: null,
    byte_length: 31257,
    sha256: '00c83e5fcd3ae1a979977cc5bd25ffec36fed7b575039385c1381142abb3a1a5',
    git_blob_oid: '58d3c0073562d6191ea78e6842fe17bb7db3d475',
  }),
]);
const WORK2_RECOVERY_TAIL_STATES = Object.freeze([
  'CUMULATIVE_ONE_INITIAL_ONE_RECOVERY_WRITES_THIS_RECEIPT',
  'CUMULATIVE_ONE_INITIAL_ONE_REQUIRED_AFTER_THIS_RECEIPT',
  'RUNNER_WRITES_THIS_RECEIPT_AND_COMPLETES_AFTER_VALIDATOR_PASS',
]);
const AGREEMENT_ID = '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116';
const SECOND_AGREEMENT_ID = 'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const SEALED_AGREEMENT_IDS = Object.freeze([
  '06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a',
  '08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154',
  '1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116',
  '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb',
  'b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363',
  'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c',
  'fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c',
]);

function sealRecord(schemaVersion, idField, body) {
  const unsigned = { schema_version: schemaVersion, ...body };
  return { ...unsigned, [idField]: contentId(schemaVersion, unsigned) };
}

function restampWork2Receipt(receipt) {
  const unsigned = structuredClone(receipt);
  delete unsigned.work2_receipt_id;
  return {
    ...unsigned,
    work2_receipt_id: contentId(unsigned.schema_version, unsigned),
  };
}

function manifestIdentity(record) {
  const unsigned = structuredClone(record);
  delete unsigned.execution_manifest_id;
  delete unsigned.execution_manifest_digest;
  const digest = sha256Hex(canonicalJson(unsigned));
  return {
    digest,
    id: contentId(record.schema_version, { ...unsigned, execution_manifest_digest: digest }),
  };
}

function recoveryEffectivePaths(basePaths) {
  const effectivePaths = basePaths.filter(
    (selectedPath) => selectedPath !== GENERALISATION_SHADOW_PATH,
  );
  const authorityAnchor = effectivePaths.indexOf(WORK2_ENTRY_AUTHORITY_PATH);
  const runnerAnchor = effectivePaths.indexOf(WORK2_VALIDATOR_PATH);
  assert.notEqual(authorityAnchor, -1);
  assert.notEqual(runnerAnchor, -1);
  effectivePaths.splice(
    authorityAnchor + 1,
    0,
    WORK2_RECOVERY_AUTHORITY_PATH,
  );
  effectivePaths.splice(
    effectivePaths.indexOf(WORK2_VALIDATOR_PATH) + 1,
    0,
    WORK2_RECOVERY_PATH,
  );
  return effectivePaths;
}

function bindingForRecord(path, record, idField) {
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return bindingForBytes(path, bytes, record.schema_version, idField, record[idField]);
}

function bindingForBytes(
  path,
  bytes,
  schemaVersion = null,
  idField = null,
  recordId = null,
) {
  const gitBlobOid = createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
  return {
    path,
    schema_version: schemaVersion,
    record_id_field: idField,
    record_id: recordId,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid,
  };
}

function repositoryBlobBytes(binding) {
  const result = spawnSync('/usr/bin/git', ['cat-file', 'blob', binding.git_blob_oid], {
    cwd: REPO_ROOT,
    encoding: null,
    shell: false,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      LANG: 'C',
      LC_ALL: 'C',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_REPLACE_OBJECTS: '1',
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr?.toString('utf8'));
  assert.deepEqual(
    bindingForBytes(
      binding.path,
      result.stdout,
      binding.schema_version,
      binding.record_id_field,
      binding.record_id,
    ),
    binding,
  );
  return result.stdout;
}

function installBindingBytes(targetRoot, binding) {
  const targetPath = join(targetRoot, binding.path);
  if (existsSync(targetPath)) unlinkSync(targetPath);
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, repositoryBlobBytes(binding));
}

function authorisedRecoveryCommandPolicy(manifest, authority) {
  const commands = structuredClone(manifest.exact_argv_with_run_limits);
  assert.equal(commands.length, authority.command_extension.base_command_count);
  for (const override of authority.command_extension.run_limit_overrides) {
    assert.ok(commands[override.command_index]);
    commands[override.command_index].max_runs = override.max_runs;
  }
  commands.push(...structuredClone(
    authority.command_extension.appended_argv_with_run_limits,
  ));
  return commands;
}

function staleWork2OutputBytes(manifest, authority) {
  const outputs = new Map(authority.stale_output_bindings.slice(0, 2).map((binding) => [
    binding.path,
    repositoryBlobBytes(binding),
  ]));
  const recoveredReceipt = JSON.parse(
    readFileSync(join(REPO_ROOT, WORK2_RECEIPT_PATH), 'utf8'),
  );
  assert.equal(
    recoveredReceipt.repository_precondition?.recovery
      ?.correction_authority_binding?.record_id,
    authority.correction_authority_id,
  );

  const staleReceipt = structuredClone(recoveredReceipt);
  const artifactByPath = new Map(staleReceipt.artifact_bindings.map(
    (binding) => [binding.path, binding],
  ));
  for (const binding of [
    authority.excluded_generalisation_binding,
    ...authority.source_precondition_bindings,
    ...WORK2_STALE_ADDITIONAL_ARTIFACT_BINDINGS,
  ]) {
    artifactByPath.set(binding.path, binding);
  }
  staleReceipt.artifact_bindings = authority.base_effective_work2_paths
    .filter((selectedPath) => selectedPath !== WORK2_RECEIPT_PATH)
    .map((selectedPath) => artifactByPath.get(selectedPath));
  assert.equal(staleReceipt.artifact_bindings.every(Boolean), true);
  const staleArtifactByPath = new Map(staleReceipt.artifact_bindings.map(
    (binding) => [binding.path, binding],
  ));
  staleReceipt.artifact_set_digest = sha256Hex(canonicalJson(
    staleReceipt.artifact_bindings,
  ));
  staleReceipt.source_set_evidence.agreement_analysis_set_binding =
    staleArtifactByPath.get(AGREEMENT_ANALYSIS_SET_PATH);
  staleReceipt.source_set_evidence.context_compilation_set_binding =
    staleArtifactByPath.get(CONTEXT_COMPILATION_SET_PATH);
  for (const [field, selectedPath] of [
    ['compiler_binding', 'lib/canonical-v2/agreement-analysis-consolidation.js'],
    ['deterministic_generator_binding', 'lib/canonical-v2/m7-v2-deterministic-generator.js'],
    ['contract_validator_binding', 'lib/canonical-v2/m7-v2-contract.js'],
    ['contract_test_binding', 'tests/stage-2y-structure-m7-v2-repair-contract.test.js'],
    ['work2_test_binding', 'tests/stage-2y-structure-m7-v2-repair-work2.test.js'],
  ]) {
    staleReceipt.compiler_evidence[field] = staleArtifactByPath.get(selectedPath);
  }
  staleReceipt.command_execution_ledger = manifest.exact_argv_with_run_limits.map(
    (entry, index) => ({
      argv: structuredClone(entry.argv),
      run_count: WORK2_STALE_RECEIPT_RUN_COUNTS[index],
      state: index < 12
        ? 'COMPLETED_BEFORE_RECEIPT'
        : index === 12
          ? 'WRITES_TWO_SOURCE_SETS_AND_THIS_RECEIPT'
          : 'REQUIRED_AFTER_THIS_RECEIPT',
    }),
  );
  staleReceipt.repository_precondition = {
    proof_state: 'ORCHESTRATOR_VERIFIED_EXTERNAL_TO_FINALISER',
    effective_work2_paths: [...authority.base_effective_work2_paths],
    generated_paths_absent: [...WORK2_OUTPUT_PATHS],
    candidate_registration_root_state: 'EMPTY',
    exact_git_commit_and_push_argv: structuredClone(
      manifest.exact_git_commit_and_push_argv,
    ),
    required_validator_argv: structuredClone(
      manifest.exact_argv_with_run_limits[13].argv,
    ),
  };
  staleReceipt.counts.effective_work2_path_count = 22;
  staleReceipt.counts.artifact_binding_count = 21;
  staleReceipt.work2_receipt_id = authority.stale_output_bindings[2].record_id;
  const staleReceiptBytes = Buffer.from(`${canonicalJson(staleReceipt)}\n`, 'utf8');
  assert.deepEqual(
    bindingForBytes(
      WORK2_RECEIPT_PATH,
      staleReceiptBytes,
      staleReceipt.schema_version,
      'work2_receipt_id',
      staleReceipt.work2_receipt_id,
    ),
    authority.stale_output_bindings[2],
  );
  outputs.set(WORK2_RECEIPT_PATH, staleReceiptBytes);
  return outputs;
}

function sourcePair(agreementId, seed, boundAgreementId = agreementId) {
  const contextCompilation = sealRecord('CONTEXT_COMPILATION/V1', 'context_compilation_id', {
    agreement_index_binding: {
      agreement_index_id: seed.repeat(64),
      agreement_index_sha256: '3'.repeat(64),
      canonical_text_sha256: '4'.repeat(64),
      structural_policy_digest: '5'.repeat(64),
    },
    semantic_policy_binding: {
      schema_version: 'STAGE_2Y_SEMANTIC_POLICY/V1',
      policy_version: 1,
      policy_digest: '6'.repeat(64),
    },
    focus_node_occurrence_ids: [],
    frames_by_focus_node_id: {},
    context_facts: [],
    scope_edges: [],
    ambiguities: [],
    residuals: [],
    reference_edges: [],
    definition_edges: [],
    semantic_relationships: [],
    diagnostics: [],
  });
  const contextBinding = bindingForRecord(
    `fixture/work2/${agreementId}-${seed}.context-compilation.json`,
    contextCompilation,
    'context_compilation_id',
  );
  const baseAnalysis = sealRecord('AGREEMENT_ANALYSIS/V1', 'agreement_analysis_id', {
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    agreement_id: agreementId,
    context_compilation_binding: {
      agreement_id: boundAgreementId,
      agreement_index_id: contextCompilation.agreement_index_binding.agreement_index_id,
      byte_length: contextBinding.byte_length,
      context_compilation_id: contextCompilation.context_compilation_id,
      path: contextBinding.path,
      schema_version: contextCompilation.schema_version,
      sha256: contextBinding.sha256,
    },
  });
  const baseBinding = bindingForRecord(
    `fixture/work2/${agreementId}-${seed}.agreement-analysis.json`,
    baseAnalysis,
    'agreement_analysis_id',
  );
  return {
    base: { record: baseAnalysis, binding: baseBinding },
    context: { record: contextCompilation, binding: contextBinding },
  };
}

function readNativeSource(receiptBinding, idField) {
  const bytes = readFileSync(join(REPO_ROOT, receiptBinding.path));
  const record = JSON.parse(bytes.toString('utf8'));
  const binding = bindingForRecord(receiptBinding.path, record, idField);
  assert.deepEqual(bytes, Buffer.from(`${canonicalJson(record)}\n`, 'utf8'));
  assert.equal(binding.schema_version, receiptBinding.schema_version);
  assert.equal(binding.record_id, receiptBinding[idField]);
  assert.equal(binding.byte_length, receiptBinding.byte_length);
  assert.equal(binding.sha256, receiptBinding.sha256);
  return { record, binding };
}

function copyRepositoryPath(targetRoot, selectedPath) {
  const source = join(REPO_ROOT, selectedPath);
  if (!existsSync(source)) return;
  const target = join(targetRoot, selectedPath);
  mkdirSync(dirname(target), { recursive: true });
  if (selectedPath === WORK2_EXECUTION_FIXTURE_PATH) {
    copyFileSync(source, target);
    return;
  }
  try {
    linkSync(source, target);
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    copyFileSync(source, target);
  }
}

function completedExecutionFixture(targetRoot, recovery = false) {
  const fixturePath = join(targetRoot, WORK2_EXECUTION_FIXTURE_PATH);
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  fixture.state = 'BUILD_ONLY_SOURCE_SET_AND_RECEIPT_ACCEPTANCE';
  fixture.combined_test_result = {
    semantic_run_count: 0,
    status: 'PASS',
    test_file_count: 2,
  };
  fixture.command_run_counts = recovery
    ? [...WORK2_RECOVERY_RUN_COUNTS]
    : [...WORK2_STALE_RECEIPT_RUN_COUNTS];
  writeFileSync(fixturePath, `${canonicalJson(fixture)}\n`, 'utf8');
  return fixture;
}

function work2FixtureRepository(
  manifest,
  { recovery = false, useBoundRecoveryExecutables = true } = {},
) {
  const targetRoot = mkdtempSync(join(tmpdir(), 'm7-v2-work2-finalise-'));
  const requiredPaths = new Set([
    WORK2_MANIFEST_PATH,
    ...manifest.permitted_read_paths,
    ...manifest.permitted_write_paths,
    ...(recovery ? [WORK2_RECOVERY_AUTHORITY_PATH, WORK2_RECOVERY_PATH] : []),
  ]);
  for (const selectedPath of requiredPaths) {
    if (!WORK2_OUTPUT_PATHS.includes(selectedPath)) copyRepositoryPath(targetRoot, selectedPath);
  }
  for (const outputPath of WORK2_OUTPUT_PATHS) {
    mkdirSync(dirname(join(targetRoot, outputPath)), { recursive: true });
    assert.equal(existsSync(join(targetRoot, outputPath)), false);
  }
  if (recovery && useBoundRecoveryExecutables) {
    const authority = JSON.parse(
      readFileSync(join(REPO_ROOT, WORK2_RECOVERY_AUTHORITY_PATH), 'utf8'),
    );
    for (const binding of [
      authority.excluded_generalisation_binding,
      ...authority.executable_bindings,
    ]) {
      installBindingBytes(targetRoot, binding);
    }
  }
  return {
    targetRoot,
    executionFixture: completedExecutionFixture(targetRoot, recovery),
  };
}

function work2SuccessorFixture(manifest) {
  const { targetRoot } = work2FixtureRepository(manifest, {
    recovery: true,
    useBoundRecoveryExecutables: false,
  });
  for (const selectedPath of [...WORK2_OUTPUT_PATHS, WORK3_ENTRY_AUTHORITY_PATH]) {
    const targetPath = join(targetRoot, selectedPath);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(join(REPO_ROOT, selectedPath), targetPath);
  }
  const receiptBytes = readFileSync(join(targetRoot, WORK2_RECEIPT_PATH));
  const authorityBytes = readFileSync(join(targetRoot, WORK3_ENTRY_AUTHORITY_PATH));
  const receipt = JSON.parse(receiptBytes);
  const authority = JSON.parse(authorityBytes);
  return {
    targetRoot,
    receipt,
    receiptBytes,
    authority,
    authorityBytes,
    binding: bindingForRecord(WORK2_RECEIPT_PATH, receipt, 'work2_receipt_id'),
    work3EntryCorrectionAuthorityBinding: bindingForRecord(
      WORK3_ENTRY_AUTHORITY_PATH,
      authority,
      'correction_authority_id',
    ),
  };
}

function replaceFixtureBytes(targetRoot, selectedPath, bytes) {
  const targetPath = join(targetRoot, selectedPath);
  unlinkSync(targetPath);
  writeFileSync(targetPath, bytes);
}

function restampSuccessorRecords(authority, receipt, mutateReceipt) {
  const driftedReceipt = structuredClone(receipt);
  mutateReceipt(driftedReceipt);
  const restampedReceipt = restampWork2Receipt(driftedReceipt);
  const receiptBinding = bindingForRecord(
    WORK2_RECEIPT_PATH,
    restampedReceipt,
    'work2_receipt_id',
  );
  const authorityUnsigned = structuredClone(authority);
  delete authorityUnsigned.correction_authority_id;
  authorityUnsigned.work2_receipt_binding = receiptBinding;
  authorityUnsigned.work3_scope_contract.work3_manifest_contract
    .predecessor_receipt_binding = receiptBinding;
  const restampedAuthority = {
    ...authorityUnsigned,
    correction_authority_id: contentId(authorityUnsigned.schema_version, authorityUnsigned),
  };
  return {
    receipt: restampedReceipt,
    receiptBinding,
    authority: restampedAuthority,
    authorityBinding: bindingForRecord(
      WORK3_ENTRY_AUTHORITY_PATH,
      restampedAuthority,
      'correction_authority_id',
    ),
  };
}

function fixtureFilePaths(targetRoot, repositoryPath = '') {
  return readdirSync(join(targetRoot, repositoryPath), { withFileTypes: true })
    .flatMap((entry) => {
      const selectedPath = repositoryPath
        ? `${repositoryPath}/${entry.name}`
        : entry.name;
      return entry.isDirectory()
        ? fixtureFilePaths(targetRoot, selectedPath)
        : [selectedPath];
    })
    .sort();
}

function runFixtureGit(targetRoot, argv) {
  const result = spawnSync('/usr/bin/git', argv, {
    cwd: targetRoot,
    encoding: 'utf8',
    shell: false,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      LANG: 'C',
      LC_ALL: 'C',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_SYSTEM: '/dev/null',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_REPLACE_OBJECTS: '1',
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function work2RecoveryRunnerFixture(t) {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const authority = JSON.parse(
    readFileSync(join(REPO_ROOT, WORK2_RECOVERY_AUTHORITY_PATH), 'utf8'),
  );
  const fixtureRepository = work2FixtureRepository(manifest, { recovery: true });
  const targetRoot = realpathSync(fixtureRepository.targetRoot);
  t.after(() => rmSync(targetRoot, { recursive: true, force: true }));
  const staleOutputBytes = staleWork2OutputBytes(manifest, authority);
  for (const [selectedPath, bytes] of staleOutputBytes) {
    const targetPath = join(targetRoot, selectedPath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, bytes);
  }
  const effectiveBytes = new Map(authority.effective_work2_paths.map((selectedPath) => [
    selectedPath,
    readFileSync(join(targetRoot, selectedPath)),
  ]));
  for (const selectedPath of authority.effective_work2_paths) {
    unlinkSync(join(targetRoot, selectedPath));
  }
  runFixtureGit(targetRoot, ['init']);
  runFixtureGit(targetRoot, ['add', '--all']);
  runFixtureGit(targetRoot, [
    '-c', 'user.name=Work2 Recovery Fixture',
    '-c', 'user.email=work2-recovery@example.invalid',
    'commit', '-m', 'Work2 recovery fixture baseline',
  ]);
  for (const [selectedPath, bytes] of effectiveBytes) {
    const absolute = join(targetRoot, selectedPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, bytes);
  }
  const statusPaths = runFixtureGit(
    targetRoot,
    ['status', '--porcelain=v1', '--untracked-files=all'],
  ).trimEnd().split('\n').filter(Boolean).map((line) => line.slice(3)).sort();
  assert.deepEqual(statusPaths, [...authority.effective_work2_paths].sort());
  return {
    targetRoot,
    manifest,
    authority,
    staleOutputBytes,
  };
}

function restampRecoveryAuthority(targetRoot, mutate) {
  const authorityPath = join(targetRoot, WORK2_RECOVERY_AUTHORITY_PATH);
  const unsigned = JSON.parse(readFileSync(authorityPath, 'utf8'));
  delete unsigned.correction_authority_id;
  mutate(unsigned);
  const authority = {
    ...unsigned,
    correction_authority_id: contentId(unsigned.schema_version, unsigned),
  };
  writeFileSync(authorityPath, `${canonicalJson(authority)}\n`, 'utf8');
  return authority;
}

function installRecoveryValidator(targetRoot, validatorSource) {
  writeFileSync(join(targetRoot, WORK2_VALIDATOR_PATH), validatorSource, 'utf8');
  restampRecoveryAuthority(targetRoot, (authority) => {
    const index = authority.executable_bindings.findIndex(
      (entry) => entry.path === WORK2_VALIDATOR_PATH,
    );
    assert.notEqual(index, -1);
    authority.executable_bindings[index] = bindingForBytes(
      WORK2_VALIDATOR_PATH,
      readFileSync(join(targetRoot, WORK2_VALIDATOR_PATH)),
    );
  });
}

function assertRecoveryError(recovery, fn, code) {
  let selectedError;
  assert.throws(fn, (error) => {
    assert.ok(error instanceof recovery.Work2RecoveryError);
    assert.equal(error.code, code);
    selectedError = error;
    return true;
  });
  return selectedError;
}

function assertStaleOutputs(targetRoot, staleOutputBytes) {
  for (const [selectedPath, bytes] of staleOutputBytes) {
    assert.deepEqual(readFileSync(join(targetRoot, selectedPath)), bytes);
  }
}

test('buildSourceSets seals exact M4 and M3 bindings into canonical V1 source sets', () => {
  assert.deepEqual(Object.keys(consolidation).sort(), [
    'buildSourceSets',
    'consolidateAnalysis',
    'consolidateLegacyAnalysisV1',
  ]);

  const pair = sourcePair(AGREEMENT_ID, '2');
  const { record: baseAnalysis, binding: baseBinding } = pair.base;
  const { record: contextCompilation, binding: contextBinding } = pair.context;
  const input = {
    baseAnalyses: [pair.base],
    contextCompilations: [pair.context],
  };
  const before = structuredClone(input);

  const result = consolidation.buildSourceSets(input);
  const expectedAgreementAnalysisSet = sealRecord(
    'AGREEMENT_ANALYSIS_SET/V1', 'agreement_analysis_set_id', {
      members: [{
        agreement_id: AGREEMENT_ID,
        agreement_analysis_binding: baseBinding,
      }],
    },
  );
  const expectedContextCompilationSet = sealRecord(
    'CONTEXT_COMPILATION_SET/V1', 'context_compilation_set_id', {
      members: [{
        agreement_id: AGREEMENT_ID,
        context_compilation_binding: contextBinding,
      }],
    },
  );

  assert.deepEqual(result, {
    agreementAnalysisSet: expectedAgreementAnalysisSet,
    contextCompilationSet: expectedContextCompilationSet,
  });
  assert.deepEqual(input, before);
  assert.equal(Object.isFrozen(input.baseAnalyses[0].binding), false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.agreementAnalysisSet.members[0].agreement_analysis_binding), true);
  assert.equal(Object.isFrozen(result.contextCompilationSet.members[0].context_compilation_binding), true);
});

test('buildSourceSets sorts agreements and fails closed on duplicate or mismatched sources', () => {
  const first = sourcePair(AGREEMENT_ID, '7');
  const second = sourcePair(SECOND_AGREEMENT_ID, '8');
  const input = {
    baseAnalyses: [second.base, first.base],
    contextCompilations: [first.context, second.context],
  };
  const before = structuredClone(input);

  const result = consolidation.buildSourceSets(input);
  assert.deepEqual(
    result.agreementAnalysisSet.members.map((member) => member.agreement_id),
    [AGREEMENT_ID, SECOND_AGREEMENT_ID],
  );
  assert.deepEqual(
    result.contextCompilationSet.members.map((member) => member.agreement_id),
    [AGREEMENT_ID, SECOND_AGREEMENT_ID],
  );
  assert.deepEqual(input, before);

  const duplicate = sourcePair(AGREEMENT_ID, '9');
  assert.throws(
    () => consolidation.buildSourceSets({
      baseAnalyses: [first.base, duplicate.base],
      contextCompilations: [first.context, duplicate.context],
    }),
    /AGREEMENT_ANALYSIS_CONSOLIDATION_SOURCE_INPUT: duplicate agreement/u,
  );

  const mismatch = sourcePair(AGREEMENT_ID, 'a', SECOND_AGREEMENT_ID);
  assert.throws(
    () => consolidation.buildSourceSets({
      baseAnalyses: [mismatch.base],
      contextCompilations: [mismatch.context],
    }),
    /AGREEMENT_ANALYSIS_CONSOLIDATION_SOURCE_INPUT: baseAnalyses\[0\] does not bind one exact context compilation/u,
  );

  const compactBody = structuredClone(first.base.record);
  delete compactBody.schema_version;
  delete compactBody.agreement_analysis_id;
  compactBody.context_compilation_binding = {
    context_compilation_id: first.context.record.context_compilation_id,
  };
  const compactRecord = sealRecord(
    'AGREEMENT_ANALYSIS/V1', 'agreement_analysis_id', compactBody,
  );
  const compactBinding = bindingForRecord(
    'fixture/work2/compact.agreement-analysis.json',
    compactRecord,
    'agreement_analysis_id',
  );
  assert.throws(
    () => consolidation.buildSourceSets({
      baseAnalyses: [{ record: compactRecord, binding: compactBinding }],
      contextCompilations: [first.context],
    }),
    /AGREEMENT_ANALYSIS_CONSOLIDATION_SOURCE_INPUT: baseAnalyses\[0\] does not bind one exact context compilation/u,
  );
});

test('buildSourceSets binds all seven sealed PASS M4 analyses to their exact PASS M3 compilations', () => {
  const m3Receipt = JSON.parse(readFileSync(join(REPO_ROOT, M3_RECEIPT_PATH), 'utf8'));
  const m4Receipt = JSON.parse(readFileSync(join(REPO_ROOT, M4_RECEIPT_PATH), 'utf8'));
  assert.equal(m3Receipt.status, 'PASS');
  assert.equal(m4Receipt.status, 'PASS');

  const m3Bindings = m3Receipt.output_bindings.filter(
    (binding) => binding.schema_version === 'CONTEXT_COMPILATION/V1',
  );
  const m4Bindings = m4Receipt.output_bindings.filter(
    (binding) => binding.schema_version === 'AGREEMENT_ANALYSIS/V1',
  );
  assert.equal(m3Bindings.length, 7);
  assert.equal(m4Bindings.length, 7);
  assert.deepEqual(
    [...m3Bindings].map((binding) => binding.agreement_id).sort(),
    SEALED_AGREEMENT_IDS,
  );
  assert.deepEqual(
    [...m4Bindings].map((binding) => binding.agreement_id).sort(),
    SEALED_AGREEMENT_IDS,
  );

  const contextsByAgreement = new Map(m3Bindings.map((receiptBinding) => [
    receiptBinding.agreement_id,
    {
      receiptBinding,
      source: readNativeSource(receiptBinding, 'context_compilation_id'),
    },
  ]));
  const baseAnalyses = [];
  const contextCompilations = [];
  for (const receiptBinding of m4Bindings) {
    const base = readNativeSource(receiptBinding, 'agreement_analysis_id');
    const context = contextsByAgreement.get(receiptBinding.agreement_id);
    assert.ok(context);
    assert.equal(base.record.agreement_id, receiptBinding.agreement_id);
    assert.deepEqual(base.record.context_compilation_binding, context.receiptBinding);
    assert.equal(
      context.source.record.agreement_index_binding.agreement_index_id,
      context.receiptBinding.agreement_index_id,
    );
    baseAnalyses.push(base);
    contextCompilations.push(context.source);
  }

  const result = consolidation.buildSourceSets({ baseAnalyses, contextCompilations });
  assert.deepEqual(
    result.agreementAnalysisSet.members.map((member) => member.agreement_id),
    SEALED_AGREEMENT_IDS,
  );
  assert.deepEqual(
    result.contextCompilationSet.members.map((member) => member.agreement_id),
    SEALED_AGREEMENT_IDS,
  );
  for (const agreementId of SEALED_AGREEMENT_IDS) {
    const expectedM4 = baseAnalyses.find((entry) => entry.record.agreement_id === agreementId);
    const expectedM3 = contextsByAgreement.get(agreementId).source;
    assert.deepEqual(
      result.agreementAnalysisSet.members.find((member) => member.agreement_id === agreementId)
        .agreement_analysis_binding,
      expectedM4.binding,
    );
    assert.deepEqual(
      result.contextCompilationSet.members.find((member) => member.agreement_id === agreementId)
        .context_compilation_binding,
      expectedM3.binding,
    );
  }
});

test('Work2 finaliser previews the exact build-only source sets and receipt with zero effects', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const recoveryAuthority = JSON.parse(
    readFileSync(join(REPO_ROOT, WORK2_RECOVERY_AUTHORITY_PATH), 'utf8'),
  );
  const orderingAuthority = JSON.parse(
    readFileSync(join(REPO_ROOT, ORDERING_AUTHORITY_PATH), 'utf8'),
  );
  const executionFixture = JSON.parse(
    readFileSync(join(REPO_ROOT, WORK2_EXECUTION_FIXTURE_PATH), 'utf8'),
  );
  const expectedManifestIdentity = manifestIdentity(manifest);
  assert.match(orderingAuthority.correction_authority_id, /^[0-9a-f]{64}$/u);
  assert.equal(manifest.execution_manifest_id, expectedManifestIdentity.id);
  assert.equal(manifest.execution_manifest_digest, expectedManifestIdentity.digest);
  assert.deepEqual(
    manifest.candidate_ordering_correction_authority_binding,
    bindingForRecord(
      ORDERING_AUTHORITY_PATH, orderingAuthority, 'correction_authority_id',
    ),
  );
  assert.equal(manifest.candidate_registration_binding, null);
  assert.equal(manifest.candidate_transition, null);
  assert.equal(manifest.exact_argv_with_run_limits.length, 14);
  assert.equal(executionFixture.schema_version,
    'STAGE_2Y_M7_V2_REPAIR_WORK2_COMPILER_CASES/V1');
  assert.deepEqual(executionFixture.case_ids, WORK2_CASE_IDS);
  assert.equal(executionFixture.combined_test_result.semantic_run_count, 0);
  assert.equal(executionFixture.combined_test_result.test_file_count, 2);
  const recoveryCommandPolicy = authorisedRecoveryCommandPolicy(
    manifest,
    recoveryAuthority,
  );
  assert.equal(executionFixture.command_run_counts.length, recoveryCommandPolicy.length);
  assert.deepEqual(
    executionFixture.command_run_counts,
    recoveryAuthority.command_extension.recovered_receipt_run_counts,
  );
  assert.equal(
    executionFixture.command_run_counts.every(
      (runCount, index) => runCount <= recoveryCommandPolicy[index].max_runs,
    ),
    true,
  );
  assert.deepEqual(
    manifest.permitted_write_paths.filter((path) => WORK2_OUTPUT_PATHS.includes(path)),
    WORK2_OUTPUT_PATHS,
  );
  assert.equal(manifest.exact_git_commit_and_push_argv[0].slice(3).length, 22);

  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const validator = await import(`../${WORK2_VALIDATOR_PATH}`);
  assert.deepEqual(Object.keys(finaliser).sort(), ['Work2FinalisationError', 'finaliseWork2']);
  assert.deepEqual(Object.keys(validator).sort(), [
    'Work2ValidationError',
    'validateWork2',
    'validateWork2ReceiptBinding',
    'validateWork2SuccessorReceiptBinding',
  ]);
  const { targetRoot } = work2FixtureRepository(manifest);
  try {
    const preview = finaliser.finaliseWork2({ repoRoot: targetRoot, write: false });
    assert.equal(preview.status, 'PASS_WORK2_FINALISATION_PREVIEW');
    assert.match(preview.work2_receipt_id, /^[0-9a-f]{64}$/u);
    assert.match(preview.agreement_analysis_set_id, /^[0-9a-f]{64}$/u);
    assert.match(preview.context_compilation_set_id, /^[0-9a-f]{64}$/u);
    assert.deepEqual(preview.target_paths, WORK2_OUTPUT_PATHS);
    assert.deepEqual(preview.effects, {
      files_written: 0,
      source_set_writes: 0,
      receipt_writes: 0,
      candidate_registration_writes: 0,
      model_calls: 0,
      network_reads: 0,
      network_writes: 0,
      database_writes: 0,
      product_writes: 0,
      m0_m4_mutations: 0,
      m8_actions: 0,
      v2_shadow_analysis_runs: 0,
      v2_shadow_projection_runs: 0,
    });
    for (const outputPath of WORK2_OUTPUT_PATHS) {
      assert.equal(existsSync(join(targetRoot, outputPath)), false);
    }
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 recovery authority overlays the immutable manifest with one exact cycle-free path delta', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const authorityBytes = readFileSync(join(REPO_ROOT, WORK2_RECOVERY_AUTHORITY_PATH));
  const authority = JSON.parse(authorityBytes);
  const authorityUnsigned = structuredClone(authority);
  delete authorityUnsigned.correction_authority_id;
  const basePaths = manifest.exact_git_commit_and_push_argv[0].slice(3);
  const expectedEffectivePaths = recoveryEffectivePaths(basePaths);

  assert.deepEqual(authorityBytes, Buffer.from(`${canonicalJson(authority)}\n`, 'utf8'));
  assert.deepEqual(
    Object.keys(authority).sort(),
    [...WORK2_RECOVERY_AUTHORITY_KEYS].sort(),
  );
  assert.equal(
    authority.schema_version,
    'STAGE_2Y_M7_V2_REPAIR_WORK2_COMMIT_DELTA_RECOVERY_AUTHORITY/V1',
  );
  assert.equal(
    authority.correction_authority_id,
    contentId(authority.schema_version, authorityUnsigned),
  );
  assert.deepEqual(authority.base_effective_work2_paths, basePaths);
  assert.deepEqual(authority.exact_path_removal, [GENERALISATION_SHADOW_PATH]);
  assert.deepEqual(authority.exact_path_extension, [
    WORK2_RECOVERY_AUTHORITY_PATH,
    WORK2_RECOVERY_PATH,
  ]);
  assert.deepEqual(authority.effective_work2_paths, expectedEffectivePaths);
  assert.equal(authority.effective_work2_paths.length, 23);
  assert.equal(new Set(authority.effective_work2_paths).size, 23);
  assert.equal(authority.effective_work2_paths.includes(GENERALISATION_SHADOW_PATH), false);
  assert.deepEqual(
    authority.execution_manifest_binding,
    bindingForRecord(WORK2_MANIFEST_PATH, manifest, 'execution_manifest_id'),
  );
  assert.deepEqual(
    authority.stale_output_bindings.map((entry) => entry.path),
    WORK2_OUTPUT_PATHS,
  );
  const staleReceipt = JSON.parse(
    staleWork2OutputBytes(manifest, authority).get(WORK2_RECEIPT_PATH),
  );
  assert.deepEqual(
    staleReceipt.command_execution_ledger.map((entry) => entry.run_count),
    WORK2_STALE_RECEIPT_RUN_COUNTS,
  );
  assert.deepEqual(
    authority.excluded_generalisation_binding,
    bindingForBytes(
      GENERALISATION_SHADOW_PATH,
      repositoryBlobBytes(authority.excluded_generalisation_binding),
    ),
  );
  const runnerBytes = readFileSync(join(REPO_ROOT, WORK2_RECOVERY_PATH));
  assert.deepEqual(
    authority.executable_bindings.find((entry) => entry.path === WORK2_RECOVERY_PATH),
    bindingForBytes(WORK2_RECOVERY_PATH, runnerBytes),
  );
  assert.equal(runnerBytes.includes(authority.correction_authority_id), false);
  assert.deepEqual(Object.keys(authority.command_extension).sort(), [
    'base_command_count', 'run_limit_overrides', 'appended_argv_with_run_limits',
    'prior_receipt_run_counts', 'prior_post_receipt_validator_run_count',
    'recovered_receipt_run_counts', 'required_validator_cumulative_run_count',
    'additional_git_add_commit_push_runs',
  ].sort());
  assert.equal(authority.command_extension.base_command_count, 14);
  assert.deepEqual(authority.command_extension.run_limit_overrides, [
    { command_index: 0, max_runs: 5 },
    { command_index: 10, max_runs: 10 },
    { command_index: 11, max_runs: 3 },
    { command_index: 12, max_runs: 2 },
  ]);
  assert.deepEqual(authority.command_extension.appended_argv_with_run_limits, [{
    argv: ['node', WORK2_RECOVERY_PATH, '--authority', WORK2_RECOVERY_AUTHORITY_PATH],
    max_runs: 1,
  }]);
  assert.deepEqual(
    authority.command_extension.prior_receipt_run_counts,
    WORK2_PRIOR_RUN_COUNTS,
  );
  assert.equal(authority.command_extension.prior_post_receipt_validator_run_count, 1);
  assert.deepEqual(
    authority.command_extension.recovered_receipt_run_counts,
    WORK2_RECOVERY_RUN_COUNTS,
  );
  assert.equal(authority.command_extension.required_validator_cumulative_run_count, 2);
  assert.equal(authority.command_extension.additional_git_add_commit_push_runs, 0);
  assert.deepEqual(authority.exact_git_commit_and_push_argv, [
    ['git', 'add', '--', ...expectedEffectivePaths],
    manifest.exact_git_commit_and_push_argv[1],
    manifest.exact_git_commit_and_push_argv[2],
  ]);

  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const { targetRoot } = work2FixtureRepository(manifest, { recovery: true });
  try {
    const preview = finaliser.finaliseWork2({ repoRoot: targetRoot, write: false });
    assert.equal(preview.status, 'PASS_WORK2_FINALISATION_PREVIEW');
    assert.deepEqual(preview.target_paths, WORK2_OUTPUT_PATHS);
    for (const outputPath of WORK2_OUTPUT_PATHS) {
      assert.equal(existsSync(join(targetRoot, outputPath)), false);
    }
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 finaliser seals the recovered receipt and its historical validator consumes it', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const authority = JSON.parse(
    readFileSync(join(REPO_ROOT, WORK2_RECOVERY_AUTHORITY_PATH), 'utf8'),
  );
  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const validator = await import(`../${WORK2_VALIDATOR_PATH}`);
  const { targetRoot } = work2FixtureRepository(manifest, { recovery: true });

  try {
    const result = finaliser.finaliseWork2({ repoRoot: targetRoot, write: true });
    assert.equal(result.status, 'PASS_WORK2_FINALISATION');
    assert.deepEqual(result.target_paths, WORK2_OUTPUT_PATHS);
    const receiptBytes = readFileSync(join(targetRoot, WORK2_RECEIPT_PATH));
    const receipt = JSON.parse(receiptBytes);
    const recovery = receipt.repository_precondition.recovery;
    assert.deepEqual(receiptBytes, Buffer.from(`${canonicalJson(receipt)}\n`, 'utf8'));
    assert.deepEqual(Object.keys(receipt).sort(), [...WORK2_RECEIPT_KEYS].sort());
    assert.deepEqual(Object.keys(recovery).sort(), [...WORK2_RECOVERY_KEYS].sort());
    assert.equal(
      recovery.schema_version,
      'STAGE_2Y_M7_V2_REPAIR_WORK2_RECEIPT_RECOVERY/V1',
    );
    assert.deepEqual(
      recovery.correction_authority_binding,
      bindingForRecord(
        WORK2_RECOVERY_AUTHORITY_PATH,
        authority,
        'correction_authority_id',
      ),
    );
    assert.deepEqual(
      recovery.recovery_runner_binding,
      bindingForBytes(
        WORK2_RECOVERY_PATH,
        readFileSync(join(targetRoot, WORK2_RECOVERY_PATH)),
      ),
    );
    assert.deepEqual(recovery.superseded_receipt_binding, authority.stale_output_bindings[2]);
    assert.deepEqual(
      recovery.superseded_source_set_bindings,
      authority.stale_output_bindings.slice(0, 2),
    );
    assert.deepEqual(
      recovery.excluded_generalisation_binding,
      authority.excluded_generalisation_binding,
    );
    assert.deepEqual(recovery.prior_command_run_counts, WORK2_PRIOR_RUN_COUNTS);
    assert.equal(recovery.prior_post_receipt_validator_run_count, 1);
    assert.deepEqual(
      recovery.recovery_argv,
      authority.command_extension.appended_argv_with_run_limits[0].argv,
    );
    assert.equal(recovery.recovery_run_count, 1);
    assert.equal(recovery.finaliser_cumulative_run_count, 2);
    assert.equal(recovery.validator_cumulative_run_count, 2);
    assert.deepEqual(recovery.replaced_output_paths, WORK2_OUTPUT_PATHS);
    assert.deepEqual(recovery.effective_work2_paths, authority.effective_work2_paths);
    assert.equal(recovery.backup_state, 'REMOVED_AFTER_VALIDATOR_PASS');
    assert.equal(recovery.rollback_state, 'AVAILABLE_DURING_TRANSACTION_ONLY');

    assert.equal(receipt.artifact_bindings.length, 22);
    assert.equal(new Set(receipt.artifact_bindings.map((entry) => entry.path)).size, 22);
    assert.deepEqual(
      receipt.artifact_bindings.map((entry) => entry.path),
      authority.effective_work2_paths.filter(
        (selectedPath) => selectedPath !== WORK2_RECEIPT_PATH,
      ),
    );
    assert.equal(
      receipt.artifact_bindings.some(
        (entry) => entry.path === GENERALISATION_SHADOW_PATH,
      ),
      false,
    );
    assert.deepEqual(
      receipt.command_execution_ledger.map((entry) => entry.run_count),
      WORK2_RECOVERY_RUN_COUNTS,
    );
    assert.deepEqual(
      receipt.command_execution_ledger.slice(12).map((entry) => entry.state),
      WORK2_RECOVERY_TAIL_STATES,
    );
    assert.deepEqual(
      receipt.command_execution_ledger[14].argv,
      authority.command_extension.appended_argv_with_run_limits[0].argv,
    );
    assert.equal(receipt.execution_manifest_id, manifest.execution_manifest_id);
    assert.equal(receipt.execution_manifest_digest, manifest.execution_manifest_digest);
    assert.equal(
      receipt.source_set_evidence.agreement_analysis_set_binding.record_id,
      authority.stale_output_bindings[0].record_id,
    );
    assert.equal(
      receipt.source_set_evidence.context_compilation_set_binding.record_id,
      authority.stale_output_bindings[1].record_id,
    );

    const receiptBinding = bindingForRecord(
      WORK2_RECEIPT_PATH,
      receipt,
      'work2_receipt_id',
    );
    mkdirSync(join(targetRoot, CANDIDATE_ROOT), { recursive: true });
    writeFileSync(join(targetRoot, CANDIDATE_ROOT, `${'b'.repeat(64)}.json`), '{}\n');
    const historical = validator.validateWork2ReceiptBinding({
      repoRoot: targetRoot,
      binding: receiptBinding,
    });
    assert.equal(historical.work2_receipt_id, receipt.work2_receipt_id);
    assert.throws(
      () => validator.validateWork2({ repoRoot: targetRoot }),
      (error) => error?.code === 'WORK2_BUILD_ONLY_ORDERING_DRIFT',
    );
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 successor receipt validation binds C3 and tolerates only authorised live drift', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const validator = await import(`../${WORK2_VALIDATOR_PATH}`);
  const fixture = work2SuccessorFixture(manifest);
  const {
    targetRoot,
    receipt,
    receiptBytes,
    authority,
    authorityBytes,
    binding,
    work3EntryCorrectionAuthorityBinding,
  } = fixture;
  const exactOptions = {
    repoRoot: targetRoot,
    binding,
    work3EntryCorrectionAuthorityBinding,
  };

  try {
    assert.deepEqual(work3EntryCorrectionAuthorityBinding, WORK3_ENTRY_AUTHORITY_BINDING);
    assert.deepEqual(Object.keys(validator).sort(), [
      'Work2ValidationError',
      'validateWork2',
      'validateWork2ReceiptBinding',
      'validateWork2SuccessorReceiptBinding',
    ]);
    const expected = {
      schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK2_VALIDATION/V1',
      status: 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE',
      work2_receipt_id: receipt.work2_receipt_id,
      execution_manifest_id: receipt.execution_manifest_id,
      agreement_analysis_set_id:
        authority.work2_successor_snapshot.immutable_source_set_bindings[0].record_id,
      context_compilation_set_id:
        authority.work2_successor_snapshot.immutable_source_set_bindings[1].record_id,
      counts: receipt.counts,
      effects: receipt.effects,
    };
    const successor = validator.validateWork2SuccessorReceiptBinding(exactOptions);
    assert.deepEqual(Object.keys(successor), [
      'schema_version',
      'status',
      'work2_receipt_id',
      'execution_manifest_id',
      'agreement_analysis_set_id',
      'context_compilation_set_id',
      'counts',
      'effects',
    ]);
    assert.deepEqual(successor, expected);

    assert.throws(
      () => validator.validateWork2SuccessorReceiptBinding({
        repoRoot: targetRoot,
        binding,
      }),
      (error) => error instanceof validator.Work2ValidationError
        && error.code === 'WORK2_RECEIPT_INVALID',
    );
    assert.throws(
      () => validator.validateWork2SuccessorReceiptBinding({
        ...exactOptions,
        work3AuthorityBinding: work3EntryCorrectionAuthorityBinding,
      }),
      (error) => error instanceof validator.Work2ValidationError
        && error.code === 'WORK2_RECEIPT_INVALID',
    );

    assert.throws(
      () => validator.validateWork2SuccessorReceiptBinding({
        ...exactOptions,
        repoRoot: join(targetRoot, 'missing-repository-root'),
      }),
      (error) => error instanceof validator.Work2ValidationError
        && error.code === 'WORK2_RECEIPT_SAFETY',
    );

    replaceFixtureBytes(
      targetRoot,
      WORK2_RECEIPT_PATH,
      Buffer.concat([receiptBytes, Buffer.from('\n')]),
    );
    assert.throws(
      () => validator.validateWork2SuccessorReceiptBinding(exactOptions),
      (error) => error instanceof validator.Work2ValidationError
        && error.code === 'WORK2_RECEIPT_INVALID',
    );
    replaceFixtureBytes(targetRoot, WORK2_RECEIPT_PATH, receiptBytes);

    const lineageCases = [
      {
        code: 'WORK2_MANIFEST_BINDING_DRIFT',
        mutateReceipt(selectedReceipt) {
          selectedReceipt.execution_manifest_id = '0'.repeat(64);
        },
      },
      {
        code: 'WORK2_AUTHORITY_BINDING_DRIFT',
        mutateReceipt(selectedReceipt) {
          selectedReceipt.activation_receipt_binding.sha256 = '0'.repeat(64);
        },
      },
      {
        code: 'WORK2_BUILD_ONLY_ORDERING_DRIFT',
        mutateReceipt(selectedReceipt) {
          selectedReceipt.candidate_registration_id = '0'.repeat(64);
        },
      },
    ];
    for (const selectedCase of lineageCases) {
      const restamped = restampSuccessorRecords(
        authority,
        receipt,
        selectedCase.mutateReceipt,
      );
      replaceFixtureBytes(
        targetRoot,
        WORK2_RECEIPT_PATH,
        Buffer.from(`${canonicalJson(restamped.receipt)}\n`, 'utf8'),
      );
      replaceFixtureBytes(
        targetRoot,
        WORK3_ENTRY_AUTHORITY_PATH,
        Buffer.from(`${canonicalJson(restamped.authority)}\n`, 'utf8'),
      );
      assert.throws(
        () => validator.validateWork2SuccessorReceiptBinding({
          repoRoot: targetRoot,
          binding: restamped.receiptBinding,
          work3EntryCorrectionAuthorityBinding: restamped.authorityBinding,
        }),
        (error) => error instanceof validator.Work2ValidationError
          && error.code === selectedCase.code,
      );
      replaceFixtureBytes(targetRoot, WORK2_RECEIPT_PATH, receiptBytes);
      replaceFixtureBytes(targetRoot, WORK3_ENTRY_AUTHORITY_PATH, authorityBytes);
    }

    assert.throws(
      () => validator.validateWork2ReceiptBinding({ repoRoot: targetRoot, binding }),
      (error) => error instanceof validator.Work2ValidationError
        && error.code === 'WORK2_RECOVERY_BINDING_DRIFT',
    );
    const validatorBytes = readFileSync(join(targetRoot, WORK2_VALIDATOR_PATH));
    replaceFixtureBytes(
      targetRoot,
      WORK2_VALIDATOR_PATH,
      Buffer.concat([validatorBytes, Buffer.from('\n')]),
    );
    assert.deepEqual(
      validator.validateWork2SuccessorReceiptBinding(exactOptions),
      expected,
    );
    replaceFixtureBytes(targetRoot, WORK2_VALIDATOR_PATH, validatorBytes);
    const exactSuccessorReadPaths = [
      WORK3_ENTRY_AUTHORITY_PATH,
      WORK2_RECEIPT_PATH,
      AGREEMENT_ANALYSIS_SET_PATH,
      CONTEXT_COMPILATION_SET_PATH,
    ].sort();
    const exactSuccessorReadPathSet = new Set(exactSuccessorReadPaths);
    for (const selectedPath of fixtureFilePaths(targetRoot)) {
      if (!exactSuccessorReadPathSet.has(selectedPath)) {
        unlinkSync(join(targetRoot, selectedPath));
      }
    }
    assert.deepEqual(fixtureFilePaths(targetRoot), exactSuccessorReadPaths);
    assert.deepEqual(
      validator.validateWork2SuccessorReceiptBinding(exactOptions),
      expected,
    );

    replaceFixtureBytes(
      targetRoot,
      WORK3_ENTRY_AUTHORITY_PATH,
      Buffer.concat([authorityBytes, Buffer.from('\n')]),
    );
    assert.throws(
      () => validator.validateWork2SuccessorReceiptBinding(exactOptions),
      (error) => error instanceof validator.Work2ValidationError
        && error.code === 'WORK2_AUTHORITY_BINDING_DRIFT',
    );
    replaceFixtureBytes(targetRoot, WORK3_ENTRY_AUTHORITY_PATH, authorityBytes);

    const driftedReceipt = structuredClone(receipt);
    const driftedArtifact = driftedReceipt.artifact_bindings.find(
      (entry) => entry.path === WORK2_VALIDATOR_PATH,
    );
    assert.notEqual(driftedArtifact, undefined);
    driftedArtifact.sha256 = '0'.repeat(64);
    driftedReceipt.artifact_set_digest = sha256Hex(
      canonicalJson(driftedReceipt.artifact_bindings),
    );
    const restampedReceipt = restampWork2Receipt(driftedReceipt);
    const restampedReceiptBinding = bindingForRecord(
      WORK2_RECEIPT_PATH,
      restampedReceipt,
      'work2_receipt_id',
    );
    const driftedAuthorityUnsigned = structuredClone(authority);
    delete driftedAuthorityUnsigned.correction_authority_id;
    driftedAuthorityUnsigned.work2_receipt_binding = restampedReceiptBinding;
    driftedAuthorityUnsigned.work3_scope_contract.work3_manifest_contract
      .predecessor_receipt_binding = restampedReceiptBinding;
    const driftedAuthority = {
      ...driftedAuthorityUnsigned,
      correction_authority_id: contentId(
        driftedAuthorityUnsigned.schema_version,
        driftedAuthorityUnsigned,
      ),
    };
    replaceFixtureBytes(
      targetRoot,
      WORK2_RECEIPT_PATH,
      Buffer.from(`${canonicalJson(restampedReceipt)}\n`, 'utf8'),
    );
    replaceFixtureBytes(
      targetRoot,
      WORK3_ENTRY_AUTHORITY_PATH,
      Buffer.from(`${canonicalJson(driftedAuthority)}\n`, 'utf8'),
    );
    assert.throws(
      () => validator.validateWork2SuccessorReceiptBinding({
        ...exactOptions,
        binding: restampedReceiptBinding,
        work3EntryCorrectionAuthorityBinding: bindingForRecord(
          WORK3_ENTRY_AUTHORITY_PATH,
          driftedAuthority,
          'correction_authority_id',
        ),
      }),
      (error) => error instanceof validator.Work2ValidationError
        && error.code === 'WORK2_ARTIFACT_BINDING_DRIFT',
    );
    replaceFixtureBytes(targetRoot, WORK2_RECEIPT_PATH, receiptBytes);
    replaceFixtureBytes(targetRoot, WORK3_ENTRY_AUTHORITY_PATH, authorityBytes);

    for (const selectedPath of [
      AGREEMENT_ANALYSIS_SET_PATH,
      CONTEXT_COMPILATION_SET_PATH,
    ]) {
      const sourceSetBytes = readFileSync(join(targetRoot, selectedPath));
      replaceFixtureBytes(
        targetRoot,
        selectedPath,
        Buffer.concat([sourceSetBytes, Buffer.from('\n')]),
      );
      assert.throws(
        () => validator.validateWork2SuccessorReceiptBinding(exactOptions),
        (error) => error instanceof validator.Work2ValidationError
          && error.code === 'WORK2_SOURCE_SET_DRIFT',
      );
      replaceFixtureBytes(targetRoot, selectedPath, sourceSetBytes);
    }
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 historical validator rejects one-delta recovery receipt drift at the first public gate', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const authority = JSON.parse(
    readFileSync(join(REPO_ROOT, WORK2_RECOVERY_AUTHORITY_PATH), 'utf8'),
  );
  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const validator = await import(`../${WORK2_VALIDATOR_PATH}`);
  const { targetRoot } = work2FixtureRepository(manifest, { recovery: true });
  const receiptPath = join(targetRoot, WORK2_RECEIPT_PATH);

  try {
    finaliser.finaliseWork2({ repoRoot: targetRoot, write: true });
    const baseline = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const cases = [
      {
        code: 'WORK2_RECEIPT_INVALID',
        mutate(receipt) {
          delete receipt.repository_precondition.recovery.rollback_state;
        },
      },
      {
        code: 'WORK2_RECOVERY_BINDING_DRIFT',
        mutate(receipt) {
          receipt.repository_precondition.recovery.correction_authority_binding.sha256 =
            '0'.repeat(64);
        },
      },
      {
        code: 'WORK2_RECOVERY_PATH_SCOPE',
        mutate(receipt) {
          receipt.repository_precondition.recovery.effective_work2_paths = [
            ...receipt.repository_precondition.recovery.effective_work2_paths,
            GENERALISATION_SHADOW_PATH,
          ];
        },
      },
      {
        code: 'WORK2_COMMAND_LEDGER_DRIFT',
        mutate(receipt) {
          receipt.command_execution_ledger[13].run_count = 1;
        },
      },
      {
        code: 'WORK2_ARTIFACT_BINDING_DRIFT',
        mutate(receipt) {
          receipt.artifact_bindings.push(authority.excluded_generalisation_binding);
          receipt.artifact_set_digest = sha256Hex(canonicalJson(receipt.artifact_bindings));
        },
      },
    ];

    for (const selectedCase of cases) {
      const drifted = structuredClone(baseline);
      selectedCase.mutate(drifted);
      const restamped = restampWork2Receipt(drifted);
      writeFileSync(receiptPath, `${canonicalJson(restamped)}\n`, 'utf8');
      assert.throws(
        () => validator.validateWork2ReceiptBinding({
          repoRoot: targetRoot,
          binding: bindingForRecord(
            WORK2_RECEIPT_PATH,
            restamped,
            'work2_receipt_id',
          ),
        }),
        (error) => error?.code === selectedCase.code,
      );
    }
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 recovery fails closed for unsafe paths and transaction drift', async (t) => {
  const recovery = await import(`../${WORK2_RECOVERY_PATH}`);

  await t.test('unsafe stale output is rejected before mutation', (subtest) => {
    const fixture = work2RecoveryRunnerFixture(subtest);
    const agreementPath = join(fixture.targetRoot, AGREEMENT_ANALYSIS_SET_PATH);
    unlinkSync(agreementPath);
    symlinkSync(join(fixture.targetRoot, CONTEXT_COMPILATION_SET_PATH), agreementPath);
    const contextBytes = readFileSync(join(fixture.targetRoot, CONTEXT_COMPILATION_SET_PATH));
    const receiptBytes = readFileSync(join(fixture.targetRoot, WORK2_RECEIPT_PATH));

    assertRecoveryError(recovery, () => recovery.recoverWork2({
      repoRoot: fixture.targetRoot,
      authorityPath: WORK2_RECOVERY_AUTHORITY_PATH,
      write: true,
    }), 'RECOVERY_OUTPUT_SAFETY');
    assert.equal(lstatSync(agreementPath).isSymbolicLink(), true);
    assert.deepEqual(
      readFileSync(join(fixture.targetRoot, CONTEXT_COMPILATION_SET_PATH)),
      contextBytes,
    );
    assert.deepEqual(readFileSync(join(fixture.targetRoot, WORK2_RECEIPT_PATH)), receiptBytes);
  });

  await t.test('pre-transaction backup failure uses the public recovery error', (subtest) => {
    const fixture = work2RecoveryRunnerFixture(subtest);
    const tempRoot = mkdtempSync(join(tmpdir(), 'm7-v2-work2-invalid-temp-'));
    subtest.after(() => rmSync(tempRoot, { recursive: true, force: true }));
    const notDirectory = join(tempRoot, 'not-a-directory');
    writeFileSync(notDirectory, 'not a directory\n', 'utf8');
    const priorTemp = process.env.TMPDIR;
    process.env.TMPDIR = notDirectory;
    try {
      assertRecoveryError(recovery, () => recovery.recoverWork2({
        repoRoot: fixture.targetRoot,
        authorityPath: WORK2_RECOVERY_AUTHORITY_PATH,
        write: true,
      }), 'RECOVERY_OUTPUT_SAFETY');
    } finally {
      if (priorTemp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = priorTemp;
    }
    assertStaleOutputs(fixture.targetRoot, fixture.staleOutputBytes);
  });

  await t.test('rollback rejects a substituted backup and retains recovery bytes', (subtest) => {
    const fixture = work2RecoveryRunnerFixture(subtest);
    const backupParent = mkdtempSync(join(tmpdir(), 'm7-v2-work2-backup-parent-'));
    subtest.after(() => rmSync(backupParent, { recursive: true, force: true }));
    const validatorSource = [
      "import { copyFileSync, readdirSync, symlinkSync, unlinkSync } from 'node:fs';",
      "import path from 'node:path';",
      `const parent = ${JSON.stringify(backupParent)};`,
      "const name = readdirSync(parent).find((entry) => entry.startsWith('m7-v2-work2-recovery-'));",
      "if (!name) throw new Error('backup root missing');",
      "const root = path.join(parent, name);",
      "const target = path.join(root, 'target-0.bin');",
      "const shadow = path.join(root, 'shadow.bin');",
      'copyFileSync(target, shadow);',
      'unlinkSync(target);',
      "symlinkSync('shadow.bin', target);",
      "process.stderr.write('forced validator failure after backup substitution\\n');",
      'process.exitCode = 1;',
      '',
    ].join('\n');
    writeFileSync(join(fixture.targetRoot, WORK2_VALIDATOR_PATH), validatorSource, 'utf8');
    restampRecoveryAuthority(fixture.targetRoot, (authority) => {
      const index = authority.executable_bindings.findIndex(
        (entry) => entry.path === WORK2_VALIDATOR_PATH,
      );
      assert.notEqual(index, -1);
      authority.executable_bindings[index] = bindingForBytes(
        WORK2_VALIDATOR_PATH,
        readFileSync(join(fixture.targetRoot, WORK2_VALIDATOR_PATH)),
      );
    });
    const priorTemp = process.env.TMPDIR;
    process.env.TMPDIR = backupParent;
    try {
      assertRecoveryError(recovery, () => recovery.recoverWork2({
        repoRoot: fixture.targetRoot,
        authorityPath: WORK2_RECOVERY_AUTHORITY_PATH,
        write: true,
      }), 'ROLLBACK_FAILED');
    } finally {
      if (priorTemp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = priorTemp;
    }
    const retained = readdirSync(backupParent).filter(
      (entry) => entry.startsWith('m7-v2-work2-recovery-'),
    );
    assert.equal(retained.length, 1);
    assert.deepEqual(
      readFileSync(join(backupParent, retained[0], 'shadow.bin')),
      fixture.staleOutputBytes.get(AGREEMENT_ANALYSIS_SET_PATH),
    );
  });

  await t.test('Git metadata drift is detected and removed during rollback', (subtest) => {
    const fixture = work2RecoveryRunnerFixture(subtest);
    const markerPath = join(fixture.targetRoot, '.git', 'work2-recovery-effect');
    const validatorSource = [
      "import { writeFileSync } from 'node:fs';",
      "writeFileSync('.git/work2-recovery-effect', 'unexpected Git metadata write\\n');",
      "process.stdout.write(`${JSON.stringify({ status: 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE' })}\\n`);",
      '',
    ].join('\n');
    writeFileSync(join(fixture.targetRoot, WORK2_VALIDATOR_PATH), validatorSource, 'utf8');
    restampRecoveryAuthority(fixture.targetRoot, (authority) => {
      const index = authority.executable_bindings.findIndex(
        (entry) => entry.path === WORK2_VALIDATOR_PATH,
      );
      assert.notEqual(index, -1);
      authority.executable_bindings[index] = bindingForBytes(
        WORK2_VALIDATOR_PATH,
        readFileSync(join(fixture.targetRoot, WORK2_VALIDATOR_PATH)),
      );
    });

    assertRecoveryError(recovery, () => recovery.recoverWork2({
      repoRoot: fixture.targetRoot,
      authorityPath: WORK2_RECOVERY_AUTHORITY_PATH,
      write: true,
    }), 'RECOVERY_EFFECT_DRIFT');
    assert.equal(existsSync(markerPath), false);
    assertStaleOutputs(fixture.targetRoot, fixture.staleOutputBytes);
  });

  await t.test('existing Git configuration drift is restored exactly', (subtest) => {
    const fixture = work2RecoveryRunnerFixture(subtest);
    const configPath = join(fixture.targetRoot, '.git', 'config');
    const configBytes = readFileSync(configPath);
    const configMode = lstatSync(configPath).mode & 0o777;
    const backupParent = mkdtempSync(join(tmpdir(), 'm7-v2-work2-config-backup-'));
    subtest.after(() => rmSync(backupParent, { recursive: true, force: true }));
    installRecoveryValidator(fixture.targetRoot, [
      "import { appendFileSync, chmodSync } from 'node:fs';",
      "appendFileSync('.git/config', '\\n[work2-recovery]\\nmarker = drift\\n');",
      "chmodSync('.git/config', 0o600);",
      "process.stdout.write(`${JSON.stringify({ status: 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE' })}\\n`);",
      '',
    ].join('\n'));
    const priorTemp = process.env.TMPDIR;
    process.env.TMPDIR = backupParent;
    try {
      assertRecoveryError(recovery, () => recovery.recoverWork2({
        repoRoot: fixture.targetRoot,
        authorityPath: WORK2_RECOVERY_AUTHORITY_PATH,
        write: true,
      }), 'RECOVERY_EFFECT_DRIFT');
    } finally {
      if (priorTemp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = priorTemp;
    }
    assert.deepEqual(readFileSync(configPath), configBytes);
    assert.equal(lstatSync(configPath).mode & 0o777, configMode);
    assert.equal(existsSync(configPath), true);
    assertStaleOutputs(fixture.targetRoot, fixture.staleOutputBytes);
    assert.deepEqual(
      readdirSync(backupParent).filter(
        (entry) => entry.startsWith('m7-v2-work2-recovery-'),
      ),
      [],
    );
  });

  await t.test('unreadable existing Git metadata is restored before inventory', (subtest) => {
    const fixture = work2RecoveryRunnerFixture(subtest);
    const configPath = join(fixture.targetRoot, '.git', 'config');
    const configBytes = readFileSync(configPath);
    const configMode = lstatSync(configPath).mode & 0o777;
    const backupParent = mkdtempSync(join(tmpdir(), 'm7-v2-work2-mode-backup-'));
    subtest.after(() => rmSync(backupParent, { recursive: true, force: true }));
    installRecoveryValidator(fixture.targetRoot, [
      "import { appendFileSync, chmodSync } from 'node:fs';",
      "appendFileSync('.git/config', '\\n[work2-recovery]\\nmarker = unreadable\\n');",
      "chmodSync('.git/config', 0o000);",
      "process.stdout.write(`${JSON.stringify({ status: 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE' })}\\n`);",
      '',
    ].join('\n'));
    const priorTemp = process.env.TMPDIR;
    process.env.TMPDIR = backupParent;
    try {
      assertRecoveryError(recovery, () => recovery.recoverWork2({
        repoRoot: fixture.targetRoot,
        authorityPath: WORK2_RECOVERY_AUTHORITY_PATH,
        write: true,
      }), 'RECOVERY_EFFECT_DRIFT');
    } finally {
      if (priorTemp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = priorTemp;
    }
    assert.equal(existsSync(configPath), true);
    assert.deepEqual(readFileSync(configPath), configBytes);
    assert.equal(lstatSync(configPath).mode & 0o777, configMode);
    assertStaleOutputs(fixture.targetRoot, fixture.staleOutputBytes);
    assert.deepEqual(
      readdirSync(backupParent).filter(
        (entry) => entry.startsWith('m7-v2-work2-recovery-'),
      ),
      [],
    );
  });

  await t.test('deleted existing Git metadata is restored exactly', (subtest) => {
    const fixture = work2RecoveryRunnerFixture(subtest);
    const sentinelPath = join(fixture.targetRoot, '.git', 'work2-recovery-existing-sentinel');
    const sentinelBytes = Buffer.from('existing Git metadata sentinel\n', 'utf8');
    writeFileSync(sentinelPath, sentinelBytes);
    chmodSync(sentinelPath, 0o640);
    const sentinelMode = lstatSync(sentinelPath).mode & 0o777;
    const backupParent = mkdtempSync(join(tmpdir(), 'm7-v2-work2-delete-backup-'));
    subtest.after(() => rmSync(backupParent, { recursive: true, force: true }));
    installRecoveryValidator(fixture.targetRoot, [
      "import { unlinkSync } from 'node:fs';",
      "unlinkSync('.git/work2-recovery-existing-sentinel');",
      "process.stdout.write(`${JSON.stringify({ status: 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE' })}\\n`);",
      '',
    ].join('\n'));
    const priorTemp = process.env.TMPDIR;
    process.env.TMPDIR = backupParent;
    try {
      assertRecoveryError(recovery, () => recovery.recoverWork2({
        repoRoot: fixture.targetRoot,
        authorityPath: WORK2_RECOVERY_AUTHORITY_PATH,
        write: true,
      }), 'RECOVERY_EFFECT_DRIFT');
    } finally {
      if (priorTemp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = priorTemp;
    }
    assert.equal(existsSync(sentinelPath), true);
    assert.deepEqual(readFileSync(sentinelPath), sentinelBytes);
    assert.equal(lstatSync(sentinelPath).mode & 0o777, sentinelMode);
    assertStaleOutputs(fixture.targetRoot, fixture.staleOutputBytes);
    assert.deepEqual(
      readdirSync(backupParent).filter(
        (entry) => entry.startsWith('m7-v2-work2-recovery-'),
      ),
      [],
    );
  });
});

test('Work2 finaliser rejects execution-case list drift', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const { targetRoot } = work2FixtureRepository(manifest);
  const fixturePath = join(targetRoot, WORK2_EXECUTION_FIXTURE_PATH);

  try {
    const drifted = JSON.parse(readFileSync(fixturePath, 'utf8'));
    drifted.case_ids = drifted.case_ids.slice(0, -1);
    writeFileSync(fixturePath, `${canonicalJson(drifted)}\n`, 'utf8');
    assert.throws(
      () => finaliser.finaliseWork2({ repoRoot: targetRoot, write: false }),
      (error) => error?.code === 'WORK2_COMMAND_LEDGER_DRIFT',
    );
    for (const outputPath of WORK2_OUTPUT_PATHS) {
      assert.equal(existsSync(join(targetRoot, outputPath)), false);
    }
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 finaliser creates exactly three outputs once and the independent validator closes them', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const validator = await import(`../${WORK2_VALIDATOR_PATH}`);
  const { targetRoot, executionFixture } = work2FixtureRepository(manifest);

  try {
    const result = finaliser.finaliseWork2({ repoRoot: targetRoot, write: true });
    assert.equal(result.status, 'PASS_WORK2_FINALISATION');
    assert.deepEqual(result.target_paths, WORK2_OUTPUT_PATHS);
    assert.deepEqual(result.effects, {
      files_written: 3,
      source_set_writes: 2,
      receipt_writes: 1,
      candidate_registration_writes: 0,
      model_calls: 0,
      network_reads: 0,
      network_writes: 0,
      database_writes: 0,
      product_writes: 0,
      m0_m4_mutations: 0,
      m8_actions: 0,
      v2_shadow_analysis_runs: 0,
      v2_shadow_projection_runs: 0,
    });
    for (const outputPath of WORK2_OUTPUT_PATHS) {
      assert.equal(existsSync(join(targetRoot, outputPath)), true);
    }

    const receipt = JSON.parse(readFileSync(join(targetRoot, WORK2_RECEIPT_PATH), 'utf8'));
    assert.deepEqual(Object.keys(receipt).sort(), [...WORK2_RECEIPT_KEYS].sort());
    assert.equal(receipt.state, 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE');
    assert.equal(receipt.candidate_registration_id, null);
    assert.equal(receipt.candidate_transition, null);
    assert.equal(receipt.artifact_bindings.length, 21);
    assert.deepEqual(
      receipt.artifact_bindings.map((entry) => entry.path),
      manifest.exact_git_commit_and_push_argv[0].slice(3)
        .filter((selectedPath) => selectedPath !== WORK2_RECEIPT_PATH),
    );
    assert.deepEqual(
      receipt.command_execution_ledger.map((entry) => entry.run_count),
      executionFixture.command_run_counts,
    );
    assert.deepEqual(receipt.combined_test_result, {
      argv: manifest.exact_argv_with_run_limits[8].argv,
      ...executionFixture.combined_test_result,
    });

    const validation = validator.validateWork2({ repoRoot: targetRoot });
    assert.equal(validation.status, 'PASS_WORK2_BUILD_ONLY_NULL_CANDIDATE');
    assert.equal(validation.work2_receipt_id, result.work2_receipt_id);
    assert.equal(validation.agreement_analysis_set_id, result.agreement_analysis_set_id);
    assert.equal(validation.context_compilation_set_id, result.context_compilation_set_id);
    const receiptBinding = bindingForRecord(
      WORK2_RECEIPT_PATH,
      receipt,
      'work2_receipt_id',
    );
    mkdirSync(join(targetRoot, CANDIDATE_ROOT), { recursive: true });
    writeFileSync(join(targetRoot, CANDIDATE_ROOT, `${'a'.repeat(64)}.json`), '{}\n');
    const historicalValidation = validator.validateWork2ReceiptBinding({
      repoRoot: targetRoot,
      binding: receiptBinding,
    });
    assert.equal(historicalValidation.work2_receipt_id, receipt.work2_receipt_id);
    assert.throws(
      () => validator.validateWork2({ repoRoot: targetRoot }),
      (error) => error?.code === 'WORK2_BUILD_ONLY_ORDERING_DRIFT',
    );
    rmSync(join(targetRoot, CANDIDATE_ROOT), { recursive: true, force: true });
    const beforeSecondAttempt = new Map(WORK2_OUTPUT_PATHS.map((selectedPath) => [
      selectedPath, readFileSync(join(targetRoot, selectedPath)),
    ]));
    writeFileSync(
      join(targetRoot, WORK2_EXECUTION_FIXTURE_PATH), '{invalid competing input', 'utf8',
    );
    assert.throws(
      () => finaliser.finaliseWork2({ repoRoot: targetRoot, write: true }),
      (error) => error?.code === 'WORK2_ALREADY_FINALISED',
    );
    for (const selectedPath of WORK2_OUTPUT_PATHS) {
      assert.deepEqual(
        readFileSync(join(targetRoot, selectedPath)), beforeSecondAttempt.get(selectedPath),
      );
    }
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 finaliser rejects a partial output set before reading semantic inputs', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const { targetRoot } = work2FixtureRepository(manifest);
  const occupiedPath = join(targetRoot, AGREEMENT_ANALYSIS_SET_PATH);
  const occupiedBytes = Buffer.from('pre-existing-output', 'utf8');

  try {
    writeFileSync(occupiedPath, occupiedBytes);
    writeFileSync(
      join(targetRoot, WORK2_EXECUTION_FIXTURE_PATH), '{invalid competing input', 'utf8',
    );
    assert.throws(
      () => finaliser.finaliseWork2({ repoRoot: targetRoot, write: true }),
      (error) => error?.code === 'WORK2_OUTPUT_STATE_DRIFT',
    );
    assert.deepEqual(readFileSync(occupiedPath), occupiedBytes);
    assert.equal(existsSync(join(targetRoot, CONTEXT_COMPILATION_SET_PATH)), false);
    assert.equal(existsSync(join(targetRoot, WORK2_RECEIPT_PATH)), false);
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 finaliser rejects a repository-root symlink before any read or write', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const validator = await import(`../${WORK2_VALIDATOR_PATH}`);
  const { targetRoot } = work2FixtureRepository(manifest);
  const alias = `${targetRoot}-alias`;

  try {
    symlinkSync(targetRoot, alias, 'dir');
    assert.throws(
      () => finaliser.finaliseWork2({ repoRoot: alias, write: true }),
      (error) => error?.code === 'WORK2_OUTPUT_SAFETY',
    );
    assert.throws(
      () => validator.validateWork2({ repoRoot: alias }),
      (error) => error?.code === 'WORK2_RECEIPT_SAFETY',
    );
    for (const selectedPath of WORK2_OUTPUT_PATHS) {
      assert.equal(existsSync(join(targetRoot, selectedPath)), false);
    }
  } finally {
    if (existsSync(alias)) unlinkSync(alias);
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('Work2 finaliser rolls back both source sets after a real receipt-write failure', async () => {
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, WORK2_MANIFEST_PATH), 'utf8'));
  const finaliser = await import(`../${WORK2_FINALISER_PATH}`);
  const { targetRoot } = work2FixtureRepository(manifest);
  const receiptDirectory = dirname(join(targetRoot, WORK2_RECEIPT_PATH));

  try {
    chmodSync(receiptDirectory, 0o555);
    assert.throws(
      () => finaliser.finaliseWork2({ repoRoot: targetRoot, write: true }),
      (error) => error?.code === 'WORK2_WRITE_FAILED',
    );
    for (const selectedPath of WORK2_OUTPUT_PATHS) {
      assert.equal(existsSync(join(targetRoot, selectedPath)), false);
    }
  } finally {
    chmodSync(receiptDirectory, 0o755);
    rmSync(targetRoot, { recursive: true, force: true });
  }
});
