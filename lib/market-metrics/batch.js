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

  const parents = specs.map((_, index) => index);
  const find = (index) => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const next = parents[index];
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  const firstByRow = new Map();
  const indexByMetric = new Map();
  specs.forEach((spec, index) => {
    if (firstByRow.has(spec.rowKey)) union(index, firstByRow.get(spec.rowKey));
    else firstByRow.set(spec.rowKey, index);
    if (!indexByMetric.has(spec.metricKey)) indexByMetric.set(spec.metricKey, index);
  });
  specs.forEach((spec, index) => {
    const dependencyKey = spec.denominator?.conditionalOn?.metricKey;
    if (dependencyKey && indexByMetric.has(dependencyKey)) union(index, indexByMetric.get(dependencyKey));
  });

  const componentsByRoot = new Map();
  for (let index = 0; index < specs.length; index += 1) {
    const root = find(index);
    if (!componentsByRoot.has(root)) componentsByRoot.set(root, []);
    componentsByRoot.get(root).push(specs[index]);
  }
  const components = [...componentsByRoot.values()];

  const chunks = [];
  let current = [];
  for (const component of components) {
    if (component.length > maxMetrics) {
      const rowKeys = [...new Set(component.map((spec) => spec.rowKey))];
      throw new Error(`Market metric dependency component containing ${rowKeys.join(', ') || '<unknown>'} exceeds the batch limit.`);
    }
    if (current.length && current.length + component.length > maxMetrics) {
      chunks.push(current);
      current = [];
    }
    current.push(...component);
  }
  if (current.length) chunks.push(current);

  return chunks.map((chunkSpecs) => ({ ...request, specs: chunkSpecs }));
}

export async function runMarketMetricBatchPool(
  requests,
  fetchBatch,
  { concurrency = 3, retries = 1, onSettled } = {},
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be a positive integer.');
  }
  if (!Number.isInteger(retries) || retries < 0) {
    throw new Error('retries must be a non-negative integer.');
  }
  const queue = Array.isArray(requests) ? requests : [];
  const settled = new Array(queue.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < queue.length) {
      const index = nextIndex;
      nextIndex += 1;
      let attempts = 0;
      while (attempts <= retries) {
        try {
          settled[index] = { status: 'fulfilled', value: await fetchBatch(queue[index], index) };
          break;
        } catch (reason) {
          if (attempts === retries) settled[index] = { status: 'rejected', reason };
          attempts += 1;
        }
      }
      if (onSettled) onSettled(settled[index], index);
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(concurrency, queue.length) },
    () => worker(),
  ));
  return settled;
}

export function mergeMarketMetricBatchResponses(responses, request) {
  const byRow = Object.create(null);
  const dealDirectory = Object.create(null);
  const errors = [];
  let cohort = null;
  for (const response of responses || []) {
    Object.assign(byRow, response?.byRow || {});
    Object.assign(dealDirectory, response?.dealDirectory || {});
    if (!cohort && response?.cohort) cohort = response.cohort;
    if (Array.isArray(response?.errors)) errors.push(...response.errors);
  }
  return {
    contractVersion: request?.contractVersion,
    cohort,
    rowOrder: [...new Set((request?.specs || []).map((spec) => spec.rowKey))],
    byRow,
    dealDirectory,
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
