const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  domainDigest,
  signatureBytes,
} = require('../../lib/programme-gates/bytes');
const { enumerateClosedMembers } = require('../../lib/programme-gates/enumerate');
const {
  ACCEPTANCE_PREDICATES,
  evaluateAcceptanceClaims,
} = require('../../lib/programme-gates/predicates');
const {
  ACCEPTANCE_DEFINITION_DESCRIPTORS,
  VALIDATOR_CONFIGURATION,
  acceptanceDescriptorForContract,
} = require('../../lib/programme-gates/registry');
const {
  SCHEMA_IDS,
  schemaFor: registeredSchemaFor,
  validateSchema: validateRegisteredSchema,
} = require('../../lib/programme-gates/schema-registry');
const { verifySignature } = require('../../lib/programme-gates/signatures');
const {
  expectedTestExecutableDigest,
} = require('../../lib/programme-gates/test-executable-registry');
const {
  ACCEPTANCE_DEFINITION_ID_DOMAIN,
  EVIDENCE_SIGNATURE_DOMAIN,
  EVIDENCE_SIGNATURE_ROLE,
  EVIDENCE_OBJECT_PAYLOAD_DOMAIN,
  EVIDENCE_OBJECT_SCHEMA_DOMAIN,
  EVIDENCE_SUBJECT_ID_DOMAIN,
  EVIDENCE_SUBJECT_PAYLOAD_DOMAIN,
  IMMUTABLE_MEMBER_ROOT_DOMAIN,
  MEMBER_SCHEMA_SET_DOMAIN,
  TEST_RESULT_ROOT_DOMAIN,
  VALIDATOR_CONFIGURATION_DOMAIN,
  acceptanceDefinitionPayload,
  createProgrammeGateEvidenceValidator,
  unsignedEnvelope,
} = require('../../lib/programme-gates/validator');

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const DEPLOYMENT_ID = 'dpl_test_containment';
const EXECUTABLE_DIGEST = 'c'.repeat(64);
const MEMBER_ENUMERATOR_DIGEST = 'd'.repeat(64);
const MEMBER_ENUMERATOR_CONFIG_DIGEST = 'e'.repeat(64);
const PREDICATE_DIGEST = 'f'.repeat(64);
const PREDICATE_CONFIG_DIGEST = '1'.repeat(64);
const RAW_SCHEMA_ID = 'MarketStatsContainmentAttestation/V1';
const MEMBER_SCHEMA_ID = 'RouteProbe/V1';
const NOW = '2026-07-27T12:00:00.000Z';
const OBSERVED_AT = '2026-07-27T11:00:00.000Z';
const RAW_KEYS = Object.freeze([
  'schema_version',
  'gate_id',
  'code_commit',
  'runtime_deployment_id',
  'environment',
  'observed_at',
  'route_feature_enabled',
  'method_probes',
  'tests',
]);
const RAW_SCHEMA = registeredSchemaFor(RAW_SCHEMA_ID);
const MEMBER_SCHEMA = Object.freeze({
  $id: MEMBER_SCHEMA_ID,
  type: 'object',
  additionalProperties: false,
  required: ['status', 'database_calls'],
  properties: {
    status: { type: 'integer' },
    database_calls: { type: 'integer', minimum: 0 },
  },
});

const GATE = Object.freeze({
  id: 'G0_MARKET_STATS_CONTAINED',
  evidence_contract: 'route-disabled-code-test-live-response/v1',
  required_evidence_object_type: 'MarketStatsContainmentAttestation',
  acceptance_claims: Object.freeze([
    'feature_gate_off',
    'live_route_zero_corpus_reads',
    'containment_test_pass',
  ]),
  required_adversarial_tests: Object.freeze(['P0-ROUTE-01']),
});

const EVIDENCE = Object.freeze({
  schema_version: 'MarketStatsContainmentAttestation/V1',
  gate_id: GATE.id,
  code_commit: COMMIT,
  runtime_deployment_id: DEPLOYMENT_ID,
  environment: 'STAGING',
  observed_at: OBSERVED_AT,
  route_feature_enabled: false,
  method_probes: Object.freeze([Object.freeze({
    schema_version: 'ContainedRouteMethodProbe/V1',
    member_id: 'POST /api/market-stats',
    route_id: '/api/market-stats',
    method: 'POST',
    status: 503,
    error_code: 'MARKET_STATS_DISABLED',
    cache_control: 'private, no-store',
    database_calls: 0,
    corpus_reads: 0,
    retry_after: null,
    code_commit: COMMIT,
    runtime_deployment_id: DEPLOYMENT_ID,
    environment: 'STAGING',
    observed_at: OBSERVED_AT,
  })]),
  tests: Object.freeze([Object.freeze({
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: 'P0-ROUTE-01',
    code_commit: COMMIT,
    environment: 'STAGING',
    command_digest: '2'.repeat(64),
    executable_digest: expectedTestExecutableDigest('P0-ROUTE-01'),
    started_at: '2026-07-27T10:00:00.000Z',
    completed_at: '2026-07-27T10:30:00.000Z',
    exit_code: 0,
    output_digest: '4'.repeat(64),
  })]),
});

const MEMBER_SCHEMA_SET = Object.freeze([Object.freeze({
  member_type: 'RouteProbe',
  schema_id: 'RouteProbe/V1',
})]);
const EXPECTED_MEMBERS = Object.freeze([Object.freeze({
  member_id: 'route:/api/market-stats',
  member_type: 'RouteProbe',
})]);
const MEMBERS = Object.freeze([Object.freeze({
  member_id: 'route:/api/market-stats',
  member_type: 'RouteProbe',
  payload: Object.freeze({
    status: 503,
    database_calls: 0,
  }),
})]);
const TEST_RESULTS = EVIDENCE.tests;

function exactRawSchema(value) {
  return validateRegisteredSchema(RAW_SCHEMA_ID, value);
}

function schemaValidator(schemaId, value) {
  if (schemaId === RAW_SCHEMA_ID) return exactRawSchema(value);
  if (schemaId === MEMBER_SCHEMA_ID) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join(',') !== 'database_calls,status'
      || !Number.isInteger(value.status)
      || !Number.isInteger(value.database_calls)
      || value.database_calls < 0) {
      throw new Error('invalid RouteProbe payload');
    }
    return true;
  }
  return validateRegisteredSchema(schemaId, value);
}

function schemaResolver(schemaId) {
  if (schemaId === RAW_SCHEMA_ID) return RAW_SCHEMA;
  if (schemaId === MEMBER_SCHEMA_ID) return MEMBER_SCHEMA;
  return registeredSchemaFor(schemaId);
}

function activeDescriptorForContract(evidenceContract) {
  return {
    ...acceptanceDescriptorForContract(evidenceContract),
    activation_state: 'ACTIVE',
  };
}

function definitionFixture() {
  const definition = {
    schema_version: 'ProgrammeGateAcceptanceDefinition/V1',
    definition_id: '0'.repeat(64),
    definition_digest: '0'.repeat(64),
    evidence_contract: GATE.evidence_contract,
    specification_root: ROOT,
    frozen_contract_pair_digest: null,
    evidence_object_json_schema_id: RAW_SCHEMA_ID,
    evidence_object_json_schema_digest: domainDigest(EVIDENCE_OBJECT_SCHEMA_DOMAIN, RAW_SCHEMA),
    evidence_subject_type: 'MarketStatsContainmentSubject',
    evidence_subject_identity_fields: ['gate_id'],
    immutable_member_universe_definition: {
      universe_id: 'G0_MARKET_STATS_MEMBERS',
      ordering_rule: 'UTF8_MEMBER_TYPE_THEN_ID',
      duplicate_effect: 'OPEN',
      missing_or_extra_effect: 'OPEN',
    },
    immutable_member_json_schema_set_digest: domainDigest(
      MEMBER_SCHEMA_SET_DOMAIN,
      MEMBER_SCHEMA_SET,
    ),
    member_enumerator_executable_digest: MEMBER_ENUMERATOR_DIGEST,
    member_enumerator_configuration_digest: MEMBER_ENUMERATOR_CONFIG_DIGEST,
    ordered_claim_predicate_definitions: GATE.acceptance_claims.map((claimKey) => ({
      claim_key: claimKey,
      result_type: 'BOOLEAN',
      exact_input_member_types_and_paths: [{
        member_type: 'MarketStatsContainmentAttestation',
        json_pointer: '',
      }],
      measurement_executable_digest: PREDICATE_DIGEST,
      measurement_configuration_digest: PREDICATE_CONFIG_DIGEST,
      comparison_operator: 'EQUALS',
      expected_typed_value: true,
    })),
  };
  const digest = domainDigest(
    ACCEPTANCE_DEFINITION_ID_DOMAIN,
    acceptanceDefinitionPayload(definition),
  );
  definition.definition_id = digest;
  definition.definition_digest = digest;
  return definition;
}

function fixture() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const definition = definitionFixture();
  const evidenceSubject = {
    gate_id: GATE.id,
    observed_at: OBSERVED_AT,
  };
  const claims = evaluateAcceptanceClaims({
    gate_id: GATE.id,
    evidence: EVIDENCE,
    context: {
      specificationRoot: ROOT,
      codeCommit: COMMIT,
      environment: 'STAGING',
      expectedSpecificationRoot: ROOT,
      expectedCodeCommit: COMMIT,
      expectedEnvironment: 'STAGING',
      observed_at: OBSERVED_AT,
      clock: { now: () => NOW },
    },
  });
  const key = {
    key_id: 'TEST_VALIDATOR_KEY',
    algorithm: 'Ed25519',
    public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
    permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
    permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
    valid_from: '2026-07-27T00:00:00.000Z',
    valid_until: '2026-07-28T00:00:00.000Z',
    revoked_at: null,
  };
  const envelope = {
    schema_version: 'ProgrammeGateEvidenceEnvelope/V2',
    gate_id: GATE.id,
    evidence_contract: GATE.evidence_contract,
    acceptance_definition_id: definition.definition_id,
    acceptance_definition_digest: definition.definition_digest,
    specification_root: ROOT,
    code_commit: COMMIT,
    environment: 'STAGING',
    evidence_subject_type: definition.evidence_subject_type,
    evidence_subject_id: domainDigest(EVIDENCE_SUBJECT_ID_DOMAIN, { gate_id: GATE.id }),
    evidence_subject_payload_digest: domainDigest(
      EVIDENCE_SUBJECT_PAYLOAD_DOMAIN,
      evidenceSubject,
    ),
    required_evidence_object_type: GATE.required_evidence_object_type,
    required_evidence_object_payload_digest: domainDigest(
      EVIDENCE_OBJECT_PAYLOAD_DOMAIN,
      EVIDENCE,
    ),
    exact_acceptance_claims: claims,
    immutable_member_root: domainDigest(
      IMMUTABLE_MEMBER_ROOT_DOMAIN,
      enumerateClosedMembers({
        expectedMembers: EXPECTED_MEMBERS,
        members: MEMBERS,
      }),
    ),
    test_result_root: domainDigest(TEST_RESULT_ROOT_DOMAIN, TEST_RESULTS),
    validator_executable_digest: EXECUTABLE_DIGEST,
    validator_configuration_digest: domainDigest(
      VALIDATOR_CONFIGURATION_DOMAIN,
      VALIDATOR_CONFIGURATION,
    ),
    validator_key_id: key.key_id,
    terminal_state: 'PASS',
    signature_algorithm: 'Ed25519',
    signature: '',
  };
  const dependencies = {
    domainDigest,
    validateSchema: schemaValidator,
    schemaFor: schemaResolver,
    knownSchemaIds: [...SCHEMA_IDS, RAW_SCHEMA_ID, MEMBER_SCHEMA_ID],
    acceptanceDescriptorForContract: activeDescriptorForContract,
    acceptanceDefinitions: [definition],
    enumerateClosedMembers,
    enumerateExpectedMembers: () => EXPECTED_MEMBERS,
    evaluateAcceptanceClaims,
    predicateRegistry: ACCEPTANCE_PREDICATES,
    verifySignature,
    validatorConfiguration: VALIDATOR_CONFIGURATION,
    allowedValidatorExecutableDigests: [EXECUTABLE_DIGEST],
    executableBindings: {
      [GATE.id]: {
        member_enumerator: {
          executable_digest: MEMBER_ENUMERATOR_DIGEST,
          configuration_digest: MEMBER_ENUMERATOR_CONFIG_DIGEST,
        },
        predicates: Object.fromEntries(GATE.acceptance_claims.map((claimKey) => [
          claimKey,
          {
            executable_digest: PREDICATE_DIGEST,
            configuration_digest: PREDICATE_CONFIG_DIGEST,
          },
        ])),
      },
    },
    keyRegistry: {
      schema_version: 'TrustedProgrammeGatePublicKeys/V1',
      registry_state: 'ACTIVE',
      keys: [key],
    },
  };
  const input = {
    gate: GATE,
    envelope,
    evidenceSubject,
    evidenceObject: EVIDENCE,
    members: MEMBERS,
    memberSchemaSet: MEMBER_SCHEMA_SET,
    testResults: TEST_RESULTS,
    expectedSpecificationRoot: ROOT,
    expectedFrozenContractPairDigest: null,
    expectedCodeCommit: COMMIT,
    expectedEnvironment: 'STAGING',
    clock: { now: () => NOW },
  };

  function sign() {
    envelope.signature = crypto.sign(
      null,
      signatureBytes({
        domain: EVIDENCE_SIGNATURE_DOMAIN,
        role: EVIDENCE_SIGNATURE_ROLE,
        payload: unsignedEnvelope(envelope),
      }),
      privateKey,
    ).toString('base64');
  }

  function readdressDefinition() {
    const digest = domainDigest(
      ACCEPTANCE_DEFINITION_ID_DOMAIN,
      acceptanceDefinitionPayload(definition),
    );
    definition.definition_id = digest;
    definition.definition_digest = digest;
    envelope.acceptance_definition_id = digest;
    envelope.acceptance_definition_digest = digest;
  }

  sign();
  return {
    dependencies,
    input,
    definition,
    envelope,
    key,
    sign,
    readdressDefinition,
  };
}

function validate(sample) {
  return createProgrammeGateEvidenceValidator(sample.dependencies)(sample.input);
}

function assertOpen(result, code) {
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      'evidence_envelope_id',
      'evidence_payload_digest',
      'gate_id',
      'reason',
      'reason_code',
      'state',
      'valid',
    ],
  );
  assert.equal(result.valid, false);
  assert.equal(result.state, 'OPEN');
  assert.equal(result.evidence_envelope_id, null);
  assert.equal(result.evidence_payload_digest, null);
  assert.equal(result.reason_code, code);
  assert.equal(Object.isFrozen(result), true);
}

test('valid raw evidence produces one typed PASS result', () => {
  const sample = fixture();
  const result = validate(sample);

  assert.equal(result.valid, true);
  assert.equal(result.state, 'PASS');
  assert.equal(result.gate_id, GATE.id);
  assert.match(result.evidence_envelope_id, /^[a-f0-9]{64}$/);
  assert.match(result.evidence_payload_digest, /^[a-f0-9]{64}$/);
  assert.equal(result.reason_code, null);
  assert.equal(Object.isFrozen(result), true);
});

test('a descriptor that has not activated its executable bindings returns OPEN', () => {
  const sample = fixture();
  sample.dependencies.acceptanceDescriptorForContract = (contract) => ({
    ...acceptanceDescriptorForContract(contract),
    activation_state: 'BLOCKED_PENDING_EXECUTABLE_BINDINGS',
  });
  assertOpen(validate(sample), 'ACCEPTANCE_DESCRIPTOR_MISMATCH');
});

test('all 34 registered claim functions remain closed and callable', () => {
  const descriptorKeys = Object.fromEntries(
    ACCEPTANCE_DEFINITION_DESCRIPTORS.map((descriptor) => [
      descriptor.gate_id,
      descriptor.ordered_claim_keys,
    ]),
  );
  let count = 0;
  for (const [gateId, predicates] of Object.entries(ACCEPTANCE_PREDICATES)) {
    assert.deepEqual(Object.keys(predicates), descriptorKeys[gateId]);
    for (const predicate of Object.values(predicates)) {
      assert.equal(typeof predicate, 'function');
      count += 1;
    }
  }
  assert.equal(count, 34);
});

test('missing or malformed evidence returns OPEN and never crosses the gate boundary', () => {
  const sample = fixture();
  for (const input of [
    undefined,
    {},
    { gate: GATE },
    { gate: GATE, envelope: null, evidenceObject: null },
  ]) {
    const result = createProgrammeGateEvidenceValidator(sample.dependencies)(input);
    assert.equal(result.state, 'OPEN');
    assert.equal(result.valid, false);
  }
});

test('old evidence and an absent trusted clock return OPEN', () => {
  const old = fixture();
  old.input.evidenceSubject.observed_at = '2026-07-26T11:59:59.999Z';
  old.envelope.evidence_subject_payload_digest = domainDigest(
    EVIDENCE_SUBJECT_PAYLOAD_DOMAIN,
    old.input.evidenceSubject,
  );
  old.input.testResults = [{
    ...TEST_RESULTS[0],
    started_at: '2026-07-26T10:00:00.000Z',
    completed_at: '2026-07-26T10:30:00.000Z',
  }];
  old.envelope.test_result_root = domainDigest(
    TEST_RESULT_ROOT_DOMAIN,
    old.input.testResults,
  );
  old.sign();
  assertOpen(validate(old), 'CLAIM_SET_MISMATCH');

  const noClock = fixture();
  noClock.input.clock = undefined;
  assertOpen(validate(noClock), 'CLAIM_EVALUATION_FAILED');
});

test('another specification root, code commit or environment returns OPEN', () => {
  const cases = [
    ['specification_root', '3'.repeat(64), 'SPECIFICATION_ROOT_MISMATCH'],
    ['code_commit', '4'.repeat(40), 'CODE_COMMIT_MISMATCH'],
    ['environment', 'PRODUCTION', 'ENVIRONMENT_MISMATCH'],
  ];
  for (const [field, value, reason] of cases) {
    const sample = fixture();
    sample.envelope[field] = value;
    sample.sign();
    assertOpen(validate(sample), reason);
  }
});

test('missing, extra and reordered claims return OPEN even when re-signed', () => {
  const missing = fixture();
  missing.envelope.exact_acceptance_claims = missing.envelope.exact_acceptance_claims.slice(0, -1);
  missing.sign();
  assertOpen(validate(missing), 'CLAIM_SET_MISMATCH');

  const extra = fixture();
  extra.envelope.exact_acceptance_claims = [...extra.envelope.exact_acceptance_claims, {
    claim_key: 'invented_claim',
    result_type: 'BOOLEAN',
    typed_value: true,
  }];
  extra.sign();
  assertOpen(validate(extra), 'CLAIM_SET_MISMATCH');

  const reordered = fixture();
  reordered.envelope.exact_acceptance_claims = [
    ...reordered.envelope.exact_acceptance_claims,
  ].reverse();
  reordered.sign();
  assertOpen(validate(reordered), 'CLAIM_SET_MISMATCH');
});

test('unknown evidence schema and unknown predicate return OPEN', () => {
  const unknownSchema = fixture();
  unknownSchema.definition.evidence_object_json_schema_id = 'UnknownEvidence/V1';
  unknownSchema.readdressDefinition();
  unknownSchema.sign();
  assertOpen(validate(unknownSchema), 'UNKNOWN_SCHEMA');

  const unknownPredicate = fixture();
  unknownPredicate.dependencies.predicateRegistry = {
    ...ACCEPTANCE_PREDICATES,
    [GATE.id]: {
      feature_gate_off: ACCEPTANCE_PREDICATES[GATE.id].feature_gate_off,
      containment_test_pass: ACCEPTANCE_PREDICATES[GATE.id].containment_test_pass,
    },
  };
  assertOpen(validate(unknownPredicate), 'UNKNOWN_PREDICATE');
});

test('a substituted evidence-object schema digest returns OPEN', () => {
  const sample = fixture();
  sample.definition.evidence_object_json_schema_digest = '2'.repeat(64);
  sample.readdressDefinition();
  sample.sign();
  assertOpen(validate(sample), 'EVIDENCE_OBJECT_SCHEMA_DIGEST_MISMATCH');
});

test('wrong definition, member and test roots return OPEN', () => {
  const definition = fixture();
  definition.envelope.acceptance_definition_id = '5'.repeat(64);
  definition.sign();
  assertOpen(validate(definition), 'ACCEPTANCE_DEFINITION_BINDING_MISMATCH');

  const members = fixture();
  members.envelope.immutable_member_root = '6'.repeat(64);
  members.sign();
  assertOpen(validate(members), 'IMMUTABLE_MEMBER_ROOT_MISMATCH');

  const tests = fixture();
  tests.envelope.test_result_root = '7'.repeat(64);
  tests.sign();
  assertOpen(validate(tests), 'TEST_RESULT_ROOT_MISMATCH');
});

test('missing, extra or failed adversarial test results return OPEN', () => {
  for (const testResults of [
    [],
    [...TEST_RESULTS, { ...TEST_RESULTS[0], test_id: 'UNREGISTERED-01' }],
    [{ ...TEST_RESULTS[0], exit_code: 1 }],
    [{ ...TEST_RESULTS[0], executable_digest: '9'.repeat(64) }],
  ]) {
    const sample = fixture();
    sample.input.testResults = testResults;
    assert.equal(validate(sample).state, 'OPEN');
  }
});

test('invalid signature and untrusted key return OPEN', () => {
  const invalidSignature = fixture();
  invalidSignature.envelope.signature = Buffer.alloc(64, 9).toString('base64');
  assertOpen(validate(invalidSignature), 'SIGNATURE_NOT_TRUSTED');

  const untrusted = fixture();
  untrusted.dependencies.keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [],
  };
  assertOpen(validate(untrusted), 'SIGNATURE_NOT_TRUSTED');

  const falseVerifier = fixture();
  falseVerifier.dependencies.verifySignature = () => false;
  assertOpen(validate(falseVerifier), 'SIGNATURE_NOT_TRUSTED');
});

test('wrong key role, domain, validity or revocation returns OPEN', () => {
  const keyMutations = [
    { permitted_roles: ['STATUS_PUBLISHER'] },
    { permitted_domains: ['PROGRAMME_GATE_STATUS/V2'] },
    { valid_from: '2026-07-27T12:00:00.001Z' },
    { valid_until: '2026-07-27T12:00:00.000Z' },
    { revoked_at: '2026-07-27T11:00:00.000Z' },
  ];
  for (const mutation of keyMutations) {
    const sample = fixture();
    sample.dependencies.keyRegistry = {
      ...sample.dependencies.keyRegistry,
      keys: [{ ...sample.key, ...mutation }],
    };
    assertOpen(validate(sample), 'SIGNATURE_NOT_TRUSTED');
  }
});

test('unregistered validator executable or configuration returns OPEN', () => {
  const executable = fixture();
  executable.dependencies.allowedValidatorExecutableDigests = ['8'.repeat(64)];
  assertOpen(validate(executable), 'VALIDATOR_EXECUTABLE_NOT_ALLOWED');

  const configuration = fixture();
  configuration.dependencies.validatorConfiguration = {
    ...VALIDATOR_CONFIGURATION,
    permitted_environments: ['STAGING'],
  };
  assertOpen(validate(configuration), 'VALIDATOR_CONFIGURATION_NOT_ALLOWED');
});

test('caller-supplied result, PASS or manual state in raw evidence returns OPEN', () => {
  for (const field of [
    ['result', true],
    ['pass', true],
    ['state', 'PASS'],
    ['terminal_state', 'PASS'],
  ]) {
    const sample = fixture();
    sample.input.evidenceObject = {
      ...EVIDENCE,
      [field[0]]: field[1],
    };
    sample.envelope.required_evidence_object_payload_digest = domainDigest(
      EVIDENCE_OBJECT_PAYLOAD_DOMAIN,
      sample.input.evidenceObject,
    );
    sample.sign();
    assertOpen(validate(sample), 'SCHEMA_VALIDATION_FAILED');
  }
});

test('a false raw observation cannot become PASS through a signed manual claim', () => {
  const sample = fixture();
  sample.input.evidenceObject = {
    ...EVIDENCE,
    route_feature_enabled: true,
  };
  sample.envelope.required_evidence_object_payload_digest = domainDigest(
    EVIDENCE_OBJECT_PAYLOAD_DOMAIN,
    sample.input.evidenceObject,
  );
  sample.sign();
  assertOpen(validate(sample), 'SCHEMA_VALIDATION_FAILED');
});
