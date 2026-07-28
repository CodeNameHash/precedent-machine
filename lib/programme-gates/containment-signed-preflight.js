const {
  domainDigest,
} = require('./bytes');
const {
  createContainmentContractBundle,
} = require('./containment-contracts');
const {
  enumerateContainmentExpectedMembers,
} = require('./containment-enumerator');
const {
  buildContainmentEvidenceSigningRequest,
  createContainmentSigningRequestAuthority,
} = require('./containment-signing-request');
const {
  enumerateClosedMembers,
} = require('./enumerate');
const {
  ACCEPTANCE_PREDICATES,
  evaluateAcceptanceClaims,
} = require('./predicates');
const {
  REGISTRY_DIGESTS,
  VALIDATOR_CONFIGURATION,
  acceptanceDescriptorForContract,
} = require('./registry');
const {
  SCHEMA_IDS,
  schemaFor,
  validateSchema,
} = require('./schema-registry');
const {
  verifySignature,
} = require('./signatures');
const {
  createProgrammeGateEvidenceValidator,
} = require('./validator');

const SIGNING_REQUEST_DOMAIN = 'PROGRAMME_GATE_CONTAINMENT_SIGNING_REQUEST/V1';
const CONTRACT_DEFINITION_SET_DOMAIN =
  'PROGRAMME_GATE_CONTAINMENT_ACCEPTANCE_DEFINITION_SET/V1';
const EXECUTABLE_BINDING_SET_DOMAIN =
  'PROGRAMME_GATE_CONTAINMENT_EXECUTABLE_BINDING_SET/V1';
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

function createContainmentSignedPreflightAuthority(input) {
  requireExactKeys(input, [
    'keyRegistry',
    'validatorExecutableDigests',
    'verificationTime',
  ], 'containment signed-evidence preflight authority');
  validateSchema('TrustedProgrammeGatePublicKeys/V1', input.keyRegistry);
  if (input.keyRegistry.registry_state !== 'ACTIVE') {
    throw new Error('trusted public-key registry is not active');
  }
  if (!Array.isArray(input.validatorExecutableDigests)
    || input.validatorExecutableDigests.length === 0
    || new Set(input.validatorExecutableDigests).size
      !== input.validatorExecutableDigests.length
    || input.validatorExecutableDigests.some(
      (digest) => typeof digest !== 'string' || !DIGEST_PATTERN.test(digest),
    )) {
    throw new TypeError('validator executable digests must be a non-empty closed digest set');
  }
  const authority = deepFreeze({
    keyRegistry: structuredClone(input.keyRegistry),
    validatorExecutableDigests: [...input.validatorExecutableDigests],
    verificationTime: requireTimestamp(input.verificationTime, 'verification time'),
  });
  authorityBrands.add(authority);
  return authority;
}

function requireAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed containment signed-evidence preflight authority is required');
  }
  return value;
}

function openValidation(gateId, reasonCode, reason) {
  return Object.freeze({
    valid: false,
    state: 'OPEN',
    gate_id: typeof gateId === 'string' ? gateId : null,
    evidence_envelope_id: null,
    evidence_payload_digest: null,
    reason_code: reasonCode,
    reason,
  });
}

function preflightResult({ gateId, validation, signedEnvelope = null }) {
  return deepFreeze({
    preflight_type: 'ProgrammeGateContainmentSignedEvidencePreflight/V1',
    gate_id: gateId,
    evidence_validation: validation,
    signed_envelope: validation.valid === true ? signedEnvelope : null,
    evidence_validation_state: validation.state,
    formal_gate_state: 'OPEN',
    private_key_used: false,
    status_publication_attempted: false,
  });
}

function matchingReadinessContracts(bundle) {
  const contracts = createContainmentContractBundle({
    specificationRoot: bundle.specification_root,
  });
  if (domainDigest(CONTRACT_DEFINITION_SET_DOMAIN, bundle.acceptance_definitions)
      !== domainDigest(CONTRACT_DEFINITION_SET_DOMAIN, contracts.definitions)
    || domainDigest(EXECUTABLE_BINDING_SET_DOMAIN, bundle.executable_bindings)
      !== domainDigest(EXECUTABLE_BINDING_SET_DOMAIN, contracts.executable_bindings)) {
    throw new Error('containment readiness contracts have drifted');
  }
  return contracts;
}

function preflightContainmentEvidenceSignature(input) {
  requireExactKeys(input, [
    'authority',
    'bundle',
    'candidate',
    'gate',
    'signature',
    'signingRequest',
  ], 'containment signed-evidence preflight');
  const authority = requireAuthority(input.authority);
  const gateId = input.gate && input.gate.id;
  let expectedRequest;
  let contracts;
  try {
    const requestEnvelope = input.signingRequest
      && input.signingRequest.unsigned_envelope;
    if (!requestEnvelope
      || !authority.validatorExecutableDigests.includes(
        requestEnvelope.validator_executable_digest,
      )
      || requestEnvelope.validator_configuration_digest
        !== REGISTRY_DIGESTS.validator_configuration) {
      throw new Error('signing request uses an unregistered validator');
    }
    const signingAuthority = createContainmentSigningRequestAuthority({
      keyRegistry: authority.keyRegistry,
      validatorConfigurationDigest: requestEnvelope.validator_configuration_digest,
      validatorExecutableDigest: requestEnvelope.validator_executable_digest,
      validatorKeyId: requestEnvelope.validator_key_id,
      verificationTime: authority.verificationTime,
    });
    expectedRequest = buildContainmentEvidenceSigningRequest({
      authority: signingAuthority,
      bundle: input.bundle,
      candidate: input.candidate,
      gate: input.gate,
    });
    if (domainDigest(SIGNING_REQUEST_DOMAIN, input.signingRequest)
      !== domainDigest(SIGNING_REQUEST_DOMAIN, expectedRequest)) {
      throw new Error('signing request does not match exact readiness');
    }
    contracts = matchingReadinessContracts(input.bundle);
  } catch {
    return preflightResult({
      gateId,
      validation: openValidation(
        gateId,
        'SIGNING_REQUEST_MISMATCH',
        'The external signature request does not match exact containment readiness.',
      ),
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
    enumerateExpectedMembers: enumerateContainmentExpectedMembers,
    evaluateAcceptanceClaims,
    predicateRegistry: ACCEPTANCE_PREDICATES,
    verifySignature,
    validatorConfiguration: VALIDATOR_CONFIGURATION,
    allowedValidatorExecutableDigests: authority.validatorExecutableDigests,
    executableBindings: contracts.executable_bindings,
    keyRegistry: authority.keyRegistry,
  });
  const validation = validateEvidence({
    gate: input.gate,
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
  return preflightResult({
    gateId,
    validation,
    signedEnvelope,
  });
}

module.exports = {
  createContainmentSignedPreflightAuthority,
  preflightContainmentEvidenceSignature,
};
