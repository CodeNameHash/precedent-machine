const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  PRODUCT_QUERY_IR_SCHEMA,
  canonicalProductQueryIrBytes,
} = require('./product-query-ir');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
  validateProductQueryResult,
} = require('./product-citation-share-compiler');

const PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA =
  'PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT/V1';
const PRODUCT_REQUESTED_FIELD_PROJECTION_SCHEMA =
  'PRODUCT_REQUESTED_FIELD_PROJECTION/V1';
const PRODUCT_QUERY_RESULT_ADMISSION_STATE =
  'EXTERNALLY_VALIDATED_PASS';
const MAX_RESULT_FIELDS = 8192;
const SHA256_RE = /^[a-f0-9]{64}$/;
const REPRESENTATION_KINDS = Object.freeze([
  'STRUCTURED_RESULT',
  'VERBATIM_TEXT',
]);

class ProductQueryResultCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductQueryResultCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductQueryResultCompilerError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT',
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
  code = 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT',
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
  code = 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT',
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
  code = 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT',
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

function requireArray(value, label, code, maximum) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  if (maximum !== undefined && value.length > maximum) {
    fail(code, `${label} exceeds the fixed collection bound.`);
  }
  return value;
}

function clone(
  value,
  code = 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product query-result input is not canonical JSON.', {
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

function fieldReferenceKey(reference) {
  return `${reference.field_key}\0${reference.field_version}`;
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
    'Product domain result definition',
    code,
  );
  requireText(
    definition.stable_id,
    'Product domain result definition stable ID',
    code,
  );
  requirePositiveInteger(
    definition.version,
    'Product domain result definition version',
    code,
  );
}

function validationReceiptBody(validation) {
  return {
    validator_stable_id: validation.validator_stable_id,
    validator_version: validation.validator_version,
    validated_payload_digest: validation.validated_payload_digest,
    validation_state: validation.validation_state,
  };
}

function validateDomainResultValidation(validation, payloadDigest, code) {
  requireExactKeys(validation, [
    'schema_version',
    'validator_stable_id',
    'validator_version',
    'validation_receipt_id',
    'validated_payload_digest',
    'validation_state',
  ], 'Product domain result validation', code);
  if (
    validation.schema_version
      !== PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA
    || validation.validation_state !== 'EXTERNALLY_VALIDATED'
    || validation.validated_payload_digest !== payloadDigest
  ) {
    fail(code, 'The Product domain result validation binding is invalid.');
  }
  requireText(
    validation.validator_stable_id,
    'Product domain validator stable ID',
    code,
  );
  requirePositiveInteger(
    validation.validator_version,
    'Product domain validator version',
    code,
  );
  requireDigest(
    validation.validation_receipt_id,
    'Product domain validation receipt ID',
    code,
  );
  requireDigest(
    validation.validated_payload_digest,
    'Product validated payload digest',
    code,
  );
  if (
    validation.validation_receipt_id
      !== contentId(
        PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
        validationReceiptBody(validation),
      )
  ) {
    fail(code, 'The Product domain validation receipt identity is invalid.');
  }
}

function validateDomainResult(domainResult, queryIr, code) {
  requireExactKeys(domainResult, [
    'domain_key',
    'domain_result_definition',
    'domain_result_identity',
    'domain_result_payload',
    'domain_result_payload_digest',
    'domain_result_validation',
    'domain_result_source_representation_kind',
  ], 'Product domain result', code);
  requireText(domainResult.domain_key, 'Product domain result domain key', code);
  validateDomainResultDefinition(
    domainResult.domain_result_definition,
    code,
  );
  requireDigest(
    domainResult.domain_result_identity,
    'Product domain result identity',
    code,
  );
  requireDigest(
    domainResult.domain_result_payload_digest,
    'Product domain result payload digest',
    code,
  );
  if (!REPRESENTATION_KINDS.includes(
    domainResult.domain_result_source_representation_kind,
  )) {
    fail(code, 'The Product domain result representation is not registered.');
  }
  const payload = clone(domainResult.domain_result_payload, code);
  const payloadDigest = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  if (payloadDigest !== domainResult.domain_result_payload_digest) {
    fail(code, 'The Product domain result payload digest is invalid.');
  }
  if (
    domainResult.domain_result_source_representation_kind
      === 'VERBATIM_TEXT'
    && typeof payload !== 'string'
  ) {
    fail(code, 'A verbatim Product domain result must contain text.');
  }
  validateDomainResultValidation(
    domainResult.domain_result_validation,
    payloadDigest,
    code,
  );
  const semantic = queryIr.semantic_contract;
  if (
    domainResult.domain_key !== semantic.domain_key
    || canonicalJson(domainResult.domain_result_definition)
      !== canonicalJson(semantic.result_definition)
  ) {
    fail(
      code,
      'The Product domain result does not match the Product Query IR.',
    );
  }
}

function validateResultFields(resultFields, queryIr, code) {
  const fields = requireArray(
    resultFields,
    'Product requested result fields',
    code,
    MAX_RESULT_FIELDS,
  );
  const requested = queryIr.presentation_contract.requested_columns;
  if (fields.length !== requested.length) {
    fail(code, 'Product result fields do not cover every requested field.');
  }
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
  const references = fields.map((field) => field.field_reference);
  if (
    canonicalJson(references) !== canonicalJson(requested)
    || new Set(references.map(fieldReferenceKey)).size !== references.length
  ) {
    fail(
      code,
      'Product result fields do not match the exact requested field order.',
    );
  }
  return fields;
}

function requestedFieldProjectionIdentity({
  queryIr,
  domainResult,
  resultFields,
}) {
  return contentId(PRODUCT_REQUESTED_FIELD_PROJECTION_SCHEMA, {
    product_query_definition_id: queryIr.query_definition_id,
    domain_result_identity: domainResult.domain_result_identity,
    ordered_result_fields: clone(resultFields),
  });
}

function receiptIdentityBody(receipt) {
  const body = clone(receipt);
  delete body.admission_receipt_id;
  return body;
}

function validateAdmissionReceipt(
  receipt,
  {
    queryIr,
    domainResult,
    fieldProjectionIdentity,
  },
  code,
) {
  requireExactKeys(receipt, [
    'schema_version',
    'admission_receipt_id',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_key',
    'domain_result_definition',
    'domain_result_identity',
    'domain_result_payload_digest',
    'domain_validator_admission_identity',
    'domain_validation_receipt_id',
    'query_coverage_identity',
    'covered_set_identity',
    'query_cohort_identity',
    'predicate_evaluation_state',
    'cohort_evaluation_state',
    'filter_evaluation_state',
    'covered_set_membership_state',
    'requested_field_projection_identity',
    'admission_state',
    'authority_state',
  ], 'Product query-result admission receipt', code);
  if (
    receipt.schema_version
      !== PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA
    || receipt.admission_state !== PRODUCT_QUERY_RESULT_ADMISSION_STATE
    || receipt.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product query-result admission receipt state is invalid.');
  }
  for (const key of [
    'admission_receipt_id',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'domain_result_identity',
    'domain_result_payload_digest',
    'domain_validator_admission_identity',
    'domain_validation_receipt_id',
    'query_coverage_identity',
    'covered_set_identity',
    'query_cohort_identity',
    'requested_field_projection_identity',
  ]) {
    requireDigest(
      receipt[key],
      `Product query-result admission receipt ${key}`,
      code,
    );
  }
  requireText(
    receipt.domain_key,
    'Product query-result admission receipt domain key',
    code,
  );
  validateDomainResultDefinition(
    receipt.domain_result_definition,
    code,
  );
  for (const key of [
    'predicate_evaluation_state',
    'cohort_evaluation_state',
    'filter_evaluation_state',
    'covered_set_membership_state',
  ]) {
    if (receipt[key] !== 'PASS') {
      fail(
        code,
        `Product query-result admission receipt ${key} must be PASS.`,
      );
    }
  }
  const release = queryIr.release_contract;
  const coverage = queryIr.coverage_contract;
  if (
    receipt.product_query_definition_id !== queryIr.query_definition_id
    || receipt.approved_pm_data_version_id
      !== release.approved_pm_data_version_id
    || receipt.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || receipt.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
    || receipt.domain_key !== domainResult.domain_key
    || canonicalJson(receipt.domain_result_definition)
      !== canonicalJson(domainResult.domain_result_definition)
    || receipt.domain_result_identity
      !== domainResult.domain_result_identity
    || receipt.domain_result_payload_digest
      !== domainResult.domain_result_payload_digest
    || receipt.domain_validation_receipt_id
      !== domainResult.domain_result_validation.validation_receipt_id
    || receipt.query_coverage_identity !== coverage.coverage_identity
    || receipt.covered_set_identity !== coverage.covered_set_identity
    || receipt.query_cohort_identity
      !== queryIr.cohort_contract.cohort_definition_id
    || receipt.requested_field_projection_identity
      !== fieldProjectionIdentity
  ) {
    fail(
      code,
      'The Product query-result admission receipt does not match its inputs.',
    );
  }
  if (
    receipt.admission_receipt_id
      !== contentId(
        PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
        receiptIdentityBody(receipt),
      )
  ) {
    fail(code, 'The Product query-result admission receipt identity is invalid.');
  }
}

function resultIdentityPayload({
  queryIr,
  domainResult,
}) {
  return {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_definition_id: queryIr.query_definition_id,
    approved_pm_data_version_id:
      queryIr.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      queryIr.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      queryIr.release_contract.candidate_release_manifest_payload_digest,
    domain_key: domainResult.domain_key,
    domain_result_definition_stable_id:
      domainResult.domain_result_definition.stable_id,
    domain_result_definition_version:
      domainResult.domain_result_definition.version,
    domain_result_identity: domainResult.domain_result_identity,
  };
}

function compileProductQueryResult({
  product_query_ir: queryIr,
  domain_result: domainResult,
  result_fields: resultFields,
  exact_citation: exactCitation,
  exact_detail_action: exactDetailAction,
  admission_receipt: admissionReceipt,
}) {
  const code = 'INVALID_PRODUCT_QUERY_RESULT_COMPILER_INPUT';
  try {
    canonicalProductQueryIrBytes(queryIr);
  } catch (error) {
    fail(code, 'The Product Query IR is invalid.', {
      cause: error.code || error.message,
    });
  }
  validateDomainResult(domainResult, queryIr, code);
  const fields = validateResultFields(resultFields, queryIr, code);
  requireObject(exactCitation, 'Product exact citation', code);
  requireText(
    exactDetailAction,
    'Product exact-detail action',
    code,
  );
  if (!queryIr.detail_action_contract.actions.includes(exactDetailAction)) {
    fail(code, 'The Product exact-detail action is not query-admitted.');
  }
  const fieldProjectionIdentity = requestedFieldProjectionIdentity({
    queryIr,
    domainResult,
    resultFields: fields,
  });
  validateAdmissionReceipt(
    admissionReceipt,
    {
      queryIr,
      domainResult,
      fieldProjectionIdentity,
    },
    code,
  );
  const productResultIdentity = contentId(
    PRODUCT_QUERY_RESULT_SCHEMA,
    resultIdentityPayload({ queryIr, domainResult }),
  );
  const filterContract = clone(queryIr.filter_contract, code);
  const coverageContract = clone(queryIr.coverage_contract, code);
  const result = {
    schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
    product_query_result_identity: productResultIdentity,
    product_query_definition_id: queryIr.query_definition_id,
    approved_pm_data_version_id:
      queryIr.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      queryIr.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      queryIr.release_contract.candidate_release_manifest_payload_digest,
    domain_key: domainResult.domain_key,
    domain_result_definition:
      clone(domainResult.domain_result_definition, code),
    domain_result_identity: domainResult.domain_result_identity,
    domain_result_payload:
      clone(domainResult.domain_result_payload, code),
    domain_result_payload_digest:
      domainResult.domain_result_payload_digest,
    domain_result_validation:
      clone(domainResult.domain_result_validation, code),
    domain_result_source_representation_kind:
      domainResult.domain_result_source_representation_kind,
    exact_citation: clone(exactCitation, code),
    exact_detail_action: exactDetailAction,
    query_provenance: {
      filter_contract: filterContract,
      filter_contract_digest: sha256Hex(Buffer.from(
        canonicalJson(filterContract),
        'utf8',
      )),
      coverage_contract: coverageContract,
      coverage_contract_digest: sha256Hex(Buffer.from(
        canonicalJson(coverageContract),
        'utf8',
      )),
      requested_field_references:
        clone(queryIr.presentation_contract.requested_columns, code),
    },
    result_fields: clone(fields, code),
  };
  try {
    validateProductQueryResult(result);
  } catch (error) {
    fail(code, 'The compiled Product query result is invalid.', {
      cause: error.code || error.message,
    });
  }
  return deepFreeze(clone(result));
}

function canonicalProductQueryResultBytes(result) {
  try {
    validateProductQueryResult(result);
  } catch (error) {
    fail('INVALID_PRODUCT_QUERY_RESULT', 'The Product query result is invalid.', {
      cause: error.code || error.message,
    });
  }
  return Buffer.from(canonicalJson(result), 'utf8');
}

module.exports = {
  MAX_RESULT_FIELDS,
  PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  PRODUCT_REQUESTED_FIELD_PROJECTION_SCHEMA,
  ProductQueryResultCompilerError,
  canonicalProductQueryResultBytes,
  compileProductQueryResult,
  requestedFieldProjectionIdentity,
};
