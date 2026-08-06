'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  EMPTY_REGISTRY,
} = require('../lib/canonical-v2/native-producer/known-defect-registry');
const {
  M3CertificationControlError,
  buildM3CertificationControlPlan,
} = require('../lib/canonical-v2/native-producer/m3-certification-control');
const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  CURRENT_M3_FAMILY_PARITY_STATUS,
  STATUS_SCHEMA,
  listM3ProductParityBlockers,
} = require('../lib/canonical-v2/native-producer/m3-family-parity-register');
const {
  FAMILY_STATUS_SCHEMA,
  PROPOSAL_SCHEMA,
  bindDecisionConditionalFamilyStatus,
  compileDecisionReconciliationProposal,
} = require('../lib/canonical-v2/decision-reconciliation-proposal');

const CERTIFICATION_CONTROL_PATH = require.resolve('../lib/canonical-v2/native-producer/m3-certification-control');
const DECISION_RECONCILIATION_PATH = require.resolve('../lib/canonical-v2/decision-reconciliation-proposal');

function candidate() {
  return {
    candidate_id: 'candidate-1',
    deal: 'topbuild',
    family: 'REP-T-CAP',
    attribute: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    input_path: 'NATIVE',
    normalisation_type: 'ENUM',
    extraction_mechanism: 'semantic-producer/v1',
    auto_pass_eligible: true,
    materiality_rank: 10,
  };
}

function syntheticCompleteParityStatus() {
  const { m3_family_parity_status_id: _oldId, ...body } = structuredClone(
    CURRENT_M3_FAMILY_PARITY_STATUS,
  );
  body.state = 'FAMILY_COMPLETE';
  body.family_states = body.family_states.map((entry) => ({
    ...entry,
    completion_state: 'FAMILY_COMPLETE',
  }));
  body.supplemental_owner_states = body.supplemental_owner_states.map((entry) => ({
    ...entry,
    completion_state: 'OWNER_COMPLETE',
  }));
  body.unassigned_product_surface_ids = [];
  return {
    ...body,
    m3_family_parity_status_id: contentId(STATUS_SCHEMA, body),
  };
}

function currentDecisionInputs(familyParityStatus) {
  const proposal = compileDecisionReconciliationProposal();
  const currentConditional = bindDecisionConditionalFamilyStatus(
    CURRENT_M3_FAMILY_PARITY_STATUS,
    proposal,
  );
  const { decision_conditional_family_status_id: _oldId, ...body } = currentConditional;
  body.raw_family_status_id = familyParityStatus.m3_family_parity_status_id;
  body.raw_family_state = familyParityStatus.state;
  body.state = 'BLOCKED';
  return {
    decision_reconciliation_proposal: proposal,
    decision_conditional_family_status: {
      ...body,
      decision_conditional_family_status_id: contentId(FAMILY_STATUS_SCHEMA, body),
    },
  };
}

function build(overrides = {}) {
  return buildM3CertificationControlPlan({
    candidate_set_id: 'candidate-set-1',
    candidates: [candidate()],
    family_parity_status: syntheticCompleteParityStatus(),
    known_defect_registry: EMPTY_REGISTRY,
    sampling_seed: 'm3-fixed-seed-2026-08-03',
    ...overrides,
  });
}

function assertControlError(code) {
  return (error) => error instanceof M3CertificationControlError && error.code === code;
}

function buildWithSyntheticParityBinding(overrides = {}) {
  const cachedDecision = require.cache[DECISION_RECONCILIATION_PATH];
  const cachedControl = require.cache[CERTIFICATION_CONTROL_PATH];
  const originalDecisionExports = cachedDecision.exports;
  const familyParityStatus = overrides.family_parity_status || syntheticCompleteParityStatus();
  try {
    cachedDecision.exports = {
      ...originalDecisionExports,
      bindDecisionConditionalFamilyStatus(rawStatus, proposal) {
        assert.deepEqual(rawStatus, familyParityStatus);
        return currentDecisionInputs(familyParityStatus).decision_conditional_family_status;
      },
    };
    delete require.cache[CERTIFICATION_CONTROL_PATH];
    const { buildM3CertificationControlPlan: syntheticBuild } = require(CERTIFICATION_CONTROL_PATH);
    return syntheticBuild({
      candidate_set_id: 'candidate-set-1',
      candidates: [candidate()],
      family_parity_status: familyParityStatus,
      known_defect_registry: EMPTY_REGISTRY,
      sampling_seed: 'm3-fixed-seed-2026-08-03',
      ...overrides,
    });
  } finally {
    cachedDecision.exports = originalDecisionExports;
    if (cachedControl) require.cache[CERTIFICATION_CONTROL_PATH] = cachedControl;
    else delete require.cache[CERTIFICATION_CONTROL_PATH];
  }
}

function assertSyntheticControlError(code) {
  return (error) => error?.name === 'M3CertificationControlError' && error.code === code;
}

test('the real parity register blocks certification before decision reconciliation', () => {
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.state, 'BLOCKED');
  // 104 after two movements on 2026-08-05 that happen to cancel out (see
  // tests/canonical-v2-parity-serving-path.test.js for the detail), then 103 the same day:
  // termination-fee-query-fields' dead CompareSectionColumn locator was repointed to the
  // component it actually renders through, UnifiedCompareSection, with a real served
  // consumer named (docs/codex-program/notes/compare-locator-fix.md). Do not read either
  // movement as nothing having happened.
  assert.equal(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length, 103);
  // 2, not 6: the owner approved the four retained no-shop concepts
  // (2026-08-05), promoting NOSOL-CEASE/RECOMMEND/ENFORCE/WAIVER out of
  // review hold into the NO_SHOP family's product_surfaces. Only the two
  // permanently-bounded NOSOL-SUPERIOR/NOSOL-INTERVENING claims remain.
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.review_hold_ids.length, 2);
  assert.throws(() => build({
    family_parity_status: CURRENT_M3_FAMILY_PARITY_STATUS,
  }), assertControlError('INCOMPLETE_FAMILY_PARITY'));
});

test('synthetic family completion alone cannot construct a certification plan', () => {
  assert.throws(() => build(), assertControlError('DECISION_RECONCILIATION_REQUIRED'));
});

test('current decision reconciliation blocks certification on policy binding and freeze authority', () => {
  const decisionInputs = currentDecisionInputs(syntheticCompleteParityStatus());
  assert.equal(decisionInputs.decision_conditional_family_status.state, 'BLOCKED');
  assert.throws(() => buildWithSyntheticParityBinding(decisionInputs), (error) => (
    error?.name === 'M3CertificationControlError'
      && error.code === 'DECISION_RECONCILIATION_BLOCKED'
      && error.details.blocking_unresolved_decision_ids.length === 0
      && error.details.decision_register_freeze_ready === false
      && error.details.decision_register_freeze_authority === 'NONE'
      && error.details.family_completion_ready === false
      && error.details.family_completion_blocker_codes.includes('RECORDED_RULING_IMPLEMENTATION_GAPS')
  ));
});

test('a forged decision-conditional FAMILY_COMPLETE status is rejected even when rehashed', () => {
  const decisionInputs = currentDecisionInputs(syntheticCompleteParityStatus());
  const { decision_conditional_family_status_id: _oldId, ...forgedBody } = structuredClone(
    decisionInputs.decision_conditional_family_status,
  );
  forgedBody.state = 'FAMILY_COMPLETE';
  forgedBody.blocker_codes = [];
  const forged = {
    ...forgedBody,
    decision_conditional_family_status_id: contentId(FAMILY_STATUS_SCHEMA, forgedBody),
  };
  assert.throws(() => buildWithSyntheticParityBinding({
    ...decisionInputs,
    decision_conditional_family_status: forged,
  }), assertSyntheticControlError('DECISION_CONDITIONAL_FAMILY_STATUS_INVALID'));
});

test('a self-rehashed proposal cannot grant decision freeze or family-completion authority', () => {
  const decisionInputs = currentDecisionInputs(syntheticCompleteParityStatus());
  const { decision_reconciliation_proposal_id: _oldId, ...forgedBody } = structuredClone(
    decisionInputs.decision_reconciliation_proposal,
  );
  forgedBody.missing_ruling_ids = [];
  forgedBody.blocking_unresolved_decision_ids = [];
  forgedBody.decision_register_freeze_ready = true;
  forgedBody.decision_register_freeze_authority = 'SELF_ASSERTED';
  forgedBody.family_completion_ready = true;
  const forged = {
    ...forgedBody,
    decision_reconciliation_proposal_id: contentId(PROPOSAL_SCHEMA, forgedBody),
  };
  assert.throws(() => buildWithSyntheticParityBinding({
    decision_reconciliation_proposal: forged,
    decision_conditional_family_status: decisionInputs.decision_conditional_family_status,
    successor_m1_authority: forged,
  }), assertSyntheticControlError('DECISION_RECONCILIATION_REQUIRED'));
});

test('an asserted successor authority cannot bypass the open decision reconciliation', () => {
  const decisionInputs = currentDecisionInputs(syntheticCompleteParityStatus());
  assert.throws(() => buildWithSyntheticParityBinding({
    ...decisionInputs,
    successor_m1_authority: {
      schema_version: 'CANONICAL_V2_SUCCESSOR_M1_AUTHORITY/V1',
      authority: 'SELF_ASSERTED',
    },
  }), assertSyntheticControlError('DECISION_RECONCILIATION_BLOCKED'));
});
