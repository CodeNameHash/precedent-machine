const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  REQUIRED_BUNDLE_KINDS,
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  assembleCanonicalContractBundleFreezeCandidate,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-freeze-candidate-assembler'
);
const {
  NON_DEPENDENCY_REFERENCE_RULES,
  assembleCanonicalContractBundleCurrentRootProposal,
  classifyCanonicalContractMemberReferences,
} = require('../lib/canonical-v2/canonical-contract-bundle-current-root');
const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..', 'contracts/canonical-v2/successor');

function compilation() {
  return compileCanonicalContractInput({ root_directory: ROOT });
}

function compilerInput(proposal, inputCompilation) {
  return {
    canonical_contract_input_compilation: inputCompilation,
    classification_registry:
      proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings:
      proposal.registry_assembly.governed_registry_bindings,
  };
}

function assertProposalError(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(error.name, 'CanonicalContractBundleCurrentRootError');
    assert.equal(error.code, code);
    return true;
  });
}

test('assembles the exact current 171-member root into all eight categories', () => {
  const inputCompilation = compilation();
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: inputCompilation,
  });
  const compiled = compileCanonicalContractBundle(
    compilerInput(proposal, inputCompilation),
  );

  assert.equal(proposal.proposed_dispositions.length, 171);
  assert.equal(proposal.dependency_edge_count, 276);
  assert.equal(proposal.non_dependency_reference_dispositions.length, 18);
  assert.deepEqual(
    [...new Set(proposal.non_dependency_reference_dispositions.map(
      (entry) => entry.rule_id,
    ))].sort(),
    NON_DEPENDENCY_REFERENCE_RULES.map((rule) => rule.rule_id).sort(),
  );
  assert.equal(
    proposal.non_dependency_reference_dispositions.every((entry) => (
      entry.direction === 'TARGET_DEPENDS_ON_SOURCE'
      && entry.reference_paths.length > 0
      && entry.reverse_reference_paths.length > 0
    )),
    true,
  );
  assert.deepEqual(
    Object.keys(proposal.classification_counts),
    [...REQUIRED_BUNDLE_KINDS].sort(),
  );
  assert.equal(compiled.compile_report.status, 'PASS');
  assert.equal(compiled.compile_report.missing_member_count, 0);
  assert.equal(compiled.compile_report.extra_member_count, 0);
  assert.equal(compiled.compile_report.duplicate_identity_count, 0);
  assert.equal(compiled.compile_report.conflict_count, 0);
  assert.equal(compiled.dependency_cycle_report.unresolved_dependency_count, 0);
  assert.equal(compiled.dependency_cycle_report.cycle_count, 0);
  assert.equal(proposal.disposition.state, 'PROPOSED_FOR_EXACT_ROOT_REVIEW');
  assert.equal(proposal.disposition.stage_4_review, 'NOT_SUPPLIED');
  assert.equal(proposal.disposition.freeze_authority, 'NONE');
  assert.equal(Object.isFrozen(proposal.proposed_dispositions), true);
  assert.equal(Object.isFrozen(proposal.registry_assembly), true);
});

test('produces identical canonical bytes and fingerprint in two clean compiles', () => {
  const firstCompilation = compilation();
  const secondCompilation = compilation();
  const firstProposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: firstCompilation,
  });
  const secondProposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: secondCompilation,
  });
  assert.equal(canonicalJson(firstProposal), canonicalJson(secondProposal));

  const freezeCandidate =
    assembleCanonicalContractBundleFreezeCandidate({
      ...compilerInput(firstProposal, firstCompilation),
      frozen_contract_pair_digest: 'f'.repeat(64),
    });
  assert.equal(freezeCandidate.determinism_report.compile_run_count, 2);
  assert.equal(freezeCandidate.determinism_report.mismatch_count, 0);
  assert.equal(
    freezeCandidate.determinism_report.first_compilation_payload_digest,
    freezeCandidate.determinism_report.second_compilation_payload_digest,
  );
  assert.equal(freezeCandidate.canonical_contract_bundle_members.length, 8);
  assert.equal(freezeCandidate.disposition.freeze_authority, 'NONE');
});

test('blocks an unclassified input instead of placing it in a default category', () => {
  const inputCompilation = structuredClone(compilation());
  const member = inputCompilation.authored_members.find(
    (entry) => entry.object_kind !==
      'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY',
  );
  member.object_kind = 'UNKNOWN_NEW_CONTRACT_INPUT';
  member.canonical_value.object_kind = 'UNKNOWN_NEW_CONTRACT_INPUT';
  assertProposalError(
    'UNCLASSIFIED_CANONICAL_CONTRACT_INPUT',
    () => assembleCanonicalContractBundleCurrentRootProposal({
      canonical_contract_input_compilation: inputCompilation,
    }),
  );
});

test('blocks an ambiguous stable-ID dependency instead of choosing a near contract', () => {
  const inputCompilation = structuredClone(compilation());
  const source = inputCompilation.authored_members.find(
    (member) => member.stable_id === 'CLAIM_INTERPRETATION_POLICY',
  );
  source.canonical_value.ambiguous_reference =
    'REPRESENTATION_ACCURACY_STANDARD';
  assertProposalError(
    'AMBIGUOUS_CANONICAL_CONTRACT_REFERENCE',
    () => assembleCanonicalContractBundleCurrentRootProposal({
      canonical_contract_input_compilation: inputCompilation,
    }),
  );
});

test('blocks a declared reverse link if the target dependency binding is absent', () => {
  const inputCompilation = structuredClone(compilation());
  const event = inputCompilation.authored_members.find(
    (member) => member.relative_path ===
      'process/events/process-event.v1.json',
  );
  event.canonical_value.definition.composition_contract
    .event_slot_binding_definition_stable_id = 'MISSING_SLOT_BINDING';
  assertProposalError(
    'INVALID_NON_DEPENDENCY_REFERENCE_DIRECTION',
    () => assembleCanonicalContractBundleCurrentRootProposal({
      canonical_contract_input_compilation: inputCompilation,
    }),
  );
});

test('does not suppress an unlisted reference between a declared reverse-link pair', () => {
  const inputCompilation = structuredClone(compilation());
  const slot = inputCompilation.authored_members.find(
    (member) => member.relative_path ===
      'process/occurrence-slots/process-event.v1.json',
  );
  slot.canonical_value.definition.unreviewed_dependency = 'PROCESS_EVENT';
  const membersByStableId = new Map();
  for (const member of inputCompilation.authored_members) {
    const members = membersByStableId.get(member.stable_id) || [];
    members.push(member);
    membersByStableId.set(member.stable_id, members);
  }
  const references = classifyCanonicalContractMemberReferences(
    slot,
    membersByStableId,
  );
  assert.equal(
    references.dependencies.some(
      (identity) => identity.relative_path ===
        'process/events/process-event.v1.json',
    ),
    true,
  );
});
