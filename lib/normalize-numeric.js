/* ─────────────────────────────────────────────────────────────────────────
   lib/normalize-numeric.js — deterministic, unit-aware numeric normalizer.

   Pure, DB-agnostic, no deps. Turns a verbatim extraction string into
   { value: <number>, unit: <one of CLOSED_UNITS> } or null. NEVER guesses:
   ambiguous text (ranges, two conflicting numbers, vague phrases like
   "promptly"), or a value with no recognizable unit from this closed
   vocabulary, resolves to null rather than an invented answer.

   Closed unit vocabulary: USD, percent, elapsed_hours, calendar_days,
   business_days, months, years, shares. Time clocks stay distinct so an
   elapsed-hour deadline is never pooled with a business-day deadline.

   Used by scripts/backfill/normalize-numeric-claims.js. See that file's
   header for how per-attribute context (fixed units on bare-number fields,
   sub-field extraction from structured JSON verbatims) layers on top of the
   generic parser here.
   ───────────────────────────────────────────────────────────────────────── */

const CLOSED_UNITS = new Set(['USD', 'percent', 'elapsed_hours', 'calendar_days', 'business_days', 'months', 'years', 'shares']);

const ONES = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const MULTIPLIERS = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };

// Parses a PURE spelled-number phrase ("twenty-four", "forty five",
// "five million") into a number. Returns null if any token in the phrase is
// not a recognized number word (so it can be used to test "is this really a
// spelled-out number" as well as to convert one).
function wordsToNumber(phrase) {
  if (typeof phrase !== 'string') return null;
  const words = phrase.toLowerCase().replace(/-/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  let total = 0;
  let current = 0;
  let matched = false;
  for (const w of words) {
    if (w === 'and') continue;
    if (w in ONES) { current += ONES[w]; matched = true; continue; }
    if (w in TENS) { current += TENS[w]; matched = true; continue; }
    if (w in MULTIPLIERS) {
      matched = true;
      if (w === 'hundred') {
        current = (current || 1) * 100;
      } else {
        total += (current || 1) * MULTIPLIERS[w];
        current = 0;
      }
      continue;
    }
    return null; // unrecognized word -> not a pure spelled-number phrase
  }
  if (!matched) return null;
  return total + current;
}

const UNIT_ALTERNATION = '(business[\\s-]+days?|calendar[\\s-]+days?|hours?|days?|months?|years?|shares?)';

function normalizeUnitWord(raw) {
  const w = String(raw).toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^business days?$/.test(w)) return 'business_days';
  if (/^hours?$/.test(w)) return 'elapsed_hours';
  if (/^(?:calendar )?days?$/.test(w)) return 'calendar_days';
  if (/^months?$/.test(w)) return 'months';
  if (/^years?$/.test(w)) return 'years';
  if (/^shares?$/.test(w)) return 'shares';
  return null;
}

// Scans backwards from the end of `before` (whitespace-tokenized, NOT
// regex) picking up the maximal trailing run of recognized number words
// ("five", "million", hyphenated compounds like "twenty-four", "and").
// Word-splitting rather than a regex with a repeated optional group avoids
// any catastrophic-backtracking risk on long free text (see parseCurrency).
function trailingNumberWordsPhrase(before) {
  const tokens = before.trim().split(/\s+/).filter(Boolean);
  const picked = [];
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const w = tokens[i].toLowerCase();
    const isCompound = /^[a-z]+-[a-z]+$/.test(w)
      && w.split('-').every((p) => p in ONES || p in TENS);
    if (w in ONES || w in TENS || w in MULTIPLIERS || w === 'and' || isCompound) {
      picked.unshift(tokens[i]);
    } else {
      break;
    }
  }
  return picked.length ? picked.join(' ') : null;
}

// -- currency (USD) --------------------------------------------------------
function parseCurrency(text) {
  const dollarRe = /\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion|thousand)?/gi;
  const found = new Set();
  let m;
  while ((m = dollarRe.exec(text)) !== null) {
    let val = parseFloat(m[1].replace(/,/g, ''));
    if (Number.isNaN(val)) continue;
    const mult = m[2] ? m[2].toLowerCase() : null;
    if (mult) val *= MULTIPLIERS[mult];
    found.add(val);
  }
  if (found.size > 1) return null; // conflicting dollar amounts stated
  if (found.size === 1) return { value: [...found][0], unit: 'USD' };

  // Spelled form: "<spelled number phrase> dollars", e.g. "five million dollars".
  const dollarsIdx = text.search(/\bdollars\b/i);
  if (dollarsIdx !== -1) {
    const before = text.slice(Math.max(0, dollarsIdx - 80), dollarsIdx);
    const phrase = trailingNumberWordsPhrase(before);
    if (phrase) {
      const val = wordsToNumber(phrase);
      if (val !== null) return { value: val, unit: 'USD' };
    }
  }
  return null;
}

// -- percent -----------------------------------------------------------------
function parsePercent(text) {
  const pctRe = /([\d.]+)\s*%/g;
  const found = new Set();
  let m;
  while ((m = pctRe.exec(text)) !== null) {
    const val = parseFloat(m[1]);
    if (!Number.isNaN(val)) found.add(val);
  }
  if (found.size > 1) return null; // conflicting percentages stated

  const spelledMatch = text.match(/\b([a-z]+(?:-[a-z]+)?)\s+percent\b/i);
  const spelledVal = spelledMatch ? wordsToNumber(spelledMatch[1]) : null;

  if (found.size === 1) {
    const digitVal = [...found][0];
    if (spelledVal !== null && spelledVal !== digitVal) return null; // conflict
    return { value: digitVal, unit: 'percent' };
  }
  if (spelledVal !== null) return { value: spelledVal, unit: 'percent' };
  return null;
}

// -- durations (days / business_days / months / years / shares) ------------
//
// Deliberately NOT one mega-regex with several adjacent optional groups run
// globally over the whole (possibly long, free-text) input: that shape
// catastrophically backtracks on real prose (e.g. multi-clause
// repsSurvivalDuration values running to several hundred characters) and
// can hang for minutes. Instead: find each unit-word occurrence with a
// simple single-alternation scan, then look at a SHORT bounded window of
// text immediately before it with small, anchored (end-of-slice) patterns.
const LOOKBACK_WINDOW = 60;

function parseDuration(text) {
  // Range mentions ("20 to 30 days", "20-30 days") are ambiguous by design.
  const rangeRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|to)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT_ALTERNATION}`, 'i');
  if (rangeRe.test(text)) return null;

  const unitOccurrenceRe = new RegExp(UNIT_ALTERNATION, 'gi');
  const matches = [];
  let conflict = false;
  let m;
  while ((m = unitOccurrenceRe.exec(text)) !== null) {
    const unit = normalizeUnitWord(m[0]);
    if (!unit) continue;
    const windowStart = Math.max(0, m.index - LOOKBACK_WINDOW);
    const before = text.slice(windowStart, m.index);

    // "<spelled phrase>? (N)" immediately before the unit word.
    const parenTail = before.match(/([a-z]+(?:-[a-z]+)?)?\s*\((\d+(?:\.\d+)?)(?:st|nd|rd|th)?\)[\s-]*$/i);
    // A bare number immediately before the unit word (no parens).
    const bareTail = !parenTail ? before.match(/(\d+(?:\.\d+)?)(?:st|nd|rd|th)?[\s-]*$/i) : null;
    // A pure spelled phrase immediately before the unit word (no digits at all).
    const spelledTail = (!parenTail && !bareTail) ? before.match(/\b([a-z]+(?:-[a-z]+)?)[\s-]*$/i) : null;

    let numericVal = null;
    let spelledVal = null;
    if (parenTail) {
      numericVal = parseFloat(parenTail[2]);
      if (parenTail[1]) spelledVal = wordsToNumber(parenTail[1]);
    } else if (bareTail) {
      numericVal = parseFloat(bareTail[1]);
    } else if (spelledTail) {
      spelledVal = wordsToNumber(spelledTail[1]);
    }

    if (numericVal === null && spelledVal === null) continue; // this unit mention carries no number at all

    if (numericVal !== null && spelledVal !== null && numericVal !== spelledVal) {
      conflict = true; // parenthetical numeral disagrees with the spelled word
      continue;
    }
    const value = numericVal !== null ? numericVal : spelledVal;
    matches.push({ value, unit });
  }

  if (conflict) return null;
  if (matches.length === 0) return null;

  const distinct = new Map();
  for (const mm of matches) distinct.set(`${mm.value}|${mm.unit}`, mm);
  if (distinct.size > 1) return null; // more than one distinct duration mentioned -> ambiguous
  return [...distinct.values()][0];
}

/**
 * parseNumeric(text) -> { value, unit } | null
 *
 * unit is always a member of CLOSED_UNITS. Never guesses: returns null for
 * anything ambiguous (ranges, conflicting numbers, vague phrases) or for a
 * bare number with no recognizable unit context.
 */
function parseNumeric(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const currency = parseCurrency(trimmed);
  if (currency) return currency;

  const percent = parsePercent(trimmed);
  if (percent) return percent;

  const duration = parseDuration(trimmed);
  if (duration) return duration;

  return null;
}

/**
 * classifyNullReason(text) -> 'null-ambiguous' | 'null-unit'
 *
 * Only meaningful when parseNumeric(text) === null. Buckets the null result
 * for reporting, per spec: ranges/conflicts/no-number-at-all ("promptly",
 * "a reasonable period") are 'null-ambiguous'; a number with no recognized
 * unit around it (a naked "45") is 'null-unit'. Never affects what gets
 * written — counting only.
 */
function classifyNullReason(text) {
  if (typeof text !== 'string') return 'null-ambiguous';
  const trimmed = text.trim();
  if (!trimmed) return 'null-ambiguous';

  const rangeRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|to)\\s*(\\d+(?:\\.\\d+)?)\\s*${UNIT_ALTERNATION}`, 'i');
  if (rangeRe.test(trimmed)) return 'null-ambiguous';

  const hasUnitContext = /\$|%|\bpercent\b|\b(business[\s-]+days?|calendar[\s-]+days?|hours?|days?|months?|years?|shares?)\b/i.test(trimmed);
  const hasDigit = /\d/.test(trimmed);
  const hasSpelledNumber = wordsToNumber(trimmed.replace(/[^a-z\s-]/gi, ' ')) !== null;

  if ((hasDigit || hasSpelledNumber) && !hasUnitContext) return 'null-unit';
  return 'null-ambiguous';
}

module.exports = {
  parseNumeric,
  parseDuration,
  classifyNullReason,
  wordsToNumber,
  trailingNumberWordsPhrase,
  CLOSED_UNITS,
};
