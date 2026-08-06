const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  sectionizeAdmittedSource,
  findSectionByReference,
  DeterministicSectionizerError,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');

const DOC_HASH = 'a'.repeat(64);

function sha256(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function semanticComparable(text) {
  return text
    .replace(/[​‎]/g, '')
    .replace(/\n\s*95\s*\n/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// The exact SHA-256 digests reviewed-qxo-capitalisation-slice.js hardcodes
// to detect drift in the human-picked source intervals — reused here as an
// independent ground truth for "did the automatic sectionizer find the
// SAME content a human hand-picked", without depending on that module's
// internals.
const CAPITAL_STRUCTURE_SHA256 = '51a79c16700b236f71fee89b12b863185564d4dd40703f07648ae2904f56528b';
const SECTION_5_2_SEMANTIC_SHA256 = '67f3125386f1ba2502a1d264aacac17b88e073ccf5d54bc770657b86552769eb';

function assertRoundTripsExactly(tree, sourceText, label) {
  const buf = Buffer.from(sourceText, 'utf8');
  assert.ok(tree.nodes.length > 0, `${label}: expected at least the root node`);
  for (const node of tree.nodes) {
    assert.ok(Number.isInteger(node.start) && node.start >= 0, `${label}: ${node.reference} start is a non-negative integer`);
    assert.ok(Number.isInteger(node.end) && node.end > node.start, `${label}: ${node.reference} end > start`);
    assert.ok(node.end <= buf.length, `${label}: ${node.reference} end within document bounds`);
    const slice = buf.subarray(node.start, node.end);
    assert.equal(
      sha256(slice.toString('utf8') /* re-encode to force a real UTF-8 round trip, not a byte passthrough */),
      node.text_sha256,
      `${label}: node ${node.reference || node.kind} (${node.start},${node.end}) must round-trip to its captured text exactly`,
    );
    // Directly re-verify against the raw buffer bytes too (no string layer).
    assert.equal(crypto.createHash('sha256').update(slice).digest('hex'), node.text_sha256);
  }
}

function assertParentageIsConsistent(tree, label) {
  const byId = new Map(tree.nodes.map((node) => [node.section_id, node]));
  for (const node of tree.nodes) {
    if (node.parent_section_id === null) continue;
    const parent = byId.get(node.parent_section_id);
    assert.ok(parent, `${label}: ${node.reference} has a parent_section_id present in the tree`);
    assert.ok(parent.depth < node.depth, `${label}: ${node.reference} is deeper than its parent`);
    assert.ok(parent.start <= node.start && node.end <= parent.end, `${label}: ${node.reference} span is nested inside its parent's span`);
  }
}

// ─── Fixtures ───

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

const landosText = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt'),
  'utf8',
);

// A realistic, newly-constructed full-document reconstruction: the REAL QXO
// Section 3.1(b) and Section 5.2 text (byte-for-byte, unmodified) embedded
// in a plausible surrounding merger-agreement shell (real ARTICLE/Section
// heading conventions — blank-line-anchored, "Section 3.1 " with the space
// EDGAR filings actually use). This is deliberately NOT the same fixture as
// tests/fixtures/canonical-v2/qxo-capitalisation-f27-inputs.js, which pads
// the same two snippets with raw space characters (no newlines at all) to
// force them onto pre-chosen byte offsets for unrelated interval-drift
// tests. See the "reproduces the governed QXO content" block below for why
// that distinction matters.
const qxoRealisticFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  'Section 3.1 Representations Concerning the Company.\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  '\n\nARTICLE V\n\nCONDITIONS TO THE MERGER\n\n',
  QXO_5_2_TEXT,
  '\n',
].join('');

// ─── Round trip: every node in the tree, not a sample ───

test('round-trips every node exactly on a real 394KB merger agreement (Landos/AbbVie)', () => {
  const tree = sectionizeAdmittedSource({ source_text: landosText, document_hash: DOC_HASH });
  assert.ok(tree.nodes.length > 100, 'expected substantial real structure to be found');
  assertRoundTripsExactly(tree, landosText, 'landos');
  assertParentageIsConsistent(tree, 'landos');
});

test('round-trips every node exactly on the reconstructed realistic QXO document', () => {
  const tree = sectionizeAdmittedSource({ source_text: qxoRealisticFullText, document_hash: DOC_HASH });
  assertRoundTripsExactly(tree, qxoRealisticFullText, 'qxo-realistic');
  assertParentageIsConsistent(tree, 'qxo-realistic');
});

test('round-trips every node exactly on the isolated capital-structure and 5.2 excerpts', () => {
  const capitalTree = sectionizeAdmittedSource({ source_text: capitalStructureText, document_hash: DOC_HASH });
  assertRoundTripsExactly(capitalTree, capitalStructureText, 'capital-isolated');
  assertParentageIsConsistent(capitalTree, 'capital-isolated');

  const conditionTree = sectionizeAdmittedSource({ source_text: QXO_5_2_TEXT, document_hash: DOC_HASH });
  assertRoundTripsExactly(conditionTree, QXO_5_2_TEXT, 'condition-isolated');
  assertParentageIsConsistent(conditionTree, 'condition-isolated');
});

// ─── Determinism ───

test('is deterministic: identical bytes twice produce byte-identical trees including section_ids', () => {
  const first = sectionizeAdmittedSource({ source_text: qxoRealisticFullText, document_hash: DOC_HASH });
  const second = sectionizeAdmittedSource({ source_text: qxoRealisticFullText, document_hash: DOC_HASH });
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  const firstLandos = sectionizeAdmittedSource({ source_text: landosText, document_hash: DOC_HASH });
  const secondLandos = sectionizeAdmittedSource({ source_text: landosText, document_hash: DOC_HASH });
  assert.equal(JSON.stringify(firstLandos), JSON.stringify(secondLandos));

  // A different document_hash must change every section_id (content-addressed
  // by document, not just by position/text).
  const differentHash = sectionizeAdmittedSource({ source_text: qxoRealisticFullText, document_hash: 'b'.repeat(64) });
  assert.notEqual(differentHash.root_section_id, first.root_section_id);
});

// ─── Real-document proof: does the sectionizer find what the human found? ───

test('reproduces the exact governed QXO capitalisation content — same bytes, same sha256', () => {
  const tree = sectionizeAdmittedSource({ source_text: qxoRealisticFullText, document_hash: DOC_HASH });
  const capitalNode = findSectionByReference(tree, '3.1(b)');
  assert.ok(capitalNode, '3.1(b) must be resolvable');
  assert.equal(capitalNode.heading, 'Capital Structure.');

  // THE key assertion: the automatically-discovered "3.1(b)" node's exact
  // byte content hashes to the SAME sha256 that reviewed-qxo-capitalisation-
  // slice.js hardcodes as CAPITAL_STRUCTURE_SHA256 (its own drift-detection
  // check on the hand-picked CAPITAL_STRUCTURE_INTERVAL). Same content,
  // found without anyone typing a byte offset.
  assert.equal(capitalNode.text_sha256, CAPITAL_STRUCTURE_SHA256);

  // Its span length matches the governed interval's length exactly — the
  // governed interval was defined as exactly this snippet's byte length
  // (see reviewed-qxo-capitalisation-slice.test.js / qxo-capitalisation-f27-
  // inputs.js, which place the snippet so CAPITAL_STRUCTURE_INTERVAL.end -
  // CAPITAL_STRUCTURE_INTERVAL.start === byte length of qxo-section-3-1-b.txt).
  assert.equal(
    capitalNode.end - capitalNode.start,
    CAPITAL_STRUCTURE_INTERVAL.end - CAPITAL_STRUCTURE_INTERVAL.start,
  );

  // The five representation limbs the human hand-selected via
  // uniqueByteIndex(capitalBytes, LIMB_STARTS[i], ...) land at IDENTICAL
  // byte offsets (relative to the section start) as this sectionizer's
  // automatic (i)/(ii)/(iii)/(iv)/(v) subsection boundaries.
  const limbStarts = [
    '(i)The authorized capital stock of the Company consists of',
    '(ii)As of April 17, 2026,',
    '(iii)Except for any obligations pursuant to this Agreement,',
    '(iv)Upon any issuance of any Company Shares in accordance with the terms of the A&R 2015 Plan,',
    '(v)There are no voting trusts or other agreements or understandings',
  ];
  const buf = Buffer.from(capitalStructureText, 'utf8');
  const expectedRelativeStarts = limbStarts.map((needle) => buf.indexOf(Buffer.from(needle, 'utf8')));
  const limbRefs = ['3.1(b)(i)', '3.1(b)(ii)', '3.1(b)(iii)', '3.1(b)(iv)', '3.1(b)(v)'];
  const actualRelativeStarts = limbRefs.map((ref) => findSectionByReference(tree, ref).start - capitalNode.start);
  assert.deepEqual(actualRelativeStarts, expectedRelativeStarts);
});

test('reproduces the exact governed QXO Section 5.2 content — same bytes after semantic normalisation', () => {
  const tree = sectionizeAdmittedSource({ source_text: qxoRealisticFullText, document_hash: DOC_HASH });
  const conditionSection = findSectionByReference(tree, '5.2');
  assert.ok(conditionSection);

  // SECTION_5_2_SEMANTIC_SHA256 is computed over the *unpadded* real
  // condition text (QXO_5_2_TEXT) after the same normalisation
  // reviewed-qxo-capitalisation-slice.js applies (semanticComparable). The
  // automatically-discovered "5.2" section's content matches it exactly.
  const conditionBuf = Buffer.from(qxoRealisticFullText, 'utf8');
  const conditionText = conditionBuf.subarray(conditionSection.start, conditionSection.end).toString('utf8');
  assert.equal(sha256(semanticComparable(conditionText)), SECTION_5_2_SEMANTIC_SHA256);

  // The (a)(ii) / (a)(iii) boundaries the human located via uniqueByteIndex
  // land at identical relative offsets to this sectionizer's automatic
  // "5.2(a)(ii)" / "5.2(a)(iii)" subsection boundaries.
  const subsectionIi = findSectionByReference(tree, '5.2(a)(ii)');
  const subsectionIii = findSectionByReference(tree, '5.2(a)(iii)');
  const conditionBytes = Buffer.from(QXO_5_2_TEXT, 'utf8');
  const expectedIiStart = conditionBytes.indexOf(Buffer.from('(ii)(A) the representations and warranties', 'utf8'));
  const expectedIiiStart = conditionBytes.indexOf(Buffer.from('(iii)No Company Material Adverse Effect', 'utf8'));
  assert.equal(subsectionIi.start - conditionSection.start, expectedIiStart);
  assert.equal(subsectionIii.start - conditionSection.start, expectedIiiStart);
});

test('against the padded test-only fixture: no invented "3.1(b)"/"5.2" citations, and a precise account of why', () => {
  // reviewed-qxo-capitalisation-slice.js's CAPITAL_STRUCTURE_INTERVAL/
  // SECTION_5_2_INTERVAL are only meaningful relative to the padded
  // synthetic "admitted text" built by
  // tests/canonical-v2-reviewed-qxo-capitalisation-slice.test.js's
  // `sourceText()` helper, which places the two real snippets inside runs of
  // literal space characters (' '.repeat(n)) with NO newlines anywhere in
  // the padding, and no real preamble/heading text around them either.
  // There is no real full SEC filing text file in this repository at these
  // offsets — the constants are fixture-construction artifacts, not
  // positions read off a real document.
  const chunks = [' '.repeat(CAPITAL_STRUCTURE_INTERVAL.start), capitalStructureText];
  const afterCapital = CAPITAL_STRUCTURE_INTERVAL.start + Buffer.byteLength(capitalStructureText, 'utf8');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.start - afterCapital), QXO_5_2_TEXT);
  const afterCondition = SECTION_5_2_INTERVAL.start + Buffer.byteLength(QXO_5_2_TEXT, 'utf8');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.end - afterCondition));
  const paddedText = chunks.join('');

  const tree = sectionizeAdmittedSource({ source_text: paddedText, document_hash: DOC_HASH });
  assertRoundTripsExactly(tree, paddedText, 'padded-fixture');

  // No throw, no invented "Section 3.1" / "Section 5.2" structure: the
  // padding gives parseStructure nothing to anchor a heading on (no newline
  // precedes "5.2Additional Conditions..." — it is preceded only by raw
  // spaces — so isHeading() correctly refuses to call it a heading, and no
  // SECTION node for "5.2" or "3.1" is created). The governed CITATIONS a
  // human would use are therefore genuinely unresolvable from this input:
  assert.equal(findSectionByReference(tree, '3.1(b)'), null);
  assert.equal(findSectionByReference(tree, '3.1'), null);
  assert.equal(findSectionByReference(tree, '5.2'), null);
  assert.equal(findSectionByReference(tree, '5.2(a)(ii)'), null);

  // What IS recovered: the lettered/roman markers that are themselves
  // preceded by a REAL newline inside the pasted snippets (e.g. the "\n"
  // right before "(i)The authorized capital stock...") still satisfy the
  // line-start marker anchor even though their document/section context is
  // gone, so they surface as un-prefixed root-level fragments ("(i)",
  // "(a)(ii)", ...) rather than being silently dropped or wrongly chained
  // into one fake nested sequence spanning both unrelated snippets.
  const bareLimbI = findSectionByReference(tree, '(a)(i)');
  assert.ok(bareLimbI, 'the closing-condition limb (a)(i) marker is still found, just without its "5.2" prefix');

  // One genuine, verifiable coincidence worth recording precisely: this
  // particular padding scheme starts the space run at byte 0 (no preamble
  // text ahead of it), so "(b)Capital Structure." ends up matching the
  // marker anchor's "^" branch (start-of-string, with [ \t]* absorbing the
  // whole padding run) exactly as if it opened the document. Its span is
  // therefore byte-IDENTICAL to CAPITAL_STRUCTURE_INTERVAL — even though it
  // was found via a start-of-string coincidence of this specific fixture's
  // construction, not via any header/citation context (its reference is the
  // bare "(b)", never "3.1(b)"). SECTION_5_2_INTERVAL is not reproduced this
  // way because it deliberately covers the "5.2Additional Conditions..."
  // chapeau text BEFORE the first "(a)" marker, and that chapeau has no
  // newline anchor of its own in the padded fixture, so no node claims it.
  const bareCapitalStructure = findSectionByReference(tree, '(b)');
  assert.equal(bareCapitalStructure.start, CAPITAL_STRUCTURE_INTERVAL.start);
  assert.equal(bareCapitalStructure.end, CAPITAL_STRUCTURE_INTERVAL.end);
});

// ─── Reference resolution, including nested references ───

test('findSectionByReference resolves top-level and deeply nested references', () => {
  const tree = sectionizeAdmittedSource({ source_text: landosText, document_hash: DOC_HASH });

  const shallow = findSectionByReference(tree, '2.1');
  assert.ok(shallow, 'top-level section 2.1 resolves');
  assert.equal(shallow.kind, 'SECTION');

  const nestedTwo = findSectionByReference(tree, '2.1(a)');
  assert.ok(nestedTwo);
  assert.equal(nestedTwo.parent_section_id, shallow.section_id);

  const nestedThree = findSectionByReference(tree, '2.1(a)(i)');
  assert.ok(nestedThree);
  assert.equal(nestedThree.parent_section_id, nestedTwo.section_id);

  // A four-deep reference genuinely present in this real document.
  const deep = findSectionByReference(tree, '2.2(b)(ii)(A)');
  assert.ok(deep, 'deeply-nested reference 2.2(b)(ii)(A) resolves');
  assert.equal(deep.depth, 5);

  assert.equal(findSectionByReference(tree, '999.99(z)'), null);
  assert.equal(findSectionByReference(tree, ''), null);
  assert.equal(findSectionByReference(null, '2.1'), null);
});

test('findSectionByReference works against the raw nodes array as well as the wrapper object', () => {
  const tree = sectionizeAdmittedSource({ source_text: qxoRealisticFullText, document_hash: DOC_HASH });
  const viaWrapper = findSectionByReference(tree, '3.1(b)');
  const viaArray = findSectionByReference(tree.nodes, '3.1(b)');
  assert.equal(viaWrapper.section_id, viaArray.section_id);
});

// ─── Robustness ───

test('a document with no recognisable structure returns a single-root tree, not an error', () => {
  const plainProse = 'The quick brown fox jumps over the lazy dog. '.repeat(50);
  const tree = sectionizeAdmittedSource({ source_text: plainProse, document_hash: DOC_HASH });
  assert.equal(tree.nodes.length, 1);
  assert.equal(tree.nodes[0].kind, 'ROOT');
  assert.equal(tree.nodes[0].start, 0);
  assert.equal(tree.nodes[0].end, Buffer.byteLength(plainProse, 'utf8'));
});

test('empty source text returns an empty tree rather than throwing', () => {
  const tree = sectionizeAdmittedSource({ source_text: '', document_hash: DOC_HASH });
  assert.equal(tree.nodes.length, 0);
  assert.equal(tree.root_section_id, null);
  assert.equal(tree.source_byte_length, 0);
});

test('a document with only unstructured lettered prose (no digits at all) still yields an addressable, round-tripping tree', () => {
  const text = '(a) First item with no section number anywhere in this document.\n\n'
    + '(b) Second item, continuing the sequence.\n\n'
    + '(i) A nested roman item under (b).\n\n'
    + '(ii) Another nested roman item under (b).\n';
  const tree = sectionizeAdmittedSource({ source_text: text, document_hash: DOC_HASH });
  assertRoundTripsExactly(tree, text, 'lettered-only');
  assert.ok(findSectionByReference(tree, '(a)'));
  assert.ok(findSectionByReference(tree, '(b)(i)'));
  assert.ok(findSectionByReference(tree, '(b)(ii)'));
});

test('four-letter Roman markers remain siblings in an unheaded TopBuild-style list', () => {
  const source = [
    '4.1 Interim Operations of the Company. The Company will not:',
    '(vii) incur Indebtedness;',
    '(viii) settle any Action;',
    '(ix) make any capital expenditure;',
    '(x) change accounting policies;',
    '(xi) amend a material Contract;',
    '(xii) make a Tax election;',
    '(xiii) dispose of assets;',
    '(xiv) increase compensation;',
    '(xv) terminate an insurance policy; or',
    '(xvi) agree to do any of the foregoing.',
  ].join('\n');
  const tree = sectionizeAdmittedSource({ source_text: source, document_hash: DOC_HASH });
  const expected = ['4.1(vii)', '4.1(viii)', '4.1(ix)', '4.1(x)', '4.1(xi)', '4.1(xii)', '4.1(xiii)', '4.1(xiv)', '4.1(xv)', '4.1(xvi)'];

  assert.deepEqual(
    tree.nodes.filter((node) => node.kind === 'SUBSECTION').map((node) => node.reference),
    expected,
  );
  for (const reference of expected) {
    const node = findSectionByReference(tree, reference);
    assert.equal(node.parent_section_id, findSectionByReference(tree, '4.1').section_id, `${reference} remains a sibling`);
  }
  assert.equal(findSectionByReference(tree, '4.1(vii)(ix)'), null);
  assert.equal(findSectionByReference(tree, '4.1(vii)(xii)(xiv)'), null);
  assert.equal(findSectionByReference(tree, '4.1(vii)(xii)(xvi)'), null);
});

test('recognises terminal-dot decimal headings split across lines, but not inline decimal prose', () => {
  const source = [
    'ARTICLE VI',
    'COVENANTS',
    '6.1.',
    'Interim Operations.',
    '6.2.',
    'Cooperation; Antitrust Matters.',
    'This sentence refers to 6.3. Cooperation, but is not a heading.',
  ].join('\n');
  const tree = sectionizeAdmittedSource({ source_text: source, document_hash: DOC_HASH });
  assert.equal(findSectionByReference(tree, '6.1')?.heading, 'Interim Operations');
  assert.equal(findSectionByReference(tree, '6.2')?.heading, 'Cooperation; Antitrust Matters');
  assert.equal(tree.nodes.filter((node) => node.kind === 'SECTION' && node.reference === '6.2').length, 1);
  assertRoundTripsExactly(tree, source, 'terminal-dot-decimal-headings');
});

// ─── Section-boundary correctness on real filings ───
//
// Regression coverage for a defect found via a live extraction run
// (evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/).
// findSectionByReference itself is a plain exact-match lookup over nodes
// the tree already built (see its definition below) — it does no boundary
// computation and was not the defect. The reported symptom ("Section 7.1
// starts 1,450 bytes late, silently excluding subsection (a) and (b)(i)")
// does not reproduce: byte-level inspection of the real Modiv filing shows
// node.start for "7.1" lands exactly on "Section 7.1 Termination.", and
// both (a) and (b)(i) are and always were fully inside its span. The
// "1,450 bytes" in the original report is the byte-length overhead of the
// ~700 multi-byte characters (curly quotes etc.) preceding that point in
// the document: `fullText.indexOf('Section 7.1 Termination.')` (a
// character index) and the sectionizer's real byte offset both name the
// SAME position, not two different ones — see the dedicated test below.
//
// A real, corpus-measured version of this bug class DOES exist, though:
// appendInlineDecimalHeadingSections (deterministic-sectionizer.js) mints
// real inline-numbered sections on top of parseStructure's tree without
// reconciling parseStructure's own "<article>-INTRO" chapeau node, which —
// on any article where every section uses bare, non-blank-line-anchored
// numbering (TopBuild's Article I, all of Skechers) — swallows the ENTIRE
// article, including every section the additive pass then mints on top.
// reconcileStaleArticleChildren clips the stale INTRO node at the real
// first-section boundary once it is known. These tests pin the corrected
// behaviour against the real committed filings, not synthetic excerpts.

function sectionizeRealFiling(relativeHtmlPath) {
  const raw = fs.readFileSync(path.join(__dirname, '..', relativeHtmlPath));
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/sectionizer-corpus-check.htm',
    final_url: 'https://www.sec.gov/Archives/edgar/data/1/sectionizer-corpus-check.htm',
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-05T00:00:00.000Z',
    retrieval_policy_digest: sha256Hex('canonical-v2-native-sectionizer.test.js corpus-wide boundary check'),
    redirect_count: 0,
    response_bytes: raw,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const sourceText = conversion.canonical_text;
  const documentHash = sha256Hex(raw);
  return {
    sourceText,
    documentHash,
    tree: sectionizeAdmittedSource({ source_text: sourceText, document_hash: documentHash }),
  };
}

const REAL_FILINGS = [
  { name: 'modiv', htmlPath: 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm' },
  { name: 'topbuild', htmlPath: 'tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm' },
  { name: 'skechers', htmlPath: 'tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm' },
];

// Every pair of siblings sharing a parent must exactly tile: no overlap (one
// section absorbing a neighbour's text) and no gap (silently dropped text —
// this module's own header calls this "this codebase's worst failure
// class"). Checked at EVERY tree level (ARTICLE/SECTION/SUBSECTION, any
// depth), not just top-level sections.
function assertSiblingsTileExactly(tree, sourceText, label) {
  const byParent = new Map();
  for (const node of tree.nodes) {
    if (!node.parent_section_id) continue;
    if (!byParent.has(node.parent_section_id)) byParent.set(node.parent_section_id, []);
    byParent.get(node.parent_section_id).push(node);
  }
  const buf = Buffer.from(sourceText, 'utf8');
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.start - b.start);
    for (let i = 0; i + 1 < siblings.length; i++) {
      const left = siblings[i];
      const right = siblings[i + 1];
      assert.ok(
        left.end <= right.start,
        `${label}: ${left.reference || left.kind} [${left.start},${left.end}) overlaps its next sibling `
          + `${right.reference || right.kind} [${right.start},${right.end})`,
      );
      if (left.end < right.start) {
        const dropped = buf.subarray(left.end, right.start).toString('utf8');
        assert.fail(
          `${label}: ${right.start - left.end} bytes silently dropped between `
            + `${left.reference || left.kind} and ${right.reference || right.kind}: ${JSON.stringify(dropped.slice(0, 120))}`,
        );
      }
    }
  }
}

// A decimal SECTION's own byte slice must literally begin with its own
// heading anchor — never late, never on a neighbour's or a cross-
// reference's text.
function assertDecimalSectionsAnchorOnOwnHeading(tree, sourceText, label) {
  const buf = Buffer.from(sourceText, 'utf8');
  for (const node of tree.nodes) {
    if (node.kind !== 'SECTION' || !/^\d+\.\d+$/.test(node.reference || '')) continue;
    const windowText = buf.subarray(node.start, node.start + 40).toString('utf8');
    const refPattern = node.inline_decimal_heading
      ? new RegExp(`^${node.reference}\\b`)
      : new RegExp(`^(?:SECTION|Section)\\s+${node.reference}\\b`);
    assert.ok(
      refPattern.test(windowText),
      `${label}: SECTION "${node.reference}" at byte ${node.start} must start on its own heading text, got ${JSON.stringify(windowText)}`,
    );
  }
}

for (const filing of REAL_FILINGS) {
  test(`corpus-wide boundary regression check: ${filing.name} — every sibling pair tiles exactly, every decimal section anchors on its own heading`, () => {
    const { sourceText, tree } = sectionizeRealFiling(filing.htmlPath);
    assert.ok(tree.nodes.filter((n) => n.kind === 'SECTION').length > 10, `${filing.name}: expected substantial real structure`);
    assertSiblingsTileExactly(tree, sourceText, filing.name);
    assertDecimalSectionsAnchorOnOwnHeading(tree, sourceText, filing.name);
    assertParentageIsConsistent(tree, filing.name);
  });
}

test('regression: TopBuild ARTICLE I chapeau no longer absorbs "1.1" through "1.8" (was: I-INTRO end=15734 straddling 1.1 start=8619)', () => {
  const { sourceText, tree } = sectionizeRealFiling('tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm');
  const intro = findSectionByReference(tree, 'I-INTRO');
  const s11 = findSectionByReference(tree, '1.1');
  assert.ok(intro && s11);
  assert.equal(intro.end, s11.start, 'I-INTRO must end exactly where 1.1 begins, not swallow it');
  assert.equal(s11.heading, 'The Titanium Merger');
  const buf = Buffer.from(sourceText, 'utf8');
  assert.match(buf.subarray(s11.start, s11.start + 30).toString('utf8'), /^1\.1 The Titanium Merger/);
  // "I-INTRO(a)"/"I-INTRO(b)" were phantom subsection nodes misattributed
  // from 1.8's own lettered clauses while I-INTRO wrongly spanned the
  // whole article.
  assert.equal(findSectionByReference(tree, 'I-INTRO(a)'), null);
  assert.equal(findSectionByReference(tree, 'I-INTRO(b)'), null);
});

test('regression: Skechers "Company Material Adverse Effect" (clause (r)) resolves under the real "1.1" Certain Definitions section, not the stale INTRO node', () => {
  const { sourceText, tree } = sectionizeRealFiling('tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm');
  const s11 = findSectionByReference(tree, '1.1');
  assert.equal(s11.heading, 'Certain Definitions');
  const clauseR = findSectionByReference(tree, '1.1(r)');
  assert.ok(clauseR, '"1.1(r)" must resolve');
  assert.equal(clauseR.parent_section_id, s11.section_id, '"1.1(r)" must be a direct child of the real "1.1" section');
  const buf = Buffer.from(sourceText, 'utf8');
  assert.match(buf.subarray(clauseR.start, clauseR.start + 60).toString('utf8'), /^\(r\) .Company Material Adverse Effect/);
  assert.equal(findSectionByReference(tree, 'I-INTRO(r)'), null, 'the misattributed reference must no longer resolve at all');
});

test('Modiv Section 7.1 resolves from its real heading, with subsection (a) mutual consent and (b)(i) regulatory injunction fully inside it', () => {
  const { sourceText, tree } = sectionizeRealFiling('tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm');
  const node = findSectionByReference(tree, '7.1');
  assert.ok(node);
  assert.equal(node.kind, 'SECTION');
  assert.equal(node.heading, 'Termination');

  const buf = Buffer.from(sourceText, 'utf8');
  const headingLiteral = 'Section 7.1 Termination.';
  assert.equal(
    buf.subarray(node.start, node.start + headingLiteral.length).toString('utf8'),
    headingLiteral,
    'node.start must land exactly on the literal heading text, not late',
  );

  // The originally-reported "1,450 bytes silently excluded" claim named two
  // provisions as supposedly missing from the front of the resolved span:
  // subsection (a) (mutual consent) and (b)(i) (a regulatory-injunction
  // termination right). Both are, and always were, fully inside [start,end).
  const subsectionA = findSectionByReference(tree, '7.1(a)');
  const subsectionBI = findSectionByReference(tree, '7.1(b)(i)');
  assert.ok(subsectionA && subsectionBI);
  assert.ok(node.start <= subsectionA.start && subsectionA.end <= node.end, '7.1(a) is fully inside 7.1');
  assert.ok(node.start <= subsectionBI.start && subsectionBI.end <= node.end, '7.1(b)(i) is fully inside 7.1');
  assert.match(buf.subarray(subsectionA.start, subsectionA.end).toString('utf8'), /mutual written consent/i);
  assert.match(buf.subarray(subsectionBI.start, subsectionBI.end).toString('utf8'), /(?:injunction|restraining|Governmental Authority)/i);

  // The exact provenance of the original report's "320,311" figure: a JS
  // string CHARACTER index (fullText.indexOf, UTF-16 code units), not a
  // byte offset, naming the SAME position as node.start (a real byte
  // offset) — not a different, earlier one. Pinned here so this specific
  // unit-confusion cannot resurface as a false alarm.
  const charIndex = sourceText.indexOf('Section 7.1 Termination.');
  assert.equal(Buffer.byteLength(sourceText.slice(0, charIndex), 'utf8'), node.start);
});

test('the last section in a document terminates correctly: Modiv 8.12 ends exactly at the signature block, not before or after it', () => {
  const { sourceText, tree } = sectionizeRealFiling('tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm');
  const node = findSectionByReference(tree, '8.12');
  assert.ok(node);
  const buf = Buffer.from(sourceText, 'utf8');
  assert.match(
    buf.subarray(node.end, node.end + 40).toString('utf8'),
    /^\n\[Signature Page Follows\]/,
    '8.12 must end exactly where the signature block begins -- not swallow it, not stop short of it',
  );
});

test('a reference that cannot be resolved fails rather than approximating', () => {
  const { tree } = sectionizeRealFiling('tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm');
  const real = findSectionByReference(tree, '7.1');
  assert.ok(real);
  // Documented contract: surrounding whitespace is trimmed...
  assert.equal(findSectionByReference(tree, '7.1 ').section_id, real.section_id);
  // ...but nothing else is fuzzy. No prefix match, no nearest-neighbour, no
  // parent fallback when a deeper reference does not exist, no match on the
  // literal heading text.
  assert.equal(findSectionByReference(tree, '7.10'), null, 'one digit longer than a real reference must not match it');
  assert.equal(findSectionByReference(tree, '7.1(b)(i)(extra)'), null, 'one clause deeper than any real node must not fall back to its parent');
  assert.equal(findSectionByReference(tree, 'SECTION 7.1'), null, 'the literal heading text is not itself a valid reference');
  assert.equal(findSectionByReference(tree, '999.99'), null);
  assert.equal(findSectionByReference(tree, ''), null);
});

// ─── Input validation ───

test('rejects missing or malformed inputs instead of silently misbehaving', () => {
  assert.throws(() => sectionizeAdmittedSource({ document_hash: DOC_HASH }), DeterministicSectionizerError);
  assert.throws(() => sectionizeAdmittedSource({ source_text: 'hello' }), DeterministicSectionizerError);
  assert.throws(() => sectionizeAdmittedSource({ source_text: 123, document_hash: DOC_HASH }), DeterministicSectionizerError);
});
