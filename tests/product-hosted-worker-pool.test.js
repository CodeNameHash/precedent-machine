'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { parseArguments, runHostedWorker } = require('../scripts/product-hosted-worker');
const { CODEX_MODEL_CONFIG } = require('../lib/product/product-model-config');

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
    createModel() {
      const model = {};
      models.push(model);
      return model;
    },
  };
}

test('hosted worker accepts only bounded pool sizes and defaults to two', () => {
  assert.equal(parseArguments(['--run-id', id, '--actor', 'ben']).workers, 2);
  assert.equal(parseArguments(['--run-id', id, '--actor', 'ben', '--workers', '1']).workers, 1);
  assert.equal(parseArguments(['--run-id', id, '--actor', 'ben', '--workers', '2']).workers, 2);
  assert.throws(() => parseArguments(['--run-id', id, '--actor', 'ben', '--workers', '3']), /workers must be 1 or 2/);
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
    { ...options, workers: 0 }, { ...options, workers: 3 }]) {
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
