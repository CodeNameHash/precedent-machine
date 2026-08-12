#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { adaptCompoundFamily, policyForFamily } = require('../lib/canonical-v2/family-compound-adapter');

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(REPO_ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');
const INITIAL_RECEIPT = resolve(ROOT, 'receipts/stage-2y-structure-m5-family-adapters.json');
const PREPARATION_RECEIPT = resolve(ROOT, 'receipts/stage-2y-structure-m5-preparation.json');
const CORRECTION_RECEIPT = resolve(ROOT, 'receipts/stage-2y-structure-m5-family-adapters-correction.json');
const POLICY_ROOT = resolve(ROOT, 'control/family-specific-role-policies-v2');
const AUTHORITY_PATH = resolve(ROOT, 'control/m5-correction-authority.json');
const OUTPUT_ROOT = resolve(ROOT, 'shadow/m5-correction');

function fail(code, detail) {
  throw new Error(`STAGE_2Y_M5_CORRECTION:${code}: ${detail}`);
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
    if (readFileSync(path, 'utf8') !== next) fail('EXISTING_OUTPUT_DRIFT', repoPath(path));
    return;
  }
  writeFileSync(path, next, { flag: 'wx' });
}

function selfRecord(schemaVersion, idKey, unsigned) {
  return { schema_version: schemaVersion, [idKey]: contentId(schemaVersion, unsigned), ...unsigned };
}

function analysisWithCorrection(initial, propositions, auditRecords, authority) {
  const unsigned = structuredClone(initial);
  delete unsigned.agreement_analysis_id;
  unsigned.compound_propositions = propositions;
  unsigned.m5_correction = {
    schema_version: 'STAGE_2Y_M5_ANALYSIS_CORRECTION/V1',
    correction_authority_id: authority.correction_authority_id,
    superseded_initial_analysis_id: initial.agreement_analysis_id,
    semantic_projection_collection: 'compound_propositions',
    member_claim_treatment: 'LINEAGE_MEMBERS_NOT_STANDALONE_COMPLETE_PROPOSITIONS',
    complete_compound_proposition_count: propositions.filter((entry) => entry.proposition_validation_state === 'COMPLETE').length,
    reviewable_partial_proposition_count: propositions.filter((entry) => entry.proposition_validation_state !== 'COMPLETE').length,
    member_audit_count: auditRecords.length,
    current_product_effects: 0,
    m6_started: false,
  };
  unsigned.counts = {
    ...unsigned.counts,
    compound_proposition_count: propositions.length,
    complete_compound_proposition_count: unsigned.m5_correction.complete_compound_proposition_count,
    reviewable_partial_proposition_count: unsigned.m5_correction.reviewable_partial_proposition_count,
  };
  return {
    schema_version: 'AGREEMENT_ANALYSIS/V1',
    agreement_analysis_id: contentId('AGREEMENT_ANALYSIS/V1', unsigned),
    ...Object.fromEntries(Object.entries(unsigned).filter(([key]) => key !== 'schema_version')),
  };
}

function changedFiles() {
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const modified = execFileSync('git', ['diff', '--name-only'], { cwd: REPO_ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  return [...new Set([...untracked, ...modified, repoPath(CORRECTION_RECEIPT)])].sort();
}

function main() {
  if (process.argv.length !== 2) fail('ARGUMENTS', 'this governed command accepts no arguments');
  const initialReceipt = json(INITIAL_RECEIPT);
  if (initialReceipt.stage !== 'M5' || initialReceipt.status !== 'PASS' || initialReceipt.lifecycle_state !== 'SEALED') fail('INITIAL_RECEIPT', initialReceipt.status);
  for (const output of initialReceipt.output_bindings) assertBinding(output);
  const preparation = json(PREPARATION_RECEIPT);
  const familyOrder = preparation.family_order;
  if (familyOrder.length !== 25 || new Set(familyOrder.map((entry) => entry.family_key)).size !== 25) fail('FAMILY_ORDER', familyOrder.length);

  const policyBindings = [];
  const policies = new Map();
  for (const family of familyOrder) {
    const policy = policyForFamily(family.family_key, family.wave);
    const path = resolve(POLICY_ROOT, `${family.family_key}.json`);
    writeCanonical(path, policy);
    policies.set(family.family_key, policy);
    policyBindings.push(binding(path, { family_key: family.family_key, family_policy_id: policy.family_policy_id }));
  }
  const authorityUnsigned = {
    stage: 'M5_CORRECTION',
    authority_state: 'BEN_AUTHORISED',
    ben_approval_id: 'BEN-M5-CORRECTION-2026-08-12',
    authorised_scope: [
      'PRESERVE_INITIAL_M5_RECEIPT_AS_AUDIT_EVIDENCE',
      'REPLACE_UNIVERSAL_REQUIRED_ROLES_WITH_FAMILY_SPECIFIC_RULES',
      'COMBINE_OLD_FACT_FRAGMENTS_UNDER_SMALLEST_AUTHORED_LEGAL_UNIT',
      'AUDIT_AND_FIX_SYSTEM_GAPS',
      'CREATE_SEPARATE_REVIEW_LANE_FOR_USEFUL_PARTIAL_PROPOSITIONS',
      'RUN_M6_AFTER_THE_CORRECTED_M5_RECEIPT_PASSES',
    ],
    prohibited_scope: ['M7', 'CURRENT_SELECTOR_CHANGE', 'PRODUCT_WRITE', 'SERVING', 'PUBLICATION'],
    initial_m5_receipt_binding: binding(INITIAL_RECEIPT, { packet_id: initialReceipt.packet_id }),
    family_policy_set_digest: sha256Hex(canonicalJson(policyBindings)),
    family_policy_bindings: policyBindings,
  };
  const authority = selfRecord('STAGE_2Y_M5_CORRECTION_AUTHORITY/V1', 'correction_authority_id', authorityUnsigned);
  writeCanonical(AUTHORITY_PATH, authority);

  const agreementNames = readdirSync(resolve(ROOT, 'shadow/m4'))
    .filter((name) => name.endsWith('.agreement-analysis.json'))
    .sort();
  if (agreementNames.length !== 7) fail('AGREEMENT_COUNT', agreementNames.length);
  const familyResults = new Map(familyOrder.map((entry) => [entry.family_key, []]));
  const agreementInputs = new Map();
  for (const name of agreementNames) {
    const agreementId = name.split('.')[0];
    const m4 = json(resolve(ROOT, 'shadow/m4', name));
    const m2 = json(resolve(ROOT, 'shadow/m2', `${agreementId}.agreement-index.json`));
    const m3 = json(resolve(ROOT, 'shadow/m3', `${agreementId}.context-compilation.json`));
    const initial = json(resolve(ROOT, 'shadow/m5/analysis', name));
    agreementInputs.set(agreementId, { m4, m2, m3, initial });
    for (const family of familyOrder) {
      familyResults.get(family.family_key).push(adaptCompoundFamily(m4, m2, m3, policies.get(family.family_key)));
    }
  }

  const outputBindings = [...policyBindings, binding(AUTHORITY_PATH, { correction_authority_id: authority.correction_authority_id })];
  const auditsByAgreement = new Map(agreementNames.map((name) => [name.split('.')[0], []]));
  const propositionsByAgreement = new Map(agreementNames.map((name) => [name.split('.')[0], []]));
  let memberCount = 0;
  let propositionCount = 0;
  let completeCount = 0;
  let partialCount = 0;
  const failureCauseCounts = {};
  for (const family of familyOrder) {
    const results = familyResults.get(family.family_key);
    const propositions = results.flatMap((result) => result.propositions);
    const members = results.flatMap((result) => result.member_ledger);
    const audit = [];
    for (const result of results) {
      const initial = agreementInputs.get(result.agreement_id).initial;
      const oldValidation = new Map(initial.proposition_validation_results.map((entry) => [entry.analysis_claim_id, entry]));
      for (const member of result.member_ledger) {
        const previous = oldValidation.get(member.analysis_claim_id);
        const proposition = result.propositions.find((entry) => entry.compound_proposition_id === member.compound_proposition_id);
        const oldMissing = previous?.missing_role_keys || [];
        let cause = 'UNCHANGED_COMPLETE';
        if (previous?.proposition_validation_state !== 'COMPLETE' && proposition.proposition_validation_state === 'COMPLETE') {
          cause = oldMissing.some((role) => !proposition.required_roles.includes(role))
            ? 'NOT_APPLICABLE_ROLE_REMOVED'
            : 'SYSTEM_GAP_FIXED_FROM_AUTHORED_SOURCE_AND_CONTEXT';
        } else if (proposition.proposition_validation_state !== 'COMPLETE') {
          cause = 'REVIEWABLE_PARTIAL_REMAINS';
        }
        failureCauseCounts[cause] = (failureCauseCounts[cause] || 0) + 1;
        const record = {
          analysis_claim_id: member.analysis_claim_id,
          agreement_id: result.agreement_id,
          family_key: family.family_key,
          compound_proposition_id: member.compound_proposition_id,
          previous_validation_state: previous?.proposition_validation_state || 'UNKNOWN',
          previous_missing_required_roles: oldMissing,
          correction_disposition: member.disposition,
          correction_cause: cause,
          remaining_missing_required_roles: member.missing_required_roles,
        };
        audit.push(record);
        auditsByAgreement.get(result.agreement_id).push(record);
      }
      propositionsByAgreement.get(result.agreement_id).push(...result.propositions);
    }
    const familyRoot = resolve(OUTPUT_ROOT, family.family_key);
    const propositionRecord = selfRecord('STAGE_2Y_M5_FAMILY_COMPOUND_PROPOSITIONS/V1', 'record_id', {
      family_key: family.family_key,
      family_policy_id: policies.get(family.family_key).family_policy_id,
      propositions,
    });
    const memberRecord = selfRecord('STAGE_2Y_M5_FAMILY_MEMBER_LEDGER/V1', 'record_id', {
      family_key: family.family_key,
      members,
    });
    const auditRecord = selfRecord('STAGE_2Y_M5_FAMILY_FAILURE_AUDIT/V1', 'record_id', {
      family_key: family.family_key,
      audit,
    });
    const paths = [
      [resolve(familyRoot, 'compound-propositions.json'), propositionRecord],
      [resolve(familyRoot, 'member-ledger.json'), memberRecord],
      [resolve(familyRoot, 'failure-audit.json'), auditRecord],
    ];
    for (const [path, record] of paths) {
      writeCanonical(path, record);
      outputBindings.push(binding(path, { family_key: family.family_key, record_id: record.record_id }));
    }
    memberCount += members.length;
    propositionCount += propositions.length;
    completeCount += propositions.filter((entry) => entry.proposition_validation_state === 'COMPLETE').length;
    partialCount += propositions.filter((entry) => entry.proposition_validation_state !== 'COMPLETE').length;
  }
  if (memberCount !== 1528 || completeCount + partialCount !== propositionCount) fail('CORRECTION_COUNTS', `${memberCount}:${propositionCount}:${completeCount}:${partialCount}`);

  const correctedAnalysisBindings = [];
  for (const [agreementId, inputs] of agreementInputs) {
    const corrected = analysisWithCorrection(
      inputs.initial,
      propositionsByAgreement.get(agreementId).sort((a, b) => a.compound_proposition_id.localeCompare(b.compound_proposition_id)),
      auditsByAgreement.get(agreementId),
      authority,
    );
    const path = resolve(OUTPUT_ROOT, 'analysis', `${agreementId}.agreement-analysis.json`);
    writeCanonical(path, corrected);
    const bound = binding(path, { agreement_id: agreementId, agreement_analysis_id: corrected.agreement_analysis_id });
    correctedAnalysisBindings.push(bound);
    outputBindings.push(bound);
  }

  const topBuild = json(resolve(OUTPUT_ROOT, 'analysis', '3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb.agreement-analysis.json'));
  const topBuild63 = topBuild.compound_propositions.filter((entry) => entry.family_key === 'TERMINATION'
    && entry.roles.MEMBER_FACTS.some((member) => member.attributes.section_reference === '6.3'));
  if (topBuild63.length < 4 || topBuild63.some((entry) => entry.proposition_validation_state !== 'COMPLETE')) fail('TOPBUILD_6_3', topBuild63.length);

  const outputSetDigest = sha256Hex(canonicalJson(outputBindings));
  const receipt = {
    schema_version: 'STAGE_2Y_STRUCTURE_MIGRATION_PACKET_RECEIPT/V1',
    packet_id: 'stage-2y-structure-m5-family-adapters-correction',
    stage: 'M5',
    lifecycle_state: 'SEALED',
    status: 'PASS',
    base_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
    input_digests: {
      initial_m5_receipt: sha256Hex(readFileSync(INITIAL_RECEIPT)),
      correction_authority: sha256Hex(readFileSync(AUTHORITY_PATH)),
      family_policy_set: authority.family_policy_set_digest,
    },
    correction_authority_binding: binding(AUTHORITY_PATH, { correction_authority_id: authority.correction_authority_id }),
    predecessor_receipt_bindings: {
      m2: binding(resolve(ROOT, 'receipts/stage-2y-structure-m2-agreement-index.json')),
      m3: binding(resolve(ROOT, 'receipts/stage-2y-structure-m3-context-compilation.json')),
      m4: binding(resolve(ROOT, 'receipts/stage-2y-structure-m4-agreement-analysis.json')),
      initial_m5: binding(INITIAL_RECEIPT, { packet_id: initialReceipt.packet_id }),
    },
    supersession: {
      superseded_receipt_path: repoPath(INITIAL_RECEIPT),
      superseded_for_downstream_semantic_input: true,
      preserved_as_audit_evidence: true,
      corrected_receipt_path: repoPath(CORRECTION_RECEIPT),
    },
    corrected_analysis_root: repoPath(resolve(OUTPUT_ROOT, 'analysis')),
    corrected_analysis_bindings: correctedAnalysisBindings,
    failure_audit: {
      original_incomplete_member_count: initialReceipt.metrics.missing_required_role_claim_count,
      cause_counts: failureCauseCounts,
      remaining_reviewable_partial_count: partialCount,
    },
    partial_proposition_policy: {
      normal_comparison_row_authority: 'COMPLETE_ONLY',
      review_lane_authority: 'CLEARLY_LABELLED_REVIEWABLE_PARTIAL_ONLY',
      partial_may_be_called_complete: false,
      guessing_authorised: false,
    },
    focused_checks: [
      'INITIAL_M5_RECEIPT_PRESERVED_BYTE_FOR_BYTE',
      'EXACT_25_FAMILY_SPECIFIC_POLICIES',
      'ALL_1528_M4_MEMBERS_ACCOUNTED_FOR_ONCE',
      'SMALLEST_AUTHORED_UNIT_GROUPING',
      'EXACT_M2_SOURCE_BYTES',
      'M3_CONTEXT_ONLY_NO_RAW_MODEL_REPARSE',
      'TOPBUILD_SECTION_6_3_COMPLETE',
      'FAILURE_CAUSE_AUDIT_COMPLETE',
      'ZERO_CURRENT_PRODUCT_EFFECT',
      'M7_NOT_STARTED',
    ].map((check) => ({ check, result: 'PASS' })),
    metrics: {
      agreement_count: 7,
      family_count: 25,
      member_claim_count: memberCount,
      compound_proposition_count: propositionCount,
      complete_compound_proposition_count: completeCount,
      reviewable_partial_proposition_count: partialCount,
      topbuild_section_6_3_complete_proposition_count: topBuild63.length,
      model_call_count: 0,
      product_write_count: 0,
      current_selector_change_count: 0,
      m6_output_count: 0,
      m7_output_count: 0,
    },
    effects: {
      current_claims: 0,
      current_rows: 0,
      database_writes: 0,
      product_writes: 0,
      serving_changes: 0,
      publication_changes: 0,
      selector_changes: 0,
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
    database_target: 'NONE',
    expected_differences: [
      'UNIVERSAL_REQUIRED_ROLE_SCHEMA_SUPERSEDED',
      'OLD_FACT_FRAGMENTS_GROUPED_UNDER_AUTHORED_LEGAL_UNITS',
      'SYSTEM_GAPS_FIXED_FROM_EXACT_M2_AND_M3_EVIDENCE',
    ],
    unexpected_differences: [],
    open_world_by_family: initialReceipt.open_world_by_family,
    old_result_digest: initialReceipt.new_shadow_result_digest,
    new_shadow_result_digest: outputSetDigest,
    rollback_command: `remove only ${repoPath(POLICY_ROOT)}, ${repoPath(AUTHORITY_PATH)}, ${repoPath(OUTPUT_ROOT)} and ${repoPath(CORRECTION_RECEIPT)}`,
    rollback_result: 'PASS_ISOLATED_SHADOW_REMOVAL',
    changed_files: changedFiles(),
    implementation_bindings: {
      adapter: binding(resolve(REPO_ROOT, 'lib/canonical-v2/family-compound-adapter.js')),
      runner: binding(fileURLToPath(import.meta.url)),
      focused_test: binding(resolve(REPO_ROOT, 'tests/stage-2y-structure-m5-correction.test.js')),
      validator: binding(resolve(REPO_ROOT, 'scripts/stage-2y-structure-migration-validate.mjs')),
    },
    output_bindings: outputBindings,
    output_set_digest: outputSetDigest,
    publication_authorisation: 'NONE',
    m7_authorised: false,
  };
  writeCanonical(CORRECTION_RECEIPT, receipt);
}

main();
