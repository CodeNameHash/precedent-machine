const test = require('node:test');
const assert = require('node:assert/strict');

const {
  cleanText,
  parseStructure,
} = require('../lib/parser-v2/structural');

function parse(documentText) {
  const cleaned = cleanText(documentText);
  return { cleaned, parsed: parseStructure(cleaned) };
}

test('single-newline no-space body headings retain exact source indices', () => {
  const documentText = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '3.1',
    'Representations and Warranties of the Company',
    '4.3',
    'No Solicitation; Change in Recommendation',
    '5.2',
    'Additional Conditions to the Obligations of Parent',
    '',
    'NOW, THEREFORE, the parties agree as follows:',
    '',
    'ARTICLE III',
    'Representations and Warranties',
    '3.1Representations and Warranties of the Company. The Company represents and warrants to Parent as follows.',
    '3.2Capitalization. The authorised capital stock of the Company consists of common stock and preferred stock.',
    'ARTICLE IV',
    'Covenants',
    '4.3No Solicitation; Change in Recommendation. The Company shall not solicit a competing proposal.',
    'ARTICLE V',
    'Conditions',
    "5.2Additional Conditions to the Obligations of Parent, Titanium Merger Sub and Forward Merger Sub. Parent's obligations are subject to the following conditions.",
    'ARTICLE VI',
    'Termination',
    '6.1Termination Rights. This Agreement may be terminated in the circumstances stated below.',
  ].join('\n');
  const { cleaned, parsed } = parse(documentText);

  const expected = [
    ['3.1', 'Representations and Warranties of the Company'],
    ['3.2', 'Capitalization'],
    ['4.3', 'No Solicitation; Change in Recommendation'],
    ['5.2', 'Additional Conditions to the Obligations of Parent, Titanium Merger Sub and Forward Merger Sub'],
  ];
  for (const [number, title] of expected) {
    const heading = `${number}${title}.`;
    const section = parsed.sections.find((item) => item.number === number);
    assert.ok(section, `section ${number} must be detected`);
    assert.equal(section.title, title);
    assert.equal(section.startChar, cleaned.indexOf(heading));
    assert.equal(cleaned.slice(section.startChar, section.startChar + heading.length), heading);
  }

  assert.ok(
    parsed.sections.find((item) => item.number === '3.1').endChar
      <= parsed.sections.find((item) => item.number === '3.2').startChar,
  );
  assert.ok(
    parsed.sections.find((item) => item.number === '4.3').endChar
      <= parsed.sections.find((item) => item.number === '5.2').startChar,
  );
});

test('no-space detection rejects TOC rows, mid-line text and wrapped cross-references', () => {
  const documentText = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'TABLE OF CONTENTS',
    '3.1Representations and Warranties of the Company. 25',
    '4.9No Solicitation. 61',
    '5.2Additional Conditions to the Obligations of Parent. 88',
    '',
    'NOW, THEREFORE, the parties agree as follows:',
    '',
    'ARTICLE III',
    'Representations and Warranties',
    '3.1Representations and Warranties of the Company. The Company represents and warrants to Parent as follows.',
    'The Company considered 3.8Additional Conditions. This phrase is body text, not a heading.',
    'ARTICLE IV',
    'Covenants',
    '4.3No Solicitation; Change in Recommendation. The Company shall not solicit a competing proposal.',
    'The obligations remain subject to',
    '4.7No Other Remedy. This line is a wrapped cross-reference continuation, not a heading.',
    'ARTICLE V',
    'Conditions',
    "5.2Additional Conditions to the Obligations of Parent, Titanium Merger Sub and Forward Merger Sub. Parent's obligations are subject to the following conditions.",
    'ARTICLE VI',
    'Termination',
    '6.1Termination Rights. This Agreement may be terminated in the circumstances stated below.',
  ].join('\n');
  const { cleaned, parsed } = parse(documentText);
  const byNumber = new Map(parsed.sections.map((section) => [section.number, section]));

  for (const number of ['3.1', '4.3', '5.2']) {
    assert.ok(byNumber.has(number), `real body section ${number} must be detected`);
  }
  assert.equal(
    byNumber.get('3.1').startChar,
    cleaned.lastIndexOf('3.1Representations and Warranties of the Company.'),
  );
  assert.equal(
    byNumber.get('5.2').startChar,
    cleaned.lastIndexOf('5.2Additional Conditions to the Obligations of Parent,'),
  );
  for (const rejected of ['3.8', '4.7', '4.9']) {
    assert.equal(byNumber.has(rejected), false, `${rejected} must not become a section`);
  }
});
