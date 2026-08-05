'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const ALLOCATION_RECEIPT_SCHEMA = 'DEAL_IDENTITY_ALLOCATION_PERSISTENCE_RECEIPT_PROPOSAL/V1';
const PRODUCTION_BRIDGE_SCHEMA = 'REVIEWED_PRODUCTION_DEAL_IDENTITY_BRIDGE_PROPOSAL/V1';
const ISSUED_ALLOCATION_RECEIPT_SCHEMA = 'DEAL_IDENTITY_ALLOCATION_PERSISTENCE_RECEIPT_ISSUED/V1';
const ISSUED_PRODUCTION_BRIDGE_SCHEMA = 'REVIEWED_PRODUCTION_DEAL_IDENTITY_BRIDGE_ISSUED/V1';
const NOT_ISSUED = 'NOT_ISSUED_PREVIEW_ONLY_NOT_AUTHORITY';
const DIGEST_RE = /^[a-f0-9]{64}$/;

class DealIdentityAllocationReadinessError extends Error {
  constructor(code, message) { super(message); this.name = 'DealIdentityAllocationReadinessError'; this.code = code; }
}
function fail(code, message) { throw new DealIdentityAllocationReadinessError(code, message); }
function exactKeys(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort()); }
function digest(value, label) { if (!DIGEST_RE.test(value || '')) fail('IDENTITY_ALLOCATION_BINDING_INVALID', `${label} must be a SHA-256 identity.`); return value; }

function buildAllocationPersistenceReceiptProposal(input = {}) {
  const keys = ['approval_or_frozen_issuer_authority_id', 'expected_nonce_registry_version', 'expected_slot_version', 'governed_deal_key', 'manifest_id', 'nonce_registry_predecessor_id', 'seed_slot_predecessor_id', 'serialisable_transaction_isolation_evidence_id', 'zero_conflicting_allocation_evidence_id'];
  if (!exactKeys(input, keys) || !Number.isSafeInteger(input.expected_slot_version) || input.expected_slot_version < 0 || !Number.isSafeInteger(input.expected_nonce_registry_version) || input.expected_nonce_registry_version < 0) {
    fail('IDENTITY_ALLOCATION_BINDING_INVALID', 'Allocation receipt proposal requires exact predecessor versions and closed evidence bindings.');
  }
  for (const key of keys.filter((key) => !key.startsWith('expected_'))) digest(input[key], key);
  const body = { schema_version: ALLOCATION_RECEIPT_SCHEMA, status: NOT_ISSUED, ...input, persistence_authority: 'NONE', admission_authority: 'NONE' };
  return Object.freeze({ ...body, allocation_persistence_receipt_id: contentId(ALLOCATION_RECEIPT_SCHEMA, body) });
}

function validateAllocationPersistenceReceiptProposal(receipt) {
  const keys = ['admission_authority', 'allocation_persistence_receipt_id', 'approval_or_frozen_issuer_authority_id', 'expected_nonce_registry_version', 'expected_slot_version', 'governed_deal_key', 'manifest_id', 'nonce_registry_predecessor_id', 'persistence_authority', 'schema_version', 'seed_slot_predecessor_id', 'serialisable_transaction_isolation_evidence_id', 'status', 'zero_conflicting_allocation_evidence_id'];
  if (!exactKeys(receipt, keys) || receipt.schema_version !== ALLOCATION_RECEIPT_SCHEMA || receipt.status !== NOT_ISSUED || receipt.persistence_authority !== 'NONE' || receipt.admission_authority !== 'NONE') fail('IDENTITY_ALLOCATION_RECEIPT_INVALID', 'Allocation receipt must remain an exact non-issued proposal.');
  const { allocation_persistence_receipt_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, persistence_authority: ignoredPersistence, admission_authority: ignoredAdmission, ...input } = receipt;
  const rebuilt = buildAllocationPersistenceReceiptProposal(input);
  if (canonicalJson(rebuilt) !== canonicalJson(receipt)) fail('IDENTITY_ALLOCATION_RECEIPT_STALE', 'Allocation receipt proposal identity is stale.');
  return rebuilt;
}

function buildReviewedProductionDealBridgeProposal({ initial_import_packet_id, source_root_id, reviewed_mapping_approval_id, mappings, occurrence_ids } = {}) {
  if (![initial_import_packet_id, source_root_id, reviewed_mapping_approval_id].every((value) => DIGEST_RE.test(value || '')) || !Array.isArray(mappings) || mappings.length !== 40 || !Array.isArray(occurrence_ids) || occurrence_ids.length !== 41) fail('PRODUCTION_IDENTITY_BRIDGE_INVALID', 'Bridge proposal requires the exact 40-deal and 41-occurrence cohort.');
  const rows = mappings.map((row) => {
    if (!exactKeys(row, ['allocation_persistence_receipt_id', 'governed_deal_key', 'production_deal_id']) || typeof row.production_deal_id !== 'string' || !row.production_deal_id || !DIGEST_RE.test(row.governed_deal_key) || !DIGEST_RE.test(row.allocation_persistence_receipt_id)) fail('PRODUCTION_IDENTITY_BRIDGE_INVALID', 'Each bridge row needs one production deal, governed key, and allocation receipt.');
    return Object.freeze({ ...row });
  }).sort((a, b) => a.production_deal_id.localeCompare(b.production_deal_id));
  if (new Set(rows.map((row) => row.production_deal_id)).size !== 40 || new Set(rows.map((row) => row.governed_deal_key)).size !== 40 || new Set(rows.map((row) => row.allocation_persistence_receipt_id)).size !== 40 || new Set(occurrence_ids).size !== 41 || !occurrence_ids.includes('TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE')) fail('PRODUCTION_IDENTITY_BRIDGE_INVALID', 'Bridge proposal must retain unique allocations and the TopBuild second occurrence.');
  const body = { schema_version: PRODUCTION_BRIDGE_SCHEMA, status: NOT_ISSUED, initial_import_packet_id, source_root_id, reviewed_mapping_approval_id, mappings: Object.freeze(rows), occurrence_ids: Object.freeze([...occurrence_ids].sort()), bridge_authority: 'NONE', admission_authority: 'NONE' };
  return Object.freeze({ ...body, production_deal_identity_bridge_id: contentId(PRODUCTION_BRIDGE_SCHEMA, body) });
}

function validateReviewedProductionDealBridgeProposal(bridge) {
  const keys = ['admission_authority', 'bridge_authority', 'initial_import_packet_id', 'mappings', 'occurrence_ids', 'production_deal_identity_bridge_id', 'reviewed_mapping_approval_id', 'schema_version', 'source_root_id', 'status'];
  if (!exactKeys(bridge, keys) || bridge.schema_version !== PRODUCTION_BRIDGE_SCHEMA || bridge.status !== NOT_ISSUED || bridge.bridge_authority !== 'NONE' || bridge.admission_authority !== 'NONE') fail('PRODUCTION_IDENTITY_BRIDGE_INVALID', 'Production identity bridge must remain a non-issued proposal.');
  const { production_deal_identity_bridge_id: ignored, schema_version: ignoredSchema, status: ignoredStatus, bridge_authority: ignoredBridge, admission_authority: ignoredAdmission, ...input } = bridge;
  const rebuilt = buildReviewedProductionDealBridgeProposal(input);
  if (canonicalJson(rebuilt) !== canonicalJson(bridge)) fail('PRODUCTION_IDENTITY_BRIDGE_STALE', 'Production identity bridge proposal is stale.');
  return rebuilt;
}

function validateIssuedAllocationPersistenceReceipt(receipt) {
  const keys = ['allocation_persistence_receipt_id', 'bridge_eligible', 'governed_deal_key', 'issued_allocation_receipt_id', 'manifest_id', 'schema_version', 'serialisable_persistence_receipt_id', 'status'];
  if (!exactKeys(receipt, keys) || receipt.schema_version !== ISSUED_ALLOCATION_RECEIPT_SCHEMA || receipt.status !== 'ISSUED' || receipt.bridge_eligible !== true) fail('ISSUED_IDENTITY_ALLOCATION_REQUIRED', 'Issued allocation receipt is required.');
  [receipt.allocation_persistence_receipt_id, receipt.governed_deal_key, receipt.manifest_id, receipt.serialisable_persistence_receipt_id].forEach((value) => digest(value, 'issued allocation binding'));
  const { issued_allocation_receipt_id: ignored, ...body } = receipt;
  if (receipt.issued_allocation_receipt_id !== contentId(ISSUED_ALLOCATION_RECEIPT_SCHEMA, body)) fail('ISSUED_IDENTITY_ALLOCATION_REQUIRED', 'Issued allocation receipt identity is stale.');
  return Object.freeze({ ...receipt });
}

function validateIssuedReviewedProductionDealBridge(bridge) {
  const keys = ['bridge_root_id', 'issued_bridge_id', 'packet_id', 'production_deal_id', 'schema_version', 'status'];
  if (!exactKeys(bridge, keys) || bridge.schema_version !== ISSUED_PRODUCTION_BRIDGE_SCHEMA || bridge.status !== 'ISSUED') fail('ISSUED_PRODUCTION_IDENTITY_BRIDGE_REQUIRED', 'Issued reviewed production-deal bridge is required.');
  [bridge.bridge_root_id, bridge.packet_id].forEach((value) => digest(value, 'issued bridge binding'));
  if (typeof bridge.production_deal_id !== 'string' || !bridge.production_deal_id) fail('ISSUED_PRODUCTION_IDENTITY_BRIDGE_REQUIRED', 'Issued bridge must bind one production deal.');
  const { issued_bridge_id: ignored, ...body } = bridge;
  if (bridge.issued_bridge_id !== contentId(ISSUED_PRODUCTION_BRIDGE_SCHEMA, body)) fail('ISSUED_PRODUCTION_IDENTITY_BRIDGE_REQUIRED', 'Issued bridge identity is stale.');
  return Object.freeze({ ...bridge });
}

function requireIssuedIdentityConsumerEvidence({ allocation_receipt, reviewed_bridge, production_deal_id, governed_deal_key, manifest_id } = {}) {
  const allocation = validateIssuedAllocationPersistenceReceipt(allocation_receipt);
  const bridge = validateIssuedReviewedProductionDealBridge(reviewed_bridge);
  if (bridge.production_deal_id !== production_deal_id || allocation.governed_deal_key !== governed_deal_key || allocation.manifest_id !== manifest_id) {
    fail('ISSUED_IDENTITY_CONSUMER_BINDING_MISMATCH', 'Issued allocation and bridge evidence must bind the exact production deal, governed key, and V2 manifest.');
  }
  fail('ISSUED_IDENTITY_VERIFIER_UNAVAILABLE', 'No production verifier exists for controller-issued allocation and reviewed bridge evidence.');
  return Object.freeze({ allocation, bridge });
}

module.exports = { ALLOCATION_RECEIPT_SCHEMA, PRODUCTION_BRIDGE_SCHEMA, ISSUED_ALLOCATION_RECEIPT_SCHEMA, ISSUED_PRODUCTION_BRIDGE_SCHEMA, NOT_ISSUED, DealIdentityAllocationReadinessError, buildAllocationPersistenceReceiptProposal, validateAllocationPersistenceReceiptProposal, buildReviewedProductionDealBridgeProposal, validateReviewedProductionDealBridgeProposal, validateIssuedAllocationPersistenceReceipt, validateIssuedReviewedProductionDealBridge, requireIssuedIdentityConsumerEvidence };
