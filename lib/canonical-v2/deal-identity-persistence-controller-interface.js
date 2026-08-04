'use strict';

const {
  validateAllocationPersistenceReceiptProposal,
  validateReviewedProductionDealBridgeProposal,
} = require('./deal-identity-allocation-readiness');

class DealIdentityPersistenceControllerInterfaceError extends Error {
  constructor(code, message) { super(message); this.name = 'DealIdentityPersistenceControllerInterfaceError'; this.code = code; }
}

function requireClosedPersistenceControllerInput({ allocation_receipt_proposal, reviewed_bridge_proposal } = {}) {
  const receipt = validateAllocationPersistenceReceiptProposal(allocation_receipt_proposal);
  const bridge = validateReviewedProductionDealBridgeProposal(reviewed_bridge_proposal);
  if (!bridge.mappings.some((row) => row.allocation_persistence_receipt_id === receipt.allocation_persistence_receipt_id
    && row.governed_deal_key === receipt.governed_deal_key)) {
    throw new DealIdentityPersistenceControllerInterfaceError('IDENTITY_ISSUANCE_BINDING_MISMATCH', 'Bridge proposal does not bind the exact allocation proposal.');
  }
  return Object.freeze({ receipt, bridge });
}

function issueAllocationPersistenceReceipt() {
  throw new DealIdentityPersistenceControllerInterfaceError('IDENTITY_PERSISTENCE_CONTROLLER_NOT_IMPLEMENTED', 'A serialisable persistence controller is required before any allocation receipt can be issued.');
}

function issueReviewedProductionDealBridge() {
  throw new DealIdentityPersistenceControllerInterfaceError('IDENTITY_BRIDGE_ISSUER_NOT_IMPLEMENTED', 'A reviewed bridge issuer is required before any production-deal bridge can be issued.');
}

module.exports = { DealIdentityPersistenceControllerInterfaceError, requireClosedPersistenceControllerInput, issueAllocationPersistenceReceipt, issueReviewedProductionDealBridge };
