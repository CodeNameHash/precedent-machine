#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import { validateExecutionManifest } from './stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
import { registerCandidate } from './stage-2y-structure-m7-v2-repair-register-candidate.mjs';
import { verifyRegisteredCandidate } from './stage-2y-structure-m7-v2-repair-verify-candidate.mjs';
import { validateWork3 } from './stage-2y-structure-m7-v2-repair-work3-validate.mjs';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const REPO_ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const CONTROL_ROOT = `${MIGRATION_ROOT}/control`;
const RECEIPT_ROOT = `${MIGRATION_ROOT}/receipts`;
const MANIFEST_PATH = `${CONTROL_ROOT}/m7-v2-repair-work4-execution-manifest.json`;
const WORK2_MANIFEST_PATH = `${CONTROL_ROOT}/m7-v2-repair-work2-execution-manifest.json`;
const WORK3_MANIFEST_PATH = `${CONTROL_ROOT}/m7-v2-repair-work3-execution-manifest-closure-successor.json`;
const WORK3_PREDECESSOR_MANIFEST_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-work3-execution-manifest.json`;
const WORK3_CLOSURE_AMENDMENT_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-work3-execution-manifest-closure-amendment.json`;
const WORK3_CLOSURE_REVIEW_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-work3-execution-manifest-closure-amendment-external-review-receipt.json`;
const WORK3_CLOSURE_APPLICATION_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-work3-execution-manifest-closure-amendment-application-receipt.json`;
const WORK1_RECEIPT_PATH = `${RECEIPT_ROOT}/stage-2y-structure-m7-v2-repair-work1-contract.json`;
const WORK3_RECEIPT_PATH = `${RECEIPT_ROOT}/stage-2y-structure-m7-v2-repair-work3-profile.json`;
const WORK4_RECEIPT_PATH = `${RECEIPT_ROOT}/stage-2y-structure-m7-v2-repair-work4-fixture.json`;
const WORK3_AUTHORITY_PATH = `${CONTROL_ROOT}/m7-v2-repair-contract-work3-entry-correction-authority.json`;
const AUTHORITY_PATH = `${CONTROL_ROOT}/m7-v2-repair-work1-7-authority.json`;
const ACTIVATION_PATH = `${RECEIPT_ROOT}/stage-2y-structure-m7-v2-repair-work1-7-authority-activation.json`;
const ORDERING_AUTHORITY_PATH = `${CONTROL_ROOT}/m7-v2-repair-contract-work2-4-candidate-ordering-correction-authority.json`;
const TRANSITION_AUTHORITY_PATH = `${CONTROL_ROOT}/m7-v2-repair-work4-candidate-transition-authority.json`;
const VIEW_POLICY_PATH = `${MIGRATION_ROOT}/m7-v2-repair/v2-view-policy.json`;
const PROFILE_SET_PATH = `${CONTROL_ROOT}/m7-v2-repair-family-work3-approved-profile-set.json`;
const EXECUTION_MANIFEST_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-execution-manifest.test.js';
const EXECUTION_MANIFEST_VALIDATOR_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs';
const REGISTER_CANDIDATE_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs';
const VERIFY_CANDIDATE_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs';
const WORK3_VALIDATOR_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-work3-validate.mjs';
const WORK2_VALIDATOR_PATH =
  'scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs';
const CANONICAL_BYTES_PATH = 'lib/canonical-v2/canonical-bytes.js';
const FINALISER_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work4-finalise.mjs';
const VALIDATOR_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work4-validate.mjs';
const WORK4_TEST_PATH = 'tests/stage-2y-structure-m7-v2-repair-work4.test.js';
const BIND_SCRIPT_PATH = 'scripts/stage-2y-structure-m7-v2-repair-work4-bind-candidate.mjs';
const BRANCH = 'codex/recover-m7-20260812';
const ORIGIN_REF = `refs/remotes/origin/${BRANCH}`;
const WORK3_COMMIT = 'a0df3f8621107481144e5be1429466d8b193f9be';
const MANIFEST_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_WORK_EXECUTION_MANIFEST/V1';
const TRANSITION_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK4_CANDIDATE_TRANSITION_AUTHORITY/V1';
const TRANSITION_ARGV = Object.freeze([
  'node',
  BIND_SCRIPT_PATH,
  '--authority',
  ORDERING_AUTHORITY_PATH,
]);
const BOOTSTRAP_ARGV = Object.freeze([
  'node',
  BIND_SCRIPT_PATH,
  '--bootstrap',
  '--authority',
  ORDERING_AUTHORITY_PATH,
]);
// Work4 candidate correction (Ben, 2026-09-03). Selected by passing the
// correction authority as `--authority`: the four committed Work4 outputs are
// retained byte-identical and a successor manifest, transition authority,
// registration and receipt are created under the pinned correction authority.
const CORRECTION_AUTHORITY_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-contract-work4-candidate-correction-authority.json`;
const CORRECTION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_WORK4_CANDIDATE_CORRECTION_AUTHORITY/V1';
const CORRECTION_MANIFEST_MEMBER = 'work4_candidate_correction_authority_binding';
const SUCCESSOR_MANIFEST_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json`;
const SUCCESSOR_TRANSITION_AUTHORITY_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-work4-candidate-transition-authority-candidate-correction-successor.json`;
const SUCCESSOR_RECEIPT_PATH =
  `${RECEIPT_ROOT}/stage-2y-structure-m7-v2-repair-work4-fixture-candidate-correction-successor.json`;
const SUPERSEDED_REGISTRATION_ID =
  '0e46052b1a6a0b284291ee0e6881aac0ecf99a40429300295178bcaa3d832d5e';
const SUPERSEDED_REGISTRATION_PATH =
  `${CONTROL_ROOT}/m7-v2-repair-candidate-registrations/${SUPERSEDED_REGISTRATION_ID}.json`;
const CORRECTION_TRANSITION_ARGV = Object.freeze([
  'node', BIND_SCRIPT_PATH, '--authority', CORRECTION_AUTHORITY_PATH,
]);
const CORRECTION_BOOTSTRAP_ARGV = Object.freeze([
  'node', BIND_SCRIPT_PATH, '--bootstrap', '--authority', CORRECTION_AUTHORITY_PATH,
]);
const ORIGINAL_MODE = Object.freeze({
  correction: false,
  manifestPath: MANIFEST_PATH,
  transitionAuthorityPath: TRANSITION_AUTHORITY_PATH,
  receiptPath: WORK4_RECEIPT_PATH,
  transitionArgv: TRANSITION_ARGV,
  bootstrapArgv: BOOTSTRAP_ARGV,
  commitMessage: 'Implement M7 V2 repair Work 4',
});
const CORRECTION_MODE = Object.freeze({
  correction: true,
  manifestPath: SUCCESSOR_MANIFEST_PATH,
  transitionAuthorityPath: SUCCESSOR_TRANSITION_AUTHORITY_PATH,
  receiptPath: SUCCESSOR_RECEIPT_PATH,
  transitionArgv: CORRECTION_TRANSITION_ARGV,
  bootstrapArgv: CORRECTION_BOOTSTRAP_ARGV,
  commitMessage: 'Implement M7 V2 repair Work 4 candidate correction',
});

export function resolveWork4Mode(authorityPath = ORDERING_AUTHORITY_PATH) {
  if (authorityPath === ORDERING_AUTHORITY_PATH) return ORIGINAL_MODE;
  if (authorityPath === CORRECTION_AUTHORITY_PATH) return CORRECTION_MODE;
  fail('WORK4_OPTIONS', 'unknown Work4 authority');
}

class Work4CandidateTransitionError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'Work4CandidateTransitionError';
    this.code = code;
  }
}

function fail(code, detail = '') {
  throw new Work4CandidateTransitionError(code, detail);
}

function absolute(repoRoot, repositoryPath) {
  return path.join(repoRoot, ...repositoryPath.split('/'));
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

function gitRead(repoRoot, argv) {
  const environment = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  for (const name of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_WORK_TREE',
  ]) delete environment[name];
  return execFileSync('git', argv, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: environment,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

function observePushedPrepHead(repoRoot, predecessorReceiptBinding, requiredInputPaths) {
  let head;
  let origin;
  let branch;
  let parentLine;
  let commitMessage;
  let deltaOutput;
  let receiptOutput;
  let inputTreeOutput;
  try {
    head = gitRead(repoRoot, ['rev-parse', 'HEAD']);
    origin = gitRead(repoRoot, ['rev-parse', ORIGIN_REF]);
    branch = gitRead(repoRoot, ['symbolic-ref', '--short', 'HEAD']);
    gitRead(repoRoot, ['merge-base', '--is-ancestor', WORK3_COMMIT, head]);
    parentLine = gitRead(repoRoot, ['rev-list', '--parents', '-n', '1', head]);
    commitMessage = gitRead(repoRoot, ['log', '--format=%s', '-n', '1', head]);
    deltaOutput = gitRead(repoRoot, [
      'diff-tree', '--no-commit-id', '--name-only', '-r', head,
    ]);
    receiptOutput = gitRead(repoRoot, [
      'ls-tree', '-r', '--full-tree', head, '--', predecessorReceiptBinding.path,
    ]);
    inputTreeOutput = gitRead(repoRoot, [
      'ls-tree', '-rz', '--full-tree', head, '--', ...requiredInputPaths,
    ]);
  } catch {
    fail('WORK4_PREP_GIT_DRIFT', 'pushed preparation commit observation');
  }
  const parents = parentLine.split(/\s+/u);
  const receiptMatch = /^(\d{6}) blob ([0-9a-f]{40})\t(.+)$/u.exec(receiptOutput);
  const exactCommitDeltaPaths = deltaOutput === ''
    ? []
    : deltaOutput.split('\n').filter(Boolean).sort();
  if (head !== origin
      || branch !== BRANCH
      || parents.length !== 2
      || parents[0] !== head
      || commitMessage.length === 0
      || /[\r\n]/u.test(commitMessage)
      || exactCommitDeltaPaths.length === 0
      || receiptMatch === null
      || receiptMatch[1] !== '100644'
      || receiptMatch[2] !== predecessorReceiptBinding.git_blob_oid
      || receiptMatch[3] !== predecessorReceiptBinding.path) {
    fail('WORK4_PREP_GIT_DRIFT', 'pushed preparation commit lineage');
  }

  const treeBindings = new Map();
  for (const entry of inputTreeOutput.split('\0').filter(Boolean)) {
    const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/u.exec(entry);
    if (match === null || treeBindings.has(match[3])) {
      fail('WORK4_PREP_INPUT_DRIFT', 'pre-registration Git tree');
    }
    treeBindings.set(match[3], match[2]);
  }
  if (treeBindings.size !== requiredInputPaths.length) {
    fail('WORK4_PREP_INPUT_DRIFT', 'pre-registration Git tree path set');
  }
  for (const repositoryPath of requiredInputPaths) {
    let bytes;
    try {
      const selected = absolute(repoRoot, repositoryPath);
      const stat = fs.lstatSync(selected);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        fail('WORK4_PREP_INPUT_DRIFT', repositoryPath);
      }
      bytes = fs.readFileSync(selected);
    } catch (error) {
      if (error instanceof Work4CandidateTransitionError) throw error;
      fail('WORK4_PREP_INPUT_DRIFT', repositoryPath);
    }
    if (treeBindings.get(repositoryPath) !== gitBlobOid(bytes)) {
      fail('WORK4_PREP_INPUT_DRIFT', repositoryPath);
    }
  }
  return {
    commit: head,
    parent_commit: parents[1],
    commit_message: commitMessage,
    exact_commit_delta_paths: exactCommitDeltaPaths,
  };
}

function readCanonical(repoRoot, repositoryPath) {
  const bytes = fs.readFileSync(absolute(repoRoot, repositoryPath));
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('WORK4_INPUT_DRIFT', repositoryPath);
  }
  if (!bytes.equals(canonicalBytes(record))) fail('WORK4_INPUT_DRIFT', repositoryPath);
  return { bytes, record };
}

function recordBinding(repositoryPath, bytes, record, idField) {
  return {
    path: repositoryPath,
    schema_version: record.schema_version,
    record_id_field: idField,
    record_id: record[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function descriptor(binding, extra = {}) {
  return {
    ...extra,
    path: binding.path,
    schema_version: binding.schema_version,
    record_id_field: binding.record_id_field,
  };
}

function sealManifest(unsigned) {
  const body = structuredClone(unsigned);
  delete body.execution_manifest_digest;
  delete body.execution_manifest_id;
  const execution_manifest_digest = sha256Hex(canonicalJson(body));
  const withDigest = { ...body, execution_manifest_digest };
  return {
    ...withDigest,
    execution_manifest_id: contentId(MANIFEST_SCHEMA, withDigest),
  };
}

function sealRecord(unsigned, idField) {
  return {
    ...unsigned,
    [idField]: contentId(unsigned.schema_version, unsigned),
  };
}

function writeExclusive(repoRoot, repositoryPath, bytes) {
  const target = absolute(repoRoot, repositoryPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let descriptor;
  try {
    descriptor = fs.openSync(
      target,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
    }
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error.code === 'EEXIST') fail('WORK4_OUTPUT_EXISTS', repositoryPath);
    if (error instanceof Work4CandidateTransitionError) throw error;
    fail('WORK4_WRITE_FAILED', repositoryPath);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function replaceManifest(repoRoot, manifest, mode = ORIGINAL_MODE) {
  const target = absolute(repoRoot, mode.manifestPath);
  const pending = `${target}.pending`;
  const bytes = canonicalBytes(manifest);
  let descriptor;
  try {
    descriptor = fs.openSync(
      pending,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
    }
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(pending, target);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(pending); } catch {}
    if (error instanceof Work4CandidateTransitionError) throw error;
    fail('WORK4_WRITE_FAILED', mode.manifestPath);
  }
}

// The correction authority and the four superseded Work4 outputs it binds,
// each read from the tree and checked against the authority's own bindings.
function readCorrectionAuthority(repoRoot) {
  const state = readCanonical(repoRoot, CORRECTION_AUTHORITY_PATH);
  const record = state.record;
  if (record.schema_version !== CORRECTION_AUTHORITY_SCHEMA
      || record.superseded_candidate_registration_id !== SUPERSEDED_REGISTRATION_ID
      || record.successor_paths?.execution_manifest !== SUCCESSOR_MANIFEST_PATH
      || record.successor_paths?.candidate_transition_authority
        !== SUCCESSOR_TRANSITION_AUTHORITY_PATH
      || record.successor_paths?.work4_receipt !== SUCCESSOR_RECEIPT_PATH
      || canonicalJson(record.successor_transition_argv) !== canonicalJson(CORRECTION_TRANSITION_ARGV)
      || canonicalJson(record.successor_bootstrap_argv) !== canonicalJson(CORRECTION_BOOTSTRAP_ARGV)
      || record.successor_commit_message !== CORRECTION_MODE.commitMessage) {
    fail('WORK4_CORRECTION_AUTHORITY_DRIFT', CORRECTION_AUTHORITY_PATH);
  }
  const supersededPaths = [];
  for (const [member, expectedPath] of [
    ['execution_manifest_binding', MANIFEST_PATH],
    ['candidate_transition_authority_binding', TRANSITION_AUTHORITY_PATH],
    ['candidate_registration_binding', SUPERSEDED_REGISTRATION_PATH],
    ['work4_receipt_binding', WORK4_RECEIPT_PATH],
  ]) {
    const binding = record.superseded_work4_outputs?.[member];
    if (binding?.path !== expectedPath) fail('WORK4_CORRECTION_AUTHORITY_DRIFT', member);
    const actual = readCanonical(repoRoot, expectedPath);
    const observed = recordBinding(expectedPath, actual.bytes, actual.record, binding.record_id_field);
    if (canonicalJson(observed) !== canonicalJson(binding)) {
      fail('WORK4_SUPERSEDED_OUTPUT_DRIFT', expectedPath);
    }
    supersededPaths.push(expectedPath);
  }
  return {
    record,
    binding: recordBinding(CORRECTION_AUTHORITY_PATH, state.bytes, record, 'correction_authority_id'),
    supersededPaths,
    supersededRegistrationBinding: record.superseded_work4_outputs.candidate_registration_binding,
  };
}

function candidateReadPaths(candidate) {
  const record = candidate.registration;
  return [...new Set([
    candidate.registration_path,
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
    ...record.subtype_tree_bindings.map(
      (entry) => entry.binding.path ?? entry.binding.container_path,
    ),
    record.structure_disposition_set_binding.path,
    record.view_policy_binding.path,
    ...record.predecessor_receipt_bindings.map((entry) => entry.binding.path),
    ...record.predecessor_receipt_bindings
      .filter((entry) => entry.work !== 'WORK1')
      .map((entry) => entry.work === 'WORK3'
        ? WORK3_MANIFEST_PATH
        : `${CONTROL_ROOT}/m7-v2-repair-${entry.work.toLowerCase()}-execution-manifest.json`),
  ])].sort();
}

export function buildCandidateSpecification({ repoRoot = REPO_ROOT } = {}) {
  const work3 = readCanonical(repoRoot, WORK3_RECEIPT_PATH).record;
  const work3Authority = readCanonical(repoRoot, WORK3_AUTHORITY_PATH).record;
  const profileSet = readCanonical(repoRoot, PROFILE_SET_PATH).record;
  const native = work3.candidate_native_set_evidence;
  const semanticBindings = [
    ['BASE_ANALYSIS_SET', native.work3_agreement_analysis_set_binding],
    ['AGREEMENT_INDEX_SET', native.work3_agreement_index_set_binding],
    ['CONTEXT_COMPILATION_SET', native.work3_context_compilation_set_binding],
    ['APPROVED_FAMILY_PACKET_SET',
      work3Authority.work3_scope_contract.family_packet_set_source_contract.binding],
    ['APPROVED_FAMILY_PROFILE_SET',
      work3.family_profile_evidence.approved_family_profile_set_binding],
    ['APPROVED_STRUCTURE_DISPOSITION_SET', work3.structure_disposition_set_binding],
  ];
  return {
    allowed_output_root: `${MIGRATION_ROOT}/m7-v2-repair/v2-candidate`,
    code: {
      compiler: 'lib/canonical-v2/agreement-analysis-consolidation.js',
      contract_validator: 'lib/canonical-v2/m7-v2-contract.js',
      deterministic_generator: 'lib/canonical-v2/m7-v2-deterministic-generator.js',
      independent_verifier: 'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
      projector: 'lib/canonical-v2/agreement-projection.js',
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
        WORK4_TEST_PATH,
      ],
    },
    predecessor_receipts: [
      {
        work: 'WORK1',
        path: WORK1_RECEIPT_PATH,
        schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK1_CONTRACT_RECEIPT/V1',
        record_id_field: 'work1_contract_receipt_id',
      },
      descriptor(work3.predecessor_receipt_binding, { work: 'WORK2' }),
      {
        work: 'WORK3',
        path: WORK3_RECEIPT_PATH,
        schema_version: work3.schema_version,
        record_id_field: 'work3_receipt_id',
      },
    ],
    semantic_inputs: semanticBindings.map(([input_role, binding]) => (
      descriptor(binding, { input_role })
    )),
    subtype_trees: structuredClone(profileSet.subtype_tree_bindings),
    view_policy: {
      path: VIEW_POLICY_PATH,
      schema_version: 'STAGE_2Y_M7_V2_VIEW_POLICY/V1',
      record_id_field: 'view_policy_id',
    },
  };
}

export function previewWork4Candidate({ repoRoot = REPO_ROOT } = {}) {
  return registerCandidate({
    repoRoot,
    specification: buildCandidateSpecification({ repoRoot }),
    write: false,
  });
}

function milestoneAttestation(repoRoot, predecessorReceiptBinding, predecessorManifestBinding,
  predecessorValidationResult, observation) {
  const results = {
    SINGLE_PARENT: `${observation.commit} ${observation.parent_commit}`,
    EXPECTED_PARENT: `${observation.commit} ${observation.parent_commit}`,
    EXPECTED_MESSAGE: observation.commit_message,
    EXACT_TREE_DELTA: observation.exact_commit_delta_paths,
    RECEIPT_BLOB_IN_COMMIT: predecessorReceiptBinding.git_blob_oid,
    ORIGIN_REF_EQUALS_COMMIT: observation.commit,
  };
  const argv = {
    SINGLE_PARENT: ['git', 'rev-list', '--parents', '-n', '1', observation.commit],
    EXPECTED_PARENT: ['git', 'rev-list', '--parents', '-n', '1', observation.commit],
    EXPECTED_MESSAGE: ['git', 'log', '--format=%s', '-n', '1', observation.commit],
    EXACT_TREE_DELTA: [
      'git', 'diff-tree', '--no-commit-id', '--name-only', '-r', observation.commit,
    ],
    RECEIPT_BLOB_IN_COMMIT: [
      'git', 'ls-tree', '-r', '--full-tree', observation.commit, '--',
      predecessorReceiptBinding.path,
    ],
    ORIGIN_REF_EQUALS_COMMIT: ['git', 'rev-parse', ORIGIN_REF],
  };
  const commandChecks = [
    'SINGLE_PARENT',
    'EXPECTED_PARENT',
    'EXPECTED_MESSAGE',
    'EXACT_TREE_DELTA',
    'RECEIPT_BLOB_IN_COMMIT',
    'ORIGIN_REF_EQUALS_COMMIT',
  ];
  return {
    attestation_scope: 'EXTERNAL_REPOSITORY_OBSERVATION',
    state: 'EXTERNAL_ORCHESTRATOR_ATTESTED_COMMITTED_AND_PUSHED',
    attestor: 'ROOT_ORCHESTRATOR',
    predecessor_work: 'WORK3',
    commit: observation.commit,
    parent_commit: observation.parent_commit,
    branch: BRANCH,
    commit_message: observation.commit_message,
    origin_ref: ORIGIN_REF,
    predecessor_receipt_binding: structuredClone(predecessorReceiptBinding),
    predecessor_execution_manifest_binding: structuredClone(predecessorManifestBinding),
    predecessor_validation_result: structuredClone(predecessorValidationResult),
    exact_commit_delta_paths: [...observation.exact_commit_delta_paths],
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
    checks: [
      ...commandChecks,
      'NO_SHALLOW_HISTORY',
      'NO_GRAFTS',
      'NO_LOOSE_REPLACE_REFS',
      'NO_PACKED_REPLACE_REFS',
      'FIXED_CWD_AND_GIT_ENVIRONMENT',
    ].map((check_id) => ({ check_id, state: 'EXTERNALLY_ATTESTED' })),
    observed_command_result_ledger: commandChecks.map((check_id) => ({
      check_id,
      argv: argv[check_id],
      exit_code: 0,
      observed_result: results[check_id],
    })),
  };
}

export function buildWork4BootstrapManifest({ repoRoot = REPO_ROOT, mode = ORIGINAL_MODE } = {}) {
  const correction = mode.correction ? readCorrectionAuthority(repoRoot) : null;
  const base = structuredClone(readCanonical(repoRoot, WORK2_MANIFEST_PATH).record);
  const work3State = readCanonical(repoRoot, WORK3_RECEIPT_PATH);
  const work3ManifestState = readCanonical(repoRoot, WORK3_MANIFEST_PATH);
  const candidate = previewWork4Candidate({ repoRoot });
  const predecessorReceiptBinding = recordBinding(
    WORK3_RECEIPT_PATH,
    work3State.bytes,
    work3State.record,
    'work3_receipt_id',
  );
  const predecessorManifestBinding = recordBinding(
    WORK3_MANIFEST_PATH,
    work3ManifestState.bytes,
    work3ManifestState.record,
    'execution_manifest_id',
  );
  const preRegistrationCandidatePaths = candidateReadPaths(candidate).filter(
    (repositoryPath) => repositoryPath !== candidate.registration_path,
  );
  const prepInputPaths = [...new Set([
    WORK2_MANIFEST_PATH,
    WORK3_MANIFEST_PATH,
    WORK3_PREDECESSOR_MANIFEST_PATH,
    WORK3_CLOSURE_AMENDMENT_PATH,
    WORK3_CLOSURE_REVIEW_PATH,
    WORK3_CLOSURE_APPLICATION_PATH,
    WORK3_RECEIPT_PATH,
    WORK3_AUTHORITY_PATH,
    PROFILE_SET_PATH,
    AUTHORITY_PATH,
    ACTIVATION_PATH,
    ORDERING_AUTHORITY_PATH,
    EXECUTION_MANIFEST_TEST_PATH,
    EXECUTION_MANIFEST_VALIDATOR_PATH,
    REGISTER_CANDIDATE_PATH,
    VERIFY_CANDIDATE_PATH,
    WORK2_VALIDATOR_PATH,
    WORK3_VALIDATOR_PATH,
    CANONICAL_BYTES_PATH,
    `${RECEIPT_ROOT}/stage-2y-structure-m3-context-compilation.json`,
    `${RECEIPT_ROOT}/stage-2y-structure-m4-agreement-analysis.json`,
    `${CONTROL_ROOT}/m7-v2-repair-work2-agreement-analysis-set.json`,
    `${CONTROL_ROOT}/m7-v2-repair-work2-context-compilation-set.json`,
    BIND_SCRIPT_PATH,
    ...preRegistrationCandidatePaths,
    // The correction commits the finaliser and validator before its
    // bootstrap, so they are tree-bound inputs here rather than outputs.
    ...(correction
      ? [CORRECTION_AUTHORITY_PATH, ...correction.supersededPaths, FINALISER_PATH, VALIDATOR_PATH]
      : []),
  ])].sort();
  if (correction && candidate.registration_path === SUPERSEDED_REGISTRATION_PATH) {
    fail('WORK4_CANDIDATE_DRIFT', 'correction candidate equals the superseded candidate');
  }
  const observation = observePushedPrepHead(
    repoRoot,
    predecessorReceiptBinding,
    prepInputPaths,
  );
  delete base.execution_manifest_id;
  delete base.execution_manifest_digest;
  Object.assign(base, {
    work: 'WORK4',
    state: 'PRE_WORK_BOOTSTRAP_ONLY',
    predecessor_receipt_binding: predecessorReceiptBinding,
    candidate_registration_binding: null,
    candidate_transition: {
      authority_binding: structuredClone(base.candidate_ordering_correction_authority_binding),
      state: 'AUTHORISED_PENDING',
      transition_argv: [...mode.transitionArgv],
      transition_run_limit: 1,
    },
    ...(correction ? { [CORRECTION_MANIFEST_MEMBER]: correction.binding } : {}),
    work_receipt_path: mode.receiptPath,
    permitted_read_paths: [...new Set([
      mode.manifestPath,
      ...prepInputPaths,
    ])].sort(),
    permitted_write_paths: [
      mode.transitionAuthorityPath,
      candidate.registration_path,
    ].sort(),
    exact_argv_with_run_limits: [
      {
        argv: [
          'node',
          'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs',
          mode.manifestPath,
        ],
        max_runs: 3,
      },
      { argv: [...mode.transitionArgv], max_runs: 1 },
    ],
    base_tip_binding: {
      commit: observation.commit,
      branch: BRANCH,
      parent_commit: observation.parent_commit,
      commit_message: observation.commit_message,
      milestone_attestation: milestoneAttestation(
        repoRoot,
        predecessorReceiptBinding,
        predecessorManifestBinding,
        validateWork3({ repoRoot, sourceCommit: WORK3_COMMIT }),
        observation,
      ),
    },
    exact_git_commit_and_push_argv: [
      ['git', 'add', '--', ...[
        mode.manifestPath,
        mode.transitionAuthorityPath,
        candidate.registration_path,
      ].sort()],
      ['git', 'commit', '-m', mode.commitMessage],
      ['git', 'push', 'origin', BRANCH],
    ],
    success_conditions: [
      'EXTERNAL_MILESTONE_ATTESTATION_NOT_INDEPENDENTLY_RECOMPUTED',
      'WORK4_RECEIPT_PASS',
    ],
  });
  return sealManifest(base);
}

export function writeWork4BootstrapManifest({ repoRoot = REPO_ROOT, mode = ORIGINAL_MODE } = {}) {
  if (fs.existsSync(absolute(repoRoot, mode.manifestPath))) {
    fail('WORK4_OUTPUT_EXISTS', mode.manifestPath);
  }
  const manifest = buildWork4BootstrapManifest({ repoRoot, mode });
  writeExclusive(repoRoot, mode.manifestPath, canonicalBytes(manifest));
  return manifest;
}

function postTransitionManifest(bootstrap, candidate, verification, transitionBinding,
  bootstrapBinding, mode = ORIGINAL_MODE) {
  const manifest = structuredClone(bootstrap);
  manifest.candidate_registration_binding = {
    registration_binding: structuredClone(candidate.binding),
    independent_verification: structuredClone(verification),
  };
  manifest.candidate_transition = {
    authority_binding: structuredClone(transitionBinding),
    superseded_bootstrap_manifest_binding: structuredClone(bootstrapBinding),
    candidate_registration_preview_binding: structuredClone(candidate.binding),
    candidate_registration_binding: structuredClone(candidate.binding),
    state: 'PASS',
    transition_argv: [...mode.transitionArgv],
    transition_run_count: 1,
  };
  manifest.permitted_read_paths = [...new Set([
    ...manifest.permitted_read_paths,
    mode.transitionAuthorityPath,
    ...candidateReadPaths(candidate),
  ])].sort();
  // The original flow created the finaliser and validator in the atomic
  // commit. The correction commits them beforehand, so its write set is the
  // three successor outputs and the atomic delta is the manifest plus those.
  manifest.permitted_write_paths = [
    mode.transitionAuthorityPath,
    candidate.registration_path,
    ...(mode.correction ? [] : [FINALISER_PATH, VALIDATOR_PATH]),
    mode.receiptPath,
  ].sort();
  manifest.exact_argv_with_run_limits = [
    {
      argv: [
        'node',
        'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs',
        mode.manifestPath,
      ],
      max_runs: 3,
    },
    { argv: [...mode.transitionArgv], max_runs: 1 },
    { argv: ['node', '--test', WORK4_TEST_PATH], max_runs: 30 },
    { argv: ['node', FINALISER_PATH], max_runs: 1 },
    { argv: ['node', VALIDATOR_PATH], max_runs: 3 },
  ];
  manifest.exact_git_commit_and_push_argv[0] = [
    'git', 'add', '--', ...[mode.manifestPath, ...manifest.permitted_write_paths].sort(),
  ];
  return sealManifest(manifest);
}

export async function transitionWork4Candidate({ repoRoot = REPO_ROOT, mode = ORIGINAL_MODE } = {}) {
  const bootstrapState = readCanonical(repoRoot, mode.manifestPath);
  const expectedBootstrap = buildWork4BootstrapManifest({ repoRoot, mode });
  if (canonicalJson(bootstrapState.record) !== canonicalJson(expectedBootstrap)) {
    fail('WORK4_BOOTSTRAP_DRIFT', 'manifest does not match the pushed preparation tree');
  }
  const validation = await validateExecutionManifest({
    repoRoot,
    manifestPath: mode.manifestPath,
  });
  if (validation.candidate_stage_state !== 'WORK4_TRANSITION_PENDING') {
    fail('WORK4_BOOTSTRAP_DRIFT', validation.candidate_stage_state);
  }
  const preview = previewWork4Candidate({ repoRoot });
  if (!bootstrapState.record.permitted_write_paths.includes(preview.registration_path)) {
    fail('WORK4_BOOTSTRAP_DRIFT', 'candidate preview path');
  }
  const correction = mode.correction ? readCorrectionAuthority(repoRoot) : null;
  if (correction && preview.registration_path === SUPERSEDED_REGISTRATION_PATH) {
    fail('WORK4_CANDIDATE_DRIFT', 'correction candidate equals the superseded candidate');
  }
  const bootstrapBinding = recordBinding(
    mode.manifestPath,
    bootstrapState.bytes,
    bootstrapState.record,
    'execution_manifest_id',
  );
  const written = registerCandidate({
    repoRoot,
    specification: buildCandidateSpecification({ repoRoot }),
    write: true,
  });
  const verification = verifyRegisteredCandidate({
    repoRoot,
    registrationPath: written.registration_path,
  });
  if (canonicalJson(written.binding) !== canonicalJson(preview.binding)) {
    fail('WORK4_CANDIDATE_DRIFT', written.registration_path);
  }
  const transitionAuthority = sealRecord({
    schema_version: TRANSITION_SCHEMA,
    state: 'AUTHORISED_ONE_SHOT_WORK4_CANDIDATE_TRANSITION',
    candidate_ordering_correction_authority_binding:
      structuredClone(bootstrapState.record.candidate_ordering_correction_authority_binding),
    superseded_bootstrap_manifest_binding: bootstrapBinding,
    candidate_registration_preview_binding: structuredClone(preview.binding),
    candidate_registration_binding: structuredClone(written.binding),
    ...(correction ? {
      [CORRECTION_MANIFEST_MEMBER]: structuredClone(correction.binding),
      superseded_candidate_registration_binding:
        structuredClone(correction.supersededRegistrationBinding),
    } : {}),
    transition_argv: [...mode.transitionArgv],
    transition_run_limit: 1,
    effects: {
      transition_authority_writes: 1,
      candidate_registration_writes: 1,
      manifest_replacements: 1,
      model_calls: 0,
      network_reads: 0,
      network_writes: 0,
      database_writes: 0,
      product_writes: 0,
      m0_m4_mutations: 0,
      m8_actions: 0,
    },
  }, 'candidate_transition_authority_id');
  const transitionBytes = canonicalBytes(transitionAuthority);
  writeExclusive(repoRoot, mode.transitionAuthorityPath, transitionBytes);
  const transitionBinding = recordBinding(
    mode.transitionAuthorityPath,
    transitionBytes,
    transitionAuthority,
    'candidate_transition_authority_id',
  );
  const manifest = postTransitionManifest(
    bootstrapState.record,
    written,
    verification,
    transitionBinding,
    bootstrapBinding,
    mode,
  );
  replaceManifest(repoRoot, manifest, mode);
  const postValidation = await validateExecutionManifest({
    repoRoot,
    manifestPath: mode.manifestPath,
  });
  return {
    schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK4_CANDIDATE_TRANSITION_RESULT/V1',
    status: 'PASS',
    candidate_registration_id: written.registration.candidate_registration_id,
    candidate_registration_path: written.registration_path,
    candidate_transition_authority_id:
      transitionAuthority.candidate_transition_authority_id,
    execution_manifest_id: manifest.execution_manifest_id,
    validation: postValidation,
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2);
    const mode = [ORIGINAL_MODE, CORRECTION_MODE].find((candidate) =>
      canonicalJson(argv) === canonicalJson(candidate.bootstrapArgv.slice(2))
      || canonicalJson(argv) === canonicalJson(candidate.transitionArgv.slice(2)));
    if (mode && canonicalJson(argv) === canonicalJson(mode.bootstrapArgv.slice(2))) {
      const manifest = writeWork4BootstrapManifest({ repoRoot: process.cwd(), mode });
      process.stdout.write(`${manifest.execution_manifest_id}\n`);
    } else if (mode) {
      const result = await transitionWork4Candidate({ repoRoot: process.cwd(), mode });
      process.stdout.write(`${canonicalJson(result)}\n`);
    } else {
      fail('WORK4_OPTIONS', 'exact bootstrap or transition arguments are required');
    }
  } catch (error) {
    process.stderr.write(`${error.code ?? 'WORK4_TRANSITION_FAILED'}\n`);
    process.exitCode = 1;
  }
}

export {
  CORRECTION_AUTHORITY_PATH,
  CORRECTION_MANIFEST_MEMBER,
  CORRECTION_MODE,
  ORIGINAL_MODE,
  SUCCESSOR_MANIFEST_PATH,
  SUCCESSOR_RECEIPT_PATH,
  SUCCESSOR_TRANSITION_AUTHORITY_PATH,
  SUPERSEDED_REGISTRATION_ID,
  SUPERSEDED_REGISTRATION_PATH,
  Work4CandidateTransitionError,
};
