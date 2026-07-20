// r19 (WP-A, "numeric market cells"): pure, dependency-light number
// formatting for the unified market column's numeric cells and the
// "Off-market terms" section's numeric baseline ranges. Split out of
// MarketColumn.jsx (which mixes in real JSX and so can't be dynamically
// imported under this repo's plain node:test runner — see
// tests/mae-section-item-quote.test.js's header comment for why) into its
// own file, mirroring compareRowUnion.js/marketOffMarket.js's "no React, no
// fetches" rule, so this formatting logic has real behavioral test
// coverage. MarketColumn.jsx imports from here rather than reimplementing.
import { RELATIVE_MONTHS_UNIT } from '../../lib/query/relative-periods.js';
import { formatPercentValue } from '../../lib/percent-of-deal.js';

export function roundNum(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  return `${sign}$${(abs / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
}

// One number + its registry unit -> human text, matching the site's
// existing formatters (formatMoney for dollar amounts, roundNum for
// everything else). `unit` is whatever corpus-stats-core.js's
// numericAttributeUnit resolved (usd/days/business_days/months/percent) or
// null for a unit-less plain number -- never guessed beyond the registry's
// own declaration.
export function formatNumericValueForUnit(n, unit) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  if (unit === 'usd') return formatMoney(n);
  if (unit === 'percent') return `${roundNum(n)}%`;
  const singular = Math.abs(n) === 1;
  if (unit === 'elapsed_hours') return `${roundNum(n)} ${singular ? 'hour' : 'hours'}`;
  if (unit === 'business_days') return `${roundNum(n)} ${singular ? 'business day' : 'business days'}`;
  if (unit === 'calendar_days') return `${roundNum(n)} ${singular ? 'calendar day' : 'calendar days'}`;
  if (unit === 'days') return `${roundNum(n)} ${singular ? 'day' : 'days'}`;
  if (unit === 'months') return `${roundNum(n)} ${singular ? 'month' : 'months'}`;
  if (unit === 'years') return `${roundNum(n)} ${singular ? 'year' : 'years'}`;
  return roundNum(n);
}

// Numeric market-cell content (Ben, "$45M ... 3.1% of deal value ... months
// before signing"): median as the headline, with a "· N% of deal value"
// suffix when a parallel percent-of-deal-value distribution exists (dollar
// attributes only — see corpus-stats-core.js's buildNumericAttributeSummary),
// min–max as the muted range beneath. Returns null when the summary carries
// no median (an empty numeric pool) -- callers fall back to "No market
// data", never a fabricated range.
export function formatNumericMarketSummary(summary) {
  if (!summary || summary.kind !== 'numeric') return null;
  if (summary.median === null || summary.median === undefined || !Number.isFinite(summary.median)) return null;
  const isRelativePeriod = summary.unit === RELATIVE_MONTHS_UNIT;
  const medianText = isRelativePeriod
    ? `${roundNum(summary.median)} months before signing`
    : formatNumericValueForUnit(summary.median, summary.unit);
  const pctMedian = summary.percentOfDeal && Number.isFinite(summary.percentOfDeal.median)
    ? formatPercentValue(summary.percentOfDeal.median)
    : null;
  const headline = pctMedian ? `${medianText} · ${pctMedian} of deal value` : medianText;
  const minText = isRelativePeriod ? `${roundNum(summary.min)} mo` : formatNumericValueForUnit(summary.min, summary.unit);
  const maxText = isRelativePeriod ? `${roundNum(summary.max)} mo` : formatNumericValueForUnit(summary.max, summary.unit);
  const range = (minText !== null && maxText !== null) ? `${minText}–${maxText}` : null;
  return { headline, range };
}
