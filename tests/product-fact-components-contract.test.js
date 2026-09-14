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
  // A loose element is one under a non-list parent; a LIST_ELEMENT at the
  // root of a fact is that fact being one element of a list in the source.
  fact.components.push(stamp({ component_id: 'bad-3p', kind: 'OPERATION', label: 'op', text: 'holds', origin: 'OWN', children: [stamp({ component_id: 'bad-3', kind: 'LIST_ELEMENT', label: 'e', text: 'stray', origin: 'OWN', children: [] })] }));
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

test('a CROSS_REFERENCE to a statute outside the agreement needs no resolution; one into the agreement still does', () => {
  const fact = example();
  fact.components.forEach((component) => { if (component.origin === 'CHAPEAU') component.origin_structure_node_id = 'n31'; });
  const stamp = (component) => ({ start_byte: 0, end_byte: 1, source_span_id: 's', ...component });
  fact.components.push(stamp({ component_id: 'ext-1', kind: 'CROSS_REFERENCE', label: 'statute', text: 'Section 259 of the DGCL', origin: 'OWN', children: [] }));
  fact.components.push(stamp({ component_id: 'ext-2', kind: 'CROSS_REFERENCE', label: 'rule', text: 'Rule 16b-3 under the Exchange Act', origin: 'OWN', children: [] }));
  assert.deepEqual(validateFactComponents(fact).filter((problem) => problem.includes('must resolve')), []);
  fact.components.push(stamp({ component_id: 'int-1', kind: 'CROSS_REFERENCE', label: 'internal', text: 'Section 8.02', origin: 'OWN', children: [] }));
  assert.equal(validateFactComponents(fact).filter((problem) => problem.includes('must resolve')).length, 1);
});

// headline.summary (Ben, 2026-09-14, on the Other provisions table: "it
// needs to be a summary of the provision on the right etc - like in the
// normal course. Not just a sec ref...!"; asked whether the extractor should
// write a short summary per fact as part of the fact contract: "1. for now -
// yes"). Optional; when present it is one line of at most 15 words, no
// section reference, no quotation marks, no trailing period, no leading or
// trailing whitespace. headlineSummaryProblems is the checker; a bad summary
// is a problem for the extractor to drop with a note, never a held fact, so
// validateFactComponents does not report it.
test('headline.summary is optional; headlineSummaryProblems checks it without holding the fact', () => {
  const { headlineSummaryProblems, HEADLINE_SUMMARY_MAX_WORDS } = require('../lib/product/fact-components');
  const fact = example();
  fact.components.forEach((component) => { if (component.origin === 'CHAPEAU') component.origin_structure_node_id = 'n31'; });
  assert.equal(HEADLINE_SUMMARY_MAX_WORDS, 15);
  assert.equal(typeof fact.headline.summary, 'string', 'the contract example carries a summary');
  assert.deepEqual(headlineSummaryProblems(fact.headline.summary), []);
  assert.deepEqual(validateFactComponents(fact), []);
  delete fact.headline.summary;
  assert.deepEqual(validateFactComponents(fact), [], 'an older generation without a summary is valid');
  assert.deepEqual(headlineSummaryProblems(undefined), []);
  assert.deepEqual(headlineSummaryProblems(null), []);
  assert.deepEqual(headlineSummaryProblems('Company files the Certificate of Merger with the Delaware Secretary of State'), []);
  assert.ok(headlineSummaryProblems(12).some((problem) => problem.includes('headline summary must be a string')));
  assert.ok(headlineSummaryProblems(' Parent pays the fee ').some((problem) => problem.includes('leading or trailing whitespace')));
  assert.ok(headlineSummaryProblems('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen').some((problem) => problem.includes('over 15 words')));
  assert.ok(headlineSummaryProblems('Parent pays the fee under Section 8.3').some((problem) => problem.includes('section reference')));
  // A statutory section or an Article of the agreement is content (generation 7, 1.02 and 1.04).
  assert.deepEqual(headlineSummaryProblems('The Merger has the effects set forth in Section 259 of the DGCL'), []);
  assert.deepEqual(headlineSummaryProblems('Company exempts dispositions under Section 16 of the Exchange Act'), []);
  assert.deepEqual(headlineSummaryProblems('Closing occurs third business day after Article VII conditions satisfied or waived'), []);
  assert.ok(headlineSummaryProblems('Parent pays the "Termination Fee"').some((problem) => problem.includes('quotation mark')));
  assert.ok(headlineSummaryProblems('Parent pays the fee.').some((problem) => problem.includes('ends with a period')));
  assert.deepEqual(headlineSummaryProblems("Parent's obligation survives the Closing"), [], 'a possessive apostrophe is not a quotation mark');
  // A malformed summary never feeds the INVALID_FACT_COMPONENTS path.
  fact.headline.summary = 'Parent pays the fee under Section 8.3.';
  assert.deepEqual(validateFactComponents(fact), []);
});

// Generation 6 (3.03, 3.15, 4.04): the model built a LITANY with children
// and no members; its children's words are its members.
test('a LITANY built with children and no members takes the children as members', () => {
  const { buildComponentTree } = require('../lib/product/fact-components');
  const resolve = (raw) => ({ span: { source_span_id: 's', start_byte: 0, end_byte: raw.quote.length }, context: {} });
  const tree = buildComponentTree({
    modelComponents: [{ ref: 'l', kind: 'LITANY', label: 'matters', quote: 'any event, change or effect', source_span_id: 's', occurrence: 0, origin: 'OWN', gap_before: false, children: [
      { ref: 'l1', kind: 'LIST_ELEMENT', label: 'event', quote: 'event', source_span_id: 's', occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
      { ref: 'l2', kind: 'LIST_ELEMENT', label: 'change', quote: 'change', source_span_id: 's', occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
      { ref: 'l3', kind: 'LIST_ELEMENT', label: 'effect', quote: 'effect', source_span_id: 's', occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
    ] }],
    resolve, factId: 'f', contentId: (domain, body) => `${domain}:${JSON.stringify(body).length}`,
  });
  assert.deepEqual(tree.problems, []);
  assert.deepEqual(tree.components[0].members, ['event', 'change', 'effect']);
  assert.deepEqual(tree.components[0].children, []);
});
