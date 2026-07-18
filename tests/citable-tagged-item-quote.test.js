// Item 10 (UI Feedback Round 3): the shared evidence-resolution path had
// three layers that all conspired to surface the START of the whole
// definition/clause instead of a tagged item's own per-item verbatim:
//   1. isCitableValue() requires a `value` key and NO `code` key, so tagged
//      items ({code, label, text, quotes}) were never "citable".
//   2. getCitableQuotes() returned the (empty) `quotes` array WITHOUT
//      falling through to `.text` when `quotes` normalized to an empty
//      array -- the fall-through only fired when `quotes` was ABSENT.
//   3. Callers then fell all the way to source.primary_quote/
//      region_full_text.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let citable;
test.before(async () => {
  citable = await import(path.join('..', 'lib', 'citable.js'));
});

test('getCitableQuotes falls through to .text when quotes normalizes to an EMPTY array (not just when absent)', () => {
  const value = { value: true, quotes: [], text: 'Each outstanding PSU shall be cancelled and converted into the right to receive a cash payment.' };
  assert.deepEqual(citable.getCitableQuotes(value), ['Each outstanding PSU shall be cancelled and converted into the right to receive a cash payment.']);
});

test('getCitableQuotes still prefers a non-empty quotes array over .text', () => {
  const value = { value: true, quotes: ['the real quote'], text: 'a different fallback text' };
  assert.deepEqual(citable.getCitableQuotes(value), ['the real quote']);
});

test('getCitableQuotes still returns [] when quotes is absent and there is no .text either', () => {
  assert.deepEqual(citable.getCitableQuotes({ value: true }), []);
});

test('getTaggedItemQuote prefers a non-empty quotes[0] over .text', () => {
  const item = { code: 'ENTER_ALT_AGREEMENT', label: 'Enter an alternative acquisition agreement', text: 'the label echoed back', quotes: ['(C) enter into any letter of intent, agreement in principle...'] };
  assert.equal(citable.getTaggedItemQuote(item), '(C) enter into any letter of intent, agreement in principle...');
});

test('getTaggedItemQuote falls through to .text when quotes is empty, as long as .text is not an echo of code/label', () => {
  const item = { code: 'ENTER_ALT_AGREEMENT', label: 'Enter an alternative acquisition agreement', text: '(C) enter into, or publicly propose to enter into, any letter of intent, memorandum of understanding, agreement in principle...', quotes: [] };
  assert.equal(citable.getTaggedItemQuote(item), '(C) enter into, or publicly propose to enter into, any letter of intent, memorandum of understanding, agreement in principle...');
});

test('getTaggedItemQuote returns null when .text is just the code echoed back verbatim', () => {
  const item = { code: 'ENTER_ALT_AGREEMENT', label: 'Enter an alternative acquisition agreement', text: 'ENTER_ALT_AGREEMENT', quotes: [] };
  assert.equal(citable.getTaggedItemQuote(item), null);
});

test('getTaggedItemQuote returns null when .text is just the label echoed back verbatim', () => {
  const item = { code: 'ENTER_ALT_AGREEMENT', label: 'Enter an alternative acquisition agreement', text: 'Enter an alternative acquisition agreement', quotes: [] };
  assert.equal(citable.getTaggedItemQuote(item), null);
});

test('getTaggedItemQuote returns null for a non-tagged value (no code)', () => {
  assert.equal(citable.getTaggedItemQuote({ value: true, text: 'some text' }), null);
  assert.equal(citable.getTaggedItemQuote('a bare string'), null);
  assert.equal(citable.getTaggedItemQuote(null), null);
});
