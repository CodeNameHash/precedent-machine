'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FINANCING_DAY_COUNT_PARSE_VERSION,
  parseFinancingDayCount,
} = require('../lib/canonical-v2/native-producer/financing-day-count-parse');

test('financing parser is versioned and resolves literal and hybrid business-day counts', () => {
  assert.equal(FINANCING_DAY_COUNT_PARSE_VERSION, 1);
  assert.deepEqual(parseFinancingDayCount('no later than two (2) Business Days prior to Closing'), {
    outcome: 'RESOLVED',
    canonical_value: '2',
    matched_text: 'no later than two (2) Business Days prior to Closing',
  });
  assert.equal(
    parseFinancingDayCount('the first period of fifteen (15) consecutive business days').canonical_value,
    '15',
  );
  assert.equal(parseFinancingDayCount('at least 3 Business Days before Closing').canonical_value, '3');
});

test('the matched window is the nearest parenthetical or containing sentence', () => {
  assert.equal(
    parseFinancingDayCount('Drafts (including copies at least 3 Business Days before Closing) shall be delivered.').matched_text,
    '(including copies at least 3 Business Days before Closing)',
  );
  assert.equal(
    parseFinancingDayCount('First sentence. Drafts are due 10 Business Days before Closing. Third sentence.').matched_text,
    'Drafts are due 10 Business Days before Closing.',
  );
});

test('financing parser abstains on ambiguity, contradiction, and non-literal values', () => {
  assert.equal(parseFinancingDayCount('2 Business Days and 10 Business Days').reason, 'MULTIPLE_DAY_COUNTS');
  assert.equal(parseFinancingDayCount('fifteen (45) days').reason, 'SPELLED_DIGIT_MISMATCH');
  assert.equal(parseFinancingDayCount('one Business Day').reason, 'NON_LITERAL_NUMERAL');
  assert.equal(parseFinancingDayCount('no day count').reason, 'NO_DAY_COUNT');
});

test('dates, section references, money, percentages, and clock times are not day counts', () => {
  const quote = 'Section 6.13, November 26, 2025, 3:00 p.m., $10 and 15% contain no governed day count.';
  assert.deepEqual(parseFinancingDayCount(quote), { outcome: 'ABSTAIN', reason: 'NO_DAY_COUNT' });
});

test('malformed calls fail while ordinary prose abstains', () => {
  assert.throws(() => parseFinancingDayCount(''), TypeError);
  assert.throws(() => parseFinancingDayCount(null), TypeError);
});
