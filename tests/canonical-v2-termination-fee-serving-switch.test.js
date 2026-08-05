'use strict';

// Per-family serving switch, termination fees.
//
// The switch lives at components/review/table-configs/termination-fees.config.js's
// selectRows(); the flag is stamped server-side by lib/canonical-v2/termination-
// fee-serving-source.js and allowlisted onto the wire by lib/queries/review-deal-
// wire.js. This suite proves the five properties that make the switch safe:
//   1. flag off is byte-identical legacy;
//   2. flag on with canonical data serves canonical rows under IDENTICAL row ids;
//   3. the two card sets NEVER merge (the hybrid fee row is the defect);
//   4. a deal with no canonical data falls back to legacy VISIBLY;
//   5. an absent / malformed / explicitly-undefined flag yields legacy, and
//      not-yet-extracted renders distinctly from established-absent.

const test = require('node:test');
const assert = require('node:assert/strict');

const serving = require('../lib/canonical-v2/termination-fee-serving-source');
const { trimReviewDealForWire } = require('../lib/queries/review-deal-wire');

const SERVING_FIELD = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD;
const CARDS_FIELD = serving.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD;

const DEAL_VALUE_USD = 17000000000;

async function config() {
  return import('../components/review/table-configs/termination-fees.config.js');
}

// ---------------------------------------------------------------------------
// Legacy fixtures -- deliberately carrying every field canonical has no
// counterpart for, so their disappearance under the switch is observable.
// ---------------------------------------------------------------------------

function legacyFeeCard() {
  return {
    id: 'legacy-termf-target',
    deal_id: serving.QXO_TOPBUILD_DEAL_ID,
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-TARGET',
    short_title: 'Company Termination Fee',
    primary_quote: 'The Company shall pay Parent a termination fee of $100,000,000.',
    features: {
      companyTerminationFee: {
        amount: '$100,000,000',
        // Deliberately far from the computed % of deal value the canonical
        // amount yields ($600m / $17bn = 3.5%), so a legacy percentage riding
        // along on a canonical row is unmistakable.
        percentage_of_equity: '9.9%',
        payment_deadline: 'two business days after termination',
        triggers: [{ code: 'SUPERIOR_PROPOSAL_TERMINATION', label: 'Superior proposal', text: 'the Company terminates to accept a Superior Proposal' }],
      },
    },
  };
}

function legacySoleRemedyCard() {
  return {
    id: 'legacy-termf-sole',
    deal_id: serving.QXO_TOPBUILD_DEAL_ID,
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-SOLE',
    short_title: 'Sole Remedy',
    primary_quote: 'Payment of the Company Termination Fee shall be the sole and exclusive remedy.',
    features: {
      // Established ABSENT: the extractor looked and recorded false.
      soleAndExclusiveRemedy: false,
      willfulBreachException: true,
      feeRequired: true,
      interestOnLatePayment: {
        rate: 'the prime rate of Bank of America (or its successors or assigns) in effect on the date such payment was required to be made',
        base: 'the amount of the payment',
      },
    },
  };
}

function legacyCards() {
  return [legacyFeeCard(), legacySoleRemedyCard()];
}

function qxoCanonicalCards() {
  return serving.canonicalTerminationFeeCardsForDeal(serving.QXO_TOPBUILD_DEAL_ID);
}

function rowById(rows, id) {
  return rows.find((row) => row.id === id) || null;
}

// ---------------------------------------------------------------------------
// 1. Flag off is byte-identical legacy
// ---------------------------------------------------------------------------

test('flag off yields byte-identical legacy rows', async () => {
  const mod = await config();
  const cards = legacyCards();
  const reviewDeal = { cards, value_usd: DEAL_VALUE_USD };

  // The literal pre-switch expression from selectRows().
  const expected = [
    ...mod.feeTableRows(cards, DEAL_VALUE_USD),
    ...mod.scalarRows(cards),
    ...mod.deferredEvidenceRows(cards),
  ];

  const rows = mod.terminationFeesConfig.selectRows(reviewDeal);
  assert.deepEqual(rows, expected);
  assert.equal(JSON.stringify(rows), JSON.stringify(expected));

  // An explicitly-false flag is the same thing as no flag at all.
  const explicitlyOff = mod.terminationFeesConfig.selectRows({ ...reviewDeal, [SERVING_FIELD]: false });
  assert.equal(JSON.stringify(explicitlyOff), JSON.stringify(expected));

  // No provenance notice, no coverage placeholders, ever, while off.
  assert.equal(rows.some((row) => row.id === 'termination-fees-serving-source'), false);
  assert.equal(rows.some((row) => row.coverageState), false);
});

test('flag off leaves canonical-only payloads exactly as the pre-switch config saw them', async () => {
  const mod = await config();
  // How the projection parity suites drive this config: canonical cards, no
  // legacy cards, no flag. Nothing is mixed, so nothing changes.
  const cards = qxoCanonicalCards();
  const expected = [
    ...mod.feeTableRows(cards, DEAL_VALUE_USD),
    ...mod.scalarRows(cards),
    ...mod.deferredEvidenceRows(cards),
  ];
  const rows = mod.terminationFeesConfig.selectRows({ cards, value_usd: DEAL_VALUE_USD });
  assert.equal(JSON.stringify(rows), JSON.stringify(expected));
  assert.ok(rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE'));
});

test('empty payloads still yield no rows', async () => {
  const mod = await config();
  assert.deepEqual(mod.terminationFeesConfig.selectRows({ cards: [] }), []);
  assert.deepEqual(mod.terminationFeesConfig.selectRows({ cards: [], [SERVING_FIELD]: true }), []);
  assert.deepEqual(mod.terminationFeesConfig.selectRows(null), []);
  assert.deepEqual(mod.terminationFeesConfig.selectRows(undefined), []);
});

// ---------------------------------------------------------------------------
// 2. Flag on with canonical data -> canonical rows, identical row ids
// ---------------------------------------------------------------------------

test('flag on with canonical data serves canonical rows under byte-identical row ids', async () => {
  const mod = await config();
  const canonical = qxoCanonicalCards();
  assert.ok(canonical.length, 'QXO/TopBuild canonical termination-fee cards must build');

  const rows = mod.terminationFeesConfig.selectRows({
    cards: legacyCards(),
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: canonical,
  });

  // Row identity must not move: lib/canonical-v2/review-row-binding.js matches
  // these exact strings and a rename silently detaches the market sidebar.
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.ok(fee, 'canonical serving must keep the company-fee row id byte-identical');

  // The value is canonical ($600,000,000 from the filed agreement), not the
  // legacy card's $100,000,000.
  assert.match(fee.detail, /\$600,000,000/);
  assert.equal(fee.detail.includes('$100,000,000'), false);
  assert.ok(fee.signals.some((signal) => signal.label.startsWith('$600,000,000')));

  // Provenance is stated, not implied.
  assert.equal(rows[0].id, 'termination-fees-serving-source');
  assert.equal(rows[0].servingSourceState, 'CANONICAL');
  assert.equal(rows[0].detail, 'Canonical V2');
  assert.equal(rows[0].marketSkip, true);
});

test('canonical fee row carries the agreement trigger vocabulary, not legacy prose', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows({
    cards: [],
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: qxoCanonicalCards(),
  });
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  const labels = fee.signals.map((signal) => signal.label);
  assert.ok(labels.includes('Change in recommendation'));
  assert.ok(labels.includes('No-solicitation breach'));
  assert.ok(labels.includes('Stockholder approval failure'));
  assert.equal(labels.some((label) => /Superior proposal/i.test(label)), false);
});

// ---------------------------------------------------------------------------
// 3. The defect: the two card sets must never merge
// ---------------------------------------------------------------------------

test('canonical and legacy cards never merge into a hybrid fee row', async () => {
  const mod = await config();
  const canonical = qxoCanonicalCards();
  const legacy = legacyCards();

  // Both card orders, because the defect is order-dependent by nature.
  for (const cards of [[...legacy, ...canonical], [...canonical, ...legacy]]) {
    const rows = mod.terminationFeesConfig.selectRows({
      cards,
      value_usd: DEAL_VALUE_USD,
      [SERVING_FIELD]: true,
    });
    const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
    assert.ok(fee);
    // Canonical amount...
    assert.match(fee.detail, /\$600,000,000/);
    // ...and NOT the legacy percentage, deadline or amount riding along with it.
    // This is the hybrid: canonical amount + legacy percentage + legacy
    // deadline, silently varying with array order.
    assert.equal(fee.detail.includes('$100,000,000'), false);
    assert.equal(fee.detail.includes('9.9%'), false);
    assert.equal(fee.detail.includes('of equity value'), false);
    assert.equal(/Deadline:/.test(fee.detail), false);
    assert.equal(fee.signals.some((signal) => /Superior proposal/i.test(signal.label)), false);
    // The percentage shown is COMPUTED from the canonical amount and the
    // deal's own value_usd ($600m / $17bn), never the legacy extracted figure.
    assert.match(fee.detail, /3\.5% of deal value/);
  }
});

test('the hybrid is what the unpartitioned merge actually produces', async () => {
  const mod = await config();
  // Demonstrates the defect directly against the merge the partition prevents:
  // feed BOTH card sets to combineTermfFeatures() and the bag carries the
  // canonical amount with the legacy percentage and deadline still attached,
  // and flips with array order.
  const canonical = qxoCanonicalCards();
  const legacy = legacyCards();
  const merged = mod.combineTermfFeatures([...legacy, ...canonical]).companyTerminationFee;
  assert.equal(merged.amount, '$600,000,000');
  assert.equal(merged.percentage_of_equity, '9.9%');
  assert.equal(merged.payment_deadline, 'two business days after termination');
  const reversed = mod.combineTermfFeatures([...canonical, ...legacy]).companyTerminationFee;
  assert.equal(reversed.amount, '$100,000,000');
  assert.notEqual(merged.amount, reversed.amount);

  // The partition is what keeps that bag from ever being built: exactly one
  // set of cards comes back per side, and their intersection is empty.
  const { legacyCards: l, canonicalCards: c } = mod.partitionTerminationFeeCards({ cards: [...legacy, ...canonical] });
  assert.deepEqual(l.map((card) => card.id).sort(), legacy.map((card) => card.id).sort());
  assert.deepEqual(c.map((card) => card.id).sort(), canonical.map((card) => card.id).sort());
  const ids = new Set(l.map((card) => card.id));
  assert.equal(c.some((card) => ids.has(card.id)), false);
});

test('flag off with mixed cards drops canonical rather than merging it', async () => {
  const mod = await config();
  const legacy = legacyCards();
  const rows = mod.terminationFeesConfig.selectRows({
    cards: [...legacy, ...qxoCanonicalCards()],
    value_usd: DEAL_VALUE_USD,
  });
  const expected = [
    ...mod.feeTableRows(legacy, DEAL_VALUE_USD),
    ...mod.scalarRows(legacy),
    ...mod.deferredEvidenceRows(legacy),
  ];
  assert.equal(JSON.stringify(rows), JSON.stringify(expected));
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.match(fee.detail, /\$100,000,000/);
  assert.equal(fee.detail.includes('$600,000,000'), false);
});

// ---------------------------------------------------------------------------
// 4. No canonical data -> visible legacy fallback
// ---------------------------------------------------------------------------

test('a deal with no canonical data falls back to legacy visibly', async () => {
  const mod = await config();
  const legacy = legacyCards();
  const rows = mod.terminationFeesConfig.selectRows({
    cards: legacy,
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: [],
  });

  assert.equal(rows[0].id, 'termination-fees-serving-source');
  assert.equal(rows[0].servingSourceState, 'LEGACY_FALLBACK');
  assert.match(rows[0].detail, /^Legacy extraction — Canonical V2 has no termination-fee data for this deal$/);
  assert.equal(rows[0].signals[0].tone, 'warning');

  // Everything after the notice is the untouched legacy table -- never an
  // empty table that would read as an agreement with no fee provisions.
  const expected = [
    ...mod.feeTableRows(legacy, DEAL_VALUE_USD),
    ...mod.scalarRows(legacy),
    ...mod.deferredEvidenceRows(legacy),
  ];
  assert.equal(JSON.stringify(rows.slice(1)), JSON.stringify(expected));
  assert.ok(rows.length > 1);
});

test('an unregistered deal has no canonical source at all', () => {
  assert.deepEqual(serving.canonicalTerminationFeeCardsForDeal('00000000-0000-4000-8000-000000000000'), []);
  assert.deepEqual(serving.canonicalTerminationFeeCardsForDeal(''), []);
  assert.deepEqual(serving.canonicalTerminationFeeCardsForDeal(null), []);
  assert.deepEqual(serving.canonicalTerminationFeeCardsForDeal(undefined), []);
  // Never resolves a prototype-chain key into a builder.
  assert.deepEqual(serving.canonicalTerminationFeeCardsForDeal('toString'), []);
  assert.deepEqual(serving.canonicalTerminationFeeCardsForDeal('constructor'), []);
});

// ---------------------------------------------------------------------------
// 5a. Absent / malformed / undefined flag -> legacy
// ---------------------------------------------------------------------------

test('only the exact boolean true enables canonical serving', async () => {
  const mod = await config();
  for (const value of ['true', 'TRUE', 1, {}, [], 'ENABLED', Object(true)]) {
    assert.equal(
      mod.isCanonicalTerminationFeeServingEnabled({ [SERVING_FIELD]: value }),
      false,
      `truthy stand-in ${JSON.stringify(value)} must not enable serving`,
    );
  }
  for (const value of [false, null, undefined, 0, '']) {
    assert.equal(mod.isCanonicalTerminationFeeServingEnabled({ [SERVING_FIELD]: value }), false);
  }
  assert.equal(mod.isCanonicalTerminationFeeServingEnabled({}), false);
  assert.equal(mod.isCanonicalTerminationFeeServingEnabled(null), false);
  assert.equal(mod.isCanonicalTerminationFeeServingEnabled(undefined), false);
  assert.equal(mod.isCanonicalTerminationFeeServingEnabled('cards'), false);
  assert.equal(mod.isCanonicalTerminationFeeServingEnabled({ [SERVING_FIELD]: true }), true);
});

test('a prototype-chain flag can never switch a deal to canonical', async () => {
  const mod = await config();
  const polluted = Object.create({ [SERVING_FIELD]: true });
  polluted.cards = legacyCards();
  polluted.value_usd = DEAL_VALUE_USD;
  polluted[CARDS_FIELD] = qxoCanonicalCards();
  assert.equal(mod.isCanonicalTerminationFeeServingEnabled(polluted), false);
  const rows = mod.terminationFeesConfig.selectRows(polluted);
  assert.equal(rows[0].id !== 'termination-fees-serving-source', true);
  assert.match(rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE').detail, /\$100,000,000/);
});

test('an explicitly-undefined flag key still yields legacy', async () => {
  const mod = await config();
  const reviewDeal = { cards: legacyCards(), value_usd: DEAL_VALUE_USD, [SERVING_FIELD]: undefined };
  assert.equal(Object.prototype.hasOwnProperty.call(reviewDeal, SERVING_FIELD), true);
  const rows = mod.terminationFeesConfig.selectRows(reviewDeal);
  assert.equal(rows.some((row) => row.id === 'termination-fees-serving-source'), false);
  assert.match(rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE').detail, /\$100,000,000/);
});

test('a malformed canonical card field cannot break the table', async () => {
  const mod = await config();
  for (const malformed of [null, undefined, 'cards', 42, {}]) {
    const rows = mod.terminationFeesConfig.selectRows({
      cards: legacyCards(),
      value_usd: DEAL_VALUE_USD,
      [SERVING_FIELD]: true,
      [CARDS_FIELD]: malformed,
    });
    assert.equal(rows[0].servingSourceState, 'LEGACY_FALLBACK');
    assert.match(rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE').detail, /\$100,000,000/);
  }
});

// ---------------------------------------------------------------------------
// 5b. Not-yet-extracted vs established-absent
// ---------------------------------------------------------------------------

test('not-yet-extracted renders distinctly from established-absent', async () => {
  const mod = await config();

  // Legacy: the extractor looked and recorded soleAndExclusiveRemedy === false.
  // That is a finding ABOUT THE AGREEMENT and reads as the grey "No" pill.
  const legacyRows = mod.terminationFeesConfig.selectRows({ cards: legacyCards(), value_usd: DEAL_VALUE_USD });
  const absent = rowById(legacyRows, 'termination-fees-sole-remedy');
  assert.ok(absent, 'legacy must still render the established-absent sole-remedy row');
  assert.equal(absent.detail, 'No');
  assert.equal(absent.signals[0].tone, 'missing');
  assert.equal(absent.present, true);
  assert.equal(absent.coverageState, undefined);

  // Canonical: no sole-remedy claim exists yet. The row must NOT vanish (that
  // would read as "no sole-remedy clause"); it renders as an explicit,
  // differently-toned not-yet-extracted row.
  const canonicalRows = mod.terminationFeesConfig.selectRows({
    cards: [],
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: qxoCanonicalCards(),
  });
  assert.equal(rowById(canonicalRows, 'termination-fees-sole-remedy'), null);
  const pending = rowById(canonicalRows, 'termination-fees-not-yet-extracted-sole-remedy');
  assert.ok(pending, 'canonical serving must state the sole-remedy gap, not drop the row');
  assert.equal(pending.label, 'Sole and exclusive remedy');
  assert.equal(pending.detail, mod.NOT_YET_EXTRACTED_DETAIL);
  assert.equal(pending.detail, 'Not yet extracted');
  assert.equal(pending.coverageState, 'NOT_YET_EXTRACTED');
  assert.equal(pending.present, false);
  assert.equal(pending.marketSkip, true);

  // The two states are visually distinct AND textually distinct.
  assert.notEqual(pending.signals[0].tone, absent.signals[0].tone);
  assert.notEqual(pending.detail, absent.detail);
});

test('every legacy surface canonical cannot yet produce is named, never dropped', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows({
    cards: [],
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: qxoCanonicalCards(),
  });
  const pending = rows.filter((row) => row.coverageState === 'NOT_YET_EXTRACTED').map((row) => row.label);
  assert.deepEqual(pending, [
    'Reverse termination fee',
    'Expense reimbursement cap',
    'Fee required to terminate',
    'Naked no-vote fee',
    'Sole and exclusive remedy',
    'Willful-breach exception',
    'Interest on late payment',
  ]);
  // The one surface canonical DOES serve gets no placeholder.
  assert.equal(rows.some((row) => row.id === 'termination-fees-not-yet-extracted-COMPANY_TERMINATION_FEE'), false);

  // Placeholder ids never collide with the real, market-bound row ids.
  assert.equal(rows.some((row) => row.coverageState === 'NOT_YET_EXTRACTED'
    && (row.id === 'termination-fees-COMPANY_TERMINATION_FEE' || row.id === 'termination-fees-REVERSE_TERMINATION_FEE')), false);
});

test('a canonical fee row names its own missing fields', async () => {
  const mod = await config();
  const rows = mod.terminationFeesConfig.selectRows({
    cards: [],
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: qxoCanonicalCards(),
  });
  const fee = rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE');
  const gap = fee.signals.find((signal) => signal.tone === 'warning');
  assert.ok(gap, 'a canonical fee row missing % of equity / deadline / sole remedy must say so');
  assert.equal(gap.label, 'Not yet extracted: % of equity value, payment deadline, sole-remedy status');
});

test('the interest row degrades honestly instead of collapsing to a bare Yes', async () => {
  const mod = await config();
  // The projection publishes interestOnLatePayment: true from Wave B evidence
  // with no rate and no interestRateBasis -- legacy showed "Prime rate (Bank of
  // America)", canonical would otherwise show "Yes".
  const canonicalInterestCard = {
    id: 'canonical-open-world-interest',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'OPEN-WORLD',
    short_title: 'Deferred Evidence',
    primary_quote: 'If the termination fee is not paid when due, interest accrues at the Applicable Rate.',
    features: { interestOnLatePayment: true, latePaymentInterestBenchmark: 'Applicable Rate' },
    canonical_v2_lineage: { source: 'CANONICAL_V2_NATIVE_CLAIM' },
  };
  const rows = mod.terminationFeesConfig.selectRows({
    cards: [],
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: [...qxoCanonicalCards(), canonicalInterestCard],
  });
  const interest = rowById(rows, 'termination-fees-interest');
  assert.ok(interest);
  assert.equal(interest.detail, 'Yes (reference rate not yet extracted)');
  assert.equal(interest.coverageState, 'PARTIAL_NOT_YET_EXTRACTED');
  assert.equal(interest.signals[0].tone, 'warning');
  // A partially-covered row is a real row, so it keeps its id and is NOT also
  // reported as a missing surface.
  assert.equal(rows.some((row) => row.id === 'termination-fees-not-yet-extracted-interest'), false);

  // Legacy, by contrast, still renders the extracted rate verbatim-derived.
  const legacyRows = mod.terminationFeesConfig.selectRows({ cards: legacyCards(), value_usd: DEAL_VALUE_USD });
  assert.equal(rowById(legacyRows, 'termination-fees-interest').detail, 'Prime rate (Bank of America)');
});

// ---------------------------------------------------------------------------
// Server-side gate and wire plumbing
// ---------------------------------------------------------------------------

test('the env gate is off by default and fails closed', () => {
  const on = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE;
  const key = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY;

  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled({}), false);
  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled(undefined), false);
  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled(null), false);
  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled('ENABLED'), false);

  // Truthy stand-ins are not the sentinel.
  for (const value of ['1', 'true', 'on', 'yes', 'enabled', true, 1]) {
    assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled({ [key]: value }), false);
  }

  // Local development with the exact sentinel: on.
  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled({ [key]: on }), true);
  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled({ [key]: on, VERCEL_ENV: 'preview', VERCEL: '1' }), true);

  // Production is unreachable, sentinel or not. Authority for production is NONE.
  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled({ [key]: on, NODE_ENV: 'production' }), false);
  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled({ [key]: on, VERCEL: '1', VERCEL_ENV: 'production' }), false);

  // A prototype-chain sentinel is not an own property.
  assert.equal(serving.isCanonicalV2TerminationFeeServingEnabled(Object.create({ [key]: on })), false);
});

test('attach is a no-op when the gate is off and stamps both fields when on', () => {
  const key = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY;
  const on = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE;
  const reviewDeal = { dealId: serving.QXO_TOPBUILD_DEAL_ID, cards: legacyCards() };

  // Off: same reference back, no field added.
  assert.equal(serving.attachCanonicalTerminationFeeServing(reviewDeal, { env: {} }), reviewDeal);
  assert.equal(Object.prototype.hasOwnProperty.call(reviewDeal, SERVING_FIELD), false);

  // On, registered deal: boolean plus real canonical cards.
  const served = serving.attachCanonicalTerminationFeeServing(reviewDeal, { env: { [key]: on } });
  assert.equal(served[SERVING_FIELD], true);
  assert.ok(served[CARDS_FIELD].length);
  assert.equal(served[CARDS_FIELD][0].provision_subtype, 'TERMF-TARGET');
  assert.equal(served.cards, reviewDeal.cards);

  // On, unregistered deal: the boolean is still stamped (so the config can
  // distinguish "no data" from "switch off") with an empty card array.
  const other = serving.attachCanonicalTerminationFeeServing(
    { dealId: '00000000-0000-4000-8000-000000000000', cards: [] },
    { env: { [key]: on } },
  );
  assert.equal(other[SERVING_FIELD], true);
  assert.deepEqual(other[CARDS_FIELD], []);
});

test('the wire carries both fields through, and omits them when absent', () => {
  const bare = trimReviewDealForWire({ dealId: 'd', cardCount: 0, cards: [] });
  assert.equal(Object.prototype.hasOwnProperty.call(bare, SERVING_FIELD), false);
  assert.equal(Object.prototype.hasOwnProperty.call(bare, CARDS_FIELD), false);

  const canonical = qxoCanonicalCards();
  const served = trimReviewDealForWire({
    dealId: serving.QXO_TOPBUILD_DEAL_ID,
    cardCount: 0,
    cards: [],
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: canonical,
  });
  assert.equal(served[SERVING_FIELD], true);
  assert.equal(served[CARDS_FIELD].length, canonical.length);
  assert.equal(served[CARDS_FIELD][0].provision_subtype, 'TERMF-TARGET');
  // Trimmed like every other card: region_full_text is dropped when it is
  // byte-identical to primary_quote.
  assert.equal(Object.prototype.hasOwnProperty.call(served[CARDS_FIELD][0], 'region_full_text'), false);
});

test('the client-side and server-side field names agree', async () => {
  const mod = await config();
  assert.equal(mod.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD, SERVING_FIELD);
  assert.equal(mod.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD, CARDS_FIELD);
});

test('end to end: server attach -> wire trim -> client reconstruct -> rows', async () => {
  const mod = await config();
  const { reconstructReviewDeal } = require('../lib/queries/reconstruct-review-deal');
  const key = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY;
  const on = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE;

  // What lib/queries/review-deal.js hands pages/api/review/[id]/cards.js.
  const fetched = {
    dealId: serving.QXO_TOPBUILD_DEAL_ID,
    cardCount: 2,
    cards: legacyCards(),
    value_usd: DEAL_VALUE_USD,
  };

  // Gate off: the whole pipeline is byte-identical to a build without the switch.
  const off = reconstructReviewDeal(trimReviewDealForWire(
    serving.attachCanonicalTerminationFeeServing(fetched, { env: {} }),
  ));
  const offRows = mod.terminationFeesConfig.selectRows(off);
  assert.equal(offRows.some((row) => row.id === 'termination-fees-serving-source'), false);
  assert.match(rowById(offRows, 'termination-fees-COMPANY_TERMINATION_FEE').detail, /\$100,000,000/);

  // Gate on: canonical serves, through the real wire round-trip.
  const served = reconstructReviewDeal(trimReviewDealForWire(
    serving.attachCanonicalTerminationFeeServing(fetched, { env: { [key]: on } }),
  ));
  assert.equal(served[SERVING_FIELD], true);
  const rows = mod.terminationFeesConfig.selectRows(served);
  assert.equal(rows[0].servingSourceState, 'CANONICAL');
  assert.match(rowById(rows, 'termination-fees-COMPANY_TERMINATION_FEE').detail, /\$600,000,000/);
  assert.ok(rowById(rows, 'termination-fees-not-yet-extracted-sole-remedy'));
  // The legacy cards still ride the payload untouched -- the switch chooses a
  // source, it never deletes the other one.
  assert.equal(served.cards.length, 2);

  // Production is unreachable through the same pipeline.
  const production = reconstructReviewDeal(trimReviewDealForWire(
    serving.attachCanonicalTerminationFeeServing(fetched, { env: { [key]: on, VERCEL: '1', VERCEL_ENV: 'production' } }),
  ));
  assert.equal(Object.prototype.hasOwnProperty.call(production, SERVING_FIELD), false);
  assert.match(
    rowById(mod.terminationFeesConfig.selectRows(production), 'termination-fees-COMPANY_TERMINATION_FEE').detail,
    /\$100,000,000/,
  );
});

// ---------------------------------------------------------------------------
// The per-deal canonical source itself
// ---------------------------------------------------------------------------

test('the QXO/TopBuild canonical source is built from the pinned filed text', () => {
  const cards = qxoCanonicalCards();
  assert.equal(cards.length, 1);
  const card = cards[0];
  assert.equal(card.provision_subtype, 'TERMF-TARGET');
  assert.equal(card.deal_id, serving.QXO_TOPBUILD_DEAL_ID);
  assert.equal(card.features.feeAmount, '$600,000,000');
  assert.equal(card.features.companyTerminationFee.amount, '$600,000,000');
  // Six encoded grounds, two of which share the §4.3 no-solicitation-breach
  // code and collapse to one trigger.
  const codes = card.features.companyTerminationFee.triggers.map((trigger) => trigger.code);
  assert.deepEqual(codes, [
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
    'NO_SOLICIT_BREACH_TERMINATION',
    'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
    'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
  ]);
  // Every trigger's evidence is verbatim from the filed agreement.
  assert.ok(card.features.companyTerminationFee.triggers.every((trigger) => card.primary_quote.includes(trigger.text)));
});
