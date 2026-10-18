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

function workspace({ items = [], issues = [], nodes = [{ node_id: NODE, reference: '3.14', authored_order: 1 }] } = {}) {
  const proposals = fixture.facts.map((fact, index) => proposalFrom(fact, index));
  proposals.push(proposalFrom(fixture.facts[0], 99, { validation_status: 'INVALID' }));
  return {
    analysis: {
      source_document: { parties: ['Parent Inc.', 'Target Corp.'], agreement_date: '2025-09-18', exhibit_type: 'EX-2.1', filing_accession: '0001193125-25-000001', retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000119312525000001/ex21.htm' },
      agreement_structure: { nodes },
      sections: [{ structure_node_id: NODE, section_reference: '3.14' }],
      source_closures: [{ source_closure_id: 'c-3-14', structure_node_id: NODE, section_reference: '3.14', full_section_span_id: 's-full' }],
      spans: [{ span_id: 's-full', kind: 'FULL_SECTION', structure_node_id: NODE, start_byte: 0, end_byte: SECTION_TEXT.length, exact_text: SECTION_TEXT }],
      proposals,
      proposition_groups: [],
      fact_links: [],
      issues,
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
  // Work package 16: the held layered facts travel with their words, for
  // the election options table.
  assert.deepEqual(preview.held_facts.map((fact) => [fact.validation_status, fact.section_reference, fact.fact_id === fact.proposal_id, Array.isArray(fact.components) && fact.components.length > 0]), [['INVALID', '3.14', true, true]]);
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
  assert.doesNotMatch(html, /held by validation, not shown/, 'the counts line is gone (Ben, 2026-09-14)');
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
// the black column. Then, at the same browser zoom, "please fix relative
// sizes" ("zoom level is the same"): every px scaled by 0.58 (title 30,
// rail 197 wide). Then "sidebar width now good but font size not good":
// font sizes raised by 1.3, the title and rail width unchanged.
test('the page header is the Storylines header with the agreement date, SEC source and generation', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace(), runId: 'run-1' }));
  assert.match(html, /<div class="flex min-h-screen bg-white text-\[#1f1f1f\]" style="--font-sans:&#x27;Inter&#x27;[^"]*--font-serif:&#x27;Inter&#x27;[^"]*" data-testid="provisions-page"/);
  assert.match(html, /<header class="mb-\[16px\]" data-testid="preview-header"/);
  assert.match(html, /<p class="font-ui text-\[10px\] uppercase tracking-\[0\.12em\] text-\[#6b6b6b\]">Lawyer preview<\/p>/);
  assert.match(html, /<h1 class="mt-\[7px\] font-sans text-\[23px\] font-semibold leading-\[1\.05\] tracking-tight text-\[#1f1f1f\] md:text-\[30px\]">Parent Inc\. \/ Target Corp\.<\/h1>/);
  assert.match(html, /data-testid="preview-badge"[^>]*>Draft</);
  // Ben, 2026-09-14: the metadata line and the facts count are gone.
  assert.doesNotMatch(html, /Date: <span/);
  assert.doesNotMatch(html, /data-testid="preview-source-link"/);
  assert.doesNotMatch(html, /Generation: <span/);
  assert.doesNotMatch(html, /data-testid="preview-counts"/);
  assert.match(html, /<div class="mt-\[16px\] h-\[2px\] w-full bg-black" data-testid="preview-rule"/);
  assert.match(html, /<nav[^>]*class="[^"]*bg-black[^"]*" style="width:197px;padding:16px" data-testid="provision-rail"/);
  assert.doesNotMatch(html, /shadow/);
  assert.doesNotMatch(html, /font-display/);
});

// Plan finding (38), Metsera generation 7, 2026-09-14: a required fact type
// the schema gained mid-run is recorded at draft level as a
// SCHEMA_DRIFT_FACT_TYPE issue (structure_node_id null, the section and fact
// type in the message). The page shows one quiet line per entry under the
// title, in section order, and nothing when the draft recorded none. Ben:
// "look at all of the output yourself and analyze if you think it is right
// or wrong and if not, iterate to improve it".
function driftIssue({ id, section, node, factType, family = 'KEY_DEFINED_TERMS' }) {
  return {
    schema_version: 'PRODUCT_ISSUE/V1', issue_id: id, kind: 'COVERAGE', code: 'SCHEMA_DRIFT_FACT_TYPE',
    family_key: family, subtype_key: null, structure_node_id: null, proposal_id: null, source_closure_id: null, source_span_ids: [],
    message: JSON.stringify({ fact_type: factType, section_reference: section, structure_node_id: node }), state: 'OPEN',
  };
}

test('draft-level schema drift issues are one quiet line each under the title, in section order, and absent when there are none', () => {
  const nodes = [
    { node_id: 'node-2-01', reference: '2.01', authored_order: 0 },
    { node_id: 'node-2-03', reference: '2.03', authored_order: 1 },
    { node_id: NODE, reference: '3.14', authored_order: 2 },
  ];
  const issues = [
    driftIssue({ id: 'i-3', section: '3.14', node: NODE, factType: 'OTHER_DEFINED_TERM_RECORDED' }),
    driftIssue({ id: 'i-1b', section: '2.01', node: 'node-2-01', factType: 'ZZ_LATER_TYPE', family: 'CONSIDERATION' }),
    driftIssue({ id: 'i-1a', section: '2.01', node: 'node-2-01', factType: 'OTHER_DEFINED_TERM_RECORDED' }),
    // A section-level issue of another code and a draft-level issue of
    // another code are not drift lines.
    { schema_version: 'PRODUCT_ISSUE/V1', issue_id: 'i-x', kind: 'COVERAGE', code: 'REQUIRED_FACT_TYPE_UNRESOLVED', family_key: 'KEY_DEFINED_TERMS', structure_node_id: null, proposal_id: null, message: 'OTHER_DEFINED_TERM_RECORDED', state: 'OPEN' },
    { schema_version: 'PRODUCT_ISSUE/V1', issue_id: 'i-y', kind: 'VALIDATION', code: 'CONCLUSIONS_DROPPED', family_key: 'MATERIAL_CONTRACTS', structure_node_id: NODE, proposal_id: 'p-0', message: 'dropped', state: 'OPEN' },
  ];
  const preview = previewFactsFromWorkspace(workspace({ issues, nodes }));
  assert.deepEqual(preview.schema_drift, [
    { issue_id: 'i-1a', structure_node_id: 'node-2-01', section_reference: '2.01', family_key: 'KEY_DEFINED_TERMS', fact_type: 'OTHER_DEFINED_TERM_RECORDED' },
    { issue_id: 'i-1b', structure_node_id: 'node-2-01', section_reference: '2.01', family_key: 'CONSIDERATION', fact_type: 'ZZ_LATER_TYPE' },
    { issue_id: 'i-3', structure_node_id: NODE, section_reference: '3.14', family_key: 'KEY_DEFINED_TERMS', fact_type: 'OTHER_DEFINED_TERM_RECORDED' },
  ]);
  assert.equal(preview.facts.length, fixture.facts.length, 'the drift lines take nothing off the tables');

  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace({ issues, nodes }), runId: 'run-1' }));
  const block = html.match(/<div class="mt-\[7px\] space-y-\[2px\]" data-testid="preview-schema-drift">(.*?)<\/div>/);
  assert.ok(block, 'the drift block renders');
  const lines = [...block[1].matchAll(/<p class="text-\[9\.5px\] font-ui text-\[#6b6b6b\]" data-testid="preview-schema-drift-line">([^<]*)<\/p>/g)].map((match) => match[1]);
  assert.deepEqual(lines, [
    'Section 2.01: OTHER_DEFINED_TERM_RECORDED (KEY_DEFINED_TERMS) joined the schema after this section was extracted; not covered in this generation.',
    'Section 2.01: ZZ_LATER_TYPE (CONSIDERATION) joined the schema after this section was extracted; not covered in this generation.',
    'Section 3.14: OTHER_DEFINED_TERM_RECORDED (KEY_DEFINED_TERMS) joined the schema after this section was extracted; not covered in this generation.',
  ]);
  // Under the title, above the rule; the header otherwise unchanged.
  assert.ok(html.indexOf('</h1>') < html.indexOf('data-testid="preview-schema-drift"'));
  assert.ok(html.indexOf('data-testid="preview-schema-drift"') < html.indexOf('data-testid="preview-rule"'));
  assert.doesNotMatch(html, /data-testid="preview-counts"/);

  const quiet = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace(), runId: 'run-1' }));
  assert.doesNotMatch(quiet, /preview-schema-drift/);
  assert.deepEqual(previewFactsFromWorkspace(workspace()).schema_drift, []);
});

// Work package 3: the run page names the provider that paid, beside the
// state chip, only when the run names one.
test('the header names the run\'s provider beside the state chip', () => {
  const api = workspace();
  api.progress = { ...api.progress, provider: 'ANTHROPIC_API' };
  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: api, runId: 'run-1' }));
  assert.match(html, /data-testid="preview-provider">Anthropic API</);
  const subscription = workspace();
  subscription.progress = { ...subscription.progress, provider: 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION' };
  assert.match(renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: subscription, runId: 'run-1' })), /preview-provider">Claude subscription</);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace(), runId: 'run-1' })), /preview-provider/);
});
