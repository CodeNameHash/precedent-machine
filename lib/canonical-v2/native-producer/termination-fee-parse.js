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
  parseTailPeriodMonths,
};
