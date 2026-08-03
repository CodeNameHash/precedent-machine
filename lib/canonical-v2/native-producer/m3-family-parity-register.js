'use strict';

const path = require('node:path');

const { canonicalJson, contentId } = require('../canonical-bytes');

const REGISTER_SCHEMA = 'CANONICAL_V2_M3_FAMILY_PARITY_REGISTER/V1';
const STATUS_SCHEMA = 'CANONICAL_V2_M3_FAMILY_PARITY_STATUS/V1';
const MILESTONE_ID = 'M3_FULL_CORPUS_CERTIFICATION';
const SOURCE_KINDS = Object.freeze([
  'DERIVED_VALUE',
  'MARKET_FIELD',
  'QUERY_FIELD',
  'RENDERED_ROW',
  'SIDE_TABLE',
]);
const FAMILY_IDS = Object.freeze([
  'ANTITRUST_REGULATORY_EFFORTS',
  'APPRAISAL_DISSENTERS_RIGHTS',
  'CLOSING_CONDITIONS',
  'CONSIDERATION',
  'DIVIDENDS',
  'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS',
  'FINANCING_COVENANTS',
  'GUARANTY_FINANCING_PARTY',
  'INTERIM_OPERATING_COVENANTS',
  'KEY_DEFINED_TERMS',
  'MAE_DEFINITION',
  'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE',
  'NO_SHOP',
  'PROXY_MEETING_COVENANTS',
  'SPECIFIC_PERFORMANCE_REMEDIES',
  'TAX_MATTERS',
  'TERMINATION_FEE',
  'TERMINATION_RIGHTS',
]);
const STATES = Object.freeze(['BLOCKED', 'OPEN', 'PASS']);
const WAVE_A_CHECKS = Object.freeze([
  'fixture_proof',
  'lexical_net',
  'producer',
  'registry',
  'resolver',
]);
const OPEN_DISPOSITION = 'FOLLOW_ON_REQUIRED';
const TERMINAL_DISPOSITIONS = Object.freeze([
  'APPROVED_DERIVED',
  'APPROVED_RETIRED',
  'NATIVE_COMPLETE',
]);
const REGISTER_PATH = path.resolve(
  __dirname,
  '../../../docs/codex-program/m3-family-parity-register.json',
);

class M3FamilyParityRegisterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'M3FamilyParityRegisterError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new M3FamilyParityRegisterError(code, message, details);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    fail('INVALID_PARITY_REGISTER', `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function state(value, label) {
  if (!STATES.includes(value)) {
    fail('INVALID_PARITY_REGISTER', `${label} must use an allowed programme state.`, { value });
  }
  return value;
}

function evidencePaths(value, label, itemState) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry)) {
    fail('INVALID_PARITY_REGISTER', `${label} must be an array of repository paths.`);
  }
  if (itemState === 'PASS' && value.length === 0) {
    fail('UNSUPPORTED_PARITY_PASS', `${label} must contain evidence before the item can pass.`);
  }
  return value;
}

function validateCheck(check, label) {
  if (!exactKeys(check, ['evidence_paths', 'state'])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed Wave A check contract.`);
  }
  const checkState = state(check.state, `${label}.state`);
  evidencePaths(check.evidence_paths, `${label}.evidence_paths`, checkState);
}

function validateSurface(surface, label) {
  if (!exactKeys(surface, [
    'disposition',
    'evidence_paths',
    'source_kind',
    'source_locator',
    'source_path',
    'state',
    'surface_id',
    'wave',
  ])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed product-surface contract.`);
  }
  text(surface.surface_id, `${label}.surface_id`);
  if (!SOURCE_KINDS.includes(surface.source_kind)) {
    fail('INVALID_PARITY_REGISTER', `${label}.source_kind is not governed.`, {
      source_kind: surface.source_kind,
    });
  }
  text(surface.source_path, `${label}.source_path`);
  text(surface.source_locator, `${label}.source_locator`);
  if (surface.wave !== 'FOLLOW_ON') {
    fail('INVALID_PARITY_REGISTER', `${label}.wave must be FOLLOW_ON.`);
  }
  const surfaceState = state(surface.state, `${label}.state`);
  evidencePaths(surface.evidence_paths, `${label}.evidence_paths`, surfaceState);
  const permittedDispositions = [OPEN_DISPOSITION, ...TERMINAL_DISPOSITIONS];
  if (!permittedDispositions.includes(surface.disposition)) {
    fail('INVALID_PARITY_REGISTER', `${label}.disposition is not governed.`);
  }
  if (surfaceState === 'PASS' && !TERMINAL_DISPOSITIONS.includes(surface.disposition)) {
    fail('OPEN_FOLLOW_ON_CANNOT_PASS', `${label} cannot pass while follow-on work is required.`);
  }
  if (surfaceState !== 'PASS' && surface.disposition !== OPEN_DISPOSITION) {
    fail('TERMINAL_DISPOSITION_NOT_PROVEN', `${label} cannot use a terminal disposition before it passes.`);
  }
}

function validateFamily(family, index) {
  const label = `families[${index}]`;
  if (!exactKeys(family, [
    'design_path',
    'family_id',
    'product_surfaces',
    'wave_a',
  ])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed family contract.`);
  }
  text(family.family_id, `${label}.family_id`);
  text(family.design_path, `${label}.design_path`);
  if (!exactKeys(family.wave_a, ['checks', 'scope'])) {
    fail('INVALID_PARITY_REGISTER', `${label}.wave_a must match the closed Wave A contract.`);
  }
  if (family.wave_a.scope !== 'FIRST_NATIVE_SLICE') {
    fail('INVALID_PARITY_REGISTER', `${label}.wave_a.scope must be FIRST_NATIVE_SLICE.`);
  }
  if (!exactKeys(family.wave_a.checks, WAVE_A_CHECKS)) {
    fail('INVALID_PARITY_REGISTER', `${label}.wave_a.checks must contain every required build check.`);
  }
  WAVE_A_CHECKS.forEach((key) => validateCheck(
    family.wave_a.checks[key],
    `${label}.wave_a.checks.${key}`,
  ));
  if (!Array.isArray(family.product_surfaces) || family.product_surfaces.length === 0) {
    fail('INVALID_PARITY_REGISTER', `${label}.product_surfaces must not be empty.`);
  }
  family.product_surfaces.forEach((surface, surfaceIndex) => (
    validateSurface(surface, `${label}.product_surfaces[${surfaceIndex}]`)
  ));
}

function validateUnassignedSurface(surface, index) {
  const label = `unassigned_product_surfaces[${index}]`;
  if (!exactKeys(surface, [
    'reason',
    'source_kind',
    'source_locator',
    'source_path',
    'surface_id',
  ])) {
    fail('INVALID_PARITY_REGISTER', `${label} must match the closed unassigned-surface contract.`);
  }
  text(surface.surface_id, `${label}.surface_id`);
  if (!SOURCE_KINDS.includes(surface.source_kind)) {
    fail('INVALID_PARITY_REGISTER', `${label}.source_kind is not governed.`);
  }
  text(surface.source_path, `${label}.source_path`);
  text(surface.source_locator, `${label}.source_locator`);
  text(surface.reason, `${label}.reason`);
}

function validateM3FamilyParityRegister(register) {
  if (!exactKeys(register, [
    'families',
    'milestone_id',
    'schema',
    'source_kinds',
    'unassigned_product_surfaces',
  ])) {
    fail('INVALID_PARITY_REGISTER', 'The M3 family parity register does not match its closed contract.');
  }
  if (register.schema !== REGISTER_SCHEMA || register.milestone_id !== MILESTONE_ID) {
    fail('INVALID_PARITY_REGISTER', 'The M3 family parity register has the wrong authority binding.');
  }
  if (canonicalJson(register.source_kinds) !== canonicalJson(SOURCE_KINDS)) {
    fail('INVALID_PARITY_REGISTER', 'The M3 family parity register source-kind universe changed.');
  }
  if (!Array.isArray(register.families) || register.families.length !== FAMILY_IDS.length) {
    fail('INVALID_PARITY_REGISTER', 'The M3 family parity register must contain exactly 20 designed families.');
  }
  register.families.forEach(validateFamily);
  const familyIds = register.families.map((family) => family.family_id);
  if (canonicalJson(familyIds) !== canonicalJson(FAMILY_IDS)) {
    fail('INVALID_PARITY_REGISTER', 'The exact 20-family design universe must remain unique, complete and sorted.');
  }
  if (!Array.isArray(register.unassigned_product_surfaces)) {
    fail('INVALID_PARITY_REGISTER', 'unassigned_product_surfaces must be an array.');
  }
  register.unassigned_product_surfaces.forEach(validateUnassignedSurface);
  const surfaceIds = [
    ...register.families.flatMap((family) => family.product_surfaces.map((surface) => surface.surface_id)),
    ...register.unassigned_product_surfaces.map((surface) => surface.surface_id),
  ];
  if (new Set(surfaceIds).size !== surfaceIds.length) {
    fail('INVALID_PARITY_REGISTER', 'Product surface IDs must be unique across the register.');
  }
  return register;
}

function familyCompletionState(family) {
  const waveAComplete = WAVE_A_CHECKS.every((key) => family.wave_a.checks[key].state === 'PASS');
  if (!waveAComplete) return 'WAVE_A_OPEN';
  if (family.product_surfaces.some((surface) => surface.state !== 'PASS')) {
    return 'FOLLOW_ON_OPEN';
  }
  return 'FAMILY_COMPLETE';
}

function buildM3FamilyParityStatus(register) {
  validateM3FamilyParityRegister(register);
  const familyStates = register.families.map((family) => ({
    family_id: family.family_id,
    completion_state: familyCompletionState(family),
  }));
  const body = {
    schema_version: STATUS_SCHEMA,
    register_id: contentId(REGISTER_SCHEMA, register),
    milestone_id: MILESTONE_ID,
    state: familyStates.every((family) => family.completion_state === 'FAMILY_COMPLETE')
      && register.unassigned_product_surfaces.length === 0
      ? 'FAMILY_COMPLETE'
      : 'BLOCKED',
    family_states: familyStates,
    unassigned_product_surface_ids: register.unassigned_product_surfaces
      .map((surface) => surface.surface_id)
      .sort(),
  };
  return Object.freeze({
    ...body,
    m3_family_parity_status_id: contentId(STATUS_SCHEMA, body),
  });
}

function validateM3FamilyParityStatus(status) {
  if (!exactKeys(status, [
    'family_states',
    'm3_family_parity_status_id',
    'milestone_id',
    'register_id',
    'schema_version',
    'state',
    'unassigned_product_surface_ids',
  ]) || status.schema_version !== STATUS_SCHEMA || status.milestone_id !== MILESTONE_ID) {
    fail('INVALID_PARITY_STATUS', 'A governed M3 family parity status is required.');
  }
  const { m3_family_parity_status_id: statusId, ...body } = status;
  if (statusId !== contentId(STATUS_SCHEMA, body)) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status identity does not match its content.');
  }
  if (!['BLOCKED', 'FAMILY_COMPLETE'].includes(status.state)) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status has an invalid state.');
  }
  if (!Array.isArray(status.family_states) || status.family_states.length !== FAMILY_IDS.length) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status must cover all 20 families.');
  }
  const statusFamilyIds = status.family_states.map((family, index) => {
    if (!exactKeys(family, ['completion_state', 'family_id'])
      || !['FAMILY_COMPLETE', 'FOLLOW_ON_OPEN', 'WAVE_A_OPEN'].includes(family.completion_state)) {
      fail('INVALID_PARITY_STATUS', `family_states[${index}] is invalid.`);
    }
    return family.family_id;
  });
  if (canonicalJson(statusFamilyIds) !== canonicalJson(FAMILY_IDS)) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status does not cover the exact family universe.');
  }
  if (!Array.isArray(status.unassigned_product_surface_ids)
    || status.unassigned_product_surface_ids.some((surfaceId) => typeof surfaceId !== 'string' || !surfaceId)
    || canonicalJson(status.unassigned_product_surface_ids)
      !== canonicalJson([...new Set(status.unassigned_product_surface_ids)].sort())) {
    fail('INVALID_PARITY_STATUS', 'Unassigned product surface IDs must be unique and sorted.');
  }
  const complete = status.family_states.every(
    (family) => family.completion_state === 'FAMILY_COMPLETE',
  ) && status.unassigned_product_surface_ids.length === 0;
  if ((status.state === 'FAMILY_COMPLETE') !== complete) {
    fail('INVALID_PARITY_STATUS', 'The M3 family parity status conflicts with its family and product-surface states.');
  }
  return status;
}

const CURRENT_M3_FAMILY_PARITY_REGISTER = deepFreeze(require(REGISTER_PATH));
const CURRENT_M3_FAMILY_PARITY_STATUS = buildM3FamilyParityStatus(
  CURRENT_M3_FAMILY_PARITY_REGISTER,
);

module.exports = {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  CURRENT_M3_FAMILY_PARITY_STATUS,
  FAMILY_IDS,
  M3FamilyParityRegisterError,
  MILESTONE_ID,
  OPEN_DISPOSITION,
  REGISTER_PATH,
  REGISTER_SCHEMA,
  SOURCE_KINDS,
  STATUS_SCHEMA,
  TERMINAL_DISPOSITIONS,
  WAVE_A_CHECKS,
  buildM3FamilyParityStatus,
  familyCompletionState,
  validateM3FamilyParityRegister,
  validateM3FamilyParityStatus,
};
