const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('/admin/processing-flow renders source doc, metrics, and gaps', () => {
  const page = fs.readFileSync('pages/admin/processing-flow.js', 'utf8');
  assert.match(page, /provision-processing-flow\.md/);
  assert.match(page, /processing-flow-gaps\.json/);
  assert.match(page, /getServiceSupabase/);
  assert.match(page, /data-testid="processing-flow-metrics"/);
  assert.match(page, /parseProcessingStages/);
});

test('processing flow markdown has a metrics row for each declared stage', () => {
  const markdown = fs.readFileSync('docs/schema-shape/provision-processing-flow.md', 'utf8');
  const stageRows = [...markdown.matchAll(/^\|\s*(\d+)\s*\|\s*\*\*([^*]+)\*\*/gm)];
  assert.equal(stageRows.length, 8);
  const page = fs.readFileSync('pages/admin/processing-flow.js', 'utf8');
  for (const [, id] of stageRows) {
    assert.match(page, new RegExp(`${id}: \\[`));
  }
});

test('nav registry includes processing-flow page in schema group', () => {
  const registry = require('../../docs/admin/nav-registry.json');
  const entry = registry.find((item) => item.id === 'processing-flow');
  assert.equal(entry.href, '/admin/processing-flow');
  assert.equal(entry.group, 'schema');
  assert.equal(entry.order, 50);
  assert.ok(fs.existsSync('pages/admin/processing-flow.js'));
});
