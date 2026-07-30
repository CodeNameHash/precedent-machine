const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  buildQxoCapitalisationF28CandidateEnvelope,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-candidate-envelope',
);
const {
  QXO_F28_DOMAIN_VALIDATOR_V2,
  compileQxoCapitalisationF28ProductResultAdapterV2,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-product-result-adapter',
);
const {
  SURFACES,
  buildQxoCapitalisationF28ProductSurfaces,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-product-surfaces',
);
const {
  admissionReceipt,
  buildF28ProductInputs,
  buildProductQueryIr,
  clone,
  domainResult,
} = require(
  './fixtures/canonical-v2/qxo-capitalisation-f28-product-inputs',
);

function productInput() {
  const base = buildF28ProductInputs();
  const envelope = buildQxoCapitalisationF28CandidateEnvelope({
    qxo_cross_view_release: base.qxo_cross_view_release,
    reviewed_graph: base.reviewed_graph,
    source_context: base.source_context,
    parser_source_closure: base.parser_source_closure,
    contract_bundle: base.contract_bundle,
  });
  const releaseBinding = clone(base.qxo_cross_view_release);
  releaseBinding.manifest.release_manifest_id =
    envelope.source_cross_view_release_id;
  releaseBinding.manifest.canonical_payload_digest =
    envelope.source_cross_view_release_payload_digest;
  const productQueryIr = buildProductQueryIr(releaseBinding);
  const domain = domainResult(base.qxo_cross_view_release);
  const validationBody = {
    validator_stable_id: QXO_F28_DOMAIN_VALIDATOR_V2.stable_id,
    validator_version: QXO_F28_DOMAIN_VALIDATOR_V2.version,
    validated_payload_digest: domain.domain_result_payload_digest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  domain.domain_result_validation = {
    schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
    ...validationBody,
    validation_receipt_id: contentId(
      PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      validationBody,
    ),
  };
  return {
    candidate_envelope: envelope,
    qxo_cross_view_release: base.qxo_cross_view_release,
    reviewed_graph: base.reviewed_graph,
    source_context: base.source_context,
    parser_source_closure: base.parser_source_closure,
    contract_bundle: base.contract_bundle,
    product_query_ir: productQueryIr,
    result_fields: base.result_fields,
    product_admission_receipt: admissionReceipt(
      productQueryIr,
      domain,
      base.result_fields,
    ),
  };
}

test('uses one exact F28 row on all four fixture surfaces', () => {
  const adapterInput = productInput();
  const receipt =
    compileQxoCapitalisationF28ProductResultAdapterV2(adapterInput);
  const value = buildQxoCapitalisationF28ProductSurfaces({
    product_adapter_v2_receipt: receipt,
    product_adapter_v2_input: adapterInput,
  });
  assert.deepEqual(Object.keys(value.surface_bindings), SURFACES);
  const rows = Object.values(value.surface_bindings).map(
    (binding) => canonicalJson(binding.provision_row),
  );
  assert.equal(new Set(rows).size, 1);
  assert.equal(
    rows[0],
    canonicalJson(receipt.candidate_envelope.provision_row),
  );
  assert.equal(value.surface_state, 'FIXTURE_VALIDATED_NOT_SERVED');
  assert.equal(value.authority_state, 'NONE');
  assert.equal(Object.isFrozen(value), true);
});

test('preserves citation and source action on every surface', () => {
  const adapterInput = productInput();
  const receipt =
    compileQxoCapitalisationF28ProductResultAdapterV2(adapterInput);
  const value = buildQxoCapitalisationF28ProductSurfaces({
    product_adapter_v2_receipt: receipt,
    product_adapter_v2_input: adapterInput,
  });
  for (const binding of Object.values(value.surface_bindings)) {
    assert.deepEqual(
      binding.exact_citation,
      receipt.product_query_result.exact_citation,
    );
    assert.equal(
      binding.exact_detail_action,
      receipt.product_query_result.exact_detail_action,
    );
  }
});

test('rejects a changed receipt or envelope row', () => {
  const adapterInput = productInput();
  const receipt =
    compileQxoCapitalisationF28ProductResultAdapterV2(adapterInput);
  const changed = clone(receipt);
  changed.product_query_result.domain_result_payload.label = 'forged';
  assert.throws(
    () => buildQxoCapitalisationF28ProductSurfaces({
      product_adapter_v2_receipt: changed,
      product_adapter_v2_input: adapterInput,
    }),
    /receipt|result|changed|invalid/i,
  );
});
