const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const { domainDigest } = require('../programme-gates/bytes');

const COMPILATION_SCHEMA_VERSION = 'CANONICAL_CONTRACT_BUNDLE_COMPILATION/V1';
const CLASSIFICATION_REGISTRY_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY/V1';
const DEPENDENCY_REGISTRY_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY/V1';
const GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_GOVERNED_REGISTRY_BINDINGS/V1';
const AGGREGATE_SOURCE_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_AGGREGATE_SOURCE/V1';
const IMMUTABLE_MEMBER_SCHEMA_VERSION = 'CanonicalContractBundleMember/V1';
const INPUT_COMPILATION_SCHEMA_VERSION = 'CANONICAL_BUNDLE_INPUT_COMPILATION/V1';
const REQUIRED_KIND_REGISTRY_OBJECT_KIND =
  'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const SHA256_RE = /^[a-f0-9]{64}$/;

const REQUIRED_BUNDLE_KINDS = Object.freeze([
  'COMPARABILITY',
  'COMPOSITION_CATALOGUE',
  'CORE_CANONICAL_CONTRACT',
  'GOVERNED_RESIDUAL',
  'OPEN_WORLD_CONCEPT',
  'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
  'SEMANTIC_CATALOGUE',
  'SOURCE_SPECIFIC_PUBLICATION',
]);

const FIXED_MEMBER_DEFINITIONS = Object.freeze({
  COMPARABILITY: Object.freeze({
    member_key: 'COMPARABILITY',
    logical_type: 'CanonicalComparabilityContractAggregate',
  }),
  COMPOSITION_CATALOGUE: Object.freeze({
    member_key: 'COMPOSITION_CATALOGUE',
    logical_type: 'CanonicalCompositionCatalogueAggregate',
  }),
  CORE_CANONICAL_CONTRACT: Object.freeze({
    member_key: 'CORE_CANONICAL_CONTRACT',
    logical_type: 'CoreCanonicalContractAggregate',
  }),
  GOVERNED_RESIDUAL: Object.freeze({
    member_key: 'GOVERNED_RESIDUAL',
    logical_type: 'GovernedResidualContractAggregate',
  }),
  OPEN_WORLD_CONCEPT: Object.freeze({
    member_key: 'OPEN_WORLD_CONCEPT',
    logical_type: 'OpenWorldConceptContractAggregate',
  }),
  RELATIONSHIP_EFFECT_FIELD_UNIVERSE: Object.freeze({
    member_key: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
    logical_type: 'RelationshipEffectFieldUniverseAggregate',
  }),
  SEMANTIC_CATALOGUE: Object.freeze({
    member_key: 'SEMANTIC_CATALOGUE',
    logical_type: 'CanonicalSemanticCatalogueAggregate',
  }),
  SOURCE_SPECIFIC_PUBLICATION: Object.freeze({
    member_key: 'SOURCE_SPECIFIC_PUBLICATION',
    logical_type: 'SourceSpecificPublicationContractAggregate',
  }),
});

class CanonicalContractBundleCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractBundleCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractBundleCompilerError(code, message, details);
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

function requireObject(value, label, code = 'INVALID_CANONICAL_CONTRACT_BUNDLE_INPUT') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be a JSON object.`, { label });
  }
  return value;
}

function requireExactKeys(value, expectedKeys, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...expectedKeys].sort(compareStrings);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} fields do not match the closed contract.`, {
      label,
      expected,
      actual,
    });
  }
}

function requireString(value, label, code) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(code, `${label} must be a non-empty string.`, { label });
  }
  return value;
}

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a lowercase SHA-256 digest.`, { label });
  }
  return value;
}

function requirePositiveInteger(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`, { label });
  }
  return value;
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

function compareIdentities(left, right) {
  return compareStrings(identityKey(left), identityKey(right));
}

function validateAuthoredIdentity(value, label, code) {
  requireExactKeys(value, [
    'relative_path',
    'object_kind',
    'stable_id',
    'schema_version',
    'canonical_bytes_digest',
  ], label, code);
  requireString(value.relative_path, `${label}.relative_path`, code);
  requireString(value.object_kind, `${label}.object_kind`, code);
  requireString(value.stable_id, `${label}.stable_id`, code);
  requireString(value.schema_version, `${label}.schema_version`, code);
  requireDigest(value.canonical_bytes_digest, `${label}.canonical_bytes_digest`, code);
  return clone(value);
}

function validateInputCompilation(compilation) {
  const code = 'INVALID_CANONICAL_CONTRACT_INPUT_COMPILATION';
  requireExactKeys(compilation, [
    'schema_version',
    'canonical_bundle_input_identity',
    'authored_members',
    'authored_universe_assessment',
    'disposition',
  ], 'canonical_contract_input_compilation', code);
  if (compilation.schema_version !== INPUT_COMPILATION_SCHEMA_VERSION) {
    fail(code, 'Canonical contract input compilation has the wrong schema version.');
  }
  requireObject(
    compilation.canonical_bundle_input_identity,
    'canonical_bundle_input_identity',
    code,
  );
  requireDigest(
    compilation.canonical_bundle_input_identity.canonical_bundle_input_identity_id,
    'canonical_bundle_input_identity.canonical_bundle_input_identity_id',
    code,
  );
  if (!Array.isArray(compilation.authored_members) || compilation.authored_members.length < 2) {
    fail(code, 'Canonical contract input compilation must contain authored members.');
  }
  requireObject(compilation.authored_universe_assessment, 'authored_universe_assessment', code);
  if (
    compilation.authored_universe_assessment.status
      !== 'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY'
  ) {
    fail(
      'CANONICAL_CONTRACT_INPUT_UNIVERSE_INCOMPLETE',
      'The authored input universe is not complete against the governed required-kind registry.',
    );
  }
  requireObject(
    compilation.authored_universe_assessment.required_kind_registry_binding,
    'authored_universe_assessment.required_kind_registry_binding',
    code,
  );
  requireObject(compilation.disposition, 'canonical input disposition', code);
  if (
    compilation.disposition.status !== 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE'
    || compilation.disposition.reason_code !== 'BUNDLE_GENERATION_AND_FREEZE_NOT_EVALUATED'
    || compilation.disposition.freeze_eligible !== false
    || compilation.disposition.canonical_contract_bundle_authority !== 'NONE'
    || compilation.disposition.p1_gate_status !== 'NOT_EVALUATED'
  ) {
    fail(
      'CANONICAL_CONTRACT_INPUT_DISPOSITION_NOT_ADMISSIBLE',
      'The canonical input compiler disposition is not the required pre-bundle state.',
    );
  }

  const members = compilation.authored_members.map((member, index) => {
    requireExactKeys(member, [
      'relative_path',
      'object_kind',
      'stable_id',
      'schema_version',
      'canonical_bytes_digest',
      'canonical_byte_length',
      'contract_ordinal',
      'canonical_value',
    ], `authored_members[${index}]`, code);
    const identity = validateAuthoredIdentity(
      identityOf(member),
      `authored_members[${index}] identity`,
      code,
    );
    requirePositiveInteger(
      member.canonical_byte_length,
      `authored_members[${index}].canonical_byte_length`,
      code,
    );
    if (member.contract_ordinal !== index) {
      fail(code, 'Authored member ordinals must be complete and deterministic.', {
        index,
        contract_ordinal: member.contract_ordinal,
      });
    }
    requireObject(member.canonical_value, `authored_members[${index}].canonical_value`, code);
    if (
      member.canonical_value.object_kind !== member.object_kind
      || member.canonical_value.stable_id !== member.stable_id
      || member.canonical_value.schema_version !== member.schema_version
    ) {
      fail('CANONICAL_CONTRACT_AUTHORED_MEMBER_METADATA_DRIFT', 'Authored value metadata drifted.');
    }
    const bytes = Buffer.from(canonicalJson(member.canonical_value), 'utf8');
    if (
      bytes.length !== member.canonical_byte_length
      || sha256Hex(bytes) !== member.canonical_bytes_digest
    ) {
      fail(
        'CANONICAL_CONTRACT_AUTHORED_MEMBER_SOURCE_DRIFT',
        'Authored canonical value does not match its bound source bytes.',
        { authored_identity: identity },
      );
    }
    return {
      ...identity,
      canonical_byte_length: member.canonical_byte_length,
      contract_ordinal: member.contract_ordinal,
      canonical_value: clone(member.canonical_value),
    };
  });

  const keys = members.map((member) => identityKey(identityOf(member)));
  if (new Set(keys).size !== keys.length) {
    fail('DUPLICATE_CANONICAL_CONTRACT_AUTHORED_IDENTITY', 'Authored identities are not unique.');
  }

  const governanceMembers = members.filter(
    (member) => member.object_kind === REQUIRED_KIND_REGISTRY_OBJECT_KIND,
  );
  if (governanceMembers.length !== 1) {
    fail(
      'CANONICAL_CONTRACT_GOVERNANCE_MEMBER_CARDINALITY',
      'Exactly one required-kind governance member is required.',
      { actual_count: governanceMembers.length },
    );
  }
  const binding = compilation.authored_universe_assessment.required_kind_registry_binding;
  const governance = governanceMembers[0];
  for (const key of ['relative_path', 'stable_id', 'schema_version', 'canonical_bytes_digest']) {
    if (binding[key] !== governance[key]) {
      fail(
        'CANONICAL_CONTRACT_GOVERNANCE_BINDING_MISMATCH',
        'Required-kind governance binding does not match the authored governance member.',
        { field: key },
      );
    }
  }

  return {
    input_identity_id:
      compilation.canonical_bundle_input_identity.canonical_bundle_input_identity_id,
    governance,
    non_governance_members: members.filter((member) => member !== governance),
  };
}

function registryBody(registry, idKey, digestKey) {
  const body = clone(registry);
  delete body[idKey];
  delete body[digestKey];
  return body;
}

function validateRegistryEnvelope({
  registry,
  schemaVersion,
  idKey,
  digestKey,
  idDomain,
  payloadDomain,
  label,
}) {
  requireObject(registry, label, 'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY');
  if (registry.schema_version !== schemaVersion) {
    fail('INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY', `${label} has the wrong schema.`);
  }
  requirePositiveInteger(
    registry.registry_version,
    `${label}.registry_version`,
    'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY',
  );
  requireDigest(
    registry[digestKey],
    `${label}.${digestKey}`,
    'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY',
  );
  requireDigest(
    registry[idKey],
    `${label}.${idKey}`,
    'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY',
  );
  const body = registryBody(registry, idKey, digestKey);
  const expectedDigest = contentId(payloadDomain, body);
  const expectedId = contentId(idDomain, {
    schema_version: schemaVersion,
    registry_version: registry.registry_version,
    canonical_payload_digest: expectedDigest,
  });
  if (registry[digestKey] !== expectedDigest || registry[idKey] !== expectedId) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_REGISTRY_SELF_DIGEST_MISMATCH',
      `${label} does not match its canonical content identity.`,
    );
  }
  return body;
}

function validatePredecessor({
  current,
  predecessor,
  idKey,
  digestKey,
  label,
}) {
  if (current.registry_version === 1) {
    if (current.predecessor_registry !== null || predecessor !== null) {
      fail(
        'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR',
        `${label} version 1 must have no predecessor.`,
      );
    }
    return;
  }
  requireExactKeys(
    current.predecessor_registry,
    ['registry_version', 'registry_id', 'canonical_payload_digest'],
    `${label}.predecessor_registry`,
    'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR',
  );
  if (!predecessor) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR_REQUIRED',
      `${label} requires its complete predecessor registry.`,
    );
  }
  if (
    current.registry_version !== predecessor.registry_version + 1
    || current.predecessor_registry.registry_version !== predecessor.registry_version
    || current.predecessor_registry.registry_id !== predecessor[idKey]
    || current.predecessor_registry.canonical_payload_digest !== predecessor[digestKey]
  ) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_REGISTRY_VERSION_DRIFT',
      `${label} is not an exact one-version successor of its bound predecessor.`,
    );
  }
}

function validateClassificationRegistry(registry, members, predecessor) {
  requireExactKeys(registry, [
    'schema_version',
    'registry_version',
    'predecessor_registry',
    'ordered_classifications',
    'canonical_payload_digest',
    'classification_registry_id',
  ], 'classification_registry', 'INVALID_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY');
  validateRegistryEnvelope({
    registry,
    schemaVersion: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
    idKey: 'classification_registry_id',
    digestKey: 'canonical_payload_digest',
    idDomain: 'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_ID/V1',
    payloadDomain: 'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_PAYLOAD/V1',
    label: 'classification_registry',
  });
  if (predecessor) {
    validateClassificationRegistryEnvelopeOnly(predecessor);
  }
  validatePredecessor({
    current: registry,
    predecessor,
    idKey: 'classification_registry_id',
    digestKey: 'canonical_payload_digest',
    label: 'classification_registry',
  });
  if (!Array.isArray(registry.ordered_classifications)) {
    fail(
      'INVALID_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY',
      'ordered_classifications must be an array.',
    );
  }
  const entries = registry.ordered_classifications.map((entry, index) => {
    requireExactKeys(
      entry,
      ['authored_identity', 'member_kind'],
      `ordered_classifications[${index}]`,
      'INVALID_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY',
    );
    const authoredIdentity = validateAuthoredIdentity(
      entry.authored_identity,
      `ordered_classifications[${index}].authored_identity`,
      'INVALID_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY',
    );
    if (!REQUIRED_BUNDLE_KINDS.includes(entry.member_kind)) {
      fail(
        'INVALID_CANONICAL_CONTRACT_BUNDLE_MEMBER_KIND',
        'Classification uses an unrecognised bundle member kind.',
        { member_kind: entry.member_kind },
      );
    }
    return { authored_identity: authoredIdentity, member_kind: entry.member_kind };
  });
  validateOrderedIdentityEntries(entries, 'classification');
  reconcileRegistryEntries(entries, members, 'classification');
  const kinds = new Set(entries.map((entry) => entry.member_kind));
  const missingKinds = REQUIRED_BUNDLE_KINDS.filter((kind) => !kinds.has(kind));
  if (missingKinds.length > 0) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_CATEGORY_OMISSION',
      'Classification registry must populate every required bundle kind.',
      { missing_member_kinds: missingKinds },
    );
  }
  if (predecessor) {
    const previous = new Map(predecessor.ordered_classifications.map(
      (entry) => [identityKey(entry.authored_identity), entry.member_kind],
    ));
    const changed = entries.filter((entry) => (
      previous.has(identityKey(entry.authored_identity))
      && previous.get(identityKey(entry.authored_identity)) !== entry.member_kind
    ));
    if (changed.length > 0 && registry.registry_version <= predecessor.registry_version) {
      fail(
        'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_VERSION_NOT_INCREASED',
        'Cross-category reassignment requires a classification registry version increase.',
      );
    }
  }
  return entries;
}

function validateClassificationRegistryEnvelopeOnly(registry) {
  requireExactKeys(registry, [
    'schema_version',
    'registry_version',
    'predecessor_registry',
    'ordered_classifications',
    'canonical_payload_digest',
    'classification_registry_id',
  ], 'predecessor_classification_registry',
  'INVALID_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY');
  validateRegistryEnvelope({
    registry,
    schemaVersion: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
    idKey: 'classification_registry_id',
    digestKey: 'canonical_payload_digest',
    idDomain: 'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_ID/V1',
    payloadDomain: 'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_PAYLOAD/V1',
    label: 'predecessor_classification_registry',
  });
}

function validateOrderedIdentityEntries(entries, kind) {
  const keys = entries.map((entry) => identityKey(entry.authored_identity));
  if (new Set(keys).size !== keys.length) {
    fail(
      `DUPLICATE_CANONICAL_CONTRACT_BUNDLE_${kind.toUpperCase()}_ENTRY`,
      `${kind} registry contains a duplicate authored identity.`,
    );
  }
  const ordered = [...keys].sort(compareStrings);
  if (canonicalJson(keys) !== canonicalJson(ordered)) {
    fail(
      `UNORDERED_CANONICAL_CONTRACT_BUNDLE_${kind.toUpperCase()}_REGISTRY`,
      `${kind} entries must use canonical authored-identity order.`,
    );
  }
}

function reconcileRegistryEntries(entries, members, kind) {
  const expected = new Set(members.map((member) => identityKey(identityOf(member))));
  const actual = new Set(entries.map((entry) => identityKey(entry.authored_identity)));
  const missing = [...expected].filter((key) => !actual.has(key));
  const extra = [...actual].filter((key) => !expected.has(key));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `CANONICAL_CONTRACT_BUNDLE_${kind.toUpperCase()}_CLOSED_SET_MISMATCH`,
      `${kind} registry does not cover the exact non-governance authored universe.`,
      { missing, extra },
    );
  }
}

function validateDependencyRegistry(registry, members, predecessor) {
  requireExactKeys(registry, [
    'schema_version',
    'registry_version',
    'predecessor_registry',
    'ordered_dependencies',
    'canonical_payload_digest',
    'dependency_registry_id',
  ], 'dependency_registry', 'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY');
  validateRegistryEnvelope({
    registry,
    schemaVersion: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
    idKey: 'dependency_registry_id',
    digestKey: 'canonical_payload_digest',
    idDomain: 'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_ID/V1',
    payloadDomain: 'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_PAYLOAD/V1',
    label: 'dependency_registry',
  });
  if (predecessor) validateDependencyRegistryEnvelopeOnly(predecessor);
  validatePredecessor({
    current: registry,
    predecessor,
    idKey: 'dependency_registry_id',
    digestKey: 'canonical_payload_digest',
    label: 'dependency_registry',
  });
  if (!Array.isArray(registry.ordered_dependencies)) {
    fail(
      'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY',
      'ordered_dependencies must be an array.',
    );
  }
  const entries = registry.ordered_dependencies.map((entry, index) => {
    requireExactKeys(
      entry,
      ['authored_identity', 'ordered_dependency_identities'],
      `ordered_dependencies[${index}]`,
      'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY',
    );
    const authoredIdentity = validateAuthoredIdentity(
      entry.authored_identity,
      `ordered_dependencies[${index}].authored_identity`,
      'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY',
    );
    if (!Array.isArray(entry.ordered_dependency_identities)) {
      fail(
        'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY',
        'ordered_dependency_identities must be an array.',
      );
    }
    const dependencies = entry.ordered_dependency_identities.map((identity, dependencyIndex) => (
      validateAuthoredIdentity(
        identity,
        `ordered_dependencies[${index}].ordered_dependency_identities[${dependencyIndex}]`,
        'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY',
      )
    ));
    const keys = dependencies.map(identityKey);
    if (
      new Set(keys).size !== keys.length
      || canonicalJson(keys) !== canonicalJson([...keys].sort(compareStrings))
    ) {
      fail(
        'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY',
        'Dependency identities must be unique and canonically ordered.',
      );
    }
    return {
      authored_identity: authoredIdentity,
      ordered_dependency_identities: dependencies,
    };
  });
  validateOrderedIdentityEntries(entries, 'dependency');
  reconcileRegistryEntries(entries, members, 'dependency');
  validateDependencyGraph(entries, members);
  return entries;
}

function validateDependencyRegistryEnvelopeOnly(registry) {
  requireExactKeys(registry, [
    'schema_version',
    'registry_version',
    'predecessor_registry',
    'ordered_dependencies',
    'canonical_payload_digest',
    'dependency_registry_id',
  ], 'predecessor_dependency_registry', 'INVALID_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY');
  validateRegistryEnvelope({
    registry,
    schemaVersion: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
    idKey: 'dependency_registry_id',
    digestKey: 'canonical_payload_digest',
    idDomain: 'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_ID/V1',
    payloadDomain: 'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_PAYLOAD/V1',
    label: 'predecessor_dependency_registry',
  });
}

function validateDependencyGraph(entries, members) {
  const memberKeys = new Set(members.map((member) => identityKey(identityOf(member))));
  const graph = new Map();
  for (const entry of entries) {
    const key = identityKey(entry.authored_identity);
    const dependencies = entry.ordered_dependency_identities.map(identityKey);
    for (const dependency of dependencies) {
      if (!memberKeys.has(dependency)) {
        fail(
          'CANONICAL_CONTRACT_BUNDLE_UNRESOLVED_DEPENDENCY',
          'Dependency does not resolve to a non-governance authored member.',
          { authored_identity: entry.authored_identity, dependency_identity: dependency },
        );
      }
      if (dependency === key) {
        fail(
          'CANONICAL_CONTRACT_BUNDLE_SELF_DEPENDENCY',
          'An authored member cannot depend on itself.',
          { authored_identity: entry.authored_identity },
        );
      }
    }
    graph.set(key, dependencies);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(key, path) {
    if (visiting.has(key)) {
      fail(
        'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE',
        'The exact authored dependency graph contains a cycle.',
        { cycle_path: [...path, key] },
      );
    }
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of graph.get(key) || []) visit(dependency, [...path, key]);
    visiting.delete(key);
    visited.add(key);
  }
  [...graph.keys()].sort(compareStrings).forEach((key) => visit(key, []));
}

function validateGovernedRegistryBindings(bindings, classificationRegistry, dependencyRegistry) {
  const code = 'INVALID_CANONICAL_CONTRACT_BUNDLE_GOVERNED_REGISTRY_BINDINGS';
  requireExactKeys(bindings, [
    'schema_version',
    'classification_registry_id',
    'classification_registry_payload_digest',
    'dependency_registry_id',
    'dependency_registry_payload_digest',
  ], 'governed_registry_bindings', code);
  if (bindings.schema_version !== GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION) {
    fail(code, 'Governed registry bindings have the wrong schema.');
  }
  for (const key of Object.keys(bindings).filter((key) => key !== 'schema_version')) {
    requireDigest(bindings[key], `governed_registry_bindings.${key}`, code);
  }
  if (
    bindings.classification_registry_id !== classificationRegistry.classification_registry_id
    || bindings.classification_registry_payload_digest
      !== classificationRegistry.canonical_payload_digest
    || bindings.dependency_registry_id !== dependencyRegistry.dependency_registry_id
    || bindings.dependency_registry_payload_digest
      !== dependencyRegistry.canonical_payload_digest
  ) {
    fail(
      'CANONICAL_CONTRACT_BUNDLE_UNAUTHORISED_REGISTRY_SUBSTITUTION',
      'Registry values do not match the separately governed exact bindings.',
    );
  }
}

function aggregateMember(kind, members, dependencyByIdentity) {
  const definition = FIXED_MEMBER_DEFINITIONS[kind];
  const orderedMembers = [...members]
    .sort((left, right) => compareIdentities(identityOf(left), identityOf(right)))
    .map((member) => {
      const identity = identityOf(member);
      return {
        authored_identity: identity,
        canonical_byte_length: member.canonical_byte_length,
        canonical_value: clone(member.canonical_value),
        ordered_dependency_identities: clone(
          dependencyByIdentity.get(identityKey(identity)),
        ),
      };
    });
  const sourcePayload = {
    schema_version: AGGREGATE_SOURCE_SCHEMA_VERSION,
    member_kind: kind,
    ordered_authored_members: orderedMembers,
  };
  const sourceBytes = Buffer.from(canonicalJson(sourcePayload), 'utf8');
  const identityPayload = {
    member_kind: kind,
    ordered_authored_members: orderedMembers.map((entry) => ({
      authored_identity: entry.authored_identity,
      ordered_dependency_identities: entry.ordered_dependency_identities,
    })),
  };
  return {
    schema_version: IMMUTABLE_MEMBER_SCHEMA_VERSION,
    member_key: definition.member_key,
    member_kind: kind,
    logical_type: definition.logical_type,
    member_schema_version: AGGREGATE_SOURCE_SCHEMA_VERSION,
    byte_length: sourceBytes.length,
    payload_digest: sha256Hex(sourceBytes),
    source_bytes_base64: sourceBytes.toString('base64'),
    semantic_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_AGGREGATE_SEMANTIC/V1',
      sourcePayload,
    ),
    identity_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_AGGREGATE_IDENTITY/V1',
      identityPayload,
    ),
  };
}

function validateCanonicalContractBundleAggregateMembers(values) {
  const code = 'INVALID_CANONICAL_CONTRACT_BUNDLE_AGGREGATE_MEMBER_SET';
  if (!Array.isArray(values) || values.length !== REQUIRED_BUNDLE_KINDS.length) {
    fail(
      code,
      'A compiler aggregate set must contain every required bundle kind exactly once.',
      { actual_count: Array.isArray(values) ? values.length : null },
    );
  }
  const decoded = values.map((member, memberIndex) => {
    const label = `aggregate_members[${memberIndex}]`;
    requireExactKeys(member, [
      'schema_version',
      'member_key',
      'member_kind',
      'logical_type',
      'member_schema_version',
      'byte_length',
      'payload_digest',
      'source_bytes_base64',
      'semantic_digest',
      'identity_digest',
    ], label, code);
    const definition = FIXED_MEMBER_DEFINITIONS[member.member_kind];
    if (
      member.schema_version !== IMMUTABLE_MEMBER_SCHEMA_VERSION
      || !definition
      || member.member_key !== definition.member_key
      || member.logical_type !== definition.logical_type
      || member.member_schema_version !== AGGREGATE_SOURCE_SCHEMA_VERSION
    ) {
      fail(code, 'An aggregate member does not match its fixed compiler definition.', {
        member_key: member.member_key,
      });
    }
    requirePositiveInteger(member.byte_length, `${label}.byte_length`, code);
    requireDigest(member.payload_digest, `${label}.payload_digest`, code);
    requireDigest(member.semantic_digest, `${label}.semantic_digest`, code);
    requireDigest(member.identity_digest, `${label}.identity_digest`, code);
    requireString(member.source_bytes_base64, `${label}.source_bytes_base64`, code);
    const sourceBytes = Buffer.from(member.source_bytes_base64, 'base64');
    if (
      sourceBytes.toString('base64') !== member.source_bytes_base64
      || sourceBytes.length !== member.byte_length
      || sha256Hex(sourceBytes) !== member.payload_digest
    ) {
      fail(code, 'An aggregate member does not match its retained source bytes.', {
        member_key: member.member_key,
      });
    }
    let source;
    try {
      source = JSON.parse(sourceBytes.toString('utf8'));
    } catch {
      fail(code, 'An aggregate member must retain canonical JSON source bytes.', {
        member_key: member.member_key,
      });
    }
    if (!sourceBytes.equals(Buffer.from(canonicalJson(source), 'utf8'))) {
      fail(code, 'An aggregate member source is not canonical JSON.', {
        member_key: member.member_key,
      });
    }
    requireExactKeys(source, [
      'schema_version',
      'member_kind',
      'ordered_authored_members',
    ], `${label}.source`, code);
    if (
      source.schema_version !== AGGREGATE_SOURCE_SCHEMA_VERSION
      || source.member_kind !== member.member_kind
      || !Array.isArray(source.ordered_authored_members)
      || source.ordered_authored_members.length === 0
    ) {
      fail(code, 'An aggregate source does not match its fixed compiler definition.', {
        member_key: member.member_key,
      });
    }
    const entries = source.ordered_authored_members.map((entry, entryIndex) => {
      const entryLabel = `${label}.source.ordered_authored_members[${entryIndex}]`;
      requireExactKeys(entry, [
        'authored_identity',
        'canonical_byte_length',
        'canonical_value',
        'ordered_dependency_identities',
      ], entryLabel, code);
      const authoredIdentity = validateAuthoredIdentity(
        entry.authored_identity,
        `${entryLabel}.authored_identity`,
        code,
      );
      if (authoredIdentity.object_kind === REQUIRED_KIND_REGISTRY_OBJECT_KIND) {
        fail(code, 'A compiler aggregate cannot contain the governance member.');
      }
      requirePositiveInteger(
        entry.canonical_byte_length,
        `${entryLabel}.canonical_byte_length`,
        code,
      );
      requireObject(entry.canonical_value, `${entryLabel}.canonical_value`, code);
      if (
        entry.canonical_value.object_kind !== authoredIdentity.object_kind
        || entry.canonical_value.stable_id !== authoredIdentity.stable_id
        || entry.canonical_value.schema_version !== authoredIdentity.schema_version
      ) {
        fail(code, 'An aggregate authored value does not match its identity.');
      }
      const canonicalValueBytes = Buffer.from(
        canonicalJson(entry.canonical_value),
        'utf8',
      );
      if (
        canonicalValueBytes.length !== entry.canonical_byte_length
        || sha256Hex(canonicalValueBytes)
          !== authoredIdentity.canonical_bytes_digest
      ) {
        fail(
          code,
          'An aggregate authored value does not match its canonical digest and length.',
          { authored_identity: authoredIdentity },
        );
      }
      if (!Array.isArray(entry.ordered_dependency_identities)) {
        fail(code, 'Aggregate dependency identities must be an array.');
      }
      const dependencies = entry.ordered_dependency_identities.map(
        (dependency, dependencyIndex) => validateAuthoredIdentity(
          dependency,
          `${entryLabel}.ordered_dependency_identities[${dependencyIndex}]`,
          code,
        ),
      );
      const dependencyKeys = dependencies.map(identityKey);
      if (
        new Set(dependencyKeys).size !== dependencyKeys.length
        || canonicalJson(dependencyKeys)
          !== canonicalJson([...dependencyKeys].sort(compareStrings))
      ) {
        fail(code, 'Aggregate dependency identities must be unique and ordered.');
      }
      return {
        authored_identity: authoredIdentity,
        canonical_byte_length: entry.canonical_byte_length,
        canonical_value: clone(entry.canonical_value),
        ordered_dependency_identities: dependencies,
      };
    });
    const authoredKeys = entries.map((entry) => identityKey(entry.authored_identity));
    if (
      new Set(authoredKeys).size !== authoredKeys.length
      || canonicalJson(authoredKeys)
        !== canonicalJson([...authoredKeys].sort(compareStrings))
    ) {
      fail(code, 'Aggregate authored members must be unique and ordered.');
    }
    return { member, entries };
  });
  const memberKinds = decoded.map(({ member }) => member.member_kind);
  if (canonicalJson(memberKinds) !== canonicalJson(REQUIRED_BUNDLE_KINDS)) {
    fail(code, 'Aggregate members must use the exact required kind order.');
  }
  const allEntries = decoded.flatMap(({ entries }) => entries);
  const allAuthoredKeys = allEntries.map(
    (entry) => identityKey(entry.authored_identity),
  );
  if (new Set(allAuthoredKeys).size !== allAuthoredKeys.length) {
    fail(code, 'Aggregate authored identities must be globally unique.');
  }
  const authoredMembers = allEntries.map((entry) => ({
    ...entry.authored_identity,
    canonical_byte_length: entry.canonical_byte_length,
    canonical_value: entry.canonical_value,
  }));
  validateDependencyGraph(allEntries, authoredMembers);
  const dependencyByIdentity = new Map(allEntries.map((entry) => [
    identityKey(entry.authored_identity),
    entry.ordered_dependency_identities,
  ]));
  for (const { member, entries } of decoded) {
    const expected = aggregateMember(
      member.member_kind,
      entries.map((entry) => ({
        ...entry.authored_identity,
        canonical_byte_length: entry.canonical_byte_length,
        canonical_value: entry.canonical_value,
      })),
      dependencyByIdentity,
    );
    if (canonicalJson(member) !== canonicalJson(expected)) {
      fail(
        code,
        'An aggregate member is not the exact output of the canonical compiler.',
        { member_key: member.member_key },
      );
    }
  }
  return deepFreeze(clone(values));
}

function compileCanonicalContractBundle({
  canonical_contract_input_compilation: inputCompilation,
  classification_registry: classificationRegistry,
  dependency_registry: dependencyRegistry,
  governed_registry_bindings: governedRegistryBindings,
  predecessor_classification_registry: predecessorClassificationRegistry = null,
  predecessor_dependency_registry: predecessorDependencyRegistry = null,
} = {}) {
  const validatedInput = validateInputCompilation(inputCompilation);
  const members = validatedInput.non_governance_members;
  const classifications = validateClassificationRegistry(
    classificationRegistry,
    members,
    predecessorClassificationRegistry,
  );
  const dependencies = validateDependencyRegistry(
    dependencyRegistry,
    members,
    predecessorDependencyRegistry,
  );
  validateGovernedRegistryBindings(
    governedRegistryBindings,
    classificationRegistry,
    dependencyRegistry,
  );

  const classificationByIdentity = new Map(classifications.map(
    (entry) => [identityKey(entry.authored_identity), entry.member_kind],
  ));
  const dependencyByIdentity = new Map(dependencies.map(
    (entry) => [identityKey(entry.authored_identity), entry.ordered_dependency_identities],
  ));
  const membersByKind = new Map(REQUIRED_BUNDLE_KINDS.map((kind) => [kind, []]));
  for (const member of members) {
    membersByKind.get(classificationByIdentity.get(identityKey(identityOf(member)))).push(member);
  }

  const bundleMembers = REQUIRED_BUNDLE_KINDS
    .map((kind) => aggregateMember(kind, membersByKind.get(kind), dependencyByIdentity))
    .sort((left, right) => compareStrings(left.member_key, right.member_key));
  const bundleProjection = bundleMembers.map((member) => ({
    member_key: member.member_key,
    semantic_digest: member.semantic_digest,
    identity_digest: member.identity_digest,
  }));
  const contractBundleDigest = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
    bundleProjection,
  );
  const contractBundleId = domainDigest(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: contractBundleDigest },
  );
  const memberRoot = domainDigest(
    'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
    bundleMembers,
  );
  const requiredKindSetRoot = domainDigest(
    'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_REQUIRED_KIND_SET_ROOT/V1',
    REQUIRED_BUNDLE_KINDS,
  );
  const dependencyEdgeCount = dependencies.reduce(
    (sum, entry) => sum + entry.ordered_dependency_identities.length,
    0,
  );
  const compileReport = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE_COMPILE_REPORT/V1',
    authored_input_identity_id: validatedInput.input_identity_id,
    classification_registry_id: classificationRegistry.classification_registry_id,
    dependency_registry_id: dependencyRegistry.dependency_registry_id,
    non_governance_authored_member_count: members.length,
    aggregate_member_count: bundleMembers.length,
    required_kind_count: REQUIRED_BUNDLE_KINDS.length,
    missing_member_count: 0,
    extra_member_count: 0,
    duplicate_identity_count: 0,
    conflict_count: 0,
    status: 'PASS',
  };
  const dependencyCycleReport = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE_REPORT/V1',
    node_count: members.length,
    edge_count: dependencyEdgeCount,
    unresolved_dependency_count: 0,
    self_dependency_count: 0,
    cycle_count: 0,
    status: 'PASS',
  };
  const compilationPayload = {
    canonical_contract_bundle_members: bundleMembers,
    canonical_contract_bundle_projection: bundleProjection,
    contract_bundle_id: contractBundleId,
    contract_bundle_digest: contractBundleDigest,
    canonical_contract_bundle_member_root: memberRoot,
    canonical_contract_bundle_required_kind_set_root: requiredKindSetRoot,
    compile_report: compileReport,
    compile_report_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_COMPILE_REPORT_DIGEST/V1',
      compileReport,
    ),
    dependency_cycle_report: dependencyCycleReport,
    cycle_report_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE_REPORT_DIGEST/V1',
      dependencyCycleReport,
    ),
  };
  return deepFreeze({
    schema_version: COMPILATION_SCHEMA_VERSION,
    ...compilationPayload,
    canonical_payload_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_COMPILATION_PAYLOAD/V1',
      compilationPayload,
    ),
    disposition: {
      schema_version: 'CANONICAL_CONTRACT_BUNDLE_COMPILATION_DISPOSITION/V1',
      status: 'COMPILED_NOT_FROZEN',
      freeze_authority: 'NONE',
      signing_authority: 'NONE',
      writer_authority: 'NONE',
      serving_authority: 'NONE',
      database_authority: 'NONE',
      release_authority: 'NONE',
      activation_authority: 'NONE',
      production_authority: 'NONE',
    },
  });
}

module.exports = {
  COMPILATION_SCHEMA_VERSION,
  CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
  DEPENDENCY_REGISTRY_SCHEMA_VERSION,
  GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
  AGGREGATE_SOURCE_SCHEMA_VERSION,
  REQUIRED_BUNDLE_KINDS,
  FIXED_MEMBER_DEFINITIONS,
  CanonicalContractBundleCompilerError,
  validateCanonicalContractBundleAggregateMembers,
  compileCanonicalContractBundle,
};
