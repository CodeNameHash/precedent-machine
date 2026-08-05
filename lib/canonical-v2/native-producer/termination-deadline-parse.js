/**
 * lib/canonical-v2/native-producer/termination-deadline-parse.js
 *
 * Pure, deterministic date parsing for the termination-rights family
 * (docs/superpowers/specs/2026-08-02-family-termination-rights-design.md,
 * section 2a). Mirrors measurement-date-parse.js's / termination-fee-
 * parse.js's own contract shape: this module never calls a model and never
 * touches I/O -- the caller (candidate-resolution.js) is the only place
 * that decides whether a TERMINATION_OUTSIDE_DATE candidate is even
 * eligible to reach this parser (trigger_kind corroboration is the
 * resolver's own job, section 4); this module answers exactly one question
 * given an ELIGIBLE, byte-verified quote -- what single ISO-8601 outside
 * date, if any, does the text itself establish -- and it says so honestly,
 * typed, when it cannot.
 *
 * CALENDAR GRAMMAR REUSED VERBATIM (spec section 2a): the literal
 * "<Month> <Day>, <Year>" pattern, real-month-length validation (leap
 * years included), is `measurement-date-parse.js`'s own
 * `CALENDAR_DATE_PATTERN`, imported rather than re-derived so the two
 * modules' calendar grammar can never silently drift apart. The SYMBOLIC
 * path from that module is DELIBERATELY NOT reused here: there is no
 * governed source for an outside date other than its own literal text (an
 * outside date is never "the date hereof").
 *
 * EXCLUSIONS (spec section 2a, P1 tokenizer discipline): section
 * references are not a concern for a CALENDAR_DATE_PATTERN scan (it only
 * matches "<Month> <Day>, <Year>" literals, which a bare section number
 * never forms), so this module's own exclusion work is the clock-time and
 * currency classes the corpus's own deadline quotes carry alongside their
 * date ("11:59 p.m., Eastern time, on November 30, 2024", "5:00 p.m.
 * Houston time, on April 30, 2021") -- a clock time never itself matches
 * `CALENDAR_DATE_PATTERN` (it has no month name), so no additional
 * exclusion machinery is needed beyond scanning for every
 * `CALENDAR_DATE_PATTERN` occurrence and counting the SURVIVING calendar
 * dates.
 *
 * MULTIPLICITY RULE (spec section 2a, the extension-proviso case, observed
 * live): exactly one surviving calendar date resolves; two or more ABSTAIN
 * `MULTIPLE_CALENDAR_DATES` -- the parser NEVER picks the operative
 * deadline between an initial and an extended date, that is a legal
 * reading the producer prompt is responsible for avoiding by quoting only
 * the initial-deadline sentence. Zero dates ABSTAIN `NO_CALENDAR_DATE`
 * (covers definitional cross-references like "'End Date' has the meaning
 * set forth in Section 8.2(a)" -- a pointer is not a date).
 *
 * EVERY OUTCOME IS TYPED: `{ outcome: 'RESOLVED', iso_date, matched_text }`
 * or `{ outcome: 'ABSTAIN', reason, matched_text? }` -- never a bare null,
 * never a throw on prose (the only throw is on a malformed call -- missing/
 * empty quote). `TERMINATION_DEADLINE_PARSE_VERSION` is threaded into the
 * resolution receipt by candidate-resolution.js (P1 M-6 precedent, mirrored
 * again here).
 */

'use strict';

const { CALENDAR_DATE_PATTERN } = require('./measurement-date-parse');

const TERMINATION_DEADLINE_PARSE_VERSION = 1;

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

function allCalendarDateMatches(quote) {
  const re = new RegExp(CALENDAR_DATE_PATTERN.source, CALENDAR_DATE_PATTERN.flags.includes('g') ? CALENDAR_DATE_PATTERN.flags : `${CALENDAR_DATE_PATTERN.flags}g`);
  const out = [];
  let match = re.exec(quote);
  while (match) {
    out.push({
      matchedText: match[0],
      month: MONTH_INDEX[match[1].toLowerCase()],
      day: Number(match[2]),
      year: Number(match[3]),
    });
    match = re.exec(quote);
  }
  return out;
}

/**
 * @param {string} quote the byte-verified, ELIGIBLE quote text.
 * @returns {
 *   {outcome: 'RESOLVED', iso_date: string, matched_text: string} |
 *   {outcome: 'ABSTAIN', reason: string, matched_text?: string}
 * }
 */
function parseTerminationDeadline(quote) {
  if (typeof quote !== 'string' || quote.length === 0) {
    throw new TypeError('parseTerminationDeadline requires a non-empty { quote: string }');
  }

  const candidates = allCalendarDateMatches(quote);

  if (candidates.length === 0) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'NO_CALENDAR_DATE' });
  }
  if (candidates.length >= 2) {
    return Object.freeze({ outcome: 'ABSTAIN', reason: 'MULTIPLE_CALENDAR_DATES' });
  }

  const candidate = candidates[0];
  if (!Number.isInteger(candidate.day) || candidate.day < 1
    || candidate.day > daysInMonth(candidate.month, candidate.year)) {
    return Object.freeze({
      outcome: 'ABSTAIN', reason: 'INVALID_CALENDAR_DATE', matched_text: candidate.matchedText,
    });
  }

  return Object.freeze({
    outcome: 'RESOLVED',
    iso_date: `${candidate.year}-${pad2(candidate.month)}-${pad2(candidate.day)}`,
    matched_text: candidate.matchedText,
  });
}

module.exports = {
  TERMINATION_DEADLINE_PARSE_VERSION,
  parseTerminationDeadline,
};
