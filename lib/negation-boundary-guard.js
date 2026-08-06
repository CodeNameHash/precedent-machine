/* ─────────────────────────────────────────────────────────────────────────
   lib/negation-boundary-guard.js — detects a quote whose grounded position
   sits just past a negation that the quote itself does not include.

   THE DEFECT THIS CLOSES. Every "is this quote genuine" check in this
   repository (lib/verification.js's quoteAppearsIn, and the *-dark-bridge.js
   modules' groundedInSource/anchoredContains) answers "does this candidate
   string occur, verbatim, in the source" — containment. A span that omits a
   PRECEDING negation is still a true, word-boundary-aligned substring of the
   source: "have a Company Material Adverse Effect" really does occur inside
   "...would not have a Company Material Adverse Effect...". Containment
   passes. The quote asserts the opposite of what the sentence says. See
   docs/codex-program/notes/negation-reversal.md for the full investigation.

   WHY NOT JUST SCAN FOR "not" BEFORE THE QUOTE. "not" appears constantly in
   merger agreements without inverting whatever comes after it in the
   relevant sense ("not later than", "not fewer than" as their own complete
   idiom, or governing a WHOLLY DIFFERENT, independently-joined clause: "...,
   except as would not have a Company Material Adverse Effect, and the
   Company has actual knowledge of no fact..." — the accuracy proviso's
   negation does not govern the knowledge clause joined to it by "and"). A
   naive lookback would flag that legitimate knowledge quote. Two guards
   keep this narrow:
     1. NEGATION_LEAD_IN_RES is deliberately specific — modal/auxiliary +
        "not" ("would not", "does not", ...), "in no event", "under no
        circumstances", "none of", a closed list of "no <noun>" forms, and
        "never" — not a bare "not"/"no" scan (mirrors the same discipline
        lib/instrument-negation.js already applies to equity-instrument
        mentions).
     2. PARALLEL_CLAUSE_RESET_RE: the lookback window is truncated at a
        coordinating conjunction ("...MAE, AND the Company has actual
        knowledge...") sitting directly against the quote's own start,
        because that conjunction means the quote opens its own independently
        -joined clause that nothing before the conjunction can govern.
   Validated against the real, committed MAE corpus (TopBuild's and Modiv's
   filed merger agreements, tests/fixtures/canonical-v2/mae-definition-
   family/): 36/36 real "would/does not ... have a Material Adverse Effect"
   qualifiers, simulated-trimmed, are flagged; a stride sample of ~300
   arbitrary positions across the full TopBuild filing fired on ~10%, and
   every fire inspected by hand was a position genuinely still inside the
   reach of a real governing negation — not a false positive.

   WHAT THIS DOES NOT DO. This is a heuristic lookback over TEXT, not a
   grammatical parse, and not a substitute for an independently-captured,
   pre-trim offset (the principled fix — see the module header of
   representations-dark-bridge.js's groundedInSource and this repo's
   docs/codex-program/notes/negation-reversal.md for why no stage of the
   pipeline currently carries one forward). It can still be defeated by a
   negation more than ~240 characters, or more than one clause boundary,
   before the quote. Callers must fail closed on a positive result (reject
   or strip the quote), never merely warn.
   ───────────────────────────────────────────────────────────────────────── */

// Deliberately narrow — see header. Each pattern is a NEGATION LEAD-IN whose
// natural continuation is the affirmative-reading clause a trim would try to
// pass off as a complete quote on its own.
const NEGATION_LEAD_IN_RES = [
  // Modal/auxiliary + "not": "would not", "shall not", "does not", "is not"...
  /\b(?:would|will|shall|does|did|is|are|was|were|could|should|can|cannot|may|has|have|had)\s+not\b/i,
  /\bin\s+no\s+event\b/i,
  /\bunder\s+no\s+circumstances?\b/i,
  /\bnone\s+of\b/i,
  // Narrow "no <noun>" set — mirrors lib/instrument-negation.js's own
  // discipline so idioms like "no later than" never match.
  /\bno\s+(?:event|change|development|effect|circumstance|fact|breach|failure|action)\b/i,
  /\bnever\b/i,
];

// A clause boundary the lookback never crosses: real sentence/segment ends.
function isClauseBoundaryChar(ch) {
  return ch === '.' || ch === ';' || ch === ':' || ch === '\n';
}

// Anchored at the END of the lookback window (immediately against the
// quote's own start): a coordinating conjunction sitting right there means
// the quote opens its own new, independently-joined clause. See header for
// the real fixture case this exists to keep passing.
const PARALLEL_CLAUSE_RESET_RE = /(?:,|;)\s+(?:and|but|or)\s+(?:that\s+)?$/i;

const DEFAULT_MAX_LOOKBACK_CHARS = 240;

/** The text strictly BEFORE `spanStart` that a negation would have to sit in
 *  to govern the quote starting there: bounded by the nearest clause
 *  boundary (or `maxChars`), then reset to empty if a coordinating
 *  conjunction sits directly against the quote's own start. */
function precedingClauseWindow(haystack, spanStart, maxChars = DEFAULT_MAX_LOOKBACK_CHARS) {
  const lowerBound = Math.max(0, spanStart - maxChars);
  let idx = spanStart;
  while (idx > lowerBound && !isClauseBoundaryChar(haystack[idx - 1])) idx -= 1;
  const raw = haystack.slice(idx, spanStart);
  return PARALLEL_CLAUSE_RESET_RE.test(raw) ? '' : raw;
}

/**
 * True when the text immediately governing the quote that starts at
 * `spanStart` in `haystack` carries a negation the quote itself does not
 * include — i.e., `haystack.slice(spanStart)` is a candidate for having had
 * its governing negation trimmed off the front. Callers must treat `true`
 * as "cannot verify this quote", not as "warn and continue": see the
 * module header's fail-closed requirement.
 *
 * Deliberately never looks INSIDE the quote itself (only strictly before
 * `spanStart`) — a quote that legitimately contains "not" is untouched by
 * this check, by construction.
 */
function hasUnclosedNegationBeforeSpan(haystack, spanStart, opts = {}) {
  if (typeof haystack !== 'string' || !Number.isInteger(spanStart) || spanStart <= 0) return false;
  const maxChars = Number.isFinite(opts.maxLookbackChars) ? opts.maxLookbackChars : DEFAULT_MAX_LOOKBACK_CHARS;
  const window = precedingClauseWindow(haystack, spanStart, maxChars);
  return NEGATION_LEAD_IN_RES.some((re) => re.test(window));
}

module.exports = {
  NEGATION_LEAD_IN_RES,
  PARALLEL_CLAUSE_RESET_RE,
  precedingClauseWindow,
  hasUnclosedNegationBeforeSpan,
};
