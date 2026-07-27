const assert = require('node:assert/strict');
const test = require('node:test');

let createAgreementSourceHandler;
let createCommentsHandler;
let createRegistryPreviewHandler;
let createReportsHandler;
let createSignoffsHandler;
let getServiceSupabase;

test.before(async () => {
  ({
    createAgreementSourceHandler,
  } = await import('../pages/api/agreement-source.js'));
  ({ createCommentsHandler } = await import('../pages/api/comments.js'));
  ({
    createRegistryPreviewHandler,
  } = await import('../pages/api/admin/registry/preview.js'));
  ({ createReportsHandler } = await import('../pages/api/admin/reports.js'));
  ({ createSignoffsHandler } = await import('../pages/api/signoffs.js'));
  ({ getServiceSupabase } = await import('../lib/supabase.js'));
});

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
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

function guarded(factory) {
  let clientCalls = 0;
  const handler = factory({
    getSupabase: () => {
      clientCalls += 1;
      throw new Error('rejected requests must not construct a service client');
    },
  });
  return { handler, clientCalls: () => clientCalls };
}

async function rejectWithoutClient(guard, req, expectedStatus) {
  const res = responseRecorder();
  await guard.handler({ query: {}, body: {}, ...req }, res);
  assert.equal(res.statusCode, expectedStatus);
  assert.equal(guard.clientCalls(), 0);
}

test('admin reports rejects method and invalid selectors before service client construction', async () => {
  const guard = guarded(createReportsHandler);

  await rejectWithoutClient(guard, { method: 'POST' }, 405);
  await rejectWithoutClient(guard, { method: 'GET', query: { id: 'not-a-uuid' } }, 400);
  await rejectWithoutClient(guard, { method: 'GET', query: { kind: 'not-a-report-kind' } }, 400);
});

test('agreement source requires GET and a deal scope before service client construction', async () => {
  const guard = guarded(createAgreementSourceHandler);

  await rejectWithoutClient(guard, { method: 'POST' }, 405);
  await rejectWithoutClient(guard, { method: 'GET' }, 400);
});

test('comments rejects unsupported, contained and unscoped requests before service client construction', async () => {
  const guard = guarded(createCommentsHandler);

  await rejectWithoutClient(guard, { method: 'DELETE' }, 405);
  await rejectWithoutClient(guard, { method: 'POST' }, 503);
  await rejectWithoutClient(guard, { method: 'GET' }, 400);
});

test('signoffs rejects unsupported, contained and unscoped requests before service client construction', async () => {
  const guard = guarded(createSignoffsHandler);

  await rejectWithoutClient(guard, { method: 'DELETE' }, 405);
  await rejectWithoutClient(guard, { method: 'POST' }, 503);
  await rejectWithoutClient(guard, { method: 'GET' }, 400);
});

test('registry preview rejects method and missing scope before service client construction', async () => {
  const guard = guarded(createRegistryPreviewHandler);

  await rejectWithoutClient(guard, { method: 'POST' }, 405);
  await rejectWithoutClient(guard, { method: 'GET' }, 400);
  await rejectWithoutClient(guard, { method: 'GET', query: { key: 'feature_key' } }, 200);
});

test('service client fails closed without the service-role key before createClient', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceUrl = process.env.SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let factoryCalls = 0;

  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-must-not-be-used';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const client = getServiceSupabase(() => {
      factoryCalls += 1;
      return { unexpected: true };
    });

    assert.equal(client, null);
    assert.equal(factoryCalls, 0);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalServiceUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalServiceUrl;
    if (originalAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  }
});
