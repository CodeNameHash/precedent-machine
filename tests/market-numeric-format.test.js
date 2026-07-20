// r19 (WP-A, "numeric market cells"): unit-aware formatting for the unified
// market column's numeric cells and the "Off-market terms" section's
// numeric baseline ranges. Lives in components/review-v2/
// marketNumericFormat.js -- a plain JS module with no React/fetch imports
// (mirrors compareRowUnion.js/marketOffMarket.js's "no React, no fetches"
// rule) specifically so this formatting has real test coverage.
// MarketColumn.jsx/CompareColumn.jsx use real JSX and can't be dynamically
// imported here (see tests/mae-section-item-quote.test.js's header comment
// for why) -- they import from this module rather than reimplementing.
const test = require('node:test');
const assert = require('node:assert/strict');

let mod;
test.before(async () => {
  mod = await import('../components/review-v2/marketNumericFormat.js');
});

test('formatNumericValueForUnit: usd formats via formatMoney ($ short form)', () => {
  assert.equal(mod.formatNumericValueForUnit(45_000_000, 'usd'), '$45M');
  assert.equal(mod.formatNumericValueForUnit(1_200_000_000, 'usd'), '$1.2B');
});

test('formatNumericValueForUnit: days/business_days/months/percent get their unit suffix', () => {
  assert.equal(mod.formatNumericValueForUnit(10, 'days'), '10 days');
  assert.equal(mod.formatNumericValueForUnit(5, 'business_days'), '5 days');
  assert.equal(mod.formatNumericValueForUnit(6, 'months'), '6 months');
  assert.equal(mod.formatNumericValueForUnit(3.1, 'percent'), '3.1%');
});

test('formatNumericValueForUnit: no/unrecognized unit -> bare rounded number, never a guessed unit', () => {
  assert.equal(mod.formatNumericValueForUnit(7, null), '7');
  assert.equal(mod.formatNumericValueForUnit(7, undefined), '7');
});

test('formatNumericValueForUnit: null/NaN input -> null, never a fabricated value', () => {
  assert.equal(mod.formatNumericValueForUnit(null, 'usd'), null);
  assert.equal(mod.formatNumericValueForUnit(undefined, 'days'), null);
  assert.equal(mod.formatNumericValueForUnit(NaN, 'usd'), null);
});

test('formatNumericMarketSummary: money attribute headline is median + "of deal value" suffix when percentOfDeal exists', () => {
  const summary = {
    kind: 'numeric', unit: 'usd', min: 10_000_000, median: 45_000_000, max: 90_000_000,
    percentOfDeal: { median: 3.1 },
  };
  const cell = mod.formatNumericMarketSummary(summary);
  assert.equal(cell.headline, '$45M · 3.1% of deal value');
  assert.equal(cell.range, '$10M–$90M');
});

test('formatNumericMarketSummary: money attribute with no percentOfDeal omits the suffix', () => {
  const summary = { kind: 'numeric', unit: 'usd', min: 10_000_000, median: 45_000_000, max: 90_000_000, percentOfDeal: null };
  const cell = mod.formatNumericMarketSummary(summary);
  assert.equal(cell.headline, '$45M');
});

test('formatNumericMarketSummary: deal-relative period field renders "N months before signing"', () => {
  const summary = { kind: 'numeric', unit: 'months before signing', basis: 'months-before-signing', min: 2, median: 6, max: 18, percentOfDeal: null };
  const cell = mod.formatNumericMarketSummary(summary);
  assert.equal(cell.headline, '6 months before signing');
  assert.equal(cell.range, '2 mo–18 mo');
});

test('formatNumericMarketSummary: plain duration/percent fields format with their unit, no percent-of-deal suffix', () => {
  const days = mod.formatNumericMarketSummary({ kind: 'numeric', unit: 'days', min: 5, median: 15, max: 30, percentOfDeal: null });
  assert.equal(days.headline, '15 days');
  assert.equal(days.range, '5 days–30 days');
});

test('formatNumericMarketSummary: no median (empty numeric pool) -> null, callers fall back to "No market data"', () => {
  assert.equal(mod.formatNumericMarketSummary({ kind: 'numeric', unit: 'usd', median: null }), null);
  assert.equal(mod.formatNumericMarketSummary({ kind: 'categorical', values: [] }), null, 'wrong kind -> null');
  assert.equal(mod.formatNumericMarketSummary(null), null);
});
