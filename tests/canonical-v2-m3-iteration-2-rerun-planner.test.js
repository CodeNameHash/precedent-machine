'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  CHECKPOINT_SCHEMA,
  EXECUTION_RESULT_SCHEMA,
  PROVIDER_RECORDING_SCHEMA,
  VALIDATION_EVIDENCE_SCHEMA,
  WORK_RESULT_SCHEMA,
} = require('../lib/canonical-v2/native-producer/unified-runner-execute');
const {
  ITERATION_2_PROFILE_DECISIONS_SCHEMA,
  Iteration2RerunPlannerError,
  planIteration2Rerun,
} = require('../lib/canonical-v2/native-producer/m3-iteration-2-rerun-planner');
const { PILOT_WORK_ITEM_SET_ID } = require('../lib/canonical-v2/native-producer/m3-12-call-pilot-quality-gate');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
), 'utf8'));

function providerRecording(item) {
  const providerOutput = {
    provider_id: 'RETAINED_TEST_PROVIDER',
    model_id: 'retained-test-model',
    prompt: 'retained provider response',
    proposals: [],
    evidence_residuals: [],
    raw_response_text: '{"open_world_candidates":[]}',
    raw_response_length: 28,
    attempts: 1,
  };
  const body = {
    schema_version: PROVIDER_RECORDING_SCHEMA,
    work_item_id: item.work_item_id,
    provider_output: providerOutput,
  };
  return { ...body, provider_recording_id: contentId(PROVIDER_RECORDING_SCHEMA, body) };
}

function workResult(item) {
  const body = {
    schema_version: WORK_RESULT_SCHEMA,
    work_item_id: item.work_item_id,
    source_id: item.source_id,
    family_id: item.family_id,
    profile_id: 'TERRA_MEDIUM',
    status: 'SUCCEEDED',
    failure_code: null,
    failure_stage: null,
    run_receipt: {
      compiled_candidates: [{ ok: true, candidate_id: `candidate:${item.work_item_id}` }],
      compiled_candidate_count: 1,
      evidence_residual_count: 0,
      scope_violation_count: 0,
      citation_residual_count: 0,
    },
    resolution: {
      open_world: [],
      review_queue: [],
      resolution_receipt: { counts: { open_world: 0, review_queue: 0 } },
    },
    provider_recording: providerRecording(item),
  };
  return { ...body, work_result_id: contentId(WORK_RESULT_SCHEMA, body) };
}

function fixtureExecutionResult() {
  const workResults = MANIFEST.work_items.map(workResult);
  const validationReceiptId = contentId('test-validation-receipt', MANIFEST.work_items);
  const semanticManifestId = contentId('test-semantic-manifest', MANIFEST.work_items);
  const executionPlanId = contentId('test-execution-plan', MANIFEST.work_items);
  const validationEvidence = { schema_version: VALIDATION_EVIDENCE_SCHEMA, fixture: true };
  const body = {
    schema_version: EXECUTION_RESULT_SCHEMA,
    validation_receipt_id: validationReceiptId,
    semantic_manifest_id: semanticManifestId,
    execution_plan_id: executionPlanId,
    contract_fingerprint: 'fixture-contract-fingerprint',
    validation_evidence: validationEvidence,
    work_results: workResults,
    succeeded_count: workResults.length,
    failed_count: 0,
  };
  return { ...body, execution_result_id: contentId(EXECUTION_RESULT_SCHEMA, body) };
}

function aggregateGate(selectedIds) {
  const body = {
    schema_version: 'M3_12_CALL_PILOT_QUALITY_GATE/V1',
    pilot_work_item_set_id: PILOT_WORK_ITEM_SET_ID,
    gate_status: 'FAIL',
    selected_present_work_item_ids: [...selectedIds].sort(),
    work_item_findings: [...selectedIds].sort().map((work_item_id) => ({
      work_item_id,
      deterministic_failure_codes: [],
      unresolved_output_codes: [],
      independent_review_status: 'PASS',
    })),
    rerun_work_item_ids: ['modiv-mae-definition-8-12-g'],
    escalation_work_item_ids: [
      'modiv-mae-definition-8-12-g',
      'topbuild-no-shop-company-4-3',
      'topbuild-remedies-specific-performance-7-6',
    ],
  };
  return { ...body, quality_gate_id: contentId(body.schema_version, body) };
}

function profileDecisions(execution, gate, overrides = {}) {
  return {
    schema_version: ITERATION_2_PROFILE_DECISIONS_SCHEMA,
    first_execution_result_id: execution.execution_result_id,
    quality_gate_id: gate.quality_gate_id,
    decisions: MANIFEST.work_items.map((item) => overrides[item.work_item_id] || {
      work_item_id: item.work_item_id,
      action: 'RETAIN',
      profile_id: null,
    }),
  };
}

function writeCheckpoints(execution) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'm3-iteration-2-checkpoints-'));
  for (const result of execution.work_results) {
    const body = {
      schema_version: CHECKPOINT_SCHEMA,
      validation_receipt_id: execution.validation_receipt_id,
      semantic_manifest_id: execution.semantic_manifest_id,
      execution_plan_id: execution.execution_plan_id,
      contract_fingerprint: execution.contract_fingerprint,
      work_result: result,
    };
    const checkpoint = { ...body, checkpoint_id: contentId(CHECKPOINT_SCHEMA, body) };
    fs.writeFileSync(path.join(directory, `${checkpoint.checkpoint_id}.json`), JSON.stringify(checkpoint));
  }
  return directory;
}

function planFixture() {
  const execution = EXECUTION;
  const gate = aggregateGate(MANIFEST.work_items.map((item) => item.work_item_id));
  const decisions = profileDecisions(execution, gate, {
    'modiv-mae-definition-8-12-g': {
      work_item_id: 'modiv-mae-definition-8-12-g', action: 'REPLAY_ONLY', profile_id: null,
    },
    'topbuild-remedies-specific-performance-7-6': {
      work_item_id: 'topbuild-remedies-specific-performance-7-6', action: 'LIVE', profile_id: 'TERRA_MEDIUM',
    },
    'topbuild-no-shop-company-4-3': {
      work_item_id: 'topbuild-no-shop-company-4-3', action: 'LIVE', profile_id: 'SOL_HIGH',
    },
  });
  return { execution, gate, decisions, checkpoints: writeCheckpoints(execution) };
}

const EXECUTION = fixtureExecutionResult();

test('plans an exact retained checkpoint archive, one no-model replay, and the declared Terra/Sol calls', () => {
  const fixture = planFixture();
  try {
    const plan = planIteration2Rerun({
      first_execution_result: fixture.execution,
      aggregate_gate: fixture.gate,
      profile_decisions: fixture.decisions,
      current_checkpoint_directory: fixture.checkpoints,
      root_dir: ROOT,
    });
    assert.equal(plan.preserved_checkpoint_set.checkpoints.length, 12);
    assert.equal(plan.archived_replaced_work_items.length, 3);
    assert.deepEqual(plan.replay_only_work_items.map((item) => item.work_item_id), ['modiv-mae-definition-8-12-g']);
    assert.deepEqual(plan.live_terra_work_items.map((item) => item.work_item_id), ['topbuild-remedies-specific-performance-7-6']);
    assert.deepEqual(plan.live_sol_work_items.map((item) => item.work_item_id), ['topbuild-no-shop-company-4-3']);
    assert.equal(plan.controls.first_pass_artifact_mutation, 'FORBIDDEN');
    assert.equal(plan.controls.checkpoint_deletion, 'FORBIDDEN');
    assert.equal(plan.controls.live_model_call_count, 2);
    assert.equal(plan.new_controls.schema_version, 'NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS/V1');
    assert.equal(plan.new_controls.work_item_controls.length, 12);
    assert.equal(fs.readdirSync(fixture.checkpoints).length, 12);
  } finally {
    fs.rmSync(fixture.checkpoints, { recursive: true, force: true });
  }
});

test('fails closed when an actionable item is retained or a first-pass checkpoint is missing', () => {
  const fixture = planFixture();
  try {
    const retained = profileDecisions(fixture.execution, fixture.gate, {
      'modiv-mae-definition-8-12-g': {
        work_item_id: 'modiv-mae-definition-8-12-g', action: 'RETAIN', profile_id: null,
      },
      'topbuild-remedies-specific-performance-7-6': {
        work_item_id: 'topbuild-remedies-specific-performance-7-6', action: 'LIVE', profile_id: 'TERRA_MEDIUM',
      },
      'topbuild-no-shop-company-4-3': {
        work_item_id: 'topbuild-no-shop-company-4-3', action: 'LIVE', profile_id: 'SOL_HIGH',
      },
    });
    assert.throws(
      () => planIteration2Rerun({
        first_execution_result: fixture.execution, aggregate_gate: fixture.gate,
        profile_decisions: retained, current_checkpoint_directory: fixture.checkpoints, root_dir: ROOT,
      }),
      (error) => error instanceof Iteration2RerunPlannerError && error.code === 'ACTIONABLE_WORK_ITEM_RETAINED',
    );
    fs.unlinkSync(path.join(fixture.checkpoints, fs.readdirSync(fixture.checkpoints)[0]));
    assert.throws(
      () => planIteration2Rerun({
        first_execution_result: fixture.execution, aggregate_gate: fixture.gate,
        profile_decisions: fixture.decisions, current_checkpoint_directory: fixture.checkpoints, root_dir: ROOT,
      }),
      (error) => error instanceof Iteration2RerunPlannerError && error.code === 'CHECKPOINT_SET_MISMATCH',
    );
  } finally {
    fs.rmSync(fixture.checkpoints, { recursive: true, force: true });
  }
});

test('replay-only work retains the original provider recording and declares zero model calls', () => {
  const fixture = planFixture();
  try {
    const plan = planIteration2Rerun({
      first_execution_result: fixture.execution, aggregate_gate: fixture.gate,
      profile_decisions: fixture.decisions, current_checkpoint_directory: fixture.checkpoints, root_dir: ROOT,
    });
    const replay = plan.replay_only_work_items[0];
    assert.equal(replay.model_call_count, 0);
    assert.equal(replay.provider_recording_id, fixture.execution.work_results.find(
      (item) => item.work_item_id === 'modiv-mae-definition-8-12-g',
    ).provider_recording.provider_recording_id);
  } finally {
    fs.rmSync(fixture.checkpoints, { recursive: true, force: true });
  }
});

test('planner has no model, network, database or deletion authority imports', () => {
  const source = fs.readFileSync(path.join(
    ROOT,
    'lib/canonical-v2/native-producer/m3-iteration-2-rerun-planner.js',
  ), 'utf8');
  assert.doesNotMatch(source, /codex-cli-provider|anthropic-provider|provider-interface|node:https|node:http|\bfetch\s*\(|supabase|unlinkSync|rmSync|writeFileSync/);
  assert.match(source, /provider:\s*async \(\) => providerOutput/);
});
