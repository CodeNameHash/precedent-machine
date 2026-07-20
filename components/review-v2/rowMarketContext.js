// Canonical row-level market context used by compare cells, drill-downs, and
// natural-language market answers. This module is deliberately dependency-light
// so every surface can share the same row-resolution and denominator rules.

const EXCEPTION_FEATURES = new Set([
  'permittedExceptions',
  'ordinaryCourseCarveout',
  'exceptions',
  'carveouts',
]);

const METRIC_FEATURES = new Set([
  'dollarThreshold',
  'companyTerminationFee',
  'parentTerminationFee',
  'reverseTerminationFee',
]);

function featureKeysForRow(row) {
  if (!row) return [];
  if (Array.isArray(row.featureKeys)) return row.featureKeys.filter(Boolean);
  if (row.featureKey) return [row.featureKey];
  return [];
}

function summariesForRow(row, marketColumn) {
  if (!marketColumn || !marketColumn.stats) return [];
  const orderedKeys = featureKeysForRow(row);
  if (!orderedKeys.length) return [];
  const summaries = Array.isArray(marketColumn.stats.featureSummary)
    ? marketColumn.stats.featureSummary
    : [];
  const byAttribute = new Map(summaries.filter(Boolean).map((summary) => [summary.attribute, summary]));
  // Row order is intentional: compact cells, drill-downs and query answers
  // must all choose the same primary treatment rather than depending on the
  // aggregator's frequency-sorted featureSummary order.
  return orderedKeys.map((key) => byAttribute.get(key)).filter(Boolean);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function stableMarketKeyForRow(row) {
  if (!row) return null;
  if (row.marketKey) return row.marketKey;
  if (row.code) return `provision.${slug(row.code)}`;
  if (row.titleText) return `term.${slug(row.titleText)}`;
  if (row.itemCode) return `item.${slug(row.itemCode)}`;
  if (row.id) return `row.${slug(row.id)}`;
  return null;
}

function roleForSummary(row, summary, index) {
  const roles = row && row.marketFeatureRoles && typeof row.marketFeatureRoles === 'object'
    ? row.marketFeatureRoles
    : null;
  if (roles && roles[summary.attribute]) return roles[summary.attribute];
  if (EXCEPTION_FEATURES.has(summary.attribute)) return 'exception';
  if (METRIC_FEATURES.has(summary.attribute) || summary.kind === 'numeric') return 'metric';
  return index === 0 ? 'treatment' : 'treatment';
}

function normalizeCategorical(summary, peerSetSize, termDealCount, role) {
  const values = Array.isArray(summary.values) ? summary.values : [];
  const roleDefault = role === 'exception' && Number.isFinite(termDealCount)
    ? termDealCount
    : peerSetSize;
  return {
    ...summary,
    values: values.map((value) => ({
      ...value,
      // Exception prevalence answers "how common among deals containing this
      // term?". A summary.total is often only the number of captured values,
      // so it must not silently replace the term-level denominator.
      denominator: Number.isFinite(value.denominator)
        ? value.denominator
        : (Number.isFinite(summary.denominator)
          ? summary.denominator
          : (Number.isFinite(roleDefault) ? roleDefault : summary.total)),
    })),
  };
}

function normalizeSidebarDistribution(distribution, role, peerSetSize, termDealCount) {
  if (!distribution) return null;
  if (distribution.kind === 'numeric') return distribution;
  return normalizeCategorical(distribution, peerSetSize, termDealCount, role);
}

function sidebarEntries(stats, row) {
  const rc = stats && stats.rowContext;
  if (!rc) return [];
  const roles = row && row.marketFeatureRoles && typeof row.marketFeatureRoles === 'object'
    ? row.marketFeatureRoles
    : {};
  const distributions = Array.isArray(rc.distributions)
    ? rc.distributions
    : (rc.distribution ? [rc.distribution] : []);
  return distributions.filter(Boolean).map((summary, index) => ({
    role: roles[summary.attribute] || roleForSummary(row, summary, index),
    summary,
  }));
}

export function buildRowMarketContext(row, marketColumn) {
  if (!marketColumn || !marketColumn.stats) return null;
  const stats = marketColumn.stats || {};
  const peerSetSize = Number.isFinite(stats.peerSetSize) ? stats.peerSetSize : null;
  const termDealCount = Number.isFinite(stats.dealsWithCode) ? stats.dealsWithCode : null;

  // Sidebar rowContext is the richer and safer source: it is subtype/family
  // scoped, deal-counted and carries underlying deals. Prefer it whenever the
  // API supplied it; compact featureSummary remains a backwards-compatible
  // fallback for the existing batch endpoint.
  let entries = sidebarEntries(stats, row);
  if (!entries.length) {
    entries = summariesForRow(row, marketColumn).map((summary, index) => ({
      role: roleForSummary(row, summary, index),
      summary,
    }));
  }
  if (!entries.length) return null;

  entries = entries.map((entry) => ({
    ...entry,
    summary: normalizeSidebarDistribution(
      entry.summary,
      entry.role,
      peerSetSize,
      termDealCount,
    ),
  }));

  const treatments = entries.filter((entry) => entry.role === 'treatment').map((entry) => entry.summary);
  const exceptions = entries.filter((entry) => entry.role === 'exception').map((entry) => entry.summary);
  const metrics = entries.filter((entry) => entry.role === 'metric').map((entry) => entry.summary);
  const primarySummary = treatments[0] || metrics[0] || exceptions[0] || entries[0].summary;

  return {
    marketKey: stableMarketKeyForRow(row),
    label: row.label || row.titleText || row.itemLabel || null,
    peerSetSize,
    termDealCount,
    scope: (stats.rowContext && stats.rowContext.scope) || stats.scope || null,
    scopeNote: (stats.rowContext && stats.rowContext.scopeNote) || stats.scopeNote || null,
    treatments,
    exceptions,
    metrics,
    summaries: entries.map((entry) => entry.summary),
    primarySummary,
    deals: (stats.rowContext && stats.rowContext.deals) || [],
    truncated: Boolean(stats.truncated),
  };
}

export function marketSummaryForRowContext(row, marketColumn) {
  const context = buildRowMarketContext(row, marketColumn);
  return context ? context.primarySummary : null;
}
