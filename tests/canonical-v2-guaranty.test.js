'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GUARANTY_ASSERTION_KINDS,
  corroborateGuarantyKind,
} = require('../lib/canonical-v2/native-producer/guaranty-corroboration');
const {
  buildGuarantyProducerPrompt,
} = require('../lib/canonical-v2/native-producer/guaranty-producer-prompt');

const scope = { start_utf8: 0, end_utf8: 200 };

test('guaranty prompt preserves the positive-only and financing-source boundaries', () => {
  const prompt = buildGuarantyProducerPrompt({ source_text: 'Guaranty text', governed_scope: scope });
  assert.match(prompt.messages[0].content, /positive guaranty facts only/i);
  assert.match(prompt.messages[0].content, /Never infer no guaranty/i);
  assert.match(prompt.messages[0].content, /financing-source protections/i);
});

test('all three governed guaranty kinds require their own quoted corroboration', () => {
  assert.deepEqual(GUARANTY_ASSERTION_KINDS, [
    'PERFORMANCE_GUARANTY', 'GUARANTY_DELIVERED', 'GUARANTY_IN_EFFECT',
  ]);
  assert.equal(corroborateGuarantyKind({
    quote: 'Parent guarantees the due performance of Merger Sub obligations.',
    asserted_kind: 'PERFORMANCE_GUARANTY',
  }).outcome, 'RESOLVED');
  assert.equal(corroborateGuarantyKind({
    quote: 'Parent has delivered a duly executed Guaranty.',
    asserted_kind: 'GUARANTY_DELIVERED',
  }).outcome, 'RESOLVED');
  assert.equal(corroborateGuarantyKind({
    quote: 'The Guaranty is in full force and effect and is a valid and binding obligation.',
    asserted_kind: 'GUARANTY_IN_EFFECT',
  }).outcome, 'RESOLVED');
});

test('kind mismatch queues and unknown kinds remain open world', () => {
  assert.deepEqual(corroborateGuarantyKind({
    quote: 'Parent delivered the financing documents.',
    asserted_kind: 'GUARANTY_DELIVERED',
  }), { outcome: 'REVIEW', reason: 'GTY_KIND_UNCORROBORATED' });
  assert.deepEqual(corroborateGuarantyKind({
    quote: 'Parent provided credit support.',
    asserted_kind: 'GUARANTY_CAP',
  }), { outcome: 'OPEN_WORLD', reason: 'GTY_ASSERTION_KIND_OUT_OF_VOCABULARY' });
});

test('a quote that blurs operative and delivered guaranty objects queues', () => {
  const quote = 'Parent guarantees performance of the obligations and has delivered a duly executed Guaranty.';
  assert.deepEqual(corroborateGuarantyKind({
    quote,
    asserted_kind: 'PERFORMANCE_GUARANTY',
  }), { outcome: 'REVIEW', reason: 'AMBIGUOUS_GUARANTY_OBJECT' });
  assert.deepEqual(corroborateGuarantyKind({
    quote,
    asserted_kind: 'GUARANTY_DELIVERED',
  }), { outcome: 'REVIEW', reason: 'AMBIGUOUS_GUARANTY_OBJECT' });
});

test('malformed calls fail', () => {
  assert.throws(() => corroborateGuarantyKind(), TypeError);
  assert.throws(() => corroborateGuarantyKind({ quote: '', asserted_kind: 'GUARANTY_DELIVERED' }), TypeError);
});
