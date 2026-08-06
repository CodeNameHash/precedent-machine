/* ─────────────────────────────────────────────────────────────────────────
   lib/parse-money.js — the ONE shared "parse a single amount out of a
   string" primitive.

   BACKSTORY. Six functions across this codebase each independently parsed a
   dollar amount out of a string, and each was written to take the FIRST
   number it found. That was harmless while every stored fee was a single
   clean figure ("$332,000,000"). It stopped being harmless once a real
   agreement could state its fee as a branch-conditional formula --
   "Lesser of $10,000,000 (§7.3(b)(i), (ii) or (iii)) or $15,000,000
   (§7.3(b)(iv) or (v)) and the REIT Requirements cap" (the real Global Net
   Lease / Modiv Industrial company termination fee, see
   lib/canonical-v2/termination-product-projection.js#conditionalFeeHeadline)
   -- where picking the first figure silently computes a percentage, a
   distribution point, or a threshold pill off an arbitrary substring: a
   wrong number that reads as precise, which is worse than no number.

   The six were: parseFeeAmountUsd (components/review/table-configs/
   termination-fees.config.js), numericValue (lib/feature-compare.js),
   parseUsdAmount (lib/query/derived-fields.js), parseDollarAmount (pages/
   review-v1/[id].js), parseDollarNumber (components/review/table-configs/
   consideration-hero.config.js), and parseDollarNumber + dollarFromText
   (components/review/table-configs/ioc-exceptions.config.js). The worst two
   (consideration-hero's and ioc-exceptions' parseDollarNumber) didn't even
   take "the first" number -- they stripped every non-digit character before
   parsing, so two figures didn't yield the first one, they yielded both
   CONCATENATED ("$10,000,000 or $15,000,000" -> 1000000015000000, a
   ten-digit fabrication rendered as if it were a real threshold). All six are
   now thin call-site adapters over this one function; see each call site for
   its own object-unwrap step (citable wrapper, tagged item, legacy {amount}
   shape) -- that unwrap is call-site-specific and deliberately NOT
   duplicated in here (see "SCOPE" below).

   CONTRACT. Exactly one figure in the string resolves to its value. Zero
   figures, or more than one, resolves to null -- callers must render
   "nothing" (omit the sentence, fall back to the raw string, etc.), never a
   guess and never 0 (0 is itself a valid resolved value, e.g. parseMoneyAmount(0)
   -> 0 and parseMoneyAmount('$0') -> 0; only genuinely unresolvable input
   produces null, so "nothing" and "zero" are always distinguishable).

   AMBIGUITY RULE (dollar-sign-aware). When the string contains at least one
   "$"-marked figure, only "$"-marked figures compete for the ambiguity
   count -- a stray non-dollar numeral sitting next to a single dollar figure
   (a section citation like "(§7.3(c))", a day count) is not a second dollar
   figure and must not manufacture a false ambiguity. This is deliberately
   MORE PRECISE than counting every numeral in the string: the real Modiv
   PARENT/reverse fee headline, "Lesser of $15,000,000 (§7.3(c)) and the REIT
   Requirements cap", names exactly one dollar figure and one unrelated
   citation number -- parseMoneyAmount resolves it to 15000000, matching
   parseFeeAmountUsd's already-shipped, already-tested behavior for this
   exact real headline (see tests/canonical-v2-termination-fee-conditional-
   amount-projection.test.js, "the guard is scoped to multi-figure strings
   only"). Only when NO "$" sign appears anywhere does the check fall back to
   counting every bare numeral in the string -- the rule every non-currency
   caller (durations, percentages, a plain number) has always used, since
   those values never carry a "$" to scope by.

   FINDING (disclosed, not silently resolved): before this consolidation,
   parseFeeAmountUsd used the dollar-scoped rule above and parseUsdAmount /
   numericValue used the any-numeral rule, so the review page and the query
   engine DISAGREED, live, on this exact Modiv figure -- the termination-fees
   table showed "0.75% of deal value" for the reverse fee while
   reverseFeePctOfDealValue and cross-deal market-range queries silently
   excluded the same deal. Consolidating onto the dollar-scoped rule
   (a) is strictly more precise, (b) matches the one call site that already
   had an explicit, named, reviewed test asserting this exact scope
   ("the guard is scoped to multi-figure strings only"), and (c) makes the
   three surfaces agree instead of silently contradicting each other. See the
   task report for the full writeup and the exact tests updated to match.

   SCALE WORDS (opt-in via { scale: true }). Recognizes a trailing scale word
   or common abbreviation -- million/mm/m, billion/bn, thousand/k -- ONLY
   when it immediately follows the resolved figure (whitespace only between
   them), and only when the caller opts in. Off by default: a duration or
   percentage value must never be scaled by a coincidental "million"
   appearing in its text, and most of the six never had scale-word support to
   begin with. When scale is requested and a scale word appears ELSEWHERE in
   the string but not adjacent to the resolved figure, this never guesses
   which number it modifies -- it returns null rather than silently leaving
   the figure unscaled or guessing which occurrence it belongs to (inherited
   from parseFeeAmountUsd's already-shipped million/billion bail-out, here
   generalized to the full abbreviation set review-v1 needs).

   SCOPE. This function accepts ONLY string | number | null | undefined.
   Object shapes (citable { value, quotes }, tagged { code, label, text },
   legacy { amount }) are each call site's OWN concern, because the six
   modules unwrap them differently for reasons specific to their own data
   (derived-fields.js's multi-level, alias-chasing unwrapObject()/
   firstScalar() vs. review-v1's citable-then-{amount|value} vs. consideration-
   hero's {value|text|label}) -- collapsing those into one "universal" unwrap
   here would be exactly the wrong abstraction the consolidation is supposed
   to avoid. Callers unwrap to a scalar; this function turns that scalar into
   a validated number or null.

   NOT this function's job: lib/normalize-numeric.js (a broader, unit-closed
   extraction-time normalizer spanning USD/percent/duration/months/years/
   shares, used by the backfill pipeline) and this file's DOLLAR_NUMBER_RE
   solve an adjacent but distinct problem with a different ambiguity model
   (value-deduplication vs. this file's occurrence-counting) and a different
   consumer set; they are deliberately not merged.
   ───────────────────────────────────────────────────────────────────────── */

const SCALE_MULTIPLIERS = {
  billion: 1e9, bn: 1e9,
  million: 1e6, mm: 1e6, m: 1e6,
  thousand: 1e3, k: 1e3,
};
// Word-boundary-bounded, so "monthly" never matches "m" and "billions"
// (plural) never matches "billion" -- inherited from parseFeeAmountUsd's
// original million|billion pair, extended to the full abbreviation set.
const SCALE_WORD_RE = /\b(?:billion|bn|million|mm|m|thousand|k)\b/i;
const TRAILING_SCALE_RE = /^\s*(billion|bn|million|mm|m|thousand|k)\b/i;

const BARE_NUMBER_RE = /-?\d+(?:\.\d+)?/g;
const DOLLAR_NUMBER_RE = /\$\s*-?\d+(?:\.\d+)?/g;

/**
 * parseMoneyAmount(raw, options) -> number | null
 *
 * raw: a string or number (already unwrapped from any citable/tagged/legacy
 *   object shape by the caller -- see "SCOPE" above). null/undefined/'' ->
 *   null. A finite number passes through unchanged; NaN/Infinity -> null.
 *
 * options.scale (default false): recognize an adjacent scale word/
 *   abbreviation and multiply the figure out (see "SCALE WORDS" above).
 */
function parseMoneyAmount(raw, options = {}) {
  const scale = options.scale === true;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  const str = raw.replace(/,/g, '');

  // Ambiguity check + candidate selection in one pass -- see "AMBIGUITY RULE"
  // above for why "$"-marked figures win over bare numerals whenever at
  // least one exists, rather than always counting every numeral.
  const dollarMatches = [...str.matchAll(DOLLAR_NUMBER_RE)];
  const candidates = dollarMatches.length ? dollarMatches : [...str.matchAll(BARE_NUMBER_RE)];
  if (candidates.length !== 1) return null;

  const [match] = candidates;
  const numeralStr = match[0].replace(/^\$\s*/, '');
  const n = Number(numeralStr);
  if (!Number.isFinite(n)) return null;
  if (!scale) return n;

  const tail = str.slice(match.index + match[0].length);
  const trailing = tail.match(TRAILING_SCALE_RE);
  if (trailing) return n * SCALE_MULTIPLIERS[trailing[1].toLowerCase()];
  // A scale word exists SOMEWHERE in the string but not immediately after the
  // resolved figure -- never guess which number it modifies.
  if (SCALE_WORD_RE.test(str)) return null;
  return n;
}

module.exports = { parseMoneyAmount };
