'use strict';

// Metsera generation 5 (3.13): "There is no default under any Specified
// Contract ..." and "no event has occurred that ... would constitute a
// default" are two facts of one subtype quoting the same sentence. Under
// the V2 schema each has a byte footprint of its own, so the shared
// occurrence id is re-keyed and both stay valid; two proposals with the
// same footprint are still a duplicate and held.

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { buildSourceClosure, substantiveSections } = require('../lib/product/source-context');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { conchoSource } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;
const schema = require('../contracts/product/legal-schema.v2.json');

function proposal(ref, span, quote, components) {
  return {
    client_ref: ref, group_ref: 'g-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', fact_type: 'PROHIBITED_ACTION',
    statement: ref, roles: { covenant_obligor: 'Company', prohibited_action: quote }, value: null,
    evidence_quotes: [{ quote, source_span_id: span.span_id, occurrence: 0 }],
    headline: { label: 'Prohibition', distinguishing_refs: [`${ref}-c1`] },
    components: components.map((words, index) => ({
      ref: `${ref}-c${index + 1}`, kind: index === 0 ? 'OPERATION' : 'OBJECT', label: `part ${index + 1}`, quote: words,
      source_span_id: span.span_id, occurrence: 0, origin: 'OWN', gap_before: index > 0, children: [],
    })),
  };
}

async function compile(makeProposals) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  const span = closure.spans.filter((item) => item.kind === 'OPERATIVE')[0];
  const words = span.exact_text.split(/\s+/).filter(Boolean);
  const quote = span.exact_text.slice(span.exact_text.indexOf(words[1]), span.exact_text.indexOf(words[9]) + words[9].length);
  const model = {
    async complete({ call_kind: kind, request }) {
      let response;
      if (kind === 'ROUTING') response = { families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'r', deterministic_disagreements: [] };
      else if (kind === 'RESIDUAL') response = { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'], rationale: 'c' })) };
      else response = {
        proposals: makeProposals(span, quote, words),
        groups: [{ client_ref: 'g-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION' }],
        links: [], coverage: { NO_SHOP: 'FOUND' },
        fact_type_coverage: { NO_SHOP: Object.fromEntries(schema.families.find((family) => family.family_key === 'NO_SHOP').required_fact_types.map((factType) => [factType, factType === 'PROHIBITED_ACTION' ? 'FOUND' : 'NOT_FOUND'])) },
      };
      return { provider_id: 'SYNTHETIC_TEST_PROVIDER', model_id: 'SYNTHETIC_LEGAL_MODEL/V1', raw_request: request, raw_response: response, response, input_tokens: 1, output_tokens: 1, cost_microusd: 1, duration_ms: 1 };
    },
  };
  return buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schema, model, node });
}

test('two facts on one sentence with different footprints are re-keyed and stay valid', async () => {
  const section = await compile((span, quote, words) => [
    proposal('p-1', span, quote, [words.slice(1, 4).join(' '), words.slice(4, 6).join(' ')]),
    proposal('p-2', span, quote, [words.slice(6, 8).join(' '), words.slice(8, 10).join(' ')]),
  ]);
  assert.equal(section.proposals.length, 2);
  assert.deepEqual(section.proposals.map((item) => item.validation_status), ['VALID', 'VALID'], JSON.stringify(section.issues.map((issue) => issue.message).slice(0, 3)));
  assert.notEqual(section.proposals[0].fact_occurrence_id, section.proposals[1].fact_occurrence_id);
  assert.equal(section.issues.filter((issue) => issue.code === 'DUPLICATE_FACT_OCCURRENCE').length, 0);
  const again = await compile((span, quote, words) => [
    proposal('p-1', span, quote, [words.slice(1, 4).join(' '), words.slice(4, 6).join(' ')]),
    proposal('p-2', span, quote, [words.slice(6, 8).join(' '), words.slice(8, 10).join(' ')]),
  ]);
  assert.deepEqual(again.proposals.map((item) => item.proposal_id), section.proposals.map((item) => item.proposal_id), 'deterministic');
});

test('two proposals with the same footprint are still a duplicate occurrence and held', async () => {
  const section = await compile((span, quote, words) => [
    proposal('p-1', span, quote, [words.slice(1, 4).join(' '), words.slice(4, 6).join(' ')]),
    proposal('p-2', span, quote, [words.slice(1, 4).join(' '), words.slice(4, 6).join(' ')]),
  ]);
  assert.deepEqual(section.proposals.map((item) => item.validation_status), ['INVALID', 'INVALID']);
  assert.equal(section.issues.filter((issue) => issue.code === 'DUPLICATE_FACT_OCCURRENCE').length, 1);
});
