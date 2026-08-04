'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const SCHEMA = 'CONTENT_REVIEWED_DEFINITION_RECLASSIFICATION_PROPOSAL/V1';
const ONE_USE_DECISION_DOMAIN = 'CONTENT_REVIEWED_DEFINITION_RECLASSIFICATION_DECISION/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;
const NONCE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

class ContentReviewedDefinitionReclassificationContractError extends Error {
  constructor(code, message) { super(message); this.name = 'ContentReviewedDefinitionReclassificationContractError'; this.code = code; }
}

function fail(code, message) { throw new ContentReviewedDefinitionReclassificationContractError(code, message); }
function plain(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function exactKeys(value, keys, label) {
  if (!plain(value) || !same(Object.keys(value).sort(), [...keys].sort())) fail('RECLASSIFICATION_EXACT_KEY_SET_REQUIRED', `${label} has unsupported or missing fields.`);
}
function requireDigest(value, label) { if (typeof value !== 'string' || !DIGEST_RE.test(value)) fail('RECLASSIFICATION_DIGEST_INVALID', `${label} must be a SHA-256 identifier.`); }
function requireText(value, label) { if (typeof value !== 'string' || value.trim() !== value || value.length === 0) fail('RECLASSIFICATION_TEXT_INVALID', `${label} must be non-empty trimmed text.`); }
function requireNonce(value, label) { if (typeof value !== 'string' || !NONCE_RE.test(value)) fail('RECLASSIFICATION_NONCE_INVALID', `${label} must be an opaque bounded nonce.`); }
function freeze(value) { return Object.freeze(structuredClone(value)); }

function validateSourceStructure(value) {
  exactKeys(value, ['provision_instance_id', 'section_reference', 'structural_path'], 'Source structure');
  requireDigest(value.provision_instance_id, 'Source structure provision instance');
  requireText(value.section_reference, 'Source structure section reference');
  if (!Array.isArray(value.structural_path) || value.structural_path.length === 0) fail('RECLASSIFICATION_SOURCE_STRUCTURE_INVALID', 'Source structure must retain a non-empty structural path.');
  value.structural_path.forEach((part, index) => requireText(part, `Source structure path ${index}`));
}

function validateSourceEvidence(value, exactText) {
  if (!Array.isArray(value) || value.length === 0) fail('RECLASSIFICATION_EVIDENCE_REQUIRED', 'Content-reviewed reclassification requires exact source evidence.');
  const evidenceIds = new Set();
  for (const [index, item] of value.entries()) {
    exactKeys(item, ['absolute_end', 'absolute_start', 'evidence_id', 'exact_quote', 'source_document_id'], `Source evidence ${index}`);
    requireDigest(item.evidence_id, `Source evidence ${index} identifier`); requireDigest(item.source_document_id, `Source evidence ${index} document`);
    requireText(item.exact_quote, `Source evidence ${index} exact quote`);
    if (!Number.isSafeInteger(item.absolute_start) || !Number.isSafeInteger(item.absolute_end) || item.absolute_start < 0
      || item.absolute_end - item.absolute_start !== Buffer.byteLength(item.exact_quote, 'utf8') || !exactText.includes(item.exact_quote)) {
      fail('RECLASSIFICATION_EVIDENCE_INVALID', 'Source evidence must retain byte-exact quoted content found in the reviewed text.');
    }
    if (evidenceIds.has(item.evidence_id)) fail('RECLASSIFICATION_EVIDENCE_DUPLICATE', 'Source evidence identifiers must be unique.');
    evidenceIds.add(item.evidence_id);
  }
}

function decisionPayload(value) {
  return {
    provision_type: value.provision_type,
    provision_subtype: value.provision_subtype,
    source_structure: value.source_structure,
    exact_text: value.exact_text,
    source_evidence: value.source_evidence,
    old_owner: value.old_owner,
    proposed_new_owner: value.proposed_new_owner,
    reviewed_reason: value.reviewed_reason,
    reviewer_attestation_reference: value.reviewer_attestation_reference,
    one_use_nonce: value.one_use_nonce,
    predecessor_decision_identity: value.predecessor_decision_identity,
  };
}

function validateReclassificationBindings(value) {
  requireText(value.provision_type, 'Provision type'); requireText(value.provision_subtype, 'Provision subtype');
  requireText(value.exact_text, 'Exact reviewed text'); validateSourceStructure(value.source_structure); validateSourceEvidence(value.source_evidence, value.exact_text);
  requireText(value.old_owner, 'Old owner'); requireText(value.proposed_new_owner, 'Proposed new owner');
  if (value.old_owner === value.proposed_new_owner) fail('RECLASSIFICATION_OWNER_NOOP_FORBIDDEN', 'Reclassification requires distinct old and proposed owners.');
  requireText(value.reviewed_reason, 'Reviewed reason'); requireDigest(value.reviewer_attestation_reference, 'Reviewer attestation reference'); requireNonce(value.one_use_nonce, 'One-use decision nonce');
}

function validateContentReviewedDefinitionReclassificationProposal(value) {
  exactKeys(value, [
    'authority', 'consumption_state', 'exact_text', 'mutation_authority', 'old_owner', 'one_use_decision_identity',
    'one_use_nonce', 'predecessor_decision_identity', 'proposal_id', 'proposed_new_owner', 'provision_subtype',
    'provision_type', 'reviewed_reason', 'reviewer_attestation_reference', 'schema_version', 'source_evidence',
    'source_structure', 'state',
  ], 'Content-reviewed definition reclassification proposal');
  if (value.schema_version !== SCHEMA || value.state !== 'PROPOSAL_ONLY_PENDING_REVIEWER_ATTESTATION'
    || value.authority !== 'NONE' || value.mutation_authority !== 'NONE' || value.consumption_state !== 'UNCONSUMED_PROPOSAL_ONLY'
    || value.predecessor_decision_identity !== 'NONE') {
    fail('RECLASSIFICATION_STATE_INVALID', 'Reclassification remains a non-mutating, unconsumed proposal with no authority.');
  }
  validateReclassificationBindings(value);
  if (value.one_use_decision_identity !== contentId(ONE_USE_DECISION_DOMAIN, decisionPayload(value))) {
    fail('RECLASSIFICATION_DECISION_ID_INVALID', 'One-use decision identity must bind the reviewed content, evidence, ownership change, attestation, and nonce.');
  }
  const { proposal_id: identifier, ...body } = value;
  if (identifier !== contentId(SCHEMA, body)) fail('RECLASSIFICATION_PROPOSAL_ID_INVALID', 'Reclassification proposal identity is invalid.');
  return freeze(value);
}

function buildContentReviewedDefinitionReclassificationProposal(input = {}) {
  exactKeys(input, [
    'exact_text', 'old_owner', 'one_use_nonce', 'proposed_new_owner', 'provision_subtype', 'provision_type',
    'reviewed_reason', 'reviewer_attestation_reference', 'source_evidence', 'source_structure',
  ], 'Content-reviewed definition reclassification input');
  validateReclassificationBindings(input);
  const body = {
    schema_version: SCHEMA,
    state: 'PROPOSAL_ONLY_PENDING_REVIEWER_ATTESTATION',
    authority: 'NONE', mutation_authority: 'NONE', consumption_state: 'UNCONSUMED_PROPOSAL_ONLY',
    predecessor_decision_identity: 'NONE',
    ...input,
  };
  const withDecision = { ...body, one_use_decision_identity: contentId(ONE_USE_DECISION_DOMAIN, decisionPayload(body)) };
  return validateContentReviewedDefinitionReclassificationProposal({ ...withDecision, proposal_id: contentId(SCHEMA, withDecision) });
}

function validateContentReviewedDefinitionReclassificationProposalSet(value) {
  if (!Array.isArray(value)) fail('RECLASSIFICATION_PROPOSAL_SET_INVALID', 'Reclassification proposal set must be an array.');
  const proposals = value.map(validateContentReviewedDefinitionReclassificationProposal);
  for (const key of ['proposal_id', 'one_use_decision_identity', 'one_use_nonce']) {
    if (new Set(proposals.map((proposal) => proposal[key])).size !== proposals.length) fail('RECLASSIFICATION_DECISION_REPLAY', `Reclassification proposal set reuses ${key}.`);
  }
  return freeze(proposals);
}

module.exports = {
  ContentReviewedDefinitionReclassificationContractError,
  ONE_USE_DECISION_DOMAIN,
  SCHEMA,
  buildContentReviewedDefinitionReclassificationProposal,
  validateContentReviewedDefinitionReclassificationProposal,
  validateContentReviewedDefinitionReclassificationProposalSet,
};
