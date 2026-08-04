'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const {
  ITERATION_2_PROFILE_DECISIONS_SCHEMA,
  planIteration2Rerun,
  replayRetainedProviderOutput,
} = require('./m3-iteration-2-rerun-planner');

const ATTEMPT_3_LEDGER_SCHEMA = 'M3_12_CALL_ITERATION_2_ATTEMPT_3_LEDGER/V1';
const ATTEMPT_3_PLACEHOLDERS_SCHEMA = 'M3_12_CALL_ITERATION_2_ATTEMPT_3_REVIEW_PLACEHOLDERS/V1';

class Attempt3MaterialiserError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new Attempt3MaterialiserError(code, message, details);
}

function digest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function validateRevisedVector(vector, executionResult, aggregateGate) {
  if (!vector || vector.schema_version !== 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3'
    || !digest(vector.content_hash) || !vector.bindings
    || vector.bindings.first_execution_result_id !== executionResult.execution_result_id
    || vector.bindings.quality_gate_id !== aggregateGate.quality_gate_id
    || !digest(vector.bindings.iteration_2_rerun_plan_id)
    || !Array.isArray(vector.decisions) || vector.decisions.length !== 12) {
    fail('INVALID_REVISED_VECTOR', 'Attempt 3 requires the sealed V3 decision vector for this execution result and recomputed gate.');
  }
  const decisions = new Map();
  for (const decision of vector.decisions) {
    if (!decision || typeof decision.work_item_id !== 'string' || decisions.has(decision.work_item_id)
      || !['RETAIN', 'REPLAY_ONLY', 'LIVE'].includes(decision.action)
      || (decision.action === 'LIVE' && !['TERRA_MEDIUM', 'SOL_HIGH'].includes(decision.profile_id))
      || (decision.action !== 'LIVE' && decision.profile_id !== null)) {
      fail('INVALID_REVISED_VECTOR', 'A V3 decision row is incomplete or has an invalid profile disposition.');
    }
    decisions.set(decision.work_item_id, decision);
  }
  const body = { ...vector };
  delete body.content_hash;
  if (contentId(vector.schema_version, body) !== vector.content_hash) {
    fail('REVISED_VECTOR_CONTENT_HASH_MISMATCH', 'The V3 decision vector content hash does not match its sealed contents.');
  }
  return decisions;
}

function buildProfileDecisions(vector, executionResult, aggregateGate) {
  return Object.freeze({
    schema_version: ITERATION_2_PROFILE_DECISIONS_SCHEMA,
    first_execution_result_id: executionResult.execution_result_id,
    quality_gate_id: aggregateGate.quality_gate_id,
    decisions: Object.freeze(vector.decisions.map((decision) => Object.freeze({
      work_item_id: decision.work_item_id,
      action: decision.action,
      profile_id: decision.profile_id,
    }))),
  });
}

function validateRetainedAdjudicationBindings({ revised_vector: vector, validated_adjudications: adjudications } = {}) {
  const retainedIds = vector.decisions.filter((decision) => decision.action === 'RETAIN')
    .map((decision) => decision.work_item_id).sort();
  const vectorRows = vector.bindings && vector.bindings.adjudications;
  if (!Array.isArray(vectorRows) || vectorRows.length !== retainedIds.length
    || !Array.isArray(adjudications) || adjudications.length !== retainedIds.length) {
    fail('RETAINED_ADJUDICATION_BINDING_MISMATCH', 'Each retained item requires one sealed and validated adjudication binding.');
  }
  const vectorById = new Map();
  for (const row of vectorRows) {
    if (!exactKeys(row, ['work_item_id', 'review_packet_id', 'adjudication_id'])
      || !retainedIds.includes(row.work_item_id) || vectorById.has(row.work_item_id)
      || !digest(row.review_packet_id) || !digest(row.adjudication_id)) {
      fail('RETAINED_ADJUDICATION_BINDING_MISMATCH', 'The V3 vector must bind each retained item to one exact review packet and adjudication.');
    }
    vectorById.set(row.work_item_id, Object.freeze({ ...row }));
  }
  const validatedById = new Map();
  for (const row of adjudications) {
    if (!row || !retainedIds.includes(row.work_item_id) || validatedById.has(row.work_item_id)
      || !digest(row.review_packet_id) || !digest(row.adjudication_id)) {
      fail('RETAINED_ADJUDICATION_BINDING_MISMATCH', 'Validated adjudications must cover the exact retained work-item set.');
    }
    validatedById.set(row.work_item_id, row);
  }
  for (const workItemId of retainedIds) {
    const sealed = vectorById.get(workItemId);
    const validated = validatedById.get(workItemId);
    if (!sealed || !validated || sealed.review_packet_id !== validated.review_packet_id
      || sealed.adjudication_id !== validated.adjudication_id) {
      fail('RETAINED_ADJUDICATION_BINDING_MISMATCH', 'A retained V3 adjudication binding does not match the validated adjudication.', { work_item_id: workItemId });
    }
  }
  return vectorById;
}

function deriveLiveOnlyManifest(manifest, plan) {
  const liveIds = new Set([
    ...plan.live_terra_work_items.map((item) => item.work_item_id),
    ...plan.live_sol_work_items.map((item) => item.work_item_id),
  ]);
  const workItems = manifest.work_items.filter((item) => liveIds.has(item.work_item_id));
  if (workItems.length !== 8 || new Set(workItems.map((item) => item.work_item_id)).size !== liveIds.size) {
    fail('LIVE_MANIFEST_MISMATCH', 'The live-only manifest must contain exactly the eight planned live work items.');
  }
  const sourceIds = new Set(workItems.map((item) => item.source_id));
  const sources = manifest.sources.filter((source) => sourceIds.has(source.source_id));
  if (sources.length !== sourceIds.size) fail('LIVE_MANIFEST_SOURCE_MISMATCH', 'The live-only manifest is missing a source required by a live work item.');
  return Object.freeze({
    schema_version: manifest.schema_version,
    sources: Object.freeze(sources),
    work_items: Object.freeze(workItems),
  });
}

function deriveLiveOnlyControls(plan, liveManifest) {
  const ids = new Set(liveManifest.work_items.map((item) => item.work_item_id));
  const controls = plan.new_controls?.work_item_controls?.filter((control) => ids.has(control.work_item_id));
  if (!Array.isArray(controls) || controls.length !== ids.size
    || new Set(controls.map((control) => control.work_item_id)).size !== ids.size) {
    fail('LIVE_CONTROLS_MISMATCH', 'The live-only controls must contain exactly one row for each live work item.');
  }
  return Object.freeze({
    schema_version: plan.new_controls.schema_version,
    work_item_controls: Object.freeze(controls),
  });
}

function retainedRows(vector, executionResult, plan, retainedAdjudications) {
  const checkpointById = new Map(plan.preserved_checkpoint_set.checkpoints.map((row) => [row.work_item_id, row]));
  const resultById = new Map(executionResult.work_results.map((row) => [row.work_item_id, row]));
  const archivedIds = new Set(plan.archived_replaced_work_items.map((row) => row.work_item_id));
  return vector.decisions.filter((decision) => decision.action === 'RETAIN').map((decision) => {
    const checkpoint = checkpointById.get(decision.work_item_id);
    const result = resultById.get(decision.work_item_id);
    if (!checkpoint || !result || archivedIds.has(decision.work_item_id)
      || checkpoint.work_result_id !== result.work_result_id) {
      fail('RETAINED_IDENTITY_MISMATCH', 'A retained work item must preserve its exact first-pass result and checkpoint.', { work_item_id: decision.work_item_id });
    }
    return Object.freeze({
      work_item_id: decision.work_item_id,
      first_work_result_id: result.work_result_id,
      preserved_checkpoint_id: checkpoint.checkpoint_id,
      provider_recording_id: checkpoint.provider_recording_id,
      review_packet_id: retainedAdjudications.get(decision.work_item_id).review_packet_id,
      adjudication_id: retainedAdjudications.get(decision.work_item_id).adjudication_id,
    });
  }).sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
}

async function materialiseAttempt3({
  first_execution_result: executionResult,
  aggregate_gate: aggregateGate,
  original_manifest: manifest,
  checkpoint_directory: checkpointDirectory,
  revised_vector: vector,
  validated_adjudications: validatedAdjudications,
  root_dir: rootDir = process.cwd(),
  write_artifact: writeArtifact,
  dependencies = {},
} = {}) {
  if (typeof writeArtifact !== 'function') fail('ARTIFACT_WRITER_REQUIRED', 'Attempt 3 requires an explicit artefact writer.');
  const decisions = validateRevisedVector(vector, executionResult, aggregateGate);
  const retainedAdjudications = validateRetainedAdjudicationBindings({
    revised_vector: vector,
    validated_adjudications: validatedAdjudications,
  });
  const planner = dependencies.plan_iteration_2_rerun || planIteration2Rerun;
  const replayer = dependencies.replay_retained_provider_output || replayRetainedProviderOutput;
  const plan = planner({
    first_execution_result: executionResult,
    aggregate_gate: aggregateGate,
    profile_decisions: buildProfileDecisions(vector, executionResult, aggregateGate),
    current_checkpoint_directory: checkpointDirectory,
    manifest,
    root_dir: rootDir,
  });
  if (!digest(plan.iteration_2_rerun_plan_id) || plan.first_execution_result_id !== executionResult.execution_result_id
    || plan.quality_gate_id !== aggregateGate.quality_gate_id
    || plan.iteration_2_rerun_plan_id !== vector.bindings.iteration_2_rerun_plan_id) {
    fail('PLAN_ID_MISMATCH', 'The attempt-3 plan does not match the sealed execution result and recomputed gate.');
  }
  const replayIds = vector.decisions.filter((decision) => decision.action === 'REPLAY_ONLY')
    .map((decision) => decision.work_item_id).sort();
  if (canonicalJson(replayIds) !== canonicalJson(plan.replay_only_work_items.map((item) => item.work_item_id).sort())) {
    fail('REPLAY_CLASSIFICATION_MISMATCH', 'The plan replay set differs from the sealed V3 decision vector.');
  }
  const liveManifest = deriveLiveOnlyManifest(manifest, plan);
  const liveControls = deriveLiveOnlyControls(plan, liveManifest);
  const replayResults = [];
  for (const workItemId of replayIds) {
    const result = await replayer({
      plan,
      first_execution_result: executionResult,
      work_item_id: workItemId,
      manifest,
      root_dir: rootDir,
    });
    if (result.model_call_count !== 0 || result.iteration_2_rerun_plan_id !== plan.iteration_2_rerun_plan_id
      || result.work_item_id !== workItemId || !digest(result.replay_result_id)) {
      fail('REPLAY_RESULT_MISMATCH', 'A replay result is not a zero-model result bound to the attempt-3 plan.', { work_item_id: workItemId });
    }
    replayResults.push(result);
  }
  const retained = retainedRows(vector, executionResult, plan, retainedAdjudications);
  const placeholders = Object.freeze({
    schema_version: ATTEMPT_3_PLACEHOLDERS_SCHEMA,
    iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
    review_items: Object.freeze(liveManifest.work_items.map((item) => Object.freeze({
      work_item_id: item.work_item_id,
      expected_profile_id: liveControls.work_item_controls.find((control) => control.work_item_id === item.work_item_id).profile_id,
      final_output_id: null,
      state: 'PENDING_LIVE_OUTPUT',
    }))),
  });
  const ledgerBody = {
    schema_version: ATTEMPT_3_LEDGER_SCHEMA,
    iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
    first_execution_result_id: executionResult.execution_result_id,
    quality_gate_id: aggregateGate.quality_gate_id,
    revised_vector_content_hash: vector.content_hash,
    retained_items: Object.freeze(retained),
    replay_result_ids: Object.freeze(replayResults.map((result) => result.replay_result_id).sort()),
    planned_live_work_item_ids: Object.freeze(liveManifest.work_items.map((item) => item.work_item_id).sort()),
    actual_model_call_count: 0,
    planned_live_model_call_count: liveManifest.work_items.length,
    live_invocation_state: 'NOT_EXECUTED',
  };
  const ledger = Object.freeze({ ...ledgerBody, attempt_3_ledger_id: contentId(ATTEMPT_3_LEDGER_SCHEMA, ledgerBody) });
  const artifacts = Object.freeze([
    Object.freeze({ path: 'sealed-rerun-plan.json', value: plan }),
    Object.freeze({ path: 'live-only-manifest.json', value: liveManifest }),
    Object.freeze({ path: 'live-only-controls.json', value: liveControls }),
    ...replayResults.map((result) => Object.freeze({ path: `replay-results/${result.work_item_id}.json`, value: result })),
    Object.freeze({ path: 'review-package-placeholders.json', value: placeholders }),
    Object.freeze({ path: 'sealed-ledger.json', value: ledger }),
  ]);
  for (const artifact of artifacts) await writeArtifact(artifact);
  return Object.freeze({ plan, live_manifest: liveManifest, live_controls: liveControls, replay_results: Object.freeze(replayResults), placeholders, ledger, artifacts });
}

module.exports = {
  ATTEMPT_3_LEDGER_SCHEMA,
  ATTEMPT_3_PLACEHOLDERS_SCHEMA,
  Attempt3MaterialiserError,
  materialiseAttempt3,
  validateRetainedAdjudicationBindings,
};
