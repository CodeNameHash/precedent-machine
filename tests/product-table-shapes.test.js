'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validateTableShapes } = require('../lib/product/table-shapes');
const tableShapes = require('../contracts/product/table-shapes.v1.json');
const legalSchemaV2 = require('../contracts/product/legal-schema.v2.json');

test('table shapes validate against the V2 legal schema', () => {
  const validated = validateTableShapes(tableShapes, legalSchemaV2);
  assert.equal(validated.schema_version, 'PRODUCT_TABLE_SHAPES/V1');
});

test('the generator is deterministic', () => {
  const target = path.join(__dirname, '../contracts/product/table-shapes.v1.json');
  const before = fs.readFileSync(target, 'utf8');
  execFileSync('node', [path.join(__dirname, '../scripts/product/build-table-shapes.js')], { stdio: 'pipe' });
  const after = fs.readFileSync(target, 'utf8');
  assert.equal(after, before, 'committed table-shapes.v1.json must equal the generator output');
});

function findSection(key) {
  const section = tableShapes.sections.find((s) => s.section_key === key);
  assert.ok(section, `section '${key}' not found`);
  return section;
}

test('Equity Awards carries the columns the site shows', () => {
  const section = findSection('equity-awards');
  assert.equal(section.title, 'Equity Awards');
  const table = section.tables[0];
  assert.equal(table.term_column.header, 'Equity Type');
  const headers = table.columns.map((c) => c.header);
  assert.deepEqual(headers, ['Consideration', 'Vesting Treatment', 'CVR Entitlement']);
});

test('Employee Compensation and Benefits carries the columns the site shows', () => {
  const section = findSection('employee-benefits');
  assert.equal(section.title, 'Employee Compensation and Benefits');
  const table = section.tables[0];
  assert.equal(table.term_column.header, 'Benefit');
  const headers = table.columns.map((c) => c.header);
  assert.deepEqual(headers, ['Reference Group', 'Standard', 'Period']);
  assert.equal(table.rows_are, 'fixed list');
  assert.ok(table.fixed_row_labels.includes('Base salary'));
  assert.ok(table.fixed_row_labels.includes('Target annual bonus / cash incentive'));
});

test('every section, table and column key is unique across the document', () => {
  const sectionKeys = new Set();
  const tableKeys = new Set();
  for (const section of tableShapes.sections) {
    assert.ok(!sectionKeys.has(section.section_key), `duplicate section_key ${section.section_key}`);
    sectionKeys.add(section.section_key);
    for (const table of section.tables) {
      assert.ok(!tableKeys.has(table.table_key), `duplicate table_key ${table.table_key}`);
      tableKeys.add(table.table_key);
      const columnIds = new Set();
      for (const column of table.columns) {
        assert.ok(!columnIds.has(column.column_id), `duplicate column_id ${column.column_id} in ${table.table_key}`);
        columnIds.add(column.column_id);
      }
    }
  }
});
