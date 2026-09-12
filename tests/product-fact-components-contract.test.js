'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { contract, validateFactComponents, renderHeadline, renderLayer, uncoveredRanges } = require('../lib/product/fact-components');

function example() {
  const fact = JSON.parse(JSON.stringify(contract.example_fact));
  let cursor = 0;
  (function stamp(list) {
    for (const component of list || []) {
      component.start_byte = cursor; cursor += Buffer.byteLength(component.text, 'utf8'); component.end_byte = cursor;
      component.source_span_id = 's';
      stamp(component.children);
    }
  }(fact.components));
  return fact;
}

test('the contract example satisfies its own rules', () => {
  const fact = example();
  fact.components.forEach((component) => { if (component.origin === 'CHAPEAU') component.origin_structure_node_id = 'n31'; });
  assert.deepEqual(validateFactComponents(fact), []);
  assert.equal(renderHeadline(fact), 'MAE carve-out: geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks)');
  const layer0 = renderLayer(fact.components);
  assert.deepEqual(layer0.map((item) => [item.kind, item.inherited, item.has_children]), [['LITANY', true, false], ['OPERATION', true, false], ['LIST', false, true]]);
  assert.deepEqual(layer0[0].members, ['event', 'change', 'circumstance', 'occurrence', 'effect', 'state of facts']);
  const war = renderLayer(fact.components[2].children);
  assert.deepEqual(war.map((item) => item.label), ['geopolitical conditions or changes', 'war', 'terrorism', 'sabotage']);
  assert.equal(renderLayer(fact.components[2].children[3].children)[0].label, 'cyber-attacks');
});

test('rules reject invented text, ellipses, loose list elements, forced values and unresolved references', () => {
  const fact = example();
  fact.components.forEach((component) => { if (component.origin === 'CHAPEAU') component.origin_structure_node_id = 'n31'; });
  const stamp = (component) => ({ start_byte: 0, end_byte: 1, source_span_id: 's', ...component });
  fact.components.push(stamp({ component_id: 'bad-0', kind: 'TERM', label: '', text: 'unlabelled', origin: 'OWN', children: [] }));
  fact.components.push(stamp({ component_id: 'bad-1', kind: 'QUALIFIER', label: 'q', text: 'none', origin: 'OWN', children: [] }));
  fact.components.push(stamp({ component_id: 'bad-2', kind: 'TERM', label: 't', text: 'the parties ... agree', origin: 'OWN', children: [] }));
  fact.components.push(stamp({ component_id: 'bad-3', kind: 'LIST_ELEMENT', label: 'e', text: 'stray', origin: 'OWN', children: [] }));
  fact.components.push(stamp({ component_id: 'bad-4', kind: 'AMOUNT', label: 'th', text: 'a fee', origin: 'OWN', children: [] }));
  fact.components.push(stamp({ component_id: 'bad-5', kind: 'CROSS_REFERENCE', label: 'x', text: 'Section 6.1', origin: 'OWN', children: [] }));
  fact.components.push(stamp({ component_id: 'bad-6', kind: 'TERM', label: 'i', text: 'inherited', origin: 'INTRO', children: [] }));
  const problems = validateFactComponents(fact);
  for (const expected of ['label missing', 'invented text', 'ellipsis', 'LIST_ELEMENT outside a LIST', 'needs a canonical value', 'must resolve', 'needs origin_structure_node_id']) {
    assert.ok(problems.some((problem) => problem.includes(expected)), expected);
  }
});

test('byte ranges are checked against the canonical text and the source span', () => {
  const text = 'Section 3.1. MAE shall not include any event to the extent resulting from acts of terrorism.';
  const bytes = (s) => Buffer.byteLength(s, 'utf8');
  const quote = 'acts of terrorism';
  const start = bytes(text.slice(0, text.indexOf(quote)));
  const fact = {
    headline: { label: 'MAE carve-out', distinguishing_component_ids: ['c1'] },
    components: [{ component_id: 'c1', kind: 'LIST_ELEMENT', label: 'terrorism', text: quote, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + bytes(quote), children: [] }],
  };
  fact.components[0].kind = 'TERM';
  const spans = new Map([['s', { start_byte: 0, end_byte: bytes(text) }]]);
  assert.deepEqual(validateFactComponents(fact, { sourceText: text, spansById: spans }), []);
  fact.components[0].text = 'acts of terror';
  assert.ok(validateFactComponents(fact, { sourceText: text, spansById: spans }).some((problem) => problem.includes('does not match canonical bytes')));
  fact.components[0].text = quote;
  assert.deepEqual(uncoveredRanges(fact, 0, bytes(text)), [[0, start], [start + bytes(quote), bytes(text)]]);
});
