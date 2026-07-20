/* ─────────────────────────────────────────────────────────────────────────
   lib/query/relative-periods.js — deal-relative look-back periods.

   Ben (r14): "when comparing look-back periods — we should be comparing the
   LENGTH not the dates (like we do for %s — i.e. anything that is 'relative'
   to the deal)". A reps look-back stored as "December 31, 2023" is only
   comparable across deals as a DURATION relative to each deal's own signing
   date (~18 months before signing) — exactly like fees comparing as % of
   deal value rather than dollars (lib/percent-of-deal.js, the pattern this
   module deliberately mirrors: shared computation, null over guesses,
   additive wiring at the comparison surfaces).

   REGISTRY — audited keys only, no pattern guessing. Every key below was
   verified against the cached corpus cards (2026-07-20 sweep, 46 deals):
     absenceOfChangesStartDate    date or prose ("December 31, 2023",
                                  "the Balance Sheet Date")
     aocNoMaeSinceDate            same forms as above (same underlying anchor)
     lookbackDateISO              ISO date ("2023-09-30")
     secFilingsExceptionLookbackDate  ISO date ("2023-01-01")
     secFilingsExceptionLookback  prose ("from January 1, 2023 until …",
                                  "since the Applicable Date")
     lookbackPeriod               bare number IN DAYS (features.js unit:
                                  'days'; corpus: 1648, 913, 365 …) or prose
                                  ("since January 1, 2023", "In the past
                                  three (3) years")
   Deliberately NOT in the registry (see r14 report for the full audit):
     lookbackAnchor / lookbackTiedToIncorporation  enum/boolean, categorical
     secFilingsLookbackMonths     already months — relative by construction
     outsideDate* / extendedOutsideDateISO  forward-looking (post-signing);
                                  outsideDateMonthsPostSigning is already the
                                  relative form
     cutoffDate                   anchors like "the date of this Agreement" —
                                  not a look-back length
     noticePeriod / matchingPeriod / protectionPeriod(Months) / etc.
                                  durations already, nothing to convert

   CONVERSION RULE + ROUNDING. months-before-signing =
     round((signingDate − anchorDate) / 30.4375 days)
   30.4375 = average Gregorian month (365.25 / 12). Rounded to the NEAREST
   WHOLE MONTH: look-backs are negotiated in months/years off a fiscal
   period end, so sub-month precision would be false precision. Stored
   durations parse to months directly (years × 12; days ÷ 30.4375, rounded).

   NEVER guesses:
     - anchor date AFTER the signing date  -> null (a look-back cannot end
       in the future; validation flags these instead of including them)
     - deal has no signing date            -> null
     - bare number with no known unit      -> null (only lookbackPeriod's
       registry entry declares numberUnit: 'days')
     - "business day" durations            -> null (delivery-timing prose,
       not a look-back length)
     - multi-part prose (";"-joined lists of several anchors) -> null
       (ambiguous — which anchor would we pick?)
     - defined-term anchors ("the Balance Sheet Date", "the Applicable
       Date") with no literal date in the text -> null
   Callers exclude-and-count nulls (like percentStats.excludedCount), never
   substitute a default.
   ───────────────────────────────────────────────────────────────────────── */

const DAYS_PER_MONTH = 30.4375; // 365.25 / 12
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const RELATIVE_MONTHS_UNIT = 'months before signing';

// Audited keys only. `numberUnit` is the unit of a BARE numeric value for
// that field (null = a bare number is not interpretable, return null).
const RELATIVE_PERIOD_FIELDS = {
  absenceOfChangesStartDate: { numberUnit: null },
  aocNoMaeSinceDate: { numberUnit: null },
  lookbackDateISO: { numberUnit: null },
  secFilingsExceptionLookbackDate: { numberUnit: null },
  secFilingsExceptionLookback: { numberUnit: null },
  lookbackPeriod: { numberUnit: 'days' },
};

function isRelativePeriodField(key) {
  return Object.prototype.hasOwnProperty.call(RELATIVE_PERIOD_FIELDS, String(key || ''));
}

const MONTH_NAMES = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, eighteen: 18, twenty: 20,
  'twenty-four': 24, thirty: 30, 'thirty-six': 36, sixty: 60, ninety: 90,
};

// Parse a UTC anchor date out of text. Accepts a bare ISO date
// ("2023-09-30"), a bare US-style long date ("December 31, 2023"), or the
// FIRST "since/from <long or ISO date>" in longer prose. Returns null when
// no literal date is present (defined-term anchors) or when the text is a
// ";"-joined multi-anchor list (ambiguous).
function parseAnchorDate(text) {
  const s = String(text == null ? '' : text).trim();
  if (!s || s.includes(';')) return null;

  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const long = s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/i);

  // Reject text carrying MORE THAN ONE literal date ("from January 1, 2023
  // until … December 31, 2024") unless it's the "since/from X until/through
  // the-signing" shape, where the FIRST date is unambiguously the anchor.
  const allLong = s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}\b/gi) || [];
  const allIso = s.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  if (allLong.length + allIso.length > 1) return null;

  let y; let m; let d;
  if (iso) {
    y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]);
  } else if (long) {
    y = Number(long[3]); m = MONTH_NAMES[long[1].toLowerCase()]; d = Number(long[2]);
  } else {
    return null;
  }
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  // Reject silently-rolled-over dates (e.g. "February 30").
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

// Parse a stored DURATION ("two years", "three (3) years", "24 months",
// "the past five years", "90 days") to whole months. Business-day phrases
// are delivery-timing boilerplate, never a look-back length -> null.
// ";"-joined multi-part prose -> null (ambiguous).
function parseMonthsDuration(text) {
  const s = String(text == null ? '' : text).trim().toLowerCase();
  if (!s || s.includes(';')) return null;
  if (/business\s+day/.test(s)) return null;

  // "three (3) years" / "3 years" / "three years" / "24 months" / "90 days"
  const m = s.match(/(?:\b([a-z-]+)\s*)?\(?\b(\d+)?\)?\s*\b(year|month|day)s?\b/);
  if (!m) return null;
  let n = null;
  if (m[2] != null) n = Number(m[2]);
  else if (m[1] != null && NUMBER_WORDS[m[1]] != null) n = NUMBER_WORDS[m[1]];
  if (!Number.isFinite(n) || n <= 0) return null;

  const unit = m[3];
  if (unit === 'year') return Math.round(n * 12);
  if (unit === 'month') return Math.round(n);
  return Math.round(n / DAYS_PER_MONTH); // days
}

function signingDateOf(deal) {
  const raw = deal && (deal.announce_date || deal.signing_date);
  if (!raw) return null;
  const s = String(raw).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthsBetween(anchorDate, signingDate) {
  const days = (signingDate.getTime() - anchorDate.getTime()) / MS_PER_DAY;
  if (days < 0) return null; // anchor after signing: not a look-back
  return Math.round(days / DAYS_PER_MONTH);
}

/**
 * toRelativeMonths(value, deal, options) -> integer months | null
 *
 * `value` may be a stored date (ISO or "December 31, 2023", possibly inside
 * "since <date>" prose), a stored duration ("two years", "24 months"), or a
 * bare number whose unit options.numberUnit declares ('days' | 'months');
 * bare numbers with no declared unit return null. `deal` must carry
 * announce_date (or signing_date). Whole months, rounding documented in the
 * header. Null over guesses, always.
 */
function toRelativeMonths(value, deal, options) {
  if (value === null || value === undefined || value === '') return null;
  const numberUnit = (options && options.numberUnit) || null;

  // Bare numbers (and pure numeric strings): duration in the field's
  // declared unit. No declared unit -> no interpretation.
  const asNumber = typeof value === 'number' ? value : (String(value).trim().match(/^\d+(\.\d+)?$/) ? Number(value) : null);
  if (asNumber !== null) {
    if (!Number.isFinite(asNumber) || asNumber <= 0) return null;
    if (numberUnit === 'days') return Math.round(asNumber / DAYS_PER_MONTH);
    if (numberUnit === 'months') return Math.round(asNumber);
    return null;
  }

  if (typeof value !== 'string') return null;

  // A single prose value carrying BOTH a date and a duration ("for the
  // twelve (12) month period ended March 31, 2025") is ambiguous — the date
  // is a period END, not the look-back start — so it converts to null
  // rather than picking one reading. ";"-joined multi-anchor lists are
  // already rejected inside both parsers.
  const anchor = parseAnchorDate(value);
  const duration = parseMonthsDuration(value);
  if (anchor && duration !== null) return null;

  if (anchor) {
    const signing = signingDateOf(deal);
    if (!signing) return null;
    return monthsBetween(anchor, signing);
  }

  // Duration form — already relative, no signing date needed.
  return duration;
}

/**
 * toRelativeMonthsForField(fieldKey, value, deal) -> integer months | null
 *
 * Registry-gated wrapper: null for any key not in RELATIVE_PERIOD_FIELDS,
 * otherwise toRelativeMonths with that field's declared numberUnit.
 */
function toRelativeMonthsForField(fieldKey, value, deal) {
  const entry = RELATIVE_PERIOD_FIELDS[String(fieldKey || '')];
  if (!entry) return null;
  return toRelativeMonths(value, deal, { numberUnit: entry.numberUnit });
}

module.exports = {
  RELATIVE_PERIOD_FIELDS,
  RELATIVE_MONTHS_UNIT,
  isRelativePeriodField,
  parseAnchorDate,
  parseMonthsDuration,
  toRelativeMonths,
  toRelativeMonthsForField,
};
