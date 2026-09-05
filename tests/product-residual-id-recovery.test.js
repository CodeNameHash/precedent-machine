'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { compileResidualPass } = require('../lib/product/agreement-draft');

const node = { node_id: 'node-1', reference: '8.13' };
const paragraphs = [
  { span_id: 'actual-a', exact_text: 'A', structure_node_id: node.node_id },
  { span_id: 'actual-b', exact_text: 'B', structure_node_id: node.node_id },
];
const closure = { source_closure_id: 'closure-1', full_section_span_id: 'full-1', spans: [{ span_id: 'full-1', kind: 'FULL_SECTION', exact_text: 'A B' }, { span_id: 'ref-full', kind: 'FULL_SECTION', exact_text: 'Referenced' }] };
const call = { model_call_id: 'call-1' };
const row = (id, disposition = 'IMMATERIAL') => ({ source_span_id: id, disposition, family_keys: [], rationale: 'reason' });

test('unknown IDs become context-only issues and cannot cover missing paragraphs', () => {
  const response = { paragraphs: [row('unknown-a'), row('unknown-b')] };
  const result = compileResidualPass({ response, call, node, closure, paragraphs });
  assert.equal(result.residualPass.dispositions.filter((x) => x.disposition === 'UNRESOLVED_UNUSUAL_PROVISION').length, 2);
  assert.equal(result.coverage.filter((x) => x.state === 'UNRESOLVED').length, 2);
  assert.equal(result.issues.filter((x) => x.code === 'RESIDUAL_PARAGRAPH_UNKNOWN').length, 2);
  assert.ok(result.issues.filter((x) => x.code === 'RESIDUAL_PARAGRAPH_UNKNOWN').every((x) => x.source_span_ids.includes('full-1')));
  assert.ok(result.issues.every((x) => !x.source_span_ids.includes('ref-full')));
  const detail = JSON.parse(result.issues.find((x) => x.code === 'RESIDUAL_PARAGRAPH_UNKNOWN').message);
  assert.equal(detail.model_call_id, 'call-1');
  assert.equal(detail.unknown_row.source_span_id, 'unknown-a');
  assert.equal(detail.explanation, 'Section context only; this is not a matched paragraph citation.');
  assert.ok(result.residualPass.dispositions.every((x) => !x.source_span_id.startsWith('unknown')));
  assert.ok(result.coverage.every((x) => !x.subject_id.startsWith('unknown')));
  assert.equal(JSON.stringify(response), JSON.stringify({ paragraphs: [row('unknown-a'), row('unknown-b')] }));
});

test('valid siblings remain unchanged and malformed known rows fail closed', () => {
  const result = compileResidualPass({ response: { paragraphs: [row('actual-a'), row('unknown')] }, call, node, closure, paragraphs });
  assert.equal(result.residualPass.dispositions.find((x) => x.source_span_id === 'actual-a').disposition, 'IMMATERIAL');
  assert.throws(() => compileResidualPass({ response: { paragraphs: [{ source_span_id: 'actual-a', disposition: 'BAD', family_keys: [], rationale: 'x' }] }, call, node, closure, paragraphs }), /RESIDUAL_DISPOSITION/);
  assert.throws(() => compileResidualPass({ response: { paragraphs: [row('actual-a'), row('actual-a')] }, call, node, closure, paragraphs }), /RESIDUAL_PARAGRAPH_DUPLICATE/);
  for (const bad of [null, [], {}, 4]) assert.throws(() => compileResidualPass({ response: { paragraphs: [bad] }, call, node, closure, paragraphs }), /MODEL_RESPONSE_SHAPE/);
  assert.throws(() => compileResidualPass({ response: { paragraphs: [row('actual-a'), row('actual-b'), row('actual-a')] }, call, node, closure, paragraphs }), /RESIDUAL_PARAGRAPH_DUPLICATE/);
  assert.throws(() => compileResidualPass({ response: { paragraphs: [row('actual-b'), row('actual-a')] }, call, node, closure, paragraphs }), /RESIDUAL_PARAGRAPH_ORDER/);
  assert.throws(() => compileResidualPass({ response: { paragraphs: [{ ...row('actual-a'), family_keys: ['UNKNOWN'] }] }, call, node, closure, paragraphs }), /RESIDUAL_FAMILY/);
});
