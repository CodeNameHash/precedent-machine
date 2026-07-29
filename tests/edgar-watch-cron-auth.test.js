const test = require('node:test');
const assert = require('node:assert/strict');

let createEdgarWatchHandler;

test.before(async () => {
  ({ createEdgarWatchHandler } = await import('../pages/api/cron/edgar-watch.js'));
});

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function request(authorization, query = {}) {
  return {
    method: 'GET',
    headers: authorization ? { authorization } : {},
    query,
  };
}

function guardedHandler(secret) {
  let supabaseCalls = 0;
  let discoveryCalls = 0;
  const supabase = { client: true };
  const handler = createEdgarWatchHandler({
    getCronSecret: () => secret,
    getSupabase: () => {
      supabaseCalls += 1;
      return supabase;
    },
    discoverCandidates: async (options) => {
      discoveryCalls += 1;
      assert.equal(options.supabase, supabase);
      return { scanned: 0, candidates: 0, inserted: 0 };
    },
  });
  return {
    handler,
    calls: () => ({ supabaseCalls, discoveryCalls }),
  };
}

test('missing CRON_SECRET fails closed before Supabase initialisation', async () => {
  const guarded = guardedHandler(undefined);
  const res = responseRecorder();

  await guarded.handler(request(), res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(guarded.calls(), { supabaseCalls: 0, discoveryCalls: 0 });
});

test('mismatched Bearer secret cannot reach Supabase', async () => {
  const guarded = guardedHandler('expected-secret');
  const res = responseRecorder();

  await guarded.handler(request('Bearer wrong-secret'), res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(guarded.calls(), { supabaseCalls: 0, discoveryCalls: 0 });
});

test('query-string secrets are rejected even when their value matches', async () => {
  const guarded = guardedHandler('expected-secret');
  const res = responseRecorder();

  await guarded.handler(request(null, { secret: 'expected-secret' }), res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(guarded.calls(), { supabaseCalls: 0, discoveryCalls: 0 });
});

test('an exact Bearer secret may initialise Supabase and run discovery', async () => {
  const guarded = guardedHandler('expected-secret');
  const res = responseRecorder();

  await guarded.handler(request('Bearer expected-secret'), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(guarded.calls(), { supabaseCalls: 1, discoveryCalls: 1 });
});

test('over-cap work is rejected before Supabase initialisation', async () => {
  const guarded = guardedHandler('expected-secret');
  const days = responseRecorder();
  const limit = responseRecorder();

  await guarded.handler(request('Bearer expected-secret', { days: '31' }), days);
  await guarded.handler(request('Bearer expected-secret', { limit: '101' }), limit);

  assert.equal(days.statusCode, 400);
  assert.equal(limit.statusCode, 400);
  assert.deepEqual(guarded.calls(), { supabaseCalls: 0, discoveryCalls: 0 });
});
