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

const { attachCanonicalV2Preview } = require('../lib/canonical-v2/review-preview-assembly');
const { shapeReviewDealRows } = require('../lib/queries/review-deal');
const { CARD_SCHEMA: REPRESENTATIONS_CARD_SCHEMA } = require('../lib/canonical-v2/representations-dark-bridge');

const ENABLED_ENV = Object.freeze({ CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION' });
const DISABLED_ENV = Object.freeze({});
const ASSEMBLER_PATH = path.join(__dirname, '..', 'lib', 'canonical-v2', 'review-preview-assembly.js');

const BASE_DEAL_ID = 'preview-route-fixture-deal';

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

test('gate on with a deliberately corrupted fixture: the original review deal is returned unchanged and nothing throws', async () => {
  const reviewDeal = buildBaseReviewDeal();
  const corruptFixtureCases = {
    materialContracts: { section_reference: '3.13' },
    generalCovenants: { section_reference: '6.05' },
    noOtherRepsFraud: { deal_id: 'corrupt' },
    representations: { deal_id: 'corrupt' },
  };

  for (const [familyKey, corruptFixture] of Object.entries(corruptFixtureCases)) {
    const result = await attachCanonicalV2Preview(reviewDeal, {
      env: ENABLED_ENV,
      fixtures: { [familyKey]: corruptFixture },
    });
    assert.equal(result, reviewDeal, `a corrupted ${familyKey} fixture must fall back to the original reviewDeal reference`);
    assert.equal(
      Object.prototype.hasOwnProperty.call(result, 'canonical_v2_preview_enabled'),
      false,
      `a corrupted ${familyKey} fixture must not leave a partial preview flagged on`,
    );
  }
});

test('the assembler performs no write: source contains no insert/upsert/update/supabase/fetch', () => {
  const source = fs.readFileSync(ASSEMBLER_PATH, 'utf8');
  assert.equal(
    /\b(insert|upsert|update|supabase|fetch)\b/i.test(source),
    false,
    'lib/canonical-v2/review-preview-assembly.js must stay read-time only -- no write primitives, no Supabase, no network',
  );
});

test('production env with the flag set: no preview, byte-identical', async () => {
  const reviewDeal = buildBaseReviewDeal();
  const result = await attachCanonicalV2Preview(reviewDeal, {
    env: { CANONICAL_V2_DARK_BRIDGE: 'ENABLED_LOCAL_PREPRODUCTION', VERCEL_ENV: 'production' },
  });
  assert.equal(result, reviewDeal, 'VERCEL_ENV=production must hard-block the preview even with the flag set');
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'canonical_v2_preview_enabled'), false);
});
