'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EMPTY_REGISTRY,
  buildKnownDefectRegistry,
} = require('../lib/canonical-v2/native-producer/known-defect-registry');
const {
  M3CertificationControlV2Error,
  buildM3CertificationControlPlanV2,
  buildM3CertificationFailureResponseV2,
} = require('../lib/canonical-v2/native-producer/m3-certification-control-v2');
const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  buildM3FamilyParityStatus,
} = require('../lib/canonical-v2/native-producer/m3-family-parity-register');

function completeParityStatus() {
  const register = structuredClone(CURRENT_M3_FAMILY_PARITY_REGISTER);
  register.unassigned_product_surfaces = [];
  for (const family of register.families) {
    for (const check of Object.values(family.wave_a.checks)) {
      check.state = 'PASS';
      check.evidence_paths = [family.design_path];
    }
    for (const surface of family.product_surfaces) {
      surface.state = 'PASS';
      surface.disposition = 'NATIVE_COMPLETE';
      surface.evidence_paths = [surface.source_path];
    }
  }
  for (const owner of register.supplemental_owners) {
    owner.first_slice.state = 'PASS';
    for (const surface of owner.product_surfaces) {
      surface.state = 'PASS';
      surface.disposition = 'NATIVE_COMPLETE';
      surface.evidence_paths = [surface.source_path];
    }
  }
  return buildM3FamilyParityStatus(register);
}

const COMPLETE_PARITY_STATUS = completeParityStatus();

function candidate(id, overrides = {}) {
  return {
    candidate_id: id,
    deal: 'topbuild',
    family: 'REP-T-CAP',
    attribute: 'REPRESENTATION_ACCURACY_STANDARD',
    state: 'PRESENT',
    input_path: 'NATIVE',
    normalisation_type: 'ENUM',
    extraction_mechanism: 'semantic-producer/v1',
    auto_pass_eligible: true,
    materiality_rank: 10,
    ...overrides,
  };
}

function plan(candidates, registry = EMPTY_REGISTRY, overrides = {}) {
  return buildM3CertificationControlPlanV2({
    candidate_set_id: 'candidate-set-1',
    source_scope_certification_set_id: 'source-scope-set-1',
    candidates,
    family_parity_status: COMPLETE_PARITY_STATUS,
    known_defect_registry: registry,
    sampling_seed: 'm3-v2-fixed-seed',
    ...overrides,
  });
}

function correctFindings(controlPlan) {
  return controlPlan.required_review_ids.map((candidate_id) => ({ candidate_id, outcome: 'CONFIRMED_CORRECT' }));
}

function respond(controlPlan, findings, registry = EMPTY_REGISTRY, overrides = {}) {
  return buildM3CertificationFailureResponseV2({
    plan: controlPlan,
    findings,
    known_defect_registry: registry,
    current_candidate_set_id: 'candidate-set-1',
    current_source_scope_certification_set_id: 'source-scope-set-1',
    next_registry_version: registry.version + 1,
    ...overrides,
  });
}

test('all-mandatory zero-sample cohort requires complete mandatory findings and can certify', () => {
  const controlPlan = plan([
    candidate('mandatory-b', { auto_pass_eligible: false, materiality_rank: 20 }),
    candidate('mandatory-a', { auto_pass_eligible: false, materiality_rank: 10 }),
  ]);

  assert.deepEqual(controlPlan.blind_sample, []);
  assert.deepEqual(controlPlan.required_review_ids, ['mandatory-a', 'mandatory-b']);
  const response = respond(controlPlan, correctFindings(controlPlan));
  assert.equal(response.certification_admissible, true);
  assert.deepEqual(response.reviewed_counts, {
    required_review_count: 2,
    reviewed_count: 2,
    mandatory_review_count: 2,
    reviewed_mandatory_count: 2,
    blind_sample_count: 0,
    reviewed_blind_sample_count: 0,
    confirmed_correct_count: 2,
    confirmed_error_count: 0,
  });
  assert.ok(response.reviewed_findings.every((finding) => finding.selection === 'MANDATORY_REVIEW'));
  assert.ok(response.reviewed_findings.every(Object.isFrozen));
});

test('mixed cohorts preserve mandatory and blind selections in the required-review union', () => {
  const registry = buildKnownDefectRegistry({
    version: 2,
    entries: [{
      deal: 'skechers', family: 'REP-T-CAP', attribute: '*', extraction_mechanism: 'semantic-producer/v1',
      pattern_description: 'known defect', date_added: '2026-08-03',
    }],
  });
  const controlPlan = plan([
    candidate('eligible', { materiality_rank: 30 }),
    candidate('known-defect', { deal: 'skechers', materiality_rank: 5 }),
    candidate('not-eligible', { auto_pass_eligible: false, materiality_rank: 1 }),
  ], registry);

  assert.deepEqual(controlPlan.mandatory_review.map((entry) => entry.candidate_id), ['not-eligible', 'known-defect']);
  assert.deepEqual(controlPlan.blind_sample.map((entry) => entry.candidate_id), ['eligible']);
  assert.deepEqual(controlPlan.required_review_ids, ['eligible', 'known-defect', 'not-eligible']);
  const response = respond(controlPlan, correctFindings(controlPlan), registry);
  assert.deepEqual(response.reviewed_findings.map((finding) => [finding.candidate_id, finding.selection]), [
    ['eligible', 'BLIND_SAMPLE'],
    ['known-defect', 'MANDATORY_REVIEW'],
    ['not-eligible', 'MANDATORY_REVIEW'],
  ]);
});

test('an error blocks certification and returns exact deal-family and extraction-mechanism groups', () => {
  const controlPlan = plan([
    candidate('a', { auto_pass_eligible: false }),
    candidate('b', { family: 'TERMF-TARGET' }),
    candidate('c', { deal: 'skechers', extraction_mechanism: 'other-producer/v2' }),
    candidate('d', { extraction_mechanism: 'other-producer/v2' }),
  ]);
  const findings = correctFindings(controlPlan).map((finding) => (
    finding.candidate_id === 'a'
      ? {
        candidate_id: 'a',
        outcome: 'CONFIRMED_ERROR',
        defect_entry: {
          deal: 'topbuild', family: 'REP-T-CAP', attribute: 'REPRESENTATION_ACCURACY_STANDARD',
          extraction_mechanism: 'semantic-producer/v1', pattern_description: 'incorrect normalisation', date_added: '2026-08-03',
        },
      }
      : finding
  ));
  const response = respond(controlPlan, findings);

  assert.equal(response.certification_admissible, false);
  assert.equal(response.reviewed_counts.confirmed_error_count, 1);
  assert.deepEqual(response.reprocess_groups, [
    { group_type: 'DEAL_FAMILY', scope: { deal: 'topbuild', family: 'REP-T-CAP' }, candidate_ids: ['a', 'd'] },
    { group_type: 'EXTRACTION_MECHANISM', scope: { extraction_mechanism: 'semantic-producer/v1' }, candidate_ids: ['a', 'b'] },
  ]);
});

test('response rejects empty, duplicate, omitted and unselected findings', () => {
  const controlPlan = plan([candidate('a'), candidate('b', { auto_pass_eligible: false })]);
  assert.throws(() => respond(controlPlan, []), (error) => (
    error instanceof M3CertificationControlV2Error && error.code === 'EMPTY_REVIEW_FINDINGS'
  ));
  assert.throws(() => respond(controlPlan, [
    { candidate_id: 'a', outcome: 'CONFIRMED_CORRECT' },
    { candidate_id: 'a', outcome: 'CONFIRMED_CORRECT' },
  ]), (error) => error instanceof M3CertificationControlV2Error && error.code === 'DUPLICATE_FINDING');
  assert.throws(() => respond(controlPlan, [{ candidate_id: 'a', outcome: 'CONFIRMED_CORRECT' }]), (error) => (
    error instanceof M3CertificationControlV2Error && error.code === 'OMITTED_REQUIRED_FINDING'
  ));
  assert.throws(() => respond(controlPlan, [
    ...correctFindings(controlPlan),
    { candidate_id: 'unselected', outcome: 'CONFIRMED_CORRECT' },
  ]), (error) => error instanceof M3CertificationControlV2Error && error.code === 'UNSELECTED_FINDING');
});

test('candidate set, source scope and registry changes make a V2 plan stale', () => {
  const controlPlan = plan([candidate('a')]);
  assert.throws(() => respond(controlPlan, correctFindings(controlPlan), EMPTY_REGISTRY, {
    current_candidate_set_id: 'candidate-set-2',
  }), (error) => error instanceof M3CertificationControlV2Error && error.code === 'STALE_OR_TAMPERED_PLAN');
  assert.throws(() => respond(controlPlan, correctFindings(controlPlan), EMPTY_REGISTRY, {
    current_source_scope_certification_set_id: 'source-scope-set-2',
  }), (error) => error instanceof M3CertificationControlV2Error && error.code === 'STALE_OR_TAMPERED_PLAN');
  const changedRegistry = buildKnownDefectRegistry({
    version: 2,
    entries: [{
      deal: 'other', family: '*', attribute: '*', extraction_mechanism: '*',
      pattern_description: 'new defect', date_added: '2026-08-03',
    }],
  });
  assert.throws(() => respond(controlPlan, correctFindings(controlPlan), changedRegistry), (error) => (
    error instanceof M3CertificationControlV2Error && error.code === 'STALE_OR_TAMPERED_PLAN'
  ));
});

test('plan and response identities are invariant under candidate and finding permutation', () => {
  const candidates = [
    candidate('a'),
    candidate('b', { deal: 'skechers' }),
    candidate('c', { auto_pass_eligible: false }),
  ];
  const firstPlan = plan(candidates);
  const secondPlan = plan([...candidates].reverse());
  assert.equal(firstPlan.m3_certification_control_plan_id, secondPlan.m3_certification_control_plan_id);
  const findings = correctFindings(firstPlan);
  const first = respond(firstPlan, findings);
  const second = respond(firstPlan, [...findings].reverse());
  assert.equal(first.m3_certification_failure_response_id, second.m3_certification_failure_response_id);
  assert.deepEqual(first.reviewed_findings, second.reviewed_findings);
});
