const test = require('node:test');
const assert = require('node:assert/strict');

const { createRouteGuard } = require('../lib/query/route-guard');

function fakeRes() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    headersSent: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; this.headersSent = true; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('normal requests pass through untouched and release their slot', async () => {
  const guard = createRouteGuard({ maxConcurrent: 2 });
  const handler = guard(async (req, res) => res.status(200).json({ ok: true }));
  for (let i = 0; i < 5; i++) {
    const res = fakeRes();
    await handler({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true });
  }
});

test('requests beyond maxConcurrent get 503 with Retry-After; slots free after completion', async () => {
  const guard = createRouteGuard({ maxConcurrent: 2 });
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const handler = guard(async (req, res) => { await blocked; return res.status(200).json({ ok: true }); });

  const r1 = fakeRes(); const r2 = fakeRes(); const r3 = fakeRes();
  const p1 = handler({}, r1);
  const p2 = handler({}, r2);
  await handler({}, r3); // third concurrent -> rejected immediately
  assert.equal(r3.statusCode, 503);
  assert.equal(r3.headers['Retry-After'], '5');
  assert.match(r3.body.error, /at capacity/);

  release();
  await Promise.all([p1, p2]);
  assert.equal(r1.statusCode, 200);
  assert.equal(r2.statusCode, 200);

  const r4 = fakeRes();
  await handler({}, r4); // slots freed
  assert.equal(r4.statusCode, 200);
});

test('circuit opens after consecutive unexpected throws and cools down; expected 400s never count', async () => {
  let clock = 0;
  const guard = createRouteGuard({ maxConcurrent: 4, failureThreshold: 2, cooldownMs: 10_000, now: () => clock });

  // Expected-error handler: responds 400 itself, never throws — must never
  // trip the breaker no matter how many times it runs.
  const expected = guard(async (req, res) => res.status(400).json({ error: 'bad payload' }));
  for (let i = 0; i < 10; i++) {
    const res = fakeRes();
    await expected({}, res);
    assert.equal(res.statusCode, 400);
  }

  const throwing = guard(async () => { throw new Error('db exploded: secret detail'); });
  const t1 = fakeRes();
  await throwing({}, t1);
  assert.equal(t1.statusCode, 500);
  // Sanitized: the thrown message is never echoed.
  assert.equal(t1.body.error, 'Query failed unexpectedly.');

  const t2 = fakeRes();
  await throwing({}, t2);
  assert.equal(t2.statusCode, 500);

  // Breaker now open: even a healthy handler is refused until cooldown.
  const healthy = guard(async (req, res) => res.status(200).json({ ok: true }));
  const t3 = fakeRes();
  await healthy({}, t3);
  assert.equal(t3.statusCode, 503);
  assert.match(t3.body.error, /recovering/);
  assert.ok(Number(t3.headers['Retry-After']) >= 1);

  clock = 10_001; // cooldown elapsed
  const t4 = fakeRes();
  await healthy({}, t4);
  assert.equal(t4.statusCode, 200);
});

test('a success resets the consecutive-failure count', async () => {
  let clock = 0;
  const guard = createRouteGuard({ failureThreshold: 2, cooldownMs: 10_000, now: () => clock });
  const throwing = guard(async () => { throw new Error('boom'); });
  const healthy = guard(async (req, res) => res.status(200).json({ ok: true }));

  await throwing({}, fakeRes()); // 1 failure
  await healthy({}, fakeRes()); // resets
  await throwing({}, fakeRes()); // 1 failure again — breaker must NOT open
  const res = fakeRes();
  await healthy({}, res);
  assert.equal(res.statusCode, 200);
});

// The route file itself (pages/api/query/run.js) mixes ESM import syntax
// with this guard's require, so node:test cannot load it directly — the
// wiring (`export default guard(runHandler)`) is proven by `npm run build`
// compiling the page, which the battery runs on every merge.
