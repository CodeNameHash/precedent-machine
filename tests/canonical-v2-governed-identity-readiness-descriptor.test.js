'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { REGISTRY_DIGESTS } = require('../lib/programme-gates/registry');
const descriptor = require('../lib/canonical-v2/governed-identity-readiness-descriptor');

const ROOT = path.resolve(__dirname, '..');

test('binds the governed identity proposal schemas and exact source digest while remaining blocked', () => {
  const value = descriptor.buildGovernedIdentityReadinessDescriptor({ repository_root: ROOT });
  assert.equal(value.status, 'BLOCKED_NOT_EXECUTABLE');
  assert.equal(value.authority, 'NONE');
  assert.equal(value.source_module.module_key, 'GOVERNED_IDENTITY_TRUST_CONTRACTS');
  assert.equal(value.source_module.schema_versions.length, 9);
  assert.equal(value.missing_requirements.length, 7);
  assert.equal(value.adopted_initial_import_identity_policy.governed_source_namespace, 'BEN_APPROVED_IMPORT/V2');
  assert.equal(value.adopted_initial_import_identity_policy.seed_schema_version, 'BEN_APPROVED_IMPORT_SEED/V2');
  assert.equal(value.adopted_initial_import_identity_policy.transaction_identifiers.at(0), 'TX-000001');
  assert.equal(value.adopted_initial_import_identity_policy.transaction_identifiers.at(-1), 'TX-000040');
  assert.equal(value.adopted_initial_import_identity_policy.ben_mapping_signature_policy, 'ONE_BEN_SIGNATURE_FOR_EXACT_40_DEAL_41_OCCURRENCE_MAPPING_SET');
  assert.equal(value.adopted_initial_import_identity_policy.machine_allocation_receipt_count, 40);
  assert.equal(value.adopted_initial_import_identity_policy.bridge_current_head_and_full_chain_verification_required, true);
  assert.equal(value.frozen_key_registry_amendment_approval_state, 'PENDING_EXACT_DIFF_APPROVAL_NOT_ACTIVE');
  assert.equal(value.frozen_key_registry_amendment.authority, 'NONE');
  assert.equal(value.frozen_key_registry_amendment.role_domain_grants.length, 6);
  assert.equal(value.frozen_key_registry_amendment.private_key_material, null);
  assert.equal(value.frozen_key_registry_amendment.base_key_registry_root_id, REGISTRY_DIGESTS.trusted_public_keys);
  assert.ok(value.missing_requirements.includes('IDENTITY_CURRENT_HEAD_VERIFIER_REQUIRED'));
  assert.deepEqual(descriptor.validateGovernedIdentityReadinessDescriptor(value, { repository_root: ROOT }), value);
  const stale = structuredClone(value); stale.source_module.source_sha256 = '0'.repeat(64);
  assert.throws(() => descriptor.validateGovernedIdentityReadinessDescriptor(stale, { repository_root: ROOT }), /stale|incomplete/i);
  const forgedRegistryRoot = structuredClone(value);
  forgedRegistryRoot.frozen_key_registry_amendment.base_key_registry_root_id = '0'.repeat(64);
  const { amendment_proposal_id: ignoredAmendmentId, ...amendmentBody } = forgedRegistryRoot.frozen_key_registry_amendment;
  forgedRegistryRoot.frozen_key_registry_amendment.amendment_proposal_id = contentId(
    forgedRegistryRoot.frozen_key_registry_amendment.schema_version,
    amendmentBody,
  );
  const { readiness_descriptor_id: ignoredDescriptorId, ...descriptorBody } = forgedRegistryRoot;
  forgedRegistryRoot.readiness_descriptor_id = contentId(descriptor.SCHEMA, descriptorBody);
  assert.throws(() => descriptor.validateGovernedIdentityReadinessDescriptor(forgedRegistryRoot, { repository_root: ROOT }), /stale|incomplete/i);
});

test('descriptor has no signing, verifier, issuer, persistence, network, database, or consumer-brand execution path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/governed-identity-readiness-descriptor.js'), 'utf8');
  assert.doesNotMatch(source, /verifySignature|writeFile|mkdir|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|UPDATE\s+|DELETE\s+|crypto\.sign|createPrivateKey|issueAllocation|createIdentityConsumerBrand/i);
});

test('descriptor rejects temporary repository roots', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'governed-identity-readiness-'));
  try {
    assert.throws(() => descriptor.buildGovernedIdentityReadinessDescriptor({ repository_root: temporaryRoot }), /temporary repository root/i);
  } finally { fs.rmSync(temporaryRoot, { recursive: true, force: true }); }
});
