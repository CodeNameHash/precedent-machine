'use strict';

// Work package 2: the Compare toggle and the market line on ProvisionTables,
// the "How this compares" block in EvidenceSidebar, and Everything mode.
// Static renders, the same pattern as tests/product-provision-tables.test.js.

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

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/published-layers-fixture.v2.json'), 'utf8'));

const conclusionFact = {
  fact_id: 'f-material-contracts-2',
  source_closure_id: 'c-mc-2',
  family_key: 'MATERIAL_CONTRACTS',
  subtype_key: 'MATERIAL_CONTRACT_CATEGORY_CRITERION',
  section_reference: '3.14(b)',
  coverage_only: false,
  headline: { label: 'Material Contracts category', distinguishing_component_ids: [], summary: 'Real estate leases above the threshold' },
  conclusions: {
    table_key: 'material-contracts-table',
    row_label: 'Real estate leases',
    cells: [
      { column_id: 'qualifier', code: 'MATERIAL', component_ids: ['c-mc2-category'] },
      { column_id: 'threshold', value: { canonical: 1000000, unit: 'USD' }, component_ids: ['c-mc2-threshold'] },
    ],
  },
  components: [
    {
      component_id: 'c-mc2-category', kind: 'TERM', label: 'contract category', text: 'any real property lease',
      source_span_id: 's-mc-2', start_byte: 100, end_byte: 124, origin: 'OWN', gap_before: false, children: [],
    },
    {
      component_id: 'c-mc2-threshold', kind: 'THRESHOLD', label: 'threshold', text: '$1,000,000',
      source_span_id: 's-mc-2', start_byte: 125, end_byte: 135, origin: 'OWN', gap_before: false, children: [],
    },
  ],
};

const facts = [...fixture.facts, conclusionFact];
const tableView = buildTableView({ facts, tableShapes, legalSchema });
const marketKey = 'material-contracts-table|Real estate leases|qualifier';

const market = {
  schema_version: 'PRODUCT_COMPARE_MARKET/V1',
  run: 'a',
  total_runs: 4,
  runs: { a: 'Apogee / Andor', b: 'Skechers / 3G', c: 'QXO / TopBuild', d: 'NCS / Advent' },
  cells: {
    [marketKey]: {
      total: 4,
      codes: {
        MATERIAL: { label: 'Material', count: 3, run_ids: ['a', 'b', 'c'] },
        OUTSIDE_ORDINARY_COURSE: { label: 'Not entered into in the ordinary course of business', count: 1, run_ids: ['d'] },
      },
    },
  },
};

const selection = {
  tableKey: 'material-contracts-table', rowIndex: 0, subIndex: null, columnId: 'qualifier',
  componentId: 'c-mc2-category', componentIds: ['c-mc2-category'], factId: 'f-material-contracts-2',
  linkSection: null, value: 'MATERIAL',
};

test('the Compare and Everything toggles are present and off by default', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView, facts }));
  assert.match(html, /aria-pressed="false"[^>]*data-testid="compare-toggle">Compare/);
  assert.match(html, /aria-pressed="false"[^>]*data-testid="everything-toggle">Everything/);
  assert.match(html, /data-compare="false"/);
});

test('Compare on renders a Market line under the coded answer and the sidebar block opens on it', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, {
    tableView, facts, runId: 'a', initialCompare: true, initialMarket: market, initialSelection: selection,
  }));
  assert.match(html, /data-testid="market-line"[^>]*data-market="market"[^>]*>Market · 3 of 4 deals</);
  assert.match(html, /data-testid="evidence-market"/);
  assert.match(html, /How this compares/);
  assert.match(html, /This deal/);
  assert.match(html, /Apogee \/ Andor/);
  assert.match(html, /Skechers \/ 3G/);
  // The old blocks and testids stay.
  assert.match(html, /data-testid="evidence-layers"/);
  assert.match(html, /data-testid="interpretation-tree-toggle"/);
  assert.match(html, /data-testid="evidence-words"/);
  assert.match(html, /data-testid="supporting-record-detail"/);
});

test('Compare off leaves the table without a market line or sidebar block', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, {
    tableView, facts, runId: 'a', initialMarket: market, initialSelection: selection,
  }));
  assert.doesNotMatch(html, /data-testid="market-line"/);
  assert.doesNotMatch(html, /data-testid="evidence-market"/);
});

test('an alone cell says No comparison and an off-market value names the modal answer', () => {
  const alone = {
    ...market,
    cells: { [marketKey]: { total: 1, codes: { MATERIAL: { label: 'Material', count: 1, run_ids: ['a'] } } } },
  };
  const aloneHtml = renderToStaticMarkup(React.createElement(ProvisionTables, {
    tableView, facts, runId: 'a', initialCompare: true, initialMarket: alone,
  }));
  assert.match(aloneHtml, /No comparison · only deal with this row/);
  const off = {
    ...market,
    cells: { [marketKey]: { total: 4, codes: {
      MATERIAL: { label: 'Material', count: 1, run_ids: ['a'] },
      OUTSIDE_ORDINARY_COURSE: { label: 'Not entered into in the ordinary course of business', count: 3, run_ids: ['b', 'c', 'd'] },
    } } },
  };
  const offHtml = renderToStaticMarkup(React.createElement(ProvisionTables, {
    tableView, facts, runId: 'a', initialCompare: true, initialMarket: off,
  }));
  assert.match(offHtml, /Off-market · 1 of 4 · others: Not entered into in the ordinary course of business/);
});

test('Everything opens sub rows, Other provisions and collapsible rows', () => {
  const view = {
    sections: [{
      section_key: 's', title: 'Reps', tables: [{
        table_key: 't', group_header: null, layout: 'rows', term_column: { header: 'Term' },
        collapsible_rows: true, rows_start_collapsed: true,
        columns: [{ column_id: 'materiality', header: 'Materiality' }],
        rows: [{
          subject: 'Organization', backing_facts: [{ fact_id: 'r-1', section_reference: '3.01' }],
          cells: [{ column_id: 'materiality', kind: 'pill', label: 'MAE (aggregate)', tone: 'standard', component_ids: ['c1'], fact_ids: ['r-1'] }],
          sub_rows: [{ subject: 'Company Subsidiaries', backing_facts: [{ fact_id: 'r-2', section_reference: '3.01' }], cells: [{ column_id: 'materiality', kind: 'pill', label: 'MAE (aggregate) (partial)', tone: 'standard', component_ids: ['c2'], fact_ids: ['r-2'] }] }],
        }],
        other_provisions: [{ term: 'Other protection', common_text: 'A quiet line.', branches: [{ fact_id: 'r-3', term: 'Other protection', text: 'A quiet line.' }] }],
      }],
    }],
    defined_terms: [],
  };
  const on = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [], initialEverything: true }));
  assert.match(on, /data-everything="true"/);
  assert.match(on, /data-testid="table-sub-row"/);
  assert.match(on, /data-testid="other-provisions-table"/);
  assert.doesNotMatch(on, /data-testid="other-provisions-table"[^>]*hidden/);
  assert.match(on, /aria-expanded="true"[^>]*data-testid="rows-toggle"/);
  const off = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: view, facts: [] }));
  assert.doesNotMatch(off, /data-testid="table-sub-row"/);
  assert.match(off, /data-testid="other-provisions-table"[^>]*hidden/);
});

test('EvidenceSidebar keeps the three old blocks and puts the market block above the tree', () => {
  const html = renderToStaticMarkup(React.createElement(EvidenceSidebar, {
    fact: conclusionFact,
    componentId: 'c-mc2-category',
    market: {
      label: 'Real estate leases', total: 4, run_id: 'a',
      entries: [{ code: 'MATERIAL', label: 'Material', count: 3, run_ids: ['a', 'b', 'c'], self: true }],
      runs: market.runs,
    },
  }));
  assert.match(html, /data-testid="evidence-market"/);
  assert.ok(html.indexOf('data-testid="evidence-market"') < html.indexOf('data-testid="evidence-layers"'));
  assert.match(html, /data-testid="evidence-layers"/);
  assert.match(html, /data-testid="evidence-words"/);
  assert.match(html, /3 of 4/);
  assert.match(html, /This deal/);
});
