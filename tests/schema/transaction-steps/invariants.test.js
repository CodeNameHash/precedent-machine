const test = require('node:test');
const assert = require('node:assert/strict');

const { enforceTransactionStepInvariants } = require('../../../lib/schema/topology-detector');

function step(order, kind = 'MERGER') {
  return {
    step_order: order,
    step_kind: kind,
    disappearing_entity: `Entity ${order}`,
    surviving_entity: `Survivor ${order}`,
    effective_time_ref: 'Effective Time',
    effective_time_definition_quote: 'The merger shall become effective at the Effective Time.',
  };
}

test('transaction-step invariant rejects non-consecutive order', () => {
  assert.throws(
    () => enforceTransactionStepInvariants([step(1), step(3)]),
    /consecutive/,
  );
});

test('transaction-step invariant rejects single-merger topology with two steps', () => {
  assert.throws(
    () => enforceTransactionStepInvariants([step(1), step(2)], {
      topology: 'SINGLE_MERGER',
      step_count: 2,
      primary_step_order: 1,
    }),
    /SINGLE_MERGER/,
  );
});
