const test = require('node:test');
const assert = require('node:assert/strict');

const { decideAccess, isPublicPath, isSelfGated, PUBLIC_PATHS, SELF_GATED_PREFIXES } = require('../lib/auth/gate');
const { createSessionToken } = require('../lib/auth/session');
const { serializeSessionCookie } = require('../lib/auth/cookies');

const SECRET = 'gate-test-secret';
const ENV = { SESSION_SECRET: SECRET };

test('public paths are allowed with no cookie and no env at all', async () => {
  for (const p of ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/session', '/favicon.ico', '/spa.css']) {
    // eslint-disable-next-line no-await-in-loop
    const decision = await decideAccess({ pathname: p, cookieHeader: null, env: {} });
    assert.equal(decision.allow, true, `expected ${p} to be public`);
    assert.equal(decision.reason, 'public');
  }
});

test('_next and fonts prefixes are public', async () => {
  const a = await decideAccess({ pathname: '/_next/static/chunks/main.js', cookieHeader: null, env: {} });
  assert.equal(a.allow, true);
  const b = await decideAccess({ pathname: '/fonts/HankenGrotesk.woff2', cookieHeader: null, env: {} });
  assert.equal(b.allow, true);
});

test('the cron route is self-gated: allowed through with no cookie at all (it enforces its own CRON_SECRET internally)', async () => {
  const decision = await decideAccess({ pathname: '/api/cron/edgar-watch', cookieHeader: null, env: {} });
  assert.equal(decision.allow, true);
  assert.equal(decision.reason, 'self-gated');
});

test('/generated/ is deliberately NOT public — it is corpus-derived data, not a framework asset', async () => {
  const decision = await decideAccess({
    pathname: '/generated/home-search-index-v1.json',
    cookieHeader: null,
    env: ENV,
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'missing-session');
});

test('an arbitrary API route with no cookie is refused (missing-session)', async () => {
  const decision = await decideAccess({ pathname: '/api/deals', cookieHeader: null, env: ENV });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'missing-session');
});

test('a route nobody remembered to classify still defaults to refuse (not present in either list)', async () => {
  const hypotheticalNewRoute = '/api/totally-new-route-added-tomorrow';
  assert.equal(isPublicPath(hypotheticalNewRoute), false);
  assert.equal(isSelfGated(hypotheticalNewRoute), false);
  const decision = await decideAccess({ pathname: hypotheticalNewRoute, cookieHeader: null, env: ENV });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'missing-session');
});

test('a page route (not /api) with no cookie is also refused the same way', async () => {
  const decision = await decideAccess({ pathname: '/review/some-deal-id', cookieHeader: null, env: ENV });
  assert.equal(decision.allow, false);
});

test('SESSION_SECRET unset fails closed even with a cookie present', async () => {
  const decision = await decideAccess({
    pathname: '/api/deals',
    cookieHeader: 'pm_session=anything.here',
    env: {},
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'not-configured');
});

test('a valid, freshly-signed session cookie is accepted', async () => {
  const token = await createSessionToken({ sub: 'ben', secret: SECRET });
  const cookieHeader = serializeSessionCookie(token).split(';')[0];
  const decision = await decideAccess({ pathname: '/api/deals', cookieHeader, env: ENV });
  assert.equal(decision.allow, true);
  assert.equal(decision.reason, 'valid-session');
  assert.equal(decision.claims.sub, 'ben');
});

test('a tampered cookie is refused', async () => {
  const token = await createSessionToken({ sub: 'ben', secret: SECRET });
  // Flip a middle character, not the last one — the last base64url symbol
  // of a 32-byte HMAC-SHA256 signature carries 2 "don't care" bits (256 is
  // not a multiple of 6), so an edit there can occasionally decode to the
  // identical bytes and not be a real tamper. See the matching fix/comment
  // in tests/auth-route-enforcement.test.js.
  const mid = Math.floor(token.length / 2);
  const flipped = token[mid] === 'A' ? 'B' : 'A';
  const tampered = `${token.slice(0, mid)}${flipped}${token.slice(mid + 1)}`;
  const decision = await decideAccess({ pathname: '/api/deals', cookieHeader: `pm_session=${tampered}`, env: ENV });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'bad-signature');
});

test('an expired cookie is refused', async () => {
  const issuedAt = 1_000_000;
  const token = await createSessionToken({ sub: 'ben', secret: SECRET, ttlSeconds: 60, now: issuedAt });
  const decision = await decideAccess({
    pathname: '/api/deals',
    cookieHeader: `pm_session=${token}`,
    env: ENV,
    now: issuedAt + 61_000,
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'expired');
});

test('PUBLIC_PATHS and SELF_GATED_PREFIXES do not overlap', () => {
  for (const publicPath of PUBLIC_PATHS) {
    assert.equal(
      SELF_GATED_PREFIXES.some((prefix) => publicPath.startsWith(prefix)),
      false,
      `${publicPath} should not also match a self-gated prefix`,
    );
  }
});
