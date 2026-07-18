/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/span-residual.js — the residual invariant (Part 3).

   Span accounting spec (docs/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md),
   Part 3, REPORT-ONLY rollout gate 1: given a section's Part 1 leaves and
   the union of claimedSpans (Part 2) that extraction's emitted items
   actually cover, `computeSectionResidual` finds what's LEFT — leaf spans no
   emitted item claimed at all.

   residual = leaf spans NOT covered by any item's claimedSpans, ignoring:
     (a) leaves shorter than 200 normalized chars (too small to matter —
         mirrors computeCoverage's minGapChars threshold pattern), and
     (b) chapeau leaves (marker: null) whose text is pure preamble
         boilerplate (a transitional/introductory sentence carrying no
         substantive obligation of its own).

   If residualChars / sectionChars > 0.25 OR any single leaf > 1,500 chars is
   unclaimed → the section is flagged EXTRACTION_INCOMPLETE with the dropped
   spans' markers + text previews.

   This module ONLY computes the flag/report — nothing here enforces
   anything or changes extraction/ingest behavior. See
   scripts/span-residual-baseline.js for the corpus-wide report-only run
   (rollout gate 1). Enforcement (rollout gate 2 — a targeted re-extract on
   EXTRACTION_INCOMPLETE) and the ingest-qa gate (rollout gate 3) are
   deliberately NOT implemented here — out of scope for this pass.
   ───────────────────────────────────────────────────────────────────────── */

const { segmentSubClauses } = require('./subclauses');

const MIN_RESIDUAL_LEAF_CHARS = 200;
const RESIDUAL_RATIO_THRESHOLD = 0.25;
const SINGLE_LEAF_THRESHOLD = 1500;
const PREVIEW_CHARS = 160;

// Chapeau/preamble boilerplate — introductory or transitional language that
// carries no obligation of its own (mirrors the kind of phrase
// lib/verification.js's ancillary/charter-boilerplate detectors already
// treat as structurally inert, applied here to a leaf's OWN text rather
// than a whole-document region).
const BENIGN_CHAPEAU_RE = new RegExp(
  [
    '^(?:the\\s+following|each\\s+of\\s+the\\s+following|as\\s+follows)\\b',
    '\\bsubject\\s+to\\s+the\\s+(?:foregoing|following)\\b',
    '\\bsatisfaction\\s+or\\s+waiver\\s+of\\s+(?:each|the\\s+following)',
    '\\bare\\s+subject\\s+to\\s+the\\s+satisfaction\\b',
    '\\bfurther\\s+conditions?:?\\s*$',
  ].join('|'),
  'i',
);

function isBenignChapeau(leaf) {
  if (leaf.marker !== null) return false;
  const trimmed = leaf.text.trim();
  // Short + matches a transitional-phrase pattern -> boilerplate, not
  // substantive content that could hide a dropped provision.
  return trimmed.length < 400 && BENIGN_CHAPEAU_RE.test(trimmed);
}

// True if [leaf.start, leaf.end) is covered by ANY claimed span's range
// (full or partial overlap counts as "claimed" — a partially-quoted leaf
// was at least partly accounted for by the extraction, and partial
// under-quoting is quote-verification's job, not this invariant's).
function isClaimed(leaf, claimedSpans) {
  return claimedSpans.some((span) => span.start < leaf.end && span.end > leaf.start);
}

/**
 * computeSectionResidual(sectionText, claimedSpans) →
 *   { sectionChars, leafCount, residualChars, residualRatio, flagged, drops }
 *
 * `claimedSpans` — the union of every emitted item's `claimedSpans` for this
 * section (see span-claims.js's computeSpanClaims). Pass `[]` for a section
 * with zero extracted items (residual = the whole section, correctly
 * flagged if it clears the size thresholds).
 */
function computeSectionResidual(sectionText, claimedSpans) {
  const text = String(sectionText || '');
  const leaves = segmentSubClauses(text);
  const spans = Array.isArray(claimedSpans) ? claimedSpans : [];

  const drops = [];
  let residualChars = 0;
  for (const leaf of leaves) {
    const leafChars = leaf.end - leaf.start;
    if (leafChars < MIN_RESIDUAL_LEAF_CHARS) continue; // (a) too small to matter
    if (isBenignChapeau(leaf)) continue; // (b) pure preamble boilerplate
    if (isClaimed(leaf, spans)) continue;
    residualChars += leafChars;
    drops.push({
      marker: leaf.marker,
      depth: leaf.depth,
      start: leaf.start,
      end: leaf.end,
      length: leafChars,
      preview: leaf.text.trim().slice(0, PREVIEW_CHARS),
    });
  }

  const sectionChars = text.length;
  const residualRatio = sectionChars > 0 ? residualChars / sectionChars : 0;
  const largestDrop = drops.reduce((max, d) => Math.max(max, d.length), 0);
  const flagged = residualRatio > RESIDUAL_RATIO_THRESHOLD || largestDrop > SINGLE_LEAF_THRESHOLD;

  drops.sort((a, b) => b.length - a.length);

  return {
    sectionChars,
    leafCount: leaves.length,
    residualChars,
    residualRatio,
    flagged,
    flagReason: flagged ? 'EXTRACTION_INCOMPLETE' : null,
    drops,
  };
}

module.exports = {
  computeSectionResidual,
  MIN_RESIDUAL_LEAF_CHARS,
  RESIDUAL_RATIO_THRESHOLD,
  SINGLE_LEAF_THRESHOLD,
};
