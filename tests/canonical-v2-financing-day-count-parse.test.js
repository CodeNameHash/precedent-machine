'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseFinancingDayCount } = require('../lib/canonical-v2/native-producer/financing-day-count-parse');
test('financing count resolves one literal business-day count', () => assert.equal(parseFinancingDayCount('at least two (2) Business Days prior to Closing').canonical_value, '2'));
test('financing count abstains on multiple and spelled-only values', () => {
  assert.equal(parseFinancingDayCount('two (2) Business Days and ten (10) Business Days').reason, 'MULTIPLE_DAY_COUNTS');
  assert.equal(parseFinancingDayCount('one Business Day').reason, 'NON_LITERAL_NUMERAL');
});
