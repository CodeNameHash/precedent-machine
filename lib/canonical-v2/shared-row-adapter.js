const { validateSharedServingRow } = require('./shared-serving-row');

const METRIC_PRESENTATION = Object.freeze({
  REPRESENTATION_ACCURACY_STANDARD: Object.freeze({
    row_label: 'Accuracy of representations',
    metric_label: 'Accuracy standard',
    comparison_kind: 'categorical',
    presentation_role: 'treatment',
    value_labels: Object.freeze({
      MAT_ALL_MATERIAL: 'True in all material respects',
      MAT_ALL_RESPECTS_DE_MINIMIS: 'True in all respects, except de minimis inaccuracies',
      MAT_MAE_QUALIFIED: 'True except where failure would not cause an MAE',
    }),
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
  const effect = result.components[0].bounded_relationship_effects[0]?.effect || null;
  const legalTerms = [{
    key: 'accuracy_standard',
    label: 'Accuracy standard',
    value: presentation.value_labels[market.subject_observation.canonical_value],
  }];
  if (effect?.exception === 'DE_MINIMIS_INACCURACIES') {
    legalTerms.push({ key: 'exception', label: 'Exception', value: 'De minimis inaccuracies' });
  }
  if (Array.isArray(effect?.time_points)) {
    legalTerms.push({
      key: 'time_points',
      label: 'Tested when',
      value: 'Signing and closing; specified earlier date where applicable',
    });
  }
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
      excludedCount: counts.excluded_deals,
      excludedSlotCount: counts.excluded_slots,
    },
    subject: {
      status: 'present',
      value: market.subject_observation.canonical_value,
      label: presentation.value_labels[market.subject_observation.canonical_value],
      legalTerms,
    },
    distribution: {
      denominatorCount: market.denominators.distribution.deal_count,
      values: market.cohort.distribution.map((item) => ({
        value: item.canonical_value,
        label: presentation.value_labels[item.canonical_value],
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
