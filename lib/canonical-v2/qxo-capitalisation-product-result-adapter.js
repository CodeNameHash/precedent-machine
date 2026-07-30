const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateQxoCapitalisationCrossViewReleaseF27,
} = require('./qxo-capitalisation-cross-view-release-f27');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
  validateHistoricalQxoCapitalisationF27ProductQueryResult,
} = require('./product-citation-share-compiler');
const {
  PRODUCT_QUERY_RESULT_ADMISSION_STATE,
  compileProductQueryResult,
  requestedFieldProjectionIdentity,
} = require('./product-query-result-compiler');
const {
  canonicalProductQueryIrBytes,
} = require('./product-query-ir');
const {
  validateAuthoredProductQueryResultInputs,
} = require('./product-query-result-contract-input-validator');

const adapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-product-result-adapter.v1.json',
);
const f28AdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v1.json',
);
const processAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
);
const processResultSetAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-set-adapter.v1.json',
);
const productResultContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-result-definition.v1.json',
);

const QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA =
  'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT/V1';
const QXO_DOMAIN_KEY = 'AGREEMENT';
const QXO_RESULT_DEFINITION = Object.freeze({
  stable_id: 'TARGET_CAPITALISATION_BRING_DOWN',
  version: 2,
});
const QXO_DOMAIN_VALIDATOR = Object.freeze({
  stable_id: 'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER',
  version: 1,
});
const SELECTED_SOURCE_ACTION = 'RESULT_COMPOSITION_EVIDENCE';
const REQUIRED_SURFACES = Object.freeze([
  'COMPARE',
  'CORPUS_CONTEXT',
  'QUERY',
  'REVIEW',
]);
const REQUIRED_VALUE_SLOTS = Object.freeze([
  'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
  'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
  'CAPITALISATION_MEASUREMENT_DATE',
  'GENERAL_KNOWLEDGE_QUALIFIER',
  'GENERAL_MATERIALITY_QUALIFIER',
  'RETROSPECTIVE_LOOKBACK',
]);
const PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA =
  'PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;

class QxoCapitalisationProductResultAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QxoCapitalisationProductResultAdapterError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new QxoCapitalisationProductResultAdapterError(
    code,
    message,
    details,
  );
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(value, expected, label, code) {
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

function requireDigest(value, label, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a full lower-case SHA-256 digest.`);
  }
  return value;
}

function requireExactValue(actual, expected, label, code) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the signed adapter contract.`);
  }
}

function clone(value, code = 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The QXO Product adapter input is not canonical JSON.', {
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

function validateContractBinding() {
  const code = 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_CONTRACT_BINDING';
  try {
    validateAuthoredProductQueryResultInputs([
      contractMember(adapterContract),
      contractMember(f28AdapterContract),
      contractMember(processAdapterContract),
      contractMember(processResultSetAdapterContract),
      contractMember(productResultContract),
    ]);
  } catch (error) {
    fail(code, 'A signed Product query-result contract has changed.', {
      cause: error.code || error.message,
    });
  }
  const definition = adapterContract.definition;
  requireExactValue(
    definition.identity_mapping,
    {
      source_field: 'qxo_release.provision_row.provision_row_id',
      target_field: 'domain_result.domain_result_identity',
      exact_equality_required: true,
      adapter_can_mint_or_replace_identity: false,
    },
    'QXO result identity mapping',
    code,
  );
  requireExactValue(
    definition.source_contract.required_value_slots,
    REQUIRED_VALUE_SLOTS,
    'QXO result value slots',
    code,
  );
  requireExactValue(
    definition.cross_view_contract.required_surfaces,
    REQUIRED_SURFACES,
    'QXO cross-view surfaces',
    code,
  );
  if (
    definition.payload_mapping.representation_kind !== 'STRUCTURED_RESULT'
    || definition.payload_mapping.all_six_subrows_required !== true
    || definition.payload_mapping.presentation_order_preserved !== true
    || definition.source_contract.class_aggregation_forbidden !== true
    || definition.validation_carrier_contract.adapter_state
      !== 'VALIDATED_NOT_MATERIALISED'
    || definition.validation_carrier_contract.authority_state
      !== 'NOT_GRANTED'
    || Object.values(definition.prohibited_state_contract)
      .some((value) => value !== false)
    || Object.values(definition.authority_contract)
      .some((value) => value !== false)
  ) {
    fail(code, 'The signed QXO Product adapter safety boundary has changed.');
  }
}

function validateQxoRelease(input) {
  const code = 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_SOURCE';
  try {
    validateQxoCapitalisationCrossViewReleaseF27({
      candidate: input.qxo_cross_view_release,
      reviewedGraph: input.reviewed_graph,
      sourceContext: input.source_context,
      parserSourceClosure: input.parser_source_closure,
      contractBundle: input.contract_bundle,
    });
  } catch (error) {
    fail(code, 'The QXO F27 cross-view release is invalid.', {
      cause: error.code || error.message,
    });
  }
  const release = input.qxo_cross_view_release;
  const row = release.provision_row;
  if (
    row.subrows.length !== REQUIRED_VALUE_SLOTS.length
    || canonicalJson(row.subrows.map((subrow) => subrow.value_slot_key))
      !== canonicalJson(REQUIRED_VALUE_SLOTS)
    || canonicalJson(Object.keys(release.surface_bindings).sort())
      !== canonicalJson(REQUIRED_SURFACES)
    || Object.values(release.surface_bindings).some(
      (binding) => binding.provision_row_id !== row.provision_row_id
        || canonicalJson(binding.provision_row) !== canonicalJson(row)
        || binding.release_id !== release.release_id
        || binding.release_manifest_id
          !== release.manifest.release_manifest_id,
    )
  ) {
    fail(code, 'The QXO release does not preserve one six-subrow cross-view row.');
  }
}

function validateExternalProductInputs(input) {
  const code = 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_PRODUCT_INPUT';
  const queryIr = requireObject(
    input.product_query_ir,
    'Product Query IR',
    code,
  );
  const semantic = requireObject(
    queryIr.semantic_contract,
    'Product Query IR semantic contract',
    code,
  );
  const release = requireObject(
    queryIr.release_contract,
    'Product Query IR release contract',
    code,
  );
  const actions = queryIr.detail_action_contract?.actions;
  const fieldReferences = [
    ...(queryIr.filter_contract?.clauses || []),
    ...(queryIr.presentation_contract?.sort || []),
    ...(queryIr.presentation_contract?.requested_columns || []),
  ];
  if (
    semantic.domain_key !== QXO_DOMAIN_KEY
    || canonicalJson(semantic.result_definition)
      !== canonicalJson(QXO_RESULT_DEFINITION)
    || !Array.isArray(actions)
    || !actions.includes(SELECTED_SOURCE_ACTION)
    || release.candidate_release_manifest_id
      !== input.qxo_cross_view_release.manifest.release_manifest_id
    || release.candidate_release_manifest_payload_digest
      !== input.qxo_cross_view_release.manifest.canonical_payload_digest
  ) {
    fail(code, 'The Product Query IR does not admit the exact QXO release.');
  }
  if (fieldReferences.some(
    (reference) => reference.field_key === 'bringDownStandard',
  )) {
    fail(
      code,
      'The article-wide bringDownStandard field cannot aggregate the two QXO comparison classes.',
    );
  }
  if (!Array.isArray(input.result_fields)) {
    fail(code, 'Requested Product result fields must be an array.');
  }
  for (const field of input.result_fields) {
    const fieldKey = field?.field_reference?.field_key;
    if (
      fieldKey === 'deal'
      && (
        !isPlainObject(field.value)
        || canonicalJson(Object.keys(field.value).sort())
          !== canonicalJson(['governed_deal_id'])
        || !SHA256_RE.test(field.value.governed_deal_id || '')
      )
    ) {
      fail(code, 'The QXO deal field must use the shared governed identity shape.');
    }
    if (
      fieldKey === 'signed'
      && (
        !isPlainObject(field.value)
        || canonicalJson(Object.keys(field.value).sort())
          !== canonicalJson(['iso_8601_calendar_date'])
        || !/^\d{4}-\d{2}-\d{2}$/.test(
          field.value.iso_8601_calendar_date || '',
        )
      )
    ) {
      fail(code, 'The QXO signing field must use the shared calendar-date shape.');
    }
  }
  if (
    input.product_admission_receipt?.schema_version
      !== PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA
  ) {
    fail(code, 'The external Product admission receipt is invalid.');
  }
}

function buildDomainResult(release) {
  const payload = clone(release.provision_row);
  const payloadDigest = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: QXO_DOMAIN_VALIDATOR.stable_id,
    validator_version: QXO_DOMAIN_VALIDATOR.version,
    validated_payload_digest: payloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: QXO_DOMAIN_KEY,
    domain_result_definition: clone(QXO_RESULT_DEFINITION),
    domain_result_identity: release.provision_row.provision_row_id,
    domain_result_payload: payload,
    domain_result_payload_digest: payloadDigest,
    domain_result_validation: {
      schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      ...validationBody,
      validation_receipt_id: contentId(
        PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
        validationBody,
      ),
    },
    domain_result_source_representation_kind: 'STRUCTURED_RESULT',
  };
}

function expectedProductResultIdentity(queryIr, domainResult) {
  return contentId(PRODUCT_QUERY_RESULT_SCHEMA, {
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
  });
}

function evidenceIdentity(row) {
  return contentId('QXO_CAPITALISATION_RESULT_COMPOSITION_EVIDENCE/V1', {
    provision_row_id: row.provision_row_id,
    subrow_evidence: row.subrows.map((subrow) => ({
      subrow_id: subrow.subrow_id,
      evidence_reference_ids:
        clone(subrow.source.evidence_reference_ids),
      exact_detail_reference_id:
        subrow.source.exact_detail.exact_detail_reference_id,
    })),
  });
}

function buildExactCitation(release, queryIr, domainResult) {
  const row = release.provision_row;
  const evidence = evidenceIdentity(row);
  const productResultIdentity =
    expectedProductResultIdentity(queryIr, domainResult);
  const citationTargetPayload = {
    product_query_result_identity: productResultIdentity,
    candidate_release_manifest_id:
      queryIr.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      queryIr.release_contract.candidate_release_manifest_payload_digest,
    source_document_identity: row.document_hash,
    source_evidence_identity: evidence,
  };
  return {
    schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
    source_document_identity: row.document_hash,
    source_evidence_identity: evidence,
    source_representation_kind: 'STRUCTURED_RESULT',
    source_interval: null,
    result_component_evidence_identity: evidence,
    source_accession_or_equivalent_identity: row.document_hash,
    source_filing_type: null,
    source_filing_date: null,
    source_location_label: row.label,
    human_readable_source_label: row.label,
    citation_target_identity: contentId(
      PRODUCT_EXACT_CITATION_SCHEMA,
      citationTargetPayload,
    ),
  };
}

function validateCompiledMappings(input, domainResult, productResult) {
  const code = 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_MAPPING';
  const release = input.qxo_cross_view_release;
  const row = release.provision_row;
  const evidence = evidenceIdentity(row);
  if (
    productResult.domain_result_identity !== row.provision_row_id
    || canonicalJson(productResult.domain_result_payload)
      !== canonicalJson(row)
    || productResult.domain_result_payload_digest
      !== domainResult.domain_result_payload_digest
    || productResult.domain_result_validation.validator_stable_id
      !== QXO_DOMAIN_VALIDATOR.stable_id
    || productResult.domain_result_validation.validator_version
      !== QXO_DOMAIN_VALIDATOR.version
    || productResult.exact_citation.source_document_identity
      !== row.document_hash
    || productResult.exact_citation.source_evidence_identity !== evidence
    || productResult.exact_citation.result_component_evidence_identity
      !== evidence
    || productResult.exact_detail_action !== SELECTED_SOURCE_ACTION
    || Object.hasOwn(productResult, 'market_context')
    || Object.hasOwn(productResult, 'surface_binding')
    || Object.hasOwn(productResult, 'qxo_cross_view_release')
  ) {
    fail(code, 'The Product result does not preserve the exact QXO mapping.');
  }
}

function receiptIdentityBody(qxoRelease, productResult) {
  return {
    qxo_cross_view_release: clone(qxoRelease),
    product_query_result: clone(productResult),
  };
}

function buildQxoCapitalisationProductResultAdapter(input) {
  const code = 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_INPUT';
  validateContractBinding();
  requireExactKeys(input, [
    'qxo_cross_view_release',
    'reviewed_graph',
    'source_context',
    'parser_source_closure',
    'contract_bundle',
    'product_query_ir',
    'result_fields',
    'product_admission_receipt',
  ], 'QXO capitalisation Product adapter input', code);
  validateQxoRelease(input);
  validateExternalProductInputs(input);
  const domainResult = buildDomainResult(input.qxo_cross_view_release);
  const exactCitation = buildExactCitation(
    input.qxo_cross_view_release,
    input.product_query_ir,
    domainResult,
  );
  let productResult;
  try {
    productResult = compileProductQueryResult({
      product_query_ir: input.product_query_ir,
      domain_result: domainResult,
      result_fields: input.result_fields,
      exact_citation: exactCitation,
      exact_detail_action: SELECTED_SOURCE_ACTION,
      admission_receipt: input.product_admission_receipt,
    });
  } catch (error) {
    fail(
      'INVALID_QXO_PRODUCT_RESULT_ADAPTER_PRODUCT_INPUT',
      'The external Product inputs do not admit the QXO result.',
      {
        cause: error.code
          ? `${error.code}: ${error.message}`
          : error.message,
      },
    );
  }
  validateCompiledMappings(input, domainResult, productResult);
  const body = receiptIdentityBody(
    input.qxo_cross_view_release,
    productResult,
  );
  return {
    schema_version:
      QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
    adapter_receipt_id: contentId(
      QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
      body,
    ),
    qxo_cross_view_release: body.qxo_cross_view_release,
    product_query_result: body.product_query_result,
    adapter_state: 'VALIDATED_NOT_MATERIALISED',
    authority_state: 'NOT_GRANTED',
  };
}

function validateQxoCapitalisationProductResultAdapterReceipt(value, input) {
  const code = 'INVALID_QXO_PRODUCT_RESULT_ADAPTER_RECEIPT';
  requireExactKeys(value, [
    'schema_version',
    'adapter_receipt_id',
    'qxo_cross_view_release',
    'product_query_result',
    'adapter_state',
    'authority_state',
  ], 'QXO capitalisation Product adapter receipt', code);
  requireDigest(value.adapter_receipt_id, 'QXO adapter receipt ID', code);
  if (
    value.schema_version
      !== QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA
    || value.adapter_state !== 'VALIDATED_NOT_MATERIALISED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The QXO Product adapter receipt state is invalid.');
  }
  try {
    validateHistoricalQxoCapitalisationF27ProductQueryResult(
      value.product_query_result,
    );
  } catch (error) {
    fail(code, 'The QXO adapter Product result is invalid.', {
      cause: error.code || error.message,
    });
  }
  validateQxoRelease(input);
  validateExternalProductInputs(input);
  const domainResult = buildDomainResult(input.qxo_cross_view_release);
  validateCompiledMappings(input, domainResult, value.product_query_result);
  try {
    canonicalProductQueryIrBytes(input.product_query_ir);
  } catch (error) {
    fail(code, 'The historical Product Query IR is invalid.', {
      cause: error.code || error.message,
    });
  }
  const admission = input.product_admission_receipt;
  requireExactKeys(admission, [
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
  ], 'Historical Product admission receipt', code);
  const {
    admission_receipt_id: admissionReceiptId,
    ...admissionBody
  } = clone(admission, code);
  const expectedProjectionIdentity = requestedFieldProjectionIdentity({
    queryIr: input.product_query_ir,
    domainResult,
    resultFields: input.result_fields,
  });
  if (
    canonicalJson(value.qxo_cross_view_release)
      !== canonicalJson(input.qxo_cross_view_release)
    || value.product_query_result.product_query_definition_id
      !== input.product_query_ir.query_definition_id
    || value.product_query_result.approved_pm_data_version_id
      !== input.product_query_ir.release_contract.approved_pm_data_version_id
    || value.product_query_result.candidate_release_manifest_id
      !== input.product_query_ir.release_contract
        .candidate_release_manifest_id
    || value.product_query_result.candidate_release_manifest_payload_digest
      !== input.product_query_ir.release_contract
        .candidate_release_manifest_payload_digest
    || canonicalJson(value.product_query_result.result_fields)
      !== canonicalJson(input.result_fields)
    || canonicalJson(value.product_query_result.query_provenance.filter_contract)
      !== canonicalJson(input.product_query_ir.filter_contract)
    || canonicalJson(value.product_query_result.query_provenance.coverage_contract)
      !== canonicalJson(input.product_query_ir.coverage_contract)
    || canonicalJson(
      value.product_query_result.query_provenance.requested_field_references,
    ) !== canonicalJson(
      input.product_query_ir.presentation_contract.requested_columns,
    )
    || admission.admission_receipt_id !== admissionReceiptId
    || admissionReceiptId !== contentId(
      PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA,
      admissionBody,
    )
    || admission.product_query_definition_id
      !== input.product_query_ir.query_definition_id
    || admission.approved_pm_data_version_id
      !== input.product_query_ir.release_contract.approved_pm_data_version_id
    || admission.candidate_release_manifest_id
      !== input.product_query_ir.release_contract.candidate_release_manifest_id
    || admission.candidate_release_manifest_payload_digest
      !== input.product_query_ir.release_contract
        .candidate_release_manifest_payload_digest
    || admission.domain_key !== domainResult.domain_key
    || canonicalJson(admission.domain_result_definition)
      !== canonicalJson(domainResult.domain_result_definition)
    || admission.domain_result_identity !== domainResult.domain_result_identity
    || admission.domain_result_payload_digest
      !== domainResult.domain_result_payload_digest
    || admission.domain_validation_receipt_id
      !== domainResult.domain_result_validation.validation_receipt_id
    || admission.query_coverage_identity
      !== input.product_query_ir.coverage_contract.coverage_identity
    || admission.covered_set_identity
      !== input.product_query_ir.coverage_contract.covered_set_identity
    || admission.query_cohort_identity
      !== input.product_query_ir.cohort_contract.cohort_definition_id
    || admission.requested_field_projection_identity
      !== expectedProjectionIdentity
    || [
      admission.predicate_evaluation_state,
      admission.cohort_evaluation_state,
      admission.filter_evaluation_state,
      admission.covered_set_membership_state,
    ].some((state) => state !== 'PASS')
    || admission.admission_state !== PRODUCT_QUERY_RESULT_ADMISSION_STATE
    || admission.authority_state !== 'NOT_GRANTED'
    || value.adapter_receipt_id !== contentId(
      QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
      receiptIdentityBody(
        value.qxo_cross_view_release,
        value.product_query_result,
      ),
    )
  ) {
    fail(code, 'The QXO Product adapter receipt has changed.');
  }
  return true;
}

function compileQxoCapitalisationProductResultAdapter(input) {
  void input;
  fail(
    'QXO_CAPITALISATION_F27_RETIRED_NOT_RELEASE_ADMITTED',
    'The QXO F27 Product adapter is retired. Use the F28 adapter.',
  );
}

function canonicalQxoCapitalisationProductResultAdapterReceiptBytes(
  value,
  input,
) {
  validateQxoCapitalisationProductResultAdapterReceipt(value, input);
  return Buffer.from(canonicalJson(value), 'utf8');
}

module.exports = {
  QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
  QXO_DOMAIN_KEY,
  QXO_DOMAIN_VALIDATOR,
  QXO_RESULT_DEFINITION,
  REQUIRED_SURFACES,
  REQUIRED_VALUE_SLOTS,
  SELECTED_SOURCE_ACTION,
  QxoCapitalisationProductResultAdapterError,
  canonicalQxoCapitalisationProductResultAdapterReceiptBytes,
  compileQxoCapitalisationProductResultAdapter,
  validateQxoCapitalisationProductResultAdapterReceipt,
};
