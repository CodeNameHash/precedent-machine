const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  canonicalJson,
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
} = require(
  '../lib/canonical-v2/canonical-contract-bundle-generated-topology'
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
  assert.equal(
    first.applicability_reexamination_requirement_definitions.length,
    inputCompilation.authored_members.length - 1,
  );
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
