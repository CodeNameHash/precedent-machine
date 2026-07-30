const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateProductActiveReleaseResolution,
} = require('./product-rerun-compiler');
const {
  validateAuthoredProductQueryResultInputs,
} = require('./product-query-result-contract-input-validator');
const {
  validateAuthoredProductResultActionInputs,
} = require('./product-result-action-contract-input-validator');
const queryResultContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-result-definition.v1.json',
);
const processPhrasebookProductResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
);
const processPhrasebookProductResultSetAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-set-adapter.v1.json',
);
const qxoCapitalisationProductResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-product-result-adapter.v1.json',
);
const qxoCapitalisationF28ProductResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v1.json',
);
const qxoCapitalisationF28ProductResultAdapterV2Contract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v2.json',
);
const citationContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-release-pinned-citation-and-share.v1.json',
);
const exportContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-selected-result-export.v1.json',
);

const PRODUCT_QUERY_RESULT_SCHEMA = 'PRODUCT_QUERY_RESULT/V1';
const PRODUCT_EXACT_CITATION_SCHEMA = 'PRODUCT_EXACT_CITATION/V1';
const PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA =
  'PRODUCT_DOMAIN_RESULT_VALIDATION/V1';
const PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA =
  'PRODUCT_RESULT_ACTION_OWNER_BINDING/V1';
const PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA =
  'PRODUCT_CITATION_AND_SHARE_ACTION/V1';
const PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA =
  'PRODUCT_CITATION_AND_SHARE_REFUSAL/V1';
const PRODUCT_SHARE_REFERENCE_SCHEMA = 'PRODUCT_SHARE_REFERENCE/V1';
const ACTION_KINDS = Object.freeze(['CITATION', 'COPY', 'SHARE']);
const REPRESENTATION_KINDS = Object.freeze([
  'STRUCTURED_RESULT',
  'VERBATIM_TEXT',
]);
const QXO_CAPITALISATION_RESULT_STABLE_ID =
  'TARGET_CAPITALISATION_BRING_DOWN';
const QXO_CAPITALISATION_F27_VALIDATOR_STABLE_ID =
  'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER';
const QXO_CAPITALISATION_F28_VALIDATOR_STABLE_ID =
  'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER';
const QXO_CAPITALISATION_F28_V2_VALIDATOR_STABLE_ID =
  'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2';
const QXO_CAPITALISATION_F27_PAYLOAD_SCHEMA =
  'CAPITALISATION_SHARED_PROVISION_ROW_F27/V1';
const QXO_CAPITALISATION_F28_PAYLOAD_SCHEMA =
  'CAPITALISATION_SHARED_PROVISION_ROW_F28/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProductCitationShareCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductCitationShareCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductCitationShareCompilerError(code, message, details);
}

function isQxoCapitalisationQueryIr(queryIr) {
  const semantic = queryIr?.semantic_contract;
  return semantic?.domain_key === 'AGREEMENT'
    && (
      semantic.predicate_key === QXO_CAPITALISATION_RESULT_STABLE_ID
      || semantic.result_definition?.stable_id
        === QXO_CAPITALISATION_RESULT_STABLE_ID
    );
}

function validateCurrentQxoCapitalisationQueryIr(queryIr) {
  if (!isQxoCapitalisationQueryIr(queryIr)) return true;
  if (
    queryIr.semantic_contract.result_definition?.stable_id
      !== QXO_CAPITALISATION_RESULT_STABLE_ID
    || queryIr.semantic_contract.result_definition?.version !== 3
  ) {
    fail(
      'RETIRED_QXO_CAPITALISATION_F27_NOT_RELEASE_ADMITTED',
      'Current QXO capitalisation queries must use the F28 result definition.',
    );
  }
  return true;
}

function isQxoCapitalisationResult(result) {
  return result?.domain_key === 'AGREEMENT'
    && (
      result.domain_result_definition?.stable_id
        === QXO_CAPITALISATION_RESULT_STABLE_ID
      || [
        QXO_CAPITALISATION_F27_VALIDATOR_STABLE_ID,
        QXO_CAPITALISATION_F28_VALIDATOR_STABLE_ID,
      ].includes(result.domain_result_validation?.validator_stable_id)
      || [
        QXO_CAPITALISATION_F27_PAYLOAD_SCHEMA,
        QXO_CAPITALISATION_F28_PAYLOAD_SCHEMA,
      ].includes(result.domain_result_payload?.schema_version)
    );
}

function validateCurrentQxoCapitalisationResultAdmission(result) {
  if (!isQxoCapitalisationResult(result)) return true;
  if (
    result.domain_result_definition?.stable_id
      !== QXO_CAPITALISATION_RESULT_STABLE_ID
    || result.domain_result_definition?.version !== 3
    || ![
      `${QXO_CAPITALISATION_F28_VALIDATOR_STABLE_ID}/1`,
      `${QXO_CAPITALISATION_F28_V2_VALIDATOR_STABLE_ID}/2`,
    ].includes(
      `${result.domain_result_validation?.validator_stable_id}/${
        result.domain_result_validation?.validator_version
      }`,
    )
    || result.domain_result_payload?.schema_version
      !== QXO_CAPITALISATION_F28_PAYLOAD_SCHEMA
    || result.domain_result_payload?.generic_no_market_data_authority
      !== 'FORBIDDEN'
  ) {
    fail(
      'RETIRED_QXO_CAPITALISATION_F27_NOT_RELEASE_ADMITTED',
      'Current QXO capitalisation results must use the complete F28 adapter and payload.',
    );
  }
  return true;
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_RESULT_ACTION',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PRODUCT_RESULT_ACTION',
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
  code = 'INVALID_PRODUCT_RESULT_ACTION',
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

function requireNullableText(value, label, code) {
  if (value !== null) requireText(value, label, code);
}

function requireDigest(
  value,
  label,
  code = 'INVALID_PRODUCT_RESULT_ACTION',
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

function requireArray(value, label, code) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(value, code = 'INVALID_PRODUCT_RESULT_ACTION') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product result action is not canonical JSON.', {
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

function contractMember(canonicalValue) {
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function validateRuntimeContractBinding() {
  try {
    validateAuthoredProductQueryResultInputs([
      contractMember(processPhrasebookProductResultAdapterContract),
      contractMember(processPhrasebookProductResultSetAdapterContract),
      contractMember(queryResultContract),
      contractMember(qxoCapitalisationProductResultAdapterContract),
      contractMember(qxoCapitalisationF28ProductResultAdapterContract),
      contractMember(qxoCapitalisationF28ProductResultAdapterV2Contract),
    ]);
    validateAuthoredProductResultActionInputs([
      contractMember(citationContract),
      contractMember(exportContract),
    ]);
  } catch (error) {
    fail(
      'INVALID_PRODUCT_RESULT_ACTION_CONTRACT_BINDING',
      'The Product result-action runtime contracts have changed.',
      { cause: error.code || error.message },
    );
  }
}

function validateFieldReference(reference, label, code) {
  requireExactKeys(
    reference,
    ['field_key', 'field_version'],
    label,
    code,
  );
  requireText(reference.field_key, `${label} field_key`, code);
  requirePositiveInteger(
    reference.field_version,
    `${label} field_version`,
    code,
  );
}

function validateDomainResultDefinition(definition, code) {
  requireExactKeys(
    definition,
    ['stable_id', 'version'],
    'Domain result definition',
    code,
  );
  requireText(definition.stable_id, 'Domain result stable ID', code);
  requirePositiveInteger(
    definition.version,
    'Domain result definition version',
    code,
  );
}

function validateDomainResultValidation(validation, payloadDigest, code) {
  requireExactKeys(validation, [
    'schema_version',
    'validator_stable_id',
    'validator_version',
    'validation_receipt_id',
    'validated_payload_digest',
    'validation_state',
  ], 'Domain result validation binding', code);
  if (
    validation.schema_version !== PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA
    || validation.validation_state !== 'EXTERNALLY_VALIDATED'
  ) {
    fail(code, 'The domain result does not carry an external validation binding.');
  }
  requireText(
    validation.validator_stable_id,
    'Domain result validator stable ID',
    code,
  );
  requirePositiveInteger(
    validation.validator_version,
    'Domain result validator version',
    code,
  );
  requireDigest(
    validation.validation_receipt_id,
    'Domain result validation receipt ID',
    code,
  );
  requireDigest(
    validation.validated_payload_digest,
    'Validated domain result payload digest',
    code,
  );
  if (validation.validated_payload_digest !== payloadDigest) {
    fail(code, 'The domain result validation binding does not match the payload.');
  }
  const expectedReceiptId = contentId(
    PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
    {
      validator_stable_id: validation.validator_stable_id,
      validator_version: validation.validator_version,
      validated_payload_digest: validation.validated_payload_digest,
      validation_state: validation.validation_state,
    },
  );
  if (validation.validation_receipt_id !== expectedReceiptId) {
    fail(code, 'The domain result validation receipt does not match its binding.');
  }
}

function citationTargetPayload(result, citation) {
  return {
    product_query_result_identity: result.product_query_result_identity,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    source_document_identity: citation.source_document_identity,
    source_evidence_identity: citation.source_evidence_identity,
  };
}

function validateExactCitation(citation, result, code) {
  requireExactKeys(citation, [
    'schema_version',
    'source_document_identity',
    'source_evidence_identity',
    'source_representation_kind',
    'source_interval',
    'result_component_evidence_identity',
    'source_accession_or_equivalent_identity',
    'source_filing_type',
    'source_filing_date',
    'source_location_label',
    'human_readable_source_label',
    'citation_target_identity',
  ], 'Product exact citation', code);
  if (
    citation.schema_version !== PRODUCT_EXACT_CITATION_SCHEMA
    || citation.source_representation_kind
      !== result.domain_result_source_representation_kind
  ) {
    fail(code, 'The Product exact citation representation is invalid.');
  }
  requireDigest(
    citation.source_document_identity,
    'Citation source document identity',
    code,
  );
  requireDigest(
    citation.source_evidence_identity,
    'Citation source evidence identity',
    code,
  );
  requireText(
    citation.source_accession_or_equivalent_identity,
    'Citation accession or equivalent identity',
    code,
  );
  requireNullableText(
    citation.source_filing_type,
    'Citation filing type',
    code,
  );
  if (
    citation.source_filing_date !== null
    && !/^\d{4}-\d{2}-\d{2}$/.test(citation.source_filing_date)
  ) {
    fail(code, 'Citation filing date must be null or an ISO calendar date.');
  }
  requireText(
    citation.source_location_label,
    'Citation source location label',
    code,
  );
  requireText(
    citation.human_readable_source_label,
    'Citation human-readable source label',
    code,
  );
  requireDigest(
    citation.citation_target_identity,
    'Citation target identity',
    code,
  );

  if (citation.source_representation_kind === 'VERBATIM_TEXT') {
    requireExactKeys(citation.source_interval, [
      'start_utf8_byte',
      'end_utf8_byte',
      'exact_text_digest',
    ], 'Citation source interval', code);
    if (
      !Number.isSafeInteger(citation.source_interval.start_utf8_byte)
      || citation.source_interval.start_utf8_byte < 0
      || !Number.isSafeInteger(citation.source_interval.end_utf8_byte)
      || citation.source_interval.end_utf8_byte
        <= citation.source_interval.start_utf8_byte
    ) {
      fail(code, 'Citation source interval must be a valid UTF-8 byte range.');
    }
    requireDigest(
      citation.source_interval.exact_text_digest,
      'Citation exact text digest',
      code,
    );
    if (citation.result_component_evidence_identity !== null) {
      fail(code, 'A verbatim citation cannot carry component evidence.');
    }
  } else {
    if (citation.source_interval !== null) {
      fail(code, 'A structured citation cannot carry a verbatim source interval.');
    }
    requireDigest(
      citation.result_component_evidence_identity,
      'Citation result-component evidence identity',
      code,
    );
  }

  const expectedTarget = contentId(
    PRODUCT_EXACT_CITATION_SCHEMA,
    citationTargetPayload(result, citation),
  );
  if (citation.citation_target_identity !== expectedTarget) {
    fail(code, 'The citation target does not match the result, release and source.');
  }
}

function validateProductExactCitation(citation, resultBinding) {
  const code = 'INVALID_PRODUCT_EXACT_CITATION';
  requireExactKeys(resultBinding, [
    'product_query_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_result_source_representation_kind',
  ], 'Product exact-citation result binding', code);
  requireDigest(
    resultBinding.product_query_result_identity,
    'Citation-bound Product result identity',
    code,
  );
  requireDigest(
    resultBinding.candidate_release_manifest_id,
    'Citation-bound release manifest ID',
    code,
  );
  requireDigest(
    resultBinding.candidate_release_manifest_payload_digest,
    'Citation-bound release manifest payload digest',
    code,
  );
  if (!REPRESENTATION_KINDS.includes(
    resultBinding.domain_result_source_representation_kind,
  )) {
    fail(code, 'The citation-bound source representation is not registered.');
  }
  validateExactCitation(citation, resultBinding, code);
  return true;
}

function resultIdentityPayload(result) {
  return {
    schema_version: result.schema_version,
    product_query_definition_id: result.product_query_definition_id,
    approved_pm_data_version_id: result.approved_pm_data_version_id,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition_stable_id:
      result.domain_result_definition.stable_id,
    domain_result_definition_version:
      result.domain_result_definition.version,
    domain_result_identity: result.domain_result_identity,
  };
}

function validateProductQueryResultStructure(
  result,
  { historicalF27 = false } = {},
) {
  validateRuntimeContractBinding();
  const code = 'INVALID_PRODUCT_QUERY_RESULT';
  requireExactKeys(result, [
    'schema_version',
    'product_query_result_identity',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_key',
    'domain_result_definition',
    'domain_result_identity',
    'domain_result_payload',
    'domain_result_payload_digest',
    'domain_result_validation',
    'domain_result_source_representation_kind',
    'exact_citation',
    'exact_detail_action',
    'query_provenance',
    'result_fields',
  ], 'Product query result', code);
  if (
    result.schema_version !== PRODUCT_QUERY_RESULT_SCHEMA
    || !REPRESENTATION_KINDS.includes(
      result.domain_result_source_representation_kind,
    )
  ) {
    fail(code, 'The Product query result identity is invalid.');
  }
  [
    'product_query_result_identity',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_result_identity',
    'domain_result_payload_digest',
  ].forEach((key) => requireDigest(result[key], `Product result ${key}`, code));
  requireText(result.domain_key, 'Product result domain key', code);
  requireText(
    result.exact_detail_action,
    'Product result exact-detail action',
    code,
  );
  validateDomainResultDefinition(result.domain_result_definition, code);
  const payload = clone(result.domain_result_payload, code);
  const payloadDigest = sha256Hex(
    Buffer.from(canonicalJson(payload), 'utf8'),
  );
  if (payloadDigest !== result.domain_result_payload_digest) {
    fail(code, 'The domain result payload digest does not match its content.');
  }
  if (
    result.domain_result_source_representation_kind === 'VERBATIM_TEXT'
    && typeof payload !== 'string'
  ) {
    fail(code, 'A verbatim Product result payload must be a string.');
  }
  validateDomainResultValidation(
    result.domain_result_validation,
    payloadDigest,
    code,
  );
  if (!historicalF27) {
    validateCurrentQxoCapitalisationResultAdmission(result);
  }
  validateExactCitation(result.exact_citation, result, code);
  if (
    result.domain_result_source_representation_kind === 'VERBATIM_TEXT'
    && result.exact_citation.source_interval.exact_text_digest
      !== sha256Hex(Buffer.from(payload, 'utf8'))
  ) {
    fail(
      code,
      'The verbatim Product result raw UTF-8 bytes do not match its cited source text digest.',
    );
  }

  requireExactKeys(result.query_provenance, [
    'filter_contract',
    'filter_contract_digest',
    'coverage_contract',
    'coverage_contract_digest',
    'requested_field_references',
  ], 'Product result query provenance', code);
  const filterContract = clone(result.query_provenance.filter_contract, code);
  const coverageContract = clone(
    result.query_provenance.coverage_contract,
    code,
  );
  requireDigest(
    result.query_provenance.filter_contract_digest,
    'Product result filter contract digest',
    code,
  );
  requireDigest(
    result.query_provenance.coverage_contract_digest,
    'Product result coverage contract digest',
    code,
  );
  if (
    result.query_provenance.filter_contract_digest
      !== sha256Hex(Buffer.from(canonicalJson(filterContract), 'utf8'))
    || result.query_provenance.coverage_contract_digest
      !== sha256Hex(Buffer.from(canonicalJson(coverageContract), 'utf8'))
  ) {
    fail(code, 'Product result query provenance digests do not match.');
  }
  const references = requireArray(
    result.query_provenance.requested_field_references,
    'Product result requested field references',
    code,
  );
  references.forEach((reference, index) => validateFieldReference(
    reference,
    `Requested field reference ${index}`,
    code,
  ));
  if (
    new Set(references.map((reference) => canonicalJson(reference))).size
      !== references.length
  ) {
    fail(code, 'Product result requested field references contain duplicates.');
  }

  const fields = requireArray(
    result.result_fields,
    'Product result fields',
    code,
  );
  fields.forEach((field, index) => {
    requireExactKeys(
      field,
      ['field_reference', 'value'],
      `Product result field ${index}`,
      code,
    );
    validateFieldReference(
      field.field_reference,
      `Product result field ${index} reference`,
      code,
    );
    clone(field.value, code);
  });
  if (
    canonicalJson(fields.map((field) => field.field_reference))
      !== canonicalJson(references)
  ) {
    fail(code, 'Product result fields do not match the requested field order.');
  }

  const expectedIdentity = contentId(
    PRODUCT_QUERY_RESULT_SCHEMA,
    resultIdentityPayload(result),
  );
  if (result.product_query_result_identity !== expectedIdentity) {
    fail(code, 'The Product query result identity does not match its inputs.');
  }
  return true;
}

function validateProductQueryResult(result) {
  return validateProductQueryResultStructure(result);
}

function validateHistoricalQxoCapitalisationF27ProductQueryResult(result) {
  validateProductQueryResultStructure(result, { historicalF27: true });
  if (
    result.domain_key !== 'AGREEMENT'
    || result.domain_result_definition.stable_id
      !== QXO_CAPITALISATION_RESULT_STABLE_ID
    || result.domain_result_definition.version !== 2
    || result.domain_result_validation.validator_stable_id
      !== QXO_CAPITALISATION_F27_VALIDATOR_STABLE_ID
    || result.domain_result_validation.validator_version !== 1
    || result.domain_result_payload?.schema_version
      !== QXO_CAPITALISATION_F27_PAYLOAD_SCHEMA
  ) {
    fail(
      'INVALID_HISTORICAL_QXO_CAPITALISATION_F27_PRODUCT_RESULT',
      'The immutable historical Product result is not the exact retired F27 shape.',
    );
  }
  return true;
}

function validateOwnerBinding(binding) {
  const code = 'INVALID_PRODUCT_RESULT_ACTION_OWNER';
  requireExactKeys(binding, [
    'schema_version',
    'actor_principal_id',
    'object_authorisation_binding_id',
    'runtime_authorisation_state',
  ], 'Product result-action owner binding', code);
  if (
    binding.schema_version !== PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA
    || binding.runtime_authorisation_state !== 'REQUIRED_BEFORE_USE'
  ) {
    fail(code, 'The Product result-action owner binding is invalid.');
  }
  requireText(binding.actor_principal_id, 'Action actor principal ID', code);
  requireDigest(
    binding.object_authorisation_binding_id,
    'Object authorisation binding ID',
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

function releaseMatches(result, resolution) {
  return canonicalJson(releaseBinding(result)) === canonicalJson(
    releaseBinding(resolution),
  );
}

function refusalIdentityPayload(refusal) {
  const payload = clone(refusal);
  delete payload.action_refusal_id;
  return payload;
}

function compileInactiveRefusal(result, resolution, actionKind) {
  const body = {
    schema_version: PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA,
    action_kind: actionKind,
    product_query_result_identity:
      result.product_query_result_identity,
    source_release: releaseBinding(result),
    active_release_resolution_id: resolution.resolution_id,
    active_release: releaseBinding(resolution),
    disposition: 'RELEASE_NOT_ACTIVE',
    original_result_preserved: true,
    authority_state: 'NOT_GRANTED',
  };
  return deepFreeze({
    schema_version: body.schema_version,
    action_refusal_id: contentId(
      PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA,
      body,
    ),
    action_kind: body.action_kind,
    product_query_result_identity:
      body.product_query_result_identity,
    source_release: body.source_release,
    active_release_resolution_id:
      body.active_release_resolution_id,
    active_release: body.active_release,
    disposition: body.disposition,
    original_result_preserved: body.original_result_preserved,
    authority_state: body.authority_state,
  });
}

function actionIdentityPayload(action) {
  return {
    schema_version: action.schema_version,
    action_kind: action.action_kind,
    product_query_result_identity:
      action.product_query_result_identity,
    product_query_definition_id:
      action.product_query_definition_id,
    approved_pm_data_version_id:
      action.approved_pm_data_version_id,
    candidate_release_manifest_id:
      action.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      action.candidate_release_manifest_payload_digest,
    domain_key: action.domain_key,
    domain_result_identity: action.domain_result_identity,
    active_release_resolution_id:
      action.active_release_resolution_id,
    object_authorisation_binding:
      action.object_authorisation_binding,
    exact_citation: action.exact_citation,
    copy_payload: action.copy_payload,
  };
}

function shareReference(action) {
  if (action.action_kind !== 'SHARE') return null;
  const body = {
    schema_version: PRODUCT_SHARE_REFERENCE_SCHEMA,
    action_id: action.action_id,
    product_query_result_identity:
      action.product_query_result_identity,
    product_query_definition_id:
      action.product_query_definition_id,
    candidate_release_manifest_id:
      action.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      action.candidate_release_manifest_payload_digest,
    source_document_identity:
      action.exact_citation.source_document_identity,
    citation_target_identity:
      action.exact_citation.citation_target_identity,
    runtime_authorisation_state: 'REQUIRED_ON_OPEN',
    bearer_authorisation: false,
  };
  return {
    schema_version: body.schema_version,
    share_reference_id: contentId(PRODUCT_SHARE_REFERENCE_SCHEMA, body),
    action_id: body.action_id,
    product_query_result_identity:
      body.product_query_result_identity,
    product_query_definition_id:
      body.product_query_definition_id,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    source_document_identity:
      body.source_document_identity,
    citation_target_identity:
      body.citation_target_identity,
    runtime_authorisation_state:
      body.runtime_authorisation_state,
    bearer_authorisation: body.bearer_authorisation,
  };
}

function compileProductCitationAndShareAction({
  product_query_result: result,
  active_release_resolution: resolution,
  action_kind: actionKind,
  object_authorisation_binding: ownerBinding,
}) {
  validateRuntimeContractBinding();
  validateProductQueryResult(result);
  try {
    validateProductActiveReleaseResolution(resolution);
  } catch (error) {
    fail(
      'INVALID_PRODUCT_RESULT_ACTIVE_RELEASE',
      'The Product result action requires a valid fresh active release.',
      { cause: error.code || error.message },
    );
  }
  if (!ACTION_KINDS.includes(actionKind)) {
    fail('INVALID_PRODUCT_RESULT_ACTION_KIND', 'The Product result action kind is not registered.');
  }
  validateOwnerBinding(ownerBinding);
  if (!releaseMatches(result, resolution)) {
    return compileInactiveRefusal(result, resolution, actionKind);
  }

  const body = {
    schema_version: PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
    action_kind: actionKind,
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
    domain_result_identity: result.domain_result_identity,
    active_release_resolution_id: resolution.resolution_id,
    object_authorisation_binding: clone(ownerBinding),
    exact_citation: clone(result.exact_citation),
    copy_payload: actionKind === 'COPY'
      ? {
        representation_kind:
          result.domain_result_source_representation_kind,
        exact_domain_result_payload: clone(result.domain_result_payload),
        exact_citation: clone(result.exact_citation),
      }
      : null,
  };
  const actionId = contentId(
    PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
    body,
  );
  const action = {
    schema_version: body.schema_version,
    action_id: actionId,
    action_kind: body.action_kind,
    product_query_result_identity:
      body.product_query_result_identity,
    product_query_definition_id:
      body.product_query_definition_id,
    approved_pm_data_version_id:
      body.approved_pm_data_version_id,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    domain_key: body.domain_key,
    domain_result_identity: body.domain_result_identity,
    active_release_resolution_id:
      body.active_release_resolution_id,
    object_authorisation_binding:
      body.object_authorisation_binding,
    exact_citation: body.exact_citation,
    copy_payload: body.copy_payload,
    share_reference: null,
    execution_state: 'NOT_EXECUTED',
    authority_state: 'NOT_GRANTED',
  };
  action.share_reference = shareReference(action);
  validateProductCitationAndShareOutcome(action);
  return deepFreeze(action);
}

function validateShareReference(reference, action, code) {
  if (action.action_kind !== 'SHARE') {
    if (reference !== null) {
      fail(code, 'Only SHARE can carry a Product share reference.');
    }
    return;
  }
  requireExactKeys(reference, [
    'schema_version',
    'share_reference_id',
    'action_id',
    'product_query_result_identity',
    'product_query_definition_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'citation_target_identity',
    'runtime_authorisation_state',
    'bearer_authorisation',
  ], 'Product share reference', code);
  if (
    reference.schema_version !== PRODUCT_SHARE_REFERENCE_SCHEMA
    || reference.runtime_authorisation_state !== 'REQUIRED_ON_OPEN'
    || reference.bearer_authorisation !== false
    || reference.action_id !== action.action_id
    || reference.product_query_result_identity
      !== action.product_query_result_identity
    || reference.product_query_definition_id
      !== action.product_query_definition_id
    || reference.candidate_release_manifest_id
      !== action.candidate_release_manifest_id
    || reference.candidate_release_manifest_payload_digest
      !== action.candidate_release_manifest_payload_digest
    || reference.source_document_identity
      !== action.exact_citation.source_document_identity
    || reference.citation_target_identity
      !== action.exact_citation.citation_target_identity
  ) {
    fail(code, 'The Product share reference does not match its action.');
  }
  requireDigest(reference.share_reference_id, 'Share reference ID', code);
  const body = clone(reference, code);
  delete body.share_reference_id;
  if (
    reference.share_reference_id
      !== contentId(PRODUCT_SHARE_REFERENCE_SCHEMA, body)
  ) {
    fail(code, 'The Product share reference identity does not match its contents.');
  }
}

function validateAction(action) {
  const code = 'INVALID_PRODUCT_CITATION_SHARE_ACTION';
  requireExactKeys(action, [
    'schema_version',
    'action_id',
    'action_kind',
    'product_query_result_identity',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_key',
    'domain_result_identity',
    'active_release_resolution_id',
    'object_authorisation_binding',
    'exact_citation',
    'copy_payload',
    'share_reference',
    'execution_state',
    'authority_state',
  ], 'Product citation-and-share action', code);
  if (
    action.schema_version !== PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA
    || !ACTION_KINDS.includes(action.action_kind)
    || action.execution_state !== 'NOT_EXECUTED'
    || action.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product citation-and-share action state is invalid.');
  }
  [
    'action_id',
    'product_query_result_identity',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_result_identity',
    'active_release_resolution_id',
  ].forEach((key) => requireDigest(action[key], `Product action ${key}`, code));
  requireText(action.domain_key, 'Product action domain key', code);
  validateOwnerBinding(action.object_authorisation_binding);
  const syntheticResult = {
    product_query_result_identity:
      action.product_query_result_identity,
    candidate_release_manifest_id:
      action.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      action.candidate_release_manifest_payload_digest,
    domain_result_source_representation_kind:
      action.copy_payload?.representation_kind
        || action.exact_citation.source_representation_kind,
  };
  validateExactCitation(action.exact_citation, syntheticResult, code);
  if (action.action_kind === 'COPY') {
    requireExactKeys(action.copy_payload, [
      'representation_kind',
      'exact_domain_result_payload',
      'exact_citation',
    ], 'Product copy payload', code);
    if (
      action.copy_payload.representation_kind
        !== action.exact_citation.source_representation_kind
      || canonicalJson(action.copy_payload.exact_citation)
        !== canonicalJson(action.exact_citation)
    ) {
      fail(code, 'The Product copy payload does not match its citation.');
    }
    clone(action.copy_payload.exact_domain_result_payload, code);
  } else if (action.copy_payload !== null) {
    fail(code, 'Only COPY can carry a Product copy payload.');
  }
  const expectedId = contentId(
    PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
    actionIdentityPayload(action),
  );
  if (action.action_id !== expectedId) {
    fail(code, 'The Product result action identity does not match its contents.');
  }
  validateShareReference(action.share_reference, action, code);
}

function validateRefusal(refusal) {
  const code = 'INVALID_PRODUCT_CITATION_SHARE_REFUSAL';
  requireExactKeys(refusal, [
    'schema_version',
    'action_refusal_id',
    'action_kind',
    'product_query_result_identity',
    'source_release',
    'active_release_resolution_id',
    'active_release',
    'disposition',
    'original_result_preserved',
    'authority_state',
  ], 'Product citation-and-share refusal', code);
  if (
    refusal.schema_version !== PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA
    || !ACTION_KINDS.includes(refusal.action_kind)
    || refusal.disposition !== 'RELEASE_NOT_ACTIVE'
    || refusal.original_result_preserved !== true
    || refusal.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product citation-and-share refusal state is invalid.');
  }
  [
    'action_refusal_id',
    'product_query_result_identity',
    'active_release_resolution_id',
  ].forEach((key) => requireDigest(refusal[key], `Product refusal ${key}`, code));
  for (const [label, binding] of [
    ['Source release', refusal.source_release],
    ['Active release', refusal.active_release],
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
  if (
    refusal.action_refusal_id !== contentId(
      PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA,
      refusalIdentityPayload(refusal),
    )
  ) {
    fail(code, 'The Product action refusal identity does not match its contents.');
  }
}

function validateProductCitationAndShareOutcome(outcome) {
  validateRuntimeContractBinding();
  if (
    outcome?.schema_version
      === PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA
  ) {
    validateAction(outcome);
  } else if (
    outcome?.schema_version
      === PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA
  ) {
    validateRefusal(outcome);
  } else {
    fail(
      'INVALID_PRODUCT_RESULT_ACTION',
      'The Product citation-and-share outcome schema is not supported.',
    );
  }
  return true;
}

function canonicalProductCitationAndShareOutcomeBytes(outcome) {
  validateProductCitationAndShareOutcome(outcome);
  return Buffer.from(canonicalJson(outcome), 'utf8');
}

module.exports = {
  PRODUCT_CITATION_AND_SHARE_ACTION_SCHEMA,
  PRODUCT_CITATION_AND_SHARE_REFUSAL_SCHEMA,
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
  PRODUCT_RESULT_ACTION_OWNER_BINDING_SCHEMA,
  PRODUCT_SHARE_REFERENCE_SCHEMA,
  ProductCitationShareCompilerError,
  canonicalProductCitationAndShareOutcomeBytes,
  compileProductCitationAndShareAction,
  validateCurrentQxoCapitalisationQueryIr,
  validateCurrentQxoCapitalisationResultAdmission,
  validateHistoricalQxoCapitalisationF27ProductQueryResult,
  validateProductExactCitation,
  validateProductCitationAndShareOutcome,
  validateProductQueryResult,
};
