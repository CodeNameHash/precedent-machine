const { domainDigest } = require('./bytes');
const { evaluateAcceptanceClaims } = require('./predicates');
const { acceptanceDescriptorForContract } = require('./registry');
const { validateSchema } = require('./schema-registry');
const { createIsolationContractBundle } = require('./isolation-contracts');
const {
  ISOLATION_CONTRACTS,
  isolationMembers,
  memberSchemaSetForIsolation,
} = require('./isolation-enumerator');

const SOURCE_KEYS = Object.freeze([
  'schema_version',
  'observed_at',
  'production_project_ref',
  'staging_project_ref',
  'production_credential_identity_digest',
  'staging_credential_identity_digest',
  'production_dml_probe',
  'restore_mode',
  'preview_deployment_id',
  'preview_code_commit',
  'preview_credential_scope',
  'production_alias_before',
  'production_alias_after',
  'preview_route_actions',
  'secret_field_count',
]);
const ISOLATION_GATE_ORDER = Object.freeze([
  'G0_STAGING_SUPABASE_ISOLATED',
  'G0_STAGING_VERCEL_ISOLATED',
  'G0_STAGING_ACCESS_PROTECTED',
]);
const PRODUCTION_PROJECT_REF = 'tzulhdasmioeechxapdy';
const STAGING_PROJECT_REF = 'sjumbznveyyiizhwvixj';
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const DEPLOYMENT_PATTERN = /^dpl_[A-Za-z0-9]+$/;
const authorityBrands = new WeakSet();

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function requireExactKeys(value, keys, label) {
  if (!exactKeys(value, keys)) throw new Error(`${label} does not match its closed input`);
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

function validateSource(source, authority) {
  requireExactKeys(source, SOURCE_KEYS, 'isolation source');
  requireTimestamp(source.observed_at, 'isolation source observed_at');
  requirePattern(
    source.production_credential_identity_digest,
    DIGEST_PATTERN,
    'production credential identity digest',
  );
  requirePattern(
    source.staging_credential_identity_digest,
    DIGEST_PATTERN,
    'staging credential identity digest',
  );
  requirePattern(source.preview_deployment_id, DEPLOYMENT_PATTERN, 'preview deployment ID');
  requirePattern(source.preview_code_commit, COMMIT_PATTERN, 'preview code commit');
  if (source.schema_version !== 'ProgrammeGateIsolationObservationSource/V1'
    || source.production_project_ref !== PRODUCTION_PROJECT_REF
    || source.staging_project_ref !== STAGING_PROJECT_REF
    || source.production_project_ref === source.staging_project_ref
    || source.production_credential_identity_digest
      === source.staging_credential_identity_digest
    || source.production_dml_probe !== 'DENIED'
    || source.restore_mode !== 'PRODUCTION_SNAPSHOT_ONLY'
    || source.preview_code_commit !== authority.codeCommit
    || source.preview_credential_scope !== 'STAGING_ONLY'
    || source.production_alias_before !== source.production_alias_after
    || source.secret_field_count !== 0) {
    throw new Error('isolation source does not contain a passing closed observation');
  }
  if (source.observed_at !== authority.observedAt) {
    throw new Error('isolation source observation time has drifted');
  }
  return source;
}

function createIsolationReadinessAuthority(input) {
  requireExactKeys(input, [
    'codeCommit',
    'environment',
    'observedAt',
    'specificationRoot',
    'verificationTime',
  ], 'isolation readiness authority');
  const specificationRoot = requirePattern(
    input.specificationRoot,
    DIGEST_PATTERN,
    'specification root',
  );
  const codeCommit = requirePattern(input.codeCommit, COMMIT_PATTERN, 'code commit');
  if (input.environment !== 'PRODUCTION') {
    throw new Error('isolation evidence must be bound from the protected production controller');
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
    throw new TypeError('a closed isolation readiness authority is required');
  }
  return value;
}

function validateTestResult(testResult, authority, observedAt, expectedTestId) {
  validateSchema('ProgrammeGateTestExecutionRecord/V1', testResult);
  if (testResult.test_id !== expectedTestId
    || testResult.code_commit !== authority.codeCommit
    || testResult.environment !== authority.environment
    || testResult.exit_code !== 0
    || Date.parse(testResult.completed_at) > Date.parse(observedAt)) {
    throw new Error(`${expectedTestId} execution does not match the isolation evidence`);
  }
}

function evidenceObjects(source) {
  return Object.freeze([
    Object.freeze({
      production_project_identity_digest: domainDigest(
        'PROGRAMME_GATE_SUPABASE_PROJECT_IDENTITY/V1',
        { project_ref: source.production_project_ref },
      ),
      staging_project_identity_digest: domainDigest(
        'PROGRAMME_GATE_SUPABASE_PROJECT_IDENTITY/V1',
        { project_ref: source.staging_project_ref },
      ),
      production_credential_identity_digest:
        source.production_credential_identity_digest,
      staging_credential_identity_digest:
        source.staging_credential_identity_digest,
      production_dml_probe: source.production_dml_probe,
      restore_mode: source.restore_mode,
    }),
    Object.freeze({
      preview_deployment_id: source.preview_deployment_id,
      preview_credential_scope: source.preview_credential_scope,
      production_alias_before: source.production_alias_before,
      production_alias_after: source.production_alias_after,
    }),
    Object.freeze({
      preview_route_actions: source.preview_route_actions,
    }),
  ]);
}

function evidenceSubject({ gateId, authority, sourceDigest }) {
  return Object.freeze({
    gate_id: gateId,
    code_commit: authority.codeCommit,
    environment: authority.environment,
    observed_at: authority.observedAt,
    isolation_source_digest: sourceDigest,
  });
}

function gateForEvidence(gateId) {
  const contractByGate = {
    G0_STAGING_SUPABASE_ISOLATED: ISOLATION_CONTRACTS.SUPABASE,
    G0_STAGING_VERCEL_ISOLATED: ISOLATION_CONTRACTS.VERCEL,
    G0_STAGING_ACCESS_PROTECTED: ISOLATION_CONTRACTS.ACCESS,
  };
  const descriptor = acceptanceDescriptorForContract(contractByGate[gateId]);
  return Object.freeze({
    id: descriptor.gate_id,
    evidence_contract: descriptor.evidence_contract,
    required_evidence_object_type: descriptor.evidence_object_type,
    acceptance_claims: descriptor.ordered_claim_keys,
    required_adversarial_tests: descriptor.required_adversarial_tests,
  });
}

function buildIsolationReadiness(input) {
  requireExactKeys(
    input,
    [
      'authority',
      'source',
      'gateTestResult',
      'deployCutoverTestResult',
      'previewAuthTestResult',
    ],
    'isolation readiness input',
  );
  const authority = requireAuthority(input.authority);
  const source = validateSource(input.source, authority);
  validateTestResult(input.gateTestResult, authority, authority.observedAt, 'GATE-01');
  validateTestResult(
    input.deployCutoverTestResult,
    authority,
    authority.observedAt,
    'DEPLOY-CUTOVER-01',
  );
  validateTestResult(
    input.previewAuthTestResult,
    authority,
    authority.observedAt,
    'PREVIEW-AUTH-01',
  );
  const sourceDigest = domainDigest('PROGRAMME_GATE_ISOLATION_OBSERVATION_SOURCE/V1', source);
  const contracts = createIsolationContractBundle({
    specificationRoot: authority.specificationRoot,
  });
  const definitionsByContract = new Map(
    contracts.definitions.map((definition) => [definition.evidence_contract, definition]),
  );
  const candidates = evidenceObjects(source).map((evidenceObject, index) => {
    const gate = gateForEvidence(ISOLATION_GATE_ORDER[index]);
    const definition = definitionsByContract.get(gate.evidence_contract);
    if (!definition) throw new Error(`${gate.id} has no exact acceptance definition`);
    validateSchema(definition.evidence_object_json_schema_id, evidenceObject);
    const testResults = gate.id === 'G0_STAGING_ACCESS_PROTECTED'
      ? [input.gateTestResult, input.previewAuthTestResult]
      : [
          gate.required_adversarial_tests[0] === 'DEPLOY-CUTOVER-01'
            ? input.deployCutoverTestResult
            : input.gateTestResult,
        ];
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
      },
    });
    if (claims.some((claim) => claim.typed_value !== true)) {
      throw new Error(`${gate.id} does not satisfy its exact acceptance claims`);
    }
    return Object.freeze({
      gate_id: gate.id,
      evidence_contract: gate.evidence_contract,
      acceptance_definition_id: definition.definition_id,
      evidence_subject: evidenceSubject({ gateId: gate.id, authority, sourceDigest }),
      evidence_object: evidenceObject,
      members: isolationMembers({ definition, evidenceObject }),
      member_schema_set: memberSchemaSetForIsolation(gate.evidence_contract),
      test_results: Object.freeze(testResults),
      exact_acceptance_claims: claims,
      signature: null,
      formal_gate_state: 'OPEN',
      readiness_state: 'READY_FOR_SIGNATURE',
    });
  });
  return deepFreeze({
    readiness_type: 'ProgrammeGateIsolationReadiness/V1',
    specification_root: authority.specificationRoot,
    code_commit: authority.codeCommit,
    environment: authority.environment,
    observed_at: authority.observedAt,
    isolation_source_digest: sourceDigest,
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
  ISOLATION_GATE_ORDER,
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  buildIsolationReadiness,
  createIsolationReadinessAuthority,
  validateSource,
};
