const { canonicalJson, contentId } = require('./canonical-bytes');

const EFFECT_KEYS = Object.freeze([
  'effect_mode',
  'legal_operation',
  'trigger_path_schema_key',
  'trigger_path_schema_version',
  'pathway_code',
  'trigger_code',
  'terminating_party',
  'payment_timing',
  'indexed_facts',
  'condition_expression',
]);

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the frozen trigger-path contract`);
  }
}

function triggerPathSchemaForBinding(contractBundle, binding) {
  const schema = contractBundle?.serving_trigger_path_schema_definitions?.find(
    (entry) => entry.trigger_path_schema_key === binding?.trigger_path_schema_key
      && entry.trigger_path_schema_version === binding?.trigger_path_schema_version,
  );
  if (!schema) throw new TypeError('the metric-operation binding has no frozen trigger-path schema');
  return schema;
}

function validateExpression(expression, schema, depth = 1, state = { nodes: 0, facts: [] }) {
  if (depth > schema.maximum_expression_depth) {
    throw new TypeError('termination-fee trigger expression exceeds its frozen depth bound');
  }
  state.nodes += 1;
  if (state.nodes > schema.maximum_expression_nodes) {
    throw new TypeError('termination-fee trigger expression exceeds its frozen node bound');
  }
  if (!expression || typeof expression !== 'object' || Array.isArray(expression)
    || !schema.expression_operators.includes(expression.operator)) {
    throw new TypeError('termination-fee trigger expression contains an unknown operator');
  }
  if (expression.operator === 'FACT') {
    requireExactKeys(expression, ['operator', 'fact_key'], 'termination-fee trigger fact');
    if (!schema.allowed_fact_keys.includes(expression.fact_key)) {
      throw new TypeError('termination-fee trigger expression contains an ungoverned fact');
    }
    state.facts.push(expression.fact_key);
    return state;
  }
  if (expression.operator === 'IF_THEN') {
    requireExactKeys(expression, ['operator', 'if', 'then'], 'termination-fee trigger implication');
    validateExpression(expression.if, schema, depth + 1, state);
    return validateExpression(expression.then, schema, depth + 1, state);
  }
  requireExactKeys(expression, ['operator', 'operands'], 'termination-fee trigger expression');
  if (!Array.isArray(expression.operands)
    || expression.operands.length < 1
    || expression.operands.length > schema.maximum_expression_nodes) {
    throw new TypeError('termination-fee trigger expression has an invalid operand set');
  }
  for (const operand of expression.operands) {
    validateExpression(operand, schema, depth + 1, state);
  }
  return state;
}

function rootDirectlyRequiresTrigger(expression, triggerCode, rootOperator) {
  return expression.operator === rootOperator
    && expression.operands.some(
      (operand) => operand.operator === 'FACT' && operand.fact_key === triggerCode,
    );
}

function validateTerminationFeeTriggerEffect(effect, { binding, schema }) {
  requireExactKeys(effect, EFFECT_KEYS, 'termination-fee trigger effect');
  if (effect.effect_mode !== 'TYPED_LEGAL_EFFECT'
    || effect.legal_operation !== binding.legal_operation
    || effect.trigger_path_schema_key !== schema.trigger_path_schema_key
    || effect.trigger_path_schema_version !== schema.trigger_path_schema_version
    || !schema.allowed_pathway_codes.includes(effect.pathway_code)
    || !schema.allowed_trigger_codes.includes(effect.trigger_code)
    || !schema.allowed_terminating_parties.includes(effect.terminating_party)
    || !schema.allowed_payment_timings.includes(effect.payment_timing)
    || schema.indexed_fact_semantics !== 'SET_MEMBERSHIP_SEARCH_AID_ONLY'
    || !Array.isArray(effect.indexed_facts)
    || new Set(effect.indexed_facts).size !== effect.indexed_facts.length
    || canonicalJson(effect.indexed_facts) !== canonicalJson([...effect.indexed_facts].sort())) {
    throw new TypeError('termination-fee trigger effect is outside its metric-operation binding');
  }
  const state = validateExpression(effect.condition_expression, schema);
  if (!rootDirectlyRequiresTrigger(
    effect.condition_expression,
    effect.trigger_code,
    schema.root_operator,
  )) {
    throw new TypeError('termination-fee trigger expression does not establish its declared trigger');
  }
  const constraint = schema.pathway_constraints?.find(
    (entry) => entry.pathway_code === effect.pathway_code,
  );
  const expectedTerminatingParty = constraint?.terminating_party_rule === 'FEE_PAYEE_VALUE'
    ? binding.payee.value
    : constraint?.terminating_party_rule;
  if (!constraint
    || constraint.trigger_code !== effect.trigger_code
    || constraint.payment_timing !== effect.payment_timing
    || expectedTerminatingParty !== effect.terminating_party
    || constraint.expression_digest_by_fee_side?.[binding.fee_side]
      !== contentId(
        'TERMINATION_FEE_TRIGGER_CONDITION_EXPRESSION/V2',
        effect.condition_expression,
      )) {
    throw new TypeError('termination-fee trigger pathway does not match its frozen template');
  }
  const expectedIndexedFacts = [...new Set(state.facts.filter(
    (fact) => !schema.allowed_trigger_codes.includes(fact),
  ))].sort();
  if (canonicalJson(effect.indexed_facts) !== canonicalJson(expectedIndexedFacts)) {
    throw new TypeError('termination-fee indexed facts do not match their governed expression');
  }
  return true;
}

module.exports = {
  EFFECT_KEYS,
  triggerPathSchemaForBinding,
  validateTerminationFeeTriggerEffect,
};
