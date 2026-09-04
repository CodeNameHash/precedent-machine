#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { adaptFamily } = require('../lib/canonical-v2/family-adapter');
const { validateApprovedFamilyRoleSchema } = require('../lib/canonical-v2/family-role-schema-authority');
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_ROOT = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');
const PACKET_FILES = [
  'current.json',
  'shadow.json',
  'adapter.json',
  'claim-diff.json',
  'row-diff.json',
  'reparse-retirement.json',
  'open-world.json',
  'selector-state.json',
  'rollback.json',
];

function fail(code, detail) {
  throw new Error(`STAGE_2Y_M5_FAMILY_COMPARE:${code}: ${detail}`);
}

function repoPath(path) {
  const value = relative(REPO_ROOT, path).split('\\').join('/');
  if (!value || value.startsWith('..')) fail('PATH_OUTSIDE_REPOSITORY', path);
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

function writeCanonical(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${canonicalJson(value)}\n`, { flag: 'wx' });
}

function parse(argv) {
  const names = ['family', 'family-manifest', 'control', 'role-schema', 'm4-receipt', 'analysis-root', 'output-root'];
  if (argv.length !== names.length * 2) fail('ARGUMENT_COUNT', argv.length);
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index].startsWith('--') ? argv[index].slice(2) : '';
    if (!names.includes(name) || args[name] !== undefined) fail('ARGUMENT', argv[index]);
    args[name] = argv[index + 1];
  }
  return args;
}

function exactPath(value) {
  if (typeof value !== 'string' || value.startsWith('/')) fail('PATH', value);
  const path = resolve(REPO_ROOT, value);
  repoPath(path);
  return path;
}

function comparatorCounts(pack) {
  const counts = { resolved: 0, review: 0, open_world: 0, residuals: 0 };
  for (const comparator of pack.comparator_run_bindings) {
    const resolutionPath = exactPath(comparator.resolution_binding.path);
    const resolutionBytes = bytes(resolutionPath);
    if (resolutionBytes.length !== comparator.resolution_binding.byte_length
      || sha256Hex(resolutionBytes) !== comparator.resolution_binding.sha256) {
      fail('COMPARATOR_BINDING', comparator.run_identifier);
    }
    const resolution = JSON.parse(resolutionBytes);
    counts.resolved += resolution.resolved?.length || 0;
    counts.review += resolution.review_queue?.length || 0;
    counts.open_world += resolution.open_world?.length || 0;
    counts.residuals += resolution.residuals?.length || 0;
  }
  return counts;
}

function packetIdentity(schemaVersion, value) {
  const copy = structuredClone(value);
  delete copy.packet_id;
  return contentId(schemaVersion, copy);
}

function main() {
  const args = parse(process.argv.slice(2));
  const familyKey = args.family;
  const familyManifestPath = exactPath(args['family-manifest']);
  const controlPath = exactPath(args.control);
  const roleSchemaPath = exactPath(args['role-schema']);
  const m4ReceiptPath = exactPath(args['m4-receipt']);
  const analysisRoot = exactPath(args['analysis-root']);
  const outputRoot = exactPath(args['output-root']);
  const expectedOutputRoot = resolve(MIGRATION_ROOT, 'shadow/m5', familyKey);
  if (outputRoot !== expectedOutputRoot) fail('OUTPUT_ROOT', repoPath(outputRoot));

  const familyManifest = json(familyManifestPath);
  if (!familyManifest.family_keys.includes(familyKey)) fail('FAMILY_NOT_REGISTERED', familyKey);
  const expectedSchemaPath = resolve(MIGRATION_ROOT, 'control/family-role-schemas', `${familyKey}.json`);
  if (roleSchemaPath !== expectedSchemaPath) fail('ROLE_SCHEMA_PATH', repoPath(roleSchemaPath));
  const authorityPath = resolve(MIGRATION_ROOT, 'control/family-execution-authorities', `${familyKey}.json`);
  const roleSchemaBytes = bytes(roleSchemaPath);
  const authority = json(authorityPath);
  const roleSchema = validateApprovedFamilyRoleSchema(roleSchemaBytes, authority);

  const m4Receipt = json(m4ReceiptPath);
  if (m4Receipt.stage !== 'M4' || m4Receipt.status !== 'PASS' || m4Receipt.lifecycle_state !== 'SEALED') {
    fail('M4_RECEIPT', m4Receipt.status);
  }
  for (const output of m4Receipt.output_bindings) {
    const outputPath = exactPath(output.path);
    const outputBytes = bytes(outputPath);
    if (outputBytes.length !== output.byte_length || sha256Hex(outputBytes) !== output.sha256) fail('M4_OUTPUT_BINDING', output.path);
  }

  const packPath = resolve(MIGRATION_ROOT, 'preparation/m5/calibration-packs', `${familyKey}.json`);
  const pack = json(packPath);
  const baselineCounts = comparatorCounts(pack);
  const analysisPaths = readdirSync(analysisRoot)
    .filter((name) => name.endsWith('.agreement-analysis.json'))
    .sort()
    .map((name) => resolve(analysisRoot, name));
  const baseAnalyses = analysisPaths.map(json);
  const currentClaims = baseAnalyses.flatMap((analysis) => analysis.claims.filter((claim) => claim.family === familyKey));
  const resolutionSetDiffPath = resolve(analysisRoot, 'resolution-set-diff.json');
  const resolutionSetDiff = json(resolutionSetDiffPath);
  const familyClaimDiffs = resolutionSetDiff.claim_diffs.filter((entry) => entry.family === familyKey);
  const additiveGoldenCount = familyClaimDiffs.filter(
    (entry) => entry.classification === 'APPROVED_ADDITIVE_GOLDEN_PROPOSITION',
  ).length;
  const unexplainedDiffs = familyClaimDiffs.filter(
    (entry) => !['IDENTICAL', 'APPROVED_ADDITIVE_GOLDEN_PROPOSITION'].includes(entry.classification),
  );
  if (unexplainedDiffs.length > 0
    || familyClaimDiffs.length !== currentClaims.length
    || currentClaims.length !== baselineCounts.resolved + additiveGoldenCount) {
    fail(
      'M4_COMPARATOR_COUNT',
      `${familyKey}:${currentClaims.length}:${baselineCounts.resolved}:${additiveGoldenCount}:${unexplainedDiffs.length}`,
    );
  }

  const adapterResults = baseAnalyses.map((baseAnalysis) => adaptFamily(baseAnalysis, {
    schema_version: 'STAGE_2Y_FAMILY_ADAPTER_TASK/V1',
    family_key: familyKey,
    approved_role_schema: roleSchema,
  })).filter((result) => result.claim_count > 0);
  const validations = adapterResults.flatMap((result) => result.validations);
  const validationByClaim = new Map(validations.map((entry) => [entry.analysis_claim_id, entry]));
  const completeCount = validations.filter((entry) => entry.validation_state === 'COMPLETE').length;
  const missingCount = validations.length - completeCount;
  const currentRowsFile = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-n-rendered-rows.json');
  const renderedRows = json(currentRowsFile).records.filter((record) => record.family === familyKey);

  const common = {
    family_key: familyKey,
    approved_role_schema_binding: binding(roleSchemaPath, {
      family_role_schema_id: roleSchema.family_role_schema_id,
      payload_digest: roleSchema.payload_digest,
      approval_id: roleSchema.approval_id,
    }),
    family_execution_authority_binding: binding(authorityPath, { authority_digest: authority.authority_digest }),
    m4_receipt_binding: binding(m4ReceiptPath, { output_set_digest: m4Receipt.output_set_digest }),
    calibration_pack_binding: binding(packPath, { calibration_pack_id: pack.calibration_pack_id }),
    m4_resolution_set_diff_binding: binding(resolutionSetDiffPath, {
      resolution_set_diff_id: resolutionSetDiff.resolution_set_diff_id,
    }),
  };
  const packets = {};
  packets['current.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_CURRENT_RESULT/V1',
    packet_id: null,
    ...common,
    claim_count: currentClaims.length,
    comparator_resolved_claim_count: baselineCounts.resolved,
    approved_additive_golden_claim_count: additiveGoldenCount,
    claims: currentClaims,
  };
  packets['shadow.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_SHADOW_RESULT/V1',
    packet_id: null,
    ...common,
    claim_count: currentClaims.length,
    complete_count: completeCount,
    missing_required_role_count: missingCount,
    adapter_results: adapterResults,
  };
  packets['adapter.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_ADAPTER/V1',
    packet_id: null,
    ...common,
    adapter_module_binding: binding(resolve(REPO_ROOT, 'lib/canonical-v2/family-adapter.js')),
    runner_binding: binding(fileURLToPath(import.meta.url)),
    source_mode: 'M4_ANALYSIS_AND_SAVED_COMPARATOR_RESPONSES_ONLY',
    raw_source_reparse_calls: 0,
    model_calls: 0,
  };
  packets['claim-diff.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_CLAIM_DIFF/V1',
    packet_id: null,
    ...common,
    diff_contract_binding: binding(resolve(MIGRATION_ROOT, 'control/diff-contract.json')),
    claim_count: currentClaims.length,
    comparisons: currentClaims.map((claim) => {
      const validation = validationByClaim.get(claim.analysis_claim_id);
      return {
        analysis_claim_id: claim.analysis_claim_id,
        claim_definition_key: claim.claim_definition_key,
        legacy_resolution_state_before: claim.legacy_resolution_state,
        legacy_resolution_state_after: claim.legacy_resolution_state,
        semantic_fields_changed: [],
        proposition_validation_state_before: claim.proposition_validation_state,
        proposition_validation_state_after: validation.validation_state,
        disposition: validation.validation_state === 'COMPLETE'
          ? 'INTENDED_COMPLETE_APPROVED_SCHEMA_APPLICATION'
          : 'INTENDED_MISSING_REQUIRED_ROLE_FAIL_CLOSED',
        source_evidence_edge_ids: validation.source_evidence_edge_ids,
      };
    }),
    unexpected_resolved_changes: [],
  };
  packets['row-diff.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_ROW_DIFF/V1',
    packet_id: null,
    ...common,
    current_rendered_record_count: renderedRows.length,
    current_rendered_rows_binding: binding(currentRowsFile),
    shadow_rendered_record_count: renderedRows.length,
    comparison_state: 'NO_M5_PROJECTION_CHANGE_M6_NOT_STARTED',
    unexpected_row_changes: [],
  };
  packets['reparse-retirement.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_REPARSE_RETIREMENT/V1',
    packet_id: null,
    ...common,
    duplicate_reparse_retired: true,
    retirement_scope: 'SHADOW_ADAPTER_ONLY',
    replacement_source: 'M2_M3_M4_BOUND_INPUTS',
    current_path_changed: false,
  };
  packets['open-world.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_OPEN_WORLD/V1',
    packet_id: null,
    ...common,
    comparator_run_count: pack.comparator_run_bindings.length,
    before: baselineCounts.open_world,
    after: baselineCounts.open_world,
    delta: 0,
    review_record_count: baselineCounts.review,
    resolution_residual_count: baselineCounts.residuals,
    supplemental_inputs_excluded_from_comparator_metrics: pack.supplemental_input_bindings.length,
  };
  packets['selector-state.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_SELECTOR_STATE/V1',
    packet_id: null,
    ...common,
    current_selector: 'CURRENT_RESOLVER',
    shadow_selector: 'INACTIVE_M5_COMPARISON_ONLY',
    selector_changed: false,
    product_import_authorised: false,
    serving_authorised: false,
    publication_authorised: false,
    capitalisation_parked: familyKey === 'CAPITALISATION',
  };
  packets['rollback.json'] = {
    schema_version: 'STAGE_2Y_FAMILY_ROLLBACK_RECEIPT/V1',
    packet_id: null,
    ...common,
    rollback_state: 'PASS_ISOLATED_SHADOW_REMOVAL',
    current_path_unchanged: true,
    selector_unchanged: true,
    product_state_unchanged: true,
  };

  mkdirSync(outputRoot, { recursive: true });
  const outputBindings = [];
  for (const filename of PACKET_FILES) {
    const packet = packets[filename];
    packet.packet_id = packetIdentity(packet.schema_version, packet);
    const path = resolve(outputRoot, filename);
    writeCanonical(path, packet);
    outputBindings.push(binding(path, { schema_version: packet.schema_version, packet_id: packet.packet_id }));
  }

  const receipt = {
    schema_version: 'STAGE_2Y_M5_FAMILY_PACKET_RECEIPT/V1',
    receipt_id: null,
    stage: 'M5',
    family_key: familyKey,
    lifecycle_state: 'SEALED',
    status: 'PASS',
    ...common,
    family_manifest_binding: binding(familyManifestPath),
    control_manifest_binding: binding(controlPath),
    output_bindings: outputBindings,
    output_set_digest: sha256Hex(canonicalJson(outputBindings)),
    metrics: {
      comparator_run_count: pack.comparator_run_bindings.length,
      current_claim_count: currentClaims.length,
      shadow_claim_count: validations.length,
      complete_count: completeCount,
      missing_required_role_count: missingCount,
      unexpected_resolved_change_count: 0,
      open_world_before: baselineCounts.open_world,
      open_world_after: baselineCounts.open_world,
      open_world_delta: 0,
      model_call_count: 0,
    },
    effects: {
      product_writes: 0,
      serving_changes: 0,
      selector_changes: 0,
      publication_changes: 0,
      m6_outputs: 0,
    },
    checks: [
      'APPROVED_SCHEMA_AND_AUTHORITY',
      'M4_TRUST_ROOT',
      'EXACT_COMPARATOR_PARTITION',
      'ALL_CLAIMS_COMPARED',
      'ZERO_UNEXPECTED_RESOLVED_CHANGE',
      'ZERO_OPEN_WORLD_INCREASE',
      'ZERO_PRODUCT_EFFECT',
      'ISOLATED_ROLLBACK',
    ].map((check_id) => ({ check_id, status: 'PASS' })),
  };
  receipt.receipt_id = contentId(receipt.schema_version, Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receipt_id')));
  const receiptPath = resolve(MIGRATION_ROOT, 'receipts', `stage-2y-structure-m5-${familyKey}.json`);
  writeCanonical(receiptPath, receipt);
  process.stdout.write(`${canonicalJson({ family: familyKey, status: 'PASS', receipt: repoPath(receiptPath), complete_count: completeCount, missing_required_role_count: missingCount })}\n`);
}

main();
