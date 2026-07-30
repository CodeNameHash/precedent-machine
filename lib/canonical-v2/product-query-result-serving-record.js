const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateProductQueryResult,
} = require('./product-citation-share-compiler');

const PRODUCT_QUERY_RESULT_SERVING_RECORD_SCHEMA =
  'PRODUCT_QUERY_RESULT_SERVING_RECORD/V1';
const PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA =
  'PRODUCT_CANDIDATE_RESULT_RECORD/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProductQueryResultServingRecordError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProductQueryResultServingRecordError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProductQueryResultServingRecordError(code, message);
}

function exactKeys(value, expected, label) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) {
    fail(
      'INVALID_PRODUCT_QUERY_RESULT_SERVING_RECORD',
      `${label} does not match its closed shape.`,
    );
  }
}

function digest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail(
      'INVALID_PRODUCT_QUERY_RESULT_SERVING_RECORD',
      `${label} must be a full SHA-256 digest.`,
    );
  }
}

function buildProductQueryResultServingRecord({
  serving_namespace_id: servingNamespaceId,
  corpus_release_id: corpusReleaseId,
  candidate_product_result_id: candidateProductResultId,
  candidate_product_result_payload_digest: candidatePayloadDigest,
  product_query_result: productQueryResult,
} = {}) {
  [
    ['serving_namespace_id', servingNamespaceId],
    ['corpus_release_id', corpusReleaseId],
    ['candidate_product_result_id', candidateProductResultId],
    ['candidate_product_result_payload_digest', candidatePayloadDigest],
  ].forEach(([label, value]) => requireDigest(value, label));
  try {
    validateProductQueryResult(productQueryResult);
  } catch (error) {
    fail(
      'INVALID_PRODUCT_QUERY_RESULT',
      `The Product query result is invalid: ${error.code || error.message}`,
    );
  }
  if (productQueryResult.schema_version !== 'PRODUCT_QUERY_RESULT/V1') {
    fail(
      'INVALID_PRODUCT_QUERY_RESULT_SERVING_RECORD',
      'The Product result release identity is invalid.',
    );
  }
  const body = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    candidate_release_manifest_id:
      productQueryResult.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      productQueryResult.candidate_release_manifest_payload_digest,
    product_query_definition_id:
      productQueryResult.product_query_definition_id,
    product_query_result_identity:
      productQueryResult.product_query_result_identity,
    domain_key: productQueryResult.domain_key,
    domain_result_identity: productQueryResult.domain_result_identity,
    candidate_product_result_id: candidateProductResultId,
    candidate_product_result_schema_version:
      PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
    candidate_product_result_payload_digest: candidatePayloadDigest,
    canonical_payload: JSON.parse(canonicalJson(productQueryResult)),
    canonical_payload_digest: digest(productQueryResult),
    serving_state: 'CANDIDATE_NOT_ACTIVE',
    authority_state: 'NOT_GRANTED',
  };
  return Object.freeze({
    schema_version: PRODUCT_QUERY_RESULT_SERVING_RECORD_SCHEMA,
    product_query_result_serving_record_id: contentId(
      PRODUCT_QUERY_RESULT_SERVING_RECORD_SCHEMA,
      body,
    ),
    ...body,
  });
}

function validateProductQueryResultServingRecord(value, input) {
  exactKeys(value, [
    'schema_version',
    'product_query_result_serving_record_id',
    'serving_namespace_id',
    'corpus_release_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'product_query_definition_id',
    'product_query_result_identity',
    'domain_key',
    'domain_result_identity',
    'candidate_product_result_id',
    'candidate_product_result_schema_version',
    'candidate_product_result_payload_digest',
    'canonical_payload',
    'canonical_payload_digest',
    'serving_state',
    'authority_state',
  ], 'Product query-result serving record');
  const rebuilt = buildProductQueryResultServingRecord(input);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(
      'INVALID_PRODUCT_QUERY_RESULT_SERVING_RECORD',
      'The Product query-result serving record changed.',
    );
  }
  return true;
}

module.exports = {
  PRODUCT_CANDIDATE_RESULT_RECORD_SCHEMA,
  PRODUCT_QUERY_RESULT_SERVING_RECORD_SCHEMA,
  ProductQueryResultServingRecordError,
  buildProductQueryResultServingRecord,
  validateProductQueryResultServingRecord,
};
