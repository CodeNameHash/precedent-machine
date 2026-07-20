// r19 (WP-A, "off-market feed"): pure decision logic behind the unified
// market column's per-row off-market marker and the aggregator that feeds
// those rows into the "Off-market terms" section. Lives in
// components/review-v2/marketOffMarket.js -- a plain JS module with no
// React/fetch imports (mirrors compareRowUnion.js's own "no React, no
// fetches" rule) specifically so this logic is directly testable under
// this repo's plain node:test runner. CompareColumn.jsx/MarketColumn.jsx
// use real JSX and can't be dynamically imported here (see
// tests/mae-section-item-quote.test.js's header comment for why) -- they
// call into this module rather than reimplementing the rule.
const test = require('node:test');
const assert = require('node:assert/strict');

let mod;
test.before(async () => {
  mod = await import('../components/review-v2/marketOffMarket.js');
});

// -- marketSummaryForRow ----------------------------------------------------

test('marketSummaryForRow resolves via row.featureKeys against the section featureSummary, null when nothing matches', () => {
  const marketColumn = { stats: { featureSummary: [{ attribute: 'noticePeriod', kind: 'numeric', p25: 5, p75: 15 }] } };
  assert.equal(mod.marketSummaryForRow({ featureKeys: ['noticePeriod'] }, marketColumn).attribute, 'noticePeriod');
  assert.equal(mod.marketSummaryForRow({ featureKeys: ['somethingElse'] }, marketColumn), null);
  assert.equal(mod.marketSummaryForRow({}, marketColumn), null, 'no featureKeys at all -> null, never a guess');
  assert.equal(mod.marketSummaryForRow({ featureKeys: ['noticePeriod'] }, null), null);
  assert.equal(mod.marketSummaryForRow({ featureKeys: ['noticePeriod'] }, { stats: null }), null);
});

// -- isCategoricalOffMarket ---------------------------------------------------

test('isCategoricalOffMarket flags a coded row whose own value differs from the market mode', () => {
  const summary = { kind: 'categorical', values: [{ value: 'MAT_MAE_AGGREGATE', label: 'MAE (aggregate)', count: 20 }] };
  assert.equal(mod.isCategoricalOffMarket('All material respects', summary), true);
  assert.equal(mod.isCategoricalOffMarket('MAE (aggregate)', summary), false, 'matches the mode -> not off-market');
  assert.equal(mod.isCategoricalOffMarket('mae  (aggregate)', summary), false, 'case/whitespace-insensitive match');
});

test('isCategoricalOffMarket never flags without a captured own value or a numeric-kind summary', () => {
  const summary = { kind: 'categorical', values: [{ value: 'X', label: 'X label', count: 1 }] };
  assert.equal(mod.isCategoricalOffMarket(null, summary), false);
  assert.equal(mod.isCategoricalOffMarket('', summary), false);
  assert.equal(mod.isCategoricalOffMarket('Y', { kind: 'numeric', values: [] }), false, 'wrong kind -> never flags');
  assert.equal(mod.isCategoricalOffMarket('Y', { kind: 'categorical', values: [] }), false, 'no market values -> never flags');
  assert.equal(mod.isCategoricalOffMarket('Y', null), false);
});

// -- isNumericOffMarket -------------------------------------------------------

test('isNumericOffMarket flags a numeric row outside the p25-p75 band, not inside it', () => {
  const summary = { kind: 'numeric', p25: 20_000_000, p75: 60_000_000 };
  assert.equal(mod.isNumericOffMarket(10_000_000, summary), true, 'below p25');
  assert.equal(mod.isNumericOffMarket(80_000_000, summary), true, 'above p75');
  assert.equal(mod.isNumericOffMarket(40_000_000, summary), false, 'inside the band');
  assert.equal(mod.isNumericOffMarket(20_000_000, summary), false, 'exactly at p25 is still market');
  assert.equal(mod.isNumericOffMarket(60_000_000, summary), false, 'exactly at p75 is still market');
});

test('isNumericOffMarket never flags without a resolvable own value, a numeric-kind summary, or both band edges', () => {
  const summary = { kind: 'numeric', p25: 20, p75: 60 };
  assert.equal(mod.isNumericOffMarket(null, summary), false);
  assert.equal(mod.isNumericOffMarket(NaN, summary), false);
  assert.equal(mod.isNumericOffMarket(10, { kind: 'categorical' }), false);
  assert.equal(mod.isNumericOffMarket(10, { kind: 'numeric', p25: null, p75: 60 }), false);
  assert.equal(mod.isNumericOffMarket(10, null), false);
});

// -- isRowOffMarket (the single entry point CompareColumn.jsx/pages/review/
// [id].js actually call) ------------------------------------------------

test('isRowOffMarket dispatches numeric vs categorical by summary.kind', () => {
  const numericSummary = { kind: 'numeric', p25: 20, p75: 60 };
  const categoricalSummary = { kind: 'categorical', values: [{ value: 'A', label: 'A label', count: 1 }] };
  assert.equal(mod.isRowOffMarket({ summary: numericSummary, ownNum: 100 }), true);
  assert.equal(mod.isRowOffMarket({ summary: numericSummary, ownNum: 40 }), false);
  assert.equal(mod.isRowOffMarket({ summary: categoricalSummary, ownText: 'B label' }), true);
  assert.equal(mod.isRowOffMarket({ summary: categoricalSummary, ownText: 'A label' }), false);
  assert.equal(mod.isRowOffMarket({ summary: null, ownText: 'anything' }), false);
});
