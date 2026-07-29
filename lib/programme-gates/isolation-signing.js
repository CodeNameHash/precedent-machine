const crypto = require('node:crypto');

const { domainDigest, signatureBytes } = require('./bytes');
const { enumerateClosedMembers } = require('./enumerate');
const { ACCEPTANCE_PREDICATES, evaluateAcceptanceClaims } = require('./predicates');
const {
  REGISTRY_DIGESTS,
  VALIDATOR_CONFIGURATION,
  acceptanceDescriptorForContract,
} = require('./registry');
const { SCHEMA_IDS, schemaFor, validateSchema } = require('./schema-registry');
const { createIsolationContractBundle } = require('./isolation-contracts');
const {
  enumerateIsolationExpectedMembers,
  memberSchemaSetForIsolation,
} = require('./isolation-enumerator');
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

const SIGNING_REQUEST_DOMAIN = 'PROGRAMME_GATE_ISOLATION_SIGNING_REQUEST/V1';
const CONTRACT_DEFINITION_SET_DOMAIN =
  'PROGRAMME_GATE_ISOLATION_ACCEPTANCE_DEFINITION_SET/V1';
const EXECUTABLE_BINDING_SET_DOMAIN =
  'PROGRAMME_GATE_ISOLATION_EXECUTABLE_BINDING_SET/V1';
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
  if (!Number.isFinite(at)
    || at < Date.parse(key.valid_from)
    || at >= Date.parse(key.valid_until)
    || (key.revoked_at !== null && at >= Date.parse(key.revoked_at))
    || crypto.createPublicKey(key.public_key_pem).asymmetricKeyType !== 'ed25519') {
    throw new Error('validator key is not valid at the verification time');
  }
}

function createIsolationSigningAuthority(input) {
  requireExactKeys(input, [
    'keyRegistry',
    'validatorConfigurationDigest',
    'validatorExecutableDigest',
    'validatorKeyId',
    'verificationTime',
  ], 'isolation signing authority');
  requireDigest(input.validatorConfigurationDigest, 'validator configuration digest');
  requireDigest(input.validatorExecutableDigest, 'validator executable digest');
  if (input.validatorConfigurationDigest !== REGISTRY_DIGESTS.validator_configuration) {
    throw new Error('validator configuration digest is not registered');
  }
  if (typeof input.validatorKeyId !== 'string' || input.validatorKeyId.length === 0) {
    throw new TypeError('validator key ID must be non-empty');
  }
  const verificationTime = requireTimestamp(input.verificationTime, 'verification time');
  requireTrustedKey({
    keyRegistry: input.keyRegistry,
    validatorKeyId: input.validatorKeyId,
    verificationTime,
  });
  const authority = deepFreeze({
    keyRegistry: structuredClone(input.keyRegistry),
    validatorConfigurationDigest: input.validatorConfigurationDigest,
    validatorExecutableDigest: input.validatorExecutableDigest,
    validatorKeyId: input.validatorKeyId,
    verificationTime,
  });
  authorityBrands.add(authority);
  return authority;
}

function requireAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed isolation signing authority is required');
  }
  return value;
}

function gateForCandidate(candidate) {
  const descriptor = acceptanceDescriptorForContract(candidate.evidence_contract);
  if (descriptor.activation_state !== 'ACTIVE' || descriptor.gate_id !== candidate.gate_id) {
    throw new Error('isolation candidate does not select one active descriptor');
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
    throw new Error('isolation candidate does not resolve to its exact acceptance definition');
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

function validateCandidate({
  authority,
  bundle,
  candidate,
  gate,
  definition,
  orderedMembers,
  orderedTests,
}) {
  validateSchema(definition.evidence_object_json_schema_id, candidate.evidence_object);
  const subject = candidate.evidence_subject;
  if (subject.gate_id !== gate.id
    || subject.code_commit !== bundle.code_commit
    || subject.environment !== bundle.environment
    || subject.observed_at !== bundle.observed_at
    || subject.isolation_source_digest !== bundle.isolation_source_digest) {
    throw new Error('isolation evidence subject has drifted from readiness');
  }
  const expectedSchemaSet = memberSchemaSetForIsolation(gate.evidence_contract);
  if (domainDigest(MEMBER_SCHEMA_SET_DOMAIN, candidate.member_schema_set)
      !== definition.immutable_member_json_schema_set_digest
    || domainDigest(MEMBER_SCHEMA_SET_DOMAIN, expectedSchemaSet)
      !== definition.immutable_member_json_schema_set_digest) {
    throw new Error('isolation evidence member schema set has drifted');
  }
  for (const member of orderedMembers) {
    const binding = expectedSchemaSet.find((entry) => entry.member_type === member.member_type);
    if (!binding) throw new Error(`unbound isolation member type ${member.member_type}`);
    validateSchema(binding.schema_id, member.payload);
  }
  const expectedTestIds = [...gate.required_adversarial_tests]
    .sort(compareUtf8);
  if (orderedTests.length !== expectedTestIds.length
    || orderedTests.some((entry, index) => (
      entry.test_id !== expectedTestIds[index]
      || entry.exit_code !== 0
      || entry.code_commit !== bundle.code_commit
      || entry.environment !== bundle.environment
      || Date.parse(entry.completed_at) > Date.parse(bundle.observed_at)
    ))) {
    throw new Error('isolation evidence does not bind its required passing test');
  }
  for (const testResult of orderedTests) {
    validateSchema('ProgrammeGateTestExecutionRecord/V1', testResult);
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
    },
  });
  if (domainDigest('PROGRAMME_GATE_ACCEPTANCE_CLAIMS/V1', recomputedClaims)
      !== domainDigest('PROGRAMME_GATE_ACCEPTANCE_CLAIMS/V1', candidate.exact_acceptance_claims)
    || recomputedClaims.some((claim) => claim.typed_value !== true)) {
    throw new Error('isolation acceptance claims are not exact passing measurements');
  }
}

function buildIsolationSigningRequest(input) {
  requireExactKeys(input, ['authority', 'bundle', 'candidate'], 'isolation signing request');
  const authority = requireAuthority(input.authority);
  const { bundle, candidate } = input;
  if (bundle.readiness_type !== 'ProgrammeGateIsolationReadiness/V1'
    || bundle.readiness_state !== 'READY_FOR_SIGNATURE'
    || bundle.formal_gate_state !== 'OPEN'
    || bundle.private_key_used !== false
    || bundle.status_publication_attempted !== false
    || candidate.readiness_state !== 'READY_FOR_SIGNATURE'
    || candidate.formal_gate_state !== 'OPEN'
    || candidate.signature !== null) {
    throw new Error('only exact unsigned OPEN isolation readiness may be signed');
  }
  const gate = gateForCandidate(candidate);
  const definition = definitionFor(bundle, candidate);
  const expectedMembers = enumerateIsolationExpectedMembers({
    definition,
    evidenceObject: candidate.evidence_object,
  });
  const orderedMembers = enumerateClosedMembers({
    expectedMembers,
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
      subjectIdentity(candidate.evidence_subject, definition.evidence_subject_identity_fields),
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
    request_type: 'ProgrammeGateIsolationSigningRequest/V1',
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
  const contracts = createIsolationContractBundle({
    specificationRoot: bundle.specification_root,
  });
  if (domainDigest(CONTRACT_DEFINITION_SET_DOMAIN, bundle.acceptance_definitions)
      !== domainDigest(CONTRACT_DEFINITION_SET_DOMAIN, contracts.definitions)
    || domainDigest(EXECUTABLE_BINDING_SET_DOMAIN, bundle.executable_bindings)
      !== domainDigest(EXECUTABLE_BINDING_SET_DOMAIN, contracts.executable_bindings)) {
    throw new Error('isolation readiness contracts have drifted');
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
    reason: 'Signed isolation evidence did not match exact readiness.',
  });
}

function preflightIsolationSignature(input) {
  requireExactKeys(input, [
    'authority',
    'bundle',
    'candidate',
    'signature',
    'signingRequest',
  ], 'isolation signed preflight');
  const authority = requireAuthority(input.authority);
  const gateId = input.candidate && input.candidate.gate_id;
  let expectedRequest;
  let contracts;
  try {
    expectedRequest = buildIsolationSigningRequest({
      authority,
      bundle: input.bundle,
      candidate: input.candidate,
    });
    if (domainDigest(SIGNING_REQUEST_DOMAIN, input.signingRequest)
      !== domainDigest(SIGNING_REQUEST_DOMAIN, expectedRequest)) {
      throw new Error('signing request mismatch');
    }
    contracts = matchingContracts(input.bundle);
  } catch {
    return deepFreeze({
      preflight_type: 'ProgrammeGateIsolationSignedPreflight/V1',
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
    enumerateExpectedMembers: enumerateIsolationExpectedMembers,
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
  });
  return deepFreeze({
    preflight_type: 'ProgrammeGateIsolationSignedPreflight/V1',
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
  buildIsolationSigningRequest,
  createIsolationSigningAuthority,
  preflightIsolationSignature,
};
