/**
 * lib/canonical-v2/native-producer/run-comparator.js
 *
 * Cross-run disagreement diff (spec: "Recall and volume instrumentation",
 * item 1; audit finding B1). Every existing gate in this pipeline is
 * precision-only: it can reject a bad proposal, but nothing measures what a
 * SECOND independent run of the same section proposed that the first run
 * silently dropped. The two recorded F28 live runs
 * (`tests/fixtures/canonical-v2/f28-live-run/` and
 * `.../f28-second-live-run/`) cover the exact same governed section
 * (QXO/TopBuild Section 3.1(b), Capital Structure) and disagree by roughly
 * ten qualifiers (see docs/archive/handoffs/F28-SECOND-LIVE-RUN.md, "honest quality
 * assessment", defect 2) while both pass every existing gate at zero
 * residuals. This module is the standing instrument that would have caught
 * that silently.
 *
 * STANDALONE AND PURE. This module knows nothing about
 * `native-extraction-run.js`'s receipt shape or `candidate-resolution.js`'s
 * internals -- it consumes a small, self-describing "run section view"
 * that a later integration is responsible for projecting out of whichever
 * receipt shape is current at that time. That decoupling is deliberate (see
 * the governing plan, Task 8): this file is a pure diff over two lists of
 * limbs and qualifiers, nothing more.
 *
 * INPUT SHAPE -- `RUN_SECTION_VIEW/V1` (informal, not schema-enforced
 * beyond the shape checks below):
 *   {
 *     run_id: string,                 // identifies which run this is, for the report only
 *     section_reference: string,      // the governed section both runs must share
 *     limbs: [{
 *       limb_path: string[],          // e.g. ["(ii)", "(A)"] -- verbatim path segments
 *       quote: string,                // the assertion's evidence quote
 *       span: {start:number, end:number} | null,  // byte offsets into the
 *                                      // governed section text, when known; null when
 *                                      // this run's shape does not carry spans
 *     }],
 *     qualifiers: [{
 *       limb_path: string[] | null,   // the limb this qualifier attaches to, if any
 *       kind: string | null,
 *       quote: string,
 *     }],
 *   }
 *
 * MATCHING RULES (spec: "limbs by path + span overlap; qualifiers by
 * normalised quote"):
 *
 *  - LIMBS match when their `limb_path` arrays are exactly equal AND their
 *    spans do not disagree: if BOTH sides carry a span, the spans must
 *    overlap; if EITHER side lacks a span, path equality alone decides.
 *    Path equality is required, not optional -- two limbs that happen to
 *    reuse the same flat label from unrelated parents (the exact defect the
 *    first F28 run exhibited, see docs/archive/handoffs/F28-SECOND-LIVE-RUN.md
 *    defect 1) must never be treated as "the same limb" just because a span
 *    happens to overlap.
 *  - QUALIFIERS match on normalised-quote equality alone (zero-width/bidi
 *    marks stripped via `normaliseForMatching`, comparison only -- see
 *    lib/canonical-v2/zero-width-normalise.js's header). `limb_path` and
 *    `kind` are carried through into the report but never used to decide a
 *    match: the two runs disagree about limb structure itself, so anchoring
 *    qualifier matching to limb attachment would hide exactly the
 *    disagreement this instrument exists to surface.
 *  - Matching is one-to-one and greedy in source order: once an item on one
 *    side is matched, it is removed from the candidate pool for later items
 *    on the same side, so a repeated identical quote cannot double-count.
 *
 * OUTPUT is a frozen, content-free (no contentId hashing -- this is a
 * diagnostic report, not a stored record) typed report. Nothing here
 * throws for a disagreement; disagreement is the expected, typed output.
 * This module only throws for malformed call-time input (a programmer
 * error), matching the house convention elsewhere in native-producer/.
 */

'use strict';

const { normaliseForMatching } = require('../zero-width-normalise');

const RUN_SECTION_VIEW_SCHEMA = 'RUN_SECTION_VIEW/V1';
const RUN_COMPARISON_REPORT_SCHEMA = 'RUN_COMPARISON_REPORT/V1';

class RunComparatorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RunComparatorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new RunComparatorError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else {
    Object.values(value).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

function requireRunSectionView(view, label) {
  if (!view || typeof view !== 'object' || Array.isArray(view)) {
    fail('INVALID_INPUT', `${label} must be a plain object`, { label });
  }
  if (typeof view.run_id !== 'string' || view.run_id.length === 0) {
    fail('INVALID_INPUT', `${label}.run_id must be a non-empty string`, { label });
  }
  if (typeof view.section_reference !== 'string' || view.section_reference.length === 0) {
    fail('INVALID_INPUT', `${label}.section_reference must be a non-empty string`, { label });
  }
  if (!Array.isArray(view.limbs)) {
    fail('INVALID_INPUT', `${label}.limbs must be an array`, { label });
  }
  if (!Array.isArray(view.qualifiers)) {
    fail('INVALID_INPUT', `${label}.qualifiers must be an array`, { label });
  }
  return view;
}

function pathsEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((segment, index) => segment === b[index]);
}

function spansOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

// Two limbs "agree" when their paths match exactly and their spans do not
// contradict each other (see file header for the full rule).
function limbsMatch(a, b) {
  if (!pathsEqual(a.limb_path, b.limb_path)) return false;
  if (a.span && b.span) return spansOverlap(a.span, b.span);
  return true;
}

function diffLimbs(limbsA, limbsB) {
  const remainingB = limbsB.map((limb, index) => ({ limb, index, taken: false }));
  const matched = [];
  const onlyInA = [];

  for (const limbA of limbsA) {
    const hit = remainingB.find((entry) => !entry.taken && limbsMatch(limbA, entry.limb));
    if (hit) {
      hit.taken = true;
      matched.push({ a: limbA, b: hit.limb });
    } else {
      onlyInA.push(limbA);
    }
  }

  const onlyInB = remainingB.filter((entry) => !entry.taken).map((entry) => entry.limb);

  return { matched, only_in_a: onlyInA, only_in_b: onlyInB };
}

function diffQualifiers(qualifiersA, qualifiersB) {
  const remainingB = qualifiersB.map((qualifier, index) => ({
    qualifier,
    index,
    taken: false,
    key: normaliseForMatching(qualifier.quote || ''),
  }));
  const matched = [];
  const onlyInA = [];

  for (const qualifierA of qualifiersA) {
    const keyA = normaliseForMatching(qualifierA.quote || '');
    const hit = remainingB.find((entry) => !entry.taken && entry.key === keyA);
    if (hit) {
      hit.taken = true;
      matched.push({ a: qualifierA, b: hit.qualifier });
    } else {
      onlyInA.push(qualifierA);
    }
  }

  const onlyInB = remainingB.filter((entry) => !entry.taken).map((entry) => entry.qualifier);

  return { matched, only_in_a: onlyInA, only_in_b: onlyInB };
}

/**
 * Diffs two `RUN_SECTION_VIEW/V1` objects covering the SAME governed
 * section and returns a frozen `RUN_COMPARISON_REPORT/V1`.
 *
 * @param {object} args
 * @param {object} args.run_a
 * @param {object} args.run_b
 * @returns {object} frozen comparison report
 */
function compareRuns({ run_a: runA, run_b: runB } = {}) {
  requireRunSectionView(runA, 'run_a');
  requireRunSectionView(runB, 'run_b');
  if (runA.section_reference !== runB.section_reference) {
    fail(
      'SECTION_REFERENCE_MISMATCH',
      'compareRuns requires both runs to cover the same governed section',
      { run_a_section: runA.section_reference, run_b_section: runB.section_reference },
    );
  }

  const limbDiff = diffLimbs(runA.limbs, runB.limbs);
  const qualifierDiff = diffQualifiers(runA.qualifiers, runB.qualifiers);

  const report = {
    schema_version: RUN_COMPARISON_REPORT_SCHEMA,
    section_reference: runA.section_reference,
    run_a_id: runA.run_id,
    run_b_id: runB.run_id,
    limbs: {
      matched_count: limbDiff.matched.length,
      only_in_a: limbDiff.only_in_a,
      only_in_b: limbDiff.only_in_b,
    },
    qualifiers: {
      matched_count: qualifierDiff.matched.length,
      only_in_a: qualifierDiff.only_in_a,
      only_in_b: qualifierDiff.only_in_b,
    },
    summary: {
      limb_disagreement_count: limbDiff.only_in_a.length + limbDiff.only_in_b.length,
      qualifier_disagreement_count: qualifierDiff.only_in_a.length + qualifierDiff.only_in_b.length,
    },
  };

  return deepFreeze(report);
}

module.exports = {
  RUN_SECTION_VIEW_SCHEMA,
  RUN_COMPARISON_REPORT_SCHEMA,
  RunComparatorError,
  compareRuns,
};
