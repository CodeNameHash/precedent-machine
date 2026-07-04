/* Audit-2 item 2: [object Object] on provision cards. The FLAGS line
   (components/review/shared.js's renderListAsBullets, consumed by
   pages/review/[id]/provision/[provisionId].js's FeatureGrid) stringified
   flag objects — { concern, text } entries produced by the parser's
   novelty/off-market escape valve — because they matched neither the tagged-
   item nor citable-wrapper shape and fell through to String(obj).
   lib/flag-item.js is the dependency-free discriminator that fixes this;
   see components/review/shared.js's renderListAsBullets for the render-side
   fix (pinned via source-text assertion, JSX not directly importable). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'lib', 'flag-item.js'));
});

test('isFlagItem is true for a { concern, text } flag entry', () => {
  const { isFlagItem } = mod;
  assert.equal(isFlagItem({ concern: 'Unusual carve-out for related-party debt.', text: 'verbatim quote' }), true);
});

test('isFlagItem is true even without a text field (concern alone is the discriminator)', () => {
  const { isFlagItem } = mod;
  assert.equal(isFlagItem({ concern: 'Something off-market.' }), true);
});

test('isFlagItem is false for a tagged item ({code, label})', () => {
  const { isFlagItem } = mod;
  assert.equal(isFlagItem({ code: 'MAT_MAE_QUALIFIED', label: 'MAE' }), false);
});

test('isFlagItem is false for a citable wrapper ({value, quotes})', () => {
  const { isFlagItem } = mod;
  assert.equal(isFlagItem({ value: 'x', quotes: ['y'] }), false);
});

test('isFlagItem is false for bare scalars, arrays, null, and undefined', () => {
  const { isFlagItem } = mod;
  assert.equal(isFlagItem('plain string'), false);
  assert.equal(isFlagItem(42), false);
  assert.equal(isFlagItem(['a', 'b']), false);
  assert.equal(isFlagItem(null), false);
  assert.equal(isFlagItem(undefined), false);
});

test('isFlagItem is false when concern is present but not a string', () => {
  const { isFlagItem } = mod;
  assert.equal(isFlagItem({ concern: 123 }), false);
  assert.equal(isFlagItem({ concern: '' }), false);
});

/* ── Render-side fix, pinned via source text (shared.js is JSX, not directly
   importable under node:test — see tests/fb3-chrome.test.js's header for the
   documented convention). ── */

const SHARED_PATH = path.join(__dirname, '..', 'components', 'review', 'shared.js');
const sharedSrc = () => fs.readFileSync(SHARED_PATH, 'utf8');

test('renderListAsBullets imports isFlagItem from the dependency-free lib/flag-item module', () => {
  assert.match(sharedSrc(), /import\s*\{\s*isFlagItem\s*\}\s*from\s*['"]\.\.\/\.\.\/lib\/flag-item['"]/);
});

test('renderListAsBullets renders a flag item\'s concern as the body and text as the hover quote, never String(obj)', () => {
  const src = sharedSrc();
  const isFlagIdx = src.indexOf('isFlagItem(innerRaw)');
  assert.ok(isFlagIdx > -1, 'renderListAsBullets must branch on isFlagItem before the generic else');
  const branch = src.slice(isFlagIdx, isFlagIdx + 400);
  assert.match(branch, /innerRaw\.concern/, 'renders the concern sentence, not the raw object');
  assert.match(branch, /innerRaw\.text/, 'the verbatim text becomes the hover quote');
  // The isFlagItem branch must come BEFORE the generic String(innerRaw) fallback.
  const genericIdx = src.indexOf('String(innerRaw)');
  assert.ok(genericIdx > isFlagIdx, 'isFlagItem branch must be checked before falling through to String(innerRaw)');
});
