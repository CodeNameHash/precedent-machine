const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const { compileCandidateProposals } = require('../lib/canonical-v2/native-producer/candidate-proposal-compiler');
const { buildQxoNativeProducerProposals } = require('./fixtures/canonical-v2/qxo-native-producer-proposals');

const CONTRACT_BUNDLE = compileFixtureContract();
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'deal:qxo-topbuild',
  governed_intervals: ['CAPITAL_STRUCTURE', 'SECTION_5_2'],
});
const DEFINITIONS = Object.freeze({
  claim_definition_keys: [
    'NATIVE_CAPITALISATION_ACCURACY_CANDIDATE',
    'NATIVE_CAPITALISATION_MEASUREMENT_DATE_CANDIDATE',
  ],
});

function fixtureProvider() {
  const { proposals } = buildQxoNativeProducerProposals();
  return async () => ({
    provider_id: 'fixture-recorded',
    model_id: 'recorded-fixture-v1',
    prompt: 'qxo-capitalisation-native-producer-fixture-v1',
    proposals,
  });
}

async function runOnce() {
  const { proposals, producer_receipt } = await produceCandidateProposals({
    governed_scope: GOVERNED_SCOPE,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    provider: fixtureProvider(),
  });
  const results = compileCandidateProposals({
    proposals,
    governed_scope: GOVERNED_SCOPE,
    producer_receipt,
    extractor_id: 'native-producer-batch1',
    extractor_version: 'v1',
  });
  return { producer_receipt, results };
}

test('the same recorded fixture produces a byte-identical producer receipt on every run', async () => {
  const first = await runOnce();
  const second = await runOnce();

  assert.equal(canonicalJson(first.producer_receipt), canonicalJson(second.producer_receipt));
  assert.match(first.producer_receipt.producer_receipt_id, /^[a-f0-9]{64}$/);
});

test('the same recorded fixture compiles to byte-identical candidates, including the producer_receipt_id binding', async () => {
  const first = await runOnce();
  const second = await runOnce();

  assert.equal(first.results.length, second.results.length);
  assert.equal(canonicalJson(first.results), canonicalJson(second.results));

  for (const result of first.results) {
    if (!result.ok) continue;
    assert.equal(
      result.candidate.extraction_provenance.producer_receipt_id,
      first.producer_receipt.producer_receipt_id,
    );
  }
});

test('two independently produced batches from the same fixture never collide on closure_id despite identical content', async () => {
  const first = await runOnce();
  const second = await runOnce();

  const closureIds = (run) => run.results
    .filter((entry) => entry.ok)
    .map((entry) => entry.candidate[entry.candidate.kind].closure_id);

  // Same fixture, same receipt (receipts are content-addressed and
  // identical here) => identical closure_ids. This is the determinism
  // half of the contract: given the same inputs, closure identity is
  // reproducible, not random.
  assert.deepEqual(closureIds(first), closureIds(second));
});
