/**
 * lib/canonical-v2/native-producer/no-shop-period-parse.js
 *
 * Pure, deterministic period-value parsing for the no-shop family (docs/
 * superpowers/specs/2026-08-02-family-no-shop-design.md, section 2 --
 * AUDIT-AMENDED, C-1/M-3/M-4 folded in verbatim). Mirrors measurement-date-
 * parse.js's / share-count-parse.js's / termination-fee-parse.js's own
 * contract shape: this module never calls a model and never touches I/O --
 * the caller (candidate-resolution.js) decides whether a NOTICE/INITIAL_
 * MATCH/SUBSEQUENT_MATCH candidate is even ELIGIBLE to reach this parser
 * (period_role corroboration is the resolver's own job, section 4); this
 * module answers exactly one question given an ELIGIBLE, byte-verified
 * quote -- what single day-denominated period, with what day_kind and unit
 * phrase, does the text itself establish -- and it says so honestly, typed,
 * when it cannot. NEVER arithmetic, NEVER unit conversion: an hour-
 * denominated obligation is typed ABSTAIN `PERIOD_UNIT_HOURS`, never
 * silently read as a day count (spec section 2's own central legal pin).
 *
 * EVERY OUTCOME IS TYPED: `{ outcome: 'RESOLVED', canonical_value, day_kind,
 * unit_phrase, matched_text }` or `{ outcome: 'ABSTAIN', reason,
 * matched_text? }` -- never a bare null, never a throw on prose (the only
 * throw is on a malformed call -- missing/empty quote).
 * `NO_SHOP_PERIOD_PARSE_VERSION` is threaded into the resolution receipt by
 * candidate-resolution.js (P1 M-6 precedent, mirrored again here).
 *
 * TOKENIZER AND EXCLUSIONS (spec section 2, the P1-pinned mechanics reused
 * verbatim where named): candidate tokens are maximal digit-comma-dot runs
 * (with an optional decimal tail, so a fractional day count -- never
 * observed in the corpus but never silently repaired either -- tokenises as
 * ONE candidate rather than splitting on the decimal point). Each candidate
 * is classified, IN THIS ORDER, against six exclusion classes:
 *
 *   1. section references -- `SECTION_REFERENCE_PATTERN`, reused verbatim
 *      from share-count-parse.js (LTR-mark-tolerant grammar, shared).
 *   2. SEC rule references -- NEW this family, corpus-forced (spec audit
 *      M-4): `Rule`/`Item`/`Regulation` followed by a citation token of
 *      digits with an OPTIONAL letter/hyphen suffix AND optional
 *      parenthesised subdivision(s) -- covers "14d-9", "14e-2(a)", AND
 *      "1012(a)" (the no-interior-letter citation the earlier draft's
 *      digit-letter-digit-only grammar could not exclude).
 *   3. calendar dates -- `CALENDAR_DATE_PATTERN`, reused verbatim from
 *      measurement-date-parse.js.
 *   4. currency-prefixed literals -- `precededByCurrencySymbol`, reused
 *      verbatim from share-count-parse.js.
 *   5. clock times -- `CLOCK_TIME_PATTERN`, reused verbatim from
 *      share-count-parse.js.
 *   6. percentages -- corpus-forced ("20% or more", "15% or more" in
 *      Acquisition Proposal definitions): a digit token immediately
 *      followed by `%` or the word "percent".
 *
 * THE SPELLED-RESTATEMENT COLLAPSE (spec section 2, item 7) IS STRUCTURALLY
 * FREE under this tokenizer: spelled number words ("four", "twenty-four")
 * are never themselves digit tokens, so "four (4) business days" already
 * yields exactly ONE digit-token candidate ("4", inside the parentheses) --
 * there is no second candidate to collapse. This module never validates
 * word<->digit agreement arithmetic ("five (3)" still yields the digit `3`
 * as the sole candidate -- a drafting mismatch is a legal-review matter the
 * quote itself surfaces to Ben, never something this parser adjudicates).
 *
 * UNIT CORROBORATION IS MANDATORY (spec audit C-1, the single normative
 * rule): the unit phrase must follow the surviving digit candidate with AT
 * MOST ONE intervening `)` token (the spelled-restatement close-paren).
 * Trailing possessives on the unit word itself ("Business Days'") are part
 * of the unit token and never intervene. A defined-term parenthetical
 * ("(the 'Notice Period')") appearing between the candidate and the unit is
 * a veto -- never admitted, since corpus drafting always places that
 * parenthetical AFTER the unit, never before.
 */

'use strict';

const { SECTION_REFERENCE_PATTERN, CLOCK_TIME_PATTERN, CURRENCY_SYMBOLS } = require('./share-count-parse');
const { CALENDAR_DATE_PATTERN } = require('./measurement-date-parse');

const NO_SHOP_PERIOD_PARSE_VERSION = 2;

// Maximal digit-comma run with an OPTIONAL decimal tail (spec: "no decimals
// for day counts" is enforced downstream, typed NON_INTEGER_PERIOD -- the
// tokenizer itself must still capture the decimal tail as PART of the same
// candidate token, or "2.5" would wrongly tokenise as two separate digit
// runs, "2" and "5", instead of the one malformed candidate it actually is).
const DIGIT_TOKEN_PATTERN = /\d(?:[\d,]*\d)?(?:\.\d+)?/g;

// SEC rule/item/regulation citation grammar (spec section 2, exclusion
// class 2, audit M-4): digits, an OPTIONAL single letter suffix, an
// OPTIONAL hyphen-digit suffix, and any number of parenthesised
// subdivisions -- covers "Rule 14d-9", "Rule 14e-2(a)", and "Item 1012(a)"
// (the no-interior-letter citation) alike, each under its own Rule/Item/
// Regulation keyword occurrence (a list like "Rule 14d-9, Rule 14e-2(a) or
// Item 1012(a) of Regulation M-A" is excluded citation-by-citation, since
// each carries its own keyword -- no continuation grammar is needed).
const SEC_RULE_CITATION_PATTERN = /\b(?:Rule|Item|Regulation)\s+\d+[A-Za-z]?(?:-\d+)?(?:\([a-zA-Z0-9]+\))*/g;

// Unit adjacency grammar (spec audit C-1): an OPTIONAL single ')' (the
// spelled-restatement close-paren), optional whitespace, an optional
// hyphen, then the unit phrase itself. The hyphen accommodates the exact
// corpus form "four (4)-business day". The match stays anchored at the
// start of the remainder so ANY other
// intervening character (in particular a defined-term parenthetical opening
// with '(') fails the match entirely, never partially.
const UNIT_ADJACENCY_PATTERN = /^\)?\s*-?\s*((?:business|calendar)[\s-]+days?|days?|hours?)\b/i;

// Spelled-only period phrase (no digit anywhere) -- ABSTAIN
// NON_LITERAL_NUMERAL rather than the generic NO_NUMERIC_LITERAL. Grounded
// in real production quotes (spec section 2): "at least five Business Days
// in advance", "will be three Business Days".
const NON_LITERAL_PERIOD_PATTERN =
  /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\s+(?:business|calendar)?\s*days?\b/i;

// Strict 3-digit grouping (reused convention, no decimals -- spec section
// 2): malformed grouping ABSTAINs, it does not "repair".
const STRICT_GROUPING_PATTERN = /^\d{1,3}(,\d{3})*$/;

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`parseNoShopPeriod requires a non-empty ${label}`);
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

function precededByCurrencySymbol(quote, tokenStart) {
  let i = tokenStart - 1;
  while (i >= 0 && /\s/.test(quote[i])) i -= 1;
  return i >= 0 && CURRENCY_SYMBOLS.includes(quote[i]);
}

function followedByPercent(quote, tokenEnd) {
  const remainder = quote.slice(tokenEnd);
  return /^\s?%/.test(remainder) || /^\s+percent\b/i.test(remainder);
}

// Unit corroboration classification for one surviving digit token (spec
// audit C-1). Returns one of BUSINESS_DAYS / CALENDAR_DAYS /
// HOURS / UNCORROBORATED, plus the verbatim unit_phrase
// substring actually matched (never invented -- it is a literal slice of
// `quote` by construction).
function classifyUnitAdjacency(quote, token) {
  const remainder = quote.slice(token.end);
  const match = UNIT_ADJACENCY_PATTERN.exec(remainder);
  if (!match) return { token, unit_outcome: 'UNCORROBORATED', unit_phrase: null };
  const unitPhrase = match[1];
  const lower = unitPhrase.toLowerCase();
  let unitOutcome;
  if (lower.startsWith('business')) unitOutcome = 'BUSINESS_DAYS';
  else if (lower.startsWith('calendar')) unitOutcome = 'CALENDAR_DAYS';
  else if (lower.startsWith('hour')) unitOutcome = 'HOURS';
  else unitOutcome = 'CALENDAR_DAYS';
  return { token, unit_outcome: unitOutcome, unit_phrase: unitPhrase };
}

/**
 * @param {string} quote the byte-verified, ELIGIBLE quote text.
 * @returns {
 *   {outcome: 'RESOLVED', canonical_value: string, day_kind: string, unit_phrase: string, matched_text: string} |
 *   {outcome: 'ABSTAIN', reason: string, matched_text?: string}
 * }
 */
function parseNoShopPeriod(quote) {
  requireNonEmptyString(quote, '{ quote: string }');

  const sectionSpans = allMatches(SECTION_REFERENCE_PATTERN, quote);
  const secRuleSpans = allMatches(SEC_RULE_CITATION_PATTERN, quote);
  const calendarSpans = allMatches(CALENDAR_DATE_PATTERN, quote);
  const clockSpans = allMatches(CLOCK_TIME_PATTERN, quote);

  const tokens = allMatches(DIGIT_TOKEN_PATTERN, quote).filter((token) => /\d/.test(token.text));
  const survivors = tokens.filter((token) => {
    if (sectionSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (secRuleSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (calendarSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (precededByCurrencySymbol(quote, token.start)) return false;
    if (clockSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (followedByPercent(quote, token.end)) return false;
    return true;
  });

  if (survivors.length === 0) {
    if (NON_LITERAL_PERIOD_PATTERN.test(quote)) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
    }
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_NUMERIC_LITERAL' });
  }

  const classified = survivors.map((token) => classifyUnitAdjacency(quote, token));
  const dayCandidates = classified.filter(
    (entry) => entry.unit_outcome === 'BUSINESS_DAYS'
      || entry.unit_outcome === 'CALENDAR_DAYS',
  );

  // Exactly-one rule (spec section 2): two or more surviving day-
  // denominated candidates -> ABSTAIN MULTIPLE_PERIOD_LITERALS, never
  // picked between (the producer prompt is responsible for splitting).
  if (dayCandidates.length >= 2) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_PERIOD_LITERALS' });
  }

  if (dayCandidates.length === 1) {
    const { token, unit_outcome: dayKind, unit_phrase: unitPhrase } = dayCandidates[0];
    const digits = token.text;
    if (digits.includes('.')) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_INTEGER_PERIOD', matched_text: digits });
    }
    if (!STRICT_GROUPING_PATTERN.test(digits)) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING', matched_text: digits });
    }
    return Object.freeze({
      outcome: 'RESOLVED',
      canonical_value: digits.replace(/,/g, ''),
      day_kind: dayKind,
      unit_phrase: unitPhrase,
      matched_text: digits,
    });
  }

  // Zero day-denominated survivors. The central legal pin (spec section 2):
  // an hour-corroborated candidate NEVER converts into a day count -- typed
  // ABSTAIN PERIOD_UNIT_HOURS, routed to review, forever.
  const hourCandidate = classified.find((entry) => entry.unit_outcome === 'HOURS');
  if (hourCandidate) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'PERIOD_UNIT_HOURS', matched_text: hourCandidate.token.text });
  }

  // A digit survived exclusion but corroborated no unit at all (no unit
  // word adjacent, or a defined-term parenthetical vetoed the adjacency).
  return Object.freeze({ outcome: 'ABSTAIN', reason: 'PERIOD_UNIT_UNCORROBORATED' });
}

module.exports = {
  NO_SHOP_PERIOD_PARSE_VERSION,
  SEC_RULE_CITATION_PATTERN,
  UNIT_ADJACENCY_PATTERN,
  STRICT_GROUPING_PATTERN,
  parseNoShopPeriod,
};
