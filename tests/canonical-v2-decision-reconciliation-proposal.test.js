'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  ANTITRUST_V1_SURFACE_IDS,
  BINDING_PROFILES,
  IMPLEMENTATION_AUDIT,
  LATER_RECORDED_RULING_IDS,
  bindDecisionConditionalFamilyStatus,
  compileDecisionReconciliationProposal,
  validateDecisionReconciliationProposal,
} = require('../lib/canonical-v2/decision-reconciliation-proposal');
const {
  CURRENT_M3_FAMILY_PARITY_STATUS,
} = require('../lib/canonical-v2/native-producer/m3-family-parity-register');
const { RECORDED_RULINGS } = require('../lib/programme-decision-console');

const ROOT = path.resolve(__dirname, '..');

test('builds a proposal-only complete binding inventory ready for a separate freeze act', () => {
  const proposal = compileDecisionReconciliationProposal();
  assert.equal(proposal.authority, 'NONE');
  assert.equal(proposal.decision_register_freeze_authority, 'NONE');
  assert.equal(proposal.successor_m1_authority, 'NONE');
  assert.equal(proposal.declared_ruling_count, Object.keys(RECORDED_RULINGS).length);
  assert.equal(proposal.recorded_ruling_count, Object.keys(RECORDED_RULINGS).length);
  assert.deepEqual(proposal.missing_ruling_ids, []);
  assert.deepEqual(proposal.conflicting_ruling_ids, []);
  assert.deepEqual(proposal.unknown_ruling_ids, []);
  assert.deepEqual(proposal.invalid_choice_ruling_ids, []);
  assert.deepEqual(proposal.missing_binding_ruling_ids, []);
  assert.ok(proposal.implementation_gap_ruling_ids.includes('topbuild-mae'));
  assert.ok(proposal.implementation_gap_ruling_ids.includes('db-apply'));
  assert.equal(proposal.ruling_evidence_freeze_ready, true);
  assert.equal(proposal.implementation_reconciliation_ready, false);
  assert.equal(proposal.decision_register_freeze_ready, false);
  assert.equal(proposal.family_completion_ready, false);
  assert.deepEqual(proposal.pending_user_ratification_ruling_ids, []);
  assert.deepEqual(proposal.family_completion_blocker_codes, [
    'RATIFIED_DECISION_REGISTER_FREEZE_REQUIRED',
    'RECORDED_RULING_IMPLEMENTATION_GAPS',
  ]);
  for (const ruling of proposal.recorded_rulings) {
    for (const bindings of [ruling.code_bindings, ruling.specification_bindings, ruling.test_bindings]) {
      assert.ok(bindings.length > 0, ruling.ruling_id);
      for (const binding of bindings) {
        assert.ok(fs.existsSync(path.join(ROOT, binding.path)), binding.path);
        assert.match(binding.sha256, /^[a-f0-9]{64}$/);
      }
    }
  }
  assert.deepEqual(validateDecisionReconciliationProposal(proposal), proposal);
});

test('records every later Ben ruling and exposes only evidenced implementation state', () => {
  const proposal = compileDecisionReconciliationProposal();
  const rulings = new Map(proposal.recorded_rulings.map((ruling) => [ruling.ruling_id, ruling]));
  for (const rulingId of LATER_RECORDED_RULING_IDS) assert.ok(rulings.has(rulingId), rulingId);
  const dissent = rulings.get('closing-dissent-threshold-retirement');
  assert.equal(dissent.choice_id, 'APPROVED_RETIRED_OPEN_WORLD');
  assert.equal(dissent.implementation_state, 'CODE_PRESENT_TEST_BINDINGS_DECLARED');
  assert.equal(dissent.verification_state, 'FINAL_INTEGRATED_RECEIPT_REQUIRED');
  assert.deepEqual(dissent.implementation_gap_codes, []);
  assert.ok(dissent.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/closing-conditions-follow-on-source-pack.js'));
  assert.ok(dissent.specification_bindings.some((binding) => binding.path === 'docs/superpowers/specs/2026-08-03-family-appraisal-dissenters-rights-design.md'));
  assert.ok(dissent.test_bindings.some((binding) => binding.path === 'tests/programme-gates/m3-family-parity-register.spec.js'));
  for (const rulingId of ['consideration-cvr-presence', 'consideration-election-mechanism', 'closing-termination-linking', 'defined-terms-first-comparable', 'defined-terms-neutral-long-tail', 'defined-terms-misclassified-reclassification', 'defined-terms-next-slices']) {
    assert.equal(rulings.get(rulingId).implementation_state, 'CODE_PRESENT_TEST_BINDINGS_DECLARED');
    assert.equal(rulings.get(rulingId).verification_state, 'FINAL_INTEGRATED_RECEIPT_REQUIRED');
  }
  assert.ok(proposal.implementation_gap_ruling_ids.includes('topbuild-mae'));
  const topBuildMae = rulings.get('topbuild-mae');
  assert.equal(topBuildMae.choice_id, 'per-limb-and-trailing-union');
  assert.equal(topBuildMae.implementation_state, 'APPROVED_IMPLEMENTATION_PENDING');
  assert.deepEqual(topBuildMae.implementation_gap_codes, ['TOPBUILD_PER_LIMB_AND_TRAILING_UNION_IMPLEMENTATION_REQUIRED']);
  assert.deepEqual(
    rulings.get('defined-terms-next-slices').implementation_gap_codes,
    IMPLEMENTATION_AUDIT['defined-terms-next-slices'].gaps,
  );
  assert.deepEqual(rulings.get('defined-terms-next-slices').implementation_gap_codes, []);
  const laterDefinition = rulings.get('defined-terms-next-slices');
  assert.deepEqual(
    laterDefinition.code_bindings.map((binding) => binding.path),
    [
      'lib/canonical-v2/company-employee-definition-owner-routing.js',
      'lib/canonical-v2/contract-bundle.js',
      'lib/canonical-v2/key-terms-mae-product-projection.js',
      'lib/canonical-v2/native-producer/candidate-resolution.js',
      'lib/canonical-v2/native-producer/defined-terms-producer-prompt.js',
      'lib/programme-decision-console.js',
    ],
  );
  assert.ok(laterDefinition.test_bindings.some((binding) => binding.path === 'tests/canonical-v2-company-employee-definition-owner-routing.test.js'));
  assert.ok(laterDefinition.test_bindings.some((binding) => binding.path === 'tests/canonical-v2-defined-terms-later-slices.test.js'));
  const election = rulings.get('consideration-election-mechanism');
  assert.ok(election.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/native-producer/consideration-producer-prompt.js'));
  assert.ok(election.test_bindings.some((binding) => binding.path === 'tests/canonical-v2-consideration-ioc-product-parity.test.js'));
  const neutral = rulings.get('defined-terms-neutral-long-tail');
  assert.ok(neutral.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/neutral-defined-term-comparison-consumer.js'));
  assert.ok(neutral.test_bindings.some((binding) => binding.path === 'tests/canonical-v2-neutral-defined-term-comparison-consumer.test.js'));
  const reclassification = rulings.get('defined-terms-misclassified-reclassification');
  assert.ok(reclassification.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/content-reviewed-definition-reclassification-contract.js'));
  assert.ok(reclassification.test_bindings.some((binding) => binding.path === 'tests/canonical-v2-content-reviewed-definition-reclassification-contract.test.js'));
  assert.deepEqual(
    rulings.get('defined-terms-misclassified-reclassification').implementation_gap_codes,
    [],
  );
  const policy = rulings.get('production-policy-package-v2');
  assert.equal(policy.implementation_state, 'CODE_PRESENT_TEST_BINDINGS_DECLARED_SUCCESSOR_M1_PASS_REQUIRED');
  assert.equal(policy.verification_state, 'FINAL_INTEGRATED_RECEIPT_REQUIRED');
  assert.deepEqual(policy.implementation_gap_codes, []);
  assert.ok(policy.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/operational-policy-set-proposal.js'));
  assert.ok(policy.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/certification-policy-manifest-proposal.js'));
  assert.ok(policy.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/policy-successor-m1-adoption-binding.js'));
  const identity = rulings.get('identity-initial-import-foundation');
  assert.ok(identity.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js'));
  assert.ok(identity.test_bindings.some((binding) => binding.path === 'tests/canonical-v2-literal-trusted-key-registry-patch.test.js'));
});

test('approved antitrust docket covers naming, control, filing regimes and every rendered V1 surface', () => {
  const proposal = compileDecisionReconciliationProposal();
  assert.equal(proposal.antitrust_docket.decision_id, 'antitrust-expanded-taxonomy');
  assert.deepEqual(proposal.antitrust_docket.resolved_topics.map((topic) => topic.topic_id), [
    'agreements-name-and-claims',
    'strategy-control-and-consultation',
    'filing-regimes-and-deadlines',
    'rendered-v1-terminal-dispositions',
  ]);
  assert.deepEqual(
    proposal.antitrust_docket.resolved_topics.at(-1).rendered_v1_surfaces,
    ANTITRUST_V1_SURFACE_IDS,
  );
  assert.equal(IMPLEMENTATION_AUDIT['antitrust-expanded-taxonomy'].state, 'CODE_PRESENT_TEST_BINDINGS_DECLARED');
  assert.deepEqual(IMPLEMENTATION_AUDIT['antitrust-expanded-taxonomy'].gaps, []);
});

test('public compilation rejects caller evidence, binding profiles and file readers', () => {
  assert.throws(() => compileDecisionReconciliationProposal({
    recorded_rulings: [...Object.entries(RECORDED_RULINGS), ['db-apply', 'hold']],
  }), (error) => error.code === 'DECISION_RECONCILIATION_OPTIONS_FORBIDDEN');
  assert.throws(() => compileDecisionReconciliationProposal({
    pending_user_ratification_ruling_ids: ['rem-cap'],
  }), (error) => error.code === 'DECISION_RECONCILIATION_OPTIONS_FORBIDDEN');

  assert.throws(() => compileDecisionReconciliationProposal({ binding_profiles: BINDING_PROFILES }), (error) => error.code === 'DECISION_RECONCILIATION_OPTIONS_FORBIDDEN');
  assert.throws(() => compileDecisionReconciliationProposal({ repository_root: ROOT }), (error) => error.code === 'DECISION_RECONCILIATION_OPTIONS_FORBIDDEN');
  assert.throws(() => compileDecisionReconciliationProposal({ readFileSync: fs.readFileSync }), (error) => error.code === 'DECISION_RECONCILIATION_OPTIONS_FORBIDDEN');
  const proposal = compileDecisionReconciliationProposal();
  assert.throws(() => validateDecisionReconciliationProposal(proposal, { repository_root: ROOT }), (error) => error.code === 'DECISION_RECONCILIATION_OPTIONS_FORBIDDEN');
});

test('family visibility blockers and decision reconciliation both block the M3 gate', () => {
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.state, 'BLOCKED');
  const proposal = compileDecisionReconciliationProposal();
  const conditional = bindDecisionConditionalFamilyStatus(CURRENT_M3_FAMILY_PARITY_STATUS, proposal);
  assert.equal(conditional.raw_family_state, 'BLOCKED');
  assert.equal(conditional.state, 'BLOCKED');
  assert.equal(conditional.ruling_evidence_freeze_ready, true);
  assert.equal(conditional.implementation_reconciliation_ready, false);
  assert.equal(conditional.decision_register_freeze_ready, false);
  assert.equal(conditional.decision_register_freeze_authority, 'NONE');
  assert.ok(conditional.blocker_codes.includes('RATIFIED_DECISION_REGISTER_FREEZE_REQUIRED'));
});
