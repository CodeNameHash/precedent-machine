const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
  validateProductQueryResult,
} = require('../lib/canonical-v2/product-citation-share-compiler');
const {
  buildQxoCapitalisationF28CandidateEnvelope,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-candidate-envelope',
);
const {
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_RECEIPT_SCHEMA,
  QXO_F28_DOMAIN_VALIDATOR_V2,
  compileQxoCapitalisationF28ProductResultAdapterV2,
  validateQxoCapitalisationF28ProductResultAdapterV2Receipt,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-product-result-adapter',
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

function candidateInput(base) {
  return {
    qxo_cross_view_release: base.qxo_cross_view_release,
    reviewed_graph: base.reviewed_graph,
    source_context: base.source_context,
    parser_source_closure: base.parser_source_closure,
    contract_bundle: base.contract_bundle,
  };
}

function v2DomainResult(release) {
  const result = domainResult(release);
  const body = {
    validator_stable_id: QXO_F28_DOMAIN_VALIDATOR_V2.stable_id,
    validator_version: QXO_F28_DOMAIN_VALIDATOR_V2.version,
    validated_payload_digest: result.domain_result_payload_digest,
    validation_state: 'EXTERNALLY_VALIDATED',
  };
  result.domain_result_validation = {
    schema_version: PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
    ...body,
    validation_receipt_id: contentId(
      PRODUCT_DOMAIN_RESULT_VALIDATION_SCHEMA,
      body,
    ),
  };
  return result;
}

function input() {
  const base = buildF28ProductInputs();
  const envelope = buildQxoCapitalisationF28CandidateEnvelope(
    candidateInput(base),
  );
  const releaseBinding = clone(base.qxo_cross_view_release);
  releaseBinding.manifest.release_manifest_id =
    envelope.source_cross_view_release_id;
  releaseBinding.manifest.canonical_payload_digest =
    envelope.source_cross_view_release_payload_digest;
  const productQueryIr = buildProductQueryIr(releaseBinding);
  const domain = v2DomainResult(base.qxo_cross_view_release);
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

test('adapts the exact F28 candidate envelope into one Product result', () => {
  const source = input();
  const receipt =
    compileQxoCapitalisationF28ProductResultAdapterV2(source);
  assert.equal(
    receipt.schema_version,
    QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_RECEIPT_SCHEMA,
  );
  assert.equal(receipt.authority_state, 'NOT_GRANTED');
  assert.equal(
    canonicalJson(receipt.product_query_result.domain_result_payload),
    canonicalJson(source.candidate_envelope.provision_row),
  );
  assert.equal(
    receipt.product_query_result.domain_result_validation
      .validator_stable_id,
    QXO_F28_DOMAIN_VALIDATOR_V2.stable_id,
  );
  assert.equal(validateProductQueryResult(receipt.product_query_result), true);
  assert.equal(
    validateQxoCapitalisationF28ProductResultAdapterV2Receipt(
      receipt,
      source,
    ),
    true,
  );
  assert.equal(Object.isFrozen(receipt), true);
});

test('binds Product Query IR to the envelope source release', () => {
  const source = input();
  const receipt =
    compileQxoCapitalisationF28ProductResultAdapterV2(source);
  assert.equal(
    receipt.product_query_result.candidate_release_manifest_id,
    source.candidate_envelope.source_cross_view_release_id,
  );
  assert.equal(
    receipt.product_query_result.candidate_release_manifest_payload_digest,
    source.candidate_envelope.source_cross_view_release_payload_digest,
  );
});

test('rejects envelope, Product release, admission and authority drift', () => {
  const envelopeDrift = input();
  envelopeDrift.candidate_envelope = clone(
    envelopeDrift.candidate_envelope,
  );
  envelopeDrift.candidate_envelope.ordered_terminals[0]
    .subject_terminal.raw_value = 'forged';
  assert.throws(
    () => compileQxoCapitalisationF28ProductResultAdapterV2(envelopeDrift),
    /envelope/i,
  );

  const releaseDrift = input();
  releaseDrift.product_query_ir = clone(releaseDrift.product_query_ir);
  releaseDrift.product_query_ir.release_contract
    .candidate_release_manifest_id = '0'.repeat(64);
  assert.throws(
    () => compileQxoCapitalisationF28ProductResultAdapterV2(releaseDrift),
    /Product|release|admit/i,
  );

  const admissionDrift = input();
  admissionDrift.product_admission_receipt = clone(
    admissionDrift.product_admission_receipt,
  );
  admissionDrift.product_admission_receipt
    .covered_set_membership_state = 'FAIL';
  assert.throws(
    () => compileQxoCapitalisationF28ProductResultAdapterV2(admissionDrift),
    /Product|admit/i,
  );
});
