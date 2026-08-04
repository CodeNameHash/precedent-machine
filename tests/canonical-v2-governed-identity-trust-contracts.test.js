'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const identity = require('../lib/canonical-v2/governed-identity-trust-contracts');

const ROOT = path.resolve(__dirname, '..');
const digest = (value) => value.toString(16).padStart(64, '0');
const tx = (index) => digest(index + 1);
const seed = (index) => digest(1000 + index);

function fixture() {
  const amendment = identity.buildFrozenKeyRegistryAmendmentProposal({ base_key_registry_root_id: digest(1), pending_ben_ruling_id: digest(2) });
  const namespaceRequest = identity.buildNamespaceApprovalRequest({ namespace_value: 'EXTERNALLY_RATIFIED_NAMESPACE/V3', pending_ben_ruling_id: digest(3), request_nonce: 'namespace-request-0001' });
  const namespaceBinding = identity.bindExternallyRatifiedNamespace({ namespace_approval_request: namespaceRequest, external_ruling_id: digest(4) });
  const mappingSeedRoot = digest(5); const occurrenceRoot = digest(6);
  const proofs = Array.from({ length: 40 }, (_, index) => identity.buildSerialisableCasProof({
    transaction_id: tx(index), mapping_seed_root_id: mappingSeedRoot, nonce_registry_predecessor_id: digest(100 + index),
    slot_predecessor_id: digest(200 + index), serialisable_isolation_root_id: digest(300 + index), expected_slot_version: index, expected_nonce_version: index,
  }));
  const receipts = proofs.map((proof, index) => identity.buildAllocationReceipt({
    namespace_binding: namespaceBinding, namespace_approval_request: namespaceRequest, cas_proof: proof,
    seed_digest: seed(index), allocation_nonce: `allocation-nonce-${String(index).padStart(4, '0')}`,
  }));
  const dealMappings = receipts.map((receipt, index) => ({
    transaction_id: receipt.transaction_id, production_deal_id: `production-deal-${String(index).padStart(2, '0')}`,
    seed_digest: seed(index), governed_deal_key: receipt.governed_deal_key, manifest_id: receipt.manifest_id,
    allocation_receipt_id: receipt.allocation_receipt_id,
  }));
  const occurrenceMappings = receipts.map((receipt, index) => ({ occurrence_id: `OCCURRENCE/${String(index).padStart(2, '0')}`, transaction_id: receipt.transaction_id }));
  occurrenceMappings.push({ occurrence_id: identity.TOPBUILD_SECOND_OCCURRENCE_ID, transaction_id: receipts[39].transaction_id });
  const mappingSet = identity.buildMappingSet({
    namespace_binding: namespaceBinding, namespace_approval_request: namespaceRequest, mapping_seed_root_id: mappingSeedRoot,
    source_occurrence_root_id: occurrenceRoot, deal_mappings: dealMappings, occurrence_mappings: occurrenceMappings,
  });
  const approvalAttestationRequests = receipts.map((receipt) => identity.buildApprovalAttestationSigningRequest({
    transaction_id: receipt.transaction_id, seed_digest: receipt.seed_digest, governed_deal_key: receipt.governed_deal_key,
    manifest_id: receipt.manifest_id, allocation_receipt_id: receipt.allocation_receipt_id,
  }));
  const mappingApproval = identity.buildBenMappingApprovalRequest({ mapping_set: mappingSet, namespace_binding: namespaceBinding, namespace_approval_request: namespaceRequest, review_root_id: digest(7) });
  const bridge = identity.buildReviewedBridge({ mapping_set: mappingSet, mapping_approval_request: mappingApproval, namespace_approval_request: namespaceRequest });
  const bundle = identity.buildAuthorityBundle({
    frozen_key_registry_amendment: amendment, namespace_approval_request: namespaceRequest, namespace_binding: namespaceBinding,
    cas_proofs: proofs, allocation_receipts: receipts, approval_attestation_requests: approvalAttestationRequests,
    mapping_set: mappingSet, ben_mapping_approval_request: mappingApproval, bridge,
  });
  return { amendment, namespaceRequest, namespaceBinding, proofs, receipts, approvalAttestationRequests, mappingSet, mappingApproval, bridge, bundle };
}

test('builds only a complete blocked 40-deal/41-occurrence identity authority bundle', () => {
  const value = fixture();
  assert.equal(value.mappingSet.deal_mappings.length, 40);
  assert.equal(value.mappingSet.occurrence_mappings.length, 41);
  assert.equal(value.approvalAttestationRequests.length, 40);
  assert.equal(value.bundle.state, identity.NOT_ISSUED);
  assert.ok(value.bundle.blocker_codes.includes(identity.NAMESPACE_RATIFICATION_BLOCKER));
  assert.deepEqual(identity.validateAuthorityBundle(value.bundle), value.bundle);
});

test('keeps the exact least-privilege registry grant set proposal-only', () => {
  const value = fixture();
  assert.equal(value.amendment.authority, 'NONE');
  assert.equal(value.amendment.private_key_material, null);
  assert.equal(value.amendment.issuance_authority, 'NONE');
  assert.equal(value.amendment.registry_activation_authority, 'NONE');
  assert.equal(value.amendment.signing_authority, 'NONE');
  assert.deepEqual(value.amendment.role_domain_grants.map((grant) => grant.role), [
    'BEN_APPROVER', 'IDENTITY_ALLOCATION_CONTROLLER', 'IDENTITY_BRIDGE_ISSUER',
    'V1_CAPTURE_CONTROLLER', 'V1_FINAL_VALIDATOR', 'V1_REPLAY_CONTROLLER',
  ]);
  const missing = structuredClone(value.amendment); missing.role_domain_grants.pop();
  assert.throws(() => identity.validateFrozenKeyRegistryAmendmentProposal(missing), (error) => error.code === 'IDENTITY_KEY_REGISTRY_AMENDMENT_INVALID');
  const overreach = structuredClone(value.amendment); overreach.role_domain_grants[0].permitted_domain = 'ALL_DOMAINS';
  assert.throws(() => identity.validateFrozenKeyRegistryAmendmentProposal(overreach), (error) => error.code === 'IDENTITY_KEY_REGISTRY_AMENDMENT_INVALID');
});

test('rejects positional zips and the missing TopBuild second occurrence', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/governed-identity-trust-contracts.js'), 'utf8');
  assert.match(source, /receipt\.seed_digest !== row\.seed_digest/);
  const value = fixture();
  const swapped = structuredClone(value.bundle);
  [swapped.mapping_set.deal_mappings[0].allocation_receipt_id, swapped.mapping_set.deal_mappings[1].allocation_receipt_id] = [swapped.mapping_set.deal_mappings[1].allocation_receipt_id, swapped.mapping_set.deal_mappings[0].allocation_receipt_id];
  const { mapping_set_id: ignoredMappingSetId, ...mappingSetBody } = swapped.mapping_set;
  swapped.mapping_set.mapping_set_id = contentId(identity.MAPPING_SET_SCHEMA, mappingSetBody);
  swapped.ben_mapping_approval_request.mapping_set_id = swapped.mapping_set.mapping_set_id;
  const { approval_request_id: ignoredApprovalId, namespace_binding: binding, ...approvalBody } = swapped.ben_mapping_approval_request;
  swapped.ben_mapping_approval_request.approval_request_id = contentId(identity.BEN_MAPPING_APPROVAL_REQUEST_SCHEMA, { ...approvalBody, namespace_binding_id: binding.namespace_binding_id });
  swapped.bridge.mapping_set_id = swapped.mapping_set.mapping_set_id;
  swapped.bridge.mapping_approval_request_id = swapped.ben_mapping_approval_request.approval_request_id;
  const { bridge_id: ignoredBridgeId, ...bridgeBody } = swapped.bridge;
  swapped.bridge.bridge_id = contentId(identity.REVIEWED_BRIDGE_SCHEMA, bridgeBody);
  const { authority_bundle_id: ignoredBundleId, ...bundleBody } = swapped;
  swapped.authority_bundle_id = contentId(identity.AUTHORITY_BUNDLE_SCHEMA, bundleBody);
  assert.throws(() => identity.validateAuthorityBundle(swapped), (error) => error.code === 'IDENTITY_AUTHORITY_BUNDLE_POSITIONAL_ZIP_FORBIDDEN');
  const absent = structuredClone(value.mappingSet);
  const row = absent.occurrence_mappings.find((entry) => entry.occurrence_id === identity.TOPBUILD_SECOND_OCCURRENCE_ID);
  row.occurrence_id = 'OCCURRENCE/REPLACEMENT';
  assert.throws(() => identity.validateMappingSet(absent, { namespace_binding: value.namespaceBinding, namespace_approval_request: value.namespaceRequest }), (error) => error.code === 'IDENTITY_TOPBUILD_SECOND_OCCURRENCE_MISSING');
});

test('rejects swapped approval attestations and self-issued approval signatures', () => {
  const value = fixture();
  const reordered = structuredClone(value.bundle);
  reordered.approval_attestation_requests.reverse();
  const { authority_bundle_id: ignoredReorderedBundleId, ...reorderedBody } = reordered;
  reordered.authority_bundle_id = contentId(identity.AUTHORITY_BUNDLE_SCHEMA, reorderedBody);
  assert.deepEqual(identity.validateAuthorityBundle(reordered), reordered);

  const swapped = structuredClone(value.bundle);
  [swapped.approval_attestation_requests[0].allocation_receipt_id, swapped.approval_attestation_requests[1].allocation_receipt_id] = [
    swapped.approval_attestation_requests[1].allocation_receipt_id, swapped.approval_attestation_requests[0].allocation_receipt_id,
  ];
  for (const request of swapped.approval_attestation_requests) {
    const { approval_attestation_request_id: ignored, ...body } = request;
    request.approval_attestation_request_id = contentId(identity.APPROVAL_ATTESTATION_REQUEST_SCHEMA, body);
  }
  const { authority_bundle_id: ignoredBundleId, ...swappedBody } = swapped;
  swapped.authority_bundle_id = contentId(identity.AUTHORITY_BUNDLE_SCHEMA, swappedBody);
  assert.throws(() => identity.validateAuthorityBundle(swapped), (error) => error.code === 'IDENTITY_APPROVAL_ATTESTATION_EXPLICIT_JOIN_REQUIRED');

  const selfIssued = structuredClone(value.bundle);
  selfIssued.approval_attestation_requests[0].signature = 'self-issued-signature';
  const { approval_attestation_request_id: ignoredRequestId, ...requestBody } = selfIssued.approval_attestation_requests[0];
  selfIssued.approval_attestation_requests[0].approval_attestation_request_id = contentId(identity.APPROVAL_ATTESTATION_REQUEST_SCHEMA, requestBody);
  const { authority_bundle_id: ignoredSelfIssuedBundleId, ...selfIssuedBody } = selfIssued;
  selfIssued.authority_bundle_id = contentId(identity.AUTHORITY_BUNDLE_SCHEMA, selfIssuedBody);
  assert.throws(() => identity.validateAuthorityBundle(selfIssued), (error) => error.code === 'IDENTITY_APPROVAL_ATTESTATION_REQUEST_INVALID');
});

test('rejects duplicate transaction, production deal, key, manifest, and receipt bindings', () => {
  const value = fixture();
  for (const key of ['transaction_id', 'production_deal_id', 'governed_deal_key', 'manifest_id', 'allocation_receipt_id']) {
    const changed = structuredClone(value.mappingSet);
    changed.deal_mappings[1][key] = changed.deal_mappings[0][key];
    assert.throws(() => identity.validateMappingSet(changed, { namespace_binding: value.namespaceBinding, namespace_approval_request: value.namespaceRequest }), undefined, key);
  }
});

test('rejects a wrong seed remap, self-hashed issuance claim, and incomplete mapping cohort', () => {
  const value = fixture();
  const remap = structuredClone(value.mappingSet); remap.deal_mappings[1].seed_digest = remap.deal_mappings[0].seed_digest;
  assert.throws(() => identity.validateMappingSet(remap, { namespace_binding: value.namespaceBinding, namespace_approval_request: value.namespaceRequest }), (error) => error.code === 'IDENTITY_MAPPING_SEED_REMAP_INVALID');
  const selfIssued = structuredClone(value.receipts[0]); selfIssued.issuance_state = 'ISSUED'; selfIssued.status = 'ISSUED';
  const { allocation_receipt_id: ignored, ...receiptBody } = selfIssued;
  selfIssued.allocation_receipt_id = contentId(identity.SIGNED_ALLOCATION_RECEIPT_SCHEMA, receiptBody);
  assert.throws(() => identity.validateAllocationReceipt(selfIssued, { namespace_binding: value.namespaceBinding, namespace_approval_request: value.namespaceRequest, cas_proof: value.proofs[0] }), (error) => error.code === 'IDENTITY_ALLOCATION_RECEIPT_ISSUANCE_FORBIDDEN');
  const incomplete = structuredClone(value.mappingSet); incomplete.deal_mappings.pop();
  assert.throws(() => identity.validateMappingSet(incomplete, { namespace_binding: value.namespaceBinding, namespace_approval_request: value.namespaceRequest }), (error) => error.code === 'IDENTITY_MAPPING_DEAL_COUNT_INVALID');
});

test('derives replacement supersession mode from an explicit unique predecessor set', () => {
  const value = fixture();
  const replacement = identity.buildMappingSet({
    namespace_binding: value.namespaceBinding, namespace_approval_request: value.namespaceRequest,
    mapping_seed_root_id: value.mappingSet.mapping_seed_root_id, source_occurrence_root_id: value.mappingSet.source_occurrence_root_id,
    deal_mappings: value.mappingSet.deal_mappings, occurrence_mappings: value.mappingSet.occurrence_mappings,
    supersedes_mapping_set_ids: [digest(900)],
  });
  assert.equal(replacement.supersession_mode, 'REPLACEMENT_REVIEW_REQUIRED');
  const invalid = structuredClone(replacement); invalid.supersession_mode = 'GENESIS';
  assert.throws(() => identity.validateMappingSet(invalid, { namespace_binding: value.namespaceBinding, namespace_approval_request: value.namespaceRequest }), (error) => error.code === 'IDENTITY_SUPERSESSION_INVALID');
});

test('blocks signature verification, current-head verification, issuance, and consumer brands pending registry amendment and persistence', () => {
  for (const action of [identity.verifyAllocationReceiptSignature, identity.verifyCurrentIdentityHead, identity.issueAllocationReceipt, identity.createIdentityConsumerBrand]) {
    assert.throws(() => action(), (error) => error.code === identity.REGISTRY_AND_PERSISTENCE_BLOCKER);
  }
});

test('has no signature verifier, issuer, persistence writer, or consumer-brand creation path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/governed-identity-trust-contracts.js'), 'utf8');
  assert.doesNotMatch(source, /verifySignature|writeFile|mkdir|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|UPDATE\s+|DELETE\s+|createPrivateKey|crypto\.sign/i);
});
