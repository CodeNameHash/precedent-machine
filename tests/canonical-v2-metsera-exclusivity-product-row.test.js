const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
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
  compileMetseraExclusivityProductAdmission,
} = require('../lib/canonical-v2/metsera-exclusivity-product-admission');
const {
  PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
  compilePilotProductAuthorityContext,
} = require('../lib/canonical-v2/pilot-product-authority-context');
const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_ROW_SCHEMA,
  compileMetseraExclusivityProductQueryFromCheckedProcessEvidence,
  compileMetseraExclusivityProductQuery,
  compileMetseraExclusivityProductRow,
} = require('../lib/canonical-v2/metsera-exclusivity-product-row');
const {
  compileMetseraExclusivityProductResultSet,
} = require('../lib/canonical-v2/metsera-exclusivity-product-result-set');
const {
  buildMetseraAuthorityBoundProcessAdmission,
} = require('./fixtures/canonical-v2/metsera-authority-bound-process-admission');
const {
  buildMetseraRealProcessAdmission,
} = require('./fixtures/canonical-v2/metsera-real-process-admission');

const ROOT = path.resolve(__dirname, '../contracts/canonical-v2/successor');

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function authorityInput() {
  const canonicalContractInputCompilation = compileCanonicalContractInput({
    root_directory: ROOT,
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
  const candidateReleaseManifest = clone(
    buildLandosCandidateReleaseFixture().release.manifest,
  );
  candidateReleaseManifest.contract_fingerprint =
    compiledContractBundle.contract_bundle_digest;
  const {
    candidate_release_manifest_id: ignoredId,
    canonical_payload_digest: ignoredDigest,
    ...releaseBody
  } = candidateReleaseManifest;
  candidateReleaseManifest.candidate_release_manifest_id = contentId(
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1',
    releaseBody,
  );
  candidateReleaseManifest.canonical_payload_digest = contentId(
    'FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V1',
    releaseBody,
  );
  return {
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    compiled_contract_bundle: compiledContractBundle,
    candidate_release_manifest: candidateReleaseManifest,
  };
}

function fixture() {
  const input = authorityInput();
  const context = compilePilotProductAuthorityContext(input);
  const processAdmission = buildMetseraRealProcessAdmission({
    authority_context: context,
    authority_input: input,
  });
  const productAdmission = compileMetseraExclusivityProductAdmission({
    process_phrasebook_admission: processAdmission,
  });
  const query = compileMetseraExclusivityProductQuery(
    productAdmission,
    context,
    input,
  );
  return { input, context, productAdmission, query };
}

function rehashContext(value) {
  const { authority_context_id: ignored, ...body } = value;
  value.authority_context_id = contentId(
    PILOT_PRODUCT_AUTHORITY_CONTEXT_SCHEMA,
    body,
  );
  return value;
}

test('fails closed without one exact admitted Metsera result', () => {
  assert.throws(
    () => compileMetseraExclusivityProductRow({}),
    /Process admission state is invalid/,
  );
  assert.equal(METSERA_PRODUCT_ROW_SCHEMA, 'METSERA_EXCLUSIVITY_PRODUCT_ROW/V1');
});

test('derives the Product query from the sealed authority context and checked Process evidence', () => {
  const { input, context, productAdmission, query } = fixture();
  const bridgeQuery = compileMetseraExclusivityProductQueryFromCheckedProcessEvidence({
    checked_process_admission_evidence: {
      result_identity: productAdmission.admission_input.result_identity,
      narration_revision: productAdmission.admission_input.narration_revision,
      predicate_witness_revision:
        productAdmission.admission_input.predicate_witness_revision,
      atomic_response_predicate_witness_revision:
        productAdmission.admission_input.atomic_response_predicate_witness_revision,
      result_input_lineage: productAdmission.admission_input.result_input_lineage,
      matched_passage_preview: productAdmission.admission_input.matched_passage_preview,
      exact_detail_reference: productAdmission.admission_input.exact_detail_reference,
    },
    candidate_release_binding: {
      candidate_release_manifest_id:
        productAdmission.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        productAdmission.candidate_release_manifest_payload_digest,
      corpus_release_id: context.candidate_release_manifest.corpus_release_id,
    },
    pilot_product_authority_context: context,
    pilot_product_authority_input: input,
  });
  assert.deepEqual(bridgeQuery, query);
  const rebuilt = compileMetseraExclusivityProductQuery(
    productAdmission,
    context,
    input,
  );
  assert.deepEqual(rebuilt, query);
  assert.equal(
    query.query_definition_id,
    productAdmission.admission_input.passage_order_projection
      .product_query_definition_id,
  );
  const row = compileMetseraExclusivityProductRow(
    productAdmission,
    context,
    input,
  );
  assert.equal(
    row.product_query_ir.query_definition_id,
    query.query_definition_id,
  );
  assert.equal(
    row.shared_row_adapter_receipt.process_admission_receipt
      .admission_state,
    'VALIDATED_NOT_RELEASE_BOUND',
  );
  assert.equal(
    row.shared_row_adapter_receipt.process_admission_receipt
      .release_membership_state,
    'NOT_RELEASE_BOUND',
  );
  assert.equal(
    row.shared_row_adapter_receipt.adapter_state,
    'VALIDATED_NOT_MATERIALISED',
  );
});

test('rejects a synthetic Process admission that self-asserts a query ID', () => {
  const { context } = fixture();
  const syntheticProcess = buildMetseraAuthorityBoundProcessAdmission({
    authority_context: context,
    product_query_definition_id: contentId(
      'METSERA_PRODUCT_QUERY_CONTEXT_TEST_SUBSTITUTED_QUERY/V1',
      { authority_context_id: context.authority_context_id },
    ),
  });
  assert.throws(
    () => compileMetseraExclusivityProductAdmission(syntheticProcess),
    /exact required fields/,
  );
});

test('rejects a correctly rehashed authority-context substitution', () => {
  const { input, context, productAdmission } = fixture();
  const substituted = clone(context);
  substituted.candidate_release_manifest.corpus_release_id = 'f'.repeat(64);
  rehashContext(substituted);
  assert.throws(
    () => compileMetseraExclusivityProductQueryFromCheckedProcessEvidence({
      checked_process_admission_evidence: {
        result_identity: productAdmission.admission_input.result_identity,
        narration_revision: productAdmission.admission_input.narration_revision,
        predicate_witness_revision:
          productAdmission.admission_input.predicate_witness_revision,
        atomic_response_predicate_witness_revision:
          productAdmission.admission_input.atomic_response_predicate_witness_revision,
        result_input_lineage: productAdmission.admission_input.result_input_lineage,
        matched_passage_preview: productAdmission.admission_input.matched_passage_preview,
        exact_detail_reference: productAdmission.admission_input.exact_detail_reference,
      },
      candidate_release_binding: {
        candidate_release_manifest_id:
          productAdmission.candidate_release_manifest_id,
        candidate_release_manifest_payload_digest:
          productAdmission.candidate_release_manifest_payload_digest,
        corpus_release_id: context.candidate_release_manifest.corpus_release_id,
      },
      pilot_product_authority_context: substituted,
      pilot_product_authority_input: input,
    }),
    /Pilot Product authority context is invalid/,
  );
});

test('rejects an authority-input substitution in the bridge query derivation', () => {
  const { input, context, productAdmission } = fixture();
  const substitutedInput = clone(input);
  substitutedInput.candidate_release_manifest.corpus_release_id = 'f'.repeat(64);
  assert.throws(
    () => compileMetseraExclusivityProductQueryFromCheckedProcessEvidence({
      checked_process_admission_evidence: {
        result_identity: productAdmission.admission_input.result_identity,
        narration_revision: productAdmission.admission_input.narration_revision,
        predicate_witness_revision:
          productAdmission.admission_input.predicate_witness_revision,
        atomic_response_predicate_witness_revision:
          productAdmission.admission_input.atomic_response_predicate_witness_revision,
        result_input_lineage: productAdmission.admission_input.result_input_lineage,
        matched_passage_preview: productAdmission.admission_input.matched_passage_preview,
        exact_detail_reference: productAdmission.admission_input.exact_detail_reference,
      },
      candidate_release_binding: {
        candidate_release_manifest_id:
          productAdmission.candidate_release_manifest_id,
        candidate_release_manifest_payload_digest:
          productAdmission.candidate_release_manifest_payload_digest,
        corpus_release_id: context.candidate_release_manifest.corpus_release_id,
      },
      pilot_product_authority_context: context,
      pilot_product_authority_input: substitutedInput,
    }),
    /Pilot Product authority context is invalid/,
  );
});

test('requires the exact authority context and input during downstream row revalidation', () => {
  const { input, context, productAdmission } = fixture();
  const row = compileMetseraExclusivityProductRow(
    productAdmission,
    context,
    input,
  );
  assert.throws(
    () => compileMetseraExclusivityProductResultSet(
      productAdmission,
      row,
      undefined,
      input,
    ),
    /authority context and input are required/,
  );
  const substituted = clone(context);
  substituted.candidate_release_manifest.corpus_release_id = 'f'.repeat(64);
  rehashContext(substituted);
  assert.throws(
    () => compileMetseraExclusivityProductResultSet(
      productAdmission,
      row,
      substituted,
      input,
    ),
    /Pilot Product authority context is invalid/,
  );
  assert.doesNotThrow(() => compileMetseraExclusivityProductResultSet(
    productAdmission,
    row,
    context,
    input,
  ));
});

test('rejects a correctly rehashed hidden Product-field substitution', () => {
  const { input, context, productAdmission } = fixture();
  const substituted = clone(context);
  substituted.product_query_admission_context.product_field_catalogue
    .field_definitions[0].capabilities.display = false;
  rehashContext(substituted);
  assert.throws(
    () => compileMetseraExclusivityProductQuery(
      productAdmission,
      substituted,
      input,
    ),
    /Pilot Product authority context is invalid/,
  );
});

test('uses the exact authority-context phase boundary', () => {
  const source = fs.readFileSync(
    require.resolve('../lib/canonical-v2/metsera-exclusivity-product-row'),
    'utf8',
  );
  assert.match(source, /validatePilotProductAuthorityContext/);
  assert.match(source, /product_query_admission_context/);
  assert.doesNotMatch(source, /function stableId/);
  assert.doesNotMatch(source, /buildPilotProductFieldCatalogueManifest/);
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-p8-metsera-product-query-context-v1.json',
    ),
    'utf8',
  ));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-metsera-product-query-context-v1.json',
    'lib/canonical-v2/metsera-exclusivity-product-row.js',
    'tests/canonical-v2-metsera-exclusivity-product-row.test.js',
    'tests/fixtures/canonical-v2/metsera-authority-bound-process-admission.js',
  ]);
});
