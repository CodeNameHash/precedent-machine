'use strict';

/**
 * tests/canonical-v2-no-other-reps-fraud-negation-investigation.test.js
 *
 * PLAN.md Step 3E ("Close the same negation gap in the third bridge"),
 * measured, not asserted from prose. `no-other-reps-fraud-dark-bridge.js`
 * already documents why the negation-boundary fix representations-dark-
 * bridge.js shipped was tried here and reverted (docs/codex-program/notes/
 * negation-reversal.md, section 6). This file re-checks that finding
 * directly, against the shared, unmodified `lib/negation-boundary-guard.js`
 * (the module the note's own illustrative fix names as "already safe to
 * import" -- not one of the two files this task owns, not edited) and
 * against this family's own real, committed fixture -- rather than trusting
 * the note's prose without re-running it.
 *
 * WHAT THIS PROVES, IN ORDER:
 *   1. The shared guard genuinely can catch representations-dark-bridge.js's
 *      own hostile case (modal-verb + "not"), reused verbatim -- the
 *      detection mechanism itself is sound and portable.
 *   2. It does NOT catch this family's own, already-documented KNOWN
 *      LIMITATION case ("no Company Party makes...") -- "no Company"/"no
 *      Party" are not in the guard's deliberately closed "no <noun>" list,
 *      so wiring the guard in unmodified, at the attribute-grounding
 *      checkpoint, would not even close the gap this family's own test
 *      already names.
 *   3. Applying the guard broadly to this family's `_quote`-suffixed
 *      attributes -- the only place in this bridge a negation-boundary
 *      check could attach to at all (see the `groundedInSource` header
 *      comment in the production file) -- false-positives on TWO real,
 *      legitimate, currently-accepted values in this family's one real
 *      fixture, not the one the note found. The note's own proposed
 *      refinement (exempt a value beginning with an "except"/"excluding"/
 *      "other than"/"but for"/"save for" lead-in) closes the first
 *      (`non_reliance.agreement_scope_quote`, "except those expressly set
 *      forth...") but NOT the second
 *      (`non_reliance.extra_contractual_scope_quote`, "including
 *      projections, forecasts..." -- a scope descriptor that is not itself
 *      an "except"-shaped clause, but sits after the exact same "is not
 *      relying" negation in the exact same sentence). This is new evidence
 *      beyond what the note recorded, found by re-running the note's own
 *      proposed fix against this family's real corpus text rather than
 *      trusting it unverified.
 *   4. The family's genuine cards -- unmodified, no attempted fix wired in
 *      -- still render, via the bridge's own real build path.
 *
 * CONCLUSION (see docs/codex-program/notes/step-3b-3e.md for the full
 * writeup): this is exactly the false-positive shape the note already
 * flagged, now confirmed to be BROADER than one field on the only real
 * corpus text available for this family. Per PLAN.md Step 3E's own
 * acceptance criteria, this is grounds to stop rather than ship a heuristic
 * that has now failed real-fixture validation twice, once again over a
 * SECOND real field the first time round never tested. No change was made
 * to no-other-reps-fraud-dark-bridge.js's grounding/negation logic.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { hasUnclosedNegationBeforeSpan } = require('../lib/negation-boundary-guard');
const {
  shapeNoOtherRepsFraudProposals,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-producer');
const {
  resolveNoOtherRepsFraudProposals,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-resolution');
const {
  projectNoOtherRepsFraudProduct,
} = require('../lib/canonical-v2/no-other-reps-fraud-product-projection');
const {
  bridgeNoOtherRepsFraudCardsToLegacyShape,
  validateBridgeEnvelope,
} = require('../lib/canonical-v2/no-other-reps-fraud-dark-bridge');

const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'canonical-v2',
  'dark-bridge',
  'no-other-reps-fraud-dark-review.json',
);
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });

// The proposed-but-unvalidated exemption from docs/codex-program/notes/
// negation-reversal.md section 6, reproduced here exactly (not altered) so
// this test measures the note's own proposal, not a straw version of it.
const CARVE_OUT_LEAD_IN_RE = /^(?:except|excluding|other\s+than|but\s+for|save\s+for)\b/i;

function sourceTextFor(fixture) {
  return [
    fixture.assertions.no_other_reps.assertion_quote,
    fixture.assertions.non_reliance.assertion_quote,
    fixture.assertions.independent_investigation.assertion_quote,
    fixture.assertions.fraud_carveout.assertion_quote,
    fixture.assertions.willful_breach_definition.definition_quote,
  ].join('\n\n');
}

function buildRealProjectionAndResolution(fixture = FIXTURE) {
  const sourceText = sourceTextFor(fixture);
  const a = fixture.assertions;
  const parsed = {
    no_other_reps_assertions: [a.no_other_reps],
    non_reliance_assertions: [a.non_reliance],
    independent_investigation_assertions: [a.independent_investigation],
    fraud_carveout_assertions: [a.fraud_carveout],
    willful_breach_definitions: [a.willful_breach_definition],
    open_world_candidates: [],
  };
  const { proposals } = shapeNoOtherRepsFraudProposals(parsed, sourceText);
  assert.equal(proposals.length, 6, 'fixture must yield all six governed claim types');
  const receipt = resolveNoOtherRepsFraudProposals({
    proposals, source_text: sourceText, source_id: fixture.deal_id,
  });
  const projection = projectNoOtherRepsFraudProduct(receipt, { deal_id: fixture.deal_id });
  return { projection, resolved: receipt.resolved };
}

test('1. the shared guard catches representations-dark-bridge.js\'s own hostile case, reused verbatim', () => {
  const source = 'except as would not have a Company Material Adverse Effect, and the Company has actual '
    + 'knowledge of no fact';
  const fragment = 'have a Company Material Adverse Effect';
  const idx = source.indexOf(fragment);
  assert.ok(idx > 0);
  assert.equal(hasUnclosedNegationBeforeSpan(source, idx), true);
});

test('2. the shared guard does NOT catch this family\'s own KNOWN LIMITATION case ("no Company Party..."), unmodified', () => {
  const original = FIXTURE.assertions.no_other_reps.assertion_quote;
  const negated = 'Company Party makes any express or implied representation or warranty with respect to the Company.';
  assert.ok(original.endsWith(negated));
  const idx = original.indexOf(negated);
  assert.equal(
    hasUnclosedNegationBeforeSpan(original, idx),
    false,
    'wiring the unmodified shared guard in at the attribute checkpoint would not close this family\'s own '
    + 'documented gap: "no Company"/"no Party" are outside NEGATION_LEAD_IN_RES\'s deliberately closed "no '
    + '<noun>" list',
  );
});

test('3a. the note\'s already-found false positive reproduces: non_reliance.agreement_scope_quote', () => {
  const evidenceText = FIXTURE.assertions.non_reliance.assertion_quote;
  const value = FIXTURE.assertions.non_reliance.agreement_scope_quote;
  const idx = evidenceText.indexOf(value);
  assert.ok(idx > 0);
  assert.equal(hasUnclosedNegationBeforeSpan(evidenceText, idx), true);
  // The note's proposed lead-in exemption WOULD close this one.
  assert.equal(CARVE_OUT_LEAD_IN_RE.test(value), true);
});

test('3b. NEW: the note\'s proposed exemption does not close a second, real false positive on the same fixture -- non_reliance.extra_contractual_scope_quote', () => {
  const evidenceText = FIXTURE.assertions.non_reliance.assertion_quote;
  const value = FIXTURE.assertions.non_reliance.extra_contractual_scope_quote;
  const idx = evidenceText.indexOf(value);
  assert.ok(idx > 0);
  assert.equal(
    hasUnclosedNegationBeforeSpan(evidenceText, idx),
    true,
    'this is a real, legitimate, currently-accepted attribute value; a broad negation guard on `_quote` '
    + 'attributes would reject it',
  );
  // "including projections, forecasts..." does not begin with the note's
  // proposed exemption's lead-in vocabulary, so the proposed fix does not
  // save this field the way it saves 3a's.
  assert.equal(
    CARVE_OUT_LEAD_IN_RE.test(value),
    false,
    'the note\'s proposed except/excluding/other-than/but-for/save-for exemption does not recognise this '
    + 'field\'s own real lead-in ("including"), so it would still be false-positived',
  );
});

test('3c. a `_ref` field sitting after the same unrelated negation is also a false positive if not exempted by field name -- confirms the note\'s validated first step is still necessary', () => {
  const evidenceText = FIXTURE.assertions.non_reliance.assertion_quote;
  const value = FIXTURE.assertions.non_reliance.disclaimed_representation_party_ref;
  const idx = evidenceText.indexOf(value);
  assert.ok(idx > 0);
  assert.equal(hasUnclosedNegationBeforeSpan(evidenceText, idx), true);
});

test('4. with no fix wired in, the family\'s genuine cards still render end to end, unmodified', () => {
  const { projection, resolved } = buildRealProjectionAndResolution();
  const bridge = bridgeNoOtherRepsFraudCardsToLegacyShape(
    projection,
    { deal_id: FIXTURE.deal_id, resolved, env: ENABLED_ENV },
  );
  assert.equal(bridge.cards.length, 6);
  assert.doesNotThrow(() => validateBridgeEnvelope(bridge, ENABLED_ENV));
});
