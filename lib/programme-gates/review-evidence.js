const { domainDigest } = require('./bytes');
const { REVIEW_LANES } = require('./registry');
const { validateSchema } = require('./schema-registry');
const { verifySignature } = require('./signatures');

const CONTROLLER_DOMAIN = 'PROGRAMME_GATE_REVIEW_CONTROLLER_RECORD/V1';
const CONTROLLER_ROLE = 'REVIEW_CONTROLLER';
const INDEPENDENCE_DOMAIN = 'PROGRAMME_GATE_REVIEWER_INDEPENDENCE/V1';
const INDEPENDENCE_ROLE = 'VALIDATOR';
const BEN_APPROVAL_DOMAIN = 'PROGRAMME_GATE_BEN_APPROVAL/V1';
const BEN_APPROVAL_ROLE = 'BEN_APPROVER';
const REVIEW_SET_DOMAIN = 'PROGRAMME_GATE_REVIEW_SET/V1';
const BEN_APPROVAL_ID_DOMAIN = 'PROGRAMME_GATE_BEN_APPROVAL_ID/V1';
const REVIEWER_EDIT_SET_ROOT_DOMAIN = 'PROGRAMME_GATE_REVIEWER_EDIT_SET_ROOT/V1';
const AUTHORING_EVENT_INTERSECTION_ROOT_DOMAIN =
  'PROGRAMME_GATE_AUTHORING_EVENT_INTERSECTION_ROOT/V1';
const PRIOR_CONCLUSION_INTERSECTION_ROOT_DOMAIN =
  'PROGRAMME_GATE_PRIOR_CONCLUSION_INTERSECTION_ROOT/V1';
const EMPTY_REVIEWER_EDIT_SET_ROOT = domainDigest(REVIEWER_EDIT_SET_ROOT_DOMAIN, []);
const EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT =
  domainDigest(AUTHORING_EVENT_INTERSECTION_ROOT_DOMAIN, []);
const EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT =
  domainDigest(PRIOR_CONCLUSION_INTERSECTION_ROOT_DOMAIN, []);
const SOL_MODEL = 'gpt-5.6-sol';
const SOL_REASONING = 'xhigh';

const BEN_APPROVAL_KEYS = Object.freeze([
  'schema_version',
  'approved_root',
  'passing_review_set_evidence_id',
  'approver_identity',
  'conditions',
  'approved_at',
  'nonce',
  'signature_algorithm',
  'approver_key_id',
  'signature',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function unsigned(value, signatureField) {
  const { [signatureField]: signature, ...payload } = value;
  void signature;
  return payload;
}

function open(code, message) {
  return Object.freeze({
    valid: false,
    state: 'OPEN',
    evidence_id: null,
    reason_code: code,
    reason: message,
  });
}

function pass(evidenceId, facts) {
  return Object.freeze({
    valid: true,
    state: 'PASS',
    evidence_id: evidenceId,
    facts: Object.freeze(facts),
    reason_code: null,
    reason: null,
  });
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a SHA-256 digest`);
  }
}

function verifyController(record, lane, authority, expectedRoot, at) {
  validateSchema('TrustedReviewControllerRecord/V1', record);
  if (record.exact_specification_root !== expectedRoot
    || record.registered_prompt_id !== lane.registered_prompt_id
    || record.reviewer_disposition !== 'PASS'
    || record.parent_session_state !== 'GENESIS'
    || record.no_earlier_review_conclusions_were_inputs !== true
    || record.input_context_digest_before_review !== record.exact_input_context_digest
    || record.input_context_digest_after_review !== record.exact_input_context_digest
    || record.reviewer_edit_set_root !== EMPTY_REVIEWER_EDIT_SET_ROOT) {
    throw new Error('controller record does not prove a cold unchanged PASS review');
  }
  if (!authority.allowed_controllers.some((entry) => (
    entry.controller_id === record.controller_id
    && entry.controller_version === record.controller_version
  ))) throw new Error('controller identity or version is not allowlisted');
  if (!authority.allowed_runtimes.some((entry) => (
    entry.review_runtime_version === record.review_runtime_version
    && entry.review_runtime_binary_digest === record.review_runtime_binary_digest
    && entry.fixed_controller_runtime_context_digest
      === record.fixed_controller_runtime_context_digest
  ))) throw new Error('review runtime or fixed context is not allowlisted');
  if (!authority.allowed_prompts.some((entry) => (
    entry.lane_id === lane.lane_id
    && entry.registered_prompt_id === record.registered_prompt_id
    && entry.cold_review_prompt_digest === record.cold_review_prompt_digest
  ))) throw new Error('review prompt is not allowlisted for the lane');

  const legalEligible = authority.fable_model_identifiers.includes(record.exact_model_identifier)
    || (
      record.exact_model_identifier === SOL_MODEL
      && record.reasoning_level === SOL_REASONING
    );
  if (lane.lane_id === 'LEGAL_SEMANTIC' && !legalEligible) {
    throw new Error('legal-semantic reviewer is not eligible');
  }
  if (lane.lane_id !== 'LEGAL_SEMANTIC'
    && !authority.other_lane_model_identifiers.includes(record.exact_model_identifier)) {
    throw new Error('reviewer model is not eligible for this lane');
  }

  verifySignature({
    keyRegistry: authority.key_registry,
    keyId: record.controller_key_id,
    role: CONTROLLER_ROLE,
    domain: CONTROLLER_DOMAIN,
    payload: unsigned(record, 'controller_signature'),
    signature: record.controller_signature,
    at,
  });
}

function verifyIndependence(attestation, record, authority, at) {
  validateSchema('ReviewerIndependenceAttestation/V1', attestation);
  if (attestation.reviewer_principal_id !== record.reviewer_principal_id
    || attestation.immutable_session_id !== record.immutable_session_id
    || attestation.session_parent_or_genesis !== 'GENESIS'
    || attestation.exact_input_context_digest !== record.exact_input_context_digest
    || attestation.authoring_event_intersection_root
      !== EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT
    || attestation.prior_conclusion_intersection_root
      !== EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT
    || attestation.reviewer_edit_set_root !== EMPTY_REVIEWER_EDIT_SET_ROOT) {
    throw new Error('review independence was not recomputed from complete evidence');
  }
  if (!authority.allowed_independence_validators.some((entry) => (
    entry.validator_executable_digest === attestation.validator_executable_digest
    && entry.validator_configuration_digest === attestation.validator_configuration_digest
    && entry.validator_key_id === attestation.validator_key_id
  ))) throw new Error('independence validator is not allowlisted');

  verifySignature({
    keyRegistry: authority.key_registry,
    keyId: attestation.validator_key_id,
    role: INDEPENDENCE_ROLE,
    domain: INDEPENDENCE_DOMAIN,
    payload: unsigned(attestation, 'signature'),
    signature: attestation.signature,
    at,
  });
}

function verifyReviewSetEvidence(input) {
  try {
    if (!isRecord(input)
      || !Array.isArray(input.members)
      || !isRecord(input.authority)
      || typeof input.at === 'undefined') {
      throw new Error('review-set input is incomplete');
    }
    requireDigest(input.expected_specification_root, 'expected specification root');
    const expectedLanes = REVIEW_LANES.map((lane) => lane.lane_id);
    if (input.members.length !== expectedLanes.length) {
      throw new Error('review set must contain exactly five lanes');
    }
    const laneIds = input.members.map((member) => member && member.lane_id);
    if (new Set(laneIds).size !== expectedLanes.length
      || !expectedLanes.every((laneId) => laneIds.includes(laneId))) {
      throw new Error('review set has missing or duplicate lanes');
    }
    const nonces = new Set();
    const principals = new Set();
    const ordered = REVIEW_LANES.map((lane) => {
      const member = input.members.find((candidate) => candidate.lane_id === lane.lane_id);
      if (!exactKeys(member, ['lane_id', 'controller_record', 'independence_attestation'])) {
        throw new Error('review lane member has an open or incomplete shape');
      }
      verifyController(
        member.controller_record,
        lane,
        input.authority,
        input.expected_specification_root,
        input.at,
      );
      verifyIndependence(
        member.independence_attestation,
        member.controller_record,
        input.authority,
        input.at,
      );
      if (nonces.has(member.controller_record.nonce)
        || principals.has(member.controller_record.reviewer_principal_id)) {
        throw new Error('review nonce and principal must be unique per lane');
      }
      nonces.add(member.controller_record.nonce);
      principals.add(member.controller_record.reviewer_principal_id);
      return member;
    });
    const evidenceId = domainDigest(REVIEW_SET_DOMAIN, ordered);
    return pass(evidenceId, {
      reviewed_root: input.expected_specification_root,
      lane_ids: Object.freeze(expectedLanes),
      all_dispositions_pass: true,
      legal_reviewer_eligible: true,
      independence_recomputed: true,
      root_before: input.expected_specification_root,
      root_after: input.expected_specification_root,
    });
  } catch (error) {
    return open('REVIEW_SET_NOT_VERIFIED', error.message);
  }
}

function validateBenApprovalRecord(record) {
  if (!exactKeys(record, BEN_APPROVAL_KEYS)
    || record.schema_version !== 'BenSpecificationApproval/V1'
    || record.approver_identity !== 'BEN_GOODCHILD'
    || record.signature_algorithm !== 'Ed25519'
    || !Array.isArray(record.conditions)
    || typeof record.approved_at !== 'string'
    || !Number.isFinite(Date.parse(record.approved_at))
    || typeof record.nonce !== 'string'
    || record.nonce.length === 0
    || typeof record.approver_key_id !== 'string'
    || record.approver_key_id.length === 0
    || typeof record.signature !== 'string'
    || record.signature.length === 0) {
    throw new Error('Ben approval record is not a closed signed record');
  }
  requireDigest(record.approved_root, 'approved root');
  requireDigest(record.passing_review_set_evidence_id, 'passing review-set evidence ID');
}

function verifyBenApprovalEvidence(input) {
  try {
    if (!isRecord(input) || !isRecord(input.record) || !isRecord(input.authority)) {
      throw new Error('Ben approval input is incomplete');
    }
    validateBenApprovalRecord(input.record);
    if (input.record.approved_root !== input.expected_specification_root
      || input.record.passing_review_set_evidence_id !== input.passing_review_set_evidence_id
      || input.record.conditions.length !== 0) {
      throw new Error('Ben approval is conditional or bound to another reviewed root');
    }
    verifySignature({
      keyRegistry: input.authority.key_registry,
      keyId: input.record.approver_key_id,
      role: BEN_APPROVAL_ROLE,
      domain: BEN_APPROVAL_DOMAIN,
      payload: unsigned(input.record, 'signature'),
      signature: input.record.signature,
      at: input.at,
    });
    const evidenceId = domainDigest(BEN_APPROVAL_ID_DOMAIN, input.record);
    return pass(evidenceId, {
      approved_root: input.record.approved_root,
      passing_review_set_evidence_id: input.record.passing_review_set_evidence_id,
      identity_and_signature_verified: true,
      unconditional: true,
    });
  } catch (error) {
    return open('BEN_APPROVAL_NOT_VERIFIED', error.message);
  }
}

module.exports = {
  BEN_APPROVAL_DOMAIN,
  BEN_APPROVAL_ROLE,
  CONTROLLER_DOMAIN,
  CONTROLLER_ROLE,
  EMPTY_AUTHORING_EVENT_INTERSECTION_ROOT,
  EMPTY_PRIOR_CONCLUSION_INTERSECTION_ROOT,
  EMPTY_REVIEWER_EDIT_SET_ROOT,
  INDEPENDENCE_DOMAIN,
  INDEPENDENCE_ROLE,
  verifyBenApprovalEvidence,
  verifyReviewSetEvidence,
};
