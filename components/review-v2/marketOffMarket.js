// r19 (WP-A, "numeric market cells" + "off-market feed"): pure, dependency-
// light decision logic behind the unified market column's per-row off-market
// marker (CompareColumn.jsx's MarketCell/OffMarketBadge) and the aggregator
// that feeds those same rows into the "Off-market terms" section
// (pages/review/[id].js). Split out of CompareColumn.jsx/compareData.js into
// its own file, with NO React/fetch imports (mirrors compareRowUnion.js's
// own "no React, no fetches" rule), so the classification rule itself has
// real behavioral test coverage under this repo's plain node:test runner --
// CompareColumn.jsx uses real JSX and can't be dynamically imported there
// (see tests/mae-section-item-quote.test.js's header comment for why).
//
// marketSummaryForRow resolves a union row's matching corpus-stats
// featureSummary entry via its own featureKeys -- the same per-row
// attribute scoping several table configs already thread for ClauseSidebar
// (e.g. ioc-exceptions.config.js's renderNegativeRow/exceptionsRow). A row
// with no featureKeys, or whose featureKeys match nothing in this section's
// featureSummary, resolves to null -- callers render "No market data" /
// never flag off-market in that case, never a guess.
import { normalizeLabelKey } from './compareRowUnion.js';

export function marketSummaryForRow(row, marketColumn) {
  if (!row || !marketColumn || !marketColumn.stats) return null;
  const keys = Array.isArray(row.featureKeys) ? row.featureKeys : null;
  if (!keys || !keys.length) return null;
  const summaries = Array.isArray(marketColumn.stats.featureSummary) ? marketColumn.stats.featureSummary : [];
  return summaries.find((f) => keys.includes(f.attribute)) || null;
}

// Coded/categorical off-market rule (r18): this deal's own headline value
// differs from the market's modal value for the same attribute. `ownText`
// is an already-normalized display string -- callers resolve the citable/
// array/object unwrap themselves (CompareColumn.jsx's textValueLocal) --
// so this stays a pure string comparison. Never flags without a captured
// own value, a numeric-kind summary never matches here.
export function isCategoricalOffMarket(ownText, summary) {
  if (!summary || summary.kind === 'numeric') return false;
  if (!Array.isArray(summary.values) || !summary.values.length) return false;
  if (!ownText) return false;
  return normalizeLabelKey(ownText) !== normalizeLabelKey(summary.values[0].label);
}

// Numeric off-market rule (r19, extends the coded-only r18 marker): outside
// the corpus p25-p75 band. `ownNum` is the deal's own already-extracted
// numeric value (callers resolve the citable/amount-object unwrap -- see
// CompareColumn.jsx's numericValueLocal). Never flags without a resolvable
// own value or without both band edges present.
export function isNumericOffMarket(ownNum, summary) {
  if (!summary || summary.kind !== 'numeric') return false;
  if (typeof ownNum !== 'number' || !Number.isFinite(ownNum)) return false;
  if (!Number.isFinite(summary.p25) || !Number.isFinite(summary.p75)) return false;
  return ownNum < summary.p25 || ownNum > summary.p75;
}

// Single entry point covering both kinds -- used by CompareColumn.jsx's
// off-market badge (flat AND grouped rows) and by the OffMarketSection
// aggregator, so the two never diverge on which rows count as off-market.
export function isRowOffMarket({ summary, ownText = null, ownNum = null }) {
  if (!summary) return false;
  if (summary.kind === 'numeric') return isNumericOffMarket(ownNum, summary);
  return isCategoricalOffMarket(ownText, summary);
}
