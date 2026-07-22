const { contentId } = require('./canonical-bytes');
const { compileFixtureContract } = require('./contract-bundle');

const SHA256_RE = /^[a-f0-9]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;
const DEFAULT_TIMEOUT_MS = 2500;
const CONTRACT_FINGERPRINT = compileFixtureContract().fingerprint;

class ReviewContextError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReviewContextError';
    this.code = code;
  }
}

function exactKeys(value, keys, label, code = 'INVALID_REQUEST') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReviewContextError(code, `${label} must be an object.`);
  }
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new ReviewContextError(code, `${label} fields do not match the canonical Review contract.`);
  }
}

function digest(value, label, code = 'INVALID_REQUEST') {
  if (!SHA256_RE.test(value || '')) throw new ReviewContextError(code, `${label} must be a SHA-256 content ID.`);
  return value;
}

function compileActiveReviewContextRequest(request) {
  exactKeys(request, [
    'contract_fingerprint',
    'application_deal_id',
    'page_size',
    'after_row_serving_key',
  ], 'request');
  if (request.contract_fingerprint !== CONTRACT_FINGERPRINT) {
    throw new ReviewContextError('INVALID_REQUEST', 'contract_fingerprint does not match the frozen contract.');
  }
  if (!UUID_RE.test(request.application_deal_id || '')) {
    throw new ReviewContextError('INVALID_REQUEST', 'application_deal_id must be a UUID.');
  }
  const pageSize = request.page_size == null ? DEFAULT_PAGE_SIZE : request.page_size;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ReviewContextError('INVALID_REQUEST', `page_size must be between 1 and ${MAX_PAGE_SIZE}.`);
  }
  const body = {
    schema_version: 'ACTIVE_REVIEW_CONTEXT_REQUEST/V1',
    contract_fingerprint: digest(request.contract_fingerprint, 'contract_fingerprint'),
    application_deal_id: request.application_deal_id.toLowerCase(),
    page_size: pageSize,
    after_row_serving_key: request.after_row_serving_key == null
      ? null
      : digest(request.after_row_serving_key, 'after_row_serving_key'),
  };
  return Object.freeze({
    ...body,
    request_digest: contentId('ACTIVE_REVIEW_CONTEXT_REQUEST/V1', body),
  });
}

function validateActiveReviewContextResult(result, request) {
  exactKeys(result, [
    'schema_version',
    'request_digest',
    'pointer_id',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'application_deal_id',
    'governed_deal_key',
    'deal_admission_id',
    'total_count',
    'page_count',
    'rows',
    'next_cursor',
  ], 'response', 'INVALID_RESPONSE');
  for (const key of [
    'request_digest',
    'pointer_id',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'deal_admission_id',
  ]) digest(result[key], key, 'INVALID_RESPONSE');
  if (result.schema_version !== 'ACTIVE_REVIEW_CONTEXT_RESULT/V1'
    || result.request_digest !== request.request_digest
    || result.contract_fingerprint !== request.contract_fingerprint
    || result.application_deal_id !== request.application_deal_id
    || typeof result.governed_deal_key !== 'string'
    || !result.governed_deal_key
    || !Number.isInteger(result.total_count)
    || result.total_count < 0
    || !Number.isInteger(result.page_count)
    || result.page_count < 0
    || !Array.isArray(result.rows)
    || result.rows.length !== result.page_count
    || result.page_count > request.page_size
    || result.total_count < result.page_count) {
    throw new ReviewContextError('INVALID_RESPONSE', 'Canonical Review response is outside its request bounds.');
  }
  const seen = new Set();
  let previous = request.after_row_serving_key;
  for (const row of result.rows) {
    const key = row && row.row_serving_key;
    if (!SHA256_RE.test(key || '')
      || seen.has(key)
      || (previous !== null && key.localeCompare(previous) <= 0)
      || row.corpus_release_id !== result.corpus_release_id
      || row.governed_deal_key !== result.governed_deal_key) {
      throw new ReviewContextError('INVALID_RESPONSE', 'Canonical Review response contains an unordered or out-of-scope row.');
    }
    seen.add(key);
    previous = key;
  }
  if (result.next_cursor !== null) digest(result.next_cursor, 'next_cursor', 'INVALID_RESPONSE');
  if (result.next_cursor !== null && (
    !result.rows.length
    || result.page_count !== request.page_size
    || result.total_count <= result.page_count
    || result.next_cursor !== result.rows.at(-1).row_serving_key
  )) {
    throw new ReviewContextError('INVALID_RESPONSE', 'next_cursor is not the last complete row key.');
  }
  return result;
}

function buildActiveReviewContextResult({ pointer, directoryRecord, rows, request }) {
  const compiled = compileActiveReviewContextRequest(request);
  const matching = [...rows].filter((row) => (
    row.corpus_release_id === pointer.corpus_release_id
    && row.governed_deal_key === directoryRecord.governed_deal_key
  )).sort((left, right) => left.row_serving_key.localeCompare(right.row_serving_key));
  const remaining = matching.filter((row) => (
    compiled.after_row_serving_key === null
    || row.row_serving_key.localeCompare(compiled.after_row_serving_key) > 0
  ));
  const page = remaining.slice(0, compiled.page_size);
  return validateActiveReviewContextResult({
    schema_version: 'ACTIVE_REVIEW_CONTEXT_RESULT/V1',
    request_digest: compiled.request_digest,
    pointer_id: pointer.pointer_id,
    serving_namespace_id: pointer.serving_namespace_id,
    corpus_release_id: pointer.corpus_release_id,
    contract_fingerprint: compiled.contract_fingerprint,
    application_deal_id: directoryRecord.application_deal_id,
    governed_deal_key: directoryRecord.governed_deal_key,
    deal_admission_id: directoryRecord.deal_admission_id,
    total_count: matching.length,
    page_count: page.length,
    rows: page,
    next_cursor: remaining.length > compiled.page_size ? page.at(-1).row_serving_key : null,
  }, compiled);
}

function rpcParams(request) {
  return {
    p_environment: 'staging',
    p_contract_fingerprint: request.contract_fingerprint,
    p_request_digest: request.request_digest,
    p_application_deal_id: request.application_deal_id,
    p_page_size: request.page_size,
    p_after_row_serving_key: request.after_row_serving_key,
  };
}

async function withDeadline(promise, timeoutMs) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ReviewContextError(
      'DEADLINE_EXCEEDED',
      'Canonical Review query exceeded its deadline.',
    )), timeoutMs);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function queryActiveReviewContext({ client, request, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!client || typeof client.rpc !== 'function') {
    throw new ReviewContextError('DATA_SOURCE_NOT_CONFIGURED', 'A canonical serving client is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new ReviewContextError('INVALID_REQUEST', 'timeoutMs must be between 1 and 10000.');
  }
  const compiled = compileActiveReviewContextRequest(request);
  let response;
  try {
    response = await withDeadline(
      Promise.resolve(client.rpc('canonical_v2_active_review_context', rpcParams(compiled))),
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof ReviewContextError) throw error;
    throw new ReviewContextError('DATA_SOURCE_ERROR', 'Canonical Review data could not be read.');
  }
  if (!response || response.error || !response.data) {
    throw new ReviewContextError('DATA_SOURCE_ERROR', 'Canonical Review data could not be read.');
  }
  return Object.freeze({
    request: compiled,
    result: validateActiveReviewContextResult(response.data, compiled),
  });
}

module.exports = {
  CONTRACT_FINGERPRINT,
  DEFAULT_PAGE_SIZE,
  DEFAULT_TIMEOUT_MS,
  MAX_PAGE_SIZE,
  ReviewContextError,
  buildActiveReviewContextResult,
  compileActiveReviewContextRequest,
  queryActiveReviewContext,
  validateActiveReviewContextResult,
};
