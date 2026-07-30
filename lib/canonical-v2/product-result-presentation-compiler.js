const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA,
  PRODUCT_FIELD_CATALOGUE_STABLE_ID,
  validateProductFieldCatalogueManifest,
} = require('./product-field-catalogue');
const {
  PRODUCT_QUERY_IR_SCHEMA,
  canonicalProductQueryIrBytes,
} = require('./product-query-ir');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
  validateProductExactCitation,
  validateProductQueryResult,
} = require('./product-citation-share-compiler');
const {
  validateAuthoredProductQueryResultInputs,
} = require('./product-query-result-contract-input-validator');
const {
  validateAuthoredProductResultPresentationInputs,
} = require('./product-result-presentation-contract-input-validator');
const queryIrContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-ir.v1.json',
);
const queryResultContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-result-definition.v1.json',
);
const processPhrasebookProductResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
);
const processPhrasebookProductResultSetAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-set-adapter.v1.json',
);
const presentationContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-result-presentation-definition.v1.json',
);

const PRODUCT_RESULT_PRESENTATION_SCHEMA =
  'PRODUCT_RESULT_PRESENTATION/V1';
const PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA =
  'PRODUCT_QUERY_EXECUTION_SUMMARY/V1';
const PRODUCT_RESULT_SLOT_FAILURE_SCHEMA =
  'PRODUCT_RESULT_SLOT_FAILURE/V1';
const PRODUCT_RESULT_PRESENTATION_CONTRACT_VERSION = 1;
const PRODUCT_QUERY_IR_CONTRACT_DEFINITION_DIGEST =
  '3c57cdc2827cb7275fff90084f5c12d81311358bc2b2d13704f6823b14d4b7a1';
const MAX_RESULT_SLOTS = 64;
const MAX_VALID_RESULTS = 12;
const SHA256_RE = /^[a-f0-9]{64}$/;
const COVERAGE_CERTIFICATION_STATES = Object.freeze([
  'CERTIFIED_COMPLETE',
  'CERTIFIED_INCOMPLETE',
]);
const TYPED_VALUE_STATES = Object.freeze([
  'CONFLICT',
  'KNOWN_MISSING',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'UNKNOWN',
]);
const PRACTITIONER_OPERATORS = Object.freeze({
  BETWEEN: 'is between',
  CONTAINS: 'contains',
  EQ: 'is',
  EXISTS: 'is available',
  GT: 'is more than',
  GTE: 'is at least',
  IN: 'is one of',
  LT: 'is less than',
  LTE: 'is at most',
  NE: 'is not',
  NOT_EXISTS: 'is not available',
  NOT_IN: 'is not one of',
});
const ACTION_TARGET_NAMES = Object.freeze({
  COPY_EXACT_PASSAGE: 'Copy exact passage',
  OPEN_EXACT_DETAIL: 'Open exact detail',
  OPEN_SOURCE: 'Open source',
  SELECT_FOR_EXPORT: 'Select for export',
  SHARE_EXACT_RESULT: 'Share exact result',
});

class ProductResultPresentationCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductResultPresentationCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductResultPresentationCompilerError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT',
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
  code = 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT',
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
  code = 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT',
  maximum = 512,
) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.trim() !== value
    || Buffer.byteLength(value, 'utf8') > maximum
  ) {
    fail(code, `${label} must be a bounded non-empty trimmed string.`);
  }
  return value;
}

function requireDigest(
  value,
  label,
  code = 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT',
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

function requireNonNegativeInteger(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(code, `${label} must be a non-negative safe integer.`);
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
  code = 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product result presentation is not canonical JSON.', {
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

function definitionDigest(contract) {
  return sha256Hex(Buffer.from(
    canonicalJson(contract.definition),
    'utf8',
  ));
}

function validateRuntimeContractBindings() {
  try {
    validateAuthoredProductQueryResultInputs([
      contractMember(processPhrasebookProductResultAdapterContract),
      contractMember(processPhrasebookProductResultSetAdapterContract),
      contractMember(queryResultContract),
    ]);
    validateAuthoredProductResultPresentationInputs([
      contractMember(presentationContract),
    ]);
  } catch (error) {
    fail(
      'INVALID_PRODUCT_RESULT_PRESENTATION_CONTRACT_BINDING',
      'A Product result-presentation runtime contract has changed.',
      { cause: error.code || error.message },
    );
  }
  if (
    queryIrContract.stable_id !== 'PRODUCT_QUERY_IR'
    || queryIrContract.definition?.query_ir_contract?.schema_version
      !== PRODUCT_QUERY_IR_SCHEMA
    || queryResultContract.stable_id !== 'PRODUCT_QUERY_RESULT_DEFINITION'
    || queryResultContract.definition?.result_contract?.schema_version
      !== PRODUCT_QUERY_RESULT_SCHEMA
    || presentationContract.stable_id
      !== 'PRODUCT_RESULT_PRESENTATION_DEFINITION'
    || presentationContract.definition?.presentation_contract?.schema_version
      !== PRODUCT_RESULT_PRESENTATION_SCHEMA
    || definitionDigest(queryIrContract)
      !== PRODUCT_QUERY_IR_CONTRACT_DEFINITION_DIGEST
  ) {
    fail(
      'INVALID_PRODUCT_RESULT_PRESENTATION_CONTRACT_BINDING',
      'A Product result-presentation contract identity is invalid.',
    );
  }
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

function validateUnderstoodLegalQuestion(question, queryIr, code) {
  requireExactKeys(question, [
    'domain_key',
    'topic_key',
    'pattern_key',
    'predicate_key',
    'predicate_version',
    'label',
  ], 'Understood legal question', code);
  for (const key of [
    'domain_key',
    'topic_key',
    'pattern_key',
    'predicate_key',
    'label',
  ]) {
    requireText(
      question[key],
      `Understood legal question ${key}`,
      code,
    );
  }
  requirePositiveInteger(
    question.predicate_version,
    'Understood legal question predicate_version',
    code,
  );
  if (
    question.domain_key !== queryIr.semantic_contract.domain_key
    || question.predicate_key !== queryIr.semantic_contract.predicate_key
    || question.predicate_version
      !== queryIr.semantic_contract.predicate_version
  ) {
    fail(
      code,
      'The understood legal question does not match the Product Query IR.',
    );
  }
}

function validateCatalogueBinding(manifest, queryIr, code) {
  try {
    validateProductFieldCatalogueManifest(manifest);
  } catch (error) {
    fail(code, 'The Product field catalogue is invalid.', {
      cause: error.code || error.message,
    });
  }
  if (
    manifest.schema_version !== PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA
    || manifest.stable_id !== PRODUCT_FIELD_CATALOGUE_STABLE_ID
    || manifest.manifest_id
      !== queryIr.release_contract.product_field_catalogue_manifest_id
    || manifest.canonical_payload_digest
      !== queryIr.release_contract.product_field_catalogue_payload_digest
    || manifest.approved_pm_data_version_id
      !== queryIr.release_contract.approved_pm_data_version_id
    || manifest.candidate_release_manifest_id
      !== queryIr.release_contract.candidate_release_manifest_id
    || manifest.candidate_release_manifest_payload_digest
      !== queryIr.release_contract.candidate_release_manifest_payload_digest
  ) {
    fail(
      code,
      'The Product field catalogue does not match the Product Query IR release.',
    );
  }
}

function validateExecutionSummary(summary, queryIr, code) {
  requireExactKeys(summary, [
    'schema_version',
    'query_execution_summary_id',
    'product_query_definition_id',
    'query_coverage_identity',
    'coverage_certification_state',
    'coverage_certification_identity',
    'covered_deal_count',
    'excluded_deal_count',
    'valid_result_count',
    'failed_result_count',
    'excluded_result_count',
    'total_result_count',
    'operational_state',
  ], 'Product query execution summary', code);
  if (
    summary.schema_version !== PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA
    || summary.operational_state !== 'COMPLETE'
    || !COVERAGE_CERTIFICATION_STATES.includes(
      summary.coverage_certification_state,
    )
  ) {
    fail(code, 'The Product query execution summary state is invalid.');
  }
  for (const key of [
    'query_execution_summary_id',
    'product_query_definition_id',
    'query_coverage_identity',
    'coverage_certification_identity',
  ]) {
    requireDigest(
      summary[key],
      `Product query execution summary ${key}`,
      code,
    );
  }
  for (const key of [
    'covered_deal_count',
    'excluded_deal_count',
    'valid_result_count',
    'failed_result_count',
    'excluded_result_count',
    'total_result_count',
  ]) {
    requireNonNegativeInteger(
      summary[key],
      `Product query execution summary ${key}`,
      code,
    );
  }
  if (
    summary.product_query_definition_id !== queryIr.query_definition_id
    || summary.query_coverage_identity
      !== queryIr.coverage_contract.coverage_identity
  ) {
    fail(
      code,
      'The Product query execution summary does not match the Product Query IR.',
    );
  }
  if (
    summary.total_result_count
      !== (
        summary.valid_result_count
        + summary.failed_result_count
        + summary.excluded_result_count
      )
  ) {
    fail(code, 'The Product query result counts do not reconcile.');
  }
  const body = clone(summary, code);
  delete body.query_execution_summary_id;
  const expectedId = contentId(
    PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
    body,
  );
  if (summary.query_execution_summary_id !== expectedId) {
    fail(code, 'The Product query execution summary identity is invalid.');
  }
}

function validateFailure(failure, code) {
  requireExactKeys(failure, [
    'schema_version',
    'failure_identity',
    'disposition',
    'failed_domain_result_identity',
  ], 'Product result slot failure', code);
  if (failure.schema_version !== PRODUCT_RESULT_SLOT_FAILURE_SCHEMA) {
    fail(code, 'The Product result slot failure schema is invalid.');
  }
  requireDigest(
    failure.failure_identity,
    'Product result slot failure identity',
    code,
  );
  requireText(
    failure.disposition,
    'Product result slot failure disposition',
    code,
  );
  if (failure.failed_domain_result_identity !== null) {
    requireDigest(
      failure.failed_domain_result_identity,
      'Failed domain result identity',
      code,
    );
  }
  const body = clone(failure, code);
  delete body.failure_identity;
  if (
    failure.failure_identity
      !== contentId(PRODUCT_RESULT_SLOT_FAILURE_SCHEMA, body)
  ) {
    fail(code, 'The Product result slot failure identity is invalid.');
  }
}

function validateResultAgainstQuery(result, queryIr, code) {
  try {
    validateProductQueryResult(result);
  } catch (error) {
    fail(code, 'A Product query result is invalid.', {
      cause: error.code || error.message,
    });
  }
  const release = queryIr.release_contract;
  const semantic = queryIr.semantic_contract;
  if (
    result.product_query_definition_id !== queryIr.query_definition_id
    || result.approved_pm_data_version_id
      !== release.approved_pm_data_version_id
    || result.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || result.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
    || result.domain_key !== semantic.domain_key
    || result.domain_result_definition.stable_id
      !== semantic.result_definition.stable_id
    || result.domain_result_definition.version
      !== semantic.result_definition.version
    || canonicalJson(result.query_provenance.filter_contract)
      !== canonicalJson(queryIr.filter_contract)
    || canonicalJson(result.query_provenance.coverage_contract)
      !== canonicalJson(queryIr.coverage_contract)
    || canonicalJson(result.query_provenance.requested_field_references)
      !== canonicalJson(queryIr.presentation_contract.requested_columns)
  ) {
    fail(code, 'A Product query result does not match its Product Query IR.');
  }
  if (!queryIr.detail_action_contract.actions.includes(
    result.exact_detail_action,
  )) {
    fail(code, 'A Product result exact-detail action is not query-admitted.');
  }
}

function typedState(value, code) {
  if (
    value === null
    || value === ''
    || (Array.isArray(value) && value.length === 0)
  ) {
    fail(
      code,
      'A missing Product field value must use an explicit typed state.',
    );
  }
  if (
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && TYPED_VALUE_STATES.includes(value.state)
  ) {
    if (value.state === 'NOT_APPLICABLE') {
      requireDigest(
        value.checked_evidence_identity,
        'NOT_APPLICABLE field checked evidence identity',
        code,
      );
    }
    if (value.state === 'CONFLICT') {
      const candidates = requireArray(
        value.checked_candidates,
        'CONFLICT field checked candidates',
        code,
        MAX_RESULT_SLOTS,
      );
      if (candidates.length < 2) {
        fail(code, 'A CONFLICT field must retain at least two candidates.');
      }
      candidates.forEach((candidate, index) => {
        requireObject(
          candidate,
          `CONFLICT field candidate ${index}`,
          code,
        );
        requireDigest(
          candidate.source_identity,
          `CONFLICT field candidate ${index} source identity`,
          code,
        );
      });
    }
    return value.state;
  }
  return null;
}

function catalogueFieldMap(manifest) {
  return new Map(manifest.field_definitions.map((field) => [
    fieldReferenceKey({
      field_key: field.field_key,
      field_version: field.field_version,
    }),
    field,
  ]));
}

function validateRequestedFields(queryIr, fieldMap, code) {
  return queryIr.presentation_contract.requested_columns.map(
    (reference, index) => {
      validateFieldReference(
        reference,
        `Requested presentation column ${index}`,
        code,
      );
      const field = fieldMap.get(fieldReferenceKey(reference));
      if (
        !field
        || field.capabilities.display !== true
        || !field.supported_domains.includes(
          queryIr.semantic_contract.domain_key,
        )
        || !field.permitted_result_definitions.includes(
          queryIr.semantic_contract.result_definition.stable_id,
        )
      ) {
        fail(
          code,
          'A requested presentation field is not admitted for this result.',
          {
            field_key: reference.field_key,
            field_version: reference.field_version,
          },
        );
      }
      return field;
    },
  );
}

function compileColumns(queryIr, fields) {
  return queryIr.presentation_contract.requested_columns.map(
    (reference, index) => ({
      field_reference: clone(reference),
      field_definition_id: fields[index].field_definition_id,
      label: fields[index].label,
      field_group: fields[index].field_group,
      value_type: fields[index].value_type,
      control_type: fields[index].control_type,
    }),
  );
}

function compileFilterSentence(question, queryIr, fieldMap, code) {
  const segments = queryIr.filter_contract.clauses.map((clause, index) => {
    const field = fieldMap.get(fieldReferenceKey(clause));
    if (!field) {
      fail(code, 'An active filter field is absent from the Product catalogue.');
    }
    const practitionerOperator = PRACTITIONER_OPERATORS[clause.operator];
    if (!practitionerOperator) {
      fail(
        'UNSUPPORTED_PRODUCT_PRACTITIONER_OPERATOR',
        'An active filter has no approved practitioner-language operator.',
        { operator: clause.operator },
      );
    }
    return {
      segment_ordinal: index + 1,
      field_reference: {
        field_key: clause.field_key,
        field_version: clause.field_version,
      },
      field_label: field.label,
      practitioner_operator: practitionerOperator,
      value: clone(clause.value, code),
      editable: true,
      clearable: true,
    };
  });
  return {
    rendering_mode: 'ONE_COMPACT_PRACTITIONER_SENTENCE',
    subject: {
      label: question.label,
      domain_key: question.domain_key,
      predicate_key: question.predicate_key,
      predicate_version: question.predicate_version,
      editable: true,
    },
    ordered_filter_segments: segments,
    edit_disposition: 'REQUIRES_NEW_CHECKED_QUERY',
    decorative_pill_collection: false,
  };
}

function resultActionTargets(result) {
  const base = {
    product_query_result_identity:
      result.product_query_result_identity,
    citation_target_identity:
      result.exact_citation.citation_target_identity,
    authority_state: 'NOT_GRANTED',
  };
  const targets = [
    {
      action_kind: 'OPEN_SOURCE',
      accessible_name: ACTION_TARGET_NAMES.OPEN_SOURCE,
      action_state: 'AVAILABLE',
      ...base,
    },
    {
      action_kind: 'OPEN_EXACT_DETAIL',
      accessible_name: ACTION_TARGET_NAMES.OPEN_EXACT_DETAIL,
      action_state: 'AVAILABLE',
      ...base,
    },
    {
      action_kind: 'SHARE_EXACT_RESULT',
      accessible_name: ACTION_TARGET_NAMES.SHARE_EXACT_RESULT,
      action_state: 'AVAILABLE',
      ...base,
    },
    {
      action_kind: 'SELECT_FOR_EXPORT',
      accessible_name: ACTION_TARGET_NAMES.SELECT_FOR_EXPORT,
      action_state: 'AVAILABLE',
      ...base,
    },
  ];
  if (result.domain_result_source_representation_kind === 'VERBATIM_TEXT') {
    targets.splice(2, 0, {
      action_kind: 'COPY_EXACT_PASSAGE',
      accessible_name: ACTION_TARGET_NAMES.COPY_EXACT_PASSAGE,
      action_state: 'AVAILABLE',
      ...base,
    });
  }
  return targets;
}

function compileValidSlot(result, columns, code) {
  const metadata = result.result_fields.map((field, index) => {
    const state = typedState(field.value, code);
    return {
      field_reference: clone(field.field_reference, code),
      field_definition_id: columns[index].field_definition_id,
      label: columns[index].label,
      value_type: columns[index].value_type,
      value: clone(field.value, code),
      typed_state: state,
    };
  });
  return {
    slot_identity: result.product_query_result_identity,
    slot_state: 'VALID',
    product_query_result_identity:
      result.product_query_result_identity,
    domain_key: result.domain_key,
    domain_result_definition:
      clone(result.domain_result_definition, code),
    domain_result_identity: result.domain_result_identity,
    domain_result_payload_digest:
      result.domain_result_payload_digest,
    domain_result_validation:
      clone(result.domain_result_validation, code),
    source_representation_kind:
      result.domain_result_source_representation_kind,
    exact_content: clone(result.domain_result_payload, code),
    preview: {
      content: clone(result.domain_result_payload, code),
      truncated: false,
    },
    metadata,
    exact_citation: clone(result.exact_citation, code),
    exact_detail_action: result.exact_detail_action,
    action_targets: resultActionTargets(result),
    failure: null,
  };
}

function compileFailedSlot(slot, code) {
  validateFailure(slot.failure, code);
  if (slot.slot_identity !== slot.failure.failure_identity) {
    fail(code, 'A failed Product result slot uses the wrong identity.');
  }
  return {
    slot_identity: slot.slot_identity,
    slot_state: 'UNAVAILABLE',
    product_query_result_identity: null,
    domain_key: null,
    domain_result_definition: null,
    domain_result_identity:
      slot.failure.failed_domain_result_identity,
    domain_result_payload_digest: null,
    domain_result_validation: null,
    source_representation_kind: null,
    exact_content: null,
    preview: null,
    metadata: [],
    exact_citation: null,
    exact_detail_action: null,
    action_targets: [],
    failure: clone(slot.failure, code),
  };
}

function validateAndCompileSlots(slots, queryIr, columns, code) {
  const values = requireArray(
    slots,
    'Ordered Product result slots',
    code,
    MAX_RESULT_SLOTS,
  );
  const identities = [];
  let validCount = 0;
  let failedCount = 0;
  const compiled = values.map((slot, index) => {
    requireExactKeys(
      slot,
      ['slot_identity', 'slot_state', 'product_query_result', 'failure'],
      `Product result slot ${index}`,
      code,
    );
    requireDigest(
      slot.slot_identity,
      `Product result slot ${index} identity`,
      code,
    );
    identities.push(slot.slot_identity);
    if (slot.slot_state === 'VALID') {
      if (slot.failure !== null) {
        fail(code, 'A valid Product result slot cannot contain a failure.');
      }
      requireObject(
        slot.product_query_result,
        `Product result slot ${index} result`,
        code,
      );
      validateResultAgainstQuery(
        slot.product_query_result,
        queryIr,
        code,
      );
      if (
        slot.slot_identity
          !== slot.product_query_result.product_query_result_identity
      ) {
        fail(code, 'A valid Product result slot uses the wrong identity.');
      }
      validCount += 1;
      return compileValidSlot(
        slot.product_query_result,
        columns,
        code,
      );
    }
    if (slot.slot_state === 'UNAVAILABLE') {
      if (slot.product_query_result !== null) {
        fail(code, 'An unavailable Product result slot cannot contain a result.');
      }
      failedCount += 1;
      return compileFailedSlot(slot, code);
    }
    fail(code, 'A Product result slot state is not registered.');
  });
  if (new Set(identities).size !== identities.length) {
    fail(code, 'Ordered Product result slots contain a duplicate identity.');
  }
  if (validCount > MAX_VALID_RESULTS) {
    fail(code, 'A Product presentation cannot contain more than 12 valid results.');
  }
  return {
    slots: compiled,
    identities,
    validCount,
    failedCount,
  };
}

function presentationIdentityPayload({
  queryIr,
  manifest,
  slotIdentities,
}) {
  return {
    product_query_definition_id: queryIr.query_definition_id,
    approved_pm_data_version_id:
      queryIr.release_contract.approved_pm_data_version_id,
    candidate_release_manifest_id:
      queryIr.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      queryIr.release_contract.candidate_release_manifest_payload_digest,
    product_field_catalogue_id: manifest.manifest_id,
    product_field_catalogue_payload_digest:
      manifest.canonical_payload_digest,
    query_coverage_identity:
      queryIr.coverage_contract.coverage_identity,
    ordered_product_result_slot_identities: clone(slotIdentities),
    presentation_contract_version:
      PRODUCT_RESULT_PRESENTATION_CONTRACT_VERSION,
  };
}

function payloadDigestPayload(presentation) {
  const body = clone(presentation);
  delete body.product_result_presentation_id;
  delete body.canonical_payload_digest;
  return body;
}

function compileProductResultPresentation({
  understood_legal_question: question,
  product_query_ir: queryIr,
  product_field_catalogue_manifest: manifest,
  ordered_result_slots: slots,
  query_execution_summary: summary,
}) {
  validateRuntimeContractBindings();
  const code = 'INVALID_PRODUCT_RESULT_PRESENTATION_INPUT';
  let queryIrBytes;
  try {
    queryIrBytes = canonicalProductQueryIrBytes(queryIr);
  } catch (error) {
    fail(code, 'The Product Query IR is invalid.', {
      cause: error.code || error.message,
    });
  }
  validateUnderstoodLegalQuestion(question, queryIr, code);
  validateCatalogueBinding(manifest, queryIr, code);
  validateExecutionSummary(summary, queryIr, code);
  const fieldMap = catalogueFieldMap(manifest);
  const requestedFields = validateRequestedFields(queryIr, fieldMap, code);
  const columns = compileColumns(queryIr, requestedFields);
  const slotResult = validateAndCompileSlots(
    slots,
    queryIr,
    columns,
    code,
  );
  if (
    summary.valid_result_count !== slotResult.validCount
    || summary.failed_result_count !== slotResult.failedCount
  ) {
    fail(code, 'Product result slots do not match the checked result counts.');
  }
  const isComplete = summary.coverage_certification_state
    === 'CERTIFIED_COMPLETE';
  const hasNoEmittedResults = (
    slotResult.validCount === 0
    && slotResult.failedCount === 0
  );
  const body = {
    schema_version: PRODUCT_RESULT_PRESENTATION_SCHEMA,
    contract_bindings: {
      presentation_definition: {
        stable_id: presentationContract.stable_id,
        schema_version: presentationContract.schema_version,
        definition_digest: definitionDigest(presentationContract),
      },
      product_query_ir_definition: {
        stable_id: queryIrContract.stable_id,
        schema_version: queryIrContract.schema_version,
        definition_digest: definitionDigest(queryIrContract),
        query_definition_id: queryIr.query_definition_id,
        query_payload_digest: sha256Hex(queryIrBytes),
      },
      product_query_result_definition: {
        stable_id: queryResultContract.stable_id,
        schema_version: queryResultContract.schema_version,
        definition_digest: definitionDigest(queryResultContract),
      },
      product_field_catalogue: {
        stable_id: manifest.stable_id,
        schema_version: manifest.schema_version,
        manifest_id: manifest.manifest_id,
        payload_digest: manifest.canonical_payload_digest,
      },
    },
    identity_inputs: presentationIdentityPayload({
      queryIr,
      manifest,
      slotIdentities: slotResult.identities,
    }),
    understood_legal_question: clone(question, code),
    filter_sentence: compileFilterSentence(
      question,
      queryIr,
      fieldMap,
      code,
    ),
    view_contract: {
      default_view: 'ANSWER_FIRST_PASSAGES',
      permitted_views: [
        'ANSWER_FIRST_PASSAGES',
        'DENSE_TABLE',
      ],
      selected_view_is_payload_identity_input: false,
      second_query_required_for_view_switch: false,
    },
    columns,
    ordered_product_result_slot_identities:
      clone(slotResult.identities, code),
    result_slots: slotResult.slots,
    coverage: {
      query_coverage_identity:
        queryIr.coverage_contract.coverage_identity,
      coverage_payload_digest:
        queryIr.coverage_contract.coverage_payload_digest,
      covered_set_identity:
        queryIr.coverage_contract.covered_set_identity,
      exclusions_identity:
        queryIr.coverage_contract.exclusions_identity,
      coverage_certification_state:
        summary.coverage_certification_state,
      coverage_certification_identity:
        summary.coverage_certification_identity,
      covered_deal_count: summary.covered_deal_count,
      excluded_deal_count: summary.excluded_deal_count,
      coverage_claim: isComplete
        ? 'COMPLETE_FOR_CHECKED_COVERED_SET'
        : 'INCOMPLETE_FOR_CHECKED_COVERED_SET',
    },
    counts: {
      valid_result_count: summary.valid_result_count,
      failed_result_count: summary.failed_result_count,
      excluded_result_count: summary.excluded_result_count,
      emitted_result_slot_count: slotResult.slots.length,
      total_result_count: summary.total_result_count,
    },
    empty_result: {
      disposition: hasNoEmittedResults && isComplete
        ? 'NO_RESULTS_IN_COVERED_DEALS'
        : null,
      user_message: hasNoEmittedResults && isComplete
        ? 'No results in the covered deals'
        : null,
      market_absence_claim: false,
    },
    query_execution_summary_id:
      summary.query_execution_summary_id,
    renderer_contract: {
      passage_and_table_use_same_payload: true,
      renderer_can_add_omit_reorder_or_change_content: false,
      renderer_can_query_or_read_source: false,
      generated_narrative_permitted: false,
    },
    authority_state: 'NOT_GRANTED',
  };
  const identityInputs = body.identity_inputs;
  const presentation = {
    schema_version: body.schema_version,
    product_result_presentation_id: contentId(
      PRODUCT_RESULT_PRESENTATION_SCHEMA,
      identityInputs,
    ),
    canonical_payload_digest: null,
    contract_bindings: body.contract_bindings,
    identity_inputs: body.identity_inputs,
    understood_legal_question:
      body.understood_legal_question,
    filter_sentence: body.filter_sentence,
    view_contract: body.view_contract,
    columns: body.columns,
    ordered_product_result_slot_identities:
      body.ordered_product_result_slot_identities,
    result_slots: body.result_slots,
    coverage: body.coverage,
    counts: body.counts,
    empty_result: body.empty_result,
    query_execution_summary_id:
      body.query_execution_summary_id,
    renderer_contract: body.renderer_contract,
    authority_state: body.authority_state,
  };
  presentation.canonical_payload_digest = sha256Hex(Buffer.from(
    canonicalJson(payloadDigestPayload(presentation)),
    'utf8',
  ));
  return deepFreeze(clone(presentation));
}

function validateProductResultPresentation(presentation) {
  validateRuntimeContractBindings();
  const code = 'INVALID_PRODUCT_RESULT_PRESENTATION';
  requireExactKeys(presentation, [
    'schema_version',
    'product_result_presentation_id',
    'canonical_payload_digest',
    'contract_bindings',
    'identity_inputs',
    'understood_legal_question',
    'filter_sentence',
    'view_contract',
    'columns',
    'ordered_product_result_slot_identities',
    'result_slots',
    'coverage',
    'counts',
    'empty_result',
    'query_execution_summary_id',
    'renderer_contract',
    'authority_state',
  ], 'Product result presentation', code);
  if (
    presentation.schema_version !== PRODUCT_RESULT_PRESENTATION_SCHEMA
    || presentation.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product result presentation identity is invalid.');
  }
  requireDigest(
    presentation.product_result_presentation_id,
    'Product result presentation ID',
    code,
  );
  requireDigest(
    presentation.canonical_payload_digest,
    'Product result presentation payload digest',
    code,
  );
  requireDigest(
    presentation.query_execution_summary_id,
    'Product query execution summary ID',
    code,
  );
  requireExactKeys(presentation.contract_bindings, [
    'presentation_definition',
    'product_query_ir_definition',
    'product_query_result_definition',
    'product_field_catalogue',
  ], 'Product result presentation contract bindings', code);
  const expectedBindings = {
    presentation_definition: {
      stable_id: presentationContract.stable_id,
      schema_version: presentationContract.schema_version,
      definition_digest: definitionDigest(presentationContract),
    },
    product_query_result_definition: {
      stable_id: queryResultContract.stable_id,
      schema_version: queryResultContract.schema_version,
      definition_digest: definitionDigest(queryResultContract),
    },
  };
  for (const key of [
    'presentation_definition',
    'product_query_result_definition',
  ]) {
    if (
      canonicalJson(presentation.contract_bindings[key])
        !== canonicalJson(expectedBindings[key])
    ) {
      fail(code, `The ${key} contract binding is invalid.`);
    }
  }
  requireExactKeys(
    presentation.contract_bindings.product_query_ir_definition,
    [
      'stable_id',
      'schema_version',
      'definition_digest',
      'query_definition_id',
      'query_payload_digest',
    ],
    'Product Query IR presentation binding',
    code,
  );
  const queryBinding =
    presentation.contract_bindings.product_query_ir_definition;
  if (
    queryBinding.stable_id !== queryIrContract.stable_id
    || queryBinding.schema_version !== queryIrContract.schema_version
    || queryBinding.definition_digest !== definitionDigest(queryIrContract)
    || queryBinding.query_definition_id
      !== presentation.identity_inputs.product_query_definition_id
  ) {
    fail(code, 'The Product Query IR presentation binding is invalid.');
  }
  requireDigest(
    queryBinding.query_definition_id,
    'Presentation-bound Product query definition ID',
    code,
  );
  requireDigest(
    queryBinding.query_payload_digest,
    'Presentation-bound Product query payload digest',
    code,
  );
  requireExactKeys(
    presentation.contract_bindings.product_field_catalogue,
    [
      'stable_id',
      'schema_version',
      'manifest_id',
      'payload_digest',
    ],
    'Product field catalogue presentation binding',
    code,
  );
  const catalogueBinding =
    presentation.contract_bindings.product_field_catalogue;
  if (
    catalogueBinding.stable_id !== PRODUCT_FIELD_CATALOGUE_STABLE_ID
    || catalogueBinding.schema_version
      !== PRODUCT_FIELD_CATALOGUE_MANIFEST_SCHEMA
    || catalogueBinding.manifest_id
      !== presentation.identity_inputs.product_field_catalogue_id
    || catalogueBinding.payload_digest
      !== presentation.identity_inputs.product_field_catalogue_payload_digest
  ) {
    fail(code, 'The Product field catalogue presentation binding is invalid.');
  }
  requireExactKeys(presentation.identity_inputs, [
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'product_field_catalogue_id',
    'product_field_catalogue_payload_digest',
    'query_coverage_identity',
    'ordered_product_result_slot_identities',
    'presentation_contract_version',
  ], 'Product result presentation identity inputs', code);
  for (const key of [
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'product_field_catalogue_id',
    'product_field_catalogue_payload_digest',
    'query_coverage_identity',
  ]) {
    requireDigest(
      presentation.identity_inputs[key],
      `Product result presentation ${key}`,
      code,
    );
  }
  if (
    presentation.identity_inputs.presentation_contract_version
      !== PRODUCT_RESULT_PRESENTATION_CONTRACT_VERSION
  ) {
    fail(code, 'The Product result presentation contract version is invalid.');
  }
  const identitySlotIds = requireArray(
    presentation.identity_inputs.ordered_product_result_slot_identities,
    'Product result presentation identity slot IDs',
    code,
    MAX_RESULT_SLOTS,
  );
  identitySlotIds.forEach((identity, index) => requireDigest(
    identity,
    `Product result presentation identity slot ID ${index}`,
    code,
  ));
  validateUnderstoodLegalQuestion(
    presentation.understood_legal_question,
    {
      semantic_contract: {
        domain_key:
          presentation.understood_legal_question.domain_key,
        predicate_key:
          presentation.understood_legal_question.predicate_key,
        predicate_version:
          presentation.understood_legal_question.predicate_version,
      },
    },
    code,
  );
  requireExactKeys(presentation.filter_sentence, [
    'rendering_mode',
    'subject',
    'ordered_filter_segments',
    'edit_disposition',
    'decorative_pill_collection',
  ], 'Product result presentation filter sentence', code);
  requireExactKeys(presentation.filter_sentence.subject, [
    'label',
    'domain_key',
    'predicate_key',
    'predicate_version',
    'editable',
  ], 'Product result presentation filter subject', code);
  const filterSubject = presentation.filter_sentence.subject;
  const question = presentation.understood_legal_question;
  if (
    presentation.filter_sentence.rendering_mode
      !== 'ONE_COMPACT_PRACTITIONER_SENTENCE'
    || presentation.filter_sentence.edit_disposition
      !== 'REQUIRES_NEW_CHECKED_QUERY'
    || presentation.filter_sentence.decorative_pill_collection !== false
    || filterSubject.editable !== true
    || filterSubject.label !== question.label
    || filterSubject.domain_key !== question.domain_key
    || filterSubject.predicate_key !== question.predicate_key
    || filterSubject.predicate_version !== question.predicate_version
  ) {
    fail(code, 'The Product result presentation filter subject is invalid.');
  }
  const filterSegments = requireArray(
    presentation.filter_sentence.ordered_filter_segments,
    'Product result presentation filter segments',
    code,
    8192,
  );
  filterSegments.forEach((segment, index) => {
    requireExactKeys(segment, [
      'segment_ordinal',
      'field_reference',
      'field_label',
      'practitioner_operator',
      'value',
      'editable',
      'clearable',
    ], `Product result presentation filter segment ${index}`, code);
    if (
      segment.segment_ordinal !== index + 1
      || segment.editable !== true
      || segment.clearable !== true
      || !Object.values(PRACTITIONER_OPERATORS).includes(
        segment.practitioner_operator,
      )
    ) {
      fail(code, 'A Product result presentation filter segment is invalid.');
    }
    validateFieldReference(
      segment.field_reference,
      `Product result presentation filter segment ${index} field`,
      code,
    );
    requireText(
      segment.field_label,
      `Product result presentation filter segment ${index} label`,
      code,
    );
    clone(segment.value, code);
  });
  if (
    new Set(filterSegments.map(
      (segment) => fieldReferenceKey(segment.field_reference),
    )).size !== filterSegments.length
  ) {
    fail(code, 'Product result presentation filter segments contain a duplicate.');
  }
  requireExactKeys(presentation.view_contract, [
    'default_view',
    'permitted_views',
    'selected_view_is_payload_identity_input',
    'second_query_required_for_view_switch',
  ], 'Product result presentation view contract', code);
  if (
    presentation.view_contract.default_view !== 'ANSWER_FIRST_PASSAGES'
    || canonicalJson(presentation.view_contract.permitted_views)
      !== canonicalJson(['ANSWER_FIRST_PASSAGES', 'DENSE_TABLE'])
    || presentation.view_contract.selected_view_is_payload_identity_input
      !== false
    || presentation.view_contract.second_query_required_for_view_switch
      !== false
  ) {
    fail(code, 'The Product result presentation view contract is invalid.');
  }
  const columns = requireArray(
    presentation.columns,
    'Product result presentation columns',
    code,
    8192,
  );
  columns.forEach((column, index) => {
    requireExactKeys(column, [
      'field_reference',
      'field_definition_id',
      'label',
      'field_group',
      'value_type',
      'control_type',
    ], `Product result presentation column ${index}`, code);
    validateFieldReference(
      column.field_reference,
      `Product result presentation column ${index} reference`,
      code,
    );
    requireDigest(
      column.field_definition_id,
      `Product result presentation column ${index} definition ID`,
      code,
    );
    for (const key of [
      'label',
      'field_group',
      'value_type',
      'control_type',
    ]) {
      requireText(
        column[key],
        `Product result presentation column ${index} ${key}`,
        code,
      );
    }
  });
  if (
    new Set(columns.map(
      (column) => fieldReferenceKey(column.field_reference),
    )).size !== columns.length
  ) {
    fail(code, 'Product result presentation columns contain a duplicate.');
  }
  const expectedId = contentId(
    PRODUCT_RESULT_PRESENTATION_SCHEMA,
    presentation.identity_inputs,
  );
  if (presentation.product_result_presentation_id !== expectedId) {
    fail(code, 'The Product result presentation ID does not match its inputs.');
  }
  const expectedDigest = sha256Hex(Buffer.from(
    canonicalJson(payloadDigestPayload(presentation)),
    'utf8',
  ));
  if (presentation.canonical_payload_digest !== expectedDigest) {
    fail(code, 'The Product result presentation payload digest is invalid.');
  }
  const orderedSlotIds = requireArray(
    presentation.ordered_product_result_slot_identities,
    'Product result presentation ordered slot IDs',
    code,
    MAX_RESULT_SLOTS,
  );
  const presentationSlots = requireArray(
    presentation.result_slots,
    'Product result presentation slots',
    code,
    MAX_RESULT_SLOTS,
  );
  if (
    canonicalJson(orderedSlotIds)
      !== canonicalJson(
        presentationSlots.map((slot) => slot.slot_identity),
      )
    || canonicalJson(identitySlotIds) !== canonicalJson(orderedSlotIds)
    || presentation.counts.emitted_result_slot_count
      !== presentationSlots.length
  ) {
    fail(code, 'The Product result presentation slots do not reconcile.');
  }
  let validCount = 0;
  let failedCount = 0;
  for (const [index, slot] of presentationSlots.entries()) {
    requireExactKeys(slot, [
      'slot_identity',
      'slot_state',
      'product_query_result_identity',
      'domain_key',
      'domain_result_definition',
      'domain_result_identity',
      'domain_result_payload_digest',
      'domain_result_validation',
      'source_representation_kind',
      'exact_content',
      'preview',
      'metadata',
      'exact_citation',
      'exact_detail_action',
      'action_targets',
      'failure',
    ], `Product result presentation slot ${index}`, code);
    requireDigest(
      slot.slot_identity,
      `Product result presentation slot ${index} identity`,
      code,
    );
    if (slot.slot_state === 'UNAVAILABLE') {
      validateFailure(slot.failure, code);
      if (
        slot.slot_identity !== slot.failure.failure_identity
        || slot.product_query_result_identity !== null
        || slot.domain_key !== null
        || slot.domain_result_definition !== null
        || slot.domain_result_payload_digest !== null
        || slot.domain_result_validation !== null
        || slot.source_representation_kind !== null
        || slot.exact_content !== null
        || slot.preview !== null
        || slot.exact_citation !== null
        || slot.exact_detail_action !== null
      ) {
        fail(code, 'An unavailable Product presentation slot is invalid.');
      }
      if (
        requireArray(
          slot.metadata,
          `Unavailable Product result slot ${index} metadata`,
          code,
          0,
        ).length !== 0
        || requireArray(
          slot.action_targets,
          `Unavailable Product result slot ${index} action targets`,
          code,
          0,
        ).length !== 0
      ) {
        fail(code, 'An unavailable Product presentation slot has output data.');
      }
      failedCount += 1;
      continue;
    }
    if (slot.slot_state !== 'VALID' || slot.failure !== null) {
      fail(code, 'A Product presentation slot state is invalid.');
    }
    validCount += 1;
    for (const key of [
      'product_query_result_identity',
      'domain_result_identity',
      'domain_result_payload_digest',
    ]) {
      requireDigest(
        slot[key],
        `Product result presentation slot ${index} ${key}`,
        code,
      );
    }
    if (slot.slot_identity !== slot.product_query_result_identity) {
      fail(code, 'A valid Product presentation slot identity is invalid.');
    }
    requireText(
      slot.domain_key,
      `Product result presentation slot ${index} domain key`,
      code,
    );
    requireText(
      slot.exact_detail_action,
      `Product result presentation slot ${index} exact-detail action`,
      code,
    );
    if (
      sha256Hex(Buffer.from(canonicalJson(slot.exact_content), 'utf8'))
        !== slot.domain_result_payload_digest
      || canonicalJson(slot.preview) !== canonicalJson({
        content: slot.exact_content,
        truncated: false,
      })
    ) {
      fail(code, 'A Product presentation slot changed its exact content.');
    }
    const validation = requireObject(
      slot.domain_result_validation,
      `Product result presentation slot ${index} validation`,
      code,
    );
    requireExactKeys(validation, [
      'schema_version',
      'validator_stable_id',
      'validator_version',
      'validation_receipt_id',
      'validated_payload_digest',
      'validation_state',
    ], `Product result presentation slot ${index} validation`, code);
    if (
      validation.schema_version
        !== PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA
      || validation.validated_payload_digest
        !== slot.domain_result_payload_digest
      || validation.validation_state !== 'EXTERNALLY_VALIDATED'
    ) {
      fail(code, 'A Product presentation slot validation binding is invalid.');
    }
    const validationBody = {
      validator_stable_id: validation.validator_stable_id,
      validator_version: validation.validator_version,
      validated_payload_digest: validation.validated_payload_digest,
      validation_state: validation.validation_state,
    };
    if (
      validation.validation_receipt_id
        !== contentId(
          PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
          validationBody,
        )
    ) {
      fail(code, 'A Product presentation slot validation receipt is invalid.');
    }
    const metadata = requireArray(
      slot.metadata,
      `Product result presentation slot ${index} metadata`,
      code,
      columns.length,
    );
    if (metadata.length !== columns.length) {
      fail(code, 'A Product presentation slot has incomplete metadata.');
    }
    metadata.forEach((field, fieldIndex) => {
      requireExactKeys(field, [
        'field_reference',
        'field_definition_id',
        'label',
        'value_type',
        'value',
        'typed_state',
      ], `Product presentation metadata ${fieldIndex}`, code);
      const column = columns[fieldIndex];
      if (
        canonicalJson(field.field_reference)
          !== canonicalJson(column.field_reference)
        || field.field_definition_id !== column.field_definition_id
        || field.label !== column.label
        || field.value_type !== column.value_type
        || field.typed_state !== typedState(field.value, code)
      ) {
        fail(code, 'Product presentation metadata changed its column meaning.');
      }
    });
    requireObject(
      slot.exact_citation,
      `Product result presentation slot ${index} exact citation`,
      code,
    );
    try {
      validateProductExactCitation(slot.exact_citation, {
        product_query_result_identity:
          slot.product_query_result_identity,
        candidate_release_manifest_id:
          presentation.identity_inputs.candidate_release_manifest_id,
        candidate_release_manifest_payload_digest:
          presentation.identity_inputs
            .candidate_release_manifest_payload_digest,
        domain_result_source_representation_kind:
          slot.source_representation_kind,
      });
    } catch (error) {
      fail(code, 'A Product presentation slot citation is invalid.', {
        cause: error.code || error.message,
      });
    }
    if (slot.source_representation_kind === 'VERBATIM_TEXT') {
      if (
        typeof slot.exact_content !== 'string'
        || slot.exact_citation.source_interval.exact_text_digest
          !== sha256Hex(Buffer.from(slot.exact_content, 'utf8'))
      ) {
        fail(code, 'A verbatim Product presentation citation changed.');
      }
    }
    const targets = requireArray(
      slot.action_targets,
      `Product result presentation slot ${index} action targets`,
      code,
      5,
    );
    const expectedActionKinds = slot.source_representation_kind
      === 'VERBATIM_TEXT'
      ? [
        'OPEN_SOURCE',
        'OPEN_EXACT_DETAIL',
        'COPY_EXACT_PASSAGE',
        'SHARE_EXACT_RESULT',
        'SELECT_FOR_EXPORT',
      ]
      : [
        'OPEN_SOURCE',
        'OPEN_EXACT_DETAIL',
        'SHARE_EXACT_RESULT',
        'SELECT_FOR_EXPORT',
      ];
    if (
      canonicalJson(targets.map((target) => target.action_kind))
        !== canonicalJson(expectedActionKinds)
    ) {
      fail(code, 'Product presentation action targets are invalid.');
    }
    targets.forEach((target, targetIndex) => {
      requireExactKeys(target, [
        'action_kind',
        'accessible_name',
        'action_state',
        'product_query_result_identity',
        'citation_target_identity',
        'authority_state',
      ], `Product presentation action target ${targetIndex}`, code);
      if (
        target.product_query_result_identity
          !== slot.product_query_result_identity
        || target.citation_target_identity
          !== slot.exact_citation.citation_target_identity
        || target.action_state !== 'AVAILABLE'
        || target.authority_state !== 'NOT_GRANTED'
        || target.accessible_name
          !== ACTION_TARGET_NAMES[target.action_kind]
      ) {
        fail(code, 'A Product presentation action target binding is invalid.');
      }
      requireText(
        target.accessible_name,
        `Product presentation action target ${targetIndex} name`,
        code,
      );
    });
  }
  if (
    validCount > MAX_VALID_RESULTS
    || presentation.counts.valid_result_count !== validCount
    || presentation.counts.failed_result_count !== failedCount
    || presentation.counts.excluded_result_count < 0
    || presentation.counts.total_result_count
      !== (
        validCount
        + failedCount
        + presentation.counts.excluded_result_count
      )
  ) {
    fail(code, 'Product result presentation counts are invalid.');
  }
  requireExactKeys(presentation.counts, [
    'valid_result_count',
    'failed_result_count',
    'excluded_result_count',
    'emitted_result_slot_count',
    'total_result_count',
  ], 'Product result presentation counts', code);
  Object.entries(presentation.counts).forEach(([key, value]) => (
    requireNonNegativeInteger(
      value,
      `Product result presentation count ${key}`,
      code,
    )
  ));
  requireExactKeys(presentation.coverage, [
    'query_coverage_identity',
    'coverage_payload_digest',
    'covered_set_identity',
    'exclusions_identity',
    'coverage_certification_state',
    'coverage_certification_identity',
    'covered_deal_count',
    'excluded_deal_count',
    'coverage_claim',
  ], 'Product result presentation coverage', code);
  for (const key of [
    'query_coverage_identity',
    'coverage_payload_digest',
    'covered_set_identity',
    'exclusions_identity',
    'coverage_certification_identity',
  ]) {
    requireDigest(
      presentation.coverage[key],
      `Product result presentation coverage ${key}`,
      code,
    );
  }
  for (const key of ['covered_deal_count', 'excluded_deal_count']) {
    requireNonNegativeInteger(
      presentation.coverage[key],
      `Product result presentation coverage ${key}`,
      code,
    );
  }
  const completeCoverage = presentation.coverage
    .coverage_certification_state === 'CERTIFIED_COMPLETE';
  if (
    !COVERAGE_CERTIFICATION_STATES.includes(
      presentation.coverage.coverage_certification_state,
    )
    || presentation.coverage.query_coverage_identity
      !== presentation.identity_inputs.query_coverage_identity
    || presentation.coverage.coverage_claim
      !== (
        completeCoverage
          ? 'COMPLETE_FOR_CHECKED_COVERED_SET'
          : 'INCOMPLETE_FOR_CHECKED_COVERED_SET'
      )
  ) {
    fail(code, 'Product result presentation coverage is invalid.');
  }
  requireExactKeys(presentation.empty_result, [
    'disposition',
    'user_message',
    'market_absence_claim',
  ], 'Product result presentation empty result', code);
  const emptyResultExpected = (
    validCount === 0
    && failedCount === 0
    && completeCoverage
  );
  if (
    presentation.empty_result.disposition
      !== (
        emptyResultExpected
          ? 'NO_RESULTS_IN_COVERED_DEALS'
          : null
      )
    || presentation.empty_result.user_message
      !== (
        emptyResultExpected
          ? 'No results in the covered deals'
          : null
      )
    || presentation.empty_result.market_absence_claim !== false
  ) {
    fail(code, 'The Product result presentation empty result is invalid.');
  }
  requireExactKeys(presentation.renderer_contract, [
    'passage_and_table_use_same_payload',
    'renderer_can_add_omit_reorder_or_change_content',
    'renderer_can_query_or_read_source',
    'generated_narrative_permitted',
  ], 'Product result presentation renderer contract', code);
  if (
    canonicalJson(presentation.renderer_contract)
      !== canonicalJson({
        passage_and_table_use_same_payload: true,
        renderer_can_add_omit_reorder_or_change_content: false,
        renderer_can_query_or_read_source: false,
        generated_narrative_permitted: false,
      })
  ) {
    fail(code, 'The Product result presentation renderer contract is invalid.');
  }
  return true;
}

function canonicalProductResultPresentationBytes(presentation) {
  validateProductResultPresentation(presentation);
  return Buffer.from(canonicalJson(presentation), 'utf8');
}

module.exports = {
  COVERAGE_CERTIFICATION_STATES,
  MAX_RESULT_SLOTS,
  MAX_VALID_RESULTS,
  PRACTITIONER_OPERATORS,
  PRODUCT_QUERY_EXECUTION_SUMMARY_SCHEMA,
  PRODUCT_RESULT_PRESENTATION_SCHEMA,
  PRODUCT_RESULT_SLOT_FAILURE_SCHEMA,
  ProductResultPresentationCompilerError,
  canonicalProductResultPresentationBytes,
  compileProductResultPresentation,
  validateProductResultPresentation,
};
