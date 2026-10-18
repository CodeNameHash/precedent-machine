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
  assert.deepEqual(keys, ['material-contracts', 'mae-definitions', 'termination-fees', 'misc-boilerplate'], 'the old app\'s order (decision 27)');
});

test('a coverage-only fact reaches its precedent row; its section is flagged coverage_only so the page starts it collapsed (decision 34)', () => {
  const misc = section('misc-boilerplate');
  assert.equal(misc.coverage_only, true);
  assert.equal(section('termination-fees').coverage_only, undefined);
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
  // provision (a detail column) was not supplied by the conclusion and no
  // row carries a summary, so the column is dropped from the table (Ben,
  // 2026-09-14: "can we kill 'as drafted' columns throughout").
  assert.equal(byColumn.provision, undefined);
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
  // Work package 12: a column no line of the table fills is not rendered.
  assert.equal(byColumn.trigger, undefined);
  assert.equal(byColumn.provision, undefined);
  assert.deepEqual(terminationFees.hidden_columns.map((column) => `${column.column_id}:${column.reason}`), ['provision:empty', 'trigger:empty']);

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
  assert.match(term.definition, /^any Contract/, 'the definition without its "means" (Ben, 2026-09-14: term on the left, definition on the right)');
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
  assert.equal(table.rows[0].cells.find((candidate) => candidate.column_id === 'closingTiming'), undefined, 'the detail column without a summary is dropped');
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
  // Ben, 2026-09-14: "can we kill 'as drafted' columns throughout - the
  // whole point is to only summarize the key parts!!": a detail column
  // with no summary in any row is dropped from the table.
  assert.equal(table.rows[0].cells.find((candidate) => candidate.column_id === 'closingTiming'), undefined);
  assert.ok(!table.columns.some((column) => column.column_id === 'closingTiming'));
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
  assert.equal((materiality.values || [materiality]).length, 1, 'the row line is the general-case fact, not a merge with its limb (Ben, 2026-09-14)');
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
  assert.equal(reps.rows[0].cells.find((cell) => cell.column_id === 'bringdown'), undefined, 'empty on every row: not rendered (work package 12)');
  assert.ok(reps.hidden_columns.some((column) => column.column_id === 'bringdown' && column.reason === 'empty'));
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
  // One fact, one column-made sub-item: the row is the line (Metsera
  // generation 6, 7.02: Performance of Covenants repeated beneath itself).
  const alone = buildTableView({ facts: [facts[0]], tableShapes, legalSchema });
  const aloneRow = alone.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'conditions-b-table').rows[0];
  assert.equal(aloneRow.sub_rows, undefined);
  assert.equal(aloneRow.cells.find((cell) => cell.column_id === 'standard').label, 'True except for de minimis inaccuracies');
  // A fact with no readout takes the row its fact type names (the page
  // applies the extractor's default; Metsera generation 6, 7.02).
  const certificate = { fact_id: 'cert', proposal_id: 'cert', family_key: 'CLOSING_CONDITIONS', subtype_key: 'OFFICER_CERTIFICATE', fact_type: 'OFFICER_CERTIFICATE_REQUIRED', section_reference: '7.02', statement: 'The respective obligation of Parent and Merger Sub to effect the Merger is subject to a certificate.', headline: { label: 'Officer certificate', distinguishing_component_ids: [] }, components: [] };
  const withDefault = buildTableView({ facts: [...facts, certificate], tableShapes, legalSchema });
  const bTable = withDefault.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'conditions-b-table');
  assert.ok(bTable.rows.find((candidate) => candidate.subject === "Officer's Certificate" && !candidate.absent && candidate.backing_facts.some((b) => b.fact_id === 'cert')));
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
  // Rows follow the precedent's fixed order (decision 34), not arrival order.
  assert.deepEqual(table.rows.map((row) => row.subject), ['Acts of war, armed hostilities, or terrorism', 'Changes in GAAP or accounting principles']);
  const gaapCell = table.rows[1].cells.find((cell) => cell.column_id === 'disproportionateCarveback');
  assert.equal(gaapCell.label, 'No');
  assert.equal(gaapCell.code, 'NO');
  assert.equal(gaapCell.defaulted, true);
  assert.equal(table.rows[0].cells.find((cell) => cell.column_id === 'disproportionateCarveback').label, 'Yes');
  assert.equal(table.footer.label, 'Carve-back provisos as drafted');
  // The footer shows the carve-back as drafted (its own words in full), not the cited fragment (decision 34).
  assert.deepEqual(table.footer.entries.map((entry) => [entry.fact_id, entry.text]), [['mae-cb', 'except to the extent disproportionate clauses (i) through (iv)']]);
});

// Metsera generation 7, 2026-09-14: the underlying-cause proviso had no
// readout and no place on the page. It is the second proviso under the
// carve-out table, as drafted; a footer fact needs no readout.
test('the underlying-cause proviso joins the carve-back under the carve-out table without a readout', () => {
  const carveback = maeFact('mae-cb', 'DISPROPORTIONALITY_CARVEBACK', 'carve-back', { table_key: 'mae-carveouts-company', row_label: 'Disproportionate carve-back', cells: [{ column_id: 'provision', text: 'except to the extent disproportionate', component_ids: ['mae-cb-c'] }] }, 'except to the extent disproportionate');
  const underlying = maeFact('mae-uc', 'UNDERLYING_CAUSE_RESTORATION', 'underlying cause', null, 'it being understood that the underlying facts giving rise to such failure may be taken into account');
  delete underlying.conclusions;
  const view = buildTableView({ facts: [carveback, underlying], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'mae-carveouts-company');
  assert.deepEqual(table.rows.filter((row) => !row.absent), []);
  assert.deepEqual(table.footer.entries.map((entry) => entry.fact_id), ['mae-cb', 'mae-uc']);
  assert.match(table.footer.entries[1].text, /underlying facts giving rise/);
  const maeSection = view.sections.find((section) => section.tables.some((candidate) => candidate.table_key === 'mae-carveouts-company'));
  assert.deepEqual((maeSection.facts_without_readout || []).map((entry) => entry.fact_id), []);
});

test('a fact_text detail column shows the fact\'s operative words, not the cited fragment', () => {
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
  fact.headline.summary = 'No court order or law blocks the Merger';
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'conditions-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'detail');
  // Ben, 2026-09-14: "kill 'as drafted' columns throughout ... only
  // summarize the key parts": the detail column shows the fact's summary.
  assert.equal(cell.label, 'No court order or law blocks the Merger');
  assert.deepEqual(cell.component_ids, ['nlr-3'], 'the cited words stay the click target');
});

// Ben, 2026-09-14: "we shouldn't just be dumping in the full text in the
// summary". The closing timing cell shows the operative core and the
// distinguishing time and period, not the Article VII qualifier, the
// exception or the proviso.
test('an as-drafted cell shows the operative core plus the distinguishing components, with an ellipsis for skipped words', () => {
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  const fact = {
    fact_id: 'cl-1', proposal_id: 'cl-1', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'CLOSING', section_reference: '1.02', structure_node_id: 'n-1-02',
    headline: { label: 'Closing', distinguishing_component_ids: ['time', 'period'] },
    components: [
      component('qual', 'QUALIFIER', 'Subject to the provisions of Article VII', 0),
      component('actor', 'ACTOR', 'the closing (the “Closing”) of the Merger', 42),
      component('op', 'OPERATION', 'shall take place', 84),
      component('time', 'DATE', 'at 8:00 a.m., New York City time', 101),
      component('period', 'PERIOD', 'on the third (3rd) business day', 134),
      component('trigger', 'TRIGGER', 'after the satisfaction or waiver of the conditions set forth in Article VII', 166),
      component('exc', 'EXCEPTION', 'other than those conditions that by their nature are to be satisfied at the Closing', 242),
      { ...component('chapeau', 'QUALIFIER', 'On the terms of this Agreement', 400), origin: 'CHAPEAU' },
    ],
    conclusions: { table_key: 'structure-mechanics-table', row_label: 'The deal', cells: [{ column_id: 'closingTiming', text: 'on the third (3rd) business day', component_ids: ['time', 'period', 'trigger'] }] },
  };
  fact.headline.summary = 'Closing on the third business day after the conditions are satisfied';
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'closingTiming');
  // The cell shows the summary; factSummaryText stays the sidebar's and the
  // footer's operative-core text (asserted below on the function).
  assert.equal(cell.label, 'Closing on the third business day after the conditions are satisfied');
  assert.equal(factSummaryText(fact), 'the closing (the “Closing”) of the Merger shall take place at 8:00 a.m., New York City time on the third (3rd) business day');
  assert.deepEqual(cell.component_ids, ['time', 'period', 'trigger'], 'the cited words stay the click target');
  // A distinguishing component after skipped words is joined with an ellipsis.
  fact.headline.distinguishing_component_ids = ['exc'];
  assert.equal(factSummaryText(fact), 'the closing (the “Closing”) of the Merger shall take place … other than those conditions that by their nature are to be satisfied at the Closing');
});

// Ben, 2026-09-14: "this portion is stated to be a fact without a coded
// readout but it is part of the structuring that describes a reverse
// triangular merger so it is used". A one-row table's fact with no cell
// backs the row instead of being listed as evidence without a readout.
test('a one-per-agreement fact without a readout backs the row rather than the without-readout list', () => {
  const ceases = {
    fact_id: 'ce-1', proposal_id: 'ce-1', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'LEGAL_EFFECT', section_reference: '1.01', structure_node_id: 'n-1-01',
    headline: { label: 'Legal effect', distinguishing_component_ids: ['ce-op'] },
    components: [
      { component_id: 'ce-actor', kind: 'ACTOR', label: 'entity', text: 'the separate corporate existence of Merger Sub', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 46, gap_before: false, children: [] },
      { component_id: 'ce-op', kind: 'OPERATION', label: 'ceases', text: 'shall cease', origin: 'OWN', source_span_id: 's', start_byte: 47, end_byte: 58, gap_before: false, children: [] },
    ],
  };
  const merger = {
    fact_id: 'mg-1', proposal_id: 'mg-1', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'TRANSACTION_STEP', section_reference: '1.01', structure_node_id: 'n-1-01',
    headline: { label: 'Transaction step', distinguishing_component_ids: ['mg-op'] },
    components: [
      { component_id: 'mg-actor', kind: 'ACTOR', label: 'merging party', text: 'Merger Sub', origin: 'OWN', source_span_id: 's', start_byte: 100, end_byte: 110, gap_before: false, children: [] },
      { component_id: 'mg-op', kind: 'OPERATION', label: 'merger', text: 'shall be merged with and into', origin: 'OWN', source_span_id: 's', start_byte: 111, end_byte: 140, gap_before: false, children: [] },
      { component_id: 'mg-obj', kind: 'OBJECT', label: 'merged into', text: 'the Company', origin: 'OWN', source_span_id: 's', start_byte: 141, end_byte: 152, gap_before: false, children: [] },
      { component_id: 'mg-term', kind: 'TERM', label: 'survivor', text: 'the Company shall continue as the surviving corporation', origin: 'OWN', source_span_id: 's', start_byte: 160, end_byte: 210, gap_before: true, children: [] },
    ],
    conclusions: { table_key: 'structure-mechanics-table', row_label: 'The deal', cells: [{ column_id: 'mergerFormStep1', code: 'REVERSE_TRIANGULAR_MERGER', component_ids: ['mg-actor', 'mg-op', 'mg-obj', 'mg-term'] }] },
  };
  const view = buildTableView({ facts: [ceases, merger], tableShapes, legalSchema });
  const section = view.sections.find((candidate) => candidate.tables.some((table) => table.table_key === 'structure-mechanics-table'));
  const table = section.tables.find((candidate) => candidate.table_key === 'structure-mechanics-table');
  assert.equal(table.rows.length, 1);
  assert.deepEqual(table.rows[0].backing_facts.map((entry) => entry.fact_id).sort(), ['ce-1', 'mg-1']);
  assert.equal((section.facts_without_readout || []).length, 0);
});

// Ben, 2026-09-14: "this says nothing - needs to say which entity is the
// surviving entity". The party column names the actor with the term after it.
test('a party column names the entity, with the cited defined term after it', () => {
  const fact = {
    fact_id: 'sv-1', proposal_id: 'sv-1', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'LEGAL_EFFECT', section_reference: '1.01', structure_node_id: 'n-1-01',
    headline: { label: 'Legal effect', distinguishing_component_ids: ['sv-term'] },
    components: [
      { component_id: 'sv-actor', kind: 'ACTOR', label: 'continuing entity', text: 'the Company', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 11, gap_before: false, children: [] },
      { component_id: 'sv-op', kind: 'OPERATION', label: 'continues', text: 'shall continue as the surviving corporation', origin: 'OWN', source_span_id: 's', start_byte: 12, end_byte: 55, gap_before: false, children: [] },
      { component_id: 'sv-term', kind: 'TERM', label: 'defined term', text: 'the “Surviving Corporation”', origin: 'OWN', source_span_id: 's', start_byte: 57, end_byte: 84, gap_before: false, children: [] },
    ],
    conclusions: { table_key: 'structure-mechanics-table', row_label: 'the Merger', cells: [{ column_id: 'survivingEntityStep1', text: 'the “Surviving Corporation”', component_ids: ['sv-term'] }] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'survivingEntityStep1');
  assert.equal(cell.label, 'the Company (the “Surviving Corporation”)');
  assert.deepEqual(cell.component_ids, ['sv-term']);
});

// Ben, 2026-09-14: "the term should [be] in [the] LH column and the
// definition on RH".
test('defined terms split into the quoted term and its definition, whatever shape the component takes', () => {
  const { definedTermParts } = require('../lib/product/table-view');
  const fact = { fact_id: 'dt', components: [
    { component_id: 'cash', kind: 'OBJECT', label: 'cash', text: '$47.50 in cash, without interest', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 32, children: [] },
    { component_id: 'closing-amount', kind: 'DEFINED_TERM', label: 'Closing Amount', text: 'the “Closing Amount”', origin: 'OWN', source_span_id: 's', start_byte: 34, end_byte: 54, children: [] },
    { component_id: 'shares', kind: 'ACTOR', label: 'shares', text: 'shares of Company Common Stock held by any Person who is entitled to demand appraisal', origin: 'OWN', source_span_id: 's', start_byte: 60, end_byte: 140, children: [
      { component_id: 'appraisal-shares', kind: 'DEFINED_TERM', label: 'Appraisal Shares', text: '(such shares, “Appraisal Shares”)', origin: 'OWN', source_span_id: 's', start_byte: 141, end_byte: 174, children: [] },
    ] },
    { component_id: 'cvr-agreement', kind: 'DEFINED_TERM', label: 'CVR Agreement', text: '“CVR Agreement” means the Contingent Value Rights Agreement between Parent and the Rights Agent.', origin: 'DEFINITION', source_span_id: 'd', start_byte: 0, end_byte: 90, resolves_to: { text: '“CVR Agreement” means the Contingent Value Rights Agreement between Parent and the Rights Agent.' }, children: [] },
    { component_id: 'bday', kind: 'DEFINED_TERM', label: 'Business day', text: 'A “business day” means any day on which the principal offices of the SEC are open.', origin: 'DEFINITION', source_span_id: 'd', start_byte: 100, end_byte: 180, resolves_to: { text: 'business day' }, children: [] },
  ] };
  const parts = (id) => definedTermParts(fact.components.flatMap((c) => [c, ...(c.children || [])]).find((c) => c.component_id === id), fact);
  // Work package 13: each part says where its definition came from; an
  // inline guess is not a Defined Terms entry on its own.
  assert.deepEqual(parts('closing-amount'), { term: 'Closing Amount', definition: '$47.50 in cash, without interest', source: 'inline' });
  assert.deepEqual(parts('appraisal-shares'), { term: 'Appraisal Shares', definition: 'shares of Company Common Stock held by any Person who is entitled to demand appraisal', source: 'inline' });
  assert.deepEqual(parts('cvr-agreement'), { term: 'CVR Agreement', definition: 'the Contingent Value Rights Agreement between Parent and the Rights Agent', source: 'resolves_to' }, 'the model gave resolves_to: it comes first');
  assert.deepEqual(parts('bday'), { term: 'business day', definition: 'any day on which the principal offices of the SEC are open', source: 'defines' });
});

// Work package 13 (plan finding (79)), NCS generation 5, 1.2 and 2.1: the
// Defined Terms fallback took non-definition facts whose tree carries a
// DEFINED_TERM component and showed an arbitrary component as the
// definition ("Tolling Period: shall not occur on any date that falls
// on..."; "Closing Date: is referred to in this Agreement as").
test('a non-definition fact enters Defined Terms only through a DEFINED_TERM that resolves to its definition, and the entry is the definition words', () => {
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  const closing = {
    fact_id: 'closing', proposal_id: 'closing', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'CLOSING', fact_type: 'CLOSING_TIMING', section_reference: '1.2', structure_node_id: 'n', validation_status: 'VALID',
    headline: { label: 'Closing', distinguishing_component_ids: [], summary: 'Closing may not occur during the Rewind Tolling Period' },
    components: [
      component('c-op', 'OPERATION', 'the Closing shall not occur on any date that falls on, or between, the dates of the Irish High Court hearing', 0, { children: [
        component('c-term', 'DEFINED_TERM', '(inclusive of both dates) (such period, the “Tolling Period”)', 120, { resolves_to: { structure_node_id: 'n', text: 'any date that falls on, or between, the date(s) of the Irish High Court hearing to sanction the Rewind' } }),
      ] }),
    ],
  };
  const closingDate = {
    ...closing, fact_id: 'closing-date', proposal_id: 'closing-date', headline: { label: 'Closing', distinguishing_component_ids: [], summary: 'The date the Closing occurs is the Closing Date' },
    components: [component('cd-op', 'OPERATION', 'is referred to in this Agreement as', 0), component('cd-term', 'DEFINED_TERM', 'the “Closing Date”', 40, { resolves_to: { structure_node_id: 'n', text: 'The date on which the Closing occurs' } })],
  };
  const guessOnly = {
    ...closing, fact_id: 'guess', proposal_id: 'guess', headline: { label: 'Closing', distinguishing_component_ids: [], summary: 'Default Stock receives the Share Consideration' },
    components: [component('g-op', 'OPERATION', 'with respect to which no election has been made', 0, { children: [component('g-term', 'DEFINED_TERM', '(the “Default Stock”)', 60)] })],
  };
  const view = buildTableView({ facts: [closing, closingDate, guessOnly], tableShapes, legalSchema });
  const terms = Object.fromEntries(view.defined_terms.map((entry) => [entry.term, entry.definition]));
  assert.equal(terms['Tolling Period'], 'any date that falls on, or between, the date(s) of the Irish High Court hearing to sanction the Rewind');
  assert.equal(terms['Closing Date'], 'The date on which the Closing occurs');
  assert.equal('Default Stock' in terms, false, 'an inline guess is no entry');
  // The guess-only fact is still the section's evidence, not lost.
  assert.ok(view.sections.some((section) => section.facts_without_readout.some((entry) => entry.fact_id === 'guess') || section.tables.some((table) => table.rows.some((row) => row.backing_facts.some((entry) => entry.fact_id === 'guess')))));
});

// Ben, 2026-09-14: "I'd put them under the word 'cash' and 'CVR' in
// component and also present the combined definition".
test('the per-share grid shows the defined term under the component and the package term as a combined definition', () => {
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  const cash = {
    fact_id: 'cash', proposal_id: 'cash', family_key: 'CONSIDERATION', subtype_key: 'CASH_COMPONENT', section_reference: '2.01', structure_node_id: 'n',
    headline: { label: 'Cash component', distinguishing_component_ids: ['cash-amt'] },
    components: [component('cash-obj', 'OBJECT', '$47.50 in cash', 0), component('cash-amt', 'AMOUNT', '$47.50', 0), component('cash-term', 'DEFINED_TERM', 'the “Closing Amount”', 40)],
    conclusions: { table_key: 'consideration-components', row_label: 'Cash', cells: [
      { column_id: 'form', code: 'CASH', component_ids: ['cash-obj'] },
      { column_id: 'definedAs', text: 'the “Closing Amount”', component_ids: ['cash-term'] },
    ] },
  };
  const pack = {
    fact_id: 'pack', proposal_id: 'pack', family_key: 'CONSIDERATION', subtype_key: 'CONSIDERATION_PACKAGE', section_reference: '2.01', structure_node_id: 'n', validation_status: 'VALID',
    headline: { label: 'Consideration package', distinguishing_component_ids: ['pack-term'] },
    components: [component('pack-actor', 'ACTOR', 'each issued and outstanding share of Company Common Stock', 100), component('pack-op', 'OPERATION', 'shall be converted into the right to receive', 160), component('pack-obj', 'OBJECT', '(i) $47.50 in cash and (ii) one CVR', 205), component('pack-term', 'DEFINED_TERM', '(clauses (i) and (ii), collectively, the “Merger Consideration”)', 245)],
    conclusions: { table_key: 'consideration-structure', row_label: 'the Merger', cells: [{ column_id: 'considerationType', code: 'CASH_AND_CVR', component_ids: ['pack-obj'] }] },
  };
  const view = buildTableView({ facts: [cash, pack], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'consideration-components');
  assert.equal(table.columns.some((column) => column.column_id === 'definedAs'), false, 'the defined term is not a column');
  assert.equal(table.columns.some((column) => column.column_id === 'contingency'), false, 'the as-drafted column is gone');
  assert.equal(table.rows[0].subject, 'Cash');
  assert.equal(table.rows[0].subject_note, 'the “Closing Amount”');
  assert.equal(table.combined_definition.label, 'Combined definition');
  assert.equal(table.combined_definition.term, 'Merger Consideration');
  assert.match(table.combined_definition.text, /^each issued and outstanding share of Company Common Stock .*shall be converted into the right to receive \(i\) \$47.50 in cash and \(ii\) one CVR/);
  assert.equal(table.combined_definition.fact_id, 'pack');
});

// Ben, 2026-09-14, on the Article III introduction rendered as seven
// status and document representations: "all of this is miscoded. THis is
// the standard intro to the reps that provides the exceptions for all reps
// - look at the old system - we should be able to show the reader the
// general categories of the exceptions (SEC filings) and as they click
// into deeper levels show more detail (last X days) etc"; and today: "by
// miscoded I meant oyu currentl have it messed up and you need to move it
// over to what we had in the old vesrion....". The old version's table
// opened with a General Exceptions row (SEC Filings: cut-off, portions
// excluded; Disclosure Letter) and a Knowledge row (Standard, Persons).
const introComponent = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 'intro', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
const introFact = (id, subtype, components, reference = 'III-INTRO') => ({
  fact_id: id, proposal_id: id, family_key: 'REPRESENTATIONS', subtype_key: subtype, section_reference: reference, structure_node_id: `n-${reference}`, validation_status: 'VALID',
  headline: { label: 'Document representation', distinguishing_component_ids: [components[0].component_id] },
  components,
});

test('generation 6 article-introduction facts land on the General Exceptions row: SEC Filings with its cut-off and excluded portions, Disclosure Letter with its arrangement rule, the rest under Other', () => {
  const window = introFact('intro-window', 'DOCUMENT_REPRESENTATION', [
    introComponent('w-exc', 'EXCEPTION', 'Except as disclosed in', 0),
    introComponent('w-obj', 'OBJECT', 'filed by the Company with, or furnished by the Company to, the Securities and Exchange Commission (the “SEC”)', 30),
    introComponent('w-period', 'PERIOD', 'at least one (1) business day prior to the date of this Agreement', 150),
  ]);
  const excluded = introFact('intro-excluded', 'DOCUMENT_REPRESENTATION', [
    introComponent('x-exc', 'EXCEPTION', '(excluding any exhibits to any Filed Company SEC Documents', 300),
    introComponent('x-list', 'LIST', 'disclosures contained in any part of any Filed Company SEC Document entitled “Risk Factors,” disclosures of risks set forth in any “Forward-Looking Statements” disclaimer', 360, { children: [
      introComponent('x-risk', 'LIST_ELEMENT', '“Risk Factors,”', 420),
      introComponent('x-fls', 'LIST_ELEMENT', 'disclosures of risks set forth in any “Forward-Looking Statements” disclaimer', 440),
    ] }),
  ]);
  const carveBack = introFact('intro-carve-back', 'DOCUMENT_REPRESENTATION', [
    introComponent('c-actor', 'ACTOR', 'specific historical factual information contained within such headings, disclosures or statements', 600),
    introComponent('c-op', 'OPERATION', 'shall not be excluded)', 700),
  ]);
  const letter = introFact('intro-letter', 'DOCUMENT_REPRESENTATION', [
    introComponent('l-actor', 'ACTOR', '(the “Company Disclosure Letter”)', 800),
    introComponent('l-op', 'OPERATION', '(which shall be arranged in numbered and lettered sections', 840),
  ]);
  const other = introFact('intro-other', 'STATUS_REPRESENTATION', [
    introComponent('o-actor', 'ACTOR', 'the Company', 900),
    introComponent('o-op', 'OPERATION', 'represents and warrants', 912),
  ]);
  const view = buildTableView({ facts: [window, excluded, carveBack, letter, other], tableShapes, legalSchema });
  const section = view.sections.find((candidate) => candidate.section_key === 'representations-qualifiers');
  assert.ok(section, 'the representations section renders');
  assert.equal((section.facts_without_readout || []).length, 0);
  assert.equal(section.tables.length, 1, 'the separate general-qualifications table is retired');
  const table = section.tables[0];
  assert.equal(table.table_key, 'representations-qualifiers-table');
  assert.equal(table.rows[0].subject, 'General Exceptions', 'the first row of the table');
  const row = table.rows[0];
  assert.deepEqual(row.sub_rows.map((sub) => sub.subject), ['SEC Filings', 'Disclosure Letter', 'Other']);
  const cellOf = (line, columnId) => line.cells.find((cell) => cell.column_id === columnId);
  const labels = (cell) => (cell.values ? cell.values.map((value) => value.label) : [cell.label]);
  const sec = row.sub_rows[0];
  assert.deepEqual(labels(cellOf(sec, 'materiality')).sort(), ['Exhibits excluded', 'Forward-looking statements excluded', 'Risk Factors excluded', 'Specific historical facts still count']);
  assert.equal(cellOf(sec, 'lookback').label, '1 business day', 'the cut-off parsed from the PERIOD component');
  assert.deepEqual(cellOf(sec, 'lookback').component_ids, ['w-period']);
  assert.deepEqual(sec.backing_facts.map((entry) => entry.fact_id), ['intro-window', 'intro-excluded', 'intro-carve-back']);
  const fls = cellOf(sec, 'materiality').values.find((value) => value.code === 'EXCLUDES_FORWARD_LOOKING_STATEMENTS');
  assert.ok(fls.component_ids.includes('x-fls'), 'the code cites the words that name it');
  const disclosure = row.sub_rows[1];
  assert.deepEqual(labels(cellOf(disclosure, 'materiality')), ['Arranged by section']);
  assert.deepEqual(disclosure.backing_facts.map((entry) => entry.fact_id), ['intro-letter']);
  assert.deepEqual(row.sub_rows[2].backing_facts.map((entry) => entry.fact_id), ['intro-other']);
  // The row's own line is the overview of its sub-items: the categories
  // first, the detail on opening.
  assert.ok(labels(cellOf(row, 'materiality')).includes('Risk Factors excluded'));
  assert.equal(cellOf(row, 'lookback').label, '1 business day');
});

test('the introduction of the Parent article goes to the Parent representations table', () => {
  const parentIntro = introFact('iv-intro', 'STATUS_REPRESENTATION', [
    introComponent('p-exc', 'EXCEPTION', 'Except as set forth in the Parent Disclosure Letter', 0),
    introComponent('p-actor', 'ACTOR', 'Parent and Merger Sub', 60),
    introComponent('p-op', 'OPERATION', 'jointly and severally represent and warrant', 82),
  ], 'IV-INTRO');
  const view = buildTableView({ facts: [parentIntro], tableShapes, legalSchema });
  assert.equal(view.sections.some((candidate) => candidate.section_key === 'representations-qualifiers'), false);
  const parent = view.sections.find((candidate) => candidate.section_key === 'parent-representations-qualifiers');
  assert.equal(parent.tables[0].rows[0].subject, 'General Exceptions');
  assert.deepEqual(parent.tables[0].rows[0].sub_rows.map((sub) => sub.subject), ['Disclosure Letter']);
});

test('a REPRESENTATION_QUALIFICATION readout coded to the General Exceptions row renders as the extractor wrote it', () => {
  const coded = {
    ...introFact('coded-sec', 'REPRESENTATION_QUALIFICATION', [
      introComponent('k-date', 'DATE', 'filed or furnished on or after January 1, 2023', 0),
      introComponent('k-risk', 'LIST_ELEMENT', '“Risk Factors”', 60),
    ]),
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'General Exceptions', row_detail: 'SEC Filings', cells: [
      { column_id: 'materiality', code: 'EXCLUDES_RISK_FACTORS', component_ids: ['k-risk'] },
      { column_id: 'lookback', value: { canonical: '2023-01-01', unit: 'ISO_DATE' }, component_ids: ['k-date'] },
    ] },
  };
  const view = buildTableView({ facts: [coded], tableShapes, legalSchema });
  const row = view.sections.find((candidate) => candidate.section_key === 'representations-qualifiers').tables[0].rows[0];
  assert.equal(row.subject, 'General Exceptions');
  assert.equal(row.sub_rows[0].subject, 'SEC Filings');
  assert.equal(row.sub_rows[0].cells.find((cell) => cell.column_id === 'lookback').label, 'January 1, 2023');
  assert.equal(row.sub_rows[0].cells.find((cell) => cell.column_id === 'materiality').label, 'Risk Factors excluded');
});

test('the Knowledge definition lands on the Knowledge row: the standard under Standard, whose knowledge counts under Persons', () => {
  const knowledge = {
    fact_id: 'def-knowledge', proposal_id: 'def-knowledge', family_key: 'KEY_DEFINED_TERMS', subtype_key: 'KNOWLEDGE', section_reference: '9.03', structure_node_id: 'n-9-03', validation_status: 'VALID',
    headline: { label: 'Knowledge', distinguishing_component_ids: ['kn-std'] },
    components: [
      introComponent('kn-term', 'DEFINED_TERM', '“Knowledge of the Company” means', 0),
      introComponent('kn-std', 'STANDARD', 'the actual knowledge, after reasonable inquiry,', 40),
      introComponent('kn-persons', 'ACTOR', 'of the individuals listed in Section 9.03 of the Company Disclosure Letter', 90),
    ],
  };
  const view = buildTableView({ facts: [knowledge], tableShapes, legalSchema });
  const section = view.sections.find((candidate) => candidate.section_key === 'representations-qualifiers');
  const row = section.tables[0].rows[0];
  assert.equal(row.subject, 'Knowledge');
  assert.deepEqual(row.sub_rows.map((sub) => sub.subject), ['Standard', 'Persons']);
  const labels = (line) => { const cell = line.cells.find((candidate) => candidate.column_id === 'materiality'); return cell.values ? cell.values.map((value) => value.label) : [cell.label]; };
  assert.deepEqual(labels(row.sub_rows[0]).sort(), ['Actual knowledge', 'Knowledge after reasonable inquiry']);
  assert.deepEqual(labels(row.sub_rows[1]), ['Persons listed on Disclosure Letter']);
  assert.equal(section.facts_without_readout.length, 0);
  // The definition of Parent's knowledge goes to the Parent table.
  const parentKnowledge = { ...knowledge, fact_id: 'def-parent-knowledge', components: [introComponent('pk-term', 'DEFINED_TERM', '“Knowledge of Parent” means', 0), introComponent('pk-std', 'STANDARD', 'the actual knowledge', 30)] };
  const parentView = buildTableView({ facts: [parentKnowledge], tableShapes, legalSchema });
  assert.equal(parentView.sections.find((candidate) => candidate.section_key === 'parent-representations-qualifiers').tables[0].rows[0].subject, 'Knowledge');
});

// Ben, 2026-09-14: "sure add a table". The capitalization counts by
// security class, every number parsed from the cited words.
const capComponent = (id, kind, text, start, origin = 'OWN') => ({ component_id: id, kind, label: id, text, origin, source_span_id: 'cap', start_byte: start, end_byte: start + text.length, gap_before: false, children: [] });
const capFact = (id, subtype, components) => ({
  fact_id: id, proposal_id: id, family_key: 'CAPITALISATION', subtype_key: subtype, section_reference: '3.02', structure_node_id: 'n-3-02', validation_status: 'VALID',
  headline: { label: subtype, distinguishing_component_ids: [components[0].component_id] },
  components,
});

test('capitalisation facts without a readout fill the capitalization table by security class, the counts parsed from the cited words, the absence facts under the table', () => {
  const measurement = capComponent('cap-date', 'TRIGGER', 'At the close of business on September 18, 2025 (the “Measurement Date”)', 0, 'CHAPEAU');
  const authorised = capFact('cap-auth', 'AUTHORISED_CAPITAL', [
    capComponent('a-op', 'OPERATION', 'The authorized capital stock of the Company consists of', 100),
    capComponent('a-common', 'AMOUNT', '800,000,000 shares of Company Common Stock', 160),
    capComponent('a-pref', 'AMOUNT', '10,000,000 shares of preferred stock, par value $0.00001 per share', 210),
  ]);
  const issued = capFact('cap-issued', 'ISSUED_AND_OUTSTANDING', [measurement,
    capComponent('i-amount', 'AMOUNT', '105,278,627 shares of Company Common Stock', 300),
    capComponent('i-op', 'OPERATION', 'were issued and outstanding', 350),
    capComponent('i-qual', 'QUALIFIER', '(including 147,624 shares of Company Common Stock that were subject to outstanding Company Restricted Stock Awards)', 380),
  ]);
  const options = capFact('cap-options', 'EQUITY_AWARD_INVENTORY', [measurement,
    capComponent('o-amount', 'AMOUNT', '12,262,280 shares of Company Common Stock', 500),
    capComponent('o-op', 'OPERATION', 'were subject to outstanding Company Stock Options', 550),
  ]);
  const espp = capFact('cap-espp', 'RESERVED_OR_ISSUABLE_SECURITIES', [measurement,
    capComponent('e-amount', 'AMOUNT', '1,263,830 shares of Company Common Stock', 600),
    capComponent('e-op', 'OPERATION', 'were reserved and available for purchase under the Company ESPP', 650),
  ]);
  const plans = capFact('cap-plans', 'RESERVED_OR_ISSUABLE_SECURITIES', [measurement,
    capComponent('r-amount', 'AMOUNT', '6,331,920 additional shares of Company Common Stock', 700),
    capComponent('r-op', 'OPERATION', 'were reserved for issuance pursuant to the Company Stock Plans', 760),
    capComponent('r-exc', 'EXCEPTION', '(other than the Company ESPP)', 830),
  ]);
  const valid = capFact('cap-valid', 'VALID_ISSUANCE_STATUS', [
    capComponent('v-actor', 'ACTOR', 'All of the outstanding shares of Company Common Stock', 900),
    capComponent('v-litany', 'LITANY', 'duly authorized, validly issued, fully paid and nonassessable', 960),
  ]);
  const absence = capFact('cap-absence', 'CAPITALISATION_ABSENCE', [
    capComponent('n-op', 'OPERATION', 'no shares of Company Preferred Stock were issued or outstanding', 1000),
  ]);
  const uncounted = capFact('cap-list', 'EQUITY_AWARD_INVENTORY', [
    capComponent('u-actor', 'ACTOR', 'Section 3.02(b) of the Company Disclosure Letter', 1100),
    capComponent('u-op', 'OPERATION', 'sets forth each outstanding Company Equity Award', 1150),
  ]);
  const view = buildTableView({ facts: [authorised, issued, options, espp, plans, valid, absence, uncounted], tableShapes, legalSchema });
  const section = view.sections.find((candidate) => candidate.section_key === 'capitalization');
  assert.ok(section, 'the capitalization section renders');
  assert.equal(section.rail.group, 'Representations');
  const table = section.tables[0];
  assert.equal(table.table_key, 'capitalization-table');
  // The authorised count is stated for the common stock alone, so the column
  // folds into that row as a trailing detail (Ben, 2026-10-17, finding (42):
  // "'period' as a column is wasteful as it only applies to one provision?
  // Consider that point generally?"; applyColumnRules).
  assert.deepEqual(table.columns.map((column) => column.column_id), ['issued', 'reserved', 'asOf', 'validIssuance']);
  const cellOf = (row, columnId) => row.cells.find((cell) => cell.column_id === columnId);
  const rowOf = (subject) => table.rows.find((row) => row.subject === subject);
  assert.deepEqual(table.rows.map((row) => row.subject), ['Common Stock', 'Company Stock Options', 'ESPP']);
  const common = rowOf('Common Stock');
  assert.deepEqual(common.trailing_details.map((detail) => [detail.column_id, detail.label]), [['authorised', 'Authorised 800,000,000']], 'the first count names the common stock');
  assert.deepEqual(common.trailing_details[0].cell.component_ids, ['a-common']);
  assert.equal(cellOf(common, 'issued').label, '105,278,627');
  assert.equal(cellOf(common, 'reserved').label, '6,331,920', 'the plan reserve, its ESPP exception not naming the row');
  assert.equal(cellOf(common, 'asOf').label, 'September 18, 2025', 'the Measurement Date inherited from the chapeau');
  assert.equal(cellOf(common, 'validIssuance').label, 'Present');
  assert.deepEqual(common.backing_facts.map((entry) => entry.fact_id), ['cap-auth', 'cap-issued', 'cap-plans', 'cap-valid']);
  // A column filled only by named subtypes is never completed from another
  // subtype's number: the issued count does not become an authorised count.
  assert.equal(rowOf('Company Stock Options').trailing_details, undefined);
  assert.equal(cellOf(rowOf('Company Stock Options'), 'issued').label, '12,262,280');
  assert.equal(cellOf(rowOf('ESPP'), 'reserved').label, '1,263,830');
  // Ben, 2026-09-14: the absence facts are the table's Other provisions,
  // titled No other securities, not a footer of drafted lines.
  assert.equal(table.footer, undefined);
  assert.equal(table.other_provisions_label, 'No other securities');
  assert.deepEqual(table.other_provisions.flatMap((group) => group.branches.map((branch) => branch.fact_id)), ['cap-absence']);
  // A counted fact without a count stays without a readout.
  const reps = view.sections.find((candidate) => candidate.section_key === 'representations-qualifiers');
  assert.deepEqual((reps?.facts_without_readout || []).map((entry) => entry.fact_id), ['cap-list']);
});

test('a capitalisation readout coded by the extractor keeps the representations row\'s sub-item and the table row apart', () => {
  const limb = {
    ...capFact('cap-limb', 'PARTNERSHIP_OR_SUBSIDIARY_EQUITY', [capComponent('s-op', 'OPERATION', 'All of the outstanding shares of capital stock of each Company Subsidiary are owned by the Company', 0)]),
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'Capitalization; Subsidiaries', row_detail: 'Subsidiary equity interests', cells: [] },
  };
  const count = {
    ...capFact('cap-count', 'ISSUED_AND_OUTSTANDING', [capComponent('c-amount', 'AMOUNT', '105,278,627 shares of Company Common Stock', 0)]),
    conclusions: { table_key: 'capitalization-table', row_label: 'Common Stock', cells: [{ column_id: 'issued', value: { canonical: 105278627, unit: 'COUNT' }, component_ids: ['c-amount'] }] },
  };
  const view = buildTableView({ facts: [limb, count], tableShapes, legalSchema });
  const reps = view.sections.find((candidate) => candidate.section_key === 'representations-qualifiers').tables[0];
  assert.equal(reps.rows[0].subject, 'Capitalization; Subsidiaries');
  assert.equal(reps.rows[0].sub_rows[0].subject, 'Subsidiary equity interests');
  const cap = view.sections.find((candidate) => candidate.section_key === 'capitalization').tables[0];
  assert.equal(cap.rows[0].subject, 'Common Stock');
  assert.equal(cap.rows[0].cells.find((cell) => cell.column_id === 'issued').label, '105,278,627');
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
  other.headline.summary = 'Or another place and time the parties agree in writing';
  offices.headline.summary = 'Closing at the offices of Wachtell Lipton';
  const view = buildTableView({ facts: [other, offices], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'closingLocation');
  assert.deepEqual(cell.values.map((value) => value.label), [
    'Closing at the offices of Wachtell Lipton',
    'Or another place and time the parties agree in writing',
  ]);
  assert.equal(cell.label, 'Closing at the offices of Wachtell Lipton');
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
  // Ben, 2026-09-14: the row's line is the general case (the fact with no
  // sub-item), never a merge of its exceptions.
  const line = table.rows[0].cells.find((cell) => cell.column_id === 'cvrEntitlement');
  assert.equal((line.values || [line]).length, 1, 'the row line shows the general case only');
  assert.deepEqual(line.fact_ids, ['eq-all']);
  assert.equal(table.sub_rows_label, 'Exceptions');
  // Without a general-case fact the line falls back to the merged overview.
  const withoutGeneral = buildTableView({ facts: facts.slice(0, 2), tableShapes, legalSchema }).sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'equity-awards-table');
  assert.equal(withoutGeneral.rows[0].cells.find((cell) => cell.column_id === 'cvrEntitlement').values.length, 2);
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

test('a presence-derived row is created from another family\'s fact: Company termination for a Superior Proposal from the TERMINATION right', () => {
  const right = {
    fact_id: 'term-sp', family_key: 'TERMINATION', subtype_key: 'SUPERIOR_PROPOSAL', section_reference: '8.01(f)',
    headline: { label: 'Superior proposal', distinguishing_component_ids: ['term-sp-c'] },
    components: [{ component_id: 'term-sp-c', kind: 'ACTOR', label: 'terminating party', text: 'the Company', origin: 'OWN', source_span_id: 's', start_byte: 10, end_byte: 21, children: [] }],
    conclusions: { table_key: 'termination-rights-company-may-terminate', row_label: 'Superior Proposal', cells: [{ column_id: 'window', code: 'PRE_STOCKHOLDER_VOTE_ONLY', component_ids: ['term-sp-c'] }] },
  };
  const view = buildTableView({ facts: [right], tableShapes, legalSchema });
  const superior = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'nosol-superior-table');
  assert.ok(superior, 'the superior-proposal table appears for the derived row alone');
  const row = superior.rows.find((candidate) => candidate.subject === 'Company termination for Superior Proposal');
  const cell = row.cells.find((candidate) => candidate.column_id === 'provision');
  assert.equal(cell.label, 'Yes');
  assert.deepEqual(cell.fact_ids, ['term-sp']);
  // The termination table itself still has the right as a row named from its subtype.
  const company = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'termination-rights-company-may-terminate');
  assert.ok(company.rows.some((candidate) => candidate.subject === 'Superior Proposal'));
});

test('a presence-derived line of the consideration grid says Present', () => {
  const appraisal = {
    fact_id: 'appr-1', family_key: 'APPRAISAL_DISSENTERS_RIGHTS', subtype_key: 'APPRAISAL_STATUS', section_reference: '2.01(d)',
    headline: { label: 'Appraisal', distinguishing_component_ids: ['appr-1-c'] },
    components: [{ component_id: 'appr-1-c', kind: 'OPERATION', label: 'not converted', text: 'shall not be converted into the right to receive the Merger Consideration', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 74, children: [] }],
  };
  const view = buildTableView({ facts: [appraisal], tableShapes, legalSchema });
  const structure = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'consideration-structure');
  const cell = structure.rows[0].cells.find((candidate) => candidate.column_id === 'appraisalRights');
  assert.equal(cell.kind, 'pill');
  assert.equal(cell.label, 'Present');
});

test('the appraisal line takes the CONSIDERATION/APPRAISAL_LINK fact first, an APPRAISAL_DISSENTERS_RIGHTS fact otherwise, and never an invalid one', () => {
  const link = { fact_id: 'link-1', family_key: 'CONSIDERATION', subtype_key: 'APPRAISAL_LINK', validation_status: 'VALID', section_reference: '2.01(d)', headline: { label: 'Appraisal link', distinguishing_component_ids: ['link-1-c'] },
    components: [{ component_id: 'link-1-c', kind: 'OPERATION', label: 'not converted', text: 'shall not be converted into the Merger Consideration', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 52, children: [] }] };
  const status = { fact_id: 'st-1', family_key: 'APPRAISAL_DISSENTERS_RIGHTS', subtype_key: 'APPRAISAL_STATUS', validation_status: 'INVALID', section_reference: '2.01(d)', headline: { label: 'Appraisal', distinguishing_component_ids: ['st-1-c'] },
    components: [{ component_id: 'st-1-c', kind: 'OPERATION', label: 'x', text: 'invalid words', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 13, children: [] }] };
  const entitlement = { fact_id: 'en-1', family_key: 'APPRAISAL_DISSENTERS_RIGHTS', subtype_key: 'APPRAISAL_ENTITLEMENT', validation_status: 'VALID', section_reference: '2.01(d)', headline: { label: 'Entitlement', distinguishing_component_ids: ['en-1-c'] },
    components: [{ component_id: 'en-1-c', kind: 'OPERATION', label: 'entitled', text: 'shall be entitled only to receive such consideration as is determined to be due', origin: 'OWN', source_span_id: 's', start_byte: 100, end_byte: 180, children: [] }] };
  const cellFor = (facts) => buildTableView({ facts, tableShapes, legalSchema }).sections.flatMap((section) => section.tables)
    .find((candidate) => candidate.table_key === 'consideration-structure').rows[0].cells.find((cell) => cell.column_id === 'appraisalRights');
  // Ben, 2026-09-14: "this should just say 'present'". The line is a Present pill citing the chosen fact.
  assert.equal(cellFor([link, status, entitlement]).label, 'Present');
  assert.deepEqual(cellFor([link, status, entitlement]).fact_ids, ['link-1']);
  assert.equal(cellFor([status, entitlement]).label, 'Present');
  assert.deepEqual(cellFor([status, entitlement]).fact_ids, ['en-1'], 'the invalid status fact is skipped, the entitlement fact serves');
});

// Ben, 2026-09-14, on the § 1.03 filing facts: "render them as a hidden
// 'other provisions' section under the main structure and mechanics parts -
// needs to be high level"; "show them as one fact in the layer tree with
// 'Branches' for the different clauses/'or's etc on UI".
const { groupOtherProvisions, factSummaryText } = require('../lib/product/table-view');

function filingFact(id, extras, distinguishing) {
  const span = 's-1-03';
  const component = (cid, kind, text, start, origin = 'OWN') => ({ component_id: `${id}-${cid}`, kind, label: cid, text, origin, source_span_id: span, start_byte: start, end_byte: start + text.length, gap_before: false, children: [] });
  return {
    fact_id: id, proposal_id: id, family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'TRANSACTION_STEP', section_reference: '1.03', structure_node_id: 'n-1-03',
    headline: { label: 'Transaction step', distinguishing_component_ids: distinguishing.map((cid) => `${id}-${cid}`) },
    components: [
      component('chapeau', 'QUALIFIER', 'On the Closing Date', 0, 'CHAPEAU'),
      component('actor', 'ACTOR', 'the Company', 20),
      component('op', 'OPERATION', 'shall file', 32),
      ...extras.map(([cid, kind, text, start]) => component(cid, kind, text, start)),
    ],
  };
}
const certificate = filingFact('ts-1', [['obj', 'OBJECT', 'a certificate of merger', 43], ['with', 'TERM', 'with the Secretary of State of the State of Delaware', 67]], ['obj']);
const otherFilings = filingFact('ts-2', [['obj', 'OBJECT', 'such other documents as may be required', 121], ['std', 'STANDARD', 'in a form acceptable to Parent', 170]], ['std']);
const acceptable = filingFact('ts-3', [['std', 'STANDARD', 'in a form acceptable to Parent', 170]], ['std']);

test('facts cut from one sentence become one "other provisions" line with a branch per fact, common words first, own words in the branch', () => {
  const groups = groupOtherProvisions([otherFilings, certificate, acceptable]);
  assert.equal(groups.length, 1);
  const [group] = groups;
  assert.equal(group.subtype_key, 'TRANSACTION_STEP');
  assert.equal(group.span_id, 's-1-03');
  // The common line is the operative core every fact shares; the chapeau is not the fact's own words.
  assert.equal(group.common_text, 'the Company shall file');
  // Branches come in source order and carry only that fact's own words, an ellipsis for skipped words.
  assert.deepEqual(group.branches.map((branch) => branch.fact_id), ['ts-1', 'ts-2', 'ts-3']);
  assert.deepEqual(group.branches.map((branch) => branch.text), [
    'a certificate of merger with the Secretary of State of the State of Delaware',
    'such other documents as may be required … in a form acceptable to Parent',
    'in a form acceptable to Parent',
  ]);
  assert.deepEqual(group.branches.map((branch) => branch.section_reference), ['1.03', '1.03', '1.03']);
});

test('a fact on its own sentence is a plain line: its summary as the common text and a single branch', () => {
  const alone = { ...certificate, fact_id: 'ts-9', components: certificate.components.map((component) => ({ ...component, source_span_id: 's-1-03-b' })) };
  const groups = groupOtherProvisions([certificate, alone]);
  assert.equal(groups.length, 2);
  assert.equal(groups[1].branches.length, 1);
  assert.equal(groups[1].common_text, factSummaryText(alone));
  assert.equal(groups[1].branches[0].text, groups[1].common_text);
  // A different subtype on the same span is its own group.
  const otherSubtype = { ...acceptable, fact_id: 'ts-8', subtype_key: 'LEGAL_EFFECT' };
  assert.equal(groupOtherProvisions([certificate, otherSubtype]).length, 2);
});

test('a one-per-agreement table exposes its no-cell facts as other_provisions, grouped, while they still back the row', () => {
  const view = buildTableView({ facts: [certificate, otherFilings, acceptable], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  assert.ok(table, 'the structure table is present');
  assert.equal(table.rows[0].backing_facts.length, 3);
  assert.equal(table.other_provisions.length, 1);
  assert.equal(table.other_provisions[0].branches.length, 3);
  assert.equal(table.other_provisions[0].common_text, 'the Company shall file');
  // A fact whose readout adds no cell joins them too.
  const emptyReadout = { ...certificate, fact_id: 'ts-7', components: certificate.components.map((component) => ({ ...component, source_span_id: 's-1-03-c' })), conclusions: { table_key: 'structure-mechanics-table', row_label: 'The deal', cells: [] } };
  const again = buildTableView({ facts: [certificate, emptyReadout], tableShapes, legalSchema }).sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  assert.equal(again.other_provisions.length, 2);
  assert.ok(again.other_provisions.some((group) => group.branches[0].fact_id === 'ts-7'));
});

// Ben, 2026-09-14, on the unvested option sub-row: "While fully vested is
// normally right I know why this is coded as such but it should say Fully
// Vested (Conditional Upon Service) or similar". A stored "Fully vested
// (accelerated)" cell whose fact carries a continued-service condition
// reads as conditional upon service; without the condition it stays.
test('a fully-vested cell with a continued service condition reads as conditional upon service', () => {
  const shapes = require('../contracts/product/table-shapes.v3.json');
  const schema = require('../contracts/product/legal-schema.v2.json');
  const award = (id, conditionText) => ({
    fact_id: id, proposal_id: id, family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD', section_reference: '2.03', structure_node_id: 'n-2-03',
    headline: { label: 'Equity award', distinguishing_component_ids: [] },
    conclusions: { table_key: 'equity-awards-table', row_label: 'Company Stock Option', row_detail: 'Unvested, not vesting by its terms', cells: [{ column_id: 'vestingTreatment', code: 'FULLY_VESTED_ACCELERATED', component_ids: [`${id}-o`] }] },
    components: [
      ...(conditionText ? [{ component_id: `${id}-c`, kind: 'CONDITION', label: 'Continued service', text: conditionText, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: conditionText.length, gap_before: false, children: [] }] : []),
      { component_id: `${id}-a`, kind: 'ACTOR', label: 'payments', text: 'all such payments', origin: 'OWN', source_span_id: 's', start_byte: 200, end_byte: 217, gap_before: false, children: [] },
      { component_id: `${id}-o`, kind: 'OPERATION', label: 'vest', text: 'shall become vested', origin: 'OWN', source_span_id: 's', start_byte: 218, end_byte: 237, gap_before: false, children: [] },
    ],
  });
  const view = buildTableView({ facts: [award('ea-1', 'subject to the holder’s continued service with Parent through the first anniversary of the Closing'), award('ea-2', null)], tableShapes: shapes, legalSchema: schema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'equity-awards-table');
  const row = table.rows.find((candidate) => candidate.subject === 'Company Stock Option');
  const sub = (row.sub_rows || []).find((candidate) => candidate.subject === 'Unvested, not vesting by its terms');
  const cell = sub.cells.find((candidate) => candidate.column_id === 'vestingTreatment');
  const labels = (cell.values || [cell]).map((value) => value.label);
  assert.ok(labels.includes('Fully vested (conditional upon service)'), JSON.stringify(labels));
  assert.ok(labels.includes('Fully vested (accelerated)'), JSON.stringify(labels));
});

// Metsera generation 6, 3.08: the fact cites "Since January 1, 2025" as a
// DATE and the extractor left the Lookback cell out. A value column with no
// cell is filled from the fact's own fill_from component when its words
// parse; the cell carries that component as evidence.
test('a value column the extractor left empty is filled from the fact\'s own parsable component', () => {
  const fact = {
    fact_id: 'r-3-08', proposal_id: 'r-3-08', family_key: 'REPRESENTATIONS', subtype_key: 'NEGATIVE_REPRESENTATION', section_reference: '3.08', structure_node_id: 'n-3-08',
    headline: { label: 'Negative representation', distinguishing_component_ids: [] },
    conclusions: { table_key: 'representations-qualifiers-table', row_label: 'Absence of Certain Changes or Events', cells: [{ column_id: 'materiality', code: 'MAE_AGGREGATE', component_ids: ['r-3-08-m'] }] },
    components: [
      { component_id: 'r-3-08-d', kind: 'DATE', label: 'Look-back start date', text: 'Since January 1, 2025', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 21, gap_before: false, children: [] },
      { component_id: 'r-3-08-o', kind: 'OPERATION', label: 'Absence statement', text: 'there has not been', origin: 'OWN', source_span_id: 's', start_byte: 22, end_byte: 40, gap_before: false, children: [] },
      { component_id: 'r-3-08-m', kind: 'DEFINED_TERM', label: 'Company Material Adverse Effect', text: 'any Company Material Adverse Effect', origin: 'OWN', source_span_id: 's', start_byte: 41, end_byte: 76, gap_before: false, children: [] },
    ],
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'representations-qualifiers-table');
  const row = table.rows.find((candidate) => candidate.subject === 'Absence of Certain Changes or Events');
  const cell = row.cells.find((candidate) => candidate.column_id === 'lookback');
  assert.equal(cell.label, 'January 1, 2025');
  assert.deepEqual(cell.component_ids, ['r-3-08-d']);
  assert.equal(cell.derived, true);
});

// The extractor is now asked to cite the entity's own words with the term
// on a party column (Ben, 2026-09-14: "do you have an agent looking at all
// of our tweaks and seeing if they should be made systematically/throughout
// the code base back to extraction? I don't want to make surface level/one
// deal level fixes"): a cell whose text is the entity and which cites the
// ACTOR and the TERM reads the same as the stored generations' term-only cell.
test('a party column cell that cites the entity and the term reads as entity (term), the same as a term-only cell', () => {
  const fact = {
    fact_id: 'sv-2', proposal_id: 'sv-2', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'LEGAL_EFFECT', section_reference: '1.01', structure_node_id: 'n-1-01',
    headline: { label: 'Legal effect', distinguishing_component_ids: ['sv2-term'] },
    components: [
      { component_id: 'sv2-actor', kind: 'ACTOR', label: 'Continuing entity', text: 'the Company', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 11, gap_before: false, children: [] },
      { component_id: 'sv2-op', kind: 'OPERATION', label: 'Continues as survivor', text: 'shall continue as the surviving corporation', origin: 'OWN', source_span_id: 's', start_byte: 12, end_byte: 55, gap_before: false, children: [] },
      { component_id: 'sv2-term', kind: 'TERM', label: 'Surviving Corporation', text: 'the “Surviving Corporation”', origin: 'OWN', source_span_id: 's', start_byte: 57, end_byte: 84, gap_before: false, children: [] },
    ],
    conclusions: { table_key: 'structure-mechanics-table', row_label: 'the Merger', cells: [{ column_id: 'survivingEntityStep1', text: 'the Company', component_ids: ['sv2-actor', 'sv2-term'] }] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'survivingEntityStep1');
  assert.equal(cell.label, 'the Company (the “Surviving Corporation”)');
  assert.deepEqual(cell.component_ids, ['sv2-actor', 'sv2-term']);
});

// The Term of an other-provision row is the extractor's headline.summary
// when the fact carries one (Ben, 2026-09-14: "it needs to be a summary of
// the provision on the right etc - like in the normal course. Not just a
// sec ref...!"; "1. for now - yes"); the label-built term stays for older
// generations without one.
test('provisionTerm is the label-built term; headline.summary is the row\'s Summary text', () => {
  const { provisionTerm } = require('../lib/product/table-view');
  const components = [
    { component_id: 'pt-actor', kind: 'ACTOR', label: 'Company', text: 'the Company', origin: 'OWN', children: [] },
    { component_id: 'pt-op', kind: 'OPERATION', label: 'files', text: 'shall file', origin: 'OWN', children: [] },
  ];
  const older = { fact_id: 'pt-1', headline: { label: 'Certificate of merger filing', distinguishing_component_ids: ['pt-op'] }, components };
  assert.equal(provisionTerm(older, components), 'Company · files');
  const summarised = { ...older, headline: { ...older.headline, summary: 'Company files the Certificate of Merger with the Delaware Secretary of State' } };
  // Ben, 2026-09-14, on the Summary column: the term stays short; the
  // summary is the Summary cell of the Other provisions row.
  assert.equal(provisionTerm(summarised, components), 'Company · files');
  const { groupOtherProvisions } = require('../lib/product/table-view');
  const [group] = groupOtherProvisions([{ ...summarised, family_key: 'MERGER_STRUCTURE_CLOSING', components: components.map((c) => ({ ...c, source_span_id: 's', start_byte: 0, end_byte: 5 })) }]);
  assert.equal(group.term, 'Company · files');
  assert.equal(group.common_text, 'Company files the Certificate of Merger with the Delaware Secretary of State');
  const blank = { ...older, headline: { ...older.headline, summary: '   ' } };
  assert.equal(provisionTerm(blank, components), 'Company · files', 'a blank summary is no summary');
});

// Generation 6, 2.03: "The Company shall treat shall treat any shares" and
// "the Closing Amount the Closing Amount". Components covering the same
// bytes are one run of words in a summary; the overlap is written once and
// a component wholly inside the previous one adds nothing.
test('a summary writes overlapping components once', () => {
  const fact = {
    fact_id: 'ov-1', proposal_id: 'ov-1', family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD', section_reference: '2.03',
    headline: { label: 'Equity award', distinguishing_component_ids: [] },
    components: [
      { component_id: 'a', kind: 'ACTOR', label: 'Company', text: 'The Company shall treat', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 23, gap_before: false, children: [] },
      { component_id: 'o', kind: 'OPERATION', label: 'treat', text: 'shall treat any shares as outstanding', origin: 'OWN', source_span_id: 's', start_byte: 12, end_byte: 49, gap_before: false, children: [] },
      { component_id: 'q', kind: 'QUALIFIER', label: 'inside', text: 'any shares', origin: 'OWN', source_span_id: 's', start_byte: 24, end_byte: 34, gap_before: false, children: [] },
      { component_id: 'b', kind: 'OBJECT', label: 'purpose', text: 'for purposes of Section 2.01(c)', origin: 'OWN', source_span_id: 's', start_byte: 50, end_byte: 81, gap_before: false, children: [] },
    ],
  };
  assert.equal(factSummaryText(fact), 'The Company shall treat any shares as outstanding for purposes of Section 2.01(c)');
});

// Metsera generation 6, 3.09: "No representation or warranty is made in
// this Agreement with respect to the amount, sufficiency or availability
// of any Tax asset" was coded NO_OTHER_REPS_FRAUD and filled the No Other
// Reps table. A disclaimer limited to one subject is the representation's
// exclusion: it keeps no readout; the agreement's clause does.
test('a subject-limited disclaimer keeps no readout in the No Other Reps table', () => {
  const { isSubjectLimitedDisclaimer } = require('../lib/product/table-view');
  const disclaimer = (id, text) => ({
    fact_id: id, proposal_id: id, family_key: 'NO_OTHER_REPS_FRAUD', subtype_key: 'NO_OTHER_REPRESENTATIONS_DISCLAIMER', section_reference: '3.09', structure_node_id: 'n',
    headline: { label: 'No other representations', distinguishing_component_ids: [] },
    conclusions: { table_key: 'no-other-reps-fraud-table', row_label: 'Seller no-other-reps', cells: [{ column_id: 'status', code: 'YES', component_ids: [`${id}-o`] }] },
    components: [{ component_id: `${id}-o`, kind: 'OPERATION', label: 'disclaimer', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: text.length, gap_before: false, children: [] }],
  });
  const limited = disclaimer('d-tax', 'No representation or warranty is made in this Agreement with respect to the amount, sufficiency or availability of any Tax asset');
  const general = disclaimer('d-gen', 'except for the representations and warranties contained in this Article III, neither the Company nor any other Person makes any other express or implied representation or warranty with respect to the Company');
  assert.equal(isSubjectLimitedDisclaimer(limited), true);
  assert.equal(isSubjectLimitedDisclaimer(general), false);
  const view = buildTableView({ facts: [limited, general], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'no-other-reps-fraud-table');
  const rows = table.rows.filter((row) => !row.absent);
  assert.deepEqual(rows.flatMap((row) => row.backing_facts.map((entry) => entry.fact_id)), ['d-gen']);
});

// Generation 6, IV-INTRO: the extractor coded Parent's introduction to the
// retired "parent-representations-general-qualifications" table, and the
// fact fell into the Company table. A readout naming a table the shapes no
// longer carry is no readout; the intro rule places it on Parent's General
// Exceptions row.
test('a readout naming a retired table is placed by the page rules', () => {
  const fact = {
    fact_id: 'iv-intro', proposal_id: 'iv-intro', family_key: 'REPRESENTATIONS', subtype_key: 'REPRESENTATION_QUALIFICATION', section_reference: 'IV-INTRO', structure_node_id: 'n-iv',
    headline: { label: 'General qualification', distinguishing_component_ids: [] },
    conclusions: { table_key: 'parent-representations-general-qualifications', row_label: 'Other general qualification', cells: [] },
    components: [
      { component_id: 'iv-a', kind: 'ACTOR', label: 'Representing parties', text: 'Parent and Merger Sub, jointly and severally', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 44, gap_before: false, children: [] },
      { component_id: 'iv-o', kind: 'OPERATION', label: 'represent', text: 'represent and warrant to the Company', origin: 'OWN', source_span_id: 's', start_byte: 45, end_byte: 81, gap_before: false, children: [] },
    ],
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const tables = view.sections.flatMap((section) => section.tables);
  const parent = tables.find((candidate) => candidate.table_key === 'parent-representations-qualifiers-table');
  const company = tables.find((candidate) => candidate.table_key === 'representations-qualifiers-table');
  const rowIds = (table) => (table ? table.rows.filter((row) => !row.absent).flatMap((row) => row.backing_facts.map((entry) => entry.fact_id)) : []);
  assert.deepEqual(rowIds(parent), ['iv-intro']);
  assert.deepEqual(rowIds(company), []);
});

// Metsera generation 6, 9.03: the MAE summary is derived from the row's own
// prong facts, not coded by the extractor.
test('the MAE summary counts the party\'s prongs and sorts them by their words', () => {
  const prong = (id, party, text) => ({
    fact_id: id, proposal_id: id, family_key: 'MAE_DEFINITION', subtype_key: 'DEFINITION_PRONG', fact_type: 'MAE_DEFINITION_PRONG', section_reference: '9.03',
    headline: { label: 'MAE definition', distinguishing_component_ids: [`${id}-c`] },
    components: [{ component_id: `${id}-c`, kind: 'STANDARD', label: 'test', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: text.length, gap_before: false, children: [] }],
    conclusions: { table_key: 'mae-definitions-table', row_label: party, cells: [{ column_id: 'test', text, component_ids: [`${id}-c`] }] },
  });
  const facts = [
    prong('c-1', 'Company', 'has had, or would reasonably be expected to have, a material adverse effect on the business'),
    prong('c-2', 'Company', 'would reasonably be expected to prevent the consummation of the Merger by the Outside Date'),
    prong('p-1', 'Parent', 'would prevent or materially impair the ability of Parent to consummate the Merger'),
  ];
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'mae-definitions-table');
  const summary = (party) => table.rows.find((row) => row.subject === party).cells.find((cell) => cell.column_id === 'limbSummary');
  assert.equal(summary('Company').code, 'TWO_LIMBS_EFFECT_ON_THE_BUSINESS_AND_ABILITY_TO_CONSUMMATE');
  assert.deepEqual(summary('Company').fact_ids, ['c-1', 'c-2']);
  assert.equal(summary('Parent').code, 'ONE_LIMB_ABILITY_TO_CONSUMMATE');
  const alone = buildTableView({ facts: [facts[0]], tableShapes, legalSchema });
  assert.equal(alone.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'mae-definitions-table').rows.find((row) => row.subject === 'Company').cells.find((cell) => cell.column_id === 'limbSummary').code, 'ONE_LIMB_EFFECT_ON_THE_BUSINESS_CONDITION_OR_RESULTS_OF_OPERATIONS');
});

// Metsera generation 7, 3.11 and 3.14: a definition fact of its own (ERISA,
// Proceeding) has no table; it is a Defined Terms entry, the quoted name its
// term and its summary the definition.
test('an OTHER_DEFINED_TERM fact joins the Defined Terms section', () => {
  const fact = {
    fact_id: 'def-erisa', proposal_id: 'def-erisa', family_key: 'KEY_DEFINED_TERMS', subtype_key: 'OTHER_DEFINED_TERM', fact_type: 'OTHER_DEFINED_TERM_RECORDED', section_reference: '3.11',
    headline: { label: 'Other defined term', summary: 'ERISA means the Employee Retirement Income Security Act of 1974, as amended', distinguishing_component_ids: ['def-erisa-t'] },
    components: [{ component_id: 'def-erisa-t', kind: 'DEFINED_TERM', label: 'ERISA', text: 'the Employee Retirement Income Security Act of 1974, as amended (“ERISA”)', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 70, gap_before: false, children: [] }],
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const entry = view.defined_terms.find((candidate) => candidate.fact_id === 'def-erisa');
  assert.ok(entry);
  assert.equal(entry.term, 'ERISA');
  assert.equal(entry.definition, 'ERISA means the Employee Retirement Income Security Act of 1974, as amended');
});

// Ben, 2026-10-17 (plan finding (42)): "random page breaks and pagen
// umbers...!" The SEC page footers in the canonical text are hidden at
// display (lib/product/source-display.js) and never removed from the stored
// words: the fact handed to the tables keeps its bytes and ids.
test('page footers are hidden from the words the tables show and kept in the stored fact', () => {
  const { hidePageFooters, factWithoutPageFooters } = require('../lib/product/source-display');
  const { factOwnText } = require('../lib/product/table-view');
  assert.equal(hidePageFooters('DOCUMENTS\n-85-\nREFERRED TO'), 'DOCUMENTS REFERRED TO');
  assert.equal(hidePageFooters('the\n - 7 - \nTransactions'), 'the Transactions');
  assert.equal(hidePageFooters('a 3-4 split and -5- inline stay'), 'a 3-4 split and -5- inline stay', 'only a footer on a line of its own is hidden');
  assert.equal(hidePageFooters(null), null);
  const fact = {
    fact_id: 'pf-2', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION',
    headline: { label: 'Prohibited action', distinguishing_component_ids: ['x-obj'] },
    components: [
      { component_id: 'x-actor', kind: 'ACTOR', label: 'obligor', text: 'The Company', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 11, gap_before: false, children: [] },
      { component_id: 'x-op', kind: 'OPERATION', label: 'prohibition', text: 'shall not enter into any\n-38-\nagreement', origin: 'OWN', source_span_id: 's', start_byte: 12, end_byte: 50, gap_before: false, children: [
        { component_id: 'x-obj', kind: 'OBJECT', label: 'agreement', text: 'any\n-38-\nagreement', origin: 'OWN', source_span_id: 's', start_byte: 33, end_byte: 50, gap_before: false, children: [] },
      ] },
    ],
  };
  assert.equal(factOwnText(fact), 'The Company shall not enter into any agreement');
  const shown = factWithoutPageFooters(fact);
  assert.equal(shown.components[1].text, 'shall not enter into any agreement');
  assert.equal(shown.components[1].children[0].text, 'any agreement');
  assert.equal(shown.components[1].start_byte, 12);
  assert.equal(fact.components[1].text, 'shall not enter into any\n-38-\nagreement', 'the stored fact is untouched');
  assert.equal(factWithoutPageFooters(fixture.facts[0]), fixture.facts[0], 'a fact without footers is the same object');
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  assert.doesNotMatch(JSON.stringify(view), /-38-/);
});

// Ben, 2026-10-17 (plan finding (42)): "why do we have a summary column
// here? Also 'period' as a column is wasteful as it only applies to one
// provision? Consider that point generally?" and "I know the pills are
// likely helpful for background comparison work etc but do we need to show
// them here? Consider this more generally on the UI pills etc". One rule
// for every table (applyColumnRules; docs/core/CODEBASE-GUIDE.md).
test('applyColumnRules folds a one-line column into a trailing detail, hides pills the summary states, and leaves a one-row table alone', () => {
  const { applyColumnRules, pillStatedInSummary } = require('../lib/product/table-view');
  const shapeColumns = [
    { column_id: 'provision', render: 'vocabulary', header: 'Summary' },
    { column_id: 'period', render: 'value', header: 'Period' },
    { column_id: 'asDrafted', render: 'verbatim', header: 'Summary', display: 'fact_text' },
  ];
  const pill = (label, code) => ({ column_id: 'provision', kind: 'pill', label, code, tone: 'neutral', component_ids: ['c'], fact_ids: ['f'] });
  const value = (label) => ({ column_id: 'period', kind: 'value', label, tone: 'neutral', component_ids: ['p'], fact_ids: ['f'] });
  const text = (label) => ({ column_id: 'asDrafted', kind: 'text', label, tone: 'neutral', component_ids: ['s'], fact_ids: ['f'] });
  const dash = (id) => ({ column_id: id, kind: 'dash', label: null, tone: null, component_ids: [], fact_ids: [] });
  const table = {
    table_key: 't', layout: 'rows', term_column: { header: 'Term' },
    columns: shapeColumns.map(({ column_id, header, display }) => ({ column_id, header, ...(display ? { display } : {}) })),
    rows: [
      { subject: 'Notice of a proposal', cells: [pill('Required', 'REQUIRED'), dash('period'), text('Company must notify Parent of any proposal')], backing_facts: [{ fact_id: 'f' }] },
      { subject: 'Notice period', cells: [{ column_id: 'provision', kind: 'pill', values: [pill('Required within a stated period', 'REQUIRED_WITHIN_STATED_PERIOD'), pill('Required promptly', 'REQUIRED_PROMPTLY')], component_ids: ['c'], fact_ids: ['f'] }, value('48 hours'), text('Notice is required promptly, within 48 hours')], backing_facts: [{ fact_id: 'f' }] },
      { subject: 'Ongoing updates', cells: [pill('Required promptly', 'REQUIRED_PROMPTLY'), dash('period'), text('Updates to Parent are required promptly')], backing_facts: [{ fact_id: 'f' }] },
    ],
  };
  const out = applyColumnRules(table, shapeColumns);
  // (a) the period column, filled on one line of three, is that line's detail; the subject names the column, so the header is not repeated.
  assert.deepEqual(out.columns.map((column) => column.column_id), ['provision', 'asDrafted']);
  assert.deepEqual(out.rows[1].trailing_details.map((detail) => [detail.column_id, detail.header, detail.label]), [['period', 'Period', '48 hours']]);
  assert.equal(out.rows[0].trailing_details, undefined);
  // (b) "Required promptly" is stated by the summaries that carry it: the pill goes, its code stays on the cell.
  const notice = out.rows[1].cells.find((cell) => cell.column_id === 'provision');
  assert.equal(notice.label, 'Required within a stated period');
  assert.deepEqual(notice.stated_in_summary, ['REQUIRED_PROMPTLY']);
  const updates = out.rows[2].cells.find((cell) => cell.column_id === 'provision');
  assert.equal(updates.kind, 'dash');
  assert.deepEqual(updates.stated_in_summary, ['REQUIRED_PROMPTLY']);
  assert.equal(out.rows[0].cells.find((cell) => cell.column_id === 'provision').label, 'Required', 'a pill the summary does not state stays');
  // (c) the summary column stays.
  assert.equal(out.rows[0].cells.find((cell) => cell.column_id === 'asDrafted').label, 'Company must notify Parent of any proposal');
  // A one-row table keeps its columns; an absent row does not count as a row.
  const one = applyColumnRules({ ...table, rows: [table.rows[1]] }, shapeColumns);
  assert.deepEqual(one.columns.map((column) => column.column_id), ['provision', 'period', 'asDrafted']);
  const withAbsent = applyColumnRules({ ...table, rows: [table.rows[1], { subject: 'Parent', absent: true, cells: [dash('provision'), dash('period'), dash('asDrafted')], backing_facts: [] }] }, shapeColumns);
  assert.deepEqual(withAbsent.columns.map((column) => column.column_id), ['provision', 'period', 'asDrafted']);
  // The detail names its column when the subject does not.
  const counts = applyColumnRules({ ...table, columns: [{ column_id: 'period', header: 'Authorised' }, { column_id: 'asDrafted', header: 'Summary', display: 'fact_text' }], rows: [
    { subject: 'Common Stock', cells: [value('800,000,000'), text('800,000,000 shares authorised')], backing_facts: [] },
    { subject: 'Options', cells: [dash('period'), text('Options outstanding')], backing_facts: [] },
  ] }, [{ column_id: 'period', render: 'value', header: 'Authorised' }, shapeColumns[2]]);
  assert.equal(counts.rows[0].trailing_details[0].label, 'Authorised 800,000,000');
  assert.equal(pillStatedInSummary('Yes', 'Yes, the board may change'), false, 'a label under four characters never matches');
  assert.equal(pillStatedInSummary('Required promptly', 'Notice is required promptly, within 48 hours'), true);
});

// Ben, 2026-10-17 (plan finding (42)): "you're missing the fiduciary standard
// required". A readout-less fiduciary-standard fact of the intervening-event
// path defaults to the Board determination standard row; the same fact on
// the superior-proposal path does not (fact_type_rows_when).
test('a readout-less intervening-event fiduciary standard defaults to the Board determination standard row', () => {
  const standard = (id, path) => ({
    fact_id: id, proposal_id: id, family_key: 'NO_SHOP', subtype_key: 'EXCEPTION_PREREQUISITE', fact_type: 'EXCEPTION_PREREQUISITE', section_reference: '5.02(f)', structure_node_id: 'n-5-02',
    statement: `The Board may make an Adverse Recommendation Change in response to ${path} if it has concluded in good faith, after consultation with its outside counsel, that failure to do so would be reasonably likely to be inconsistent with its fiduciary duties.`,
    headline: { label: 'Fiduciary exception', distinguishing_component_ids: [`${id}-std`], summary: `Board may change its recommendation for ${path} when its fiduciary duties so require` },
    components: [
      { component_id: `${id}-std`, kind: 'STANDARD', label: 'fiduciary standard', text: 'would be, or would be reasonably likely to be, inconsistent with its fiduciary duties', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 80, gap_before: false, children: [] },
      { component_id: `${id}-trg`, kind: 'TRIGGER', label: 'path', text: `in response to ${path}`, origin: 'OWN', source_span_id: 's', start_byte: 90, end_byte: 120, gap_before: true, children: [] },
    ],
  });
  const view = buildTableView({ facts: [standard('ie', 'an Intervening Event'), standard('sp', 'a Superior Proposal')], tableShapes, legalSchema });
  const tables = view.sections.flatMap((section) => section.tables);
  const intervening = tables.find((candidate) => candidate.table_key === 'nosol-intervening-table');
  assert.ok(intervening, 'the intervening-event table renders for the defaulted fact');
  const row = intervening.rows.find((candidate) => candidate.subject === 'Board determination standard');
  assert.ok(row && row.backing_facts.some((entry) => entry.fact_id === 'ie'));
  assert.equal(row.backing_facts.some((entry) => entry.fact_id === 'sp'), false, 'the superior-proposal standard is not this row');
  const noShopSection = view.sections.find((section) => section.section_key === 'nosol-fiduciary') || view.sections.find((section) => section.facts_without_readout.some((entry) => entry.fact_id === 'sp'));
  assert.ok(noShopSection, 'the superior-proposal standard stays where its own rules put it');
});

// Finding (44), Ben: "yes to both". Generation 7's stored facts for the two
// 5.02 sentences, if any, take their rows by default.
test('readout-less facts for the deemed-breach and no-restricting-agreement sentences take their rows by default', () => {
  const prohibited = (id, text, summary) => ({
    fact_id: id, proposal_id: id, family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', fact_type: 'PROHIBITED_ACTION', section_reference: '5.02', structure_node_id: 'n-5-02',
    statement: text, headline: { label: 'Prohibited action', distinguishing_component_ids: [`${id}-op`], summary },
    components: [{ component_id: `${id}-op`, kind: 'OPERATION', label: 'operation', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 40, gap_before: false, children: [] }],
  });
  const deemed = prohibited('deemed', 'any violation of the restrictions set forth in this Section 5.02(a) by any Representative of the Company acting in its authorized capacity on behalf of the Company shall be a breach of this Section 5.02(a) by the Company', 'A Representative breach is a Company breach');
  const restricting = prohibited('restrict', 'the Company will not enter into any agreement with any Person subsequent to the date of this Agreement that would restrict the Company\'s ability to provide such information to Parent', 'Company may not agree to restrict information to Parent');
  const other = prohibited('other', 'the Company shall not solicit, initiate or knowingly encourage any Takeover Proposal', 'Company may not solicit a Takeover Proposal');
  const view = buildTableView({ facts: [deemed, restricting, other], tableShapes, legalSchema });
  const tables = view.sections.flatMap((section) => section.tables);
  const core = tables.find((candidate) => candidate.table_key === 'nosol-noshop-core-mechanics');
  const notice = tables.find((candidate) => candidate.table_key === 'nosol-noshop-notice');
  assert.ok(core.rows.find((row) => row.subject === 'Representative control standard' && row.backing_facts.some((entry) => entry.fact_id === 'deemed')));
  assert.ok(notice.rows.find((row) => row.subject === 'No agreement restricting information to Parent' && row.backing_facts.some((entry) => entry.fact_id === 'restrict')));
  const placed = tables.flatMap((table) => table.rows).some((row) => row.backing_facts.some((entry) => entry.fact_id === 'other'));
  assert.equal(placed, false, 'a prohibited act whose words match neither sentence takes no default row');
});

// Work package 5 (plan finding (52)): "2.02's transfer-tax allocation fact
// is on no page at all". A stored fact of the three formerly tableless
// families takes its row without a readout: by fact type where the shape
// names one, by its subtype otherwise (default_rows_from_subtype).
test('readout-less tax and financing facts take their subtype rows in the Tax Matters and Financing sections', () => {
  const stored = (id, family, subtype, factType, text, summary) => ({
    fact_id: id, proposal_id: id, family_key: family, subtype_key: subtype, fact_type: factType, section_reference: '2.02', structure_node_id: 'n-2-02',
    statement: text, headline: { label: subtype, distinguishing_component_ids: [`${id}-op`], summary },
    components: [{ component_id: `${id}-op`, kind: 'OPERATION', label: 'operation', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 40, gap_before: false, children: [] }],
  });
  const transfer = stored('transfer', 'TAX_MATTERS', 'TRANSFER_TAX_ALLOCATION', 'TRANSFER_TAX_ALLOCATION', 'All transfer, documentary, sales, use, stamp, registration and other similar Taxes shall be paid by Parent', 'Parent pays transfer taxes');
  const withholding = stored('withhold', 'TAX_MATTERS', 'WITHHOLDING_MECHANIC', 'OTHER_TAX_MECHANIC', 'Parent, the Surviving Corporation and the Paying Agent shall be entitled to deduct and withhold such amounts as are required under applicable Tax Law', 'Payors may withhold amounts required by Tax Law');
  const payoff = stored('payoff', 'FINANCING_COVENANTS', 'PAYOFF', 'PAYOFF_DELIVERY_LEAD_TIME_DAYS', 'The Company shall deliver customary payoff letters at least three Business Days prior to the Closing Date', 'Company delivers payoff letters three Business Days before Closing');
  const guaranty = stored('guaranty', 'GUARANTY_FINANCING_PARTY', 'LIMITED_GUARANTY_DELIVERY_OR_STATUS_REP', 'LIMITED_GUARANTY_DELIVERED', 'Concurrently with the execution of this Agreement, the Guarantor has delivered the Limited Guaranty to the Company', 'Guarantor delivered the Limited Guaranty at signing');
  const view = buildTableView({ facts: [transfer, withholding, payoff, guaranty], tableShapes, legalSchema });
  const section = (key) => { const found = view.sections.find((candidate) => candidate.section_key === key); assert.ok(found, `${key} renders`); return found; };
  const rowOf = (table, subject) => { const row = table.rows.find((candidate) => candidate.subject === subject); assert.ok(row, `${table.table_key} has ${subject}`); return row; };
  const taxTable = section('tax-matters').tables.find((table) => table.table_key === 'tax-matters-table');
  assert.ok(rowOf(taxTable, 'Transfer tax allocation').backing_facts.some((entry) => entry.fact_id === 'transfer'), 'the fact type names the row');
  assert.ok(rowOf(taxTable, 'Withholding').backing_facts.some((entry) => entry.fact_id === 'withhold'), 'a fact type the shape does not name falls back to the subtype row');
  const financingTable = section('financing').tables.find((table) => table.table_key === 'financing-table');
  assert.ok(rowOf(financingTable, 'Payoff letters').backing_facts.some((entry) => entry.fact_id === 'payoff'));
  assert.ok(rowOf(financingTable, 'Limited guaranty delivered').backing_facts.some((entry) => entry.fact_id === 'guaranty'), 'both families share the one table');
  for (const key of ['tax-matters', 'financing']) assert.deepEqual(section(key).facts_without_readout.map((entry) => entry.fact_id), [], `${key} lists nothing as without a readout`);
  // The as-drafted cell shows the fact's own words.
  const transferRow = rowOf(taxTable, 'Transfer tax allocation');
  assert.ok(transferRow.cells.some((cell) => cell.column_id === 'asDrafted' && /transfer/i.test(cell.text || cell.label || '')), JSON.stringify(transferRow.cells));
  // A deal without financing (or tax facts) has no such section, as a
  // section whose families returned nothing never renders.
  const without = buildTableView({ facts: [transfer], tableShapes, legalSchema });
  assert.equal(without.sections.some((candidate) => candidate.section_key === 'financing'), false);
  assert.ok(without.sections.some((candidate) => candidate.section_key === 'tax-matters'));
});

// Work package 6 (manager, 2026-10-18): generation 8's 3.13(b) and (c)
// facts about the material contracts (the Disclosure Letter list, validity
// and enforceability, two no-default sentences) were UNPLACED. Without a
// readout they are sub-items of the Material Contracts row, the Qualifiers
// cell read from the MAE qualifier they carry.
test('readout-less material contracts representation limbs are sub-items of the Material Contracts row, their MAE qualifier the Qualifiers cell', () => {
  const limb = (id, subtype, text, qualifier, summary) => ({
    fact_id: id, proposal_id: id, family_key: 'MATERIAL_CONTRACTS', subtype_key: subtype, fact_type: subtype, section_reference: '3.13', structure_node_id: 'n-3-13', validation_status: 'VALID',
    statement: `${text}${qualifier ? `, ${qualifier}` : ''}.`, headline: { label: subtype, distinguishing_component_ids: [`${id}-op`], summary },
    components: [
      { component_id: `${id}-op`, kind: 'OPERATION', label: 'statement', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: text.length, gap_before: false, children: [] },
      ...(qualifier ? [{ component_id: `${id}-q`, kind: 'MATERIALITY_QUALIFIER', label: 'qualifier', text: qualifier, origin: 'OWN', source_span_id: 's', start_byte: text.length + 2, end_byte: text.length + 2 + qualifier.length, gap_before: false, children: [] }] : []),
    ],
  });
  const facts = [
    limb('mc-list', 'MATERIAL_CONTRACT_DISCLOSURE_LIST', 'Section 3.13(a) of the Company Disclosure Letter lists each Specified Contract as of the date of this Agreement', null, 'Company Disclosure Letter lists the Company\'s material contracts as of signing, with stated exclusions'),
    limb('mc-status', 'MATERIAL_CONTRACT_STATUS_REPRESENTATION', 'each Specified Contract is valid, binding and in full force and effect', 'except as would not reasonably be expected to have a Company Material Adverse Effect', 'Specified Contracts are valid, binding, enforceable and in full force, absent Material Adverse Effect'),
    limb('mc-default', 'MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT', 'neither the Company nor any of its Subsidiaries is in breach of or default under any Specified Contract', 'except for such breaches and defaults as would not reasonably be expected to have a Company Material Adverse Effect', 'No default under any Specified Contract absent a Company Material Adverse Effect'),
    limb('mc-event', 'MATERIAL_CONTRACT_BREACH_TERMINATION_RIGHT', 'no event has occurred that with notice or lapse of time would constitute a default under any Specified Contract', 'except as would not reasonably be expected to have a Company Material Adverse Effect', 'No event would become a Specified Contract default absent Material Adverse Effect'),
    // A category criterion without a readout keeps its own section.
    limb('mc-cat', 'MATERIAL_CONTRACT_CATEGORY_CRITERION', 'any Contract that would be required to be filed as a material contract pursuant to Item 601(b)(10) of Regulation S-K', null, 'Contracts filed under Item 601(b)(10) are Specified Contracts'),
  ];
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const reps = view.sections.find((section) => section.section_key === 'representations-qualifiers');
  const row = reps.tables[0].rows.find((candidate) => candidate.subject === 'Material Contracts');
  assert.ok(row, 'the Material Contracts row renders');
  assert.deepEqual(row.sub_rows.map((sub) => sub.subject), ['Disclosure list', 'Validity and enforceability', 'No default']);
  const noDefault = row.sub_rows.find((sub) => sub.subject === 'No default');
  assert.deepEqual(noDefault.backing_facts.map((entry) => entry.fact_id).sort(), ['mc-default', 'mc-event'], 'both no-default sentences back the one sub-item');
  const qualifierOf = (line) => { const cell = line.cells.find((candidate) => candidate.column_id === 'materiality'); return cell.values ? cell.values.map((value) => value.label) : [cell.label]; };
  assert.deepEqual(qualifierOf(row.sub_rows.find((sub) => sub.subject === 'Validity and enforceability')), ['MAE (aggregate)']);
  assert.deepEqual(qualifierOf(noDefault), ['MAE (aggregate)']);
  assert.equal(row.sub_rows.find((sub) => sub.subject === 'Disclosure list').cells.find((cell) => cell.column_id === 'materiality').kind, 'dash', 'no qualifier, no pill');
  assert.equal(reps.facts_without_readout.length, 0);
  const materialContracts = view.sections.find((section) => section.section_key === 'material-contracts');
  assert.ok(materialContracts, 'the list section still renders for the category fact');
  assert.deepEqual(materialContracts.facts_without_readout.map((entry) => entry.fact_id), ['mc-cat'], 'a category without a readout is listed under its own section, not under the representations');
  assert.equal(materialContracts.tables.flatMap((table) => table.rows).some((candidate) => candidate.backing_facts.some((entry) => /^mc-(list|status|default|event)$/.test(entry.fact_id))), false, 'no limb is a row of the list table');
});

// Work package 6 (manager, 2026-10-18, generation 8): 3.11's "Company
// Benefit Plan excludes Law-mandated plans sponsored by Governmental
// Entities" vanished behind "Company Benefit Plan covers ..."; 3.09's "Tax
// means ..." vanished behind a component reading from an earlier section.
test('a definition fact replaces a component reading of its term, and two definition facts of one term merge with "; "', () => {
  const definition = (id, reference, term, summary) => ({
    fact_id: id, proposal_id: id, family_key: 'KEY_DEFINED_TERMS', subtype_key: 'OTHER_DEFINED_TERM', fact_type: 'OTHER_DEFINED_TERM_RECORDED', section_reference: reference, structure_node_id: `n-${reference}`,
    headline: { label: 'Other defined term', summary, distinguishing_component_ids: [`${id}-t`] },
    components: [{ component_id: `${id}-t`, kind: 'DEFINED_TERM', label: term, text: `“${term}” means`, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 20, gap_before: false, children: [] }],
  });
  // An earlier section's fact reads "Tax" as a DEFINED_TERM component.
  const earlier = {
    fact_id: 'rep-tax', proposal_id: 'rep-tax', family_key: 'REPRESENTATIONS', subtype_key: 'COMPLIANCE_REPRESENTATION', fact_type: 'TAX_RETURNS_FILED', section_reference: '3.09', structure_node_id: 'n-3-09',
    headline: { label: 'Tax returns', distinguishing_component_ids: ['rep-tax-op'] },
    components: [
      { component_id: 'rep-tax-op', kind: 'OPERATION', label: 'filing', text: 'has timely filed all income Tax Returns', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 40, gap_before: false, children: [] },
      { component_id: 'rep-tax-term', kind: 'DEFINED_TERM', label: 'Tax', text: '“Tax” means any federal, state, local or foreign tax', origin: 'DEFINITION', source_span_id: 'd', start_byte: 0, end_byte: 50, resolves_to: { text: '“Tax” means any federal, state, local or foreign tax' }, children: [] },
    ],
  };
  const taxDefinition = definition('def-tax', '3.09', 'Tax', 'Tax means any federal, state, local or foreign income, gross receipts or other tax, with interest and penalties');
  const planCovers = definition('def-plan-1', '3.11', 'Company Benefit Plan', 'Company Benefit Plan covers each employee benefit plan the Company sponsors or contributes to');
  const planExcludes = definition('def-plan-2', '3.11', 'Company Benefit Plan', 'Company Benefit Plan excludes Law-mandated plans sponsored by Governmental Entities');
  const view = buildTableView({ facts: [earlier, taxDefinition, planCovers, planExcludes], tableShapes, legalSchema });
  const tax = view.defined_terms.filter((entry) => entry.term.toLowerCase() === 'tax');
  assert.equal(tax.length, 1, 'one Tax entry');
  assert.equal(tax[0].fact_id, 'def-tax', 'the definition fact is the entry, not the component reading');
  assert.equal(tax[0].definition, taxDefinition.headline.summary);
  const plan = view.defined_terms.filter((entry) => entry.term === 'Company Benefit Plan');
  assert.equal(plan.length, 1, 'one Company Benefit Plan entry');
  assert.equal(plan[0].definition, `${planCovers.headline.summary}; ${planExcludes.headline.summary}`);
  assert.equal(plan[0].fact_id, 'def-plan-1');
  // The same facts in the other order give the same entries.
  const reversed = buildTableView({ facts: [planExcludes, planCovers, taxDefinition, earlier], tableShapes, legalSchema });
  assert.equal(reversed.defined_terms.find((entry) => entry.term === 'Company Benefit Plan').definition, `${planExcludes.headline.summary}; ${planCovers.headline.summary}`);
  assert.equal(reversed.defined_terms.filter((entry) => entry.term.toLowerCase() === 'tax').length, 1);
  // A repeated identical summary is not joined to itself.
  const twice = buildTableView({ facts: [planCovers, { ...planCovers, fact_id: 'def-plan-1b', proposal_id: 'def-plan-1b' }], tableShapes, legalSchema });
  assert.equal(twice.defined_terms.find((entry) => entry.term === 'Company Benefit Plan').definition, planCovers.headline.summary);
});

// Work package 7 (a): generation 8's 5.02(e) subsequent match period, with
// the readout's period cell left to the page: the deemed value, 2 business
// days, not the stated 4; a two-period text with no deeming leaves the cell
// empty and the row shows the summary alone.
test('the page reads a deemed period as the deemed value and leaves a two-period text empty', () => {
  const match = (id, text) => ({
    fact_id: id, proposal_id: id, family_key: 'NO_SHOP', subtype_key: 'SUBSEQUENT_MATCH_PERIOD', fact_type: 'SUBSEQUENT_MATCH_PERIOD', section_reference: '5.02(e)', structure_node_id: 'n-5-02', validation_status: 'VALID',
    headline: { label: 'Subsequent match period', distinguishing_component_ids: [`${id}-p`], summary: 'Each amended proposal restarts a shorter match period' },
    components: [
      { component_id: `${id}-op`, kind: 'OPERATION', label: 'restart', text: 'a new notice period shall commence', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 34, gap_before: false, children: [] },
      { component_id: `${id}-p`, kind: 'PERIOD', label: 'period', text, origin: 'OWN', source_span_id: 's', start_byte: 40, end_byte: 40 + text.length, gap_before: true, children: [] },
    ],
    conclusions: { table_key: 'nosol-superior-matching-rights', row_label: 'Subsequent match period', cells: [] },
  });
  const deemed = match('deemed', 'except that the references to four (4) business days will be deemed two (2) business days');
  const twoPeriods = match('two', 'within ten (10) business days, or 48 hours for an amendment');
  const cellOf = (view, id) => view.sections.flatMap((section) => section.tables).find((table) => table.table_key === 'nosol-superior-matching-rights')
    .rows.find((row) => row.backing_facts.some((entry) => entry.fact_id === id)).cells.find((cell) => cell.column_id === 'period');
  assert.equal(cellOf(buildTableView({ facts: [deemed], tableShapes, legalSchema }), 'deemed').label, '2 business days');
  assert.equal(cellOf(buildTableView({ facts: [twoPeriods], tableShapes, legalSchema }), 'two'), undefined, 'the one row leaves the column empty, so the column is not rendered (work package 12)');
});

// Work package 7 (b): a definition fact whose readout named the retired
// `defined-terms-table` is a Defined Terms entry and nothing else.
test('a definition fact taken into Defined Terms is never listed under a section as without a readout', () => {
  const fact = {
    fact_id: 'def-law', proposal_id: 'def-law', family_key: 'KEY_DEFINED_TERMS', subtype_key: 'OTHER_DEFINED_TERM', fact_type: 'OTHER_DEFINED_TERM_RECORDED', section_reference: '9.03', structure_node_id: 'n-9-03', validation_status: 'VALID',
    headline: { label: 'Other defined term', summary: 'Law means any statute, rule, regulation or order of a Governmental Entity', distinguishing_component_ids: ['def-law-t'] },
    components: [{ component_id: 'def-law-t', kind: 'DEFINED_TERM', label: 'Law', text: '“Law” means any statute, rule, regulation or order', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 50, gap_before: false, children: [] }],
    conclusions: { table_key: 'defined-terms-table', row_label: 'Law', cells: [{ column_id: 'definition', text: 'any statute, rule, regulation or order', component_ids: ['def-law-t'] }] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  assert.ok(view.defined_terms.some((entry) => entry.term === 'Law' && entry.fact_id === 'def-law'));
  assert.deepEqual(view.sections.filter((section) => section.facts_without_readout.some((entry) => entry.fact_id === 'def-law')).map((section) => section.section_key), []);
  assert.equal(view.sections.flatMap((section) => section.tables).some((table) => table.rows.some((row) => row.backing_facts.some((entry) => entry.fact_id === 'def-law'))), false);
});

// Work package 7 (c): the Board determination standard rows carried no code
// when the model returned none though the STANDARD words name it. The page
// codes the empty cell from the words, the stricter reading when the words
// say "reasonably likely to be inconsistent", and marks the derivation.
test('an empty Board determination standard cell is coded from the fact\'s words, the derivation marked', () => {
  const standard = (id, tableKey, words) => ({
    fact_id: id, proposal_id: id, family_key: 'NO_SHOP', subtype_key: 'EXCEPTION_PREREQUISITE', fact_type: 'EXCEPTION_PREREQUISITE', section_reference: '5.02(c)', structure_node_id: 'n-5-02', validation_status: 'VALID',
    statement: `The Board may take such action only if it has concluded in good faith that failure to do so ${words}.`,
    headline: { label: 'Board standard', distinguishing_component_ids: [`${id}-std`], summary: 'Board acts only when its fiduciary duties so require' },
    components: [{ component_id: `${id}-std`, kind: 'STANDARD', label: 'standard', text: words, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: words.length, gap_before: false, children: [] }],
    conclusions: { table_key: tableKey, row_label: 'Board determination standard', cells: [] },
  });
  const cellOf = (view, tableKey) => view.sections.flatMap((section) => section.tables).find((table) => table.table_key === tableKey)
    .rows.find((row) => row.subject === 'Board determination standard').cells.find((cell) => cell.column_id === 'provision');
  const likely = cellOf(buildTableView({ facts: [standard('likely', 'nosol-fiduciary-table', 'would be, or would be reasonably likely to be, inconsistent with its fiduciary duties under applicable Law')], tableShapes, legalSchema }), 'nosol-fiduciary-table');
  assert.equal(likely.code, 'REASONABLY_LIKELY_TO_BE_INCONSISTENT_WITH_FIDUCIARY_DUTIES');
  assert.equal(likely.derived, 'code_from_words');
  assert.deepEqual(likely.component_ids, ['likely-std'], 'the cell cites the words that named the code');
  const plain = cellOf(buildTableView({ facts: [standard('plain', 'nosol-intervening-table', 'would be inconsistent with its fiduciary duties under applicable Law')], tableShapes, legalSchema }), 'nosol-intervening-table');
  assert.equal(plain.code, 'INCONSISTENT_WITH_FIDUCIARY_DUTIES');
  // The intervening table's provision column is derived on its termination
  // row alone; the other rows keep the readouts' cells (every row's cell
  // was overwritten with a dash before work package 7).
  const excluded = { ...standard('excluded', 'nosol-intervening-table', 'other than events relating to an Acquisition Proposal'), subtype_key: 'INTERVENING_EVENT', family_key: 'KEY_DEFINED_TERMS', conclusions: { table_key: 'nosol-intervening-table', row_label: 'Excluded events', cells: [{ column_id: 'provision', code: 'ACQUISITION_PROPOSAL_RELATED', component_ids: ['excluded-std'] }] } };
  const excludedView = buildTableView({ facts: [excluded], tableShapes, legalSchema });
  const excludedCell = excludedView.sections.flatMap((section) => section.tables).find((table) => table.table_key === 'nosol-intervening-table').rows.find((row) => row.subject === 'Excluded events').cells.find((cell) => cell.column_id === 'provision');
  assert.equal(excludedCell.code, 'ACQUISITION_PROPOSAL_RELATED', 'a model-returned code on a non-derived row survives');
  // A code the model did return is never overwritten.
  const coded = { ...standard('coded', 'nosol-fiduciary-table', 'would be inconsistent with its fiduciary duties'), conclusions: { table_key: 'nosol-fiduciary-table', row_label: 'Board determination standard', cells: [{ column_id: 'provision', code: 'WOULD_VIOLATE_FIDUCIARY_DUTIES', component_ids: ['coded-std'] }] } };
  const kept = cellOf(buildTableView({ facts: [coded], tableShapes, legalSchema }), 'nosol-fiduciary-table');
  assert.equal(kept.code, 'WOULD_VIOLATE_FIDUCIARY_DUTIES');
  assert.equal(kept.derived, undefined);
});

// Work package 7 (d): six no-shop facts of generation 8's 5.02 had no row.
test('the six 5.02 permissions take their rows or the other-provisions entry by default', () => {
  const noShop = (id, subtype, text, summary) => ({
    fact_id: id, proposal_id: id, family_key: 'NO_SHOP', subtype_key: subtype, fact_type: subtype, section_reference: '5.02', structure_node_id: 'n-5-02', validation_status: 'VALID',
    statement: text, headline: { label: subtype, distinguishing_component_ids: [`${id}-op`], summary },
    components: [{ component_id: `${id}-op`, kind: 'OPERATION', label: 'operation', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: text.length, gap_before: false, children: [] }],
  });
  const facts = [
    noShop('clarify', 'EXCEPTION_PREREQUISITE', 'the Company may contact the Person making a Company Takeover Proposal solely to clarify the terms and conditions thereof', 'Company may contact a bidder solely to clarify its takeover proposal terms'),
    noShop('terms', 'EXCEPTION_PREREQUISITE', 'the Company and its Representatives may inform a Person of the existence of the provisions of this Section 5.02', 'Company and Representatives may tell a bidder the terms of these no-solicitation provisions'),
    noShop('law', 'EXCEPTION_PREREQUISITE', 'the Company may make any disclosure to its stockholders that the Board determines in good faith is required by applicable Law', 'Company may make disclosures its Board determines are required by applicable Law'),
    noShop('not-change', 'RECOMMENDATION_CHANGE', 'the foregoing disclosure permissions shall not be deemed to permit the Board to make an Adverse Recommendation Change', 'Disclosure permissions alone do not permit a change of recommendation'),
    noShop('negotiate', 'EXCEPTION_PREREQUISITE', 'the Company may engage in negotiations or discussions with the Person making a Qualifying Company Takeover Proposal', 'Company may negotiate with the Person making a Qualifying Company Takeover Proposal'),
    noShop('takeover', 'RECOMMENDATION_CHANGE', 'an Adverse Recommendation Change shall not change the approval of the Board for purposes of causing any Takeover Law to be inapplicable to the Merger', 'Adverse Recommendation Change does not withdraw board approval for takeover statutes'),
  ];
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const tables = view.sections.flatMap((section) => section.tables);
  const table = (key) => { const found = tables.find((candidate) => candidate.table_key === key); assert.ok(found, key); return found; };
  const rowOf = (key, subject) => { const row = table(key).rows.find((candidate) => candidate.subject === subject); assert.ok(row, `${key}: ${subject}`); return row; };
  const permitted = rowOf('nosol-noshop-core-mechanics', 'Permitted contact: clarification and the no-shop\'s terms');
  assert.deepEqual(permitted.backing_facts.map((entry) => entry.fact_id).sort(), ['clarify', 'terms']);
  const permittedCell = permitted.cells.find((cell) => cell.column_id === 'provision');
  assert.equal(permittedCell.values ? permittedCell.values[0].code : permittedCell.code, 'YES');
  const notChange = rowOf('nosol-fiduciary-change-of-recommendation', 'Not a Change of Recommendation');
  assert.deepEqual(notChange.backing_facts.map((entry) => entry.fact_id).sort(), ['law', 'not-change']);
  const codes = (cell) => (cell.values ? cell.values.map((value) => value.code) : [cell.code]).sort();
  assert.deepEqual(codes(notChange.cells.find((cell) => cell.column_id === 'provision')), ['DISCLOSURE_PERMISSION_NOT_A_CHANGE', 'DISCLOSURE_REQUIRED_BY_LAW']);
  assert.ok(rowOf('nosol-fiduciary-table', 'Engagement standard').backing_facts.some((entry) => entry.fact_id === 'negotiate'));
  const changeTable = table('nosol-fiduciary-change-of-recommendation');
  assert.ok(changeTable.other_provisions, 'the takeover-statute carve-out is an other provision');
  assert.ok(JSON.stringify(changeTable.other_provisions).includes('takeover'), JSON.stringify(changeTable.other_provisions).slice(0, 300));
  assert.equal(changeTable.rows.some((row) => row.backing_facts.some((entry) => entry.fact_id === 'takeover')), false, 'never a row');
  const unplaced = view.sections.flatMap((section) => section.facts_without_readout.map((entry) => entry.fact_id));
  assert.deepEqual(unplaced, [], 'every one of the six has a place');
});

// Work package 8 (manager, 2026-10-18): the cited words are the truth, the
// stored number a reading of them. Generation 8's subsequent match period
// stored 4 business days; its cited words deem the four two.
test('a stored value cell whose cited words parse to a different value shows the parsed value, marked reparsed; unparsable words keep the stored value', () => {
  const stored = (id, text, canonical) => ({
    fact_id: id, proposal_id: id, family_key: 'NO_SHOP', subtype_key: 'SUBSEQUENT_MATCH_PERIOD', fact_type: 'SUBSEQUENT_MATCH_PERIOD', section_reference: '5.02(e)', structure_node_id: 'n-5-02', validation_status: 'VALID',
    headline: { label: 'Subsequent match period', distinguishing_component_ids: [`${id}-p`], summary: 'Each amended proposal restarts a shorter match period' },
    components: [{ component_id: `${id}-p`, kind: 'PERIOD', label: 'period', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: text.length, gap_before: false, children: [] }],
    conclusions: { table_key: 'nosol-superior-matching-rights', row_label: 'Subsequent match period', cells: [{ column_id: 'period', value: { canonical, unit: 'BUSINESS_DAY' }, component_ids: [`${id}-p`] }] },
  });
  const cellOf = (fact) => buildTableView({ facts: [fact], tableShapes, legalSchema }).sections.flatMap((section) => section.tables)
    .find((table) => table.table_key === 'nosol-superior-matching-rights').rows[0].cells.find((cell) => cell.column_id === 'period');
  const deemed = cellOf(stored('deemed', 'except that the references to four (4) business days will be deemed two (2) business days', 4));
  assert.equal(deemed.label, '2 business days');
  assert.equal(deemed.reparsed, true);
  assert.deepEqual(deemed.value, { canonical: 2, unit: 'BUSINESS_DAY' });
  assert.deepEqual(deemed.stored_value, { canonical: 4, unit: 'BUSINESS_DAY' });
  const plain = cellOf(stored('plain', 'a period of four (4) business days', 4));
  assert.equal(plain.label, '4 business days');
  assert.equal(plain.reparsed, undefined);
  const unparsable = cellOf(stored('words', 'a reasonable period after the notice', 3));
  assert.equal(unparsable.label, '3 business days', 'words that do not parse keep the stored value');
  assert.equal(unparsable.reparsed, undefined);
});

// Work package 8: generation 8's 8.02(a) willful-breach definition carried a
// readout naming a table where its row does not exist and vanished. A
// KEY_DEFINED_TERMS fact whose readout lands on no row is a Defined Terms
// entry, never dropped.
test('a definition fact whose readout lands on no row falls back to a Defined Terms entry', () => {
  const willful = (readout) => ({
    fact_id: 'wb', proposal_id: 'wb', family_key: 'KEY_DEFINED_TERMS', subtype_key: 'WILLFUL_BREACH', fact_type: 'WILLFUL_BREACH_DEFINED', section_reference: '8.02', structure_node_id: 'n-8-02', validation_status: 'VALID',
    headline: { label: 'Willful breach', summary: 'Willful and material breach means material breach or material failure to perform', distinguishing_component_ids: ['wb-t'] },
    components: [{ component_id: 'wb-t', kind: 'DEFINED_TERM', label: 'Willful and Material Breach', text: '“Willful and Material Breach” means a material breach that is a consequence of a deliberate act', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 90, gap_before: false, children: [] }],
    conclusions: readout,
  });
  const cases = [
    ['unknown row on a fixed-list table', { table_key: 'termination-rights-mutual', row_label: 'Willful breach', cells: [] }],
    ['a table of another family', { table_key: 'tax-matters-table', row_label: 'Withholding', cells: [] }],
    ['a retired table', { table_key: 'defined-terms-table', row_label: 'Willful and Material Breach', cells: [] }],
  ];
  for (const [label, readout] of cases) {
    const view = buildTableView({ facts: [willful(readout)], tableShapes, legalSchema });
    const entry = view.defined_terms.find((candidate) => candidate.fact_id === 'wb');
    assert.ok(entry, `${label}: a Defined Terms entry`);
    assert.equal(entry.term, 'Willful and Material Breach', label);
    assert.equal(entry.definition, 'Willful and material breach means material breach or material failure to perform', label);
    assert.equal(view.sections.flatMap((section) => section.tables).some((table) => table.rows.some((row) => row.backing_facts.some((b) => b.fact_id === 'wb'))), false, `${label}: no row`);
    assert.deepEqual(view.sections.filter((section) => section.facts_without_readout.some((e) => e.fact_id === 'wb')), [], `${label}: not listed without a readout`);
  }
  // A readout on a row the shapes have is kept (the superior-proposal definition's own table).
  const superior = { ...willful({ table_key: 'nosol-superior-acquisition-proposal-definition', row_label: 'Acquisition Proposal', cells: [] }), subtype_key: 'ACQUISITION_PROPOSAL', fact_id: 'ap', proposal_id: 'ap' };
  const kept = buildTableView({ facts: [superior], tableShapes, legalSchema });
  assert.ok(kept.sections.flatMap((section) => section.tables).find((table) => table.table_key === 'nosol-superior-acquisition-proposal-definition').rows.some((row) => row.subject === 'Acquisition Proposal'));
});

// Work package 13 (c) (manager, 2026-10-18, plan finding (79), NCS
// generation 5, 2.1): "the three exchange ratios and the cash value sit in
// Defined Terms while the consideration-components table shows 'Stock
// election' and 'Acquirer stock' rows with no ratio or value. The shape needs
// the election options as rows (cash election, share election, mixed
// election: ratio, cash, value per share) filled from the facts, with a
// value fallback from a defined ratio that carries a number". The fixture
// is NCS 2.1 as generation 5 stored it: the share-only election fact (read
// out as STOCK_ELECTION, ratio 0.5537), the mixed election fact (read out as
// PARENT_STOCK, ratio 0.2392, its cash leg named "Cash Consideration"), the
// no-election default, and the definitions of Cash Exchange Ratio (0.1371),
// Cash Consideration (a formula) and Share Consideration Exchange Ratio.
function ncsElectionFacts() {
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  const definition = (id, term, definitionText) => ({
    fact_id: id, proposal_id: id, family_key: 'KEY_DEFINED_TERMS', subtype_key: 'OTHER_DEFINED_TERM', fact_type: 'OTHER_DEFINED_TERM_RECORDED', section_reference: '2.1', structure_node_id: 'n-2-1', validation_status: 'VALID',
    headline: { label: 'Other defined term', summary: `${term} means ${definitionText}`, distinguishing_component_ids: [`${id}-t`] },
    components: [component(`${id}-t`, 'TERM', `“${term}”`, 0), component(`${id}-op`, 'OPERATION', `means ${definitionText}`, 30)],
  });
  const share = {
    fact_id: 'share', proposal_id: 'share', family_key: 'CONSIDERATION', subtype_key: 'STOCK_COMPONENT', fact_type: 'PER_SHARE_CASH_CONSIDERATION', section_reference: '2.1', structure_node_id: 'n-2-1', validation_status: 'VALID',
    headline: { label: 'Share election', distinguishing_component_ids: ['share-cond'] },
    components: [
      component('share-actor', 'ACTOR', 'for each Share of Company Common Stock', 0),
      component('share-cond', 'CONDITION', 'with respect to which an election to receive only share consideration has been made and not validly revoked pursuant to Section 2.5', 40),
      component('share-stock', 'DEFINED_TERM', '(the “Share Election Stock”)', 170),
      component('share-obj', 'OBJECT', 'that number of Parent Ordinary Shares equal to the Share Consideration Exchange Ratio', 200),
      component('share-term', 'DEFINED_TERM', '(the “Share Consideration”)', 290),
      component('share-ratio', 'AMOUNT', '“Share Consideration Exchange Ratio” means 0.5537', 2000),
    ],
    conclusions: { table_key: 'consideration-components', row_label: 'Stock election', cells: [
      { column_id: 'form', code: 'STOCK_ELECTION', component_ids: ['share-cond'] },
      { column_id: 'amount', value: { canonical: 0.5537, unit: 'COUNT' }, component_ids: ['share-ratio'] },
      { column_id: 'per', code: 'PER_SHARE_OF_COMPANY_COMMON_STOCK', component_ids: ['share-actor'] },
      { column_id: 'definedAs', text: 'Share Consideration', component_ids: ['share-term'] },
    ] },
  };
  const mixed = {
    fact_id: 'mixed', proposal_id: 'mixed', family_key: 'CONSIDERATION', subtype_key: 'STOCK_COMPONENT', fact_type: 'PER_SHARE_CASH_CONSIDERATION', section_reference: '2.1', structure_node_id: 'n-2-1', validation_status: 'VALID',
    headline: { label: 'Mixed election', distinguishing_component_ids: ['mixed-cond'] },
    components: [
      component('mixed-actor', 'ACTOR', 'for each Share of Company Common Stock', 400),
      component('mixed-cond', 'CONDITION', 'with respect to which an election to receive mixed consideration has been made and not validly revoked pursuant to Section 2.5', 440),
      component('mixed-obj', 'OBJECT', '(B) that number of Parent Ordinary Shares equal to the Mixed Share Consideration Exchange Ratio', 560),
      component('mixed-term', 'DEFINED_TERM', '(the “Mixed Share Consideration” and together with the Cash Consideration, the “Mixed Consideration”)', 660),
      component('mixed-ratio', 'AMOUNT', '“Mixed Share Consideration Exchange Ratio” means 0.2392', 2100),
    ],
    conclusions: { table_key: 'consideration-components', row_label: 'Acquirer stock', cells: [
      { column_id: 'form', code: 'PARENT_STOCK', component_ids: ['mixed-obj'] },
      { column_id: 'amount', value: { canonical: 0.2392, unit: 'COUNT' }, component_ids: ['mixed-ratio'] },
      { column_id: 'definedAs', text: 'Mixed Share Consideration', component_ids: ['mixed-term'] },
    ] },
  };
  const noElection = {
    fact_id: 'default', proposal_id: 'default', family_key: 'CONSIDERATION', subtype_key: 'ELECTION', fact_type: 'PER_SHARE_CASH_CONSIDERATION', section_reference: '2.1', structure_node_id: 'n-2-1', validation_status: 'VALID',
    headline: { label: 'No election', summary: 'Default Stock with no election receives the Share Consideration', distinguishing_component_ids: ['default-cond'] },
    components: [
      component('default-cond', 'CONDITION', 'with respect to which no election to receive Share Consideration or Mixed Consideration has been made', 800),
      component('default-term', 'DEFINED_TERM', '(the “Default Stock”)', 900),
      component('default-obj', 'OBJECT', 'the Share Consideration', 930),
    ],
    conclusions: { table_key: 'consideration-hero-election-mechanics', row_label: 'If no election', cells: [{ column_id: 'body', text: 'the Share Consideration', component_ids: ['default-cond', 'default-obj'] }] },
  };
  return {
    share, mixed, noElection,
    cashRatio: definition('def-cash-ratio', 'Cash Exchange Ratio', '0.1371'),
    cashConsideration: definition('def-cash', 'Cash Consideration', 'cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price'),
    shareRatio: definition('def-share-ratio', 'Share Consideration Exchange Ratio', '0.5537'),
    mixedRatio: definition('def-mixed-ratio', 'Mixed Share Consideration Exchange Ratio', '0.2392'),
    closingPrice: definition('def-price', 'Parent Closing Price', 'the volume weighted average price of a Parent Ordinary Share for the ten trading days before the Closing Date'),
  };
}

test('the election options table: one row per election from the facts, the cash leg\'s terms and their numbers from the definitions, no row for the no-election default', () => {
  const facts = ncsElectionFacts();
  const view = buildTableView({ facts: Object.values(facts), tableShapes, legalSchema });
  const tables = view.sections.flatMap((section) => section.tables);
  const options = tables.find((table) => table.table_key === 'consideration-election-options');
  assert.ok(options, 'the table exists');
  // Ben, 2026-10-18 (plan finding (85)): an option no fact is for reads
  // "Not a deal feature"; the default is no row.
  assert.deepEqual(options.rows.map((row) => [row.subject, row.absent === true]), [['Cash election', true], ['Stock election', false], ['Mixed election', false]], 'the two elections NCS offers, in the fixed order, and the one it does not');
  assert.equal(options.absent_row_label, 'Not a deal feature');
  assert.equal(options.rows[0].absent_label, undefined, 'no held fact: the table\'s own absent words');
  assert.deepEqual(options.columns.map((column) => column.column_id), ['exchangeRatio', 'valueTerms'], 'no cash number and no stated value per share: those columns are not rendered');
  assert.deepEqual(options.hidden_columns.map((column) => column.column_id), ['cashPerShare', 'valuePerShare']);
  const [, stock, mixedRow] = options.rows;
  const cell = (row, columnId) => row.cells.find((candidate) => candidate.column_id === columnId);
  assert.equal(stock.subject_note, 'Share Consideration');
  assert.equal(cell(stock, 'exchangeRatio').label, '0.5537', 'the readout\'s own ratio, every digit');
  assert.deepEqual(cell(stock, 'exchangeRatio').component_ids, ['share-ratio']);
  assert.equal(cell(stock, 'exchangeRatio').derived, undefined, 'a readout cell is not marked derived');
  assert.equal(cell(stock, 'valueTerms').kind, 'dash', 'the option\'s own term and its numeric ratio are not value terms to list');
  assert.equal(mixedRow.subject_note, 'Mixed Share Consideration');
  assert.equal(cell(mixedRow, 'exchangeRatio').label, '0.2392');
  const terms = cell(mixedRow, 'valueTerms');
  assert.deepEqual(terms.values.map((value) => value.label), [
    'Cash Consideration means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price',
    'Cash Exchange Ratio: 0.1371',
  ], 'the cash leg\'s term with its definition, then the number of the ratio that definition names; "Share Consideration" inside "Mixed Share Consideration" is not a term the fact names');
  assert.deepEqual(terms.values.map((value) => value.fact_ids), [['def-cash'], ['def-cash-ratio']], 'each entry cites its definition');
  assert.deepEqual(mixedRow.backing_facts.map((entry) => entry.fact_id), ['mixed']);
  // The components table keeps its own rows and now shows every digit.
  const components = tables.find((table) => table.table_key === 'consideration-components');
  assert.deepEqual(components.rows.map((row) => [row.subject, cell(row, 'amount').label]), [['Stock election', '0.5537'], ['Acquirer stock', '0.2392']]);
  // The mechanics table still has the default.
  assert.ok(tables.find((table) => table.table_key === 'consideration-hero-election-mechanics').rows.some((row) => row.subject === 'If no election'));
});

test('the election options: a bare numeric definition fills an empty ratio or cash cell; a deal without an election has no table', () => {
  const facts = ncsElectionFacts();
  // The share fact without its readout value and without its own ratio
  // component: the ratio comes from the "Share Consideration Exchange
  // Ratio" definition it names.
  const share = { ...facts.share, components: facts.share.components.filter((component) => component.component_id !== 'share-ratio'),
    conclusions: { ...facts.share.conclusions, cells: facts.share.conclusions.cells.filter((cell) => cell.column_id !== 'amount') } };
  const cashOnly = {
    ...facts.mixed, fact_id: 'cash-only', proposal_id: 'cash-only', subtype_key: 'CASH_COMPONENT',
    components: [
      { ...facts.mixed.components[0], component_id: 'cash-only-actor' },
      { ...facts.mixed.components[1], component_id: 'cash-only-cond', text: 'with respect to which an election to receive cash has been made and not validly revoked' },
      { ...facts.mixed.components[2], component_id: 'cash-only-obj', text: 'an amount in cash equal to the Per Share Cash Amount' },
      { ...facts.mixed.components[3], component_id: 'cash-only-term', text: '(the “Cash Election Consideration”)' },
    ],
    conclusions: { table_key: 'consideration-components', row_label: 'Cash election', cells: [{ column_id: 'form', code: 'CASH_ELECTION', component_ids: ['cash-only-cond'] }] },
  };
  const perShareCash = { ...facts.cashRatio, fact_id: 'def-psca', proposal_id: 'def-psca', headline: { ...facts.cashRatio.headline, summary: 'Per Share Cash Amount means $12.50', distinguishing_component_ids: ['def-psca-t'] },
    components: [{ ...facts.cashRatio.components[0], component_id: 'def-psca-t', text: '“Per Share Cash Amount”' }, { ...facts.cashRatio.components[1], component_id: 'def-psca-op', text: 'means $12.50' }] };
  const view = buildTableView({ facts: [share, cashOnly, facts.shareRatio, perShareCash, facts.cashConsideration, facts.cashRatio], tableShapes, legalSchema });
  const options = view.sections.flatMap((section) => section.tables).find((table) => table.table_key === 'consideration-election-options');
  assert.deepEqual(options.rows.map((row) => [row.subject, row.absent === true]), [['Cash election', false], ['Stock election', false], ['Mixed election', true]]);
  const [cash, stock] = options.rows;
  // Each value column is filled on one line of a two-row table, so Ben's
  // column rule (plan finding (42)) folds it into that line as a trailing
  // detail; the value-terms column has nothing and is not rendered.
  assert.deepEqual(options.columns, []);
  const detail = (row, columnId) => (row.trailing_details || []).find((candidate) => candidate.column_id === columnId);
  assert.deepEqual(cash.trailing_details.map((entry) => entry.label), ['Cash per share $12.50'], 'the cash per share from the definition the option names');
  assert.equal(detail(cash, 'cashPerShare').cell.derived, 'defined_term');
  assert.deepEqual(detail(cash, 'cashPerShare').cell.fact_ids, ['def-psca', 'cash-only'], 'cites the definition and the option fact');
  assert.equal(detail(cash, 'exchangeRatio'), undefined);
  assert.deepEqual(stock.trailing_details.map((entry) => entry.label), ['Exchange ratio 0.5537'], 'the ratio from the definition');
  assert.equal(detail(stock, 'exchangeRatio').cell.derived, 'defined_term');
  assert.deepEqual(detail(stock, 'exchangeRatio').cell.fact_ids, ['def-share-ratio', 'share']);
  // Metsera (cash plus a CVR, no election): no election options table.
  const metsera = buildTableView({ facts: [facts.cashRatio, facts.cashConsideration], tableShapes, legalSchema });
  assert.equal(metsera.sections.flatMap((section) => section.tables).some((table) => table.table_key === 'consideration-election-options'), false);
});

// Work package 13 (c): the combined definition's term is the consideration
// term, not the package fact's first defined term (NCS 2.1: “Eligible
// Shares” came first; the “Merger Consideration” is quoted in the OBJECT).
test('the combined definition takes the term matching term_words, a DEFINED_TERM first, else none', () => {
  const component = (id, kind, text, start) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [] });
  const pack = (components) => ({
    fact_id: 'pack', proposal_id: 'pack', family_key: 'CONSIDERATION', subtype_key: 'CONSIDERATION_PACKAGE', section_reference: '2.1', structure_node_id: 'n', validation_status: 'VALID',
    headline: { label: 'Consideration package', summary: 'Each Eligible Share converts into the Merger Consideration', distinguishing_component_ids: [components[0].component_id] },
    components,
    conclusions: { table_key: 'consideration-structure', row_label: 'the Merger', cells: [{ column_id: 'considerationType', code: 'MIXED_ELECTION', component_ids: [components[0].component_id] }] },
  });
  const share = ncsElectionFacts().share;
  const componentsTable = (facts) => buildTableView({ facts, tableShapes, legalSchema }).sections.flatMap((section) => section.tables).find((table) => table.table_key === 'consideration-components');
  const quotedInObject = componentsTable([share, pack([
    component('pack-actor', 'ACTOR', 'each share (such shares, collectively, the “Shares”) of common stock of the Company', 0),
    component('pack-eligible', 'DEFINED_TERM', '(such shares, the “Eligible Shares”)', 90),
    component('pack-obj', 'OBJECT', 'the following consideration from Parent (such consideration, the “Merger Consideration”)', 130),
  ])]);
  assert.equal(quotedInObject.combined_definition.term, 'Merger Consideration');
  assert.deepEqual(quotedInObject.combined_definition.component_ids, ['pack-obj']);
  const definedTermFirst = componentsTable([share, pack([
    component('pack-obj', 'OBJECT', 'the following consideration from Parent (such consideration, the “Merger Consideration”)', 0),
    component('pack-term', 'DEFINED_TERM', '(the “Per Share Consideration”)', 100),
  ])]);
  assert.equal(definedTermFirst.combined_definition.term, 'Per Share Consideration', 'a DEFINED_TERM component matching the pattern comes before an OBJECT\'s quote');
  const noConsiderationTerm = componentsTable([share, pack([component('pack-eligible', 'DEFINED_TERM', '(such shares, the “Eligible Shares”)', 0)])]);
  assert.equal(noConsiderationTerm.combined_definition, undefined, 'no consideration term, no combined definition');
});

// Work package 14 (manager, 2026-10-18 17:25 UTC): "the cash leg's fact,
// VALID now, may fill the Mixed election row's cash through its words:
// check and record what the NCS 2.1 rows read after the change". The cash
// leg carries the Cash Consideration formula as an AMOUNT with no number;
// it backs the Mixed election row, fills no cash figure, and its Cash
// Exchange Ratio is a factor of the formula, never the option's exchange
// ratio.
test('the election options: a formula amount backs its option, fills no cell, and its factors are value terms, not the ratio', () => {
  const facts = ncsElectionFacts();
  const formula = '“Cash Consideration” means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price.';
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  const cashLeg = {
    fact_id: 'cash-leg', proposal_id: 'cash-leg', family_key: 'CONSIDERATION', subtype_key: 'CASH_COMPONENT', fact_type: 'PER_SHARE_CASH_CONSIDERATION', section_reference: '2.1', structure_node_id: 'n-2-1', validation_status: 'VALID',
    headline: { label: 'Mixed election cash', summary: 'Each mixed-election share receives the Cash Consideration', distinguishing_component_ids: ['cash-leg-amt'] },
    components: [
      component('cash-leg-cond', 'CONDITION', 'with respect to which an election to receive mixed consideration has been made and not validly revoked pursuant to Section 2.5', 1000),
      component('cash-leg-obj', 'OBJECT', '(A) the Cash Consideration', 1120),
      component('cash-leg-amt', 'AMOUNT', formula, 2200, { value: { canonical: null, unit: null, form: 'FORMULA' } }),
    ],
  };
  const view = buildTableView({ facts: [...Object.values(facts), cashLeg], tableShapes, legalSchema });
  const options = view.sections.flatMap((section) => section.tables).find((table) => table.table_key === 'consideration-election-options');
  const mixedRow = options.rows.find((row) => row.subject === 'Mixed election');
  const cell = (row, columnId) => row.cells.find((candidate) => candidate.column_id === columnId);
  assert.deepEqual(mixedRow.backing_facts.map((entry) => entry.fact_id), ['mixed', 'cash-leg'], 'the cash leg backs the mixed election');
  assert.equal(cell(mixedRow, 'exchangeRatio').label, '0.2392', 'the Cash Exchange Ratio is not a second exchange ratio');
  assert.equal(cell(mixedRow, 'exchangeRatio').values, undefined);
  assert.deepEqual(options.hidden_columns.map((column) => column.column_id), ['cashPerShare', 'valuePerShare'], 'a formula states no cash figure and no value per share');
  assert.deepEqual(cell(mixedRow, 'valueTerms').values.map((value) => value.label), [
    'Cash Consideration means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price',
    'Cash Exchange Ratio: 0.1371',
  ]);
});

// Work package 14 (plan finding (81)): "the capitalization row shows 0, as
// it shows a stated number" (NCS 3.2, "no shares of Company Preferred Stock
// were issued and outstanding").
test('the capitalization table shows a count of none as 0, with and without a readout', () => {
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  const base = {
    fact_id: 'pref', proposal_id: 'pref', family_key: 'CAPITALISATION', subtype_key: 'ISSUED_AND_OUTSTANDING', fact_type: 'CAPITALISATION_ISSUED_AND_OUTSTANDING', section_reference: '3.2', structure_node_id: 'n-3-2', validation_status: 'VALID',
    headline: { label: 'Preferred stock outstanding', summary: 'No shares of Company Preferred Stock are issued and outstanding', distinguishing_component_ids: ['pref-amt'] },
    components: [component('pref-amt', 'AMOUNT', 'no shares of Company Preferred Stock', 0, { value: { canonical: 0, unit: 'COUNT' } }), component('pref-op', 'OPERATION', 'were issued and outstanding', 40)],
  };
  const withReadout = { ...base, conclusions: { table_key: 'capitalization-table', row_label: 'Preferred Stock', cells: [{ column_id: 'issued', value: { canonical: 0, unit: 'COUNT' }, component_ids: ['pref-amt'] }] } };
  for (const fact of [base, withReadout]) {
    const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
    const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'capitalization-table');
    const row = table.rows.find((candidate) => candidate.subject === 'Preferred Stock');
    const issued = row.cells.find((candidate) => candidate.column_id === 'issued');
    assert.equal(issued.kind, 'value');
    assert.equal(issued.label, '0');
    assert.deepEqual(issued.value, { canonical: 0, unit: 'COUNT' });
    assert.deepEqual(issued.component_ids, ['pref-amt']);
  }
});

// Work package 16 (plan finding (85)), Ben's decisions on the election
// options table, verbatim: (2) "I'D SAY \"NOT A DEAL FEATURE\""; (3) "KEEP
// ELECTIONS BUT ONLY WHEN THERE IS AN ELECTIOB"; (4) "WHAT DO YOU MEAN MINE
// TO SAY? SHOYUULDN'T ALL THE INFO BE LINKED/ACCURTE?". The manager's rule
// on held facts: "a held fact is 'held', never 'not a feature'".
test('the election options: a value term whose definition names the option\'s ratio term is linked to that option with its derivation; a term naming another option\'s longer term is not', () => {
  const facts = ncsElectionFacts();
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  // NCS 2.1's definition, as generation 5 stored it: the summary paraphrases, the words are exact.
  const mixedValue = {
    fact_id: 'def-mixed-value', proposal_id: 'def-mixed-value', family_key: 'KEY_DEFINED_TERMS', subtype_key: 'OTHER_DEFINED_TERM', fact_type: 'OTHER_DEFINED_TERM_RECORDED', section_reference: '2.1', structure_node_id: 'n-2-1', validation_status: 'VALID',
    headline: { label: 'Other defined term', summary: 'Mixed Share Consideration Value means the mixed exchange ratio times the Parent Closing Price', distinguishing_component_ids: ['def-mixed-value-t'] },
    components: [component('def-mixed-value-t', 'TERM', '“Mixed Share Consideration Value”', 0), component('def-mixed-value-op', 'OPERATION', 'means the product of (x) the Mixed Share Consideration Exchange Ratio, multiplied by (y) the Parent Closing Price', 40)],
  };
  const view = buildTableView({ facts: [...Object.values(facts), mixedValue], tableShapes, legalSchema });
  const options = view.sections.flatMap((section) => section.tables).find((table) => table.table_key === 'consideration-election-options');
  const cell = (row, columnId) => row.cells.find((candidate) => candidate.column_id === columnId);
  const stock = options.rows.find((row) => row.subject === 'Stock election');
  const mixedRow = options.rows.find((row) => row.subject === 'Mixed election');
  // The manager (18:05 UTC): the linked term sits under Value terms beside
  // the Cash Consideration definition; a bare-number definition would fill
  // the value-per-share cell instead.
  assert.equal(options.columns.some((column) => column.column_id === 'valuePerShare'), false, 'no option states a value per share as a number');
  const terms = cell(mixedRow, 'valueTerms');
  const linked = terms.values.find((value) => value.label.startsWith('Mixed Share Consideration Value'));
  assert.equal(linked.label, 'Mixed Share Consideration Value means the mixed exchange ratio times the Parent Closing Price', 'the Defined Terms entry\'s text');
  assert.deepEqual(linked.fact_ids, ['def-mixed-value', 'mixed'], 'the derivation cites the definition and the option fact');
  assert.equal(linked.derived, 'definition_link');
  assert.equal(linked.via, 'Mixed Share Consideration Exchange Ratio', 'the derivation: the definition names the option\'s ratio term');
  assert.equal(terms.values[0].derived, undefined, 'the option\'s own value term is not a link');
  assert.deepEqual(terms.values.map((value) => value.label).slice(0, 2), [
    'Cash Consideration means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price',
    'Cash Exchange Ratio: 0.1371',
  ], 'the option\'s own value terms come first');
  assert.equal(cell(stock, 'valueTerms').kind, 'dash', '"Share Consideration Exchange Ratio" inside "Mixed Share Consideration Exchange Ratio" links nothing to the stock election');
  // A bare-number definition that names the option's term fills Value per share.
  const statedValue = { ...mixedValue, fact_id: 'def-mixed-stated', proposal_id: 'def-mixed-stated',
    headline: { ...mixedValue.headline, summary: 'Mixed Election Value means $18.25', distinguishing_component_ids: ['def-mixed-stated-t'] },
    components: [{ ...mixedValue.components[0], component_id: 'def-mixed-stated-t', text: '“Mixed Election Value”' }, { ...mixedValue.components[1], component_id: 'def-mixed-stated-op', text: 'means $18.25 per share of Mixed Share Consideration' }] };
  const withStated = buildTableView({ facts: [...Object.values(facts), statedValue], tableShapes, legalSchema }).sections.flatMap((section) => section.tables).find((table) => table.table_key === 'consideration-election-options');
  const statedRow = withStated.rows.find((row) => row.subject === 'Mixed election');
  const statedCell = statedRow.cells.find((candidate) => candidate.column_id === 'valuePerShare') || (statedRow.trailing_details || []).find((detail) => detail.column_id === 'valuePerShare')?.cell;
  assert.equal(statedCell.label, '$18.25');
  assert.equal(statedCell.derived, 'definition_link');
  assert.equal(statedCell.via, 'Mixed Share Consideration');
  assert.deepEqual(statedCell.fact_ids, ['def-mixed-stated', 'mixed']);
});

test('the election options: an option whose only fact is held by validation reads held, never "Not a deal feature"; a held fact of a filled option backs its row', () => {
  const facts = ncsElectionFacts();
  // NCS 2.1's held cash leg, its words as the run stored them in the proposal.
  const heldCashLeg = {
    fact_id: 'held-cash-leg', proposal_id: 'held-cash-leg', family_key: 'CONSIDERATION', subtype_key: 'CASH_COMPONENT', fact_type: 'PER_SHARE_CASH_CONSIDERATION', section_reference: '2.1', structure_node_id: 'n-2-1', validation_status: 'INVALID',
    headline: { label: 'Cash component', summary: 'Mixed Election Stock receives the Cash Consideration, subject to the Maximum Cash Election Amount', distinguishing_component_ids: ['hcl-obj'] },
    components: [
      { component_id: 'hcl-actor', kind: 'ACTOR', label: 'Each Share of Company Common Stock', text: 'for each Share of Company Common Stock', origin: 'OWN', children: [] },
      { component_id: 'hcl-cond', kind: 'CONDITION', label: 'Mixed election made and not revoked', text: 'with respect to which an election to receive mixed consideration has been made and not validly revoked pursuant to Section 2.5', origin: 'OWN', children: [] },
      { component_id: 'hcl-term', kind: 'DEFINED_TERM', label: 'Mixed Election Stock', text: '(the “Mixed Election Stock”)', origin: 'OWN', children: [] },
      { component_id: 'hcl-obj', kind: 'OBJECT', label: 'Cash Consideration', text: 'the Cash Consideration', origin: 'OWN', children: [] },
      { component_id: 'hcl-amt', kind: 'AMOUNT', label: 'Cash Consideration formula', text: '“Cash Consideration” means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price.', origin: 'DEFINITION', value: null, children: [] },
    ],
  };
  // A held stock-election fact and no valid one: the row reads held.
  const heldStock = { ...facts.share, fact_id: 'held-share', proposal_id: 'held-share', validation_status: 'INVALID', conclusions: undefined };
  const tables = (view) => view.sections.flatMap((section) => section.tables).find((table) => table.table_key === 'consideration-election-options');
  const held = tables(buildTableView({ facts: [facts.mixed, facts.cashRatio, facts.cashConsideration, facts.mixedRatio], heldFacts: [heldStock, heldCashLeg], tableShapes, legalSchema }));
  assert.deepEqual(held.rows.map((row) => [row.subject, row.absent === true, row.held === true, row.absent_label || null]), [
    ['Cash election', true, false, null],
    ['Stock election', true, true, 'Held: this option\'s fact is held by validation'],
    ['Mixed election', false, false, null],
  ]);
  assert.deepEqual(held.rows[1].backing_facts.map((entry) => [entry.fact_id, entry.held]), [['held-share', true]]);
  assert.deepEqual(held.rows[2].backing_facts.map((entry) => [entry.fact_id, entry.held || false]), [['mixed', false], ['held-cash-leg', true]], 'the held cash leg backs the filled mixed row');
  // Without an election at all, no held fact makes a table.
  assert.equal(tables(buildTableView({ facts: [facts.cashRatio], heldFacts: [heldCashLeg], tableShapes, legalSchema })).rows.some((row) => !row.absent), false);
});

test('without an election, a per-share row coded as an election form folds into its plain form', () => {
  const facts = ncsElectionFacts();
  // A stock component the extractor coded STOCK_ELECTION in a deal with no election words and no numbers: no option row, so the row is Acquirer stock.
  const stock = { ...facts.share, components: facts.share.components.filter((component) => !['share-cond', 'share-ratio'].includes(component.component_id)),
    conclusions: { ...facts.share.conclusions, cells: facts.share.conclusions.cells.filter((cell) => cell.column_id !== 'amount') } };
  const view = buildTableView({ facts: [stock], tableShapes, legalSchema });
  const tables = view.sections.flatMap((section) => section.tables);
  assert.equal(tables.some((table) => table.table_key === 'consideration-election-options'), false, 'no ratio, cash or value term: no option row');
  const components = tables.find((table) => table.table_key === 'consideration-components');
  assert.deepEqual(components.rows.map((row) => [row.subject, row.folded_from || null]), [['Acquirer stock', 'STOCK_ELECTION']]);
  const form = components.rows[0].cells.find((cell) => cell.column_id === 'form');
  assert.deepEqual([form.code, form.label, form.folded_from], ['PARENT_STOCK', 'Acquirer stock', 'STOCK_ELECTION']);
  // With an election (the full NCS facts), the election rows stay.
  const withElection = buildTableView({ facts: Object.values(facts), tableShapes, legalSchema }).sections.flatMap((section) => section.tables).find((table) => table.table_key === 'consideration-components');
  assert.deepEqual(withElection.rows.map((row) => row.subject), ['Stock election', 'Acquirer stock']);
});

// Work package 17 (manager, 2026-10-18): "Adverse Recommendation Change"
// entered Defined Terms as "any of the foregoing actions", the resolved
// words; the two NCS 5.3 sentences that define it list the actions.
test('a definition resolved to a back-reference shows the words it refers to, from the fact\'s own words before the term, with a note; two such facts merge', () => {
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  const arc = (id, start, objectText) => ({
    fact_id: id, proposal_id: id, family_key: 'NO_SHOP', subtype_key: 'RECOMMENDATION_CHANGE', fact_type: 'RECOMMENDATION_CHANGE', section_reference: '5.3', structure_node_id: 'n-5-3', validation_status: 'VALID',
    statement: `Except to the extent permitted by Section 5.2(c), the Company Board shall not ${objectText}.`,
    headline: { label: 'Change of recommendation', summary: `Company Board shall not ${objectText}`, distinguishing_component_ids: [`${id}-obj`] },
    components: [
      component(`${id}-exc`, 'EXCEPTION', 'Except to the extent permitted by Section 5.2(c)', start),
      component(`${id}-actor`, 'ACTOR', 'the Company Board and each committee of the Company Board shall not, and shall not authorize or publicly propose to', start + 60),
      component(`${id}-obj`, 'OBJECT', objectText, start + 200),
      component(`${id}-term`, 'DEFINED_TERM', '(any of the foregoing actions, an “Adverse Recommendation Change”)', start + 320, { resolves_to: { text: 'any of the foregoing actions' } }),
    ],
  });
  const withhold = arc('arc-1', 0, 'withhold, withdraw or adversely qualify (or modify or amend in a manner adverse to Parent) the Company Board Recommendation');
  const approve = arc('arc-2', 1000, 'authorize, approve, adopt or recommend any Acquisition Proposal');
  const view = buildTableView({ facts: [withhold, approve], tableShapes, legalSchema });
  const entry = view.defined_terms.find((candidate) => candidate.term === 'Adverse Recommendation Change');
  assert.ok(entry, 'the term is an entry');
  assert.match(entry.definition, /^any of the foregoing actions: Except to the extent permitted by Section 5\.2\(c\) the Company Board and each committee .* withhold, withdraw or adversely qualify .* the Company Board Recommendation; any of the foregoing actions: Except .* authorize, approve, adopt or recommend any Acquisition Proposal$/);
  assert.equal(entry.note, 'The resolved words are a back-reference; the list shown is the fact\'s own words before the term.');
  assert.deepEqual(entry.fact_ids, ['arc-1', 'arc-2']);
  // A resolved definition that is not a back-reference is unchanged.
  const plain = { ...withhold, fact_id: 'plain', proposal_id: 'plain', components: [component('plain-term', 'DEFINED_TERM', 'the “Company Board Recommendation”', 0, { resolves_to: { text: 'the recommendation of the Company Board that the stockholders adopt this Agreement' } })] };
  const plainEntry = buildTableView({ facts: [plain], tableShapes, legalSchema }).defined_terms.find((candidate) => candidate.term === 'Company Board Recommendation');
  assert.equal(plainEntry.definition, 'the recommendation of the Company Board that the stockholders adopt this Agreement');
  assert.equal(plainEntry.note, undefined);
  // With no own words before the term, the fact's statement is the list.
  const statementOnly = { ...approve, fact_id: 'so', proposal_id: 'so', components: [approve.components[3]] };
  const soEntry = buildTableView({ facts: [statementOnly], tableShapes, legalSchema }).defined_terms.find((candidate) => candidate.term === 'Adverse Recommendation Change');
  assert.match(soEntry.definition, /^any of the foregoing actions: Except to the extent permitted by Section 5\.2\(c\), the Company Board shall not authorize, approve, adopt or recommend any Acquisition Proposal\.$/);
  assert.match(soEntry.note, /the fact's statement/);
});

// Work package 17: the facts validation held are shown under their
// section with the reason in words (NCS 3.4: ten facts on an unknown span).
test('held facts are listed under their family\'s section with their reason, and a section with only held facts is shown', () => {
  const held = (id, reason) => ({
    fact_id: id, proposal_id: id, family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', fact_type: 'REPRESENTATION_ACCURACY_STANDARD', section_reference: '3.4', structure_node_id: 'n-3-4', validation_status: 'INVALID',
    headline: { label: 'Status representation', summary: 'Company has corporate power and authority to execute, deliver and perform the Agreement', distinguishing_component_ids: [`${id}-c`] },
    components: [{ component_id: `${id}-c`, kind: 'ACTOR', label: 'party', text: 'the Company represents and warrants to Parent and Merger Sub as follows:', origin: 'INTRO', children: [] }],
    ...(reason ? { held_reason: reason } : {}),
  });
  const view = buildTableView({ facts: [], heldFacts: [held('h1', '“the Company represents and warrants to Parent and Merger Sub as follows:”: its quote cites a span the section does not have'), held('h2', null)], tableShapes, legalSchema });
  const section = view.sections.find((candidate) => candidate.held_facts);
  assert.ok(section, 'the section is shown for its held facts alone');
  assert.equal(section.section_key, 'representations-qualifiers');
  assert.deepEqual(section.tables, []);
  assert.deepEqual(section.held_facts.map((entry) => [entry.fact_id, entry.section_reference, entry.headline, entry.reason]), [
    ['h1', '3.4', 'Status representation', '“the Company represents and warrants to Parent and Merger Sub as follows:”: its quote cites a span the section does not have'],
    ['h2', '3.4', 'Status representation', 'held by validation'],
  ]);
});

// Work package 17, item 4 (manager, 2026-10-18 19:22 UTC): NCS 5.6's
// "Company submits form of Written Consent to Consenting Stockholders
// instead of holding a stockholder meeting" and "Company uses reasonable
// best efforts to obtain Written Consent by the Consent Time" carry
// resolved DEFINED_TERM components (the Consenting Stockholders, the
// Consent Time). A fact that is not itself a definition keeps its own
// placement: its family's table by its readout; its resolved terms add
// Defined Terms entries beside it, never instead of it. Only a definition
// fact is placed by its term.
test('a non-definition fact with resolved defined terms keeps its row and adds the entries beside it; a definition fact enters Defined Terms alone', () => {
  const component = (id, kind, text, start, extra = {}) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: start + text.length, gap_before: false, children: [], ...extra });
  const consenting = { resolves_to: { text: 'Advent-NCS Acquisition L.P. and Advent International Corporation' } };
  // The two facts as generation 5 stored them (payloads read from the preview branch).
  const submit = {
    fact_id: 'ncs-5-6-submit', proposal_id: 'ncs-5-6-submit', family_key: 'PROXY_MEETING', subtype_key: 'WRITTEN_CONSENT_SOLICITATION', fact_type: 'MEETING_CONVENE_OBLIGATION', section_reference: '5.6', structure_node_id: 'n-5-6', validation_status: 'VALID',
    statement: 'Immediately after the execution of this Agreement and in lieu of calling a meeting of the Company\'s stockholders, the Company shall submit the form of Written Consent attached hereto as Exhibit A and the Consenting Stockholders (Advent-NCS Acquisition L.P. and Advent International Corporation).',
    headline: { label: 'Written consent solicitation', summary: 'Company submits form of Written Consent to Consenting Stockholders instead of holding a stockholder meeting', distinguishing_component_ids: ['s-obj'] },
    components: [component('s-trig', 'TRIGGER', 'Immediately after the execution of this Agreement', 0), component('s-q', 'QUALIFIER', 'in lieu of calling a meeting of the Company’s stockholders', 60), component('s-actor', 'ACTOR', 'the Company', 120), component('s-eff', 'EFFORTS_STANDARD', 'shall submit', 140), component('s-obj', 'OBJECT', 'the form of Written Consent attached hereto as Exhibit A', 160), component('s-term', 'DEFINED_TERM', 'the Consenting Stockholders', 230, consenting)],
    conclusions: { table_key: 'votes-approvals-meeting-table', row_label: 'Written Consent submission', cells: [{ column_id: 'detail', text: 'the Company shall submit the form of Written Consent attached hereto as Exhibit A and the Consenting Stockholders', component_ids: ['s-actor', 's-eff', 's-obj', 's-term'] }, { column_id: 'anchor', code: 'AFTER_AGREEMENT_DATE', component_ids: ['s-trig'] }] },
  };
  const obtain = {
    ...submit, fact_id: 'ncs-5-6-obtain', proposal_id: 'ncs-5-6-obtain',
    statement: 'The Company will use reasonable best efforts to obtain the Written Consent from the Consenting Stockholders by no later than 11:59 p.m. Central Time on the day following the date hereof (such time, the “Consent Time”).',
    headline: { label: 'Written consent solicitation', summary: 'Company uses reasonable best efforts to obtain Written Consent by the Consent Time', distinguishing_component_ids: ['o-obj'] },
    components: [component('o-actor', 'ACTOR', 'The Company', 500), component('o-eff', 'EFFORTS_STANDARD', 'will use reasonable best efforts', 520), component('o-op', 'OPERATION', 'to obtain', 560), component('o-obj', 'OBJECT', 'the Written Consent', 575), component('o-term', 'DEFINED_TERM', 'the Consenting Stockholders', 600, consenting), component('o-date', 'DATE', 'by no later than 11:59 p.m. Central Time on the day following the date hereof', 640), component('o-term2', 'DEFINED_TERM', '(such time, the “Consent Time”)', 720, { resolves_to: { text: '11:59 p.m. Central Time on the day following the date hereof' } })],
    conclusions: { table_key: 'votes-approvals-meeting-table', row_label: 'Written Consent receipt', cells: [{ column_id: 'detail', text: 'The Company will use reasonable best efforts to obtain the Written Consent', component_ids: ['o-actor', 'o-eff', 'o-op', 'o-obj'] }, { column_id: 'anchor', code: 'AFTER_AGREEMENT_DATE', component_ids: ['o-date'] }] },
  };
  // A definition fact of its own, placed by its term alone.
  const definition = {
    fact_id: 'def-consent-time', proposal_id: 'def-consent-time', family_key: 'KEY_DEFINED_TERMS', subtype_key: 'OTHER_DEFINED_TERM', fact_type: 'OTHER_DEFINED_TERM_RECORDED', section_reference: '5.6', structure_node_id: 'n-5-6', validation_status: 'VALID',
    headline: { label: 'Other defined term', summary: 'Consent Time means 11:59 p.m. Central Time on the day following the date hereof', distinguishing_component_ids: ['def-ct'] },
    components: [component('def-ct', 'DEFINED_TERM', '(such time, the “Consent Time”)', 900, { resolves_to: { text: '11:59 p.m. Central Time on the day following the date hereof' } })],
  };
  const view = buildTableView({ facts: [submit, obtain, definition], tableShapes, legalSchema });
  const meeting = view.sections.flatMap((section) => section.tables).find((table) => table.table_key === 'votes-approvals-meeting-table');
  assert.deepEqual(meeting.rows.map((row) => [row.subject, row.backing_facts.map((entry) => entry.fact_id)]), [
    ['Written Consent submission', ['ncs-5-6-submit']], ['Written Consent receipt', ['ncs-5-6-obtain']],
  ], 'the facts keep their rows on their family\'s table');
  assert.equal(view.sections.flatMap((section) => section.facts_without_readout || []).length, 0);
  const terms = Object.fromEntries(view.defined_terms.map((entry) => [entry.term, entry]));
  assert.equal(terms['the Consenting Stockholders'].definition, 'Advent-NCS Acquisition L.P. and Advent International Corporation');
  assert.equal(terms['the Consenting Stockholders'].fact_id, 'ncs-5-6-submit', 'the entry sits beside the fact, which stays on its row');
  assert.equal(terms['Consent Time'].fact_id, 'def-consent-time', 'the definition fact owns its term\'s entry');
  assert.equal(terms['Consent Time'].definition, 'Consent Time means 11:59 p.m. Central Time on the day following the date hereof');
  assert.equal(view.sections.flatMap((section) => section.tables).flatMap((table) => table.rows).some((row) => row.backing_facts.some((entry) => entry.fact_id === 'def-consent-time')), false, 'a definition fact has no row');
});

// Work package 18 (c) (plan finding (91); NCS generation 5, 5.14; 2026-10-18):
// twelve publicity facts on one "Public announcements" row were "correct and
// unreadable". The row's detail_from_words_by_row names each fact's sub-item
// from its own words; the words below are the facts' own components as
// stored for NCS generation 5 (5.14) and Metsera generation 8 (6.08).
test('publicity facts become sub-items of Public announcements named from their words, in the labels\' order; the model\'s own details give way', () => {
  const publicityFact = (id, section, texts, rowDetail) => ({
    fact_id: id, proposal_id: id, family_key: 'GENERAL_COVENANTS', subtype_key: 'PUBLICITY', section_reference: section, structure_node_id: `n-${section}`,
    headline: { label: 'Publicity', distinguishing_component_ids: [`${id}-0`], summary: '' },
    components: texts.map((text, index) => ({ component_id: `${id}-${index}`, kind: index === 0 ? 'ACTOR' : 'OPERATION', label: 'words', text, origin: 'OWN', source_span_id: 's', start_byte: index * 10, end_byte: index * 10 + 5, gap_before: false, children: [] })),
    conclusions: { table_key: 'general-covenants-table', row_label: 'Public announcements', ...(rowDetail ? { row_detail: rowDetail } : {}), cells: [{ column_id: 'obligor', code: 'EACH_PARTY', component_ids: [`${id}-0`] }] },
  });
  const ncs = [
    publicityFact('f146fe1b', '5.14', ['Each of Parent and Merger Sub, on the one hand, and the Company, on the other hand', 'shall not issue', 'any such press release or make any public announcement', 'prior to such consultation and review', 'except as may be required by applicable Law, court process or by obligations pursuant to any', 'listing agreement with any national securities exchange or national securities quotation system']),
    publicityFact('feaaade2', '5.14', ['Each of Parent and Merger Sub, on the one hand, and the Company, on the other hand', 'any such press release or make any public announcement', 'except as may be required by applicable Law, court process or by obligations pursuant to any', 'listing agreement with any national securities exchange or national securities quotation system']),
    publicityFact('2638bc7f', '5.14', ['Each of Parent and Merger Sub, on the one hand, and the Company, on the other hand', 'shall consult with each other', 'before issuing, and give each other a reasonable opportunity to review and comment upon', 'any press release or other public statements with respect to this Agreement and the Transactions', 'except as may be required by applicable Law, court process or by obligations pursuant to any', 'listing agreement with any national securities exchange or national securities quotation system']),
    publicityFact('8f0d0e3f', '5.14', ['notwithstanding the foregoing', 'a Party', 'may, without providing the other Parties the opportunity for such consultation and review, issue', 'a press release or make a public statement', 'that is consistent with prior press releases or public statements made in compliance with this Section 5.14']),
    publicityFact('8b186e37', '5.14', ['(ii) be deemed to restrict the ability of', 'any Party', 'to communicate to its employees or Representatives', 'in a manner that would not reasonably be expected to require public disclosure by the disclosing Party']),
    publicityFact('7fc3bd21', '5.14', ['(iii) prevent', 'Parent or the Company', 'from making any public statement', 'in connection with any dispute among the Parties regarding this Agreement, the Merger or the Transactions']),
    publicityFact('43418351', '5.14', ['(iv) prevent', 'the Specified Stockholders or their respective Affiliates', '(A) communicating with the current or prospective limited partners of the investment funds managed by such parties or their respective Affiliates', '(provided that such existing and prospective limited partners and Affiliates are subject to customary confidentiality obligations)', 'respectively, regarding this Agreement or the transactions contemplated by this Agreement']),
    publicityFact('1e936ecc', '5.14', ['(i) prevent', 'Parent or the Company', 'from issuing any press release or making any public statement', 'in the ordinary course', 'that does not relate specifically to this Agreement or the Transactions']),
    publicityFact('9a2072b9', '5.14', ['(iv) prevent', 'the Specified Stockholders or their respective Affiliates', '(B) disclosing the consummation of the Transactions', 'without disclosing the economic terms', 'on its website and otherwise in the ordinary course of their business']),
    publicityFact('6de494c5', '5.14', ['the Specified Stockholders or their respective Affiliates', 'provided that any such disclosure contemplated by this clause (iv)', 'shall be consistent with', 'the content of any press release or public announcement that has been made pursuant to, and is permitted by, this Section 5.14']),
    publicityFact('ee882a8c', '5.14', ['The press release announcing the execution and delivery of this Agreement', 'shall not be issued', 'prior to the approval of each of, the Company and Parent']),
    publicityFact('3dbfb012', '5.14', ['The press release announcing the execution and delivery of this Agreement', 'shall be a joint release of', 'Parent and the Company']),
  ];
  const ncsView = buildTableView({ facts: ncs, tableShapes, legalSchema });
  const ncsTable = ncsView.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'general-covenants-table');
  assert.equal(ncsTable.rows.length, 1);
  assert.equal(ncsTable.rows[0].subject, 'Public announcements');
  assert.deepEqual(ncsTable.rows[0].sub_rows.map((row) => [row.subject, row.backing_facts.map((entry) => entry.fact_id).sort()]), [
    ['Announcement release', ['3dbfb012', 'ee882a8c']],
    ['Consultation and review', ['2638bc7f', 'f146fe1b']],
    ['Consistent with prior statements', ['8f0d0e3f']],
    ['Carve-out: ordinary course', ['1e936ecc']],
    ['Carve-out: employees', ['8b186e37']],
    ['Carve-out: disputes', ['7fc3bd21']],
    ['Carve-out: sponsor disclosure', ['43418351', '6de494c5', '9a2072b9']],
    ['Law or exchange exception', ['feaaade2']],
  ]);
  assert.equal(ncsView.sections.flatMap((section) => section.without_readout || []).length, 0);
  // Metsera generation 8, 6.08: the model wrote seven details of its own;
  // the rule reads them into the same vocabulary.
  const metsera = [
    publicityFact('1c12f7b0', '6.08', ['Parent and Merger Sub, on the one hand, and the Company, on the other hand', 'shall consult with each other', 'before issuing', 'any press release or other public statements with respect to the Merger and the other Transactions', 'except as may be required by applicable Law, court process or by obligations pursuant to any listing agreement with any national securities exchange', 'except as contemplated, permitted or required by Section 5.02'], 'Consultation before issuance'),
    publicityFact('f1df5e86', '6.08', ['Notwithstanding the foregoing', 'without prior consent of the other parties hereto', 'each party hereto', 'communicate information that is not confidential information of any other party with financial analysts, investors and media representatives', 'information that is not confidential information of any other party', 'in a manner consistent with its past practice and in compliance with applicable Law'], 'Permitted communications with analysts, investors and media'),
    publicityFact('8c69f6c9', '6.08', ['Parent and Merger Sub, on the one hand, and the Company, on the other hand', 'provide each other the opportunity to review and comment upon', 'any press release or other public statements with respect to the Merger and the other Transactions', 'except as may be required by applicable Law, court process or by obligations pursuant to any listing agreement with any national securities exchange', 'except as contemplated, permitted or required by Section 5.02'], 'Review and comment opportunity'),
    publicityFact('7b325f09', '6.08', ['Parent and Merger Sub, on the one hand, and the Company, on the other hand', 'shall not issue any such press release or make any such public statement', 'any press release or other public statements with respect to the Merger and the other Transactions', 'without the prior written consent of the other party', 'except as may be required by applicable Law, court process or by obligations pursuant to any listing agreement with any national securities exchange', 'except as contemplated, permitted or required by Section 5.02'], 'Prior written consent requirement'),
    publicityFact('6ace2dde', '6.08', ['the other party', 'the prior written consent of the other party', '(which consent shall not be unreasonably withheld, conditioned or delayed)'], 'Consent standard'),
    publicityFact('8bf2ac0d', '6.08', ['The parties', 'agree that the initial press release to be issued with respect to the Transactions shall be in the form heretofore agreed to by the parties', 'the initial press release to be issued with respect to the Transactions'], 'Initial press release'),
    publicityFact('11bb2b85', '6.08', ['Notwithstanding the foregoing', 'without prior consent of the other parties hereto', 'each party hereto', 'may (a) disseminate information substantially similar to information included in a press release or other document previously approved for public distribution by the other parties hereto', 'information substantially similar to information included in a press release or other document previously approved for public distribution by the other parties hereto'], 'Permitted dissemination of previously approved information'),
  ];
  const metseraView = buildTableView({ facts: metsera, tableShapes, legalSchema });
  const metseraTable = metseraView.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'general-covenants-table');
  assert.deepEqual(metseraTable.rows[0].sub_rows.map((row) => [row.subject, row.backing_facts.map((entry) => entry.fact_id).sort()]), [
    ['Announcement release', ['8bf2ac0d']],
    ['Consent to releases', ['6ace2dde', '7b325f09']],
    ['Consultation and review', ['1c12f7b0', '8c69f6c9']],
    ['Consistent with prior statements', ['11bb2b85']],
    ['Carve-out: investor and media communications', ['f1df5e86']],
  ]);
  // A fact no rule names keeps the detail the model wrote.
  const other = publicityFact('other', '6.08', ['The parties', 'shall file a Current Report on Form 8-K', 'within four Business Days'], 'Form 8-K filing');
  const otherView = buildTableView({ facts: [other], tableShapes, legalSchema });
  const otherTable = otherView.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'general-covenants-table');
  assert.deepEqual(otherTable.rows[0].sub_rows.map((row) => row.subject), ['Form 8-K filing']);
});

// Work package 18 (d) (plan finding (93); NCS generation 5, 5.17; 2026-10-18):
// the registration-rights covenants the model spread over "General
// notification", "Access to information", "Stock exchange listing" and
// three open rows gather on "Registration rights", each a sub-item from its
// words; a notice covenant that names none of the words stays where it was.
// The words are the facts' own components as stored for the run.
test('registration-rights covenants gather on the one Registration rights line under Consideration; a Nasdaq notice stays on General notification', () => {
  const covenant = (id, row, texts, rowDetail) => ({
    fact_id: id, proposal_id: id, family_key: 'GENERAL_COVENANTS', subtype_key: 'OTHER_COVENANT', section_reference: '5.17', structure_node_id: 'n-5-17',
    headline: { label: 'Covenant', distinguishing_component_ids: [`${id}-0`], summary: '' },
    components: texts.map((entry, index) => {
      const [kind, text] = Array.isArray(entry) ? entry : [index === 0 ? 'ACTOR' : 'OPERATION', entry];
      return { component_id: `${id}-${index}`, kind, label: 'words', text, origin: 'OWN', source_span_id: 's', start_byte: index * 10, end_byte: index * 10 + 5, gap_before: false, children: [] };
    }),
    conclusions: { table_key: 'general-covenants-table', row_label: row, ...(rowDetail ? { row_detail: rowDetail } : {}), cells: [{ column_id: 'obligor', code: 'PARENT', component_ids: [`${id}-0`] }] },
  });
  const facts = [
    covenant('2bf58d52', 'General notification', [['TRIGGER', 'Promptly following the Closing Date'], ['PERIOD', '(and in any event no later than two Business Days thereafter)'], ['ACTOR', 'Parent'], ['OPERATION', 'shall either (a) file with the SEC'], ['OBJECT', 'a prospectus supplement to the Registration Statement on Form S-3 (SEC file number 333-288045), filed June 13, 2025, pursuant to Rule 424(b)(7) under the Securities Act'], ['QUALIFIER', 'or (b) file with the SEC a Registration Statement pursuant to Rule 415 under the Securities Act']]),
    covenant('8a57ad66', 'General notification', ['Statement (or any prospectus or prospectus supplement forming a part of such Registration Statement), as initially filed', 'shall include the Registrable Securities of the Specified Stockholders and any permitted transferee thereof', 'and name the Specified Stockholders or any permitted transferees as selling securityholders', '(subject to receipt of information reasonably requested by Parent necessary to complete such prospectus supplement)']),
    covenant('5de42e39', 'General notification', ['Parent', 'shall use its reasonable best efforts', 'to keep such Registration Statement continuously effective under the Securities Act', 'until the date on which all Registrable Securities covered by such Registration Statement have been sold']),
    covenant('009dfdb5', 'General notification', ['Parent', 'shall use reasonable best efforts', 'to prepare and file with the SEC such amendments and supplements to the Registration Statement and the prospectus used in connection therewith', 'as may be reasonably necessary', 'to keep the Registration Statement effective and to comply with the provisions of the Securities Act with respect to the disposition of all Registrable Securities covered by the Registration Statement']),
    covenant('ee197fc0', 'General notification', ['Parent', 'shall notify the Specified Stockholders', 'promptly upon discovery', 'upon the discovery of the happening of any event as a result of which', 'the Registration Statement or any supplement to any prospectus forming a part of the Registration Statement contains an untrue statement of a material fact or omits any fact necessary to make the statements therein not misleading in the light of the circumstances under which they were made']),
    covenant('43e27ac9', 'Access to information', ['Parent', 'shall not file such Registration Statement, prospectus or prospectus supplement', 'unless such disclosures have been approved in writing by the Specified Stockholders', '(such approval not to be unreasonably withheld, conditioned or delayed)']),
    covenant('a01a67c4', 'Access to information', ['Prior to the Closing Date and until the date on which all Registrable Securities covered by such Registration Statement have been sold', 'the Specified Stockholders', 'shall cooperate with Parent and use reasonable best efforts to', 'promptly furnish to Parent all information concerning it', 'as is required by the SEC to be included in the Registration Statement']),
    covenant('f598ad96', 'Registration rights indemnification', ['Parent', 'hereby agrees to indemnify and hold harmless', 'to the fullest extent permitted by Law', 'each Specified Stockholder, and their respective Affiliates, directors, officers, employees, partners, equityholders, managers and each other Person, if any, who controls such Specified Stockholder within the meaning of the Securities Act', '(x) any untrue statement or alleged untrue statement of any material fact contained in the Registration Statement or, in the light of the circumstances under which such statements were made, in any preliminary, final or summary prospectus contained therein'], 'Untrue statements in the Registration Statement'),
    covenant('a47dc26b', 'Registration rights indemnification', ['provided, however', 'the aggregate amount which any such Specified Stockholder shall be required to pay pursuant to this Section 5.17(l)', 'shall in no case be greater than', 'the amount of the net proceeds actually received by such Specified Stockholder upon the sale of the Registrable Securities pursuant to the registration statement giving rise to such Claim'], 'Cap on liability'),
    covenant('95c2cf94', 'Registration expenses', ['All expenses incurred in connection with any registration of Registrable Securities pursuant to this Agreement', 'including all SEC fees, blue sky registration and filing fees, listing notices and filing fees, printing fees and expenses, transfer agents’ and registrars’ fees and expenses and all fees and expenses of Parent’s outside counsel and independent accountants of Parent', 'shall be paid by Parent', 'Parent']),
    covenant('50ba52cb', 'Registration rights', ['Upon the written request of a Specified Stockholder', 'Parent', 'shall promptly facilitate', 'the removal of any restrictive legends with respect to any Parent Ordinary Shares', 'in connection with a sale under the Registration Statement or when such Parent Ordinary Shares are eligible for resale under Rule 144 under the Securities Act'], 'Legend removal'),
    covenant('eb3ace36', 'General notification', ['From and after the Closing Date and until the date on which all Registrable Securities covered by such Registration Statement have been sold', 'Parent', 'shall use its commercially reasonable efforts to', '(d) remain in compliance with the current public', 'information requirements of Rule 144(c)(1) under the Securities Act']),
    covenant('f45fa9c4', 'Stock exchange listing', ['From and after the Closing Date and until the date on which all Registrable Securities covered by such Registration Statement have been sold', 'Parent', 'shall use its commercially reasonable efforts to', '(a) maintain the listing of the Parent Ordinary Shares on Nasdaq Global Select']),
    covenant('199b43b6', 'General notification', ['From and after the Closing Date and until the date on which all Registrable Securities covered by such Registration Statement have been sold', 'Parent', 'shall use its commercially reasonable efforts to', '(c) timely file all reports required to be filed with the SEC pursuant to the Exchange Act']),
    covenant('31da8ce7', 'General notification', ['Parent', 'shall promptly notify the Specified Stockholders in writing of', '(x) any notice of deficiency or non-compliance received from Nasdaq']),
    // The survival limb names none of the words; the open row the model
    // wrote for it begins with the row's label, so it comes along.
    covenant('add29195', 'Registration rights indemnification', ['Such indemnity and reimbursement of expenses', 'shall remain in full force and effect', 'regardless of any investigation made by or on behalf of such indemnified party', 'shall survive the transfer of such securities by such holder'], 'Survival'),
  ];
  // (f) Ben: "on A - if the shareholders have to do something, okay for them
  // to be an obligor": the stockholders' several indemnity, no obligor cell.
  facts.push({
    ...covenant('37ea48cb', 'Registration rights indemnification', ['Each Specified Stockholder', 'severally and not jointly', 'indemnify and hold harmless', 'with respect to any untrue statement or alleged untrue statement of any material fact in, or omission or alleged omission of any material fact from, the Registration Statement'], 'Specified Stockholder indemnity'),
    conclusions: { table_key: 'general-covenants-table', row_label: 'Registration rights indemnification', row_detail: 'Specified Stockholder indemnity', cells: [{ column_id: 'standard', code: 'UNQUALIFIED_OBLIGATION', component_ids: ['37ea48cb-2'] }] },
  });
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const covenantsTable = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'general-covenants-table');
  assert.deepEqual(covenantsTable.rows.map((row) => [row.subject, row.backing_facts.length]), [['General notification', 1]]);
  assert.deepEqual(covenantsTable.rows[0].backing_facts.map((entry) => entry.fact_id), ['31da8ce7'], 'the Nasdaq notice names none of the words and stays');
  // Ben: "reg rights I think goes with consideration (but at bottom)".
  const consideration = view.sections.find((section) => section.section_key === 'consideration-hero');
  assert.ok(consideration, 'the registration rights show under Consideration');
  const table = consideration.tables[consideration.tables.length - 1];
  assert.equal(table.table_key, 'consideration-registration-rights');
  assert.deepEqual(table.rows.map((row) => [row.subject, row.backing_facts.length]), [['Registration rights', 16]]);
  // Ben, 2026-10-18 (plan finding (166)): "are these from a reg rights
  // agreement? I wouldn't go into anywhere near this depth in this
  // product": one line, the facts behind it, the model's own details
  // ("Survival", "Legend removal") dropped too.
  assert.equal(table.rows[0].sub_rows, undefined);
  assert.equal(view.sections.flatMap((section) => section.tables).some((candidate) => candidate.rows.some((row) => ['Registration rights indemnification', 'Registration expenses', 'Access to information', 'Stock exchange listing'].includes(row.subject))), false);
  // (f): the several indemnity's obligor is the stockholders, in their words.
  const obligor = table.rows[0].cells.find((cell) => cell.column_id === 'obligor');
  const obligorValues = obligor.values || [obligor];
  assert.ok(obligorValues.some((value) => value.code === 'OTHER_PARTY' && value.label === 'Each Specified Stockholder'), JSON.stringify(obligorValues));
  assert.ok(obligorValues.some((value) => value.code === 'PARENT'), 'Parent\'s indemnity keeps its obligor');
  // (g) Ben: "Ok on ETA on covenants": the 424(b)(7) filing's trigger and
  // outside date in By when, from its TRIGGER and PERIOD components.
  const byWhen = table.rows[0].cells.find((cell) => cell.column_id === 'byWhen');
  const byWhenValues = byWhen.values || [byWhen];
  assert.ok(byWhenValues.some((value) => value.label === 'Promptly following the Closing Date (and in any event no later than two Business Days thereafter)' && value.derived === 'fill_from_components'), JSON.stringify(byWhenValues));
  assert.ok(table.columns.some((column) => column.column_id === 'byWhen'), 'By when shows when a row fills it');
  // A covenants table no row of which states a deadline hides By when.
  assert.ok((covenantsTable.hidden_columns || []).some((column) => column.column_id === 'byWhen'), JSON.stringify(covenantsTable.hidden_columns));
});

// Work package 18 (g) on the financing table (Ben: "Ok on ETA on covenants"):
// NCS 5.18's payoff letter, "at least three (3) Business Days prior to the
// Closing Date": the Period column reads the number from the PERIOD
// component, the as-drafted words cite it, and By when does not repeat a
// component the Period column already reads.
test('the financing table reads the payoff letter lead time into Period and does not repeat it in By when', () => {
  const fact = {
    fact_id: 'payoff', proposal_id: 'payoff', family_key: 'FINANCING_COVENANTS', subtype_key: 'PAYOFF', section_reference: '5.18', structure_node_id: 'n-5-18',
    headline: { label: 'Payoff letters', distinguishing_component_ids: ['payoff-4'], summary: 'Company uses reasonable best efforts to deliver Parent a payoff letter three Business Days pre-Closing' },
    components: [
      ['ACTOR', 'The Company'], ['EFFORTS_STANDARD', 'shall use reasonable best efforts'], ['OPERATION', 'to deliver to Parent'],
      ['PERIOD', 'at least three (3) Business Days prior to the Closing Date'], ['OBJECT', 'a copy of a payoff letter'],
    ].map(([kind, text], index) => ({ component_id: `payoff-${index}`, kind, label: 'words', text, origin: 'OWN', source_span_id: 's', start_byte: index * 10, end_byte: index * 10 + 5, gap_before: false, children: [], ...(kind === 'PERIOD' ? { value: { canonical: 3, unit: 'BUSINESS_DAY' } } : {}) })),
    conclusions: { table_key: 'financing-table', row_label: 'Payoff letters', cells: [{ column_id: 'provision', code: 'REQUIRED', component_ids: ['payoff-2'] }, { column_id: 'asDrafted', text: 'to deliver to Parent', component_ids: ['payoff-2'] }] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'financing-table');
  const row = table.rows.find((candidate) => candidate.subject === 'Payoff letters');
  const line = [row, ...(row.sub_rows || [])].find((candidate) => (candidate.cells || []).some((cell) => cell.column_id === 'period' && cell.kind !== 'dash'))
    || row;
  const period = line.cells.find((cell) => cell.column_id === 'period');
  assert.ok(period && /3/.test(period.label) && /business day/i.test(period.label), JSON.stringify(period));
  assert.equal(table.columns.some((column) => column.column_id === 'byWhen'), false, 'nothing is left for By when once Period has the number');
});

// Work package 19 (g) (manager finding (165): the row move "does not happen
// on the stored rows", read from a preview deployed before the rule; Ben's
// (166): one line, no sub-items). NCS generation 5's 32 general-covenant
// facts of 5.17 as stored (tests/fixtures/product/ncs-generation-5-5-17-
// general-covenants.json: ids shortened, components flattened), through
// buildTableView with the contract as generated.
test('NCS 5.17 as stored: 29 registration-rights covenants gather on the one Registration rights line under Consideration, three Nasdaq notices stay, no sub-items', () => {
  const stored = require('./fixtures/product/ncs-generation-5-5-17-general-covenants.json');
  assert.equal(stored.length, 32);
  const view = buildTableView({ facts: stored, tableShapes, legalSchema });
  const consideration = view.sections.find((section) => section.section_key === 'consideration-hero');
  const table = consideration.tables[consideration.tables.length - 1];
  assert.equal(table.table_key, 'consideration-registration-rights');
  assert.deepEqual(table.rows.map((row) => [row.subject, row.backing_facts.length, row.sub_rows]), [['Registration rights', 29, undefined]]);
  const covenants = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'general-covenants-table');
  assert.deepEqual(covenants.rows.map((row) => [row.subject, row.backing_facts.map((entry) => entry.fact_id).sort()]), [
    ['Litigation notification', ['52e8af75']],
    ['General notification', ['31da8ce7', '369c5c72']],
  ]);
  assert.equal(view.sections.flatMap((section) => section.without_readout || []).length, 0);
  // (f): the stockholders' obligations read in their words; Parent's
  // obligor readings are stated in the summaries and kept under
  // stated_in_summary (work package B4's rule).
  const obligor = table.rows[0].cells.find((cell) => cell.column_id === 'obligor');
  assert.deepEqual(obligor.values.map((value) => [value.code, value.label]).sort(), [
    ['OTHER_PARTY', 'Each Specified Stockholder'], ['OTHER_PARTY', 'Parent and each Specified Stockholder'], ['OTHER_PARTY', 'the Specified Stockholders'],
  ]);
  assert.deepEqual(obligor.stated_in_summary, ['PARENT']);
  // (g): the deadlines and timing triggers, never a bare event trigger.
  const byWhen = table.rows[0].cells.find((cell) => cell.column_id === 'byWhen');
  const labels = byWhen.values.map((value) => value.label);
  assert.ok(labels.includes('Promptly following the Closing Date (and in any event no later than two Business Days thereafter)'), labels.join(' | '));
  assert.ok(labels.includes('After the Registration Statement becomes effective'));
  assert.equal(labels.some((label) => /upon the discovery|insofar as such losses|as such expenses are incurred/.test(label)), false, 'event triggers are not deadlines');
});


// Work package 19 (d) (manager finding (165); NCS generation 5): the eight
// VALID facts the page listed without a readout (and the no-Parent-MAE
// condition beside them), as stored, each on its row.
test('NCS generation 5\'s facts without a readout each take a row: the mutual and party conditions, the written-consent termination rights, remedies preserved, construction and cumulative remedies', () => {
  const stored = (id, section, family, subtype, factType, statement, summary, texts) => ({
    fact_id: id, proposal_id: id, family_key: family, subtype_key: subtype, fact_type: factType, section_reference: section, structure_node_id: `n-${section}`, validation_status: 'VALID', statement,
    headline: { label: summary.split(' ').slice(0, 3).join(' '), summary, distinguishing_component_ids: [`${id}-0`] },
    components: texts.map(([kind, text], index) => ({ component_id: `${id}-${index}`, kind, label: 'words', text, origin: 'OWN', source_span_id: 's', start_byte: index * 10, end_byte: index * 10 + 5, gap_before: false, children: [] })),
  });
  const facts = [
    stored('f54d1f70', '6.1', 'CLOSING_CONDITIONS', 'GENERAL_CLOSING_CONDITION', 'GENERAL_CLOSING_CONDITION', 'The obligation of each Party to effect the Merger is subject to the satisfaction at or prior to the Effective Time of the condition that the Information Statement shall have been mailed to all holders of the Company Common Stock following effectiveness of the Form S-4 and at least 20 Business Days prior to the Closing Date.', 'Information Statement mailed to Company stockholders at least 20 Business Days before Closing', [['OBJECT', 'The Information Statement'], ['OPERATION', 'shall have been mailed to all holders of the Company Common Stock'], ['TRIGGER', 'following effectiveness of the Form S-4'], ['PERIOD', 'at least 20 Business Days prior to the Closing Date']]),
    stored('a7fd4aca', '6.3', 'CLOSING_CONDITIONS', 'TAX_OPINION', 'GENERAL_CLOSING_CONDITION', "As a condition to the Company's obligation to effect the Merger, subject to satisfaction or waiver by the Company at or prior to the Effective Time, the Company shall have received, on the Closing Date but before the Effective Time, an opinion in form and substance reasonably satisfactory to the Company (the Closing Tax Opinion) from Tax Counsel concluding that the Merger will qualify for the Intended Tax Treatment.", 'Company must receive Tax Counsel opinion that the Merger qualifies for the Intended Tax Treatment', [['ACTOR', 'The Company'], ['OPERATION', 'shall have received'], ['TRIGGER', 'on the Closing Date, but before the Effective Time'], ['OBJECT', 'an opinion'], ['STANDARD', 'in form and substance reasonably satisfactory to the Company']]),
    stored('d5e41bd3', '6.3', 'CLOSING_CONDITIONS', 'GENERAL_CLOSING_CONDITION', 'GENERAL_CLOSING_CONDITION', "As a condition to the Company's obligation to effect the Merger, subject to satisfaction or waiver by the Company at or prior to the Effective Time, the Company shall have timely remitted the entire amount of any and all the required tax deposits necessary to fully proceed with its Notice of Objection.", 'Company must have timely remitted required tax deposits for its Canadian and Alberta objections', [['ACTOR', 'The Company'], ['OPERATION', 'shall have timely remitted'], ['OBJECT', 'the entire amount of any and all the required tax deposits necessary to fully proceed with its Notice of Objection']]),
    stored('e9bd4f85', '6.3', 'CLOSING_CONDITIONS', 'FRUSTRATION', 'NO_MAE_CONDITION', "As a condition to the Company's obligation to effect the Merger, since the date of this Agreement there shall not have occurred any event that has had or would reasonably be expected to have a Parent Material Adverse Effect.", 'No Parent Material Adverse Effect has occurred since the date of the Agreement', [['TRIGGER', 'Since the date of this Agreement'], ['OPERATION', 'there shall not have occurred'], ['LITANY', 'any event, change, circumstance, occurrence, effect or state of facts'], ['STANDARD', 'that has had or would reasonably be expected to have']]),
    stored('4df07313', '7.1', 'TERMINATION', 'WRITTEN_CONSENT_NOT_DELIVERED', 'TERMINATION_RIGHT', 'Parent may terminate this Agreement and abandon the Merger if the Written Consent, duly executed by the Consenting Stockholders, shall not have been delivered to Parent and the Company by the Consent Time.', "Parent may terminate if Consenting Stockholders' Written Consent is not delivered by the Consent Time", [['ACTOR', 'by Parent'], ['TRIGGER', 'if the Written Consent, duly executed by the Consenting Stockholders, shall not have been delivered to Parent and the Company'], ['CONDITION', 'by the Consent Time']]),
    stored('0f4dd949', '7.1', 'TERMINATION', 'SUPPORT_AGREEMENT_NOT_DELIVERED', 'TERMINATION_RIGHT', 'Parent may terminate this Agreement and abandon the Merger if the Support Agreement, duly executed by the Consenting Stockholders, shall not have been delivered to Parent and the Company by the Consent Time.', 'Parent may terminate if the executed Support Agreement is not delivered by the Consent Time', [['ACTOR', 'by Parent'], ['TRIGGER', 'if the Support Agreement, duly executed by the Consenting Stockholders, shall not have been delivered to Parent and the Company'], ['CONDITION', 'by the Consent Time']]),
    stored('ee3f3736', '7.2', 'TERMINATION', 'REMEDY_ENTITLEMENT', 'TERMINATION_EFFECT', 'Where liability for fraud or willful and material breach is preserved, then, except as otherwise provided in Section 7.3, the non-breaching Party shall be entitled to all rights and remedies available at law or in equity.', 'Non-breaching Party keeps all rights and remedies at law or in equity', [['TRIGGER', 'in which case'], ['EXCEPTION', 'except as otherwise provided in Section 7.3'], ['ACTOR', 'the non-breaching Party'], ['OPERATION', 'shall be entitled to all rights and remedies available at law or in equity']]),
    stored('17a1ac3c', '7.3', 'MISC_BOILERPLATE', 'CONSTRUCTION', 'MISC_BOILERPLATE_MECHANIC_PRESENT', 'The Company warrants that it does not have an establishment for VAT purposes in any EU Member State, that it is in business for VAT purposes, and that it will make any payment of the Company Termination Fee in the course of such business for VAT purposes.', 'Company warrants no EU VAT establishment and business-course payment of the fee', [['ACTOR', 'The Company warrants'], ['OBJECT', 'that it does not have an establishment for VAT purposes in any EU Member State'], ['OBJECT', 'that it is in business for VAT purposes']]),
    stored('7358e051', '7.5', 'SPECIFIC_PERFORMANCE_REMEDIES', 'CUMULATIVE_RIGHTS', 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT', 'The rights and remedies of the Parties are cumulative and are not exclusive of any rights or remedies which they would otherwise have hereunder.', "The Parties' rights and remedies are cumulative and not exclusive of other remedies", [['ACTOR', 'The rights and remedies of the Parties'], ['OPERATION', 'are cumulative and are not exclusive'], ['OBJECT', 'of any rights or remedies which they would otherwise have hereunder']]),
  ];
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const placement = new Map();
  for (const section of view.sections) for (const table of section.tables) for (const row of table.rows) for (const entry of row.backing_facts) placement.set(entry.fact_id, [table.table_key, row.subject]);
  assert.deepEqual(Object.fromEntries([...placement.entries()].sort()), {
    '0f4dd949': ['termination-rights-buyer-may-terminate', 'Support agreement not delivered'],
    '17a1ac3c': ['misc-boilerplate-table', 'Construction'],
    '4df07313': ['termination-rights-buyer-may-terminate', 'Written consent not delivered'],
    '7358e051': ['misc-boilerplate-table', 'Cumulative remedies'],
    a7fd4aca: ['conditions-s-table', 'Tax opinion'],
    d5e41bd3: ['conditions-s-table', 'Other conditions'],
    e9bd4f85: ['conditions-s-table', 'No Material Adverse Effect'],
    ee3f3736: ['termination-rights-effect', 'Remedies preserved'],
    f54d1f70: ['conditions-table', 'Other mutual conditions'],
  });
  assert.equal(view.sections.flatMap((section) => section.without_readout || []).length, 0, 'nothing is left without a readout');
});
