'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compileFixtureContractV19 } = require('../lib/canonical-v2/contract-bundle');
const { classifySectionFamily, SECTION_FAMILY_RULE_CLASSIFIED } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { buildClosingConditionsProducerPrompt } = require('../lib/canonical-v2/native-producer/closing-conditions-producer-prompt');
const { shapeClosingConditionProposals, CLOSING_CONDITION_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');

const QUOTE = 'there shall not have occurred a Company Material Adverse Effect that is continuing';

test('closing conditions have a separate v19 vocabulary', () => {
  const bundle = compileFixtureContractV19();
  assert.ok(bundle.concepts.some((row) => row.concept_key === 'COND-MAE'));
  assert.ok(bundle.claim_definitions.some((row) => row.claim_definition_key === 'NO_MAE_CONDITION_CONTINUING'));
});

test('conditions-to-closing titles dispatch only to closing conditions', async () => {
  const result = await classifySectionFamily({ title: 'ARTICLE VII Conditions to Closing' });
  assert.equal(result.section_family, 'CLOSING_CONDITIONS');
  assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
});

test('closing-condition producer preserves a byte-exact positive candidate', () => {
  const prompt = buildClosingConditionsProducerPrompt({ source_text: QUOTE, governed_scope: { section_reference: '7.2' } });
  assert.equal(prompt.prompt_id, 'native-producer-closing-conditions/v1');
  const shaped = shapeClosingConditionProposals({ closing_condition_assertions: [{ section_reference: '7.2', assertion_kind: 'MAE_CONTINUING', mae_term: 'Company Material Adverse Effect', mae_party: 'TARGET', quote: QUOTE }], open_world_candidates: [] }, QUOTE);
  assert.equal(shaped.proposals.length, 1);
  assert.equal(shaped.proposals[0].claim_definition_key, CLOSING_CONDITION_CLAIM_KEY);
  assert.equal(shaped.proposals[0].raw_value, QUOTE);
});
