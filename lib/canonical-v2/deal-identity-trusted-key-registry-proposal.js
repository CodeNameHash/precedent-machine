'use strict';

const {
  BEN_APPROVER_KEY_ID,
  FROZEN_KEY_REGISTRY_AMENDMENT_SCHEMA: PROPOSAL_SCHEMA,
  buildFrozenKeyRegistryAmendmentProposal,
} = require('./governed-identity-trust-contracts');

const DIGEST_RE = /^[a-f0-9]{64}$/;

class DealIdentityTrustedKeyRegistryProposalError extends Error {
  constructor(code, message) { super(message); this.name = 'DealIdentityTrustedKeyRegistryProposalError'; this.code = code; }
}

function fail(code, message) { throw new DealIdentityTrustedKeyRegistryProposalError(code, message); }

function buildDealIdentityTrustedKeyRegistryPatchProposal({
  base_trusted_key_registry_digest: baseDigest,
  pending_ben_ruling_id: pendingBenRulingId,
  existing_key_id: existingKeyId = BEN_APPROVER_KEY_ID,
} = {}) {
  if (typeof baseDigest !== 'string' || !DIGEST_RE.test(baseDigest)
    || typeof pendingBenRulingId !== 'string' || !DIGEST_RE.test(pendingBenRulingId)
    || existingKeyId !== BEN_APPROVER_KEY_ID) {
    fail('IDENTITY_TRUSTED_KEY_PATCH_INVALID', 'Trusted-key proposal requires the exact base registry, pending Ben ruling, and existing Ben approver key.');
  }
  return buildFrozenKeyRegistryAmendmentProposal({
    base_key_registry_root_id: baseDigest,
    pending_ben_ruling_id: pendingBenRulingId,
  });
}

module.exports = {
  PROPOSAL_SCHEMA,
  DealIdentityTrustedKeyRegistryProposalError,
  buildDealIdentityTrustedKeyRegistryPatchProposal,
};
