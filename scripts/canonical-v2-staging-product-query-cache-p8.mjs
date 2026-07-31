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
const metseraFixture = require('../__fixtures__/canonical-v2/metsera-exclusivity-p8.json');
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

function buildProductResult(release) {
  const result = clone(metseraFixture.shared_result);
  result.candidate_release_manifest_id = release.manifest.candidate_release_manifest_id;
  result.candidate_release_manifest_payload_digest = release.manifest.canonical_payload_digest;
  result.product_query_result_identity = contentId('PRODUCT_QUERY_RESULT/V1', {
    schema_version: result.schema_version,
    product_query_definition_id: result.product_query_definition_id,
    approved_pm_data_version_id: result.approved_pm_data_version_id,
    candidate_release_manifest_id: result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest: result.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition_stable_id: result.domain_result_definition.stable_id,
    domain_result_definition_version: result.domain_result_definition.version,
    domain_result_identity: result.domain_result_identity,
  });
  result.exact_citation.citation_target_identity = contentId(
    result.exact_citation.schema_version,
    {
      product_query_result_identity: result.product_query_result_identity,
      candidate_release_manifest_id: result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest: result.candidate_release_manifest_payload_digest,
      source_document_identity: result.exact_citation.source_document_identity,
      source_evidence_identity: result.exact_citation.source_evidence_identity,
    },
  );
  return result;
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
  const productResult = buildProductResult(release);
  const emptyQueryDefinitionId = contentId(
    'P8_PRODUCT_QUERY_CACHE_EMPTY_QUERY/V1',
    { candidate_manifest_id: release.manifest.candidate_release_manifest_id },
  );
  const candidatePayload = {
    schema_version: 'PRODUCT_CANDIDATE_RESULT_IMPORT_PROOF/V1',
    product_row: { shared_row_adapter_receipt: { product_query_result: productResult } },
  };
  const candidateProductResultId = contentId(
    'PRODUCT_CANDIDATE_RESULT_RECORD/V1', candidatePayload,
  );
  const candidatePayloadDigest = runtime.runSql(`
    SELECT canonical_v2_staging.payload_digest(${runtime.sqlJson(candidatePayload)})
      AS candidate_payload_digest;`, { readOnly: true })[0]?.candidate_payload_digest;
  if (!/^[a-f0-9]{64}$/.test(candidatePayloadDigest || '')) {
    throw new Error('Staging did not produce the candidate payload digest.');
  }
  const servingRecord = buildProductQueryResultServingRecord({
    serving_namespace_id: release.manifest.serving_namespace_id,
    corpus_release_id: release.manifest.corpus_release_id,
    candidate_product_result_id: candidateProductResultId,
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
        AS local_cache_rows
    FROM canonical_v2_staging.active_corpus_release_pointers pointer
    WHERE pointer.environment = 'staging';`, { readOnly: true })[0];
  if (!before?.pointer || !Number.isInteger(before.generation) || before.local_cache_rows !== 0) {
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
  repeat_page jsonb NOT NULL,
  cache_rows integer NOT NULL,
  rls_enabled boolean NOT NULL,
  direct_table_access boolean NOT NULL,
  budget_bindings_present boolean NOT NULL,
  active_generation integer NOT NULL
) ON COMMIT DROP;

INSERT INTO canonical_v2_staging.product_candidate_results(
  candidate_product_result_id, candidate_release_manifest_id, corpus_release_id,
  product_query_result_identity, domain_result_identity, candidate_state, canonical_payload
) VALUES (
  ${runtime.sqlText(candidateProductResultId)},
  ${runtime.sqlText(release.manifest.candidate_release_manifest_id)},
  ${runtime.sqlText(release.manifest.corpus_release_id)},
  ${runtime.sqlText(productResult.product_query_result_identity)},
  ${runtime.sqlText(productResult.domain_result_identity)},
  'CANDIDATE_NOT_ACTIVE', ${runtime.sqlJson(candidatePayload)}
);

DO $p8_product_cache$
DECLARE
  imported jsonb;
  activated jsonb;
  first_page jsonb;
  second_page jsonb;
  cache_row_count integer;
  rls boolean;
  direct_access boolean;
  function_definition text;
  active_generation integer;
BEGIN
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
  SELECT count(*)::integer INTO cache_row_count
  FROM canonical_v2_staging.product_query_result_active_page_cache cache
  WHERE cache.candidate_manifest_id = ${runtime.sqlText(release.manifest.candidate_release_manifest_id)}
    AND cache.product_query_definition_id = ${runtime.sqlText(emptyQueryDefinitionId)}
    AND cache.page_size = 20 AND cache.after_product_query_result_identity = '';
  SELECT relrowsecurity INTO rls FROM pg_class
  WHERE oid = 'canonical_v2_staging.product_query_result_active_page_cache'::regclass;
  SELECT has_table_privilege('canonical_v2_serving',
    'canonical_v2_staging.product_query_result_active_page_cache', 'SELECT,INSERT,UPDATE,DELETE') INTO direct_access;
  SELECT pg_get_functiondef('public.canonical_v2_active_product_query_results(text,text,text,text,text,integer)'::regprocedure)
    INTO function_definition;
  SELECT generation INTO active_generation FROM canonical_v2_staging.active_corpus_release_pointers
  WHERE environment = 'staging';
  IF imported->>'import_state' IS DISTINCT FROM 'IMPORTED_COMPLETE'
    OR activated IS DISTINCT FROM ${runtime.sqlJson(pointerSwap.next_pointer)}
    OR first_page IS DISTINCT FROM second_page
    OR first_page->'rows' IS DISTINCT FROM '[]'::jsonb
    OR first_page->>'page_count' IS DISTINCT FROM '0'
    OR first_page->>'has_more' IS DISTINCT FROM 'false'
    OR first_page->'next_after_product_query_result_identity' IS DISTINCT FROM 'null'::jsonb
    OR cache_row_count <> 1 OR rls IS DISTINCT FROM true OR direct_access IS DISTINCT FROM false
    OR function_definition NOT LIKE '%SET search_path = pg_catalog, canonical_v2_staging%'
    OR function_definition NOT LIKE '%SET statement_timeout = ''2500ms''%'
    OR function_definition NOT LIKE '%maximum_admission_database_calls'', 1%'
    OR function_definition NOT LIKE '%maximum_route_serving_database_calls'', 1%'
    OR function_definition NOT LIKE '%maximum_page_size'', 50%'
    OR function_definition NOT LIKE '%maximum_database_rows_per_request'', 51%'
    OR function_definition NOT LIKE '%maximum_value_ttl_seconds'', 3600%'
    OR function_definition NOT LIKE '%maximum_cached_value_bytes'', 1048576%'
    OR active_generation IS DISTINCT FROM ${before.generation + 1}
  THEN RAISE EXCEPTION 'P8 Product query cache proof failed closed'; END IF;
  INSERT INTO p8_product_cache_proof
  VALUES (first_page, second_page, cache_row_count, rls, direct_access,
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
        AS local_cache_rows
    FROM canonical_v2_staging.active_corpus_release_pointers pointer
    WHERE pointer.environment = 'staging';`, { readOnly: true })[0];
  if (!proof || canonicalJson(before) !== canonicalJson(after)
    || proof.cache_rows !== 1 || proof.rls_enabled !== true
    || proof.direct_table_access !== false || proof.budget_bindings_present !== true) {
    throw new Error('P8 Product query cache proof left durable staging state.');
  }
  process.stdout.write(`${JSON.stringify({
    schema_version: 'P8_PRODUCT_QUERY_CACHE_STAGING_PROOF/V1',
    project_ref: 'sjumbznveyyiizhwvixj',
    proof_state: 'PASS',
    empty_page_cached: true,
    exact_repeat_equal: true,
    transaction_cache_rows: proof.cache_rows,
    rollback_cache_rows: after.local_cache_rows,
    active_pointer_generation_unchanged: true,
    durable_state_unchanged: true,
  })}\n`);
}

main();
