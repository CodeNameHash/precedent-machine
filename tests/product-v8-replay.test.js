'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { compileExtraction } = require('../lib/product/agreement-draft');
const { renderHeadline } = require('../lib/product/fact-components');
const legalSchemaV2 = require('../contracts/product/legal-schema.v2.json');

// Replay of one real recorded PRODUCT_ALL_FAMILY_EXTRACTOR/V8 call from the NCS
// layered rerun (legal schema V2), through the same compile path as
// tests/product-fact-components-extraction.test.js, so the component compiler
// is checked against genuine model output rather than only hand-written fixtures.

const record = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures/product/ncs-v8-extraction-call.v1.json'), 'utf8',
));
const requestContent = JSON.parse(record.request.messages[0].content);
const sourceClosure = requestContent.source_closure;
const response = JSON.parse(record.response.content[0].text);

// The record's source_closure carries the model-facing SOURCE_CLOSURE/V1 shape
// (operative/chapeau/definitions/cross_references/full_section, each a flat
// span array). compileExtraction expects the internal closure shape used by
// lib/product/source-context.js: a single `spans` array plus
// `full_section_span_id`, `structure_node_id`, `section_node_id`,
// `section_reference`, `source_closure_id` and `context_diagnostics`.
const allSpans = [
  ...sourceClosure.operative, ...sourceClosure.chapeau,
  ...sourceClosure.definitions, ...sourceClosure.cross_references,
  sourceClosure.full_section,
];
const spans = [...new Map(allSpans.map((span) => [span.span_id, span])).values()];

// Reconstruct canonical_text so every span's byte offsets are valid, the same
// way closureSourceText in lib/product/review-state.js does: allocate a
// buffer the length of the furthest span end, and place each span's
// exact_text bytes at its own start_byte.
const maxEnd = Math.max(...spans.map((span) => span.end_byte));
const buffer = new Uint8Array(maxEnd);
for (const span of spans) {
  const bytes = new TextEncoder().encode(span.exact_text);
  buffer.set(bytes.subarray(0, Math.min(bytes.length, span.end_byte - span.start_byte)), span.start_byte);
}
const canonicalText = new TextDecoder().decode(buffer);

const sourceDocument = {
  source_document_id: spans[0].source_document_id,
  canonical_text: canonicalText,
};
const closure = {
  source_closure_id: sourceClosure.source_closure_id,
  structure_node_id: record.structure_node_id,
  section_node_id: record.structure_node_id,
  section_reference: sourceClosure.section_reference,
  full_section_span_id: sourceClosure.full_section.span_id,
  spans,
  context_diagnostics: sourceClosure.context_diagnostics,
};
const node = { node_id: record.structure_node_id, reference: sourceClosure.section_reference, kind: 'SECTION' };
const call = { model_call_id: record.model_call_id };
const routedFamilies = [...new Set(response.proposals.map((proposal) => proposal.family_key))];
const ownedNodeIds = new Set(sourceClosure.owned_structure_node_ids);

test('V8 replay: a recorded NCS extraction call compiles through the real component compiler', () => {
  assert.equal(record.prompt_version, 'PRODUCT_ALL_FAMILY_EXTRACTOR/V8');
  assert.equal(legalSchemaV2.schema_version, 'LEGAL_SCHEMA/V2');
  assert.ok(response.proposals.length > 0);

  const compiled = compileExtraction({
    sourceDocument, legalSchema: legalSchemaV2, node, closure, call, response, routedFamilies, ownedNodeIds,
  });

  assert.equal(compiled.proposals.length, response.proposals.length,
    'every proposal in the response must compile, not be silently dropped');

  const valid = compiled.proposals.filter((proposal) => proposal.validation_status === 'VALID');
  const invalid = compiled.proposals.filter((proposal) => proposal.validation_status === 'INVALID');
  console.log(`replay: ${valid.length} VALID, ${invalid.length} INVALID proposal(s)`);
  assert.ok(valid.length >= 1, 'expected at least one VALID proposal from the recorded call');

  for (const proposal of invalid) {
    const proposalIssues = compiled.issues.filter((issue) => (
      (issue.code === 'INVALID_FACT_COMPONENTS' || issue.code === 'INVENTED_ROLE_TEXT')
      && issue.family_key === proposal.family_key && issue.subtype_key === proposal.subtype_key
    ));
    assert.ok(proposalIssues.length > 0,
      `INVALID proposal ${proposal.proposal_id} (${proposal.fact_type}) must have an INVALID_FACT_COMPONENTS or INVENTED_ROLE_TEXT issue naming the problem`);
  }

  const sourceBytes = Buffer.from(canonicalText, 'utf8');
  for (const proposal of valid) {
    assert.ok(proposal.headline, `VALID proposal ${proposal.proposal_id} must have a headline`);
    assert.ok(proposal.headline.distinguishing_component_ids.length >= 1,
      `VALID proposal ${proposal.proposal_id} headline must have at least one distinguishing component`);

    const stack = [...proposal.components];
    while (stack.length > 0) {
      const component = stack.pop();
      assert.ok(Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte),
        `component ${component.component_id} must have byte offsets`);
      const span = compiled.spans.find((candidate) => candidate.span_id === component.source_span_id);
      assert.ok(span, `component ${component.component_id} must resolve to a closure span`);
      assert.ok(component.start_byte >= span.start_byte && component.end_byte <= span.end_byte,
        `component ${component.component_id} byte offsets must be inside its span`);
      const sliced = sourceBytes.subarray(component.start_byte, component.end_byte).toString('utf8');
      assert.equal(sliced, component.text,
        `component ${component.component_id} text must equal the bytes at its offsets in the reconstructed text`);
      stack.push(...(component.children || []));
    }

    const headline = renderHeadline(proposal);
    assert.ok(typeof headline === 'string' && headline.trim().length > 0,
      `renderHeadline must yield a non-empty string for VALID proposal ${proposal.proposal_id}`);
    console.log(`headline (${proposal.family_key}/${proposal.subtype_key}): ${headline}`);
  }
});
