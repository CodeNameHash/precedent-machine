'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA,
  PROPOSAL_STATUS,
  CACHE_KEY_DIMENSIONS,
  STOP_CONDITIONS,
  buildOperationalPolicySetProposal,
  validateOperationalPolicySetProposal,
} = require('../lib/canonical-v2/operational-policy-set-proposal');
const {
  CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA,
  REQUIRED_THIRD_RUN_TRIGGERS,
  REQUIRED_UNRESOLVED_CLOSURES,
  buildCertificationPolicyManifestProposal,
  validateCertificationPolicyManifestProposal,
} = require('../lib/canonical-v2/certification-policy-manifest-proposal');
const {
  RATIFIED_DECISION_REGISTER_FREEZE_ID,
  RETIRED_M1_ACKNOWLEDGEMENT_ID,
  SUCCESSOR_M1_AUTHORITY,
  SUCCESSOR_M1_AUTHORITY_SCHEMA,
  SUCCESSOR_M1_TRUST_STATE,
} = require('../lib/canonical-v2/native-producer/durable-12-item-pilot-readiness');
const {
  compileDecisionReconciliationProposal,
} = require('../lib/canonical-v2/decision-reconciliation-proposal');
const { PERMISSION_SCHEMA } = require('../lib/programme-gates/m1-milestone-permission');

const ROOT = path.resolve(__dirname, '..');
const digest = (label) => sha256Hex(`policy-proposal:${label}`);
const DECISION_RECONCILIATION_PROPOSAL_ID = compileDecisionReconciliationProposal()
  .decision_reconciliation_proposal_id;

function successorAuthority({ old = false } = {}) {
  const permission = {
    schema_version: PERMISSION_SCHEMA,
    m1_acknowledgement_id: old ? RETIRED_M1_ACKNOWLEDGEMENT_ID : digest('successor-ack'),
    reviewed_commit: old ? '9cef64ec626a50a78710ee90b08cdc0466b42374' : 'a'.repeat(40),
    bundle_id: old ? digest('old-bundle') : digest('successor-bundle'),
    contract_bundle_digest: old ? digest('old-contract') : digest('successor-contract'),
    canonical_payload_digest: old ? digest('old-payload') : digest('successor-payload'),
    ben_approval_reference: 'future-approved-reference',
    vertical_slice_execution: 'PASS',
    authority_source: 'M1_ACKNOWLEDGEMENT_AND_EXACT_BUNDLE_APPROVAL',
    production_authority: 'NONE',
  };
  const body = {
    schema_version: SUCCESSOR_M1_AUTHORITY_SCHEMA,
    authority: SUCCESSOR_M1_AUTHORITY,
    trust_state: SUCCESSOR_M1_TRUST_STATE,
    decision_reconciliation_proposal_id: DECISION_RECONCILIATION_PROPOSAL_ID,
    ratified_decision_register_freeze_id: RATIFIED_DECISION_REGISTER_FREEZE_ID,
    prior_m1_acknowledgement_id: RETIRED_M1_ACKNOWLEDGEMENT_ID,
    successor_m1_acknowledgement_id: permission.m1_acknowledgement_id,
    successor_reviewed_commit: permission.reviewed_commit,
    successor_bundle_id: permission.bundle_id,
    successor_contract_bundle_digest: permission.contract_bundle_digest,
    successor_canonical_payload_digest: permission.canonical_payload_digest,
    successor_m1_permission: permission,
  };
  return { ...body, successor_m1_authority_id: contentId(SUCCESSOR_M1_AUTHORITY_SCHEMA, body) };
}

function operationalInput(overrides = {}) {
  return {
    policy_manifest_ids: {
      archive_safety_policy_manifest_id: digest('archive'),
      cache_budget_manifest_id: digest('cache'),
      capacity_manifest_id: digest('capacity'),
      route_budget_manifest_id: digest('route'),
    },
    successor_m1_authority: successorAuthority(),
    durable_artifact_root: ROOT,
    ...overrides,
  };
}

function certificationInput(overrides = {}) {
  return {
    operational_policy_set_proposal: buildOperationalPolicySetProposal(operationalInput()),
    successor_m1_authority: successorAuthority(),
    high_risk_family_ids: ['ANTITRUST_REGULATORY', 'INTERIM_OPERATING'],
    registry_disposition_enum: ['ADOPTED_CANONICAL', 'DORMANT_NOT_APPLICABLE'],
    semantic_diff_classifications: ['CONFLICTING_VALUE', 'MISSING_MEMBER'],
    recovery_counter_inventory: ['ACTIVE_COMPATIBILITY_RECOVERY_COUNTERS'],
    certification_methods: ['SHADOW_REEXTRACTION', 'HUMAN_ADJUDICATION'],
    pass_thresholds: { unresolved_terminal_count: 0 },
    soak_test_formula: 'EXPLICIT_FUTURE_POLICY_VALUE',
    restore_or_rollback_success_criteria: 'EXPLICIT_FUTURE_POLICY_VALUE',
    ...overrides,
  };
}

test('operational proposal preserves only approved operating rules and remains non-authoritative', () => {
  const proposal = buildOperationalPolicySetProposal(operationalInput());
  assert.equal(proposal.schema_version, OPERATIONAL_POLICY_SET_PROPOSAL_SCHEMA);
  assert.equal(proposal.status, PROPOSAL_STATUS);
  assert.equal(proposal.production_authority, 'NONE');
  assert.equal(proposal.adoption_authority, 'NOT_GRANTED');
  assert.deepEqual(proposal.extraction_profile, {
    profile_id: 'TERRA_MEDIUM', model: 'gpt-5.6-terra', reasoning_effort: 'medium',
  });
  assert.equal(proposal.shadow_execution.resumable_lane_count, 2);
  assert.equal(proposal.shadow_execution.replay_invalidation_plan_schema, 'M3_REPLAY_INVALIDATION_PLAN/V1');
  assert.deepEqual(proposal.cache_key_dimensions, CACHE_KEY_DIMENSIONS);
  assert.deepEqual(proposal.stop_conditions, STOP_CONDITIONS);
  assert.deepEqual(proposal.blockers.map((entry) => entry.code), [
    'SUCCESSOR_M1_ADOPTION_BINDING_UNRESOLVED',
  ]);
  assert.equal(proposal.successor_m1_adoption_binding, null);
  assert.deepEqual(validateOperationalPolicySetProposal(proposal), proposal);
});

test('caller input cannot substitute the approved cache dimensions or stop conditions', () => {
  const proposal = buildOperationalPolicySetProposal(operationalInput({
    cache_key_dimensions: ['INVENTED'],
    stop_conditions: ['INVENTED'],
  }));
  assert.deepEqual(proposal.cache_key_dimensions, CACHE_KEY_DIMENSIONS);
  assert.deepEqual(proposal.stop_conditions, STOP_CONDITIONS);
});

test('temporary roots and a relabelled retired M1 are blocked', () => {
  const temporary = buildOperationalPolicySetProposal(operationalInput({ durable_artifact_root: '/tmp/policy-proposal' }));
  assert.ok(temporary.blockers.some((entry) => entry.code.startsWith('DURABLE_ARTIFACT_ROOT_')));
  const retired = buildOperationalPolicySetProposal(operationalInput({ successor_m1_authority: successorAuthority({ old: true }) }));
  assert.ok(retired.blockers.some((entry) => entry.code === 'SUCCESSOR_M1_ADOPTION_BINDING_UNRESOLVED'));
});

test('certification proposal fixes the two shadows, all mandatory third runs and zero unresolved changes without authorising work', () => {
  const proposal = buildCertificationPolicyManifestProposal(certificationInput());
  assert.equal(proposal.schema_version, CERTIFICATION_POLICY_MANIFEST_PROPOSAL_SCHEMA);
  assert.equal(proposal.status, PROPOSAL_STATUS);
  assert.equal(proposal.production_authority, 'NONE');
  assert.equal(proposal.adoption_authority, 'NOT_GRANTED');
  assert.equal(proposal.certification_execution.full_shadow_run_count, 2);
  assert.deepEqual(proposal.certification_execution.required_third_run_triggers, REQUIRED_THIRD_RUN_TRIGGERS);
  assert.deepEqual(proposal.certification_execution.required_empty_terminal_sets, REQUIRED_UNRESOLVED_CLOSURES);
  assert.equal(proposal.certification_execution.majority_selection_forbidden, true);
  assert.equal(proposal.certification_execution.fresh_confirming_run_required_after_affected_change, true);
  assert.deepEqual(proposal.blockers.map((entry) => entry.code), [
    'SUCCESSOR_M1_CERTIFICATION_BINDING_UNRESOLVED',
  ]);
  assert.equal(proposal.successor_m1_certification_binding, null);
  assert.deepEqual(validateCertificationPolicyManifestProposal(proposal), proposal);
});

test('certification proposal blocks each unspecified policy value rather than choosing one', () => {
  const proposal = buildCertificationPolicyManifestProposal();
  assert.equal(proposal.status, PROPOSAL_STATUS);
  const codes = proposal.blockers.map((entry) => entry.code);
  for (const code of [
    'OPERATIONAL_POLICY_SET_UNRESOLVED',
    'SUCCESSOR_M1_CERTIFICATION_BINDING_UNRESOLVED',
    'HIGH_RISK_FAMILY_UNIVERSE_UNRESOLVED',
    'REGISTRY_DISPOSITION_ENUM_UNRESOLVED',
    'SEMANTIC_DIFF_CLASSIFICATIONS_UNRESOLVED',
    'RECOVERY_COUNTER_INVENTORY_UNRESOLVED',
    'CERTIFICATION_METHODS_UNRESOLVED',
    'PASS_THRESHOLDS_UNRESOLVED',
    'SOAK_TEST_FORMULA_UNRESOLVED',
    'RESTORE_OR_ROLLBACK_CRITERIA_UNRESOLVED',
  ]) assert.ok(codes.includes(code), code);
});

test('proposal modules have no provider, extraction, database or network launch path', () => {
  for (const relativePath of [
    'lib/canonical-v2/operational-policy-set-proposal.js',
    'lib/canonical-v2/certification-policy-manifest-proposal.js',
  ]) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.doesNotMatch(source, /createCodexCliProvider|executeUnifiedRun|provider_factory|anthropic-provider|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|activate_candidate_release/i);
  }
});
