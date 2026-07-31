'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveCitationForSpan,
  parseCitationComponents,
  citationFromComponents,
  checkCitationConstructibility,
} = require('../lib/canonical-v2/native-producer/citation-constructibility');
const { sectionizeAdmittedSource } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

// ─── Component parsing. ───

test('parseCitationComponents splits a decimal section number from its trailing limb labels', () => {
  assert.deepEqual(parseCitationComponents('3.1(b)(i)'), ['3.1', '(b)', '(i)']);
  assert.deepEqual(parseCitationComponents('Section 3.1(b)(i)'), ['3.1', '(b)', '(i)']);
  assert.deepEqual(parseCitationComponents('3.1 (b) (i)'), ['3.1', '(b)', '(i)']);
  assert.deepEqual(parseCitationComponents('III-INTRO(b)(i)'), ['III-INTRO', '(b)', '(i)']);
  assert.deepEqual(parseCitationComponents('(b)(i)'), ['(b)', '(i)']);
});

test('citationFromComponents reassembles the sectionizer\'s own concatenated format', () => {
  assert.equal(citationFromComponents(['3.1', '(b)', '(i)']), '3.1(b)(i)');
});

// ─── deriveCitationForSpan: deepest containing node wins. ───

test('deriveCitationForSpan picks the deepest node whose span contains the query span', () => {
  const tree = [
    { section_id: 'root', reference: null, depth: 0, start: 0, end: 100 },
    { section_id: 'article', reference: 'ARTICLE III', depth: 1, start: 0, end: 100 },
    { section_id: 'section', reference: '3.1', depth: 2, start: 10, end: 90 },
    { section_id: 'limb-b', reference: '3.1(b)', depth: 3, start: 20, end: 60 },
    { section_id: 'limb-b-i', reference: '3.1(b)(i)', depth: 4, start: 25, end: 40 },
  ];
  const derived = deriveCitationForSpan(tree, 26, 35);
  assert.equal(derived.section_id, 'limb-b-i');

  const derivedAtLimbB = deriveCitationForSpan(tree, 20, 60);
  assert.equal(derivedAtLimbB.section_id, 'limb-b', 'an exact span match resolves to the node owning that exact span');

  assert.equal(deriveCitationForSpan(tree, -5, 200), null, 'no node contains a span wider than the document');
});

// ─── The real sectionizer's degenerate case: NO "Section X.XX" numbering
// anywhere, exactly the F28 live-run document shape. ───

function buildDegenerateTree() {
  const text = [
    'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
    '(a)Organization; Standing. The Company is duly organized.\n\n',
    '(b)Capital Structure.\n',
    '(i)The authorized capital stock of the Company consists of 100,000,000 shares.\n',
    '(ii)There are no other outstanding equity securities.\n',
  ].join('');
  const documentHash = sha256Hex(Buffer.from(text, 'utf8'));
  return { tree: sectionizeAdmittedSource({ source_text: text, document_hash: documentHash }), text };
}

test('a "3.1(b)(i)"-style citation is CITATION_NOT_CONSTRUCTIBLE against a document with no decimal section numbering at all', () => {
  const { tree } = buildDegenerateTree();
  const governingNode = tree.nodes.find((n) => n.reference && n.reference.endsWith('(b)'));
  assert.ok(governingNode, 'sanity: the sectionizer found the (b) subsection under its synthetic ARTICLE numbering');
  assert.notEqual(governingNode.reference, '3.1(b)', 'sanity: this document genuinely has no real "3.1" section number');

  const derived = deriveCitationForSpan(tree, governingNode.start, governingNode.end);
  const check = checkCitationConstructibility({
    tree,
    model_citation: '3.1(b)(i)',
    derived_node: derived,
  });

  assert.equal(check.status, 'CITATION_NOT_CONSTRUCTIBLE');
  assert.equal(check.model_citation, '3.1(b)(i)');
  assert.equal(check.derived_citation, governingNode.reference);
  assert.equal(check.resolved_section_id, null);
});

test('a citation matching the governing node\'s own discovered reference is AGREEMENT', () => {
  const { tree } = buildDegenerateTree();
  const governingNode = tree.nodes.find((n) => n.reference && n.reference.endsWith('(b)'));
  const derived = deriveCitationForSpan(tree, governingNode.start, governingNode.end);

  const check = checkCitationConstructibility({
    tree,
    model_citation: governingNode.reference,
    derived_node: derived,
  });
  assert.equal(check.status, 'AGREEMENT');
});

// ─── THE POSITIVE CASE: a citation that is constructible from real
// hierarchy, even though the concatenated string appears NOWHERE in the
// source text -- this is the case that proves the rule (constructibility,
// not literal presence) is correct, not merely permissive. ───

test('a real "3.1(c)(i)" hierarchy makes that citation constructible even though the concatenated string is nowhere in the source text', () => {
  const text = [
    'Section 3.1 Representations Concerning the Company.\n\n',
    '(a)Organization. The Company is duly organized.\n\n',
    '(b)Authority. The Company has full corporate power.\n\n',
    '(c)Capital Structure.\n',
    '(i)The authorized capital stock of the Company consists of shares of common stock.\n',
    '(ii)There are no other outstanding equity securities.\n',
  ].join('');
  assert.ok(!text.includes('3.1(c)(i)'), 'sanity: the concatenated citation is not a literal substring of the source');

  const documentHash = sha256Hex(Buffer.from(text, 'utf8'));
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: documentHash });

  const limbCI = tree.nodes.find((n) => n.reference === '3.1(c)(i)');
  assert.ok(limbCI, 'sanity: the sectionizer constructed 3.1(c)(i) from real "Section 3.1" + "(c)" + "(i)" structure');

  const derived = deriveCitationForSpan(tree, limbCI.start, limbCI.end);
  const check = checkCitationConstructibility({
    tree,
    model_citation: '3.1(c)(i)',
    derived_node: derived,
  });
  assert.equal(check.status, 'AGREEMENT', 'constructibility, not literal presence, is the test');
});

// ─── CITATION_DISAGREEMENT: the model's citation is real, just the wrong node. ───

test('a citation resolving to a DIFFERENT real node than the derived one is CITATION_DISAGREEMENT', () => {
  const { tree } = buildDegenerateTree();
  const bNode = tree.nodes.find((n) => n.reference && n.reference.endsWith('(b)'));
  const aNode = tree.nodes.find((n) => n.reference && n.reference.endsWith('(a)'));
  assert.ok(bNode && aNode && bNode.section_id !== aNode.section_id);

  const derivedForB = deriveCitationForSpan(tree, bNode.start, bNode.end);
  const check = checkCitationConstructibility({
    tree,
    model_citation: aNode.reference,
    derived_node: derivedForB,
  });
  assert.equal(check.status, 'CITATION_DISAGREEMENT');
  assert.equal(check.resolved_section_id, aNode.section_id);
  assert.equal(check.derived_section_id, bNode.section_id);
});

// ─── Nothing to check. ───

test('checkCitationConstructibility returns null when no citation is supplied', () => {
  assert.equal(checkCitationConstructibility({ tree: [], model_citation: null }), null);
  assert.equal(checkCitationConstructibility({ tree: [], model_citation: '' }), null);
  assert.equal(checkCitationConstructibility({ tree: [], model_citation: undefined }), null);
});
