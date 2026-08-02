'use strict';

/**
 * tests/canonical-v2-limb-enumeration-scan.test.js
 *
 * Test-first for lib/canonical-v2/native-producer/limb-enumeration-scan.js.
 * Uses the real governed section text (tests/fixtures/qxo-section-3-1-b.txt)
 * and run 2's real (nested) limb_path proposals from the second recorded
 * F28 live run, per the task instructions (raw_response_text parsed via
 * lib/parser-v2/parse-json).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseJSON } = require('../lib/parser-v2/parse-json');
const {
  scanLimbEnumeration,
  scanEnumerationMarkers,
  classifyToken,
  LimbEnumerationScanError,
} = require('../lib/canonical-v2/native-producer/limb-enumeration-scan');

const SOURCE_TEXT = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

function loadRun2LimbPaths() {
  const recording = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json'),
    'utf8',
  ));
  const parsed = parseJSON(recording.raw_response_text);
  assert.ok(parsed);
  const paths = [];
  for (const representation of parsed.representation_instances || []) {
    for (const limb of representation.limbs || []) {
      paths.push(limb.limb_path);
    }
  }
  return paths;
}

test('classifyToken: uppercase single letters are always ALPHA_UPPER', () => {
  assert.equal(classifyToken('A'), 'ALPHA_UPPER');
  assert.equal(classifyToken('Z'), 'ALPHA_UPPER');
  assert.equal(classifyToken('I'), 'ALPHA_UPPER'); // uppercase "I" is not treated as roman here
});

test('classifyToken: multi-letter lowercase roman numerals classify ROMAN', () => {
  assert.equal(classifyToken('ii'), 'ROMAN');
  assert.equal(classifyToken('iii'), 'ROMAN');
  assert.equal(classifyToken('iv'), 'ROMAN');
  assert.equal(classifyToken('ix'), 'ROMAN');
});

test('classifyToken: multi-letter lowercase non-roman is not a marker', () => {
  assert.equal(classifyToken('ab'), null);
  assert.equal(classifyToken('the'), null);
});

test('classifyToken: single ambiguous lowercase letters resolve ROMAN (documented conservative rule)', () => {
  assert.equal(classifyToken('i'), 'ROMAN');
  assert.equal(classifyToken('v'), 'ROMAN');
  assert.equal(classifyToken('x'), 'ROMAN');
});

test('classifyToken: single unambiguous lowercase letters resolve ALPHA_LOWER', () => {
  assert.equal(classifyToken('a'), 'ALPHA_LOWER');
  assert.equal(classifyToken('b'), 'ALPHA_LOWER');
  assert.equal(classifyToken('z'), 'ALPHA_LOWER');
});

test('scanEnumerationMarkers: finds the real governed section markers in order', () => {
  const markers = scanEnumerationMarkers(SOURCE_TEXT);
  const tokens = markers.map((marker) => marker.token);
  // The section's own opening label "(b)" and the real enumeration
  // structure, PLUS every parenthetical the drafting itself repeats in
  // cross-references ("Sections 3.1(b)(i) and 3.1(b)(ii)" inside (iii);
  // "Section 3.1(b)(ii)" inside (ii); "clauses (B) and (C)" inside (iii)).
  // This scan is deliberately a lexical, corroboration-only scan (see file
  // header) -- it does not know these are cross-references, only that the
  // tokens occur in the text, which is the honest, documented behaviour.
  assert.deepEqual(
    tokens,
    [
      '(b)', '(i)', '(A)', '(B)', '(ii)', '(A)', '(B)', '(C)', '(b)', '(ii)',
      '(iii)', '(b)', '(i)', '(b)', '(ii)', '(A)', '(B)', '(C)', '(B)', '(C)', '(iv)', '(v)',
    ],
  );
  // Offsets are real, ordered, half-open byte spans into the source text.
  for (const marker of markers) {
    assert.ok(marker.start >= 0 && marker.end > marker.start);
    assert.equal(
      Buffer.from(SOURCE_TEXT, 'utf8').subarray(marker.start, marker.end).toString('utf8'),
      marker.token,
    );
  }
});

test('scanLimbEnumeration: run 2\'s real limb paths agree with the text scan, up to the section\'s own opening label', () => {
  const proposedLimbPaths = loadRun2LimbPaths();
  const report = scanLimbEnumeration({
    section_reference: '3.1(b)',
    source_text: SOURCE_TEXT,
    proposed_limb_paths: proposedLimbPaths,
  });

  assert.equal(report.schema_version, 'LIMB_ENUMERATION_SCAN_REPORT/V1');

  // Every LIMB_WITHOUT_MARKER disagreement would mean the model proposed a
  // limb whose marker does not exist in the text at all -- run 2's real
  // limb paths were all genuinely enumerated, so there should be none.
  const limbWithoutMarker = report.disagreements.filter((entry) => entry.reason === 'LIMB_WITHOUT_MARKER');
  assert.equal(limbWithoutMarker.length, 0);

  // The section's own opening label "(b)" is now typed
  // SECTION_PARAGRAPH_MARKER (it is the trailing label of this scan's own
  // `section_reference: '3.1(b)'`, consumed as the provision's own
  // citation, never a limb) and TWO of its three repeated occurrences
  // inside the section's own cross-references to itself ("Section
  // ‎3.1(b)(ii)", "Sections ‎3.1(b)(i) and ‎3.1(b)(ii)"'s FIRST "(b)") are
  // typed CROSS_REFERENCE_MARKER via the "Section N.N" lookbehind. The
  // fourth occurrence -- the SECOND "(b)" in "Sections ‎3.1(b)(i) and
  // ‎3.1(b)(ii)" -- elides the word "Section" before its own "3.1" (the
  // drafting states it once for both clauses), so this scan's per-marker
  // lookbehind genuinely cannot classify it a cross-reference and it stays
  // an ordinary (uncorroborated) ENUMERATION_MARKER -- documented residual,
  // not a regression: down from 4 false MARKER_WITHOUT_LIMB findings to 1.
  const markerWithoutLimb = report.disagreements.filter((entry) => entry.reason === 'MARKER_WITHOUT_LIMB');
  assert.equal(markerWithoutLimb.length, 1);
  assert.ok(markerWithoutLimb.every((entry) => entry.token === '(b)'));

  assert.equal(report.classification_counts.section_paragraph_marker, 1);
  assert.equal(report.classification_counts.cross_reference_marker, 2);
  assert.equal(report.disagreement_count, 1);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.disagreements));
});

test('scanLimbEnumeration: a marker present in text but never proposed as a limb is flagged', () => {
  const report = scanLimbEnumeration({
    section_reference: 'x',
    source_text: '(a) first item. (b) second item.',
    proposed_limb_paths: [['(a)']],
  });
  const markerWithoutLimb = report.disagreements.filter((entry) => entry.reason === 'MARKER_WITHOUT_LIMB');
  assert.equal(markerWithoutLimb.length, 1);
  assert.equal(markerWithoutLimb[0].token, '(b)');
});

test('scanLimbEnumeration: a proposed limb with no corresponding marker in the text is flagged', () => {
  const report = scanLimbEnumeration({
    section_reference: 'x',
    source_text: '(a) only item.',
    proposed_limb_paths: [['(a)'], ['(c)']],
  });
  const limbWithoutMarker = report.disagreements.filter((entry) => entry.reason === 'LIMB_WITHOUT_MARKER');
  assert.equal(limbWithoutMarker.length, 1);
  assert.equal(limbWithoutMarker[0].token, '(c)');
});

test('scanLimbEnumeration: duplicate proposed limb paths for the same missing marker are not double-flagged', () => {
  const report = scanLimbEnumeration({
    section_reference: 'x',
    source_text: '(a) only item.',
    proposed_limb_paths: [['(a)', '(x)'], ['(a)', '(x)']],
  });
  const limbWithoutMarker = report.disagreements.filter((entry) => entry.reason === 'LIMB_WITHOUT_MARKER');
  assert.equal(limbWithoutMarker.length, 1);
});

test('scanLimbEnumeration: malformed input throws a typed error', () => {
  assert.throws(() => scanLimbEnumeration({
    section_reference: 'x', source_text: 'text', proposed_limb_paths: [['(a)', 5]],
  }), LimbEnumerationScanError);
  assert.throws(() => scanLimbEnumeration({
    section_reference: 'x', source_text: 123, proposed_limb_paths: [],
  }), LimbEnumerationScanError);
});

// ═══════════════════════════════════════════════════════════════════════
// 2026-08-02 Modiv triage fixes -- see this module's file header,
// "MARKER CONTEXT CLASSIFICATION" and "SEQUENCE-CONTEXT OVERRIDE". The
// Modiv first live run's real committed fixture
// (tests/fixtures/canonical-v2/modiv-first-live-run/) produced 21/21 false
// MARKER_WITHOUT_LIMB findings for governed section "3.2" -- 7 top-level
// paragraph markers "(a)".."(g)" and 14 "Section 3.2(x) [of the Company
// Disclosure Letter]" cross-references, none of them real limbs.
// ═══════════════════════════════════════════════════════════════════════

const LIMB_ASSERTION_CLAIM_KEY = 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE';

function loadModivGovernedSection() {
  const runReceipt = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', 'modiv-first-live-run', 'run-receipt.json'),
    'utf8',
  ));
  const adapterResult = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', 'modiv-first-live-run', 'adapter-result.json'),
    'utf8',
  ));
  const canonicalText = adapterResult.admitted_source_contexts[0].canonical_text.text;
  const section = runReceipt.resolved_sections[0];
  const bytes = Buffer.from(canonicalText, 'utf8');
  const sectionText = bytes.slice(section.start, section.end).toString('utf8');

  // Same projection native-extraction-run.js's own
  // `projectLimbEnumerationScanInput` performs: only LIMB_ASSERTION
  // candidates' own `limb_path` attribute, exactly as the real run wired
  // this scan.
  const proposedLimbPaths = [];
  for (const compiled of runReceipt.compiled_candidates) {
    const claim = compiled.candidate && compiled.candidate.claim;
    if (!claim || claim.claim_definition_key !== LIMB_ASSERTION_CLAIM_KEY) continue;
    const limbPath = claim.attributes && claim.attributes.limb_path;
    if (Array.isArray(limbPath) && limbPath.length > 0) proposedLimbPaths.push(limbPath);
  }

  return {
    section_reference: section.section_reference,
    source_text: sectionText,
    proposed_limb_paths: proposedLimbPaths,
  };
}

test('MODIV REGRESSION: the real first-live-run fixture\'s 21 prior false MARKER_WITHOUT_LIMB findings are now SECTION_PARAGRAPH_MARKER (7) / CROSS_REFERENCE_MARKER (14), zero MARKER_WITHOUT_LIMB/LIMB_WITHOUT_MARKER disagreements', () => {
  const { section_reference: sectionReference, source_text: sourceText, proposed_limb_paths: proposedLimbPaths } = loadModivGovernedSection();
  assert.equal(sectionReference, '3.2');

  const report = scanLimbEnumeration({
    section_reference: sectionReference,
    source_text: sourceText,
    proposed_limb_paths: proposedLimbPaths,
  });

  assert.equal(report.classification_counts.section_paragraph_marker, 7);
  assert.equal(report.classification_counts.cross_reference_marker, 14);
  assert.equal(report.classification_counts.enumeration_marker, 26);
  assert.equal(report.markers_found.length, 47, 'sanity: every marker the old code found is still found -- reclassified, never dropped');

  const markerWithoutLimb = report.disagreements.filter((entry) => entry.reason === 'MARKER_WITHOUT_LIMB');
  assert.equal(markerWithoutLimb.length, 0, 'all 21 prior false positives are eliminated');
  const limbWithoutMarker = report.disagreements.filter((entry) => entry.reason === 'LIMB_WITHOUT_MARKER');
  assert.equal(limbWithoutMarker.length, 0, 'genuine limb detection is not weakened -- every real proposed limb still has a marker');
  // 2026-08-02 Fable review fix (value-aware lone-ambiguous-letter rule):
  // this real fixture's two CROSS_REFERENCE_MARKER "(c)"/"(d)" repeats
  // (citations to the section's own "3.2(c)"/"3.2(d)" elsewhere in the
  // text) sit with no roman/alpha chain neighbour on either side -- neither
  // chain fits, and their roman value is > 1, so they now correctly surface
  // as AMBIGUOUS_MARKER_FAMILY instead of being silently defaulted to
  // ROMAN. This is the fix working as intended, not a regression: it never
  // touches MARKER_WITHOUT_LIMB/LIMB_WITHOUT_MARKER recall, and the
  // SECTION_PARAGRAPH_MARKER(7)/CROSS_REFERENCE_MARKER(14) buckets above are
  // unchanged.
  const ambiguousFamily = report.disagreements.filter((entry) => entry.reason === 'AMBIGUOUS_MARKER_FAMILY');
  assert.equal(ambiguousFamily.length, 2);
  assert.deepEqual(ambiguousFamily.map((entry) => entry.token).sort(), ['(c)', '(d)']);
  assert.equal(report.disagreement_count, 2);

  // Every SECTION_PARAGRAPH_MARKER / CROSS_REFERENCE_MARKER is still
  // present in markers_found -- "never silently dropped".
  const paragraphTokens = report.markers_found
    .filter((m) => m.classification === 'SECTION_PARAGRAPH_MARKER')
    .map((m) => m.token);
  assert.deepEqual(paragraphTokens, ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)']);
});

test('MODIV NEGATIVE CASE: deleting a genuine proposed roman limb still fires MARKER_WITHOUT_LIMB -- the fix does not weaken real recall', () => {
  const { section_reference: sectionReference, source_text: sourceText, proposed_limb_paths: proposedLimbPaths } = loadModivGovernedSection();

  // Section 3.2(g) genuinely enumerates (i) through (vii) in its own text
  // (see tests/fixtures/canonical-v2/modiv-first-live-run) -- drop every
  // proposed limb path that starts with "(iii)" to simulate a run that
  // missed a real roman limb the text plainly contains.
  const withoutIii = proposedLimbPaths.filter((path) => path[0] !== '(iii)');
  assert.ok(withoutIii.length < proposedLimbPaths.length, 'sanity: at least one "(iii)" limb path was actually removed');

  const report = scanLimbEnumeration({
    section_reference: sectionReference,
    source_text: sourceText,
    proposed_limb_paths: withoutIii,
  });

  const markerWithoutLimb = report.disagreements.filter((entry) => entry.reason === 'MARKER_WITHOUT_LIMB');
  assert.ok(markerWithoutLimb.some((entry) => entry.token === '(iii)' && entry.family === 'ROMAN'),
    'a genuinely missing roman limb still surfaces as MARKER_WITHOUT_LIMB');
});

// ─── Sequence-context family resolution (fix (c)): "(c)"/"(d)" resolve
// ALPHA_LOWER, not the context-free ROMAN default, when they sit in an
// ordinary alpha run; a genuine roman run still resolves ROMAN; a real
// local conflict is typed AMBIGUOUS_MARKER_FAMILY, never guessed. ───

test('sequence-context override: "(c)" between "(b)" and "(d)" alpha markers resolves ALPHA_LOWER, not the context-free ROMAN default', () => {
  const text = '(a) first. (b) second. (c) third. (d) fourth. (e) fifth.';
  const markers = scanEnumerationMarkers(text);
  const byToken = (token) => markers.find((m) => m.token === token);
  assert.equal(byToken('(c)').family, 'ALPHA_LOWER');
  assert.equal(byToken('(d)').family, 'ALPHA_LOWER');
  // Unambiguous neighbours are unaffected.
  assert.equal(byToken('(a)').family, 'ALPHA_LOWER');
  assert.equal(byToken('(b)').family, 'ALPHA_LOWER');
  assert.equal(byToken('(e)').family, 'ALPHA_LOWER');
});

test('sequence-context override: a genuine roman run ("(iv)","(v)","(vi)") still resolves "(v)" ROMAN', () => {
  const text = 'item (iv) then item (v) then item (vi).';
  const markers = scanEnumerationMarkers(text);
  const v = markers.find((m) => m.token === '(v)');
  assert.equal(v.family, 'ROMAN');
});

test('sequence-context override: an isolated ambiguous letter with no neighbours in either chain keeps the documented context-free default', () => {
  const markers = scanEnumerationMarkers('the only marker here is (i), nothing else nearby.');
  assert.equal(markers.length, 1);
  assert.equal(markers[0].family, 'ROMAN', 'no local evidence either way -- classifyToken\'s one-sided default stands, not a guess');
});

test('sequence-context override (2026-08-02 Fable review fix, value-aware rule): an isolated ambiguous letter OTHER than "(i)" -- roman value > 1 -- is typed AMBIGUOUS_MARKER_FAMILY, never guessed into either family', () => {
  const markers = scanEnumerationMarkers('the only marker here is (c), nothing else nearby.');
  assert.equal(markers.length, 1);
  assert.equal(markers[0].family, 'AMBIGUOUS_MARKER_FAMILY', 'a lone "(c)" (roman value 100) has no lopsided real-world prior like "(i)" does -- it is never silently guessed');
});

test('sequence-context override: a marker with only one fitting chain is never flagged ambiguous', () => {
  // "(c)" between "(b)" (alpha fit: b+1=c) and "(ii)" (roman value 2 -- not
  // one away from decimal(c)=100, so no roman fit): only the alpha chain
  // fits, so this resolves cleanly to ALPHA_LOWER, not AMBIGUOUS.
  const text = '(b) one. (c) two. (ii) three.';
  const markers = scanEnumerationMarkers(text);
  assert.equal(markers.find((m) => m.token === '(c)').family, 'ALPHA_LOWER');
});

test('sequence-context override: a genuine local conflict (both an alpha chain and a roman chain fit) types AMBIGUOUS_MARKER_FAMILY and is routed to the report, never guessed', () => {
  // "(c)" sits between "(b)" (alpha fit: b+1=c) and "(ci)" (roman: decimal
  // 101, and 101-1=100=decimal(c), so the roman successor chain fits too)
  // -- a genuine, contrived-but-real conflict between the two chains.
  const text = '(b) one. (c) two. (ci) three.';
  const markers = scanEnumerationMarkers(text);
  const c = markers.find((m) => m.token === '(c)');
  assert.equal(c.family, 'AMBIGUOUS_MARKER_FAMILY');
});

test('scanLimbEnumeration: an AMBIGUOUS_MARKER_FAMILY marker is still routed to disagreements (reported, not silently dropped), and still participates in the ordinary token comparison', () => {
  const text = '(b) one. (c) two. (ci) three.';
  const report = scanLimbEnumeration({
    section_reference: 'x',
    source_text: text,
    proposed_limb_paths: [['(b)'], ['(c)'], ['(ci)']],
  });
  const ambiguous = report.disagreements.filter((entry) => entry.reason === 'AMBIGUOUS_MARKER_FAMILY');
  assert.equal(ambiguous.length, 1);
  assert.equal(ambiguous[0].token, '(c)');
  // Still corroborated as present -- every proposed token here has a real
  // marker, so no MARKER_WITHOUT_LIMB/LIMB_WITHOUT_MARKER entries.
  assert.equal(report.disagreements.filter((entry) => entry.type === 'LIMB_ENUMERATION_DISAGREEMENT' && entry.reason !== 'AMBIGUOUS_MARKER_FAMILY').length, 0);
});

// ─── Bare-reference SECTION_PARAGRAPH_MARKER over-suppression (2026-08-02
// Fable review fix): a line-start alpha marker with no proposed limb must
// NOT be swallowed into SECTION_PARAGRAPH_MARKER when another member of the
// SAME alpha chain WAS proposed as a limb -- siblings proposed as limbs
// mean the whole chain is a genuine limb list, and the un-proposed one is a
// real gap, not the section's own paragraph label. ───

// Each marker must sit at a genuine line start (isLineStart) to even reach
// the bare-reference SECTION_PARAGRAPH_MARKER branch at all -- same
// newline-separated shape as the Modiv "3.2" fixture's own (a)-(g)
// paragraph labels, unlike the mid-line "(a) first item. (b) second item."
// shape used elsewhere in this file (which never reaches that branch,
// isLineStart being false for the mid-line markers).
const ALPHA_CHAIN_LINE_START_TEXT = '(a)First item.\n(b)Second item.\n(c)Third item.\n';

test('bare-reference SECTION_PARAGRAPH_MARKER over-suppression fix: (a)(b)(c) proposed as (a) and (c) only -- (b) stays ENUMERATION_MARKER and fires MARKER_WITHOUT_LIMB, never swallowed as a paragraph label', () => {
  const report = scanLimbEnumeration({
    section_reference: 'x', // bare reference -- no trailing label
    source_text: ALPHA_CHAIN_LINE_START_TEXT,
    proposed_limb_paths: [['(a)'], ['(c)']],
  });

  const bMarker = report.markers_found.find((m) => m.token === '(b)');
  assert.equal(bMarker.classification, 'ENUMERATION_MARKER', '(b) has proposed siblings (a) and (c) in its own alpha chain -- it is a genuine limb-list gap, not a paragraph label');

  const markerWithoutLimb = report.disagreements.filter((entry) => entry.reason === 'MARKER_WITHOUT_LIMB');
  assert.equal(markerWithoutLimb.length, 1);
  assert.equal(markerWithoutLimb[0].token, '(b)');
});

test('bare-reference SECTION_PARAGRAPH_MARKER rule still applies when NO sibling of the chain was proposed at all -- an entirely un-proposed alpha chain still reads as paragraph labels', () => {
  const report = scanLimbEnumeration({
    section_reference: 'x',
    source_text: ALPHA_CHAIN_LINE_START_TEXT,
    proposed_limb_paths: [['(i)']], // no alpha proposals whatsoever
  });

  const classifications = ['(a)', '(b)', '(c)'].map((token) => report.markers_found.find((m) => m.token === token).classification);
  assert.deepEqual(classifications, ['SECTION_PARAGRAPH_MARKER', 'SECTION_PARAGRAPH_MARKER', 'SECTION_PARAGRAPH_MARKER']);
  const markerWithoutLimb = report.disagreements.filter((entry) => entry.reason === 'MARKER_WITHOUT_LIMB');
  assert.equal(markerWithoutLimb.length, 0);
});

test('MODIV REPLAY (regression guard for the over-suppression fix): the real Modiv fixture\'s 7 SECTION_PARAGRAPH_MARKER / 14 CROSS_REFERENCE_MARKER buckets are undisturbed -- the (a)-(g) paragraph chain has no genuine alpha-family sibling proposed (some proposed limb_path segments are single letters like "(i)"/"(v)", but those resolve to the ROMAN family in this scan\'s own resolution, never ALPHA_LOWER, so the new sibling check never fires for the (a)-(g) chain)', () => {
  const { section_reference: sectionReference, source_text: sourceText, proposed_limb_paths: proposedLimbPaths } = loadModivGovernedSection();

  const report = scanLimbEnumeration({
    section_reference: sectionReference,
    source_text: sourceText,
    proposed_limb_paths: proposedLimbPaths,
  });

  assert.equal(report.classification_counts.section_paragraph_marker, 7);
  assert.equal(report.classification_counts.cross_reference_marker, 14);
  assert.equal(report.classification_counts.enumeration_marker, 26);
  // MARKER_WITHOUT_LIMB/LIMB_WITHOUT_MARKER recall is unaffected by the
  // sibling-check fix (unrelated AMBIGUOUS_MARKER_FAMILY findings from the
  // separate value-aware-rule fix are covered by the "MODIV REGRESSION"
  // test above, not this one).
  const markerWithoutLimb = report.disagreements.filter((entry) => entry.reason === 'MARKER_WITHOUT_LIMB');
  const limbWithoutMarker = report.disagreements.filter((entry) => entry.reason === 'LIMB_WITHOUT_MARKER');
  assert.equal(markerWithoutLimb.length, 0);
  assert.equal(limbWithoutMarker.length, 0);
});
