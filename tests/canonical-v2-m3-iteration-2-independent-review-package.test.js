'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  buildIteration2IndependentReviewInput,
  validateIteration2IndependentReviewReadiness,
} = require('../lib/canonical-v2/native-producer/m3-iteration-2-independent-review-package');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(
  ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
), 'utf8'));
const digest = (value) => value.repeat(64).slice(0, 64);
const replayIds = new Set([
  'modiv-consideration-2-1', 'modiv-termination-fee-7-3',
  'skechers-no-other-reps-3-28', 'topbuild-termination-company-6-3',
]);

function fixtures() {
  const execution = digest('a');
  const checklistItems = manifest.work_items.filter((item) => ![
    'modiv-consideration-2-1', 'modiv-termination-fee-7-3',
  ].includes(item.work_item_id)).map((item) => ({ work_item_id: item.work_item_id }));
  const vector = {
    schema_version: 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V1', content_hash: digest('b'),
    bindings: {
      first_execution_result_id: execution,
      acceptance_checklist: { content_hash: digest('c') },
      adjudications: [
        { work_item_id: 'modiv-consideration-2-1', adjudication_id: digest('d'), review_packet_id: digest('e') },
        { work_item_id: 'modiv-termination-fee-7-3', adjudication_id: digest('f'), review_packet_id: digest('0') },
      ],
    },
    decisions: manifest.work_items.map((item) => ({
      work_item_id: item.work_item_id,
      action: replayIds.has(item.work_item_id) ? 'REPLAY_ONLY' : 'LIVE',
      profile_id: replayIds.has(item.work_item_id) ? null : 'TERRA_MEDIUM',
    })),
  };
  const checklist = {
    schema_version: 'M3_MODEL_RERUN_ACCEPTANCE_CHECKLIST/V1', execution_result_id: execution,
    content_hash: digest('c'), items: checklistItems,
  };
  const replays = {
    actual_model_call_count: 0,
    outputs: manifest.work_items.filter((item) => replayIds.has(item.work_item_id)).map((item, index) => ({
      work_item_id: item.work_item_id,
      replay_result_id: digest(String(index + 1)),
      first_pass_checkpoint_id: digest(String(index + 5)),
      provider_recording_id: digest(String(index + 9)),
    })),
  };
  return { vector, checklist, replays };
}

test('builds twelve review items with four retained outputs and eight bound live placeholders', () => {
  const input = buildIteration2IndependentReviewInput({
    revised_decision_vector: fixtures().vector,
    sealed_acceptance_checklist: fixtures().checklist,
    replay_only_outputs: fixtures().replays,
    root_dir: ROOT,
  });
  assert.equal(input.review_items.length, 12);
  assert.equal(input.review_items.filter((item) => item.final_output_state === 'AVAILABLE_REPLAY_OUTPUT').length, 4);
  assert.equal(input.review_items.filter((item) => item.final_output_state === 'PENDING_LIVE_OUTPUT').length, 8);
  assert.equal(input.review_items.find((item) => item.work_item_id === 'modiv-consideration-2-1').review_binding.binding_kind, 'SEALED_ADJUDICATION');
  assert.equal(input.review_items.find((item) => item.work_item_id === 'topbuild-no-shop-company-4-3').review_binding.binding_kind, 'SEALED_ACCEPTANCE_CHECKLIST');
});

test('fails closed until all eight live outputs are supplied', () => {
  const fixture = fixtures();
  const input = buildIteration2IndependentReviewInput({
    revised_decision_vector: fixture.vector, sealed_acceptance_checklist: fixture.checklist,
    replay_only_outputs: fixture.replays, root_dir: ROOT,
  });
  const blocked = validateIteration2IndependentReviewReadiness({ independent_review_input: input });
  assert.equal(blocked.review_start_state, 'BLOCKED_LIVE_OUTPUTS_MISSING');
  assert.equal(blocked.missing_live_output_work_item_ids.length, 8);
  const ready = validateIteration2IndependentReviewReadiness({
    independent_review_input: input,
    live_outputs: blocked.missing_live_output_work_item_ids.map((work_item_id, index) => ({ work_item_id, final_output_id: digest(String(index + 1)) })),
  });
  assert.equal(ready.review_start_state, 'READY');
});

test('rejects a replay output substituted for a live decision', () => {
  const fixture = fixtures();
  fixture.replays.outputs.push({
    work_item_id: 'topbuild-no-shop-company-4-3', replay_result_id: digest('a'),
    first_pass_checkpoint_id: digest('b'), provider_recording_id: digest('c'),
  });
  assert.throws(
    () => buildIteration2IndependentReviewInput({
      revised_decision_vector: fixture.vector, sealed_acceptance_checklist: fixture.checklist,
      replay_only_outputs: fixture.replays, root_dir: ROOT,
    }),
    /live decision cannot be substituted/i,
  );
});
