const {
  BOOTSTRAP_NONCE,
  requireGoverningRegistryAuthority,
} = require('./governing-registry');
const {
  EVIDENCE_ENVELOPE_ID_DOMAIN,
  EVIDENCE_PAYLOAD_DOMAIN,
} = require('./validator');

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const authorityBrands = new WeakSet();

function requireExactKeys(value, allowedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const extras = keys.filter((key) => !allowedKeys.includes(key));
  const missing = allowedKeys.filter((key) => !keys.includes(key));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(', ')}`);
  if (missing.length > 0) throw new Error(`${label} is missing fields: ${missing.join(', ')}`);
}

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function`);
  return value;
}

function requireDigest(value, label) {
  if (!DIGEST_PATTERN.test(value)) throw new TypeError(`${label} must be a SHA-256 digest`);
  return value;
}

function requireCommit(value, label) {
  if (!COMMIT_PATTERN.test(value)) throw new TypeError(`${label} must be a Git commit ID`);
  return value;
}

function createProgrammeStatusAuthority(dependencies) {
  requireExactKeys(dependencies, [
    'governingRegistryAuthority',
    'domainDigest',
    'validateEvidence',
    'evidencePayloadForDigest',
    'validateStatusSchema',
    'verifyStatusSignature',
    'validatorExecutableDigest',
    'validatorConfigurationDigest',
    'validatorKeyId',
    'bootstrapState',
    'terminalPairState',
  ], 'programme status authority dependencies');

  const registry = requireGoverningRegistryAuthority(dependencies.governingRegistryAuthority);
  const authority = Object.freeze({
    registry,
    domainDigest: requireFunction(dependencies.domainDigest, 'domainDigest'),
    validateEvidence: requireFunction(dependencies.validateEvidence, 'validateEvidence'),
    evidencePayloadForDigest: requireFunction(
      dependencies.evidencePayloadForDigest,
      'evidencePayloadForDigest',
    ),
    validateStatusSchema: requireFunction(
      dependencies.validateStatusSchema,
      'validateStatusSchema',
    ),
    verifyStatusSignature: requireFunction(
      dependencies.verifyStatusSignature,
      'verifyStatusSignature',
    ),
    validatorExecutableDigest: requireDigest(
      dependencies.validatorExecutableDigest,
      'validator executable digest',
    ),
    validatorConfigurationDigest: requireDigest(
      dependencies.validatorConfigurationDigest,
      'validator configuration digest',
    ),
    validatorKeyId: dependencies.validatorKeyId,
    bootstrapState: dependencies.bootstrapState,
    terminalPairState: dependencies.terminalPairState,
  });
  if (typeof authority.validatorKeyId !== 'string' || authority.validatorKeyId.length === 0) {
    throw new TypeError('validator key ID must be non-empty');
  }
  if (!['AVAILABLE', 'CONSUMED'].includes(authority.bootstrapState)) {
    throw new Error('bootstrap state must be AVAILABLE or CONSUMED');
  }
  if (!['UNVALIDATED', 'VALIDATED'].includes(authority.terminalPairState)) {
    throw new Error('terminal-pair state must be UNVALIDATED or VALIDATED');
  }
  authorityBrands.add(authority);
  return authority;
}

function requireProgrammeStatusAuthority(value) {
  if (!authorityBrands.has(value)) {
    throw new TypeError('a closed programme status authority is required');
  }
  return value;
}

function snapshotCandidate(candidate) {
  requireExactKeys(candidate, ['envelope', 'validation_input'], 'evidence candidate');
  if (!candidate.envelope || typeof candidate.envelope !== 'object'
    || Array.isArray(candidate.envelope)) {
    throw new TypeError('evidence candidate envelope must be an object');
  }
  if (!candidate.validation_input || typeof candidate.validation_input !== 'object'
    || Array.isArray(candidate.validation_input)) {
    throw new TypeError('evidence candidate validation_input must be an object');
  }
  return {
    envelope: structuredClone(candidate.envelope),
    validation_input: { ...candidate.validation_input },
  };
}

function validatedEvidenceForGate({ authority, gate, evidenceCandidates }) {
  const accepted = [];
  for (const originalCandidate of evidenceCandidates) {
    let candidate;
    try {
      candidate = snapshotCandidate(originalCandidate);
    } catch {
      continue;
    }
    const { envelope } = candidate;
    if (envelope.schema_version !== 'ProgrammeGateEvidenceEnvelope/V2'
      || envelope.gate_id !== gate.id
      || envelope.evidence_contract !== gate.evidence_contract
      || envelope.required_evidence_object_type !== gate.required_evidence_object_type
      || envelope.terminal_state !== 'PASS') {
      continue;
    }

    try {
      const result = authority.validateEvidence({
        ...candidate.validation_input,
        gate,
        envelope,
      });
      if (!result || result.valid !== true || result.gate_id !== gate.id) continue;
      const expectedEnvelopeId = authority.domainDigest(EVIDENCE_ENVELOPE_ID_DOMAIN, envelope);
      const expectedPayloadDigest = authority.domainDigest(
        EVIDENCE_PAYLOAD_DOMAIN,
        authority.evidencePayloadForDigest(envelope),
      );
      requireDigest(result.evidence_envelope_id, 'validated evidence envelope ID');
      requireDigest(result.evidence_payload_digest, 'validated evidence payload digest');
      if (result.evidence_envelope_id !== expectedEnvelopeId
        || result.evidence_payload_digest !== expectedPayloadDigest) {
        continue;
      }
      accepted.push(Object.freeze({
        evidence_envelope_id: expectedEnvelopeId,
        evidence_payload_digest: expectedPayloadDigest,
      }));
    } catch {
      // Invalid evidence deterministically projects OPEN.
    }
  }
  return accepted.length === 1 ? accepted[0] : null;
}

function resolveWorkClasses({
  authority,
  gateStateById,
  generation,
  predecessorStatusId,
}) {
  const registry = authority.registry;
  const workClasses = registry.work_classes;
  const workClassNames = registry.work_class_ids;
  const workClassNameSet = new Set(workClassNames);
  const resolved = new Map();
  const visiting = new Set();

  function dependenciesPass(name) {
    const definition = workClasses[name];
    if (!definition || !Array.isArray(definition.all_of)) {
      throw new TypeError(`work class ${name} must contain an all_of array`);
    }
    return definition.all_of.every((dependency) => {
      if (gateStateById.has(dependency)) return gateStateById.get(dependency) === 'PASS';
      if (workClassNameSet.has(dependency)) return resolve(dependency) === 'PASS';
      throw new Error(`work class ${name} has unknown dependency ${dependency}`);
    });
  }

  function resolve(name) {
    if (resolved.has(name)) return resolved.get(name);
    if (visiting.has(name)) throw new Error(`work-class dependency cycle at ${name}`);
    visiting.add(name);
    const allOfPasses = dependenciesPass(name);
    let state = allOfPasses ? 'PASS' : 'OPEN';
    if (name === 'gate_status_bootstrap') {
      state = allOfPasses
        && authority.bootstrapState === 'AVAILABLE'
        && generation === 1
        && predecessorStatusId === 'NONE'
        ? 'PASS'
        : 'OPEN';
    }
    if (name === 'programme_complete') {
      state = allOfPasses && authority.terminalPairState === 'VALIDATED' ? 'PASS' : 'OPEN';
    }
    visiting.delete(name);
    resolved.set(name, state);
    return state;
  }

  return workClassNames.map((workClass) => Object.freeze({
    work_class: workClass,
    state: resolve(workClass),
  }));
}

function projectProgrammeStatus(input) {
  requireExactKeys(input, [
    'authority',
    'evidenceCandidates',
    'generation',
    'predecessorStatusId',
  ], 'status projection input');
  const authority = requireProgrammeStatusAuthority(input.authority);
  if (!Array.isArray(input.evidenceCandidates)) {
    throw new TypeError('evidenceCandidates must be an array');
  }
  if (!Number.isInteger(input.generation) || input.generation < 1) {
    throw new TypeError('generation must be a positive integer');
  }
  if (input.generation === 1 && input.predecessorStatusId !== 'NONE') {
    throw new Error('generation 1 predecessor must be NONE');
  }
  if (input.generation > 1) {
    requireDigest(input.predecessorStatusId, 'predecessor status ID');
  }

  const supported = new Set(authority.registry.supported_gate_ids);
  const orderedGateProjection = authority.registry.gates.map((gate) => {
    const validated = supported.has(gate.id)
      ? validatedEvidenceForGate({
        authority,
        gate,
        evidenceCandidates: input.evidenceCandidates,
      })
      : null;
    return Object.freeze({
      gate_id: gate.id,
      state: validated ? 'PASS' : 'OPEN',
      evidence_envelope_id: validated ? validated.evidence_envelope_id : null,
      evidence_payload_digest: validated ? validated.evidence_payload_digest : null,
    });
  });
  const gateStateById = new Map(
    orderedGateProjection.map((entry) => [entry.gate_id, entry.state]),
  );

  return Object.freeze({
    ordered_gate_projection: Object.freeze(orderedGateProjection),
    ordered_work_class_projection: Object.freeze(resolveWorkClasses({
      authority,
      gateStateById,
      generation: input.generation,
      predecessorStatusId: input.predecessorStatusId,
    })),
  });
}

function buildUnsignedProgrammeGateStatus(input) {
  requireExactKeys(input, [
    'authority',
    'evidenceCandidates',
    'specificationRoot',
    'codeCommit',
    'environment',
    'generation',
    'predecessorStatusId',
  ], 'status artefact input');
  const authority = requireProgrammeStatusAuthority(input.authority);
  requireDigest(input.specificationRoot, 'specification root');
  requireCommit(input.codeCommit, 'code commit');
  if (!['STAGING', 'PRODUCTION'].includes(input.environment)) {
    throw new Error('environment must be STAGING or PRODUCTION');
  }

  const projection = projectProgrammeStatus({
    authority,
    evidenceCandidates: input.evidenceCandidates,
    generation: input.generation,
    predecessorStatusId: input.predecessorStatusId,
  });
  return Object.freeze({
    schema_version: 'ProgrammeGateStatusArtefact/V2',
    specification_root: input.specificationRoot,
    code_commit: input.codeCommit,
    environment: input.environment,
    generation: input.generation,
    predecessor_status_id: input.predecessorStatusId,
    gate_registry_digest: authority.registry.digest,
    ...projection,
    validator_executable_digest: authority.validatorExecutableDigest,
    validator_configuration_digest: authority.validatorConfigurationDigest,
    validator_key_id: authority.validatorKeyId,
    signature_algorithm: 'Ed25519',
  });
}

function attachProgrammeGateStatusSignature(input) {
  requireExactKeys(
    input,
    ['authority', 'unsignedStatus', 'signature'],
    'status signature attachment input',
  );
  const authority = requireProgrammeStatusAuthority(input.authority);
  if (!input.unsignedStatus || Object.hasOwn(input.unsignedStatus, 'signature')) {
    throw new Error('status must be unsigned before signature attachment');
  }
  if (typeof input.signature !== 'string' || input.signature.length === 0) {
    throw new TypeError('status signature must be non-empty');
  }
  const status = Object.freeze({ ...input.unsignedStatus, signature: input.signature });
  authority.validateStatusSchema('ProgrammeGateStatusArtefact/V2', status);
  if (authority.verifyStatusSignature(status) !== true) {
    throw new Error('status signature was not verified');
  }
  return status;
}

function unsignedProgrammeGateStatus(status) {
  if (!status || typeof status !== 'object' || Array.isArray(status)) {
    throw new TypeError('status must be an object');
  }
  const { signature, ...unsigned } = status;
  if (typeof signature !== 'string' || signature.length === 0) {
    throw new TypeError('signed status must contain a signature');
  }
  return unsigned;
}

module.exports = {
  BOOTSTRAP_NONCE,
  attachProgrammeGateStatusSignature,
  buildUnsignedProgrammeGateStatus,
  createProgrammeStatusAuthority,
  projectProgrammeStatus,
  requireProgrammeStatusAuthority,
  resolveWorkClasses,
  unsignedProgrammeGateStatus,
};
