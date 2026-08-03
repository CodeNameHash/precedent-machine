'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compileFixtureContractV19 } = require('../lib/canonical-v2/contract-bundle');
const { parseDivestitureCapAmount, parseFilingDeadlineDays, ANTITRUST_REGULATORY_PARSE_VERSION } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-parse');
const { buildAntitrustRegulatoryProducerPrompt } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt');
const { shapeRegulatoryEffortsProposals, REGULATORY_EFFORTS_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { GENERIC_CLAIM_KEY_RESOLUTION_TABLE, MATERIALITY_TABLE, MAPPING_TABLE_VERSION } = require('../lib/canonical-v2/native-producer/candidate-resolution');
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

test('registry, resolver seam and materiality tier are bounded to the six approved shapes', () => {
  const bundle = compileFixtureContractV19();
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
  const shaped = shapeRegulatoryEffortsProposals({ regulatory_efforts_assertions: [{ section_reference: '6.1', assertion_kind: 'EFFORTS_STANDARD', canonical_value: 'REASONABLE_BEST_EFFORTS', obligor_party_scope: 'MUTUAL', obligor_party: 'Each of Parent and the Company', quote }], open_world_candidates: [] }, quote);
  assert.equal(shaped.proposals.length, 1);
  assert.equal(shaped.proposals[0].claim_definition_key, REGULATORY_EFFORTS_CLAIM_KEY);
});

test('antitrust lexical entries are registered and include the bounded family set', () => {
  const registered = new Set(compileFixtureContractV19().concepts.map((concept) => concept.concept_key));
  assert.doesNotThrow(() => validateLexicalFamilyLexicon(LEXICAL_FAMILY_LEXICON, { registeredConceptKeys: registered }));
  assert.equal(LEXICAL_FAMILY_LEXICON_VERSION, 6);
  for (const family of ['ANTI-EFFORTS', 'ANTI-BURDEN', 'ANTI-LITIGATION', 'ANTI-TIMING', 'ANTI-FILING']) {
    assert.ok(LEXICAL_FAMILY_LEXICON.entries.some((entry) => entry.family === family), family);
  }
});
