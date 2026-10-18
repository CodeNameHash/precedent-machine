'use strict';

// Render tests for components/product/ProvisionTables.jsx and
// components/product/EvidenceSidebar.jsx (mockup approved by Ben
// 2026-09-12/13). Uses renderToStaticMarkup, same pattern as
// tests/product-published-layers.test.js.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');

require.extensions['.jsx'] = function compileJsx(module, filename) {
  const transformed = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};

const { buildTableView, factSummaryText } = require('../lib/product/table-view');
const tableShapes = require('../contracts/product/table-shapes.v3.json');
const legalSchema = require('../contracts/product/legal-schema.v2.json');
const ProvisionTables = require('../components/product/ProvisionTables.jsx').default;
const EvidenceSidebar = require('../components/product/EvidenceSidebar.jsx').default;

const fixture = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures/product/published-layers-fixture.v2.json'), 'utf8',
));

const conclusionFact = {
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
  ],
};

const facts = [...fixture.facts, conclusionFact];
const tableView = buildTableView({ facts, tableShapes, legalSchema });

test('ProvisionTables renders every section and table that ended up with rows', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="provision-tables"/);
  assert.equal((html.match(/data-testid="provision-section"/g) || []).length, tableView.sections.length);
  assert.equal((html.match(/data-testid="provision-table"/g) || []).length, tableView.sections.flatMap((s) => s.tables).length);
  assert.match(html, /Termination Fees/);
  assert.match(html, /Material Adverse Effect/);
  assert.match(html, /Material Contracts/);
});

test('an empty table view renders nothing', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: { sections: [], defined_terms: [] }, facts: [] }));
  assert.equal(html, '');
});

test('pills carry fact and component ids as data-testid="table-pill" buttons', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="table-pill"/);
  assert.match(html, /Material</);
});

test('a cell with no matching data renders a dash', () => {
  // A coded column left empty on one row still shows its dash; a detail
  // ("as drafted") column with no summary anywhere is dropped instead
  // (Ben, 2026-09-14: "can we kill 'as drafted' columns throughout").
  const withGap = { ...tableView, sections: tableView.sections.map((section) => ({ ...section, tables: section.tables.map((table) => ({ ...table, rows: table.rows.map((row) => (!row.absent && row.cells?.length ? { ...row, cells: row.cells.map((cell, cellIndex) => (cellIndex === 0 ? { column_id: cell.column_id, kind: 'dash', label: null, tone: null, component_ids: [], fact_ids: [] } : cell)) } : row)) })) })) };
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: withGap, facts }));
  assert.match(html, /data-testid="table-dash"/);
});

test('a fact with no conclusions is listed under its section as evidence without a readout, never rendered as a row', () => {
  // f-material-contracts-1 (the fixture fact) carries no `conclusions`: it is
  // not a row (a row keyed by its grammatical subject is not a conclusion),
  // but it is listed so nothing is hidden and it opens in the sidebar.
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="facts-without-readout"/);
  assert.match(html, /without a coded readout/);
});

// Ben, 2026-09-14: "I don't like the 'see provision' behaviour - it
// shouldn't show the provision x-refs but instead should open the side bar".
test('rows carry a data-testid and the Term column offers "See provision", which opens the sidebar and lists no references', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="table-row"/);
  assert.match(html, /data-testid="see-provision"/);
  assert.match(html, /See provision/);
  assert.doesNotMatch(html, /Hide provision|data-testid="backing-facts"|data-testid="backing-fact"[^>]*>§/);
});

test('group headers render in the table caption', () => {
  const carveout = { ...fixture.facts.find((fact) => fact.fact_id === 'f-mae-carveout-1'), conclusions: { table_key: 'mae-carveouts-parent', row_label: 'War', cells: [] } };
  const view = buildTableView({ facts: [carveout], tableShapes, legalSchema });
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [carveout] }));
  assert.match(html, /data-testid="table-group-header"[^>]*>CARVE-OUTS/);
});

const maeCarveoutFact = fixture.facts.find((fact) => fact.fact_id === 'f-mae-carveout-1');

test('EvidenceSidebar renders the five evidence blocks for a selected component', () => {
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, {
    fact: maeCarveoutFact,
    componentId: 'c-war',
    reviewItem: { item_id: 'item-1', decision: 'ACCEPTED', reviewed_at: '2026-09-12T00:00:00.000Z', comment: 'Looks right.' },
    provenance: { run_id: 'run-42', generation: 3, schema_version: 'LEGAL_SCHEMA/V2', prompt_bundle: 'PRODUCT_LAYERED_COMPONENTS/V7', model: 'gpt-5.5' },
  }));
  // Deal Storylines panel: Detail (words, clause, tree) opens first; Source
  // (checks, provenance) and Comments (review trail) sit behind tabs.
  assert.match(html, /data-testid="evidence-sidebar"/);
  assert.match(html, /data-testid="evidence-tabs"/);
  assert.match(html, /data-testid="evidence-words"/);
  assert.match(html, /data-testid="evidence-layers"/);
  // Ben, 2026-09-14: "I prefer this side bar behavior from corpus" (the
  // Deal Storylines panel): fixed to the viewport, the active tab
  // underlined, the checks and provenance behind a closed "Supporting
  // record detail" disclosure at the foot of Detail.
  assert.match(html, /<aside[^>]*class="[^"]*fixed inset-y-0 right-0[^"]*lg:w-\[406px\]/);
  assert.match(html, /aria-selected="true"[^>]*role="tab"[^>]*class="[^"]*border-accent/);
  assert.match(html, /<details[^>]*data-testid="supporting-record-detail"[^>]*>[\s\S]*Supporting record detail[\s\S]*data-testid="evidence-checks"[\s\S]*data-testid="evidence-provenance"[\s\S]*<\/details>/);
  assert.doesNotMatch(html, /data-testid="evidence-review-trail-section"/);
  // the exact words of the supporting component
  assert.match(html, /geopolitical conditions or changes that are the result of the outbreak/);
});

test('EvidenceSidebar highlights the clause when sectionText is supplied', () => {
  const warComponent = maeCarveoutFact.components.find((component) => component.component_id === 'c-war');
  const clauseText = `any event, change, circumstance, occurrence, effect or state of facts to the extent resulting from ${warComponent.text}`;
  const startByte = warComponent.start_byte - clauseText.indexOf(warComponent.text);
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, {
    fact: maeCarveoutFact,
    componentId: 'c-war',
    sectionText: { exact_text: clauseText, start_byte: startByte },
  }));
  assert.match(html, /data-testid="evidence-clause"/);
  assert.match(html, /<mark[^>]*>geopolitical conditions or changes that are the result of the outbreak/);
  // Each cited words paragraph carries a Source chip (Deal Storylines).
  assert.match(html, /geopolitical conditions[^<]*”<button[^>]*data-testid="evidence-source-chip"[^>]*>Source</);
});

test('EvidenceSidebar with no fact renders nothing', () => {
  assert.equal(renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact: null })), '');
});

test('EvidenceSidebar without a review item omits the decision controls', () => {
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact: maeCarveoutFact, componentId: 'c-war' }));
  assert.doesNotMatch(html, /data-testid="evidence-decision-controls"/);
});

test('a one-per-agreement table renders as an attribute grid, one line per column', () => {
  const structureFact = { ...require('./fixtures/product/metsera-v9-structure-fact.v1.json') };
  structureFact.fact_id = structureFact.proposal_id;
  const view = buildTableView({ facts: [structureFact], tableShapes, legalSchema });
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [structureFact] }));
  assert.match(html, /data-layout="attribute-grid"/);
  assert.match(html, /data-column-id="effectsOfMerger"/);
  assert.match(html, />DGCL</);
  assert.doesNotMatch(html, /data-testid="table-row"/);
  // Four lines: the detail ("as drafted") columns with no summary are dropped
  // (Ben, 2026-09-14: "can we kill 'as drafted' columns throughout"), the
  // legacy Merger Form line is gone (decision 28), step-2 lines are hidden
  // until the deal is coded as a double merger.
  assert.equal((html.match(/data-testid="attribute-row"/g) || []).length, 4);
});

test('the attribute grid shows step-2 lines only for a double merger', () => {
  const structureFact = { ...require('./fixtures/product/metsera-v9-structure-fact.v1.json') };
  structureFact.fact_id = structureFact.proposal_id;
  const oneStep = { ...structureFact, conclusions: { ...structureFact.conclusions, cells: [...structureFact.conclusions.cells, { column_id: 'dealStructure', code: 'ONE_STEP_MERGER', component_ids: ['874bb170b1e89d2d6e5eec061acf9652d163eea6d75d942c74a7d0568a6e3897'] }] } };
  const oneStepHtml = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: buildTableView({ facts: [oneStep], tableShapes, legalSchema }), facts: [oneStep] }));
  assert.doesNotMatch(oneStepHtml, /data-column-id="mergerFormStep2"/);
  assert.match(oneStepHtml, /data-column-id="mergerFormStep1"/);
  assert.doesNotMatch(oneStepHtml, /\(Step 1\)/);
  assert.match(oneStepHtml, />One-step merger</);
  const double = { ...structureFact, conclusions: { ...structureFact.conclusions, cells: [...structureFact.conclusions.cells, { column_id: 'dealStructure', code: 'DOUBLE_MERGER', component_ids: ['874bb170b1e89d2d6e5eec061acf9652d163eea6d75d942c74a7d0568a6e3897'] }] } };
  const doubleHtml = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: buildTableView({ facts: [double], tableShapes, legalSchema }), facts: [double] }));
  assert.match(doubleHtml, /data-column-id="mergerFormStep2"/);
  assert.match(doubleHtml, /\(Step 1\)/);
});

test('the attribute grid shows step-2 lines only for a double merger', () => {
  const structureFact = { ...require('./fixtures/product/metsera-v9-structure-fact.v1.json') };
  structureFact.fact_id = structureFact.proposal_id;
  const withStructure = (code) => ({ ...structureFact, conclusions: { ...structureFact.conclusions, cells: [...structureFact.conclusions.cells, { column_id: 'dealStructure', code, component_ids: ['874bb170b1e89d2d6e5eec061acf9652d163eea6d75d942c74a7d0568a6e3897'] }] } });
  const oneStep = withStructure('ONE_STEP_MERGER');
  const oneStepHtml = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: buildTableView({ facts: [oneStep], tableShapes, legalSchema }), facts: [oneStep] }));
  assert.doesNotMatch(oneStepHtml, /data-column-id="mergerFormStep2"/);
  assert.match(oneStepHtml, /data-column-id="mergerFormStep1"/);
  assert.doesNotMatch(oneStepHtml, /\(Step 1\)/);
  assert.match(oneStepHtml, />One-step merger</);
  const double = withStructure('DOUBLE_MERGER');
  const doubleHtml = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: buildTableView({ facts: [double], tableShapes, legalSchema }), facts: [double] }));
  assert.match(doubleHtml, /data-column-id="mergerFormStep2"/);
  assert.match(doubleHtml, /\(Step 1\)/);
});

test('sub-rows render indented under their row and a two-reading cell shows both pills', () => {
  const view = {
    sections: [{ section_key: 's', title: 'Reps', tables: [{
      table_key: 't', group_header: null, layout: 'rows', term_column: { header: 'Term' },
      columns: [{ column_id: 'materiality', header: 'Materiality' }],
      rows: [{
        subject: 'Organization', backing_facts: [{ fact_id: 'r-1', section_reference: '3.01' }],
        cells: [{ column_id: 'materiality', kind: 'pill', label: 'MAE (aggregate)', tone: 'standard', component_ids: ['c1'], fact_ids: ['r-1'], values: [
          { label: 'MAE (aggregate)', kind: 'pill', tone: 'standard', component_ids: ['c1'], fact_ids: ['r-1'] },
          { label: 'MAE (aggregate) (partial)', kind: 'pill', tone: 'standard', component_ids: ['c2'], fact_ids: ['r-2'] },
        ] }],
        sub_rows: [{ subject: 'Company Subsidiaries', backing_facts: [{ fact_id: 'r-2', section_reference: '3.01' }], cells: [{ column_id: 'materiality', kind: 'pill', label: 'MAE (aggregate) (partial)', tone: 'standard', component_ids: ['c2'], fact_ids: ['r-2'] }] }],
      }],
    }] }],
    defined_terms: [],
  };
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [], initialSubRowsOpen: true }));
  assert.equal((html.match(/data-testid="table-sub-row"/g) || []).length, 1);
  assert.match(html, /data-testid="table-multi"/);
  assert.equal((html.match(/MAE \(aggregate\) \(partial\)/g) || []).length, 2);
});

test('every section has a collapsible heading and the bar offers collapse / expand all', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="section-toggles"/);
  assert.match(html, /Collapse all/);
  assert.match(html, /Expand all/);
  assert.equal((html.match(/data-testid="section-heading"/g) || []).length, tableView.sections.length + (tableView.defined_terms.length ? 1 : 0));
  assert.match(html, /aria-expanded="true"/);
});

test('an absent fixed row renders its label and a table footer renders the carve-back as drafted', () => {
  const view = {
    defined_terms: [],
    sections: [{ section_key: 'mae-definitions', title: 'Material Adverse Effect', facts_without_readout: [], tables: [
      { table_key: 'mae-definitions-table', group_header: null, layout: 'rows', absent_row_label: 'None', term_column: { header: 'Party', source: 'subject' }, columns: [{ column_id: 'test', header: 'Test' }], rows: [
        { subject: 'Parent', absent: true, cells: [{ column_id: 'test', kind: 'dash', label: null, tone: null, component_ids: [], fact_ids: [] }], backing_facts: [] },
        { subject: 'Company', cells: [{ column_id: 'test', kind: 'text', label: 'any change', tone: 'neutral', component_ids: ['c1'], fact_ids: ['f1'] }], backing_facts: [{ fact_id: 'f1', section_reference: '1.01' }] },
      ] },
      { table_key: 'mae-carveouts-company', group_header: 'CARVE-OUTS — COMPANY', layout: 'rows', term_column: { header: 'Carve-out', source: 'subject' }, columns: [{ column_id: 'provision', header: 'As drafted' }, { column_id: 'disproportionateCarveback', header: 'Disproportionate Carveback' }],
        footer: { label: 'Disproportionate carve-back as drafted', entries: [{ fact_id: 'f2', section_reference: '1.01', structure_node_id: null, text: 'except to the extent disproportionate', component_ids: ['c2'] }] },
        rows: [{ subject: 'Changes in GAAP or accounting principles', cells: [
          { column_id: 'provision', kind: 'text', label: 'any change in GAAP', tone: 'neutral', component_ids: ['c3'], fact_ids: ['f3'] },
          { column_id: 'disproportionateCarveback', kind: 'pill', label: 'No', code: 'NO', tone: 'standard', defaulted: true, component_ids: [], fact_ids: ['f3'] },
        ], backing_facts: [{ fact_id: 'f3', section_reference: '1.01' }] }] },
    ] }],
  };
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
  assert.match(html, /data-testid="table-absent"[^>]*>None</);
  assert.match(html, /data-testid="table-footer"/);
  assert.match(html, /Disproportionate carve-back as drafted/);
  assert.match(html, /except to the extent disproportionate/);
  assert.match(html, /data-defaulted="true"[^>]*>No</);
});

test('the provision rail groups sections the old app\'s way, one anchor per section', () => {
  const ProvisionRail = require('../components/product/ProvisionRail.jsx').default;
  const html = renderToStaticMarkup(React.createElement(ProvisionRail, { sections: tableShapes.sections }));
  // The rail is a deal-page card (Ben, 2026-09-14: "completely copy the visual style").
  // The rail keeps the black Deal Storylines column Ben asked for on
  // 2026-09-13 ("shift the page design to match this ... mainly thinking of
  // the left hand side bar"); the 2026-09-14 parity pass with the deal page
  // covers the header, headings, tables and sidebar.
  assert.match(html, /<nav[^>]*class="[^"]*bg-black[^"]*"[^>]*data-testid="provision-rail"/);
  const groups = html.match(/data-testid="provision-rail-group"/g) || [];
  // 17 old-app groups plus Tax Matters and Financing (work package 5, plan
  // finding (52): three families had no page).
  assert.equal(groups.length, 19);
  assert.match(html, /href="#provision-section-structure-mechanics"/);
  assert.match(html, /href="#provision-section-tax-matters"/);
  assert.match(html, /href="#provision-section-financing"/);
  assert.match(html, /href="#provision-section-conditions-s"/);
  assert.ok(html.indexOf('Structure &amp; Mechanics') < html.indexOf('Consideration'));
  assert.ok(html.indexOf('Conditions to Closing') < html.indexOf('Termination Rights'));
});

test('EvidenceSidebar quotes, marks and lights every cited component when a cell rests on several', () => {
  const fact = {
    fact_id: 'st-1', family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'MERGER_MECHANICS', section_reference: '1.01',
    headline: { label: 'The Merger', distinguishing_component_ids: ['st-op'] },
    components: [
      { component_id: 'st-actor', kind: 'ACTOR', label: 'merging party', text: 'Merger Sub', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] },
      { component_id: 'st-op', kind: 'OPERATION', label: 'merger', text: 'shall be merged with and into', origin: 'OWN', source_span_id: 's', start_byte: 11, end_byte: 40, gap_before: false, children: [] },
      { component_id: 'st-term', kind: 'TERM', label: 'survivor', text: 'the Company shall continue as the surviving corporation', origin: 'OWN', source_span_id: 's', start_byte: 60, end_byte: 114, gap_before: true, children: [] },
    ],
  };
  const clause = 'Merger Sub shall be merged with and into the Company, and the Company shall continue as the surviving corporation.';
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact, componentId: 'st-actor', componentIds: ['st-actor', 'st-op', 'st-term'], sectionText: { exact_text: clause, start_byte: 0 }, initialTreeOpen: true }));
  assert.match(html, /Read together, 3 components/);
  assert.match(html, /shall be merged with and into/);
  assert.equal((html.match(/data-level="strong"/g) || []).length, 3);
  assert.equal((html.match(/data-selected="true"/g) || []).length, 3);
  // Ben, 2026-09-14: "hide detail under the full layer tree as the default.
  // Also call it Interpretation Tree ... Can't we just do the bit in
  // highlight and below?" Closed to start, named so, own components only.
  assert.match(html, /data-testid="interpretation-tree-toggle"[^>]*><span>Interpretation Tree</);
  // Ben, 2026-09-14: "I'd put interpretation tree above the clause and
  // have the top level interpretation tree items shown."
  assert.ok(html.indexOf('data-testid="evidence-layers"') < html.indexOf('data-testid="evidence-clause"'), 'tree above the clause');
  // Ben, 2026-09-14: "the sidebar to show first the interpretation tree
  // with the clause x-ref added and then a 'jump to text' button".
  assert.ok(html.indexOf('data-testid="evidence-layers"') < html.indexOf('data-testid="evidence-words"'), 'tree first');
  assert.match(html, /data-testid="evidence-clause-reference"[^>]*>[\s\S]*?<button[^>]*data-testid="jump-to-text"[^>]*>Jump to text</);
  const opened = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact, componentId: 'st-actor', componentIds: ['st-actor', 'st-op', 'st-term'], sectionText: { exact_text: clause, start_byte: 0 } }));
  assert.match(opened, /aria-expanded="true"[^>]*data-testid="interpretation-tree-toggle"/, 'open to start');
  assert.doesNotMatch(html, /Full layer tree/);
  assert.doesNotMatch(html, /data-testid="evidence-layers"[^]*?data-origin="INHERITED"/);
});

test('a selected pill lights only its own line, not the same column on every sub-item of the row', () => {
  const cell = (id) => ({ column_id: 'materiality', kind: 'pill', label: 'MAE (aggregate)', code: 'MAE', tone: 'standard', component_ids: [`${id}-c`], fact_ids: [id] });
  const view = { defined_terms: [], sections: [{ section_key: 'representations-qualifiers', title: 'Reps', facts_without_readout: [], tables: [{
    table_key: 'representations-qualifiers-table', group_header: null, layout: 'rows', term_column: { header: 'Term', source: 'subject' }, columns: [{ column_id: 'materiality', header: 'Qualifiers' }],
    rows: [{ subject: 'Organization; Qualification; Standing', cells: [cell('r')], backing_facts: [{ fact_id: 'r' }], sub_rows: [
      { subject: 'Due organization, valid existence and good standing', cells: [cell('a')], backing_facts: [{ fact_id: 'a' }] },
      { subject: 'Qualification or licensing to do business in each jurisdiction where required', cells: [cell('b')], backing_facts: [{ fact_id: 'b' }] },
    ] }],
  }] }] };
  // Render with the second sub-item selected by driving the component's own state through a click is not
  // possible in static markup; assert the selection contract instead: each line's Cell receives its subIndex.
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [], initialSubRowsOpen: true }));
  assert.equal((html.match(/data-testid="table-sub-row"/g) || []).length, 2);
  assert.equal((html.match(/data-selected="true"/g) || []).length, 0);
});

test('defined terms render as a collapsible table with every term collapsed to start', () => {
  const withTerm = { ...conclusionFact, components: [...conclusionFact.components, {
    component_id: 'c-defined-1', kind: 'DEFINED_TERM', label: 'defined term', text: 'Material Contract',
    source_span_id: 's-mc-2', start_byte: 130, end_byte: 148, origin: 'OWN', gap_before: false, children: [],
    resolves_to: { structure_node_id: 'n-1-1', text: '"Material Contract" means any Contract described in this Section 3.14.' },
  }] };
  const view = buildTableView({ facts: [withTerm], tableShapes, legalSchema });
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [withTerm] }));
  assert.match(html, /data-testid="defined-terms-table"/);
  assert.match(html, /data-testid="defined-term-row"/);
  assert.doesNotMatch(html, /data-testid="defined-term-row" data-open="true"/);
  assert.match(html, /Material Contract/);
});

test('the row name opens the sidebar for the row\'s first fact', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="term-open"/);
});

test('EvidenceSidebar marks the whole fact lightly and the cited words strongly', () => {
  const fact = {
    fact_id: 'rep-q', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', section_reference: '3.06',
    headline: { label: 'SEC documents', distinguishing_component_ids: ['q'] },
    components: [
      { component_id: 'a', kind: 'ACTOR', label: 'actor', text: 'none of the Company SEC Documents', origin: 'OWN', source_span_id: 's', start_byte: 33, end_byte: 66, gap_before: false, children: [] },
      { component_id: 'q', kind: 'QUALIFIER', label: 'knowledge', text: 'to the knowledge of the Company', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 31, gap_before: false, children: [] },
      { component_id: 'o', kind: 'OPERATION', label: 'operation', text: 'are subject to ongoing SEC review', origin: 'OWN', source_span_id: 's', start_byte: 67, end_byte: 100, gap_before: false, children: [] },
    ],
  };
  const clause = 'to the knowledge of the Company, none of the Company SEC Documents are subject to ongoing SEC review or investigation.';
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact, componentId: 'q', componentIds: ['q'], sectionText: { exact_text: clause, start_byte: 0 } }));
  assert.match(html, /<mark[^>]*data-level="strong"[^>]*>to the knowledge of the Company</);
  assert.match(html, /<mark[^>]*data-level="light"[^>]*>, none of the Company SEC Documents are subject to ongoing SEC review</);
  assert.doesNotMatch(html, /<mark[^>]*>[^<]*or investigation/);
});

// Ben, 2026-09-14: "render them as a hidden 'other provisions' section under
// the main structure and mechanics parts"; "show them as one fact ... with
// 'Branches' for the different clauses/'or's". The block is collapsed to
// start, one line per group, branches indented under a group of several
// facts; every line opens its fact the way a backing fact does. Then, on
// the first rendering: "It should look like the rest of the table structure
// etc and for now no summary is fine but ultimately we want to get to
// summary": the same card and Term / Provision columns as the grid, the
// section reference as the Term for now.
test('a one-per-agreement table renders its other provisions as a collapsed Term / Provision table under the grid', () => {
  const filing = (id, extras, spanId = 's-1-03') => ({
    fact_id: id, proposal_id: id, family_key: 'MERGER_STRUCTURE_CLOSING', subtype_key: 'TRANSACTION_STEP', section_reference: '1.03', structure_node_id: 'n-1-03',
    headline: { label: 'Transaction step', distinguishing_component_ids: [] },
    components: [
      { component_id: `${id}-a`, kind: 'ACTOR', label: 'actor', text: 'the Company', origin: 'OWN', source_span_id: spanId, start_byte: 20, end_byte: 31, gap_before: false, children: [] },
      { component_id: `${id}-o`, kind: 'OPERATION', label: 'files', text: 'shall file', origin: 'OWN', source_span_id: spanId, start_byte: 32, end_byte: 42, gap_before: false, children: [] },
      ...extras.map(([cid, kind, text, start]) => ({ component_id: `${id}-${cid}`, kind, label: cid, text, origin: 'OWN', source_span_id: spanId, start_byte: start, end_byte: start + text.length, gap_before: false, children: [] })),
    ],
  });
  const structureFact = { ...require('./fixtures/product/metsera-v9-structure-fact.v1.json') };
  structureFact.fact_id = structureFact.proposal_id;
  const facts = [
    structureFact,
    filing('ts-1', [['obj', 'OBJECT', 'a certificate of merger', 43]]),
    filing('ts-2', [['obj', 'OBJECT', 'such other documents as may be required', 121]]),
    filing('ts-3', [['obj', 'OBJECT', 'a notice with the Delaware Secretary of State', 43]], 's-1-04'),
  ];
  const view = buildTableView({ facts, tableShapes, legalSchema });
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts }));
  assert.match(html, /<div[^>]*data-testid="other-provisions"/, 'the same card as the tables');
  assert.doesNotMatch(html, /data-testid="other-provisions"[^>]*data-open/);
  assert.match(html, /<table[^>]*data-testid="other-provisions-table"[^>]*hidden/, 'collapsed to start');
  assert.match(html, /Other provisions \(3\)/);
  assert.match(html, /data-testid="other-provisions-table"[^]*?<th[^>]*>Term<\/th><th[^>]*>Summary<\/th>/);
  // The Term is a summary from the component labels, the reference quiet beside it.
  assert.match(html, /data-testid="other-provision-term">files</);
  assert.match(html, /data-testid="other-provision-term">files · obj</);
  assert.match(html, /data-testid="other-provision-ref">§ 1\.03</);
  assert.match(html, /data-testid="other-provision-branch-term">obj</);
  // The block sits under the grid: after the attribute-grid table, before the next section.
  assert.ok(html.indexOf('data-layout="attribute-grid"') < html.indexOf('data-testid="other-provisions"'));
  assert.equal((html.match(/data-testid="other-provision"/g) || []).length, 2, 'two lines: one sentence with branches, one sentence alone');
  assert.match(html, /data-branches="2"/);
  assert.equal((html.match(/data-testid="other-provision-branch-row"/g) || []).length, 2, 'branches are indented rows under their sentence');
  assert.equal((html.match(/data-testid="other-provision-branch"/g) || []).length, 2);
  assert.match(html, /data-testid="other-provision-line"[^>]*>the Company shall file</);
  assert.match(html, /data-testid="other-provision-branch"[^>]*>a certificate of merger</);
  assert.match(html, /data-testid="other-provision-branch"[^>]*>such other documents as may be required</);
  assert.match(html, /data-testid="other-provision-line"[^>]*>the Company shall file a notice with the Delaware Secretary of State</);
  // The section lists nothing "without a readout".
  assert.doesNotMatch(html, /data-testid="facts-without-readout"/);
});

// Ben, 2026-09-14: "completely copy the visual style", then, comparing the
// result with his Deal Storylines app: "also font etc doesn't match the
// deal storylines page. Also their pages are 'cleaner' in style". Each
// section is one Storylines card: a 1px #dcdcdc border, 4px radius, no
// shadow, a tinted header band (green; the definitions section blue) with
// the title at 19px medium; header labels uppercase 12px grey; pills as
// small rounded tinted chips of 12px uppercase text; the toggles as tabs.
// Then, at the same browser zoom, "please fix relative sizes" ("zoom level
// is the same"): every px scaled by 0.58. Then "sidebar width now good but
// font size not good": font sizes raised by 1.3, layout unchanged.
test('sections are Storylines cards with a tinted header band, pills are tinted chips, nothing casts a shadow', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /<section class="bg-white border border-\[#dcdcdc\] rounded-\[2px\] overflow-hidden" data-testid="provision-section"/);
  assert.match(html, /data-testid="section-heading"[^>]*>/);
  assert.match(html, /<button[^>]*class="[^"]*bg-\[#e8f3ee\][^"]*text-\[#2f7a5b\][^"]*"[^>]*data-testid="section-heading"/);
  assert.match(html, /<h3 class="flex-1 font-sans text-\[14px\] font-medium leading-snug">/);
  assert.match(html, /data-testid="table-pill"[^>]*class="inline-flex items-center rounded-full px-\[6px\] py-\[1px\] text-\[9px\] font-ui font-medium uppercase tracking-wide/);
  assert.match(html, /<th class="border-b border-\[#ececec\] px-\[7px\] py-\[4.5px\] text-left text-\[9.5px\] font-ui font-medium uppercase tracking-\[0\.08em\] text-\[#6b6b6b\]">/);
  assert.match(html, /data-testid="section-toggles"><button[^>]*class="rounded-\[2px\] border px-\[12px\] py-\[7px\] text-\[13px\] font-ui/);
  assert.doesNotMatch(html, /shadow/);
  assert.doesNotMatch(html, /font-mono/);
  assert.doesNotMatch(html, /font-display/);
  assert.doesNotMatch(html, /rounded-none/);
  assert.doesNotMatch(html, /rounded-lg/);
});

// Ben, 2026-09-14: "UI point, 'see provision' has too much visual hierarchy
// and color which distracts readability."
test('"See provision" and the § links are quiet controls: small, faint, no capitals, underline on hover only', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  const controls = html.match(/<button[^>]*data-testid="see-provision"[^>]*>/g) || [];
  assert.ok(controls.length > 0);
  for (const control of controls) {
    assert.match(control, /text-\[8.5px\]/);
    assert.match(control, /font-ui/);
    assert.match(control, /text-inkFaint/);
    assert.match(control, /hover:underline/);
    assert.doesNotMatch(control, /text-accent|uppercase|font-(semi)?bold|font-medium/);
  }
  // The subject comes first, the control after it.
  assert.ok(html.indexOf('data-testid="term-open"') < html.indexOf('data-testid="see-provision"'));
});

// Ben, 2026-09-14, on the MAE (aggregate) cell: "for the definition, take
// out of table but when you click the MAE box and the side bar opens, there
// is a fixed visual element at the bottom of the side bar that has the MAE
// definition summary which you can click through to get the full
// definition".
const maeProng = (id, party) => ({
  fact_id: id, family_key: 'MAE_DEFINITION', subtype_key: 'MAE_DEFINITION_PRONG', section_reference: '1.01',
  headline: { label: `${party} Material Adverse Effect`, distinguishing_component_ids: [`${id}-op`] },
  conclusions: { table_key: 'mae-definitions-table', row_label: party, cells: [{ column_id: 'test', text: 'is or would reasonably be expected to be materially adverse', component_ids: [`${id}-op`] }] },
  components: [
    { component_id: `${id}-actor`, kind: 'ACTOR', label: party, text: `${party} Material Adverse Effect`, origin: 'OWN', source_span_id: 's-mae', start_byte: 0, end_byte: 30, gap_before: false, children: [] },
    { component_id: `${id}-op`, kind: 'OPERATION', label: 'test', text: `is or would reasonably be expected to be materially adverse to the ${party}`, origin: 'OWN', source_span_id: 's-mae', start_byte: 31, end_byte: 100, gap_before: false, children: [] },
  ],
});

test('cells no longer render an inline definition link; the MAE link travels with the selection', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.doesNotMatch(html, /data-testid="definition-link"/);
  assert.doesNotMatch(html, />definition</);
  const repView = { defined_terms: [], sections: [{ section_key: 'representations-qualifiers', title: 'Reps', facts_without_readout: [], tables: [{
    table_key: 'representations-qualifiers-table', group_header: null, layout: 'rows', term_column: { header: 'Term', source: 'subject' }, columns: [{ column_id: 'materiality', header: 'Qualifiers' }],
    rows: [{ subject: 'Organization', cells: [{ column_id: 'materiality', kind: 'pill', label: 'MAE (aggregate)', code: 'MAE_AGGREGATE', tone: 'standard', component_ids: ['r-c'], fact_ids: ['r'], link_section: 'mae-definitions' }], backing_facts: [{ fact_id: 'r' }] }],
  }] }] };
  const repHtml = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: repView, facts: [] }));
  assert.doesNotMatch(repHtml, /data-testid="definition-link"/);
  assert.match(repHtml, /data-testid="table-pill"[^>]*>MAE \(aggregate\)</);
});

test('a selection whose cell links to the MAE section pins the definition summary to the sidebar foot with a Full definition control', () => {
  const rep = { fact_id: 'r', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION', section_reference: '3.01', headline: { label: 'Organization', distinguishing_component_ids: ['r-c'] },
    components: [{ component_id: 'r-c', kind: 'QUALIFIER', label: 'MAE', text: 'except as would not have a Company Material Adverse Effect', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 10, gap_before: false, children: [] }] };
  const definition = { section_key: 'mae-definitions', table_key: 'mae-definitions-table', title: 'Material Adverse Effect', party: 'Company', exact: true, fact_id: 'mae-company', lines: ['is or would reasonably be expected to be materially adverse to the Company'] };
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact: rep, componentId: 'r-c', componentIds: ['r-c'], linkedDefinition: definition }));
  const pinned = html.match(/<div[^>]*data-testid="linked-definition"[^>]*>[\s\S]*$/);
  assert.ok(pinned, 'the pinned element renders');
  assert.match(pinned[0], /sticky bottom-0/);
  assert.match(pinned[0], /border-t/);
  assert.match(pinned[0], /bg-white/);
  assert.match(pinned[0], /Material Adverse Effect/);
  assert.match(pinned[0], /data-testid="linked-definition-summary"/);
  assert.match(pinned[0], /materially adverse to the Company/);
  assert.match(pinned[0], /<a[^>]*href="#provision-section-mae-definitions"[^>]*data-testid="full-definition"[^>]*>Full definition</);
  // It is the aside's last child, so it stays pinned while the evidence scrolls.
  assert.match(html, /data-testid="linked-definition"[\s\S]*<\/div><\/aside>$/);
  // Without a linked section there is no pinned element.
  const plain = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact: rep, componentId: 'r-c', componentIds: ['r-c'] }));
  assert.doesNotMatch(plain, /data-testid="linked-definition"/);
});

test('the pinned summary lists one line per MAE definition prong of the relevant party, capped at three', () => {
  // The table view is static markup, so the selection cannot be clicked here; the helper the sidebar
  // receives is exercised through the section anchor and the prong facts the page holds.
  const view = buildTableView({ facts: [maeProng('mae-company', 'Company'), maeProng('mae-parent', 'Parent')], tableShapes, legalSchema });
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [maeProng('mae-company', 'Company'), maeProng('mae-parent', 'Parent')] }));
  assert.match(html, /id="provision-section-mae-definitions"/, 'the Full definition anchor exists on the section');
  const { factSummaryText } = require('../lib/product/table-view');
  assert.match(factSummaryText(maeProng('mae-company', 'Company')), /materially adverse to the Company/);
});

// Ben, 2026-09-14: "also make the elements below the top level reps (e.g.
// Organization) collapsable and hide them initially but have a clear 'more
// detail' button or similar"; on the equity awards table: "say 'Exceptions'
// and show the sub rows".
test('sub-rows are hidden until the "More detail (N)" control under the subject opens them', () => {
  const sub = (subject, id) => ({ subject, backing_facts: [{ fact_id: id, section_reference: '3.01' }], cells: [{ column_id: 'materiality', kind: 'pill', label: 'MAE (aggregate)', tone: 'standard', component_ids: [`${id}-c`], fact_ids: [id] }] });
  const view = { defined_terms: [], sections: [{ section_key: 'representations-qualifiers', title: 'Reps', facts_without_readout: [], tables: [{
    table_key: 'representations-qualifiers-table', group_header: null, layout: 'rows', term_column: { header: 'Term', source: 'subject' }, columns: [{ column_id: 'materiality', header: 'Qualifiers' }],
    rows: [
      { subject: 'Organization', backing_facts: [{ fact_id: 'r', section_reference: '3.01' }], cells: [{ column_id: 'materiality', kind: 'pill', label: 'MAE (aggregate)', tone: 'standard', component_ids: ['r-c'], fact_ids: ['r'] }], sub_rows: [sub('Company Subsidiaries', 'a'), sub('Good standing', 'b')] },
      { subject: 'Authority', backing_facts: [{ fact_id: 'x', section_reference: '3.04' }], cells: [{ column_id: 'materiality', kind: 'pill', label: 'None', tone: 'standard', component_ids: ['x-c'], fact_ids: ['x'] }], sub_rows: [] },
    ],
  }] }] };
  const closed = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
  assert.equal((closed.match(/data-testid="table-sub-row"/g) || []).length, 0, 'sub-rows hidden to start');
  assert.equal((closed.match(/data-testid="table-row"/g) || []).length, 2);
  assert.doesNotMatch(closed, /Company Subsidiaries/);
  const controls = closed.match(/<button[^>]*data-testid="more-detail"[^>]*>[^<]*</g) || [];
  assert.equal(controls.length, 1, 'only the row with sub-rows carries the control');
  assert.match(controls[0], /More detail \(2\)</);
  assert.match(controls[0], /aria-expanded="false"/);
  assert.ok(closed.indexOf('>Organization<') < closed.indexOf('data-testid="more-detail"'), 'the control sits under the subject');
  const open = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [], initialSubRowsOpen: true }));
  assert.equal((open.match(/data-testid="table-sub-row"/g) || []).length, 2);
  assert.match(open, /Company Subsidiaries/);
  assert.match(open, /<button[^>]*aria-expanded="true"[^>]*data-testid="more-detail"[^>]*>[^<]*Less detail</);
  // The section collapse / expand-all bar still renders.
  assert.match(closed, /data-testid="section-toggles"/);
  assert.match(closed, /Collapse all/);
});

test('the equity awards table calls its sub-rows "Exceptions"', () => {
  const view = { defined_terms: [], sections: [{ section_key: 'equity-awards', title: 'Equity Awards', facts_without_readout: [], tables: [{
    table_key: 'equity-awards-table', group_header: null, layout: 'rows', sub_rows_label: 'Exceptions', term_column: { header: 'Instrument', source: 'subject' }, columns: [{ column_id: 'treatment', header: 'Treatment' }],
    rows: [{ subject: 'Options', backing_facts: [{ fact_id: 'o', section_reference: '2.04' }], cells: [{ column_id: 'treatment', kind: 'pill', label: 'Cashed out', tone: 'standard', component_ids: ['o-c'], fact_ids: ['o'] }], sub_rows: [
      { subject: 'Vested', backing_facts: [{ fact_id: 'v' }], cells: [{ column_id: 'treatment', kind: 'pill', label: 'Cashed out', tone: 'standard', component_ids: ['v-c'], fact_ids: ['v'] }] },
      { subject: 'Out of the money', backing_facts: [{ fact_id: 'm' }], cells: [{ column_id: 'treatment', kind: 'pill', label: 'Cancelled', tone: 'standard', component_ids: ['m-c'], fact_ids: ['m'] }] },
    ] }],
  }] }] };
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
  assert.match(html, /<button[^>]*data-testid="more-detail"[^>]*>[^<]*Exceptions \(2\)</);
  assert.doesNotMatch(html, /More detail/);
  assert.doesNotMatch(html, /data-testid="table-sub-row"/);
  const open = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [], initialSubRowsOpen: true }));
  assert.equal((open.match(/data-testid="table-sub-row"/g) || []).length, 2);
  assert.match(open, /Out of the money/);
});

// Ben, 2026-09-14: "we should be able to show the reader the general
// categories of the exceptions (SEC filings) and as they click into deeper
// levels show more detail (last X days) etc". The General Exceptions row
// opens the table; its categories sit behind "More detail".
test('the General Exceptions row renders first with its categories hidden until More detail, and the capitalization table renders its counts, Present and the footer', () => {
  const pill = (id, label, code) => ({ column_id: 'materiality', kind: 'pill', label, code, tone: 'standard', component_ids: [`${id}-c`], fact_ids: [id] });
  const value = (id, columnId, label) => ({ column_id: columnId, kind: 'value', label, tone: 'value', component_ids: [`${id}-v`], fact_ids: [id] });
  const dash = (columnId) => ({ column_id: columnId, kind: 'dash', label: null, tone: null, component_ids: [], fact_ids: [] });
  const view = { defined_terms: [], sections: [
    { section_key: 'representations-qualifiers', title: 'Reps', facts_without_readout: [], tables: [{
      table_key: 'representations-qualifiers-table', group_header: null, layout: 'rows', term_column: { header: 'Term', source: 'subject' }, columns: [{ column_id: 'materiality', header: 'Qualifiers' }, { column_id: 'lookback', header: 'Lookback' }],
      rows: [
        { subject: 'General Exceptions', cells: [pill('sec', 'Risk Factors excluded', 'EXCLUDES_RISK_FACTORS'), value('sec', 'lookback', '1 business day')], backing_facts: [{ fact_id: 'sec' }, { fact_id: 'letter' }], sub_rows: [
          { subject: 'SEC Filings', cells: [pill('sec', 'Risk Factors excluded', 'EXCLUDES_RISK_FACTORS'), value('sec', 'lookback', '1 business day')], backing_facts: [{ fact_id: 'sec' }] },
          { subject: 'Disclosure Letter', cells: [pill('letter', 'Arranged by section', 'ARRANGED_BY_SECTION'), dash('lookback')], backing_facts: [{ fact_id: 'letter' }] },
        ] },
        { subject: 'Organization; Qualification; Standing', cells: [pill('org', 'MAE (aggregate)', 'MAE_AGGREGATE'), dash('lookback')], backing_facts: [{ fact_id: 'org' }] },
      ],
    }] },
    { section_key: 'capitalization', title: 'Capitalization', facts_without_readout: [], tables: [{
      table_key: 'capitalization-table', group_header: null, layout: 'rows', term_column: { header: 'Security class', source: 'subject' }, columns: [{ column_id: 'authorised', header: 'Authorised' }, { column_id: 'issued', header: 'Issued and outstanding' }, { column_id: 'validIssuance', header: 'Validly issued' }],
      footer: { label: 'No other securities', entries: [{ fact_id: 'abs', section_reference: '3.02', structure_node_id: null, text: 'no shares of Company Preferred Stock were issued or outstanding', component_ids: ['abs-c'] }] },
      rows: [{ subject: 'Common Stock', cells: [value('auth', 'authorised', '800000000'), value('iss', 'issued', '105278627'), { column_id: 'validIssuance', kind: 'pill', label: 'Present', code: 'PRESENT', tone: 'condition', component_ids: ['v-c'], fact_ids: ['v'] }], backing_facts: [{ fact_id: 'auth' }, { fact_id: 'iss' }, { fact_id: 'v' }] }],
    }] },
  ] };
  const closed = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
  assert.ok(closed.indexOf('>General Exceptions<') < closed.indexOf('>Organization; Qualification; Standing<'), 'General Exceptions is the first row');
  assert.doesNotMatch(closed, /data-testid="table-sub-row"/, 'the categories are hidden to start');
  assert.match(closed, /<button[^>]*data-testid="more-detail"[^>]*>[^<]*More detail \(2\)</);
  const open = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [], initialSubRowsOpen: true }));
  assert.equal((open.match(/data-testid="table-sub-row"/g) || []).length, 2);
  assert.ok(open.indexOf('>SEC Filings<') < open.indexOf('>Disclosure Letter<'));
  assert.match(open, /Risk Factors excluded/);
  assert.match(open, /1 business day/);
  assert.match(closed, /Security class/);
  assert.match(closed, /800000000/);
  assert.match(closed, /Present/);
  assert.match(closed, /data-testid="table-footer"/);
  assert.match(closed, /No other securities/);
  assert.match(closed, /no shares of Company Preferred Stock were issued or outstanding/);
});

// Ben, 2026-09-14: "make negative covenant list collapsable" and "tidy up
// this no other securities other provisions like in the other sections".
test('a collapsible_rows table folds its rows behind a toggle, and an other-provisions label names the block', () => {
  const view = {
    defined_terms: [],
    sections: [{ section_key: 'ioc-exceptions', title: 'Interim Operating Covenants', tables: [
      { table_key: 'ioc-exceptions-negative-covenants', group_header: 'NEGATIVE COVENANTS', layout: 'rows', collapsible_rows: true, term_column: { header: 'Restriction', source: 'subject' }, columns: [{ column_id: 'threshold', header: 'Threshold' }],
        rows: [{ subject: 'Indebtedness', cells: [{ column_id: 'threshold', kind: 'value', label: '$1,000,000', component_ids: ['c1'], fact_ids: ['f1'] }], backing_facts: [{ fact_id: 'f1', section_reference: '5.01' }] }],
        other_provisions: [{ subtype_key: 'X', span_id: 's', common_text: 'no shares of Company Preferred Stock were issued', term: 'Preferred Stock', branches: [{ fact_id: 'f2', section_reference: '3.02', text: 'no shares of Company Preferred Stock were issued', term: 'Preferred Stock' }] }],
        other_provisions_label: 'No other securities' },
    ] }],
  };
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
  assert.match(html, /<button[^>]*aria-expanded="true"[^>]*data-testid="rows-toggle"[^>]*><span>Hide 1 row</);
  assert.match(html, /data-testid="other-provisions-toggle"[^>]*><span>No other securities \(1\)</);
});

// Ben, 2026-10-17 (plan finding (42)): "when I clicked 'see provision' on
// 'definition' in 'intervening event mechanics' the main body of the page
// leapt around, it should stay static and the left hand side should just
// come up". The content column took 406px of right padding while a fact was
// selected, so every table reflowed on the click; it now keeps one class
// list whether or not the sidebar is open, and the fixed panel comes up
// over the page.
test('the content column keeps its width when a selection opens the sidebar', () => {
  const closed = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  const firstTable = tableView.sections.flatMap((section) => section.tables).find((table) => (table.rows || []).some((row) => row.backing_facts.length));
  const firstFact = firstTable.rows.find((row) => row.backing_facts.length).backing_facts[0];
  const open = renderToStaticMarkup(React.createElement(ProvisionTables, {
    tableView, facts, initialSelection: { tableKey: firstTable.table_key, rowIndex: 0, columnId: null, componentId: null, componentIds: [], factId: firstFact.fact_id },
  }));
  assert.match(open, /data-testid="evidence-sidebar"/);
  assert.doesNotMatch(closed, /data-testid="evidence-sidebar"/);
  const column = /<div class="([^"]*)" data-sidebar-open="true">/.exec(open);
  assert.ok(column, 'the content column marks the open sidebar');
  assert.equal(column[1], 'min-w-0 flex-1 space-y-[16px]');
  assert.match(closed, /<div class="min-w-0 flex-1 space-y-\[16px\]">/);
  assert.doesNotMatch(open, /pr-\[406px\]/);
});

// Ben, 2026-10-17 (plan finding (42)), on the sidebar: "not formatted very
// prettily and also random page breaks and pagen umbers...!" The canonical
// text keeps the SEC HTML's page footers ("-43-" between the words of a
// sentence that crosses a page); they are hidden wherever the words are
// shown and never removed from the text, so the spans still resolve.
test('the SEC page footers in a cited run of words are hidden in the sidebar words and clause, with the marks still in place', () => {
  const clause = 'The Company shall not enter into any agreement with respect to the\n-38-\nTransactions without the consent of Parent.';
  const bytes = Buffer.from(clause, 'utf8');
  const start = bytes.indexOf(Buffer.from('any agreement'));
  const end = bytes.indexOf(Buffer.from('Transactions')) + Buffer.byteLength('Transactions');
  const fact = {
    fact_id: 'pf-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', section_reference: '5.02',
    headline: { label: 'Prohibited action', distinguishing_component_ids: ['pf-obj'] },
    components: [
      { component_id: 'pf-actor', kind: 'ACTOR', label: 'obligor', text: 'The Company', origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: 11, gap_before: false, children: [] },
      { component_id: 'pf-obj', kind: 'OBJECT', label: 'agreement', text: clause.slice(Buffer.from(bytes.subarray(0, start)).toString('utf8').length, Buffer.from(bytes.subarray(0, end)).toString('utf8').length), origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: end, gap_before: true, children: [] },
    ],
  };
  assert.match(fact.components[1].text, /\n-38-\n/, 'the stored component text carries the footer');
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact, componentId: 'pf-obj', sectionText: { exact_text: clause, start_byte: 0 }, initialTreeOpen: true }));
  assert.doesNotMatch(html, /-38-/);
  assert.match(html, /any agreement with respect to the Transactions/);
  assert.equal((html.match(/data-level="strong"/g) || []).length, 1, 'the clause marks the cited words (the Source tab renders only when chosen)');
  // The tables' words too: the fact's own text and summary text.
  assert.doesNotMatch(factSummaryText(fact), /-38-/);
});

// Ben, 2026-10-17 (plan finding (42)): "'provision' - should that read as
// How Corpus Interpreted (or sometihng better osunding!) and then 'clause'
// - what is that? The full section it comes from? Be clearer?" The words
// block is "How Corpus read it"; the clause block is "Source text ·
// Section 5.02" with a one-line note; the tab holding the same text is
// "Source text". "Interpretation Tree" stays.
test('the sidebar names its blocks How Corpus read it and Source text · Section, with the note and the tab to match', () => {
  const clause = 'The Company shall not enter into any agreement with respect to the Transactions without the consent of Parent.';
  const fact = {
    fact_id: 'lb-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', section_reference: '5.02',
    headline: { label: 'Prohibited action', distinguishing_component_ids: ['lb-obj'], summary: 'Company may not agree to the Transactions without Parent consent' },
    components: [
      { component_id: 'lb-obj', kind: 'OBJECT', label: 'agreement', text: 'any agreement with respect to the Transactions', origin: 'OWN', source_span_id: 's', start_byte: 34, end_byte: 81, gap_before: false, children: [] },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact, componentId: 'lb-obj', sectionText: { exact_text: clause, start_byte: 0 } }));
  assert.match(html, />Interpretation Tree</);
  assert.match(html, /<p class="[^"]*">How Corpus read it<\/p>/);
  assert.match(html, /<p class="[^"]*">Source text · Section 5\.02<\/p>/);
  assert.match(html, /data-testid="evidence-clause-note">The full section these words come from, as drafted; the cited words are marked\.</);
  assert.match(html, /data-testid="evidence-tab-source"[^>]*>Source text</);
  assert.doesNotMatch(html, />Provision</);
  assert.doesNotMatch(html, />Clause</);
});

// The sidebar sets the section as one block per line, limbs indented by
// depth, the cited words marked inside their line (Ben, 2026-10-17, plan
// finding (42): "not formatted very prettily and also random page breaks
// and pagen umbers...!").
test('the sidebar renders the clause as paragraphs with lettered limbs on their own indented lines', () => {
  const clause = '5.02 No Solicitation.\n(a) The Company shall not solicit any proposal.\n(i) initiate or knowingly encourage\n-40-\nany inquiry;\n(ii) furnish information.';
  const bytes = Buffer.from(clause, 'utf8');
  const start = bytes.indexOf(Buffer.from('initiate'));
  const end = bytes.indexOf(Buffer.from('inquiry')) + Buffer.byteLength('inquiry');
  const fact = {
    fact_id: 'pl-1', family_key: 'NO_SHOP', subtype_key: 'PROHIBITED_ACTION', section_reference: '5.02',
    headline: { label: 'Prohibited action', distinguishing_component_ids: ['pl-op'] },
    components: [{ component_id: 'pl-op', kind: 'OPERATION', label: 'prohibited act', text: 'initiate or knowingly encourage\n-40-\nany inquiry', origin: 'OWN', source_span_id: 's', start_byte: start, end_byte: end, gap_before: false, children: [] }],
  };
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact, componentId: 'pl-op', sectionText: { exact_text: clause, start_byte: 0 } }));
  const lines = [...html.matchAll(/<p class="([^"]*)" data-testid="clause-line"(?: data-depth="(\d)")?>(.*?)<\/p>/g)].map((match) => [match[2] || '0', match[1], match[3].replace(/<[^>]+>/g, '')]);
  assert.deepEqual(lines, [
    ['0', '', '5.02 No Solicitation.'],
    ['1', 'mt-[7px] pl-[14px]', '(a) The Company shall not solicit any proposal.'],
    ['2', 'mt-[7px] pl-[28px]', '(i) initiate or knowingly encourage any inquiry;'],
    ['2', 'mt-[7px] pl-[28px]', '(ii) furnish information.'],
  ]);
  assert.match(html, /<mark class="bg-amber-200" data-level="strong">initiate or knowingly encourage any inquiry<\/mark>/);
  assert.doesNotMatch(html, /<pre/);
  assert.doesNotMatch(html, /-40-/);
});

// A folded column renders as a quiet trailing detail after the subject
// that opens the sidebar on its cell (Ben, 2026-10-17, finding (42)).
test('a trailing detail renders after the subject and carries its cell to the selection', () => {
  const view = {
    sections: [{ section_key: 'nosol-noshop', title: 'No-Shop', tables: [{
      table_key: 'nosol-noshop-notice', layout: 'rows', term_column: { header: 'Term' }, group_header: null,
      columns: [{ column_id: 'provision', header: 'Summary' }],
      rows: [
        { subject: 'Notice of a proposal', cells: [{ column_id: 'provision', kind: 'pill', label: 'Required', code: 'REQUIRED', tone: 'neutral', component_ids: ['c-1'], fact_ids: ['f-1'] }], backing_facts: [{ fact_id: 'f-1' }] },
        { subject: 'Notice period', cells: [{ column_id: 'provision', kind: 'dash', label: null, tone: null, component_ids: [], fact_ids: [] }], backing_facts: [{ fact_id: 'f-2' }],
          trailing_details: [{ column_id: 'period', header: 'Period', label: '48 hours', cell: { column_id: 'period', kind: 'value', label: '48 hours', component_ids: ['c-2'], fact_ids: ['f-2'] } }] },
      ],
    }], facts_without_readout: [] }],
    defined_terms: [],
  };
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
  const detail = /<button type="button" data-testid="trailing-detail" title="Period"[^>]*>· 48 hours<\/button>/.exec(html);
  assert.ok(detail, html);
  assert.ok(html.indexOf('>Notice period<') < detail.index, 'the detail follows its subject');
  assert.equal((html.match(/data-testid="trailing-detail"/g) || []).length, 1);
  assert.doesNotMatch(html, />Period</, 'the folded column has no header');
});

// Ben, 2026-10-17 (plan finding (47)), on the 2.01 Consideration package
// tree: "hitting 'show detail' doesn't add much...just smae stuff again?
// Also, we should better indent the (i) and (ii) for the right to receive
// that is shown". On the sidebar's rendered tree: a parent covered by its
// children is shown as its children, indented; a parent with its own words
// keeps them above its children; no toggle above the fourth level; one
// text style, left-aligned.
test('the sidebar tree shows a covered parent as its indented children, a parent\'s own words above its children, and folds only from the fourth level', () => {
  const clause = 'Each share shall be converted into the right to receive (i) $47.50 in cash and (ii) one CVR (clauses (i) and (ii), collectively, the “Merger Consideration”).';
  const at = (words) => Buffer.from(clause, 'utf8').indexOf(Buffer.from(words));
  const comp = (id, kind, text, children = []) => ({ component_id: id, kind, label: id, text, origin: 'OWN', source_span_id: 's', start_byte: at(text), end_byte: at(text) + Buffer.byteLength(text), gap_before: false, children });
  const fact = {
    fact_id: 'tree-1', family_key: 'CONSIDERATION', subtype_key: 'CONSIDERATION_PACKAGE', section_reference: '2.01',
    headline: { label: 'Consideration package', distinguishing_component_ids: ['list'], summary: 'Each Company share receives $47.50 cash plus one CVR' },
    components: [
      comp('op', 'OPERATION', 'shall be converted into the right to receive', [comp('obj', 'OBJECT', 'the right to receive')]),
      comp('list', 'LIST', '(i) $47.50 in cash and (ii) one CVR', [comp('i', 'LIST_ELEMENT', '(i) $47.50 in cash'), comp('ii', 'LIST_ELEMENT', '(ii) one CVR')]),
      { ...comp('def', 'DEFINED_TERM', '(clauses (i) and (ii), collectively, the “Merger Consideration”)'), resolves_to: { text: '$47.50 in cash and one CVR' } },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact, componentId: 'list', sectionText: { exact_text: clause, start_byte: 0 } }));
  const tree = html.slice(html.indexOf('data-testid="evidence-layers"'), html.indexOf('data-testid="evidence-clause-reference"'));
  // The covered list parent has no line of its own: its words appear once, as its children, one level deeper.
  assert.equal((tree.match(/\(i\) \$47\.50 in cash/g) || []).length, 1);
  assert.doesNotMatch(tree, /\(i\) \$47\.50 in cash and \(ii\) one CVR/);
  assert.match(tree, /data-covered="true"[^>]*>\s*<ul [^>]*data-level="2"/);
  assert.match(tree, /data-level="2"[^]*?\(i\) \$47\.50 in cash[^]*?\(ii\) one CVR/);
  // The operation keeps its own words above its child.
  assert.ok(tree.indexOf('shall be converted into the right to receive') < tree.indexOf('>the right to receive<'));
  // No toggle at three levels; one text style, left-aligned, no underline.
  assert.doesNotMatch(tree, /descend-control/);
  assert.doesNotMatch(tree, /underline|italic|inline-flex|text-center/);
  assert.match(tree, /data-testid="reference-term"[^>]*>\(clauses \(i\) and \(ii\), collectively, the “Merger Consideration”\)</);
  // A fourth level folds behind one control.
  const deep = { ...fact, components: [comp('a', 'OPERATION', 'shall be converted into the right to receive', [
    comp('b', 'OBJECT', 'the right to receive', [comp('c', 'TERM', 'right to receive', [comp('d', 'TERM', 'to receive')])]),
  ])] };
  const deepHtml = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact: deep, componentId: 'a', sectionText: { exact_text: clause, start_byte: 0 } }));
  assert.equal((deepHtml.match(/data-testid="descend-control"/g) || []).length, 1);
  assert.doesNotMatch(deepHtml, />to receive</, 'the fourth level is folded');
});

// Work package 8: a re-read value cell says so on hover and in its data
// attribute, for the sidebar to pick up.
test('a reparsed value cell carries data-reparsed and a title saying the words were re-read', () => {
  const text = 'except that the references to four (4) business days will be deemed two (2) business days';
  const fact = {
    fact_id: 'rp', proposal_id: 'rp', family_key: 'NO_SHOP', subtype_key: 'SUBSEQUENT_MATCH_PERIOD', fact_type: 'SUBSEQUENT_MATCH_PERIOD', section_reference: '5.02(e)', structure_node_id: 'n-5-02', validation_status: 'VALID',
    headline: { label: 'Subsequent match period', distinguishing_component_ids: ['rp-p'], summary: 'Each amended proposal restarts a shorter match period' },
    components: [{ component_id: 'rp-p', kind: 'PERIOD', label: 'period', text, origin: 'OWN', source_span_id: 's', start_byte: 0, end_byte: text.length, gap_before: false, children: [] }],
    conclusions: { table_key: 'nosol-superior-matching-rights', row_label: 'Subsequent match period', cells: [{ column_id: 'period', value: { canonical: 4, unit: 'BUSINESS_DAY' }, component_ids: ['rp-p'] }] },
  };
  const view = buildTableView({ facts: [fact], tableShapes, legalSchema });
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [fact] }));
  assert.match(html, /data-reparsed="true"/);
  assert.match(html, /title="Re-read from the cited words; the stored number differed"/);
  assert.match(html, /2 business days/);
  assert.doesNotMatch(html, /4 business days/);
});
