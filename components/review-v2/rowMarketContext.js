// Canonical row-level market context used by compare cells, drill-downs, and
// natural-language market answers. This module is deliberately dependency-light
// so every surface can share the same row-resolution and denominator rules.

import denominatorPrecisionPresentation from '../../lib/canonical-v2/denominator-precision-presentation.js';

const {
  DENOMINATOR_PRECISION,
  normaliseDenominatorPrecision,
  qualifyDerivedValue,
} = denominatorPrecisionPresentation;

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

const TYPED_ROW_CONTEXT_PROPERTY = '__MTX_TYPED_ROW_MARKET_CONTEXT__';

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

function dealsForIds(dealDirectory, dealIds) {
  if (!dealDirectory || !Array.isArray(dealIds)) return [];
  return dealIds.map((dealId) => dealDirectory[dealId]).filter(Boolean);
}

function dealsForRefs(dealDirectory, dealRefs, dealIds) {
  if (!Array.isArray(dealRefs)) return dealsForIds(dealDirectory, dealIds);
  return dealRefs.map((ref) => {
    const dealId = ref?.dealId;
    const deal = dealId && dealDirectory?.[dealId];
    if (!deal) return null;
    return ref.cardId ? { ...deal, cardId: ref.cardId } : deal;
  }).filter(Boolean);
}

const LEGAL_VALUE_LABELS = Object.freeze({
  ALL_RESPECTS: 'True in all respects',
  MAT_ALL_RESPECTS: 'True in all respects',
  MAT_ALL_RESPECTS_DE_MINIMIS: 'True except for de minimis inaccuracies',
  DE_MINIMIS: 'True except for de minimis inaccuracies',
  MAT_ALL_MATERIAL: 'True in all material respects',
  MAT_MAE_QUALIFIED: 'True except where failure would not cause an MAE',
  MAE_QUALIFIED: 'True except where failure would not cause an MAE',
  MAT_MAE_AGGREGATE: 'Failure would not cause an MAE, individually or in the aggregate',
  MAT_MATERIALITY_SCRAPE: 'Materiality qualifiers disregarded',
});

function typedValueLabel(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const raw = String(value ?? 'Not captured');
  if (LEGAL_VALUE_LABELS[raw]) return LEGAL_VALUE_LABELS[raw];
  if (!/^[A-Z][A-Z0-9_ -]*$/.test(raw)) return raw;
  const label = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
    .replace(/\bmae\b/gi, 'MAE')
    .replace(/\bcvr\b/gi, 'CVR')
    .replace(/\bpsu\b/gi, 'PSU')
    .replace(/\brsu\b/gi, 'RSU');
}

function sameSemanticCohort(candidate, subject) {
  if (!subject) return false;
  return ['unit', 'calendarBasis', 'trigger', 'cadence']
    .every((key) => !subject[key] || candidate?.[key] === subject[key]);
}

function uniqueDeals(summaries) {
  const byId = new Map();
  for (const summary of summaries) {
    const deals = [
      ...(Array.isArray(summary?.deals) ? summary.deals : []),
      ...(summary?.values || []).flatMap((value) => (Array.isArray(value?.deals) ? value.deals : [])),
    ];
    for (const deal of deals) {
      const id = deal?.dealId || deal?.deal_id || deal?.id;
      const existing = id ? byId.get(id) : null;
      if (id && (!existing || (!existing.cardId && deal.cardId))) byId.set(id, deal);
    }
  }
  return [...byId.values()];
}

function typedMetricSummary(spec, result, dealDirectory) {
  if (!spec || !result || result.state === 'not_comparable' || result.state === 'error') return null;
  const kind = spec.comparison?.kind;
  const attribute = spec.metricKey || spec.label || 'market-value';
  const label = spec.label || attribute;
  const coverage = result.coverage || {};
  if (kind === 'presence') {
    const denominator = result.prevalence?.eligibleCount ?? coverage.eligibleCount ?? null;
    const subjectValue = result?.subject?.status === 'present'
      ? 'present'
      : result?.subject?.status === 'absent'
        ? 'absent'
        : result?.subject?.status === 'unknown' ? 'unknown' : null;
    const values = [
      {
        value: 'present',
        label: 'Present',
        count: coverage.presentCount ?? 0,
        denominator,
        deals: dealsForRefs(
          dealDirectory,
          result?.dealRefsByStatus?.present,
          result?.dealIdsByStatus?.present,
        ),
      },
      {
        value: 'absent',
        label: 'Absent',
        count: coverage.absentCount ?? 0,
        denominator,
        deals: dealsForRefs(
          dealDirectory,
          result?.dealRefsByStatus?.absent,
          result?.dealIdsByStatus?.absent,
        ),
      },
    ];
    if (coverage.unknownCount) {
      values.push({
        value: 'unknown',
        label: 'Not classified',
        count: coverage.unknownCount,
        denominator,
        deals: dealsForRefs(
          dealDirectory,
          result?.dealRefsByStatus?.unknown,
          result?.dealIdsByStatus?.unknown,
        ),
      });
    }
    return {
      attribute,
      label,
      kind: 'categorical',
      values,
      coverage,
      subjectValues: subjectValue ? [subjectValue] : [],
      subjectLabel: subjectValue ? typedValueLabel(subjectValue) : null,
    };
  }
  if (kind === 'categorical' || kind === 'multi_select') {
    const distribution = result.distribution || {};
    const subjectValues = kind === 'multi_select'
      ? (Array.isArray(result?.subject?.values) ? result.subject.values : [])
      : (result?.subject?.value == null ? [] : [result.subject.value]);
    const values = (Array.isArray(distribution.values) ? distribution.values : []).map((item) => ({
      ...item,
      label: typedValueLabel(item?.label ?? item?.value ?? 'Not captured'),
      denominator: distribution.denominatorCount ?? coverage.presentCount ?? null,
      deals: dealsForRefs(dealDirectory, item?.dealRefs, item?.dealIds),
    }));
    if (!values.length && !subjectValues.length) return null;
    return {
      attribute,
      label,
      kind: 'categorical',
      values,
      coverage,
      subjectValues,
      subjectLabel: subjectValues.map(typedValueLabel).join(', ') || null,
    };
  }
  if (kind === 'money') {
    const subjectBasis = result?.subject?.dealValueBasis;
    const subjectSemantics = result?.subject?.semantics;
    const cohorts = result?.distribution?.normalised?.cohorts || [];
    const cohort = cohorts.find((candidate) => candidate?.basis === subjectBasis
      && (!subjectSemantics || sameSemanticCohort(candidate?.semantics, subjectSemantics)));
    const stats = cohort?.percent?.stats;
    const subjectPercent = Number.isFinite(result?.subject?.percentOfDealValue)
      ? result.subject.percentOfDealValue
      : null;
    const basisLabel = ({
      equity_value: 'equity value',
      enterprise_value: 'enterprise value',
      headline_transaction_value: 'headline deal value',
    })[subjectBasis] || subjectBasis;
    const cadence = subjectSemantics?.cadence;
    const cadenceLabel = cadence ? typedValueLabel(String(cadence).toUpperCase()) : null;
    const denominatorPrecision = normaliseDenominatorPrecision(
      result?.subject?.denominatorPrecision,
    );
    const comparisonCohorts = cohorts.map((candidate) => ({
      basis: candidate?.basis || null,
      semantics: candidate?.semantics || null,
      count: candidate?.percent?.stats?.n || 0,
      median: candidate?.percent?.stats?.median ?? null,
      deals: dealsForRefs(dealDirectory, candidate?.dealRefs, candidate?.dealIds),
      selected: candidate === cohort,
    }));
    return {
      attribute,
      label: basisLabel
        ? `${label} (% of ${basisLabel}${cadenceLabel ? `, ${cadenceLabel.toLowerCase()}` : ''})`
        : label,
      kind: 'numeric',
      unit: 'percent',
      ...(stats || {}),
      count: stats?.n || 0,
      coverage,
      deals: dealsForRefs(dealDirectory, cohort?.dealRefs, cohort?.dealIds),
      subjectValue: subjectPercent,
      subjectLabel: subjectPercent === null
        ? 'Relative value unavailable'
        : qualifyDerivedValue(`${subjectPercent}%`, denominatorPrecision),
      denominatorPrecision,
      comparisonUnavailable: !stats,
      comparisonUnavailableReason: !stats
        ? (result?.comparability?.message || (cadence
          ? 'No peer percentage cohort with the same deal-value basis and cadence is available.'
          : 'No same-basis peer percentage cohort is available.'))
        : null,
      comparisonCohorts,
    };
  }
  const distribution = result.distribution || {};
  const cohorts = Array.isArray(distribution.cohorts) ? distribution.cohorts : [];
  const subjectSemantics = result?.subject?.semantics;
  const subjectDimensions = ['unit', 'calendarBasis', 'trigger', 'cadence']
    .filter((key) => subjectSemantics?.[key]);
  const cohort = subjectDimensions.length
    ? cohorts.find((candidate) => sameSemanticCohort(candidate?.semantics, subjectSemantics)) || null
    : cohorts[0] || null;
  const stats = cohort?.stats;
  const unit = cohort?.semantics?.unit || subjectSemantics?.unit || spec.semantics?.unit || null;
  const subjectValue = Number.isFinite(result?.subject?.value) ? result.subject.value : null;
  const unitLabel = unit === 'days_equivalent' ? (Math.abs(subjectValue) === 1 ? 'day' : 'days')
    : unit === 'business_days' ? (Math.abs(subjectValue) === 1 ? 'business day' : 'business days')
    : unit === 'elapsed_hours' ? (Math.abs(subjectValue) === 1 ? 'hour' : 'hours')
    : unit === 'months' ? (Math.abs(subjectValue) === 1 ? 'month' : 'months')
    : unit === 'years' ? (Math.abs(subjectValue) === 1 ? 'year' : 'years')
    : unit === 'percent' ? '%' : '';
  return {
    attribute,
    label,
    kind: 'numeric',
    unit,
    ...(stats || {}),
    count: stats?.n || 0,
    coverage,
    deals: dealsForRefs(dealDirectory, cohort?.dealRefs, cohort?.dealIds),
    subjectValue,
    subjectLabel: subjectValue === null ? null : (unitLabel === '%' ? `${subjectValue}%` : `${subjectValue}${unitLabel ? ` ${unitLabel}` : ''}`),
    comparisonUnavailable: !stats,
    comparisonUnavailableReason: !stats
      ? (result?.comparability?.message || 'No peer cohort with the same unit, calendar basis, trigger, and cadence is available.')
      : null,
  };
}

function presentationRole(spec) {
  if (spec?.presentation?.role) return spec.presentation.role;
  if (spec?.comparison?.kind === 'presence') return 'prevalence';
  if (/exception/i.test(`${spec?.metricKey || ''} ${spec?.label || ''}`)) return 'exception';
  if (['numeric', 'duration', 'money'].includes(spec?.comparison?.kind)) return 'metric';
  return 'treatment';
}

export function buildTypedRowMarketContext(resolution, data, fallbackSummary = null) {
  if (!resolution?.rowKey) return null;
  const responseRow = data?.byRow?.[resolution.rowKey];
  if ((data?.loading || data?.error) && !responseRow && !fallbackSummary) return null;
  const entries = (resolution.metrics || [])
    .map((spec) => ({ spec, summary: typedMetricSummary(spec, responseRow?.metrics?.[spec.metricKey], data?.dealDirectory) }))
    .filter((entry) => entry.summary);
  const hasSubstantiveTyped = entries.some(({ spec }) => presentationRole(spec) !== 'prevalence');
  if (!hasSubstantiveTyped && fallbackSummary) {
    entries.unshift({
      spec: { comparison: { kind: fallbackSummary.kind === 'numeric' ? 'numeric' : 'categorical' }, label: fallbackSummary.label },
      summary: fallbackSummary,
    });
  }
  if (!entries.length) return null;
  const treatments = entries
    .filter(({ spec }) => presentationRole(spec) === 'treatment')
    .map(({ summary }) => summary);
  const exceptions = entries
    .filter(({ spec }) => presentationRole(spec) === 'exception')
    .map(({ summary }) => summary);
  const metrics = entries
    .filter(({ spec }) => presentationRole(spec) === 'metric')
    .map(({ summary }) => summary);
  const results = entries.map(({ spec }) => responseRow?.metrics?.[spec.metricKey]).filter(Boolean);
  const currentDealTerms = [];
  const seenCurrentDealTerms = new Set();
  results.forEach((result) => {
    (Array.isArray(result?.subject?.legalTerms) ? result.subject.legalTerms : []).forEach((term) => {
      if (!term || term.value == null) return;
      const identity = `${String(term.key || term.label || '')}\u0000${String(term.value)}`;
      if (seenCurrentDealTerms.has(identity)) return;
      seenCurrentDealTerms.add(identity);
      currentDealTerms.push({
        key: String(term.key || `term_${currentDealTerms.length + 1}`),
        label: String(term.label || ''),
        value: String(term.value),
      });
    });
  });
  const presenceResult = entries
    .find(({ spec }) => presentationRole(spec) === 'prevalence')
    ?.spec;
  const presence = presenceResult ? responseRow?.metrics?.[presenceResult.metricKey] : null;
  const peerSetSize = presence?.prevalence?.eligibleCount
    ?? presence?.coverage?.eligibleCount
    ?? results.find((result) => Number.isFinite(result?.coverage?.eligibleCount))?.coverage.eligibleCount
    ?? null;
  const termDealCount = presence?.coverage?.presentCount
    ?? results.find((result) => Number.isFinite(result?.coverage?.presentCount))?.coverage.presentCount
    ?? null;
  const substantiveSpecs = entries
    .filter(({ spec }) => presentationRole(spec) !== 'prevalence')
    .map(({ spec }) => spec);
  const scopeNotes = [];
  if (substantiveSpecs.some((spec) => spec.observation?.value?.normalizer === 'relative_period_months')) {
    scopeNotes.push('Lookback periods are compared as months before signing.');
  }
  if (substantiveSpecs.some((spec) => spec.observation?.value?.normalizer === 'forward_period_months')) {
    scopeNotes.push('Outside dates are compared as months after signing.');
  }
  if (metrics.some((summary) => summary.unit === 'days_equivalent')) {
    scopeNotes.push('Hours are converted at 24 hours per day so notice periods share one day scale.');
  }
  if (substantiveSpecs.some((spec) => spec.comparison?.kind === 'money'
    && spec.semantics?.stratifyDimensions?.includes('cadence'))) {
    scopeNotes.push('Dollar thresholds are percentages of deal value; peer cohorts are separated by deal-value basis and cadence.');
  }
  if (metrics.some((summary) => summary.denominatorPrecision === DENOMINATOR_PRECISION.APPROXIMATE)) {
    scopeNotes.push('This deal’s percentage uses an approximate deal-value denominator.');
  }
  if (metrics.some((summary) => summary.denominatorPrecision === DENOMINATOR_PRECISION.NOT_CAPTURED)) {
    scopeNotes.push('Deal-value denominator precision was not captured; this deal’s percentage is not presented as exact.');
  }
  return {
    marketKey: resolution.rowKey,
    marketRowKey: resolution.rowKey,
    label: resolution.label || resolution.rowKey,
    peerSetSize,
    termDealCount,
    scope: 'typed-row-metric',
    scopeNote: scopeNotes.join(' '),
    treatments,
    exceptions,
    metrics,
    currentDealTerms,
    primarySummary: metrics[0] || treatments[0] || exceptions[0] || entries[0].summary,
    deals: uniqueDeals(entries.map(({ summary }) => summary)),
    truncated: false,
  };
}

export function registerTypedRowMarketContext(resolution, data, fallbackSummary = null) {
  const context = buildTypedRowMarketContext(resolution, data, fallbackSummary);
  if (typeof window === 'undefined' || !resolution?.rowKey) return context;
  const registry = window.__MTX_ROW_MARKET_CONTEXTS__ || (window.__MTX_ROW_MARKET_CONTEXTS__ = {});
  const key = `typed-row:${resolution.rowKey}`;
  if (context) registry[key] = context;
  else delete registry[key];
  window.dispatchEvent(new CustomEvent('mtx:row-market-context-updated', {
    detail: { rowKey: resolution.rowKey, context },
  }));
  return context;
}

export function attachTypedRowMarketContext(node, resolution, data, fallbackSummary = null) {
  if (!node || typeof node !== 'object') return null;
  const context = buildTypedRowMarketContext(resolution, data, fallbackSummary);
  if (context) node[TYPED_ROW_CONTEXT_PROPERTY] = context;
  else delete node[TYPED_ROW_CONTEXT_PROPERTY];
  return context;
}

export function exactMarketContextForRowKey(contexts, rowKey) {
  if (!rowKey || !Array.isArray(contexts)) return null;
  return contexts.find((context) => String(context?.marketRowKey || '') === String(rowKey)) || null;
}

export function exactMarketContextForCell(cell, contexts, rowKey) {
  const attached = cell?.[TYPED_ROW_CONTEXT_PROPERTY];
  if (attached && String(attached.marketRowKey || '') === String(rowKey || '')) return attached;
  return exactMarketContextForRowKey(contexts, rowKey);
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
