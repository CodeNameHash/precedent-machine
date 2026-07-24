const { canonicalJson, contentId, utf8ByteLength } = require('./canonical-bytes');
const { validateSharedServingRow } = require('./shared-serving-row');
const {
  isRejectedServingContractFingerprint,
} = require('./serving-contract-policy');

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

function verifyContentAddressedObject({
  value,
  idKey,
  idDomain,
  digestKey,
  digestDomain,
  label,
}) {
  const {
    [idKey]: objectId,
    [digestKey]: payloadDigest,
    ...body
  } = value || {};
  if (objectId !== contentId(idDomain, body)
    || payloadDigest !== contentId(digestDomain, body)) {
    throw new ServingExactDetailError(
      'INVALID_RESPONSE',
      `${label} identity does not match its canonical payload.`,
    );
  }
  return body;
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
  const compiled = {
    serving_namespace_id: digest(request.serving_namespace_id, 'serving_namespace_id'),
    corpus_release_id: digest(request.corpus_release_id, 'corpus_release_id'),
    contract_fingerprint: digest(request.contract_fingerprint, 'contract_fingerprint'),
    application_deal_id: request.application_deal_id.toLowerCase(),
    row_serving_key: digest(request.row_serving_key, 'row_serving_key'),
    source_detail_reference_id: digest(request.source_detail_reference_id, 'source_detail_reference_id'),
  };
  if (isRejectedServingContractFingerprint(compiled.contract_fingerprint)) {
    throw new ServingExactDetailError('INVALID_REQUEST', 'The rejected F3 contract cannot be served.');
  }
  return Object.freeze(compiled);
}

function compileServingExactDetailByGovernedDealRequest(request) {
  exactKeys(request, [
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'governed_deal_key',
    'row_serving_key',
    'source_detail_reference_id',
  ], 'request');
  if (typeof request.governed_deal_key !== 'string'
    || !request.governed_deal_key.trim()
    || request.governed_deal_key.length > 256) {
    throw new ServingExactDetailError(
      'INVALID_REQUEST',
      'governed_deal_key must be a non-empty governed deal identity.',
    );
  }
  const compiled = {
    serving_namespace_id: digest(request.serving_namespace_id, 'serving_namespace_id'),
    corpus_release_id: digest(request.corpus_release_id, 'corpus_release_id'),
    contract_fingerprint: digest(request.contract_fingerprint, 'contract_fingerprint'),
    governed_deal_key: request.governed_deal_key,
    row_serving_key: digest(request.row_serving_key, 'row_serving_key'),
    source_detail_reference_id: digest(request.source_detail_reference_id, 'source_detail_reference_id'),
  };
  if (isRejectedServingContractFingerprint(compiled.contract_fingerprint)) {
    throw new ServingExactDetailError('INVALID_REQUEST', 'The rejected F3 contract cannot be served.');
  }
  return Object.freeze(compiled);
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
  exactKeys(detailPackage, [
    'schema_version',
    'row',
    'action_definitions',
    'detail_payloads',
    'references',
    'parent_edges',
  ], 'exact-detail package', 'INVALID_RESPONSE');
  if (!detailPackage || detailPackage.schema_version !== 'EXACT_DETAIL_ATOMIC_PACKAGE/V1'
    || !Array.isArray(detailPackage.action_definitions)
    || !Array.isArray(detailPackage.references)
    || !Array.isArray(detailPackage.detail_payloads)
    || !Array.isArray(detailPackage.parent_edges)
    || detailPackage.action_definitions.length !== 1
    || detailPackage.references.length !== 1
    || detailPackage.detail_payloads.length !== 1
    || detailPackage.parent_edges.length !== 1) {
    throw new ServingExactDetailError('INVALID_RESPONSE', 'Exact-detail package is incomplete.');
  }
  if (contentId('EXACT_DETAIL_ATOMIC_PACKAGE/V1', detailPackage)
      !== result.exact_detail_package_digest) {
    throw new ServingExactDetailError('INVALID_RESPONSE', 'Exact-detail package digest does not match its payload.');
  }
  try {
    validateSharedServingRow(detailPackage.row);
  } catch {
    throw new ServingExactDetailError('INVALID_RESPONSE', 'Exact-detail package carries an invalid parent row.');
  }
  const action = detailPackage.action_definitions[0];
  const reference = detailPackage.references[0];
  const payload = detailPackage.detail_payloads[0];
  const edge = detailPackage.parent_edges[0];
  const actionTuple = detailPackage.row.source_actions[0];
  verifyContentAddressedObject({
    value: action,
    idKey: 'action_definition_id',
    idDomain: 'SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1',
    digestKey: 'action_definition_payload_digest',
    digestDomain: 'SERVING_EXACT_DETAIL_ACTION_DEFINITION_PAYLOAD/V1',
    label: 'Exact-detail action definition',
  });
  const payloadBody = verifyContentAddressedObject({
    value: payload,
    idKey: 'source_detail_payload_id',
    idDomain: 'SERVING_EXACT_DETAIL_PAYLOAD/V1',
    digestKey: 'canonical_payload_digest',
    digestDomain: 'SERVING_EXACT_DETAIL_PAYLOAD_BODY/V1',
    label: 'Exact-detail payload',
  });
  verifyContentAddressedObject({
    value: reference,
    idKey: 'source_detail_reference_id',
    idDomain: 'SERVING_EXACT_DETAIL_REFERENCE/V1',
    digestKey: 'canonical_payload_digest',
    digestDomain: 'SERVING_EXACT_DETAIL_REFERENCE_BODY/V1',
    label: 'Exact-detail reference',
  });
  const edgeDomain = edge.schema_version === 'REVIEWED_SOURCE_SPECIFIC_ROW_SOURCE_DETAIL_EDGE/V1'
    ? 'REVIEWED_SOURCE_SPECIFIC_ROW_SOURCE_DETAIL_EDGE'
    : 'RESULT_ROW_SOURCE_DETAIL_EDGE';
  verifyContentAddressedObject({
    value: edge,
    idKey: 'parent_edge_id',
    idDomain: `${edgeDomain}/V1`,
    digestKey: 'canonical_payload_digest',
    digestDomain: `${edgeDomain}_BODY/V1`,
    label: 'Exact-detail parent edge',
  });
  const responseLineage = payload.response_body?.source_lineage;
  const responseLineages = payload.response_body?.source_lineages;
  const expectedLineageDigest = responseLineage
    ? contentId('SERVING_EXACT_DETAIL_SOURCE_LINEAGE/V1', responseLineage)
    : Array.isArray(responseLineages)
      ? contentId('SERVING_EXACT_DETAIL_MULTI_SOURCE_LINEAGE/V1', {
        source_lineages: responseLineages,
      })
      : null;
  const expectedMultiplicityDigest = contentId('SERVING_EXACT_DETAIL_MULTIPLICITY/V1', {
    contextual_use_keys: [reference.contextual_use_key],
    contextual_cardinality: action.contextual_cardinality,
    duplicate_policy: action.duplicate_policy,
  });
  if (detailPackage.row.row_serving_key !== request.row_serving_key
    || detailPackage.row.corpus_release_id !== request.corpus_release_id
    || detailPackage.row.governed_deal_key !== result.governed_deal_key
    || detailPackage.row.provenance?.contract_fingerprint !== request.contract_fingerprint
    || detailPackage.row.source_actions.length !== 1
    || !actionTuple
    || action.schema_version !== 'SERVING_EXACT_DETAIL_ACTION_DEFINITION/V1'
    || payload.schema_version !== 'SERVING_EXACT_DETAIL_PAYLOAD/V1'
    || reference.schema_version !== 'SERVING_EXACT_DETAIL_REFERENCE/V1'
    || ![
      'RESULT_ROW_SOURCE_DETAIL_EDGE/V1',
      'REVIEWED_SOURCE_SPECIFIC_ROW_SOURCE_DETAIL_EDGE/V1',
    ].includes(edge.schema_version)
    || reference.source_detail_reference_id !== request.source_detail_reference_id
    || actionTuple.source_detail_reference_id !== reference.source_detail_reference_id
    || actionTuple.source_detail_payload_id !== payload.source_detail_payload_id
    || actionTuple.parent_edge_id !== edge.parent_edge_id
    || actionTuple.action_slot_key !== action.action_slot_key
    || actionTuple.action_version !== action.action_version
    || actionTuple.action_definition_id !== action.action_definition_id
    || actionTuple.action_definition_payload_digest !== action.action_definition_payload_digest
    || actionTuple.detail_kind !== action.detail_kind
    || actionTuple.governed_ordinal !== reference.governed_ordinal
    || actionTuple.governed_ordinal !== edge.governed_ordinal
    || reference.corpus_release_id !== request.corpus_release_id
    || reference.parent_row_serving_key !== request.row_serving_key
    || reference.action_slot_key !== action.action_slot_key
    || reference.action_version !== action.action_version
    || reference.action_definition_id !== action.action_definition_id
    || reference.selection_path_schema !== action.selection_path_schema
    || reference.source_detail_payload_id !== payload.source_detail_payload_id
    || payload.corpus_release_id !== request.corpus_release_id
    || payload.action_definition_id !== action.action_definition_id
    || payload.detail_kind !== action.detail_kind
    || payload.response_schema !== action.response_schema
    || payload.projection_version !== action.projection_version
    || edge.corpus_release_id !== request.corpus_release_id
    || edge.parent_kind !== action.parent_kind
    || edge.parent_row_serving_key !== request.row_serving_key
    || edge.action_slot_key !== action.action_slot_key
    || edge.action_definition_id !== action.action_definition_id
    || edge.source_detail_reference_id !== reference.source_detail_reference_id
    || edge.source_detail_payload_id !== payload.source_detail_payload_id
    || payloadBody.response_body_digest
      !== contentId('SERVING_EXACT_DETAIL_RESPONSE_BODY/V1', payload.response_body)
    || !expectedLineageDigest
    || payload.source_lineage_digest !== expectedLineageDigest
    || reference.multiplicity_digest !== expectedMultiplicityDigest
    || payload.encoded_byte_length !== utf8ByteLength(canonicalJson(payload.response_body))
    || payload.encoded_byte_length > action.maximum_encoded_bytes) {
    throw new ServingExactDetailError('INVALID_RESPONSE', 'Exact-detail package does not close over the selected row and action.');
  }
  return result;
}

function validateServingExactDetailByGovernedDealResult(result, request) {
  if (!result || result.governed_deal_key !== request.governed_deal_key
    || !UUID_RE.test(result.application_deal_id || '')) {
    throw new ServingExactDetailError(
      'INVALID_RESPONSE',
      'Exact-detail response is outside its governed deal identity.',
    );
  }
  return validateServingExactDetailResult(result, {
    ...request,
    application_deal_id: result.application_deal_id,
  });
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

function governedDealRpcParams(request) {
  return {
    p_environment: 'staging',
    p_serving_namespace_id: request.serving_namespace_id,
    p_corpus_release_id: request.corpus_release_id,
    p_contract_fingerprint: request.contract_fingerprint,
    p_governed_deal_key: request.governed_deal_key,
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

async function queryServingExactDetailByGovernedDeal({
  client,
  request,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!client || typeof client.rpc !== 'function') {
    throw new ServingExactDetailError('DATA_SOURCE_NOT_CONFIGURED', 'A canonical serving client is required.');
  }
  const compiled = compileServingExactDetailByGovernedDealRequest(request);
  let response;
  try {
    response = await withDeadline(
      Promise.resolve(client.rpc(
        'canonical_v2_exact_detail_by_governed_deal',
        governedDealRpcParams(compiled),
      )),
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof ServingExactDetailError) throw error;
    throw new ServingExactDetailError('DATA_SOURCE_ERROR', 'Exact source could not be read.');
  }
  if (!response || response.error || !response.data) {
    throw new ServingExactDetailError('DATA_SOURCE_ERROR', 'Exact source could not be read.');
  }
  return Object.freeze(validateServingExactDetailByGovernedDealResult(response.data, compiled));
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  ServingExactDetailError,
  compileServingExactDetailByGovernedDealRequest,
  compileServingExactDetailRequest,
  queryServingExactDetail,
  queryServingExactDetailByGovernedDeal,
  validateServingExactDetailByGovernedDealResult,
  validateServingExactDetailResult,
};
