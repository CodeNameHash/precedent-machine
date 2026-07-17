const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildElectionCarrierProvision,
  enforceConsiderationEquityInvariants,
} = require('../../../lib/parser-v2/consideration-equity');

const {
  buildElectionMechanism,
  enforceElectionInvariants,
  hasNegativeElectionGuard,
  deriveOptionLabel,
  attributeConsiderationFeatures,
} = require('../../../lib/parser-v2/elections');

test('cash-or-stock election with proration emits two options and one proration rule', () => {
  const regionFullText = [
    'Cash Election. Each holder making a Cash Election shall receive $12.50 per share, subject to the Maximum Cash Election Number equal to forty-five percent (45%) of Company Shares.',
    'Stock Election. Each holder making a Stock Election shall receive 0.25 Parent shares per Company Share, subject to the Maximum Stock Election Number equal to fifty-five percent (55%) of Company Shares.',
    'Proration. If Cash Elections are oversubscribed, the Cash Election Shares shall be reduced pro rata and excess shares shall receive Stock Consideration.',
    'Any Non-Election Share shall be deemed to have made a Stock Election.',
  ].join(' ');
  const election = buildElectionMechanism({ regionFullText });

  assert.equal(election.electionType, 'CASH_OR_STOCK');
  assert.equal(election.isProrated, true);
  assert.equal(election.options.length, 2);
  assert.deepEqual(election.options.map((o) => o.optionType), ['CASH_ELECTION', 'STOCK_ELECTION']);
  assert.equal(election.prorationRule.prorationMethod, 'PRO_RATA_REDUCTION');
  enforceElectionInvariants(election, regionFullText);
});

test('synthetic CVR inclusion election emits with-CVR and without-CVR options', () => {
  const regionFullText = [
    'CVR Election. Each holder may elect to receive consideration with CVR rights or without CVR rights.',
    'With CVR. Each share receives $10.00 in cash with a CVR.',
    'Without CVR. Each share receives $11.00 in cash without a CVR.',
  ].join(' ');
  const election = buildElectionMechanism({ regionFullText });

  assert.equal(election.electionType, 'CVR_INCLUSION');
  assert.equal(election.options.length, 2);
  assert.deepEqual(election.options.map((o) => o.cvrIncluded), [true, false]);
  enforceElectionInvariants(election, regionFullText);
});

test('single-form consideration control emits no election', () => {
  const election = buildElectionMechanism({
    regionFullText: 'Each share of Company Common Stock shall be converted into the right to receive $47.50 in cash.',
  });
  assert.equal(election, null);
});

test('shareholder cash-or-stock election in CONSID provision emits an election carrier', () => {
  const fullText = [
    'Section 2.01 Merger Consideration.',
    'Cash Election. Each holder making a Cash Election shall receive $20.00 in cash for each Company Share.',
    'Stock Election. Each holder making a Stock Election shall receive 0.50 Parent shares for each Company Share.',
    'Proration. If Cash Elections are oversubscribed, Cash Election Shares shall be reduced pro rata.',
    'Any Non-Election Share shall be deemed to have made a Stock Election.',
  ].join(' ');
  const carrier = buildElectionCarrierProvision({
    type: 'CONSID',
    code: 'CONSID-CONVERT',
    text: fullText,
    features: { sectionNumber: '2.01' },
  });

  assert.equal(carrier.provisionType, 'CONSID-ELECTION');
  assert.equal(carrier.treatments.length, 0);
  assert.equal(carrier.electionMechanism.electionType, 'CASH_OR_STOCK');
  assert.deepEqual(carrier.electionMechanism.options.map((o) => o.optionType), ['CASH_ELECTION', 'STOCK_ELECTION']);
  enforceConsiderationEquityInvariants(carrier);
});

test('election invariant rejects one option', () => {
  const regionFullText = 'Cash Election. Each holder may elect to receive $10.00 in cash.';
  assert.throws(
    () => enforceElectionInvariants({
      electionType: 'OTHER',
      isProrated: false,
      options: [{
        optionType: 'CASH_ELECTION',
        displayOrder: 1,
        sourceSpanStart: 0,
        sourceSpanEnd: regionFullText.length,
        verbatimQuote: regionFullText,
      }],
      sourceSpanStart: 0,
      sourceSpanEnd: regionFullText.length,
      verbatimQuote: regionFullText,
    }, regionFullText),
    /at least two options/,
  );
});

test('election invariant rejects display-order gaps and quote drift', () => {
  const regionFullText = 'Cash Election. Stock Election.';
  assert.throws(
    () => enforceElectionInvariants({
      electionType: 'CASH_OR_STOCK',
      isProrated: false,
      options: [
        { optionType: 'CASH_ELECTION', displayOrder: 1, cashPerShareFormula: 'cash', sourceSpanStart: 0, sourceSpanEnd: 13, verbatimQuote: 'Cash Election' },
        { optionType: 'STOCK_ELECTION', displayOrder: 3, stockPerShareFormula: 'stock', sourceSpanStart: 15, sourceSpanEnd: 29, verbatimQuote: 'Stock Election.' },
      ],
      sourceSpanStart: 0,
      sourceSpanEnd: regionFullText.length,
      verbatimQuote: regionFullText,
    }, regionFullText),
    /display_order/,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ELECTION-REDO-SPEC-2026-07-16 regression coverage.
 *
 * The QXO/Skechers/IonQ fixtures below are TRIMMED excerpts of the real
 * (production) consideration_equity_provisions.region_full_text for those
 * deals, read directly from Supabase for this redo (read-only; no writes),
 * kept close to verbatim so the regexes are validated against the actual
 * drafting conventions that broke the old extraction, not an idealized
 * synthetic shape.
 * ══════════════════════════════════════════════════════════════════════════ */

// Trimmed QXO/TopBuild Section 2.1 — the real bug: $505.00/20.200 live in the
// "Merger Consideration" paragraph, while "Cash Election"/"Stock Election"
// are only DEFINED two paragraphs later in "Types of Election", with a
// 45%/55% proration-cap clause sitting in between (the clause the old span
// matcher grabbed instead of the real numbers). "No Election Shares" is
// deemed a STOCK election, stated in reverse order ("...Stock Elections have
// been made (such Company Shares, the "No Election Shares")").
const QXO_TEXT = [
  '(i) Merger Consideration. Subject to the allocation and election procedures set forth in Section 2.1(b), each Company Share issued and outstanding immediately prior to the Titanium Merger Effective Time shall be automatically converted into the right to receive, and become exchangeable for either (x) 20.200 validly issued, fully paid and non-assessable Parent Shares, subject to Section 2.5 with respect to any Merger Fractional Share Payout (the "Stock Consideration"), or (y) an amount in cash equal to $505.00 (the "Cash Consideration"). The applicable Stock Consideration or Cash Consideration, in each case, without interest, is the "Per Share Merger Consideration".',
  '(i) Allocation. Notwithstanding anything in this Agreement to the contrary, the maximum number of Company Shares to be converted into the right to receive Cash Consideration in the Titanium Merger shall be equal to forty-five percent (45%) of the aggregate number of Company Shares issued and outstanding (the "Maximum Cash Election Number") and the maximum number of Company Shares to be converted into the right to receive Stock Consideration in the Titanium Merger shall be equal to fifty-five percent (55%) of the aggregate number of Company Shares issued and outstanding (the "Maximum Stock Election Number").',
  '(B) Types of Election. Subject to allocation and proration in accordance with the provisions of this Section 2.1(b), each record holder of Company Shares issued and outstanding immediately prior to the Election Deadline shall be entitled to elect to receive in respect of each such Company Share held by such record holder Cash Consideration (a "Cash Election") or Stock Consideration (a "Stock Election"). Company Shares in respect of which no Cash Election or Stock Election has been affirmatively made and not revoked shall be deemed to be Company Shares in respect of which Stock Elections have been made (such Company Shares, the "No Election Shares").',
  '(C) Form of Election and Election Deadline. Elections shall be made on a form (a "Form of Election") to be provided by the Exchange Agent.',
  '(E) Proration for Oversubscription of Cash Election. In the event that the aggregate number of Cash Election Shares exceeds the Maximum Cash Election Number, all Cash Election Shares shall be converted into the right to receive a pro rata reduced amount of Cash Consideration, with the balance converted into Stock Consideration.',
].join(' ');

// Trimmed Skechers/Beach Section 2.7(b) — Cash Election vs Mixed Election
// (cash + 1 Parent Unit), NOT Cash-vs-Stock. Non-Election Shares default to
// the Cash Election Consideration.
const SKECHERS_TEXT = [
  '(b) Conversion of Company Common Stock. At the Effective Time, each share of Company Common Stock will be cancelled and automatically converted into the right to receive the following consideration (collectively, the "Merger Consideration"):',
  '(i) each share of Company Common Stock with respect to which an election to receive only cash (a "Cash Election") has been validly made and not revoked ("Cash Election Shares") shall be converted into the right to receive cash in an amount equal to $63.00, without interest thereon (the "Cash Election Consideration");',
  '(ii) each share of Company Common Stock with respect to which an election to receive a mixture of cash and Parent Units (a "Mixed Election") has been validly made and not revoked ("Mixed Election Shares") shall be converted into the right to receive (1) an amount in cash equal to $57.00 (the "Mixed Election Cash Consideration") and (2) one Parent Unit (the "Mixed Election Equity Consideration" and together with the Mixed Election Cash Consideration, the "Mixed Election Consideration"); and',
  '(iii) each share of Company Common Stock with respect to which a Mixed Election or Cash Election has not been validly made or has been revoked before the Election Deadline ("Non-Election Shares") shall be converted automatically into the right to receive the Cash Election Consideration.',
].join(' ');

// Trimmed IonQ/SkyWater Section 1.4(a) — the real false-positive text. Fixed
// cash + fixed stock consideration for EVERY holder (no holder choice at
// all); the bug was ELECTION_SIGNAL_RE matching the bare word "proration" in
// "no proration shall apply."
const IONQ_TEXT = [
  '(a) At the Effective Time, each share of Company Common Stock issued and outstanding immediately prior to the Effective Time shall be converted into and shall thereafter represent the right to receive (1) an amount in cash, without interest, equal to $15.00 (the "Per Share Cash Consideration") and (2) such number of validly issued, fully paid and nonassessable shares of Parent Common Stock equal to the Exchange Ratio (the "Per Share Stock Consideration" and, together with the Per Share Cash Consideration, "Merger Consideration").',
  'No election shall be made available to any holder of Company Common Stock with respect to the form of consideration, and no proration shall apply.',
].join(' ');

test('QXO-shaped text: option labels come from the agreement\'s own defined terms, not hardcoded strings', () => {
  const election = buildElectionMechanism({ regionFullText: QXO_TEXT });
  assert.ok(election, 'QXO-shaped text should produce an election mechanism');
  assert.equal(deriveOptionLabel(QXO_TEXT, 'CASH_ELECTION'), 'Cash Election');
  assert.equal(deriveOptionLabel(QXO_TEXT, 'STOCK_ELECTION'), 'Stock Election');
  // Not the longer defined terms that also contain the keyword substring.
  assert.notEqual(deriveOptionLabel(QXO_TEXT, 'CASH_ELECTION'), 'Maximum Cash Election Number');
});

test('QXO-shaped text: per-option economics resolve from the defined-term clause, not the proration-cap clause in between', () => {
  const election = buildElectionMechanism({ regionFullText: QXO_TEXT });
  const cash = election.options.find((o) => o.optionType === 'CASH_ELECTION');
  const stock = election.options.find((o) => o.optionType === 'STOCK_ELECTION');
  assert.equal(cash.cashPerShare, 505);
  assert.equal(cash.cashPerShareFormula, null, 'must not fall back to a formula dump when a real number resolved');
  assert.doesNotMatch(cash.verbatimQuote, /forty-five percent|Maximum Cash Election Number/, 'quote must not be the proration-cap clause');
  assert.equal(stock.stockPerShare, 20.2);
  assert.equal(stock.stockPerShareFormula, null);
  enforceElectionInvariants(election, QXO_TEXT);
});

test('QXO-shaped text: default treatment resolves correctly even when "Stock Elections have been made" precedes the "No Election Shares" label', () => {
  const election = buildElectionMechanism({ regionFullText: QXO_TEXT });
  assert.equal(election.defaultTreatment, 'NON_ELECTING_TREATED_AS_STOCK_ELECTION');
});

test('Skechers-shaped text: Cash/Mixed election with a mixed cash+unit option resolves both legs of the Mixed option', () => {
  const election = buildElectionMechanism({ regionFullText: SKECHERS_TEXT });
  assert.ok(election, 'Skechers-shaped text should produce an election mechanism');
  const cash = election.options.find((o) => o.optionType === 'CASH_ELECTION');
  const mixed = election.options.find((o) => o.optionType === 'MIXED_ELECTION');
  assert.equal(cash.optionLabel, 'Cash Election');
  assert.equal(cash.cashPerShare, 63);
  assert.equal(mixed.optionLabel, 'Mixed Election');
  assert.equal(mixed.cashPerShare, 57, 'Mixed option cash leg (Mixed Election Cash Consideration)');
  assert.equal(mixed.stockPerShare, 1, 'Mixed option unit leg ("one Parent Unit" -> 1, word-number resolved)');
  assert.equal(election.defaultTreatment, 'NON_ELECTING_TREATED_AS_CASH_ELECTION');
  enforceElectionInvariants(election, SKECHERS_TEXT);
});

test('IonQ-class negative guard: fixed cash+stock consideration with "no election...no proration" language produces NO mechanism', () => {
  const election = buildElectionMechanism({ regionFullText: IONQ_TEXT });
  assert.equal(election, null);
});

test('negative guard helper only fires when negative phrasing is present AND no affirmative election language exists', () => {
  assert.equal(hasNegativeElectionGuard(IONQ_TEXT), true);
  // A genuine election document may deny election for ONE share class while
  // still being a true election deal overall -- affirmative language
  // elsewhere must prevent the guard from firing.
  const mixedDoc = `${IONQ_TEXT} Notwithstanding the foregoing, holders of Company RSU Shares shall be entitled to elect to receive Cash Consideration in lieu of Stock Consideration, subject to the Election Deadline set forth in Section 2.3.`;
  assert.equal(hasNegativeElectionGuard(mixedDoc), false);
});

test('negative guard rejects synthetic fixed mixed consideration text using generic election-signal wording', () => {
  const regionFullText = [
    'Merger Consideration. Each share of Company Common Stock shall be converted into the right to receive $30.00 in cash (the "Cash Consideration") and 0.15 shares of Parent Common Stock (the "Stock Consideration") (together, the "Merger Consideration").',
    'No election shall be made available to any holder of Company Common Stock with respect to the Merger Consideration, and no proration shall apply.',
  ].join(' ');
  assert.equal(buildElectionMechanism({ regionFullText }), null);
});

test('appliesTo attribution ties QXO-shaped headline consideration features to their election option', () => {
  const election = buildElectionMechanism({ regionFullText: QXO_TEXT });
  const attribution = attributeConsiderationFeatures(election, {
    perShareAmount: '$505.00',
    exchangeRatio: 20.2,
    appraisalRightsAvailable: true,
  });
  assert.equal(attribution.perShareAmount, 'CASH_ELECTION');
  assert.equal(attribution.exchangeRatio, 'STOCK_ELECTION');
  // Unrelated / unmatched keys are never invented.
  assert.equal('appraisalRightsAvailable' in attribution, false);
});

test('appliesTo attribution ties Skechers-shaped features (cash-only and mixed) to their options', () => {
  const election = buildElectionMechanism({ regionFullText: SKECHERS_TEXT });
  const attribution = attributeConsiderationFeatures(election, {
    perShareAmount: '$63.00',
    cashAmount: '$57.00',
  });
  assert.equal(attribution.perShareAmount, 'CASH_ELECTION');
  assert.equal(attribution.cashAmount, 'MIXED_ELECTION');
});

test('appliesTo attribution returns nothing for a value that matches no option (never guesses)', () => {
  const election = buildElectionMechanism({ regionFullText: QXO_TEXT });
  const attribution = attributeConsiderationFeatures(election, { perShareAmount: '$999.00' });
  assert.equal('perShareAmount' in attribution, false);
});

test('appliesTo attribution on a null mechanism returns an empty object', () => {
  assert.deepEqual(attributeConsiderationFeatures(null, { perShareAmount: '$1.00' }), {});
});

module.exports = { QXO_TEXT, SKECHERS_TEXT, IONQ_TEXT };
