const {
  contentId,
} = require('../../../lib/canonical-v2/canonical-bytes');
const {
  METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
  METSERA_COHORT_REQUEST_SCHEMA,
  compileMetseraExclusivityCohortExecution,
} = require(
  '../../../lib/canonical-v2/metsera-exclusivity-cohort-executor',
);

function executeMetseraTestCohort(productAdmission, row) {
  const productResult =
    row.shared_row_adapter_receipt.product_query_result;
  const filterSelection = {
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    filters: {},
  };
  const selectedFilterDigest = contentId(
    'METSERA_EXCLUSIVITY_SELECTED_FILTERS/V1',
    filterSelection,
  );
  const requestBody = {
    schema_version: METSERA_COHORT_REQUEST_SCHEMA,
    candidate_release_manifest_id:
      productAdmission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      productAdmission.candidate_release_manifest_payload_digest,
    subject_deal_key:
      productAdmission.admission_input.result_identity
        .governed_deal_admission_id,
    subject_product_result_identity:
      productResult.product_query_result_identity,
    ...filterSelection,
    selected_filter_digest: selectedFilterDigest,
    maximum_result_rows: 1,
    database_call_budget: 1,
    immediate_retries: 0,
    execution_authority: 'NONE',
    database_authority: 'NONE',
  };
  const cohortDigest = contentId(
    'METSERA_EXCLUSIVITY_SELECTED_COHORT/V1',
    {
      candidate_release_manifest_id:
        requestBody.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        requestBody.candidate_release_manifest_payload_digest,
      selected_filter_digest: selectedFilterDigest,
    },
  );
  const request = {
    ...requestBody,
    cohort_request_id: contentId(
      METSERA_COHORT_REQUEST_SCHEMA,
      requestBody,
    ),
    cohort_digest: cohortDigest,
  };
  const executionInputBody = {
    schema_version: METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
    cohort_request_id: request.cohort_request_id,
    cohort_digest: cohortDigest,
    selected_filter_digest: selectedFilterDigest,
    selected_candidates: [{
      candidate_deal_key: request.subject_deal_key,
      candidate_product_result_identity:
        request.subject_product_result_identity,
      is_subject: true,
    }],
    maximum_candidates: 1,
    execution_authority: 'BOUNDED_PURE_EXECUTOR',
    database_authority: 'NONE',
  };
  return compileMetseraExclusivityCohortExecution({
    cohort_request: request,
    cohort_execution_input: {
      ...executionInputBody,
      cohort_execution_input_id: contentId(
        METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
        executionInputBody,
      ),
    },
    product_admission: productAdmission,
    product_row: row,
  });
}

module.exports = {
  executeMetseraTestCohort,
};
