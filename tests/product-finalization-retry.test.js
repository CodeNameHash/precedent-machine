'use strict';

// Work package 37 (plan finding (250)): the draft finalisation fails
// intermittently on the preview database. Apogee 88d4032a reached READY and
// was then written FAILED by a DATABASE_ERROR after the draft existed, and
// DeepSeek 34847358 failed three times ("canceling statement due to
// statement timeout") before a later attempt held; both were cured by
// spending the retry route, and the route itself answered 500 for a retry it
// had already applied because the read that builds its reply timed out. The
// finalise is idempotent in the database
// (product_phase2_finalize_saved_run returns the stored draft on a second
// call with the same identity and payload hash), so the worker retries a
// transient failure itself, and the route reports an applied retry as
// applied.

const assert = require('node:assert/strict');
const test = require('node:test');
const { FINALIZATION_ATTEMPTS, finalizeWithRetries, isRetryableFinalizationError } = require('../lib/product/analysis-runner');
const { createProductRunHandler } = require('../lib/product/run-handler');

function responseDouble() {
  const response = {
    statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return response;
}

test('a transient finalisation failure is retried by the worker, a deterministic one is reported at once', async () => {
  assert.equal(FINALIZATION_ATTEMPTS >= 2, true);
  // The three messages the two deals recorded, and the classes around them.
  for (const message of [
    'canceling statement due to statement timeout',
    'upstream request timeout',
    'fetch failed',
    'socket hang up',
    'ECONNRESET',
  ]) assert.equal(isRetryableFinalizationError(new Error(message)), true, message);
  // A draft the database refuses on its content is not a timing failure.
  for (const message of [
    'AgreementDraft totals mismatch',
    'AgreementDraft identity mismatch',
    'AgreementDraft collision',
    'section work is incomplete',
    'invalid AgreementDraft finalization',
  ]) assert.equal(isRetryableFinalizationError(new Error(message)), false, message);

  // Two timeouts, then the write holds: three attempts, no failure surfaced,
  // and each retry is on the log with its wait.
  const seen = [];
  const logged = [];
  let calls = 0;
  const value = await finalizeWithRetries({
    runId: 'run-1',
    log: (entry) => logged.push(entry),
    delay: async (ms) => { seen.push(ms); },
    attempt: async () => {
      calls += 1;
      if (calls < 3) throw new Error('canceling statement due to statement timeout');
      return 'draft';
    },
  });
  assert.equal(value, 'draft');
  assert.equal(calls, 3);
  assert.deepEqual(seen, [2000, 4000]);
  assert.deepEqual(logged.map((entry) => [entry.event, entry.attempt, entry.next_in_ms]), [
    ['FINALIZATION_RETRY', 1, 2000],
    ['FINALIZATION_RETRY', 2, 4000],
  ]);

  // Every attempt failing: the last error is the one reported, after the
  // attempts are spent.
  let spent = 0;
  await assert.rejects(() => finalizeWithRetries({
    runId: 'run-1', delay: async () => {}, attempt: async () => { spent += 1; throw new Error('upstream request timeout'); },
  }), /upstream request timeout/);
  assert.equal(spent, FINALIZATION_ATTEMPTS);

  // A deterministic failure is attempted once.
  let once = 0;
  await assert.rejects(() => finalizeWithRetries({
    runId: 'run-1', delay: async () => {}, attempt: async () => { once += 1; throw new Error('AgreementDraft totals mismatch'); },
  }), /totals mismatch/);
  assert.equal(once, 1);
});

const { CODEX_MODEL_CONFIG } = require('../lib/product/product-model-config');

// The route's 202 branch is for the hosted reply read: the retry applied,
// the wake was sent, and the read that builds the reply failed (Apogee
// 88d4032a, 2026-10-23: the route answered 500 for a retry it had already
// applied because that read timed out). The review of 2026-10-25
// (findings 5 and 6) found two holes: a retry that changed nothing was
// reported as applied, and a genuine advance failure after an applied
// retry was hidden as a 202.
test('a retry the run route has applied is not reported as a failed retry when the read after it times out', async () => {
  const runId = '2f2b6f2e-6d3e-4c2b-9d1c-1a2b3c4d5e6f';
  let retried = null;
  let status = 'FAILED';
  let woken = 0;
  const store = {
    assertAccess: async () => 'OWNER',
    retryRun: async ({ idempotencyKey }) => { retried = idempotencyKey; status = 'RUNNING'; return { status: 'RUNNING', stage: 'DRAFT_FINALIZATION' }; },
    getRun: async () => ({ run_id: runId, status, stage: 'DRAFT_FINALIZATION', model_config: { ...CODEX_MODEL_CONFIG } }),
    getRunContext: async () => { throw new Error('not read on the hosted path'); },
    // The read the route builds its reply from: this is what timed out on
    // 88d4032a after the retry had already applied.
    getAgreementAnalysis: async () => { throw new Error('upstream request timeout'); },
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test',
    modelConfigResolver: () => CODEX_MODEL_CONFIG,
    databaseUrlResolver: () => 'postgres://db', serviceRoleKeyResolver: () => 'key',
    wakeRun: async () => { woken += 1; return { command_id: 'command-1' }; },
    modelFactory: () => ({ complete: async () => { throw new Error('model must not run'); } }),
  });
  const originalError = console.error;
  console.error = () => {};
  const response = responseDouble();
  try {
    await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: { retry: true, idempotency_key: 'apogee-finalisation-retry-1' } }, response);
  } finally { console.error = originalError; }
  assert.equal(retried, 'apogee-finalisation-retry-1');
  assert.equal(woken, 1, 'the wake was sent: the retry applied and the run advances');
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.retry_applied, true);
  assert.equal(response.body.run_id, runId);
  assert.equal(response.body.status, 'RUNNING');
  assert.equal(response.body.warning, 'RETRY_APPLIED_READ_INCOMPLETE');
});

test('a retry that changed nothing is not reported as applied', async () => {
  const runId = '2f2b6f2e-6d3e-4c2b-9d1c-1a2b3c4d5e6f';
  // A READY run: product_phase3_retry_run answers it unchanged.
  const store = {
    assertAccess: async () => 'OWNER',
    retryRun: async () => ({ status: 'READY', stage: 'READY' }),
    getRun: async () => ({ run_id: runId, status: 'READY', stage: 'READY', model_config: { ...CODEX_MODEL_CONFIG } }),
    getAgreementAnalysis: async () => { throw new Error('upstream request timeout'); },
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test',
    modelConfigResolver: () => CODEX_MODEL_CONFIG,
    wakeRun: async () => { throw new Error('a READY run is not woken'); },
  });
  const originalError = console.error;
  console.error = () => {};
  const response = responseDouble();
  try {
    await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: { retry: true, idempotency_key: 'spent' } }, response);
  } finally { console.error = originalError; }
  assert.equal(response.statusCode, 500, 'no retry was applied, so a failed read is a failure');
  assert.equal(response.body.error, 'Product analysis could not advance');
});

test('a genuine advance failure after an applied retry stays a 500 and is logged', async () => {
  const runId = '2f2b6f2e-6d3e-4c2b-9d1c-1a2b3c4d5e6f';
  let status = 'FAILED';
  let logged = 0;
  const store = {
    assertAccess: async () => 'OWNER',
    retryRun: async () => { status = 'RUNNING'; return { status: 'RUNNING', stage: 'DRAFT_FINALIZATION' }; },
    getRun: async () => ({ run_id: runId, status, stage: 'DRAFT_FINALIZATION', model_config: { provider_id: CODEX_MODEL_CONFIG.provider_id } }),
    getAgreementAnalysis: async () => ({ kind: 'analysisProgress' }),
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test',
    modelConfigResolver: () => CODEX_MODEL_CONFIG,
    databaseUrlResolver: () => 'postgres://db', serviceRoleKeyResolver: () => 'key',
    wakeRun: async () => { throw new Error('sandbox wake refused'); },
  });
  const originalError = console.error;
  console.error = () => { logged += 1; };
  const response = responseDouble();
  try {
    await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: { retry: true, idempotency_key: 'k' } }, response);
  } finally { console.error = originalError; }
  assert.equal(response.statusCode, 500);
  assert.ok(logged >= 1, 'the failure is on the deployment log');
});

test('a run route failure that is not a retry is still a 500', async () => {
  const runId = '2f2b6f2e-6d3e-4c2b-9d1c-1a2b3c4d5e6f';
  const store = {
    assertAccess: async () => 'OWNER',
    getRunContext: async () => ({ sourceDocument: { canonical_text: '' }, agreementStructure: { nodes: [] } }),
    claimNextSection: async () => { throw new Error('upstream request timeout'); },
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test',
    modelFactory: () => ({ complete: async () => { throw new Error('model must not run'); } }),
  });
  const response = responseDouble();
  const originalError = console.error;
  console.error = () => {};
  try {
    await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: {} }, response);
  } finally { console.error = originalError; }
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error, 'Product analysis could not advance');
});

// Work package 39 (the review of 2026-10-25, blocker): the finalise is
// idempotent, the cross-section staging before it is not — the staging RPC
// refuses a run that already has a draft row, so a retry after a committed
// but timed-out finalise used to fail at the staging call and fall to
// FAILED with the draft in place. finalizeDraft now stages only when the
// run has no draft row.
test('a retried finalise does not stage cross-section relationships again when a draft already exists', async () => {
  const { ProductPhase2Store } = require('../lib/product/phase-2-store');
  const drafted = (hasDraft) => {
    const calls = [];
    const client = {
      from: (table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
        calls.push(`select:${table}`);
        return { data: hasDraft ? { draft_analysis_id: 'd'.repeat(64) } : null, error: null };
      } }) }) }),
      rpc: async (name) => { calls.push(`rpc:${name}`); return { data: { run: { status: 'READY' } }, error: null }; },
    };
    return { calls, store: new ProductPhase2Store({ client }) };
  };
  const draft = {
    draft_analysis_id: 'x'.repeat(64),
    source_document_id: 's'.repeat(64),
    agreement_structure_id: 'a'.repeat(64),
    legal_schema_version: 'LEGAL_SCHEMA/V2',
    totals: {}, issues: [], coverage_assertions: [], sections: [], residual_passes: [],
    model_calls: [], source_closures: [], spans: [], section_routings: [],
    proposition_groups: [], proposals: [],
    fact_links: [{ schema_version: 'PRODUCT_FACT_LINK/V2', source_span_ids: [], target_source_span_ids: [], relationship_type: 'QUALIFIES', from_proposal_id: 'a', to_proposal_id: 'b' }],
  };
  // No draft yet: staging runs, then the finalise.
  const first = drafted(false);
  await first.store.finalizeDraft({ runId: '2f2b6f2e-6d3e-4c2b-9d1c-1a2b3c4d5e6f', draft });
  assert.deepEqual(first.calls, ['select:product_draft_analyses', 'rpc:product_phase2_stage_cross_section_relationships', 'rpc:product_phase2_finalize_saved_run']);
  // The first attempt committed and its response timed out: the retry finds
  // the draft, stages nothing, and the finalise answers with the stored one.
  const retried = drafted(true);
  await retried.store.finalizeDraft({ runId: '2f2b6f2e-6d3e-4c2b-9d1c-1a2b3c4d5e6f', draft });
  assert.deepEqual(retried.calls, ['select:product_draft_analyses', 'rpc:product_phase2_finalize_saved_run']);
});
