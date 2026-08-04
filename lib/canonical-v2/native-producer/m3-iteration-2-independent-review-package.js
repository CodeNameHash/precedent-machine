'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const { PILOT_WORK_ITEM_SET_ID, loadPilotWorkItems } = require('./m3-12-call-pilot-quality-gate');

const REVIEW_PACKAGE_SCHEMA = 'M3_12_CALL_ITERATION_2_INDEPENDENT_REVIEW_INPUT/V1';
const REVIEW_READINESS_SCHEMA = 'M3_12_CALL_ITERATION_2_INDEPENDENT_REVIEW_READINESS/V1';
const REVISED_DECISION_SCHEMA = 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3';
const ACCEPTANCE_CHECKLIST_SCHEMA = 'M3_MODEL_RERUN_ACCEPTANCE_CHECKLIST/V2';
const RERUN_PLAN_SCHEMA = 'M3_12_CALL_ITERATION_2_RERUN_PLAN/V1';
const PRESERVED_CHECKPOINT_SET_SCHEMA = 'M3_12_CALL_ITERATION_2_PRESERVED_CHECKPOINT_SET/V1';
const REPLAY_RESULT_SCHEMA = 'M3_12_CALL_ITERATION_2_REPLAY_RESULT/V1';
const REVIEW_PACKET_SCHEMA = 'M3_12_CALL_PILOT_REVIEW_PACKET/V1';
const PILOT_ADJUDICATION_SCHEMA = 'M3_PILOT_UNRESOLVED_OUTPUT_ADJUDICATION/V1';
const ADJUDICATION_DISPOSITIONS = new Set([
  'REVIEWED_OPEN_WORLD',
  'DEFINED_TERM_ONLY_NO_NUMERIC_PUBLICATION',
  'DEFERRED_TO_GOVERNED_OWNER',
]);

class Iteration2IndependentReviewPackageError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new Iteration2IndependentReviewPackageError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function digest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function sealedId(value, schema, field, code, message) {
  if (!value || typeof value !== 'object' || !digest(value[field])) fail(code, message);
  const body = { ...value };
  delete body[field];
  if (contentId(schema, body) !== value[field]) fail(code, message);
}

function indexUnique(rows, label, expectedIds) {
  if (!Array.isArray(rows)) fail('INVALID_REVIEW_INPUT', `${label} must be an array.`);
  const indexed = new Map();
  for (const row of rows) {
    if (!row || typeof row.work_item_id !== 'string' || indexed.has(row.work_item_id)
      || (expectedIds && !expectedIds.has(row.work_item_id))) {
      fail('INVALID_REVIEW_INPUT', `${label} must contain unique original work-item IDs.`);
    }
    indexed.set(row.work_item_id, row);
  }
  return indexed;
}

function sameIds(rows, expectedIds) {
  return rows.size === expectedIds.size && [...rows.keys()].every((id) => expectedIds.has(id));
}

function validateDecisionVector(vector, expectedIds) {
  if (!vector || vector.schema_version !== REVISED_DECISION_SCHEMA || !digest(vector.content_hash)
    || !vector.bindings || !digest(vector.bindings.first_execution_result_id)
    || !digest(vector.bindings.quality_gate_id) || !digest(vector.bindings.iteration_2_rerun_plan_id)
    || !digest(vector.bindings.preserved_checkpoint_set_id)
    || !vector.bindings.acceptance_checklist
    || vector.bindings.acceptance_checklist.schema_version !== ACCEPTANCE_CHECKLIST_SCHEMA
    || !digest(vector.bindings.acceptance_checklist.content_hash)) {
    fail('INVALID_REVISED_DECISION_VECTOR', 'The V3 decision vector must retain sealed execution, plan and acceptance bindings.');
  }
  sealedId(vector, REVISED_DECISION_SCHEMA, 'content_hash', 'REVISED_DECISION_VECTOR_ID_MISMATCH', 'The V3 decision vector content hash does not match its contents.');
  const decisions = indexUnique(vector.decisions, 'revised decisions', expectedIds);
  if (!sameIds(decisions, expectedIds)) fail('DECISION_VECTOR_INCOMPLETE', 'The revised decision vector must cover every pilot item.');
  for (const decision of decisions.values()) {
    if (!['RETAIN', 'REPLAY_ONLY', 'LIVE'].includes(decision.action)
      || typeof decision.basis !== 'string' || !decision.basis
      || (decision.action === 'LIVE' && !['TERRA_MEDIUM', 'SOL_HIGH'].includes(decision.profile_id))
      || (decision.action !== 'LIVE' && decision.profile_id !== null)) {
      fail('INVALID_REVISED_DECISION_VECTOR', 'Every V3 decision must have a valid retained, replay-only or live disposition.');
    }
  }
  return decisions;
}

function validateAcceptanceChecklist(checklist, vector, decisions) {
  if (!checklist || checklist.schema_version !== ACCEPTANCE_CHECKLIST_SCHEMA
    || checklist.execution_result_id !== vector.bindings.first_execution_result_id
    || checklist.content_hash !== vector.bindings.acceptance_checklist.content_hash
    || !digest(checklist.supersedes_content_hash) || !digest(checklist.independent_review_findings_id)) {
    fail('INVALID_ACCEPTANCE_CHECKLIST', 'The V2 acceptance checklist must be sealed to the V3 execution and acceptance bindings.');
  }
  sealedId(checklist, ACCEPTANCE_CHECKLIST_SCHEMA, 'content_hash', 'ACCEPTANCE_CHECKLIST_ID_MISMATCH', 'The V2 acceptance checklist content hash does not match its contents.');
  const expected = new Set([...decisions.values()]
    .filter((decision) => decision.action !== 'RETAIN')
    .map((decision) => decision.work_item_id));
  const items = indexUnique(checklist.items, 'acceptance checklist items', expected);
  if (!sameIds(items, expected)) {
    fail('ACCEPTANCE_CHECKLIST_COVERAGE_MISMATCH', 'The V2 acceptance checklist must cover every replay-only and live item, and no retained item.');
  }
  return items;
}

function validatePlan(plan, vector) {
  if (!plan || plan.schema_version !== RERUN_PLAN_SCHEMA
    || plan.iteration_2_rerun_plan_id !== vector.bindings.iteration_2_rerun_plan_id
    || plan.first_execution_result_id !== vector.bindings.first_execution_result_id
    || plan.quality_gate_id !== vector.bindings.quality_gate_id
    || !plan.preserved_checkpoint_set
    || plan.preserved_checkpoint_set.schema_version !== PRESERVED_CHECKPOINT_SET_SCHEMA
    || plan.preserved_checkpoint_set.preserved_checkpoint_set_id !== vector.bindings.preserved_checkpoint_set_id) {
    fail('INVALID_RERUN_PLAN', 'The rerun plan must bind the exact V3 execution, gate and preserved-checkpoint set.');
  }
  sealedId(plan, RERUN_PLAN_SCHEMA, 'iteration_2_rerun_plan_id', 'RERUN_PLAN_ID_MISMATCH', 'The rerun plan identity does not match its sealed contents.');
  sealedId(plan.preserved_checkpoint_set, PRESERVED_CHECKPOINT_SET_SCHEMA, 'preserved_checkpoint_set_id', 'CHECKPOINT_SET_ID_MISMATCH', 'The preserved checkpoint-set identity does not match its sealed contents.');
  const checkpoints = indexUnique(plan.preserved_checkpoint_set.checkpoints, 'preserved checkpoints');
  const replayRows = indexUnique(plan.replay_only_work_items, 'plan replay-only items');
  const archived = indexUnique(plan.archived_replaced_work_items, 'archived replacement items');
  const live = indexUnique([
    ...(Array.isArray(plan.live_terra_work_items) ? plan.live_terra_work_items : []),
    ...(Array.isArray(plan.live_sol_work_items) ? plan.live_sol_work_items : []),
  ], 'plan live items');
  return Object.freeze({ checkpoints, replayRows, archived, live });
}

function validateFirstPassResults(firstExecutionResult, vector, expectedIds) {
  if (!firstExecutionResult || firstExecutionResult.execution_result_id !== vector.bindings.first_execution_result_id) {
    fail('INVALID_FIRST_EXECUTION_RESULT', 'The supplied first execution result does not match the V3 execution binding.');
  }
  const results = indexUnique(firstExecutionResult.work_results, 'first-pass work results', expectedIds);
  if (!sameIds(results, expectedIds)) fail('FIRST_EXECUTION_RESULT_INCOMPLETE', 'The first execution result must retain every pilot work item.');
  for (const result of results.values()) {
    if (!digest(result.work_result_id) || !digest(result.provider_recording?.provider_recording_id)) {
      fail('INVALID_FIRST_EXECUTION_RESULT', 'Each first-pass work result must retain exact work-result and provider-recording identities.');
    }
  }
  return results;
}

function unresolvedRows(packet) {
  const output = packet && packet.resolved_output;
  if (!output || !Array.isArray(output.open_world) || !Array.isArray(output.review_queue)) return null;
  const rows = [
    ...output.open_world.map((entry) => ({ closure_id: entry?.closure_id, output_kind: 'OPEN_WORLD' })),
    ...output.review_queue.map((entry) => ({ closure_id: entry?.closure_id, output_kind: 'REVIEW_QUEUE' })),
  ].sort((left, right) => `${left.output_kind}:${left.closure_id}`.localeCompare(`${right.output_kind}:${right.closure_id}`));
  if (rows.some((row) => typeof row.closure_id !== 'string' || !row.closure_id)
    || new Set(rows.map((row) => `${row.output_kind}:${row.closure_id}`)).size !== rows.length) return null;
  return rows;
}

function validateRetainedAdjudications(records, vector, decisions) {
  const retainedIds = new Set([...decisions.values()]
    .filter((decision) => decision.action === 'RETAIN')
    .map((decision) => decision.work_item_id));
  const bindings = indexUnique(vector.bindings.adjudications, 'V3 adjudication bindings', retainedIds);
  if (!sameIds(bindings, retainedIds)) fail('RETAINED_ADJUDICATION_MISSING', 'Every retained V3 decision must bind one sealed adjudication.');
  if (!Array.isArray(records)) fail('INVALID_RETAINED_ADJUDICATIONS', 'Retained work items require their validated adjudications.');
  const byId = new Map();
  for (const record of records) {
    const adjudication = record?.adjudication;
    const packet = record?.review_packet;
    const workItemId = adjudication?.work_item_id;
    if (!retainedIds.has(workItemId) || byId.has(workItemId)
      || !packet || packet.schema_version !== REVIEW_PACKET_SCHEMA
      || packet.work_item_id !== workItemId || packet.provenance?.execution_result_id !== vector.bindings.first_execution_result_id
      || !digest(packet.review_packet_id) || !adjudication || adjudication.schema_version !== PILOT_ADJUDICATION_SCHEMA
      || adjudication.execution_result_id !== vector.bindings.first_execution_result_id
      || adjudication.reviewer_disposition !== 'PASS' || !digest(adjudication.adjudication_id)) {
      fail('INVALID_RETAINED_ADJUDICATION', 'A retained work item must provide one validated adjudication and its exact first-pass review packet.');
    }
    sealedId(packet, REVIEW_PACKET_SCHEMA, 'review_packet_id', 'RETAINED_REVIEW_PACKET_ID_MISMATCH', 'A retained review-packet identity does not match its sealed contents.');
    sealedId(adjudication, PILOT_ADJUDICATION_SCHEMA, 'adjudication_id', 'RETAINED_ADJUDICATION_ID_MISMATCH', 'A retained adjudication identity does not match its sealed contents.');
    const expectedUnresolved = unresolvedRows(packet);
    const actualUnresolved = Array.isArray(adjudication.unresolved_items)
      ? adjudication.unresolved_items.map((entry) => ({
        closure_id: entry?.closure_id,
        output_kind: entry?.output_kind,
        disposition: entry?.disposition,
      })).sort((left, right) => `${left.output_kind}:${left.closure_id}`.localeCompare(`${right.output_kind}:${right.closure_id}`))
      : null;
    const binding = bindings.get(workItemId);
    if (!expectedUnresolved || !actualUnresolved || actualUnresolved.length !== expectedUnresolved.length
      || actualUnresolved.some((entry, index) => entry.closure_id !== expectedUnresolved[index].closure_id
        || entry.output_kind !== expectedUnresolved[index].output_kind
        || !ADJUDICATION_DISPOSITIONS.has(entry.disposition))
      || adjudication.review_packet_id !== packet.review_packet_id
      || adjudication.adjudication_id !== binding.adjudication_id
      || packet.review_packet_id !== binding.review_packet_id) {
      fail('RETAINED_ADJUDICATION_INVALID', 'A retained adjudication must validate every unresolved item in its exact first-pass review packet.');
    }
    byId.set(workItemId, Object.freeze({ adjudication, packet }));
  }
  if (!sameIds(byId, retainedIds)) fail('RETAINED_ADJUDICATION_MISSING', 'Every retained V3 decision must provide its validated adjudication.');
  return byId;
}

function normaliseReplayOutputs(outputs, vector) {
  const rows = Array.isArray(outputs) ? outputs : outputs?.outputs;
  if (!Array.isArray(rows) || (outputs && !Array.isArray(outputs)
    && (outputs.actual_model_call_count !== 0 || outputs.iteration_2_rerun_plan_id !== vector.bindings.iteration_2_rerun_plan_id))) {
    fail('INVALID_REPLAY_OUTPUTS', 'Replay outputs must prove zero model calls and bind the sealed V3 rerun plan.');
  }
  return rows;
}

function validateReplayOutputs(outputs, decisions, vector, planState) {
  const replayIds = new Set([...decisions.values()]
    .filter((decision) => decision.action === 'REPLAY_ONLY')
    .map((decision) => decision.work_item_id));
  const replayRows = indexUnique(normaliseReplayOutputs(outputs, vector), 'replay outputs', replayIds);
  if (!sameIds(replayRows, replayIds)) fail('REPLAY_OUTPUT_MISSING', 'Every replay-only decision must retain its plan-specific replay result.');
  for (const [workItemId, replay] of replayRows) {
    const planReplay = planState.replayRows.get(workItemId);
    const checkpoint = planState.checkpoints.get(workItemId);
    if (!planReplay || !checkpoint || replay.schema_version !== REPLAY_RESULT_SCHEMA
      || replay.iteration_2_rerun_plan_id !== vector.bindings.iteration_2_rerun_plan_id
      || replay.work_item_id !== workItemId || replay.model_call_count !== 0
      || !digest(replay.replay_result_id) || replay.first_work_result_id !== planReplay.first_work_result_id
      || replay.provider_recording_id !== planReplay.provider_recording_id
      || checkpoint.checkpoint_id !== planReplay.preserved_checkpoint_id
      || checkpoint.work_result_id !== planReplay.first_work_result_id
      || checkpoint.provider_recording_id !== planReplay.provider_recording_id) {
      fail('REPLAY_OUTPUT_PLAN_MISMATCH', 'A replay-only item must bind its exact zero-model replay result to the sealed rerun plan.');
    }
    sealedId(replay, REPLAY_RESULT_SCHEMA, 'replay_result_id', 'REPLAY_OUTPUT_ID_MISMATCH', 'A replay result identity does not match its sealed contents.');
  }
  return replayRows;
}

function buildIteration2IndependentReviewInput({
  revised_decision_vector: vector,
  sealed_acceptance_checklist: checklist,
  iteration_2_rerun_plan: plan,
  first_execution_result: firstExecutionResult,
  validated_retained_adjudications: retainedAdjudications,
  replay_only_outputs: replayOutputs,
  root_dir: rootDir = process.cwd(),
} = {}) {
  const workItems = loadPilotWorkItems({ root_dir: rootDir });
  const expectedIds = new Set(workItems.map((item) => item.work_item_id));
  const decisions = validateDecisionVector(vector, expectedIds);
  const acceptance = validateAcceptanceChecklist(checklist, vector, decisions);
  const planState = validatePlan(plan, vector);
  const firstResults = validateFirstPassResults(firstExecutionResult, vector, expectedIds);
  const adjudications = validateRetainedAdjudications(retainedAdjudications, vector, decisions);
  const replayRows = validateReplayOutputs(replayOutputs, decisions, vector, planState);
  const reviewItems = workItems.map((workItem) => {
    const decision = decisions.get(workItem.work_item_id);
    if (decision.action === 'RETAIN') {
      const checkpoint = planState.checkpoints.get(workItem.work_item_id);
      const result = firstResults.get(workItem.work_item_id);
      const adjudication = adjudications.get(workItem.work_item_id);
      if (!checkpoint || !result || planState.archived.has(workItem.work_item_id)
        || planState.replayRows.has(workItem.work_item_id) || planState.live.has(workItem.work_item_id)
        || checkpoint.work_result_id !== result.work_result_id
        || checkpoint.provider_recording_id !== result.provider_recording.provider_recording_id) {
        fail('RETAINED_IDENTITY_MISMATCH', 'A retained item must bind its exact first work result, checkpoint and provider recording.');
      }
      return Object.freeze({
        work_item_id: workItem.work_item_id,
        family_id: workItem.family_id,
        final_output_state: 'AVAILABLE_RETAINED_FIRST_PASS_OUTPUT',
        final_output_id: result.work_result_id,
        first_pass_checkpoint_id: checkpoint.checkpoint_id,
        provider_recording_id: checkpoint.provider_recording_id,
        review_binding: Object.freeze({
          binding_kind: 'VALIDATED_PILOT_ADJUDICATION',
          adjudication_id: adjudication.adjudication.adjudication_id,
          review_packet_id: adjudication.packet.review_packet_id,
        }),
      });
    }
    if (decision.action === 'REPLAY_ONLY') {
      const replay = replayRows.get(workItem.work_item_id);
      const checkpoint = planState.checkpoints.get(workItem.work_item_id);
      return Object.freeze({
        work_item_id: workItem.work_item_id,
        family_id: workItem.family_id,
        final_output_state: 'AVAILABLE_REPLAY_OUTPUT',
        final_output_id: replay.replay_result_id,
        first_pass_checkpoint_id: checkpoint.checkpoint_id,
        provider_recording_id: replay.provider_recording_id,
        review_binding: Object.freeze({
          binding_kind: 'SEALED_ACCEPTANCE_CHECKLIST',
          acceptance_checklist_content_hash: checklist.content_hash,
        }),
      });
    }
    if (!acceptance.has(workItem.work_item_id) || !planState.live.has(workItem.work_item_id)) {
      fail('REVIEW_BINDING_MISSING', 'A planned live item must bind the V2 acceptance checklist and sealed live plan.');
    }
    return Object.freeze({
      work_item_id: workItem.work_item_id,
      family_id: workItem.family_id,
      final_output_state: 'PENDING_LIVE_OUTPUT',
      final_output_id: null,
      first_pass_checkpoint_id: null,
      provider_recording_id: null,
      review_binding: Object.freeze({
        binding_kind: 'SEALED_ACCEPTANCE_CHECKLIST',
        acceptance_checklist_content_hash: checklist.content_hash,
      }),
    });
  });
  const body = {
    schema_version: REVIEW_PACKAGE_SCHEMA,
    pilot_work_item_set_id: PILOT_WORK_ITEM_SET_ID,
    first_execution_result_id: vector.bindings.first_execution_result_id,
    revised_decision_vector_content_hash: vector.content_hash,
    acceptance_checklist_content_hash: checklist.content_hash,
    iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
    review_items: Object.freeze(reviewItems),
  };
  return Object.freeze({ ...body, independent_review_input_id: contentId(REVIEW_PACKAGE_SCHEMA, body) });
}

function validateIteration2IndependentReviewReadiness({
  independent_review_input: reviewInput,
  live_outputs: liveOutputs = [],
} = {}) {
  const keys = [
    'schema_version', 'pilot_work_item_set_id', 'first_execution_result_id',
    'revised_decision_vector_content_hash', 'acceptance_checklist_content_hash', 'iteration_2_rerun_plan_id',
    'review_items', 'independent_review_input_id',
  ];
  if (!exactKeys(reviewInput, keys) || reviewInput.schema_version !== REVIEW_PACKAGE_SCHEMA
    || reviewInput.pilot_work_item_set_id !== PILOT_WORK_ITEM_SET_ID
    || !digest(reviewInput.independent_review_input_id) || !digest(reviewInput.iteration_2_rerun_plan_id)
    || !Array.isArray(reviewInput.review_items)) {
    fail('INVALID_REVIEW_PACKAGE', 'The independent review input package is not closed or sealed.');
  }
  sealedId(reviewInput, REVIEW_PACKAGE_SCHEMA, 'independent_review_input_id', 'REVIEW_PACKAGE_ID_MISMATCH', 'The independent review input identity does not match its contents.');
  const expectedIds = new Set(reviewInput.review_items.map((item) => item.work_item_id));
  const validStates = new Set([
    'AVAILABLE_RETAINED_FIRST_PASS_OUTPUT',
    'AVAILABLE_REPLAY_OUTPUT',
    'PENDING_LIVE_OUTPUT',
  ]);
  if (expectedIds.size !== 12 || reviewInput.review_items.some((item) => !validStates.has(item.final_output_state))) {
    fail('INVALID_REVIEW_PACKAGE', 'The package must retain exactly twelve retained, replay or live-output review items.');
  }
  const supplied = indexUnique(liveOutputs, 'live outputs', expectedIds);
  for (const item of reviewInput.review_items.filter((item) => item.final_output_state !== 'PENDING_LIVE_OUTPUT')) {
    if (supplied.has(item.work_item_id)) {
      fail('LIVE_OUTPUT_OUT_OF_SCOPE', 'A retained or replay output cannot be substituted with a live output.', { work_item_id: item.work_item_id });
    }
  }
  const pending = reviewInput.review_items
    .filter((item) => item.final_output_state === 'PENDING_LIVE_OUTPUT')
    .filter((item) => !digest(supplied.get(item.work_item_id)?.final_output_id))
    .map((item) => item.work_item_id)
    .sort();
  const bodyResult = {
    schema_version: REVIEW_READINESS_SCHEMA,
    independent_review_input_id: reviewInput.independent_review_input_id,
    review_start_state: pending.length === 0 ? 'READY' : 'BLOCKED_LIVE_OUTPUTS_MISSING',
    missing_live_output_work_item_ids: Object.freeze(pending),
  };
  return Object.freeze({ ...bodyResult, independent_review_readiness_id: contentId(REVIEW_READINESS_SCHEMA, bodyResult) });
}

module.exports = {
  REVIEW_PACKAGE_SCHEMA,
  REVIEW_READINESS_SCHEMA,
  Iteration2IndependentReviewPackageError,
  buildIteration2IndependentReviewInput,
  validateIteration2IndependentReviewReadiness,
};
