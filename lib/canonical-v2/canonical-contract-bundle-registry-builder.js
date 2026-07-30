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

const GOVERNANCE_OBJECT_KIND =
  'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const INPUT_COMPILATION_SCHEMA_VERSION =
  'CANONICAL_BUNDLE_INPUT_COMPILATION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const REQUIRED_INPUT_KEYS = Object.freeze([
  'canonical_contract_input_compilation',
  'classification_decisions',
  'dependency_decisions',
  'registry_version',
]);
const OPTIONAL_INPUT_KEYS = Object.freeze([
  'predecessor_classification_registry',
  'predecessor_dependency_registry',
]);

class CanonicalContractBundleRegistryBuilderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractBundleRegistryBuilderError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractBundleRegistryBuilderError(code, message, details);
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

function requirePlainObject(value, label, code) {
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
  for (const key of [
    'relative_path',
    'object_kind',
    'stable_id',
    'schema_version',
  ]) {
    if (typeof value[key] !== 'string' || value[key].length === 0) {
      fail(code, `${label}.${key} must be a non-empty string.`);
    }
  }
  requireDigest(value.canonical_bytes_digest, `${label}.canonical_bytes_digest`, code);
  return clone(value);
}

function validateTopLevelInput(input) {
  const code = 'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_BUILDER_INPUT';
  requirePlainObject(input, 'registry builder input', code);
  const actual = Object.keys(input).sort(compareStrings);
  const allowed = [...REQUIRED_INPUT_KEYS, ...OPTIONAL_INPUT_KEYS].sort(compareStrings);
  const missing = REQUIRED_INPUT_KEYS.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !allowed.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(code, 'Registry builder input fields do not match the closed contract.', {
      missing_keys: missing,
      extra_keys: extra,
    });
  }
  if (!Number.isSafeInteger(input.registry_version) || input.registry_version < 1) {
    fail('INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_VERSION', 'registry_version must be a positive safe integer.');
  }
  const classificationPredecessor =
    input.predecessor_classification_registry === undefined
      ? null
      : input.predecessor_classification_registry;
  const dependencyPredecessor = input.predecessor_dependency_registry === undefined
    ? null
    : input.predecessor_dependency_registry;
  if (input.registry_version === 1) {
    if (classificationPredecessor !== null || dependencyPredecessor !== null) {
      fail(
        'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR',
        'Registry version 1 must not have predecessor registries.',
      );
    }
  } else if (!classificationPredecessor || !dependencyPredecessor) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR_REQUIRED',
      'A successor registry version requires both complete predecessor registries.',
    );
  }
  return {
    ...input,
    predecessor_classification_registry: classificationPredecessor,
    predecessor_dependency_registry: dependencyPredecessor,
  };
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
      fail(code, 'Authored input ordinals must be complete and deterministic.');
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

function reconcileDecisions(decisions, identities, decisionName) {
  const expected = identities.map(identityKey);
  const expectedSet = new Set(expected);
  const actual = decisions.map((decision) => identityKey(decision.authored_identity));
  const actualSet = new Set(actual);
  if (actualSet.size !== actual.length) {
    fail(
      `DUPLICATE_CANONICAL_CONTRACT_BUNDLE_${decisionName.toUpperCase()}_DECISION`,
      `${decisionName} decisions contain a duplicate authored identity.`,
    );
  }
  const missing = expected.filter((key) => !actualSet.has(key));
  const extra = actual.filter((key) => !expectedSet.has(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `CANONICAL_CONTRACT_BUNDLE_${decisionName.toUpperCase()}_DECISION_CLOSED_SET_MISMATCH`,
      `${decisionName} decisions do not cover the exact non-governance authored universe.`,
      { missing, extra },
    );
  }
}

function validateClassificationDecisions(decisions, identities) {
  const code = 'INVALID_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_DECISION';
  if (!Array.isArray(decisions)) {
    fail(code, 'classification_decisions must be an array.');
  }
  const validated = decisions.map((decision, index) => {
    requireExactKeys(
      decision,
      ['authored_identity', 'member_kind'],
      `classification_decisions[${index}]`,
      code,
    );
    const authoredIdentity = validateAuthoredIdentity(
      decision.authored_identity,
      `classification_decisions[${index}].authored_identity`,
      code,
    );
    if (!REQUIRED_BUNDLE_KINDS.includes(decision.member_kind)) {
      fail(
        'INVALID_CANONICAL_CONTRACT_BUNDLE_MEMBER_KIND',
        'Classification decisions must use an existing bundle member kind.',
        { member_kind: decision.member_kind },
      );
    }
    return { authored_identity: authoredIdentity, member_kind: decision.member_kind };
  });
  reconcileDecisions(validated, identities, 'classification');
  const kinds = new Set(validated.map((decision) => decision.member_kind));
  const missingKinds = REQUIRED_BUNDLE_KINDS.filter((kind) => !kinds.has(kind));
  if (missingKinds.length > 0) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_CATEGORY_OMISSION',
      'Classification decisions must populate all eight required bundle kinds.',
      { missing_member_kinds: missingKinds },
    );
  }
  return validated.sort((left, right) => compareStrings(
    identityKey(left.authored_identity),
    identityKey(right.authored_identity),
  ));
}

function validateDependencyGraph(decisions, identities) {
  const identityUniverse = new Set(identities.map(identityKey));
  const graph = new Map();
  for (const decision of decisions) {
    const authoredKey = identityKey(decision.authored_identity);
    const dependencies = decision.ordered_dependency_identities.map(identityKey);
    for (const dependency of dependencies) {
      if (!identityUniverse.has(dependency)) {
        fail(
          'CANONICAL_CONTRACT_BUNDLE_UNRESOLVED_DEPENDENCY',
          'A dependency decision is outside the exact authored universe.',
        );
      }
      if (dependency === authoredKey) {
        fail(
          'CANONICAL_CONTRACT_BUNDLE_SELF_DEPENDENCY',
          'An authored member cannot depend on itself.',
        );
      }
    }
    graph.set(authoredKey, dependencies);
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(key) {
    if (visiting.has(key)) {
      fail(
        'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE',
        'The exact authored dependency graph contains a cycle.',
      );
    }
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of graph.get(key)) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  }
  [...graph.keys()].sort(compareStrings).forEach(visit);
}

function validateDependencyDecisions(decisions, identities) {
  const code = 'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_DECISION';
  if (!Array.isArray(decisions)) {
    fail(code, 'dependency_decisions must be an array.');
  }
  const validated = decisions.map((decision, index) => {
    requireExactKeys(
      decision,
      ['authored_identity', 'ordered_dependency_identities'],
      `dependency_decisions[${index}]`,
      code,
    );
    if (!Array.isArray(decision.ordered_dependency_identities)) {
      fail(code, 'ordered_dependency_identities must be an array.');
    }
    const dependencies = decision.ordered_dependency_identities.map(
      (dependency, dependencyIndex) => validateAuthoredIdentity(
        dependency,
        `dependency_decisions[${index}].ordered_dependency_identities[${dependencyIndex}]`,
        code,
      ),
    );
    const dependencyKeys = dependencies.map(identityKey);
    if (new Set(dependencyKeys).size !== dependencyKeys.length) {
      fail(
        'DUPLICATE_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_IDENTITY',
        'Dependency decisions must not repeat a dependency identity.',
      );
    }
    return {
      authored_identity: validateAuthoredIdentity(
        decision.authored_identity,
        `dependency_decisions[${index}].authored_identity`,
        code,
      ),
      ordered_dependency_identities: dependencies.sort((left, right) => compareStrings(
        identityKey(left),
        identityKey(right),
      )),
    };
  });
  reconcileDecisions(validated, identities, 'dependency');
  validateDependencyGraph(validated, identities);
  return validated.sort((left, right) => compareStrings(
    identityKey(left.authored_identity),
    identityKey(right.authored_identity),
  ));
}

function predecessorBinding(predecessor, idKey) {
  if (predecessor === null) return null;
  requirePlainObject(
    predecessor,
    'predecessor registry',
    'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR',
  );
  if (!Number.isSafeInteger(predecessor.registry_version) || predecessor.registry_version < 1) {
    fail(
      'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR',
      'Predecessor registry version must be a positive safe integer.',
    );
  }
  requireDigest(
    predecessor[idKey],
    `predecessor.${idKey}`,
    'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR',
  );
  requireDigest(
    predecessor.canonical_payload_digest,
    'predecessor.canonical_payload_digest',
    'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR',
  );
  return {
    registry_version: predecessor.registry_version,
    registry_id: predecessor[idKey],
    canonical_payload_digest: predecessor.canonical_payload_digest,
  };
}

function sealClassificationRegistry(decisions, registryVersion, predecessor) {
  const body = {
    schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
    registry_version: registryVersion,
    predecessor_registry: predecessorBinding(predecessor, 'classification_registry_id'),
    ordered_classifications: decisions.map((decision) => ({
      authored_identity: decision.authored_identity,
      member_kind: decision.member_kind,
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

function sealDependencyRegistry(decisions, registryVersion, predecessor) {
  const body = {
    schema_version: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
    registry_version: registryVersion,
    predecessor_registry: predecessorBinding(predecessor, 'dependency_registry_id'),
    ordered_dependencies: decisions.map((decision) => ({
      authored_identity: decision.authored_identity,
      ordered_dependency_identities: decision.ordered_dependency_identities,
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

function buildCanonicalContractBundleRegistries(input = {}) {
  const normalisedInput = validateTopLevelInput(input);
  const frozenInput = clone(normalisedInput);
  const identities = nonGovernanceIdentityUniverse(
    frozenInput.canonical_contract_input_compilation,
  );
  const classifications = validateClassificationDecisions(
    frozenInput.classification_decisions,
    identities,
  );
  const dependencies = validateDependencyDecisions(
    frozenInput.dependency_decisions,
    identities,
  );
  const classificationRegistry = sealClassificationRegistry(
    classifications,
    frozenInput.registry_version,
    frozenInput.predecessor_classification_registry,
  );
  const dependencyRegistry = sealDependencyRegistry(
    dependencies,
    frozenInput.registry_version,
    frozenInput.predecessor_dependency_registry,
  );
  const governedBindings = {
    schema_version: GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
    classification_registry_id: classificationRegistry.classification_registry_id,
    classification_registry_payload_digest:
      classificationRegistry.canonical_payload_digest,
    dependency_registry_id: dependencyRegistry.dependency_registry_id,
    dependency_registry_payload_digest: dependencyRegistry.canonical_payload_digest,
  };
  compileCanonicalContractBundle({
    canonical_contract_input_compilation:
      frozenInput.canonical_contract_input_compilation,
    classification_registry: classificationRegistry,
    dependency_registry: dependencyRegistry,
    governed_registry_bindings: governedBindings,
    predecessor_classification_registry:
      frozenInput.predecessor_classification_registry,
    predecessor_dependency_registry: frozenInput.predecessor_dependency_registry,
  });
  return deepFreeze({
    classification_registry: classificationRegistry,
    dependency_registry: dependencyRegistry,
    governed_registry_bindings: governedBindings,
  });
}

module.exports = {
  CanonicalContractBundleRegistryBuilderError,
  sealClassificationRegistry,
  sealDependencyRegistry,
  buildCanonicalContractBundleRegistries,
};
