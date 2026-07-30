const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateQxoCapitalisationF28ProductResultAdapterV2Receipt,
} = require('./qxo-capitalisation-f28-product-result-adapter');

const QXO_CAPITALISATION_F28_PRODUCT_SURFACES_SCHEMA =
  'QXO_CAPITALISATION_F28_PRODUCT_SURFACES/V1';
const SURFACES = Object.freeze([
  'COMPARE',
  'CORPUS_CONTEXT',
  'QUERY',
  'REVIEW',
]);

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())) {
    throw new TypeError(`${label} fields do not match the closed contract`);
  }
}

function buildQxoCapitalisationF28ProductSurfaces(input = {}) {
  exactKeys(input, [
    'product_adapter_v2_receipt',
    'product_adapter_v2_input',
  ], 'QXO F28 Product surface input');
  validateQxoCapitalisationF28ProductResultAdapterV2Receipt(
    input.product_adapter_v2_receipt,
    input.product_adapter_v2_input,
  );
  const receipt = input.product_adapter_v2_receipt;
  const result = receipt.product_query_result;
  const envelope = receipt.candidate_envelope;
  if (
    result.domain_result_identity
      !== envelope.provision_row.provision_row_id
    || canonicalJson(result.domain_result_payload)
      !== canonicalJson(envelope.provision_row)
  ) {
    throw new TypeError(
      'the QXO F28 Product result does not preserve the envelope row',
    );
  }
  const surfaceBindings = Object.fromEntries(SURFACES.map((surface) => [
    surface,
    {
      surface,
      product_query_result_identity:
        result.product_query_result_identity,
      provision_row_id: envelope.provision_row.provision_row_id,
      provision_row: clone(result.domain_result_payload),
      exact_citation: clone(result.exact_citation),
      exact_detail_action: result.exact_detail_action,
    },
  ]));
  const body = {
    candidate_envelope_id:
      envelope.qxo_capitalisation_f28_candidate_envelope_id,
    product_adapter_receipt_id: receipt.adapter_receipt_id,
    product_query_result_identity:
      result.product_query_result_identity,
    surface_bindings: surfaceBindings,
    surface_state: 'VALIDATED_NOT_SERVED',
    authority_state: 'NONE',
  };
  return freeze({
    schema_version: QXO_CAPITALISATION_F28_PRODUCT_SURFACES_SCHEMA,
    qxo_capitalisation_f28_product_surfaces_id: contentId(
      QXO_CAPITALISATION_F28_PRODUCT_SURFACES_SCHEMA,
      body,
    ),
    ...body,
  });
}

module.exports = {
  QXO_CAPITALISATION_F28_PRODUCT_SURFACES_SCHEMA,
  SURFACES,
  buildQxoCapitalisationF28ProductSurfaces,
};
