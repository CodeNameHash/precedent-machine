export const MARKET_METRIC_CONTRACT_VERSION = 1;

export const MARKET_METRIC_KINDS = Object.freeze([
  'presence',
  'categorical',
  'multi_select',
  'numeric',
  'money',
  'duration',
]);

export const MARKET_RESULT_STATES = Object.freeze([
  'ready',
  'no_occurrences',
  'unique',
  'insufficient_data',
  'not_comparable',
  'unknown',
  'error',
]);

export const NON_COMPARABLE_REASON_CODES = Object.freeze([
  'ambiguous_denominator',
  'ambiguous_time_basis',
  'deal_specific',
  'missing_canonical_identity',
  'missing_metric_definition',
  'not_legally_comparable',
  'unstructured_source',
]);

const COMPARISON_STATUSES = new Set(['comparable', 'non_comparable']);
const METRIC_KINDS = new Set(MARKET_METRIC_KINDS);
const RESULT_STATES = new Set(MARKET_RESULT_STATES);
const NON_COMPARABLE_CODES = new Set(NON_COMPARABLE_REASON_CODES);
const COHORT_SCOPES = new Set(['all_deals', 'provision_family', 'provision_codes']);
const ELIGIBILITY_RULES = new Set(['all_deals', 'family_present', 'code_present', 'instrument_present']);
const PRESENCE_STRATEGIES = new Set(['card_exists', 'feature_non_empty', 'feature_matches', 'list_item', 'definition_term', 'instrument_item', 'optional_money']);
const MISSING_STATES = new Set(['absent', 'unknown']);
const VALUE_STRATEGIES = new Set(['feature_value', 'list_item_field', 'list_items_field', 'object_field']);
const VALUE_NORMALIZERS = new Set([
  'bring_down_for_rep',
  'deadline_duration',
  'deadline_trigger',
  'equity_consideration',
  'equity_vesting',
  'abry_scope',
  'acquisition_transaction_types',
  'covenant_treatments',
  'condition_term',
  'forward_period_months',
  'employee_benefit_period',
  'financing_scope',
  'fee_expense_allocation',
  'fraud_carveout_scope',
  'insurance_cap_multiplier',
  'ioc_dollar_threshold',
  'material_contract_threshold_type',
  'parent_approval_mechanism',
  'parent_approval_timing',
  'period_months',
  'adjournment_duration',
  'cease_discussions_affiliate_standard',
  'cease_discussions_liability_standard',
  'fiduciary_final_standard',
  'fiduciary_duty_change_standard',
  'pre_vote_only',
  'stockholder_vote_standard',
  'relative_period_months',
  'assignment_exceptions',
  'assignment_restrictions',
  'third_party_beneficiary_types',
  'third_party_enforceable_rights',
  'go_shop_availability',
  'go_shop_excluded_party_treatment',
  'superior_proposal_test_factors',
  'intervening_event_rights',
  'intervening_event_scope',
  'intervening_event_exceptions',
  'intervening_event_termination_treatment',
  'late_payment_rate_basis',
  'late_payment_spread_percent',
  'late_payment_interest_base',
  'tail_window_months',
  'tail_threshold_percent',
  'tail_arming_scenarios',
  'tail_qualifying_transaction_scope',
  'transactions_exclusion',
]);
const PRESENTATION_ROLES = new Set(['prevalence', 'treatment', 'exception', 'metric']);
const ITEM_IDENTITY_KINDS = new Set(['affirmative_ioc_obligation', 'adjournment_party']);
const CANONICAL_UNITS = new Set([
  'count',
  'percent',
  'usd',
  'elapsed_hours',
  'business_days',
  'calendar_days',
  'days_equivalent',
  'months',
  'years',
  'multiplier',
]);
const CALENDAR_BASES = new Set(['elapsed', 'business', 'calendar', 'mixed']);
const CADENCES = new Set(['aggregate', 'annual', 'specified_year', 'per_event', 'per_day', 'per_month', 'one_time', 'unknown']);
const SEMANTIC_DIMENSIONS = new Set(['unit', 'calendarBasis', 'trigger', 'cadence']);
const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function add(errors, path, message) {
  errors.push({ path, message });
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isReservedObjectKey(value) {
  return typeof value === 'string' && RESERVED_OBJECT_KEYS.has(value.trim());
}

function isStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(hasText);
}

function validateCohort(cohort, errors) {
  if (!isPlainObject(cohort)) {
    add(errors, 'cohort', 'cohort must be an object.');
    return;
  }
  if (!COHORT_SCOPES.has(cohort.scope)) {
    add(errors, 'cohort.scope', `cohort.scope must be one of ${[...COHORT_SCOPES].join(', ')}.`);
  }
  if (!ELIGIBILITY_RULES.has(cohort.eligibility)) {
    add(errors, 'cohort.eligibility', `cohort.eligibility must be one of ${[...ELIGIBILITY_RULES].join(', ')}.`);
  }
  if (cohort.scope === 'provision_family' && !hasText(cohort.provisionFamily)) {
    add(errors, 'cohort.provisionFamily', 'provision_family cohorts require provisionFamily.');
  }
  if (cohort.scope === 'provision_codes' && !isStringArray(cohort.provisionCodes)) {
    add(errors, 'cohort.provisionCodes', 'provision_codes cohorts require a non-empty provisionCodes array.');
  }
  if (cohort.eligibility === 'family_present' && !hasText(cohort.provisionFamily)) {
    add(errors, 'cohort.provisionFamily', 'family_present eligibility requires provisionFamily.');
  }
  if (cohort.eligibility === 'code_present' && !isStringArray(cohort.provisionCodes)) {
    add(errors, 'cohort.provisionCodes', 'code_present eligibility requires provisionCodes.');
  }
  if (cohort.eligibility === 'instrument_present') {
    if (!hasText(cohort.instrumentCode)) add(errors, 'cohort.instrumentCode', 'instrument_present eligibility requires instrumentCode.');
    if (!isStringArray(cohort.instrumentFeatureKeys)) add(errors, 'cohort.instrumentFeatureKeys', 'instrument_present eligibility requires instrumentFeatureKeys.');
  }
}

function validatePresence(presence, errors) {
  if (!isPlainObject(presence)) {
    add(errors, 'observation.presence', 'observation.presence must be an object.');
    return;
  }
  if (!PRESENCE_STRATEGIES.has(presence.strategy)) {
    add(errors, 'observation.presence.strategy', `Unknown presence strategy ${String(presence.strategy)}.`);
    return;
  }
  if (!MISSING_STATES.has(presence.missingState)) {
    add(errors, 'observation.presence.missingState', 'presence observations must explicitly classify missing values as absent or unknown.');
  }
  if (presence.absentValues !== undefined
    && (!Array.isArray(presence.absentValues) || !presence.absentValues.every(hasText))) {
    add(errors, 'observation.presence.absentValues', 'absentValues must be an array of non-empty strings when supplied.');
  }
  if (presence.shortTitleIncludes !== undefined && !hasText(presence.shortTitleIncludes)) {
    add(errors, 'observation.presence.shortTitleIncludes', 'shortTitleIncludes must be non-empty when supplied.');
  }
  if (presence.strategy === 'feature_non_empty' && !isStringArray(presence.featureKeys)) {
    add(errors, 'observation.presence.featureKeys', 'feature_non_empty requires featureKeys.');
  }
  if (presence.strategy === 'feature_matches') {
    if (!isStringArray(presence.featureKeys)) add(errors, 'observation.presence.featureKeys', 'feature_matches requires featureKeys.');
    if (!Array.isArray(presence.values) || presence.values.length === 0) {
      add(errors, 'observation.presence.values', 'feature_matches requires one or more values.');
    }
  }
  if (presence.strategy === 'list_item') {
    if (!isStringArray(presence.featureKeys)) add(errors, 'observation.presence.featureKeys', 'list_item requires featureKeys.');
    const hasCode = hasText(presence.itemCode) || isStringArray(presence.itemCodes);
    const hasIdentity = hasText(presence.itemIdentity);
    if (!hasCode && !hasIdentity) add(errors, 'observation.presence.itemCode', 'list_item requires itemCode or itemIdentity.');
    if (hasIdentity && !ITEM_IDENTITY_KINDS.has(presence.identityKind)) {
      add(errors, 'observation.presence.identityKind', 'itemIdentity requires a supported identityKind.');
    }
  }
  if (presence.strategy === 'definition_term' && !hasText(presence.term)) {
    add(errors, 'observation.presence.term', 'definition_term requires term.');
  }
  if (presence.strategy === 'instrument_item') {
    if (!isStringArray(presence.featureKeys)) add(errors, 'observation.presence.featureKeys', 'instrument_item requires featureKeys.');
    if (!hasText(presence.instrumentCode)) add(errors, 'observation.presence.instrumentCode', 'instrument_item requires instrumentCode.');
  }
  if (presence.strategy === 'optional_money' && !isStringArray(presence.featureKeys)) {
    add(errors, 'observation.presence.featureKeys', 'optional_money requires featureKeys.');
  }
}

function validateValue(value, errors) {
  if (!isPlainObject(value)) {
    add(errors, 'observation.value', 'This metric kind requires observation.value.');
    return;
  }
  if (!VALUE_STRATEGIES.has(value.strategy)) {
    add(errors, 'observation.value.strategy', `Unknown value strategy ${String(value.strategy)}.`);
    return;
  }
  if (!isStringArray(value.featureKeys)) {
    add(errors, 'observation.value.featureKeys', 'Value observations require featureKeys.');
  }
  if (value.strategy === 'list_item_field') {
    const hasCode = hasText(value.itemCode) || isStringArray(value.itemCodes);
    const hasIdentity = hasText(value.itemIdentity);
    if (!hasCode && !hasIdentity) add(errors, 'observation.value.itemCode', 'list_item_field requires itemCode or itemIdentity.');
    if (hasIdentity && !ITEM_IDENTITY_KINDS.has(value.identityKind)) {
      add(errors, 'observation.value.identityKind', 'itemIdentity requires a supported identityKind.');
    }
    if (!hasText(value.path)) add(errors, 'observation.value.path', 'list_item_field requires path.');
    if (value.paths !== undefined && (!isStringArray(value.paths))) {
      add(errors, 'observation.value.paths', 'list_item_field paths must be a non-empty string array when supplied.');
    }
  }
  if (value.strategy === 'list_items_field' && !hasText(value.path)) {
    add(errors, 'observation.value.path', 'list_items_field requires path.');
  }
  if (value.strategy === 'object_field' && !hasText(value.path)) {
    add(errors, 'observation.value.path', 'object_field requires path.');
  }
  if (value.normalizer !== undefined && !VALUE_NORMALIZERS.has(value.normalizer)) {
    add(errors, 'observation.value.normalizer', `Unknown value normalizer ${String(value.normalizer)}.`);
  }
  if (['equity_consideration', 'equity_vesting'].includes(value.normalizer) && !hasText(value.instrumentCode)) {
    add(errors, 'observation.value.instrumentCode', `${value.normalizer} requires instrumentCode.`);
  }
  if (value.normalizer === 'bring_down_for_rep' && !hasText(value.repLabel) && !hasText(value.repCode)) {
    add(errors, 'observation.value.repLabel', 'bring_down_for_rep requires repLabel or repCode.');
  }
}

function validateObservationScope(scope, errors) {
  if (scope === undefined) return;
  if (!isPlainObject(scope)) {
    add(errors, 'observation.scope', 'observation.scope must be an object when supplied.');
    return;
  }
  const hasProvisionCodes = isStringArray(scope.provisionCodes);
  const hasShortTitle = hasText(scope.shortTitleIncludes);
  const hasDefinedTerm = hasText(scope.definedTermIncludes);
  if (!hasProvisionCodes && !hasShortTitle && !hasDefinedTerm) {
    add(errors, 'observation.scope', 'observation.scope requires provisionCodes, definedTermIncludes or shortTitleIncludes.');
  }
  if (scope.provisionCodes !== undefined && !hasProvisionCodes) {
    add(errors, 'observation.scope.provisionCodes', 'provisionCodes must be a non-empty string array when supplied.');
  }
  if (scope.definedTermIncludes !== undefined && !hasDefinedTerm) {
    add(errors, 'observation.scope.definedTermIncludes', 'definedTermIncludes must be non-empty when supplied.');
  }
  if (scope.shortTitleIncludes !== undefined && !hasShortTitle) {
    add(errors, 'observation.scope.shortTitleIncludes', 'shortTitleIncludes must be non-empty when supplied.');
  }
}

function validatePresentation(presentation, errors) {
  if (presentation === undefined) return;
  if (!isPlainObject(presentation) || !PRESENTATION_ROLES.has(presentation.role)) {
    add(errors, 'presentation.role', `presentation.role must be one of ${[...PRESENTATION_ROLES].join(', ')}.`);
  }
}

function validateSemantics(spec, errors) {
  const semantics = spec.semantics;
  if (semantics !== undefined && !isPlainObject(semantics)) {
    add(errors, 'semantics', 'semantics must be an object when supplied.');
    return;
  }
  const unit = semantics?.unit;
  if (unit !== undefined && !CANONICAL_UNITS.has(unit)) {
    add(errors, 'semantics.unit', `semantics.unit must be one of ${[...CANONICAL_UNITS].join(', ')}.`);
  }
  if (semantics?.calendarBasis !== undefined && !CALENDAR_BASES.has(semantics.calendarBasis)) {
    add(errors, 'semantics.calendarBasis', `semantics.calendarBasis must be one of ${[...CALENDAR_BASES].join(', ')}.`);
  }
  if (semantics?.cadence !== undefined && !CADENCES.has(semantics.cadence)) {
    add(errors, 'semantics.cadence', `semantics.cadence must be one of ${[...CADENCES].join(', ')}.`);
  }
  if (semantics?.requiredDimensions !== undefined) {
    if (!Array.isArray(semantics.requiredDimensions) || semantics.requiredDimensions.length === 0
      || !semantics.requiredDimensions.every((dimension) => SEMANTIC_DIMENSIONS.has(dimension))) {
      add(errors, 'semantics.requiredDimensions', `requiredDimensions must contain only ${[...SEMANTIC_DIMENSIONS].join(', ')}.`);
    }
  }
  if (semantics?.stratifyDimensions !== undefined) {
    if (!Array.isArray(semantics.stratifyDimensions) || semantics.stratifyDimensions.length === 0
      || !semantics.stratifyDimensions.every((dimension) => SEMANTIC_DIMENSIONS.has(dimension))) {
      add(errors, 'semantics.stratifyDimensions', `stratifyDimensions must contain only ${[...SEMANTIC_DIMENSIONS].join(', ')}.`);
    }
  }

  const kind = spec.comparison.kind;
  if (kind === 'money') {
    if (unit !== 'usd') add(errors, 'semantics.unit', 'money metrics require unit "usd".');
    if (!isPlainObject(semantics?.normalisation)) {
      add(errors, 'semantics.normalisation', 'money metrics require a normalisation policy.');
    } else {
      if (semantics.normalisation.type !== 'percent_of_deal_value') {
        add(errors, 'semantics.normalisation.type', 'money metrics must normalise as percent_of_deal_value.');
      }
      if (semantics.normalisation.denominator !== 'deal_value_usd') {
        add(errors, 'semantics.normalisation.denominator', 'money metrics must use deal_value_usd as the denominator.');
      }
      if (semantics.normalisation.basisPolicy !== 'stratify_by_basis') {
        add(errors, 'semantics.normalisation.basisPolicy', 'money metrics must stratify deal-value denominators by basis.');
      }
      if (semantics.normalisation.missingPolicy !== 'exclude') {
        add(errors, 'semantics.normalisation.missingPolicy', 'money metrics must exclude missing or incompatible denominators.');
      }
    }
  }

  if (kind === 'duration') {
    if (!['elapsed_hours', 'business_days', 'calendar_days', 'days_equivalent', 'months', 'years'].includes(unit)) {
      add(errors, 'semantics.unit', 'duration metrics require an unambiguous duration unit.');
    }
    if (!semantics?.calendarBasis) {
      add(errors, 'semantics.calendarBasis', 'duration metrics require calendarBasis.');
    }
    if (!hasText(semantics?.trigger) && !semantics?.requiredDimensions?.includes('trigger')) {
      add(errors, 'semantics.trigger', 'duration metrics require a fixed trigger or an observed trigger dimension so unlike clocks are not pooled.');
    }
    if (unit === 'business_days' && semantics?.calendarBasis !== 'business') {
      add(errors, 'semantics.calendarBasis', 'business_days metrics require the business calendar basis.');
    }
    if (unit === 'calendar_days' && semantics?.calendarBasis !== 'calendar') {
      add(errors, 'semantics.calendarBasis', 'calendar_days metrics require the calendar basis.');
    }
    if (unit === 'days_equivalent' && semantics?.calendarBasis !== 'mixed') {
      add(errors, 'semantics.calendarBasis', 'days_equivalent metrics require the mixed calendar basis.');
    }
  }
}

function validateDenominator(denominator, errors) {
  if (!isPlainObject(denominator)) {
    add(errors, 'denominator', 'Comparable metrics require denominator semantics.');
    return;
  }
  if (denominator.prevalence !== 'eligible_deals') {
    add(errors, 'denominator.prevalence', 'Prevalence must use distinct eligible deals.');
  }
  if (denominator.distribution !== 'present_deals') {
    add(errors, 'denominator.distribution', 'Value distributions must use distinct present deals.');
  }
  if (denominator.conditionalOn !== undefined) {
    const condition = denominator.conditionalOn;
    if (!isPlainObject(condition) || !hasText(condition.metricKey) || condition.state !== 'present') {
      add(errors, 'denominator.conditionalOn', 'conditionalOn must identify a metricKey in the present state.');
    }
  }
}

export function validateMarketMetricSpec(spec) {
  const errors = [];
  if (!isPlainObject(spec)) return { valid: false, errors: [{ path: 'spec', message: 'Market metric spec must be an object.' }] };
  if (spec.contractVersion !== MARKET_METRIC_CONTRACT_VERSION) {
    add(errors, 'contractVersion', `contractVersion must be ${MARKET_METRIC_CONTRACT_VERSION}.`);
  }
  if (!hasText(spec.rowKey)) add(errors, 'rowKey', 'rowKey must be a stable non-empty string.');
  else if (isReservedObjectKey(spec.rowKey)) add(errors, 'rowKey', 'rowKey uses a reserved object key.');
  if (!hasText(spec.metricKey)) add(errors, 'metricKey', 'metricKey must be a stable non-empty string.');
  else if (isReservedObjectKey(spec.metricKey)) add(errors, 'metricKey', 'metricKey uses a reserved object key.');
  if (!hasText(spec.label)) add(errors, 'label', 'label must be a non-empty string.');
  if (!isPlainObject(spec.comparison) || !COMPARISON_STATUSES.has(spec.comparison.status)) {
    add(errors, 'comparison.status', 'comparison.status must be comparable or non_comparable.');
    return { valid: errors.length === 0, errors };
  }

  if (spec.comparison.status === 'non_comparable') {
    const reason = spec.comparison.reason;
    if (!isPlainObject(reason)) add(errors, 'comparison.reason', 'Non-comparable metrics require a reason.');
    else {
      if (!NON_COMPARABLE_CODES.has(reason.code)) add(errors, 'comparison.reason.code', `Unknown non-comparable reason ${String(reason.code)}.`);
      if (!hasText(reason.detail)) add(errors, 'comparison.reason.detail', 'Non-comparable reasons require user-facing detail.');
    }
    return { valid: errors.length === 0, errors };
  }

  if (!METRIC_KINDS.has(spec.comparison.kind)) {
    add(errors, 'comparison.kind', `comparison.kind must be one of ${MARKET_METRIC_KINDS.join(', ')}.`);
    return { valid: errors.length === 0, errors };
  }
  validateCohort(spec.cohort, errors);
  if (!isPlainObject(spec.observation)) add(errors, 'observation', 'Comparable metrics require observation semantics.');
  else {
    validateObservationScope(spec.observation.scope, errors);
    validatePresence(spec.observation.presence, errors);
    if (spec.comparison.kind !== 'presence') validateValue(spec.observation.value, errors);
  }
  validateDenominator(spec.denominator, errors);
  validateSemantics(spec, errors);
  validatePresentation(spec.presentation, errors);
  return { valid: errors.length === 0, errors };
}

export function assertValidMarketMetricSpec(spec) {
  const result = validateMarketMetricSpec(spec);
  if (!result.valid) {
    const key = spec?.metricKey || spec?.rowKey || '<unknown>';
    throw new Error(`Invalid market metric spec ${key}: ${JSON.stringify(result.errors)}`);
  }
  return spec;
}

function validateCoverage(coverage, errors) {
  if (!isPlainObject(coverage)) {
    add(errors, 'coverage', 'coverage must be an object.');
    return;
  }
  const fields = [
    'cohortCount',
    'eligibleCount',
    'presentCount',
    'absentCount',
    'unknownCount',
    'notApplicableCount',
    'classifiedCount',
    'observedCount',
    'valueUnknownCount',
    'comparableCount',
    'excludedCount',
  ];
  for (const field of fields) {
    if (!Number.isInteger(coverage[field]) || coverage[field] < 0) {
      add(errors, `coverage.${field}`, `${field} must be a non-negative integer.`);
    }
  }
  if (errors.some((error) => error.path.startsWith('coverage.'))) return;
  if (coverage.cohortCount !== coverage.eligibleCount + coverage.notApplicableCount) {
    add(errors, 'coverage.cohortCount', 'cohortCount must equal eligibleCount + notApplicableCount.');
  }
  if (coverage.eligibleCount !== coverage.presentCount + coverage.absentCount + coverage.unknownCount) {
    add(errors, 'coverage.eligibleCount', 'eligibleCount must equal presentCount + absentCount + unknownCount.');
  }
  if (coverage.classifiedCount !== coverage.presentCount + coverage.absentCount) {
    add(errors, 'coverage.classifiedCount', 'classifiedCount must equal presentCount + absentCount.');
  }
  if (coverage.presentCount !== coverage.observedCount + coverage.valueUnknownCount) {
    add(errors, 'coverage.presentCount', 'presentCount must equal observedCount + valueUnknownCount.');
  }
  if (coverage.observedCount !== coverage.comparableCount + coverage.excludedCount) {
    add(errors, 'coverage.observedCount', 'observedCount must equal comparableCount + excludedCount.');
  }
}

function validateDealIds(dealIds, path, errors, expectedCount = null) {
  if (!Array.isArray(dealIds) || !dealIds.every(hasText)) {
    add(errors, path, 'deal IDs must be an array of non-empty strings.');
    return;
  }
  if (new Set(dealIds).size !== dealIds.length) add(errors, path, 'deal IDs must not contain duplicates.');
  if (Number.isInteger(expectedCount) && dealIds.length !== expectedCount) {
    add(errors, path, `deal ID count must equal ${expectedCount}.`);
  }
}

function validateDealRefs(dealRefs, dealIds, path, errors, expectedCount = null) {
  if (!Array.isArray(dealRefs)) {
    add(errors, path, 'deal references must be an array.');
    return;
  }
  const referenceIds = [];
  for (const [index, ref] of dealRefs.entries()) {
    const refPath = `${path}.${index}`;
    if (!isPlainObject(ref)) {
      add(errors, refPath, 'deal reference must be an object.');
      continue;
    }
    const unexpected = Object.keys(ref).filter((key) => !['dealId', 'cardId'].includes(key));
    if (unexpected.length) add(errors, refPath, `deal reference contains unsupported fields: ${unexpected.join(', ')}.`);
    if (!hasText(ref.dealId)) add(errors, `${refPath}.dealId`, 'dealId must be a non-empty string.');
    else referenceIds.push(ref.dealId);
    if (ref.cardId !== undefined && !hasText(ref.cardId)) {
      add(errors, `${refPath}.cardId`, 'cardId must be a non-empty string when provided.');
    }
  }
  if (new Set(referenceIds).size !== referenceIds.length) {
    add(errors, path, 'deal references must not contain duplicate deal IDs.');
  }
  if (Number.isInteger(expectedCount) && dealRefs.length !== expectedCount) {
    add(errors, path, `deal reference count must equal ${expectedCount}.`);
  }
  if (!Array.isArray(dealIds)) {
    add(errors, path, 'deal references require an associated deal ID array.');
  } else if (dealIds.length !== referenceIds.length || dealIds.some((dealId, index) => dealId !== referenceIds[index])) {
    add(errors, path, 'deal references must match the associated deal IDs in order.');
  }
}

function validateSupportingDeals(result, errors) {
  const coverage = result.coverage || {};
  if (result.dealIdsByStatus !== undefined) {
    if (!isPlainObject(result.dealIdsByStatus)) {
      add(errors, 'dealIdsByStatus', 'dealIdsByStatus must be an object.');
    } else {
      const statuses = [
        ['present', coverage.presentCount],
        ['absent', coverage.absentCount],
        ['unknown', coverage.unknownCount],
        ['not_applicable', coverage.notApplicableCount],
      ];
      const all = [];
      for (const [status, count] of statuses) {
        const ids = result.dealIdsByStatus[status];
        validateDealIds(ids, `dealIdsByStatus.${status}`, errors, count);
        if (Array.isArray(ids)) all.push(...ids);
      }
      if (new Set(all).size !== all.length) add(errors, 'dealIdsByStatus', 'a deal cannot appear in more than one status bucket.');
    }
  }
  if (result.dealRefsByStatus !== undefined) {
    if (!isPlainObject(result.dealRefsByStatus)) {
      add(errors, 'dealRefsByStatus', 'dealRefsByStatus must be an object.');
    } else {
      const statuses = ['present', 'absent', 'unknown', 'not_applicable'];
      for (const status of statuses) {
        const dealIds = result.dealIdsByStatus?.[status];
        validateDealRefs(
          result.dealRefsByStatus[status],
          dealIds,
          `dealRefsByStatus.${status}`,
          errors,
          Array.isArray(dealIds) ? dealIds.length : null,
        );
      }
    }
  }
  const distribution = result.distribution;
  if (!isPlainObject(distribution)) return;
  if (['categorical', 'multi_select'].includes(distribution.kind)) {
    for (const [index, item] of (distribution.values || []).entries()) {
      if (item?.dealIds !== undefined) validateDealIds(item.dealIds, `distribution.values.${index}.dealIds`, errors, item.count);
      if (item?.dealRefs !== undefined) validateDealRefs(item.dealRefs, item.dealIds, `distribution.values.${index}.dealRefs`, errors, item.count);
    }
  }
  if (['numeric', 'duration'].includes(distribution.kind)) {
    for (const [index, cohort] of (distribution.cohorts || []).entries()) {
      if (cohort?.dealIds !== undefined) validateDealIds(cohort.dealIds, `distribution.cohorts.${index}.dealIds`, errors, cohort?.stats?.n);
      if (cohort?.dealRefs !== undefined) validateDealRefs(cohort.dealRefs, cohort.dealIds, `distribution.cohorts.${index}.dealRefs`, errors, cohort?.stats?.n);
    }
  }
  if (distribution.kind === 'money') {
    for (const [index, cohort] of (distribution.normalised?.cohorts || []).entries()) {
      if (cohort?.dealIds !== undefined) validateDealIds(cohort.dealIds, `distribution.normalised.cohorts.${index}.dealIds`, errors, cohort?.percent?.stats?.n);
      if (cohort?.dealRefs !== undefined) validateDealRefs(cohort.dealRefs, cohort.dealIds, `distribution.normalised.cohorts.${index}.dealRefs`, errors, cohort?.percent?.stats?.n);
    }
  }
}

export function validateMarketMetricResult(result) {
  const errors = [];
  if (!isPlainObject(result)) return { valid: false, errors: [{ path: 'result', message: 'Market metric result must be an object.' }] };
  if (result.contractVersion !== MARKET_METRIC_CONTRACT_VERSION) add(errors, 'contractVersion', `contractVersion must be ${MARKET_METRIC_CONTRACT_VERSION}.`);
  if (!hasText(result.rowKey)) add(errors, 'rowKey', 'rowKey must be a non-empty string.');
  else if (isReservedObjectKey(result.rowKey)) add(errors, 'rowKey', 'rowKey uses a reserved object key.');
  if (!hasText(result.metricKey)) add(errors, 'metricKey', 'metricKey must be a non-empty string.');
  else if (isReservedObjectKey(result.metricKey)) add(errors, 'metricKey', 'metricKey uses a reserved object key.');
  if (!RESULT_STATES.has(result.state)) add(errors, 'state', `state must be one of ${MARKET_RESULT_STATES.join(', ')}.`);

  if (result.state !== 'error') validateCoverage(result.coverage, errors);
  if (result.state === 'error') {
    if (!isPlainObject(result.error) || !hasText(result.error.message)) add(errors, 'error', 'Error results require an error.message.');
  }
  if (result.state === 'not_comparable') {
    if (!isPlainObject(result.reason) || !hasText(result.reason.code) || !hasText(result.reason.detail)) {
      add(errors, 'reason', 'not_comparable results require a reason code and detail.');
    }
  }
  if (result.distribution !== undefined) {
    if (!isPlainObject(result.distribution) || !METRIC_KINDS.has(result.distribution.kind)) {
      add(errors, 'distribution.kind', 'distribution.kind must use a market metric kind.');
    }
  }
  if (result.state !== 'error' && result.state !== 'not_comparable') validateSupportingDeals(result, errors);
  return { valid: errors.length === 0, errors };
}

export function assertValidMarketMetricResult(result) {
  const validation = validateMarketMetricResult(result);
  if (!validation.valid) {
    throw new Error(`Invalid market metric result ${result?.metricKey || '<unknown>'}: ${JSON.stringify(validation.errors)}`);
  }
  return result;
}

export function comparableMetric({ rowKey, metricKey, label, kind, cohort, observation, denominator, semantics, presentation }) {
  return assertValidMarketMetricSpec({
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey,
    metricKey,
    label,
    comparison: { status: 'comparable', kind },
    cohort,
    observation,
    denominator,
    ...(semantics ? { semantics } : {}),
    ...(presentation ? { presentation } : {}),
  });
}

export function nonComparableMetric({ rowKey, metricKey, label, code, detail }) {
  return assertValidMarketMetricSpec({
    contractVersion: MARKET_METRIC_CONTRACT_VERSION,
    rowKey,
    metricKey,
    label,
    comparison: { status: 'non_comparable', reason: { code, detail } },
  });
}
