'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft, normaliseLeanResponse } = require('../lib/product/agreement-draft');
const { compareGenerations, renderGenerationComparison } = require('../lib/product/generation-comparison');
const { REQUEST_PROFILES } = require('../lib/product/product-model-config');
const { createSecIntakeAdapter } = require('../lib/product/sec-intake');
const { substantiveSections } = require('../lib/product/source-context');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

// Plan finding (188), from the first ladder's comparison reports
// (docs/codex-program/notes/ablation-run-1): every held fact read "no
// issue code" because the hold's issue named the proposal by client_ref
// before the proposal had an id. The issue now carries the proposal id
// and the comparison shows the reason. Pinned with the fact the trimmed
// rung lost on NCS 5.17, in its own words, through the pipeline on a
// fixture agreement.

const SENTENCE = 'The Registration Statement (or any prospectus or prospectus supplement forming a part of such Registration Statement), as initially filed, shall include the Registrable Securities of the Specified Stockholders and any permitted transferee thereof and name the Specified Stockholders or any permitted transferees as selling securityholders, subject to receipt of information reasonably requested by Parent necessary to complete such prospectus supplement.';
const SEC_URL = 'https://www.sec.gov/Archives/edgar/data/98246/000119312519299997/d840067dex21.htm';

function agreementHtml() {
  return [
    '<!doctype html><html><head><title>EX-2.1 Agreement and Plan of Merger</title></head><body>',
    '<TYPE data-source="filing">EX-2.1', '<TITLE data-source="filing">Agreement and Plan of Merger', '<DESCRIPTION>Agreement and Plan of Merger', '<FILENAME>d840067dex21.htm',
    '<h1>AGREEMENT AND PLAN OF MERGER</h1>',
    '<p>by and among NCS CORPORATION, a Delaware corporation (the "Company")</p>',
    '<p>BUYER CORPORATION, a Delaware corporation (the "Parent")</p>',
    '<p>MERGER SUB CORPORATION, a Delaware corporation (the "Merger Sub")</p>',
    '<p>Dated as of April 13, 2026</p>',
    '<h2>ARTICLE V</h2><h3>COVENANTS</h3>',
    `<p>Section 5.17. Registration Rights.</p><p>${SENTENCE}</p>`,
    '<h2>ARTICLE VIII</h2><h3>GENERAL PROVISIONS</h3>',
    '<p>Section 8.3. Definitions.</p><p>“Specified Stockholders” means Advent-NCS Acquisition L.P. and its permitted transferees.</p>',
    '</body></html>',
  ].join('\n');
}

async function fixture() {
  const response = new Response(agreementHtml(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  Object.defineProperty(response, 'url', { value: SEC_URL });
  const adapter = createSecIntakeAdapter({ fetchImpl: async () => response, clock: () => new Date('2026-09-04T12:00:00Z') });
  const sourceDocument = await adapter.intake({ url: SEC_URL });
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '5.17');
  assert.ok(node, 'the fixture has 5.17');
  return { sourceDocument, agreementStructure, node };
}

const FAMILY = schemaV2.families.find((item) => item.family_key === 'GENERAL_COVENANTS');
const SUBTYPE = FAMILY.subtypes.find((item) => item.subtype_key === 'GENERAL_NOTIFICATION') || FAMILY.subtypes[0];
const FACT_TYPE = FAMILY.required_fact_types.includes('GENERAL_NOTIFICATION') ? 'GENERAL_NOTIFICATION' : FAMILY.required_fact_types[0];

// The model's answers: the routing to GENERAL_COVENANTS, the residual, and
// the V10 extraction with the fact's own words; `conditionWords` is the
// CONDITION component's quote (the words as the span holds them, or not).
function answers(conditionWords) {
  return {
    ROUTING: (request) => ({ families: ['GENERAL_COVENANTS'], disposition: 'FAMILY_ASSIGNED', rationale: 'Registration covenant.', deterministic_disagreements: (request.deterministic_family_evidence || []).filter((item) => item.section_family !== 'GENERAL_COVENANTS').map((item) => ({ family_key: item.section_family, reason: 'Not this family.' })) }),
    RESIDUAL: (request) => ({ paragraphs: request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['GENERAL_COVENANTS'], rationale: 'Covered.' })) }),
    EXTRACTION: (request) => {
      const operative = request.source_closure.operative[0];
      const allowed = Object.keys(request.response_contract.allowed_fact_types_by_family);
      return {
        proposals: [{
          client_ref: 'p1', group_ref: 'g1', family_key: 'GENERAL_COVENANTS', subtype_key: SUBTYPE.subtype_key, fact_type: FACT_TYPE, statement: SENTENCE,
          headline: { label: 'Registration Statement includes the Specified Stockholders', distinguishing_refs: ['c2'], summary: 'Registration Statement as initially filed includes the Specified Stockholders\' Registrable Securities' },
          components: [
            { ref: 'c1', kind: 'ACTOR', label: 'the Registration Statement', quote: 'The Registration Statement (or any prospectus or prospectus supplement forming a part of such Registration Statement), as initially filed', source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
            { ref: 'c2', kind: 'OPERATION', label: 'must include the Registrable Securities', quote: 'shall include the Registrable Securities of the Specified Stockholders and any permitted transferee thereof', source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] },
            { ref: 'c3', kind: 'CONDITION', label: 'subject to requested information', quote: conditionWords, source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: true, children: [] },
          ],
        }],
        groups: [{ client_ref: 'g1', family_key: 'GENERAL_COVENANTS', subtype_key: SUBTYPE.subtype_key }],
        links: [],
        coverage: Object.fromEntries(allowed.map((key) => [key, key === 'GENERAL_COVENANTS' ? 'FOUND' : 'NOT_FOUND'])),
      };
    },
  };
}

async function run(conditionWords) {
  const { sourceDocument, agreementStructure, node } = await fixture();
  const table = answers(conditionWords);
  const model = { async complete(input) {
    const response = table[input.call_kind](input.request);
    return { provider_id: 'SYNTHETIC', model_id: 'S/V1', raw_request: input.request, raw_response: response, response, input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1 };
  } };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: REQUEST_PROFILES.DEFAULT });
  return { result, node };
}

function analysisOf(result, node, label) {
  return { analysis: { kind: 'draftAnalysis', label, sections: [{ structure_node_id: node.node_id, section_reference: node.reference, families: result.routing.families, disposition: result.routing.disposition }], proposals: result.proposals, spans: result.spans, issues: result.issues, coverage_assertions: result.coverage } };
}

test('the fact in its own words compiles VALID; with one component\'s words read wrong it is held, the hold carries the proposal id, and the comparison names the reason', async () => {
  const good = await run('subject to receipt of information reasonably requested by Parent necessary to complete such prospectus supplement');
  assert.equal(good.result.proposals.length, 1);
  assert.equal(good.result.proposals[0].validation_status, 'VALID', JSON.stringify(good.result.issues.map((issue) => [issue.code, issue.message]).slice(0, 4)));
  const held = await run('subject to receipt of information reasonably requested by the Company');
  assert.equal(held.result.proposals.length, 1);
  assert.equal(held.result.proposals[0].validation_status, 'INVALID');
  const reasons = held.result.issues.filter((issue) => issue.proposal_id === held.result.proposals[0].proposal_id && issue.kind === 'VALIDATION');
  assert.ok(reasons.length > 0, `the hold's issue carries the proposal id: ${JSON.stringify(held.result.issues.map((issue) => [issue.code, Boolean(issue.proposal_id)]))}`);
  const comparison = compareGenerations({ v1: analysisOf(good.result, good.node, 'stored'), v2: analysisOf(held.result, held.node, 'trimmed'), legalSchema: schemaV2 });
  const report = renderGenerationComparison(comparison);
  assert.match(report, /V2 held .* over these bytes \([A-Z_]+/, `the held fact's reason is in the report:\n${report.split('\n').filter((line) => /held/.test(line)).join('\n')}`);
  assert.doesNotMatch(report, /no issue code/);
});

test('the listed-span rule does not touch an own-span component, so it is not what brings the lost 5.17 facts back', async () => {
  const { sourceDocument } = await fixture();
  const own = { span_id: 'o', exact_text: SENTENCE, start_byte: 0, end_byte: 10 };
  const listed = { span_id: 'd', exact_text: '“Specified Stockholders” means Advent-NCS Acquisition L.P.', start_byte: 20, end_byte: 30 };
  const response = answers('subject to receipt of information reasonably requested by the Company').EXTRACTION({ source_closure: { operative: [own] }, response_contract: { allowed_fact_types_by_family: { GENERAL_COVENANTS: [] } } });
  const { response: normalised, stats } = normaliseLeanResponse(response, { anchors: true, sourceDocument, spansById: new Map([['o', own], ['d', listed]]), listedSpanIds: new Set(['d']) });
  assert.equal(stats.listed_spans_resolved, 0);
  assert.equal(normalised.proposals[0].components[2].quote, 'subject to receipt of information reasonably requested by the Company');
});
