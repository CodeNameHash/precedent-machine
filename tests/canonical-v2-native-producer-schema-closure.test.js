const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const {
  compileCandidateProposal,
  compileCandidateProposals,
} = require('../lib/canonical-v2/native-producer/candidate-proposal-compiler');
const {
  CLAIM_DEFINITION_KEY,
  buildQxoNativeProducerFixtureSource,
  buildQxoNativeProducerProposals,
} = require('./fixtures/canonical-v2/qxo-native-producer-proposals');

const CONTRACT_BUNDLE = compileFixtureContract();
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'deal:qxo-topbuild',
  governed_intervals: ['CAPITAL_STRUCTURE', 'SECTION_5_2'],
});
const DEFINITIONS = Object.freeze({ claim_definition_keys: [CLAIM_DEFINITION_KEY] });

async function receiptFor(proposals) {
  return produceCandidateProposals({
    governed_scope: GOVERNED_SCOPE,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    provider: async () => ({
      provider_id: 'fixture-recorded',
      model_id: 'recorded-fixture-v1',
      prompt: 'qxo-native-producer-schema-closure-fixture-v1',
      proposals,
    }),
  });
}

test('an unrecognised attribute becomes a typed UNKNOWN_ATTRIBUTE residual, never a silent drop, never an uncaught throw', async () => {
  const fixture = buildQxoNativeProducerProposals();
  const base = fixture.proposals[0];
  const malformed = {
    ...base,
    ordinal: 99,
    attributes: { ...base.attributes, model_confidence_score: 0.87 },
    // allowed_attributes intentionally does NOT include model_confidence_score
  };

  const { proposals, producer_receipt } = await receiptFor([malformed]);

  assert.doesNotThrow(() => compileCandidateProposal({
    proposal: proposals[0],
    governed_scope: GOVERNED_SCOPE,
    producer_receipt,
    extractor_id: 'native-producer-batch1',
    extractor_version: 'v1',
  }));

  const candidate = compileCandidateProposal({
    proposal: proposals[0],
    governed_scope: GOVERNED_SCOPE,
    producer_receipt,
    extractor_id: 'native-producer-batch1',
    extractor_version: 'v1',
  });

  assert.equal(candidate.claim.publication_state, 'QUARANTINED');
  assert.ok(candidate.claim.attributes.model_confidence_score !== undefined, 'the unrecognised field is retained on the row, not silently dropped');
  const residual = candidate.claim.retained_residuals.find((entry) => entry.reason === 'UNKNOWN_ATTRIBUTE');
  assert.ok(residual, 'the unrecognised attribute must surface as a typed residual');
  assert.equal(residual.attribute, 'model_confidence_score');
});

test('an unrecognised taxonomy code becomes a typed INVALID_TAXONOMY_CODE residual, never a silent drop, never an uncaught throw', async () => {
  const fixture = buildQxoNativeProducerProposals();
  const invalid = fixture.proposals.find((p) => p.ordinal === 2);
  assert.ok(invalid, 'fixture must include the deliberately-invalid taxonomy-code proposal');

  const { proposals, producer_receipt } = await receiptFor([invalid]);

  const candidate = compileCandidateProposal({
    proposal: proposals[0],
    governed_scope: GOVERNED_SCOPE,
    producer_receipt,
    extractor_id: 'native-producer-batch1',
    extractor_version: 'v1',
  });

  assert.equal(candidate.claim.publication_state, 'QUARANTINED');
  assert.equal(candidate.claim.taxonomy_codes.accuracy_standard, 'NOT_A_REAL_CODE', 'the unrecognised code is retained on the row, not silently dropped');
  const residual = candidate.claim.retained_residuals.find((entry) => entry.reason === 'INVALID_TAXONOMY_CODE');
  assert.ok(residual, 'the unrecognised taxonomy code must surface as a typed residual');
  assert.equal(residual.dimension, 'accuracy_standard');
});

test('a proposal with both an unknown attribute and an unknown code compiles once, carrying both residuals, and never throws', async () => {
  const source = buildQxoNativeProducerFixtureSource();
  const fixture = buildQxoNativeProducerProposals({ source, contractBundle: CONTRACT_BUNDLE });
  const base = fixture.proposals[1];
  const doublyMalformed = {
    ...base,
    ordinal: 98,
    attributes: { ...base.attributes, extractor_scratch_note: 'unverified' },
    taxonomy_codes: { accuracy_standard: 'ANOTHER_BOGUS_CODE' },
  };

  const { proposals, producer_receipt } = await receiptFor([doublyMalformed]);

  let candidate;
  assert.doesNotThrow(() => {
    candidate = compileCandidateProposal({
      proposal: proposals[0],
      governed_scope: GOVERNED_SCOPE,
      producer_receipt,
      extractor_id: 'native-producer-batch1',
      extractor_version: 'v1',
    });
  });

  assert.equal(candidate.claim.publication_state, 'QUARANTINED');
  const reasons = candidate.claim.retained_residuals.map((entry) => entry.reason).sort();
  assert.deepEqual(reasons, ['INVALID_TAXONOMY_CODE', 'UNKNOWN_ATTRIBUTE']);
});

test('batch compilation never lets a schema-closure residual escape as an uncaught exception', async () => {
  const fixture = buildQxoNativeProducerProposals();
  const base = fixture.proposals[0];
  const malformed = { ...base, ordinal: 97, attributes: { ...base.attributes, unexpected: true } };

  const { proposals, producer_receipt } = await receiptFor([malformed, fixture.proposals[3]]);

  const results = compileCandidateProposals({
    proposals,
    governed_scope: GOVERNED_SCOPE,
    producer_receipt,
    extractor_id: 'native-producer-batch1',
    extractor_version: 'v1',
  });

  assert.equal(results.length, 2);
  assert.ok(results.every((entry) => entry.ok), 'schema-closure violations quarantine, they do not reject the proposal');
});
