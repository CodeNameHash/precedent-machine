'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EMPTY_REGISTRY,
} = require('../lib/canonical-v2/native-producer/known-defect-registry');
const {
  M3CertificationControlError,
} = require('../lib/canonical-v2/native-producer/m3-certification-control');
const {
  CERTIFICATION_ADMISSIBLE,
  buildM3CertificationControlPlanV2,
  certificationAdmissible,
} = require('../lib/canonical-v2/native-producer/m3-certification-control-v2');
const {
  CURRENT_M3_FAMILY_PARITY_STATUS,
} = require('../lib/canonical-v2/native-producer/m3-family-parity-register');
const {
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

function build(overrides = {}) {
  return buildM3CertificationControlPlanV2({
    candidate_set_id: 'candidate-set-1',
    source_scope_certification_set_id: 'source-scope-set-1',
    candidates: [candidate()],
    family_parity_status: CURRENT_M3_FAMILY_PARITY_STATUS,
    known_defect_registry: EMPTY_REGISTRY,
    sampling_seed: 'm3-v2-fixed-seed',
    ...overrides,
  });
}

function assertControlError(code) {
  return (error) => error instanceof M3CertificationControlError && error.code === code;
}

test('V2 cannot wrap raw FAMILY_COMPLETE into a certification plan', () => {
  assert.throws(() => build(), assertControlError('DECISION_RECONCILIATION_REQUIRED'));
});

test('V2 cannot issue certification authority in the current blocked trust state', () => {
  assert.equal(CERTIFICATION_ADMISSIBLE, false);
  assert.equal(certificationAdmissible({
    decision_register_freeze_authority: 'NONE',
    external_verification_state: 'UNAVAILABLE',
  }), false);
});

test('V2 remains non-authoritative under a hypothetical trusted state', () => {
  assert.equal(certificationAdmissible({
    decision_register_freeze_authority: 'TRUSTED_RATIFIED_FREEZE',
    external_verification_state: 'VERIFIED',
    confirmed_error_count: 0,
    required_review_complete: true,
  }), false);
});

test('V2 preserves the current decision-reconciliation block', () => {
  const proposal = compileDecisionReconciliationProposal();
  const conditionalStatus = bindDecisionConditionalFamilyStatus(
    CURRENT_M3_FAMILY_PARITY_STATUS,
    proposal,
  );
  assert.throws(() => build({
    decision_reconciliation_proposal: proposal,
    decision_conditional_family_status: conditionalStatus,
  }), (error) => (
    error instanceof M3CertificationControlError
      && error.code === 'DECISION_RECONCILIATION_BLOCKED'
      && error.details.blocking_unresolved_decision_ids.includes('antitrust-expanded-taxonomy')
      && error.details.decision_register_freeze_authority === 'NONE'
  ));
});

test('V2 does not accept a raw status in place of its decision-conditional status', () => {
  const proposal = compileDecisionReconciliationProposal();
  assert.throws(() => build({
    decision_reconciliation_proposal: proposal,
    decision_conditional_family_status: CURRENT_M3_FAMILY_PARITY_STATUS,
  }), assertControlError('DECISION_CONDITIONAL_FAMILY_STATUS_INVALID'));
});
