#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanonicalV2StagingRuntime } from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  buildLandosCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/landos-candidate-release');
const {
  buildFixtureCandidateRelease,
  planActiveReleasePointerSwap,
} = require('../lib/canonical-v2/candidate-release');
const {
  buildCandidateReleaseImportPlan,
} = require('../lib/canonical-v2/candidate-release-import');
const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProductQueryResultReleasePartition,
} = require('../lib/canonical-v2/product-query-result-release-partition');
const {
  buildProductQueryResultServingRecord,
} = require('../lib/canonical-v2/product-query-result-serving-record');
const {
  QUERY_PROJECTION_CONTRACT_DIGEST_V2,
  SERVING_PROJECTION_VERSION_V2,
} = require('../lib/canonical-v2/serving-projection-contract');
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
  compilePilotProductAuthorityContext,
} = require('../lib/canonical-v2/pilot-product-authority-context');
const {
  compileAgreementCandidateProductMaterialisation,
} = require('../lib/canonical-v2/agreement-candidate-product-materialisation');
const {
  buildAgreementCandidateEnvelopeCarrier,
  buildProductCandidateResultWriteEnvelope,
  validateProductCandidateResultWriteSet,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');
const {
  buildCanonicalWriteReceipt,
} = require('../lib/canonical-v2/canonical-writer');
const {
  evaluationEvidence,
  familyInput,
} = require('../tests/fixtures/canonical-v2/agreement-candidate-product-materialisation-inputs');

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function buildRelease() {
  const fixture = buildLandosCandidateReleaseFixture();
  return buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: fixture.members,
    source_specific_members: fixture.sourceSpecificMembers,
    validated_semantic_graphs: fixture.validatedSemanticGraphs,
    correction_authority_selection: fixture.correctionAuthoritySelection,
    deal_directory_entries: fixture.dealDirectoryEntries,
  });
}

function currentProductAuthority(candidateReleaseManifest) {
  const compilation = compileCanonicalContractInput({
    root_directory: resolve(ROOT, 'contracts/canonical-v2/successor'),
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: compilation,
  });
  const bundle = compileCanonicalContractBundle({
    canonical_contract_input_compilation: compilation,
    classification_registry: proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
  });
  const input = {
    canonical_contract_input_compilation: compilation,
    compiled_contract_bundle: bundle,
    candidate_release_manifest: candidateReleaseManifest,
  };
  return { input, context: compilePilotProductAuthorityContext(input) };
}

function buildAgreementWriterOutput(release) {
  const profile = 'IOC_CAPEX_RESTRICTION_V1';
  const currentAuthority = currentProductAuthority(release.manifest);
  const envelopeInput = {
    family_profile_id: profile,
    family_input: familyInput(profile),
  };
  const prepared = evaluationEvidence({
    envelopeInput,
    authorityInput: currentAuthority.input,
    authorityContext: currentAuthority.context,
  });
  const materialisation = compileAgreementCandidateProductMaterialisation({
    agreement_candidate_envelope: prepared.envelopeValue,
    family_input: envelopeInput.family_input,
    pilot_product_authority_context: currentAuthority.context,
    pilot_product_authority_context_input: currentAuthority.input,
    product_evaluation_evidence: prepared.product_evaluation_evidence,
  });
  const envelope = buildProductCandidateResultWriteEnvelope({
    adapter_identifier: 'AGREEMENT_CANDIDATE_ENVELOPE',
    domain_carrier: buildAgreementCandidateEnvelopeCarrier(
      prepared.envelopeValue,
      materialisation,
    ),
  });
  const validation = validateProductCandidateResultWriteSet(envelope);
  const idempotencyKey = 'P8_AGREEMENT_PRODUCT_QUERY_CACHE_V1';
  const inputDigest = buildCanonicalWriteInputDigest({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey,
    writeSet: envelope,
    residuals: [],
    quarantines: [],
  });
  return {
    envelope,
    idempotencyKey,
    inputDigest,
    materialisation,
    record: validation.candidateRecord,
    receipt: buildCanonicalWriteReceipt({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey,
      inputDigest,
      validation,
    }),
  };
}

function main() {
  const runtime = createCanonicalV2StagingRuntime({
    root: ROOT,
    tempPrefix: 'canonical-v2-product-cache-p8-',
    operationLabel: 'P8 Product query cache staging proof',
    bounds: {
      maxSqlBytes: 6 * 1024 * 1024,
      maxProcessBufferBytes: 8 * 1024 * 1024,
      maxResponseBytes: 1024 * 1024,
    },
  });
  const release = buildRelease();
  const agreement = buildAgreementWriterOutput(release);
  const productResult = agreement.materialisation.product_query_result;
  const emptyQueryDefinitionId = contentId(
    'P8_PRODUCT_QUERY_CACHE_EMPTY_QUERY/V1',
    { candidate_manifest_id: release.manifest.candidate_release_manifest_id },
  );
  const candidatePayloadDigest = runtime.runSql(`
    SELECT canonical_v2_staging.payload_digest(${runtime.sqlJson(agreement.record)})
      AS candidate_payload_digest;`, { readOnly: true })[0]?.candidate_payload_digest;
  if (!/^[a-f0-9]{64}$/.test(candidatePayloadDigest || '')) {
    throw new Error('Staging did not produce the candidate payload digest.');
  }
  const servingRecord = buildProductQueryResultServingRecord({
    serving_namespace_id: release.manifest.serving_namespace_id,
    corpus_release_id: release.manifest.corpus_release_id,
    candidate_product_result_id: agreement.record.candidate_product_result_id,
    candidate_product_result_payload_digest: candidatePayloadDigest,
    product_query_result: productResult,
  });
  const partition = buildProductQueryResultReleasePartition({
    candidate_release_manifest: release.manifest,
    product_query_result_serving_records: [servingRecord],
  });
  const plan = buildCandidateReleaseImportPlan({
    release,
    product_result_release_partition: partition,
  });
  const before = runtime.runSql(`
    SELECT pointer.canonical_payload AS pointer,
      pointer.generation,
      (SELECT count(*)::integer FROM canonical_v2_staging.product_query_result_active_page_cache
       WHERE candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)})
        AS local_cache_rows,
      (SELECT count(*)::integer FROM canonical_v2_staging.product_candidate_results
       WHERE candidate_product_result_id = ${runtime.sqlText(agreement.record.candidate_product_result_id)})
        AS local_candidate_rows,
      (SELECT count(*)::integer FROM canonical_v2_staging.product_query_result_release_partitions
       WHERE candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)})
        AS local_partition_rows,
      (SELECT count(*)::integer FROM canonical_v2_staging.product_query_result_serving_records
       WHERE candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)})
        AS local_serving_rows
    FROM canonical_v2_staging.active_corpus_release_pointers pointer
    WHERE pointer.environment = 'staging';`, { readOnly: true })[0];
  if (!before?.pointer || !Number.isInteger(before.generation)
    || before.local_cache_rows !== 0 || before.local_candidate_rows !== 0
    || before.local_partition_rows !== 0 || before.local_serving_rows !== 0) {
    throw new Error('Staging cache proof requires one clean active staging pointer.');
  }
  const pointerSwap = planActiveReleasePointerSwap({
    current_pointer: before.pointer,
    expected_current_pointer_id: before.pointer.pointer_id,
    candidate_manifest: release.manifest,
  });
  const proof = runtime.runSql(`
CREATE TEMP TABLE p8_product_cache_proof (
  empty_page jsonb NOT NULL,
  empty_repeat_page jsonb NOT NULL,
  product_page jsonb NOT NULL,
  product_repeat_page jsonb NOT NULL,
  cache_rows integer NOT NULL,
  exact_source_action text NOT NULL,
  product_cache_hit boolean NOT NULL,
  rls_enabled boolean NOT NULL,
  direct_table_access boolean NOT NULL,
  budget_bindings_present boolean NOT NULL,
  active_generation integer NOT NULL
) ON COMMIT DROP;

DO $p8_product_cache$
DECLARE
  written jsonb;
  imported jsonb;
  activated jsonb;
  first_page jsonb;
  second_page jsonb;
  product_page jsonb;
  product_repeat_page jsonb;
  product_cache_created_at timestamptz;
  product_cache_created_at_after timestamptz;
  cache_row_count integer;
  rls boolean;
  direct_access boolean;
  function_definition text;
  active_generation integer;
BEGIN
  written := public.canonical_v2_write(
    'staging',
    'PRODUCT_RESULT_CANDIDATE_RUN',
    ${runtime.sqlText(agreement.idempotencyKey)},
    ${runtime.sqlText(agreement.inputDigest)},
    ${runtime.sqlJson(agreement.envelope)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${runtime.sqlJson(agreement.receipt)}
  );
  imported := public.canonical_v2_import_candidate_release('staging', ${runtime.sqlJson(plan)});
  activated := public.canonical_v2_activate_candidate_release(
    'staging', ${runtime.sqlJson(before.pointer)}, ${runtime.sqlJson(pointerSwap.next_pointer)});
  first_page := public.canonical_v2_active_product_query_results(
    'staging', ${runtime.sqlText(release.manifest.serving_namespace_id)},
    ${runtime.sqlText(release.manifest.corpus_release_id)},
    ${runtime.sqlText(emptyQueryDefinitionId)}, NULL, 20);
  second_page := public.canonical_v2_active_product_query_results(
    'staging', ${runtime.sqlText(release.manifest.serving_namespace_id)},
    ${runtime.sqlText(release.manifest.corpus_release_id)},
    ${runtime.sqlText(emptyQueryDefinitionId)}, NULL, 20);
  product_page := public.canonical_v2_active_product_query_results(
    'staging', ${runtime.sqlText(release.manifest.serving_namespace_id)},
    ${runtime.sqlText(release.manifest.corpus_release_id)},
    ${runtime.sqlText(productResult.product_query_definition_id)}, NULL, 20);
  SELECT created_at INTO product_cache_created_at
  FROM canonical_v2_staging.product_query_result_active_page_cache cache
  WHERE cache.candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)}
    AND cache.product_query_definition_id = ${runtime.sqlText(productResult.product_query_definition_id)}
    AND cache.page_size = 20 AND cache.after_product_query_result_identity = '';
  product_repeat_page := public.canonical_v2_active_product_query_results(
    'staging', ${runtime.sqlText(release.manifest.serving_namespace_id)},
    ${runtime.sqlText(release.manifest.corpus_release_id)},
    ${runtime.sqlText(productResult.product_query_definition_id)}, NULL, 20);
  SELECT created_at INTO product_cache_created_at_after
  FROM canonical_v2_staging.product_query_result_active_page_cache cache
  WHERE cache.candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)}
    AND cache.product_query_definition_id = ${runtime.sqlText(productResult.product_query_definition_id)}
    AND cache.page_size = 20 AND cache.after_product_query_result_identity = '';
  SELECT count(*)::integer INTO cache_row_count
  FROM canonical_v2_staging.product_query_result_active_page_cache cache
  WHERE cache.candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)}
    AND cache.page_size = 20 AND cache.after_product_query_result_identity = '';
  SELECT relrowsecurity INTO rls FROM pg_class
  WHERE oid = 'canonical_v2_staging.product_query_result_active_page_cache'::regclass;
  SELECT has_table_privilege('canonical_v2_serving',
    'canonical_v2_staging.product_query_result_active_page_cache', 'SELECT,INSERT,UPDATE,DELETE') INTO direct_access;
  SELECT pg_get_functiondef('public.canonical_v2_active_product_query_results(text,text,text,text,text,integer)'::regprocedure)
    INTO function_definition;
  SELECT generation INTO active_generation FROM canonical_v2_staging.active_corpus_release_pointers
  WHERE environment = 'staging';
  IF written->>'replayed' IS DISTINCT FROM 'false'
    OR imported->>'import_state' IS DISTINCT FROM 'IMPORTED_COMPLETE'
    OR activated IS DISTINCT FROM ${runtime.sqlJson(pointerSwap.next_pointer)}
    OR first_page IS DISTINCT FROM second_page
    OR first_page->'rows' IS DISTINCT FROM '[]'::jsonb
    OR first_page->>'page_count' IS DISTINCT FROM '0'
    OR first_page->>'has_more' IS DISTINCT FROM 'false'
    OR first_page->'next_after_product_query_result_identity' IS DISTINCT FROM 'null'::jsonb
    OR product_page IS DISTINCT FROM product_repeat_page
    OR product_page->>'page_count' IS DISTINCT FROM '1'
    OR jsonb_array_length(product_page->'rows') <> 1
    OR product_page #>> '{rows,0,product_query_result_identity}'
      IS DISTINCT FROM ${runtime.sqlText(productResult.product_query_result_identity)}
    OR product_page #>> '{rows,0,candidate_product_result_id}'
      IS DISTINCT FROM ${runtime.sqlText(agreement.record.candidate_product_result_id)}
    OR product_page #>> '{rows,0,canonical_payload,exact_detail_action}'
      IS DISTINCT FROM ${runtime.sqlText(productResult.exact_detail_action)}
    OR product_cache_created_at IS NULL
    OR product_cache_created_at_after IS DISTINCT FROM product_cache_created_at
    OR cache_row_count <> 2 OR rls IS DISTINCT FROM true OR direct_access IS DISTINCT FROM false
    OR function_definition NOT LIKE '%SET search_path TO ''pg_catalog'', ''canonical_v2_staging''%'
    OR function_definition NOT LIKE '%SET statement_timeout TO ''2500ms''%'
    OR function_definition NOT LIKE '%maximum_admission_database_calls'', 1%'
    OR function_definition NOT LIKE '%maximum_route_serving_database_calls'', 1%'
    OR function_definition NOT LIKE '%maximum_page_size'', 50%'
    OR function_definition NOT LIKE '%maximum_database_rows_per_request'', 51%'
    OR function_definition NOT LIKE '%maximum_value_ttl_seconds'', 3600%'
    OR function_definition NOT LIKE '%maximum_cached_value_bytes'', 1048576%'
    OR active_generation IS DISTINCT FROM ${before.generation + 1}
  THEN RAISE EXCEPTION 'P8 Product query cache proof failed closed'; END IF;
  INSERT INTO p8_product_cache_proof
  VALUES (first_page, second_page, product_page, product_repeat_page,
    cache_row_count, ${runtime.sqlText(productResult.exact_detail_action)},
    product_cache_created_at_after = product_cache_created_at, rls, direct_access,
    function_definition LIKE '%maximum_cached_value_bytes'', 1048576%', active_generation);
END
$p8_product_cache$;

SELECT * FROM p8_product_cache_proof;
`)[0];
  const after = runtime.runSql(`
    SELECT pointer.canonical_payload AS pointer,
      pointer.generation,
      (SELECT count(*)::integer FROM canonical_v2_staging.product_query_result_active_page_cache
       WHERE candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)})
        AS local_cache_rows,
      (SELECT count(*)::integer FROM canonical_v2_staging.product_candidate_results
       WHERE candidate_product_result_id = ${runtime.sqlText(agreement.record.candidate_product_result_id)})
        AS local_candidate_rows,
      (SELECT count(*)::integer FROM canonical_v2_staging.product_query_result_release_partitions
       WHERE candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)})
        AS local_partition_rows,
      (SELECT count(*)::integer FROM canonical_v2_staging.product_query_result_serving_records
       WHERE candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)})
        AS local_serving_rows
    FROM canonical_v2_staging.active_corpus_release_pointers pointer
    WHERE pointer.environment = 'staging';`, { readOnly: true })[0];
  if (!proof || canonicalJson(before) !== canonicalJson(after)
    || proof.cache_rows !== 2
    || proof.exact_source_action !== productResult.exact_detail_action
    || proof.product_cache_hit !== true || proof.rls_enabled !== true
    || proof.direct_table_access !== false || proof.budget_bindings_present !== true) {
    throw new Error('P8 Product query cache proof left durable staging state.');
  }
  process.stdout.write(`${JSON.stringify({
    schema_version: 'P8_PRODUCT_QUERY_CACHE_STAGING_PROOF/V1',
    project_ref: 'sjumbznveyyiizhwvixj',
    proof_state: 'PASS',
    empty_page_cached: true,
    nonempty_product_page_cached: true,
    exact_source_action: proof.exact_source_action,
    product_cache_hit: proof.product_cache_hit,
    exact_repeat_equal: true,
    transaction_cache_rows: proof.cache_rows,
    rollback_cache_rows: after.local_cache_rows,
    rollback_candidate_rows: after.local_candidate_rows,
    rollback_partition_rows: after.local_partition_rows,
    rollback_serving_rows: after.local_serving_rows,
    active_pointer_generation: after.generation,
    active_pointer_generation_unchanged: true,
    durable_state_unchanged: true,
  })}\n`);
}

main();
