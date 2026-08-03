/**
 * lib/canonical-v2/native-producer/measurement-date-parse.js
 *
 * Pure, deterministic date parsing for the `(QUALIFIER, TEMPORAL, *) ->
 * REPRESENTATION_MEASUREMENT_DATE` mapping described in
 * docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md,
 * section 3. This module never calls a model and never touches I/O -- the
 * caller (candidate-resolution.js) is the ONLY place that decides whether a
 * TEMPORAL-classified qualifier is even ELIGIBLE to reach this parser (per
 * the lexicon's `measurementDateEligible` flag); this module answers exactly
 * one question given ELIGIBLE quote text: what ISO-8601 date, if any, does
 * the text itself (plus an optionally-injected governed agreement date and
 * a run-scoped defined-dates map) establish -- and it says so honestly when
 * it cannot.
 *
 * V2 (docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md
 * section 7b): MEASUREMENT_DATE_PARSE_VERSION 1 -> 2.
 *  - New optional `defined_dates` arg: caller-injected `{ 'Capitalization
 *    Date': 'YYYY-MM-DD' }` map (governed run data, the `agreement_date`
 *    injection precedent). Term keys carry NO leading article.
 *  - Definition detection: a CALENDAR match followed by a defining
 *    parenthetical (`(the "X Date")` / `(such time and date, the "X
 *    Date")`) carries `defined_term`.
 *  - Period grammar runs FIRST (audit M-1): `parseMeasurementDate` returns a
 *    typed `{ outcome: 'PERIOD_DETECTED' }` signal for a period-shaped
 *    quote so the caller routes to `parseMeasurementPeriod` instead --
 *    unreachable by the single-date scan by construction.
 *
 * TWO SINGLE-DATE RESOLUTION PATHS, BOTH DETERMINISTIC:
 *
 *  1. CALENDAR. A literal "<Month> <Day>, <Year>" date inside the quote
 *     (case-insensitive month name), converted to `YYYY-MM-DD`. The day is
 *     validated against the real length of that month in that year
 *     (including leap years) -- "February 30, 2026" is a typed ABSTAIN, not
 *     a silently-wrapped date.
 *  2. SYMBOLIC. One of the lexicon's closed TEMPORAL_SYMBOLIC_DATES phrases.
 *     "the date hereof" / "the date of this Agreement" resolve via the
 *     caller-injected `agreement_date`; "the Capitalization Date" resolves
 *     via `defined_dates` (SYMBOLIC_DEAL_DEFINED) -- absent -> typed ABSTAIN
 *     `DEFINED_DATE_UNRESOLVED`. "the Closing Date" and "the Effective Time"
 *     are DELIBERATELY left un-resolvable this slice (P1/v1 DEVIATION,
 *     unchanged; out of scope section 11).
 *
 * EVERY OUTCOME IS TYPED. `{ outcome: 'RESOLVED', resolution, iso_date,
 * matched_text, symbolic_phrase?, defined_term? }`,
 * `{ outcome: 'PERIOD_DETECTED', matched_text }`, or
 * `{ outcome: 'ABSTAIN', reason, matched_text?, symbolic_phrase? }` -- never
 * a bare null, per the spec's "nothing fails silently" house rule.
 */

'use strict';

const {
  TEMPORAL_SYMBOLIC_DATES,
  TEMPORAL_PERIOD_PATTERN,
} = require('./qualifier-kind-lexicon');

const MEASUREMENT_DATE_PARSE_VERSION = 2;

const MONTH_INDEX = Object.freeze({
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
});

const CALENDAR_DATE_PATTERN =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/i;

// Only these two symbolic phrases resolve via the caller's agreement_date;
// "the Capitalization Date" resolves via `defined_dates` (below).
const AGREEMENT_DATE_SYMBOLIC_PHRASES = Object.freeze([
  'the date hereof',
  'the date of this Agreement',
]);

// Deal-defined-date symbolic phrases: resolved via the caller-injected
// `defined_dates` map, term keys with NO leading article.
const DEAL_DEFINED_SYMBOLIC_PHRASES = Object.freeze({
  'the Capitalization Date': 'Capitalization Date',
});

// P2 section 7b: defining-parenthetical grammar. Matches AFTER the matched
// calendar date. Both fixture forms match: "(the "Capitalization Date")"
// and "(such time and date, the "Capitalization Date")". The term must end
// in "Date".
const DEFINING_PARENTHETICAL_PATTERN =
  /\(\s*(?:such\s+(?:time\s+and\s+)?date,\s*)?the\s+[“"]([A-Z][A-Za-z ]{0,60}?Date)[”"]\s*\)/;

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month, year) {
  const table = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[month - 1];
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function findCalendarDate(text) {
  const match = CALENDAR_DATE_PATTERN.exec(text);
  if (!match) return null;
  const month = MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  const matchedText = match[0];
  const matchEnd = match.index + match[0].length;
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(month, year) || !Number.isInteger(year)) {
    return { valid: false, matchedText, matchEnd };
  }
  return { valid: true, matchedText, matchEnd, iso_date: `${year}-${pad2(month)}-${pad2(day)}` };
}

function findDefiningTerm(text, afterIndex) {
  const rest = text.slice(afterIndex);
  const m = DEFINING_PARENTHETICAL_PATTERN.exec(rest);
  if (!m) return null;
  // Only accept the defining parenthetical when it directly (modulo
  // whitespace/punctuation) follows the matched date -- not an unrelated
  // later definition in the same quote.
  const gap = rest.slice(0, m.index);
  if (!/^[\s,)]*$/.test(gap)) return null;
  return m[1];
}

function findSymbolicDate(text) {
  const lower = text.toLowerCase();
  let best = null;
  for (const phrase of TEMPORAL_SYMBOLIC_DATES) {
    const idx = lower.indexOf(phrase.toLowerCase());
    if (idx >= 0 && (best === null || idx < best.idx)) {
      best = { phrase, idx, matchedText: text.slice(idx, idx + phrase.length) };
    }
  }
  return best;
}

function isValidIsoDateString(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

function resolveSymbolicTerm(term, definedDates) {
  if (!definedDates || typeof definedDates !== 'object') return null;
  return Object.prototype.hasOwnProperty.call(definedDates, term) ? definedDates[term] : null;
}

/**
 * @param {object} args
 * @param {string} args.quote                       the eligible TEMPORAL
 *   quote text (whole-quote CLASSIFIED, or one SPLIT part's own text).
 * @param {string|null} [args.agreement_date]        governed ISO-8601 date.
 * @param {object|null} [args.defined_dates]         `{ 'Capitalization
 *   Date': 'YYYY-MM-DD' }`, run-scoped, term keys with no leading article.
 * @returns {
 *   {outcome: 'RESOLVED', resolution, iso_date, matched_text, symbolic_phrase?, defined_term?} |
 *   {outcome: 'PERIOD_DETECTED', matched_text} |
 *   {outcome: 'ABSTAIN', reason, matched_text?, symbolic_phrase?}
 * }
 */
function parseMeasurementDate({ quote, agreement_date: agreementDate = null, defined_dates: definedDates = null } = {}) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseMeasurementDate requires a non-empty { quote: string }');
  }

  // Section 7b audit M-1: period grammar runs FIRST, before every
  // single-date path -- a period match is unreachable to the single-date
  // scan below by construction.
  const periodMatch = new RegExp(TEMPORAL_PERIOD_PATTERN.source, 'i').exec(quote);
  if (periodMatch) {
    return Object.freeze({ outcome: 'PERIOD_DETECTED', matched_text: periodMatch[0] });
  }

  const calendar = findCalendarDate(quote);
  if (calendar) {
    if (!calendar.valid) {
      return Object.freeze({
        outcome: 'ABSTAIN',
        reason: 'INVALID_CALENDAR_DATE',
        matched_text: calendar.matchedText,
      });
    }
    const definedTerm = findDefiningTerm(quote, calendar.matchEnd);
    return Object.freeze({
      outcome: 'RESOLVED',
      resolution: 'CALENDAR',
      iso_date: calendar.iso_date,
      matched_text: calendar.matchedText,
      ...(definedTerm ? { defined_term: definedTerm } : {}),
    });
  }

  const symbolic = findSymbolicDate(quote);
  if (symbolic) {
    if (Object.prototype.hasOwnProperty.call(DEAL_DEFINED_SYMBOLIC_PHRASES, symbolic.phrase)) {
      const term = DEAL_DEFINED_SYMBOLIC_PHRASES[symbolic.phrase];
      const resolved = resolveSymbolicTerm(term, definedDates);
      if (resolved === null || resolved === undefined) {
        return Object.freeze({
          outcome: 'ABSTAIN',
          reason: 'DEFINED_DATE_UNRESOLVED',
          matched_text: symbolic.matchedText,
          symbolic_phrase: symbolic.phrase,
        });
      }
      return Object.freeze({
        outcome: 'RESOLVED',
        resolution: 'SYMBOLIC_DEAL_DEFINED',
        iso_date: resolved,
        matched_text: symbolic.matchedText,
        symbolic_phrase: symbolic.phrase,
        defined_term: term,
      });
    }
    if (!AGREEMENT_DATE_SYMBOLIC_PHRASES.includes(symbolic.phrase)) {
      return Object.freeze({
        outcome: 'ABSTAIN',
        reason: 'SYMBOLIC_DATE_NOT_GOVERNED',
        matched_text: symbolic.matchedText,
        symbolic_phrase: symbolic.phrase,
      });
    }
    if (!isValidIsoDateString(agreementDate)) {
      return Object.freeze({
        outcome: 'ABSTAIN',
        reason: 'AGREEMENT_DATE_UNAVAILABLE',
        matched_text: symbolic.matchedText,
        symbolic_phrase: symbolic.phrase,
      });
    }
    return Object.freeze({
      outcome: 'RESOLVED',
      resolution: 'SYMBOLIC',
      iso_date: agreementDate,
      matched_text: symbolic.matchedText,
      symbolic_phrase: symbolic.phrase,
    });
  }

  return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_DATE_FOUND' });
}

/**
 * Resolves BOTH endpoints of a period-shaped quote independently.
 * `start`/`end` sub-results carry ORIGINAL-QUOTE UTF-16 offsets (audit M-1:
 * buildPartOriginalClaim needs them to mint evidence sub-spans; `indexOf` is
 * ambiguous over a quote that may repeat text) -- each verified
 * `quote.slice(start, end) === matched_text` before returning. EITHER
 * endpoint failing -> one typed ABSTAIN `PERIOD_ENDPOINT_UNRESOLVED`
 * (carrying which leg) -- never a one-legged period.
 *
 * @param {object} args
 * @param {string} args.quote
 * @param {string|null} [args.agreement_date]
 * @param {object|null} [args.defined_dates]
 * @returns {
 *   {outcome: 'RESOLVED_PERIOD', start: object, end: object} |
 *   {outcome: 'ABSTAIN', reason: 'PERIOD_ENDPOINT_UNRESOLVED', leg: 'start'|'end', detail: object}
 * }
 */
function parseMeasurementPeriod({ quote, agreement_date: agreementDate = null, defined_dates: definedDates = null } = {}) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseMeasurementPeriod requires a non-empty { quote: string }');
  }
  const m = new RegExp(TEMPORAL_PERIOD_PATTERN.source, 'i').exec(quote);
  if (!m) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'NOT_A_PERIOD', matched_text: null });
  }
  const startText = m[2];
  const endText = m[4];
  const startOffset = m.index + m[0].indexOf(startText, m[1].length);
  const endOffset = m.index + m[0].lastIndexOf(endText);

  function resolveEndpoint(text) {
    const single = parseMeasurementDate({ quote: text, agreement_date: agreementDate, defined_dates: definedDates });
    if (single.outcome !== 'RESOLVED') return null;
    return single;
  }

  const startResolved = resolveEndpoint(startText);
  if (!startResolved) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: 'PERIOD_ENDPOINT_UNRESOLVED',
      leg: 'start',
      detail: { matched_text: startText },
    });
  }
  const endResolved = resolveEndpoint(endText);
  if (!endResolved) {
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: 'PERIOD_ENDPOINT_UNRESOLVED',
      leg: 'end',
      detail: { matched_text: endText },
    });
  }

  const startSlice = quote.slice(startOffset, startOffset + startText.length);
  const endSlice = quote.slice(endOffset, endOffset + endText.length);
  if (startSlice !== startText || endSlice !== endText) {
    // Byte-verification failed -- fail closed rather than mint a
    // mis-sliced evidence span.
    return Object.freeze({
      outcome: 'ABSTAIN',
      reason: 'PERIOD_ENDPOINT_UNRESOLVED',
      leg: startSlice !== startText ? 'start' : 'end',
      detail: { matched_text: startSlice !== startText ? startText : endText },
    });
  }

  return Object.freeze({
    outcome: 'RESOLVED_PERIOD',
    start: { ...startResolved, matched_text: startText, start: startOffset, end: startOffset + startText.length },
    end: { ...endResolved, matched_text: endText, start: endOffset, end: endOffset + endText.length },
  });
}

module.exports = {
  MEASUREMENT_DATE_PARSE_VERSION,
  AGREEMENT_DATE_SYMBOLIC_PHRASES,
  DEAL_DEFINED_SYMBOLIC_PHRASES,
  // Exported so share-count-parse.js can reuse this exact pattern for its
  // own calendar-date exclusion class (P1 cap-table numerics design,
  // section 2 pin: "calendar dates (reuse CALENDAR_DATE_PATTERN from
  // measurement-date-parse.js)") rather than re-deriving an equivalent one.
  CALENDAR_DATE_PATTERN,
  parseMeasurementDate,
  parseMeasurementPeriod,
};
