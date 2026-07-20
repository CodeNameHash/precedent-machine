/* ─────────────────────────────────────────────────────────────────────────
   lib/percent-of-deal.js — "% of deal value" helper.

   Ben (r13): every fee / dollar amount on a deal (other than price, aggregate
   consideration, or deal value itself) should be shown alongside a % of deal
   value calculation, so amounts can be compared apples-to-apples across
   deals of very different size. This file is the single shared computation
   both the review page (a per-deal display) and the query engine's
   market-range executor (a cross-deal "global calculation") use, so the two
   surfaces never drift on rounding or null-handling.

   Basis: `deals.value_usd` — the transaction's equity value at announcement
   (see lib/ingest/deal-metadata-prompt.js's `value_usd` field). Both
   `amountUsd` and `dealValueUsd` are absolute USD numbers, not formatted
   strings — callers are responsible for parsing e.g. "$332,000,000" into a
   number before calling in (see lib/query/derived-fields.js#parseUsdAmount
   for the shared parser).

   NEVER guesses: any non-finite, non-positive, or missing input produces
   null rather than an invented percentage. In particular this never divides
   by zero (a dealValueUsd of 0 is treated as "no basis available", not "0%
   of nothing").
   ───────────────────────────────────────────────────────────────────────── */

function isPositiveFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * percentOfDealValue(amountUsd, dealValueUsd) -> number | null
 *
 * Returns amountUsd as a percentage of dealValueUsd (e.g. 3.1 for 3.1%), or
 * null when either input is not a finite positive number.
 */
function percentOfDealValue(amountUsd, dealValueUsd) {
  if (!isPositiveFiniteNumber(amountUsd) || !isPositiveFiniteNumber(dealValueUsd)) return null;
  return (amountUsd / dealValueUsd) * 100;
}

/**
 * formatPercentValue(pct) -> string | null
 *
 * Renders an already-computed raw percentage number (e.g. 3.1 -> "3.1%"),
 * with no "of deal value" suffix — for callers that already have a percent
 * figure in hand (a distribution stat, a per-row `.percent`) rather than a
 * raw amount/deal-value pair. One decimal place ordinarily; two decimal
 * places when the value rounds to below 1% (so a genuinely small fee like
 * 0.42% doesn't collapse to "0.4%" and read as near-zero precision).
 * formatPercentOfDeal below is just this plus percentOfDealValue plus a
 * suffix — the single rounding rule lives here so the two never drift.
 */
function formatPercentValue(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return null;
  const digits = Math.abs(pct) < 1 ? 2 : 1;
  return `${pct.toFixed(digits)}%`;
}

/**
 * formatPercentOfDeal(amountUsd, dealValueUsd) -> string | null
 *
 * Human-readable rendering, e.g. "3.1% of deal value". One decimal place
 * ordinarily; two decimal places when the value rounds to below 1% (so a
 * genuinely small fee like 0.42% doesn't collapse to "0.4%" and read as
 * near-zero precision). Returns null when not computable — callers should
 * render nothing (not "0%" or "N/A") in that case, matching
 * percentOfDealValue's null-safety.
 */
function formatPercentOfDeal(amountUsd, dealValueUsd) {
  const pct = percentOfDealValue(amountUsd, dealValueUsd);
  if (pct === null) return null;
  return `${formatPercentValue(pct)} of deal value`;
}

module.exports = { percentOfDealValue, formatPercentOfDeal, formatPercentValue };
