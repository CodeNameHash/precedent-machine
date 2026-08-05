'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContractV21 } = require('../lib/canonical-v2/contract-bundle');
const {
  CONTROLLED_VOCABULARIES,
  PROMPT_VERSION,
  buildNoShopProducerPrompt,
} = require('../lib/canonical-v2/native-producer/no-shop-producer-prompt');
const {
  NO_SHOP_WAVE_B_CLAIM_KEY,
  shapeNoShopProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  noShopWaveBValueCorroborated,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

test('F21 registers the bounded No-Shop Wave B concepts and claims', () => {
  const bundle = compileFixtureContractV21();
  const concepts = new Set(bundle.concepts.map((entry) => entry.concept_key));
  for (const key of ['NOSOL-CEASE', 'NOSOL-ENFORCE', 'NOSOL-WAIVER', 'NOSOL-RECOMMEND']) {
    assert.equal(concepts.has(key), true, key);
  }
  const claims = new Map(bundle.claim_definitions.map((entry) => [entry.claim_definition_key, entry]));
  for (const key of [
    'NO_SHOP_CEASE_ACTION',
    'NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD',
    'NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION',
    'NO_SHOP_STANDSTILL_ACTION',
    'NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD',
    'NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD',
    'NO_SHOP_RECOMMENDATION_CHANGE_ACTION',
    'NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER',
    'NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE',
  ]) assert.ok(claims.has(key), key);
});

test('Wave B prompt makes the new positive arrays explicit and keeps definitions with their owner family', () => {
  const prompt = buildNoShopProducerPrompt({ source_text: 'the Company shall immediately cease discussions.', governed_scope: {} });
  assert.equal(PROMPT_VERSION, 3);
  assert.match(prompt.messages[0].content, /cease_assertions/);
  assert.match(prompt.messages[0].content, /standstill_assertions/);
  assert.match(prompt.messages[0].content, /fiduciary_standard_assertions/);
  assert.match(prompt.messages[0].content, /recommendation_assertions/);
  assert.match(prompt.messages[0].content, /defined-terms producer/i);
  assert.match(prompt.messages[0].content, /SECTION REFERENCE/);
  assert.match(prompt.messages[0].content, /COVERAGE CHECK BEFORE YOU RETURN/);
  assert.ok(CONTROLLED_VOCABULARIES.WAVE_B_ASSERTION_KIND.includes('CEASE_ACTION'));
});

test('provider shapes each Wave B assertion into one generic evidenced candidate', () => {
  const quotes = [
    'the Company shall immediately cease all discussions or negotiations.',
    'The Company shall enforce each standstill agreement.',
    'the Company Board determines that the proposal could reasonably be expected to lead to a Superior Proposal.',
    'the Company Board may withdraw or modify the Company Recommendation.',
  ];
  const source = quotes.join(' ');
  const shaped = shapeNoShopProposals({
    no_shop_action_assertions: [], exception_prerequisite_assertions: [], period_assertions: [],
    cease_assertions: [{ section_reference: '5.2', assertion_kind: 'CEASE_ACTION', canonical_value: 'CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS', covenant_obligor: 'the Company', quote: quotes[0] }],
    standstill_assertions: [{ section_reference: '5.2', assertion_kind: 'STANDSTILL_ACTION', canonical_value: 'ENFORCE', covenant_obligor: 'The Company', quote: quotes[1] }],
    fiduciary_standard_assertions: [{ section_reference: '5.2', assertion_kind: 'FIDUCIARY_ENGAGEMENT_STANDARD', canonical_value: 'COULD_REASONABLY_BE_EXPECTED_TO_LEAD', covenant_obligor: 'the Company Board', quote: quotes[2] }],
    recommendation_assertions: [{ section_reference: '5.2', assertion_kind: 'RECOMMENDATION_CHANGE_ACTION', canonical_value: 'WITHDRAW_QUALIFY_OR_MODIFY_RECOMMENDATION', covenant_obligor: 'the Company Board', quote: quotes[3] }],
    open_world_candidates: [],
  }, source);
  assert.equal(shaped.proposals.length, 4);
  assert.ok(shaped.proposals.every((proposal) => proposal.claim_definition_key === NO_SHOP_WAVE_B_CLAIM_KEY));
});

test('Wave B corroboration accepts grounded values and rejects adjacent label drift', () => {
  assert.equal(noShopWaveBValueCorroborated('CEASE_ACTION', 'CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS', 'the Company shall immediately cease all discussions or negotiations.'), true);
  assert.equal(noShopWaveBValueCorroborated('REPRESENTATIVE_BREACH_ATTRIBUTION', true, 'Any violation by a Representative shall be deemed a breach by the Company.'), true);
  assert.equal(noShopWaveBValueCorroborated('STANDSTILL_ACTION', 'PERMIT_WAIVER_FIDUCIARY_DUTY_GATED', 'The Company may waive a standstill if failure to do so would be inconsistent with the directors\' fiduciary duties.'), true);
  assert.equal(noShopWaveBValueCorroborated('FIDUCIARY_ENGAGEMENT_STANDARD', 'COULD_REASONABLY_BE_EXPECTED_TO_LEAD', 'could reasonably be expected to lead to a Superior Proposal'), true);
  assert.equal(noShopWaveBValueCorroborated('RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD', 'INCONSISTENT_WITH_FIDUCIARY_DUTIES', 'failure to act would be inconsistent with the directors\' fiduciary duties'), true);
  assert.equal(noShopWaveBValueCorroborated('RECOMMENDATION_CHANGE_ACTION', 'FAIL_TO_INCLUDE_RECOMMENDATION', 'fail to include the Company Recommendation in the Proxy Statement'), true);
  assert.equal(noShopWaveBValueCorroborated('RECOMMENDATION_SAFE_DISCLOSURE', 'STOP_LOOK_AND_LISTEN', 'a stop, look and listen communication under Rule 14d-9(f)'), true);
  assert.equal(noShopWaveBValueCorroborated('STANDSTILL_ACTION', 'ENFORCE', 'the Company may waive a standstill'), false);
});
