'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId } = require('../canonical-bytes');
const { compileFixtureContractV34 } = require('../contract-bundle');
const { resolveCandidates } = require('./candidate-resolution');
const { runNativeExtraction } = require('./native-extraction-run');
const { PILOT_WORK_ITEM_SET_ID, loadPilotWorkItems } = require('./m3-12-call-pilot-quality-gate');
const { loadAdmittedSourceForExecution, validateUnifiedRunManifest } = require('./unified-runner-validate');
const {
  CHECKPOINT_SCHEMA,
  CONTROLS_SCHEMA,
} = require('./unified-runner-execute');

const ITERATION_2_PROFILE_DECISIONS_SCHEMA = 'M3_12_CALL_ITERATION_2_PROFILE_DECISIONS/V1';
const ITERATION_2_RERUN_PLAN_SCHEMA = 'M3_12_CALL_ITERATION_2_RERUN_PLAN/V1';
const PRESERVED_CHECKPOINT_SET_SCHEMA = 'M3_12_CALL_ITERATION_2_PRESERVED_CHECKPOINT_SET/V1';
const REPLAY_RESULT_SCHEMA = 'M3_12_CALL_ITERATION_2_REPLAY_RESULT/V1';
const PROFILE_IDS = new Set(['TERRA_MEDIUM', 'SOL_HIGH']);
const ACTIONS = new Set(['RETAIN', 'REPLAY_ONLY', 'LIVE']);

class Iteration2RerunPlannerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new Iteration2RerunPlannerError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim() && value.trim() === value;
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function uniqueSortedIds(value, label, expectedIds) {
  if (!Array.isArray(value) || value.some((id) => !nonEmptyText(id))
    || new Set(value).size !== value.length || canonicalJson(value) !== canonicalJson([...value].sort())) {
    fail('INVALID_AGGREGATE_GATE', `${label} must be a sorted, unique work-item list.`);
  }
  if (expectedIds && value.some((id) => !expectedIds.has(id))) {
    fail('AGGREGATE_GATE_WORK_ITEM_MISMATCH', `${label} names a work item outside the immutable pilot cohort.`);
  }
  return value;
}

function loadPinnedManifest(rootDir) {
  const manifestPath = path.resolve(rootDir, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json');
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    fail('PILOT_MANIFEST_UNAVAILABLE', 'The pinned twelve-item pilot manifest is unavailable.', {
      cause: error && (error.code || error.name),
    });
  }
}

function verifyPilotManifestIdentity(manifest, pilotItems) {
  const actual = (manifest && Array.isArray(manifest.work_items) ? manifest.work_items : [])
    .map((item) => ({
      work_item_id: item && item.work_item_id,
      source_id: item && item.source_id,
      family_id: item && item.family_id,
      disposition: item && item.disposition,
    }))
    .sort((left, right) => String(left.work_item_id).localeCompare(String(right.work_item_id)));
  if (canonicalJson(actual) !== canonicalJson(pilotItems)) {
    fail('PILOT_MANIFEST_IDENTITY_MISMATCH', 'The manifest does not preserve the original twelve-item pilot identity.');
  }
}

function validateFirstExecutionResult(executionResult, manifest, expectedIds) {
  const keys = [
    'schema_version', 'validation_receipt_id', 'semantic_manifest_id', 'execution_plan_id',
    'contract_fingerprint', 'validation_evidence', 'work_results', 'succeeded_count',
    'failed_count', 'execution_result_id',
  ];
  if (!exactKeys(executionResult, keys) || executionResult.schema_version !== 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1'
    || !isDigest(executionResult.execution_result_id) || !Array.isArray(executionResult.work_results)
    || executionResult.work_results.length !== expectedIds.size
    || executionResult.succeeded_count + executionResult.failed_count !== expectedIds.size) {
    fail('INVALID_FIRST_EXECUTION_RESULT', 'The first execution result must be a complete sealed twelve-item result.');
  }
  const body = { ...executionResult };
  delete body.execution_result_id;
  if (contentId(executionResult.schema_version, body) !== executionResult.execution_result_id) {
    fail('FIRST_EXECUTION_RESULT_ID_MISMATCH', 'The first execution result content identity does not match its contents.');
  }
  const manifestById = new Map(manifest.work_items.map((item) => [item.work_item_id, item]));
  const resultById = new Map();
  for (const result of executionResult.work_results) {
    const resultKeys = [
      'schema_version', 'work_item_id', 'source_id', 'family_id', 'profile_id', 'status',
      'failure_code', 'failure_stage', 'run_receipt', 'resolution', 'provider_recording', 'work_result_id',
    ];
    const item = result && manifestById.get(result.work_item_id);
    const resultBody = result && { ...result };
    const recording = result && result.provider_recording;
    const recordingBody = recording && {
      schema_version: recording.schema_version,
      work_item_id: recording.work_item_id,
      provider_output: recording.provider_output,
    };
    if (resultBody) delete resultBody.work_result_id;
    if (!exactKeys(result, resultKeys) || !item || resultById.has(result.work_item_id)
      || result.source_id !== item.source_id || result.family_id !== item.family_id
      || !PROFILE_IDS.has(result.profile_id) || !isDigest(result.work_result_id)
      || result.work_result_id !== contentId(result.schema_version, resultBody)
      || !exactKeys(recording, ['schema_version', 'work_item_id', 'provider_output', 'provider_recording_id'])
      || recording.schema_version !== 'NATIVE_UNIFIED_RUN_PROVIDER_RECORDING/V1'
      || recording.work_item_id !== result.work_item_id
      || !recording.provider_output || typeof recording.provider_output !== 'object'
      || typeof recording.provider_output.raw_response_text !== 'string'
      || recording.provider_recording_id !== contentId(recording.schema_version, recordingBody)) {
      fail('INVALID_FIRST_EXECUTION_RESULT', 'A first-pass work result does not match the original manifest or sealed work-result contract.');
    }
    resultById.set(result.work_item_id, result);
  }
  if (resultById.size !== expectedIds.size) fail('INVALID_FIRST_EXECUTION_RESULT', 'The first execution result must contain each original work item once.');
  return resultById;
}

function validateAggregateGate(gate, expectedIds) {
  const keys = [
    'schema_version', 'pilot_work_item_set_id', 'gate_status', 'selected_present_work_item_ids',
    'work_item_findings', 'rerun_work_item_ids', 'escalation_work_item_ids', 'quality_gate_id',
  ];
  if (!exactKeys(gate, keys) || gate.schema_version !== 'M3_12_CALL_PILOT_QUALITY_GATE/V1'
    || gate.pilot_work_item_set_id !== PILOT_WORK_ITEM_SET_ID || !['PASS', 'FAIL'].includes(gate.gate_status)
    || !isDigest(gate.quality_gate_id)) {
    fail('INVALID_AGGREGATE_GATE', 'The aggregate gate must match the sealed twelve-item quality-gate contract.');
  }
  const selected = uniqueSortedIds(gate.selected_present_work_item_ids, 'selected_present_work_item_ids', expectedIds);
  if (selected.length !== expectedIds.size || selected.some((id) => !expectedIds.has(id))) {
    fail('AGGREGATE_GATE_WORK_ITEM_MISMATCH', 'The aggregate gate does not cover the original twelve-item manifest.');
  }
  const rerun = uniqueSortedIds(gate.rerun_work_item_ids, 'rerun_work_item_ids', expectedIds);
  const escalation = uniqueSortedIds(gate.escalation_work_item_ids, 'escalation_work_item_ids', expectedIds);
  if (!Array.isArray(gate.work_item_findings) || gate.work_item_findings.length !== expectedIds.size) {
    fail('INVALID_AGGREGATE_GATE', 'The aggregate gate must retain one finding for every original work item.');
  }
  const findingIds = gate.work_item_findings.map((finding) => finding && finding.work_item_id).sort();
  if (new Set(findingIds).size !== expectedIds.size || findingIds.some((id) => !expectedIds.has(id))) {
    fail('AGGREGATE_GATE_WORK_ITEM_MISMATCH', 'Aggregate gate findings do not match the original twelve-item manifest.');
  }
  const body = { ...gate };
  delete body.quality_gate_id;
  if (contentId(gate.schema_version, body) !== gate.quality_gate_id) {
    fail('AGGREGATE_GATE_ID_MISMATCH', 'The aggregate gate content identity does not match its contents.');
  }
  return Object.freeze({ rerun, escalation });
}

function validateProfileDecisions(decisions, expectedIds, firstExecutionResultId, qualityGateId) {
  const keys = ['schema_version', 'first_execution_result_id', 'quality_gate_id', 'decisions'];
  if (!exactKeys(decisions, keys) || decisions.schema_version !== ITERATION_2_PROFILE_DECISIONS_SCHEMA
    || decisions.first_execution_result_id !== firstExecutionResultId || decisions.quality_gate_id !== qualityGateId
    || !Array.isArray(decisions.decisions) || decisions.decisions.length !== expectedIds.size) {
    fail('INVALID_PROFILE_DECISIONS', 'Profile decisions must bind every original work item to this execution result and gate.');
  }
  const byId = new Map();
  for (const decision of decisions.decisions) {
    if (!exactKeys(decision, ['work_item_id', 'action', 'profile_id'])
      || !expectedIds.has(decision.work_item_id) || byId.has(decision.work_item_id)
      || !ACTIONS.has(decision.action)) {
      fail('INVALID_PROFILE_DECISIONS', 'Each profile decision must be one closed row for an original work item.');
    }
    if (decision.action === 'LIVE' && !PROFILE_IDS.has(decision.profile_id)) {
      fail('INVALID_PROFILE_DECISIONS', 'A live rerun requires TERRA_MEDIUM or SOL_HIGH.');
    }
    if (decision.action !== 'LIVE' && decision.profile_id !== null) {
      fail('INVALID_PROFILE_DECISIONS', 'Retained and replay-only rows cannot carry a live profile.');
    }
    byId.set(decision.work_item_id, Object.freeze({ ...decision }));
  }
  return byId;
}

function checkpointBody(checkpoint) {
  const body = { ...checkpoint };
  delete body.checkpoint_id;
  return body;
}

function loadCurrentCheckpoints(directory, executionResult) {
  if (!nonEmptyText(directory)) fail('INVALID_CHECKPOINT_DIRECTORY', 'current_checkpoint_directory must be a non-empty path.');
  let entries;
  let resolvedDirectory;
  try {
    resolvedDirectory = fs.realpathSync(directory);
    entries = fs.readdirSync(resolvedDirectory, { withFileTypes: true });
  } catch (error) {
    fail('CHECKPOINT_DIRECTORY_UNAVAILABLE', 'The current checkpoint directory is unavailable.', { cause: error && (error.code || error.name) });
  }
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (files.length !== executionResult.work_results.length || entries.some((entry) => !entry.isFile() || !entry.name.endsWith('.json'))) {
    fail('CHECKPOINT_SET_MISMATCH', 'The current checkpoint directory must contain exactly the first-pass checkpoint JSON files.');
  }
  const resultsById = new Map(executionResult.work_results.map((result) => [result.work_item_id, result]));
  const byWorkItem = new Map();
  const checkpointRows = files.map((entry) => {
    let checkpoint;
    try {
      checkpoint = JSON.parse(fs.readFileSync(path.join(resolvedDirectory, entry.name), 'utf8'));
    } catch (error) {
      fail('INVALID_CHECKPOINT', `Cannot read checkpoint ${entry.name}.`, { cause: error && (error.code || error.name) });
    }
    const keys = [
      'schema_version', 'validation_receipt_id', 'semantic_manifest_id', 'execution_plan_id',
      'contract_fingerprint', 'work_result', 'checkpoint_id',
    ];
    if (!exactKeys(checkpoint, keys) || checkpoint.schema_version !== CHECKPOINT_SCHEMA
      || checkpoint.validation_receipt_id !== executionResult.validation_receipt_id
      || checkpoint.semantic_manifest_id !== executionResult.semantic_manifest_id
      || checkpoint.execution_plan_id !== executionResult.execution_plan_id
      || checkpoint.contract_fingerprint !== executionResult.contract_fingerprint
      || checkpoint.checkpoint_id !== contentId(CHECKPOINT_SCHEMA, checkpointBody(checkpoint))
      || entry.name !== `${checkpoint.checkpoint_id}.json`) {
      fail('INVALID_CHECKPOINT', `Checkpoint ${entry.name} is not an immutable first-pass checkpoint.`);
    }
    const result = resultsById.get(checkpoint.work_result && checkpoint.work_result.work_item_id);
    if (!result || result.work_result_id !== checkpoint.work_result.work_result_id || byWorkItem.has(result.work_item_id)) {
      fail('CHECKPOINT_SET_MISMATCH', 'Each first-pass result must have exactly one matching checkpoint.');
    }
    byWorkItem.set(result.work_item_id, Object.freeze({ checkpoint, checkpoint_path: path.join(resolvedDirectory, entry.name) }));
    return Object.freeze({
      work_item_id: result.work_item_id,
      checkpoint_id: checkpoint.checkpoint_id,
      work_result_id: result.work_result_id,
      provider_recording_id: result.provider_recording && result.provider_recording.provider_recording_id,
      checkpoint_path: path.join(resolvedDirectory, entry.name),
    });
  });
  if (byWorkItem.size !== resultsById.size) fail('CHECKPOINT_SET_MISMATCH', 'A first-pass checkpoint is missing.');
  const body = {
    schema_version: PRESERVED_CHECKPOINT_SET_SCHEMA,
    first_execution_result_id: executionResult.execution_result_id,
    checkpoints: checkpointRows.sort((left, right) => left.work_item_id.localeCompare(right.work_item_id)),
  };
  return Object.freeze({
    set: Object.freeze({ ...body, preserved_checkpoint_set_id: contentId(PRESERVED_CHECKPOINT_SET_SCHEMA, body) }),
    by_work_item: byWorkItem,
  });
}

function originalControls(executionResult, semanticItems, decisionsById) {
  const resultById = new Map(executionResult.work_results.map((result) => [result.work_item_id, result]));
  return semanticItems.map((item) => {
    const decision = decisionsById.get(item.work_item_id);
    const original = resultById.get(item.work_item_id);
    return Object.freeze({
      work_item_id: item.work_item_id,
      profile_id: decision.action === 'LIVE' ? decision.profile_id : original.profile_id,
      covenant_side: item.family_id === 'INTERIM_OPERATING' ? 'TARGET' : null,
    });
  }).sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
}

function planIteration2Rerun({
  first_execution_result: firstExecutionResult,
  aggregate_gate: aggregateGate,
  profile_decisions: profileDecisions,
  current_checkpoint_directory: checkpointDirectory,
  manifest,
  root_dir: rootDir = process.cwd(),
} = {}) {
  const pinnedManifest = manifest || loadPinnedManifest(rootDir);
  const pilotItems = loadPilotWorkItems({ root_dir: rootDir });
  const expectedIds = new Set(pilotItems.map((item) => item.work_item_id));
  verifyPilotManifestIdentity(pinnedManifest, pilotItems);
  validateFirstExecutionResult(firstExecutionResult, pinnedManifest, expectedIds);
  const gate = validateAggregateGate(aggregateGate, expectedIds);
  const decisionsById = validateProfileDecisions(
    profileDecisions,
    expectedIds,
    firstExecutionResult.execution_result_id,
    aggregateGate.quality_gate_id,
  );
  const actionRequired = new Set([...gate.rerun, ...gate.escalation]);
  for (const workItemId of expectedIds) {
    const decision = decisionsById.get(workItemId);
    if (actionRequired.has(workItemId) && decision.action === 'RETAIN') {
      fail('ACTIONABLE_WORK_ITEM_RETAINED', 'A gate-selected work item cannot be retained without replay or a live rerun.', { work_item_id: workItemId });
    }
    if (!actionRequired.has(workItemId) && decision.action !== 'RETAIN') {
      fail('OUT_OF_SCOPE_RERUN', 'A work item outside the aggregate gate cannot be replayed or rerun.', { work_item_id: workItemId });
    }
  }
  const checkpoints = loadCurrentCheckpoints(checkpointDirectory, firstExecutionResult);
  const semanticById = new Map(pinnedManifest.work_items.map((item) => [item.work_item_id, item]));
  const archivedReplaced = [];
  const replayOnly = [];
  const liveTerra = [];
  const liveSol = [];
  for (const workItemId of [...expectedIds].sort()) {
    const decision = decisionsById.get(workItemId);
    const result = firstExecutionResult.work_results.find((row) => row.work_item_id === workItemId);
    const checkpoint = checkpoints.by_work_item.get(workItemId).checkpoint;
    if (decision.action === 'RETAIN') continue;
    const archivedRow = Object.freeze({
      work_item_id: workItemId,
      first_work_result_id: result.work_result_id,
      preserved_checkpoint_id: checkpoint.checkpoint_id,
      replacement_mode: decision.action,
    });
    archivedReplaced.push(archivedRow);
    if (decision.action === 'REPLAY_ONLY') {
      replayOnly.push(Object.freeze({
        work_item_id: workItemId,
        source_id: semanticById.get(workItemId).source_id,
        family_id: semanticById.get(workItemId).family_id,
        first_work_result_id: result.work_result_id,
        preserved_checkpoint_id: checkpoint.checkpoint_id,
        provider_recording_id: result.provider_recording.provider_recording_id,
        model_call_count: 0,
      }));
    } else if (decision.profile_id === 'TERRA_MEDIUM') {
      liveTerra.push(Object.freeze({ work_item_id: workItemId, source_id: semanticById.get(workItemId).source_id, family_id: semanticById.get(workItemId).family_id }));
    } else {
      liveSol.push(Object.freeze({ work_item_id: workItemId, source_id: semanticById.get(workItemId).source_id, family_id: semanticById.get(workItemId).family_id }));
    }
  }
  const controls = Object.freeze({
    schema_version: CONTROLS_SCHEMA,
    work_item_controls: Object.freeze(originalControls(firstExecutionResult, pinnedManifest.work_items, decisionsById)),
  });
  const body = {
    schema_version: ITERATION_2_RERUN_PLAN_SCHEMA,
    pilot_work_item_set_id: PILOT_WORK_ITEM_SET_ID,
    first_execution_result_id: firstExecutionResult.execution_result_id,
    quality_gate_id: aggregateGate.quality_gate_id,
    preserved_checkpoint_set: checkpoints.set,
    archived_replaced_work_items: Object.freeze(archivedReplaced),
    replay_only_work_items: Object.freeze(replayOnly),
    live_terra_work_items: Object.freeze(liveTerra),
    live_sol_work_items: Object.freeze(liveSol),
    new_controls: controls,
    controls: Object.freeze({
      first_pass_artifact_mutation: 'FORBIDDEN',
      checkpoint_deletion: 'FORBIDDEN',
      original_manifest_work_item_count: expectedIds.size,
      replay_model_call_count: 0,
      live_model_call_count: liveTerra.length + liveSol.length,
    }),
  };
  return Object.freeze({ ...body, iteration_2_rerun_plan_id: contentId(ITERATION_2_RERUN_PLAN_SCHEMA, body) });
}

async function replayRetainedProviderOutput({
  plan,
  first_execution_result: firstExecutionResult,
  work_item_id: workItemId,
  manifest,
  root_dir: rootDir = process.cwd(),
  contract_bundle: contractBundle = compileFixtureContractV34(),
  definitions = Object.freeze({ known_definitions: Object.freeze([]) }),
} = {}) {
  if (!plan || plan.schema_version !== ITERATION_2_RERUN_PLAN_SCHEMA
    || plan.first_execution_result_id !== firstExecutionResult?.execution_result_id) {
    fail('INVALID_REPLAY_PLAN', 'The replay must use a plan linked to the exact first execution result.');
  }
  const replayItem = plan.replay_only_work_items.find((item) => item.work_item_id === workItemId);
  if (!replayItem) fail('WORK_ITEM_NOT_REPLAYABLE', 'Only a declared replay-only work item can use retained provider output.', { work_item_id: workItemId || null });
  const pinnedManifest = manifest || loadPinnedManifest(rootDir);
  const validation = validateUnifiedRunManifest({ manifest: pinnedManifest, root_dir: rootDir });
  const item = validation.semantic_manifest.work_items.find((entry) => entry.work_item_id === workItemId);
  const prior = firstExecutionResult.work_results.find((entry) => entry.work_item_id === workItemId);
  if (!item || !prior?.provider_recording?.provider_output || prior.work_result_id !== replayItem.first_work_result_id
    || prior.provider_recording.provider_recording_id !== replayItem.provider_recording_id) {
    fail('REPLAY_RECORDING_MISMATCH', 'The retained provider recording no longer matches the replay plan.', { work_item_id: workItemId });
  }
  const source = pinnedManifest.sources.find((entry) => entry.source_id === item.source_id);
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: rootDir });
  const providerOutput = prior.provider_recording.provider_output;
  const runReceipt = await runNativeExtraction({
    source_text: admitted.context.canonical_text.text,
    document_hash: admitted.context.document_hash,
    section_references: [item.section_reference],
    section_family_assignments: [{
      section_reference: item.section_reference,
      family_id: item.family_id,
      ...(item.family_id === 'INTERIM_OPERATING' ? { covenant_side: 'TARGET' } : {}),
    }],
    contract_bundle: contractBundle,
    definitions,
    provider: async () => providerOutput,
  });
  const resolution = resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admitted.context,
  });
  const body = {
    schema_version: REPLAY_RESULT_SCHEMA,
    iteration_2_rerun_plan_id: plan.iteration_2_rerun_plan_id,
    work_item_id: workItemId,
    first_work_result_id: prior.work_result_id,
    provider_recording_id: prior.provider_recording.provider_recording_id,
    model_call_count: 0,
    run_receipt: runReceipt,
    resolution,
  };
  return Object.freeze({ ...body, replay_result_id: contentId(REPLAY_RESULT_SCHEMA, body) });
}

module.exports = {
  ITERATION_2_PROFILE_DECISIONS_SCHEMA,
  ITERATION_2_RERUN_PLAN_SCHEMA,
  PRESERVED_CHECKPOINT_SET_SCHEMA,
  REPLAY_RESULT_SCHEMA,
  Iteration2RerunPlannerError,
  planIteration2Rerun,
  replayRetainedProviderOutput,
};
