const test = require('node:test');
const assert = require('node:assert/strict');

const { decideApiAuth, constantTimeEqual, isAuthEnabled } = require('../lib/api-auth');

function env(overrides = {}) {
  return { API_AUTH_ENABLED: undefined, PM_API_KEY: undefined, ...overrides };
}

test('flag off (unset) -> allow all, regardless of key', () => {
  const decision = decideApiAuth({
    pathname: '/api/deals',
    method: 'DELETE',
    apiKeyHeader: null,
    env: env(),
  });
  assert.equal(decision.allow, true);
});

test('flag off (explicit false) -> allow all', () => {
  const decision = decideApiAuth({
    pathname: '/api/admin/reprocess-cond',
    method: 'POST',
    apiKeyHeader: 'wrong',
    env: env({ API_AUTH_ENABLED: 'false' }),
  });
  assert.equal(decision.allow, true);
});

test('flag on + no key header -> 401 on a write route', () => {
  const decision = decideApiAuth({
    pathname: '/api/provisions',
    method: 'DELETE',
    apiKeyHeader: undefined,
    env: env({ API_AUTH_ENABLED: 'true', PM_API_KEY: 'secret-123' }),
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.status, 401);
});

test('flag on + wrong key -> 401 on a write route', () => {
  const decision = decideApiAuth({
    pathname: '/api/deals',
    method: 'POST',
    apiKeyHeader: 'not-the-secret',
    env: env({ API_AUTH_ENABLED: 'true', PM_API_KEY: 'secret-123' }),
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.status, 401);
});

test('flag on + correct key -> allow', () => {
  const decision = decideApiAuth({
    pathname: '/api/deals',
    method: 'POST',
    apiKeyHeader: 'secret-123',
    env: env({ API_AUTH_ENABLED: 'true', PM_API_KEY: 'secret-123' }),
  });
  assert.equal(decision.allow, true);
});

test('flag on + no PM_API_KEY configured -> fail closed (500), even with a header sent', () => {
  const decision = decideApiAuth({
    pathname: '/api/deals',
    method: 'GET',
    apiKeyHeader: 'anything',
    env: env({ API_AUTH_ENABLED: 'true' }),
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.status, 500);
});

test('flag on + cron route -> allowed through regardless of key (self-gated elsewhere)', () => {
  const decision = decideApiAuth({
    pathname: '/api/cron/edgar-watch',
    method: 'GET',
    apiKeyHeader: null,
    env: env({ API_AUTH_ENABLED: 'true', PM_API_KEY: 'secret-123' }),
  });
  assert.equal(decision.allow, true);
});

test('flag on + public-allowlisted GET -> allow without key', (t) => {
  // The allowlist is empty today (see lib/api-auth.js), so exercise the
  // mechanism directly rather than asserting on a specific route.
  const apiAuth = require('../lib/api-auth');
  const originalAllowlist = apiAuth.PUBLIC_GET_ALLOWLIST.slice();
  apiAuth.PUBLIC_GET_ALLOWLIST.push('/api/query/kinds');
  t.after(() => {
    apiAuth.PUBLIC_GET_ALLOWLIST.length = 0;
    apiAuth.PUBLIC_GET_ALLOWLIST.push(...originalAllowlist);
  });

  const decision = decideApiAuth({
    pathname: '/api/query/kinds',
    method: 'GET',
    apiKeyHeader: null,
    env: env({ API_AUTH_ENABLED: 'true', PM_API_KEY: 'secret-123' }),
  });
  assert.equal(decision.allow, true);
});

test('public allowlist only exempts GET/HEAD, not other methods on the same path', () => {
  const apiAuth = require('../lib/api-auth');
  const originalAllowlist = apiAuth.PUBLIC_GET_ALLOWLIST.slice();
  apiAuth.PUBLIC_GET_ALLOWLIST.push('/api/query/kinds');
  try {
    const decision = decideApiAuth({
      pathname: '/api/query/kinds',
      method: 'POST',
      apiKeyHeader: null,
      env: env({ API_AUTH_ENABLED: 'true', PM_API_KEY: 'secret-123' }),
    });
    assert.equal(decision.allow, false);
    assert.equal(decision.status, 401);
  } finally {
    apiAuth.PUBLIC_GET_ALLOWLIST.length = 0;
    apiAuth.PUBLIC_GET_ALLOWLIST.push(...originalAllowlist);
  }
});

test('constantTimeEqual: equal strings match', () => {
  assert.equal(constantTimeEqual('abc123', 'abc123'), true);
});

test('constantTimeEqual: different length or content does not match', () => {
  assert.equal(constantTimeEqual('abc123', 'abc1234'), false);
  assert.equal(constantTimeEqual('abc123', 'abc124'), false);
  assert.equal(constantTimeEqual('', ''), true);
  assert.equal(constantTimeEqual(null, undefined), true);
  assert.equal(constantTimeEqual(null, 'x'), false);
});

test('isAuthEnabled: only the literal string "true" (case-insensitive) enables it', () => {
  assert.equal(isAuthEnabled({ API_AUTH_ENABLED: 'true' }), true);
  assert.equal(isAuthEnabled({ API_AUTH_ENABLED: 'TRUE' }), true);
  assert.equal(isAuthEnabled({ API_AUTH_ENABLED: 'false' }), false);
  assert.equal(isAuthEnabled({ API_AUTH_ENABLED: '1' }), false);
  assert.equal(isAuthEnabled({}), false);
});
