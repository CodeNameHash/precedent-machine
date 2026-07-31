#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCanonicalV2StagingRuntime,
} from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  buildLandosCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/landos-candidate-release');
const metseraFixture = require(
  '../__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
);
const {
  buildFixtureCandidateRelease,
} = require('../lib/canonical-v2/candidate-release');
const {
  buildCandidateReleaseImportPlan,
} = require('../lib/canonical-v2/candidate-release-import');
const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProductQueryResultReleasePartition,
} = require(
  '../lib/canonical-v2/product-query-result-release-partition',
);
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

function buildProjectionBoundRelease() {
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

function bindProductResult(release) {
  const result = clone(metseraFixture.shared_result);
  result.candidate_release_manifest_id =
    release.manifest.candidate_release_manifest_id;
  result.candidate_release_manifest_payload_digest =
    release.manifest.canonical_payload_digest;
  result.product_query_result_identity = contentId(
    'PRODUCT_QUERY_RESULT/V1',
    {
      schema_version: result.schema_version,
      product_query_definition_id:
        result.product_query_definition_id,
      approved_pm_data_version_id:
        result.approved_pm_data_version_id,
      candidate_release_manifest_id:
        result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        result.candidate_release_manifest_payload_digest,
      domain_key: result.domain_key,
      domain_result_definition_stable_id:
        result.domain_result_definition.stable_id,
      domain_result_definition_version:
        result.domain_result_definition.version,
      domain_result_identity: result.domain_result_identity,
    },
  );
  result.exact_citation.citation_target_identity = contentId(
    result.exact_citation.schema_version,
    {
      product_query_result_identity:
        result.product_query_result_identity,
      candidate_release_manifest_id:
        result.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        result.candidate_release_manifest_payload_digest,
      source_document_identity:
        result.exact_citation.source_document_identity,
      source_evidence_identity:
        result.exact_citation.source_evidence_identity,
    },
  );
  return result;
}

function stateSql() {
  return `
SELECT
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_candidate_results)
    AS candidate_result_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_query_result_release_partitions)
    AS product_partition_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_query_result_serving_records)
    AS product_serving_record_count;`;
}

function main() {
  const release = buildProjectionBoundRelease();
  const productResult = bindProductResult(release);
  const candidatePayload = {
    schema_version: 'PRODUCT_CANDIDATE_RESULT_IMPORT_PROOF/V1',
    product_row: {
      shared_row_adapter_receipt: {
        product_query_result: productResult,
      },
    },
  };
  const candidateProductResultId = contentId(
    'PRODUCT_CANDIDATE_RESULT_RECORD/V1',
    candidatePayload,
  );
  const runtime = createCanonicalV2StagingRuntime({
    root: ROOT,
    tempPrefix: 'canonical-v2-product-release-p8-',
    operationLabel: 'P8 Product release partition proof',
    bounds: {
      maxSqlBytes: 6 * 1024 * 1024,
      maxProcessBufferBytes: 8 * 1024 * 1024,
      maxResponseBytes: 1024 * 1024,
    },
  });
  const candidatePayloadDigest = runtime.runSql(`
SELECT canonical_v2_staging.payload_digest(
  ${runtime.sqlJson(candidatePayload)}
) AS candidate_payload_digest;`, { readOnly: true })[0]
    ?.candidate_payload_digest;
  if (!/^[a-f0-9]{64}$/.test(candidatePayloadDigest || '')) {
    throw new Error('Staging did not produce a candidate payload digest.');
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
  const before = runtime.runSql(stateSql(), { readOnly: true })[0];
  const proof = runtime.runSql(`
CREATE TEMP TABLE product_release_partition_proof(
  receipt jsonb NOT NULL,
  inactive_query_is_null boolean NOT NULL,
  partition_count integer NOT NULL,
  serving_record_count integer NOT NULL
) ON COMMIT DROP;

INSERT INTO canonical_v2_staging.product_candidate_results(
  candidate_product_result_id,
  candidate_release_manifest_id,
  corpus_release_id,
  product_query_result_identity,
  domain_result_identity,
  candidate_state,
  canonical_payload
) VALUES (
  ${runtime.sqlText(candidateProductResultId)},
  ${runtime.sqlText(release.manifest.candidate_release_manifest_id)},
  ${runtime.sqlText(release.manifest.corpus_release_id)},
  ${runtime.sqlText(productResult.product_query_result_identity)},
  ${runtime.sqlText(productResult.domain_result_identity)},
  'CANDIDATE_NOT_ACTIVE',
  ${runtime.sqlJson(candidatePayload)}
);

DO $product_release_partition_proof$
DECLARE
  imported jsonb;
  inactive_page jsonb;
BEGIN
  imported := public.canonical_v2_import_candidate_release(
    'staging',
    ${runtime.sqlJson(plan)}
  );
  inactive_page := public.canonical_v2_active_product_query_results(
    'staging',
    ${runtime.sqlText(release.manifest.serving_namespace_id)},
    ${runtime.sqlText(release.manifest.corpus_release_id)},
    ${runtime.sqlText(productResult.product_query_definition_id)},
    NULL,
    20
  );
  IF imported->>'schema_version'
      IS DISTINCT FROM 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V7'
    OR imported->>'import_state' IS DISTINCT FROM 'IMPORTED_COMPLETE'
    OR inactive_page IS NOT NULL
    OR (
      SELECT count(*)
      FROM canonical_v2_staging.product_query_result_release_partitions
      WHERE product_query_result_release_partition_manifest_id = ${
        runtime.sqlText(
          partition.product_query_result_release_partition_manifest
            .product_query_result_release_partition_manifest_id,
        )
      }
    ) <> 1
    OR (
      SELECT count(*)
      FROM canonical_v2_staging.product_query_result_serving_records
      WHERE product_query_result_serving_record_id = ${
        runtime.sqlText(
          servingRecord.product_query_result_serving_record_id,
        )
      }
    ) <> 1
  THEN
    RAISE EXCEPTION 'P8 Product release partition proof failed closed';
  END IF;
  INSERT INTO product_release_partition_proof
  SELECT
    imported,
    inactive_page IS NULL,
    (
      SELECT count(*)::integer
      FROM canonical_v2_staging.product_query_result_release_partitions
      WHERE product_query_result_release_partition_manifest_id = ${
        runtime.sqlText(
          partition.product_query_result_release_partition_manifest
            .product_query_result_release_partition_manifest_id,
        )
      }
    ),
    (
      SELECT count(*)::integer
      FROM canonical_v2_staging.product_query_result_serving_records
      WHERE product_query_result_serving_record_id = ${
        runtime.sqlText(
          servingRecord.product_query_result_serving_record_id,
        )
      }
    );
END
$product_release_partition_proof$;

SELECT * FROM product_release_partition_proof;
`)[0];
  const after = runtime.runSql(stateSql(), { readOnly: true })[0];
  if (
    canonicalJson(before) !== canonicalJson(after)
    || proof.receipt?.schema_version
      !== 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V7'
    || proof.receipt?.import_state !== 'IMPORTED_COMPLETE'
    || proof.inactive_query_is_null !== true
    || proof.partition_count !== 1
    || proof.serving_record_count !== 1
  ) {
    throw new Error(
      'P8 Product release partition proof changed durable staging state.',
    );
  }
  process.stdout.write(`${JSON.stringify({
    schema_version: 'P8_PRODUCT_RELEASE_PARTITION_STAGING_PROOF/V1',
    proof_state: 'PASS',
    candidate_release_import_plan_id:
      plan.candidate_release_import_plan_id,
    product_query_result_release_partition_manifest_id:
      partition.product_query_result_release_partition_manifest
        .product_query_result_release_partition_manifest_id,
    product_query_result_serving_record_id:
      servingRecord.product_query_result_serving_record_id,
    active_query_state: 'INACTIVE_FAIL_CLOSED',
    durable_state_unchanged: true,
  })}\n`);
}

main();
