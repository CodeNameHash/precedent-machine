const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildInventory,
  gapsMarkdown,
  inventoryMarkdown,
} = require('../../scripts/audit/layout-slot-inventory');

test('layout slot inventory detects expected M2-08 gaps and mapped M2-06 surfaces', () => {
  const rows = buildInventory();
  const gaps = rows.filter((row) => row.status === 'gap').map((row) => row.config);
  assert.ok(gaps.includes('structure-mechanics.config.js'));
  assert.ok(gaps.includes('antitrust-regulatory.config.js'));
  assert.ok(gaps.includes('mae-definitions.config.js'));
  assert.ok(gaps.includes('termination-rights.config.js'));
  assert.ok(rows.some((row) => row.status === 'mapped' && /consideration-hero/.test(row.m206)));
});

test('layout slot inventory markdown renders inventory and gap reports', () => {
  const rows = buildInventory();
  const inventory = inventoryMarkdown(rows, '2026-07-08T00:00:00.000Z');
  const gaps = gapsMarkdown(rows, '2026-07-08T00:00:00.000Z');
  assert.match(inventory, /Legacy Layout Inventory/);
  assert.match(inventory, /Structure & Mechanics/);
  assert.match(gaps, /M2-08 Config Gaps/);
  assert.match(gaps, /termination-fees\.config\.js/);
});
