const { validateSharedServingRow } = require('./shared-serving-row');

const SHA256_RE = /^[a-f0-9]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TIMEOUT_MS = 2500;

class ServingExactDetailError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ServingExactDetailError';
    this.code = code;
  }
}

function exactKeys(value, keys, label, code = 'INVALID_REQUEST') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServingExactDetailError(code, `${label} must be an object.`);
  }
  if (Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new ServingExactDetailError(code, `${label} fields do not match the exact-detail contract.`);
  }
}

function digest(value, label, code = 'INVALID_REQUEST') {
  if (!SHA256_RE.test(value || '')) throw new ServingExactDetailError(code, `${label} must be a SHA-256 content ID.`);
  return value;
}

function compileServingExactDetailRequest(request) {
  exactKeys(request, [
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'application_deal_id',
    'row_serving_key',
    'source_detail_reference_id',
  ], 'request');
  if (!UUID_RE.test(request.application_deal_id || '')) {
    throw new ServingExactDetailError('INVALID_REQUEST', 'application_deal_id must be a UUID.');
  }
  return Object.freeze({
    serving_namespace_id: digest(request.serving_namespace_id, 'serving_namespace_id'),
    corpus_release_id: digest(request.corpus_release_id, 'corpus_release_id'),
    contract_fingerprint: digest(request.contract_fingerprint, 'contract_fingerprint'),
    application_deal_id: request.application_deal_id.toLowerCase(),
    row_serving_key: digest(request.row_serving_key, 'row_serving_key'),
    source_detail_reference_id: digest(request.source_detail_reference_id, 'source_detail_reference_id'),
  });
}

function validateServingExactDetailResult(result, request) {
  exactKeys(result, [
    'schema_version',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'application_deal_id',
    'governed_deal_key',
    'row_serving_key',
    'source_detail_reference_id',
    'exact_detail_package_digest',
    'package',
  ], 'response', 'INVALID_RESPONSE');
  const identityKeys = [
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'application_deal_id',
    'row_serving_key',
    'source_detail_reference_id',
  ];
  if (result.schema_version !== 'SERVING_EXACT_DETAIL_RESULT/V1'
    || identityKeys.some((key) => result[key] !== request[key])
    || typeof result.governed_deal_key !== 'string'
    || !result.governed_deal_key) {
    throw new ServingExactDetailError('INVALID_RESPONSE', 'Exact-detail response is outside its request identity.');
  }
  digest(result.exact_detail_package_digest, 'exact_detail_package_digest', 'INVALID_RESPONSE');
  const detailPackage = result.package;
  if (!detailPackage || detailPackage.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V1'
    || !Array.isArray(detailPackage.references)
    || !Array.isArray(detailPackage.detail_payloads)
    || !Array.isArray(detailPackage.parent_edges)) {
    throw new ServingExactDetailError('INVALID_RESPONSE', 'Exact-detail package is incomplete.');
  }
  try {
    validateSharedServingRow(detailPackage.row);
  } catch {
    throw new ServingExactDetailError('INVALID_RESPONSE', 'Exact-detail package carries an invalid parent row.');
  }
  const reference = detailPackage.references.find((item) => (
    item.source_detail_reference_id === request.source_detail_reference_id
  ));
  const payload = detailPackage.detail_payloads.find((item) => (
    item.source_detail_payload_id === reference?.source_detail_payload_id
  ));
  const edge = detailPackage.parent_edges.find((item) => (
    item.source_detail_reference_id === request.source_detail_reference_id
  ));
  if (detailPackage.row.row_serving_key !== request.row_serving_key
    || detailPackage.row.corpus_release_id !== request.corpus_release_id
    || detailPackage.row.governed_deal_key !== result.governed_deal_key
    || !reference
    || !payload
    || !edge) {
    throw new ServingExactDetailError('INVALID_RESPONSE', 'Exact-detail package does not close over the selected row and action.');
  }
  return result;
}

function rpcParams(request) {
  return {
    p_environment: 'staging',
    p_serving_namespace_id: request.serving_namespace_id,
    p_corpus_release_id: request.corpus_release_id,
    p_contract_fingerprint: request.contract_fingerprint,
    p_application_deal_id: request.application_deal_id,
    p_row_serving_key: request.row_serving_key,
    p_source_detail_reference_id: request.source_detail_reference_id,
  };
}

async function withDeadline(promise, timeoutMs) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ServingExactDetailError(
      'DEADLINE_EXCEEDED',
      'Exact-detail query exceeded its deadline.',
    )), timeoutMs);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function queryServingExactDetail({ client, request, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!client || typeof client.rpc !== 'function') {
    throw new ServingExactDetailError('DATA_SOURCE_NOT_CONFIGURED', 'A canonical serving client is required.');
  }
  const compiled = compileServingExactDetailRequest(request);
  let response;
  try {
    response = await withDeadline(
      Promise.resolve(client.rpc('canonical_v2_exact_detail', rpcParams(compiled))),
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof ServingExactDetailError) throw error;
    throw new ServingExactDetailError('DATA_SOURCE_ERROR', 'Exact source could not be read.');
  }
  if (!response || response.error || !response.data) {
    throw new ServingExactDetailError('DATA_SOURCE_ERROR', 'Exact source could not be read.');
  }
  return Object.freeze(validateServingExactDetailResult(response.data, compiled));
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  ServingExactDetailError,
  compileServingExactDetailRequest,
  queryServingExactDetail,
  validateServingExactDetailResult,
};
