'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const {
  databaseFacade, getDatabaseClient, runPhase2DatabaseTest, runScopedWorkSetTest, setupDatabase, teardownDatabase,
} = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;
const { ProductPhase2Store } = require('../lib/product/phase-2-store');

const migration = fs.readFileSync(path.resolve(
  __dirname, '../supabase/migrations/20260905213000_product_monotonic_failed_section_status.sql',
), 'utf8');

let sequence = 0;

function modelCall(claim, kind, inputTokens, outputTokens, costMicrousd) {
  const invocationId = crypto.createHash('sha256').update([
    'PRODUCT_MODEL_INVOCATION/V1', claim.attempt_token, kind,
  ].join(String.fromCharCode(31))).digest('hex');
  return {
    schema_version: 'PRODUCT_MODEL_CALL/V1',
    model_call_id: crypto.createHash('sha256').update(`${invocationId}:call`).digest('hex'),
    invocation_id: invocationId,
    structure_node_id: claim.node_id,
    call_kind: kind,
    prompt_version: 'RACE_TEST/V1',
    provider_id: 'test',
    model_id: 'test-model',
    request: { node_id: claim.node_id },
    response: { failed: true },
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_microusd: costMicrousd,
    duration_ms: 7,
  };
}

async function createTwoSectionRun() {
  sequence += 1;
  const client = getDatabaseClient();
  const sourceId = crypto.createHash('sha256').update(`monotonic-source-${sequence}`).digest('hex');
  const idempotencyKey = `monotonic-run-${sequence}`;
  await client.query(`INSERT INTO public.product_source_documents(
    source_document_id, retrieval_url, raw_sha256, payload, payload_sha256
  ) VALUES ($1,$2,$1,$3,$1)`, [
    sourceId, `https://example.test/${sequence}`, { canonical_text: 'A\nB' },
  ]);
  const run = (await client.query(`INSERT INTO public.product_analysis_runs(
    source_document_id, retrieval_url, idempotency_key, submission_fingerprint,
    schema_version, prompt_bundle_version, model_config, explicit_generation,
    source_generation, max_attempts, status, stage
  ) VALUES ($1,$2,$3,$4,'LEGAL_SCHEMA/V1','PROMPT/V1','{}'::jsonb,0,1,3,'QUEUED','SECTION_ANALYSIS')
  RETURNING *`, [sourceId, `https://example.test/${sequence}`, idempotencyKey, `${idempotencyKey}-fingerprint`])).rows[0];
  await client.query(`INSERT INTO public.product_section_work(run_id,node_id,authored_order,attempts,max_attempts)
    VALUES ($1,'section-a',1,2,3),($1,'section-b',2,0,3)`, [run.run_id]);
  const store = new ProductPhase2Store({ client: databaseFacade() });
  const claimA = await store.claimNextSection({ runId: run.run_id, workerId: `worker-a-${sequence}` });
  const claimB = await store.claimNextSection({ runId: run.run_id, workerId: `worker-b-${sequence}` });
  assert.equal(claimA.node_id, 'section-a');
  assert.equal(claimA.attempts, 3);
  assert.equal(claimB.node_id, 'section-b');
  assert.equal(claimB.attempts, 1);
  assert.equal(await store.claimNextSection({ runId: run.run_id, workerId: `worker-c-${sequence}` }), null);
  return { client, store, runId: run.run_id, claimA, claimB };
}

async function runState(client, runId) {
  return (await client.query(
    'SELECT status,stage,error FROM public.product_analysis_runs WHERE run_id=$1', [runId],
  )).rows[0];
}

test.before(async () => {
  await setupDatabase();
  if (process.env.PRODUCT_MONOTONIC_SKIP_MIGRATION !== '1') {
    const client = getDatabaseClient();
    if (typeof client.exec === 'function') await client.exec(migration);
    else await client.query(migration);
  }
});
test.after(teardownDatabase);

test('an exhausted failure remains authoritative after a later retryable failure and duplicate delivery', async () => {
  const { client, store, runId, claimA, claimB } = await createTwoSectionRun();
  const callA = modelCall(claimA, 'EXTRACTION', 11, 3, 101);
  const callB = modelCall(claimB, 'ROUTING', 7, 2, 43);
  await store.failSection({
    runId, nodeId: claimA.node_id, workerId: claimA.worker_id,
    attemptToken: claimA.attempt_token, error: new Error('exhausted-a'), modelCalls: [callA],
  });
  await store.failSection({
    runId, nodeId: claimB.node_id, workerId: claimB.worker_id,
    attemptToken: claimB.attempt_token, error: new Error('retryable-b'), modelCalls: [callB],
  });
  await store.failSection({
    runId, nodeId: claimB.node_id, workerId: claimB.worker_id,
    attemptToken: claimB.attempt_token, error: new Error('retryable-b'), modelCalls: [callB],
  });
  assert.deepEqual(await runState(client, runId), {
    status: 'FAILED', stage: 'SECTION_ANALYSIS', error: { message: 'exhausted-a' },
  });
  const accounting = (await client.query(`SELECT count(*) AS calls, sum(input_tokens) AS input_tokens,
    sum(output_tokens) AS output_tokens, sum(cost_microusd) AS cost_microusd
    FROM public.product_model_calls WHERE run_id=$1`, [runId])).rows[0];
  assert.deepEqual(accounting, { calls: 2, input_tokens: '18', output_tokens: '5', cost_microusd: '144' });
});

test('an exhausted failure remains authoritative after a later completion and duplicate delivery', async () => {
  const { client, store, runId, claimA, claimB } = await createTwoSectionRun();
  const callA = modelCall(claimA, 'EXTRACTION', 13, 5, 89);
  await store.failSection({
    runId, nodeId: claimA.node_id, workerId: claimA.worker_id,
    attemptToken: claimA.attempt_token, error: new Error('exhausted-a'), modelCalls: [callA],
  });
  await store.completeSection({
    runId, nodeId: claimB.node_id, workerId: claimB.worker_id, attemptToken: claimB.attempt_token,
    costMicrousd: 37, inputTokens: 17, outputTokens: 4,
  });
  await store.completeSection({
    runId, nodeId: claimB.node_id, workerId: claimB.worker_id, attemptToken: claimB.attempt_token,
    costMicrousd: 37, inputTokens: 17, outputTokens: 4,
  });
  assert.deepEqual(await runState(client, runId), {
    status: 'FAILED', stage: 'SECTION_ANALYSIS', error: { message: 'exhausted-a' },
  });
  const sectionB = (await client.query(`SELECT status,cost_microusd,input_tokens,output_tokens
    FROM public.product_section_work WHERE run_id=$1 AND node_id='section-b'`, [runId])).rows[0];
  assert.deepEqual(sectionB, { status: 'COMPLETE', cost_microusd: 37, input_tokens: 17, output_tokens: 4 });
  const calls = (await client.query(
    'SELECT count(*) AS count,sum(input_tokens) AS input_tokens FROM public.product_model_calls WHERE run_id=$1', [runId],
  )).rows[0];
  assert.deepEqual(calls, { count: 1, input_tokens: '13' });
});

test('a nullable exhausted-section error still keeps the run failed', async () => {
  const { client, store, runId, claimA, claimB } = await createTwoSectionRun();
  await store.failSection({
    runId, nodeId: claimA.node_id, workerId: claimA.worker_id,
    attemptToken: claimA.attempt_token, error: new Error('exhausted-a'),
  });
  await client.query(
    "UPDATE public.product_section_work SET error=NULL WHERE run_id=$1 AND node_id='section-a'", [runId],
  );
  await client.query('UPDATE public.product_analysis_runs SET error=NULL WHERE run_id=$1', [runId]);
  await store.failSection({
    runId, nodeId: claimB.node_id, workerId: claimB.worker_id,
    attemptToken: claimB.attempt_token, error: new Error('retryable-b'),
  });
  assert.deepEqual(await runState(client, runId), {
    status: 'FAILED', stage: 'SECTION_ANALYSIS', error: { code: 'SECTION_ATTEMPTS_EXHAUSTED' },
  });
});

test('normal section commits and final completion still succeed', runPhase2DatabaseTest);

test('a phase 2 commit cannot downgrade an exhausted failure or duplicate immutable history', async () => {
  await runScopedWorkSetTest();
  const client = getDatabaseClient();
  const store = new ProductPhase2Store({ client: databaseFacade() });
  const baselineRunId = (await client.query(
    "SELECT run_id FROM public.product_analysis_runs WHERE idempotency_key='scoped-work-direct'",
  )).rows[0].run_id;
  const context = await store.getRunContext(baselineRunId);
  const completedResults = await store.loadCompletedSectionResults(baselineRunId);
  assert.equal(completedResults.length, 2);
  const raceRun = await store.createOrGetRun({
    sourceDocumentId: context.sourceDocument.source_document_id,
    retrievalUrl: context.sourceDocument.retrieval_url,
    idempotencyKey: 'scoped-work-commit-race',
    schemaVersion: 'LEGAL_SCHEMA/V1',
    promptBundleVersion: 'PRODUCT_PROMPT_BUNDLE/MONOTONIC_RACE_V1',
    modelConfig: { provider_id: 'TEST' },
    explicitGeneration: 21,
  });
  await store.attachStructure({ runId: raceRun.run_id, structure: context.agreementStructure });
  const ordered = (await client.query(
    'SELECT node_id FROM public.product_section_work WHERE run_id=$1 ORDER BY authored_order', [raceRun.run_id],
  )).rows;
  assert.equal(ordered.length, 2);
  await client.query(
    'UPDATE public.product_section_work SET attempts=2 WHERE run_id=$1 AND node_id=$2',
    [raceRun.run_id, ordered[0].node_id],
  );
  const claimA = await store.claimNextSection({ runId: raceRun.run_id, workerId: 'commit-race-a' });
  const claimB = await store.claimNextSection({ runId: raceRun.run_id, workerId: 'commit-race-b' });
  assert.equal(claimA.node_id, ordered[0].node_id);
  assert.equal(claimB.node_id, ordered[1].node_id);
  assert.equal(await store.claimNextSection({ runId: raceRun.run_id, workerId: 'commit-race-c' }), null);
  const failedCall = modelCall(claimA, 'EXTRACTION', 19, 6, 113);
  await store.failSection({
    runId: raceRun.run_id, nodeId: claimA.node_id, workerId: claimA.worker_id,
    attemptToken: claimA.attempt_token, error: new Error('exhausted-a'), modelCalls: [failedCall],
  });
  const resultB = structuredClone(completedResults.find((item) => item.node_id === claimB.node_id));
  assert.ok(resultB);
  resultB.model_calls.forEach((call) => { delete call.invocation_id; });
  await store.commitSection({
    runId: raceRun.run_id, nodeId: claimB.node_id, workerId: claimB.worker_id,
    attemptToken: claimB.attempt_token, result: resultB,
  });
  await store.commitSection({
    runId: raceRun.run_id, nodeId: claimB.node_id, workerId: claimB.worker_id,
    attemptToken: claimB.attempt_token, result: resultB,
  });
  assert.deepEqual(await runState(client, raceRun.run_id), {
    status: 'FAILED', stage: 'SECTION_ANALYSIS', error: { message: 'exhausted-a' },
  });
  const expected = resultB.model_calls.reduce((totals, call) => ({
    calls: totals.calls + 1,
    inputTokens: totals.inputTokens + call.input_tokens,
    outputTokens: totals.outputTokens + call.output_tokens,
    costMicrousd: totals.costMicrousd + call.cost_microusd,
  }), { calls: 1, inputTokens: failedCall.input_tokens, outputTokens: failedCall.output_tokens, costMicrousd: failedCall.cost_microusd });
  const accounting = (await client.query(`SELECT count(*) AS calls, sum(input_tokens) AS input_tokens,
    sum(output_tokens) AS output_tokens, sum(cost_microusd) AS cost_microusd
    FROM public.product_model_calls WHERE run_id=$1`, [raceRun.run_id])).rows[0];
  assert.deepEqual(accounting, {
    calls: expected.calls,
    input_tokens: String(expected.inputTokens),
    output_tokens: String(expected.outputTokens),
    cost_microusd: String(expected.costMicrousd),
  });
});
