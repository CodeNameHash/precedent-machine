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

const { differentiateCategories } = require('../lib/parser-v2/store');

test('differentiateCategories renames same-category distinct-text provisions by their own section heading', () => {
  const provisions = [
    { type: 'REP-T', category: 'Capitalization; Subsidiaries', full_text: 'SECTION 3.02. Capital Structure. The authorized capital stock consists of shares.' },
    { type: 'REP-T', category: 'Capitalization; Subsidiaries', full_text: 'SECTION 3.03. Company Subsidiaries. Each subsidiary is duly organized.' },
    { type: 'REP-T', category: 'Litigation', full_text: 'SECTION 3.13. Litigation. There is no pending action.' },
  ];
  const out = differentiateCategories(provisions);
  assert.equal(out[0].category, 'Capitalization; Subsidiaries — Capital Structure');
  assert.equal(out[1].category, 'Capitalization; Subsidiaries — Company Subsidiaries');
  // singleton untouched
  assert.equal(out[2].category, 'Litigation');
});

test('differentiateCategories leaves a member alone when its heading equals the shared label', () => {
  const provisions = [
    { type: 'IOC-T', category: 'Indebtedness', full_text: '(i) incur any indebtedness for borrowed money in excess of $500,000.' },
    { type: 'IOC-T', category: 'Indebtedness', full_text: '(n) make any capital contribution or investment in any Person.', ai_metadata: { features: { sectionNumber: '5.01(n)' } } },
  ];
  const out = differentiateCategories(provisions);
  // No SECTION heading in sub-clause text: first has no number either -> unchanged;
  // second falls back to its section number.
  assert.equal(out[0].category, 'Indebtedness');
  assert.equal(out[1].category, 'Indebtedness (§5.01(n))');
});
