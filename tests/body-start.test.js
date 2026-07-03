/* Tests for findBodyStart's preamble-anchor path (lib/parser-v2/structural).
   Guards the CSRA/Covance failure class: the same-line-content cascade either
   rejected every body article (CSRA: short section titles -> body start landed
   at Article IX, 96% of the doc discarded) or accepted TOC entries as body
   (Covance: long TOC titles -> every "section" was a stub). Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStructure, cleanText } = require('../lib/parser-v2/structural');

const BODY_FILLER = ' The parties agree to the covenants and undertakings set forth herein, subject to the terms and conditions of this Agreement and applicable Law, in each case as more fully described below.'.repeat(3);

test('CSRA-shape: short same-line section titles after a stub TOC still segment from Article I', () => {
  // TOC = number on its own line, title on the next (stub layout).
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    'ARTICLE I', '', 'DEFINITIONS', '',
    'Section 1.1', '', 'Definitions', '',
    'Section 2.1', '', 'The Offer', '',
    'Section 9.1', '', 'Amendments and Waivers', '',
    '',
    'This AGREEMENT AND PLAN OF MERGER, dated as of February 9, 2018, is by and among BUYER INC. and TARGET INC.',
    '',
    'WHEREAS, the parties intend to effect the acquisition of the Company;',
    '',
    'ARTICLE I',
    '',
    `Section 1.1 Definitions.${BODY_FILLER}`,
    '',
    'ARTICLE II',
    '',
    // Body header with a SHORT same-line title — the old cascade rejected this.
    `Section 2.1 The Offer.${BODY_FILLER}`,
    '',
    'ARTICLE IX',
    '',
    `Section 9.1 Amendments and Waivers. Subject to the provisions of applicable Law.${BODY_FILLER}`,
  ].join('\n');
  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  assert.ok(nums.includes('1.1') && nums.includes('2.1') && nums.includes('9.1'), `got ${nums}`);
  // The 2.1 section must carry BODY text, not a TOC stub.
  const s21 = sections.find((s) => String(s.number) === '2.1');
  assert.ok((s21.text || '').length > 300, 'body text captured for 2.1');
});

test('Kraft-shape: headerless stub TOC + wrapped SECTION headings anchor from the preamble', () => {
  // Fifth format variant (Heinz/Kraft 2015): NO "TABLE OF CONTENTS" header
  // anywhere, TOC stubs with the "SECTION" prefix and the title on the NEXT
  // line, body headings whose titles are hard-wrapped onto the next line
  // ("SECTION 1.01.\nThe Merger. (a) On the terms ..."), and NO "ARTICLE"
  // heading lines at all (articles are bare title lines). No heading has
  // same-line content, so the legacy sec-1.01 cascade scanned past the whole
  // agreement and anchored the body inside the defined-terms index.
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'Among',
    '',
    'BUYER HOLDING CORPORATION,',
    '',
    'MERGER SUB LLC',
    '',
    'AND',
    '',
    'TARGET GROUP, INC.',
    '',
    'Dated as', // cover date split across lines — must not anchor the preamble
    'of March 24, 2015',
    '',
    // Headerless TOC (stub layout: SECTION line, title on the next line).
    'The Merger',
    '',
    'SECTION 1.01.', '', 'The Merger', '',
    'SECTION 1.02.', '', 'Closing', '',
    'Conditions Precedent',
    '',
    'SECTION 7.01.', '', "Conditions to Each Party's Obligations", '',
    '',
    'AGREEMENT AND PLAN OF MERGER, dated as of March 24, 2015 (this "Agreement"), among BUYER HOLDING CORPORATION, MERGER SUB LLC and TARGET GROUP, INC.',
    '',
    'WHEREAS the respective boards of directors have approved this Agreement;',
    '',
    'The Merger',
    '',
    ' SECTION 1.01.',
    `The Merger. (a) On the terms and subject to the conditions set forth in this Agreement, Merger Sub shall be merged with and into the Company.${BODY_FILLER}`,
    '',
    ' SECTION 1.02.',
    `Closing. The closing of the Merger shall take place at 9:00 a.m. on the third Business Day.${BODY_FILLER}`,
    '',
    'Conditions Precedent',
    '',
    ' SECTION 7.01.',
    `Conditions to Each Party's Obligations. The obligations of the parties are subject to the satisfaction of the following conditions.${BODY_FILLER}`,
  ].join('\n');
  const { sections, articles } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  assert.ok(nums.includes('1.01') && nums.includes('1.02') && nums.includes('7.01'), `got ${nums}`);
  const s101 = sections.find((s) => String(s.number) === '1.01');
  assert.ok(/On the terms/.test(s101.text || ''), '1.01 carries body prose, not the TOC stub');
  assert.ok((s101.text || '').length > 300, 'body text captured for 1.01');
  // Articles are synthesized from the bare title lines before each X.01.
  const artI = articles.find((a) => String(a.number) === 'I');
  assert.ok(artI && /The Merger/.test(artI.title || ''), 'article I synthesized with its title line');
});

test('no-TOC doc: a false "dated as of" inside Definitions does not hijack the preamble anchor', () => {
  // Bioverativ shape: the real preamble was lost at ingest, the document
  // opens directly at "Section 1.01. Definitions." and a defined term deep
  // in the definitions ("...non-disclosure agreement, dated as of...")
  // matches the preamble regex. A true preamble always PRECEDES the first
  // substantive body heading, so the anchor must be rejected here.
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'ARTICLE 1',
    '',
    'DEFINITIONS',
    '',
    `Section 1.01. Definitions. (a) As used herein, the following terms have the following meanings: "Confidentiality Agreement" means the non-disclosure agreement, dated as of December 4, 2017, between Parent and the Company.${BODY_FILLER}`,
    '',
    `Section 1.02. Other Definitional and Interpretative Provisions. The words "hereof" and "hereunder" refer to this Agreement as a whole.${BODY_FILLER}`,
    '',
    'ARTICLE 2',
    '',
    'THE OFFER',
    '',
    `Section 2.01. The Offer. Subject to the conditions of this Agreement, Buyer shall commence a tender offer for all outstanding shares.${BODY_FILLER}`,
  ].join('\n');
  const { sections } = parseStructure(cleanText(doc));
  const nums = sections.map((s) => String(s.number));
  for (const n of ['1.01', '1.02', '2.01']) {
    assert.ok(nums.includes(n), `section ${n} captured (got ${nums})`);
  }
  const s101 = sections.find((s) => String(s.number) === '1.01');
  assert.ok((s101.text || '').length > 300, '1.01 not truncated by a false preamble anchor');
});

test('Covance-shape: TOC entries with long same-line titles are not mistaken for the body', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '',
    // TOC entries with LONG same-line titles — the old cascade accepted these.
    'Section 1.01. The Merger',
    'Section 1.05. Certificate of Incorporation and Bylaws of the Surviving Corporation',
    'Section 3.01. Representations and Warranties of the Company',
    '',
    'AGREEMENT AND PLAN OF MERGER dated as of November 2, 2014, among BUYER CORPORATION and TARGET INC.',
    '',
    'ARTICLE I',
    '',
    `Section 1.01. The Merger.${BODY_FILLER}`,
    '',
    `Section 1.05. Certificate of Incorporation and Bylaws of the Surviving Corporation.${BODY_FILLER}`,
    '',
    'ARTICLE III',
    '',
    `Section 3.01. Representations and Warranties of the Company. Except as disclosed, the Company represents:${BODY_FILLER}`,
  ].join('\n');
  const { sections } = parseStructure(cleanText(doc));
  const s101 = sections.find((s) => String(s.number) === '1.01');
  assert.ok(s101, 'section 1.01 found');
  assert.ok((s101.text || '').length > 300, `1.01 must carry body text, got ${(s101.text || '').length} chars (TOC stub bug)`);
});
