'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

const {
  CalibrationHarnessError,
  CALIBRATION_SCHEMA,
  buildAnchorSet,
  buildCalibration,
  buildCalibrationHarnessReport,
  buildJointConfirmation,
} = require('../lib/canonical-v2/calibration-harness');

function error(code, action) {
  assert.throws(action, (value) => value instanceof CalibrationHarnessError && value.code === code);
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function strata() {
  return { by_family: { FAMILY_A: 30, FAMILY_B: 30 }, by_error_class: { MATERIALITY_CODE: 1, OTHER: 58, PARTY_ATTRIBUTION: 1 } };
}

function anchors() {
  return Array.from({ length: 60 }, (_, index) => {
    const hard = index === 0 ? 'PARTY_ATTRIBUTION' : index === 1 ? 'MATERIALITY_CODE' : 'OTHER';
    return {
      anchor_id: `anchor-${index}`, family_id: index % 2 ? 'FAMILY_A' : 'FAMILY_B', error_class: hard,
      evidence: { source_id: `source-${index}`, source_digest: digest(`source-${index}`), evidence_id: `evidence-${index}`, evidence_digest: digest(`evidence-${index}`) },
      human_verdict: index < 2 ? 'ERROR' : 'CORRECT', seeded_wrong: index < 2,
    };
  });
}

function calibration(overrides = {}) {
  const anchor_set = buildAnchorSet({ anchors: anchors(), strata: strata() });
  const anchor_verdicts = anchor_set.anchors.map((anchor) => ({ anchor_id: anchor.anchor_id, verdict: anchor.human_verdict }));
  const adjudicators = ['a', 'b', 'c'].map((adjudicator_id, index) => ({
    adjudicator_id, vendor: index === 1 ? 'VENDOR_B' : 'VENDOR_A', requested_model_digest: digest(`model-${adjudicator_id}`),
    rubric_digest: digest(`rubric-${adjudicator_id}`), anchor_verdicts,
  }));
  return buildCalibration({ anchor_set, adjudicators, floors: { precision: 0.9, recall: 0.9, seeded_detection_rate: 1 }, ...overrides });
}

const catalogue = { families: ['FAMILY_A', 'FAMILY_B'], mechanisms: [{ mechanism_id: 'CONTEXT', rungs: [0, 1, 2] }] };

function claim(id, rung, population, verdict = 'CORRECT', error_class = 'OTHER', options = {}) {
  const verdicts = ['a', 'b', 'c'].map((adjudicator_id) => ({ adjudicator_id, verdict, ...(verdict === 'ERROR' ? { error_class } : {}) }));
  return {
    claim_id: id, family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', rung, population,
    evidence: { source_id: `source-${id}`, source_digest: digest(`source-${id}`), evidence_id: `evidence-${id}`, evidence_digest: digest(`evidence-${id}`) },
    verdicts, ...options,
  };
}

function input(overrides = {}) {
  const claims = [
    claim('base-new', 0, 'NEWLY_PUBLISHED'), claim('base-existing', 0, 'EXISTING_PUBLISHED'),
    claim('selected-new', 1, 'NEWLY_PUBLISHED'), claim('selected-existing', 1, 'EXISTING_PUBLISHED'),
    claim('marginal-new', 2, 'NEWLY_PUBLISHED'),
  ];
  const sampling = claims.map((entry) => ({
    family_id: entry.family_id, mechanism_id: entry.mechanism_id, rung: entry.rung, population: entry.population,
    population_role: entry.rung === 0 ? 'BASELINE' : entry.rung === 1 ? 'SELECTED' : 'MARGINAL_INCREMENT',
    denominator: 1, sample_size: 1, mode: 'CENSUS',
  }));
  return {
    catalogue, calibration: calibration(), claims, sampling,
    confidence_interval: { method: 'WILSON', confidence_level: 0.95 },
    joint_confirmation: buildJointConfirmation({
      selected_rungs: [{ family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', rung: 1 }],
      leave_one_out: [{ family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', selected_rung: 1, omitted_mechanism_id: 'CONTEXT', result: 'PASS' }],
    }),
    ...overrides,
  };
}

test('returns immutable per-tuple metrics and a valid joint measurement only', () => {
  const result = buildCalibrationHarnessReport(input());
  assert.equal(result.publication_authorisation, 'NONE');
  assert.equal(result.selected_rung_results[0].pass, true);
  assert.equal(result.tuple_reports.length, 5);
  assert.equal(result.tuple_reports[0].metrics.confidence_interval.method, 'WILSON');
  assert.equal(result.tuple_reports[0].sampling.mode, 'CENSUS');
  assert.ok(Object.isFrozen(result));
  assert.throws(() => { result.tuple_reports.push({}); }, TypeError);
});

test('fails closed for anchor size, declared strata, seeded hard errors, and bound human evidence', () => {
  error('ANCHOR_SET_INVALID', () => buildAnchorSet({ anchors: anchors().slice(0, 59), strata: strata() }));
  const noSeed = anchors(); noSeed[0].seeded_wrong = false;
  error('ANCHOR_SET_INVALID', () => buildAnchorSet({ anchors: noSeed, strata: strata() }));
  const noEvidence = anchors(); delete noEvidence[2].evidence.source_digest;
  error('INVALID_INPUT', () => buildAnchorSet({ anchors: noEvidence, strata: strata() }));
  const noHumanVerdict = anchors(); delete noHumanVerdict[2].human_verdict;
  error('ANCHOR_SET_INVALID', () => buildAnchorSet({ anchors: noHumanVerdict, strata: strata() }));
  const wrongStrata = strata(); wrongStrata.by_family.FAMILY_A = 29;
  error('ANCHOR_SET_INVALID', () => buildAnchorSet({ anchors: anchors(), strata: wrongStrata }));
});

test('fails closed for other-than-three, one-vendor, or below-floor adjudicators', () => {
  const anchor_set = buildAnchorSet({ anchors: anchors(), strata: strata() });
  const verdicts = anchor_set.anchors.map((anchor) => ({ anchor_id: anchor.anchor_id, verdict: anchor.human_verdict }));
  const adjudicator = (id, vendor) => ({ adjudicator_id: id, vendor, requested_model_digest: digest(`model-${id}`), rubric_digest: digest(`rubric-${id}`), anchor_verdicts: verdicts });
  error('UNCALIBRATED_ADJUDICATOR', () => buildCalibration({ anchor_set, floors: { precision: 0.9, recall: 0.9, seeded_detection_rate: 1 }, adjudicators: [adjudicator('a', 'x')] }));
  error('UNCALIBRATED_ADJUDICATOR', () => buildCalibration({ anchor_set, floors: { precision: 0.9, recall: 0.9, seeded_detection_rate: 1 }, adjudicators: ['a', 'b', 'c', 'd'].map((id) => adjudicator(id, 'x')) }));
  error('UNCALIBRATED_ADJUDICATOR', () => buildCalibration({ anchor_set, floors: { precision: 0.9, recall: 0.9, seeded_detection_rate: 1 }, adjudicators: ['a', 'b', 'c'].map((id) => adjudicator(id, 'x')) }));
  const poorAnchorSet = buildAnchorSet({ anchors: anchors(), strata: strata() });
  const poorVerdicts = poorAnchorSet.anchors.map((anchor) => ({ anchor_id: anchor.anchor_id, verdict: anchor.anchor_id === 'anchor-0' ? 'CORRECT' : anchor.human_verdict }));
  const poor = buildCalibration({ anchor_set: poorAnchorSet, floors: { precision: 1, recall: 1, seeded_detection_rate: 1 }, adjudicators: ['a', 'b', 'c'].map((id, index) => ({ adjudicator_id: id, vendor: index === 1 ? 'VENDOR_B' : 'VENDOR_A', requested_model_digest: digest(`poor-model-${id}`), rubric_digest: digest(`poor-rubric-${id}`), anchor_verdicts: poorVerdicts })) });
  const data = input({ calibration: poor });
  data.claims[0].verdicts[0].adjudicator_id = 'a';
  error('UNCALIBRATED_ADJUDICATOR', () => buildCalibrationHarnessReport(data));
});

test('recomputes adjudicator scores from the exact bound anchor set', () => {
  const data = input();
  const forged = JSON.parse(JSON.stringify(data.calibration));
  forged.adjudicators[0].anchor_metrics.precision = 0;
  const body = { ...forged };
  delete body.calibration_id;
  forged.calibration_id = contentId(CALIBRATION_SCHEMA, body);
  data.calibration = forged;
  error('UNCALIBRATED_ADJUDICATOR', () => buildCalibrationHarnessReport(data));
});

test('fails closed for unknown tuple, missing baseline, and non-fixed confidence intervals', () => {
  const unknown = input(); unknown.claims[0].family_id = 'UNKNOWN';
  error('UNKNOWN_TUPLE', () => buildCalibrationHarnessReport(unknown));
  const mechanism = input(); mechanism.claims[0].mechanism_id = 'UNKNOWN';
  error('UNKNOWN_TUPLE', () => buildCalibrationHarnessReport(mechanism));
  const rung = input(); rung.claims[0].rung = 99;
  error('UNKNOWN_TUPLE', () => buildCalibrationHarnessReport(rung));
  const baseline = input(); baseline.claims = baseline.claims.filter((entry) => entry.claim_id !== 'base-existing'); baseline.sampling = baseline.sampling.filter((entry) => !(entry.rung === 0 && entry.population === 'EXISTING_PUBLISHED'));
  error('MISSING_BASELINE', () => buildCalibrationHarnessReport(baseline));
  const interval = input(); delete interval.confidence_interval;
  error('CONFIDENCE_INTERVAL_REQUIRED', () => buildCalibrationHarnessReport(interval));
  const wrongMethod = input(); wrongMethod.confidence_interval.method = 'BETA';
  error('CONFIDENCE_INTERVAL_REQUIRED', () => buildCalibrationHarnessReport(wrongMethod));
  const wrongLevel = input(); wrongLevel.confidence_interval.confidence_level = 0.9;
  error('CONFIDENCE_INTERVAL_REQUIRED', () => buildCalibrationHarnessReport(wrongLevel));
});

test('fails closed for duplicate verdicts, missing hard-error confirmation and incomplete census', () => {
  const duplicate = input(); duplicate.claims[0].verdicts[2].adjudicator_id = 'b';
  error('DUPLICATE_VERDICT', () => buildCalibrationHarnessReport(duplicate));
  const incomplete = input(); incomplete.claims[0].verdicts.pop();
  error('ADJUDICATION_INVALID', () => buildCalibrationHarnessReport(incomplete));
  const confirmation = input(); confirmation.claims[2] = claim('selected-new', 1, 'NEWLY_PUBLISHED', 'ERROR', 'PARTY_ATTRIBUTION');
  error('HUMAN_CONFIRMATION_REQUIRED', () => buildCalibrationHarnessReport(confirmation));
  const census = input(); census.sampling.find((entry) => entry.rung === 1 && entry.population === 'NEWLY_PUBLISHED').mode = 'SAMPLE';
  error('INCOMPLETE_CENSUS', () => buildCalibrationHarnessReport(census));
});

test('requires evidence-bound hard-error confirmation', () => {
  const confirmed = input();
  confirmed.claims[2] = claim('selected-new', 1, 'NEWLY_PUBLISHED', 'ERROR', 'PARTY_ATTRIBUTION', { human_confirmation: { status: 'CONFIRMED_ERROR', error_class: 'PARTY_ATTRIBUTION', human_id: 'ben', evidence_digest: digest('wrong') } });
  error('HUMAN_CONFIRMATION_REQUIRED', () => buildCalibrationHarnessReport(confirmed));
});

test('accepts declared samples at 150 or more only with size and detectable effect', () => {
  const data = input();
  const selected = data.sampling.find((entry) => entry.rung === 1 && entry.population === 'NEWLY_PUBLISHED');
  selected.denominator = 150; selected.mode = 'SAMPLE'; selected.detectable_effect = 0.05;
  const report = buildCalibrationHarnessReport(data);
  assert.equal(report.selected_rung_results[0].pass, true);
  delete selected.detectable_effect;
  error('INCOMPLETE_CENSUS', () => buildCalibrationHarnessReport(data));
});

test('marginal precision wins over aggregate precision and individual sweeps do not authorise', () => {
  const data = input();
  data.claims[4] = claim('marginal-new', 2, 'NEWLY_PUBLISHED', 'ERROR', 'OTHER');
  const result = buildCalibrationHarnessReport(data);
  assert.equal(result.selected_rung_results[0].pass, false);
  assert.equal(result.selected_rung_results[0].baseline_precision_floor, result.selected_rung_results[0].baseline_existing_precision);
  const noJoint = input(); delete noJoint.joint_confirmation;
  error('JOINT_CONFIRMATION_REQUIRED', () => buildCalibrationHarnessReport(noJoint));
});

test('requires SHA-256 digests for evidence and adjudicator inputs', () => {
  const badSource = anchors(); badSource[0].evidence.source_digest = 'A'.repeat(64);
  error('INVALID_INPUT', () => buildAnchorSet({ anchors: badSource, strata: strata() }));
  const badEvidence = input(); badEvidence.claims[0].evidence.evidence_digest = 'evidence';
  error('INVALID_INPUT', () => buildCalibrationHarnessReport(badEvidence));
  error('INVALID_INPUT', () => calibration({ adjudicators: (() => {
    const base = calibration().adjudicators.map((entry) => ({ ...entry, anchor_verdicts: entry.anchor_verdicts }));
    base[0].requested_model_digest = 'model';
    return base;
  })() }));
  const badRubricAnchor = buildAnchorSet({ anchors: anchors(), strata: strata() });
  const verdicts = badRubricAnchor.anchors.map((anchor) => ({ anchor_id: anchor.anchor_id, verdict: anchor.human_verdict }));
  error('INVALID_INPUT', () => buildCalibration({ anchor_set: badRubricAnchor, floors: { precision: 0.9, recall: 0.9, seeded_detection_rate: 1 }, adjudicators: ['a', 'b', 'c'].map((id, index) => ({ adjudicator_id: id, vendor: index === 1 ? 'VENDOR_B' : 'VENDOR_A', requested_model_digest: digest(`model-${id}`), rubric_digest: index === 0 ? 'rubric' : digest(`rubric-${id}`), anchor_verdicts: verdicts })) }));
});

test('requires complete, sealed, tuple-bound leave-one-out confirmation', () => {
  const missing = input();
  missing.joint_confirmation = buildJointConfirmation({ selected_rungs: [{ family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', rung: 1 }], leave_one_out: [] });
  error('JOINT_CONFIRMATION_REQUIRED', () => buildCalibrationHarnessReport(missing));
  const duplicate = input();
  duplicate.joint_confirmation = buildJointConfirmation({ selected_rungs: [{ family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', rung: 1 }], leave_one_out: [
    { family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', selected_rung: 1, omitted_mechanism_id: 'CONTEXT', result: 'PASS' },
    { family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', selected_rung: 1, omitted_mechanism_id: 'CONTEXT', result: 'PASS' },
  ] });
  error('JOINT_CONFIRMATION_REQUIRED', () => buildCalibrationHarnessReport(duplicate));
  const unknown = input();
  unknown.joint_confirmation = buildJointConfirmation({ selected_rungs: [{ family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', rung: 1 }], leave_one_out: [{ family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', selected_rung: 1, omitted_mechanism_id: 'UNKNOWN', result: 'PASS' }] });
  error('JOINT_CONFIRMATION_REQUIRED', () => buildCalibrationHarnessReport(unknown));
  const failed = input();
  failed.joint_confirmation = buildJointConfirmation({ selected_rungs: [{ family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', rung: 1 }], leave_one_out: [{ family_id: 'FAMILY_A', mechanism_id: 'CONTEXT', selected_rung: 1, omitted_mechanism_id: 'CONTEXT', result: 'FAIL' }] });
  error('JOINT_CONFIRMATION_REQUIRED', () => buildCalibrationHarnessReport(failed));
  const unsealed = input(); unsealed.joint_confirmation = { ...unsealed.joint_confirmation, leave_one_out: unsealed.joint_confirmation.leave_one_out.map((entry) => ({ ...entry, result: 'FAIL' })) };
  error('IDENTITY_MISMATCH', () => buildCalibrationHarnessReport(unsealed));
});

test('requires explicit baseline, selected, and marginal-increment sampling roles', () => {
  const missingRole = input(); delete missingRole.sampling[0].population_role;
  error('INCOMPLETE_CENSUS', () => buildCalibrationHarnessReport(missingRole));
  const cumulativeMarginal = input(); cumulativeMarginal.sampling.find((entry) => entry.rung === 2).population_role = 'SELECTED';
  error('INCOMPLETE_CENSUS', () => buildCalibrationHarnessReport(cumulativeMarginal));
  const wrongBaseline = input(); wrongBaseline.sampling.find((entry) => entry.rung === 0).population_role = 'SELECTED';
  error('INCOMPLETE_CENSUS', () => buildCalibrationHarnessReport(wrongBaseline));
});
