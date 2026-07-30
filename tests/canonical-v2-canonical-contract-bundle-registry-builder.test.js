const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  buildCanonicalContractBundleRegistries,
  sealClassificationRegistry,
} = require('../lib/canonical-v2/canonical-contract-bundle-registry-builder');

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
    classification_decisions: identities.map((authoredIdentity) => ({
      authored_identity: authoredIdentity,
      member_kind: kindByStableId.get(authoredIdentity.stable_id),
    })),
    dependency_decisions: identities.map((authoredIdentity, index) => ({
      authored_identity: authoredIdentity,
      ordered_dependency_identities: index === 0 ? [] : [identities[index - 1]],
    })),
    registry_version: 1,
  };
}

function assertBuilderError(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(error.name, 'CanonicalContractBundleRegistryBuilderError');
    assert.equal(error.code, code);
    return true;
  });
}

test('builds deterministic canonical registries from explicit decisions only', () => {
  const input = fixture();
  const first = buildCanonicalContractBundleRegistries(input);
  const reordered = clone(input);
  reordered.classification_decisions.reverse();
  reordered.dependency_decisions.reverse();
  const second = buildCanonicalContractBundleRegistries(reordered);

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(
    first.classification_registry.ordered_classifications.map(
      (entry) => entry.member_kind,
    ).sort(),
    [...REQUIRED_BUNDLE_KINDS].sort(),
  );
  assert.equal(first.dependency_registry.ordered_dependencies.length, 8);
});

test('emits registry objects accepted by the existing bundle compiler', () => {
  const input = fixture();
  const registries = buildCanonicalContractBundleRegistries(input);
  const compiled = compileCanonicalContractBundle({
    canonical_contract_input_compilation: input.canonical_contract_input_compilation,
    classification_registry: registries.classification_registry,
    dependency_registry: registries.dependency_registry,
    governed_registry_bindings: registries.governed_registry_bindings,
  });
  assert.equal(compiled.compile_report.status, 'PASS');
  assert.equal(compiled.compile_report.aggregate_member_count, 8);
  assert.equal(compiled.dependency_cycle_report.cycle_count, 0);
});

test('rejects missing, unknown and duplicate explicit decisions', () => {
  const missingClassification = fixture();
  missingClassification.classification_decisions.pop();
  assertBuilderError(
    'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_DECISION_CLOSED_SET_MISMATCH',
    () => buildCanonicalContractBundleRegistries(missingClassification),
  );

  const unknownDependency = fixture();
  unknownDependency.dependency_decisions[0].authored_identity = identity(
    authoredMember(20, 'UNKNOWN', 'UNKNOWN'),
  );
  assertBuilderError(
    'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_DECISION_CLOSED_SET_MISMATCH',
    () => buildCanonicalContractBundleRegistries(unknownDependency),
  );

  const duplicateClassification = fixture();
  duplicateClassification.classification_decisions.push(
    clone(duplicateClassification.classification_decisions[0]),
  );
  assertBuilderError(
    'DUPLICATE_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_DECISION',
    () => buildCanonicalContractBundleRegistries(duplicateClassification),
  );
});

test('rejects an invalid kind and omission of a required aggregate kind', () => {
  const invalid = fixture();
  invalid.classification_decisions[0].member_kind = 'INFERRED_KIND';
  assertBuilderError(
    'INVALID_CANONICAL_CONTRACT_BUNDLE_MEMBER_KIND',
    () => buildCanonicalContractBundleRegistries(invalid),
  );

  const omitted = fixture();
  omitted.classification_decisions[0].member_kind =
    omitted.classification_decisions[1].member_kind;
  assertBuilderError(
    'CANONICAL_CONTRACT_BUNDLE_CATEGORY_OMISSION',
    () => buildCanonicalContractBundleRegistries(omitted),
  );
});

test('rejects unresolved, duplicate, self and cyclic dependencies', () => {
  const unresolved = fixture();
  unresolved.dependency_decisions[0].ordered_dependency_identities = [
    identity(authoredMember(20, 'UNKNOWN', 'UNKNOWN')),
  ];
  assertBuilderError(
    'CANONICAL_CONTRACT_BUNDLE_UNRESOLVED_DEPENDENCY',
    () => buildCanonicalContractBundleRegistries(unresolved),
  );

  const duplicate = fixture();
  duplicate.dependency_decisions[1].ordered_dependency_identities = [
    duplicate.dependency_decisions[0].authored_identity,
    duplicate.dependency_decisions[0].authored_identity,
  ];
  assertBuilderError(
    'DUPLICATE_CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_IDENTITY',
    () => buildCanonicalContractBundleRegistries(duplicate),
  );

  const self = fixture();
  self.dependency_decisions[0].ordered_dependency_identities = [
    self.dependency_decisions[0].authored_identity,
  ];
  assertBuilderError(
    'CANONICAL_CONTRACT_BUNDLE_SELF_DEPENDENCY',
    () => buildCanonicalContractBundleRegistries(self),
  );

  const cycle = fixture();
  cycle.dependency_decisions[0].ordered_dependency_identities = [
    cycle.dependency_decisions[1].authored_identity,
  ];
  cycle.dependency_decisions[1].ordered_dependency_identities = [
    cycle.dependency_decisions[0].authored_identity,
  ];
  assertBuilderError(
    'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE',
    () => buildCanonicalContractBundleRegistries(cycle),
  );
});

test('the compiler rejects a correctly rehashed registry substitution', () => {
  const input = fixture();
  const registries = buildCanonicalContractBundleRegistries(input);
  const swapped = clone(registries.classification_registry.ordered_classifications);
  const firstKind = swapped[0].member_kind;
  swapped[0].member_kind = swapped[1].member_kind;
  swapped[1].member_kind = firstKind;
  const substitutedClassificationRegistry = sealClassificationRegistry(
    swapped,
    1,
    null,
  );
  assert.throws(
    () => compileCanonicalContractBundle({
      canonical_contract_input_compilation: input.canonical_contract_input_compilation,
      classification_registry: substitutedClassificationRegistry,
      dependency_registry: registries.dependency_registry,
      governed_registry_bindings: registries.governed_registry_bindings,
    }),
    (error) => error.code
      === 'CANONICAL_CONTRACT_BUNDLE_UNAUTHORISED_REGISTRY_SUBSTITUTION',
  );
});

test('has the exact work-package allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '..',
    '.github',
    'phase-allowlists',
    'wp-canonical-bundle-registry-builder-v1.json',
  ), 'utf8'));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-canonical-bundle-registry-builder-v1.json',
    'lib/canonical-v2/canonical-contract-bundle-registry-builder.js',
    'tests/canonical-v2-canonical-contract-bundle-registry-builder.test.js',
  ]);
});
