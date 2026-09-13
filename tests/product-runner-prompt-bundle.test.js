'use strict';

// The runner hands the table shapes to every section of a run whose recorded
// prompt bundle is PRODUCT_LAYERED_COMPONENTS/V9, so the extractor sends the
// V9 prompt (table_shapes + conclusion_instruction). Earlier bundles get no
// shapes and their prompts are unchanged. Metsera run c4c90c61 (2026-09-13)
// went out as V8 under a V9 bundle before this test existed.

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { advanceAgreementDraftAnalysis, tableShapesForRun, CONCLUSIONS_PROMPT_BUNDLE } = require('../lib/product/analysis-runner');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { substantiveSections } = require('../lib/product/source-context');
const legalSchemaV2 = require('../contracts/product/legal-schema.v2.json');
const tableShapes = require('../contracts/product/table-shapes.v3.json');

const sha = (value) => createHash('sha256').update(value).digest('hex');

function fixture() {
  const canonicalText = ['ARTICLE III', 'TREATMENT OF EQUITY AWARDS', 'Section 3.2 RSUs. Each restricted stock unit shall be converted into the right to receive one share of Parent common stock and shall continue vesting on its existing schedule.'].join('\n\n');
  const id = sha(canonicalText);
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: id, agreement_id: id,
    canonical_text: canonicalText, canonical_text_sha256: id,
    retrieval_url: 'https://example.test/equity.htm', final_url: 'https://example.test/equity.htm', source_map_id: id,
    filing_accession: '0000000000-00-000000', exhibit_filename: 'equity.htm',
  };
  const agreementStructure = buildAgreementStructure({ agreement_id: id, canonical_text: canonicalText, canonical_text_sha256: id });
  return { sourceDocument, agreementStructure, node: substantiveSections(agreementStructure)[0] };
}

function stubStore(promptBundleVersion, { sourceDocument, agreementStructure, node }) {
  let claimed = false;
  return {
    async getRunContext() { return { run: { prompt_bundle_version: promptBundleVersion }, sourceDocument, agreementStructure }; },
    async claimNextSection() { if (claimed) return null; claimed = true; return { node_id: node.node_id, attempt_token: 'attempt-1' }; },
    async renewSectionLease() {},
    async completeSection() {},
    async commitSection() {},
    async failSection() {},
    async getProgress() { return { completed: 0, total: 1 }; },
    async getAgreementAnalysis() { return { status: 'RUNNING' }; },
  };
}

function capturingModel(calls) {
  return {
    async complete({ call_kind: kind, prompt_version: promptVersion, request }) {
      calls.push({ kind, promptVersion, request });
      const response = kind === 'ROUTING'
        ? { families: ['CONSIDERATION'], disposition: 'FAMILY_ASSIGNED', rationale: 'RSU treatment', deterministic_disagreements: [] }
        : kind === 'RESIDUAL'
          ? { paragraphs: request.paragraphs.map((p) => ({ source_span_id: p.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['CONSIDERATION'], rationale: 'RSU treatment' })) }
          : { proposals: [], groups: [], links: [], coverage: { CONSIDERATION: 'NOT_FOUND' }, fact_type_coverage: { CONSIDERATION: Object.fromEntries(request.family_contracts[0].required_fact_types.map((type) => [type, 'NOT_FOUND'])) } };
      return { provider_id: 'TEST', model_id: 'TEST', response, raw_request: request, raw_response: response, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1 };
    },
  };
}

test('tableShapesForRun follows the run’s recorded prompt bundle', () => {
  assert.equal(tableShapesForRun({ prompt_bundle_version: CONCLUSIONS_PROMPT_BUNDLE }), tableShapes);
  assert.equal(tableShapesForRun({ prompt_bundle_version: 'PRODUCT_LAYERED_COMPONENTS/V8' }), null);
  assert.equal(tableShapesForRun(null), null);
});

test('a V9 run sends the V9 extractor prompt with table shapes for the routed family', async () => {
  const calls = [];
  await advanceAgreementDraftAnalysis({
    runId: '00000000-0000-4000-8000-000000000001', store: stubStore(CONCLUSIONS_PROMPT_BUNDLE, fixture()),
    legalSchema: legalSchemaV2, model: capturingModel(calls), leaseSeconds: 60,
  });
  const extraction = calls.find((call) => call.kind === 'EXTRACTION');
  assert.ok(extraction, 'an extraction call was made');
  assert.equal(extraction.promptVersion, 'PRODUCT_ALL_FAMILY_EXTRACTOR/V9');
  assert.ok(extraction.request.table_shapes.CONSIDERATION, 'table shapes for the routed family are in the request');
  assert.match(extraction.request.conclusion_instruction, /conclusions/);
});

test('a V8 run keeps the V8 extractor prompt with no table shapes', async () => {
  const calls = [];
  await advanceAgreementDraftAnalysis({
    runId: '00000000-0000-4000-8000-000000000002', store: stubStore('PRODUCT_LAYERED_COMPONENTS/V8', fixture()),
    legalSchema: legalSchemaV2, model: capturingModel(calls), leaseSeconds: 60,
  });
  const extraction = calls.find((call) => call.kind === 'EXTRACTION');
  assert.equal(extraction.promptVersion, 'PRODUCT_ALL_FAMILY_EXTRACTOR/V8');
  assert.equal('table_shapes' in extraction.request, false);
});
