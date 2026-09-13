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
      contractType: { kind: 'pill', label: 'Real property lease', tone: 'buyer', component_ids: ['c-mc2-category'] },
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
  assert.match(html, /Real property lease/);
});

test('a cell with no matching data renders a dash', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="table-dash"/);
});

test('the fallback path (no conclusions on the fact) still renders a row and a pill', () => {
  // f-material-contracts-1 (the fixture fact) carries no `conclusions`; its
  // threshold component must still surface as a pill via the fallback
  // fill_from rendering.
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  const materialSection = html.split('Material Contracts')[1] || '';
  assert.match(materialSection, /data-testid="table-pill"/);
});

test('rows carry a data-testid and the Term column offers "See provision"', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /data-testid="table-row"/);
  assert.match(html, /data-testid="see-provision"/);
  assert.match(html, /See provision/);
});

test('group headers render in the table caption', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
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
  assert.match(html, /data-testid="evidence-sidebar"/);
  assert.match(html, /data-testid="evidence-words"/);
  assert.match(html, /data-testid="evidence-layers"/);
  assert.match(html, /data-testid="evidence-checks"/);
  assert.match(html, /data-testid="evidence-review-trail-section"/);
  assert.match(html, /data-testid="evidence-provenance"/);
  assert.match(html, /run-42/);
  assert.match(html, /PRODUCT_LAYERED_COMPONENTS\/V7/);
  assert.match(html, /Accepted/);
  assert.match(html, /Looks right\./);
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
  assert.equal((html.match(/data-testid="attribute-row"/g) || []).length, 8, 'step-2 lines are hidden until the deal is coded as a double merger');
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
