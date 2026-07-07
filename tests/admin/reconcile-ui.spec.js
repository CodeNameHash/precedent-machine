const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('PH0C-D: reconcile page exposes queue and decision API logs one row', () => {
  const page = fs.readFileSync('pages/admin/registry/reconcile.js', 'utf8');
  const sidebar = fs.readFileSync('components/admin/reconcile/QueueSidebar.jsx', 'utf8');
  const decide = fs.readFileSync('pages/api/admin/reconcile/decide.js', 'utf8');
  assert.match(page, /EntryPane/);
  assert.match(page, /group: 'field_key'/);
  assert.match(page, /selectedRawId/);
  assert.match(page, /setMessage/);
  assert.match(sidebar, /data-testid="reconcile-queue"/);
  assert.match(sidebar, /entryTotal/);
  assert.match(decide, /reconciliation-log\.jsonl/);
  assert.match(decide, /failAfterPrepare/);
  assert.match(decide, /applyResolution/);
  assert.match(decide, /field_key/);
  assert.match(decide, /raw_value/);
  assert.match(decide, /targetCanonicalKey/);
  assert.match(decide, /process\.env\.VERCEL/);
});

test('PH0C-D: queue API supports grouped slices for bulk triage', () => {
  const queue = fs.readFileSync('pages/api/admin/reconcile/queue.js', 'utf8');
  assert.match(queue, /groupFieldEntries/);
  assert.match(queue, /hydrateCandidates/);
  assert.match(queue, /entry_total/);
  assert.match(queue, /deal_count/);
  assert.match(queue, /query\.group === 'field_key'/);
});

test('PH0C-D: reconcile actions expose disabled states and feedback copy', () => {
  const pane = fs.readFileSync('components/admin/reconcile/EntryPane.jsx', 'utf8');
  assert.match(pane, /Select a suggested match before Merge or Promote/);
  assert.match(pane, /rawGroups\.map/);
  assert.match(pane, /message\.tone === 'error'/);
  assert.match(pane, /disabled=\{!selectedCandidate \|\| isResolving\}/);
});

test('PH0C-D: AdminNav includes Reconcile after Audit', () => {
  const registry = require('../../docs/admin/nav-registry.json');
  const schema = registry.filter((entry) => entry.group === 'schema').sort((a, b) => a.order - b.order);
  assert.ok(schema.findIndex((entry) => entry.label === 'Audit') < schema.findIndex((entry) => entry.label === 'Reconcile'));
});
