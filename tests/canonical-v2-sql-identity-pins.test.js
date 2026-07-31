const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildLandosCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/landos-candidate-release');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  assembleCanonicalContractBundleCurrentRootProposal,
} = require('../lib/canonical-v2/canonical-contract-bundle-current-root');
const {
  compileCanonicalContractBundle,
} = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
const {
  buildFixtureCandidateRelease,
} = require('../lib/canonical-v2/candidate-release');
const {
  compilePilotProductAuthorityContext,
} = require('../lib/canonical-v2/pilot-product-authority-context');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');

const ROOT = path.resolve(__dirname, '..');
const SQL_FILES = [
  'supabase/canonical-v2-foundation.sql',
  'supabase/canonical-v2-product-candidate-result-writer.sql',
  'sql/optionA/step0b-canonical-writer-by-contract.sql',
];

function buildCombinedPilotBaseRelease() {
  const fixture = buildLandosCandidateReleaseFixture();
  return buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest:
        QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: fixture.members,
    source_specific_members: fixture.sourceSpecificMembers,
    validated_semantic_graphs: fixture.validatedSemanticGraphs,
    correction_authority_selection:
      fixture.correctionAuthoritySelection,
    deal_directory_entries: fixture.dealDirectoryEntries,
  });
}

function currentProductAuthority(candidateReleaseManifest) {
  const canonicalContractInputCompilation = compileCanonicalContractInput({
    root_directory: path.resolve(ROOT, 'contracts/canonical-v2/successor'),
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
  });
  const compiledContractBundle = compileCanonicalContractBundle({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    classification_registry: proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
  });
  const input = {
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    compiled_contract_bundle: compiledContractBundle,
    candidate_release_manifest: candidateReleaseManifest,
  };
  return {
    input,
    context: compilePilotProductAuthorityContext(input),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('SQL identity pins equal the current JavaScript compiler identities', () => {
  const combinedPilotBaseRelease = buildCombinedPilotBaseRelease();
  const productAuthority = currentProductAuthority(
    combinedPilotBaseRelease.manifest,
  );
  const inputCompilation =
    productAuthority.input.canonical_contract_input_compilation;
  const compiledBundle = productAuthority.input.compiled_contract_bundle;
  const bundleInputIdentity =
    inputCompilation.canonical_bundle_input_identity;
  const authorityContext = productAuthority.context;
  const pins = [
    {
      field: 'contract_bundle_id',
      qualifiedField: "b->>'contract_bundle_id'",
      correctValue: compiledBundle.contract_bundle_id,
    },
    {
      field: 'contract_bundle_digest',
      qualifiedField: "b->>'contract_bundle_digest'",
      correctValue: compiledBundle.contract_bundle_digest,
    },
    {
      field: 'canonical_payload_digest',
      qualifiedField: "b->>'canonical_payload_digest'",
      correctValue: compiledBundle.canonical_payload_digest,
    },
    {
      field: 'root_input_manifest_id',
      qualifiedField: "i->'canonical_contract_input_compilation'->'canonical_bundle_input_identity'->>'root_input_manifest_id'",
      correctValue: bundleInputIdentity.root_input_manifest_id,
    },
    {
      field: 'root_input_manifest_payload_digest',
      qualifiedField: "i->'canonical_contract_input_compilation'->'canonical_bundle_input_identity'->>'root_input_manifest_payload_digest'",
      correctValue: bundleInputIdentity.root_input_manifest_payload_digest,
    },
    {
      field: 'authority_context_id',
      qualifiedField: "c->>'authority_context_id'",
      correctValue: authorityContext.authority_context_id,
    },
    {
      field: 'approved_pm_data_version_id',
      qualifiedField: "c->>'approved_pm_data_version_id'",
      correctValue: authorityContext.approved_pm_data_version_id,
    },
  ];

  for (const sqlFile of SQL_FILES) {
    const sql = fs.readFileSync(path.resolve(ROOT, sqlFile), 'utf8');
    for (const pin of pins) {
      if (!sql.includes(pin.qualifiedField)) continue;
      const pinPattern = new RegExp(
        `${escapeRegExp(pin.qualifiedField)}\\s+IS\\s+DISTINCT\\s+FROM\\s+'([a-f0-9]{64})'`,
        'g',
      );
      const matches = [...sql.matchAll(pinPattern)];
      if (matches.length === 0) {
        assert.fail(
          `${sqlFile}: ${pin.field} is present but is not immediately followed by IS DISTINCT FROM and a 64-character lowercase hexadecimal literal`,
        );
      }
      for (const match of matches) {
        const pinnedValue = match[1];
        assert.equal(
          pinnedValue,
          pin.correctValue,
          `${sqlFile}: ${pin.field} is stale: pinned ${pinnedValue}, correct ${pin.correctValue}`,
        );
      }
    }
  }
});
