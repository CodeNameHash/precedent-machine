const test = require('node:test');
const assert = require('node:assert/strict');

const { parseStructure, cleanText } = require('../lib/parser-v2/structural');
const { buildLayers } = require('../lib/parser-v2/text-layers');
const { detectDefinedTermsTocRanges } = require('../lib/parser-v2/detectors/defined-terms-toc');
const { findEnactingClause } = require('../lib/parser-v2/invariants/enacting-hard-wall');
const { isLegalSentenceBoundary } = require('../lib/parser-v2/invariants/sentence-integrity');
const { listWouldContinueAcrossBoundary } = require('../lib/parser-v2/invariants/list-continuity');
const { isInvalidTerminator } = require('../lib/parser-v2/invariants/provision-completeness');

test('text layers clean structural noise while retaining raw offset mapping', () => {
  const raw = 'Alpha|\u200b word-\nbreak\nPage 2 of 9\n2.21 . Heading';
  const layers = buildLayers(raw);

  assert.equal(layers.rawText, raw);
  assert.match(layers.cleanText, /Alpha wordbreak/);
  assert.doesNotMatch(layers.cleanText, /Page 2 of 9/);
  assert.match(layers.cleanText, /2\.21\. Heading/);

  const cleanOffset = layers.cleanText.indexOf('Heading');
  assert.equal(raw.slice(layers.mapCleanToRaw(cleanOffset), layers.mapCleanToRaw(cleanOffset) + 7), 'Heading');
});

test('defined-terms TOC detector finds five-term reference runs', () => {
  const toc = [
    'INDEX OF DEFINED TERMS',
    'Acquisition Proposal Section 5.02',
    'Affiliate Section 1.01',
    'Business Day Section 1.01',
    'Company Material Adverse Effect Section 1.01',
    'Superior Proposal Section 5.02',
    '',
    'ARTICLE I',
    'DEFINITIONS',
  ].join('\n');

  const ranges = detectDefinedTermsTocRanges(toc);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].pairs, 5);
});

test('cleanText strips defined-terms TOC before body parsing', () => {
  const cleaned = cleanText(`
AGREEMENT AND PLAN OF MERGER

INDEX OF DEFINED TERMS
Acquisition Proposal Section 5.02
Affiliate Section 1.01
Business Day Section 1.01
Company Material Adverse Effect Section 1.01
Superior Proposal Section 5.02

NOW, THEREFORE, the parties agree as follows:

ARTICLE I
DEFINITIONS

Section 1.01. Definitions. "Affiliate" means any person that controls another person.
`);

  assert.doesNotMatch(cleaned, /Acquisition Proposal Section 5\.02/);
  const parsed = parseStructure(cleaned);
  assert.deepEqual(parsed.sections.map((section) => section.number), ['1.01']);
});

test('enacting clause is a hard wall before Article I body', () => {
  const cleaned = cleanText(`
AGREEMENT AND PLAN OF MERGER

WHEREAS, the Company approved the transaction.

ARTICLE I
RECITAL-STYLE MISLEADING HEADER

Section 1.01. Recital Fragment. This text is still pre-enacting recital material.

THE PARTIES AGREE AS FOLLOWS:

ARTICLE I
THE MERGER

Section 1.01. The Merger. The merger shall occur at the effective time.
`);

  const parsed = parseStructure(cleaned);
  assert.equal(findEnactingClause(cleaned).text, 'THE PARTIES AGREE AS FOLLOWS');
  assert.deepEqual(parsed.sections.map((section) => section.number), ['1.01']);
  assert.match(parsed.sections[0].text, /The merger shall occur/);
  assert.doesNotMatch(parsed.sections[0].text, /Recital Fragment/);
});

test('exhibit charter tail stops body parsing when signature marker is absent', () => {
  const cleaned = cleanText(`
AGREEMENT AND PLAN OF MERGER

NOW, THEREFORE, the parties agree as follows:

ARTICLE IX
MISCELLANEOUS

Section 9.01. Miscellaneous. This Agreement may be amended by written agreement of the parties.

EXHIBIT A
FORM OF CERTIFICATE OF INCORPORATION

Section 1.01. Name. The name of the corporation is CharterCo.
`);

  const parsed = parseStructure(cleaned);
  assert.deepEqual(parsed.sections.map((section) => section.number), ['9.01']);
  assert.equal(parsed.regions.some((region) => region.type === 'backmatter.exhibit'), true);
});

test('sentence and list invariants identify illegal cuts', () => {
  assert.equal(
    isLegalSentenceBoundary('The Company shall not solicit', 'or knowingly encourage any proposal.'),
    false,
  );
  assert.equal(
    isLegalSentenceBoundary('The Company shall not solicit.', 'Section 5.02. Access.'),
    true,
  );
  assert.equal(
    listWouldContinueAcrossBoundary('(a) first item.\n(b) second item.', '\n(c) third item.'),
    true,
  );
  assert.equal(
    isInvalidTerminator('subject to Section 6.4', '\n(a) continued clause.'),
    true,
  );
});
