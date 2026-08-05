'use strict';

const {
  BEN_APPROVER_KEY_ID,
  FROZEN_KEY_REGISTRY_ROLE_DOMAIN_GRANTS,
  FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA: PROPOSAL_SCHEMA,
  buildFrozenKeyRegistryAmendmentProposal,
} = require('./governed-identity-trust-contracts');
const { canonicalJson, contentId } = require('./canonical-bytes');
const { domainDigest } = require('../programme-gates/bytes');
const { REGISTRY_DIGESTS, TRUSTED_PUBLIC_KEY_REGISTRY } = require('../programme-gates/registry');
const { RECORDED_RULINGS, decisionById } = require('../programme-decision-console');

const DIGEST_RE = /^[a-f0-9]{64}$/;
const LITERAL_PATCH_SCHEMA = 'GOVERNED_IDENTITY_LITERAL_TRUSTED_KEY_REGISTRY_PATCH_PROPOSAL/V1';
const TRUSTED_PUBLIC_KEY_REGISTRY_DOMAIN = 'PROGRAMME_GATE_TRUSTED_PUBLIC_KEY_REGISTRY/V1';
const BEN_KEY_ROTATION_CONDITION = 'APPROVAL_SIGNATURE_MUST_VERIFY_AGAINST_AN_ACTIVE_SUCCESSOR_KEY_IF_SIGNED_ON_OR_AFTER_VALID_UNTIL';
const NEW_KEY_ROLES = Object.freeze([
  'IDENTITY_ALLOCATION_CONTROLLER',
  'IDENTITY_BRIDGE_ISSUER',
  'V1_CAPTURE_CONTROLLER',
  'V1_FINAL_VALIDATOR',
  'V1_REPLAY_CONTROLLER',
]);
const IDENTITY_ROLES = Object.freeze(['BEN_APPROVER', 'IDENTITY_ALLOCATION_CONTROLLER', 'IDENTITY_BRIDGE_ISSUER']);
const V1_CONTROL_ROLES = Object.freeze(['V1_CAPTURE_CONTROLLER', 'V1_FINAL_VALIDATOR', 'V1_REPLAY_CONTROLLER']);
const CANONICAL_RECORDED_RULING_ID = 'identity-initial-import-foundation';
const CANONICAL_RECORDED_RULING_DECISION = decisionById(CANONICAL_RECORDED_RULING_ID);
const CANONICAL_RECORDED_RULING = Object.freeze({
  ruling_id: CANONICAL_RECORDED_RULING_ID,
  source: CANONICAL_RECORDED_RULING_DECISION?.source,
});

class DealIdentityTrustedKeyRegistryProposalError extends Error {
  constructor(code, message) { super(message); this.name = 'DealIdentityTrustedKeyRegistryProposalError'; this.code = code; }
}

function fail(code, message) { throw new DealIdentityTrustedKeyRegistryProposalError(code, message); }
function plain(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function exactKeys(value, keys, label) {
  if (!plain(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} has unsupported or missing fields.`);
}
function requireText(value, label, pattern = /^[A-Za-z0-9][A-Za-z0-9._:/ -]{2,511}$/) {
  if (typeof value !== 'string' || !pattern.test(value)) fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} is invalid.`);
  return value;
}
function requireTimestamp(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return value;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} must be an ISO timestamp.`);
  }
  return value;
}
function requirePublicKey(value, label) {
  if (typeof value !== 'string' || !/^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\n]+-----END PUBLIC KEY-----\n?$/.test(value)) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} must contain a public key PEM.`);
  }
  return value;
}

function activeAt(record, approvalTime, label) {
  const time = Date.parse(approvalTime);
  if (Date.parse(record.valid_from) > time || Date.parse(record.valid_until) <= time
    || (record.revoked_at !== null && Date.parse(record.revoked_at) <= time)) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} is not active at approval_time.`);
  }
}

function validateRegistryKey(value, label, { custodyRequired = false } = {}) {
  const keys = ['algorithm', 'key_id', 'permitted_domains', 'permitted_roles', 'public_key_pem', 'revoked_at', 'valid_from', 'valid_until'];
  if (custodyRequired) keys.push('custody');
  exactKeys(value, keys, label);
  requireText(value.key_id, `${label} key ID`);
  if (value.algorithm !== 'Ed25519') fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} must use Ed25519.`);
  requirePublicKey(value.public_key_pem, `${label} public key`);
  if (!Array.isArray(value.permitted_roles) || !Array.isArray(value.permitted_domains)
    || value.permitted_roles.some((entry) => typeof entry !== 'string')
    || value.permitted_domains.some((entry) => typeof entry !== 'string')) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} role and domain lists are invalid.`);
  }
  requireTimestamp(value.valid_from, `${label} valid_from`);
  requireTimestamp(value.valid_until, `${label} valid_until`);
  requireTimestamp(value.revoked_at, `${label} revoked_at`, { nullable: true });
  if (Date.parse(value.valid_from) >= Date.parse(value.valid_until)) fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} validity range is invalid.`);
  if (value.revoked_at !== null && Date.parse(value.revoked_at) < Date.parse(value.valid_from)) fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} revocation precedes valid_from.`);
  if (custodyRequired) {
    exactKeys(value.custody, ['custodian_id', 'key_origin', 'private_key_access', 'rotation_condition'], `${label} custody`);
    requireText(value.custody.custodian_id, `${label} custodian`);
    requireText(value.custody.key_origin, `${label} key origin`);
    requireText(value.custody.rotation_condition, `${label} rotation condition`);
    if (value.custody.private_key_access !== 'EXTERNAL_ONLY') {
      fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `${label} custody must keep private-key access external only.`);
    }
  }
  return value;
}

function registryDigest(registry) {
  return domainDigest(TRUSTED_PUBLIC_KEY_REGISTRY_DOMAIN, registry);
}

function grantForRole(role) {
  const grant = FROZEN_KEY_REGISTRY_ROLE_DOMAIN_GRANTS.find((entry) => entry.role === role);
  if (!grant) fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `No frozen grant exists for ${role}.`);
  return grant;
}

function presentationForRoles(roles) {
  return Object.freeze(roles.map((role) => grantForRole(role)));
}

function validateBaseRegistry(value) {
  exactKeys(value, ['keys', 'registry_state', 'schema_version'], 'Base trusted-key registry');
  if (value.schema_version !== 'TrustedProgrammeGatePublicKeys/V1' || value.registry_state !== 'ACTIVE' || !Array.isArray(value.keys)) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Base trusted-key registry must be active and use the current schema.');
  }
  value.keys.forEach((entry, index) => validateRegistryKey(entry, `Base registry key ${index}`));
  const keyIds = value.keys.map((entry) => entry.key_id);
  if (new Set(keyIds).size !== keyIds.length || !keyIds.includes(BEN_APPROVER_KEY_ID)) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Base registry must contain one existing Ben approver key.');
  }
  return value;
}

function validateNewKeyRecords(value, approvalTime) {
  if (!Array.isArray(value) || value.length !== NEW_KEY_ROLES.length) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Literal patch requires exactly five new public-key records.');
  }
  const expectedByRole = new Map(NEW_KEY_ROLES.map((role) => [role, grantForRole(role)]));
  const records = value.map((record, index) => validateRegistryKey(record, `New registry key ${index}`, { custodyRequired: true }));
  const keyIds = records.map((record) => record.key_id);
  if (new Set(keyIds).size !== keyIds.length) fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'New registry key IDs must be unique.');
  for (const [role, grant] of expectedByRole) {
    const record = records.find((entry) => entry.key_id === grant.key_id);
    if (!record || !same(record.permitted_roles, [role]) || !same(record.permitted_domains, [grant.permitted_domain]) || record.revoked_at !== null) {
      fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', `New registry key for ${role} must contain the exact active least-privilege grant.`);
    }
    activeAt(record, approvalTime, `New registry key for ${role}`);
  }
  if (records.some((record) => ![...expectedByRole.values()].some((grant) => grant.key_id === record.key_id))) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Literal patch cannot add an unapproved registry key.');
  }
  return records;
}

function buildAfterRegistry(baseRegistry, newKeyRecords) {
  const benGrant = grantForRole('BEN_APPROVER');
  const keys = baseRegistry.keys.map((entry) => {
    if (entry.key_id !== BEN_APPROVER_KEY_ID) return structuredClone(entry);
    if (entry.revoked_at !== null || !entry.permitted_roles.includes('BEN_APPROVER') || entry.permitted_domains.includes(benGrant.permitted_domain)) {
      fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Existing Ben key cannot receive the requested grant.');
    }
    return {
      ...structuredClone(entry),
      permitted_domains: [...entry.permitted_domains, benGrant.permitted_domain],
    };
  });
  for (const record of newKeyRecords) {
    const { custody: ignoredCustody, ...registryRecord } = record;
    keys.push(structuredClone(registryRecord));
  }
  return Object.freeze({
    schema_version: baseRegistry.schema_version,
    registry_state: baseRegistry.registry_state,
    keys: Object.freeze(keys),
  });
}

function compileLiteralTrustedKeyRegistryPatchProposal(input = {}) {
  exactKeys(input, ['approval_time', 'new_key_records'], 'Literal trusted-key registry patch input');
  const { approval_time: approvalTime, new_key_records: newKeyRecords } = input;
  requireTimestamp(approvalTime, 'approval_time');
  const baseRegistry = TRUSTED_PUBLIC_KEY_REGISTRY;
  const baseDigest = REGISTRY_DIGESTS.trusted_public_keys;
  validateBaseRegistry(baseRegistry);
  if (typeof baseDigest !== 'string' || !DIGEST_RE.test(baseDigest) || baseDigest !== registryDigest(baseRegistry)) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Literal patch must bind the exact current base registry digest.');
  }
  if (RECORDED_RULINGS[CANONICAL_RECORDED_RULING_ID] !== 'adopt-v2-namespace-seeds-and-tx-sequence'
    || typeof CANONICAL_RECORDED_RULING.source !== 'string' || CANONICAL_RECORDED_RULING.source.length === 0) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Canonical recorded ruling is unavailable.');
  }
  const records = validateNewKeyRecords(newKeyRecords, approvalTime);
  if (records.some((record) => baseRegistry.keys.some((existing) => existing.key_id === record.key_id))) {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Literal patch cannot replace or duplicate an existing registry key.');
  }
  const afterRegistry = buildAfterRegistry(baseRegistry, records);
  const benKey = baseRegistry.keys.find((entry) => entry.key_id === BEN_APPROVER_KEY_ID);
  activeAt(benKey, approvalTime, 'Existing Ben approver key');
  const body = {
    schema_version: LITERAL_PATCH_SCHEMA,
    state: 'PROPOSAL_ONLY_LITERAL_PATCH_PENDING_EXACT_APPROVAL',
    authority: 'NONE', issuance_authority: 'NONE', registry_activation_authority: 'NONE', signing_authority: 'NONE',
    before_registry: structuredClone(baseRegistry), after_registry: structuredClone(afterRegistry),
    base_trusted_key_registry_digest: baseDigest,
    successor_trusted_key_registry_digest: registryDigest(afterRegistry),
    new_key_records: structuredClone(records),
    recorded_ruling: structuredClone(CANONICAL_RECORDED_RULING),
    approval_time: approvalTime,
    ben_key_lifecycle: {
      key_id: BEN_APPROVER_KEY_ID,
      valid_until: benKey.valid_until,
      rotation_condition: BEN_KEY_ROTATION_CONDITION,
      approval_time_effect: 'CURRENT_BEN_KEY_MUST_BE_ACTIVE_AT_APPROVAL_TIME',
    },
    identity_grants: presentationForRoles(IDENTITY_ROLES),
    v1_capture_replay_grants: presentationForRoles(V1_CONTROL_ROLES),
    combined_packet_condition: 'COMBINED_PACKET_VALID_ONLY_WHEN_IDENTITY_AND_V1_GRANTS_ARE_BOTH_ENUMERATED',
  };
  return Object.freeze({ ...body, literal_patch_proposal_id: contentId(LITERAL_PATCH_SCHEMA, body) });
}

function buildLiteralTrustedKeyRegistryPatchProposal(input = {}) {
  return validateLiteralTrustedKeyRegistryPatchProposal(compileLiteralTrustedKeyRegistryPatchProposal(input));
}

function validateLiteralTrustedKeyRegistryPatchProposal(value) {
  exactKeys(value, [
    'after_registry', 'approval_time', 'authority', 'base_trusted_key_registry_digest', 'before_registry', 'ben_key_lifecycle',
    'combined_packet_condition', 'identity_grants', 'issuance_authority', 'literal_patch_proposal_id', 'new_key_records',
    'recorded_ruling', 'registry_activation_authority', 'schema_version', 'signing_authority', 'state',
    'successor_trusted_key_registry_digest', 'v1_capture_replay_grants',
  ], 'Literal trusted-key registry patch proposal');
  if (value.schema_version !== LITERAL_PATCH_SCHEMA || value.state !== 'PROPOSAL_ONLY_LITERAL_PATCH_PENDING_EXACT_APPROVAL'
    || value.authority !== 'NONE' || value.issuance_authority !== 'NONE' || value.registry_activation_authority !== 'NONE' || value.signing_authority !== 'NONE') {
    fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Literal patch must remain non-authorising.');
  }
  const expected = compileLiteralTrustedKeyRegistryPatchProposal({
    approval_time: value.approval_time,
    new_key_records: value.new_key_records,
  });
  if (!same(value, expected)) fail('IDENTITY_LITERAL_KEY_PATCH_INVALID', 'Literal patch is stale, incomplete or over-broad.');
  return expected;
}

function buildDealIdentityTrustedKeyRegistryPatchProposal({
  base_trusted_key_registry_digest: baseDigest,
  pending_ben_ruling_id: pendingBenRulingId,
  existing_key_id: existingKeyId = BEN_APPROVER_KEY_ID,
} = {}) {
  if (typeof baseDigest !== 'string' || !DIGEST_RE.test(baseDigest)
    || typeof pendingBenRulingId !== 'string' || !DIGEST_RE.test(pendingBenRulingId)
    || existingKeyId !== BEN_APPROVER_KEY_ID) {
    fail('IDENTITY_TRUSTED_KEY_PATCH_INVALID', 'Trusted-key proposal requires the exact base registry, pending Ben ruling, and existing Ben approver key.');
  }
  return buildFrozenKeyRegistryAmendmentProposal({
    base_key_registry_root_id: baseDigest,
    pending_ben_ruling_id: pendingBenRulingId,
  });
}

module.exports = {
  BEN_KEY_ROTATION_CONDITION,
  CANONICAL_RECORDED_RULING,
  CANONICAL_RECORDED_RULING_ID,
  IDENTITY_ROLES,
  LITERAL_PATCH_SCHEMA,
  PROPOSAL_SCHEMA,
  TRUSTED_PUBLIC_KEY_REGISTRY_DOMAIN,
  V1_CONTROL_ROLES,
  DealIdentityTrustedKeyRegistryProposalError,
  buildLiteralTrustedKeyRegistryPatchProposal,
  buildDealIdentityTrustedKeyRegistryPatchProposal,
  validateLiteralTrustedKeyRegistryPatchProposal,
};
