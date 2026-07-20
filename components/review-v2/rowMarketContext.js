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

function registrySignature(context) {
  const summary = context && context.primarySummary;
  if (!summary) return null;
  if (summary.kind === 'numeric') return `numeric:${summary.attribute || ''}:${summary.median ?? ''}`;
  const top = Array.isArray(summary.values) ? summary.values[0] : null;
  return top ? `categorical:${String(top.label || top.value || '').toLowerCase()}:${top.count ?? ''}` : null;
}

function registerBrowserContext(context) {
  if (typeof window === 'undefined' || !context) return;
  const signature = registrySignature(context);
  if (!signature) return;
  const registry = window.__MTX_ROW_MARKET_CONTEXTS__ || (window.__MTX_ROW_MARKET_CONTEXTS__ = {});
  registry[`${signature}|${context.marketKey || ''}`] = { ...context, registrySignature: signature };
}

function typedMetricSummary(spec, result) {
  if (!spec || !result || result.state === 'not_comparable' || result.state === 'error') return null;
  const kind = spec.comparison?.kind;
  const attribute = spec.metricKey || spec.label || 'market-value';
  const label = spec.label || attribute;
  const coverage = result.coverage || {};
  if (kind === 'presence') {
    const denominator = result.prevalence?.eligibleCount ?? coverage.eligibleCount ?? null;
    return {
      attribute,
      label,
      kind: 'categorical',
      values: [
        { value: 'present', label: 'Present', count: coverage.presentCount ?? 0, denominator },
        { value: 'absent', label: 'Absent', count: coverage.absentCount ?? 0, denominator },
      ],
    };
  }
  if (kind === 'categorical' || kind === 'multi_select') {
    const distribution = result.distribution || {};
    return {
      attribute,
      label,
      kind: 'categorical',
      values: (Array.isArray(distribution.values) ? distribution.values : []).map((item) => ({
        ...item,
        label: String(item?.label ?? item?.value ?? 'Not captured'),
        denominator: distribution.denominatorCount ?? coverage.presentCount ?? null,
      })),
    };
  }
  if (kind === 'money') {
    const subjectBasis = result?.subject?.dealValueBasis;
    const cohort = (result?.distribution?.normalised?.cohorts || [])
      .find((candidate) => candidate?.basis === subjectBasis);
    const stats = cohort?.percent?.stats;
    if (!stats) return null;
    const basisLabel = ({
      equity_value: 'equity value',
      enterprise_value: 'enterprise value',
      headline_transaction_value: 'headline deal value',
    })[subjectBasis] || subjectBasis;
    return {
      attribute,
      label: basisLabel ? `${label} (% of ${basisLabel})` : label,
      kind: 'numeric',
      unit: 'percent',
      ...stats,
      count: stats.n,
    };
  }
  const distribution = result.distribution || {};
  const cohort = Array.isArray(distribution.cohorts) ? distribution.cohorts[0] : null;
  if (!cohort?.stats) return null;
  return {
    attribute,
    label,
    kind: 'numeric',
    unit: cohort.semantics?.unit || spec.semantics?.unit || null,
    ...cohort.stats,
    count: cohort.stats.n,
  };
}

export function buildTypedRowMarketContext(resolution, data) {
  if (!resolution?.rowKey || data?.loading || data?.error) return null;
  const responseRow = data?.byRow?.[resolution.rowKey];
  if (!responseRow) return null;
  const entries = (resolution.metrics || [])
    .map((spec) => ({ spec, summary: typedMetricSummary(spec, responseRow.metrics?.[spec.metricKey]) }))
    .filter((entry) => entry.summary);
  if (!entries.length) return null;
  const isException = (spec) => /exception/i.test(`${spec.metricKey || ''} ${spec.label || ''}`);
  const treatments = entries
    .filter(({ spec }) => !isException(spec)
      && (spec.comparison?.kind === 'presence' || !['numeric', 'duration', 'money'].includes(spec.comparison?.kind)))
    .map(({ summary }) => summary);
  const exceptions = entries
    .filter(({ spec }) => isException(spec))
    .map(({ summary }) => summary);
  const exceptionSet = new Set(exceptions);
  const metrics = entries
    .filter(({ spec, summary }) => ['numeric', 'duration', 'money'].includes(spec.comparison?.kind) && !exceptionSet.has(summary))
    .map(({ summary }) => summary);
  const results = entries.map(({ spec }) => responseRow.metrics?.[spec.metricKey]).filter(Boolean);
  const presenceResult = entries
    .find(({ spec }) => spec.comparison?.kind === 'presence')
    ?.spec;
  const presence = presenceResult ? responseRow.metrics?.[presenceResult.metricKey] : null;
  const peerSetSize = presence?.prevalence?.eligibleCount
    ?? presence?.coverage?.eligibleCount
    ?? results.find((result) => Number.isFinite(result?.coverage?.eligibleCount))?.coverage.eligibleCount
    ?? null;
  const termDealCount = presence?.coverage?.presentCount
    ?? results.find((result) => Number.isFinite(result?.coverage?.presentCount))?.coverage.presentCount
    ?? null;
  return {
    marketKey: resolution.rowKey,
    marketRowKey: resolution.rowKey,
    label: resolution.label || resolution.rowKey,
    peerSetSize,
    termDealCount,
    scope: 'typed-row-metric',
    scopeNote: '',
    treatments,
    exceptions,
    metrics,
    primarySummary: treatments[0] || metrics[0] || exceptions[0] || entries[0].summary,
    deals: [],
    truncated: false,
  };
}

export function registerTypedRowMarketContext(resolution, data) {
  const context = buildTypedRowMarketContext(resolution, data);
  if (typeof window === 'undefined' || !resolution?.rowKey) return context;
  const registry = window.__MTX_ROW_MARKET_CONTEXTS__ || (window.__MTX_ROW_MARKET_CONTEXTS__ = {});
  const key = `typed-row:${resolution.rowKey}`;
  if (context) registry[key] = context;
  else delete registry[key];
  return context;
}

export function exactMarketContextForRowKey(contexts, rowKey) {
  if (!rowKey || !Array.isArray(contexts)) return null;
  return contexts.find((context) => String(context?.marketRowKey || '') === String(rowKey)) || null;
}

export function buildRowMarketContext(row, marketColumn) {
  if (!marketColumn || !marketColumn.stats) return null;
  const stats = marketColumn.stats || {};
  const peerSetSize = Number.isFinite(stats.peerSetSize) ? stats.peerSetSize : null;
  const termDealCount = Number.isFinite(stats.dealsWithCode) ? stats.dealsWithCode : null;

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
    summary: normalizeSidebarDistribution(entry.summary, entry.role, peerSetSize, termDealCount),
  }));

  const treatments = entries.filter((entry) => entry.role === 'treatment').map((entry) => entry.summary);
  const exceptions = entries.filter((entry) => entry.role === 'exception').map((entry) => entry.summary);
  const metrics = entries.filter((entry) => entry.role === 'metric').map((entry) => entry.summary);
  const primarySummary = treatments[0] || metrics[0] || exceptions[0] || entries[0].summary;

  const context = {
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
  registerBrowserContext(context);
  return context;
}

export function marketSummaryForRowContext(row, marketColumn) {
  const context = buildRowMarketContext(row, marketColumn);
  return context ? (context.summaries[0] || context.primarySummary) : null;
}

export { registrySignature };
