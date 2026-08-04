'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  Attempt3MaterialiserError,
  materialiseAttempt3,
} = require('../lib/canonical-v2/native-producer/m3-iteration-2-attempt-3-materialiser');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json'), 'utf8'));
const hash = (value) => value.repeat(64).slice(0, 64);
const retainedIds = new Set(['modiv-consideration-2-1', 'modiv-termination-fee-7-3']);
const replayIds = new Set(['skechers-no-other-reps-3-28', 'topbuild-termination-company-6-3']);
const solIds = new Set(['topbuild-ioc-company-4-1', 'topbuild-no-shop-company-4-3']);

function fixture() {
  const execution = {
    execution_result_id: hash('a'),
    work_results: manifest.work_items.map((item, index) => ({
      work_item_id: item.work_item_id,
      work_result_id: hash(String(index + 1)),
    })),
  };
  const gate = { quality_gate_id: hash('b') };
  const vector = {
    schema_version: 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3', content_hash: hash('c'),
    bindings: { first_execution_result_id: execution.execution_result_id, quality_gate_id: gate.quality_gate_id },
    decisions: manifest.work_items.map((item) => ({
      work_item_id: item.work_item_id,
      action: retainedIds.has(item.work_item_id) ? 'RETAIN' : replayIds.has(item.work_item_id) ? 'REPLAY_ONLY' : 'LIVE',
      profile_id: retainedIds.has(item.work_item_id) || replayIds.has(item.work_item_id) ? null : solIds.has(item.work_item_id) ? 'SOL_HIGH' : 'TERRA_MEDIUM',
    })),
  };
  return { execution, gate, vector };
}

function fakePlanner({ first_execution_result: execution, aggregate_gate: gate }) {
  const checkpoints = execution.work_results.map((result, index) => ({
    work_item_id: result.work_item_id, work_result_id: result.work_result_id,
    checkpoint_id: hash(String(index + 3)), provider_recording_id: hash(String(index + 5)),
  }));
  const item = (id) => manifest.work_items.find((row) => row.work_item_id === id);
  const live = manifest.work_items.filter((row) => !retainedIds.has(row.work_item_id) && !replayIds.has(row.work_item_id));
  return {
    iteration_2_rerun_plan_id: hash('d'), first_execution_result_id: execution.execution_result_id, quality_gate_id: gate.quality_gate_id,
    preserved_checkpoint_set: { checkpoints },
    archived_replaced_work_items: execution.work_results.filter((row) => !retainedIds.has(row.work_item_id)),
    replay_only_work_items: [...replayIds].map((id) => ({ work_item_id: id })),
    live_terra_work_items: live.filter((row) => !solIds.has(row.work_item_id)).map((row) => item(row.work_item_id)),
    live_sol_work_items: live.filter((row) => solIds.has(row.work_item_id)).map((row) => item(row.work_item_id)),
    new_controls: { schema_version: 'NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS/V1', work_item_controls: manifest.work_items.map((row) => ({
      work_item_id: row.work_item_id, profile_id: solIds.has(row.work_item_id) ? 'SOL_HIGH' : 'TERRA_MEDIUM', covenant_side: row.family_id === 'INTERIM_OPERATING' ? 'TARGET' : null,
    })) },
  };
}

test('materialises the full plan, two replays, eight-item live inputs and sealed ledger without a model', async () => {
  const { execution, gate, vector } = fixture();
  const writes = [];
  const result = await materialiseAttempt3({
    first_execution_result: execution, aggregate_gate: gate, original_manifest: manifest,
    checkpoint_directory: '/sealed/checkpoints', revised_vector: vector, root_dir: ROOT,
    write_artifact: async (artifact) => writes.push(artifact.path),
    dependencies: {
      plan_iteration_2_rerun: fakePlanner,
      replay_retained_provider_output: async ({ plan, work_item_id }) => ({
        iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id, work_item_id,
        replay_result_id: hash(work_item_id.startsWith('skechers') ? 'e' : 'f'), model_call_count: 0,
      }),
    },
  });
  assert.equal(result.live_manifest.work_items.length, 8);
  assert.equal(result.live_controls.work_item_controls.length, 8);
  assert.equal(result.replay_results.length, 2);
  assert.equal(result.ledger.retained_items.length, 2);
  assert.equal(result.ledger.actual_model_call_count, 0);
  assert.equal(result.placeholders.review_items.length, 8);
  assert.deepEqual(writes, [
    'sealed-rerun-plan.json', 'live-only-manifest.json', 'live-only-controls.json',
    'replay-results/skechers-no-other-reps-3-28.json', 'replay-results/topbuild-termination-company-6-3.json',
    'review-package-placeholders.json', 'sealed-ledger.json',
  ]);
});

test('fails closed when the V3 vector and recomputed gate do not match', async () => {
  const { execution, gate, vector } = fixture();
  vector.bindings.quality_gate_id = hash('z');
  await assert.rejects(
    () => materialiseAttempt3({
      first_execution_result: execution, aggregate_gate: gate, original_manifest: manifest,
      checkpoint_directory: '/sealed/checkpoints', revised_vector: vector, root_dir: ROOT,
      write_artifact: async () => {}, dependencies: { plan_iteration_2_rerun: fakePlanner },
    }),
    (error) => error instanceof Attempt3MaterialiserError && error.code === 'INVALID_REVISED_VECTOR',
  );
});
