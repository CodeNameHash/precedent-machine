const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  canonicalProductQueryIrBytes,
} = require('./product-query-ir');
const {
  validateProductQueryResult,
} = require('./product-citation-share-compiler');
const {
  COVERAGE_CERTIFICATION_STATES,
  PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
  PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
} = require('./product-result-presentation-compiler');
const {
  MAX_CANDIDATES,
  PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
  validateProcessPassageOrderProjection,
} = require('./process-passage-order');

const PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA =
  'PRODUCT_QUERY_RESULT_ORDERING_RECEIPT/V1';
const PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE =
  'EXTERNALLY_VALIDATED_PASS';
const PROCESS_ORDERING_VALIDATOR_STABLE_ID =
  'PROCESS_PASSAGE_ORDERING_PROJECTION';
const PROCESS_ORDERING_VALIDATOR_VERSION = 1;
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProductQueryResultSetCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductQueryResultSetCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductQueryResultSetCompilerError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function requireText(
  value,
  label,
  code = 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT',
) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.trim() !== value
    || Buffer.byteLength(value, 'utf8') > 512
  ) {
    fail(code, `${label} must be a bounded non-empty trimmed string.`);
  }
  return value;
}

function requireDigest(
  value,
  label,
  code = 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT',
) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requirePositiveInteger(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
  return value;
}

function requireNonNegativeInteger(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(code, `${label} must be a non-negative safe integer.`);
  }
  return value;
}

function requireArray(value, label, code, maximum = MAX_CANDIDATES) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  if (value.length > maximum) {
    fail(code, `${label} exceeds the fixed collection bound.`);
  }
  return value;
}

function clone(
  value,
  code = 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product result-set input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function requireUniqueDigests(values, label, code, { sorted = false } = {}) {
  const items = requireArray(values, label, code);
  items.forEach((value, index) => {
    requireDigest(value, `${label} ${index}`, code);
  });
  if (new Set(items).size !== items.length) {
    fail(code, `${label} contains a duplicate identity.`);
  }
  if (
    sorted
    && canonicalJson(items)
      !== canonicalJson([...items].sort(compareText))
  ) {
    fail(code, `${label} is not in canonical set order.`);
  }
  return items;
}

function failureIdentityBody(failure) {
  const body = clone(failure);
  delete body.failure_identity;
  return body;
}

function validateProductResultSlotFailure(
  failure,
  code = 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT',
) {
  requireExactKeys(failure, [
    'schema_version',
    'failure_identity',
    'disposition',
    'failed_domain_result_identity',
  ], 'Product result slot failure', code);
  if (failure.schema_version !== PRODUCT_RESULT_SLOT_FAILURE_SCHEMA) {
    fail(code, 'The Product result slot failure schema is invalid.');
  }
  requireDigest(
    failure.failure_identity,
    'Product result slot failure identity',
    code,
  );
  requireText(
    failure.disposition,
    'Product result slot failure disposition',
    code,
  );
  if (failure.failed_domain_result_identity !== null) {
    requireDigest(
      failure.failed_domain_result_identity,
      'Failed domain result identity',
      code,
    );
  }
  if (
    failure.failure_identity
      !== contentId(
        PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
        failureIdentityBody(failure),
      )
  ) {
    fail(code, 'The Product result slot failure identity is invalid.');
  }
  return true;
}

function compileProductResultSlotFailure({
  disposition,
  failed_domain_result_identity: failedDomainResultIdentity,
}) {
  const code = 'INVALID_PRODUCT_RESULT_SLOT_FAILURE_INPUT';
  requireText(disposition, 'Product result slot failure disposition', code);
  if (failedDomainResultIdentity !== null) {
    requireDigest(
      failedDomainResultIdentity,
      'Failed domain result identity',
      code,
    );
  }
  const body = {
    schema_version: PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
    disposition,
    failed_domain_result_identity: failedDomainResultIdentity,
  };
  const failure = {
    schema_version: body.schema_version,
    failure_identity: contentId(
      PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
      body,
    ),
    disposition: body.disposition,
    failed_domain_result_identity:
      body.failed_domain_result_identity,
  };
  validateProductResultSlotFailure(failure, code);
  return deepFreeze(clone(failure, code));
}

function validateResultAgainstQuery(result, queryIr, code) {
  try {
    validateProductQueryResult(result);
  } catch (error) {
    fail(code, 'A Product query result is invalid.', {
      cause: error.code || error.message,
    });
  }
  const release = queryIr.release_contract;
  if (
    result.product_query_definition_id !== queryIr.query_definition_id
    || result.approved_pm_data_version_id
      !== release.approved_pm_data_version_id
    || result.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || result.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
    || result.domain_key !== queryIr.semantic_contract.domain_key
  ) {
    fail(code, 'A Product query result does not match the exact query.');
  }
}

function validateCandidate(candidate, queryIr, index, code) {
  requireExactKeys(candidate, [
    'slot_identity',
    'slot_state',
    'product_query_result',
    'failure',
  ], `Product result candidate ${index}`, code);
  requireDigest(
    candidate.slot_identity,
    `Product result candidate ${index} slot identity`,
    code,
  );
  if (candidate.slot_state === 'VALID') {
    if (candidate.failure !== null) {
      fail(code, 'A valid Product result candidate contains a failure.');
    }
    requireObject(
      candidate.product_query_result,
      `Product result candidate ${index} result`,
      code,
    );
    validateResultAgainstQuery(
      candidate.product_query_result,
      queryIr,
      code,
    );
    if (
      candidate.slot_identity
        !== candidate.product_query_result.product_query_result_identity
    ) {
      fail(code, 'A valid Product result candidate uses the wrong identity.');
    }
    return {
      slot: clone(candidate, code),
      domainResultIdentity:
        candidate.product_query_result.domain_result_identity,
    };
  }
  if (candidate.slot_state === 'UNAVAILABLE') {
    if (candidate.product_query_result !== null) {
      fail(code, 'An unavailable Product result candidate contains a result.');
    }
    validateProductResultSlotFailure(candidate.failure, code);
    if (
      candidate.slot_identity !== candidate.failure.failure_identity
      || candidate.failure.failed_domain_result_identity === null
    ) {
      fail(
        code,
        'An unavailable Product result candidate cannot bind the domain result.',
      );
    }
    return {
      slot: clone(candidate, code),
      domainResultIdentity:
        candidate.failure.failed_domain_result_identity,
    };
  }
  fail(code, 'A Product result candidate state is not registered.');
}

function orderingReceiptIdentityBody(receipt) {
  const body = clone(receipt);
  delete body.ordering_receipt_id;
  return body;
}

function validateOrderingReceiptShape(receipt, code) {
  requireExactKeys(receipt, [
    'schema_version',
    'ordering_receipt_id',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_key',
    'complete_candidate_slot_identities',
    'ordered_slot_identities',
    'excluded_slot_identities',
    'ordering_validator_stable_id',
    'ordering_validator_version',
    'domain_ordering_projection_schema_version',
    'domain_ordering_projection_identity',
    'domain_ordering_projection_payload_digest',
    'external_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Product query-result ordering receipt', code);
  if (
    receipt.schema_version
      !== PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA
    || receipt.validation_state
      !== PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE
    || receipt.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product query-result ordering receipt state is invalid.');
  }
  for (const key of [
    'ordering_receipt_id',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_ordering_projection_identity',
    'domain_ordering_projection_payload_digest',
    'external_validation_receipt_id',
  ]) {
    requireDigest(
      receipt[key],
      `Product query-result ordering receipt ${key}`,
      code,
    );
  }
  for (const key of [
    'domain_key',
    'ordering_validator_stable_id',
    'domain_ordering_projection_schema_version',
  ]) {
    requireText(
      receipt[key],
      `Product query-result ordering receipt ${key}`,
      code,
    );
  }
  requirePositiveInteger(
    receipt.ordering_validator_version,
    'Product query-result ordering validator version',
    code,
  );
  requireUniqueDigests(
    receipt.complete_candidate_slot_identities,
    'Complete candidate slot identities',
    code,
    { sorted: true },
  );
  requireUniqueDigests(
    receipt.ordered_slot_identities,
    'Ordered slot identities',
    code,
  );
  requireUniqueDigests(
    receipt.excluded_slot_identities,
    'Excluded slot identities',
    code,
  );
  if (
    receipt.ordering_receipt_id
      !== contentId(
        PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
        orderingReceiptIdentityBody(receipt),
      )
  ) {
    fail(code, 'The Product query-result ordering receipt identity is invalid.');
  }
}

function validateCoverageCertification(certification, queryIr, code) {
  requireExactKeys(certification, [
    'coverage_certification_identity',
    'query_coverage_identity',
    'covered_set_identity',
    'coverage_certification_state',
    'covered_deal_count',
    'excluded_deal_count',
    'operational_state',
  ], 'Product query coverage certification', code);
  for (const key of [
    'coverage_certification_identity',
    'query_coverage_identity',
    'covered_set_identity',
  ]) {
    requireDigest(
      certification[key],
      `Product query coverage certification ${key}`,
      code,
    );
  }
  if (
    !COVERAGE_CERTIFICATION_STATES.includes(
      certification.coverage_certification_state,
    )
    || certification.operational_state !== 'COMPLETE'
  ) {
    fail(code, 'The Product query coverage certification state is invalid.');
  }
  requireNonNegativeInteger(
    certification.covered_deal_count,
    'Product query covered deal count',
    code,
  );
  requireNonNegativeInteger(
    certification.excluded_deal_count,
    'Product query excluded deal count',
    code,
  );
  if (
    certification.query_coverage_identity
      !== queryIr.coverage_contract.coverage_identity
    || certification.covered_set_identity
      !== queryIr.coverage_contract.covered_set_identity
  ) {
    fail(code, 'The Product query coverage certification is stale.');
  }
}

function validateProcessOrder({
  queryIr,
  candidates,
  orderingProjection,
  orderingReceipt,
  code,
}) {
  if (
    orderingReceipt.ordering_validator_stable_id
      !== PROCESS_ORDERING_VALIDATOR_STABLE_ID
    || orderingReceipt.ordering_validator_version
      !== PROCESS_ORDERING_VALIDATOR_VERSION
    || orderingReceipt.domain_ordering_projection_schema_version
      !== PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA
    || orderingProjection.schema_version
      !== PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA
  ) {
    fail(code, 'The Process ordering validator is not the admitted validator.');
  }
  try {
    validateProcessPassageOrderProjection(orderingProjection);
  } catch (error) {
    fail(code, 'The Process ordering projection is invalid.', {
      cause: error.code || error.message,
    });
  }
  const release = queryIr.release_contract;
  if (
    orderingProjection.product_query_definition_id
      !== queryIr.query_definition_id
    || orderingProjection.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || orderingProjection.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
    || orderingProjection.page_size
      !== queryIr.pagination_contract.page_size
    || orderingReceipt.domain_ordering_projection_identity
      !== orderingProjection.ordering_projection_id
    || orderingReceipt.domain_ordering_projection_payload_digest
      !== orderingProjection.canonical_payload_digest
  ) {
    fail(code, 'The Process ordering projection does not match the query.');
  }
  if (
    orderingProjection.candidate_count !== candidates.length
    || orderingProjection.ordered_result_ids.length !== candidates.length
  ) {
    fail(code, 'The Process ordering projection candidate count is stale.');
  }
  const byDomainResult = new Map();
  const bySlot = new Map();
  for (const candidate of candidates) {
    if (byDomainResult.has(candidate.domainResultIdentity)) {
      fail(code, 'Two candidates bind the same domain result identity.');
    }
    byDomainResult.set(candidate.domainResultIdentity, candidate);
    bySlot.set(candidate.slot.slot_identity, candidate);
  }
  const projected = orderingProjection.ordered_result_ids.map((identity) => {
    const candidate = byDomainResult.get(identity);
    if (!candidate) {
      fail(code, 'The Process ordering projection substituted a candidate.');
    }
    return candidate.slot.slot_identity;
  });
  if (
    new Set(orderingProjection.ordered_result_ids).size
      !== orderingProjection.ordered_result_ids.length
    || projected.length !== byDomainResult.size
  ) {
    fail(code, 'The Process ordering projection is not a complete set.');
  }
  const expectedComplete = [...bySlot.keys()].sort(compareText);
  const emittedCount = orderingProjection.first_page_result_ids.length;
  const expectedOrdered = projected.slice(0, emittedCount);
  const expectedExcluded = projected.slice(emittedCount);
  if (
    canonicalJson(orderingProjection.first_page_result_ids)
      !== canonicalJson(
        orderingProjection.ordered_result_ids.slice(0, emittedCount),
      )
    || canonicalJson(orderingReceipt.complete_candidate_slot_identities)
      !== canonicalJson(expectedComplete)
    || canonicalJson(orderingReceipt.ordered_slot_identities)
      !== canonicalJson(expectedOrdered)
    || canonicalJson(orderingReceipt.excluded_slot_identities)
      !== canonicalJson(expectedExcluded)
  ) {
    fail(code, 'The Product ordering receipt changed the validated order.');
  }
  return {
    orderedSlots: expectedOrdered.map(
      (identity) => clone(bySlot.get(identity).slot, code),
    ),
    excludedCount: expectedExcluded.length,
  };
}

function buildExecutionSummary({
  queryIr,
  orderedSlots,
  excludedCount,
  coverageCertification,
}) {
  let validCount = 0;
  let failedCount = 0;
  for (const slot of orderedSlots) {
    if (slot.slot_state === 'VALID') validCount += 1;
    if (slot.slot_state === 'UNAVAILABLE') failedCount += 1;
  }
  const body = {
    schema_version: PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
    product_query_definition_id: queryIr.query_definition_id,
    query_coverage_identity:
      queryIr.coverage_contract.coverage_identity,
    coverage_certification_state:
      coverageCertification.coverage_certification_state,
    coverage_certification_identity:
      coverageCertification.coverage_certification_identity,
    covered_deal_count: coverageCertification.covered_deal_count,
    excluded_deal_count: coverageCertification.excluded_deal_count,
    valid_result_count: validCount,
    failed_result_count: failedCount,
    excluded_result_count: excludedCount,
    total_result_count:
      validCount + failedCount + excludedCount,
    operational_state: 'COMPLETE',
  };
  return {
    schema_version: body.schema_version,
    query_execution_summary_id: contentId(
      PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
      body,
    ),
    product_query_definition_id:
      body.product_query_definition_id,
    query_coverage_identity: body.query_coverage_identity,
    coverage_certification_state:
      body.coverage_certification_state,
    coverage_certification_identity:
      body.coverage_certification_identity,
    covered_deal_count: body.covered_deal_count,
    excluded_deal_count: body.excluded_deal_count,
    valid_result_count: body.valid_result_count,
    failed_result_count: body.failed_result_count,
    excluded_result_count: body.excluded_result_count,
    total_result_count: body.total_result_count,
    operational_state: body.operational_state,
  };
}

function compileProductQueryResultSet({
  product_query_ir: queryIr,
  candidate_slots: candidateSlots,
  domain_ordering_projection: orderingProjection,
  ordering_receipt: orderingReceipt,
  coverage_certification: coverageCertification,
}) {
  const code = 'INVALID_PRODUCT_QUERY_RESULT_SET_INPUT';
  try {
    canonicalProductQueryIrBytes(queryIr);
  } catch (error) {
    fail(code, 'The Product Query IR is invalid.', {
      cause: error.code || error.message,
    });
  }
  const domainKey = queryIr.semantic_contract.domain_key;
  if (domainKey !== 'PROCESS') {
    fail(
      'PRODUCT_ORDERING_VALIDATOR_NOT_ADMITTED',
      `No Product ordering validator is admitted for ${domainKey}.`,
      { domain_key: domainKey },
    );
  }
  const rawCandidates = requireArray(
    candidateSlots,
    'Product result candidates',
    code,
  );
  const candidates = rawCandidates.map(
    (candidate, index) => validateCandidate(
      candidate,
      queryIr,
      index,
      code,
    ),
  );
  const slotIdentities = candidates.map(
    (candidate) => candidate.slot.slot_identity,
  );
  if (new Set(slotIdentities).size !== slotIdentities.length) {
    fail(code, 'Product result candidates contain a duplicate slot.');
  }
  requireObject(
    orderingProjection,
    'Domain ordering projection',
    code,
  );
  validateOrderingReceiptShape(orderingReceipt, code);
  const release = queryIr.release_contract;
  if (
    orderingReceipt.product_query_definition_id
      !== queryIr.query_definition_id
    || orderingReceipt.approved_pm_data_version_id
      !== release.approved_pm_data_version_id
    || orderingReceipt.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || orderingReceipt.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
    || orderingReceipt.domain_key !== domainKey
  ) {
    fail(code, 'The Product ordering receipt does not match the query.');
  }
  validateCoverageCertification(
    coverageCertification,
    queryIr,
    code,
  );
  const {
    orderedSlots,
    excludedCount,
  } = validateProcessOrder({
    queryIr,
    candidates,
    orderingProjection,
    orderingReceipt,
    code,
  });
  const summary = buildExecutionSummary({
    queryIr,
    orderedSlots,
    excludedCount,
    coverageCertification,
  });
  return deepFreeze(clone({
    ordered_result_slots: orderedSlots,
    query_execution_summary: summary,
  }, code));
}

module.exports = {
  PROCESS_ORDERING_VALIDATOR_STABLE_ID,
  PROCESS_ORDERING_VALIDATOR_VERSION,
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ORDERING_RECEIPT_STATE,
  ProductQueryResultSetCompilerError,
  compileProductQueryResultSet,
  compileProductResultSlotFailure,
  validateProductResultSlotFailure,
};
