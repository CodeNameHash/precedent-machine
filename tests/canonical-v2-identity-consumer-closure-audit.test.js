'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA,
  buildFrozenExternalIssuerRegistry,
  buildGovernedIdentityProposalPacket,
  validateV2DealIdentityAuthorityEvidence,
} = require('../lib/canonical-v2/governed-identity-proposal-packet');
const {
  buildAllocationPersistenceReceiptProposal,
  requireIssuedIdentityConsumerEvidence,
} = require('../lib/canonical-v2/deal-identity-allocation-readiness');
const { validateV2SourceBindingIdentityEvidence } = require('../lib/canonical-v2/deal-source-binding');
const { buildSourceUniverseInventoryCandidate, validateV2DealIdentityEvidenceSet } = require('../lib/canonical-v2/source-universe-inventory-candidate');
const { buildSourceUniverseInventory } = require('../lib/canonical-v2/source-universe-inventory-planner');
const { makeCohort } = require('./helpers/canonical-v2-source-intake-fixture');
const {
  V1_PROVISION_SNAPSHOT_SCHEMA,
  V1V2_COMPARISON_DIAGNOSTIC_SCHEMA,
  buildV1V2ComparisonDiagnostic,
  buildV1V2ComparisonReceipt,
} = require('../lib/canonical-v2/native-producer/v1v2-comparator');
const {
  IDENTITY_BOUNDARY_SYMBOLS,
  PUBLIC_ENTRY_PATHS,
  discoverIdentityConsumerReferences,
  buildIdentityConsumerClosureAudit,
  validateIdentityConsumerClosureAudit,
} = require('../lib/canonical-v2/identity-consumer-closure-audit');

const ROOT = path.resolve(__dirname, '..');
const DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
const digest = (value) => sha256Hex(Buffer.from(value, 'utf8'));

function selfHashedExternalIdentityEvidence(productionDealId = DEAL_ID) {
  const seed = {
    kind: 'REGISTERED_EXTERNAL_TRANSACTION',
    issuer_namespace_key: 'CLOSURE_AUDIT_FROZEN_ISSUER',
    issuer_namespace_version: 'V1',
    issuer_immutable_transaction_identifier: `opaque-${productionDealId}`,
  };
  const registry = buildFrozenExternalIssuerRegistry({
    issuer_registry_version: 'CLOSURE_AUDIT_FROZEN_ISSUER_REGISTRY/V1',
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
  const manifest = buildGovernedIdentityProposalPacket({
    immutable_deal_seed: seed,
    frozen_external_issuer_registry: registry,
    registered_external_transaction_authority: {
      ...authorityBody,
      registered_external_transaction_authority_id: contentId(EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA, authorityBody),
      registered_external_transaction_authority_payload_digest: contentId('REGISTERED_EXTERNAL_TRANSACTION_AUTHORITY_PAYLOAD/V2', authorityBody),
    },
  });
  const allocationBody = {
    schema_version: 'DEAL_IDENTITY_ALLOCATION_PERSISTENCE_RECEIPT_ISSUED/V1',
    status: 'ISSUED',
    bridge_eligible: true,
    allocation_persistence_receipt_id: digest(`allocation:${productionDealId}`),
    governed_deal_key: manifest.governed_deal_key,
    manifest_id: manifest.deal_identity_manifest_id,
    serialisable_persistence_receipt_id: digest(`persistence:${productionDealId}`),
  };
  const bridgeBody = {
    schema_version: 'REVIEWED_PRODUCTION_DEAL_IDENTITY_BRIDGE_ISSUED/V1',
    status: 'ISSUED',
    bridge_root_id: digest(`bridge-root:${productionDealId}`),
    packet_id: digest(`packet:${productionDealId}`),
    production_deal_id: productionDealId,
  };
  return {
    production_deal_id: productionDealId,
    deal_identity_manifest: manifest,
    approval_signing_request: null,
    approval_signature_evidence: null,
    issued_allocation_receipt: {
      ...allocationBody,
      issued_allocation_receipt_id: contentId('DEAL_IDENTITY_ALLOCATION_PERSISTENCE_RECEIPT_ISSUED/V1', allocationBody),
    },
    issued_reviewed_bridge: {
      ...bridgeBody,
      issued_bridge_id: contentId('REVIEWED_PRODUCTION_DEAL_IDENTITY_BRIDGE_ISSUED/V1', bridgeBody),
    },
  };
}

function comparisonSnapshot(identityEvidence = null) {
  const body = {
    schema_version: V1_PROVISION_SNAPSHOT_SCHEMA,
    deal_identity_bridge: {
      production_deal_id: DEAL_ID,
      governed_deal_key: identityEvidence?.deal_identity_manifest?.governed_deal_key || 'diagnostic-only-key',
    },
    ...(identityEvidence ? {
      snapshot_identity_evidence: {
        manifest_id: identityEvidence.deal_identity_manifest.deal_identity_manifest_id,
        issued_allocation_receipt: identityEvidence.issued_allocation_receipt,
        issued_reviewed_bridge: identityEvidence.issued_reviewed_bridge,
      },
    } : {}),
    deal_max_extraction_version: 'v1',
    cards: [{
      id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP',
      section_ref: '3.1(b) | Capitalization', primary_quote: 'quoted text', region_hash: 'region-1', extraction_version: 'v1',
    }],
  };
  return { ...body, snapshot_id: contentId(V1_PROVISION_SNAPSHOT_SCHEMA, body) };
}

function emptyV2Side() {
  return { resolved: [], open_world: [] };
}

test('discovers production consumers from direct boundary references and reports any unclassified file', () => {
  const discovered = discoverIdentityConsumerReferences({ repository_root: ROOT });
  assert.ok(IDENTITY_BOUNDARY_SYMBOLS.every((symbol) => discovered.some((item) => item.referenced_symbols.includes(symbol))), 'each boundary symbol is discovered in production source');
  assert.ok(PUBLIC_ENTRY_PATHS.every((entryPath) => discovered.some((item) => item.consumer_path === entryPath)), 'each public entry is present even when it has no identity input');
  assert.ok(discovered.some((item) => item.consumer_path === 'scripts/nets-eligibility-report.mjs' && item.referenced_symbols.includes('buildV1V2ComparisonReceipt')));

  const audit = buildIdentityConsumerClosureAudit({ repository_root: ROOT });
  assert.deepEqual(validateIdentityConsumerClosureAudit(audit, { repository_root: ROOT }), audit);
  assert.deepEqual(audit.unclassified_identity_consumers, [], 'new direct consumers must be classified before closure can be claimed');
  assert.equal(audit.admission_authority, 'NONE');
  assert.equal(audit.export_authority, 'NONE');
  assert.equal(audit.production_authority, 'NONE');
});

test('negative probes keep every identity boundary closed for missing, proposal-only, and self-hashed evidence', async () => {
  const selfHashed = selfHashedExternalIdentityEvidence();
  const authority = validateV2DealIdentityAuthorityEvidence({
    deal_identity_manifest: selfHashed.deal_identity_manifest,
    approval_signing_request: null,
    approval_signature_evidence: null,
  });
  assert.equal(authority.authority_status, 'VALIDATED_PROPOSAL_ONLY_NOT_ADMISSION_AUTHORITY');
  assert.throws(() => validateV2DealIdentityAuthorityEvidence({}), /manifest|identity/i, 'missing authority evidence rejects');

  const proposalOnlyAllocation = buildAllocationPersistenceReceiptProposal({
    approval_or_frozen_issuer_authority_id: digest('issuer'),
    expected_nonce_registry_version: 0,
    expected_slot_version: 0,
    governed_deal_key: digest('governed'),
    manifest_id: digest('manifest'),
    nonce_registry_predecessor_id: digest('nonce'),
    seed_slot_predecessor_id: digest('slot'),
    serialisable_transaction_isolation_evidence_id: digest('isolation'),
    zero_conflicting_allocation_evidence_id: digest('conflicts'),
  });
  assert.throws(() => requireIssuedIdentityConsumerEvidence({}), /Issued allocation|required/i, 'missing issued evidence rejects');
  assert.throws(() => requireIssuedIdentityConsumerEvidence({ allocation_receipt: proposalOnlyAllocation }), /Issued allocation|required/i, 'proposal-only evidence rejects');
  assert.throws(() => requireIssuedIdentityConsumerEvidence({
    allocation_receipt: selfHashed.issued_allocation_receipt,
    reviewed_bridge: selfHashed.issued_reviewed_bridge,
    production_deal_id: DEAL_ID,
    governed_deal_key: authority.governed_deal_key,
    manifest_id: authority.deal_identity_manifest_id,
  }), { code: 'ISSUED_IDENTITY_VERIFIER_UNAVAILABLE' }, 'self-hashed issued-shaped evidence cannot pass the production gate');

  for (const evidence of [null, { ...selfHashed, issued_allocation_receipt: proposalOnlyAllocation }, selfHashed]) {
    assert.throws(() => validateV2SourceBindingIdentityEvidence(evidence), /identity|issued|verifier/i);
  }
  for (const evidence of [[], [{ ...selfHashed, issued_allocation_receipt: proposalOnlyAllocation }], [selfHashed]]) {
    assert.throws(() => validateV2DealIdentityEvidenceSet(evidence, new Set([DEAL_ID])), /identity|issued|verifier/i);
  }
  const candidateSelfHashed = selfHashedExternalIdentityEvidence('deal-1');
  for (const evidence of [
    [],
    [{ ...candidateSelfHashed, issued_allocation_receipt: proposalOnlyAllocation }],
    [candidateSelfHashed],
  ]) {
    assert.throws(() => buildSourceUniverseInventoryCandidate({
      ...makeCohort({ dealCount: 1 }),
      governed_deal_identity_evidence: evidence,
    }), /identity|issued|verifier/i);
  }

  const exporter = await import(path.join(ROOT, 'scripts/export-v1-provision-snapshot.mjs'));
  const cards = [{ id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP', section_ref: '3.1(b) | Capitalization', primary_quote: 'quoted text', region_hash: 'region-1', extraction_version: 'v1' }];
  for (const evidence of [null, { ...selfHashed, issued_allocation_receipt: proposalOnlyAllocation }, selfHashed]) {
    assert.throws(() => exporter.buildSnapshotForDeal({ dealId: DEAL_ID, deal: { acquirer: 'A', target: 'B' }, cards, dealIdentityEvidence: evidence }), /identity|issued|verifier/i);
  }
  const nets = await import(path.join(ROOT, 'scripts/nets-eligibility-report.mjs'));
  await assert.rejects(() => nets.runTwoPassFlow({}), /snapshot lacks verified issued identity binding/i);

  assert.throws(() => buildV1V2ComparisonReceipt({ v1_snapshot: comparisonSnapshot(), v2_side: emptyV2Side(), attempted_section_scope: ['3.1(b)'] }), /identity/i, 'authoritative comparator rejects a snapshot without identity evidence');
  assert.throws(() => buildV1V2ComparisonReceipt({ v1_snapshot: comparisonSnapshot(selfHashed), v2_side: emptyV2Side(), attempted_section_scope: ['3.1(b)'] }), { code: 'ISSUED_IDENTITY_VERIFIER_UNAVAILABLE' }, 'self-hashed snapshot evidence cannot produce a receipt');
  const diagnostic = buildV1V2ComparisonDiagnostic({ v1_snapshot: comparisonSnapshot(), v2_side: emptyV2Side(), attempted_section_scope: ['3.1(b)'] });
  assert.equal(diagnostic.schema_version, V1V2_COMPARISON_DIAGNOSTIC_SCHEMA);
  assert.equal(diagnostic.authority, 'NONE');

  const planner = buildSourceUniverseInventory({ governed_deal_roster: [{ governed_deal_key: 'raw-key-is-not-an-identity-admission' }], received_source_occurrences: [] });
  assert.equal(planner.blocker_report.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY', 'planner is evidence-only when no reviewed source disposition exists');
  assert.equal(planner.inventory.authority, 'NONE');
  assert.equal(Object.hasOwn(planner.inventory, 'admitted_source_declarations'), false);
});

test('closure audit itself has no export, persistence, database, network or activation path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/identity-consumer-closure-audit.js'), 'utf8');
  assert.doesNotMatch(source, /writeFile|mkdir|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|activate_candidate_release/i);
});
