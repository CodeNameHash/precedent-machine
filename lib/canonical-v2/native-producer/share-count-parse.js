/**
 * lib/canonical-v2/native-producer/share-count-parse.js
 *
 * Pure, deterministic share-count parsing for the P1 cap-table numeric
 * promotions (docs/superpowers/specs/2026-08-02-p1-captable-numerics-design.md,
 * section 2). Mirrors measurement-date-parse.js's own contract shape: this
 * module never calls a model and never touches I/O -- the caller
 * (candidate-resolution.js) decides whether a SHARE_COUNT candidate is even
 * eligible to reach this parser (count_kind in the enum, corroboration
 * passed, share_class_ref/plan_ref verbatim-checked); this module answers
 * exactly one question given an ELIGIBLE, byte-verified quote: what single
 * numeric literal (or count_kind-matched zero) does the text itself
 * establish -- and it says so honestly, typed, when it cannot.
 *
 * EVERY OUTCOME IS TYPED: `{ outcome: 'RESOLVED', canonical_value,
 * matched_text }` or `{ outcome: 'ABSTAIN', reason, matched_text? }` --
 * never a bare null, never a throw on prose (the only throw is on a
 * malformed call -- missing/empty quote or count_kind).
 *
 * THE EXTRACTION TOKENIZER IS PINNED (spec section 2): candidate tokens are
 * maximal digit-comma-dot runs (`/[0-9,.]+/g`) bounded by non-[0-9,.]
 * characters. Each candidate is classified, IN THIS ORDER, against five
 * pinned exclusion classes:
 *
 *   1. numbers inside the verbatim `share_class_ref`/`plan_ref` spans (the
 *      resolver's own M-3 attribute-verbatim check already guarantees these
 *      are real substrings of the quote before this module is ever called;
 *      this class covers e.g. "$0.01 par value" sitting inside a class
 *      phrase, or "2015" sitting inside a plan name).
 *   2. section references, LTR-mark-tolerant: the F28 fixture bytes contain
 *      a literal U+200E (LEFT-TO-RIGHT MARK) between "Section" and the
 *      section number -- the grammar below matches that mark optionally, so
 *      it works unmodified against the LITERAL committed fixture bytes,
 *      never a retyped-ASCII stand-in.
 *   3. calendar dates -- reusing CALENDAR_DATE_PATTERN from
 *      measurement-date-parse.js verbatim (not a re-derived pattern), per
 *      the design doc's explicit pin.
 *   4. currency-prefixed literals (`[$€£]`, optionally followed by
 *      whitespace, immediately preceding the token).
 *   5. clock times ("5:00 p.m." class).
 *
 * Two or more survivors after exclusion -> ABSTAIN `MULTIPLE_NUMERIC_
 * LITERALS` (never picked between -- a compound sentence is the producer's
 * job to split into two claims, never this parser's). Zero survivors and no
 * matching zero pattern -> ABSTAIN `NO_NUMERIC_LITERAL` (or
 * `NON_LITERAL_NUMERAL` when the quote spells the number out instead of
 * using digits, e.g. "ten million").
 *
 * PRECEDENCE PIN (re-audit finding 3, spec section 2): a quote carrying BOTH
 * a single surviving numeric literal AND a kind-matching zero pattern (the
 * live F28 case: "10,000,000 shares of preferred stock ... none of which
 * were outstanding") -> ABSTAIN `AMBIGUOUS_LITERAL_AND_ZERO`, never resolve
 * either. The producer must split that sentence into an AUTHORIZED claim and
 * an ISSUED_OUTSTANDING zero claim; this parser never picks.
 *
 * ZERO TABLE (spec section 1, audit C-3): a quoted zero resolves to
 * `canonical_value: '0'` ONLY when the matched pattern's own count_kind
 * equals the caller's count_kind. A pattern that matches under the WRONG
 * count_kind (e.g. a TREASURY zero sentence parsed as RESERVED) never
 * resolves -- typed ABSTAIN `ZERO_PATTERN_KIND_MISMATCH`, which closes the
 * corruption path where a wrong-but-plausible kind mislabels a real zero.
 * `ZERO_PATTERN_TABLE_VERSION` is versioned independently of
 * `SHARE_COUNT_PARSE_VERSION` (spec section 4, audit M-6: both thread into
 * the resolution receipt separately).
 */

'use strict';

const { CALENDAR_DATE_PATTERN } = require('./measurement-date-parse');

const SHARE_COUNT_PARSE_VERSION = 1;
const ZERO_PATTERN_TABLE_VERSION = 1;

// Maximal digit-comma-dot runs, bounded by any character outside [0-9,.] --
// the pinned tokenizer grammar (spec section 2). `g` for repeated matching.
const CANDIDATE_TOKEN_PATTERN = /[0-9,.]+/g;

// LTR-mark-tolerant section-reference grammar (spec section 2, exclusion
// class 2): "Section" or "Sections", optional U+200E/U+200F marks and
// whitespace, then a dotted/parenthesised section number, e.g.
// "Section ‎3.1(b)(ii)". `g` so every reference in a quote is found.
// The base reference, plus a CONTINUATION grammar (Fable review finding
// F-3): a "Sections X and Y" / "Sections X, Y and Z" list is common real
// drafting (e.g. the F28 fixture's own "Sections ‎3.1(b)(i) and
// ‎3.1(b)(ii)"), and without this, only the FIRST reference in the list is
// excluded -- the second reference's own leading digit group survives as a
// false numeric-literal candidate, a live wrong-number path.
// Each continuation link requires an immediately-adjacent
// conjunction/comma followed by a REFERENCE-SHAPED number: at least one
// dotted segment (3.1, 8.01) or at least one parenthesised subdivision
// ((b), (ii)) -- a bare digit group NEVER qualifies (Fable re-review
// finding F-4: the earlier bare-digit continuation swallowed real counts
// -- "Section 3.1, 250,000,000 shares" was consumed group-by-group
// through the count's own commas, and in two-count sentences left the
// WRONG survivor to resolve. Reference-shape gating restores the safe
// behaviors: a bare count after a reference survives as a literal; two
// counts abstain MULTIPLE_NUMERIC_LITERALS). The separator requires
// whitespace after a comma so grouped-number commas (250,000,000) can
// never act as list separators.
const SECTION_REFERENCE_PATTERN =
  /\bSections?\s*[‎‏]?\s*\d+(?:\.\d+)*(?:\([a-zA-Z0-9]+\))*(?:(?:\s*,\s+|\s+(?:and|or)\s+)[‎‏]?\s*(?:\d+(?:\.\d+)+(?:\([a-zA-Z0-9]+\))*|\d+(?:\([a-zA-Z0-9]+\))+))*/gi;

// Clock times, e.g. "5:00 p.m." (spec section 2, exclusion class 5).
const CLOCK_TIME_PATTERN = /\b\d{1,2}:\d{2}\s*(?:[ap]\.m\.|[ap]m\b)/gi;

// Currency symbols recognised for exclusion class 4 (spec: "[$€£] optionally
// followed by whitespace").
const CURRENCY_SYMBOLS = Object.freeze(['$', '€', '£']);

// A quote that spells a number out instead of using digits ("ten million")
// abstains NON_LITERAL_NUMERAL rather than the generic NO_NUMERIC_LITERAL --
// spec section 2. Deliberately narrow: common cardinal/scale words only,
// never a full spelled-number grammar (this module never "repairs" prose
// into a number, it only recognises that prose is doing the asserting).
const NON_LITERAL_NUMERAL_PATTERN = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion)\b/i;

// Strict 3-digit grouping (spec section 2): "1,23,456" ABSTAINS
// (MALFORMED_GROUPING), it does not "repair".
const STRICT_GROUPING_PATTERN = /^\d{1,3}(,\d{3})*(\.\d+)?$/;

/**
 * count_kind-keyed zero table (spec section 1, audit C-3). Frozen and
 * versioned (ZERO_PATTERN_TABLE_VERSION) -- every entry names the exact
 * count_kind it is evidence for; matching under any OTHER count_kind is a
 * typed mismatch, never a silent resolve. Patterns are deliberately
 * conservative (word-anchored, punctuation-bounded via `[^.;]*`) so a
 * near-miss like "no obligation to reserve" never matches.
 */
const ZERO_PATTERN_TABLE = Object.freeze([
  Object.freeze({
    count_kind: 'ISSUED_OUTSTANDING',
    pattern: /none\s+of\s+which\s+were\s+outstanding/i,
  }),
  Object.freeze({
    count_kind: 'ISSUED_OUTSTANDING',
    pattern: /\bno\b[^.;]*\bwere\s+issued\s+and\s+outstanding\b/i,
  }),
  Object.freeze({
    count_kind: 'TREASURY',
    pattern: /\bheld\b[^.;]*\bas\s+treasury\b/i,
  }),
  Object.freeze({
    count_kind: 'RESERVED',
    pattern: /\bno\b[^.;]*\breserved\s+for\s+issuance\b/i,
  }),
]);

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`parseShareCount requires a non-empty ${label}`);
  }
  return value;
}

function allMatches(pattern, text) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const out = [];
  let match = re.exec(text);
  while (match) {
    out.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    if (match[0].length === 0) re.lastIndex += 1;
    match = re.exec(text);
  }
  return out;
}

function spanContains(outer, innerStart, innerEnd) {
  return innerStart >= outer.start && innerEnd <= outer.end;
}

function refSpan(quote, ref) {
  if (typeof ref !== 'string' || ref.length === 0) return null;
  const start = quote.indexOf(ref);
  if (start < 0) return null;
  return { start, end: start + ref.length };
}

function precededByCurrencySymbol(quote, tokenStart) {
  let i = tokenStart - 1;
  while (i >= 0 && /\s/.test(quote[i])) i -= 1;
  return i >= 0 && CURRENCY_SYMBOLS.includes(quote[i]);
}

function matchZeroPatterns(quote) {
  return ZERO_PATTERN_TABLE
    .map((entry) => {
      const match = entry.pattern.exec(quote);
      return match ? { count_kind: entry.count_kind, matched_text: match[0] } : null;
    })
    .filter(Boolean);
}

/**
 * @param {object} args
 * @param {string} args.quote              the byte-verified, ELIGIBLE quote text.
 * @param {string} args.count_kind         one of the pinned SHARE_COUNT count_kind enum values --
 *   used ONLY to key the zero table and the AMBIGUOUS_LITERAL_AND_ZERO precedence check; this
 *   module never validates the enum membership itself (the resolver's corroboration gate does).
 * @param {string|null} [args.share_class_ref]  verbatim class phrase, a real substring of quote
 *   (M-3 guarantees this before this module is called) -- numbers inside its span are excluded.
 * @param {string|null} [args.plan_ref]         verbatim plan phrase (RESERVED only), same contract.
 * @returns {
 *   {outcome: 'RESOLVED', canonical_value: string, matched_text: string} |
 *   {outcome: 'ABSTAIN', reason: string, matched_text?: string, zero_pattern_kind?: string}
 * }
 */
function parseShareCount({
  quote, count_kind: countKind, share_class_ref: shareClassRef = null, plan_ref: planRef = null,
} = {}) {
  requireNonEmptyString(quote, '{ quote: string }');
  requireNonEmptyString(countKind, '{ count_kind: string }');

  const excludedSpans = [];
  const classRefSpan = refSpan(quote, shareClassRef);
  if (classRefSpan) excludedSpans.push(classRefSpan);
  const planRefSpan = refSpan(quote, planRef);
  if (planRefSpan) excludedSpans.push(planRefSpan);
  const sectionSpans = allMatches(SECTION_REFERENCE_PATTERN, quote);
  const calendarSpans = allMatches(CALENDAR_DATE_PATTERN, quote);
  const clockSpans = allMatches(CLOCK_TIME_PATTERN, quote);

  // A maximal [0-9,.]+ run with no digit at all (a bare "," or "." left
  // over between two excluded/adjacent spans, e.g. the comma separating a
  // class phrase from the rest of the sentence) is not a numeral candidate
  // at all -- filtered before classification, not after.
  const tokens = allMatches(CANDIDATE_TOKEN_PATTERN, quote).filter((token) => /\d/.test(token.text));
  const survivors = tokens.filter((token) => {
    if (excludedSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (sectionSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (calendarSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (precededByCurrencySymbol(quote, token.start)) return false;
    if (clockSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    return true;
  });

  const zeroMatches = matchZeroPatterns(quote);
  const zeroMatchForKind = zeroMatches.find((entry) => entry.count_kind === countKind) || null;

  if (survivors.length >= 2) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_NUMERIC_LITERALS' });
  }

  if (survivors.length === 1) {
    // Precedence pin (re-audit finding 3): a surviving literal AND a
    // kind-matching zero pattern in the same quote never resolves either --
    // the producer must split the sentence into two claims.
    if (zeroMatchForKind) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'AMBIGUOUS_LITERAL_AND_ZERO' });
    }
    const token = survivors[0];
    if (!STRICT_GROUPING_PATTERN.test(token.text)) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING', matched_text: token.text });
    }
    return Object.freeze({
      outcome: 'RESOLVED',
      canonical_value: token.text.replace(/,/g, ''),
      matched_text: token.text,
    });
  }

  // Zero survivors.
  if (zeroMatchForKind) {
    return Object.freeze({
      outcome: 'RESOLVED',
      canonical_value: '0',
      matched_text: zeroMatchForKind.matched_text,
    });
  }
  if (zeroMatches.length > 0) {
    // Some OTHER count_kind's zero pattern matched -- a wrong-but-in-enum
    // label must never publish a number under the wrong kind (audit C-4).
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: 'ZERO_PATTERN_KIND_MISMATCH',
      matched_text: zeroMatches[0].matched_text,
      zero_pattern_kind: zeroMatches[0].count_kind,
    });
  }
  if (NON_LITERAL_NUMERAL_PATTERN.test(quote)) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
  }
  return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL' });
}

module.exports = {
  SHARE_COUNT_PARSE_VERSION,
  ZERO_PATTERN_TABLE_VERSION,
  ZERO_PATTERN_TABLE,
  SECTION_REFERENCE_PATTERN,
  CLOCK_TIME_PATTERN,
  CURRENCY_SYMBOLS,
  STRICT_GROUPING_PATTERN,
  parseShareCount,
};
