'use strict';

const { contentId } = require('../canonical-bytes');
const { compileFixtureContractV34 } = require('../contract-bundle');
const { resolveCandidates } = require('./candidate-resolution');
const { createCodexCliProvider, PROFILES } = require('./codex-cli-provider');
const { runNativeExtraction } = require('./native-extraction-run');
const {
  validateUnifiedRunManifest,
  loadAdmittedSourceForExecution,
} = require('./unified-runner-validate');

const EXECUTION_RESULT_SCHEMA = 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1';
const WORK_RESULT_SCHEMA = 'NATIVE_UNIFIED_RUN_WORK_RESULT/V1';
const PROVIDER_RECORDING_SCHEMA = 'NATIVE_UNIFIED_RUN_PROVIDER_RECORDING/V1';
const CONTROLS_SCHEMA = 'NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS/V1';
const CHECKPOINT_SCHEMA = 'NATIVE_UNIFIED_RUN_CHECKPOINT/V1';
const VALIDATION_EVIDENCE_SCHEMA = 'NATIVE_UNIFIED_RUN_VALIDATION_EVIDENCE/V1';
const ITERATION_2_MAX_MODEL_INVOCATIONS = 2;
const ITERATION_2_LIVE_WORK_ITEM_PROFILES = Object.freeze({
  'topbuild-no-shop-company-4-3': 'SOL_HIGH',
  'topbuild-remedies-specific-performance-7-6': 'TERRA_MEDIUM',
});

class NativeUnifiedRunExecutionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeUnifiedRunExecutionError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new NativeUnifiedRunExecutionError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validateControls(controls, extractItems) {
  if (!Array.isArray(controls) || controls.length !== extractItems.length) {
    fail('INVALID_CONTROLS', 'work_item_controls must contain one row for every EXTRACT work item.');
  }
  const extractById = new Map(extractItems.map((item) => [item.work_item_id, item]));
  const byId = new Map();
  controls.forEach((control, index) => {
    if (!exactKeys(control, ['work_item_id', 'profile_id', 'covenant_side'])) {
      fail('INVALID_CONTROLS', `work_item_controls[${index}] has unknown or missing fields.`);
    }
    if (typeof control.work_item_id !== 'string' || !extractById.has(control.work_item_id)
      || byId.has(control.work_item_id)) {
      fail('INVALID_CONTROLS', `work_item_controls[${index}] must name one unique EXTRACT work item.`);
    }
    if (!PROFILES[control.profile_id]) {
      fail('INVALID_CONTROLS', `work_item_controls[${index}] names an unknown provider profile.`);
    }
    const item = extractById.get(control.work_item_id);
    if (item.family_id === 'INTERIM_OPERATING') {
      if (!['BUYER', 'TARGET'].includes(control.covenant_side)) {
        fail('INVALID_CONTROLS', `work_item_controls[${index}] must bind the IOC covenant side.`);
      }
    } else if (control.covenant_side !== null) {
      fail('INVALID_CONTROLS', `work_item_controls[${index}] cannot bind a covenant side outside IOC.`);
    }
    byId.set(control.work_item_id, Object.freeze({ ...control }));
  });
  return byId;
}

function validateIteration2LiveLaunch({ manifest, work_item_controls: workItemControls } = {}) {
  const expectedEntries = Object.entries(ITERATION_2_LIVE_WORK_ITEM_PROFILES)
    .sort(([left], [right]) => left.localeCompare(right));
  const extractItems = manifest && Array.isArray(manifest.work_items)
    ? manifest.work_items.filter((item) => item && item.disposition === 'EXTRACT')
    : [];
  const actualIds = extractItems.map((item) => item.work_item_id).sort();
  const expectedIds = expectedEntries.map(([workItemId]) => workItemId);
  if (!manifest || !Array.isArray(manifest.work_items)
    || manifest.work_items.length !== expectedIds.length
    || JSON.stringify(actualIds) !== JSON.stringify(expectedIds)
    || extractItems.length !== expectedIds.length) {
    fail('ITERATION_2_WORK_ITEM_SET_MISMATCH', 'iteration 2 permits exactly its two declared live work items.');
  }
  if (!Array.isArray(workItemControls) || workItemControls.length !== expectedEntries.length) {
    fail('ITERATION_2_CONTROL_MISMATCH', 'iteration 2 requires one exact control for each declared live work item.');
  }
  const controlsById = new Map();
  for (const control of workItemControls) {
    if (!control || typeof control !== 'object' || controlsById.has(control.work_item_id)) {
      fail('ITERATION_2_CONTROL_MISMATCH', 'iteration 2 controls must be unique closed rows.');
    }
    controlsById.set(control.work_item_id, control);
  }
  for (const [workItemId, profileId] of expectedEntries) {
    const control = controlsById.get(workItemId);
    if (!control || control.profile_id !== profileId || control.covenant_side !== null) {
      fail('ITERATION_2_CONTROL_MISMATCH', `iteration 2 must bind ${workItemId} to ${profileId}.`);
    }
  }
  return Object.freeze({
    max_model_invocations: ITERATION_2_MAX_MODEL_INVOCATIONS,
    work_item_ids: Object.freeze(expectedIds),
  });
}

async function mapConcurrent(values, limit, fn) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 4) {
    fail('INVALID_CONCURRENCY', 'max_concurrency must be an integer from 1 to 4.');
  }
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await fn(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function buildProviderRecording(item, providerOutput) {
  if (!providerOutput) return null;
  const body = {
    schema_version: PROVIDER_RECORDING_SCHEMA,
    work_item_id: item.work_item_id,
    provider_output: providerOutput,
  };
  return Object.freeze({
    ...body,
    provider_recording_id: contentId(PROVIDER_RECORDING_SCHEMA, body),
  });
}

function failureResult(item, control, error, providerOutput, failureStage = null) {
  const failedProviderOutput = providerOutput || error?.details?.provider_output || null;
  const body = {
    schema_version: WORK_RESULT_SCHEMA,
    work_item_id: item.work_item_id,
    source_id: item.source_id,
    family_id: item.family_id,
    profile_id: control.profile_id,
    status: 'FAILED',
    failure_code: typeof error?.code === 'string' ? error.code : 'UNEXPECTED_EXECUTION_FAILURE',
    failure_stage: failureStage || (failedProviderOutput ? 'POST_PROVIDER_VALIDATION' : 'PROVIDER_CALL'),
    run_receipt: null,
    resolution: null,
    provider_recording: buildProviderRecording(item, failedProviderOutput),
  };
  return Object.freeze({ ...body, work_result_id: contentId(WORK_RESULT_SCHEMA, body) });
}

function checkpointContext(validation, contractBundle) {
  return Object.freeze({
    validation_receipt_id: validation.receipt.validation_receipt_id,
    semantic_manifest_id: validation.semantic_manifest.semantic_manifest_id,
    execution_plan_id: validation.execution_plan.execution_plan_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
}

function buildCheckpoint(workResult, context) {
  const body = {
    schema_version: CHECKPOINT_SCHEMA,
    ...context,
    work_result: workResult,
  };
  return Object.freeze({ ...body, checkpoint_id: contentId(CHECKPOINT_SCHEMA, body) });
}

function validateProviderRecording(recording, item) {
  if (!exactKeys(recording, ['schema_version', 'work_item_id', 'provider_output', 'provider_recording_id'])
    || recording.schema_version !== PROVIDER_RECORDING_SCHEMA
    || recording.work_item_id !== item.work_item_id
    || !recording.provider_output || typeof recording.provider_output !== 'object'
    || typeof recording.provider_output.raw_response_text !== 'string') {
    fail('INVALID_RESUME_CHECKPOINT', `checkpoint for ${item.work_item_id} has an incomplete provider recording.`);
  }
  const body = {
    schema_version: recording.schema_version,
    work_item_id: recording.work_item_id,
    provider_output: recording.provider_output,
  };
  if (recording.provider_recording_id !== contentId(PROVIDER_RECORDING_SCHEMA, body)) {
    fail('INVALID_RESUME_CHECKPOINT', `checkpoint for ${item.work_item_id} has a provider recording identity mismatch.`);
  }
}

function validateCheckpointWorkResult(workResult, item, control) {
  const keys = ['schema_version', 'work_item_id', 'source_id', 'family_id', 'profile_id', 'status',
    'failure_code', 'failure_stage', 'run_receipt', 'resolution', 'provider_recording', 'work_result_id'];
  if (!exactKeys(workResult, keys)
    || workResult.schema_version !== WORK_RESULT_SCHEMA
    || workResult.work_item_id !== item.work_item_id
    || workResult.source_id !== item.source_id
    || workResult.family_id !== item.family_id
    || workResult.profile_id !== control.profile_id
    || !['SUCCEEDED', 'FAILED'].includes(workResult.status)) {
    fail('INVALID_RESUME_CHECKPOINT', `checkpoint does not match EXTRACT work item ${item.work_item_id}.`);
  }
  const body = { ...workResult };
  delete body.work_result_id;
  if (workResult.work_result_id !== contentId(WORK_RESULT_SCHEMA, body)) {
    fail('INVALID_RESUME_CHECKPOINT', `checkpoint for ${item.work_item_id} has a work result identity mismatch.`);
  }
  if (workResult.status === 'SUCCEEDED') {
    if (workResult.failure_code !== null || workResult.failure_stage !== null
      || !workResult.run_receipt || !workResult.resolution || !workResult.provider_recording) {
      fail('INVALID_RESUME_CHECKPOINT', `successful checkpoint for ${item.work_item_id} is incomplete.`);
    }
    validateProviderRecording(workResult.provider_recording, item);
  }
}

function validateResumeCheckpoints(checkpoints, extractItems, controlsById, context) {
  if (checkpoints === undefined) return new Map();
  if (!Array.isArray(checkpoints)) fail('INVALID_RESUME_CHECKPOINTS', 'resume_checkpoints must be an array when supplied.');
  const itemsById = new Map(extractItems.map((item) => [item.work_item_id, item]));
  const resumed = new Map();
  checkpoints.forEach((checkpoint, index) => {
    if (!exactKeys(checkpoint, ['schema_version', 'validation_receipt_id', 'semantic_manifest_id', 'execution_plan_id', 'contract_fingerprint', 'work_result', 'checkpoint_id'])
      || checkpoint.schema_version !== CHECKPOINT_SCHEMA
      || checkpoint.validation_receipt_id !== context.validation_receipt_id
      || checkpoint.semantic_manifest_id !== context.semantic_manifest_id
      || checkpoint.execution_plan_id !== context.execution_plan_id
      || checkpoint.contract_fingerprint !== context.contract_fingerprint) {
      fail('INVALID_RESUME_CHECKPOINT', `resume_checkpoints[${index}] does not belong to this validated execution.`);
    }
    const checkpointBody = { ...checkpoint };
    delete checkpointBody.checkpoint_id;
    if (checkpoint.checkpoint_id !== contentId(CHECKPOINT_SCHEMA, checkpointBody)) {
      fail('INVALID_RESUME_CHECKPOINT', `resume_checkpoints[${index}] has a checkpoint identity mismatch.`);
    }
    const item = itemsById.get(checkpoint.work_result && checkpoint.work_result.work_item_id);
    if (!item) fail('INVALID_RESUME_CHECKPOINT', `resume_checkpoints[${index}] names an unknown work item.`);
    validateCheckpointWorkResult(checkpoint.work_result, item, controlsById.get(item.work_item_id));
    if (checkpoint.work_result.status === 'SUCCEEDED') {
      const prior = resumed.get(item.work_item_id);
      if (prior && prior.work_result_id !== checkpoint.work_result.work_result_id) {
        fail('AMBIGUOUS_RESUME_CHECKPOINT', `multiple successful checkpoints exist for ${item.work_item_id}.`);
      }
      resumed.set(item.work_item_id, checkpoint.work_result);
    }
  });
  return resumed;
}

function validationEvidence(manifest, validation) {
  const declarationsById = new Map(manifest.work_items.map((item) => [item.work_item_id, item]));
  const sourcesById = new Map(manifest.sources.map((source) => [source.source_id, source]));
  const nonExtract = validation.semantic_manifest.work_items
    .filter((item) => item.disposition !== 'EXTRACT')
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id))
    .map((item) => Object.freeze({
      semantic_work_item: item,
      declared_work_item: declarationsById.get(item.work_item_id),
      source_declaration: item.disposition === 'BLOCKED_SOURCE_PIN'
        ? sourcesById.get(item.source_id)
        : null,
    }));
  return Object.freeze({
    schema_version: VALIDATION_EVIDENCE_SCHEMA,
    receipt: validation.receipt,
    semantic_manifest: validation.semantic_manifest,
    execution_plan: validation.execution_plan,
    non_extract_evidence: Object.freeze(nonExtract),
  });
}

async function executeUnifiedRun({
  manifest,
  work_item_controls: workItemControls,
  root_dir: rootDir = process.cwd(),
  max_concurrency: maxConcurrency = 2,
  max_model_invocations: maxModelInvocations = Infinity,
  provider_factory: providerFactory = createCodexCliProvider,
  on_work_result: onWorkResult = async () => {},
  resume_checkpoints: resumeCheckpoints,
  contract_bundle: contractBundle = compileFixtureContractV34(),
  definitions = Object.freeze({ known_definitions: Object.freeze([]) }),
} = {}) {
  if (typeof providerFactory !== 'function') fail('INVALID_PROVIDER_FACTORY', 'provider_factory must be a function.');
  if (typeof onWorkResult !== 'function') fail('INVALID_WORK_RESULT_HANDLER', 'on_work_result must be a function.');
  if (maxModelInvocations !== Infinity
    && (!Number.isSafeInteger(maxModelInvocations) || maxModelInvocations < 0)) {
    fail('INVALID_MAX_MODEL_INVOCATIONS', 'max_model_invocations must be a non-negative safe integer.');
  }
  const validation = validateUnifiedRunManifest({ manifest, root_dir: rootDir });
  const extractItems = validation.semantic_manifest.work_items
    .filter((item) => item.disposition === 'EXTRACT');
  const controlsById = validateControls(workItemControls, extractItems);
  const context = checkpointContext(validation, contractBundle);
  const resumedById = validateResumeCheckpoints(
    resumeCheckpoints,
    extractItems,
    controlsById,
    context,
  );
  const sourceDeclarationById = new Map(manifest.sources.map((source) => [source.source_id, source]));
  const admittedById = new Map();
  for (const sourceId of new Set(extractItems.map((item) => item.source_id))) {
    admittedById.set(sourceId, loadAdmittedSourceForExecution({
      source: sourceDeclarationById.get(sourceId),
      root_dir: rootDir,
    }));
  }
  const providerByProfile = new Map();
  let modelInvocationCount = 0;
  function providerFor(profileId) {
    if (!providerByProfile.has(profileId)) {
      providerByProfile.set(profileId, providerFactory({ profileId }));
    }
    return providerByProfile.get(profileId);
  }

  const pendingItems = extractItems.filter((item) => !resumedById.has(item.work_item_id));
  const newWorkResults = await mapConcurrent(pendingItems, maxConcurrency, async (item) => {
    const control = controlsById.get(item.work_item_id);
    const admitted = admittedById.get(item.source_id);
    let providerOutput = null;
    const recordingProvider = async (input) => {
      if (modelInvocationCount >= maxModelInvocations) {
        fail('MAX_MODEL_INVOCATIONS_EXCEEDED', 'The configured model invocation limit has been reached.');
      }
      modelInvocationCount += 1;
      providerOutput = await providerFor(control.profile_id)(input);
      return providerOutput;
    };
    let workResult;
    try {
      const runReceipt = await runNativeExtraction({
        source_text: admitted.context.canonical_text.text,
        document_hash: admitted.context.document_hash,
        section_references: [item.section_reference],
        contract_bundle: contractBundle,
        definitions,
        provider: recordingProvider,
        section_family_assignments: [{
          section_reference: item.section_reference,
          family_id: item.family_id,
          ...(control.covenant_side === null ? {} : { covenant_side: control.covenant_side }),
        }],
      });
      const resolution = resolveCandidates({
        run_receipt: runReceipt,
        contract_vocabulary: contractBundle,
        admitted_source_context: admitted.context,
      });
      const providerRecording = buildProviderRecording(item, providerOutput);
      const body = {
        schema_version: WORK_RESULT_SCHEMA,
        work_item_id: item.work_item_id,
        source_id: item.source_id,
        family_id: item.family_id,
        profile_id: control.profile_id,
        status: 'SUCCEEDED',
        failure_code: null,
        failure_stage: null,
        run_receipt: runReceipt,
        resolution,
        provider_recording: providerRecording,
      };
      workResult = Object.freeze({ ...body, work_result_id: contentId(WORK_RESULT_SCHEMA, body) });
    } catch (error) {
      workResult = failureResult(item, control, error, providerOutput);
    }
    const checkpoint = buildCheckpoint(workResult, context);
    try {
      await onWorkResult(workResult, checkpoint);
      return workResult;
    } catch (error) {
      return failureResult(
        item,
        control,
        new NativeUnifiedRunExecutionError(
          'CHECKPOINT_WRITE_FAILED',
          `checkpoint write failed for ${item.work_item_id}: ${error instanceof Error ? error.message : String(error)}`,
        ),
        providerOutput,
        'CHECKPOINT_WRITE',
      );
    }
  });

  const workResults = [...resumedById.values(), ...newWorkResults];
  const sortedResults = Object.freeze([...workResults].sort((a, b) => a.work_item_id.localeCompare(b.work_item_id)));
  const body = {
    schema_version: EXECUTION_RESULT_SCHEMA,
    validation_receipt_id: validation.receipt.validation_receipt_id,
    semantic_manifest_id: validation.semantic_manifest.semantic_manifest_id,
    execution_plan_id: validation.execution_plan.execution_plan_id,
    contract_fingerprint: contractBundle.fingerprint,
    validation_evidence: validationEvidence(manifest, validation),
    work_results: sortedResults,
    succeeded_count: sortedResults.filter((result) => result.status === 'SUCCEEDED').length,
    failed_count: sortedResults.filter((result) => result.status === 'FAILED').length,
  };
  return Object.freeze({ ...body, execution_result_id: contentId(EXECUTION_RESULT_SCHEMA, body) });
}

module.exports = {
  EXECUTION_RESULT_SCHEMA,
  WORK_RESULT_SCHEMA,
  PROVIDER_RECORDING_SCHEMA,
  CONTROLS_SCHEMA,
  CHECKPOINT_SCHEMA,
  VALIDATION_EVIDENCE_SCHEMA,
  ITERATION_2_MAX_MODEL_INVOCATIONS,
  ITERATION_2_LIVE_WORK_ITEM_PROFILES,
  NativeUnifiedRunExecutionError,
  executeUnifiedRun,
  validateIteration2LiveLaunch,
};
