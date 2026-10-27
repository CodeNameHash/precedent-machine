'use strict';

// Work package 53 (plan finding (289)): /api/health says which commit and
// which database a deployment is serving, without a session and without a
// secret. It exists because a day was lost to a deployment talking to a
// database nobody could identify from outside.
const assert = require('node:assert/strict');
const test = require('node:test');
const { PUBLIC_PATHS } = require('../lib/auth/gate');
const healthModule = require('../pages/api/health');
const handleHealth = healthModule.default || healthModule;

function responseDouble() {
  return {
    statusCode: null, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('the health route is public at the gate and reports the commit, the database ref and the key kind', () => {
  assert.equal(PUBLIC_PATHS.has('/api/health'), true);
  const previous = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sjumbznveyyiizhwvixj.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = `sb_secret_${'x'.repeat(20)}`;
  process.env.VERCEL_GIT_COMMIT_SHA = 'e8717bd9';
  process.env.NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION = 'LEGAL_SCHEMA/V2';
  try {
    const res = responseDouble();
    handleHealth({ method: 'GET' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.commit, 'e8717bd9');
    assert.equal(res.body.supabase_ref, 'sjumbznveyyiizhwvixj');
    assert.equal(res.body.schema, 'LEGAL_SCHEMA/V2');
    assert.equal(res.body.key_kind, 'secret');
    assert.doesNotMatch(JSON.stringify(res.body), /sb_secret_/, 'the key itself never appears');
    // A legacy JWT is reported as such — the failure this route was built to
    // make visible.
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiJ9.payload.signature';
    const legacy = responseDouble();
    handleHealth({ method: 'GET' }, legacy);
    assert.equal(legacy.body.key_kind, 'legacy-jwt');
    // No URL configured: not ok, no ref, still a 200 with the facts.
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const missing = responseDouble();
    handleHealth({ method: 'GET' }, missing);
    assert.equal(missing.body.ok, false);
    assert.equal(missing.body.supabase_ref, null);
    // POST is refused.
    const refused = responseDouble();
    handleHealth({ method: 'POST' }, refused);
    assert.equal(refused.statusCode, 405);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
