const { canonicalJson } = require('./canonical-bytes');
const {
  validateCandidateInputAuthoritySelection,
} = require('./candidate-input-authority');
const {
  validateQxoCapitalisationCrossViewReleaseF28,
} = require('./qxo-capitalisation-cross-view-release-f28');
const {
  compileQxoCapitalisationF28ProductResultAdapter,
} = require('./qxo-capitalisation-f28-product-result-adapter');
const {
  validateQxoReviewedCapitalisationF28,
} = require('./reviewed-qxo-capitalisation-f28');

const RUNTIME_LINK_PLAN_SCHEMA =
  'QXO_CAPITALISATION_F28_RUNTIME_LINK_PLAN/V1';
const WRITER_NOT_BOUND_REASON = 'F28_DEAL_SCOPE_WRITE_SET_NOT_GOVERNED';
const CANDIDATE_RELEASE_NOT_BOUND_REASON =
  'F28_FOURTEEN_SLOT_ROW_NOT_ADMITTED_BY_CANDIDATE_RELEASE_V1';
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
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the closed runtime link`);
  }
}

function validateInventory(release) {
  if (
    release.admissions.length !== 14
    || release.observations.length !== 13
    || release.exclusions.length !== 1
    || release.provision_row.subrows.length !== 6
    || canonicalJson(Object.keys(release.surface_bindings).sort())
      !== canonicalJson(SURFACES)
  ) {
    throw new TypeError('the F28 release inventory is incomplete or aggregated');
  }
}

function buildQxoCapitalisationF28RuntimeLinkPlan(input = {}) {
  exactKeys(input, [
    'reviewed_graph',
    'qxo_cross_view_release',
    'source_context',
    'parser_source_closure',
    'contract_bundle',
    'correction_authority_selection',
    'product_adapter_input',
  ], 'QXO F28 runtime link input');
  const reviewedGraph = input.reviewed_graph;
  const release = input.qxo_cross_view_release;
  validateQxoReviewedCapitalisationF28({
    candidate: reviewedGraph,
    sourceContext: input.source_context,
    parserSourceClosure: input.parser_source_closure,
    contractBundle: input.contract_bundle,
  });
  validateQxoCapitalisationCrossViewReleaseF28({
    candidate: release,
    reviewedGraph,
    sourceContext: input.source_context,
    parserSourceClosure: input.parser_source_closure,
    contractBundle: input.contract_bundle,
  });
  validateInventory(release);
  validateCandidateInputAuthoritySelection({
    authority_selection: input.correction_authority_selection,
    contract_bundle: input.contract_bundle,
  });
  exactKeys(input.product_adapter_input, [
    'qxo_cross_view_release',
    'reviewed_graph',
    'source_context',
    'parser_source_closure',
    'contract_bundle',
    'product_query_ir',
    'result_fields',
    'product_admission_receipt',
  ], 'QXO F28 Product adapter input');
  if (
    canonicalJson(input.product_adapter_input.qxo_cross_view_release)
      !== canonicalJson(release)
    || canonicalJson(input.product_adapter_input.reviewed_graph)
      !== canonicalJson(reviewedGraph)
    || canonicalJson(input.product_adapter_input.source_context)
      !== canonicalJson(input.source_context)
    || canonicalJson(input.product_adapter_input.parser_source_closure)
      !== canonicalJson(input.parser_source_closure)
    || canonicalJson(input.product_adapter_input.contract_bundle)
      !== canonicalJson(input.contract_bundle)
  ) {
    throw new TypeError('Product adapter input is not bound to the exact F28 release');
  }
  const productAdapterReceipt =
    compileQxoCapitalisationF28ProductResultAdapter(input.product_adapter_input);
  const authority = input.correction_authority_selection;
  return freeze({
    schema_version: RUNTIME_LINK_PLAN_SCHEMA,
    reviewed_graph_id: reviewedGraph.qxo_reviewed_capitalisation_f28_id,
    reviewed_graph_payload_digest: reviewedGraph.canonical_payload_digest,
    release_id: release.release_id,
    release_manifest_id: release.manifest.release_manifest_id,
    release_manifest_payload_digest: release.manifest.canonical_payload_digest,
    provision_row_id: release.provision_row.provision_row_id,
    counts: clone(release.manifest.counts),
    candidate_input_head_id: authority.candidate_input_head.candidate_input_head_id,
    candidate_input_head_payload_digest:
      authority.candidate_input_head.canonical_payload_digest,
    correction_discharge_map_id:
      authority.correction_discharge_map.correction_discharge_map_id,
    correction_discharge_map_payload_digest:
      authority.correction_discharge_map.canonical_payload_digest,
    product_adapter_receipt: clone(productAdapterReceipt),
    writer_state: 'NOT_BOUND',
    writer_reason: WRITER_NOT_BOUND_REASON,
    candidate_release_state: 'NOT_BOUND',
    candidate_release_reason: CANDIDATE_RELEASE_NOT_BOUND_REASON,
    execution_authority: 'NONE',
    retries: 0,
    active_pointer_mutation: false,
  });
}

module.exports = {
  CANDIDATE_RELEASE_NOT_BOUND_REASON,
  RUNTIME_LINK_PLAN_SCHEMA,
  WRITER_NOT_BOUND_REASON,
  buildQxoCapitalisationF28RuntimeLinkPlan,
};
