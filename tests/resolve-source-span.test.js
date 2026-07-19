const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveSourceSpan,
  stripWithOffsetMap,
  findInStripped,
} = require('../lib/parser-v2/resolve-source-span');

test('stripWithOffsetMap removes marker tags and keeps a faithful offset map', () => {
  const raw = 'Before [[REF]]Section 3.1[[/REF]] after.';
  const { strippedText, strippedToRaw, rawToStripped } = stripWithOffsetMap(raw);
  assert.equal(strippedText, 'Before Section 3.1 after.');
  // Every char of strippedText maps back to the matching raw char.
  for (let i = 0; i < strippedText.length; i++) {
    assert.equal(raw[strippedToRaw[i]], strippedText[i]);
  }
  // Characters inside the stripped tag have no forward mapping.
  const tagStart = raw.indexOf('[[REF]]');
  assert.equal(rawToStripped[tagStart], -1);
  // A character just after "Before " maps correctly both ways.
  const sIdx = strippedText.indexOf('Section');
  const rIdx = raw.indexOf('Section');
  assert.equal(strippedToRaw[sIdx], rIdx);
  assert.equal(rawToStripped[rIdx], sIdx);
});

test('findInStripped finds a literal match', () => {
  const hit = findInStripped('The quick brown fox.', 'quick brown');
  assert.deepEqual(hit, { start: 4, end: 15, exact: true });
});

test('findInStripped falls back to whitespace-normalized match without truncating content', () => {
  const haystack = 'The quick\n   brown   fox jumps.';
  const hit = findInStripped(haystack, 'quick brown fox');
  assert.ok(hit);
  assert.equal(hit.exact, false);
  assert.equal(haystack.slice(hit.start, hit.end).replace(/\s+/g, ' '), 'quick brown fox');
});

test('findInStripped returns null when the needle is genuinely absent', () => {
  assert.equal(findInStripped('The quick brown fox.', 'a totally different clause'), null);
});

test('resolveSourceSpan: explicit offsets win when they validate against raw full_text', () => {
  const fullText = 'PREAMBLE. [[REF]]Section 3.1[[/REF]] Company shall indemnify Parent.';
  const quote = 'Company shall indemnify Parent.';
  const quoteStart = fullText.indexOf(quote);
  const quoteEnd = quoteStart + quote.length;
  const resolved = resolveSourceSpan({
    fullText,
    quoteStart,
    quoteEnd,
    primaryQuote: quote,
    regionFullText: quote,
  });
  assert.equal(resolved.status, 'offset');
  assert.equal(resolved.verbatim, true);
  assert.equal(resolved.matchedText, quote);
  assert.equal(resolved.strippedText.slice(resolved.start, resolved.end), quote);
});

test('resolveSourceSpan: bad explicit offsets fall through to exact-quote find', () => {
  // Mirrors live data: store-cards.js often stores {0, quote.length} which
  // is meaningless against full_text.
  const fullText = 'Article I. [[DEFINED]]"Material Adverse Effect"[[/DEFINED]] means a material adverse change.';
  const quote = 'means a material adverse change.';
  const resolved = resolveSourceSpan({
    fullText,
    quoteStart: 0,
    quoteEnd: quote.length,
    primaryQuote: quote,
    regionFullText: fullText,
  });
  assert.equal(resolved.status, 'exact-quote');
  assert.equal(resolved.verbatim, true);
  assert.equal(resolved.matchedText, quote);
});

test('resolveSourceSpan: a quote spanning an inline marker still resolves byte-verbatim', () => {
  // This is the case that broke a naive raw-offset highlight: the quote's
  // OWN span contains a [[DEFINED]] tag in the raw text, so a highlight
  // expressed in raw coordinates would run long by the tag's width. The
  // stripped-text coordinates this module returns must not have that bug.
  const fullText = 'Section 9. The [[DEFINED]]"Company"[[/DEFINED]] shall not amend its charter.';
  const quote = 'The "Company" shall not amend its charter.';
  const resolved = resolveSourceSpan({
    fullText,
    quoteStart: null,
    quoteEnd: null,
    primaryQuote: quote,
    regionFullText: fullText,
  });
  assert.equal(resolved.status, 'exact-quote');
  assert.equal(resolved.matchedText, quote);
  assert.equal(resolved.matchedText.length, quote.length);
});

test('resolveSourceSpan: falls back to region_full_text when the quote itself cannot be found', () => {
  const fullText = 'Section 4. The region contains extra context around the clause body here.';
  const region = 'The region contains extra context around the clause body here.';
  const resolved = resolveSourceSpan({
    fullText,
    primaryQuote: 'a quote that was paraphrased and does not appear verbatim',
    regionFullText: region,
  });
  assert.equal(resolved.status, 'exact-region');
  assert.equal(resolved.matchedText, region);
});

test('resolveSourceSpan: unresolved when nothing matches — never a silently wrong highlight', () => {
  const resolved = resolveSourceSpan({
    fullText: 'Section 5. Nothing here relates to the quote at all.',
    primaryQuote: 'completely unrelated text',
    regionFullText: 'also completely unrelated',
  });
  assert.equal(resolved.status, 'unresolved');
  assert.equal(resolved.start, null);
  assert.equal(resolved.end, null);
  assert.equal(resolved.matchedText, null);
});

test('resolveSourceSpan: empty full_text is unresolved, not a crash', () => {
  const resolved = resolveSourceSpan({ fullText: '', primaryQuote: 'anything' });
  assert.equal(resolved.status, 'unresolved');
});
