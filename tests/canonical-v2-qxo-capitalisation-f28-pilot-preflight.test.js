const assert = require('node:assert/strict');
const test = require('node:test');

const {
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
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-product-result-adapter',
);
const {
  buildQxoCapitalisationF28PilotPreflight,
} = require(
  '../lib/canonical-v2/qxo-capitalisation-f28-pilot-preflight',
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
function input() {
  const base = buildF28ProductInputs();
  const release = base.qxo_cross_view_release;
  const fields = base.result_fields;
  const candidateInput = {
    qxo_cross_view_release: release,
    reviewed_graph: base.reviewed_graph,
    source_context: base.source_context,
    parser_source_closure: base.parser_source_closure,
    contract_bundle: base.contract_bundle,
  };
  const envelope =
    buildQxoCapitalisationF28CandidateEnvelope(candidateInput);
  const productQueryIr = buildProductQueryIr(release);
  const domain = domainResult(release);
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
    writer_link_input: {
      reviewed_graph: base.reviewed_graph,
      source_context: base.source_context,
      parser_source_closure: base.parser_source_closure,
      contract_bundle: base.contract_bundle,
      idempotency_key: 'qxo-f28-pilot-preflight-v1',
    },
    product_adapter_v2_input: {
      candidate_envelope: envelope,
      ...candidateInput,
      product_query_ir: productQueryIr,
      result_fields: fields,
      product_admission_receipt: admissionReceipt(
        productQueryIr,
        domain,
        fields,
      ),
    },
  };
}

test('binds the complete source-to-four-surface F28 preflight', () => {
  const value = buildQxoCapitalisationF28PilotPreflight(input());
  assert.equal(value.preflight_state, 'PASS');
  assert.equal(value.writer_receipt.validation_state, 'ACCEPTED');
  assert.equal(value.writer_receipt.validation_counts.residuals, 0);
  assert.deepEqual(value.surface_names, [
    'COMPARE',
    'CORPUS_CONTEXT',
    'QUERY',
    'REVIEW',
  ]);
  assert.equal(value.staging_database_state, 'NOT_EXECUTED');
  assert.equal(value.production_database_state, 'NOT_TOUCHED');
  assert.equal(value.authority_state, 'NONE');
  assert.equal(Object.isFrozen(value), true);
});

test('rejects source-graph or candidate-envelope substitution', () => {
  const changedGraph = input();
  changedGraph.product_adapter_v2_input.reviewed_graph = clone(
    changedGraph.product_adapter_v2_input.reviewed_graph,
  );
  changedGraph.product_adapter_v2_input.reviewed_graph
    .qxo_reviewed_capitalisation_f28_id = '0'.repeat(64);
  assert.throws(
    () => buildQxoCapitalisationF28PilotPreflight(changedGraph),
    /source graph|review|F28|changed|invalid/i,
  );

  const changedEnvelope = input();
  changedEnvelope.product_adapter_v2_input.candidate_envelope = clone(
    changedEnvelope.product_adapter_v2_input.candidate_envelope,
  );
  changedEnvelope.product_adapter_v2_input.candidate_envelope
    .provision_row.label = 'forged';
  assert.throws(
    () => buildQxoCapitalisationF28PilotPreflight(changedEnvelope),
    /source graph|envelope|changed|invalid/i,
  );
});
