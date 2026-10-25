'use strict';

// The live lawyer preview read (lib/product/preview-handler.js): every
// completed section of a run in the workspace shape, with progress, whether
// or not the run has finalised; the saved review state applied when present.

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPreviewWorkspace, createProductPreviewHandler } = require('../lib/product/preview-handler');
const { previewFactsFromWorkspace } = require('../lib/product/provisions-preview');
const { ProductPhase2Store } = require('../lib/product/phase-2-store');

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
  assert.equal(workspace.progress.provider, null, 'a run without a model_config names no provider');
  assert.equal(buildPreviewWorkspace({ ...context, run: { ...context.run, model_config: { provider_id: 'ANTHROPIC_API' } }, sections: [section()] }).progress.provider, 'ANTHROPIC_API');
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

// Plan finding (38), 2026-09-14: finalisation stores SCHEMA_DRIFT_FACT_TYPE
// at draft level (no structure node). The section read never returns such a
// row, so the handler reads the draft-level issues separately and the
// workspace carries them beside the sections' own.
const driftIssue = {
  schema_version: 'PRODUCT_ISSUE/V1', issue_id: 'i-drift', kind: 'COVERAGE', code: 'SCHEMA_DRIFT_FACT_TYPE',
  family_key: 'KEY_DEFINED_TERMS', structure_node_id: null, proposal_id: null,
  message: JSON.stringify({ fact_type: 'OTHER_DEFINED_TERM_RECORDED', section_reference: '3.14', structure_node_id: NODE }), state: 'OPEN',
};

test('buildPreviewWorkspace carries the draft-level issues the page reads, and none when the store has none', () => {
  // A conclusions note on a valid fact is never read on the preview; the
  // drift line is read by code and must survive.
  const sectionIssue = { issue_id: 'i-section', kind: 'VALIDATION', code: 'CONCLUSIONS_DROPPED', structure_node_id: NODE, message: 'x', state: 'OPEN' };
  const withDrift = buildPreviewWorkspace({ ...context, sections: [{ ...section(), issues: [sectionIssue] }], draftIssues: [driftIssue] });
  assert.deepEqual(withDrift.analysis.issues.map((issue) => issue.issue_id), ['i-drift']);
  assert.deepEqual(previewFactsFromWorkspace(withDrift).schema_drift.map((entry) => [entry.section_reference, entry.fact_type]), [['3.14', 'OTHER_DEFINED_TERM_RECORDED']]);
  const without = buildPreviewWorkspace({ ...context, sections: [section()] });
  assert.deepEqual(without.analysis.issues, []);
  assert.deepEqual(previewFactsFromWorkspace(without).schema_drift, []);
});

test('the handler reads access, context, completed sections, draft-level issues and review through the store', async () => {
  const calls = [];
  const store = {
    assertAccess: async (args) => { calls.push(['assertAccess', args.actor]); return 'OWNER'; },
    getRunContext: async () => context,
    loadCompletedSectionResults: async () => [section()],
    loadDraftIssues: async (runId) => { calls.push(['loadDraftIssues', runId]); return [driftIssue]; },
    getReview: async () => null,
  };
  const handler = createProductPreviewHandler({ getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'ben' });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { id: context.run.run_id }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.schema_version, 'PRODUCT_PREVIEW_WORKSPACE/V2');
  assert.equal(res.body.analysis.proposals.length, 1);
  assert.equal(res.body.progress.completed, 1);
  assert.deepEqual(res.body.analysis.issues.map((issue) => issue.issue_id), ['i-drift']);
  assert.deepEqual(calls, [['assertAccess', 'ben'], ['loadDraftIssues', context.run.run_id]]);
});

test('a store without a draft-issue read still serves the preview', async () => {
  const store = {
    assertAccess: async () => 'OWNER',
    getRunContext: async () => context,
    loadCompletedSectionResults: async () => [section()],
  };
  const handler = createProductPreviewHandler({ getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'ben' });
  const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { id: context.run.run_id }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.analysis.issues, []);
});

test('the handler hides runs the actor cannot access', async () => {
  const store = { assertAccess: async () => { const error = new Error('run access denied'); error.code = 'ACCESS_DENIED'; throw error; } };
  const handler = createProductPreviewHandler({ getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'someone' });
  const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { id: context.run.run_id }, headers: {} }, res);
  assert.equal(res.statusCode, 404);
});

// The read path projection (lib/product/preview-handler.js): the preview
// endpoint sends the fields the page renders, not the run's whole stored
// analysis. A run's source closures embed every span (22.7 MB of the
// 39.8 MB Apogee payload) and its source document carries the raw bytes and
// source map (2.8 MB); the page reads none of that. These fixtures put a
// large decoy in every field the preview does not read.
const BIG = 'x'.repeat(400000);

function heavyDocument() {
  return {
    parties: ['Parent Inc.', 'Target Corp.'],
    canonical_text: BIG,
    raw_bytes_base64: BIG,
    source_map_payload_base64: BIG,
    request_headers: { authorization: BIG },
    response_headers: { 'content-type': BIG },
    revision: { note: BIG },
  };
}

function heavyStructure() {
  return {
    nodes: [
      { node_id: NODE, reference: '3.14', authored_order: 1, kind: 'SECTION', substantive: true, parent_id: 'a', span: { exact_text: BIG } },
      { node_id: 'node-3-15', reference: '3.15', authored_order: 2, kind: 'SECTION', substantive: true, parent_id: 'a', span: { exact_text: BIG } },
    ],
    annotations: [{ text: BIG }],
    structural_diagnostics: { note: BIG },
  };
}

function heavySection() {
  const base = section();
  return {
    ...base,
    routing: { ...base.routing, rationale: BIG, disposition: BIG, families: ['MATERIAL_CONTRACTS'] },
    source_closure: {
      ...base.source_closure,
      spans: [{ span_id: 's-full', exact_text: BIG }],
      sec_mapping: { canonical_text_sha256: 'a'.repeat(64), final_url: BIG },
      context_diagnostics: { cross_scope_section_references: [{ reference: BIG }] },
      operative_span_ids: ['s-full'],
    },
    spans: [
      base.spans[0],
      { span_id: 's-supporting', kind: 'SUPPORTING_EVIDENCE', structure_node_id: NODE, start_byte: 0, end_byte: 1, exact_text: BIG, text_sha256: 'b'.repeat(64) },
    ],
    proposals: [{
      ...base.proposals[0],
      facts_span_text: BIG,
      canonical_value: 3,
      coverage_only: false,
      fact_occurrence_id: 'occ-1',
      fact_type: 'MATERIAL_CONTRACT_CATEGORY_CRITERION',
      model_call_id: 'm'.repeat(64),
      proposition_group_id: 'g-1',
      roles: { COMPANY: ['Parent Inc.'] },
      schema_version: 'PRODUCT_PROPOSAL/V1',
      source_closure_id: 'c-1',
      source_span_ids: ['s-full', 's-supporting'],
      state: 'PROPOSED',
      conclusions: { table_key: 'material-contracts-table', row_label: 'Real estate leases', cells: {} },
    }, {
      ...base.proposals[0], proposal_id: 'p-held', fact_id: 'p-held', statement: 'Held fact',
      validation_status: 'INVALID', fact_occurrence_id: 'occ-held',
    }],
    groups: [{ proposition_group_id: 'g-1', statement: BIG }],
    links: [{ fact_link_id: 'l-1', from_proposal_id: 'p-1', to_proposal_id: 'p-2', statement: BIG }],
    // i-valid is on a valid fact and is never read; i-held and i-node are
    // the held fact's own issue and its node's unknown-span note.
    issues: [{
      issue_id: 'i-valid', kind: 'VALIDATION', code: 'CONCLUSIONS_DROPPED', proposal_id: 'p-1',
      structure_node_id: NODE, family_key: 'MATERIAL_CONTRACTS', message: 'x',
      schema_version: 'PRODUCT_ISSUE/V1', source_closure_id: 'c-1', source_span_ids: ['s-full', 's-supporting'], state: 'OPEN', subtype_key: 'CATEGORY_WITH_THRESHOLD',
    }, {
      issue_id: 'i-held', kind: 'VALIDATION', code: 'INVALID_FACT_COMPONENTS', proposal_id: 'p-held',
      structure_node_id: NODE, family_key: 'MATERIAL_CONTRACTS', message: '0: byte range missing',
      schema_version: 'PRODUCT_ISSUE/V1', source_closure_id: 'c-1', source_span_ids: ['s-full', 's-supporting'], state: 'OPEN', subtype_key: 'CATEGORY_WITH_THRESHOLD',
    }, {
      issue_id: 'i-node', kind: 'VALIDATION', code: 'INVALID_FACT_COMPONENTS', proposal_id: null,
      structure_node_id: NODE, family_key: 'MATERIAL_CONTRACTS', message: '0: quote not found in source (UNKNOWN_SOURCE_COMPONENT)',
      schema_version: 'PRODUCT_ISSUE/V1', source_closure_id: 'c-1', source_span_ids: ['s-full', 's-supporting'], state: 'OPEN', subtype_key: 'CATEGORY_WITH_THRESHOLD',
    }],
    coverage: [{ coverage_assertion_id: 'cov-1', structure_node_id: NODE, text: BIG }],
  };
}

test('the preview workspace is projected to the fields the page reads', () => {
  const workspace = buildPreviewWorkspace({
    ...context, sourceDocument: heavyDocument(), agreementStructure: heavyStructure(), sections: [heavySection()],
  });
  assert.deepEqual(Object.keys(workspace.analysis).sort(), [
    'agreement_structure', 'analysis_run_id', 'issues', 'legal_schema_version',
    'proposals', 'schema_version', 'sections', 'source_closures', 'source_document', 'spans',
  ]);
  // The title's parties only: the raw bytes, source map, canonical text and
  // headers are not rendered.
  assert.deepEqual(Object.keys(workspace.analysis.source_document), ['parties']);
  // A closure keeps the node, reference, id and full-section span id; its
  // embedded span list, diagnostics and SEC mapping do not ride along.
  assert.deepEqual(Object.keys(workspace.analysis.source_closures[0]).sort(), [
    'full_section_span_id', 'section_reference', 'source_closure_id', 'structure_node_id',
  ]);
  // Only the full-section span the page cites (for the evidence sidebar)
  // is sent; the supporting span is not.
  assert.deepEqual(workspace.analysis.spans.map((span) => span.span_id), ['s-full']);
  assert.deepEqual(Object.keys(workspace.analysis.spans[0]).sort(), [
    'exact_text', 'kind', 'span_id', 'start_byte', 'structure_node_id',
  ]);
  // The fact fields table-view.js reads, with no run-level bookkeeping.
  assert.deepEqual(Object.keys(workspace.analysis.proposals[0]).sort(), [
    'components', 'conclusions', 'coverage_only', 'fact_occurrence_id', 'family_key',
    'headline', 'proposal_id', 'statement', 'structure_node_id', 'subtype_key', 'validation_status',
  ]);
  for (const absent of ['roles', 'source_span_ids', 'model_call_id', 'proposition_group_id', 'schema_version', 'state', 'source_closure_id', 'fact_type', 'canonical_value', 'facts_span_text']) {
    assert.ok(!Object.hasOwn(workspace.analysis.proposals[0], absent), `${absent} is not sent`);
  }
  // The component's empty defaults (an empty child list, gap_before false)
  // are read as absent on the page.
  assert.deepEqual(Object.keys(workspace.analysis.proposals[0].components[0]).sort(), [
    'component_id', 'end_byte', 'kind', 'label', 'origin', 'source_span_id', 'start_byte', 'text',
  ]);
  assert.deepEqual(workspace.analysis.issues.map((issue) => issue.issue_id).sort(), ['i-held', 'i-node']);
  assert.deepEqual(Object.keys(workspace.analysis.issues[0]).sort(), [
    'code', 'family_key', 'issue_id', 'kind', 'message', 'proposal_id', 'structure_node_id',
  ]);
  assert.deepEqual(Object.keys(workspace.analysis.agreement_structure.nodes[0]).sort(), [
    'authored_order', 'kind', 'node_id', 'reference',
  ]);
  // A routing carries the reasons a section that produced no facts is listed
  // for (work package 33): the families it was asked for and, when the row
  // holds one of the three known dispositions, the disposition it was read
  // as. The router's rationale and any other value never ride along.
  assert.deepEqual(Object.keys(workspace.analysis.sections[0]).sort(), ['families', 'section_reference', 'structure_node_id']);
  assert.deepEqual(workspace.analysis.sections[0].families, ['MATERIAL_CONTRACTS']);
  // The page still builds its facts and section text from the projection.
  const preview = previewFactsFromWorkspace(workspace);
  assert.equal(preview.facts.length, 1);
  assert.equal(preview.facts[0].section_reference, '3.14');
  assert.equal(preview.sectionTextByFactId.get('p-1').exact_text, SECTION_TEXT);
  assert.equal(preview.held_facts.length, 1, 'the held fact keeps its reason from the held issues');
  assert.match(preview.held_facts[0].held_reason, /cites a span the section does not have/);
  assert.ok(!JSON.stringify(workspace).includes('x'.repeat(1000)), 'a heavy unread field never reaches the payload');
});

// A size guard: the page polls this read once a minute while a run is live,
// so a field added to the read must not bring the run's stored analysis
// back with it. The decoy above is 4.8 MB; the projected payload is a few
// kilobytes. Raise this only with a deliberate change to the projection.
test('the preview payload stays small when the store returns the whole analysis', () => {
  const workspace = buildPreviewWorkspace({
    ...context, sourceDocument: heavyDocument(), agreementStructure: heavyStructure(), sections: [heavySection()],
  });
  const bytes = JSON.stringify(workspace).length;
  assert.ok(bytes < 32 * 1024, `preview payload is ${bytes} bytes (guard: 32768)`);
});

// The store read the handler uses for the preview (phase-2-store
// loadPreviewSectionResults): the same completed sections without the model
// calls, proposition groups, fact links, coverage assertions, residual
// passes or closure-to-span membership rows, and with only the full-section
// span behind a fact. The full read stays the one the analysis and review
// paths use.
const PREVIEW_RUN = '00000000-0000-4000-8000-0000000000bb';

function previewRows() {
  const runId = PREVIEW_RUN;
  return {
    product_section_results: [{ run_id: runId, structure_node_id: NODE, source_closure_id: 'c-1', section_result_id: 'r-1' }],
    product_source_closures: [{
      run_id: runId, source_closure_id: 'c-1',
      payload: {
        schema_version: 'SOURCE_CLOSURE/V1', source_closure_id: 'c-1', structure_node_id: NODE,
        section_reference: '3.14', full_section_span_id: 's-full',
        spans: [{ span_id: 's-full', exact_text: 'CLOSURE-DECOY' }],
        context_diagnostics: { note: 'DECOY' },
      },
    }],
    product_source_spans: [
      { run_id: runId, span_id: 's-full', source_document_id: 'doc', coordinate_system: 'UTF8', start_byte: 0, end_byte: SECTION_TEXT.length, text_sha256: 'h', kind: 'FULL_SECTION', structure_node_id: NODE, exact_text: SECTION_TEXT },
      { run_id: runId, span_id: 's-supporting', source_document_id: 'doc', coordinate_system: 'UTF8', start_byte: 0, end_byte: 1, text_sha256: 'h', kind: 'SUPPORTING_EVIDENCE', structure_node_id: NODE, exact_text: 'SUPPORTING-DECOY' },
    ],
    product_section_routings: [{ run_id: runId, structure_node_id: NODE, payload: { structure_node_id: NODE, section_reference: '3.14', rationale: 'DECOY' } }],
    product_proposals: [{
      run_id: runId, structure_node_id: NODE, proposal_id: 'p-1',
      payload: {
        proposal_id: 'p-1', structure_node_id: NODE, family_key: 'MATERIAL_CONTRACTS', subtype_key: 'CATEGORY_WITH_THRESHOLD',
        statement: 'S', validation_status: 'VALID', headline: { label: 'Material contract category' },
        components: [{ component_id: 'c-a', kind: 'TERM', label: 'category', text: 'Material Contracts', origin: 'OWN', source_span_id: 's-full', start_byte: 13, end_byte: 31, gap_before: false, children: [] }],
      },
    }],
    product_issues: [{ run_id: runId, structure_node_id: NODE, issue_id: 'i-1', payload: { issue_id: 'i-1', kind: 'VALIDATION', code: 'CONCLUSIONS_DROPPED', structure_node_id: NODE, message: 'm' } }],
    product_fact_components: [],
    product_fact_headlines: [],
    product_fact_conclusions: [],
  };
}

function fakePreviewClient(tables, asked = new Set(), filters = []) {
  return {
    asked,
    filters,
    rpc: async () => ({ data: null, error: null }),
    from(table) {
      asked.add(table);
      const query = {
        select() { return query; },
        eq(column, value) { filters.push([table, column, value]); return query; },
        order() { return query; },
        range(from, to) { return Promise.resolve({ data: (tables[table] || []).slice(from, to + 1), error: null }); },
      };
      return query;
    },
  };
}

test('the preview store read loads only the tables the page renders', async () => {
  const client = fakePreviewClient(previewRows());
  const sections = await new ProductPhase2Store({ client }).loadPreviewSectionResults(PREVIEW_RUN);
  assert.ok(client.filters.some(([table, column, value]) => table === 'product_source_spans' && column === 'kind' && value === 'FULL_SECTION'), 'the span read asks for the full-section spans');
  assert.equal(sections.length, 1);
  const [sectionValue] = sections;
  assert.equal(sectionValue.routing.section_reference, '3.14');
  assert.equal(sectionValue.source_closure.source_closure_id, 'c-1');
  assert.deepEqual(sectionValue.spans.map((span) => span.span_id), ['s-full'], 'only the full-section span is read');
  assert.equal(sectionValue.spans[0].exact_text, SECTION_TEXT);
  assert.deepEqual(sectionValue.proposals.map((proposal) => proposal.proposal_id), ['p-1']);
  assert.deepEqual(sectionValue.proposals[0].components.map((component) => component.component_id), ['c-a']);
  assert.deepEqual(sectionValue.issues.map((issue) => issue.issue_id), ['i-1']);
  assert.deepEqual(sectionValue.groups, []);
  assert.deepEqual(sectionValue.links, []);
  assert.deepEqual(sectionValue.coverage, []);
  for (const table of ['product_model_calls', 'product_proposition_groups', 'product_fact_links', 'product_coverage_assertions', 'product_residual_passes', 'product_source_closure_spans']) {
    assert.ok(!client.asked.has(table), `${table} is not read for the preview`);
  }
  // The projection of this read is the same workspace the full read
  // produces, and the page builds the same fact from it.
  const workspace = buildPreviewWorkspace({ ...context, sections });
  const preview = previewFactsFromWorkspace(workspace);
  assert.equal(preview.facts.length, 1);
  assert.equal(preview.facts[0].fact_id, 'p-1');
  assert.equal(preview.sectionTextByFactId.get('p-1').exact_text, SECTION_TEXT);
  assert.ok(!JSON.stringify(workspace).includes('DECOY'), 'no decoy from a skipped table or an unread field reaches the payload');
});

test('the handler reads the preview store projection when the store has one', async () => {
  const calls = [];
  const store = {
    assertAccess: async () => 'OWNER',
    getRunContext: async () => context,
    loadPreviewSectionResults: async (runId) => { calls.push(['preview', runId]); return [section()]; },
    loadCompletedSectionResults: async () => { calls.push(['full']); return []; },
    loadDraftIssues: async () => [],
    getReview: async () => null,
  };
  const handler = createProductPreviewHandler({ getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'ben' });
  const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'GET', query: { id: context.run.run_id }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.analysis.proposals.length, 1);
  assert.deepEqual(calls, [['preview', context.run.run_id]], 'the full completed-section read is not used');
});

// The live finalised run's review.state is 7.05 MB, almost all of it each
// proposal item's `original` (a second copy of the proposal). The preview
// pages render the fact items only: the proposal's edit and review trail,
// and a user fact's own words. These tests pin that projection.
function reviewWithEdits() {
  const editedComponents = [{ ...section().proposals[0].components[0], text: 'Edited category' }];
  return {
    version: 9,
    state: {
      status: 'READY',
      metrics: { note: BIG },
      summary: { note: BIG },
      review_timing: { note: BIG },
      schema_version: 'PRODUCT_REVIEW_STATE/V1',
      analysis_run_id: context.run.run_id,
      draft_analysis_id: 'a'.repeat(64),
      started_at: '2026-10-23T18:00:00.000Z',
      updated_at: '2026-10-23T19:00:00.000Z',
      published_at: null,
      release_evaluation: { note: BIG },
      release_evaluation_input: { note: BIG },
      agreement_coverage: { decision: 'PENDING', note: BIG },
      items: [{
        kind: 'PROPOSAL', item_id: 'ri-1', source_id: 'p-1', decision: 'EDITED',
        family_key: 'MATERIAL_CONTRACTS', schema_version: 'PRODUCT_REVIEW_ITEM/V1',
        structure_node_id: NODE, source_closure_id: 'c-1', source_span_ids: ['s-full', 's-other'],
        reviewed_at: '2026-10-23T19:00:00.000Z', comment: 'Checked the category.',
        edited_statement: 'Edited statement',
        edited_headline: { label: 'Edited headline', distinguishing_component_ids: ['c-a'] },
        edited_components: editedComponents,
        edited_roles: { COMPANY: ['Parent Inc.'] },
        edited_value: { canonical: 1 },
        edited_relationship: { from_proposal_id: 'p-1' },
        edited_proposition_group_id: 'g-1',
        template_id: 'template-1',
        original: {
          ...section().proposals[0],
          roles: { COMPANY: ['Parent Inc.'] },
          source_span_ids: ['s-full', 's-other'],
          model_call_id: 'm'.repeat(64),
          state: 'PROPOSED',
          schema_version: 'PRODUCT_PROPOSAL/V1',
          fact_type: 'MATERIAL_CONTRACT_CATEGORY_CRITERION',
          canonical_value: 3,
          facts_span_text: BIG,
        },
      }, {
        kind: 'ISSUE', item_id: 'ri-2', source_id: 'i-1', decision: 'ACCEPTED',
        structure_node_id: NODE, source_closure_id: 'c-1', source_span_ids: ['s-full'],
        family_key: 'MATERIAL_CONTRACTS', schema_version: 'PRODUCT_REVIEW_ITEM/V1',
        original: { code: 'X', family_key: 'X', subtype_key: 'Y', message: BIG, state: 'OPEN' },
      }, {
        kind: 'COVERAGE', item_id: 'ri-3', source_id: 'cov-1', decision: 'ACCEPTED',
        structure_node_id: NODE, original: { coverage_assertion_id: 'cov-1', reason: BIG },
      }, {
        kind: 'RELATIONSHIP', item_id: 'ri-4', source_id: 'l-1', decision: 'ACCEPTED',
        structure_node_id: NODE, original: { fact_link_id: 'l-1', from_proposal_id: 'p-1', to_proposal_id: 'p-1', relationship_type: 'X', message: BIG },
      }],
    },
  };
}

test('the preview review state keeps the fact items and the trail fields, not the fat originals', () => {
  const workspace = buildPreviewWorkspace({ ...context, sections: [section()], review: reviewWithEdits() });
  assert.deepEqual(Object.keys(workspace.review.state).sort(), ['agreement_coverage', 'items', 'status']);
  assert.deepEqual(workspace.review.state.items.map((item) => item.kind), ['PROPOSAL'], 'issue, coverage and relationship items are not rendered');
  const item = workspace.review.state.items[0];
  assert.deepEqual(item.original, {}, 'the duplicate proposal is not sent');
  assert.equal(item.edited_statement, 'Edited statement');
  assert.equal(item.edited_headline.label, 'Edited headline');
  assert.equal(item.edited_components[0].text, 'Edited category');
  assert.equal(item.comment, 'Checked the category.');
  assert.equal(item.reviewed_at, '2026-10-23T19:00:00.000Z');
  assert.equal(item.decision, 'EDITED');
  assert.equal(item.item_id, 'ri-1');
  for (const absent of ['source_span_ids', 'source_closure_id', 'family_key', 'schema_version', 'edited_roles', 'edited_value', 'edited_relationship', 'template_id', 'structure_node_id']) {
    assert.ok(!Object.hasOwn(item, absent), `${absent} is not read for a proposal item`);
  }
  // The lawyer's edit is what the page renders.
  const preview = previewFactsFromWorkspace(workspace);
  assert.equal(preview.facts.length, 1);
  assert.equal(preview.facts[0].statement, 'Edited statement');
  assert.equal(preview.facts[0].headline.label, 'Edited headline');
  assert.equal(preview.facts[0].components[0].text, 'Edited category');
  assert.deepEqual(preview.reviewItemsByFactId.get('p-1'), {
    item_id: 'ri-1', decision: 'EDITED', comment: 'Checked the category.',
    reviewed_at: '2026-10-23T19:00:00.000Z', edited_headline: { label: 'Edited headline', distinguishing_component_ids: ['c-a'] },
  });
  // A fat original, fat state blocks and non-fact items cannot come back.
  const bytes = JSON.stringify(workspace).length;
  assert.ok(bytes < 32 * 1024, `preview payload is ${bytes} bytes (guard: 32768)`);
  assert.ok(!JSON.stringify(workspace).includes('x'.repeat(1000)));
});

test('a user fact keeps its own words and edit, and an edited fact still shows the lawyer\'s words', () => {
  const userFact = {
    kind: 'USER_FACT', item_id: 'ri-user', source_id: 'u-1', decision: 'EDITED',
    structure_node_id: NODE, reviewed_at: '2026-10-23T19:05:00.000Z', comment: 'Our own fact.',
    edited_statement: 'User-edited statement',
    edited_components: [{ ...section().proposals[0].components[0], text: 'User-edited category' }],
    original: {
      family_key: 'MATERIAL_CONTRACTS', subtype_key: 'CATEGORY_WITH_THRESHOLD',
      statement: 'User statement', validation_status: 'VALID',
      headline: { label: 'User headline', distinguishing_component_ids: ['c-a'] },
      components: section().proposals[0].components,
      roles: { COMPANY: ['Parent Inc.'] },
      source_span_ids: ['s-full'],
      model_call_id: 'm'.repeat(64),
      facts_span_text: BIG,
    },
  };
  const workspace = buildPreviewWorkspace({
    ...context, sections: [section()],
    review: { version: 1, state: { status: 'DRAFT', items: [userFact], agreement_coverage: { decision: 'PENDING' } } },
  });
  const projected = workspace.review.state.items[0];
  assert.equal(projected.kind, 'USER_FACT');
  assert.equal(projected.structure_node_id, NODE, 'the section it belongs to is kept');
  assert.equal(projected.original.statement, 'User statement');
  assert.equal(projected.original.components[0].text, 'Material Contracts');
  assert.equal(projected.original.family_key, 'MATERIAL_CONTRACTS');
  for (const absent of ['roles', 'source_span_ids', 'model_call_id', 'facts_span_text']) {
    assert.ok(!Object.hasOwn(projected.original, absent), `${absent} is not read for a user fact`);
  }
  const preview = previewFactsFromWorkspace(workspace);
  const fact = preview.facts.find((entry) => entry.fact_id === 'u-1');
  assert.equal(fact.statement, 'User-edited statement');
  assert.equal(fact.components[0].text, 'User-edited category');
  assert.deepEqual(preview.reviewItemsByFactId.get('u-1'), {
    item_id: 'ri-user', decision: 'EDITED', comment: 'Our own fact.',
    reviewed_at: '2026-10-23T19:05:00.000Z',
  });
});
