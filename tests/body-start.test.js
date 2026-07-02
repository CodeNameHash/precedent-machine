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
