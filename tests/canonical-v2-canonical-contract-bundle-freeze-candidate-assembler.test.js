const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

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
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('../lib/canonical-v2/canonical-contract-bundle-current-root');

const GOVERNANCE_KIND = 'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';
const ROOT = path.resolve(__dirname, '..', 'contracts/canonical-v2/successor');

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

function canonicalInputIdentity(authoredMembers) {
  const body = {
    schema_version: 'CANONICAL_BUNDLE_INPUT_IDENTITY/V1',
    root_input_manifest_id: contentId('TEST_INPUT_MANIFEST_ID/V1', authoredMembers),
    root_input_manifest_payload_digest:
      contentId('TEST_INPUT_MANIFEST_PAYLOAD/V1', authoredMembers),
    compiler_input_schema_version: 'CANONICAL_BUNDLE_INPUT_COMPILER/V1',
    generator_input_schema_version: 'CANONICAL_BUNDLE_GENERATOR_INPUT/V1',
    ordered_entries: authoredMembers.map((member) => ({
      relative_path: member.relative_path,
      object_kind: member.object_kind,
      stable_id: member.stable_id,
      canonical_bytes_digest: member.canonical_bytes_digest,
    })),
    per_kind_counts: Object.fromEntries(authoredMembers.map(
      (member) => [member.object_kind, 1],
    )),
    per_kind_schema_versions: Object.fromEntries(authoredMembers.map(
      (member) => [member.object_kind, [member.schema_version]],
    )),
    validation_roots: {
      missing_input_root: contentId('CANONICAL_BUNDLE_INPUT_MISSING_ROOT/V1', []),
      extra_input_root: contentId('CANONICAL_BUNDLE_INPUT_EXTRA_ROOT/V1', []),
      duplicate_input_root: contentId('CANONICAL_BUNDLE_INPUT_DUPLICATE_ROOT/V1', []),
      conflicting_input_root: contentId('CANONICAL_BUNDLE_INPUT_CONFLICT_ROOT/V1', []),
    },
  };
  return {
    ...body,
    canonical_payload_digest: contentId(
      'CANONICAL_BUNDLE_INPUT_IDENTITY_PAYLOAD/V1',
      body,
    ),
    canonical_bundle_input_identity_id: contentId(
      'CANONICAL_BUNDLE_INPUT/V1',
      body,
    ),
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
  const inputCompilation = compileCanonicalContractInput({
    root_directory: ROOT,
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: inputCompilation,
  });
  const classificationRegistry = proposal.registry_assembly.classification_registry;
  const dependencyRegistry = proposal.registry_assembly.dependency_registry;
  return {
    canonical_contract_input_compilation: inputCompilation,
    classification_registry: classificationRegistry,
    dependency_registry: dependencyRegistry,
    governed_registry_bindings:
      proposal.registry_assembly.governed_registry_bindings,
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
    first.generated_contract_topology.final_canonical_contract_bundle
      .canonical_contract_bundle_fingerprint,
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
  assert.equal(inventory.length, 14);
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
  input.canonical_contract_input_compilation = clone(
    input.canonical_contract_input_compilation,
  );
  input.canonical_contract_input_compilation.authored_members.pop();
  assert.throws(
    () => assembleCanonicalContractBundleFreezeCandidate(input),
    (error) => typeof error.code === 'string',
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
  const kindCounts = new Map();
  conflictEntries.forEach((entry) => kindCounts.set(
    entry.member_kind,
    (kindCounts.get(entry.member_kind) || 0) + 1,
  ));
  const omittedKind = REQUIRED_BUNDLE_KINDS.find(
    (kind) => (kindCounts.get(kind) || 0) > 0,
  );
  const replacementKind = REQUIRED_BUNDLE_KINDS.find(
    (kind) => kind !== omittedKind,
  );
  conflictEntries
    .filter((entry) => entry.member_kind === omittedKind)
    .forEach((entry) => {
      entry.member_kind = replacementKind;
    });
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
