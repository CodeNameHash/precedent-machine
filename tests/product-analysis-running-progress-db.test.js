'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const {
  getDatabaseClient,
  setupDatabase,
  teardownDatabase,
} = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;

const migration = fs.readFileSync(path.join(
  __dirname,
  '../supabase/migrations/20260905221000_product_analysis_running_progress.sql',
), 'utf8');

async function executeScript(client, sql) {
  if (typeof client.exec === 'function') return client.exec(sql);
  return client.query(sql);
}

async function readAnalysis(client, runId) {
  await client.query('SET LOCAL ROLE service_role');
  try {
    return (await client.query(
      'SELECT public.product_phase2_get_analysis($1) AS analysis',
      [runId],
    )).rows[0].analysis;
  } finally {
    await client.query('RESET ROLE');
  }
}

async function readStoredState(client, runId) {
  return {
    run: (await client.query(
      'SELECT status,stage,error,updated_at FROM public.product_analysis_runs WHERE run_id=$1',
      [runId],
    )).rows[0],
    sections: (await client.query(`SELECT node_id,status,attempts,max_attempts,worker_id,
      attempt_token,lease_expires_at,error,cost_microusd,input_tokens,output_tokens,
      started_at,completed_at FROM public.product_section_work
      WHERE run_id=$1 ORDER BY authored_order`, [runId])).rows,
  };
}

function withoutRunning(payload) {
  const copy = structuredClone(payload);
  delete copy.progress.running;
  return copy;
}

test.before(setupDatabase);
test.after(teardownDatabase);

test('analysis progress reports running work without changing the stored analysis', async () => {
  const client = getDatabaseClient();
  const runId = crypto.randomUUID();
  const runStatusRunId = crypto.randomUUID();
  const sourceDocumentId = 'a'.repeat(64);
  const structureId = 'b'.repeat(64);
  const draftAnalysisId = 'c'.repeat(64);
  const modelCallId = 'd'.repeat(64);
  const invocationId = 'e'.repeat(64);

  await client.query(`INSERT INTO public.product_source_documents
    (source_document_id,retrieval_url,raw_sha256,payload,payload_sha256)
    VALUES ($1,$2,$3,$4::jsonb,$5)`, [
    sourceDocumentId,
    `https://example.test/${sourceDocumentId}`,
    '1'.repeat(64),
    JSON.stringify({ filing_accession: 'test', exhibit_filename: 'test.htm' }),
    '2'.repeat(64),
  ]);
  await client.query(`INSERT INTO public.product_analysis_runs
    (run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,
      schema_version,prompt_bundle_version,model_config,explicit_generation,
      source_generation,max_attempts,status,stage,error)
    VALUES ($1,$2,$3,$4,$5,'LEGAL_SCHEMA/V1','PRODUCT_PHASE2/V1',$6::jsonb,
      0,1,3,'FAILED','SECTION_ANALYSIS',$7::jsonb)`, [
    runId,
    sourceDocumentId,
    `https://example.test/${sourceDocumentId}`,
    `running-progress-${runId}`,
    `running-progress-fingerprint-${runId}`,
    JSON.stringify({ provider: 'test', model: 'test' }),
    JSON.stringify({ code: 'SECTION_ATTEMPTS_EXHAUSTED' }),
  ]);
  await client.query(`INSERT INTO public.product_analysis_runs
    (run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,
      schema_version,prompt_bundle_version,model_config,explicit_generation,
      source_generation,max_attempts,status,stage,error)
    VALUES ($1,$2,$3,$4,$5,'LEGAL_SCHEMA/V1','PRODUCT_PHASE2/V1',$6::jsonb,
      1,2,3,'FAILED','SECTION_ANALYSIS',$7::jsonb)`, [
    runStatusRunId,
    sourceDocumentId,
    `https://example.test/${sourceDocumentId}`,
    `running-progress-status-${runStatusRunId}`,
    `running-progress-status-fingerprint-${runStatusRunId}`,
    JSON.stringify({ provider: 'test', model: 'test' }),
    JSON.stringify({ code: 'SECTION_ATTEMPTS_EXHAUSTED' }),
  ]);
  await client.query(`INSERT INTO public.product_agreement_structures
    (structure_id,source_document_id,payload,payload_sha256)
    VALUES ($1,$2,$3::jsonb,$4)`, [
    structureId, sourceDocumentId, JSON.stringify({ schema_version: 'AGREEMENT_STRUCTURE/V1' }), '3'.repeat(64),
  ]);
  await client.query(
    'INSERT INTO public.product_run_structures(run_id,structure_id) VALUES ($1,$2)',
    [runId, structureId],
  );
  await client.query(`INSERT INTO public.product_section_work
    (run_id,node_id,authored_order,status,attempts,max_attempts,error)
    VALUES ($1,'failed-node',0,'FAILED',3,3,$2::jsonb),
      ($1,'running-node',1,'RUNNING',1,3,NULL)`, [
    runId, JSON.stringify({ code: 'SECTION_ATTEMPTS_EXHAUSTED' }),
  ]);
  await client.query(`INSERT INTO public.product_section_work
    (run_id,node_id,authored_order,status,attempts,max_attempts,error)
    VALUES ($1,'failed-node',0,'FAILED',3,3,$2::jsonb),
      ($1,'running-node',1,'RUNNING',1,3,NULL)`, [
    runStatusRunId, JSON.stringify({ code: 'SECTION_ATTEMPTS_EXHAUSTED' }),
  ]);
  await client.query(
    "INSERT INTO public.product_drafts(run_id,version,state) VALUES ($1,1,'{}'::jsonb)",
    [runId],
  );
  await client.query(`INSERT INTO public.product_draft_analyses
    (run_id,draft_analysis_id,legal_schema_version,payload_sha256)
    VALUES ($1,$2,'LEGAL_SCHEMA/V1',$3)`, [runId, draftAnalysisId, '4'.repeat(64)]);
  await client.query(`INSERT INTO public.product_model_calls
    (run_id,model_call_id,invocation_id,structure_node_id,call_kind,prompt_version,
      provider_id,model_id,request,response,input_tokens,output_tokens,cost_microusd,duration_ms)
    VALUES ($1,$2,$3,'failed-node','EXTRACTION','PROMPT/V1','test-provider','test-model',
      '{}'::jsonb,$4::jsonb,11,0,23,47)`, [
    runId,
    modelCallId,
    invocationId,
    JSON.stringify({
      call_status: 'FAILED',
      provider_completion_confirmed: false,
      usage_status: 'UNAVAILABLE',
    }),
  ]);

  const stateBeforeBaselineRead = await readStoredState(client, runId);
  const baseline = await readAnalysis(client, runId);
  assert.equal(baseline.kind, 'draftAnalysis');
  assert.equal(baseline.status, 'FAILED');
  assert.equal(baseline.progress.failed, 1);
  assert.equal(baseline.progress.running, undefined);
  assert.equal(baseline.model_calls[0].invocation_id, invocationId);
  assert.deepEqual(await readStoredState(client, runId), stateBeforeBaselineRead);
  const baselineRunStatus = await readAnalysis(client, runStatusRunId);
  assert.equal(baselineRunStatus.kind, 'runStatus');
  assert.equal(baselineRunStatus.status, 'FAILED');
  assert.equal(baselineRunStatus.progress.failed, 1);
  assert.equal(baselineRunStatus.progress.running, undefined);

  const functionStateBefore = (await client.query(`SELECT p.prosecdef,p.proconfig,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
    FROM pg_proc p
    WHERE p.oid='product_private.product_phase2_get_analysis(uuid)'::regprocedure`)).rows[0];

  if (process.env.PRODUCT_ANALYSIS_RUNNING_SKIP_MIGRATION !== '1') {
    await executeScript(client, migration);
  }

  const stateBeforeFirstRead = await readStoredState(client, runId);
  const first = await readAnalysis(client, runId);
  assert.equal(first.progress.running, 1);
  assert.equal(first.progress.failed, 1);
  assert.deepEqual(withoutRunning(first), baseline);
  assert.deepEqual(await readStoredState(client, runId), stateBeforeFirstRead);

  const stateBeforeRunStatusRead = await readStoredState(client, runStatusRunId);
  const runningRunStatus = await readAnalysis(client, runStatusRunId);
  assert.equal(runningRunStatus.kind, 'runStatus');
  assert.equal(runningRunStatus.status, 'FAILED');
  assert.equal(runningRunStatus.progress.running, 1);
  assert.equal(runningRunStatus.progress.failed, 1);
  assert.deepEqual(await readStoredState(client, runStatusRunId), stateBeforeRunStatusRead);

  await client.query(`UPDATE public.product_section_work
    SET status='FAILED',worker_id=NULL,attempt_token=NULL,lease_expires_at=NULL,
      error=$2::jsonb,completed_at=statement_timestamp()
    WHERE run_id=$1 AND node_id='running-node'`, [
    runStatusRunId, JSON.stringify({ code: 'SECTION_ATTEMPTS_EXHAUSTED' }),
  ]);
  const stateBeforeSecondRead = await readStoredState(client, runStatusRunId);
  const second = await readAnalysis(client, runStatusRunId);
  assert.equal(second.kind, 'runStatus');
  assert.equal(second.status, 'FAILED');
  assert.equal(second.progress.running, 0);
  assert.equal(second.progress.failed, 2);
  assert.deepEqual(await readStoredState(client, runStatusRunId), stateBeforeSecondRead);

  const functionStateAfter = (await client.query(`SELECT p.prosecdef,p.proconfig,
      has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
    FROM pg_proc p
    WHERE p.oid='product_private.product_phase2_get_analysis(uuid)'::regprocedure`)).rows[0];
  assert.deepEqual(functionStateAfter, functionStateBefore);
  assert.equal(functionStateAfter.prosecdef, true);
  assert.ok(functionStateAfter.proconfig.includes('search_path=""'));
  assert.equal(functionStateAfter.service_execute, true);
  assert.equal(functionStateAfter.anon_execute, false);
  assert.equal(functionStateAfter.authenticated_execute, false);

  for (const role of ['anon', 'authenticated']) {
    await client.query(`SAVEPOINT denied_${role}`);
    await client.query(`SET LOCAL ROLE ${role}`);
    await assert.rejects(
      () => client.query('SELECT public.product_phase2_get_analysis($1)', [runId]),
      /permission denied/i,
    );
    await client.query(`ROLLBACK TO SAVEPOINT denied_${role}`);
    await client.query(`RELEASE SAVEPOINT denied_${role}`);
  }
});
