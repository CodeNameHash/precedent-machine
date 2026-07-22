const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  blockVercelRepositoryArtifactRoute,
  isVercelRuntime,
} = require('../../lib/admin/repository-artifact-access');

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('repository-backed admin work remains available outside Vercel', () => {
  const res = responseRecorder();
  assert.equal(isVercelRuntime({}), false);
  assert.equal(blockVercelRepositoryArtifactRoute(res, {}), false);
  assert.equal(res.statusCode, null);
});

test('repository-backed admin work is hidden on every Vercel environment', () => {
  const res = responseRecorder();
  assert.equal(isVercelRuntime({ VERCEL: '1' }), true);
  assert.equal(blockVercelRepositoryArtifactRoute(res, { VERCEL: '1' }), true);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'not_found' });
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('all routes that require excluded deployment inputs use the Vercel gate', () => {
  const routes = [
    'pages/api/admin/audit/freeze.js',
    'pages/api/admin/audit/matrix.js',
    'pages/api/admin/audit/decision.js',
    'pages/api/admin/reconcile/decide.js',
    'pages/api/admin/reconcile/queue.js',
    'pages/api/admin/registry/decision.js',
    'pages/api/admin/registry/freeze.js',
    'pages/api/admin/review-queue/[id]/resolve.js',
    'pages/api/admin/schema-loss/decide.js',
    'pages/api/admin/schema-loss/rerun.js',
  ];
  for (const route of routes) {
    assert.match(fs.readFileSync(route, 'utf8'), /blockVercelRepositoryArtifactRoute\(res\)/, route);
  }
  for (const page of ['pages/admin/registry/audit.js', 'pages/admin/registry/reconcile.js']) {
    assert.match(fs.readFileSync(page, 'utf8'), /process\.env\.VERCEL.*notFound: true/, page);
  }
});
