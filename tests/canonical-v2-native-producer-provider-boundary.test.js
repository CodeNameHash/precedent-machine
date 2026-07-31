const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const {
  CandidateProposalRejectedError,
  compileCandidateProposal,
} = require('../lib/canonical-v2/native-producer/candidate-proposal-compiler');
const {
  CLAIM_DEFINITION_KEY,
  buildQxoNativeProducerProposals,
} = require('./fixtures/canonical-v2/qxo-native-producer-proposals');

const CONTRACT_BUNDLE = compileFixtureContract();
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'deal:qxo-topbuild',
  governed_intervals: ['CAPITAL_STRUCTURE', 'SECTION_5_2'],
});
const DEFINITIONS = Object.freeze({ claim_definition_keys: [CLAIM_DEFINITION_KEY] });

async function genuineReceipt(proposals) {
  return produceCandidateProposals({
    governed_scope: GOVERNED_SCOPE,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    provider: async () => ({
      provider_id: 'fixture-recorded',
      model_id: 'recorded-fixture-v1',
      prompt: 'qxo-native-producer-provider-boundary-fixture-v1',
      proposals,
    }),
  });
}

test('genuine provider output compiles: a receipt minted by produceCandidateProposals is accepted', async () => {
  const fixture = buildQxoNativeProducerProposals();
  const { proposals, producer_receipt } = await genuineReceipt([fixture.proposals[0]]);

  assert.doesNotThrow(() => compileCandidateProposal({
    proposal: proposals[0],
    governed_scope: GOVERNED_SCOPE,
    producer_receipt,
    extractor_id: 'native-producer-batch1',
    extractor_version: 'v1',
  }));
});

test('a proposal with no producer_receipt at all is rejected, not compiled', async () => {
  const fixture = buildQxoNativeProducerProposals();

  assert.throws(
    () => compileCandidateProposal({
      proposal: fixture.proposals[0],
      governed_scope: GOVERNED_SCOPE,
      producer_receipt: undefined,
      extractor_id: 'native-producer-batch1',
      extractor_version: 'v1',
    }),
    (error) => {
      assert.ok(error instanceof CandidateProposalRejectedError);
      assert.equal(error.reason_code, 'MISSING_PRODUCER_RECEIPT');
      return true;
    },
  );
});

test('a hand-authored payload that merely fabricates a producer_receipt-shaped object is rejected', async () => {
  const fixture = buildQxoNativeProducerProposals();
  const { producer_receipt: genuine } = await genuineReceipt([fixture.proposals[0]]);

  // Same shape, same schema_version, but the id has been hand-typed rather
  // than derived from the receipt's own content -- this is exactly the
  // "hand-authored payload" the compiler must refuse to compile.
  const forgedReceipt = {
    ...genuine,
    producer_receipt_id: 'a'.repeat(64),
  };

  assert.throws(
    () => compileCandidateProposal({
      proposal: fixture.proposals[0],
      governed_scope: GOVERNED_SCOPE,
      producer_receipt: forgedReceipt,
      extractor_id: 'native-producer-batch1',
      extractor_version: 'v1',
    }),
    (error) => {
      assert.ok(error instanceof CandidateProposalRejectedError);
      assert.equal(error.reason_code, 'INVALID_PRODUCER_RECEIPT');
      return true;
    },
  );
});

test('a receipt missing the NATIVE_PRODUCER_RECEIPT/V1 schema_version is rejected', () => {
  const fixture = buildQxoNativeProducerProposals();

  assert.throws(
    () => compileCandidateProposal({
      proposal: fixture.proposals[0],
      governed_scope: GOVERNED_SCOPE,
      producer_receipt: { schema_version: 'SOMETHING_ELSE/V1', producer_receipt_id: 'b'.repeat(64) },
      extractor_id: 'native-producer-batch1',
      extractor_version: 'v1',
    }),
    (error) => {
      assert.ok(error instanceof CandidateProposalRejectedError);
      assert.equal(error.reason_code, 'INVALID_PRODUCER_RECEIPT');
      return true;
    },
  );
});

for (const disallowedState of ['ABSENT', 'NOT_APPLICABLE']) {
  test(`a proposal asserting ${disallowedState} is rejected even when bound to a genuine producer receipt`, async () => {
    const fixture = buildQxoNativeProducerProposals();
    const base = fixture.proposals[0];
    const disallowed = {
      ...base,
      ordinal: 96,
      state: disallowedState,
      raw_value: undefined,
      canonical_value: undefined,
    };
    const { proposals, producer_receipt } = await genuineReceipt([disallowed]);

    assert.throws(
      () => compileCandidateProposal({
        proposal: proposals[0],
        governed_scope: GOVERNED_SCOPE,
        producer_receipt,
        extractor_id: 'native-producer-batch1',
        extractor_version: 'v1',
      }),
      (error) => {
        assert.ok(error instanceof CandidateProposalRejectedError);
        assert.equal(error.reason_code, 'DISALLOWED_PROPOSAL_STATE');
        return true;
      },
    );
  });
}
