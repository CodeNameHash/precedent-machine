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

test('a retry the run route has applied is not reported as a failed retry when the read after it times out', async () => {
  const runId = '2f2b6f2e-6d3e-4c2b-9d1c-1a2b3c4d5e6f';
  let retried = null;
  const store = {
    assertAccess: async () => 'OWNER',
    retryRun: async ({ idempotencyKey }) => { retried = idempotencyKey; return { status: 'RUNNING' }; },
    getRun: async () => ({ run_id: runId, status: 'RUNNING', stage: 'DRAFT_FINALIZATION' }),
    getRunContext: async () => ({ sourceDocument: { canonical_text: '' }, agreementStructure: { nodes: [] } }),
    claimNextSection: async () => null,
    getProgress: async () => ({ total: 1, completed: 1, failed: 0 }),
    loadCompletedSectionResults: async () => [],
    // The read the route builds its reply from: this is what timed out on
    // 88d4032a after the retry had already applied.
    getAgreementAnalysis: async () => { throw new Error('upstream request timeout'); },
  };
  const handler = createProductRunHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test',
    modelFactory: () => ({ complete: async () => { throw new Error('model must not run'); } }),
  });
  const response = responseDouble();
  await handler({ method: 'POST', query: { id: runId }, headers: { 'x-pm-csrf': 'same-origin' }, body: { retry: true, idempotency_key: 'apogee-finalisation-retry-1' } }, response);
  assert.equal(retried, 'apogee-finalisation-retry-1');
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.retry_applied, true);
  assert.equal(response.body.run_id, runId);
  assert.equal(response.body.status, 'RUNNING');
  assert.equal(response.body.warning, 'RETRY_APPLIED_READ_INCOMPLETE');
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
