const productCandidateWriteContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-candidate-result-writer.v1.json',
);
const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  validateMetseraExclusivityProductAdmission,
} = require('./metsera-exclusivity-product-admission');
const {
  validateMetseraExclusivityProductPresentation,
} = require('./metsera-exclusivity-product-presentation');
const {
  validateMetseraExclusivityProductResultSet,
} = require('./metsera-exclusivity-product-result-set');
const {
  validateMetseraExclusivityProductRow,
} = require('./metsera-exclusivity-product-row');
const {
  validateMetseraExclusivityProductSurfaces,
} = require('./metsera-exclusivity-product-surfaces');
const {
  validateAuthoredProductCandidateWriteInputs,
} = require('./product-candidate-write-contract-input-validator');

const PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA =
  'PRODUCT_CANDIDATE_RESULT_WRITE_SET/V1';
const PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA =
  'PRODUCT_CANDIDATE_RESULT_RECORD/V1';
const WRITE_SET_KEYS = Object.freeze([
  'candidate_release_binding',
  'process_pilot_materialisation_receipt',
  'product_admission',
  'product_presentation',
  'product_result_set',
  'product_row',
  'product_surfaces',
  'schema_version',
]);

class ProductCandidateResultWriteError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductCandidateResultWriteError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductCandidateResultWriteError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function assertContract() {
  validateAuthoredProductCandidateWriteInputs([{
    object_kind: productCandidateWriteContract.object_kind,
    canonical_value: productCandidateWriteContract,
  }]);
}

function validateReleaseBinding(binding, row) {
  if (
    !binding
    || typeof binding !== 'object'
    || Array.isArray(binding)
    || binding.release_state !== 'CANDIDATE_NOT_ACTIVE'
    || binding.authority_state !== 'NOT_GRANTED'
    || row.product_query_ir.release_contract
      .candidate_release_manifest_id
      !== binding.candidate_release_manifest_id
    || row.product_query_ir.release_contract
      .candidate_release_manifest_payload_digest
      !== binding.candidate_release_manifest_payload_digest
    || row.product_query_ir.query_definition_id
      !== binding.product_query_definition_id
    || typeof binding.corpus_release_id !== 'string'
  ) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RELEASE_BINDING',
      'The candidate release is not the exact inactive Product release.',
    );
  }
}

function buildProductCandidateResultRecord(writeSet) {
  assertContract();
  if (
    !writeSet
    || typeof writeSet !== 'object'
    || Array.isArray(writeSet)
    || canonicalJson(Object.keys(writeSet).sort())
      !== canonicalJson([...WRITE_SET_KEYS].sort())
    || writeSet.schema_version
      !== PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA
  ) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RESULT_WRITE_SET',
      'The Product candidate-result write set is not closed.',
    );
  }
  const {
    candidate_release_binding: release,
    process_pilot_materialisation_receipt: pilot,
    product_admission: admission,
    product_row: row,
    product_result_set: resultSet,
    product_presentation: presentation,
    product_surfaces: surfaces,
  } = writeSet;
  try {
    validateMetseraExclusivityProductAdmission(admission, pilot, release);
    validateMetseraExclusivityProductRow(row, admission);
    validateMetseraExclusivityProductResultSet(
      resultSet,
      admission,
      row,
    );
    validateMetseraExclusivityProductPresentation(
      presentation,
      row,
      resultSet,
    );
    validateMetseraExclusivityProductSurfaces(
      surfaces,
      admission,
      row,
      resultSet,
      presentation,
    );
  } catch (error) {
    fail(
      'INVALID_PRODUCT_CANDIDATE_RESULT_LINEAGE',
      'The Product candidate result or its Process lineage is invalid.',
      { cause: error.code || error.message },
    );
  }
  validateReleaseBinding(release, row);
  const result =
    row.shared_row_adapter_receipt.product_query_result;
  const body = {
    schema_version: PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
    writer_contract_stable_id:
      productCandidateWriteContract.stable_id,
    writer_contract_version:
      productCandidateWriteContract.definition.contract_version,
    operation:
      productCandidateWriteContract.definition
        .operation_contract.operation,
    candidate_release_manifest_id:
      release.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      release.candidate_release_manifest_payload_digest,
    corpus_release_id: release.corpus_release_id,
    product_query_definition_id:
      row.product_query_ir.query_definition_id,
    product_query_result_identity:
      result.product_query_result_identity,
    domain_result_identity: result.domain_result_identity,
    process_phrasebook_result_identity:
      admission.admission_receipt
        .process_phrasebook_passage_result_id,
    candidate_state: 'CANDIDATE_NOT_ACTIVE',
    authority_state: 'NOT_GRANTED',
    complete_write_set: clone(writeSet),
  };
  return {
    schema_version: body.schema_version,
    candidate_product_result_id: contentId(
      PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
      clone(writeSet),
    ),
    ...body,
  };
}

function validateProductCandidateResultWriteSet(writeSet) {
  const record = buildProductCandidateResultRecord(writeSet);
  return {
    counts: {
      publishable: 1,
      residuals: 0,
      quarantinedClosures: 0,
    },
    publishableWriteSet: clone(writeSet),
    candidateRecord: record,
    residuals: [],
    quarantines: [],
    quarantinedClosureIds: [],
  };
}

module.exports = {
  PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
  PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
  ProductCandidateResultWriteError,
  buildProductCandidateResultRecord,
  validateProductCandidateResultWriteSet,
};
