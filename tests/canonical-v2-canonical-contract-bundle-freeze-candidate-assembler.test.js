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
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  FORMAL_FREEZE_EVIDENCE_INPUTS,
  assertDeterministicCompilations,
  assembleCanonicalContractBundleFreezeCandidate,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-freeze-candidate-assembler'
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

function sealClassificationRegistry(orderedClassifications) {
  const body = {
    schema_version: CLASSIFICATION_REGISTRY_SCHEMA_VERSION,
    registry_version: 1,
    predecessor_registry: null,
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
        registry_version: 1,
        canonical_payload_digest: canonicalPayloadDigest,
      },
    ),
  };
}

function sealDependencyRegistry(orderedDependencies) {
  const body = {
    schema_version: DEPENDENCY_REGISTRY_SCHEMA_VERSION,
    registry_version: 1,
    predecessor_registry: null,
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
        registry_version: 1,
        canonical_payload_digest: canonicalPayloadDigest,
      },
    ),
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
    classification_registry: classificationRegistry,
    dependency_registry: dependencyRegistry,
    governed_registry_bindings: {
      schema_version: GOVERNED_REGISTRY_BINDINGS_SCHEMA_VERSION,
      classification_registry_id: classificationRegistry.classification_registry_id,
      classification_registry_payload_digest:
        classificationRegistry.canonical_payload_digest,
      dependency_registry_id: dependencyRegistry.dependency_registry_id,
      dependency_registry_payload_digest: dependencyRegistry.canonical_payload_digest,
    },
    frozen_contract_pair_digest: 'f'.repeat(64),
  };
}

function assertAssemblerError(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(
      error.name,
      'CanonicalContractBundleFreezeCandidateAssemblerError',
    );
    assert.equal(error.code, code);
    return true;
  });
}

test('assembles the same non-authorising freeze candidate twice', () => {
  const input = fixture();
  const first = assembleCanonicalContractBundleFreezeCandidate(input);
  const second = assembleCanonicalContractBundleFreezeCandidate(clone(input));

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.canonical_contract_bundle_members.length, 8);
  assert.deepEqual(
    first.canonical_contract_bundle_members.map((member) => member.member_kind),
    REQUIRED_BUNDLE_KINDS,
  );
  first.canonical_contract_bundle_members.forEach((member) => {
    assert.equal(validateSchema('CanonicalContractBundleMember/V1', member), true);
  });
  assert.equal(first.compile_report.status, 'PASS');
  assert.equal(first.compile_report.missing_member_count, 0);
  assert.equal(first.compile_report.extra_member_count, 0);
  assert.equal(first.compile_report.duplicate_identity_count, 0);
  assert.equal(first.compile_report.conflict_count, 0);
  assert.equal(first.dependency_cycle_report.unresolved_dependency_count, 0);
  assert.equal(first.dependency_cycle_report.cycle_count, 0);
  assert.equal(first.determinism_report.compile_run_count, 2);
  assert.equal(first.determinism_report.mismatch_count, 0);
  assert.equal(
    first.determinism_report.first_compilation_payload_digest,
    first.determinism_report.second_compilation_payload_digest,
  );
  assert.equal(
    first.contract_bundle_digest,
    domainDigest(
      'PROGRAMME_GATE_CONTRACT_BUNDLE_SNAPSHOT/V1',
      first.canonical_contract_bundle_projection,
    ),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.disposition.state, 'ASSEMBLED_NOT_FROZEN');
  assert.equal(first.disposition.freeze_authority, 'NONE');
  assert.equal(first.disposition.signing_authority, 'NONE');
  assert.equal(first.disposition.production_authority, 'NONE');
});

test('emits an exact generated-output inventory and unsigned receipt body', () => {
  const candidate = assembleCanonicalContractBundleFreezeCandidate(fixture());
  const inventory = candidate.generated_output_inventory;
  assert.equal(inventory.length, 13);
  assert.equal(
    new Set(inventory.map((entry) => entry.path)).size,
    inventory.length,
  );
  assert.deepEqual(
    inventory.map((entry) => entry.path),
    [...inventory.map((entry) => entry.path)].sort(),
  );
  inventory.forEach((entry) => assert.match(entry.payload_digest, /^[a-f0-9]{64}$/));

  const receipt = candidate.unsigned_contract_bundle_compilation_receipt_payload;
  assert.equal(receipt.schema_version, 'ContractBundleCompilationReceipt/V1');
  assert.equal(receipt.contract_bundle_id, candidate.contract_bundle_id);
  assert.equal(receipt.contract_bundle_digest, candidate.contract_bundle_digest);
  assert.equal(receipt.frozen_contract_pair_digest, 'f'.repeat(64));
  assert.deepEqual(receipt.generated_outputs, inventory);
  assert.deepEqual(receipt.compile_errors, []);
  assert.deepEqual(receipt.cycle_errors, []);
  assert.deepEqual(receipt.drift_errors, []);
  assert.equal(receipt.terminal_state, 'PASS');
  assert.equal('receipt_id' in receipt, false);
  assert.equal('validator_key_id' in receipt, false);
  assert.equal('signature_algorithm' in receipt, false);
  assert.equal('signature' in receipt, false);

  const unsignedIdentity = {
    ...receipt,
    validator_key_id: 'VALIDATOR_KEY',
    signature_algorithm: 'Ed25519',
  };
  const schemaCompleteReceipt = {
    ...unsignedIdentity,
    receipt_id: domainDigest(
      'PROGRAMME_GATE_CONTRACT_COMPILATION_RECEIPT_ID/V1',
      unsignedIdentity,
    ),
    signature: Buffer.from('schema-only-test-signature', 'utf8').toString('base64'),
  };
  assert.equal(
    validateSchema('ContractBundleCompilationReceipt/V1', schemaCompleteReceipt),
    true,
  );
});

test('identifies every formal freeze input without claiming it exists', () => {
  const candidate = assembleCanonicalContractBundleFreezeCandidate(fixture());
  assert.deepEqual(
    candidate.formal_freeze_evidence_input_inventory,
    FORMAL_FREEZE_EVIDENCE_INPUTS,
  );
  assert.equal(
    candidate.formal_freeze_evidence_input_inventory
      .find((entry) => entry.schema_id === 'CanonicalContractBundleMember/V1')
      .preparation_state,
    'PREPARED_BY_ASSEMBLER',
  );
  assert.equal(
    candidate.formal_freeze_evidence_input_inventory
      .find((entry) => entry.schema_id === 'ContractBundleCompilationReceipt/V1')
      .preparation_state,
    'UNSIGNED_PAYLOAD_PREPARED_BY_ASSEMBLER',
  );
  assert.equal(
    candidate.formal_freeze_evidence_input_inventory
      .find((entry) => entry.schema_id === 'ContractDiffReviewAttestation/V1')
      .preparation_state,
    'EXTERNAL_INPUT_REQUIRED',
  );
  assert.equal(candidate.disposition.independent_reviews_required, true);
  assert.equal(candidate.disposition.ben_approval_required, true);
  assert.equal(candidate.disposition.receipt_signature_required, true);
  assert.equal(
    candidate.disposition.frozen_contract_pair_binding_validation,
    'DEFERRED_TO_CONTRACT_FREEZE_ATTESTATION_IDENTITY',
  );
});

test('rejects an incomplete authored universe', () => {
  const input = fixture();
  input.canonical_contract_input_compilation.authored_universe_assessment.status =
    'NOT_ASSESSED';
  assert.throws(
    () => assembleCanonicalContractBundleFreezeCandidate(input),
    (error) => error.code === 'CANONICAL_CONTRACT_INPUT_UNIVERSE_INCOMPLETE',
  );
});

test('rejects missing, extra, duplicate and conflicting classifications', () => {
  const missing = fixture();
  missing.classification_registry = sealClassificationRegistry(
    missing.classification_registry.ordered_classifications.slice(1),
  );
  missing.governed_registry_bindings.classification_registry_id =
    missing.classification_registry.classification_registry_id;
  missing.governed_registry_bindings.classification_registry_payload_digest =
    missing.classification_registry.canonical_payload_digest;
  assert.throws(
    () => assembleCanonicalContractBundleFreezeCandidate(missing),
    (error) => error.code
      === 'CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_CLOSED_SET_MISMATCH',
  );

  const extra = fixture();
  extra.signature = 'FORGED';
  assertAssemblerError(
    'INVALID_FREEZE_CANDIDATE_ASSEMBLER_INPUT',
    () => assembleCanonicalContractBundleFreezeCandidate(extra),
  );

  const duplicate = fixture();
  const duplicateEntries = clone(
    duplicate.classification_registry.ordered_classifications,
  );
  duplicateEntries.splice(1, 0, clone(duplicateEntries[0]));
  duplicate.classification_registry =
    sealClassificationRegistry(duplicateEntries);
  duplicate.governed_registry_bindings.classification_registry_id =
    duplicate.classification_registry.classification_registry_id;
  duplicate.governed_registry_bindings.classification_registry_payload_digest =
    duplicate.classification_registry.canonical_payload_digest;
  assert.throws(
    () => assembleCanonicalContractBundleFreezeCandidate(duplicate),
    (error) => error.code
      === 'DUPLICATE_CANONICAL_CONTRACT_BUNDLE_CLASSIFICATION_ENTRY',
  );

  const conflict = fixture();
  const conflictEntries = clone(
    conflict.classification_registry.ordered_classifications,
  );
  conflictEntries[0].member_kind = conflictEntries[1].member_kind;
  conflict.classification_registry = sealClassificationRegistry(conflictEntries);
  conflict.governed_registry_bindings.classification_registry_id =
    conflict.classification_registry.classification_registry_id;
  conflict.governed_registry_bindings.classification_registry_payload_digest =
    conflict.classification_registry.canonical_payload_digest;
  assert.throws(
    () => assembleCanonicalContractBundleFreezeCandidate(conflict),
    (error) => error.code === 'CANONICAL_CONTRACT_BUNDLE_CATEGORY_OMISSION',
  );
});

test('rejects unresolved dependencies and cycles', () => {
  const unresolved = fixture();
  const unresolvedEntries = clone(
    unresolved.dependency_registry.ordered_dependencies,
  );
  unresolvedEntries[0].ordered_dependency_identities = [
    identity(authoredMember(20, 'MISSING', 'MISSING')),
  ];
  unresolved.dependency_registry = sealDependencyRegistry(unresolvedEntries);
  unresolved.governed_registry_bindings.dependency_registry_id =
    unresolved.dependency_registry.dependency_registry_id;
  unresolved.governed_registry_bindings.dependency_registry_payload_digest =
    unresolved.dependency_registry.canonical_payload_digest;
  assert.throws(
    () => assembleCanonicalContractBundleFreezeCandidate(unresolved),
    (error) => error.code === 'CANONICAL_CONTRACT_BUNDLE_UNRESOLVED_DEPENDENCY',
  );

  const cyclic = fixture();
  const cyclicEntries = clone(cyclic.dependency_registry.ordered_dependencies);
  cyclicEntries[0].ordered_dependency_identities = [
    cyclicEntries[1].authored_identity,
  ];
  cyclicEntries[1].ordered_dependency_identities = [
    cyclicEntries[0].authored_identity,
  ];
  cyclic.dependency_registry = sealDependencyRegistry(cyclicEntries);
  cyclic.governed_registry_bindings.dependency_registry_id =
    cyclic.dependency_registry.dependency_registry_id;
  cyclic.governed_registry_bindings.dependency_registry_payload_digest =
    cyclic.dependency_registry.canonical_payload_digest;
  assert.throws(
    () => assembleCanonicalContractBundleFreezeCandidate(cyclic),
    (error) => error.code === 'CANONICAL_CONTRACT_BUNDLE_DEPENDENCY_CYCLE',
  );
});

test('rejects supplied authority fields and invalid frozen-pair bindings', () => {
  for (const field of [
    'authority_manifest',
    'ben_approval',
    'review_attestation',
    'signature',
    'status_artefact',
  ]) {
    const input = fixture();
    input[field] = {};
    assertAssemblerError(
      'INVALID_FREEZE_CANDIDATE_ASSEMBLER_INPUT',
      () => assembleCanonicalContractBundleFreezeCandidate(input),
    );
  }
  const invalidDigest = fixture();
  invalidDigest.frozen_contract_pair_digest = 'NOT_A_DIGEST';
  assertAssemblerError(
    'INVALID_FREEZE_CANDIDATE_FROZEN_PAIR_DIGEST',
    () => assembleCanonicalContractBundleFreezeCandidate(invalidDigest),
  );
});

test('rejects two non-identical compiler outputs', () => {
  const first = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE_COMPILATION/V1',
    value: 'FIRST',
  };
  const second = {
    schema_version: 'CANONICAL_CONTRACT_BUNDLE_COMPILATION/V1',
    value: 'SECOND',
  };
  assertAssemblerError(
    'NONDETERMINISTIC_CANONICAL_CONTRACT_BUNDLE_COMPILATION',
    () => assertDeterministicCompilations(first, second),
  );
});
