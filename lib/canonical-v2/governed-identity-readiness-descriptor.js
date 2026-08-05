'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const contracts = require('./governed-identity-trust-contracts');
const { REGISTRY_DIGESTS, TRUSTED_PUBLIC_KEY_REGISTRY } = require('../programme-gates/registry');

const SCHEMA = 'GOVERNED_IDENTITY_READINESS_DESCRIPTOR/V2';
const STATUS = 'BLOCKED_NOT_EXECUTABLE';
const MISSING_REQUIREMENTS = Object.freeze([
  'IDENTITY_KEY_REGISTRY_AMENDMENT_REQUIRED',
  'IDENTITY_EXPLICIT_40_DEAL_41_OCCURRENCE_MAPPING_REVIEW_REQUIRED',
  'IDENTITY_BEN_BATCH_MAPPING_SIGNATURE_REQUIRED',
  'IDENTITY_REAL_SERIALISABLE_PERSISTENCE_REQUIRED',
  'IDENTITY_ALLOCATION_AND_BRIDGE_CONTROLLER_REQUIRED',
  'IDENTITY_SIGNATURE_VERIFIER_REQUIRED',
  'IDENTITY_CURRENT_HEAD_VERIFIER_REQUIRED',
]);
const SOURCE_MODULE_PATH = 'lib/canonical-v2/governed-identity-trust-contracts.js';
const READINESS_PENDING_BEN_RULING_ID = '6138f719fef86bbf2431424c525874eb27bdbec6ef6a55ed65d216d17ea3458f';

function pinnedTrustedKeyRegistryRootId() {
  if (!TRUSTED_PUBLIC_KEY_REGISTRY || typeof REGISTRY_DIGESTS?.trusted_public_keys !== 'string' || !/^[a-f0-9]{64}$/.test(REGISTRY_DIGESTS.trusted_public_keys)) {
    throw new Error('Governed identity readiness descriptor requires the exact pinned trusted public-key registry root.');
  }
  return REGISTRY_DIGESTS.trusted_public_keys;
}

function requireNonTemporaryRepositoryRoot(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) throw new Error('Governed identity readiness descriptor requires an absolute repository root.');
  const resolved = path.resolve(repositoryRoot);
  const temporaryRoots = [os.tmpdir(), '/tmp', '/var/tmp'].map((entry) => path.resolve(entry));
  if (temporaryRoots.some((temporaryRoot) => resolved === temporaryRoot || resolved.startsWith(`${temporaryRoot}${path.sep}`))) {
    throw new Error('Governed identity readiness descriptor cannot use a temporary repository root.');
  }
  return resolved;
}

function sourceModule(repositoryRoot) {
  return Object.freeze({
    module_key: 'GOVERNED_IDENTITY_TRUST_CONTRACTS',
    relative_path: SOURCE_MODULE_PATH,
    schema_versions: Object.freeze([
      contracts.FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA,
      contracts.NAMESPACE_APPROVAL_REQUEST_SCHEMA,
      contracts.EXTERNAL_NAMESPACE_BINDING_SCHEMA,
      contracts.SERIALISABLE_CAS_PROOF_SCHEMA,
      contracts.SIGNED_ALLOCATION_RECEIPT_SCHEMA,
      contracts.MAPPING_SET_SCHEMA,
      contracts.BEN_MAPPING_APPROVAL_REQUEST_SCHEMA,
      contracts.REVIEWED_BRIDGE_SCHEMA,
      contracts.AUTHORITY_BUNDLE_SCHEMA,
    ]),
    source_sha256: sha256Hex(fs.readFileSync(path.join(repositoryRoot, SOURCE_MODULE_PATH))),
  });
}

function buildGovernedIdentityReadinessDescriptor({ repository_root: repositoryRoot = path.resolve(__dirname, '../..') } = {}) {
  const frozenKeyRegistryAmendment = contracts.buildFrozenKeyRegistryAmendmentProposal({
    base_key_registry_root_id: pinnedTrustedKeyRegistryRootId(),
    pending_ben_ruling_id: READINESS_PENDING_BEN_RULING_ID,
  });
  const body = {
    schema_version: SCHEMA,
    status: STATUS,
    authority: 'NONE',
    adopted_initial_import_identity_policy: Object.freeze({
      state: 'RATIFIED_POLICY_NO_ISSUANCE_OR_PRODUCTION_AUTHORITY',
      governed_source_namespace: contracts.INITIAL_IMPORT_NAMESPACE,
      seed_schema_version: contracts.INITIAL_IMPORT_SEED_SCHEMA_VERSION,
      transaction_identifiers: contracts.INITIAL_IMPORT_TRANSACTION_IDS,
      transaction_count: contracts.REQUIRED_DEAL_COUNT,
      source_occurrence_count: contracts.REQUIRED_OCCURRENCE_COUNT,
      ben_mapping_signature_policy: contracts.BATCH_MAPPING_SIGNATURE_POLICY,
      machine_cas_proof_count: contracts.REQUIRED_DEAL_COUNT,
      machine_allocation_receipt_count: contracts.REQUIRED_DEAL_COUNT,
      bridge_current_head_and_full_chain_verification_required: true,
      authority: 'NONE',
    }),
    frozen_key_registry_amendment: frozenKeyRegistryAmendment,
    frozen_key_registry_amendment_approval_state: 'PENDING_EXACT_DIFF_APPROVAL_NOT_ACTIVE',
    source_module: sourceModule(requireNonTemporaryRepositoryRoot(repositoryRoot)),
    missing_requirements: MISSING_REQUIREMENTS,
  };
  return Object.freeze({ ...body, readiness_descriptor_id: contentId(SCHEMA, body) });
}

function validateGovernedIdentityReadinessDescriptor(value, { repository_root: repositoryRoot = path.resolve(__dirname, '../..') } = {}) {
  const keys = ['adopted_initial_import_identity_policy', 'authority', 'frozen_key_registry_amendment', 'frozen_key_registry_amendment_approval_state', 'missing_requirements', 'readiness_descriptor_id', 'schema_version', 'source_module', 'status'];
  if (!value || typeof value !== 'object' || Array.isArray(value) || canonicalJson(Object.keys(value).sort()) !== canonicalJson(keys)
    || value.schema_version !== SCHEMA || value.status !== STATUS || value.authority !== 'NONE'
    || value.frozen_key_registry_amendment_approval_state !== 'PENDING_EXACT_DIFF_APPROVAL_NOT_ACTIVE'
    || value.adopted_initial_import_identity_policy?.authority !== 'NONE') {
    throw new Error('Governed identity readiness descriptor must remain a blocked non-authoritative shape.');
  }
  const expected = buildGovernedIdentityReadinessDescriptor({ repository_root: repositoryRoot });
  if (canonicalJson(value) !== canonicalJson(expected)) throw new Error('Governed identity readiness descriptor is stale or incomplete.');
  return expected;
}

module.exports = {
  MISSING_REQUIREMENTS,
  READINESS_PENDING_BEN_RULING_ID,
  SCHEMA,
  SOURCE_MODULE_PATH,
  STATUS,
  requireNonTemporaryRepositoryRoot,
  pinnedTrustedKeyRegistryRootId,
  buildGovernedIdentityReadinessDescriptor,
  sourceModule,
  validateGovernedIdentityReadinessDescriptor,
};
