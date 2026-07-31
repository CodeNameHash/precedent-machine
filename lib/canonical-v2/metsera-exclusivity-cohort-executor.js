const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');

const METSERA_COHORT_REQUEST_SCHEMA =
  'METSERA_EXCLUSIVITY_COHORT_REQUEST/V1';
const METSERA_COHORT_EXECUTION_INPUT_SCHEMA =
  'METSERA_EXCLUSIVITY_COHORT_EXECUTION_INPUT/V1';
const METSERA_COHORT_RESULT_SCHEMA =
  'METSERA_EXCLUSIVITY_COHORT_RESULT/V1';
const METSERA_COHORT_EXECUTION_RECEIPT_SCHEMA =
  'METSERA_EXCLUSIVITY_COHORT_EXECUTION_RECEIPT/V1';

function fail(message) {
  throw new Error(`Metsera cohort executor: ${message}`);
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

function exactKeys(value, keys) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...keys].sort());
}

function validateRequest(request, admission, row) {
  const productResult =
    row.shared_row_adapter_receipt.product_query_result;
  if (!exactKeys(request, [
    'schema_version',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'subject_deal_key',
    'subject_product_result_identity',
    'predicate_key',
    'predicate_version',
    'filters',
    'selected_filter_digest',
    'maximum_result_rows',
    'database_call_budget',
    'immediate_retries',
    'execution_authority',
    'database_authority',
    'cohort_request_id',
    'cohort_digest',
  ])) {
    fail('the external cohort request fields are invalid');
  }
  const requestBody = clone(request);
  delete requestBody.cohort_request_id;
  delete requestBody.cohort_digest;
  const selectedFilterDigest = contentId(
    'METSERA_EXCLUSIVITY_SELECTED_FILTERS/V1',
    {
      predicate_key: request.predicate_key,
      predicate_version: request.predicate_version,
      filters: request.filters,
    },
  );
  const cohortDigest = contentId(
    'METSERA_EXCLUSIVITY_SELECTED_COHORT/V1',
    {
      candidate_release_manifest_id:
        request.candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        request.candidate_release_manifest_payload_digest,
      selected_filter_digest: selectedFilterDigest,
    },
  );
  if (
    request.schema_version !== METSERA_COHORT_REQUEST_SCHEMA
    || request.candidate_release_manifest_id
      !== admission.candidate_release_manifest_id
    || request.candidate_release_manifest_payload_digest
      !== admission.candidate_release_manifest_payload_digest
    || request.subject_deal_key
      !== admission.admission_input.result_identity
        .governed_deal_admission_id
    || request.subject_product_result_identity
      !== productResult.product_query_result_identity
    || request.predicate_key !== 'EXCLUSIVITY_GRANTED'
    || request.predicate_version !== 1
    || canonicalJson(request.filters) !== canonicalJson({})
    || request.selected_filter_digest !== selectedFilterDigest
    || request.maximum_result_rows !== 1
    || request.database_call_budget !== 1
    || request.immediate_retries !== 0
    || request.execution_authority !== 'NONE'
    || request.database_authority !== 'NONE'
    || request.cohort_request_id !== contentId(
      METSERA_COHORT_REQUEST_SCHEMA,
      requestBody,
    )
    || request.cohort_digest !== cohortDigest
  ) {
    fail('the external cohort request does not bind the Product subject');
  }
  return request;
}

function validateExecutionInput(value, request) {
  if (!exactKeys(value, [
    'schema_version',
    'cohort_request_id',
    'cohort_digest',
    'selected_filter_digest',
    'selected_candidates',
    'maximum_candidates',
    'execution_authority',
    'database_authority',
    'cohort_execution_input_id',
  ])) {
    fail('the selected candidate cohort input fields are invalid');
  }
  const body = clone(value);
  delete body.cohort_execution_input_id;
  if (
    value.schema_version !== METSERA_COHORT_EXECUTION_INPUT_SCHEMA
    || value.cohort_request_id !== request.cohort_request_id
    || value.cohort_digest !== request.cohort_digest
    || value.selected_filter_digest !== request.selected_filter_digest
    || value.maximum_candidates !== 1
    || value.execution_authority !== 'BOUNDED_PURE_EXECUTOR'
    || value.database_authority !== 'NONE'
    || value.cohort_execution_input_id !== contentId(
      METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
      body,
    )
    || !Array.isArray(value.selected_candidates)
    || value.selected_candidates.length !== 1
    || !exactKeys(value.selected_candidates[0], [
      'candidate_deal_key',
      'candidate_product_result_identity',
      'is_subject',
    ])
  ) {
    fail('the selected candidate cohort input is invalid');
  }
  const subject = value.selected_candidates[0];
  if (
    subject.candidate_deal_key !== request.subject_deal_key
    || subject.candidate_product_result_identity
      !== request.subject_product_result_identity
    || subject.is_subject !== true
  ) {
    fail('the selected candidate cohort does not contain the exact subject');
  }
  return value;
}

function compileMetseraExclusivityCohortExecution({
  cohort_request: suppliedRequest,
  cohort_execution_input: suppliedExecutionInput,
  product_admission: admission,
  product_row: row,
}) {
  const request = validateRequest(
    clone(suppliedRequest),
    clone(admission),
    clone(row),
  );
  const executionInput = validateExecutionInput(
    clone(suppliedExecutionInput),
    request,
  );
  const counts = {
    eligible_deals: executionInput.selected_candidates.length,
    comparable_deals: executionInput.selected_candidates.length,
    excluded_deals: 0,
    independent_peer_count:
      executionInput.selected_candidates.filter(
        (candidate) => !candidate.is_subject,
      ).length,
  };
  const countsDigest = contentId('SUBJECT_COHORT_COUNTS/V1', counts);
  const membershipBody = {
    status: 'INCLUDED',
    exclusion_reason: null,
    cohort_digest: request.cohort_digest,
    selected_filter_digest: request.selected_filter_digest,
    subject_deal_key: request.subject_deal_key,
    subject_product_result_identity:
      request.subject_product_result_identity,
    counts_digest: countsDigest,
  };
  const membership = {
    ...membershipBody,
    membership_receipt_id: contentId(
      'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
      membershipBody,
    ),
  };
  const selectedCandidateDigest = contentId(
    'METSERA_EXCLUSIVITY_SELECTED_CANDIDATES/V1',
    executionInput.selected_candidates,
  );
  const resultBody = {
    schema_version: METSERA_COHORT_RESULT_SCHEMA,
    cohort_request_id: request.cohort_request_id,
    cohort_execution_input_id:
      executionInput.cohort_execution_input_id,
    cohort_digest: request.cohort_digest,
    selected_filter_digest: request.selected_filter_digest,
    selected_candidate_digest: selectedCandidateDigest,
    subject_deal_key: request.subject_deal_key,
    subject_product_result_identity:
      request.subject_product_result_identity,
    counts,
    subject_cohort_membership: membership,
    execution_state: 'EXECUTED_BOUNDED_PURE_COMPILER',
    execution_authority: 'NONE',
    database_authority: 'NONE',
  };
  const result = {
    ...resultBody,
    cohort_result_id: contentId(
      METSERA_COHORT_RESULT_SCHEMA,
      resultBody,
    ),
  };
  const receiptBody = {
    schema_version: METSERA_COHORT_EXECUTION_RECEIPT_SCHEMA,
    cohort_request_id: request.cohort_request_id,
    cohort_execution_input_id:
      executionInput.cohort_execution_input_id,
    cohort_result_id: result.cohort_result_id,
    cohort_digest: request.cohort_digest,
    selected_filter_digest: request.selected_filter_digest,
    selected_candidate_digest: selectedCandidateDigest,
    subject_deal_key: request.subject_deal_key,
    subject_product_result_identity:
      request.subject_product_result_identity,
    counts_digest: countsDigest,
    membership_receipt_id: membership.membership_receipt_id,
    result_execution_state: result.execution_state,
    receipt_state: 'CONTENT_ADDRESSED_PURE_EXECUTION',
  };
  return deepFreeze({
    cohort_request: request,
    cohort_execution_input: executionInput,
    cohort_result: result,
    cohort_execution_receipt: {
      ...receiptBody,
      cohort_execution_receipt_id: contentId(
        METSERA_COHORT_EXECUTION_RECEIPT_SCHEMA,
        receiptBody,
      ),
    },
  });
}

function validateMetseraExclusivityCohortExecutionEvidence(
  value,
  admission,
  row,
) {
  if (!exactKeys(value, [
    'cohort_request',
    'cohort_execution_input',
    'cohort_result',
    'cohort_execution_receipt',
  ])) {
    fail('the exact cohort execution evidence is required');
  }
  const rebuilt = compileMetseraExclusivityCohortExecution({
    cohort_request: value.cohort_request,
    cohort_execution_input: value.cohort_execution_input,
    product_admission: admission,
    product_row: row,
  });
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the executed cohort result or receipt was changed');
  }
  return true;
}

module.exports = {
  METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
  METSERA_COHORT_EXECUTION_RECEIPT_SCHEMA,
  METSERA_COHORT_REQUEST_SCHEMA,
  METSERA_COHORT_RESULT_SCHEMA,
  compileMetseraExclusivityCohortExecution,
  validateMetseraExclusivityCohortExecutionEvidence,
};
