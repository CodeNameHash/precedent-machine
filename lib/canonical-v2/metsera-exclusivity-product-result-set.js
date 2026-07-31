const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
} = require('./process-passage-order');
const {
  PROCESS_ORDERING_VALIDATOR_STABLE_ID,
  PROCESS_ORDERING_VALIDATOR_VERSION,
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
} = require('./product-query-result-set-compiler');
const {
  compileProcessPhrasebookProductResultSetBridge,
} = require('./process-phrasebook-product-result-set-bridge');
const {
  METSERA_PRODUCT_ADMISSION_SCHEMA,
} = require('./metsera-exclusivity-product-admission');
const {
  METSERA_PRODUCT_ROW_SCHEMA,
  admittedSourceCitation,
  validateMetseraExclusivityProductRow,
} = require('./metsera-exclusivity-product-row');

const METSERA_PRODUCT_RESULT_SET_SCHEMA =
  'METSERA_EXCLUSIVITY_PRODUCT_RESULT_SET/V1';
const AUTHORITY_LIMITS = Object.freeze({
  query_execution: 'NONE',
  ordering: 'NONE',
  failure_creation: 'NONE',
  source_read: 'NONE',
  materialisation: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera Product result set: ${message}`);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validateInputs(admission, row, authorityContext, authorityInput) {
  if (
    admission?.schema_version !== METSERA_PRODUCT_ADMISSION_SCHEMA
    || row?.schema_version !== METSERA_PRODUCT_ROW_SCHEMA
    || row.product_admission_adapter_receipt_id
      !== admission.product_admission_adapter_receipt_id
    || row.product_query_ir.query_definition_id
      !== row.shared_row_adapter_receipt.product_query_result
        .product_query_definition_id
    || row.shared_row_adapter_receipt.process_admission_receipt
      .admission_receipt_id
      !== admission.admission_receipt.admission_receipt_id
    || row.row_state !== 'VALIDATED_NOT_SERVED'
    || Object.values(row.authority_limits || {}).some(
      (state) => state !== 'NONE',
    )
  ) {
    fail('the admitted Product row binding is invalid');
  }
  if (!authorityContext || !authorityInput) {
    fail('the exact Pilot Product authority context and input are required');
  }
  validateMetseraExclusivityProductRow(
    row,
    admission,
    authorityContext,
    authorityInput,
  );
}

function singleResultAdapterInput(admission, row) {
  return {
    process_admission_input: admission.admission_input,
    process_admission_receipt: admission.admission_receipt,
    product_query_ir: row.product_query_ir,
    result_fields:
      row.shared_row_adapter_receipt.product_query_result.result_fields,
    product_admission_receipt:
      row.product_result_admission_receipt,
    admitted_source_citation: admittedSourceCitation(admission),
  };
}

function orderingReceipt(row, ordering) {
  const result = row.shared_row_adapter_receipt.product_query_result;
  const query = row.product_query_ir;
  const body = {
    schema_version: PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
    product_query_definition_id: query.query_definition_id,
    approved_pm_data_version_id:
      query.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      query.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      query.release_contract.candidate_release_manifest_payload_digest,
    domain_key: 'PROCESS',
    complete_candidate_slot_identities: [
      result.product_query_result_identity,
    ],
    ordered_slot_identities: [
      result.product_query_result_identity,
    ],
    excluded_slot_identities: [],
    ordering_validator_stable_id:
      PROCESS_ORDERING_VALIDATOR_STABLE_ID,
    ordering_validator_version:
      PROCESS_ORDERING_VALIDATOR_VERSION,
    domain_ordering_projection_schema_version:
      PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
    domain_ordering_projection_identity:
      ordering.ordering_projection_id,
    domain_ordering_projection_payload_digest:
      ordering.canonical_payload_digest,
    external_validation_receipt_id: row.product_row_receipt_id,
    validation_state:
      PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    ordering_receipt_id: contentId(
      PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
      body,
    ),
    ...body,
  };
}

function coverageCertification(row) {
  const query = row.product_query_ir;
  return {
    coverage_certification_identity: contentId(
      METSERA_PRODUCT_RESULT_SET_SCHEMA,
      {
        product_row_receipt_id: row.product_row_receipt_id,
        coverage: 'COMPLETE_SINGLE_METSERA_PILOT_RESULT',
      },
    ),
    query_coverage_identity:
      query.coverage_contract.coverage_identity,
    covered_set_identity:
      query.coverage_contract.covered_set_identity,
    coverage_certification_state: 'CERTIFIED_COMPLETE',
    covered_deal_count: 1,
    excluded_deal_count: 0,
    operational_state: 'COMPLETE',
  };
}

function buildResultSet(admission, row, authorityContext, authorityInput) {
  validateInputs(admission, row, authorityContext, authorityInput);
  const ordering = admission.admission_input.passage_order_projection;
  const adapterInput = singleResultAdapterInput(admission, row);
  const adapterMember = {
    single_result_adapter_input: adapterInput,
    single_result_adapter_receipt:
      row.shared_row_adapter_receipt,
  };
  let resultSetReceipt;
  try {
    resultSetReceipt = compileProcessPhrasebookProductResultSetBridge({
      valid_adapter_members: [adapterMember],
      external_failed_slots: [],
      product_query_ir: row.product_query_ir,
      domain_ordering_projection: ordering,
      ordering_receipt: orderingReceipt(row, ordering),
      coverage_certification: coverageCertification(row),
    });
  } catch (error) {
    fail(
      `the signed result-set compiler rejected the pilot: ${
        error.details?.cause || error.code || error.message
      }`,
    );
  }
  const body = {
    schema_version: METSERA_PRODUCT_RESULT_SET_SCHEMA,
    product_admission_adapter_receipt_id:
      admission.product_admission_adapter_receipt_id,
    product_row_receipt_id: row.product_row_receipt_id,
    result_set_adapter_receipt: resultSetReceipt,
    result_set_state: 'VALIDATED_NOT_SERVED',
    authority_limits: AUTHORITY_LIMITS,
  };
  return {
    schema_version: body.schema_version,
    product_result_set_receipt_id: contentId(
      METSERA_PRODUCT_RESULT_SET_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compileMetseraExclusivityProductResultSet(
  admission,
  row,
  authorityContext,
  authorityInput,
) {
  return deepFreeze(buildResultSet(
    clone(admission),
    clone(row),
    authorityContext ? clone(authorityContext) : authorityContext,
    authorityInput ? clone(authorityInput) : authorityInput,
  ));
}

function validateMetseraExclusivityProductResultSet(
  value,
  admission,
  row,
  authorityContext,
  authorityInput,
) {
  const rebuilt = buildResultSet(
    clone(admission),
    clone(row),
    authorityContext ? clone(authorityContext) : authorityContext,
    authorityInput ? clone(authorityInput) : authorityInput,
  );
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the Product result-set receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_RESULT_SET_SCHEMA,
  compileMetseraExclusivityProductResultSet,
  validateMetseraExclusivityProductResultSet,
};
