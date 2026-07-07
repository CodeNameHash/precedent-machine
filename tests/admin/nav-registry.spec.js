const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const registry = require('../../docs/admin/nav-registry.json');

test('nav-registry.json is well-formed', () => {
  const allowedGroups = new Set(['schema', 'ingest', 'search', 'system']);
  for (const entry of registry) {
    assert.equal(typeof entry.id, 'string');
    assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof entry.label, 'string');
    assert.equal(typeof entry.href, 'string');
    assert.ok(allowedGroups.has(entry.group), `${entry.id} has invalid group ${entry.group}`);
    assert.equal(typeof entry.order, 'number');
    assert.equal(typeof entry.description, 'string');
    assert.ok(entry.description.endsWith('.'), `${entry.id} description must be one sentence`);
  }
});

test('nav-registry ids are unique', () => {
  const ids = registry.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('nav-registry hrefs are valid admin or search routes', () => {
  for (const entry of registry) {
    assert.ok(entry.href === '/' || entry.href.startsWith('/admin/'), `${entry.id} href ${entry.href} is invalid`);
    assert.notEqual(entry.href, '/ingest');
  }
});

test('AdminNav renders from the registry source', () => {
  const nav = fs.readFileSync('components/admin/AdminNav.js', 'utf8');
  assert.match(nav, /nav-registry\.json/);
  assert.match(nav, /groupedAdminNavLinks\(\)\.map/);
  assert.match(nav, /link\.href/);
  assert.match(nav, /link\.label/);
  assert.doesNotMatch(nav, /Legacy ingest/);
});

test('nav-registry render snapshot', () => {
  const grouped = registry
    .slice()
    .sort((a, b) => a.group.localeCompare(b.group) || a.order - b.order)
    .map((entry) => `${entry.group}:${entry.order}:${entry.label}:${entry.href}`);
  assert.deepEqual(grouped, [
    'ingest:10:Upload agreements:/admin/agreements',
    'ingest:20:Deal candidates:/admin/candidates',
    'ingest:30:Ingest runs:/admin/ingest-runs',
    'ingest:40:Gap review:/admin/gaps',
    'schema:10:Registry:/admin/registry',
    'schema:20:Audit:/admin/registry/audit',
    'schema:30:Reconcile:/admin/registry/reconcile',
    'search:10:Search / Review:/',
  ]);
});
