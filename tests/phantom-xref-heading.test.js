/* Regression tests for the phantom-heading class surfaced by the cross-deal
   sweep (Skechers / Mr. Cooper) — lib/parser-v2/structural.

   Failure mechanism: a WRAPPED cross-reference puts "Section X.Y" at the
   start of a line, followed by a lowercase parenthetical scope carve-out —
   "... would be prohibited by\nSection 5.2 (other than subsections 5.2(c),
   ...)" (Skechers 3.12(b)) or "... consistent with this\nSection 7.8
   (including the immediately foregoing sentence)" (Mr. Cooper 7.8). The
   scanner accepted it as a heading, so:
     1. the host section was TRUNCATED at the phantom, and
     2. when the phantom's number collided with a REAL section, the
        keep-first number dedupe kept the PHANTOM and silently dropped the
        real section (Skechers 5.2 "Forbearance Covenants" — the entire
        ~12k-char negative-covenant list — never reached classify/extract,
        leaving the deal with IOC=0).
   Two guards fix the class: a line-leading Section ref after a line ending
   in bare "by" is a wrapped passive cross-reference, and a heading title
   never opens with a lowercase parenthetical.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStructure } = require('../lib/parser-v2/structural');

const BODY_FILLER = ' The parties agree to the covenants and undertakings set forth herein, subject to the terms and conditions of this Agreement and applicable Law, in each case as more fully described below.'.repeat(3);

test('Skechers shape: wrapped "prohibited by\\nSection 5.2 (other than ..." is not a heading and the real 5.2 survives', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER, dated as of May 4, 2025 (this "Agreement"), among BEACH ACQUISITION CO PARENT, LLC, BEACH ACQUISITION MERGER SUB, INC. and SKECHERS U.S.A., INC.',
    '',
    'ARTICLE III',
    '',
    'REPRESENTATIONS AND WARRANTIES OF THE COMPANY',
    '',
    `3.11 No Undisclosed Liabilities. The Company Group has no liabilities of any nature except as disclosed in the Company SEC Reports.${BODY_FILLER}`,
    '',
    '3.12 Absence of Certain Changes.',
    '',
    '(a) Absence of Company Material Adverse Effect. Since January 1, 2025 through the date of this Agreement, there has not occurred a Company Material Adverse Effect.',
    '',
    '(b) Forbearance. Since January 1, 2025 through the date hereof, the Company has not taken any action that would be prohibited by',
    'Section 5.2 (other than subsections 5.2(c), 5.2(l), 5.2(p), 5.2(q) and 5.2(y) (to the extent related to the foregoing subsections)), if taken or proposed to be taken after the date hereof.',
    '',
    `3.13 Material Contracts. Section 3.13(a) of the Company Disclosure Letter contains a true, correct and complete list of all Material Contracts.${BODY_FILLER}`,
    '',
    'ARTICLE V',
    '',
    'INTERIM OPERATIONS OF THE COMPANY',
    '',
    `5.1 Affirmative Obligations. Except as expressly contemplated by this Agreement, the Company will maintain its existence in good standing pursuant to applicable law.${BODY_FILLER}`,
    '',
    `5.2 Forbearance Covenants. Except as set forth in Section 5.2 of the Company Disclosure Letter, the Company will not, and will not permit any of its Subsidiaries, to: (a) amend the Charter, the Bylaws, or any other similar organizational document; (b) propose or adopt a plan of complete or partial liquidation.${BODY_FILLER}`,
    '',
    `5.3 No Solicitation. Subject to the terms of Section 5.3(b), the Company Group will not solicit any Acquisition Proposal.${BODY_FILLER}`,
  ].join('\n');

  const { sections } = parseStructure(doc);
  const byNum = Object.fromEntries(sections.map((s) => [s.number, s]));

  // The REAL 5.2 (Forbearance Covenants) is kept — not the phantom.
  assert.ok(byNum['5.2'], 'section 5.2 exists');
  assert.match(byNum['5.2'].title, /Forbearance Covenants/, 'real 5.2 wins over the phantom cross-reference');
  assert.match(byNum['5.2'].text, /will not permit any of its Subsidiaries/, 'forbearance body attached to 5.2');

  // 3.12 is not truncated at the wrapped cross-reference.
  assert.match(byNum['3.12'].text, /if taken or proposed to be taken after the date hereof/, '3.12 keeps its full text past the wrapped Section 5.2 reference');

  // 5.1 ends at the REAL 5.2 heading, not by swallowing it.
  assert.match(byNum['5.1'].text, /maintain its existence in good standing/);
  assert.ok(!/Forbearance Covenants\. Except/.test(byNum['5.1'].text), '5.1 does not swallow the 5.2 body');
});

test('Mr. Cooper shape: "consistent with this\\nSection 7.8 (including ..." does not truncate the host section', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER, dated as of March 31, 2025 (this "Agreement"), among ROCKET COMPANIES, INC. and MR. COOPER GROUP INC.',
    '',
    'ARTICLE VII',
    '',
    'ADDITIONAL AGREEMENTS',
    '',
    [
      `7.8 No Solicitation. Maverick will not solicit any Acquisition Proposal.${BODY_FILLER}`,
      'Any disclosure regarding an Acquisition Proposal shall not be a Change in the Maverick Recommendation so long as any action taken or statement made is consistent with this',
      `Section 7.8 (including the immediately foregoing sentence) and provided that any such disclosure shall not permit the Board of Directors of Maverick to make a Change in the Maverick Recommendation except pursuant to Section 5.2.${BODY_FILLER}`,
    ].join('\n'),
    '',
    `7.9 Access to Information. Each party shall afford the other reasonable access to its books and records.${BODY_FILLER}`,
  ].join('\n');

  const { sections } = parseStructure(doc);
  const byNum = Object.fromEntries(sections.map((s) => [s.number, s]));

  assert.ok(byNum['7.8'], 'section 7.8 exists');
  assert.match(byNum['7.8'].text, /including the immediately foregoing sentence/, '7.8 keeps the text after the wrapped self-reference');
  assert.match(byNum['7.8'].text, /except pursuant to Section 5\.2/, '7.8 runs to its true end');
  assert.ok(byNum['7.9'], 'next section still detected');
});
