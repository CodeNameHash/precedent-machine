const assert = require('node:assert/strict');
const test = require('node:test');

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_DEFINITION_DIGEST,
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_ID,
  QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_KIND,
  validateAuthoredQxoCapitalisationF28ProductResultAdapterV2Inputs,
} = require('../lib/canonical-v2/qxo-capitalisation-f28-product-result-adapter-v2-contract-input-validator');
const adapterV2 = require('../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v2.json');
const candidateEnvelope = require('../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-candidate-envelope.v1.json');
const historicalV1 = require('../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v1.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function member(value) {
  return { object_kind: value.object_kind, canonical_value: value };
}

function validMembers() {
  return [member(adapterV2), member(candidateEnvelope)];
}

function rejects(mutator) {
  const values = validMembers().map((entry) => member(clone(entry.canonical_value)));
  mutator(values);
  assert.throws(
    () => validateAuthoredQxoCapitalisationF28ProductResultAdapterV2Inputs(values),
    (error) => error.code === 'INVALID_QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_CONTRACT_INPUT',
  );
}

test('accepts only the complete governed V2 definition and exact candidate envelope', () => {
  assert.equal(adapterV2.stable_id, QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_ID);
  assert.equal(adapterV2.object_kind, QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_KIND);
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(adapterV2.definition), 'utf8')),
    QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_DEFINITION_DIGEST,
  );
  assert.equal(
    validateAuthoredQxoCapitalisationF28ProductResultAdapterV2Inputs(validMembers()),
    undefined,
  );
});

test('rejects a missing or substituted candidate-envelope binding', () => {
  assert.throws(
    () => validateAuthoredQxoCapitalisationF28ProductResultAdapterV2Inputs([member(adapterV2)]),
    (error) => error.code === 'INVALID_QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_CONTRACT_INPUT',
  );
  rejects((values) => {
    values[1].canonical_value.definition.candidate_envelope_contract
      .successor_adapter_requirement.signed_v1_adapter_is_envelope_authority = true;
  });
});

test('rejects V1 substitution and any V1 materialisation authority', () => {
  assert.throws(
    () => validateAuthoredQxoCapitalisationF28ProductResultAdapterV2Inputs([
      member(historicalV1), member(candidateEnvelope),
    ]),
    (error) => error.code === 'INVALID_QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_V2_CONTRACT_INPUT',
  );
  rejects((values) => {
    values[0].canonical_value.definition.lifecycle_contract
      .historical_v1_adapter_may_authorise_envelope_materialisation = true;
  });
});

test('rejects Product Query IR manifest, row, terminal, and surface drift', () => {
  rejects((values) => {
    values[0].canonical_value.definition.product_query_ir_binding_contract
      .old_cross_view_manifest_binding_permitted = true;
  });
  rejects((values) => {
    values[0].canonical_value.definition.exact_row_preservation_contract
      .exact_row_count = 2;
  });
  rejects((values) => {
    values[0].canonical_value.definition.exact_row_preservation_contract
      .ordered_terminal_count = 13;
  });
  rejects((values) => {
    values[0].canonical_value.definition.surface_and_evidence_preservation_contract
      .required_surfaces.pop();
  });
});

test('rejects envelope terminal drift and self-rehashed successor definitions', () => {
  rejects((values) => {
    values[1].canonical_value.definition.candidate_envelope_contract
      .ordered_terminals[7].subject_terminal_kind = 'MARKET_OBSERVATION';
  });
  rejects((values) => {
    values[1].canonical_value.definition.candidate_envelope_contract
      .ordered_terminals[0].terminal_payload_digest = '0'.repeat(64);
    const definition = values[0].canonical_value.definition;
    definition.candidate_envelope_dependency.definition_digest = sha256Hex(
      Buffer.from(canonicalJson(values[1].canonical_value.definition), 'utf8'),
    );
  });
});

test('keeps all execution, import, query, serving, writer, database, and activation authority at NONE', () => {
  const authority = adapterV2.definition.authority_contract;
  assert.equal(authority.authority_state, 'NONE');
  for (const [key, value] of Object.entries(authority)) {
    if (key !== 'authority_state') assert.equal(value, false);
  }
  rejects((values) => {
    values[0].canonical_value.definition.authority_contract
      .creates_execution_authority = true;
  });
});
