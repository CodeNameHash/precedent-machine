'use strict';

// Tests for lib/product/table-view.js buildTableView: turns accepted
// FACT_COMPONENTS/V2 facts into the section/table/row/cell shape behind the
// published and Query pages' coded-conclusion tables (docs/core/CODEBASE-GUIDE.md
// "Layered fact model, V2"; mockup approved by Ben 2026-09-12/13). Exercises
// the fixture used by tests/product-published-layers.test.js plus two
// hand-written facts carrying a `conclusions` layer, standing in for the
// (not yet merged) lib/product/fact-conclusions.js.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildTableView } = require('../lib/product/table-view');
const tableShapes = require('../contracts/product/table-shapes.v3.json');
const legalSchema = require('../contracts/product/legal-schema.v2.json');

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures/product/published-layers-fixture.v2.json'), 'utf8',
));

// Hand-written conclusion A: an explicit table_key, a full row_label, cells
// for two of the table's three columns (the third stays a dash), and a
// DEFINED_TERM component to exercise the defined_terms appendix.
const conclusionFactA = {
  fact_id: 'f-material-contracts-2',
  source_closure_id: 'c-mc-2',
  family_key: 'MATERIAL_CONTRACTS',
  subtype_key: 'MATERIAL_CONTRACT_CATEGORY_CRITERION',
  section_reference: '3.14(b)',
  coverage_only: false,
  headline: { label: 'Material Contracts category', distinguishing_component_ids: [] },
  conclusions: {
    table_key: 'material-contracts-table',
    row_label: 'Real estate leases',
    cells: {
      contractType: { kind: 'pill', label: 'Real property lease', tone: 'buyer', component_ids: ['c-mc2-category'] },
      threshold: { kind: 'value', label: '$1,000,000', tone: 'neutral', component_ids: ['c-mc2-threshold'] },
    },
  },
  components: [
    {
      component_id: 'c-mc2-category', kind: 'TERM', label: 'contract category', text: 'any real property lease',
      source_span_id: 's-mc-2', start_byte: 100, end_byte: 124, origin: 'OWN', gap_before: false, children: [],
    },
    {
      component_id: 'c-defined-1', kind: 'DEFINED_TERM', label: 'defined term', text: 'Material Contract',
      source_span_id: 's-mc-2', start_byte: 130, end_byte: 148, origin: 'OWN', gap_before: false, children: [],
      resolves_to: { structure_node_id: 'n-1-1', text: '"Material Contract" means any Contract described in this Section 3.14.' },
    },
  ],
};

// Hand-written conclusion B: no table_key -- the row_label ("Company
// termination fee") matches a fixed_row_label of termination-fees-table
// exactly, so the fallback table resolution (used because
// lib/product/fact-conclusions.js is not merged yet) must find it the same
// way it would place a fact with no conclusions at all.
const conclusionFactB = {
  fact_id: 'f-termination-fee-2',
  source_closure_id: 'c-tf-2',
  family_key: 'TERMINATION_FEE',
  subtype_key: 'FEE_AMOUNT',
  section_reference: '8.3(a)',
  coverage_only: false,
  headline: { label: 'Company termination fee amount', distinguishing_component_ids: [] },
  conclusions: {
    row_label: 'Company termination fee',
    cells: {
      amount: { kind: 'value', label: '$50,000,000', tone: 'neutral', component_ids: ['c-tf2-amount'] },
      payer: { kind: 'pill', label: 'Company', tone: 'seller', component_ids: ['c-tf2-payer'] },
    },
  },
  components: [
    {
      component_id: 'c-tf2-amount', kind: 'AMOUNT', label: 'amount', text: '$50,000,000',
      source_span_id: 's-tf-2', start_byte: 200, end_byte: 211, origin: 'OWN', gap_before: false,
      value: { canonical: 50000000, unit: 'USD' }, children: [],
    },
  ],
};

const facts = [...fixture.facts, conclusionFactA, conclusionFactB];
const view = buildTableView({ facts, tableShapes, legalSchema });

function section(sectionKey) {
  return view.sections.find((candidate) => candidate.section_key === sectionKey);
}

function table(sectionKey, tableKey) {
  return section(sectionKey)?.tables.find((candidate) => candidate.table_key === tableKey);
}

test('sections come out in the table shapes order, only for sections that ended up with rows', () => {
  const keys = view.sections.map((candidate) => candidate.section_key);
  assert.deepEqual(keys, ['termination-fees', 'mae-definitions', 'material-contracts']);
});

test('a coverage-only fact never reaches a table', () => {
  assert.equal(section('misc-boilerplate'), undefined);
  const allFactIds = view.sections.flatMap((candidate) => candidate.tables)
    .flatMap((candidate) => candidate.rows)
    .flatMap((row) => row.backing_facts.map((entry) => entry.fact_id));
  assert.ok(!allFactIds.includes('f-boilerplate-notices-1'));
});

test('a fact with no conclusions never becomes a row; it is listed under its section as evidence without a readout', () => {
  const materialContracts = table('material-contracts', 'material-contracts-table');
  const fallbackRow = materialContracts && materialContracts.rows.find((row) => row.backing_facts.some((entry) => entry.fact_id === 'f-material-contracts-1'));
  assert.equal(fallbackRow, undefined);
  const section = view.sections.find((candidate) => candidate.section_key === 'material-contracts');
  assert.ok(section.facts_without_readout.some((entry) => entry.fact_id === 'f-material-contracts-1'));
});

test('a fact with an explicit conclusions.table_key and row_label lands exactly there, cells taken from conclusions', () => {
  const materialContracts = table('material-contracts', 'material-contracts-table');
  const row = materialContracts.rows.find((candidate) => candidate.subject === 'Real estate leases');
  assert.ok(row, 'conclusion A should create its own row, keyed by row_label');
  const byColumn = Object.fromEntries(row.cells.map((cell) => [cell.column_id, cell]));
  assert.equal(byColumn.contractType.kind, 'pill');
  assert.equal(byColumn.contractType.label, 'Real property lease');
  assert.equal(byColumn.contractType.tone, 'buyer');
  assert.equal(byColumn.threshold.kind, 'value');
  assert.equal(byColumn.threshold.label, '$1,000,000');
  // uncoveredBucket was not supplied by the conclusion, so it stays a dash
  // rather than falling back to component rendering.
  assert.equal(byColumn.uncoveredBucket.kind, 'dash');
  assert.deepEqual(row.backing_facts, [{ fact_id: 'f-material-contracts-2', section_reference: '3.14(b)', structure_node_id: null }]);
});

test('a fact with conclusions but no table_key is placed by matching row_label against a fixed_row_label', () => {
  const terminationFees = table('termination-fees', 'termination-fees-table');
  const row = terminationFees.rows.find((candidate) => candidate.subject === 'Company termination fee');
  assert.ok(row, 'conclusion B should resolve to termination-fees-table via its row_label');
  const byColumn = Object.fromEntries(row.cells.map((cell) => [cell.column_id, cell]));
  assert.equal(byColumn.amount.kind, 'value');
  assert.equal(byColumn.amount.label, '$50,000,000');
  assert.equal(byColumn.payer.kind, 'pill');
  assert.equal(byColumn.payer.tone, 'seller');
  assert.equal(byColumn.trigger.kind, 'dash');
  assert.equal(byColumn.deemingRulePresent.kind, 'dash');

  // The fixture's own termination-fee-trigger fact has no conclusions: it is
  // never a row, and is listed under the section as evidence without a readout.
  assert.equal(terminationFees.rows.some((candidate) => candidate.backing_facts.some((entry) => entry.fact_id === 'f-termination-fee-trigger-1')), false);
  const section = view.sections.find((candidate) => candidate.section_key === 'termination-fees');
  assert.ok(section.facts_without_readout.some((entry) => entry.fact_id === 'f-termination-fee-trigger-1'));
});

test('a family whose facts all lack a readout still appears, with the facts listed and no tables', () => {
  const section = view.sections.find((candidate) => candidate.section_key === 'mae-definitions');
  assert.ok(section, 'the MAE section is present for its evidence');
  assert.equal(section.tables.length, 0);
  assert.ok(section.facts_without_readout.length >= 1);
});

test('the term_column and group_header carry through from the table shape', () => {
  const terminationFees = table('termination-fees', 'termination-fees-table');
  assert.equal(terminationFees.group_header, null);
  assert.equal(terminationFees.term_column.header, 'Term');
  const mutual = table('termination-rights', 'termination-rights-mutual');
  assert.equal(mutual, undefined, 'no fact in this run maps to termination-rights, so it is absent entirely');
});

test('defined_terms collects DEFINED_TERM components across all facts, de-duplicated and sorted', () => {
  assert.equal(view.defined_terms.length, 1);
  const [term] = view.defined_terms;
  assert.equal(term.term, 'Material Contract');
  assert.equal(term.fact_id, 'f-material-contracts-2');
  assert.match(term.definition, /means any Contract/);
});

// Contract-shaped conclusions (a real Metsera V9 fact, 2026-09-13) render as
// labelled cells that carry their component ids; and a one-per-agreement
// table gathers every fact of the family into one row.
const structureFact = { ...require('./fixtures/product/metsera-v9-structure-fact.v1.json') };
structureFact.fact_id = structureFact.proposal_id;

test('a contract-shaped vocabulary cell renders its vocabulary label and keeps its component ids', () => {
  const view = buildTableView({ facts: [structureFact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  assert.ok(table, 'the structure table is present');
  assert.equal(table.layout, 'attribute grid');
  assert.equal(table.rows.length, 1);
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'effectsOfMerger');
  assert.equal(cell.kind, 'pill');
  assert.equal(cell.label, 'DGCL');
  assert.deepEqual(cell.component_ids, ['aaf01d341b5c8926bdace0f8685ee73523f250d183dd4a7020a81d4054903367']);
  assert.deepEqual(cell.fact_ids, [structureFact.proposal_id]);
  assert.equal(table.rows[0].cells.find((candidate) => candidate.column_id === 'closingTiming').kind, 'dash');
});

test('a one-per-agreement table gathers every fact of the family into one row', () => {
  const closingFact = {
    ...structureFact, proposal_id: 'p-closing', fact_id: 'p-closing', subtype_key: 'CLOSING',
    components: [{ component_id: 'c-when', kind: 'TRIGGER', label: 'timing', text: 'on the third Business Day', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] }],
    conclusions: { table_key: 'structure-mechanics-table', row_label: 'the Merger', cells: [{ column_id: 'closingTiming', text: 'on the third Business Day', component_ids: ['c-when'] }] },
  };
  const view = buildTableView({ facts: [structureFact, closingFact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].subject, 'The deal');
  assert.equal(table.rows[0].backing_facts.length, 2);
  const timing = table.rows[0].cells.find((candidate) => candidate.column_id === 'closingTiming');
  assert.equal(timing.kind, 'text');
  assert.equal(timing.label, 'on the third Business Day');
  assert.deepEqual(timing.fact_ids, ['p-closing']);
});

// Ben, 2026-09-13: two facts in one cell keep both readings; a representation
// limb is a sub-item under its rep; the bring-down standard is derived from
// the closing-conditions fact whose cross-reference names the rep.
function repFact(id, label, detail, section, nodeId, materiality) {
  return {
    fact_id: id, proposal_id: id, family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', section_reference: section, structure_node_id: nodeId,
    headline: { label: 'Status representation', distinguishing_component_ids: [`${id}-std`] },
    components: [{ component_id: `${id}-std`, kind: 'MATERIALITY_QUALIFIER', label: 'materiality', text: 'Company Material Adverse Effect', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] }],
    conclusions: { table_key: 'representations-qualifiers-table', row_label: label, ...(detail ? { row_detail: detail } : {}), cells: [{ column_id: 'materiality', code: materiality, component_ids: [`${id}-std`] }] },
  };
}
const bringDownFact = {
  fact_id: 'bd-1', proposal_id: 'bd-1', family_key: 'CLOSING_CONDITIONS', subtype_key: 'BRINGDOWN', section_reference: '7.02(a)', structure_node_id: 'n-7-02',
  headline: { label: 'Bring-down of representations', distinguishing_component_ids: ['bd-1-std'] },
  components: [
    { component_id: 'bd-1-std', kind: 'STANDARD', label: 'standard', text: 'true and correct in all material respects', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] },
    { component_id: 'bd-1-ref', kind: 'CROSS_REFERENCE', label: 'reps covered', text: 'Section 3.01', origin: 'OWN', source_span_id: 's', start_byte: 11, end_byte: 20, gap_before: true, children: [], resolves_to: { structure_node_id: 'n-3-01', text: 'Organization, Standing and Corporate Power' } },
  ],
  conclusions: { table_key: 'conditions-b-table', row_label: 'Accuracy of Representations', cells: [{ column_id: 'standard', code: 'TRUE_IN_ALL_MATERIAL_RESPECTS', component_ids: ['bd-1-std'] }] },
};

test('a representation limb is a sub-item under its rep, whose line gives the overview, and the bring-down is derived from the conditions', () => {
  const facts = [
    repFact('r-1', 'Organization; Qualification; Standing', null, '3.01', 'n-3-01', 'MAE_AGGREGATE'),
    repFact('r-2', 'Organization; Qualification; Standing', 'Company Subsidiaries: organization and good standing', '3.01', 'n-3-01', 'MAE_AGGREGATE_PARTIAL'),
    bringDownFact,
  ];
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const reps = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'representations-qualifiers-table');
  assert.equal(reps.rows.length, 1);
  const row = reps.rows[0];
  assert.equal(row.subject, 'Organization; Qualification; Standing');
  assert.equal(row.sub_rows.length, 1);
  assert.equal(row.sub_rows[0].subject, 'Company Subsidiaries: organization and good standing');
  const materiality = row.cells.find((cell) => cell.column_id === 'materiality');
  assert.equal(materiality.values.length, 2, 'the overview keeps both readings');
  const bringdown = row.cells.find((cell) => cell.column_id === 'bringdown');
  assert.equal(bringdown.kind, 'pill');
  assert.equal(bringdown.code, 'TRUE_IN_ALL_MATERIAL_RESPECTS');
  assert.deepEqual(bringdown.fact_ids, ['bd-1']);
  assert.ok(bringdown.component_ids.includes('bd-1-ref'));
  const subBringdown = row.sub_rows[0].cells.find((cell) => cell.column_id === 'bringdown');
  assert.equal(subBringdown.code, 'TRUE_IN_ALL_MATERIAL_RESPECTS');
});

test('a representation fact never fills the derived bring-down column itself', () => {
  const fact = repFact('r-3', 'Taxes; Tax Returns', null, '3.15', 'n-3-15', 'MAE_AGGREGATE');
  fact.conclusions.cells.push({ column_id: 'bringdown', code: 'TRUE_EXCEPT_NO_MAE', component_ids: ['r-3-std'] });
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const reps = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'representations-qualifiers-table');
  assert.equal(reps.rows[0].cells.find((cell) => cell.column_id === 'bringdown').kind, 'dash');
});
