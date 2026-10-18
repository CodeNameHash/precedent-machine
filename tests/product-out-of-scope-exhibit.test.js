'use strict';

// Work package 18 (e) as revised (manager, 2026-10-18 20:48; plan finding
// (123)): an exhibit that is a separate agreement is out of this product's
// scope. Ben: "For CVRs - I want to build a separate product for that os I'd
// leave those". The source is the Metsera filing as fetched, whose Exhibit B
// is the Form of CVR Agreement.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft, outOfScopeExhibit } = require('../lib/product/agreement-draft');
const { createSecIntakeAdapter } = require('../lib/product/sec-intake');

const ROOT = path.resolve(__dirname, '..');
const METSERA_URL = 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm';
const legalSchema = require('../contracts/product/legal-schema.v2.json');

async function metseraSource() {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm'));
  const fetchImpl = async () => ({
    status: 200,
    url: METSERA_URL,
    headers: new Headers({ 'content-type': 'text/html', 'content-length': String(raw.length) }),
    body: null,
    arrayBuffer: async () => raw,
  });
  return createSecIntakeAdapter({ fetchImpl, clock: () => new Date('2026-10-18T12:00:00Z') }).intake({ url: METSERA_URL });
}

test('the Form of CVR Agreement exhibit is out of scope: one note, its families NOT_FOUND, no extraction call; the certificate exhibit and a main section are not', async () => {
  const sourceDocument = await metseraSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const exhibitB = agreementStructure.nodes.find((node) => node.reference === 'Exhibit-B');
  const exhibitA = agreementStructure.nodes.find((node) => node.reference === 'Exhibit-A');
  const section = agreementStructure.nodes.find((node) => node.reference === '6.03');
  assert.ok(exhibitB && exhibitA && section);
  const detected = outOfScopeExhibit(sourceDocument, exhibitB);
  assert.equal(detected.title, 'Form of CVR Agreement');
  assert.ok(detected.own_headings >= 30, `the CVR Agreement's own sections: ${detected.own_headings}`);
  assert.equal(outOfScopeExhibit(sourceDocument, exhibitA), null, 'the Certificate of Incorporation exhibit is no agreement');
  assert.equal(outOfScopeExhibit(sourceDocument, section), null, 'a section of the agreement is never out of scope');

  const calls = [];
  const routed = ['CONSIDERATION', 'KEY_DEFINED_TERMS', 'TERMINATION'];
  const model = {
    async complete({ call_kind: kind, request }) {
      calls.push(kind);
      let response;
      if (kind === 'ROUTING') response = { families: routed, disposition: 'FAMILY_ASSIGNED', rationale: 'Form CVR Agreement', deterministic_disagreements: [] };
      else if (kind === 'RESIDUAL') response = { paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['CONSIDERATION'], rationale: 'r' })) };
      else throw new Error(`no extraction call for an out-of-scope exhibit: ${kind}`);
      return { provider_id: 'SYNTHETIC_TEST_PROVIDER', model_id: 'SYNTHETIC_LEGAL_MODEL/V1', raw_request: request, raw_response: response, response, input_tokens: 1, output_tokens: 1, cost_microusd: 1, duration_ms: 1 };
    },
  };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema, model, node: exhibitB });
  assert.deepEqual(calls.sort(), ['RESIDUAL', 'ROUTING'], 'routing and the residual pass only');
  assert.equal(result.proposals.length, 0);
  assert.deepEqual(result.issues.map((issue) => [issue.kind, issue.code]), [['NOTE', 'OUT_OF_SCOPE_EXHIBIT']]);
  const message = JSON.parse(result.issues[0].message);
  assert.equal(message.section_reference, 'Exhibit-B');
  assert.equal(message.title, 'Form of CVR Agreement');
  assert.deepEqual(message.routed_families, routed);
  assert.equal(result.issues[0].structure_node_id, exhibitB.node_id);
  assert.equal(result.coverage.some((assertion) => assertion.state === 'UNRESOLVED'), false, 'nothing is unresolved');
  const factTypes = result.coverage.filter((assertion) => assertion.subject_kind === 'FACT_TYPE');
  assert.ok(factTypes.length > 0 && factTypes.every((assertion) => assertion.state === 'NOT_FOUND' && routed.includes(assertion.family_key)), 'the routed families\' fact types are NOT_FOUND');
  assert.equal(result.coverage.find((assertion) => assertion.subject_kind === 'SECTION').state, 'NOT_FOUND');
  assert.deepEqual(result.routing.families, routed, 'the routing stays as evidence of what the exhibit holds');
});
