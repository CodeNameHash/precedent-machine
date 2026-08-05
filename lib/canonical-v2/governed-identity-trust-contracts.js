'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  INITIAL_IMPORT_NAMESPACE,
  INITIAL_IMPORT_SEED_SCHEMA_VERSION,
  INITIAL_IMPORT_TRANSACTION_IDS,
} = require('./governed-identity-proposal-packet');

const FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA = 'GOVERNED_IDENTITY_FROZEN_KEY_REGISTRY_AMENDMENT_PROPOSAL/V1';
const NAMESPACE_APPROVAL_REQUEST_SCHEMA = 'GOVERNED_IDENTITY_RATIFIED_NAMESPACE_POLICY/V2';
const EXTERNAL_NAMESPACE_BINDING_SCHEMA = 'GOVERNED_IDENTITY_RATIFIED_NAMESPACE_BINDING/V2';
const SERIALISABLE_CAS_PROOF_SCHEMA = 'GOVERNED_IDENTITY_SERIALISABLE_CAS_PROOF_PROPOSAL/V2';
const SIGNED_ALLOCATION_RECEIPT_SCHEMA = 'GOVERNED_IDENTITY_SIGNED_ALLOCATION_RECEIPT/V3';
const MAPPING_SET_SCHEMA = 'GOVERNED_IDENTITY_40_DEAL_41_OCCURRENCE_MAPPING_SET/V2';
const BEN_MAPPING_APPROVAL_REQUEST_SCHEMA = 'GOVERNED_IDENTITY_BEN_BATCH_MAPPING_APPROVAL_REQUEST/V2';
const REVIEWED_BRIDGE_SCHEMA = 'GOVERNED_IDENTITY_REVIEWED_BRIDGE/V3';
const AUTHORITY_BUNDLE_SCHEMA = 'GOVERNED_IDENTITY_AUTHORITY_BUNDLE_PROPOSAL/V2';
const GOVERNED_DEAL_KEY_DOMAIN = 'GOVERNED_IDENTITY_DEAL_KEY/V2';
const MANIFEST_DOMAIN = 'GOVERNED_IDENTITY_MANIFEST/V2';
const REQUIRED_DEAL_COUNT = 40;
const REQUIRED_OCCURRENCE_COUNT = 41;
const TOPBUILD_SECOND_OCCURRENCE_ID = 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE';
const REGISTRY_AND_PERSISTENCE_BLOCKER = 'REGISTRY_AMENDMENT_AND_REAL_PERSISTENCE_REQUIRED';
const BEN_BATCH_MAPPING_SIGNATURE_BLOCKER = 'IDENTITY_BEN_BATCH_MAPPING_SIGNATURE_REQUIRED';
const NOT_ISSUED = 'PROPOSAL_ONLY_NOT_ISSUED';
const UNVERIFIED = 'UNVERIFIED_REGISTRY_AMENDMENT_AND_PERSISTENCE_REQUIRED';
const BEN_MAPPING_APPROVAL_SIGNATURE_DOMAIN = 'GOVERNED_IDENTITY_BEN_BATCH_MAPPING_APPROVAL/V1';
const BEN_APPROVER_KEY_ID = 'PROGRAMME_GATE_BEN_APPROVER_2026_07';
const BEN_APPROVING_IDENTITY = 'BEN_GOODCHILD';
const BATCH_MAPPING_SIGNATURE_POLICY = 'ONE_BEN_SIGNATURE_FOR_EXACT_40_DEAL_41_OCCURRENCE_MAPPING_SET';
const FROZEN_KEY_REGISTRY_ROLE_DOMAIN_GRANTS = Object.freeze([
  Object.freeze({
    key_id: 'IDENTITY_ALLOCATION_CONTROLLER_EXTERNAL_REGISTRY_REQUIRED',
    permitted_action: 'ISSUE_GOVERNED_IDENTITY_ALLOCATION_RECEIPT',
    permitted_domain: SIGNED_ALLOCATION_RECEIPT_SCHEMA,
    role: 'IDENTITY_ALLOCATION_CONTROLLER',
  }),
  Object.freeze({
    key_id: BEN_APPROVER_KEY_ID,
    permitted_action: 'SIGN_GOVERNED_IDENTITY_BATCH_MAPPING_APPROVAL',
    permitted_domain: BEN_MAPPING_APPROVAL_SIGNATURE_DOMAIN,
    role: 'BEN_APPROVER',
  }),
  Object.freeze({
    key_id: 'IDENTITY_BRIDGE_ISSUER_EXTERNAL_REGISTRY_REQUIRED',
    permitted_action: 'ISSUE_GOVERNED_IDENTITY_REVIEWED_BRIDGE',
    permitted_domain: REVIEWED_BRIDGE_SCHEMA,
    role: 'IDENTITY_BRIDGE_ISSUER',
  }),
  Object.freeze({
    key_id: 'V1_CAPTURE_CONTROLLER_EXTERNAL_REGISTRY_REQUIRED',
    permitted_action: 'CONTROL_V1_TRUSTED_CAPTURE',
    permitted_domain: 'V1_TRUSTED_CAPTURE_SIGNED_RUN_HEAD/V1',
    role: 'V1_CAPTURE_CONTROLLER',
  }),
  Object.freeze({
    key_id: 'V1_FINAL_VALIDATOR_EXTERNAL_REGISTRY_REQUIRED',
    permitted_action: 'VALIDATE_V1_FINAL_REPLAY',
    permitted_domain: 'V1_REPLAY_VALIDATOR_LEDGER/V1',
    role: 'V1_FINAL_VALIDATOR',
  }),
  Object.freeze({
    key_id: 'V1_REPLAY_CONTROLLER_EXTERNAL_REGISTRY_REQUIRED',
    permitted_action: 'CONTROL_V1_REPLAY',
    permitted_domain: 'V1_REPLAY_RECEIPT/V1',
    role: 'V1_REPLAY_CONTROLLER',
  }),
].sort((left, right) => left.role.localeCompare(right.role)));
const DIGEST_RE = /^[a-f0-9]{64}$/;
const NONCE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const TRANSACTION_ID_RE = /^TX-\d{6}$/;

class GovernedIdentityTrustContractsError extends Error {
  constructor(code, message) { super(message); this.name = 'GovernedIdentityTrustContractsError'; this.code = code; }
}

function fail(code, message) { throw new GovernedIdentityTrustContractsError(code, message); }
function plain(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function exactKeys(value, keys, label) {
  if (!plain(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail('IDENTITY_EXACT_KEY_SET_REQUIRED', `${label} has unsupported or missing fields.`);
}
function requireDigest(value, label) { if (typeof value !== 'string' || !DIGEST_RE.test(value)) fail('IDENTITY_DIGEST_INVALID', `${label} must be a SHA-256 content identifier.`); return value; }
function requireText(value, label, pattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{2,255}$/) { if (typeof value !== 'string' || !pattern.test(value)) fail('IDENTITY_TEXT_INVALID', `${label} is invalid.`); return value; }
function requireNonce(value, label) { if (typeof value !== 'string' || !NONCE_RE.test(value)) fail('IDENTITY_NONCE_INVALID', `${label} is invalid.`); return value; }
function requireTransactionId(value, label) { if (typeof value !== 'string' || !TRANSACTION_ID_RE.test(value)) fail('IDENTITY_TRANSACTION_ID_INVALID', `${label} must use the adopted TX-000001 format.`); return value; }
function cloneFreeze(value) { return Object.freeze(structuredClone(value)); }
function unique(values, code, label) { if (new Set(values).size !== values.length) fail(code, `${label} must be unique.`); }

function governedDealKey(namespaceValue, seedDigest) {
  return contentId(GOVERNED_DEAL_KEY_DOMAIN, { namespace_value: namespaceValue, seed_digest: seedDigest });
}
function manifestId(namespaceBindingId, transactionId, seedDigest, governedKey) {
  return contentId(MANIFEST_DOMAIN, {
    namespace_binding_id: namespaceBindingId,
    transaction_id: transactionId,
    seed_digest: seedDigest,
    governed_deal_key: governedKey,
  });
}

function validateFrozenKeyRegistryAmendmentProposal(value) {
  exactKeys(value, [
    'amendment_proposal_id', 'authority', 'base_key_registry_root_id', 'pending_ben_ruling_id',
    'issuance_authority', 'private_key_material', 'registry_activation_authority', 'role_domain_grants', 'schema_version', 'signing_authority', 'state',
  ], 'Frozen key-registry amendment proposal');
  if (value.schema_version !== FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA || value.state !== 'FROZEN_PROPOSAL_PENDING_REGISTRY_AMENDMENT' || value.authority !== 'NONE') {
    fail('IDENTITY_KEY_REGISTRY_AMENDMENT_INVALID', 'Key-registry amendment must remain a frozen proposal with no authority.');
  }
  requireDigest(value.base_key_registry_root_id, 'Base key-registry root'); requireDigest(value.pending_ben_ruling_id, 'Pending Ben ruling');
  if (value.private_key_material !== null || value.issuance_authority !== 'NONE' || value.registry_activation_authority !== 'NONE' || value.signing_authority !== 'NONE'
    || !same(value.role_domain_grants, FROZEN_KEY_REGISTRY_ROLE_DOMAIN_GRANTS)) {
    fail('IDENTITY_KEY_REGISTRY_AMENDMENT_INVALID', 'Key-registry amendment must retain the exact least-privilege role domains with no private key, issuance, activation, or signing authority.');
  }
  const { amendment_proposal_id: identifier, ...body } = value;
  if (identifier !== contentId(FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA, body)) fail('IDENTITY_KEY_REGISTRY_AMENDMENT_ID_INVALID', 'Key-registry amendment proposal identity is invalid.');
  return cloneFreeze(value);
}
function buildFrozenKeyRegistryAmendmentProposal({ base_key_registry_root_id: baseRoot, pending_ben_ruling_id: rulingId } = {}) {
  const body = {
    schema_version: FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA,
    state: 'FROZEN_PROPOSAL_PENDING_REGISTRY_AMENDMENT', authority: 'NONE',
    base_key_registry_root_id: baseRoot, pending_ben_ruling_id: rulingId,
    role_domain_grants: structuredClone(FROZEN_KEY_REGISTRY_ROLE_DOMAIN_GRANTS),
    private_key_material: null, issuance_authority: 'NONE', registry_activation_authority: 'NONE', signing_authority: 'NONE',
  };
  return validateFrozenKeyRegistryAmendmentProposal({ ...body, amendment_proposal_id: contentId(FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA, body) });
}

function validateNamespaceApprovalRequest(value) {
  exactKeys(value, [
    'approval_authority', 'approval_request_id', 'approval_signature', 'namespace_value', 'recorded_ben_ruling_id',
    'request_nonce', 'schema_version', 'seed_schema_version', 'state', 'transaction_identifiers',
  ], 'Ratified namespace policy');
  if (value.schema_version !== NAMESPACE_APPROVAL_REQUEST_SCHEMA || value.state !== 'RECORDED_BEN_RATIFICATION_REFERENCE_ONLY'
    || value.approval_authority !== 'NONE' || value.approval_signature !== null) {
    fail('IDENTITY_NAMESPACE_APPROVAL_REQUEST_INVALID', 'Ratified namespace policy must remain a non-authorising decision reference.');
  }
  if (value.namespace_value !== INITIAL_IMPORT_NAMESPACE || value.seed_schema_version !== INITIAL_IMPORT_SEED_SCHEMA_VERSION
    || !same(value.transaction_identifiers, INITIAL_IMPORT_TRANSACTION_IDS)) {
    fail('IDENTITY_NAMESPACE_POLICY_INVALID', 'Namespace policy must bind the adopted namespace, seed schema and exact TX-000001 through TX-000040 sequence.');
  }
  requireDigest(value.recorded_ben_ruling_id, 'Recorded Ben ruling'); requireNonce(value.request_nonce, 'Namespace request nonce');
  const { approval_request_id: identifier, ...body } = value;
  if (identifier !== contentId(NAMESPACE_APPROVAL_REQUEST_SCHEMA, body)) fail('IDENTITY_NAMESPACE_APPROVAL_REQUEST_ID_INVALID', 'Namespace approval request identity is invalid.');
  return cloneFreeze(value);
}
function buildNamespaceApprovalRequest({ namespace_value: namespaceValue = INITIAL_IMPORT_NAMESPACE, recorded_ben_ruling_id: rulingId, request_nonce: nonce } = {}) {
  const body = {
    schema_version: NAMESPACE_APPROVAL_REQUEST_SCHEMA, state: 'RECORDED_BEN_RATIFICATION_REFERENCE_ONLY',
    approval_authority: 'NONE', approval_signature: null, namespace_value: namespaceValue,
    seed_schema_version: INITIAL_IMPORT_SEED_SCHEMA_VERSION,
    transaction_identifiers: INITIAL_IMPORT_TRANSACTION_IDS,
    recorded_ben_ruling_id: rulingId, request_nonce: nonce,
  };
  return validateNamespaceApprovalRequest({ ...body, approval_request_id: contentId(NAMESPACE_APPROVAL_REQUEST_SCHEMA, body) });
}

function validateExternalNamespaceBinding(value, { namespace_approval_request: request } = {}) {
  validateNamespaceApprovalRequest(request);
  exactKeys(value, [
    'external_ruling_id', 'namespace_binding_id', 'namespace_value', 'schema_version', 'state',
    'namespace_approval_request_id',
  ], 'External namespace binding');
  if (value.schema_version !== EXTERNAL_NAMESPACE_BINDING_SCHEMA || value.state !== 'RECORDED_RATIFIED_REFERENCE_ONLY_NOT_AUTHORITY'
    || value.namespace_approval_request_id !== request.approval_request_id || value.namespace_value !== request.namespace_value) {
    fail('IDENTITY_NAMESPACE_BINDING_INVALID', 'Namespace binding must use an externally ratified value from the exact request.');
  }
  requireDigest(value.external_ruling_id, 'External namespace ruling');
  const { namespace_binding_id: identifier, ...body } = value;
  if (identifier !== contentId(EXTERNAL_NAMESPACE_BINDING_SCHEMA, body)) fail('IDENTITY_NAMESPACE_BINDING_ID_INVALID', 'Namespace binding identity is invalid.');
  return cloneFreeze(value);
}
function bindExternallyRatifiedNamespace({ namespace_approval_request: request, external_ruling_id: rulingId } = {}) {
  const body = {
    schema_version: EXTERNAL_NAMESPACE_BINDING_SCHEMA,
    state: 'RECORDED_RATIFIED_REFERENCE_ONLY_NOT_AUTHORITY',
    namespace_approval_request_id: request?.approval_request_id,
    namespace_value: request?.namespace_value,
    external_ruling_id: rulingId,
  };
  return validateExternalNamespaceBinding({ ...body, namespace_binding_id: contentId(EXTERNAL_NAMESPACE_BINDING_SCHEMA, body) }, { namespace_approval_request: request });
}

function validateSerialisableCasProof(value) {
  exactKeys(value, [
    'cas_proof_id', 'expected_nonce_version', 'expected_slot_version', 'mapping_seed_root_id',
    'nonce_registry_predecessor_id', 'schema_version', 'serialisable_isolation_root_id', 'slot_predecessor_id',
    'state', 'transaction_id',
  ], 'Serialisable CAS proof');
  if (value.schema_version !== SERIALISABLE_CAS_PROOF_SCHEMA || value.state !== 'PROPOSED_NO_REAL_PERSISTENCE') {
    fail('IDENTITY_CAS_PROOF_INVALID', 'CAS proof must remain a no-persistence proposal.');
  }
  if (!Number.isSafeInteger(value.expected_slot_version) || value.expected_slot_version < 0
    || !Number.isSafeInteger(value.expected_nonce_version) || value.expected_nonce_version < 0) {
    fail('IDENTITY_CAS_VERSION_INVALID', 'CAS expected versions must be non-negative integers.');
  }
  ['mapping_seed_root_id', 'nonce_registry_predecessor_id', 'serialisable_isolation_root_id', 'slot_predecessor_id'].forEach((key) => requireDigest(value[key], key));
  requireTransactionId(value.transaction_id, 'Transaction ID');
  const { cas_proof_id: identifier, ...body } = value;
  if (identifier !== contentId(SERIALISABLE_CAS_PROOF_SCHEMA, body)) fail('IDENTITY_CAS_PROOF_ID_INVALID', 'CAS proof identity is invalid.');
  return cloneFreeze(value);
}
function buildSerialisableCasProof(input = {}) {
  const body = { schema_version: SERIALISABLE_CAS_PROOF_SCHEMA, state: 'PROPOSED_NO_REAL_PERSISTENCE', ...input };
  return validateSerialisableCasProof({ ...body, cas_proof_id: contentId(SERIALISABLE_CAS_PROOF_SCHEMA, body) });
}

function validateAllocationReceipt(value, { namespace_binding: binding, namespace_approval_request: namespaceRequest, cas_proof: proof } = {}) {
  validateExternalNamespaceBinding(binding, { namespace_approval_request: namespaceRequest });
  validateSerialisableCasProof(proof);
  exactKeys(value, [
    'allocation_nonce', 'allocation_receipt_id', 'cas_proof_id', 'governed_deal_key', 'issuance_state', 'manifest_id',
    'mapping_seed_root_id', 'namespace_binding_id', 'schema_version', 'seed_digest', 'signature', 'signature_state', 'status', 'transaction_id',
  ], 'Signed allocation receipt');
  if (value.schema_version !== SIGNED_ALLOCATION_RECEIPT_SCHEMA || value.status !== NOT_ISSUED || value.issuance_state !== 'NOT_ISSUED'
    || value.signature !== null || value.signature_state !== UNVERIFIED) {
    fail('IDENTITY_ALLOCATION_RECEIPT_ISSUANCE_FORBIDDEN', 'Allocation receipt cannot self-issue or claim a verified signature.');
  }
  requireNonce(value.allocation_nonce, 'Allocation nonce');
  requireTransactionId(value.transaction_id, 'Allocation transaction ID');
  if (value.namespace_binding_id !== binding.namespace_binding_id || value.cas_proof_id !== proof.cas_proof_id
    || value.mapping_seed_root_id !== proof.mapping_seed_root_id || value.transaction_id !== proof.transaction_id) {
    fail('IDENTITY_ALLOCATION_RECEIPT_BINDING_INVALID', 'Allocation receipt must bind the exact namespace and CAS proposal.');
  }
  requireDigest(value.governed_deal_key, 'Governed deal key'); requireDigest(value.manifest_id, 'Manifest ID'); requireDigest(value.seed_digest, 'Seed digest');
  const expectedKey = governedDealKey(binding.namespace_value, value.seed_digest);
  const expectedManifest = manifestId(binding.namespace_binding_id, proof.transaction_id, value.seed_digest, expectedKey);
  if (value.governed_deal_key !== expectedKey || value.manifest_id !== expectedManifest) {
    fail('IDENTITY_ALLOCATION_RECEIPT_BINDING_INVALID', 'Allocation receipt must derive its governed key and manifest from the exact transaction and seed.');
  }
  const { allocation_receipt_id: identifier, ...body } = value;
  if (identifier !== contentId(SIGNED_ALLOCATION_RECEIPT_SCHEMA, body)) fail('IDENTITY_ALLOCATION_RECEIPT_ID_INVALID', 'Allocation receipt identity is invalid.');
  return cloneFreeze(value);
}
function buildAllocationReceipt({ namespace_binding: binding, namespace_approval_request: namespaceRequest, cas_proof: proof, seed_digest: seedDigest, allocation_nonce: nonce } = {}) {
  const key = governedDealKey(binding?.namespace_value, seedDigest);
  const body = {
    schema_version: SIGNED_ALLOCATION_RECEIPT_SCHEMA, status: NOT_ISSUED, issuance_state: 'NOT_ISSUED',
    namespace_binding_id: binding?.namespace_binding_id, mapping_seed_root_id: proof?.mapping_seed_root_id,
    transaction_id: proof?.transaction_id, cas_proof_id: proof?.cas_proof_id, allocation_nonce: nonce, seed_digest: seedDigest,
    governed_deal_key: key, manifest_id: manifestId(binding?.namespace_binding_id, proof?.transaction_id, seedDigest, key),
    signature_state: UNVERIFIED, signature: null,
  };
  return validateAllocationReceipt({ ...body, allocation_receipt_id: contentId(SIGNED_ALLOCATION_RECEIPT_SCHEMA, body) }, { namespace_binding: binding, namespace_approval_request: namespaceRequest, cas_proof: proof });
}

function normaliseDealMappings(rows, binding) {
  if (!Array.isArray(rows) || rows.length !== REQUIRED_DEAL_COUNT) fail('IDENTITY_MAPPING_DEAL_COUNT_INVALID', 'Mapping set requires exactly 40 explicit deal mappings.');
  const output = rows.map((row, index) => {
    exactKeys(row, ['allocation_receipt_id', 'governed_deal_key', 'manifest_id', 'production_deal_id', 'seed_digest', 'transaction_id'], `Deal mapping ${index}`);
    ['allocation_receipt_id', 'governed_deal_key', 'manifest_id', 'seed_digest'].forEach((key) => requireDigest(row[key], `Deal mapping ${key}`));
    requireTransactionId(row.transaction_id, 'Deal mapping transaction ID');
    requireText(row.production_deal_id, 'Production deal ID');
    const expectedKey = governedDealKey(binding.namespace_value, row.seed_digest);
    const expectedManifest = manifestId(binding.namespace_binding_id, row.transaction_id, row.seed_digest, expectedKey);
    if (row.governed_deal_key !== expectedKey || row.manifest_id !== expectedManifest) fail('IDENTITY_MAPPING_SEED_REMAP_INVALID', 'A deal mapping cannot remap a seed to another governed key or manifest.');
    return Object.freeze({ ...row });
  }).sort((left, right) => left.transaction_id.localeCompare(right.transaction_id));
  if (!same(output.map((row) => row.transaction_id), INITIAL_IMPORT_TRANSACTION_IDS)) {
    fail('IDENTITY_MAPPING_TRANSACTION_SEQUENCE_INVALID', 'Deal mappings must cover TX-000001 through TX-000040 exactly once.');
  }
  for (const key of ['transaction_id', 'production_deal_id', 'governed_deal_key', 'manifest_id', 'allocation_receipt_id']) unique(output.map((row) => row[key]), 'IDENTITY_MAPPING_DUPLICATE', `Deal mapping ${key}`);
  return Object.freeze(output);
}

function normaliseOccurrenceMappings(rows, transactionIds) {
  if (!Array.isArray(rows) || rows.length !== REQUIRED_OCCURRENCE_COUNT) fail('IDENTITY_MAPPING_OCCURRENCE_COUNT_INVALID', 'Mapping set requires exactly 41 explicit occurrence mappings.');
  const output = rows.map((row, index) => {
    exactKeys(row, ['occurrence_id', 'transaction_id'], `Occurrence mapping ${index}`);
    requireText(row.occurrence_id, 'Occurrence ID'); requireTransactionId(row.transaction_id, 'Occurrence transaction ID');
    if (!transactionIds.has(row.transaction_id)) fail('IDENTITY_OCCURRENCE_TRANSACTION_UNKNOWN', 'Occurrence mapping references an unknown transaction.');
    return Object.freeze({ ...row });
  }).sort((left, right) => left.occurrence_id.localeCompare(right.occurrence_id));
  unique(output.map((row) => row.occurrence_id), 'IDENTITY_MAPPING_DUPLICATE', 'Occurrence mapping occurrence_id');
  if (!output.some((row) => row.occurrence_id === TOPBUILD_SECOND_OCCURRENCE_ID)) fail('IDENTITY_TOPBUILD_SECOND_OCCURRENCE_MISSING', 'Mapping set must retain the second TopBuild agreement occurrence.');
  return Object.freeze(output);
}

function validateMappingSet(value, { namespace_binding: binding, namespace_approval_request: namespaceRequest } = {}) {
  exactKeys(value, [
    'deal_mappings', 'mapping_seed_root_id', 'mapping_set_id', 'namespace_binding_id', 'occurrence_mappings',
    'schema_version', 'source_occurrence_root_id', 'state', 'supersedes_mapping_set_ids', 'supersession_mode',
  ], '40-deal/41-occurrence mapping set');
  validateExternalNamespaceBinding(binding, { namespace_approval_request: namespaceRequest });
  if (value.schema_version !== MAPPING_SET_SCHEMA || value.state !== NOT_ISSUED || value.namespace_binding_id !== binding?.namespace_binding_id) {
    fail('IDENTITY_MAPPING_SET_INVALID', 'Mapping set must remain a proposal bound to one externally ratified namespace.');
  }
  requireDigest(value.mapping_seed_root_id, 'Mapping seed root'); requireDigest(value.source_occurrence_root_id, 'Source occurrence root');
  const dealMappings = normaliseDealMappings(value.deal_mappings, binding);
  const occurrenceMappings = normaliseOccurrenceMappings(value.occurrence_mappings, new Set(dealMappings.map((row) => row.transaction_id)));
  if (!Array.isArray(value.supersedes_mapping_set_ids)) fail('IDENTITY_SUPERSESSION_INVALID', 'Supersession list must be an array.');
  const supersedes = [...value.supersedes_mapping_set_ids].sort(); supersedes.forEach((item) => requireDigest(item, 'Superseded mapping set ID')); unique(supersedes, 'IDENTITY_SUPERSESSION_DUPLICATE', 'Superseded mapping set ID');
  const expectedMode = supersedes.length === 0 ? 'GENESIS' : 'REPLACEMENT_REVIEW_REQUIRED';
  if (value.supersession_mode !== expectedMode) fail('IDENTITY_SUPERSESSION_INVALID', 'Supersession mode must derive from the explicit predecessor set.');
  const body = {
    schema_version: value.schema_version, state: value.state, namespace_binding_id: value.namespace_binding_id,
    mapping_seed_root_id: value.mapping_seed_root_id, source_occurrence_root_id: value.source_occurrence_root_id,
    deal_mappings: dealMappings, occurrence_mappings: occurrenceMappings, supersedes_mapping_set_ids: supersedes,
    supersession_mode: value.supersession_mode,
  };
  if (value.mapping_set_id !== contentId(MAPPING_SET_SCHEMA, body)) fail('IDENTITY_MAPPING_SET_ID_INVALID', 'Mapping set identity is invalid.');
  return cloneFreeze(value);
}
function buildMappingSet({ namespace_binding: binding, namespace_approval_request: namespaceRequest, mapping_seed_root_id: mappingRoot, source_occurrence_root_id: occurrenceRoot, deal_mappings: deals, occurrence_mappings: occurrences, supersedes_mapping_set_ids: supersedes = [] } = {}) {
  const sortedSupersedes = [...supersedes].sort();
  const body = {
    schema_version: MAPPING_SET_SCHEMA, state: NOT_ISSUED, namespace_binding_id: binding?.namespace_binding_id,
    mapping_seed_root_id: mappingRoot, source_occurrence_root_id: occurrenceRoot, deal_mappings: deals,
    occurrence_mappings: occurrences, supersedes_mapping_set_ids: sortedSupersedes,
    supersession_mode: sortedSupersedes.length === 0 ? 'GENESIS' : 'REPLACEMENT_REVIEW_REQUIRED',
  };
  return validateMappingSet({ ...body, mapping_set_id: contentId(MAPPING_SET_SCHEMA, body) }, { namespace_binding: binding, namespace_approval_request: namespaceRequest });
}

function validateBenMappingApprovalRequest(value, mappingSet, namespaceRequest) {
  validateMappingSet(mappingSet, { namespace_binding: value?.namespace_binding, namespace_approval_request: namespaceRequest });
  exactKeys(value, [
    'approval_authority', 'approval_key_id', 'approval_policy', 'approval_request_id', 'approval_signature',
    'approved_deal_count', 'approved_occurrence_count', 'approving_identity', 'mapping_set_id', 'namespace_binding',
    'requested_terminal_decision', 'review_root_id', 'schema_version', 'signature_domain', 'state',
  ], 'Ben mapping-approval request');
  if (value.schema_version !== BEN_MAPPING_APPROVAL_REQUEST_SCHEMA || value.state !== 'REQUESTED_EXTERNAL_BEN_MAPPING_APPROVAL_REQUIRED'
    || value.approval_authority !== 'NONE' || value.approval_signature !== null || value.mapping_set_id !== mappingSet.mapping_set_id
    || value.approval_key_id !== BEN_APPROVER_KEY_ID || value.approval_policy !== BATCH_MAPPING_SIGNATURE_POLICY
    || value.approved_deal_count !== REQUIRED_DEAL_COUNT || value.approved_occurrence_count !== REQUIRED_OCCURRENCE_COUNT
    || value.approving_identity !== BEN_APPROVING_IDENTITY || value.signature_domain !== BEN_MAPPING_APPROVAL_SIGNATURE_DOMAIN
    || value.requested_terminal_decision !== 'APPROVE') {
    fail('IDENTITY_MAPPING_APPROVAL_REQUEST_INVALID', 'Mapping approval request must remain unsigned and non-authorising.');
  }
  requireDigest(value.review_root_id, 'Mapping review root');
  const { approval_request_id: identifier, namespace_binding: binding, ...body } = value;
  if (!plain(binding) || binding.namespace_binding_id !== mappingSet.namespace_binding_id || identifier !== contentId(BEN_MAPPING_APPROVAL_REQUEST_SCHEMA, { ...body, namespace_binding_id: binding.namespace_binding_id })) {
    fail('IDENTITY_MAPPING_APPROVAL_REQUEST_ID_INVALID', 'Mapping approval request identity is invalid.');
  }
  return cloneFreeze(value);
}
function buildBenMappingApprovalRequest({ mapping_set: mappingSet, namespace_binding: binding, namespace_approval_request: namespaceRequest, review_root_id: reviewRoot } = {}) {
  const body = {
    schema_version: BEN_MAPPING_APPROVAL_REQUEST_SCHEMA, state: 'REQUESTED_EXTERNAL_BEN_MAPPING_APPROVAL_REQUIRED',
    approval_authority: 'NONE', approval_signature: null, mapping_set_id: mappingSet?.mapping_set_id,
    approval_policy: BATCH_MAPPING_SIGNATURE_POLICY,
    approved_deal_count: REQUIRED_DEAL_COUNT,
    approved_occurrence_count: REQUIRED_OCCURRENCE_COUNT,
    approving_identity: BEN_APPROVING_IDENTITY,
    approval_key_id: BEN_APPROVER_KEY_ID,
    signature_domain: BEN_MAPPING_APPROVAL_SIGNATURE_DOMAIN,
    requested_terminal_decision: 'APPROVE',
    review_root_id: reviewRoot,
  };
  const value = { ...body, namespace_binding: binding };
  return validateBenMappingApprovalRequest({ ...value, approval_request_id: contentId(BEN_MAPPING_APPROVAL_REQUEST_SCHEMA, { ...body, namespace_binding_id: binding?.namespace_binding_id }) }, mappingSet, namespaceRequest);
}

function validateReviewedBridge(value, { mapping_set: mappingSet, mapping_approval_request: approvalRequest, namespace_approval_request: namespaceRequest } = {}) {
  validateBenMappingApprovalRequest(approvalRequest, mappingSet, namespaceRequest);
  exactKeys(value, [
    'bridge_authority', 'bridge_id', 'consumer_brand_authority', 'mapping_approval_request_id', 'mapping_set_id',
    'review_root_id', 'schema_version', 'state',
  ], 'Reviewed bridge');
  if (value.schema_version !== REVIEWED_BRIDGE_SCHEMA || value.state !== NOT_ISSUED || value.bridge_authority !== 'NONE'
    || value.consumer_brand_authority !== 'NONE' || value.mapping_set_id !== mappingSet.mapping_set_id
    || value.mapping_approval_request_id !== approvalRequest.approval_request_id || value.review_root_id !== approvalRequest.review_root_id) {
    fail('IDENTITY_REVIEWED_BRIDGE_INVALID', 'Reviewed bridge must remain a proposal with no consumer authority.');
  }
  const { bridge_id: identifier, ...body } = value;
  if (identifier !== contentId(REVIEWED_BRIDGE_SCHEMA, body)) fail('IDENTITY_REVIEWED_BRIDGE_ID_INVALID', 'Reviewed bridge identity is invalid.');
  return cloneFreeze(value);
}
function buildReviewedBridge({ mapping_set: mappingSet, mapping_approval_request: request, namespace_approval_request: namespaceRequest } = {}) {
  const body = {
    schema_version: REVIEWED_BRIDGE_SCHEMA, state: NOT_ISSUED, bridge_authority: 'NONE', consumer_brand_authority: 'NONE',
    mapping_set_id: mappingSet?.mapping_set_id, mapping_approval_request_id: request?.approval_request_id, review_root_id: request?.review_root_id,
  };
  return validateReviewedBridge({ ...body, bridge_id: contentId(REVIEWED_BRIDGE_SCHEMA, body) }, { mapping_set: mappingSet, mapping_approval_request: request, namespace_approval_request: namespaceRequest });
}

function validateAuthorityBundle(value) {
  exactKeys(value, [
    'allocation_receipts', 'authority_bundle_id', 'ben_mapping_approval_request', 'blocker_codes', 'bridge',
    'cas_proofs', 'frozen_key_registry_amendment', 'mapping_set', 'namespace_approval_request', 'namespace_binding',
    'schema_version', 'state',
  ], 'Identity authority bundle');
  if (value.schema_version !== AUTHORITY_BUNDLE_SCHEMA || value.state !== NOT_ISSUED
    || !Array.isArray(value.blocker_codes) || !value.blocker_codes.includes(BEN_BATCH_MAPPING_SIGNATURE_BLOCKER)
    || !value.blocker_codes.includes(REGISTRY_AND_PERSISTENCE_BLOCKER)) {
    fail('IDENTITY_AUTHORITY_BUNDLE_INVALID', 'Authority bundle must remain blocked on the batch signature, registry amendment, and persistence.');
  }
  validateFrozenKeyRegistryAmendmentProposal(value.frozen_key_registry_amendment);
  validateNamespaceApprovalRequest(value.namespace_approval_request);
  validateExternalNamespaceBinding(value.namespace_binding, { namespace_approval_request: value.namespace_approval_request });
  validateMappingSet(value.mapping_set, { namespace_binding: value.namespace_binding, namespace_approval_request: value.namespace_approval_request });
  if (!Array.isArray(value.cas_proofs) || !Array.isArray(value.allocation_receipts)
    || value.cas_proofs.length !== REQUIRED_DEAL_COUNT || value.allocation_receipts.length !== REQUIRED_DEAL_COUNT) {
    fail('IDENTITY_AUTHORITY_BUNDLE_COHORT_INCOMPLETE', 'Authority bundle requires distinct complete sets of 40 CAS proposals and machine allocation receipts.');
  }
  const proofs = value.cas_proofs.map(validateSerialisableCasProof); unique(proofs.map((proof) => proof.transaction_id), 'IDENTITY_AUTHORITY_BUNDLE_DUPLICATE', 'CAS transaction');
  const proofById = new Map(proofs.map((proof) => [proof.cas_proof_id, proof]));
  const receipts = value.allocation_receipts.map((receipt) => validateAllocationReceipt(receipt, { namespace_binding: value.namespace_binding, namespace_approval_request: value.namespace_approval_request, cas_proof: proofById.get(receipt.cas_proof_id) }));
  unique(receipts.map((receipt) => receipt.transaction_id), 'IDENTITY_AUTHORITY_BUNDLE_DUPLICATE', 'Receipt transaction');
  if (!same(receipts.map((receipt) => receipt.transaction_id).sort(), proofs.map((proof) => proof.transaction_id).sort())) fail('IDENTITY_AUTHORITY_BUNDLE_BINDING_INVALID', 'Receipts must cover the exact CAS transaction set.');
  if (!same(receipts.map((receipt) => receipt.allocation_receipt_id).sort(), value.mapping_set.deal_mappings.map((row) => row.allocation_receipt_id).sort())) fail('IDENTITY_AUTHORITY_BUNDLE_BINDING_INVALID', 'Mapping set must bind the exact allocation receipt set.');
  const receiptById = new Map(receipts.map((receipt) => [receipt.allocation_receipt_id, receipt]));
  for (const row of value.mapping_set.deal_mappings) {
    const receipt = receiptById.get(row.allocation_receipt_id);
    if (!receipt || receipt.transaction_id !== row.transaction_id || receipt.seed_digest !== row.seed_digest
      || receipt.governed_deal_key !== row.governed_deal_key || receipt.manifest_id !== row.manifest_id
      || receipt.mapping_seed_root_id !== value.mapping_set.mapping_seed_root_id) {
      fail('IDENTITY_AUTHORITY_BUNDLE_POSITIONAL_ZIP_FORBIDDEN', 'Mapping rows must join allocation receipts by explicit transaction, key, and manifest bindings.');
    }
  }
  validateBenMappingApprovalRequest(value.ben_mapping_approval_request, value.mapping_set, value.namespace_approval_request);
  validateReviewedBridge(value.bridge, { mapping_set: value.mapping_set, mapping_approval_request: value.ben_mapping_approval_request, namespace_approval_request: value.namespace_approval_request });
  const { authority_bundle_id: identifier, ...body } = value;
  if (identifier !== contentId(AUTHORITY_BUNDLE_SCHEMA, body)) fail('IDENTITY_AUTHORITY_BUNDLE_ID_INVALID', 'Identity authority bundle identity is invalid.');
  return cloneFreeze(value);
}
function buildAuthorityBundle(input = {}) {
  const body = { schema_version: AUTHORITY_BUNDLE_SCHEMA, state: NOT_ISSUED, blocker_codes: Object.freeze([BEN_BATCH_MAPPING_SIGNATURE_BLOCKER, REGISTRY_AND_PERSISTENCE_BLOCKER]), ...input };
  return validateAuthorityBundle({ ...body, authority_bundle_id: contentId(AUTHORITY_BUNDLE_SCHEMA, body) });
}

function requireRegistryAmendmentAndPersistence(action = 'trusted identity action') {
  fail(REGISTRY_AND_PERSISTENCE_BLOCKER, `${action} is blocked pending a registry amendment and real serialisable persistence.`);
}
function verifyAllocationReceiptSignature() { return requireRegistryAmendmentAndPersistence('Allocation receipt signature verification'); }
function verifyCurrentIdentityHead() { return requireRegistryAmendmentAndPersistence('Current identity head verification'); }
function issueAllocationReceipt() { return requireRegistryAmendmentAndPersistence('Allocation receipt issuance'); }
function createIdentityConsumerBrand() { return requireRegistryAmendmentAndPersistence('Identity consumer-brand creation'); }

module.exports = {
  AUTHORITY_BUNDLE_SCHEMA, BATCH_MAPPING_SIGNATURE_POLICY, BEN_APPROVER_KEY_ID, BEN_APPROVING_IDENTITY, BEN_BATCH_MAPPING_SIGNATURE_BLOCKER, BEN_MAPPING_APPROVAL_REQUEST_SCHEMA, BEN_MAPPING_APPROVAL_SIGNATURE_DOMAIN, EXTERNAL_NAMESPACE_BINDING_SCHEMA,
  FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA, GOVERNED_DEAL_KEY_DOMAIN, MAPPING_SET_SCHEMA, MANIFEST_DOMAIN,
  INITIAL_IMPORT_NAMESPACE, INITIAL_IMPORT_SEED_SCHEMA_VERSION, INITIAL_IMPORT_TRANSACTION_IDS,
  NAMESPACE_APPROVAL_REQUEST_SCHEMA, NOT_ISSUED, REGISTRY_AND_PERSISTENCE_BLOCKER,
  REQUIRED_DEAL_COUNT, REQUIRED_OCCURRENCE_COUNT, REVIEWED_BRIDGE_SCHEMA, SERIALISABLE_CAS_PROOF_SCHEMA,
  SIGNED_ALLOCATION_RECEIPT_SCHEMA, TOPBUILD_SECOND_OCCURRENCE_ID, UNVERIFIED, FROZEN_KEY_REGISTRY_ROLE_DOMAIN_GRANTS, GovernedIdentityTrustContractsError,
  bindExternallyRatifiedNamespace, buildAllocationReceipt, buildAuthorityBundle, buildBenMappingApprovalRequest,
  buildFrozenKeyRegistryAmendmentProposal, buildMappingSet, buildNamespaceApprovalRequest, buildReviewedBridge,
  buildSerialisableCasProof, createIdentityConsumerBrand, governedDealKey, issueAllocationReceipt, manifestId,
  requireRegistryAmendmentAndPersistence, validateAllocationReceipt, validateAuthorityBundle,
  validateBenMappingApprovalRequest, validateExternalNamespaceBinding, validateFrozenKeyRegistryAmendmentProposal,
  validateMappingSet, validateNamespaceApprovalRequest, validateReviewedBridge, validateSerialisableCasProof,
  verifyAllocationReceiptSignature, verifyCurrentIdentityHead,
};
