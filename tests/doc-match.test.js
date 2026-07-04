/* FB3 (in-place document pop-under) — lib/doc-match.js.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'lib', 'doc-match.js'));
});

test('locateQuoteInText: exact case-insensitive match', () => {
  const doc = 'Preamble text. SECTION 5.03. Conduct of Business. The Company shall operate in the ordinary course.';
  const hit = mod.locateQuoteInText(doc, 'the company shall operate in the ordinary course');
  assert.ok(hit);
  assert.equal(hit.strategy, 'exact');
  assert.equal(doc.slice(hit.start, hit.end).toLowerCase(), 'the company shall operate in the ordinary course');
});

test('locateQuoteInText: whitespace-normalized match (newlines/extra spaces in source)', () => {
  const doc = 'SECTION 5.03. Conduct   of\nBusiness. The Company   shall\n operate in the ordinary course.';
  const hit = mod.locateQuoteInText(doc, 'The Company shall operate in the ordinary course.');
  assert.ok(hit);
  assert.equal(hit.strategy, 'normalized');
});

test('locateQuoteInText: long quote falls back to a 200-char signature', () => {
  const body = 'the Company shall not, and shall not permit any Subsidiary to, directly or indirectly ' +
    'take any action that would reasonably be expected to prevent, materially delay or materially impede ' +
    'the consummation of the transactions contemplated hereby, including the Merger.';
  const doc = `SECTION 6.01. Efforts. ${body} Additional trailing language follows here that was not quoted.`;
  // Needle is the full body PLUS a fabricated tail the source doesn't have —
  // the signature strategy should still anchor on the first 200 chars.
  const needle = body + ' some paraphrase that does not appear verbatim anywhere else';
  const hit = mod.locateQuoteInText(doc, needle);
  assert.ok(hit);
  assert.equal(hit.strategy, 'signature-200');
  assert.ok(hit.start > 0);
});

test('locateQuoteInText: SECTION header fallback', () => {
  const doc = 'Some preface. SECTION 7.02. Termination Fee. In the event the Agreement is terminated...';
  const hit = mod.locateQuoteInText(doc, 'SECTION 7.02): a mangled prefix not present verbatim');
  assert.ok(hit);
  assert.equal(hit.strategy, 'section-header');
});

test('locateQuoteInText: returns null when nothing matches', () => {
  assert.equal(mod.locateQuoteInText('short doc', 'this text is nowhere in the document at all'), null);
  assert.equal(mod.locateQuoteInText('', 'needle'), null);
  assert.equal(mod.locateQuoteInText('doc', ''), null);
});

test('buildWindow: slices around the match with padding, clamped to document bounds', () => {
  const doc = 'A'.repeat(100) + 'MATCHME' + 'B'.repeat(100);
  const start = 100;
  const end = 107;
  const win = mod.buildWindow(doc, start, end, { before: 20, after: 20 });
  assert.equal(win.windowStart, 80);
  assert.equal(win.windowEnd, 127);
  assert.equal(win.text.slice(win.matchStart, win.matchEnd), 'MATCHME');
  assert.equal(win.canExpandBefore, true);
  assert.equal(win.canExpandAfter, true);
});

test('buildWindow: does not expand before/after past the document edges', () => {
  const doc = 'MATCHME' + 'B'.repeat(50);
  const win = mod.buildWindow(doc, 0, 7, { before: 500, after: 500 });
  assert.equal(win.windowStart, 0);
  assert.equal(win.windowEnd, doc.length);
  assert.equal(win.canExpandBefore, false);
  assert.equal(win.canExpandAfter, false);
  assert.equal(win.text.slice(win.matchStart, win.matchEnd), 'MATCHME');
});

test('buildWindow: snaps the start/end to a paragraph break instead of cutting a run mid-word', () => {
  // Raw padding (5 chars) lands INSIDE the 'y'/'z' runs, each 10 chars away
  // from its bordering paragraph break — close enough (well within
  // PARA_SEARCH) for buildWindow to round the boundary out to the break, so
  // the excerpt opens/closes on a clean paragraph edge rather than mid-run.
  const before = 'x'.repeat(50) + '\n\n' + 'y'.repeat(10);
  const match = 'MATCHME';
  const after = 'z'.repeat(10) + '\n\n' + 'w'.repeat(50);
  const doc = before + match + after;
  const start = before.length;
  const end = start + match.length;
  const win = mod.buildWindow(doc, start, end, { before: 5, after: 5 });
  assert.ok(win.text.startsWith('y'.repeat(10)), `expected to start at the y-run, got: ${JSON.stringify(win.text.slice(0, 20))}`);
  assert.ok(!win.text.includes('x'), 'should not have snapped back into the x-run');
  assert.ok(win.text.endsWith('z'.repeat(10)), `expected to end at the z-run, got: ${JSON.stringify(win.text.slice(-20))}`);
  assert.ok(!win.text.includes('w'), 'should not have snapped forward into the w-run');
});
