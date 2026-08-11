#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = resolve(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const EXPECTED = Object.freeze({
  draft: resolve(
    MIGRATION_ROOT,
    'receipts/stage-2y-structure-m3-context-compilation-draft.json',
  ),
  review: resolve(
    MIGRATION_ROOT,
    'reviews/stage-2y-structure-m3-sol-technical-review.json',
  ),
  final: resolve(
    MIGRATION_ROOT,
    'receipts/stage-2y-structure-m3-context-compilation.json',
  ),
});
const FINALISER_PATH = fileURLToPath(import.meta.url);
const VALIDATOR_PATH = resolve(REPO_ROOT, 'scripts/stage-2y-structure-migration-validate.mjs');
const PACKET_ID = 'stage-2y-structure-m3-context-compilation';
const DRAFT_SCHEMA = 'STAGE_2Y_STRUCTURE_M3_DRAFT_RECEIPT/V1';
const REVIEW_SCHEMA = 'STAGE_2Y_STRUCTURE_SOL_TECHNICAL_REVIEW/V1';
const FINAL_SCHEMA = 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1';
const REVIEW_CHECKS = Object.freeze([
  'BOUNDED_CONTRACT_REGRESSION',
  'SEVEN_AGREEMENT_SCHEMA_IDENTITY',
  'PROVENANCE_AND_SCOPE',
  'REFERENCE_DEFINITION_TOPOLOGY_CLOSURE',
  'REQUIRED_REAL_FIXTURES',
  'DETERMINISM',
  'FROZEN_CURRENT_STATE',
  'NO_PRODUCTION_EFFECTS',
]);
const FINAL_CHECKS = Object.freeze([...REVIEW_CHECKS, 'SOL_TECHNICAL_REVIEW']);
const AUTHORITY_PATH = resolve(MIGRATION_ROOT, 'control/m3-authority.json');
const POLICY_PATH = resolve(MIGRATION_ROOT, 'control/semantic-policy.json');
const AGREEMENT_MANIFEST_PATH = resolve(MIGRATION_ROOT, 'control/cohort-agreements.json');
const M2_RECEIPT_PATH = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m2-agreement-index.json',
);
const FULL_CONTRACT_REVIEW_PATH = resolve(
  MIGRATION_ROOT,
  'reviews/stage-2y-structure-m3-full-contract-sol-freeze.json',
);
const M3_BASE_COMMIT = '33137fd57bec3243757e90bb45f039ec182c3d1a';
const M3_IMPLEMENTATION_PATHS = Object.freeze({
  context_compilation_module: 'lib/canonical-v2/context-compilation.js',
  focused_test: 'tests/canonical-v2-context-compilation.test.js',
  shadow_runner: 'scripts/stage-2y-context-compilation-shadow.mjs',
  finaliser: 'scripts/stage-2y-context-compilation-m3-finalise.mjs',
  validator: 'scripts/stage-2y-structure-migration-validate.mjs',
});
const ZERO_FIELDS = Object.freeze([
  'pin_changes',
  'baseline_changes',
  'saved_control_mutations',
  'release_receipts_created',
  'current_selector_changes',
  'model_calls',
  'phase_b_route_calls',
  'network_calls',
  'product_writes',
  'serving_changes',
  'm0_m1_m2_sealed_artefact_mutations',
]);
const HEX_256 = /^[0-9a-f]{64}$/;

function fail(code, message) {
  throw new Error(`STAGE_2Y_CONTEXT_COMPILATION_M3_FINALISE:${code}: ${message}`);
}

function repositoryPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath).split('\\').join('/');
  if (!value || value.startsWith('..')) fail('PATH_OUTSIDE_REPOSITORY', absolutePath);
  return value;
}

function absoluteRepositoryPath(value) {
  if (typeof value !== 'string' || !value || isAbsolute(value)) {
    fail('INVALID_REPOSITORY_PATH', String(value));
  }
  const absolutePath = resolve(REPO_ROOT, value);
  repositoryPath(absolutePath);
  return absolutePath;
}

function assertNotSymlink(absolutePath, label) {
  const relativePath = repositoryPath(absolutePath);
  let cursor = REPO_ROOT;
  for (const component of relativePath.split('/')) {
    cursor = resolve(cursor, component);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) fail('SYMLINK', `${label}: ${component}`);
  }
}

function readJson(absolutePath) {
  assertNotSymlink(absolutePath, repositoryPath(absolutePath));
  if (!existsSync(absolutePath)) fail('MISSING_FILE', repositoryPath(absolutePath));
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    fail('INVALID_JSON', `${repositoryPath(absolutePath)}: ${error.message}`);
  }
}

function fileBinding(absolutePath, extra = {}) {
  assertNotSymlink(absolutePath, repositoryPath(absolutePath));
  const bytes = readFileSync(absolutePath);
  return {
    path: repositoryPath(absolutePath),
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    ...extra,
  };
}

function assertBinding(binding, label) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    fail('INVALID_BINDING', label);
  }
  const actual = fileBinding(absoluteRepositoryPath(binding.path));
  if (actual.sha256 !== binding.sha256
    || (binding.byte_length !== undefined && actual.byte_length !== binding.byte_length)) {
    fail('BINDING_DRIFT', label);
  }
  return actual;
}

function assertM2Predecessor(m2Receipt, authority) {
  const receiptBinding = fileBinding(M2_RECEIPT_PATH);
  if (receiptBinding.sha256
      !== 'dde0fdcf5f92c08c2522ea3847cd53450949691f93141a15b677d90b55819585'
    || m2Receipt.schema_version !== 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1'
    || m2Receipt.packet_id !== 'stage-2y-structure-m2-agreement-index'
    || m2Receipt.stage !== 'M2'
    || m2Receipt.lifecycle_state !== 'SEALED'
    || m2Receipt.status !== 'PASS'
    || m2Receipt.agreement_count !== 7
    || !Array.isArray(m2Receipt.output_bindings)
    || m2Receipt.output_bindings.length !== 7
    || valueDigest(m2Receipt.output_bindings) !== m2Receipt.output_set_digest
    || m2Receipt.output_set_digest !== authority.bindings.m2_receipt.output_set_digest) {
    fail('M2_TRUST_ROOT_DRIFT', 'receipt state or output set');
  }
  const expectedByPath = new Map(
    authority.bindings.agreement_indexes.map((binding) => [binding.path, binding]),
  );
  const expectedNames = [];
  for (const [index, binding] of m2Receipt.output_bindings.entries()) {
    const expected = expectedByPath.get(binding.path);
    if (!expected) fail('M2_TRUST_ROOT_DRIFT', `unbound index ${index}`);
    const actual = assertBinding(binding, `M2 output ${index}`);
    if (actual.byte_length !== expected.byte_length || actual.sha256 !== expected.sha256) {
      fail('M2_TRUST_ROOT_DRIFT', binding.path);
    }
    expectedNames.push(binding.path.split('/').at(-1));
  }
  const outputRoot = resolve(
    REPO_ROOT,
    'evidence/canonical-v2/stage-2y-structure-migration/shadow/m2',
  );
  assertNotSymlink(outputRoot, 'M2 output root');
  const actualNames = readdirSync(outputRoot, { withFileTypes: true }).map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail('M2_TRUST_ROOT_DRIFT', `invalid output member ${entry.name}`);
    }
    return entry.name;
  }).sort();
  if (canonicalJson(actualNames) !== canonicalJson(expectedNames.sort())) {
    fail('M2_TRUST_ROOT_DRIFT', 'output root inventory');
  }
}

function assertChangedFiles(authority) {
  let tracked;
  let untracked;
  try {
    tracked = execFileSync('git', ['diff', '--name-only', M3_BASE_COMMIT, '--'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
  } catch (error) {
    fail('CHANGED_FILE_INSPECTION_FAILED', error.message);
  }
  const actualSet = new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean));
  actualSet.add(repositoryPath(EXPECTED.final));
  const actual = [...actualSet].sort();
  const expected = [...authority.permitted_changed_files].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail('CHANGED_FILE_SET_DRIFT', canonicalJson(actual));
  }
}

function valueDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    fail('KEY_SET_DRIFT', label);
  }
}

function parseArgs(argv) {
  const allowed = new Map([
    ['--draft-receipt', EXPECTED.draft],
    ['--review', EXPECTED.review],
    ['--final-receipt', EXPECTED.final],
  ]);
  if (argv.length !== 8) {
    fail('INVALID_ARGUMENTS', 'requires --draft-receipt, --review and --final-receipt');
  }
  const values = new Map();
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || !value || value.startsWith('--') || values.has(flag)) {
      fail('INVALID_ARGUMENTS', String(flag));
    }
    if (isAbsolute(value)) fail('ABSOLUTE_PATH', flag);
    const absolutePath = resolve(REPO_ROOT, value);
    if (absolutePath !== allowed.get(flag)
      || value !== repositoryPath(allowed.get(flag))) fail('PATH_DRIFT', flag);
    values.set(flag, absolutePath);
  }
  return {
    draft: values.get('--draft-receipt'),
    review: values.get('--review'),
    final: values.get('--final-receipt'),
  };
}

function assertZeroEffects(record, label) {
  for (const field of ZERO_FIELDS) {
    if (record[field] !== 0) fail('NON_ZERO_EFFECT', `${label}.${field}`);
  }
  for (const selector of [
    'structure_selector',
    'context_selector',
    'analysis_selector',
    'projection_selector',
  ]) {
    if (record[selector] !== 'current') fail('SELECTOR_DRIFT', `${label}.${selector}`);
  }
  for (const field of [
    'database_target',
    'publication_authorisation',
    'internal_cutover_authorisation',
    'external_access_authorisation',
  ]) {
    if (record[field] !== 'NONE') fail('AUTHORITY_DRIFT', `${label}.${field}`);
  }
  if (record.phase_b_status !== 'DEFERRED_LOCKED') fail('PHASE_B_DRIFT', label);
}

function assertOutputBindings(bindings, label) {
  if (!Array.isArray(bindings) || bindings.length !== 8) {
    fail('INVALID_OUTPUT_BINDINGS', label);
  }
  const ids = new Set();
  for (const [index, binding] of bindings.entries()) {
    assertExactKeys(binding, index < 7
      ? [
        'path', 'byte_length', 'sha256', 'schema_version', 'agreement_id',
        'agreement_index_id', 'context_compilation_id',
      ]
      : ['path', 'byte_length', 'sha256', 'schema_version', 'diagnostics_ledger_id'],
    `${label}[${index}]`);
    assertBinding(binding, `${label}[${index}]`);
    if (index < 7) {
      if (binding.schema_version !== 'CONTEXT_COMPILATION/V1'
        || !HEX_256.test(binding.agreement_id || '')
        || !HEX_256.test(binding.context_compilation_id || '')
        || ids.has(binding.agreement_id)) {
        fail('INVALID_OUTPUT_BINDINGS', `${label}[${index}]`);
      }
      ids.add(binding.agreement_id);
    } else if (binding.schema_version !== 'STAGE_2Y_M3_CONTEXT_DIAGNOSTICS/V1'
      || !HEX_256.test(binding.diagnostics_ledger_id || '')) {
      fail('INVALID_OUTPUT_BINDINGS', `${label}[${index}]`);
    }
  }
}

function assertDraft(draft) {
  const authority = readJson(AUTHORITY_PATH);
  const policy = readJson(POLICY_PATH);
  const fullContractReview = readJson(FULL_CONTRACT_REVIEW_PATH);
  const m2Receipt = readJson(M2_RECEIPT_PATH);
  const expectedDraftFields = fullContractReview.receipt_contract.final_fields
    .filter((field) => !['draft_receipt_binding', 'technical_review_binding'].includes(field))
    .concat('technical_review');
  assertExactKeys(draft, expectedDraftFields, 'draft');
  if (authority.authority_digest !== valueDigest((() => {
    const value = structuredClone(authority);
    delete value.authority_digest;
    return value;
  })())
    || policy.policy_digest !== valueDigest((() => {
      const value = structuredClone(policy);
      delete value.policy_digest;
      return value;
    })())
    || authority.bindings?.full_contract_review?.path
      !== repositoryPath(FULL_CONTRACT_REVIEW_PATH)
    || authority.bindings.full_contract_review.schema_version
      !== fullContractReview.schema_version
    || authority.bindings.full_contract_review.review_id !== fullContractReview.review_id
    || fullContractReview.review_id !== contentId(
      fullContractReview.schema_version,
      (() => {
        const value = structuredClone(fullContractReview);
        delete value.review_id;
        return value;
      })(),
    )) {
    fail('INVALID_DRAFT', 'authority, policy or full-contract identity');
  }
  assertBinding(authority.bindings.full_contract_review, 'authority full-contract review');
  const expectedOutputPaths = authority.permitted_output.context_compilation_paths.concat(
    authority.permitted_output.diagnostics_path,
  );
  if (draft.schema_version !== DRAFT_SCHEMA
    || draft.packet_id !== PACKET_ID
    || draft.stage !== 'M3'
    || draft.lifecycle_state !== 'REVIEW_PENDING_DRAFT'
    || draft.status !== 'STOPPED'
    || draft.technical_review !== 'PENDING_SOL_REVIEW'
    || draft.base_commit !== M3_BASE_COMMIT
    || draft.agreement_count !== 7
    || draft.source_reference_count !== 130
    || draft.output_root !== 'evidence/canonical-v2/stage-2y-structure-migration/shadow/m3'
    || draft.context_metrics?.FOCUS_COUNT !== 13996
    || draft.context_metrics?.REFERENCE_CLOSURE_TOTALS?.annotation_count !== 2000
    || draft.context_metrics?.DEFINITION_CLOSURE_TOTALS?.use_annotation_count !== 27836
    || draft.context_metrics?.CARRIED_M2_AMBIGUITY_COUNT !== 23
    || canonicalJson(draft.changed_files) !== canonicalJson(authority.permitted_changed_files)
    || canonicalJson(draft.expected_differences) !== canonicalJson([])
    || canonicalJson(draft.unexpected_differences) !== canonicalJson([])
    || canonicalJson(draft.current_state_bindings)
      !== canonicalJson(authority.current_state_bindings)
    || canonicalJson(draft.open_world_by_family) !== canonicalJson(m2Receipt.open_world_by_family)
    || draft.old_result_digest !== m2Receipt.old_result_digest
    || draft.rollback_result !== authority.rollback.result
    || draft.rollback_command !== authority.rollback.command) {
    fail('INVALID_DRAFT', 'state or aggregate metrics');
  }
  assertExactKeys(draft.context_metrics, [
    'FOCUS_COUNT',
    'FACT_COUNT_BY_STATE_AND_ROLE',
    'SCOPE_EDGE_COUNT_BY_STATE_AND_KIND',
    'AMBIGUITY_COUNT',
    'RESIDUAL_COUNT',
    'REFERENCE_COUNT_BY_STATE',
    'DEFINITION_COUNT_BY_STATE',
    'RELATIONSHIP_COUNT_BY_STATE_AND_TYPE',
    'DIAGNOSTIC_COUNT_BY_TYPE',
    'CARRIED_M2_AMBIGUITY_COUNT',
    'REFERENCE_CLOSURE_TOTALS',
    'DEFINITION_CLOSURE_TOTALS',
  ], 'draft.context_metrics');
  assertZeroEffects(draft, 'draft');
  if (draft.authority_binding?.path !== repositoryPath(AUTHORITY_PATH)
    || draft.authority_binding?.sha256
      !== '959c09a62ac376ed19504b6fcf3d4e1b44054ba7599436dc322a2524117a6b06'
    || draft.semantic_policy_binding?.path !== repositoryPath(POLICY_PATH)
    || draft.semantic_policy_binding?.sha256
      !== 'd00b971f240a9d8d67f559533d685e9ad2801fdfd1e5986de810dbe803e58bdb'
    || draft.agreement_manifest_binding?.path !== repositoryPath(AGREEMENT_MANIFEST_PATH)
    || draft.sealed_predecessor_bindings?.m2_receipt?.path
      !== repositoryPath(M2_RECEIPT_PATH)
    || draft.sealed_predecessor_bindings?.m2_receipt?.sha256
      !== 'dde0fdcf5f92c08c2522ea3847cd53450949691f93141a15b677d90b55819585') {
    fail('INVALID_DRAFT', 'pinned input binding');
  }
  assertBinding(draft.authority_binding, 'draft.authority_binding');
  assertBinding(draft.semantic_policy_binding, 'draft.semantic_policy_binding');
  assertBinding(draft.agreement_manifest_binding, 'draft.agreement_manifest_binding');
  assertBinding(draft.sealed_predecessor_bindings?.m2_receipt,
    'draft.sealed_predecessor_bindings.m2_receipt');
  for (const [name, binding] of Object.entries(draft.current_state_bindings || {})) {
    assertBinding(binding, `draft.current_state_bindings.${name}`);
  }
  assertExactKeys(draft.implementation_bindings,
    ['context_compilation_module', 'focused_test', 'shadow_runner'],
    'draft.implementation_bindings');
  for (const [name, binding] of Object.entries(draft.implementation_bindings)) {
    if (binding.path !== M3_IMPLEMENTATION_PATHS[name]) {
      fail('IMPLEMENTATION_BINDING_DRIFT', `draft.${name}`);
    }
    assertBinding(binding, `draft.implementation_bindings.${name}`);
  }
  assertOutputBindings(draft.output_bindings, 'draft.output_bindings');
  if (canonicalJson(draft.output_bindings.map((binding) => binding.path))
    !== canonicalJson(expectedOutputPaths)) {
    fail('INVALID_OUTPUT_BINDINGS', 'draft output path order');
  }
  assertBinding(draft.diagnostics_binding, 'draft.diagnostics_binding');
  if (valueDigest(draft.output_bindings) !== draft.output_set_digest
    || draft.new_shadow_result_digest !== draft.output_set_digest
    || canonicalJson(draft.diagnostics_binding)
      !== canonicalJson(draft.output_bindings.at(-1))) {
    fail('OUTPUT_SET_DRIFT', 'draft');
  }
  assertExactKeys(draft.runtime_measurements, [
    'elapsed_milliseconds',
    'rss_before_bytes',
    'rss_after_bytes',
    'heap_used_before_bytes',
    'heap_used_after_bytes',
    'process_peak_rss_kibibytes',
  ], 'draft.runtime_measurements');
  if (Object.values(draft.runtime_measurements).some((value) =>
    !Number.isSafeInteger(value) || value < 0)) {
    fail('INVALID_DRAFT', 'runtime measurements');
  }
}

function assertChecks(checks, expected, label) {
  if (!Array.isArray(checks)
    || canonicalJson(checks.map((check) => check.check)) !== canonicalJson(expected)
    || checks.some((check) => check.result !== 'PASS')) {
    fail('CHECK_SET_DRIFT', label);
  }
}

function assertReview(review, draft, draftBinding) {
  assertExactKeys(review, [
    'schema_version',
    'review_id',
    'stage',
    'packet_id',
    'base_commit',
    'lifecycle_state',
    'status',
    'verdict',
    'technical_decision',
    'reviewer',
    'draft_receipt_binding',
    'authority_binding',
    'semantic_policy_binding',
    'm2_receipt_binding',
    'agreement_manifest_binding',
    'current_state_bindings',
    'implementation_bindings',
    'output_bindings',
    'diagnostics_binding',
    'output_set_digest',
    'context_metrics',
    'focused_checks',
    'exceptions',
  ], 'review');
  if (review.schema_version !== REVIEW_SCHEMA
    || review.packet_id !== PACKET_ID
    || review.stage !== 'M3'
    || review.base_commit !== M3_BASE_COMMIT
    || review.lifecycle_state !== 'SEALED'
    || review.status !== 'APPROVED'
    || review.verdict !== 'APPROVED'
    || review.technical_decision !== 'CONTEXT_COMPILATION_M3_ACCEPTED'
    || review.reviewer?.role !== 'SOL'
    || typeof review.reviewer?.identity !== 'string'
    || review.reviewer.identity.length === 0
    || !HEX_256.test(review.review_id || '')
    || review.review_id !== contentId(REVIEW_SCHEMA, (() => {
      const value = structuredClone(review);
      delete value.review_id;
      return value;
    })())
    || canonicalJson(review.draft_receipt_binding) !== canonicalJson(draftBinding)
    || canonicalJson(review.authority_binding) !== canonicalJson(draft.authority_binding)
    || canonicalJson(review.semantic_policy_binding)
      !== canonicalJson(draft.semantic_policy_binding)
    || canonicalJson(review.m2_receipt_binding)
      !== canonicalJson(draft.sealed_predecessor_bindings.m2_receipt)
    || canonicalJson(review.agreement_manifest_binding)
      !== canonicalJson(draft.agreement_manifest_binding)
    || review.output_set_digest !== draft.output_set_digest
    || canonicalJson(review.output_bindings) !== canonicalJson(draft.output_bindings)
    || canonicalJson(review.context_metrics) !== canonicalJson(draft.context_metrics)
    || canonicalJson(review.current_state_bindings) !== canonicalJson(draft.current_state_bindings)
    || canonicalJson(review.diagnostics_binding) !== canonicalJson(draft.diagnostics_binding)
    || !Array.isArray(review.exceptions)
    || review.exceptions.length !== 0) {
    fail('INVALID_REVIEW', 'identity or bound result');
  }
  assertChecks(review.focused_checks, REVIEW_CHECKS, 'review.focused_checks');
  assertExactKeys(review.implementation_bindings,
    Object.keys(M3_IMPLEMENTATION_PATHS), 'review.implementation_bindings');
  for (const binding of [
    review.authority_binding,
    review.semantic_policy_binding,
    review.m2_receipt_binding,
    review.agreement_manifest_binding,
    review.draft_receipt_binding,
    review.diagnostics_binding,
    ...Object.values(review.current_state_bindings),
    ...Object.values(review.implementation_bindings || {}),
    ...review.output_bindings,
  ]) {
    assertBinding(binding, binding?.path || 'review binding');
  }
}

function writeCanonicalOnce(absolutePath, value) {
  assertNotSymlink(absolutePath, repositoryPath(absolutePath));
  const bytes = Buffer.from(`${canonicalJson(value)}\n`, 'utf8');
  if (existsSync(absolutePath)) {
    const prior = readFileSync(absolutePath);
    if (!prior.equals(bytes)) fail('DIVERGENT_SEALED_OUTPUT_OVERWRITE', repositoryPath(absolutePath));
    return;
  }
  writeFileSync(absolutePath, bytes, { flag: 'wx' });
}

function main() {
  const args = parseArgs(process.argv);
  const authority = readJson(AUTHORITY_PATH);
  const m2Receipt = readJson(M2_RECEIPT_PATH);
  assertM2Predecessor(m2Receipt, authority);
  const draft = readJson(args.draft);
  assertDraft(draft);
  const draftBinding = fileBinding(args.draft, { schema_version: draft.schema_version });
  const review = readJson(args.review);
  assertReview(review, draft, draftBinding);
  const reviewBinding = fileBinding(args.review, {
    schema_version: review.schema_version,
    review_id: review.review_id,
  });
  const implementationBindings = {
    ...draft.implementation_bindings,
    finaliser: fileBinding(FINALISER_PATH),
    validator: fileBinding(VALIDATOR_PATH),
  };
  if (canonicalJson(review.implementation_bindings)
    !== canonicalJson(implementationBindings)) {
    fail('IMPLEMENTATION_BINDING_DRIFT', 'review versus finaliser');
  }
  const final = {
    ...draft,
    schema_version: FINAL_SCHEMA,
    lifecycle_state: 'SEALED',
    status: 'PASS',
    implementation_bindings: implementationBindings,
    draft_receipt_binding: draftBinding,
    technical_review_binding: reviewBinding,
    focused_checks: [
      ...review.focused_checks,
      { check: 'SOL_TECHNICAL_REVIEW', result: 'PASS' },
    ],
    input_digests: {
      ...draft.input_digests,
      draft_receipt: draftBinding.sha256,
      technical_review: reviewBinding.sha256,
    },
  };
  delete final.technical_review;
  const fullContractReview = readJson(FULL_CONTRACT_REVIEW_PATH);
  assertExactKeys(final, fullContractReview.receipt_contract.final_fields, 'final receipt');
  assertChecks(final.focused_checks, FINAL_CHECKS, 'final.focused_checks');
  assertZeroEffects(final, 'final');
  assertChangedFiles(authority);
  writeCanonicalOnce(args.final, final);
  process.stdout.write(`${canonicalJson({
    stage: 'M3',
    status: 'PASS',
    lifecycle_state: 'SEALED',
    output_set_digest: final.output_set_digest,
    final_receipt: repositoryPath(args.final),
  })}\n`);
}

main();
