const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('PH0C-C: audit page and APIs expose matrix and freeze gate', () => {
  const page = fs.readFileSync('pages/admin/registry/audit.js', 'utf8');
  const matrix = fs.readFileSync('components/admin/audit/AuditMatrix.jsx', 'utf8');
  const freeze = fs.readFileSync('pages/api/admin/audit/freeze.js', 'utf8');
  assert.match(page, /AuditMatrix/);
  assert.match(matrix, /data-testid="audit-matrix"/);
  assert.match(freeze, /409/);
  assert.match(freeze, /phase-0-C\.frozen/);
});

test('PH0C-C: AdminNav includes Audit after Registry', () => {
  const nav = fs.readFileSync('components/admin/AdminNav.js', 'utf8');
  assert.ok(nav.indexOf("label: 'Registry'") < nav.indexOf("label: 'Audit'"));
});
