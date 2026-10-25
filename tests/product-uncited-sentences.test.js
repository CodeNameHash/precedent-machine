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

// The review of 2026-10-25 (findings 6, 8, 9, 10, 11): the verbs that were
// missing, a held fact whose component lost its bytes, the default offset,
// abbreviations and page footers, and an inverted range.
test('the obligation verbs include the ones the first list missed', () => {
  const sentence = 'The Company undertakes to indemnify, defend and hold harmless Parent and its Affiliates from and against any and all losses arising out of the Written Consent.';
  const uncited = uncitedSectionSentences({ sectionText: sentence, proposals: [] });
  assert.equal(uncited.length, 1, 'an undertaking to indemnify is an obligation');
  for (const words of ['The Company shall act.', 'Parent waives any claim to the fee.', 'The Company grants a licence.', 'Parent consents to the assignment.', 'The Company acknowledges the notice.', 'The Company is required to deliver the certificate.']) {
    assert.equal(OPERATIVE_VERB.test(words), true, words);
  }
});

test('a held fact whose component kept its words but lost its byte range still cites its sentence', () => {
  const sentence = 'The Company shall deliver notice of the Written Consent to Parent promptly after it is obtained.';
  const uncited = uncitedSectionSentences({
    sectionText: sentence, proposals: [{ validation_status: 'INVALID', components: [{ kind: 'OPERATION', text: sentence }] }],
  });
  assert.deepEqual(uncited, [], 'the held fact quotes the sentence, so the sentence is not uncited');
  // A text too short to identify a sentence does not count as a citation.
  const shortText = uncitedSectionSentences({ sectionText: sentence, proposals: [{ components: [{ kind: 'TERM', text: 'notice' }] }] });
  assert.equal(shortText.length, 1);
});

test('the offset default is zero, an abbreviation and a page footer do not split a sentence, and an inverted range cites nothing', () => {
  const spans = sentenceByteSpans('The notice goes to the U.S. Food and Drug Administration.');
  assert.equal(spans.length, 1);
  assert.ok(spans.every((span) => Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end)), 'offsets are numbers without a startByte');
  const footer = sentenceByteSpans('The Company shall deliver the certificate to Parent.\n12\nThe Parent shall accept it promptly.');
  assert.equal(footer.length, 2, 'a footer number on its own line does not end a sentence');
  assert.match(footer[0].text, /to Parent\.$/);
  // An inverted range is ignored rather than covering the interval.
  const sentence = 'The Company shall deliver the certificate to Parent promptly after the Written Consent.';
  const uncited = uncitedSectionSentences({ sectionText: sentence, proposals: [{ components: [{ kind: 'OPERATION', start_byte: 100, end_byte: 10, text: 'x' }] }] });
  assert.equal(uncited.length, 1);
});
