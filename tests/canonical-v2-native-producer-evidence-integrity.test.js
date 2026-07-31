const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const { compileCandidateProposals } = require('../lib/canonical-v2/native-producer/candidate-proposal-compiler');
const {
  buildQxoNativeProducerFixtureSource,
  buildQxoNativeProducerProposals,
} = require('./fixtures/canonical-v2/qxo-native-producer-proposals');

const CONTRACT_BUNDLE = compileFixtureContract();
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'deal:qxo-topbuild',
  governed_intervals: ['CAPITAL_STRUCTURE', 'SECTION_5_2'],
});
const DEFINITIONS = Object.freeze({ claim_definition_keys: ['NATIVE_CAPITALISATION_ACCURACY_CANDIDATE'] });

// Byte-slice the admitted source text at an evidence edge's own recorded
// offsets -- the same admitted-source fixture path (real QXO section
// 3.1(b)/5.2 text, placed at the governed CAPITAL_STRUCTURE_INTERVAL /
// SECTION_5_2_INTERVAL byte offsets) that the existing reviewed-qxo-*
// capitalisation tests exercise.
function sliceSourceAt(source, absoluteStart, absoluteEnd) {
  return Buffer.from(source.canonical_text.text, 'utf8')
    .subarray(absoluteStart, absoluteEnd)
    .toString('utf8');
}

test('every compiled candidate\'s evidence byte-slices back to its claimed raw value exactly', async () => {
  const source = buildQxoNativeProducerFixtureSource();
  const fixture = buildQxoNativeProducerProposals({ source, contractBundle: CONTRACT_BUNDLE });

  const { proposals, producer_receipt } = await produceCandidateProposals({
    governed_scope: GOVERNED_SCOPE,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    provider: async () => ({
      provider_id: 'fixture-recorded',
      model_id: 'recorded-fixture-v1',
      prompt: 'qxo-capitalisation-native-producer-fixture-v1',
      proposals: fixture.proposals,
    }),
  });

  const results = compileCandidateProposals({
    proposals,
    governed_scope: GOVERNED_SCOPE,
    producer_receipt,
    extractor_id: 'native-producer-batch1',
    extractor_version: 'v1',
  });

  assert.equal(results.length, 5);
  assert.ok(results.every((entry) => entry.ok), 'every fixture proposal is expected to compile (some quarantined, none rejected)');

  let checked = 0;
  for (const { candidate } of results) {
    const row = candidate[candidate.kind];
    assert.ok(Array.isArray(row.evidence) && row.evidence.length > 0, 'compiled candidate carries at least one evidence edge');
    for (const edge of row.evidence) {
      const sliced = sliceSourceAt(source, edge.absolute_start, edge.absolute_end);
      assert.equal(sliced, row.raw_value, `evidence byte-slice must reproduce raw_value exactly for ${row.claim_definition_key || row.relationship_definition_key} ordinal ${row.ordinal}`);
      checked += 1;
    }
  }
  assert.equal(checked, 5, 'expected exactly one evidence edge checked per fixture proposal');
});

test('evidence offsets are real byte positions inside the governed capitalisation intervals, not placeholders', () => {
  const source = buildQxoNativeProducerFixtureSource();
  const fixture = buildQxoNativeProducerProposals({ source, contractBundle: CONTRACT_BUNDLE });

  for (const proposal of fixture.proposals) {
    for (const edge of proposal.evidence) {
      assert.ok(edge.absolute_start >= 0);
      assert.ok(edge.absolute_end > edge.absolute_start);
      assert.ok(edge.absolute_end <= Buffer.byteLength(source.canonical_text.text, 'utf8'));
      const sliced = sliceSourceAt(source, edge.absolute_start, edge.absolute_end);
      assert.equal(sliced, proposal.raw_value);
    }
  }
});
