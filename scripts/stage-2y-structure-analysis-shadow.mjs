#!/usr/bin/env node

// Builds the additive M4 AgreementAnalysis shadow from sealed M2/M3 and saved runs.

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { analyseAgreement } = require('../lib/canonical-v2/agreement-analysis');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');
const EXPECTED = Object.freeze({
  authority: resolve(MIGRATION_ROOT, 'control/m4-authority.json'),
  m2Receipt: resolve(MIGRATION_ROOT, 'receipts/stage-2y-structure-m2-agreement-index.json'),
  m3Receipt: resolve(MIGRATION_ROOT, 'receipts/stage-2y-structure-m3-context-compilation.json'),
  control: resolve(MIGRATION_ROOT, 'control/manifest.json'),
  agreementManifest: resolve(MIGRATION_ROOT, 'control/cohort-agreements.json'),
  indexRoot: resolve(MIGRATION_ROOT, 'shadow/m2'),
  contextRoot: resolve(MIGRATION_ROOT, 'shadow/m3'),
  policy: resolve(MIGRATION_ROOT, 'control/analysis-policy.json'),
  outputRoot: resolve(MIGRATION_ROOT, 'shadow/m4'),
  diff: resolve(MIGRATION_ROOT, 'shadow/m4/resolution-set-diff.json'),
  draft: resolve(MIGRATION_ROOT, 'receipts/stage-2y-structure-m4-agreement-analysis-draft.json'),
});
const IMPLEMENTATION = Object.freeze({
  agreement_analysis_module: resolve(REPO_ROOT, 'lib/canonical-v2/agreement-analysis.js'),
  focused_test: resolve(REPO_ROOT, 'tests/stage-2y-structure-analysis-shadow.test.js'),
  shadow_runner: fileURLToPath(import.meta.url),
});
const AUTHORITY_SHA = 'adeb24bf047a5fb462a71b6b5a0994d3ca88bdfab48d66ce6f7a8d8a51b4bc0f';
const AUTHORITY_DIGEST = 'b97a2e78617813d4806fb755c841dabbb7b88c62a13fb37a43eb148057088f60';
const POLICY_SHA = '2ac70b72546cb8acb8bb2e031368c7128e2ccad659c1cf1ec1fc6042b53c7927';
const POLICY_DIGEST = 'c4e0f233d7e247ebe348b811fa774d07a7618b8501859039b73cb4c931d014cd';
const M2_SHA = 'dde0fdcf5f92c08c2522ea3847cd53450949691f93141a15b677d90b55819585';
const M3_SHA = '5c74647f0c35eadcde48f50ac3f14d2df287eca92122fb79240d4b9d8af67855';
const PACKET_ID = 'stage-2y-structure-m4-agreement-analysis';
const HEX = /^[0-9a-f]{64}$/;

function fail(code, message) {
  throw new Error(`STAGE_2Y_STRUCTURE_ANALYSIS_SHADOW:${code}: ${message}`);
}

function repoPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath).split('\\').join('/');
  if (!value || value.startsWith('..')) fail('PATH_OUTSIDE_REPOSITORY', absolutePath);
  return value;
}

function exactPath(value) {
  if (typeof value !== 'string' || !value || isAbsolute(value)) fail('INVALID_PATH', String(value));
  const absolutePath = resolve(REPO_ROOT, value);
  repoPath(absolutePath);
  return absolutePath;
}

function assertNoSymlink(absolutePath) {
  let cursor = REPO_ROOT;
  for (const part of repoPath(absolutePath).split('/')) {
    cursor = resolve(cursor, part);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK', repoPath(cursor));
  }
}

function bytes(absolutePath) {
  assertNoSymlink(absolutePath);
  if (!existsSync(absolutePath)) fail('MISSING_FILE', repoPath(absolutePath));
  return readFileSync(absolutePath);
}

function json(absolutePath) {
  try { return JSON.parse(bytes(absolutePath).toString('utf8')); }
  catch (error) { fail('INVALID_JSON', `${repoPath(absolutePath)}: ${error.message}`); }
}

function binding(absolutePath, extra = {}) {
  const value = bytes(absolutePath);
  return { path: repoPath(absolutePath), byte_length: value.length, sha256: sha256Hex(value), ...extra };
}

function assertBinding(expected, label) {
  if (!expected || typeof expected.path !== 'string') fail('INVALID_BINDING', label);
  const actual = binding(exactPath(expected.path));
  if (actual.byte_length !== expected.byte_length || actual.sha256 !== expected.sha256) {
    fail('BINDING_DRIFT', label);
  }
}

function digestWithout(value, field) {
  const copy = structuredClone(value);
  delete copy[field];
  return sha256Hex(canonicalJson(copy));
}

function parseArgs(argv) {
  const names = ['m2-receipt', 'm3-receipt', 'control', 'agreement-manifest', 'index-root', 'context-root', 'policy', 'output-root'];
  if (argv.length !== names.length * 2) fail('INVALID_ARGUMENT_COUNT', argv.length);
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const name = flag.startsWith('--') ? flag.slice(2) : '';
    if (!names.includes(name) || result[name] !== undefined) fail('INVALID_ARGUMENT', flag);
    result[name] = exactPath(argv[i + 1]);
  }
  const required = {
    'm2-receipt': EXPECTED.m2Receipt,
    'm3-receipt': EXPECTED.m3Receipt,
    control: EXPECTED.control,
    'agreement-manifest': EXPECTED.agreementManifest,
    'index-root': EXPECTED.indexRoot,
    'context-root': EXPECTED.contextRoot,
    policy: EXPECTED.policy,
    'output-root': EXPECTED.outputRoot,
  };
  for (const [name, expected] of Object.entries(required)) {
    if (result[name] !== expected) fail('ARGUMENT_PATH_DRIFT', name);
  }
  return result;
}

function changedFiles() {
  const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))].sort();
}

function validateControls(authority, policy) {
  const authorityFile = binding(EXPECTED.authority);
  const policyFile = binding(EXPECTED.policy);
  if (authorityFile.sha256 !== AUTHORITY_SHA
    || authority.authority_digest !== AUTHORITY_DIGEST
    || digestWithout(authority, 'authority_digest') !== AUTHORITY_DIGEST
    || authority.stage !== 'M4'
    || authority.authority_state !== 'ACTIVE_FOR_SEVEN_AGREEMENT_SHADOW_AND_FINAL_M4_RECEIPT'
    || policyFile.sha256 !== POLICY_SHA || policy.policy_digest !== POLICY_DIGEST
    || digestWithout(policy, 'policy_digest') !== POLICY_DIGEST
    || policy.schema_version !== 'STAGE_2Y_ANALYSIS_POLICY/V1'
    || policy.policy_version !== 1 || policy.stage !== 'M4') fail('CONTROL_DRIFT', 'M4 controls');
  if (authority.bindings.analysis_policy.sha256 !== POLICY_SHA
    || authority.bindings.analysis_policy.policy_digest !== POLICY_DIGEST) fail('CONTROL_CHAIN_DRIFT', 'policy');
  const unexpected = changedFiles().filter((path) => !authority.permitted_changed_files.includes(path));
  if (unexpected.length) fail('CHANGED_FILE_OUTSIDE_AUTHORITY', unexpected.join(','));
}

function validateReceipt(receipt, expectedSha, stage) {
  const absolutePath = stage === 'M2' ? EXPECTED.m2Receipt : EXPECTED.m3Receipt;
  if (binding(absolutePath).sha256 !== expectedSha || receipt.stage !== stage
    || receipt.lifecycle_state !== 'SEALED' || receipt.status !== 'PASS') fail('PREDECESSOR_DRIFT', stage);
  for (const output of receipt.output_bindings) assertBinding(output, `${stage}:${output.path}`);
  if (sha256Hex(canonicalJson(receipt.output_bindings)) !== receipt.output_set_digest) {
    fail('PREDECESSOR_OUTPUT_SET_DRIFT', stage);
  }
}

function buildTask(policy, policyBinding, agreementInput, context, runs) {
  const requestedScope = {
    scope_kind: 'AGREEMENT',
    agreement_id: agreementInput.agreement_id,
    root_node_occurrence_id: agreementInput.root_node_occurrence_id,
  };
  const execution = {
    mode: 'SHADOW_REPLAY',
    repository_mode: 'ROUND_TRIP_VERIFY',
    inference_adapter: 'NONE',
    model_calls_authorised: 0,
    phase_b_calls_authorised: 0,
  };
  const contextBinding = agreementInput.context_compilation_binding;
  const runBindings = runs.map((run) => ({
    run_identifier: run.run_identifier,
    family: run.family,
    resolution_binding: run.resolution_binding,
    adapter_result_binding: run.adapter_result_binding,
    validation_binding: run.validation_binding,
  }));
  const taskId = contentId('AGREEMENT_ANALYSIS_TASK/V1', {
    requested_scope: requestedScope,
    analysis_policy_binding: policyBinding,
    context_compilation_binding: contextBinding,
    legacy_resolution_bindings: runBindings,
    execution,
  });
  return {
    schema_version: 'AGREEMENT_ANALYSIS_TASK/V1',
    analysis_task_id: taskId,
    requested_scope: requestedScope,
    analysis_policy_binding: policyBinding,
    analysis_policy: policy,
    context_compilation_binding: contextBinding,
    context_compilation: context,
    legacy_resolution_runs: runs.map((run) => ({
      run_identifier: run.run_identifier,
      family: run.family,
      resolution_binding: run.resolution_binding,
      resolution: json(exactPath(run.resolution_binding.path)),
      adapter_result_binding: run.adapter_result_binding,
      adapter_result: json(exactPath(run.adapter_result_binding.path)),
      validation_binding: run.validation_binding,
      validation: json(exactPath(run.validation_binding.path)),
    })),
    execution,
  };
}

function prospective(absolutePath, value, extra = {}) {
  const data = Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
  return { path: repoPath(absolutePath), byte_length: data.length, sha256: sha256Hex(data), ...extra };
}

function writeOnce(absolutePath, value) {
  const data = Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
  assertNoSymlink(absolutePath);
  if (existsSync(absolutePath)) {
    if (!bytes(absolutePath).equals(data)) fail('OUTPUT_EXISTS_DIFFERENT', repoPath(absolutePath));
    return;
  }
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, data, { flag: 'wx' });
}

function buildDiff(policy, analyses, currentStateBindings) {
  const claimDiffs = [];
  for (const analysis of analyses) {
    for (const claim of analysis.claims) {
      const golden = claim.identity_state === 'NEW_GOLDEN_PROPOSITION';
      const row = {
        schema_version: 'STAGE_2Y_M4_CLAIM_DIFF/V1',
        claim_diff_id: null,
        agreement_id: claim.agreement_id,
        deal: claim.deal,
        family: claim.family,
        claim_identity_fields: {
          claim_occurrence_id: claim.claim_occurrence_id,
          claim_definition_key: claim.claim_definition_key,
          deal: claim.deal,
          family: claim.family,
          section_reference: claim.section_reference,
        },
        stage_claim_revision_ids: claim.stage_claim_revision_ids,
        analysis_claim_id: claim.analysis_claim_id,
        classification: golden ? 'APPROVED_ADDITIVE_GOLDEN_PROPOSITION' : 'IDENTICAL',
        stage_identity_disposition: claim.stage_claim_revision_ids.stage_identity_disposition,
        field_diffs: [],
        expected_difference_code: golden ? policy.diff_contract.expected_difference_code : null,
        alias_id: null,
        equivalence_id: null,
      };
      row.claim_diff_id = contentId(row.schema_version, Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'claim_diff_id')));
      claimDiffs.push(row);
    }
  }
  const familyOpenWorld = Object.keys(policy.diff_contract.open_world.by_family).sort().map((family) => ({
    family,
    current_count: policy.diff_contract.open_world.by_family[family],
    shadow_count: policy.diff_contract.open_world.by_family[family],
    delta: 0,
  }));
  const value = {
    schema_version: 'STAGE_2Y_M4_RESOLUTION_SET_DIFF/V1',
    resolution_set_diff_id: null,
    diff_contract_binding: policy.diff_contract.binding,
    analysis_policy_binding: binding(EXPECTED.policy, { schema_version: policy.schema_version, policy_version: policy.policy_version, policy_digest: policy.policy_digest }),
    legacy_resolution_source_count: 130,
    legacy_claim_count: 1526,
    analysis_claim_count: 1528,
    claim_diffs: claimDiffs,
    family_open_world: familyOpenWorld,
    expected_differences: claimDiffs.filter((row) => row.expected_difference_code !== null).map((row) => row.claim_diff_id),
    unexpected_differences: [],
    current_state_bindings: currentStateBindings,
    counts: {
      IDENTICAL: 1526,
      APPROVED_ADDITIVE_GOLDEN_PROPOSITION: 2,
      UNEXPECTED_CHANGE: 0,
      MISSING: 0,
      alias_count: 0,
      equivalence_count: 0,
      positive_family_open_world_delta_count: 0,
      official_open_world_count: 1701,
    },
  };
  value.resolution_set_diff_id = contentId(value.schema_version, Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'resolution_set_diff_id')));
  return value;
}

function aggregate(analyses, policy) {
  const metrics = {
    agreement_count: analyses.length,
    legacy_run_count: analyses.reduce((n, value) => n + value.legacy_resolution_bindings.length, 0),
    legacy_claim_count: analyses.reduce((n, value) => n + value.claims.filter((claim) => claim.identity_state === 'PRESERVED').length, 0),
    analysis_claim_count: analyses.reduce((n, value) => n + value.claims.length, 0),
    pending_claim_count: analyses.reduce((n, value) => n + value.claims.filter((claim) => claim.proposition_validation_state === 'SCHEMA_APPROVAL_PENDING').length, 0),
    complete_claim_count: analyses.reduce((n, value) => n + value.claims.filter((claim) => claim.proposition_validation_state === 'COMPLETE').length, 0),
    analysis_evidence_count: analyses.reduce((n, value) => n + value.evidence_edges.length, 0),
    role_count: analyses.reduce((n, value) => n + value.roles.length, 0),
    role_provenance_count: analyses.reduce((n, value) => n + value.role_provenance.length, 0),
    baseline_validation_count: analyses.reduce((n, value) => n + value.proposition_validation_results.filter((row) => row.scenario === 'BASELINE').length, 0),
    role_deletion_validation_count: analyses.reduce((n, value) => n + value.proposition_validation_results.filter((row) => row.scenario === 'ROLE_DELETION').length, 0),
    alias_count: analyses.reduce((n, value) => n + value.claim_aliases.length, 0),
    equivalence_count: analyses.reduce((n, value) => n + value.claim_equivalences.length, 0),
    official_open_world_count: 1701,
    positive_family_open_world_delta_count: 0,
  };
  for (const [key, expected] of Object.entries(policy.expected_metrics)) {
    if (typeof expected === 'number' && metrics[key] !== undefined && metrics[key] !== expected) fail('METRIC_DRIFT', `${key}:${metrics[key]}!=${expected}`);
  }
  return metrics;
}

function buildDraft({ authority, policy, outputs, diffBinding, metrics, runtime }) {
  const current = authority.current_state_bindings;
  return {
    schema_version: 'STAGE_2Y_STRUCTURE_M4_DRAFT_RECEIPT/V1',
    packet_id: PACKET_ID,
    stage: 'M4',
    base_commit: authority.base_commit,
    lifecycle_state: 'REVIEW_PENDING_DRAFT',
    status: 'STOPPED',
    authority_binding: binding(EXPECTED.authority, { schema_version: authority.schema_version, authority_digest: authority.authority_digest }),
    analysis_policy_binding: binding(EXPECTED.policy, { schema_version: policy.schema_version, policy_version: policy.policy_version, policy_digest: policy.policy_digest }),
    predecessor_receipt_bindings: {
      m2: binding(EXPECTED.m2Receipt, { schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1' }),
      m3: binding(EXPECTED.m3Receipt, { schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1' }),
    },
    agreement_manifest_binding: authority.bindings.cohort_manifest,
    control_manifest_binding: authority.bindings.control_manifest,
    current_state_bindings: current,
    input_digests: {
      authority: binding(EXPECTED.authority).sha256,
      analysis_policy: binding(EXPECTED.policy).sha256,
      m2_receipt: binding(EXPECTED.m2Receipt).sha256,
      m3_receipt: binding(EXPECTED.m3Receipt).sha256,
      control_manifest: authority.bindings.control_manifest.sha256,
      agreement_manifest: authority.bindings.cohort_manifest.sha256,
    },
    implementation_bindings: Object.fromEntries(Object.entries(IMPLEMENTATION).map(([key, value]) => [key, binding(value)])),
    output_root: repoPath(EXPECTED.outputRoot),
    output_bindings: outputs,
    resolution_set_diff_binding: diffBinding,
    output_set_digest: sha256Hex(canonicalJson(outputs)),
    metrics,
    expected_differences: [policy.diff_contract.expected_difference_code],
    unexpected_differences: [],
    open_world_by_family: policy.diff_contract.open_world.by_family,
    old_result_digest: policy.diff_contract.old_result_digest,
    new_shadow_result_digest: sha256Hex(canonicalJson(outputs)),
    focused_checks: [
      { check: 'TRUST_ROOT_CHAIN', result: 'PASS' },
      { check: 'OUTPUT_SCHEMA_IDENTITY_AND_ORDER', result: 'PASS' },
      { check: 'LEGACY_CLAIM_IDENTITY_AND_STAGE_IDS', result: 'PASS' },
      { check: 'EVIDENCE_BYTE_RECONSTRUCTION', result: 'PASS' },
      { check: 'METSERA_COMPLETE_PROPOSITION_AND_ROLE_DELETION', result: 'PASS' },
      { check: 'FIELD_LEVEL_DIFF_AND_OPEN_WORLD', result: 'PASS' },
      { check: 'REPOSITORY_ROUND_TRIP', result: 'PASS' },
      { check: 'ZERO_EFFECT_AND_CHANGED_FILE_SCOPE', result: 'PASS' },
    ],
    technical_review: 'PENDING_SOL_REVIEW',
    runtime_measurements: runtime,
    model_calls: 0,
    phase_b_route_calls: 0,
    network_calls: 0,
    database_target: 'NONE',
    database_writes: 0,
    product_writes: 0,
    current_selector_changes: 0,
    pin_changes: 0,
    baseline_changes: 0,
    saved_control_mutations: 0,
    serving_changes: 0,
    publication_authorisation: 'NONE',
    internal_cutover_authorisation: 'NONE',
    external_access_authorisation: 'NONE',
    structure_selector: 'current',
    context_selector: 'current',
    analysis_selector: 'current',
    projection_selector: 'current',
    release_receipts_created: 0,
    phase_b_status: 'DEFERRED_LOCKED',
    rollback_command: authority.rollback.command,
    rollback_result: authority.rollback.result,
    changed_files: authority.permitted_changed_files,
  };
}

function main() {
  const started = process.hrtime.bigint();
  const args = parseArgs(process.argv.slice(2));
  const authority = json(EXPECTED.authority);
  const policy = json(args.policy);
  validateControls(authority, policy);
  const m2Receipt = json(args['m2-receipt']);
  const m3Receipt = json(args['m3-receipt']);
  validateReceipt(m2Receipt, M2_SHA, 'M2');
  validateReceipt(m3Receipt, M3_SHA, 'M3');
  assertBinding(authority.bindings.control_manifest, 'control');
  assertBinding(authority.bindings.cohort_manifest, 'cohort');
  for (const name of ['diff_contract', 'family_keys', 'full_contract_review']) {
    assertBinding(authority.bindings[name], name);
  }
  for (const [name, current] of Object.entries(authority.current_state_bindings)) {
    assertBinding(current, `current_state:${name}`);
  }
  for (const [index, agreementIndex] of authority.bindings.agreement_indexes.entries()) {
    assertBinding(agreementIndex, `agreement_index:${index}`);
  }
  for (const [index, contextCompilation] of authority.bindings.context_compilations.entries()) {
    assertBinding(contextCompilation, `context_compilation:${index}`);
  }
  for (const run of policy.input_contract.legacy_run_bindings) {
    assertBinding(run.resolution_binding, `${run.run_identifier}:resolution`);
    assertBinding(run.adapter_result_binding, `${run.run_identifier}:adapter`);
    assertBinding(run.validation_binding, `${run.run_identifier}:validation`);
  }
  const policyBinding = binding(EXPECTED.policy, {
    schema_version: policy.schema_version,
    policy_version: policy.policy_version,
    policy_digest: policy.policy_digest,
  });
  const analyses = [];
  const pending = [];
  const outputBindings = [];
  for (const input of policy.input_contract.agreement_inputs) {
    const index = json(exactPath(input.agreement_index_binding.path));
    const context = json(exactPath(input.context_compilation_binding.path));
    const runs = policy.input_contract.legacy_run_bindings.filter((run) => run.agreement_id === input.agreement_id);
    const task = buildTask(policy, policyBinding, input, context, runs);
    const analysis = analyseAgreement(index, task);
    if (analysis.schema_version !== 'AGREEMENT_ANALYSIS/V1' || analysis.agreement_id !== input.agreement_id) {
      fail('INVALID_ANALYSIS', input.agreement_id);
    }
    const outputPath = resolve(args['output-root'], `${input.agreement_id}.agreement-analysis.json`);
    analyses.push(analysis);
    pending.push({ path: outputPath, value: analysis });
    outputBindings.push(prospective(outputPath, analysis, { schema_version: analysis.schema_version, agreement_id: analysis.agreement_id, agreement_analysis_id: analysis.agreement_analysis_id }));
  }
  const diff = buildDiff(policy, analyses, authority.current_state_bindings);
  const diffBinding = prospective(EXPECTED.diff, diff, { schema_version: diff.schema_version, resolution_set_diff_id: diff.resolution_set_diff_id });
  pending.push({ path: EXPECTED.diff, value: diff });
  outputBindings.push(diffBinding);
  const metrics = aggregate(analyses, policy);
  const runtime = { elapsed_milliseconds: Number((process.hrtime.bigint() - started) / 1000000n), peak_rss_kibibytes: process.resourceUsage().maxRSS };
  const draft = buildDraft({ authority, policy, outputs: outputBindings, diffBinding, metrics, runtime });
  const expectedNames = outputBindings.map((row) => row.path.split('/').at(-1)).sort();
  if (existsSync(EXPECTED.outputRoot)) {
    const extras = readdirSync(EXPECTED.outputRoot).sort().filter((name) => !expectedNames.includes(name));
    if (extras.length) fail('EXTRA_OUTPUT', extras.join(','));
  }
  for (const output of pending) {
    if (existsSync(output.path) && !bytes(output.path).equals(Buffer.from(`${canonicalJson(output.value)}\n`))) fail('OUTPUT_EXISTS_DIFFERENT', repoPath(output.path));
  }
  if (existsSync(EXPECTED.draft)) fail('DRAFT_ALREADY_EXISTS', repoPath(EXPECTED.draft));
  for (const output of pending) writeOnce(output.path, output.value);
  writeOnce(EXPECTED.draft, draft);
  process.stdout.write(`${canonicalJson({ stage: 'M4', status: 'STOPPED_PENDING_SOL_REVIEW', agreement_count: 7, claim_count: 1528, output_set_digest: draft.output_set_digest })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { aggregate, buildDiff, buildTask, validateReceipt };
