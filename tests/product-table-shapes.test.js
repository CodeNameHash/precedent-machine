'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validateTableShapes, validateTableShapesV2 } = require('../lib/product/table-shapes');
const tableShapes = require('../contracts/product/table-shapes.v1.json');
const tableShapesV2 = require('../contracts/product/table-shapes.v2.json');
const legalSchemaV2 = require('../contracts/product/legal-schema.v2.json');
const factComponentsV2 = require('../contracts/product/fact-components.v2.json');

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

// ---------------------------------------------------------------------------
// Pass 2 (docs/core/CODEBASE-GUIDE.md "Layered fact model, V2"): the print-
// harvested vocabulary in contracts/product/table-shapes.v2.json.
// ---------------------------------------------------------------------------

test('table shapes V2 validate against the V2 legal schema and fact-components contract', () => {
  const validated = validateTableShapesV2(tableShapesV2, legalSchemaV2, factComponentsV2);
  assert.equal(validated.schema_version, 'PRODUCT_TABLE_SHAPES/V2');
});

test('the V2 generator is deterministic', () => {
  const target = path.join(__dirname, '../contracts/product/table-shapes.v2.json');
  const before = fs.readFileSync(target, 'utf8');
  execFileSync('node', [path.join(__dirname, '../scripts/product/build-table-shapes-pass2.js')], { stdio: 'pipe' });
  const after = fs.readFileSync(target, 'utf8');
  assert.equal(after, before, 'committed table-shapes.v2.json must equal the generator output');
});

function findSectionV2(key) {
  const section = tableShapesV2.sections.find((s) => s.section_key === key);
  assert.ok(section, `V2 section '${key}' not found`);
  return section;
}

function findColumn(table, columnId) {
  const column = table.columns.find((c) => c.column_id === columnId);
  assert.ok(column, `column '${columnId}' not found in table '${table.table_key}'`);
  return column;
}

test('Votes has a value column with a trigger vocabulary containing agreement date, effectiveness and mailing', () => {
  const section = findSectionV2('votes-approvals-meeting');
  const table = section.tables.find((t) => t.table_key === 'votes-approvals-meeting-table');
  const valueColumn = findColumn(table, 'value');
  assert.equal(valueColumn.render, 'value');
  assert.ok(valueColumn.trigger && Array.isArray(valueColumn.trigger.vocabulary), 'value column has a trigger vocabulary');
  const triggerLabels = valueColumn.trigger.vocabulary.map((v) => v.label);
  assert.ok(triggerLabels.some((l) => l.includes('agreement date')), 'trigger vocabulary mentions agreement date');
  assert.ok(triggerLabels.some((l) => l.includes('effectiveness')), 'trigger vocabulary mentions effectiveness');
  assert.ok(triggerLabels.some((l) => l.includes('mailing')), 'trigger vocabulary mentions mailing');
});

test('Employee benefits has the fixed benefit rows and a Reference Group vocabulary of exactly the two legacy labels', () => {
  const section = findSectionV2('employee-benefits');
  const table = section.tables.find((t) => t.table_key === 'employee-benefits-table');
  assert.equal(table.rows_are, 'fixed list');
  for (const label of [
    'Severance / change-in-control protection', 'Other benefits', 'Base salary',
    'Long-term incentive (LTI) / equity grants', 'Target annual bonus / cash incentive',
    'Retirement / 401(k) benefits',
  ]) {
    assert.ok(table.fixed_row_labels.includes(label), `fixed_row_labels missing '${label}'`);
  }
  const referenceGroup = findColumn(table, 'comparison');
  const labels = referenceGroup.vocabulary.map((v) => v.label).sort();
  assert.deepEqual(labels, ['Company pre-closing arrangements', 'Similarly-situated buyer employees'].sort());
  assert.ok(referenceGroup.vocabulary.every((v) => v.source === 'legacy_map'), 'Reference Group vocabulary is legacy_map-sourced');
});

test('Closing Conditions carries the four bring-down standards', () => {
  const section = findSectionV2('conditions-b');
  const table = section.tables[0];
  const standard = findColumn(table, 'standard');
  const labels = standard.vocabulary.map((v) => v.label);
  for (const tier of [
    'TRUE IN ALL RESPECTS', 'TRUE EXCEPT FOR DE MINIMIS INACCURACIES',
    'TRUE IN ALL MATERIAL RESPECTS', 'TRUE EXCEPT WHERE FAILURE WOULD NOT CAUSE AN MAE',
  ]) {
    assert.ok(labels.includes(tier), `bring-down tier missing: ${tier}`);
  }
});

test('Termination Rights has EXERCISED BY with "Either party may elect (not automatic)"', () => {
  const section = findSectionV2('termination-rights');
  const table = section.tables.find((t) => t.table_key === 'termination-rights-mutual');
  const exercisedBy = findColumn(table, 'exercisedBy');
  assert.ok(exercisedBy.vocabulary.some((v) => v.label === 'Either party may elect (not automatic)'));
});

test('every V2 vocabulary entry sourced from print carries evidence that is actually on the cited page', () => {
  const print = require('../fixtures/product/topbuild-review/print-text.v1.json');
  const byPage = new Map(print.pages.map((p) => [p.page, p.text.replace(/-\s*\n\s*/g, '-').replace(/\s+/g, ' ')]));
  let checked = 0;
  for (const section of tableShapesV2.sections) {
    for (const table of section.tables) {
      for (const column of table.columns) {
        const vocabs = [column.vocabulary, column.trigger && column.trigger.vocabulary].filter(Boolean);
        for (const vocabulary of vocabs) {
          for (const entry of vocabulary) {
            if (entry.source !== 'print' && entry.source !== 'both') continue;
            checked += 1;
            const pageText = byPage.get(entry.print_evidence.page);
            assert.ok(pageText, `page ${entry.print_evidence.page} exists for "${entry.label}"`);
            assert.ok(
              pageText.includes(entry.label.replace(/\s+/g, ' ')),
              `"${entry.label}" not found on page ${entry.print_evidence.page}`,
            );
          }
        }
      }
    }
  }
  assert.ok(checked > 50, `expected many print-sourced vocabulary entries to check, saw ${checked}`);
});

test('every V2 addition (column or vocabulary code) carries a reason', () => {
  for (const section of tableShapesV2.sections) {
    for (const table of section.tables) {
      for (const column of table.columns) {
        if (column.addition) assert.ok(column.reason, `addition column ${table.table_key}.${column.column_id} has no reason`);
        for (const entry of column.vocabulary || []) {
          if (entry.addition) assert.ok(entry.reason, `addition vocabulary ${table.table_key}.${column.column_id}.${entry.code} has no reason`);
        }
      }
      for (const row of table.additional_fixed_row_labels || []) {
        assert.ok(row.reason, `additional fixed row ${table.table_key}.${row.label} has no reason`);
      }
    }
  }
});

test('every V2 column carries fill_from kinds drawn from the FACT_COMPONENTS/V2 contract', () => {
  const kinds = new Set(factComponentsV2.component.component_kinds);
  for (const section of tableShapesV2.sections) {
    for (const table of section.tables) {
      for (const column of table.columns) {
        assert.ok(Array.isArray(column.fill_from) && column.fill_from.length > 0, `${table.table_key}.${column.column_id} has no fill_from`);
        for (const kind of column.fill_from) {
          assert.ok(kinds.has(kind), `${table.table_key}.${column.column_id} fill_from has unknown kind ${kind}`);
        }
      }
    }
  }
});
