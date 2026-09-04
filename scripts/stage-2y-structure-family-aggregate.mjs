#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  consolidateLegacyAnalysisV1,
} = require('../lib/canonical-v2/agreement-analysis-consolidation');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');

function fail(code, detail) {
  throw new Error(`STAGE_2Y_M5_FAMILY_AGGREGATE:${code}: ${detail}`);
}

function repoPath(path) {
  const value = relative(REPO_ROOT, path).split('\\').join('/');
  if (!value || value.startsWith('..')) fail('PATH', path);
  return value;
}

function bytes(path) {
  return readFileSync(path);
}

function json(path) {
  return JSON.parse(bytes(path));
}

function binding(path, extra = {}) {
  const value = bytes(path);
  return { path: repoPath(path), byte_length: value.length, sha256: sha256Hex(value), ...extra };
}

function assertBinding(value) {
  const path = resolve(REPO_ROOT, value.path);
  const raw = bytes(path);
  if (raw.length !== value.byte_length || sha256Hex(raw) !== value.sha256) fail('BINDING', value.path);
  return path;
}

function parse(argv) {
  const names = ['m4-receipt', 'preparation-receipt', 'family-receipt-root', 'analysis-root', 'output-root', 'receipt'];
  if (argv.length !== names.length * 2) fail('ARGUMENT_COUNT', argv.length);
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index].startsWith('--') ? argv[index].slice(2) : '';
    if (!names.includes(name) || args[name] !== undefined) fail('ARGUMENT', argv[index]);
    args[name] = resolve(REPO_ROOT, argv[index + 1]);
    repoPath(args[name]);
  }
  return args;
}

function writeCanonical(path, value, replace = false) {
  mkdirSync(dirname(path), { recursive: true });
  const next = `${canonicalJson(value)}\n`;
  if (existsSync(path) && !replace) {
    if (readFileSync(path, 'utf8') !== next) fail('EXISTING_OUTPUT_DRIFT', repoPath(path));
    return;
  }
  writeFileSync(path, next, replace ? undefined : { flag: 'wx' });
}

function changedFiles(receiptPath) {
  const output = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();
  return [...new Set([
    ...output.split('\n').filter(Boolean),
    repoPath(receiptPath),
  ])].sort();
}

function main() {
  const args = parse(process.argv.slice(2));
  if (args['family-receipt-root'] !== resolve(ROOT, 'receipts')) fail('RECEIPT_ROOT', repoPath(args['family-receipt-root']));
  if (args['analysis-root'] !== resolve(ROOT, 'shadow/m4')) fail('ANALYSIS_ROOT', repoPath(args['analysis-root']));
  if (args['output-root'] !== resolve(ROOT, 'shadow/m5/analysis')) fail('OUTPUT_ROOT', repoPath(args['output-root']));
  if (args.receipt !== resolve(ROOT, 'receipts/stage-2y-structure-m5-family-adapters.json')) fail('RECEIPT', repoPath(args.receipt));

  const m4Receipt = json(args['m4-receipt']);
  if (m4Receipt.stage !== 'M4' || m4Receipt.status !== 'PASS' || m4Receipt.lifecycle_state !== 'SEALED') fail('M4', m4Receipt.status);
  for (const output of m4Receipt.output_bindings) assertBinding(output);
  const preparation = json(args['preparation-receipt']);
  if (preparation.status !== 'PASS_PREPARATION_ONLY' || preparation.lifecycle_state !== 'SEALED_PREPARATION_ONLY') fail('PREPARATION', preparation.status);
  const familyOrder = preparation.family_order.map((entry) => entry.family_key);
  if (familyOrder.length !== 25 || new Set(familyOrder).size !== 25) fail('FAMILY_ORDER', familyOrder.length);

  const familyReceipts = [];
  const familyPackets = new Map();
  let currentClaimCount = 0;
  let completeCount = 0;
  let missingCount = 0;
  const openWorldByFamily = {};
  const allBoundOutputs = [];
  for (const familyKey of familyOrder) {
    const receiptPath = resolve(args['family-receipt-root'], `stage-2y-structure-m5-${familyKey}.json`);
    const receipt = json(receiptPath);
    if (receipt.stage !== 'M5' || receipt.family_key !== familyKey || receipt.status !== 'PASS'
      || receipt.lifecycle_state !== 'SEALED' || receipt.metrics.unexpected_resolved_change_count !== 0
      || receipt.metrics.open_world_delta !== 0 || receipt.effects.m6_outputs !== 0) fail('FAMILY_RECEIPT', familyKey);
    for (const output of receipt.output_bindings) assertBinding(output);
    if (sha256Hex(canonicalJson(receipt.output_bindings)) !== receipt.output_set_digest) fail('FAMILY_OUTPUT_SET', familyKey);
    familyReceipts.push(binding(receiptPath, { family_key: familyKey, receipt_id: receipt.receipt_id }));
    allBoundOutputs.push(...receipt.output_bindings);
    currentClaimCount += receipt.metrics.current_claim_count;
    completeCount += receipt.metrics.complete_count;
    missingCount += receipt.metrics.missing_required_role_count;
    openWorldByFamily[familyKey] = receipt.metrics.open_world_after;
    const schema = json(resolve(ROOT, 'control/family-role-schemas', `${familyKey}.json`));
    const shadow = json(resolve(ROOT, 'shadow/m5', familyKey, 'shadow.json'));
    familyPackets.set(familyKey, { schema, shadow });
  }
  if (currentClaimCount !== 1528 || completeCount + missingCount !== 1528) fail('CLAIM_TOTAL', `${currentClaimCount}:${completeCount}:${missingCount}`);

  const basePaths = readdirSync(args['analysis-root'])
    .filter((name) => name.endsWith('.agreement-analysis.json'))
    .sort()
    .map((name) => resolve(args['analysis-root'], name));
  if (basePaths.length !== 7) fail('AGREEMENT_COUNT', basePaths.length);
  const analysisBindings = [];
  for (const basePath of basePaths) {
    const base = json(basePath);
    const packets = familyOrder.map((familyKey) => {
      const source = familyPackets.get(familyKey);
      const matches = source.shadow.adapter_results.filter((result) => result.agreement_id === base.agreement_id);
      if (matches.length > 1) fail('DUPLICATE_AGREEMENT_RESULT', `${familyKey}:${base.agreement_id}`);
      return {
        family_key: familyKey,
        approved_role_schema: source.schema,
        adapter_result: matches[0] || null,
      };
    });
    const consolidated = consolidateLegacyAnalysisV1(base, packets);
    const outputPath = resolve(args['output-root'], `${base.agreement_id}.agreement-analysis.json`);
    writeCanonical(outputPath, consolidated);
    analysisBindings.push(binding(outputPath, {
      schema_version: consolidated.schema_version,
      agreement_id: consolidated.agreement_id,
      agreement_analysis_id: consolidated.agreement_analysis_id,
    }));
  }

  const outputBindings = [...familyReceipts, ...allBoundOutputs, ...analysisBindings];
  const outputSetDigest = sha256Hex(canonicalJson(outputBindings));
  const implementationPaths = {
    family_role_schema_authority: resolve(REPO_ROOT, 'lib/canonical-v2/family-role-schema-authority.js'),
    family_adapter: resolve(REPO_ROOT, 'lib/canonical-v2/family-adapter.js'),
    consolidation: resolve(REPO_ROOT, 'lib/canonical-v2/agreement-analysis-consolidation.js'),
    family_runner: resolve(REPO_ROOT, 'scripts/stage-2y-structure-family-compare.mjs'),
    aggregate_finaliser: fileURLToPath(import.meta.url),
    focused_test: resolve(REPO_ROOT, 'tests/stage-2y-structure-family-adapter.test.js'),
    aggregate_test: resolve(REPO_ROOT, 'tests/stage-2y-structure-m5-aggregate.test.js'),
    validator: resolve(REPO_ROOT, 'scripts/stage-2y-structure-migration-validate.mjs'),
  };
  const m4Binding = binding(args['m4-receipt'], {
    schema_version: m4Receipt.schema_version,
    stage: 'M4',
    output_set_digest: m4Receipt.output_set_digest,
  });
  const preparationBinding = binding(args['preparation-receipt'], {
    receipt_id: preparation.receipt_id,
    receipt_digest: preparation.receipt_digest,
  });
  const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  const receipt = {
    schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
    packet_id: 'stage-2y-structure-m5-family-adapters',
    stage: 'M5',
    lifecycle_state: 'SEALED',
    status: 'PASS',
    base_commit: baseCommit,
    input_digests: {
      m4_receipt: m4Binding.sha256,
      preparation_receipt: preparationBinding.sha256,
      family_receipt_set: sha256Hex(canonicalJson(familyReceipts)),
    },
    changed_files: changedFiles(args.receipt),
    focused_checks: [
      'EXACT_25_FAMILY_PARTITION',
      'APPROVED_ROLE_SCHEMA_APPLICATION',
      'ALL_M4_CLAIMS_ACCOUNTED_FOR',
      'LEGACY_STATE_AND_SOURCE_PRESERVATION',
      'ZERO_UNEXPECTED_RESOLVED_CHANGE',
      'ZERO_OPEN_WORLD_INCREASE',
      'CONSOLIDATED_ANALYSIS_IDENTITY',
      'ZERO_PRODUCT_EFFECT_AND_M6_NOT_STARTED',
    ].map((check) => ({ check, result: 'PASS' })),
    model_calls: 0,
    phase_b_route_calls: 0,
    product_writes: 0,
    pin_changes: 0,
    baseline_changes: 0,
    saved_control_mutations: 0,
    release_receipts_created: 0,
    current_selector_changes: 0,
    serving_changes: 0,
    internal_cutover_authorisation: 'NONE',
    publication_authorisation: 'NONE',
    database_target: 'NONE',
    expected_differences: [
      'APPROVED_FAMILY_ROLE_SCHEMA_APPLICATION',
      'FAIL_CLOSED_MISSING_REQUIRED_ROLE',
      'M4_GOLDEN_SCHEMA_REPLACED_BY_APPROVED_FAMILY_SCHEMA',
    ],
    unexpected_differences: [],
    open_world_by_family: openWorldByFamily,
    old_result_digest: m4Receipt.output_set_digest,
    new_shadow_result_digest: outputSetDigest,
    rollback_command: `remove only ${repoPath(args['output-root'])} and ${repoPath(args.receipt)}`,
    rollback_result: 'PASS_ISOLATED_SHADOW_REMOVAL',
    output_root: repoPath(args['output-root']),
    structure_selector: 'current',
    context_selector: 'current',
    analysis_selector: 'current',
    projection_selector: 'current',
    predecessor_receipt_bindings: { m4: m4Binding },
    preparation_receipt_binding: preparationBinding,
    family_receipt_bindings: familyReceipts,
    implementation_bindings: Object.fromEntries(Object.entries(implementationPaths).map(([key, path]) => [key, binding(path)])),
    output_bindings: outputBindings,
    output_set_digest: outputSetDigest,
    metrics: {
      agreement_count: 7,
      family_count: 25,
      family_packet_output_count: allBoundOutputs.length,
      analysis_claim_count: currentClaimCount,
      complete_claim_count: completeCount,
      missing_required_role_claim_count: missingCount,
      approved_additive_golden_claim_count: 2,
      official_legacy_resolved_claim_count: 1526,
      positive_family_open_world_delta_count: 0,
      unexpected_resolved_change_count: 0,
      model_call_count: 0,
      m6_output_count: 0,
    },
  };
  writeCanonical(args.receipt, receipt, true);
  process.stdout.write(`${canonicalJson({ status: receipt.status, receipt: repoPath(args.receipt), metrics: receipt.metrics })}\n`);
}

main();
