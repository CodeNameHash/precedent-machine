'use strict';

const { contentId } = require('../canonical-bytes');
const { GENERIC_KEYS } = require('./no-other-reps-fraud-producer');
const {
  CLAIM_DEFINITIONS,
  CONTRACT_SCHEMA,
  REMEDIES_OWNER_FAMILY,
  getNoOtherRepsFraudElement,
} = require('./no-other-reps-fraud-contract');

const RESOLUTION_SCHEMA = 'NATIVE_NO_OTHER_REPS_FRAUD_RESOLUTION/V1';
const SIDES = Object.freeze(['TARGET', 'BUYER']);
const FORBIDDEN_ATTRIBUTES = Object.freeze([
  'fraud_scope',
  'fraud_scope_code',
  'fraud_type',
  'available_damages',
  'damages_available',
  'remedy_effect',
  'definition_relationship',
  'definition_relationships',
]);

const REQUIRED_ATTRIBUTES = Object.freeze({
  [GENERIC_KEYS.NO_OTHER_REPS]: Object.freeze([]),
  [GENERIC_KEYS.NON_RELIANCE]: Object.freeze(['relying_party_ref', 'agreement_scope_quote']),
  [GENERIC_KEYS.EXTRA_CONTRACTUAL]: Object.freeze(['relying_party_ref', 'extra_contractual_scope_quote']),
  [GENERIC_KEYS.INDEPENDENT_INVESTIGATION]: Object.freeze(['investigating_party_ref']),
  [GENERIC_KEYS.FRAUD_CARVEOUT]: Object.freeze([]),
  [GENERIC_KEYS.WILLFUL_BREACH_DEFINITION]: Object.freeze(['defined_term_ref']),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function residual(proposal, reason) {
  return Object.freeze({
    residual_type: 'NO_OTHER_REPS_FRAUD_RESOLUTION_FAILURE',
    generic_claim_key: proposal?.claim_definition_key || null,
    reason_code: reason,
  });
}

function conceptFor(element, side) {
  if (element.concept_key) return element.concept_key;
  return `REP-${side === 'TARGET' ? 'T' : 'B'}-${element.element_kind}`;
}

function validateEvidence(proposal, sourceText) {
  if (!Array.isArray(proposal.evidence) || proposal.evidence.length !== 1) return false;
  const edge = proposal.evidence[0];
  if (!Number.isInteger(edge.absolute_start) || !Number.isInteger(edge.absolute_end)
    || edge.absolute_start < 0 || edge.absolute_end <= edge.absolute_start) return false;
  const bytes = Buffer.from(sourceText, 'utf8');
  if (edge.absolute_end > bytes.length) return false;
  return bytes.subarray(edge.absolute_start, edge.absolute_end).toString('utf8') === proposal.raw_value;
}

function resolveNoOtherRepsFraudProposals({ proposals, source_text: sourceText, source_id: sourceId } = {}) {
  if (!Array.isArray(proposals)) throw new TypeError('proposals must be an array');
  if (typeof sourceText !== 'string' || !sourceText) throw new TypeError('source_text must be a non-empty string');
  if (typeof sourceId !== 'string' || !sourceId) throw new TypeError('source_id must be a non-empty string');

  const resolved = [];
  const residuals = [];
  for (const proposal of proposals) {
    const element = getNoOtherRepsFraudElement(proposal?.claim_definition_key);
    if (!element) {
      residuals.push(residual(proposal, 'UNMAPPED_GENERIC_CLAIM_KEY'));
      continue;
    }
    if (proposal.state !== 'PRESENT' || proposal.canonical_value !== true) {
      residuals.push(residual(proposal, 'POSITIVE_PRESENCE_ONLY'));
      continue;
    }
    if (!validateEvidence(proposal, sourceText)) {
      residuals.push(residual(proposal, 'EVIDENCE_BYTES_UNVERIFIED'));
      continue;
    }

    const attributes = proposal.attributes && typeof proposal.attributes === 'object' ? proposal.attributes : {};
    if (FORBIDDEN_ATTRIBUTES.some((key) => Object.hasOwn(attributes, key))) {
      residuals.push(residual(proposal, 'UNADJUDICATED_ATTRIBUTE'));
      continue;
    }
    const required = REQUIRED_ATTRIBUTES[proposal.claim_definition_key] || [];
    if (required.some((key) => typeof attributes[key] !== 'string' || !attributes[key] || !proposal.raw_value.includes(attributes[key]))) {
      residuals.push(residual(proposal, 'REQUIRED_ATTRIBUTE_NOT_GROUNDED'));
      continue;
    }
    const quotedAttributes = Object.entries(attributes).filter(([key, value]) => (
      key !== 'section_reference'
      && key !== 'representation_side'
      && value != null
    ));
    if (quotedAttributes.some(([, value]) => typeof value !== 'string' || !proposal.raw_value.includes(value))) {
      residuals.push(residual(proposal, 'ATTRIBUTE_NOT_IN_ASSERTION_QUOTE'));
      continue;
    }
    const allowedAttributes = new Set(element.allowed_attributes);
    if (quotedAttributes.some(([key]) => !allowedAttributes.has(key))) {
      residuals.push(residual(proposal, 'ATTRIBUTE_OUTSIDE_CLOSED_CONTRACT'));
      continue;
    }

    const isWillful = proposal.claim_definition_key === GENERIC_KEYS.WILLFUL_BREACH_DEFINITION;
    const side = attributes.representation_side;
    if (!isWillful && !SIDES.includes(side)) {
      residuals.push(residual(proposal, 'REPRESENTATION_SIDE_OUT_OF_ENUM'));
      continue;
    }

    const conceptKey = conceptFor(element, side);
    const definition = CLAIM_DEFINITIONS[element.claim_definition_key];
    const governedAttributes = Object.fromEntries(quotedAttributes);
    if (!isWillful) governedAttributes.representation_side = side;
    const claimRevisionBody = {
      schema_version: 'CLAIM/V1',
      claim_definition_key: definition.key,
      claim_definition_revision: definition.revision,
      concept_key: conceptKey,
      owner_family: element.owner_family,
      state: 'PRESENT',
      canonical_value: true,
      attributes: Object.freeze(governedAttributes),
      evidence: proposal.evidence,
      raw_value: proposal.raw_value,
    };
    const claimBody = {
      ...claimRevisionBody,
      claim_revision_id: contentId('CLAIM_REVISION/V1', claimRevisionBody),
    };
    const evidenceOnly = element.qualified_owner_family ? Object.freeze({
      qualified_owner_family: REMEDIES_OWNER_FAMILY,
      relationship_state: 'EVIDENCE_ONLY_UNADJUDICATED',
      quote: proposal.raw_value,
    }) : null;
    resolved.push(deepFreeze({
      resolution_id: contentId(RESOLUTION_SCHEMA, { source_id: sourceId, ordinal: proposal.ordinal, claim: claimBody }),
      source_id: sourceId,
      section_reference: attributes.section_reference || null,
      generic_claim_key: proposal.claim_definition_key,
      raw_quote: proposal.raw_value,
      claim: claimBody,
      evidence_only: evidenceOnly,
    }));
  }

  const body = {
    schema_version: RESOLUTION_SCHEMA,
    contract_schema: CONTRACT_SCHEMA,
    source_id: sourceId,
    resolved,
    residuals,
  };
  return deepFreeze({ ...body, resolution_receipt_id: contentId(RESOLUTION_SCHEMA, body) });
}

module.exports = {
  FORBIDDEN_ATTRIBUTES,
  REQUIRED_ATTRIBUTES,
  RESOLUTION_SCHEMA,
  SIDES,
  resolveNoOtherRepsFraudProposals,
};
