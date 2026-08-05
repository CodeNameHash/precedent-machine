'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { verifySignature } = require('../programme-gates/signatures');
const { TRUSTED_PUBLIC_KEY_REGISTRY } = require('../programme-gates/registry');

const DEAL_IDENTITY_SCHEMA = 'GOVERNED_DEAL_IDENTITY/V2';
const MANIFEST_SCHEMA = 'GOVERNED_DEAL_IDENTITY_MANIFEST_PROPOSAL/V2';
const APPROVAL_SIGNING_REQUEST_SCHEMA = 'DEAL_IDENTITY_APPROVAL_SIGNING_REQUEST/V2';
const APPROVAL_ATTESTATION_SCHEMA = 'DEAL_IDENTITY_APPROVAL_ATTESTATION/V2';
const APPROVAL_SIGNATURE_EVIDENCE_SCHEMA = 'DEAL_IDENTITY_APPROVAL_SIGNATURE_EVIDENCE/V2';
const EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA = 'REGISTERED_EXTERNAL_TRANSACTION_AUTHORITY/V2';
const EXTERNAL_ISSUER_REGISTRY_SCHEMA = 'REGISTERED_EXTERNAL_TRANSACTION_ISSUER_REGISTRY/V2';
const EXTERNAL_ISSUER_REGISTRATION_SCHEMA = 'REGISTERED_EXTERNAL_TRANSACTION_ISSUER_REGISTRATION/V2';
const SLOT_SCHEMA = 'DEAL_IDENTITY_SEED_SLOT/V2';
const NONCE_REGISTRY_SCHEMA = 'DEAL_IDENTITY_APPROVAL_NONCE_REGISTRY/V2';
const CAS_TRANSITION_SCHEMA = 'DEAL_IDENTITY_SEED_SLOT_CAS_PREVIEW/V2';
const INITIAL_IMPORT_PACKET_SCHEMA = 'GOVERNED_DEAL_IDENTITY_INITIAL_IMPORT_PROPOSAL/V2';
const APPROVAL_SIGNATURE_DOMAIN = 'DEAL_IDENTITY_APPROVAL_ATTESTATION/V1';
const BEN_APPROVING_IDENTITY = 'BEN_GOODCHILD';
const BEN_APPROVER_KEY_ID = 'PROGRAMME_GATE_BEN_APPROVER_2026_07';
const INITIAL_IMPORT_NAMESPACE = 'BEN_APPROVED_IMPORT/V2';
const INITIAL_IMPORT_SEED_SCHEMA_VERSION = 'BEN_APPROVED_IMPORT_SEED/V2';
const INITIAL_IMPORT_COUNT = 40;
const SEED_KINDS = Object.freeze(['BEN_APPROVED_IMPORT_IDENTITY', 'REGISTERED_EXTERNAL_TRANSACTION']);
const DIGEST_RE = /^[a-f0-9]{64}$/;
const FORBIDDEN_SEED_KEYS = Object.freeze([
  'buyer', 'buyer_display', 'acquirer', 'seller', 'target', 'title', 'value',
  'signing_date', 'date', 'alias', 'aliases', 'environment_uuid', 'uuid',
  'source_occurrence_id', 'source_url', 'source_locator', 'production_deal_id',
]);

class GovernedIdentityProposalPacketError extends Error {
  constructor(code, message) { super(message); this.name = 'GovernedIdentityProposalPacketError'; this.code = code; }
}

function fail(code, message) { throw new GovernedIdentityProposalPacketError(code, message); }

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function text(value, label, maximum = 512) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()
    || /[\u0000-\u001f\u007f]/.test(value) || Buffer.byteLength(value, 'utf8') > maximum) {
    fail('IDENTITY_SEED_INVALID', `${label} must be trimmed non-empty text.`);
  }
  return value;
}

function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    fail('IDENTITY_SIGNATURE_TIME_INVALID', `${label} must be an ISO timestamp.`);
  }
  return value;
}

function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) fail('IDENTITY_DIGEST_INVALID', `${label} must be a SHA-256 content ID.`);
  return value;
}

function sortedUniqueDigests(values, label) {
  if (!Array.isArray(values)) fail('IDENTITY_SUPERSESSION_INVALID', `${label} must be an array.`);
  const output = values.map((value, index) => digest(value, `${label}[${index}]`)).sort();
  if (new Set(output).size !== output.length) fail('IDENTITY_SUPERSESSION_CONFLICT', `${label} cannot repeat an identity.`);
  return Object.freeze(output);
}

function sameDigests(left, right) { return canonicalJson(left) === canonicalJson(right); }
function seedDigest(seed) { return contentId('GOVERNED_DEAL_IDENTITY_SEED/V2', seed); }

function assertContractCompatibleIdentitySeed(seed) {
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) fail('IDENTITY_SEED_INVALID', 'identity seed must be an object.');
  if (FORBIDDEN_SEED_KEYS.some((key) => Object.hasOwn(seed, key))) {
    fail('IDENTITY_PARTY_DATE_ALIAS_SEED_FORBIDDEN', 'identity seed cannot use party, title, value, date, alias, UUID, production identifier, or source-derived fields.');
  }
  if (!SEED_KINDS.includes(seed.kind)) fail('IDENTITY_SEED_KIND_INVALID', 'identity seed kind is not governed.');
  if (seed.kind === 'BEN_APPROVED_IMPORT_IDENTITY') {
    const keys = ['kind', 'governed_source_namespace', 'immutable_submitted_transaction_identifier', 'seed_schema_version'];
    if (!exactKeys(seed, keys)) fail('IDENTITY_SEED_CONTRACT_INCOMPLETE', 'Ben-approved seed fields do not match the closed contract.');
    return Object.freeze({
      kind: seed.kind,
      governed_source_namespace: text(seed.governed_source_namespace, 'governed_source_namespace', 160),
      immutable_submitted_transaction_identifier: text(seed.immutable_submitted_transaction_identifier, 'immutable_submitted_transaction_identifier', 512),
      seed_schema_version: text(seed.seed_schema_version, 'seed_schema_version', 160),
    });
  }
  const keys = ['kind', 'issuer_namespace_key', 'issuer_namespace_version', 'issuer_immutable_transaction_identifier'];
  if (!exactKeys(seed, keys)) fail('IDENTITY_EXTERNAL_TRANSACTION_CONTRACT_INCOMPLETE', 'registered external transaction seed fields do not match the closed contract.');
  return Object.freeze({
    kind: seed.kind,
    issuer_namespace_key: text(seed.issuer_namespace_key, 'issuer_namespace_key', 160),
    issuer_namespace_version: text(seed.issuer_namespace_version, 'issuer_namespace_version', 160),
    issuer_immutable_transaction_identifier: text(seed.issuer_immutable_transaction_identifier, 'issuer_immutable_transaction_identifier', 512),
  });
}

function issuerRegistrationBody(entry) {
  return {
    schema_version: EXTERNAL_ISSUER_REGISTRATION_SCHEMA,
    issuer_namespace_key: entry.issuer_namespace_key,
    issuer_namespace_version: entry.issuer_namespace_version,
  };
}

function buildFrozenExternalIssuerRegistry({ issuer_registry_version, issuers } = {}) {
  const version = text(issuer_registry_version, 'issuer_registry_version', 160);
  if (!Array.isArray(issuers) || issuers.length === 0) fail('IDENTITY_EXTERNAL_ISSUER_REGISTRY_INVALID', 'a frozen issuer registry needs one or more entries.');
  const records = issuers.map((entry, index) => {
    if (!exactKeys(entry, ['issuer_namespace_key', 'issuer_namespace_version'])) {
      fail('IDENTITY_EXTERNAL_ISSUER_REGISTRY_INVALID', `issuer registry entry ${index} has an open shape.`);
    }
    const body = {
      issuer_namespace_key: text(entry.issuer_namespace_key, `issuers[${index}].issuer_namespace_key`, 160),
      issuer_namespace_version: text(entry.issuer_namespace_version, `issuers[${index}].issuer_namespace_version`, 160),
    };
    const registrationBody = issuerRegistrationBody(body);
    return Object.freeze({
      ...body,
      issuer_registration_id: contentId(EXTERNAL_ISSUER_REGISTRATION_SCHEMA, registrationBody),
      issuer_registration_payload_digest: contentId('REGISTERED_EXTERNAL_TRANSACTION_ISSUER_REGISTRATION_PAYLOAD/V2', registrationBody),
    });
  }).sort((left, right) => `${left.issuer_namespace_key}\0${left.issuer_namespace_version}`.localeCompare(`${right.issuer_namespace_key}\0${right.issuer_namespace_version}`));
  if (new Set(records.map((entry) => `${entry.issuer_namespace_key}\0${entry.issuer_namespace_version}`)).size !== records.length) {
    fail('IDENTITY_EXTERNAL_ISSUER_REGISTRY_CONFLICT', 'a frozen issuer registry cannot repeat an issuer namespace.');
  }
  const body = {
    schema_version: EXTERNAL_ISSUER_REGISTRY_SCHEMA,
    registry_state: 'FROZEN',
    issuer_registry_version: version,
    issuers: Object.freeze(records),
  };
  return Object.freeze({ ...body, external_issuer_registry_id: contentId(EXTERNAL_ISSUER_REGISTRY_SCHEMA, body) });
}

function validateFrozenExternalIssuerRegistry(registry) {
  const keys = ['schema_version', 'registry_state', 'issuer_registry_version', 'issuers', 'external_issuer_registry_id'];
  if (!exactKeys(registry, keys) || registry.schema_version !== EXTERNAL_ISSUER_REGISTRY_SCHEMA || registry.registry_state !== 'FROZEN') {
    fail('IDENTITY_EXTERNAL_ISSUER_REGISTRY_INVALID', 'external issuer registry must be an exact frozen registry.');
  }
  const rebuilt = buildFrozenExternalIssuerRegistry({
    issuer_registry_version: registry.issuer_registry_version,
    issuers: (registry.issuers || []).map((entry) => ({
      issuer_namespace_key: entry.issuer_namespace_key,
      issuer_namespace_version: entry.issuer_namespace_version,
    })),
  });
  if (canonicalJson(rebuilt) !== canonicalJson(registry)) fail('IDENTITY_EXTERNAL_ISSUER_REGISTRY_STALE', 'external issuer registry content identity does not match its frozen content.');
  return rebuilt;
}

function validateRegisteredExternalTransactionAuthority(authority, seed, registry) {
  const keys = [
    'schema_version', 'external_issuer_registry_id', 'issuer_namespace_key', 'issuer_namespace_version',
    'issuer_registration_id', 'issuer_registration_payload_digest',
    'registered_external_transaction_authority_id', 'registered_external_transaction_authority_payload_digest',
  ];
  const issuerRegistry = validateFrozenExternalIssuerRegistry(registry);
  if (!exactKeys(authority, keys) || authority.schema_version !== EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA
    || authority.external_issuer_registry_id !== issuerRegistry.external_issuer_registry_id
    || authority.issuer_namespace_key !== seed.issuer_namespace_key
    || authority.issuer_namespace_version !== seed.issuer_namespace_version) {
    fail('IDENTITY_EXTERNAL_TRANSACTION_AUTHORITY_INVALID', 'external transaction needs an exact proof from the frozen issuer registry.');
  }
  const issuer = issuerRegistry.issuers.find((entry) => (
    entry.issuer_namespace_key === seed.issuer_namespace_key && entry.issuer_namespace_version === seed.issuer_namespace_version
  ));
  if (!issuer || authority.issuer_registration_id !== issuer.issuer_registration_id
    || authority.issuer_registration_payload_digest !== issuer.issuer_registration_payload_digest) {
    fail('IDENTITY_EXTERNAL_TRANSACTION_AUTHORITY_INVALID', 'external issuer proof does not match the frozen registry entry.');
  }
  const body = {
    schema_version: authority.schema_version,
    external_issuer_registry_id: authority.external_issuer_registry_id,
    issuer_namespace_key: authority.issuer_namespace_key,
    issuer_namespace_version: authority.issuer_namespace_version,
    issuer_registration_id: authority.issuer_registration_id,
    issuer_registration_payload_digest: authority.issuer_registration_payload_digest,
  };
  if (digest(authority.registered_external_transaction_authority_id, 'registered_external_transaction_authority_id') !== contentId(EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA, body)
    || digest(authority.registered_external_transaction_authority_payload_digest, 'registered_external_transaction_authority_payload_digest')
      !== contentId('REGISTERED_EXTERNAL_TRANSACTION_AUTHORITY_PAYLOAD/V2', body)) {
    fail('IDENTITY_EXTERNAL_TRANSACTION_AUTHORITY_INVALID', 'external issuer authority identity does not match its frozen proof.');
  }
  return Object.freeze({ ...authority });
}

function governedDealKey(seed) {
  return contentId('GOVERNED_DEAL_KEY/V2', { deal_identity_schema_version: DEAL_IDENTITY_SCHEMA, immutable_deal_seed: seed });
}

function buildUnsignedDealIdentityApprovalSigningRequest({
  immutable_deal_seed: immutableDealSeed,
  approving_identity: approvingIdentity = BEN_APPROVING_IDENTITY,
  approval_nonce: approvalNonce,
  reviewed_supersession_reference_ids: reviewedSupersessionReferenceIds = [],
  approval_scope: approvalScope = null,
} = {}) {
  const seed = assertContractCompatibleIdentitySeed(immutableDealSeed);
  if (seed.kind !== 'BEN_APPROVED_IMPORT_IDENTITY') fail('IDENTITY_APPROVAL_SEED_KIND_INVALID', 'only Ben-approved import seeds can request approval.');
  if (approvingIdentity !== BEN_APPROVING_IDENTITY) fail('IDENTITY_APPROVING_IDENTITY_INVALID', 'approval signing request must name the closed Ben approving identity.');
  const nonce = digest(approvalNonce, 'approval_nonce');
  const supersessions = sortedUniqueDigests(reviewedSupersessionReferenceIds, 'reviewed_supersession_reference_ids');
  const scope = supersessions.length === 0 ? 'GENESIS_ONLY' : 'AUTHORITY_SUCCESSOR_ONLY';
  if (approvalScope !== null && approvalScope !== scope) fail('IDENTITY_APPROVAL_SCOPE_INVALID', 'approval scope must be derived from the exact supersession set.');
  const payload = Object.freeze({
    schema_version: APPROVAL_ATTESTATION_SCHEMA,
    immutable_deal_seed: seed,
    approving_identity: BEN_APPROVING_IDENTITY,
    approval_scope: scope,
    approval_nonce: nonce,
    reviewed_supersession_reference_ids: supersessions,
    terminal_decision: 'APPROVED',
  });
  const body = {
    schema_version: APPROVAL_SIGNING_REQUEST_SCHEMA,
    status: 'UNSIGNED_SIGNING_REQUEST_NOT_AUTHORITY',
    approval_attestation_payload: payload,
    deal_identity_approval_attestation_id: contentId(APPROVAL_ATTESTATION_SCHEMA, payload),
    deal_identity_approval_attestation_payload_digest: contentId('DEAL_IDENTITY_APPROVAL_ATTESTATION_PAYLOAD/V2', payload),
    signature_domain: APPROVAL_SIGNATURE_DOMAIN,
    signature: null,
  };
  return Object.freeze({ ...body, signing_request_id: contentId(APPROVAL_SIGNING_REQUEST_SCHEMA, body) });
}

function validateUnsignedDealIdentityApprovalSigningRequest(request) {
  const keys = [
    'schema_version', 'status', 'approval_attestation_payload', 'deal_identity_approval_attestation_id',
    'deal_identity_approval_attestation_payload_digest', 'signature_domain', 'signature', 'signing_request_id',
  ];
  if (!exactKeys(request, keys) || request.schema_version !== APPROVAL_SIGNING_REQUEST_SCHEMA
    || request.status !== 'UNSIGNED_SIGNING_REQUEST_NOT_AUTHORITY'
    || request.signature_domain !== APPROVAL_SIGNATURE_DOMAIN || request.signature !== null) {
    fail('IDENTITY_APPROVAL_SIGNING_REQUEST_INVALID', 'identity approval signing request must remain unsigned and non-authorising.');
  }
  const payload = request.approval_attestation_payload;
  if (!exactKeys(payload, ['schema_version', 'immutable_deal_seed', 'approving_identity', 'approval_scope', 'approval_nonce', 'reviewed_supersession_reference_ids', 'terminal_decision'])
    || payload.schema_version !== APPROVAL_ATTESTATION_SCHEMA
    || payload.approving_identity !== BEN_APPROVING_IDENTITY
    || !['GENESIS_ONLY', 'AUTHORITY_SUCCESSOR_ONLY'].includes(payload.approval_scope)
    || payload.terminal_decision !== 'APPROVED') {
    fail('IDENTITY_APPROVAL_SIGNING_REQUEST_INVALID', 'identity approval payload must be a terminal Ben approval.');
  }
  const seed = assertContractCompatibleIdentitySeed(payload.immutable_deal_seed);
  if (seed.kind !== 'BEN_APPROVED_IMPORT_IDENTITY') fail('IDENTITY_APPROVAL_SIGNING_REQUEST_INVALID', 'approval payload must bind a Ben-approved import seed.');
  const nonce = digest(payload.approval_nonce, 'approval_nonce');
  const supersessions = sortedUniqueDigests(payload.reviewed_supersession_reference_ids, 'reviewed_supersession_reference_ids');
  const rebuilt = buildUnsignedDealIdentityApprovalSigningRequest({
    immutable_deal_seed: seed,
    approval_nonce: nonce,
    reviewed_supersession_reference_ids: supersessions,
    approval_scope: payload.approval_scope,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(request)) fail('IDENTITY_APPROVAL_SIGNING_REQUEST_STALE', 'identity approval signing request does not match its immutable payload.');
  return rebuilt;
}

function buildGovernedIdentityProposalPacket({
  immutable_deal_seed: immutableDealSeed,
  deal_identity_approval_attestation_id: approvalAttestationId = null,
  deal_identity_approval_attestation_payload_digest: approvalPayloadDigest = null,
  registered_external_transaction_authority: externalAuthority = null,
  frozen_external_issuer_registry: frozenExternalIssuerRegistry = null,
  reviewed_supersession_reference_ids: reviewedSupersessionReferenceIds = [],
} = {}) {
  const seed = assertContractCompatibleIdentitySeed(immutableDealSeed);
  const supersessions = sortedUniqueDigests(reviewedSupersessionReferenceIds, 'reviewed_supersession_reference_ids');
  let approvalId = null;
  let approvalDigest = null;
  let external = null;
  let issuerRegistry = null;
  if (seed.kind === 'BEN_APPROVED_IMPORT_IDENTITY') {
    approvalId = digest(approvalAttestationId, 'deal_identity_approval_attestation_id');
    approvalDigest = digest(approvalPayloadDigest, 'deal_identity_approval_attestation_payload_digest');
    if (externalAuthority !== null || frozenExternalIssuerRegistry !== null) fail('IDENTITY_MANIFEST_BRANCH_CONFLICT', 'Ben-approved identity cannot carry external issuer authority.');
  } else {
    if (approvalAttestationId !== null || approvalPayloadDigest !== null) fail('IDENTITY_MANIFEST_BRANCH_CONFLICT', 'external transaction cannot carry Ben approval fields.');
    issuerRegistry = validateFrozenExternalIssuerRegistry(frozenExternalIssuerRegistry);
    external = validateRegisteredExternalTransactionAuthority(externalAuthority, seed, issuerRegistry);
  }
  const body = {
    schema_version: MANIFEST_SCHEMA,
    status: 'PROPOSED_NOT_AUTHORITY',
    deal_identity_schema_version: DEAL_IDENTITY_SCHEMA,
    immutable_deal_seed: seed,
    proposed_import_seed_digest: seed.kind === 'BEN_APPROVED_IMPORT_IDENTITY' ? seedDigest(seed) : null,
    governed_deal_key: governedDealKey(seed),
    deal_identity_approval_attestation_id: approvalId,
    deal_identity_approval_attestation_payload_digest: approvalDigest,
    registered_external_transaction_authority: external,
    frozen_external_issuer_registry: issuerRegistry,
    reviewed_supersession_reference_ids: supersessions,
    authority_status: 'NOT_ISSUED_OR_SIGNED',
  };
  return Object.freeze({ ...body, deal_identity_manifest_id: contentId(MANIFEST_SCHEMA, body) });
}

function validateGovernedIdentityProposalPacket(packet) {
  const keys = [
    'schema_version', 'status', 'deal_identity_schema_version', 'immutable_deal_seed', 'proposed_import_seed_digest',
    'governed_deal_key', 'deal_identity_approval_attestation_id', 'deal_identity_approval_attestation_payload_digest',
    'registered_external_transaction_authority', 'frozen_external_issuer_registry', 'reviewed_supersession_reference_ids',
    'authority_status', 'deal_identity_manifest_id',
  ];
  if (!exactKeys(packet, keys) || packet.schema_version !== MANIFEST_SCHEMA
    || packet.status !== 'PROPOSED_NOT_AUTHORITY' || packet.authority_status !== 'NOT_ISSUED_OR_SIGNED') {
    fail('IDENTITY_MANIFEST_INVALID', 'identity manifest must remain a closed proposal-only object.');
  }
  const rebuilt = buildGovernedIdentityProposalPacket({
    immutable_deal_seed: packet.immutable_deal_seed,
    deal_identity_approval_attestation_id: packet.deal_identity_approval_attestation_id,
    deal_identity_approval_attestation_payload_digest: packet.deal_identity_approval_attestation_payload_digest,
    registered_external_transaction_authority: packet.registered_external_transaction_authority,
    frozen_external_issuer_registry: packet.frozen_external_issuer_registry,
    reviewed_supersession_reference_ids: packet.reviewed_supersession_reference_ids,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(packet)) fail('IDENTITY_MANIFEST_STALE', 'identity manifest does not match its closed seed and authority references.');
  return rebuilt;
}

function slotIdentity(seed) {
  if (seed.kind === 'BEN_APPROVED_IMPORT_IDENTITY') {
    return Object.freeze({ deal_identity_schema_version: DEAL_IDENTITY_SCHEMA, branch: seed.kind, proposed_import_seed_digest: seedDigest(seed) });
  }
  return Object.freeze({
    deal_identity_schema_version: DEAL_IDENTITY_SCHEMA,
    branch: seed.kind,
    issuer_namespace_key: seed.issuer_namespace_key,
    issuer_namespace_version: seed.issuer_namespace_version,
    issuer_immutable_transaction_identifier: seed.issuer_immutable_transaction_identifier,
  });
}

function buildDealIdentitySeedSlot({ immutable_deal_seed: immutableDealSeed } = {}) {
  const seed = assertContractCompatibleIdentitySeed(immutableDealSeed);
  const body = {
    schema_version: SLOT_SCHEMA,
    slot_identity: slotIdentity(seed),
    slot_version: 0,
    state: 'EMPTY',
    governed_deal_key: null,
    current_manifest_id: null,
    approval_attestation_ids: Object.freeze([]),
    approval_nonces: Object.freeze([]),
    reviewed_supersession_reference_ids: Object.freeze([]),
  };
  return Object.freeze({ ...body, seed_slot_id: contentId(SLOT_SCHEMA, body) });
}

function validateDealIdentitySeedSlot(slot) {
  const keys = [
    'schema_version', 'slot_identity', 'slot_version', 'state', 'governed_deal_key', 'current_manifest_id',
    'approval_attestation_ids', 'approval_nonces', 'reviewed_supersession_reference_ids', 'seed_slot_id',
  ];
  if (!exactKeys(slot, keys) || slot.schema_version !== SLOT_SCHEMA
    || !Number.isSafeInteger(slot.slot_version) || slot.slot_version < 0
    || !['EMPTY', 'PROPOSED_ALLOCATED'].includes(slot.state)
    || !Array.isArray(slot.approval_attestation_ids) || !Array.isArray(slot.approval_nonces)
    || !Array.isArray(slot.reviewed_supersession_reference_ids)) {
    fail('IDENTITY_SEED_SLOT_INVALID', 'identity seed slot has an invalid closed state.');
  }
  if (slot.state === 'EMPTY' && (slot.governed_deal_key !== null || slot.current_manifest_id !== null
    || slot.approval_attestation_ids.length !== 0 || slot.approval_nonces.length !== 0 || slot.reviewed_supersession_reference_ids.length !== 0)) {
    fail('IDENTITY_SEED_SLOT_INVALID', 'empty seed slot cannot carry allocation state.');
  }
  if (slot.state === 'PROPOSED_ALLOCATED' && (!digest(slot.governed_deal_key, 'governed_deal_key')
    || !digest(slot.current_manifest_id, 'current_manifest_id'))) fail('IDENTITY_SEED_SLOT_INVALID', 'allocated slot requires one governed key and manifest.');
  const normalizedAttestations = sortedUniqueDigests(slot.approval_attestation_ids, 'approval_attestation_ids');
  const normalizedNonces = sortedUniqueDigests(slot.approval_nonces, 'approval_nonces');
  const normalizedSupersessions = sortedUniqueDigests(slot.reviewed_supersession_reference_ids, 'reviewed_supersession_reference_ids');
  const body = {
    schema_version: SLOT_SCHEMA, slot_identity: slot.slot_identity, slot_version: slot.slot_version, state: slot.state,
    governed_deal_key: slot.governed_deal_key, current_manifest_id: slot.current_manifest_id,
    approval_attestation_ids: normalizedAttestations, approval_nonces: normalizedNonces,
    reviewed_supersession_reference_ids: normalizedSupersessions,
  };
  if (slot.seed_slot_id !== contentId(SLOT_SCHEMA, body)) fail('IDENTITY_SEED_SLOT_STALE', 'identity seed slot does not match its content identity.');
  return Object.freeze({ ...body, seed_slot_id: slot.seed_slot_id });
}

function buildDealIdentityApprovalNonceRegistry() {
  const body = {
    schema_version: NONCE_REGISTRY_SCHEMA,
    registry_state: 'PREVIEW_ONLY_NOT_PERSISTED',
    registry_version: 0,
    entries: Object.freeze([]),
  };
  return Object.freeze({ ...body, nonce_registry_id: contentId(NONCE_REGISTRY_SCHEMA, body) });
}

function validateDealIdentityApprovalNonceRegistry(registry) {
  const keys = ['schema_version', 'registry_state', 'registry_version', 'entries', 'nonce_registry_id'];
  if (!exactKeys(registry, keys) || registry.schema_version !== NONCE_REGISTRY_SCHEMA
    || registry.registry_state !== 'PREVIEW_ONLY_NOT_PERSISTED'
    || !Number.isSafeInteger(registry.registry_version) || registry.registry_version < 0
    || !Array.isArray(registry.entries)) {
    fail('IDENTITY_NONCE_REGISTRY_INVALID', 'nonce registry has an invalid closed preview state.');
  }
  const entries = registry.entries.map((entry, index) => {
    if (!exactKeys(entry, ['approval_attestation_id', 'approval_nonce', 'slot_identity'])) {
      fail('IDENTITY_NONCE_REGISTRY_INVALID', `nonce entry ${index} has an open shape.`);
    }
    return Object.freeze({
      approval_attestation_id: digest(entry.approval_attestation_id, `entries[${index}].approval_attestation_id`),
      approval_nonce: digest(entry.approval_nonce, `entries[${index}].approval_nonce`),
      slot_identity: entry.slot_identity,
    });
  }).sort((left, right) => left.approval_nonce.localeCompare(right.approval_nonce));
  if (new Set(entries.map((entry) => entry.approval_nonce)).size !== entries.length
    || new Set(entries.map((entry) => entry.approval_attestation_id)).size !== entries.length) {
    fail('IDENTITY_NONCE_REGISTRY_CONFLICT', 'nonce registry cannot repeat a nonce or attestation.');
  }
  const body = {
    schema_version: NONCE_REGISTRY_SCHEMA,
    registry_state: 'PREVIEW_ONLY_NOT_PERSISTED',
    registry_version: registry.registry_version,
    entries: Object.freeze(entries),
  };
  if (registry.nonce_registry_id !== contentId(NONCE_REGISTRY_SCHEMA, body)) fail('IDENTITY_NONCE_REGISTRY_STALE', 'nonce registry content identity is stale.');
  return Object.freeze({ ...body, nonce_registry_id: registry.nonce_registry_id });
}

function validateApprovalSignatureEvidence(evidence, request, keyRegistry) {
  const keys = ['schema_version', 'key_id', 'signed_at', 'signature'];
  if (!exactKeys(evidence, keys) || evidence.schema_version !== APPROVAL_SIGNATURE_EVIDENCE_SCHEMA
    || evidence.key_id !== BEN_APPROVER_KEY_ID || typeof evidence.signature !== 'string' || !evidence.signature) {
    fail('IDENTITY_APPROVAL_UNSIGNED_OR_UNVERIFIED', 'approval requires exact Ben signature evidence, not a caller verification marker.');
  }
  const signedAt = timestamp(evidence.signed_at, 'signed_at');
  try {
    verifySignature({
      keyRegistry,
      keyId: BEN_APPROVER_KEY_ID,
      role: 'BEN_APPROVER',
      domain: APPROVAL_SIGNATURE_DOMAIN,
      payload: request.approval_attestation_payload,
      signature: evidence.signature,
      at: signedAt,
    });
  } catch (error) {
    fail('IDENTITY_APPROVAL_SIGNATURE_INVALID', `approval signature did not verify against the active trusted-key registry: ${error.message}`);
  }
  return Object.freeze({ ...evidence, signed_at: signedAt });
}

function rejectCallerControlledTrustedKeyRegistry(input) {
  if (input && typeof input === 'object' && Object.hasOwn(input, 'trusted_key_registry')) {
    fail(
      'IDENTITY_CALLER_TRUST_REGISTRY_FORBIDDEN',
      'Identity authority validation uses only the pinned governing trusted-key registry.',
    );
  }
}

function validateV2DealIdentityAuthorityEvidence(input = {}) {
  rejectCallerControlledTrustedKeyRegistry(input);
  const {
    deal_identity_manifest: dealIdentityManifest,
    approval_signing_request: approvalSigningRequest = null,
    approval_signature_evidence: approvalSignatureEvidence = null,
  } = input;
  const manifest = validateGovernedIdentityProposalPacket(dealIdentityManifest);
  if (manifest.immutable_deal_seed.kind === 'REGISTERED_EXTERNAL_TRANSACTION') {
    if (approvalSigningRequest !== null || approvalSignatureEvidence !== null) {
      fail('IDENTITY_EXTERNAL_TRANSACTION_APPROVAL_FORBIDDEN', 'external issuer identity cannot carry a Ben approval attestation.');
    }
    return Object.freeze({
      governed_deal_key: manifest.governed_deal_key,
      deal_identity_manifest_id: manifest.deal_identity_manifest_id,
      authority_kind: 'FROZEN_EXTERNAL_ISSUER_REGISTRY_PROOF',
      authority_status: 'VALIDATED_PROPOSAL_ONLY_NOT_ADMISSION_AUTHORITY',
    });
  }
  const request = validateUnsignedDealIdentityApprovalSigningRequest(approvalSigningRequest);
  if (canonicalJson(request.approval_attestation_payload.immutable_deal_seed) !== canonicalJson(manifest.immutable_deal_seed)
    || request.deal_identity_approval_attestation_id !== manifest.deal_identity_approval_attestation_id
    || request.deal_identity_approval_attestation_payload_digest !== manifest.deal_identity_approval_attestation_payload_digest
    || !sameDigests(request.approval_attestation_payload.reviewed_supersession_reference_ids, manifest.reviewed_supersession_reference_ids)) {
    fail('IDENTITY_APPROVAL_SEED_OR_MANIFEST_MISMATCH', 'approval evidence must bind the exact V2 identity manifest and supersession set.');
  }
  validateApprovalSignatureEvidence(
    approvalSignatureEvidence,
    request,
    TRUSTED_PUBLIC_KEY_REGISTRY,
  );
  return Object.freeze({
    governed_deal_key: manifest.governed_deal_key,
    deal_identity_manifest_id: manifest.deal_identity_manifest_id,
    authority_kind: 'VERIFIED_BEN_ATTESTATION_PROPOSAL',
    authority_status: 'VALIDATED_PROPOSAL_ONLY_NOT_ADMISSION_AUTHORITY',
  });
}

function nextNonceRegistry(registry, request, slot) {
  const nonce = request.approval_attestation_payload.approval_nonce;
  const attestationId = request.deal_identity_approval_attestation_id;
  if (registry.entries.some((entry) => entry.approval_nonce === nonce || entry.approval_attestation_id === attestationId)) {
    fail('IDENTITY_APPROVAL_REPLAY', 'approval nonce and attestation are globally single-use across all seed slots.');
  }
  const entries = [...registry.entries, Object.freeze({
    approval_attestation_id: attestationId,
    approval_nonce: nonce,
    slot_identity: slot.slot_identity,
  })].sort((left, right) => left.approval_nonce.localeCompare(right.approval_nonce));
  const body = {
    schema_version: NONCE_REGISTRY_SCHEMA,
    registry_state: 'PREVIEW_ONLY_NOT_PERSISTED',
    registry_version: registry.registry_version + 1,
    entries: Object.freeze(entries),
  };
  return Object.freeze({ ...body, nonce_registry_id: contentId(NONCE_REGISTRY_SCHEMA, body) });
}

function compareAndSwapDealIdentitySeedSlot(input = {}) {
  rejectCallerControlledTrustedKeyRegistry(input);
  const {
    current_slot: currentSlot,
    expected_slot_version: expectedSlotVersion,
    proposal_manifest: proposalManifest,
    approval_signing_request: approvalSigningRequest = null,
    approval_signature_evidence: approvalSignatureEvidence = null,
    current_nonce_registry: currentNonceRegistry = null,
    expected_nonce_registry_version: expectedNonceRegistryVersion = null,
  } = input;
  const slot = validateDealIdentitySeedSlot(currentSlot);
  const manifest = validateGovernedIdentityProposalPacket(proposalManifest);
  if (!Number.isSafeInteger(expectedSlotVersion) || expectedSlotVersion !== slot.slot_version) {
    fail('IDENTITY_SEED_SLOT_CAS_CONFLICT', 'identity seed-slot compare-and-swap expected version is stale.');
  }
  const seed = manifest.immutable_deal_seed;
  if (canonicalJson(slot.slot_identity) !== canonicalJson(slotIdentity(seed))) fail('IDENTITY_SEED_SLOT_KEY_CONFLICT', 'manifest seed does not match the closed slot identity.');
  let approvalIds = [...slot.approval_attestation_ids];
  let approvalNonces = [...slot.approval_nonces];
  let supersessions = [...slot.reviewed_supersession_reference_ids];
  let successorNonceRegistry = null;
  if (seed.kind === 'BEN_APPROVED_IMPORT_IDENTITY') {
    const request = validateUnsignedDealIdentityApprovalSigningRequest(approvalSigningRequest);
    if (canonicalJson(request.approval_attestation_payload.immutable_deal_seed) !== canonicalJson(seed)
      || request.deal_identity_approval_attestation_id !== manifest.deal_identity_approval_attestation_id
      || request.deal_identity_approval_attestation_payload_digest !== manifest.deal_identity_approval_attestation_payload_digest
      || !sameDigests(request.approval_attestation_payload.reviewed_supersession_reference_ids, manifest.reviewed_supersession_reference_ids)) {
      fail('IDENTITY_APPROVAL_SEED_OR_MANIFEST_MISMATCH', 'approval must bind the exact manifest seed, attestation fields, and supersession set.');
    }
    const isGenesis = slot.state === 'EMPTY';
    if ((isGenesis && (request.approval_attestation_payload.approval_scope !== 'GENESIS_ONLY' || manifest.reviewed_supersession_reference_ids.length !== 0))
      || (!isGenesis && (request.approval_attestation_payload.approval_scope !== 'AUTHORITY_SUCCESSOR_ONLY' || manifest.reviewed_supersession_reference_ids.length === 0))) {
      fail('IDENTITY_APPROVAL_SCOPE_OR_SUPERSESSION_CONFLICT', 'genesis and authority-successor approvals require their exact respective supersession sets.');
    }
    const nonceRegistry = validateDealIdentityApprovalNonceRegistry(currentNonceRegistry);
    if (!Number.isSafeInteger(expectedNonceRegistryVersion) || expectedNonceRegistryVersion !== nonceRegistry.registry_version) {
      fail('IDENTITY_NONCE_REGISTRY_CAS_CONFLICT', 'global nonce-registry compare-and-swap expected version is stale.');
    }
    validateApprovalSignatureEvidence(
      approvalSignatureEvidence,
      request,
      TRUSTED_PUBLIC_KEY_REGISTRY,
    );
    if (approvalIds.includes(request.deal_identity_approval_attestation_id) || approvalNonces.includes(request.approval_attestation_payload.approval_nonce)) {
      fail('IDENTITY_APPROVAL_REPLAY', 'identity approval attestation and nonce are single-use within one seed slot.');
    }
    if (manifest.reviewed_supersession_reference_ids.some((reference) => supersessions.includes(reference))) {
      fail('IDENTITY_SUPERSESSION_REPLAY', 'a reviewed supersession reference cannot be reused in the same seed-slot lineage.');
    }
    approvalIds.push(request.deal_identity_approval_attestation_id);
    approvalNonces.push(request.approval_attestation_payload.approval_nonce);
    supersessions = [...new Set([...supersessions, ...manifest.reviewed_supersession_reference_ids])].sort();
    successorNonceRegistry = nextNonceRegistry(nonceRegistry, request, slot);
  } else if (approvalSigningRequest !== null || approvalSignatureEvidence !== null
    || currentNonceRegistry !== null || expectedNonceRegistryVersion !== null) {
    fail('IDENTITY_EXTERNAL_TRANSACTION_APPROVAL_FORBIDDEN', 'registered external transaction branch does not accept Ben approval or nonce inputs.');
  }
  if (slot.state === 'PROPOSED_ALLOCATED' && slot.governed_deal_key !== manifest.governed_deal_key) {
    fail('IDENTITY_SECOND_LOGICAL_DEAL_FORBIDDEN', 'one seed slot cannot allocate a second governed deal key.');
  }
  const successorBody = {
    schema_version: SLOT_SCHEMA,
    slot_identity: slot.slot_identity,
    slot_version: slot.slot_version + 1,
    state: 'PROPOSED_ALLOCATED',
    governed_deal_key: manifest.governed_deal_key,
    current_manifest_id: manifest.deal_identity_manifest_id,
    approval_attestation_ids: sortedUniqueDigests(approvalIds, 'approval_attestation_ids'),
    approval_nonces: sortedUniqueDigests(approvalNonces, 'approval_nonces'),
    reviewed_supersession_reference_ids: sortedUniqueDigests(supersessions, 'reviewed_supersession_reference_ids'),
  };
  const successor = Object.freeze({ ...successorBody, seed_slot_id: contentId(SLOT_SCHEMA, successorBody) });
  const transitionBody = {
    schema_version: CAS_TRANSITION_SCHEMA,
    status: 'PREVIEW_ONLY_REQUIRES_SERIALISABLE_PERSISTENCE_CONTROLLER',
    current_seed_slot_id: slot.seed_slot_id,
    expected_slot_version: expectedSlotVersion,
    current_nonce_registry_id: successorNonceRegistry === null ? null : currentNonceRegistry.nonce_registry_id,
    expected_nonce_registry_version: successorNonceRegistry === null ? null : expectedNonceRegistryVersion,
    successor_seed_slot: successor,
    successor_nonce_registry: successorNonceRegistry,
    governed_deal_key: manifest.governed_deal_key,
    authority_successor: slot.state === 'PROPOSED_ALLOCATED',
    writer_authority: 'NONE',
    database_authority: 'NONE',
    source_admission_authority: 'NONE',
  };
  return Object.freeze({ ...transitionBody, transition_id: contentId(CAS_TRANSITION_SCHEMA, transitionBody) });
}

function buildInitialImportProposalPacket({ initial_import_source_inventory_digest: sourceInventoryDigest } = {}) {
  const sourceDigest = digest(sourceInventoryDigest, 'initial_import_source_inventory_digest');
  const rows = Array.from({ length: INITIAL_IMPORT_COUNT }, (_, index) => {
    const identifier = `TX-${String(index + 1).padStart(6, '0')}`;
    return Object.freeze({
      initial_import_ordinal: index + 1,
      immutable_deal_seed: Object.freeze({
        kind: 'BEN_APPROVED_IMPORT_IDENTITY',
        governed_source_namespace: INITIAL_IMPORT_NAMESPACE,
        immutable_submitted_transaction_identifier: identifier,
        seed_schema_version: INITIAL_IMPORT_SEED_SCHEMA_VERSION,
      }),
      proposed_import_seed_digest: seedDigest({
        kind: 'BEN_APPROVED_IMPORT_IDENTITY',
        governed_source_namespace: INITIAL_IMPORT_NAMESPACE,
        immutable_submitted_transaction_identifier: identifier,
        seed_schema_version: INITIAL_IMPORT_SEED_SCHEMA_VERSION,
      }),
    });
  });
  const body = {
    schema_version: INITIAL_IMPORT_PACKET_SCHEMA,
    status: 'PENDING_NAMESPACE_AND_KEY_DOMAIN_RATIFICATION',
    initial_import_source_inventory_digest: sourceDigest,
    governed_source_namespace: INITIAL_IMPORT_NAMESPACE,
    expected_transaction_count: INITIAL_IMPORT_COUNT,
    rows: Object.freeze(rows),
    admission_authority: 'NONE',
    source_admission_authority: 'NONE',
    deal_admission_authority: 'NONE',
  };
  return Object.freeze({ ...body, initial_import_proposal_packet_id: contentId(INITIAL_IMPORT_PACKET_SCHEMA, body) });
}

function validateInitialImportProposalPacket(packet) {
  const keys = [
    'schema_version', 'status', 'initial_import_source_inventory_digest', 'governed_source_namespace',
    'expected_transaction_count', 'rows', 'admission_authority', 'source_admission_authority',
    'deal_admission_authority', 'initial_import_proposal_packet_id',
  ];
  if (!exactKeys(packet, keys) || packet.schema_version !== INITIAL_IMPORT_PACKET_SCHEMA
    || packet.status !== 'PENDING_NAMESPACE_AND_KEY_DOMAIN_RATIFICATION' || packet.governed_source_namespace !== INITIAL_IMPORT_NAMESPACE
    || packet.expected_transaction_count !== INITIAL_IMPORT_COUNT || packet.rows.length !== INITIAL_IMPORT_COUNT
    || packet.admission_authority !== 'NONE' || packet.source_admission_authority !== 'NONE' || packet.deal_admission_authority !== 'NONE') {
    fail('IDENTITY_INITIAL_IMPORT_PACKET_INVALID', 'initial-import proposal packet must remain a closed forty-row proposal only.');
  }
  const rebuilt = buildInitialImportProposalPacket({ initial_import_source_inventory_digest: packet.initial_import_source_inventory_digest });
  if (canonicalJson(rebuilt) !== canonicalJson(packet)) fail('IDENTITY_INITIAL_IMPORT_PACKET_STALE', 'initial-import proposal packet does not pin the closed namespace and TX-000001 through TX-000040 sequence.');
  return rebuilt;
}

module.exports = {
  APPROVAL_ATTESTATION_SCHEMA,
  APPROVAL_SIGNATURE_DOMAIN,
  APPROVAL_SIGNATURE_EVIDENCE_SCHEMA,
  APPROVAL_SIGNING_REQUEST_SCHEMA,
  BEN_APPROVER_KEY_ID,
  BEN_APPROVING_IDENTITY,
  CAS_TRANSITION_SCHEMA,
  DEAL_IDENTITY_SCHEMA,
  EXTERNAL_ISSUER_REGISTRY_SCHEMA,
  EXTERNAL_ISSUER_REGISTRATION_SCHEMA,
  EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA,
  INITIAL_IMPORT_COUNT,
  INITIAL_IMPORT_NAMESPACE,
  INITIAL_IMPORT_PACKET_SCHEMA,
  INITIAL_IMPORT_SEED_SCHEMA_VERSION,
  MANIFEST_SCHEMA,
  NONCE_REGISTRY_SCHEMA,
  SLOT_SCHEMA,
  GovernedIdentityProposalPacketError,
  assertContractCompatibleIdentitySeed,
  buildDealIdentityApprovalNonceRegistry,
  buildDealIdentitySeedSlot,
  buildFrozenExternalIssuerRegistry,
  buildGovernedIdentityProposalPacket,
  buildInitialImportProposalPacket,
  buildUnsignedDealIdentityApprovalSigningRequest,
  compareAndSwapDealIdentitySeedSlot,
  governedDealKey,
  seedDigest,
  validateDealIdentityApprovalNonceRegistry,
  validateDealIdentitySeedSlot,
  validateFrozenExternalIssuerRegistry,
  validateGovernedIdentityProposalPacket,
  validateInitialImportProposalPacket,
  validateUnsignedDealIdentityApprovalSigningRequest,
  validateV2DealIdentityAuthorityEvidence,
};
