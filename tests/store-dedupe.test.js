const test = require('node:test');
const assert = require('node:assert/strict');
const { dedupeProvisions } = require('../lib/parser-v2/store');

test('dedupeProvisions keeps the first byte-identical provision', () => {
  const provisions = [
    { type: 'EQUITY', category: 'Treatment of Equity Awards', full_text: 'Same provision text.' },
    { type: 'EQUITY', category: 'Treatment of Equity Awards', full_text: 'Same provision text.' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), [provisions[0]]);
});

test('dedupeProvisions ignores section markers and whitespace', () => {
  const provisions = [
    { type: 'COND', category: 'Closing Conditions', full_text: '[[SECTION]] The   condition\napplies. [[/SECTION]]' },
    { type: 'COND', category: 'Closing Conditions', full_text: 'The condition applies.' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), [provisions[0]]);
});

test('dedupeProvisions keeps same-category provisions with different text', () => {
  const provisions = [
    { type: 'TERMF', category: 'Termination Fee', full_text: 'The fee is $10 million.' },
    { type: 'TERMF', category: 'Termination Fee', full_text: 'The fee is $12 million.' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), provisions);
});

test('dedupeProvisions drops identical text under different categories', () => {
  const provisions = [
    { type: 'EQUITY', category: 'Treatment of Equity Awards', full_text: 'Options vest at closing.' },
    { type: 'EQUITY', category: 'Equity Award Treatment', full_text: 'Options vest at closing.' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), [provisions[0]]);
});

test('dedupeProvisions never merges empty or missing full_text provisions', () => {
  const provisions = [
    { type: 'EQUITY', category: 'Blank A', full_text: '' },
    { type: 'EQUITY', category: 'Blank B', full_text: '   ' },
    { type: 'EQUITY', category: 'Missing' },
  ];

  assert.deepEqual(dedupeProvisions(provisions), provisions);
});
