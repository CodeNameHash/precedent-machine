'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;

const ROOT = path.resolve(__dirname, '..');
const runningMigration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905221000_product_analysis_running_progress.sql',
), 'utf8');
const indexMigration = fs.readFileSync(path.join(
  ROOT, 'supabase/migrations/20260905223000_product_span_closure_lookup.sql',
), 'utf8');

async function execute(client, sql) {
  if (typeof client.exec === 'function') await client.exec(sql);
  else await client.query(sql);
}

async function readAnalysis(client, runId) {
  await client.query('SET LOCAL ROLE service_role');
  try {
    return (await client.query(
      'SELECT public.product_phase2_get_analysis($1) AS analysis', [runId],
    )).rows[0].analysis;
  } finally {
    await client.query('RESET ROLE');
  }
}

async function databaseSurface(client) {
  const table = (await client.query(`SELECT c.relrowsecurity,c.relforcerowsecurity,c.relacl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='product_source_closure_spans'`)).rows[0];
  const functions = (await client.query(`SELECT p.oid::regprocedure::text AS signature,
      p.prosecdef,p.proconfig,p.proacl,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
    FROM pg_proc p
    WHERE p.oid IN (
      'public.product_phase2_get_analysis(uuid)'::regprocedure,
      'product_private.product_phase2_get_analysis(uuid)'::regprocedure
    ) ORDER BY signature`)).rows;
  return { table, functions };
}

async function indexDefinitions(client) {
  return (await client.query(`SELECT indexname,indexdef FROM pg_indexes
    WHERE schemaname='public' AND tablename='product_source_closure_spans'
    ORDER BY indexname`)).rows;
}

test.before(async () => {
  await database.setupDatabase();
  await execute(database.getDatabaseClient(), runningMigration);
});
test.after(database.teardownDatabase);

test('reverse span lookup index preserves the complete effective analysis response and database surface', async () => {
  const client = database.getDatabaseClient();
  const runId = crypto.randomUUID();
  const sourceDocumentId = 'a'.repeat(64);
  const structureId = 'b'.repeat(64);
  const draftAnalysisId = 'c'.repeat(64);
  const modelCallId = 'd'.repeat(64);
  const invocationId = 'e'.repeat(64);

  await client.query(`INSERT INTO public.product_source_documents
    (source_document_id,retrieval_url,raw_sha256,payload,payload_sha256)
    VALUES ($1,$2,$3,$4::jsonb,$5)`, [
    sourceDocumentId, `https://example.test/${runId}`, '1'.repeat(64),
    JSON.stringify({ filing_accession: 'test', exhibit_filename: 'test.htm', parties: ['A', 'B'] }),
    '2'.repeat(64),
  ]);
  await client.query(`INSERT INTO public.product_analysis_runs
    (run_id,source_document_id,retrieval_url,idempotency_key,submission_fingerprint,
      schema_version,prompt_bundle_version,model_config,explicit_generation,
      source_generation,max_attempts,status,stage)
    VALUES ($1,$2,$3,$4,$5,'LEGAL_SCHEMA/V1','PRODUCT_PHASE2/V1','{}'::jsonb,
      0,1,3,'READY','READY')`, [
    runId, sourceDocumentId, `https://example.test/${runId}`,
    `span-index-${runId}`, `span-index-fingerprint-${runId}`,
  ]);
  await client.query(`INSERT INTO public.product_agreement_structures
    (structure_id,source_document_id,payload,payload_sha256)
    VALUES ($1,$2,$3::jsonb,$4)`, [
    structureId, sourceDocumentId,
    JSON.stringify({ schema_version: 'AGREEMENT_STRUCTURE/V1', nodes: [] }), '3'.repeat(64),
  ]);
  await client.query('INSERT INTO public.product_run_structures(run_id,structure_id) VALUES ($1,$2)', [
    runId, structureId,
  ]);
  await client.query(`INSERT INTO public.product_drafts(run_id,version,state)
    VALUES ($1,1,$2::jsonb)`, [
    runId, JSON.stringify({ schema_version: 'PRODUCT_DRAFT_STATE/V1', residual_passes: [] }),
  ]);
  await client.query(`INSERT INTO public.product_draft_analyses
    (run_id,draft_analysis_id,legal_schema_version,payload_sha256)
    VALUES ($1,$2,'LEGAL_SCHEMA/V1',$3)`, [runId, draftAnalysisId, '4'.repeat(64)]);
  await client.query(`INSERT INTO public.product_section_work
    (run_id,node_id,authored_order,status,attempts,max_attempts)
    VALUES ($1,'node-1',0,'RUNNING',1,3)` , [runId]);
  await client.query(`INSERT INTO public.product_model_calls
    (run_id,model_call_id,invocation_id,structure_node_id,call_kind,prompt_version,
      provider_id,model_id,request,response,input_tokens,output_tokens,cost_microusd,duration_ms)
    VALUES ($1,$2,$3,'node-1','EXTRACTION','PROMPT/V1','test','test','{}'::jsonb,
      '{}'::jsonb,11,12,13,14)`, [runId, modelCallId, invocationId]);
  await client.query(`INSERT INTO public.product_source_closures
    (run_id,source_closure_id,structure_node_id,section_reference,payload)
    SELECT $1,encode(extensions.digest(convert_to('closure-' || n,'UTF8'),'sha256'),'hex'),
      'node-' || n,n::text,jsonb_build_object(
        'schema_version','PRODUCT_SOURCE_CLOSURE/V1',
        'source_closure_id',encode(extensions.digest(convert_to('closure-' || n,'UTF8'),'sha256'),'hex'),
        'structure_node_id','node-' || n
      )
    FROM generate_series(1,24) n`, [runId]);
  await client.query(`INSERT INTO public.product_source_spans
    (run_id,span_id,source_document_id,structure_node_id,kind,coordinate_system,
      start_byte,end_byte,text_sha256,exact_text)
    SELECT $1,encode(extensions.digest(convert_to('span-' || n,'UTF8'),'sha256'),'hex'),$2,
      'node-' || (((n-1)%24)+1),'FULL_SECTION','UTF8_CANONICAL_TEXT_HALF_OPEN',
      n*10,n*10+9,encode(extensions.digest(convert_to('text-' || n,'UTF8'),'sha256'),'hex'),
      'text-' || n
    FROM generate_series(1,240) n`, [runId, sourceDocumentId]);
  await client.query(`INSERT INTO public.product_source_closure_spans
    (run_id,source_closure_id,span_id)
    SELECT $1,
      encode(extensions.digest(convert_to('closure-' || (((span_number-1+offset_number)%24)+1),'UTF8'),'sha256'),'hex'),
      encode(extensions.digest(convert_to('span-' || span_number,'UTF8'),'sha256'),'hex')
    FROM generate_series(1,240) span_number
    CROSS JOIN generate_series(0,2) offset_number`, [runId]);

  const surfaceBefore = await databaseSurface(client);
  assert.equal(surfaceBefore.table.relrowsecurity, true);
  assert.equal(surfaceBefore.table.relforcerowsecurity, false);
  assert.ok(surfaceBefore.functions.every((fn) => (
    fn.service_execute === true && fn.anon_execute === false && fn.authenticated_execute === false
  )));
  assert.ok(surfaceBefore.functions.every((fn) => fn.proconfig.includes('search_path=""')));
  const indexesBefore = await indexDefinitions(client);
  assert.deepEqual(indexesBefore.map((index) => index.indexname), [
    'product_source_closure_spans_pkey',
  ]);
  const baseline = await readAnalysis(client, runId);
  assert.deepEqual(Object.keys(baseline).sort(), [
    'agreement_structure', 'analysis_run_id', 'coverage_assertions', 'draft_analysis_id',
    'fact_links', 'issues', 'kind', 'legal_schema_version', 'model_calls', 'progress',
    'proposals', 'proposition_groups', 'residual_passes', 'review_revision', 'schema_version',
    'sections', 'source_closures', 'source_document', 'spans', 'stage', 'status',
  ]);
  assert.equal(baseline.progress.running, 1);
  assert.equal(baseline.model_calls[0].invocation_id, invocationId);
  assert.equal(baseline.spans.length, 240);
  assert.ok(baseline.spans.every((span) => span.source_closure_ids.length === 3));

  await client.query('SAVEPOINT reverse_index');
  await execute(client, indexMigration);
  const indexesApplied = await indexDefinitions(client);
  assert.deepEqual(indexesApplied.map((index) => index.indexname), [
    'product_source_closure_spans_pkey',
    'product_source_closure_spans_run_span_closure_idx',
  ]);
  assert.match(indexesApplied[1].indexdef, /\(run_id, span_id, source_closure_id\)$/);
  assert.deepEqual(await readAnalysis(client, runId), baseline);
  assert.deepEqual(await databaseSurface(client), surfaceBefore);

  await client.query('ROLLBACK TO SAVEPOINT reverse_index');
  await client.query('RELEASE SAVEPOINT reverse_index');
  assert.deepEqual(await indexDefinitions(client), indexesBefore);
  assert.deepEqual(await readAnalysis(client, runId), baseline);
  assert.deepEqual(await databaseSurface(client), surfaceBefore);

  await execute(client, indexMigration);
  assert.deepEqual(await readAnalysis(client, runId), baseline);
  assert.deepEqual(await databaseSurface(client), surfaceBefore);
});
