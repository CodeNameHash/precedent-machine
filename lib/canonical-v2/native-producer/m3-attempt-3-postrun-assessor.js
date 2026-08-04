'use strict';

const { contentId } = require('../canonical-bytes');
const { validateIteration2RerunPlan } = require('./m3-iteration-2-rerun-planner');
const { validateUnifiedRunManifest } = require('./unified-runner-validate');

const ASSESSMENT_SCHEMA = 'M3_12_CALL_ITERATION_2_ATTEMPT_3_POSTRUN_ASSESSMENT/V1';
const EXECUTION_RESULT_SCHEMA = 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1';
const WORK_RESULT_SCHEMA = 'NATIVE_UNIFIED_RUN_WORK_RESULT/V1';
const RUBRIC_SCHEMA = 'M3_12_CALL_ITERATION_2_LIVE_INDEPENDENT_REVIEW_RUBRIC/V2';
const ACCEPTANCE_SCHEMA = 'M3_MODEL_RERUN_ACCEPTANCE_CHECKLIST/V2';
const ATTEMPT_3_PLAN_ID = '366e413aadc1deaa6a8be25286149f79d839b09ee17533f697bc91f1ee7de70b';
const ATTEMPT_3_RUBRIC_HASH = '56c811c626389b4baffef5e739276c1ff03130be40b4ccf9798fd5b81a4b68bd';

class Attempt3PostrunAssessorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new Attempt3PostrunAssessorError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function countBy(values, field) {
  const counts = new Map();
  for (const value of values) {
    const key = typeof field === 'function' ? field(value) : value && value[field];
    if (typeof key !== 'string' || !key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.freeze(Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right))));
}

function verifyContentHash(value, field, schema, code) {
  if (!value || typeof value !== 'object' || !isDigest(value[field])) {
    fail(code, 'A sealed artifact is missing its content hash.');
  }
  const body = { ...value };
  delete body[field];
  if (contentId(schema, body) !== value[field]) {
    fail(code, 'A sealed artifact content hash does not match its bytes.');
  }
}

function validateRubric(rubric, planPolicy) {
  if (!rubric || rubric.schema_version !== RUBRIC_SCHEMA || rubric.content_hash !== ATTEMPT_3_RUBRIC_HASH) {
    fail('INVALID_RUBRIC', 'The sealed attempt-3 V2 review rubric is required.');
  }
  verifyContentHash(rubric, 'content_hash', RUBRIC_SCHEMA, 'INVALID_RUBRIC');
  if (rubric.bindings?.iteration_2_rerun_plan_id !== planPolicy.iteration_2_rerun_plan_id
    || !Array.isArray(rubric.items)) {
    fail('RUBRIC_PLAN_MISMATCH', 'The review rubric must bind the supplied sealed plan.');
  }
  const byId = new Map();
  for (const item of rubric.items) {
    if (!item || typeof item.work_item_id !== 'string' || byId.has(item.work_item_id)
      || typeof item.profile_id !== 'string' || !item.source || !Array.isArray(item.review)) {
      fail('INVALID_RUBRIC', 'The review rubric must contain unique complete work-item rows.');
    }
    byId.set(item.work_item_id, item);
  }
  const policyIds = Object.keys(planPolicy.live_work_item_profiles).sort();
  if (JSON.stringify([...byId.keys()].sort()) !== JSON.stringify(policyIds)) {
    fail('RUBRIC_WORK_ITEM_MISMATCH', 'The review rubric must cover exactly the sealed live work-item set.');
  }
  for (const workItemId of policyIds) {
    const item = byId.get(workItemId);
    if (item.profile_id !== planPolicy.live_work_item_profiles[workItemId]
      || item.source.source_id !== planPolicy.live_work_item_context[workItemId].source_id) {
      fail('RUBRIC_WORK_ITEM_MISMATCH', 'The review rubric source or profile differs from the sealed plan.', { work_item_id: workItemId });
    }
  }
  return byId;
}

function validateAcceptanceChecklist(checklist, rubric) {
  if (!checklist || checklist.schema_version !== ACCEPTANCE_SCHEMA
    || checklist.content_hash !== rubric.bindings?.acceptance_checklist?.content_hash) {
    fail('INVALID_ACCEPTANCE_CHECKLIST', 'The sealed V2 acceptance checklist must match the rubric binding.');
  }
  verifyContentHash(checklist, 'content_hash', ACCEPTANCE_SCHEMA, 'INVALID_ACCEPTANCE_CHECKLIST');
  const byId = new Map();
  for (const item of checklist.items || []) {
    if (!item || typeof item.work_item_id !== 'string' || byId.has(item.work_item_id)) {
      fail('INVALID_ACCEPTANCE_CHECKLIST', 'The acceptance checklist contains duplicate or incomplete items.');
    }
    byId.set(item.work_item_id, item);
  }
  for (const item of rubric.items) {
    if (!byId.has(item.work_item_id)) {
      fail('ACCEPTANCE_WORK_ITEM_MISSING', 'Every live work item must have an acceptance checklist entry.', { work_item_id: item.work_item_id });
    }
  }
  return byId;
}

function validateLiveExecution(execution, expectedById) {
  const keys = [
    'schema_version', 'validation_receipt_id', 'semantic_manifest_id', 'execution_plan_id',
    'contract_fingerprint', 'validation_evidence', 'work_results', 'succeeded_count',
    'failed_count', 'execution_result_id',
  ];
  if (!exactKeys(execution, keys) || execution.schema_version !== EXECUTION_RESULT_SCHEMA
    || !Array.isArray(execution.work_results) || !isDigest(execution.execution_result_id)) {
    fail('INVALID_LIVE_EXECUTION', 'The live execution result has an invalid sealed shape.');
  }
  const body = { ...execution };
  delete body.execution_result_id;
  if (contentId(EXECUTION_RESULT_SCHEMA, body) !== execution.execution_result_id
    || execution.work_results.length !== expectedById.size
    || execution.succeeded_count + execution.failed_count !== expectedById.size) {
    fail('INVALID_LIVE_EXECUTION', 'The live execution result does not seal exactly the eight live work items.');
  }
  const byId = new Map();
  let succeeded = 0;
  let failed = 0;
  for (const result of execution.work_results) {
    const expected = expectedById.get(result?.work_item_id);
    const resultBody = result && { ...result };
    if (resultBody) delete resultBody.work_result_id;
    if (!expected || byId.has(result.work_item_id) || result.schema_version !== WORK_RESULT_SCHEMA
      || result.source_id !== expected.source_id || result.family_id !== expected.family_id
      || result.profile_id !== expected.profile_id || !['SUCCEEDED', 'FAILED'].includes(result.status)
      || !isDigest(result.work_result_id) || contentId(WORK_RESULT_SCHEMA, resultBody) !== result.work_result_id) {
      fail('INVALID_LIVE_WORK_RESULT', 'A live work result does not match the sealed live plan.', {
        work_item_id: result?.work_item_id || null,
      });
    }
    if (result.status === 'SUCCEEDED') succeeded += 1;
    else failed += 1;
    byId.set(result.work_item_id, result);
  }
  if (succeeded !== execution.succeeded_count || failed !== execution.failed_count) {
    fail('INVALID_LIVE_EXECUTION', 'The live execution counts do not match its work results.');
  }
  return byId;
}

function successMetrics(result) {
  const receipt = result.run_receipt;
  const resolution = result.resolution;
  if (!receipt || !resolution || !Array.isArray(receipt.compiled_candidates)
    || !Array.isArray(receipt.evidence_residuals) || !Array.isArray(receipt.scope_violations)
    || !Array.isArray(receipt.citation_residuals) || !Array.isArray(resolution.resolved)
    || !Array.isArray(resolution.review_queue) || !Array.isArray(resolution.open_world)
    || !Array.isArray(resolution.residuals)) {
    fail('INCOMPLETE_LIVE_OUTPUT', 'A successful live result must retain its complete deterministic output.', {
      work_item_id: result.work_item_id,
    });
  }
  const compiledCount = receipt.compiled_candidates.filter((entry) => entry?.ok === true).length;
  const rejectedCount = receipt.compiled_candidates.length - compiledCount;
  const resolutionCounts = resolution.resolution_receipt?.counts;
  if (!nonNegativeInteger(receipt.compiled_candidate_count)
    || !nonNegativeInteger(receipt.rejected_candidate_count)
    || receipt.compiled_candidate_count !== compiledCount
    || receipt.rejected_candidate_count !== rejectedCount
    || !resolutionCounts || !nonNegativeInteger(resolutionCounts.resolved)
    || !nonNegativeInteger(resolutionCounts.review_queue)
    || !nonNegativeInteger(resolutionCounts.open_world)
    || resolutionCounts.resolved !== resolution.resolved.length
    || resolutionCounts.review_queue !== resolution.review_queue.length
    || resolutionCounts.open_world !== resolution.open_world.length) {
    fail('OUTPUT_COUNT_MISMATCH', 'A live output has inconsistent retained deterministic counts.', {
      work_item_id: result.work_item_id,
    });
  }
  const accepted = receipt.compiled_candidates.filter((entry) => entry?.citation_validation?.accepted === true);
  const rejected = receipt.compiled_candidates.filter((entry) => entry?.citation_validation?.accepted === false);
  const missing = receipt.compiled_candidates.filter((entry) => !entry?.citation_validation);
  const metrics = {
    compiled_candidate_count: compiledCount,
    rejected_candidate_count: rejectedCount,
    provider_evidence_residual_count: receipt.evidence_residuals.length,
    scope_violation_count: receipt.scope_violations.length,
    citation_residual_count: receipt.citation_residuals.length,
    citation_validation: {
      accepted_count: accepted.length,
      rejected_count: rejected.length,
      missing_count: missing.length,
      status_counts: countBy(receipt.compiled_candidates, (entry) => entry?.citation_validation?.status || 'MISSING'),
    },
    resolved_count: resolution.resolved.length,
    review_queue_count: resolution.review_queue.length,
    open_world_count: resolution.open_world.length,
    resolution_residual_count: resolution.residuals.length,
    residual_reason_counts: {
      provider_evidence: countBy(receipt.evidence_residuals, 'reason'),
      scope: countBy(receipt.scope_violations, 'reason'),
      citation: countBy(receipt.citation_residuals, 'reason'),
      review_queue: countBy(resolution.review_queue, (entry) => (entry?.reasons || []).join('|') || 'NONE'),
      open_world: countBy(resolution.open_world, 'reason'),
      resolution: countBy(resolution.residuals, 'reason'),
    },
  };
  return Object.freeze(metrics);
}

function failedMetrics() {
  return Object.freeze({
    compiled_candidate_count: null,
    rejected_candidate_count: null,
    provider_evidence_residual_count: null,
    scope_violation_count: null,
    citation_residual_count: null,
    citation_validation: null,
    resolved_count: null,
    review_queue_count: null,
    open_world_count: null,
    resolution_residual_count: null,
    residual_reason_counts: null,
  });
}

function assessAttempt3LiveOutputs({
  plan,
  live_manifest: liveManifest,
  live_execution_result: liveExecution,
  acceptance_checklist: checklist,
  rubric,
  root_dir: rootDir = process.cwd(),
} = {}) {
  let policy;
  try {
    policy = validateIteration2RerunPlan({ plan });
  } catch (error) {
    fail('INVALID_ATTEMPT_3_PLAN', error.message, { cause: error.code || error.name });
  }
  if (policy.iteration_2_rerun_plan_id !== ATTEMPT_3_PLAN_ID) {
    fail('ATTEMPT_3_PLAN_MISMATCH', 'The supplied plan is not the sealed attempt-3 plan.');
  }
  let validation;
  try {
    validation = validateUnifiedRunManifest({ manifest: liveManifest, root_dir: rootDir });
  } catch (error) {
    fail('INVALID_LIVE_MANIFEST', error.message, { cause: error.code || error.name });
  }
  const expectedById = new Map();
  for (const item of validation.semantic_manifest.work_items) {
    const profileId = policy.live_work_item_profiles[item.work_item_id];
    if (!profileId || item.source_id !== policy.live_work_item_context[item.work_item_id].source_id
      || item.family_id !== policy.live_work_item_context[item.work_item_id].family_id) {
      fail('LIVE_MANIFEST_PLAN_MISMATCH', 'The live manifest does not match the sealed plan context.', {
        work_item_id: item.work_item_id,
      });
    }
    expectedById.set(item.work_item_id, Object.freeze({
      source_id: item.source_id,
      family_id: item.family_id,
      profile_id: profileId,
    }));
  }
  if (expectedById.size !== policy.max_model_invocations) {
    fail('LIVE_MANIFEST_PLAN_MISMATCH', 'The live manifest must contain exactly the sealed eight work items.');
  }
  const rubricById = validateRubric(rubric, policy);
  const acceptanceById = validateAcceptanceChecklist(checklist, rubric);
  const resultsById = validateLiveExecution(liveExecution, expectedById);
  const worksheets = [...expectedById.keys()].sort().map((workItemId) => {
    const result = resultsById.get(workItemId);
    const rubricItem = rubricById.get(workItemId);
    const acceptanceItem = acceptanceById.get(workItemId);
    const metrics = result.status === 'SUCCEEDED' ? successMetrics(result) : failedMetrics();
    return Object.freeze({
      work_item_id: workItemId,
      source_id: result.source_id,
      family_id: result.family_id,
      profile_id: result.profile_id,
      execution_status: result.status,
      failure: result.status === 'FAILED'
        ? Object.freeze({ code: result.failure_code, stage: result.failure_stage })
        : null,
      result_reference: Object.freeze({
        work_result_id: result.work_result_id,
        run_receipt_id: result.run_receipt?.run_receipt_id || null,
        provider_recording_id: result.provider_recording?.provider_recording_id || null,
      }),
      deterministic_metrics: metrics,
      acceptance_rule: Object.freeze({
        citation_shape: acceptanceItem.citation_shape,
        required_claims: acceptanceItem.required_claims,
        material_qualifiers: acceptanceItem.material_qualifiers,
        must_remain_open_world: acceptanceItem.must_remain_open_world,
      }),
      reviewer_instructions: rubricItem.review,
      automatic_legal_disposition: 'NOT_DETERMINED',
      independent_review_state: 'PENDING_INDEPENDENT_LEGAL_REVIEW',
    });
  });
  const body = {
    schema_version: ASSESSMENT_SCHEMA,
    iteration_2_rerun_plan_id: policy.iteration_2_rerun_plan_id,
    first_execution_result_id: plan.first_execution_result_id,
    live_execution_result_id: liveExecution.execution_result_id,
    live_manifest_validation_receipt_id: validation.receipt.validation_receipt_id,
    acceptance_checklist_content_hash: checklist.content_hash,
    rubric_content_hash: rubric.content_hash,
    model_call_count: 0,
    automatic_legal_passes: 0,
    worksheets: Object.freeze(worksheets),
  };
  return Object.freeze({ ...body, postrun_assessment_id: contentId(ASSESSMENT_SCHEMA, body) });
}

module.exports = {
  ASSESSMENT_SCHEMA,
  ATTEMPT_3_PLAN_ID,
  ATTEMPT_3_RUBRIC_HASH,
  Attempt3PostrunAssessorError,
  assessAttempt3LiveOutputs,
};
