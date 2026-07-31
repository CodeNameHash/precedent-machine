const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateMetseraExclusivityProductPresentation,
} = require('./metsera-exclusivity-product-presentation');
const {
  validateMetseraExclusivityProductResultSet,
} = require('./metsera-exclusivity-product-result-set');
const {
  validateMetseraExclusivityProductRow,
} = require('./metsera-exclusivity-product-row');

const METSERA_PRODUCT_SURFACES_SCHEMA =
  'METSERA_EXCLUSIVITY_PRODUCT_SURFACES/V1';
const SURFACES = Object.freeze([
  'COMPARE',
  'CORPUS_CONTEXT',
  'QUERY',
  'REVIEW',
]);
const AUTHORITY_LIMITS = Object.freeze({
  market_cohort: 'NONE',
  query_execution: 'NONE',
  source_read: 'NONE',
  rendering: 'NONE',
  serving: 'NONE',
  writer: 'NONE',
  release: 'NONE',
  database_write: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

function fail(message) {
  throw new Error(`Metsera Product surfaces: ${message}`);
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

function marketState(surface) {
  return ['COMPARE', 'CORPUS_CONTEXT'].includes(surface)
    ? 'SINGLE_PILOT_RESULT_NO_MARKET_COHORT'
    : 'NOT_APPLICABLE';
}

function buildSurfaces(
  admission,
  row,
  resultSet,
  presentation,
  authorityContext,
  authorityInput,
) {
  if (!authorityContext || !authorityInput) {
    fail('the exact Pilot Product authority context and input are required');
  }
  validateMetseraExclusivityProductRow(
    row,
    admission,
    authorityContext,
    authorityInput,
  );
  validateMetseraExclusivityProductResultSet(
    resultSet,
    admission,
    row,
    authorityContext,
    authorityInput,
  );
  validateMetseraExclusivityProductPresentation(
    presentation,
    row,
    resultSet,
  );
  const result =
    row.shared_row_adapter_receipt.product_query_result;
  const presentationPayload =
    presentation.product_presentation_handoff
      .product_result_presentation;
  if (
    resultSet.product_row_receipt_id !== row.product_row_receipt_id
    || presentation.product_row_receipt_id !== row.product_row_receipt_id
    || presentation.product_result_set_receipt_id
      !== resultSet.product_result_set_receipt_id
    || presentationPayload.contract_bindings
      .product_query_ir_definition.query_definition_id
      !== row.product_query_ir.query_definition_id
    || presentationPayload
      .ordered_product_result_slot_identities[0]
      !== result.product_query_result_identity
  ) {
    fail('the row, result set and presentation do not share one result');
  }
  const surfaceBindings = Object.fromEntries(SURFACES.map((surface) => [
    surface,
    {
      surface,
      product_query_definition_id:
        row.product_query_ir.query_definition_id,
      product_query_result_identity:
        result.product_query_result_identity,
      domain_result_identity: result.domain_result_identity,
      product_result: clone(result),
      product_presentation: clone(presentationPayload),
      exact_citation: clone(result.exact_citation),
      selected_source_action: result.exact_detail_action,
      process_result_admission_receipt:
        clone(admission.admission_receipt),
      market_state: marketState(surface),
    },
  ]));
  const body = {
    product_row_receipt_id: row.product_row_receipt_id,
    product_result_set_receipt_id:
      resultSet.product_result_set_receipt_id,
    product_presentation_receipt_id:
      presentation.product_presentation_receipt_id,
    surface_bindings: surfaceBindings,
    surface_state: 'VALIDATED_NOT_SERVED',
    authority_limits: AUTHORITY_LIMITS,
  };
  return {
    schema_version: METSERA_PRODUCT_SURFACES_SCHEMA,
    product_surfaces_receipt_id: contentId(
      METSERA_PRODUCT_SURFACES_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compileMetseraExclusivityProductSurfaces(
  admission,
  row,
  resultSet,
  presentation,
  authorityContext,
  authorityInput,
) {
  return deepFreeze(buildSurfaces(
    clone(admission),
    clone(row),
    clone(resultSet),
    clone(presentation),
    authorityContext ? clone(authorityContext) : authorityContext,
    authorityInput ? clone(authorityInput) : authorityInput,
  ));
}

function validateMetseraExclusivityProductSurfaces(
  value,
  admission,
  row,
  resultSet,
  presentation,
  authorityContext,
  authorityInput,
) {
  const rebuilt = buildSurfaces(
    clone(admission),
    clone(row),
    clone(resultSet),
    clone(presentation),
    authorityContext ? clone(authorityContext) : authorityContext,
    authorityInput ? clone(authorityInput) : authorityInput,
  );
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail('the surface receipt was changed');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_SURFACES_SCHEMA,
  SURFACES,
  compileMetseraExclusivityProductSurfaces,
  validateMetseraExclusivityProductSurfaces,
};
