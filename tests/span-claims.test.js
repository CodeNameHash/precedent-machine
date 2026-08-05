// Span accounting spec (docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md),
// Part 2 — lib/parser-v2/span-claims.js.
const test = require('node:test');
const assert = require('node:assert/strict');

const { computeSpanClaims, attachSpanClaimsToProvisions } = require('../lib/parser-v2/span-claims.js');

const SECTION_TEXT = [
  '5.2Additional Conditions. The obligations of Parent are subject to the',
  'satisfaction of each of the following further conditions:',
  '',
  '(a)',
  '',
  '(i)The Company shall have performed in all material respects all of its',
  'obligations hereunder required to be performed by it as of the Closing Date;',
  '',
  '(ii)(A) the representations and warranties set forth in Section 3.1(a)',
  '(Organization) shall be true and correct in all respects, and (B) the',
  'representations and warranties set forth in Section 3.1(b) (Capital',
  'Structure) shall be true and correct in all material respects; and',
  '',
  '(b)Parent shall have received a certificate of the Company dated the',
  'Closing Date certifying that the conditions above have been satisfied.',
].join('\n');

test('an emitted item whose quote is located verbatim gets claimedSpans covering the right leaf', () => {
  const items = [
    { id: 'p1', text: 'the representations and warranties set forth in Section 3.1(a)\n(Organization) shall be true and correct in all respects' },
  ];
  const [result] = computeSpanClaims(SECTION_TEXT, items);
  assert.equal(result.spanUnlocated, false);
  assert.ok(result.claimedSpans.length >= 1);
  assert.equal(result.claimedSpans[0].marker, 'a.ii.A');
});

test('an emitted item quoting whitespace-rewrapped text still locates (no offset-mapping needed)', () => {
  // The model "cleans up" the hard line-wrap inside the quote — the
  // fuzzy whitespace-tolerant pass should still find it.
  const items = [
    { text: 'The Company shall have performed in all material respects all of its obligations hereunder required to be performed by it as of the Closing Date' },
  ];
  const [result] = computeSpanClaims(SECTION_TEXT, items);
  assert.equal(result.spanUnlocated, false);
  assert.equal(result.claimedSpans[0].marker, 'a.i');
});

test('an item straddling two leaves claims both', () => {
  const items = [
    { text: 'obligations hereunder required to be performed by it as of the Closing Date;\n\n(ii)(A) the representations and warranties set forth in Section 3.1(a)' },
  ];
  const [result] = computeSpanClaims(SECTION_TEXT, items);
  assert.equal(result.spanUnlocated, false);
  const markers = result.claimedSpans.map((s) => s.marker).sort();
  assert.deepEqual(markers, ['a.i', 'a.ii.A']);
});

// textSpan is the item's OWN location, as opposed to claimedSpans (the
// leaves it touches). It is what makes "this quote came from HERE" checkable
// downstream: slicing the section at the recorded offsets must give the text
// back, otherwise the stored offsets are decoration.
test('a located item records a textSpan that slices back to its own text', () => {
  const quote = 'Parent shall have received a certificate of the Company dated the';
  const [result] = computeSpanClaims(SECTION_TEXT, [{ text: quote }]);
  assert.equal(result.spanUnlocated, false);
  assert.equal(SECTION_TEXT.slice(result.textSpan.start, result.textSpan.end), quote);
});

test('a whitespace-rewrapped quote records a textSpan that slices back to the SOURCE wrapping, not the model wrapping', () => {
  const rewrapped = 'The Company shall have performed in all material respects all of its obligations hereunder required to be performed by it as of the Closing Date';
  const [result] = computeSpanClaims(SECTION_TEXT, [{ text: rewrapped }]);
  const sliced = SECTION_TEXT.slice(result.textSpan.start, result.textSpan.end);
  assert.notEqual(sliced, rewrapped, 'the source has a hard line-wrap the model closed up');
  assert.equal(sliced.replace(/\s+/g, ' '), rewrapped.replace(/\s+/g, ' '));
});

test('the textSpan sits inside the leaf claimedSpans report — the two are consistent, not interchangeable', () => {
  const quote = 'Parent shall have received a certificate of the Company dated the';
  const [result] = computeSpanClaims(SECTION_TEXT, [{ text: quote }]);
  const leaf = result.claimedSpans[0];
  assert.ok(leaf.start <= result.textSpan.start && leaf.end >= result.textSpan.end);
  assert.ok(
    leaf.end - leaf.start > result.textSpan.end - result.textSpan.start,
    'the leaf is wider than the quote — this is why a leaf span is not a quote location',
  );
});

test('an unlocated item records textSpan: null rather than a fabricated offset', () => {
  const [result] = computeSpanClaims(SECTION_TEXT, [
    { text: 'This sentence was never in the source agreement at all and the model invented it.' },
  ]);
  assert.equal(result.spanUnlocated, true);
  assert.equal(result.textSpan, null);
});

test('an item whose text does not appear anywhere in the section is flagged spanUnlocated — the hallucination surface', () => {
  const items = [
    { text: 'This sentence was never in the source agreement at all and the model invented it out of thin air.' },
  ];
  const [result] = computeSpanClaims(SECTION_TEXT, items);
  assert.equal(result.spanUnlocated, true);
  assert.deepEqual(result.claimedSpans, []);
});

test('a too-short item text (< 12 chars) is unjudgeable and flagged unlocated rather than false-matched', () => {
  const items = [{ text: 'Parent' }];
  const [result] = computeSpanClaims(SECTION_TEXT, items);
  assert.equal(result.spanUnlocated, true);
});

test('computeSpanClaims does not mutate the input items array', () => {
  const items = [{ text: 'Parent shall have received a certificate of the Company dated the' }];
  const snapshot = JSON.parse(JSON.stringify(items));
  computeSpanClaims(SECTION_TEXT, items);
  assert.deepEqual(items, snapshot);
});

// ---------------------------------------------------------------------------
// Wiring inertness — Part 2's strategy-A/C hook (attachSpanClaimsToProvisions,
// called from extract.js's strategyA/strategyC) must be a no-op unless a
// caller explicitly opts in with { spanClaims: true }. No default extract.js
// call site does, so span accounting changes nothing about the ingest path
// today — this pins that contract at the module boundary.
// ---------------------------------------------------------------------------
test('attachSpanClaimsToProvisions is a no-op without opts.spanClaims === true', () => {
  const provisions = [{ startChar: 0, text: 'Parent shall have received a certificate of the Company dated the' }];
  const sectionTextByStartChar = new Map([[0, SECTION_TEXT]]);

  const untouched1 = attachSpanClaimsToProvisions(provisions, sectionTextByStartChar); // no opts at all
  assert.equal(untouched1[0].features, undefined);

  const untouched2 = attachSpanClaimsToProvisions(provisions, sectionTextByStartChar, {}); // opts={} but no flag
  assert.equal(untouched2[0].features, undefined);

  const untouched3 = attachSpanClaimsToProvisions(provisions, sectionTextByStartChar, { spanClaims: false });
  assert.equal(untouched3[0].features, undefined);
});

test('attachSpanClaimsToProvisions attaches features.spanClaims ONLY when opts.spanClaims === true', () => {
  const provisions = [{ startChar: 0, text: 'Parent shall have received a certificate of the Company dated the' }];
  const sectionTextByStartChar = new Map([[0, SECTION_TEXT]]);

  const result = attachSpanClaimsToProvisions(provisions, sectionTextByStartChar, { spanClaims: true });
  assert.ok(result[0].features);
  assert.ok(result[0].features.spanClaims);
  assert.equal(result[0].features.spanClaims.spanUnlocated, false);
  assert.equal(result[0].features.spanClaims.claimedSpans[0].marker, 'b');
});

test('the attached payload carries the quote offsets AND the section origin they are relative to', () => {
  const quote = 'Parent shall have received a certificate of the Company dated the';
  const provisions = [{ startChar: 4000, text: quote }];
  const sectionTextByStartChar = new Map([[4000, SECTION_TEXT]]);

  const [prov] = attachSpanClaimsToProvisions(provisions, sectionTextByStartChar, { spanClaims: true });
  const { textSpan, sectionStartChar } = prov.features.spanClaims;

  assert.equal(sectionStartChar, 4000, 'without this the section-relative offsets are unusable downstream');
  assert.equal(SECTION_TEXT.slice(textSpan.start, textSpan.end), quote);
  // Lifted into full-cleaned-text coordinates by the documented rule.
  assert.equal(sectionStartChar + textSpan.start, 4000 + SECTION_TEXT.indexOf(quote));
});
