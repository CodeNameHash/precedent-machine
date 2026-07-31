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
  canonicalJson,
  contentId,
  sha256Hex,
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
  buildProcessPhrasebookProductChain,
  buildProductCandidateResultWriteEnvelope,
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

const M1_ACKNOWLEDGEMENT_PATH = resolve(
  ROOT,
  'docs/acks/M1-CONTRACT-FREEZE-2026-07-31.md',
);

function currentM1Permission() {
  const contractRoot = resolve(
    ROOT,
    'contracts/canonical-v2/successor',
  );
  const input = compileCanonicalContractInput({
    root_directory: contractRoot,
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: input,
  });
  const bundle = compileCanonicalContractBundle({
    canonical_contract_input_compilation: input,
    classification_registry:
      proposal.registry_assembly.classification_registry,
    dependency_registry:
      proposal.registry_assembly.dependency_registry,
    governed_registry_bindings:
      proposal.registry_assembly.governed_registry_bindings,
  });
  return requireM1VerticalSliceExecutionPermission({
    acknowledgement_markdown: readFileSync(
      M1_ACKNOWLEDGEMENT_PATH,
      'utf8',
    ),
    current_bundle: {
      bundle_id: bundle.contract_bundle_id,
      contract_bundle_digest: bundle.contract_bundle_digest,
      canonical_payload_digest: bundle.canonical_payload_digest,
      substantive_member_count:
        bundle.compile_report.non_governance_authored_member_count,
      dependency_edge_count:
        bundle.dependency_cycle_report.edge_count,
      compile_status: bundle.compile_report.status,
      cycle_status: bundle.dependency_cycle_report.status,
    },
  });
}

function currentProductAuthority(candidateReleaseManifest) {
  const contractRoot = resolve(ROOT, 'contracts/canonical-v2/successor');
  const canonicalContractInputCompilation = compileCanonicalContractInput({
    root_directory: contractRoot,
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
  return { input, context: compilePilotProductAuthorityContext(input) };
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

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function rehashProcessCarrierEnvelope(value) {
  const carrier = value.domain_carrier;
  const body = clone(carrier);
  delete body.process_phrasebook_product_chain_id;
  delete body.process_phrasebook_product_chain_payload_digest;
  carrier.process_phrasebook_product_chain_id = contentId(
    carrier.schema_version,
    body,
  );
  carrier.process_phrasebook_product_chain_payload_digest = sha256Hex(
    Buffer.from(canonicalJson(body), 'utf8'),
  );
  return value;
}

function hostileProcessAuthorityCarriers(writeSet) {
  const missing = clone(writeSet);
  delete missing.domain_carrier.pilot_product_authority_context_input;
  rehashProcessCarrierEnvelope(missing);

  const substitutedContext = clone(writeSet);
  const context =
    substitutedContext.domain_carrier.pilot_product_authority_context;
  context.authority_limits.writer = 'HOSTILE_SUBSTITUTION';
  const contextBody = clone(context);
  delete contextBody.authority_context_id;
  context.authority_context_id = contentId(
    context.schema_version,
    contextBody,
  );
  rehashProcessCarrierEnvelope(substitutedContext);

  const substitutedInput = clone(writeSet);
  const bundle = substitutedInput.domain_carrier
    .pilot_product_authority_context_input.compiled_contract_bundle;
  bundle.contract_bundle_digest = 'f'.repeat(64);
  bundle.contract_bundle_id = contentId(
    'PROGRAMME_GATE_CONTRACT_BUNDLE_ID/V1',
    { contract_bundle_digest: bundle.contract_bundle_digest },
  );
  const bundleBody = clone(bundle);
  delete bundleBody.schema_version;
  delete bundleBody.canonical_payload_digest;
  delete bundleBody.disposition;
  bundle.canonical_payload_digest = contentId(
    'CANONICAL_CONTRACT_BUNDLE_COMPILATION_PAYLOAD/V1',
    bundleBody,
  );
  rehashProcessCarrierEnvelope(substitutedInput);

  return [
    ['MISSING_AUTHORITY_INPUT', missing],
    ['SUBSTITUTED_AUTHORITY_CONTEXT', substitutedContext],
    ['SUBSTITUTED_AUTHORITY_INPUT', substitutedInput],
  ];
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

function readCheckedProcessAdmission() {
  const flag = '--process-admission';
  const index = process.argv.indexOf(flag);
  const filePath = index < 0 ? null : process.argv[index + 1];
  if (!filePath || filePath.startsWith('--')) {
    throw new Error(
      'Metsera P8 requires --process-admission <checked-admission.json>.',
    );
  }
  const value = JSON.parse(readFileSync(resolve(filePath), 'utf8'));
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort())
      !== JSON.stringify([
        'process_admission_input',
        'process_admission_receipt',
      ])
  ) {
    throw new Error(
      'The checked Process admission file must contain only input and receipt.',
    );
  }
  return value;
}

async function main() {
  const m1Permission = currentM1Permission();
  const checkedProcessAdmission = readCheckedProcessAdmission();
  const combinedPilotBaseRelease = buildCombinedPilotBaseRelease();
  const productAuthority = currentProductAuthority(
    combinedPilotBaseRelease.manifest,
  );
  const candidateReleaseBinding = {
    candidate_release_manifest_id:
      combinedPilotBaseRelease.manifest
        .candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      combinedPilotBaseRelease.manifest.canonical_payload_digest,
    corpus_release_id:
      combinedPilotBaseRelease.manifest.corpus_release_id,
    product_query_definition_id: null,
    release_state: 'CANDIDATE_NOT_ACTIVE',
    authority_state: 'NOT_GRANTED',
  };
  candidateReleaseBinding.product_query_definition_id =
    compileMetseraExclusivityProductQuery(
      compileMetseraExclusivityProductAdmission(checkedProcessAdmission),
      productAuthority.context,
      productAuthority.input,
    ).query_definition_id;
  const productAdmission =
    compileMetseraExclusivityProductAdmission(checkedProcessAdmission);
  if (
    productAdmission.candidate_release_manifest_id
      !== candidateReleaseBinding.candidate_release_manifest_id
    || productAdmission.candidate_release_manifest_payload_digest
      !== candidateReleaseBinding.candidate_release_manifest_payload_digest
  ) {
    throw new Error(
      'The checked Process admission is not intended for this inactive candidate release.',
    );
  }
  const productRow = compileMetseraExclusivityProductRow(
    productAdmission,
    productAuthority.context,
    productAuthority.input,
  );
  const productResultSet =
    compileMetseraExclusivityProductResultSet(
      productAdmission,
      productRow,
      productAuthority.context,
      productAuthority.input,
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
      productAuthority.context,
      productAuthority.input,
    );
  const candidateProductWriteSet = {
    schema_version: PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
    candidate_release_binding: candidateReleaseBinding,
    process_pilot_materialisation_receipt:
      checkedProcessAdmission.process_admission_receipt,
    product_admission: productAdmission,
    product_row: productRow,
    product_result_set: productResultSet,
    product_presentation: productPresentation,
    product_surfaces: productSurfaces,
  };
  const candidateWriteSet = buildProductCandidateResultWriteEnvelope({
    adapter_identifier: 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
    domain_carrier: buildProcessPhrasebookProductChain(
      candidateProductWriteSet,
      productAuthority.context,
      productAuthority.input,
    ),
  });
  const canonicalWriter = createCanonicalWriter({
    repository: new InMemoryCanonicalRepository(),
  });
  const candidateDryRun = await canonicalWriter.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_V1',
    dryRun: true,
    writeSet: candidateWriteSet,
    processAuthorityContext: productAuthority.context,
    processAuthorityInput: productAuthority.input,
  });
  const candidateCommit = await canonicalWriter.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_V1',
    writeSet: candidateWriteSet,
    processAuthorityContext: productAuthority.context,
    processAuthorityInput: productAuthority.input,
  });
  const candidateReplay = await canonicalWriter.write({
    operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
    idempotencyKey: 'METSERA_EXCLUSIVITY_PRODUCT_RESULT_P8_V1',
    writeSet: candidateWriteSet,
    processAuthorityContext: productAuthority.context,
    processAuthorityInput: productAuthority.input,
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
  const conflictingProductWriteSet =
    JSON.parse(JSON.stringify(candidateProductWriteSet));
  conflictingProductWriteSet.candidate_release_binding
    .candidate_release_manifest_id = 'f'.repeat(64);
  const conflictingWriteSet = buildProductCandidateResultWriteEnvelope({
    adapter_identifier: 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
    domain_carrier: buildProcessPhrasebookProductChain(
      conflictingProductWriteSet,
      productAuthority.context,
      productAuthority.input,
    ),
  });
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
  const authorityHostile = hostileProcessAuthorityCarriers(candidateWriteSet);
  for (const [label, hostileWriteSet] of authorityHostile) {
    const hostileKey = `METSERA_EXCLUSIVITY_${label}_P8_V1`;
    const hostileDigest = buildCanonicalWriteInputDigest({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey: hostileKey,
      writeSet: hostileWriteSet,
      residuals: [],
      quarantines: [],
    });
    const hostileReceipt = buildCanonicalWriteReceipt({
      operation: 'PRODUCT_RESULT_CANDIDATE_RUN',
      idempotencyKey: hostileKey,
      inputDigest: hostileDigest,
      validation: candidateCommit.validation,
    });
    stagingRuntime.runSql(`
DO $metsera_authority_hostile_p8$
DECLARE
  candidate_count_before integer;
  receipt_count_before integer;
  rejected boolean := false;
BEGIN
  SELECT count(*)::integer INTO candidate_count_before
  FROM canonical_v2_staging.product_candidate_results;
  SELECT count(*)::integer INTO receipt_count_before
  FROM canonical_v2_staging.write_receipts
  WHERE operation = 'PRODUCT_RESULT_CANDIDATE_RUN';
  BEGIN
    PERFORM public.canonical_v2_write(
      'staging',
      'PRODUCT_RESULT_CANDIDATE_RUN',
      ${stagingRuntime.sqlText(hostileKey)},
      ${stagingRuntime.sqlText(hostileDigest)},
      ${stagingRuntime.sqlJson(hostileWriteSet)},
      '[]'::jsonb,
      '[]'::jsonb,
      ${stagingRuntime.sqlJson(hostileReceipt)}
    );
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM IS DISTINCT FROM
      'invalid SQL-native Process Product authority carrier'
    THEN
      RAISE;
    END IF;
    rejected := true;
  END;
  IF rejected IS NOT TRUE THEN
    RAISE EXCEPTION 'hostile Process authority carrier was accepted';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.product_candidate_results)
      <> candidate_count_before
    OR (SELECT count(*) FROM canonical_v2_staging.write_receipts
        WHERE operation = 'PRODUCT_RESULT_CANDIDATE_RUN')
      <> receipt_count_before
  THEN
    RAISE EXCEPTION 'hostile Process authority carrier reached DML';
  END IF;
END;
$metsera_authority_hostile_p8$;`);
  }
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
      m1Permission,
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
    schema_version: 'METSERA_EXCLUSIVITY_P8_CANDIDATE_PROOF/V2',
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
    authority_hostile_call_count: authorityHostile.length,
    authority_hostile_rejected_before_dml: true,
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
    authority_limits: productAdmission.authority_limits,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
