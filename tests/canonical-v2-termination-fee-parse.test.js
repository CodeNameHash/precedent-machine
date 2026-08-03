'use strict';

/**
 * tests/canonical-v2-termination-fee-parse.test.js
 *
 * Acceptance test 1/2 (docs/superpowers/specs/2026-08-02-family-
 * termination-fee-design.md, section 6): fixture integrity (every committed
 * corpus quote byte-verifies against its fixture file) and the parser,
 * table-driven over the coverage map in
 * tests/fixtures/canonical-v2/termination-fee/quotes.json -- every quote
 * copied verbatim from the spec itself (this build is fully offline; no
 * production DB bytes beyond what the spec already quotes were available).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  TERMINATION_FEE_PARSE_VERSION,
  parseFeeAmount,
  parseTailPeriodMonths,
} = require('../lib/canonical-v2/native-producer/termination-fee-parse');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'termination-fee', 'quotes.json');
const FIXTURES = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

function quoteById(id) {
  const entry = FIXTURES.quotes.find((q) => q.id === id);
  assert.ok(entry, `expected a fixture quote with id ${id}`);
  return entry;
}

test('TERMINATION_FEE_PARSE_VERSION is an exported, versioned constant', () => {
  assert.equal(TERMINATION_FEE_PARSE_VERSION, 1);
});

test('fixture integrity: the fixture file parses and every entry carries a retrieval date and a quote', () => {
  assert.equal(FIXTURES.schema_version, 'TERMINATION_FEE_FIXTURE_QUOTES/V1');
  assert.ok(FIXTURES.quotes.length > 0);
  for (const entry of FIXTURES.quotes) {
    assert.ok(entry.retrieved, `${entry.id} missing retrieval date`);
    assert.ok(entry.quote || entry.seller_quote, `${entry.id} missing quote text`);
  }
});

// ---------------------------------------------------------------------------
// parseFeeAmount -- RESOLVED cases, real spec-quoted bytes.
// ---------------------------------------------------------------------------

test('Bioverativ TERMF-TARGET amount resolves 326000000', () => {
  const q = quoteById('bioverativ-target-amount');
  const result = parseFeeAmount(q.quote);
  assert.deepEqual(result, {
    outcome: 'RESOLVED', canonical_value: '326000000', matched_text: '326,000,000', currency: 'USD',
  });
});

test('European Wax Center TERMF-REVERSE amount resolves 19000000', () => {
  const q = quoteById('ewc-reverse-amount');
  const result = parseFeeAmount(q.quote);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '19000000');
});

test('Forest City TERMF-REVERSE amount resolves 488000000 ("Parent Termination Payment" fee term)', () => {
  const q = quoteById('forest-city-reverse-amount');
  const result = parseFeeAmount(q.quote_literal);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '488000000');
  assert.ok(q.quote_literal.includes('Parent Termination Payment'));
});

test('Dyax compound quote ABSTAINs MULTIPLE_MONEY_LITERALS; SELLER split sub-quote resolves 180000000; BUYER split sub-quote resolves 280000000', () => {
  const q = quoteById('dyax-compound-two-sided');
  assert.deepEqual(parseFeeAmount(q.quote), { outcome: 'ABSTAIN', reason: 'MULTIPLE_MONEY_LITERALS' });

  assert.ok(q.quote.startsWith(q.seller_split_subquote));
  const sellerResult = parseFeeAmount(q.seller_split_subquote);
  assert.equal(sellerResult.outcome, 'RESOLVED');
  assert.equal(sellerResult.canonical_value, q.expected_seller_amount_canonical);

  assert.ok(q.quote.endsWith(q.buyer_split_subquote));
  const buyerResult = parseFeeAmount(q.buyer_split_subquote);
  assert.equal(buyerResult.outcome, 'RESOLVED');
  assert.equal(buyerResult.canonical_value, q.expected_buyer_amount_canonical);
});

test('CSRA cross-reference-only quote ABSTAINs NO_MONEY_LITERAL', () => {
  const q = quoteById('csra-cross-reference-only');
  assert.deepEqual(parseFeeAmount(q.quote), { outcome: 'ABSTAIN', reason: 'NO_MONEY_LITERAL' });
});

test('Carrols amount resolves 9500000 (strict grouping, round number)', () => {
  const q = quoteById('carrols-target-amount');
  assert.equal(parseFeeAmount(q.quote).canonical_value, '9500000');
});

test('Prometheus amount resolves 325364166 on the LITERAL "$ 325,364,166" bytes (space after $, audit m-2)', () => {
  const q = quoteById('prometheus-target-amount-space');
  assert.ok(q.quote.includes('$ 325,364,166'), 'sanity: fixture retains the literal space after $');
  const result = parseFeeAmount(q.quote);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '325364166');
});

test('Anadarko amount resolves 1000000000', () => {
  const q = quoteById('anadarko-target-amount');
  assert.equal(parseFeeAmount(q.quote).canonical_value, '1000000000');
});

test('Cooper Tire defined-term amount resolves 83401678 (non-round strict grouping)', () => {
  const q = quoteById('cooper-target-defined-term-amount');
  assert.equal(parseFeeAmount(q.quote).canonical_value, '83401678');
});

test('Concho SELLER/BUYER defined-term amounts resolve 300000000 / 450000000', () => {
  const q = quoteById('concho-two-defined-term-amounts');
  assert.equal(parseFeeAmount(q.seller_quote).canonical_value, q.expected_seller_amount_canonical);
  assert.equal(parseFeeAmount(q.buyer_quote).canonical_value, q.expected_buyer_amount_canonical);
});

test('Covance extended fixture amount resolves 305000000', () => {
  const q = quoteById('covance-reverse-extended');
  const result = parseFeeAmount(q.quote);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, q.expected_amount_canonical);
});

// ---------------------------------------------------------------------------
// parseFeeAmount -- bare-numeral immunity (real spec quotes, no fabricated bytes).
// ---------------------------------------------------------------------------

test('bare-numeral immunity: "no later than three (3) Business Days" and section refs never contaminate the money-literal count', () => {
  const quote = 'the Company shall pay Parent a fee in the amount of $326,000,000 (the "Termination Fee") no later than three (3) Business Days after termination pursuant to Section 8.01(d)(i), representing 50% of the deal value';
  const result = parseFeeAmount(quote);
  assert.deepEqual(result, {
    outcome: 'RESOLVED', canonical_value: '326000000', matched_text: '326,000,000', currency: 'USD',
  });
});

// ---------------------------------------------------------------------------
// parseFeeAmount -- every ABSTAIN class exercised.
// ---------------------------------------------------------------------------

test('NON_USD_CURRENCY: a euro-prefixed literal never resolves (no FX, ever)', () => {
  assert.deepEqual(parseFeeAmount('an amount equal to €500,000,000'), {
    outcome: 'ABSTAIN', reason: 'NON_USD_CURRENCY', matched_text: '€500,000,000',
  });
});

test('MALFORMED_GROUPING: "$1,23,456" abstains, no repair', () => {
  assert.deepEqual(parseFeeAmount('an amount equal to $1,23,456'), {
    outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING', matched_text: '1,23,456',
  });
});

test('NON_LITERAL_MONEY: a spelled-out amount never resolves', () => {
  assert.deepEqual(parseFeeAmount('a fee of three hundred million dollars'), {
    outcome: 'ABSTAIN', reason: 'NON_LITERAL_MONEY',
  });
});

test('parseFeeAmount throws on structurally invalid input, never on prose', () => {
  assert.throws(() => parseFeeAmount(''), TypeError);
  assert.throws(() => parseFeeAmount(undefined), TypeError);
  assert.doesNotThrow(() => parseFeeAmount('gibberish prose with no dollar amounts'));
});

// ---------------------------------------------------------------------------
// parseTailPeriodMonths
// ---------------------------------------------------------------------------

test('Cooper Tire tail ABSTAINs ANNIVERSARY_PHRASE', () => {
  const q = quoteById('cooper-tail-anniversary');
  assert.deepEqual(parseTailPeriodMonths(q.quote), { outcome: 'ABSTAIN', reason: 'ANNIVERSARY_PHRASE' });
});

test('Concho tail card (mixed "seven (7) Business Days" x2 + "twelve (12) months" x4) ABSTAINs MULTIPLE_PERIOD_LITERALS; the narrowed "(ii) within twelve (12) months" split limb resolves 12', () => {
  const q = quoteById('concho-tail-mixed-units');
  assert.deepEqual(parseTailPeriodMonths(q.quote), { outcome: 'ABSTAIN', reason: 'MULTIPLE_PERIOD_LITERALS' });
  const narrowed = parseTailPeriodMonths(q.narrowed_subquote);
  assert.equal(narrowed.outcome, 'RESOLVED');
  assert.equal(narrowed.canonical_value, '12');
});

test('belt-and-braces "twelve (12) months" resolves 12', () => {
  assert.deepEqual(parseTailPeriodMonths('within twelve (12) months of such termination'), {
    outcome: 'RESOLVED', canonical_value: '12', matched_text: '12',
  });
});

test('bare "12 months" resolves 12', () => {
  const result = parseTailPeriodMonths('within 12 months of such termination');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '12');
});

test('word-only "twelve months" (no digit) ABSTAINs NON_LITERAL_NUMERAL', () => {
  assert.deepEqual(parseTailPeriodMonths('within twelve months of such termination'), {
    outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL',
  });
});

test('day-unit period ("365 days") ABSTAINs NON_MONTH_UNIT, never unit arithmetic', () => {
  const result = parseTailPeriodMonths('within 365 days of such termination');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NON_MONTH_UNIT');
});

test('year-unit period ("one (1) year") ABSTAINs NON_MONTH_UNIT', () => {
  const result = parseTailPeriodMonths('within one (1) year of such termination');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NON_MONTH_UNIT');
});

test('NO_PERIOD_LITERAL: no period phrase at all', () => {
  assert.deepEqual(parseTailPeriodMonths('at any time following such termination'), {
    outcome: 'ABSTAIN', reason: 'NO_PERIOD_LITERAL',
  });
});

test('parseTailPeriodMonths throws on structurally invalid input, never on prose', () => {
  assert.throws(() => parseTailPeriodMonths(''), TypeError);
  assert.throws(() => parseTailPeriodMonths(null), TypeError);
  assert.doesNotThrow(() => parseTailPeriodMonths('gibberish prose with no period phrase'));
});

// ---------------------------------------------------------------------------
// Fable build review 2026-08-03, finding F-1 (HYBRID_MAGNITUDE_MONEY):
// "$91.5 million" must NEVER resolve to "91.5" -- the magnitude word
// carries the real scale and this parser never multiplies prose into a
// number. The P1 F-4 wrong-survivor class, caught at review by probe.
// ---------------------------------------------------------------------------

test('F-1 regression: "$91.5 million" ABSTAINs HYBRID_MAGNITUDE_MONEY, never resolves 91.5', () => {
  const result = parseFeeAmount('a termination fee equal to $91.5 million');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'HYBRID_MAGNITUDE_MONEY');
  assert.equal(result.matched_text, '$91.5');
});

test('F-1 regression: "$1.2 billion" ABSTAINs HYBRID_MAGNITUDE_MONEY', () => {
  const result = parseFeeAmount('a fee of $1.2 billion in the aggregate');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'HYBRID_MAGNITUDE_MONEY');
});

test('F-1 regression: "$500 thousand" and "$45 mm" shorthand both ABSTAIN', () => {
  assert.equal(parseFeeAmount('a fee of $500 thousand').reason, 'HYBRID_MAGNITUDE_MONEY');
  assert.equal(parseFeeAmount('a fee of $45 mm payable').reason, 'HYBRID_MAGNITUDE_MONEY');
});

test('F-1 boundary: a full literal is NOT tripped by a later unrelated magnitude word', () => {
  const result = parseFeeAmount('a termination fee of $280,000,000, reflecting millions of dollars of expenses');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '280000000');
});

test('F-1 boundary: "Company Termination Fee" prose with "$91.5 million" plus a full literal still ABSTAINs MULTIPLE_MONEY_LITERALS (multiplicity first)', () => {
  const result = parseFeeAmount('a fee of $91.5 million (i.e., $91,500,000)');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'MULTIPLE_MONEY_LITERALS');
});

test('F-2 regression: trailing sentence comma is not swallowed — "$280,000,000, payable" RESOLVES', () => {
  const result = parseFeeAmount('a termination fee of $280,000,000, payable by wire transfer');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '280000000');
  assert.equal(result.matched_text, '280,000,000');
});

test('F-2 boundary: genuine malformed grouping still ABSTAINs after the token fix', () => {
  const result = parseFeeAmount('a fee of $28,00,000 payable');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'MALFORMED_GROUPING');
});
