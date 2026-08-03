'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compileFixtureContractV20 } = require('../lib/canonical-v2/contract-bundle');
const { parseDivestitureCapAmount, parseFilingDeadlineDays, ANTITRUST_REGULATORY_PARSE_VERSION } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-parse');
const { buildAntitrustRegulatoryProducerPrompt } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt');
const { shapeRegulatoryEffortsProposals, REGULATORY_EFFORTS_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { GENERIC_CLAIM_KEY_RESOLUTION_TABLE, MATERIALITY_TABLE, MAPPING_TABLE_VERSION, regulatoryValueCorroborated, regulatoryFilingRegimeCorroborated } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { LEXICAL_FAMILY_LEXICON, LEXICAL_FAMILY_LEXICON_VERSION, validateLexicalFamilyLexicon } = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');

test('antitrust parser preserves scaled-money safety and exact literal money', () => {
  assert.deepEqual(parseDivestitureCapAmount('greater than $700 million in lost value'), { outcome: 'ABSTAIN', reason: 'SCALED_MONEY_LITERAL' });
  assert.equal(parseDivestitureCapAmount('$326,000,000').canonical_value, '326000000');
  assert.equal(parseDivestitureCapAmount('$1 and $2').reason, 'MULTIPLE_MONEY_LITERALS');
  assert.equal(parseDivestitureCapAmount('one hundred dollars').reason, 'NON_LITERAL_MONEY');
  assert.equal(parseDivestitureCapAmount('€10').reason, 'NON_USD_CURRENCY');
  assert.equal(parseDivestitureCapAmount('$12,34').reason, 'MALFORMED_GROUPING');
});

test('antitrust parser resolves one literal deadline and abstains on non-literal or compound counts', () => {
  assert.equal(parseFilingDeadlineDays('within ten (10) Business Days').canonical_value, '10');
  assert.equal(parseFilingDeadlineDays('within fifteen (15) Business Days').canonical_value, '15');
  assert.equal(parseFilingDeadlineDays('within thirty (30) business days').canonical_value, '30');
  assert.equal(parseFilingDeadlineDays('within twenty five Business Days').reason, 'NON_LITERAL_NUMERAL');
  assert.equal(parseFilingDeadlineDays('within ten (45) Business Days').reason, 'SPELLED_DIGIT_MISMATCH');
  assert.equal(parseFilingDeadlineDays('within 10 Business Days and 45 Business Days').reason, 'MULTIPLE_DAY_COUNTS');
  assert.equal(ANTITRUST_REGULATORY_PARSE_VERSION, 1);
});

test('registry, resolver seam and materiality tier include the M3-B antitrust shapes', () => {
  const bundle = compileFixtureContractV20();
  const burden = bundle.claim_definitions.find((definition) => definition.claim_definition_key === 'REGULATORY_BURDEN_COMMITMENT');
  assert.equal(burden.allowed_canonical_values.length, 6);
  assert.equal(burden.allowed_canonical_values.includes('SILENT_NO_CAP'), false);
  assert.equal(burden.allowed_canonical_values.includes('SILENT'), false);
  const row = GENERIC_CLAIM_KEY_RESOLUTION_TABLE.find((entry) => entry.generic_claim_key === REGULATORY_EFFORTS_CLAIM_KEY);
  assert.deepEqual(row && { concept_key: row.concept_key, registered_claim_definition_key: row.registered_claim_definition_key, party_field: row.party_field }, { concept_key: null, registered_claim_definition_key: null, party_field: 'obligor_party' });
  assert.equal(MAPPING_TABLE_VERSION, 10);
  assert.deepEqual(MATERIALITY_TABLE.find((tier) => tier.label === 'REGULATORY_EFFORTS'), { rank: 65, label: 'REGULATORY_EFFORTS', concept_key_prefixes: ['ANTI-'] });
});

test('prompt and provider shaping retain a single evidenced regulatory assertion', () => {
  const quote = 'Each of Parent and the Company shall use reasonable best efforts to obtain all approvals.';
  const prompt = buildAntitrustRegulatoryProducerPrompt({ source_text: quote, governed_scope: {} });
  assert.equal(prompt.prompt_id, 'native-producer-antitrust-regulatory/v1');
  assert.equal(prompt.prompt_version, 2);
  const shaped = shapeRegulatoryEffortsProposals({ regulatory_efforts_assertions: [{ section_reference: '6.1', assertion_kind: 'EFFORTS_STANDARD', canonical_value: 'REASONABLE_BEST_EFFORTS', obligor_party_scope: 'MUTUAL', obligor_party: 'Each of Parent and the Company', quote }], open_world_candidates: [] }, quote);
  assert.equal(shaped.proposals.length, 1);
  assert.equal(shaped.proposals[0].claim_definition_key, REGULATORY_EFFORTS_CLAIM_KEY);
});

test('M3-B shapes separate timing-agreement, withdrawal/refiling, strategy, consultation, foreign-filing and non-impediment assertions', () => {
  const quote = 'Parent shall control the regulatory strategy and shall not enter into any timing agreement without the Company\'s prior written consent.';
  const shaped = shapeRegulatoryEffortsProposals({ regulatory_efforts_assertions: [
    { section_reference: '6.1', assertion_kind: 'TIMING_AGREEMENT_RESTRICTION', canonical_value: 'NOT_UNREASONABLY_WITHHELD', obligor_party_scope: 'ONE_PARTY', obligor_party: 'Parent', quote },
    { section_reference: '6.1', assertion_kind: 'STRATEGY_CONTROL', canonical_value: 'PARENT_CONTROL', obligor_party_scope: 'ONE_PARTY', obligor_party: 'Parent', quote },
  ], open_world_candidates: [] }, quote);
  assert.equal(shaped.proposals.length, 2);
  assert.deepEqual(shaped.proposals.map((proposal) => proposal.attributes.assertion_kind), ['TIMING_AGREEMENT_RESTRICTION', 'STRATEGY_CONTROL']);
});

test('M3-B corroboration requires distinct grounded antitrust facts', () => {
  assert.equal(regulatoryValueCorroborated('TIMING_AGREEMENT_RESTRICTION', 'NOT_UNREASONABLY_WITHHELD', "Parent shall not enter into any timing agreement without the Company's prior written consent, not to be unreasonably withheld."), true);
  assert.equal(regulatoryValueCorroborated('WITHDRAWAL_REFILING_RESTRICTION', 'MUTUAL_CONSENT', 'Neither party shall withdraw and refile without the consent of the other.'), true);
  assert.equal(regulatoryValueCorroborated('STRATEGY_CONTROL', 'PARENT_CONTROL', 'Parent shall control the regulatory strategy.'), true);
  assert.equal(regulatoryValueCorroborated('CONSULTATION_RIGHT', 'GOOD_FAITH_VIEWS', 'Parent shall consider in good faith the views of the Company.'), true);
  assert.equal(regulatoryValueCorroborated('NON_IMPEDIMENT_COVENANT', true, 'Parent shall not take any action that would prevent or delay consummation of the transactions.'), true);
  assert.equal(regulatoryValueCorroborated('STRATEGY_CONTROL', 'PARENT_CONTROL', 'Parent and the Company shall cooperate.'), false);
  assert.equal(regulatoryFilingRegimeCorroborated('Foreign Competition Act', 'Parent shall file under the Foreign Competition Act.'), true);
  assert.equal(regulatoryFilingRegimeCorroborated('HSR Act and Foreign Competition Act', 'Parent shall file under the HSR Act and Foreign Competition Act.'), false);
});

test('antitrust lexical entries are registered and include the bounded family set', () => {
  const registered = new Set(compileFixtureContractV20().concepts.map((concept) => concept.concept_key));
  assert.doesNotThrow(() => validateLexicalFamilyLexicon(LEXICAL_FAMILY_LEXICON, { registeredConceptKeys: registered }));
  assert.equal(LEXICAL_FAMILY_LEXICON_VERSION, 6);
  for (const family of ['ANTI-EFFORTS', 'ANTI-BURDEN', 'ANTI-LITIGATION', 'ANTI-TIMING', 'ANTI-FILING']) {
    assert.ok(LEXICAL_FAMILY_LEXICON.entries.some((entry) => entry.family === family), family);
  }
});
