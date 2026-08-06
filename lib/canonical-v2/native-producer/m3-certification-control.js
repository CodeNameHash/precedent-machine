'use strict';

const crypto = require('node:crypto');

const { canonicalJson, contentId } = require('../canonical-bytes');
const {
  buildKnownDefectRegistry,
  matchesKnownDefect,
  validateKnownDefectRegistry,
} = require('./known-defect-registry');
const {
  validateM3FamilyParityStatus,
} = require('./m3-family-parity-register');
const {
  bindDecisionConditionalFamilyStatus,
  decisionReconciliationBinding,
  validateDecisionReconciliationProposal,
} = require('../decision-reconciliation-proposal');
const {
  validateSuccessorM1Authority,
} = require('./durable-12-item-pilot-readiness');

const M3_CERTIFICATION_CONTROL_PLAN_SCHEMA = 'M3_CERTIFICATION_CONTROL_PLAN/V1';
const M3_FAILURE_RESPONSE_SCHEMA = 'M3_CERTIFICATION_FAILURE_RESPONSE/V1';
const SAMPLE_RATE = 0.02;
const SAMPLE_DIMENSIONS = Object.freeze([
  'deal',
  'family',
  'state',
  'input_path',
  'normalisation_type',
]);
const CANDIDATE_KEYS = Object.freeze([
  'candidate_id',
  'deal',
  'family',
  'attribute',
  'state',
  'input_path',
  'normalisation_type',
  'extraction_mechanism',
  'auto_pass_eligible',
  'materiality_rank',
]);

class M3CertificationControlError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'M3CertificationControlError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new M3CertificationControlError(code, message, details);
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
    fail('INVALID_INPUT', `${label} does not match the closed candidate contract`, {
      label, actual, expected: sortedExpected,
    });
  }
}

function validateCandidate(candidate, index) {
  const label = `candidates[${index}]`;
  requireExactKeys(candidate, CANDIDATE_KEYS, label);
  for (const key of CANDIDATE_KEYS.filter((key) => !['auto_pass_eligible', 'materiality_rank'].includes(key))) {
    requireString(candidate[key], `${label}.${key}`);
  }
  if (typeof candidate.auto_pass_eligible !== 'boolean') {
    fail('INVALID_INPUT', `${label}.auto_pass_eligible must be boolean`, { index });
  }
  if (!Number.isInteger(candidate.materiality_rank) || candidate.materiality_rank < 0) {
    fail('INVALID_INPUT', `${label}.materiality_rank must be a non-negative integer`, { index });
  }
  if (candidate.auto_pass_eligible && candidate.state !== 'PRESENT') {
    fail('INVALID_AUTO_PASS_CANDIDATE', 'only PRESENT candidates may enter the auto-pass sample', {
      candidate_id: candidate.candidate_id,
      state: candidate.state,
    });
  }
}

function score(seed, candidateId) {
  return crypto.createHash('sha256').update(`${seed}\u0000${candidateId}`, 'utf8').digest('hex');
}

function candidateOrder(seed) {
  return (a, b) => score(seed, a.candidate_id).localeCompare(score(seed, b.candidate_id))
    || a.candidate_id.localeCompare(b.candidate_id);
}

function materialityOrder(a, b) {
  return a.materiality_rank - b.materiality_rank || a.candidate_id.localeCompare(b.candidate_id);
}

function validatedCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    fail('INVALID_INPUT', 'candidates must be a non-empty array', {});
  }
  const ids = new Set();
  candidates.forEach((candidate, index) => {
    validateCandidate(candidate, index);
    if (ids.has(candidate.candidate_id)) {
      fail('DUPLICATE_CANDIDATE_ID', 'candidate_id must be unique within a frozen candidate set', {
        candidate_id: candidate.candidate_id,
      });
    }
    ids.add(candidate.candidate_id);
  });
  return candidates.map((candidate) => ({ ...candidate }));
}

function requireDecisionConditionalCertificationAuthority({
  familyParityStatus,
  decisionReconciliationProposal,
  decisionConditionalFamilyStatus,
  successorM1Authority,
}) {
  let proposal;
  try {
    proposal = validateDecisionReconciliationProposal(decisionReconciliationProposal);
  } catch (error) {
    fail('DECISION_RECONCILIATION_REQUIRED', 'M3 certification requires the current validated decision reconciliation.', {
      cause_code: error?.code || null,
    });
  }
  const expectedConditional = bindDecisionConditionalFamilyStatus(familyParityStatus, proposal);
  if (canonicalJson(decisionConditionalFamilyStatus) !== canonicalJson(expectedConditional)) {
    fail('DECISION_CONDITIONAL_FAMILY_STATUS_INVALID', 'M3 certification requires the exact decision-conditional family status for the raw family result.', {});
  }
  if (proposal.blocking_unresolved_decision_ids.length > 0
    || proposal.decision_register_freeze_ready !== true
    || proposal.decision_register_freeze_authority === 'NONE'
    || proposal.family_completion_ready !== true
    || expectedConditional.state !== 'FAMILY_COMPLETE') {
    fail('DECISION_RECONCILIATION_BLOCKED', 'M3 certification cannot start while a decision ruling or the ratified decision-register freeze is open.', {
      blocking_unresolved_decision_ids: proposal.blocking_unresolved_decision_ids,
      decision_register_freeze_ready: proposal.decision_register_freeze_ready,
      decision_register_freeze_authority: proposal.decision_register_freeze_authority,
      family_completion_ready: proposal.family_completion_ready,
      family_completion_blocker_codes: proposal.family_completion_blocker_codes,
    });
  }
  let successor;
  try {
    successor = validateSuccessorM1Authority(successorM1Authority);
  } catch (error) {
    fail('SUCCESSOR_M1_AUTHORITY_REQUIRED', 'M3 certification requires the externally verified successor M1 authority that adopted the decision freeze.', {
      cause: error?.message || null,
    });
  }
  return Object.freeze({
    decision_conditional_family_status: decisionConditionalFamilyStatus,
    decision_reconciliation_proposal: proposal,
    decision_reconciliation: decisionReconciliationBinding(proposal),
    successor_m1_authority: successor,
  });
}

function sampleEligibleCandidates({ eligible, seed, sampleRate }) {
  const selected = new Map();
  const ordered = [...eligible].sort(candidateOrder(seed));

  for (const dimension of SAMPLE_DIMENSIONS) {
    const values = [...new Set(ordered.map((candidate) => candidate[dimension]))].sort();
    for (const value of values) {
      const selectedCandidate = ordered.find((candidate) => candidate[dimension] === value);
      selected.set(selectedCandidate.candidate_id, selectedCandidate);
    }
  }

  const target = Math.ceil(eligible.length * sampleRate);
  for (const candidate of ordered) {
    if (selected.size >= target) break;
    selected.set(candidate.candidate_id, candidate);
  }
  return [...selected.values()].sort(candidateOrder(seed));
}

function buildM3CertificationControlPlan({
  candidate_set_id: candidateSetId,
  candidates,
  family_parity_status: familyParityStatus,
  decision_reconciliation_proposal: decisionReconciliationProposal,
  decision_conditional_family_status: decisionConditionalFamilyStatus,
  successor_m1_authority: successorM1Authority,
  known_defect_registry: knownDefectRegistry,
  sampling_seed: samplingSeed,
  sample_rate: sampleRate = SAMPLE_RATE,
} = {}) {
  requireString(candidateSetId, 'candidate_set_id');
  requireString(samplingSeed, 'sampling_seed');
  validateM3FamilyParityStatus(familyParityStatus);
  if (familyParityStatus.state !== 'FAMILY_COMPLETE') {
    fail('INCOMPLETE_FAMILY_PARITY', 'M3 certification cannot start until every Wave A build and follow-on product surface is complete', {
      incomplete_families: familyParityStatus.family_states
        .filter((family) => family.completion_state !== 'FAMILY_COMPLETE')
        .map((family) => family.family_id),
      incomplete_supplemental_owners: familyParityStatus.supplemental_owner_states
        .filter((owner) => owner.completion_state !== 'OWNER_COMPLETE')
        .map((owner) => owner.owner_id),
      unassigned_product_surfaces: familyParityStatus.unassigned_product_surface_ids,
    });
  }
  const decisionAuthority = requireDecisionConditionalCertificationAuthority({
    familyParityStatus,
    decisionReconciliationProposal,
    decisionConditionalFamilyStatus,
    successorM1Authority,
  });
  if (typeof sampleRate !== 'number' || !Number.isFinite(sampleRate) || sampleRate <= 0 || sampleRate > 1) {
    fail('INVALID_INPUT', 'sample_rate must be a number in (0, 1]', { sampleRate });
  }
  validateKnownDefectRegistry(knownDefectRegistry);
  const candidateList = validatedCandidates(candidates);
  const mandatoryReview = [];
  const eligible = [];

  for (const candidate of candidateList) {
    const knownDefect = matchesKnownDefect(knownDefectRegistry, candidate);
    if (!candidate.auto_pass_eligible || knownDefect) {
      mandatoryReview.push({
        candidate_id: candidate.candidate_id,
        reason: knownDefect ? 'KNOWN_DEFECT_MATCH' : 'AUTO_PASS_INELIGIBLE',
        materiality_rank: candidate.materiality_rank,
      });
    } else {
      eligible.push(candidate);
    }
  }

  const blindSample = sampleEligibleCandidates({ eligible, seed: samplingSeed, sampleRate });
  const body = {
    schema_version: M3_CERTIFICATION_CONTROL_PLAN_SCHEMA,
    candidate_set_id: candidateSetId,
    family_parity_status: familyParityStatus,
    decision_conditional_family_status: decisionAuthority.decision_conditional_family_status,
    decision_reconciliation_proposal: decisionAuthority.decision_reconciliation_proposal,
    decision_reconciliation: decisionAuthority.decision_reconciliation,
    successor_m1_authority: decisionAuthority.successor_m1_authority,
    known_defect_registry_id: knownDefectRegistry.known_defect_registry_id,
    sampling_seed: samplingSeed,
    sample_rate: sampleRate,
    candidate_count: candidateList.length,
    auto_pass_eligible_count: eligible.length,
    mandatory_review: mandatoryReview.sort(materialityOrder),
    blind_sample: blindSample.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      deal: candidate.deal,
      family: candidate.family,
      attribute: candidate.attribute,
      state: candidate.state,
      input_path: candidate.input_path,
      normalisation_type: candidate.normalisation_type,
    })),
    candidates: candidateList.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id)),
  };
  return deepFreeze({
    ...body,
    m3_certification_control_plan_id: contentId(M3_CERTIFICATION_CONTROL_PLAN_SCHEMA, body),
  });
}

function requirePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)
    || plan.schema_version !== M3_CERTIFICATION_CONTROL_PLAN_SCHEMA
    || typeof plan.m3_certification_control_plan_id !== 'string'
    || !Array.isArray(plan.candidates)
    || !Array.isArray(plan.blind_sample)) {
    fail('INVALID_PLAN', 'a M3_CERTIFICATION_CONTROL_PLAN/V1 is required', {});
  }
  return plan;
}

function scopeIncludesCandidate(scope, candidate) {
  return ['deal', 'family', 'attribute', 'extraction_mechanism'].every(
    (field) => scope[field] === '*' || scope[field] === candidate[field],
  );
}

function validateFinding(finding, sampledIds, candidateById, index) {
  const label = `findings[${index}]`;
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
    fail('INVALID_INPUT', `${label} must be an object`, { index });
  }
  const expectedKeys = finding.outcome === 'CONFIRMED_ERROR'
    ? ['candidate_id', 'outcome', 'defect_entry']
    : ['candidate_id', 'outcome'];
  requireExactKeys(finding, expectedKeys, label);
  requireString(finding.candidate_id, `${label}.candidate_id`);
  if (!sampledIds.has(finding.candidate_id)) {
    fail('UNSAMPLED_FINDING', 'a finding may only be recorded for a selected blind-sample candidate', {
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
    const candidate = candidateById.get(finding.candidate_id);
    if (!scopeIncludesCandidate(finding.defect_entry, candidate)) {
      fail('DEFECT_SCOPE_MISMATCH', 'a sampled error must add a defect entry whose scope includes that candidate', {
        candidate_id: finding.candidate_id,
      });
    }
  }
}

function buildM3FailureResponse({
  plan,
  findings,
  known_defect_registry: knownDefectRegistry,
  current_candidate_set_id: currentCandidateSetId,
  next_registry_version: nextRegistryVersion,
} = {}) {
  requirePlan(plan);
  requireString(currentCandidateSetId, 'current_candidate_set_id');
  if (currentCandidateSetId !== plan.candidate_set_id) {
    fail('STALE_OR_TAMPERED_PLAN', 'the control plan does not bind the current frozen candidate set', {
      plan_candidate_set_id: plan.candidate_set_id,
      current_candidate_set_id: currentCandidateSetId,
    });
  }
  validateKnownDefectRegistry(knownDefectRegistry);
  const recomputedPlan = buildM3CertificationControlPlan({
    candidate_set_id: plan.candidate_set_id,
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
    fail('STALE_OR_TAMPERED_PLAN', 'the control plan must match the supplied known-defect registry and frozen candidate set', {});
  }
  plan = recomputedPlan;
  if (!Number.isInteger(nextRegistryVersion) || nextRegistryVersion <= knownDefectRegistry.version) {
    fail('INVALID_INPUT', 'next_registry_version must be greater than the current registry version', {
      current: knownDefectRegistry.version,
      next: nextRegistryVersion,
    });
  }
  if (!Array.isArray(findings) || findings.length === 0) {
    fail('INVALID_INPUT', 'findings must be a non-empty array', {});
  }
  const candidateById = new Map(plan.candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const sampledIds = new Set(plan.blind_sample.map((candidate) => candidate.candidate_id));
  const seen = new Set();
  findings.forEach((finding, index) => {
    validateFinding(finding, sampledIds, candidateById, index);
    if (seen.has(finding.candidate_id)) {
      fail('DUPLICATE_FINDING', 'one sample candidate may have only one recorded finding', {
        candidate_id: finding.candidate_id,
      });
    }
    seen.add(finding.candidate_id);
  });
  if (seen.size !== sampledIds.size) {
    fail('INCOMPLETE_SAMPLE_REVIEW', 'every selected blind-sample candidate requires a recorded finding', {
      expected: sampledIds.size,
      actual: seen.size,
    });
  }

  const orderedFindings = [...findings].sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  const errors = orderedFindings.filter((finding) => finding.outcome === 'CONFIRMED_ERROR');
  const reprocessGroups = new Map();
  for (const finding of errors) {
    const candidate = candidateById.get(finding.candidate_id);
    const addGroup = (groupType, scope, members) => {
      const key = `${groupType}\u0000${Object.values(scope).join('\u0000')}`;
      if (!reprocessGroups.has(key)) {
        reprocessGroups.set(key, { group_type: groupType, scope, candidate_ids: members.map((member) => member.candidate_id).sort() });
      }
    };
    addGroup('DEAL_FAMILY', { deal: candidate.deal, family: candidate.family }, plan.candidates.filter(
      (member) => member.deal === candidate.deal && member.family === candidate.family,
    ));
    addGroup('EXTRACTION_MECHANISM', { extraction_mechanism: candidate.extraction_mechanism }, plan.candidates.filter(
      (member) => member.extraction_mechanism === candidate.extraction_mechanism,
    ));
    for (const member of plan.candidates.filter((item) => scopeIncludesCandidate(finding.defect_entry, item))) {
      addGroup('DEAL_FAMILY', { deal: member.deal, family: member.family }, plan.candidates.filter(
        (item) => item.deal === member.deal && item.family === member.family,
      ));
      addGroup('EXTRACTION_MECHANISM', { extraction_mechanism: member.extraction_mechanism }, plan.candidates.filter(
        (item) => item.extraction_mechanism === member.extraction_mechanism,
      ));
    }
  }

  const registryEntryKeys = new Set(knownDefectRegistry.entries.map((entry) => {
    const { schema_version: _schemaVersion, ...body } = entry;
    return canonicalJson(body);
  }));
  const newDefectEntries = [];
  for (const finding of errors) {
    const key = canonicalJson(finding.defect_entry);
    if (registryEntryKeys.has(key)) continue;
    registryEntryKeys.add(key);
    newDefectEntries.push(finding.defect_entry);
  }
  const updatedRegistry = buildKnownDefectRegistry({
    version: nextRegistryVersion,
    entries: [
      ...knownDefectRegistry.entries.map(({ schema_version, ...entry }) => entry),
      ...newDefectEntries,
    ],
  });
  const body = {
    schema_version: M3_FAILURE_RESPONSE_SCHEMA,
    m3_certification_control_plan_id: plan.m3_certification_control_plan_id,
    reviewed_sample_count: findings.length,
    confirmed_error_count: errors.length,
    reviewed_findings: orderedFindings.map((finding) => ({
      candidate_id: finding.candidate_id,
      outcome: finding.outcome,
      ...(finding.outcome === 'CONFIRMED_ERROR' ? { defect_entry: { ...finding.defect_entry } } : {}),
    })),
    updated_known_defect_registry_id: updatedRegistry.known_defect_registry_id,
    reprocess_groups: [...reprocessGroups.values()].sort((a, b) => a.group_type.localeCompare(b.group_type)
      || JSON.stringify(a.scope).localeCompare(JSON.stringify(b.scope))),
  };
  return deepFreeze({
    ...body,
    updated_known_defect_registry: updatedRegistry,
    m3_failure_response_id: contentId(M3_FAILURE_RESPONSE_SCHEMA, body),
  });
}

module.exports = {
  M3_CERTIFICATION_CONTROL_PLAN_SCHEMA,
  M3_FAILURE_RESPONSE_SCHEMA,
  M3CertificationControlError,
  buildM3CertificationControlPlan,
  buildM3FailureResponse,
};
