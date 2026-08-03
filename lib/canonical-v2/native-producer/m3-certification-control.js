'use strict';

const crypto = require('node:crypto');

const { canonicalJson, contentId } = require('../canonical-bytes');
const {
  buildKnownDefectRegistry,
  matchesKnownDefect,
  validateKnownDefectRegistry,
} = require('./known-defect-registry');

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
  known_defect_registry: knownDefectRegistry,
  sampling_seed: samplingSeed,
  sample_rate: sampleRate = SAMPLE_RATE,
} = {}) {
  requireString(candidateSetId, 'candidate_set_id');
  requireString(samplingSeed, 'sampling_seed');
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

function validateFinding(finding, sampledIds, candidateById, index) {
  const label = `findings[${index}]`;
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
    fail('INVALID_INPUT', `${label} must be an object`, { index });
  }
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
    if (finding.defect_entry.deal !== candidate.deal
      || finding.defect_entry.family !== candidate.family
      || (finding.defect_entry.attribute !== '*' && finding.defect_entry.attribute !== candidate.attribute)
      || finding.defect_entry.extraction_mechanism !== candidate.extraction_mechanism) {
      fail('DEFECT_SCOPE_MISMATCH', 'a sampled error must add a defect entry bound to its deal, family and extraction mechanism', {
        candidate_id: finding.candidate_id,
      });
    }
  } else if ('defect_entry' in finding) {
    fail('INVALID_INPUT', `${label}.defect_entry is permitted only for CONFIRMED_ERROR`, { index });
  }
}

function buildM3FailureResponse({
  plan,
  findings,
  known_defect_registry: knownDefectRegistry,
  next_registry_version: nextRegistryVersion,
} = {}) {
  requirePlan(plan);
  validateKnownDefectRegistry(knownDefectRegistry);
  const recomputedPlan = buildM3CertificationControlPlan({
    candidate_set_id: plan.candidate_set_id,
    candidates: plan.candidates,
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

  const errors = findings.filter((finding) => finding.outcome === 'CONFIRMED_ERROR');
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
  }

  const updatedRegistry = buildKnownDefectRegistry({
    version: nextRegistryVersion,
    entries: [
      ...knownDefectRegistry.entries.map(({ schema_version, ...entry }) => entry),
      ...errors.map((finding) => finding.defect_entry),
    ],
  });
  const body = {
    schema_version: M3_FAILURE_RESPONSE_SCHEMA,
    m3_certification_control_plan_id: plan.m3_certification_control_plan_id,
    reviewed_sample_count: findings.length,
    confirmed_error_count: errors.length,
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
