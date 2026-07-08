const assert = require('node:assert/strict');
const test = require('node:test');

const {
  auditFiles,
  inventoryMarkdown,
  missingExpectedNames,
  primitiveRows,
  primitivesMarkdown,
} = require('../../scripts/audit/legacy-jsx-audit');

test('legacy JSX audit captures live review table components and historical absences', () => {
  const components = auditFiles();
  const names = components.map((component) => component.name);
  assert.ok(names.includes('StructTable'));
  assert.ok(names.includes('RepMaterialContractsTable'));
  assert.ok(names.includes('CondSingleTable'));
  assert.ok(names.includes('AntitrustSummaryTable'));
  assert.ok(names.includes('ProvisionTable'));
  assert.ok(missingExpectedNames(components).includes('ConsiderationTables'));
});

test('legacy JSX audit infers the baseline M2-09 primitive set', () => {
  const primitives = primitiveRows(auditFiles()).map((row) => row.primitive);
  for (const primitive of [
    'PillCell',
    'ThresholdCellWithHoverQuote',
    'CoverageChecklist',
    'GroupedSubRows',
    'RomanNumeralOrdinal',
    'EvidenceHoverSource',
  ]) {
    assert.ok(primitives.includes(primitive), `${primitive} should be inferred`);
  }
});

test('legacy JSX audit markdown includes source ranges and primitive consumers', () => {
  const components = auditFiles();
  const inventory = inventoryMarkdown(components, '2026-07-08T00:00:00.000Z');
  const primitives = primitivesMarkdown(primitiveRows(components), '2026-07-08T00:00:00.000Z');
  assert.match(inventory, /RepMaterialContractsTable/);
  assert.match(inventory, /Source: `pages\/review\/\[id\]\.js:/);
  assert.match(inventory, /Named legacy components not present/);
  assert.match(primitives, /ThresholdCellWithHoverQuote/);
  assert.match(primitives, /EvidenceHoverSource/);
});
