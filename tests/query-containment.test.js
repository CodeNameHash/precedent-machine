const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  QUERY_CONTAINED_ROUTES,
  QUERY_CONTAINED_ROUTE_FILES,
  QUERY_CONTAINED_ARCHIVE_FILES,
  queryContainedHandler,
} = require('../lib/query-containment');

const ROOT = path.join(__dirname, '..');
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

function responseRecorder() {
  return {
    statusCode: null,
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

function source(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

test('the containment handler rejects every method with no retry instruction', async () => {
  for (const method of HTTP_METHODS) {
    const res = responseRecorder();
    await queryContainedHandler({ method }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.code, 'ROUTE_CONTAINED');
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.equal(res.headers['Retry-After'], undefined);
  }
});

test('all Query routes reject before Supabase, corpus and environment imports', () => {
  assert.deepEqual(Object.keys(QUERY_CONTAINED_ROUTE_FILES), QUERY_CONTAINED_ROUTES);
  for (const file of Object.values(QUERY_CONTAINED_ROUTE_FILES)) {
    const route = source(file);
    assert.match(route, /require\(['"](?:\.\.\/){2,3}lib\/query-containment['"]\)/);
    assert.match(route, /export default queryContainedHandler/);
    assert.doesNotMatch(
      route,
      /supabase|createClient|loadContext|runQuery|queryContext|serving-client|process\.env|fetch|readFile|from\(/i,
    );
    assert.equal((route.match(/\brequire\(/g) || []).length, 1);
    assert.equal((route.match(/\bimport\s/g) || []).length, 0);
  }
});

test('loading the containment module imports no database, corpus or query engine module', () => {
  const containmentPath = require.resolve('../lib/query-containment');
  delete require.cache[containmentPath];
  const before = new Set(Object.keys(require.cache));
  require('../lib/query-containment');
  const loaded = Object.keys(require.cache).filter((file) => !before.has(file));
  assert.deepEqual(loaded, [containmentPath]);
});

test('the prior Query handlers remain preserved but are not routable or imported', () => {
  assert.deepEqual(Object.keys(QUERY_CONTAINED_ARCHIVE_FILES), QUERY_CONTAINED_ROUTES);
  for (const route of QUERY_CONTAINED_ROUTES) {
    const liveSource = source(QUERY_CONTAINED_ROUTE_FILES[route]);
    const archiveSource = source(QUERY_CONTAINED_ARCHIVE_FILES[route]);
    assert.doesNotMatch(liveSource, /contained-routes/);
    assert.match(archiveSource, /export default/);
  }
  assert.match(source(QUERY_CONTAINED_ARCHIVE_FILES['/api/query/run']), /loadContext/);
  assert.match(source(QUERY_CONTAINED_ARCHIVE_FILES['/api/saved-queries']), /saved_queries/);
  assert.match(source(QUERY_CONTAINED_ARCHIVE_FILES['/api/canonical-v2/query']), /getCanonicalV2ServingClient/);
});

test('Query launch controls and saved-query links are unreachable', () => {
  const header = source('components/chrome/AppHeader.jsx');
  const home = source('pages/index.js');
  const library = source('pages/library.js');
  const bridge = source('components/review-v2/GlobalMarketBridge.jsx');

  assert.doesNotMatch(header, /href:\s*['"]\/query['"]/);
  assert.match(home, /const QUERY_UI_CONTAINED = true/);
  assert.match(home, /!QUERY_UI_CONTAINED && <div className="querySurface">/);
  assert.match(home, /QUERY_UI_CONTAINED \? null : matchFeatureVocab/);
  assert.match(home, /processPilotUiEnabled && \(/);
  assert.match(home, /href="\/query\/process\/pilot"/);
  assert.match(library, /const QUERY_UI_CONTAINED = true/);
  assert.match(library, /Saved queries are unavailable while Query is contained/);
  assert.match(bridge, /const QUERY_UI_CONTAINED = true/);
  assert.match(bridge, /QUERY_UI_CONTAINED \|\| !mounted/);
});

test('the bounded Process pilot is not a legacy Query route and production cannot expose it', () => {
  assert.equal(QUERY_CONTAINED_ROUTES.includes('/query/process/pilot'), false);
  const pilot = source('pages/query/process/pilot.js');
  const flags = source('lib/canonical-v2/feature-flags.js');
  assert.match(pilot, /export function getServerSideProps\(\)/);
  assert.match(pilot, /if \(!isCanonicalV2ProcessPilotUiEnabled\(\)\)/);
  assert.match(pilot, /destination: '\/'/);
  assert.match(flags, /CANONICAL_V2_PROCESS_PILOT_UI_ENABLED/);
  assert.match(flags, /env\.VERCEL_ENV === 'preview'/);
  assert.doesNotMatch(pilot, /\/api\/query\/run|\/api\/canonical-v2\/query|\bfetch\s*\(/);
});

test('every Query page redirects before its launch UI can render', () => {
  for (const file of [
    'pages/query/index.js',
    'pages/query/[kind]/[id].js',
    'pages/query/whats-market/adhoc.js',
  ]) {
    const page = source(file);
    assert.match(page, /export function getServerSideProps\(\)/);
    assert.match(page, /destination:\s*['"]\/['"]/);
    assert.match(page, /permanent:\s*false/);
  }
});

test('Review keeps its non-Query market paths and does not launch the contained executor', () => {
  const review = source('pages/review/[id].js');
  assert.doesNotMatch(review, /\buseDealToMarket\b|\/api\/query\/run/);
  assert.match(review, /useRowMarketStats/);
  assert.match(review, /useSectionMarketStats/);
  assert.match(review, /useComparedDeals/);
  assert.match(review, /rows:\s*marketOffMarketRows/);
});

test('the production build contains exactly the source containment inventory', (t) => {
  const manifestFile = path.join(ROOT, '.next/server/pages-manifest.json');
  // BUILD_ID is written only by `next build`, never by `next dev`.
  // tests/auth-route-enforcement.test.js starts a real `next({ dev: true })`
  // server for its own, unrelated integration test and — as an ordinary,
  // documented side effect of Next's dev compiler — leaves a dev-mode
  // .next behind covering only the handful of routes that test happened to
  // hit. pages-manifest.json exists under both modes, so its presence alone
  // cannot tell a genuine production build (this test's actual subject)
  // apart from incidental dev-server output; without this second check, a
  // dev .next left behind by that test (or any manual `next dev` run) makes
  // this test assert against partial dev output instead of skipping, and
  // fail on routes dev mode never compiled rather than proving anything
  // about a real build.
  const buildIdFile = path.join(ROOT, '.next/BUILD_ID');
  if (!fs.existsSync(manifestFile) || !fs.existsSync(buildIdFile)) {
    if (process.env.REQUIRE_QUERY_CONTAINMENT_BUILD === '1') {
      assert.fail('The production pages manifest is missing. Run next build first.');
    }
    t.skip('Production build not present.');
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const route of QUERY_CONTAINED_ROUTES) {
    assert.equal(typeof manifest[route], 'string', `${route} is missing from the production build`);
    const builtRoute = fs.readFileSync(path.join(ROOT, '.next/server', manifest[route]), 'utf8');
    assert.match(builtRoute, /ROUTE_CONTAINED|query-containment/, `${route} lacks the built containment path`);
    assert.doesNotMatch(
      builtRoute,
      /context-cache|query\/engine|canonical-v2\/serving-client/,
      `${route} includes a corpus Query loader`,
    );
  }
});

test('the runtime route inventory agrees with the source inventory', async (t) => {
  const origin = process.env.QUERY_CONTAINMENT_RUNTIME_ORIGIN;
  if (!origin) {
    t.skip('No Query containment runtime origin was supplied.');
    return;
  }
  for (const route of QUERY_CONTAINED_ROUTES) {
    for (const method of HTTP_METHODS) {
      const response = await fetch(`${origin}${route}`, { method });
      assert.equal(response.status, 503, `${method} ${route}`);
      if (method !== 'HEAD') {
        const body = await response.json();
        assert.equal(body.error.code, 'ROUTE_CONTAINED', `${method} ${route}`);
      }
    }
  }
});

test('the runtime UI has no Query launch path or saved-query link', async (t) => {
  const origin = process.env.QUERY_CONTAINMENT_RUNTIME_ORIGIN;
  if (!origin) {
    t.skip('No Query containment runtime origin was supplied.');
    return;
  }
  for (const route of ['/query', '/query/market-range/adhoc', '/query/whats-market/adhoc']) {
    const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
    assert.equal(response.status, 307, route);
    assert.equal(response.headers.get('location'), '/', route);
  }
  const home = await (await fetch(`${origin}/`)).text();
  assert.doesNotMatch(home, /class="querySurface"|data-global-market-launcher/);
  const library = await (await fetch(`${origin}/library`)).text();
  assert.match(library, /Saved queries are unavailable while Query is contained/);
  assert.doesNotMatch(library, /href="\/query\//);
});
