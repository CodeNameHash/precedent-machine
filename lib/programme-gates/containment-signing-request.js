const crypto = require('node:crypto');

const { signatureBytes } = require('./bytes');
const {
  enumerateContainmentExpectedMembers,
  memberSchemaSetForContract,
} = require('./containment-enumerator');
const { enumerateClosedMembers } = require('./enumerate');
const { evaluateAcceptanceClaims } = require('./predicates');
const { REGISTRY_DIGESTS } = require('./registry');
const { validateSchema } = require('./schema-registry');
const {
  EVIDENCE_OBJECT_PAYLOAD_DOMAIN,
  EVIDENCE_SIGNATURE_DOMAIN,
  EVIDENCE_SIGNATURE_ROLE,
  EVIDENCE_SUBJECT_ID_DOMAIN,
  EVIDENCE_SUBJECT_PAYLOAD_DOMAIN,
  IMMUTABLE_MEMBER_ROOT_DOMAIN,
  MEMBER_SCHEMA_SET_DOMAIN,
  TEST_RESULT_ROOT_DOMAIN,
} = require('./validator');
const { domainDigest } = require('./bytes');

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

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireTrustedPublicKeyBinding({
  keyRegistry,
  validatorKeyId,
  verificationTime,
}) {
  validateSchema('TrustedProgrammeGatePublicKeys/V1', keyRegistry);
  if (keyRegistry.registry_state !== 'ACTIVE') {
    throw new Error('trusted public-key registry is not active');
  }
  const matches = keyRegistry.keys.filter((entry) => entry.key_id === validatorKeyId);
  if (matches.length !== 1) {
    throw new Error('validator key ID is not uniquely trusted');
  }
  const key = matches[0];
  if (!key.permitted_roles.includes(EVIDENCE_SIGNATURE_ROLE)
    || !key.permitted_domains.includes(EVIDENCE_SIGNATURE_DOMAIN)) {
    throw new Error('validator key does not permit the evidence signature role and domain');
  }
  const observed = Date.parse(verificationTime);
  const validFrom = Date.parse(key.valid_from);
  const validUntil = Date.parse(key.valid_until);
  const revokedAt = key.revoked_at === null ? null : Date.parse(key.revoked_at);
  if (!Number.isFinite(observed)
    || !Number.isFinite(validFrom)
    || !Number.isFinite(validUntil)
    || observed < validFrom
    || observed >= validUntil
    || (revokedAt !== null && observed >= revokedAt)) {
    throw new Error('validator key is not valid at the signing-request time');
  }
  if (crypto.createPublicKey(key.public_key_pem).asymmetricKeyType !== 'ed25519') {
    throw new Error('validator key must be Ed25519');
  }
}

function createContainmentSigningRequestAuthority(input) {
  requireExactKeys(input, [
    'keyRegistry',
    'validatorConfigurationDigest',
    'validatorExecutableDigest',
    'validatorKeyId',
    'verificationTime',
  ], 'containment signing-request authority');
  requireDigest(input.validatorExecutableDigest, 'validator executable digest');
  requireDigest(input.validatorConfigurationDigest, 'validator configuration digest');
  if (input.validatorConfigurationDigest !== REGISTRY_DIGESTS.validator_configuration) {
    throw new Error('validator configuration digest is not the registered configuration');
  }
  if (typeof input.validatorKeyId !== 'string' || input.validatorKeyId.length === 0) {
    throw new TypeError('validator key ID must be non-empty');
  }
  requireTrustedPublicKeyBinding({
    keyRegistry: input.keyRegistry,
    validatorKeyId: input.validatorKeyId,
    verificationTime: input.verificationTime,
  });
  const authority = deepFreeze({
    keyRegistry: structuredClone(input.keyRegistry),
    validatorConfigurationDigest: input.validatorConfigurationDigest,
    validatorExecutableDigest: input.validatorExecutableDigest,
    validatorKeyId: input.validatorKeyId,
    verificationTime: new Date(input.verificationTime).toISOString(),
  });
  authorityBrands.add(authority);
  return authority;
}

function requireAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed containment signing-request authority is required');
  }
  return value;
}

function definitionFor(bundle, candidate) {
  const matches = bundle.acceptance_definitions.filter(
    (definition) => definition.evidence_contract === candidate.evidence_contract,
  );
  if (matches.length !== 1) {
    throw new Error('candidate does not resolve to one acceptance definition');
  }
  const definition = matches[0];
  if (candidate.acceptance_definition_id !== definition.definition_id) {
    throw new Error('candidate acceptance definition has drifted');
  }
  validateSchema('ProgrammeGateAcceptanceDefinition/V1', definition);
  return definition;
}

function evidenceSubjectIdentity(subject, fields) {
  const identity = {};
  for (const field of fields) {
    if (!Object.hasOwn(subject, field)) {
      throw new Error(`evidence subject is missing identity field ${field}`);
    }
    identity[field] = subject[field];
  }
  return identity;
}

function validateCandidateEvidence({
  authority,
  bundle,
  candidate,
  definition,
  gate,
  orderedMembers,
  orderedTests,
}) {
  validateSchema(definition.evidence_object_json_schema_id, candidate.evidence_object);
  const subject = candidate.evidence_subject;
  if (subject.gate_id !== gate.id
    || subject.code_commit !== bundle.code_commit
    || subject.runtime_deployment_id !== bundle.runtime_deployment_id
    || subject.environment !== bundle.environment
    || subject.observed_at !== bundle.observed_at
    || candidate.evidence_object.observed_at !== bundle.observed_at) {
    throw new Error('containment evidence subject has drifted from the bundle');
  }
  const expectedMemberSchemaSet = memberSchemaSetForContract(gate.evidence_contract);
  if (domainDigest(MEMBER_SCHEMA_SET_DOMAIN, candidate.member_schema_set)
    !== definition.immutable_member_json_schema_set_digest
    || domainDigest(MEMBER_SCHEMA_SET_DOMAIN, expectedMemberSchemaSet)
      !== definition.immutable_member_json_schema_set_digest) {
    throw new Error('containment member schema set has drifted');
  }
  for (const member of orderedMembers) {
    const binding = expectedMemberSchemaSet.find(
      (entry) => entry.member_type === member.member_type,
    );
    if (!binding) throw new Error(`unbound containment member type ${member.member_type}`);
    validateSchema(binding.schema_id, member.payload);
  }
  const evidenceTests = [...candidate.evidence_object.tests].sort(
    (left, right) => compareUtf8(left.test_id, right.test_id),
  );
  if (domainDigest(TEST_RESULT_ROOT_DOMAIN, orderedTests)
    !== domainDigest(TEST_RESULT_ROOT_DOMAIN, evidenceTests)) {
    throw new Error('containment test executions have drifted');
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
    !== domainDigest(
      'PROGRAMME_GATE_ACCEPTANCE_CLAIMS/V1',
      candidate.exact_acceptance_claims,
    )
    || recomputedClaims.some((claim) => claim.typed_value !== true)) {
    throw new Error('containment acceptance claims are not exact passing measurements');
  }
}

function buildContainmentEvidenceSigningRequest(input) {
  requireExactKeys(
    input,
    ['authority', 'bundle', 'candidate', 'gate'],
    'containment evidence signing request',
  );
  const authority = requireAuthority(input.authority);
  const { bundle, candidate, gate } = input;
  if (bundle.readiness_state !== 'READY_FOR_SIGNATURE'
    || bundle.formal_gate_state !== 'OPEN'
    || bundle.private_key_used !== false
    || bundle.status_publication_attempted !== false
    || candidate.readiness_state !== 'READY_FOR_SIGNATURE'
    || candidate.formal_gate_state !== 'OPEN'
    || candidate.signature !== null) {
    throw new Error('only unsigned OPEN readiness can become a signing request');
  }
  if (candidate.gate_id !== gate.id
    || candidate.evidence_contract !== gate.evidence_contract
    || candidate.evidence_object.gate_id !== gate.id) {
    throw new Error('containment candidate has inconsistent gate or runtime bindings');
  }
  if (bundle.code_commit !== candidate.evidence_object.code_commit
    || bundle.environment !== candidate.evidence_object.environment
    || bundle.runtime_deployment_id !== candidate.evidence_object.runtime_deployment_id) {
    throw new Error('containment candidate has inconsistent bundle bindings');
  }

  const definition = definitionFor(bundle, candidate);
  const expectedMembers = enumerateContainmentExpectedMembers({
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
  validateCandidateEvidence({
    authority,
    bundle,
    candidate,
    definition,
    gate,
    orderedMembers,
    orderedTests,
  });
  const subjectIdentity = evidenceSubjectIdentity(
    candidate.evidence_subject,
    definition.evidence_subject_identity_fields,
  );
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
      subjectIdentity,
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
    immutable_member_root: domainDigest(
      IMMUTABLE_MEMBER_ROOT_DOMAIN,
      orderedMembers,
    ),
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
    request_type: 'ProgrammeGateEvidenceSigningRequest/V1',
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

module.exports = {
  buildContainmentEvidenceSigningRequest,
  createContainmentSigningRequestAuthority,
};
