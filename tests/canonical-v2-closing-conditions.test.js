'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileFixtureContractV23, compileFixtureContractV24 } = require('../lib/canonical-v2/contract-bundle');
const { classifySectionFamily, SECTION_FAMILY_RULE_CLASSIFIED } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { buildClosingConditionsProducerPrompt, PROMPT_VERSION } = require('../lib/canonical-v2/native-producer/closing-conditions-producer-prompt');
const { shapeClosingConditionProposals, CLOSING_CONDITION_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const { compileCandidateProposals } = require('../lib/canonical-v2/native-producer/candidate-proposal-compiler');
const { CLOSING_CONDITION_SURFACE_OWNERSHIP, OPEN_WORLD_SURFACE_GAPS } = require('../lib/canonical-v2/native-producer/closing-conditions-parity');

const QUOTE = 'there shall not have occurred a Company Material Adverse Effect that is continuing';

test('closing conditions have a separate v23 vocabulary', () => {
  const bundle = compileFixtureContractV23();
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
  assert.equal(prompt.prompt_id, 'native-producer-closing-conditions/v3');
  const shaped = shapeClosingConditionProposals({ closing_condition_assertions: [{ section_reference: '7.2', assertion_kind: 'MAE_CONTINUING', mae_term: 'Company Material Adverse Effect', mae_party: 'TARGET', quote: QUOTE }], open_world_candidates: [] }, QUOTE);
  assert.equal(shaped.proposals.length, 1);
  assert.equal(shaped.proposals[0].claim_definition_key, CLOSING_CONDITION_CLAIM_KEY);
  assert.equal(shaped.proposals[0].raw_value, QUOTE);
});

test('closing-condition prompt limits the closed accuracy vocabulary and obligor requirement to bring-down tiers', () => {
  const prompt = buildClosingConditionsProducerPrompt({ source_text: QUOTE, governed_scope: { section_reference: '7.2' } });
  assert.equal(PROMPT_VERSION, 5);
  assert.equal(prompt.prompt_version, 5);
  assert.match(prompt.messages[0].content, /MAT_ALL_RESPECTS \| MAT_ALL_RESPECTS_DE_MINIMIS \| MAT_ALL_MATERIAL \| MAT_MAE_QUALIFIED/);
  assert.match(prompt.messages[0].content, /Only a BRING_DOWN_TIER requires a non-empty condition_obligor quoted in its own quote/);
  assert.match(prompt.messages[0].content, /For BRING_DOWN_TIER, accuracy_standard must be exactly one of those four values and may not be null/);
  assert.match(prompt.messages[0].content, /For every other assertion_kind, set accuracy_standard and condition_obligor to null/);
  assert.match(prompt.messages[0].content, /prevent or materially delay.*open_world_candidates/i);
});

test('live provider dispatches closing conditions through its own prompt and permits an omitted assertions array', async () => {
  let request;
  const provider = createAnthropicProvider({
    model: 'test', maxRetries: 0,
    client: { messages: { async create(value) { request = value; return { content: [{ text: JSON.stringify({ open_world_candidates: [] }) }] }; } } },
  });
  const result = await produceCandidateProposals({
    governed_scope: { deal_key: 'fixture', section_reference: '7.2', source_text: QUOTE },
    definitions: { known_definitions: [] },
    contract_bundle: compileFixtureContractV23(),
    section_family: 'CLOSING_CONDITIONS',
    provider,
  });
  assert.ok(request.messages[0].content.includes('closing_condition_assertions'));
  assert.equal(result.proposals.length, 0);
});

test('Wave B preserves certificate targets as verbatim section-reference relationships without resolving cited conditions', () => {
  const quote = 'The Company shall have delivered to Parent a certificate certifying that the conditions set forth in Sections 7.2(a), 7.2(b) and 7.2(c) have been satisfied.';
  const shaped = shapeClosingConditionProposals({
    closing_condition_assertions: [{
      section_reference: '7.2(d)', assertion_kind: 'OFFICER_CERTIFICATE',
      certificate_side: 'TARGET_CERTIFICATE', certifying_party: 'Company',
      certified_condition_refs: ['7.2(a)', '7.2(b)', '7.2(c)'], quote,
    }],
  }, quote);
  assert.equal(shaped.proposals.length, 1);
  assert.equal(shaped.proposals[0].attributes.certificate_relationship_status, 'VERBATIM_SECTION_REFERENCES');
  assert.deepEqual(shaped.proposals[0].attributes.certified_condition_refs, ['7.2(a)', '7.2(b)', '7.2(c)']);
});

test('Closing Conditions keep an explicit termination link only when the clause itself quotes it', () => {
  const quote = 'The condition in Section 7.2(a) shall be satisfied notwithstanding Section 8.1(b).';
  const shaped = shapeClosingConditionProposals({
    closing_condition_assertions: [{
      section_reference: '7.2(a)', assertion_kind: 'LEGAL_RESTRAINT', quote,
      related_clause_reference: '8.1(b)', cross_reference_quote: 'Section 8.1(b)',
    }],
  }, quote);
  assert.deepEqual(shaped.proposals[0].attributes.explicit_clause_cross_reference, {
    clause_reference: '8.1(b)', quote: 'Section 8.1(b)',
  });
});

test('the central compiler accepts Closing Conditions proposals end to end', async () => {
  const bundle = compileFixtureContractV24();
  const governedScope = { deal_key: 'fixture', source_text: QUOTE };
  const produced = await produceCandidateProposals({
    governed_scope: governedScope,
    definitions: { known_definitions: [] },
    contract_bundle: bundle,
    section_family: 'CLOSING_CONDITIONS',
    provider: async () => ({
      provider_id: 'closing-test/v2', model_id: 'stub', prompt: 'closing-test',
      ...shapeClosingConditionProposals({ closing_condition_assertions: [{
        section_reference: '7.2', assertion_kind: 'MAE_CONTINUING',
        mae_term: 'Company Material Adverse Effect', mae_party: 'TARGET', quote: QUOTE,
      }] }, QUOTE),
    }),
  });
  const compiled = compileCandidateProposals({
    proposals: produced.proposals,
    governed_scope: governedScope,
    producer_receipt: produced.producer_receipt,
    extractor_id: 'closing-test', extractor_version: '2',
  });
  assert.equal(compiled.length, 1);
  assert.equal(compiled[0].ok, true);
  assert.equal(compiled[0].candidate.extraction_provenance.proposal_kind, 'CLOSING_CONDITION');
});

test('Wave B retires dissent thresholds to exact open-world evidence and owns every grounded product surface', () => {
  const prompt = buildClosingConditionsProducerPrompt({ source_text: QUOTE, governed_scope: { section_reference: '7.2' } });
  assert.match(prompt.messages[0].content, /Dissent thresholds are retired as a comparable M3 field/);
  assert.ok(OPEN_WORLD_SURFACE_GAPS.some((row) => (
    row.item === 'DISSENT_THRESHOLD'
      && row.reason === 'APPROVED_M3_RETIRED_OPEN_WORLD'
      && row.reintroduction_requirement === 'STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL'
  )));
  for (const row of CLOSING_CONDITION_SURFACE_OWNERSHIP) {
    for (const surfacePath of Object.values(row.surfaces)) {
      assert.equal(fs.existsSync(path.resolve(__dirname, '..', surfacePath)), true, `${row.claim_definition_key}: ${surfacePath}`);
    }
  }
});
