'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { answerFromV1 } = require('../lib/product/v1-answer-adapter');

test('a V1 provision reads as an answer, marked as V1', () => {
  const result = answerFromV1({ type: 'IOC', category: 'Preservation of Business Relationships', ai_metadata: { code: 'IOC-PRESERVE' } });
  assert.equal(result.generation, 'V1');
  assert.equal(result.row_key, 'IOC');
  assert.equal(result.row_label, 'Preservation of Business Relationships');
  assert.equal(result.answer.text, 'Ioc Preserve');
  assert.equal(result.answer.generation, 'V1');
});

test('a provision with exceptions carries them as its condition', () => {
  const result = answerFromV1({ type: 'NS', category: 'No shop', ai_metadata: { code: 'NS-PROHIBIT' }, exceptions: [{ text: 'fiduciary out' }, { text: 'superior proposal' }] });
  assert.equal(result.condition.text, '2 exceptions');
});

test('a provision without code or exceptions yields no answer rather than an empty one', () => {
  const result = answerFromV1({ type: 'COND-M', category: 'Conditions Preamble' });
  assert.equal(result.answer, null);
  assert.equal(result.condition, null);
  assert.equal(result.row_label, 'Conditions Preamble');
});
