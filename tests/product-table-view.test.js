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
      qualifier: { kind: 'pill', label: 'Material', tone: 'buyer', component_ids: ['c-mc2-category'] },
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
  assert.deepEqual(keys, ['material-contracts', 'mae-definitions', 'termination-fees'], 'the old app\'s order (decision 27)');
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
  assert.equal(byColumn.qualifier.kind, 'pill');
  assert.equal(byColumn.qualifier.label, 'Material');
  assert.equal(byColumn.qualifier.tone, 'buyer');
  assert.equal(byColumn.threshold.kind, 'value');
  assert.equal(byColumn.threshold.label, '$1,000,000');
  // provision was not supplied by the conclusion, so it stays a dash
  // rather than falling back to component rendering.
  assert.equal(byColumn.provision.kind, 'dash');
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

test('a general covenant row is named from the fact\'s subtype; the model\'s own label becomes the sub-item', () => {
  const fact = {
    fact_id: 'gc-1', proposal_id: 'gc-1', family_key: 'GENERAL_COVENANTS', subtype_key: 'MERGER_SUB_OBLIGATION', section_reference: '6.12', structure_node_id: 'n-6-12',
    headline: { label: 'Merger sub obligation', distinguishing_component_ids: ['gc-1-op'] },
    components: [{ component_id: 'gc-1-op', kind: 'OPERATION', label: 'obligation', text: 'shall cause Merger Sub to perform', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] }],
    conclusions: { table_key: 'general-covenants-table', row_label: 'Parent, as sole stockholder of Merger Sub', cells: [{ column_id: 'obligor', code: 'PARENT', component_ids: ['gc-1-op'] }] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'general-covenants-table');
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].subject, 'Merger Sub obligations');
  assert.equal(table.rows[0].sub_rows[0].subject, 'Parent, as sole stockholder of Merger Sub');
  assert.equal(table.rows[0].cells.find((cell) => cell.column_id === 'obligor').label, 'Parent');
});

test('bring-down tiers are lines under Accuracy of Representations, referencing the reps by title', () => {
  const tier = (id, code, refs) => ({
    fact_id: id, proposal_id: id, family_key: 'CLOSING_CONDITIONS', subtype_key: 'BRINGDOWN', section_reference: '7.02(a)', structure_node_id: 'n-7-02',
    headline: { label: 'Bring-down of representations', distinguishing_component_ids: [`${id}-std`] },
    components: [
      { component_id: `${id}-std`, kind: 'STANDARD', label: 'standard', text: 'true and correct', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] },
      ...refs.map((ref, index) => ({ component_id: `${id}-ref-${index}`, kind: 'CROSS_REFERENCE', label: 'rep', text: ref.text, origin: 'OWN', source_span_id: 's', start_byte: 20 + index, end_byte: 30 + index, gap_before: true, children: [], resolves_to: { structure_node_id: ref.node, text: ref.title } })),
    ],
    conclusions: { table_key: 'conditions-b-table', row_label: 'Accuracy of Representations', cells: [
      { column_id: 'standard', code, component_ids: [`${id}-std`] },
      { column_id: 'reference', text: refs.map((ref) => ref.text).join(', '), component_ids: refs.map((_, index) => `${id}-ref-${index}`) },
    ] },
  });
  const facts = [
    tier('bd-a', 'TRUE_EXCEPT_DE_MINIMIS', [{ text: 'Section 3.02(a)', node: 'n-3-02', title: 'Capitalization' }]),
    tier('bd-b', 'TRUE_IN_ALL_MATERIAL_RESPECTS', [{ text: 'Section 3.01', node: 'n-3-01', title: 'Organization, Standing and Corporate Power' }, { text: 'Section 3.04', node: 'n-3-04', title: 'Authority' }]),
  ];
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'conditions-b-table');
  assert.equal(table.rows.length, 1);
  const row = table.rows[0];
  assert.equal(row.sub_rows.length, 2);
  assert.equal(row.sub_rows[0].subject, 'True except for de minimis inaccuracies');
  assert.equal(row.sub_rows[1].cells.find((cell) => cell.column_id === 'reference').label, 'Section 3.01 (Organization, Standing and Corporate Power); Section 3.04 (Authority)');
  assert.equal(row.cells.find((cell) => cell.column_id === 'standard').values.length, 2, 'the overview keeps both tiers');
});

test('an MAE-coded pill carries a link to the MAE definition section', () => {
  const fact = {
    fact_id: 'bd-mae', proposal_id: 'bd-mae', family_key: 'CLOSING_CONDITIONS', subtype_key: 'BRINGDOWN', section_reference: '7.02(a)', structure_node_id: 'n-7-02',
    headline: { label: 'Bring-down', distinguishing_component_ids: ['bd-mae-std'] },
    components: [{ component_id: 'bd-mae-std', kind: 'STANDARD', label: 'standard', text: 'would not have a Company Material Adverse Effect', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] }],
    conclusions: { table_key: 'conditions-b-table', row_label: 'Accuracy of Representations', cells: [{ column_id: 'standard', code: 'TRUE_EXCEPT_NO_MAE', component_ids: ['bd-mae-std'] }] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'conditions-b-table');
  assert.equal(table.rows[0].cells.find((cell) => cell.column_id === 'standard').link_section, 'mae-definitions');
});

// Decision 25 (Ben, 2026-09-13, on the MAE section).
const maeFact = (id, subtype, subject, conclusions, text = 'any change in GAAP') => ({
  fact_id: id, proposal_id: id, family_key: 'MAE_DEFINITION', subtype_key: subtype, section_reference: '1.01', structure_node_id: 'n-1-01',
  headline: { label: subject, distinguishing_component_ids: [`${id}-c`] },
  components: [
    { component_id: `${id}-c`, kind: 'LIST_ELEMENT', label: subject, text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] },
    { component_id: `${id}-x`, kind: 'CROSS_REFERENCE', label: 'clauses', text: 'clauses (i) through (iv)', origin: 'OWN', source_span_id: 's', start_byte: 20, end_byte: 30, gap_before: true, children: [], resolves_to: null },
  ],
  conclusions,
});

test('the MAE definitions table shows "None" for a fixed row no fact fills, once another row is filled', () => {
  const company = maeFact('mae-def-co', 'DEFINITION_PRONG', 'Company', { table_key: 'mae-definitions-table', row_label: 'Company', cells: [{ column_id: 'test', text: 'any change in GAAP', component_ids: ['mae-def-co-c'] }] });
  const view = buildTableView({ facts: [company], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'mae-definitions-table');
  assert.equal(table.absent_row_label, 'None');
  assert.deepEqual(table.rows.map((row) => [row.subject, row.absent || false]), [['Parent', true], ['Company', false]]);
  assert.equal(table.rows[0].backing_facts.length, 0);
});

test('an empty MAE definitions table is not evidence of absence: no rows, no table', () => {
  const view = buildTableView({ facts: [], tableShapes, legalSchema });
  assert.equal(view.sections.some((section) => section.section_key === 'mae-definitions'), false);
});

test('a carve-out row with no carve-back reading says No, and the carve-back fact is the footer, never a row', () => {
  const gaap = maeFact('mae-gaap', 'EXCLUSION', 'GAAP', { table_key: 'mae-carveouts-company', row_label: 'Changes in GAAP or accounting principles', cells: [{ column_id: 'provision', text: 'any change in GAAP', component_ids: ['mae-gaap-c'] }] });
  const war = maeFact('mae-war', 'EXCLUSION', 'war', { table_key: 'mae-carveouts-company', row_label: 'Acts of war, armed hostilities, or terrorism', cells: [
    { column_id: 'provision', text: 'acts of war', component_ids: ['mae-war-c'] },
    { column_id: 'disproportionateCarveback', code: 'YES', component_ids: ['mae-war-x'] },
  ] }, 'acts of war');
  const carveback = maeFact('mae-cb', 'DISPROPORTIONALITY_CARVEBACK', 'carve-back', { table_key: 'mae-carveouts-company', row_label: 'Disproportionate carve-back', cells: [{ column_id: 'provision', text: 'except to the extent disproportionate', component_ids: ['mae-cb-c'] }] }, 'except to the extent disproportionate');
  const view = buildTableView({ facts: [gaap, war, carveback], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'mae-carveouts-company');
  assert.deepEqual(table.rows.map((row) => row.subject), ['Changes in GAAP or accounting principles', 'Acts of war, armed hostilities, or terrorism']);
  const gaapCell = table.rows[0].cells.find((cell) => cell.column_id === 'disproportionateCarveback');
  assert.equal(gaapCell.label, 'No');
  assert.equal(gaapCell.code, 'NO');
  assert.equal(gaapCell.defaulted, true);
  assert.equal(table.rows[1].cells.find((cell) => cell.column_id === 'disproportionateCarveback').label, 'Yes');
  assert.equal(table.footer.label, 'Disproportionate carve-back as drafted');
  assert.deepEqual(table.footer.entries.map((entry) => [entry.fact_id, entry.text]), [['mae-cb', 'except to the extent disproportionate']]);
});

test('a fact_text detail column shows the fact\'s own words as drafted, not the cited fragment', () => {
  const fact = {
    fact_id: 'cond-nlr', proposal_id: 'cond-nlr', family_key: 'CLOSING_CONDITIONS', subtype_key: 'NO_LEGAL_RESTRAINT', section_reference: '7.01(b)', structure_node_id: 'n-7-01',
    headline: { label: 'No legal restraint', distinguishing_component_ids: ['nlr-3'] },
    components: [
      { component_id: 'nlr-0', kind: 'ACTOR', label: 'obligation', text: 'The respective obligation of each party', origin: 'ANCESTOR', source_span_id: 's', start_byte: 0, end_byte: 5, gap_before: false, children: [] },
      { component_id: 'nlr-1', kind: 'ACTOR', label: 'restraint', text: 'No Judgment issued by any court of competent jurisdiction or Law enacted by any Governmental Entity', origin: 'OWN', source_span_id: 's', start_byte: 10, end_byte: 20, gap_before: false, children: [
        { component_id: 'nlr-1a', kind: 'LIST_ELEMENT', label: 'court', text: 'any court of competent jurisdiction', origin: 'OWN', source_span_id: 's', start_byte: 12, end_byte: 14, gap_before: false, children: [] },
      ] },
      { component_id: 'nlr-2', kind: 'OBJECT', label: 'effect', text: 'preventing or prohibiting the consummation of the Merger', origin: 'OWN', source_span_id: 's', start_byte: 20, end_byte: 30, gap_before: false, children: [] },
      { component_id: 'nlr-3', kind: 'OPERATION', label: 'test', text: 'shall be in effect', origin: 'OWN', source_span_id: 's', start_byte: 30, end_byte: 40, gap_before: false, children: [] },
    ],
    conclusions: { table_key: 'conditions-table', row_label: 'No Legal Restraint', cells: [{ column_id: 'detail', text: 'shall be in effect', component_ids: ['nlr-3'] }] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'conditions-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'detail');
  assert.equal(cell.label, 'No Judgment issued by any court of competent jurisdiction or Law enacted by any Governmental Entity preventing or prohibiting the consummation of the Merger shall be in effect');
  assert.deepEqual(cell.component_ids, ['nlr-3'], 'the cited words stay the click target');
});

test('two readings in one cell come out in source order, and a fact_text line shows each alternative in full', () => {
  const closing = (id, start, text, cited) => ({
    fact_id: id, proposal_id: id, family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'CLOSING_MECHANICS', section_reference: '1.02', structure_node_id: 'n-1-02',
    headline: { label: 'Closing', distinguishing_component_ids: [`${id}-c`] },
    components: [{ component_id: `${id}-c`, kind: 'TERM', label: 'place', text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [] }],
    conclusions: { table_key: 'structure-mechanics-table', row_label: 'The deal', cells: [{ column_id: 'closingLocation', text: cited, component_ids: [`${id}-c`] }] },
  });
  const other = closing('cl-other', 120, 'such other place, time and date as Parent and the Company may agree in writing', 'such other place, time and date');
  const offices = closing('cl-offices', 20, 'at the offices of Wachtell, Lipton, Rosen & Katz', 'at the offices of Wachtell, Lipton, Rosen & Katz');
  const view = buildTableView({ facts: [other, offices], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'closingLocation');
  assert.deepEqual(cell.values.map((value) => value.label), [
    'at the offices of Wachtell, Lipton, Rosen & Katz',
    'such other place, time and date as Parent and the Company may agree in writing',
  ]);
  assert.equal(cell.label, 'at the offices of Wachtell, Lipton, Rosen & Katz');
});

test('equity award treatment classes nest under the instrument row in detail_labels order, the instrument row giving the overview', () => {
  const award = (id, detail, code) => ({
    fact_id: id, proposal_id: id, family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD', section_reference: '2.03', structure_node_id: 'n-2-03',
    headline: { label: 'Equity award', distinguishing_component_ids: [`${id}-c`] },
    components: [{ component_id: `${id}-c`, kind: 'OPERATION', label: 'treatment', text: 'shall be cancelled', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] }],
    conclusions: { table_key: 'equity-awards-table', row_label: 'Company Stock Option', ...(detail ? { row_detail: detail } : {}), cells: [{ column_id: 'cvrEntitlement', code, component_ids: [`${id}-c`] }] },
  });
  const facts = [
    award('eq-otm', 'Out of the money (exercise price at or above the deal price)', 'NOT_ENTITLED'),
    award('eq-vested', 'Vested', 'ENTITLED'),
    award('eq-all', null, 'ENTITLED'),
  ];
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'equity-awards-table');
  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].subject, 'Company Stock Option');
  assert.deepEqual(table.rows[0].sub_rows.map((row) => row.subject), ['Vested', 'Out of the money (exercise price at or above the deal price)']);
  assert.equal(table.rows[0].cells.find((cell) => cell.column_id === 'cvrEntitlement').values.length, 2, 'the overview keeps both readings');
});

test('per-share consideration rows are named from the form code, so two facts about cash share the Cash row', () => {
  const limb = (id, code, text) => ({
    fact_id: id, proposal_id: id, family_key: 'CONSIDERATION', subtype_key: 'CASH_COMPONENT', section_reference: '2.01(c)', structure_node_id: 'n-2-01',
    headline: { label: 'Cash component', distinguishing_component_ids: [`${id}-c`] },
    components: [{ component_id: `${id}-c`, kind: 'AMOUNT', label: 'amount', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: text.length, gap_before: false, children: [] }],
    conclusions: { table_key: 'consideration-components', row_label: text, cells: [{ column_id: 'form', code, component_ids: [`${id}-c`] }] },
  });
  const view = buildTableView({ facts: [limb('cash-a', 'CASH', '$47.50 in cash'), limb('cash-b', 'CASH', 'an amount of cash')], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'consideration-components');
  assert.deepEqual(table.rows.map((row) => row.subject), ['Cash']);
  assert.equal(table.rows[0].backing_facts.length, 2);
});

test('two codes on one vocabulary column render as one cell with two readings', () => {
  const fact = {
    fact_id: 'rep-3', proposal_id: 'rep-3', family_key: 'REPRESENTATIONS', subtype_key: 'COMPLIANCE_REPRESENTATION', section_reference: '3.25', structure_node_id: 'n-3-25',
    headline: { label: 'Compliance', distinguishing_component_ids: ['k'] },
    components: [
      { component_id: 'k', kind: 'QUALIFIER', label: 'knowledge', text: 'to the knowledge of the Company', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 31, gap_before: false, children: [] },
      { component_id: 'm', kind: 'MATERIALITY_QUALIFIER', label: 'materiality', text: 'except as would not be material', origin: 'OWN', source_span_id: 's', start_byte: 40, end_byte: 72, gap_before: false, children: [] },
    ],
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'Compliance with Laws; Permits; Licenses', cells: [
      { column_id: 'materiality', code: 'KNOWLEDGE_QUALIFIED_PARTIAL', component_ids: ['k'] },
      { column_id: 'materiality', code: 'MATERIAL_TO_THE_REP_PARTIAL', component_ids: ['m'] },
    ] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'representations-qualifiers-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'materiality');
  assert.equal(cell.values.length, 2);
  assert.deepEqual(cell.values.map((value) => value.code), ['KNOWLEDGE_QUALIFIED_PARTIAL', 'MATERIAL_TO_THE_REP_PARTIAL']);
});
