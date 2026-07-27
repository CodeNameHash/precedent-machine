const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('PH0C-C: local audit page remains available while production audit APIs are contained', () => {
  const page = fs.readFileSync('pages/admin/registry/audit.js', 'utf8');
  const matrix = fs.readFileSync('components/admin/audit/AuditMatrix.jsx', 'utf8');
  const freeze = fs.readFileSync('pages/api/admin/audit/freeze.js', 'utf8');
  const matrixApi = fs.readFileSync('pages/api/admin/audit/matrix.js', 'utf8');
  assert.match(page, /AuditMatrix/);
  assert.match(page, /withBuildTimeout\(buildAuditMatrix\(\)\)/);
  assert.match(matrix, /data-testid="audit-matrix"/);
  assert.match(freeze, /phase-0-C\.frozen/);
  assert.match(freeze, /return sendBroadCorpusRouteContained\(res\)/);
  assert.match(matrixApi, /return sendBroadCorpusRouteContained\(res\)/);
});

test('PH0C-C: AdminNav includes Audit after Registry', () => {
  const registry = require('../../docs/admin/nav-registry.json');
  const schema = registry.filter((entry) => entry.group === 'schema').sort((a, b) => a.order - b.order);
  assert.ok(schema.findIndex((entry) => entry.label === 'Registry') < schema.findIndex((entry) => entry.label === 'Audit'));
});
