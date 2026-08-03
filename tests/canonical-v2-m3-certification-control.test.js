'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EMPTY_REGISTRY,
  buildKnownDefectRegistry,
} = require('../lib/canonical-v2/native-producer/known-defect-registry');
const {
  M3CertificationControlError,
  buildM3CertificationControlPlan,
  buildM3FailureResponse,
} = require('../lib/canonical-v2/native-producer/m3-certification-control');
const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  CURRENT_M3_FAMILY_PARITY_STATUS,
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

function plan(candidates, registry = EMPTY_REGISTRY) {
  return buildM3CertificationControlPlan({
    candidate_set_id: 'candidate-set-1',
    candidates,
    family_parity_status: COMPLETE_PARITY_STATUS,
    known_defect_registry: registry,
    sampling_seed: 'm3-fixed-seed-2026-08-03',
  });
}

test('current Wave A and follow-on gaps block M3 certification', () => {
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.state, 'BLOCKED');
  assert.throws(() => buildM3CertificationControlPlan({
    candidate_set_id: 'candidate-set-1',
    candidates: [candidate('blocked')],
    family_parity_status: CURRENT_M3_FAMILY_PARITY_STATUS,
    known_defect_registry: EMPTY_REGISTRY,
    sampling_seed: 'm3-fixed-seed-2026-08-03',
  }), (error) => (
    error instanceof M3CertificationControlError
      && error.code === 'INCOMPLETE_FAMILY_PARITY'
      && error.details.incomplete_families.length === 18
      && error.details.incomplete_families.includes('ANTITRUST_REGULATORY_EFFORTS')
      && !error.details.incomplete_families.includes('NO_SHOP')
      && !error.details.incomplete_families.includes('MAE_DEFINITION')
      && !error.details.incomplete_families.includes('PROXY_MEETING_COVENANTS')
      && error.details.incomplete_supplemental_owners.length === 0
      && error.details.unassigned_product_surfaces.length === 0
  ));
});

test('fixed seed produces a stable blind sample that covers every eligible stratum', () => {
  const candidates = [
    candidate('a', { deal: 'topbuild', family: 'REP-T-CAP', input_path: 'NATIVE', normalisation_type: 'ENUM' }),
    candidate('b', { deal: 'skechers', family: 'REP-T-CAP', input_path: 'LEGACY_DERIVED', normalisation_type: 'ENUM' }),
    candidate('c', { deal: 'skechers', family: 'TERMF-TARGET', input_path: 'NATIVE', normalisation_type: 'PERCENT' }),
    candidate('d', { deal: 'modiv', family: 'TERMF-TARGET', input_path: 'LEGACY_DERIVED', normalisation_type: 'PERCENT' }),
  ];
  const first = plan(candidates);
  const second = plan([...candidates].reverse());

  assert.equal(first.m3_certification_control_plan_id, second.m3_certification_control_plan_id);
  assert.deepEqual(first.blind_sample, second.blind_sample);
  assert.equal(first.blind_sample.length, 4, 'minimum per stratum dominates the flat 2% target');
  for (const dimension of ['deal', 'family', 'state', 'input_path', 'normalisation_type']) {
    assert.deepEqual(
      [...new Set(first.blind_sample.map((entry) => entry[dimension]))].sort(),
      [...new Set(candidates.map((entry) => entry[dimension]))].sort(),
    );
  }
});

test('known defects and non-eligible candidates bypass the blind sample into materiality-ranked review', () => {
  const registry = buildKnownDefectRegistry({
    version: 2,
    entries: [{
      deal: 'skechers', family: 'REP-T-CAP', attribute: '*', extraction_mechanism: 'semantic-producer/v1',
      pattern_description: 'sampled defect', date_added: '2026-08-03',
    }],
  });
  const result = plan([
    candidate('eligible', { materiality_rank: 50 }),
    candidate('defect', { deal: 'skechers', materiality_rank: 20 }),
    candidate('queue', { auto_pass_eligible: false, materiality_rank: 5 }),
  ], registry);

  assert.deepEqual(result.mandatory_review.map((entry) => [entry.candidate_id, entry.reason]), [
    ['queue', 'AUTO_PASS_INELIGIBLE'],
    ['defect', 'KNOWN_DEFECT_MATCH'],
  ]);
  assert.deepEqual(result.blind_sample.map((entry) => entry.candidate_id), ['eligible']);
});

test('sample errors add a scoped known defect and reprocess the full deal-family and mechanism groups', () => {
  const result = plan([
    candidate('a'),
    candidate('b', { family: 'TERMF-TARGET' }),
    candidate('c', { deal: 'skechers', family: 'REP-T-CAP', extraction_mechanism: 'other-producer/v2' }),
    candidate('d', { extraction_mechanism: 'other-producer/v2' }),
  ]);
  const findings = result.blind_sample.map((entry) => entry.candidate_id === 'a'
    ? {
      candidate_id: 'a',
      outcome: 'CONFIRMED_ERROR',
      defect_entry: {
        deal: 'topbuild', family: 'REP-T-CAP', attribute: 'REPRESENTATION_ACCURACY_STANDARD',
        extraction_mechanism: 'semantic-producer/v1', pattern_description: 'incorrect accuracy normalisation', date_added: '2026-08-03',
      },
    }
    : { candidate_id: entry.candidate_id, outcome: 'CONFIRMED_CORRECT' });
  const response = buildM3FailureResponse({
    plan: result,
    findings,
    known_defect_registry: EMPTY_REGISTRY,
    current_candidate_set_id: 'candidate-set-1',
    next_registry_version: 2,
  });

  assert.equal(response.confirmed_error_count, 1);
  assert.equal(response.updated_known_defect_registry.entries.length, 1);
  assert.deepEqual(response.reprocess_groups, [
    { group_type: 'DEAL_FAMILY', scope: { deal: 'topbuild', family: 'REP-T-CAP' }, candidate_ids: ['a', 'd'] },
    { group_type: 'EXTRACTION_MECHANISM', scope: { extraction_mechanism: 'semantic-producer/v1' }, candidate_ids: ['a', 'b'] },
  ]);
});

test('failure response identity is stable across finding order and records every reviewed outcome', () => {
  const result = plan([candidate('a'), candidate('b', { deal: 'skechers' })]);
  const findings = result.blind_sample.map((entry) => ({
    candidate_id: entry.candidate_id,
    outcome: 'CONFIRMED_ERROR',
    defect_entry: {
      deal: entry.deal,
      family: entry.family,
      attribute: entry.attribute,
      extraction_mechanism: 'semantic-producer/v1',
      pattern_description: `sampled defect ${entry.candidate_id}`,
      date_added: '2026-08-03',
    },
  }));
  const first = buildM3FailureResponse({
    plan: result, findings, known_defect_registry: EMPTY_REGISTRY,
    current_candidate_set_id: 'candidate-set-1', next_registry_version: 2,
  });
  const second = buildM3FailureResponse({
    plan: result, findings: [...findings].reverse(), known_defect_registry: EMPTY_REGISTRY,
    current_candidate_set_id: 'candidate-set-1', next_registry_version: 2,
  });

  assert.equal(first.m3_failure_response_id, second.m3_failure_response_id);
  assert.equal(first.updated_known_defect_registry_id, second.updated_known_defect_registry_id);
  assert.deepEqual(first.reviewed_findings.map((finding) => finding.candidate_id), ['a', 'b']);
});

test('a sampled defect may use any registry wildcard when its scope still includes the candidate', () => {
  const result = plan([
    candidate('a'),
    candidate('b', { deal: 'skechers', extraction_mechanism: 'other-producer/v2' }),
  ]);
  const response = buildM3FailureResponse({
    plan: result,
    findings: result.blind_sample.map((entry) => entry.candidate_id === 'a'
      ? {
        candidate_id: 'a',
        outcome: 'CONFIRMED_ERROR',
        defect_entry: {
          deal: '*', family: '*', attribute: '*', extraction_mechanism: '*',
          pattern_description: 'corpus-wide defect', date_added: '2026-08-03',
        },
      }
      : { candidate_id: entry.candidate_id, outcome: 'CONFIRMED_CORRECT' }),
    known_defect_registry: EMPTY_REGISTRY,
    current_candidate_set_id: 'candidate-set-1',
    next_registry_version: 2,
  });

  assert.equal(response.updated_known_defect_registry.entries[0].deal, '*');
  assert.equal(response.updated_known_defect_registry.entries[0].family, '*');
  assert.deepEqual(response.reprocess_groups, [
    { group_type: 'DEAL_FAMILY', scope: { deal: 'skechers', family: 'REP-T-CAP' }, candidate_ids: ['b'] },
    { group_type: 'DEAL_FAMILY', scope: { deal: 'topbuild', family: 'REP-T-CAP' }, candidate_ids: ['a'] },
    { group_type: 'EXTRACTION_MECHANISM', scope: { extraction_mechanism: 'other-producer/v2' }, candidate_ids: ['b'] },
    { group_type: 'EXTRACTION_MECHANISM', scope: { extraction_mechanism: 'semantic-producer/v1' }, candidate_ids: ['a'] },
  ]);
});

test('failure response refuses incomplete or unselected sample findings', () => {
  const result = plan([candidate('a'), candidate('b', { deal: 'skechers' })]);
  assert.throws(() => buildM3FailureResponse({
    plan: result,
    findings: [{ candidate_id: result.blind_sample[0].candidate_id, outcome: 'CONFIRMED_CORRECT' }],
    known_defect_registry: EMPTY_REGISTRY,
    current_candidate_set_id: 'candidate-set-1',
    next_registry_version: 2,
  }), (error) => error instanceof M3CertificationControlError && error.code === 'INCOMPLETE_SAMPLE_REVIEW');
  assert.throws(() => buildM3FailureResponse({
    plan: result,
    findings: [{ candidate_id: 'not-sampled', outcome: 'CONFIRMED_CORRECT' }],
    known_defect_registry: EMPTY_REGISTRY,
    current_candidate_set_id: 'candidate-set-1',
    next_registry_version: 2,
  }), (error) => error instanceof M3CertificationControlError && error.code === 'UNSAMPLED_FINDING');
});

test('failure response refuses a plan from an earlier candidate set', () => {
  const result = plan([candidate('a')]);
  assert.throws(() => buildM3FailureResponse({
    plan: result,
    findings: [{ candidate_id: 'a', outcome: 'CONFIRMED_CORRECT' }],
    known_defect_registry: EMPTY_REGISTRY,
    current_candidate_set_id: 'candidate-set-2',
    next_registry_version: 2,
  }), (error) => error instanceof M3CertificationControlError && error.code === 'STALE_OR_TAMPERED_PLAN');
});

test('failure response refuses a plan bound to a different defect registry', () => {
  const result = plan([candidate('a')]);
  const changedRegistry = buildKnownDefectRegistry({
    version: 2,
    entries: [{
      deal: 'other', family: '*', attribute: '*', extraction_mechanism: '*',
      pattern_description: 'newly discovered separate defect', date_added: '2026-08-03',
    }],
  });
  assert.throws(() => buildM3FailureResponse({
    plan: result,
    findings: [{ candidate_id: result.blind_sample[0].candidate_id, outcome: 'CONFIRMED_CORRECT' }],
    known_defect_registry: changedRegistry,
    current_candidate_set_id: 'candidate-set-1',
    next_registry_version: 3,
  }), (error) => error instanceof M3CertificationControlError && error.code === 'STALE_OR_TAMPERED_PLAN');
});

test('an auto-pass candidate cannot be a negative conclusion', () => {
  assert.throws(() => plan([candidate('negative', { state: 'ABSENT' })]),
    (error) => error instanceof M3CertificationControlError && error.code === 'INVALID_AUTO_PASS_CANDIDATE');
});
