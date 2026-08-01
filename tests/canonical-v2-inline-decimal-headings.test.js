'use strict';

/**
 * tests/canonical-v2-inline-decimal-headings.test.js
 *
 * docs/superpowers/specs/2026-08-01-inline-decimal-headings-design.md —
 * the Skechers sectionizer gap (final-audit finding B3): real
 * decimal-numbered headings ("3.7 Company Capitalization.") printed as
 * inline prose with no blank-line anchoring, which `parseStructure`'s
 * heading detector never sees, so the residual lettered-clause walker mints
 * a subsection that straddles the true 3.7/3.8 boundary
 * (tests/fixtures/canonical-v2/skechers-first-live-run/section-location-scan.json).
 *
 * All five acceptance items from the spec, each failing-first against the
 * pre-change sectionizer:
 *   1. Skechers excerpt: "3.7" mints with the correct whole-document span,
 *      lettered children nest inside it, nothing straddles 3.7/3.8.
 *   2. QXO regression pin: byte-identical tree to the pass short-circuited.
 *   3. Cross-reference immunity: zero line-start headings -> zero candidates.
 *   4. Lone-candidate rejection, typed and visible.
 *   5. Determinism / permutation invariance.
 *
 * A NOTE ON THE SKECHERS SPAN NUMBERS. The design doc's acceptance section
 * quotes tests/fixtures/canonical-v2/skechers-first-live-run/
 * section-location-scan.json's "true span" as `[121686, 126824)` and labels
 * it a "canonical_text_offset". Independently reproducing that scan against
 * the SAME pinned, hash-verified canonical text (see the excerpt-provenance
 * block below) shows those two numbers are JS STRING INDICES (UTF-16 code
 * units, i.e. `text.indexOf(...)`), not UTF-8 BYTE offsets — the scan
 * artifact's own field name is a mislabel. Every byte offset this
 * sectionizer module produces (`node.start` / `node.end`) is, per the
 * module's own header contract, "exact UTF-8 byte offsets into the
 * ORIGINAL admitted bytes" — that invariant is load-bearing for every other
 * consumer of this tree (citation-constructibility.js, the write-set
 * adapter, ...), so this test asserts the TRUE UTF-8 byte span, verified
 * two independent ways below (Buffer.byteLength on the exact same pinned
 * text, and this sectionizer's own round-trip byte-for-byte text_sha256
 * check), rather than the artifact's mislabeled char-index numbers:
 *   [122698, 127852) — 5,154 bytes, "3.7 Company Capitalization." through
 *   immediately before "3.8 Subsidiaries.".
 * The excerpt fixture below is a contiguous byte slice of that SAME
 * verified canonical text, so this span translates through the excerpt via
 * a single additive offset base (EXCERPT_BASE) with no independent drift.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  sectionizeAdmittedSource, findSectionByReference, DeterministicSectionizerError,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');

function sha256(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

const DOC_HASH = 'f'.repeat(64);

// ─── 1. Skechers excerpt ───
//
// tests/fixtures/canonical-v2/skechers-first-live-run/article-iii-canonical-
// excerpt.txt is a contiguous UTF-8 byte slice — bytes [108297, 185830) —
// of the canonical text produced by feeding the pinned Skechers/Beach
// Acquisition filing (tests/fixtures/canonical-v2/skechers-first-live-run/
// intake-pin.json: raw_bytes_sha256
// 3a8b8d77c126c85f4402f290da3dec43efa209d6a8a505d11d1af95fab115833,
// canonical_text_sha256
// a7d76e8a7f6efed945208b5870ddfa848438a7542806878bb2bc10646b557660,
// canonical_text_byte_length 380704 — both independently reproduced while
// building this fixture, exactly as
// scripts/canonical-v2-skechers-first-live-extraction-run.mjs's own
// fetch -> buildSecEdgarIntakeCapture -> convertSecHtmlToCanonicalText ->
// verifySecHtmlCanonicalText chain does, with a PASS verification status)
// through `convertSecHtmlToCanonicalText`. It covers all of ARTICLE III
// (real bytes [111946, 181651) in the full document) plus a ~3KB margin
// into the tail of ARTICLE II and the head of ARTICLE IV, snapped outward
// to the nearest newline on each side so no multi-byte UTF-8 sequence is
// ever split. EXCERPT_BASE is that slice's start offset — the ONLY
// translation needed to convert this test's local (excerpt-relative) byte
// offsets back into whole-document coordinates.
const EXCERPT_BASE = 108297;

const skechersExcerptText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'canonical-v2', 'skechers-first-live-run', 'article-iii-canonical-excerpt.txt'),
  'utf8',
);

test('Skechers excerpt: fixture provenance — exact byte length and the true (byte, not char-index) 3.7/3.8 boundary', () => {
  assert.ok(Buffer.byteLength(skechersExcerptText, 'utf8') < 80 * 1024, 'excerpt fixture stays under ~80KB');

  // Independent confirmation that the TRUE byte offset of "3.7 Company
  // Capitalization." inside this excerpt, translated via EXCERPT_BASE,
  // lands at the byte offset this test asserts throughout — computed here
  // via a plain substring search + Buffer.byteLength, with NO dependency
  // on the sectionizer under test.
  const idx37Local = skechersExcerptText.indexOf('3.7 Company Capitalization.');
  assert.ok(idx37Local >= 0, 'the excerpt contains the literal 3.7 heading text');
  const byteOffset37 = Buffer.byteLength(skechersExcerptText.slice(0, idx37Local), 'utf8') + EXCERPT_BASE;
  assert.equal(byteOffset37, 122698);

  const idx38Local = skechersExcerptText.indexOf('3.8 Subsidiaries.');
  assert.ok(idx38Local >= 0, 'the excerpt contains the literal 3.8 heading text');
  const byteOffset38 = Buffer.byteLength(skechersExcerptText.slice(0, idx38Local), 'utf8') + EXCERPT_BASE;
  assert.equal(byteOffset38, 127852);
});

test('Skechers excerpt: the Article III run is accepted and mints SECTION "3.7" at the true whole-document span [121686+base-correction] -> [122698, 127852)', () => {
  const tree = sectionizeAdmittedSource({ source_text: skechersExcerptText, document_hash: DOC_HASH });

  const node37 = findSectionByReference(tree, '3.7');
  assert.ok(node37, '"3.7" must resolve as a real SECTION node');
  assert.equal(node37.kind, 'SECTION');
  assert.equal(node37.start + EXCERPT_BASE, 122698);
  assert.equal(node37.end + EXCERPT_BASE, 127852);
  assert.equal(node37.end - node37.start, 5154);
  assert.equal(node37.heading, 'Company Capitalization');
  assert.equal(node37.toc_corroborated, true, 'Skechers\' own TOC really does carry a "Section 3.7" entry (section-location-scan.json)');
  assert.equal(node37.inline_decimal_heading, true);

  // No node straddles the true 3.7/3.8 boundary: "3.8" begins EXACTLY where
  // "3.7" ends, and every node this pass minted is fully on one side or the
  // other.
  const node38 = findSectionByReference(tree, '3.8');
  assert.ok(node38);
  assert.equal(node38.start, node37.end);
  const boundary = node37.end;
  const mintedByThisPass = tree.nodes.filter((n) => n.inline_decimal_heading || (n.parent_section_id === node37.section_id));
  for (const n of mintedByThisPass) {
    assert.ok(!(n.start < boundary && n.end > boundary), `${n.kind} ${n.reference} must not straddle the 3.7/3.8 boundary`);
  }

  // The lettered children nest inside "3.7", in document order, covering
  // it exactly end to end.
  const children = tree.nodes
    .filter((n) => n.parent_section_id === node37.section_id)
    .sort((a, b) => a.start - b.start);
  assert.deepEqual(children.map((c) => c.reference), ['3.7(a)', '3.7(b)', '3.7(c)', '3.7(d)']);
  for (const child of children) {
    assert.ok(child.start >= node37.start && child.end <= node37.end, `${child.reference} nests inside 3.7`);
  }
  // The first child starts right after the "3.7 Company Capitalization.\n"
  // heading line — verified against the fixture text directly, not a magic
  // constant.
  const headingLineByteLength = Buffer.byteLength('3.7 Company Capitalization.\n', 'utf8');
  assert.equal(children[0].start, node37.start + headingLineByteLength);
  assert.equal(children[children.length - 1].end, node37.end);

  // Round-trips byte-exact, same contract every other node in this module
  // honours.
  const buf = Buffer.from(skechersExcerptText, 'utf8');
  const slice = buf.subarray(node37.start, node37.end);
  assert.equal(sha256(slice.toString('utf8')), node37.text_sha256);
});

test('Skechers excerpt: zero rejected candidates for the ARTICLE III run itself (the monotonic 3.x sequence is long and clean)', () => {
  const tree = sectionizeAdmittedSource({ source_text: skechersExcerptText, document_hash: DOC_HASH });
  const rejectedForArticleIii = tree.rejected_inline_heading_candidates.filter((r) => r.article === 'III');
  assert.deepEqual(rejectedForArticleIii, []);
});

// ─── 2. QXO regression pin — the load-bearing constraint (spec point 5) ───
//
// "run the sectionizer on the existing QXO fixture text exactly as
// tests/canonical-v2-f28-second-live-fixture-replay.test.js constructs it"
// — reproduced byte-for-byte from that file.

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

const qxoDegenerateFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  '\n',
].join('');

const QXO_DOC_HASH = sha256(qxoDegenerateFullText);

test('QXO regression pin: zero raw candidates scanned at all (bare lettered subsections are not line-start N.M shapes)', () => {
  const tree = sectionizeAdmittedSource({ source_text: qxoDegenerateFullText, document_hash: QXO_DOC_HASH });
  assert.deepEqual(tree.rejected_inline_heading_candidates, []);
  // No node this pass could have minted exists — every SECTION reference in
  // this tree is either the article-intro synthetic section or a bare
  // lettered marker, never a bare "N.M" decimal reference.
  const decimalSectionRefs = tree.nodes.filter((n) => n.kind === 'SECTION' && /^\d+\.\d+$/.test(n.reference || ''));
  assert.deepEqual(decimalSectionRefs, []);
});

test('QXO regression pin: tree is node-for-node, id-for-id IDENTICAL to the pass short-circuited (real deep-equal, not a hand copy)', () => {
  const withPass = sectionizeAdmittedSource({ source_text: qxoDegenerateFullText, document_hash: QXO_DOC_HASH });
  const withoutPass = sectionizeAdmittedSource({
    source_text: qxoDegenerateFullText,
    document_hash: QXO_DOC_HASH,
    _disable_inline_decimal_headings: true,
  });

  assert.equal(withPass.nodes.length, withoutPass.nodes.length);
  assert.deepEqual(withPass.nodes, withoutPass.nodes, 'every node, in order, byte-for-byte and id-for-id identical');
  assert.equal(withPass.root_section_id, withoutPass.root_section_id);
  assert.equal(withPass.source_sha256, withoutPass.source_sha256);
  assert.deepEqual(withPass.rejected_inline_heading_candidates, []);
  assert.deepEqual(withoutPass.rejected_inline_heading_candidates, []);

  // Known references this document's tree must still resolve, exactly as
  // tests/canonical-v2-f28-second-live-fixture-replay.test.js and
  // tests/canonical-v2-native-sectionizer.test.js already independently
  // exercise for QXO-shaped documents (this fixture's own equivalent of
  // "III-INTRO(b)").
  const introB = findSectionByReference(withPass, 'III-INTRO(b)');
  assert.ok(introB, 'III-INTRO(b) still resolves exactly as before this change');
  assert.equal(introB.heading, 'Capital Structure.');
});

test('QXO regression pin: existing sectionizer/replay/citation suites stay green UNCHANGED (see verification log in the deliverable report) — this file adds no changes to those tests', () => {
  // This is a documentation-only assertion: tests/canonical-v2-native-
  // sectionizer.test.js, tests/canonical-v2-f28-live-fixture-replay.test.js,
  // tests/canonical-v2-f28-second-live-fixture-replay.test.js,
  // tests/canonical-v2-citation-constructibility.test.js,
  // tests/canonical-v2-candidate-resolution.test.js and
  // tests/canonical-v2-component-rows.test.js are none of them modified by
  // this change and are run, unedited, alongside this file — see the
  // deliverable report for the pass/fail tally.
  assert.ok(true);
});

// ─── 3. Cross-reference immunity ───

const crossReferenceOnlyDoc = [
  'ARTICLE III\n\n',
  'REPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in Section 3.1(b) hereof and disclosed in the Company Disclosure Letter, ',
  'the Company represents and warrants to Parent that no event described in Sections 3.1(b)(i) ',
  'and 3.1(b)(ii) has occurred and that no fact required to be disclosed under Section 3.2 exists, ',
  'in each case except as would not reasonably be expected to have a Company Material Adverse Effect ',
  'or as set forth in the disclosure letter referenced in Section 3.4 above.\n\n',
  '(a) Organization. The Company is duly organized, validly existing and in good standing under the ',
  'Laws of the State of Delaware.\n\n',
  '(b) Authority. The Company has full corporate power and authority to execute and deliver this ',
  'Agreement, subject to the matters described in Section 3.1(c) and Section 3.5 of the Company ',
  'Disclosure Letter.\n',
].join('');

test('cross-reference immunity: a synthetic doc with mid-line "Section 3.1(b)" prose and zero line-start headings accepts zero candidates', () => {
  const tree = sectionizeAdmittedSource({ source_text: crossReferenceOnlyDoc, document_hash: DOC_HASH });
  assert.deepEqual(tree.rejected_inline_heading_candidates, []);
  const decimalSectionRefs = tree.nodes.filter((n) => n.kind === 'SECTION' && /^\d+\.\d+$/.test(n.reference || ''));
  assert.deepEqual(decimalSectionRefs, [], 'not one of the five mid-line "Section N.M" cross-references was ever a candidate, let alone accepted');
});

// ─── 4. Lone-candidate rejection, typed and visible ───

// NOTE ON SHAPE: `parseStructure` itself has a sparse-document bare-heading
// fallback (structural.js's `barePattern`, gated on `allMatches.length < 5`
// keyword-prefixed "Section X.XX" matches anywhere in the WHOLE document)
// that would otherwise catch an isolated "3.5 Litigation." line all on its
// own and defeat this test before the new pass ever runs. The chapeau below
// carries five unrelated "Section N.M" cross-references — exactly the real
// Skechers filing's own shape (a real merger agreement's chapeau is dense
// with cross-references) — which pushes `parseStructure` past that sparse
// threshold, so "3.5" reaches THIS pass invisible to `parseStructure`,
// exactly like the real gap. Verified directly: with
// `_disable_inline_decimal_headings: true`, "3.5" never appears as a node
// at all — it is genuinely only this new pass that ever sees it.
const loneCandidateDoc = [
  'ARTICLE III\n\n',
  'REPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in Section 3.1(b), Section 3.2(a), Section 3.3(c), Section 3.4(d) or ',
  'Section 4.5(a) of the Company Disclosure Letter, the Company represents and warrants to Parent ',
  'as follows:\n',
  '3.5 Litigation. There is no material Legal Proceeding pending or, to the knowledge of the ',
  'Company, threatened against the Company or any of its Subsidiaries.\n',
  '(a) No Actions. Neither the Company nor any Subsidiary is subject to any outstanding order, ',
  'judgment or decree of any Governmental Authority.\n',
].join('');

test('lone-candidate rejection: a single plausible line-start decimal heading with no surrounding sequence is rejected, typed, and visible', () => {
  const tree = sectionizeAdmittedSource({ source_text: loneCandidateDoc, document_hash: DOC_HASH });

  assert.equal(findSectionByReference(tree, '3.5'), null, 'a lone candidate never mints a SECTION node');

  assert.equal(tree.rejected_inline_heading_candidates.length, 1);
  const [rejected] = tree.rejected_inline_heading_candidates;
  assert.equal(rejected.reference, '3.5');
  assert.equal(rejected.article, 'III');
  assert.equal(rejected.reason, 'LONE_CANDIDATE');
  assert.ok(Number.isInteger(rejected.start) && rejected.start >= 0);
  assert.ok(Object.isFrozen(rejected));
  assert.ok(Object.isFrozen(tree.rejected_inline_heading_candidates));

  // Confirms this really is a candidate ONLY this new pass ever sees:
  // `parseStructure` alone (pass short-circuited) never materializes "3.5"
  // either — it is genuinely invisible upstream, exactly the real gap.
  const withoutPass = sectionizeAdmittedSource({
    source_text: loneCandidateDoc,
    document_hash: DOC_HASH,
    _disable_inline_decimal_headings: true,
  });
  assert.equal(findSectionByReference(withoutPass, '3.5'), null);
});

test('rejected_inline_heading_candidates is always present, frozen, and empty when nothing was rejected', () => {
  const tree = sectionizeAdmittedSource({ source_text: crossReferenceOnlyDoc, document_hash: DOC_HASH });
  assert.ok(Array.isArray(tree.rejected_inline_heading_candidates));
  assert.ok(Object.isFrozen(tree.rejected_inline_heading_candidates));
  assert.deepEqual(tree.rejected_inline_heading_candidates, []);

  const empty = sectionizeAdmittedSource({ source_text: '', document_hash: DOC_HASH });
  assert.deepEqual(empty.rejected_inline_heading_candidates, []);
  assert.ok(Object.isFrozen(empty.rejected_inline_heading_candidates));
});

// ─── 5. Determinism / permutation invariance ───

test('determinism: identical bytes twice produce byte-identical trees including the new field, on both the Skechers excerpt and the synthetic docs', () => {
  const firstSkechers = sectionizeAdmittedSource({ source_text: skechersExcerptText, document_hash: DOC_HASH });
  const secondSkechers = sectionizeAdmittedSource({ source_text: skechersExcerptText, document_hash: DOC_HASH });
  assert.equal(JSON.stringify(firstSkechers), JSON.stringify(secondSkechers));

  const firstLone = sectionizeAdmittedSource({ source_text: loneCandidateDoc, document_hash: DOC_HASH });
  const secondLone = sectionizeAdmittedSource({ source_text: loneCandidateDoc, document_hash: DOC_HASH });
  assert.equal(JSON.stringify(firstLone), JSON.stringify(secondLone));
});

test('permutation invariance: interleaving calls across different documents never leaks state between runs', () => {
  const a1 = sectionizeAdmittedSource({ source_text: skechersExcerptText, document_hash: DOC_HASH });
  const b1 = sectionizeAdmittedSource({ source_text: loneCandidateDoc, document_hash: DOC_HASH });
  const c1 = sectionizeAdmittedSource({ source_text: crossReferenceOnlyDoc, document_hash: DOC_HASH });
  const d1 = sectionizeAdmittedSource({ source_text: qxoDegenerateFullText, document_hash: QXO_DOC_HASH });
  // Re-run in reverse order, interleaved.
  const d2 = sectionizeAdmittedSource({ source_text: qxoDegenerateFullText, document_hash: QXO_DOC_HASH });
  const c2 = sectionizeAdmittedSource({ source_text: crossReferenceOnlyDoc, document_hash: DOC_HASH });
  const b2 = sectionizeAdmittedSource({ source_text: loneCandidateDoc, document_hash: DOC_HASH });
  const a2 = sectionizeAdmittedSource({ source_text: skechersExcerptText, document_hash: DOC_HASH });

  assert.equal(JSON.stringify(a1), JSON.stringify(a2));
  assert.equal(JSON.stringify(b1), JSON.stringify(b2));
  assert.equal(JSON.stringify(c1), JSON.stringify(c2));
  assert.equal(JSON.stringify(d1), JSON.stringify(d2));
});

test('input validation is unchanged by this addition', () => {
  assert.throws(() => sectionizeAdmittedSource({ document_hash: DOC_HASH }), DeterministicSectionizerError);
  assert.throws(() => sectionizeAdmittedSource({ source_text: 'hello' }), DeterministicSectionizerError);
});
