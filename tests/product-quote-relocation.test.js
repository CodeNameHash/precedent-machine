'use strict';

// Metsera generation 5, 2026-09-14: a verbatim quote cited on a sibling
// limb's span, or with an occurrence index past the last occurrence, is
// found in the section and the component keeps its bytes; the correction
// is recorded on the evidence context.

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft } = require('../lib/product/agreement-draft');
const { buildSourceClosure, substantiveSections } = require('../lib/product/source-context');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { conchoSource } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;
// Components compile only under the V2 schema.
const schema = require('../contracts/product/legal-schema.v2.json');

test('a quote from a sibling span and an occurrence past the end both resolve to bytes', async () => {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const closure = buildSourceClosure({ sourceDocument, agreementStructure, nodeId: node.node_id });
  const spans = closure.spans.filter((span) => span.kind === 'OPERATIVE');
  const wordsOf = (span) => span.exact_text.split(/\s+/).filter(Boolean);
  // A run of words of the second limb that appears nowhere else in the section.
  const sectionText = closure.spans.find((span) => span.span_id === closure.full_section_span_id).exact_text;
  const words = wordsOf(spans[1]);
  let secondWords = null;
  for (let start = 0; start < words.length - 8 && !secondWords; start += 1) {
    const candidate = words.slice(start, start + 8).join(' ');
    if (spans[1].exact_text.includes(candidate) && sectionText.indexOf(candidate) === sectionText.lastIndexOf(candidate) && !spans[0].exact_text.includes(candidate)) secondWords = candidate;
  }
  assert.ok(secondWords, 'a unique run of words in the second limb');
  const secondQuote = secondWords;
  const firstWords = wordsOf(spans[0]).slice(2, 7).join(' ');
  const firstQuote = spans[0].exact_text.slice(spans[0].exact_text.indexOf(firstWords), spans[0].exact_text.indexOf(firstWords) + firstWords.length);
  const model = {
    async complete({ call_kind: kind, request }) {
      let response;
      if (kind === 'ROUTING') response = { families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'r', deterministic_disagreements: [] };
      else if (kind === 'RESIDUAL') response = { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'], rationale: 'c' })) };
      else {
        response = {
          proposals: [{
            client_ref: 'p-1', group_ref: 'g-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', fact_type: 'PROHIBITED_ACTION',
            statement: 'x', roles: { covenant_obligor: 'Company', prohibited_action: firstQuote }, value: null,
            evidence_quotes: [{ quote: firstQuote, source_span_id: spans[0].span_id, occurrence: 0 }],
            headline: { label: 'Prohibition', distinguishing_refs: ['c1'] },
            components: [
              // the first limb's words, cited with an occurrence past the last one
              { ref: 'c1', kind: 'OPERATION', label: 'op', quote: firstQuote, source_span_id: spans[0].span_id, occurrence: 7, origin: 'OWN', gap_before: false, children: [] },
              // the second limb's words, cited on the first limb's span
              { ref: 'c2', kind: 'OBJECT', label: 'obj', quote: secondQuote, source_span_id: spans[0].span_id, occurrence: 0, origin: 'OWN', gap_before: true, children: [] },
              // the second limb's words, cited on a span id that is in no
              // closure (Metsera generation 6, 7.01: the stockholder
              // approval condition was INVALID on a mistyped id)
              { ref: 'c3', kind: 'QUALIFIER', label: 'q', quote: secondQuote, source_span_id: 'f'.repeat(64), occurrence: 0, origin: 'OWN', gap_before: true, children: [] },
            ],
          }],
          groups: [{ client_ref: 'g-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION' }],
          links: [],
          coverage: { NO_SHOP: 'FOUND' },
          fact_type_coverage: { NO_SHOP: Object.fromEntries(schema.families.find((family) => family.family_key === 'NO_SHOP').required_fact_types.map((factType) => [factType, factType === 'PROHIBITED_ACTION' ? 'FOUND' : 'NOT_FOUND'])) },
        };
      }
      return { provider_id: 'SYNTHETIC_TEST_PROVIDER', model_id: 'SYNTHETIC_LEGAL_MODEL/V1', raw_request: request, raw_response: response, response, input_tokens: 1, output_tokens: 1, cost_microusd: 1, duration_ms: 1 };
    },
  };
  const section = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schema, model, node });
  const proposal = section.proposals[0];
  assert.equal(proposal.validation_status, 'VALID', JSON.stringify(section.issues.map((issue) => issue.payload?.message || issue.message).slice(0, 3)));
  const [first, second, third] = proposal.components;
  assert.ok(Number.isSafeInteger(third.start_byte) && third.start_byte === second.start_byte && third.end_byte === second.end_byte, 'an unknown span id resolves against the section');
  assert.ok(Number.isSafeInteger(first.start_byte) && first.start_byte >= spans[0].start_byte && first.end_byte <= spans[0].end_byte);
  assert.ok(Number.isSafeInteger(second.start_byte) && second.start_byte >= spans[1].start_byte && second.end_byte <= spans[1].end_byte, 'relocated into the sibling limb');
});
