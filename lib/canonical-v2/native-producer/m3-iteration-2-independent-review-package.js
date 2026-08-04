'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const { PILOT_WORK_ITEM_SET_ID, loadPilotWorkItems } = require('./m3-12-call-pilot-quality-gate');

const REVIEW_PACKAGE_SCHEMA = 'M3_12_CALL_ITERATION_2_INDEPENDENT_REVIEW_INPUT/V1';
const REVIEW_READINESS_SCHEMA = 'M3_12_CALL_ITERATION_2_INDEPENDENT_REVIEW_READINESS/V1';
const REVISED_DECISION_SCHEMA = 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V1';
const ACCEPTANCE_CHECKLIST_SCHEMA = 'M3_MODEL_RERUN_ACCEPTANCE_CHECKLIST/V1';

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

function validateDecisionVector(vector, expectedIds) {
  if (!vector || vector.schema_version !== REVISED_DECISION_SCHEMA || !digest(vector.content_hash)
    || !vector.bindings || !digest(vector.bindings.first_execution_result_id)
    || !vector.bindings.acceptance_checklist || !digest(vector.bindings.acceptance_checklist.content_hash)) {
    fail('INVALID_REVISED_DECISION_VECTOR', 'The revised decision vector must retain its sealed execution and acceptance bindings.');
  }
  const decisions = indexUnique(vector.decisions, 'revised decisions', expectedIds);
  if (decisions.size !== expectedIds.size) fail('DECISION_VECTOR_INCOMPLETE', 'The revised decision vector must cover every pilot item.');
  for (const decision of decisions.values()) {
    if (!['REPLAY_ONLY', 'LIVE'].includes(decision.action)
      || (decision.action === 'REPLAY_ONLY' && decision.profile_id !== null)
      || (decision.action === 'LIVE' && !['TERRA_MEDIUM', 'SOL_HIGH'].includes(decision.profile_id))) {
      fail('INVALID_REVISED_DECISION_VECTOR', 'Every revised decision must have a valid replay or live profile disposition.');
    }
  }
  return decisions;
}

function validateAcceptanceChecklist(checklist, executionResultId, expectedIds) {
  if (!checklist || checklist.schema_version !== ACCEPTANCE_CHECKLIST_SCHEMA
    || checklist.execution_result_id !== executionResultId || !digest(checklist.content_hash)) {
    fail('INVALID_ACCEPTANCE_CHECKLIST', 'The acceptance checklist must be sealed to the first execution result.');
  }
  return indexUnique(checklist.items, 'acceptance checklist items', expectedIds);
}

function validateReplayOutputs(outputs, decisions, executionResultId, expectedIds) {
  if (!outputs || outputs.actual_model_call_count !== 0 || !Array.isArray(outputs.outputs)) {
    fail('INVALID_REPLAY_OUTPUTS', 'Replay outputs must prove that no model call occurred.');
  }
  const replayRows = indexUnique(outputs.outputs, 'replay outputs', expectedIds);
  for (const [workItemId, decision] of decisions) {
    const replay = replayRows.get(workItemId);
    if (decision.action === 'REPLAY_ONLY' && (!replay || !digest(replay.replay_result_id)
      || !digest(replay.first_pass_checkpoint_id) || !digest(replay.provider_recording_id))) {
      fail('REPLAY_OUTPUT_MISSING', 'Every replay-only decision must retain its replay output and first-pass checkpoint binding.', { work_item_id: workItemId });
    }
    if (decision.action === 'LIVE' && replay) {
      fail('REPLAY_OUTPUT_OUT_OF_SCOPE', 'A live decision cannot be substituted with a replay output.', { work_item_id: workItemId });
    }
  }
  if (outputs.first_execution_result_id && outputs.first_execution_result_id !== executionResultId) {
    fail('REPLAY_OUTPUT_EXECUTION_MISMATCH', 'Replay outputs are not bound to the sealed first execution result.');
  }
  return replayRows;
}

function buildIteration2IndependentReviewInput({
  revised_decision_vector: vector,
  sealed_acceptance_checklist: checklist,
  replay_only_outputs: replayOutputs,
  root_dir: rootDir = process.cwd(),
} = {}) {
  const workItems = loadPilotWorkItems({ root_dir: rootDir });
  const expectedIds = new Set(workItems.map((item) => item.work_item_id));
  const decisions = validateDecisionVector(vector, expectedIds);
  const acceptance = validateAcceptanceChecklist(
    checklist,
    vector.bindings.first_execution_result_id,
    expectedIds,
  );
  const replayRows = validateReplayOutputs(
    replayOutputs,
    decisions,
    vector.bindings.first_execution_result_id,
    expectedIds,
  );
  const adjudications = indexUnique(vector.bindings.adjudications || [], 'sealed adjudications', expectedIds);
  const reviewItems = workItems.map((workItem) => {
    const decision = decisions.get(workItem.work_item_id);
    const replay = replayRows.get(workItem.work_item_id);
    const adjudication = adjudications.get(workItem.work_item_id);
    if (decision.action === 'REPLAY_ONLY') {
      const binding = adjudication
        ? { binding_kind: 'SEALED_ADJUDICATION', adjudication_id: adjudication.adjudication_id, review_packet_id: adjudication.review_packet_id }
        : { binding_kind: 'SEALED_ACCEPTANCE_CHECKLIST', acceptance_checklist_content_hash: checklist.content_hash };
      if (binding.binding_kind === 'SEALED_ACCEPTANCE_CHECKLIST' && !acceptance.has(workItem.work_item_id)) {
        fail('REVIEW_BINDING_MISSING', 'A replay-only item needs a sealed acceptance checklist item or adjudication.', { work_item_id: workItem.work_item_id });
      }
      return Object.freeze({
        work_item_id: workItem.work_item_id,
        family_id: workItem.family_id,
        final_output_state: 'AVAILABLE_REPLAY_OUTPUT',
        final_output_id: replay.replay_result_id,
        first_pass_checkpoint_id: replay.first_pass_checkpoint_id,
        review_binding: Object.freeze(binding),
      });
    }
    if (!acceptance.has(workItem.work_item_id)) {
      fail('REVIEW_BINDING_MISSING', 'A planned live item must bind to the sealed acceptance checklist.', { work_item_id: workItem.work_item_id });
    }
    return Object.freeze({
      work_item_id: workItem.work_item_id,
      family_id: workItem.family_id,
      final_output_state: 'PENDING_LIVE_OUTPUT',
      final_output_id: null,
      first_pass_checkpoint_id: null,
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
    'revised_decision_vector_content_hash', 'acceptance_checklist_content_hash', 'review_items',
    'independent_review_input_id',
  ];
  if (!exactKeys(reviewInput, keys) || reviewInput.schema_version !== REVIEW_PACKAGE_SCHEMA
    || reviewInput.pilot_work_item_set_id !== PILOT_WORK_ITEM_SET_ID
    || !digest(reviewInput.independent_review_input_id) || !Array.isArray(reviewInput.review_items)) {
    fail('INVALID_REVIEW_PACKAGE', 'The independent review input package is not closed or sealed.');
  }
  const body = { ...reviewInput };
  delete body.independent_review_input_id;
  if (contentId(REVIEW_PACKAGE_SCHEMA, body) !== reviewInput.independent_review_input_id) {
    fail('REVIEW_PACKAGE_ID_MISMATCH', 'The independent review input identity does not match its contents.');
  }
  const expectedIds = new Set(reviewInput.review_items.map((item) => item.work_item_id));
  if (expectedIds.size !== 12 || reviewInput.review_items.some((item) => !['AVAILABLE_REPLAY_OUTPUT', 'PENDING_LIVE_OUTPUT'].includes(item.final_output_state))) {
    fail('INVALID_REVIEW_PACKAGE', 'The package must retain exactly twelve replay or live-output review items.');
  }
  const supplied = indexUnique(liveOutputs, 'live outputs', expectedIds);
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
