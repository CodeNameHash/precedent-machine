const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const queryResultContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-result-definition.v1.json',
);
const processPhrasebookProductResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
);
const processPhrasebookProductResultSetAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-set-adapter.v1.json',
);
const sourceReaderContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-source-reader-definition.v1.json',
);
const processServingContracts = Object.freeze([
  require(
    '../../contracts/canonical-v2/successor/process/results/process-exclusivity-event-result.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/serving/bounded-inline-passage-preview.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/serving/parent-bound-paragraph-context.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/serving/related-passage-child-collection.v1.json',
  ),
]);
const {
  validateAuthoredProductQueryResultInputs,
} = require('./product-query-result-contract-input-validator');
const {
  validateAuthoredProductSourceReaderInputs,
} = require('./product-source-reader-contract-input-validator');
const {
  validateAuthoredProcessServingInputs,
} = require('./process-serving-contract-input-validator');
const {
  validateProductQueryResult,
} = require('./product-citation-share-compiler');
const {
  validateProductActiveReleaseResolution,
} = require('./product-rerun-compiler');
const {
  validateProcessRelatedPassagesResponse,
} = require('./process-related-passages');

const PRODUCT_SOURCE_READER_ACTION_SCHEMA =
  'PRODUCT_SOURCE_READER_ACTION/V1';
const PRODUCT_SOURCE_READER_REFUSAL_SCHEMA =
  'PRODUCT_SOURCE_READER_REFUSAL/V1';
const PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA =
  'PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION/V1';
const PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA =
  'PRODUCT_EXACT_DETAIL_REFERENCE/V1';
const PRODUCT_PARENT_BOUND_CURSOR_SCHEMA =
  'PRODUCT_PARENT_BOUND_CURSOR/V1';
const PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA =
  'PRODUCT_RELATED_PASSAGE_COLLECTION/V1';
const PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA =
  'PRODUCT_SOURCE_READER_OWNER_BINDING/V1';
const ACTION_TYPES = Object.freeze([
  'OPEN_SELECTED_SOURCE',
  'EXPAND_ONE_PARAGRAPH_ABOVE',
  'EXPAND_ONE_PARAGRAPH_BELOW',
  'LIST_RELATED_PASSAGES',
  'OPEN_RELATED_SOURCE',
]);
const REFUSAL_DISPOSITIONS = Object.freeze([
  'RELEASE_NOT_ACTIVE',
  'SOURCE_ACTION_NOT_ADMITTED',
  'INVALID_PARENT_BOUND_CURSOR',
  'RELATED_PASSAGE_NOT_IN_PARENT_COLLECTION',
]);
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProductSourceReaderCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductSourceReaderCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductSourceReaderCompilerError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_SOURCE_READER_INPUT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PRODUCT_SOURCE_READER_INPUT',
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
  code = 'INVALID_PRODUCT_SOURCE_READER_INPUT',
  maximumBytes = 256,
) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.trim() !== value
    || Buffer.byteLength(value, 'utf8') > maximumBytes
  ) {
    fail(code, `${label} must be a bounded non-empty trimmed string.`);
  }
  return value;
}

function requireDigest(
  value,
  label,
  code = 'INVALID_PRODUCT_SOURCE_READER_INPUT',
) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requirePositiveInteger(
  value,
  label,
  code = 'INVALID_PRODUCT_SOURCE_READER_INPUT',
) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
  return value;
}

function requireIntegerRange(
  value,
  minimum,
  maximum,
  label,
  code,
) {
  if (
    !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(code, `${label} is outside the governed range.`);
  }
  return value;
}

function requireArray(
  value,
  label,
  code = 'INVALID_PRODUCT_SOURCE_READER_INPUT',
) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(
  value,
  code = 'INVALID_PRODUCT_SOURCE_READER_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product source-reader input is not canonical JSON.', {
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
    ]);
    validateAuthoredProductSourceReaderInputs([
      contractMember(sourceReaderContract),
    ]);
    validateAuthoredProcessServingInputs(
      processServingContracts.map(contractMember),
    );
  } catch (error) {
    fail(
      'INVALID_PRODUCT_SOURCE_READER_CONTRACT_BINDING',
      'The Product source-reader runtime contracts have changed.',
      { cause: error.code || error.message },
    );
  }
}

function validateDomainResultDefinition(value, code) {
  requireExactKeys(
    value,
    ['stable_id', 'version'],
    'Domain result definition',
    code,
  );
  requireText(value.stable_id, 'Domain result stable ID', code);
  requirePositiveInteger(value.version, 'Domain result version', code);
}

function validateDomainSourceAction(value, code) {
  requireExactKeys(
    value,
    ['stable_id', 'version', 'definition_digest'],
    'Domain source action',
    code,
  );
  requireText(value.stable_id, 'Domain source action stable ID', code);
  requirePositiveInteger(value.version, 'Domain source action version', code);
  requireDigest(
    value.definition_digest,
    'Domain source action definition digest',
    code,
  );
}

function ownerBindingIdentityPayload(value) {
  return {
    schema_version: value.schema_version,
    actor_principal_id: value.actor_principal_id,
    object_authorisation_receipt_id:
      value.object_authorisation_receipt_id,
    runtime_authorisation_state: value.runtime_authorisation_state,
  };
}

function validateOwnerBinding(value) {
  const code = 'INVALID_PRODUCT_SOURCE_READER_OWNER_BINDING';
  requireExactKeys(value, [
    'schema_version',
    'owner_binding_id',
    'actor_principal_id',
    'object_authorisation_receipt_id',
    'runtime_authorisation_state',
  ], 'Product source-reader owner binding', code);
  if (
    value.schema_version !== PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA
    || value.runtime_authorisation_state !== 'REQUIRED_BEFORE_USE'
  ) {
    fail(code, 'The Product source-reader owner binding is invalid.');
  }
  requireText(value.actor_principal_id, 'Actor principal ID', code);
  requireDigest(
    value.object_authorisation_receipt_id,
    'Object authorisation receipt ID',
    code,
  );
  requireDigest(value.owner_binding_id, 'Owner binding ID', code);
  if (
    value.owner_binding_id !== contentId(
      PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA,
      ownerBindingIdentityPayload(value),
    )
  ) {
    fail(code, 'The owner binding identity does not match its contents.');
  }
}

function admissionIdentityPayload(value) {
  const payload = clone(value);
  delete payload.admission_id;
  return payload;
}

function validateDomainSourceActionAdmission(value, result) {
  const code = 'INVALID_PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION';
  requireExactKeys(value, [
    'schema_version',
    'admission_id',
    'product_query_result_identity',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_key',
    'domain_result_definition',
    'domain_result_identity',
    'domain_source_action',
    'admitted_action_types',
    'parent_exact_detail_reference_id',
    'admission_state',
    'execution_authority_state',
  ], 'Product domain source-action admission', code);
  if (
    value.schema_version
      !== PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA
    || value.admission_state !== 'RELEASE_ADMITTED'
    || value.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The domain source-action admission is not release-admitted.');
  }
  [
    'admission_id',
    'product_query_result_identity',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_result_identity',
  ].forEach((key) => requireDigest(value[key], `Admission ${key}`, code));
  requireText(value.domain_key, 'Admission domain key', code);
  validateDomainResultDefinition(value.domain_result_definition, code);
  validateDomainSourceAction(value.domain_source_action, code);
  if (value.parent_exact_detail_reference_id !== null) {
    requireDigest(
      value.parent_exact_detail_reference_id,
      'Admission parent exact-detail reference ID',
      code,
    );
  }
  const admitted = requireArray(
    value.admitted_action_types,
    'Admitted source action types',
    code,
  );
  if (
    admitted.length === 0
    || new Set(admitted).size !== admitted.length
    || admitted.some((actionType) => !ACTION_TYPES.includes(actionType))
    || canonicalJson(admitted)
      !== canonicalJson(
        ACTION_TYPES.filter((actionType) => admitted.includes(actionType)),
      )
  ) {
    fail(code, 'The admitted source action type set is invalid.');
  }
  const binding = {
    product_query_result_identity:
      result.product_query_result_identity,
    product_query_definition_id: result.product_query_definition_id,
    approved_pm_data_version_id: result.approved_pm_data_version_id,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_definition: result.domain_result_definition,
    domain_result_identity: result.domain_result_identity,
  };
  for (const [key, expected] of Object.entries(binding)) {
    if (canonicalJson(value[key]) !== canonicalJson(expected)) {
      fail(code, 'The source-action admission does not bind the Product result.', {
        field: key,
      });
    }
  }
  if (
    value.domain_key === 'AGREEMENT'
    && value.admitted_action_types.includes('OPEN_SELECTED_SOURCE')
    && value.domain_source_action.stable_id !== result.exact_detail_action
  ) {
    fail(
      code,
      'The Agreement selected-source admission does not bind its checked exact-detail action.',
    );
  }
  if (
    value.domain_key === 'PROCESS'
    && value.admitted_action_types.some(
      (actionType) => actionType.startsWith('EXPAND_ONE_PARAGRAPH_'),
    )
    && value.domain_source_action.stable_id
      !== 'PARENT_BOUND_PARAGRAPH_CONTEXT'
  ) {
    fail(code, 'The Process context admission uses the wrong source action.');
  }
  if (
    value.domain_key === 'PROCESS'
    && value.admitted_action_types.some(
      (actionType) => [
        'LIST_RELATED_PASSAGES',
        'OPEN_RELATED_SOURCE',
      ].includes(actionType),
    )
    && value.domain_source_action.stable_id
      !== 'RELATED_PASSAGE_CHILD_COLLECTION'
  ) {
    fail(
      code,
      'The Process related-passage admission uses the wrong source action.',
    );
  }
  if (
    value.admission_id !== contentId(
      PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA,
      admissionIdentityPayload(value),
    )
  ) {
    fail(code, 'The source-action admission identity does not match its contents.');
  }
  return true;
}

function exactDetailReferenceIdentityPayload(value) {
  const payload = clone(value);
  delete payload.exact_detail_reference_id;
  return payload;
}

function validateExactDetailReference(value, {
  bindingKind,
  bindingIdentity,
  release,
  sourceDocumentIdentity = null,
  sourceEvidenceIdentity = null,
}) {
  const code = 'INVALID_PRODUCT_EXACT_DETAIL_REFERENCE';
  requireExactKeys(value, [
    'schema_version',
    'exact_detail_reference_id',
    'binding_kind',
    'binding_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_evidence_identity',
    'domain_reference_identity',
    'reference_validation_receipt_id',
    'validation_state',
    'execution_authority_state',
  ], 'Product exact-detail reference', code);
  if (
    value.schema_version !== PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA
    || value.binding_kind !== bindingKind
    || value.binding_identity !== bindingIdentity
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product exact-detail reference binding is invalid.');
  }
  [
    'exact_detail_reference_id',
    'binding_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_evidence_identity',
    'domain_reference_identity',
    'reference_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Exact-detail ${key}`, code));
  if (
    value.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || value.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
    || (
      sourceDocumentIdentity !== null
      && value.source_document_identity !== sourceDocumentIdentity
    )
    || (
      sourceEvidenceIdentity !== null
      && value.source_evidence_identity !== sourceEvidenceIdentity
    )
  ) {
    fail(code, 'The exact-detail reference does not bind the required source.');
  }
  if (
    value.exact_detail_reference_id !== contentId(
      PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
      exactDetailReferenceIdentityPayload(value),
    )
  ) {
    fail(code, 'The exact-detail reference identity does not match its contents.');
  }
  return true;
}

function cursorIdentityPayload(value) {
  const payload = clone(value);
  delete payload.cursor_id;
  return payload;
}

function validateParentBoundCursor(value, result, direction) {
  const code = 'INVALID_PARENT_BOUND_CURSOR';
  requireExactKeys(value, [
    'schema_version',
    'cursor_id',
    'opaque_cursor',
    'opaque_cursor_digest',
    'parent_product_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'direction',
    'expanded_paragraph_count',
    'server_issuance_receipt_id',
    'validation_state',
    'execution_authority_state',
  ], 'Product parent-bound cursor', code);
  if (
    value.schema_version !== PRODUCT_PARENT_BOUND_CURSOR_SCHEMA
    || value.parent_product_result_identity
      !== result.product_query_result_identity
    || value.candidate_release_manifest_id
      !== result.candidate_release_manifest_id
    || value.candidate_release_manifest_payload_digest
      !== result.candidate_release_manifest_payload_digest
    || value.direction !== direction
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The parent-bound cursor does not bind the requested action.');
  }
  requireText(value.opaque_cursor, 'Opaque cursor', code, 2048);
  [
    'cursor_id',
    'opaque_cursor_digest',
    'parent_product_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'server_issuance_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Cursor ${key}`, code));
  requireIntegerRange(
    value.expanded_paragraph_count,
    0,
    11,
    'Expanded paragraph count',
    code,
  );
  if (
    value.opaque_cursor_digest
      !== sha256Hex(Buffer.from(value.opaque_cursor, 'utf8'))
    || value.cursor_id !== contentId(
      PRODUCT_PARENT_BOUND_CURSOR_SCHEMA,
      cursorIdentityPayload(value),
    )
  ) {
    fail(code, 'The parent-bound cursor identity does not match its contents.');
  }
  return true;
}

function validatePreview(value, code) {
  requireExactKeys(value, [
    'verbatim_text',
    'verbatim_text_digest',
    'truncation_state',
  ], 'Related-passage preview', code);
  requireText(
    value.verbatim_text,
    'Related-passage verbatim preview',
    code,
    8192,
  );
  requireDigest(
    value.verbatim_text_digest,
    'Related-passage preview digest',
    code,
  );
  if (
    !['COMPLETE', 'TRUNCATED'].includes(value.truncation_state)
    || value.verbatim_text_digest
      !== sha256Hex(Buffer.from(value.verbatim_text, 'utf8'))
  ) {
    fail(code, 'The related-passage preview is invalid.');
  }
}

function collectionIdentityPayload(value) {
  const payload = clone(value);
  delete payload.collection_id;
  return payload;
}

function validateRelatedCollection(value, result) {
  const code = 'INVALID_PRODUCT_RELATED_PASSAGE_COLLECTION';
  requireExactKeys(value, [
    'schema_version',
    'collection_id',
    'parent_product_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'children',
    'projection_validation_receipt_id',
    'validation_state',
    'execution_authority_state',
  ], 'Product related-passage collection', code);
  if (
    value.schema_version !== PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA
    || value.parent_product_result_identity
      !== result.product_query_result_identity
    || value.candidate_release_manifest_id
      !== result.candidate_release_manifest_id
    || value.candidate_release_manifest_payload_digest
      !== result.candidate_release_manifest_payload_digest
    || value.source_document_identity
      !== result.exact_citation.source_document_identity
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The related-passage collection does not bind the parent result.');
  }
  [
    'collection_id',
    'parent_product_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'projection_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Collection ${key}`, code));
  const children = requireArray(value.children, 'Related-passage children', code);
  if (children.length > 12) {
    fail(code, 'The related-passage collection exceeds its governed bound.');
  }
  const childIds = [];
  for (const [index, child] of children.entries()) {
    requireExactKeys(child, [
      'related_child_result_identity',
      'relationship_definition',
      'relationship_label',
      'verbatim_preview',
      'child_exact_detail_reference',
    ], `Related-passage child ${index}`, code);
    requireDigest(
      child.related_child_result_identity,
      `Related child ${index} identity`,
      code,
    );
    requireExactKeys(child.relationship_definition, [
      'key',
      'version',
    ], `Related child ${index} relationship definition`, code);
    requireText(
      child.relationship_definition.key,
      `Related child ${index} relationship key`,
      code,
    );
    requirePositiveInteger(
      child.relationship_definition.version,
      `Related child ${index} relationship version`,
      code,
    );
    requireText(
      child.relationship_label,
      `Related child ${index} relationship label`,
      code,
    );
    validatePreview(child.verbatim_preview, code);
    validateExactDetailReference(child.child_exact_detail_reference, {
      bindingKind: 'RELATED_CHILD_RESULT',
      bindingIdentity: child.related_child_result_identity,
      release: result,
      sourceDocumentIdentity:
        result.exact_citation.source_document_identity,
    });
    childIds.push(child.related_child_result_identity);
  }
  if (new Set(childIds).size !== childIds.length) {
    fail(code, 'The related-passage collection contains duplicate children.');
  }
  if (
    value.collection_id !== contentId(
      PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA,
      collectionIdentityPayload(value),
    )
  ) {
    fail(code, 'The related-passage collection identity does not match.');
  }
  return true;
}

function adaptProcessRelatedPassagesResponse({
  product_result: productResult,
  process_response: processResponse,
  process_response_validation_context: validationContext,
}) {
  const code = 'INVALID_PRODUCT_PROCESS_RELATED_PASSAGES_RESPONSE';
  validateRuntimeContractBinding();
  validateProductQueryResult(productResult);
  if (productResult.domain_key !== 'PROCESS') {
    fail(code, 'Only a Process result can own Process related passages.');
  }
  try {
    validateProcessRelatedPassagesResponse(
      processResponse,
      validationContext,
    );
  } catch (error) {
    fail(code, 'The Process related-passage response is not valid.', {
      cause: error.code || error.message,
    });
  }
  if (
    processResponse.parent_product_result_identity
      !== productResult.product_query_result_identity
    || processResponse.candidate_release_manifest_id
      !== productResult.candidate_release_manifest_id
    || processResponse.candidate_release_manifest_payload_digest
      !== productResult.candidate_release_manifest_payload_digest
    || processResponse.source_document_identity
      !== productResult.exact_citation.source_document_identity
  ) {
    fail(
      code,
      'The Process response does not bind the exact Product parent.',
    );
  }
  const body = {
    schema_version: PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA,
    parent_product_result_identity:
      processResponse.parent_product_result_identity,
    candidate_release_manifest_id:
      processResponse.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      processResponse.candidate_release_manifest_payload_digest,
    source_document_identity:
      processResponse.source_document_identity,
    children: processResponse.children.map((child) => ({
      related_child_result_identity: child.related_result_id,
      relationship_definition:
        clone(child.relationship_definition_key_and_version, code),
      relationship_label: child.relationship_label,
      verbatim_preview: {
        verbatim_text:
          child.verbatim_passage_preview.verbatim_text,
        verbatim_text_digest:
          child.verbatim_passage_preview.verbatim_text_digest,
        truncation_state:
          child.verbatim_passage_preview.truncation_state,
      },
      child_exact_detail_reference:
        clone(child.exact_detail_reference, code),
    })),
    projection_validation_receipt_id:
      processResponse.projection_validation_receipt_id,
    validation_state: 'EXTERNALLY_VALIDATED',
    execution_authority_state: 'NOT_GRANTED',
  };
  const collection = {
    schema_version: body.schema_version,
    collection_id: contentId(
      PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA,
      body,
    ),
    parent_product_result_identity:
      body.parent_product_result_identity,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    source_document_identity: body.source_document_identity,
    children: body.children,
    projection_validation_receipt_id:
      body.projection_validation_receipt_id,
    validation_state: body.validation_state,
    execution_authority_state: body.execution_authority_state,
  };
  validateRelatedCollection(collection, productResult);
  return deepFreeze(clone(collection, code));
}

function validateActionType(value) {
  if (!ACTION_TYPES.includes(value)) {
    fail(
      'INVALID_PRODUCT_SOURCE_READER_ACTION_TYPE',
      'The Product source-reader action type is not governed.',
    );
  }
}

function validateActionInput(value, actionType, result, admission) {
  const code = 'INVALID_PRODUCT_SOURCE_READER_ACTION_INPUT';
  if (actionType === 'OPEN_SELECTED_SOURCE') {
    requireExactKeys(
      value,
      ['parent_exact_detail_reference'],
      'Open-selected-source input',
      code,
    );
    validateExactDetailReference(value.parent_exact_detail_reference, {
      bindingKind: 'PARENT_PRODUCT_RESULT',
      bindingIdentity: result.product_query_result_identity,
      release: result,
      sourceDocumentIdentity:
        result.exact_citation.source_document_identity,
      sourceEvidenceIdentity:
        result.exact_citation.source_evidence_identity,
    });
    if (
      admission.parent_exact_detail_reference_id
        !== value.parent_exact_detail_reference.exact_detail_reference_id
    ) {
      fail(
        'SOURCE_ACTION_NOT_ADMITTED',
        'The selected exact-detail reference is not release-admitted.',
      );
    }
  } else if (
    actionType === 'EXPAND_ONE_PARAGRAPH_ABOVE'
    || actionType === 'EXPAND_ONE_PARAGRAPH_BELOW'
  ) {
    requireExactKeys(
      value,
      ['server_issued_parent_bound_cursor'],
      'Paragraph expansion input',
      code,
    );
    validateParentBoundCursor(
      value.server_issued_parent_bound_cursor,
      result,
      actionType === 'EXPAND_ONE_PARAGRAPH_ABOVE' ? 'ABOVE' : 'BELOW',
    );
  } else if (actionType === 'LIST_RELATED_PASSAGES') {
    requireExactKeys(value, [], 'List-related-passages input', code);
  } else {
    requireExactKeys(value, [
      'parent_collection_binding',
      'related_child_result_identity',
      'child_exact_detail_reference',
    ], 'Open-related-source input', code);
    requireDigest(
      value.related_child_result_identity,
      'Related child result identity',
      code,
    );
    validateRelatedCollection(value.parent_collection_binding, result);
    const child = value.parent_collection_binding.children.find(
      (entry) => entry.related_child_result_identity
        === value.related_child_result_identity,
    );
    if (
      !child
      || canonicalJson(child.child_exact_detail_reference)
        !== canonicalJson(value.child_exact_detail_reference)
    ) {
      fail(
        'RELATED_PASSAGE_NOT_IN_PARENT_COLLECTION',
        'The related passage is not in the exact parent collection.',
      );
    }
    validateExactDetailReference(value.child_exact_detail_reference, {
      bindingKind: 'RELATED_CHILD_RESULT',
      bindingIdentity: value.related_child_result_identity,
      release: result,
      sourceDocumentIdentity:
        result.exact_citation.source_document_identity,
    });
  }
  return true;
}

function actionSpecificIdentity(actionType, actionInput, result) {
  if (actionType === 'OPEN_SELECTED_SOURCE') {
    return {
      parent_exact_detail_reference:
        actionInput.parent_exact_detail_reference.exact_detail_reference_id,
    };
  }
  if (
    actionType === 'EXPAND_ONE_PARAGRAPH_ABOVE'
    || actionType === 'EXPAND_ONE_PARAGRAPH_BELOW'
  ) {
    return {
      server_issued_parent_bound_cursor:
        actionInput.server_issued_parent_bound_cursor.cursor_id,
    };
  }
  if (actionType === 'LIST_RELATED_PASSAGES') {
    return {
      parent_product_result_identity:
        result.product_query_result_identity,
    };
  }
  return {
    related_child_result_identity:
      actionInput.related_child_result_identity,
    child_exact_detail_reference:
      actionInput.child_exact_detail_reference.exact_detail_reference_id,
  };
}

function actionIdentityPayload({
  result,
  admission,
  actionType,
  actionInput,
}) {
  return {
    parent_product_result_identity:
      result.product_query_result_identity,
    approved_pm_data_version_id: result.approved_pm_data_version_id,
    candidate_release_manifest_id:
      result.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      result.candidate_release_manifest_payload_digest,
    domain_key: result.domain_key,
    domain_result_identity: result.domain_result_identity,
    domain_source_action_stable_id:
      admission.domain_source_action.stable_id,
    domain_source_action_version:
      admission.domain_source_action.version,
    action_type: actionType,
    action_specific_identity_inputs:
      actionSpecificIdentity(actionType, actionInput, result),
  };
}

function releaseMatches(result, resolution) {
  return (
    result.candidate_release_manifest_id
      === resolution.candidate_release_manifest_id
    && result.candidate_release_manifest_payload_digest
      === resolution.candidate_release_manifest_payload_digest
  );
}

function refusalIdentityPayload(value) {
  const payload = clone(value);
  delete payload.source_reader_refusal_id;
  return payload;
}

function failureEvidence(disposition, actionType, actionInput) {
  const body = {
    disposition,
    action_type: actionType,
    requested_action_input: clone(actionInput ?? null),
  };
  return {
    disposition: body.disposition,
    action_type: body.action_type,
    requested_action_input: body.requested_action_input,
    failure_evidence_digest: sha256Hex(
      Buffer.from(canonicalJson(body), 'utf8'),
    ),
  };
}

function refusal({
  result,
  resolution,
  admission,
  ownerBinding,
  actionType,
  actionInput,
  disposition,
}) {
  const body = {
    schema_version: PRODUCT_SOURCE_READER_REFUSAL_SCHEMA,
    parent_product_result: clone(result),
    active_release_resolution: clone(resolution),
    domain_source_action_admission: clone(admission),
    object_authorisation_binding: clone(ownerBinding),
    action_type: actionType,
    disposition,
    failure_evidence: failureEvidence(
      disposition,
      actionType,
      actionInput,
    ),
    original_result_preserved: true,
    execution_state: 'NOT_EXECUTED',
    authority_state: 'NOT_GRANTED',
  };
  const outcome = {
    schema_version: body.schema_version,
    source_reader_refusal_id: contentId(
      PRODUCT_SOURCE_READER_REFUSAL_SCHEMA,
      body,
    ),
    parent_product_result: body.parent_product_result,
    active_release_resolution: body.active_release_resolution,
    domain_source_action_admission:
      body.domain_source_action_admission,
    object_authorisation_binding:
      body.object_authorisation_binding,
    action_type: body.action_type,
    disposition: body.disposition,
    failure_evidence: body.failure_evidence,
    original_result_preserved: body.original_result_preserved,
    execution_state: body.execution_state,
    authority_state: body.authority_state,
  };
  validateProductSourceReaderOutcome(outcome);
  return deepFreeze(clone(outcome));
}

function compileProductSourceReaderAction({
  product_result: productResult,
  active_release_resolution: activeReleaseResolution,
  domain_source_action_admission: domainSourceActionAdmission,
  object_authorisation_binding: objectAuthorisationBinding,
  action_type: actionType,
  action_input: actionInput,
}) {
  validateRuntimeContractBinding();
  validateProductQueryResult(productResult);
  validateProductActiveReleaseResolution(activeReleaseResolution);
  validateOwnerBinding(objectAuthorisationBinding);
  validateDomainSourceActionAdmission(
    domainSourceActionAdmission,
    productResult,
  );
  validateActionType(actionType);
  if (!releaseMatches(productResult, activeReleaseResolution)) {
    return refusal({
      result: productResult,
      resolution: activeReleaseResolution,
      admission: domainSourceActionAdmission,
      ownerBinding: objectAuthorisationBinding,
      actionType,
      actionInput,
      disposition: 'RELEASE_NOT_ACTIVE',
    });
  }
  if (
    !domainSourceActionAdmission.admitted_action_types.includes(actionType)
  ) {
    return refusal({
      result: productResult,
      resolution: activeReleaseResolution,
      admission: domainSourceActionAdmission,
      ownerBinding: objectAuthorisationBinding,
      actionType,
      actionInput,
      disposition: 'SOURCE_ACTION_NOT_ADMITTED',
    });
  }
  try {
    validateActionInput(
      actionInput,
      actionType,
      productResult,
      domainSourceActionAdmission,
    );
  } catch (error) {
    if (
      ['INVALID_PARENT_BOUND_CURSOR', 'SOURCE_ACTION_NOT_ADMITTED',
        'RELATED_PASSAGE_NOT_IN_PARENT_COLLECTION'].includes(error.code)
    ) {
      return refusal({
        result: productResult,
        resolution: activeReleaseResolution,
        admission: domainSourceActionAdmission,
        ownerBinding: objectAuthorisationBinding,
        actionType,
        actionInput,
        disposition: error.code,
      });
    }
    throw error;
  }
  const body = {
    schema_version: PRODUCT_SOURCE_READER_ACTION_SCHEMA,
    parent_product_result: clone(productResult),
    active_release_resolution: clone(activeReleaseResolution),
    domain_source_action_admission: clone(domainSourceActionAdmission),
    object_authorisation_binding: clone(objectAuthorisationBinding),
    action_type: actionType,
    action_input: clone(actionInput),
    delegation_plan: {
      delegation_route: 'RELEASE_ADMITTED_DOMAIN_SOURCE_ACTION',
      maximum_bounded_serving_queries: 1,
      execution_state: 'NOT_EXECUTED',
      source_read_state: 'NOT_PERFORMED',
      response_state: 'NOT_MATERIALISED',
      runtime_authorisation_state: 'REQUIRED_BEFORE_USE',
    },
    authority_state: 'CANONICAL_ADAPTER_ONLY',
  };
  const outcome = {
    schema_version: body.schema_version,
    source_reader_action_id: contentId(
      PRODUCT_SOURCE_READER_ACTION_SCHEMA,
      actionIdentityPayload({
        result: body.parent_product_result,
        admission: body.domain_source_action_admission,
        actionType: body.action_type,
        actionInput: body.action_input,
      }),
    ),
    parent_product_result: body.parent_product_result,
    active_release_resolution: body.active_release_resolution,
    domain_source_action_admission:
      body.domain_source_action_admission,
    object_authorisation_binding:
      body.object_authorisation_binding,
    action_type: body.action_type,
    action_input: body.action_input,
    delegation_plan: body.delegation_plan,
    authority_state: body.authority_state,
  };
  validateProductSourceReaderOutcome(outcome);
  return deepFreeze(clone(outcome));
}

function validateAction(value) {
  const code = 'INVALID_PRODUCT_SOURCE_READER_ACTION';
  requireExactKeys(value, [
    'schema_version',
    'source_reader_action_id',
    'parent_product_result',
    'active_release_resolution',
    'domain_source_action_admission',
    'object_authorisation_binding',
    'action_type',
    'action_input',
    'delegation_plan',
    'authority_state',
  ], 'Product source-reader action', code);
  if (
    value.schema_version !== PRODUCT_SOURCE_READER_ACTION_SCHEMA
    || value.authority_state !== 'CANONICAL_ADAPTER_ONLY'
  ) {
    fail(code, 'The Product source-reader action state is invalid.');
  }
  requireDigest(value.source_reader_action_id, 'Source-reader action ID', code);
  validateProductQueryResult(value.parent_product_result);
  validateProductActiveReleaseResolution(value.active_release_resolution);
  validateOwnerBinding(value.object_authorisation_binding);
  validateDomainSourceActionAdmission(
    value.domain_source_action_admission,
    value.parent_product_result,
  );
  validateActionType(value.action_type);
  if (
    !releaseMatches(
      value.parent_product_result,
      value.active_release_resolution,
    )
    || !value.domain_source_action_admission.admitted_action_types.includes(
      value.action_type,
    )
  ) {
    fail(code, 'The Product source-reader action is not release-admitted.');
  }
  validateActionInput(
    value.action_input,
    value.action_type,
    value.parent_product_result,
    value.domain_source_action_admission,
  );
  requireExactKeys(value.delegation_plan, [
    'delegation_route',
    'maximum_bounded_serving_queries',
    'execution_state',
    'source_read_state',
    'response_state',
    'runtime_authorisation_state',
  ], 'Product source-reader delegation plan', code);
  if (
    value.delegation_plan.delegation_route
      !== 'RELEASE_ADMITTED_DOMAIN_SOURCE_ACTION'
    || value.delegation_plan.maximum_bounded_serving_queries !== 1
    || value.delegation_plan.execution_state !== 'NOT_EXECUTED'
    || value.delegation_plan.source_read_state !== 'NOT_PERFORMED'
    || value.delegation_plan.response_state !== 'NOT_MATERIALISED'
    || value.delegation_plan.runtime_authorisation_state
      !== 'REQUIRED_BEFORE_USE'
  ) {
    fail(code, 'The Product source-reader delegation plan is invalid.');
  }
  const expectedId = contentId(
    PRODUCT_SOURCE_READER_ACTION_SCHEMA,
    actionIdentityPayload({
      result: value.parent_product_result,
      admission: value.domain_source_action_admission,
      actionType: value.action_type,
      actionInput: value.action_input,
    }),
  );
  if (value.source_reader_action_id !== expectedId) {
    fail(code, 'The Product source-reader action identity does not match.');
  }
}

function validateRefusal(value) {
  const code = 'INVALID_PRODUCT_SOURCE_READER_REFUSAL';
  requireExactKeys(value, [
    'schema_version',
    'source_reader_refusal_id',
    'parent_product_result',
    'active_release_resolution',
    'domain_source_action_admission',
    'object_authorisation_binding',
    'action_type',
    'disposition',
    'failure_evidence',
    'original_result_preserved',
    'execution_state',
    'authority_state',
  ], 'Product source-reader refusal', code);
  if (
    value.schema_version !== PRODUCT_SOURCE_READER_REFUSAL_SCHEMA
    || !REFUSAL_DISPOSITIONS.includes(value.disposition)
    || value.original_result_preserved !== true
    || value.execution_state !== 'NOT_EXECUTED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product source-reader refusal state is invalid.');
  }
  requireDigest(value.source_reader_refusal_id, 'Source-reader refusal ID', code);
  validateProductQueryResult(value.parent_product_result);
  validateProductActiveReleaseResolution(value.active_release_resolution);
  validateOwnerBinding(value.object_authorisation_binding);
  validateDomainSourceActionAdmission(
    value.domain_source_action_admission,
    value.parent_product_result,
  );
  validateActionType(value.action_type);
  requireExactKeys(value.failure_evidence, [
    'disposition',
    'action_type',
    'requested_action_input',
    'failure_evidence_digest',
  ], 'Product source-reader refusal evidence', code);
  requireDigest(
    value.failure_evidence.failure_evidence_digest,
    'Source-reader refusal evidence digest',
    code,
  );
  if (
    value.failure_evidence.disposition !== value.disposition
    || value.failure_evidence.action_type !== value.action_type
    || value.failure_evidence.failure_evidence_digest !== sha256Hex(
      Buffer.from(canonicalJson({
        disposition: value.failure_evidence.disposition,
        action_type: value.failure_evidence.action_type,
        requested_action_input:
          value.failure_evidence.requested_action_input,
      }), 'utf8'),
    )
  ) {
    fail(code, 'The Product source-reader refusal evidence is invalid.');
  }
  if (
    value.disposition === 'RELEASE_NOT_ACTIVE'
    && releaseMatches(
        value.parent_product_result,
        value.active_release_resolution,
      )
  ) {
    fail(code, 'The Product source-reader refusal release state is false.');
  }
  if (
    value.disposition === 'SOURCE_ACTION_NOT_ADMITTED'
    && releaseMatches(
      value.parent_product_result,
      value.active_release_resolution,
    )
    && value.domain_source_action_admission.admitted_action_types.includes(
      value.action_type,
    )
  ) {
    try {
      validateActionInput(
        value.failure_evidence.requested_action_input,
        value.action_type,
        value.parent_product_result,
        value.domain_source_action_admission,
      );
      fail(code, 'The Product source-reader refusal admission state is false.');
    } catch (error) {
      if (error.code !== 'SOURCE_ACTION_NOT_ADMITTED') throw error;
    }
  }
  if (
    [
      'INVALID_PARENT_BOUND_CURSOR',
      'RELATED_PASSAGE_NOT_IN_PARENT_COLLECTION',
    ].includes(value.disposition)
  ) {
    if (
      !releaseMatches(
        value.parent_product_result,
        value.active_release_resolution,
      )
      || !value.domain_source_action_admission.admitted_action_types.includes(
        value.action_type,
      )
    ) {
      fail(code, 'The Product source-reader refusal cause ordering is false.');
    }
    try {
      validateActionInput(
        value.failure_evidence.requested_action_input,
        value.action_type,
        value.parent_product_result,
        value.domain_source_action_admission,
      );
      fail(code, 'The Product source-reader refusal evidence is false.');
    } catch (error) {
      if (error.code !== value.disposition) throw error;
    }
  }
  if (
    value.source_reader_refusal_id !== contentId(
      PRODUCT_SOURCE_READER_REFUSAL_SCHEMA,
      refusalIdentityPayload(value),
    )
  ) {
    fail(code, 'The Product source-reader refusal identity does not match.');
  }
}

function validateProductSourceReaderOutcome(value) {
  validateRuntimeContractBinding();
  if (value?.schema_version === PRODUCT_SOURCE_READER_ACTION_SCHEMA) {
    validateAction(value);
  } else if (
    value?.schema_version === PRODUCT_SOURCE_READER_REFUSAL_SCHEMA
  ) {
    validateRefusal(value);
  } else {
    fail(
      'INVALID_PRODUCT_SOURCE_READER_OUTCOME',
      'The Product source-reader outcome schema is not supported.',
    );
  }
  return true;
}

function canonicalProductSourceReaderOutcomeBytes(value) {
  validateProductSourceReaderOutcome(value);
  return Buffer.from(canonicalJson(value), 'utf8');
}

module.exports = {
  ACTION_TYPES,
  PRODUCT_DOMAIN_SOURCE_ACTION_ADMISSION_SCHEMA,
  PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
  PRODUCT_PARENT_BOUND_CURSOR_SCHEMA,
  PRODUCT_RELATED_PASSAGE_COLLECTION_SCHEMA,
  PRODUCT_SOURCE_READER_ACTION_SCHEMA,
  PRODUCT_SOURCE_READER_OWNER_BINDING_SCHEMA,
  PRODUCT_SOURCE_READER_REFUSAL_SCHEMA,
  ProductSourceReaderCompilerError,
  adaptProcessRelatedPassagesResponse,
  canonicalProductSourceReaderOutcomeBytes,
  compileProductSourceReaderAction,
  validateDomainSourceActionAdmission,
  validateProductSourceReaderOutcome,
};
