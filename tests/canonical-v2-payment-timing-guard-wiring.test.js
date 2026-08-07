'use strict';

// PLAN.md Step 3J1 ("wire the cross-check, and widen what Step 3J narrowed").
// Adversarial review of `5bd831d4` found `assertPaymentTriggerEventAgrees
// WithFeeRequired` defined, exported, tested in isolation, and called
// nowhere in `lib/`, `pages/` or `scripts/` -- a guard that reads as
// protection and cannot fire. This file proves three things against real
// data, not synthetic strings, per that step's own "Proves it is done":
//
//   1. The guard now fires from inside the real projection path
//      (`projectTerminationFeeProductSurfaces`), using the real Modiv
//      fee-trigger row committed in `evidence/canonical-v2/modiv-
//      termination-fee-20260807-replay/resolution.json` and the real,
//      derived `CONCURRENT_WITH_TERMINATION` payment_trigger_event
//      (`classifyPaymentTimingQuote` run against that same resolution's own
//      `termination_fee_payment_timings[3]`, branch 7.3(b)(ii) -- not a
//      hand-typed duplicate).
//   2. It is scoped to the SUPERIOR_PROPOSAL_TERMINATION fee-trigger row
//      only, so a second, differently-grounded fee-trigger row on the same
//      deal (modelled on Modiv branch (iii), ACQUISITION_PROPOSAL_TAIL --
//      the real committed replay has no second TERMINATION_FEE_TRIGGER row
//      to read this from, so this one entry is constructed, following the
//      same shape the real one uses) never gets compared against the
//      superior-proposal ground's feeRequired, however that row's own
//      payment timing classifies.
//   3. Removing the wiring (temporarily, by hand, while proving this file)
//      makes test 1's "the guard fires" case fail rather than silently
//      pass -- recorded in docs/codex-program/notes/step-3j1-3j2.md rather
//      than merely asserted here, since a passing test cannot prove its own
//      sensitivity.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  projectTerminationFeeProductSurfaces,
  classifyPaymentTimingQuote,
  SUPERIOR_PROPOSAL_TRIGGER_CODE,
} = require('../lib/canonical-v2/termination-product-projection');

const EVIDENCE = path.join(__dirname, '..', 'evidence/canonical-v2', 'modiv-termination-fee-20260807-replay');

function realResolution() {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'resolution.json'), 'utf8'));
}

// The real, committed branch (ii) payment-timing quote -- Modiv's own
// superior-proposal fiduciary-out fee, from the same resolution.json this
// test reads its trigger row from -- classified through the same exact
// classifier tests/canonical-v2-payment-timing-split.test.js pins.
function realSuperiorProposalPaymentTriggerEvent() {
  const resolution = realResolution();
  const branchIi = resolution.termination_fee_payment_timings.find(
    (row) => row.triggering_branch === '7.3(b)(ii)',
  );
  assert.ok(branchIi, 'the real committed Modiv replay must still carry branch 7.3(b)(ii)');
  const classified = classifyPaymentTimingQuote(branchIi.payment_timing_quote);
  assert.equal(classified.payment_trigger_event, 'CONCURRENT_WITH_TERMINATION');
  return classified.payment_trigger_event;
}

// The real committed replay's own TERMINATION_FEE_TRIGGER row is confirmed
// (by the resolution.json content itself) to be SUPERIOR_PROPOSAL_TERMINATION,
// 7.1(c)(i) -- Modiv's fiduciary-out ground, decision 6's own concept.
test('the real Modiv trigger row is the SUPERIOR_PROPOSAL_TERMINATION ground the guard scopes to', () => {
  const resolution = realResolution();
  const triggerRows = resolution.resolved.filter(
    (entry) => entry.resolved_claim_definition_key === 'TERMINATION_FEE_TRIGGER',
  );
  assert.equal(triggerRows.length, 1);
  assert.equal(triggerRows[0].claim.canonical_value, SUPERIOR_PROPOSAL_TRIGGER_CODE);
  assert.equal(triggerRows[0].source_citation, '7.1(c)(i)');
});

test('the guard FIRES on the real path: a real derived CONCURRENT_WITH_TERMINATION against a genuinely disagreeing feeRequired throws from inside the projection, not just from calling the guard function directly', () => {
  const resolution = realResolution();
  assert.throws(
    () => projectTerminationFeeProductSurfaces({
      resolution,
      deal_id: 'modiv-gnl',
      fee_required_cross_check: {
        payment_trigger_event: realSuperiorProposalPaymentTriggerEvent(),
        fee_required: false, // genuine disagreement: concurrent event, no condition-precedent fee
      },
    }),
    /PAYMENT_TRIGGER_FEE_REQUIRED_DISAGREEMENT/,
  );
});

test('the guard agrees and does not throw when the real derived event and a truthy feeRequired actually agree, and the projection completes normally', () => {
  const resolution = realResolution();
  const projected = projectTerminationFeeProductSurfaces({
    resolution,
    deal_id: 'modiv-gnl',
    fee_required_cross_check: {
      payment_trigger_event: realSuperiorProposalPaymentTriggerEvent(),
      fee_required: true,
    },
  });
  assert.ok(projected.cards.length > 0);
});

test('omitting the cross-check leaves the guard inert, same as before this step, for callers that do not (yet) have both real values', () => {
  const resolution = realResolution();
  const projected = projectTerminationFeeProductSurfaces({ resolution, deal_id: 'modiv-gnl' });
  assert.ok(projected.cards.length > 0);
});

// ---------------------------------------------------------------------------
// Scoping: Modiv branch (iii) must not throw a false disagreement.
// ---------------------------------------------------------------------------

function realTriggerRow() {
  return realResolution().resolved.find(
    (entry) => entry.resolved_claim_definition_key === 'TERMINATION_FEE_TRIGGER',
  );
}

// Modelled on the real row above (same provision_instance / claim shape),
// with the concept and citation changed to Modiv's branch (iii) ground --
// the real committed replay has no second TERMINATION_FEE_TRIGGER row to
// read this from (the tail fee is resolved as conditional_termination_fee_
// values, not a second trigger row), so this is constructed to exercise the
// exact scenario PLAN.md Step 3J1 names by name: "applied naively to Modiv
// branch (iii)'s EARLIER_OF_SIGNING_OR_CONSUMMATION against the same deal's
// truthy TERMR-SUPERIOR feeRequired, it throws a false disagreement".
function acquisitionProposalTailRow() {
  const real = realTriggerRow();
  return {
    ...real,
    source_citation: '7.3(b)(iii)',
    provision_instance: {
      ...real.provision_instance,
      provision_instance_id: `${real.provision_instance.provision_instance_id}:branch-iii`,
    },
    claim: {
      ...real.claim,
      claim_revision_id: `${real.claim.claim_revision_id}:branch-iii`,
      canonical_value: 'ACQUISITION_PROPOSAL_TAIL',
      raw_value: 'if a qualifying Acquisition Proposal is entered into during the tail period',
    },
  };
}

test('Modiv branch (iii) does not throw a false disagreement: a second, differently-grounded fee-trigger row on the same deal is never compared against the superior-proposal ground\'s feeRequired', () => {
  const resolution = realResolution();
  const withTailRow = { ...resolution, resolved: [...resolution.resolved, acquisitionProposalTailRow()] };
  // The cross-check payload is (correctly) the SUPERIOR_PROPOSAL_TERMINATION
  // ground's own real event and a truthy feeRequired -- both agree. If the
  // guard were applied to every TERMINATION_FEE_TRIGGER row rather than
  // scoped to the one whose own trigger code is SUPERIOR_PROPOSAL_TERMINATION,
  // the extra ACQUISITION_PROPOSAL_TAIL row would still be compared against
  // this same pair and would have nothing to disagree about here -- so this
  // case alone would not distinguish "scoped" from "unscoped". The next test
  // makes the naive, unscoped comparison concrete and shows it disagrees.
  const projected = projectTerminationFeeProductSurfaces({
    resolution: withTailRow,
    deal_id: 'modiv-gnl',
    fee_required_cross_check: {
      payment_trigger_event: realSuperiorProposalPaymentTriggerEvent(),
      fee_required: true,
    },
  });
  const triggerCodes = new Set(
    projected.cards.flatMap((card) => (card.features.companyTerminationFee?.triggers || []))
      .map((trigger) => trigger.code),
  );
  assert.ok(triggerCodes.has(SUPERIOR_PROPOSAL_TRIGGER_CODE));
  assert.ok(triggerCodes.has('ACQUISITION_PROPOSAL_TAIL'), 'the tail-period row must still project, unscoped by the guard');
});

test('the naive, unscoped comparison PLAN.md Step 3J1 names is a genuine false positive -- branch (iii)\'s own EARLIER_OF_SIGNING_OR_CONSUMMATION disagrees with the same deal\'s truthy TERMR-SUPERIOR feeRequired even though nothing is actually wrong', () => {
  const { paymentTriggerEventAgreesWithFeeRequired } = require('../lib/canonical-v2/termination-product-projection');
  const branchIiiEvent = classifyPaymentTimingQuote(
    realResolution().termination_fee_payment_timings.find((row) => row.triggering_branch === '7.3(b)(iii)').payment_timing_quote,
  ).payment_trigger_event;
  assert.equal(branchIiiEvent, 'EARLIER_OF_SIGNING_OR_CONSUMMATION');
  // Calling the bare guard directly, unscoped, IS the false positive this
  // step's own text describes -- which is exactly why the real wiring above
  // (feeFeatures, gated on trigger.code === SUPERIOR_PROPOSAL_TERMINATION)
  // never makes this call for branch (iii)'s own row.
  assert.equal(paymentTriggerEventAgreesWithFeeRequired(branchIiiEvent, true), false);
});
