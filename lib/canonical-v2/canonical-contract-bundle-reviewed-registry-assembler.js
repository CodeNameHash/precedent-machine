const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
  DEPENDENCY_REGISTRY_SCHEMA_VERSION,
  GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
  REQUIRED_BUNDLE_KINDS,
  compileCanonicalContractBundle,
} = require('./canonical-contract-bundle-compiler');

const REGISTRY_ASSEMBLY_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_REVIEWED_REGISTRY_ASSEMBLY/V1';
const GOVERNANCE_OBJECT_KIND =
  'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const INPUT_COMPILATION_SCHEMA_VERSION =
  'CANONICAL_BUNDLE_INPUT_COMPILATION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;

const REQUIRED_INPUT_KEYS = Object.freeze([
  'canonical_contract_input_compilation',
  'reviewed_dispositions',
  'registry_version',
  'predecessor_classification_registry',
  'predecessor_dependency_registry',
]);

class CanonicalContractBundleReviewedRegistryAssemblerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractBundleReviewedRegistryAssemblerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractBundleReviewedRegistryAssemblerError(
    code,
    message,
    details,
  );
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function requirePlainObject(value, label, code = 'INVALID_REVIEWED_REGISTRY_ASSEMBLER_INPUT') {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || (
      Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null
    )
  ) {
    fail(code, `${label} must be a plain object.`);
  }
}

function requireExactKeys(value, keys, label, code) {
  requirePlainObject(value, label, code);
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...keys].sort(compareStrings);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} fields do not match the closed contract.`, {
      actual,
      expected,
    });
  }
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lowercase SHA-256 digest.`);
  }
}

function validateTopLevelInput(input) {
  requireExactKeys(
    input,
    REQUIRED_INPUT_KEYS,
    'reviewed registry assembler input',
    'INVALID_REVIEWED_REGISTRY_ASSEMBLER_INPUT',
  );
  if (!Number.isSafeInteger(input.registry_version) || input.registry_version < 1) {
    fail(
      'INVALID_REVIEWED_REGISTRY_VERSION',
      'registry_version must be a positive safe integer.',
    );
  }
  if (input.registry_version === 1) {
    if (
      input.predecessor_classification_registry !== null
      || input.predecessor_dependency_registry !== null
    ) {
      fail(
        'INVALID_REVIEWED_REGISTRY_PREDECESSOR',
        'Registry version 1 must not have predecessor registries.',
      );
    }
  } else if (
    !input.predecessor_classification_registry
    || !input.predecessor_dependency_registry
  ) {
    fail(
      'REVIEWED_REGISTRY_PREDECESSORS_REQUIRED',
      'A successor assembly requires both complete predecessor registries.',
    );
  }
}

function identityOf(member) {
  return {
    relative_path: member.relative_path,
    object_kind: member.object_kind,
    stable_id: member.stable_id,
    schema_version: member.schema_version,
    canonical_bytes_digest: member.canonical_bytes_digest,
  };
}

function identityKey(identity) {
  return canonicalJson(identity);
}

function validateAuthoredIdentity(value, label, code) {
  requireExactKeys(value, [
    'relative_path',
    'object_kind',
    'stable_id',
    'schema_version',
    'canonical_bytes_digest',
  ], label, code);
  for (const key of ['relative_path', 'object_kind', 'stable_id', 'schema_version']) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      fail(code, `${label}.${key} must be a non-empty string.`);
    }
  }
  requireDigest(value.canonical_bytes_digest, `${label}.canonical_bytes_digest`, code);
  return clone(value);
}

function nonGovernanceIdentityUniverse(compilation) {
  const code = 'INVALID_CANONICAL_CONTRACT_INPUT_COMPILATION';
  requirePlainObject(compilation, 'canonical_contract_input_compilation', code);
  if (
    compilation.schema_version !== INPUT_COMPILATION_SCHEMA_VERSION
    || !Array.isArray(compilation.authored_members)
    || compilation.authored_members.length < 2
    || compilation.authored_universe_assessment?.status
      !== 'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY'
    || compilation.disposition?.status
      !== 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE'
  ) {
    fail(
      'CANONICAL_CONTRACT_INPUT_UNIVERSE_INCOMPLETE',
      'The authored input compilation is not mechanically complete.',
    );
  }
  const identities = compilation.authored_members.map((member, index) => {
    if (member.contract_ordinal !== index) {
      fail(
        code,
        'Authored input ordinals must be complete and deterministic.',
      );
    }
    return validateAuthoredIdentity(
      identityOf(member),
      `authored_members[${index}] identity`,
      code,
    );
  });
  const governance = identities.filter(
    (identity) => identity.object_kind === GOVERNANCE_OBJECT_KIND,
  );
  if (governance.length !== 1) {
    fail(
      'CANONICAL_CONTRACT_GOVERNANCE_MEMBER_CARDINALITY',
      'Exactly one required-kind governance member is required.',
    );
  }
  const nonGovernance = identities
    .filter((identity) => identity.object_kind !== GOVERNANCE_OBJECT_KIND)
    .sort((left, right) => compareStrings(identityKey(left), identityKey(right)));
  const keys = nonGovernance.map(identityKey);
  if (new Set(keys).size !== keys.length) {
    fail(
      'DUPLICATE_CANONICAL_CONTRACT_AUTHORED_IDENTITY',
      'Non-governance authored identities must be unique.',
    );
  }
  return nonGovernance;
}

function validateReviewedDispositions(dispositions, identities) {
  const code = 'INVALID_REVIEWED_BUNDLE_DISPOSITION';
  if (!Array.isArray(dispositions) || dispositions.length === 0) {
    fail(code, 'reviewed_dispositions must be a non-empty array.');
  }
  const identityUniverse = new Set(identities.map(identityKey));
  const validated = dispositions.map((disposition, index) => {
    requireExactKeys(disposition, [
      'authored_identity',
      'member_kind',
      'ordered_dependency_identities',
    ], `reviewed_dispositions[${index}]`, code);
    const authoredIdentity = validateAuthoredIdentity(
      disposition.authored_identity,
      `reviewed_dispositions[${index}].authored_identity`,
      code,
    );
    if (!REQUIRED_BUNDLE_KINDS.includes(disposition.member_kind)) {
      fail(
        'INVALID_REVIEWED_BUNDLE_MEMBER_KIND',
        'Each disposition must select exactly one existing bundle kind.',
        { member_kind: disposition.member_kind },
      );
    }
    if (!Array.isArray(disposition.ordered_dependency_identities)) {
      fail(code, 'ordered_dependency_identities must be an array.');
    }
    const dependencies = disposition.ordered_dependency_identities.map(
      (dependency, dependencyIndex) => validateAuthoredIdentity(
        dependency,
        `reviewed_dispositions[${index}].ordered_dependency_identities[${dependencyIndex}]`,
        code,
      ),
    );
    const dependencyKeys = dependencies.map(identityKey);
    if (
      new Set(dependencyKeys).size !== dependencyKeys.length
      || canonicalJson(dependencyKeys)
        !== canonicalJson([...dependencyKeys].sort(compareStrings))
    ) {
      fail(
        'INVALID_REVIEWED_BUNDLE_DEPENDENCY_ORDER',
        'Dependency identities must be unique and canonically ordered.',
      );
    }
    const authoredKey = identityKey(authoredIdentity);
    if (dependencyKeys.includes(authoredKey)) {
      fail(
        'CANONICAL_CONTRACT_BUNDLE_SELF_DEPENDENCY',
        'A disposition cannot depend on its own authored identity.',
      );
    }
    const unresolved = dependencyKeys.filter((key) => !identityUniverse.has(key));
    if (unresolved.length > 0) {
      fail(
        'CANONICAL_CONTRACT_BUNDLE_UNRESOLVED_DEPENDENCY',
        'A disposition dependency is outside the exact authored universe.',
        { unresolved_dependency_identities: unresolved },
      );
    }
    return {
      authored_identity: authoredIdentity,
      member_kind: disposition.member_kind,
      ordered_dependency_identities: dependencies,
    };
  });
  const dispositionKeys = validated.map((entry) => identityKey(entry.authored_identity));
  if (
    new Set(dispositionKeys).size !== dispositionKeys.length
    || canonicalJson(dispositionKeys)
      !== canonicalJson([...dispositionKeys].sort(compareStrings))
  ) {
    fail(
      'INVALID_REVIEWED_BUNDLE_DISPOSITION_ORDER',
      'Reviewed dispositions must be unique and use canonical authored-identity order.',
    );
  }
  const expected = identities.map(identityKey);
  const expectedSet = new Set(expected);
  const actualSet = new Set(dispositionKeys);
  const missing = expected.filter((key) => !actualSet.has(key));
  const extra = dispositionKeys.filter((key) => !expectedSet.has(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      'REVIEWED_BUNDLE_DISPOSITION_CLOSED_SET_MISMATCH',
      'Reviewed dispositions do not cover the exact non-governance authored universe.',
      { missing, extra },
    );
  }
  const populatedKinds = new Set(validated.map((entry) => entry.member_kind));
  const missingKinds = REQUIRED_BUNDLE_KINDS.filter(
    (kind) => !populatedKinds.has(kind),
  );
  if (missingKinds.length > 0) {
    fail(
      'REVIEWED_BUNDLE_CATEGORY_OMISSION',
      'Reviewed dispositions must populate all eight bundle kinds.',
      { missing_member_kinds: missingKinds },
    );
  }
  return validated;
}

function predecessorBinding(predecessor, idKey, digestKey) {
  if (predecessor === null) return null;
  requirePlainObject(
    predecessor,
    'predecessor registry',
    'INVALID_REVIEWED_REGISTRY_PREDECESSOR',
  );
  if (
    !Number.isSafeInteger(predecessor.registry_version)
    || predecessor.registry_version < 1
  ) {
    fail(
      'INVALID_REVIEWED_REGISTRY_PREDECESSOR',
      'Predecessor registry version must be a positive safe integer.',
    );
  }
  requireDigest(
    predecessor[idKey],
    `predecessor.${idKey}`,
    'INVALID_REVIEWED_REGISTRY_PREDECESSOR',
  );
  requireDigest(
    predecessor[digestKey],
    `predecessor.${digestKey}`,
    'INVALID_REVIEWED_REGISTRY_PREDECESSOR',
  );
  return {
    registry_version: predecessor.registry_version,
    registry_id: predecessor[idKey],
    canonical_payload_digest: predecessor[digestKey],
  };
}

function sealClassificationRegistry(dispositions, registryVersion, predecessor) {
  const body = {
    schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
    registry_version: registryVersion,
    predecessor_registry: predecessorBinding(
      predecessor,
      'classification_registry_id',
      'canonical_payload_digest',
    ),
    ordered_classifications: dispositions.map((disposition) => ({
      authored_identity: disposition.authored_identity,
      member_kind: disposition.member_kind,
    })),
  };
  const canonicalPayloadDigest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_PAYLOAD/V1',
    body,
  );
  return {
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    classification_registry_id: contentId(
      'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_ID/V1',
      {
        schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
        registry_version: registryVersion,
        canonical_payload_digest: canonicalPayloadDigest,
      },
    ),
  };
}

function sealDependencyRegistry(dispositions, registryVersion, predecessor) {
  const body = {
    schema_version: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
    registry_version: registryVersion,
    predecessor_registry: predecessorBinding(
      predecessor,
      'dependency_registry_id',
      'canonical_payload_digest',
    ),
    ordered_dependencies: dispositions.map((disposition) => ({
      authored_identity: disposition.authored_identity,
      ordered_dependency_identities:
        disposition.ordered_dependency_identities,
    })),
  };
  const canonicalPayloadDigest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_PAYLOAD/V1',
    body,
  );
  return {
    ...body,
    canonical_payload_digest: canonicalPayloadDigest,
    dependency_registry_id: contentId(
      'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_ID/V1',
      {
        schema_version: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
        registry_version: registryVersion,
        canonical_payload_digest: canonicalPayloadDigest,
      },
    ),
  };
}

function assembleCanonicalContractBundleReviewedRegistries(input = {}) {
  validateTopLevelInput(input);
  const frozenInput = clone(input);
  validateTopLevelInput(frozenInput);
  const identities = nonGovernanceIdentityUniverse(
    frozenInput.canonical_contract_input_compilation,
  );
  const dispositions = validateReviewedDispositions(
    frozenInput.reviewed_dispositions,
    identities,
  );
  const classificationRegistry = sealClassificationRegistry(
    dispositions,
    frozenInput.registry_version,
    frozenInput.predecessor_classification_registry,
  );
  const dependencyRegistry = sealDependencyRegistry(
    dispositions,
    frozenInput.registry_version,
    frozenInput.predecessor_dependency_registry,
  );
  const governedBindings = {
    schema_version: GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
    classification_registry_id: classificationRegistry.classification_registry_id,
    classification_registry_payload_digest:
      classificationRegistry.canonical_payload_digest,
    dependency_registry_id: dependencyRegistry.dependency_registry_id,
    dependency_registry_payload_digest:
      dependencyRegistry.canonical_payload_digest,
  };
  const verificationCompilation = compileCanonicalContractBundle({
    canonical_contract_input_compilation:
      frozenInput.canonical_contract_input_compilation,
    classification_registry: classificationRegistry,
    dependency_registry: dependencyRegistry,
    governed_registry_bindings: governedBindings,
    predecessor_classification_registry:
      frozenInput.predecessor_classification_registry,
    predecessor_dependency_registry:
      frozenInput.predecessor_dependency_registry,
  });
  const assemblyPayload = {
    registry_version: frozenInput.registry_version,
    classification_registry: classificationRegistry,
    dependency_registry: dependencyRegistry,
    governed_registry_bindings: governedBindings,
    mechanical_validation: {
      canonical_bundle_input_identity_id:
        frozenInput.canonical_contract_input_compilation
          .canonical_bundle_input_identity
          .canonical_bundle_input_identity_id,
      disposition_count: dispositions.length,
      required_bundle_kind_count: REQUIRED_BUNDLE_KINDS.length,
      contract_bundle_id: verificationCompilation.contract_bundle_id,
      contract_bundle_digest: verificationCompilation.contract_bundle_digest,
      compile_report_digest: verificationCompilation.compile_report_digest,
      cycle_report_digest: verificationCompilation.cycle_report_digest,
      missing_disposition_count: 0,
      extra_disposition_count: 0,
      duplicate_disposition_count: 0,
      unresolved_dependency_count: 0,
      self_dependency_count: 0,
      dependency_cycle_count: 0,
      state: 'MECHANICALLY_VALIDATED_CALLER_DISPOSITIONS',
    },
    disposition: {
      state: 'REGISTRIES_SEALED_NOT_REVIEWED_BY_ASSEMBLER',
      caller_disposition_authenticity: 'NOT_ESTABLISHED',
      review_evidence: 'NOT_SUPPLIED',
      ben_approval: 'NOT_SUPPLIED',
      freeze_authority: 'NONE',
      signing_authority: 'NONE',
      status_publication_authority: 'NONE',
      writer_authority: 'NONE',
      serving_authority: 'NONE',
      database_authority: 'NONE',
      release_authority: 'NONE',
      activation_authority: 'NONE',
      production_authority: 'NONE',
    },
  };
  return deepFreeze({
    schema_version: REGISTRY_ASSEMBLY_SCHEMA_VERSION,
    ...assemblyPayload,
    registry_assembly_payload_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_REVIEWED_REGISTRY_ASSEMBLY_PAYLOAD/V1',
      assemblyPayload,
    ),
  });
}

module.exports = {
  REGISTRY_ASSEMBLY_SCHEMA_VERSION,
  CanonicalContractBundleReviewedRegistryAssemblerError,
  sealClassificationRegistry,
  sealDependencyRegistry,
  assembleCanonicalContractBundleReviewedRegistries,
};
