const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('/admin/taxonomy renders taxonomy source and live count surface', () => {
  const page = fs.readFileSync('pages/admin/taxonomy.js', 'utf8');
  assert.match(page, /provision-taxonomy-triple-model\.md/);
  assert.match(page, /getServiceSupabase/);
  assert.match(page, /data-testid="taxonomy-node-counts"/);
  for (const node of ['Deal', 'DealProfile', 'Section', 'Provision', 'Excerpt', 'Claim', 'Attribute', 'Verbatim', 'Canonical', 'Provenance', 'Normalizer']) {
    assert.match(page, new RegExp(`'${node}'`));
  }
});

test('nav registry includes taxonomy page in schema group', () => {
  const registry = require('../../docs/admin/nav-registry.json');
  const entry = registry.find((item) => item.id === 'taxonomy');
  assert.equal(entry.href, '/admin/taxonomy');
  assert.equal(entry.group, 'schema');
  assert.equal(entry.order, 40);
  assert.ok(fs.existsSync('pages/admin/taxonomy.js'));
});
