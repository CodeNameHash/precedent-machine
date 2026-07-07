const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('PH0C-D: reconcile page exposes queue and decision API logs one row', () => {
  const page = fs.readFileSync('pages/admin/registry/reconcile.js', 'utf8');
  const sidebar = fs.readFileSync('components/admin/reconcile/QueueSidebar.jsx', 'utf8');
  const decide = fs.readFileSync('pages/api/admin/reconcile/decide.js', 'utf8');
  assert.match(page, /EntryPane/);
  assert.match(sidebar, /data-testid="reconcile-queue"/);
  assert.match(decide, /reconciliation-log\.jsonl/);
  assert.match(decide, /failAfterPrepare/);
});

test('PH0C-D: AdminNav includes Reconcile after Audit', () => {
  const nav = fs.readFileSync('components/admin/AdminNav.js', 'utf8');
  assert.ok(nav.indexOf("label: 'Audit'") < nav.indexOf("label: 'Reconcile'"));
});
