'use strict';

// Work package 43 (plan finding (260)): the sentence-level silent-absence
// read. The section-level block names a section that returned no facts and
// the thin-answer guard fails an empty answer at extraction time; neither
// answers "is there a sentence stating an obligation that no fact cites?".
// The read is diagnostic only (a sentence may be cited as context, and the
// verb list is a heuristic), so nothing here is a gate.

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  sentenceByteSpans, uncitedSectionSentences, uncitedOperativeSentences, renderUncitedReport, OPERATIVE_VERB,
} = require('../lib/product/uncited-sentences');

const TEXT = 'Section 5.16 Regulatory Matters. The Company shall promptly provide Parent with a copy of all written correspondence received from the FDA. The Company shall also consult with Parent in good faith before any material submission to the FDA. This sentence is a heading. No obligation appears here.';
const startOf = (needle) => Buffer.byteLength(TEXT.slice(0, TEXT.indexOf(needle)), 'utf8');
const endOf = (needle) => startOf(needle) + Buffer.byteLength(needle, 'utf8');

const component = (needle, extra = {}) => ({ kind: 'OPERATION', text: needle, start_byte: startOf(needle), end_byte: endOf(needle), ...extra });

test('sentences carry their byte offsets, and a page footer inside one stays part of it', () => {
  const spans = sentenceByteSpans(TEXT, 1000);
  assert.equal(spans[0].text, 'Section 5.16 Regulatory Matters.');
  assert.equal(spans[0].start, 1000);
  assert.equal(spans[1].text, 'The Company shall promptly provide Parent with a copy of all written correspondence received from the FDA.');
  assert.equal(spans[1].start, 1000 + startOf(spans[1].text));
  assert.equal(spans.length, 5);
  // A footer number on a line of its own inside a sentence does not split it.
  const withFooter = sentenceByteSpans('The Company shall deliver\n34\nthe certificate.', 0);
  assert.equal(withFooter.length, 1);
  assert.match(withFooter[0].text, /shall deliver/);
});

test('an operative sentence no component touches is reported; a cited one and a short or non-operative one are not', () => {
  const proposals = [{ components: [component('The Company shall promptly provide Parent with a copy of all written correspondence received from the FDA.')] }];
  const uncited = uncitedSectionSentences({ sectionText: TEXT, startByte: 0, proposals });
  assert.equal(uncited.length, 1);
  assert.match(uncited[0].text, /consult with Parent in good faith/);
  // The floor: a short operative sentence is not listed.
  const raised = uncitedSectionSentences({ sectionText: TEXT, startByte: 0, proposals, minBytes: 200 });
  assert.equal(raised.length, 0);
  // An inherited context component counts as cited: the fact tree quotes it.
  const contextCited = uncitedSectionSentences({
    sectionText: TEXT, startByte: 0,
    proposals: [{ components: [
      { kind: 'CHAPEAU', origin: 'CHAPEAU', start_byte: startOf('The Company shall also consult with Parent in good faith before any material submission to the FDA.'), end_byte: endOf('The Company shall also consult with Parent in good faith before any material submission to the FDA.') },
    ] }],
  });
  assert.equal(contextCited.some((sentence) => /consult with Parent/.test(sentence.text)), false);
  // Every sentence cited: nothing reported.
  const all = uncitedSectionSentences({
    sectionText: TEXT, startByte: 0,
    proposals: [{ components: [
      component('The Company shall promptly provide Parent with a copy of all written correspondence received from the FDA.'),
      component('The Company shall also consult with Parent in good faith before any material submission to the FDA.'),
    ] }],
  });
  assert.deepEqual(all, []);
  assert.equal(OPERATIVE_VERB.test('The Company shall act'), true);
  assert.equal(OPERATIVE_VERB.test('A heading about nothing'), false);
});

test('the analysis read reports a section that states an obligation with no fact, and skips introductions, exhibits and a fully cited section', () => {
  const sectionText = 'Section 5.16 Regulatory Matters. The Company shall promptly provide Parent with a copy of all written correspondence received from the FDA.';
  const analysis = {
    spans: [{ span_id: 'span-1', start_byte: 500, end_byte: 500 + Buffer.byteLength(sectionText, 'utf8'), exact_text: sectionText }],
    source_closures: [{ structure_node_id: 'node-1', full_section_span_id: 'span-1' }],
    sections: [
      { structure_node_id: 'node-1', section_reference: '5.16' },
      { structure_node_id: 'node-2', section_reference: 'III-INTRO' },
      { structure_node_id: 'node-3', section_reference: 'Exhibit-B' },
      { structure_node_id: 'node-4', section_reference: '5.17' },
    ],
    proposals: [],
  };
  const sections = uncitedOperativeSentences({ analysis });
  assert.deepEqual(sections.map((section) => section.section_reference), ['5.16']);
  assert.equal(sections[0].sentences.length, 1, 'the heading sentence states no obligation, and "5.16" is not a sentence boundary');
  assert.ok(sections[0].sentences.every((sentence) => sentence.start_byte >= 500), 'offsets are in the canonical text');
  // The report names the section and its sentences.
  const report = renderUncitedReport(sections);
  assert.match(report, /1 uncited operative sentence in 1 section/);
  assert.match(report, /§ 5\.16 \(1\)/);
  assert.match(renderUncitedReport([]), /No section has an uncited operative sentence/);
});
