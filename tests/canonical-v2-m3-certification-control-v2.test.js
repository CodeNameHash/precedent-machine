'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');

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
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  CURRENT_M3_FAMILY_PARITY_STATUS,
  STATUS_SCHEMA,
  listM3ProductParityBlockers,
} = require('../lib/canonical-v2/native-producer/m3-family-parity-register');
const {
  bindDecisionConditionalFamilyStatus,
  compileDecisionReconciliationProposal,
} = require('../lib/canonical-v2/decision-reconciliation-proposal');

const FAMILY_STATUS_SCHEMA = 'CANONICAL_V2_DECISION_CONDITIONAL_FAMILY_STATUS/V1';
const CERTIFICATION_CONTROL_PATH = require.resolve('../lib/canonical-v2/native-producer/m3-certification-control');
const CERTIFICATION_CONTROL_V2_PATH = require.resolve('../lib/canonical-v2/native-producer/m3-certification-control-v2');
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

function build(overrides = {}) {
  return buildM3CertificationControlPlanV2({
    candidate_set_id: 'candidate-set-1',
    source_scope_certification_set_id: 'source-scope-set-1',
    candidates: [candidate()],
    family_parity_status: syntheticCompleteParityStatus(),
    known_defect_registry: EMPTY_REGISTRY,
    sampling_seed: 'm3-v2-fixed-seed',
    ...overrides,
  });
}

function syntheticDecisionInputs(familyParityStatus) {
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

function buildWithSyntheticParityBinding(overrides = {}) {
  const cachedDecision = require.cache[DECISION_RECONCILIATION_PATH];
  const cachedControl = require.cache[CERTIFICATION_CONTROL_PATH];
  const cachedControlV2 = require.cache[CERTIFICATION_CONTROL_V2_PATH];
  const originalDecisionExports = cachedDecision.exports;
  const familyParityStatus = overrides.family_parity_status || syntheticCompleteParityStatus();
  try {
    cachedDecision.exports = {
      ...originalDecisionExports,
      bindDecisionConditionalFamilyStatus(rawStatus, proposal) {
        assert.deepEqual(rawStatus, familyParityStatus);
        return syntheticDecisionInputs(familyParityStatus).decision_conditional_family_status;
      },
    };
    delete require.cache[CERTIFICATION_CONTROL_PATH];
    delete require.cache[CERTIFICATION_CONTROL_V2_PATH];
    const { buildM3CertificationControlPlanV2: syntheticBuild } = require(CERTIFICATION_CONTROL_V2_PATH);
    return syntheticBuild({
      candidate_set_id: 'candidate-set-1',
      source_scope_certification_set_id: 'source-scope-set-1',
      candidates: [candidate()],
      family_parity_status: familyParityStatus,
      known_defect_registry: EMPTY_REGISTRY,
      sampling_seed: 'm3-v2-fixed-seed',
      ...overrides,
    });
  } finally {
    cachedDecision.exports = originalDecisionExports;
    if (cachedControl) require.cache[CERTIFICATION_CONTROL_PATH] = cachedControl;
    else delete require.cache[CERTIFICATION_CONTROL_PATH];
    if (cachedControlV2) require.cache[CERTIFICATION_CONTROL_V2_PATH] = cachedControlV2;
    else delete require.cache[CERTIFICATION_CONTROL_V2_PATH];
  }
}

function assertSyntheticControlError(code) {
  return (error) => error?.name === 'M3CertificationControlError' && error.code === code;
}

function assertControlError(code) {
  return (error) => error instanceof M3CertificationControlError && error.code === code;
}

test('V2 records the real serving block before it tests downstream fences', () => {
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.state, 'BLOCKED');
  // 104 after two movements on 2026-08-05 that happen to cancel out (see
  // tests/canonical-v2-parity-serving-path.test.js for the detail), then 103 the same day:
  // termination-fee-query-fields' dead CompareSectionColumn locator was repointed to the
  // component it actually renders through, UnifiedCompareSection, with a real served
  // consumer named (docs/codex-program/notes/compare-locator-fix.md). Then 102 on 2026-08-06
  // (docs/codex-program/notes/serving-path-proof.md): termination-fee-rendered-rows' real
  // consumer (sectionList.js) was named AND it now carries server_stamped_field evidence
  // proving the HTTP-boundary crossing to canonical_v2_termination_fee_cards -- see
  // tests/canonical-v2-parity-serving-boundary.test.js. Do not read any movement as nothing
  // having happened.
  assert.equal(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length, 102);
  // 2, not 6: the owner approved the four retained no-shop concepts
  // (2026-08-05), promoting NOSOL-CEASE/RECOMMEND/ENFORCE/WAIVER out of
  // review hold into the NO_SHOP family's product_surfaces. Only the two
  // permanently-bounded NOSOL-SUPERIOR/NOSOL-INTERVENING claims remain.
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.review_hold_ids.length, 2);
  assert.throws(() => build({
    family_parity_status: CURRENT_M3_FAMILY_PARITY_STATUS,
  }), assertControlError('INCOMPLETE_FAMILY_PARITY'));
});

test('V2 cannot wrap synthetic FAMILY_COMPLETE into a certification plan', () => {
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
  const decisionInputs = syntheticDecisionInputs(syntheticCompleteParityStatus());
  assert.throws(() => buildWithSyntheticParityBinding({
    ...decisionInputs,
  }), (error) => (
    error?.name === 'M3CertificationControlError'
      && error.code === 'DECISION_RECONCILIATION_BLOCKED'
      && error.details.blocking_unresolved_decision_ids.length === 0
      && error.details.decision_register_freeze_ready === false
      && error.details.decision_register_freeze_authority === 'NONE'
      && error.details.family_completion_blocker_codes.includes('RECORDED_RULING_IMPLEMENTATION_GAPS')
  ));
});

test('V2 does not accept a raw status in place of its decision-conditional status', () => {
  const decisionInputs = syntheticDecisionInputs(syntheticCompleteParityStatus());
  assert.throws(() => buildWithSyntheticParityBinding({
    decision_reconciliation_proposal: decisionInputs.decision_reconciliation_proposal,
    decision_conditional_family_status: CURRENT_M3_FAMILY_PARITY_STATUS,
  }), assertSyntheticControlError('DECISION_CONDITIONAL_FAMILY_STATUS_INVALID'));
});
