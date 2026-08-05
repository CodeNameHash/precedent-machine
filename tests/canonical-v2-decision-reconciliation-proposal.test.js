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

test('builds a proposal-only complete binding inventory and blocks the stale decision freeze', () => {
  const proposal = compileDecisionReconciliationProposal({ repository_root: ROOT });
  assert.equal(proposal.authority, 'NONE');
  assert.equal(proposal.decision_register_freeze_authority, 'NONE');
  assert.equal(proposal.successor_m1_authority, 'NONE');
  assert.equal(proposal.recorded_ruling_count, Object.keys(RECORDED_RULINGS).length);
  assert.deepEqual(proposal.missing_ruling_ids, ['antitrust-expanded-taxonomy']);
  assert.deepEqual(proposal.conflicting_ruling_ids, []);
  assert.deepEqual(proposal.unknown_ruling_ids, []);
  assert.deepEqual(proposal.invalid_choice_ruling_ids, []);
  assert.deepEqual(proposal.missing_binding_ruling_ids, []);
  assert.deepEqual(proposal.implementation_gap_ruling_ids, []);
  assert.equal(proposal.decision_register_freeze_ready, false);
  assert.equal(proposal.family_completion_ready, false);
  assert.deepEqual(proposal.family_completion_blocker_codes, [
    'DECISION_RECONCILIATION_REQUIRED',
    'RATIFIED_DECISION_REGISTER_FREEZE_REQUIRED',
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
  assert.deepEqual(validateDecisionReconciliationProposal(proposal, { repository_root: ROOT }), proposal);
});

test('records every later Ben ruling and exposes only evidenced implementation state', () => {
  const proposal = compileDecisionReconciliationProposal({ repository_root: ROOT });
  const rulings = new Map(proposal.recorded_rulings.map((ruling) => [ruling.ruling_id, ruling]));
  for (const rulingId of LATER_RECORDED_RULING_IDS) assert.ok(rulings.has(rulingId), rulingId);
  const dissent = rulings.get('closing-dissent-threshold-retirement');
  assert.equal(dissent.choice_id, 'APPROVED_RETIRED_OPEN_WORLD');
  assert.equal(dissent.implementation_state, 'IMPLEMENTED');
  assert.deepEqual(dissent.implementation_gap_codes, []);
  assert.ok(dissent.code_bindings.some((binding) => binding.path === 'lib/canonical-v2/closing-conditions-follow-on-source-pack.js'));
  assert.ok(dissent.specification_bindings.some((binding) => binding.path === 'docs/superpowers/specs/2026-08-03-family-appraisal-dissenters-rights-design.md'));
  assert.ok(dissent.test_bindings.some((binding) => binding.path === 'tests/programme-gates/m3-family-parity-register.spec.js'));
  assert.equal(rulings.get('consideration-cvr-presence').implementation_state, 'IMPLEMENTED');
  assert.equal(rulings.get('consideration-election-mechanism').implementation_state, 'IMPLEMENTED');
  assert.equal(rulings.get('closing-termination-linking').implementation_state, 'IMPLEMENTED');
  assert.equal(rulings.get('defined-terms-first-comparable').implementation_state, 'IMPLEMENTED');
  assert.equal(rulings.get('defined-terms-neutral-long-tail').implementation_state, 'IMPLEMENTED');
  assert.equal(rulings.get('defined-terms-misclassified-reclassification').implementation_state, 'IMPLEMENTED');
  assert.equal(rulings.get('defined-terms-next-slices').implementation_state, 'IMPLEMENTED');
  assert.deepEqual(proposal.implementation_gap_ruling_ids, []);
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
});

test('updated antitrust docket covers naming, control, filing regimes and every rendered V1 surface', () => {
  const proposal = compileDecisionReconciliationProposal({ repository_root: ROOT });
  assert.equal(proposal.antitrust_docket.decision_id, 'antitrust-expanded-taxonomy');
  assert.deepEqual(proposal.antitrust_docket.unresolved_topics.map((topic) => topic.topic_id), [
    'agreements-name-and-claims',
    'strategy-control-and-consultation',
    'filing-regimes-and-deadlines',
    'rendered-v1-terminal-dispositions',
  ]);
  assert.deepEqual(
    proposal.antitrust_docket.unresolved_topics.at(-1).rendered_v1_surfaces,
    ANTITRUST_V1_SURFACE_IDS,
  );
  assert.equal(IMPLEMENTATION_AUDIT['antitrust-expanded-taxonomy'].state, 'BLOCKED_UNRATIFIED');
  assert.deepEqual(IMPLEMENTATION_AUDIT['antitrust-expanded-taxonomy'].gaps, [
    'EXPANDED_ANTITRUST_TAXONOMY_RATIFICATION_REQUIRED',
    'RENDERED_V1_ANTITRUST_TERMINAL_DISPOSITIONS_REQUIRED',
  ]);
});

test('conflicting rulings, missing bindings and changed source bytes fail closed', () => {
  const conflict = compileDecisionReconciliationProposal({
    repository_root: ROOT,
    recorded_rulings: [...Object.entries(RECORDED_RULINGS), ['db-apply', 'hold']],
  });
  assert.deepEqual(conflict.conflicting_ruling_ids, ['db-apply']);
  assert.equal(conflict.decision_register_freeze_ready, false);

  const withoutDbProfile = BINDING_PROFILES.filter((profile) => !profile.ids.includes('db-apply'));
  const missingBinding = compileDecisionReconciliationProposal({
    repository_root: ROOT,
    binding_profiles: withoutDbProfile,
  });
  assert.deepEqual(missingBinding.missing_binding_ruling_ids, ['db-apply']);
  assert.equal(missingBinding.decision_register_freeze_ready, false);
  assert.throws(
    () => validateDecisionReconciliationProposal(missingBinding, {
      repository_root: ROOT,
      binding_profiles: withoutDbProfile,
    }),
    (error) => error.code === 'DECISION_BINDING_INCOMPLETE',
  );

  const proposal = compileDecisionReconciliationProposal({ repository_root: ROOT });
  const consolePath = path.join(ROOT, 'lib/programme-decision-console.js');
  assert.throws(
    () => validateDecisionReconciliationProposal(proposal, {
      repository_root: ROOT,
      readFileSync: (candidate) => path.resolve(candidate) === consolePath
        ? Buffer.concat([fs.readFileSync(candidate), Buffer.from('\nFRESHNESS_CHANGE')])
        : fs.readFileSync(candidate),
    }),
    (error) => error.code === 'DECISION_RECONCILIATION_STALE',
  );
});

test('family build completion cannot escape the decision-reconciliation gate', () => {
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.state, 'FAMILY_COMPLETE');
  const proposal = compileDecisionReconciliationProposal({ repository_root: ROOT });
  const conditional = bindDecisionConditionalFamilyStatus(CURRENT_M3_FAMILY_PARITY_STATUS, proposal);
  assert.equal(conditional.raw_family_state, 'FAMILY_COMPLETE');
  assert.equal(conditional.state, 'BLOCKED');
  assert.equal(conditional.decision_register_freeze_ready, false);
  assert.equal(conditional.decision_register_freeze_authority, 'NONE');
  assert.ok(conditional.blocker_codes.includes('RATIFIED_DECISION_REGISTER_FREEZE_REQUIRED'));
});
