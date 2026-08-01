/**
 * lib/canonical-v2/native-producer/coverage-proxies.js
 *
 * Coverage proxies for a governed section (spec: "Recall and volume
 * instrumentation", item 2; audit finding B1 -- every existing gate is
 * precision-only, nothing measures how much of the governed text a run's
 * proposals actually cover). This module computes two cheap, deterministic
 * proxies and a typed `COVERAGE_SUSPECT` signal when they disagree sharply.
 * A proxy is a smoke alarm, not a proof: it never rejects anything and
 * never constructs a claim -- it only surfaces a typed reason for a human
 * or a later gate to look at.
 *
 * PROXY 1 -- verified-span coverage share: the fraction of the governed
 * section's own bytes that fall inside at least one proposal's evidence
 * span. Spans are assumed to be UTF-8 byte offsets into the SAME governed
 * section text passed in here, matching the convention every other
 * native-producer module uses (see native-extraction-run.js's
 * `checkEvidenceScope`). Overlapping spans are merged before measuring, so
 * two proposals citing the same sentence never double-count.
 *
 * PROXY 2 -- source marker counts vs. qualifiers emitted: counts of four
 * fixed marker strings ("as of", "except", "knowledge", "material") in the
 * governed section's SOURCE text, compared against how many qualifier
 * objects the run actually emitted. These four words are cheap, reliable
 * tells for temporal, exception, knowledge and materiality qualifiers in
 * M&A drafting -- not a parser, just a smoke alarm. Marker counting is
 * case-insensitive and zero-width/bidi-tolerant (comparison only, via
 * `normaliseForMatching` -- see zero-width-normalise.js's header); the
 * SOURCE text itself is never mutated or re-stored.
 *
 * THRESHOLDS (chosen and pinned here, not left to the caller):
 *
 *  - `QUALIFIER_MARKER_RATIO_SUSPECT_THRESHOLD = 0.5`: if the run emits
 *    fewer qualifiers than half the marker count found in the source text,
 *    that is a `QUALIFIER_MARKER_GAP` signal. Calibration against the two
 *    real F28 recordings: the governed section
 *    (tests/fixtures/qxo-section-3-1-b.txt) contains 10 marker hits ("as
 *    of" x5, "except" x4, "material" x1, "knowledge" x0). Run 1 emitted
 *    ~12 qualifiers (ratio 1.2, not suspect -- correctly). Run 2 emitted 2
 *    qualifiers (ratio 0.2, suspect -- correctly; this is exactly the
 *    under-extraction defect 2 in docs/handoffs/F28-SECOND-LIVE-RUN.md).
 *    0.5 sits comfortably between those two real data points and stays
 *    conservative (it does not fire on a merely-thin-but-real qualifier
 *    set, only on a materially short one).
 *  - `COVERAGE_SHARE_SUSPECT_THRESHOLD = 0.5`: if verified-span coverage
 *    falls under half the governed section's bytes, that is a
 *    `LOW_SPAN_COVERAGE` signal. Chosen conservatively: a governed
 *    section's substantive content (chapeaux, limbs, qualifiers together)
 *    should ordinarily cover most of its own bytes once boilerplate
 *    connective prose is discounted; under half is a genuine outlier worth
 *    a human look, not a routine trim.
 *
 * Both signals are independent and either, both, or neither may fire; the
 * `signals` array on the report lists every one that did, each carrying its
 * own typed `reason` and supporting numbers -- never a bare boolean.
 */

'use strict';

const { normaliseForMatching } = require('../zero-width-normalise');

const COVERAGE_PROXY_REPORT_SCHEMA = 'COVERAGE_PROXY_REPORT/V1';

const MARKERS = Object.freeze(['as of', 'except', 'knowledge', 'material']);

const QUALIFIER_MARKER_RATIO_SUSPECT_THRESHOLD = 0.5;
const COVERAGE_SHARE_SUSPECT_THRESHOLD = 0.5;

class CoverageProxiesError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CoverageProxiesError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new CoverageProxiesError(code, message, details);
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

function requireString(value, label) {
  if (typeof value !== 'string') fail('INVALID_INPUT', `${label} must be a string`, { label });
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail('INVALID_INPUT', `${label} must be an array`, { label });
  return value;
}

// Merges half-open [start,end) byte-offset intervals and returns the total
// covered length. Intervals with non-numeric or inverted bounds are
// dropped rather than corrupting the measurement -- a malformed span
// carries no coverage information, it does not get to claim any.
function mergedCoveredLength(spans) {
  const valid = spans
    .filter((span) => span
      && Number.isFinite(span.start)
      && Number.isFinite(span.end)
      && span.end > span.start)
    .map((span) => ({ start: span.start, end: span.end }))
    .sort((a, b) => a.start - b.start);

  let covered = 0;
  let cursor = -Infinity;
  let openEnd = -Infinity;

  for (const span of valid) {
    if (span.start > openEnd) {
      // gap: close out the previous run (if any), start a new one
      if (openEnd > cursor) covered += openEnd - cursor;
      cursor = span.start;
      openEnd = span.end;
    } else if (span.end > openEnd) {
      openEnd = span.end;
    }
  }
  if (openEnd > cursor) covered += openEnd - cursor;

  return covered;
}

function countMarkerOccurrences(normalisedLowerText, marker) {
  if (marker.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const hit = normalisedLowerText.indexOf(marker, from);
    if (hit === -1) break;
    count += 1;
    from = hit + marker.length;
  }
  return count;
}

/**
 * @param {object} args
 * @param {string} args.section_reference        the governed section's reference, for the report only
 * @param {string} args.source_text               the governed section's OWN source text (not the whole document)
 * @param {{start:number,end:number}[]} args.assertion_spans
 *   evidence spans (UTF-8 byte offsets into `source_text`) for every
 *   proposal in this run, governed or open-world.
 * @param {{quote:string}[]} args.qualifiers        every qualifier object this run emitted
 * @returns {object} frozen `COVERAGE_PROXY_REPORT/V1`
 */
function computeCoverageProxies({
  section_reference: sectionReference,
  source_text: sourceText,
  assertion_spans: assertionSpans,
  qualifiers,
} = {}) {
  requireString(sectionReference, 'section_reference');
  requireString(sourceText, 'source_text');
  requireArray(assertionSpans, 'assertion_spans');
  requireArray(qualifiers, 'qualifiers');

  const sourceByteLength = Buffer.byteLength(sourceText, 'utf8');
  const coveredByteLength = Math.min(mergedCoveredLength(assertionSpans), sourceByteLength);
  const coverageShare = sourceByteLength === 0 ? 0 : coveredByteLength / sourceByteLength;

  const normalisedLowerText = normaliseForMatching(sourceText).toLowerCase();
  const markerCounts = {};
  let markerTotal = 0;
  for (const marker of MARKERS) {
    const count = countMarkerOccurrences(normalisedLowerText, marker);
    markerCounts[marker] = count;
    markerTotal += count;
  }

  const qualifiersEmittedCount = qualifiers.length;
  const qualifierToMarkerRatio = markerTotal === 0 ? null : qualifiersEmittedCount / markerTotal;

  const signals = [];

  if (coverageShare < COVERAGE_SHARE_SUSPECT_THRESHOLD) {
    signals.push({
      type: 'COVERAGE_SUSPECT',
      reason: 'LOW_SPAN_COVERAGE',
      coverage_share: coverageShare,
      threshold: COVERAGE_SHARE_SUSPECT_THRESHOLD,
    });
  }

  if (markerTotal > 0 && qualifierToMarkerRatio < QUALIFIER_MARKER_RATIO_SUSPECT_THRESHOLD) {
    signals.push({
      type: 'COVERAGE_SUSPECT',
      reason: 'QUALIFIER_MARKER_GAP',
      qualifiers_emitted_count: qualifiersEmittedCount,
      marker_total: markerTotal,
      ratio: qualifierToMarkerRatio,
      threshold: QUALIFIER_MARKER_RATIO_SUSPECT_THRESHOLD,
    });
  }

  const report = {
    schema_version: COVERAGE_PROXY_REPORT_SCHEMA,
    section_reference: sectionReference,
    source_byte_length: sourceByteLength,
    covered_byte_length: coveredByteLength,
    coverage_share: coverageShare,
    marker_counts: { ...markerCounts, total: markerTotal },
    qualifiers_emitted_count: qualifiersEmittedCount,
    qualifier_to_marker_ratio: qualifierToMarkerRatio,
    signals,
  };

  return deepFreeze(report);
}

module.exports = {
  COVERAGE_PROXY_REPORT_SCHEMA,
  MARKERS,
  QUALIFIER_MARKER_RATIO_SUSPECT_THRESHOLD,
  COVERAGE_SHARE_SUSPECT_THRESHOLD,
  CoverageProxiesError,
  computeCoverageProxies,
};
