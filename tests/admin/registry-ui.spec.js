const assert = require('node:assert/strict');
const fs = require('fs');
const test = require('node:test');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

test('admin registry page exposes sidebar, cards, vocab, freeze, preview, and decision wiring', () => {
  const page = read('pages/admin/registry.js');
  assert.match(page, /data-testid="freeze-registry"/);
  assert.match(page, /Freeze registry/);
  assert.match(page, /VOCAB/);
  assert.match(page, /\/api\/admin\/registry\/decision/);
  assert.match(page, /\/api\/admin\/registry\/preview/);
  assert.match(page, /RegistrySidebar/);
  assert.match(page, /RegistryCard/);
  assert.match(page, /RegistryMergeBoard/);
  assert.match(page, /Board/);
});

test('registry components carry stable test ids', () => {
  const sidebar = read('components/admin/registry/RegistrySidebar.jsx');
  const card = read('components/admin/registry/RegistryCard.jsx');
  const board = read('components/admin/registry/RegistryMergeBoard.jsx');
  assert.match(sidebar, /data-testid="registry-sidebar"/);
  assert.match(card, /data-testid="registry-card"/);
  assert.match(board, /data-testid="registry-merge-board"/);
  assert.match(board, /onDrop/);
  assert.match(board, /decision: 'merge'/);
});

test('registry API freezes only after pending decisions clear', () => {
  const freeze = read('pages/api/admin/registry/freeze.js');
  assert.match(freeze, /409/);
  assert.match(freeze, /pending_reviewer_decisions/);
  assert.match(freeze, /FROZEN-v1\.json/);
});

test('admin nav includes registry route', () => {
  const nav = read('components/admin/AdminNav.js');
  assert.match(nav, /\/admin\/registry/);
  assert.match(nav, /Registry/);
});
