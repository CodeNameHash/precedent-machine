'use strict';

// PLAN.md Step 3J. Regression + new-behaviour tests for
// lib/canonical-v2/termination-fee-trigger-path.js's schema-version-aware
// validateTerminationFeeTriggerEffect: schema_version 2 effects (the real,
// already-served QXO shape) must validate EXACTLY as before, byte for byte,
// and schema_version 3 effects (TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3, the
// split payment_trigger_event/payment_delay pair) must validate under the
// new pair -- neither weakens the other.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  compileFixtureContractV4,
  compileFixtureContractV39,
} = require('../lib/canonical-v2/contract-bundle');
const {
  BUYER_GROUNDS,
} = require('../lib/canonical-v2/qxo-buyer-termination-fee-admitted-slice');
const {
  EFFECT_KEYS,
  EFFECT_KEYS_V3,
  triggerPathSchemaForBinding,
  validateTerminationFeeTriggerEffect,
} = require('../lib/canonical-v2/termination-fee-trigger-path');

function bindingsByOperation() {
  const bundle = compileFixtureContractV4();
  return new Map(bundle.serving_metric_operation_bindings.map((binding) => [binding.legal_operation, binding]));
}

function realV2Ground(pathwayCode) {
  const ground = BUYER_GROUNDS.find((entry) => entry.effect.pathway_code === pathwayCode);
  if (!ground) throw new Error(`fixture ground for ${pathwayCode} not found`);
  return ground;
}

// ---------------------------------------------------------------------------
// Backward compatibility: EFFECT_KEYS (V2 shape) is untouched, byte for byte.
// ---------------------------------------------------------------------------

test('EFFECT_KEYS (schema_version 2) is exactly its pre-3J shape -- shared-serving-row.js and canonical-contract-technical-relationship-validator.js depend on this exact array', () => {
  assert.deepEqual([...EFFECT_KEYS].sort(), [
    'condition_expression',
    'effect_mode',
    'indexed_facts',
    'legal_operation',
    'pathway_code',
    'payment_timing',
    'terminating_party',
    'trigger_code',
    'trigger_path_schema_key',
    'trigger_path_schema_version',
  ]);
  assert.equal(EFFECT_KEYS.includes('payment_trigger_event'), false);
  assert.equal(EFFECT_KEYS.includes('payment_delay'), false);
});

test('EFFECT_KEYS_V3 replaces payment_timing with the split pair and nothing else changes', () => {
  const v2WithoutPaymentTiming = EFFECT_KEYS.filter((key) => key !== 'payment_timing');
  const v3WithoutSplit = EFFECT_KEYS_V3.filter((key) => key !== 'payment_trigger_event' && key !== 'payment_delay');
  assert.deepEqual([...v2WithoutPaymentTiming].sort(), [...v3WithoutSplit].sort());
  assert.equal(EFFECT_KEYS_V3.includes('payment_trigger_event'), true);
  assert.equal(EFFECT_KEYS_V3.includes('payment_delay'), true);
  assert.equal(EFFECT_KEYS_V3.includes('payment_timing'), false);
});

test('a real, already-served V2 buyer ground still validates exactly as before', () => {
  const bindings = bindingsByOperation();
  const bundle = compileFixtureContractV4();
  const binding = bindings.get('CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER');
  const schema = triggerPathSchemaForBinding(bundle, binding);
  assert.equal(schema.trigger_path_schema_version, 2);
  const { effect } = realV2Ground('IMMEDIATE_RECOMMENDATION_CHANGE');
  assert.equal(validateTerminationFeeTriggerEffect(effect, { binding, schema }), true);
});

test('a V2 effect wrongly carrying the split fields instead of payment_timing is rejected (key contract still exact)', () => {
  const bindings = bindingsByOperation();
  const bundle = compileFixtureContractV4();
  const binding = bindings.get('CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER');
  const schema = triggerPathSchemaForBinding(bundle, binding);
  const { effect } = realV2Ground('IMMEDIATE_RECOMMENDATION_CHANGE');
  const { payment_timing: _paymentTiming, ...withoutPaymentTiming } = effect;
  const malformed = { ...withoutPaymentTiming, payment_trigger_event: 'TERMINATION', payment_delay: 'TWO_BUSINESS_DAYS' };
  assert.throws(() => validateTerminationFeeTriggerEffect(malformed, { binding, schema }), /fields do not match/);
});

// ---------------------------------------------------------------------------
// New behaviour: schema_version 3, the split pair.
// ---------------------------------------------------------------------------

function v3BindingFor(v2Binding) {
  // No real metric-operation binding points at trigger_path_schema_version
  // 3 yet (Step 3J is the vocabulary split, not the production-wiring
  // decision -- see contract-bundle.js's comment by
  // FIXTURE_CONTRACT_FINGERPRINT_V39). This is the same binding shape a
  // real one would have, pointed at the new schema version, to exercise the
  // validator itself.
  return { ...v2Binding, trigger_path_schema_version: 3 };
}

// TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3 (contract-bundle.js) is the raw
// FIXTURE_CONTRACT_INPUT shape (`schema_key` / `schema_version`);
// triggerPathSchemaForBinding needs the COMPILED shape
// (`trigger_path_schema_key` / `trigger_path_schema_version`), the same
// object real production code would look up. V39 is the only fixture
// version that compiles it.
function compiledV3Schema(binding) {
  return triggerPathSchemaForBinding(compileFixtureContractV39(), binding);
}

test('a V3 effect built by migrating a real V2 ground validates against TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V3', () => {
  const bindings = bindingsByOperation();
  const v2Binding = bindings.get('CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER');
  const binding = v3BindingFor(v2Binding);
  const { effect: v2Effect } = realV2Ground('IMMEDIATE_RECOMMENDATION_CHANGE');
  const {
    payment_timing: _paymentTiming,
    trigger_path_schema_version: _v2SchemaVersion,
    ...rest
  } = v2Effect;
  // IMMEDIATE_RECOMMENDATION_CHANGE's V2 payment_timing is
  // TWO_BUSINESS_DAYS_AFTER_TERMINATION -> TERMINATION + TWO_BUSINESS_DAYS
  // (contract-bundle.js's PAYMENT_TIMING_SPLIT_MIGRATION_V1).
  const v3Effect = {
    ...rest,
    trigger_path_schema_version: 3,
    payment_trigger_event: 'TERMINATION',
    payment_delay: 'TWO_BUSINESS_DAYS',
  };
  assert.equal(
    validateTerminationFeeTriggerEffect(v3Effect, { binding, schema: compiledV3Schema(binding) }),
    true,
  );
});

test('a V3 effect naming CONCURRENT_WITH_TERMINATION but using an ungoverned pathway is rejected (governed vocabulary, not free text)', () => {
  const bindings = bindingsByOperation();
  const v2Binding = bindings.get('CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER');
  const binding = v3BindingFor(v2Binding);
  const { effect: v2Effect } = realV2Ground('IMMEDIATE_RECOMMENDATION_CHANGE');
  const {
    payment_timing: _paymentTiming,
    trigger_path_schema_version: _v2SchemaVersion,
    ...rest
  } = v2Effect;
  const v3Effect = {
    ...rest,
    trigger_path_schema_version: 3,
    payment_trigger_event: 'CONCURRENT_WITH_TERMINATION',
    payment_delay: 'NONE',
  };
  // IMMEDIATE_RECOMMENDATION_CHANGE's real, governed pair is
  // TERMINATION/TWO_BUSINESS_DAYS -- asserting CONCURRENT_WITH_TERMINATION
  // for it does not match the frozen pathway template.
  assert.throws(
    () => validateTerminationFeeTriggerEffect(v3Effect, { binding, schema: compiledV3Schema(binding) }),
    /does not match its frozen template/,
  );
});

test('a V3 effect using a code outside allowed_payment_trigger_events / allowed_payment_delays is rejected', () => {
  const bindings = bindingsByOperation();
  const v2Binding = bindings.get('CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER');
  const binding = v3BindingFor(v2Binding);
  const { effect: v2Effect } = realV2Ground('IMMEDIATE_RECOMMENDATION_CHANGE');
  const {
    payment_timing: _paymentTiming,
    trigger_path_schema_version: _v2SchemaVersion,
    ...rest
  } = v2Effect;
  const invented = {
    ...rest,
    trigger_path_schema_version: 3,
    payment_trigger_event: 'UPON_SIGNING',
    payment_delay: 'TWO_BUSINESS_DAYS',
  };
  assert.throws(
    () => validateTerminationFeeTriggerEffect(invented, { binding, schema: compiledV3Schema(binding) }),
    /outside its metric-operation binding/,
  );
});

test('a V3 effect still carrying the legacy payment_timing key (instead of the split pair) is rejected by the exact-key contract', () => {
  const bindings = bindingsByOperation();
  const v2Binding = bindings.get('CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER');
  const binding = v3BindingFor(v2Binding);
  const { effect: v2Effect } = realV2Ground('IMMEDIATE_RECOMMENDATION_CHANGE');
  const legacyShaped = { ...v2Effect, trigger_path_schema_version: 3 };
  assert.throws(
    () => validateTerminationFeeTriggerEffect(legacyShaped, { binding, schema: compiledV3Schema(binding) }),
    /fields do not match/,
  );
});
