/**
 * lib/canonical-v2/native-producer/termination-fee-parse.js
 *
 * Pure, deterministic value parsing for the termination-fee family
 * (docs/superpowers/specs/2026-08-02-family-termination-fee-design.md,
 * section 2). Mirrors measurement-date-parse.js's / share-count-parse.js's
 * own contract shape: this module never calls a model and never touches
 * I/O -- the caller (candidate-resolution.js) is the only place that
 * decides whether a candidate is even ELIGIBLE to reach this parser
 * (out-of-enum fee_side/trigger checks, corroboration, attribute
 * verbatim-ness); this module answers exactly one question given an
 * ELIGIBLE, byte-verified quote -- what single fee amount, or what single
 * tail period in months, does the text itself establish -- and it says so
 * honestly, typed, when it cannot.
 *
 * EVERY OUTCOME IS TYPED: `{ outcome: 'RESOLVED', canonical_value,
 * matched_text, currency? }` or `{ outcome: 'ABSTAIN', reason,
 * matched_text? }` -- never a bare null, never a throw on prose (the only
 * throw is on a malformed call -- missing/empty quote). `TERMINATION_FEE_
 * PARSE_VERSION` is threaded into the resolution receipt by
 * candidate-resolution.js (spec section 2, P1 M-6 precedent).
 *
 * parseFeeAmount IS THE P1 TOKENIZER INVERTED (spec section 2): P1's
 * share-count-parse.js EXCLUDED currency-prefixed literals and counted bare
 * numerals; this parser counts ONLY currency-prefixed literals ([$€£],
 * optionally followed by whitespace, then a maximal digit-comma-dot run)
 * and ignores every bare numeral entirely -- so "no later than three (3)
 * Business Days", "two (2) Business Days", section numbers, dates, "50%"
 * thresholds and interest-rate prose never contaminate a fee quote's count.
 * Because the token requires a currency prefix, section references,
 * calendar dates, clock times and bare percentages never match this
 * pattern in the first place -- there is no separate exclusion pass to
 * write (P1's five-class exclusion machinery has nothing to exclude here).
 *
 * parseTailPeriodMonths RESOLVES only a literal digit month count: `12
 * months` or the belt-and-braces form `twelve (12) months` (the
 * parenthesized DIGIT is the literal; the spelled word is ignored, never
 * trusted alone). PRECEDENCE PIN (spec section 2, audit M-4 -- mirrors P1's
 * re-audit `AMBIGUOUS_LITERAL_AND_ZERO` finding): the multiplicity check
 * runs FIRST, counting period literals of ANY unit (months, days, years,
 * Business Days) -- two or more period literals of any unit ABSTAIN
 * `MULTIPLE_PERIOD_LITERALS` before `NON_MONTH_UNIT` or RESOLVED can apply.
 * `/anniversary/i` is checked before all of this.
 *
 * resolveFeeAmount (TERMINATION_FEE_PARSE_VERSION 1, additive -- docs/
 * codex-program/notes/per-limb-fee-amount.md): PROMPT_VERSION 2 of
 * termination-fee-producer-prompt.js now requires certain limbs (every limb
 * of a single-payer fee conditioned on which of several cross-referenced
 * sections fires, e.g. Modiv's "Company Base Amount") to quote their ENTIRE
 * defining sentence, identically -- correct, because a narrower quote either
 * loses the defining term or reads as a flat, unconditional figure it is
 * not. The consequence: every such limb's quote now carries more than one
 * dollar figure, so parseFeeAmount's own MULTIPLE_MONEY_LITERALS gate fires
 * on EVERY one of them -- neither limb auto-resolves. resolveFeeAmount is
 * the fix, layered on top of parseFeeAmount without changing it: it tries
 * the whole quote first, unchanged, and consults an OPTIONAL caller-supplied
 * sub-quote (the producer's new `limb_amount_quote` field, threaded through
 * by the caller) ONLY when that first attempt abstains specifically on
 * MULTIPLE_MONEY_LITERALS. Every other abstain reason (NO_MONEY_LITERAL,
 * NON_USD_CURRENCY, MALFORMED_GROUPING, HYBRID_MAGNITUDE_MONEY, NON_LITERAL_
 * MONEY) describes a defect in the one literal the whole quote already
 * carries, which a narrower sub-quote containing that same literal cannot
 * cure -- so the fallback is scoped to the one reason it can actually help
 * with, never tried more broadly. This module still never resolves an
 * amount some other module didn't independently verify as real source text:
 * the caller (anthropic-provider.js's shapeFeeAmountAssertion) is
 * responsible for byte-verifying limbAmountQuote against source bytes
 * BEFORE it ever reaches here (mirroring how the caller verifies `quote`
 * itself) -- this function's own `quote.includes(limbAmountQuote)` check is
 * cheap defense in depth, not the verification of record.
 *
 * selectFeeAmountGroundsCondition (docs/codex-program/notes/grounds-to-
 * amount-mapping.md): per-limb-fee-amount.md section 7 named a gap it
 * deliberately left open -- resolveFeeAmount disambiguates WHICH FIGURE a
 * shared quote's limb owns, but nothing says WHICH GROUNDS gate that limb
 * (Modiv's own sentence also names, in the same breath, "if payable
 * pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii)"
 * for the $10,000,000 limb and a disjoint citation set for the
 * $15,000,000.00 one). This function picks WHICH of several already
 * bare-citation-shaped candidate quotes (candidate-resolution.js identifies
 * these via bare-citation-trigger-parser.js against SIBLING
 * NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE compiled candidates in the same
 * section -- this module has no knowledge of that classification, or of
 * what a section reference even is) is THIS limb's own condition, using
 * only string positions already proven genuine (every candidate quote
 * reaching this function already passed the SAME byte-verification every
 * trigger quote in this family always has -- this function relates two
 * already-trusted strings to each other, it does not re-verify either
 * against source bytes, exactly the trust boundary handleFeeAmountCandidate's
 * own pre-existing fee_term_ref-in-quote check already relies on).
 *
 * THE RULE: a candidate must be a literal substring of `quote` (nested in
 * the SAME defining sentence, never merely "seen somewhere in this
 * section") and must END at or before an anchor position -- `anchorQuote`
 * (the limb's own already-verified `limb_amount_quote`) when present, or
 * the end of `quote` itself when this limb carries no such sub-quote (an
 * ordinary, undisambiguated single-figure amount). Where this differs from
 * a plain "nearest preceding candidate" search: `siblingAnchorQuotes` names
 * every OTHER limb sharing this exact `quote` text (Modiv's two Company
 * Base Amount limbs share one identical whole-sentence quote), and a
 * candidate is only "owned" by THIS limb's anchor when no sibling's anchor
 * is a strictly smaller, still-valid claim on it -- a condition clause is
 * attributed to the NEAREST FOLLOWING anchor, never to every later limb it
 * also happens to precede. Proven necessary, not merely convenient: Modiv's
 * own 2026-08-05 recorded response (evidence/canonical-v2/modiv-
 * termination-fee-scope-correction-20260805) expresses the identical
 * three-way disjunction as THREE separate single-reference trigger
 * candidates rather than one combined quote -- each is independently
 * nested and each independently precedes a lone limb's anchor, so the
 * owned set has more than one member and this function reports that
 * (outcome AMBIGUOUS) rather than arbitrarily picking, or silently
 * merging, among them. Neither NONE (nothing nested here at all) nor
 * AMBIGUOUS ever attaches a guess -- both mirror resolveFeeAmount's and
 * limb_amount_quote's own "a broken new field can only fail to help"
 * discipline; they differ only in whether the caller has anything worth
 * leaving a typed trace about. This function does not parse
 * `cited_references` out of the winning candidate, does not know what a
 * section reference is, and does not decide whether one resolves --
 * candidate-resolution.js's own resolveFeeAmountGrounds does that, against
 * data (sectionsByReference) this module deliberately has no access to.
 */

'use strict';

const TERMINATION_FEE_PARSE_VERSION = 1;

// ---------------------------------------------------------------------------
// parseFeeAmount
// ---------------------------------------------------------------------------

// Currency-prefixed literal: [$€£], optional whitespace, then a digit-comma
// run with an OPTIONAL decimal tail (spec section 2, "the P1 tokenizer
// INVERTED"). The decimal tail requires at least one digit after the dot
// (`(?:\.\d+)?`, never a bare trailing `.`) so a sentence-ending period
// immediately after the last digit group (e.g. "...$280,000,000.") is never
// swallowed into the digit run -- a bug the P1-style loose `[0-9,.]*` run
// would reintroduce. Captures the currency symbol and the digit run
// separately so NON_USD_CURRENCY and the strict-grouping check can each
// read the piece they need. The digit-comma run must END on a digit
// (`\d(?:[\d,]*\d)?` -- Fable build review 2026-08-03, F-2): a bare
// `[\d,]*` swallows the sentence comma in "$280,000,000, payable ...",
// turning the single most common fee drafting shape into a spurious
// MALFORMED_GROUPING abstain.
const CURRENCY_TOKEN_PATTERN = /([$€£])(\s?)(\d(?:[\d,]*\d)?(?:\.\d+)?)/g;

// Strict 3-digit grouping (reused convention from share-count-parse.js):
// malformed grouping ABSTAINs, it does not "repair".
const STRICT_GROUPING_PATTERN = /^\d{1,3}(,\d{3})*(\.\d+)?$/;

// Spelled-out money ("three hundred million dollars") -- deliberately
// narrow, never a full spelled-number grammar; this module never
// "repairs" prose into a number, it only recognises that prose is doing
// the asserting.
const NON_LITERAL_MONEY_PATTERN =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion)\s+(hundred|thousand|million|billion)?\s*dollars\b/i;

function allCurrencyMatches(quote) {
  const re = new RegExp(CURRENCY_TOKEN_PATTERN.source, 'g');
  const out = [];
  let match = re.exec(quote);
  while (match) {
    out.push({
      text: match[0],
      currency_symbol: match[1],
      digits: match[3],
      start: match.index,
      end: match.index + match[0].length,
    });
    match = re.exec(quote);
  }
  return out;
}

/**
 * @param {string} quote the byte-verified, ELIGIBLE quote text.
 * @returns {
 *   {outcome: 'RESOLVED', canonical_value: string, matched_text: string, currency: 'USD'} |
 *   {outcome: 'ABSTAIN', reason: string, matched_text?: string}
 * }
 */
function parseFeeAmount(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseFeeAmount requires a non-empty { quote: string }');
  }

  const candidates = allCurrencyMatches(quote);

  if (candidates.length === 0) {
    if (NON_LITERAL_MONEY_PATTERN.test(quote)) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_LITERAL_MONEY' });
    }
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_MONEY_LITERAL' });
  }

  // €/£ prefix -> ABSTAIN NON_USD_CURRENCY (no FX, ever), spec section 2 --
  // checked before the multiplicity check so a non-USD literal is never
  // silently absorbed into a MULTIPLE_MONEY_LITERALS count instead of its
  // own, more specific, typed reason.
  const nonUsd = candidates.find((c) => c.currency_symbol !== '$');
  if (nonUsd) {
    return Object.freeze({
      outcome: 'ABSTAIN', reason: 'NON_USD_CURRENCY', matched_text: nonUsd.text,
    });
  }

  // Two or more surviving money literals -> ABSTAIN MULTIPLE_MONEY_LITERALS
  // (never picked between -- the Dyax two-sided defined term: TWO claims;
  // the producer prompt is responsible for splitting, the parser never
  // picks).
  if (candidates.length >= 2) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_MONEY_LITERALS' });
  }

  const candidate = candidates[0];

  // Hybrid magnitude money ("$91.5 million", "$1.2 billion") -- the digit
  // run is NOT the fee value; the magnitude word carries the real scale.
  // Fable build review 2026-08-03 (F-1): the spec pinned pure spelled-out
  // money but missed this hybrid form, and resolving the bare digits is a
  // wrong-survivor RESOLVED (the P1 F-4 class). This parser never
  // multiplies prose into a number -- typed abstain, routes to review.
  const followingText = quote.slice(candidate.end);
  if (/^\s*(?:million|billion|trillion|thousand|mm|bn)\b/i.test(followingText)) {
    return Object.freeze({
      outcome: 'ABSTAIN', reason: 'HYBRID_MAGNITUDE_MONEY', matched_text: candidate.text,
    });
  }

  if (!STRICT_GROUPING_PATTERN.test(candidate.digits)) {
    return Object.freeze({
      outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING', matched_text: candidate.digits,
    });
  }

  return Object.freeze({
    outcome: 'RESOLVED',
    canonical_value: candidate.digits.replace(/,/g, ''),
    matched_text: candidate.digits,
    currency: 'USD',
  });
}

// ---------------------------------------------------------------------------
// resolveFeeAmount -- see the file header for why this exists and what it
// deliberately does not change about parseFeeAmount.
// ---------------------------------------------------------------------------

/**
 * @param {string} quote the byte-verified, ELIGIBLE whole-limb quote (same
 *   contract as parseFeeAmount's own `quote` parameter).
 * @param {string|null|undefined} limbAmountQuote an OPTIONAL, already
 *   source-byte-verified sub-quote of `quote` naming just this limb's own
 *   figure (candidate-resolution.js passes `attrs.limb_amount_quote`,
 *   already nested-verified upstream by anthropic-provider.js's
 *   shapeFeeAmountAssertion; absent for every quote that never needed it).
 * @returns {
 *   ({outcome: 'RESOLVED', canonical_value: string, matched_text: string, currency: 'USD'} |
 *    {outcome: 'ABSTAIN', reason: string, matched_text?: string})
 *   & { used_limb_amount_quote: boolean }
 * }
 */
function resolveFeeAmount(quote, limbAmountQuote) {
  const primary = parseFeeAmount(quote);
  if (primary.outcome === 'RESOLVED' || primary.reason !== 'MULTIPLE_MONEY_LITERALS') {
    return Object.freeze({ ...primary, used_limb_amount_quote: false });
  }
  if (typeof limbAmountQuote !== 'string' || limbAmountQuote.length === 0 || !quote.includes(limbAmountQuote)) {
    return Object.freeze({ ...primary, used_limb_amount_quote: false });
  }
  const fallback = parseFeeAmount(limbAmountQuote);
  if (fallback.outcome !== 'RESOLVED') {
    return Object.freeze({ ...primary, used_limb_amount_quote: false });
  }
  return Object.freeze({ ...fallback, used_limb_amount_quote: true });
}

// ---------------------------------------------------------------------------
// selectFeeAmountGroundsCondition -- see the file header for why this
// exists and exactly what "owned by the nearest following anchor" means.
// ---------------------------------------------------------------------------

// `quote.length` (never -1/undefined) when no anchor sub-quote is supplied,
// or when a supplied one is not actually found in `quote` -- an absent or
// unverifiable anchor behaves as "the end of the whole quote", the same
// single position an ordinary, undisambiguated amount already anchors to.
function groundsAnchorPosition(quote, anchorQuote) {
  if (typeof anchorQuote !== 'string' || anchorQuote.length === 0) return quote.length;
  const index = quote.indexOf(anchorQuote);
  return index === -1 ? quote.length : index;
}

/**
 * @param {string} quote the limb's own byte-verified, ELIGIBLE whole quote
 *   (same contract as resolveFeeAmount's own `quote` parameter).
 * @param {string|null|undefined} anchorQuote this limb's own
 *   `limb_amount_quote`, when present; omit/null for an ordinary
 *   single-figure amount (see file header).
 * @param {string[]} [siblingAnchorQuotes] every OTHER amount limb's own
 *   anchor sub-quote (or null/absent) sharing this EXACT `quote` text --
 *   safe to also include this limb's own `anchorQuote` redundantly, the
 *   ownership rule is unaffected by an anchor tying with itself.
 * @param {Array<{quote: string}>} candidates every already bare-citation-
 *   shaped condition clause available in this limb's own section -- the
 *   caller is responsible for that classification (see file header); this
 *   function reads only `.quote` off each and returns the winning element
 *   of `candidates` UNCHANGED (as `condition`), so a caller may attach
 *   extra fields (e.g. `cited_references`) and read them straight off the
 *   return value.
 * @returns {{ outcome: 'NONE' } |
 *   { outcome: 'AMBIGUOUS', candidate_count: number } |
 *   { outcome: 'SELECTED', condition: object }}
 *   NONE is the ordinary, ubiquitous case -- nothing nested here at all
 *   (an unconditional amount, or a section with no bare-citation sibling).
 *   AMBIGUOUS means more than one candidate is owned by this exact anchor
 *   -- see the file header's fragmented-disjunction walk-through for why
 *   this is a real, observed shape, not a defensive hypothetical, and why
 *   it is kept distinct from NONE: something WAS asserted here, this
 *   function is just not licensed to guess among it, and the caller can
 *   choose to leave a typed trace rather than fail exactly as silently as
 *   the ordinary no-condition case.
 */
function selectFeeAmountGroundsCondition({
  quote, anchorQuote, siblingAnchorQuotes = [], candidates,
}) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('selectFeeAmountGroundsCondition requires a non-empty { quote: string }');
  }
  if (!Array.isArray(candidates)) {
    throw new TypeError('selectFeeAmountGroundsCondition requires { candidates: Array }');
  }

  const myAnchor = groundsAnchorPosition(quote, anchorQuote);
  const siblingAnchors = siblingAnchorQuotes.map((sibling) => groundsAnchorPosition(quote, sibling));

  const nested = [];
  for (const candidate of candidates) {
    const candidateQuote = candidate && candidate.quote;
    if (typeof candidateQuote !== 'string' || candidateQuote.length === 0) continue;
    const start = quote.indexOf(candidateQuote);
    if (start === -1) continue;
    // Ambiguous nesting position (the same candidate text appears more than
    // once in `quote`) is treated as not-found, never guessed -- mirrors
    // evidenceForNestedSubQuote's own "spans.size !== 1 -> null" rule for
    // limb_amount_quote (anthropic-provider.js): this function has no way
    // to know which occurrence the model meant, so it claims neither.
    if (quote.lastIndexOf(candidateQuote) !== start) continue;
    nested.push({ candidate, end: start + candidateQuote.length });
  }

  // Owned by MY anchor iff no OTHER anchor (mine or a sibling's) is both
  // strictly smaller than mine AND still at or after this candidate's own
  // end -- i.e. a candidate is claimed by whichever anchor is the NEAREST
  // one at or after it, never by every anchor it merely happens to
  // precede (see file header's Modiv walk-through for both directions of
  // this rule).
  const owned = nested.filter(({ end }) => {
    if (end > myAnchor) return false;
    return !siblingAnchors.some((anchor) => anchor >= end && anchor < myAnchor);
  });

  if (owned.length === 0) return Object.freeze({ outcome: 'NONE' });
  if (owned.length > 1) return Object.freeze({ outcome: 'AMBIGUOUS', candidate_count: owned.length });
  return Object.freeze({ outcome: 'SELECTED', condition: owned[0].candidate });
}

// ---------------------------------------------------------------------------
// parseTailPeriodMonths
// ---------------------------------------------------------------------------

const ANNIVERSARY_PATTERN = /\banniversary\b/i;

// A digit-bearing period literal of ANY unit (months, years, days,
// "Business Days"), with an optional preceding spelled-out word (the
// belt-and-braces "twelve (12) months" form -- the parenthesized DIGIT is
// what this pattern captures; the spelled word is matched but not trusted
// on its own). `g` so every occurrence in a quote is counted, per the
// pinned multiplicity precedence (spec section 2, audit M-4). A single-pass
// grammar: an optional spelled-out word, then an
// optional parenthesised digit group OR a bare digit group, then the unit
// word. Capture group 1 is the literal digit run (from whichever slot --
// parenthesised or bare -- actually carried digits); group 2 is the unit.
const DIGIT_UNIT_PATTERN =
  /(?:\b[A-Za-z]+(?:-[A-Za-z]+)?\s+)?(?:\((\d{1,4})\)|\b(\d{1,4})\b)\s+(months?|years?|days?|Business\s+Days?)\b/gi;

// Word-only period ("twelve months", no digit anywhere) -- ABSTAIN
// NON_LITERAL_NUMERAL rather than the generic NO_PERIOD_LITERAL.
const NON_LITERAL_PERIOD_PATTERN =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(months?|years?|days?|Business\s+Days?)\b/i;

function allPeriodLiteralMatches(quote) {
  const re = new RegExp(DIGIT_UNIT_PATTERN.source, 'gi');
  const out = [];
  let match = re.exec(quote);
  while (match) {
    const digits = match[1] !== undefined ? match[1] : match[2];
    out.push({ digits, unit: match[3], text: match[0] });
    match = re.exec(quote);
  }
  return out;
}

/**
 * @param {string} quote the byte-verified, ELIGIBLE quote text.
 * @returns {
 *   {outcome: 'RESOLVED', canonical_value: string, matched_text: string} |
 *   {outcome: 'ABSTAIN', reason: string, matched_text?: string}
 * }
 */
function parseTailPeriodMonths(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseTailPeriodMonths requires a non-empty { quote: string }');
  }

  // Checked before all of this (spec section 2): "first anniversary of
  // such termination" is INTERPRETATION (first anniversary == 12 months),
  // never mechanical parsing.
  if (ANNIVERSARY_PATTERN.test(quote)) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'ANNIVERSARY_PHRASE' });
  }

  const periodLiterals = allPeriodLiteralMatches(quote);

  if (periodLiterals.length >= 2) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_PERIOD_LITERALS' });
  }

  if (periodLiterals.length === 1) {
    const literal = periodLiterals[0];
    const isMonth = /^months?$/i.test(literal.unit);
    if (!isMonth) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_MONTH_UNIT', matched_text: literal.text });
    }
    return Object.freeze({
      outcome: 'RESOLVED',
      canonical_value: String(Number(literal.digits)),
      matched_text: literal.digits,
    });
  }

  // Zero digit-bearing period literals.
  if (NON_LITERAL_PERIOD_PATTERN.test(quote)) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
  }
  return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_PERIOD_LITERAL' });
}

module.exports = {
  TERMINATION_FEE_PARSE_VERSION,
  CURRENCY_TOKEN_PATTERN,
  STRICT_GROUPING_PATTERN,
  DIGIT_UNIT_PATTERN,
  parseFeeAmount,
  resolveFeeAmount,
  selectFeeAmountGroundsCondition,
  parseTailPeriodMonths,
};
