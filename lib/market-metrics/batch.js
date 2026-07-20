import { MARKET_METRIC_CONTRACT_VERSION, assertValidMarketMetricSpec } from './contract.js';
import { resolveMarketMetricRow } from './adapter.js';

function collectResolutions(input, context) {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap((entry) => collectResolutions(entry, context));
  if (Array.isArray(input.rows) && input.sectionId) return input.rows.flatMap((entry) => collectResolutions(entry, context));
  if (Array.isArray(input.metrics) && input.rowKey) return [input];
  if (input.row) return [resolveMarketMetricRow(input.row, { ...context, ...(input.context || {}) })];
  return [resolveMarketMetricRow(input, context)];
}

export function buildMarketMetricBatchRequest(input, context = {}) {
  const resolutions = collectResolutions(input, context);
  const specs = [];
  const seen = new Set();
  for (const resolution of resolutions) {
    for (const metric of resolution.metrics) {
      assertValidMarketMetricSpec(metric);
      const identity = `${metric.rowKey}\u0000${metric.metricKey}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      specs.push(metric);
    }
  }
  return {
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    ...(context.subjectDealId ? { subjectDealId: context.subjectDealId } : {}),
    ...(context.filters ? { filters: context.filters } : {}),
    specs,
  };
}

export function splitMarketMetricBatchRequest(request, maxMetrics = 400) {
  const specs = Array.isArray(request?.specs) ? request.specs : [];
  if (!specs.length) return [];
  if (!Number.isInteger(maxMetrics) || maxMetrics < 1) throw new Error('maxMetrics must be a positive integer.');

  const rowGroups = [];
  const byRow = new Map();
  for (const spec of specs) {
    if (!byRow.has(spec.rowKey)) {
      const group = [];
      byRow.set(spec.rowKey, group);
      rowGroups.push(group);
    }
    byRow.get(spec.rowKey).push(spec);
  }

  const chunks = [];
  let current = [];
  for (const group of rowGroups) {
    if (group.length > maxMetrics) throw new Error(`Market row ${group[0]?.rowKey || '<unknown>'} exceeds the batch limit.`);
    if (current.length && current.length + group.length > maxMetrics) {
      chunks.push(current);
      current = [];
    }
    current.push(...group);
  }
  if (current.length) chunks.push(current);

  return chunks.map((chunkSpecs) => ({ ...request, specs: chunkSpecs }));
}

export function mergeMarketMetricBatchResponses(responses, request) {
  const byRow = Object.create(null);
  const errors = [];
  let cohort = null;
  for (const response of responses || []) {
    Object.assign(byRow, response?.byRow || {});
    if (!cohort && response?.cohort) cohort = response.cohort;
    if (Array.isArray(response?.errors)) errors.push(...response.errors);
  }
  return {
    contractVersion: request?.contractVersion,
    cohort,
    rowOrder: [...new Set((request?.specs || []).map((spec) => spec.rowKey))],
    byRow,
    errors,
  };
}

export function groupMarketMetricResults(results) {
  const byRow = new Map();
  for (const result of results || []) {
    if (!result?.rowKey || !result?.metricKey) continue;
    if (!byRow.has(result.rowKey)) byRow.set(result.rowKey, new Map());
    byRow.get(result.rowKey).set(result.metricKey, result);
  }
  return byRow;
}
