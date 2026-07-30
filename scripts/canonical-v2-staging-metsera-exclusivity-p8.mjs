#!/usr/bin/env node

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
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
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
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
    authority_limits: receipt.authority_limits,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
