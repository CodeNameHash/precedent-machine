const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateProcessPhrasebookResultAdmissionReceipt,
} = require('./process-phrasebook-result-admission');
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
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
);
const productResultContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-result-definition.v1.json',
);

const PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA =
  'PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT/V1';
const PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA =
  'PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT/V1';
const PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA =
  'PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT/V1';
const PROCESS_DOMAIN_KEY = 'PROCESS';
const PROCESS_RESULT_DEFINITION = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  version: 1,
});
const PRODUCT_DOMAIN_VALIDATOR = Object.freeze({
  stable_id: 'PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER',
  version: 1,
});
const SELECTED_SOURCE_ACTION = 'PROCESS_NARRATION_EVIDENCE';
const CONTEXT_ACTION = 'PARENT_BOUND_PARAGRAPH_CONTEXT';
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProcessPhrasebookSharedRowBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPhrasebookSharedRowBridgeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPhrasebookSharedRowBridgeError(
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

function requireObject(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_INPUT',
) {
  if (!isPlainObject(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_INPUT',
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

function requireDigest(
  value,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_INPUT',
) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a full lower-case SHA-256 digest.`);
  }
  return value;
}

function requireExactValue(
  actual,
  expected,
  label,
  code = 'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_CONTRACT_BINDING',
) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the signed adapter contract.`);
  }
}

function clone(
  value,
  code = 'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Process-to-Product bridge input is not canonical JSON.', {
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
  const code =
    'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_CONTRACT_BINDING';
  try {
    validateAuthoredProductQueryResultInputs([
      contractMember(adapterContract),
      contractMember(productResultContract),
    ]);
  } catch (error) {
    fail(code, 'A signed Process-to-Product contract has changed.', {
      cause: error.code || error.message,
    });
  }
  const definition = adapterContract.definition;
  requireExactValue(
    definition.target_contract,
    {
      product_result_definition_stable_id:
        'PRODUCT_QUERY_RESULT_DEFINITION',
      product_result_schema_version: PRODUCT_QUERY_RESULT_SCHEMA,
      process_result_definition_stable_id:
        PROCESS_RESULT_DEFINITION.stable_id,
      process_result_definition_version:
        PROCESS_RESULT_DEFINITION.version,
      selected_domain_key: PROCESS_DOMAIN_KEY,
      creates_new_result_architecture: false,
    },
    'Process adapter target',
    code,
  );
  requireExactValue(
    definition.identity_mapping,
    {
      source_field:
        'process_admission_input.result_identity.process_phrasebook_passage_result_id',
      target_field: 'domain_result.domain_result_identity',
      exact_equality_required: true,
      adapter_can_mint_or_replace_identity: false,
    },
    'Process adapter identity mapping',
    code,
  );
  requireExactValue(
    definition.validation_carrier_contract.required_fields,
    [
      'schema_version',
      'adapter_receipt_id',
      'process_admission_receipt',
      'product_query_result',
      'adapter_state',
      'authority_state',
    ],
    'Process adapter receipt fields',
    code,
  );
  requireExactValue(
    definition.validation_carrier_contract.identity_inputs,
    [
      'process_admission_receipt',
      'product_query_result',
    ],
    'Process adapter receipt identity inputs',
    code,
  );
  requireExactValue(
    definition.action_mapping,
    {
      selected_source_action: {
        stable_id: SELECTED_SOURCE_ACTION,
        version: 1,
      },
      context_action: {
        stable_id: CONTEXT_ACTION,
        version: 1,
      },
      selected_source_and_context_actions_are_distinct: true,
      selected_source_action_is_product_result_exact_detail_action: true,
      context_action_requires_separate_product_source_reader_admission: true,
      adapter_can_collapse_or_relabel_actions: false,
    },
    'Process adapter action mapping',
    code,
  );
  if (
    definition.payload_mapping.representation_kind !== 'VERBATIM_TEXT'
    || definition.payload_mapping.exact_verbatim_bytes_required !== true
    || definition.payload_mapping.product_payload_digest_derivation
      !== 'SHA256_CANONICAL_JSON_STRING_UTF8'
    || definition.payload_mapping
      .raw_utf8_digest_remains_bound_in_process_receipt !== true
    || definition.payload_mapping
      .product_payload_digest_can_replace_raw_utf8_digest !== false
    || definition.validation_carrier_contract.adapter_state
      !== 'VALIDATED_NOT_MATERIALISED'
    || definition.validation_carrier_contract.authority_state
      !== 'NOT_GRANTED'
    || Object.values(definition.prohibited_state_contract)
      .some((value) => value !== false)
    || Object.values(definition.authority_contract)
      .some((value) => value !== false)
  ) {
    fail(code, 'The signed Process adapter safety boundary has changed.');
  }
}

function validateProcessInputAndReceipt(
  processAdmissionInput,
  processAdmissionReceipt,
) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PROCESS_BINDING';
  try {
    validateProcessPhrasebookResultAdmissionReceipt(
      processAdmissionReceipt,
      processAdmissionInput,
    );
  } catch (error) {
    fail(code, 'The Process result admission binding is invalid.', {
      cause: error.code || error.message,
    });
  }
  if (
    processAdmissionReceipt.schema_version
      !== PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT_SCHEMA
    || processAdmissionReceipt.admission_state
      !== 'VALIDATED_NOT_MATERIALISED'
    || processAdmissionReceipt.serving_state !== 'NOT_SERVED'
    || processAdmissionReceipt.process_phrasebook_passage_result_id
      !== processAdmissionInput.result_identity
        .process_phrasebook_passage_result_id
    || processAdmissionReceipt.matched_passage_preview_id
      !== processAdmissionInput.matched_passage_preview.preview_id
    || processAdmissionReceipt.exact_detail_reference_id
      !== processAdmissionInput.exact_detail_reference
        .exact_detail_reference_id
    || processAdmissionReceipt.ordering_projection_id
      !== processAdmissionInput.passage_order_projection
        .ordering_projection_id
  ) {
    fail(code, 'The Process admission receipt is not bridge-admissible.');
  }
}

function validateExternalProductInputs(input) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PRODUCT_INPUT';
  requireObject(input.product_query_ir, 'Product Query IR', code);
  requireObject(
    input.product_query_ir.semantic_contract,
    'Product Query IR semantic contract',
    code,
  );
  requireObject(
    input.product_query_ir.release_contract,
    'Product Query IR release contract',
    code,
  );
  requireObject(
    input.product_query_ir.detail_action_contract,
    'Product Query IR detail-action contract',
    code,
  );
  if (
    input.product_query_ir.semantic_contract.domain_key
      !== PROCESS_DOMAIN_KEY
    || canonicalJson(
      input.product_query_ir.semantic_contract.result_definition,
    ) !== canonicalJson(PROCESS_RESULT_DEFINITION)
  ) {
    fail(code, 'The Product Query IR does not select the Process phrasebook.');
  }
  const actions = input.product_query_ir.detail_action_contract.actions;
  if (
    !Array.isArray(actions)
    || !actions.includes(SELECTED_SOURCE_ACTION)
    || !actions.includes(CONTEXT_ACTION)
    || SELECTED_SOURCE_ACTION === CONTEXT_ACTION
  ) {
    fail(
      code,
      'The Product Query IR must keep source and context actions distinct.',
    );
  }
  if (!Array.isArray(input.result_fields)) {
    fail(code, 'Requested Product result fields must be an array.');
  }
  requireObject(
    input.product_admission_receipt,
    'External Product admission receipt',
    code,
  );
  if (
    input.product_admission_receipt.schema_version
      !== PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT_SCHEMA
  ) {
    fail(code, 'The external Product admission receipt schema is invalid.');
  }
}

function buildDomainResult(processAdmissionInput) {
  const preview = processAdmissionInput.matched_passage_preview;
  const productPayloadDigest = sha256Hex(Buffer.from(
    canonicalJson(preview.verbatim_text),
    'utf8',
  ));
  const rawUtf8Digest = sha256Hex(
    Buffer.from(preview.verbatim_text, 'utf8'),
  );
  if (
    rawUtf8Digest !== preview.verbatim_text_digest
    || rawUtf8Digest !== preview.exact_source_interval.exact_text_digest
  ) {
    fail(
      'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PROCESS_BINDING',
      'The Process preview raw UTF-8 digest is invalid.',
    );
  }
  const validationBody = {
    validator_stable_id: PRODUCT_DOMAIN_VALIDATOR.stable_id,
    validator_version: PRODUCT_DOMAIN_VALIDATOR.version,
    validated_payload_digest: productPayloadDigest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  return {
    domain_key: PROCESS_DOMAIN_KEY,
    domain_result_definition: clone(PROCESS_RESULT_DEFINITION),
    domain_result_identity:
      processAdmissionInput.result_identity
        .process_phrasebook_passage_result_id,
    domain_result_payload: preview.verbatim_text,
    domain_result_payload_digest: productPayloadDigest,
    domain_result_validation: {
      schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      ...validationBody,
      validation_receipt_id: contentId(
        PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
        validationBody,
      ),
    },
    domain_result_source_representation_kind: 'VERBATIM_TEXT',
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

function buildExactCitation(
  processAdmissionInput,
  queryIr,
  domainResult,
) {
  const preview = processAdmissionInput.matched_passage_preview;
  const detail = processAdmissionInput.exact_detail_reference;
  const productResultIdentity =
    expectedProductResultIdentity(queryIr, domainResult);
  const sourceInterval = {
    start_utf8_byte:
      preview.exact_source_interval.start_utf8_byte,
    end_utf8_byte:
      preview.exact_source_interval.end_utf8_byte,
    exact_text_digest: preview.verbatim_text_digest,
  };
  const citationTargetPayload = {
    product_query_result_identity: productResultIdentity,
    candidate_release_manifest_id:
      queryIr.release_contract.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      queryIr.release_contract.candidate_release_manifest_payload_digest,
    source_document_identity: preview.source_document_identity,
    source_evidence_identity: preview.preview_id,
  };
  return {
    schema_version: PRODUCT_EXACT_CITATION_SCHEMA,
    source_document_identity: preview.source_document_identity,
    source_evidence_identity: preview.preview_id,
    source_representation_kind: 'VERBATIM_TEXT',
    source_interval: sourceInterval,
    result_component_evidence_identity: null,
    source_accession_or_equivalent_identity:
      preview.source_revision_id,
    source_filing_type: null,
    source_filing_date: null,
    source_location_label: detail.human_readable_source_label,
    human_readable_source_label:
      detail.human_readable_source_label,
    citation_target_identity: contentId(
      PRODUCT_EXACT_CITATION_SCHEMA,
      citationTargetPayload,
    ),
  };
}

function validateReleaseBinding(input) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_RELEASE_BINDING';
  const processReceipt = input.process_admission_receipt;
  const productRelease = input.product_query_ir.release_contract;
  if (
    processReceipt.candidate_release_manifest_id
      !== productRelease.candidate_release_manifest_id
    || processReceipt.candidate_release_manifest_payload_digest
      !== productRelease.candidate_release_manifest_payload_digest
  ) {
    fail(code, 'Process and Product do not bind the same candidate release.');
  }
}

function validateCompiledMappings(input, domainResult, productResult) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PRODUCT_MAPPING';
  const preview = input.process_admission_input.matched_passage_preview;
  const detail = input.process_admission_input.exact_detail_reference;
  if (
    productResult.domain_result_identity
      !== input.process_admission_input.result_identity
        .process_phrasebook_passage_result_id
    || productResult.domain_result_payload !== preview.verbatim_text
    || productResult.domain_result_payload_digest
      !== domainResult.domain_result_payload_digest
    || productResult.domain_result_validation.validator_stable_id
      !== PRODUCT_DOMAIN_VALIDATOR.stable_id
    || productResult.domain_result_validation.validator_version
      !== PRODUCT_DOMAIN_VALIDATOR.version
    || productResult.exact_citation.source_document_identity
      !== preview.source_document_identity
    || productResult.exact_citation.source_evidence_identity
      !== preview.preview_id
    || productResult.exact_citation.source_interval.exact_text_digest
      !== preview.verbatim_text_digest
    || productResult.exact_citation.source_accession_or_equivalent_identity
      !== preview.source_revision_id
    || productResult.exact_citation.human_readable_source_label
      !== detail.human_readable_source_label
    || productResult.exact_detail_action !== SELECTED_SOURCE_ACTION
    || Object.hasOwn(productResult, 'ordering_ordinal')
    || Object.hasOwn(productResult, 'rank')
    || Object.hasOwn(productResult, 'context_action')
    || Object.hasOwn(productResult, 'process_admission_receipt')
  ) {
    fail(code, 'The Product row does not preserve the exact Process mapping.');
  }
}

function adapterReceiptIdentityBody(
  processAdmissionReceipt,
  productQueryResult,
) {
  return {
    process_admission_receipt: clone(processAdmissionReceipt),
    product_query_result: clone(productQueryResult),
  };
}

function buildProcessPhrasebookSharedRowBridge(input) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_INPUT';
  validateContractBinding();
  requireExactKeys(input, [
    'process_admission_input',
    'process_admission_receipt',
    'product_query_ir',
    'result_fields',
    'product_admission_receipt',
  ], 'Process phrasebook shared-row bridge input', code);
  requireObject(
    input.process_admission_input,
    'Process admission input',
    code,
  );
  requireObject(
    input.process_admission_receipt,
    'Process admission receipt',
    code,
  );
  validateProcessInputAndReceipt(
    input.process_admission_input,
    input.process_admission_receipt,
  );
  validateExternalProductInputs(input);
  validateReleaseBinding(input);
  const domainResult = buildDomainResult(input.process_admission_input);
  const exactCitation = buildExactCitation(
    input.process_admission_input,
    input.product_query_ir,
    domainResult,
  );
  let productQueryResult;
  try {
    productQueryResult = compileProductQueryResult({
      product_query_ir: input.product_query_ir,
      domain_result: domainResult,
      result_fields: input.result_fields,
      exact_citation: exactCitation,
      exact_detail_action: SELECTED_SOURCE_ACTION,
      admission_receipt: input.product_admission_receipt,
    });
  } catch (error) {
    fail(
      'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_PRODUCT_INPUT',
      'The external Product inputs do not admit the mapped Process result.',
      { cause: error.code || error.message },
    );
  }
  validateCompiledMappings(input, domainResult, productQueryResult);
  const identityBody = adapterReceiptIdentityBody(
    input.process_admission_receipt,
    productQueryResult,
  );
  return {
    schema_version:
      PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
    adapter_receipt_id: contentId(
      PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
      identityBody,
    ),
    process_admission_receipt:
      identityBody.process_admission_receipt,
    product_query_result: identityBody.product_query_result,
    adapter_state: 'VALIDATED_NOT_MATERIALISED',
    authority_state: 'NOT_GRANTED',
  };
}

function validateProcessPhrasebookSharedRowBridgeReceipt(
  value,
  input,
) {
  const code =
    'INVALID_PROCESS_PHRASEBOOK_SHARED_ROW_BRIDGE_RECEIPT';
  requireExactKeys(value, [
    'schema_version',
    'adapter_receipt_id',
    'process_admission_receipt',
    'product_query_result',
    'adapter_state',
    'authority_state',
  ], 'Process phrasebook Product adapter receipt', code);
  requireDigest(value.adapter_receipt_id, 'Adapter receipt ID', code);
  if (
    value.schema_version
      !== PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA
    || value.adapter_state !== 'VALIDATED_NOT_MATERIALISED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process phrasebook Product adapter state is invalid.');
  }
  try {
    validateProductQueryResult(value.product_query_result);
  } catch (error) {
    fail(code, 'The adapter receipt Product result is invalid.', {
      cause: error.code || error.message,
    });
  }
  const rebuilt = buildProcessPhrasebookSharedRowBridge(input);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(code, 'The Process phrasebook Product adapter receipt was changed.');
  }
  return true;
}

function compileProcessPhrasebookSharedRowBridge(input) {
  const receipt = buildProcessPhrasebookSharedRowBridge(input);
  validateProcessPhrasebookSharedRowBridgeReceipt(receipt, input);
  return deepFreeze(clone(receipt));
}

function canonicalProcessPhrasebookSharedRowBridgeReceiptBytes(
  value,
  input,
) {
  validateProcessPhrasebookSharedRowBridgeReceipt(value, input);
  return Buffer.from(canonicalJson(value), 'utf8');
}

module.exports = {
  CONTEXT_ACTION,
  PROCESS_DOMAIN_KEY,
  PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT_SCHEMA,
  PROCESS_RESULT_DEFINITION,
  PRODUCT_DOMAIN_VALIDATOR,
  SELECTED_SOURCE_ACTION,
  ProcessPhrasebookSharedRowBridgeError,
  canonicalProcessPhrasebookSharedRowBridgeReceiptBytes,
  compileProcessPhrasebookSharedRowBridge,
  validateProcessPhrasebookSharedRowBridgeReceipt,
};
