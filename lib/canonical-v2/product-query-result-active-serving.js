const {
  canonicalJson,
} = require('./canonical-bytes');
const {
  validateProductQueryResult,
} = require('./product-citation-share-compiler');

const ACTIVE_PRODUCT_QUERY_RPC =
  'canonical_v2_active_product_query_results';
const ACTIVE_PRODUCT_QUERY_PAGE_SCHEMA =
  'PRODUCT_QUERY_RESULT_ACTIVE_PAGE/V1';
const MAX_PAGE_SIZE = 50;
const MAX_TIMEOUT_MS = 2500;
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProductQueryResultActiveServingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProductQueryResultActiveServingError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProductQueryResultActiveServingError(code, message);
}

function exactKeys(value, expected, label) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())
  ) {
    fail('INVALID_ACTIVE_PRODUCT_QUERY_RESPONSE', `${label} has an invalid shape.`);
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_ACTIVE_PRODUCT_QUERY_REQUEST', `${label} must be a SHA-256 digest.`);
  }
}

function validateRequest(request) {
  exactKeys(request, [
    'environment',
    'serving_namespace_id',
    'corpus_release_id',
    'product_query_definition_id',
    'after_product_query_result_identity',
    'page_size',
  ], 'Active Product query request');
  if (request.environment !== 'staging') {
    fail('INVALID_ACTIVE_PRODUCT_QUERY_REQUEST', 'The active Product query is staging-only.');
  }
  [
    'serving_namespace_id',
    'corpus_release_id',
    'product_query_definition_id',
  ].forEach((key) => requireDigest(request[key], key));
  if (
    request.after_product_query_result_identity !== null
    && !SHA256_RE.test(request.after_product_query_result_identity || '')
  ) {
    fail(
      'INVALID_ACTIVE_PRODUCT_QUERY_REQUEST',
      'The active Product query cursor is invalid.',
    );
  }
  if (
    !Number.isInteger(request.page_size)
    || request.page_size < 1
    || request.page_size > MAX_PAGE_SIZE
  ) {
    fail(
      'INVALID_ACTIVE_PRODUCT_QUERY_REQUEST',
      `The active Product query page size must be between 1 and ${MAX_PAGE_SIZE}.`,
    );
  }
}

function validateResponse(response, request) {
  exactKeys(response, [
    'schema_version',
    'serving_namespace_id',
    'corpus_release_id',
    'candidate_release_import_plan_id',
    'candidate_manifest_id',
    'product_query_definition_id',
    'page_count',
    'rows',
    'has_more',
    'next_after_product_query_result_identity',
  ], 'Active Product query response');
  if (
    response.schema_version !== ACTIVE_PRODUCT_QUERY_PAGE_SCHEMA
    || response.serving_namespace_id !== request.serving_namespace_id
    || response.corpus_release_id !== request.corpus_release_id
    || response.product_query_definition_id
      !== request.product_query_definition_id
  ) {
    fail(
      'INVALID_ACTIVE_PRODUCT_QUERY_RESPONSE',
      'The active Product query response is outside its requested release.',
    );
  }
  requireDigest(
    response.candidate_release_import_plan_id,
    'candidate_release_import_plan_id',
  );
  requireDigest(response.candidate_manifest_id, 'candidate_manifest_id');
  if (
    !Array.isArray(response.rows)
    || response.rows.length < 1
    || response.rows.length > request.page_size
    || response.page_count !== response.rows.length
    || typeof response.has_more !== 'boolean'
  ) {
    fail(
      'INVALID_ACTIVE_PRODUCT_QUERY_RESPONSE',
      'The active Product query response exceeds its page bounds.',
    );
  }
  let priorIdentity = request.after_product_query_result_identity;
  response.rows.forEach((row) => {
    exactKeys(row, [
      'product_query_result_serving_record_id',
      'product_query_result_identity',
      'candidate_product_result_id',
      'canonical_payload',
    ], 'Active Product query row');
    requireDigest(
      row.product_query_result_serving_record_id,
      'product_query_result_serving_record_id',
    );
    requireDigest(
      row.product_query_result_identity,
      'product_query_result_identity',
    );
    requireDigest(
      row.candidate_product_result_id,
      'candidate_product_result_id',
    );
    try {
      validateProductQueryResult(row.canonical_payload);
    } catch (error) {
      fail(
        'INVALID_ACTIVE_PRODUCT_QUERY_RESPONSE',
        `The active Product result is invalid: ${error.code || error.message}`,
      );
    }
    if (
      row.product_query_result_identity
        !== row.canonical_payload.product_query_result_identity
      || row.canonical_payload.product_query_definition_id
        !== request.product_query_definition_id
      || row.canonical_payload.candidate_release_manifest_id
        !== response.candidate_manifest_id
      || (priorIdentity !== null
        && row.product_query_result_identity <= priorIdentity)
    ) {
      fail(
        'INVALID_ACTIVE_PRODUCT_QUERY_RESPONSE',
        'The active Product results are stale, duplicated, or reordered.',
      );
    }
    priorIdentity = row.product_query_result_identity;
  });
  const lastIdentity = response.rows.length > 0
    ? response.rows[response.rows.length - 1].product_query_result_identity
    : null;
  if (
    (response.has_more
      && (
        response.rows.length !== request.page_size
        || response.next_after_product_query_result_identity !== lastIdentity
      ))
    || (!response.has_more
      && response.next_after_product_query_result_identity !== null)
  ) {
    fail(
      'INVALID_ACTIVE_PRODUCT_QUERY_RESPONSE',
      'The active Product query cursor is inconsistent.',
    );
  }
  return true;
}

async function withDeadline(promise, timeoutMs) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProductQueryResultActiveServingError(
        'DEADLINE_EXCEEDED',
        'The active Product query exceeded its deadline.',
      ));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function queryActiveProductResults({
  client,
  request,
  timeoutMs = MAX_TIMEOUT_MS,
} = {}) {
  validateRequest(request);
  if (
    !client
    || typeof client.rpc !== 'function'
    || !Number.isInteger(timeoutMs)
    || timeoutMs < 1
    || timeoutMs > MAX_TIMEOUT_MS
  ) {
    fail(
      'INVALID_ACTIVE_PRODUCT_QUERY_REQUEST',
      'The active Product query client or deadline is invalid.',
    );
  }
  const response = await withDeadline(Promise.resolve(client.rpc(
    ACTIVE_PRODUCT_QUERY_RPC,
    {
      p_environment: request.environment,
      p_serving_namespace_id: request.serving_namespace_id,
      p_corpus_release_id: request.corpus_release_id,
      p_product_query_definition_id:
        request.product_query_definition_id,
      p_after_product_query_result_identity:
        request.after_product_query_result_identity,
      p_page_size: request.page_size,
    },
  )), timeoutMs);
  if (response?.error || !response?.data) {
    fail(
      'ACTIVE_PRODUCT_QUERY_FAILED',
      'The active Product query failed closed.',
    );
  }
  validateResponse(response.data, request);
  return Object.freeze(JSON.parse(canonicalJson(response.data)));
}

module.exports = {
  ACTIVE_PRODUCT_QUERY_PAGE_SCHEMA,
  ACTIVE_PRODUCT_QUERY_RPC,
  MAX_PAGE_SIZE,
  MAX_TIMEOUT_MS,
  ProductQueryResultActiveServingError,
  queryActiveProductResults,
  validateResponse,
};
