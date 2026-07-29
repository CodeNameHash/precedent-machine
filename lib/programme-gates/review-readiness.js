const { domainDigest } = require('./bytes');
const { evaluateAcceptanceClaims } = require('./predicates');
const { acceptanceDescriptorForContract } = require('./registry');
const {
  projectBenApprovalEvidence,
  projectReviewSetAttestation,
  verifyBenApprovalEvidence,
  verifyReviewSetEvidence,
} = require('./review-evidence');
const { createReviewContractBundle } = require('./review-contracts');
const {
  BEN_APPROVAL_CONTRACT,
  REVIEW_SET_CONTRACT,
  benApprovalMembers,
  memberSchemaSetForReview,
  reviewSetMembers,
} = require('./review-enumerator');
const { validateSchema } = require('./schema-registry');
const { verifySignature } = require('./signatures');

const REVIEW_GATE_ORDER = Object.freeze([
  'G0_EXACT_DIGEST_REVIEW_SET',
  'G0_BEN_SPEC_APPROVAL',
]);
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const authorityBrands = new WeakSet();

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} does not match its closed input`);
  }
}

function requirePattern(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError(`${label} is invalid`);
  }
  return value;
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string'
    || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical UTC timestamp`);
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createReviewApprovalReadinessAuthority(input) {
  requireExactKeys(input, [
    'codeCommit',
    'environment',
    'observedAt',
    'specificationRoot',
    'verificationTime',
  ], 'review-approval readiness authority');
  const specificationRoot = requirePattern(
    input.specificationRoot,
    DIGEST_PATTERN,
    'specification root',
  );
  const codeCommit = requirePattern(input.codeCommit, COMMIT_PATTERN, 'code commit');
  if (!['STAGING', 'PRODUCTION'].includes(input.environment)) {
    throw new Error('environment must be STAGING or PRODUCTION');
  }
  const observedAt = requireTimestamp(input.observedAt, 'observed_at');
  const verificationTime = requireTimestamp(input.verificationTime, 'verification time');
  if (Date.parse(observedAt) > Date.parse(verificationTime)) {
    throw new Error('observed_at cannot be newer than the trusted verification time');
  }
  const authority = deepFreeze({
    specificationRoot,
    codeCommit,
    environment: input.environment,
    observedAt,
    verificationTime,
  });
  authorityBrands.add(authority);
  return authority;
}

function requireAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed review-approval readiness authority is required');
  }
  return value;
}

function validateTestResult(testResult, authority, expectedTestId) {
  validateSchema('ProgrammeGateTestExecutionRecord/V1', testResult);
  if (testResult.test_id !== expectedTestId
    || testResult.code_commit !== authority.codeCommit
    || testResult.environment !== authority.environment
    || testResult.exit_code !== 0
    || Date.parse(testResult.completed_at) > Date.parse(authority.observedAt)) {
    throw new Error(`${expectedTestId} execution does not match review evidence`);
  }
}

function gateForContract(evidenceContract) {
  const descriptor = acceptanceDescriptorForContract(evidenceContract);
  return Object.freeze({
    id: descriptor.gate_id,
    evidence_contract: descriptor.evidence_contract,
    required_evidence_object_type: descriptor.evidence_object_type,
    acceptance_claims: descriptor.ordered_claim_keys,
    required_adversarial_tests: descriptor.required_adversarial_tests,
  });
}

function reviewSubject(evidenceObject, observedAt) {
  return Object.freeze({
    gate_id: 'G0_EXACT_DIGEST_REVIEW_SET',
    reviewed_root: evidenceObject.reviewed_root,
    reviewed_code_commit: evidenceObject.reviewed_code_commit,
    review_set_evidence_id: evidenceObject.review_set_evidence_id,
    observed_at: observedAt,
  });
}

function approvalSubject(evidenceObject, observedAt) {
  return Object.freeze({
    gate_id: 'G0_BEN_SPEC_APPROVAL',
    approved_root: evidenceObject.approved_root,
    approved_code_commit: evidenceObject.approved_code_commit,
    approval_evidence_id: evidenceObject.approval_evidence_id,
    observed_at: observedAt,
  });
}

function claimsFor({
  authority,
  gate,
  evidenceObject,
  members,
  keyRegistry,
}) {
  const claims = evaluateAcceptanceClaims({
    gate_id: gate.id,
    evidence: evidenceObject,
    context: {
      specificationRoot: authority.specificationRoot,
      codeCommit: authority.codeCommit,
      environment: authority.environment,
      expectedSpecificationRoot: authority.specificationRoot,
      expectedCodeCommit: authority.codeCommit,
      expectedEnvironment: authority.environment,
      observed_at: authority.observedAt,
      clock: { now: () => authority.verificationTime },
      immutableMembers: members,
      keyRegistry,
      verifySignature,
      domainDigest,
    },
  });
  if (claims.some((claim) => claim.typed_value !== true)) {
    throw new Error(`${gate.id} does not satisfy its exact acceptance claims`);
  }
  return claims;
}

function buildReviewApprovalReadiness(input) {
  requireExactKeys(input, [
    'authority',
    'benApproval',
    'gateTestResult',
    'reviewContextTestResult',
    'reviewSet',
  ], 'review-approval readiness input');
  requireExactKeys(input.reviewSet, ['authority', 'members'], 'review-set input');
  requireExactKeys(input.benApproval, ['authority', 'record'], 'Ben approval input');
  const authority = requireAuthority(input.authority);
  validateTestResult(input.gateTestResult, authority, 'GATE-01');
  validateTestResult(input.reviewContextTestResult, authority, 'REVIEW-CONTEXT-01');
  if (!Array.isArray(input.reviewSet.members)
    || input.reviewSet.members.some((member) => (
      !member
      || !member.controller_record
      || Date.parse(member.controller_record.review_end_time)
        > Date.parse(authority.observedAt)
    ))) {
    throw new Error('review-set members are incomplete or newer than the observation');
  }
  if (Date.parse(input.benApproval.record.approved_at) > Date.parse(authority.observedAt)) {
    throw new Error('Ben approval is newer than the evidence observation');
  }

  const reviewVerification = verifyReviewSetEvidence({
    expected_code_commit: input.benApproval.record.reviewed_code_commit,
    expected_specification_root: input.benApproval.record.reviewed_root,
    review_artifact_byte_size: input.benApproval.record.review_artifact_byte_size,
    review_artifact_sha256: input.benApproval.record.review_artifact_sha256,
    members: input.reviewSet.members,
    authority: input.reviewSet.authority,
    at: authority.verificationTime,
  });
  if (reviewVerification.valid !== true) {
    throw new Error(`review set is OPEN: ${reviewVerification.reason}`);
  }
  const approvalVerification = verifyBenApprovalEvidence({
    record: input.benApproval.record,
    expected_code_commit: authority.codeCommit,
    expected_specification_root: authority.specificationRoot,
    review_set_evidence_id: reviewVerification.evidence_id,
    reviewed_code_commit: reviewVerification.facts.reviewed_code_commit,
    reviewed_root: reviewVerification.facts.reviewed_root,
    authority: input.benApproval.authority,
    at: authority.verificationTime,
  });
  if (approvalVerification.valid !== true) {
    throw new Error(`Ben approval is OPEN: ${approvalVerification.reason}`);
  }

  const reviewEvidence = projectReviewSetAttestation(reviewVerification);
  const approvalEvidence = projectBenApprovalEvidence(
    approvalVerification,
    input.benApproval.record,
  );
  const keyRegistry = deepFreeze({
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [
      ...input.reviewSet.authority.key_registry.keys,
      ...input.benApproval.authority.key_registry.keys,
    ].filter((entry, index, all) => (
      all.findIndex((candidate) => candidate.key_id === entry.key_id) === index
    )),
  });
  const contracts = createReviewContractBundle({
    specificationRoot: authority.specificationRoot,
  });
  const definitionsByContract = new Map(
    contracts.definitions.map((definition) => [definition.evidence_contract, definition]),
  );
  const reviewGate = gateForContract(REVIEW_SET_CONTRACT);
  const approvalGate = gateForContract(BEN_APPROVAL_CONTRACT);
  const reviewDefinition = definitionsByContract.get(REVIEW_SET_CONTRACT);
  const approvalDefinition = definitionsByContract.get(BEN_APPROVAL_CONTRACT);
  const candidates = [
    {
      gate: reviewGate,
      definition: reviewDefinition,
      evidenceObject: reviewEvidence,
      evidenceSubject: reviewSubject(reviewEvidence, authority.observedAt),
      members: reviewSetMembers(structuredClone(input.reviewSet.members)),
      tests: structuredClone([input.gateTestResult, input.reviewContextTestResult]),
    },
    {
      gate: approvalGate,
      definition: approvalDefinition,
      evidenceObject: approvalEvidence,
      evidenceSubject: approvalSubject(approvalEvidence, authority.observedAt),
      members: benApprovalMembers({
        approvalEvidenceId: approvalEvidence.approval_evidence_id,
        approvalRecord: structuredClone(input.benApproval.record),
        reviewSetAttestation: reviewEvidence,
      }),
      tests: structuredClone([input.gateTestResult]),
    },
  ].map((entry) => {
    if (!entry.definition) {
      throw new Error(`${entry.gate.id} has no exact acceptance definition`);
    }
    validateSchema(entry.definition.evidence_object_json_schema_id, entry.evidenceObject);
    return Object.freeze({
      gate_id: entry.gate.id,
      evidence_contract: entry.gate.evidence_contract,
      acceptance_definition_id: entry.definition.definition_id,
      evidence_subject: entry.evidenceSubject,
      evidence_object: entry.evidenceObject,
      members: entry.members,
      member_schema_set: memberSchemaSetForReview(entry.gate.evidence_contract),
      test_results: Object.freeze(entry.tests),
      exact_acceptance_claims: claimsFor({
        authority,
        gate: entry.gate,
        evidenceObject: entry.evidenceObject,
        members: entry.members,
        keyRegistry,
      }),
      signature: null,
      formal_gate_state: 'OPEN',
      readiness_state: 'READY_FOR_SIGNATURE',
    });
  });
  if (candidates.some((candidate, index) => candidate.gate_id !== REVIEW_GATE_ORDER[index])) {
    throw new Error('review candidates do not match the closed gate order');
  }
  return deepFreeze({
    readiness_type: 'ProgrammeGateReviewApprovalReadiness/V1',
    specification_root: authority.specificationRoot,
    code_commit: authority.codeCommit,
    environment: authority.environment,
    observed_at: authority.observedAt,
    review_set_evidence_id: reviewVerification.evidence_id,
    approval_evidence_id: approvalVerification.evidence_id,
    candidates,
    acceptance_definitions: contracts.definitions,
    executable_bindings: contracts.executable_bindings,
    readiness_state: 'READY_FOR_SIGNATURE',
    formal_gate_state: 'OPEN',
    private_key_used: false,
    status_publication_attempted: false,
  });
}

module.exports = {
  REVIEW_GATE_ORDER,
  buildReviewApprovalReadiness,
  createReviewApprovalReadinessAuthority,
};
