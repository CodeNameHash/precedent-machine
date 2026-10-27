'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { answerFor, explanationFor, labelForCode } = require('../lib/product/provision-presentation');

const fact = (cells, extra = {}) => ({ statement: 'Drafting.', conclusions: { table_key: 't', row_label: 'Filing deadline', cells }, ...extra });
const shapes = {
  sections: [{ section_key: 's', tables: [{ table_key: 't', columns: [
    { column_id: 'materiality', render: 'vocabulary', vocabulary: [{ code: 'MAE_AGGREGATE', label: 'MAE (aggregate)', tone: 'neutral' }] },
    { column_id: 'period', render: 'value' },
    { column_id: 'asDrafted', render: 'text' },
  ] }] }],
  shared_vocabularies: {},
};

test('a period is the answer and only the period is a pill', () => {
  const { answer } = answerFor(fact([
    { column_id: 'period', text: 'within 10 business days' },
    { column_id: 'asDrafted', text: 'shall file within ten (10) business days' },
  ]), shapes);
  assert.equal(answer.text, 'within 10 business days');
  assert.equal(answer.pill, true);
});

test('a phrase that is not an answer is drafting and never a pill', () => {
  const { answer, extras } = answerFor(fact([
    { column_id: 'qualifier', text: 'after the agreement date' },
  ]), shapes);
  assert.equal(answer, null);
  assert.deepEqual(extras, []);
});

test('three restatements of one deadline collapse to one answer', () => {
  const { answer, extras } = answerFor(fact([
    { column_id: 'period', text: 'within 10 business days' },
    { column_id: 'period', code: 'WITHIN_PERIOD' },
  ]), shapes);
  assert.equal(answer.text, 'within 10 business days');
  assert.deepEqual(extras.map((entry) => entry.text), ['Within Period']);
});

test('a springing condition is kept beside the answer, not among the extras', () => {
  const { answer, condition } = answerFor(fact([
    { column_id: 'period', text: 'within 10 business days' },
    { column_id: 'condition', text: 'if a CMA Phase 2 reference is made' },
  ]), shapes);
  assert.equal(answer.text, 'within 10 business days');
  assert.equal(condition.text, 'if a CMA Phase 2 reference is made');
});

test('the sidebar explains once: the as-drafted words and the read together', () => {
  const explanation = explanationFor(fact([
    { column_id: 'asDrafted', text: 'Company shall file within ten (10) business days' },
  ]));
  assert.equal(explanation.as_drafted, 'Company shall file within ten (10) business days');
  assert.equal(explanation.interpretation, 'Filing deadline');
});

test('a code is shown in the schema\'s words, not as a snake', () => {
  const { answer } = answerFor(fact([{ column_id: 'materiality', code: 'MAE_AGGREGATE' }]), shapes);
  assert.equal(answer.text, 'MAE (aggregate)');
  assert.equal(labelForCode('SOME_UNKNOWN_CODE', { shapes }), 'Some Unknown Code');
});
