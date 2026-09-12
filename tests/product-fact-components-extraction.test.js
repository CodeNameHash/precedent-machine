'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { compileExtraction } = require('../lib/product/agreement-draft');
const legalSchemaV2 = require('../contracts/product/legal-schema.v2.json');

const sha = (value) => createHash('sha256').update(value).digest('hex');
const text = 'Section 3.1 Organization. For purposes of this Agreement, Material Adverse Effect shall not include any event, change, circumstance, occurrence, effect or state of facts to the extent resulting from geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks), or a fee of $750,000 within 30 days.';
const bytes = (value) => Buffer.byteLength(value, 'utf8');
const nodeId = 'n'.repeat(64);
const fullSpanId = 'f'.repeat(64);
const closure = {
  source_closure_id: 'c'.repeat(64), structure_node_id: nodeId, section_node_id: nodeId, section_reference: '3.1', full_section_span_id: fullSpanId,
  spans: [{ span_id: fullSpanId, kind: 'FULL_SECTION', structure_node_id: nodeId, start_byte: 0, end_byte: bytes(text), exact_text: text }],
};
const sourceDocument = { source_document_id: 'd'.repeat(64), canonical_text: text };
const node = { node_id: nodeId, reference: '3.1', kind: 'SECTION' };
const call = { model_call_id: 'm'.repeat(64) };

function component(ref, kind, label, quote, extra = {}) {
  return { ref, kind, label, quote, source_span_id: fullSpanId, occurrence: 0, origin: 'OWN', children: [], ...extra };
}

function response(components, headline) {
  return {
    proposals: [{
      client_ref: 'p1', group_ref: 'g1', family_key: 'MAE_DEFINITION', subtype_key: 'EXCLUSION', fact_type: 'MAE_CARVEOUT',
      statement: 'Material Adverse Effect shall not include effects resulting from war, terrorism or sabotage.',
      roles: { LEGAL_ACTOR_OR_SUBJECT: 'Material Adverse Effect', LEGAL_OPERATION: 'shall not include', OPERATIVE_OBJECT: 'geopolitical conditions or changes' },
      value: null,
      evidence_quotes: [{ quote: 'geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks)', source_span_id: fullSpanId, occurrence: 0 }],
      headline, components,
    }],
    groups: [{ client_ref: 'g1', family_key: 'MAE_DEFINITION', subtype_key: 'EXCLUSION' }],
    links: [],
  };
}

function compile(body) {
  return compileExtraction({ sourceDocument, legalSchema: legalSchemaV2, node, closure, call, response: body, routedFamilies: ['MAE_DEFINITION'], ownedNodeIds: new Set([nodeId]) });
}

test('V2 extraction compiles a valid component tree with headline, values and byte spans', () => {
  const components = [
    component('litany', 'LITANY', 'affected matters', 'any event, change, circumstance, occurrence, effect or state of facts', { origin: 'CHAPEAU', origin_structure_node_id: nodeId, members: ['event', 'change', 'circumstance', 'occurrence', 'effect', 'state of facts'] }),
    component('resulting', 'OPERATION', 'resulting from', 'to the extent resulting from'),
    component('war', 'LIST', 'war, terrorism and sabotage', 'geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks)', {
      children: [
        component('war-1', 'TERM', 'geopolitical conditions', 'geopolitical conditions or changes that are the result of'),
        component('war-2', 'LIST_ELEMENT', 'war', 'the outbreak, conduct or escalation of war (whether declared or undeclared)'),
        component('war-3', 'LIST_ELEMENT', 'terrorism', 'acts of terrorism'),
        component('war-4', 'LIST_ELEMENT', 'sabotage', 'sabotage', { children: [component('war-4a', 'LIST_ELEMENT', 'cyber-attacks', '(including cyber-attacks)')] }),
      ],
    }),
    component('fee', 'AMOUNT', 'fee', '$750,000', { gap_before: true }),
    component('period', 'PERIOD', 'within', '30 days'),
  ];
  const compiled = compile(response(components, { label: 'MAE carve-out', distinguishing_refs: ['war'] }));
  assert.equal(compiled.proposals.length, 1);
  const proposal = compiled.proposals[0];
  assert.equal(proposal.validation_status, 'VALID', JSON.stringify(compiled.issues.map((issue) => issue.message)));
  assert.equal(proposal.headline.label, 'MAE carve-out');
  assert.equal(proposal.headline.distinguishing_component_ids.length, 1);
  assert.equal(proposal.components.length, 5);
  const war = proposal.components[2];
  assert.equal(war.children.length, 4);
  assert.equal(war.children[3].children[0].label, 'cyber-attacks');
  assert.equal(proposal.components[0].origin, 'CHAPEAU');
  assert.deepEqual(proposal.components[3].value, { canonical: 750000, unit: 'USD' });
  assert.deepEqual(proposal.components[4].value, { canonical: 30, unit: 'DAY' });
  assert.equal(proposal.components[3].gap_before, true);
  const sliced = Buffer.from(text, 'utf8').subarray(war.children[2].start_byte, war.children[2].end_byte).toString('utf8');
  assert.equal(sliced, 'acts of terrorism');
  assert.ok(compiled.spans.some((span) => span.exact_text === 'acts of terrorism' && span.kind === 'SUPPORTING_EVIDENCE'));
  assert.equal(compiled.issues.filter((issue) => issue.code === 'INVALID_FACT_COMPONENTS').length, 0);
});

test('V2 extraction holds a proposal whose component quote is not in the source or whose role text is invented', () => {
  const bad = compile(response([component('x', 'TERM', 'x', 'acts of terror and mayhem')], { label: 'MAE carve-out', distinguishing_refs: ['x'] }));
  assert.equal(bad.proposals[0].validation_status, 'INVALID');
  const issue = bad.issues.find((candidate) => candidate.code === 'INVALID_FACT_COMPONENTS');
  assert.ok(issue);
  assert.match(issue.message, /quote not found in source/);
  const none = response([component('t', 'LIST_ELEMENT', 'terrorism', 'acts of terrorism')], { label: 'MAE carve-out', distinguishing_refs: ['t'] });
  none.proposals[0].roles.QUALIFICATIONS = 'none';
  const compiled = compile(none);
  assert.equal(compiled.proposals[0].validation_status, 'INVALID');
  assert.ok(compiled.issues.some((candidate) => candidate.code === 'INVENTED_ROLE_TEXT'));
  assert.ok(compiled.issues.some((candidate) => candidate.code === 'INVALID_FACT_COMPONENTS' && /LIST_ELEMENT outside a LIST/.test(candidate.message)));
});

test('V1 schema extraction is unchanged: no headline or components keys', () => {
  const legalSchemaV1 = require('../contracts/product/legal-schema.v1.json');
  const body = response(undefined, undefined);
  body.proposals[0].roles = { LEGAL_ACTOR_OR_SUBJECT: 'Material Adverse Effect', LEGAL_OPERATION: 'shall not include', OPERATIVE_OBJECT: 'geopolitical conditions', TEMPORAL_OR_TRIGGER_SCOPE: 'to the extent resulting from', QUALIFICATIONS: 'whether declared or undeclared' };
  const compiled = compileExtraction({ sourceDocument, legalSchema: legalSchemaV1, node, closure, call, response: body, routedFamilies: ['MAE_DEFINITION'], ownedNodeIds: new Set([nodeId]) });
  assert.equal(compiled.proposals[0].validation_status, 'VALID');
  assert.equal(Object.hasOwn(compiled.proposals[0], 'components'), false);
  assert.equal(Object.hasOwn(compiled.proposals[0], 'headline'), false);
});

test('V2 extraction maps synonym kinds to the contract and allows a descriptive period without a number', () => {
  const body = response([
    component('who', 'PARTY', 'subject', 'Material Adverse Effect'),
    component('when', 'TIME', 'timing', 'to the extent resulting from'),
    component('q', 'QUALIFICATION', 'qualifier', '(whether declared or undeclared)'),
    component('p', 'PERIOD', 'period', 'within 30 days'),
    component('r', 'LEGAL_OPERATION', 'operation', 'shall not include'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['who'] });
  const compiled = compile(body);
  assert.equal(compiled.proposals[0].validation_status, 'VALID', JSON.stringify(compiled.issues));
  assert.deepEqual(compiled.proposals[0].components.map((item) => item.kind), ['ACTOR', 'TRIGGER', 'QUALIFIER', 'PERIOD', 'OPERATION']);
  assert.equal(compiled.proposals[0].components[3].value.canonical, 30);
  const descriptive = compile(response([
    component('p', 'PERIOD', 'period', 'to the extent resulting from geopolitical conditions'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['p'] }));
  assert.equal(descriptive.proposals[0].validation_status, 'VALID', JSON.stringify(descriptive.issues));
  assert.equal(descriptive.proposals[0].components[0].value, null);
  const thresholdPeriod = compile(response([
    component('t', 'THRESHOLD', 'threshold', 'within 30 days'),
    component('d', 'THRESHOLD', 'threshold', 'to the extent resulting from geopolitical conditions'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['t'] }));
  assert.equal(thresholdPeriod.proposals[0].validation_status, 'VALID', JSON.stringify(thresholdPeriod.issues));
  assert.deepEqual(thresholdPeriod.proposals[0].components[0].value, { canonical: 30, unit: 'DAY' });
  assert.equal(thresholdPeriod.proposals[0].components[1].value, null);
  const amount = compile(response([
    component('a', 'AMOUNT', 'amount', 'geopolitical conditions'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['a'] }));
  assert.equal(amount.proposals[0].validation_status, 'INVALID');
  const unknown = compile(response([
    component('z', 'WIDGET', 'widget', 'geopolitical conditions'),
  ], { label: 'MAE carve-out', distinguishing_refs: ['z'] }));
  assert.equal(unknown.proposals[0].validation_status, 'INVALID');
});
