/* Tests for the runaway-[[TOC_START]] recovery path (lib/parser-v2/structural)
   and the heading-wrap repairs it depends on (lib/edgar-cleanup).

   Guards the Whole Foods / Dyax failure class: their stored
   deals.metadata.full_text was produced by an early displayCleanText whose
   markTableOfContents mis-detected the TOC end (its findBodyStart did not
   understand bare-numbered headings), so the [[TOC_START]] block swallowed
   most of the agreement body (WF: 81% of the doc, Dyax: 58%) — and the
   TOC-entry walker collapsed whole swallowed articles into giant one-line
   [[TOC_ENTRY]] blocks. stripDisplayMarkers used to DELETE the whole block,
   yielding 3 sections @ 82% (WF) and 28 @ 40% (Dyax). Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStructure, cleanText } = require('../lib/parser-v2/structural');
const { repairWrappedHeadings } = require('../lib/edgar-cleanup');

const FILLER = ' The parties agree to the covenants and undertakings set forth herein, subject to the terms and conditions of this Agreement and applicable Law, in each case as more fully described below.';
const BODY_FILLER = FILLER.repeat(3);
// Inflate the block past the runaway threshold (30k chars).
const LONG_FILLER = FILLER.repeat(90);

test('runaway TOC block: swallowed body articles and collapsed headings are recovered', () => {
  // Collapsed one-line span the TOC-entry walker produced: a wrapped
  // cross-reference ("...as set forth in\nSection 1.2...") leads it, and a
  // whole article boundary ("Covenants 2.1 Interim Operations.") sits
  // mid-line with its newlines lost.
  const collapsedSpan =
    '(b) of the Company Disclosure Letter shall survive the Effective Time.' +
    LONG_FILLER +
    ' Covenants 2.1 Interim Operations. (a) The Company covenants and agrees as to itself and its Subsidiaries that its business shall be conducted in the ordinary course.' +
    LONG_FILLER;

  const doc = [
    '[[CENTER]]AGREEMENT AND PLAN OF MERGER[[/CENTER]]',
    '',
    '[[TOC_START]]',
    'TABLE OF CONTENTS',
    '',
    // Genuine TOC (stub layout: number line, title on next line).
    '[[TOC_ARTICLE]]ARTICLE I -- The Merger[[/TOC_ARTICLE]]',
    '',
    '1.1.', '', 'The Merger', '',
    '1.2.', '', 'Closing', '',
    '[[TOC_ARTICLE]]ARTICLE II -- Covenants[[/TOC_ARTICLE]]',
    '',
    '2.1.', '', 'Interim Operations', '',
    '[[TOC_ARTICLE]]ARTICLE III -- Termination[[/TOC_ARTICLE]]',
    '',
    '3.1.', '', 'Termination', '',
    'Annex A',
    '',
    // Body swallowed INTO the block: article heading mislabelled as a TOC
    // article, bare-numbered sections with the title AND prose on one line.
    '[[TOC_ARTICLE]]ARTICLE I -- The Merger[[/TOC_ARTICLE]]',
    '',
    `1.1. The Merger. Upon the terms and subject to the conditions set forth in this Agreement, at the Effective Time, Merger Sub shall be merged with and into the Company.${BODY_FILLER}`,
    '',
    `1.2. Closing. The closing of the Merger shall take place at the offices of counsel to Parent.${BODY_FILLER} All conditions shall have been satisfied as set forth in`,
    `[[TOC_ENTRY]]Section 1.2|${collapsedSpan}|[[/TOC_ENTRY]]`,
    '[[/TOC_START]]',
    '',
    // Body that stayed OUTSIDE the block (marker-wrapped, like WF VII-IX).
    '[[ARTICLE]]ARTICLE III[[/ARTICLE]]',
    '',
    '[[ARTICLE_TITLE]]Termination[[/ARTICLE_TITLE]]',
    '',
    `3.1. Termination. This Agreement may be terminated at any time prior to the Effective Time by mutual written consent.${BODY_FILLER}`,
    '',
    'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.',
  ].join('\n');

  const cleaned = cleanText(doc);
  const { sections } = parseStructure(cleaned);
  const nums = sections.map((s) => String(s.number));

  // Articles I-II were inside the runaway block; III was outside it.
  for (const n of ['1.1', '1.2', '2.1', '3.1']) {
    assert.ok(nums.includes(n), `section ${n} recovered (got ${nums})`);
  }
  // The swallowed cross-reference ("Section 1.2|(b) of the...") must NOT
  // become a phantom heading — 1.2 appears exactly once.
  assert.equal(nums.filter((n) => n === '1.2').length, 1, 'no phantom 1.2');
  // The collapsed article boundary was re-broken: 2.1 carries its own title
  // and body, not a fragment of 1.2's text.
  const s21 = sections.find((s) => String(s.number) === '2.1');
  assert.match(s21.title || '', /Interim Operations/);
  // Near-total coverage: the block's body text was recovered, not deleted.
  const captured = sections.reduce((a, s) => a + (s.text || '').length, 0);
  assert.ok(captured / cleaned.length > 0.8, `text share ${(captured / cleaned.length).toFixed(2)} > 0.8`);
});

test('healthy TOC block (small, stray [[REF]] inside) is still dropped, not recovered', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    '[[TOC_START]]',
    'TABLE OF CONTENTS',
    '',
    '[[TOC_ENTRY]]Section 1.01|The Merger|3[[/TOC_ENTRY]]',
    '[[TOC_ENTRY]]Section 2.01|Conditions [[REF]]Section 1.01[[/REF]]|9[[/TOC_ENTRY]]',
    '[[/TOC_START]]',
    '',
    'AGREEMENT AND PLAN OF MERGER dated as of November 2, 2014, among BUYER CORPORATION and TARGET INC.',
    '',
    'WHEREAS, the parties intend to effect the acquisition of the Company;',
    '',
    'ARTICLE I',
    '',
    `Section 1.01. The Merger. Upon the terms and subject to the conditions set forth in this Agreement.${BODY_FILLER}`,
    '',
    'ARTICLE II',
    '',
    `Section 2.01. Conditions. The obligations of the parties shall be subject to the satisfaction of the following conditions.${BODY_FILLER}`,
  ].join('\n');

  const cleaned = cleanText(doc);
  assert.ok(!/TABLE OF CONTENTS/.test(cleaned), 'TOC block dropped');
  const { sections } = parseStructure(cleaned);
  const nums = sections.map((s) => String(s.number));
  assert.deepEqual(nums.sort(), ['1.01', '2.01']);
});

test('false preamble deep in the body does not hijack bodyStart (proximity guard)', () => {
  // Whole Foods shape: stub TOC, NO surviving preamble, bare-numbered body —
  // and a reference to ANOTHER contract's date deep in the body that matches
  // the preamble regex ("...Confidentiality Agreement, dated as of...").
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    'ARTICLE I', '', 'The Merger', '',
    '1.1.', '', 'The Merger', '',
    'ARTICLE II', '', 'Miscellaneous', '',
    '2.1.', '', 'Confidentiality', '',
    'Annex A',
    '',
    'ARTICLE I',
    '',
    'The Merger',
    '',
    `1.1. The Merger. Upon the terms and subject to the conditions set forth in this Agreement, at the Effective Time, Merger Sub shall be merged with and into the Company.${LONG_FILLER}`,
    '',
    'ARTICLE II',
    '',
    'Miscellaneous',
    '',
    `2.1. Confidentiality. The parties acknowledge the Confidentiality Agreement, dated as of April 27, 2017, by and between Parent and the Company, remains in full force.${BODY_FILLER}`,
  ].join('\n');

  const { sections, diagnostics } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  assert.ok(nums.includes('1.1'), `1.1 captured, bodyStart=${diagnostics && diagnostics.bodyStart} (got ${nums})`);
  const s11 = sections.find((s) => String(s.number) === '1.1');
  assert.ok((s11.text || '').length > 300, 'body text captured for 1.1, not a TOC stub');
});

test('preamble path falls back to a bare-numbered 1.1 when ARTICLE heading lines were lost (Dyax shape)', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    'The Merger; Closing; Effective Time', '',
    '1.1', '', 'The Merger', '',
    '',
    'WHEREAS, the board of directors of the Company has unanimously approved this Agreement;',
    '',
    // NO "ARTICLE I" line survives — only the bare-numbered section.
    'The Merger; Closing; Effective Time',
    '',
    `1.1 The Merger. Upon the terms and subject to the conditions set forth in this Agreement, and in accordance with the DGCL, at the Effective Time Merger Sub shall be merged with and into the Company.${LONG_FILLER}`,
    '',
    // The first surviving ARTICLE heading is far too late to anchor on.
    'ARTICLE VII',
    '',
    'Conditions',
    '',
    `7.1 Conditions to Each Party's Obligation to Effect the Merger. The respective obligation of each party is subject to the following conditions.${BODY_FILLER}`,
  ].join('\n');

  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  assert.ok(nums.includes('1.1'), `bodyStart anchored at bare 1.1, not ARTICLE VII (got ${nums})`);
  assert.ok(nums.includes('7.1'), `7.1 also captured (got ${nums})`);
});

test('repairWrappedHeadings: dangling bare number and wrapped titles are rejoined', () => {
  // "7.1\nConditions to..." — number dangling before its wrapped title.
  const dangling = 'Conditions\n\n 7.1\nConditions to Each Party\'s Obligation to Effect the Merger. The respective obligation of each party.';
  assert.match(
    repairWrappedHeadings(dangling),
    /7\.1 Conditions to Each Party's/,
    'dangling number joined to its title'
  );

  // ALL-CAPS title wrapped mid-way ("9.5 GOVERNING LAW...;\nSPECIFIC PERFORMANCE.").
  const caps = 'agreement.\n\n 9.5 GOVERNING LAW AND VENUE; WAIVER OF JURY TRIAL;\nSPECIFIC PERFORMANCE.\n\n (a) The parties agree.';
  assert.match(
    repairWrappedHeadings(caps),
    /9\.5 GOVERNING LAW AND VENUE; WAIVER OF JURY TRIAL; SPECIFIC PERFORMANCE\./,
    'wrapped ALL-CAPS title joined'
  );

  // Title-case title wrapped mid-way ("9.9 Obligations ... of the\nCompany.").
  const midTitle = 'date.\n\n 9.9 Obligations of Parent Holdco, Parent and of the\nCompany. Whenever this Agreement requires.';
  assert.match(
    repairWrappedHeadings(midTitle),
    /9\.9 Obligations of Parent Holdco, Parent and of the Company\./,
    'wrapped title-case title joined'
  );

  // A wrapped cross-reference at the end of a prose line must NOT be pulled
  // onto a heading-shaped line (no blank line before the number).
  const xref = 'the representations set forth in\nSection 4.08 are true and correct.';
  assert.equal(repairWrappedHeadings(xref), xref, 'prose cross-reference untouched');
});
