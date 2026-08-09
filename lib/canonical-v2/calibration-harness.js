'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  validateHumanAnchorMachinePacket,
  validateHumanAnchorReviewPacket,
  validateHumanAnchorKey,
  validateHumanAnchorDecisionLedger,
} = require('./human-anchor-review');

const CALIBRATION_HARNESS_SCHEMA = 'CANONICAL_V2_CALIBRATION_HARNESS/V1';
const ANCHOR_SET_SCHEMA = 'CANONICAL_V2_HUMAN_ANCHOR_SET/V1';
const CALIBRATION_SCHEMA = 'CANONICAL_V2_ADJUDICATOR_CALIBRATION/V1';
const JOINT_CONFIRMATION_SCHEMA = 'CANONICAL_V2_JOINT_CALIBRATION_CONFIRMATION/V1';
const ERROR_CLASSES = Object.freeze([
  'PARTY_ATTRIBUTION', 'MATERIALITY_CODE', 'SPAN', 'TOPIC_BUCKET', 'OTHER',
]);
const HARD_ERROR_CLASSES = new Set(['PARTY_ATTRIBUTION', 'MATERIALITY_CODE']);
const VERDICTS = new Set(['CORRECT', 'ERROR']);
const POPULATIONS = new Set(['EXISTING_PUBLISHED', 'NEWLY_PUBLISHED']);
const MODES = new Set(['CENSUS', 'SAMPLE']);
const POPULATION_ROLES = new Set(['BASELINE', 'SELECTED', 'MARGINAL_INCREMENT']);
const SHA256_HEX = /^[a-f0-9]{64}$/;

class CalibrationHarnessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CalibrationHarnessError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new CalibrationHarnessError(code, message);
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${name} must be an object`);
  return value;
}

function string(value, name) {
  if (typeof value !== 'string' || !value) fail('INVALID_INPUT', `${name} must be a non-empty string`);
  return value;
}

function sha256(value, name) {
  const digest = string(value, name);
  if (!SHA256_HEX.test(digest)) fail('INVALID_INPUT', `${name} must be a lowercase 64-character SHA-256 hex string`);
  return digest;
}

function number(value, name) {
  if (!Number.isFinite(value)) fail('INVALID_INPUT', `${name} must be a finite number`);
  return value;
}

function cloneFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(cloneFreeze));
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.keys(value).sort().map((key) => [key, cloneFreeze(value[key])])));
  }
  return value;
}

function exactContentId(value, idKey, schema, name) {
  const item = object(value, name);
  const id = string(item[idKey], `${name}.${idKey}`);
  const body = { ...item };
  delete body[idKey];
  if (id !== contentId(schema, body)) fail('IDENTITY_MISMATCH', `${name}.${idKey} does not seal its content`);
  return body;
}

function validateEvidence(value, name) {
  const evidence = object(value, name);
  string(evidence.source_id, `${name}.source_id`);
  sha256(evidence.source_digest, `${name}.source_digest`);
  string(evidence.evidence_id, `${name}.evidence_id`);
  sha256(evidence.evidence_digest, `${name}.evidence_digest`);
  return evidence;
}

function anchorStrata(anchors) {
  const counts = (key) => Object.fromEntries([...anchors.reduce((result, row) => {
    result.set(row[key], (result.get(row[key]) || 0) + 1);
    return result;
  }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));
  return cloneFreeze({ by_family: counts('family_id'), by_error_class: counts('error_class') });
}

function validateStrata(strata, expected) {
  const declared = object(strata, 'strata');
  const keys = Object.keys(declared).sort();
  if (keys.length !== 2 || keys[0] !== 'by_error_class' || keys[1] !== 'by_family') {
    fail('ANCHOR_SET_INVALID', 'strata must declare exact by_family and by_error_class counts');
  }
  for (const key of keys) {
    const actual = expected[key];
    const supplied = object(declared[key], `strata.${key}`);
    const suppliedKeys = Object.keys(supplied).sort();
    const actualKeys = Object.keys(actual);
    if (suppliedKeys.length !== actualKeys.length || suppliedKeys.some((entry, index) => entry !== actualKeys[index])) {
      fail('ANCHOR_SET_INVALID', `strata.${key} does not match anchor rows`);
    }
    for (const entry of actualKeys) {
      if (!Number.isInteger(supplied[entry]) || supplied[entry] !== actual[entry]) {
        fail('ANCHOR_SET_INVALID', `strata.${key} does not match anchor rows`);
      }
    }
  }
}

function validateAnchorRows(anchors) {
  if (!Array.isArray(anchors) || anchors.length < 60 || anchors.length > 100) {
    fail('ANCHOR_SET_INVALID', 'anchor set must contain 60 to 100 rows');
  }
  const ids = new Set();
  const families = new Set();
  const classes = new Set();
  const seeded = new Set();
  for (const anchor of anchors) {
    const row = object(anchor, 'anchor row');
    const id = string(row.anchor_id, 'anchor row.anchor_id');
    if (ids.has(id)) fail('ANCHOR_SET_INVALID', 'anchor set has duplicate anchor_id');
    ids.add(id);
    families.add(string(row.family_id, 'anchor row.family_id'));
    const errorClass = string(row.error_class, 'anchor row.error_class');
    if (!ERROR_CLASSES.includes(errorClass)) fail('ANCHOR_SET_INVALID', 'anchor row has an unknown error_class');
    classes.add(errorClass);
    validateEvidence(row.evidence, 'anchor row.evidence');
    if (!VERDICTS.has(row.human_verdict)) fail('ANCHOR_SET_INVALID', 'anchor row must bind a human verdict');
    if (row.seeded_wrong === true) {
      if (row.human_verdict !== 'ERROR') fail('ANCHOR_SET_INVALID', 'seeded wrong anchor must have an ERROR human verdict');
      seeded.add(errorClass);
    }
  }
  if (families.size < 2 || classes.size < 2) fail('ANCHOR_SET_INVALID', 'anchor set must be stratified by family and error class');
  for (const errorClass of HARD_ERROR_CLASSES) {
    if (!seeded.has(errorClass)) fail('ANCHOR_SET_INVALID', `anchor set lacks seeded wrong ${errorClass} claim`);
  }
  return anchorStrata(anchors);
}

function buildAnchorSet({ anchors, strata } = {}) {
  const derivedStrata = validateAnchorRows(anchors);
  validateStrata(strata, derivedStrata);
  const body = {
    schema_version: ANCHOR_SET_SCHEMA,
    anchors: [...anchors].sort((left, right) => left.anchor_id.localeCompare(right.anchor_id)),
    strata: derivedStrata,
  };
  return cloneFreeze({ ...body, anchor_set_id: contentId(ANCHOR_SET_SCHEMA, body) });
}

function humanAnchorFailure(code, action) {
  try {
    return action();
  } catch (error) {
    fail(code, error.message);
  }
}

function sourceDigestForHumanAnchorCard(machinePacket, card) {
  return sha256Hex(canonicalJson({
    machine_packet_id: machinePacket.machine_packet_id,
    source_id: card.source_id,
    claim_occurrence_id: card.identity.claim_occurrence_id,
    closure_id: card.identity.closure_id,
  }));
}

function machineReviewCardBinding(machineCard, reviewCard) {
  return canonicalJson({
    card_number: machineCard.card_number,
    decision_key: machineCard.decision_key,
    deal: machineCard.deal,
    family: machineCard.family,
    section_reference: machineCard.section_reference,
    claim_definition_key: machineCard.claim_definition_key,
    identity: machineCard.identity,
    evidence: machineCard.evidence,
    error_class: machineCard.error_class,
    proposed_analysis: machineCard.proposed_analysis,
  }) === canonicalJson(reviewCard);
}

function buildAnchorSetFromHumanAnchorLedger({
  machine_packet: machinePacket,
  review_packet: reviewPacket,
  seed_key: seedKey,
  decision_ledger: decisionLedger,
} = {}) {
  humanAnchorFailure('HUMAN_ANCHOR_MACHINE_PACKET_INVALID', () => validateHumanAnchorMachinePacket(machinePacket));
  humanAnchorFailure('HUMAN_ANCHOR_REVIEW_PACKET_INVALID', () => validateHumanAnchorReviewPacket(reviewPacket));
  humanAnchorFailure('HUMAN_ANCHOR_KEY_INVALID', () => validateHumanAnchorKey({
    key: seedKey, machine_packet: machinePacket, review_packet: reviewPacket,
  }));
  humanAnchorFailure('HUMAN_ANCHOR_LEDGER_INVALID', () => validateHumanAnchorDecisionLedger({
    ledger: decisionLedger, review_packet: reviewPacket,
  }));
  if (decisionLedger.decisions.length === 0) {
    fail('HUMAN_ANCHOR_UNREVIEWED', 'an empty human anchor ledger cannot calibrate adjudicators');
  }
  if (decisionLedger.decisions.length !== reviewPacket.cards.length) {
    fail('HUMAN_ANCHOR_LEDGER_INVALID', 'human anchor ledger must cover every review card');
  }
  const machineByDecisionKey = new Map(machinePacket.cards.map((card) => [card.decision_key, card]));
  const decisionByKey = new Map(decisionLedger.decisions.map((decision) => [decision.decision_key, decision]));
  const seedByKey = new Map(seedKey.entries.map((entry) => [entry.decision_key, entry]));
  const anchors = reviewPacket.cards.map((reviewCard) => {
    const machineCard = machineByDecisionKey.get(reviewCard.decision_key);
    const decision = decisionByKey.get(reviewCard.decision_key);
    const seed = seedByKey.get(reviewCard.decision_key);
    if (!machineCard || !decision || !seed || !machineReviewCardBinding(machineCard, reviewCard)) {
      fail('HUMAN_ANCHOR_PACKET_BINDING_INVALID', 'machine, review, seed-key, and human decision cards must bind exactly');
    }
    if (seed.seeded_wrong && (seed.planted_expected_verdict !== 'ERROR' || decision.verdict !== 'ERROR')) {
      fail('HUMAN_ANCHOR_SEED_MISMATCH', 'a planted wrong variant must be confirmed as an error by the human ledger');
    }
    if (!seed.seeded_wrong && seed.planted_expected_verdict !== null) {
      fail('HUMAN_ANCHOR_KEY_INVALID', 'unseeded cards must not carry a pre-judged verdict');
    }
    return {
      anchor_id: reviewCard.decision_key,
      family_id: reviewCard.family,
      error_class: reviewCard.error_class,
      evidence: {
        source_id: machineCard.source_id,
        source_digest: sourceDigestForHumanAnchorCard(machinePacket, machineCard),
        evidence_id: reviewCard.evidence.excerpt_id,
        evidence_digest: reviewCard.evidence.excerpt_digest,
      },
      human_verdict: decision.verdict,
      seeded_wrong: seed.seeded_wrong,
    };
  });
  return buildAnchorSet({ anchors, strata: anchorStrata(anchors) });
}

function scoreAdjudicator(anchorSet, adjudicator, floors) {
  const rows = anchorSet.anchors;
  const verdicts = adjudicator.anchor_verdicts;
  if (!Array.isArray(verdicts) || verdicts.length !== rows.length) fail('UNCALIBRATED_ADJUDICATOR', 'adjudicator must verdict every anchor exactly once');
  const expected = new Map(rows.map((row) => [row.anchor_id, row]));
  const seen = new Set();
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let agreements = 0;
  const seeded = new Map([...HARD_ERROR_CLASSES].map((errorClass) => [errorClass, { total: 0, detected: 0 }]));
  for (const verdict of verdicts) {
    const row = object(verdict, 'anchor verdict');
    const anchor = expected.get(string(row.anchor_id, 'anchor verdict.anchor_id'));
    if (!anchor || seen.has(row.anchor_id)) fail('UNCALIBRATED_ADJUDICATOR', 'adjudicator has a duplicate or unknown anchor verdict');
    seen.add(row.anchor_id);
    if (!VERDICTS.has(row.verdict)) fail('UNCALIBRATED_ADJUDICATOR', 'anchor verdict must be CORRECT or ERROR');
    if (row.verdict === anchor.human_verdict) agreements += 1;
    if (row.verdict === 'ERROR' && anchor.human_verdict === 'ERROR') tp += 1;
    if (row.verdict === 'ERROR' && anchor.human_verdict === 'CORRECT') fp += 1;
    if (row.verdict === 'CORRECT' && anchor.human_verdict === 'ERROR') fn += 1;
    if (anchor.seeded_wrong && seeded.has(anchor.error_class)) {
      const metric = seeded.get(anchor.error_class);
      metric.total += 1;
      if (row.verdict === 'ERROR') metric.detected += 1;
    }
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const seededDetection = Object.fromEntries([...seeded].map(([errorClass, metric]) => [
    errorClass, metric.total === 0 ? 0 : metric.detected / metric.total,
  ]));
  const qualified = precision >= floors.precision
    && recall >= floors.recall
    && [...HARD_ERROR_CLASSES].every((errorClass) => seededDetection[errorClass] >= floors.seeded_detection_rate);
  return cloneFreeze({
    precision, recall, agreement: agreements / rows.length, seeded_detection_rate: seededDetection, qualified,
  });
}

function buildCalibration({ anchor_set: anchorSet, adjudicators, floors } = {}) {
  const anchorBody = exactContentId(anchorSet, 'anchor_set_id', ANCHOR_SET_SCHEMA, 'anchor_set');
  if (anchorBody.schema_version !== ANCHOR_SET_SCHEMA) fail('ANCHOR_SET_INVALID', 'anchor set schema is unknown');
  validateStrata(anchorBody.strata, validateAnchorRows(anchorBody.anchors));
  const configuredFloors = object(floors, 'floors');
  for (const key of ['precision', 'recall', 'seeded_detection_rate']) {
    const value = number(configuredFloors[key], `floors.${key}`);
    if (value < 0 || value > 1) fail('INVALID_INPUT', `floors.${key} must be between zero and one`);
  }
  if (!Array.isArray(adjudicators) || adjudicators.length !== 3) fail('UNCALIBRATED_ADJUDICATOR', 'exactly three adjudicators are required');
  const ids = new Set();
  const vendors = new Set();
  const calibrated = adjudicators.map((item) => {
    const adjudicator = object(item, 'adjudicator');
    const id = string(adjudicator.adjudicator_id, 'adjudicator.adjudicator_id');
    if (ids.has(id)) fail('UNCALIBRATED_ADJUDICATOR', 'duplicate adjudicator identity');
    ids.add(id);
    vendors.add(string(adjudicator.vendor, 'adjudicator.vendor'));
    sha256(adjudicator.requested_model_digest, 'adjudicator.requested_model_digest');
    sha256(adjudicator.rubric_digest, 'adjudicator.rubric_digest');
    return { ...adjudicator, anchor_metrics: scoreAdjudicator(anchorSet, adjudicator, configuredFloors) };
  });
  if (vendors.size < 2) fail('UNCALIBRATED_ADJUDICATOR', 'at least two adjudicator vendors are required');
  const body = {
    schema_version: CALIBRATION_SCHEMA,
    anchor_set_id: anchorSet.anchor_set_id,
    anchor_set: anchorSet,
    floors: configuredFloors,
    adjudicators: calibrated.sort((left, right) => left.adjudicator_id.localeCompare(right.adjudicator_id)),
  };
  return cloneFreeze({ ...body, calibration_id: contentId(CALIBRATION_SCHEMA, body) });
}

function wilsonInterval(correct, total, confidenceLevel) {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
    fail('CONFIDENCE_INTERVAL_REQUIRED', 'confidence interval requires a non-empty integer denominator');
  }
  const z = 1.959963984540054;
  const p = correct / total;
  const denominator = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return cloneFreeze({ method: 'WILSON', confidence_level: confidenceLevel, lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) });
}

function validateConfidenceInterval(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('CONFIDENCE_INTERVAL_REQUIRED', 'confidence interval inputs are required');
  }
  const interval = value;
  if (interval.method !== 'WILSON') fail('CONFIDENCE_INTERVAL_REQUIRED', 'confidence interval method must be WILSON');
  const confidenceLevel = number(interval.confidence_level, 'confidence_interval.confidence_level');
  if (confidenceLevel !== 0.95) fail('CONFIDENCE_INTERVAL_REQUIRED', 'confidence level must be exactly 0.95');
  return confidenceLevel;
}

function catalogueMaps(catalogue) {
  const value = object(catalogue, 'catalogue');
  if (!Array.isArray(value.families) || !Array.isArray(value.mechanisms)) fail('INVALID_INPUT', 'catalogue must carry families and mechanisms');
  const families = new Set(value.families.map((entry) => typeof entry === 'string' ? entry : entry?.family_id));
  const mechanisms = new Map(value.mechanisms.map((entry) => [entry?.mechanism_id, new Set(entry?.rungs)]));
  if (families.has(undefined) || mechanisms.has(undefined)) fail('INVALID_INPUT', 'catalogue entries must name family and mechanism');
  return { families, mechanisms };
}

function tupleKey({ family_id: familyId, mechanism_id: mechanismId, rung }) {
  return `${familyId}\u0000${mechanismId}\u0000${rung}`;
}

function validateTuple(row, maps, name) {
  const familyId = string(row.family_id, `${name}.family_id`);
  const mechanismId = string(row.mechanism_id, `${name}.mechanism_id`);
  const rung = number(row.rung, `${name}.rung`);
  if (!maps.families.has(familyId)) fail('UNKNOWN_TUPLE', `unknown family ${familyId}`);
  if (!maps.mechanisms.has(mechanismId)) fail('UNKNOWN_TUPLE', `unknown mechanism ${mechanismId}`);
  if (!maps.mechanisms.get(mechanismId).has(rung)) fail('UNKNOWN_TUPLE', `unknown rung ${rung} for ${mechanismId}`);
  return { family_id: familyId, mechanism_id: mechanismId, rung };
}

function validateClaim(claim, maps, qualifiedAdjudicators) {
  const row = object(claim, 'claim');
  const claimId = string(row.claim_id, 'claim.claim_id');
  const tuple = validateTuple(row, maps, 'claim');
  if (!POPULATIONS.has(row.population)) fail('INVALID_INPUT', 'claim has unknown population');
  validateEvidence(row.evidence, 'claim.evidence');
  if (!Array.isArray(row.verdicts) || row.verdicts.length !== 3) fail('ADJUDICATION_INVALID', 'claim requires exactly three adjudicator verdicts');
  const ids = new Set();
  const verdicts = row.verdicts.map((item) => {
    const verdict = object(item, 'claim verdict');
    const adjudicatorId = string(verdict.adjudicator_id, 'claim verdict.adjudicator_id');
    if (ids.has(adjudicatorId)) fail('DUPLICATE_VERDICT', 'claim has duplicate adjudicator verdict');
    ids.add(adjudicatorId);
    if (!qualifiedAdjudicators.has(adjudicatorId)) fail('UNCALIBRATED_ADJUDICATOR', 'claim verdict comes from an uncalibrated adjudicator');
    if (!VERDICTS.has(verdict.verdict)) fail('ADJUDICATION_INVALID', 'claim verdict must be CORRECT or ERROR');
    if (verdict.verdict === 'ERROR' && !ERROR_CLASSES.includes(verdict.error_class)) fail('ADJUDICATION_INVALID', 'error verdict requires a known error class');
    return { adjudicator_id: adjudicatorId, vendor: qualifiedAdjudicators.get(adjudicatorId).vendor, verdict: verdict.verdict, error_class: verdict.verdict === 'ERROR' ? verdict.error_class : null };
  });
  if (new Set(verdicts.map((entry) => entry.vendor)).size < 2) fail('ADJUDICATION_INVALID', 'each claim requires adjudicators from at least two vendors');
  const errorVerdicts = verdicts.filter((entry) => entry.verdict === 'ERROR');
  const errorsByClass = new Map();
  for (const verdict of errorVerdicts) errorsByClass.set(verdict.error_class, (errorsByClass.get(verdict.error_class) || 0) + 1);
  const majorityErrorClass = [...errorsByClass.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || null;
  const majorityError = errorVerdicts.length >= 2;
  const unanimousHardError = errorVerdicts.length === 3 && errorVerdicts.every((entry) => entry.error_class === majorityErrorClass) && HARD_ERROR_CLASSES.has(majorityErrorClass);
  if (unanimousHardError) {
    if (!row.human_confirmation || typeof row.human_confirmation !== 'object' || Array.isArray(row.human_confirmation)) {
      fail('HUMAN_CONFIRMATION_REQUIRED', 'unanimous hard error requires matching human confirmation');
    }
    const confirmation = row.human_confirmation;
    if (confirmation.status !== 'CONFIRMED_ERROR' || confirmation.error_class !== majorityErrorClass) {
      fail('HUMAN_CONFIRMATION_REQUIRED', 'unanimous hard error requires matching human confirmation');
    }
    string(confirmation.human_id, 'claim.human_confirmation.human_id');
    if (sha256(confirmation.evidence_digest, 'claim.human_confirmation.evidence_digest') !== row.evidence.evidence_digest) {
      fail('HUMAN_CONFIRMATION_REQUIRED', 'human confirmation must bind the claim evidence');
    }
  }
  return { ...tuple, claim_id: claimId, population: row.population, verdicts, majority_error: majorityError, majority_error_class: majorityError ? majorityErrorClass : null, unanimous_hard_error: unanimousHardError, disagreement: new Set(verdicts.map((entry) => `${entry.verdict}:${entry.error_class || ''}`)).size > 1 };
}

function metricsForClaims(claims, confidenceLevel) {
  if (!claims.length) fail('CONFIDENCE_INTERVAL_REQUIRED', 'each reported population requires claims');
  const correct = claims.filter((claim) => !claim.majority_error).length;
  const errorClasses = Object.fromEntries(ERROR_CLASSES.map((errorClass) => [
    errorClass, claims.filter((claim) => claim.majority_error_class === errorClass).length,
  ]));
  return cloneFreeze({
    count: claims.length,
    correct_count: correct,
    precision: correct / claims.length,
    confidence_interval: wilsonInterval(correct, claims.length, confidenceLevel),
    error_class_counts: errorClasses,
    disagreement_count: claims.filter((claim) => claim.disagreement).length,
  });
}

function validateSampling(records, groups, maps) {
  if (!Array.isArray(records)) fail('INCOMPLETE_CENSUS', 'sampling records are required');
  const seen = new Set();
  const byKey = new Map();
  for (const raw of records) {
    const row = object(raw, 'sampling record');
    const tuple = validateTuple(row, maps, 'sampling record');
    if (!POPULATIONS.has(row.population) || !MODES.has(row.mode) || !POPULATION_ROLES.has(row.population_role)) fail('INCOMPLETE_CENSUS', 'sampling record has unknown population, mode, or population role');
    const key = `${tupleKey(tuple)}\u0000${row.population}`;
    if (seen.has(key)) fail('INCOMPLETE_CENSUS', 'duplicate sampling record');
    seen.add(key);
    if (!groups.has(key)) fail('INCOMPLETE_CENSUS', 'sampling record does not bind supplied claims');
    const group = groups.get(key) || [];
    const denominator = number(row.denominator, 'sampling record.denominator');
    const sampleSize = number(row.sample_size, 'sampling record.sample_size');
    if (!Number.isInteger(denominator) || !Number.isInteger(sampleSize) || denominator < group.length || sampleSize !== group.length) {
      fail('INCOMPLETE_CENSUS', 'sampling denominator and sample size must bind supplied claims');
    }
    if (row.population === 'NEWLY_PUBLISHED' && denominator < 150 && row.mode !== 'CENSUS') {
      fail('INCOMPLETE_CENSUS', 'newly published populations below 150 require a census');
    }
    if (row.mode === 'CENSUS' && (denominator !== group.length || sampleSize !== denominator)) {
      fail('INCOMPLETE_CENSUS', 'census must be complete');
    }
    if (row.mode === 'SAMPLE') {
      if (!Number.isFinite(row.detectable_effect)) fail('INCOMPLETE_CENSUS', 'declared sample needs detectable effect');
      const effect = row.detectable_effect;
      if (effect <= 0 || effect >= 1) fail('INCOMPLETE_CENSUS', 'declared sample needs detectable effect');
    }
    byKey.set(key, cloneFreeze({ ...row }));
  }
  for (const key of groups.keys()) if (!seen.has(key)) fail('INCOMPLETE_CENSUS', 'each tuple population requires an explicit sampling record');
  return byKey;
}

function validateJointConfirmation(value, maps) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('JOINT_CONFIRMATION_REQUIRED', 'a confirmed joint run is required');
  }
  const body = exactContentId(value, 'joint_confirmation_id', JOINT_CONFIRMATION_SCHEMA, 'joint_confirmation');
  if (body.schema_version !== JOINT_CONFIRMATION_SCHEMA || body.status !== 'CONFIRMED') fail('JOINT_CONFIRMATION_REQUIRED', 'a confirmed joint run is required');
  if (!Array.isArray(body.selected_rungs) || !body.selected_rungs.length || !Array.isArray(body.leave_one_out)) {
    fail('JOINT_CONFIRMATION_REQUIRED', 'joint confirmation requires selected rungs and leave-one-out records');
  }
  const selected = body.selected_rungs.map((row) => validateTuple(row, maps, 'selected rung'));
  const selectedKeys = new Set(selected.map(tupleKey));
  if (selectedKeys.size !== selected.length) fail('JOINT_CONFIRMATION_REQUIRED', 'joint confirmation has duplicate selected rungs');
  const leaveOneOutKeys = new Set();
  for (const raw of body.leave_one_out) {
    const row = object(raw, 'leave-one-out record');
    const tuple = validateTuple({ family_id: row.family_id, mechanism_id: row.mechanism_id, rung: row.selected_rung }, maps, 'leave-one-out record');
    const omittedMechanismId = string(row.omitted_mechanism_id, 'leave-one-out record.omitted_mechanism_id');
    if (!maps.mechanisms.has(omittedMechanismId) || row.result !== 'PASS' || omittedMechanismId !== tuple.mechanism_id || !selectedKeys.has(tupleKey(tuple))) {
      fail('JOINT_CONFIRMATION_REQUIRED', 'leave-one-out records must be one PASS for each selected mechanism');
    }
    const key = tupleKey(tuple);
    if (leaveOneOutKeys.has(key)) fail('JOINT_CONFIRMATION_REQUIRED', 'joint confirmation has duplicate leave-one-out records');
    leaveOneOutKeys.add(key);
  }
  if (leaveOneOutKeys.size !== selectedKeys.size || [...selectedKeys].some((key) => !leaveOneOutKeys.has(key))) {
    fail('JOINT_CONFIRMATION_REQUIRED', 'joint confirmation lacks leave-one-out attribution');
  }
  return { body, selected };
}

function validateCalibrationContract(calibration) {
  const anchorBody = exactContentId(calibration.anchor_set, 'anchor_set_id', ANCHOR_SET_SCHEMA, 'calibration anchor_set');
  if (anchorBody.schema_version !== ANCHOR_SET_SCHEMA || calibration.anchor_set_id !== calibration.anchor_set.anchor_set_id) {
    fail('UNCALIBRATED_ADJUDICATOR', 'calibration must bind its exact anchor set');
  }
  validateStrata(anchorBody.strata, validateAnchorRows(anchorBody.anchors));
  const configuredFloors = object(calibration.floors, 'calibration floors');
  for (const key of ['precision', 'recall', 'seeded_detection_rate']) {
    const value = number(configuredFloors[key], `calibration floors.${key}`);
    if (value < 0 || value > 1) fail('UNCALIBRATED_ADJUDICATOR', `calibration floors.${key} must be between zero and one`);
  }
  if (!Array.isArray(calibration.adjudicators) || calibration.adjudicators.length !== 3) {
    fail('UNCALIBRATED_ADJUDICATOR', 'calibration requires exactly three adjudicators');
  }
  const ids = new Set();
  const vendors = new Set();
  for (const raw of calibration.adjudicators) {
    const adjudicator = object(raw, 'calibration adjudicator');
    const id = string(adjudicator.adjudicator_id, 'calibration adjudicator.adjudicator_id');
    if (ids.has(id)) fail('UNCALIBRATED_ADJUDICATOR', 'calibration has duplicate adjudicator identity');
    ids.add(id);
    vendors.add(string(adjudicator.vendor, 'calibration adjudicator.vendor'));
    sha256(adjudicator.requested_model_digest, 'calibration adjudicator.requested_model_digest');
    sha256(adjudicator.rubric_digest, 'calibration adjudicator.rubric_digest');
    const recomputedMetrics = scoreAdjudicator(calibration.anchor_set, adjudicator, configuredFloors);
    if (canonicalJson(recomputedMetrics) !== canonicalJson(adjudicator.anchor_metrics)) {
      fail('UNCALIBRATED_ADJUDICATOR', 'calibration adjudicator metrics do not match the bound anchor verdicts');
    }
  }
  if (vendors.size < 2) fail('UNCALIBRATED_ADJUDICATOR', 'calibration requires at least two adjudicator vendors');
}

function requirePopulationRole(sampling, role, label) {
  if (sampling.population_role !== role) fail('INCOMPLETE_CENSUS', `${label} sampling must declare ${role}`);
}

function buildCalibrationHarnessReport({ catalogue, calibration, claims, sampling, confidence_interval: confidenceInterval, joint_confirmation: jointConfirmation } = {}) {
  const maps = catalogueMaps(catalogue);
  const calibrationBody = exactContentId(calibration, 'calibration_id', CALIBRATION_SCHEMA, 'calibration');
  if (calibrationBody.schema_version !== CALIBRATION_SCHEMA) fail('UNCALIBRATED_ADJUDICATOR', 'calibration schema is unknown');
  validateCalibrationContract(calibrationBody);
  const confidenceLevel = validateConfidenceInterval(confidenceInterval);
  const joint = validateJointConfirmation(jointConfirmation, maps);
  if (!Array.isArray(claims) || !claims.length) fail('INVALID_INPUT', 'claims are required');
  const qualifiedAdjudicators = new Map(calibrationBody.adjudicators.filter((entry) => entry.anchor_metrics?.qualified).map((entry) => [entry.adjudicator_id, entry]));
  const checkedClaims = claims.map((claim) => validateClaim(claim, maps, qualifiedAdjudicators));
  if (new Set(checkedClaims.map((claim) => claim.claim_id)).size !== checkedClaims.length) fail('INVALID_INPUT', 'claim ids must be unique');
  const groups = new Map();
  for (const claim of checkedClaims) {
    const key = `${tupleKey(claim)}\u0000${claim.population}`;
    groups.set(key, [...(groups.get(key) || []), claim]);
  }
  const samplingByKey = validateSampling(sampling, groups, maps);
  const reports = [...groups.entries()].map(([key, group]) => ({
    key,
    tuple: { family_id: group[0].family_id, mechanism_id: group[0].mechanism_id, rung: group[0].rung },
    population: group[0].population,
    sampling: samplingByKey.get(key),
    metrics: metricsForClaims(group, confidenceLevel),
    human_confirmed_hard_errors: group.filter((claim) => claim.unanimous_hard_error).map((claim) => claim.claim_id).sort(),
  }));
  const reportByKey = new Map(reports.map((report) => [report.key, report]));
  const selections = joint.selected.map((selected) => {
    const baseline = { ...selected, rung: 0 };
    const currentNew = reportByKey.get(`${tupleKey(selected)}\u0000NEWLY_PUBLISHED`);
    const currentExisting = reportByKey.get(`${tupleKey(selected)}\u0000EXISTING_PUBLISHED`);
    const baselineNew = reportByKey.get(`${tupleKey(baseline)}\u0000NEWLY_PUBLISHED`);
    const baselineExisting = reportByKey.get(`${tupleKey(baseline)}\u0000EXISTING_PUBLISHED`);
    if (!currentNew || !currentExisting || !baselineNew || !baselineExisting) fail('MISSING_BASELINE', 'selected rung requires both populations at rung zero and selected rung');
    const rungs = [...maps.mechanisms.get(selected.mechanism_id)].sort((left, right) => left - right);
    const nextRung = rungs.find((rung) => rung > selected.rung);
    if (nextRung === undefined) fail('MISSING_BASELINE', 'selected rung requires next-rung marginal evidence');
    const marginal = reportByKey.get(`${tupleKey({ ...selected, rung: nextRung })}\u0000NEWLY_PUBLISHED`);
    if (!marginal) fail('MISSING_BASELINE', 'selected rung requires next-rung marginal evidence');
    requirePopulationRole(baselineNew.sampling, 'BASELINE', 'baseline newly-published');
    requirePopulationRole(baselineExisting.sampling, 'BASELINE', 'baseline existing-published');
    requirePopulationRole(currentNew.sampling, 'SELECTED', 'selected newly-published');
    requirePopulationRole(currentExisting.sampling, 'SELECTED', 'selected existing-published');
    requirePopulationRole(marginal.sampling, 'MARGINAL_INCREMENT', 'next-rung newly-published');
    const floor = baselineExisting.metrics.precision;
    const hardErrors = [...currentNew.human_confirmed_hard_errors, ...currentExisting.human_confirmed_hard_errors];
    const passes = currentNew.metrics.precision >= floor
      && currentExisting.metrics.precision >= baselineExisting.metrics.precision
      && hardErrors.length === 0
      && marginal.metrics.precision >= floor;
    return cloneFreeze({
      ...selected,
      baseline_new_precision: baselineNew.metrics.precision,
      baseline_precision_floor: floor,
      baseline_existing_precision: baselineExisting.metrics.precision,
      new_precision: currentNew.metrics.precision,
      existing_precision: currentExisting.metrics.precision,
      next_rung: nextRung,
      marginal_count: marginal.metrics.count,
      marginal_precision: marginal.metrics.precision,
      marginal_confidence_interval: marginal.metrics.confidence_interval,
      pass: passes,
      failure_reason: passes ? null : 'MARGINAL_OR_AGGREGATE_REQUIREMENT_FAILED',
    });
  });
  const body = {
    schema_version: CALIBRATION_HARNESS_SCHEMA,
    calibration_id: calibration.calibration_id,
    input_digest: sha256Hex(Buffer.from(canonicalJson({ catalogue, claims, sampling, confidence_interval: confidenceInterval, joint_confirmation: jointConfirmation }), 'utf8')),
    publication_authorisation: 'NONE',
    joint_confirmation_id: jointConfirmation.joint_confirmation_id,
    tuple_reports: reports.sort((left, right) => left.key.localeCompare(right.key)),
    selected_rung_results: selections.sort((left, right) => tupleKey(left).localeCompare(tupleKey(right))),
    disagreement_claim_ids: checkedClaims.filter((claim) => claim.disagreement).map((claim) => claim.claim_id).sort(),
  };
  return cloneFreeze({ ...body, calibration_harness_report_id: contentId(CALIBRATION_HARNESS_SCHEMA, body) });
}

function buildJointConfirmation({ selected_rungs, leave_one_out } = {}) {
  const body = { schema_version: JOINT_CONFIRMATION_SCHEMA, status: 'CONFIRMED', selected_rungs, leave_one_out };
  return cloneFreeze({ ...body, joint_confirmation_id: contentId(JOINT_CONFIRMATION_SCHEMA, body) });
}

module.exports = {
  ANCHOR_SET_SCHEMA,
  CALIBRATION_HARNESS_SCHEMA,
  CALIBRATION_SCHEMA,
  CalibrationHarnessError,
  JOINT_CONFIRMATION_SCHEMA,
  buildAnchorSet,
  buildAnchorSetFromHumanAnchorLedger,
  buildCalibration,
  buildCalibrationHarnessReport,
  buildJointConfirmation,
};
