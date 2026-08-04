'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');

const ADVERSARIAL_AUDIT_INPUT_SCHEMA = 'M3_12_CALL_ITERATION_2_ADVERSARIAL_AUDIT_INPUT/V1';
const AUDIT_PROFILE_ID = 'SOL_HIGH';
const AUDIT_MODEL_CALL_COUNT = 1;
const AUDIT_EXECUTION_STATE = 'SEALED_NOT_EXECUTED';
const REQUIRED_QUESTION_AREAS = Object.freeze([
  'FALSE_POSITIVES',
  'FALSE_NEGATIVES',
  'TAXONOMY_LEAKAGE',
  'CITATION_INTEGRITY',
  'RESOLVER_OVERREACH',
  'ALL_FAMILIES_AND_FULL_CORPUS_LESSONS',
]);

const AUDIT_QUESTIONS = Object.freeze([
  Object.freeze({
    question_id: 'FALSE_POSITIVES',
    prompt: 'Identify each published claim that lacks complete source support, has an overbroad scope, or should remain open-world.',
  }),
  Object.freeze({
    question_id: 'FALSE_NEGATIVES',
    prompt: 'Identify material source-supported claims, limbs or exceptions that the live output omitted or left unclassified.',
  }),
  Object.freeze({
    question_id: 'TAXONOMY_LEAKAGE',
    prompt: 'Identify any claim assigned to the wrong legal family, party, clause, concept or controlled value, including cross-family ownership leakage.',
  }),
  Object.freeze({
    question_id: 'CITATION_INTEGRITY',
    prompt: 'Verify every citation resolves to the exact governing source text and section, including chapeaux, child limbs, defined terms and qualifiers.',
  }),
  Object.freeze({
    question_id: 'RESOLVER_OVERREACH',
    prompt: 'Identify resolver decisions that converted ambiguity, a partial match or an unstated premise into a published controlled claim.',
  }),
  Object.freeze({
    question_id: 'ALL_FAMILIES_AND_FULL_CORPUS_LESSONS',
    prompt: 'State lessons that apply across every family and to full-corpus extraction. Separate evidence from hypotheses and name the validation needed before promotion.',
  }),
]);

class Iteration2AdversarialAuditError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new Iteration2AdversarialAuditError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function digest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function commitId(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim() && value.trim() === value;
}

function sortedUnique(values) {
  return Array.isArray(values) && values.every(nonEmptyText)
    && new Set(values).size === values.length
    && canonicalJson(values) === canonicalJson([...values].sort());
}

function liveWorkItemIds(plan) {
  if (!plan || !Array.isArray(plan.live_terra_work_items) || !Array.isArray(plan.live_sol_work_items)) {
    fail('INVALID_ATTEMPT_3_PLAN', 'The attempt-3 plan must contain the sealed Terra and Sol live work-item lists.');
  }
  const profiles = new Map();
  for (const item of plan.live_terra_work_items) {
    if (!item || !nonEmptyText(item.work_item_id) || profiles.has(item.work_item_id)) {
      fail('INVALID_ATTEMPT_3_PLAN', 'The sealed plan must contain unique live work-item IDs.');
    }
    profiles.set(item.work_item_id, 'TERRA_MEDIUM');
  }
  for (const item of plan.live_sol_work_items) {
    if (!item || !nonEmptyText(item.work_item_id) || profiles.has(item.work_item_id)) {
      fail('INVALID_ATTEMPT_3_PLAN', 'The sealed plan must contain unique live work-item IDs.');
    }
    profiles.set(item.work_item_id, 'SOL_HIGH');
  }
  if (profiles.size !== 8) fail('INVALID_ATTEMPT_3_PLAN', 'The sealed plan must contain exactly eight live work items.');
  return profiles;
}

function validateFirstPassReviewReports(reports) {
  if (!Array.isArray(reports) || reports.length !== 2) {
    fail('INVALID_FIRST_PASS_FINDINGS', 'The audit requires both sealed first-pass independent-review reports.');
  }
  const findings = new Map();
  let adapterId = null;
  for (const report of reports) {
    if (!report || report.schema_version !== 'M3_12_CALL_PILOT_INDEPENDENT_REVIEW_FINDINGS/V1'
      || report.reviewer_kind !== 'INDEPENDENT' || !digest(report.review_packet_adapter_id)
      || !digest(report.independent_review_findings_id) || !Array.isArray(report.findings)
      || report.findings.length !== 6) {
      fail('INVALID_FIRST_PASS_FINDINGS', 'Each first-pass report must be a sealed six-item independent-review finding set.');
    }
    if (adapterId && adapterId !== report.review_packet_adapter_id) {
      fail('FIRST_PASS_FINDING_BINDING_MISMATCH', 'The first-pass reports must bind to one review-packet adapter.');
    }
    adapterId = report.review_packet_adapter_id;
    for (const finding of report.findings) {
      if (!finding || !nonEmptyText(finding.work_item_id) || findings.has(finding.work_item_id)
        || !digest(finding.review_packet_id) || finding.reviewer_kind !== 'INDEPENDENT'
        || !['PASS', 'FAIL'].includes(finding.status) || !nonEmptyText(finding.reason)) {
        fail('INVALID_FIRST_PASS_FINDINGS', 'First-pass findings must be complete, unique independent review rows.');
      }
      findings.set(finding.work_item_id, finding);
    }
  }
  if (findings.size !== 12) fail('INVALID_FIRST_PASS_FINDINGS', 'First-pass review evidence must cover all twelve pilot work items.');
  return findings;
}

function validateAttempt3Inputs({ plan, quality_gate: gate, acceptance_checklist_v2: checklist, revised_decision_vector_v3: vector } = {}) {
  const profiles = liveWorkItemIds(plan);
  if (!digest(plan.iteration_2_rerun_plan_id) || !digest(plan.first_execution_result_id)
    || !digest(plan.quality_gate_id) || !plan.controls || plan.controls.live_model_call_count !== profiles.size
    || plan.controls.replay_model_call_count !== 0) {
    fail('INVALID_ATTEMPT_3_PLAN', 'The sealed attempt-3 plan must retain its IDs and eight-call live limit.');
  }
  if (!gate || gate.schema_version !== 'M3_12_CALL_PILOT_QUALITY_GATE/V1'
    || gate.quality_gate_id !== plan.quality_gate_id || !Array.isArray(gate.work_item_findings)
    || gate.work_item_findings.length !== 12) {
    fail('ATTEMPT_3_GATE_MISMATCH', 'The attempt-3 plan must bind to the complete sealed first-pass quality gate.');
  }
  if (!checklist || checklist.schema_version !== 'M3_MODEL_RERUN_ACCEPTANCE_CHECKLIST/V2'
    || checklist.execution_result_id !== plan.first_execution_result_id || !digest(checklist.content_hash)
    || !Array.isArray(checklist.items) || checklist.items.length !== 10) {
    fail('ATTEMPT_3_CHECKLIST_MISMATCH', 'The audit requires the sealed V2 checklist for the original execution result.');
  }
  if (!vector || vector.schema_version !== 'M3_12_CALL_ITERATION_2_REVISED_DECISION_VECTOR/V3'
    || !digest(vector.content_hash) || vector.actual_model_call_count !== 0 || !vector.bindings
    || vector.bindings.first_execution_result_id !== plan.first_execution_result_id
    || vector.bindings.quality_gate_id !== plan.quality_gate_id
    || vector.bindings.iteration_2_rerun_plan_id !== plan.iteration_2_rerun_plan_id
    || vector.bindings.acceptance_checklist?.content_hash !== checklist.content_hash
    || !Array.isArray(vector.decisions) || vector.decisions.length !== 12) {
    fail('ATTEMPT_3_VECTOR_MISMATCH', 'The audit requires the sealed V3 decision vector bound to this plan, gate and V2 checklist.');
  }
  const decisionById = new Map(vector.decisions.map((decision) => [decision && decision.work_item_id, decision]));
  if (decisionById.size !== 12 || [...profiles].some(([workItemId, profileId]) => {
    const decision = decisionById.get(workItemId);
    return !decision || decision.action !== 'LIVE' || decision.profile_id !== profileId;
  })) {
    fail('ATTEMPT_3_VECTOR_MISMATCH', 'The V3 vector must retain the exact eight planned live profile decisions.');
  }
  return profiles;
}

function derivePostRunMetrics({ plan, live_execution: execution } = {}) {
  const profiles = liveWorkItemIds(plan);
  if (!execution || execution.schema_version !== 'NATIVE_UNIFIED_RUN_EXECUTION_RESULT/V1'
    || !digest(execution.execution_result_id) || !Array.isArray(execution.work_results)
    || execution.work_results.length !== profiles.size || execution.succeeded_count !== profiles.size
    || execution.failed_count !== 0) {
    fail('INVALID_LIVE_EXECUTION', 'The audit requires a complete successful eight-item iteration-2 live execution.');
  }
  const results = new Map();
  const profileCounts = { SOL_HIGH: 0, TERRA_MEDIUM: 0 };
  const resolutionTotals = {
    resolved: 0,
    review_queue: 0,
    open_world: 0,
    residuals: 0,
    limb_component_trees: 0,
    ioc_restriction_components: 0,
  };
  for (const result of execution.work_results) {
    if (!result || !nonEmptyText(result.work_item_id) || results.has(result.work_item_id)
      || result.status !== 'SUCCEEDED' || result.failure_code !== null
      || result.profile_id !== profiles.get(result.work_item_id) || !result.resolution) {
      fail('INVALID_LIVE_EXECUTION', 'Each live execution result must be one successful result for its sealed plan profile.');
    }
    for (const [key, value] of Object.entries(resolutionTotals)) {
      if (!Array.isArray(result.resolution[key])) {
        fail('INVALID_LIVE_EXECUTION', 'Each live execution result must retain complete resolver output arrays.');
      }
      resolutionTotals[key] = value + result.resolution[key].length;
    }
    profileCounts[result.profile_id] += 1;
    results.set(result.work_item_id, result);
  }
  if (results.size !== profiles.size) fail('INVALID_LIVE_EXECUTION', 'The live execution result must cover the exact sealed work-item set.');
  return Object.freeze({
    live_work_item_count: profiles.size,
    successful_work_item_count: execution.succeeded_count,
    failed_work_item_count: execution.failed_count,
    planned_and_observed_model_call_count: plan.controls.live_model_call_count,
    profile_counts: Object.freeze(profileCounts),
    resolution_totals: Object.freeze(resolutionTotals),
  });
}

function validateLiveExecutionArtifact(artifact) {
  if (!exactKeys(artifact, ['artifact_path', 'content_sha256'])
    || !nonEmptyText(artifact.artifact_path) || artifact.artifact_path.includes('..')
    || !digest(artifact.content_sha256)) {
    fail('INVALID_LIVE_EXECUTION_ARTIFACT', 'The live execution projection must retain its source artifact path and SHA-256 binding.');
  }
}

function validateFamilyDesignDecisions(decisions) {
  if (!Array.isArray(decisions) || decisions.length === 0) {
    fail('INVALID_FAMILY_DESIGN_DECISIONS', 'The audit requires every available family-design decision.');
  }
  const paths = [];
  for (const decision of decisions) {
    if (!exactKeys(decision, ['document_path', 'document_content_sha256', 'decision_excerpt'])
      || !nonEmptyText(decision.document_path) || decision.document_path.includes('..')
      || !digest(decision.document_content_sha256) || !nonEmptyText(decision.decision_excerpt)) {
      fail('INVALID_FAMILY_DESIGN_DECISIONS', 'Each family-design decision requires a safe path, source digest and decision excerpt.');
    }
    paths.push(decision.document_path);
  }
  if (!sortedUnique(paths)) fail('INVALID_FAMILY_DESIGN_DECISIONS', 'Family-design decisions must use unique sorted document paths.');
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length !== REQUIRED_QUESTION_AREAS.length
    || canonicalJson(questions) !== canonicalJson(AUDIT_QUESTIONS)) {
    fail('INVALID_AUDIT_QUESTIONS', 'The adversarial audit must ask the fixed six cross-cutting questions.');
  }
}

function buildIteration2AdversarialAuditInput({
  pilot_baseline_commit: baselineCommit,
  consolidation_commits: commits,
  first_pass_review_reports: reviewReports,
  attempt_3,
  live_execution: liveExecution,
  live_execution_artifact: liveExecutionArtifact,
  family_design_decisions: familyDecisions,
} = {}) {
  if (!commitId(baselineCommit) || !Array.isArray(commits) || commits.length === 0) {
    fail('INVALID_CONSOLIDATION_HISTORY', 'The audit requires a pilot baseline commit and every later consolidation commit.');
  }
  const commitIds = [];
  for (const commit of commits) {
    if (!exactKeys(commit, ['commit_id', 'subject', 'changed_paths']) || !commitId(commit.commit_id)
      || commit.commit_id === baselineCommit || !nonEmptyText(commit.subject)
      || !sortedUnique(commit.changed_paths)) {
      fail('INVALID_CONSOLIDATION_HISTORY', 'Every consolidation commit requires one ID, subject and sorted changed-path list.');
    }
    commitIds.push(commit.commit_id);
  }
  if (new Set(commitIds).size !== commitIds.length) fail('INVALID_CONSOLIDATION_HISTORY', 'Consolidation commits must be unique.');
  validateFirstPassReviewReports(reviewReports);
  validateAttempt3Inputs(attempt_3);
  const metrics = derivePostRunMetrics({ plan: attempt_3.plan, live_execution: liveExecution });
  validateLiveExecutionArtifact(liveExecutionArtifact);
  validateFamilyDesignDecisions(familyDecisions);
  const body = {
    schema_version: ADVERSARIAL_AUDIT_INPUT_SCHEMA,
    audit_model_profile_id: AUDIT_PROFILE_ID,
    planned_model_call_count: AUDIT_MODEL_CALL_COUNT,
    audit_execution_state: AUDIT_EXECUTION_STATE,
    pilot_baseline_commit: baselineCommit,
    consolidation_commits: Object.freeze(commits.map((commit) => Object.freeze({ ...commit, changed_paths: Object.freeze([...commit.changed_paths]) }))),
    first_pass_review_reports: Object.freeze(reviewReports.map((report) => Object.freeze(report))),
    attempt_3: Object.freeze({ ...attempt_3 }),
    live_execution: Object.freeze(liveExecution),
    live_execution_artifact: Object.freeze({ ...liveExecutionArtifact }),
    post_run_metrics: metrics,
    family_design_decisions: Object.freeze(familyDecisions.map((decision) => Object.freeze({ ...decision }))),
    questions: AUDIT_QUESTIONS,
  };
  return Object.freeze({ ...body, adversarial_audit_input_id: contentId(ADVERSARIAL_AUDIT_INPUT_SCHEMA, body) });
}

function validateIteration2AdversarialAuditInput(input) {
  const keys = [
    'schema_version', 'audit_model_profile_id', 'planned_model_call_count', 'audit_execution_state',
    'pilot_baseline_commit', 'consolidation_commits', 'first_pass_review_reports', 'attempt_3',
    'live_execution', 'live_execution_artifact', 'post_run_metrics', 'family_design_decisions',
    'questions', 'adversarial_audit_input_id',
  ];
  if (!exactKeys(input, keys) || input.schema_version !== ADVERSARIAL_AUDIT_INPUT_SCHEMA
    || input.audit_model_profile_id !== AUDIT_PROFILE_ID || input.planned_model_call_count !== AUDIT_MODEL_CALL_COUNT
    || input.audit_execution_state !== AUDIT_EXECUTION_STATE || !digest(input.adversarial_audit_input_id)) {
    fail('INVALID_ADVERSARIAL_AUDIT_INPUT', 'The audit input must seal exactly one pending Sol High audit call.');
  }
  const rebuilt = buildIteration2AdversarialAuditInput({
    pilot_baseline_commit: input.pilot_baseline_commit,
    consolidation_commits: input.consolidation_commits,
    first_pass_review_reports: input.first_pass_review_reports,
    attempt_3: input.attempt_3,
    live_execution: input.live_execution,
    live_execution_artifact: input.live_execution_artifact,
    family_design_decisions: input.family_design_decisions,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(input)) {
    fail('ADVERSARIAL_AUDIT_INPUT_ID_MISMATCH', 'The sealed adversarial-audit input does not match its deterministic contents.');
  }
  return input;
}

module.exports = {
  ADVERSARIAL_AUDIT_INPUT_SCHEMA,
  AUDIT_EXECUTION_STATE,
  AUDIT_MODEL_CALL_COUNT,
  AUDIT_PROFILE_ID,
  AUDIT_QUESTIONS,
  Iteration2AdversarialAuditError,
  buildIteration2AdversarialAuditInput,
  derivePostRunMetrics,
  validateIteration2AdversarialAuditInput,
};
