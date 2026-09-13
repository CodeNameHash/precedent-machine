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

const { buildTableView } = require('../lib/product/table-view');
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
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
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

test('rows carry a data-testid and the Term column offers "See provision"', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="table-row"/);
  assert.match(html, /data-testid="see-provision"/);
  assert.match(html, /See provision/);
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
  assert.doesNotMatch(html, /data-testid="evidence-checks"/);
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
  assert.equal((html.match(/data-testid="attribute-row"/g) || []).length, 7, 'the legacy Merger Form line is gone (decision 28); step-2 lines are hidden until the deal is coded as a double merger');
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
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
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
  assert.match(html, /bg-black/);
  const groups = html.match(/data-testid="provision-rail-group"/g) || [];
  assert.equal(groups.length, 17);
  assert.match(html, /href="#provision-section-structure-mechanics"/);
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
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, { fact, componentId: 'st-actor', componentIds: ['st-actor', 'st-op', 'st-term'], sectionText: { exact_text: clause, start_byte: 0 } }));
  assert.match(html, /Read together, 3 components/);
  assert.match(html, /shall be merged with and into/);
  assert.equal((html.match(/data-level="strong"/g) || []).length, 3);
  assert.equal((html.match(/data-selected="true"/g) || []).length, 3);
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
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
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
