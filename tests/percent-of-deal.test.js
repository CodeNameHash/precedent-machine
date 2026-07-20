const test = require('node:test');
const assert = require('node:assert/strict');

const { percentOfDealValue, formatPercentOfDeal, formatPercentValue } = require('../lib/percent-of-deal');

test('percentOfDealValue computes a plain percentage', () => {
  assert.equal(percentOfDealValue(30000000, 1000000000), 3);
  assert.equal(percentOfDealValue(100000000, 500000000), 20);
});

test('percentOfDealValue is null-safe and never divides by zero', () => {
  assert.equal(percentOfDealValue(null, 1000000000), null);
  assert.equal(percentOfDealValue(undefined, 1000000000), null);
  assert.equal(percentOfDealValue(30000000, null), null);
  assert.equal(percentOfDealValue(30000000, undefined), null);
  assert.equal(percentOfDealValue(30000000, 0), null);
  assert.equal(percentOfDealValue(0, 1000000000), null); // amount must be positive
  assert.equal(percentOfDealValue(-30000000, 1000000000), null);
  assert.equal(percentOfDealValue(30000000, -1000000000), null);
  assert.equal(percentOfDealValue(NaN, 1000000000), null);
  assert.equal(percentOfDealValue(30000000, Infinity), null);
  assert.equal(percentOfDealValue('30000000', 1000000000), null); // never guesses at strings
});

test('formatPercentOfDeal renders one decimal at/above 1%', () => {
  assert.equal(formatPercentOfDeal(30000000, 1000000000), '3.0% of deal value');
  assert.equal(formatPercentOfDeal(100000000, 500000000), '20.0% of deal value');
  assert.equal(formatPercentOfDeal(31000000, 1000000000), '3.1% of deal value');
});

test('formatPercentOfDeal renders two decimals below 1%', () => {
  assert.equal(formatPercentOfDeal(4200000, 1000000000), '0.42% of deal value');
  assert.equal(formatPercentOfDeal(999000, 1000000000), '0.10% of deal value');
});

test('formatPercentOfDeal is null when not computable', () => {
  assert.equal(formatPercentOfDeal(null, 1000000000), null);
  assert.equal(formatPercentOfDeal(30000000, null), null);
  assert.equal(formatPercentOfDeal(30000000, 0), null);
});

// r13 item 1: formatPercentValue is the raw-percent-number formatter the
// market-range executor's percentStats/deal_points[i].percent consumers use
// (they already have a computed percent, not an amount/deal-value pair) —
// same one-decimal / two-below-1% rounding rule formatPercentOfDeal uses,
// asserted independently so the two can never silently drift.
test('formatPercentValue renders one decimal at/above 1%, two below', () => {
  assert.equal(formatPercentValue(3), '3.0%');
  assert.equal(formatPercentValue(3.14), '3.1%');
  assert.equal(formatPercentValue(20), '20.0%');
  assert.equal(formatPercentValue(0.42), '0.42%');
  assert.equal(formatPercentValue(0.1), '0.10%');
});

test('formatPercentValue is null-safe', () => {
  assert.equal(formatPercentValue(null), null);
  assert.equal(formatPercentValue(undefined), null);
  assert.equal(formatPercentValue(NaN), null);
  assert.equal(formatPercentValue('3'), null);
});
