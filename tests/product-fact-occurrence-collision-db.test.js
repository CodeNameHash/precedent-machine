'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const {
  databaseFacade, getDatabaseClient, setupDatabase, teardownDatabase,
} = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;
const { compileCollisionFixture } = require('./product-fact-occurrence-collision.test');
const { ProductPhase2Store } = require('../lib/product/phase-2-store');

test.before(setupDatabase);
test.after(teardownDatabase);

test('collided candidates persist atomically without a section retry', async () => {
  const { sourceDocument, agreementStructure, result } = await compileCollisionFixture();
  const store = new ProductPhase2Store({ client: databaseFacade() });
  await store.persistSourceDocument(sourceDocument);
  const run = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: sourceDocument.retrieval_url,
    idempotencyKey: 'fact-occurrence-collision-persistence',
    schemaVersion: 'LEGAL_SCHEMA/V1',
    promptBundleVersion: 'PRODUCT_PROMPT_BUNDLE/V1',
    modelConfig: { provider_id: 'TEST' },
  });
  await store.attachStructure({ runId: run.run_id, structure: agreementStructure });
  const claim = await store.claimNextSection({ runId: run.run_id, workerId: 'collision-db-test' });
  await store.commitSection({
    runId: run.run_id, nodeId: claim.node_id, workerId: 'collision-db-test',
    attemptToken: claim.attempt_token, result,
  });

  const database = getDatabaseClient();
  const work = (await database.query(
    'SELECT status,attempts FROM public.product_section_work WHERE run_id=$1 AND node_id=$2',
    [run.run_id, claim.node_id],
  )).rows[0];
  assert.deepEqual(work, { status: 'COMPLETE', attempts: 1 });
  const proposals = (await database.query(
    'SELECT fact_occurrence_id,validation_status FROM public.product_proposals WHERE run_id=$1',
    [run.run_id],
  )).rows;
  assert.equal(proposals.length, 8);
  assert.equal(new Set(proposals.map((item) => item.fact_occurrence_id)).size, 8);
  assert.equal(proposals.filter((item) => item.validation_status === 'INVALID').length, 7);
  const issues = (await database.query(
    "SELECT payload FROM public.product_issues WHERE run_id=$1 AND payload->>'code'='DUPLICATE_FACT_OCCURRENCE'",
    [run.run_id],
  )).rows;
  assert.equal(issues.length, 3);
  assert.equal(issues.every((item) => JSON.parse(item.payload.message).shared_fact_occurrence_id), true);
});
