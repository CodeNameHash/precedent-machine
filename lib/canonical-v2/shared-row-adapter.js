const { validateSharedServingRow } = require('./shared-serving-row');

const METRIC_PRESENTATION = Object.freeze({
  REPRESENTATION_ACCURACY_STANDARD: Object.freeze({
    row_label: 'Accuracy of representations',
    metric_label: 'Accuracy standard',
    comparison_kind: 'categorical',
    presentation_role: 'treatment',
  }),
});

const SURFACES = Object.freeze(['REVIEW', 'CORPUS_CONTEXT', 'COMPARE', 'QUERY']);

function adaptSharedServingRow(row) {
  validateSharedServingRow(row);
  if (row.row_kind !== 'CANONICAL_RESULT') {
    throw new TypeError('only a canonical result has a fixture typed-market adapter');
  }
  const result = row.canonical_result;
  const market = result.market_context;
  const presentation = METRIC_PRESENTATION[market.metric_key];
  if (!presentation) throw new TypeError('metric has no governed fixture presentation');
  const counts = market.cohort.counts;
  const metricResult = {
    state: 'ready',
    coverage: {
      cohortCount: counts.eligible_deals,
      eligibleCount: counts.eligible_deals,
      applicableCount: counts.applicable_deals,
      examinedCount: counts.examined_deals,
      presentCount: counts.present_deals,
      comparableCount: counts.comparable_deals,
      distributionCount: counts.distribution_deals,
      excludedCount: counts.excluded_slots,
    },
    subject: {
      value: market.subject_observation.canonical_value,
    },
    distribution: {
      denominatorCount: market.denominators.distribution.deal_count,
      values: market.cohort.distribution.map((item) => ({
        value: item.canonical_value,
        count: item.deal_count,
        subjectCount: item.subject_count,
      })),
    },
    exclusions: market.cohort.exclusions.map((item) => ({
      reasonCode: item.reason_code,
      slotCount: item.slot_count,
      dealCount: item.deal_count,
    })),
  };
  const resolution = {
    rowKey: row.row_serving_key,
    label: presentation.row_label,
    metrics: [{
      metricKey: market.metric_key,
      label: presentation.metric_label,
      comparison: { kind: presentation.comparison_kind },
      presentation: { role: presentation.presentation_role },
    }],
  };
  const data = {
    loading: false,
    error: null,
    failedRowKeys: [],
    dealDirectory: {},
    byRow: {
      [row.row_serving_key]: {
        metrics: {
          [market.metric_key]: metricResult,
        },
      },
    },
  };
  const typedMarket = {
    section: { rows: [resolution] },
    data,
  };
  return Object.freeze({
    row_key: row.row_serving_key,
    resolution,
    data,
    typed_market: typedMarket,
    surface_bindings: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze({
      surface,
      row_key: row.row_serving_key,
      typed_market: typedMarket,
    })]))),
  });
}

module.exports = {
  METRIC_PRESENTATION,
  SURFACES,
  adaptSharedServingRow,
};
