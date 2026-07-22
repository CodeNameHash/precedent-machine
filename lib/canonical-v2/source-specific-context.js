const { contentId } = require('./canonical-bytes');
const { compileFixtureContract } = require('./contract-bundle');
const { validateSharedServingRow } = require('./shared-serving-row');

const SHA256_RE = /^[a-f0-9]{64}$/;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const DEFAULT_TIMEOUT_MS = 2500;
const MAX_CACHE_TTL_SECONDS = 3600;
const FIXTURE_CONTRACT_FINGERPRINT = compileFixtureContract().fingerprint;

class ReviewedDealContextError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReviewedDealContextError';
    this.code = code;
  }
}

function requireDigest(value, label, code = 'INVALID_REQUEST') {
  if (!SHA256_RE.test(value || '')) {
    throw new ReviewedDealContextError(code, `${label} must be a full SHA-256 content ID.`);
  }
  return value;
}

function requireText(value, label, code = 'INVALID_REQUEST') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ReviewedDealContextError(code, `${label} must be a non-empty string.`);
  }
  return value.trim();
}

function exactKeys(value, keys, label, code = 'INVALID_REQUEST') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ReviewedDealContextError(code, `${label} must be an object.`);
  }
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new ReviewedDealContextError(code, `${label} fields do not match the reviewed-deal context contract.`);
  }
}

function projectReviewedSourceSpecificRecord({ row, serving_namespace_id }) {
  validateSharedServingRow(row);
  if (row.row_kind !== 'REVIEWED_SOURCE_SPECIFIC') {
    throw new ReviewedDealContextError('INVALID_RECORD', 'Only a final reviewed source-specific row may enter this projection.');
  }
  const servingNamespaceId = requireDigest(serving_namespace_id, 'serving_namespace_id', 'INVALID_RECORD');
  const body = row.reviewed_source_specific;
  const projectionBody = {
    schema_version: 'REVIEWED_SOURCE_SPECIFIC_SERVING_RECORD/V1',
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: row.corpus_release_id,
    row_serving_key: row.row_serving_key,
    contract_fingerprint: row.provenance.contract_fingerprint,
    governed_deal_key: row.governed_deal_key,
    open_world_candidate_occurrence_id: body.candidate_occurrence.open_world_candidate_occurrence_id,
    final_disposition_id: body.final_disposition.final_disposition_id,
    disposition_code: body.final_disposition.disposition_code,
    market_cohort_eligible: false,
    aggregate_authority: 'NO_AGGREGATE_AUTHORITY',
    canonical_payload: row,
    canonical_payload_digest: row.canonical_payload_digest,
  };
  const record = Object.freeze({
    ...projectionBody,
    reviewed_source_specific_serving_key: contentId('REVIEWED_SOURCE_SPECIFIC_SERVING_RECORD/V1', {
      serving_namespace_id: servingNamespaceId,
      corpus_release_id: row.corpus_release_id,
      row_serving_key: row.row_serving_key,
    }),
  });
  validateReviewedSourceSpecificRecord(record);
  return record;
}

function validateReviewedSourceSpecificRecord(record) {
  exactKeys(record, [
    'schema_version',
    'serving_namespace_id',
    'corpus_release_id',
    'row_serving_key',
    'contract_fingerprint',
    'governed_deal_key',
    'open_world_candidate_occurrence_id',
    'final_disposition_id',
    'disposition_code',
    'market_cohort_eligible',
    'aggregate_authority',
    'canonical_payload',
    'canonical_payload_digest',
    'reviewed_source_specific_serving_key',
  ], 'reviewed source-specific serving record', 'INVALID_RECORD');
  for (const key of [
    'serving_namespace_id',
    'corpus_release_id',
    'row_serving_key',
    'contract_fingerprint',
    'open_world_candidate_occurrence_id',
    'final_disposition_id',
    'canonical_payload_digest',
    'reviewed_source_specific_serving_key',
  ]) requireDigest(record[key], key, 'INVALID_RECORD');
  requireText(record.governed_deal_key, 'governed_deal_key', 'INVALID_RECORD');
  validateSharedServingRow(record.canonical_payload);
  const row = record.canonical_payload;
  const body = row.reviewed_source_specific;
  const expectedServingKey = contentId('REVIEWED_SOURCE_SPECIFIC_SERVING_RECORD/V1', {
    serving_namespace_id: record.serving_namespace_id,
    corpus_release_id: record.corpus_release_id,
    row_serving_key: record.row_serving_key,
  });
  if (record.schema_version !== 'REVIEWED_SOURCE_SPECIFIC_SERVING_RECORD/V1'
    || row.row_kind !== 'REVIEWED_SOURCE_SPECIFIC'
    || record.corpus_release_id !== row.corpus_release_id
    || record.row_serving_key !== row.row_serving_key
    || record.contract_fingerprint !== row.provenance.contract_fingerprint
    || record.governed_deal_key !== row.governed_deal_key
    || record.open_world_candidate_occurrence_id
      !== body.candidate_occurrence.open_world_candidate_occurrence_id
    || record.final_disposition_id !== body.final_disposition.final_disposition_id
    || record.disposition_code !== 'REVIEWED_SOURCE_SPECIFIC'
    || record.market_cohort_eligible !== false
    || record.aggregate_authority !== 'NO_AGGREGATE_AUTHORITY'
    || record.canonical_payload_digest !== row.canonical_payload_digest
    || record.reviewed_source_specific_serving_key !== expectedServingKey) {
    throw new ReviewedDealContextError('INVALID_RECORD', 'Reviewed source-specific projection does not close over its serving row.');
  }
  for (const forbidden of ['concept_key', 'metric_key', 'party_role', 'canonical_numeric_value']) {
    if (Object.hasOwn(record, forbidden)) {
      throw new ReviewedDealContextError('INVALID_RECORD', `Reviewed source-specific projection may not carry ${forbidden}.`);
    }
  }
  return true;
}

function compileReviewedDealContextRequest(request) {
  exactKeys(request, [
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'governed_deal_key',
    'page_size',
    'after_row_serving_key',
  ], 'request');
  if (request.contract_fingerprint !== FIXTURE_CONTRACT_FINGERPRINT) {
    throw new ReviewedDealContextError('INVALID_REQUEST', 'contract_fingerprint does not match the frozen serving contract.');
  }
  const pageSize = request.page_size == null ? DEFAULT_PAGE_SIZE : request.page_size;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ReviewedDealContextError('INVALID_REQUEST', `page_size must be between 1 and ${MAX_PAGE_SIZE}.`);
  }
  const compiledBody = {
    schema_version: 'REVIEWED_DEAL_CONTEXT_REQUEST/V1',
    serving_namespace_id: requireDigest(request.serving_namespace_id, 'serving_namespace_id'),
    corpus_release_id: requireDigest(request.corpus_release_id, 'corpus_release_id'),
    contract_fingerprint: requireDigest(request.contract_fingerprint, 'contract_fingerprint'),
    governed_deal_key: requireText(request.governed_deal_key, 'governed_deal_key'),
    page_size: pageSize,
    after_row_serving_key: request.after_row_serving_key == null
      ? null
      : requireDigest(request.after_row_serving_key, 'after_row_serving_key'),
  };
  const requestDigest = contentId('REVIEWED_DEAL_CONTEXT_REQUEST/V1', compiledBody);
  return Object.freeze({
    ...compiledBody,
    request_digest: requestDigest,
    cache_key: contentId('REVIEWED_DEAL_CONTEXT_CACHE/V1', {
      serving_namespace_id: compiledBody.serving_namespace_id,
      corpus_release_id: compiledBody.corpus_release_id,
      request_digest: requestDigest,
    }),
  });
}

function validateReviewedDealContextResult(result, request) {
  exactKeys(result, [
    'schema_version',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'request_digest',
    'governed_deal_key',
    'total_count',
    'page_count',
    'rows',
    'next_cursor',
  ], 'reviewed-deal context response', 'INVALID_RESPONSE');
  if (result.schema_version !== 'REVIEWED_DEAL_CONTEXT_RESULT/V1'
    || result.serving_namespace_id !== request.serving_namespace_id
    || result.corpus_release_id !== request.corpus_release_id
    || result.contract_fingerprint !== request.contract_fingerprint
    || result.request_digest !== request.request_digest
    || result.governed_deal_key !== request.governed_deal_key) {
    throw new ReviewedDealContextError('INVALID_RESPONSE', 'Reviewed-deal context response does not match the compiled request.');
  }
  if (!Number.isInteger(result.total_count) || result.total_count < 0
    || !Number.isInteger(result.page_count) || result.page_count < 0
    || !Array.isArray(result.rows)
    || result.rows.length !== result.page_count
    || result.page_count > request.page_size
    || result.total_count < result.page_count) {
    throw new ReviewedDealContextError('INVALID_RESPONSE', 'Reviewed-deal context response exceeds its bounded page contract.');
  }
  let previous = request.after_row_serving_key;
  const seen = new Set();
  for (const row of result.rows) {
    try {
      validateSharedServingRow(row);
    } catch {
      throw new ReviewedDealContextError('INVALID_RESPONSE', 'Reviewed-deal context contains an invalid shared serving row.');
    }
    if (row.row_kind !== 'REVIEWED_SOURCE_SPECIFIC'
      || row.corpus_release_id !== request.corpus_release_id
      || row.provenance.contract_fingerprint !== request.contract_fingerprint
      || row.governed_deal_key !== request.governed_deal_key
      || seen.has(row.row_serving_key)
      || (previous !== null && row.row_serving_key.localeCompare(previous) <= 0)) {
      throw new ReviewedDealContextError('INVALID_RESPONSE', 'Reviewed-deal context contains a duplicate, out-of-scope or unordered row.');
    }
    seen.add(row.row_serving_key);
    previous = row.row_serving_key;
  }
  if (result.next_cursor !== null) requireDigest(result.next_cursor, 'next_cursor', 'INVALID_RESPONSE');
  if (result.next_cursor !== null && (
    !result.rows.length
    || result.page_count !== request.page_size
    || result.total_count <= result.page_count
    || result.next_cursor !== result.rows.at(-1).row_serving_key
  )) {
    throw new ReviewedDealContextError('INVALID_RESPONSE', 'next_cursor is not the last complete row key.');
  }
  return result;
}

function buildReviewedDealContextResult({ records, request }) {
  const compiled = compileReviewedDealContextRequest(request);
  if (!Array.isArray(records)) throw new ReviewedDealContextError('INVALID_RECORD', 'records must be an array.');
  const matching = records.map((record) => {
    validateReviewedSourceSpecificRecord(record);
    return record;
  }).filter((record) => (
    record.serving_namespace_id === compiled.serving_namespace_id
    && record.corpus_release_id === compiled.corpus_release_id
    && record.contract_fingerprint === compiled.contract_fingerprint
    && record.governed_deal_key === compiled.governed_deal_key
  )).sort((left, right) => left.row_serving_key.localeCompare(right.row_serving_key));
  const remaining = matching.filter((record) => (
    compiled.after_row_serving_key === null
    || record.row_serving_key.localeCompare(compiled.after_row_serving_key) > 0
  ));
  const page = remaining.slice(0, compiled.page_size);
  const result = {
    schema_version: 'REVIEWED_DEAL_CONTEXT_RESULT/V1',
    serving_namespace_id: compiled.serving_namespace_id,
    corpus_release_id: compiled.corpus_release_id,
    contract_fingerprint: compiled.contract_fingerprint,
    request_digest: compiled.request_digest,
    governed_deal_key: compiled.governed_deal_key,
    total_count: matching.length,
    page_count: page.length,
    rows: page.map((record) => record.canonical_payload),
    next_cursor: remaining.length > compiled.page_size ? page.at(-1).row_serving_key : null,
  };
  return Object.freeze(validateReviewedDealContextResult(result, compiled));
}

function rpcParams(request) {
  return {
    p_environment: 'staging',
    p_serving_namespace_id: request.serving_namespace_id,
    p_corpus_release_id: request.corpus_release_id,
    p_contract_fingerprint: request.contract_fingerprint,
    p_request_digest: request.request_digest,
    p_governed_deal_key: request.governed_deal_key,
    p_page_size: request.page_size,
    p_after_row_serving_key: request.after_row_serving_key,
  };
}

async function withDeadline(promise, timeoutMs) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ReviewedDealContextError(
      'DEADLINE_EXCEEDED',
      'Reviewed-deal context query exceeded its deadline.',
    )), timeoutMs);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function queryReviewedDealContext({
  client,
  cache = null,
  request,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  cacheTtlSeconds = MAX_CACHE_TTL_SECONDS,
}) {
  if (!client || typeof client.rpc !== 'function') {
    throw new ReviewedDealContextError('DATA_SOURCE_NOT_CONFIGURED', 'A reviewed-deal context RPC client is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new ReviewedDealContextError('INVALID_REQUEST', 'timeoutMs must be between 1 and 10000.');
  }
  if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds < 1 || cacheTtlSeconds > MAX_CACHE_TTL_SECONDS) {
    throw new ReviewedDealContextError('INVALID_REQUEST', `cacheTtlSeconds must be between 1 and ${MAX_CACHE_TTL_SECONDS}.`);
  }
  const compiled = compileReviewedDealContextRequest(request);
  if (cache && typeof cache.get === 'function') {
    const cached = await cache.get(compiled.cache_key);
    if (cached !== null && cached !== undefined) {
      return { result: validateReviewedDealContextResult(cached, compiled), cache: 'HIT', request: compiled };
    }
  }
  let response;
  try {
    response = await withDeadline(
      Promise.resolve(client.rpc('canonical_v2_reviewed_deal_context', rpcParams(compiled))),
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof ReviewedDealContextError) throw error;
    throw new ReviewedDealContextError('DATA_SOURCE_ERROR', 'Reviewed-deal context could not be read.');
  }
  if (!response || response.error) {
    throw new ReviewedDealContextError('DATA_SOURCE_ERROR', 'Reviewed-deal context could not be read.');
  }
  const result = validateReviewedDealContextResult(response.data, compiled);
  if (cache && typeof cache.set === 'function') {
    await cache.set(compiled.cache_key, result, cacheTtlSeconds);
  }
  return { result, cache: 'MISS', request: compiled };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  DEFAULT_TIMEOUT_MS,
  FIXTURE_CONTRACT_FINGERPRINT,
  MAX_CACHE_TTL_SECONDS,
  MAX_PAGE_SIZE,
  ReviewedDealContextError,
  buildReviewedDealContextResult,
  compileReviewedDealContextRequest,
  projectReviewedSourceSpecificRecord,
  queryReviewedDealContext,
  validateReviewedDealContextResult,
  validateReviewedSourceSpecificRecord,
};
