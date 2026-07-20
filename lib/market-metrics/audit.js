import { resolveMarketMetricRow } from './adapter.js';

function asResolution(entry, sharedContext) {
  if (entry && Array.isArray(entry.metrics) && entry.rowKey) return entry;
  if (entry && entry.row) return resolveMarketMetricRow(entry.row, { ...sharedContext, ...(entry.context || {}) });
  return resolveMarketMetricRow(entry, sharedContext);
}

export function auditMarketMetricCoverage(entries, options = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const resolutions = list.map((entry) => asResolution(entry, options.context || {}));
  const resolutionCounts = {};
  let metricCount = 0;
  let comparableMetricCount = 0;
  let nonComparableMetricCount = 0;
  for (const resolution of resolutions) {
    resolutionCounts[resolution.resolution] = (resolutionCounts[resolution.resolution] || 0) + 1;
    metricCount += resolution.metrics.length;
    comparableMetricCount += resolution.metrics.filter((metric) => metric.comparison.status === 'comparable').length;
    nonComparableMetricCount += resolution.metrics.filter((metric) => metric.comparison.status === 'non_comparable').length;
  }

  const presenceCovered = resolutions.filter((resolution) => resolution.metrics.some(
    (metric) => metric.comparison.status === 'comparable' && metric.comparison.kind === 'presence',
  ));
  const comparableRows = resolutions.filter((resolution) => resolution.metrics.some(
    (metric) => metric.comparison.status === 'comparable',
  ));
  const valueCoveredRows = resolutions.filter((resolution) => resolution.metrics.some(
    (metric) => metric.comparison.status === 'comparable' && metric.comparison.kind !== 'presence',
  ));
  const invalidRows = resolutions.filter((resolution) => resolution.errors.length > 0);
  const nonComparableRows = resolutions.filter((resolution) => resolution.metrics.every(
    (metric) => metric.comparison.status === 'non_comparable',
  ));
  const denominator = resolutions.length || 1;

  return {
    rowCount: resolutions.length,
    metricCount,
    comparableMetricCount,
    nonComparableMetricCount,
    comparableRowCount: comparableRows.length,
    presenceCoveredRowCount: presenceCovered.length,
    valueCoveredRowCount: valueCoveredRows.length,
    nonComparableRowCount: nonComparableRows.length,
    invalidRowCount: invalidRows.length,
    comparableCoverage: resolutions.length ? comparableRows.length / denominator : 1,
    presenceCoverage: resolutions.length ? presenceCovered.length / denominator : 1,
    valueCoverage: resolutions.length ? valueCoveredRows.length / denominator : 1,
    resolutionCounts,
    rows: resolutions,
    gaps: nonComparableRows.map((resolution) => ({
      rowKey: resolution.rowKey,
      label: resolution.label,
      reasons: resolution.metrics.map((metric) => metric.comparison.reason),
    })),
    invalid: invalidRows.map((resolution) => ({
      rowKey: resolution.rowKey,
      label: resolution.label,
      errors: resolution.errors,
    })),
  };
}

export function assertMarketMetricCoverage(entries, options = {}) {
  const audit = auditMarketMetricCoverage(entries, options);
  const failures = [];
  if (audit.invalidRowCount) failures.push(`${audit.invalidRowCount} row(s) have invalid metric contracts`);
  if (options.requireComparable !== false && audit.nonComparableRowCount) {
    failures.push(`${audit.nonComparableRowCount} row(s) have no comparable metric`);
  }
  if (options.requirePresence !== false && audit.presenceCoveredRowCount !== audit.rowCount) {
    failures.push(`${audit.rowCount - audit.presenceCoveredRowCount} row(s) have no presence metric`);
  }
  if (options.requireValue === true && audit.valueCoveredRowCount !== audit.rowCount) {
    failures.push(`${audit.rowCount - audit.valueCoveredRowCount} row(s) have no comparable value metric`);
  }
  if (failures.length) {
    const gapKeys = audit.gaps.slice(0, 12).map((gap) => gap.rowKey).join(', ');
    throw new Error(`Market metric coverage failed: ${failures.join('; ')}${gapKeys ? `. Gaps: ${gapKeys}` : ''}`);
  }
  return audit;
}
