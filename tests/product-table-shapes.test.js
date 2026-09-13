'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validateTableShapes, validateTableShapesV2, validateTableShapesV3 } = require('../lib/product/table-shapes');
const tableShapes = require('../contracts/product/table-shapes.v1.json');
const tableShapesV2 = require('../contracts/product/table-shapes.v2.json');
const tableShapesV3 = require('../contracts/product/table-shapes.v3.json');
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

// ---------------------------------------------------------------------------
// Pass 3 (Ben's answers, 2026-09-13, to the twenty questions pass 2's readout
// asked -- docs/codex-program/notes/TABLE-SHAPES-AND-VOCABULARIES-FOR-BEN-
// 2026-09-12.md). One assertion per decision, encoded in
// contracts/product/table-shapes.v3.json.
// ---------------------------------------------------------------------------

test('table shapes V3 validate against the V2 legal schema and fact-components contract', () => {
  const validated = validateTableShapesV3(tableShapesV3, legalSchemaV2, factComponentsV2);
  assert.equal(validated.schema_version, 'PRODUCT_TABLE_SHAPES/V3');
  assert.equal(validated.status, 'DECIDED');
});

test('the V3 generator is deterministic', () => {
  const target = path.join(__dirname, '../contracts/product/table-shapes.v3.json');
  const before = fs.readFileSync(target, 'utf8');
  execFileSync('node', [path.join(__dirname, '../scripts/product/build-table-shapes-pass3.js')], { stdio: 'pipe' });
  const after = fs.readFileSync(target, 'utf8');
  assert.equal(after, before, 'committed table-shapes.v3.json must equal the generator output');
});

function findSectionV3(key) {
  const section = tableShapesV3.sections.find((s) => s.section_key === key);
  assert.ok(section, `V3 section '${key}' not found`);
  return section;
}

function findTableV3(section, key) {
  const table = section.tables.find((t) => t.table_key === key);
  assert.ok(table, `V3 table '${key}' not found in section '${section.section_key}'`);
  return table;
}

// Decision 1: deal-structure and merger-form vocabularies, per-step structure.
test('Decision 1: deal structure carries One-step / Double / Tender-offer codes, "One Step Merger" survives only as a display variant, and merger form is a shared vocabulary with a per-step structure', () => {
  const section = findSectionV3('structure-mechanics');
  const table = findTableV3(section, 'structure-mechanics-table');
  const dealStructure = table.columns.find((c) => c.column_id === 'dealStructure');
  const codes = dealStructure.vocabulary.map((v) => v.code);
  assert.deepEqual(codes.sort(), ['DOUBLE_MERGER', 'ONE_STEP_MERGER', 'TENDER_OFFER_BACK_END_MERGER'].sort());
  const oneStep = dealStructure.vocabulary.find((v) => v.code === 'ONE_STEP_MERGER');
  assert.equal(oneStep.label, 'One-step merger');
  assert.ok(oneStep.display_variants.some((v) => v.label === 'One Step Merger'), '"One Step Merger" kept only as a display variant');
  const doubleMerger = dealStructure.vocabulary.find((v) => v.code === 'DOUBLE_MERGER');
  assert.ok(!doubleMerger.label.toLowerCase().includes('one step'), 'Double merger must not be labeled One Step Merger');

  // Decision 28 (Ben, 2026-09-13: "why does merger form appear twice?"):
  // the legacy Merger Form column is gone; the per-step column is the form.
  assert.equal(table.columns.some((c) => c.column_id === 'signals'), false);
  const mergerForm = table.columns.find((c) => c.column_id === 'mergerFormStep1');
  assert.equal(mergerForm.vocabulary_ref, 'MERGER_FORM');
  assert.deepEqual(table.columns.slice(0, 3).map((c) => c.column_id), ['dealStructure', 'mergerFormStep1', 'survivingEntityStep1']);
  const mergerFormVocab = tableShapesV3.shared_vocabularies.MERGER_FORM;
  assert.deepEqual(mergerFormVocab.map((v) => v.label).sort(), ['Forward merger', 'Forward triangular merger', 'Reverse triangular merger'].sort());

  assert.ok(table.per_step_structure && table.per_step_structure.steps.length === 2, 'per-step structure with first and second step');
  const [step1, step2] = table.per_step_structure.steps;
  assert.equal(table.columns.find((c) => c.column_id === step1.form_column_id).vocabulary_ref, 'MERGER_FORM');
  assert.equal(table.columns.find((c) => c.column_id === step1.surviving_entity_column_id).render, 'term');
  assert.equal(table.columns.find((c) => c.column_id === step2.form_column_id).vocabulary_ref, 'MERGER_FORM');
  assert.equal(table.columns.find((c) => c.column_id === step2.surviving_entity_column_id).render, 'term');
  assert.deepEqual(mergerForm.fill_from, ['OPERATION', 'ACTOR', 'OBJECT']);
  assert.deepEqual(table.columns.find((c) => c.column_id === step1.surviving_entity_column_id).fill_from, ['TERM']);
});

// Decision 2: CVR entitlement vocabulary.
test('Decision 2: CVR Entitlement is Entitled / Not entitled / Entitled if a milestone brings the award into the money', () => {
  const section = findSectionV3('equity-awards');
  const table = findTableV3(section, 'equity-awards-table');
  const column = table.columns.find((c) => c.column_id === 'cvrEntitlement');
  const labels = column.vocabulary.map((v) => v.label);
  assert.ok(labels.includes('Entitled'));
  assert.ok(labels.includes('Not entitled'));
  assert.ok(labels.some((l) => l.includes('milestone brings the award into the money') && l.includes('exercise price on cash plus CVR')));
});

// Decision 3: one shared bring-down vocabulary used by reps and closing conditions.
test('Decision 3: reps and closing-conditions tables share one bring-down vocabulary by id, each code carrying both print renderings as display variants', () => {
  const bringDown = tableShapesV3.shared_vocabularies.BRING_DOWN_STANDARD;
  assert.deepEqual(bringDown.map((v) => v.code).sort(), [
    'TRUE_EXCEPT_DE_MINIMIS', 'TRUE_EXCEPT_NO_MAE', 'TRUE_IN_ALL_MATERIAL_RESPECTS', 'TRUE_IN_ALL_RESPECTS',
  ].sort());
  for (const entry of bringDown) {
    assert.ok(entry.display_variants && entry.display_variants.length === 2, `${entry.code} should carry both print renderings as display variants`);
  }
  const reps = findTableV3(findSectionV3('representations-qualifiers'), 'representations-qualifiers-table');
  const parentReps = findTableV3(findSectionV3('parent-representations-qualifiers'), 'parent-representations-qualifiers-table');
  const conditionsB = findTableV3(findSectionV3('conditions-b'), 'conditions-b-table');
  const conditionsS = findTableV3(findSectionV3('conditions-s'), 'conditions-s-table');
  assert.equal(reps.columns.find((c) => c.column_id === 'bringdown').vocabulary_ref, 'BRING_DOWN_STANDARD');
  assert.equal(parentReps.columns.find((c) => c.column_id === 'bringdown').vocabulary_ref, 'BRING_DOWN_STANDARD');
  assert.equal(conditionsB.columns.find((c) => c.column_id === 'standard').vocabulary_ref, 'BRING_DOWN_STANDARD');
  assert.equal(conditionsS.columns.find((c) => c.column_id === 'standard').vocabulary_ref, 'BRING_DOWN_STANDARD');
  // The rep's own qualifier standard stays a separate column.
  assert.ok(reps.columns.find((c) => c.column_id === 'materiality'), 'materiality (Qualifiers) stays a separate column');
});

// Decision 4: Lookback renders a PERIOD value computed from a date, date on hover.
test('Decision 4: Lookback renders value/PERIOD with hover: date', () => {
  for (const [sectionKey, tableKey] of [
    ['representations-qualifiers', 'representations-qualifiers-table'],
    ['parent-representations-qualifiers', 'parent-representations-qualifiers-table'],
  ]) {
    const table = findTableV3(findSectionV3(sectionKey), tableKey);
    const lookback = table.columns.find((c) => c.column_id === 'lookback');
    assert.equal(lookback.render, 'value');
    assert.equal(lookback.value_kind, 'PERIOD');
    assert.equal(lookback.hover, 'date');
  }
});

// Decision 5 (no forced shared fixed rows between the parties' carve-out
// tables) is superseded by decision 25 (Ben, 2026-09-13, on the rendered
// Metsera MAE section): both tables are fixed lists of the corpus's generic
// carve-out titles, open to a new title, each with its own facts.
test('Decision 25: MAE definitions say "None" for a party without one; carve-outs use generic titles, Yes / No, and the carve-back as a footer', () => {
  const section = findSectionV3('mae-definitions');
  const definitions = findTableV3(section, 'mae-definitions-table');
  assert.deepEqual(definitions.fixed_row_labels, ['Parent', 'Company']);
  assert.equal(definitions.absent_row_label, 'None');
  for (const tableKey of ['mae-carveouts-parent', 'mae-carveouts-company']) {
    const table = findTableV3(section, tableKey);
    assert.equal(table.rows_are, 'fixed list');
    assert.equal(table.open_rows, true);
    assert.ok(table.fixed_row_labels.includes('Failure to meet internal projections or forecasts'));
    assert.ok(table.fixed_row_labels.includes('Other carve-out'));
    assert.deepEqual(table.columns.map((column) => column.column_id), ['provision', 'disproportionateCarveback']);
    const carveback = table.columns[1];
    assert.deepEqual(carveback.vocabulary.map((entry) => entry.code), ['YES', 'NO']);
    assert.equal(carveback.absent_code, 'NO');
    assert.deepEqual(table.footer_from_subtype, { subtype_key: 'DISPROPORTIONALITY_CARVEBACK', label: 'Disproportionate carve-back as drafted' });
    assert.match(table.guidance, /generic title/);
  }
  assert.ok(section.no_conclusions_subtype_keys.includes('UNDERLYING_CAUSE_RESTORATION'));
});

// Decision 6: material contracts rows with the same header but different thresholds stay separate.
test('Decision 6: Material Contracts keeps distinct threshold buckets that share a header label', () => {
  const table = findTableV3(findSectionV3('material-contracts'), 'material-contracts-table');
  const contractType = table.columns.find((c) => c.column_id === 'contractType');
  const sameLabelEntries = contractType.vocabulary.filter((v) => v.label === 'Contracts above an aggregate-payments threshold');
  assert.equal(sameLabelEntries.length, 2, 'two distinct threshold buckets share this label');
  assert.notEqual(sameLabelEntries[0].code, sameLabelEntries[1].code, 'the two buckets keep distinct codes');
});

// Decision 7: two columns per negative-covenant row, and empty_band_is_error on the Exceptions / Other Restrictions bands.
test('Decision 7: Interim covenants keep Specific Restrictions and Exceptions as two per-row columns, and mark empty_band_is_error on the Exceptions and Other Restrictions bands', () => {
  for (const sectionKey of ['ioc-exceptions', 'parent-ioc-exceptions']) {
    const section = findSectionV3(sectionKey);
    const negative = findTableV3(section, `${sectionKey}-negative-covenants`);
    assert.ok(negative.columns.find((c) => c.column_id === 'specificRestrictions'));
    assert.ok(negative.columns.find((c) => c.column_id === 'exceptions'));
    assert.equal(findTableV3(section, `${sectionKey}-exceptions`).empty_band_is_error, true);
    assert.equal(findTableV3(section, `${sectionKey}-other-restrictions`).empty_band_is_error, true);
  }
});

// Decision 8: four present/absent prohibited-verb columns; one Engagement standard row, full text on click.
test('Decision 8: No-Shop splits the prohibited-verb litany into four boolean columns, and Fiduciary-Out collapses to one Engagement standard row with full_text_on_click', () => {
  const coreTable = findTableV3(findSectionV3('nosol-noshop'), 'nosol-noshop-core-mechanics');
  for (const columnId of ['solicit', 'initiate', 'knowinglyEncourage', 'facilitate']) {
    const column = coreTable.columns.find((c) => c.column_id === columnId);
    assert.ok(column, `column ${columnId} present`);
    assert.equal(column.render, 'boolean');
  }
  assert.equal(coreTable.columns.find((c) => c.column_id === 'prohibitedVerb'), undefined, 'single prohibitedVerb column replaced');

  const fiduciaryTable = findTableV3(findSectionV3('nosol-fiduciary'), 'nosol-fiduciary-table');
  assert.deepEqual(fiduciaryTable.fixed_row_labels, ['Engagement standard', 'Final determination standard']);
  assert.equal(fiduciaryTable.columns.find((c) => c.column_id === 'signals').full_text_on_click, true);
});

// Decision 9: Proxy filing deadline / Mailing / Meeting each get their own trigger vocabulary.
test('Decision 9: Votes gives Proxy filing deadline, Mailing and Meeting each their own per-row trigger vocabulary', () => {
  const table = findTableV3(findSectionV3('votes-approvals-meeting'), 'votes-approvals-meeting-table');
  const column = table.columns.find((c) => c.column_id === 'value');
  assert.equal(column.trigger.per_row, true);
  for (const rowLabel of ['Proxy filing deadline', 'Mailing', 'Meeting']) {
    const rowVocab = column.trigger.by_row_label[rowLabel];
    assert.ok(Array.isArray(rowVocab) && rowVocab.length > 0, `row '${rowLabel}' has its own trigger vocabulary`);
  }
  const proxyLabels = column.trigger.by_row_label['Proxy filing deadline'].map((v) => v.label);
  const mailingLabels = column.trigger.by_row_label.Mailing.map((v) => v.label);
  assert.notDeepEqual(proxyLabels, mailingLabels, 'each row keeps its own trigger set, not one shared set');
});

// Decision 10: the "x of y standard conditions" checklist is removed.
test('Decision 10: the standard-conditions checklist table (conditions-m) is removed', () => {
  assert.equal(tableShapesV3.sections.find((s) => s.section_key === 'conditions-m'), undefined);
});

// Decision 11: termination-for-breach columns.
test('Decision 11: Termination for breach carries Curable-or-not, Cure period, Cure period end and Terminator-breach bar vocabularies, filled from CONDITION/PERIOD/EXCEPTION/CROSS_REFERENCE', () => {
  const section = findSectionV3('termination-rights');
  const buyerTable = findTableV3(section, 'termination-rights-buyer-may-terminate');
  const curable = buyerTable.columns.find((c) => c.column_id === 'curableOrNot');
  assert.equal(curable.render, 'vocabulary');
  assert.deepEqual(curable.vocabulary.map((v) => v.label).sort(), ['Curable', 'Curable in part', 'Not curable'].sort());
  assert.deepEqual(curable.fill_from, ['CONDITION']);

  const curePeriod = buyerTable.columns.find((c) => c.column_id === 'curePeriodValue');
  assert.equal(curePeriod.render, 'value');
  assert.equal(curePeriod.value_kind, 'PERIOD');
  assert.deepEqual(curePeriod.fill_from, ['PERIOD']);

  const curePeriodEnd = buyerTable.columns.find((c) => c.column_id === 'curePeriodEnd');
  assert.equal(curePeriodEnd.render, 'vocabulary');
  assert.deepEqual(curePeriodEnd.vocabulary.map((v) => v.label).sort(), [
    'Earlier of notice period and outside date', 'Fixed date', 'Outside date',
  ].sort());
  assert.deepEqual(curePeriodEnd.fill_from, ['EXCEPTION']);

  const companyTable = findTableV3(section, 'termination-rights-company-may-terminate');
  const terminatorBreachBar = companyTable.columns.find((c) => c.column_id === 'terminatorBreachBar');
  assert.equal(terminatorBreachBar.render, 'vocabulary');
  assert.deepEqual(terminatorBreachBar.vocabulary.map((v) => v.label).sort(), ['No', 'Yes'].sort());
  assert.deepEqual(terminatorBreachBar.fill_from, ['CROSS_REFERENCE']);

  const usedKinds = new Set([...curable.fill_from, ...curePeriod.fill_from, ...curePeriodEnd.fill_from, ...terminatorBreachBar.fill_from]);
  assert.deepEqual([...usedKinds].sort(), ['CONDITION', 'CROSS_REFERENCE', 'EXCEPTION', 'PERIOD'].sort());
});

// Decision 12: Payer column (Company; Parent) on termination fees.
test('Decision 12: Termination Fees carries a Payer column with Company and Parent', () => {
  const table = findTableV3(findSectionV3('termination-fees'), 'termination-fees-table');
  const payer = table.columns.find((c) => c.column_id === 'payer');
  assert.deepEqual(payer.vocabulary.map((v) => v.label).sort(), ['Company', 'Parent'].sort());
});

// Decision 13: employee benefits canonical rows shown only when found; split_combined_elements.
test('Decision 13: Employee benefits carries all ten canonical benefit rows, shown only when populated, with split_combined_elements set', () => {
  const table = findTableV3(findSectionV3('employee-benefits'), 'employee-benefits-table');
  assert.equal(table.fixed_row_labels.length, 10);
  for (const label of [
    'Earned annual bonus (pro-rata)', 'Health and welfare benefits', 'Paid time off / vacation', 'Equity / stock awards (new grants)',
  ]) {
    assert.ok(table.fixed_row_labels.includes(label), `canonical row '${label}' present`);
  }
  assert.equal(table.show_only_when_populated, true);
  assert.equal(table.split_combined_elements, true);
  assert.equal(table.additional_fixed_row_labels, undefined);
});

// Decision 14: No Other Reps Status is Yes / No / Silent.
test('Decision 14: No Other Reps Status vocabulary is exactly Yes / No / Silent', () => {
  const table = findTableV3(findSectionV3('no-other-reps-fraud'), 'no-other-reps-fraud-table');
  const status = table.columns.find((c) => c.column_id === 'status');
  assert.deepEqual(status.vocabulary.map((v) => v.label).sort(), ['No', 'Silent', 'Yes'].sort());
});

// Decision 15: Defined Terms is a reference appendix, excluded from fact tables.
test('Decision 15: Defined Terms is marked kind: reference_appendix, excluded from fact tables, with a note on the later cross-deal feature', () => {
  const section = findSectionV3('defined-terms');
  assert.equal(section.kind, 'reference_appendix');
  assert.equal(section.excluded_from_fact_tables, true);
  assert.ok(/later feature/i.test(section.note));
});

// Decision 16 kept four sections; decision 23 (Ben, 2026-09-13, on Metsera)
// later removed Approvals / Votes (it mapped to TERMINATION, a harvest
// artefact) and the SEC-meeting section (no printed shape), folding the
// proxy and SEC facts into the votes section as a two-column table.
test('Decision 16 / 23: Antitrust / Regulatory and Advisers / Fees / Expenses stay; Approvals / Votes and SEC meeting are folded into the votes section', () => {
  for (const sectionKey of ['antitrust-regulatory', 'advisers-fees-expenses', 'votes-approvals-meeting']) {
    assert.ok(findSectionV3(sectionKey), `section '${sectionKey}' is kept`);
  }
  for (const sectionKey of ['approvals-votes', 'sec-meeting']) {
    assert.equal(tableShapesV3.sections.some((s) => s.section_key === sectionKey), false, `section '${sectionKey}' is removed`);
  }
  const votes = findSectionV3('votes-approvals-meeting');
  assert.ok(votes.tables.some((t) => t.table_key === 'votes-proxy-sec'));
  const votesTable = votes.tables.find((t) => t.table_key === 'votes-approvals-meeting-table');
  assert.deepEqual(votesTable.columns.map((c) => c.column_id), ['voteStandard', 'value', 'anchor', 'detail', 'requirement']);
});

test('every V3 vocabulary code (including shared vocabularies) is unique within the enclosing list', () => {
  for (const [id, vocabulary] of Object.entries(tableShapesV3.shared_vocabularies)) {
    const codes = vocabulary.map((v) => v.code);
    assert.equal(new Set(codes).size, codes.length, `shared vocabulary '${id}' has duplicate codes`);
  }
});

// Decision 26 (Ben, 2026-09-13): a detail column shows the drafting; a
// Yes / No question table has no detail column at all.
test('Decision 26: the conditions detail column is the fact as drafted and No Other Reps / Fraud is status only', () => {
  const detail = findTableV3(findSectionV3('conditions'), 'conditions-table').columns.find((column) => column.column_id === 'detail');
  assert.equal(detail.display, 'fact_text');
  const table = findTableV3(findSectionV3('no-other-reps-fraud'), 'no-other-reps-fraud-table');
  assert.deepEqual(table.columns.map((column) => column.column_id), ['status']);
});

// Decision 27 (Ben, 2026-09-13): sections and the rail follow the old app's
// order (SIDEBAR_GROUPS in components/review/shared.js).
test('Decision 27: sections run in the old app\'s order and each carries its rail group', () => {
  const keys = tableShapesV3.sections.map((section) => section.section_key);
  assert.equal(keys[0], 'structure-mechanics');
  assert.equal(keys[1], 'consideration-hero');
  assert.ok(keys.indexOf('representations-qualifiers') < keys.indexOf('material-contracts'));
  assert.ok(keys.indexOf('mae-definitions') < keys.indexOf('ioc-exceptions'));
  assert.ok(keys.indexOf('conditions') < keys.indexOf('termination-rights'));
  assert.ok(keys.indexOf('employee-benefits') < keys.indexOf('general-covenants'));
  assert.equal(keys[keys.length - 1], 'defined-terms');
  for (const section of tableShapesV3.sections) {
    assert.ok(section.rail && section.rail.group && section.rail.label && /^#[0-9A-F]{6}$/i.test(section.rail.hex), section.section_key);
  }
  assert.equal(findSectionV3('conditions-b').rail.group, 'Conditions to Closing');
});

// Decision 29 (Ben, 2026-09-13): the merger form is read from several
// components together and cites them all.
test('Decision 29: merger form columns name their basis kinds', () => {
  const table = findTableV3(findSectionV3('structure-mechanics'), 'structure-mechanics-table');
  for (const columnId of ['mergerFormStep1', 'mergerFormStep2']) {
    assert.deepEqual(table.columns.find((c) => c.column_id === columnId).basis_kinds, ['ACTOR', 'OPERATION', 'OBJECT', 'TERM']);
  }
});

// Decision 30 (Ben, 2026-09-13): equity award rows are instrument classes,
// the treatment classes sub-items from a fixed list.
test('Decision 30: equity awards rows are instrument classes with treatment classes as detail labels', () => {
  const table = findTableV3(findSectionV3('equity-awards'), 'equity-awards-table');
  assert.equal(table.rows_are, 'fixed list');
  assert.equal(table.open_rows, true);
  assert.ok(table.fixed_row_labels.includes('Company Stock Option'));
  assert.deepEqual(table.detail_labels, ['Vested', 'Unvested, vesting by its terms at the Effective Time', 'Unvested, not vesting by its terms', 'Out of the money (exercise price at or above the deal price)']);
});

// Decision 31 (Ben, 2026-09-13): representation limbs are named from a
// canonical list per representation so they compare across deals.
test('Decision 31: representation tables carry canonical limb names per row', () => {
  for (const [sectionKey, tableKey] of [['representations-qualifiers', 'representations-qualifiers-table'], ['parent-representations-qualifiers', 'parent-representations-qualifiers-table']]) {
    const table = findTableV3(findSectionV3(sectionKey), tableKey);
    const limbs = table.detail_labels_by_row['Organization; Qualification; Standing'];
    assert.ok(limbs.includes('Corporate power and authority to own, lease and operate its properties and assets and to conduct its business'));
    assert.ok(table.detail_labels_by_row['Authority; Enforceability'].includes('Corporate power and authority to execute, deliver and perform the Agreement'));
    assert.match(table.guidance, /canonical limb name/);
  }
});
