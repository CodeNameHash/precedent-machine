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
  assert.equal(byColumn.provision.kind, 'dash');

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
  // Rows follow the precedent's fixed order (decision 34), not arrival order.
  assert.deepEqual(table.rows.map((row) => row.subject), ['Acts of war, armed hostilities, or terrorism', 'Changes in GAAP or accounting principles']);
  const gaapCell = table.rows[1].cells.find((cell) => cell.column_id === 'disproportionateCarveback');
  assert.equal(gaapCell.label, 'No');
  assert.equal(gaapCell.code, 'NO');
  assert.equal(gaapCell.defaulted, true);
  assert.equal(table.rows[0].cells.find((cell) => cell.column_id === 'disproportionateCarveback').label, 'Yes');
  assert.equal(table.footer.label, 'Disproportionate carve-back as drafted');
  // The footer shows the carve-back as drafted (its own words in full), not the cited fragment (decision 34).
  assert.deepEqual(table.footer.entries.map((entry) => [entry.fact_id, entry.text]), [['mae-cb', 'except to the extent disproportionate clauses (i) through (iv)']]);
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
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'conditions-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'detail');
  assert.equal(cell.label, 'No Judgment issued by any court of competent jurisdiction or Law enacted by any Governmental Entity preventing or prohibiting the consummation of the Merger shall be in effect');
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
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const table = view.sections.flatMap((section) => section.tables).find((candidate) => candidate.table_key === 'structure-mechanics-table');
  const cell = table.rows[0].cells.find((candidate) => candidate.column_id === 'closingTiming');
  assert.equal(cell.label, 'the closing (the “Closing”) of the Merger shall take place at 8:00 a.m., New York City time on the third (3rd) business day');
  assert.deepEqual(cell.component_ids, ['time', 'period', 'trigger'], 'the cited words stay the click target');
  // A distinguishing component after skipped words is joined with an ellipsis.
  fact.headline.distinguishing_component_ids = ['exc'];
  const again = buildTableView({ facts: [fact], tableShapes, legalSchema }).sections.flatMap((section) => section.tables)
    .find((candidate) => candidate.table_key === 'structure-mechanics-table').rows[0].cells.find((candidate) => candidate.column_id === 'closingTiming');
  assert.equal(again.label, 'the closing (the “Closing”) of the Merger shall take place … other than those conditions that by their nature are to be satisfied at the Closing');
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
  assert.deepEqual(parts('closing-amount'), { term: 'Closing Amount', definition: '$47.50 in cash, without interest' });
  assert.deepEqual(parts('appraisal-shares'), { term: 'Appraisal Shares', definition: 'shares of Company Common Stock held by any Person who is entitled to demand appraisal' });
  assert.deepEqual(parts('cvr-agreement'), { term: 'CVR Agreement', definition: 'the Contingent Value Rights Agreement between Parent and the Rights Agent' });
  assert.deepEqual(parts('bday'), { term: 'business day', definition: 'any day on which the principal offices of the SEC are open' });
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
  assert.deepEqual(table.columns.map((column) => column.column_id), ['authorised', 'issued', 'reserved', 'asOf', 'validIssuance', 'asDrafted']);
  const cellOf = (row, columnId) => row.cells.find((cell) => cell.column_id === columnId);
  const rowOf = (subject) => table.rows.find((row) => row.subject === subject);
  assert.deepEqual(table.rows.map((row) => row.subject), ['Common Stock', 'Company Stock Options', 'ESPP']);
  const common = rowOf('Common Stock');
  assert.equal(cellOf(common, 'authorised').label, '800000000', 'the first count names the common stock');
  assert.deepEqual(cellOf(common, 'authorised').component_ids, ['a-common']);
  assert.equal(cellOf(common, 'issued').label, '105278627');
  assert.equal(cellOf(common, 'reserved').label, '6331920', 'the plan reserve, its ESPP exception not naming the row');
  assert.equal(cellOf(common, 'asOf').label, 'September 18, 2025', 'the Measurement Date inherited from the chapeau');
  assert.equal(cellOf(common, 'validIssuance').label, 'Present');
  assert.deepEqual(common.backing_facts.map((entry) => entry.fact_id), ['cap-auth', 'cap-issued', 'cap-plans', 'cap-valid']);
  // A column filled only by named subtypes is never completed from another
  // subtype's number: the issued count does not become an authorised count.
  assert.equal(cellOf(rowOf('Company Stock Options'), 'authorised').kind, 'dash');
  assert.equal(cellOf(rowOf('Company Stock Options'), 'issued').label, '12262280');
  assert.equal(cellOf(rowOf('ESPP'), 'reserved').label, '1263830');
  assert.equal(table.footer.label, 'No other securities');
  assert.deepEqual(table.footer.entries.map((entry) => entry.fact_id), ['cap-absence']);
  assert.equal(table.footer.entries[0].text, 'no shares of Company Preferred Stock were issued or outstanding');
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
  assert.equal(cap.rows[0].cells.find((cell) => cell.column_id === 'issued').label, '105278627');
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
test('provisionTerm prefers headline.summary and falls back to the label-built term', () => {
  const { provisionTerm } = require('../lib/product/table-view');
  const components = [
    { component_id: 'pt-actor', kind: 'ACTOR', label: 'Company', text: 'the Company', origin: 'OWN', children: [] },
    { component_id: 'pt-op', kind: 'OPERATION', label: 'files', text: 'shall file', origin: 'OWN', children: [] },
  ];
  const older = { fact_id: 'pt-1', headline: { label: 'Certificate of merger filing', distinguishing_component_ids: ['pt-op'] }, components };
  assert.equal(provisionTerm(older, components), 'Company · files');
  const summarised = { ...older, headline: { ...older.headline, summary: 'Company files the Certificate of Merger with the Delaware Secretary of State' } };
  assert.equal(provisionTerm(summarised, components), 'Company files the Certificate of Merger with the Delaware Secretary of State');
  const blank = { ...older, headline: { ...older.headline, summary: '   ' } };
  assert.equal(provisionTerm(blank, components), 'Company · files', 'a blank summary is no summary');
});
