'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { REGISTRY_DIGESTS, TRUSTED_PUBLIC_KEY_REGISTRY } = require('../lib/programme-gates/registry');
const contracts = require('../lib/canonical-v2/governed-identity-trust-contracts');
const proposal = require('../lib/canonical-v2/deal-identity-trusted-key-registry-proposal');

const ROOT = path.resolve(__dirname, '..');

const APPROVAL_TIME = '2026-08-04T12:00:00.000Z';

function newKeyRecords() {
  const existingBenKey = TRUSTED_PUBLIC_KEY_REGISTRY.keys.find((entry) => entry.key_id === contracts.BEN_APPROVER_KEY_ID);
  return contracts.FROZEN_KEY_REGISTRY_ROLE_DOMAIN_GRANTS
    .filter((grant) => grant.role !== 'BEN_APPROVER')
    .map((grant) => ({
      key_id: grant.key_id,
      algorithm: 'Ed25519',
      public_key_pem: existingBenKey.public_key_pem,
      permitted_roles: [grant.role],
      permitted_domains: [grant.permitted_domain],
      valid_from: '2026-08-04T00:00:00.000Z',
      valid_until: '2026-10-26T07:08:01.000Z',
      revoked_at: null,
      custody: {
        custodian_id: `external-custodian-${grant.role.toLowerCase()}`,
        key_origin: 'EXTERNAL_REGISTERED_PUBLIC_KEY',
        private_key_access: 'EXTERNAL_ONLY',
        rotation_condition: 'ROTATE_BEFORE_VALID_UNTIL',
      },
    }));
}

function packet() {
  return proposal.buildLiteralTrustedKeyRegistryPatchProposal({
    approval_time: APPROVAL_TIME,
    new_key_records: newKeyRecords(),
  });
}

test('builds a literal before and after registry patch from five supplied public records only', () => {
  const value = packet();
  assert.equal(value.authority, 'NONE');
  assert.equal(value.issuance_authority, 'NONE');
  assert.equal(value.registry_activation_authority, 'NONE');
  assert.equal(value.signing_authority, 'NONE');
  assert.equal(value.base_trusted_key_registry_digest, REGISTRY_DIGESTS.trusted_public_keys);
  assert.notEqual(value.successor_trusted_key_registry_digest, value.base_trusted_key_registry_digest);
  assert.equal(value.before_registry.keys.length, 4);
  assert.equal(value.after_registry.keys.length, 9);
  assert.equal(value.new_key_records.length, 5);
  assert.deepEqual(value.recorded_ruling, proposal.CANONICAL_RECORDED_RULING);
  assert.equal(value.approval_time, APPROVAL_TIME);
  assert.deepEqual(value.identity_grants.map((grant) => grant.role), [
    'BEN_APPROVER', 'IDENTITY_ALLOCATION_CONTROLLER', 'IDENTITY_BRIDGE_ISSUER',
  ]);
  assert.deepEqual(value.v1_capture_replay_grants.map((grant) => grant.role), [
    'V1_CAPTURE_CONTROLLER', 'V1_FINAL_VALIDATOR', 'V1_REPLAY_CONTROLLER',
  ]);
  assert.equal(value.ben_key_lifecycle.valid_until, '2026-10-26T07:08:01.000Z');
  assert.equal(value.ben_key_lifecycle.rotation_condition, proposal.BEN_KEY_ROTATION_CONDITION);
  assert.equal(value.ben_key_lifecycle.approval_time_effect, 'CURRENT_BEN_KEY_MUST_BE_ACTIVE_AT_APPROVAL_TIME');
  const benAfter = value.after_registry.keys.find((entry) => entry.key_id === contracts.BEN_APPROVER_KEY_ID);
  assert.ok(benAfter.permitted_domains.includes(contracts.BEN_MAPPING_APPROVAL_SIGNATURE_DOMAIN));
  assert.deepEqual(proposal.validateLiteralTrustedKeyRegistryPatchProposal(value), value);
});

test('rejects placeholder-only, incomplete, over-broad, or stale literal registry patches', () => {
  const base = {
    approval_time: APPROVAL_TIME,
    new_key_records: newKeyRecords(),
  };
  assert.throws(() => proposal.buildLiteralTrustedKeyRegistryPatchProposal({
    ...base,
    new_key_records: base.new_key_records.slice(1),
  }), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
  const broad = structuredClone(base);
  broad.new_key_records[0].permitted_domains = ['ALL_DOMAINS'];
  assert.throws(() => proposal.buildLiteralTrustedKeyRegistryPatchProposal(broad), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
  const custody = structuredClone(base);
  custody.new_key_records[0].custody.private_key_access = 'LOCAL_PROCESS';
  assert.throws(() => proposal.buildLiteralTrustedKeyRegistryPatchProposal(custody), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
  const value = packet();
  const stale = structuredClone(value);
  stale.successor_trusted_key_registry_digest = '0'.repeat(64);
  assert.throws(() => proposal.validateLiteralTrustedKeyRegistryPatchProposal(stale), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
});

test('rejects the hostile expired key, arbitrary ruling link, and self-consistent substituted base attacks', () => {
  const expired = {
    approval_time: APPROVAL_TIME,
    new_key_records: newKeyRecords(),
  };
  expired.new_key_records[0].valid_from = '2020-01-01T00:00:00.000Z';
  expired.new_key_records[0].valid_until = '2021-01-01T00:00:00.000Z';
  assert.throws(() => proposal.buildLiteralTrustedKeyRegistryPatchProposal(expired), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
  assert.throws(() => proposal.buildLiteralTrustedKeyRegistryPatchProposal({
    approval_time: APPROVAL_TIME,
    new_key_records: newKeyRecords(),
    recorded_ruling: { ruling_id: 'identity-batch-mapping-signature', source: 'changed link' },
  }), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
  const value = packet();
  const changedRuling = structuredClone(value);
  changedRuling.recorded_ruling = { ruling_id: 'identity-batch-mapping-signature', source: 'changed link' };
  const { literal_patch_proposal_id: ignored, ...changedRulingBody } = changedRuling;
  changedRuling.literal_patch_proposal_id = require('../lib/canonical-v2/canonical-bytes').contentId(proposal.LITERAL_PATCH_SCHEMA, changedRulingBody);
  assert.throws(() => proposal.validateLiteralTrustedKeyRegistryPatchProposal(changedRuling), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
  const substitutedBase = structuredClone(value);
  substitutedBase.before_registry.keys[0].valid_until = '2026-09-01T00:00:00.000Z';
  const { literal_patch_proposal_id: ignoredPatchId, ...substitutedBaseBody } = substitutedBase;
  substitutedBase.literal_patch_proposal_id = require('../lib/canonical-v2/canonical-bytes').contentId(proposal.LITERAL_PATCH_SCHEMA, substitutedBaseBody);
  assert.throws(() => proposal.validateLiteralTrustedKeyRegistryPatchProposal(substitutedBase), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
  assert.throws(() => proposal.buildLiteralTrustedKeyRegistryPatchProposal({
    approval_time: APPROVAL_TIME,
    new_key_records: newKeyRecords(),
    base_registry: TRUSTED_PUBLIC_KEY_REGISTRY,
  }), { code: 'IDENTITY_LITERAL_KEY_PATCH_INVALID' });
});

test('literal registry patch code has no registry write, key creation, signing, or execution path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js'), 'utf8');
  assert.doesNotMatch(source, /writeFile|mkdir|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|UPDATE\s+|DELETE\s+|crypto\.|createPrivateKey|createPublicKey|issueAllocation|createIdentityConsumerBrand/i);
});
