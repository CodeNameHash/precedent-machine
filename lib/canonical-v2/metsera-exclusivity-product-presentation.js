const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  compileProcessPhrasebookProductResultPresentation,
  validateProcessPhrasebookProductResultSetBridgeReceipt,
} = require('./process-phrasebook-product-result-set-bridge');
const {
  validateProductResultPresentation,
} = require('./product-result-presentation-compiler');
const {
  buildPilotProductFieldCatalogueManifest,
} = require('./pilot-product-field-catalogue');
const {
  METSERA_PRODUCT_RESULT_SET_SCHEMA,
} = require('./metsera-exclusivity-product-result-set');
const {
  METSERA_PRODUCT_ROW_SCHEMA,
} = require('./metsera-exclusivity-product-row');

const METSERA_PRODUCT_PRESENTATION_SCHEMA =
  'METSERA_EXCLUSIVITY_PRODUCT_PRESENTATION/V1';
const AUTHORITY_LIMITS = Object.freeze({
  query_execution: 'NONE',
  source_read: 'NONE',
  rendering: 'NONE',
  ui: 'NONE',
  writer: 'NONE',
  serving: 'NONE',
  release: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera Product presentation: ${message}`);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validateInputs(row, resultSet) {
  if (
    row?.schema_version !== METSERA_PRODUCT_ROW_SCHEMA
    || resultSet?.schema_version !== METSERA_PRODUCT_RESULT_SET_SCHEMA
    || resultSet.product_row_receipt_id !== row.product_row_receipt_id
    || resultSet.result_set_state !== 'VALIDATED_NOT_SERVED'
  ) {
    fail('the Product row and result-set binding is invalid');
  }
  try {
    validateProcessPhrasebookProductResultSetBridgeReceipt(
      resultSet.result_set_adapter_receipt,
    );
  } catch (error) {
    fail(`the signed result-set receipt is invalid: ${error.code || error.message}`);
  }
}

function fieldManifest(row) {
  const release = row.product_query_ir.release_contract;
  return buildPilotProductFieldCatalogueManifest({
    approved_pm_data_version_id:
      release.approved_pm_data_version_id,
    candidate_release_manifest_id:
      release.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      release.candidate_release_manifest_payload_digest,
  });
}

function understoodQuestion() {
  return {
    domain_key: 'PROCESS',
    topic_key: 'DEAL_PROTECTION_PROCESS',
    pattern_key: 'EXCLUSIVITY_GRANTED',
    predicate_key: 'EXCLUSIVITY_GRANTED',
    predicate_version: 1,
    label: 'Exclusivity granted',
  };
}

function buildPresentation(row, resultSet) {
  validateInputs(row, resultSet);
  const manifest = fieldManifest(row);
  let handoff;
  try {
    handoff = compileProcessPhrasebookProductResultPresentation({
      validated_result_set_adapter_receipt:
        resultSet.result_set_adapter_receipt,
      product_query_ir: row.product_query_ir,
      product_field_catalogue_manifest: manifest,
      understood_legal_question: understoodQuestion(),
    });
    validateProductResultPresentation(
      handoff.product_result_presentation,
    );
  } catch (error) {
    fail(
      `the signed presentation compiler rejected the pilot: ${
        error.details?.cause || error.code || error.message
      }`,
    );
  }
  const body = {
    schema_version: METSERA_PRODUCT_PRESENTATION_SCHEMA,
    product_row_receipt_id: row.product_row_receipt_id,
    product_result_set_receipt_id:
      resultSet.product_result_set_receipt_id,
    product_field_catalogue_manifest: manifest,
    product_presentation_handoff: handoff,
    presentation_state: 'VALIDATED_NOT_RENDERED',
    authority_limits: AUTHORITY_LIMITS,
  };
  return {
    schema_version: body.schema_version,
    product_presentation_receipt_id: contentId(
      METSERA_PRODUCT_PRESENTATION_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compileMetseraExclusivityProductPresentation(row, resultSet) {
  return deepFreeze(buildPresentation(clone(row), clone(resultSet)));
}

function validateMetseraExclusivityProductPresentation(
  value,
  row,
  resultSet,
) {
  const rebuilt = buildPresentation(clone(row), clone(resultSet));
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the Product presentation receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_PRESENTATION_SCHEMA,
  compileMetseraExclusivityProductPresentation,
  validateMetseraExclusivityProductPresentation,
};
