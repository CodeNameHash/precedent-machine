// SPEC-QXO-TERMF-AMENDMENT-2026-07-23 / PROPOSAL-TERMF-TRIGGER-VOCABULARY-2026-07-23.
//
// Covers the Step 0 fingerprint-stability guarantee, the QXO termination-fee
// fixture's replay through the WP-EXP-01 harness, and composition proof that
// every new trigger_code/trigger_condition/payment_timing value appears with its
// exact, spec-pinned conditions and timing.

const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const { adaptSharedServingRow } = require('../lib/canonical-v2/shared-row-adapter');
const { buildQxoTerminationFeeFixture } = require('../__fixtures__/canonical-v2/qxo-termination-fee-row');

const FROZEN_FINGERPRINT = '56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d';

// ---------------------------------------------------------------------------
// Step 0: the vocabulary additions must not move compileFixtureContract()'s
// fingerprint. This is empirical, not aspirational: trigger_code / trigger_
// condition / payment_timing are validated inside relationship `effect`
// payloads (lib/canonical-v2/shared-serving-row.js) and displayed via
// lib/canonical-v2/shared-row-adapter.js — neither file is part of
// FIXTURE_CONTRACT_INPUT (lib/canonical-v2/contract-bundle.js), so extending
// them cannot change the compiled contract's content hash.
// ---------------------------------------------------------------------------

test('compileFixtureContract().fingerprint is unchanged by the trigger-vocabulary amendment', () => {
  const bundle = compileFixtureContract();
  assert.equal(bundle.fingerprint, FROZEN_FINGERPRINT);
});

test('the frozen fixture contract input carries no trigger_code/condition/timing vocabulary of its own', () => {
  const bundle = compileFixtureContract();
  const payload = canonicalJson(bundle);
  // The vocabulary lives entirely in relationship *instance* effect data, never
  // in the frozen contract's definitions.
  assert.equal(payload.includes('NO_SOLICIT_BREACH_TERMINATION'), false);
  assert.equal(payload.includes('STOCKHOLDER_APPROVAL_FAILURE_TERMINATION'), false);
  assert.equal(payload.includes('UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION'), false);
});

test('the existing Landos reviewed termination-fee fixture is untouched by the amendment', () => {
  const { buildReviewedTerminationFeeSlice } = require('../lib/canonical-v2/reviewed-termination-fee-slice');
  const fs = require('node:fs');
  const agreementText = fs.readFileSync('__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'utf8');
  const dealValueSourceText = fs.readFileSync('__fixtures__/canonical-v2/landos-deal-value-sec-excerpt.txt', 'utf8');
  const contractBundle = compileFixtureContract();
  const slice = buildReviewedTerminationFeeSlice({ agreementText, dealValueSourceText, contractBundle });
  const codes = slice.triggerRelationships.map((row) => row.effect.trigger_code);
  assert.deepEqual(codes, [
    'SUPERIOR_PROPOSAL_TERMINATION',
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'ACQUISITION_PROPOSAL_TAIL',
  ]);
});

// ---------------------------------------------------------------------------
// Step 2/3: the QXO fixture replays cleanly through the harness and produces a
// valid shared serving row under the (now-extended) frozen serving-row
// validator.
// ---------------------------------------------------------------------------

test('the QXO termination-fee fixture builds a valid shared serving row', () => {
  const fixture = buildQxoTerminationFeeFixture();
  assert.doesNotThrow(() => validateSharedServingRow(fixture.row));
  assert.equal(fixture.row.governed_deal_key, 'deal:qxo-topbuild');
  assert.equal(fixture.row.canonical_result.market_context.metric_key, 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE');
});

test('the QXO fixture is deterministic: two builds produce byte-identical harness output', () => {
  const a = buildQxoTerminationFeeFixture();
  const b = buildQxoTerminationFeeFixture();
  assert.equal(canonicalJson(a.harness), canonicalJson(b.harness));
  assert.equal(canonicalJson(a.row), canonicalJson(b.row));
});

test('the QXO fixture adapts to the typed-market UI adapter without throwing', () => {
  const fixture = buildQxoTerminationFeeFixture();
  assert.doesNotThrow(() => adaptSharedServingRow(fixture.row));
});

// ---------------------------------------------------------------------------
// Composition proof: every new code appears with its exact conditions/timing,
// per SPEC-QXO-TERMF-AMENDMENT-2026-07-23 Step 2 (binding).
// ---------------------------------------------------------------------------

const TAIL_CONDITIONS = [
  'COMPETING_PROPOSAL_PUBLICLY_PENDING',
  'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
  'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
];

const EXPECTED_RELATIONSHIPS = [
  {
    trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
    terminating_party: 'PARENT',
    payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
    conditions: [],
  },
  {
    trigger_code: 'NO_SOLICIT_BREACH_TERMINATION',
    terminating_party: 'PARENT',
    payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
    conditions: [],
  },
  {
    trigger_code: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
    terminating_party: 'EITHER_OR_PARENT_AS_SPECIFIED',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: [...TAIL_CONDITIONS, 'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED'],
  },
  {
    trigger_code: 'NO_SOLICIT_BREACH_TERMINATION',
    terminating_party: 'PARENT',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: TAIL_CONDITIONS,
  },
  {
    trigger_code: 'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
    terminating_party: 'PARENT',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: TAIL_CONDITIONS,
  },
  {
    trigger_code: 'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
    terminating_party: 'PARENT',
    payment_timing: 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION',
    conditions: TAIL_CONDITIONS,
  },
];

test('the QXO fixture composes exactly the six spec-bound trigger relationships (codes/conditions/timing)', () => {
  const fixture = buildQxoTerminationFeeFixture();
  const effects = fixture.row.canonical_result.components[0].bounded_relationship_effects.map((row) => row.effect);
  assert.equal(effects.length, 6);
  for (const expected of EXPECTED_RELATIONSHIPS) {
    const matches = effects.filter((effect) => (
      effect.trigger_code === expected.trigger_code
      && effect.terminating_party === expected.terminating_party
      && effect.payment_timing === expected.payment_timing
      && canonicalJson([...effect.conditions].sort()) === canonicalJson([...expected.conditions].sort())
    ));
    assert.equal(
      matches.length,
      1,
      `expected exactly one relationship matching ${JSON.stringify(expected)}, found ${matches.length}`,
    );
  }
});

test('NO_SOLICIT_BREACH_TERMINATION composes onto two distinct pathways sharing one ground code', () => {
  const fixture = buildQxoTerminationFeeFixture();
  const effects = fixture.row.canonical_result.components[0].bounded_relationship_effects.map((row) => row.effect);
  const noSolicit = effects.filter((effect) => effect.trigger_code === 'NO_SOLICIT_BREACH_TERMINATION');
  assert.equal(noSolicit.length, 2);
  assert.equal(canonicalJson(noSolicit[0]) === canonicalJson(noSolicit[1]), false);
});

test('vote-failure is tail-only: no immediate-timing relationship carries STOCKHOLDER_APPROVAL_FAILURE_TERMINATION', () => {
  const fixture = buildQxoTerminationFeeFixture();
  const effects = fixture.row.canonical_result.components[0].bounded_relationship_effects.map((row) => row.effect);
  const voteFailure = effects.filter((effect) => effect.trigger_code === 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION');
  assert.equal(voteFailure.length, 1);
  assert.equal(voteFailure[0].payment_timing, 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION');
});

test('no legacy-card artifacts: no 8.02 citations, no 18-month tail, no reverse/Parent-fee row', () => {
  const fixture = buildQxoTerminationFeeFixture();
  const payload = canonicalJson(fixture.harness);
  assert.equal(payload.includes('8.02'), false);
  assert.equal(payload.includes('eighteen'), false);
  assert.equal(payload.includes('18-month'), false);
  assert.equal(fixture.row.canonical_result.party.value, 'COMPANY');
  assert.equal(fixture.row.canonical_result.components[0].claim_attributes.fee_side, 'SELLER');
});

test('the source excerpts are quoted verbatim from the filed EDGAR agreement (spot checks)', () => {
  const fs = require('node:fs');
  const text = fs.readFileSync('__fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.txt', 'utf8');
  assert.match(text, /\$600,000,000/);
  assert.match(text, /Company Adverse Recommendation Change/);
  assert.match(text, /Company Intervening Event Recommendation Change/);
  assert.match(text, /materially breaches its obligations under Section 4\.3/);
  assert.match(text, /Company Stockholder Approval shall not have been obtained/);
});
