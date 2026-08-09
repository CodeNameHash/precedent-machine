'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CALIBRATION_AUTHORITY_SCHEMA,
  CANONICAL_CLAIM_PUBLICATION_STATES,
  UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA,
  UNATTENDED_PUBLICATION_DISPOSITIONS,
  PUBLICATION_DISPOSITION_SCHEMA,
  PUBLICATION_DISPOSITIONS,
  PublicationDispositionError,
  buildCalibrationAuthority,
  validateCalibrationAuthority,
  evaluatePublicationDisposition,
  validatePublicationDispositionDecision,
  transitionPublicationDisposition,
  PUBLICATION_DISPOSITION_V2_SCHEMA,
  buildPublicationDispositionV2,
  validatePublicationDispositionV2,
} = require('../lib/canonical-v2/publication-disposition');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

const DIGESTS = Object.freeze({
  corpus_digest: '0'.repeat(64),
  source_digest: '1'.repeat(64),
  prompt_digest: '2'.repeat(64),
  requested_model_digest: '3'.repeat(64),
  registry_digest: '4'.repeat(64),
  resolver_digest: '5'.repeat(64),
  adjudication_rubric_digest: '6'.repeat(64),
});
const EVALUATION_TIME = '2026-08-09T12:00:00.000Z';

function authorityInput(overrides = {}) {
  return {
    ...DIGESTS,
    family: 'TERMINATION_FEE',
    mechanism: 'EXACT_BOUND_DIGESTS',
    selected_rung: 2,
    sample_size: 50,
    confidence_interval: { lower_bound: 0.01, upper_bound: 0.03, confidence_level: 0.95 },
    adjudicators: [
      { identity: 'adjudicator-b', calibration_score: 0.98 },
      { identity: 'adjudicator-a', calibration_score: 0.99 },
    ],
    valid_from: '2026-08-01T00:00:00.000Z',
    expires_at: '2026-08-31T00:00:00.000Z',
    expiry_drift_rule: {
      mode: 'EXACT_BOUND_DIGESTS_AND_TIME_EXPIRY',
      description: 'All bound digests must match and the authority must be current.',
    },
    product_approved_false_publication_threshold: 0.03,
    family_switches: [{ family: 'TERMINATION_FEE', enabled: true, claim_kinds: ['AMOUNT', 'TRIGGER'] }],
    ...overrides,
  };
}

function decisionWithIdentity(body) {
  return {
    ...body,
    decision_id: contentId(UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA, body),
  };
}

function publicationInput(overrides = {}) {
  return {
    ...DIGESTS,
    canonical_claim_publication_state: CANONICAL_CLAIM_PUBLICATION_STATES.VALIDATED,
    family: 'TERMINATION_FEE',
    claim_kind: 'AMOUNT',
    mechanism: 'EXACT_BOUND_DIGESTS',
    selected_rung: 2,
    risk_signals: {
      structural_uncertainty: false,
      definition_ambiguity: false,
      model_fallback: false,
      party_attribution_risk: false,
    },
    ...overrides,
  };
}

function evaluate(overrides = {}) {
  return evaluatePublicationDisposition({
    calibration_authority: buildCalibrationAuthority(authorityInput()),
    publication_input: publicationInput(),
    evaluation_time: EVALUATION_TIME,
    ...overrides,
  });
}

test('a fully bound, current authority makes a VALIDATED claim ELIGIBLE without changing review or resolution state', () => {
  const authority = buildCalibrationAuthority(authorityInput());
  const decision = evaluatePublicationDisposition({
    calibration_authority: authority,
    publication_input: publicationInput(),
    evaluation_time: EVALUATION_TIME,
  });
  assert.equal(authority.schema_version, CALIBRATION_AUTHORITY_SCHEMA);
  assert.equal(decision.schema_version, UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA);
  assert.equal(PUBLICATION_DISPOSITION_SCHEMA, UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA);
  assert.equal(decision.disposition, UNATTENDED_PUBLICATION_DISPOSITIONS.ELIGIBLE);
  assert.equal(PUBLICATION_DISPOSITIONS, UNATTENDED_PUBLICATION_DISPOSITIONS);
  assert.deepEqual(decision.reason_codes, ['CALIBRATION_AUTHORITY_MATCHED']);
  assert.equal(decision.authority_id, authority.calibration_authority_id);
  assert.doesNotThrow(() => validateCalibrationAuthority(authority));
  assert.doesNotThrow(() => validatePublicationDispositionDecision(decision));
});

test('canonical claim publication state is a separate gate for unattended publication', () => {
  const quarantined = evaluate({
    publication_input: publicationInput({
      canonical_claim_publication_state: CANONICAL_CLAIM_PUBLICATION_STATES.QUARANTINED,
    }),
  });
  const unknown = evaluate({
    publication_input: publicationInput({ canonical_claim_publication_state: 'UNKNOWN' }),
  });
  assert.equal(quarantined.disposition, UNATTENDED_PUBLICATION_DISPOSITIONS.WITHHELD);
  assert.deepEqual(quarantined.reason_codes, ['CANONICAL_CLAIM_QUARANTINED']);
  assert.equal(unknown.disposition, UNATTENDED_PUBLICATION_DISPOSITIONS.WITHHELD);
  assert.deepEqual(unknown.reason_codes, ['UNKNOWN_CANONICAL_CLAIM_PUBLICATION_STATE']);
});

test('missing authority defaults to WITHHELD', () => {
  const decision = evaluatePublicationDisposition();
  assert.equal(decision.disposition, PUBLICATION_DISPOSITIONS.WITHHELD);
  assert.deepEqual(decision.reason_codes, ['MISSING_CALIBRATION_AUTHORITY']);
  assert.equal(decision.authority_id, null);
});

test('an authority requires a publication input and an explicit evaluation time', () => {
  const authority = buildCalibrationAuthority(authorityInput());
  const missingInput = evaluatePublicationDisposition({
    calibration_authority: authority,
    evaluation_time: EVALUATION_TIME,
  });
  const missingTime = evaluatePublicationDisposition({
    calibration_authority: authority,
    publication_input: publicationInput(),
  });
  assert.deepEqual(missingInput.reason_codes, ['INVALID_PUBLICATION_INPUT']);
  assert.deepEqual(missingTime.reason_codes, ['INVALID_PUBLICATION_INPUT']);
  assert.equal(missingInput.authority_id, authority.calibration_authority_id);
  assert.equal(missingTime.authority_id, authority.calibration_authority_id);
});

test('authority that is not current or is expired fails closed', () => {
  const notYetValid = evaluate({
    calibration_authority: buildCalibrationAuthority(authorityInput({ valid_from: '2026-08-10T00:00:00.000Z' })),
  });
  const expired = evaluate({
    calibration_authority: buildCalibrationAuthority(authorityInput({ expires_at: '2026-08-09T12:00:00.000Z' })),
  });
  assert.deepEqual(notYetValid.reason_codes, ['AUTHORITY_NOT_YET_VALID']);
  assert.deepEqual(expired.reason_codes, ['AUTHORITY_EXPIRED']);
  assert.equal(notYetValid.disposition, PUBLICATION_DISPOSITIONS.WITHHELD);
  assert.equal(expired.disposition, PUBLICATION_DISPOSITIONS.WITHHELD);
});

test('false-publication confidence must not exceed the approved threshold', () => {
  const equality = evaluate({
    calibration_authority: buildCalibrationAuthority(authorityInput({
      confidence_interval: { lower_bound: 0.01, upper_bound: 0.03, confidence_level: 0.95 },
      product_approved_false_publication_threshold: 0.03,
    })),
  });
  assert.equal(equality.disposition, UNATTENDED_PUBLICATION_DISPOSITIONS.ELIGIBLE);
  assert.throws(
    () => buildCalibrationAuthority(authorityInput({
      confidence_interval: { lower_bound: 0.01, upper_bound: 0.031, confidence_level: 0.95 },
    })),
    (error) => error.code === 'FALSE_PUBLICATION_CONFIDENCE_EXCEEDS_THRESHOLD',
  );
  const malformedAuthority = {
    ...buildCalibrationAuthority(authorityInput()),
    confidence_interval: { lower_bound: 0.01, upper_bound: 0.031, confidence_level: 0.95 },
  };
  const malformedDecision = evaluate({ calibration_authority: malformedAuthority });
  assert.equal(malformedDecision.disposition, UNATTENDED_PUBLICATION_DISPOSITIONS.WITHHELD);
  assert.deepEqual(malformedDecision.reason_codes, ['FALSE_PUBLICATION_CONFIDENCE_EXCEEDS_THRESHOLD']);
});

test('each bound digest mismatch fails closed', () => {
  for (const field of Object.keys(DIGESTS)) {
    const decision = evaluate({ publication_input: publicationInput({ [field]: 'f'.repeat(64) }) });
    assert.equal(decision.disposition, PUBLICATION_DISPOSITIONS.WITHHELD, field);
    assert.ok(decision.reason_codes.includes('AUTHORITY_DIGEST_MISMATCH'), field);
  }
});

test('unknown family, unknown claim kind, binding mismatch, and disabled family fail closed', () => {
  const unknownFamily = evaluate({ publication_input: publicationInput({ family: 'UNKNOWN_FAMILY' }) });
  const unknownClaimKind = evaluate({ publication_input: publicationInput({ claim_kind: 'UNKNOWN_KIND' }) });
  const bindingMismatch = evaluate({ publication_input: publicationInput({ selected_rung: 3 }) });
  const disabled = evaluate({
    calibration_authority: buildCalibrationAuthority(authorityInput({
      family_switches: [{ family: 'TERMINATION_FEE', enabled: false, claim_kinds: ['AMOUNT'] }],
    })),
  });
  assert.ok(unknownFamily.reason_codes.includes('UNKNOWN_FAMILY'));
  assert.ok(unknownClaimKind.reason_codes.includes('UNKNOWN_CLAIM_KIND'));
  assert.ok(bindingMismatch.reason_codes.includes('AUTHORITY_BINDING_MISMATCH'));
  assert.ok(disabled.reason_codes.includes('FAMILY_DISABLED'));
  for (const decision of [unknownFamily, unknownClaimKind, bindingMismatch, disabled]) {
    assert.equal(decision.disposition, PUBLICATION_DISPOSITIONS.WITHHELD);
  }
});

test('every risk signal fails closed', () => {
  const cases = [
    ['structural_uncertainty', 'STRUCTURAL_UNCERTAINTY'],
    ['definition_ambiguity', 'DEFINITION_AMBIGUITY'],
    ['model_fallback', 'MODEL_FALLBACK'],
    ['party_attribution_risk', 'PARTY_ATTRIBUTION_RISK'],
  ];
  for (const [signal, reason] of cases) {
    const decision = evaluate({
      publication_input: publicationInput({ risk_signals: { ...publicationInput().risk_signals, [signal]: true } }),
    });
    assert.equal(decision.disposition, PUBLICATION_DISPOSITIONS.WITHHELD, signal);
    assert.ok(decision.reason_codes.includes(reason), signal);
  }
});

test('authority and decision identities are deterministic despite input ordering', () => {
  const first = buildCalibrationAuthority(authorityInput());
  const second = buildCalibrationAuthority(authorityInput({
    adjudicators: [
      { identity: 'adjudicator-a', calibration_score: 0.99 },
      { identity: 'adjudicator-b', calibration_score: 0.98 },
    ],
    family_switches: [{ family: 'TERMINATION_FEE', enabled: true, claim_kinds: ['TRIGGER', 'AMOUNT'] }],
  }));
  assert.equal(first.calibration_authority_id, second.calibration_authority_id);
  assert.equal(first.canonical_payload_digest, second.canonical_payload_digest);
  assert.equal(evaluate({ calibration_authority: first }).decision_id, evaluate({ calibration_authority: second }).decision_id);
});

test('built authority and decisions resist external mutation', () => {
  const authority = buildCalibrationAuthority(authorityInput());
  const decision = evaluate({ calibration_authority: authority });
  assert.ok(Object.isFrozen(authority));
  assert.ok(Object.isFrozen(authority.adjudicators));
  assert.ok(Object.isFrozen(authority.adjudicators[0]));
  assert.ok(Object.isFrozen(decision));
  assert.throws(() => { authority.family_switches[0].enabled = false; }, TypeError);
  assert.throws(() => { decision.reason_codes.push('MUTATED'); }, TypeError);
  assert.equal(evaluate({ calibration_authority: authority }).disposition, PUBLICATION_DISPOSITIONS.ELIGIBLE);
});

test('invalid authority, claim, decision, and UTF-8 schemas are rejected or fail closed', () => {
  assert.throws(
    () => buildCalibrationAuthority({}),
    (error) => error instanceof PublicationDispositionError && error.code === 'INVALID_CALIBRATION_AUTHORITY_SCHEMA',
  );
  assert.throws(
    () => buildCalibrationAuthority(authorityInput({ family: '\ud800' })),
    (error) => error.code === 'INVALID_CALIBRATION_AUTHORITY_SCHEMA',
  );
  const malformedAuthorityDecision = evaluate({ calibration_authority: { broken: true } });
  assert.deepEqual(malformedAuthorityDecision.reason_codes, ['INVALID_CALIBRATION_AUTHORITY']);
  const malformedInputDecision = evaluate({ publication_input: { ...publicationInput(), risk_signals: {} } });
  assert.deepEqual(malformedInputDecision.reason_codes, ['INVALID_PUBLICATION_INPUT']);
  assert.throws(
    () => validatePublicationDispositionDecision({}),
    (error) => error.code === 'INVALID_PUBLICATION_DECISION',
  );
});

test('decision validation rejects duplicate reason codes and unknown unattended dispositions', () => {
  const common = {
    schema_version: UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA,
    authority_id: null,
    prior_decision_id: null,
    prior_eligible_decision: null,
  };
  const duplicateReasons = decisionWithIdentity({
    ...common,
    disposition: UNATTENDED_PUBLICATION_DISPOSITIONS.WITHHELD,
    reason_codes: ['DUPLICATE_REASON', 'DUPLICATE_REASON'],
  });
  const unknownDisposition = decisionWithIdentity({
    ...common,
    disposition: 'UNKNOWN',
    reason_codes: ['UNKNOWN_DISPOSITION'],
  });
  for (const decision of [duplicateReasons, unknownDisposition]) {
    assert.throws(
      () => validatePublicationDispositionDecision(decision),
      (error) => error.code === 'INVALID_PUBLICATION_DECISION',
    );
  }
});

test('PUBLISHED is reachable only by the explicit transition from ELIGIBLE', () => {
  const eligible = evaluate();
  const published = transitionPublicationDisposition({
    decision: eligible,
    target_disposition: PUBLICATION_DISPOSITIONS.PUBLISHED,
  });
  assert.equal(published.disposition, PUBLICATION_DISPOSITIONS.PUBLISHED);
  assert.equal(published.prior_decision_id, eligible.decision_id);
  assert.deepEqual(published.prior_eligible_decision, eligible);
  assert.deepEqual(published.reason_codes, ['EXPLICIT_UNATTENDED_PUBLICATION_TRANSITION']);
  assert.doesNotThrow(() => validatePublicationDispositionDecision(published));

  const withheld = evaluate({ publication_input: publicationInput({ claim_kind: 'UNKNOWN_KIND' }) });
  for (const invalid of [
    { decision: withheld, target_disposition: PUBLICATION_DISPOSITIONS.PUBLISHED },
    { decision: eligible, target_disposition: PUBLICATION_DISPOSITIONS.WITHHELD },
    { decision: published, target_disposition: PUBLICATION_DISPOSITIONS.PUBLISHED },
  ]) {
    assert.throws(
      () => transitionPublicationDisposition(invalid),
      (error) => error.code === 'ILLEGAL_PUBLICATION_DISPOSITION_TRANSITION',
    );
  }

  const invalidPredecessor = decisionWithIdentity({
    schema_version: UNATTENDED_PUBLICATION_DISPOSITION_SCHEMA,
    disposition: UNATTENDED_PUBLICATION_DISPOSITIONS.PUBLISHED,
    authority_id: eligible.authority_id,
    reason_codes: ['EXPLICIT_UNATTENDED_PUBLICATION_TRANSITION'],
    prior_decision_id: withheld.decision_id,
    prior_eligible_decision: withheld,
  });
  assert.throws(
    () => validatePublicationDispositionDecision(invalidPredecessor),
    (error) => error.code === 'INVALID_PUBLICATION_DECISION',
  );
});

test('V2 sidecar is deterministic, withheld without authority, and rejects trace tampering', () => {
  const trace = {
    claim_revision_id: 'a'.repeat(64),
    run_receipt_id: 'b'.repeat(64),
    resolution_receipt_id: 'c'.repeat(64),
    evaluated_at: EVALUATION_TIME,
  };
  const withheld = buildPublicationDispositionV2(trace);
  assert.equal(withheld.schema_version, PUBLICATION_DISPOSITION_V2_SCHEMA);
  assert.equal(withheld.disposition, 'WITHHELD');
  assert.deepEqual(withheld.reason_codes, ['MISSING_CALIBRATION_AUTHORITY']);
  assert.doesNotThrow(() => validatePublicationDispositionV2(withheld, { rebuild: true }));

  const authority = buildCalibrationAuthority(authorityInput());
  const eligible = buildPublicationDispositionV2({
    ...trace,
    calibration_authority: authority,
    publication_input: publicationInput(),
    rebuild: true,
    canonical_validation_state: 'VALIDATED',
  });
  assert.equal(eligible.disposition, 'ELIGIBLE');
  assert.doesNotThrow(() => validatePublicationDispositionV2(eligible, {
    calibration_authority: authority,
    publication_input: publicationInput(),
  }));
  for (const field of [
    'claim_revision_id', 'run_receipt_id', 'resolution_receipt_id',
    'publication_input_digest', 'authority_id', 'decision_id', 'reason_codes',
  ]) {
    const tampered = { ...eligible, [field]: field === 'reason_codes' ? ['TAMPERED'] : 'd'.repeat(64) };
    assert.throws(() => validatePublicationDispositionV2(tampered, {
      calibration_authority: authority,
      publication_input: publicationInput(),
    }), /publication disposition/i, field);
  }
});

test('the V2 validator rebuilds the evaluator result when asked to validate a write-set sidecar', () => {
  const authority = buildCalibrationAuthority(authorityInput());
  const trace = {
    claim_revision_id: 'a'.repeat(64),
    run_receipt_id: 'b'.repeat(64),
    resolution_receipt_id: 'c'.repeat(64),
    evaluated_at: EVALUATION_TIME,
    calibration_authority: authority,
    publication_input: publicationInput(),
    canonical_validation_state: 'VALIDATED',
  };
  const eligible = buildPublicationDispositionV2(trace);
  const { decision_id: _oldDecisionId, ...forgedBody } = eligible;
  const forged = {
    ...forgedBody,
    disposition: 'WITHHELD',
    reason_codes: ['MISSING_CALIBRATION_AUTHORITY'],
  };
  forged.decision_id = contentId(PUBLICATION_DISPOSITION_V2_SCHEMA, forged);
  assert.doesNotThrow(() => validatePublicationDispositionV2(forged));
  assert.throws(
    () => validatePublicationDispositionV2(forged, {
      calibration_authority: authority,
      publication_input: publicationInput(),
      rebuild: true,
    }),
    /independent evaluation/,
  );
});
