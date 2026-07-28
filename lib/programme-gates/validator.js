const EVIDENCE_SCHEMA_ID = 'ProgrammeGateEvidenceEnvelope/V2';
const DEFINITION_SCHEMA_ID = 'ProgrammeGateAcceptanceDefinition/V1';
const EVIDENCE_SIGNATURE_DOMAIN = 'PROGRAMME_GATE_EVIDENCE/V2';
const EVIDENCE_SIGNATURE_ROLE = 'VALIDATOR';
const ACCEPTANCE_DEFINITION_ID_DOMAIN = 'PROGRAMME_GATE_ACCEPTANCE_DEFINITION/V1';
const EVIDENCE_ENVELOPE_ID_DOMAIN = 'PROGRAMME_GATE_EVIDENCE_ENVELOPE/V2';
const EVIDENCE_PAYLOAD_DOMAIN = 'PROGRAMME_GATE_EVIDENCE_PAYLOAD/V2';
const EVIDENCE_SUBJECT_ID_DOMAIN = 'PROGRAMME_GATE_EVIDENCE_SUBJECT_ID/V1';
const EVIDENCE_SUBJECT_PAYLOAD_DOMAIN = 'PROGRAMME_GATE_EVIDENCE_SUBJECT_PAYLOAD/V1';
const EVIDENCE_OBJECT_PAYLOAD_DOMAIN = 'PROGRAMME_GATE_EVIDENCE_OBJECT_PAYLOAD/V1';
const EVIDENCE_OBJECT_SCHEMA_DOMAIN = 'PROGRAMME_GATE_EVIDENCE_OBJECT_SCHEMA/V1';
const MEMBER_SCHEMA_SET_DOMAIN = 'PROGRAMME_GATE_MEMBER_SCHEMA_SET/V1';
const IMMUTABLE_MEMBER_ROOT_DOMAIN = 'PROGRAMME_GATE_IMMUTABLE_MEMBER_ROOT/V1';
const TEST_RESULT_ROOT_DOMAIN = 'PROGRAMME_GATE_TEST_RESULT_ROOT/V1';
const VALIDATOR_CONFIGURATION_DOMAIN = 'PROGRAMME_GATE_VALIDATOR_CONFIGURATION/V1';
const {
  expectedTestExecutableDigest,
} = require('./test-executable-registry');

class ProgrammeGateValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProgrammeGateValidationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProgrammeGateValidationError(code, message);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function sameOrderedStrings(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function sameClosedStrings(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.length === right.length
    && left.every((value) => right.includes(value));
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function unsignedEnvelope(envelope) {
  const { signature, ...payload } = envelope;
  return payload;
}

function acceptanceDefinitionPayload(definition) {
  const { definition_id: definitionId, definition_digest: definitionDigest, ...payload } = definition;
  void definitionId;
  void definitionDigest;
  return payload;
}

function reasonFrom(error) {
  if (error instanceof ProgrammeGateValidationError) {
    return {
      reason_code: error.code,
      reason: error.message,
    };
  }
  if (error && typeof error.code === 'string'
    && /^[A-Z][A-Z0-9_]{0,127}$/.test(error.code)) {
    return {
      reason_code: error.code,
      reason: 'The gate evidence did not pass a required closed validation.',
    };
  }
  return {
    reason_code: 'INVALID_EVIDENCE',
    reason: 'The gate evidence is missing, malformed or unverifiable.',
  };
}

function openResult(gateId, error) {
  const reason = reasonFrom(error);
  return Object.freeze({
    valid: false,
    state: 'OPEN',
    gate_id: typeof gateId === 'string' ? gateId : null,
    evidence_envelope_id: null,
    evidence_payload_digest: null,
    ...reason,
  });
}

function passResult({ domainDigest, gateId, envelope }) {
  return Object.freeze({
    valid: true,
    state: 'PASS',
    gate_id: gateId,
    evidence_envelope_id: domainDigest(EVIDENCE_ENVELOPE_ID_DOMAIN, envelope),
    evidence_payload_digest: domainDigest(EVIDENCE_PAYLOAD_DOMAIN, unsignedEnvelope(envelope)),
    reason_code: null,
    reason: null,
  });
}

function requireDependency(dependencies, key, type) {
  if (typeof dependencies[key] !== type) {
    fail('INVALID_VALIDATOR_CONFIGURATION', `validator dependency ${key} is not configured`);
  }
  return dependencies[key];
}

function resolveDefinition({ acceptanceDefinitions, evidenceContract }) {
  if (!Array.isArray(acceptanceDefinitions)) {
    fail('INVALID_VALIDATOR_CONFIGURATION', 'acceptance definitions must be a closed array');
  }
  const matches = acceptanceDefinitions.filter(
    (definition) => definition && definition.evidence_contract === evidenceContract,
  );
  if (matches.length !== 1) {
    fail(
      'ACCEPTANCE_DEFINITION_NOT_UNIQUE',
      'the evidence contract must select one acceptance definition',
    );
  }
  return matches[0];
}

function requireKnownSchema(knownSchemaIds, schemaId) {
  const known = knownSchemaIds instanceof Set
    ? knownSchemaIds.has(schemaId)
    : Array.isArray(knownSchemaIds) && knownSchemaIds.includes(schemaId);
  if (!known) fail('UNKNOWN_SCHEMA', `schema ${schemaId} is not registered`);
}

function validateRegisteredSchema({
  knownSchemaIds,
  validateSchema,
  schemaId,
  value,
}) {
  requireKnownSchema(knownSchemaIds, schemaId);
  try {
    validateSchema(schemaId, value);
  } catch {
    fail('SCHEMA_VALIDATION_FAILED', `value does not satisfy schema ${schemaId}`);
  }
}

function requireGate(gate) {
  if (!isRecord(gate)
    || typeof gate.id !== 'string'
    || typeof gate.evidence_contract !== 'string'
    || typeof gate.required_evidence_object_type !== 'string'
    || !Array.isArray(gate.acceptance_claims)
    || !Array.isArray(gate.required_adversarial_tests)) {
    fail('INVALID_GATE_DEFINITION', 'gate definition is incomplete');
  }
}

function validateDescriptor({
  gate,
  descriptor,
}) {
  if (!isRecord(descriptor)
    || descriptor.activation_state !== 'ACTIVE'
    || descriptor.gate_id !== gate.id
    || descriptor.evidence_contract !== gate.evidence_contract
    || descriptor.evidence_object_type !== gate.required_evidence_object_type
    || !sameOrderedStrings(descriptor.ordered_claim_keys, gate.acceptance_claims)
    || !sameClosedStrings(descriptor.required_adversarial_tests, gate.required_adversarial_tests)) {
    fail(
      'ACCEPTANCE_DESCRIPTOR_MISMATCH',
      'gate definition does not match its registered acceptance descriptor',
    );
  }
}

function validateDefinition({
  domainDigest,
  definition,
  descriptor,
  expectedSpecificationRoot,
  expectedFrozenContractPairDigest,
  validateSchema,
  schemaFor,
  knownSchemaIds,
  executableBindings,
}) {
  validateRegisteredSchema({
    knownSchemaIds,
    validateSchema,
    schemaId: DEFINITION_SCHEMA_ID,
    value: definition,
  });
  const derivedDigest = domainDigest(
    ACCEPTANCE_DEFINITION_ID_DOMAIN,
    acceptanceDefinitionPayload(definition),
  );
  if (definition.definition_id !== derivedDigest || definition.definition_digest !== derivedDigest) {
    fail(
      'ACCEPTANCE_DEFINITION_DIGEST_MISMATCH',
      'acceptance definition is not content-addressed by its canonical payload',
    );
  }
  if (definition.evidence_contract !== descriptor.evidence_contract
    || definition.specification_root !== expectedSpecificationRoot) {
    fail(
      'ACCEPTANCE_DEFINITION_BINDING_MISMATCH',
      'acceptance definition is not bound to the exact contract and specification root',
    );
  }
  if (expectedFrozenContractPairDigest !== undefined
    && definition.frozen_contract_pair_digest !== expectedFrozenContractPairDigest) {
    fail(
      'ACCEPTANCE_DEFINITION_BINDING_MISMATCH',
      'acceptance definition is not bound to the expected frozen contract pair',
    );
  }
  if (!sameOrderedStrings(
    definition.ordered_claim_predicate_definitions.map((entry) => entry.claim_key),
    descriptor.ordered_claim_keys,
  ) || definition.ordered_claim_predicate_definitions.some((entry) => (
    entry.result_type !== 'BOOLEAN'
    || entry.comparison_operator !== 'EQUALS'
    || entry.expected_typed_value !== true
  ))) {
    fail(
      'UNKNOWN_PREDICATE',
      'acceptance definition has a missing, extra, reordered or unbound G0 predicate',
    );
  }
  let evidenceObjectSchema;
  try {
    requireKnownSchema(knownSchemaIds, definition.evidence_object_json_schema_id);
    evidenceObjectSchema = schemaFor(definition.evidence_object_json_schema_id);
  } catch {
    fail(
      'UNKNOWN_SCHEMA',
      `schema ${definition.evidence_object_json_schema_id} is not registered`,
    );
  }
  if (domainDigest(EVIDENCE_OBJECT_SCHEMA_DOMAIN, evidenceObjectSchema)
    !== definition.evidence_object_json_schema_digest) {
    fail(
      'EVIDENCE_OBJECT_SCHEMA_DIGEST_MISMATCH',
      'acceptance definition does not bind the registered evidence-object schema bytes',
    );
  }
  if (!isRecord(executableBindings)
    || !isRecord(executableBindings.member_enumerator)
    || definition.member_enumerator_executable_digest
      !== executableBindings.member_enumerator.executable_digest
    || definition.member_enumerator_configuration_digest
      !== executableBindings.member_enumerator.configuration_digest
    || !isRecord(executableBindings.predicates)) {
    fail(
      'EXECUTABLE_BINDING_MISMATCH',
      'acceptance definition does not bind the invoked member enumerator',
    );
  }
  for (const predicateDefinition of definition.ordered_claim_predicate_definitions) {
    const binding = executableBindings.predicates[predicateDefinition.claim_key];
    if (!isRecord(binding)
      || predicateDefinition.measurement_executable_digest !== binding.executable_digest
      || predicateDefinition.measurement_configuration_digest !== binding.configuration_digest) {
      fail(
        'EXECUTABLE_BINDING_MISMATCH',
        `acceptance definition does not bind predicate ${predicateDefinition.claim_key}`,
      );
    }
  }
}

function validatePredicateRegistry({
  gate,
  predicateRegistry,
  definition,
}) {
  const predicates = predicateRegistry && predicateRegistry[gate.id];
  if (!isRecord(predicates)
    || !sameOrderedStrings(Object.keys(predicates), gate.acceptance_claims)
    || Object.values(predicates).some((predicate) => typeof predicate !== 'function')) {
    fail('UNKNOWN_PREDICATE', 'gate predicate registry is incomplete or not closed');
  }
  for (const predicateDefinition of definition.ordered_claim_predicate_definitions) {
    if (!Object.hasOwn(predicates, predicateDefinition.claim_key)) {
      fail('UNKNOWN_PREDICATE', `predicate ${predicateDefinition.claim_key} is not registered`);
    }
  }
}

function validateEnvelopeBindings({
  envelope,
  gate,
  definition,
  expectedSpecificationRoot,
  expectedCodeCommit,
  expectedEnvironment,
  domainDigest,
  validatorConfiguration,
  allowedValidatorExecutableDigests,
}) {
  if (envelope.gate_id !== gate.id
    || envelope.evidence_contract !== gate.evidence_contract
    || envelope.required_evidence_object_type !== gate.required_evidence_object_type) {
    fail('EVIDENCE_GATE_BINDING_MISMATCH', 'evidence envelope is for another gate or object type');
  }
  if (envelope.acceptance_definition_id !== definition.definition_id
    || envelope.acceptance_definition_digest !== definition.definition_digest) {
    fail(
      'ACCEPTANCE_DEFINITION_BINDING_MISMATCH',
      'evidence envelope does not select the exact acceptance definition',
    );
  }
  if (envelope.specification_root !== expectedSpecificationRoot) {
    fail('SPECIFICATION_ROOT_MISMATCH', 'evidence is for another specification root');
  }
  if (envelope.code_commit !== expectedCodeCommit) {
    fail('CODE_COMMIT_MISMATCH', 'evidence is for another code commit');
  }
  if (envelope.environment !== expectedEnvironment) {
    fail('ENVIRONMENT_MISMATCH', 'evidence is for another environment');
  }
  if (envelope.validator_configuration_digest
    !== domainDigest(VALIDATOR_CONFIGURATION_DOMAIN, validatorConfiguration)) {
    fail(
      'VALIDATOR_CONFIGURATION_NOT_ALLOWED',
      'evidence uses an unregistered validator configuration',
    );
  }
  if (!Array.isArray(allowedValidatorExecutableDigests)
    || !allowedValidatorExecutableDigests.includes(envelope.validator_executable_digest)) {
    fail('VALIDATOR_EXECUTABLE_NOT_ALLOWED', 'evidence uses an unregistered validator executable');
  }
}

function identityPayload(subject, identityFields) {
  if (!isRecord(subject)) fail('INVALID_EVIDENCE_SUBJECT', 'evidence subject must be an object');
  const identity = {};
  for (const field of identityFields) {
    if (!Object.hasOwn(subject, field)) {
      fail('INVALID_EVIDENCE_SUBJECT', `evidence subject is missing identity field ${field}`);
    }
    identity[field] = subject[field];
  }
  return identity;
}

function validateSubjectAndObject({
  domainDigest,
  envelope,
  definition,
  evidenceSubject,
  evidenceObject,
  knownSchemaIds,
  validateSchema,
}) {
  if (envelope.evidence_subject_type !== definition.evidence_subject_type) {
    fail('EVIDENCE_SUBJECT_MISMATCH', 'evidence subject type does not match the definition');
  }
  const identity = identityPayload(
    evidenceSubject,
    definition.evidence_subject_identity_fields,
  );
  if (envelope.evidence_subject_id !== domainDigest(EVIDENCE_SUBJECT_ID_DOMAIN, identity)
    || envelope.evidence_subject_payload_digest
      !== domainDigest(EVIDENCE_SUBJECT_PAYLOAD_DOMAIN, evidenceSubject)) {
    fail('EVIDENCE_SUBJECT_MISMATCH', 'evidence subject identity or payload digest is wrong');
  }
  validateRegisteredSchema({
    knownSchemaIds,
    validateSchema,
    schemaId: definition.evidence_object_json_schema_id,
    value: evidenceObject,
  });
  if (envelope.required_evidence_object_payload_digest
    !== domainDigest(EVIDENCE_OBJECT_PAYLOAD_DOMAIN, evidenceObject)) {
    fail('EVIDENCE_OBJECT_DIGEST_MISMATCH', 'evidence object payload digest is wrong');
  }
}

function validateMembers({
  domainDigest,
  definition,
  members,
  memberSchemaSet,
  evidenceObject,
  evidenceSubject,
  enumerateExpectedMembers,
  enumerateClosedMembers,
  envelope,
  knownSchemaIds,
  validateSchema,
}) {
  if (domainDigest(MEMBER_SCHEMA_SET_DOMAIN, memberSchemaSet)
    !== definition.immutable_member_json_schema_set_digest) {
    fail('MEMBER_SCHEMA_SET_MISMATCH', 'immutable member schema set is not the registered set');
  }
  let expectedMembers;
  try {
    expectedMembers = enumerateExpectedMembers({
      definition,
      evidenceObject,
      evidenceSubject,
    });
  } catch {
    fail('INVALID_MEMBER_UNIVERSE', 'expected evidence members could not be enumerated');
  }
  let orderedMembers;
  try {
    orderedMembers = enumerateClosedMembers({ expectedMembers, members });
  } catch (error) {
    if (error && typeof error.code === 'string') throw error;
    fail('INVALID_MEMBER_UNIVERSE', 'immutable evidence members are invalid');
  }
  if (!Array.isArray(memberSchemaSet)
    || memberSchemaSet.some((entry) => (
      !exactKeys(entry, ['member_type', 'schema_id'])
      || typeof entry.member_type !== 'string'
      || typeof entry.schema_id !== 'string'
    ))
    || new Set(memberSchemaSet.map((entry) => entry.member_type)).size
      !== memberSchemaSet.length) {
    fail('MEMBER_SCHEMA_SET_MISMATCH', 'member schema set is not closed and unique');
  }
  for (const member of orderedMembers) {
    const binding = memberSchemaSet.find((entry) => entry.member_type === member.member_type);
    if (!binding) fail('MEMBER_SCHEMA_SET_MISMATCH', `member type ${member.member_type} is unbound`);
    validateRegisteredSchema({
      knownSchemaIds,
      validateSchema,
      schemaId: binding.schema_id,
      value: member.payload,
    });
  }
  if (envelope.immutable_member_root
    !== domainDigest(IMMUTABLE_MEMBER_ROOT_DOMAIN, orderedMembers)) {
    fail('IMMUTABLE_MEMBER_ROOT_MISMATCH', 'immutable member root is wrong');
  }
  return orderedMembers;
}

function validateTests({
  domainDigest,
  requiredTests,
  testResults,
  envelope,
  expectedCodeCommit,
  expectedEnvironment,
  observedAt,
  knownSchemaIds,
  validateSchema,
}) {
  if (!Array.isArray(testResults)
    || testResults.length === 0) {
    fail('ADVERSARIAL_TEST_FAILED', 'registered adversarial test executions are required');
  }
  for (const entry of testResults) {
    try {
      validateRegisteredSchema({
        knownSchemaIds,
        validateSchema,
        schemaId: 'ProgrammeGateTestExecutionRecord/V1',
        value: entry,
      });
    } catch {
      fail(
        'ADVERSARIAL_TEST_FAILED',
        'registered adversarial tests must be bound execution records',
      );
    }
    if (entry.exit_code !== 0
      || entry.code_commit !== expectedCodeCommit
      || entry.environment !== expectedEnvironment
      || entry.executable_digest !== expectedTestExecutableDigest(entry.test_id)
      || Date.parse(entry.completed_at) > Date.parse(observedAt)) {
      fail(
        'ADVERSARIAL_TEST_FAILED',
        'registered adversarial test execution did not pass in the evidence context',
      );
    }
  }
  const testIds = testResults.map((entry) => entry.test_id);
  if (new Set(testIds).size !== testIds.length) {
    fail('ADVERSARIAL_TEST_SET_MISMATCH', 'adversarial test IDs must be unique');
  }
  if (!sameClosedStrings(testIds, requiredTests)) {
    fail(
      'ADVERSARIAL_TEST_SET_MISMATCH',
      'adversarial test results do not equal the registered test set',
    );
  }
  const ordered = [...testResults].sort((left, right) => compareUtf8(left.test_id, right.test_id));
  if (envelope.test_result_root !== domainDigest(TEST_RESULT_ROOT_DOMAIN, ordered)) {
    fail('TEST_RESULT_ROOT_MISMATCH', 'test result root is wrong');
  }
}

function validateClaims({
  gate,
  envelope,
  evidenceObject,
  expectedSpecificationRoot,
  expectedCodeCommit,
  expectedEnvironment,
  observedAt,
  clock,
  evaluateAcceptanceClaims,
  domainDigest,
  immutableMembers,
  testResults,
  keyRegistry,
  verifySignature,
}) {
  let recomputedClaims;
  try {
    recomputedClaims = evaluateAcceptanceClaims({
      gate_id: gate.id,
      evidence: evidenceObject,
      context: {
        specificationRoot: envelope.specification_root,
        codeCommit: envelope.code_commit,
        environment: envelope.environment,
        expectedSpecificationRoot,
        expectedCodeCommit,
        expectedEnvironment,
        observed_at: observedAt,
        clock,
        immutableMembers,
        testResults,
        keyRegistry,
        verifySignature,
        domainDigest,
      },
    });
  } catch {
    fail('CLAIM_EVALUATION_FAILED', 'acceptance claims could not be evaluated from raw evidence');
  }
  if (!Array.isArray(recomputedClaims)
    || !sameOrderedStrings(
      recomputedClaims.map((claim) => claim.claim_key),
      gate.acceptance_claims,
    )) {
    fail('UNKNOWN_PREDICATE', 'claim evaluator did not return the exact registered claim set');
  }
  if (domainDigest('PROGRAMME_GATE_ACCEPTANCE_CLAIMS/V1', envelope.exact_acceptance_claims)
    !== domainDigest('PROGRAMME_GATE_ACCEPTANCE_CLAIMS/V1', recomputedClaims)) {
    fail('CLAIM_SET_MISMATCH', 'signed claims do not equal the recomputed typed claims');
  }
  if (recomputedClaims.some((claim) => (
    !exactKeys(claim, ['claim_key', 'result_type', 'typed_value'])
    || claim.result_type !== 'BOOLEAN'
    || claim.typed_value !== true
  ))) {
    fail('ACCEPTANCE_PREDICATE_FAILED', 'one or more acceptance predicates did not pass');
  }
}

function validateSignature({
  envelope,
  keyRegistry,
  verifySignature,
  clock,
}) {
  if (!clock || typeof clock.now !== 'function') {
    fail('TRUSTED_CLOCK_REQUIRED', 'a trusted injected clock is required');
  }
  let verificationTime;
  try {
    verificationTime = clock.now();
  } catch {
    fail('TRUSTED_CLOCK_REQUIRED', 'trusted clock could not provide a verification time');
  }
  try {
    const verified = verifySignature({
      keyRegistry,
      keyId: envelope.validator_key_id,
      role: EVIDENCE_SIGNATURE_ROLE,
      domain: EVIDENCE_SIGNATURE_DOMAIN,
      payload: unsignedEnvelope(envelope),
      signature: envelope.signature,
      at: verificationTime,
    });
    if (verified !== true) {
      fail('SIGNATURE_NOT_TRUSTED', 'evidence signature or validator key is not trusted');
    }
  } catch {
    fail('SIGNATURE_NOT_TRUSTED', 'evidence signature or validator key is not trusted');
  }
}

function validateInsideBoundary(dependencies, input) {
  const domainDigest = requireDependency(dependencies, 'domainDigest', 'function');
  const validateSchema = requireDependency(dependencies, 'validateSchema', 'function');
  const schemaFor = requireDependency(dependencies, 'schemaFor', 'function');
  const acceptanceDescriptorForContract = requireDependency(
    dependencies,
    'acceptanceDescriptorForContract',
    'function',
  );
  const enumerateClosedMembers = requireDependency(
    dependencies,
    'enumerateClosedMembers',
    'function',
  );
  const enumerateExpectedMembers = requireDependency(
    dependencies,
    'enumerateExpectedMembers',
    'function',
  );
  const evaluateAcceptanceClaims = requireDependency(
    dependencies,
    'evaluateAcceptanceClaims',
    'function',
  );
  const verifySignature = requireDependency(dependencies, 'verifySignature', 'function');
  if (!isRecord(input)) fail('MISSING_EVIDENCE', 'validation input is missing');

  const {
    gate,
    envelope,
    evidenceSubject,
    evidenceObject,
    members,
    memberSchemaSet,
    testResults,
    expectedSpecificationRoot,
    expectedFrozenContractPairDigest,
    expectedCodeCommit,
    expectedEnvironment,
    clock,
  } = input;
  requireGate(gate);
  if (!isRecord(envelope) || !isRecord(evidenceObject)) {
    fail('MISSING_EVIDENCE', 'evidence envelope and raw evidence object are required');
  }
  if (!isRecord(evidenceSubject) || typeof evidenceSubject.observed_at !== 'string') {
    fail('INVALID_EVIDENCE_SUBJECT', 'signed evidence subject must carry observed_at');
  }

  validateRegisteredSchema({
    knownSchemaIds: dependencies.knownSchemaIds,
    validateSchema,
    schemaId: EVIDENCE_SCHEMA_ID,
    value: envelope,
  });

  let descriptor;
  try {
    descriptor = acceptanceDescriptorForContract(gate.evidence_contract);
  } catch {
    fail('ACCEPTANCE_DESCRIPTOR_NOT_FOUND', 'evidence contract has no unique descriptor');
  }
  validateDescriptor({ gate, descriptor });

  const definition = resolveDefinition({
    acceptanceDefinitions: dependencies.acceptanceDefinitions,
    evidenceContract: gate.evidence_contract,
  });
  validateDefinition({
    domainDigest,
    definition,
    descriptor,
    expectedSpecificationRoot,
    expectedFrozenContractPairDigest,
    validateSchema,
    schemaFor,
    knownSchemaIds: dependencies.knownSchemaIds,
    executableBindings: dependencies.executableBindings
      && dependencies.executableBindings[gate.id],
  });
  validatePredicateRegistry({
    gate,
    predicateRegistry: dependencies.predicateRegistry,
    definition,
  });
  validateEnvelopeBindings({
    envelope,
    gate,
    definition,
    expectedSpecificationRoot,
    expectedCodeCommit,
    expectedEnvironment,
    domainDigest,
    validatorConfiguration: dependencies.validatorConfiguration,
    allowedValidatorExecutableDigests: dependencies.allowedValidatorExecutableDigests,
  });
  validateSubjectAndObject({
    domainDigest,
    envelope,
    definition,
    evidenceSubject,
    evidenceObject,
    knownSchemaIds: dependencies.knownSchemaIds,
    validateSchema,
  });
  const immutableMembers = validateMembers({
    domainDigest,
    definition,
    members,
    memberSchemaSet,
    evidenceObject,
    evidenceSubject,
    enumerateExpectedMembers,
    enumerateClosedMembers,
    envelope,
    knownSchemaIds: dependencies.knownSchemaIds,
    validateSchema,
  });
  validateTests({
    domainDigest,
    requiredTests: descriptor.required_adversarial_tests,
    testResults,
    envelope,
    expectedCodeCommit,
    expectedEnvironment,
    observedAt: evidenceSubject.observed_at,
    knownSchemaIds: dependencies.knownSchemaIds,
    validateSchema,
  });
  validateClaims({
    gate,
    envelope,
    evidenceObject,
    expectedSpecificationRoot,
    expectedCodeCommit,
    expectedEnvironment,
    observedAt: evidenceSubject.observed_at,
    clock,
    evaluateAcceptanceClaims,
    domainDigest,
    immutableMembers,
    testResults,
    keyRegistry: dependencies.keyRegistry,
    verifySignature,
  });
  if (envelope.terminal_state !== 'PASS') {
    fail('TERMINAL_STATE_NOT_PASS', 'evidence terminal state is not PASS');
  }
  validateSignature({
    envelope,
    keyRegistry: dependencies.keyRegistry,
    verifySignature,
    clock,
  });
  return passResult({ domainDigest, gateId: gate.id, envelope });
}

function createProgrammeGateEvidenceValidator(dependencies) {
  const captured = isRecord(dependencies) ? { ...dependencies } : {};
  return function validateProgrammeGateEvidence(input) {
    const gateId = input && input.gate && input.gate.id
      ? input.gate.id
      : input && input.envelope && input.envelope.gate_id;
    try {
      return validateInsideBoundary(captured, input);
    } catch (error) {
      return openResult(gateId, error);
    }
  };
}

module.exports = {
  EVIDENCE_SCHEMA_ID,
  EVIDENCE_SIGNATURE_DOMAIN,
  EVIDENCE_SIGNATURE_ROLE,
  ACCEPTANCE_DEFINITION_ID_DOMAIN,
  EVIDENCE_ENVELOPE_ID_DOMAIN,
  EVIDENCE_OBJECT_PAYLOAD_DOMAIN,
  EVIDENCE_OBJECT_SCHEMA_DOMAIN,
  EVIDENCE_PAYLOAD_DOMAIN,
  EVIDENCE_SUBJECT_ID_DOMAIN,
  EVIDENCE_SUBJECT_PAYLOAD_DOMAIN,
  IMMUTABLE_MEMBER_ROOT_DOMAIN,
  MEMBER_SCHEMA_SET_DOMAIN,
  TEST_RESULT_ROOT_DOMAIN,
  VALIDATOR_CONFIGURATION_DOMAIN,
  ProgrammeGateValidationError,
  acceptanceDefinitionPayload,
  createProgrammeGateEvidenceValidator,
  unsignedEnvelope,
};
