/* Tests for findInlineDefinitions parenthetical detection (lib/parser-v2/extract).
   Run: npm test
   Parenthetical labeling defs ("...(the “Merger”)") are only findable once the
   ingest cleaner preserves quotes (see html-entities.test.js). These guard the
   antecedent capture + the index-of-defined-terms rejection. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { findInlineDefinitions } = require('../lib/parser-v2/extract');

test('parenthetical label captures its antecedent as the definition', () => {
  const text = 'Upon the terms and subject to the conditions set forth in this Agreement, '
    + 'Merger Sub shall merge with and into the Company (the “Merger”), with the Company surviving.';
  const defs = findInlineDefinitions(text);
  const merger = defs.find((d) => d.term === 'Merger' && d.matchedPattern === 'parenthetical');
  assert.ok(merger, 'Merger should be captured as a parenthetical definition');
  assert.ok(/merge with and into the Company/.test(merger.text), 'text should hold the antecedent');
  assert.ok(merger.text.length <= 600, 'antecedent capture is bounded');
});

test('a defined-term index run is NOT captured as a definition', () => {
  // Front-of-document "term  section" listing ending in a parenthetical label.
  const idx = 'Tax Return 3.01(m)(i) Taxes 3.01(m)(i) Taxing Authority 3.01(m)(i) '
    + 'Termination Fee 5.06(b) Third Party Software 3.01(o)(ii) (the “Index Term”)';
  const defs = findInlineDefinitions(idx);
  const bad = defs.find((d) => d.term === 'Index Term');
  assert.equal(bad, undefined, 'section-number-dense antecedent must be rejected');
});

test('parenthetical definition text stays verbatim (matchable back to source)', () => {
  const text = 'Each share of Company Common Stock shall be converted into $190.00 in cash '
    + 'without interest (the “Merger Consideration”).';
  const defs = findInlineDefinitions(text);
  const mc = defs.find((d) => d.term === 'Merger Consideration');
  assert.ok(mc);
  // The captured text is a contiguous substring of the source.
  assert.ok(text.includes(mc.text) || text.replace(/\s+/g, ' ').includes(mc.text.replace(/\s+/g, ' ')));
});

test('adjacent Verve-style definitions are bounded at the next defined-term header', () => {
  const text = '"Acting Holders" means Holders of not less than twenty-five percent (25%) of outstanding CVRs as set forth in the CVR Register.\n\n'
    + ' "Agreement" has the meaning set forth in the preamble hereto.\n\n'
    + '"Assignee" has the meaning set forth in Section 6.3(a).\n\n'
    + '"Change of Control" means a sale of substantially all assets of Parent or a merger in which Parent is not the surviving entity.';
  const defs = findInlineDefinitions(text);
  const acting = defs.find((definition) => definition.term === 'Acting Holders');
  const assignee = defs.find((definition) => definition.term === 'Assignee');
  assert.ok(acting);
  assert.ok(assignee);
  assert.match(acting.text, /outstanding CVRs/);
  assert.doesNotMatch(acting.text, /Agreement|Assignee|Change of Control/);
  assert.match(assignee.text, /Section 6\.3\(a\)/);
  assert.doesNotMatch(assignee.text, /Change of Control/);
});
