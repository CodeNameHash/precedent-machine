'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA,
  buildFrozenExternalIssuerRegistry,
  buildGovernedIdentityProposalPacket,
} = require('../lib/canonical-v2/governed-identity-proposal-packet');
const {
  buildSourceUniverseInventoryCandidate,
  SourceUniverseInventoryCandidateError,
} = require('../lib/canonical-v2/source-universe-inventory-candidate');
const { makeCohort } = require('./helpers/canonical-v2-source-intake-fixture');

function externalIdentityEvidence(productionDealId = 'deal-1') {
  const seed = {
    kind: 'REGISTERED_EXTERNAL_TRANSACTION',
    issuer_namespace_key: 'TEST_FROZEN_TRANSACTION_REGISTRY',
    issuer_namespace_version: 'V1',
    issuer_immutable_transaction_identifier: `OPAQUE-${productionDealId}`,
  };
  const registry = buildFrozenExternalIssuerRegistry({
    issuer_registry_version: 'TEST_FROZEN_ISSUER_REGISTRY/V1',
    issuers: [{ issuer_namespace_key: seed.issuer_namespace_key, issuer_namespace_version: seed.issuer_namespace_version }],
  });
  const issuer = registry.issuers[0];
  const authorityBody = {
    schema_version: EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA,
    external_issuer_registry_id: registry.external_issuer_registry_id,
    issuer_namespace_key: seed.issuer_namespace_key,
    issuer_namespace_version: seed.issuer_namespace_version,
    issuer_registration_id: issuer.issuer_registration_id,
    issuer_registration_payload_digest: issuer.issuer_registration_payload_digest,
  };
  const authority = {
    ...authorityBody,
    registered_external_transaction_authority_id: contentId(EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA, authorityBody),
    registered_external_transaction_authority_payload_digest: contentId('REGISTERED_EXTERNAL_TRANSACTION_AUTHORITY_PAYLOAD/V2', authorityBody),
  };
  const manifest = buildGovernedIdentityProposalPacket({
    immutable_deal_seed: seed,
    frozen_external_issuer_registry: registry,
    registered_external_transaction_authority: authority,
  });
  const allocationBody = { schema_version: 'DEAL_IDENTITY_ALLOCATION_PERSISTENCE_RECEIPT_ISSUED/V1', status: 'ISSUED', bridge_eligible: true, allocation_persistence_receipt_id: contentId('TEST_ALLOCATION/V1', { productionDealId }), governed_deal_key: manifest.governed_deal_key, manifest_id: manifest.deal_identity_manifest_id, serialisable_persistence_receipt_id: contentId('TEST_SERIALISABLE/V1', { productionDealId }) };
  const bridgeBody = { schema_version: 'REVIEWED_PRODUCTION_DEAL_IDENTITY_BRIDGE_ISSUED/V1', status: 'ISSUED', bridge_root_id: contentId('TEST_BRIDGE_ROOT/V1', { productionDealId }), packet_id: contentId('TEST_PACKET/V1', { productionDealId }), production_deal_id: productionDealId };
  return {
    production_deal_id: productionDealId,
    deal_identity_manifest: manifest,
    approval_signing_request: null,
    approval_signature_evidence: null,
    issued_allocation_receipt: { ...allocationBody, issued_allocation_receipt_id: contentId('DEAL_IDENTITY_ALLOCATION_PERSISTENCE_RECEIPT_ISSUED/V1', allocationBody) },
    issued_reviewed_bridge: { ...bridgeBody, issued_bridge_id: contentId('REVIEWED_PRODUCTION_DEAL_IDENTITY_BRIDGE_ISSUED/V1', bridgeBody) },
  };
}

function fixture() {
  return {
    ...makeCohort({ dealCount: 1 }),
    governed_deal_identity_evidence: [externalIdentityEvidence()],
  };
}

test('cannot create a source-universe execution candidate while issued identity evidence lacks a real verifier', () => {
  assert.throws(() => buildSourceUniverseInventoryCandidate(fixture()), { code: 'ISSUED_IDENTITY_VERIFIER_UNAVAILABLE' });
});

test('fails closed for missing or extra receipts, a duplicate URL, an admission field, arbitrary V1 bridge data, or invalid V2 identity evidence', () => {
  const mutations = [
    (input) => input.receipt_records.pop(),
    (input) => input.receipt_records.push(structuredClone(input.receipt_records[0])),
    (input) => { input.receipt_records[0].receipt.source_admission_status = 'ADMITTED'; },
    (input) => { input.governed_deal_identity_evidence = []; },
    (input) => { input.governed_deal_bridge = [{ production_deal_id: 'deal-1', governed_deal_key: 'deal:invented', bridge_evidence_digest: '0'.repeat(64) }]; delete input.governed_deal_identity_evidence; },
    (input) => { input.governed_deal_identity_evidence[0].deal_identity_manifest.schema_version = 'GOVERNED_DEAL_IDENTITY_MANIFEST/V1'; },
    (input) => { input.governed_deal_identity_evidence[0].approval_signature_evidence = { verification_status: 'EXTERNAL_SIGNATURE_VERIFIED' }; },
  ];
  for (const mutate of mutations) {
    const input = structuredClone(fixture());
    mutate(input);
    assert.throws(() => buildSourceUniverseInventoryCandidate(input), SourceUniverseInventoryCandidateError);
  }
});
