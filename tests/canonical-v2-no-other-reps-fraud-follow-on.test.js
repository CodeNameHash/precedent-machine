'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GENERIC_KEYS,
  RESPONSE_LISTS,
  buildNoOtherRepsFraudProducerPrompt,
  shapeNoOtherRepsFraudProposals,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-producer');
const {
  CLAIM_DEFINITIONS,
  ELEMENTS,
  OWNER_FAMILY,
  REMEDIES_OWNER_FAMILY,
  WILLFUL_BREACH_OWNER_FAMILY,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-contract');
const {
  resolveNoOtherRepsFraudProposals,
} = require('../lib/canonical-v2/native-producer/no-other-reps-fraud-resolution');
const {
  projectNoOtherRepsFraudProduct,
} = require('../lib/canonical-v2/no-other-reps-fraud-product-projection');
const {
  classifySectionFamily,
  SECTION_FAMILY_RULE_CLASSIFIED,
} = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { fieldsForCompareCell } = require('../lib/query/render/deal-compare-cell-fields');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const fs = require('node:fs');
const path = require('node:path');

const TARGET_NO_OTHER = 'The Company acknowledges that Parent has not made any representation other than those expressly set forth in this Agreement.';
const BUYER_NON_RELIANCE = 'Parent acknowledges that it is not relying on any representation by the Company except those expressly set forth in this Agreement, including projections or data-room materials.';
const BUYER_INDEPENDENT = 'Parent has conducted its own independent investigation of the Company.';
const FRAUD = 'Nothing in this Section limits liability for Fraud.';
const WILLFUL = '“Willful Breach” means a deliberate act with actual knowledge that the act constitutes a material breach.';
const SOURCE = [TARGET_NO_OTHER, BUYER_NON_RELIANCE, BUYER_INDEPENDENT, FRAUD, WILLFUL].join('\n');

function parsedResponse() {
  return {
    no_other_reps_assertions: [{
      section_reference: '4.20', representation_side: 'TARGET', assertion_quote: TARGET_NO_OTHER,
      representation_maker_ref: 'Parent', agreement_scope_quote: 'other than those expressly set forth in this Agreement',
    }],
    non_reliance_assertions: [{
      section_reference: '4.20', representation_side: 'BUYER', assertion_quote: BUYER_NON_RELIANCE,
      relying_party_ref: 'Parent', disclaimed_representation_party_ref: 'the Company',
      agreement_scope_quote: 'except those expressly set forth in this Agreement',
      extra_contractual_scope_quote: 'including projections or data-room materials',
    }],
    independent_investigation_assertions: [{
      section_reference: '4.20', representation_side: 'BUYER', assertion_quote: BUYER_INDEPENDENT,
      investigating_party_ref: 'Parent',
    }],
    fraud_carveout_assertions: [{
      section_reference: '4.20', representation_side: 'BUYER', assertion_quote: FRAUD,
    }],
    willful_breach_definitions: [{
      section_reference: '9.13', definition_quote: WILLFUL, defined_term_ref: '“Willful Breach”',
    }],
    open_world_candidates: [{ observed_quote: FRAUD, why_unmapped: 'The fraud scope is not adjudicated.' }],
  };
}

test('producer prompt keeps fraud scope and remedy relationships out of structured output', () => {
  const prompt = buildNoOtherRepsFraudProducerPrompt({ source_text: SOURCE, governed_scope: { source_text: SOURCE } });
  assert.equal(prompt.prompt_id, 'native-producer-no-other-reps-fraud/v1');
  assert.match(prompt.messages[0].content, /Do not classify fraud type, fraud scope, available damages or legal effect/);
  assert.deepEqual(RESPONSE_LISTS, [
    'no_other_reps_assertions', 'non_reliance_assertions', 'independent_investigation_assertions',
    'fraud_carveout_assertions', 'willful_breach_definitions', 'open_world_candidates',
  ]);
});

test('producer shapes the six grounded claim types and preserves open-world evidence', () => {
  const shaped = shapeNoOtherRepsFraudProposals(parsedResponse(), SOURCE);
  assert.equal(shaped.proposals.length, 6);
  assert.deepEqual(new Set(shaped.proposals.map((proposal) => proposal.claim_definition_key)), new Set(Object.values(GENERIC_KEYS)));
  const extra = shaped.proposals.find((proposal) => proposal.claim_definition_key === GENERIC_KEYS.EXTRA_CONTRACTUAL);
  assert.equal(extra.raw_value, BUYER_NON_RELIANCE);
  assert.equal(extra.attributes.relying_party_ref, 'Parent');
  assert.equal(extra.attributes.extra_contractual_scope_quote, 'including projections or data-room materials');
  assert.equal(shaped.evidence_residuals.length, 1);
  assert.equal(shaped.evidence_residuals[0].reason, 'OPEN_WORLD_CANDIDATE');
  assert.equal(shaped.evidence_residuals[0].evidence.length, 1);
});

test('live provider runtime validates and shapes the family response', async () => {
  const client = {
    messages: {
      create: async () => ({ content: [{ text: JSON.stringify({ ...parsedResponse(), open_world_candidates: [] }) }] }),
    },
  };
  const provider = createAnthropicProvider({ client, maxRetries: 0 });
  const result = await provider({
    governed_scope: { source_text: SOURCE },
    definitions: {},
    section_family: 'NO_OTHER_REPS_FRAUD',
  });
  assert.equal(result.prompt_id, 'native-producer-no-other-reps-fraud/v1');
  assert.equal(result.proposals.length, 6);
  assert.equal(result.evidence_residuals.length, 0);
});

test('native extraction dispatch compiles every family proposal before dedicated resolution', async () => {
  const document = `Section 4.20 Acknowledgment of No Other Representations.\n\n${SOURCE}\n`;
  let captured = [];
  const receipt = await runNativeExtraction({
    source_text: document,
    document_hash: sha256Hex(document),
    section_references: ['4.20'],
    contract_bundle: compileFixtureContractV34(),
    definitions: {},
    section_family_classifier: classifySectionFamily,
    provider: async ({ governed_scope: governedScope, section_family: sectionFamily }) => {
      assert.equal(sectionFamily, 'NO_OTHER_REPS_FRAUD');
      captured = shapeNoOtherRepsFraudProposals({ ...parsedResponse(), open_world_candidates: [] }, governedScope.source_text).proposals;
      return {
        provider_id: 'no-other-reps-fraud-test/v1',
        model_id: 'stub-model',
        prompt: 'no-other-reps-fraud-test-prompt/v1',
        proposals: captured,
        evidence_residuals: [],
      };
    },
  });
  assert.equal(receipt.resolved_sections[0].section_family, 'NO_OTHER_REPS_FRAUD');
  assert.equal(receipt.compiled_candidates.length, 6);
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok === true));
  const resolution = resolveNoOtherRepsFraudProposals({ proposals: captured, source_text: document, source_id: 'deal-1' });
  assert.equal(resolution.resolved.length, 6);
});

test('producer rejects a party or scope reference outside its assertion quote', () => {
  const parsed = parsedResponse();
  parsed.non_reliance_assertions[0].relying_party_ref = 'Merger Sub';
  parsed.open_world_candidates = [];
  const shaped = shapeNoOtherRepsFraudProposals(parsed, SOURCE);
  assert.equal(shaped.proposals.some((proposal) => proposal.claim_definition_key === GENERIC_KEYS.NON_RELIANCE), false);
  assert.equal(shaped.proposals.some((proposal) => proposal.claim_definition_key === GENERIC_KEYS.EXTRA_CONTRACTUAL), false);
  assert.ok(shaped.evidence_residuals.every((item) => item.reason === 'ATTRIBUTE_NOT_IN_ASSERTION_QUOTE'));
});

test('contract closes ownership and positive-presence definitions', () => {
  assert.equal(Object.keys(ELEMENTS).length, 6);
  assert.equal(Object.keys(CLAIM_DEFINITIONS).length, 6);
  assert.ok(Object.values(CLAIM_DEFINITIONS).every((definition) => (
    definition.allowed_states.length === 1
    && definition.allowed_states[0] === 'PRESENT'
    && definition.allowed_canonical_values[0] === true
  )));
  assert.equal(ELEMENTS[GENERIC_KEYS.FRAUD_CARVEOUT].owner_family, OWNER_FAMILY);
  assert.equal(ELEMENTS[GENERIC_KEYS.FRAUD_CARVEOUT].qualified_owner_family, REMEDIES_OWNER_FAMILY);
  assert.equal(ELEMENTS[GENERIC_KEYS.WILLFUL_BREACH_DEFINITION].owner_family, WILLFUL_BREACH_OWNER_FAMILY);
  assert.equal(ELEMENTS[GENERIC_KEYS.WILLFUL_BREACH_DEFINITION].concept_key, 'DEF-WILLFUL');
});

test('resolver produces side-specific concepts, grounded attributes and evidence-only cross-owner links', () => {
  const { proposals } = shapeNoOtherRepsFraudProposals({ ...parsedResponse(), open_world_candidates: [] }, SOURCE);
  const receipt = resolveNoOtherRepsFraudProposals({ proposals, source_text: SOURCE, source_id: 'deal-1' });
  assert.equal(receipt.resolved.length, 6);
  assert.equal(receipt.residuals.length, 0);
  assert.ok(receipt.resolved.some((item) => item.claim.concept_key === 'REP-T-NOOTHERREPS'));
  assert.ok(receipt.resolved.some((item) => item.claim.concept_key === 'REP-B-NONRELIANCE'));
  assert.ok(receipt.resolved.some((item) => item.claim.concept_key === 'REP-B-INDEPINVEST'));
  const fraud = receipt.resolved.find((item) => item.claim.claim_definition_key === 'FRAUD_CARVEOUT_PRESENT');
  assert.deepEqual(fraud.claim.attributes, { representation_side: 'BUYER' });
  assert.equal(fraud.evidence_only.relationship_state, 'EVIDENCE_ONLY_UNADJUDICATED');
  assert.equal(fraud.evidence_only.qualified_owner_family, REMEDIES_OWNER_FAMILY);
  const willful = receipt.resolved.find((item) => item.claim.claim_definition_key === 'WILLFUL_BREACH_DEFINITION_PRESENT');
  assert.equal(willful.claim.owner_family, WILLFUL_BREACH_OWNER_FAMILY);
  assert.equal(willful.claim.concept_key, 'DEF-WILLFUL');
  assert.equal(willful.evidence_only.relationship_state, 'EVIDENCE_ONLY_UNADJUDICATED');
});

test('resolver fails closed on fraud scope and inferred definition relationships', () => {
  const { proposals } = shapeNoOtherRepsFraudProposals({ ...parsedResponse(), open_world_candidates: [] }, SOURCE);
  const fraud = proposals.find((proposal) => proposal.claim_definition_key === GENERIC_KEYS.FRAUD_CARVEOUT);
  fraud.attributes.fraud_scope_code = 'SPECIFIED_PERSON_FRAUD';
  const willful = proposals.find((proposal) => proposal.claim_definition_key === GENERIC_KEYS.WILLFUL_BREACH_DEFINITION);
  willful.attributes.definition_relationship = 'OVERRIDES_REMEDIES_CAP';
  const receipt = resolveNoOtherRepsFraudProposals({ proposals: [fraud, willful], source_text: SOURCE, source_id: 'deal-1' });
  assert.equal(receipt.resolved.length, 0);
  assert.deepEqual(receipt.residuals.map((item) => item.reason_code), ['UNADJUDICATED_ATTRIBUTE', 'UNADJUDICATED_ATTRIBUTE']);
});

test('resolver rejects evidence-bound attributes outside the closed contract', () => {
  const { proposals } = shapeNoOtherRepsFraudProposals({ ...parsedResponse(), open_world_candidates: [] }, SOURCE);
  const fraud = proposals.find((proposal) => proposal.claim_definition_key === GENERIC_KEYS.FRAUD_CARVEOUT);
  fraud.attributes.Fraud = 'Fraud';
  const receipt = resolveNoOtherRepsFraudProposals({ proposals: [fraud], source_text: SOURCE, source_id: 'deal-1' });
  assert.equal(receipt.resolved.length, 0);
  assert.equal(receipt.residuals[0].reason_code, 'ATTRIBUTE_OUTSIDE_CLOSED_CONTRACT');
});

test('product projection covers Review, Query, Compare and market statistics without fraud-scope inference', () => {
  const { proposals } = shapeNoOtherRepsFraudProposals({ ...parsedResponse(), open_world_candidates: [] }, SOURCE);
  const receipt = resolveNoOtherRepsFraudProposals({ proposals, source_text: SOURCE, source_id: 'deal-1' });
  const product = projectNoOtherRepsFraudProduct(receipt);
  assert.equal(product.review.length, 6);
  assert.equal(product.query.length, 6);
  assert.equal(product.compare.length, 6);
  assert.equal(product.market.length, 6);
  assert.ok(product.query.some((row) => row.field_key === 'noOtherRepsFraudFact'));
  assert.ok(product.query.some((row) => row.field_key === 'definedTermFact'));
  const fraudMarket = product.market.find((row) => row.metric_key === 'fraud_carveout_present_prevalence');
  assert.deepEqual(fraudMarket.breakdown, { representation_side: 'BUYER' });
  assert.equal(JSON.stringify(product).includes('fraud_scope'), false);
  assert.ok(fieldsForCompareCell('REPRESENTATION', ['all']).includes('noOtherRepsFraudFact'));
  assert.ok(fieldsForCompareCell('DEFINITION', ['all']).includes('definedTermFact'));
});

test('classifier recognises narrow no-other-representations titles and leaves generic representation titles with their owner', async () => {
  for (const title of ['Acknowledgment of No Other Representations', 'Anti-Reliance', 'Exclusivity of Representations']) {
    const result = await classifySectionFamily({ title });
    assert.equal(result.section_family, 'NO_OTHER_REPS_FRAUD');
    assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
  }
  const generic = await classifySectionFamily({ title: 'Representations and Warranties' });
  assert.equal(generic.section_family, 'REPRESENTATIONS');
});

test('recorded Skechers and Modiv sources preserve real no-other-reps and independent-investigation evidence', () => {
  for (const directory of ['skechers-first-live-run', 'modiv-first-live-run']) {
    const root = path.join(__dirname, 'fixtures', 'canonical-v2', directory);
    const adapter = JSON.parse(fs.readFileSync(path.join(root, 'adapter-result.json'), 'utf8'));
    const pin = JSON.parse(fs.readFileSync(path.join(root, 'intake-pin.json'), 'utf8'));
    const text = adapter.admitted_source_contexts[0].canonical_text.text;
    assert.equal(sha256Hex(Buffer.from(text, 'utf8')), pin.canonical_text_sha256);
    assert.equal(pin.verification_status, 'PASS');
  }
  const skechers = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'skechers-first-live-run', 'adapter-result.json'), 'utf8')).admitted_source_contexts[0].canonical_text.text;
  const modiv = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'modiv-first-live-run', 'adapter-result.json'), 'utf8')).admitted_source_contexts[0].canonical_text.text;
  assert.match(skechers, /3\.28 Exclusivity of Representations and Warranties\./);
  assert.match(skechers, /No Other Representations and Warranties/);
  assert.match(modiv, /relied on the results of their own independent investigation/);
});

test('the current additive contract bundle accepts all six distinct Abry definitions without merging Fraud and Willful Breach', () => {
  const bundle = compileFixtureContractV34();
  const definitions = new Set(bundle.claim_definitions.map((row) => row.claim_definition_key));
  for (const key of Object.keys(CLAIM_DEFINITIONS)) assert.ok(definitions.has(key));
  const concepts = new Set(bundle.concepts.map((row) => row.concept_key));
  for (const key of ['REP-T-NOOTHERREPS', 'REP-B-NONRELIANCE', 'REP-T-INDEPINVEST', 'REP-B-FRAUDCARVEOUT', 'DEF-WILLFUL']) assert.ok(concepts.has(key));
  assert.notEqual(
    concepts.has('REP-B-FRAUDCARVEOUT') && concepts.has('DEF-WILLFUL'),
    false,
    'Fraud and Willful Breach retain distinct concept identities',
  );
});
