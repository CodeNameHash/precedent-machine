'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  FINAL_REVIEW_PACKET_SCHEMA,
  REPAIRED_REPLAY_SCHEMA,
  FinalPilotSynthesisError,
  buildFinalPilotSynthesis,
} = require('../lib/canonical-v2/native-producer/m3-final-pilot-synthesis');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'), 'utf8'));
const RETAINED = new Set(['modiv-consideration-2-1', 'modiv-termination-fee-7-3']);
const REPLAY_ONLY = new Set(['skechers-no-other-reps-3-28', 'topbuild-termination-company-6-3']);
const REPAIRS = [
  'modiv-antitrust-consents-5-5',
  'modiv-closing-conditions-6-1',
  'skechers-capitalisation-3-7',
  'topbuild-capitalisation-3-1-b',
  'topbuild-ioc-company-4-1',
  'topbuild-no-shop-company-4-3',
  'topbuild-remedies-specific-performance-7-6',
];

function digest(char) { return char.repeat(64); }
function commit(char) { return char.repeat(40); }
function sealed(schema, body, idKey) { return { schema_version: schema, ...body, [idKey]: contentId(schema, { schema_version: schema, ...body }) }; }

function recording(item) {
  return {
    schema_version: 'NATIVE_UNIFIED_RUN_PROVIDER_RECORDING/V1',
    work_item_id: item.work_item_id,
    provider_output: {
      provider_id: 'recorded-test-provider', model_id: 'recorded-test-model', prompt: 'immutable raw recording',
      proposals: [], evidence_residuals: [], raw_response_text: `{\"item\":\"${item.work_item_id}\"}`,
      raw_response_length: item.work_item_id.length + 11, attempts: 1,
    },
    provider_recording_id: digest(String((item.work_item_id.charCodeAt(0) % 10))),
  };
}

function execution(tag, ids) {
  const workResults = MANIFEST.work_items.filter((item) => ids.includes(item.work_item_id)).map((item) => ({
    schema_version: 'NATIVE_UNIFIED_RUN_WORK_RESULT/V1', work_item_id: item.work_item_id,
    source_id: item.source_id, family_id: item.family_id, profile_id: 'TERRA_MEDIUM', status: 'SUCCEEDED',
    failure_code: null, failure_stage: null, run_receipt: { tag, item: item.work_item_id },
    resolution: { resolved: [], review_queue: [], open_world: [] }, provider_recording: recording(item),
    work_result_id: digest(String((item.work_item_id.charCodeAt(1) % 10))),
  }));
  return sealed('NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1', {
    validation_receipt_id: digest('1'), semantic_manifest_id: digest('2'), execution_plan_id: digest('3'),
    contract_fingerprint: `${tag}-contract`, validation_evidence: { tag }, work_results: workResults,
    succeeded_count: workResults.length, failed_count: 0,
  }, 'execution_result_id');
}

function fixture() {
  const first = execution('first', MANIFEST.work_items.map((item) => item.work_item_id));
  const iteration2 = execution('iteration-2', ['modiv-mae-definition-8-12-g', ...REPAIRS]);
  const plan = sealed('M3_12_CALL_ITERATION_2_RERUN_PLAN/V1', {
    first_execution_result_id: first.execution_result_id,
  }, 'iteration_2_rerun_plan_id');
  const vector = sealed('M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3', {
    bindings: {
      first_execution_result_id: first.execution_result_id,
      iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
      adjudications: [...RETAINED].sort().map((work_item_id, index) => ({
        work_item_id, review_packet_id: digest(String(index + 4)), adjudication_id: digest(String(index + 6)),
      })),
    },
  }, 'content_hash');
  const repairVector = sealed('M3_12_CALL_ITERATION_2_ATTEMPT_3_REPAIR_RERUN_VECTOR/V1', {
    work_item_repairs: REPAIRS.map((work_item_id) => ({ work_item_id, replayable: true })),
  }, 'content_hash');
  const firstById = new Map(first.work_results.map((result) => [result.work_item_id, result]));
  const replayResults = [...REPLAY_ONLY].sort().map((work_item_id) => sealed('M3_12_CALL_ITERATION_2_REPLAY_RESULT/V1', {
    iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
    work_item_id, first_work_result_id: firstById.get(work_item_id).work_result_id,
    provider_recording_id: firstById.get(work_item_id).provider_recording.provider_recording_id,
    model_call_count: 0, run_receipt: { retained: true }, resolution: { resolved: [] },
  }, 'replay_result_id'));
  return { first, iteration2, plan, vector, repairVector, replayResults };
}

function replayStub({ work_item: item, prior_result: prior, source_execution_kind: sourceExecutionKind }) {
  return sealed(REPAIRED_REPLAY_SCHEMA, {
    work_item_id: item.work_item_id, source_execution_kind: sourceExecutionKind,
    source_work_result_id: prior.work_result_id,
    provider_recording: prior.provider_recording, model_call_count: 0,
    run_receipt: { replayed_recording: prior.provider_recording.provider_recording_id }, resolution: { resolved: [] },
  }, 'repaired_replay_id');
}

function build(overrides = {}) {
  const data = fixture();
  return buildFinalPilotSynthesis({
    first_execution_result: data.first, iteration_2_execution_result: data.iteration2,
    iteration_2_rerun_plan: data.plan, revised_decision_vector: data.vector,
    repair_rerun_vector: data.repairVector, replay_only_results: data.replayResults,
    required_repair_commits: [commit('a'), commit('b')], present_repair_commits: [commit('a'), commit('b')],
    manifest: MANIFEST, root_dir: ROOT, replay_recording: replayStub, ...overrides,
  });
}

test('builds one sealed, no-model review packet for all twelve original items', async () => {
  const packet = await build();
  assert.equal(packet.schema_version, FINAL_REVIEW_PACKET_SCHEMA);
  assert.equal(packet.model_call_count, 0);
  assert.equal(packet.legal_disposition, 'NOT_DETERMINED');
  assert.equal(packet.independent_review_state, 'PENDING_INDEPENDENT_LEGAL_REVIEW');
  assert.equal(packet.work_items.length, 12);
  assert.deepEqual(packet.work_items.map((item) => item.work_item_id), MANIFEST.work_items.map((item) => item.work_item_id).sort());
  assert.equal(packet.work_items.filter((item) => item.source_kind === 'ADJUDICATED_FIRST_PASS').length, 2);
  assert.equal(packet.work_items.filter((item) => item.source_kind === 'REPLAY_ONLY').length, 2);
  assert.equal(packet.work_items.filter((item) => item.source_kind === 'PASSED_ITERATION_2').length, 1);
  assert.equal(packet.work_items.filter((item) => item.source_kind === 'REPAIRED_REPLAY').length, 7);
  const replayOnly = packet.work_items.find((item) => item.work_item_id === 'skechers-no-other-reps-3-28');
  assert.match(replayOnly.first_provider_recording.provider_output.raw_response_text, /skechers-no-other-reps/);
  const repaired = packet.work_items.find((item) => item.work_item_id === 'topbuild-remedies-specific-performance-7-6');
  assert.match(repaired.repaired_replay.provider_recording.provider_output.raw_response_text, /topbuild-remedies-specific-performance/);
  assert.equal(repaired.repaired_replay.source_execution_kind, 'ITERATION_2');
  const skechersCapitalisation = packet.work_items.find((item) => item.work_item_id === 'skechers-capitalisation-3-7');
  assert.equal(skechersCapitalisation.repaired_replay.source_execution_kind, 'FIRST_PASS');
  const body = { ...packet }; delete body.final_review_packet_id;
  assert.equal(packet.final_review_packet_id, contentId(FINAL_REVIEW_PACKET_SCHEMA, body));
});

test('fails before replay when any declared repair commit is absent', async () => {
  let calls = 0;
  await assert.rejects(
    () => build({ present_repair_commits: [commit('a')], replay_recording: () => { calls += 1; return replayStub(); } }),
    (error) => error instanceof FinalPilotSynthesisError && error.code === 'REPAIR_COMMIT_MISSING',
  );
  assert.equal(calls, 0);
});

test('rejects a packet that omits one failed iteration-2 recording', async () => {
  const data = fixture();
  data.repairVector = sealed('M3_12_CALL_ITERATION_2_ATTEMPT_3_REPAIR_RERUN_VECTOR/V1', {
    work_item_repairs: REPAIRS.slice(0, -1).map((work_item_id) => ({ work_item_id, replayable: true })),
  }, 'content_hash');
  await assert.rejects(
    () => build({ repair_rerun_vector: data.repairVector }),
    (error) => error instanceof FinalPilotSynthesisError && error.code === 'REPAIR_COHORT_MISMATCH',
  );
});
