/* ─────────────────────────────────────────────────────────────────────────
   lib/instrument-negation.js — negation guard for equity-instrument mention
   detection.
   ───────────────────────────────────────────────────────────────────────────
   Merger agreements routinely NAME an equity instrument only to say it
   doesn't exist:

     "Since the Measurement Date, there have been no issuances ... of ...
      (z) restricted shares, stock appreciation rights, contingent value
      rights, "phantom" stock ..."

   — a bare regex hit on "stock appreciation rights" is not evidence the
   instrument is actually outstanding; it's boilerplate in a capitalization
   rep saying the OPPOSITE. A raw-text instrument-mention scanner that adds a
   row whenever the name appears anywhere in a section's text will add false
   instrument rows from exactly this pattern.

   This module scopes the check to the SENTENCE containing the mention and
   tests it against common negation-of-existence phrasing. It is
   DELIBERATELY narrow (matches specific negation phrases, not a bare "no")
   so idiomatic uses of "no" that aren't about existence — "no later than
   ten business days", "no new participants will be permitted" — don't false-
   positive and wrongly suppress a genuinely outstanding instrument (e.g. an
   ESPP being wound down still has real, affirmative treatment terms even
   though its own wind-down paragraph is full of "no new ..." sentences).

   Shared by lib/parser-v2/extract.js (backfillMissingInstrumentMentions,
   server-side ingestion backstop) and lib/parser-v2/consideration-equity.js
   (the equity-instrument extractor itself) so every instrument-mention
   scanner in the pipeline applies the SAME guard. The client-side consumer
   this module was originally written to also share with,
   components/review/ConsiderationTables.js's buildEquityRows, was deleted
   along with the legacy review renderer (commit c0ba2c4d, "delete legacy
   review renderer"); there is no browser-bundled consumer today. CommonJS,
   matching every other parser-v2 module this one is required from; the
   CJS/ESM-interop-for-a-browser-component reasoning that originally
   justified the choice (the lib/taxonomy.js / lib/rubric.js pattern) no
   longer applies now that both live callers are already server-side
   CommonJS, but CJS remains the right choice for consistency with them.
   ───────────────────────────────────────────────────────────────────────── */

const NEGATION_RES = [
  /\bthere\s+(?:have|has)\s+been\s+no\b/i,
  /\bthere\s+(?:are|is|were|was)\s+no\b/i,
  /\bdoes?\s+not\s+have\s+any\b/i,
  /\bdid\s+not\s+have\s+any\b/i,
  /\bwithout\s+any\b/i,
  /\bnone\s+of\b/i,
  /\bnot\s+outstanding\b/i,
  // "no <security-ish plural noun>" — deliberately narrow to nouns that name
  // a security/right so idioms like "no later than" / "no new offering"
  // never match (the word right after "no" has to be one of these nouns).
  /\bno\s+(?:shares?|options?|warrants?|rights?|awards?|units?|notes?|instruments?|securities|plans?|stock)\b/i,
];

/** Bound the sentence containing `matchIndex` in `text` (period-delimited).
 *  `maxSpan` is a safety cap so a document with no nearby period can't pull
 *  the whole text into the "sentence". */
function sentenceAround(text, matchIndex, maxSpan = 800) {
  const prevDot = text.lastIndexOf('. ', matchIndex);
  const start = Math.max(0, prevDot + 1, matchIndex - maxSpan);
  const nextDot = text.indexOf('. ', matchIndex);
  const end = nextDot === -1
    ? Math.min(text.length, matchIndex + maxSpan)
    : Math.min(nextDot + 1, matchIndex + maxSpan);
  return text.slice(start, end);
}

/** True when the instrument mention at `matchIndex` in `text` sits inside a
 *  clause that negates the instrument's existence, rather than describing
 *  its actual treatment/mechanics. */
function isNegatedMention(text, matchIndex) {
  if (typeof text !== 'string' || !text || typeof matchIndex !== 'number') return false;
  const sentence = sentenceAround(text, matchIndex);
  return NEGATION_RES.some((re) => re.test(sentence));
}

/** Find the first match of `re` in `text` whose containing sentence does NOT
 *  negate it. Returns the RegExp match object, or null if every occurrence
 *  (or there are none) is negated. `re` need not carry the 'g' flag. */
function firstAffirmativeMention(re, text) {
  if (typeof text !== 'string' || !text) return null;
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const globalRe = new RegExp(re.source, flags);
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = globalRe.exec(text)) !== null) {
    if (!isNegatedMention(text, m.index)) return m;
    if (globalRe.lastIndex === m.index) globalRe.lastIndex += 1; // zero-length guard
  }
  return null;
}

/** True when `text` contains at least one non-negated match of `re`. */
function hasAffirmativeMention(re, text) {
  return firstAffirmativeMention(re, text) !== null;
}

module.exports = {
  isNegatedMention,
  firstAffirmativeMention,
  hasAffirmativeMention,
  NEGATION_RES,
};
