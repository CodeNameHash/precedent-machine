'use strict';

// Tests lib/canonical-v2/review-preview-assembly.js's attachCanonicalV2Preview
// -- the server-side seam wired into pages/api/review/[id]/cards.js (between
// fetchReviewDealCards and trimReviewDealForWire; see the comment at that
// call site for why that seam, not fetchReviewDealCards itself, was chosen).
// Route files use ESM `import`, which plain `node --test` can't load
// directly (see lib/queries/review-deal-wire.js's own header comment for the
// same constraint) -- this suite exercises the assembler directly, the
// require()-able seam the route delegates to.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  attachCanonicalV2Preview,
  assembleCanonicalV2Preview,
  CANONICAL_V2_PREVIEW_STATE,
} = require('../lib/canonical-v2/review-preview-assembly');
const { DARK_BRIDGE_GATE_REASON } = require('../lib/canonical-v2/dark-bridge-gate');
const { shapeReviewDealRows } = require('../lib/queries/review-deal');
const { CARD_SCHEMA: REPRESENTATIONS_CARD_SCHEMA } = require('../lib/canonical-v2/representations-dark-bridge');

const ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });
const DISABLED_ENV = Object.freeze({});
const ASSEMBLER_PATH = path.join(__dirname, '..', 'lib', 'canonical-v2', 'review-preview-assembly.js');

const BASE_DEAL_ID = 'preview-route-fixture-deal';

// A logger that records instead of printing: the assembler reports every
// REFUSED/FAILED outcome to a log sink, and these suites both assert that it
// did and keep the real console clean while deliberately breaking things.
function capturingLogger() {
  const lines = [];
  return {
    lines,
    warn: (...args) => lines.push({ level: 'warn', args }),
    error: (...args) => lines.push({ level: 'error', args }),
  };
}

// The legacy half of a review deal -- everything a reviewer's page is built
// from -- with only the two preview stamps removed. Used to prove a failed or
// refused preview left the served deal's real content untouched.
function legacyContent(deal) {
  const {
    canonical_v2_preview_enabled: previewEnabled,
    canonical_v2_preview_status: previewStatus,
    ...rest
  } = deal;
  return rest;
}

function buildBaseReviewDeal() {
  return shapeReviewDealRows(BASE_DEAL_ID, [{
    id: 'legacy-existing-card',
    deal_id: BASE_DEAL_ID,
    provision_instance_id: 'legacy-existing-card',
    excerpt_id: 'legacy-existing-card:0',
    section_ref: '1.1',
    short_title: 'Pre-existing legacy row',
    kind: 'standard',
    provision_type: 'MISC_BOILERPLATE',
    provision_subtype: 'MISC-NOTICES',
    primary_quote: 'This is an ordinary legacy row, untouched by the preview.',
    region_full_text: 'This is an ordinary legacy row, untouched by the preview.',
    references: [],
  }], { claims: [] });
}

test('gate off: returned review deal is byte-identical (same reference) to the un-attached one, with no canonical_v2_preview_enabled field', async () => {
  const reviewDeal = buildBaseReviewDeal();
  const result = await attachCanonicalV2Preview(reviewDeal, { env: DISABLED_ENV });
  assert.equal(result, reviewDeal, 'gate-off must return the identical object reference, not a copy');
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'canonical_v2_preview_enabled'),
    false,
    'gate-off must never add canonical_v2_preview_enabled',
  );
});

test('gate on: all four areas dark cards land in one review deal, flagged, every dark card VALIDATED_NOT_SERVED', async () => {
  const reviewDeal = buildBaseReviewDeal();
  const result = await attachCanonicalV2Preview(reviewDeal, { env: ENABLED_ENV });

  assert.notEqual(result, reviewDeal, 'gate-on must return a new object, not mutate the original');
  assert.equal(result.canonical_v2_preview_enabled, true);

  // The original reviewDeal object itself must stay completely untouched.
  assert.equal(reviewDeal.cardCount, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(reviewDeal, 'canonical_v2_preview_enabled'), false);

  // Pre-existing legacy card survives, unchanged, in the merged result.
  const survivingLegacy = result.cards.find((card) => card.id === 'legacy-existing-card');
  assert.ok(survivingLegacy, 'pre-existing legacy card must survive the merge');
  assert.equal(survivingLegacy.authority_state, undefined, 'the legacy card must not itself be stamped dark');

  const addedCards = result.cards.filter((card) => card.id !== 'legacy-existing-card');
  assert.ok(addedCards.length > 0, 'at least one dark preview card must have been added');
  assert.equal(result.cardCount, reviewDeal.cardCount + addedCards.length);
  assert.ok(
    addedCards.every((card) => card.authority_state === 'VALIDATED_NOT_SERVED'),
    'every added dark card must carry authority_state VALIDATED_NOT_SERVED',
  );
  assert.ok(
    addedCards.every((card) => card.deal_id === BASE_DEAL_ID),
    'every added dark card must be stamped with the real reviewDeal.dealId, not a fixture-baked one',
  );

  // Each of the four areas is present -- identified by a marker unique to
  // that family's own bridge card shape (see each bridge module's own
  // assert*CardKind / closed field list).
  const materialContractsCards = addedCards.filter((card) => card.provision_subtype === 'REP-T-MATERIAL-CONTRACTS');
  const generalCovenantsCards = addedCards.filter((card) => card.type === 'COV');
  const noOtherRepsFraudCards = addedCards.filter((card) => Object.hasOwn(card, 'claim_definition_key'));
  const representationsCards = addedCards.filter((card) => card.schema_version === REPRESENTATIONS_CARD_SCHEMA);

  assert.ok(materialContractsCards.length > 0, 'Material Contracts dark card must be present');
  assert.ok(generalCovenantsCards.length > 0, 'General Covenants dark card(s) must be present');
  assert.ok(noOtherRepsFraudCards.length > 0, 'No Other Reps / Fraud dark card(s) must be present');
  assert.ok(representationsCards.length > 0, 'Representations dark card(s) must be present');

  // The four markers are mutually exclusive and jointly exhaustive over the
  // added cards -- proves every added card is accounted for by exactly one
  // family, not double-counted or orphaned.
  assert.equal(
    materialContractsCards.length + generalCovenantsCards.length
      + noOtherRepsFraudCards.length + representationsCards.length,
    addedCards.length,
  );

  // F3/F11: a second real call site (independent of tests/canonical-v2-
  // review-preview-end-to-end.test.js's own fuller proof) confirming the
  // chained merge left the deal with exactly one receipt per family, on the
  // shared key, and an internally consistent cardCount/cards/sections view.
  assert.equal(result.canonical_v2_bridge_receipts.length, 4, 'a four-family chain must leave exactly four receipts');
  assert.equal(
    new Set(result.canonical_v2_bridge_receipts.map((receipt) => receipt.bridge_id)).size,
    4,
    'every receipt must have a distinct bridge_id',
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, 'canonical_v2_no_other_reps_fraud_bridge_receipts'),
    false,
    'the retired distinct receipts key must not reappear',
  );
  assert.equal(result.cards.length, result.cardCount);
  assert.equal(
    result.sections.reduce((total, section) => total + section.cards.length, 0),
    result.cardCount,
    'sections must cover every card, not stay stale after an intermediate family merged',
  );
});

// =============================================================================
// Defect 1: a throwing canonical path used to be swallowed by attachCanonical
// V2Preview's catch and returned as the untouched legacy reviewDeal -- byte-
// identical to a clean gate-off no-op. A Canonical-V2-vs-legacy comparison run
// against that result compares legacy against legacy and passes perfectly
// while proving nothing. The failure must still not break the page, but it
// must be visible to a caller that asks.
// =============================================================================

const CORRUPT_FIXTURE_CASES = Object.freeze({
  materialContracts: { section_reference: '3.13' },
  generalCovenants: { section_reference: '6.05' },
  noOtherRepsFraud: { deal_id: 'corrupt' },
  representations: { deal_id: 'corrupt' },
});

const CORRUPT_FIXTURE_PHASES = Object.freeze({
  materialContracts: 'MATERIAL_CONTRACTS',
  generalCovenants: 'GENERAL_COVENANTS',
  noOtherRepsFraud: 'NO_OTHER_REPS_FRAUD',
  representations: 'REPRESENTATIONS',
});

test('gate on with a deliberately corrupted fixture: nothing throws, the legacy deal is served intact, and the failure is reported as FAILED', async () => {
  for (const [familyKey, corruptFixture] of Object.entries(CORRUPT_FIXTURE_CASES)) {
    const reviewDeal = buildBaseReviewDeal();
    const logger = capturingLogger();
    const { reviewDeal: result, outcome } = await assembleCanonicalV2Preview(reviewDeal, {
      env: ENABLED_ENV,
      fixtures: { [familyKey]: corruptFixture },
      logger,
    });

    // The page survives: no throw, and every field the review page renders
    // from is the legacy deal's own, untouched -- not a partial merge.
    assert.deepEqual(
      legacyContent(result),
      legacyContent(reviewDeal),
      `a corrupted ${familyKey} fixture must serve the legacy deal's content unchanged`,
    );
    assert.equal(result.cardCount, 1, `a corrupted ${familyKey} fixture must not leave a partially-merged deal`);
    assert.equal(result.cards.length, 1);
    assert.equal(
      result.cards.some((card) => card.authority_state === 'VALIDATED_NOT_SERVED'),
      false,
      `a corrupted ${familyKey} fixture must leave no dark card behind`,
    );

    // The failure is visible: the preview is explicitly OFF (never merely
    // absent, which is what a clean no-op looks like) and the outcome names
    // the state, the failing family and the underlying error.
    assert.equal(outcome.state, CANONICAL_V2_PREVIEW_STATE.FAILED);
    assert.equal(outcome.gate.enabled, true, 'the gate itself was open -- this is a failure, not a refusal');
    assert.equal(outcome.failure.phase, CORRUPT_FIXTURE_PHASES[familyKey]);
    assert.ok(outcome.failure.error_message.length > 0, 'the underlying error message must be carried through');
    assert.equal(result.canonical_v2_preview_enabled, false, `a corrupted ${familyKey} fixture must not leave a partial preview flagged on`);
    assert.equal(result.canonical_v2_preview_status.state, CANONICAL_V2_PREVIEW_STATE.FAILED);

    // And it is reported out of band, where a served route that only returns
    // a deal still leaves a trace a verifier can find.
    assert.equal(logger.lines.length, 1, `a corrupted ${familyKey} fixture must report exactly one log line`);
    assert.equal(logger.lines[0].level, 'error');
    assert.match(logger.lines[0].args[0], /FAILED/);
  }
});

test('a swallowed failure is distinguishable from a clean no-op: FAILED, NOT_REQUESTED and ATTACHED are three different observable outcomes', async () => {
  const failed = await assembleCanonicalV2Preview(buildBaseReviewDeal(), {
    env: ENABLED_ENV,
    fixtures: { materialContracts: CORRUPT_FIXTURE_CASES.materialContracts },
    logger: capturingLogger(),
  });
  const noOp = await assembleCanonicalV2Preview(buildBaseReviewDeal(), { env: DISABLED_ENV });
  const attached = await assembleCanonicalV2Preview(buildBaseReviewDeal(), { env: ENABLED_ENV });

  assert.deepEqual(
    [failed.outcome.state, noOp.outcome.state, attached.outcome.state],
    [
      CANONICAL_V2_PREVIEW_STATE.FAILED,
      CANONICAL_V2_PREVIEW_STATE.NOT_REQUESTED,
      CANONICAL_V2_PREVIEW_STATE.ATTACHED,
    ],
  );

  // The exact confusion the old catch caused: the failed deal and the no-op
  // deal used to be the same object, so no assertion could tell them apart.
  assert.notDeepEqual(
    Object.keys(failed.reviewDeal).sort(),
    Object.keys(noOp.reviewDeal).sort(),
    'a failed preview must no longer be shaped exactly like a deal the preview never touched',
  );
  assert.equal(failed.reviewDeal.canonical_v2_preview_enabled, false);
  assert.equal(Object.prototype.hasOwnProperty.call(noOp.reviewDeal, 'canonical_v2_preview_enabled'), false);
  assert.equal(attached.reviewDeal.canonical_v2_preview_enabled, true);
});

test('a comparison harness cannot mistake a failure for a pass: only ATTACHED carries attached cards, and ATTACHED with zero cards is still not FAILED', async () => {
  // The harness contract: "the canonical path produced this" is
  // outcome.state === ATTACHED. A failure can never satisfy it, however the
  // harness looks at the returned deal.
  const { reviewDeal: failedDeal, outcome: failedOutcome } = await assembleCanonicalV2Preview(buildBaseReviewDeal(), {
    env: ENABLED_ENV,
    fixtures: { representations: CORRUPT_FIXTURE_CASES.representations },
    logger: capturingLogger(),
  });
  assert.notEqual(failedOutcome.state, CANONICAL_V2_PREVIEW_STATE.ATTACHED);
  assert.equal(failedOutcome.attached_card_count, 0);
  assert.equal(
    Object.prototype.hasOwnProperty.call(failedDeal, 'canonical_v2_bridge_receipts'),
    false,
    'a failed preview must leave no bridge receipt for a harness to mistake for canonical output',
  );

  // "Added nothing" is not the discriminator -- `state` is. A failure and a
  // hypothetical success that added nothing would both show
  // attached_card_count 0; they are still told apart by state and by
  // `failure`, which is null on every ATTACHED outcome and populated on every
  // FAILED one.
  const { outcome: attachedOutcome } = await assembleCanonicalV2Preview(buildBaseReviewDeal(), { env: ENABLED_ENV });
  assert.equal(attachedOutcome.state, CANONICAL_V2_PREVIEW_STATE.ATTACHED);
  assert.ok(attachedOutcome.attached_card_count > 0);
  assert.equal(attachedOutcome.failure, null);
  assert.equal(failedOutcome.failure === null, false);
});

test('attachCanonicalV2Preview (the served route\'s deal-only view) still never throws on a corrupted fixture and still returns a renderable deal', async () => {
  const reviewDeal = buildBaseReviewDeal();
  const result = await attachCanonicalV2Preview(reviewDeal, {
    env: ENABLED_ENV,
    fixtures: { generalCovenants: CORRUPT_FIXTURE_CASES.generalCovenants },
    logger: capturingLogger(),
  });
  assert.equal(result.dealId, BASE_DEAL_ID);
  assert.equal(result.cardCount, 1);
  assert.deepEqual(legacyContent(result), legacyContent(reviewDeal));
  // The route hands this straight to the client, whose lane gate requires
  // === true -- an explicit false fails closed exactly like an absent field.
  assert.equal(result.canonical_v2_preview_enabled, false);
});

test('the assembler performs no write: source contains no insert/upsert/update/supabase/fetch', () => {
  const source = fs.readFileSync(ASSEMBLER_PATH, 'utf8');
  assert.equal(
    /\b(insert|upsert|update|supabase|fetch)\b/i.test(source),
    false,
    'lib/canonical-v2/review-preview-assembly.js must stay read-time only -- no write primitives, no Supabase, no network',
  );
});

test('production env with the flag set: no preview at all, and the refusal is reported rather than silent', async () => {
  const reviewDeal = buildBaseReviewDeal();
  const logger = capturingLogger();
  const { reviewDeal: result, outcome } = await assembleCanonicalV2Preview(reviewDeal, {
    env: { CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION', VERCEL_ENV: 'production' },
    logger,
  });

  // Unchanged and non-negotiable: production is hard-blocked. Nothing
  // canonical is built, merged or flagged on.
  assert.equal(outcome.state, CANONICAL_V2_PREVIEW_STATE.REFUSED);
  assert.equal(outcome.gate.enabled, false, 'VERCEL_ENV=production must hard-block the preview even with the flag set');
  assert.equal(outcome.gate.reason, DARK_BRIDGE_GATE_REASON.RUNTIME_NOT_PERMITTED);
  assert.equal(result.canonical_v2_preview_enabled, false);
  assert.deepEqual(legacyContent(result), legacyContent(reviewDeal), 'the served deal must carry no canonical content');
  assert.equal(outcome.attached_card_count, 0);

  // New: setting the flag somewhere it cannot take effect is now loud. The
  // one case a human can be wrong about is "I set the flag, so it must be
  // on" -- so a refusal against a stated intent reports itself.
  assert.equal(logger.lines.length, 1);
  assert.equal(logger.lines[0].level, 'warn');
  assert.match(logger.lines[0].args[0], /REFUSED gate_reason=RUNTIME_NOT_PERMITTED/);
});

// =============================================================================
// Defect 2, at the assembler seam: CI set in the FUNCTION RUNTIME (as opposed
// to the build) is the one signal that can switch a Vercel preview deployment
// off while looking exactly like a preview nobody enabled. It must stay
// refusing -- and it must say so.
// =============================================================================

test('CI set in the runtime of an otherwise-permitted Vercel preview: preview off, reason CI_ENVIRONMENT_DETECTED, and the refusal is visible on the served deal', async () => {
  const reviewDeal = buildBaseReviewDeal();
  const logger = capturingLogger();
  const { reviewDeal: result, outcome } = await assembleCanonicalV2Preview(reviewDeal, {
    env: {
      CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION',
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      CI: '1',
    },
    logger,
  });

  assert.equal(outcome.state, CANONICAL_V2_PREVIEW_STATE.REFUSED);
  assert.equal(outcome.gate.reason, DARK_BRIDGE_GATE_REASON.CI_ENVIRONMENT_DETECTED);
  assert.equal(outcome.gate.signals.vercel_env, 'preview', 'the runtime allowlist itself passed -- only the CI clause refused');
  assert.equal(outcome.gate.signals.ci_recognised_truthy, true);
  assert.equal(result.canonical_v2_preview_enabled, false, 'a CI-refused preview must be explicitly off, not indistinguishable from never-requested');
  assert.equal(result.canonical_v2_preview_status.gate.reason, DARK_BRIDGE_GATE_REASON.CI_ENVIRONMENT_DETECTED);
  assert.equal(
    result.cards.some((card) => card.authority_state === 'VALIDATED_NOT_SERVED'),
    false,
    'a CI-refused preview must attach nothing',
  );
  assert.equal(logger.lines.length, 1);
  assert.match(logger.lines[0].args[0], /REFUSED gate_reason=CI_ENVIRONMENT_DETECTED/);
});

test('the same Vercel preview runtime WITHOUT CI attaches the preview: the CI clause is the only difference between on and off', async () => {
  const previewEnv = { CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION', VERCEL: '1', VERCEL_ENV: 'preview' };
  const { reviewDeal: result, outcome } = await assembleCanonicalV2Preview(buildBaseReviewDeal(), { env: previewEnv });
  assert.equal(outcome.state, CANONICAL_V2_PREVIEW_STATE.ATTACHED);
  assert.equal(outcome.gate.reason, DARK_BRIDGE_GATE_REASON.PERMITTED);
  assert.equal(outcome.gate.signals.ci_present, false);
  assert.equal(result.canonical_v2_preview_enabled, true);
  assert.ok(outcome.attached_card_count > 0);
});
