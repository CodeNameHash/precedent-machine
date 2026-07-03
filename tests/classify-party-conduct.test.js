/* Tests for #28/#29: conduct-of-business IOC routing + parent-reps REP-B.
   Real section titles from Anadarko / Starwood / Red Hat. Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifySections, tryDeterministic } = require('../lib/parser-v2/classify');

// Stub client: if the AI is consulted it returns no classifications, so any
// assertion below proves the DETERMINISTIC/fixup path resolved the type.
const stubClient = { messages: { create: async () => ({ content: [{ text: '{"results":[]}' }] }) } };

const sec = (number, title, articleTitle, start) => ({
  number, title, heading: title, articleTitle,
  articleNumber: number.split('.')[0], startChar: start,
  text: `Section ${number} ${title}. ${'Substantive obligations of the parties follow herein. '.repeat(10)}`,
});

test('tryDeterministic: conduct titles route to IOC-T/IOC-B, parent-rep title to REP-B', () => {
  // Anadarko 5.1 (article COV) — no trailing "business"
  assert.equal(tryDeterministic(sec('5.1', 'Conduct of the Company', 'COVENANTS OF THE COMPANY', 0), 'COV').type, 'IOC-T');
  // Anadarko 6.1
  assert.equal(tryDeterministic(sec('6.1', 'Conduct of Parent', 'COVENANTS OF PARENT', 0), 'COV').type, 'IOC-B');
  // Starwood 4.1 (bare title in a generic COVENANTS article)
  assert.equal(tryDeterministic(sec('4.1', 'Conduct of Business', 'COVENANTS', 0), 'COV').type, 'IOC-T');
  // Red Hat 3.02 (party-less REP article defaults REP-T; section title must win)
  assert.equal(tryDeterministic(sec('3.02', 'Representations and Warranties of Parent and Sub', 'REPRESENTATIONS AND WARRANTIES', 0), 'REP-T').type, 'REP-B');
});

test('entity-named second rep section is re-tagged REP-B positionally (Starwood)', async () => {
  const articles = [{ number: 'III', title: 'REPRESENTATIONS AND WARRANTIES', startChar: 0 }];
  const sections = [
    sec('3.1', 'Representations and Warranties of Starwood', 'REPRESENTATIONS AND WARRANTIES', 100),
    sec('3.2', 'Representations and Warranties of Marriott', 'REPRESENTATIONS AND WARRANTIES', 5000),
  ];
  const out = await classifySections(sections, articles, stubClient);
  const byNum = Object.fromEntries(out.map((s) => [s.number, s.provisionType]));
  assert.equal(byNum['3.1'], 'REP-T', 'target reps (first) stay REP-T');
  assert.equal(byNum['3.2'], 'REP-B', 'buyer reps (second, entity-named) re-tagged REP-B');
});

test('separate per-party rep articles are untouched by the section fixup (Anadarko)', async () => {
  const articles = [
    { number: 'III', title: 'REPRESENTATIONS AND WARRANTIES OF THE COMPANY', startChar: 0 },
    { number: 'IV', title: 'REPRESENTATIONS AND WARRANTIES OF PARENT, MERGER SUBSIDIARY 1 AND MERGER SUBSIDIARY 2', startChar: 9000 },
  ];
  const sections = [
    sec('3.13', 'Litigation', 'REPRESENTATIONS AND WARRANTIES OF THE COMPANY', 100),
    sec('4.12', 'Litigation', 'REPRESENTATIONS AND WARRANTIES OF PARENT, MERGER SUBSIDIARY 1 AND MERGER SUBSIDIARY 2', 9100),
  ];
  const out = await classifySections(sections, articles, stubClient);
  const byNum = Object.fromEntries(out.map((s) => [s.number, s.provisionType]));
  assert.equal(byNum['3.13'], 'REP-T');
  assert.equal(byNum['4.12'], 'REP-B');
});

test('efforts-titled section beats its COV article (Metsera 6.03 -> ANTI)', () => {
  const s = { number: '6.03', title: 'Reasonable Best Efforts; Notification', heading: 'Reasonable Best Efforts; Notification', text: 'SECTION 6.03. Reasonable Best Efforts; Notification. (a) Upon the terms and subject to the conditions of this Agreement, each party shall use reasonable best efforts to take all actions necessary to consummate the Merger, including obtaining all antitrust approvals under the HSR Act.' };
  assert.equal(tryDeterministic(s, 'COV').type, 'ANTI');
  // A rep titled "Regulatory Matters" inside a REP article must NOT be yanked.
  const rep = { number: '3.17', title: 'Regulatory Matters', heading: 'Regulatory Matters', text: 'SECTION 3.17. Regulatory Matters. Except as would not have an MAE...' };
  assert.notEqual((tryDeterministic(rep, 'REP-T') || {}).type, 'ANTI');
});
