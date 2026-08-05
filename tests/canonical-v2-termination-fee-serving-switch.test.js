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
const fs = require('node:fs');
const path = require('node:path');

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
  // 'Fee required to terminate' no longer appears here at all -- owner ruling
  // 2026-08-05 moved feeRequired to the Termination Rights table, so it is no
  // longer one of this table's coverage surfaces (tracked or otherwise).
  // 'Willful-breach exception' is now the two split rows, each independently
  // not-yet-extracted (rubric.js's own wording for TERMF-EFFECT/TERMF-SOLE).
  assert.deepEqual(pending, [
    'Reverse termination fee',
    'Expense reimbursement cap',
    'Naked no-vote fee',
    'Sole and exclusive remedy',
    'Willful-breach carve-out',
    'Willful-breach carve-out to sole remedy',
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

// The Wave B interest surface, shaped exactly as lib/canonical-v2/termination-
// product-projection.js publishes it: a BOOLEAN interestOnLatePayment plus the
// benchmark PROSE, and the interestRateBasis code only when its classifier
// resolved one.
function canonicalInterestCard(features) {
  return {
    id: 'canonical-open-world-interest',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'OPEN-WORLD',
    short_title: 'Deferred Evidence',
    primary_quote: 'If the termination fee is not paid when due, interest accrues at the stated rate.',
    features: { interestOnLatePayment: true, ...features },
    canonical_v2_lineage: { source: 'CANONICAL_V2_NATIVE_CLAIM' },
  };
}

function canonicalInterestRows(mod, features) {
  return mod.terminationFeesConfig.selectRows({
    cards: [],
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: [...qxoCanonicalCards(), canonicalInterestCard(features)],
  });
}

test('the interest row degrades honestly instead of collapsing to a bare Yes', async () => {
  const mod = await config();
  // Wave B recorded presence only -- no benchmark prose, no interestRateBasis.
  // Legacy showed "Prime rate (Bank of America)"; canonical would otherwise
  // show a bare "Yes", which implies we know terms we do not have.
  // Both shapes the projection can emit for "no benchmark": the key absent, and
  // the key present holding null (which is what it publishes when the producer
  // captured no benchmark_quote).
  for (const features of [{}, { latePaymentInterestBenchmark: null }]) {
    const interest = rowById(canonicalInterestRows(mod, features), 'termination-fees-interest');
    assert.ok(interest);
    assert.equal(interest.detail, `Yes (${mod.INTEREST_RATE_NOT_EXTRACTED})`);
    assert.equal(interest.detail, 'Yes (reference rate not yet extracted)');
    assert.equal(interest.coverageState, 'PARTIAL_NOT_YET_EXTRACTED');
    assert.equal(interest.signals[0].tone, 'warning');
  }
  const rows = canonicalInterestRows(mod, {});
  // A partially-covered row is a real row, so it keeps its id and is NOT also
  // reported as a missing surface.
  assert.equal(rows.some((row) => row.id === 'termination-fees-not-yet-extracted-interest'), false);

  // Legacy, by contrast, still renders the extracted rate verbatim-derived.
  const legacyRows = mod.terminationFeesConfig.selectRows({ cards: legacyCards(), value_usd: DEAL_VALUE_USD });
  assert.equal(rowById(legacyRows, 'termination-fees-interest').detail, 'Prime rate (Bank of America)');
});

test('the canonical interest row shows the benchmark prose the agreement states', async () => {
  const mod = await config();
  const rows = canonicalInterestRows(mod, {
    latePaymentInterestBenchmark: 'the prime rate of Bank of America (or its successors or assigns) in effect on the date such payment was required to be made',
    interestRateBasis: 'PRIME_BANK',
  });
  const interest = rowById(rows, 'termination-fees-interest');
  assert.ok(interest);
  // The wiring gap this closes: the row read "Yes" because the projection
  // publishes the rate as prose on latePaymentInterestBenchmark while
  // formatInterestOnLatePayment() only reads the legacy { rate, base } object.
  assert.equal(interest.detail, 'Prime rate (Bank of America)');
  // The rate IS resolved, so this is a finished row -- no coverage flag, and
  // the ordinary quantitative tone rather than amber.
  assert.equal(interest.coverageState, undefined);
  assert.equal(interest.signals[0].tone, 'info');
  // Byte-identical to the legacy row for the same agreement: the two
  // extractions render the same rate the same way.
  const legacyRows = mod.terminationFeesConfig.selectRows({ cards: legacyCards(), value_usd: DEAL_VALUE_USD });
  assert.equal(interest.detail, rowById(legacyRows, 'termination-fees-interest').detail);
});

test('the benchmark prose beats the interestRateBasis taxonomy label', async () => {
  const mod = await config();
  // PRIME_BANK's taxonomy label is the generic "Prime rate (a named bank)".
  // The agreement names the bank; the row must show what the agreement says.
  const rows = canonicalInterestRows(mod, {
    latePaymentInterestBenchmark: 'the prime rate of Bank of America in effect on the date such payment was required to be made',
    interestRateBasis: 'PRIME_BANK',
  });
  assert.equal(rowById(rows, 'termination-fees-interest').detail, 'Prime rate (Bank of America)');
});

test('a benchmark with no recognised reference rate still reaches the row, unclassified', async () => {
  const mod = await config();
  // SOFR resolves in the classifier but has no INTEREST_RATE_BASIS taxonomy
  // label, so formatInterestBasis() returns null. The prose still renders, and
  // because a code WAS resolved the row is not flagged as unresolved.
  const rows = canonicalInterestRows(mod, {
    latePaymentInterestBenchmark: 'SOFR plus 2% per annum',
    interestRateBasis: 'SOFR',
  });
  const interest = rowById(rows, 'termination-fees-interest');
  assert.equal(interest.detail, 'SOFR plus 2% per annum');
  assert.equal(interest.coverageState, undefined);
});

test('a defined-term cross-reference is never rendered as though it were a rate', async () => {
  const mod = await config();
  // "the Applicable Rate" is a POINTER to a definition elsewhere. The
  // projection's classifier publishes no interestRateBasis for it (see the
  // projection test below), so the row shows the agreement's own words in
  // quotes and says plainly that they are not resolved to a reference rate.
  const rows = canonicalInterestRows(mod, { latePaymentInterestBenchmark: 'the Applicable Rate' });
  const interest = rowById(rows, 'termination-fees-interest');
  assert.equal(interest.detail, `"the Applicable Rate" (${mod.INTEREST_RATE_NOT_RESOLVED})`);
  assert.equal(interest.detail, '"the Applicable Rate" (reference rate not resolved)');
  // Still an unfinished row: amber, and the same PARTIAL state the bare-"Yes"
  // degradation carries.
  assert.equal(interest.coverageState, 'PARTIAL_NOT_YET_EXTRACTED');
  assert.equal(interest.signals[0].tone, 'warning');
  // It must never read as a resolved rate, and never claim we have not looked.
  assert.equal(/^Prime rate|^Fixed rate|^6-month/.test(interest.detail), false);
  assert.equal(interest.detail.includes(mod.NOT_YET_EXTRACTED_DETAIL), false);
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

// ---------------------------------------------------------------------------
// 6. A registered-but-unreadable source is distinguishable from no source at
//    all (production incident, 2026-08-05: a Vercel file-tracing gap made
//    TopBuild's registered, pinned source unreadable in the deployed
//    function, and the page told a reviewer "Canonical V2 has no
//    termination-fee data for this deal" -- true for every OTHER deal, false
//    for this one. See termination-fee-serving-source.js's QXO_EXCERPTS_TEXT
//    comment for the underlying fix (a literal require() of a generated
//    module replaced the runtime disk read entirely); this section proves
//    the failure itself is no longer silent.)
// ---------------------------------------------------------------------------

const FAKE_DEAL_ID = 'fake-deal-0000-0000-0000-000000000000';

function fakeSources(build) {
  return { [FAKE_DEAL_ID]: build };
}

function enoentError() {
  const error = new Error("ENOENT: no such file or directory, open '/fake/path/qxo-termination-fee-reviewed-excerpts.txt'");
  error.code = 'ENOENT';
  return error;
}

function digestMismatchError() {
  return new Error('canonical termination-fee QXO/TopBuild source digest mismatch');
}

function loggerSpy() {
  const calls = [];
  return { calls, error: (...args) => calls.push(args) };
}

test('describeCanonicalTerminationFeeSource: an unregistered deal is NOT_REGISTERED, never FAILED', () => {
  const { outcome } = serving.describeCanonicalTerminationFeeSource('00000000-0000-4000-8000-000000000000');
  assert.equal(outcome.state, serving.TERMINATION_FEE_SOURCE_STATE.NOT_REGISTERED);
  assert.equal(outcome.card_count, 0);
  assert.equal(outcome.failure, null);
});

test('describeCanonicalTerminationFeeSource: a registered source that builds cleanly is ATTACHED', () => {
  const { cards, outcome } = serving.describeCanonicalTerminationFeeSource(FAKE_DEAL_ID, {
    sources: fakeSources(() => [{ id: 'x' }, { id: 'y' }]),
  });
  assert.equal(outcome.state, serving.TERMINATION_FEE_SOURCE_STATE.ATTACHED);
  assert.equal(outcome.card_count, 2);
  assert.equal(outcome.failure, null);
  assert.equal(cards.length, 2);
});

test('describeCanonicalTerminationFeeSource: an unreadable source is FAILED, not NOT_REGISTERED', () => {
  const { cards, outcome } = serving.describeCanonicalTerminationFeeSource(FAKE_DEAL_ID, {
    sources: fakeSources(() => { throw enoentError(); }),
  });
  assert.equal(outcome.state, serving.TERMINATION_FEE_SOURCE_STATE.FAILED);
  assert.notEqual(outcome.state, serving.TERMINATION_FEE_SOURCE_STATE.NOT_REGISTERED);
  assert.equal(cards.length, 0);
  assert.equal(outcome.failure.error_code, 'ENOENT');
  assert.match(outcome.failure.error_message, /ENOENT/);
});

test('describeCanonicalTerminationFeeSource: a digest mismatch is FAILED with its own distinguishable detail', () => {
  const { cards, outcome } = serving.describeCanonicalTerminationFeeSource(FAKE_DEAL_ID, {
    sources: fakeSources(() => { throw digestMismatchError(); }),
  });
  assert.equal(outcome.state, serving.TERMINATION_FEE_SOURCE_STATE.FAILED);
  assert.equal(cards.length, 0);
  assert.equal(outcome.failure.error_code, null);
  assert.match(outcome.failure.error_message, /digest mismatch/);
});

test('an unreadable source and a digest mismatch are both FAILED but carry different failure detail', () => {
  const unreadable = serving.describeCanonicalTerminationFeeSource(FAKE_DEAL_ID, {
    sources: fakeSources(() => { throw enoentError(); }),
  }).outcome;
  const mismatched = serving.describeCanonicalTerminationFeeSource(FAKE_DEAL_ID, {
    sources: fakeSources(() => { throw digestMismatchError(); }),
  }).outcome;
  assert.equal(unreadable.state, mismatched.state, 'both are FAILED at the state level');
  assert.notEqual(unreadable.failure.error_message, mismatched.failure.error_message, 'but the failure detail tells them apart');
  assert.notEqual(unreadable.failure.error_code, mismatched.failure.error_code);
});

test('canonicalTerminationFeeCardsForDeal keeps its exact public contract: [] either way, never throws', () => {
  assert.deepEqual(
    serving.canonicalTerminationFeeCardsForDeal(FAKE_DEAL_ID, { sources: fakeSources(() => { throw enoentError(); }) }),
    [],
  );
  assert.deepEqual(serving.canonicalTerminationFeeCardsForDeal('00000000-0000-4000-8000-000000000000'), []);
});

test('attachCanonicalTerminationFeeServing stamps FAILED and logs it; NOT_REGISTERED/ATTACHED stay silent', () => {
  const key = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY;
  const on = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE;
  const STATUS_FIELD = serving.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD;

  // FAILED: logged, tagged with the deal id, on the injected sink (never the
  // real console during a test run).
  const failedLogger = loggerSpy();
  const failedServed = serving.attachCanonicalTerminationFeeServing(
    { dealId: FAKE_DEAL_ID, cards: [] },
    { env: { [key]: on }, logger: failedLogger, sources: fakeSources(() => { throw enoentError(); }) },
  );
  assert.equal(failedServed[SERVING_FIELD], true);
  assert.deepEqual(failedServed[CARDS_FIELD], []);
  assert.equal(failedServed[STATUS_FIELD].state, 'FAILED');
  assert.equal(failedLogger.calls.length, 1);
  assert.match(failedLogger.calls[0][0], /FAILED/);
  assert.match(failedLogger.calls[0][0], new RegExp(FAKE_DEAL_ID));

  // NOT_REGISTERED: the common case for nearly every deal. Not logged.
  const unregisteredLogger = loggerSpy();
  const unregisteredServed = serving.attachCanonicalTerminationFeeServing(
    { dealId: '00000000-0000-4000-8000-000000000000', cards: [] },
    { env: { [key]: on }, logger: unregisteredLogger },
  );
  assert.equal(unregisteredServed[STATUS_FIELD].state, 'NOT_REGISTERED');
  assert.equal(unregisteredLogger.calls.length, 0);

  // ATTACHED, through the REAL QXO/TopBuild registry entry (no `sources`
  // override): the real pinned source still loads through the new code
  // path, unchanged, and is not logged either.
  const attachedLogger = loggerSpy();
  const attachedServed = serving.attachCanonicalTerminationFeeServing(
    { dealId: serving.QXO_TOPBUILD_DEAL_ID, cards: [] },
    { env: { [key]: on }, logger: attachedLogger },
  );
  assert.equal(attachedServed[STATUS_FIELD].state, 'ATTACHED');
  assert.equal(attachedServed[STATUS_FIELD].card_count, attachedServed[CARDS_FIELD].length);
  assert.ok(attachedServed[CARDS_FIELD].length > 0);
  assert.equal(attachedLogger.calls.length, 0);
});

test('the wire allowlist carries the source status through, and omits it when absent', () => {
  const STATUS_FIELD = serving.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD;
  const bare = trimReviewDealForWire({ dealId: 'd', cardCount: 0, cards: [] });
  assert.equal(Object.prototype.hasOwnProperty.call(bare, STATUS_FIELD), false);

  const outcome = {
    schema_version: 'CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS/V1',
    state: 'FAILED',
    card_count: 0,
    failure: { error_name: 'Error', error_code: 'ENOENT', error_message: 'boom' },
  };
  const served = trimReviewDealForWire({ dealId: 'd', cardCount: 0, cards: [], [STATUS_FIELD]: outcome });
  assert.deepEqual(served[STATUS_FIELD], outcome);
});

// ---------------------------------------------------------------------------
// 6b. The rendered table distinguishes the two failure states
// ---------------------------------------------------------------------------

test('a FAILED source renders a different, actionable message -- never "no data for this deal"', async () => {
  const mod = await config();
  const STATUS_FIELD = mod.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD;
  const legacy = legacyCards();
  const rows = mod.terminationFeesConfig.selectRows({
    cards: legacy,
    value_usd: DEAL_VALUE_USD,
    [SERVING_FIELD]: true,
    [CARDS_FIELD]: [],
    [STATUS_FIELD]: { state: 'FAILED', card_count: 0, failure: { error_name: 'Error', error_code: 'ENOENT', error_message: 'boom' } },
  });

  assert.equal(rows[0].id, 'termination-fees-serving-source');
  assert.equal(rows[0].servingSourceState, 'LEGACY_FALLBACK_SOURCE_FAILED');
  assert.match(rows[0].detail, /could not load or verify its source/);
  // Never the false claim: this deal DOES have canonical data, it just
  // couldn't be read or verified.
  assert.equal(/has no termination-fee data for this deal/.test(rows[0].detail), false);
  assert.equal(rows[0].signals[0].tone, 'warning');

  // The legacy table underneath is unaffected -- the failure degrades the
  // provenance notice only, never the data the reviewer is actually using.
  const expected = [
    ...mod.feeTableRows(legacy, DEAL_VALUE_USD),
    ...mod.scalarRows(legacy),
    ...mod.deferredEvidenceRows(legacy),
  ];
  assert.equal(JSON.stringify(rows.slice(1)), JSON.stringify(expected));
});

test('FAILED and NOT_REGISTERED render textually distinct messages for the same empty card set', async () => {
  const mod = await config();
  const STATUS_FIELD = mod.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD;
  const legacy = legacyCards();
  const base = { cards: legacy, value_usd: DEAL_VALUE_USD, [SERVING_FIELD]: true, [CARDS_FIELD]: [] };

  const notRegisteredRows = mod.terminationFeesConfig.selectRows(base);
  const failedRows = mod.terminationFeesConfig.selectRows({
    ...base,
    [STATUS_FIELD]: { state: 'FAILED', card_count: 0, failure: null },
  });
  const explicitNotRegisteredRows = mod.terminationFeesConfig.selectRows({
    ...base,
    [STATUS_FIELD]: { state: 'NOT_REGISTERED', card_count: 0, failure: null },
  });

  assert.equal(notRegisteredRows[0].servingSourceState, 'LEGACY_FALLBACK');
  assert.equal(failedRows[0].servingSourceState, 'LEGACY_FALLBACK_SOURCE_FAILED');
  assert.notEqual(notRegisteredRows[0].detail, failedRows[0].detail);

  // Absent status field and an explicit NOT_REGISTERED status render
  // identically -- both are "no data for this deal", stated the same way,
  // so every reviewDeal built before this field existed stays byte-identical.
  assert.equal(explicitNotRegisteredRows[0].servingSourceState, 'LEGACY_FALLBACK');
  assert.equal(JSON.stringify(explicitNotRegisteredRows), JSON.stringify(notRegisteredRows));
});

test('isCanonicalTerminationFeeSourceFailed fails closed on malformed and prototype-chain input', async () => {
  const mod = await config();
  const STATUS_FIELD = mod.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD;
  assert.equal(mod.isCanonicalTerminationFeeSourceFailed(null), false);
  assert.equal(mod.isCanonicalTerminationFeeSourceFailed(undefined), false);
  assert.equal(mod.isCanonicalTerminationFeeSourceFailed({}), false);
  assert.equal(mod.isCanonicalTerminationFeeSourceFailed({ [STATUS_FIELD]: 'FAILED' }), false, 'a bare string is not a status object');
  assert.equal(mod.isCanonicalTerminationFeeSourceFailed({ [STATUS_FIELD]: { state: 'ATTACHED' } }), false);
  assert.equal(mod.isCanonicalTerminationFeeSourceFailed({ [STATUS_FIELD]: { state: 'FAILED' } }), true);
  // A prototype-chain status can never trigger the FAILED message either.
  const polluted = Object.create({ [STATUS_FIELD]: { state: 'FAILED' } });
  assert.equal(mod.isCanonicalTerminationFeeSourceFailed(polluted), false);
});

test('the review table still renders in all three server-side source states, without throwing', async () => {
  const mod = await config();
  const STATUS_FIELD = mod.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD;
  const legacy = legacyCards();
  const base = { cards: legacy, value_usd: DEAL_VALUE_USD, [SERVING_FIELD]: true };

  const notRegistered = mod.terminationFeesConfig.selectRows({ ...base, [CARDS_FIELD]: [], [STATUS_FIELD]: { state: 'NOT_REGISTERED' } });
  assert.ok(notRegistered.length > 1);
  assert.equal(notRegistered[0].servingSourceState, 'LEGACY_FALLBACK');

  const attached = mod.terminationFeesConfig.selectRows({ ...base, [CARDS_FIELD]: qxoCanonicalCards(), [STATUS_FIELD]: { state: 'ATTACHED', card_count: 1 } });
  assert.ok(attached.length > 1);
  assert.equal(attached[0].servingSourceState, 'CANONICAL');

  const failed = mod.terminationFeesConfig.selectRows({ ...base, [CARDS_FIELD]: [], [STATUS_FIELD]: { state: 'FAILED', card_count: 0, failure: null } });
  assert.ok(failed.length > 1);
  assert.equal(failed[0].servingSourceState, 'LEGACY_FALLBACK_SOURCE_FAILED');
});

// ---------------------------------------------------------------------------
// 6c. End to end against the REAL pinned source -- the actual live bug
// ---------------------------------------------------------------------------
// Proves the fix against the real mechanism -- the real, uninjected registry
// entry backed by the real, committed require()'d generated module -- not an
// injected stand-in.
//
// This test used to prove the fix by renaming the .txt fixture out of the
// way and observing a graceful FAILED state, because the pre-fix mechanism
// read that .txt at REQUEST time via fs.readFileSync, and the live incident
// (Vercel, 2026-08-05) was exactly that read silently failing in production.
// That mechanism no longer exists: lib/canonical-v2/termination-fee-serving-
// source.js now reaches its text through a literal, static require() of
// __fixtures__/canonical-v2/qxo-termination-fee-reviewed-excerpts.generated.js,
// resolved once at module load and cached -- see that module's "VERCEL FILE
// TRACING" comment for the full incident and fix. Renaming the .txt on disk
// no longer has any effect on the served path, so the old rename-and-restore
// mechanic here would prove nothing and was never finished being updated to
// match. tests/qxo-termination-fee-excerpt-module.test.js separately, and
// exhaustively, proves the generated module can never drift from the .txt.
// What is left for THIS test to prove, end to end, for real, is the thing
// the live incident actually broke: that the real registered QXO/TopBuild
// source -- no `sources` override, no simulated failure -- resolves ATTACHED
// with real cards, through the real require()'d module.

test('the real pinned QXO source: resolves ATTACHED with real cards end to end through the real require()\'d module', () => {
  const fixturePath = path.join(__dirname, '..', '__fixtures__', 'canonical-v2', 'qxo-termination-fee-reviewed-excerpts.txt');
  const generatedPath = path.join(__dirname, '..', '__fixtures__', 'canonical-v2', 'qxo-termination-fee-reviewed-excerpts.generated.js');
  assert.ok(fs.existsSync(fixturePath), 'precondition: the real reviewed .txt source must exist on disk');
  assert.ok(fs.existsSync(generatedPath), 'precondition: the real generated module the server actually require()s at load time must exist on disk');

  const STATUS_FIELD = serving.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD;

  // No `sources` override: this is the real registry, the real deal id, the
  // real require()'d module -- the exact path the live incident broke.
  const { cards, outcome } = serving.describeCanonicalTerminationFeeSource(serving.QXO_TOPBUILD_DEAL_ID);
  assert.equal(outcome.state, 'ATTACHED');
  assert.equal(outcome.card_count, cards.length);
  assert.ok(cards.length > 0, 'the real source must produce at least one card, never the silent empty array the live incident served');

  // canonicalTerminationFeeCardsForDeal() is the same real, uninjected call
  // qxoCanonicalCards() (used throughout this file) makes, and
  // attachCanonicalTerminationFeeServing() is the actual served wire path.
  assert.deepEqual(serving.canonicalTerminationFeeCardsForDeal(serving.QXO_TOPBUILD_DEAL_ID), cards);
  const key = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY;
  const on = serving.CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE;
  const served = serving.attachCanonicalTerminationFeeServing(
    { dealId: serving.QXO_TOPBUILD_DEAL_ID, cards: [] },
    { env: { [key]: on } },
  );
  assert.equal(served[SERVING_FIELD], true);
  assert.deepEqual(served[CARDS_FIELD], cards);
  assert.equal(served[STATUS_FIELD].state, 'ATTACHED');

  // And it is the real reviewed fee, not a stub: the pinned $600,000,000
  // company termination fee amount and all five real triggers, on the
  // TERMF-TARGET card.
  const feeCard = cards.find((card) => card.provision_subtype === 'TERMF-TARGET');
  assert.ok(feeCard, 'the real source must produce the company termination fee card');
  assert.equal(feeCard.features.companyTerminationFee.amount, '$600,000,000');
  assert.equal(feeCard.features.companyTerminationFee.triggers.length, 5);
});
