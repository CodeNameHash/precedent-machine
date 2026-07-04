// Regression test for the TERMF TRIGGER RULES prompt block in
// lib/parser-v2/extract.js. Trigger "label" is LLM-authored free text, so it
// can't be unit-tested by calling a function — this pins the PROMPT CONTRACT
// itself (same source-scanning pattern used by tests/review-layout.test.js
// for wiring contracts that live in prose, not pure functions), so a future
// edit can't silently re-loosen the rule.
//
// Audit finding: labels still led with the section cite — "Company
// terminates the Agreement pursuant to Section 8.01(f), its termination
// right associated with accepting a Superior Proposal" — instead of the
// plain-English action a partner would say ("Company terminates to accept a
// Superior Proposal"). The cite belongs ONLY in the verbatim "text" field.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'parser-v2', 'extract.js'),
  'utf8'
);

test('TRIGGER RULES requires the label to START with the plain-English action', () => {
  assert.match(src, /label"?\s+MUST START with the plain-English action/);
});

test('TRIGGER RULES forbids a cross-reference cite ANYWHERE in the label, not just as the whole label', () => {
  assert.match(src, /cross-reference cite is FORBIDDEN ANYWHERE in "label"/);
});

test('TRIGGER RULES includes the exact negative example from the audit (leading cite + trailing description)', () => {
  assert.ok(
    src.includes(
      '"Company terminates the Agreement pursuant to Section 8.01(f), its termination right associated with accepting a Superior Proposal" is WRONG'
    ),
    'the audit-flagged bad label must appear verbatim as a WRONG example'
  );
});

test('TRIGGER RULES still gives the corrected plain-English label for the same example', () => {
  assert.ok(
    src.includes('the correct label is "Company terminates to accept a Superior Proposal"')
  );
});
