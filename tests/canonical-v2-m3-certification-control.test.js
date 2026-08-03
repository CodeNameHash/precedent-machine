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
    known_defect_registry: registry,
    sampling_seed: 'm3-fixed-seed-2026-08-03',
  });
}

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
    next_registry_version: 2,
  });

  assert.equal(response.confirmed_error_count, 1);
  assert.equal(response.updated_known_defect_registry.entries.length, 1);
  assert.deepEqual(response.reprocess_groups, [
    { group_type: 'DEAL_FAMILY', scope: { deal: 'topbuild', family: 'REP-T-CAP' }, candidate_ids: ['a'] },
    { group_type: 'EXTRACTION_MECHANISM', scope: { extraction_mechanism: 'semantic-producer/v1' }, candidate_ids: ['a', 'b'] },
  ]);
});

test('failure response refuses incomplete or unselected sample findings', () => {
  const result = plan([candidate('a'), candidate('b', { deal: 'skechers' })]);
  assert.throws(() => buildM3FailureResponse({
    plan: result,
    findings: [{ candidate_id: result.blind_sample[0].candidate_id, outcome: 'CONFIRMED_CORRECT' }],
    known_defect_registry: EMPTY_REGISTRY,
    next_registry_version: 2,
  }), (error) => error instanceof M3CertificationControlError && error.code === 'INCOMPLETE_SAMPLE_REVIEW');
  assert.throws(() => buildM3FailureResponse({
    plan: result,
    findings: [{ candidate_id: 'not-sampled', outcome: 'CONFIRMED_CORRECT' }],
    known_defect_registry: EMPTY_REGISTRY,
    next_registry_version: 2,
  }), (error) => error instanceof M3CertificationControlError && error.code === 'UNSAMPLED_FINDING');
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
    next_registry_version: 3,
  }), (error) => error instanceof M3CertificationControlError && error.code === 'STALE_OR_TAMPERED_PLAN');
});

test('an auto-pass candidate cannot be a negative conclusion', () => {
  assert.throws(() => plan([candidate('negative', { state: 'ABSENT' })]),
    (error) => error instanceof M3CertificationControlError && error.code === 'INVALID_AUTO_PASS_CANDIDATE');
});
