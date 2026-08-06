// Exercises the repair of the four routes the July security review graded
// critical (see ROADMAP.md S2). None of these are wired into their live
// pages/api/** route — those still 503 exactly as before (see
// tests/auth-route-enforcement.test.js for proof the live routes stay
// contained) — this file proves the ARCHIVED, repaired implementations
// behave correctly, by calling the real functions with real inputs, not by
// reading their source.
const test = require('node:test');
const assert = require('node:assert/strict');

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
    setHeader(key, value) {
      res.headers[key] = value;
      return res;
    },
  };
  return res;
}

// ── pages/api/users.js — is_admin self-grant ──────────────────────────────
test('users.js repair: POST ignores is_admin from the request body entirely', async () => {
  const { createUsersHandler } = require('../lib/broad-corpus/contained-routes/users');

  const insertedRows = [];
  const fakeSupabase = {
    from(table) {
      assert.equal(table, 'users');
      return {
        insert(row) {
          insertedRows.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'u1', ...row }, error: null }),
            }),
          };
        },
      };
    },
  };

  const handler = createUsersHandler({ getSupabase: () => fakeSupabase });
  const req = { method: 'POST', body: { name: 'Attacker', is_admin: true } };
  const res = mockRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(insertedRows.length, 1);
  assert.equal(insertedRows[0].is_admin, false, 'is_admin must be false regardless of what the body claimed');
  assert.equal(insertedRows[0].name, 'Attacker', 'name is still accepted — only is_admin is stripped');
});

test('users.js repair: GET still lists users (read path unaffected by the fix)', async () => {
  const { createUsersHandler } = require('../lib/broad-corpus/contained-routes/users');
  const fakeSupabase = {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [{ id: 'u1', name: 'Reviewer', is_admin: false }], error: null }),
      }),
    }),
  };
  const handler = createUsersHandler({ getSupabase: () => fakeSupabase });
  const res = mockRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.users.length, 1);
});

// ── pages/api/saved-queries.js — admin self-grant via auto-created Reviewer ─
//
// The handler calls getServiceSupabase() itself with no injection point
// (unlike users.js), so it cannot be driven end-to-end without a real
// database — reviewerUser() is exported (additive, see the file) so its
// actual bootstrap behavior can be exercised directly, with a real (fake)
// database client and a real return-value assertion, rather than read as
// source text.
test('saved-queries.js repair: reviewerUser() bootstraps a fresh Reviewer with is_admin: false, not true', async () => {
  const { reviewerUser } = require('../lib/query/contained-routes/saved-queries.js');

  const insertedUsers = [];
  function usersChain() {
    const obj = {
      select: () => obj,
      eq: () => obj,
      order: () => obj,
      limit: () => Promise.resolve({ data: [], error: null }), // no existing Reviewer row
      insert(row) {
        insertedUsers.push(row);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'u1', ...row }, error: null }),
          }),
        };
      },
    };
    return obj;
  }
  const fakeSupabase = { from: () => usersChain() };

  const owner = await reviewerUser(fakeSupabase, null);

  assert.equal(insertedUsers.length, 1);
  assert.equal(insertedUsers[0].is_admin, false, 'bootstrap Reviewer must not self-grant admin');
  assert.equal(owner.is_admin, false, 'the returned owner record reflects the fix, not a self-granted true');
});

test('saved-queries.js repair: an existing non-admin Reviewer is returned as-is (bootstrap only runs once)', async () => {
  const { reviewerUser } = require('../lib/query/contained-routes/saved-queries.js');
  const fakeSupabase = {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      limit: () => Promise.resolve({ data: [{ id: 'existing-1', name: 'Reviewer', is_admin: false }], error: null }),
      insert: () => { throw new Error('should not bootstrap when a Reviewer already exists'); },
    }),
  };
  const owner = await reviewerUser(fakeSupabase, null);
  assert.equal(owner.id, 'existing-1');
  assert.equal(owner.is_admin, false);
});

// ── pages/api/ingest/from-url.js — SSRF ───────────────────────────────────
test('from-url SSRF guard: only https://sec.gov and https://*.sec.gov are allowed', () => {
  const { isAllowedIngestUrl } = require('../lib/broad-corpus/contained-routes/from-url-fetch');

  for (const good of [
    'https://www.sec.gov/Archives/edgar/data/1234/filing.htm',
    'https://sec.gov/index.json',
    'https://efts.sec.gov/LATEST/search-index?q=x',
  ]) {
    assert.equal(isAllowedIngestUrl(good), true, `expected ${good} to be allowed`);
  }

  for (const bad of [
    'http://www.sec.gov/Archives/edgar/data/1234/filing.htm', // wrong scheme
    'https://evil.com/steal',
    'https://sec.gov.evil.com/lookalike', // suffix-confusion attempt
    'https://evilsec.gov/lookalike', // prefix-confusion attempt (no leading dot)
    'https://169.254.169.254/latest/meta-data/', // cloud metadata endpoint
    'https://localhost:5432/',
    'file:///etc/passwd',
    'not a url at all',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isAllowedIngestUrl(bad), false, `expected ${JSON.stringify(bad)} to be refused`);
  }
});

test('from-url SSRF guard: fetchUrl refuses a disallowed URL before ever calling the HTTP client', async () => {
  const { fetchUrl } = require('../lib/broad-corpus/contained-routes/from-url-fetch');
  let httpClientCalled = false;
  const spyClient = { get: () => { httpClientCalled = true; } };

  await assert.rejects(
    () => fetchUrl('https://evil.com/payload', 5, { httpsClient: spyClient }),
    /only https:\/\/sec\.gov and https:\/\/\*\.sec\.gov/,
  );
  assert.equal(httpClientCalled, false, 'must refuse before making any network call');
});

function fakeHttpsClient(responses) {
  let i = 0;
  return {
    get(url, _options, callback) {
      const def = responses[i];
      i += 1;
      const listeners = {};
      const res = {
        statusCode: def.statusCode,
        headers: def.headers || {},
        on(event, handler) {
          listeners[event] = handler;
          return res;
        },
        resume() {},
      };
      process.nextTick(() => {
        callback(res);
        if (def.body !== undefined && listeners.data) listeners.data(Buffer.from(def.body));
        if (listeners.end) listeners.end();
      });
      return { on() {}, setTimeout() {}, destroy() {} };
    },
  };
}

test('from-url SSRF guard: a redirect to another sec.gov URL is followed', async () => {
  const { fetchUrl } = require('../lib/broad-corpus/contained-routes/from-url-fetch');
  const client = fakeHttpsClient([
    { statusCode: 302, headers: { location: 'https://www.sec.gov/final.htm' } },
    { statusCode: 200, body: 'the filing text' },
  ]);
  const result = await fetchUrl('https://www.sec.gov/start.htm', 5, { httpsClient: client });
  assert.equal(result, 'the filing text');
});

test('from-url SSRF guard: a redirect OUT of sec.gov is refused, not followed', async () => {
  const { fetchUrl } = require('../lib/broad-corpus/contained-routes/from-url-fetch');
  const client = fakeHttpsClient([
    { statusCode: 302, headers: { location: 'https://attacker.example/steal' } },
  ]);
  await assert.rejects(
    () => fetchUrl('https://www.sec.gov/start.htm', 5, { httpsClient: client }),
    /only https:\/\/sec\.gov and https:\/\/\*\.sec\.gov/,
  );
});

test('from-url SSRF guard: redirect chains are capped, not followed forever', async () => {
  const { fetchUrl } = require('../lib/broad-corpus/contained-routes/from-url-fetch');
  // Six sec.gov->sec.gov redirects in a row, one more than MAX_REDIRECTS (5).
  const responses = Array.from({ length: 7 }, (_, idx) => ({
    statusCode: 302,
    headers: { location: `https://www.sec.gov/hop-${idx + 1}.htm` },
  }));
  const client = fakeHttpsClient(responses);
  await assert.rejects(
    () => fetchUrl('https://www.sec.gov/start.htm', 5, { httpsClient: client }),
    /Too many redirects/,
  );
});

// ── pages/api/admin/reprocess-cond.js — was purely "unauthenticated" ───────
test('reprocess-cond.js repair: missing deal_id now gets a normal 400, not the containment message', async () => {
  const { createReprocessCondHandler } = require('../lib/broad-corpus/contained-routes/reprocess-cond');
  const handler = createReprocessCondHandler({ getSupabase: () => ({}) });
  const res = mockRes();
  await handler({ method: 'POST', body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'deal_id is required');
  assert.notEqual(res.body.error && res.body.error.code, 'ROUTE_CONTAINED');
});

test('reprocess-cond.js repair: dry_run never deletes or inserts', async () => {
  const { createReprocessCondHandler } = require('../lib/broad-corpus/contained-routes/reprocess-cond');
  let deleteCalled = false;
  let insertCalled = false;
  const fakeSupabase = {
    from(table) {
      if (table === 'deals') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { acquirer: 'A', target: 'B' } }) }) }) };
      }
      if (table === 'provisions') {
        // Both queries share `.select(...).eq('deal_id', did)`: the first
        // chains `.like('type', 'COND%')` (resolves to the COND-typed
        // rows), the second is awaited directly off `.eq()` (the
        // "allProvs" scan for misclassified rows) — so `.eq()` must return
        // something that is BOTH `.like()`-able and directly thenable.
        const afterEq = {
          like: () => Promise.resolve({
            data: [{ id: 'p1', type: 'COND-M', category: 'x', full_text: 'No legal impediment shall exist.' }],
          }),
          then: (resolve) => resolve({ data: [] }),
        };
        return {
          select: () => ({ eq: () => afterEq }),
          delete: () => { deleteCalled = true; return { in: () => Promise.resolve({ error: null }) }; },
          insert: () => { insertCalled = true; return { select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) }; },
        };
      }
      if (table === 'annotations') {
        return { delete: () => { deleteCalled = true; return { in: () => Promise.resolve({ error: null }) }; } };
      }
      return {};
    },
  };
  const handler = createReprocessCondHandler({ getSupabase: () => fakeSupabase });
  const res = mockRes();
  await handler({ method: 'POST', body: { deal_id: 'd1', dry_run: true } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(deleteCalled, false, 'dry_run must never delete');
  assert.equal(insertCalled, false, 'dry_run must never insert');
  assert.ok(res.body.results[0].new_provisions, 'dry_run response previews what WOULD be inserted');
});

test('reprocess-cond.js repair: classification logic preserved (sanity, not this task\'s fix)', () => {
  const { classifyCondType } = require('../lib/broad-corpus/contained-routes/reprocess-cond');
  assert.equal(classifyCondType('Conditions to Obligations of Each Party'), 'COND-M');
  assert.equal(classifyCondType('Conditions to Obligations of the Company'), 'COND-S');
  assert.equal(classifyCondType('Conditions to Obligations of Parent and Merger Sub'), 'COND-B');
});
