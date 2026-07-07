const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('review queue page is wired to the backend API and entry component', () => {
  const page = fs.readFileSync('pages/admin/review-queue.js', 'utf8');
  assert.match(page, /ReviewQueuePage\.noLayout = true/);
  assert.match(page, /ReviewQueueEntry/);
  assert.match(page, /data-testid="review-queue-page"/);
  assert.match(page, /fetch\('\/api\/admin\/review-queue'\)/);
  assert.match(page, /fetch\(`\/api\/admin\/review-queue\/\$\{encodeURIComponent\(entry\.id\)\}\/resolve`/);
  assert.match(page, /choice_key: choice\.key/);
  assert.match(page, /resolved_by: 'ben'/);
});

test('review queue entry exposes evidence links and choice buttons', () => {
  const component = fs.readFileSync('components/admin/ReviewQueueEntry.js', 'utf8');
  assert.match(component, /data-testid="review-queue-entry"/);
  assert.match(component, /data-testid="review-queue-choice"/);
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noreferrer"/);
  assert.match(component, /onResolve\(entry, choice\)/);
  assert.match(component, /disabled=\{Boolean\(resolvingChoice\)\}/);
});

test('review queue nav registration points at the page', () => {
  const registry = require('../../docs/admin/nav-registry.json');
  const entry = registry.find((item) => item.id === 'review-queue');
  assert.ok(entry);
  assert.equal(entry.href, '/admin/review-queue');
  assert.equal(entry.group, 'schema');
  assert.equal(entry.order, 70);
  assert.ok(fs.existsSync('pages/admin/review-queue.js'));
});
