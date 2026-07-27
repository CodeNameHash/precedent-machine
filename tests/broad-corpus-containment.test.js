const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  BROAD_CORPUS_CONTAINED_ROUTES,
  BROAD_CORPUS_CONTAINED_ROUTE_FILES,
  createBroadCorpusContainedHandler,
  sendBroadCorpusRouteContained,
} = require('../lib/broad-corpus-containment');

const ROOT = path.join(__dirname, '..');
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

function source(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

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

test('fully contained broad routes return one deterministic 503 only on their supported method', async () => {
  for (const allowedMethod of Object.values(BROAD_CORPUS_CONTAINED_ROUTES)) {
    const allowedMethods = Array.isArray(allowedMethod) ? allowedMethod : [allowedMethod];
    const handler = createBroadCorpusContainedHandler(allowedMethod);
    for (const method of HTTP_METHODS) {
      const res = responseRecorder();
      await handler({ method }, res);
      if (allowedMethods.includes(method)) {
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.error.code, 'ROUTE_CONTAINED');
        assert.equal(res.headers['Cache-Control'], 'private, no-store');
        assert.equal(res.headers['Retry-After'], undefined);
      } else {
        assert.equal(res.statusCode, 405);
        assert.equal(res.headers.Allow, allowedMethods.join(', '));
      }
    }
  }
});

test('the partial-containment response uses the same no-retry contract', () => {
  const res = responseRecorder();
  sendBroadCorpusRouteContained(res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, 'ROUTE_CONTAINED');
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(res.headers['Retry-After'], undefined);
});

test('fully contained route modules import no database, corpus, model or environment code', () => {
  assert.deepEqual(
    Object.keys(BROAD_CORPUS_CONTAINED_ROUTE_FILES),
    Object.keys(BROAD_CORPUS_CONTAINED_ROUTES),
  );
  for (const [route, file] of Object.entries(BROAD_CORPUS_CONTAINED_ROUTE_FILES)) {
    const routeSource = source(file);
    assert.match(routeSource, /require\(['"](?:\.\.\/){2,3}lib\/broad-corpus-containment['"]\)/);
    assert.match(routeSource, /createBroadCorpusContainedHandler\(/);
    assert.doesNotMatch(
      routeSource,
      /supabase|anthropic|createClient|process\.env|fetch|readFile|from\(/i,
    );
    assert.equal((routeSource.match(/\brequire\(/g) || []).length, 1);
    assert.equal((routeSource.match(/\bimport\s/g) || []).length, 0);
  }
});

test('loading the broad containment module loads no database or corpus dependency', () => {
  const containmentPath = require.resolve('../lib/broad-corpus-containment');
  delete require.cache[containmentPath];
  const before = new Set(Object.keys(require.cache));
  require('../lib/broad-corpus-containment');
  const loaded = Object.keys(require.cache).filter((file) => !before.has(file));
  assert.deepEqual(loaded, [containmentPath]);
});

test('partial routes reject broad work before creating a Supabase client', () => {
  const provisions = source('pages/api/provisions.js');
  const reprocess = source('pages/api/admin/reprocess-cond.js');
  const gaps = source('pages/api/admin/gaps.js');

  assert.ok(provisions.indexOf('if (!hasScope)') < provisions.indexOf('const sb = getServiceSupabase()'));
  assert.match(provisions, /query\.id \|\| query\.deal_id/);
  assert.match(provisions, /Boolean\(body\.deal_id\)/);
  assert.match(provisions, /Boolean\(body\.id\)/);

  assert.ok(reprocess.indexOf('if (!deal_id)') < reprocess.indexOf('const sb = getServiceSupabase()'));
  assert.doesNotMatch(reprocess, /from\('deals'\)\.select\('id'\)/);

  assert.ok(
    gaps.indexOf("req.method === 'GET' && shouldRefreshMetrics(req)")
      < gaps.indexOf('const sb = getServiceSupabase()'),
  );
  assert.match(gaps, /if \(dealId\) return getDetail/);
  assert.match(gaps, /return getSummary/);
});

test('unscoped deals are served from the bounded home snapshot before Supabase', () => {
  const deals = source('pages/api/deals.js');
  const snapshot = require('../lib/generated/home-deal-directory-v1.json');

  assert.ok(deals.indexOf("req.method === 'GET' && !(req.query && req.query.id)") < deals.indexOf('const sb = getServiceSupabase()'));
  assert.match(deals, /getHomePayload\(\)\.deals/);
  assert.match(deals, /acquirer: deal\.buyer_display/);
  assert.match(deals, /target: deal\.target_display/);
  assert.equal(snapshot.deals.length, 40);
  assert.match(deals, /if \(id\)/);
  assert.match(deals, /\.eq\('id', id\)\.single\(\)/);
});

test('contained UI callers do not fan out or treat the response as market data', () => {
  const compareData = source('components/review-v2/compareData.js');
  const clauseSidebar = source('components/review-v2/ClauseSidebar.jsx');
  const provisionPage = source('pages/provisions/[id].js');
  const gapsPage = source('pages/admin/gaps.js');

  assert.match(compareData, /MARKET_BATCH_RETRIES = 0/);
  assert.match(compareData, /shouldFallbackToPerCode\(error\)/);
  assert.match(compareData, /\[404, 405, 501\]/);
  assert.match(compareData, /payload\.error\?\.code \|\| payload\.code/);
  assert.match(clauseSidebar, /payload\.error\?\.message/);
  assert.match(clauseSidebar, /payload\.error\?\.code \|\| payload\.code/);
  assert.match(provisionPage, /propResp\.ok && propData\.matches/);
  assert.doesNotMatch(gapsPage, /refresh_metrics=1/);
  assert.doesNotMatch(gapsPage, /loadSummary\(true\)/);
  assert.match(gapsPage, /Stored metrics only/);
});
