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

  // The section's own opening label "(b)" (and its repeated occurrences
  // inside the section's own cross-references to itself, e.g. "Sections
  // 3.1(b)(i) and 3.1(b)(ii)") is not itself a proposed limb (limb paths
  // start at "(i)"), so every "(b)" occurrence is EXPECTED to surface as
  // MARKER_WITHOUT_LIMB -- documented, not a defect: this scan does not
  // know "(b)" is the section's own header or that these are
  // cross-references, only that no limb ever cites the bare token "(b)".
  const markerWithoutLimb = report.disagreements.filter((entry) => entry.reason === 'MARKER_WITHOUT_LIMB');
  assert.equal(markerWithoutLimb.length, 4);
  assert.ok(markerWithoutLimb.every((entry) => entry.token === '(b)'));

  assert.equal(report.disagreement_count, 4);
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
