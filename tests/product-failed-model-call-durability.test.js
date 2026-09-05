'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Client } = require('pg');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft, MODEL_CALL_VERSION, modelInvocationId } = require('../lib/product/agreement-draft');
const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { ProductPhase2Store } = require('../lib/product/phase-2-store');
const { substantiveSections } = require('../lib/product/source-context');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { CONCHO_URL, conchoSource, createSyntheticConchoModel, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

const ROOT = path.resolve(__dirname, '..');
const databaseUrl = process.env.TEST_DATABASE_URL;
const pgliteModule = process.env.TEST_PGLITE_MODULE;
if (!databaseUrl && !pgliteModule) throw new Error('TEST_DATABASE_URL or TEST_PGLITE_MODULE is required for the failed-call durability test');

const migrationFiles = [
  'supabase/migrations/20260905020346_product_phase_1_foundation.sql',
  'supabase/migrations/20260905043000_product_phase_2_vertical_slice.sql',
  'supabase/migrations/20260905070000_product_phase_3_review.sql',
  'supabase/migrations/20260905190000_product_substantive_section_work.sql',
  'supabase/migrations/20260905200000_product_expired_section_recovery.sql',
  'supabase/migrations/20260905201000_product_residual_pass_persistence.sql',
  'supabase/migrations/20260905202000_product_section_lease_heartbeat.sql',
  'supabase/migrations/20260905203000_product_finalization_retry.sql',
  'supabase/migrations/20260905204000_product_saved_run_finalization.sql',
  'supabase/migrations/20260905205000_product_release_timing_guard.sql',
  'supabase/migrations/20260905210000_product_structure_versions.sql',
  'supabase/migrations/20260905211000_product_failed_model_calls.sql',
];

const rpcArguments = {
  product_phase1_persist_source: ['p_source'],
  product_phase1_create_run: ['p_source_document_id', 'p_retrieval_url', 'p_idempotency_key', 'p_schema_version', 'p_prompt_bundle_version', 'p_model_config', 'p_explicit_generation', 'p_max_attempts'],
  product_phase1_attach_structure: ['p_run_id', 'p_structure_id', 'p_structure', 'p_identity_review'],
  product_phase1_claim_section: ['p_run_id', 'p_worker_id', 'p_lease_seconds'],
  product_phase1_renew_section_lease: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_lease_seconds'],
  product_phase1_complete_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_cost_microusd', 'p_input_tokens', 'p_output_tokens'],
  product_phase1_fail_run: ['p_run_id', 'p_stage', 'p_error'],
  product_phase2_record_model_call: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_call'],
  product_phase2_fail_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_error', 'p_model_calls'],
  product_phase2_commit_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_result'],
  product_phase2_finalize_saved_run: ['p_run_id', 'p_finalization'],
  product_phase2_get_analysis: ['p_run_id'],
};

function databaseFacade(client) {
  return {
    async rpc(name, parameters) {
      try {
        const names = rpcArguments[name];
        if (!names) throw new Error(`unsupported RPC ${name}`);
        const values = names.map((key) => parameters[key]);
        const markers = values.map((_, index) => `$${index + 1}`).join(',');
        const result = await client.query(`SELECT public.${name}(${markers}) AS data`, values);
        return { data: result.rows[0].data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    from(table) {
      if (!/^product_[a-z_]+$/.test(table)) throw new Error('invalid table');
      let columns = '*';
      const filters = [];
      const orders = [];
      let bounds = null;
      const execute = async (single = false) => {
        try {
          const where = filters.length ? ` WHERE ${filters.map((item, index) => `${item.column} = $${index + 1}`).join(' AND ')}` : '';
          const order = orders.length ? ` ORDER BY ${orders.map((item) => `${item.column} ${item.ascending ? 'ASC' : 'DESC'}`).join(', ')}` : '';
          const limit = bounds ? ` LIMIT ${bounds.to - bounds.from + 1} OFFSET ${bounds.from}` : '';
          const result = await client.query(`SELECT ${columns} FROM public.${table}${where}${order}${limit}`, filters.map((item) => item.value));
          return { data: single ? (result.rows[0] || null) : result.rows, error: null };
        } catch (error) {
          return { data: null, error };
        }
      };
      const builder = {
        select(value) { columns = value; return builder; },
        eq(column, value) { filters.push({ column, value }); return builder; },
        order(column, options = {}) { orders.push({ column, ascending: options.ascending !== false }); return builder; },
        range(from, to) { bounds = { from, to }; return builder; },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      return builder;
    },
  };
}

async function createDatabase() {
  let client;
  if (databaseUrl) {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  } else {
    const { PGlite } = require(pgliteModule);
    client = new PGlite();
    await client.waitReady;
  }
  const execute = (sql) => pgliteModule ? client.exec(sql) : client.query(sql);
  await client.query('BEGIN');
  await execute(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END $$;`);
  if (pgliteModule) {
    await execute(`CREATE SCHEMA IF NOT EXISTS extensions;
      CREATE FUNCTION extensions.digest(data bytea, algorithm text) RETURNS bytea LANGUAGE sql IMMUTABLE
      AS $$ SELECT CASE WHEN lower(algorithm) = 'sha256' THEN pg_catalog.sha256(data)
        ELSE decode(md5(data) || md5(data), 'hex') END $$;
      CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid LANGUAGE sql VOLATILE
      AS $$ SELECT pg_catalog.gen_random_uuid() $$;`);
  }
  for (const filename of migrationFiles) {
    const sql = fs.readFileSync(path.join(ROOT, filename), 'utf8')
      .replace(pgliteModule ? 'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;' : '__KEEP_PGCRYPTO__', '');
    await execute(sql);
  }
  return client;
}

function rawCall(row) {
  return {
    schema_version: MODEL_CALL_VERSION,
    model_call_id: row.model_call_id,
    invocation_id: row.invocation_id,
    call_kind: row.call_kind,
    prompt_version: row.prompt_version,
    provider_id: row.provider_id,
    model_id: row.model_id,
    structure_node_id: row.structure_node_id,
    request: row.request,
    response: row.response,
    input_tokens: Number(row.input_tokens),
    output_tokens: Number(row.output_tokens),
    cost_microusd: Number(row.cost_microusd),
    duration_ms: Number(row.duration_ms),
  };
}

function callForAttempt(template, nodeId, attemptToken) {
  const body = {
    schema_version: MODEL_CALL_VERSION,
    call_kind: template.call_kind,
    prompt_version: template.prompt_version,
    provider_id: template.provider_id,
    model_id: template.model_id,
    structure_node_id: nodeId,
    request: template.request,
    response: template.response,
    invocation_id: modelInvocationId(attemptToken, template.call_kind),
    input_tokens: Number(template.input_tokens),
    output_tokens: Number(template.output_tokens),
    cost_microusd: Number(template.cost_microusd),
    duration_ms: Number(template.duration_ms),
  };
  return { ...body, model_call_id: contentId(MODEL_CALL_VERSION, body) };
}

function invalidLinkModel() {
  const base = createSyntheticConchoModel();
  return {
    async complete(input) {
      const result = await base.complete(input);
      if (input.call_kind !== 'EXTRACTION' || result.response.links.length === 0) return result;
      const response = structuredClone(result.response);
      response.links[0].relationship_type = ['EXTENDS', 'QUALIFIES'];
      return { ...result, response, raw_response: response };
    },
  };
}

let savepointOrdinal = 0;
async function rejectsDatabase(client, action, pattern) {
  const name = `failed_call_rejection_${savepointOrdinal += 1}`;
  await client.query(`SAVEPOINT ${name}`);
  try {
    await assert.rejects(action, pattern);
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    await client.query(`RELEASE SAVEPOINT ${name}`);
  }
}

test('failed model calls persist once per attempt and remain in the final draft history', async (t) => {
  const client = await createDatabase();
  t.after(async () => {
    await client.query('ROLLBACK');
    if (typeof client.end === 'function') await client.end();
    else await client.close();
  });
  const store = new ProductPhase2Store({ client: databaseFacade(client) });
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
    idempotencyKey: 'failed-call-durability',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE2/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    maxAttempts: 3,
    explicitGeneration: 9,
  });
  await store.attachStructure({ runId: run.run_id, structure });

  await assert.rejects(() => runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model: invalidLinkModel(), workerId: 'failed-call-test',
  }), /FACT_LINK_TYPE/);
  const failedWork = (await client.query(`SELECT * FROM public.product_section_work
    WHERE run_id=$1 AND status='FAILED'`, [run.run_id])).rows[0];
  assert.ok(failedWork);
  const firstAttemptRows = (await client.query(`SELECT * FROM public.product_model_calls
    WHERE run_id=$1 AND structure_node_id=$2 ORDER BY call_kind`, [run.run_id, failedWork.node_id])).rows;
  assert.equal(firstAttemptRows.length, 3);
  assert.equal(new Set(firstAttemptRows.map((row) => row.invocation_id)).size, 3);
  assert.deepEqual({
    input: Number(failedWork.input_tokens), output: Number(failedWork.output_tokens), cost: Number(failedWork.cost_microusd),
  }, { input: 300, output: 150, cost: 75 });

  await store.failSection({
    runId: run.run_id,
    nodeId: failedWork.node_id,
    workerId: failedWork.worker_id,
    attemptToken: failedWork.attempt_token,
    error: new Error('same failure replay'),
    modelCalls: firstAttemptRows.map(rawCall),
  });
  const replayed = (await client.query(`SELECT input_tokens,output_tokens,cost_microusd FROM public.product_section_work
    WHERE run_id=$1 AND node_id=$2`, [run.run_id, failedWork.node_id])).rows[0];
  assert.deepEqual({
    input: Number(replayed.input_tokens), output: Number(replayed.output_tokens), cost: Number(replayed.cost_microusd),
  }, { input: 300, output: 150, cost: 75 });

  await assert.rejects(() => runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model: invalidLinkModel(), workerId: 'failed-call-test',
  }), /FACT_LINK_TYPE/);
  const twoAttempts = (await client.query(`SELECT * FROM public.product_model_calls
    WHERE run_id=$1 AND structure_node_id=$2 ORDER BY call_kind,invocation_id`, [run.run_id, failedWork.node_id])).rows;
  assert.equal(twoAttempts.length, 6);
  assert.equal(new Set(twoAttempts.map((row) => row.invocation_id)).size, 6);
  const failedExtractions = twoAttempts.filter((row) => row.call_kind === 'EXTRACTION');
  assert.equal(failedExtractions.length, 2);
  assert.deepEqual(failedExtractions[0].request, failedExtractions[1].request);
  assert.deepEqual(failedExtractions[0].response, failedExtractions[1].response);
  assert.notEqual(failedExtractions[0].model_call_id, failedExtractions[1].model_call_id);

  const atomicRun = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'failed-call-atomicity',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE2/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    maxAttempts: 3,
    explicitGeneration: 10,
  });
  assert.notEqual(atomicRun.run_id, run.run_id);
  await store.attachStructure({ runId: atomicRun.run_id, structure });
  const atomicClaim = await store.claimNextSection({ runId: atomicRun.run_id, workerId: 'atomic-call-test' });
  const template = rawCall(firstAttemptRows[0]);
  const validCall = callForAttempt(template, atomicClaim.node_id, atomicClaim.attempt_token);
  const beforeAtomicity = await store.getProgress(atomicRun.run_id);
  const withoutInvocation = { ...validCall };
  delete withoutInvocation.invocation_id;
  delete withoutInvocation.model_call_id;
  withoutInvocation.model_call_id = contentId(MODEL_CALL_VERSION, withoutInvocation);
  const nullInvocation = { ...withoutInvocation, invocation_id: null };
  delete nullInvocation.model_call_id;
  nullInvocation.model_call_id = contentId(MODEL_CALL_VERSION, nullInvocation);
  await rejectsDatabase(client, () => store.recordModelCall({
    runId: atomicRun.run_id, nodeId: atomicClaim.node_id, workerId: 'atomic-call-test',
    attemptToken: null, call: validCall,
  }), /invalid product model call|DATABASE_ERROR/i);
  await rejectsDatabase(client, () => store.recordModelCall({
    runId: atomicRun.run_id, nodeId: atomicClaim.node_id, workerId: 'atomic-call-test',
    attemptToken: atomicClaim.attempt_token, call: withoutInvocation,
  }), /product model invocation identity is required/i);
  await rejectsDatabase(client, () => store.recordModelCall({
    runId: atomicRun.run_id, nodeId: atomicClaim.node_id, workerId: 'atomic-call-test',
    attemptToken: atomicClaim.attempt_token, call: nullInvocation,
  }), /product model invocation identity is required/i);
  await rejectsDatabase(client, () => store.recordModelCall({
    runId: atomicRun.run_id,
    nodeId: atomicClaim.node_id,
    workerId: 'atomic-call-test',
    attemptToken: atomicClaim.attempt_token,
    call: { ...validCall, invocation_id: 'f'.repeat(64) },
  }), /invalid product model invocation identity/i);
  await rejectsDatabase(client, () => store.recordModelCall({
    runId: atomicRun.run_id,
    nodeId: atomicClaim.node_id,
    workerId: 'atomic-call-test',
    attemptToken: '00000000-0000-4000-8000-000000000099',
    call: callForAttempt(template, atomicClaim.node_id, '00000000-0000-4000-8000-000000000099'),
  }), /STALE_SECTION_ATTEMPT|stale section attempt/i);
  assert.equal(Number((await client.query('SELECT count(*) FROM public.product_model_calls WHERE run_id=$1', [atomicRun.run_id])).rows[0].count), 0);
  assert.deepEqual(await store.getProgress(atomicRun.run_id), beforeAtomicity);
  const legacyNode = substantiveSections(structure).find((node) => node.node_id === atomicClaim.node_id);
  const legacyResult = await buildAgreementSectionDraft({
    sourceDocument, agreementStructure: structure, legalSchema: schema,
    model: createSyntheticConchoModel(), node: legacyNode,
  });
  assert.equal(legacyResult.model_calls.every((call) => call.invocation_id === undefined), true);
  await store.commitSection({
    runId: atomicRun.run_id, nodeId: atomicClaim.node_id, workerId: 'atomic-call-test',
    attemptToken: atomicClaim.attempt_token, result: legacyResult,
  });
  const legacyProgress = await store.getProgress(atomicRun.run_id);
  assert.equal(legacyProgress.input_tokens, legacyResult.model_calls.reduce((sum, call) => sum + call.input_tokens, 0));
  assert.equal(legacyProgress.cost_microusd, legacyResult.model_calls.reduce((sum, call) => sum + call.cost_microusd, 0));

  const failureAtomicRun = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id,
    retrievalUrl: CONCHO_URL,
    idempotencyKey: 'failed-call-transaction-atomicity',
    schemaVersion: schema.schema_version,
    promptBundleVersion: 'PRODUCT_PHASE2/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' },
    maxAttempts: 3,
    explicitGeneration: 11,
  });
  await store.attachStructure({ runId: failureAtomicRun.run_id, structure });
  const failureAtomicClaim = await store.claimNextSection({
    runId: failureAtomicRun.run_id, workerId: 'atomic-failure-test',
  });
  const admittedThenRolledBack = callForAttempt(
    template, failureAtomicClaim.node_id, failureAtomicClaim.attempt_token,
  );
  const invalidSecondCall = {
    ...callForAttempt({ ...template, call_kind: 'RESIDUAL' }, failureAtomicClaim.node_id, failureAtomicClaim.attempt_token),
    invocation_id: 'e'.repeat(64),
  };
  const failureBefore = await store.getProgress(failureAtomicRun.run_id);
  await rejectsDatabase(client, () => store.failSection({
    runId: failureAtomicRun.run_id,
    nodeId: failureAtomicClaim.node_id,
    workerId: 'atomic-failure-test',
    attemptToken: failureAtomicClaim.attempt_token,
    error: new Error('transaction must roll back'),
    modelCalls: [admittedThenRolledBack, invalidSecondCall],
  }), /invalid product model invocation identity/i);
  assert.equal(Number((await client.query(
    'SELECT count(*) FROM public.product_model_calls WHERE run_id=$1', [failureAtomicRun.run_id],
  )).rows[0].count), 0);
  assert.deepEqual(await store.getProgress(failureAtomicRun.run_id), failureBefore);
  assert.equal((await client.query(`SELECT status FROM public.product_section_work
    WHERE run_id=$1 AND node_id=$2`, [failureAtomicRun.run_id, failureAtomicClaim.node_id])).rows[0].status, 'RUNNING');

  const finalRead = await runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model: createSyntheticConchoModel(), workerId: 'failed-call-test',
  });
  assert.equal(finalRead.status, 'READY');
  const storedTotals = (await client.query(`SELECT count(*)::int model_calls,
    coalesce(sum(input_tokens),0)::int input_tokens,
    coalesce(sum(output_tokens),0)::int output_tokens,
    coalesce(sum(cost_microusd),0)::int cost_microusd
    FROM public.product_model_calls WHERE run_id=$1`, [run.run_id])).rows[0];
  assert.deepEqual(finalRead.progress, {
    total: finalRead.progress.total,
    completed: finalRead.progress.total,
    failed: 0,
    cost_microusd: storedTotals.cost_microusd,
    input_tokens: storedTotals.input_tokens,
    output_tokens: storedTotals.output_tokens,
  });
  assert.equal(finalRead.model_calls.length, storedTotals.model_calls);
  assert.equal(finalRead.model_calls.every((call) => call.invocation_id), true);
  const completed = await store.loadCompletedSectionResults(run.run_id);
  const retriedSection = completed.find((result) => result.node_id === failedWork.node_id);
  assert.equal(retriedSection.model_calls.length, 9);
  const callIds = new Set(retriedSection.model_calls.map((call) => call.model_call_id));
  assert.ok(retriedSection.proposals.every((proposal) => callIds.has(proposal.model_call_id)));
  assert.equal(retriedSection.model_calls.every((call) => call.invocation_id), true);
  const nestedNullCall = retriedSection.model_calls.find((call) => call.call_kind === 'EXTRACTION');
  assert.ok(nestedNullCall.response.proposals.some((proposal) => proposal.value === null));

  const privileges = (await client.query(`SELECT
    has_function_privilege('service_role', 'public.product_phase2_record_model_call(uuid,text,text,uuid,jsonb)', 'EXECUTE') AS service_record,
    has_function_privilege('service_role', 'public.product_phase2_fail_section(uuid,text,text,uuid,jsonb,jsonb)', 'EXECUTE') AS service_fail,
    has_function_privilege('anon', 'public.product_phase2_record_model_call(uuid,text,text,uuid,jsonb)', 'EXECUTE') AS anon_record,
    has_function_privilege('authenticated', 'public.product_phase2_fail_section(uuid,text,text,uuid,jsonb,jsonb)', 'EXECUTE') AS authenticated_fail,
    has_function_privilege('service_role', 'product_private.product_phase2_admit_model_call(uuid,text,text,uuid,jsonb,boolean)', 'EXECUTE') AS helper_exposed`)).rows[0];
  assert.deepEqual(privileges, {
    service_record: true,
    service_fail: true,
    anon_record: false,
    authenticated_fail: false,
    helper_exposed: false,
  });
});
