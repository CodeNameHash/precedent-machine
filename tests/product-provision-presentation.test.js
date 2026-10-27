'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { answerFor, explanationFor } = require('../lib/product/provision-presentation');

const fact = (cells, extra = {}) => ({ statement: 'Drafting.', conclusions: { table_key: 't', row_label: 'Filing deadline', cells }, ...extra });

test('a period is the answer and only the period is a pill', () => {
  const { answer } = answerFor(fact([
    { kind: 'value', column_id: 'period', label: 'within 10 business days' },
    { kind: 'text', column_id: 'asDrafted', text: 'shall file within ten (10) business days' },
  ]));
  assert.equal(answer.text, 'within 10 business days');
  assert.equal(answer.pill, true);
});

test('a phrase that is not an answer is drafting and never a pill', () => {
  const { answer, extras } = answerFor(fact([
    { kind: 'text', column_id: 'qualifier', label: 'after the agreement date' },
  ]));
  assert.equal(answer, null);
  assert.deepEqual(extras, []);
});

test('three restatements of one deadline collapse to one answer', () => {
  const { answer, extras } = answerFor(fact([
    { kind: 'value', column_id: 'period', label: 'within 10 business days' },
    { kind: 'pill', column_id: 'hsr', code: 'WITHIN_PERIOD', label: 'HSR within a stated period' },
    { kind: 'pill', column_id: 'period2', code: 'TEN_DAYS', label: 'within 10 business days' },
  ]));
  assert.equal(answer.text, 'within 10 business days');
  assert.deepEqual(extras.map((entry) => entry.text), ['HSR within a stated period']);
});

test('a springing condition is kept beside the answer, not among the extras', () => {
  const { answer, condition } = answerFor(fact([
    { kind: 'value', column_id: 'period', label: 'within 10 business days' },
    { kind: 'pill', column_id: 'condition', code: 'CMA_PHASE_2', label: 'if a CMA Phase 2 reference is made' },
  ]));
  assert.equal(answer.text, 'within 10 business days');
  assert.equal(condition.text, 'if a CMA Phase 2 reference is made');
});

test('the sidebar explains once: the as-drafted words and the read together', () => {
  const explanation = explanationFor(fact([
    { kind: 'text', column_id: 'asDrafted', text: 'Company shall file within ten (10) business days' },
  ]));
  assert.equal(explanation.as_drafted, 'Company shall file within ten (10) business days');
  assert.equal(explanation.interpretation, 'Filing deadline');
});
