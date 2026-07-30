const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateProductActiveReleaseResolution,
} = require('./product-rerun-compiler');
const {
  PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA,
  validateProductExactCitation,
  validateProductQueryResult,
} = require('./product-citation-share-compiler');

const PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD_SCHEMA =
  'PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD/V1';
const PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA =
  'PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_SELECTED_RESULTS = 50;

class ProductSelectedResultExportCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductSelectedResultExportCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductSelectedResultExportCompilerError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT',
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

function requireText(value, label, code) {
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

function requireDigest(value, label, code) {
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

function requireArray(value, label, code) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(value, code = 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product selected-result export is not canonical JSON.', {
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

function fieldKey(reference) {
  return canonicalJson(reference);
}

function validateFieldReference(reference, label, code) {
  requireExactKeys(reference, ['field_key', 'field_version'], label, code);
  requireText(reference.field_key, `${label} field_key`, code);
  requirePositiveInteger(reference.field_version, `${label} field_version`, code);
}

function validateOwnerBinding(binding, code) {
  requireExactKeys(binding, [
    'schema_version',
    'actor_principal_id',
    'object_authorisation_binding_id',
    'runtime_authorisation_state',
  ], 'Product export owner binding', code);
  if (
    binding.schema_version !== PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA
    || binding.runtime_authorisation_state !== 'REQUIRED_BEFORE_USE'
  ) {
    fail(code, 'The Product export owner binding is invalid.');
  }
  requireText(binding.actor_principal_id, 'Export actor principal ID', code);
  requireDigest(
    binding.object_authorisation_binding_id,
    'Export object-authorisation binding ID',
    code,
  );
}

function releaseBinding(value) {
  return {
    candidate_release_manifest_id:
      value.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      value.candidate_release_manifest_payload_digest,
  };
}

function sameRelease(left, right) {
  return canonicalJson(releaseBinding(left))
    === canonicalJson(releaseBinding(right));
}

function refusal({
  disposition,
  queryId,
  selectedIds,
  sourceRelease,
  resolution,
}) {
  const body = {
    schema_version: PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA,
    product_query_definition_id: queryId,
    ordered_selected_product_result_identities: selectedIds,
    source_release: sourceRelease,
    active_release_resolution_id: resolution.resolution_id,
    active_release: releaseBinding(resolution),
    disposition,
    emitted_result_count: 0,
    partial_export_permitted: false,
    authority_state: 'NOT_GRANTED',
  };
  return deepFreeze({
    schema_version: body.schema_version,
    export_refusal_id: contentId(
      PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA,
      body,
    ),
    product_query_definition_id:
      body.product_query_definition_id,
    ordered_selected_product_result_identities:
      body.ordered_selected_product_result_identities,
    source_release: body.source_release,
    active_release_resolution_id:
      body.active_release_resolution_id,
    active_release: body.active_release,
    disposition: body.disposition,
    emitted_result_count: body.emitted_result_count,
    partial_export_permitted: body.partial_export_permitted,
    authority_state: body.authority_state,
  });
}

function resultProjection(result, requestedReferences) {
  const values = new Map(
    result.result_fields.map(
      (field) => [fieldKey(field.field_reference), field],
    ),
  );
  return {
    product_query_result_identity:
      result.product_query_result_identity,
    product_query_definition_id:
      result.product_query_definition_id,
    approved_pm_data_version_id:
      result.approved_pm_data_version_id,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition: clone(result.domain_result_definition),
    domain_result_identity: result.domain_result_identity,
    domain_result_source_representation_kind:
      result.domain_result_source_representation_kind,
    exact_citation: clone(result.exact_citation),
    fields: requestedReferences.map((reference) => clone(
      values.get(fieldKey(reference)),
    )),
  };
}

function exportIdentityPayload(payload) {
  return {
    schema_version: payload.schema_version,
    product_query_definition_id:
      payload.product_query_definition_id,
    approved_pm_data_version_id:
      payload.approved_pm_data_version_id,
    candidate_release_manifest_id:
      payload.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      payload.candidate_release_manifest_payload_digest,
    ordered_selected_product_result_identities:
      payload.ordered_selected_product_result_identities,
    ordered_requested_field_references:
      payload.ordered_requested_field_references,
    export_contract_version: payload.export_contract_version,
  };
}

function exportPayloadDigestPayload(payload) {
  const body = clone(payload);
  delete body.product_selected_result_export_id;
  delete body.canonical_payload_digest;
  return body;
}

function compileProductSelectedResultExport({
  product_query_results: results,
  ordered_selected_product_result_identities: selectedIds,
  ordered_requested_field_references: requestedReferences,
  active_release_resolution: resolution,
  object_authorisation_binding: ownerBinding,
}) {
  const code = 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT_INPUT';
  requireArray(results, 'Product query results', code);
  requireArray(selectedIds, 'Selected Product result identities', code);
  requireArray(requestedReferences, 'Requested export field references', code);
  if (
    selectedIds.length < 1
    || selectedIds.length > MAX_SELECTED_RESULTS
    || new Set(selectedIds).size !== selectedIds.length
  ) {
    fail(code, 'Product export selection must contain 1 to 50 unique result identities.');
  }
  selectedIds.forEach((value, index) => requireDigest(
    value,
    `Selected Product result identity ${index}`,
    code,
  ));
  if (
    requestedReferences.length < 1
    || new Set(requestedReferences.map(fieldKey)).size
      !== requestedReferences.length
  ) {
    fail(code, 'Product export fields must be a non-empty unique ordered set.');
  }
  requestedReferences.forEach((reference, index) => validateFieldReference(
    reference,
    `Requested export field ${index}`,
    code,
  ));
  validateOwnerBinding(ownerBinding, code);
  try {
    validateProductActiveReleaseResolution(resolution);
  } catch (error) {
    fail(code, 'Product export requires a valid fresh active release.', {
      cause: error.code || error.message,
    });
  }

  const byId = new Map();
  for (const result of results) {
    validateProductQueryResult(result);
    if (byId.has(result.product_query_result_identity)) {
      fail(code, 'Product query results contain a duplicate identity.');
    }
    byId.set(result.product_query_result_identity, result);
  }
  const first = byId.get(selectedIds[0]);
  if (!first) {
    return refusal({
      disposition: 'RESULT_NOT_IN_PINNED_RELEASE',
      queryId: null,
      selectedIds: clone(selectedIds),
      sourceRelease: null,
      resolution,
    });
  }
  if (!sameRelease(first, resolution)) {
    return refusal({
      disposition: 'RELEASE_NOT_ACTIVE',
      queryId: first.product_query_definition_id,
      selectedIds: clone(selectedIds),
      sourceRelease: releaseBinding(first),
      resolution,
    });
  }

  const selected = [];
  let lastIndex = -1;
  for (const selectedId of selectedIds) {
    const result = byId.get(selectedId);
    const index = results.indexOf(result);
    if (!result) {
      return refusal({
        disposition: 'RESULT_NOT_IN_PINNED_RELEASE',
        queryId: first.product_query_definition_id,
        selectedIds: clone(selectedIds),
        sourceRelease: releaseBinding(first),
        resolution,
      });
    }
    if (index <= lastIndex) {
      fail(code, 'Selected Product results are not in query order.');
    }
    lastIndex = index;
    if (
      result.product_query_definition_id
        !== first.product_query_definition_id
      || result.approved_pm_data_version_id
        !== first.approved_pm_data_version_id
      || !sameRelease(result, first)
    ) {
      fail(code, 'Selected Product results do not belong to one query and release.');
    }
    const admittedFields = new Set(
      result.query_provenance.requested_field_references.map(fieldKey),
    );
    if (requestedReferences.some(
      (reference) => !admittedFields.has(fieldKey(reference)),
    )) {
      return refusal({
        disposition: 'FIELD_NOT_IN_CHECKED_RESULT',
        queryId: first.product_query_definition_id,
        selectedIds: clone(selectedIds),
        sourceRelease: releaseBinding(first),
        resolution,
      });
    }
    selected.push(result);
  }

  const firstProvenance = first.query_provenance;
  if (selected.some((result) => (
    canonicalJson(result.query_provenance.filter_contract)
      !== canonicalJson(firstProvenance.filter_contract)
    || canonicalJson(result.query_provenance.coverage_contract)
      !== canonicalJson(firstProvenance.coverage_contract)
  ))) {
    fail(code, 'Selected Product results do not share exact query provenance.');
  }

  const body = {
    schema_version: PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD_SCHEMA,
    product_query_definition_id:
      first.product_query_definition_id,
    approved_pm_data_version_id:
      first.approved_pm_data_version_id,
    candidate_release_manifest_id:
      first.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      first.candidate_release_manifest_payload_digest,
    ordered_selected_product_result_identities: clone(selectedIds),
    ordered_requested_field_references: clone(requestedReferences),
    export_contract_version: 1,
    query_provenance: {
      filter_contract: clone(firstProvenance.filter_contract),
      coverage_contract: clone(firstProvenance.coverage_contract),
    },
    results: selected.map(
      (result) => resultProjection(result, requestedReferences),
    ),
    selected_result_count: selected.length,
    emitted_result_count: selected.length,
    object_authorisation_binding: clone(ownerBinding),
    render_state: 'CANONICAL_PAYLOAD_ONLY',
    authority_state: 'NOT_GRANTED',
  };
  const exportId = contentId(
    'PRODUCT_SELECTED_RESULT_EXPORT/V1',
    exportIdentityPayload(body),
  );
  const payload = {
    schema_version: body.schema_version,
    product_selected_result_export_id: exportId,
    canonical_payload_digest: null,
    product_query_definition_id:
      body.product_query_definition_id,
    approved_pm_data_version_id:
      body.approved_pm_data_version_id,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    ordered_selected_product_result_identities:
      body.ordered_selected_product_result_identities,
    ordered_requested_field_references:
      body.ordered_requested_field_references,
    export_contract_version: body.export_contract_version,
    query_provenance: body.query_provenance,
    results: body.results,
    selected_result_count: body.selected_result_count,
    emitted_result_count: body.emitted_result_count,
    object_authorisation_binding:
      body.object_authorisation_binding,
    render_state: body.render_state,
    authority_state: body.authority_state,
  };
  payload.canonical_payload_digest = sha256Hex(Buffer.from(
    canonicalJson(exportPayloadDigestPayload(payload)),
    'utf8',
  ));
  validateProductSelectedResultExportOutcome(payload);
  return deepFreeze(payload);
}

function validateResultProjection(result, payload, code) {
  requireExactKeys(result, [
    'product_query_result_identity',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_key',
    'domain_result_definition',
    'domain_result_identity',
    'domain_result_source_representation_kind',
    'exact_citation',
    'fields',
  ], 'Product export result projection', code);
  [
    'product_query_result_identity',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_result_identity',
  ].forEach((key) => requireDigest(result[key], `Export result ${key}`, code));
  requireText(result.domain_key, 'Export result domain key', code);
  if (
    result.product_query_definition_id
      !== payload.product_query_definition_id
    || result.approved_pm_data_version_id
      !== payload.approved_pm_data_version_id
    || !sameRelease(result, payload)
  ) {
    fail(code, 'A Product export result does not match the export query and release.');
  }
  requireExactKeys(
    result.domain_result_definition,
    ['stable_id', 'version'],
    'Export domain result definition',
    code,
  );
  requireText(
    result.domain_result_definition.stable_id,
    'Export domain result stable ID',
    code,
  );
  requirePositiveInteger(
    result.domain_result_definition.version,
    'Export domain result version',
    code,
  );
  validateProductExactCitation(result.exact_citation, {
    product_query_result_identity:
      result.product_query_result_identity,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    domain_result_source_representation_kind:
      result.domain_result_source_representation_kind,
  });
  const fields = requireArray(result.fields, 'Export result fields', code);
  if (fields.length !== payload.ordered_requested_field_references.length) {
    fail(code, 'A Product export result does not contain every requested field.');
  }
  fields.forEach((field, index) => {
    requireExactKeys(
      field,
      ['field_reference', 'value'],
      `Export result field ${index}`,
      code,
    );
    if (
      canonicalJson(field.field_reference)
        !== canonicalJson(payload.ordered_requested_field_references[index])
    ) {
      fail(code, 'A Product export result field order has changed.');
    }
    clone(field.value, code);
  });
}

function validatePayload(payload) {
  const code = 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD';
  requireExactKeys(payload, [
    'schema_version',
    'product_selected_result_export_id',
    'canonical_payload_digest',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'ordered_selected_product_result_identities',
    'ordered_requested_field_references',
    'export_contract_version',
    'query_provenance',
    'results',
    'selected_result_count',
    'emitted_result_count',
    'object_authorisation_binding',
    'render_state',
    'authority_state',
  ], 'Product selected-result export payload', code);
  if (
    payload.schema_version
      !== PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD_SCHEMA
    || payload.export_contract_version !== 1
    || payload.render_state !== 'CANONICAL_PAYLOAD_ONLY'
    || payload.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product selected-result export state is invalid.');
  }
  [
    'product_selected_result_export_id',
    'canonical_payload_digest',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
  ].forEach((key) => requireDigest(payload[key], `Product export ${key}`, code));
  validateOwnerBinding(payload.object_authorisation_binding, code);
  const selectedIds = requireArray(
    payload.ordered_selected_product_result_identities,
    'Export selected result identities',
    code,
  );
  if (
    selectedIds.length < 1
    || selectedIds.length > MAX_SELECTED_RESULTS
    || new Set(selectedIds).size !== selectedIds.length
  ) {
    fail(code, 'Product export selected result identities are invalid.');
  }
  selectedIds.forEach((value, index) => requireDigest(
    value,
    `Export selected result identity ${index}`,
    code,
  ));
  const references = requireArray(
    payload.ordered_requested_field_references,
    'Export requested field references',
    code,
  );
  if (
    references.length < 1
    || new Set(references.map(fieldKey)).size !== references.length
  ) {
    fail(code, 'Product export requested field references are invalid.');
  }
  references.forEach((reference, index) => validateFieldReference(
    reference,
    `Export requested field ${index}`,
    code,
  ));
  requireExactKeys(payload.query_provenance, [
    'filter_contract',
    'coverage_contract',
  ], 'Product export query provenance', code);
  clone(payload.query_provenance.filter_contract, code);
  clone(payload.query_provenance.coverage_contract, code);
  const results = requireArray(payload.results, 'Product export results', code);
  if (
    results.length !== selectedIds.length
    || payload.selected_result_count !== selectedIds.length
    || payload.emitted_result_count !== selectedIds.length
  ) {
    fail(code, 'Product export result counts do not reconcile.');
  }
  results.forEach((result, index) => {
    validateResultProjection(result, payload, code);
    if (
      result.product_query_result_identity !== selectedIds[index]
    ) {
      fail(code, 'Product export result order does not match the selection.');
    }
  });
  if (
    payload.product_selected_result_export_id !== contentId(
      'PRODUCT_SELECTED_RESULT_EXPORT/V1',
      exportIdentityPayload(payload),
    )
  ) {
    fail(code, 'The Product export identity does not match its inputs.');
  }
  const expectedDigest = sha256Hex(Buffer.from(
    canonicalJson(exportPayloadDigestPayload(payload)),
    'utf8',
  ));
  if (payload.canonical_payload_digest !== expectedDigest) {
    fail(code, 'The Product export payload digest does not match its content.');
  }
}

function validateRefusal(value) {
  const code = 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL';
  requireExactKeys(value, [
    'schema_version',
    'export_refusal_id',
    'product_query_definition_id',
    'ordered_selected_product_result_identities',
    'source_release',
    'active_release_resolution_id',
    'active_release',
    'disposition',
    'emitted_result_count',
    'partial_export_permitted',
    'authority_state',
  ], 'Product selected-result export refusal', code);
  if (
    value.schema_version !== PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA
    || ![
      'FIELD_NOT_IN_CHECKED_RESULT',
      'RELEASE_NOT_ACTIVE',
      'RESULT_NOT_IN_PINNED_RELEASE',
    ].includes(value.disposition)
    || value.emitted_result_count !== 0
    || value.partial_export_permitted !== false
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product selected-result export refusal is invalid.');
  }
  requireDigest(value.export_refusal_id, 'Export refusal ID', code);
  requireDigest(
    value.active_release_resolution_id,
    'Export refusal active release resolution ID',
    code,
  );
  if (value.product_query_definition_id !== null) {
    requireDigest(
      value.product_query_definition_id,
      'Export refusal Product Query ID',
      code,
    );
  }
  const selectedIds = requireArray(
    value.ordered_selected_product_result_identities,
    'Export refusal selected identities',
    code,
  );
  selectedIds.forEach((id, index) => requireDigest(
    id,
    `Export refusal selected identity ${index}`,
    code,
  ));
  for (const [label, binding] of [
    ['Export refusal active release', value.active_release],
  ]) {
    requireExactKeys(binding, [
      'candidate_release_manifest_id',
      'candidate_release_manifest_payload_digest',
    ], label, code);
    requireDigest(binding.candidate_release_manifest_id, `${label} ID`, code);
    requireDigest(
      binding.candidate_release_manifest_payload_digest,
      `${label} payload digest`,
      code,
    );
  }
  if (value.source_release !== null) {
    requireExactKeys(value.source_release, [
      'candidate_release_manifest_id',
      'candidate_release_manifest_payload_digest',
    ], 'Export refusal source release', code);
    requireDigest(
      value.source_release.candidate_release_manifest_id,
      'Export refusal source release ID',
      code,
    );
    requireDigest(
      value.source_release.candidate_release_manifest_payload_digest,
      'Export refusal source release payload digest',
      code,
    );
  }
  const body = clone(value, code);
  delete body.export_refusal_id;
  if (
    value.export_refusal_id !== contentId(
      PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA,
      body,
    )
  ) {
    fail(code, 'The Product export refusal identity does not match its contents.');
  }
}

function validateProductSelectedResultExportOutcome(value) {
  if (
    value?.schema_version
      === PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD_SCHEMA
  ) {
    validatePayload(value);
  } else if (
    value?.schema_version
      === PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA
  ) {
    validateRefusal(value);
  } else {
    fail(
      'INVALID_PRODUCT_SELECTED_RESULT_EXPORT',
      'The Product selected-result export schema is not supported.',
    );
  }
  return true;
}

function canonicalProductSelectedResultExportBytes(value) {
  validateProductSelectedResultExportOutcome(value);
  return Buffer.from(canonicalJson(value), 'utf8');
}

module.exports = {
  PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD_SCHEMA,
  PRODUCT_SELECTED_RESULT_EXPORT_REFUSAL_SCHEMA,
  ProductSelectedResultExportCompilerError,
  canonicalProductSelectedResultExportBytes,
  compileProductSelectedResultExport,
  validateProductSelectedResultExportOutcome,
};
