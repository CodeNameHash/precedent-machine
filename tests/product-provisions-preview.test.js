'use strict';

// Lawyer preview of one run (pages/review/product/[id]/provisions.js,
// lib/product/provisions-preview.js): the draft's valid layered facts in the
// table layout, read-only. Rendered from a Review workspace payload built
// around the layered fixture, without a router or network.

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
const projectRoot = path.join(__dirname, '..');
const originalJsLoader = require.extensions['.js'];
require.extensions['.js'] = function compileProjectEsm(module, filename) {
  if (!filename.startsWith(projectRoot) || filename.includes(`${path.sep}node_modules${path.sep}`)) {
    return originalJsLoader(module, filename);
  }
  const source = fs.readFileSync(filename, 'utf8');
  if (!/(^|\n)\s*(import\s|export\s)/.test(source)) return originalJsLoader(module, filename);
  const transformed = transformSync(source, {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};

const { previewFactsFromWorkspace } = require('../lib/product/provisions-preview');
const { ProvisionsPreviewBody } = require('../pages/review/product/[id]/provisions.js');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/published-layers-fixture.v2.json'), 'utf8'));

const NODE = 'node-3-14';
const SECTION_TEXT = 'Section 3.14 Material Contracts. '.repeat(40);

function proposalFrom(fact, index, overrides = {}) {
  const { fact_id: factId, section_reference, coverage_only, ...rest } = fact;
  return {
    schema_version: 'PRODUCT_PROPOSAL/V1',
    proposal_id: `p-${index}-${factId}`,
    structure_node_id: NODE,
    statement: `Statement ${index}`,
    roles: {},
    source_span_ids: [],
    proposition_group_id: null,
    validation_status: 'VALID',
    ...rest,
    ...overrides,
  };
}

function workspace({ items = [] } = {}) {
  const proposals = fixture.facts.map((fact, index) => proposalFrom(fact, index));
  proposals.push(proposalFrom(fixture.facts[0], 99, { validation_status: 'INVALID' }));
  return {
    analysis: {
      source_document: { parties: ['Parent Inc.', 'Target Corp.'], agreement_date: '2025-09-18', exhibit_type: 'EX-2.1', filing_accession: '0001193125-25-000001', retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000119312525000001/ex21.htm' },
      agreement_structure: { nodes: [{ node_id: NODE, reference: '3.14', authored_order: 1 }] },
      sections: [{ structure_node_id: NODE, section_reference: '3.14' }],
      source_closures: [{ source_closure_id: 'c-3-14', structure_node_id: NODE, section_reference: '3.14', full_section_span_id: 's-full' }],
      spans: [{ span_id: 's-full', kind: 'FULL_SECTION', structure_node_id: NODE, start_byte: 0, end_byte: SECTION_TEXT.length, exact_text: SECTION_TEXT }],
      proposals,
      proposition_groups: [],
      fact_links: [],
      issues: [],
      coverage_assertions: [],
    },
    review: { version: 3, state: { status: 'DRAFT', items, agreement_coverage: { decision: 'PENDING' } } },
    progress: { status: 'READY', stage: 'READY', completed: 1, total: 1, generation: 6 },
  };
}

test('previewFactsFromWorkspace keeps valid layered facts, drops held and rejected ones, and maps section text', () => {
  const rejectedId = `p-1-${fixture.facts[1].fact_id}`;
  const preview = previewFactsFromWorkspace(workspace({
    items: [{ kind: 'PROPOSAL', source_id: rejectedId, decision: 'REJECTED', original: {} }],
  }));
  assert.equal(preview.facts.length, fixture.facts.length - 1);
  assert.equal(preview.held_count, 1);
  assert.equal(preview.section_count, 1);
  assert.ok(preview.facts.every((fact) => fact.fact_id === fact.proposal_id && fact.section_reference === '3.14'));
  assert.ok(preview.facts.every((fact) => preview.sectionTextByFactId.get(fact.fact_id)?.exact_text === SECTION_TEXT));
});

test('ProvisionsPreviewBody renders the rail, the tables and no decision controls', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace(), runId: 'run-1' }));
  assert.match(html, /Lawyer preview/);
  assert.match(html, /Parent Inc/);
  assert.match(html, /data-testid="provision-rail"/);
  // The fixture facts carry no readout: they are listed as evidence without one.
  assert.match(html, /data-testid="facts-without-readout"/);
  assert.match(html, /1 held by validation, not shown/);
  assert.doesNotMatch(html, />Accept</);
  assert.doesNotMatch(html, /Finalise inactive candidate/);
});

// Ben, 2026-09-14: "completely copy the visual style - including the page
// header", then, comparing the result with his Deal Storylines app: "also
// font etc doesn't match the deal storylines page. Also their pages are
// 'cleaner' in style". The header is that app's page header: an uppercase
// letter-spaced grey eyebrow with the state chip, "Acquirer / Target" at
// 52px semibold, one grey metadata line with what the run knows, a 3px
// black rule; no card, no shadow. The page root sets Inter through the
// --font-sans / --font-serif variables and the white ground; the rail is
// the 340px black column.
test('the page header is the Storylines header with the agreement date, SEC source and generation', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace(), runId: 'run-1' }));
  assert.match(html, /<div class="flex min-h-screen bg-white text-\[#1f1f1f\]" style="--font-sans:&#x27;Inter&#x27;[^"]*--font-serif:&#x27;Inter&#x27;[^"]*" data-testid="provisions-page"/);
  assert.match(html, /<header class="mb-7" data-testid="preview-header"/);
  assert.match(html, /<p class="font-ui text-\[13px\] uppercase tracking-\[0\.12em\] text-\[#6b6b6b\]">Lawyer preview<\/p>/);
  assert.match(html, /<h1 class="mt-3 font-sans text-\[40px\] font-semibold leading-\[1\.05\] tracking-tight text-\[#1f1f1f\] md:text-\[52px\]">Parent Inc\. \/ Target Corp\.<\/h1>/);
  assert.match(html, /data-testid="preview-badge"[^>]*>Draft</);
  assert.match(html, /Date: <span class="text-inkMid">September 18, 2025</);
  assert.match(html, /data-testid="preview-source-link"[^>]*>EX-2\.1 · 0001193125-25-000001</);
  assert.match(html, /Generation: <span class="text-inkMid">6</);
  assert.match(html, /<div class="mt-7 h-\[3px\] w-full bg-black" data-testid="preview-rule"/);
  assert.match(html, /<nav[^>]*class="[^"]*bg-black[^"]*" style="width:340px;padding:28px" data-testid="provision-rail"/);
  assert.doesNotMatch(html, /shadow/);
  assert.doesNotMatch(html, /font-display/);
});
