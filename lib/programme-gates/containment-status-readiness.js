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
  enumerateClosedMembers,
} = require('./enumerate');
const {
  createGoverningRegistryAuthority,
} = require('./governing-registry');
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
  buildUnsignedProgrammeGateStatus,
  createProgrammeStatusAuthority,
} = require('./status');
const {
  createProgrammeGateEvidenceValidator,
  unsignedEnvelope,
} = require('./validator');

const CONTAINMENT_GATE_IDS = Object.freeze([
  'G0_MARKET_STATS_CONTAINED',
  'G0_BROAD_CORPUS_ROUTES_CONTAINED',
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

function createContainmentStatusReadinessAuthority(input) {
  requireExactKeys(input, [
    'codeCommit',
    'environment',
    'keyRegistry',
    'specificationRoot',
    'validatorExecutableDigest',
    'validatorKeyId',
    'verificationTime',
  ], 'containment status-readiness authority');
  const specificationRoot = requirePattern(
    input.specificationRoot,
    DIGEST_PATTERN,
    'specification root',
  );
  const codeCommit = requirePattern(input.codeCommit, COMMIT_PATTERN, 'code commit');
  const validatorExecutableDigest = requirePattern(
    input.validatorExecutableDigest,
    DIGEST_PATTERN,
    'validator executable digest',
  );
  if (!['STAGING', 'PRODUCTION'].includes(input.environment)) {
    throw new Error('environment must be STAGING or PRODUCTION');
  }
  if (typeof input.validatorKeyId !== 'string' || input.validatorKeyId.length === 0) {
    throw new TypeError('validator key ID must be non-empty');
  }
  validateSchema('TrustedProgrammeGatePublicKeys/V1', input.keyRegistry);
  if (input.keyRegistry.registry_state !== 'ACTIVE') {
    throw new Error('trusted public-key registry is not active');
  }
  const verificationTime = requireTimestamp(input.verificationTime, 'verification time');
  const contracts = createContainmentContractBundle({ specificationRoot });
  const governingRegistryAuthority = createGoverningRegistryAuthority();
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
    allowedValidatorExecutableDigests: [validatorExecutableDigest],
    executableBindings: contracts.executable_bindings,
    keyRegistry: structuredClone(input.keyRegistry),
  });
  const statusAuthority = createProgrammeStatusAuthority({
    governingRegistryAuthority,
    domainDigest,
    validateEvidence(candidateInput) {
      return validateEvidence({
        ...candidateInput,
        expectedSpecificationRoot: specificationRoot,
        expectedFrozenContractPairDigest: null,
        expectedCodeCommit: codeCommit,
        expectedEnvironment: input.environment,
        clock: { now: () => verificationTime },
      });
    },
    evidencePayloadForDigest: unsignedEnvelope,
    validateStatusSchema: validateSchema,
    verifyStatusSignature: () => false,
    validatorExecutableDigest,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorKeyId: input.validatorKeyId,
    bootstrapState: 'AVAILABLE',
    terminalPairState: 'UNVALIDATED',
  });
  const authority = deepFreeze({
    specificationRoot,
    codeCommit,
    environment: input.environment,
    validatorExecutableDigest,
    validatorKeyId: input.validatorKeyId,
    verificationTime,
    statusAuthority,
  });
  authorityBrands.add(authority);
  return authority;
}

function requireAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed containment status-readiness authority is required');
  }
  return value;
}

function candidateForStatus(candidate, signedPreflight) {
  if (!signedPreflight
    || signedPreflight.preflight_type
      !== 'ProgrammeGateContainmentSignedEvidencePreflight/V1'
    || signedPreflight.gate_id !== candidate.gate_id
    || !signedPreflight.signed_envelope) {
    throw new Error(`signed containment preflight is missing for ${candidate.gate_id}`);
  }
  return Object.freeze({
    envelope: structuredClone(signedPreflight.signed_envelope),
    validation_input: Object.freeze({
      evidenceSubject: structuredClone(candidate.evidence_subject),
      evidenceObject: structuredClone(candidate.evidence_object),
      members: structuredClone(candidate.members),
      memberSchemaSet: structuredClone(candidate.member_schema_set),
      testResults: structuredClone(candidate.test_results),
    }),
  });
}

function buildContainmentStatusReadiness(input) {
  requireExactKeys(
    input,
    ['authority', 'bundle', 'signedPreflights'],
    'containment status readiness',
  );
  const authority = requireAuthority(input.authority);
  const { bundle } = input;
  if (!bundle
    || bundle.specification_root !== authority.specificationRoot
    || bundle.code_commit !== authority.codeCommit
    || bundle.environment !== authority.environment
    || bundle.formal_gate_state !== 'OPEN'
    || bundle.status_publication_attempted !== false
    || !Array.isArray(bundle.candidates)
    || bundle.candidates.length !== CONTAINMENT_GATE_IDS.length
    || !Array.isArray(input.signedPreflights)
    || input.signedPreflights.length !== CONTAINMENT_GATE_IDS.length) {
    throw new Error('containment readiness bundle does not match the closed authority');
  }
  const candidateIds = bundle.candidates.map((candidate) => candidate.gate_id);
  if (candidateIds.some((gateId, index) => gateId !== CONTAINMENT_GATE_IDS[index])) {
    throw new Error('containment readiness candidates do not match the closed gate order');
  }
  const preflightByGate = new Map(
    input.signedPreflights.map((preflight) => [preflight && preflight.gate_id, preflight]),
  );
  if (preflightByGate.size !== CONTAINMENT_GATE_IDS.length) {
    throw new Error('signed containment preflights are missing or duplicated');
  }
  const evidenceCandidates = bundle.candidates.map((candidate) => candidateForStatus(
    candidate,
    preflightByGate.get(candidate.gate_id),
  ));
  const unsignedStatus = buildUnsignedProgrammeGateStatus({
    authority: authority.statusAuthority,
    evidenceCandidates,
    specificationRoot: authority.specificationRoot,
    codeCommit: authority.codeCommit,
    environment: authority.environment,
    generation: 1,
    predecessorStatusId: 'NONE',
  });
  const passingGateIds = unsignedStatus.ordered_gate_projection
    .filter((row) => row.state === 'PASS')
    .map((row) => row.gate_id);
  const exactContainmentPass = passingGateIds.length === CONTAINMENT_GATE_IDS.length
    && passingGateIds.every((gateId, index) => gateId === CONTAINMENT_GATE_IDS[index]);
  return deepFreeze({
    readiness_type: 'ProgrammeGateContainmentStatusReadiness/V1',
    readiness_state: exactContainmentPass
      ? 'READY_FOR_REMAINING_G0_EVIDENCE'
      : 'OPEN',
    passing_gate_ids: passingGateIds,
    unsigned_status: unsignedStatus,
    status_signature: null,
    formal_status_state: 'OPEN',
    bootstrap_nonce_consumed: false,
    status_publication_attempted: false,
  });
}

module.exports = {
  CONTAINMENT_GATE_IDS,
  buildContainmentStatusReadiness,
  createContainmentStatusReadinessAuthority,
};
