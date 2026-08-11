#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = resolve(
  REPO_ROOT,
  'evidence/canonical-v2/stage-2y-structure-migration',
);
const EXPECTED_DRAFT = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m2-agreement-index-draft.json',
);
const EXPECTED_REVIEW = resolve(
  MIGRATION_ROOT,
  'reviews/stage-2y-structure-m2-sol-technical-review.json',
);
const EXPECTED_FINAL = resolve(
  MIGRATION_ROOT,
  'receipts/stage-2y-structure-m2-agreement-index.json',
);
const M2_BASE_COMMIT = '5c61c51b81f8983d3f18c6dcef2086eff29e661c';
const PACKET_ID = 'stage-2y-structure-m2-agreement-index';
const VALIDATOR_PATH = resolve(REPO_ROOT, 'scripts/stage-2y-structure-migration-validate.mjs');
const INLINE_PARSER_METRICS_SCHEMA = 'STAGE_2Y_STRUCTURE_M2_INLINE_PARSER_METRICS/V1';
const M2_REVIEW_CHECKS = Object.freeze([
  'PUBLIC_API_AND_SYNTHETIC',
  'SEVEN_AGREEMENT_EXACT_SOURCE',
  'METSERA_7_04_GOLDEN',
  'RED_HAT_STRUCTURE_GOLDEN',
  'CONCHO_6_9_A_GOLDEN',
  'INLINE_MARKER_DISPOSITION_GATE',
  'FROZEN_CURRENT_STATE',
  'STRUCTURE_AND_INHERITANCE_GATE',
  'NO_PRODUCTION_EFFECTS',
]);
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
  'm0_m1_sealed_artefact_mutations',
]);

function fail(code, message) {
  throw new Error(`STAGE_2Y_AGREEMENT_INDEX_M2_FINALISE:${code}: ${message}`);
}

function repoPath(absolutePath) {
  const value = relative(REPO_ROOT, absolutePath).split('\\').join('/');
  if (!value || value.startsWith('..')) fail('PATH_OUTSIDE_REPOSITORY', absolutePath);
  return value;
}

function absoluteRepoPath(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/')) {
    fail('INVALID_REPOSITORY_PATH', String(value));
  }
  const absolutePath = resolve(REPO_ROOT, value);
  repoPath(absolutePath);
  return absolutePath;
}

function readJson(absolutePath) {
  if (!existsSync(absolutePath)) fail('MISSING_FILE', repoPath(absolutePath));
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

function fileBinding(absolutePath, extra = {}) {
  const bytes = readFileSync(absolutePath);
  return {
    path: repoPath(absolutePath),
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    ...extra,
  };
}

function assertBinding(binding, label) {
  if (!binding || typeof binding.path !== 'string' || typeof binding.sha256 !== 'string') {
    fail('INVALID_BINDING', label);
  }
  const actual = fileBinding(absoluteRepoPath(binding.path));
  if (actual.sha256 !== binding.sha256
    || (binding.byte_length !== undefined && actual.byte_length !== binding.byte_length)) {
    fail('BINDING_DRIFT', label);
  }
  return actual;
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

function assertInlineParserMetrics(metrics, label) {
  assertExactKeys(metrics, ['schema_version', 'by_deal'], label);
  if (metrics.schema_version !== INLINE_PARSER_METRICS_SCHEMA
    || !Array.isArray(metrics.by_deal)
    || metrics.by_deal.length !== 7) {
    fail('INVALID_INLINE_PARSER_METRICS', `${label} must contain seven deal rows`);
  }
  const numericFields = [
    'candidate_sequences',
    'authored_lists',
    'non_structural_markers',
    'unresolved_lists',
    'ambiguities',
    'authored_limbs',
    'maximum_depth',
  ];
  const countFields = numericFields.filter((field) =>
    !['ambiguities', 'maximum_depth'].includes(field));
  const agreementIds = new Set();
  const deals = new Set();
  for (const [index, row] of metrics.by_deal.entries()) {
    assertExactKeys(row, [
      'agreement_id',
      'deal',
      ...numericFields,
      'by_style',
    ], `${label}.by_deal[${index}]`);
    if (!/^[0-9a-f]{64}$/.test(row.agreement_id || '')
      || typeof row.deal !== 'string'
      || row.deal.length === 0
      || agreementIds.has(row.agreement_id)
      || deals.has(row.deal)
      || numericFields.some((field) => !Number.isSafeInteger(row[field]) || row[field] < 0)
      || row.authored_lists + row.non_structural_markers + row.unresolved_lists
        !== row.candidate_sequences
      || row.ambiguities < row.unresolved_lists
      || row.authored_limbs < row.authored_lists * 2
      || !Array.isArray(row.by_style)) {
      fail('INVALID_INLINE_PARSER_METRICS', `${label}.by_deal[${index}]`);
    }
    agreementIds.add(row.agreement_id);
    deals.add(row.deal);
    const styleNames = [];
    const styleTotals = Object.fromEntries(countFields.map((field) => [field, 0]));
    for (const [styleIndex, style] of row.by_style.entries()) {
      assertExactKeys(style, ['style', ...countFields],
        `${label}.by_deal[${index}].by_style[${styleIndex}]`);
      if (typeof style.style !== 'string'
        || style.style.length === 0
        || styleNames.includes(style.style)
        || countFields.some((field) => !Number.isSafeInteger(style[field]) || style[field] < 0)
        || style.authored_lists + style.non_structural_markers + style.unresolved_lists
          !== style.candidate_sequences
        || style.authored_limbs < style.authored_lists * 2) {
        fail('INVALID_INLINE_PARSER_METRICS',
          `${label}.by_deal[${index}].by_style[${styleIndex}]`);
      }
      styleNames.push(style.style);
      for (const field of countFields) styleTotals[field] += style[field];
    }
    if (canonicalJson(styleNames) !== canonicalJson(
      [...styleNames].sort((left, right) => left.localeCompare(right)),
    )
      || countFields.some((field) => styleTotals[field] !== row[field])) {
      fail('INVALID_INLINE_PARSER_METRICS', `${label}.by_deal[${index}].by_style totals`);
    }
  }
}

function parseArgs(argv) {
  if (argv.length !== 8) {
    fail('INVALID_ARGUMENTS', 'requires --draft-receipt, --review and --final-receipt');
  }
  const allowed = new Map([
    ['--draft-receipt', EXPECTED_DRAFT],
    ['--review', EXPECTED_REVIEW],
    ['--final-receipt', EXPECTED_FINAL],
  ]);
  const values = new Map();
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !value || values.has(key)) fail('INVALID_ARGUMENTS', key);
    const absolutePath = resolve(value);
    if (absolutePath !== allowed.get(key)) fail('PATH_DRIFT', key);
    values.set(key, absolutePath);
  }
  if (values.size !== allowed.size) fail('INVALID_ARGUMENTS', 'missing required path');
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

function assertDraft(draft) {
  if (draft.schema_version !== 'STAGE_2Y_STRUCTURE_M2_DRAFT_RECEIPT/V1'
    || draft.stage !== 'M2'
    || draft.lifecycle_state !== 'REVIEW_PENDING_DRAFT'
    || draft.status !== 'STOPPED'
    || draft.technical_review !== 'PENDING_SOL_REVIEW'
    || draft.base_commit !== M2_BASE_COMMIT
    || draft.agreement_count !== 7
    || draft.source_reference_count !== 130
    || !Array.isArray(draft.output_bindings)
    || draft.output_bindings.length !== 7) {
    fail('INVALID_DRAFT', 'draft state or cohort changed');
  }
  assertZeroEffects(draft, 'draft');
  assertExactKeys(draft.sealed_predecessor_bindings,
    ['m0_control_manifest', 'm0_receipt', 'm1_decision', 'm1_receipt', 'm1_sol_review'],
    'draft.sealed_predecessor_bindings');
  assertExactKeys(draft.current_state_bindings,
    ['baseline_manifest', 'current_baseline', 'current_measurement', 'current_rendered_rows'],
    'draft.current_state_bindings');
  assertExactKeys(draft.implementation_bindings,
    [
      'agreement_index_module',
      'private_inline_structure_module',
      'private_inline_structure_test',
      'shadow_runner',
      'focused_test',
    ],
    'draft.implementation_bindings');
  assertInlineParserMetrics(draft.inline_parser_metrics, 'draft.inline_parser_metrics');
  for (const binding of [
    draft.authority_binding,
    draft.structural_policy_binding,
    draft.agreement_manifest_binding,
    ...Object.values(draft.sealed_predecessor_bindings || {}),
    ...Object.values(draft.current_state_bindings || {}),
    ...Object.values(draft.implementation_bindings || {}),
    ...draft.output_bindings,
  ]) {
    assertBinding(binding, binding?.path || 'draft binding');
  }
  if (valueDigest(draft.output_bindings) !== draft.output_set_digest) {
    fail('OUTPUT_SET_DRIFT', 'draft output-set digest');
  }
}

function assertReview(review, draft, draftBinding) {
  if (review.schema_version !== 'STAGE_2Y_STRUCTURE_SOL_TECHNICAL_REVIEW/V1'
    || review.stage !== 'M2'
    || review.lifecycle_state !== 'SEALED'
    || review.status !== 'APPROVED'
    || review.verdict !== 'APPROVED'
    || review.technical_decision !== 'AGREEMENT_INDEX_M2_ACCEPTED'
    || review.packet_id !== PACKET_ID
    || review.base_commit !== M2_BASE_COMMIT
    || review.reviewer?.role !== 'SOL'
    || review.draft_receipt_binding?.path !== draftBinding.path
    || review.draft_receipt_binding?.sha256 !== draftBinding.sha256
    || review.output_set_digest !== draft.output_set_digest
    || canonicalJson(review.output_bindings) !== canonicalJson(draft.output_bindings)
    || canonicalJson(review.inline_parser_metrics) !== canonicalJson(draft.inline_parser_metrics)
    || !Array.isArray(review.exceptions)
    || review.exceptions.length !== 0) {
    fail('REVIEW_NOT_APPROVED', 'Sol review is missing, stale or qualified');
  }
  if (canonicalJson(review.focused_checks) !== canonicalJson(
    M2_REVIEW_CHECKS.map((check) => ({ check, result: 'PASS' })),
  )) fail('REVIEW_CHECK_MISSING', 'review check set is not exact');
  assertExactKeys(review.implementation_bindings,
    [
      'agreement_index_module',
      'private_inline_structure_module',
      'private_inline_structure_test',
      'shadow_runner',
      'focused_test',
      'finaliser',
      'validator',
    ],
    'review.implementation_bindings');
  for (const [name, binding] of Object.entries(draft.implementation_bindings)) {
    const reviewed = review.implementation_bindings?.[name];
    if (!reviewed || reviewed.path !== binding.path || reviewed.sha256 !== binding.sha256) {
      fail('REVIEW_IMPLEMENTATION_DRIFT', name);
    }
  }
  for (const [name, absolutePath] of Object.entries({
    finaliser: fileURLToPath(import.meta.url),
    validator: VALIDATOR_PATH,
  })) {
    const actual = fileBinding(absolutePath);
    const reviewed = review.implementation_bindings?.[name];
    if (!reviewed || reviewed.path !== actual.path || reviewed.sha256 !== actual.sha256) {
      fail('REVIEW_IMPLEMENTATION_DRIFT', name);
    }
  }
  const { review_id: ignored, ...reviewPayload } = review;
  if (review.review_id !== contentId(review.schema_version, reviewPayload)) {
    fail('REVIEW_ID_DRIFT', 'review_id does not bind the review payload');
  }
}

function writeFinal(absolutePath, value) {
  const bytes = `${canonicalJson(value)}\n`;
  mkdirSync(dirname(absolutePath), { recursive: true });
  if (existsSync(absolutePath)) {
    if (readFileSync(absolutePath, 'utf8') !== bytes) {
      fail('SEALED_OUTPUT_DIVERGENCE', repoPath(absolutePath));
    }
    return;
  }
  writeFileSync(absolutePath, bytes, { encoding: 'utf8', flag: 'wx' });
}

function main() {
  const args = parseArgs(process.argv);
  const draft = readJson(args.draft);
  assertDraft(draft);
  const draftBinding = fileBinding(args.draft, {
    schema_version: draft.schema_version,
  });
  const review = readJson(args.review);
  assertReview(review, draft, draftBinding);
  const reviewBinding = fileBinding(args.review, {
    schema_version: review.schema_version,
  });
  const finaliserBinding = fileBinding(fileURLToPath(import.meta.url));
  const validatorBinding = fileBinding(VALIDATOR_PATH);
  const m1Receipt = readJson(absoluteRepoPath(
    draft.sealed_predecessor_bindings.m1_receipt.path,
  ));
  const changedFiles = [
    'evidence/canonical-v2/stage-2y-structure-migration/control/m2-authority.json',
    'evidence/canonical-v2/stage-2y-structure-migration/control/structural-policy.json',
    'lib/canonical-v2/agreement-index.js',
    'lib/canonical-v2/agreement-inline-structure.js',
    'tests/canonical-v2-agreement-inline-structure.test.js',
    'scripts/stage-2y-agreement-index-shadow.mjs',
    'scripts/stage-2y-agreement-index-m2-finalise.mjs',
    'scripts/stage-2y-structure-migration-validate.mjs',
    'tests/canonical-v2-agreement-index.test.js',
    ...draft.output_bindings.map((binding) => binding.path),
    draftBinding.path,
    reviewBinding.path,
    repoPath(args.final),
  ];
  const receipt = {
    schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
    packet_id: PACKET_ID,
    stage: 'M2',
    lifecycle_state: 'SEALED',
    status: 'PASS',
    base_commit: M2_BASE_COMMIT,
    authority_binding: draft.authority_binding,
    structural_policy_binding: draft.structural_policy_binding,
    agreement_manifest_binding: draft.agreement_manifest_binding,
    sealed_predecessor_bindings: draft.sealed_predecessor_bindings,
    current_state_bindings: draft.current_state_bindings,
    implementation_bindings: {
      ...draft.implementation_bindings,
      finaliser: finaliserBinding,
      validator: validatorBinding,
    },
    draft_receipt_binding: draftBinding,
    technical_review_binding: reviewBinding,
    agreement_count: draft.agreement_count,
    source_reference_count: draft.source_reference_count,
    output_root: draft.output_root,
    output_bindings: draft.output_bindings,
    output_set_digest: draft.output_set_digest,
    inline_parser_metrics: draft.inline_parser_metrics,
    runtime_measurements: draft.runtime_measurements,
    input_digests: {
      control_manifest: draft.sealed_predecessor_bindings.m0_control_manifest.sha256,
      m0_receipt: draft.sealed_predecessor_bindings.m0_receipt.sha256,
      m1_receipt: draft.sealed_predecessor_bindings.m1_receipt.sha256,
      m2_authority: draft.authority_binding.sha256,
      structural_policy: draft.structural_policy_binding.sha256,
      agreement_manifest: draft.agreement_manifest_binding.sha256,
      draft_receipt: draftBinding.sha256,
      technical_review: reviewBinding.sha256,
    },
    changed_files: changedFiles,
    expected_differences: [],
    unexpected_differences: [],
    open_world_by_family: m1Receipt.open_world_by_family,
    old_result_digest: draft.current_state_bindings.current_measurement.sha256,
    new_shadow_result_digest: draft.output_set_digest,
    focused_checks: [
      { check: 'PUBLIC_API_AND_SYNTHETIC', result: 'PASS' },
      { check: 'SEVEN_AGREEMENT_EXACT_SOURCE', result: 'PASS' },
      { check: 'METSERA_7_04_GOLDEN', result: 'PASS' },
      { check: 'RED_HAT_STRUCTURE_GOLDEN', result: 'PASS' },
      { check: 'CONCHO_6_9_A_GOLDEN', result: 'PASS' },
      { check: 'INLINE_MARKER_DISPOSITION_GATE', result: 'PASS' },
      { check: 'FROZEN_CURRENT_STATE', result: 'PASS' },
      { check: 'STRUCTURE_AND_INHERITANCE_GATE', result: 'PASS' },
      { check: 'NO_PRODUCTION_EFFECTS', result: 'PASS' },
      { check: 'SOL_TECHNICAL_REVIEW', result: 'PASS' },
    ],
    pin_changes: 0,
    baseline_changes: 0,
    saved_control_mutations: 0,
    release_receipts_created: 0,
    current_selector_changes: 0,
    model_calls: 0,
    phase_b_route_calls: 0,
    network_calls: 0,
    product_writes: 0,
    serving_changes: 0,
    m0_m1_sealed_artefact_mutations: 0,
    structure_selector: 'current',
    context_selector: 'current',
    analysis_selector: 'current',
    projection_selector: 'current',
    database_target: 'NONE',
    phase_b_status: 'DEFERRED_LOCKED',
    publication_authorisation: 'NONE',
    internal_cutover_authorisation: 'NONE',
    external_access_authorisation: 'NONE',
    rollback_result: 'NOT_RUN_ADDITIVE_SHADOW_ONLY',
    rollback_command: 'git revert --no-edit <M2_COMMIT_SHA>',
  };
  assertZeroEffects(receipt, 'final receipt');
  writeFinal(args.final, receipt);
  process.stdout.write(`${canonicalJson({
    schema_version: 'STAGE_2Y_AGREEMENT_INDEX_M2_FINALISATION/V1',
    stage: 'M2',
    status: 'PASS',
    final_receipt_binding: fileBinding(args.final),
    technical_review_binding: reviewBinding,
    output_set_digest: receipt.output_set_digest,
    inline_parser_metrics: receipt.inline_parser_metrics,
    model_calls: 0,
    phase_b_route_calls: 0,
    publication_authorisation: 'NONE',
  })}\n`);
}

main();
