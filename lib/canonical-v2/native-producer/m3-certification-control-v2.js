'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const {
  buildKnownDefectRegistry,
  validateKnownDefectRegistry,
} = require('./known-defect-registry');
const {
  buildM3CertificationControlPlan,
} = require('./m3-certification-control');

const M3_CERTIFICATION_CONTROL_PLAN_V2_SCHEMA = 'M3_CERTIFICATION_CONTROL_PLAN/V2';
const M3_CERTIFICATION_FAILURE_RESPONSE_V2_SCHEMA = 'M3_CERTIFICATION_FAILURE_RESPONSE/V2';
const M3_CERTIFICATION_REVIEW_FINDING_V2_SCHEMA = 'M3_CERTIFICATION_REVIEW_FINDING/V2';
const CERTIFICATION_ADMISSIBLE = false;

function certificationAdmissible() {
  return CERTIFICATION_ADMISSIBLE;
}

class M3CertificationControlV2Error extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'M3CertificationControlV2Error';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new M3CertificationControlV2Error(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_INPUT', `${label} must be a non-empty string`, { label, value });
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', `${label} must be an object`, { label });
  }
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    fail('INVALID_INPUT', `${label} does not match the closed V2 contract`, {
      label, actual, expected: sortedExpected,
    });
  }
}

function orderedUniqueIds(ids, label) {
  if (!Array.isArray(ids)) fail('INVALID_INPUT', `${label} must be an array`, { label });
  const values = ids.map((id, index) => requireString(id, `${label}[${index}]`));
  if (new Set(values).size !== values.length) fail('DUPLICATE_REVIEW_SELECTION', `${label} contains a duplicate candidate`, { label });
  return values.sort();
}

function requiredReviewIds(mandatoryReview, blindSample) {
  const mandatoryIds = orderedUniqueIds(mandatoryReview.map((entry) => entry.candidate_id), 'mandatory_review');
  const blindIds = orderedUniqueIds(blindSample.map((entry) => entry.candidate_id), 'blind_sample');
  const overlap = mandatoryIds.find((id) => blindIds.includes(id));
  if (overlap) fail('INVALID_PLAN', 'mandatory review and blind sample selections must not overlap', { candidate_id: overlap });
  return {
    mandatoryIds,
    blindIds,
    requiredIds: [...new Set([...mandatoryIds, ...blindIds])].sort(),
  };
}

function buildM3CertificationControlPlanV2({
  candidate_set_id: candidateSetId,
  source_scope_certification_set_id: sourceScopeCertificationSetId,
  candidates,
  family_parity_status: familyParityStatus,
  decision_reconciliation_proposal: decisionReconciliationProposal,
  decision_conditional_family_status: decisionConditionalFamilyStatus,
  successor_m1_authority: successorM1Authority,
  known_defect_registry: knownDefectRegistry,
  sampling_seed: samplingSeed,
  sample_rate: sampleRate,
} = {}) {
  requireString(candidateSetId, 'candidate_set_id');
  requireString(sourceScopeCertificationSetId, 'source_scope_certification_set_id');
  validateKnownDefectRegistry(knownDefectRegistry);
  const v1Plan = buildM3CertificationControlPlan({
    candidate_set_id: candidateSetId,
    candidates,
    family_parity_status: familyParityStatus,
    decision_reconciliation_proposal: decisionReconciliationProposal,
    decision_conditional_family_status: decisionConditionalFamilyStatus,
    successor_m1_authority: successorM1Authority,
    known_defect_registry: knownDefectRegistry,
    sampling_seed: samplingSeed,
    ...(sampleRate === undefined ? {} : { sample_rate: sampleRate }),
  });
  const selection = requiredReviewIds(v1Plan.mandatory_review, v1Plan.blind_sample);
  const body = {
    schema_version: M3_CERTIFICATION_CONTROL_PLAN_V2_SCHEMA,
    candidate_set_id: candidateSetId,
    source_scope_certification_set_id: sourceScopeCertificationSetId,
    family_parity_status: v1Plan.family_parity_status,
    decision_conditional_family_status: v1Plan.decision_conditional_family_status,
    decision_reconciliation_proposal: v1Plan.decision_reconciliation_proposal,
    decision_reconciliation: v1Plan.decision_reconciliation,
    successor_m1_authority: v1Plan.successor_m1_authority,
    known_defect_registry_id: v1Plan.known_defect_registry_id,
    known_defect_registry_version: knownDefectRegistry.version,
    sampling_seed: v1Plan.sampling_seed,
    sample_rate: v1Plan.sample_rate,
    candidate_count: v1Plan.candidate_count,
    auto_pass_eligible_count: v1Plan.auto_pass_eligible_count,
    mandatory_review: v1Plan.mandatory_review,
    blind_sample: v1Plan.blind_sample,
    required_review_ids: selection.requiredIds,
    candidates: v1Plan.candidates,
  };
  return deepFreeze({
    ...body,
    m3_certification_control_plan_id: contentId(M3_CERTIFICATION_CONTROL_PLAN_V2_SCHEMA, body),
  });
}

const PLAN_KEYS = Object.freeze([
  'schema_version',
  'candidate_set_id',
  'source_scope_certification_set_id',
  'family_parity_status',
  'decision_conditional_family_status',
  'decision_reconciliation_proposal',
  'decision_reconciliation',
  'successor_m1_authority',
  'known_defect_registry_id',
  'known_defect_registry_version',
  'sampling_seed',
  'sample_rate',
  'candidate_count',
  'auto_pass_eligible_count',
  'mandatory_review',
  'blind_sample',
  'required_review_ids',
  'candidates',
  'm3_certification_control_plan_id',
]);

function requirePlan(plan) {
  requireExactKeys(plan, PLAN_KEYS, 'plan');
  if (plan.schema_version !== M3_CERTIFICATION_CONTROL_PLAN_V2_SCHEMA) {
    fail('INVALID_PLAN', 'a M3_CERTIFICATION_CONTROL_PLAN/V2 is required', {});
  }
  requireString(plan.m3_certification_control_plan_id, 'plan.m3_certification_control_plan_id');
  return plan;
}

function scopeIncludesCandidate(scope, candidate) {
  return ['deal', 'family', 'attribute', 'extraction_mechanism'].every(
    (field) => scope[field] === '*' || scope[field] === candidate[field],
  );
}

function validateFinding(finding, requiredIds, candidateById, index) {
  const label = `findings[${index}]`;
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
    fail('INVALID_INPUT', `${label} must be an object`, { index });
  }
  const expectedKeys = finding.outcome === 'CONFIRMED_ERROR'
    ? ['candidate_id', 'outcome', 'defect_entry']
    : ['candidate_id', 'outcome'];
  requireExactKeys(finding, expectedKeys, label);
  requireString(finding.candidate_id, `${label}.candidate_id`);
  if (!requiredIds.has(finding.candidate_id)) {
    fail('UNSELECTED_FINDING', 'a finding may only be recorded for a required review candidate', {
      candidate_id: finding.candidate_id,
    });
  }
  if (finding.outcome !== 'CONFIRMED_ERROR' && finding.outcome !== 'CONFIRMED_CORRECT') {
    fail('INVALID_INPUT', `${label}.outcome must be CONFIRMED_ERROR or CONFIRMED_CORRECT`, { index });
  }
  if (finding.outcome === 'CONFIRMED_ERROR') {
    requireExactKeys(finding.defect_entry, [
      'deal', 'family', 'attribute', 'extraction_mechanism', 'pattern_description', 'date_added',
    ], `${label}.defect_entry`);
    if (!scopeIncludesCandidate(finding.defect_entry, candidateById.get(finding.candidate_id))) {
      fail('DEFECT_SCOPE_MISMATCH', 'an error finding must add a defect entry whose scope includes that candidate', {
        candidate_id: finding.candidate_id,
      });
    }
  }
}

function immutableFinding(planId, finding, selection) {
  const body = {
    schema_version: M3_CERTIFICATION_REVIEW_FINDING_V2_SCHEMA,
    m3_certification_control_plan_id: planId,
    candidate_id: finding.candidate_id,
    selection,
    outcome: finding.outcome,
    ...(finding.outcome === 'CONFIRMED_ERROR' ? { defect_entry: { ...finding.defect_entry } } : {}),
  };
  return deepFreeze({
    ...body,
    m3_certification_review_finding_id: contentId(M3_CERTIFICATION_REVIEW_FINDING_V2_SCHEMA, body),
  });
}

function reprocessGroups(plan, errors, candidateById) {
  const groups = new Map();
  const addGroup = (groupType, scope, members) => {
    const candidateIds = members.map((member) => member.candidate_id).sort();
    const key = canonicalJson({ group_type: groupType, scope, candidate_ids: candidateIds });
    if (!groups.has(key)) groups.set(key, { group_type: groupType, scope, candidate_ids: candidateIds });
  };
  const addCandidateGroups = (candidate) => {
    addGroup('DEAL_FAMILY', { deal: candidate.deal, family: candidate.family }, plan.candidates.filter(
      (member) => member.deal === candidate.deal && member.family === candidate.family,
    ));
    addGroup('EXTRACTION_MECHANISM', { extraction_mechanism: candidate.extraction_mechanism }, plan.candidates.filter(
      (member) => member.extraction_mechanism === candidate.extraction_mechanism,
    ));
  };
  for (const finding of errors) {
    addCandidateGroups(candidateById.get(finding.candidate_id));
    for (const candidate of plan.candidates.filter((item) => scopeIncludesCandidate(finding.defect_entry, item))) {
      addCandidateGroups(candidate);
    }
  }
  return [...groups.values()].sort((a, b) => a.group_type.localeCompare(b.group_type)
    || canonicalJson(a.scope).localeCompare(canonicalJson(b.scope)));
}

function updatedRegistry(knownDefectRegistry, errors, nextRegistryVersion) {
  const entryKeys = new Set(knownDefectRegistry.entries.map((entry) => {
    const { schema_version: _schemaVersion, ...body } = entry;
    return canonicalJson(body);
  }));
  const additions = [];
  for (const finding of errors) {
    const key = canonicalJson(finding.defect_entry);
    if (entryKeys.has(key)) continue;
    entryKeys.add(key);
    additions.push(finding.defect_entry);
  }
  return buildKnownDefectRegistry({
    version: nextRegistryVersion,
    entries: [
      ...knownDefectRegistry.entries.map(({ schema_version, ...entry }) => entry),
      ...additions,
    ],
  });
}

function buildM3CertificationFailureResponseV2({
  plan,
  findings,
  known_defect_registry: knownDefectRegistry,
  current_candidate_set_id: currentCandidateSetId,
  current_source_scope_certification_set_id: currentSourceScopeCertificationSetId,
  next_registry_version: nextRegistryVersion,
} = {}) {
  requirePlan(plan);
  requireString(currentCandidateSetId, 'current_candidate_set_id');
  requireString(currentSourceScopeCertificationSetId, 'current_source_scope_certification_set_id');
  if (plan.candidate_set_id !== currentCandidateSetId
    || plan.source_scope_certification_set_id !== currentSourceScopeCertificationSetId) {
    fail('STALE_OR_TAMPERED_PLAN', 'the control plan does not bind the current candidate and source-scope certification sets', {
      plan_candidate_set_id: plan.candidate_set_id,
      current_candidate_set_id: currentCandidateSetId,
      plan_source_scope_certification_set_id: plan.source_scope_certification_set_id,
      current_source_scope_certification_set_id: currentSourceScopeCertificationSetId,
    });
  }
  validateKnownDefectRegistry(knownDefectRegistry);
  if (plan.known_defect_registry_version !== knownDefectRegistry.version) {
    fail('STALE_OR_TAMPERED_PLAN', 'the control plan is bound to a different known-defect registry version', {});
  }
  const recomputedPlan = buildM3CertificationControlPlanV2({
    candidate_set_id: plan.candidate_set_id,
    source_scope_certification_set_id: plan.source_scope_certification_set_id,
    candidates: plan.candidates,
    family_parity_status: plan.family_parity_status,
    decision_reconciliation_proposal: plan.decision_reconciliation_proposal,
    decision_conditional_family_status: plan.decision_conditional_family_status,
    successor_m1_authority: plan.successor_m1_authority,
    known_defect_registry: knownDefectRegistry,
    sampling_seed: plan.sampling_seed,
    sample_rate: plan.sample_rate,
  });
  if (canonicalJson(plan) !== canonicalJson(recomputedPlan)) {
    fail('STALE_OR_TAMPERED_PLAN', 'the control plan must match the frozen candidate set and known-defect registry', {});
  }
  plan = recomputedPlan;
  if (!Number.isInteger(nextRegistryVersion) || nextRegistryVersion <= knownDefectRegistry.version) {
    fail('INVALID_INPUT', 'next_registry_version must be greater than the current registry version', {
      current: knownDefectRegistry.version,
      next: nextRegistryVersion,
    });
  }
  const selection = requiredReviewIds(plan.mandatory_review, plan.blind_sample);
  if (canonicalJson(plan.required_review_ids) !== canonicalJson(selection.requiredIds)) {
    fail('STALE_OR_TAMPERED_PLAN', 'required_review_ids must be the exact union of the plan selections', {});
  }
  if (!Array.isArray(findings) || (selection.requiredIds.length > 0 && findings.length === 0)) {
    fail('EMPTY_REVIEW_FINDINGS', 'every required review candidate needs one finding', {
      required_review_count: selection.requiredIds.length,
    });
  }
  const requiredIds = new Set(selection.requiredIds);
  const candidateById = new Map(plan.candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const seen = new Set();
  findings.forEach((finding, index) => {
    validateFinding(finding, requiredIds, candidateById, index);
    if (seen.has(finding.candidate_id)) {
      fail('DUPLICATE_FINDING', 'one required candidate may have only one immutable finding', {
        candidate_id: finding.candidate_id,
      });
    }
    seen.add(finding.candidate_id);
  });
  if (seen.size !== requiredIds.size) {
    const omitted = selection.requiredIds.filter((candidateId) => !seen.has(candidateId));
    fail('OMITTED_REQUIRED_FINDING', 'every required review candidate must have exactly one finding', { omitted });
  }
  const selectionById = new Map([
    ...selection.mandatoryIds.map((candidateId) => [candidateId, 'MANDATORY_REVIEW']),
    ...selection.blindIds.map((candidateId) => [candidateId, 'BLIND_SAMPLE']),
  ]);
  const orderedFindings = [...findings].sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  const errors = orderedFindings.filter((finding) => finding.outcome === 'CONFIRMED_ERROR');
  const immutableFindings = orderedFindings.map((finding) => immutableFinding(
    plan.m3_certification_control_plan_id,
    finding,
    selectionById.get(finding.candidate_id),
  ));
  const registry = updatedRegistry(knownDefectRegistry, errors, nextRegistryVersion);
  const counts = {
    required_review_count: selection.requiredIds.length,
    reviewed_count: immutableFindings.length,
    mandatory_review_count: selection.mandatoryIds.length,
    reviewed_mandatory_count: immutableFindings.filter((finding) => finding.selection === 'MANDATORY_REVIEW').length,
    blind_sample_count: selection.blindIds.length,
    reviewed_blind_sample_count: immutableFindings.filter((finding) => finding.selection === 'BLIND_SAMPLE').length,
    confirmed_correct_count: immutableFindings.filter((finding) => finding.outcome === 'CONFIRMED_CORRECT').length,
    confirmed_error_count: errors.length,
  };
  const body = {
    schema_version: M3_CERTIFICATION_FAILURE_RESPONSE_V2_SCHEMA,
    m3_certification_control_plan_id: plan.m3_certification_control_plan_id,
    candidate_set_id: plan.candidate_set_id,
    source_scope_certification_set_id: plan.source_scope_certification_set_id,
    known_defect_registry_id: knownDefectRegistry.known_defect_registry_id,
    known_defect_registry_version: knownDefectRegistry.version,
    updated_known_defect_registry_id: registry.known_defect_registry_id,
    updated_known_defect_registry_version: registry.version,
    reviewed_findings: immutableFindings,
    reviewed_counts: counts,
    reprocess_groups: reprocessGroups(plan, errors, candidateById),
    certification_admissible: certificationAdmissible(),
  };
  return deepFreeze({
    ...body,
    updated_known_defect_registry: registry,
    m3_certification_failure_response_id: contentId(M3_CERTIFICATION_FAILURE_RESPONSE_V2_SCHEMA, body),
  });
}

module.exports = {
  CERTIFICATION_ADMISSIBLE,
  M3_CERTIFICATION_CONTROL_PLAN_V2_SCHEMA,
  M3_CERTIFICATION_FAILURE_RESPONSE_V2_SCHEMA,
  M3_CERTIFICATION_REVIEW_FINDING_V2_SCHEMA,
  M3CertificationControlV2Error,
  buildM3CertificationControlPlanV2,
  buildM3CertificationFailureResponseV2,
  certificationAdmissible,
};
