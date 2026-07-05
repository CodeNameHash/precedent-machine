const test = require('node:test');
const assert = require('node:assert/strict');
const { splitSubClauses, splitUmbrellaRepSections, extractTitledSubclauses } = require('../lib/parser-v2/extract');

const FILLER = ' The representation continues with source text and qualifications that make this section long enough to be treated as an umbrella section rather than a short enumerated list.'.repeat(8);

test('umbrella rep splitter accepts no-space lettered headings like (a)Organization', () => {
  const text = [
    '3.1Representations and Warranties of the Company. Except as set forth in the Company Disclosure Letter, the Company represents and warrants that:',
    `(a)Organization, Good Standing and Qualification.${FILLER}`,
    `(b)Capital Structure.${FILLER}`,
    `(c)Corporate Authority and Approval.${FILLER}`,
    `(d)Governmental Filings; No Violations; Certain Contracts.${FILLER}`,
    `(e)Company Reports; Financial Statements.${FILLER}`,
    `(f)Absence of Certain Changes.${FILLER}`,
  ].join('\n\n');

  const titled = extractTitledSubclauses(text);
  assert.deepEqual(titled.map((part) => part.title), [
    'Organization, Good Standing and Qualification',
    'Capital Structure',
    'Corporate Authority and Approval',
    'Governmental Filings; No Violations; Certain Contracts',
    'Company Reports; Financial Statements',
    'Absence of Certain Changes',
  ]);

  const split = splitUmbrellaRepSections([{
    provision_type: 'REP-T',
    number: '3.1',
    sectionNumber: '3.1',
    title: 'Representations and Warranties of the Company',
    text,
    startChar: 1000,
  }]);

  assert.equal(split.length, 7);
  assert.equal(split[0]._umbrellaPreamble, true);
  assert.equal(split[1].sectionNumber, '3.1(a)');
  assert.equal(split[1].title, 'Organization, Good Standing and Qualification');
  assert.equal(split[6].sectionNumber, '3.1(f)');
});

test('subclause splitter accepts no-space condition limbs like (a)(i)The Company', () => {
  const text = [
    "5.2Additional Conditions to the Obligations of Parent, Titanium Merger Sub and Forward Merger Sub. The obligations of Parent to effect the Mergers are subject to the following conditions:",
    '',
    '(a)',
    '',
    '(i)The Company shall have performed in all material respects all of its obligations required to be performed by it prior to the Closing Date;',
    '',
    '(ii)The representations and warranties of the Company shall be true and correct at and as of the Closing Date;',
    '',
    '(iii)No Company Material Adverse Effect shall have occurred since the date of this Agreement.',
    '',
    '(b)Parent shall have received a certificate of the Company certifying that the conditions have been satisfied.',
  ].join('\n');

  const parts = splitSubClauses(text, 'COND-B');
  assert.ok(parts, 'condition section splits');
  assert.deepEqual(parts.map((part) => part.letter), ['_preamble', 'a', 'b']);
  assert.match(parts[1].text, /\(i\)The Company/);
  assert.match(parts[2].text, /^\(b\)Parent/);
});
