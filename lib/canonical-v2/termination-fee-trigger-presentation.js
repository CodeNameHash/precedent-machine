const TRIGGER_LABELS = Object.freeze({
  SUPERIOR_PROPOSAL_TERMINATION: 'Company terminates to accept a superior proposal',
  ACQUISITION_PROPOSAL_TAIL:
    'A specified termination is followed by a qualifying acquisition transaction',
  CHANGE_IN_RECOMMENDATION_TERMINATION: 'Change in recommendation',
  NO_SOLICIT_BREACH_TERMINATION: 'No-solicitation breach',
  STOCKHOLDER_APPROVAL_FAILURE_TERMINATION: 'Stockholder approval failure',
  OUTSIDE_DATE_TERMINATION: 'Outside date',
  INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION:
    'Intervening-event recommendation change',
});

const FACT_LABELS = Object.freeze({
  COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_STOCKHOLDER_MEETING_AND_NOT_WITHDRAWN:
    'A competing proposal was publicly announced on or after signing and before the stockholder meeting, and was not publicly withdrawn',
  COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_TERMINATION_AND_NOT_WITHDRAWN:
    'A competing proposal was publicly announced on or after signing and before termination, and was not publicly withdrawn',
  COMPETING_PROPOSAL_PUBLICLY_PENDING:
    'A competing proposal was publicly announced and remained pending',
  DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS:
    'Signing or consummation occurs within 12 months',
  FIFTY_PERCENT_ACQUISITION_THRESHOLD: 'The acquisition reaches the 50% threshold',
  PUBLIC_COMPANY_ALTERNATIVE_TRANSACTION_NOT_WITHDRAWN:
    'A public alternative transaction was announced and not withdrawn',
  FEE_PAYEE_COULD_TERMINATE_FOR_CHANGE_IN_RECOMMENDATION:
    'The fee payee could terminate for a recommendation change',
  FEE_PAYEE_COULD_TERMINATE_FOR_DIRECT_NO_SOLICIT_BREACH:
    'The fee payee could exercise the direct no-solicitation-breach termination right',
  FEE_PAYEE_COULD_TERMINATE_FOR_GENERAL_BREACH_IN_RESPECT_OF_NO_SOLICIT:
    'The fee payee could exercise the general covenant-breach termination right for the no-solicitation breach',
  FEE_PAYEE_COULD_TERMINATE_ON_OUTSIDE_DATE:
    'The fee payee could terminate on the outside date',
  FEE_PAYEE_COULD_TERMINATE_FOR_OTHER_COVENANT_BREACH:
    'The fee payee could terminate for another covenant breach',
  IMMEDIATE_FEE_GATEWAY_DOES_NOT_APPLY: 'The immediate fee gateway does not apply',
  TERMINATING_PARTY_IS_FEE_PAYER: 'The terminating party is the fee payer',
});

const PATHWAY_LABELS = Object.freeze({
  IMMEDIATE_RECOMMENDATION_CHANGE: 'Immediate recommendation-change pathway',
  IMMEDIATE_NO_SOLICIT_BREACH: 'Immediate dedicated no-solicitation-breach pathway',
  IMMEDIATE_NO_VOTE_WITH_LATENT_RIGHT: 'Immediate no-vote pathway with a latent termination right',
  IMMEDIATE_OUTSIDE_DATE_WITH_LATENT_RIGHT:
    'Immediate outside-date pathway with a latent termination right',
  TAIL_NO_VOTE: 'No-vote tail pathway',
  TAIL_NO_SOLICIT_BREACH:
    'No-solicitation-breach tail pathway through the general covenant-breach right',
  TAIL_OTHER_COVENANT_BREACH: 'Other-covenant-breach tail pathway',
  TAIL_INTERVENING_EVENT_RECOMMENDATION_CHANGE:
    'Intervening-event recommendation-change tail pathway',
  TAIL_OUTSIDE_DATE: 'Outside-date tail pathway',
});

const PAYMENT_TIMING_LABELS = Object.freeze({
  CONCURRENT_WITH_TERMINATION: 'Concurrently with termination',
  TWO_BUSINESS_DAYS_AFTER_TERMINATION: 'Within 2 business days after termination',
  TWO_BUSINESS_DAYS_AFTER_EARLIER_SIGNING_OR_CONSUMMATION:
    'Within 2 business days after the earlier of signing or consummation',
  UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION:
    'Upon the earlier of signing a definitive agreement or consummation',
});

const TERMINATING_PARTY_LABELS = Object.freeze({
  COMPANY: 'Company',
  PARENT: 'Parent',
  EITHER_PARTY: 'Either party',
  EITHER_OR_COMPANY_AS_SPECIFIED: 'Either party or Company, as specified',
  EITHER_OR_PARENT_AS_SPECIFIED: 'Either party or Parent, as specified',
});

function effectPartyName(effect) {
  return effect?.legal_operation === 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER'
    ? 'Parent'
    : 'Company';
}

function triggerLabel(effect) {
  if (effect?.trigger_code === 'CHANGE_IN_RECOMMENDATION_TERMINATION') {
    return effect?.legal_operation === 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER'
      ? 'Company terminates following a Parent change in recommendation'
      : 'Parent terminates following a Company change in recommendation';
  }
  if (effect?.trigger_code === 'COUNTERPARTY_COVENANT_BREACH_TERMINATION') {
    return `${effectPartyName(effect)} covenant breach`;
  }
  return TRIGGER_LABELS[effect?.trigger_code] || null;
}

function factLabel(factKey, effect) {
  if (factKey === 'COUNTERPARTY_COVENANT_BREACH_TERMINATION') {
    return `${effectPartyName(effect)} covenant breach termination`;
  }
  if (factKey === 'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED') {
    return `${effectPartyName(effect)} stockholder approval has not been obtained`;
  }
  return TRIGGER_LABELS[factKey] || FACT_LABELS[factKey] || null;
}

function conditionExpressionView(expression, effect, depth = 1) {
  if (depth > 6 || !expression || typeof expression !== 'object' || Array.isArray(expression)) {
    throw new TypeError('unsupported termination-fee condition expression');
  }
  if (expression.operator === 'FACT') {
    const label = factLabel(expression.fact_key, effect);
    if (!label || Object.keys(expression).sort().join(',') !== 'fact_key,operator') {
      throw new TypeError('unsupported termination-fee condition fact');
    }
    return Object.freeze({ operator: 'FACT', label });
  }
  if (expression.operator === 'IF_THEN') {
    if (Object.keys(expression).sort().join(',') !== 'if,operator,then') {
      throw new TypeError('unsupported termination-fee conditional expression');
    }
    return Object.freeze({
      operator: 'IF_THEN',
      if: conditionExpressionView(expression.if, effect, depth + 1),
      then: conditionExpressionView(expression.then, effect, depth + 1),
    });
  }
  if (!['ALL_OF', 'ANY_OF'].includes(expression.operator)
    || Object.keys(expression).sort().join(',') !== 'operands,operator'
    || !Array.isArray(expression.operands)
    || expression.operands.length < 1
    || expression.operands.length > 32) {
    throw new TypeError('unsupported termination-fee condition expression');
  }
  return Object.freeze({
    operator: expression.operator,
    operands: Object.freeze(
      expression.operands.map((operand) => conditionExpressionView(operand, effect, depth + 1)),
    ),
  });
}

function formatConditionExpressionView(view) {
  if (view.operator === 'FACT') return view.label;
  if (view.operator === 'IF_THEN') {
    return `if ${formatConditionExpressionView(view.if)}, then ${formatConditionExpressionView(view.then)}`;
  }
  const conjunction = view.operator === 'ALL_OF' ? ' and ' : ' or ';
  const rendered = view.operands.map(formatConditionExpressionView);
  return rendered.length === 1 ? rendered[0] : `(${rendered.join(conjunction)})`;
}

function formatConditionExpression(expression, effect) {
  return formatConditionExpressionView(conditionExpressionView(expression, effect));
}

function pathwayLabel(effect) {
  const label = PATHWAY_LABELS[effect?.pathway_code];
  if (!label) throw new TypeError('unsupported termination-fee pathway');
  return label;
}

function paymentTimingLabel(effect) {
  const label = PAYMENT_TIMING_LABELS[effect?.payment_timing];
  if (!label) throw new TypeError('unsupported termination-fee payment timing');
  return label;
}

function terminatingPartyLabel(effect) {
  const label = TERMINATING_PARTY_LABELS[effect?.terminating_party];
  if (!label) throw new TypeError('unsupported termination-fee terminating party');
  return label;
}

function terminationFeePathwayView(effect) {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
    throw new TypeError('termination-fee pathway effect is required');
  }
  const trigger = triggerLabel(effect);
  if (!trigger) throw new TypeError('unsupported termination-fee trigger');
  const governedV2 = effect.trigger_path_schema_version === 2
    && typeof effect.pathway_code === 'string'
    && effect.condition_expression;
  const legacyConditions = Array.isArray(effect.conditions)
    ? effect.conditions.map((factKey) => factLabel(factKey, effect))
    : [];
  if (legacyConditions.some((label) => !label)) {
    throw new TypeError('unsupported legacy termination-fee condition');
  }
  return Object.freeze({
    pathway: governedV2 ? pathwayLabel(effect) : 'Legacy termination-fee pathway',
    trigger,
    terminating_party: terminatingPartyLabel(effect),
    conditions: governedV2
      ? formatConditionExpression(effect.condition_expression, effect)
      : legacyConditions.length ? legacyConditions.join('; ') : trigger,
    payment_timing: paymentTimingLabel(effect),
  });
}

function formatTerminationFeePathway(effect) {
  const view = terminationFeePathwayView(effect);
  return `${view.pathway}. Trigger: ${view.trigger}. Terminating party: ${view.terminating_party}. Conditions: ${view.conditions}. Payment timing: ${view.payment_timing}.`;
}

module.exports = {
  conditionExpressionView,
  effectPartyName,
  factLabel,
  formatConditionExpression,
  formatConditionExpressionView,
  formatTerminationFeePathway,
  pathwayLabel,
  paymentTimingLabel,
  terminatingPartyLabel,
  terminationFeePathwayView,
  triggerLabel,
};
