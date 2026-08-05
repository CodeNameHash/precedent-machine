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
  CURRENT_M3_FAMILY_PARITY_STATUS,
} = require('../lib/canonical-v2/native-producer/m3-family-parity-register');
const {
  FAMILY_STATUS_SCHEMA,
  PROPOSAL_SCHEMA,
  bindDecisionConditionalFamilyStatus,
  compileDecisionReconciliationProposal,
} = require('../lib/canonical-v2/decision-reconciliation-proposal');

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

function currentDecisionInputs() {
  const proposal = compileDecisionReconciliationProposal();
  return {
    decision_reconciliation_proposal: proposal,
    decision_conditional_family_status: bindDecisionConditionalFamilyStatus(
      CURRENT_M3_FAMILY_PARITY_STATUS,
      proposal,
    ),
  };
}

function build(overrides = {}) {
  return buildM3CertificationControlPlan({
    candidate_set_id: 'candidate-set-1',
    candidates: [candidate()],
    family_parity_status: CURRENT_M3_FAMILY_PARITY_STATUS,
    known_defect_registry: EMPTY_REGISTRY,
    sampling_seed: 'm3-fixed-seed-2026-08-03',
    ...overrides,
  });
}

function assertControlError(code) {
  return (error) => error instanceof M3CertificationControlError && error.code === code;
}

test('raw FAMILY_COMPLETE status alone cannot construct a certification plan', () => {
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.state, 'FAMILY_COMPLETE');
  assert.throws(() => build(), assertControlError('DECISION_RECONCILIATION_REQUIRED'));
});

test('current decision reconciliation blocks certification on antitrust and freeze authority', () => {
  const decisionInputs = currentDecisionInputs();
  assert.equal(decisionInputs.decision_conditional_family_status.state, 'BLOCKED');
  assert.throws(() => build(decisionInputs), (error) => (
    error instanceof M3CertificationControlError
      && error.code === 'DECISION_RECONCILIATION_BLOCKED'
      && error.details.blocking_unresolved_decision_ids.includes('antitrust-expanded-taxonomy')
      && error.details.decision_register_freeze_ready === false
      && error.details.decision_register_freeze_authority === 'NONE'
      && error.details.family_completion_ready === false
  ));
});

test('a forged decision-conditional FAMILY_COMPLETE status is rejected even when rehashed', () => {
  const decisionInputs = currentDecisionInputs();
  const { decision_conditional_family_status_id: _oldId, ...forgedBody } = structuredClone(
    decisionInputs.decision_conditional_family_status,
  );
  forgedBody.state = 'FAMILY_COMPLETE';
  forgedBody.blocker_codes = [];
  const forged = {
    ...forgedBody,
    decision_conditional_family_status_id: contentId(FAMILY_STATUS_SCHEMA, forgedBody),
  };
  assert.throws(() => build({
    ...decisionInputs,
    decision_conditional_family_status: forged,
  }), assertControlError('DECISION_CONDITIONAL_FAMILY_STATUS_INVALID'));
});

test('a self-rehashed proposal cannot grant decision freeze or family-completion authority', () => {
  const decisionInputs = currentDecisionInputs();
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
  assert.throws(() => build({
    decision_reconciliation_proposal: forged,
    decision_conditional_family_status: decisionInputs.decision_conditional_family_status,
    successor_m1_authority: forged,
  }), assertControlError('DECISION_RECONCILIATION_REQUIRED'));
});

test('an asserted successor authority cannot bypass the open decision reconciliation', () => {
  const decisionInputs = currentDecisionInputs();
  assert.throws(() => build({
    ...decisionInputs,
    successor_m1_authority: {
      schema_version: 'CANONICAL_V2_SUCCESSOR_M1_AUTHORITY/V1',
      authority: 'SELF_ASSERTED',
    },
  }), assertControlError('DECISION_RECONCILIATION_BLOCKED'));
});
