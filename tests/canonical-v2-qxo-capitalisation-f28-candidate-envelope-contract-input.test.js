const assert = require('node:assert/strict');
const test = require('node:test');

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
  QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND,
  validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs,
} = require('../lib/canonical-v2/qxo-capitalisation-f28-candidate-envelope-contract-input-validator');
const candidateEnvelope = require('../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-candidate-envelope.v1.json');
const signedV1ProductAdapter = require('../contracts/canonical-v2/successor/product/query/qxo-capitalisation-f28-product-result-adapter.v1.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function member(value = candidateEnvelope) {
  return { object_kind: value.object_kind, canonical_value: value };
}

function rejects(mutator, code = 'INVALID_QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_CONTRACT_INPUT') {
  const changed = clone(candidateEnvelope);
  mutator(changed);
  assert.throws(
    () => validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs([member(changed)]),
    (error) => error.code === code,
  );
}

test('accepts the immutable QXO F28 candidate envelope definition', () => {
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(candidateEnvelope.definition), 'utf8')),
    QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_DEFINITION_DIGEST,
  );
  assert.equal(
    validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs([member()]),
    undefined,
  );
});

test('rejects terminal omission, reorder, and duplication', () => {
  rejects((value) => value.definition.candidate_envelope_contract
    .ordered_terminals.ordered_metric_slots.pop());
  rejects((value) => {
    const terminals = value.definition.candidate_envelope_contract
      .ordered_terminals.ordered_metric_slots;
    [terminals[0], terminals[1]] = [terminals[1], terminals[0]];
  });
  rejects((value) => {
    const terminals = value.definition.candidate_envelope_contract
      .ordered_terminals.ordered_metric_slots;
    terminals[1] = clone(terminals[0]);
  });
});

test('rejects the 13 plus 1 terminal inventory drifting', () => {
  rejects((value) => {
    value.definition.candidate_envelope_contract.ordered_terminals
      .ordered_metric_slots[7].subject_terminal_kind = 'MARKET_OBSERVATION';
  });
  rejects((value) => {
    value.definition.candidate_envelope_contract.terminal_count_contract
      .market_observation_count = 14;
  });
});

test('rejects row and Product membership mismatch', () => {
  rejects((value) => {
    value.definition.candidate_envelope_contract.product_membership
      .domain_result_identity_source = 'CALLER_SUPPLIED_ID';
  });
  rejects((value) => {
    value.definition.candidate_envelope_contract.product_membership
      .domain_result_payload_digest_source = 'CALLER_SUPPLIED_DIGEST';
  });
});

test('rejects extra authority and semantic self-rehash', () => {
  rejects((value) => {
    value.definition.candidate_envelope_contract.authority
      .creates_writer_authority = true;
  });
  rejects((value) => {
    const envelope = value.definition.candidate_envelope_contract;
    envelope.provision_row.provision_row_payload_digest_source =
      'CALLER_SUPPLIED_DIGEST';
    envelope.product_membership.domain_result_payload_digest_source =
      'CALLER_SUPPLIED_DIGEST';
  });
});

test('does not treat the signed V1 Product adapter as envelope authority', () => {
  assert.throws(
    () => validateAuthoredQxoCapitalisationF28CandidateEnvelopeInputs([
      { object_kind: QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_KIND, canonical_value: signedV1ProductAdapter },
    ]),
    (error) => error.code === 'QXO_CAPITALISATION_F28_CANDIDATE_ENVELOPE_MEMBERSHIP_MISMATCH',
  );
});
