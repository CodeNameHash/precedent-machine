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
const DEFINITIONS = Object.freeze({ claim_definition_keys: ['NATIVE_CAPITALISATION_ACCURACY_CANDIDATE'] });

// Mirrors the drop rule validate-write-set.js applies around its
// `quarantinedClosureIds` pass (~line 2091/2110-2114): any row whose
// closure_id appears in the quarantined set is excluded from the
// publishable write set; every other row survives untouched. We don't
// invoke validate-write-set.js itself here (out of scope for this batch,
// and it requires a full admittedSources/contractVocabulary rig) -- we
// assert the invariant our compiler is responsible for supplying it:
// distinct closure_id per independently-produced candidate.
function applyClosureQuarantineDropRule(compiledRows) {
  const quarantinedClosureIds = new Set(
    compiledRows.filter((row) => row.publication_state === 'QUARANTINED').map((row) => row.closure_id),
  );
  return compiledRows.filter((row) => !quarantinedClosureIds.has(row.closure_id));
}

test('a proposal with an unknown taxonomy code is quarantined without rejecting the batch', async () => {
  const fixture = buildQxoNativeProducerProposals();
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
  assert.ok(results.every((entry) => entry.ok), 'an unknown taxonomy code is a quarantine, not a compiler rejection');

  const rows = results.map((entry) => entry.candidate[entry.candidate.kind]);
  const quarantined = rows.filter((row) => row.publication_state === 'QUARANTINED');
  const validated = rows.filter((row) => row.publication_state === 'VALIDATED');

  assert.equal(quarantined.length, 1, 'exactly the deliberately-invalid proposal is quarantined');
  assert.equal(validated.length, 4, 'the three valid positives and the open-world candidate stay clean');
  assert.ok(
    quarantined[0].retained_residuals.some((residual) => residual.reason === 'INVALID_TAXONOMY_CODE'),
    'the quarantine reason is the unknown taxonomy code, not something else',
  );
});

test('every candidate carries its own closure_id -- no two candidates ever share one', async () => {
  const fixture = buildQxoNativeProducerProposals();
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

  const closureIds = results.map((entry) => entry.candidate[entry.candidate.kind].closure_id);
  assert.equal(closureIds.length, 5);
  assert.equal(new Set(closureIds).size, 5, 'closure_id must be unique per independently-produced candidate');
});

test('quarantining one closure never touches its siblings\' bytes, and dropping it by closure_id leaves every sibling intact', async () => {
  const fixture = buildQxoNativeProducerProposals();
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
  const rows = results.map((entry) => entry.candidate[entry.candidate.kind]);

  const before = rows
    .filter((row) => row.publication_state === 'VALIDATED')
    .map((row) => canonicalJson(row))
    .sort();

  const survivors = applyClosureQuarantineDropRule(rows);
  const after = survivors.map((row) => canonicalJson(row)).sort();

  assert.equal(survivors.length, 4, 'only the one quarantined closure is dropped');
  assert.deepEqual(after, before, 'surviving rows are byte-identical to their pre-drop form: the drop touches nothing but the bad closure');
  assert.ok(
    survivors.every((row) => row.publication_state === 'VALIDATED'),
    'no VALIDATED row was caught up in the QUARANTINED closure',
  );
});
