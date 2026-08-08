'use strict';

/**
 * tests/canonical-v2-cure-period-parse.test.js
 *
 * Acceptance test 2 (docs/superpowers/specs/2026-08-02-family-termination-
 * rights-design.md, section 6): fixture integrity and the cure-period
 * parser, table-driven over the corpus quotes quoted in spec section 6.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CURE_PERIOD_PARSE_VERSION,
  parseCurePeriod,
} = require('../lib/canonical-v2/native-producer/cure-period-parse');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'termination-rights-family');
const CURE_FIXTURE = fs.readFileSync(path.join(FIXTURE_DIR, 'cure-period.txt'), 'utf8');

test('CURE_PERIOD_PARSE_VERSION is an exported, versioned constant', () => {
  assert.equal(CURE_PERIOD_PARSE_VERSION, 1);
});

const THIRTY_DAY_CURE_QUOTE = 'which is not cured within the earlier of (1) the Outside Date and (2) 30 days '
  + 'following written notice to Parent';
const THIRTY_DAY_CURE_QUOTE_2 = 'such breach shall not have been cured within 30 days after written notice thereof';
const FORTY_FIVE_DAY_NOTICE_QUOTE = 'Parent has delivered to the Company written notice of such breach, delivered '
  + 'at least 45 days prior to such termination (or such shorter period of time remaining prior to the Outside Date).';

for (const quote of [THIRTY_DAY_CURE_QUOTE, THIRTY_DAY_CURE_QUOTE_2, FORTY_FIVE_DAY_NOTICE_QUOTE]) {
  test(`fixture integrity: quote is a contiguous substring of the committed cure-period fixture: ${quote.slice(0, 40)}...`, () => {
    assert.ok(CURE_FIXTURE.includes(quote));
  });
}

test('"30 days following written notice" (earlier-of form) -> "30", comparative untouched', () => {
  const result = parseCurePeriod(THIRTY_DAY_CURE_QUOTE);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '30');
  assert.ok(result.matched_text.includes('earlier of'));
});

test('"not cured within 30 days" -> "30"', () => {
  const result = parseCurePeriod(THIRTY_DAY_CURE_QUOTE_2);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '30');
});

test('"45 days prior to such termination" (notice-delivery form) -> "45"', () => {
  const result = parseCurePeriod(FORTY_FIVE_DAY_NOTICE_QUOTE);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '45');
});

test('hybrid "thirty (30) days" -> "30"', () => {
  const result = parseCurePeriod('shall not have been cured within thirty (30) days after written notice thereof');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '30');
});

test('hybrid mismatch "thirty (45) days" ABSTAINs SPELLED_DIGIT_MISMATCH', () => {
  const result = parseCurePeriod('shall not have been cured within thirty (45) days after written notice thereof');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'SPELLED_DIGIT_MISMATCH');
});

// PLAN.md Step 3B: "forty-five (45) days" was refused as SPELLED_DIGIT_
// MISMATCH -- the preceding-word scan stopped at the hyphen and read back
// only "five" out of "forty-five", comparing 45 against 5. This is the
// Modiv 7.1(d)(i) CURE_PERIOD quote verbatim.
test('hyphenated hybrid "forty-five (45) days" -> "45", no SPELLED_DIGIT_MISMATCH', () => {
  const result = parseCurePeriod(
    'is not cured or cannot be cured prior to the earlier of (x) forty-five (45) days following notice '
    + 'to the Company from Parent of such breach or failure and (y) the Outside Date',
  );
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '45');
  assert.notEqual(result.reason, 'SPELLED_DIGIT_MISMATCH');
});

test('hyphenated hybrid mismatch "forty-five (46) days" ABSTAINs SPELLED_DIGIT_MISMATCH', () => {
  const result = parseCurePeriod('shall not have been cured within forty-five (46) days after written notice thereof');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'SPELLED_DIGIT_MISMATCH');
});

test('hyphenated compound with no adjacent digit, "twenty-one days", ABSTAINs NON_LITERAL_NUMERAL', () => {
  const result = parseCurePeriod('shall not have been cured within twenty-one days after written notice thereof');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NON_LITERAL_NUMERAL');
});

test('hyphenated hybrid at the other end of the range, "ninety-nine (99) days" -> "99"', () => {
  const result = parseCurePeriod('shall not have been cured within ninety-nine (99) days after written notice thereof');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '99');
});

test('spelled-only "thirty days" (no adjacent digit) ABSTAINs NON_LITERAL_NUMERAL', () => {
  const result = parseCurePeriod('shall not have been cured within thirty days after written notice thereof');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NON_LITERAL_NUMERAL');
});

test('two counts in one quote ABSTAIN MULTIPLE_DAY_COUNTS -- the parser never picks', () => {
  const result = parseCurePeriod('not cured within 30 days, or, if later, within 45 days following written notice');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'MULTIPLE_DAY_COUNTS');
});

test('zero day counts ABSTAINs NO_DAY_COUNT', () => {
  const result = parseCurePeriod('such breach has not been cured prior to the Closing');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NO_DAY_COUNT');
});

test('singular "1 Business Day" resolves (audit m-5)', () => {
  const result = parseCurePeriod('not cured within 1 Business Day following written notice');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '1');
});

test('bare capitalized "Days" resolves (audit m-5)', () => {
  const result = parseCurePeriod('not cured within 30 Days following written notice');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '30');
});

test('lower-case "business days" resolves', () => {
  const result = parseCurePeriod('not cured within 5 business days following written notice');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '5');
});

test('a section reference is never mistaken for a day count', () => {
  const result = parseCurePeriod('as set forth in Section 8.2(a), such breach must be cured');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'NO_DAY_COUNT');
});

test('parseCurePeriod never computes across the earlier-of structure -- the comparative is preserved verbatim in matched_text', () => {
  const result = parseCurePeriod(THIRTY_DAY_CURE_QUOTE);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.matched_text, THIRTY_DAY_CURE_QUOTE);
});

test('parseCurePeriod throws on a missing/empty quote (malformed call, not prose)', () => {
  assert.throws(() => parseCurePeriod(''), TypeError);
  assert.throws(() => parseCurePeriod(undefined), TypeError);
});
