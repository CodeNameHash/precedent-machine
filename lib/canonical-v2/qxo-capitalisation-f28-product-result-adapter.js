const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateQxoCapitalisationCrossViewReleaseF28,
} = require('./qxo-capitalisation-cross-view-release-f28');
const {
  validateQxoCapitalisationF28CandidateEnvelope,
} = require('./qxo-capitalisation-f28-candidate-envelope');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  PRODUCT_EXACT_CITATION_SCHEMA,
  PRODUCT_QUERY_RESULT_SCHEMA,
  validateProductQueryResult,
} = require('./product-citation-share-compiler');
const {
  compileProductQueryResult,
} = require('./product-query-result-compiler');
const {
  validateAuthoredProductQueryResultInputs,
} = require('./product-query-result-contract-input-validator');

const adapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v1.json',
);
const adapterV2Contract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v2.json',
);
const historicalQxoAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/qxo-capitalisation-product-result-adapter.v1.json',
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

const QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA =
  'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT/V1';
const QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_RECEIPT_SCHEMA =
  'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT/V2';
const QXO_F28_DOMAIN_KEY = 'AGREEMENT';
const QXO_F28_RESULT_DEFINITION = Object.freeze({
  stable_id: 'TARGET_CAPITALISATION_BRING_DOWN',
  version: 3,
});
const QXO_F28_DOMAIN_VALIDATOR = Object.freeze({
  stable_id: 'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER',
  version: 1,
});
const QXO_F28_DOMAIN_VALIDATOR_V2 = Object.freeze({
  stable_id: 'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2',
  version: 2,
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

class QxoCapitalisationF28ProductResultAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QxoCapitalisationF28ProductResultAdapterError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new QxoCapitalisationF28ProductResultAdapterError(
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

function requireExactKeys(value, expected, label, code) {
  if (!isPlainObject(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function clone(value, code = 'INVALID_QXO_F28_PRODUCT_ADAPTER_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The QXO F28 Product adapter input is not canonical JSON.', {
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
  const code = 'INVALID_QXO_F28_PRODUCT_ADAPTER_CONTRACT_BINDING';
  try {
    validateAuthoredProductQueryResultInputs([
      contractMember(adapterContract),
      contractMember(adapterV2Contract),
      contractMember(historicalQxoAdapterContract),
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
  if (
    definition.source_contract.source_result_definition_version !== 3
    || definition.source_contract.required_market_metric_slot_count !== 14
    || definition.source_contract.class_aggregation_forbidden !== true
    || definition.source_contract.generic_no_market_data_permitted !== false
    || definition.payload_mapping.all_six_subrows_required !== true
    || definition.payload_mapping.all_fourteen_metric_contexts_preserved
      !== true
    || definition.cross_view_contract.generic_no_market_data_authority
      !== 'FORBIDDEN'
    || canonicalJson(definition.source_contract.required_value_slots)
      !== canonicalJson(REQUIRED_VALUE_SLOTS)
    || canonicalJson(definition.cross_view_contract.required_surfaces)
      !== canonicalJson(REQUIRED_SURFACES)
    || Object.values(definition.prohibited_state_contract)
      .some((value) => value !== false)
    || Object.values(definition.authority_contract)
      .some((value) => value !== false)
  ) {
    fail(code, 'The QXO F28 Product adapter boundary has changed.');
  }
}

function validateQxoRelease(input) {
  const code = 'INVALID_QXO_F28_PRODUCT_ADAPTER_SOURCE';
  try {
    validateQxoCapitalisationCrossViewReleaseF28({
      candidate: input.qxo_cross_view_release,
      reviewedGraph: input.reviewed_graph,
      sourceContext: input.source_context,
      parserSourceClosure: input.parser_source_closure,
      contractBundle: input.contract_bundle,
    });
  } catch (error) {
    fail(code, 'The QXO F28 cross-view release is invalid.', {
      cause: error.code || error.message,
    });
  }
  const release = input.qxo_cross_view_release;
  const row = release.provision_row;
  const metricContexts = row.subrows.flatMap(
    (subrow) => subrow.market_context.metric_results,
  );
  if (
    row.schema_version !== 'CAPITALISATION_SHARED_PROVISION_ROW_F28/V1'
    || row.generic_no_market_data_authority !== 'FORBIDDEN'
    || row.market_metric_slot_count !== 14
    || row.subrows.length !== REQUIRED_VALUE_SLOTS.length
    || metricContexts.length !== 14
    || release.admissions.length !== 14
    || release.observations.length !== 13
    || release.exclusions.length !== 1
    || canonicalJson(row.subrows.map(
      (subrow) => subrow.value_slot_key,
    )) !== canonicalJson(REQUIRED_VALUE_SLOTS)
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
    fail(code, 'The QXO F28 release does not preserve one governed row.');
  }
}

function validateExternalProductInputs(
  input,
  {
    candidateReleaseManifestId =
      input.qxo_cross_view_release.manifest.release_manifest_id,
    candidateReleaseManifestPayloadDigest =
      input.qxo_cross_view_release.manifest.canonical_payload_digest,
  } = {},
) {
  const code = 'INVALID_QXO_F28_PRODUCT_ADAPTER_PRODUCT_INPUT';
  const queryIr = input.product_query_ir;
  const semantic = queryIr?.semantic_contract;
  const release = queryIr?.release_contract;
  const actions = queryIr?.detail_action_contract?.actions;
  const fieldReferences = [
    ...(queryIr?.filter_contract?.clauses || []),
    ...(queryIr?.presentation_contract?.sort || []),
    ...(queryIr?.presentation_contract?.requested_columns || []),
  ];
  if (
    !isPlainObject(queryIr)
    || semantic?.domain_key !== QXO_F28_DOMAIN_KEY
    || canonicalJson(semantic.result_definition)
      !== canonicalJson(QXO_F28_RESULT_DEFINITION)
    || !Array.isArray(actions)
    || !actions.includes(SELECTED_SOURCE_ACTION)
    || release?.candidate_release_manifest_id
      !== candidateReleaseManifestId
    || release?.candidate_release_manifest_payload_digest
      !== candidateReleaseManifestPayloadDigest
  ) {
    fail(code, 'The Product Query IR does not admit the exact QXO F28 release.');
  }
  if (fieldReferences.some(
    (reference) => reference.field_key === 'bringDownStandard',
  )) {
    fail(
      code,
      'The article-wide bringDownStandard field cannot aggregate QXO metric slots.',
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
      fail(code, 'The QXO deal field must use the governed identity shape.');
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
      fail(code, 'The QXO signing field must use a calendar date.');
    }
  }
  if (
    input.product_admission_receipt?.schema_version
      !== PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA
  ) {
    fail(code, 'The external Product admission receipt is invalid.');
  }
}

function buildDomainResult(
  release,
  domainValidator = QXO_F28_DOMAIN_VALIDATOR,
) {
  const payload = clone(release.provision_row);
  const payloadDigest = sha256Hex(Buffer.from(
    canonicalJson(payload),
    'utf8',
  ));
  const validationBody = {
    validator_stable_id: domainValidator.stable_id,
    validator_version: domainValidator.version,
    validated_payload_digest: payloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: QXO_F28_DOMAIN_KEY,
    domain_result_definition: clone(QXO_F28_RESULT_DEFINITION),
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
  return contentId('QXO_CAPITALISATION_F28_RESULT_EVIDENCE/V1', {
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
  const citationTargetPayload = {
    product_query_result_identity:
      expectedProductResultIdentity(queryIr, domainResult),
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

function compileExactProductResult(input, domainResult, domainValidator) {
  let productResult;
  try {
    productResult = compileProductQueryResult({
      product_query_ir: input.product_query_ir,
      domain_result: domainResult,
      result_fields: input.result_fields,
      exact_citation: buildExactCitation(
        input.qxo_cross_view_release,
        input.product_query_ir,
        domainResult,
      ),
      exact_detail_action: SELECTED_SOURCE_ACTION,
      admission_receipt: input.product_admission_receipt,
    });
  } catch (error) {
    fail(
      'INVALID_QXO_F28_PRODUCT_ADAPTER_PRODUCT_INPUT',
      'The external Product inputs do not admit the QXO F28 result.',
      { cause: error.code ? `${error.code}: ${error.message}` : error.message },
    );
  }
  if (
    productResult.domain_result_identity
      !== input.qxo_cross_view_release.provision_row.provision_row_id
    || canonicalJson(productResult.domain_result_payload)
      !== canonicalJson(input.qxo_cross_view_release.provision_row)
    || productResult.domain_result_validation.validator_stable_id
      !== domainValidator.stable_id
    || productResult.domain_result_validation.validator_version
      !== domainValidator.version
    || productResult.exact_detail_action !== SELECTED_SOURCE_ACTION
  ) {
    fail(
      'INVALID_QXO_F28_PRODUCT_ADAPTER_MAPPING',
      'The Product result does not preserve the exact QXO F28 row.',
    );
  }
  return productResult;
}

function buildQxoCapitalisationF28ProductResultAdapter(input) {
  const code = 'INVALID_QXO_F28_PRODUCT_ADAPTER_INPUT';
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
  ], 'QXO F28 Product adapter input', code);
  validateQxoRelease(input);
  validateExternalProductInputs(input);
  const domainResult = buildDomainResult(input.qxo_cross_view_release);
  const productResult = compileExactProductResult(
    input,
    domainResult,
    QXO_F28_DOMAIN_VALIDATOR,
  );
  const identityBody = {
    qxo_cross_view_release: clone(input.qxo_cross_view_release),
    product_query_result: clone(productResult),
  };
  return {
    schema_version:
      QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
    adapter_receipt_id: contentId(
      QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
      identityBody,
    ),
    ...identityBody,
    adapter_state: 'VALIDATED_NOT_MATERIALISED',
    authority_state: 'NOT_GRANTED',
  };
}

function candidateEnvelopeInput(input) {
  return {
    qxo_cross_view_release: input.qxo_cross_view_release,
    reviewed_graph: input.reviewed_graph,
    source_context: input.source_context,
    parser_source_closure: input.parser_source_closure,
    contract_bundle: input.contract_bundle,
  };
}

function buildQxoCapitalisationF28ProductResultAdapterV2(input) {
  const code = 'INVALID_QXO_F28_PRODUCT_ADAPTER_V2_INPUT';
  validateContractBinding();
  requireExactKeys(input, [
    'candidate_envelope',
    'qxo_cross_view_release',
    'reviewed_graph',
    'source_context',
    'parser_source_closure',
    'contract_bundle',
    'product_query_ir',
    'result_fields',
    'product_admission_receipt',
  ], 'QXO F28 Product adapter V2 input', code);
  validateQxoRelease(input);
  try {
    validateQxoCapitalisationF28CandidateEnvelope(
      input.candidate_envelope,
      candidateEnvelopeInput(input),
    );
  } catch (error) {
    fail(
      'INVALID_QXO_F28_PRODUCT_ADAPTER_V2_ENVELOPE',
      'The QXO F28 candidate envelope is invalid.',
      { cause: error.message },
    );
  }
  validateExternalProductInputs(input);
  const domainResult = buildDomainResult(
    input.qxo_cross_view_release,
    QXO_F28_DOMAIN_VALIDATOR_V2,
  );
  const productResult = compileExactProductResult(
    input,
    domainResult,
    QXO_F28_DOMAIN_VALIDATOR_V2,
  );
  if (
    productResult.domain_result_identity
      !== input.candidate_envelope.provision_row.provision_row_id
    || canonicalJson(productResult.domain_result_payload)
      !== canonicalJson(input.candidate_envelope.provision_row)
  ) {
    fail(
      'INVALID_QXO_F28_PRODUCT_ADAPTER_V2_MAPPING',
      'Product adapter V2 must preserve the exact candidate-envelope row.',
    );
  }
  const identityBody = {
    candidate_envelope: clone(input.candidate_envelope),
    product_query_result: clone(productResult),
  };
  return {
    schema_version:
      QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_RECEIPT_SCHEMA,
    adapter_receipt_id: contentId(
      QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_RECEIPT_SCHEMA,
      identityBody,
    ),
    ...identityBody,
    adapter_state: 'VALIDATED_NOT_MATERIALISED',
    authority_state: 'NOT_GRANTED',
  };
}

function validateQxoCapitalisationF28ProductResultAdapterV2Receipt(
  value,
  input,
) {
  const code = 'INVALID_QXO_F28_PRODUCT_ADAPTER_V2_RECEIPT';
  requireExactKeys(value, [
    'schema_version',
    'adapter_receipt_id',
    'candidate_envelope',
    'product_query_result',
    'adapter_state',
    'authority_state',
  ], 'QXO F28 Product adapter V2 receipt', code);
  if (
    value.schema_version
      !== QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_RECEIPT_SCHEMA
    || !SHA256_RE.test(value.adapter_receipt_id || '')
    || value.adapter_state !== 'VALIDATED_NOT_MATERIALISED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The QXO F28 Product adapter V2 receipt state is invalid.');
  }
  try {
    validateProductQueryResult(value.product_query_result);
  } catch (error) {
    fail(code, 'The QXO F28 Product adapter V2 result is invalid.', {
      cause: error.code || error.message,
    });
  }
  const expected = buildQxoCapitalisationF28ProductResultAdapterV2(input);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, 'The QXO F28 Product adapter V2 receipt has changed.');
  }
  return true;
}

function compileQxoCapitalisationF28ProductResultAdapterV2(input) {
  const receipt = buildQxoCapitalisationF28ProductResultAdapterV2(input);
  validateQxoCapitalisationF28ProductResultAdapterV2Receipt(receipt, input);
  return deepFreeze(clone(receipt));
}

function validateQxoCapitalisationF28ProductResultAdapterReceipt(
  value,
  input,
) {
  const code = 'INVALID_QXO_F28_PRODUCT_ADAPTER_RECEIPT';
  requireExactKeys(value, [
    'schema_version',
    'adapter_receipt_id',
    'qxo_cross_view_release',
    'product_query_result',
    'adapter_state',
    'authority_state',
  ], 'QXO F28 Product adapter receipt', code);
  if (
    value.schema_version
      !== QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA
    || !SHA256_RE.test(value.adapter_receipt_id || '')
    || value.adapter_state !== 'VALIDATED_NOT_MATERIALISED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The QXO F28 Product adapter receipt state is invalid.');
  }
  try {
    validateProductQueryResult(value.product_query_result);
  } catch (error) {
    fail(code, 'The QXO F28 Product result is invalid.', {
      cause: error.code || error.message,
    });
  }
  const expected = buildQxoCapitalisationF28ProductResultAdapter(input);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, 'The QXO F28 Product adapter receipt has changed.');
  }
  return true;
}

function compileQxoCapitalisationF28ProductResultAdapter(input) {
  const receipt = buildQxoCapitalisationF28ProductResultAdapter(input);
  validateQxoCapitalisationF28ProductResultAdapterReceipt(receipt, input);
  return deepFreeze(clone(receipt));
}

function canonicalQxoCapitalisationF28ProductResultAdapterReceiptBytes(
  value,
  input,
) {
  validateQxoCapitalisationF28ProductResultAdapterReceipt(value, input);
  return Buffer.from(canonicalJson(value), 'utf8');
}

module.exports = {
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_RECEIPT_SCHEMA,
  QXO_F28_DOMAIN_KEY,
  QXO_F28_DOMAIN_VALIDATOR,
  QXO_F28_DOMAIN_VALIDATOR_V2,
  QXO_F28_RESULT_DEFINITION,
  REQUIRED_SURFACES,
  REQUIRED_VALUE_SLOTS,
  SELECTED_SOURCE_ACTION,
  QxoCapitalisationF28ProductResultAdapterError,
  canonicalQxoCapitalisationF28ProductResultAdapterReceiptBytes,
  compileQxoCapitalisationF28ProductResultAdapter,
  compileQxoCapitalisationF28ProductResultAdapterV2,
  validateQxoCapitalisationF28ProductResultAdapterReceipt,
  validateQxoCapitalisationF28ProductResultAdapterV2Receipt,
};
