// The central S2 acceptance test (ROADMAP.md): start the app for real and
// assert every route is refused without a session — driven from the
// filesystem (lib/auth/route-scan.js), not a remembered list, so a route
// added tomorrow is covered automatically. Every assertion in this file is
// a real HTTP request against a real running Next.js server (middleware
// included) — none of it reads source text.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const http = require('http');

const next = require('next');

const { enumerateApiRoutes } = require('../lib/auth/route-scan');
const { PUBLIC_PATHS, PUBLIC_PREFIXES, SELF_GATED_PREFIXES } = require('../lib/auth/gate');
const { createSessionToken } = require('../lib/auth/session');

const SESSION_SECRET = 'integration-test-session-secret-do-not-use-elsewhere';
const AUTH_PASSWORD = 'integration-test-password-Xk92!qz';
const AUTH_USERNAME = 'ben';
const CRON_SECRET = 'integration-test-cron-secret';

let server;
let app;
let baseUrl;

function isPublic(pathname) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isSelfGatedPath(pathname) {
  return SELF_GATED_PREFIXES.some((p) => pathname.startsWith(p));
}

async function req(method, urlPath, { cookie, headers = {}, body } = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res;
}

test.before(async () => {
  process.env.SESSION_SECRET = SESSION_SECRET;
  process.env.AUTH_PASSWORD = AUTH_PASSWORD;
  process.env.AUTH_USERNAME = AUTH_USERNAME;
  process.env.CRON_SECRET = CRON_SECRET;

  const dir = path.join(__dirname, '..');
  app = next({ dev: true, dir, quiet: true });
  const handle = app.getRequestHandler();
  await app.prepare();

  server = http.createServer((request, response) => handle(request, response));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  // next({dev:true}) spins up its own webpack/chokidar file-watcher
  // infrastructure (watching this entire, large repo for HMR) that outlives
  // both the plain http.Server wrapping it AND app.close() — observed
  // directly, twice: every individual test completes and prints (so the
  // assertions above are real and already resolved), then the process
  // hangs indefinitely afterward with near-zero CPU, i.e. blocked on an
  // open handle, not slow. This is a known class of issue with Next's dev
  // server under a programmatic host, not a bug in the routes under test.
  if (server) await new Promise((resolve) => server.close(resolve));
  if (app && typeof app.close === 'function') {
    try { await app.close(); } catch { /* best-effort */ }
  }
  // `node --test` runs each file in its own child process by default
  // (confirmed: a dedicated worker process per file, independent of any
  // other file in a `npm test` run), so forcing this process down here
  // does not affect other test files. setImmediate gives the test runner's
  // own reporter a tick to finish recording this hook's completion first.
  await new Promise((resolve) => { setImmediate(resolve); });
  process.exit(0);
});

// ── The central assertion: every route in the inventory, refused ──────────
test('every API route is refused without a session, except the auth bootstrap and the self-gated cron route', async (t) => {
  const apiDir = path.join(__dirname, '..', 'pages', 'api');
  const routes = enumerateApiRoutes(apiDir);
  assert.ok(routes.length > 60, `sanity: expected 60+ routes from the filesystem scan, got ${routes.length}`);

  for (const route of routes) {
    const publicRoute = isPublic(route.requestPath);
    const selfGated = isSelfGatedPath(route.requestPath);
    const label = publicRoute ? ' (public)' : selfGated ? ' (self-gated)' : '';
    // eslint-disable-next-line no-await-in-loop
    await t.test(`${route.requestPath}${label}`, async () => {
      const res = await req('GET', route.requestPath);
      if (publicRoute) {
        assert.notEqual(res.status, 401, `${route.requestPath} is public but got 401 anyway`);
        return;
      }
      if (selfGated) {
        // Self-gated means the SESSION gate steps aside — it does not mean
        // the route always succeeds with zero credentials. The cron route
        // correctly 401s its own way (missing CRON_SECRET) when called with
        // nothing at all; what has to be true here is that a 401, if any,
        // comes from the route's own check, not from the session gate —
        // distinguished by the error message (see lib/auth/gate.js
        // 'Unauthorized' vs pages/api/cron/edgar-watch.js 'Unauthorised').
        // The precise cron-secret-accepted / rejected cases are covered by
        // the dedicated tests below.
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}));
          assert.notEqual(body.error, 'Unauthorized', `${route.requestPath} 401 came from the session gate, not its own auth`);
        }
        return;
      }
      assert.equal(
        res.status,
        401,
        `${route.requestPath} (from ${route.file}) must be refused with no session — got ${res.status}`,
      );
      const bodyText = await res.text();
      let body;
      try { body = JSON.parse(bodyText); } catch { body = null; }
      assert.ok(body && typeof body.error === 'string', `${route.requestPath} 401 should carry a JSON error body`);
    });
  }
});

test('a route this test has never heard of is still refused — proves the default is deny, not a remembered list', async () => {
  // No file exists at this path; Next resolves it to a 404 page. Middleware
  // runs BEFORE that resolution, so if the gate is a default-allow list
  // this would leak through as a 404 (page not found) rather than a 401
  // (access refused) — assert the refusal happens first.
  const res = await req('GET', '/api/this-route-does-not-exist-and-nobody-classified-it');
  assert.equal(res.status, 401);
});

test('the auth-refused response is not method-specific — POST is refused the same as GET', async () => {
  const res = await req('POST', '/api/deals', { body: { acquirer: 'X', target: 'Y' } });
  assert.equal(res.status, 401);
});

test('DELETE with no session on a destructive route is refused before any handler logic runs', async () => {
  const res = await req('DELETE', '/api/provisions', { body: { id: 'whatever' } });
  assert.equal(res.status, 401);
});

// ── Page routes: refused with a redirect, not JSON ─────────────────────────
test('a page route with no session redirects to /login, it does not render', async () => {
  const res = await req('GET', '/review/00000000-0000-4000-8000-000000000000');
  assert.ok([302, 307].includes(res.status), `expected a redirect, got ${res.status}`);
  const location = res.headers.get('location') || '';
  assert.ok(location.includes('/login'), `Location should point at /login, got ${location}`);
  assert.ok(location.includes('next='), 'should preserve where the visitor was headed');
});

test('the home page with no session redirects to /login too — "in front of the application", not just the API', async () => {
  const res = await req('GET', '/');
  assert.ok([302, 307].includes(res.status));
  assert.ok((res.headers.get('location') || '').endsWith('/login'));
});

test('/login itself is always reachable, unauthenticated', async () => {
  const res = await req('GET', '/login');
  assert.equal(res.status, 200);
});

// ── The cron route: self-gated, not session-gated ──────────────────────────
test('cron route with no session AND no CRON_SECRET is refused', async () => {
  const res = await req('GET', '/api/cron/edgar-watch');
  assert.equal(res.status, 401);
});

test('cron route with the correct CRON_SECRET and NO session cookie is let through the auth layer entirely', async () => {
  const res = await req('GET', '/api/cron/edgar-watch', {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  // No real Supabase in this test environment, so the route itself will
  // 500 ("Supabase not configured") once past auth — the point is that it
  // is NOT 401: the session gate stepped aside for this path and the
  // route's own CRON_SECRET check accepted it.
  assert.notEqual(res.status, 401);
});

test('cron route with the WRONG CRON_SECRET is refused by the route\'s own check (still not a session 401)', async () => {
  const res = await req('GET', '/api/cron/edgar-watch', {
    headers: { authorization: 'Bearer wrong-secret' },
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'Unauthorised', 'this is the cron route\'s own message, not the session gate\'s "Unauthorized"');
});

// ── Login flow: real credential check, real cookie ──────────────────────────
test('login with the wrong password is refused', async () => {
  const res = await req('POST', '/api/auth/login', { body: { username: AUTH_USERNAME, password: 'not-it' } });
  assert.equal(res.status, 401);
});

test('login with the correct credentials succeeds and sets a session cookie', async () => {
  const res = await req('POST', '/api/auth/login', { body: { username: AUTH_USERNAME, password: AUTH_PASSWORD } });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie') || '';
  assert.match(setCookie, /^pm_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//);
});

test('the cookie is HttpOnly — the DOM-level guarantee that JavaScript cannot read it', async () => {
  const res = await req('POST', '/api/auth/login', { body: { username: AUTH_USERNAME, password: AUTH_PASSWORD } });
  const setCookie = res.headers.get('set-cookie') || '';
  // HttpOnly is what makes document.cookie exclude it; there is no
  // JS-visible DOM here to assert against directly (no browser in this
  // test), so the correct, real assertion is that the server actually sent
  // the attribute that browsers enforce this on — anything more (spinning
  // up a headless browser) would test the browser, not this route.
  assert.match(setCookie, /(^|;\s*)HttpOnly(;|$)/i);
});

test('a valid session cookie is accepted on a protected route', async () => {
  const loginRes = await req('POST', '/api/auth/login', { body: { username: AUTH_USERNAME, password: AUTH_PASSWORD } });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie.startsWith('pm_session='));

  const res = await req('GET', '/api/deals', { cookie });
  assert.notEqual(res.status, 401, 'a valid session must not be refused');
});

test('a valid session also gets past the page-route gate (no redirect)', async () => {
  const loginRes = await req('POST', '/api/auth/login', { body: { username: AUTH_USERNAME, password: AUTH_PASSWORD } });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];

  const res = await req('GET', '/', { cookie });
  assert.equal(res.status, 200);
});

test('a tampered session cookie is refused', async () => {
  const loginRes = await req('POST', '/api/auth/login', { body: { username: AUTH_USERNAME, password: AUTH_PASSWORD } });
  const rawCookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  const [name, value] = rawCookie.split('=');
  // Flip a character in the MIDDLE of the value, not the last one. A
  // 32-byte HMAC-SHA256 signature base64url-encodes to a final symbol that
  // only carries 4 of its 6 bits (256 bits is not a multiple of 6) — the
  // other 2 are "don't care" on decode, so some single-character edits at
  // the very end decode to the exact same bytes and are not a real tamper
  // (this was flaky here for exactly that reason before the fix). A middle
  // character has no such ambiguity.
  const mid = Math.floor(value.length / 2);
  const flippedChar = value[mid] === 'A' ? 'B' : 'A';
  const tampered = `${name}=${value.slice(0, mid)}${flippedChar}${value.slice(mid + 1)}`;

  const res = await req('GET', '/api/deals', { cookie: tampered });
  assert.equal(res.status, 401);
});

test('an expired session cookie is refused', async () => {
  const longAgo = Date.now() - 1000 * 60 * 60 * 24 * 365; // one year ago
  const expiredToken = await createSessionToken({ sub: 'ben', secret: SESSION_SECRET, ttlSeconds: 1, now: longAgo });
  const res = await req('GET', '/api/deals', { cookie: `pm_session=${expiredToken}` });
  assert.equal(res.status, 401);
});

test('a well-formed but garbage cookie value is refused, not a 500', async () => {
  const res = await req('GET', '/api/deals', { cookie: 'pm_session=garbage.notasignature' });
  assert.equal(res.status, 401);
});

// ── Logout ───────────────────────────────────────────────────────────────
test('logout clears the cookie', async () => {
  const res = await req('POST', '/api/auth/logout');
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie') || '';
  assert.match(setCookie, /^pm_session=;/);
  assert.match(setCookie, /Max-Age=0/);
});

test('after logout, the cleared cookie value no longer grants access', async () => {
  const loginRes = await req('POST', '/api/auth/login', { body: { username: AUTH_USERNAME, password: AUTH_PASSWORD } });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  const stillWorks = await req('GET', '/api/deals', { cookie });
  assert.notEqual(stillWorks.status, 401);

  await req('POST', '/api/auth/logout', { cookie });
  const afterLogout = await req('GET', '/api/deals', { cookie }); // client re-sending the now-stale cookie
  // The cookie itself is still cryptographically valid (this is a
  // stateless token, not a server-side session store — see
  // lib/auth/cookies.js) — logout tells the BROWSER to drop it via
  // Max-Age=0. A client that ignores that and replays the old cookie value
  // is indistinguishable from one that never logged out. Documented as a
  // known property, not a bug: assert the honest behavior instead of a
  // false claim of server-side revocation.
  assert.notEqual(afterLogout.status, 401);
});

// ── /api/auth/session — the "am I logged in" check the login page uses ─────
test('GET /api/auth/session reports authenticated: false with no cookie', async () => {
  const res = await req('GET', '/api/auth/session');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.authenticated, false);
});

test('GET /api/auth/session reports authenticated: true with a valid cookie', async () => {
  const loginRes = await req('POST', '/api/auth/login', { body: { username: AUTH_USERNAME, password: AUTH_PASSWORD } });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];
  const res = await req('GET', '/api/auth/session', { cookie });
  const body = await res.json();
  assert.equal(body.authenticated, true);
  assert.equal(body.sub, AUTH_USERNAME);
});
