const test = require('node:test');
const assert = require('node:assert/strict');
const { scalarDelta, structuredDelta } = require('../../lib/query/delta');
const { numericStats, scoreValue } = require('../../lib/query/market-baseline');

test('numeric delta boundary classifies just below and above 5%', () => {
  assert.equal(scalarDelta('fee', 100, 105, 'number').severity, 'NONE');
  assert.equal(scalarDelta('fee', 100, 106, 'number').severity, 'MINOR');
});

test('enum and boolean changes are major deltas', () => {
  assert.equal(scalarDelta('standard', 'A', 'B', 'enum').severity, 'MAJOR');
  assert.equal(scalarDelta('goShop', true, false, 'boolean').severity, 'MAJOR');
});

test('structured child row count deltas are major', () => {
  assert.equal(structuredDelta([{ id: 1 }], [{ id: 1 }, { id: 2 }]).severity, 'MAJOR');
});

test('whitespace-only string changes are trivial', () => {
  assert.equal(scalarDelta('term', 'Material Adverse Effect', 'Material   Adverse Effect', 'string').severity, 'TRIVIAL');
});

test('baseline scoring covers market, off-market, unusual, missing and not applicable', () => {
  const stats = numericStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(scoreValue(5, stats, 'numeric', 10, 10), 'MARKET');
  assert.equal(scoreValue(2, stats, 'numeric', 10, 10), 'OFF_MARKET');
  assert.equal(scoreValue(99, stats, 'numeric', 10, 10), 'UNUSUAL');
  assert.equal(scoreValue(null, stats, 'numeric', 9, 10), 'MISSING');
  assert.equal(scoreValue(null, stats, 'numeric', 1, 10), 'NOT_APPLICABLE');
});
