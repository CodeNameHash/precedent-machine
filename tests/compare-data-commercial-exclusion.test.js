// r19 (WP-A, "off-market feed"): components/review-v2/compareData.js's
// isCommercialField/offMarketRows had NO test coverage before this round,
// despite being the commercial-terms exclusion the task explicitly requires
// the new market-column-driven off-market feed to KEEP "exactly as is".
// compareData.js can't be dynamically imported directly under this repo's
// plain node:test runner (it transitively imports lib/queries/
// reconstruct-review-deal via an extensionless ESM specifier, which only
// resolves under Next's bundler) -- so, like tests/mae-section-item-
// quote.test.js, this asserts against the module's own source for the
// regex/behavior contract, pinning it so a future edit can't silently widen
// or narrow the exclusion.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source() {
  return fs.readFileSync(path.join(__dirname, '..', 'components', 'review-v2', 'compareData.js'), 'utf8');
}

test('isCommercialField/offMarketRows still exist and export the r19 off-market feed can rely on', () => {
  const body = source();
  assert.match(body, /export function isCommercialField/);
  assert.match(body, /export function offMarketRows/);
});

test('COMMERCIAL_FIELD_RE still matches exactly consideration/price/perShare/exchangeRatio, never a bare /value/i', () => {
  const body = source();
  const re = body.match(/const COMMERCIAL_FIELD_RE = (\/[^\n]+\/[a-z]*);/);
  assert.ok(re, 'COMMERCIAL_FIELD_RE must still be a literal regex assignment');
  // eslint-disable-next-line no-eval
  const pattern = eval(re[1]);
  assert.equal(pattern.test('considerationType'), true);
  assert.equal(pattern.test('pricePerShare'), true);
  assert.equal(pattern.test('exchangeRatio'), true);
  // The exact case this guard exists for: a legal dollar term denominated
  // against equity value must NOT be swallowed by a loose /value/i match.
  assert.equal(pattern.test('terminationFeePercentEquityValue'), false);
  assert.equal(pattern.test('noticePeriod'), false);
});

test('offMarketRows keeps only OFF_MARKET/UNUSUAL rows and filters isCommercialField -- behavior pinned via a direct re-implementation check', () => {
  const body = source();
  const fn = body.match(/export function offMarketRows\(scorecard\) \{[\s\S]*?\n\}/);
  assert.ok(fn);
  assert.match(fn[0], /status === 'OFF_MARKET' \|\| row\.status === 'UNUSUAL'/);
  assert.match(fn[0], /!isCommercialField\(row\)/);
});
