'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');
const { listRegisteredSectionFamilies } = require('./producer-prompt-registry');
const { getFamilyDetectionProfile } = require('./family-detection-profiles');
const {
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
  SECTION_FAMILY_MANIFEST_ASSIGNED,
} = require('./section-family-classifier');
const { validateSourceDeclaration } = require('./unified-runner-validate');

const PROPOSAL_SCHEMA = 'NATIVE_FULL_CORPUS_EXECUTION_MANIFEST_PROPOSAL/V1';
const EXECUTION_AUTHORITY_SCHEMA = 'NATIVE_FULL_CORPUS_EXECUTION_AUTHORITY_BUNDLE/V1';
const SUPPORTED_SIGNAL_PROVENANCE = new Set([
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
  SECTION_FAMILY_MANIFEST_ASSIGNED,
]);

class FullCorpusExecutionManifestPlannerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'FullCorpusExecutionManifestPlannerError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new FullCorpusExecutionManifestPlannerError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    fail('INVALID_PLANNER_INPUT', `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function validateSourceFamilyUnit(unit, sourceById, familySet) {
  if (!unit || typeof unit !== 'object' || Array.isArray(unit)) {
    fail('INVALID_SOURCE_FAMILY_UNIT', 'Each source-family unit must be an object.');
  }
  const source = sourceById.get(unit.source_id);
  if (!source) fail('UNKNOWN_SOURCE_UNIT', 'A source-family unit names a source outside the explicit source list.');
  const blocked = source.disposition === 'BLOCKED_SOURCE_PIN';
  const expectedKeys = blocked
    ? ['source_id', 'family_id']
    : ['source_id', 'family_id', 'section_signals', 'draft_detection_profile', 'absence_coverage_attestation'];
  const legacyExtractKeys = ['source_id', 'family_id', 'section_signals', 'detection_profile'];
  const legacyExtractShape = !blocked && exactKeys(unit, legacyExtractKeys)
    && Array.isArray(unit.section_signals) && unit.section_signals.length > 0;
  if (!exactKeys(unit, expectedKeys) && !legacyExtractShape) {
    fail('INVALID_SOURCE_FAMILY_UNIT', `source-family unit ${unit.source_id}:${unit.family_id} has an invalid closed shape.`);
  }
  text(unit.source_id, 'source_family_unit.source_id');
  text(unit.family_id, 'source_family_unit.family_id');
  if (!familySet.has(unit.family_id)) {
    fail('UNREGISTERED_FAMILY', `source-family unit ${unit.source_id}:${unit.family_id} is not in the declared registered family universe.`);
  }
  if (!blocked) {
    if (!Array.isArray(unit.section_signals)) {
      fail('INVALID_SOURCE_FAMILY_UNIT', `source-family unit ${unit.source_id}:${unit.family_id} needs section_signals.`);
    }
    const signalRefs = new Set();
    for (const signal of unit.section_signals) {
      if (!exactKeys(signal, ['section_reference', 'provenance'])
        || typeof signal.section_reference !== 'string' || signal.section_reference.length === 0
        || !SUPPORTED_SIGNAL_PROVENANCE.has(signal.provenance)
        || signalRefs.has(signal.section_reference)) {
        fail('INVALID_CLASSIFIER_SIGNAL', `source-family unit ${unit.source_id}:${unit.family_id} has an invalid classifier signal.`);
      }
      signalRefs.add(signal.section_reference);
    }
    const profile = getFamilyDetectionProfile(unit.family_id);
    if (!profile) {
      fail('MISSING_FAMILY_PROFILE', `source-family unit ${unit.source_id}:${unit.family_id} has no draft detection profile.`);
    }
    const profileBinding = unit.draft_detection_profile || unit.detection_profile;
    if (!exactKeys(profileBinding, ['profile_id', 'profile_version', 'profile_digest'])
      || profileBinding.profile_id !== profile.profile_id
      || profileBinding.profile_version !== profile.profile_version
      || profileBinding.profile_digest !== profile.profile_digest) {
      fail('STALE_DETECTION_PROFILE', `source-family unit ${unit.source_id}:${unit.family_id} must bind the exact draft detection profile.`);
    }
  }
}

function validatePlanningProposal({
  sources,
  family_ids: familyIds,
  source_family_units: sourceFamilyUnits,
} = {}) {
  if (!Array.isArray(sources) || sources.length === 0 || !Array.isArray(sourceFamilyUnits)) {
    fail('INVALID_PLANNER_INPUT', 'sources and source_family_units must be explicit non-empty arrays.');
  }
  const registered = new Set(listRegisteredSectionFamilies());
  if (!Array.isArray(familyIds) || familyIds.length === 0
    || familyIds.some((familyId) => typeof familyId !== 'string' || !familyId.trim() || familyId.trim() !== familyId)
    || new Set(familyIds).size !== familyIds.length
    || canonicalJson(familyIds) !== canonicalJson([...familyIds].sort())) {
    fail('INVALID_PLANNER_INPUT', 'family_ids must be a sorted, unique non-empty text array.');
  }
  if (familyIds.some((familyId) => !registered.has(familyId))) {
    fail('UNREGISTERED_FAMILY', 'family_ids may contain only registered producer families.');
  }
  for (const source of sources) validateSourceDeclaration(source);
  const sourceById = new Map();
  for (const source of sources) {
    if (sourceById.has(source.source_id)) fail('DUPLICATE_SOURCE', `duplicate explicit source ${source.source_id}.`);
    sourceById.set(source.source_id, source);
  }
  const familySet = new Set(familyIds);
  const expectedUnitKeys = new Set([...sourceById.keys()].flatMap((sourceId) => familyIds.map((familyId) => `${sourceId}\u0000${familyId}`)));
  const unitsByKey = new Map();
  for (const unit of sourceFamilyUnits) {
    validateSourceFamilyUnit(unit, sourceById, familySet);
    const key = `${unit.source_id}\u0000${unit.family_id}`;
    if (unitsByKey.has(key)) fail('DUPLICATE_SOURCE_FAMILY_UNIT', `duplicate source-family unit ${unit.source_id}:${unit.family_id}.`);
    unitsByKey.set(key, unit);
  }
  if (unitsByKey.size !== expectedUnitKeys.size || [...expectedUnitKeys].some((key) => !unitsByKey.has(key))) {
    fail('MISSING_SOURCE_FAMILY_UNIT', 'source_family_units must cover every explicit source and declared family exactly once.');
  }
  return Object.freeze({
    sources: Object.freeze([...sources].sort((left, right) => left.source_id.localeCompare(right.source_id))),
    family_ids: Object.freeze([...familyIds]),
    source_family_units: Object.freeze([...sourceFamilyUnits].sort((left, right) => (
      `${left.source_id}\u0000${left.family_id}`.localeCompare(`${right.source_id}\u0000${right.family_id}`)
    ))),
  });
}

/**
 * Produces an inspection-only planning record. Source declarations are still
 * useful for identifying missing controller evidence, but they are not source
 * admissions and this function never reads their paths or bytes.
 */
function buildFullCorpusExecutionManifestProposal(input = {}) {
  const proposalInput = validatePlanningProposal(input);
  const units = proposalInput.source_family_units.map((unit) => Object.freeze({
    source_id: unit.source_id,
    family_id: unit.family_id,
    diagnostic_state: Array.isArray(unit.section_signals) && unit.section_signals.length > 0
      ? 'DECLARED_SIGNAL_REQUIRES_CONTROLLER_REVIEW'
      : 'NO_DECLARED_SIGNAL_NOT_A_NOT_PRESENT_CONCLUSION',
  }));
  const body = {
    schema_version: PROPOSAL_SCHEMA,
    status: 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY',
    authority: 'NONE',
    declared_sources: proposalInput.sources.map((source) => Object.freeze({
      source_id: source.source_id,
      declared_disposition: source.disposition,
    })),
    declared_family_ids: proposalInput.family_ids,
    source_family_diagnostics: Object.freeze(units),
    blockers: Object.freeze([
      'ISSUED_GOVERNED_IDENTITY_BRIDGE_REQUIRED',
      'SOURCE_DISPOSITION_CONTROLLER_RECEIPTS_REQUIRED',
      'TRUSTED_FAMILY_ABSENCE_EVIDENCE_REQUIRED',
      'EXTERNAL_EXECUTION_AUTHORITY_VERIFIER_REQUIRED',
    ]),
  };
  return Object.freeze({
    ...body,
    execution_manifest_proposal_id: contentId(PROPOSAL_SCHEMA, body),
  });
}

function requireIssuedExecutionAuthority(value, proposal) {
  const keys = [
    'schema_version', 'status', 'authority', 'issued_governed_identity_bridges',
    'source_disposition_controller_receipts', 'trusted_family_absence_evidence',
  ];
  if (!exactKeys(value, keys) || value.schema_version !== EXECUTION_AUTHORITY_SCHEMA
    || value.status !== 'ISSUED' || value.authority !== 'EXTERNAL_PROTECTED_CONTROLLER_ONLY') {
    fail('EXECUTION_AUTHORITY_NOT_ISSUED', 'An externally issued execution-authority bundle is required before a unified-run manifest can exist.');
  }
  const activeSources = proposal.declared_sources
    .filter((source) => source.declared_disposition !== 'BLOCKED_SOURCE_PIN')
    .map((source) => source.source_id);
  const noSignalUnits = proposal.source_family_diagnostics
    .filter((unit) => unit.diagnostic_state === 'NO_DECLARED_SIGNAL_NOT_A_NOT_PRESENT_CONCLUSION');
  if (!Array.isArray(value.issued_governed_identity_bridges)
    || value.issued_governed_identity_bridges.length !== activeSources.length) {
    fail('ISSUED_GOVERNED_IDENTITY_BRIDGE_REQUIRED', 'Every active source requires one issued governed identity bridge.');
  }
  if (!Array.isArray(value.source_disposition_controller_receipts)
    || value.source_disposition_controller_receipts.length !== activeSources.length) {
    fail('SOURCE_DISPOSITION_CONTROLLER_RECEIPTS_REQUIRED', 'Every active source requires one controller-issued source disposition receipt.');
  }
  if (!Array.isArray(value.trusted_family_absence_evidence)
    || value.trusted_family_absence_evidence.length !== noSignalUnits.length) {
    fail('TRUSTED_FAMILY_ABSENCE_EVIDENCE_REQUIRED', 'Every no-signal family requires one trusted family-absence evidence record.');
  }
  fail('EXTERNAL_EXECUTION_AUTHORITY_VERIFIER_UNAVAILABLE', 'Caller-supplied authority-shaped values cannot issue an executable unified-run manifest.');
}

function buildFullCorpusExecutionManifest({
  sources,
  family_ids: familyIds,
  source_family_units: sourceFamilyUnits,
  issued_execution_authority: issuedExecutionAuthority,
} = {}) {
  const proposal = buildFullCorpusExecutionManifestProposal({
    sources,
    family_ids: familyIds,
    source_family_units: sourceFamilyUnits,
  });
  requireIssuedExecutionAuthority(issuedExecutionAuthority, proposal);
  fail('EXTERNAL_EXECUTION_AUTHORITY_VERIFIER_UNAVAILABLE', 'An executable unified-run manifest requires a trusted external verifier.');
}

module.exports = {
  PROPOSAL_SCHEMA,
  EXECUTION_AUTHORITY_SCHEMA,
  FullCorpusExecutionManifestPlannerError,
  buildFullCorpusExecutionManifestProposal,
  buildFullCorpusExecutionManifest,
};
