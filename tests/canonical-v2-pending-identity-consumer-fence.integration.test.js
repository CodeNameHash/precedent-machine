'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  INITIAL_IMPORT_COUNT,
  buildInitialImportProposalPacket,
  validateV2DealIdentityAuthorityEvidence,
} = require('../lib/canonical-v2/governed-identity-proposal-packet');
const {
  buildDealIdentityTrustedKeyRegistryPatchProposal,
} = require('../lib/canonical-v2/deal-identity-trusted-key-registry-proposal');
const {
  buildRoutinePrimaryDispositionProposal,
} = require('../lib/canonical-v2/routine-primary-source-disposition-policy');
const {
  buildSourceIntakeReadiness,
} = require('../lib/canonical-v2/source-intake-readiness');
const {
  buildSourceUniverseInventoryCandidate,
} = require('../lib/canonical-v2/source-universe-inventory-candidate');
const {
  buildTopBuildOrdinaryMultiOccurrenceDispositionPacket,
} = require('../lib/canonical-v2/topbuild-ordinary-multi-occurrence-disposition-packet');
const { makeCohort } = require('./helpers/canonical-v2-source-intake-fixture');

const ROOT = path.resolve(__dirname, '..');
const id = (value) => sha256Hex(value);

function topBuildPacket(cohort) {
  return buildTopBuildOrdinaryMultiOccurrenceDispositionPacket({
    ...cohort,
    primary_occurrence_id: 'METADATA/deal-1',
    legal_findings: {
      same_executed_agreement: true,
      matched_section_count: 62,
      total_section_count: 63,
      redaction_delta: { section_reference: '7.7', redacted_item_count: 2, redaction_kind: 'EMAIL_ADDRESS_ONLY' },
      unredacted_occurrence_id: 'METADATA/deal-1',
      redacted_occurrence_id: 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE',
    },
  });
}

test('pending forty-row identity proposal cannot become identity, source admission, execution input, database authority, or production authority through any current consumer', async () => {
  const pendingPacket = buildInitialImportProposalPacket({ initial_import_source_inventory_digest: id('current-forty-row-inventory') });
  assert.equal(pendingPacket.status, 'PENDING_NAMESPACE_AND_KEY_DOMAIN_RATIFICATION');
  assert.equal(pendingPacket.rows.length, INITIAL_IMPORT_COUNT);
  assert.equal(pendingPacket.admission_authority, 'NONE');
  assert.equal(pendingPacket.source_admission_authority, 'NONE');
  assert.equal(pendingPacket.deal_admission_authority, 'NONE');

  const keyExtension = buildDealIdentityTrustedKeyRegistryPatchProposal({
    base_trusted_key_registry_digest: id('active-registry'),
    pending_ben_ruling_id: id('pending-domain-ruling'),
  });
  assert.equal(keyExtension.state, 'FROZEN_PROPOSAL_PENDING_REGISTRY_AMENDMENT');
  assert.equal(keyExtension.registry_activation_authority, 'NONE');
  assert.equal(keyExtension.signing_authority, 'NONE');
  assert.throws(() => validateV2DealIdentityAuthorityEvidence({ deal_identity_manifest: pendingPacket }), {
    code: 'IDENTITY_MANIFEST_INVALID',
  });

  const cohort = makeCohort({ dealCount: 40 });
  const ordinaryPacket = topBuildPacket(cohort);
  assert.equal(ordinaryPacket.status, 'NOT_ISSUED');
  assert.deepEqual(ordinaryPacket.execution_sources, []);
  assert.equal(ordinaryPacket.admission_authority, 'NOT_ADMISSION_AUTHORITY');

  const readiness = buildSourceIntakeReadiness({
    ...cohort,
    governed_deal_identity_authority: pendingPacket,
    routine_primary_policy: buildRoutinePrimaryDispositionProposal(cohort),
    topbuild_disposition_packet: ordinaryPacket,
    ordinary_reviewed_dispositions: [],
  });
  assert.equal(readiness.status, 'BLOCKED');
  assert.deepEqual(readiness.blockers, [
    'PENDING_INITIAL_IMPORT_PACKET_NOT_IDENTITY_AUTHORITY',
    'UNISSUED_DEAL_IDENTITIES',
    'SOURCE_INTAKE_TRUSTED_CONTROLLER_AND_REGISTRY_VERIFIER_REQUIRED',
    'ROUTINE_PRIMARY_POLICY_NOT_ADOPTED',
    'TOPBUILD_MULTI_OCCURRENCE_DISPOSITION_NOT_ISSUED',
  ]);
  assert.equal(readiness.source_intake_authority.authority, 'NONE');
  assert.deepEqual(readiness.execution_sources, []);
  assert.equal(readiness.admission_authority, 'NOT_ADMISSION_AUTHORITY');
  assert.equal(readiness.source_admission_status, 'NOT_ATTEMPTED');
  assert.equal(readiness.deal_admission_status, 'NOT_ATTEMPTED');

  assert.throws(() => buildSourceUniverseInventoryCandidate({
    ...cohort,
    governed_deal_identity_evidence: [pendingPacket],
  }), { code: 'INVALID_V2_GOVERNED_DEAL_IDENTITY_EVIDENCE' });

  const snapshot = await import(path.join(ROOT, 'scripts/export-v1-provision-snapshot.mjs'));
  assert.throws(() => snapshot.buildSnapshotForDeal({
    dealId: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    deal: { acquirer: 'A', target: 'B' },
    cards: [{ id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP', section_ref: '3.1', primary_quote: 'q', region_hash: 'h', extraction_version: 'v1' }],
    dealIdentityEvidence: pendingPacket,
  }), /requires a closed V2 identity evidence/);
});
