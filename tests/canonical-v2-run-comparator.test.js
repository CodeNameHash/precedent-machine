'use strict';

/**
 * tests/canonical-v2-run-comparator.test.js
 *
 * Test-first for lib/canonical-v2/native-producer/run-comparator.js.
 *
 * Fixture note (see the plan's Task 8 instructions): the motivating
 * fixture is the ~10-qualifier disagreement between the two REAL recorded
 * F28 live runs (docs/archive/handoffs/F28-SECOND-LIVE-RUN.md, "honest quality
 * assessment", defect 2). Both recordings exist in this repo:
 *   - tests/fixtures/canonical-v2/f28-live-run/qxo-topbuild-3-1-b-live-response.json (run 1)
 *   - tests/fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json (run 2)
 * so this test drives the comparator against the two REAL recordings, not
 * a synthetic perturbation.
 *
 * ADAPTER, NOT PIPELINE INTEGRATION: run-comparator.js is a standalone pure
 * module that consumes a small `RUN_SECTION_VIEW/V1` shape (see its header)
 * -- it does not know about native-extraction-run.js's receipt shape. This
 * test file owns the (test-only) projection from the two runs' raw
 * producer JSON into that shape, using `parseJSON` to read
 * `raw_response_text` per the task instructions, and locates each quote's
 * byte span in the governed section's real source text
 * (tests/fixtures/qxo-section-3-1-b.txt) using the zero-width-tolerant
 * matcher for COMPARISON only (never mutating stored text).
 *
 * Run 1's raw shape fragments the representation into many
 * `representation_instances`, each carrying a flat `limb_reference`
 * ("(A)", "(i)", …) rather than run 2's nested `limb_path` arrays. To make
 * the two runs' limbs path-comparable, this adapter reconstructs run 1's
 * effective path from its (section_reference's own trailing marker,
 * limb_reference) pair -- e.g. section_reference "3.1(b)(ii)" +
 * limb_reference "(A)" -> path ["(ii)", "(A)"]; when limb_reference equals
 * the section's own trailing marker (the chapeau fragment), path is just
 * ["(ii)"]. This is test-fixture plumbing, not a lib change.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseJSON } = require('../lib/parser-v2/parse-json');
const { indexOfIgnoringZeroWidth, normaliseForMatching } = require('../lib/canonical-v2/zero-width-normalise');
const {
  compareRuns,
  RunComparatorError,
} = require('../lib/canonical-v2/native-producer/run-comparator');

const SOURCE_TEXT = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

function loadRecordedResponse(relativePath) {
  const recording = JSON.parse(fs.readFileSync(path.join(__dirname, relativePath), 'utf8'));
  const parsed = parseJSON(recording.raw_response_text);
  assert.ok(parsed, `recorded fixture at ${relativePath} must parse via parseJSON`);
  return parsed;
}

// Locates `quote`'s byte span inside `sourceText`, zero-width tolerant.
// Returns null when the quote cannot be located (some run-1 fragments cite
// text outside this single-section fixture, e.g. cross-references).
function locateSpan(sourceText, quote) {
  const startChar = indexOfIgnoringZeroWidth(sourceText, quote);
  if (startChar === -1) return null;
  const normalisedNeedleLength = normaliseForMatching(quote).length;
  let consumed = 0;
  let endChar = startChar;
  while (consumed < normalisedNeedleLength && endChar < sourceText.length) {
    if (!/[​‌‍‎‏﻿­]/.test(sourceText[endChar])) {
      consumed += 1;
    }
    endChar += 1;
  }
  const byteStart = Buffer.byteLength(sourceText.slice(0, startChar), 'utf8');
  const byteEnd = byteStart + Buffer.byteLength(sourceText.slice(startChar, endChar), 'utf8');
  return { start: byteStart, end: byteEnd };
}

// Extracts the trailing "(x)" marker group from a section reference like
// "3.1(b)(ii)" -> "(ii)".
function trailingMarker(sectionReference) {
  const match = /\(([^()]+)\)\s*$/.exec(sectionReference);
  return match ? `(${match[1]})` : null;
}

function runOneSectionView(recorded) {
  const limbs = [];
  const qualifiers = [];

  for (const representation of recorded.representation_instances || []) {
    const outer = trailingMarker(representation.section_reference || '');
    for (const limb of representation.limbs || []) {
      const limbPath = limb.limb_reference === outer || !outer
        ? [limb.limb_reference]
        : [outer, limb.limb_reference];
      limbs.push({
        limb_path: limbPath,
        quote: limb.assertion_quote,
        span: locateSpan(SOURCE_TEXT, limb.assertion_quote),
      });
      for (const qualifier of limb.qualifiers || []) {
        qualifiers.push({
          limb_path: limbPath,
          kind: qualifier.kind || null,
          quote: qualifier.quote,
        });
      }
    }
  }

  return {
    run_id: 'f28-live-run-1',
    section_reference: '3.1(b)',
    limbs,
    qualifiers,
  };
}

function runTwoSectionView(recorded) {
  const limbs = [];
  const qualifiers = [];

  for (const representation of recorded.representation_instances || []) {
    for (const limb of representation.limbs || []) {
      const limbPath = limb.limb_path;
      limbs.push({
        limb_path: limbPath,
        quote: limb.assertion_quote,
        span: locateSpan(SOURCE_TEXT, limb.assertion_quote),
      });
      // Run 2's own shape nests limb-level qualifiers under the limb, when present.
      for (const qualifier of limb.qualifiers || []) {
        qualifiers.push({
          limb_path: limbPath,
          kind: qualifier.kind || null,
          quote: qualifier.quote,
        });
      }
    }
    // Run 2's PROMPT_VERSION 2 shape instead carries qualifiers at the
    // REPRESENTATION level, each with its own `attachment.governs_path`
    // pointing at the limb it qualifies (see the run-2 recording's two
    // THRESHOLD entries) -- this is exactly defect 2 from docs/archive/handoffs/
    // F28-SECOND-LIVE-RUN.md: representation-level qualifiers, not
    // limb-level ones.
    for (const qualifier of representation.qualifiers || []) {
      const governsPath = (qualifier.attachment && qualifier.attachment.governs_path) || null;
      qualifiers.push({
        limb_path: governsPath,
        kind: qualifier.kind || null,
        quote: qualifier.quote,
      });
    }
  }

  return {
    run_id: 'f28-live-run-2',
    section_reference: '3.1(b)',
    limbs,
    qualifiers,
  };
}

test('compareRuns: the two real F28 recordings disagree by roughly ten qualifiers', () => {
  const run1Raw = loadRecordedResponse('fixtures/canonical-v2/f28-live-run/qxo-topbuild-3-1-b-live-response.json');
  const run2Raw = loadRecordedResponse('fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json');

  const runA = runOneSectionView(run1Raw);
  const runB = runTwoSectionView(run2Raw);

  // Sanity on the fixture itself before trusting the comparator's output:
  // run 1 emits far more qualifier objects than run 2 (docs/archive/handoffs/
  // F28-SECOND-LIVE-RUN.md, defect 2).
  assert.ok(runA.qualifiers.length >= 10, `expected run 1 to carry ~12 qualifiers, got ${runA.qualifiers.length}`);
  assert.ok(runB.qualifiers.length <= 3, `expected run 2 to carry ~2 qualifiers, got ${runB.qualifiers.length}`);

  const report = compareRuns({ run_a: runA, run_b: runB });

  assert.equal(report.schema_version, 'RUN_COMPARISON_REPORT/V1');
  assert.equal(report.section_reference, '3.1(b)');
  assert.equal(report.run_a_id, 'f28-live-run-1');
  assert.equal(report.run_b_id, 'f28-live-run-2');

  // The headline instrument: run 1 proposed qualifiers run 2 did not, and
  // the count is in the "roughly ten" band the audit finding describes.
  // docs/archive/handoffs/F28-SECOND-LIVE-RUN.md describes "roughly a dozen" run-1
  // qualifier objects against run 2's 2, so run-1-only is expected in the
  // high single digits to mid teens, not an exact fixed count.
  assert.ok(
    report.qualifiers.only_in_a.length >= 8 && report.qualifiers.only_in_a.length <= 18,
    `expected roughly ten qualifiers only in run 1, got ${report.qualifiers.only_in_a.length}`,
  );
  assert.equal(report.summary.qualifier_disagreement_count >= 8, true);

  // Frozen, typed report -- never silently mutable.
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.qualifiers.only_in_a));
  assert.throws(() => { report.section_reference = 'mutated'; });
});

test('compareRuns: identical runs disagree on nothing', () => {
  const run2Raw = loadRecordedResponse('fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json');
  const runA = runTwoSectionView(run2Raw);
  const runB = { ...runTwoSectionView(run2Raw), run_id: 'run-2-replay' };

  const report = compareRuns({ run_a: runA, run_b: runB });

  assert.equal(report.limbs.only_in_a.length, 0);
  assert.equal(report.limbs.only_in_b.length, 0);
  assert.equal(report.qualifiers.only_in_a.length, 0);
  assert.equal(report.qualifiers.only_in_b.length, 0);
  assert.equal(report.summary.limb_disagreement_count, 0);
  assert.equal(report.summary.qualifier_disagreement_count, 0);
});

test('compareRuns: a reused flat limb label across unrelated parents is NOT treated as a match', () => {
  // Regression guard for the exact defect run 1 exhibited (docs/archive/handoffs/
  // F28-SECOND-LIVE-RUN.md, defect 1): two distinct assertions that happen
  // to reuse the same bare limb label ("(i)") from different parents must
  // never be collapsed into "the same limb" just because a span overlaps.
  const runA = {
    run_id: 'run-a',
    section_reference: '3.1(b)',
    limbs: [
      { limb_path: ['(i)'], quote: 'first assertion under (i)', span: { start: 0, end: 20 } },
    ],
    qualifiers: [],
  };
  const runB = {
    run_id: 'run-b',
    section_reference: '3.1(b)',
    limbs: [
      { limb_path: ['(ii)', '(A)'], quote: 'unrelated assertion under (ii)(A)', span: { start: 0, end: 20 } },
    ],
    qualifiers: [],
  };

  const report = compareRuns({ run_a: runA, run_b: runB });
  assert.equal(report.limbs.matched_count, 0);
  assert.equal(report.limbs.only_in_a.length, 1);
  assert.equal(report.limbs.only_in_b.length, 1);
});

test('compareRuns: qualifiers match on normalised quote, zero-width tolerant', () => {
  const runA = {
    run_id: 'run-a',
    section_reference: '3.1(b)',
    limbs: [],
    qualifiers: [{ limb_path: ['(i)'], kind: 'TEMPORAL', quote: 'as of the close of business' }],
  };
  const runB = {
    run_id: 'run-b',
    section_reference: '3.1(b)',
    limbs: [],
    // Same words, with a zero-width joiner inserted -- must still match.
    qualifiers: [{ limb_path: ['(i)'], kind: 'TEMPORAL', quote: 'as of the​ close of business' }],
  };

  const report = compareRuns({ run_a: runA, run_b: runB });
  assert.equal(report.qualifiers.matched_count, 1);
  assert.equal(report.qualifiers.only_in_a.length, 0);
  assert.equal(report.qualifiers.only_in_b.length, 0);
});

test('compareRuns: mismatched section_reference is a typed error, not a silent diff', () => {
  const runA = { run_id: 'a', section_reference: '3.1(b)', limbs: [], qualifiers: [] };
  const runB = { run_id: 'b', section_reference: '5.2', limbs: [], qualifiers: [] };
  assert.throws(() => compareRuns({ run_a: runA, run_b: runB }), RunComparatorError);
});

test('compareRuns: malformed input throws RunComparatorError, not a silent pass-through', () => {
  assert.throws(() => compareRuns({ run_a: null, run_b: {} }), RunComparatorError);
  assert.throws(() => compareRuns({
    run_a: { run_id: 'a', section_reference: 'x', limbs: 'not-an-array', qualifiers: [] },
    run_b: { run_id: 'b', section_reference: 'x', limbs: [], qualifiers: [] },
  }), RunComparatorError);
});
