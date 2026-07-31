const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
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
  buildLandosCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/landos-candidate-release');
const {
  AUTHORITY_LIMITS,
  PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
  PilotProductAuthorityContextError,
  compilePilotProductAuthorityContext,
  validatePilotProductAuthorityContext,
} = require('../lib/canonical-v2/pilot-product-authority-context');

const ROOT = path.resolve(__dirname, '../contracts/canonical-v2/successor');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compileBundle() {
  const input = compileCanonicalContractInput({ root_directory: ROOT });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: input,
  });
  return {
    input,
    bundle: compileCanonicalContractBundle({
      canonical_contract_input_compilation: input,
      classification_registry: proposal.registry_assembly.classification_registry,
      dependency_registry: proposal.registry_assembly.dependency_registry,
      governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
    }),
  };
}

function releaseFor(bundle) {
  const manifest = clone(buildLandosCandidateReleaseFixture().release.manifest);
  manifest.contract_fingerprint = bundle.contract_bundle_digest;
  const { candidate_release_manifest_id: ignoredId, canonical_payload_digest: ignoredDigest, ...body } = manifest;
  manifest.candidate_release_manifest_id = contentId(
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1',
    body,
  );
  manifest.canonical_payload_digest = contentId(
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
    body,
  );
  return manifest;
}

function fixture() {
  const { input, bundle } = compileBundle();
  return {
    canonical_contract_input_compilation: input,
    compiled_contract_bundle: bundle,
    candidate_release_manifest: releaseFor(bundle),
  };
}

function assertCode(code, operation) {
  assert.throws(operation, (error) => {
    assert.equal(error.name, 'PilotProductAuthorityContextError');
    assert.equal(error.code, code);
    return true;
  });
}

test('builds one closed authority context from the exact current root and candidate release', () => {
  const input = fixture();
  const context = compilePilotProductAuthorityContext(input);
  assert.equal(context.schema_version, PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA);
  assert.equal(context.canonical_contract_bundle.contract_bundle_id, input.compiled_contract_bundle.contract_bundle_id);
  assert.equal(context.candidate_release_manifest.candidate_release_manifest_id, input.candidate_release_manifest.candidate_release_manifest_id);
  assert.deepEqual(
    context.predicate_admissions.map((entry) => entry.predicate_key).sort(),
    [
      'EXCLUSIVITY_GRANTED',
      'TARGET_CAPEX_RESTRICTION',
      'TARGET_CAPITALISATION_BRING_DOWN',
    ],
  );
  assert.match(context.approved_pm_data_version_id, /^[a-f0-9]{64}$/);
  assert.match(
    context.predicate_catalogue_bindings[0].source_payload_digest,
    /^[a-f0-9]{64}$/,
  );
  assert.deepEqual(
    context.product_query_admission_context.predicate_admissions,
    context.predicate_admissions,
  );
  assert.equal(
    context.product_query_admission_context.exact_detail_actions
      .includes('RESULT_COMPOSITION_EVIDENCE'),
    true,
  );
  assert.equal(context.product_navigation_catalogue_manifest.counts.admitted_pattern_count, 43);
  assert.equal(context.certification_identities.field_certifications.length > 0, true);
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
  assert.equal(validatePilotProductAuthorityContext(context, input), true);
  assert.equal(Object.isFrozen(context), true);
});

test('rejects changed release identity and changed compiled bundle', () => {
  const input = fixture();
  input.candidate_release_manifest.contract_fingerprint = 'f'.repeat(64);
  assertCode(
    'INVALID_CANDIDATE_RELEASE_MANIFEST',
    () => compilePilotProductAuthorityContext(input),
  );

  const changed = fixture();
  changed.compiled_contract_bundle = clone(changed.compiled_contract_bundle);
  changed.compiled_contract_bundle.contract_bundle_id = 'f'.repeat(64);
  assertCode('INVALID_COMPILED_BUNDLE_METADATA', () => compilePilotProductAuthorityContext(changed));
});

test('rejects rehashed catalogue drift, cross-release drift and derived PM-data drift', () => {
  const input = fixture();
  const context = compilePilotProductAuthorityContext(input);

  const rehashed = clone(context);
  rehashed.product_navigation_catalogue_manifest.navigation_definition.domains[0].label = 'Changed';
  assertCode('PILOT_PRODUCT_AUTHORITY_CONTEXT_DRIFT', () => (
    validatePilotProductAuthorityContext(rehashed, input)
  ));

  const crossRelease = clone(context);
  crossRelease.product_field_catalogue_manifest.candidate_release_manifest_id = 'f'.repeat(64);
  assertCode('PILOT_PRODUCT_AUTHORITY_CONTEXT_DRIFT', () => (
    validatePilotProductAuthorityContext(crossRelease, input)
  ));

  const pmDrift = clone(context);
  pmDrift.approved_pm_data_version_id = 'f'.repeat(64);
  const { authority_context_id: ignoredContextId, ...pmDriftBody } = pmDrift;
  pmDrift.authority_context_id = contentId(
    PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
    pmDriftBody,
  );
  assertCode('PILOT_PRODUCT_AUTHORITY_CONTEXT_DRIFT', () => (
    validatePilotProductAuthorityContext(pmDrift, input)
  ));
});

test('rejects caller-supplied PM authority and navigation digest substitution', () => {
  const callerAuthority = fixture();
  callerAuthority.approved_pm_data_version_id = 'f'.repeat(64);
  assertCode('INVALID_PILOT_PRODUCT_AUTHORITY_CONTEXT_INPUT', () => (
    compilePilotProductAuthorityContext(callerAuthority)
  ));

  const input = fixture();
  const context = compilePilotProductAuthorityContext(input);
  const changed = clone(context);
  changed.predicate_catalogue_bindings[0].source_payload_digest =
    changed.product_navigation_catalogue_manifest.basis.source_bindings
      .find((entry) => entry.source_stable_id === 'PROCESS_NAVIGATION_DEFINITION_CATALOGUE')
      .source_payload_digest;
  const { authority_context_id: ignoredContextId, ...body } = changed;
  changed.authority_context_id = contentId(
    PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
    body,
  );
  assertCode('PILOT_PRODUCT_AUTHORITY_CONTEXT_DRIFT', () => (
    validatePilotProductAuthorityContext(changed, input)
  ));
});
