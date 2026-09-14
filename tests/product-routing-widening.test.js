'use strict';

// Metsera generation 5 (2026-09-14): the authority representation (3.04)
// was routed IMMATERIAL and the absence-of-changes representation (3.08)
// to INTERIM_OPERATING alone, so neither was extracted as a representation.
// The routing is widened by two facts the code holds: a section under an
// article headed "Representations and Warranties" is routed to
// REPRESENTATIONS, and a family the residual pass names on a paragraph is
// routed. The model's own answer stays on the record.

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft, articleHeading, widenRouting } = require('../lib/product/agreement-draft');
const { substantiveSections } = require('../lib/product/source-context');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { conchoSource } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;
const schema = require('../contracts/product/legal-schema.v2.json');

async function fixture(reference) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const node = substantiveSections(agreementStructure).find((item) => item.reference === reference);
  return { sourceDocument, agreementStructure, node };
}

function model({ routing, residualFamilies }) {
  const requests = [];
  return {
    requests,
    async complete({ call_kind: kind, request }) {
      requests.push({ kind, request });
      let response;
      if (kind === 'ROUTING') response = { ...routing, rationale: 'r', deterministic_disagreements: [] };
      else if (kind === 'RESIDUAL') response = { paragraphs: request.paragraphs.map((paragraph) => ({
        source_span_id: paragraph.source_span_id,
        disposition: residualFamilies.length ? 'KNOWN_FAMILY' : 'IMMATERIAL', family_keys: residualFamilies, rationale: 'c',
      })) };
      else {
        const families = request.family_contracts.map((family) => family.family_key);
        response = {
          proposals: [], groups: [], links: [],
          coverage: Object.fromEntries(families.map((key) => [key, 'NOT_FOUND'])),
          fact_type_coverage: Object.fromEntries(families.map((key) => [key, Object.fromEntries(schema.families.find((family) => family.family_key === key).required_fact_types.map((factType) => [factType, 'NOT_FOUND']))])),
        };
      }
      return { provider_id: 'SYNTHETIC_TEST_PROVIDER', model_id: 'SYNTHETIC_LEGAL_MODEL/V1', raw_request: request, raw_response: response, response, input_tokens: 1, output_tokens: 1, cost_microusd: 1, duration_ms: 1 };
    },
  };
}

test('the article heading names the representations article', async () => {
  const reps = await fixture('4.3');
  assert.match(articleHeading(reps.sourceDocument, reps.agreementStructure, reps.node), /REPRESENTATIONS AND WARRANTIES OF THE COMPANY/);
  const covenant = await fixture('6.3');
  assert.match(articleHeading(covenant.sourceDocument, covenant.agreementStructure, covenant.node), /COVENANTS AND AGREEMENTS/);
});

test('a representation the router calls immaterial is still extracted as a representation', async () => {
  const source = await fixture('4.3');
  const synthetic = model({ routing: { families: [], disposition: 'IMMATERIAL' }, residualFamilies: [] });
  const section = await buildAgreementSectionDraft({ ...source, legalSchema: schema, model: synthetic });
  assert.deepEqual(section.routing.families, ['REPRESENTATIONS']);
  assert.equal(section.routing.disposition, 'FAMILY_ASSIGNED');
  assert.deepEqual(section.routing.model_families, []);
  assert.equal(section.routing.model_disposition, 'IMMATERIAL');
  assert.deepEqual(section.routing.widened_families, [{ family_key: 'REPRESENTATIONS', reason: 'ARTICLE_HEADING' }]);
  const extraction = synthetic.requests.find((item) => item.kind === 'EXTRACTION');
  assert.ok(extraction, 'an extraction call was made');
  assert.deepEqual(extraction.request.family_contracts.map((family) => family.family_key), ['REPRESENTATIONS']);
});

test('a family the residual pass names on a paragraph joins the routed families', async () => {
  const source = await fixture('6.3');
  const synthetic = model({ routing: { families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED' }, residualFamilies: ['GENERAL_COVENANTS'] });
  const section = await buildAgreementSectionDraft({ ...source, legalSchema: schema, model: synthetic });
  assert.deepEqual(section.routing.families, ['GENERAL_COVENANTS', 'NO_SHOP']);
  assert.deepEqual(section.routing.model_families, ['NO_SHOP']);
  assert.deepEqual(section.routing.widened_families, [{ family_key: 'GENERAL_COVENANTS', reason: 'RESIDUAL_PARAGRAPH' }]);
  const extraction = synthetic.requests.find((item) => item.kind === 'EXTRACTION');
  assert.deepEqual(extraction.request.family_contracts.map((family) => family.family_key).sort(), ['GENERAL_COVENANTS', 'NO_SHOP']);
});

test('a routing nothing widens is returned as it was, and widening is deterministic', () => {
  const routing = Object.freeze({ families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', section_routing_id: 'x' });
  assert.equal(widenRouting({ routing, residual: null, heading: 'ARTICLE VI COVENANTS' }), routing);
  const residual = { residualPass: { dispositions: [{ disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP', 'TERMINATION'] }] } };
  const first = widenRouting({ routing, residual, heading: 'ARTICLE VI COVENANTS' });
  const second = widenRouting({ routing, residual, heading: 'ARTICLE VI COVENANTS' });
  assert.deepEqual(first, second);
  assert.deepEqual(first.families, ['NO_SHOP', 'TERMINATION']);
});
