const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  buildQxoCapitalisationF28WriterLink,
} = require('./qxo-capitalisation-f28-writer-link');
const {
  buildQxoCapitalisationF28CandidateEnvelope,
} = require('./qxo-capitalisation-f28-candidate-envelope');
const {
  compileQxoCapitalisationF28ProductResultAdapterV2,
} = require('./qxo-capitalisation-f28-product-result-adapter');
const {
  buildQxoCapitalisationF28ProductSurfaces,
} = require('./qxo-capitalisation-f28-product-surfaces');

const QXO_CAPITALISATION_F28_PILOT_PREFLIGHT_SCHEMA =
  'QXO_CAPITALISATION_F28_PILOT_PREFLIGHT/V1';

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

function buildQxoCapitalisationF28PilotPreflight(input = {}) {
  exactKeys(input, [
    'writer_link_input',
    'product_adapter_v2_input',
  ], 'QXO F28 pilot preflight input');
  const writerLink = buildQxoCapitalisationF28WriterLink(
    input.writer_link_input,
  );
  const candidateEnvelope = buildQxoCapitalisationF28CandidateEnvelope({
    qxo_cross_view_release:
      input.product_adapter_v2_input.qxo_cross_view_release,
    reviewed_graph: input.writer_link_input.reviewed_graph,
    source_context: input.writer_link_input.source_context,
    parser_source_closure:
      input.writer_link_input.parser_source_closure,
    contract_bundle: input.writer_link_input.contract_bundle,
  });
  if (
    canonicalJson(candidateEnvelope)
      !== canonicalJson(input.product_adapter_v2_input.candidate_envelope)
    || canonicalJson(input.writer_link_input.reviewed_graph)
      !== canonicalJson(input.product_adapter_v2_input.reviewed_graph)
    || canonicalJson(input.writer_link_input.source_context)
      !== canonicalJson(input.product_adapter_v2_input.source_context)
    || canonicalJson(input.writer_link_input.parser_source_closure)
      !== canonicalJson(
        input.product_adapter_v2_input.parser_source_closure,
      )
  ) {
    throw new TypeError(
      'the QXO F28 writer and Product inputs do not share one source graph',
    );
  }
  const productAdapterReceipt =
    compileQxoCapitalisationF28ProductResultAdapterV2(
      input.product_adapter_v2_input,
    );
  const productSurfaces = buildQxoCapitalisationF28ProductSurfaces({
    product_adapter_v2_receipt: productAdapterReceipt,
    product_adapter_v2_input: input.product_adapter_v2_input,
  });
  const body = {
    writer_receipt: clone(writerLink.receipt),
    candidate_envelope_id:
      candidateEnvelope.qxo_capitalisation_f28_candidate_envelope_id,
    product_adapter_receipt_id:
      productAdapterReceipt.adapter_receipt_id,
    product_surfaces_id:
      productSurfaces.qxo_capitalisation_f28_product_surfaces_id,
    product_query_result_identity:
      productAdapterReceipt.product_query_result
        .product_query_result_identity,
    surface_names: Object.keys(productSurfaces.surface_bindings),
    preflight_state: 'PASS',
    staging_database_state: 'NOT_EXECUTED',
    production_database_state: 'NOT_TOUCHED',
    authority_state: 'NONE',
  };
  return freeze({
    schema_version: QXO_CAPITALISATION_F28_PILOT_PREFLIGHT_SCHEMA,
    qxo_capitalisation_f28_pilot_preflight_id: contentId(
      QXO_CAPITALISATION_F28_PILOT_PREFLIGHT_SCHEMA,
      body,
    ),
    ...body,
    writer_link: clone(writerLink),
    candidate_envelope: clone(candidateEnvelope),
    product_adapter_receipt: clone(productAdapterReceipt),
    product_surfaces: clone(productSurfaces),
  });
}

module.exports = {
  QXO_CAPITALISATION_F28_PILOT_PREFLIGHT_SCHEMA,
  buildQxoCapitalisationF28PilotPreflight,
};
