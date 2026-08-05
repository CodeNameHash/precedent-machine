'use strict';

/**
 * tests/export-v1-provision-snapshot.test.js
 *
 * Unit tests for scripts/export-v1-provision-snapshot.mjs's PURE functions
 * (parseArgs, buildSnapshotSql, buildSnapshotForDeal) -- zero DB, zero
 * network. The one thing this file exists to prove above everything else:
 * the script REFUSES TO RUN without an explicit --deal allowlist (spec
 * Acceptance), checked before any I/O.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA,
  buildFrozenExternalIssuerRegistry,
  buildGovernedIdentityProposalPacket,
  validateV2DealIdentityAuthorityEvidence,
} = require('../lib/canonical-v2/governed-identity-proposal-packet');

let mod;
const DEAL_ID = '7dc3a05f-b170-4d59-a255-b7103cca16e1';

function closedExternalIdentityEvidence(dealId = DEAL_ID) {
  const seed = {
    kind: 'REGISTERED_EXTERNAL_TRANSACTION',
    issuer_namespace_key: 'TEST_FROZEN_ISSUER',
    issuer_namespace_version: 'V1',
    issuer_immutable_transaction_identifier: 'opaque-transaction-1',
  };
  const registry = buildFrozenExternalIssuerRegistry({
    issuer_registry_version: 'TEST_FROZEN_ISSUER_REGISTRY/V1',
    issuers: [{ issuer_namespace_key: seed.issuer_namespace_key, issuer_namespace_version: seed.issuer_namespace_version }],
  });
  const issuer = registry.issuers[0];
  const body = {
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
      ...body,
      registered_external_transaction_authority_id: contentId(EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA, body),
      registered_external_transaction_authority_payload_digest: contentId('REGISTERED_EXTERNAL_TRANSACTION_AUTHORITY_PAYLOAD/V2', body),
    },
  });
  const allocationBody = {
    schema_version: 'DEAL_IDENTITY_ALLOCATION_PERSISTENCE_RECEIPT_ISSUED/V1', status: 'ISSUED', bridge_eligible: true,
    allocation_persistence_receipt_id: contentId('ALLOCATION_PROPOSAL_TEST/V1', { dealId }),
    governed_deal_key: manifest.governed_deal_key, manifest_id: manifest.deal_identity_manifest_id,
    serialisable_persistence_receipt_id: contentId('SERIALISABLE_TEST/V1', { dealId }),
  };
  const issued_allocation_receipt = { ...allocationBody, issued_allocation_receipt_id: contentId('DEAL_IDENTITY_ALLOCATION_PERSISTENCE_RECEIPT_ISSUED/V1', allocationBody) };
  const bridgeBody = {
    schema_version: 'REVIEWED_PRODUCTION_DEAL_IDENTITY_BRIDGE_ISSUED/V1', status: 'ISSUED',
    bridge_root_id: contentId('BRIDGE_ROOT_TEST/V1', { dealId }), packet_id: contentId('PACKET_TEST/V1', { dealId }), production_deal_id: dealId,
  };
  const issued_reviewed_bridge = { ...bridgeBody, issued_bridge_id: contentId('REVIEWED_PRODUCTION_DEAL_IDENTITY_BRIDGE_ISSUED/V1', bridgeBody) };
  return {
    production_deal_id: dealId,
    deal_identity_manifest: manifest,
    approval_signing_request: null,
    approval_signature_evidence: null,
    issued_allocation_receipt,
    issued_reviewed_bridge,
  };
}

test.before(async () => {
  mod = await import(path.join('..', 'scripts', 'export-v1-provision-snapshot.mjs'));
});

test('parseArgs refuses to run without at least one --deal allowlist entry', () => {
  assert.throws(() => mod.parseArgs([]), /Refusing to run.*--deal/);
  assert.throws(() => mod.parseArgs(['--provision-type', 'REPRESENTATION']), /Refusing to run.*--deal/);
});

test('parseArgs requires --deal to be a UUID, not a target-name substring (explicit allowlist, no fuzzy resolution)', () => {
  assert.throws(() => mod.parseArgs(['--deal', 'topbuild']), /must be a UUID/);
  assert.doesNotThrow(() => mod.parseArgs([
    '--deal', DEAL_ID,
    '--deal-identity-evidence', `${DEAL_ID}=closed-v2.json`,
  ]));
});

test('parseArgs accepts multiple --deal entries only when each has a closed V2 identity-evidence path', () => {
  const args = mod.parseArgs([
    '--deal', '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    '--deal', '11111111-2222-3333-4444-555555555555',
    '--deal-identity-evidence', '7dc3a05f-b170-4d59-a255-b7103cca16e1=one.json',
    '--deal-identity-evidence', '11111111-2222-3333-4444-555555555555=two.json',
  ]);
  assert.deepEqual(args.deals, ['7dc3a05f-b170-4d59-a255-b7103cca16e1', '11111111-2222-3333-4444-555555555555']);
  assert.equal(args.dealIdentityEvidencePaths.get('7dc3a05f-b170-4d59-a255-b7103cca16e1'), 'one.json');
  assert.equal(args.provisionType, 'REPRESENTATION');
});

test('parseArgs rejects a missing identity-evidence path and the retired arbitrary key option', () => {
  const deal = '7dc3a05f-b170-4d59-a255-b7103cca16e1';
  assert.throws(() => mod.parseArgs(['--deal', deal]), /without one closed V2/);
  assert.throws(() => mod.parseArgs(['--deal', deal, '--governed-deal-key', `${deal}=${'a'.repeat(64)}`]), /Unknown argument/);
});

test('parseArgs rejects --out combined with more than one --deal', () => {
  assert.throws(() => mod.parseArgs([
    '--deal', '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    '--deal', '11111111-2222-3333-4444-555555555555',
    '--out', 'x.json',
  ]), /--out-dir/);
});

test('buildSnapshotSql is a SELECT-only statement over provision_cards, parameterised on deal_id allowlist + provision_type', () => {
  const { text, values } = mod.buildSnapshotSql({ dealIds: ['a', 'b'], provisionType: 'REPRESENTATION' });
  assert.match(text, /^SELECT/i);
  assert.match(text, /FROM public\.provision_cards/);
  assert.match(text, /WHERE deal_id = ANY\(\$1/);
  assert.deepEqual(values, [['a', 'b'], 'REPRESENTATION']);
  mod.assertReadOnlySql(text); // does not throw
});

test('assertReadOnlySql rejects any write-verb statement', () => {
  assert.throws(() => mod.assertReadOnlySql('DELETE FROM provision_cards'), /read-only/);
  assert.throws(() => mod.assertReadOnlySql('UPDATE provision_cards SET x = 1'), /read-only/);
  assert.throws(() => mod.assertReadOnlySql('INSERT INTO provision_cards VALUES (1)'), /read-only/);
  assert.throws(() => mod.assertReadOnlySql('DROP TABLE provision_cards'), /read-only/);
  assert.doesNotThrow(() => mod.assertReadOnlySql('SELECT * FROM provision_cards'));
});

test('maxExtractionVersion picks the lexicographically last label deterministically (opaque tag, not a numeric ordering)', () => {
  assert.equal(mod.maxExtractionVersion([
    { extraction_version: 'm2-00-corpus-backfill-v1' },
    { extraction_version: 'm2-00-corpus-backfill-v1' },
  ]), 'm2-00-corpus-backfill-v1');
  assert.equal(mod.maxExtractionVersion([
    { extraction_version: 'a' }, { extraction_version: 'z' }, { extraction_version: 'm' },
  ]), 'z');
  assert.equal(mod.maxExtractionVersion([]), null);
});

test('future snapshot identity evidence is an exact content-addressed comparator binding, even though export remains gate-blocked today', () => {
  const evidence = closedExternalIdentityEvidence();
  const authority = validateV2DealIdentityAuthorityEvidence({
    deal_identity_manifest: evidence.deal_identity_manifest,
    approval_signing_request: evidence.approval_signing_request,
    approval_signature_evidence: evidence.approval_signature_evidence,
  });
  const snapshotIdentityEvidence = mod.buildSnapshotIdentityEvidence({ authority, dealIdentityEvidence: evidence });
  assert.equal(snapshotIdentityEvidence.manifest_id, authority.deal_identity_manifest_id);
  assert.deepEqual(snapshotIdentityEvidence.issued_allocation_receipt, evidence.issued_allocation_receipt);
  assert.deepEqual(snapshotIdentityEvidence.issued_reviewed_bridge, evidence.issued_reviewed_bridge);

  const snapshotBody = {
    schema_version: 'V1_PROVISION_SNAPSHOT/V1',
    deal_identity_bridge: { production_deal_id: DEAL_ID, governed_deal_key: authority.governed_deal_key },
    snapshot_identity_evidence: snapshotIdentityEvidence,
    deal_max_extraction_version: 'v1',
    cards: [],
    deal: { acquirer: 'A', target: 'B' },
  };
  assert.notEqual(
    contentId('V1_PROVISION_SNAPSHOT/V1', snapshotBody),
    contentId('V1_PROVISION_SNAPSHOT/V1', {
      ...snapshotBody,
      snapshot_identity_evidence: {
        ...snapshotIdentityEvidence,
        issued_reviewed_bridge: { ...snapshotIdentityEvidence.issued_reviewed_bridge, packet_id: 'mutated' },
      },
    }),
    'identity evidence is inside the snapshot content identity',
  );
  assert.throws(() => mod.buildSnapshotForDeal({
    dealId: DEAL_ID, deal: { acquirer: 'A', target: 'B' }, cards: [{ id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP', section_ref: '3.1(b) | Cap', primary_quote: 'q', region_hash: 'h', extraction_version: 'v1' }], dealIdentityEvidence: evidence,
  }), /No production verifier exists/, 'the common gate still prevents snapshot issuance');
});

test('buildSnapshotForDeal remains blocked until an independently verifiable issued identity controller exists', () => {
  const cards = [
    { id: 'card-2', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-ORG', section_ref: '3.1(a) | Org | x', primary_quote: 'q2', region_hash: 'h2', extraction_version: 'v1' },
    { id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP', section_ref: '3.1(b) | Cap | x', primary_quote: 'q1', region_hash: 'h1', extraction_version: 'v1' },
  ];
  const dealIdentityEvidence = closedExternalIdentityEvidence();
  assert.throws(() => mod.buildSnapshotForDeal({
    dealId: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    deal: { acquirer: 'QXO, Inc.', target: 'TopBuild Corp.' },
    cards,
    dealIdentityEvidence,
  }), /No production verifier exists/);
});

test('buildSnapshotForDeal refuses arbitrary key-like values and unvalidated identity inputs', () => {
  const cards = [{ id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP', section_ref: '3.1(b) | Cap | x', primary_quote: 'q1', region_hash: 'h1', extraction_version: 'v1' }];
  for (const dealIdentityEvidence of [null, 'a'.repeat(64), { production_deal_id: DEAL_ID, governed_deal_key: 'a'.repeat(64) }]) {
    assert.throws(() => mod.buildSnapshotForDeal({
      dealId: DEAL_ID, deal: { acquirer: 'A', target: 'B' }, cards, dealIdentityEvidence,
    }), /requires a closed V2 identity evidence/);
  }
});

test('buildSnapshotForDeal rejects proposal-only identity evidence without both issued bindings', () => {
  const cards = [{ id: 'card-1', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-CAP', section_ref: '3.1(b) | Cap', primary_quote: 'q', region_hash: 'h', extraction_version: 'v1' }];
  const evidence = closedExternalIdentityEvidence();
  delete evidence.issued_allocation_receipt;
  assert.throws(() => mod.buildSnapshotForDeal({ dealId: DEAL_ID, deal: { acquirer: 'A', target: 'B' }, cards, dealIdentityEvidence: evidence }), /closed V2 identity evidence|issued/i);
});

test('buildSnapshotForDeal refuses a deal with zero cards rather than emitting an empty, misleading snapshot', () => {
  assert.throws(() => mod.buildSnapshotForDeal({
    dealId: DEAL_ID, deal: { acquirer: 'A', target: 'B' }, cards: [], dealIdentityEvidence: closedExternalIdentityEvidence(),
  }), /No provision_cards found/);
});
