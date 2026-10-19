'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { parseArguments, runHostedWorker } = require('../scripts/product-hosted-worker');
const { ANTHROPIC_API_MODEL_CONFIG, CLAUDE_CLI_MODEL_CONFIG, CODEX_MODEL_CONFIG } = require('../lib/product/product-model-config');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { substantiveSections } = require('../lib/product/source-context');
const { isWorkerStopError, workerStopReason } = require('../lib/product/worker-stop');

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';
const { conchoSource } = require('./product-phase-2.test');
delete process.env.PRODUCT_PHASE2_HELPER_ONLY;

const id = '11111111-1111-4111-8111-111111111111';
const options = { runId: id, actor: 'ben', workers: 2 };
const output = { write() {} };
let priorEnvironment;

test.beforeEach(() => {
  priorEnvironment = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.SUPABASE_URL = 'https://ecrtoofsyxozazkvsvcl.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-service-key';
});
test.afterEach(() => {
  for (const [key, value] of Object.entries(priorEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function analysis(status = 'RUNNING', completed = 0) {
  return { status, stage: status === 'READY' ? 'READY' : 'SECTION_ANALYSIS',
    progress: { completed, total: 4, failed: status === 'FAILED' ? 1 : 0 } };
}

function dependencies(advance, runOverrides = {}) {
  const stores = [];
  const models = [];
  return {
    stores, models, advance,
    createStore() {
      const store = {
        getRun: async () => ({ run_id: id, status: 'RUNNING', stage: 'SECTION_ANALYSIS',
          model_config: CODEX_MODEL_CONFIG, ...runOverrides }),
        assertAccess: async ({ actor }) => assert.equal(actor, 'ben'),
        recoverExpiredSections: async () => {},
      };
      stores.push(store);
      return store;
    },
    createModel(input) {
      const model = { input };
      models.push(model);
      return model;
    },
  };
}

test('hosted worker accepts only bounded pool sizes and defaults to two', () => {
  assert.equal(parseArguments(['--run-id', id, '--actor', 'ben']).workers, 2);
  assert.equal(parseArguments(['--run-id', id, '--actor', 'ben', '--workers', '1']).workers, 1);
  assert.equal(parseArguments(['--run-id', id, '--actor', 'ben', '--workers', '2']).workers, 2);
  assert.equal(parseArguments(['--run-id', id, '--actor', 'ben', '--workers', '8']).workers, 8, 'work package E1: up to eight loops');
  assert.throws(() => parseArguments(['--run-id', id, '--actor', 'ben', '--workers', '9']), /workers must be 1 to 8/);
  assert.throws(() => parseArguments(['--run-id', id, '--actor', 'ben', '--workers', '0']), /workers must be 1 to 8/);
});

test('ready hosted run exits before creating workers', async () => {
  const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://ecrtoofsyxozazkvsvcl.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(20);
  let models = 0;
  try {
    const result = await runHostedWorker({ runId: id, actor: 'ben', workers: 2 }, { write() {} }, {
      createStore: () => ({ getRun: async () => ({ run_id: id, status: 'READY', stage: 'READY', source_document_id: 'x', model_config: CODEX_MODEL_CONFIG }), assertAccess: async () => {} }),
      createModel: () => { models += 1; },
    });
    assert.equal(result.status, 'READY'); assert.equal(models, 0);
  } finally { process.env.SUPABASE_URL = oldUrl; process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey; }
});

test('failed hosted run requires explicit retry', async () => {
  const oldUrl = process.env.SUPABASE_URL; const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://ecrtoofsyxozazkvsvcl.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(20);
  try {
    await assert.rejects(() => runHostedWorker({ runId: id, actor: 'ben', workers: 2 }, { write() {} }, {
      createStore: () => ({ getRun: async () => ({ run_id: id, status: 'FAILED', stage: 'SECTION_ANALYSIS', source_document_id: 'x', model_config: CODEX_MODEL_CONFIG }), assertAccess: async () => {} }),
    }), /EXPLICIT_RETRY_REQUIRED/);
  } finally { process.env.SUPABASE_URL = oldUrl; process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey; }
});

test('database, model, actor, worker count and identity checks run before claims', async () => {
  for (const invalid of [{ ...options, actor: 'other' }, { ...options, runId: 'bad' },
    { ...options, workers: 0 }, { ...options, workers: 9 }]) {
    await assert.rejects(runHostedWorker(invalid, output, {}), /invalid hosted worker options/);
  }
  const unsafe = dependencies(() => assert.fail('unexpected claim'));
  process.env.SUPABASE_URL = 'https://tzulhdasmioeechxapdy.supabase.co';
  await assert.rejects(runHostedWorker(options, output, unsafe), /DATABASE_TARGET/);
  assert.equal(unsafe.stores.length, 0);
  process.env.SUPABASE_URL = 'https://ecrtoofsyxozazkvsvcl.supabase.co';
  const wrongModel = dependencies(null, { model_config: {} });
  await assert.rejects(runHostedWorker(options, output, wrongModel), /MODEL_CONFIG_MISMATCH/);
  const identity = dependencies(null, { stage: 'DOCUMENT_IDENTITY_REVIEW' });
  await assert.rejects(runHostedWorker(options, output, identity), /IDENTITY_REVIEW_REQUIRED/);
  const forbidden = dependencies(null);
  const makeStore = forbidden.createStore;
  forbidden.createStore = () => ({ ...makeStore(), assertAccess: async () => { throw new Error('ACCESS_DENIED'); } });
  await assert.rejects(runHostedWorker(options, output, forbidden), /ACCESS_DENIED/);
  assert.equal(forbidden.models.length, 0);
});

test('two independent workers stay bounded and drain before returning READY', async () => {
  const waiting = [];
  const calls = [];
  let active = 0;
  let maximum = 0;
  const deps = dependencies(async (call) => {
    calls.push(call);
    active += 1;
    maximum = Math.max(maximum, active);
    const pending = deferred();
    waiting.push(pending);
    const result = await pending.promise;
    active -= 1;
    return result;
  });
  const task = runHostedWorker(options, output, deps);
  await nextTurn();
  assert.equal(calls.length, 2);
  assert.equal(maximum, 2);
  assert.notEqual(calls[0].store, calls[1].store);
  assert.notEqual(calls[0].model, calls[1].model);
  // The model factory receives the run record and follows its provider.
  assert.deepEqual(calls[0].model.input.model_config, CODEX_MODEL_CONFIG);
  assert.deepEqual(calls[1].model.input.model_config, CODEX_MODEL_CONFIG);
  assert.notEqual(calls[0].workerId, calls[1].workerId);
  waiting[0].resolve(analysis('RUNNING', 1));
  await nextTurn();
  assert.equal(calls.length, 3);
  waiting[1].resolve(analysis('READY', 4));
  await nextTurn();
  let settled = false;
  task.then(() => { settled = true; });
  await nextTurn();
  assert.equal(settled, false);
  waiting[2].resolve(analysis('READY', 4));
  assert.equal((await task).status, 'READY');
  assert.equal(maximum, 2);
  assert.equal(active, 0);
  assert.equal(calls.length, 3);
});

test('failure stops new claims while an in-flight section is saved before rejection', async () => {
  for (const failWithStatus of [false, true]) {
    const waiting = [];
    const saved = [];
    const deps = dependencies(async () => {
      const pending = deferred();
      const number = waiting.length;
      waiting.push(pending);
      const result = await pending.promise;
      if (result.status !== 'FAILED') saved.push(number);
      return result;
    });
    let settled = false;
    const task = runHostedWorker(options, output, deps).then(
      () => { assert.fail('failure was suppressed'); },
      (error) => { settled = true; return error; },
    );
    await nextTurn();
    assert.equal(waiting.length, 2);
    if (failWithStatus) waiting[0].resolve(analysis('FAILED'));
    else waiting[0].reject(new Error('provider failed'));
    await nextTurn();
    assert.equal(settled, false);
    waiting[1].resolve(analysis('RUNNING', 1));
    const error = await task;
    assert.match(error.message, failWithStatus ? /RUN_FAILED/ : /provider failed/);
    assert.deepEqual(saved, [1]);
    assert.equal(waiting.length, 2);
  }
});

// Metsera generation 5, 2026-09-14 04:59 UTC: the ChatGPT login hit its
// usage limit; three attempts in three seconds were recorded as "codex
// exited 1: " and the run FAILED with no reason. The worker stops and
// names the limit.
test('a usage limit stops the worker with its own reason', async () => {
  const deps = dependencies(async () => { throw new Error("codex exited 1: You've hit your usage limit. Visit https://chatgpt.com/codex/settings/usage"); });
  await assert.rejects(runHostedWorker(options, output, deps), /PRODUCT_HOSTED_CODEX_USAGE_LIMIT: codex exited 1: You've hit your usage limit/);
});

test('unchanged progress waits instead of repeatedly querying the database', async () => {
  const times = [];
  const deps = dependencies(async () => {
    times.push(Date.now());
    return analysis(times.length === 3 ? 'READY' : 'RUNNING');
  });
  assert.equal((await runHostedWorker({ ...options, workers: 1 }, output, deps)).status, 'READY');
  assert.equal(times.length, 3);
  assert.ok(times[2] - times[1] >= 900, 'unchanged progress must wait approximately one second');
});

// Work package 3: a run on the API provider needs the key the wake passed
// into the sandbox; without it the worker stops before any claim, as the
// Claude CLI path does without its login.
test('an API-provider run requires ANTHROPIC_API_KEY before any claim', async () => {
  const priorKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const deps = dependencies(() => assert.fail('unexpected claim'), { model_config: ANTHROPIC_API_MODEL_CONFIG });
    await assert.rejects(runHostedWorker(options, output, deps), /PRODUCT_HOSTED_ANTHROPIC_API_KEY_REQUIRED/);
    assert.equal(deps.models.length, 0);
  } finally {
    if (priorKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = priorKey;
  }
});

// A key the API refuses for want of its workspace header is the
// deployment's configuration, not a section failure: the worker stops with
// its own reason (work package 11, plan finding (70)).
test('an API key without its workspace header stops the worker as not configured', async () => {
  const priorKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-'.repeat(3);
  try {
    const refused = Object.assign(new Error('ANTHROPIC_API_NOT_CONFIGURED: the API key is not scoped to a workspace and no ANTHROPIC_WORKSPACE_ID is set (400): 400 This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header'), { code: 'ANTHROPIC_API_NOT_CONFIGURED' });
    const deps = dependencies(async () => { throw refused; }, { model_config: ANTHROPIC_API_MODEL_CONFIG });
    await assert.rejects(runHostedWorker(options, output, deps), /PRODUCT_HOSTED_ANTHROPIC_API_NOT_CONFIGURED: ANTHROPIC_API_NOT_CONFIGURED: the API key is not scoped to a workspace .*anthropic-workspace-id header/);
  } finally {
    if (priorKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = priorKey;
  }
});

// A 429 (or an exhausted balance) on the API account stops the worker with
// the usage-limit reason, as the CLI paths' limits do, instead of burning
// attempts (work package 3).
test('an API account limit stops the worker with the usage-limit reason', async () => {
  const priorKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-'.repeat(3);
  try {
    const limit = new Error('ANTHROPIC_API_USAGE_LIMIT: usage limit on the API account (429): rate limit exceeded');
    const deps = dependencies(async () => { throw limit; }, { model_config: ANTHROPIC_API_MODEL_CONFIG });
    await assert.rejects(runHostedWorker(options, output, deps), /PRODUCT_HOSTED_CODEX_USAGE_LIMIT: ANTHROPIC_API_USAGE_LIMIT: usage limit on the API account \(429\)/);
  } finally {
    if (priorKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = priorKey;
  }
});

// Work package 11b (plan finding (73)). The live path: the worker's loop
// calls advanceAgreementDraftAnalysis, whose section loop records a failed
// attempt and returns the analysis, so a stop error never reached the
// worker's catch and the section was claimed again until its attempts were
// spent (NCS generation 5 on the API, 2026-10-18 13:11 UTC: three attempts
// for each of two sections in six seconds, then PRODUCT_HOSTED_RUN_FAILED).
// This store keeps the database's claim and failure rules in memory, with
// the real section loop and a model that refuses its first call.
async function conchoRunStore(runOverrides) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocument.source_document_id,
    canonical_text: sourceDocument.canonical_text,
    canonical_text_sha256: sourceDocument.canonical_text_sha256,
  });
  const run = { run_id: id, status: 'PENDING', stage: 'SECTION_ANALYSIS', source_document_id: sourceDocument.source_document_id, ...runOverrides };
  const work = substantiveSections(agreementStructure).map((node, index) => ({
    node_id: node.node_id, authored_order: index, status: 'PENDING', attempts: 0, max_attempts: 3, worker_id: null, attempt_token: null, error: null,
  }));
  const events = { claims: 0, failures: [], commits: 0 };
  let tokens = 0;
  const store = {
    work, run, events,
    getRun: async () => ({ ...run }),
    assertAccess: async ({ actor }) => assert.equal(actor, 'ben'),
    recoverExpiredSections: async () => {},
    getRunContext: async () => ({ run: { ...run }, sourceDocument, agreementStructure }),
    // product_phase1_claim_section: a PENDING or FAILED section with
    // attempts to spare, in authored order; the claim counts the attempt.
    claimNextSection: async ({ workerId }) => {
      if (['FAILED', 'READY'].includes(run.status)) return null;
      const next = work.find((item) => item.attempts < item.max_attempts && ['PENDING', 'FAILED'].includes(item.status));
      if (!next) return null;
      events.claims += 1;
      tokens += 1;
      Object.assign(next, { status: 'RUNNING', attempts: next.attempts + 1, worker_id: workerId, attempt_token: `token-${tokens}`, error: null });
      run.status = 'RUNNING';
      return { node_id: next.node_id, attempt_token: next.attempt_token };
    },
    renewSectionLease: async () => ({}),
    recordModelCall: async () => ({}),
    // product_phase2_fail_section: the section FAILED with its reason; the
    // run FAILED only when the section's attempts are spent, else PARTIAL.
    failSection: async ({ nodeId, attemptToken, error }) => {
      const item = work.find((entry) => entry.node_id === nodeId);
      assert.equal(item.attempt_token, attemptToken, 'the failing attempt is the claimed one');
      Object.assign(item, { status: 'FAILED', error: { message: error.message } });
      events.failures.push({ node_id: nodeId, attempts: item.attempts, message: error.message });
      run.status = item.attempts >= item.max_attempts ? 'FAILED' : 'PARTIAL';
      return { work: { ...item }, run: { ...run } };
    },
    commitSection: async () => { events.commits += 1; throw new Error('no section completes in this test'); },
    getProgress: async () => ({
      total: work.length, completed: work.filter((item) => item.status === 'COMPLETE').length,
      failed: work.filter((item) => item.status === 'FAILED').length, running: work.filter((item) => item.status === 'RUNNING').length,
      cost_microusd: 0, input_tokens: 0, output_tokens: 0,
    }),
    getAgreementAnalysis: async () => ({ status: run.status, stage: run.stage, progress: await store.getProgress() }),
  };
  return store;
}

function refusingModel(error) {
  const calls = [];
  return {
    calls,
    async complete(input) { calls.push(input.call_kind); throw error; },
  };
}

test('through the real section loop, a refused API configuration stops the worker after one attempt and leaves the run resumable', async () => {
  const priorKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-'.repeat(3);
  try {
    const store = await conchoRunStore({ model_config: ANTHROPIC_API_MODEL_CONFIG });
    const refused = Object.assign(new Error('ANTHROPIC_API_NOT_CONFIGURED: the API refused the key with the ANTHROPIC_WORKSPACE_ID header sent (400): 400 anthropic-workspace-id header must be a valid workspace ID.'), { code: 'ANTHROPIC_API_NOT_CONFIGURED' });
    const model = refusingModel(refused);
    const lines = [];
    await assert.rejects(
      runHostedWorker({ ...options, workers: 1 }, { write: (line) => lines.push(line) }, { createStore: () => store, createModel: () => model }),
      /^Error: PRODUCT_HOSTED_ANTHROPIC_API_NOT_CONFIGURED: ANTHROPIC_API_NOT_CONFIGURED: the API refused the key with the ANTHROPIC_WORKSPACE_ID header sent \(400\)/,
    );
    assert.deepEqual(model.calls, ['ROUTING'], 'one call: the first routing call');
    assert.equal(store.events.claims, 1, 'one attempt, one claim');
    const [first] = store.work;
    assert.equal(first.attempts, 1);
    assert.equal(first.status, 'FAILED', 'the one attempt is recorded with its reason');
    assert.match(first.error.message, /ANTHROPIC_API_NOT_CONFIGURED/);
    assert.equal(store.events.failures.length, 1);
    assert.equal(store.run.status, 'PARTIAL', 'the store\'s resumable state after one failed attempt, not FAILED');
    assert.ok(store.work.slice(1).every((item) => item.status === 'PENDING' && item.attempts === 0), 'no other section was touched');
    assert.ok(lines.some((line) => /SECTION_FAILED/.test(line) && /ANTHROPIC_API_NOT_CONFIGURED/.test(line)), 'the failure is on the worker\'s output once');
    assert.equal(lines.filter((line) => /SECTION_FAILED/.test(line)).length, 1);
  } finally {
    if (priorKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = priorKey;
  }
});

test('through the real section loop, a usage limit stops the worker the same way; an ordinary section error is retried', async () => {
  const priorToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'claude-oauth-test-'.repeat(2);
  try {
    const limited = await conchoRunStore({ model_config: CLAUDE_CLI_MODEL_CONFIG });
    const limit = refusingModel(new Error("claude exited 1: You've hit your session limit. Resets at 8pm"));
    await assert.rejects(
      runHostedWorker({ ...options, workers: 1 }, output, { createStore: () => limited, createModel: () => limit }),
      /^Error: PRODUCT_HOSTED_CODEX_USAGE_LIMIT: claude exited 1: You've hit your session limit/,
    );
    assert.equal(limited.events.claims, 1);
    assert.equal(limited.run.status, 'PARTIAL');
    // A section's own failure keeps today's behaviour: claimed again until
    // its attempts are spent, then the run FAILED.
    const ordinary = await conchoRunStore({ model_config: CLAUDE_CLI_MODEL_CONFIG });
    const broken = refusingModel(new Error('MODEL_RESPONSE_SHAPE: proposals'));
    await assert.rejects(
      runHostedWorker({ ...options, workers: 1 }, output, { createStore: () => ordinary, createModel: () => broken }),
      /PRODUCT_HOSTED_RUN_FAILED: SECTION_ANALYSIS/,
    );
    assert.equal(ordinary.events.claims, 3, 'three attempts on the first section');
    assert.equal(ordinary.work[0].attempts, 3);
    assert.equal(ordinary.run.status, 'FAILED');
  } finally {
    if (priorToken === undefined) delete process.env.CLAUDE_CODE_OAUTH_TOKEN; else process.env.CLAUDE_CODE_OAUTH_TOKEN = priorToken;
  }
});

test('worker-stop names the two account reasons and nothing else', () => {
  assert.equal(workerStopReason(Object.assign(new Error('x'), { code: 'ANTHROPIC_API_NOT_CONFIGURED' })), 'PRODUCT_HOSTED_ANTHROPIC_API_NOT_CONFIGURED');
  assert.equal(workerStopReason(new Error('ANTHROPIC_API_USAGE_LIMIT: usage limit on the API account (429): rate limit')), 'PRODUCT_HOSTED_CODEX_USAGE_LIMIT');
  assert.equal(workerStopReason(new Error("codex exited 1: You've hit your usage limit.")), 'PRODUCT_HOSTED_CODEX_USAGE_LIMIT');
  assert.equal(workerStopReason(new Error('EXTRACTION_DECLINED: 5.02')), null);
  assert.equal(isWorkerStopError(new Error('SECTION_LEASE_LOST')), false);
});
