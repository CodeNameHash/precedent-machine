const { aggregateMetric } = require('./aggregate');
const { MarketStatsError } = require('./errors');
const { buildMetricEntries, indexDataset } = require('./observations');

function orderByDependencies(specs) {
  const byMetric = new Map(specs.map((spec) => [spec.metricKey, spec]));
  const ordered = [];
  const visited = new Set();
  function visit(spec) {
    if (visited.has(spec.metricKey)) return;
    const dependency = spec.denominator && spec.denominator.conditionalOn;
    if (dependency) visit(byMetric.get(dependency.metricKey));
    visited.add(spec.metricKey);
    ordered.push(spec);
  }
  specs.forEach(visit);
  return ordered;
}

function assertResult(result, validateMetricResult) {
  if (typeof validateMetricResult !== 'function') return;
  const validation = validateMetricResult(result);
  if (!validation || !validation.valid) {
    throw new MarketStatsError(
      'INTERNAL_ERROR',
      `Market result ${result.metricKey} violated the result contract.`,
      { metricKey: result.metricKey, errors: validation?.errors || [] },
    );
  }
}

function groupResult(byRow, result) {
  if (!byRow[result.rowKey]) {
    byRow[result.rowKey] = { rowKey: result.rowKey, metricOrder: [], metrics: Object.create(null) };
  }
  byRow[result.rowKey].metricOrder.push(result.metricKey);
  byRow[result.rowKey].metrics[result.metricKey] = result;
}

function calculateMarketStats(request, dataset, validateMetricResult) {
  const index = indexDataset(dataset);
  const entriesByMetric = new Map();
  const byRow = Object.create(null);

  for (const spec of orderByDependencies(request.specs)) {
    let entries = [];
    if (spec.comparison.status === 'comparable') {
      const dependency = spec.denominator && spec.denominator.conditionalOn;
      let allowedDealIds = null;
      if (dependency) {
        const parentEntries = entriesByMetric.get(dependency.metricKey) || [];
        allowedDealIds = new Set(parentEntries
          .filter((entry) => entry.status === dependency.state)
          .map((entry) => entry.dealId));
      }
      entries = buildMetricEntries(spec, index, {
        filters: request.filters,
        subjectDealId: request.subjectDealId,
        allowedDealIds,
      });
    }
    entriesByMetric.set(spec.metricKey, entries);
    const result = aggregateMetric(spec, entries, request.subjectDealId);
    assertResult(result, validateMetricResult);
    groupResult(byRow, result);
  }

  return {
    contractVersion: 1,
    cohort: {
      subjectDealId: request.subjectDealId,
      subjectExcludedFromBaseline: Boolean(request.subjectDealId),
      filters: request.filters,
    },
    rowOrder: [...new Set(request.specs.map((spec) => spec.rowKey))],
    byRow,
    dealDirectory: [...entriesByMetric.values()]
      .flat()
      .reduce((directory, entry) => {
        const deal = entry?.deal;
        if (!deal?.id || directory[deal.id]) return directory;
        directory[deal.id] = {
          dealId: deal.id,
          dealName: [deal.acquirer, deal.target].filter(Boolean).join(' / ') || deal.id,
          acquirer: deal.acquirer || null,
          target: deal.target || null,
        };
        return directory;
      }, Object.create(null)),
    errors: [],
  };
}

module.exports = {
  calculateMarketStats,
  groupResult,
  orderByDependencies,
};
