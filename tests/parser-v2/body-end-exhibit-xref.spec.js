const test = require('node:test');
const assert = require('node:assert/strict');

const { parseStructure } = require('../../lib/parser-v2/structural');

// Catalent 2026-07-17: a hard-wrapped in-body cross-reference
// ("...amended and restated to conform to\nExhibit B; and") matched the
// line-leading Exhibit pattern in findBodyEnd and truncated the parse to
// Article I — 6 sections out of 92, zero reps/conds extracted. Exhibit
// markers must be blank-line-anchored heading shapes, not any line-leading
// "Exhibit X".

function agreementText() {
  const filler = (label) =>
    `The parties hereto agree, represent, and covenant with respect to ${label} matters as set forth herein, ` +
    'including obligations that survive the Effective Time to the fullest extent permitted by applicable Law.';
  return [
    'AGREEMENT AND PLAN OF MERGER',
    'This AGREEMENT AND PLAN OF MERGER is entered into by the parties. NOW, THEREFORE, the parties agree as follows:',
    'ARTICLE I',
    'THE MERGER',
    `Section 1.01 The Merger. ${filler('merger')}`,
    // The wrapped cross-reference that used to truncate the body: a
    // line-LEADING "Exhibit B" that is not a heading.
    'Section 1.02 Organizational Documents. The certificate of incorporation of the Surviving Corporation shall be amended and restated to conform to\nExhibit B; and the bylaws shall be amended as provided herein.',
    'ARTICLE II',
    'REPRESENTATIONS AND WARRANTIES',
    `Section 2.01 Organization. ${filler('organization')}`,
    `Section 2.02 Authority. ${filler('authority')}`,
    'ARTICLE III',
    'COVENANTS',
    `Section 3.01 Conduct of Business. ${filler('interim operating')}`,
    'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.',
    'Exhibit A',
    'FORM OF CHARTER',
  ].join('\n\n');
}

test('wrapped in-body "Exhibit B" cross-reference does not truncate the body', () => {
  const { sections, diagnostics } = parseStructure(agreementText());
  const numbers = sections.map((s) => s.number);
  // Sections AFTER the wrapped Exhibit B cross-reference must still parse.
  assert.ok(numbers.includes('2.01'), `expected 2.01 in ${numbers}`);
  assert.ok(numbers.includes('3.01'), `expected 3.01 in ${numbers}`);
  // The real trailing block (witness clause / Exhibit A heading) still ends the body.
  const text = agreementText();
  assert.ok(diagnostics.bodyEnd <= text.indexOf('IN WITNESS WHEREOF') + 30,
    `bodyEnd ${diagnostics.bodyEnd} should not extend past the witness clause`);
});

test('a genuine blank-line-anchored Exhibit heading still ends the body', () => {
  // Same agreement but WITHOUT a witness clause — the Exhibit A heading is
  // the only trailing marker and must still terminate the body.
  const text = agreementText().replace(/IN WITNESS WHEREOF[^\n]*\n\n/, '');
  const { diagnostics } = parseStructure(text);
  assert.ok(diagnostics.bodyEnd <= text.indexOf('\nExhibit A') + 12,
    `bodyEnd ${diagnostics.bodyEnd} should stop at the Exhibit A heading (at ${text.indexOf('\nExhibit A')})`);
});
