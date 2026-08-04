'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');

const PLAN_SCHEMA_VERSION = 'M3_REPLAY_INVALIDATION_PLAN/V1';
const ACTIONS = new Set([
  'REUSE_UNCHANGED_RAW',
  'REPLAY_FROM_STORED_RAW',
  'REEXTRACT_REQUIRED',
]);
const LINEAGE_KEYS = Object.freeze([
  'work_item_id',
  'raw_response',
  'source_identity_digest',
  'section_identity_digest',
  'family_identity_digest',
  'prompt_identity_digest',
  'model_identity_digest',
  'adapter_dependency_digests',
  'adapter_dependency_closure_digest',
  'resolver_dependency_digests',
  'resolver_dependency_closure_digest',
  'candidate_member_ids',
]);
const CHANGE_SET_KEYS = Object.freeze([
  'source_identity_digests',
  'section_identity_digests',
  'family_identity_digests',
  'prompt_identity_digests',
  'model_identity_digests',
  'adapter_dependency_digests',
  'resolver_dependency_digests',
]);

class ReplayInvalidationPlannerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReplayInvalidationPlannerError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ReplayInvalidationPlannerError(code, message);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function orderedUnique(values, label, predicate = isDigest) {
  if (!Array.isArray(values) || values.length === 0
    || values.some((value) => !predicate(value))
    || new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson([...values].sort())) {
    fail('INCOMPLETE_DEPENDENCY_LINEAGE', `${label} must be a non-empty sorted unique lineage set`);
  }
  return values;
}

function orderedPossiblyEmptyDigests(values, label) {
  if (!Array.isArray(values) || values.some((value) => !isDigest(value))
    || new Set(values).size !== values.length
    || canonicalJson(values) !== canonicalJson([...values].sort())) {
    fail('INVALID_CHANGED_DEPENDENCY_SET', `${label} must be a sorted unique digest set`);
  }
  return values;
}

function validateDependencyClosure(digests, closureDigest, label) {
  if (digests.length === 0 && !isDigest(closureDigest)) {
    fail('INCOMPLETE_DEPENDENCY_LINEAGE', `${label} requires an explicit closure digest when it has no members`);
  }
  if (closureDigest !== null && !isDigest(closureDigest)) {
    fail('INCOMPLETE_DEPENDENCY_LINEAGE', `${label} closure digest must be null or a SHA-256 digest`);
  }
}

function validateRawResponse(rawResponse) {
  if (!exactKeys(rawResponse, [
    'sealed_digest',
    'stored_digest',
    'stored_bytes_available',
  ]) || !isDigest(rawResponse.sealed_digest)
    || typeof rawResponse.stored_bytes_available !== 'boolean'
    || (rawResponse.stored_bytes_available && rawResponse.stored_digest !== rawResponse.sealed_digest)
    || (!rawResponse.stored_bytes_available && rawResponse.stored_digest !== null)) {
    fail('STALE_OR_MISSING_RAW_RESPONSE', 'raw-response identity is missing, stale, or unavailable');
  }
  return rawResponse;
}

function validateLineage(lineage) {
  if (!exactKeys(lineage, LINEAGE_KEYS) || !isDigest(lineage.work_item_id)) {
    fail('INCOMPLETE_DEPENDENCY_LINEAGE', 'work-item lineage is not closed');
  }
  validateRawResponse(lineage.raw_response);
  for (const key of [
    'source_identity_digest',
    'section_identity_digest',
    'family_identity_digest',
    'prompt_identity_digest',
    'model_identity_digest',
  ]) {
    if (!isDigest(lineage[key])) {
      fail('INCOMPLETE_DEPENDENCY_LINEAGE', `${key} is missing from sealed lineage`);
    }
  }
  orderedPossiblyEmptyDigests(lineage.adapter_dependency_digests, 'adapter_dependency_digests');
  orderedPossiblyEmptyDigests(lineage.resolver_dependency_digests, 'resolver_dependency_digests');
  validateDependencyClosure(lineage.adapter_dependency_digests, lineage.adapter_dependency_closure_digest, 'adapter_dependency_digests');
  validateDependencyClosure(lineage.resolver_dependency_digests, lineage.resolver_dependency_closure_digest, 'resolver_dependency_digests');
  orderedUnique(lineage.candidate_member_ids, 'candidate_member_ids', isDigest);
  return lineage;
}

function validateChangedDependencySet(changed) {
  if (!exactKeys(changed, CHANGE_SET_KEYS)) {
    fail('INVALID_CHANGED_DEPENDENCY_SET', 'changed dependency set is not closed');
  }
  for (const key of CHANGE_SET_KEYS) orderedPossiblyEmptyDigests(changed[key], key);
  return changed;
}

function intersects(values, changed) {
  const set = new Set(changed);
  return values.some((value) => set.has(value));
}

function actionFor(lineage, changed) {
  const reextractReasons = [];
  for (const [lineageKey, changedKey] of [
    ['source_identity_digest', 'source_identity_digests'],
    ['section_identity_digest', 'section_identity_digests'],
    ['family_identity_digest', 'family_identity_digests'],
    ['prompt_identity_digest', 'prompt_identity_digests'],
    ['model_identity_digest', 'model_identity_digests'],
  ]) {
    if (changed[changedKey].includes(lineage[lineageKey])) reextractReasons.push(changedKey);
  }
  if (reextractReasons.length > 0) {
    return { action: 'REEXTRACT_REQUIRED', reason_codes: reextractReasons };
  }
  const replayReasons = [];
  if (intersects(lineage.adapter_dependency_digests, changed.adapter_dependency_digests)) {
    replayReasons.push('adapter_dependency_digests');
  }
  if (intersects(lineage.resolver_dependency_digests, changed.resolver_dependency_digests)) {
    replayReasons.push('resolver_dependency_digests');
  }
  if (!lineage.raw_response.stored_bytes_available) {
    return {
      action: 'REEXTRACT_REQUIRED',
      reason_codes: ['MISSING_STORED_RAW_OUTPUT', ...replayReasons],
    };
  }
  if (replayReasons.length > 0) {
    return { action: 'REPLAY_FROM_STORED_RAW', reason_codes: replayReasons };
  }
  return { action: 'REUSE_UNCHANGED_RAW', reason_codes: ['NO_RELEVANT_DEPENDENCY_CHANGE'] };
}

function planPayload(plan) {
  return {
    schema_version: plan.schema_version,
    prior_candidate_generation_id: plan.prior_candidate_generation_id,
    successor_generation_mode: plan.successor_generation_mode,
    changed_dependency_set: plan.changed_dependency_set,
    work_item_lineages: plan.work_item_lineages,
    member_actions: plan.member_actions,
  };
}

function planReplayInvalidation({ priorCandidateGenerationId, workItemLineages, changedDependencySet }) {
  if (!isDigest(priorCandidateGenerationId)) {
    fail('INVALID_CANDIDATE_GENERATION', 'prior candidate generation must be sealed');
  }
  validateChangedDependencySet(changedDependencySet);
  if (!Array.isArray(workItemLineages) || workItemLineages.length === 0) {
    fail('INCOMPLETE_DEPENDENCY_LINEAGE', 'at least one sealed work-item lineage is required');
  }
  const lineages = [...workItemLineages].map(validateLineage)
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  if (new Set(lineages.map((lineage) => lineage.work_item_id)).size !== lineages.length) {
    fail('INCOMPLETE_DEPENDENCY_LINEAGE', 'work-item lineage keys must be unique');
  }
  const memberActions = lineages.flatMap((lineage) => {
    const selection = actionFor(lineage, changedDependencySet);
    return lineage.candidate_member_ids.map((candidateMemberId) => Object.freeze({
      work_item_id: lineage.work_item_id,
      candidate_member_id: candidateMemberId,
      action: selection.action,
      reason_codes: Object.freeze([...selection.reason_codes]),
      raw_response_digest: lineage.raw_response.sealed_digest,
      model_call_count: selection.action === 'REEXTRACT_REQUIRED' ? 1 : 0,
    }));
  });
  if (new Set(memberActions.map((entry) => entry.candidate_member_id)).size !== memberActions.length) {
    fail('INCOMPLETE_DEPENDENCY_LINEAGE', 'candidate member IDs must have one sealed lineage owner');
  }
  const plan = {
    schema_version: PLAN_SCHEMA_VERSION,
    prior_candidate_generation_id: priorCandidateGenerationId,
    successor_generation_mode: 'CREATE_SUCCESSOR_ONLY',
    changed_dependency_set: Object.freeze({ ...changedDependencySet }),
    work_item_lineages: Object.freeze(lineages),
    member_actions: Object.freeze(memberActions),
    replay_invalidation_plan_id: '0'.repeat(64),
  };
  plan.replay_invalidation_plan_id = contentId(plan.schema_version, planPayload(plan));
  return Object.freeze(plan);
}

function validateReplayInvalidationPlan(plan) {
  if (!exactKeys(plan, [
    'schema_version',
    'prior_candidate_generation_id',
    'successor_generation_mode',
    'changed_dependency_set',
    'work_item_lineages',
    'member_actions',
    'replay_invalidation_plan_id',
  ]) || plan.schema_version !== PLAN_SCHEMA_VERSION
    || plan.successor_generation_mode !== 'CREATE_SUCCESSOR_ONLY'
    || !isDigest(plan.prior_candidate_generation_id)
    || !isDigest(plan.replay_invalidation_plan_id)
    || !Array.isArray(plan.work_item_lineages) || plan.work_item_lineages.length === 0
    || !Array.isArray(plan.member_actions) || plan.member_actions.length === 0) {
    fail('INVALID_REPLAY_INVALIDATION_PLAN', 'replay invalidation plan is not a closed successor-only plan');
  }
  validateChangedDependencySet(plan.changed_dependency_set);
  const lineages = plan.work_item_lineages.map(validateLineage)
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id));
  if (new Set(lineages.map((lineage) => lineage.work_item_id)).size !== lineages.length
    || canonicalJson(plan.work_item_lineages) !== canonicalJson(lineages)) {
    fail('INCOMPLETE_DEPENDENCY_LINEAGE', 'plan work-item lineages are not a sealed ordered set');
  }
  const expectedActions = lineages.flatMap((lineage) => {
    const selection = actionFor(lineage, plan.changed_dependency_set);
    return lineage.candidate_member_ids.map((candidateMemberId) => ({
      work_item_id: lineage.work_item_id,
      candidate_member_id: candidateMemberId,
      action: selection.action,
      reason_codes: selection.reason_codes,
      raw_response_digest: lineage.raw_response.sealed_digest,
      model_call_count: selection.action === 'REEXTRACT_REQUIRED' ? 1 : 0,
    }));
  });
  if (canonicalJson(plan.member_actions) !== canonicalJson(expectedActions)) {
    fail('FALSE_ZERO_CALL_CLAIM', 'replay invalidation actions do not follow their sealed lineage');
  }
  for (const action of plan.member_actions) {
    if (!exactKeys(action, [
      'work_item_id', 'candidate_member_id', 'action', 'reason_codes', 'raw_response_digest', 'model_call_count',
    ]) || !isDigest(action.work_item_id) || !isDigest(action.candidate_member_id)
      || !ACTIONS.has(action.action) || !Array.isArray(action.reason_codes)
      || action.reason_codes.length === 0 || !isDigest(action.raw_response_digest)
      || action.model_call_count !== (action.action === 'REEXTRACT_REQUIRED' ? 1 : 0)
      || (action.action === 'REPLAY_FROM_STORED_RAW'
        && action.reason_codes.includes('MISSING_STORED_RAW_OUTPUT'))) {
      fail('FALSE_ZERO_CALL_CLAIM', 'replay invalidation plan makes an invalid zero-call claim');
    }
  }
  if (plan.replay_invalidation_plan_id !== contentId(plan.schema_version, planPayload(plan))) {
    fail('REPLAY_INVALIDATION_PLAN_ID_MISMATCH', 'replay invalidation plan identity is stale');
  }
  return true;
}

module.exports = {
  ACTIONS,
  CHANGE_SET_KEYS,
  LINEAGE_KEYS,
  PLAN_SCHEMA_VERSION,
  ReplayInvalidationPlannerError,
  planPayload,
  planReplayInvalidation,
  validateReplayInvalidationPlan,
};
