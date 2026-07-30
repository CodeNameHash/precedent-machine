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
  loadSealedMetseraGoldEvidence,
} = require('../lib/canonical-v2/metsera-gold-evidence');

const USER_AGENT =
  'Deal Corpus canonical staging bengoodchild@gmail.com';

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
  const releaseSeed = {
    materialisation_receipt_id: receipt.materialisation_receipt_id,
    staging_only: true,
  };
  const candidateReleaseBinding = {
    candidate_release_manifest_id: contentId(
      'METSERA_EXCLUSIVITY_CANDIDATE_RELEASE_MANIFEST/V1',
      releaseSeed,
    ),
    candidate_release_manifest_payload_digest: contentId(
      'METSERA_EXCLUSIVITY_CANDIDATE_RELEASE_PAYLOAD/V1',
      releaseSeed,
    ),
    corpus_release_id: contentId(
      'METSERA_EXCLUSIVITY_CANDIDATE_CORPUS_RELEASE/V1',
      releaseSeed,
    ),
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
  const stagingStateSql = `
SELECT
  (SELECT count(*)::integer
   FROM canonical_v2_staging.product_candidate_results)
    AS candidate_result_count,
  (SELECT count(*)::integer
   FROM canonical_v2_staging.write_receipts
   WHERE operation = 'PRODUCT_RESULT_CANDIDATE_RUN')
    AS candidate_write_receipt_count,
  pointer.generation::integer AS active_pointer_generation,
  pointer.pointer_id AS active_pointer_id,
  pointer.corpus_release_id AS active_corpus_release_id
FROM canonical_v2_staging.active_corpus_release_pointers pointer
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
    authority_limits: receipt.authority_limits,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
