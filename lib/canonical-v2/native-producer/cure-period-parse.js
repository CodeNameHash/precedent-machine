/**
 * lib/canonical-v2/native-producer/cure-period-parse.js
 *
 * Pure, deterministic day-count parsing for the termination-rights family's
 * breach-cure / notice-period assertions (docs/superpowers/specs/
 * 2026-08-02-family-termination-rights-design.md, section 2b). Mirrors
 * no-shop-period-parse.js's / termination-fee-parse.js's own contract
 * shape: this module never calls a model and never touches I/O -- the
 * caller (candidate-resolution.js) decides whether a TERMINATION_CURE_
 * PERIOD_DAYS candidate is even ELIGIBLE to reach this parser
 * (trigger_kind corroboration is the resolver's own job, section 4); this
 * module answers exactly one question given an ELIGIBLE, byte-verified
 * quote -- what single day-denominated count does the text itself
 * establish -- and it says so honestly, typed, when it cannot.
 *
 * NEITHER `day_kind` NOR `period_kind` IS DECIDED HERE (spec section 2b):
 * this module returns `matched_text` set to the FULL quote text (the
 * "governing clause window around the day count" -- for a single-fact
 * quote, per the producer's own one-legal-fact-per-quote instruction, the
 * whole quote already IS that window) so candidate-resolution.js's own
 * corroboration checks (day_kind: /business day/i present/absent;
 * period_kind: a cure verb governing the count vs. the notice-delivery
 * shape) have the surrounding context to test against.
 *
 * TOKENIZER (spec section 2b): candidate tokens are digit runs whose next
 * word (whitespace/parenthesis tolerant) is a day word --
 * `day`/`days`/`Days`/`Business Day`/`Business Days`/`business day`/
 * `business days` (singular and bare-capitalized forms included per audit
 * m-5, matched case-insensitively). All other numerics (section refs,
 * dates, clock times, currency) are excluded by the P1 exclusion grammar,
 * reused verbatim from share-count-parse.js / measurement-date-parse.js,
 * and are never candidates.
 *
 * HYBRID FORM "thirty (30) days" (spec section 2b): the parenthesized
 * DIGIT is the candidate (literal extraction, not repair). If the
 * immediately preceding word is a spelled numeral in a frozen
 * word->value table (one...ninety, PLUS hyphenated compounds
 * twenty-one...ninety-nine, the plausible cure-period range) and its
 * value differs from the digit -> ABSTAIN `SPELLED_DIGIT_MISMATCH`. A
 * spelled numeral with NO adjacent digit -> ABSTAIN `NON_LITERAL_
 * NUMERAL` (never a lookup-and-resolve).
 *
 * HYPHENATED COMPOUNDS (PLAN.md Step 3B): "forty-five (45) days" was
 * refused as a mismatch -- not because 45 is wrong, but because the
 * preceding-word scan stopped at the hyphen, read only "five" out of
 * "forty-five", and compared 45 against 5. The scan now includes the
 * hyphen as part of the word, and the lookup table carries the
 * hyphenated compounds (twenty-one...ninety-nine) alongside the single
 * words, so "forty-five" resolves to 45 and no longer collides with
 * "five". Compounds above one hundred ("one hundred twenty") are NOT
 * in the table: the corpus this parser has been run against contains
 * none, and the table exists to detect contradiction against what the
 * corpus actually drafts, not to anticipate every English numeral.
 *
 * MULTIPLICITY: two or more surviving day counts -> ABSTAIN
 * `MULTIPLE_DAY_COUNTS` (never picked between -- the producer splits).
 * Zero -> ABSTAIN `NO_DAY_COUNT`.
 *
 * NEITHER PARSER EVER COMPUTES (spec section 2, shared pin): "the earlier
 * of (1) the Outside Date and (2) 30 days following written notice"
 * resolves as the 30-day count with the earlier-of structure preserved in
 * the quoted evidence -- the comparative is legal text for the reviewer,
 * never an operand.
 *
 * EVERY OUTCOME IS TYPED: `{ outcome: 'RESOLVED', canonical_value,
 * matched_text }` or `{ outcome: 'ABSTAIN', reason, matched_text? }` --
 * never a bare null, never a throw on prose (the only throw is on a
 * malformed call -- missing/empty quote). `CURE_PERIOD_PARSE_VERSION` is
 * threaded into the resolution receipt by candidate-resolution.js (P1 M-6
 * precedent, mirrored again here).
 */

'use strict';

const { SECTION_REFERENCE_PATTERN, CLOCK_TIME_PATTERN, CURRENCY_SYMBOLS } = require('./share-count-parse');
const { CALENDAR_DATE_PATTERN } = require('./measurement-date-parse');

const CURE_PERIOD_PARSE_VERSION = 1;

// Maximal digit run -- no decimals/grouping expected at this magnitude
// (spec: "strict digits (`^\d+$` after extraction)").
const DIGIT_TOKEN_PATTERN = /\d+/g;

// Day-word adjacency (spec section 2b): an OPTIONAL single ')' (the
// spelled-restatement close-paren), optional whitespace, then the day word
// itself -- "day"/"days"/"Days"/"Business Day"/"Business Days"/
// "business day"/"business days", singular and bare-capitalized forms
// included (audit m-5), matched case-insensitively.
const DAY_WORD_ADJACENCY_PATTERN = /^\)?\s*((?:business\s+)?days?)\b/i;

// Frozen word -> value table (spec section 2b: "the table exists only to
// detect contradiction, not to read numbers"). Only used to compare
// against an adjacent literal digit -- never to resolve a value on its
// own. Built from three tiers -- ones, teens, tens -- plus every
// hyphenated tens-ones compound ("twenty-one".."ninety-nine", PLAN.md
// Step 3B) so a correctly drafted "forty-five (45) days" no longer gets
// read as the bare word "five" (the preceding-word scan stopping at the
// hyphen) and flagged a mismatch against 45. Nothing above ninety-nine
// is here: the corpus this parser runs against has no compound above one
// hundred (checked, not assumed -- see this file's header note).
const SPELLED_NUMBER_ONES = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
});
const SPELLED_NUMBER_TEENS = Object.freeze({
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
});
const SPELLED_NUMBER_TENS = Object.freeze({
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
});
const SPELLED_NUMBER_COMPOUNDS = Object.freeze(
  Object.fromEntries(
    Object.entries(SPELLED_NUMBER_TENS).flatMap(([tensWord, tensValue]) => Object.entries(SPELLED_NUMBER_ONES)
      .map(([onesWord, onesValue]) => [`${tensWord}-${onesWord}`, tensValue + onesValue])),
  ),
);
const SPELLED_NUMBER_VALUES = Object.freeze({
  ...SPELLED_NUMBER_ONES,
  ...SPELLED_NUMBER_TEENS,
  ...SPELLED_NUMBER_TENS,
  ...SPELLED_NUMBER_COMPOUNDS,
});

// Spelled-only day phrase (no digit anywhere) -- ABSTAIN NON_LITERAL_
// NUMERAL rather than the generic NO_DAY_COUNT. Every key of the table
// above ("one" through "ninety-nine", the plausible cure-period range,
// spec section 2b plus PLAN.md Step 3B's hyphenated compounds), longest
// keys first so a compound is not shadowed by its own trailing ones-word
// alternative ("forty-five" before "five").
const NON_LITERAL_DAY_PATTERN = new RegExp(
  `\\b(${Object.keys(SPELLED_NUMBER_VALUES).sort((a, b) => b.length - a.length).join('|')})\\s+(?:business\\s+)?days?\\b`,
  'i',
);

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`parseCurePeriod requires a non-empty ${label}`);
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

// Preceding-word lookup for the hybrid "thirty (30) days" form: returns the
// lowercase word immediately before an open-paren that itself immediately
// precedes `parenIndex`, or null if there is no such word or no such paren.
// The scan includes the hyphen (PLAN.md Step 3B): without it, "forty-five
// (45)" stopped at the hyphen and read back only "five", comparing 45
// against 5 instead of against 45 -- a correctly drafted period refused as
// a mismatch. A leading or trailing hyphen left over from a non-numeral
// scan simply will not be `Object.hasOwn` in SPELLED_NUMBER_VALUES, so a
// non-numeral preceding word still yields no comparison at all.
//
// This is NOT a pure widening, and an earlier draft of this comment said it
// was. It also makes the parser abstain where it used to resolve:
// "twenty-five (5) days" previously read back only "five", compared 5
// against 5 and RESOLVED; it now reads "twenty-five", compares 25 against 5
// and ABSTAINs SPELLED_DIGIT_MISMATCH. That is the point rather than a
// regression -- a quote whose words and digits disagree is exactly the
// contradiction this table exists to detect, and reading only the last
// component of a hyphenated compound was hiding it. Checked by running both
// strings through parseCurePeriod, not by reading the code.
function precedingSpelledWord(quote, tokenStart) {
  let i = tokenStart - 1;
  if (quote[i] !== '(') return null;
  i -= 1;
  while (i >= 0 && /\s/.test(quote[i])) i -= 1;
  const wordEnd = i + 1;
  while (i >= 0 && /[A-Za-z-]/.test(quote[i])) i -= 1;
  const wordStart = i + 1;
  if (wordStart >= wordEnd) return null;
  return quote.slice(wordStart, wordEnd).toLowerCase();
}

/**
 * @param {string} quote the byte-verified, ELIGIBLE quote text.
 * @returns {
 *   {outcome: 'RESOLVED', canonical_value: string, matched_text: string} |
 *   {outcome: 'ABSTAIN', reason: string, matched_text?: string}
 * }
 */
function parseCurePeriod(quote) {
  requireNonEmptyString(quote, '{ quote: string }');

  const sectionSpans = allMatches(SECTION_REFERENCE_PATTERN, quote);
  const calendarSpans = allMatches(CALENDAR_DATE_PATTERN, quote);
  const clockSpans = allMatches(CLOCK_TIME_PATTERN, quote);

  const tokens = allMatches(DIGIT_TOKEN_PATTERN, quote);
  const survivors = tokens.filter((token) => {
    if (sectionSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (calendarSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (clockSpans.some((span) => spanContains(span, token.start, token.end))) return false;
    if (precededByCurrencySymbol(quote, token.start)) return false;
    if (followedByPercent(quote, token.end)) return false;
    return true;
  });

  const dayCandidates = survivors.filter((token) => DAY_WORD_ADJACENCY_PATTERN.test(quote.slice(token.end)));

  if (dayCandidates.length === 0) {
    if (NON_LITERAL_DAY_PATTERN.test(quote)) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL' });
    }
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_DAY_COUNT' });
  }

  // Exactly-one rule (spec section 2b): two or more surviving day-
  // denominated candidates -> ABSTAIN MULTIPLE_DAY_COUNTS, never picked
  // between -- a quote spanning both a cure period and a notice period is
  // TWO claims; the producer splits, the parser never picks.
  if (dayCandidates.length >= 2) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_DAY_COUNTS' });
  }

  const token = dayCandidates[0];
  const spelledWord = precedingSpelledWord(quote, token.start);
  if (spelledWord && Object.hasOwn(SPELLED_NUMBER_VALUES, spelledWord)) {
    const spelledValue = SPELLED_NUMBER_VALUES[spelledWord];
    const digitValue = Number(token.text);
    if (spelledValue !== digitValue) {
      return Object.freeze({
        outcome: 'ABSTAIN', reason: 'SPELLED_DIGIT_MISMATCH', matched_text: quote,
      });
    }
  }

  return Object.freeze({
    outcome: 'RESOLVED',
    canonical_value: token.text,
    // The whole quote, per this file's own header note: for a single-
    // legal-fact quote (the producer's own one-fact-per-quote discipline),
    // the full quote already is the "governing clause window" the
    // resolver's day_kind/period_kind corroboration needs to test against.
    matched_text: quote,
  });
}

module.exports = {
  CURE_PERIOD_PARSE_VERSION,
  DAY_WORD_ADJACENCY_PATTERN,
  parseCurePeriod,
};
