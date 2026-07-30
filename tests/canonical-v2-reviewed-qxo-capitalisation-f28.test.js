const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildQxoReviewedCapitalisationF28,
  validateQxoReviewedCapitalisationF28,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-f28');
const {
  buildF27Inputs,
} = require('./fixtures/canonical-v2/qxo-capitalisation-f27-inputs');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('F28 reuses exact reviewed source identities and selects successor semantics', () => {
  const inputs = buildF27Inputs();
  const graph = buildQxoReviewedCapitalisationF28(inputs);
  assert.equal(validateQxoReviewedCapitalisationF28({
    candidate: graph,
    ...inputs,
  }), true);
  assert.equal(graph.result_contract.authored_definition.result_version, 3);
  assert.equal(graph.result_contract.authored_definition.market_metric_slot_count, 14);
  assert.equal(graph.metric_contracts.length, 9);
  assert.deepEqual(
    graph.relationships.slice(0, 2).map((entry) => ({
      key: entry.relationship_definition_key,
      version: entry.relationship_definition_version,
      effect: entry.effect.effect_schema_version,
    })),
    [
      { key: 'BRINGS_DOWN', version: 3, effect: 2 },
      { key: 'BRINGS_DOWN', version: 3, effect: 2 },
    ],
  );
  assert.equal(
    graph.relationships[2].effect.definition_application
      .denominator_party_value,
    'COMPANY',
  );
  assert.equal(graph.claims[3].attributes.signing_relative_offset, -1);
});

test('F28 refuses re-signed party, effect and source-lineage drift', () => {
  const inputs = buildF27Inputs();
  const graph = buildQxoReviewedCapitalisationF28(inputs);
  for (const mutate of [
    (value) => {
      value.party.value = 'PARENT';
    },
    (value) => {
      value.relationships[0].effect.accuracy_exception = null;
    },
    (value) => {
      value.predecessor_reviewed_graph_payload_digest = '0'.repeat(64);
    },
  ]) {
    const forged = clone(graph);
    mutate(forged);
    const body = clone(forged);
    delete body.qxo_reviewed_capitalisation_f28_id;
    delete body.canonical_payload_digest;
    forged.qxo_reviewed_capitalisation_f28_id =
      require('../lib/canonical-v2/canonical-bytes').contentId(
        'QXO_REVIEWED_CAPITALISATION_F28/V1',
        body,
      );
    forged.canonical_payload_digest =
      require('../lib/canonical-v2/canonical-bytes').contentId(
        'QXO_REVIEWED_CAPITALISATION_F28_PAYLOAD/V1',
        body,
      );
    assert.notEqual(canonicalJson(forged), canonicalJson(graph));
    assert.throws(
      () => validateQxoReviewedCapitalisationF28({
        candidate: forged,
        ...inputs,
      }),
      /reviewed QXO F28 capitalisation graph has drifted/,
    );
  }
});
