'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { buildAgreementDraft } = require('../lib/product/agreement-draft');
const { replayRun, renderReplaySummary, RunReplayError } = require('../lib/product/run-replay');
const { conchoSource, createSyntheticConchoModel, schema } = require('./product-phase-2.test.js');

// Work package E1 item 4 (implementer E): the replay harness finalises a
// (buildAgreementDraft extracts whole sections, so the replay is told not
// to split: a hosted run replays with the runner's split by default.)
// run from its stored calls with no model call. The run here is the real
// Concho source through the synthetic model (the Phase 2 harness); its
// stored rows are built from the draft as the store would hold them, and
// the replay must give the same draft, section by section, by content id.

const RUN_ID = '0f9c1a2b-3d4e-4f60-8a1b-2c3d4e5f6071';

// The Concho run is built once (the intake, the structure and the draft
// take minutes on a loaded machine); each test copies the rows it changes.
let shared = null;
function conchoRun() {
  if (!shared) shared = buildConchoRun();
  return shared;
}

async function buildConchoRun() {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const model = createSyntheticConchoModel();
  const draft = await buildAgreementDraft({ sourceDocument, agreementStructure, legalSchema: schema, model });
  const rows = {
    run_id: RUN_ID,
    tables: {
      product_analysis_runs: [{ run_id: RUN_ID, status: 'READY', schema_version: schema.schema_version, prompt_bundle_version: 'PRODUCT_V1', model_config: { provider_id: 'SYNTHETIC_TEST_PROVIDER' } }],
      product_model_calls: draft.model_calls.map((call) => ({ run_id: RUN_ID, ...call, created_at: '2026-10-18T12:00:00Z' })),
      product_section_work: draft.sections.map((section, index) => ({ run_id: RUN_ID, node_id: section.node_id, authored_order: index, status: 'COMPLETE', attempts: 1, attempt_token: null, error_history: [] })),
      product_source_closures: draft.source_closures.map((closure) => ({ run_id: RUN_ID, source_closure_id: closure.source_closure_id, structure_node_id: closure.structure_node_id, section_reference: closure.section_reference, payload: closure })),
      product_proposals: draft.proposals.map((proposal) => ({ run_id: RUN_ID, proposal_id: proposal.proposal_id, structure_node_id: proposal.structure_node_id, validation_status: proposal.validation_status, payload: proposal })),
      product_issues: draft.issues.map((issue) => ({ run_id: RUN_ID, issue_id: issue.issue_id, structure_node_id: issue.structure_node_id || null, payload: issue })),
    },
    context: {
      run: { run_id: RUN_ID, schema_version: schema.schema_version, prompt_bundle_version: 'PRODUCT_V1' },
      sourceDocument,
      agreementStructure,
    },
  };
  return { draft, rows, model };
}

test('a run replayed from its stored calls gives the same draft, with no model call and nothing spent', async () => {
  const { draft, rows, model } = await conchoRun();
  const callsBefore = model.calls.length;
  const replay = await replayRun({ run: rows, legalSchema: schema, longSectionSplit: null });
  assert.equal(model.calls.length, callsBefore, 'the synthetic model was not called again');
  assert.equal(replay.sections_failed.length, 0);
  assert.equal(replay.sections_replayed, draft.sections.length);
  assert.equal(replay.model_calls.live_calls, 0);
  assert.equal(replay.model_calls.cost_usd, 0);
  assert.equal(replay.model_calls.answered, rows.tables.product_model_calls.length);
  assert.equal(replay.model_calls.unused.length, 0);
  assert.equal(replay.proposals.identical, true);
  assert.equal(replay.proposals.replayed.total, draft.proposals.length);
  assert.ok(replay.draft, 'the draft is assembled and validated');
  assert.equal(replay.draft.draft_analysis_id, draft.draft_analysis_id, 'the same draft by content id');
  assert.deepEqual(replay.issues.replayed, replay.issues.stored);
  const summary = renderReplaySummary(replay);
  assert.match(summary, /0 live calls, \$0\.00 spent/);
  assert.match(summary, /identical by proposal id and status/);
});

test('a subset of sections replays alone, without a draft', async () => {
  const { draft, rows } = await conchoRun();
  const reference = draft.sections[0].section_reference;
  const replay = await replayRun({ run: rows, legalSchema: schema, sections: [reference], longSectionSplit: null });
  assert.equal(replay.sections_replayed, 1);
  assert.equal(replay.draft, null);
  assert.equal(replay.proposals.identical, true);
  assert.equal(replay.proposals.stored.total, draft.proposals.filter((proposal) => proposal.structure_node_id === draft.sections[0].node_id).length);
  assert.ok(replay.model_calls.unused.length > 0, 'the other sections\' calls are unused');
});

test('a request with no stored answer fails the section under the exact match and is answered by section, kind and part under the loose match', async () => {
  const { draft, rows } = await conchoRun();
  const reference = draft.sections[0].section_reference;
  const nodeId = draft.sections[0].node_id;
  // The stored routing call's request is not what the code builds now (one more key in it).
  const altered = JSON.parse(JSON.stringify(rows));
  const routing = altered.tables.product_model_calls.find((call) => call.structure_node_id === nodeId && call.call_kind === 'ROUTING');
  routing.request = { ...routing.request, instruction: `${routing.request.instruction} (an earlier wording)` };
  const exact = await replayRun({ run: altered, legalSchema: schema, sections: [reference], longSectionSplit: null });
  assert.equal(exact.sections_failed.length, 1);
  assert.equal(exact.sections_failed[0].code, 'REPLAY_MISS');
  assert.match(exact.sections_failed[0].message, /ROUTING for/);
  const loose = await replayRun({ run: altered, legalSchema: schema, sections: [reference], match: 'loose', longSectionSplit: null });
  assert.equal(loose.sections_failed.length, 0);
  assert.equal(loose.model_calls.drifts.length, 1);
  assert.equal(loose.model_calls.drifts[0].call_kind, 'ROUTING');
  assert.equal(loose.model_calls.drifts[0].section_reference, reference);
  // The answer is the same, so the proposals are; the call record carries the altered request as the model's raw request.
  assert.equal(loose.proposals.identical, true);
  assert.match(renderReplaySummary(loose), /answered loosely/);
});

test('the replay refuses rows without context or calls', async () => {
  const { rows } = await conchoRun();
  await assert.rejects(() => replayRun({ run: { run_id: RUN_ID, tables: rows.tables } }), (error) => error instanceof RunReplayError && error.code === 'RUN_CONTEXT_REQUIRED');
  await assert.rejects(() => replayRun({ run: { run_id: RUN_ID, tables: { ...rows.tables, product_model_calls: [] }, context: rows.context } }), (error) => error.code === 'NO_STORED_CALLS');
});
