const fs = require('node:fs');
const YAML = require('yaml');

const { domainDigest } = require('./bytes');
const {
  createContainmentContractBundle,
} = require('./containment-contracts');
const {
  BROAD_ROUTE_CONTRACT,
  MARKET_STATS_CONTRACT,
  enumerateContainmentExpectedMembers,
} = require('./containment-enumerator');
const { enumerateClosedMembers } = require('./enumerate');
const {
  createGoverningRegistryAuthority,
} = require('./governing-registry');
const {
  ISOLATION_CONTRACTS,
  enumerateIsolationExpectedMembers,
} = require('./isolation-enumerator');
const { createIsolationContractBundle } = require('./isolation-contracts');
const { ACCEPTANCE_PREDICATES, evaluateAcceptanceClaims } = require('./predicates');
const {
  REGISTRY_DIGESTS,
  VALIDATOR_CONFIGURATION,
  acceptanceDescriptorForContract,
} = require('./registry');
const { createReviewContractBundle } = require('./review-contracts');
const {
  BEN_APPROVAL_CONTRACT,
  REVIEW_SET_CONTRACT,
  enumerateReviewExpectedMembers,
} = require('./review-enumerator');
const {
  recomputeReviewApprovalVerifications,
} = require('./review-signing');
const {
  SECURITY_DISPOSITION_CONTRACTS,
  enumerateSecurityDispositionExpectedMembers,
} = require('./security-disposition-enumerator');
const {
  createSecurityDispositionContractBundle,
} = require('./security-disposition-contracts');
const { SCHEMA_IDS, schemaFor, validateSchema } = require('./schema-registry');
const { verifySignature } = require('./signatures');
const {
  buildUnsignedProgrammeGateStatus,
  createProgrammeStatusAuthority,
} = require('./status');
const {
  createProgrammeGateEvidenceValidator,
  unsignedEnvelope,
} = require('./validator');

const G0_GATE_ORDER = Object.freeze([
  'G0_MARKET_STATS_CONTAINED',
  'G0_BROAD_CORPUS_ROUTES_CONTAINED',
  'G0_ZAYO_DISPOSITION',
  'G0_CLAUDE_CREDENTIAL_ROTATION',
  'G0_SUPABASE_SECRET_DISPOSITION',
  'G0_STAGING_SUPABASE_ISOLATED',
  'G0_STAGING_VERCEL_ISOLATED',
  'G0_STAGING_ACCESS_PROTECTED',
  'G0_EXACT_DIGEST_REVIEW_SET',
  'G0_BEN_SPEC_APPROVAL',
]);
const GROUPS = Object.freeze([
  Object.freeze({
    key: 'containment',
    gates: G0_GATE_ORDER.slice(0, 2),
    preflightType: 'ProgrammeGateContainmentSignedEvidencePreflight/V1',
  }),
  Object.freeze({
    key: 'security',
    gates: G0_GATE_ORDER.slice(2, 5),
    preflightType: 'ProgrammeGateSecurityDispositionSignedPreflight/V1',
  }),
  Object.freeze({
    key: 'isolation',
    gates: G0_GATE_ORDER.slice(5, 8),
    preflightType: 'ProgrammeGateIsolationSignedPreflight/V1',
  }),
  Object.freeze({
    key: 'review',
    gates: G0_GATE_ORDER.slice(8, 10),
    preflightType: 'ProgrammeGateReviewApprovalSignedPreflight/V1',
  }),
]);
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const authorityBrands = new WeakSet();
const statusAuthorities = new WeakMap();

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

function combinedContracts(specificationRoot) {
  const bundles = [
    createContainmentContractBundle({ specificationRoot }),
    createSecurityDispositionContractBundle({ specificationRoot }),
    createIsolationContractBundle({ specificationRoot }),
    createReviewContractBundle({ specificationRoot }),
  ];
  const definitions = bundles.flatMap((bundle) => bundle.definitions);
  const executableBindings = Object.assign(
    {},
    ...bundles.map((bundle) => bundle.executable_bindings),
  );
  if (definitions.length !== G0_GATE_ORDER.length
    || new Set(definitions.map((definition) => definition.evidence_contract)).size
      !== G0_GATE_ORDER.length
    || Object.keys(executableBindings).length !== G0_GATE_ORDER.length) {
    throw new Error('combined G0 acceptance contracts are incomplete');
  }
  const definitionGateOrder = definitions.map((definition) => (
    acceptanceDescriptorForContract(definition.evidence_contract).gate_id
  ));
  if (definitionGateOrder.some((gateId, index) => gateId !== G0_GATE_ORDER[index])) {
    throw new Error('combined G0 acceptance contracts are out of order');
  }
  return deepFreeze({ definitions, executableBindings });
}

function enumerateG0ExpectedMembers(input) {
  const contract = input.definition && input.definition.evidence_contract;
  if ([MARKET_STATS_CONTRACT, BROAD_ROUTE_CONTRACT].includes(contract)) {
    return enumerateContainmentExpectedMembers(input);
  }
  if (Object.values(SECURITY_DISPOSITION_CONTRACTS).includes(contract)) {
    return enumerateSecurityDispositionExpectedMembers(input);
  }
  if (Object.values(ISOLATION_CONTRACTS).includes(contract)) {
    return enumerateIsolationExpectedMembers(input);
  }
  if ([REVIEW_SET_CONTRACT, BEN_APPROVAL_CONTRACT].includes(contract)) {
    return enumerateReviewExpectedMembers(input);
  }
  throw new Error(`unsupported G0 evidence contract: ${contract}`);
}

function createG0StatusReadinessAuthority(input) {
  requireExactKeys(input, [
    'codeCommit',
    'environment',
    'keyRegistry',
    'reviewSigningAuthority',
    'specificationRoot',
    'validatorExecutableDigest',
    'validatorKeyId',
    'verificationTime',
  ], 'G0 status-readiness authority');
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
  validateSchema('TrustedProgrammeGatePublicKeys/V1', input.keyRegistry);
  if (input.keyRegistry.registry_state !== 'ACTIVE') {
    throw new Error('trusted public-key registry is not active');
  }
  const verificationTime = requireTimestamp(input.verificationTime, 'verification time');
  const contracts = combinedContracts(specificationRoot);
  const validateEvidence = createProgrammeGateEvidenceValidator({
    domainDigest,
    validateSchema,
    schemaFor,
    knownSchemaIds: SCHEMA_IDS,
    acceptanceDescriptorForContract,
    acceptanceDefinitions: contracts.definitions,
    enumerateClosedMembers,
    enumerateExpectedMembers: enumerateG0ExpectedMembers,
    evaluateAcceptanceClaims,
    predicateRegistry: ACCEPTANCE_PREDICATES,
    verifySignature,
    validatorConfiguration: VALIDATOR_CONFIGURATION,
    allowedValidatorExecutableDigests: [validatorExecutableDigest],
    executableBindings: contracts.executableBindings,
    keyRegistry: structuredClone(input.keyRegistry),
  });
  const governingRegistryAuthority = createGoverningRegistryAuthority({
    readFileSync: fs.readFileSync,
    parseYaml: YAML.parse,
    domainDigest,
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
    keyRegistry: structuredClone(input.keyRegistry),
    reviewSigningAuthority: input.reviewSigningAuthority,
  });
  authorityBrands.add(authority);
  statusAuthorities.set(authority, statusAuthority);
  return authority;
}

function requireAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed G0 status-readiness authority is required');
  }
  return value;
}

function validateGroup(group, authority, expectedGroup) {
  requireExactKeys(group, ['bundle', 'signedPreflights'], `${expectedGroup.key} group`);
  const { bundle, signedPreflights } = group;
  if (!bundle
    || bundle.specification_root !== authority.specificationRoot
    || bundle.code_commit !== authority.codeCommit
    || bundle.environment !== authority.environment
    || bundle.formal_gate_state !== 'OPEN'
    || bundle.status_publication_attempted !== false
    || !Array.isArray(bundle.candidates)
    || !Array.isArray(signedPreflights)
    || bundle.candidates.length !== expectedGroup.gates.length
    || signedPreflights.length !== expectedGroup.gates.length
    || bundle.candidates.some(
      (candidate, index) => candidate.gate_id !== expectedGroup.gates[index],
    )) {
    throw new Error(`${expectedGroup.key} readiness does not match the G0 authority`);
  }
  const preflightByGate = new Map(
    signedPreflights.map((preflight) => [preflight && preflight.gate_id, preflight]),
  );
  if (preflightByGate.size !== expectedGroup.gates.length) {
    throw new Error(`${expectedGroup.key} preflights are missing or duplicated`);
  }
  return bundle.candidates.map((candidate) => {
    const preflight = preflightByGate.get(candidate.gate_id);
    if (!preflight
      || preflight.preflight_type !== expectedGroup.preflightType
      || preflight.evidence_validation?.valid !== true
      || preflight.evidence_validation?.state !== 'PASS'
      || !preflight.signed_envelope) {
      throw new Error(`passing signed preflight is missing for ${candidate.gate_id}`);
    }
    return { candidate, preflight };
  });
}

function buildG0StatusReadiness(input) {
  requireExactKeys(
    input,
    ['authority', 'containment', 'isolation', 'review', 'security'],
    'G0 status readiness',
  );
  const authority = requireAuthority(input.authority);
  const reviewVerifications = recomputeReviewApprovalVerifications(
    authority.reviewSigningAuthority,
    input.review.bundle,
  );
  const pairs = GROUPS.flatMap((group) => validateGroup(
    input[group.key],
    authority,
    group,
  ));
  if (pairs.map(({ candidate }) => candidate.gate_id)
    .some((gateId, index) => gateId !== G0_GATE_ORDER[index])) {
    throw new Error('G0 candidates do not match the governing order');
  }
  const evidenceCandidates = pairs.map(({ candidate, preflight }) => Object.freeze({
    envelope: structuredClone(preflight.signed_envelope),
    validation_input: Object.freeze({
      evidenceSubject: structuredClone(candidate.evidence_subject),
      evidenceObject: structuredClone(candidate.evidence_object),
      members: structuredClone(candidate.members),
      memberSchemaSet: structuredClone(candidate.member_schema_set),
      testResults: structuredClone(candidate.test_results),
      ...(candidate.gate_id === 'G0_EXACT_DIGEST_REVIEW_SET'
        || candidate.gate_id === 'G0_BEN_SPEC_APPROVAL'
        ? reviewVerifications
        : {}),
    }),
  }));
  const unsignedStatus = buildUnsignedProgrammeGateStatus({
    authority: statusAuthorities.get(authority),
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
  const workClasses = new Map(
    unsignedStatus.ordered_work_class_projection.map(
      (row) => [row.work_class, row.state],
    ),
  );
  const ready = passingGateIds.length === G0_GATE_ORDER.length
    && passingGateIds.every((gateId, index) => gateId === G0_GATE_ORDER[index])
    && workClasses.get('canonical_work_start') === 'PASS'
    && workClasses.get('gate_status_bootstrap') === 'PASS';
  return deepFreeze({
    readiness_type: 'ProgrammeGateG0StatusReadiness/V1',
    readiness_state: ready ? 'READY_FOR_STATUS_SIGNATURE' : 'OPEN',
    passing_gate_ids: passingGateIds,
    evidence_candidates: evidenceCandidates,
    unsigned_status: unsignedStatus,
    status_signature: null,
    formal_status_state: 'OPEN',
    bootstrap_nonce_consumed: false,
    status_publication_attempted: false,
  });
}

module.exports = {
  G0_GATE_ORDER,
  buildG0StatusReadiness,
  createG0StatusReadinessAuthority,
  enumerateG0ExpectedMembers,
};
