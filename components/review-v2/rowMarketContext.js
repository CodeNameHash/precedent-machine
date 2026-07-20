// Canonical row-level market context used by compare cells, drill-downs, and
// natural-language market answers. This module is deliberately dependency-light
// so every surface can share the same row-resolution and denominator rules.

function featureKeysForRow(row) {
  if (!row) return [];
  if (Array.isArray(row.featureKeys)) return row.featureKeys.filter(Boolean);
  if (row.featureKey) return [row.featureKey];
  return [];
}

function summariesForRow(row, marketColumn) {
  if (!marketColumn || !marketColumn.stats) return [];
  const keys = new Set(featureKeysForRow(row));
  if (!keys.size) return [];
  const summaries = Array.isArray(marketColumn.stats.featureSummary)
    ? marketColumn.stats.featureSummary
    : [];
  return summaries.filter((summary) => summary && keys.has(summary.attribute));
}

function roleForSummary(row, summary, index) {
  const roles = row && row.marketFeatureRoles && typeof row.marketFeatureRoles === 'object'
    ? row.marketFeatureRoles
    : null;
  if (roles && roles[summary.attribute]) return roles[summary.attribute];
  return index === 0 ? 'treatment' : 'exception';
}

function normalizeCategorical(summary, peerSetSize) {
  const values = Array.isArray(summary.values) ? summary.values : [];
  return {
    ...summary,
    values: values.map((value) => ({
      ...value,
      denominator: Number.isFinite(value.denominator)
        ? value.denominator
        : (Number.isFinite(summary.total) ? summary.total : peerSetSize),
    })),
  };
}

export function buildRowMarketContext(row, marketColumn) {
  const summaries = summariesForRow(row, marketColumn);
  if (!summaries.length) return null;

  const stats = marketColumn.stats || {};
  const peerSetSize = Number.isFinite(stats.peerSetSize) ? stats.peerSetSize : null;
  const termDealCount = Number.isFinite(stats.dealsWithCode) ? stats.dealsWithCode : null;
  const entries = summaries.map((summary, index) => ({
    role: roleForSummary(row, summary, index),
    summary: summary.kind === 'categorical'
      ? normalizeCategorical(summary, peerSetSize)
      : summary,
  }));

  return {
    marketKey: row.marketKey || row.id || null,
    label: row.label || row.titleText || row.itemLabel || null,
    peerSetSize,
    termDealCount,
    scope: stats.scope || null,
    scopeNote: stats.scopeNote || null,
    treatments: entries.filter((entry) => entry.role === 'treatment').map((entry) => entry.summary),
    exceptions: entries.filter((entry) => entry.role === 'exception').map((entry) => entry.summary),
    metrics: entries.filter((entry) => entry.role === 'metric').map((entry) => entry.summary),
    summaries: entries.map((entry) => entry.summary),
    primarySummary: entries[0].summary,
  };
}

export function marketSummaryForRowContext(row, marketColumn) {
  const context = buildRowMarketContext(row, marketColumn);
  return context ? context.primarySummary : null;
}
