// Item 16 (UI Feedback Round 3): junk-looking list entries.
//   16.1 fragment defined terms ("from", "to the extent", "made available",
//        "under common control with", lowercase "knowledge", Ben's reported
//        stray "wise" -- a mid-word/mid-phrase capture from "otherwise"/
//        "likewise") were rendering in the Definitions section as if they
//        were real defined terms.
//   16.2 the per-section provision index duplicated a provision when
//        ingestion stored TWO cards for the same (section_ref, short_title)
//        (Theravance: two 6.1 "Information to Regulators" cards).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review-v2', 'provisionIndexHelpers.js'));
});

test('isFragmentDefinedTerm: blocklisted stopword/connector phrases are fragments', () => {
  for (const term of ['from', 'to the extent', 'made available', 'under common control with', 'wise', 'likewise', 'otherwise']) {
    assert.equal(mod.isFragmentDefinedTerm(term), true, `"${term}" should be flagged as a fragment`);
  }
});

test('isFragmentDefinedTerm: blocklist match is case-insensitive', () => {
  assert.equal(mod.isFragmentDefinedTerm('Wise'), true);
  assert.equal(mod.isFragmentDefinedTerm('OTHERWISE'), true);
});

test('isFragmentDefinedTerm: a lowercase-leading term is a fragment even if not blocklisted', () => {
  assert.equal(mod.isFragmentDefinedTerm('knowledge'), true);
  assert.equal(mod.isFragmentDefinedTerm('material adverse effect'), true);
});

test('isFragmentDefinedTerm: shorter than 3 characters is a fragment', () => {
  assert.equal(mod.isFragmentDefinedTerm('to'), true);
  assert.equal(mod.isFragmentDefinedTerm(''), true);
  assert.equal(mod.isFragmentDefinedTerm(null), true);
});

test('isFragmentDefinedTerm: a genuine Capitalized or ALL-CAPS defined term is NOT a fragment', () => {
  assert.equal(mod.isFragmentDefinedTerm('Material Adverse Effect'), false);
  assert.equal(mod.isFragmentDefinedTerm('MAE'), false);
  assert.equal(mod.isFragmentDefinedTerm('Applicable Date'), false);
  assert.equal(mod.isFragmentDefinedTerm('Company Disclosure Letter'), false);
});

test('definitionTextForDisplay keeps complete standalone definitions and avoids parenthetical source-clause spill', () => {
  const standalone = '"Material Adverse Effect" means any event that has a material adverse effect; provided that market changes are excluded.';
  assert.equal(mod.definitionTextForDisplay({
    defined_term: 'Material Adverse Effect',
    defined_value: 'any event that has a material adverse effect',
    primary_quote: standalone,
  }), standalone);

  assert.equal(mod.definitionTextForDisplay({
    defined_term: 'Mailing Date',
    defined_value: 'not fewer than thirty days before the election deadline',
    primary_quote: 'Not fewer than thirty days before the election deadline (the "Mailing Date"), the Company shall cause the materials to be mailed t',
  }), 'not fewer than thirty days before the election deadline');

  assert.equal(mod.definitionTextForDisplay({
    defined_term: 'Relevant Patents',
    defined_value: 'the patents reasonably necessary to develop the product',
    primary_quote: `"Relevant Patents" means ${'captured text '.repeat(95)}trunc`,
  }), 'the patents reasonably necessary to develop the product');
});

test('definition display bounds hard-capped captures without ending mid-token', () => {
  const capped = `${'A complete captured sentence. '.repeat(45)}a broken tai`;
  const definition = {
    defined_term: 'Employee Plan',
    defined_value: capped,
    primary_quote: capped,
  };
  const provision = mod.definitionTextForDisplay(definition);
  const summary = mod.definitionSummaryForDisplay(definition);
  assert.match(provision, /…$/);
  assert.match(summary, /…$/);
  assert.ok(summary.length <= 651);
  assert.doesNotMatch(provision, /broken tai…$/);
});

test('dedupeBySectionAndTitle: two cards for the SAME (section_ref, short_title) collapse to one, keeping the longer text (Theravance 6.1 Information to Regulators)', () => {
  const cards = [
    { id: '5eea8833', section_ref: '6.1 | Information to Regulators | abc', short_title: 'Information to Regulators', primary_quote: 'Short version.' },
    { id: 'a2e67986', section_ref: '6.1 | Information to Regulators | def', short_title: 'Information to Regulators', primary_quote: 'A much longer, more complete captured version of this provision text goes here for comparison.' },
  ];
  const deduped = mod.dedupeBySectionAndTitle(cards);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, 'a2e67986', 'the card with the LONGER captured text must survive');
});

test('dedupeBySectionAndTitle: different section numbers with the same title are NOT deduped', () => {
  const cards = [
    { id: 'a', section_ref: '6.1 | Regulatory Filing Deadline | x', short_title: 'Regulatory Filing Deadline', primary_quote: 'text a' },
    { id: 'b', section_ref: '6.2 | Regulatory Filing Deadline | y', short_title: 'Regulatory Filing Deadline', primary_quote: 'text b' },
  ];
  const deduped = mod.dedupeBySectionAndTitle(cards);
  assert.equal(deduped.length, 2);
});

test('dedupeBySectionAndTitle: genuinely different provisions in the same section are untouched', () => {
  const cards = [
    { id: 'a', section_ref: '6.1 | Foreign Regulatory Approvals | x', short_title: 'Foreign Regulatory Approvals', primary_quote: 'text a' },
    { id: 'b', section_ref: '6.1 | Litigation Against Regulators | y', short_title: 'Litigation Against Regulators', primary_quote: 'text b' },
    { id: 'c', section_ref: '6.10 | D&O Indemnification and Insurance | z', short_title: 'D&O Indemnification and Insurance', primary_quote: 'text c' },
  ];
  const deduped = mod.dedupeBySectionAndTitle(cards);
  assert.equal(deduped.length, 3);
});

test('dedupeBySectionAndTitle: cards with no short_title (e.g. defined-term-only entries) never merge with each other', () => {
  const cards = [
    { id: 'a', section_ref: '1.01', defined_term: 'Applicable Date', primary_quote: 'text a' },
    { id: 'b', section_ref: '1.01', defined_term: 'Effective Time', primary_quote: 'text b' },
  ];
  const deduped = mod.dedupeBySectionAndTitle(cards);
  assert.equal(deduped.length, 2);
});

test('resolveRowCard prefers an exact singular source over a broader fallback source list', () => {
  const exact = { id: 'qxo-notice', provision_subtype: 'NOSOL-INTERVENING' };
  const unrelated = { id: 'qxo-recommend', provision_subtype: 'NOSOL-RECOMMEND' };
  const cardsById = mod.buildCardIndex([unrelated, exact]);
  const resolved = mod.resolveRowCard({ sourceCard: exact, sourceCards: [unrelated, exact] }, cardsById);
  assert.equal(resolved, exact);
});

test('resolveRowCard accepts the compact source shape used by composite review rows', () => {
  const source = { id: 'qxo-proxy', provision_subtype: 'COV-PROXY' };
  const indexed = { ...source, primary_quote: 'The Company shall file and mail the proxy statement.' };
  const cardsById = mod.buildCardIndex([indexed]);
  assert.equal(mod.resolveRowCard({ label: 'Proxy filing', source }, cardsById), indexed);
});

test('resolveRowCard ignores a display-only source label and keeps the source-card fallback', () => {
  const sourceCard = { id: 'qxo-meeting', provision_subtype: 'COV-MEETING' };
  const cardsById = mod.buildCardIndex([sourceCard]);
  assert.equal(mod.resolveRowCard({ source: 'Section 6.04', sourceCards: [sourceCard] }, cardsById), sourceCard);
});

test('resolveRowFocus preserves the exact feature key attached by the table row', () => {
  const focus = mod.resolveRowFocus({
    label: 'Notice period',
    featureKeys: ['noticePeriod'],
    evidence: 'The Company shall provide four business days notice.',
  });
  assert.deepEqual(focus.featureKeys, ['noticePeriod']);
  assert.equal(focus.itemCode, null);
  assert.match(focus.quote, /four business days/);
});

test('resolveRowFocus preserves local current-deal treatment without inventing a corpus feature key', () => {
  const focus = mod.resolveRowFocus({
    label: 'Capitalization',
    featureKeys: [],
    currentTreatments: [{ label: 'Bringdown', value: 'MAE', quote: 'subject to an MAE standard' }],
  });
  assert.equal(focus.featureKeys, null);
  assert.deepEqual(focus.currentTreatments, [{ label: 'Bringdown', value: 'MAE', quote: 'subject to an MAE standard' }]);
});
