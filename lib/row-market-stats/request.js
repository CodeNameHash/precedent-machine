const { MarketStatsError } = require('./errors');

const MAX_BATCH_METRICS = 500;
const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value, path) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !value.trim()) {
    throw new MarketStatsError('INVALID_REQUEST', `${path} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalNumber(value, path) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new MarketStatsError('INVALID_REQUEST', `${path} must be a finite number.`);
  }
  return parsed;
}

function assertSafeObjectKey(value, path) {
  if (typeof value === 'string' && RESERVED_OBJECT_KEYS.has(value.trim())) {
    throw new MarketStatsError('INVALID_REQUEST', `${path} uses a reserved object key.`);
  }
}

function normaliseFilters(filters) {
  if (filters === undefined) return {};
  if (!isObject(filters)) {
    throw new MarketStatsError('INVALID_REQUEST', 'filters must be an object.');
  }
  const result = {
    sector: optionalText(filters.sector, 'filters.sector'),
    buyer: optionalText(filters.buyer, 'filters.buyer'),
    form: optionalText(filters.form, 'filters.form'),
    yearFrom: optionalNumber(filters.yearFrom, 'filters.yearFrom'),
    yearTo: optionalNumber(filters.yearTo, 'filters.yearTo'),
    minValueUsd: optionalNumber(filters.minValueUsd ?? filters.minValue, 'filters.minValueUsd'),
    maxValueUsd: optionalNumber(filters.maxValueUsd ?? filters.maxValue, 'filters.maxValueUsd'),
  };
  if (result.yearFrom !== null && result.yearTo !== null && result.yearFrom > result.yearTo) {
    throw new MarketStatsError('INVALID_REQUEST', 'filters.yearFrom cannot exceed filters.yearTo.');
  }
  if (result.minValueUsd !== null && result.maxValueUsd !== null && result.minValueUsd > result.maxValueUsd) {
    throw new MarketStatsError('INVALID_REQUEST', 'filters.minValueUsd cannot exceed filters.maxValueUsd.');
  }
  return result;
}

function assertExecutableSpec(spec) {
  if (spec.comparison.status !== 'comparable') return;
  const presence = spec.observation && spec.observation.presence;
  if (
    presence
    && presence.strategy === 'card_exists'
    && spec.cohort.scope === 'all_deals'
    && (!Array.isArray(presence.provisionCodes) || presence.provisionCodes.length === 0)
  ) {
    throw new MarketStatsError(
      'UNSUPPORTED_METRIC_SPEC',
      `Metric ${spec.metricKey} uses card_exists without exact provisionCodes.`,
      { metricKey: spec.metricKey },
    );
  }
}

function validateDependencies(specs) {
  const byMetric = new Map(specs.map((spec) => [spec.metricKey, spec]));
  for (const spec of specs) {
    const dependency = spec.denominator && spec.denominator.conditionalOn;
    if (!dependency) continue;
    if (!byMetric.has(dependency.metricKey)) {
      throw new MarketStatsError(
        'MISSING_DEPENDENCY',
        `Metric ${spec.metricKey} depends on missing metric ${dependency.metricKey}.`,
        { metricKey: spec.metricKey, dependency: dependency.metricKey },
      );
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(metricKey) {
    if (visited.has(metricKey)) return;
    if (visiting.has(metricKey)) {
      throw new MarketStatsError('CYCLIC_DEPENDENCY', `Metric dependency cycle includes ${metricKey}.`);
    }
    visiting.add(metricKey);
    const dependency = byMetric.get(metricKey)?.denominator?.conditionalOn?.metricKey;
    if (dependency) visit(dependency);
    visiting.delete(metricKey);
    visited.add(metricKey);
  }
  for (const metricKey of byMetric.keys()) visit(metricKey);
}

function parseMarketStatsRequest(body, validateMetricSpec) {
  if (!isObject(body)) {
    throw new MarketStatsError('INVALID_REQUEST', 'Request body must be a JSON object.');
  }
  if (body.contractVersion !== 1) {
    throw new MarketStatsError('INVALID_REQUEST', 'contractVersion must be 1.');
  }
  if (body.specs !== undefined && body.rows !== undefined) {
    throw new MarketStatsError('INVALID_REQUEST', 'Send specs or rows, not both.');
  }
  const specs = body.specs ?? body.rows;
  if (!Array.isArray(specs) || specs.length === 0) {
    throw new MarketStatsError('INVALID_REQUEST', 'specs must be a non-empty array.');
  }
  if (specs.length > MAX_BATCH_METRICS) {
    throw new MarketStatsError('INVALID_REQUEST', `A batch may contain at most ${MAX_BATCH_METRICS} metrics.`);
  }
  if (typeof validateMetricSpec !== 'function') {
    throw new MarketStatsError('INTERNAL_ERROR', 'Market metric validation is unavailable.');
  }

  const metricKeys = new Set();
  const rowMetricKeys = new Set();
  specs.forEach((spec, index) => {
    assertSafeObjectKey(spec?.rowKey, `specs[${index}].rowKey`);
    assertSafeObjectKey(spec?.metricKey, `specs[${index}].metricKey`);
    const validation = validateMetricSpec(spec);
    if (!validation || !validation.valid) {
      throw new MarketStatsError(
        'INVALID_METRIC_SPEC',
        `Invalid market metric at specs[${index}].`,
        { index, errors: validation && Array.isArray(validation.errors) ? validation.errors : [] },
      );
    }
    const pair = `${spec.rowKey}\u0000${spec.metricKey}`;
    if (rowMetricKeys.has(pair) || metricKeys.has(spec.metricKey)) {
      throw new MarketStatsError(
        'DUPLICATE_METRIC',
        `metricKey ${spec.metricKey} must be unique within a batch.`,
        { metricKey: spec.metricKey, rowKey: spec.rowKey },
      );
    }
    rowMetricKeys.add(pair);
    metricKeys.add(spec.metricKey);
    assertExecutableSpec(spec);
  });
  validateDependencies(specs);

  return {
    contractVersion: 1,
    subjectDealId: optionalText(body.subjectDealId ?? body.deal_id, 'subjectDealId'),
    filters: normaliseFilters(body.filters),
    specs,
  };
}

module.exports = {
  MAX_BATCH_METRICS,
  normaliseFilters,
  parseMarketStatsRequest,
  validateDependencies,
};
