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
 * the text itself (plus an optionally-injected governed agreement date)
 * establish -- and it says so honestly when it cannot.
 *
 * TWO RESOLUTION PATHS, BOTH DETERMINISTIC:
 *
 *  1. CALENDAR. A literal "<Month> <Day>, <Year>" date inside the quote
 *     (case-insensitive month name), converted to `YYYY-MM-DD`. The day is
 *     validated against the real length of that month in that year
 *     (including leap years) -- "February 30, 2026" is a typed ABSTAIN, not
 *     a silently-wrapped date.
 *  2. SYMBOLIC. One of the lexicon's closed TEMPORAL_SYMBOLIC_DATES phrases.
 *     Per the spec ("a symbolic date resolved deterministically from deal
 *     metadata ... when that date is already governed data"), ONLY "the date
 *     hereof" and "the date of this Agreement" resolve here, and only via
 *     the caller-injected `agreement_date` (an ISO-8601 date string this
 *     module never invents -- see the pinned implementation decision in the
 *     spec: "No governed date -> the symbolic resolution abstains -> open
 *     world"). "the Closing Date" and "the Effective Time" are DELIBERATELY
 *     left un-resolvable in this slice: this module has no governed source
 *     for either (closing has not necessarily happened at extraction time,
 *     and no closing-date/effective-time metadata is threaded into the
 *     resolver anywhere yet) -- see this file's own DEVIATION note below and
 *     the Task 3 deliverable report for the same flag surfaced to Ben/Fable.
 *
 * DEVIATION (documented, flagged for governance review per the lexicon's own
 * "Lexicon and whitelist edits are identity-semantics changes" convention):
 * the design spec's own worked example only names "the date hereof" ->
 * agreement date explicitly; it does not enumerate a governed source for
 * "the Closing Date" / "the Effective Time" anywhere in this slice. Treating
 * those two as permanently-abstaining (rather than guessing a wrong mapping)
 * is the fail-closed reading of "only when that date is already governed
 * data" -- extending them to a real governed field is future, evidence-
 * backed work for whoever wires closing-date metadata into the resolver.
 *
 * EVERY OUTCOME IS TYPED. `{ outcome: 'RESOLVED', resolution, iso_date,
 * matched_text, symbolic_phrase? }` or `{ outcome: 'ABSTAIN', reason,
 * matched_text?, symbolic_phrase? }` -- never a bare null, per the spec's
 * "nothing fails silently" house rule.
 */

'use strict';

const { TEMPORAL_SYMBOLIC_DATES } = require('./qualifier-kind-lexicon');

const MEASUREMENT_DATE_PARSE_VERSION = 1;

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

// Only these two symbolic phrases resolve via the caller's agreement_date --
// see the module header's DEVIATION note for why "the Closing Date" and
// "the Effective Time" are excluded here even though the lexicon recognises
// them as TEMPORAL markers.
const AGREEMENT_DATE_SYMBOLIC_PHRASES = Object.freeze([
  'the date hereof',
  'the date of this Agreement',
]);

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
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(month, year) || !Number.isInteger(year)) {
    return { valid: false, matchedText };
  }
  return { valid: true, matchedText, iso_date: `${year}-${pad2(month)}-${pad2(day)}` };
}

function findSymbolicDate(text) {
  const lower = text.toLowerCase();
  for (const phrase of TEMPORAL_SYMBOLIC_DATES) {
    const idx = lower.indexOf(phrase.toLowerCase());
    if (idx >= 0) {
      return { phrase, matchedText: text.slice(idx, idx + phrase.length) };
    }
  }
  return null;
}

function isValidIsoDateString(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

/**
 * @param {object} args
 * @param {string} args.quote                       the eligible TEMPORAL
 *   quote text (whole-quote CLASSIFIED, or one SPLIT part's own text) --
 *   never the whole original qualifier when it was split.
 * @param {string|null} [args.agreement_date]        an ISO-8601 `YYYY-MM-DD`
 *   string, injected by the caller from governed deal data. Absent/invalid
 *   -> symbolic agreement-date phrases abstain rather than resolve.
 * @returns {
 *   {outcome: 'RESOLVED', resolution: 'CALENDAR'|'SYMBOLIC', iso_date: string,
 *    matched_text: string, symbolic_phrase?: string} |
 *   {outcome: 'ABSTAIN', reason: string, matched_text?: string, symbolic_phrase?: string}
 * }
 */
function parseMeasurementDate({ quote, agreement_date: agreementDate = null } = {}) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseMeasurementDate requires a non-empty { quote: string }');
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
    return Object.freeze({
      outcome: 'RESOLVED',
      resolution: 'CALENDAR',
      iso_date: calendar.iso_date,
      matched_text: calendar.matchedText,
    });
  }

  const symbolic = findSymbolicDate(quote);
  if (symbolic) {
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

module.exports = {
  MEASUREMENT_DATE_PARSE_VERSION,
  AGREEMENT_DATE_SYMBOLIC_PHRASES,
  parseMeasurementDate,
};
