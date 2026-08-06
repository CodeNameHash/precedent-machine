// Item 10 (round 3): MaeSection.jsx's itemQuote() used to read ONLY
// item.quotes[0] and ignore item.text entirely -- MAE carve-out items'
// quotes array is almost always EMPTY, so this always returned null and
// both call sites (the carve-out name cell + the disproportionate-carveback
// pill) fell straight to row.evidence, the full MAE definition clause. The
// popover then opened on the START of the whole definition instead of the
// carve-out's own text -- exactly the bug Ben reported.
//
// MaeSection.jsx uses real JSX syntax (not React.createElement), so it
// can't be dynamically imported under plain node:test (no JSX loader
// configured for this repo's test runner -- see
// tests/review/provision-table-primitives.spec.js for the same pattern).
// This asserts against the module's SOURCE, matching that convention.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function source() {
  return fs.readFileSync(path.join(__dirname, '..', 'components', 'review-v2', 'MaeSection.jsx'), 'utf8');
}

test('itemQuote() prefers item.quotes[0], then a non-echo item.text, before any row.evidence fallback', () => {
  const body = source();
  const fn = body.match(/function itemQuote\(item\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'itemQuote() must still exist');
  assert.match(fn[0], /item\.quotes\[0\]/, 'quotes[0] stays the first-choice source');
  assert.match(fn[0], /nonEchoText\(item\)/, 'falls through to the item\'s own text (non-echo) when quotes is empty');
  assert.doesNotMatch(fn[0], /return null;\s*\n\}/, 'must not short-circuit to null when quotes is empty -- that was the bug');
});

test('nonEchoText() never returns text that is just the code or label echoed back', () => {
  const body = source();
  const fn = body.match(/function nonEchoText\(item\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'nonEchoText() helper must exist');
  assert.match(fn[0], /item\.code/);
  assert.match(fn[0], /item\.label/);
});

test('the carve-out name uses its own quote and a positive carveback pill uses the disproportionality quote', () => {
  const body = source();
  const evidenceUses = body.match(/evidence=\{itemQuote\(item\) \|\| row\.evidence\}/g) || [];
  assert.equal(evidenceUses.length, 1, 'the carve-out name must prefer its own exact evidence');
  assert.match(body, /evidence=\{carveback === true \? carvebackEvidence/);
  assert.match(body, /item\?\.disproportionality_quotes/);
});
