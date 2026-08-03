'use strict';

/**
 * tests/canonical-v2-no-shop-parse.test.js
 *
 * Acceptance test 2 (docs/superpowers/specs/2026-08-02-family-no-shop-
 * design.md, section 6, AUDIT-AMENDED): the table-driven parser tests over
 * the coverage map in tests/fixtures/canonical-v2/no-shop/quotes.json --
 * every quote copied verbatim from the spec itself (this build is fully
 * offline; no production DB bytes beyond what the spec already quotes were
 * available -- see the fixture file's own header note).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  NO_SHOP_PERIOD_PARSE_VERSION,
  parseNoShopPeriod,
} = require('../lib/canonical-v2/native-producer/no-shop-period-parse');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'no-shop', 'quotes.json');
const FIXTURES = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

function quoteById(id) {
  const entry = FIXTURES.quotes.find((q) => q.id === id);
  assert.ok(entry, `expected a fixture quote with id ${id}`);
  return entry;
}

test('NO_SHOP_PERIOD_PARSE_VERSION is an exported, versioned constant', () => {
  assert.equal(NO_SHOP_PERIOD_PARSE_VERSION, 2);
});

test('fixture integrity: the fixture file parses and every entry carries a retrieval date and a quote', () => {
  assert.equal(FIXTURES.schema_version, 'NO_SHOP_FIXTURE_QUOTES/V1');
  assert.ok(FIXTURES.quotes.length > 0);
  for (const entry of FIXTURES.quotes) {
    assert.ok(entry.retrieved, `${entry.id} missing retrieval date`);
    assert.ok(entry.quote, `${entry.id} missing quote text`);
  }
});

// ---------------------------------------------------------------------------
// Exclusion classes (spec section 2, real spec-quoted bytes).
// ---------------------------------------------------------------------------

test('SEC rule citation list ("Rule 14d-9, Rule 14e-2(a) or Item 1012(a) of Regulation M-A") ABSTAINs NO_NUMERIC_LITERAL -- every citation digit run excluded, including the no-interior-letter "Item 1012(a)" (audit M-4)', () => {
  const q = quoteById('sec-rule-citation-list');
  assert.ok(q.quote.includes('Rule 14d-9, Rule 14e-2(a) or Item 1012(a) of Regulation M-A'));
  assert.deepEqual(parseNoShopPeriod(q.quote), { outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL' });
});

test('"Section 5.3(d)(ii)(2)" alone excludes as a section reference', () => {
  assert.deepEqual(parseNoShopPeriod('as provided in Section 5.3(d)(ii)(2) hereof'), {
    outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL',
  });
});

test('percentages ("20% or more", "15% or more") never contaminate the period-literal count', () => {
  assert.deepEqual(parseNoShopPeriod('an Acquisition Proposal involving 20% or more of the outstanding shares'), {
    outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL',
  });
  assert.deepEqual(parseNoShopPeriod('15% or more of the consolidated assets'), {
    outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL',
  });
});

test('calendar dates and currency literals never contaminate the period-literal count', () => {
  assert.deepEqual(
    parseNoShopPeriod('as of January 1, 2026 the Company shall pay $326,000,000 pursuant to this Section'),
    { outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL' },
  );
});

// ---------------------------------------------------------------------------
// RESOLVED cases -- real spec-quoted bytes.
// ---------------------------------------------------------------------------

test('production NOSOL-MATCH card ("four (4) business days in advance (the \'Notice Period\')") resolves 4 / BUSINESS_DAYS despite the "Notice Period" defined-term label (spec section 4 central mislabel)', () => {
  const q = quoteById('period-business-days-parenthesised');
  const result = parseNoShopPeriod(q.quote);
  assert.deepEqual(result, {
    outcome: 'RESOLVED', canonical_value: '4', day_kind: 'BUSINESS_DAYS', unit_phrase: 'business days', matched_text: '4',
  });
});

test('trailing possessive "5 Business Days\'" resolves 5 / BUSINESS_DAYS', () => {
  const q = quoteById('period-business-days-trailing-possessive');
  const result = parseNoShopPeriod(q.quote);
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '5');
  assert.equal(result.day_kind, 'BUSINESS_DAYS');
  assert.equal(result.unit_phrase, 'Business Days');
});

test('"ten (10) business days" resolves 10 / BUSINESS_DAYS', () => {
  const q = quoteById('period-ten-business-days');
  const result = parseNoShopPeriod(q.quote);
  assert.equal(result.canonical_value, '10');
  assert.equal(result.day_kind, 'BUSINESS_DAYS');
});

test('bare "days" form defaults to CALENDAR_DAYS while preserving the raw unit phrase', () => {
  const result = parseNoShopPeriod('the Company shall notify Parent within five (5) days of receipt');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '5');
  assert.equal(result.day_kind, 'CALENDAR_DAYS');
  assert.equal(result.unit_phrase, 'days');
});

test('"calendar days" resolves CALENDAR_DAYS, never silently read as business/unspecified', () => {
  const result = parseNoShopPeriod('within ten (10) calendar days following such notice');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '10');
  assert.equal(result.day_kind, 'CALENDAR_DAYS');
});

// ---------------------------------------------------------------------------
// Unit corroboration (spec audit C-1, section 6).
// ---------------------------------------------------------------------------

test('a "(the \'Notice Period\')" parenthetical BETWEEN the digit and the unit vetoes corroboration (audit C-1 ABSTAIN fixture)', () => {
  const q = quoteById('period-notice-period-veto');
  assert.deepEqual(parseNoShopPeriod(q.quote), { outcome: 'ABSTAIN', reason: 'PERIOD_UNIT_UNCORROBORATED' });
});

test('a digit with no adjacent unit at all ABSTAINs PERIOD_UNIT_UNCORROBORATED', () => {
  assert.deepEqual(parseNoShopPeriod('the Company shall respond within 4 of the Outside Date'), {
    outcome: 'ABSTAIN', reason: 'PERIOD_UNIT_UNCORROBORATED',
  });
});

// ---------------------------------------------------------------------------
// PERIOD_UNIT_HOURS -- the family's central legal pin (spec section 2/6).
// ---------------------------------------------------------------------------

test('production NOSOL-NOTICE card ("within 24 hours") ABSTAINs PERIOD_UNIT_HOURS, never converted to a day count', () => {
  const q = quoteById('notice-within-24-hours');
  assert.deepEqual(parseNoShopPeriod(q.quote), { outcome: 'ABSTAIN', reason: 'PERIOD_UNIT_HOURS', matched_text: '24' });
});

test('"within forty-eight (48) hours" ABSTAINs PERIOD_UNIT_HOURS', () => {
  const q = quoteById('period-forty-eight-hours');
  assert.deepEqual(parseNoShopPeriod(q.quote), { outcome: 'ABSTAIN', reason: 'PERIOD_UNIT_HOURS', matched_text: '48' });
});

test('"at least 96 hours written notice" ABSTAINs PERIOD_UNIT_HOURS', () => {
  const q = quoteById('period-96-hours');
  assert.deepEqual(parseNoShopPeriod(q.quote), { outcome: 'ABSTAIN', reason: 'PERIOD_UNIT_HOURS', matched_text: '96' });
});

// ---------------------------------------------------------------------------
// Exactly-one rule / MULTIPLE_PERIOD_LITERALS (spec section 2, production
// NOSOL-REMATCH card).
// ---------------------------------------------------------------------------

test('production NOSOL-REMATCH card ("three (3) Business Days instead of five (5) Business Days") ABSTAINs MULTIPLE_PERIOD_LITERALS as one quote; each split limb resolves on its own', () => {
  const q = quoteById('period-compound-rematch');
  assert.deepEqual(parseNoShopPeriod(q.quote), { outcome: 'ABSTAIN', reason: 'MULTIPLE_PERIOD_LITERALS' });

  assert.ok(q.quote.startsWith(q.first_split_subquote));
  const first = parseNoShopPeriod(q.first_split_subquote);
  assert.equal(first.outcome, 'RESOLVED');
  assert.equal(first.canonical_value, q.expected_first_canonical);

  assert.ok(q.quote.endsWith(q.second_split_subquote));
  const second = parseNoShopPeriod(q.second_split_subquote);
  assert.equal(second.outcome, 'RESOLVED');
  assert.equal(second.canonical_value, q.expected_second_canonical);
});

// ---------------------------------------------------------------------------
// NON_LITERAL_NUMERAL -- spelled-only periods, a real priced cost (spec
// section 2, "Known costs").
// ---------------------------------------------------------------------------

test('"at least five Business Days in advance" (spelled-only) ABSTAINs NON_LITERAL_NUMERAL', () => {
  const q = quoteById('period-spelled-only-five');
  assert.deepEqual(parseNoShopPeriod(q.quote), { outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
});

test('"the \'Notice Period\' ... will be three Business Days" (spelled-only) ABSTAINs NON_LITERAL_NUMERAL', () => {
  const q = quoteById('period-spelled-only-three');
  assert.deepEqual(parseNoShopPeriod(q.quote), { outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
});

// ---------------------------------------------------------------------------
// Grouping / non-integer (spec section 2).
// ---------------------------------------------------------------------------

test('malformed grouping ABSTAINs MALFORMED_GROUPING, no repair', () => {
  const result = parseNoShopPeriod('within 1,23 business days');
  assert.equal(result.outcome, 'ABSTAIN');
  assert.equal(result.reason, 'MALFORMED_GROUPING');
});

test('a fractional day count ("2.5 business days") ABSTAINs NON_INTEGER_PERIOD -- not a drafting form observed anywhere in the corpus, never resolved', () => {
  const result = parseNoShopPeriod('within 2.5 business days of such notice');
  assert.deepEqual(result, { outcome: 'ABSTAIN', reason: 'NON_INTEGER_PERIOD', matched_text: '2.5' });
});

// ---------------------------------------------------------------------------
// Zero survivors, no spelled fallback either.
// ---------------------------------------------------------------------------

test('NO_NUMERIC_LITERAL: no digit and no spelled-number period phrase at all', () => {
  assert.deepEqual(parseNoShopPeriod('promptly notify Parent of such event'), {
    outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL',
  });
});

test('parseNoShopPeriod throws on structurally invalid input, never on prose', () => {
  assert.throws(() => parseNoShopPeriod(''), TypeError);
  assert.throws(() => parseNoShopPeriod(undefined), TypeError);
  assert.doesNotThrow(() => parseNoShopPeriod('gibberish prose with no period phrase'));
});

// ---------------------------------------------------------------------------
// Spelled-restatement collapse (spec section 2, item 7): a drafting
// mismatch between the spelled word and its parenthesised digit is NEVER
// arithmetic-checked -- the digit always wins as the sole candidate.
// ---------------------------------------------------------------------------

test('spelled-restatement collapse: "five (3) business days" yields the DIGIT 3, never validated against the word "five"', () => {
  const result = parseNoShopPeriod('notice shall be given five (3) business days in advance');
  assert.equal(result.outcome, 'RESOLVED');
  assert.equal(result.canonical_value, '3');
  assert.equal(result.day_kind, 'BUSINESS_DAYS');
});
