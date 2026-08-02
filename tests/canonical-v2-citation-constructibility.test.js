'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  deriveCitationForSpan,
  parseCitationComponents,
  citationFromComponents,
  checkCitationConstructibility,
  resolveQuoteOccurrence,
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

// ─── Tie-break: a decimal SECTION lineage node outranks a straddling
// non-decimal (e.g. legacy "III-INTRO"-style) node REGARDLESS OF DEPTH
// (Skechers-first-live-run defect). Synthetic reproduction of the exact
// failure shape: a legacy lettered node whose span STRADDLES (fully
// contains) a minted decimal SECTION node nested well inside it, and is
// DEEPER than that decimal SECTION -- depth alone would incorrectly pick the
// legacy node. ───

test('a decimal SECTION node outranks a deeper, straddling non-decimal node -- the Skechers defect, reproduced synthetically', () => {
  const tree = [
    { section_id: 'root', reference: null, depth: 0, start: 0, end: 1000 },
    { section_id: 'article', reference: 'ARTICLE III', depth: 1, start: 0, end: 1000 },
    // The legacy, straddling node: a non-decimal SECTION ("III-INTRO") whose
    // own lettered-subsection walk goes several levels deep and whose span
    // fully contains the minted decimal SECTION below it -- exactly the
    // Skechers "III-INTRO(d)" shape.
    {
      section_id: 'legacy-section', reference: 'III-INTRO', depth: 2, start: 0, end: 1000,
    },
    {
      section_id: 'legacy-a', reference: 'III-INTRO(a)', depth: 3, start: 0, end: 1000,
    },
    {
      section_id: 'legacy-b', reference: 'III-INTRO(a)(b)', depth: 4, start: 0, end: 1000,
    },
    {
      section_id: 'legacy-c', reference: 'III-INTRO(a)(b)(c)', depth: 5, start: 0, end: 1000,
    },
    // DEEPER than the minted decimal SECTION below (depth 6 vs depth 3),
    // and its span straddles/contains the minted SECTION's span entirely --
    // this is the node the OLD depth-only tie-break incorrectly picked.
    {
      section_id: 'legacy-d', reference: 'III-INTRO(a)(b)(c)(d)', depth: 6, start: 200, end: 400,
    },
    // The minted decimal SECTION ("3.7"), nested well inside the legacy
    // straddling node's span, but SHALLOWER.
    {
      section_id: 'decimal-section', reference: '3.7', depth: 3, start: 250, end: 350,
    },
  ];

  // A query span squarely inside BOTH the legacy straddling node (depth 6)
  // AND the minted decimal SECTION (depth 3): depth alone would pick
  // 'legacy-d'; the decimal-lineage class preference must pick
  // 'decimal-section' instead, regardless of the depth gap.
  const derived = deriveCitationForSpan(tree, 260, 300);
  assert.equal(derived.section_id, 'decimal-section');
  assert.equal(derived.reference, '3.7');
});

test('within the decimal-lineage class, the existing depth tie-break still applies: a lettered SUBSECTION nested under a decimal SECTION outranks the SECTION itself', () => {
  const tree = [
    { section_id: 'root', reference: null, depth: 0, start: 0, end: 1000 },
    { section_id: 'legacy-d', reference: 'III-INTRO(a)(b)(c)(d)', depth: 6, start: 200, end: 400 },
    { section_id: 'decimal-section', reference: '3.7', depth: 3, start: 250, end: 350 },
    // A lettered SUBSECTION nested under the decimal SECTION ("3.7(b)") --
    // also decimal lineage (its reference starts with "3.7"), and DEEPER
    // than the SECTION node itself, so it wins within the decimal class.
    {
      section_id: 'decimal-subsection', reference: '3.7(b)', depth: 4, start: 270, end: 300,
    },
  ];

  const derivedAtSubsection = deriveCitationForSpan(tree, 275, 290);
  assert.equal(derivedAtSubsection.section_id, 'decimal-subsection', 'the deepest DECIMAL-lineage node still wins within its own class');

  const derivedAtSectionOnly = deriveCitationForSpan(tree, 255, 345);
  assert.equal(derivedAtSectionOnly.section_id, 'decimal-section', 'a span outside the lettered subsection falls back to the SECTION node, still decimal lineage, still preferred over the legacy straddling node');
});

// ─── The decimal-lineage class preference must NEVER fire on a tree with no
// decimal sections at all (the real QXO/TopBuild shape: bare lettered
// subsections directly under a synthetic ARTICLE numbering, no "Section
// X.XX" heading anywhere) -- explicit assertion that this fix changes
// NOTHING on that document shape. ───

test('the decimal-lineage class preference never fires on a tree with no decimal SECTION nodes at all (QXO shape) -- deepest-node-by-depth is the whole story', () => {
  const { tree } = buildDegenerateTree();

  // Sanity: this tree genuinely has no node whose reference matches the
  // decimal N.M shape anywhere.
  const decimalReferenceRe = /^\d+\.\d+/;
  assert.ok(
    tree.nodes.every((n) => !n.reference || !decimalReferenceRe.test(n.reference)),
    'sanity: no node in the QXO-shaped degenerate tree has a decimal N.M reference',
  );

  const bNode = tree.nodes.find((n) => n.reference && n.reference.endsWith('(b)'));
  const iNode = tree.nodes.find((n) => n.reference && n.reference.endsWith('(b)(i)'));
  assert.ok(bNode && iNode);

  // Behaviour is UNCHANGED from plain deepest-node-by-depth: querying inside
  // the deeper "(i)" node's own span resolves to "(i)", not its "(b)"
  // parent, exactly as before this fix.
  const derived = deriveCitationForSpan(tree, iNode.start, iNode.end);
  assert.equal(derived.section_id, iNode.section_id);
});

// ─── Nothing to check. ───

test('checkCitationConstructibility returns null when no citation is supplied', () => {
  assert.equal(checkCitationConstructibility({ tree: [], model_citation: null }), null);
  assert.equal(checkCitationConstructibility({ tree: [], model_citation: '' }), null);
  assert.equal(checkCitationConstructibility({ tree: [], model_citation: undefined }), null);
});

// ═══════════════════════════════════════════════════════════════════════
// 2026-08-02 Modiv triage fix: quote-occurrence resolution, never a global
// first-match. Real Modiv document, real sectionizer tree, real defect:
// idx 64's proposal quotes "as of the Capitalization Date" (evidence for
// its own "3.2(g)(iii)" occurrence), the model correctly cited "3.2(g)",
// but the evidence span the run recorded pointed at the FIRST of three
// textually-identical occurrences of that phrase sitting inside "3.2(f)" --
// deriving from that span alone produces "3.2(f)" and a false
// CITATION_DISAGREEMENT. See this module's file header, "QUOTE-OCCURRENCE
// RESOLUTION: NEVER A GLOBAL FIRST-MATCH".
// ═══════════════════════════════════════════════════════════════════════

const MODIV_QUOTE = 'as of the Capitalization Date';
// The real (wrong) evidence span run-receipt.json actually recorded for
// compiled_candidates[64] -- document-absolute UTF-8 byte offsets of the
// FIRST of the four real occurrences of MODIV_QUOTE in the document (three
// in "3.2(f)", one -- the correct one -- in "3.2(g)").
const MODIV_WRONG_EVIDENCE_SPAN = { start: 61432, end: 61432 + Buffer.byteLength(MODIV_QUOTE, 'utf8') };

function loadModivTree() {
  const adapterResult = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', 'modiv-first-live-run', 'adapter-result.json'),
    'utf8',
  ));
  const canonicalText = adapterResult.admitted_source_contexts[0].canonical_text.text;
  const documentHash = adapterResult.admitted_source_contexts[0].document_hash;
  const tree = sectionizeAdmittedSource({ source_text: canonicalText, document_hash: documentHash });
  return { tree, canonicalText };
}

test('MODIV REGRESSION (resolveQuoteOccurrence): the real quote "as of the Capitalization Date" occurs 7 times in the real document (3 in "3.2(f)", 1 in "3.2(g)", 3 more in an unrelated "4.2(f)") -- position, not global first-match, resolves which one the model\'s "3.2(g)" citation actually names', () => {
  const { tree, canonicalText } = loadModivTree();
  const resolution = resolveQuoteOccurrence({
    tree, document_text: canonicalText, quote: MODIV_QUOTE, model_citation: '3.2(g)',
  });
  assert.equal(resolution.occurrence_count, 7, 'sanity: exactly 7 real occurrences in the real document');
  assert.equal(resolution.resolved, true);
  assert.equal(resolution.ambiguous, false);
  assert.equal(resolution.occurrence.derived_citation, '3.2(g)', 'the model was right -- resolves to the (g)(iii) occurrence, not the first (f) occurrence, and not the unrelated (4.2(f)) occurrences');
});

test('MODIV REGRESSION (checkCitationConstructibility): given the (wrong, first-matched) evidence span the real run recorded, supplying the quote upgrades the false CITATION_DISAGREEMENT to AGREEMENT, deriving 3.2(g)', () => {
  const { tree, canonicalText } = loadModivTree();

  const derivedFromWrongSpan = deriveCitationForSpan(tree, MODIV_WRONG_EVIDENCE_SPAN.start, MODIV_WRONG_EVIDENCE_SPAN.end);
  assert.equal(derivedFromWrongSpan.reference, '3.2(f)', 'sanity: the wrong evidence span really does derive "3.2(f)" -- reproducing the real defect');

  // WITHOUT the quote (the pre-fix call shape): a false CITATION_DISAGREEMENT.
  const withoutQuote = checkCitationConstructibility({
    tree, model_citation: '3.2(g)', derived_node: derivedFromWrongSpan, document_text: canonicalText,
  });
  assert.equal(withoutQuote.status, 'CITATION_DISAGREEMENT');
  assert.equal(withoutQuote.derived_citation, '3.2(f)');

  // WITH the quote: position-aware resolution fixes it.
  const withQuote = checkCitationConstructibility({
    tree, model_citation: '3.2(g)', derived_node: derivedFromWrongSpan, document_text: canonicalText, quote: MODIV_QUOTE,
  });
  assert.equal(withQuote.status, 'AGREEMENT');
  assert.equal(withQuote.accepted, true);
  assert.equal(withQuote.validation_source, 'CONSTRUCTED_FROM_TREE_QUOTE_POSITION');
  assert.equal(withQuote.derived_citation, '3.2(g)');
  assert.equal(withQuote.normalized_citation, '3.2(g)');
});

test('MODIV REGRESSION: when the quote occurs at multiple offsets and no evidence span disambiguates (model cites "3.2(f)", which the SAME quote genuinely occurs at 3 times), the checker emits typed AMBIGUOUS_CITATION_OCCURRENCE, never silently picks the first', () => {
  const { tree, canonicalText } = loadModivTree();

  const check = checkCitationConstructibility({
    tree, model_citation: '3.2(f)', derived_node: null, document_text: canonicalText, quote: MODIV_QUOTE,
  });
  assert.equal(check.status, 'AMBIGUOUS_CITATION_OCCURRENCE');
  assert.equal(check.accepted, false, 'counts as a disagreement routed to review, never a silent first-match pick');
  assert.equal(check.validation_source, null);
  assert.equal(check.occurrence_count, 7);
  assert.ok(check.candidate_citations.includes('3.2(f)'));
  assert.ok(check.candidate_citations.includes('3.2(g)'));
});

test('resolveQuoteOccurrence: a quote occurring exactly once resolves unambiguously when it agrees with the model citation, and yields nothing usable when it does not', () => {
  const text = [
    'Section 3.1 Representations.\n\n',
    '(a)Organization. The Company represents that it is duly organized.\n\n',
    '(b)Authority. The Company represents that it has full corporate power.\n',
  ].join('');
  const documentHash = sha256Hex(Buffer.from(text, 'utf8'));
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: documentHash });

  const resolved = resolveQuoteOccurrence({
    tree, document_text: text, quote: 'it is duly organized', model_citation: '3.1(a)',
  });
  assert.equal(resolved.occurrence_count, 1);
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.ambiguous, false);
  assert.equal(resolved.occurrence.derived_citation, '3.1(a)');

  const mismatched = resolveQuoteOccurrence({
    tree, document_text: text, quote: 'it is duly organized', model_citation: '3.1(b)',
  });
  assert.equal(mismatched.resolved, false);
  assert.equal(mismatched.ambiguous, false, 'a single real occurrence that disagrees with the model is not "ambiguous" -- it is a genuine disagreement, left for the caller to report as such');
});

test('resolveQuoteOccurrence: returns null when there is nothing to resolve from (no quote text, no document text, or the quote is absent)', () => {
  assert.equal(resolveQuoteOccurrence({ tree: [], document_text: 'text', quote: '' }), null);
  assert.equal(resolveQuoteOccurrence({ tree: [], document_text: '', quote: 'x' }), null);
  assert.equal(resolveQuoteOccurrence({ tree: [], document_text: 'no match here', quote: 'absent phrase' }), null);
});

test('existing citation tests stay green: quote-occurrence resolution is opt-in -- omitting `quote` leaves CITATION_DISAGREEMENT behaviour byte-identical to before this fix', () => {
  const tree = [
    { section_id: 'a', reference: '3.1(a)', depth: 1, start: 0, end: 50 },
    { section_id: 'b', reference: '3.1(b)', depth: 1, start: 50, end: 100 },
  ];
  const derivedForB = deriveCitationForSpan(tree, 60, 90);
  const check = checkCitationConstructibility({ tree, model_citation: '3.1(a)', derived_node: derivedForB });
  assert.equal(check.status, 'CITATION_DISAGREEMENT');
  assert.equal(check.derived_citation, '3.1(b)');
});
