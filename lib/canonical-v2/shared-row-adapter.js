const {
  prepareSharedRowsForRendering,
  validateSharedServingRow,
} = require('./shared-serving-row');
const { contentId } = require('./canonical-bytes');
const {
  formatTerminationFeePathway,
} = require('./termination-fee-trigger-presentation');

const METRIC_PRESENTATION = Object.freeze({
  IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE: Object.freeze({
    row_label: 'Capital expenditures',
    metric_label: 'Capex threshold',
    comparison_kind: 'money',
    presentation_role: 'metric',
  }),
  MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE: Object.freeze({
    row_label: 'Material contracts',
    metric_label: 'Cash-flow threshold',
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
  SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: Object.freeze({
    row_label: 'Seller termination fee',
    metric_label: 'Fee amount',
    comparison_kind: 'money',
    presentation_role: 'metric',
  }),
  BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE: Object.freeze({
    row_label: 'Buyer / reverse termination fee',
    metric_label: 'Fee amount',
    comparison_kind: 'money',
    presentation_role: 'metric',
  }),
});

const SURFACES = Object.freeze(['REVIEW', 'CORPUS_CONTEXT', 'COMPARE', 'QUERY']);
const TERMINATION_FEE_METRICS = new Set([
  'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
  'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
]);

function governedReviewBinding(result, metric, component) {
  if (!result || !metric || !component) return null;
  return Object.freeze({
    concept_key: result.concept_key,
    concept_version: result.concept_version,
    party: Object.freeze({ ...result.party }),
    result_ordinal: result.result_ordinal,
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    component_slot_key: component.component_slot_key,
    governed_ordinal: component.governed_ordinal,
  });
}

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

const MATERIAL_CONTRACT_ATTRIBUTE_LABELS = Object.freeze({
  PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR: 'Payments by or to the Company',
  ANY_COMPANY_CONTRACT: 'Any Company Contract',
  BY_OR_TO_COMPANY: 'By or to the Company',
  GREATER_THAN: 'Amount in excess of the stated threshold',
  FISCAL_2023_OR_ANY_SINGLE_FISCAL_YEAR_THEREAFTER: 'FY2023 or any single fiscal year thereafter',
});
const FEE_SIDE_LABELS = Object.freeze({
  SELLER: 'Seller / target termination fee',
  BUYER: 'Buyer / reverse termination fee',
});
const FEE_TRIGGER_ORDER = Object.freeze([
  'SUPERIOR_PROPOSAL_TERMINATION',
  'CHANGE_IN_RECOMMENDATION_TERMINATION',
  'ACQUISITION_PROPOSAL_TAIL',
  // PROPOSAL-TERMF-TRIGGER-VOCABULARY-2026-07-23 additions, in the proposal's own
  // table order.
  'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
  'NO_SOLICIT_BREACH_TERMINATION',
  'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
  'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
  'OUTSIDE_DATE_TERMINATION',
  'ANTITRUST_FAILURE_TERMINATION',
  'FINANCING_FAILURE_TERMINATION',
]);

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

function approximatePercentLabel(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError('approximate percentage is not numeric');
  return `Approximately ${parsed.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}% of headline deal value`;
}

function partyLabel(value, capacity) {
  const normalisedValue = String(value || '').toLowerCase();
  const normalisedCapacity = String(capacity || '').toLowerCase();
  return `${normalisedValue.charAt(0).toUpperCase()}${normalisedValue.slice(1)} (${normalisedCapacity})`;
}

function numericStats(market) {
  const points = market.cohort.distribution.map((item) => ({
    value: Number(item.canonical_value),
    count: item.subject_count,
  })).filter((item) => Number.isFinite(item.value) && Number.isInteger(item.count) && item.count > 0)
    .sort((left, right) => left.value - right.value);
  const total = points.reduce((sum, item) => sum + item.count, 0);
  if (!total) {
    return { n: 0, min: null, p25: null, median: null, mean: null, p75: null, max: null };
  }
  const weighted = points.reduce((sum, item) => sum + (item.value * item.count), 0);
  const valueAt = (ordinal) => {
    let seen = 0;
    for (const point of points) {
      seen += point.count;
      if (ordinal < seen) return point.value;
    }
    return points.at(-1).value;
  };
  const quantile = (proportion) => {
    const position = (total - 1) * proportion;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const lower = valueAt(lowerIndex);
    const upper = valueAt(upperIndex);
    return lower + ((upper - lower) * (position - lowerIndex));
  };
  return {
    n: total,
    min: points[0].value,
    p25: quantile(0.25),
    median: quantile(0.5),
    mean: total ? weighted / total : null,
    p75: quantile(0.75),
    max: points.at(-1).value,
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

function adaptReviewedSourceSpecificRow(row) {
  const body = row.reviewed_source_specific;
  const sourceSpecific = Object.freeze({
    state: 'reviewed_source_specific',
    displayLabel: body.reviewed_display_label,
    nonComparableReason: body.non_comparable_reason,
    marketComparability: body.market_comparability,
    observedPartyTokens: Object.freeze([...body.observed_party_tokens]),
    primitives: Object.freeze(body.bounded_inline_primitives.map((primitive) => Object.freeze({
      key: primitive.primitive_id,
      kind: primitive.primitive_kind,
      rawValue: primitive.raw_value,
      interpretedValue: primitive.interpreted_value,
    }))),
    primitiveTotal: body.primitive_collection.total,
    source: Object.freeze({
      state: body.source_detail_state.state === 'AVAILABLE' ? 'available' : 'unavailable',
      reasonCode: body.source_detail_state.reason_code,
      action: row.source_actions[0] || null,
    }),
  });
  const resolution = Object.freeze({
    rowKey: row.row_serving_key,
    label: body.reviewed_display_label,
    rowKind: row.row_kind,
    governedBinding: null,
    selectedDealContextOnly: true,
    marketCohortEligible: false,
    sourceSpecific,
    metrics: Object.freeze([]),
  });
  const data = Object.freeze({
    loading: false,
    error: null,
    failedRowKeys: Object.freeze([]),
    dealDirectory: Object.freeze({}),
    byRow: Object.freeze({
      [row.row_serving_key]: Object.freeze({ sourceSpecific }),
    }),
  });
  const typedMarket = Object.freeze({ section: Object.freeze({ rows: Object.freeze([resolution]) }), data });
  return Object.freeze({
    row_key: row.row_serving_key,
    governed_binding: null,
    resolution,
    data,
    typed_market: typedMarket,
    surface_bindings: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze({
      surface,
      row_key: row.row_serving_key,
      typed_market: typedMarket,
      serving_role: surface === 'REVIEW' ? 'REVIEWED_SOURCE_PROPOSITION' : 'SELECTED_DEAL_CONTEXT_ONLY',
      market_cohort_eligible: false,
    })]))),
  });
}

function adaptIncompleteCanonicalResultRow(row) {
  const body = row.incomplete_canonical_result;
  const component = body.components[0];
  const exclusion = body.metric_exclusion;
  const governedBinding = governedReviewBinding(body, exclusion, component);
  const presentation = METRIC_PRESENTATION[exclusion.metric_key];
  if (!presentation) throw new TypeError('incomplete metric has no governed fixture presentation');
  const attributes = component.claim_attributes;
  const legalTerms = Object.freeze([
    Object.freeze({
      key: 'primary_value',
      label: presentation.metric_label,
      value: valueLabel(presentation, component.canonical_value, attributes.basis_key),
    }),
    Object.freeze({
      key: 'raw_amount',
      label: 'Source threshold',
      value: String(component.raw_value),
    }),
    Object.freeze({
      key: 'criterion',
      label: 'Criterion',
      value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[attributes.criterion_code] || attributes.criterion_code,
    }),
    Object.freeze({
      key: 'contract_scope',
      label: 'Contract scope',
      value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[attributes.contract_scope_code] || attributes.contract_scope_code,
    }),
    Object.freeze({
      key: 'cash_flow_direction',
      label: 'Cash flow',
      value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[attributes.cash_flow_direction_code] || attributes.cash_flow_direction_code,
    }),
    Object.freeze({
      key: 'period',
      label: 'Measured over',
      value: attributes.measurement_period_raw_text,
    }),
    Object.freeze({
      key: 'threshold_rule',
      label: 'Threshold rule',
      value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[attributes.comparison_operator] || attributes.comparison_operator,
    }),
    Object.freeze({ key: 'deal_value_basis', label: 'Deal-value basis', value: 'SEC-reported headline transaction value' }),
  ]);
  const reason = Object.freeze({
    state: 'not_certified',
    reasonCodes: Object.freeze([...body.governed_reason_codes]),
    message: 'The selected deal term is source-backed, but its measurement period is not mapped to the frozen cross-deal taxonomy.',
    intersectingCandidateIds: Object.freeze(body.intersecting_candidates.map(
      (candidate) => candidate.open_world_candidate_occurrence_id,
    )),
  });
  const metricResult = Object.freeze({
    state: 'not_certified',
    coverage: null,
    subject: Object.freeze({
      status: 'present',
      value: Number(component.canonical_value),
      label: valueLabel(presentation, component.canonical_value, attributes.basis_key),
      percentOfDealValue: Number(component.canonical_value),
      dealValueBasis: 'headline_transaction_value',
      semantics: Object.freeze({ unit: 'percent' }),
      rawAmount: component.raw_value,
      denominator: component.denominator,
      legalTerms,
    }),
    distribution: null,
    exclusions: Object.freeze([Object.freeze({
      reasonCode: exclusion.exclusion_reason,
      marketAuthority: exclusion.aggregate_authority,
    })]),
    comparability: reason,
    source: Object.freeze(row.source_actions.length === 1 ? {
      state: 'available',
      action: { ...row.source_actions[0] },
    } : {
      state: 'unavailable',
      reasonCode: body.source_detail_state.reason_code,
    }),
  });
  const resolution = Object.freeze({
    rowKey: row.row_serving_key,
    label: presentation.row_label,
    rowKind: row.row_kind,
    governedBinding,
    selectedDealContextOnly: true,
    marketCohortEligible: false,
    metrics: Object.freeze([Object.freeze({
      metricKey: exclusion.metric_key,
      label: presentation.metric_label,
      comparison: Object.freeze({ kind: presentation.comparison_kind }),
      presentation: Object.freeze({ role: presentation.presentation_role }),
    })]),
  });
  const data = Object.freeze({
    loading: false,
    error: null,
    failedRowKeys: Object.freeze([]),
    dealDirectory: Object.freeze({}),
    byRow: Object.freeze({
      [row.row_serving_key]: Object.freeze({
        metrics: Object.freeze({ [exclusion.metric_key]: metricResult }),
      }),
    }),
  });
  const typedMarket = Object.freeze({ section: Object.freeze({ rows: Object.freeze([resolution]) }), data });
  return Object.freeze({
    row_key: row.row_serving_key,
    governed_binding: governedBinding,
    resolution,
    data,
    typed_market: typedMarket,
    surface_bindings: Object.freeze(Object.fromEntries(SURFACES.map((surface) => [surface, Object.freeze({
      surface,
      row_key: row.row_serving_key,
      typed_market: typedMarket,
      serving_role: surface === 'REVIEW' ? 'INCOMPLETE_CANONICAL_RESULT' : 'SELECTED_DEAL_CONTEXT_ONLY',
      market_cohort_eligible: false,
    })]))),
  });
}

function adaptSharedServingRow(row) {
  validateSharedServingRow(row);
  if (row.row_kind === 'REVIEWED_SOURCE_SPECIFIC') return adaptReviewedSourceSpecificRow(row);
  if (row.row_kind === 'INCOMPLETE_CANONICAL_RESULT') return adaptIncompleteCanonicalResultRow(row);
  if (row.row_kind !== 'CANONICAL_RESULT') throw new TypeError('shared row variant has no fixture typed-market adapter');
  const result = row.canonical_result;
  const claimAttributes = result.components[0].claim_attributes;
  const contextComponents = result.components.slice(1);
  const market = result.market_context;
  const governedBinding = governedReviewBinding(result, market, result.components[0]);
  const presentation = METRIC_PRESENTATION[market.metric_key];
  if (!presentation) throw new TypeError('metric has no governed fixture presentation');
  const counts = market.cohort.counts;
  const effect = result.components[0].bounded_relationship_effects[0]?.effect || null;
  const feeTriggerEffects = result.components[0].bounded_relationship_effects
    .filter((row) => row.relationship_definition_key === 'TRIGGERED_BY')
    .map((row) => row.effect)
    .sort((left, right) => (
      FEE_TRIGGER_ORDER.indexOf(left.trigger_code) - FEE_TRIGGER_ORDER.indexOf(right.trigger_code)
    ));
  const legalTerms = [{
    key: market.metric_key === 'REPRESENTATION_ACCURACY_STANDARD' ? 'accuracy_standard' : 'primary_value',
    label: presentation.metric_label,
    value: valueLabel(
      presentation,
      market.subject_observation.canonical_value,
      market.subject_observation.basis_key,
    ),
  }];
  if (TERMINATION_FEE_METRICS.has(market.metric_key)
    && claimAttributes.denominator_precision === 'APPROXIMATE') {
    legalTerms[0] = {
      ...legalTerms[0],
      value: approximatePercentLabel(market.subject_observation.canonical_value),
    };
  }
  const exceptionComponent = contextComponents.find(
    (component) => component.component_slot_key === 'ACCURACY_EXCEPTION',
  );
  if (exceptionComponent?.canonical_value === 'DE_MINIMIS_INACCURACIES'
    || effect?.exception === 'DE_MINIMIS_INACCURACIES') {
    legalTerms.push({ key: 'exception', label: 'Exception', value: 'De minimis inaccuracies' });
  }
  if (Array.isArray(effect?.time_points)) {
    legalTerms.push({
      key: 'time_points',
      label: 'Tested when',
      value: 'Signing and closing; specified earlier date where applicable',
    });
  }
  contextComponents
    .filter((component) => component.component_slot_key.startsWith('KNOWLEDGE_QUALIFIER_'))
    .forEach((component, index) => {
      legalTerms.push({
        key: `knowledge_qualifier_${index + 1}`,
        label: component.claim_attributes.representation_subject_label || `Representation limb ${index + 1}`,
        value: component.component_state === 'ABSENT' ? 'No knowledge qualifier' : 'Knowledge qualified',
      });
    });
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
  if (TERMINATION_FEE_METRICS.has(market.metric_key)) {
    legalTerms.push(
      { key: 'fee_side', label: 'Fee side', value: FEE_SIDE_LABELS[claimAttributes.fee_side] },
      { key: 'payer', label: 'Payer', value: partyLabel(result.party.value, result.party.capacity) },
      { key: 'payee', label: 'Payee', value: partyLabel(claimAttributes.payee_value, claimAttributes.payee_capacity) },
      {
        key: 'deal_value_basis',
        label: 'Deal-value basis',
        value: claimAttributes.denominator_precision === 'APPROXIMATE'
          ? 'SEC-reported approximate headline transaction value'
          : 'SEC-reported headline transaction value',
      },
      ...feeTriggerEffects.map((trigger, index) => ({
        key: `trigger_${index + 1}`,
        label: index === 0 ? 'Trigger pathways' : '',
        value: formatTerminationFeePathway(trigger),
      })),
    );
  }
  if (market.metric_key === 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE') {
    legalTerms.push(
      { key: 'criterion', label: 'Criterion', value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[claimAttributes.criterion_code] },
      { key: 'contract_scope', label: 'Contract scope', value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[claimAttributes.contract_scope_code] },
      { key: 'cash_flow_direction', label: 'Cash flow', value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[claimAttributes.cash_flow_direction_code] },
      { key: 'period', label: 'Measured over', value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[claimAttributes.measurement_period_code] },
      { key: 'threshold_rule', label: 'Threshold rule', value: MATERIAL_CONTRACT_ATTRIBUTE_LABELS[claimAttributes.comparison_operator] },
      { key: 'deal_value_basis', label: 'Deal-value basis', value: 'SEC-reported headline transaction value' },
    );
  }
  const subjectLabel = TERMINATION_FEE_METRICS.has(market.metric_key)
    && claimAttributes.denominator_precision === 'APPROXIMATE'
    ? approximatePercentLabel(market.subject_observation.canonical_value)
    : valueLabel(
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
    rowKind: row.row_kind,
    governedBinding,
    selectedDealContextOnly: false,
    marketCohortEligible: true,
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
    governed_binding: governedBinding,
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
  const failureOrdinals = new Map();
  return prepareSharedRowsForRendering(rows, adaptSharedServingRow).map((item) => {
    if (item.render_kind === 'ROW') {
      return Object.freeze({ render_kind: item.render_kind, key: item.key, prepared: item.prepared });
    }
    const failureOrdinal = failureOrdinals.get(item.key) || 0;
    failureOrdinals.set(item.key, failureOrdinal + 1);
    return Object.freeze({
      ...item,
      key: contentId('SHARED_ROW_ADAPTER_RENDER_FAILURE/V1', {
        supplied_key: item.key,
        reason_code: item.reason_code,
        failure_ordinal: failureOrdinal,
      }),
    });
  });
}

module.exports = {
  METRIC_PRESENTATION,
  SURFACES,
  adaptSharedServingRow,
  adaptSharedServingRows,
};
