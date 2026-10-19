'use strict';

// Attempt resume after a worker stop (work package D3, plan finding (142)),
// on inactive Postgres with every migration: the real Concho source through
// the runner, a long section stopped between its parts and resumed on the
// calls it had completed; the dead-claim release a restarted worker makes;
// the lease recovery's record; the admission of a resumed call.

const assert = require('node:assert/strict');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;
process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { CONCHO_URL, conchoSource, createSyntheticConchoModel, schema } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

const { runAgreementDraftAnalysis } = require('../lib/product/analysis-runner');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { MODEL_CALL_VERSION } = require('../lib/product/agreement-draft');
const { ProductPhase2Store } = require('../lib/product/phase-2-store');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const resume = require('../lib/product/attempt-resume');

const SANDBOX = 'pm-codex-preview-worker';
const FIRST_WORKER = `product-hosted:${SANDBOX}:424242:1`;
const SECOND_WORKER = `product-hosted:${SANDBOX}:424300:1`;

test.before(database.setupDatabase);
test.after(database.teardownDatabase);

const client = () => database.getDatabaseClient();

async function workRow(runId, nodeId) {
  return (await client().query('SELECT * FROM public.product_section_work WHERE run_id=$1 AND node_id=$2', [runId, nodeId])).rows[0];
}

async function callRows(runId, nodeId) {
  return (await client().query('SELECT * FROM public.product_model_calls WHERE run_id=$1 AND structure_node_id=$2 ORDER BY created_at, model_call_id', [runId, nodeId])).rows;
}

// A counting synthetic model: every call noted; a stop asked for once the
// first part of a long section has completed, so the worker stops between
// part 1 and part 2 of that section.
function countingModel({ stopAfterFirstPart = false } = {}) {
  const base = createSyntheticConchoModel();
  const state = { calls: [], stop: false, partsTotal: null };
  const referenceOf = (request) => request?.section_reference || request?.source_closure?.section_reference || null;
  return {
    state,
    async complete(input) {
      const result = await base.complete(input);
      const part = resume.extractionPart(input.request);
      state.calls.push({ call_kind: input.call_kind, reference: referenceOf(input.request), part: part ? part.part : null, of: part ? part.of : null });
      if (stopAfterFirstPart && !state.stop && input.call_kind === 'EXTRACTION' && part && part.part === 1 && part.of >= 2) {
        state.stop = true;
        state.partsTotal = part.of;
      }
      return result;
    },
  };
}

// The section's reference from the run's structure (its closure row is
// written at commit, which a stopped section has not reached).
async function sectionReference(store, runId, nodeId) {
  const context = await store.getRunContext(runId);
  return context.agreementStructure.nodes.find((node) => node.node_id === nodeId).reference;
}

async function conchoRun(store, { idempotencyKey, generation }) {
  const sourceDocument = await conchoSource();
  const structure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  await store.persistSourceDocument(sourceDocument);
  const run = await store.createOrGetRun({
    sourceDocumentId: sourceDocument.source_document_id, retrievalUrl: CONCHO_URL, idempotencyKey,
    schemaVersion: schema.schema_version, promptBundleVersion: 'PRODUCT_PHASE2/V1',
    modelConfig: { provider: 'synthetic-test', model: 'SYNTHETIC_LEGAL_MODEL/V1' }, maxAttempts: 3, explicitGeneration: generation,
  });
  await store.attachStructure({ runId: run.run_id, structure });
  return run;
}

test('a long section stopped between its parts is handed back with the parts done on the row, and the next attempt resumes on them without re-running them', async () => {
  const store = new ProductPhase2Store({ client: database.databaseFacade() });
  const run = await conchoRun(store, { idempotencyKey: 'attempt-resume-stop', generation: 71 });
  const runId = run.run_id;

  // Attempt 1: the worker is asked to stop once part 1 of the first long
  // section has completed; the runner leaves with the stop and the section
  // is handed back, not failed.
  const first = countingModel({ stopAfterFirstPart: true });
  const log = [];
  await assert.rejects(runAgreementDraftAnalysis({
    runId, store, legalSchema: schema, model: first, workerId: FIRST_WORKER, leaseSeconds: 300,
    stopRequested: () => first.state.stop, log: (event) => log.push(event),
  }), (error) => resume.isWorkerStopRequested(error));
  const partsTotal = first.state.partsTotal;
  assert.ok(partsTotal >= 2, 'Concho has a section the runner extracts in parts under LONG_SECTION_SPLIT');
  // The section the stop fell on: the one row handed back.
  const pending = (await client().query("SELECT node_id FROM public.product_section_work WHERE run_id=$1 AND status='PENDING' AND error_history <> '[]'::jsonb", [runId])).rows;
  assert.equal(pending.length, 1);
  const node = pending[0].node_id;
  const reference = await sectionReference(store, runId, node);
  const stopped = await workRow(runId, node);
  assert.equal(stopped.status, 'PENDING');
  assert.equal(stopped.attempts, 0, 'the attempt is refunded');
  assert.equal(stopped.worker_id, null);
  assert.equal(stopped.attempt_token, null);
  assert.equal(stopped.error, null);
  assert.equal(stopped.error_history.length, 1);
  const record = stopped.error_history[0];
  assert.match(record.attempt_token, /^[0-9a-f-]{36}$/);
  assert.equal(record.worker_id, FIRST_WORKER);
  assert.equal(record.attempt, 1);
  assert.deepEqual({ code: record.reason.code, parts_completed: record.reason.parts_completed, parts_total: record.reason.parts_total, kinds: record.reason.kinds, calls: record.reason.calls },
    { code: 'WORKER_STOPPED', parts_completed: [1], parts_total: partsTotal, kinds: ['ROUTING', 'RESIDUAL', 'EXTRACTION'], calls: 3 });
  const attemptOneCalls = await callRows(runId, node);
  assert.deepEqual(attemptOneCalls.map((row) => row.call_kind).sort(), ['EXTRACTION', 'RESIDUAL', 'ROUTING']);
  const ownInvocations = resume.attemptInvocations(record.attempt_token);
  assert.ok(attemptOneCalls.every((row) => ownInvocations.has(row.invocation_id)), 'the calls carry the interrupted attempt\'s identities');
  assert.ok(attemptOneCalls.every((row) => row.resumed_from_model_call_id === null));
  assert.ok(log.some((event) => event.event === 'ATTEMPT_RELEASED' && event.node_id === node && event.parts_completed.length === 1));
  const runRow = (await client().query('SELECT status FROM public.product_analysis_runs WHERE run_id=$1', [runId])).rows[0];
  assert.notEqual(runRow.status, 'FAILED', 'a stop is not a failure of the run');
  const completedBefore = Number((await client().query("SELECT count(*) FROM public.product_section_work WHERE run_id=$1 AND status='COMPLETE'", [runId])).rows[0].count);

  // Attempt 2, a plain resume: routing, residual and part 1 come from the
  // store; the provider is asked for the other parts only.
  const second = countingModel();
  const resumeLog = [];
  const analysis = await runAgreementDraftAnalysis({
    runId, store, legalSchema: schema, model: second, workerId: SECOND_WORKER, leaseSeconds: 300,
    log: (event) => resumeLog.push(event),
  });
  assert.equal(analysis.status, 'READY');
  const providerCallsForSection = second.state.calls.filter((call) => call.reference === reference);
  assert.deepEqual(providerCallsForSection.map((call) => `${call.call_kind}${call.part ? `:${call.part}` : ''}`),
    Array.from({ length: partsTotal - 1 }, (_, index) => `EXTRACTION:${index + 2}`), 'only the parts after the first went to the provider');
  assert.ok(resumeLog.some((event) => event.event === 'ATTEMPT_RESUMABLE' && event.node_id === node && event.reusable_calls === 3));
  const reusedEvent = resumeLog.find((event) => event.event === 'CALLS_REUSED' && event.node_id === node);
  assert.deepEqual(reusedEvent.reused.map((item) => `${item.call_kind}${item.part ? `:${item.part}` : ''}`), ['ROUTING', 'RESIDUAL', 'EXTRACTION:1']);

  // The committed attempt's records: its own calls plus one record per
  // reused call under its own identities, naming the originals, spending
  // nothing; the section's cost is the new parts alone.
  const done = await workRow(runId, node);
  assert.equal(done.status, 'COMPLETE');
  assert.equal(done.attempts, 1);
  const allCalls = await callRows(runId, node);
  const committed = resume.attemptInvocations(done.attempt_token);
  const committedCalls = allCalls.filter((row) => committed.has(row.invocation_id));
  assert.equal(committedCalls.length, partsTotal + 2);
  const resumed = committedCalls.filter((row) => row.resumed_from_model_call_id);
  assert.deepEqual(resumed.map((row) => row.call_kind).sort(), ['EXTRACTION', 'RESIDUAL', 'ROUTING']);
  for (const row of resumed) {
    const source = attemptOneCalls.find((candidate) => candidate.model_call_id === row.resumed_from_model_call_id);
    assert.ok(source, 'the original of the same section and kind');
    assert.equal(source.call_kind, row.call_kind);
    assert.deepEqual(row.request, source.request);
    assert.deepEqual(row.response, source.response);
    assert.deepEqual([Number(row.input_tokens), Number(row.output_tokens), Number(row.cost_microusd)], [0, 0, 0]);
  }
  // The row's cost is the section's whole spend: the interrupted attempt's
  // three calls plus the new parts; the reused calls add nothing.
  const spend = (rows) => rows.reduce((sum, row) => sum + Number(row.cost_microusd), 0);
  const newSpend = spend(committedCalls.filter((row) => !row.resumed_from_model_call_id));
  assert.ok(newSpend > 0);
  assert.equal(spend(resumed), 0);
  assert.equal(Number(done.cost_microusd), spend(attemptOneCalls) + newSpend);
  assert.equal(allCalls.length, partsTotal + 2 + 3, 'the interrupted attempt\'s three records stay');
  // Read back as the Review reads: the section's calls are the committed
  // ones, every proposal cites a call of the committed attempt.
  // (the section's calls across its attempts, as the read lists them, the
  // three reused records among them).
  const results = await store.loadCompletedSectionResults(runId);
  const section = results.find((result) => result.node_id === node);
  assert.equal(section.model_calls.length, partsTotal + 2 + 3);
  const callIds = new Set(section.model_calls.map((call) => call.model_call_id));
  assert.ok(section.proposals.every((proposal) => callIds.has(proposal.model_call_id)));
  assert.equal(section.model_calls.filter((call) => call.resumed_from_model_call_id).length, 3);
  const committedIds = new Set(committedCalls.map((row) => row.model_call_id));
  assert.ok(section.proposals.every((proposal) => committedIds.has(proposal.model_call_id)), 'every proposal cites a call of the committed attempt');
  const counts = (await client().query("SELECT status, count(*)::int AS n FROM public.product_section_work WHERE run_id=$1 GROUP BY status", [runId])).rows;
  assert.deepEqual(counts, [{ status: 'COMPLETE', n: counts[0].n }], 'every section is complete on the resumed run');
  assert.ok(counts[0].n > completedBefore + 1, 'the sections after the stopped one were done on the resumed run');
});

test('a worker that starts after a restart hands back a dead process\'s claim with its record; the lease recovery writes the attempt on the history; a failure carries its token', async () => {
  const store = new ProductPhase2Store({ client: database.databaseFacade() });
  const run = await conchoRun(store, { idempotencyKey: 'attempt-resume-dead-claim', generation: 72 });
  const runId = run.run_id;
  const dead = `product-hosted:${SANDBOX}:999999:2`;
  const claim = await store.claimNextSection({ runId, workerId: dead, leaseSeconds: 300 });
  assert.ok(claim);
  // The dead attempt had recorded its routing call.
  const body = {
    schema_version: MODEL_CALL_VERSION, call_kind: 'ROUTING', prompt_version: 'PRODUCT_PHASE2/V1', provider_id: 'synthetic-test', model_id: 'SYNTHETIC_LEGAL_MODEL/V1',
    structure_node_id: claim.node_id, request: { section: { node_id: claim.node_id }, section_reference: '1.1' }, response: { families: [] },
    invocation_id: resume.invocationId(claim.attempt_token, 'ROUTING'), input_tokens: 10, output_tokens: 2, cost_microusd: 30, duration_ms: 5,
  };
  await store.recordModelCall({ runId, nodeId: claim.node_id, workerId: dead, attemptToken: claim.attempt_token, call: { ...body, model_call_id: contentId(MODEL_CALL_VERSION, body) } });
  // Another sandbox's live claim is left alone.
  const otherClaim = await store.claimNextSection({ runId, workerId: 'product-hosted:pm-codex-preview-worker-2:5:1', leaseSeconds: 300 });
  assert.ok(otherClaim);
  const released = await resume.releaseDeadClaims({ store, runId, sandbox: SANDBOX, isAlive: () => false });
  assert.deepEqual(released.map((entry) => [entry.node_id, entry.kinds, entry.parts_completed]), [[claim.node_id, ['ROUTING'], []]]);
  const row = await workRow(runId, claim.node_id);
  assert.deepEqual([row.status, row.attempts, row.worker_id, row.attempt_token], ['PENDING', 0, null, null]);
  assert.equal(row.error_history.length, 1);
  assert.equal(row.error_history[0].reason.code, 'WORKER_RESTART');
  assert.equal(row.error_history[0].reason.dead_worker_id, dead);
  assert.equal(row.error_history[0].attempt_token, claim.attempt_token);
  assert.equal((await workRow(runId, otherClaim.node_id)).status, 'RUNNING');
  // Its routing call is reusable by the next attempt.
  const reusable = resume.resumableCalls({ errorHistory: row.error_history, calls: await callRows(runId, claim.node_id) });
  assert.equal(reusable.size, 1);

  // The lease recovery: the expired attempt goes on the history with its token.
  const again = await store.claimNextSection({ runId, workerId: FIRST_WORKER, leaseSeconds: 300 });
  assert.equal(again.node_id, claim.node_id);
  await client().query("UPDATE public.product_section_work SET lease_expires_at = now() - interval '1 second' WHERE run_id=$1 AND node_id=$2", [runId, again.node_id]);
  const recovered = await store.recoverExpiredSections({ runId });
  assert.equal(recovered.recovered_sections, 1);
  const expired = await workRow(runId, again.node_id);
  assert.equal(expired.status, 'FAILED');
  assert.equal(expired.attempts, 1, 'a lease lost counts, as before');
  assert.equal(expired.error_history.length, 2);
  assert.equal(expired.error_history[1].attempt_token, again.attempt_token);
  assert.equal(expired.error_history[1].error.code, 'SECTION_LEASE_EXPIRED');
  assert.ok(expired.error_history[1].error.lease_expired_at);
  assert.equal(expired.error_history[1].worker_id, FIRST_WORKER);
  assert.ok(resume.resumableInvocations(expired.error_history).size > 0);

  // A failure on a part names its token too.
  const third = await store.claimNextSection({ runId, workerId: SECOND_WORKER, leaseSeconds: 300 });
  assert.equal(third.node_id, claim.node_id);
  const failure = new Error('ANTHROPIC_API_OUTPUT_TRUNCATED: the answer ran past the output cap');
  failure.code = 'ANTHROPIC_API_OUTPUT_TRUNCATED';
  failure.extraction_part = { part: 2, of: 3, mode: 'limbs', span_ids: ['x'] };
  await store.failSection({ runId, nodeId: third.node_id, workerId: SECOND_WORKER, attemptToken: third.attempt_token, error: failure, modelCalls: [] });
  const failed = await workRow(runId, third.node_id);
  assert.equal(failed.error_history[2].attempt_token, third.attempt_token);
  assert.equal(failed.error_history[2].error.part.part, 2);
  const eligible = [...resume.resumableInvocations([failed.error_history[2]]).values()].map((meta) => `${meta.kind}${meta.part ? `:${meta.part}` : ''}`).sort();
  assert.deepEqual(eligible, ['EXTRACTION', 'EXTRACTION:1', 'RESIDUAL', 'ROUTING']);

  // The release refuses a stale token.
  const fourth = await store.claimNextSection({ runId, workerId: SECOND_WORKER, leaseSeconds: 300 });
  await client().query('SAVEPOINT release_checks');
  await assert.rejects(store.releaseSection({ runId, nodeId: fourth.node_id, workerId: SECOND_WORKER, attemptToken: claim.attempt_token, reason: { code: 'WORKER_STOPPED' } }), /stale section attempt/);
  await client().query('ROLLBACK TO SAVEPOINT release_checks');
  await client().query('SAVEPOINT release_checks');
  await assert.rejects(store.releaseSection({ runId, nodeId: fourth.node_id, workerId: SECOND_WORKER, attemptToken: fourth.attempt_token, reason: {} }), /invalid section release input/);
  await client().query('ROLLBACK TO SAVEPOINT release_checks');

  // The admission of a resumed call: the original must exist for the
  // section and kind, and the record spends nothing.
  const craft = (overrides) => {
    const draft = { ...body, structure_node_id: fourth.node_id, request: { section: { node_id: fourth.node_id } }, invocation_id: resume.invocationId(fourth.attempt_token, 'ROUTING'), ...overrides };
    return { ...draft, model_call_id: contentId(MODEL_CALL_VERSION, draft) };
  };
  await client().query('SAVEPOINT resumed_admission');
  await assert.rejects(store.recordModelCall({ runId, nodeId: fourth.node_id, workerId: SECOND_WORKER, attemptToken: fourth.attempt_token,
    call: craft({ resumed_from_model_call_id: 'f'.repeat(64), input_tokens: 0, output_tokens: 0, cost_microusd: 0 }) }), /invalid resumed product model call/);
  await client().query('ROLLBACK TO SAVEPOINT resumed_admission');
  const original = (await callRows(runId, claim.node_id))[0];
  await client().query('SAVEPOINT resumed_admission');
  await assert.rejects(store.recordModelCall({ runId, nodeId: fourth.node_id, workerId: SECOND_WORKER, attemptToken: fourth.attempt_token,
    call: craft({ resumed_from_model_call_id: original.model_call_id, input_tokens: 0, output_tokens: 0, cost_microusd: 30 }) }), /invalid resumed product model call/);
  await client().query('ROLLBACK TO SAVEPOINT resumed_admission');
  await client().query('SAVEPOINT resumed_admission');
  await assert.rejects(store.recordModelCall({ runId, nodeId: fourth.node_id, workerId: SECOND_WORKER, attemptToken: fourth.attempt_token,
    call: craft({ resumed_from_model_call_id: 'short', input_tokens: 0, output_tokens: 0, cost_microusd: 0 }) }), /invalid product model call/);
  await client().query('ROLLBACK TO SAVEPOINT resumed_admission');
  const costBefore = Number((await workRow(runId, fourth.node_id)).cost_microusd);
  assert.equal((await store.recordModelCall({ runId, nodeId: fourth.node_id, workerId: SECOND_WORKER, attemptToken: fourth.attempt_token,
    call: craft({ resumed_from_model_call_id: original.model_call_id, input_tokens: 0, output_tokens: 0, cost_microusd: 0 }) })).inserted, true);
  const stored = (await callRows(runId, fourth.node_id)).find((row) => row.resumed_from_model_call_id);
  assert.equal(stored.resumed_from_model_call_id, original.model_call_id);
  assert.equal(Number((await workRow(runId, fourth.node_id)).cost_microusd), costBefore, 'a resumed call adds nothing to the section\'s cost');
});
