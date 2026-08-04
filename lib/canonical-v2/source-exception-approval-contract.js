'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

const SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA = 'SOURCE_EXCEPTION_APPROVAL_PROPOSAL/V1';
const SOURCE_EXCEPTION_APPROVAL_READINESS_SCHEMA = 'SOURCE_EXCEPTION_APPROVAL_READINESS/V1';
const SOURCE_EXCEPTION_APPROVAL_AUTHORITY_SCHEMA = 'SOURCE_EXCEPTION_APPROVAL_AUTHORITY_BUNDLE/V1';
const PROPOSAL_STATUS = 'PROPOSED_NOT_APPROVAL_AUTHORITY';
const TRUSTED_CONTROLLER_BLOCKER = 'TRUSTED_SOURCE_EXCEPTION_APPROVAL_CONTROLLER_AND_REGISTRY_AMENDMENT_REQUIRED';
const TOPBUILD_SECOND_OCCURRENCE_ID = 'TOPBUILD/SECOND_SEC_AGREEMENT_OCCURRENCE';
const EXCEPTION_KINDS = Object.freeze([
  'FINAL_NON_INCLUDE',
  'EXCEPTIONAL_ADMISSION',
  'REACQUISITION_REPLACEMENT',
]);

class SourceExceptionApprovalContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SourceExceptionApprovalContractError';
    this.code = code;
  }
}

function fail(code, message) { throw new SourceExceptionApprovalContractError(code, message); }
function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) fail('INVALID_SOURCE_EXCEPTION_REQUEST', `${label} must be a non-empty trimmed string.`);
  return value;
}
function digest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('INVALID_SOURCE_EXCEPTION_REQUEST', `${label} must be a SHA-256 digest.`);
  return value;
}
function nullableText(value, label) {
  if (value !== null) text(value, label);
  return value;
}
function exactTimestamp(value, label) {
  text(value, label);
  if (Number.isNaN(Date.parse(value))) fail('INVALID_SOURCE_EXCEPTION_REQUEST', `${label} must be an ISO timestamp.`);
  return value;
}

function normalizeOccurrence(value) {
  if (!exactKeys(value, ['occurrence_id', 'governed_deal_key', 'source_locator'])) {
    fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'occurrence must bind only the exact occurrence, governed deal and source locator.');
  }
  return Object.freeze({
    occurrence_id: text(value.occurrence_id, 'occurrence.occurrence_id'),
    governed_deal_key: text(value.governed_deal_key, 'occurrence.governed_deal_key'),
    source_locator: text(value.source_locator, 'occurrence.source_locator'),
  });
}

function normalizeSourceMaterial(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'source_material must be explicit.');
  if (value.kind === 'EXACT_SOURCE_BYTES') {
    if (!exactKeys(value, ['kind', 'raw_sha256', 'raw_byte_length'])) fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'exact source material has an invalid closed shape.');
    digest(value.raw_sha256, 'source_material.raw_sha256');
    if (!Number.isSafeInteger(value.raw_byte_length) || value.raw_byte_length <= 0) fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'source_material.raw_byte_length must be a positive safe integer.');
    return Object.freeze({ ...value });
  }
  if (value.kind === 'UNRESOLVED_SOURCE_EVIDENCE') {
    if (!exactKeys(value, ['kind', 'evidence_id', 'exact_text', 'exact_text_sha256'])) fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'unresolved source material has an invalid closed shape.');
    text(value.evidence_id, 'source_material.evidence_id');
    text(value.exact_text, 'source_material.exact_text');
    digest(value.exact_text_sha256, 'source_material.exact_text_sha256');
    if (sha256Hex(value.exact_text) !== value.exact_text_sha256) fail('SOURCE_EXCEPTION_EVIDENCE_HASH_MISMATCH', 'unresolved source evidence must bind its exact text bytes.');
    return Object.freeze({ ...value });
  }
  fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'source_material.kind must be EXACT_SOURCE_BYTES or UNRESOLVED_SOURCE_EVIDENCE.');
}

function normalizeReview(value) {
  if (!exactKeys(value, ['review_record_id', 'reviewer_role', 'reviewed_at', 'evidence_digest'])) {
    fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'independent_review_record has an invalid closed shape.');
  }
  return Object.freeze({
    review_record_id: text(value.review_record_id, 'independent_review_record.review_record_id'),
    reviewer_role: text(value.reviewer_role, 'independent_review_record.reviewer_role'),
    reviewed_at: exactTimestamp(value.reviewed_at, 'independent_review_record.reviewed_at'),
    evidence_digest: digest(value.evidence_digest, 'independent_review_record.evidence_digest'),
  });
}

function normalizePredecessor(value) {
  if (!exactKeys(value, ['predecessor_proposal_id', 'predecessor_occurrence_id'])) {
    fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'predecessor has an invalid closed shape.');
  }
  if (value.predecessor_proposal_id !== null) digest(value.predecessor_proposal_id, 'predecessor.predecessor_proposal_id');
  nullableText(value.predecessor_occurrence_id, 'predecessor.predecessor_occurrence_id');
  return Object.freeze({ ...value });
}

function normalizeSupersession(value) {
  if (!exactKeys(value, ['state', 'supersedes_proposal_id'])) {
    fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'supersession has an invalid closed shape.');
  }
  if (!['NONE', 'REPLACES_PRIOR_PROPOSAL'].includes(value.state)) fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'supersession.state is invalid.');
  if (value.state === 'NONE' && value.supersedes_proposal_id !== null) fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'a non-superseding request cannot name a superseded proposal.');
  if (value.state === 'REPLACES_PRIOR_PROPOSAL') digest(value.supersedes_proposal_id, 'supersession.supersedes_proposal_id');
  return Object.freeze({ ...value });
}

function validateKind({ exception_kind: exceptionKind, occurrence, source_material: sourceMaterial, requested_disposition: requestedDisposition, reason_code: reasonCode, retained_occurrence_id: retainedOccurrenceId, replacement_occurrence_id: replacementOccurrenceId, predecessor }) {
  if (!EXCEPTION_KINDS.includes(exceptionKind)) fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'exception_kind is not supported.');
  if (occurrence.occurrence_id === TOPBUILD_SECOND_OCCURRENCE_ID) {
    fail('ORDINARY_TOPBUILD_INCLUSION_OUTSIDE_EXCEPTION_CONTRACT', 'The ordinary TopBuild second occurrence cannot use the exception request contract.');
  }
  if (exceptionKind === 'FINAL_NON_INCLUDE') {
    if (!['NON_DOCUMENT_TRANSPORT', 'OUT_OF_PROGRAMME_SCOPE'].includes(requestedDisposition)
      || !['FINAL_NON_INCLUDE_REVIEWED', 'UNRESOLVED_SOURCE_FINAL_DISPOSITION'].includes(reasonCode)
      || retainedOccurrenceId !== null || replacementOccurrenceId !== null
      || predecessor.predecessor_occurrence_id !== null) {
      fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'final non-includes require a final non-include disposition and no replacement binding.');
    }
    return;
  }
  if (exceptionKind === 'EXCEPTIONAL_ADMISSION') {
    if (!['INCLUDE_AS_ROLE', 'INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE'].includes(requestedDisposition)
      || !['NON_STANDARD_SOURCE_ROLE', 'EXCEPTIONAL_LEGAL_SOURCE_REQUIRED'].includes(reasonCode)
      || sourceMaterial.kind !== 'EXACT_SOURCE_BYTES'
      || retainedOccurrenceId !== null || replacementOccurrenceId !== null
      || predecessor.predecessor_occurrence_id !== null) {
      fail('ORDINARY_SOURCE_ADMISSION_OUTSIDE_EXCEPTION_CONTRACT', 'exceptional admission must state a non-standard basis, exact bytes and no ordinary replacement binding.');
    }
    return;
  }
  if (requestedDisposition !== 'REPLACE_REACQUIRED_SOURCE'
    || reasonCode !== 'REACQUIRED_SOURCE_REPLACES_UNRESOLVED_OCCURRENCE'
    || sourceMaterial.kind !== 'EXACT_SOURCE_BYTES'
    || retainedOccurrenceId === null || replacementOccurrenceId !== occurrence.occurrence_id
    || predecessor.predecessor_occurrence_id !== retainedOccurrenceId) {
    fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'reacquisition replacement must bind exact bytes, its unresolved predecessor and the replacing occurrence.');
  }
}

function proposalInput(input) {
  if (!exactKeys(input, [
    'approval_nonce', 'exception_kind', 'expires_at', 'independent_review_record', 'one_use_state',
    'occurrence', 'policy_version', 'predecessor', 'reason_code', 'replacement_occurrence_id',
    'requested_disposition', 'retained_occurrence_id', 'source_material', 'supersession',
  ])) fail('INVALID_SOURCE_EXCEPTION_REQUEST', 'source exception request has an invalid closed shape.');
  const occurrence = normalizeOccurrence(input.occurrence);
  const sourceMaterial = normalizeSourceMaterial(input.source_material);
  const predecessor = normalizePredecessor(input.predecessor);
  const supersession = normalizeSupersession(input.supersession);
  const normalized = {
    exception_kind: text(input.exception_kind, 'exception_kind'),
    occurrence,
    source_material: sourceMaterial,
    requested_disposition: text(input.requested_disposition, 'requested_disposition'),
    reason_code: text(input.reason_code, 'reason_code'),
    retained_occurrence_id: nullableText(input.retained_occurrence_id, 'retained_occurrence_id'),
    replacement_occurrence_id: nullableText(input.replacement_occurrence_id, 'replacement_occurrence_id'),
    independent_review_record: normalizeReview(input.independent_review_record),
    policy_version: text(input.policy_version, 'policy_version'),
    approval_nonce: text(input.approval_nonce, 'approval_nonce'),
    predecessor,
    supersession,
    expires_at: exactTimestamp(input.expires_at, 'expires_at'),
    one_use_state: input.one_use_state,
  };
  if (normalized.one_use_state !== 'UNUSED_PENDING_TRUSTED_CONTROLLER') {
    fail('SOURCE_EXCEPTION_ONE_USE_STATE_INVALID', 'a proposal cannot self-mark its approval nonce as consumed or reusable.');
  }
  validateKind({ ...normalized });
  return normalized;
}

function buildSourceExceptionApprovalProposal(input = {}) {
  const request = proposalInput(input);
  const body = {
    schema_version: SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA,
    status: PROPOSAL_STATUS,
    authority: 'NONE',
    approval_status: 'NOT_ISSUED',
    ...request,
  };
  return Object.freeze({ ...body, source_exception_approval_proposal_id: contentId(SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA, body) });
}

function validateSourceExceptionApprovalProposal(proposal) {
  const keys = [
    'approval_nonce', 'approval_status', 'authority', 'exception_kind', 'expires_at', 'independent_review_record',
    'one_use_state', 'occurrence', 'policy_version', 'predecessor', 'reason_code', 'replacement_occurrence_id',
    'requested_disposition', 'retained_occurrence_id', 'schema_version', 'source_exception_approval_proposal_id',
    'source_material', 'status', 'supersession',
  ];
  if (!exactKeys(proposal, keys) || proposal.schema_version !== SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA
    || proposal.status !== PROPOSAL_STATUS || proposal.authority !== 'NONE' || proposal.approval_status !== 'NOT_ISSUED') {
    fail('SOURCE_EXCEPTION_PROPOSAL_INVALID', 'source exception proposal must remain a closed non-authority record.');
  }
  const { schema_version: _schema, status: _status, authority: _authority, approval_status: _approval, source_exception_approval_proposal_id: proposalId, ...request } = proposal;
  const expected = buildSourceExceptionApprovalProposal(request);
  if (proposalId !== expected.source_exception_approval_proposal_id || canonicalJson(proposal) !== canonicalJson(expected)) {
    fail('SOURCE_EXCEPTION_PROPOSAL_INVALID', 'source exception proposal does not match its deterministic content identity.');
  }
  return expected;
}

function buildSourceExceptionApprovalReadiness({ proposal = null } = {}) {
  let proposalId = null;
  let status = 'NO_EXCEPTION_REQUEST';
  if (proposal !== null) {
    proposalId = validateSourceExceptionApprovalProposal(proposal).source_exception_approval_proposal_id;
    status = 'PROPOSAL_REQUIRES_TRUSTED_CONTROLLER';
  }
  const body = {
    schema_version: SOURCE_EXCEPTION_APPROVAL_READINESS_SCHEMA,
    status,
    authority: 'NONE',
    proposal_schema: SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA,
    authority_schema: SOURCE_EXCEPTION_APPROVAL_AUTHORITY_SCHEMA,
    proposal_id: proposalId,
    controller_blocker: TRUSTED_CONTROLLER_BLOCKER,
  };
  return Object.freeze({ ...body, source_exception_approval_readiness_id: contentId(SOURCE_EXCEPTION_APPROVAL_READINESS_SCHEMA, body) });
}

function verifyIssuedSourceExceptionApproval({ proposal, authority_bundle: authorityBundle } = {}) {
  validateSourceExceptionApprovalProposal(proposal);
  if (authorityBundle !== undefined && authorityBundle !== null) {
    if (!exactKeys(authorityBundle, ['schema_version', 'source_exception_approval_proposal_id', 'approval_nonce', 'consumption_state'])) {
      fail('SOURCE_EXCEPTION_AUTHORITY_BUNDLE_INVALID', 'the authority bundle has an invalid closed shape.');
    }
  }
  fail('TRUSTED_SOURCE_EXCEPTION_APPROVAL_CONTROLLER_UNAVAILABLE', 'Caller records cannot issue or verify a source exception approval pending a trusted controller and registry amendment.');
}

function consumeIssuedSourceExceptionApproval(input = {}) {
  verifyIssuedSourceExceptionApproval(input);
}

module.exports = {
  EXCEPTION_KINDS,
  PROPOSAL_STATUS,
  SOURCE_EXCEPTION_APPROVAL_AUTHORITY_SCHEMA,
  SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA,
  SOURCE_EXCEPTION_APPROVAL_READINESS_SCHEMA,
  TOPBUILD_SECOND_OCCURRENCE_ID,
  TRUSTED_CONTROLLER_BLOCKER,
  SourceExceptionApprovalContractError,
  buildSourceExceptionApprovalProposal,
  buildSourceExceptionApprovalReadiness,
  consumeIssuedSourceExceptionApproval,
  validateSourceExceptionApprovalProposal,
  verifyIssuedSourceExceptionApproval,
};
