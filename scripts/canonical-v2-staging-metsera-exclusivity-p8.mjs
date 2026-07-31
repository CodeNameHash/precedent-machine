#!/usr/bin/env node

import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCanonicalV2StagingRuntime,
} from './lib/canonical-v2-staging-runtime.mjs';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {
  compileMetseraExclusivityStagingPilot,
} = require('../lib/canonical-v2/metsera-exclusivity-staging-pilot');
const {
  compileMetseraExclusivityProductAdmission,
} = require('../lib/canonical-v2/metsera-exclusivity-product-admission');
const {
  compileMetseraExclusivityProductQuery,
  compileMetseraExclusivityProductRow,
} = require('../lib/canonical-v2/metsera-exclusivity-product-row');
const {
  compileMetseraExclusivityProductResultSet,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-result-set',
);
const {
  compileMetseraExclusivityProductPresentation,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-presentation',
);
const {
  compileMetseraExclusivityProductSurfaces,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-surfaces',
);
const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildLandosCandidateReleaseFixture,
} = require('../__fixtures__/canonical-v2/landos-candidate-release');
const {
  buildFixtureCandidateRelease,
} = require('../lib/canonical-v2/candidate-release');
const {
  buildCandidateReleaseImportPlan,
} = require('../lib/canonical-v2/candidate-release-import');
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
const {
  buildCanonicalWriteReceipt,
  InMemoryCanonicalRepository,
  createCanonicalWriter,
} = require('../lib/canonical-v2/canonical-writer');
const {
  buildCanonicalWriteInputDigest,
} = require('../lib/canonical-v2/canonical-write-envelope');
const {
  PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  compileMetseraExclusivityProductSourceReader,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-source-reader',
);
const {
  PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
} = require('../lib/canonical-v2/product-rerun-compiler');
const {
  requireM1VerticalSliceExecutionPermission,
} = require('../lib/programme-gates/m1-milestone-permission');
const {
  loadSealedMetseraGoldEvidence,
} = require('../lib/canonical-v2/metsera-gold-evidence');

const USER_AGENT =
  'Deal Corpus canonical staging bengoodchild@gmail.com';
const M1_ACKNOWLEDGEMENT_PATH = resolve(
  ROOT,
  'docs/acks/M1-CONTRACT-FREEZE-2026-07-30.md',
);
const M1_BUNDLE = Object.freeze({
  bundle_id:
    '8c765d52d3f95ebfc21b28b5bd0e71689a095c482e113a4329d33b0140dbe83d',
  contract_bundle_digest:
    'b990bf90f98fd83b9dfcf34912ec4b3cd42c37f3e693bee9796b1c63198edc84',
  canonical_payload_digest:
    '73a9023d3ef831e7a544664929385a1aa61af1efed58139d1cd54bf5985d3ab8',
  substantive_member_count: 171,
  dependency_edge_count: 285,
  compile_status: 'PASS',
  cycle_status: 'PASS',
});

function currentM1Permission() {
  return requireM1VerticalSliceExecutionPermission({
    acknowledgement_markdown: readFileSync(
      M1_ACKNOWLEDGEMENT_PATH,
      'utf8',
    ),
    current_bundle: M1_BUNDLE,
  });
}

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

function activeReleaseResolution(stagingState) {
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
    active_fence_identity: stagingState.active_pointer_id,
    candidate_release_manifest_id:
      stagingState.active_candidate_manifest_id,
    candidate_release_manifest_payload_digest:
      stagingState.active_candidate_manifest_payload_digest,
    resolution_state: 'FRESH_EXTERNAL_RESOLUTION',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    resolution_id: contentId(
      PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
      body,
    ),
    active_fence_identity: body.active_fence_identity,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    resolution_state: body.resolution_state,
    execution_authority_state: body.execution_authority_state,
  };
}

function writeBrowserFixture({
  candidateRecord,
  productPresentation,
  productResultSet,
  productSurfaces,
  sourceReader,
}) {
  if (!process.argv.includes('--write-browser-fixture')) return;
  const result =
    candidateRecord.complete_write_set.product_row
      .shared_row_adapter_receipt.product_query_result;
  const presentation =
    productPresentation.product_presentation_handoff
      .product_result_presentation;
  const fixture = {
    schema_version:
      'METSERA_EXCLUSIVITY_BROWSER_ACCEPTANCE_FIXTURE/V1',
    fixture_kind: 'REAL_SEALED_METSERA_P8_INACTIVE_CANDIDATE',
    release_state: 'INACTIVE_CANDIDATE',
    candidate_product_result_id:
      candidateRecord.candidate_product_result_id,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    product_query_definition_id:
      result.product_query_definition_id,
    product_query_result_identity:
      result.product_query_result_identity,
    product_result_set_receipt_id:
      productResultSet.product_result_set_receipt_id,
    product_presentation_receipt_id:
      productPresentation.product_presentation_receipt_id,
    product_surfaces_receipt_id:
      productSurfaces.product_surfaces_receipt_id,
    understood_legal_question:
      presentation.understood_legal_question,
    shared_result: result,
    presentation,
    surface_bindings: Object.fromEntries(
      Object.entries(productSurfaces.surface_bindings).map(
        ([surface, binding]) => [surface, {
          surface,
          product_query_definition_id:
            binding.product_query_definition_id,
          product_query_result_identity:
            binding.product_query_result_identity,
          domain_result_identity:
            binding.domain_result_identity,
          market_state: binding.market_state,
          selected_source_action:
            binding.selected_source_action,
        }],
      ),
    ),
    source_reader: {
      product_source_reader_receipt_id:
        sourceReader.product_source_reader_receipt_id,
      disposition:
        sourceReader.product_source_reader_outcome.disposition,
      execution_state:
        sourceReader.product_source_reader_outcome.execution_state,
      original_result_preserved:
        sourceReader.product_source_reader_outcome
          .original_result_preserved,
    },
    authority_state: 'NOT_GRANTED',
  };
  writeFileSync(
    resolve(
      ROOT,
      '__fixtures__/canonical-v2/metsera-exclusivity-p8.json',
    ),
    `${JSON.stringify(fixture, null, 2)}\n`,
  );
}

async function fetchSource(document) {
  const response = await fetch(document.officialUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(
      `SEC source ${document.accession} returned ${response.status}.`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const { sourceUniverse } = loadSealedMetseraGoldEvidence();
  const sourceBytesByAccession = new Map();
  for (const document of sourceUniverse.documents) {
    sourceBytesByAccession.set(
      document.accession,
      await fetchSource(document),
    );
  }
  const receipt = compileMetseraExclusivityStagingPilot(
    sourceBytesByAccession,
  );
  const combinedPilotBaseRelease = buildCombinedPilotBaseRelease();
  const candidateReleaseBinding = {
    candidate_release_manifest_id:
      combinedPilotBaseRelease.manifest
        .candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      combinedPilotBaseRelease.manifest.canonical_payload_digest,
    corpus_release_id:
      combinedPilotBaseRelease.manifest.corpus_release_id,
    product_query_definition_id: null,
    validation_receipt_ids: {
      narration_revision: receipt.materialisation_receipt_id,
      predicate_witness_revision: receipt.materialisation_receipt_id,
      result_input_lineage: receipt.materialisation_receipt_id,
      preview: receipt.candidate_validation_receipt_id,
      ordering_fact: receipt.candidate_validation_receipt_id,
      release_membership: receipt.candidate_validation_receipt_id,
      exact_detail: receipt.materialisation_receipt_id,
    },
    release_state: 'CANDIDATE_NOT_ACTIVE',
    authority_state: 'NOT_GRANTED',
  };
  const productQuery = compileMetseraExclusivityProductQuery({
    materialisation_receipt_id: receipt.materialisation_receipt_id,
    candidate_release_manifest_id:
      candidateReleaseBinding.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      candidateReleaseBinding
        .candidate_release_manifest_payload_digest,
  });
  candidateReleaseBinding.product_query_definition_id =
    productQuery.query_definition_id;
  const productAdmission =
    compileMetseraExclusivityProductAdmission(
      receipt,
      candidateReleaseBinding,
    );
  const productRow = compileMetseraExclusivityProductRow(
    productAdmission,
  );
  const productResultSet =
    compileMetseraExclusivityProductResultSet(
      productAdmission,
      productRow,
    );
  const productPresentation =
    compileMetseraExclusivityProductPresentation(
      productRow,
      productResultSet,
    );
  const productSurfaces =
    compileMetseraExclusivityProductSurfaces(
      productAdmission,
      productRow,
      productResultSet,
      productPresentation,
    );
  const candidateWriteSet = {
    schema_version: PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
    candidate_release_binding: candidateReleaseBinding,
    process_pilot_materialisation_receipt: receipt,
    product_admission: productAdmission,
    product_row: productRow,
    product_result_set: productResultSet,
    product_presentation: productPresentation,
    product_surfaces: productSurfaces,
  };
  const canonicalWriter = createCanonicalWriter({
    repository: new InMemoryCanonicalRepository(),
  });
  const candidateDryRun = await canonicalWriter.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_V1',
    dryRun: true,
    writeSet: candidateWriteSet,
  });
  const candidateCommit = await canonicalWriter.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_V1',
    writeSet: candidateWriteSet,
  });
  const candidateReplay = await canonicalWriter.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_V1',
    writeSet: candidateWriteSet,
  });
  const stagingRuntime = createCanonicalV2StagingRuntime({
    root: ROOT,
    tempPrefix: 'canonical-v2-metsera-p8-',
    operationLabel: 'Metsera P8 candidate write',
    bounds: {
      maxSqlBytes: 6 * 1024 * 1024,
      maxProcessBufferBytes: 8 * 1024 * 1024,
      maxResponseBytes: 6 * 1024 * 1024,
    },
  });
  const candidatePayloadDigest = stagingRuntime.runSql(`
SELECT canonical_v2_staging.payload_digest(
  ${stagingRuntime.sqlJson(candidateWriteSet)}
) AS candidate_payload_digest;`, { readOnly: true })[0]
    ?.candidate_payload_digest;
  if (!/^[a-f0-9]{64}$/.test(candidatePayloadDigest || '')) {
    throw new Error(
      'Staging did not produce the Product candidate payload digest.',
    );
  }
  const productResult =
    productRow.shared_row_adapter_receipt.product_query_result;
  const productServingRecord =
    buildProductQueryResultServingRecord({
      serving_namespace_id:
        combinedPilotBaseRelease.manifest.serving_namespace_id,
      corpus_release_id:
        combinedPilotBaseRelease.manifest.corpus_release_id,
      candidate_product_result_id:
        candidateCommit.validation.candidateRecord
          .candidate_product_result_id,
      candidate_product_result_payload_digest:
        candidatePayloadDigest,
      product_query_result: productResult,
    });
  const productReleasePartition =
    buildProductQueryResultReleasePartition({
      candidate_release_manifest:
        combinedPilotBaseRelease.manifest,
      product_query_result_serving_records: [
        productServingRecord,
      ],
    });
  const candidateReleaseImportPlan =
    buildCandidateReleaseImportPlan({
      release: combinedPilotBaseRelease,
      product_result_release_partition:
        productReleasePartition,
    });
  const stagingStateSql = `
SELECT
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_candidate_results)
    AS candidate_result_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.write_receipts
   WHERE operation = 'PRODUCT_RESULT_CANDIDATE_RUN')
    AS candidate_write_receipt_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.fixture_corpus_releases
   WHERE candidate_manifest_id = ${
      stagingRuntime.sqlText(
        combinedPilotBaseRelease.manifest
          .candidate_release_manifest_id,
      )
    })
    AS combined_release_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_query_result_release_partitions
   WHERE product_query_result_release_partition_manifest_id = ${
      stagingRuntime.sqlText(
        productReleasePartition
          .product_query_result_release_partition_manifest
          .product_query_result_release_partition_manifest_id,
      )
    })
    AS product_partition_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_query_result_serving_records
   WHERE product_query_result_serving_record_id = ${
      stagingRuntime.sqlText(
        productServingRecord
          .product_query_result_serving_record_id,
      )
    })
    AS product_serving_record_count,
  pointer.generation::integer AS active_pointer_generation,
  pointer.pointer_id AS active_pointer_id,
  pointer.corpus_release_id AS active_corpus_release_id,
  release.candidate_manifest_id AS active_candidate_manifest_id,
  release.canonical_payload_digest
    AS active_candidate_manifest_payload_digest
FROM canonical_v2_staging.active_corpus_release_pointers pointer
JOIN canonical_v2_staging.fixture_corpus_releases release
  ON release.corpus_release_id = pointer.corpus_release_id
WHERE pointer.environment = 'staging';`;
  const stagingBefore = stagingRuntime.runSql(
    stagingStateSql,
    { readOnly: true },
  )[0];
  const stagingWrite = await stagingRuntime.sqlRpcClient({
    commit: false,
  }).rpc('canonical_v2_write', {
    p_environment: 'staging',
    p_operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    p_idempotency_key:
      'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_V1',
    p_input_digest: candidateDryRun.inputDigest,
    p_write_set: candidateWriteSet,
    p_residuals: [],
    p_quarantines: [],
    p_receipt: candidateCommit.receipt,
  });
  if (stagingWrite.error) {
    throw new Error(stagingWrite.error.message);
  }
  const stagingAfter = stagingRuntime.runSql(
    stagingStateSql,
    { readOnly: true },
  )[0];
  if (
    JSON.stringify(stagingAfter) !== JSON.stringify(stagingBefore)
    || stagingWrite.data?.replayed !== false
  ) {
    throw new Error(
      'Metsera candidate rollback changed durable staging state.',
    );
  }
  const conflictingWriteSet =
    JSON.parse(JSON.stringify(candidateWriteSet));
  conflictingWriteSet.candidate_release_binding
    .candidate_release_manifest_id = 'f'.repeat(64);
  const conflictingInputDigest = buildCanonicalWriteInputDigest({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey:
      'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_CONFLICT_V1',
    writeSet: conflictingWriteSet,
    residuals: [],
    quarantines: [],
  });
  const conflictKey =
    'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_CONFLICT_V1';
  const exactConflictProofDigest = buildCanonicalWriteInputDigest({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: conflictKey,
    writeSet: candidateWriteSet,
    residuals: [],
    quarantines: [],
  });
  const proofValidation = candidateCommit.validation;
  const exactConflictProofReceipt = buildCanonicalWriteReceipt({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: conflictKey,
    inputDigest: exactConflictProofDigest,
    validation: proofValidation,
  });
  const conflictingReceipt = buildCanonicalWriteReceipt({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: conflictKey,
    inputDigest: conflictingInputDigest,
    validation: proofValidation,
  });
  const writerCall = (writeSet, digest, writeReceipt) => `
public.canonical_v2_write(
  'staging',
  'PRODUCT_RESULT_CANDIDATE_RUN',
  ${stagingRuntime.sqlText(conflictKey)},
  ${stagingRuntime.sqlText(digest)},
  ${stagingRuntime.sqlJson(writeSet)},
  '[]'::jsonb,
  '[]'::jsonb,
  ${stagingRuntime.sqlJson(writeReceipt)}
)`;
  stagingRuntime.runSql(`
DO $candidate_conflict_proof$
DECLARE
  exact_result jsonb;
  replay_result jsonb;
BEGIN
  exact_result := ${writerCall(
    candidateWriteSet,
    exactConflictProofDigest,
    exactConflictProofReceipt,
  )};
  replay_result := ${writerCall(
    candidateWriteSet,
    exactConflictProofDigest,
    exactConflictProofReceipt,
  )};
  IF exact_result->>'replayed' IS DISTINCT FROM 'false'
    OR replay_result->>'replayed' IS DISTINCT FROM 'true'
    OR (
      SELECT count(*)
      FROM canonical_v2_staging.product_candidate_results
      WHERE candidate_product_result_id = ${
        stagingRuntime.sqlText(
          candidateCommit.validation.candidateRecord
            .candidate_product_result_id,
        )
      }
    ) <> 1
  THEN
    RAISE EXCEPTION 'exact Product candidate replay did not remain a no-op';
  END IF;
  BEGIN
    PERFORM ${writerCall(
    conflictingWriteSet,
    conflictingInputDigest,
    conflictingReceipt,
  )};
    RAISE EXCEPTION 'conflicting Product candidate replay was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      IF position(
        'idempotency key already names different canonical input'
        in SQLERRM
      ) = 0 THEN
        RAISE;
      END IF;
  END;
END;
$candidate_conflict_proof$;`);
  const stagingAfterConflictProof = stagingRuntime.runSql(
    stagingStateSql,
    { readOnly: true },
  )[0];
  if (
    JSON.stringify(stagingAfterConflictProof)
      !== JSON.stringify(stagingBefore)
  ) {
    throw new Error(
      'Metsera conflict proof changed durable staging state.',
    );
  }
  const releaseProof = stagingRuntime.runSql(`
CREATE TEMP TABLE metsera_product_release_proof(
  writer_receipt jsonb NOT NULL,
  import_receipt jsonb NOT NULL,
  inactive_query_is_null boolean NOT NULL,
  product_partition_count integer NOT NULL,
  product_serving_record_count integer NOT NULL,
  exact_import_replay_is_no_op boolean NOT NULL,
  changed_v7_body_rejected boolean NOT NULL,
  tampered_serving_record_id_rejected boolean NOT NULL
) ON COMMIT DROP;

DO $metsera_product_release_proof$
DECLARE
  writer_result jsonb;
  import_result jsonb;
  replay_result jsonb;
  inactive_page jsonb;
  changed_body_plan jsonb;
  tampered_serving_record_id_plan jsonb;
  changed_v7_body_rejected boolean := false;
  tampered_serving_record_id_rejected boolean := false;
BEGIN
  writer_result := public.canonical_v2_write(
    'staging',
    'PRODUCT_RESULT_CANDIDATE_RUN',
    'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_V1',
    ${stagingRuntime.sqlText(candidateDryRun.inputDigest)},
    ${stagingRuntime.sqlJson(candidateWriteSet)},
    '[]'::jsonb,
    '[]'::jsonb,
    ${stagingRuntime.sqlJson(candidateCommit.receipt)}
  );
  changed_body_plan := jsonb_set(
    ${stagingRuntime.sqlJson(candidateReleaseImportPlan)},
    '{expected_counts,product_query_result_serving_records}',
    '2'::jsonb
  );
  BEGIN
    PERFORM public.canonical_v2_import_candidate_release(
      'staging',
      changed_body_plan
    );
    RAISE EXCEPTION 'changed V7 import body was accepted';
  EXCEPTION
    WHEN invalid_parameter_value THEN
      IF position('invalid candidate release import plan' in SQLERRM) = 0 THEN
        RAISE;
      END IF;
      changed_v7_body_rejected := true;
  END;
  tampered_serving_record_id_plan := jsonb_set(
    ${stagingRuntime.sqlJson(candidateReleaseImportPlan)},
    '{product_query_result_serving_records,0,product_query_result_serving_record_id}',
    to_jsonb(repeat('0', 64))
  );
  tampered_serving_record_id_plan := jsonb_set(
    tampered_serving_record_id_plan,
    '{candidate_release_import_plan_id}',
    to_jsonb(canonical_v2_staging.content_id(
      tampered_serving_record_id_plan->>'schema_version',
      tampered_serving_record_id_plan - 'candidate_release_import_plan_id'
    ))
  );
  BEGIN
    PERFORM public.canonical_v2_import_candidate_release(
      'staging',
      tampered_serving_record_id_plan
    );
    RAISE EXCEPTION 'tampered Product serving record ID was accepted';
  EXCEPTION
    WHEN check_violation THEN
      IF position(
        'Product result records do not equal the candidate writer evidence'
        in SQLERRM
      ) = 0 THEN
        RAISE;
      END IF;
      tampered_serving_record_id_rejected := true;
  END;
  import_result := public.canonical_v2_import_candidate_release(
    'staging',
    ${stagingRuntime.sqlJson(candidateReleaseImportPlan)}
  );
  replay_result := public.canonical_v2_import_candidate_release(
    'staging',
    ${stagingRuntime.sqlJson(candidateReleaseImportPlan)}
  );
  inactive_page := public.canonical_v2_active_product_query_results(
    'staging',
    ${stagingRuntime.sqlText(
      combinedPilotBaseRelease.manifest.serving_namespace_id,
    )},
    ${stagingRuntime.sqlText(
      combinedPilotBaseRelease.manifest.corpus_release_id,
    )},
    ${stagingRuntime.sqlText(
      productResult.product_query_definition_id,
    )},
    NULL,
    20
  );
  IF writer_result->>'replayed' IS DISTINCT FROM 'false'
    OR import_result->>'schema_version'
      IS DISTINCT FROM 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V7'
    OR import_result->>'import_state'
      IS DISTINCT FROM 'IMPORTED_COMPLETE'
    OR replay_result->>'replayed' IS DISTINCT FROM 'true'
    OR replay_result IS DISTINCT FROM import_result || jsonb_build_object(
      'replayed', true
    )
    OR changed_v7_body_rejected IS NOT TRUE
    OR tampered_serving_record_id_rejected IS NOT TRUE
    OR inactive_page IS NOT NULL
    OR (
      SELECT count(*)
      FROM canonical_v2_staging.product_query_result_release_partitions
      WHERE product_query_result_release_partition_manifest_id = ${
        stagingRuntime.sqlText(
          productReleasePartition
            .product_query_result_release_partition_manifest
            .product_query_result_release_partition_manifest_id,
        )
      }
    ) <> 1
    OR (
      SELECT count(*)
      FROM canonical_v2_staging.product_query_result_serving_records
      WHERE product_query_result_serving_record_id = ${
        stagingRuntime.sqlText(
          productServingRecord
            .product_query_result_serving_record_id,
        )
      }
    ) <> 1
  THEN
    RAISE EXCEPTION 'Metsera Product release proof failed closed';
  END IF;
  INSERT INTO metsera_product_release_proof
  SELECT
    writer_result,
    import_result,
    inactive_page IS NULL,
    (
      SELECT count(*)::integer
      FROM canonical_v2_staging.product_query_result_release_partitions
      WHERE product_query_result_release_partition_manifest_id = ${
        stagingRuntime.sqlText(
          productReleasePartition
            .product_query_result_release_partition_manifest
            .product_query_result_release_partition_manifest_id,
        )
      }
    ),
    (
      SELECT count(*)::integer
      FROM canonical_v2_staging.product_query_result_serving_records
      WHERE product_query_result_serving_record_id = ${
        stagingRuntime.sqlText(
          productServingRecord
            .product_query_result_serving_record_id,
        )
      }
    ),
    replay_result->>'replayed' = 'true',
    changed_v7_body_rejected,
    tampered_serving_record_id_rejected;
END
$metsera_product_release_proof$;

SELECT * FROM metsera_product_release_proof;
`)[0];
  const stagingAfterReleaseProof = stagingRuntime.runSql(
    stagingStateSql,
    { readOnly: true },
  )[0];
  if (
    JSON.stringify(stagingAfterReleaseProof)
      !== JSON.stringify(stagingBefore)
    || releaseProof.writer_receipt?.replayed !== false
    || releaseProof.import_receipt?.schema_version
      !== 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V7'
    || releaseProof.import_receipt?.import_state
      !== 'IMPORTED_COMPLETE'
    || releaseProof.inactive_query_is_null !== true
    || releaseProof.product_partition_count !== 1
    || releaseProof.product_serving_record_count !== 1
    || releaseProof.exact_import_replay_is_no_op !== true
    || releaseProof.changed_v7_body_rejected !== true
    || releaseProof.tampered_serving_record_id_rejected !== true
  ) {
    throw new Error(
      'Metsera Product release proof changed durable staging state.',
    );
  }
  const sourceReader =
    compileMetseraExclusivityProductSourceReader(
      candidateCommit.validation.candidateRecord,
      activeReleaseResolution(stagingAfterReleaseProof),
      currentM1Permission(),
    );
  if (
    sourceReader.source_reader_state !== 'TYPED_REFUSAL'
    || sourceReader.product_source_reader_outcome.disposition
      !== 'RELEASE_NOT_ACTIVE'
    || sourceReader.product_source_reader_outcome
      .original_result_preserved !== true
    || sourceReader.product_source_reader_outcome.execution_state
      !== 'NOT_EXECUTED'
  ) {
    throw new Error(
      'Inactive Metsera candidate did not fail closed in the Product source reader.',
    );
  }
  writeBrowserFixture({
    candidateRecord: candidateCommit.validation.candidateRecord,
    productPresentation,
    productResultSet,
    productSurfaces,
    sourceReader,
  });
  process.stdout.write(`${JSON.stringify({
    schema_version: receipt.schema_version,
    selected_passage_id: receipt.selected_passage_id,
    sealed_source_count: receipt.sealed_source_count,
    sealed_passage_count: receipt.sealed_passage_count,
    retained_scope_residual_count:
      receipt.retained_scope_residual_count,
    acquisition_receipt_id: receipt.acquisition_receipt_id,
    sec_completeness_receipt_id:
      receipt.sec_completeness_receipt_id,
    scope_receipt_id: receipt.scope_receipt_id,
    candidate_graph_id: receipt.candidate_graph_id,
    candidate_validation_receipt_id:
      receipt.candidate_validation_receipt_id,
    materialisation_receipt_id:
      receipt.materialisation_receipt_id,
    product_admission_adapter_receipt_id:
      productAdmission.product_admission_adapter_receipt_id,
    process_phrasebook_admission_receipt_id:
      productAdmission.admission_receipt.admission_receipt_id,
    process_phrasebook_result_id:
      productAdmission.admission_receipt
        .process_phrasebook_passage_result_id,
    product_row_receipt_id:
      productRow.product_row_receipt_id,
    product_query_definition_id:
      productRow.product_query_ir.query_definition_id,
    product_query_result_identity:
      productRow.shared_row_adapter_receipt
        .product_query_result.product_query_result_identity,
    product_result_set_receipt_id:
      productResultSet.product_result_set_receipt_id,
    ordered_product_result_count:
      productResultSet.result_set_adapter_receipt
        .product_result_set.ordered_result_slots.length,
    product_presentation_receipt_id:
      productPresentation.product_presentation_receipt_id,
    product_field_count:
      productPresentation.product_field_catalogue_manifest
        .field_definitions.length,
    product_surfaces_receipt_id:
      productSurfaces.product_surfaces_receipt_id,
    product_surface_count:
      Object.keys(productSurfaces.surface_bindings).length,
    compare_market_state:
      productSurfaces.surface_bindings.COMPARE.market_state,
    product_candidate_result_id:
      candidateCommit.validation.candidateRecord
        .candidate_product_result_id,
    product_candidate_write_input_digest:
      candidateDryRun.inputDigest,
    product_candidate_write_receipt_id:
      candidateCommit.receipt.receiptId,
    product_candidate_exact_replay:
      candidateReplay.replayed,
    staging_candidate_write_rolled_back: true,
    staging_exact_replay_no_op: true,
    staging_conflicting_replay_rejected: true,
    candidate_release_import_plan_id:
      candidateReleaseImportPlan.candidate_release_import_plan_id,
    product_query_result_release_partition_manifest_id:
      productReleasePartition
        .product_query_result_release_partition_manifest
        .product_query_result_release_partition_manifest_id,
    product_query_result_serving_record_id:
      productServingRecord.product_query_result_serving_record_id,
    product_release_import_receipt_schema:
      releaseProof.import_receipt.schema_version,
    product_release_import_state:
      releaseProof.import_receipt.import_state,
    product_release_import_exact_replay_no_op:
      releaseProof.exact_import_replay_is_no_op,
    product_release_import_changed_v7_body_rejected:
      releaseProof.changed_v7_body_rejected,
    product_release_import_tampered_serving_record_id_rejected:
      releaseProof.tampered_serving_record_id_rejected,
    product_active_query_before_activation:
      releaseProof.inactive_query_is_null
        ? 'INACTIVE_FAIL_CLOSED'
        : 'INVALIDLY_AVAILABLE',
    product_release_proof_rolled_back: true,
    staging_candidate_result_count_before:
      stagingBefore.candidate_result_count,
    staging_candidate_result_count_after:
      stagingAfter.candidate_result_count,
    staging_active_pointer_generation:
      stagingAfter.active_pointer_generation,
    staging_active_pointer_id:
      stagingAfter.active_pointer_id,
    staging_active_corpus_release_id:
      stagingAfter.active_corpus_release_id,
    product_source_reader_receipt_id:
      sourceReader.product_source_reader_receipt_id,
    product_source_reader_disposition:
      sourceReader.product_source_reader_outcome.disposition,
    product_source_reader_execution_state:
      sourceReader.product_source_reader_outcome.execution_state,
    product_source_reader_original_result_preserved:
      sourceReader.product_source_reader_outcome
        .original_result_preserved,
    authority_limits: receipt.authority_limits,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
