'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { signatureBytes } = require('../lib/programme-gates/bytes');
const {
  APPROVAL_SIGNATURE_DOMAIN,
  APPROVAL_SIGNATURE_EVIDENCE_SCHEMA,
  BEN_APPROVER_KEY_ID,
  EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA,
  INITIAL_IMPORT_COUNT,
  INITIAL_IMPORT_NAMESPACE,
  INITIAL_IMPORT_SEED_SCHEMA_VERSION,
  GovernedIdentityProposalPacketError,
  assertContractCompatibleIdentitySeed,
  buildDealIdentityApprovalNonceRegistry,
  buildDealIdentitySeedSlot,
  buildFrozenExternalIssuerRegistry,
  buildGovernedIdentityProposalPacket,
  buildInitialImportProposalPacket,
  buildUnsignedDealIdentityApprovalSigningRequest,
  compareAndSwapDealIdentitySeedSlot,
  validateV2DealIdentityAuthorityEvidence,
  validateInitialImportProposalPacket,
} = require('../lib/canonical-v2/governed-identity-proposal-packet');
const {
  buildDealIdentityTrustedKeyRegistryPatchProposal,
} = require('../lib/canonical-v2/deal-identity-trusted-key-registry-proposal');

const ROOT = path.resolve(__dirname, '..');
function id(value) { return sha256Hex(value); }

const keyPair = crypto.generateKeyPairSync('ed25519');
const trustedKeyRegistry = Object.freeze({
  schema_version: 'TrustedProgrammeGatePublicKeys/V1',
  registry_state: 'ACTIVE',
  keys: Object.freeze([Object.freeze({
    key_id: BEN_APPROVER_KEY_ID,
    algorithm: 'Ed25519',
    public_key_pem: keyPair.publicKey.export({ type: 'spki', format: 'pem' }),
    permitted_roles: Object.freeze(['BEN_APPROVER']),
    permitted_domains: Object.freeze([APPROVAL_SIGNATURE_DOMAIN]),
    valid_from: '2026-01-01T00:00:00.000Z',
    valid_until: '2027-01-01T00:00:00.000Z',
    revoked_at: null,
  })]),
});

function benSeed(value = 'TX-000001') {
  return {
    kind: 'BEN_APPROVED_IMPORT_IDENTITY',
    governed_source_namespace: INITIAL_IMPORT_NAMESPACE,
    immutable_submitted_transaction_identifier: value,
    seed_schema_version: INITIAL_IMPORT_SEED_SCHEMA_VERSION,
  };
}

function request(seed = benSeed(), nonce = id('nonce-1'), supersessions = []) {
  return buildUnsignedDealIdentityApprovalSigningRequest({
    immutable_deal_seed: seed,
    approval_nonce: nonce,
    reviewed_supersession_reference_ids: supersessions,
  });
}

function manifestFor(requestValue) {
  return buildGovernedIdentityProposalPacket({
    immutable_deal_seed: requestValue.approval_attestation_payload.immutable_deal_seed,
    deal_identity_approval_attestation_id: requestValue.deal_identity_approval_attestation_id,
    deal_identity_approval_attestation_payload_digest: requestValue.deal_identity_approval_attestation_payload_digest,
    reviewed_supersession_reference_ids: requestValue.approval_attestation_payload.reviewed_supersession_reference_ids,
  });
}

function verifiedSignatureEvidence(requestValue, at = '2026-08-04T12:00:00.000Z') {
  return {
    schema_version: APPROVAL_SIGNATURE_EVIDENCE_SCHEMA,
    key_id: BEN_APPROVER_KEY_ID,
    signed_at: at,
    signature: crypto.sign(null, signatureBytes({
      domain: APPROVAL_SIGNATURE_DOMAIN,
      role: 'BEN_APPROVER',
      payload: requestValue.approval_attestation_payload,
    }), keyPair.privateKey).toString('base64'),
  };
}

function slotInput({ slot, nonceRegistry, requestValue, manifest = manifestFor(requestValue), slotVersion = slot.slot_version, nonceVersion = nonceRegistry.registry_version } = {}) {
  return {
    current_slot: slot,
    expected_slot_version: slotVersion,
    proposal_manifest: manifest,
    approval_signing_request: requestValue,
    approval_signature_evidence: verifiedSignatureEvidence(requestValue),
    current_nonce_registry: nonceRegistry,
    expected_nonce_registry_version: nonceVersion,
  };
}

function externalSeed() {
  return {
    kind: 'REGISTERED_EXTERNAL_TRANSACTION',
    issuer_namespace_key: 'SEC_EDGAR_TRANSACTION_REGISTRY',
    issuer_namespace_version: 'V1',
    issuer_immutable_transaction_identifier: 'issuer-opaque-transaction-100',
  };
}

function externalAuthority(seed, registry) {
  const issuer = registry.issuers.find((entry) => entry.issuer_namespace_key === seed.issuer_namespace_key);
  const body = {
    schema_version: EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA,
    external_issuer_registry_id: registry.external_issuer_registry_id,
    issuer_namespace_key: seed.issuer_namespace_key,
    issuer_namespace_version: seed.issuer_namespace_version,
    issuer_registration_id: issuer.issuer_registration_id,
    issuer_registration_payload_digest: issuer.issuer_registration_payload_digest,
  };
  return {
    ...body,
    registered_external_transaction_authority_id: contentId(EXTERNAL_TRANSACTION_AUTHORITY_SCHEMA, body),
    registered_external_transaction_authority_payload_digest: contentId('REGISTERED_EXTERNAL_TRANSACTION_AUTHORITY_PAYLOAD/V2', body),
  };
}

test('accepts only the two closed V2 seed branches and excludes party-date, aliases, UUIDs, source identifiers, and legacy production identifiers', () => {
  assert.equal(assertContractCompatibleIdentitySeed(benSeed()).kind, 'BEN_APPROVED_IMPORT_IDENTITY');
  assert.equal(assertContractCompatibleIdentitySeed(externalSeed()).kind, 'REGISTERED_EXTERNAL_TRANSACTION');
  for (const invalid of [
    { ...benSeed(), buyer: 'Buyer' }, { ...benSeed(), signing_date: '2026-08-04' },
    { ...benSeed(), uuid: '11111111-1111-4111-8111-111111111111' },
    { ...benSeed(), source_url: 'https://www.sec.gov/Archives/example.htm' },
    { ...benSeed(), production_deal_id: 'old-v1-id' },
    { kind: 'REGISTERED_EXTERNAL_TRANSACTION', issuer_immutable_transaction_identifier: 'bare-external-id' },
  ]) assert.throws(() => assertContractCompatibleIdentitySeed(invalid), GovernedIdentityProposalPacketError);
});

test('makes the initial forty-row import packet opaque, unique, and proposal only', () => {
  const packet = buildInitialImportProposalPacket({ initial_import_source_inventory_digest: id('forty-row-directory') });
  assert.equal(packet.rows.length, INITIAL_IMPORT_COUNT);
  assert.equal(packet.status, 'PENDING_NAMESPACE_AND_KEY_DOMAIN_RATIFICATION');
  assert.equal(packet.governed_source_namespace, INITIAL_IMPORT_NAMESPACE);
  assert.deepEqual(packet.rows.map((row) => row.immutable_deal_seed.immutable_submitted_transaction_identifier), [
    ...Array.from({ length: 40 }, (_, index) => `TX-${String(index + 1).padStart(6, '0')}`),
  ]);
  assert.equal(new Set(packet.rows.map((row) => row.proposed_import_seed_digest)).size, INITIAL_IMPORT_COUNT);
  assert.equal(packet.deal_admission_authority, 'NONE');
  assert.equal(validateInitialImportProposalPacket(packet).initial_import_proposal_packet_id, packet.initial_import_proposal_packet_id);
  const altered = structuredClone(packet);
  altered.rows[0].immutable_deal_seed.immutable_submitted_transaction_identifier = 'party-date-derived-name';
  assert.throws(() => validateInitialImportProposalPacket(altered), GovernedIdentityProposalPacketError);
});

test('requires frozen issuer-registry proof for external transactions and rejects a standalone authority object', () => {
  const seed = externalSeed();
  const registry = buildFrozenExternalIssuerRegistry({
    issuer_registry_version: 'SEC_EDGAR_ISSUER_REGISTRY/V1',
    issuers: [{ issuer_namespace_key: seed.issuer_namespace_key, issuer_namespace_version: seed.issuer_namespace_version }],
  });
  assert.throws(() => buildGovernedIdentityProposalPacket({
    immutable_deal_seed: seed, registered_external_transaction_authority: externalAuthority(seed, registry),
  }), { code: 'IDENTITY_EXTERNAL_ISSUER_REGISTRY_INVALID' });
  const manifest = buildGovernedIdentityProposalPacket({
    immutable_deal_seed: seed, frozen_external_issuer_registry: registry,
    registered_external_transaction_authority: externalAuthority(seed, registry),
  });
  assert.equal(manifest.deal_identity_approval_attestation_id, null);
  const staleRegistry = structuredClone(registry);
  staleRegistry.issuers[0].issuer_namespace_version = 'V2';
  assert.throws(() => buildGovernedIdentityProposalPacket({
    immutable_deal_seed: seed, frozen_external_issuer_registry: staleRegistry,
    registered_external_transaction_authority: externalAuthority(seed, registry),
  }), GovernedIdentityProposalPacketError);
  const unregistered = buildFrozenExternalIssuerRegistry({
    issuer_registry_version: 'SEC_EDGAR_ISSUER_REGISTRY/V1',
    issuers: [{ issuer_namespace_key: 'OTHER_ISSUER', issuer_namespace_version: 'V1' }],
  });
  assert.throws(() => buildGovernedIdentityProposalPacket({
    immutable_deal_seed: seed, frozen_external_issuer_registry: unregistered,
    registered_external_transaction_authority: externalAuthority(seed, registry),
  }), { code: 'IDENTITY_EXTERNAL_TRANSACTION_AUTHORITY_INVALID' });
});

test('keeps the external CAS branch free of implicit Ben approval input', () => {
  const seed = externalSeed();
  const registry = buildFrozenExternalIssuerRegistry({
    issuer_registry_version: 'SEC_EDGAR_ISSUER_REGISTRY/V1',
    issuers: [{ issuer_namespace_key: seed.issuer_namespace_key, issuer_namespace_version: seed.issuer_namespace_version }],
  });
  const manifest = buildGovernedIdentityProposalPacket({
    immutable_deal_seed: seed,
    frozen_external_issuer_registry: registry,
    registered_external_transaction_authority: externalAuthority(seed, registry),
  });
  const slot = buildDealIdentitySeedSlot({ immutable_deal_seed: seed });
  const preview = compareAndSwapDealIdentitySeedSlot({
    current_slot: slot,
    expected_slot_version: slot.slot_version,
    proposal_manifest: manifest,
  });
  assert.equal(preview.successor_nonce_registry, null);
  assert.equal(preview.current_nonce_registry_id, null);
  assert.throws(() => compareAndSwapDealIdentitySeedSlot({
    current_slot: slot,
    expected_slot_version: slot.slot_version,
    proposal_manifest: manifest,
    trusted_key_registry: trustedKeyRegistry,
  }), { code: 'IDENTITY_CALLER_TRUST_REGISTRY_FORBIDDEN' });
});

test('uses only the pinned governing registry and rejects a caller-created key even when its signature is cryptographically valid', () => {
  const signingRequest = request();
  const slot = buildDealIdentitySeedSlot({ immutable_deal_seed: benSeed() });
  const nonceRegistry = buildDealIdentityApprovalNonceRegistry();
  const unsigned = slotInput({ slot, nonceRegistry, requestValue: signingRequest });
  delete unsigned.approval_signature_evidence;
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(unsigned), { code: 'IDENTITY_APPROVAL_UNSIGNED_OR_UNVERIFIED' });
  const callerControlled = {
    ...slotInput({ slot, nonceRegistry, requestValue: signingRequest }),
    trusted_key_registry: trustedKeyRegistry,
  };
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(callerControlled), {
    code: 'IDENTITY_CALLER_TRUST_REGISTRY_FORBIDDEN',
  });
  assert.throws(
    () => compareAndSwapDealIdentitySeedSlot(slotInput({ slot, nonceRegistry, requestValue: signingRequest })),
    { code: 'IDENTITY_APPROVAL_SIGNATURE_INVALID' },
  );
  const wrongDomain = slotInput({ slot, nonceRegistry, requestValue: signingRequest });
  wrongDomain.approval_signature_evidence = {
    ...wrongDomain.approval_signature_evidence,
    key_id: 'UNTRUSTED_KEY',
  };
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(wrongDomain), { code: 'IDENTITY_APPROVAL_UNSIGNED_OR_UNVERIFIED' });
  const expired = slotInput({ slot, nonceRegistry, requestValue: signingRequest });
  expired.approval_signature_evidence = verifiedSignatureEvidence(signingRequest, '2028-01-01T00:00:00.000Z');
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(expired), { code: 'IDENTITY_APPROVAL_SIGNATURE_INVALID' });
});

test('public authority validation accepts no caller registry and keeps Ben approval blocked until the pinned registry adopts the domain', () => {
  const signingRequest = request();
  const evidence = {
    deal_identity_manifest: manifestFor(signingRequest),
    approval_signing_request: signingRequest,
    approval_signature_evidence: verifiedSignatureEvidence(signingRequest),
  };
  assert.throws(() => validateV2DealIdentityAuthorityEvidence({
    ...evidence,
    trusted_key_registry: trustedKeyRegistry,
  }), { code: 'IDENTITY_CALLER_TRUST_REGISTRY_FORBIDDEN' });
  assert.throws(() => validateV2DealIdentityAuthorityEvidence(evidence), {
    code: 'IDENTITY_APPROVAL_SIGNATURE_INVALID',
  });
  assert.throws(() => validateV2DealIdentityAuthorityEvidence({
    deal_identity_manifest: { schema_version: 'GOVERNED_DEAL_IDENTITY_MANIFEST/V1', authority: 'legacy', value: 'legacy' },
  }), GovernedIdentityProposalPacketError);
});

test('Ben approval cannot mutate preview nonce or slot state before pinned-registry verification succeeds', () => {
  const nonceRegistry = buildDealIdentityApprovalNonceRegistry();
  const slot = buildDealIdentitySeedSlot({ immutable_deal_seed: benSeed('TX-000001') });
  const signingRequest = request(benSeed('TX-000001'), id('global-nonce'));
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(slotInput({
    slot, nonceRegistry, requestValue: signingRequest,
  })), { code: 'IDENTITY_APPROVAL_SIGNATURE_INVALID' });
  assert.equal(slot.state, 'EMPTY');
  assert.deepEqual(nonceRegistry.entries, []);
  const staleRegistryVersion = slotInput({
    slot, nonceRegistry, requestValue: signingRequest,
  });
  staleRegistryVersion.expected_nonce_registry_version = 1;
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(staleRegistryVersion), { code: 'IDENTITY_NONCE_REGISTRY_CAS_CONFLICT' });
});

test('pre-signature CAS checks still reject stale versions, changed seeds, and invalid successor scope', () => {
  const slot = buildDealIdentitySeedSlot({ immutable_deal_seed: benSeed() });
  const nonceRegistry = buildDealIdentityApprovalNonceRegistry();
  const stale = slotInput({ slot, nonceRegistry, requestValue: request() });
  stale.expected_slot_version = 1;
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(stale), { code: 'IDENTITY_SEED_SLOT_CAS_CONFLICT' });
  const changed = request(benSeed('TX-000002'), id('changed-seed'));
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(slotInput({
    slot, nonceRegistry, requestValue: changed,
  })), { code: 'IDENTITY_SEED_SLOT_KEY_CONFLICT' });
  const successorOnly = request(benSeed(), id('successor-only'), [id('supersession')]);
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(slotInput({
    slot, nonceRegistry, requestValue: successorOnly,
  })), { code: 'IDENTITY_APPROVAL_SCOPE_OR_SUPERSESSION_CONFLICT' });
  const genesis = request();
  const mismatchedManifest = buildGovernedIdentityProposalPacket({
    immutable_deal_seed: benSeed(),
    deal_identity_approval_attestation_id: genesis.deal_identity_approval_attestation_id,
    deal_identity_approval_attestation_payload_digest: genesis.deal_identity_approval_attestation_payload_digest,
    reviewed_supersession_reference_ids: [id('unexpected-supersession')],
  });
  assert.throws(() => compareAndSwapDealIdentitySeedSlot(slotInput({
    slot, nonceRegistry, requestValue: genesis, manifest: mismatchedManifest,
  })), { code: 'IDENTITY_APPROVAL_SEED_OR_MANIFEST_MISMATCH' });
});

test('keeps proposed trusted-key changes non-authoritative and uses the existing Ben key and domain', () => {
  const patch = buildDealIdentityTrustedKeyRegistryPatchProposal({
    base_trusted_key_registry_digest: id('active-registry'), pending_ben_ruling_id: id('ben-ruling-pending'),
  });
  assert.equal(patch.state, 'FROZEN_PROPOSAL_PENDING_REGISTRY_AMENDMENT');
  assert.equal(patch.authority, 'NONE');
  assert.equal(patch.registry_activation_authority, 'NONE');
  const benGrant = patch.role_domain_grants.find((entry) => entry.key_id === BEN_APPROVER_KEY_ID);
  assert.equal(benGrant.permitted_domain, APPROVAL_SIGNATURE_DOMAIN);
});

test('writes a forty-row opaque proposal packet only, never the stale party-date packet', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-proposal-'));
  try {
    const output = childProcess.spawnSync(process.execPath, [
      path.join(ROOT, 'scripts/write-governed-identity-proposal-packet.js'), outputRoot,
    ], { encoding: 'utf8' });
    assert.equal(output.status, 0, output.stderr);
    const packetPath = path.join(outputRoot, 'governed-identity-initial-import-proposal-packet.json');
    assert.equal(fs.existsSync(packetPath), true);
    const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
    assert.equal(packet.rows.length, 40);
    assert.equal(JSON.stringify(packet).includes('signing_date'), false);
    assert.equal(JSON.stringify(packet).includes('buyer_display'), false);
  } finally {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }
});

test('writer refuses a non-forty inventory and leaves no output packet behind', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-proposal-invalid-'));
  try {
    const inputPath = path.join(temporary, 'thirty-nine.json');
    fs.writeFileSync(inputPath, JSON.stringify({ deals: Array.from({ length: 39 }, () => ({})) }));
    const output = childProcess.spawnSync(process.execPath, [
      path.join(ROOT, 'scripts/write-governed-identity-proposal-packet.js'), temporary, inputPath,
    ], { encoding: 'utf8' });
    assert.notEqual(output.status, 0);
    assert.match(output.stderr, /exactly 40 rows/);
    assert.equal(fs.existsSync(path.join(temporary, 'governed-identity-initial-import-proposal-packet.json')), false);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test('the proposal writer uses the legacy directory only as a forty-row inventory count', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/write-governed-identity-proposal-packet.js'), 'utf8');
  assert.match(source, /directory\.deals\.length !== INITIAL_IMPORT_COUNT/);
  assert.doesNotMatch(source, /buyer_display|target_display|deal_name|signing_date|production_deal_id|governed_deal_key|deal_identity_bridge/i);
});

test('identity proposal modules fence obsolete V1 identity consumers, bridge use, placeholder governed keys, source admission, persistence, and signing', () => {
  for (const file of [
    path.join(ROOT, 'lib/canonical-v2/governed-identity-proposal-packet.js'),
    path.join(ROOT, 'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js'),
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /require\(['"]\.\/deal-identity['"]\)|deal_identity_bridge|deal:qxo-topbuild|home-deal-directory|supabase|INSERT\s+INTO|createCodexCliProvider|executeUnifiedRun|createSign|crypto\.sign|node:https|node:http|\bfetch\s*\(/i);
  }
});
