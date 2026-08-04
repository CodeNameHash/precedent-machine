'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const { compileFixtureContractV34 } = require('../contract-bundle');
const { resolveCandidates } = require('./candidate-resolution');
const { runNativeExtraction } = require('./native-extraction-run');
const { loadPilotWorkItems } = require('./m3-12-call-pilot-quality-gate');
const { loadAdmittedSourceForExecution, validateUnifiedRunManifest } = require('./unified-runner-validate');

const FINAL_REVIEW_PACKET_SCHEMA = 'M3_12_CALL_FINAL_PILOT_REVIEW_PACKET/V1';
const REPAIRED_REPLAY_SCHEMA = 'M3_12_CALL_FINAL_PILOT_REPAIRED_REPLAY/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;
const RETAINED_IDS = new Set(['modiv-consideration-2-1', 'modiv-termination-fee-7-3']);
const REPLAY_ONLY_IDS = new Set(['skechers-no-other-reps-3-28', 'topbuild-termination-company-6-3']);
const PASSED_ITERATION_2_ID = 'modiv-mae-definition-8-12-g';

class FinalPilotSynthesisError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FinalPilotSynthesisError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new FinalPilotSynthesisError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value) {
  return typeof value === 'string' && DIGEST_RE.test(value);
}

function sortedUnique(values, predicate, code, message) {
  if (!Array.isArray(values) || values.some((value) => !predicate(value))
    || new Set(values).size !== values.length || canonicalJson(values) !== canonicalJson([...values].sort())) {
    fail(code, message);
  }
  return values;
}

function sealedBody(value, idKey, schema, code) {
  if (!value || value.schema_version !== schema || !isDigest(value[idKey])) {
    fail(code, 'A required sealed input is missing its schema or content identity.');
  }
  const body = { ...value };
  delete body[idKey];
  if (contentId(schema, body) !== value[idKey]) fail(code, 'A required sealed input does not match its content identity.');
  return value;
}

function resultIndex(execution, label) {
  if (!execution || execution.schema_version !== 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1'
    || !Array.isArray(execution.work_results) || !isDigest(execution.execution_result_id)) {
    fail('INVALID_EXECUTION_RESULT', `${label} must be a sealed unified execution result.`);
  }
  const body = { ...execution };
  delete body.execution_result_id;
  if (contentId(execution.schema_version, body) !== execution.execution_result_id) {
    fail('EXECUTION_RESULT_ID_MISMATCH', `${label} does not match its content identity.`);
  }
  const indexed = new Map();
  for (const result of execution.work_results) {
    if (!result || typeof result.work_item_id !== 'string' || indexed.has(result.work_item_id)
      || !result.provider_recording || !isDigest(result.provider_recording.provider_recording_id)
      || !result.provider_recording.provider_output || typeof result.provider_recording.provider_output !== 'object') {
      fail('INVALID_EXECUTION_RESULT', `${label} has an invalid or duplicate provider recording.`);
    }
    indexed.set(result.work_item_id, result);
  }
  return indexed;
}

function validateRepairVector(vector) {
  if (!vector || vector.schema_version !== 'M3_12_CALL_ITERATION_2_ATTEMPT_3_REPAIR_RERUN_VECTOR/V1'
    || !isDigest(vector.content_hash) || !Array.isArray(vector.work_item_repairs)) {
    fail('INVALID_REPAIR_VECTOR', 'The sealed repair vector is missing or malformed.');
  }
  const body = { ...vector };
  delete body.content_hash;
  if (contentId(vector.schema_version, body) !== vector.content_hash) {
    fail('REPAIR_VECTOR_ID_MISMATCH', 'The sealed repair vector does not match its content identity.');
  }
  const ids = sortedUnique(vector.work_item_repairs.map((row) => row && row.work_item_id),
    (id) => typeof id === 'string' && id.trim() === id && id.length > 0,
    'INVALID_REPAIR_VECTOR', 'The repair vector must identify a sorted, unique repair set.');
  if (vector.work_item_repairs.some((row) => row.replayable !== true)) {
    fail('NON_REPLAYABLE_REPAIR', 'The final pilot can only use repair rows declared replayable.');
  }
  return new Set(ids);
}

function validateRepairs(required, present) {
  const requiredIds = sortedUnique(required, (value) => COMMIT_RE.test(value),
    'INVALID_REQUIRED_REPAIR_COMMITS', 'required_repair_commits must be a non-empty sorted set of full commit IDs.');
  if (requiredIds.length === 0) fail('REPAIR_COMMITS_UNDECLARED', 'The final pilot requires every repair commit to be declared explicitly.');
  const presentIds = sortedUnique(present, (value) => COMMIT_RE.test(value),
    'INVALID_PRESENT_REPAIR_COMMITS', 'present_repair_commits must be a sorted set of full commit IDs.');
  const presentSet = new Set(presentIds);
  const missing = requiredIds.filter((id) => !presentSet.has(id));
  if (missing.length > 0) fail('REPAIR_COMMIT_MISSING', 'The final pilot is blocked until every declared repair commit is present at HEAD.', { missing_repair_commits: missing });
  return Object.freeze({ required: Object.freeze(requiredIds), present: Object.freeze(presentIds) });
}

function validateDecisionVector(vector, firstExecutionId, planId) {
  if (!vector || vector.schema_version !== 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3'
    || !isDigest(vector.content_hash) || !vector.bindings || vector.bindings.first_execution_result_id !== firstExecutionId
    || vector.bindings.iteration_2_rerun_plan_id !== planId || !Array.isArray(vector.bindings.adjudications)) {
    fail('INVALID_DECISION_VECTOR', 'The V3 decision vector must bind the first execution and rerun plan.');
  }
  const body = { ...vector };
  delete body.content_hash;
  if (contentId(vector.schema_version, body) !== vector.content_hash) fail('DECISION_VECTOR_ID_MISMATCH', 'The V3 decision vector does not match its content identity.');
  const bindings = new Map();
  for (const row of vector.bindings.adjudications) {
    if (!row || !RETAINED_IDS.has(row.work_item_id) || bindings.has(row.work_item_id)
      || !isDigest(row.review_packet_id) || !isDigest(row.adjudication_id)) {
      fail('INVALID_RETAINED_ADJUDICATIONS', 'The V3 decision vector must bind each retained Modiv output to its sealed adjudication.');
    }
    bindings.set(row.work_item_id, row);
  }
  if (bindings.size !== RETAINED_IDS.size) fail('INVALID_RETAINED_ADJUDICATIONS', 'Both retained Modiv outputs require sealed adjudications.');
  return bindings;
}

function validatePlan(plan, firstExecutionId) {
  if (!plan || plan.schema_version !== 'M3_12_CALL_ITERATION_2_RERUN_PLAN/V1'
    || !isDigest(plan.iteration_2_rerun_plan_id) || plan.first_execution_result_id !== firstExecutionId) {
    fail('INVALID_RERUN_PLAN', 'The iteration-2 plan must bind the exact first execution result.');
  }
  const body = { ...plan };
  delete body.iteration_2_rerun_plan_id;
  if (contentId(plan.schema_version, body) !== plan.iteration_2_rerun_plan_id) fail('RERUN_PLAN_ID_MISMATCH', 'The iteration-2 plan does not match its content identity.');
  return plan;
}

function validateReplayOnly(results, planId, firstById) {
  if (!Array.isArray(results) || results.length !== REPLAY_ONLY_IDS.size) {
    fail('INVALID_REPLAY_ONLY_RESULTS', 'The final pilot requires the two pre-existing replay-only outputs.');
  }
  const byId = new Map();
  for (const result of results) {
    sealedBody(result, 'replay_result_id', 'M3_12_CALL_ITERATION_2_REPLAY_RESULT/V1', 'INVALID_REPLAY_ONLY_RESULTS');
    if (!REPLAY_ONLY_IDS.has(result.work_item_id) || byId.has(result.work_item_id)
      || result.iteration_2_rerun_plan_id !== planId || result.model_call_count !== 0
      || !firstById.get(result.work_item_id) || result.first_work_result_id !== firstById.get(result.work_item_id).work_result_id
      || result.provider_recording_id !== firstById.get(result.work_item_id).provider_recording.provider_recording_id) {
      fail('INVALID_REPLAY_ONLY_RESULTS', 'A replay-only output does not bind its first-pass recording and plan.');
    }
    byId.set(result.work_item_id, result);
  }
  return byId;
}

async function replayIteration2ProviderRecording({ work_item, prior_result: prior, manifest, root_dir: rootDir, contract_bundle: contractBundle, definitions }) {
  const validation = validateUnifiedRunManifest({ manifest, root_dir: rootDir });
  const semantic = validation.semantic_manifest.work_items.find((item) => item.work_item_id === work_item.work_item_id);
  const source = manifest.sources.find((entry) => entry.source_id === work_item.source_id);
  if (!semantic || !source) fail('REPAIR_REPLAY_SOURCE_MISSING', 'A repaired work item is missing its immutable source binding.', { work_item_id: work_item.work_item_id });
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: rootDir });
  const runReceipt = await runNativeExtraction({
    source_text: admitted.context.canonical_text.text,
    document_hash: admitted.context.document_hash,
    section_references: [semantic.section_reference],
    section_family_assignments: [{
      section_reference: semantic.section_reference,
      family_id: semantic.family_id,
      ...(semantic.family_id === 'INTERIM_OPERATING' ? { covenant_side: 'TARGET' } : {}),
    }],
    contract_bundle: contractBundle,
    definitions,
    provider: async () => prior.provider_recording.provider_output,
  });
  const resolution = resolveCandidates({ run_receipt: runReceipt, contract_vocabulary: contractBundle, admitted_source_context: admitted.context });
  const body = {
    schema_version: REPAIRED_REPLAY_SCHEMA,
    work_item_id: work_item.work_item_id,
    iteration_2_work_result_id: prior.work_result_id,
    provider_recording: prior.provider_recording,
    model_call_count: 0,
    run_receipt: runReceipt,
    resolution,
  };
  return Object.freeze({ ...body, repaired_replay_id: contentId(REPAIRED_REPLAY_SCHEMA, body) });
}

async function buildFinalPilotSynthesis({
  first_execution_result: firstExecution,
  iteration_2_execution_result: iteration2Execution,
  iteration_2_rerun_plan: plan,
  revised_decision_vector: decisionVector,
  repair_rerun_vector: repairVector,
  replay_only_results: replayOnlyResults,
  required_repair_commits: requiredRepairCommits,
  present_repair_commits: presentRepairCommits,
  manifest,
  root_dir: rootDir = process.cwd(),
  contract_bundle: contractBundle = compileFixtureContractV34(),
  definitions = Object.freeze({ known_definitions: Object.freeze([]) }),
  replay_recording = replayIteration2ProviderRecording,
} = {}) {
  const pilotItems = loadPilotWorkItems({ root_dir: rootDir });
  const expectedIds = new Set(pilotItems.map((item) => item.work_item_id));
  const firstById = resultIndex(firstExecution, 'first_execution_result');
  const iteration2ById = resultIndex(iteration2Execution, 'iteration_2_execution_result');
  if (firstById.size !== expectedIds.size || [...expectedIds].some((id) => !firstById.has(id))) {
    fail('FIRST_EXECUTION_COHORT_MISMATCH', 'The first execution result must retain every original pilot work item.');
  }
  validatePlan(plan, firstExecution.execution_result_id);
  const adjudications = validateDecisionVector(decisionVector, firstExecution.execution_result_id, plan.iteration_2_rerun_plan_id);
  const repairs = validateRepairVector(repairVector);
  const commits = validateRepairs(requiredRepairCommits, presentRepairCommits);
  const replayOnlyById = validateReplayOnly(replayOnlyResults, plan.iteration_2_rerun_plan_id, firstById);
  if (!iteration2ById.has(PASSED_ITERATION_2_ID)) fail('MAE_ITERATION_2_OUTPUT_MISSING', 'The passed Modiv MAE iteration-2 output is required.');
  if (repairs.size !== 7 || [...repairs].some((id) => !iteration2ById.has(id) || !expectedIds.has(id))) {
    fail('REPAIR_COHORT_MISMATCH', 'The repair vector must replay the seven failed iteration-2 provider recordings.');
  }
  if (repairs.has(PASSED_ITERATION_2_ID) || [...RETAINED_IDS, ...REPLAY_ONLY_IDS].some((id) => repairs.has(id))) {
    fail('REPAIR_COHORT_MISMATCH', 'Only failed iteration-2 outputs may enter the repair replay cohort.');
  }

  const manifestToUse = manifest || require(require('node:path').resolve(
    rootDir,
    'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
  ));
  validateUnifiedRunManifest({ manifest: manifestToUse, root_dir: rootDir });
  const manifestById = new Map(manifestToUse.work_items.map((item) => [item.work_item_id, item]));
  const repairedById = new Map();
  for (const workItemId of [...repairs].sort()) {
    const replay = await replay_recording({
      work_item: manifestById.get(workItemId),
      prior_result: iteration2ById.get(workItemId),
      manifest: manifestToUse,
      root_dir: rootDir,
      contract_bundle: contractBundle,
      definitions,
    });
    sealedBody(replay, 'repaired_replay_id', REPAIRED_REPLAY_SCHEMA, 'INVALID_REPAIRED_REPLAY');
    if (replay.work_item_id !== workItemId || replay.model_call_count !== 0
      || replay.iteration_2_work_result_id !== iteration2ById.get(workItemId).work_result_id
      || replay.provider_recording?.provider_recording_id !== iteration2ById.get(workItemId).provider_recording.provider_recording_id) {
      fail('INVALID_REPAIRED_REPLAY', 'A repaired replay does not retain its exact iteration-2 provider recording.');
    }
    repairedById.set(workItemId, replay);
  }
  const workItems = [...expectedIds].sort().map((workItemId) => {
    if (RETAINED_IDS.has(workItemId)) return Object.freeze({
      work_item_id: workItemId, source_kind: 'ADJUDICATED_FIRST_PASS', model_call_count: 0,
      first_work_result: firstById.get(workItemId), adjudication_binding: adjudications.get(workItemId),
      legal_disposition: 'NOT_DETERMINED', independent_review_state: 'PENDING_INDEPENDENT_LEGAL_REVIEW',
    });
    if (REPLAY_ONLY_IDS.has(workItemId)) return Object.freeze({
      work_item_id: workItemId, source_kind: 'REPLAY_ONLY', model_call_count: 0,
      first_provider_recording: firstById.get(workItemId).provider_recording, replay_result: replayOnlyById.get(workItemId),
      legal_disposition: 'NOT_DETERMINED', independent_review_state: 'PENDING_INDEPENDENT_LEGAL_REVIEW',
    });
    if (workItemId === PASSED_ITERATION_2_ID) return Object.freeze({
      work_item_id: workItemId, source_kind: 'PASSED_ITERATION_2', model_call_count: 0,
      iteration_2_work_result: iteration2ById.get(workItemId),
      legal_disposition: 'NOT_DETERMINED', independent_review_state: 'PENDING_INDEPENDENT_LEGAL_REVIEW',
    });
    return Object.freeze({
      work_item_id: workItemId, source_kind: 'REPAIRED_REPLAY', model_call_count: 0,
      repaired_replay: repairedById.get(workItemId),
      legal_disposition: 'NOT_DETERMINED', independent_review_state: 'PENDING_INDEPENDENT_LEGAL_REVIEW',
    });
  });
  const body = {
    schema_version: FINAL_REVIEW_PACKET_SCHEMA,
    pilot_work_item_ids: [...expectedIds].sort(),
    first_execution_result_id: firstExecution.execution_result_id,
    iteration_2_execution_result_id: iteration2Execution.execution_result_id,
    iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
    revised_decision_vector_content_hash: decisionVector.content_hash,
    repair_rerun_vector_content_hash: repairVector.content_hash,
    required_repair_commits: commits.required,
    present_repair_commits: commits.present,
    model_call_count: 0,
    legal_disposition: 'NOT_DETERMINED',
    independent_review_state: 'PENDING_INDEPENDENT_LEGAL_REVIEW',
    work_items: workItems,
  };
  return Object.freeze({ ...body, final_review_packet_id: contentId(FINAL_REVIEW_PACKET_SCHEMA, body) });
}

module.exports = {
  FINAL_REVIEW_PACKET_SCHEMA,
  REPAIRED_REPLAY_SCHEMA,
  FinalPilotSynthesisError,
  replayIteration2ProviderRecording,
  buildFinalPilotSynthesis,
};
