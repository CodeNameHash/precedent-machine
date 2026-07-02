/* Tests for lib/search.js — cross-deal search helpers. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  expandFavorability,
  canonicalFavorability,
  typeFamilyOrConditions,
  parseSearchParams,
  buildSnippet,
} = require('../lib/search');

test('favorability synonyms expand and collapse consistently', () => {
  for (const [stored, bucket] of [
    ['buyer_friendly', 'buyer-favorable'],
    ['pro-buyer', 'buyer-favorable'],
    ['pro-seller', 'seller-favorable'],
    ['target-favorable', 'seller-favorable'],
    ['company-favorable', 'seller-favorable'],
    ['buyer-unfavorable', 'seller-favorable'],
    ['neutral', 'neutral'],
  ]) {
    assert.equal(canonicalFavorability(stored), bucket, stored);
    assert.ok(expandFavorability(bucket).includes(stored) || stored === 'neutral');
  }
});

test('unknown favorability passes through (never dropped)', () => {
  assert.equal(canonicalFavorability('mystery-value'), 'mystery-value');
  assert.deepEqual(expandFavorability('mystery-value'), ['mystery-value']);
});

test('bare family type expands to its party variants; variant stays exact', () => {
  assert.deepEqual(typeFamilyOrConditions(['TERMR']), ['type.eq.TERMR', 'type.like.TERMR-*']);
  assert.deepEqual(typeFamilyOrConditions(['COND-M']), ['type.eq.COND-M']);
});

test('parseSearchParams normalizes lists, clamps limit, defaults offset', () => {
  const p = parseSearchParams({ type: 'TERMR, COND-M', q: ' fee ', limit: '9999', feature: 'carveouts' });
  assert.deepEqual(p.types, ['TERMR', 'COND-M']);
  assert.equal(p.q, 'fee');
  assert.equal(p.limit, 200); // MAX_LIMIT clamp
  assert.equal(p.offset, 0);
  assert.equal(p.featureKey, 'carveouts');
});

test('buildSnippet centers the window on the first match', () => {
  const text = `${'x '.repeat(200)}the tail period is twelve months${' y'.repeat(200)}`;
  const snip = buildSnippet(text, 'tail period');
  assert.ok(snip.includes('tail period'));
  assert.ok(snip.startsWith('…') && snip.endsWith('…'));
});
