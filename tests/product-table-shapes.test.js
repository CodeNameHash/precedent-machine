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
    assert.deepEqual(table.footer_from_subtype, { subtype_keys: ['DISPROPORTIONALITY_CARVEBACK', 'UNDERLYING_CAUSE_RESTORATION'], label: 'Carve-back provisos as drafted' });
    assert.match(table.guidance, /generic title/);
    // A footer fact needs no readout (finding (39)); the guidance agrees with
    // the section's no_conclusions_subtype_keys instead of asking for a row_label.
    assert.match(table.guidance, /the UNDERLYING_CAUSE_RESTORATION fact \([^)]*\) carries no conclusions, as no_conclusions_subtype_keys says; the page shows both under the table, never as rows\./);
    assert.doesNotMatch(table.guidance, /Underlying cause proviso/);
  }
  assert.ok(section.no_conclusions_subtype_keys.includes('UNDERLYING_CAUSE_RESTORATION'));
});

// Decision 6 (distinct threshold buckets stay distinct) now lives in the
// facts: the two clauses are two facts on the one canonical row, each with
// its own threshold. Decision 32 (Ben, 2026-09-13: "why are there two
// contract type columns and what is not covered doing? also are there
// materiality qualifiers ...") makes rows the canonical categories.
test('Decision 32: Material Contracts rows are the canonical categories, absent ones read Not covered, with As drafted, Threshold and Qualifier columns', () => {
  const table = findTableV3(findSectionV3('material-contracts'), 'material-contracts-table');
  assert.equal(table.rows_are, 'fixed list');
  assert.equal(table.open_rows, true);
  // Ben, 2026-09-14: "don't show any 'not covered' material contract categories".
  assert.equal(table.absent_row_label, undefined);
  assert.equal(table.fixed_row_labels.filter((label) => label === 'Contracts above an aggregate-payments threshold').length, 1);
  assert.ok(table.fixed_row_labels.includes('Manufacturing agreements'));
  assert.deepEqual(table.columns.map((column) => column.column_id), ['provision', 'threshold', 'qualifier']);
  assert.ok(table.columns[2].vocabulary.some((entry) => entry.code === 'MAE_STANDARD' && entry.links_to_section === 'mae-definitions'));
});

// Decision 7: two columns per negative-covenant row, and empty_band_is_error on the Exceptions / Other Restrictions bands.
test('Decision 34 (was 7): Interim covenants are one row per restriction category, as drafted, with threshold, exceptions and consent; the general terms are a Term / Provision table', () => {
  for (const sectionKey of ['ioc-exceptions', 'parent-ioc-exceptions']) {
    const section = findSectionV3(sectionKey);
    const negative = findTableV3(section, `${sectionKey}-negative-covenants`);
    assert.equal(negative.rows_are, 'fixed list');
    assert.ok(negative.fixed_row_labels.includes('Indebtedness') && negative.fixed_row_labels.includes('Capital Expenditures'));
    assert.equal(negative.open_rows, true);
    // Ben, 2026-09-14: no consent cell per restriction; the list folds; the introductions open the section.
    assert.deepEqual(negative.columns.map((c) => c.column_id), ['asDrafted', 'threshold', 'exceptions']);
    assert.equal(negative.collapsible_rows, true);
    assert.equal(section.tables[0].table_key, `${sectionKey}-general-terms`);
    assert.equal(negative.columns[0].display, 'fact_text');
    const general = findTableV3(section, `${sectionKey}-general-terms`);
    assert.deepEqual(general.fixed_row_labels, ['Consent standard', 'General exceptions', 'Ordinary course standard', 'Specific restrictions govern']);
    assert.equal(section.tables.some((t) => t.table_key === `${sectionKey}-exceptions` || t.table_key === `${sectionKey}-other-restrictions`), false);
  }
});

// Decision 34 (was 8): every no-shop row answers its own question with a code from its row's list.
test('Decision 34 (was 8): the no-shop core mechanics list the prohibited acts as codes of one row, and the fiduciary-out rows carry the engagement and board standards', () => {
  const coreTable = findTableV3(findSectionV3('nosol-noshop'), 'nosol-noshop-core-mechanics');
  const provision = coreTable.columns.find((c) => c.column_id === 'provision');
  assert.equal(provision.render, 'vocabulary');
  for (const codeValue of ['SOLICIT', 'INITIATE', 'KNOWINGLY_ENCOURAGE', 'KNOWINGLY_FACILITATE', 'FURNISH_INFORMATION']) {
    assert.ok(provision.vocabulary_by_row['No-shop restriction (prohibited acts)'].includes(codeValue), codeValue);
  }
  assert.ok(provision.vocabulary_by_row['Representative control standard'].includes('SHALL_CAUSE_REPRESENTATIVES'));
  assert.ok(coreTable.columns.some((c) => c.column_id === 'asDrafted' && c.display === 'fact_text'));
  assert.equal(coreTable.columns.some((c) => c.render === 'boolean'), false);

  const fiduciaryTable = findTableV3(findSectionV3('nosol-fiduciary'), 'nosol-fiduciary-table');
  assert.deepEqual(fiduciaryTable.fixed_row_labels.slice(0, 2), ['Engagement standard', 'Board determination standard']);
  assert.ok(fiduciaryTable.columns.find((c) => c.column_id === 'provision').vocabulary_by_row['Engagement standard'].includes('IS_A_SUPERIOR_PROPOSAL'));
  assert.equal(tableShapesV3.sections.some((s) => s.section_key === 'nosol'), false, 'the overview section is removed');
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
test('Decision 16 / 23 / 34: Antitrust / Regulatory stays; Approvals / Votes and SEC meeting are folded into the votes section', () => {
  for (const sectionKey of ['antitrust-regulatory', 'votes-approvals-meeting']) {
    assert.ok(findSectionV3(sectionKey), `section '${sectionKey}' is kept`);
  }
  // Decision 34 removed Advisers / Fees / Expenses (a harvest artefact with no print).
  for (const sectionKey of ['approvals-votes', 'sec-meeting', 'advisers-fees-expenses']) {
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

// Decision 33 (Ben, 2026-09-13): appraisal from the appraisal provision only;
// per-share rows by form; exchange mechanics never a component row.
test('Decision 33: consideration shapes name their sources', () => {
  const section = findSectionV3('consideration-hero');
  const structure = findTableV3(section, 'consideration-structure');
  const appraisal = structure.columns.find((c) => c.column_id === 'appraisalRights');
  // Ben, 2026-09-14: "this should just say 'present'".
  assert.equal(appraisal.render, 'boolean');
  assert.equal(appraisal.display, undefined);
  // Decision 34: derived by the page from the appraisal provision's own family.
  assert.equal(appraisal.from_subtype_keys, undefined);
  assert.equal(appraisal.derived.join, 'presence');
  assert.deepEqual([appraisal.derived.from_family, appraisal.derived.from_subtype], ['CONSIDERATION', 'APPRAISAL_LINK']);
  assert.deepEqual(appraisal.derived.alternatives.map((alt) => alt.from_subtype), ['APPRAISAL_STATUS', 'APPRAISAL_ENTITLEMENT']);
  const components = findTableV3(section, 'consideration-components');
  assert.equal(components.row_from_column, 'form');
  assert.deepEqual(components.only_subtype_keys, ['CASH_COMPONENT', 'STOCK_COMPONENT', 'CVR_COMPONENT', 'CONSIDERATION_PACKAGE']);
  assert.ok(components.fixed_row_labels.includes('CVR'));
});

// Decision 34: every table is the precedent's row list; every column coded, a number, yes / no or as drafted.
test('Decision 34: no fact table carries a free-text column that is not the fact as drafted or a resolved reference', () => {
  for (const section of tableShapesV3.sections) {
    if (section.excluded_from_fact_tables) continue;
    for (const table of section.tables) {
      for (const column of table.columns) {
        // Work package 18 (g) (Ben, 2026-10-18: "Ok on ETA on covenants"): a
        // By when column filled from the covenant's own TRIGGER and PERIOD
        // components is the one verbatim column that is neither.
        if (column.render === 'verbatim') assert.ok(['fact_text', 'resolved_reference'].includes(column.display) || (column.fill_from_components === true && column.column_id === 'byWhen'), `${table.table_key}.${column.column_id} is a verbatim column without as-drafted display`);
      }
    }
  }
});

test('Decision 34: Antitrust / Regulatory is the Envestnet row list, each row named from the subtype with its own Provision codes', () => {
  const table = findTableV3(findSectionV3('antitrust-regulatory'), 'antitrust-regulatory-table');
  assert.equal(table.rows_are, 'fixed list');
  assert.deepEqual(table.fixed_row_labels.slice(0, 7), ['Efforts standard', 'Filing deadline', 'Other regulatory filings', 'Remedy commitment (divestiture cap)', 'Regulatory litigation', 'Strategy control', 'Consultation and participation']);
  assert.equal(table.subtype_rows.EFFORTS, 'Efforts standard');
  const provision = table.columns.find((c) => c.column_id === 'provision');
  assert.deepEqual(provision.vocabulary_by_row['Efforts standard'], ['REASONABLE_BEST_EFFORTS', 'BEST_EFFORTS', 'COMMERCIALLY_REASONABLE_EFFORTS', 'HELL_OR_HIGH_WATER']);
  assert.deepEqual(provision.vocabulary_by_row['Strategy control'], ['PARENT_CONTROLS', 'COMPANY_CONTROLS', 'JOINT_CONTROL']);
  assert.deepEqual(table.columns.map((c) => c.column_id), ['provision', 'period', 'asDrafted']);
});

test('Decision 34: the intervening-event and superior-proposal tables derive their termination rows from the TERMINATION family', () => {
  const intervening = findTableV3(findSectionV3('nosol-intervening'), 'nosol-intervening-table');
  assert.ok(intervening.fixed_row_labels.includes('Matching period') && intervening.fixed_row_labels.includes('Notice period'));
  assert.deepEqual(intervening.columns.find((c) => c.column_id === 'provision').derived, { from_family: 'TERMINATION', from_subtype: 'RECOMMENDATION_CHANGE', join: 'presence', rows: ['Parent termination right on a change'] });
  const superior = findTableV3(findSectionV3('nosol-superior'), 'nosol-superior-table');
  assert.deepEqual(superior.columns.find((c) => c.column_id === 'provision').derived.rows, ['Company termination for Superior Proposal']);
  assert.ok(findSectionV3('nosol-superior').v2_family_keys.some((f) => f.key === 'KEY_DEFINED_TERMS'));
});

test('Decision 34: termination rights name their rows from the subtype, the effect of termination is its own table, and D&O indemnification is a section', () => {
  const section = findSectionV3('termination-rights');
  assert.equal(findTableV3(section, 'termination-rights-buyer-may-terminate').subtype_rows.BREACH, 'Company (Target) breach');
  assert.equal(findTableV3(section, 'termination-rights-company-may-terminate').subtype_rows.BREACH, 'Parent (Buyer) breach');
  assert.equal(findTableV3(section, 'termination-rights-effect').subtype_rows.TERMINATION_NOTICE, 'Termination formalities');
  assert.equal(section.tables.some((t) => t.table_key === 'termination-rights-remedies'), false);
  const dno = findSectionV3('dno-indemnification');
  assert.equal(dno.rail.group, 'Other Covenants');
  assert.equal(findTableV3(dno, 'dno-indemnification-table').subtype_rows.DNO_INSURANCE_TAIL, 'D&O insurance tail');
  const misc = findTableV3(findSectionV3('misc-boilerplate'), 'misc-boilerplate-table');
  assert.ok(misc.fixed_row_labels.includes('Specific performance') && misc.fixed_row_labels.includes('Notices'));
  assert.ok(findSectionV3('misc-boilerplate').v2_family_keys.some((f) => f.key === 'SPECIFIC_PERFORMANCE_REMEDIES'));
  const reps = findTableV3(findSectionV3('representations-qualifiers'), 'representations-qualifiers-table');
  assert.ok(reps.fixed_row_labels.includes('No Undisclosed Liabilities'));
  assert.ok(reps.detail_labels_by_row['Capitalization; Subsidiaries'].includes('Authorized capital stock'));
});

// Ben, 2026-09-14: "do you have an agent looking at all of our tweaks and
// seeing if they should be made systematically/throughout the code base
// back to extraction? I don't want to make surface level/one deal level
// fixes". The shape carries the rules the page used to apply on its own.
test('the accelerated vesting code lists the words that contradict it, and the validator checks the list\'s shape', () => {
  const table = findTableV3(findSectionV3('equity-awards'), 'equity-awards-table');
  const vesting = table.columns.find((column) => column.column_id === 'vestingTreatment');
  const accelerated = vesting.vocabulary.find((entry) => entry.code === 'FULLY_VESTED_ACCELERATED');
  assert.deepEqual(accelerated.contradicted_by, ['continued service', 'continued employment', 'continuous service', 'continuous employment']);
  assert.ok(vesting.vocabulary.some((entry) => entry.code === 'FULLY_VESTED_CONDITIONAL_UPON_SERVICE'));
  const broken = structuredClone(tableShapesV3);
  const brokenEntry = broken.sections.find((s) => s.section_key === 'equity-awards').tables[0].columns.find((column) => column.column_id === 'vestingTreatment').vocabulary.find((entry) => entry.code === 'FULLY_VESTED_ACCELERATED');
  brokenEntry.contradicted_by = [''];
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_VOCAB_CONTRADICTED_BY/);
});

test('the surviving-entity party columns carry extractor guidance to cite the entity\'s own words with the term', () => {
  const table = findTableV3(findSectionV3('structure-mechanics'), 'structure-mechanics-table');
  for (const columnId of ['survivingEntityStep1', 'survivingEntityStep2']) {
    const column = table.columns.find((candidate) => candidate.column_id === columnId);
    assert.equal(column.display, 'party');
    assert.match(column.guidance, /never the defined term alone/);
  }
});

// Ben, 2026-09-14, on the Article III introduction: "all of this is
// miscoded. THis is the standard intro to the reps that provides the
// exceptions for all reps - look at the old system - we should be able to
// show the reader the general categories of the exceptions (SEC filings)
// and as they click into deeper levels show more detail (last X days) etc";
// and today: "by miscoded I meant oyu currentl have it messed up and you
// need to move it over to what we had in the old vesrion....".
test('the representations tables open with the old version\'s General Exceptions and Knowledge rows, the separate general-qualifications table is retired', () => {
  for (const [sectionKey, tableKey] of [['representations-qualifiers', 'representations-qualifiers-table'], ['parent-representations-qualifiers', 'parent-representations-qualifiers-table']]) {
    const section = findSectionV3(sectionKey);
    assert.equal(section.tables.length, 1, 'one table per party');
    assert.equal(section.tables.some((table) => /general-qualifications$/.test(table.table_key)), false);
    const table = findTableV3(section, tableKey);
    assert.deepEqual(table.fixed_row_labels.slice(0, 3), ['General Exceptions', 'Knowledge', 'Organization; Qualification; Standing']);
    assert.deepEqual(table.detail_labels_by_row['General Exceptions'], ['SEC Filings', 'Disclosure Letter', 'Other']);
    assert.deepEqual(table.detail_labels_by_row['Knowledge'], ['Standard', 'Persons']);
    assert.equal(table.intro_facts_row, 'General Exceptions');
    assert.equal(table.knowledge_facts_row, 'Knowledge');
    assert.deepEqual(table.columns.map((column) => column.column_id), ['bringdown', 'materiality', 'lookback'], 'no new column: the cut-off is the Lookback, the excluded portions are Qualifiers codes');
    const qualifiers = table.columns.find((column) => column.column_id === 'materiality');
    for (const code of ['EXCLUDES_FORWARD_LOOKING_STATEMENTS', 'EXCLUDES_RISK_FACTORS', 'EXCLUDES_EXHIBITS', 'ARRANGED_BY_SECTION', 'CROSS_SECTION_WHERE_REASONABLY_APPARENT']) {
      assert.ok(qualifiers.vocabulary_by_row['General Exceptions'].includes(code), code);
    }
    for (const code of ['KNOWLEDGE_AFTER_REASONABLE_INQUIRY', 'ACTUAL_KNOWLEDGE', 'PERSONS_LISTED_ON_DISCLOSURE_LETTER']) {
      assert.ok(qualifiers.vocabulary_by_row.Knowledge.includes(code), code);
    }
    assert.equal(qualifiers.vocabulary_by_row['Organization; Qualification; Standing'], undefined, 'representation rows keep the open qualifier vocabulary');
    assert.ok(qualifiers.vocabulary.some((entry) => entry.code === 'MAE_AGGREGATE'), 'the print vocabulary stays');
    assert.ok(table.only_subtype_keys.includes('REPRESENTATION_QUALIFICATION'));
    assert.ok(table.only_subtype_keys.includes('KNOWLEDGE'));
    assert.ok(table.only_subtype_keys.includes('AUTHORISED_CAPITAL'), 'the reps row keeps its capitalisation sub-items');
    assert.ok(section.v2_family_keys.some((entry) => entry.key === 'KEY_DEFINED_TERMS'));
    assert.match(table.guidance, /row_label "General Exceptions" and row_detail the source of exception/);
    assert.match(table.guidance, /row_label "Knowledge", row_detail "Standard"/);
  }
  const broken = structuredClone(tableShapesV3);
  broken.sections.find((s) => s.section_key === 'representations-qualifiers').tables[0].intro_facts_row = 'No such row';
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_PAGE_RULE_ROW_UNKNOWN/);
});

// Ben, 2026-09-14: "sure add a table".
test('the capitalization table counts each security class, the numbers parsed from cited words, the absence facts as its footer', () => {
  const section = findSectionV3('capitalization');
  assert.deepEqual(section.v2_family_keys.map((entry) => entry.key), ['CAPITALISATION']);
  assert.deepEqual(section.rail, { group: 'Representations', label: 'Capitalization', hex: '#3F8A6A' });
  const keys = tableShapesV3.sections.map((s) => s.section_key);
  assert.equal(keys.indexOf('capitalization'), keys.indexOf('parent-representations-qualifiers') + 1);
  const table = findTableV3(section, 'capitalization-table');
  assert.equal(table.rows_are, 'fixed list');
  assert.equal(table.open_rows, true);
  assert.equal(table.row_from_security_class, true);
  assert.deepEqual(table.fixed_row_labels, ['Common Stock', 'Preferred Stock', 'Company Stock Options', 'Company RSUs', 'Company PSUs', 'Company Restricted Stock Awards', 'ESPP', 'Warrants', 'Merger Sub capital stock', 'Subsidiary equity']);
  const byId = Object.fromEntries(table.columns.map((column) => [column.column_id, column]));
  for (const [columnId, subtypes] of [['authorised', ['AUTHORISED_CAPITAL']], ['issued', ['ISSUED_AND_OUTSTANDING', 'EQUITY_AWARD_INVENTORY']], ['reserved', ['RESERVED_OR_ISSUABLE_SECURITIES']]]) {
    assert.equal(byId[columnId].render, 'value');
    assert.equal(byId[columnId].value_kind, 'COUNT');
    assert.deepEqual(byId[columnId].from_subtype_keys, subtypes);
    assert.ok(byId[columnId].fill_from.includes('AMOUNT'));
  }
  assert.equal(byId.asOf.value_kind, 'DATE');
  assert.equal(byId.validIssuance.render, 'boolean');
  assert.deepEqual(byId.validIssuance.from_subtype_keys, ['VALID_ISSUANCE_STATUS']);
  assert.equal(byId.asDrafted.display, 'fact_text');
  assert.deepEqual(table.footer_from_subtype, { subtype_key: 'CAPITALISATION_ABSENCE', label: 'No other securities', style: 'other_provisions' });
  assert.deepEqual(table.only_subtype_keys, ['AUTHORISED_CAPITAL', 'ISSUED_AND_OUTSTANDING', 'RESERVED_OR_ISSUABLE_SECURITIES', 'EQUITY_AWARD_INVENTORY', 'VALID_ISSUANCE_STATUS', 'CAPITALISATION_ABSENCE', 'PARTNERSHIP_OR_SUBSIDIARY_EQUITY']);
  assert.match(table.guidance, /one fact per class and count/);
  const broken = structuredClone(tableShapesV3);
  broken.sections.find((s) => s.section_key === 'capitalization').tables[0].row_from_security_class = 'yes';
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ROW_FROM_SECURITY_CLASS/);
});

// Ben, 2026-10-17 (plan finding (42)): "odd under ongoing updates to have
// required within a stated period and required promptly. Also weird to have
// the 48 hours there" and "need ot include the detail of what info of what
// must be shared in the no shop (i.e. just contracts, etc) and when and
// orally etc. A lot more detail required"; finding (44), "yes to both".
test('the no-shop notice table is 5.02(d)\'s own mechanics as fixed rows, one timing code per row, with the two rows Ben placed', () => {
  const section = findSectionV3('nosol-noshop');
  const notice = findTableV3(section, 'nosol-noshop-notice');
  assert.deepEqual(notice.fixed_row_labels, ['Initial notice', 'Notice contents', 'Ongoing updates', 'Notice of a decision to engage', 'Oral proposals', 'No agreement restricting information to Parent']);
  const provision = notice.columns.find((column) => column.column_id === 'provision');
  assert.deepEqual(provision.vocabulary_by_row['Initial notice'], ['REQUIRED_PROMPTLY', 'REQUIRED_WITHIN_STATED_PERIOD', 'NOT_REQUIRED', 'ON_KNOWLEDGE_OF_OFFICER_OR_DIRECTOR', 'ON_RECEIPT']);
  assert.deepEqual(provision.vocabulary_by_row['Notice contents'], ['IDENTITY_OF_PERSON', 'COPY_OF_WRITTEN_PROPOSAL', 'MATERIAL_TERMS_WHEN_ORAL', 'MODIFICATIONS', 'DRAFT_DOCUMENTATION', 'STATUS_AND_DEVELOPMENTS']);
  assert.deepEqual(provision.vocabulary_by_row['Ongoing updates'], ['REQUIRED_PROMPTLY', 'REQUIRED_WITHIN_STATED_PERIOD', 'NOT_REQUIRED', 'DRAFT_DOCUMENTATION', 'STATUS_AND_DEVELOPMENTS']);
  assert.deepEqual(provision.vocabulary_by_row['Notice of a decision to engage'], ['REQUIRED_PROMPTLY', 'REQUIRED_WITHIN_STATED_PERIOD', 'NOT_REQUIRED']);
  assert.deepEqual(provision.vocabulary_by_row['Oral proposals'], ['MAY_REQUEST_WRITTEN_PROPOSAL', 'SILENT']);
  assert.deepEqual(provision.vocabulary_by_row['No agreement restricting information to Parent'], ['YES', 'NO']);
  assert.deepEqual(notice.fact_type_rows, { PROHIBITED_ACTION: 'No agreement restricting information to Parent' });
  assert.ok(new RegExp(notice.fact_type_rows_when, 'i').test('The Company will not enter into any agreement with any Person that would restrict its ability to provide such information to Parent'));
  assert.equal(new RegExp(notice.fact_type_rows_when, 'i').test('The Company shall not solicit any Takeover Proposal'), false);
  assert.deepEqual(notice.columns.map((column) => column.column_id), ['provision', 'period', 'asDrafted']);
  assert.deepEqual(notice.subtype_keys, ['NOTICE_PERIOD', 'NOTICE_UPDATE_OBLIGATION', 'PROHIBITED_ACTION']);
  assert.match(notice.guidance, /each row's timing one code \(never "Required within a stated period" beside "Required promptly"/);
  assert.match(notice.guidance, /48 hours in the period column and promptly in the summary/);
  assert.match(notice.guidance, /No agreement restricting information to Parent: YES for the PROHIBITED_ACTION fact[\s\S]*?\(Ben, 2026-10-17: "yes to both"\)/);
  const core = findTableV3(section, 'nosol-noshop-core-mechanics');
  assert.deepEqual(core.detail_labels_by_row, { 'Representative control standard': ['Representative breach is Company breach'] });
  assert.match(core.guidance, /row_detail "Representative breach is Company breach" and the code YES \(Ben, 2026-10-17: "yes to both"\)/);
  assert.deepEqual(core.columns[0].vocabulary_by_row['Representative control standard'].slice(-2), ['YES', 'NO']);
  assert.equal(core.fact_type_rows.PROHIBITED_ACTION, 'Representative control standard');
  assert.ok(new RegExp(core.fact_type_rows_when.PROHIBITED_ACTION, 'i').test('Any violation of the restrictions set forth in this Section 5.02(a) by any Representative of the Company acting in its authorized capacity shall be a breach of this Section 5.02(a) by the Company'));
  assert.equal(new RegExp(core.fact_type_rows_when.PROHIBITED_ACTION, 'i').test('The Company shall cause its Representatives not to solicit any Takeover Proposal'), false);
});

// Ben, 2026-10-17 (plan finding (42)): "you're missing the fiduciary
// standard required (which we do have in the change of rec for superior
// proposal section)". The intervening-event table's row carries the
// fiduciary table's name and vocabulary; a readout-less fact of the path
// whose words name the Intervening Event and the fiduciary duties defaults
// to it (fact_type_rows gated by fact_type_rows_when).
test('the intervening-event table has a Board determination standard row with the fiduciary vocabulary and a gated default', () => {
  const table = findTableV3(findSectionV3('nosol-intervening'), 'nosol-intervening-table');
  assert.ok(table.fixed_row_labels.includes('Board determination standard'));
  assert.equal(table.fixed_row_labels.includes('Board-change standard'), false);
  const provision = table.columns.find((column) => column.column_id === 'provision');
  assert.deepEqual(provision.vocabulary_by_row['Board determination standard'], findTableV3(findSectionV3('nosol-fiduciary'), 'nosol-fiduciary-table').columns[0].vocabulary_by_row['Board determination standard']);
  assert.deepEqual(table.fact_type_rows, { EXCEPTION_PREREQUISITE: 'Board determination standard', RECOMMENDATION_CHANGE: 'Board determination standard' });
  assert.ok(new RegExp(table.fact_type_rows_when, 'i').test('The Board may change its recommendation for an Intervening Event when failure to do so would be inconsistent with its fiduciary duties'));
  assert.equal(new RegExp(table.fact_type_rows_when, 'i').test('The Board may change its recommendation for a Superior Proposal when failure to do so would be inconsistent with its fiduciary duties'), false);
  assert.match(table.guidance, /Board determination standard: the fiduciary standard the board must meet/);
  const broken = structuredClone(tableShapesV3);
  const brokenTable = broken.sections.find((s) => s.section_key === 'nosol-intervening').tables[0];
  brokenTable.fact_type_rows_when = '(';
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_FACT_TYPE_ROWS_WHEN/);
  delete brokenTable.fact_type_rows;
  brokenTable.fact_type_rows_when = 'Intervening Event';
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_FACT_TYPE_ROWS_WHEN/);
});

// Work package 5 (plan finding (52)): three families had no table, so
// generation 8's 2.02 transfer-tax allocation fact was on no page at all.
// A Tax Matters section and a Financing section, rows from the subtype,
// page defaults for the stored facts (fact_type_rows for the required
// fact types; default_rows_from_subtype for the rest).
test('Tax Matters and Financing sections carry one row per subtype, defaults for the stored facts and their own rail groups', () => {
  const tax = findSectionV3('tax-matters');
  assert.deepEqual(tax.v2_family_keys.map((entry) => entry.key), ['TAX_MATTERS']);
  assert.equal(tax.rail.group, 'Tax Matters');
  const taxTable = findTableV3(tax, 'tax-matters-table');
  assert.deepEqual(taxTable.fixed_row_labels, ['Intended tax treatment', 'Tax treatment protection', 'Tax reporting consistency', 'Tax opinion cooperation', 'Transfer tax allocation', 'Withholding', 'FIRPTA certificate', 'Special tax mechanic']);
  assert.deepEqual(Object.keys(taxTable.subtype_rows).sort(), legalSchemaV2.families.find((family) => family.family_key === 'TAX_MATTERS').subtypes.map((subtype) => subtype.subtype_key).sort());
  assert.equal(taxTable.row_from_subtype, true);
  assert.equal(taxTable.default_rows_from_subtype, true);
  assert.deepEqual(taxTable.fact_type_rows, {
    INTENDED_TAX_TREATMENT_KIND: 'Intended tax treatment',
    TAX_OPINION_COOPERATION_COVENANT: 'Tax opinion cooperation',
    TAX_TREATMENT_PROTECTION_COVENANT: 'Tax treatment protection',
    TRANSFER_TAX_ALLOCATION: 'Transfer tax allocation',
  });
  assert.ok(taxTable.columns.some((column) => column.display === 'fact_text'), 'the fact as drafted is a column');

  const financing = findSectionV3('financing');
  assert.deepEqual(financing.v2_family_keys.map((entry) => entry.key), ['FINANCING_COVENANTS', 'GUARANTY_FINANCING_PARTY']);
  assert.equal(financing.rail.group, 'Financing');
  const financingTable = findTableV3(financing, 'financing-table');
  assert.equal(financing.tables.length, 1, 'one table for the two families');
  const financingSubtypes = legalSchemaV2.families.filter((family) => ['FINANCING_COVENANTS', 'GUARANTY_FINANCING_PARTY'].includes(family.family_key)).flatMap((family) => family.subtypes.map((subtype) => subtype.subtype_key));
  assert.deepEqual(Object.keys(financingTable.subtype_rows).sort(), financingSubtypes.sort());
  assert.deepEqual(financingTable.fact_type_rows, { FINANCING_OBTAIN_EFFORTS_STANDARD: 'Obtain financing', NO_FINANCING_CONDITION_ACKNOWLEDGMENT: 'No financing condition', PAYOFF_DELIVERY_LEAD_TIME_DAYS: 'Payoff letters', LIMITED_GUARANTY_DELIVERED: 'Limited guaranty delivered' });
  assert.deepEqual(financingTable.columns.filter((column) => column.render === 'value').map((column) => column.column_id), ['period'], 'the payoff lead time is the one number');
  assert.deepEqual(taxTable.columns.filter((column) => column.render === 'value'), [], 'no tax subtype carries a number');
  for (const table of [taxTable, financingTable]) assert.equal(table.default_rows_from_subtype, true, table.table_key);

  // Every V2 family now has a page.
  const placed = new Set(tableShapesV3.sections.flatMap((section) => (section.v2_family_keys || []).map((entry) => entry.key)));
  for (const family of legalSchemaV2.families) assert.ok(placed.has(family.family_key), `${family.family_key} has no section`);

  // The order: after D&O, before the boilerplate.
  const keys = tableShapesV3.sections.map((section) => section.section_key);
  assert.ok(keys.indexOf('dno-indemnification') < keys.indexOf('tax-matters'));
  assert.ok(keys.indexOf('tax-matters') < keys.indexOf('financing'));
  assert.ok(keys.indexOf('financing') < keys.indexOf('misc-boilerplate'));

  // default_rows_from_subtype is a boolean and needs subtype rows to default to.
  const broken = structuredClone(tableShapesV3);
  const brokenTable = broken.sections.find((s) => s.section_key === 'tax-matters').tables[0];
  brokenTable.default_rows_from_subtype = 'yes';
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_DEFAULT_ROWS_FROM_SUBTYPE/);
  brokenTable.default_rows_from_subtype = true;
  delete brokenTable.row_from_subtype;
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_DEFAULT_ROWS_FROM_SUBTYPE_WITHOUT_SUBTYPE_ROWS/);
});

// Work package 6 (manager, 2026-10-18, generation 8's 3.13(b) and (c)): the
// material contracts representation's limbs are sub-items of the
// representations table's Material Contracts row, the family joining the
// section as KEY_DEFINED_TERMS does for the Knowledge row; the list table
// never takes them.
test('the material contracts representation\'s limbs are sub-items of the Material Contracts row, placed by limb_rows_from_subtype', () => {
  const section = findSectionV3('representations-qualifiers');
  assert.deepEqual(section.v2_family_keys.find((entry) => entry.key === 'MATERIAL_CONTRACTS'), { key: 'MATERIAL_CONTRACTS', confidence: 'low' });
  const table = findTableV3(section, 'representations-qualifiers-table');
  assert.deepEqual(table.detail_labels_by_row['Material Contracts'], ['Disclosure list', 'Validity and enforceability', 'No default']);
  assert.deepEqual(table.limb_rows_from_subtype, { MATERIAL_CONTRACTS: {
    MATERIAL_CONTRACT_DISCLOSURE_LIST: { row_label: 'Material Contracts', row_detail: 'Disclosure list' },
    MATERIAL_CONTRACT_STATUS_REPRESENTATION: { row_label: 'Material Contracts', row_detail: 'Validity and enforceability' },
    MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT: { row_label: 'Material Contracts', row_detail: 'No default' },
  } });
  for (const subtype of Object.keys(table.limb_rows_from_subtype.MATERIAL_CONTRACTS)) assert.ok(table.only_subtype_keys.includes(subtype), subtype);
  assert.match(table.guidance, /MATERIAL_CONTRACTS facts on the "Material Contracts" row, never on the material contracts list table/);
  assert.match(findTableV3(findSectionV3('material-contracts'), 'material-contracts-table').guidance, /never rows here: their readouts go to the representations table's "Material Contracts" row/);
  // The parent table is untouched: Parent makes no material contracts representation here.
  assert.equal(findTableV3(findSectionV3('parent-representations-qualifiers'), 'parent-representations-qualifiers-table').limb_rows_from_subtype, undefined);
  // The layer rules tell the extractor the same.
  assert.match(legalSchemaV2.families.find((family) => family.family_key === 'MATERIAL_CONTRACTS').layer_rules, /readouts go to the representations table's "Material Contracts" row/);

  const broken = structuredClone(tableShapesV3);
  const brokenTable = broken.sections.find((s) => s.section_key === 'representations-qualifiers').tables[0];
  brokenTable.limb_rows_from_subtype.MATERIAL_CONTRACTS.MATERIAL_CONTRACT_DISCLOSURE_LIST.row_detail = 'Schedule';
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_LIMB_ROWS_FROM_SUBTYPE_DETAIL_UNKNOWN/);
  brokenTable.limb_rows_from_subtype.MATERIAL_CONTRACTS.MATERIAL_CONTRACT_DISCLOSURE_LIST = { row_label: 'No such row', row_detail: 'Disclosure list' };
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_LIMB_ROWS_FROM_SUBTYPE_ROW_UNKNOWN/);
  brokenTable.limb_rows_from_subtype = { NO_SHOP: { PROHIBITED_ACTION: { row_label: 'Material Contracts', row_detail: 'No default' } } };
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_LIMB_ROWS_FROM_SUBTYPE_FAMILY/);
});

// Work package 7 (manager, 2026-10-18, generation 8's 5.02 against Ben's
// comments), (c) and (d): the Board determination standard rows code
// themselves from the words when the model gives none; six no-shop facts
// get rows or an other-provisions entry, with page defaults gated per fact
// type; and three new shape fields are validated.
test('work package 7: codes from words on the Board determination standard rows, the permitted-contact row, the disclosure codes, per-type gates and the takeover-statute other provision', () => {
  const core = findTableV3(findSectionV3('nosol-noshop'), 'nosol-noshop-core-mechanics');
  const permitted = 'Permitted contact: clarification and the no-shop\'s terms';
  assert.ok(core.fixed_row_labels.includes(permitted));
  assert.deepEqual(core.columns[0].vocabulary_by_row[permitted], ['YES', 'NO']);
  assert.equal(core.fact_type_rows.EXCEPTION_PREREQUISITE, permitted);
  assert.ok(new RegExp(core.fact_type_rows_when.EXCEPTION_PREREQUISITE, 'i').test('the Company may contact the Person making the Company Takeover Proposal solely to clarify the terms and conditions thereof'));
  assert.ok(new RegExp(core.fact_type_rows_when.EXCEPTION_PREREQUISITE, 'i').test('the Company may inform the Person of the existence of the provisions of this Section 5.02'));
  assert.equal(new RegExp(core.fact_type_rows_when.EXCEPTION_PREREQUISITE, 'i').test('the Company may make any disclosure required by applicable Law'), false);
  assert.deepEqual(core.columns[0].code_from_words_by_row[permitted].map((rule) => rule.code), ['YES']);

  const fiduciary = findTableV3(findSectionV3('nosol-fiduciary'), 'nosol-fiduciary-table');
  const boardRules = fiduciary.columns[0].code_from_words_by_row['Board determination standard'];
  assert.deepEqual(boardRules.map((rule) => rule.code), ['REASONABLY_LIKELY_TO_BE_INCONSISTENT_WITH_FIDUCIARY_DUTIES', 'INCONSISTENT_WITH_FIDUCIARY_DUTIES', 'WOULD_VIOLATE_FIDUCIARY_DUTIES', 'REQUIRED_BY_FIDUCIARY_DUTIES']);
  assert.ok(new RegExp(boardRules[0].words, 'i').test('would be, or would be reasonably likely to be, inconsistent with its fiduciary duties'));
  assert.equal(new RegExp(boardRules[0].words, 'i').test('would be inconsistent with its fiduciary duties'), false, 'the stricter reading needs the words');
  assert.ok(new RegExp(boardRules[1].words, 'i').test('would be inconsistent with its fiduciary duties'));
  assert.deepEqual(findTableV3(findSectionV3('nosol-intervening'), 'nosol-intervening-table').columns[0].code_from_words_by_row['Board determination standard'], boardRules);
  assert.match(fiduciary.guidance, /Board determination standard: always one code/);
  assert.equal(fiduciary.fact_type_rows.EXCEPTION_PREREQUISITE, 'Engagement standard');
  assert.ok(new RegExp(fiduciary.fact_type_rows_when.EXCEPTION_PREREQUISITE, 'i').test('the Company may engage in negotiations with the Person making a Qualifying Company Takeover Proposal'));

  const change = findTableV3(findSectionV3('nosol-fiduciary'), 'nosol-fiduciary-change-of-recommendation');
  assert.deepEqual(change.columns[0].vocabulary_by_row['Not a Change of Recommendation'].slice(-2), ['DISCLOSURE_REQUIRED_BY_LAW', 'DISCLOSURE_PERMISSION_NOT_A_CHANGE']);
  assert.deepEqual(change.fact_type_rows, { EXCEPTION_PREREQUISITE: 'Not a Change of Recommendation', RECOMMENDATION_CHANGE: 'Not a Change of Recommendation' });
  assert.ok(new RegExp(change.fact_type_rows_when.EXCEPTION_PREREQUISITE, 'i').test('the Company may make any disclosure to its stockholders if the Board determines in good faith that such disclosure is required by applicable Law'));
  assert.ok(new RegExp(change.fact_type_rows_when.RECOMMENDATION_CHANGE, 'i').test('the foregoing disclosure permissions shall not be deemed to permit the Board to make an Adverse Recommendation Change'));
  assert.equal(new RegExp(change.fact_type_rows_when.RECOMMENDATION_CHANGE, 'i').test('the Board may make an Adverse Recommendation Change in response to an Intervening Event if failure to do so would be inconsistent with its fiduciary duties'), false);
  assert.deepEqual(change.other_provisions_from_subtype.subtype_keys, ['RECOMMENDATION_CHANGE']);
  assert.ok(new RegExp(change.other_provisions_from_subtype.when, 'i').test('An Adverse Recommendation Change shall not change the approval of the Board for purposes of causing any Takeover Law to be inapplicable'));
  assert.match(change.guidance, /other provision \(work package 7/);
  assert.match(legalSchemaV2.families.find((family) => family.family_key === 'NO_SHOP').layer_rules, /The permissions inside the no-shop are facts of their own/);

  // Validation: a per-type gate names a fact_type_rows key; a words rule
  // names one of the row's codes; the other-provisions pattern compiles.
  const broken = () => structuredClone(tableShapesV3);
  let doc = broken(); doc.sections.find((s) => s.section_key === 'nosol-noshop').tables[0].fact_type_rows_when = { NO_SUCH_TYPE: 'x' };
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_FACT_TYPE_ROWS_WHEN/);
  doc = broken(); doc.sections.find((s) => s.section_key === 'nosol-fiduciary').tables[0].columns[0].code_from_words_by_row['Board determination standard'] = [{ code: 'NOT_A_CODE', words: 'x' }];
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_CODE_FROM_WORDS_CODE_UNKNOWN/);
  doc = broken(); doc.sections.find((s) => s.section_key === 'nosol-fiduciary').tables[0].columns[0].code_from_words_by_row = { 'No such row': [{ code: 'INCONSISTENT_WITH_FIDUCIARY_DUTIES', words: 'x' }] };
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_CODE_FROM_WORDS_ROW_UNKNOWN/);
  doc = broken(); doc.sections.find((s) => s.section_key === 'nosol-fiduciary').tables[1].other_provisions_from_subtype = { subtype_keys: ['RECOMMENDATION_CHANGE'], when: '(' };
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_OTHER_PROVISIONS_FROM_SUBTYPE/);
});

// Work package 13 (c) (manager, 2026-10-18, plan finding (79), NCS
// generation 5, 2.1): "The shape needs the election options as rows (cash
// election, share election, mixed election: ratio, cash, value per share)
// filled from the facts, with a value fallback from a defined ratio that
// carries a number".
test('the consideration election options table names its rows, columns and page rule', () => {
  const section = findSectionV3('consideration-hero');
  // Work package 18 (d) (Ben, 2026-10-18: "reg rights I think goes with consideration (but at bottom)"): the registration-rights table is last.
  assert.deepEqual(section.tables.map((table) => table.table_key), ['consideration-structure', 'consideration-components', 'consideration-election-options', 'consideration-hero-election-mechanics', 'consideration-registration-rights']);
  const options = findTableV3(section, 'consideration-election-options');
  assert.equal(options.rows_are, 'fixed list');
  assert.deepEqual(options.fixed_row_labels, ['Cash election', 'Stock election', 'Mixed election']);
  assert.deepEqual(options.subtype_keys, ['CASH_COMPONENT', 'STOCK_COMPONENT', 'ELECTION']);
  assert.deepEqual(options.columns.map((column) => [column.column_id, column.render, column.display || null]), [
    ['exchangeRatio', 'value', null], ['cashPerShare', 'value', null], ['valuePerShare', 'value', null], ['valueTerms', 'verbatim', 'fact_text'], ['definedAs', 'term', 'subject_note'],
  ]);
  // Ben, 2026-10-18 (plan finding (85)): "I'D SAY \"NOT A DEAL FEATURE\""; "KEEP ELECTIONS BUT ONLY WHEN THERE IS AN ELECTIOB".
  assert.equal(options.absent_row_label, 'Not a deal feature');
  assert.equal(options.election_options.value_column, 'valuePerShare');
  assert.match(options.election_options.held_row_label, /held/i);
  const componentsTable = findTableV3(section, 'consideration-components');
  assert.deepEqual(componentsTable.election_forms, { options_table_key: 'consideration-election-options', plain_form_by_code: { CASH_ELECTION: 'CASH', STOCK_ELECTION: 'PARENT_STOCK' } });
  assert.match(componentsTable.guidance, /election forms .* only/);
  assert.match(options.guidance, /never a row when the agreement has no election/);
  const rule = options.election_options;
  assert.deepEqual(Object.keys(rule.rows), options.fixed_row_labels);
  assert.equal(rule.rows['Stock election'].form_code, 'STOCK_ELECTION');
  // NCS 2.1's words: the share-only election, the mixed election, and the
  // no-election default (the mechanics table's row, never an option).
  assert.ok(new RegExp(rule.rows['Stock election'].words, 'i').test('with respect to which an election to receive only share consideration has been made and not validly revoked'));
  assert.ok(new RegExp(rule.rows['Mixed election'].words, 'i').test('with respect to which an election to receive mixed consideration has been made'));
  assert.ok(new RegExp(rule.rows['Cash election'].words, 'i').test('with respect to which an election to receive cash has been made'));
  assert.ok(new RegExp(rule.unless, 'i').test('with respect to which no election to receive Share Consideration or Mixed Consideration has been made'));
  assert.equal(new RegExp(rule.rows['Mixed election'].words, 'i').test('an election to receive only share consideration'), false);
  assert.ok(new RegExp(rule.value_terms, 'i').test('Cash Exchange Ratio'));
  assert.ok(new RegExp(rule.value_terms, 'i').test('Cash Consideration'));
  assert.equal(new RegExp(rule.value_terms, 'i').test('Share Election Stock'), false);
  assert.deepEqual([rule.ratio_column, rule.cash_column, rule.terms_column, rule.term_column], ['exchangeRatio', 'cashPerShare', 'valueTerms', 'definedAs']);
  // The combined definition's term must be a consideration term (NCS 2.1:
  // the package fact's first defined term was "Eligible Shares").
  assert.equal(findTableV3(section, 'consideration-components').combined_definition_from.term_words, 'Consideration$');

  // Validation: rows are fixed rows with a code or a pattern; the columns
  // are of the right render; the patterns compile.
  const broken = () => structuredClone(tableShapesV3);
  const optionsOf = (doc) => doc.sections.find((s) => s.section_key === 'consideration-hero').tables.find((t) => t.table_key === 'consideration-election-options');
  let doc = broken(); optionsOf(doc).election_options.rows['No such row'] = { words: 'x' };
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_ROW_UNKNOWN/);
  doc = broken(); optionsOf(doc).election_options.rows['Cash election'] = {};
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_ROW_RULE/);
  doc = broken(); optionsOf(doc).election_options.rows['Cash election'] = { words: '(' };
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_ROW_RULE/);
  doc = broken(); optionsOf(doc).election_options.ratio_column = 'valueTerms';
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_COLUMN/);
  doc = broken(); optionsOf(doc).election_options.cash_column = 'exchangeRatio';
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_COLUMN/);
  doc = broken(); optionsOf(doc).election_options.value_terms = '(';
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_VALUE_TERMS/);
  doc = broken(); optionsOf(doc).rows_are = 'one per subject'; delete optionsOf(doc).fixed_row_labels;
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_WITHOUT_FIXED_LIST/);
  doc = broken(); doc.sections.find((s) => s.section_key === 'consideration-hero').tables.find((t) => t.table_key === 'consideration-components').combined_definition_from.term_words = '(';
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_COMBINED_DEFINITION_FROM/);
  doc = broken(); optionsOf(doc).election_options.value_column = 'exchangeRatio';
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_COLUMN/);
  doc = broken(); optionsOf(doc).election_options.value_column = 'valueTerms';
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_OPTIONS_COLUMN/);
  doc = broken(); doc.sections.find((s) => s.section_key === 'consideration-hero').tables.find((t) => t.table_key === 'consideration-components').election_forms.plain_form_by_code = { CASH_ELECTION: 'NO_SUCH_CODE' };
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ELECTION_FORMS_CODE_UNKNOWN/);
});

// Work package 17 (manager, 2026-10-18 19:10 UTC, from the NCS read): the
// no-shop savings clause row, placed by the words of the fact.
test('the fiduciary-out table has the savings-clause row, placed by words_rows, with its Yes code read from the words', () => {
  const table = findTableV3(findSectionV3('nosol-fiduciary'), 'nosol-fiduciary-table');
  assert.ok(table.fixed_row_labels.includes('Fiduciary actions are not a breach'));
  assert.deepEqual(table.columns[0].vocabulary_by_row['Fiduciary actions are not a breach'], ['YES', 'NO']);
  assert.equal(table.words_rows.length, 1);
  const [rule] = table.words_rows;
  assert.deepEqual([rule.row_label, rule.code], ['Fiduciary actions are not a breach', 'YES']);
  const when = new RegExp(rule.when, 'i');
  // NCS 5.2(d) and Metsera 5.02's forms match; the prerequisite does not.
  assert.ok(when.test('any determination or action by the Company or the Company Board in accordance with Section 5.2(c) shall not be deemed to be a breach or violation of this Section 5.2(a)'));
  assert.ok(when.test('shall not constitute a breach of Section 5.02(a)'));
  assert.ok(when.test('will not be deemed to constitute a breach of this Section 5.2'));
  assert.equal(when.test('a bona fide unsolicited Acquisition Proposal that did not result from a breach of Section 5.2(a)'), false);
  assert.ok(table.columns[0].code_from_words_by_row['Fiduciary actions are not a breach'].some((entry) => entry.code === 'YES'));
  assert.match(table.guidance, /Fiduciary actions are not a breach: the savings clause/);
  const broken = () => structuredClone(tableShapesV3);
  const tableOf = (doc) => doc.sections.find((s) => s.section_key === 'nosol-fiduciary').tables.find((t) => t.table_key === 'nosol-fiduciary-table');
  let doc = broken(); tableOf(doc).words_rows = [{ row_label: 'No such row', when: 'x' }];
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_WORDS_ROWS_ROW_UNKNOWN/);
  doc = broken(); tableOf(doc).words_rows = [{ row_label: 'Fiduciary actions are not a breach', when: '(' }];
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_WORDS_ROWS/);
  doc = broken(); tableOf(doc).words_rows = [{ row_label: 'Fiduciary actions are not a breach', when: 'x', code: 'MAYBE' }];
  assert.throws(() => validateTableShapesV3(doc, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_WORDS_ROWS_CODE_UNKNOWN/);
});

// Work package 18 (c) (plan finding (91); NCS generation 5, 5.14): the
// publicity row's sub-items, by detail labels and words rules.
test('the general covenants table names the publicity sub-items and the words that place a fact on each; a rule naming no label fails validation', () => {
  const table = findTableV3(findSectionV3('general-covenants'), 'general-covenants-table');
  assert.deepEqual(table.detail_labels_by_row['Public announcements'], [
    'Announcement release', 'Consent to releases', 'Consultation and review', 'Consistent with prior statements',
    'Carve-out: ordinary course', 'Carve-out: employees', 'Carve-out: disputes', 'Carve-out: investor and media communications', 'Carve-out: sponsor disclosure', 'Law or exchange exception',
  ]);
  const rules = table.detail_from_words_by_row['Public announcements'];
  assert.equal(rules.length, 10);
  for (const rule of rules) {
    assert.ok(table.detail_labels_by_row['Public announcements'].includes(rule.detail), rule.detail);
    assert.doesNotThrow(() => new RegExp(rule.words, 'i'));
  }
  assert.deepEqual(rules.slice(0, 5).map((rule) => rule.detail), ['Carve-out: sponsor disclosure', 'Carve-out: employees', 'Carve-out: disputes', 'Carve-out: investor and media communications', 'Carve-out: ordinary course'], 'the carve-outs are read before the duties they qualify');
  assert.equal(rules[rules.length - 1].detail, 'Law or exchange exception', 'the exception every duty repeats is read last');
  assert.match(table.guidance, /Public announcements: every publicity fact is on this row/);
  const broken = structuredClone(tableShapesV3);
  const brokenTable = findTableV3(broken.sections.find((s) => s.section_key === 'general-covenants'), 'general-covenants-table');
  brokenTable.detail_from_words_by_row['Public announcements'].push({ detail: 'Not a label', words: 'press' });
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_DETAIL_FROM_WORDS_DETAIL_UNKNOWN/);
  brokenTable.detail_from_words_by_row['Public announcements'].pop();
  brokenTable.detail_from_words_by_row['Access to information'] = [{ detail: 'Data room', words: 'data room' }];
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_DETAIL_FROM_WORDS_ROW_WITHOUT_LABELS/);
});

// Work package 18 (d) as revised (Ben, 2026-10-18, plan finding (163): "reg
// rights I think goes with consideration (but at bottom)"; NCS generation 5,
// 5.17): the Registration rights table at the bottom of the Consideration
// section, the covenants table's words rule that sends facts there over the
// readout, its sub-items, the OTHER_PARTY obligor (f) and the By when
// column (g).
test('the registration-rights table sits last under Consideration, takes general covenants by words over the readout as one line, with an other-party obligor and a By when column', () => {
  const consideration = findSectionV3('consideration-hero');
  const table = findTableV3(consideration, 'consideration-registration-rights');
  assert.equal(consideration.tables[consideration.tables.length - 1].table_key, 'consideration-registration-rights');
  assert.deepEqual(table.accepts_families, ['GENERAL_COVENANTS']);
  assert.deepEqual(table.fixed_row_labels, ['Registration rights']);
  assert.deepEqual(table.columns.map((column) => column.column_id), ['obligor', 'standard', 'byWhen', 'asDrafted']);
  const covenants = findTableV3(findSectionV3('general-covenants'), 'general-covenants-table');
  assert.equal(covenants.fixed_row_labels.includes('Registration rights'), false, 'the row left the general covenants table');
  const rule = covenants.words_rows.find((candidate) => candidate.row_label === 'Registration rights');
  assert.equal(rule.over_readout, true);
  assert.equal(rule.table_key, 'consideration-registration-rights');
  const when = new RegExp(rule.when, 'i');
  for (const words of ['to keep such Registration Statement continuously effective', 'all Registrable Securities covered', 'a prospectus supplement', 'Rule 144(c)(1)', 'pursuant to Rule 415']) assert.ok(when.test(words), words);
  assert.equal(when.test('any notice of deficiency or non-compliance received from Nasdaq'), false);
  // Ben, 2026-10-18 (plan finding (166)): "are these from a reg rights agreement? I wouldn't go into anywhere near this depth in this product": one line, no sub-items.
  assert.equal(table.no_sub_items, true);
  assert.equal(table.detail_labels_by_row, undefined);
  assert.equal(table.detail_from_words_by_row, undefined);
  assert.match(table.reason, /I wouldn't go into anywhere near this depth in this product/);
  const broken3 = structuredClone(tableShapesV3);
  findTableV3(broken3.sections.find((s) => s.section_key === 'consideration-hero'), 'consideration-registration-rights').no_sub_items = 'yes';
  assert.throws(() => validateTableShapesV3(broken3, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_NO_SUB_ITEMS/);
  // (f) Ben: "on A - if the shareholders have to do something, okay for them to be an obligor".
  for (const owner of [covenants, table]) {
    const obligor = owner.columns.find((column) => column.column_id === 'obligor');
    assert.ok(obligor.vocabulary.some((entry) => entry.code === 'OTHER_PARTY'));
    assert.equal(obligor.other_party_code, 'OTHER_PARTY');
  }
  // (g) Ben: "Ok on ETA on covenants".
  for (const owner of [covenants, table, findTableV3(findSectionV3('financing'), 'financing-table')]) {
    const byWhen = owner.columns.find((column) => column.column_id === 'byWhen');
    assert.deepEqual([byWhen.render, byWhen.fill_from, byWhen.fill_from_components], ['verbatim', ['TRIGGER', 'PERIOD'], true]);
    const drafted = owner.columns.find((column) => column.column_id === 'asDrafted');
    assert.ok(drafted.fill_from.includes('TRIGGER') && drafted.fill_from.includes('PERIOD'), owner.table_key);
    assert.ok(owner.columns.indexOf(byWhen) < owner.columns.indexOf(drafted));
  }
  const broken = structuredClone(tableShapesV3);
  const brokenCovenants = findTableV3(broken.sections.find((s) => s.section_key === 'general-covenants'), 'general-covenants-table');
  brokenCovenants.words_rows.find((candidate) => candidate.row_label === 'Registration rights').table_key = 'no-such-table';
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_WORDS_ROWS_TABLE_UNKNOWN/);
  brokenCovenants.words_rows.find((candidate) => candidate.row_label === 'Registration rights').table_key = 'consideration-registration-rights';
  brokenCovenants.words_rows[0].over_readout = 'yes';
  assert.throws(() => validateTableShapesV3(broken, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_WORDS_ROWS/);
  const broken2 = structuredClone(tableShapesV3);
  findTableV3(broken2.sections.find((s) => s.section_key === 'consideration-hero'), 'consideration-registration-rights').accepts_families = ['NOT_A_FAMILY'];
  assert.throws(() => validateTableShapesV3(broken2, legalSchemaV2, factComponentsV2), /TABLE_SHAPES_ACCEPTS_FAMILIES/);
});


// Work package 19 (d) (manager finding (165); NCS generation 5): the eight
// VALID facts without a readout each have a row.
test('the conditions, termination and boilerplate tables name rows for the NCS generation 5 facts that had none', () => {
  const mutual = findTableV3(findSectionV3('conditions'), 'conditions-table');
  assert.ok(mutual.fixed_row_labels.includes('Other mutual conditions'));
  assert.equal(mutual.fact_type_rows.GENERAL_CLOSING_CONDITION, 'Other mutual conditions');
  for (const [sectionKey, tableKey] of [['conditions-b', 'conditions-b-table'], ['conditions-s', 'conditions-s-table']]) {
    const table = findTableV3(findSectionV3(sectionKey), tableKey);
    for (const label of ['No Material Adverse Effect', 'Tax opinion', 'Other conditions']) assert.ok(table.fixed_row_labels.includes(label), `${tableKey}: ${label}`);
    assert.equal(table.fact_type_rows['GENERAL_CLOSING_CONDITION:TAX_OPINION'], 'Tax opinion');
    assert.equal(table.fact_type_rows.GENERAL_CLOSING_CONDITION, 'Other conditions');
    assert.equal(table.fact_type_rows['GENERAL_CLOSING_CONDITION:BRINGDOWN'], 'Accuracy of Representations');
  }
  assert.ok(new RegExp(findTableV3(findSectionV3('conditions-s'), 'conditions-s-table').statement_words, 'i').test("As a condition to the Company's obligation to effect the Merger"));
  const buyer = findTableV3(findSectionV3('termination-rights'), 'termination-rights-buyer-may-terminate');
  assert.deepEqual(buyer.fixed_row_labels.slice(-2), ['Written consent not delivered', 'Support agreement not delivered']);
  assert.equal(buyer.fact_type_rows['TERMINATION_RIGHT:WRITTEN_CONSENT_NOT_DELIVERED'], 'Written consent not delivered');
  assert.equal(buyer.subtype_rows.SUPPORT_AGREEMENT_NOT_DELIVERED, 'Support agreement not delivered');
  const effect = findTableV3(findSectionV3('termination-rights'), 'termination-rights-effect');
  assert.ok(effect.fixed_row_labels.includes('Remedies preserved'));
  assert.equal(effect.fact_type_rows['TERMINATION_EFFECT:REMEDY_ENTITLEMENT'], 'Remedies preserved');
  const misc = findTableV3(findSectionV3('misc-boilerplate'), 'misc-boilerplate-table');
  assert.ok(misc.fixed_row_labels.includes('Cumulative remedies'));
  assert.deepEqual(misc.fact_type_rows, { 'MISC_BOILERPLATE_MECHANIC_PRESENT:CONSTRUCTION': 'Construction', 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT:CUMULATIVE_RIGHTS': 'Cumulative remedies' });
});
