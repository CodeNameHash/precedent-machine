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
  const { headlineSummaryProblems, HEADLINE_SUMMARY_MAX_WORDS, HEADLINE_SUMMARY_ASKED_WORDS, HEADLINE_SUMMARY_RULE } = require('../lib/product/fact-components');
  const fact = example();
  fact.components.forEach((component) => { if (component.origin === 'CHAPEAU') component.origin_structure_node_id = 'n31'; });
  assert.equal(HEADLINE_SUMMARY_ASKED_WORDS, 15);
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
  // Work package 5 (plan finding (52)): three fair generation 8 summaries
  // dropped at 16 words, so the check allows 18 while the extractor is
  // still asked for 15 (the rule text).
  assert.deepEqual(headlineSummaryProblems('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen'), []);
  assert.deepEqual(headlineSummaryProblems('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen'), []);
  assert.ok(headlineSummaryProblems('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen').some((problem) => problem.includes('over 18 words (19; 15 asked for)')));
  assert.match(HEADLINE_SUMMARY_RULE, /at most 15/);
  assert.equal(HEADLINE_SUMMARY_ASKED_WORDS, 15);
  assert.equal(HEADLINE_SUMMARY_MAX_WORDS, 18);
  assert.ok(headlineSummaryProblems('Parent pays the fee under Section 8.3').some((problem) => problem.includes('section reference')));
  // A statutory section or an Article of the agreement is content (generation 7, 1.02 and 1.04).
  assert.deepEqual(headlineSummaryProblems('The Merger has the effects set forth in Section 259 of the DGCL'), []);
  assert.deepEqual(headlineSummaryProblems('Company exempts dispositions under Section 16 of the Exchange Act'), []);
  assert.deepEqual(headlineSummaryProblems('Closing occurs third business day after Article VII conditions satisfied or waived'), []);
  assert.deepEqual(headlineSummaryProblems('Shares of properly demanding Section 262 holders are cancelled Appraisal Shares'), []);
  assert.ok(headlineSummaryProblems('Company terminates under Section 8.01(f)').some((problem) => problem.includes('section reference')));
  // A section of the Disclosure Letter names a schedule, not a section of the agreement (generation 7, 9.03).
  assert.deepEqual(headlineSummaryProblems('Matters listed on Section 9.03(a) of the Company Disclosure Letter are excluded'), []);
  assert.ok(headlineSummaryProblems('Matters on Section 9.03(a) of the Company Disclosure Letter are excluded under Section 9.03').some((problem) => problem.includes('section reference')));
  assert.deepEqual(headlineSummaryProblems('Company Disclosure Letter Section 3.21 lists all material insurance policies'), []);
  assert.deepEqual(headlineSummaryProblems('Company Disclosure Letter Section 3.11(a) lists each material Company Benefit Plan'), []);
  assert.ok(headlineSummaryProblems('Parent pays the "Termination Fee"').some((problem) => problem.includes('quotation mark')));
  assert.ok(headlineSummaryProblems('Parent pays the fee.').some((problem) => problem.includes('ends with a period')));
  // A letter from another script is the model's slip, never the agreement's
  // words (generation 8, 9.03: "Parent's选 alternative").
  assert.ok(headlineSummaryProblems('Rights Agent is the transfer agent or Parent\u2019s选 alternative').some((problem) => problem.includes('outside the agreement\'s script ("选")')));
  assert.deepEqual(headlineSummaryProblems('Consideration is \u20ac47.50 per share, résumé of the 20% test and the “Outside Date”'.replace(/[“”]/g, '')), []);
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

// Generation 7, 3.18: a LIST_ELEMENT the model placed outside a LIST held
// the fact; it is an ordinary TERM.
test('a LIST_ELEMENT outside a LIST is built as a TERM', () => {
  const { buildComponentTree } = require('../lib/product/fact-components');
  const resolve = (raw) => ({ span: { source_span_id: 's', start_byte: 0, end_byte: raw.quote.length }, context: {} });
  const tree = buildComponentTree({
    modelComponents: [
      { ref: 'a', kind: 'LIST_ELEMENT', label: 'first', quote: 'air permits', source_span_id: 's', occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
      { ref: 'l', kind: 'LIST', label: 'list', quote: 'water permits and waste permits', source_span_id: 's', occurrence: 0, origin: 'OWN', gap_before: false, children: [
        { ref: 'l1', kind: 'LIST_ELEMENT', label: 'water', quote: 'water permits', source_span_id: 's', occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
      ] },
    ],
    resolve, factId: 'f', contentId: (domain, body) => `${domain}:${JSON.stringify(body).length}`,
  });
  assert.deepEqual(tree.problems, []);
  assert.equal(tree.components[0].kind, 'TERM');
  assert.equal(tree.components[1].children[0].kind, 'LIST_ELEMENT');
});

// A layer shows its words without the SEC page footers the canonical text
// keeps (Ben, 2026-10-17, plan finding (42)); the component is unchanged.
test('renderLayer hides a page footer in a component\'s words', () => {
  const component = { component_id: 'c-x', kind: 'OBJECT', label: 'agreement', text: 'any\n-38-\nagreement', origin: 'OWN', gap_before: false, children: [] };
  assert.equal(renderLayer([component])[0].text, 'any agreement');
  assert.equal(component.text, 'any\n-38-\nagreement');
});

// Work package 14 (manager, 2026-10-18, plan finding (81), NCS generation 5):
// "a count component whose words are 'no'/'none'/'zero' of the counted thing
// is 0; an AMOUNT whose words define it as a product, sum or ratio of
// defined terms carries no canonical value and a note, and the fact stays
// VALID with its components". The three held facts' own words.
test('a count of none is 0 and a formula amount is valid without a number; prose without either is still held', () => {
  const { buildComponentTree, validateFactComponents, isFormulaValue } = require('../lib/product/fact-components');
  const resolve = (raw) => ({ span: { source_span_id: 's', span_id: 's', start_byte: 0, end_byte: Buffer.byteLength(raw.quote, 'utf8') }, context: { component_kind: 'FULL_SECTION' } });
  const contentId = (kind, parts) => `${parts.path.join('.')}-${parts.kind}`;
  const tree = buildComponentTree({
    modelComponents: [
      { kind: 'AMOUNT', label: 'no preferred shares', quote: 'no shares of Company Preferred Stock', origin: 'OWN', children: [] },
      { kind: 'AMOUNT', label: 'no parent shares', quote: '(ii) no Parent Ordinary Shares', origin: 'OWN', children: [] },
      { kind: 'AMOUNT', label: 'cash consideration', quote: '“Cash Consideration” means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price.', origin: 'OWN', children: [] },
      { kind: 'AMOUNT', label: 'a fee', quote: 'a fee', origin: 'OWN', children: [] },
    ],
    resolve, factId: 'f', contentId,
  });
  assert.deepEqual(tree.components.map((component) => component.value), [
    { canonical: 0, unit: 'COUNT' }, { canonical: 0, unit: 'COUNT' }, { canonical: null, unit: null, form: 'FORMULA' }, null,
  ]);
  assert.deepEqual(tree.formulas, [{ path: '2', component_id: '2-AMOUNT', text: '“Cash Consideration” means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price.' }]);
  assert.deepEqual(tree.problems, ['3: no parsable value in "a fee"'], 'only the prose amount is a problem');
  const fact = { headline: { label: 'Values', distinguishing_component_ids: ['0-AMOUNT'] }, components: tree.components.slice(0, 3) };
  assert.deepEqual(validateFactComponents(fact).filter((problem) => /canonical/.test(problem)), [], 'none and a formula are valid values');
  const prose = { headline: { label: 'Values', distinguishing_component_ids: ['3-AMOUNT'] }, components: tree.components.slice(3) };
  assert.ok(validateFactComponents(prose).some((problem) => problem.includes('AMOUNT needs a canonical value')));
  // A formula names an operation on at least two defined terms; a number
  // in the words is parsed instead, and prose with one term is not one.
  assert.equal(isFormulaValue('the Mixed Share Consideration Exchange Ratio multiplied by the Parent Closing Price'), true);
  assert.equal(isFormulaValue('the sum of the Closing Amount plus the CVR'), true);
  assert.equal(isFormulaValue('an amount equal to the Termination Fee'), false);
  assert.equal(isFormulaValue('the product of 0.1371 and the Parent Closing Price'), false);
});
