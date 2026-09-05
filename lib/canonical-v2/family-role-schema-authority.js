'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const { REGISTERED_FAMILY_KEYS: FAMILY_KEYS } = require('../product/family-taxonomy');

const APPROVED_SCHEMA_VERSION = 'STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1';
const PROPOSED_SCHEMA_VERSION = 'STAGE_2Y_PROPOSED_FAMILY_REQUIRED_ROLE_SCHEMA/V1';
const EXECUTION_AUTHORITY_SCHEMA_VERSION = 'STAGE_2Y_M5_FAMILY_EXECUTION_AUTHORITY/V1';
const EXECUTION_AUTHORITY_STATE = 'ACTIVE_FOR_ONE_APPROVED_FAMILY_SHADOW_COMPARISON';
const PREPARATION_AUTHORITY_SCHEMA_VERSION = 'STAGE_2Y_M5_PREPARATION_AUTHORITY/V1';
const APPROVAL_STATE = 'BEN_APPROVED_AND_SEALED';
const APPROVER = 'BEN_GOODCHILD';
const HEX_256 = /^[0-9a-f]{64}$/;
const SEALED_ERROR_CODES = new Set([
  'PROPOSED_SCHEMA_NOT_RUNNER_ELIGIBLE',
  'PROPOSED_SCHEMA_VERSION_FORBIDDEN',
  'BEN_APPROVAL_BINDING_MISSING',
  'ROLE_SCHEMA_DIGEST_MISMATCH',
  'AUTHORITY_BINDING_MISMATCH',
]);

const APPROVED_MEMBERS = Object.freeze([
  'schema_version',
  'family_role_schema_id',
  'payload_digest',
  'family_key',
  'role_schema_version',
  'approval_state',
  'approval_id',
  'approver',
  'approved_at',
  'source_proposal_binding',
  'calibration_pack_binding',
  'ruling_bindings',
  'claim_definition_scope',
  'subtype_profiles',
  'cross_family_dependencies',
  'prohibitions',
]);

const CLAIM_SCOPE_MEMBERS = Object.freeze([
  'included_claim_definition_keys',
  'excluded_claim_definition_keys',
  'source_first_rule',
  'proposition_unit_rule',
]);

const PROFILE_MEMBERS = Object.freeze([
  'profile_id',
  'profile_version',
  'claim_definition_keys',
  'proposition_unit',
  'applicability_rule',
  'required_roles',
  'optional_roles',
  'role_order',
  'cross_family_rules',
  'unresolved_legal_question_ids',
]);

const ROLE_MEMBERS = Object.freeze([
  'role_key',
  'value_type',
  'cardinality',
  'required_for_complete',
  'allowed_sources',
  'provenance_requirements',
  'definition_or_reference_edge_requirement',
  'scope_requirement',
  'missing_disposition',
  'renderability_on_missing',
]);

const ALLOWED_ROLE_SOURCES = Object.freeze([
  'M2_SOURCE_NODE',
  'M3_CONTEXT_FACT',
  'M3_SCOPE_EDGE',
  'M3_REFERENCE_EDGE',
  'M3_DEFINITION_EDGE',
  'M3_SEMANTIC_RELATIONSHIP',
  'M4_ROLE_PROVENANCE',
]);

const REQUIRED_PROVENANCE = Object.freeze([
  'agreement_id',
  'source_node_occurrence_id',
  'source_span',
  'source_text_sha256',
  'source_role',
]);

const REQUIRED_PROHIBITIONS = Object.freeze([
  'NO_RUNNER_INPUT',
  'NO_COMPLETE_TRANSITION',
  'NO_RENDERING',
  'NO_APPROVAL_INFERENCE',
  'NO_RAW_SOURCE_REPARSE',
  'NO_PROJECTION_ROLE_FILL',
  'NO_CROSS_FAMILY_CONTENT_DUPLICATION',
]);

const AUTHORITY_REQUIRED_MEMBERS = Object.freeze([
  'schema_version',
  'authority_digest',
  'authority_state',
  'stage',
  'family_key',
  'approval_id',
  'approver',
  'approved_role_schema_binding',
]);

const APPROVED_BINDING_MEMBERS = Object.freeze([
  'path',
  'byte_length',
  'sha256',
  'schema_version',
  'family_key',
  'family_role_schema_id',
  'payload_digest',
  'approval_id',
]);

class FamilyRoleSchemaAuthorityError extends Error {
  constructor(code, detail) {
    super(`${code}: ${typeof detail === 'string' ? detail : canonicalJson(detail)}`);
    this.name = 'FamilyRoleSchemaAuthorityError';
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail) {
  const finalCode = SEALED_ERROR_CODES.has(code) ? code : `FAMILY_ROLE_SCHEMA_${code}`;
  throw new FamilyRoleSchemaAuthorityError(finalCode, detail);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactMembers(value, members, detail) {
  if (!isPlainObject(value)) fail('MEMBER_SET_MISMATCH', detail);
  const actual = Object.keys(value).sort();
  const expected = [...members].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail('MEMBER_SET_MISMATCH', { detail, expected, actual });
  }
}

function nonEmptyString(value, detail) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('VALUE_MISMATCH', detail);
  }
  return value;
}

function nonPlaceholder(value, detail) {
  nonEmptyString(value, detail);
  if (['PENDING', 'NON_NULL', 'PROPOSED', 'UNAPPROVED'].includes(value)) {
    fail('APPROVAL_MISMATCH', detail);
  }
  return value;
}

function hex256(value, detail) {
  if (typeof value !== 'string' || !HEX_256.test(value)) fail('IDENTITY_MISMATCH', detail);
  return value;
}

function stringArray(value, detail, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail('VALUE_MISMATCH', detail);
  }
  value.forEach((entry, index) => nonEmptyString(entry, `${detail}[${index}]`));
  if (new Set(value).size !== value.length) fail('DUPLICATE_VALUE', detail);
  return value;
}

function standardBinding(value, detail) {
  if (!isPlainObject(value)
    || typeof value.path !== 'string'
    || value.path.length === 0
    || value.path.startsWith('/')
    || value.path.includes('\\')
    || value.path.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
    || !Number.isSafeInteger(value.byte_length)
    || value.byte_length <= 0
    || !HEX_256.test(value.sha256 || '')) {
    fail('BINDING_MISMATCH', detail);
  }
}

function proposalDisposition(authority, proposal) {
  const expectedProposalPath = typeof proposal.family_key === 'string'
    ? `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/${proposal.family_key}.json`
    : null;
  const boundPath = authority?.approved_role_schema_binding?.path;
  if (authority?.schema_version === PREPARATION_AUTHORITY_SCHEMA_VERSION
    || (expectedProposalPath !== null && boundPath === expectedProposalPath)) {
    fail('PROPOSED_SCHEMA_NOT_RUNNER_ELIGIBLE', expectedProposalPath);
  }
  fail('PROPOSED_SCHEMA_VERSION_FORBIDDEN', boundPath ?? null);
}

function decodeJson(bytes, authority) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) fail('BYTES_REQUIRED', 'roleSchemaBytes');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('INVALID_UTF8', 'roleSchemaBytes');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail('INVALID_JSON', 'roleSchemaBytes');
  }
  if (!isPlainObject(parsed)) fail('INVALID_JSON', 'approved role schema must be an object');
  if (parsed.schema_version === PROPOSED_SCHEMA_VERSION) {
    proposalDisposition(authority, parsed);
  }
  return parsed;
}

function validateRole(role, required, profileId, ordinal) {
  const detail = `${profileId}.${required ? 'required_roles' : 'optional_roles'}[${ordinal}]`;
  exactMembers(role, ROLE_MEMBERS, detail);
  nonEmptyString(role.role_key, `${detail}.role_key`);
  nonEmptyString(role.value_type, `${detail}.value_type`);
  nonEmptyString(role.cardinality, `${detail}.cardinality`);
  if (role.required_for_complete !== required) fail('ROLE_REQUIREMENT_MISMATCH', detail);
  stringArray(role.allowed_sources, `${detail}.allowed_sources`, { allowEmpty: false });
  if (role.allowed_sources.some((source) => !ALLOWED_ROLE_SOURCES.includes(source))) {
    fail('ROLE_SOURCE_MISMATCH', detail);
  }
  stringArray(role.provenance_requirements, `${detail}.provenance_requirements`, { allowEmpty: false });
  if (REQUIRED_PROVENANCE.some((member) => !role.provenance_requirements.includes(member))) {
    fail('ROLE_PROVENANCE_MISMATCH', detail);
  }
  if (role.missing_disposition !== 'MISSING_REQUIRED_ROLE'
    || role.renderability_on_missing !== 'NON_RENDERABLE_MISSING_REQUIRED_ROLE') {
    fail('ROLE_FAILURE_MISMATCH', detail);
  }
}

function validateProfiles(schema) {
  if (!Array.isArray(schema.subtype_profiles) || schema.subtype_profiles.length === 0) {
    fail('PROFILE_MISMATCH', 'subtype_profiles');
  }
  const profileIds = new Set();
  for (const [ordinal, profile] of schema.subtype_profiles.entries()) {
    const detail = `subtype_profiles[${ordinal}]`;
    exactMembers(profile, PROFILE_MEMBERS, detail);
    nonEmptyString(profile.profile_id, `${detail}.profile_id`);
    if (profileIds.has(profile.profile_id)) fail('DUPLICATE_VALUE', profile.profile_id);
    profileIds.add(profile.profile_id);
    if (!Number.isSafeInteger(profile.profile_version) || profile.profile_version < 1) {
      fail('PROFILE_MISMATCH', `${detail}.profile_version`);
    }
    stringArray(profile.claim_definition_keys, `${detail}.claim_definition_keys`, { allowEmpty: false });
    const includedKeys = new Set(schema.claim_definition_scope.included_claim_definition_keys);
    if (profile.claim_definition_keys.some((key) => !includedKeys.has(key))) {
      fail('PROFILE_MISMATCH', `${detail}.claim_definition_keys`);
    }
    nonEmptyString(profile.proposition_unit, `${detail}.proposition_unit`);
    nonEmptyString(profile.applicability_rule, `${detail}.applicability_rule`);
    if (!Array.isArray(profile.required_roles) || !Array.isArray(profile.optional_roles)) {
      fail('PROFILE_MISMATCH', `${detail}.roles`);
    }
    if (profile.required_roles.length === 0) fail('PROFILE_MISMATCH', `${detail}.required_roles`);
    profile.required_roles.forEach((role, index) => validateRole(role, true, profile.profile_id, index));
    profile.optional_roles.forEach((role, index) => validateRole(role, false, profile.profile_id, index));
    const roles = [...profile.required_roles, ...profile.optional_roles].map((role) => role.role_key);
    if (new Set(roles).size !== roles.length) fail('DUPLICATE_VALUE', `${detail}.role_key`);
    stringArray(profile.role_order, `${detail}.role_order`);
    if (canonicalJson(profile.role_order) !== canonicalJson(roles)) {
      fail('ROLE_ORDER_MISMATCH', detail);
    }
    if (!Array.isArray(profile.cross_family_rules)) fail('PROFILE_MISMATCH', `${detail}.cross_family_rules`);
    stringArray(profile.unresolved_legal_question_ids, `${detail}.unresolved_legal_question_ids`);
    if (profile.unresolved_legal_question_ids.length !== 0) {
      fail('UNRESOLVED_LEGAL_QUESTION', { profile_id: profile.profile_id, question_ids: profile.unresolved_legal_question_ids });
    }
  }
}

function validateRulings(schema) {
  if (!Array.isArray(schema.ruling_bindings)) fail('APPROVAL_MISMATCH', 'ruling_bindings');
  const rulingIds = new Set();
  const questionIds = new Set();
  for (const [ordinal, ruling] of schema.ruling_bindings.entries()) {
    const detail = `ruling_bindings[${ordinal}]`;
    if (!isPlainObject(ruling)) fail('APPROVAL_MISMATCH', detail);
    standardBinding(ruling, detail);
    const rulingId = nonPlaceholder(ruling.ruling_id, `${detail}.ruling_id`);
    const questionId = nonPlaceholder(ruling.question_id, `${detail}.question_id`);
    if (ruling.approval_id !== schema.approval_id || ruling.approver !== APPROVER) {
      fail('APPROVAL_MISMATCH', detail);
    }
    if (rulingIds.has(rulingId) || questionIds.has(questionId)) fail('DUPLICATE_VALUE', detail);
    rulingIds.add(rulingId);
    questionIds.add(questionId);
  }
}

function validateApprovedSchema(schema) {
  if (schema.schema_version !== APPROVED_SCHEMA_VERSION) {
    fail('SCHEMA_VERSION_MISMATCH', schema.schema_version ?? null);
  }
  const proposalOnlyMembers = [
    'proposed_role_schema_id',
    'proposal_digest',
    'status',
    'runner_eligible',
    'complete_transition_authorised',
    'schema_authority',
    'authority_binding',
    'calibration_policy_binding',
    'renderability_rule',
    'approval_requirements',
    'open_legal_question_ids',
  ];
  const requiredApprovalMembers = [
    'approval_state',
    'approval_id',
    'approver',
    'approved_at',
    'source_proposal_binding',
    'calibration_pack_binding',
    'ruling_bindings',
    'family_role_schema_id',
    'payload_digest',
  ];
  if (proposalOnlyMembers.some((member) => Object.hasOwn(schema, member))
    || requiredApprovalMembers.some((member) => !Object.hasOwn(schema, member))
    || schema.approval_state !== APPROVAL_STATE
    || schema.approver !== APPROVER
    || typeof schema.approval_id !== 'string'
    || schema.approval_id.length === 0) {
    fail('BEN_APPROVAL_BINDING_MISSING', requiredApprovalMembers);
  }
  exactMembers(schema, APPROVED_MEMBERS, 'approved role schema');
  if (!FAMILY_KEYS.includes(schema.family_key)) fail('FAMILY_MISMATCH', schema.family_key ?? null);
  if (!Number.isSafeInteger(schema.role_schema_version) || schema.role_schema_version < 1) {
    fail('VALUE_MISMATCH', 'role_schema_version');
  }
  nonPlaceholder(schema.approval_id, 'approval_id');
  const approvedAt = typeof schema.approved_at === 'string' ? Date.parse(schema.approved_at) : NaN;
  if (!Number.isFinite(approvedAt) || new Date(approvedAt).toISOString() !== schema.approved_at) {
    fail('APPROVAL_MISMATCH', 'approved_at');
  }
  standardBinding(schema.source_proposal_binding, 'source_proposal_binding');
  standardBinding(schema.calibration_pack_binding, 'calibration_pack_binding');
  const expectedProposalPath = `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/proposed-role-schemas/${schema.family_key}.json`;
  const expectedPackPath = `evidence/canonical-v2/stage-2y-structure-migration/preparation/m5/calibration-packs/${schema.family_key}.json`;
  if (schema.source_proposal_binding.path !== expectedProposalPath
    || schema.calibration_pack_binding.path !== expectedPackPath) {
    fail('BINDING_MISMATCH', 'proposal or calibration pack path');
  }
  exactMembers(schema.claim_definition_scope, CLAIM_SCOPE_MEMBERS, 'claim_definition_scope');
  stringArray(schema.claim_definition_scope.included_claim_definition_keys, 'included_claim_definition_keys', { allowEmpty: false });
  stringArray(schema.claim_definition_scope.excluded_claim_definition_keys, 'excluded_claim_definition_keys');
  nonEmptyString(schema.claim_definition_scope.source_first_rule, 'source_first_rule');
  nonEmptyString(schema.claim_definition_scope.proposition_unit_rule, 'proposition_unit_rule');
  validateProfiles(schema);
  validateRulings(schema);
  if (!Array.isArray(schema.cross_family_dependencies)
    || schema.cross_family_dependencies.some((entry) => !isPlainObject(entry))) {
    fail('CROSS_FAMILY_DEPENDENCY_MISMATCH', 'cross_family_dependencies');
  }
  if (canonicalJson(schema.prohibitions) !== canonicalJson(REQUIRED_PROHIBITIONS)) {
    fail('PROHIBITION_MISMATCH', schema.prohibitions);
  }

  const unsigned = structuredClone(schema);
  delete unsigned.family_role_schema_id;
  delete unsigned.payload_digest;
  const expectedDigest = sha256Hex(canonicalJson(unsigned));
  if (schema.payload_digest !== expectedDigest) {
    fail('ROLE_SCHEMA_DIGEST_MISMATCH', schema.payload_digest ?? null);
  }
  const expectedId = contentId(schema.schema_version, { ...unsigned, payload_digest: expectedDigest });
  if (schema.family_role_schema_id !== expectedId) {
    fail('ROLE_SCHEMA_DIGEST_MISMATCH', schema.family_role_schema_id ?? null);
  }
  hex256(schema.family_role_schema_id, 'family_role_schema_id');
  hex256(schema.payload_digest, 'payload_digest');
}

function validateExecutionAuthority(authority, schema, bytes) {
  if (!isPlainObject(authority)
    || AUTHORITY_REQUIRED_MEMBERS.some((member) => !Object.hasOwn(authority, member))) {
    fail('BEN_APPROVAL_BINDING_MISSING', 'familyExecutionAuthority');
  }
  if (authority.schema_version !== EXECUTION_AUTHORITY_SCHEMA_VERSION
    || authority.authority_state !== EXECUTION_AUTHORITY_STATE
    || authority.stage !== 'M5') {
    fail('AUTHORITY_BINDING_MISMATCH', {
      schema_version: authority.schema_version,
      authority_state: authority.authority_state,
      stage: authority.stage,
    });
  }
  const unsigned = structuredClone(authority);
  delete unsigned.authority_digest;
  if (authority.authority_digest !== sha256Hex(canonicalJson(unsigned))) {
    fail('AUTHORITY_BINDING_MISMATCH', authority.authority_digest ?? null);
  }
  if (authority.family_key !== schema.family_key
    || authority.approval_id !== schema.approval_id
    || authority.approver !== APPROVER) {
    fail('AUTHORITY_BINDING_MISMATCH', 'family or Ben approval binding');
  }
  exactMembers(authority.approved_role_schema_binding, APPROVED_BINDING_MEMBERS, 'approved_role_schema_binding');
  const binding = authority.approved_role_schema_binding;
  const expectedPath = `evidence/canonical-v2/stage-2y-structure-migration/control/family-role-schemas/${schema.family_key}.json`;
  if (binding.path !== expectedPath
    || binding.byte_length !== bytes.length
    || binding.sha256 !== sha256Hex(bytes)
    || binding.schema_version !== schema.schema_version
    || binding.family_key !== schema.family_key
    || binding.family_role_schema_id !== schema.family_role_schema_id
    || binding.payload_digest !== schema.payload_digest
    || binding.approval_id !== schema.approval_id) {
    fail('AUTHORITY_BINDING_MISMATCH', binding);
  }
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function validateApprovedFamilyRoleSchema(roleSchemaBytes, familyExecutionAuthority) {
  const schema = decodeJson(roleSchemaBytes, familyExecutionAuthority);
  validateApprovedSchema(schema);
  validateExecutionAuthority(familyExecutionAuthority, schema, roleSchemaBytes);
  return deepFreeze(structuredClone(schema));
}

module.exports = {
  validateApprovedFamilyRoleSchema,
};
