const crypto = require('node:crypto');

const { domainDigest, signatureBytes } = require('./bytes');
const { enumerateClosedMembers } = require('./enumerate');
const { ACCEPTANCE_PREDICATES, evaluateAcceptanceClaims } = require('./predicates');
const {
  REGISTRY_DIGESTS,
  REVIEW_LANES,
  VALIDATOR_CONFIGURATION,
  acceptanceDescriptorForContract,
} = require('./registry');
const {
  projectBenApprovalEvidence,
  projectReviewSetAttestation,
  verifyBenApprovalEvidence,
  verifyReviewSetEvidence,
} = require('./review-evidence');
const { createReviewContractBundle } = require('./review-contracts');
const {
  enumerateReviewExpectedMembers,
  memberSchemaSetForReview,
} = require('./review-enumerator');
const { SCHEMA_IDS, schemaFor, validateSchema } = require('./schema-registry');
const { verifySignature } = require('./signatures');
const {
  EVIDENCE_OBJECT_PAYLOAD_DOMAIN,
  EVIDENCE_SIGNATURE_DOMAIN,
  EVIDENCE_SIGNATURE_ROLE,
  EVIDENCE_SUBJECT_ID_DOMAIN,
  EVIDENCE_SUBJECT_PAYLOAD_DOMAIN,
  IMMUTABLE_MEMBER_ROOT_DOMAIN,
  MEMBER_SCHEMA_SET_DOMAIN,
  TEST_RESULT_ROOT_DOMAIN,
  createProgrammeGateEvidenceValidator,
} = require('./validator');

const SIGNING_REQUEST_DOMAIN = 'PROGRAMME_GATE_REVIEW_APPROVAL_SIGNING_REQUEST/V1';
const CONTRACT_DEFINITION_SET_DOMAIN =
  'PROGRAMME_GATE_REVIEW_APPROVAL_ACCEPTANCE_DEFINITION_SET/V1';
const EXECUTABLE_BINDING_SET_DOMAIN =
  'PROGRAMME_GATE_REVIEW_APPROVAL_EXECUTABLE_BINDING_SET/V1';
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
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

function requireDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a SHA-256 digest`);
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

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireTrustedKey({ keyRegistry, validatorKeyId, verificationTime }) {
  validateSchema('TrustedProgrammeGatePublicKeys/V1', keyRegistry);
  if (keyRegistry.registry_state !== 'ACTIVE') {
    throw new Error('trusted public-key registry is not active');
  }
  const matches = keyRegistry.keys.filter((entry) => entry.key_id === validatorKeyId);
  if (matches.length !== 1) throw new Error('validator key ID is not uniquely trusted');
  const key = matches[0];
  if (!key.permitted_roles.includes(EVIDENCE_SIGNATURE_ROLE)
    || !key.permitted_domains.includes(EVIDENCE_SIGNATURE_DOMAIN)) {
    throw new Error('validator key does not permit evidence signatures');
  }
  const at = Date.parse(verificationTime);
  if (at < Date.parse(key.valid_from)
    || at >= Date.parse(key.valid_until)
    || (key.revoked_at !== null && at >= Date.parse(key.revoked_at))
    || crypto.createPublicKey(key.public_key_pem).asymmetricKeyType !== 'ed25519') {
    throw new Error('validator key is not valid at the verification time');
  }
}

function createReviewApprovalSigningAuthority(input) {
  requireExactKeys(input, [
    'benApprovalAuthority',
    'keyRegistry',
    'reviewSetAuthority',
    'validatorConfigurationDigest',
    'validatorExecutableDigest',
    'validatorKeyId',
    'verificationTime',
  ], 'review-approval signing authority');
  requireDigest(input.validatorConfigurationDigest, 'validator configuration digest');
  requireDigest(input.validatorExecutableDigest, 'validator executable digest');
  if (input.validatorConfigurationDigest !== REGISTRY_DIGESTS.validator_configuration) {
    throw new Error('validator configuration digest is not registered');
  }
  const verificationTime = requireTimestamp(input.verificationTime, 'verification time');
  requireTrustedKey({
    keyRegistry: input.keyRegistry,
    validatorKeyId: input.validatorKeyId,
    verificationTime,
  });
  if (!input.reviewSetAuthority
    || typeof input.reviewSetAuthority !== 'object'
    || !input.benApprovalAuthority
    || typeof input.benApprovalAuthority !== 'object') {
    throw new TypeError('review and Ben verification authorities are required');
  }
  const authority = deepFreeze({
    keyRegistry: structuredClone(input.keyRegistry),
    validatorConfigurationDigest: input.validatorConfigurationDigest,
    validatorExecutableDigest: input.validatorExecutableDigest,
    validatorKeyId: input.validatorKeyId,
    verificationTime,
    reviewSetAuthority: structuredClone(input.reviewSetAuthority),
    benApprovalAuthority: structuredClone(input.benApprovalAuthority),
  });
  authorityBrands.add(authority);
  return authority;
}

function requireAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed review-approval signing authority is required');
  }
  return value;
}

function gateForCandidate(candidate) {
  const descriptor = acceptanceDescriptorForContract(candidate.evidence_contract);
  if (descriptor.activation_state !== 'ACTIVE' || descriptor.gate_id !== candidate.gate_id) {
    throw new Error('review candidate does not select one active descriptor');
  }
  return Object.freeze({
    id: descriptor.gate_id,
    evidence_contract: descriptor.evidence_contract,
    required_evidence_object_type: descriptor.evidence_object_type,
    acceptance_claims: descriptor.ordered_claim_keys,
    required_adversarial_tests: descriptor.required_adversarial_tests,
  });
}

function definitionFor(bundle, candidate) {
  const matches = bundle.acceptance_definitions.filter(
    (definition) => definition.evidence_contract === candidate.evidence_contract,
  );
  if (matches.length !== 1
    || matches[0].definition_id !== candidate.acceptance_definition_id) {
    throw new Error('review candidate does not resolve to its exact acceptance definition');
  }
  validateSchema('ProgrammeGateAcceptanceDefinition/V1', matches[0]);
  return matches[0];
}

function subjectIdentity(subject, fields) {
  const identity = {};
  for (const field of fields) {
    if (!Object.hasOwn(subject, field)) {
      throw new Error(`evidence subject is missing identity field ${field}`);
    }
    identity[field] = subject[field];
  }
  return identity;
}

function memberPayload(candidate, memberId, memberType) {
  const matches = candidate.members.filter((member) => (
    member.member_id === memberId && member.member_type === memberType
  ));
  if (matches.length !== 1) {
    throw new Error(`review evidence member ${memberId} is not unique`);
  }
  return matches[0].payload;
}

function verificationFacts(verification) {
  return {
    evidence_id: verification.evidence_id,
    ...verification.facts,
  };
}

function recomputeVerifications(authority, bundle) {
  if (!Array.isArray(bundle.candidates) || bundle.candidates.length !== 2) {
    throw new Error('review readiness must contain exactly two candidates');
  }
  const reviewCandidate = bundle.candidates.find(
    (candidate) => candidate.gate_id === 'G0_EXACT_DIGEST_REVIEW_SET',
  );
  const approvalCandidate = bundle.candidates.find(
    (candidate) => candidate.gate_id === 'G0_BEN_SPEC_APPROVAL',
  );
  if (!reviewCandidate || !approvalCandidate) {
    throw new Error('review readiness is missing a required candidate');
  }
  const reviewMembers = REVIEW_LANES.map((lane) => ({
    lane_id: lane.lane_id,
    controller_record: memberPayload(
      reviewCandidate,
      `controller:${lane.lane_id}`,
      'TrustedReviewControllerRecord',
    ),
    independence_attestation: memberPayload(
      reviewCandidate,
      `independence:${lane.lane_id}`,
      'ReviewerIndependenceAttestation',
    ),
  }));
  if (reviewMembers.some((member) => (
    Date.parse(member.controller_record.review_end_time) > Date.parse(bundle.observed_at)
  ))) {
    throw new Error('review records are newer than readiness');
  }
  const reviewVerification = verifyReviewSetEvidence({
    expected_specification_root: bundle.specification_root,
    members: reviewMembers,
    authority: authority.reviewSetAuthority,
    at: authority.verificationTime,
  });
  if (reviewVerification.valid !== true) {
    throw new Error('review set no longer verifies');
  }
  const reviewEvidence = projectReviewSetAttestation(reviewVerification);
  if (domainDigest('PROGRAMME_GATE_REVIEW_EVIDENCE_PROJECTION/V1', reviewEvidence)
      !== domainDigest(
        'PROGRAMME_GATE_REVIEW_EVIDENCE_PROJECTION/V1',
        reviewCandidate.evidence_object,
      )) {
    throw new Error('review evidence projection has drifted');
  }

  const approvalRecord = memberPayload(
    approvalCandidate,
    `approval:${approvalCandidate.evidence_object.approval_evidence_id}`,
    'BenSpecificationApproval',
  );
  if (Date.parse(approvalRecord.approved_at) > Date.parse(bundle.observed_at)) {
    throw new Error('Ben approval is newer than readiness');
  }
  const linkedReview = memberPayload(
    approvalCandidate,
    `review-set:${reviewVerification.evidence_id}`,
    'ExactDigestReviewSetAttestation',
  );
  if (domainDigest('PROGRAMME_GATE_REVIEW_EVIDENCE_PROJECTION/V1', linkedReview)
      !== domainDigest('PROGRAMME_GATE_REVIEW_EVIDENCE_PROJECTION/V1', reviewEvidence)) {
    throw new Error('Ben approval is linked to another review set');
  }
  const approvalVerification = verifyBenApprovalEvidence({
    record: approvalRecord,
    expected_specification_root: bundle.specification_root,
    passing_review_set_evidence_id: reviewVerification.evidence_id,
    authority: authority.benApprovalAuthority,
    at: authority.verificationTime,
  });
  if (approvalVerification.valid !== true) {
    throw new Error('Ben approval no longer verifies');
  }
  const approvalEvidence = projectBenApprovalEvidence(
    approvalVerification,
    approvalRecord,
  );
  if (domainDigest('PROGRAMME_GATE_BEN_APPROVAL_PROJECTION/V1', approvalEvidence)
      !== domainDigest(
        'PROGRAMME_GATE_BEN_APPROVAL_PROJECTION/V1',
        approvalCandidate.evidence_object,
      )) {
    throw new Error('Ben approval evidence projection has drifted');
  }
  const verifiedReviewSet = verificationFacts(reviewVerification);
  const verifiedBenApproval = verificationFacts(approvalVerification);
  if (bundle.review_set_evidence_id !== reviewVerification.evidence_id
    || bundle.approval_evidence_id !== approvalVerification.evidence_id
    || domainDigest('PROGRAMME_GATE_REVIEW_VERIFICATION_FACTS/V1', verifiedReviewSet)
      !== domainDigest(
        'PROGRAMME_GATE_REVIEW_VERIFICATION_FACTS/V1',
        bundle.verified_review_set,
      )
    || domainDigest('PROGRAMME_GATE_BEN_VERIFICATION_FACTS/V1', verifiedBenApproval)
      !== domainDigest(
        'PROGRAMME_GATE_BEN_VERIFICATION_FACTS/V1',
        bundle.verified_ben_approval,
      )) {
    throw new Error('stored verification facts have drifted');
  }
  return {
    verifiedReviewSet,
    verifiedBenApproval,
  };
}

function sameClosedStrings(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.length === right.length
    && left.every((value) => right.includes(value));
}

function validateCandidate({
  authority,
  bundle,
  candidate,
  gate,
  definition,
  orderedMembers,
  orderedTests,
  verifiedReviewSet,
  verifiedBenApproval,
}) {
  validateSchema(definition.evidence_object_json_schema_id, candidate.evidence_object);
  if (candidate.evidence_subject.gate_id !== gate.id
    || candidate.evidence_subject.observed_at !== bundle.observed_at
    || (
      gate.id === 'G0_EXACT_DIGEST_REVIEW_SET'
      && (
        candidate.evidence_subject.reviewed_root
          !== candidate.evidence_object.reviewed_root
        || candidate.evidence_subject.review_set_evidence_id
          !== candidate.evidence_object.review_set_evidence_id
      )
    )
    || (
      gate.id === 'G0_BEN_SPEC_APPROVAL'
      && (
        candidate.evidence_subject.approved_root
          !== candidate.evidence_object.approved_root
        || candidate.evidence_subject.approval_evidence_id
          !== candidate.evidence_object.approval_evidence_id
      )
    )) {
    throw new Error('review evidence subject has drifted from readiness');
  }
  const expectedSchemaSet = memberSchemaSetForReview(gate.evidence_contract);
  if (domainDigest(MEMBER_SCHEMA_SET_DOMAIN, candidate.member_schema_set)
      !== definition.immutable_member_json_schema_set_digest
    || domainDigest(MEMBER_SCHEMA_SET_DOMAIN, expectedSchemaSet)
      !== definition.immutable_member_json_schema_set_digest) {
    throw new Error('review evidence member schema set has drifted');
  }
  for (const member of orderedMembers) {
    const binding = expectedSchemaSet.find((entry) => entry.member_type === member.member_type);
    if (!binding) throw new Error(`unbound review member type ${member.member_type}`);
    validateSchema(binding.schema_id, member.payload);
  }
  const requiredTests = gate.required_adversarial_tests;
  if (!sameClosedStrings(
    orderedTests.map((test) => test.test_id),
    requiredTests,
  ) || orderedTests.some((test) => (
    test.exit_code !== 0
    || test.code_commit !== bundle.code_commit
    || test.environment !== bundle.environment
    || Date.parse(test.completed_at) > Date.parse(bundle.observed_at)
  ))) {
    throw new Error('review evidence does not bind its exact passing tests');
  }
  for (const test of orderedTests) {
    validateSchema('ProgrammeGateTestExecutionRecord/V1', test);
  }
  const recomputedClaims = evaluateAcceptanceClaims({
    gate_id: gate.id,
    evidence: candidate.evidence_object,
    context: {
      specificationRoot: bundle.specification_root,
      codeCommit: bundle.code_commit,
      environment: bundle.environment,
      expectedSpecificationRoot: bundle.specification_root,
      expectedCodeCommit: bundle.code_commit,
      expectedEnvironment: bundle.environment,
      observed_at: bundle.observed_at,
      clock: { now: () => authority.verificationTime },
      verifiedReviewSet,
      verifiedBenApproval,
    },
  });
  if (domainDigest('PROGRAMME_GATE_ACCEPTANCE_CLAIMS/V1', recomputedClaims)
      !== domainDigest(
        'PROGRAMME_GATE_ACCEPTANCE_CLAIMS/V1',
        candidate.exact_acceptance_claims,
      )
    || recomputedClaims.some((claim) => claim.typed_value !== true)) {
    throw new Error('review acceptance claims are not exact passing measurements');
  }
}

function buildReviewApprovalSigningRequest(input) {
  requireExactKeys(input, ['authority', 'bundle', 'candidate'], 'review signing request');
  const authority = requireAuthority(input.authority);
  const { bundle, candidate } = input;
  if (bundle.readiness_type !== 'ProgrammeGateReviewApprovalReadiness/V1'
    || bundle.readiness_state !== 'READY_FOR_SIGNATURE'
    || bundle.formal_gate_state !== 'OPEN'
    || bundle.private_key_used !== false
    || bundle.status_publication_attempted !== false
    || candidate.readiness_state !== 'READY_FOR_SIGNATURE'
    || candidate.formal_gate_state !== 'OPEN'
    || candidate.signature !== null) {
    throw new Error('only exact unsigned OPEN review readiness may be signed');
  }
  const bundleMatches = bundle.candidates.filter(
    (entry) => entry.gate_id === candidate.gate_id,
  );
  if (bundleMatches.length !== 1
    || domainDigest('PROGRAMME_GATE_REVIEW_READINESS_CANDIDATE/V1', bundleMatches[0])
      !== domainDigest('PROGRAMME_GATE_REVIEW_READINESS_CANDIDATE/V1', candidate)) {
    throw new Error('candidate is not the exact review readiness member');
  }
  const verifications = recomputeVerifications(authority, bundle);
  const gate = gateForCandidate(candidate);
  const definition = definitionFor(bundle, candidate);
  const orderedMembers = enumerateClosedMembers({
    expectedMembers: enumerateReviewExpectedMembers({
      definition,
      evidenceObject: candidate.evidence_object,
    }),
    members: candidate.members,
  });
  const orderedTests = [...candidate.test_results].sort(
    (left, right) => compareUtf8(left.test_id, right.test_id),
  );
  validateCandidate({
    authority,
    bundle,
    candidate,
    gate,
    definition,
    orderedMembers,
    orderedTests,
    ...verifications,
  });
  const unsignedEnvelope = {
    schema_version: 'ProgrammeGateEvidenceEnvelope/V2',
    gate_id: gate.id,
    evidence_contract: gate.evidence_contract,
    acceptance_definition_id: definition.definition_id,
    acceptance_definition_digest: definition.definition_digest,
    specification_root: bundle.specification_root,
    code_commit: bundle.code_commit,
    environment: bundle.environment,
    evidence_subject_type: definition.evidence_subject_type,
    evidence_subject_id: domainDigest(
      EVIDENCE_SUBJECT_ID_DOMAIN,
      subjectIdentity(
        candidate.evidence_subject,
        definition.evidence_subject_identity_fields,
      ),
    ),
    evidence_subject_payload_digest: domainDigest(
      EVIDENCE_SUBJECT_PAYLOAD_DOMAIN,
      candidate.evidence_subject,
    ),
    required_evidence_object_type: gate.required_evidence_object_type,
    required_evidence_object_payload_digest: domainDigest(
      EVIDENCE_OBJECT_PAYLOAD_DOMAIN,
      candidate.evidence_object,
    ),
    exact_acceptance_claims: candidate.exact_acceptance_claims,
    immutable_member_root: domainDigest(IMMUTABLE_MEMBER_ROOT_DOMAIN, orderedMembers),
    test_result_root: domainDigest(TEST_RESULT_ROOT_DOMAIN, orderedTests),
    validator_executable_digest: authority.validatorExecutableDigest,
    validator_configuration_digest: authority.validatorConfigurationDigest,
    validator_key_id: authority.validatorKeyId,
    terminal_state: 'PASS',
    signature_algorithm: 'Ed25519',
  };
  validateSchema('ProgrammeGateEvidenceEnvelope/V2', {
    ...unsignedEnvelope,
    signature: 'AA==',
  });
  const signingFrame = signatureBytes({
    domain: EVIDENCE_SIGNATURE_DOMAIN,
    role: EVIDENCE_SIGNATURE_ROLE,
    payload: unsignedEnvelope,
  });
  return deepFreeze({
    request_type: 'ProgrammeGateReviewApprovalSigningRequest/V1',
    gate_id: gate.id,
    unsigned_envelope: unsignedEnvelope,
    signing_domain: EVIDENCE_SIGNATURE_DOMAIN,
    signing_role: EVIDENCE_SIGNATURE_ROLE,
    signing_frame_sha256: crypto.createHash('sha256').update(signingFrame).digest('hex'),
    signing_frame_base64: signingFrame.toString('base64'),
    readiness_state: 'READY_FOR_EXTERNAL_SIGNATURE',
    formal_gate_state: 'OPEN',
    private_key_used: false,
    signature: null,
  });
}

function matchingContracts(bundle) {
  const contracts = createReviewContractBundle({
    specificationRoot: bundle.specification_root,
  });
  if (domainDigest(CONTRACT_DEFINITION_SET_DOMAIN, bundle.acceptance_definitions)
      !== domainDigest(CONTRACT_DEFINITION_SET_DOMAIN, contracts.definitions)
    || domainDigest(EXECUTABLE_BINDING_SET_DOMAIN, bundle.executable_bindings)
      !== domainDigest(EXECUTABLE_BINDING_SET_DOMAIN, contracts.executable_bindings)) {
    throw new Error('review readiness contracts have drifted');
  }
  return contracts;
}

function openValidation(gateId, reasonCode) {
  return Object.freeze({
    valid: false,
    state: 'OPEN',
    gate_id: gateId,
    evidence_envelope_id: null,
    evidence_payload_digest: null,
    reason_code: reasonCode,
    reason: 'Signed review evidence did not match exact readiness.',
  });
}

function preflightReviewApprovalSignature(input) {
  requireExactKeys(input, [
    'authority',
    'bundle',
    'candidate',
    'signature',
    'signingRequest',
  ], 'review signed preflight');
  const authority = requireAuthority(input.authority);
  const gateId = input.candidate && input.candidate.gate_id;
  let expectedRequest;
  let contracts;
  let verifications;
  try {
    expectedRequest = buildReviewApprovalSigningRequest({
      authority,
      bundle: input.bundle,
      candidate: input.candidate,
    });
    if (domainDigest(SIGNING_REQUEST_DOMAIN, input.signingRequest)
      !== domainDigest(SIGNING_REQUEST_DOMAIN, expectedRequest)) {
      throw new Error('signing request mismatch');
    }
    contracts = matchingContracts(input.bundle);
    verifications = recomputeVerifications(authority, input.bundle);
  } catch {
    return deepFreeze({
      preflight_type: 'ProgrammeGateReviewApprovalSignedPreflight/V1',
      gate_id: gateId || null,
      evidence_validation: openValidation(gateId || null, 'SIGNING_REQUEST_MISMATCH'),
      signed_envelope: null,
      evidence_validation_state: 'OPEN',
      formal_gate_state: 'OPEN',
      private_key_used: false,
      status_publication_attempted: false,
    });
  }
  const signedEnvelope = {
    ...expectedRequest.unsigned_envelope,
    signature: input.signature,
  };
  const validateEvidence = createProgrammeGateEvidenceValidator({
    domainDigest,
    validateSchema,
    schemaFor,
    knownSchemaIds: SCHEMA_IDS,
    acceptanceDescriptorForContract,
    acceptanceDefinitions: contracts.definitions,
    enumerateClosedMembers,
    enumerateExpectedMembers: enumerateReviewExpectedMembers,
    evaluateAcceptanceClaims,
    predicateRegistry: ACCEPTANCE_PREDICATES,
    verifySignature,
    validatorConfiguration: VALIDATOR_CONFIGURATION,
    allowedValidatorExecutableDigests: [authority.validatorExecutableDigest],
    executableBindings: contracts.executable_bindings,
    keyRegistry: authority.keyRegistry,
  });
  const gate = gateForCandidate(input.candidate);
  const validation = validateEvidence({
    gate,
    envelope: signedEnvelope,
    evidenceSubject: input.candidate.evidence_subject,
    evidenceObject: input.candidate.evidence_object,
    members: input.candidate.members,
    memberSchemaSet: input.candidate.member_schema_set,
    testResults: input.candidate.test_results,
    expectedSpecificationRoot: input.bundle.specification_root,
    expectedFrozenContractPairDigest: null,
    expectedCodeCommit: input.bundle.code_commit,
    expectedEnvironment: input.bundle.environment,
    clock: { now: () => authority.verificationTime },
    ...verifications,
  });
  return deepFreeze({
    preflight_type: 'ProgrammeGateReviewApprovalSignedPreflight/V1',
    gate_id: gate.id,
    evidence_validation: validation,
    signed_envelope: validation.valid === true ? signedEnvelope : null,
    evidence_validation_state: validation.state,
    formal_gate_state: 'OPEN',
    private_key_used: false,
    status_publication_attempted: false,
  });
}

module.exports = {
  SIGNING_REQUEST_DOMAIN,
  buildReviewApprovalSigningRequest,
  createReviewApprovalSigningAuthority,
  preflightReviewApprovalSignature,
};
