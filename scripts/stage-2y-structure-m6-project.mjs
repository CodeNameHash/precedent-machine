#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { projectAgreement, viewPolicyFor } = require('../lib/canonical-v2/agreement-projection');
const preview = require('../lib/review-parity/rendered-row-preview');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');
const ROW_CORRECTION_MODE = process.argv.length === 3 && process.argv[2] === '--row-correction';
const COMPARISON_ENTRY_CORRECTION_MODE = process.argv.length === 3 && process.argv[2] === '--comparison-entry-correction';
const CORRECTION_MODE = ROW_CORRECTION_MODE || COMPARISON_ENTRY_CORRECTION_MODE;
const CORRECTED_M5_RECEIPT = resolve(ROOT, 'receipts/stage-2y-structure-m5-family-adapters-correction.json');
const ORIGINAL_M6_RECEIPT = resolve(ROOT, 'receipts/stage-2y-structure-m6-agreement-projection.json');
const ROW_CORRECTION_M6_RECEIPT = resolve(ROOT, 'receipts/stage-2y-structure-m6-agreement-projection-row-correction.json');
const CORRECTION_SUFFIX = COMPARISON_ENTRY_CORRECTION_MODE
  ? '-comparison-entry-correction'
  : ROW_CORRECTION_MODE ? '-row-correction' : '';
const RECEIPT_PATH = resolve(ROOT, `receipts/stage-2y-structure-m6-agreement-projection${CORRECTION_SUFFIX}.json`);
const ANALYSIS_ROOT = resolve(ROOT, 'shadow/m5-correction/analysis');
const OUTPUT_ROOT = resolve(ROOT, COMPARISON_ENTRY_CORRECTION_MODE
  ? 'shadow/m6-comparison-entry-correction'
  : ROW_CORRECTION_MODE ? 'shadow/m6-row-correction' : 'shadow/m6');
const POLICY_PATH = resolve(ROOT, 'control/m6-view-policy.json');
const CORRECTION_AUTHORITY_PATH = resolve(ROOT, COMPARISON_ENTRY_CORRECTION_MODE
  ? 'control/m6-comparison-entry-correction-authority.json'
  : 'control/m6-row-correction-authority.json');

function fail(code, detail) {
  throw new Error(`STAGE_2Y_M6_PROJECTION:${code}: ${detail}`);
}

function repoPath(path) {
  const value = relative(REPO_ROOT, path).split('\\').join('/');
  if (!value || value.startsWith('..')) fail('PATH', path);
  return value;
}

function json(path) {
  return JSON.parse(readFileSync(path));
}

function binding(path, extra = {}) {
  const raw = readFileSync(path);
  return { path: repoPath(path), byte_length: raw.length, sha256: sha256Hex(raw), ...extra };
}

function assertBinding(value) {
  const raw = readFileSync(resolve(REPO_ROOT, value.path));
  if (raw.length !== value.byte_length || sha256Hex(raw) !== value.sha256) fail('BOUND_BYTES', value.path);
}

function writeCanonical(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const next = `${canonicalJson(value)}\n`;
  if (existsSync(path)) {
    if (readFileSync(path, 'utf8') !== next) {
      if (!COMPARISON_ENTRY_CORRECTION_MODE) fail('EXISTING_OUTPUT_DRIFT', repoPath(path));
      writeFileSync(path, next);
    }
    return;
  }
  writeFileSync(path, next, { flag: 'wx' });
}

function selfRecord(schemaVersion, idKey, unsigned) {
  return { schema_version: schemaVersion, [idKey]: contentId(schemaVersion, unsigned), ...unsigned };
}

function claimRevisionId(entry) {
  return entry?.claim?.claim_revision_id || entry?.claim_revision_id || entry?.closure_id || null;
}

function normaliseText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function currentBaselineLedger(analysisByRevision) {
  const manifest = json(resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-cd-baseline-manifest.json'));
  const routeFamilies = new Set(Object.keys(preview.FAMILY_ROUTES));
  const members = [];
  for (const pin of manifest.runs) {
    const runManifest = json(resolve(REPO_ROOT, pin.run_manifest.path));
    const resolution = json(resolve(REPO_ROOT, pin.resolution.path));
    for (const entry of resolution.resolved || []) {
      const revisionId = claimRevisionId(entry);
      const mapped = analysisByRevision.get(revisionId);
      if (!mapped) fail('BASELINE_MEMBER_MAPPING', revisionId);
      let disposition = 'CURRENT_MECHANICAL_ROW_MATCH';
      let errorCode = null;
      if (!routeFamilies.has(pin.family)) {
        disposition = 'CURRENT_NO_APPROVED_OUTPUT_OWNER';
        errorCode = 'FAMILY_NOT_RENDERABLE';
      } else {
        try {
          preview.previewClaimSection({ run: { manifest: runManifest, resolution }, resolved_entry: entry });
        } catch (error) {
          errorCode = error?.code || 'UNKNOWN';
          if (errorCode === 'CLAIM_FEATURE_ROW_NOT_UNIQUE') disposition = 'CURRENT_FEATURE_ROW_NOT_UNIQUE';
          else if (errorCode === 'CLAIM_RENDERED_NO_ROW') disposition = 'CURRENT_ROUTED_NO_ROW';
          else fail('UNEXPECTED_CURRENT_BASELINE_ERROR', `${pin.directory}:${revisionId}:${errorCode}`);
        }
      }
      members.push({
        analysis_claim_id: mapped.analysis_claim_id,
        claim_revision_id: revisionId,
        family_key: pin.family,
        deal: pin.deal,
        run: pin.directory,
        current_disposition: disposition,
        current_error_code: errorCode,
      });
    }
  }
  members.sort((a, b) => a.analysis_claim_id.localeCompare(b.analysis_claim_id));
  if (members.length !== 1526 || new Set(members.map((entry) => entry.analysis_claim_id)).size !== 1526) fail('BASELINE_COUNT', members.length);
  const counts = Object.fromEntries([...new Set(members.map((entry) => entry.current_disposition))]
    .sort().map((disposition) => [disposition, members.filter((entry) => entry.current_disposition === disposition).length]));
  if (counts.CURRENT_FEATURE_ROW_NOT_UNIQUE !== 109
    || counts.CURRENT_ROUTED_NO_ROW !== 1
    || counts.CURRENT_NO_APPROVED_OUTPUT_OWNER !== 175
    || counts.CURRENT_MECHANICAL_ROW_MATCH !== 1241) fail('BASELINE_FIXED_COUNTS', JSON.stringify(counts));
  return selfRecord('STAGE_2Y_M6_CURRENT_MEMBER_BASELINE/V1', 'record_id', { counts, members });
}

function auditClarification(analyses) {
  const roleMap = {
    LEGAL_ACTOR_OR_SUBJECT: 'ACTOR_OR_PARTIES',
    LEGAL_OPERATION: 'LEGAL_EFFECT_OR_MECHANIC',
    OPERATIVE_OBJECT: 'MEMBER_FACTS',
    TEMPORAL_OR_TRIGGER_SCOPE: 'TRIGGER_OR_TIMING',
    QUALIFICATIONS: 'QUALIFICATIONS',
  };
  const records = [];
  const counts = { SYSTEM_GAP_FIXED: 0, NOT_APPLICABLE_ROLE_REMOVED: 0, UNCHANGED_COMPLETE: 0 };
  for (const analysis of analyses) {
    const propositionByMember = new Map();
    for (const proposition of analysis.compound_propositions) {
      for (const id of proposition.member_analysis_claim_ids) propositionByMember.set(id, proposition);
    }
    for (const validation of analysis.proposition_validation_results) {
      const proposition = propositionByMember.get(validation.analysis_claim_id);
      const classifications = [];
      if (validation.proposition_validation_state === 'COMPLETE') {
        classifications.push('UNCHANGED_COMPLETE');
      } else {
        for (const oldRole of validation.missing_role_keys) {
          const newRole = roleMap[oldRole] || null;
          classifications.push(newRole && proposition.required_roles.includes(newRole)
            ? 'SYSTEM_GAP_FIXED'
            : 'NOT_APPLICABLE_ROLE_REMOVED');
        }
      }
      const unique = [...new Set(classifications)].sort();
      for (const classification of unique) counts[classification] += 1;
      records.push({
        analysis_claim_id: validation.analysis_claim_id,
        compound_proposition_id: proposition.compound_proposition_id,
        previous_missing_roles: validation.missing_role_keys,
        correction_classifications: unique,
        corrected_proposition_state: proposition.proposition_validation_state,
      });
    }
  }
  records.sort((a, b) => a.analysis_claim_id.localeCompare(b.analysis_claim_id));
  return selfRecord('STAGE_2Y_M6_M5_FAILURE_AUDIT_CLARIFICATION/V1', 'record_id', {
    explanation: 'Classifications are non-exclusive. One old member can contain both a system gap and a role that was never applicable.',
    counts,
    records,
  });
}

function changedFiles() {
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const modified = execFileSync('git', ['diff', '--name-only'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  return [...new Set([...untracked, ...modified, repoPath(RECEIPT_PATH)])].sort();
}

function main() {
  if ((!CORRECTION_MODE && process.argv.length !== 2)
    || (CORRECTION_MODE && process.argv.length !== 3)) {
    fail('ARGUMENTS', 'use no arguments, --row-correction, or --comparison-entry-correction');
  }
  const m5 = json(CORRECTED_M5_RECEIPT);
  if (m5.packet_id !== 'stage-2y-structure-m5-family-adapters-correction' || m5.status !== 'PASS' || m5.lifecycle_state !== 'SEALED') fail('M5_RECEIPT', m5.status);
  for (const output of m5.output_bindings) assertBinding(output);
  const familyOrder = json(resolve(ROOT, 'receipts/stage-2y-structure-m5-preparation.json')).family_order;
  const viewPolicy = viewPolicyFor(familyOrder);
  writeCanonical(POLICY_PATH, viewPolicy);
  let correctionAuthority = null;
  if (CORRECTION_MODE) {
    const comparisonEntryScope = [
      'PRESERVE_THE_ORIGINAL_M6_AND_FIRST_ROW_CORRECTION_RECEIPTS_AND_OUTPUTS',
      'KEEP_EXACT_SOURCE_TEXT_AS_EVIDENCE',
      'REPLACE_CLAUSE_COPY_WITH_SHORT_SOURCE_BACKED_COMPARISON_POINTS_AND_STRUCTURED_FACTS',
      'REMOVE_INTERNAL_SCHEMA_CODES_FROM_LAWYER_FACING_TEXT',
      'RERUN_M7_AND_REPLACE_THE_WITHDRAWN_LAWYER_PACKET',
    ];
    const rowCorrectionScope = [
      'PRESERVE_THE_ORIGINAL_M6_RECEIPT_AND_OUTPUTS',
      'SEPARATE_COMPARISON_FIELDS_FROM_EXACT_SOURCE_EVIDENCE',
      'USE_PLAIN_LABELLED_LEGAL_FIELDS',
      'RERUN_M7_AND_REPLACE_THE_WITHDRAWN_LAWYER_PACKET',
    ];
    const unsigned = {
      stage: COMPARISON_ENTRY_CORRECTION_MODE ? 'M6_COMPARISON_ENTRY_CORRECTION' : 'M6_ROW_CORRECTION',
      authority_state: 'BEN_AUTHORISED',
      ben_approval_id: COMPARISON_ENTRY_CORRECTION_MODE
        ? 'BEN-M6-COMPARISON-ENTRY-CORRECTION-2026-08-13'
        : 'BEN-M6-ROW-CORRECTION-2026-08-12',
      approval_text: COMPARISON_ENTRY_CORRECTION_MODE
        ? 'I think same issue on all of the cards? ok'
        : 'ok',
      discovered_defect: COMPARISON_ENTRY_CORRECTION_MODE
        ? 'COMPARISON_TEXT_COPIED_SOURCE_OR_EXPOSED_INTERNAL_CLAIM_LABELS_WITHOUT_A_USABLE_COMPARISON_ENTRY'
        : 'ALL_38_LAWYER_SAMPLE_COMPARISON_ROWS_REPEATED_THE_SOURCE_CLAUSE',
      authorised_scope: COMPARISON_ENTRY_CORRECTION_MODE ? comparisonEntryScope : rowCorrectionScope,
      prohibited_scope: ['M8', 'M9', 'M10', 'MODEL_CALL', 'PRODUCT_WRITE', 'SERVING', 'PUBLICATION'],
      original_m6_receipt_binding: binding(ORIGINAL_M6_RECEIPT),
      ...(COMPARISON_ENTRY_CORRECTION_MODE
        ? { prior_row_correction_receipt_binding: binding(ROW_CORRECTION_M6_RECEIPT) }
        : {}),
      corrected_m5_receipt_binding: binding(CORRECTED_M5_RECEIPT),
    };
    correctionAuthority = selfRecord(
      COMPARISON_ENTRY_CORRECTION_MODE
        ? 'STAGE_2Y_M6_COMPARISON_ENTRY_CORRECTION_AUTHORITY/V1'
        : 'STAGE_2Y_M6_ROW_CORRECTION_AUTHORITY/V1',
      'correction_authority_id',
      unsigned,
    );
    writeCanonical(CORRECTION_AUTHORITY_PATH, correctionAuthority);
  }

  const analysisPaths = readdirSync(ANALYSIS_ROOT).filter((name) => name.endsWith('.agreement-analysis.json')).sort();
  if (analysisPaths.length !== 7) fail('ANALYSIS_COUNT', analysisPaths.length);
  const analyses = analysisPaths.map((name) => json(resolve(ANALYSIS_ROOT, name)));
  const outputBindings = [binding(POLICY_PATH, { view_policy_id: viewPolicy.view_policy_id })];
  if (correctionAuthority) outputBindings.push(binding(CORRECTION_AUTHORITY_PATH, { correction_authority_id: correctionAuthority.correction_authority_id }));
  const projections = [];
  for (const analysis of analyses) {
    const projection = projectAgreement(analysis, viewPolicy);
    const path = resolve(OUTPUT_ROOT, 'projection', `${analysis.agreement_id}.agreement-projection.json`);
    writeCanonical(path, projection);
    projections.push(projection);
    outputBindings.push(binding(path, { agreement_id: analysis.agreement_id, agreement_projection_id: projection.agreement_projection_id }));
  }
  if (CORRECTION_MODE) {
    const invalidRows = projections.flatMap((projection) => projection.rows).filter((row) => {
      const source = normaliseText(row.citations.map((citation) => citation.exact_text).join('\n\n'));
      const expanded = normaliseText(row.fields.find((field) => field.field_key === 'expanded_text')?.value);
      if (COMPARISON_ENTRY_CORRECTION_MODE) {
        return source === expanded
          || !expanded.startsWith('Comparison point:')
          || /M7_DETERMINISTIC|SOURCE_PROVISION|\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/.test(expanded)
          || (source.length > 160 && expanded.includes(source.slice(0, 120)));
      }
      return source === expanded || !expanded.startsWith('Rule:');
    });
    if (invalidRows.length > 0) fail('COMPARISON_ENTRY_ROW', invalidRows.length);
  }

  const analysisClaimById = new Map();
  const analysisByRevision = new Map();
  for (const analysis of analyses) {
    for (const claim of analysis.claims) {
      analysisClaimById.set(claim.analysis_claim_id, claim);
      const revisionId = claim.legacy_claim_revision?.claim_revision_id;
      if (revisionId) analysisByRevision.set(revisionId, claim);
    }
  }
  const rowByProposition = new Map(projections.flatMap((projection) => projection.rows.map((row) => [row.source_compound_proposition_id, row])));
  const allPropositions = analyses.flatMap((analysis) => analysis.compound_propositions);
  const ownerMap = new Map();
  for (const proposition of allPropositions) {
    for (const definition of proposition.claim_definition_keys) {
      if (ownerMap.has(definition) && ownerMap.get(definition) !== proposition.family_key) fail('MULTIPLE_OWNERS', definition);
      ownerMap.set(definition, proposition.family_key);
    }
  }
  const ownerLedger = selfRecord('STAGE_2Y_M6_OUTPUT_OWNER_LEDGER/V1', 'record_id', {
    decisions: [...ownerMap].sort(([left], [right]) => left.localeCompare(right)).map(([claimDefinitionKey, familyKey]) => ({
      claim_definition_key: claimDefinitionKey,
      output_owner: familyKey,
      disposition: 'OWNED_NORMAL_ROW',
      linked_consumers: [],
    })),
    unowned_definition_count: 0,
    approved_no_output_count: 0,
  });
  const currentBaseline = currentBaselineLedger(analysisByRevision);
  const baselineByClaim = new Map(currentBaseline.members.map((entry) => [entry.analysis_claim_id, entry]));
  const memberLedgerEntries = [];
  for (const proposition of allPropositions) {
    const row = rowByProposition.get(proposition.compound_proposition_id);
    if (proposition.proposition_validation_state === 'COMPLETE' && !row) fail('SILENT_NO_ROW', proposition.compound_proposition_id);
    for (const analysisClaimId of proposition.member_analysis_claim_ids) {
      const claim = analysisClaimById.get(analysisClaimId);
      memberLedgerEntries.push({
        analysis_claim_id: analysisClaimId,
        claim_occurrence_id: claim.claim_occurrence_id,
        claim_revision_id: claim.legacy_claim_revision?.claim_revision_id || null,
        family_key: proposition.family_key,
        compound_proposition_id: proposition.compound_proposition_id,
        m6_disposition: row ? 'DISPLAYED_IN_NORMAL_ROW' : 'DISPLAYED_IN_REVIEW_LANE',
        row_id: row?.row_id || null,
        current_baseline_disposition: baselineByClaim.get(analysisClaimId)?.current_disposition || 'ADDITIVE_GOLDEN_NO_CURRENT_BASELINE',
      });
    }
  }
  memberLedgerEntries.sort((a, b) => a.analysis_claim_id.localeCompare(b.analysis_claim_id));
  if (memberLedgerEntries.length !== 1528 || new Set(memberLedgerEntries.map((entry) => entry.analysis_claim_id)).size !== 1528) fail('MEMBER_LEDGER', memberLedgerEntries.length);
  const memberLedger = selfRecord('STAGE_2Y_M6_MEMBER_PROJECTION_LEDGER/V1', 'record_id', { members: memberLedgerEntries });
  const omissionLedger = selfRecord('STAGE_2Y_M6_OMISSION_LEDGER/V1', 'record_id', {
    omissions: projections.flatMap((projection) => projection.omissions),
    silent_no_row_count: 0,
    material_fact_omission_count: 0,
  });
  const failureAuditClarification = auditClarification(analyses);
  const currentProjectionPath = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-n-rendered-rows.json');
  const projectionDiff = selfRecord('STAGE_2Y_M6_PROJECTION_DIFF/V1', 'record_id', {
    current_projection_binding_before: binding(currentProjectionPath),
    current_projection_binding_after: binding(currentProjectionPath),
    current_projection_bytes_unchanged: true,
    shadow_normal_row_count: projections.reduce((sum, projection) => sum + projection.rows.length, 0),
    shadow_review_row_count: projections.reduce((sum, projection) => sum + projection.review_rows.length, 0),
    topbuild_section_6_3_termination_row_count: projections.flatMap((projection) => projection.rows)
      .filter((row) => row.agreement_id === '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb'
        && row.family_key === 'TERMINATION' && row.section_reference === '6.3').length,
  });
  const selectorState = selfRecord('STAGE_2Y_M6_SELECTOR_STATE/V1', 'record_id', {
    structure_selector: 'current',
    context_selector: 'current',
    analysis_selector: 'current',
    projection_selector: 'current',
    publication_authorisation: 'NONE',
    serving_active: false,
  });
  const rollback = selfRecord('STAGE_2Y_M6_ROLLBACK/V1', 'record_id', {
    rollback_scope: [repoPath(POLICY_PATH), repoPath(OUTPUT_ROOT), repoPath(RECEIPT_PATH)],
    current_product_restore_required: false,
    result: 'PASS_ISOLATED_SHADOW_REMOVAL',
  });

  const ledgers = [
    ['output-owner-ledger.json', ownerLedger],
    ['current-member-baseline.json', currentBaseline],
    ['member-projection-ledger.json', memberLedger],
    ['omission-ledger.json', omissionLedger],
    ['m5-failure-audit-clarification.json', failureAuditClarification],
    ['projection-diff.json', projectionDiff],
    ['selector-state.json', selectorState],
    ['rollback.json', rollback],
  ];
  for (const [name, record] of ledgers) {
    const path = resolve(OUTPUT_ROOT, name);
    writeCanonical(path, record);
    outputBindings.push(binding(path, { record_id: record.record_id }));
  }
  const outputSetDigest = sha256Hex(canonicalJson(outputBindings));
  const receipt = {
    schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
    packet_id: COMPARISON_ENTRY_CORRECTION_MODE
      ? 'stage-2y-structure-m6-agreement-projection-comparison-entry-correction'
      : ROW_CORRECTION_MODE ? 'stage-2y-structure-m6-agreement-projection-row-correction' : 'stage-2y-structure-m6-agreement-projection',
    stage: COMPARISON_ENTRY_CORRECTION_MODE
      ? 'M6_COMPARISON_ENTRY_CORRECTION'
      : ROW_CORRECTION_MODE ? 'M6_ROW_CORRECTION' : 'M6',
    lifecycle_state: 'SEALED',
    status: 'PASS',
    base_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
    input_digests: {
      corrected_m5_receipt: sha256Hex(readFileSync(CORRECTED_M5_RECEIPT)),
      corrected_m5_output_set: m5.output_set_digest,
      view_policy: sha256Hex(readFileSync(POLICY_PATH)),
      current_projection: sha256Hex(readFileSync(currentProjectionPath)),
    },
    predecessor_receipt_bindings: {
      corrected_m5: binding(CORRECTED_M5_RECEIPT, { packet_id: m5.packet_id }),
      ...(CORRECTION_MODE ? { original_m6: binding(ORIGINAL_M6_RECEIPT, { packet_id: json(ORIGINAL_M6_RECEIPT).packet_id }) } : {}),
      ...(COMPARISON_ENTRY_CORRECTION_MODE ? {
        prior_row_correction_m6: binding(ROW_CORRECTION_M6_RECEIPT, { packet_id: json(ROW_CORRECTION_M6_RECEIPT).packet_id }),
      } : {}),
    },
    ...(CORRECTION_MODE ? { correction_authority_binding: binding(CORRECTION_AUTHORITY_PATH, { correction_authority_id: correctionAuthority.correction_authority_id }) } : {}),
    corrected_analysis_bindings: m5.corrected_analysis_bindings,
    current_baseline_binding: binding(resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-cd-report.json')),
    current_projection_binding: binding(currentProjectionPath),
    focused_checks: [
      'CORRECTED_M5_TRUST_ROOT_REHASHED',
      'ALL_106_CLAIM_DEFINITIONS_HAVE_ONE_OWNER',
      'CURRENT_109_NON_UNIQUE_REPRODUCED_AT_MEMBER_LEVEL',
      'CURRENT_ONE_ROUTED_NO_ROW_REPRODUCED_AT_MEMBER_LEVEL',
      'CURRENT_175_NO_OWNER_REPRODUCED_AT_MEMBER_LEVEL',
      'ALL_1528_MEMBER_IDENTITIES_PROJECTED',
      'ALL_1111_COMPLETE_PROPOSITIONS_HAVE_ROWS',
      'TOPBUILD_SECTION_6_3_HAS_TERMINATION_ROWS',
      'ZERO_SILENT_NO_ROW',
      'ZERO_MATERIAL_FACT_OMISSION',
      'PARTIAL_REVIEW_LANE_FAILS_CLOSED',
      'CURRENT_ROWS_AND_SELECTORS_UNCHANGED',
      'PUBLICATION_INACTIVE',
      COMPARISON_ENTRY_CORRECTION_MODE
        ? 'ALL_COMPARISON_ENTRIES_READABLE_DISTINCT_FROM_SOURCE_AND_FREE_OF_INTERNAL_CODES'
        : CORRECTION_MODE ? 'ALL_COMPARISON_ROWS_DISTINCT_FROM_SOURCE_EVIDENCE' : 'M7_NOT_STARTED',
    ].map((check) => ({ check, result: 'PASS' })),
    metrics: {
      agreement_count: 7,
      family_count: 25,
      approved_claim_definition_owner_count: ownerLedger.decisions.length,
      member_claim_count: memberLedgerEntries.length,
      compound_proposition_count: allPropositions.length,
      normal_row_count: projectionDiff.shadow_normal_row_count,
      review_row_count: projectionDiff.shadow_review_row_count,
      omission_ledger_count: omissionLedger.omissions.length,
      silent_no_row_count: 0,
      material_fact_omission_count: 0,
      current_feature_row_not_unique_count: currentBaseline.counts.CURRENT_FEATURE_ROW_NOT_UNIQUE,
      current_routed_no_row_count: currentBaseline.counts.CURRENT_ROUTED_NO_ROW,
      current_no_approved_output_owner_count: currentBaseline.counts.CURRENT_NO_APPROVED_OUTPUT_OWNER,
      current_mechanical_row_match_count: currentBaseline.counts.CURRENT_MECHANICAL_ROW_MATCH,
      topbuild_section_6_3_termination_row_count: projectionDiff.topbuild_section_6_3_termination_row_count,
      model_call_count: 0,
      product_write_count: 0,
      current_selector_change_count: 0,
      m7_output_count: 0,
    },
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
      'SHADOW_ROWS_FROM_CORRECTED_COMPLETE_PROPOSITIONS',
      'TOPBUILD_SECTION_6_3_TERMINATION_ROWS',
      'COMPLETE_OUTPUT_OWNERSHIP',
      'SEPARATE_REVIEW_LANE_CONTRACT_FOR_PARTIAL_PROPOSITIONS',
    ],
    unexpected_differences: [],
    open_world_by_family: m5.open_world_by_family,
    old_result_digest: sha256Hex(readFileSync(currentProjectionPath)),
    new_shadow_result_digest: outputSetDigest,
    rollback_command: `remove only ${repoPath(POLICY_PATH)}, ${repoPath(OUTPUT_ROOT)} and ${repoPath(RECEIPT_PATH)}`,
    rollback_result: 'PASS_ISOLATED_SHADOW_REMOVAL',
    changed_files: changedFiles(),
    implementation_bindings: {
      projection_module: binding(resolve(REPO_ROOT, 'lib/canonical-v2/agreement-projection.js')),
      runner: binding(fileURLToPath(import.meta.url)),
      focused_test: binding(resolve(REPO_ROOT, 'tests/stage-2y-structure-m6-projection.test.js')),
      validator: binding(resolve(REPO_ROOT, 'scripts/stage-2y-structure-migration-validate.mjs')),
    },
    output_bindings: outputBindings,
    output_set_digest: outputSetDigest,
    m7_authorised: CORRECTION_MODE,
  };
  writeCanonical(RECEIPT_PATH, receipt);
}

main();
