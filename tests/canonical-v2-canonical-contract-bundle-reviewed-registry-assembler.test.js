const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  REQUIRED_BUNDLE_KINDS,
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  assembleCanonicalContractBundleReviewedRegistries,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-reviewed-registry-assembler'
);

const GOVERNANCE_KIND = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function fixture() {
  const governance = authoredMember(0, GOVERNANCE_KIND, GOVERNANCE_KIND);
  const domainMembers = REQUIRED_BUNDLE_KINDS.map((kind, index) => (
    authoredMember(index + 1, `TEST_${kind}`, `TEST_${kind}`)
  ));
  const authoredMembers = [governance, ...domainMembers];
  const identities = domainMembers
    .map(identity)
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const kindByStableId = new Map(
    REQUIRED_BUNDLE_KINDS.map((kind) => [`TEST_${kind}`, kind]),
  );
  return {
    canonical_contract_input_compilation: {
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
    },
    reviewed_dispositions: identities.map((authoredIdentity, index) => ({
      authored_identity: authoredIdentity,
      member_kind: kindByStableId.get(authoredIdentity.stable_id),
      ordered_dependency_identities:
        index === 0 ? [] : [identities[index - 1]],
    })),
    registry_version: 1,
    predecessor_classification_registry: null,
    predecessor_dependency_registry: null,
  };
}

function assertAssemblerError(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(
      error.name,
      'CanonicalContractBundleReviewedRegistryAssemblerError',
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('seals exact deterministic registries without inferring dispositions', () => {
  const input = fixture();
  const first = assembleCanonicalContractBundleReviewedRegistries(input);
  const second = assembleCanonicalContractBundleReviewedRegistries(clone(input));

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.classification_registry.ordered_classifications.length, 8);
  assert.equal(first.dependency_registry.ordered_dependencies.length, 8);
  assert.deepEqual(
    new Set(first.classification_registry.ordered_classifications.map(
      (entry) => entry.member_kind,
    )),
    new Set(REQUIRED_BUNDLE_KINDS),
  );
  assert.equal(first.mechanical_validation.missing_disposition_count, 0);
  assert.equal(first.mechanical_validation.unresolved_dependency_count, 0);
  assert.equal(first.mechanical_validation.dependency_cycle_count, 0);
  assert.equal(
    first.disposition.state,
    'REGISTRIES_SEALED_NOT_REVIEWED_BY_ASSEMBLER',
  );
  assert.equal(first.disposition.caller_disposition_authenticity, 'NOT_ESTABLISHED');
  assert.equal(first.disposition.review_evidence, 'NOT_SUPPLIED');
  assert.equal(first.disposition.freeze_authority, 'NONE');
});

test('seals registry identities with the existing canonical domains', () => {
  const result = assembleCanonicalContractBundleReviewedRegistries(fixture());
  const classification = result.classification_registry;
  const classificationBody = clone(classification);
  delete classificationBody.canonical_payload_digest;
  delete classificationBody.classification_registry_id;
  assert.equal(
    classification.canonical_payload_digest,
    contentId(
      'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_PAYLOAD/V1',
      classificationBody,
    ),
  );
  assert.equal(
    classification.classification_registry_id,
    contentId(
      'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_REGISTRY_ID/V1',
      {
        schema_version: classification.schema_version,
        registry_version: classification.registry_version,
        canonical_payload_digest: classification.canonical_payload_digest,
      },
    ),
  );

  const dependency = result.dependency_registry;
  const dependencyBody = clone(dependency);
  delete dependencyBody.canonical_payload_digest;
  delete dependencyBody.dependency_registry_id;
  assert.equal(
    dependency.canonical_payload_digest,
    contentId(
      'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_PAYLOAD/V1',
      dependencyBody,
    ),
  );
  assert.equal(
    dependency.dependency_registry_id,
    contentId(
      'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_REGISTRY_ID/V1',
      {
        schema_version: dependency.schema_version,
        registry_version: dependency.registry_version,
        canonical_payload_digest: dependency.canonical_payload_digest,
      },
    ),
  );
});

test('emits registries accepted by the existing bundle compiler', () => {
  const input = fixture();
  const result = assembleCanonicalContractBundleReviewedRegistries(input);
  const compiled = compileCanonicalContractBundle({
    canonical_contract_input_compilation:
      input.canonical_contract_input_compilation,
    classification_registry: result.classification_registry,
    dependency_registry: result.dependency_registry,
    governed_registry_bindings: result.governed_registry_bindings,
  });
  assert.equal(compiled.compile_report.status, 'PASS');
  assert.equal(compiled.compile_report.aggregate_member_count, 8);
  assert.equal(compiled.dependency_cycle_report.cycle_count, 0);
  assert.equal(compiled.contract_bundle_id, result.mechanical_validation.contract_bundle_id);
});

test('rejects missing, extra and duplicate disposition identities', () => {
  const missing = fixture();
  missing.reviewed_dispositions.pop();
  assertAssemblerError(
    'REVIEWED_BUNDLE_DISPOSITION_CLOSED_SET_MISMATCH',
    () => assembleCanonicalContractBundleReviewedRegistries(missing),
  );

  const extra = fixture();
  const extraIdentity = identity(authoredMember(20, 'EXTRA', 'EXTRA'));
  extra.reviewed_dispositions.push({
    authored_identity: extraIdentity,
    member_kind: 'SEMANTIC_CATALOGUE',
    ordered_dependency_identities: [],
  });
  extra.reviewed_dispositions.sort((left, right) => (
    canonicalJson(left.authored_identity)
      .localeCompare(canonicalJson(right.authored_identity))
  ));
  assertAssemblerError(
    'REVIEWED_BUNDLE_DISPOSITION_CLOSED_SET_MISMATCH',
    () => assembleCanonicalContractBundleReviewedRegistries(extra),
  );

  const duplicate = fixture();
  duplicate.reviewed_dispositions.splice(
    1,
    0,
    clone(duplicate.reviewed_dispositions[0]),
  );
  assertAssemblerError(
    'INVALID_REVIEWED_BUNDLE_DISPOSITION_ORDER',
    () => assembleCanonicalContractBundleReviewedRegistries(duplicate),
  );
});

test('rejects unordered dispositions and dependencies', () => {
  const dispositions = fixture();
  dispositions.reviewed_dispositions.reverse();
  assertAssemblerError(
    'INVALID_REVIEWED_BUNDLE_DISPOSITION_ORDER',
    () => assembleCanonicalContractBundleReviewedRegistries(dispositions),
  );

  const dependencies = fixture();
  dependencies.reviewed_dispositions[2].ordered_dependency_identities = [
    dependencies.reviewed_dispositions[1].authored_identity,
    dependencies.reviewed_dispositions[0].authored_identity,
  ];
  assertAssemblerError(
    'INVALID_REVIEWED_BUNDLE_DEPENDENCY_ORDER',
    () => assembleCanonicalContractBundleReviewedRegistries(dependencies),
  );
});

test('rejects missing categories and refuses to infer a kind', () => {
  const missingCategory = fixture();
  const firstKind = missingCategory.reviewed_dispositions[0].member_kind;
  missingCategory.reviewed_dispositions[1].member_kind = firstKind;
  assertAssemblerError(
    'REVIEWED_BUNDLE_CATEGORY_OMISSION',
    () => assembleCanonicalContractBundleReviewedRegistries(missingCategory),
  );

  const noKind = fixture();
  delete noKind.reviewed_dispositions[0].member_kind;
  assertAssemblerError(
    'INVALID_REVIEWED_BUNDLE_DISPOSITION',
    () => assembleCanonicalContractBundleReviewedRegistries(noKind),
  );
});

test('rejects duplicate, self, unresolved and cyclic dependencies', () => {
  const duplicate = fixture();
  duplicate.reviewed_dispositions[1].ordered_dependency_identities = [
    duplicate.reviewed_dispositions[0].authored_identity,
    duplicate.reviewed_dispositions[0].authored_identity,
  ];
  assertAssemblerError(
    'INVALID_REVIEWED_BUNDLE_DEPENDENCY_ORDER',
    () => assembleCanonicalContractBundleReviewedRegistries(duplicate),
  );

  const self = fixture();
  self.reviewed_dispositions[0].ordered_dependency_identities = [
    self.reviewed_dispositions[0].authored_identity,
  ];
  assertAssemblerError(
    'CANONICAL_CONTRACT_BUNDLE_SELF_DEPENDENCY',
    () => assembleCanonicalContractBundleReviewedRegistries(self),
  );

  const unresolved = fixture();
  unresolved.reviewed_dispositions[0].ordered_dependency_identities = [
    identity(authoredMember(20, 'MISSING', 'MISSING')),
  ];
  assertAssemblerError(
    'CANONICAL_CONTRACT_BUNDLE_UNRESOLVED_DEPENDENCY',
    () => assembleCanonicalContractBundleReviewedRegistries(unresolved),
  );

  const cycle = fixture();
  cycle.reviewed_dispositions[0].ordered_dependency_identities = [
    cycle.reviewed_dispositions[1].authored_identity,
  ];
  cycle.reviewed_dispositions[1].ordered_dependency_identities = [
    cycle.reviewed_dispositions[0].authored_identity,
  ];
  assert.throws(
    () => assembleCanonicalContractBundleReviewedRegistries(cycle),
    (error) => error.code === 'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE',
  );
});

test('preserves exact successor registry predecessor rules', () => {
  const firstInput = fixture();
  const first = assembleCanonicalContractBundleReviewedRegistries(firstInput);
  const successorInput = fixture();
  successorInput.registry_version = 2;
  successorInput.predecessor_classification_registry =
    first.classification_registry;
  successorInput.predecessor_dependency_registry = first.dependency_registry;
  const successor =
    assembleCanonicalContractBundleReviewedRegistries(successorInput);
  assert.deepEqual(successor.classification_registry.predecessor_registry, {
    registry_version: 1,
    registry_id: first.classification_registry.classification_registry_id,
    canonical_payload_digest:
      first.classification_registry.canonical_payload_digest,
  });
  assert.deepEqual(successor.dependency_registry.predecessor_registry, {
    registry_version: 1,
    registry_id: first.dependency_registry.dependency_registry_id,
    canonical_payload_digest:
      first.dependency_registry.canonical_payload_digest,
  });

  const missing = fixture();
  missing.registry_version = 2;
  assertAssemblerError(
    'REVIEWED_REGISTRY_PREDECESSORS_REQUIRED',
    () => assembleCanonicalContractBundleReviewedRegistries(missing),
  );

  const forbidden = fixture();
  forbidden.predecessor_classification_registry =
    first.classification_registry;
  forbidden.predecessor_dependency_registry = first.dependency_registry;
  assertAssemblerError(
    'INVALID_REVIEWED_REGISTRY_PREDECESSOR',
    () => assembleCanonicalContractBundleReviewedRegistries(forbidden),
  );
});

test('rejects supplied authority, signature, review, approval and status fields', () => {
  for (const field of [
    'authority_manifest',
    'signature',
    'review_attestation',
    'ben_approval',
    'programme_status',
  ]) {
    const input = fixture();
    input[field] = {};
    assertAssemblerError(
      'INVALID_REVIEWED_REGISTRY_ASSEMBLER_INPUT',
      () => assembleCanonicalContractBundleReviewedRegistries(input),
    );
  }

  const nested = fixture();
  nested.reviewed_dispositions[0].review_signature = 'forged';
  assertAssemblerError(
    'INVALID_REVIEWED_BUNDLE_DISPOSITION',
    () => assembleCanonicalContractBundleReviewedRegistries(nested),
  );
});
