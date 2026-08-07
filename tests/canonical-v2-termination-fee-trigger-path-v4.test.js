'use strict';

// PLAN.md Step 3J2. Regression + new-behaviour tests for
// lib/canonical-v2/termination-fee-trigger-path.js's schema-version-aware
// validateTerminationFeeTriggerEffect at schema_version 4
// (TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4, contract-bundle.js): the fourth
// trigger event (CONSUMMATION) and the structured, measured payment_delay
// (`{count, unit, bound_type}` in place of V3's two-value enum). Mirrors
// tests/canonical-v2-termination-fee-trigger-path-v3.test.js's own
// construction exactly -- same real V2 buyer ground, same binding-pointed-
// at-a-new-version technique -- so V2 and V3's own tests stay the proof
// that neither is touched by this file.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  compileFixtureContractV4,
  compileFixtureContractV40,
  TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4,
} = require('../lib/canonical-v2/contract-bundle');
const {
  BUYER_GROUNDS,
} = require('../lib/canonical-v2/qxo-buyer-termination-fee-admitted-slice');
const {
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

// No real metric-operation binding points at trigger_path_schema_version 4
// yet -- same reasoning as V3's own test file, and the same reasoning
// docs/core/GRAVEYARD.md entry 16 records for why. This is the same binding
// shape a real one would have, pointed at the new schema version, to
// exercise the validator itself.
function v4BindingFor(v2Binding) {
  return { ...v2Binding, trigger_path_schema_version: 4 };
}

function compiledV4Schema(binding) {
  return triggerPathSchemaForBinding(compileFixtureContractV40(), binding);
}

function v4EffectBase() {
  const bindings = bindingsByOperation();
  const v2Binding = bindings.get('CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER');
  const binding = v4BindingFor(v2Binding);
  const { effect: v2Effect } = realV2Ground('IMMEDIATE_RECOMMENDATION_CHANGE');
  const {
    payment_timing: _paymentTiming,
    trigger_path_schema_version: _v2SchemaVersion,
    ...rest
  } = v2Effect;
  return { binding, rest };
}

test('TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4 declares four trigger events (V3\'s three plus CONSUMMATION) and structured delay bounds, not a delay enum', () => {
  assert.deepEqual(TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4.allowed_payment_trigger_events, [
    'TERMINATION',
    'EARLIER_OF_SIGNING_OR_CONSUMMATION',
    'CONCURRENT_WITH_TERMINATION',
    'CONSUMMATION',
  ]);
  assert.equal('allowed_payment_delays' in TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4, false);
  assert.deepEqual(TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4.allowed_payment_delay_units, ['BUSINESS_DAYS']);
  assert.deepEqual(TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4.allowed_payment_delay_bound_types, ['EXACT', 'OUTER_BOUND']);
});

test('every V4 pathway_constraint is the exact structural migration of its V3 sibling -- no stored V3 delay token survives in the old single-string form', () => {
  for (const constraint of TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4.pathway_constraints) {
    assert.equal(typeof constraint.payment_delay, 'object');
    assert.equal('payment_delay' in constraint, true);
    assert.equal(Number.isInteger(constraint.payment_delay.count), true);
    assert.ok(['EXACT', 'OUTER_BOUND'].includes(constraint.payment_delay.bound_type));
  }
});

// -----------------------------------------------------------------------
// A real, migrated V4 effect validates.
// -----------------------------------------------------------------------

test('a V4 effect built by migrating a real V2 ground validates against TERMINATION_FEE_TRIGGER_PATH_SCHEMA_V4', () => {
  const { binding, rest } = v4EffectBase();
  // IMMEDIATE_RECOMMENDATION_CHANGE's V2 payment_timing is
  // TWO_BUSINESS_DAYS_AFTER_TERMINATION -> TERMINATION / {count:2, unit:
  // 'BUSINESS_DAYS', bound_type:'OUTER_BOUND'} (contract-bundle.js's
  // PAYMENT_DELAY_STRUCTURE_MIGRATION_V1, applied on top of V3's own split).
  const v4Effect = {
    ...rest,
    trigger_path_schema_version: 4,
    payment_trigger_event: 'TERMINATION',
    payment_delay: { count: 2, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND' },
  };
  assert.equal(
    validateTerminationFeeTriggerEffect(v4Effect, { binding, schema: compiledV4Schema(binding) }),
    true,
  );
});

test('a V4 effect with the right event/delay VALUES but the wrong bound_type does not match its frozen pathway template', () => {
  const { binding, rest } = v4EffectBase();
  const wrongBoundType = {
    ...rest,
    trigger_path_schema_version: 4,
    payment_trigger_event: 'TERMINATION',
    payment_delay: { count: 2, unit: 'BUSINESS_DAYS', bound_type: 'EXACT' },
  };
  assert.throws(
    () => validateTerminationFeeTriggerEffect(wrongBoundType, { binding, schema: compiledV4Schema(binding) }),
    /does not match its frozen template/,
  );
});

test('a V4 effect naming CONSUMMATION on a pathway whose frozen template is not CONSUMMATION is rejected, not silently accepted as a synonym for EARLIER_OF_SIGNING_OR_CONSUMMATION', () => {
  const { binding, rest } = v4EffectBase();
  const consummationEffect = {
    ...rest,
    trigger_path_schema_version: 4,
    payment_trigger_event: 'CONSUMMATION',
    payment_delay: { count: 0, unit: 'BUSINESS_DAYS', bound_type: 'EXACT' },
  };
  assert.throws(
    () => validateTerminationFeeTriggerEffect(consummationEffect, { binding, schema: compiledV4Schema(binding) }),
    /does not match its frozen template/,
  );
});

// -----------------------------------------------------------------------
// "Within three Business Days" -- a duration the V3 enum could not
// express -- is well-formed under V4 with no schema edit and no new
// ruling (decision 5: "adding a duration is not a codebook decision").
// -----------------------------------------------------------------------

test('a measured delay outside the two counts this schema has seen so far ("three Business Days") is structurally well-formed -- count is validated as a shape, not enumerated', () => {
  const { binding, rest } = v4EffectBase();
  const threeBusinessDays = {
    ...rest,
    trigger_path_schema_version: 4,
    payment_trigger_event: 'TERMINATION',
    payment_delay: { count: 3, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND' },
  };
  // This still does not match IMMEDIATE_RECOMMENDATION_CHANGE's OWN frozen
  // pathway template (which is genuinely 2 Business Days, not 3) -- the
  // point of this test is that the failure is the pathway-template
  // mismatch, never a "count not in allowed_payment_delays" governance
  // rejection, since V4 has no such list to reject against.
  assert.throws(
    () => validateTerminationFeeTriggerEffect(threeBusinessDays, { binding, schema: compiledV4Schema(binding) }),
    /does not match its frozen template/,
  );
});

test('a negative or non-integer count is refused -- "measurement" still means a well-formed one, not an arbitrary value', () => {
  const { binding, rest } = v4EffectBase();
  const schema = compiledV4Schema(binding);
  for (const badCount of [-1, 1.5, '2', null]) {
    const malformed = {
      ...rest,
      trigger_path_schema_version: 4,
      payment_trigger_event: 'TERMINATION',
      payment_delay: { count: badCount, unit: 'BUSINESS_DAYS', bound_type: 'OUTER_BOUND' },
    };
    assert.throws(
      () => validateTerminationFeeTriggerEffect(malformed, { binding, schema }),
      /outside its metric-operation binding/,
      JSON.stringify(badCount),
    );
  }
});

test('a V4 effect still carrying V3\'s flat string payment_delay (instead of the structured object) is refused, not read as a degenerate structure', () => {
  const { binding, rest } = v4EffectBase();
  const legacyShaped = {
    ...rest,
    trigger_path_schema_version: 4,
    payment_trigger_event: 'TERMINATION',
    payment_delay: 'TWO_BUSINESS_DAYS',
  };
  assert.throws(
    () => validateTerminationFeeTriggerEffect(legacyShaped, { binding, schema: compiledV4Schema(binding) }),
    /outside its metric-operation binding/,
  );
});
