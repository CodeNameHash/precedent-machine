const { domainDigest } = require('./bytes');
const { evaluateAcceptanceClaims } = require('./predicates');
const { acceptanceDescriptorForContract } = require('./registry');
const { validateSchema } = require('./schema-registry');
const {
  createSecurityDispositionContractBundle,
} = require('./security-disposition-contracts');
const {
  SECURITY_DISPOSITION_CONTRACTS,
  memberSchemaSetForSecurityDisposition,
  securityDispositionMembers,
} = require('./security-disposition-enumerator');

const SOURCE_KEYS = Object.freeze([
  'schema_version',
  'source_id',
  'confirmed_by',
  'confirmed_at',
  'zayo',
  'claude',
  'supabase',
  'secret_field_count',
]);
const ZAYO_KEYS = Object.freeze([
  'owner',
  'purpose',
  'recognition_status',
  'rotation_required',
  'rotation_completed',
]);
const CLAUDE_KEYS = Object.freeze([
  'compromised_credential_set_label',
  'revoked',
  'replacements_activated',
]);
const SUPABASE_KEYS = Object.freeze(['disposition']);
const SECURITY_GATE_ORDER = Object.freeze([
  'G0_ZAYO_DISPOSITION',
  'G0_CLAUDE_CREDENTIAL_ROTATION',
  'G0_SUPABASE_SECRET_DISPOSITION',
]);
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
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

function validateSource(source) {
  requireExactKeys(source, SOURCE_KEYS, 'security-disposition source');
  requireExactKeys(source.zayo, ZAYO_KEYS, 'Zayo source');
  requireExactKeys(source.claude, CLAUDE_KEYS, 'Claude source');
  requireExactKeys(source.supabase, SUPABASE_KEYS, 'Supabase source');
  if (source.schema_version !== 'ProgrammeOwnerSecurityDispositionSource/V1'
    || source.source_id !== 'BEN_CONFIRMATION_2026_07_28'
    || source.confirmed_by !== 'BEN_GOODCHILD'
    || source.secret_field_count !== 0
    || source.zayo.owner !== 'OWNER_IDENTITY_CONFIRMED_BY_BEN_GOODCHILD'
    || source.zayo.purpose !== 'AUTHORISED_DATABASE_TRAFFIC'
    || source.zayo.recognition_status !== 'RECOGNISED'
    || source.zayo.rotation_required !== false
    || source.zayo.rotation_completed !== false
    || source.claude.compromised_credential_set_label !== 'EXPOSED_CLAUDE_CREDENTIALS'
    || source.claude.revoked !== true
    || source.claude.replacements_activated !== true
    || source.supabase.disposition !== 'ROTATED') {
    throw new Error('security-disposition source does not contain the approved confirmations');
  }
  requireTimestamp(source.confirmed_at, 'source confirmed_at');
  return source;
}

function createSecurityDispositionReadinessAuthority(input) {
  requireExactKeys(input, [
    'codeCommit',
    'environment',
    'observedAt',
    'specificationRoot',
    'verificationTime',
  ], 'security-disposition readiness authority');
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
    throw new TypeError('a closed security-disposition readiness authority is required');
  }
  return value;
}

function validateTestResult(testResult, authority, observedAt) {
  validateSchema('ProgrammeGateTestExecutionRecord/V1', testResult);
  if (testResult.test_id !== 'GATE-01'
    || testResult.code_commit !== authority.codeCommit
    || testResult.environment !== authority.environment
    || testResult.exit_code !== 0
    || Date.parse(testResult.completed_at) > Date.parse(observedAt)) {
    throw new Error('GATE-01 execution does not match the security-disposition evidence');
  }
}

function evidenceObjects(source, authority, sourceDigest) {
  const shared = {
    code_commit: authority.codeCommit,
    environment: authority.environment,
    observed_at: authority.observedAt,
    attestation_source_digest: sourceDigest,
  };
  const credentialSetId = domainDigest(
    'PROGRAMME_GATE_CREDENTIAL_SET_ID/V1',
    {
      source_digest: sourceDigest,
      label: source.claude.compromised_credential_set_label,
    },
  );
  return Object.freeze([
    Object.freeze({
      schema_version: 'ZayoTrafficDisposition/V1',
      gate_id: 'G0_ZAYO_DISPOSITION',
      ...shared,
      process_identity_digest: domainDigest(
        'PROGRAMME_GATE_PROCESS_ID/V1',
        { source_digest: sourceDigest, disposition: source.zayo },
      ),
      owner: source.zayo.owner,
      purpose: source.zayo.purpose,
      recognition_status: source.zayo.recognition_status,
      rotation_required: source.zayo.rotation_required,
      rotation_completed: source.zayo.rotation_completed,
      secret_field_count: 0,
    }),
    Object.freeze({
      schema_version: 'ClaudeCredentialRotationReceipt/V1',
      gate_id: 'G0_CLAUDE_CREDENTIAL_ROTATION',
      ...shared,
      compromised_credential_ids: Object.freeze([credentialSetId]),
      revoked_ids: Object.freeze([credentialSetId]),
      replacement_activation_verified_at: source.confirmed_at,
      secret_field_count: 0,
    }),
    Object.freeze({
      schema_version: 'SupabaseSecretDisposition/V1',
      gate_id: 'G0_SUPABASE_SECRET_DISPOSITION',
      ...shared,
      disposition: source.supabase.disposition,
      rotation_verified_at: source.confirmed_at,
      ben_approval_id: null,
      secret_field_count: 0,
    }),
  ]);
}

function evidenceSubject(evidenceObject) {
  return Object.freeze({
    gate_id: evidenceObject.gate_id,
    code_commit: evidenceObject.code_commit,
    environment: evidenceObject.environment,
    observed_at: evidenceObject.observed_at,
    attestation_source_digest: evidenceObject.attestation_source_digest,
  });
}

function gateForEvidence(evidenceObject) {
  const contractByGate = {
    G0_ZAYO_DISPOSITION: SECURITY_DISPOSITION_CONTRACTS.ZAYO,
    G0_CLAUDE_CREDENTIAL_ROTATION: SECURITY_DISPOSITION_CONTRACTS.CLAUDE,
    G0_SUPABASE_SECRET_DISPOSITION: SECURITY_DISPOSITION_CONTRACTS.SUPABASE,
  };
  const descriptor = acceptanceDescriptorForContract(contractByGate[evidenceObject.gate_id]);
  return Object.freeze({
    id: descriptor.gate_id,
    evidence_contract: descriptor.evidence_contract,
    required_evidence_object_type: descriptor.evidence_object_type,
    acceptance_claims: descriptor.ordered_claim_keys,
    required_adversarial_tests: descriptor.required_adversarial_tests,
  });
}

function buildSecurityDispositionReadiness(input) {
  requireExactKeys(
    input,
    ['authority', 'source', 'testResult'],
    'security-disposition readiness input',
  );
  const authority = requireAuthority(input.authority);
  const source = validateSource(input.source);
  if (Date.parse(source.confirmed_at) > Date.parse(authority.observedAt)) {
    throw new Error('security-disposition source is newer than the evidence observation');
  }
  validateTestResult(input.testResult, authority, authority.observedAt);
  const sourceDigest = domainDigest('PROGRAMME_OWNER_SECURITY_DISPOSITION_SOURCE/V1', source);
  const contracts = createSecurityDispositionContractBundle({
    specificationRoot: authority.specificationRoot,
  });
  const definitionsByContract = new Map(
    contracts.definitions.map((definition) => [definition.evidence_contract, definition]),
  );
  const candidates = evidenceObjects(source, authority, sourceDigest).map((evidenceObject) => {
    validateSchema(evidenceObject.schema_version, evidenceObject);
    const gate = gateForEvidence(evidenceObject);
    const definition = definitionsByContract.get(gate.evidence_contract);
    if (!definition) throw new Error(`${gate.id} has no exact acceptance definition`);
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
      evidence_subject: evidenceSubject(evidenceObject),
      evidence_object: evidenceObject,
      members: securityDispositionMembers({ definition, evidenceObject }),
      member_schema_set: memberSchemaSetForSecurityDisposition(gate.evidence_contract),
      test_results: Object.freeze([input.testResult]),
      exact_acceptance_claims: claims,
      signature: null,
      formal_gate_state: 'OPEN',
      readiness_state: 'READY_FOR_SIGNATURE',
    });
  });
  if (candidates.some((candidate, index) => candidate.gate_id !== SECURITY_GATE_ORDER[index])) {
    throw new Error('security-disposition candidates do not match the closed gate order');
  }
  return deepFreeze({
    readiness_type: 'ProgrammeGateSecurityDispositionReadiness/V1',
    specification_root: authority.specificationRoot,
    code_commit: authority.codeCommit,
    environment: authority.environment,
    observed_at: authority.observedAt,
    attestation_source_digest: sourceDigest,
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
  SECURITY_GATE_ORDER,
  buildSecurityDispositionReadiness,
  createSecurityDispositionReadinessAuthority,
  validateSource,
};
