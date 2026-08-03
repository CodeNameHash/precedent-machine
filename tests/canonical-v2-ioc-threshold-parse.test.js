'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IOC_THRESHOLD_PARSE_VERSION,
  parseThresholdAmount,
} = require('../lib/canonical-v2/native-producer/ioc-threshold-parse');

test('IOC threshold parser is versioned', () => {
  assert.equal(IOC_THRESHOLD_PARSE_VERSION, 1);
});

test('single aggregate dollar threshold resolves and ignores bare numerals', () => {
  assert.deepEqual(
    parseThresholdAmount('Section 5.1 permits fifteen percent (15%) but not in excess of $150,000,000 in the aggregate;'),
    {
      outcome: 'RESOLVED',
      canonical_value: '150000000',
      matched_text: '150,000,000',
      corroboration_text: 'Section 5.1 permits fifteen percent (15%) but not in excess of $150,000,000 in the aggregate;',
      currency: 'USD',
    },
  );
});

test('trailing punctuation is not part of the money token', () => {
  assert.equal(
    parseThresholdAmount('in excess of $10,000,000, in the aggregate;').canonical_value,
    '10000000',
  );
  assert.equal(
    parseThresholdAmount('does not exceed $300,000,000;').canonical_value,
    '300000000',
  );
});

test('decimal value is preserved without arithmetic', () => {
  assert.equal(parseThresholdAmount('$0.55 per share').canonical_value, '0.55');
});

test('compound baskets and step-ups abstain', () => {
  assert.deepEqual(
    parseThresholdAmount('$250,000 individually or $1,000,000 in the aggregate'),
    { outcome: 'ABSTAIN', reason: 'MULTIPLE_MONEY_LITERALS' },
  );
  assert.deepEqual(
    parseThresholdAmount('$0.55 per share, increased to $0.5775'),
    { outcome: 'ABSTAIN', reason: 'MULTIPLE_MONEY_LITERALS' },
  );
});

test('every non-resolving money class is typed', () => {
  assert.deepEqual(parseThresholdAmount('no dollar basket'), { outcome: 'ABSTAIN', reason: 'NO_MONEY_LITERAL' });
  assert.deepEqual(parseThresholdAmount('ten million dollars'), { outcome: 'ABSTAIN', reason: 'NON_LITERAL_MONEY' });
  assert.deepEqual(parseThresholdAmount('€500,000'), {
    outcome: 'ABSTAIN', reason: 'NON_USD_CURRENCY', matched_text: '€500,000',
  });
  assert.deepEqual(parseThresholdAmount('$1,23,456'), {
    outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING', matched_text: '1,23,456',
  });
});

test('invalid calls fail, prose does not', () => {
  assert.throws(() => parseThresholdAmount(''), TypeError);
  assert.throws(() => parseThresholdAmount(), TypeError);
  assert.doesNotThrow(() => parseThresholdAmount('ordinary course of business'));
});
