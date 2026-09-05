'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const phase2Database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { CONCHO_URL, conchoSource, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { createCodexCliProductModel } = require('../lib/product/codex-cli-model');
const { ProductPhase2Store } = require('../lib/product/phase-2-store');

test.before(phase2Database.setupDatabase);
test.after(phase2Database.teardownDatabase);

test('malformed completed provider replies persist once for each failed section attempt', async () => {
  const client = phase2Database.getDatabaseClient();
  const store = new ProductPhase2Store({ client: phase2Database.databaseFacade() });
  const sourceDocument = await conchoSource();
  const structure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  await store.persistSourceDocument(sourceDocument);
  const run = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'provider-response-durability-v1',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PROVIDER_RESPONSE_DURABILITY/V1',
    modelConfig: { provider: 'OPENAI_CODEX_CLI_SUBSCRIPTION', model: 'MALFORMED_COMPLETED_TEST/V1' },
    explicitGeneration: 41,
    maxAttempts: 3,
  });
  await store.attachStructure({ runId: run.run_id, structure });
  const envelope = {
    codex_completion: { status: 'COMPLETE', terminal_event: 'turn.completed' },
    content: [{ type: 'text', text: '{not-json' }],
    usage: { input_tokens: 17, cached_input_tokens: 0, output_tokens: 4, reasoning_output_tokens: 0 },
  };
  const model = createCodexCliProductModel({
    client: { messages: { create: async () => structuredClone(envelope) } },
  });

  await assert.rejects(() => runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model, workerId: 'malformed-provider-test',
  }), /CODEX_PRODUCT_JSON/);
  let rows = (await client.query(`SELECT * FROM public.product_model_calls
    WHERE run_id=$1 ORDER BY created_at,model_call_id`, [run.run_id])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].response.status, 'LOCAL_VALIDATION_FAILED');
  assert.deepEqual(rows[0].response.raw_response, envelope);
  assert.deepEqual(rows[0].response.usage, { status: 'KNOWN', input_tokens: 17, output_tokens: 4 });

  await assert.rejects(() => runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model, workerId: 'malformed-provider-test',
  }), /CODEX_PRODUCT_JSON/);
  rows = (await client.query(`SELECT * FROM public.product_model_calls
    WHERE run_id=$1 ORDER BY created_at,model_call_id`, [run.run_id])).rows;
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.invocation_id)).size, 2);
  assert.equal(new Set(rows.map((row) => row.model_call_id)).size, 2);
  assert.equal(rows.every((row) => row.response.status === 'LOCAL_VALIDATION_FAILED'), true);
  assert.deepEqual(rows[0].request, rows[1].request);
  assert.deepEqual(rows[0].response.raw_response, rows[1].response.raw_response);
});
