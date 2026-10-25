'use strict';

// Work package 38 (plan finding (251)): the lawyer preview read model. The
// page's payload is 3.9 MB and the read is about 16 s on a finished
// 97-section run, nearly all of it the database scanning the run's rows
// (finding (244): 31 sections 8 s, a light query 0.7 s). A finished run's
// projection does not change without a review save, so it is stored once
// and served as one row; a run still analysing reads live; a review save
// makes the stored row stale and the next view rebuilds it once.

const assert = require('node:assert/strict');
const test = require('node:test');
const { previewReadModelUsable, runIsFinished, PREVIEW_WORKSPACE_VERSION } = require('../lib/product/preview-read-model');
const { createProductPreviewHandler, buildPreviewWorkspace } = require('../lib/product/preview-handler');

const RUN_ID = '2f2b6f2e-6d3e-4c2b-9d1c-1a2b3c4d5e6f';

function responseDouble() {
  return {
    statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function context() {
  return {
    run: { run_id: RUN_ID, status: 'READY', stage: 'READY', schema_version: 'LEGAL_SCHEMA/V2', source_generation: 3, model_config: { provider_id: 'ANTHROPIC_API' } },
    sourceDocument: { parties: ['Parent Inc.', 'Target Corp.'] },
    agreementStructure: { nodes: [{ node_id: 'n1', reference: '3.1', authored_order: 1 }] },
  };
}

function section() {
  return {
    node_id: 'n1', section_reference: '3.1',
    routing: { structure_node_id: 'n1', section_reference: '3.1', families: ['REPRESENTATIONS'], disposition: 'FAMILY_ASSIGNED' },
    source_closure: { source_closure_id: 'c1', structure_node_id: 'n1', section_reference: '3.1', full_section_span_id: 's1' },
    spans: [{ span_id: 's1', kind: 'FULL_SECTION', structure_node_id: 'n1', start_byte: 0, end_byte: 30, exact_text: 'Section 3.1 Organization.' }],
    proposals: [], groups: [], links: [], issues: [], coverage: [],
  };
}

function store(overrides = {}) {
  const state = { modelWrites: 0, sectionReads: 0, modelRow: null };
  const value = {
    assertAccess: async () => 'OWNER',
    getRun: async () => context().run,
    getRunContext: async () => context(),
    loadPreviewSectionResults: async () => { state.sectionReads += 1; return [section()]; },
    loadDraftIssues: async () => [],
    getReview: async () => null,
    getPreviewReadModel: async () => state.modelRow,
    savePreviewReadModel: async ({ payload }) => { state.modelWrites += 1; state.modelRow = { run_id: RUN_ID, payload, built_at: '2026-10-25T00:00:00.000Z', stale: false }; },
    markPreviewReadModelStale: async () => { if (state.modelRow) state.modelRow = { ...state.modelRow, stale: true }; },
    ...overrides,
  };
  return { value, state };
}

function handlerFor(value) {
  return createProductPreviewHandler({ getClient: () => ({}), storeFactory: () => value, actorResolver: async () => 'lawyer@example.test' });
}

test('the delivery rule: a finished, fresh, current-version model is served; a live run, a stale row and another version are not', () => {
  const payload = { schema_version: PREVIEW_WORKSPACE_VERSION, analysis: {} };
  assert.equal(runIsFinished({ status: 'READY' }), true);
  assert.equal(runIsFinished({ status: 'FAILED' }), true);
  assert.equal(runIsFinished({ status: 'RUNNING' }), false);
  assert.equal(runIsFinished({ status: 'PARTIAL' }), false);
  assert.equal(previewReadModelUsable({ run: { status: 'READY' }, row: { payload, stale: false } }), true);
  assert.equal(previewReadModelUsable({ run: { status: 'FAILED' }, row: { payload, stale: false } }), true);
  assert.equal(previewReadModelUsable({ run: { status: 'RUNNING' }, row: { payload, stale: false } }), false, 'a live run commits sections as it goes');
  assert.equal(previewReadModelUsable({ run: { status: 'READY' }, row: { payload, stale: true } }), false, 'a review save made it stale');
  assert.equal(previewReadModelUsable({ run: { status: 'READY' }, row: null }), false);
  assert.equal(previewReadModelUsable({ run: { status: 'READY' }, row: { payload: { schema_version: 'PRODUCT_PREVIEW_WORKSPACE/V0' }, stale: false } }), false, 'a payload another build wrote');
  assert.equal(previewReadModelUsable({ run: { status: 'READY' }, row: { payload: null, stale: false } }), false);
});

test('a finished run is stored once and served from the model afterwards without reading its analysis', async () => {
  const { value, state } = store();
  const handler = handlerFor(value);
  // First view: the live read, then stored.
  const first = responseDouble();
  await handler({ method: 'GET', query: { id: RUN_ID } }, first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['X-Preview-Read'], 'REBUILT');
  assert.equal(state.sectionReads, 1);
  assert.equal(state.modelWrites, 1);
  assert.equal(first.body.schema_version, 'PRODUCT_PREVIEW_WORKSPACE/V1');
  // Second view: the stored row, the analysis never read.
  const second = responseDouble();
  await handler({ method: 'GET', query: { id: RUN_ID } }, second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.headers['X-Preview-Read'], 'MODEL');
  assert.equal(second.headers['Cache-Control'], 'private, max-age=60');
  assert.equal(state.sectionReads, 1, 'the run analysis is not read for a stored model');
  assert.equal(state.modelWrites, 1);
  assert.deepEqual(second.body, first.body);

  // A review save marks it stale: the next view rebuilds once, then serves.
  await value.markPreviewReadModelStale(RUN_ID);
  const third = responseDouble();
  await handler({ method: 'GET', query: { id: RUN_ID } }, third);
  assert.equal(third.headers['X-Preview-Read'], 'REBUILT');
  assert.equal(state.sectionReads, 2);
  assert.equal(state.modelWrites, 2);
  const fourth = responseDouble();
  await handler({ method: 'GET', query: { id: RUN_ID } }, fourth);
  assert.equal(fourth.headers['X-Preview-Read'], 'MODEL');
  assert.equal(state.sectionReads, 2);
});

test('a run still analysing reads live every time and stores nothing', async () => {
  const { value, state } = store({ getRun: async () => ({ ...context().run, status: 'RUNNING', stage: 'SECTION_ANALYSIS' }) });
  const handler = handlerFor(value);
  for (let index = 0; index < 2; index += 1) {
    const response = responseDouble();
    await handler({ method: 'GET', query: { id: RUN_ID } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['X-Preview-Read'], undefined);
    assert.equal(response.headers['Cache-Control'], 'private, no-store');
  }
  assert.equal(state.sectionReads, 2);
  assert.equal(state.modelWrites, 0);
});

test('a store without the read model, or a read model that fails, still answers from the live read', async () => {
  // An older deployment's store has no methods.
  const plain = store({
    getPreviewReadModel: undefined, savePreviewReadModel: undefined, markPreviewReadModelStale: undefined,
  });
  const response = responseDouble();
  await handlerFor(plain.value)({ method: 'GET', query: { id: RUN_ID } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(plain.state.sectionReads, 1);
  assert.equal(response.body.schema_version, 'PRODUCT_PREVIEW_WORKSPACE/V1');

  // The migration has not reached the database: the table read throws
  // (42P01/PGRST205) and the page is still served.
  const missing = store({ getPreviewReadModel: async () => { throw new Error('relation "public.product_preview_reads" does not exist'); } });
  const originalError = console.error;
  console.error = () => {};
  try {
    const fallback = responseDouble();
    await handlerFor(missing.value)({ method: 'GET', query: { id: RUN_ID } }, fallback);
    assert.equal(fallback.statusCode, 200);
    assert.equal(missing.state.sectionReads, 1);
    assert.equal(fallback.body.schema_version, 'PRODUCT_PREVIEW_WORKSPACE/V1');
  } finally { console.error = originalError; }
});

test('buildPreviewWorkspace is what the model stores: the same payload for the same run', () => {
  const workspace = buildPreviewWorkspace({ ...context(), sections: [section()] });
  assert.equal(workspace.schema_version, PREVIEW_WORKSPACE_VERSION);
  assert.deepEqual(Object.keys(workspace).sort(), ['analysis', 'progress', 'review', 'schema_version']);
});

test('a review save, and a restore of an earlier review, mark the stored projection stale', async () => {
  const { ProductPhase3Store } = require('../lib/product/phase-3-store');
  const staleCalls = [];
  const client = {
    rpc: async (name) => ({ data: { schema_version: 'PRODUCT_REVIEW_STATE/V1', name }, error: null }),
    from: () => ({
      update: (values) => ({ eq: async (column, value) => { staleCalls.push([values.stale, column, value]); return { error: null }; } }),
    }),
  };
  const store = new ProductPhase3Store({ client });
  await store.saveReview({ runId: RUN_ID, expectedVersion: 1, state: {}, actor: 'lawyer@example.test', eventType: 'SAVE', idempotencyKey: 'one', command: { type: 'SAVE' } });
  await store.restoreReview({ runId: RUN_ID, expectedVersion: 2, restoreVersion: 1, actor: 'lawyer@example.test', idempotencyKey: 'two' });
  assert.deepEqual(staleCalls, [[true, 'run_id', RUN_ID], [true, 'run_id', RUN_ID]]);
  // A store without the model (an older deployment) still saves and restores.
  const plain = new ProductPhase3Store({ client });
  plain.markPreviewReadModelStale = undefined;
  await plain.saveReview({ runId: RUN_ID, expectedVersion: 1, state: {}, actor: 'lawyer@example.test', eventType: 'SAVE', idempotencyKey: 'three', command: { type: 'SAVE' } });
});
