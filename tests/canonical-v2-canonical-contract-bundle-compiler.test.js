const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const { domainDigest } = require('../lib/programme-gates/bytes');
const { validateSchema } = require('../lib/programme-gates/schema-registry');
const {
  CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
  DEPENDENCY_REGISTRY_SCHEMA_VERSION,
  GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
  REQUIRED_BUNDLE_KINDS,
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');

const GOVERNANCE_KIND = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function digestOf(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function authoredMember(index, objectKind, stableId) {
  const canonicalValue = {
    object_kind: objectKind,
    stable_id: stableId,
    schema_version: `${objectKind}/V1`,
    legal_meaning: `MEANING_${index}`,
  };
  const bytes = Buffer.from(canonicalJson(canonicalValue), 'utf8');
  return {
    relative_path: `contracts/member-${String(index).padStart(2, '0')}.json`,
    object_kind: objectKind,
    stable_id: stableId,
    schema_version: canonicalValue.schema_version,
    canonical_bytes_digest: sha256Hex(bytes),
    canonical_byte_length: bytes.length,
    contract_ordinal: index,
    canonical_value: canonicalValue,
  };
}

function identity(member) {
  return {
    relative_path: member.relative_path,
    object_kind: member.object_kind,
    stable_id: member.stable_id,
    schema_version: member.schema_version,
    canonical_bytes_digest: member.canonical_bytes_digest,
  };
}

function makeInputCompilation() {
  const governance = authoredMember(
    0,
    GOVERNANCE_KIND,
    GOVERNANCE_KIND,
  );
  const domainMembers = REQUIRED_BUNDLE_KINDS.map((kind, index) => (
    authoredMember(index + 1, `TEST_${kind}`, `TEST_${kind}`)
  ));
  const authoredMembers = [governance, ...domainMembers];
  return {
    schema_version: 'CANONICAL_BUNDLE_INPUT_COMPILATION/V1',
    canonical_bundle_input_identity: {
      canonical_bundle_input_identity_id: contentId(
        'TEST_CANONICAL_BUNDLE_INPUT_IDENTITY/V1',
        authoredMembers.map(identity),
      ),
    },
    authored_members: authoredMembers,
    authored_universe_assessment: {
      status: 'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY',
      required_kind_registry_binding: {
        relative_path: governance.relative_path,
        stable_id: governance.stable_id,
        schema_version: governance.schema_version,
        canonical_bytes_digest: governance.canonical_bytes_digest,
      },
    },
    disposition: {
      status: 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE',
      reason_code: 'BUNDLE_GENERATION_AND_FREEZE_NOT_EVALUATED',
      freeze_eligible: false,
      canonical_contract_bundle_authority: 'NONE',
      p1_gate_status: 'NOT_EVALUATED',
    },
  };
}

function sealClassificationRegistry(orderedClassifications, {
  registryVersion = 1,
  predecessorRegistry = null,
} = {}) {
  const body = {
    schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
    registry_version: registryVersion,
    predecessor_registry: predecessorRegistry && {
      registry_version: predecessorRegistry.registry_version,
      registry_id: predecessorRegistry.classification_registry_id,
      canonical_payload_digest: predecessorRegistry.canonical_payload_digest,
    },
    ordered_classifications: orderedClassifications,
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

function sealDependencyRegistry(orderedDependencies, {
  registryVersion = 1,
  predecessorRegistry = null,
} = {}) {
  const body = {
    schema_version: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
    registry_version: registryVersion,
    predecessor_registry: predecessorRegistry && {
      registry_version: predecessorRegistry.registry_version,
      registry_id: predecessorRegistry.dependency_registry_id,
      canonical_payload_digest: predecessorRegistry.canonical_payload_digest,
    },
    ordered_dependencies: orderedDependencies,
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

function sortedIdentities(members) {
  return members.map(identity).sort(
    (left, right) => canonicalJson(left).localeCompare(canonicalJson(right)),
  );
}

function fixture() {
  const input = makeInputCompilation();
  const members = input.authored_members.slice(1);
  const identities = sortedIdentities(members);
  const kindByStableId = new Map(
    REQUIRED_BUNDLE_KINDS.map((kind) => [`TEST_${kind}`, kind]),
  );
  const classificationRegistry = sealClassificationRegistry(
    identities.map((authoredIdentity) => ({
      authored_identity: authoredIdentity,
      member_kind: kindByStableId.get(authoredIdentity.stable_id),
    })),
  );
  const dependencyRegistry = sealDependencyRegistry(
    identities.map((authoredIdentity, index) => ({
      authored_identity: authoredIdentity,
      ordered_dependency_identities: index === 0 ? [] : [identities[index - 1]],
    })),
  );
  const governedBindings = {
    schema_version: GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
    classification_registry_id: classificationRegistry.classification_registry_id,
    classification_registry_payload_digest: classificationRegistry.canonical_payload_digest,
    dependency_registry_id: dependencyRegistry.dependency_registry_id,
    dependency_registry_payload_digest: dependencyRegistry.canonical_payload_digest,
  };
  return {
    input,
    classificationRegistry,
    dependencyRegistry,
    governedBindings,
  };
}

function compile(values = fixture()) {
  return compileCanonicalContractBundle({
    canonical_contract_input_compilation: values.input,
    classification_registry: values.classificationRegistry,
    dependency_registry: values.dependencyRegistry,
    governed_registry_bindings: values.governedBindings,
    predecessor_classification_registry:
      values.predecessorClassificationRegistry || null,
    predecessor_dependency_registry: values.predecessorDependencyRegistry || null,
  });
}

function assertCompilerError(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(error.name, 'CanonicalContractBundleCompilerError');
    assert.equal(error.code, code);
    return true;
  });
}

test('compiles exactly eight immutable aggregate members with deterministic gate roots', () => {
  const values = fixture();
  const first = compile(values);
  const second = compile(clone(values));

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.canonical_contract_bundle_members.length, 8);
  assert.deepEqual(
    first.canonical_contract_bundle_members.map((member) => member.member_kind),
    REQUIRED_BUNDLE_KINDS,
  );
  for (const member of first.canonical_contract_bundle_members) {
    assert.equal(validateSchema('CanonicalContractBundleMember/V1', member), true);
    const bytes = Buffer.from(member.source_bytes_base64, 'base64');
    assert.equal(bytes.length, member.byte_length);
    assert.equal(sha256Hex(bytes), member.payload_digest);
    const aggregate = JSON.parse(bytes.toString('utf8'));
    assert.equal(aggregate.member_kind, member.member_kind);
    assert.equal(aggregate.ordered_authored_members.length, 1);
    assert.equal(
      digestOf(aggregate.ordered_authored_members[0].canonical_value),
      aggregate.ordered_authored_members[0].authored_identity.canonical_bytes_digest,
    );
  }
  assert.equal(
    first.contract_bundle_digest,
    domainDigest(
      'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
      first.canonical_contract_bundle_projection,
    ),
  );
  assert.equal(
    first.contract_bundle_id,
    domainDigest(
      'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
      { contract_bundle_digest: first.contract_bundle_digest },
    ),
  );
  assert.equal(
    first.canonical_contract_bundle_member_root,
    domainDigest(
      'PROGRAMME_GATE_CANONICAL_CONTRACT_BUNDLE_MEMBER_ROOT/V1',
      first.canonical_contract_bundle_members,
    ),
  );
  assert.equal(first.compile_report.status, 'PASS');
  assert.equal(first.dependency_cycle_report.cycle_count, 0);
  assert.deepEqual(first.disposition, {
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
  });
});

test('refuses an authored universe that is not mechanically complete', () => {
  const values = fixture();
  values.input.authored_universe_assessment.status = 'NOT_ASSESSED';
  assertCompilerError(
    'CANONICAL_CONTRACT_INPUT_UNIVERSE_INCOMPLETE',
    () => compile(values),
  );
});

test('refuses source drift inside an otherwise admitted authored member', () => {
  const values = fixture();
  values.input.authored_members[1].canonical_value.legal_meaning = 'FORGED';
  assertCompilerError(
    'CANONICAL_CONTRACT_AUTHORED_MEMBER_SOURCE_DRIFT',
    () => compile(values),
  );
});

test('refuses missing, extra and duplicate classification entries', () => {
  const missing = fixture();
  missing.classificationRegistry = sealClassificationRegistry(
    missing.classificationRegistry.ordered_classifications.slice(1),
  );
  missing.governedBindings.classification_registry_id =
    missing.classificationRegistry.classification_registry_id;
  missing.governedBindings.classification_registry_payload_digest =
    missing.classificationRegistry.canonical_payload_digest;
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_CLOSED_SET_MISMATCH',
    () => compile(missing),
  );

  const extra = fixture();
  const extraIdentity = identity(authoredMember(20, 'EXTRA', 'EXTRA'));
  extra.classificationRegistry = sealClassificationRegistry([
    ...extra.classificationRegistry.ordered_classifications,
    { authored_identity: extraIdentity, member_kind: 'SEMANTIC_CATALOGUE' },
  ].sort((left, right) => (
    canonicalJson(left.authored_identity).localeCompare(canonicalJson(right.authored_identity))
  )));
  extra.governedBindings.classification_registry_id =
    extra.classificationRegistry.classification_registry_id;
  extra.governedBindings.classification_registry_payload_digest =
    extra.classificationRegistry.canonical_payload_digest;
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_CLOSED_SET_MISMATCH',
    () => compile(extra),
  );

  const duplicate = fixture();
  const entries = clone(duplicate.classificationRegistry.ordered_classifications);
  entries.splice(1, 0, clone(entries[0]));
  duplicate.classificationRegistry = sealClassificationRegistry(entries);
  duplicate.governedBindings.classification_registry_id =
    duplicate.classificationRegistry.classification_registry_id;
  duplicate.governedBindings.classification_registry_payload_digest =
    duplicate.classificationRegistry.canonical_payload_digest;
  assertCompilerError(
    'DUPLICATE_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_ENTRY',
    () => compile(duplicate),
  );
});

test('refuses omission of any of the eight required aggregate kinds', () => {
  const values = fixture();
  const entries = clone(values.classificationRegistry.ordered_classifications);
  entries[0].member_kind = entries[1].member_kind;
  values.classificationRegistry = sealClassificationRegistry(entries);
  values.governedBindings.classification_registry_id =
    values.classificationRegistry.classification_registry_id;
  values.governedBindings.classification_registry_payload_digest =
    values.classificationRegistry.canonical_payload_digest;
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_CATEGORY_OMISSION',
    () => compile(values),
  );
});

test('refuses a correctly rehashed classification registry outside the governed binding', () => {
  const values = fixture();
  const entries = clone(values.classificationRegistry.ordered_classifications);
  [entries[0].member_kind, entries[1].member_kind] =
    [entries[1].member_kind, entries[0].member_kind];
  values.classificationRegistry = sealClassificationRegistry(entries);
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_UNAUTHORISED_REGISTRY_SUBSTITUTION',
    () => compile(values),
  );
});

test('requires a registry version increase for a predecessor-bound reclassification', () => {
  const values = fixture();
  const predecessor = values.classificationRegistry;
  const entries = clone(predecessor.ordered_classifications);
  [entries[0].member_kind, entries[1].member_kind] =
    [entries[1].member_kind, entries[0].member_kind];
  const changedBody = {
    schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
    registry_version: 1,
    predecessor_registry: {
      registry_version: predecessor.registry_version,
      registry_id: predecessor.classification_registry_id,
      canonical_payload_digest: predecessor.canonical_payload_digest,
    },
    ordered_classifications: entries,
  };
  const changedDigest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_PAYLOAD/V1',
    changedBody,
  );
  values.classificationRegistry = {
    ...changedBody,
    canonical_payload_digest: changedDigest,
    classification_registry_id: contentId(
      'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_ID/V1',
      {
        schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
        registry_version: 1,
        canonical_payload_digest: changedDigest,
      },
    ),
  };
  values.predecessorClassificationRegistry = predecessor;
  values.governedBindings.classification_registry_id =
    values.classificationRegistry.classification_registry_id;
  values.governedBindings.classification_registry_payload_digest =
    values.classificationRegistry.canonical_payload_digest;
  assertCompilerError(
    'INVALID_CANONICAL_CONTRACT_BUNDLE_REGISTRY_PREDECESSOR',
    () => compile(values),
  );
});

test('refuses missing, extra and duplicate dependency entries', () => {
  const missing = fixture();
  missing.dependencyRegistry = sealDependencyRegistry(
    missing.dependencyRegistry.ordered_dependencies.slice(1),
  );
  missing.governedBindings.dependency_registry_id =
    missing.dependencyRegistry.dependency_registry_id;
  missing.governedBindings.dependency_registry_payload_digest =
    missing.dependencyRegistry.canonical_payload_digest;
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CLOSED_SET_MISMATCH',
    () => compile(missing),
  );

  const extra = fixture();
  const extraIdentity = identity(authoredMember(20, 'EXTRA', 'EXTRA'));
  extra.dependencyRegistry = sealDependencyRegistry([
    ...extra.dependencyRegistry.ordered_dependencies,
    { authored_identity: extraIdentity, ordered_dependency_identities: [] },
  ].sort((left, right) => (
    canonicalJson(left.authored_identity).localeCompare(canonicalJson(right.authored_identity))
  )));
  extra.governedBindings.dependency_registry_id =
    extra.dependencyRegistry.dependency_registry_id;
  extra.governedBindings.dependency_registry_payload_digest =
    extra.dependencyRegistry.canonical_payload_digest;
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CLOSED_SET_MISMATCH',
    () => compile(extra),
  );

  const duplicate = fixture();
  const entries = clone(duplicate.dependencyRegistry.ordered_dependencies);
  entries.splice(1, 0, clone(entries[0]));
  duplicate.dependencyRegistry = sealDependencyRegistry(entries);
  duplicate.governedBindings.dependency_registry_id =
    duplicate.dependencyRegistry.dependency_registry_id;
  duplicate.governedBindings.dependency_registry_payload_digest =
    duplicate.dependencyRegistry.canonical_payload_digest;
  assertCompilerError(
    'DUPLICATE_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_ENTRY',
    () => compile(duplicate),
  );
});

test('refuses unresolved and self dependencies', () => {
  const unresolved = fixture();
  const entries = clone(unresolved.dependencyRegistry.ordered_dependencies);
  entries[0].ordered_dependency_identities = [
    identity(authoredMember(20, 'MISSING', 'MISSING')),
  ];
  unresolved.dependencyRegistry = sealDependencyRegistry(entries);
  unresolved.governedBindings.dependency_registry_id =
    unresolved.dependencyRegistry.dependency_registry_id;
  unresolved.governedBindings.dependency_registry_payload_digest =
    unresolved.dependencyRegistry.canonical_payload_digest;
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_UNRESOLVED_DEPENDENCY',
    () => compile(unresolved),
  );

  const self = fixture();
  const selfEntries = clone(self.dependencyRegistry.ordered_dependencies);
  selfEntries[0].ordered_dependency_identities = [selfEntries[0].authored_identity];
  self.dependencyRegistry = sealDependencyRegistry(selfEntries);
  self.governedBindings.dependency_registry_id = self.dependencyRegistry.dependency_registry_id;
  self.governedBindings.dependency_registry_payload_digest =
    self.dependencyRegistry.canonical_payload_digest;
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_SELF_DEPENDENCY',
    () => compile(self),
  );
});

test('refuses a cycle in the exact authored dependency graph', () => {
  const values = fixture();
  const entries = clone(values.dependencyRegistry.ordered_dependencies);
  entries[0].ordered_dependency_identities = [entries[1].authored_identity];
  entries[1].ordered_dependency_identities = [entries[0].authored_identity];
  values.dependencyRegistry = sealDependencyRegistry(entries);
  values.governedBindings.dependency_registry_id =
    values.dependencyRegistry.dependency_registry_id;
  values.governedBindings.dependency_registry_payload_digest =
    values.dependencyRegistry.canonical_payload_digest;
  assertCompilerError(
    'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE',
    () => compile(values),
  );
});

test('does not let caller fields control aggregate keys, logical types or authority', () => {
  const values = fixture();
  const forged = clone(values.classificationRegistry);
  forged.ordered_classifications[0].member_key = 'CALLER_CONTROLLED';
  const body = clone(forged);
  delete body.classification_registry_id;
  delete body.canonical_payload_digest;
  forged.canonical_payload_digest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_PAYLOAD/V1',
    body,
  );
  forged.classification_registry_id = contentId(
    'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_ID/V1',
    {
      schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
      registry_version: forged.registry_version,
      canonical_payload_digest: forged.canonical_payload_digest,
    },
  );
  values.classificationRegistry = forged;
  values.governedBindings.classification_registry_id = forged.classification_registry_id;
  values.governedBindings.classification_registry_payload_digest =
    forged.canonical_payload_digest;
  assertCompilerError(
    'INVALID_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY',
    () => compile(values),
  );
});
