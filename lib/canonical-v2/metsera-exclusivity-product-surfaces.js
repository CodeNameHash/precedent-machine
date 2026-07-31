const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateMetseraExclusivityProductPresentation,
} = require('./metsera-exclusivity-product-presentation');
const {
  validateMetseraExclusivityProductResultSet,
} = require('./metsera-exclusivity-product-result-set');
const {
  validateMetseraExclusivityProductRow,
} = require('./metsera-exclusivity-product-row');

const METSERA_PRODUCT_SURFACES_SCHEMA =
  'METSERA_EXCLUSIVITY_PRODUCT_SURFACES/V1';
const METSERA_COHORT_REQUEST_SCHEMA =
  'METSERA_EXCLUSIVITY_COHORT_REQUEST/V1';
const METSERA_COHORT_RESULT_SCHEMA =
  'METSERA_EXCLUSIVITY_COHORT_RESULT/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const SURFACES = Object.freeze([
  'COMPARE',
  'CORPUS_CONTEXT',
  'QUERY',
  'REVIEW',
]);
const AUTHORITY_LIMITS = Object.freeze({
  market_cohort: 'NONE',
  query_execution: 'NONE',
  source_read: 'NONE',
  rendering: 'NONE',
  serving: 'NONE',
  writer: 'NONE',
  release: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera Product surfaces: ${message}`);
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

function expectedCohortRequest(admission, row) {
  const result =
    row.shared_row_adapter_receipt.product_query_result;
  const body = {
    schema_version: METSERA_COHORT_REQUEST_SCHEMA,
    candidate_release_manifest_id:
      admission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      admission.candidate_release_manifest_payload_digest,
    subject_deal_key:
      admission.admission_input.result_identity
        .governed_deal_admission_id,
    subject_product_result_identity:
      result.product_query_result_identity,
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    filters: {},
    maximum_result_rows: 1,
    database_call_budget: 1,
    immediate_retries: 0,
    execution_authority: 'NONE',
    database_authority: 'NONE',
  };
  return {
    ...body,
    cohort_request_id: contentId(
      METSERA_COHORT_REQUEST_SCHEMA,
      body,
    ),
    cohort_digest: contentId(
      'METSERA_EXCLUSIVITY_SELECTED_COHORT/V1',
      body,
    ),
  };
}

function buildMetseraExclusivityExecutedCohortEvidence(
  admission,
  row,
  { execution_receipt_id: executionReceiptId } = {},
) {
  if (!SHA256_RE.test(executionReceiptId || '')) {
    fail('a bounded external cohort execution receipt is required');
  }
  const request = expectedCohortRequest(admission, row);
  const counts = {
    eligible_deals: 1,
    comparable_deals: 1,
    excluded_deals: 0,
    independent_peer_count: 0,
  };
  const resultBody = {
    schema_version: METSERA_COHORT_RESULT_SCHEMA,
    cohort_request_id: request.cohort_request_id,
    cohort_digest: request.cohort_digest,
    subject_deal_key: request.subject_deal_key,
    subject_product_result_identity:
      request.subject_product_result_identity,
    counts,
    execution_state: 'EXECUTED_BOUNDED_EXTERNAL_INPUT',
    execution_receipt_id: executionReceiptId,
    execution_authority: 'NONE',
    database_authority: 'NONE',
  };
  const cohortResult = {
    ...resultBody,
    cohort_result_id: contentId(
      METSERA_COHORT_RESULT_SCHEMA,
      resultBody,
    ),
  };
  const membershipBody = {
    status: 'INCLUDED',
    exclusion_reason: null,
    cohort_digest: request.cohort_digest,
    subject_deal_key: request.subject_deal_key,
    subject_product_result_identity:
      request.subject_product_result_identity,
    counts_digest: contentId('SUBJECT_COHORT_COUNTS/V1', counts),
    cohort_result_id: cohortResult.cohort_result_id,
  };
  return deepFreeze({
    cohort_request: request,
    cohort_result: cohortResult,
    subject_cohort_membership: {
      ...membershipBody,
      membership_receipt_id: contentId(
        'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
        membershipBody,
      ),
    },
  });
}

function validateCohortEvidence(value, admission, row) {
  if (!exactKeys(value, [
    'cohort_request',
    'cohort_result',
    'subject_cohort_membership',
  ])) {
    fail('the executed cohort evidence is required');
  }
  const request = expectedCohortRequest(admission, row);
  if (canonicalJson(value.cohort_request) !== canonicalJson(request)) {
    fail('the selected cohort request was changed');
  }
  const result = value.cohort_result;
  const resultBody = clone(result);
  delete resultBody.cohort_result_id;
  const counts = result?.counts;
  if (
    !exactKeys(result, [
      'schema_version',
      'cohort_request_id',
      'cohort_digest',
      'subject_deal_key',
      'subject_product_result_identity',
      'counts',
      'execution_state',
      'execution_receipt_id',
      'execution_authority',
      'database_authority',
      'cohort_result_id',
    ])
    || !exactKeys(counts, [
      'eligible_deals',
      'comparable_deals',
      'excluded_deals',
      'independent_peer_count',
    ])
    || result.schema_version !== METSERA_COHORT_RESULT_SCHEMA
    || result.cohort_request_id !== request.cohort_request_id
    || result.cohort_digest !== request.cohort_digest
    || result.subject_deal_key !== request.subject_deal_key
    || result.subject_product_result_identity
      !== request.subject_product_result_identity
    || result.execution_state !== 'EXECUTED_BOUNDED_EXTERNAL_INPUT'
    || !SHA256_RE.test(result.execution_receipt_id || '')
    || result.execution_authority !== 'NONE'
    || result.database_authority !== 'NONE'
    || result.cohort_result_id !== contentId(
      METSERA_COHORT_RESULT_SCHEMA,
      resultBody,
    )
    || counts.eligible_deals !== 1
    || counts.comparable_deals !== 1
    || counts.excluded_deals !== 0
    || counts.independent_peer_count !== 0
  ) {
    fail('the bounded cohort result is invalid');
  }
  const membership = value.subject_cohort_membership;
  const membershipBody = clone(membership);
  delete membershipBody.membership_receipt_id;
  if (
    !exactKeys(membership, [
      'status',
      'exclusion_reason',
      'cohort_digest',
      'subject_deal_key',
      'subject_product_result_identity',
      'counts_digest',
      'cohort_result_id',
      'membership_receipt_id',
    ])
    || membership.status !== 'INCLUDED'
    || membership.exclusion_reason !== null
    || membership.cohort_digest !== request.cohort_digest
    || membership.subject_deal_key !== request.subject_deal_key
    || membership.subject_product_result_identity
      !== request.subject_product_result_identity
    || membership.counts_digest
      !== contentId('SUBJECT_COHORT_COUNTS/V1', counts)
    || membership.cohort_result_id !== result.cohort_result_id
    || membership.membership_receipt_id !== contentId(
      'SUBJECT_COHORT_MEMBERSHIP_RECEIPT/V1',
      membershipBody,
    )
  ) {
    fail('the subject cohort membership receipt is invalid');
  }
  return value;
}

function marketContext(surface, cohortEvidence) {
  if (['COMPARE', 'CORPUS_CONTEXT'].includes(surface)) {
    return {
      market_state: 'SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS',
      cohort_request: clone(cohortEvidence.cohort_request),
      cohort_result: clone(cohortEvidence.cohort_result),
      subject_cohort_membership:
        clone(cohortEvidence.subject_cohort_membership),
      independent_peer_count:
        cohortEvidence.cohort_result.counts.independent_peer_count,
    };
  }
  return {
    market_state: 'NOT_APPLICABLE',
    subject_cohort_membership: null,
    independent_peer_count: null,
  };
}

function buildSurfaces(
  admission,
  row,
  resultSet,
  presentation,
  authorityContext,
  authorityInput,
  cohortEvidence,
) {
  if (!authorityContext || !authorityInput) {
    fail('the exact Pilot Product authority context and input are required');
  }
  validateMetseraExclusivityProductRow(
    row,
    admission,
    authorityContext,
    authorityInput,
  );
  validateMetseraExclusivityProductResultSet(
    resultSet,
    admission,
    row,
    authorityContext,
    authorityInput,
  );
  validateMetseraExclusivityProductPresentation(
    presentation,
    row,
    resultSet,
  );
  validateCohortEvidence(cohortEvidence, admission, row);
  const result =
    row.shared_row_adapter_receipt.product_query_result;
  const presentationPayload =
    presentation.product_presentation_handoff
      .product_result_presentation;
  if (
    resultSet.product_row_receipt_id !== row.product_row_receipt_id
    || presentation.product_row_receipt_id !== row.product_row_receipt_id
    || presentation.product_result_set_receipt_id
      !== resultSet.product_result_set_receipt_id
    || presentationPayload.contract_bindings
      .product_query_ir_definition.query_definition_id
      !== row.product_query_ir.query_definition_id
    || presentationPayload
      .ordered_product_result_slot_identities[0]
      !== result.product_query_result_identity
  ) {
    fail('the row, result set and presentation do not share one result');
  }
  const surfaceBindings = Object.fromEntries(SURFACES.map((surface) => [
    surface,
    {
      surface,
      product_query_definition_id:
        row.product_query_ir.query_definition_id,
      product_query_result_identity:
        result.product_query_result_identity,
      domain_result_identity: result.domain_result_identity,
      product_result: clone(result),
      product_presentation: clone(presentationPayload),
      exact_citation: clone(result.exact_citation),
      selected_source_action: result.exact_detail_action,
      process_result_admission_receipt:
        clone(admission.admission_receipt),
      ...marketContext(surface, cohortEvidence),
    },
  ]));
  const body = {
    product_row_receipt_id: row.product_row_receipt_id,
    product_result_set_receipt_id:
      resultSet.product_result_set_receipt_id,
    product_presentation_receipt_id:
      presentation.product_presentation_receipt_id,
    surface_bindings: surfaceBindings,
    surface_state: 'VALIDATED_NOT_SERVED',
    authority_limits: AUTHORITY_LIMITS,
  };
  return {
    schema_version: METSERA_PRODUCT_SURFACES_SCHEMA,
    product_surfaces_receipt_id: contentId(
      METSERA_PRODUCT_SURFACES_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compileMetseraExclusivityProductSurfaces(
  admission,
  row,
  resultSet,
  presentation,
  authorityContext,
  authorityInput,
  cohortEvidence,
) {
  return deepFreeze(buildSurfaces(
    clone(admission),
    clone(row),
    clone(resultSet),
    clone(presentation),
    authorityContext ? clone(authorityContext) : authorityContext,
    authorityInput ? clone(authorityInput) : authorityInput,
    cohortEvidence ? clone(cohortEvidence) : cohortEvidence,
  ));
}

function validateMetseraExclusivityProductSurfaces(
  value,
  admission,
  row,
  resultSet,
  presentation,
  authorityContext,
  authorityInput,
  cohortEvidence,
) {
  const retainedCohortEvidence = cohortEvidence || (
    value?.surface_bindings?.COMPARE
      ? {
        cohort_request:
          value.surface_bindings.COMPARE.cohort_request,
        cohort_result:
          value.surface_bindings.COMPARE.cohort_result,
        subject_cohort_membership:
          value.surface_bindings.COMPARE.subject_cohort_membership,
      }
      : null
  );
  const rebuilt = buildSurfaces(
    clone(admission),
    clone(row),
    clone(resultSet),
    clone(presentation),
    authorityContext ? clone(authorityContext) : authorityContext,
    authorityInput ? clone(authorityInput) : authorityInput,
    retainedCohortEvidence
      ? clone(retainedCohortEvidence)
      : retainedCohortEvidence,
  );
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the surface receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_COHORT_REQUEST_SCHEMA,
  METSERA_COHORT_RESULT_SCHEMA,
  METSERA_PRODUCT_SURFACES_SCHEMA,
  SURFACES,
  buildMetseraExclusivityExecutedCohortEvidence,
  compileMetseraExclusivityProductSurfaces,
  validateMetseraExclusivityProductSurfaces,
};
