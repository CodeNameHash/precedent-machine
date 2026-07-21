const {
  prepareSharedRowsForRendering,
  validateSharedServingRow,
} = require('./shared-serving-row');

const METRIC_PRESENTATION = Object.freeze({
  IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE: Object.freeze({
    row_label: 'Capital expenditures',
    metric_label: 'Capex threshold',
    comparison_kind: 'money',
    presentation_role: 'metric',
  }),
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: Object.freeze({
    row_label: 'Initial matching period',
    metric_label: 'Initial match',
    comparison_kind: 'duration',
    presentation_role: 'metric',
  }),
  NO_SHOP_NOTICE_PERIOD_DAYS: Object.freeze({
    row_label: 'Proposal notice period',
    metric_label: 'Notice period',
    comparison_kind: 'duration',
    presentation_role: 'metric',
  }),
  NO_SHOP_PROHIBITED_ACTION: Object.freeze({
    row_label: 'No-shop / non-solicit restriction',
    metric_label: 'Prohibited action',
    comparison_kind: 'categorical',
    presentation_role: 'treatment',
    value_labels: Object.freeze({
      SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE: 'Solicit, assist, initiate, encourage or facilitate',
      ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS: 'Enter, continue or participate in discussions or negotiations',
      CHANGE_RECOMMENDATION: 'Change the board recommendation',
      ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT: 'Enter an alternative transaction agreement',
      APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION: 'Approve, authorise or announce an intention to do any prohibited action',
    }),
  }),
  NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS: Object.freeze({
    row_label: 'Subsequent matching period',
    metric_label: 'Subsequent match',
    comparison_kind: 'duration',
    presentation_role: 'metric',
  }),
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

const EXCEPTION_LABELS = Object.freeze({
  PERMITS_LIMITED_INFORMATION_SHARING: 'May provide information for a qualifying unsolicited proposal',
  PERMITS_DISCUSSIONS_OR_NEGOTIATIONS: 'May discuss or negotiate a qualifying unsolicited proposal',
  PERMITS_CONFIDENTIALITY_AGREEMENT: 'May enter the required confidentiality agreement',
});

const PREREQUISITE_LABELS = Object.freeze({
  BEFORE_STOCKHOLDER_APPROVAL: 'before stockholder approval',
  NO_PRIOR_BREACH: 'proposal did not result from a breach',
  CONFIDENTIALITY_AGREEMENT_NO_LESS_FAVOURABLE: 'confidentiality terms no less favourable',
  BUYER_RECEIVES_INFORMATION_CONCURRENTLY: 'buyer receives the information concurrently',
  BOARD_GOOD_FAITH_DETERMINATION: 'good-faith board determination after adviser consultation',
  EXPECTED_TO_LEAD_TO_SUPERIOR_PROPOSAL: 'proposal is or is expected to lead to a Superior Proposal',
  FIDUCIARY_DUTIES_REQUIRE_ACTION: 'failure to act would be inconsistent with fiduciary duties',
});

function durationSemantics(basisKey) {
  const [, basis, trigger] = String(basisKey || '').split(':');
  return {
    unit: basis === 'BUSINESS' ? 'business_days' : 'days_equivalent',
    calendarBasis: String(basis || '').toLowerCase(),
    trigger,
  };
}

function valueLabel(presentation, value, basisKey) {
  if (presentation.value_labels) return presentation.value_labels[value] || String(value);
  if (presentation.comparison_kind === 'money') return `${value}% of headline deal value`;
  const semantics = durationSemantics(basisKey);
  const amount = Number(value);
  const unit = semantics.unit === 'business_days'
    ? (amount === 1 ? 'business day' : 'business days')
    : (amount === 1 ? 'elapsed day' : 'elapsed days');
  return `${value} ${unit}`;
}

function numericStats(market) {
  const points = market.cohort.distribution.map((item) => ({
    value: Number(item.canonical_value),
    count: item.subject_count,
  }));
  const total = points.reduce((sum, item) => sum + item.count, 0);
  const weighted = points.reduce((sum, item) => sum + (item.value * item.count), 0);
  const values = points.map((item) => item.value);
  return {
    n: total,
    min: Math.min(...values),
    p25: Math.min(...values),
    median: Number(market.subject_observation.canonical_value),
    mean: total ? weighted / total : null,
    p75: Math.max(...values),
    max: Math.max(...values),
  };
}

function durationDistribution(market) {
  const semantics = durationSemantics(market.subject_observation.basis_key);
  return {
    cohorts: [{
      semantics,
      stats: numericStats(market),
      dealIds: [],
    }],
  };
}

function moneyDistribution(market) {
  return {
    normalised: {
      cohorts: [{
        basis: 'headline_transaction_value',
        semantics: { unit: 'percent' },
        percent: { stats: numericStats(market) },
        dealIds: [],
      }],
    },
  };
}

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
    key: market.metric_key === 'REPRESENTATION_ACCURACY_STANDARD' ? 'accuracy_standard' : 'primary_value',
    label: presentation.metric_label,
    value: valueLabel(
      presentation,
      market.subject_observation.canonical_value,
      market.subject_observation.basis_key,
    ),
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
  if (EXCEPTION_LABELS[effect?.legal_operation]) {
    legalTerms.push({
      key: 'permitted_exception',
      label: 'Permitted exception',
      value: EXCEPTION_LABELS[effect.legal_operation],
    });
  }
  if (Array.isArray(effect?.prerequisites)) {
    legalTerms.push({
      key: 'exception_conditions',
      label: 'Conditions',
      value: effect.prerequisites.map((code) => PREREQUISITE_LABELS[code] || code).join('; '),
    });
  }
  if (effect?.legal_operation === 'EXCLUDES_CAPEX_RESTRICTION_WHEN_APPLICABLE') {
    legalTerms.push(
      { key: 'period', label: 'Applies', value: 'During the pre-closing period' },
      {
        key: 'exceptions',
        label: 'Exceptions',
        value: 'Required or contemplated by the agreement or law; Parent written consent; Company Disclosure Schedule',
      },
      {
        key: 'consent_standard',
        label: 'Consent standard',
        value: 'Not unreasonably withheld, conditioned or delayed',
      },
    );
  }
  const subjectLabel = valueLabel(
    presentation,
    market.subject_observation.canonical_value,
    market.subject_observation.basis_key,
  );
  const isDuration = presentation.comparison_kind === 'duration';
  const isMoney = presentation.comparison_kind === 'money';
  const orderedDistribution = [...market.cohort.distribution].sort((left, right) => {
    const subjectValue = market.subject_observation.canonical_value;
    if (left.canonical_value === subjectValue && right.canonical_value !== subjectValue) return -1;
    if (right.canonical_value === subjectValue && left.canonical_value !== subjectValue) return 1;
    return 0;
  });
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
      value: isDuration || isMoney
        ? Number(market.subject_observation.canonical_value)
        : market.subject_observation.canonical_value,
      label: subjectLabel,
      ...(isDuration ? { semantics: durationSemantics(market.subject_observation.basis_key) } : {}),
      ...(isMoney ? {
        percentOfDealValue: Number(market.subject_observation.canonical_value),
        dealValueBasis: 'headline_transaction_value',
        semantics: { unit: 'percent' },
        rawAmount: result.components[0].raw_value,
        denominator: result.components[0].denominator,
      } : {}),
      legalTerms,
    },
    distribution: isDuration ? durationDistribution(market) : isMoney ? moneyDistribution(market) : {
      denominatorCount: market.denominators.distribution.deal_count,
      values: orderedDistribution.map((item) => ({
        value: item.canonical_value,
        label: valueLabel(presentation, item.canonical_value, market.subject_observation.basis_key),
        count: item.deal_count,
        subjectCount: item.subject_count,
      })),
    },
    exclusions: market.cohort.exclusions.map((item) => ({
      reasonCode: item.reason_code,
      slotCount: item.slot_count,
      dealCount: item.deal_count,
    })),
    source: row.source_actions.length === 1 ? {
      state: 'available',
      action: { ...row.source_actions[0] },
    } : {
      state: 'unavailable',
      reasonCode: result.source_detail_state.reason_code,
    },
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

function adaptSharedServingRows(rows) {
  return prepareSharedRowsForRendering(rows, adaptSharedServingRow).map((item) => (
    item.render_kind === 'ROW'
      ? Object.freeze({ render_kind: item.render_kind, key: item.key, prepared: item.prepared })
      : Object.freeze({ ...item })
  ));
}

module.exports = {
  METRIC_PRESENTATION,
  SURFACES,
  adaptSharedServingRow,
  adaptSharedServingRows,
};
