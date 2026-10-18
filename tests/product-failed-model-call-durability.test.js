'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementSectionDraft, MODEL_CALL_VERSION, modelInvocationId } = require('../lib/product/agreement-draft');
const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { ProductPhase2Store } = require('../lib/product/phase-2-store');
const { substantiveSections } = require('../lib/product/source-context');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { CONCHO_URL, conchoSource, createSyntheticConchoModel, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

// The harness: every migration in order, one rolled-back transaction, the
// Supabase-shaped facade (tests/helpers/product-database.js; finding (141)).
const database = require('./helpers/product-database');

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
  const client = await database.setupDatabase();
  t.after(database.teardownDatabase);
  const store = new ProductPhase2Store({ client: database.databaseFacade() });
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
  // One attempt's calls: routing, residual and one extraction per part of
  // the section (a long section is extracted in parts since Q6); the count
  // and the totals are read from the recorded calls, not fixed (finding (141)).
  const perAttempt = firstAttemptRows.length;
  assert.ok(perAttempt >= 3, `at least routing, residual and one extraction: ${perAttempt}`);
  assert.deepEqual([...new Set(firstAttemptRows.map((row) => row.call_kind))].sort(), ['EXTRACTION', 'RESIDUAL', 'ROUTING']);
  assert.equal(new Set(firstAttemptRows.map((row) => row.invocation_id)).size, perAttempt);
  const totals = (rows) => rows.reduce((sum, row) => ({
    input: sum.input + Number(row.input_tokens), output: sum.output + Number(row.output_tokens), cost: sum.cost + Number(row.cost_microusd),
  }), { input: 0, output: 0, cost: 0 });
  const attemptTotals = totals(firstAttemptRows);
  assert.ok(attemptTotals.input > 0 && attemptTotals.cost > 0);
  assert.deepEqual({
    input: Number(failedWork.input_tokens), output: Number(failedWork.output_tokens), cost: Number(failedWork.cost_microusd),
  }, attemptTotals);

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
  }, attemptTotals);

  await assert.rejects(() => runAgreementDraftAnalysis({
    runId: run.run_id, store, legalSchema: schema, model: invalidLinkModel(), workerId: 'failed-call-test',
  }), /FACT_LINK_TYPE/);
  const twoAttempts = (await client.query(`SELECT * FROM public.product_model_calls
    WHERE run_id=$1 AND structure_node_id=$2 ORDER BY call_kind,invocation_id`, [run.run_id, failedWork.node_id])).rows;
  assert.equal(twoAttempts.length, 2 * perAttempt);
  assert.equal(new Set(twoAttempts.map((row) => row.invocation_id)).size, 2 * perAttempt);
  const failedExtractions = twoAttempts.filter((row) => row.call_kind === 'EXTRACTION');
  assert.equal(failedExtractions.length, 2 * firstAttemptRows.filter((row) => row.call_kind === 'EXTRACTION').length);
  // Every extraction of the first attempt has one twin from the second: the
  // same request and response under a different call id.
  for (const first of firstAttemptRows.filter((row) => row.call_kind === 'EXTRACTION')) {
    const twins = failedExtractions.filter((row) => row.model_call_id !== first.model_call_id
      && JSON.stringify(row.request) === JSON.stringify(first.request));
    assert.equal(twins.length, 1, `one twin of ${first.model_call_id}`);
    assert.deepEqual(twins[0].response, first.response);
  }

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
    // Running work rides in progress since 20260905221000 (finding (141)).
    running: 0,
    cost_microusd: storedTotals.cost_microusd,
    input_tokens: storedTotals.input_tokens,
    output_tokens: storedTotals.output_tokens,
  });
  assert.equal(finalRead.model_calls.length, storedTotals.model_calls);
  assert.equal(finalRead.model_calls.every((call) => call.invocation_id), true);
  const completed = await store.loadCompletedSectionResults(run.run_id);
  const retriedSection = completed.find((result) => result.node_id === failedWork.node_id);
  // Two failed attempts and the successful third, each the section's calls.
  assert.equal(retriedSection.model_calls.length, 3 * perAttempt);
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
