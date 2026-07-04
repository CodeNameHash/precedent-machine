// Regression tests for splitTermrSubClauseRomans in lib/parser-v2/extract.js.
//
// Metsera §8.01(b) bundles TWO distinct termination rights into one lettered
// sub-clause: (i) the outside-date right and (ii) the right to terminate if
// "any Legal Restraint permanently preventing or prohibiting consummation of
// the Merger shall be in effect and shall have become final and
// non-appealable". splitSubClauses' skipRoman guard (needed so date
// mechanics like "the earlier of (x) ... and (y) ..." don't fragment) left
// the whole (b) sub-clause as ONE provision that could only carry ONE
// canonical code — TERMR-OUTSIDE — so the review page falsely showed the
// Legal Restraint termination right as "Not present". This pre-split fires
// on the roman-enumerated limbs of an already-lettered TERMR sub-clause and
// reuses the SAME enumerated-run machinery merged for the offer-condition
// annex splitter in PR #68 (findEnumeratedMarkers + longestMonotonicRun).
const test = require('node:test');
const assert = require('node:assert/strict');

const { splitSubClauses, splitTermrSubClauseRomans } = require('../lib/parser-v2/extract.js');

// Metsera-shaped §8.01: (a) mutual consent, (b) outside date / legal
// restraint (bundled via roman numerals — the real-world failure shape),
// (c) target breach. Roman items sit on their own line, as EDGAR's
// paragraph structure for these enumerated sub-clauses typically renders.
const SECTION_8_01 = [
  'SECTION 8.01. Termination. This Agreement may be terminated and the ' +
    'Merger contemplated hereby may be abandoned at any time prior to the ' +
    'Effective Time, whether before or after receipt of the Company ' +
    'Stockholder Approval, by action taken or authorized by the Board of ' +
    'Directors of the terminating party, as follows:',
  '(a) by mutual written consent of Parent and the Company;',
  '(b) by either Parent or the Company, if:\n\n' +
    '(i) the Effective Time shall not have occurred on or before June 30, ' +
    '2027 (the "Outside Date"); provided that the right to terminate this ' +
    'Agreement pursuant to this clause (i) shall not be available to any ' +
    'party whose failure to perform any of its obligations under this ' +
    'Agreement has been a principal cause of the failure of the Effective ' +
    'Time to occur by the Outside Date; or\n\n' +
    '(ii) any Legal Restraint permanently preventing or prohibiting ' +
    'consummation of the Merger shall be in effect and shall have become ' +
    'final and non-appealable;',
  '(c) by the Company, if Parent or Merger Sub has breached any ' +
    'representation, warranty, covenant or agreement, subject to the cure ' +
    'and materiality qualifications set forth herein;',
].join('\n\n');

test('Metsera 8.01(b): splitSubClauses splits the bundled outside-date/legal-restraint sub-clause into two TERMR parts', () => {
  const parts = splitSubClauses(SECTION_8_01, 'TERMR');
  assert.ok(parts, 'should split');
  const letters = parts.map((p) => p.letter);
  assert.deepEqual(letters, ['_preamble', 'a', 'b.i', 'b.ii', 'c']);

  const outsideDate = parts.find((p) => p.letter === 'b.i');
  const legalRestraint = parts.find((p) => p.letter === 'b.ii');
  assert.ok(/Outside Date/.test(outsideDate.text));
  assert.ok(/Legal Restraint permanently preventing/.test(legalRestraint.text));

  // Verbatim discipline: every part is an exact substring of the source.
  for (const p of parts) {
    assert.ok(SECTION_8_01.includes(p.text), `part ${p.letter} must be a verbatim substring`);
  }
});

test('the Legal Restraint limb is its own provision, distinct from the Outside Date limb', () => {
  const parts = splitSubClauses(SECTION_8_01, 'TERMR');
  const legalRestraint = parts.find((p) => p.letter === 'b.ii');
  assert.ok(legalRestraint);
  assert.ok(!/Outside Date/.test(legalRestraint.text), 'Legal Restraint limb should not carry the outside-date text');
});

test('splitTermrSubClauseRomans returns null for a single-right sub-clause (no false positive)', () => {
  const single = '(c) by the Company, if Parent or Merger Sub has breached any representation, warranty, covenant or agreement.';
  assert.equal(splitTermrSubClauseRomans(single), null);
});

test('splitTermrSubClauseRomans does not fire on mid-sentence cross-references to romans', () => {
  // "clauses (i) and (ii)" is a cross-reference inside running prose, not a
  // top-level enumerated structure — findEnumeratedMarkers' anchoring
  // (marker must open a line or follow ". ") already guards this; confirm it
  // holds through the TERMR-specific wrapper too.
  const text = '(b) by either Parent or the Company, if the condition set forth in clauses (i) and (ii) of Section 4.01 is not satisfied by the Outside Date.';
  assert.equal(splitTermrSubClauseRomans(text), null);
});

test('a non-TERMR type is untouched by the roman-limb refinement (only isTermrType triggers it)', () => {
  const parts = splitSubClauses(SECTION_8_01, 'REP-T');
  // REP-T isn't a Strategy-A splittable shape in practice, but the refinement
  // block itself is gated on isTermrType — confirm no 'b.i'/'b.ii' compound
  // letters appear when the type isn't TERMR-family.
  if (parts) {
    const letters = parts.map((p) => p.letter);
    assert.ok(!letters.includes('b.i'));
  }
});
