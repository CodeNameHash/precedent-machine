'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildIteration2IndependentReviewInput,
  validateIteration2IndependentReviewReadiness,
} = require('../lib/canonical-v2/native-producer/m3-iteration-2-independent-review-package');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(
  ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
), 'utf8'));
const digest = (value) => contentId('M3_TEST_DIGEST/V1', { value });
const retainIds = new Set(['modiv-consideration-2-1', 'modiv-termination-fee-7-3']);
const replayIds = new Set(['skechers-no-other-reps-3-28', 'topbuild-termination-company-6-3']);

function sealed(schema, body, field) {
  return { ...body, [field]: contentId(schema, body) };
}

function fixtures() {
  const execution = digest('a');
  const gate = digest('b');
  const firstExecution = {
    execution_result_id: execution,
    work_results: manifest.work_items.map((item, index) => ({
      work_item_id: item.work_item_id,
      work_result_id: digest(`w${index}`),
      provider_recording: { provider_recording_id: digest(`p${index}`) },
    })),
  };
  const resultById = new Map(firstExecution.work_results.map((item) => [item.work_item_id, item]));
  const checkpointBody = {
    schema_version: 'M3_12_CALL_ITERATION_2_PRESERVED_CHECKPOINT_SET/V1',
    first_execution_result_id: execution,
    checkpoints: manifest.work_items.map((item, index) => ({
      work_item_id: item.work_item_id,
      checkpoint_id: digest(`c${index}`),
      work_result_id: resultById.get(item.work_item_id).work_result_id,
      provider_recording_id: resultById.get(item.work_item_id).provider_recording.provider_recording_id,
    })),
  };
  const checkpointSet = sealed(
    'M3_12_CALL_ITERATION_2_PRESERVED_CHECKPOINT_SET/V1',
    checkpointBody,
    'preserved_checkpoint_set_id',
  );
  const planBody = {
    schema_version: 'M3_12_CALL_ITERATION_2_RERUN_PLAN/V1',
    first_execution_result_id: execution,
    quality_gate_id: gate,
    preserved_checkpoint_set: checkpointSet,
    archived_replaced_work_items: manifest.work_items.filter((item) => !retainIds.has(item.work_item_id)).map((item) => ({ work_item_id: item.work_item_id })),
    replay_only_work_items: manifest.work_items.filter((item) => replayIds.has(item.work_item_id)).map((item) => ({
      work_item_id: item.work_item_id,
      first_work_result_id: resultById.get(item.work_item_id).work_result_id,
      preserved_checkpoint_id: checkpointSet.checkpoints.find((row) => row.work_item_id === item.work_item_id).checkpoint_id,
      provider_recording_id: resultById.get(item.work_item_id).provider_recording.provider_recording_id,
    })),
    live_terra_work_items: manifest.work_items.filter((item) => !retainIds.has(item.work_item_id) && !replayIds.has(item.work_item_id)).slice(0, 6).map((item) => ({ work_item_id: item.work_item_id })),
    live_sol_work_items: manifest.work_items.filter((item) => !retainIds.has(item.work_item_id) && !replayIds.has(item.work_item_id)).slice(6).map((item) => ({ work_item_id: item.work_item_id })),
  };
  const plan = sealed('M3_12_CALL_ITERATION_2_RERUN_PLAN/V1', planBody, 'iteration_2_rerun_plan_id');
  const checklistBody = {
    schema_version: 'M3_MODEL_RERUN_ACCEPTANCE_CHECKLIST/V2',
    supersedes_content_hash: digest('s'),
    execution_result_id: execution,
    independent_review_findings_id: digest('f'),
    items: manifest.work_items.filter((item) => !retainIds.has(item.work_item_id)).map((item) => ({ work_item_id: item.work_item_id })),
  };
  const checklist = sealed('M3_MODEL_RERUN_ACCEPTANCE_CHECKLIST/V2', checklistBody, 'content_hash');
  const retainedAdjudications = [...retainIds].map((workItemId, index) => {
    const packetBody = {
      schema_version: 'M3_12_CALL_PILOT_REVIEW_PACKET/V1',
      work_item_id: workItemId,
      provenance: { execution_result_id: execution },
      resolved_output: {
        open_world: [{ closure_id: digest(`o${index}`) }],
        review_queue: [{ closure_id: digest(`q${index}`) }],
      },
    };
    const reviewPacket = sealed('M3_12_CALL_PILOT_REVIEW_PACKET/V1', packetBody, 'review_packet_id');
    const adjudicationBody = {
      schema_version: 'M3_PILOT_UNRESOLVED_OUTPUT_ADJUDICATION/V1',
      work_item_id: workItemId,
      review_packet_id: reviewPacket.review_packet_id,
      execution_result_id: execution,
      reviewer_disposition: 'PASS',
      unresolved_items: [
        { closure_id: digest(`o${index}`), output_kind: 'OPEN_WORLD', disposition: 'REVIEWED_OPEN_WORLD' },
        { closure_id: digest(`q${index}`), output_kind: 'REVIEW_QUEUE', disposition: 'DEFERRED_TO_GOVERNED_OWNER' },
      ],
    };
    return {
      adjudication: sealed('M3_PILOT_UNRESOLVED_OUTPUT_ADJUDICATION/V1', adjudicationBody, 'adjudication_id'),
      review_packet: reviewPacket,
    };
  });
  const vectorBody = {
    schema_version: 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3',
    supersedes_content_hash: digest('v'),
    planner_commit: '4bab09bc446d20d09e1abc5013e14e19ec20e82c',
    audit_mode: 'RETAINED_PROVIDER_OUTPUT_REPLAY_ONLY',
    actual_model_call_count: 0,
    bindings: {
      first_execution_result_id: execution,
      quality_gate_id: gate,
      iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
      preserved_checkpoint_set_id: checkpointSet.preserved_checkpoint_set_id,
      acceptance_checklist: { schema_version: checklist.schema_version, content_hash: checklist.content_hash },
      adjudications: retainedAdjudications.map((record) => ({
        work_item_id: record.adjudication.work_item_id,
        adjudication_id: record.adjudication.adjudication_id,
        review_packet_id: record.review_packet.review_packet_id,
      })),
    },
    decisions: manifest.work_items.map((item) => ({
      work_item_id: item.work_item_id,
      action: retainIds.has(item.work_item_id) ? 'RETAIN' : replayIds.has(item.work_item_id) ? 'REPLAY_ONLY' : 'LIVE',
      profile_id: retainIds.has(item.work_item_id) || replayIds.has(item.work_item_id)
        ? null
        : plan.live_terra_work_items.some((row) => row.work_item_id === item.work_item_id) ? 'TERRA_MEDIUM' : 'SOL_HIGH',
      basis: retainIds.has(item.work_item_id) ? 'VALIDATED_PILOT_ADJUDICATION' : 'SEALED_ACCEPTANCE_V2',
    })),
    decision_counts: { retain: 2, replay_only: 2, live_terra: 6, live_sol: 2, planned_live_model_calls: 8 },
  };
  const vector = sealed('M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3', vectorBody, 'content_hash');
  const replays = {
    actual_model_call_count: 0,
    iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
    outputs: plan.replay_only_work_items.map((item) => sealed('M3_12_CALL_ITERATION_2_REPLAY_RESULT/V1', {
      schema_version: 'M3_12_CALL_ITERATION_2_REPLAY_RESULT/V1',
      iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
      work_item_id: item.work_item_id,
      first_work_result_id: item.first_work_result_id,
      provider_recording_id: item.provider_recording_id,
      model_call_count: 0,
      run_receipt: { replay: item.work_item_id },
      resolution: { replay: item.work_item_id },
    }, 'replay_result_id')),
  };
  return { vector, checklist, plan, firstExecution, retainedAdjudications, replays };
}

function compile(fixture = fixtures()) {
  return buildIteration2IndependentReviewInput({
    revised_decision_vector: fixture.vector,
    sealed_acceptance_checklist: fixture.checklist,
    iteration_2_rerun_plan: fixture.plan,
    first_execution_result: fixture.firstExecution,
    validated_retained_adjudications: fixture.retainedAdjudications,
    replay_only_outputs: fixture.replays,
    root_dir: ROOT,
  });
}

test('compiles V2 and V3 into distinct retained, replay and live review states', () => {
  const input = compile();
  assert.equal(input.review_items.length, 12);
  assert.equal(input.review_items.filter((item) => item.final_output_state === 'AVAILABLE_RETAINED_FIRST_PASS_OUTPUT').length, 2);
  assert.equal(input.review_items.filter((item) => item.final_output_state === 'AVAILABLE_REPLAY_OUTPUT').length, 2);
  assert.equal(input.review_items.filter((item) => item.final_output_state === 'PENDING_LIVE_OUTPUT').length, 8);
  const retained = input.review_items.find((item) => item.work_item_id === 'modiv-consideration-2-1');
  assert.equal(retained.review_binding.binding_kind, 'VALIDATED_PILOT_ADJUDICATION');
  assert.ok(digest(retained.final_output_id));
  assert.ok(digest(retained.first_pass_checkpoint_id));
  assert.ok(digest(retained.provider_recording_id));
  const replay = input.review_items.find((item) => item.work_item_id === 'skechers-no-other-reps-3-28');
  assert.equal(replay.review_binding.binding_kind, 'SEALED_ACCEPTANCE_CHECKLIST');
  assert.equal(replay.final_output_id, fixtures().replays.outputs[0].replay_result_id);
});

test('fails closed until all eight live outputs are supplied', () => {
  const input = compile();
  const blocked = validateIteration2IndependentReviewReadiness({ independent_review_input: input });
  assert.equal(blocked.review_start_state, 'BLOCKED_LIVE_OUTPUTS_MISSING');
  assert.equal(blocked.missing_live_output_work_item_ids.length, 8);
  const ready = validateIteration2IndependentReviewReadiness({
    independent_review_input: input,
    live_outputs: blocked.missing_live_output_work_item_ids.map((work_item_id, index) => ({ work_item_id, final_output_id: digest(String(index + 1)) })),
  });
  assert.equal(ready.review_start_state, 'READY');
});

test('rejects a retained item without its exact first-pass identities or validated adjudication', () => {
  const fixture = fixtures();
  fixture.plan.preserved_checkpoint_set.checkpoints.find((row) => row.work_item_id === 'modiv-consideration-2-1').provider_recording_id = digest('z');
  assert.throws(() => compile(fixture), /identity does not match|exact first work result/i);
  const missingAdjudication = fixtures();
  missingAdjudication.retainedAdjudications.pop();
  assert.throws(() => compile(missingAdjudication), /retained.*adjudication/i);
});

test('rejects a replay result that is not sealed to its V3 rerun plan', () => {
  const fixture = fixtures();
  fixture.replays.outputs[0].iteration_2_rerun_plan_id = digest('x');
  assert.throws(() => compile(fixture), /replay-only item must bind/i);
});
