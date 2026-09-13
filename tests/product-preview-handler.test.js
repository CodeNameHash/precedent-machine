'use strict';

// The live lawyer preview read (lib/product/preview-handler.js): every
// completed section of a run in the workspace shape, with progress, whether
// or not the run has finalised; the saved review state applied when present.

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPreviewWorkspace, createProductPreviewHandler } = require('../lib/product/preview-handler');
const { previewFactsFromWorkspace } = require('../lib/product/provisions-preview');

const NODE = 'node-3-14';
const SECTION_TEXT = 'Section 3.14 Material Contracts. '.repeat(20);

function section() {
  return {
    node_id: NODE,
    section_reference: '3.14',
    routing: { structure_node_id: NODE, section_reference: '3.14', families: ['MATERIAL_CONTRACTS'] },
    source_closure: { source_closure_id: 'c-1', structure_node_id: NODE, section_reference: '3.14', full_section_span_id: 's-full' },
    spans: [{ span_id: 's-full', kind: 'FULL_SECTION', structure_node_id: NODE, start_byte: 0, end_byte: SECTION_TEXT.length, exact_text: SECTION_TEXT }],
    proposals: [{
      proposal_id: 'p-1', structure_node_id: NODE, family_key: 'MATERIAL_CONTRACTS', subtype_key: 'CATEGORY_WITH_THRESHOLD',
      statement: 'S', roles: {}, source_span_ids: [], proposition_group_id: null, validation_status: 'VALID',
      headline: { label: 'Material contract category', distinguishing_component_ids: ['c-a'] },
      components: [{ component_id: 'c-a', kind: 'TERM', label: 'category', text: 'Material Contracts', origin: 'OWN', source_span_id: 's-full', start_byte: 13, end_byte: 31, gap_before: false, children: [] }],
    }],
    groups: [], links: [], issues: [], coverage: [],
  };
}

const context = {
  run: { run_id: '00000000-0000-4000-8000-000000000001', status: 'RUNNING', stage: 'SECTION_ANALYSIS', schema_version: 'LEGAL_SCHEMA/V2' },
  sourceDocument: { parties: ['Parent Inc.', 'Target Corp.'], canonical_text: SECTION_TEXT },
  agreementStructure: { nodes: [
    { node_id: NODE, reference: '3.14', authored_order: 1, kind: 'SECTION', substantive: true },
    { node_id: 'node-3-15', reference: '3.15', authored_order: 2, kind: 'SECTION', substantive: true },
  ] },
};

test('buildPreviewWorkspace carries completed sections, progress and an empty review state for a running run', () => {
  const workspace = buildPreviewWorkspace({ ...context, sections: [section()] });
  assert.equal(workspace.progress.status, 'RUNNING');
  assert.equal(workspace.progress.completed, 1);
  assert.ok(workspace.progress.total >= 1);
  assert.equal(workspace.review.state.items.length, 0);
  const preview = previewFactsFromWorkspace(workspace);
  assert.equal(preview.facts.length, 1);
  assert.equal(preview.facts[0].section_reference, '3.14');
  assert.equal(preview.sectionTextByFactId.get('p-1').exact_text, SECTION_TEXT);
});

test('a saved review state is applied when the run has one', () => {
  const review = { version: 4, state: { status: 'DRAFT', items: [{ kind: 'PROPOSAL', source_id: 'p-1', decision: 'REJECTED', original: {} }], agreement_coverage: { decision: 'PENDING' } } };
  const workspace = buildPreviewWorkspace({ ...context, run: { ...context.run, status: 'READY', stage: 'READY' }, sections: [section()], review });
  assert.equal(workspace.review.version, 4);
  assert.equal(previewFactsFromWorkspace(workspace).facts.length, 0, 'the rejected fact is left out');
});

test('the handler reads access, context, completed sections and review through the store', async () => {
  const calls = [];
  const store = {
    assertAccess: async (args) => { calls.push(['assertAccess', args.actor]); return 'OWNER'; },
    getRunContext: async () => context,
    loadCompletedSectionResults: async () => [section()],
    getReview: async () => null,
  };
  const handler = createProductPreviewHandler({ getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'ben' });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { id: context.run.run_id }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.schema_version, 'PRODUCT_PREVIEW_WORKSPACE/V1');
  assert.equal(res.body.analysis.proposals.length, 1);
  assert.equal(res.body.progress.completed, 1);
  assert.deepEqual(calls, [['assertAccess', 'ben']]);
});

test('the handler hides runs the actor cannot access', async () => {
  const store = { assertAccess: async () => { const error = new Error('run access denied'); error.code = 'ACCESS_DENIED'; throw error; } };
  const handler = createProductPreviewHandler({ getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'someone' });
  const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { id: context.run.run_id }, headers: {} }, res);
  assert.equal(res.statusCode, 404);
});
