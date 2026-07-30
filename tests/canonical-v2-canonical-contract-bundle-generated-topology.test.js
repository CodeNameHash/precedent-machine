const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('../lib/canonical-v2/canonical-contract-bundle-current-root');
const {
  compileCanonicalContractBundleGeneratedTopology,
  compileGovernedTopologyInputs,
  validateCanonicalGeneratedContractBundleMember,
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-generated-topology'
);
const GOVERNANCE = require(
  '../contracts/canonical-v2/generated-topology-inputs/governance/generated-topology-governance.v1.json'
);
const METSERA_FIXTURES = require(
  '../contracts/canonical-v2/generated-topology-inputs/query-golden-fixtures/metsera-process-query-goldens.v1.json'
);
const QXO_FIXTURES = require(
  '../contracts/canonical-v2/generated-topology-inputs/query-golden-fixtures/qxo-capitalisation-query-goldens.v1.json'
);

const ROOT = path.resolve(__dirname, '..', 'contracts/canonical-v2/successor');

function fixture() {
  const inputCompilation = compileCanonicalContractInput({
    root_directory: ROOT,
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: inputCompilation,
  });
  const bundleCompilation = compileCanonicalContractBundle({
    canonical_contract_input_compilation: inputCompilation,
    classification_registry:
      proposal.registry_assembly.classification_registry,
    dependency_registry:
      proposal.registry_assembly.dependency_registry,
    governed_registry_bindings:
      proposal.registry_assembly.governed_registry_bindings,
  });
  return { inputCompilation, bundleCompilation };
}

test('builds the complete generated topology deterministically', () => {
  const { inputCompilation, bundleCompilation } = fixture();
  const first = compileCanonicalContractBundleGeneratedTopology({
    canonical_contract_input_compilation: inputCompilation,
    canonical_contract_bundle_compilation: bundleCompilation,
  });
  const second = compileCanonicalContractBundleGeneratedTopology({
    canonical_contract_input_compilation: structuredClone(inputCompilation),
    canonical_contract_bundle_compilation: structuredClone(bundleCompilation),
  });

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    first.final_canonical_contract_bundle.schema_version,
    'CANONICAL_CONTRACT_BUNDLE/V3',
  );
  const governedKinds = new Set(
    first.applicability_eligible_member_kind_producer_registry.ordered_entries
      .map((entry) => entry.universe_member_kind),
  );
  assert.equal(
    first.applicability_reexamination_requirement_definitions.length,
    inputCompilation.authored_members.filter(
      (member) => governedKinds.has(member.object_kind),
    ).length,
  );
  assert.equal(
    first.applicability_eligible_member_kind_producer_registry
      .ordered_entries.length,
    governedKinds.size,
  );
  assert.equal(first.query_golden_suite_manifest.fixture_count, 7);
  assert.equal(
    first.query_golden_suite_manifest.validation_roots
      .uncovered_template.length,
    0,
  );
  assert.equal(
    first.global_mutable_authority_registry.ordered_authority_entries.length,
    0,
  );
  assert.equal(
    first.global_mutable_authority_registry.governed_non_mutable_exclusions.length,
    19,
  );
  assert.equal(first.generated_lock_plan_registry.ordered_lock_plans.length, 0);
  assert.equal(
    first.generated_lock_plan_registry.empty_plan_proof
      .admitted_mutable_authority_count,
    0,
  );
  assert.equal(first.semantic_stage_registry.stage_count, 5);
  first.generated_contract_bundle_members.forEach((member) => assert.equal(
    validateCanonicalGeneratedContractBundleMember(member),
    true,
  ));
  assert.equal(
    first.generated_output_manifest.output_count,
    first.generated_output_manifest.ordered_outputs.length,
  );
  assert.equal(
    new Set(first.generated_output_manifest.ordered_outputs.map(
      (entry) => `${entry.object_type}:${entry.generated_id}`,
    )).size,
    first.generated_output_manifest.output_count,
  );
  assert.deepEqual(
    first.generated_output_manifest.validation_roots,
    {
      missing: [],
      extra: [],
      duplicate: [],
      conflicting: [],
      unresolved: [],
    },
  );
  assert.equal(first.disposition.freeze_authority, 'NONE');
  assert.equal(first.disposition.production_authority, 'NONE');
  assert.equal(Object.isFrozen(first), true);
});

test('keeps generated member validation closed at the topology boundary', () => {
  const { inputCompilation, bundleCompilation } = fixture();
  const topology = compileCanonicalContractBundleGeneratedTopology({
    canonical_contract_input_compilation: inputCompilation,
    canonical_contract_bundle_compilation: bundleCompilation,
  });
  const validMember = topology.generated_contract_bundle_members[0];
  const extraField = structuredClone(validMember);
  extraField.hostile_authority = true;
  assert.throws(
    () => validateCanonicalGeneratedContractBundleMember(extraField),
    (error) => error.code === 'INVALID_GENERATED_CONTRACT_BUNDLE_MEMBER',
  );

  const substitutedBytes = structuredClone(validMember);
  const source = JSON.parse(
    Buffer.from(substitutedBytes.source_bytes_base64, 'base64').toString('utf8'),
  );
  source.hostile_substitution = true;
  substitutedBytes.source_bytes_base64 =
    Buffer.from(canonicalJson(source), 'utf8').toString('base64');
  assert.throws(
    () => validateCanonicalGeneratedContractBundleMember(substitutedBytes),
    (error) => error.code === 'INVALID_GENERATED_CONTRACT_BUNDLE_MEMBER',
  );
});

test('binds the final fingerprint to every generated output', () => {
  const { inputCompilation, bundleCompilation } = fixture();
  const first = compileCanonicalContractBundleGeneratedTopology({
    canonical_contract_input_compilation: inputCompilation,
    canonical_contract_bundle_compilation: bundleCompilation,
  });
  const changedInput = structuredClone(inputCompilation);
  const queryMember = changedInput.authored_members.find(
    (member) => /QUERY/u.test(member.object_kind),
  );
  queryMember.canonical_value.hostile_nested_authority = true;
  assert.throws(
    () => compileCanonicalContractBundleGeneratedTopology({
      canonical_contract_input_compilation: changedInput,
      canonical_contract_bundle_compilation: bundleCompilation,
    }),
    (error) => (
      error.name === 'CanonicalContractBundleGeneratedTopologyError'
      && error.code === 'GENERATED_TOPOLOGY_AUTHORED_MEMBER_DRIFT'
    ),
  );
  assert.match(
    first.final_canonical_contract_bundle.canonical_contract_bundle_fingerprint,
    /^[a-f0-9]{64}$/,
  );
  const finalPayload = structuredClone(first.final_canonical_contract_bundle);
  delete finalPayload.canonical_contract_bundle_id;
  delete finalPayload.canonical_contract_bundle_fingerprint;
  assert.equal(
    first.final_canonical_contract_bundle.canonical_contract_bundle_fingerprint,
    contentId('CANONICAL_CONTRACT_BUNDLE/V3', finalPayload),
  );
});

test('rejects a bundle compiled from a different authored input identity', () => {
  const { inputCompilation, bundleCompilation } = fixture();
  const changed = structuredClone(inputCompilation);
  changed.canonical_bundle_input_identity.canonical_bundle_input_identity_id =
    'a'.repeat(64);
  assert.throws(
    () => compileCanonicalContractBundleGeneratedTopology({
      canonical_contract_input_compilation: changed,
      canonical_contract_bundle_compilation: bundleCompilation,
    }),
    (error) => (
      error.name === 'CanonicalContractBundleGeneratedTopologyError'
      && error.code === 'GENERATED_TOPOLOGY_BUNDLE_INPUT_MISMATCH'
    ),
  );
});

test('rejects incomplete golden coverage and duplicate applicability governance', () => {
  const missingFixtureSet = structuredClone(METSERA_FIXTURES);
  missingFixtureSet.fixtures = missingFixtureSet.fixtures.filter(
    (fixture) => fixture.refusal_class !== 'TYPED_UNSUPPORTED',
  );
  assert.throws(
    () => compileGovernedTopologyInputs({
      governance: structuredClone(GOVERNANCE),
      fixture_sets: [missingFixtureSet, structuredClone(QXO_FIXTURES)],
    }),
    (error) => error.code === 'INCOMPLETE_QUERY_GOLDEN_COVERAGE',
  );

  const duplicateKind = structuredClone(GOVERNANCE);
  duplicateKind.definition.applicability_kind_rules.push(
    structuredClone(duplicateKind.definition.applicability_kind_rules[0]),
  );
  assert.throws(
    () => compileGovernedTopologyInputs({
      governance: duplicateKind,
      fixture_sets: [
        structuredClone(METSERA_FIXTURES),
        structuredClone(QXO_FIXTURES),
      ],
    }),
    (error) => error.code === 'INVALID_APPLICABILITY_KIND_GOVERNANCE',
  );
});

test('rejects authority escalation in governed topology inputs', () => {
  const escalated = structuredClone(GOVERNANCE);
  escalated.definition.authority_contract.writer_authority = 'GRANTED';
  assert.throws(
    () => compileGovernedTopologyInputs({
      governance: escalated,
      fixture_sets: [
        structuredClone(METSERA_FIXTURES),
        structuredClone(QXO_FIXTURES),
      ],
    }),
    (error) => error.code === 'GENERATED_TOPOLOGY_AUTHORITY_ESCALATION',
  );
});
