'use strict';

// Work package B5 (plan finding (108)): the pre-intake structure check runs
// the intake's own path (SEC adapter fetch, canonical text, document
// identity, buildAgreementStructure) with no database and no model call,
// and prints the submission fingerprint product_phase1_create_run would
// compute. Pinned here on the Lilly / Verve annex fixture of finding (107)
// served through a fake fetch, and on two fingerprints the preview branch
// stores for real runs.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { checkStructure, jsonbText, renderStructureCheck, submissionFingerprint } = require('../lib/product/structure-check');
const { CLAUDE_CLI_MODEL_CONFIG } = require('../lib/product/product-model-config');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/product/verve-annex-i-boundary.v1.json'), 'utf8'));
const V2 = { schemaVersion: 'LEGAL_SCHEMA/V2', promptBundleVersion: 'PRODUCT_LAYERED_COMPONENTS/V9' };

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A synthetic main agreement (identity header, three articles) followed by
// the exhibit's own bytes from the last signature page into Annex I.
function verveHtml() {
  const mainLines = [
    'AGREEMENT AND PLAN OF MERGER',
    'by and among ELI LILLY AND COMPANY, an Indiana corporation ("Parent"),',
    'RIDGEWAY ACQUISITION CORPORATION, a Delaware corporation ("Purchaser"),',
    'and VERVE THERAPEUTICS, INC., a Delaware corporation (the "Company")',
    'Dated as of June 16, 2025',
    'ARTICLE I', 'THE OFFER',
    'Section 1.1. The Offer.',
    '(a) Commencement of the Offer. Purchaser shall commence the Offer.',
    '(b) Terms and Conditions of the Offer. The Offer is subject to the conditions set forth in Annex I.',
    'ARTICLE II', 'THE MERGER',
    'Section 2.1. The Merger.', 'Purchaser shall be merged with and into the Company.',
    'ARTICLE IX', 'GENERAL PROVISIONS',
    'Section 9.1. Non-Survival of Representations and Warranties.',
    'The representations and warranties shall not survive the Effective Time.',
    'Section 9.2. Counterparts.', 'This Agreement may be executed in counterparts.',
  ];
  return [
    '<!doctype html><html><head><title>EX-2.1 Agreement and Plan of Merger</title></head><body>',
    '<TYPE>EX-2.1', '<DESCRIPTION>Agreement and Plan of Merger', '<FILENAME>d30505dex21.htm',
    ...mainLines.map((line) => `<p>${escapeHtml(line)}</p>`),
    ...FIXTURE.excerpt.split('\n').map((line) => `<p>${escapeHtml(line)}</p>`),
    '</body></html>',
  ].join('\n');
}

function fetchServing(html, { status = 200, url = FIXTURE.retrieval_url } = {}) {
  return async () => {
    const response = new Response(html, { status, headers: { 'content-type': 'text/html' } });
    Object.defineProperty(response, 'url', { value: url });
    return response;
  };
}

test('jsonbText renders as Postgres jsonb::text does: keys by length then bytes, ", " and ": " separators', () => {
  // Values read back from `select $1::jsonb::text` on Postgres 17.
  assert.equal(
    jsonbText({ provider_id: 'ANTHROPIC', model_id: 'claude-sonnet-4-5-20250929', temperature: 0, routing_max_tokens: 1200, extraction_max_tokens: 12000 }),
    '{"model_id": "claude-sonnet-4-5-20250929", "provider_id": "ANTHROPIC", "temperature": 0, "routing_max_tokens": 1200, "extraction_max_tokens": 12000}',
  );
  assert.equal(
    jsonbText({ z: { bb: 1, a: [1, 2.5, 'x', null, true, { k: 'v' }] }, aa: 'é"q\\\\', b: 1.0e3, n: -0.5 }),
    '{"b": 1000, "n": -0.5, "z": {"a": [1, 2.5, "x", null, true, {"k": "v"}], "bb": 1}, "aa": "é\\"q\\\\\\\\"}',
  );
  assert.equal(
    jsonbText(CLAUDE_CLI_MODEL_CONFIG),
    '{"tools": "none", "model_id": "PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V1", "provider_id": "ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION", "model_selection": "CALL_KIND", "setting_sources": "none", "call_kind_models": {"ROUTING": {"model": "claude-opus-5", "effort": "low"}, "RESIDUAL": {"model": "claude-opus-5", "effort": "low"}, "EXTRACTION": {"model": "claude-opus-5", "effort": "high"}}, "session_persistence": false, "tool_policy_version": "PRODUCT_CLAUDE_CLI_TOOLLESS/V1", "max_attempts_per_call": 1, "child_environment_policy": "PRODUCT_CLAUDE_CLI_ENV_ALLOWLIST/V1", "marginal_api_cost_microusd": 0}',
  );
});

test('submissionFingerprint reproduces the fingerprints the preview branch stores for real runs', () => {
  // product_analysis_runs on the preview branch (ecrtoofsyxozazkvsvcl), read
  // 2026-10-18: Metsera generation 8 (run 72d94dd2) and NCS generation 5
  // (run 51577c57), each with the model_config the run carries.
  assert.equal(submissionFingerprint({
    sourceDocumentId: '64c6f8285125eb169ebc72ba3bf1f1e1346aa0bdb9c1f095b7782bff6a2a4c03',
    schemaVersion: 'LEGAL_SCHEMA/V2', promptBundleVersion: 'PRODUCT_LAYERED_COMPONENTS/V9',
    modelConfig: CLAUDE_CLI_MODEL_CONFIG, explicitGeneration: 7, maxAttempts: 3,
  }), 'd640417c21ca812f28a6c677a28e8b10441f6267833ea766998935f5dbbee5aa');
  assert.equal(submissionFingerprint({
    sourceDocumentId: 'e1414a2d76fe13e31522a75f0fa237c315394ec1b4d5099883696b572e365d80',
    schemaVersion: 'LEGAL_SCHEMA/V2', promptBundleVersion: 'PRODUCT_LAYERED_COMPONENTS/V9',
    modelConfig: {
      tools: 'none', model_id: 'PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V1', thinking: 'adaptive', provider_id: 'ANTHROPIC_API',
      billing_basis: 'ANTHROPIC_API_METERED', model_selection: 'CALL_KIND',
      call_kind_models: { ROUTING: { model: 'claude-opus-5', effort: 'low' }, RESIDUAL: { model: 'claude-opus-5', effort: 'low' }, EXTRACTION: { model: 'claude-opus-5', effort: 'high' } },
      max_output_tokens: 64000, max_attempts_per_call: 1,
    },
    explicitGeneration: 4, maxAttempts: 3,
  }), '53ec5685b25714f07be5d6084c496c6be334c034637b80ee710871d5739f5713');
  assert.throws(() => submissionFingerprint({ sourceDocumentId: 'x', schemaVersion: 'LEGAL_SCHEMA/V2', promptBundleVersion: 'P', modelConfig: {}, explicitGeneration: -1 }), /explicitGeneration/);
});

test('the check runs the intake path on the Verve annex fixture and reports boundaries, identity and fingerprint', async () => {
  const report = await checkStructure({
    url: FIXTURE.retrieval_url, fetchImpl: fetchServing(verveHtml()), clock: () => new Date('2026-10-19T00:00:00Z'),
    modelConfig: CLAUDE_CLI_MODEL_CONFIG, submissionVersion: V2,
  });
  assert.equal(report.ok, true);
  assert.equal(report.stage, 'STRUCTURE');
  assert.equal(report.identity.status, 'CONFIRMED');
  assert.deepEqual(report.identity.reasons, []);
  assert.equal(report.identity.exhibit_type, 'EX-2.1');
  assert.equal(report.identity.agreement_date, '2025-06-16');
  assert.deepEqual(report.identity.parties.map((party) => party.role), ['PARENT', 'PURCHASER', 'COMPANY']);
  assert.equal(report.source.exhibit_filename, 'd30505dex21.htm');
  assert.equal(report.source.filing_accession, '0001193125-25-141748');
  assert.match(report.source.source_document_id, /^[0-9a-f]{64}$/);
  assert.equal(report.submission.schema_version, 'LEGAL_SCHEMA/V2');
  assert.equal(report.submission.provider_id, 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION');
  assert.equal(report.submission.fingerprint, submissionFingerprint({
    sourceDocumentId: report.source.source_document_id, schemaVersion: V2.schemaVersion, promptBundleVersion: V2.promptBundleVersion,
    modelConfig: CLAUDE_CLI_MODEL_CONFIG, explicitGeneration: 0, maxAttempts: 3,
  }));
  const { structure } = report;
  assert.equal(structure.node_count, 13);
  assert.deepEqual(structure.counts, { AGREEMENT: 1, ARTICLE: 3, SECTION: 5, LIMB: 4 });
  assert.deepEqual(structure.articles.map((article) => article.reference), ['ARTICLE I', 'ARTICLE II', 'ARTICLE IX']);
  assert.equal(structure.annexes.length, 1);
  const [annex] = structure.annexes;
  assert.equal(annex.reference, 'Annex-I');
  assert.equal(annex.parent, 'AGREEMENT');
  assert.equal(annex.children, 2);
  assert.equal(structure.last_article_end_byte, annex.start_byte, 'the last article ends where the annex begins');
  assert.equal(annex.end_byte, report.source.canonical_text_byte_length);
  assert.deepEqual(structure.nodes_outside_parent, []);
  const rendered = renderStructureCheck(report);
  assert.match(rendered, /identity: CONFIRMED; EX-2\.1, dated 2025-06-16, original/);
  assert.match(rendered, /structure: 13 nodes \(1 AGREEMENT, 3 ARTICLE, 5 SECTION, 4 LIMB\)/);
  assert.match(rendered, new RegExp(`ARTICLE IX \\[\\d+, ${annex.start_byte}\\) 2 children`));
  assert.match(rendered, new RegExp(`Annex-I \\(SECTION\\) \\[${annex.start_byte}, ${annex.end_byte}\\) 2 children`));
  assert.match(rendered, new RegExp(`fingerprint: ${report.submission.fingerprint}`));
  assert.match(rendered, /ok in \d+ ms/);
});

test('an intake refusal is reported as the intake stage and a structure failure as the structure stage, neither thrown', async () => {
  const refused = await checkStructure({ url: FIXTURE.retrieval_url, fetchImpl: fetchServing(verveHtml(), { status: 404 }), modelConfig: CLAUDE_CLI_MODEL_CONFIG, submissionVersion: V2 });
  assert.equal(refused.ok, false);
  assert.equal(refused.stage, 'INTAKE');
  assert.equal(refused.error.code, 'HTTP_STATUS_REJECTED');
  assert.match(renderStructureCheck(refused), /intake failed: HTTP_STATUS_REJECTED/);

  // A body of whitespace only: the adapter accepts it (identity NEEDS_REVIEW
  // on every reason) and the structure builder refuses the empty canonical
  // text, reported as the structure stage.
  const blank = await checkStructure({ url: FIXTURE.retrieval_url, fetchImpl: fetchServing('<html><body><p>&nbsp;</p></body></html>'), modelConfig: CLAUDE_CLI_MODEL_CONFIG, submissionVersion: V2 });
  assert.equal(blank.ok, false);
  assert.equal(blank.stage, 'STRUCTURE');
  assert.equal(blank.error.code, 'STRUCTURE_SOURCE');
  assert.equal(blank.identity.status, 'NEEDS_REVIEW');
  assert.deepEqual(blank.identity.reasons, ['EXHIBIT_UNCONFIRMED', 'PARTIES_UNCONFIRMED', 'AGREEMENT_DATE_UNCONFIRMED', 'REVISION_UNCONFIRMED', 'DOCUMENT_INCOMPLETE']);
  assert.match(renderStructureCheck(blank), /structure failed: STRUCTURE_SOURCE/);
});
