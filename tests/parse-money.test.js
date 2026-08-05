// Tests for lib/parse-money.js — the single shared "parse exactly one
// amount out of a string" primitive that replaces six independent,
// duplicate money-parsing implementations (see that file's header comment
// for the full backstory and the disagreement this consolidation resolves).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoneyAmount } = require('../lib/parse-money');

// The real Global Net Lease / Modiv Industrial company termination fee
// headline (lib/canonical-v2/termination-product-projection.js's
// conditionalFeeHeadline output, pinned byte-for-byte in
// tests/canonical-v2-termination-fee-conditional-amount-projection.test.js
// and sourced from the real committed fixture at
// tests/fixtures/review-parity/cases/termination-fees/dfaa71fa-modiv.resolution.json).
const MODIV_COMPANY_FEE_HEADLINE = 'Lesser of $10,000,000 (§7.3(b)(i), (ii) or (iii)) or $15,000,000 (§7.3(b)(iv) or (v)) and the REIT Requirements cap';
// The reverse/parent side of the same real deal: one dollar figure, one
// unrelated section citation.
const MODIV_PARENT_FEE_HEADLINE = 'Lesser of $15,000,000 (§7.3(c)) and the REIT Requirements cap';

/* ─────────────────────────────────────────────────────────────────────────
   Base contract: exactly one figure resolves; anything else is null.
   ───────────────────────────────────────────────────────────────────────── */

test('a single clean dollar figure resolves', () => {
  assert.equal(parseMoneyAmount('$600,000,000'), 600000000);
  assert.equal(parseMoneyAmount('600000000'), 600000000);
  assert.equal(parseMoneyAmount('3.5'), 3.5);
  assert.equal(parseMoneyAmount(600000000), 600000000);
});

test('a genuinely two-figure headline (real Modiv company fee) returns null, never the first branch', () => {
  assert.equal(parseMoneyAmount(MODIV_COMPANY_FEE_HEADLINE), null);
  assert.equal(parseMoneyAmount(MODIV_COMPANY_FEE_HEADLINE, { scale: true }), null);
  // Sanity: the string demonstrably contains "10,000,000" first -- proves
  // this isn't null merely because parsing failed outright.
  assert.match(MODIV_COMPANY_FEE_HEADLINE, /^Lesser of \$10,000,000/);
});

test('the old "strip every non-digit character" defect is eliminated, not just improved', () => {
  // The worst of the six (consideration-hero.config.js's and ioc-exceptions.
  // config.js's original parseDollarNumber) stripped all non-digits and
  // concatenated: "$10,000,000 or $15,000,000" -> 1000000015000000. That
  // input must now be null, not a ten-digit fabrication.
  const result = parseMoneyAmount('$10,000,000 or $15,000,000');
  assert.equal(result, null);
  assert.notEqual(result, 1000000015000000);
});

test('a range returns null, not its first endpoint', () => {
  assert.equal(parseMoneyAmount('30-45 days'), null);
  assert.equal(parseMoneyAmount('2-3%'), null);
});

test('zero is distinguishable from nothing', () => {
  assert.equal(parseMoneyAmount(0), 0);
  assert.equal(parseMoneyAmount('$0'), 0);
  assert.notEqual(parseMoneyAmount('TBD'), 0);
  assert.equal(parseMoneyAmount('TBD'), null);
});

test('non-numeric, empty, and non-string/number inputs stay null', () => {
  assert.equal(parseMoneyAmount(null), null);
  assert.equal(parseMoneyAmount(undefined), null);
  assert.equal(parseMoneyAmount(''), null);
  assert.equal(parseMoneyAmount('not specified'), null);
  assert.equal(parseMoneyAmount(NaN), null);
  assert.equal(parseMoneyAmount(Infinity), null);
  // Object shapes are each call site's own concern (see file header) --
  // an un-unwrapped object is simply not a supported input here.
  assert.equal(parseMoneyAmount({ value: 5 }), null);
});

test('negative figures are supported (majority behavior across the six)', () => {
  assert.equal(parseMoneyAmount('-5000000'), -5000000);
  assert.equal(parseMoneyAmount('$-5,000,000'), -5000000);
});

/* ─────────────────────────────────────────────────────────────────────────
   Ambiguity rule: dollar-sign-aware, with a bare-numeral fallback.
   This is the disclosed disagreement this consolidation resolves -- see
   lib/parse-money.js's header "FINDING" section for the full writeup.
   Before this change, parseFeeAmountUsd (termination-fees.config.js)
   already used this dollar-scoped rule and resolved the Modiv reverse fee
   to 15000000 ("0.75% of deal value" on the review page's termination-fees
   table, pinned in tests/canonical-v2-termination-fee-conditional-amount-
   projection.test.js). numericValue (lib/feature-compare.js) and
   parseUsdAmount (lib/query/derived-fields.js) instead counted every bare
   numeral and returned null for the identical string -- so the query engine
   silently excluded Modiv's reverse fee from feePctOfDealValue / cross-deal
   comparisons while the review page displayed a real percentage for it.
   Consolidating onto the dollar-scoped rule makes all three surfaces agree,
   and matches the one call site with an explicit, reviewed test naming this
   exact scope ("the guard is scoped to multi-figure strings only").
   ───────────────────────────────────────────────────────────────────────── */

test('a single dollar figure beside an unrelated citation number is NOT ambiguous (real Modiv reverse/parent fee)', () => {
  assert.equal(parseMoneyAmount(MODIV_PARENT_FEE_HEADLINE), 15000000);
  assert.equal(parseMoneyAmount(MODIV_PARENT_FEE_HEADLINE, { scale: true }), 15000000);
});

test('with no "$" anywhere, ambiguity falls back to counting every bare numeral (duration/percentage callers)', () => {
  // "20 to 30 days", "30-45 days" style values never carry a "$" -- the
  // dollar-scoped rule can't apply, so every numeral competes, matching
  // numericValue()'s and parseUsdAmount()'s pre-existing behavior for these.
  assert.equal(parseMoneyAmount('30-45 days'), null);
  assert.equal(parseMoneyAmount('within 30 days of Section 7.3'), null, 'two bare numerals, no $ to scope by -> ambiguous');
  assert.equal(parseMoneyAmount('within 30 days'), 30, 'exactly one bare numeral, no $ at all -> resolves');
});

test('two "$"-marked figures are always ambiguous regardless of any other numerals present', () => {
  assert.equal(parseMoneyAmount('$10,000,000 (§1.1) or $15,000,000 (§1.2)'), null);
});

/* ─────────────────────────────────────────────────────────────────────────
   Scale words (opt-in). Union of every scale-word variant the six had
   between them (parseFeeAmountUsd: million/billion only; review-v1's
   parseDollarAmount: billion/bn/million/mm/m/thousand/k) -- the full set is
   available to any caller that opts in, so extending parseFeeAmountUsd's
   call site to recognize the abbreviations it didn't have before is a
   strict capability gain, not a narrowing.
   ───────────────────────────────────────────────────────────────────────── */

test('scale words apply only when explicitly requested', () => {
  // Without scale:true the trailing word is simply never looked at -- the
  // one "$190" figure resolves unscaled, not null and not 190000000.
  assert.equal(parseMoneyAmount('$190 million'), 190);
});

test('scale: true recognizes the full union of variants (review-v1 doc-comment examples + abbreviations)', () => {
  assert.equal(parseMoneyAmount('$190,000,000', { scale: true }), 190000000);
  assert.equal(parseMoneyAmount('$190 million', { scale: true }), 190000000);
  assert.equal(parseMoneyAmount('$1.3 billion', { scale: true }), 1300000000);
  assert.equal(parseMoneyAmount('$1.2bn', { scale: true }), 1200000000);
  assert.equal(parseMoneyAmount('$10mm', { scale: true }), 10000000);
  assert.equal(parseMoneyAmount('$10m', { scale: true }), 10000000);
  assert.equal(parseMoneyAmount('$500k', { scale: true }), 500000);
  assert.equal(parseMoneyAmount('$5 thousand', { scale: true }), 5000);
});

test('scale: true never guesses when a scale word appears elsewhere, not adjacent to the figure', () => {
  assert.equal(parseMoneyAmount('$10,000,000, roughly a million times bigger', { scale: true }), null);
});

test('scale word must be immediately adjacent (whitespace only) to count, not merely present nearby', () => {
  assert.equal(parseMoneyAmount('$10,000,000 (approximately) million', { scale: true }), null, 'not adjacent -> bails rather than guessing');
});

test('a plural scale word elsewhere does not trigger the bail (inherited word-boundary behavior, not a new gap)', () => {
  // \bmillion\b has no boundary inside "millions" (word char runs straight
  // through) -- this is parseFeeAmountUsd's pre-existing, already-shipped
  // regex shape, preserved unchanged rather than silently tightened.
  assert.equal(parseMoneyAmount('$10,000,000, expressed here in millions of dollars', { scale: true }), 10000000);
});

/* ─────────────────────────────────────────────────────────────────────────
   headlinesAgree()-style numeric equality (termination-fees.config.js
   compares a V1 and a V2 headline for the same figure).
   ───────────────────────────────────────────────────────────────────────── */

test('two differently-formatted strings for the same figure parse equal', () => {
  assert.equal(parseMoneyAmount('$600,000,000', { scale: true }), parseMoneyAmount('$600,000,000.00', { scale: true }));
});
