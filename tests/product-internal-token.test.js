'use strict';

// The internal bearer path (Ben, 2026-09-14: "Server side route is fine"):
// a configured PRODUCT_INTERNAL_TOKEN lets a script act as the login user
// without a browser session or the CSRF marker; anything short of an exact
// match is unauthenticated.

const assert = require('node:assert/strict');
const test = require('node:test');

const { getProductActor, internalBearerActor, requireSameOriginMutation, MINIMUM_INTERNAL_TOKEN_LENGTH } = require('../lib/product/request-auth');
const { sandboxCredentials } = require('../lib/product/sandbox-wake');

const TOKEN = 'x'.repeat(40);
const env = { PRODUCT_INTERNAL_TOKEN: TOKEN, AUTH_USERNAME: 'ben', SESSION_SECRET: 's'.repeat(32) };
const bearer = (value) => ({ headers: { authorization: `Bearer ${value}` } });

test('a matching bearer token names the configured login user and needs no CSRF marker', async () => {
  assert.equal(internalBearerActor(bearer(TOKEN), env), 'ben');
  assert.equal(await getProductActor(bearer(TOKEN), env), 'ben');
  assert.doesNotThrow(() => requireSameOriginMutation(bearer(TOKEN), env));
  assert.equal(internalBearerActor(bearer(TOKEN), { ...env, AUTH_USERNAME: undefined }), 'ben', 'the default username');
});

test('a wrong, short or unconfigured token is unauthenticated, never a session attempt', async () => {
  assert.throws(() => internalBearerActor(bearer('y'.repeat(40)), env), (error) => error.code === 'UNAUTHENTICATED');
  assert.throws(() => internalBearerActor(bearer(TOKEN), { ...env, PRODUCT_INTERNAL_TOKEN: 'short' }), (error) => error.code === 'UNAUTHENTICATED');
  assert.throws(() => internalBearerActor(bearer(TOKEN), { ...env, PRODUCT_INTERNAL_TOKEN: undefined }), (error) => error.code === 'UNAUTHENTICATED');
  await assert.rejects(getProductActor(bearer('y'.repeat(40)), env), (error) => error.code === 'UNAUTHENTICATED');
  assert.throws(() => requireSameOriginMutation(bearer('y'.repeat(40)), env), (error) => error.code === 'UNAUTHENTICATED');
  assert.ok(MINIMUM_INTERNAL_TOKEN_LENGTH >= 32);
});

test('without a bearer header the session and CSRF rules apply as before', async () => {
  assert.equal(internalBearerActor({ headers: {} }, env), null);
  await assert.rejects(getProductActor({ headers: {} }, env), (error) => error.code === 'UNAUTHENTICATED');
  assert.throws(() => requireSameOriginMutation({ headers: {} }, env), (error) => error.code === 'CSRF_REQUIRED');
  assert.doesNotThrow(() => requireSameOriginMutation({ headers: { 'x-pm-csrf': 'same-origin' } }, env));
});

test('sandbox credentials come from VERCEL_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID together, else the SDK default', () => {
  assert.deepEqual(sandboxCredentials({}), {});
  assert.deepEqual(sandboxCredentials({ VERCEL_TOKEN: 't', VERCEL_TEAM_ID: 'team', VERCEL_PROJECT_ID: 'prj' }), { token: 't', teamId: 'team', projectId: 'prj' });
  assert.throws(() => sandboxCredentials({ VERCEL_TOKEN: 't' }), /VERCEL_TEAM_ID and VERCEL_PROJECT_ID/);
});
