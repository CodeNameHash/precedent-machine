const { canonicalJson, contentId } = require('./canonical-bytes');

// EFFECT_KEYS is the exact-key contract for a schema_version-2 termination-
// fee trigger effect (TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V2, contract-
// bundle.js). It is imported verbatim, unmodified, by shared-serving-row.js,
// canonical-contract-technical-relationship-validator.js and
// qxo-buyer-termination-fee-trigger-detail.js (none owned by Step 3J), so
// its shape stays exactly as it always has: `payment_timing`, a single
// field. Step 3J (DECISIONS.md decision 5, "RULED 2026-08-07: split the
// field. Option B") does not edit it -- EFFECT_KEYS_V3 below is the sibling
// contract for schema_version 3 (TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3),
// which carries `payment_trigger_event` and `payment_delay` instead.
// validateTerminationFeeTriggerEffect (below) picks the matching key set by
// the SCHEMA's own declared schema_version, so a schema-version-2 effect is
// validated exactly as it always was, byte for byte, and a schema-version-3
// effect is validated against the split pair -- neither weakens the other.
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
const EFFECT_KEYS_V3 = Object.freeze([
  'effect_mode',
  'legal_operation',
  'trigger_path_schema_key',
  'trigger_path_schema_version',
  'pathway_code',
  'trigger_code',
  'terminating_party',
  'payment_trigger_event',
  'payment_delay',
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

// Step 3J: schema_version 3 (TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3) is the
// only schema that carries the split payment fields; every other known and
// future schema_version stays on the single `payment_timing` field until a
// later, equally explicit migration says otherwise.
function usesSplitPaymentTiming(schema) {
  // The COMPILED trigger-path schema's own `schema_version` field is the
  // fixed serving-envelope version ('SERVING_TRIGGER_PATH_SCHEMA_DEFINITION/
  // V1', contract-bundle.js's compileTriggerPathSchema) -- the trigger-path
  // schema's OWN version (2 or 3) is `trigger_path_schema_version`.
  return schema.trigger_path_schema_version === 3;
}

function paymentTimingGoverned(effect, schema) {
  if (usesSplitPaymentTiming(schema)) {
    return Array.isArray(schema.allowed_payment_trigger_events)
      && Array.isArray(schema.allowed_payment_delays)
      && schema.allowed_payment_trigger_events.includes(effect.payment_trigger_event)
      && schema.allowed_payment_delays.includes(effect.payment_delay);
  }
  return Array.isArray(schema.allowed_payment_timings)
    && schema.allowed_payment_timings.includes(effect.payment_timing);
}

function paymentTimingMatchesConstraint(effect, constraint, schema) {
  if (usesSplitPaymentTiming(schema)) {
    return constraint?.payment_trigger_event === effect.payment_trigger_event
      && constraint?.payment_delay === effect.payment_delay;
  }
  return constraint?.payment_timing === effect.payment_timing;
}

function validateTerminationFeeTriggerEffect(effect, { binding, schema }) {
  const splitPaymentTiming = usesSplitPaymentTiming(schema);
  requireExactKeys(effect, splitPaymentTiming ? EFFECT_KEYS_V3 : EFFECT_KEYS, 'termination-fee trigger effect');
  if (effect.effect_mode !== 'TYPED_LEGAL_EFFECT'
    || effect.legal_operation !== binding.legal_operation
    || effect.trigger_path_schema_key !== schema.trigger_path_schema_key
    || effect.trigger_path_schema_version !== schema.trigger_path_schema_version
    || !schema.allowed_pathway_codes.includes(effect.pathway_code)
    || !schema.allowed_trigger_codes.includes(effect.trigger_code)
    || !schema.allowed_terminating_parties.includes(effect.terminating_party)
    || !paymentTimingGoverned(effect, schema)
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
    || !paymentTimingMatchesConstraint(effect, constraint, schema)
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
  EFFECT_KEYS_V3,
  triggerPathSchemaForBinding,
  validateTerminationFeeTriggerEffect,
};
