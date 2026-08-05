const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  filePathToRoutePath,
  instantiateDynamicSegments,
  enumerateApiRoutes,
} = require('../lib/auth/route-scan');

test('filePathToRoutePath: flat file', () => {
  assert.equal(filePathToRoutePath('saved-queries.js'), '/api/saved-queries');
});

test('filePathToRoutePath: nested file', () => {
  assert.equal(filePathToRoutePath('admin/reprocess-cond.js'), '/api/admin/reprocess-cond');
});

test('filePathToRoutePath: index.js maps to the parent directory', () => {
  assert.equal(filePathToRoutePath('admin/review-queue/index.js'), '/api/admin/review-queue');
});

test('filePathToRoutePath: dynamic segment preserved as [id]', () => {
  assert.equal(filePathToRoutePath('review/[id]/cards.js'), '/api/review/[id]/cards');
  assert.equal(filePathToRoutePath('admin/review-queue/[id]/resolve.js'), '/api/admin/review-queue/[id]/resolve');
});

test('instantiateDynamicSegments replaces every bracketed segment with the placeholder', () => {
  const placeholder = '00000000-0000-4000-8000-000000000000';
  assert.equal(
    instantiateDynamicSegments('/api/review/[id]/cards', placeholder),
    `/api/review/${placeholder}/cards`,
  );
  assert.equal(instantiateDynamicSegments('/api/saved-queries', placeholder), '/api/saved-queries');
});

test('enumerateApiRoutes walks the real pages/api directory and finds known routes', () => {
  const apiDir = path.join(__dirname, '..', 'pages', 'api');
  const routes = enumerateApiRoutes(apiDir);
  const requestPaths = routes.map((r) => r.requestPath);

  assert.ok(routes.length > 60, `expected 60+ routes, found ${routes.length}`);
  assert.ok(requestPaths.includes('/api/deals'));
  assert.ok(requestPaths.includes('/api/users'));
  assert.ok(requestPaths.includes('/api/cron/edgar-watch'));
  assert.ok(requestPaths.includes('/api/admin/review-queue'), 'index.js should collapse to the directory path');
  assert.ok(
    requestPaths.some((p) => /^\/api\/review\/[0-9a-f-]+\/cards$/.test(p)),
    'dynamic [id] segment should be instantiated with a placeholder',
  );
  // No route path should still contain a literal bracket after instantiation.
  for (const p of requestPaths) {
    assert.doesNotMatch(p, /[[\]]/, `${p} still has an uninstantiated dynamic segment`);
  }
});

test('enumerateApiRoutes finds no duplicate request paths', () => {
  const apiDir = path.join(__dirname, '..', 'pages', 'api');
  const requestPaths = enumerateApiRoutes(apiDir).map((r) => r.requestPath);
  const seen = new Set();
  const dupes = [];
  for (const p of requestPaths) {
    if (seen.has(p)) dupes.push(p);
    seen.add(p);
  }
  assert.deepEqual(dupes, []);
});
