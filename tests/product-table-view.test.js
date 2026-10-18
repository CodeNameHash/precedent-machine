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
