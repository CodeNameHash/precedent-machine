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

function workspace({ items = [], issues = [], nodes = [{ node_id: NODE, reference: '3.14', authored_order: 1 }], sectionReference = '3.14' } = {}) {
  const proposals = fixture.facts.map((fact, index) => proposalFrom(fact, index));
  proposals.push(proposalFrom(fixture.facts[0], 99, { validation_status: 'INVALID' }));
  return {
    analysis: {
      source_document: { parties: ['Parent Inc.', 'Target Corp.'], agreement_date: '2025-09-18', exhibit_type: 'EX-2.1', filing_accession: '0001193125-25-000001', retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/000119312525000001/ex21.htm' },
      agreement_structure: { nodes },
      sections: [{ structure_node_id: NODE, section_reference: sectionReference }],
      source_closures: [{ source_closure_id: 'c-3-14', structure_node_id: NODE, section_reference: sectionReference, full_section_span_id: 's-full' }],
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
  assert.match(html, /<div class="pw-provisions flex min-h-screen bg-white text-\[#03203D\]" style="--font-sans:&#x27;Inter Tight&#x27;[^"]*--font-serif:&#x27;Source Serif 4&#x27;[^"]*" data-testid="provisions-page"/);
  assert.match(html, /<header class="mb-\[16px\]" data-testid="preview-header"/);
  assert.match(html, /<p class="font-ui text-\[9\.5px\] uppercase tracking-\[0\.14em\] text-\[#6B7785\]">Lawyer preview<\/p>/);
  assert.match(html, /<h1 class="mt-\[8px\] font-sans text-\[30px\] font-bold leading-\[\.98\] tracking-\[-.05em\] text-\[#03203D\] md:text-\[38px\]">Parent Inc\. \/ Target Corp\.<\/h1>/);
  assert.match(html, /data-testid="preview-badge"[^>]*>Draft</);
  // Ben, 2026-09-14: the metadata line and the facts count are gone.
  assert.doesNotMatch(html, /Date: <span/);
  assert.doesNotMatch(html, /data-testid="preview-source-link"/);
  assert.doesNotMatch(html, /Generation: <span/);
  assert.doesNotMatch(html, /data-testid="preview-counts"/);
  assert.match(html, /<div class="mt-\[16px\] h-\[10px\] w-full bg-\[#B9C8DA\]" data-testid="preview-rule"/);
  assert.match(html, /<nav[^>]*class="[^"]*border-\[#DCE3E1\][^"]*bg-white[^"]*" style="width:264px;padding:22px" data-testid="provision-rail"/);
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

// Plan finding (140): the worker sandbox the run is on, beside the provider,
// while the run is in progress; nothing once it is READY or before a wake.
test('the header names the run\'s sandbox beside the provider while the run is in progress', () => {
  const running = workspace();
  running.progress = { ...running.progress, status: 'RUNNING', provider: 'ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION', sandbox: 'pm-codex-preview-worker-2' };
  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: running, runId: 'run-1' }));
  assert.match(html, /data-testid="preview-provider">Claude subscription</);
  assert.match(html, /data-testid="preview-sandbox">on pm-codex-preview-worker-2</);
  assert.ok(html.indexOf('preview-provider') < html.indexOf('preview-sandbox'));
  const ready = workspace();
  ready.progress = { ...ready.progress, status: 'READY', sandbox: 'pm-codex-preview-worker-2' };
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: ready, runId: 'run-1' })), /preview-sandbox/);
  const unplaced = workspace();
  unplaced.progress = { ...unplaced.progress, status: 'RUNNING', sandbox: null };
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: unplaced, runId: 'run-1' })), /preview-sandbox/);
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

// Work package 17 (manager, 2026-10-18): a held fact's reason in plain
// words from the run's issues (NCS 3.4: the proposal's own issue says "byte
// range missing" per component; the section's issue names the unknown span).
test('heldReason puts a held fact\'s problems into words, naming the component and the unknown span', () => {
  const { heldReason } = require('../lib/product/provisions-preview');
  const proposal = { proposal_id: 'p', components: [
    { component_id: 'a', kind: 'ACTOR', text: 'the Company represents and warrants to Parent and Merger Sub as follows:', children: [] },
    { component_id: 'b', kind: 'OPERATION', text: 'has all requisite corporate power and authority to execute and deliver this Agreement and to perform its obligations hereunder', children: [] },
  ] };
  const own = [{ code: 'INVALID_FACT_COMPONENTS', message: JSON.stringify(['0: byte range missing', '1: byte range missing']) }];
  const node = [{ code: 'INVALID_FACT_COMPONENTS', message: JSON.stringify({ client_ref: 'p1', problems: ['0: quote not found in source (UNKNOWN_SOURCE_COMPONENT)', '0: byte range missing', '1: byte range missing'] }) }];
  assert.equal(heldReason(proposal, own, node), '“the Company represents and warrants to Parent and Merger Sub as follows:”: its quote cites a span the section does not have; “has all requisite corporate power and authority to execute and deliver this…”: could not be placed in the source text');
  const amount = { proposal_id: 'q', components: [{ component_id: 'x', kind: 'AMOUNT', text: '“Cash Consideration” means cash in an amount equal to the product of (x) the Cash Exchange Ratio, multiplied by (y) the Parent Closing Price.', children: [] }] };
  assert.equal(heldReason(amount, [{ code: 'INVALID_FACT_COMPONENTS', message: JSON.stringify({ client_ref: 'part1:p4', problems: ['0: no parsable value in "“Cash Consideration” means cash"', '0: AMOUNT needs a canonical value'] }) }]), '““Cash Consideration” means cash in an amount equal to the product of (x) the…”: no number could be read from its words');
  assert.equal(heldReason(amount, []), 'held by validation');
  assert.equal(heldReason(amount, [{ code: 'INTRO_NOT_QUALIFICATION', message: 'p3' }]), 'intro not qualification: p3');
});

test('previewFactsFromWorkspace attaches held_reason to each held fact from the run\'s issues', () => {
  const heldId = `p-99-${fixture.facts[0].fact_id}`;
  const preview = previewFactsFromWorkspace(workspace({ issues: [
    { schema_version: 'PRODUCT_ISSUE/V1', issue_id: 'i-held', kind: 'VALIDATION', code: 'INVALID_FACT_COMPONENTS', message: JSON.stringify(['0: byte range missing']), proposal_id: heldId, structure_node_id: NODE, family_key: fixture.facts[0].family_key },
  ] }));
  assert.equal(preview.held_facts.length, 1);
  assert.match(preview.held_facts[0].held_reason, /could not be placed in the source text/);
});

// Work package 27 (plan finding (237), 2026-10-23): the 3.3 collision. A
// DUPLICATE_FACT_OCCURRENCE is written on the node (proposal_id null) and
// names both candidates in its message, so heldReason had no issue to read
// and both held facts said "held by validation". Each proposal the node
// issue named now carries it, and the reason is the rule's own words.
test('a node-level DUPLICATE_FACT_OCCURRENCE gives each proposal it held the rule\'s own reason', () => {
  const ws = workspace({
    nodes: [{ node_id: NODE, reference: '3.3', authored_order: 1 }],
    sectionReference: '3.3',
  });
  const first = ws.analysis.proposals.find((candidate) => candidate.validation_status === 'INVALID');
  const second = { ...first, proposal_id: `${first.proposal_id}-second`, fact_occurrence_id: 'occurrence-second' };
  ws.analysis.proposals.push(second);
  ws.analysis.issues.push({
    schema_version: 'PRODUCT_ISSUE/V1',
    issue_id: 'i-duplicate',
    kind: 'VALIDATION',
    code: 'DUPLICATE_FACT_OCCURRENCE',
    family_key: first.family_key,
    subtype_key: first.subtype_key,
    structure_node_id: NODE,
    proposal_id: null,
    source_closure_id: null,
    source_span_ids: [],
    message: JSON.stringify({
      candidates: [
        { client_ref: 'part1:p17', fact_occurrence_id: first.fact_occurrence_id || 'occurrence-first', proposal_id: first.proposal_id },
        { client_ref: 'part1:p18', fact_occurrence_id: 'occurrence-second', proposal_id: second.proposal_id },
      ],
      shared_fact_occurrence_id: 'shared-occurrence',
    }),
    state: 'OPEN',
  });
  const preview = previewFactsFromWorkspace(ws);
  assert.equal(preview.held_facts.length, 2);
  assert.deepEqual(
    preview.held_facts.map((fact) => fact.held_reason),
    ['duplicate fact occurrence', 'duplicate fact occurrence'],
    'the rule\'s own words, never the "held by validation" last resort',
  );
  assert.ok(preview.held_facts.every((fact) => fact.section_reference === '3.3'));
});

// Work package 27 (plan finding (237), 2026-10-23). Ben, on where a held
// fact goes when it has no home: "I think a section at the bottom of the
// page (if not section understood for the facts) or a at the bottom of the
// relevant section (e.g. termination) for those without a home". A held
// fact with no structure node reaches no section block; it lands in
// unplaced_held, not held_facts, and the page lists it at the bottom.
test('a held fact with a null structure node lands in unplaced_held, not held_facts, and the page lists it at the bottom', () => {
  const ws = workspace();
  const template = ws.analysis.proposals[0];
  const unplaced = {
    ...template,
    proposal_id: 'p-unplaced-held',
    structure_node_id: null,
    validation_status: 'INVALID',
    statement: 'The Company grants the right.',
    headline: { ...template.headline, summary: 'A right with no section' },
    components: [{ ...template.components[0], text: 'the right that could not be placed' }],
  };
  ws.analysis.proposals.push(unplaced);
  ws.analysis.issues.push({
    schema_version: 'PRODUCT_ISSUE/V1', issue_id: 'i-unplaced', kind: 'VALIDATION', code: 'INVALID_FACT_COMPONENTS',
    family_key: template.family_key, subtype_key: template.subtype_key, structure_node_id: null, proposal_id: 'p-unplaced-held',
    source_closure_id: null, source_span_ids: [], message: JSON.stringify(['0: byte range missing']), state: 'OPEN',
  });
  const preview = previewFactsFromWorkspace(ws);
  assert.equal(preview.held_facts.length, 1, 'the sectioned held fact is unchanged');
  assert.deepEqual(preview.held_facts.map((fact) => fact.section_reference), ['3.14']);
  assert.deepEqual(
    preview.unplaced_held.map((entry) => [entry.fact_id, entry.section_reference, entry.structure_node_id, entry.summary, entry.statement, entry.components_summary]),
    [['p-unplaced-held', null, null, 'A right with no section', 'The Company grants the right.', 'the right that could not be placed']],
  );
  assert.match(preview.unplaced_held[0].reason, /could not be placed in the source text/);
  assert.notEqual(preview.unplaced_held[0].reason, 'held by validation', 'a held fact with no section still carries its reason');
  assert.equal(preview.held_count, 2, 'the held count covers both lists');

  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: ws, runId: 'run-1' }));
  assert.match(html, /data-testid="unplaced-held"/);
  assert.match(html, /Facts the model proposed that could not be placed in a table/);
  assert.match(html, /data-testid="unplaced-held-fact"[^>]*>.*?A right with no section.*?could not be placed in the source text/s);
  assert.ok(html.indexOf('data-testid="published-summary"') < html.indexOf('data-testid="unplaced-held"'), 'the block is after PublishedSummary');
  const block = html.match(/<section[^>]*data-testid="unplaced-held"[^>]*>/);
  assert.ok(block, 'the block renders');
  assert.match(block[0], /text-\[9\.5px\]/);
  assert.match(block[0], /font-ui/);
  assert.match(block[0], /text-\[#6b6b6b\]/);
  assert.doesNotMatch(block[0], /amber|yellow|red/, 'quiet, not a warning banner');
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace(), runId: 'run-1' })), /unplaced-held/);
});

// Work package 27: a section that never loaded leaves its held facts with
// no block too; the page-bottom line still names the section the structure
// knows (the agreement_structure node's reference), not the fact id alone.
test('a held fact whose section never loaded is unplaced and names the section the structure knows', () => {
  const node = { node_id: 'node-9-9', reference: '9.9', authored_order: 2 };
  const ws = workspace({ nodes: [{ node_id: NODE, reference: '3.14', authored_order: 1 }, node] });
  const extra = proposalFrom(fixture.facts[0], 100, { structure_node_id: node.node_id, validation_status: 'INVALID' });
  ws.analysis.proposals.push(extra);
  ws.analysis.issues.push({
    schema_version: 'PRODUCT_ISSUE/V1', issue_id: 'i-never-loaded', kind: 'VALIDATION', code: 'INVALID_FACT_COMPONENTS',
    family_key: extra.family_key, subtype_key: extra.subtype_key, structure_node_id: node.node_id, proposal_id: extra.proposal_id,
    source_closure_id: null, source_span_ids: [], message: JSON.stringify(['0: byte range missing']), state: 'OPEN',
  });
  const preview = previewFactsFromWorkspace(ws);
  assert.deepEqual(preview.held_facts.map((fact) => fact.section_reference), ['3.14'], 'the loaded section\'s list is unchanged');
  assert.deepEqual(preview.unplaced_held.map((entry) => [entry.fact_id, entry.section_reference, entry.structure_node_id]), [
    [extra.proposal_id, '9.9', node.node_id],
  ]);
  assert.match(preview.unplaced_held[0].reason, /could not be placed in the source text/);
  assert.equal(preview.unplaced_held[0].statement, extra.statement);
  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: ws, runId: 'run-1' }));
  assert.match(html, /§ 9\.9 ·/);
});

// Work package 18 (e) as revised (2026-10-18): an out-of-scope exhibit (a
// separate agreement such as Metsera's Form CVR Agreement) is one quiet
// line under the title. Ben: "For CVRs - I want to build a separate product
// for that os I'd leave those".
test('an out-of-scope exhibit is one quiet line under the title, and absent when the draft recorded none', () => {
  const nodes = [
    { node_id: NODE, reference: '3.14', authored_order: 1 },
    { node_id: 'node-exhibit-b', reference: 'Exhibit-B', authored_order: 283 },
  ];
  const issues = [{
    schema_version: 'PRODUCT_ISSUE/V1', issue_id: 'i-oos', kind: 'NOTE', code: 'OUT_OF_SCOPE_EXHIBIT', family_key: null, subtype_key: null,
    structure_node_id: 'node-exhibit-b', proposal_id: null, source_closure_id: null, source_span_ids: [],
    message: JSON.stringify({ section_reference: 'Exhibit-B', title: 'Form of CVR Agreement', own_headings: 33, routed_families: ['CONSIDERATION'], reason: 'a separate agreement with its own articles and sections; not extracted' }), state: 'OPEN',
  }];
  const preview = previewFactsFromWorkspace(workspace({ issues, nodes }));
  assert.deepEqual(preview.out_of_scope, [{ issue_id: 'i-oos', structure_node_id: 'node-exhibit-b', section_reference: 'Exhibit-B', title: 'Form of CVR Agreement' }]);
  assert.equal(preview.facts.length, fixture.facts.length, 'the line takes nothing off the tables');
  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace({ issues, nodes }), runId: 'run-1' }));
  const line = html.match(/data-testid="preview-out-of-scope-line">([^<]*)<\/p>/);
  assert.ok(line, 'the out-of-scope line renders');
  assert.equal(line[1], 'Out of scope: Exhibit B, Form of CVR Agreement, a separate agreement; not extracted in this product.');
  assert.ok(html.indexOf('</h1>') < html.indexOf('data-testid="preview-out-of-scope"'));
  assert.ok(html.indexOf('data-testid="preview-out-of-scope"') < html.indexOf('data-testid="preview-rule"'));
  const quiet = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace(), runId: 'run-1' }));
  assert.doesNotMatch(quiet, /preview-out-of-scope/);
  assert.deepEqual(previewFactsFromWorkspace(workspace()).out_of_scope, []);
});

// Work package 26 (plan finding (232), 2026-10-22). Ben, on the three
// placements of the representation qualifiers put to him: "Option a on
// placement": the article's REPRESENTATION_QUALIFICATION facts are
// extracted once, on the introduction node ((207), one voice there), and
// the page shows them above each representation section's table, joined by
// code (lib/product/table-view.js articleQualifications, rendered by
// components/product/ProvisionTables.jsx) in the page's quiet style, only
// when the introduction has them. The words are NCS's (run 51577c57,
// III-INTRO and IV-INTRO).
const III_WORDS = 'Except as set forth in the disclosure letter delivered by the Company to Parent immediately prior to or simultaneously with the execution of this Agreement (the Company Disclosure Letter), the Company represents and warrants to Parent and Merger Sub as follows.';
const IV_WORDS = 'Every representation and warranty made by Parent and Merger Sub to the Company in Article IV is given except as set forth in the disclosure letter delivered by Parent to the Company immediately prior to or simultaneously with the execution of this Agreement (the \u201cParent Disclosure Letter\u201d).';
const COMPANY_ACTOR = 'the Company represents and warrants to Parent and Merger Sub as follows';
const PARENT_ACTOR = 'Parent and Merger Sub represent and warrant to the Company';

function introductionFact({ id, node, actor, exception, statement, subtype = 'REPRESENTATION_QUALIFICATION', status = 'VALID' }) {
  return {
    schema_version: 'PRODUCT_PROPOSAL/V1', proposal_id: id, structure_node_id: node, source_closure_id: `c-${node}`,
    family_key: 'REPRESENTATIONS', subtype_key: subtype, fact_type: 'REPRESENTATION_ACCURACY_STANDARD',
    statement, roles: {}, source_span_ids: [`s-${node}`], proposition_group_id: null, validation_status: status,
    headline: { label: 'Representation qualification', distinguishing_component_ids: [`${id}-x`], summary: statement },
    components: [
      { component_id: `${id}-x`, kind: 'EXCEPTION', label: 'Disclosure Letter exception', text: exception, source_span_id: `s-${node}`, start_byte: 0, end_byte: exception.length, origin: 'OWN', gap_before: false, children: [] },
      { component_id: `${id}-a`, kind: 'ACTOR', label: 'Representing party', text: actor, source_span_id: `s-${node}`, start_byte: exception.length + 2, end_byte: exception.length + 2 + actor.length, origin: 'OWN', gap_before: false, children: [] },
    ],
  };
}

function withIntroductions(ws, { company = true, parent = true, extra = [] } = {}) {
  const nodes = [
    ...(company ? [{ node_id: 'node-iii-intro', reference: 'III-INTRO', authored_order: 0 }] : []),
    ...(parent ? [{ node_id: 'node-iv-intro', reference: 'IV-INTRO', authored_order: 1 }] : []),
  ];
  for (const node of nodes) {
    ws.analysis.agreement_structure.nodes.unshift(node);
    ws.analysis.sections.unshift({ structure_node_id: node.node_id, section_reference: node.reference });
    ws.analysis.source_closures.push({ source_closure_id: `c-${node.node_id}`, structure_node_id: node.node_id, section_reference: node.reference, full_section_span_id: `s-${node.node_id}` });
    const text = node.reference === 'III-INTRO' ? III_WORDS : IV_WORDS;
    ws.analysis.spans.push({ span_id: `s-${node.node_id}`, kind: 'CHAPEAU', structure_node_id: node.node_id, start_byte: 0, end_byte: text.length, exact_text: text });
  }
  if (company) ws.analysis.proposals.push(introductionFact({ id: 'p-iii-letter', node: 'node-iii-intro', actor: COMPANY_ACTOR, exception: 'Except as set forth in the disclosure letter delivered by the Company to Parent immediately prior to or simultaneously with the execution of this Agreement (the Company Disclosure Letter)', statement: III_WORDS }));
  if (parent) ws.analysis.proposals.push(introductionFact({ id: 'p-iv-letter', node: 'node-iv-intro', actor: PARENT_ACTOR, exception: 'except as set forth in the disclosure letter delivered by Parent to the Company immediately prior to or simultaneously with the execution of this Agreement (the \u201cParent Disclosure Letter\u201d)', statement: IV_WORDS }));
  for (const fact of extra) ws.analysis.proposals.push(fact);
  return ws;
}

const unescapeHtml = (text) => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

test('the article\'s qualification facts sit above each representation section\'s table, in the quiet style, only when the introduction has them', () => {
  const tableShapes = require('../contracts/product/table-shapes.v3.json');
  const { articleQualifications } = require('../lib/product/table-view');
  const ws = withIntroductions(workspace(), { extra: [
    // A held qualification and an introduction fact of another subtype are
    // not shown (the held one is not a fact of the page; the other is held
    // at extraction, INTRO_NOT_QUALIFICATION, and would be a generation 6
    // leftover).
    introductionFact({ id: 'p-iii-held', node: 'node-iii-intro', actor: COMPANY_ACTOR, exception: 'Except as set forth in any Company SEC Document', statement: 'Held words', status: 'INVALID' }),
    introductionFact({ id: 'p-iii-status', node: 'node-iii-intro', actor: COMPANY_ACTOR, exception: 'Except as set forth in any Company SEC Document', statement: 'Status words', subtype: 'STATUS_REPRESENTATION' }),
  ] });
  const preview = previewFactsFromWorkspace(ws);
  const byTable = articleQualifications(preview.facts, tableShapes);
  assert.deepEqual([...byTable.entries()].map(([key, entries]) => [key, entries.map((entry) => [entry.fact_id, entry.section_reference, entry.article, entry.text])]), [
    ['representations-qualifiers-table', [['p-iii-letter', 'III-INTRO', 'III', III_WORDS]]],
    ['parent-representations-qualifiers-table', [['p-iv-letter', 'IV-INTRO', 'IV', IV_WORDS]]],
  ]);

  const html = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: ws, runId: 'run-1' }));
  const blocks = [...html.matchAll(/<div class="mb-\[7px\] space-y-\[2px\] text-\[9\.5px\] font-ui text-\[#6b6b6b\]" data-testid="article-qualifications" data-table-key="([^"]+)">(.*?)<\/div>/g)];
  assert.deepEqual(blocks.map((match) => match[1]), ['representations-qualifiers-table', 'parent-representations-qualifiers-table']);
  const lines = blocks.map((match) => [...match[2].matchAll(/<p data-testid="article-qualification">([^<]*)<button type="button" data-testid="article-qualification-words"[^>]*>([^<]*)<\/button><\/p>/g)].map((line) => [unescapeHtml(line[1]), unescapeHtml(line[2])]));
  assert.deepEqual(lines, [
    [['Article III introduction, qualifying every representation below: ', III_WORDS]],
    [['Article IV introduction, qualifying every representation below: ', IV_WORDS]],
  ]);
  // Above the table of its section, under the section heading; the General
  // Exceptions row the same facts fill is still there.
  for (const key of ['representations-qualifiers-table', 'parent-representations-qualifiers-table']) {
    const block = html.indexOf(`data-testid="article-qualifications" data-table-key="${key}"`);
    const table = html.indexOf(`data-testid="provision-table" data-table-key="${key}"`);
    assert.ok(block > 0 && table > block, `${key}: the lines come before the table`);
    assert.ok(html.lastIndexOf('data-testid="section-heading"', block) > html.lastIndexOf('data-testid="provision-table"', block), `${key}: the lines sit under their own section heading`);
  }
  assert.match(html, /General Exceptions/);
  assert.doesNotMatch(html, /Held words|Status words/);

  // Only the company's introduction: one block; no introduction: none.
  const companyOnly = renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: withIntroductions(workspace(), { parent: false }), runId: 'run-1' }));
  assert.deepEqual([...companyOnly.matchAll(/data-testid="article-qualifications" data-table-key="([^"]+)"/g)].map((match) => match[1]), ['representations-qualifiers-table']);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ProvisionsPreviewBody, { workspace: workspace(), runId: 'run-1' })), /article-qualification/);
  assert.equal(articleQualifications(previewFactsFromWorkspace(workspace()).facts, tableShapes).size, 0);
});
