'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { compileCandidateProposals } = require('../lib/canonical-v2/native-producer/candidate-proposal-compiler');
const {
  createAnthropicProvider,
  DEFINED_TERM_CLAIM_KEY,
  DEFINED_TERM_PROPOSAL_KIND,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  PROMPT_ID,
  PROMPT_VERSION,
  buildDefinedTermsProducerPrompt,
} = require('../lib/canonical-v2/native-producer/defined-terms-producer-prompt');
const { produceCandidateProposals } = require('../lib/canonical-v2/native-producer/provider-interface');
const {
  getProducerPromptModule,
  listRegisteredSectionFamilies,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const {
  SECTION_FAMILY_RULE_CLASSIFIED,
  classifySectionFamily,
} = require('../lib/canonical-v2/native-producer/section-family-classifier');

const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const SOURCE_TEXT = '"Acquisition Proposal" means an offer to acquire more than 20% of the outstanding equity securities.';
const LANDOS_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt'),
  'utf8',
);
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'deal:defined-terms-family-seam',
  governed_intervals: Object.freeze(['1.1']),
  source_text: SOURCE_TEXT,
});

function response(overrides = {}) {
  return {
    defined_term_assertions: [{
      section_reference: '1.1',
      assertion_kind: 'ACQ_THRESHOLD',
      definition_head_quote: '"Acquisition Proposal" means',
      limb_quote: 'more than 20% of the outstanding equity securities',
      proposal_term_ref: 'Acquisition Proposal',
      superior_term_ref: null,
      substitution_from_percent: null,
      substituted_term_ref: null,
      host_term_ref: null,
      threshold_basis: 'EQUITY_SECURITIES',
      qualifier_code: null,
      event_term_ref: null,
      exclusion_code: null,
      knowledge_term_ref: null,
      standard_code: null,
      source_code: null,
      knowledge_party: null,
      named_persons: [],
      breach_term_ref: null,
    }],
    open_world_candidates: [],
    ...overrides,
  };
}

async function run(modelResponse, { sourceText = SOURCE_TEXT, sectionReference = '1.1' } = {}) {
  let request;
  const governedScope = Object.freeze({
    deal_key: 'deal:defined-terms-family-seam',
    governed_intervals: Object.freeze([sectionReference]),
    source_text: sourceText,
  });
  const provider = createAnthropicProvider({
    model: 'defined-terms-family-seam',
    maxRetries: 0,
    client: { messages: { async create(value) {
      request = value;
      return { content: [{ text: JSON.stringify(modelResponse) }] };
    } } },
  });
  const result = await produceCandidateProposals({
    governed_scope: governedScope,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    section_family: 'KEY_DEFINED_TERMS',
    provider,
  });
  return { governedScope, request, result };
}

test('registry dispatches KEY_DEFINED_TERMS to its exact prompt builder', () => {
  assert.equal(getProducerPromptModule('KEY_DEFINED_TERMS'), buildDefinedTermsProducerPrompt);
  assert.ok(listRegisteredSectionFamilies().includes('KEY_DEFINED_TERMS'));
  const prompt = buildDefinedTermsProducerPrompt({
    source_text: SOURCE_TEXT,
    governed_scope: GOVERNED_SCOPE,
    known_definitions: [],
  });
  assert.equal(prompt.prompt_id, PROMPT_ID);
  assert.equal(prompt.prompt_version, PROMPT_VERSION);
  const text = prompt.messages[0].content;
  assert.match(text, /definition_head_quote and limb_quote/i);
  assert.match(text, /Material Adverse Effect definition belongs to another producer/i);
  assert.match(text, /Never emit an absent definition/i);
  assert.match(text, /never apply the substitution/i);
});

test('stage 1 routes definition titles and preserves the MAE-specific priority', async () => {
  for (const title of ['Definitions', 'Certain Definitions', 'Superior Proposal Definition']) {
    const result = await classifySectionFamily({ title });
    assert.equal(result.section_family, 'KEY_DEFINED_TERMS');
    assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED);
  }
  assert.equal((await classifySectionFamily({ title: 'Material Adverse Effect Definition' })).section_family, 'MAE_DEFINITION');
  for (const title of ['Termination Fee', 'No Solicitation', 'Conditions to Closing']) {
    assert.notEqual((await classifySectionFamily({ title })).section_family, 'KEY_DEFINED_TERMS');
  }
  const annex = await classifySectionFamily({ title: 'Annex A' });
  assert.equal(annex.section_family, null);
  assert.equal(annex.declined_reason, 'NO_STAGE_2_PROVIDER');
});

test('live provider uses the family prompt, byte-verifies both spans and compiles the candidate', async () => {
  const { request, result } = await run(response());
  const expectedPrompt = buildDefinedTermsProducerPrompt({
    source_text: SOURCE_TEXT,
    governed_scope: GOVERNED_SCOPE,
    known_definitions: [],
  });
  assert.deepEqual(request.messages, expectedPrompt.messages);
  assert.equal(result.proposals.length, 1);
  const proposal = result.proposals[0];
  assert.equal(proposal.proposal_kind, DEFINED_TERM_PROPOSAL_KIND);
  assert.equal(proposal.claim_definition_key, DEFINED_TERM_CLAIM_KEY);
  assert.equal(proposal.evidence.length, 2);
  assert.deepEqual(proposal.evidence.map((item) => item.evidence_role).sort(), ['DEFINITION', 'OPERATIVE_TEXT']);
  for (const item of proposal.evidence) {
    assert.ok(item.absolute_end > item.absolute_start);
    const extracted = Buffer.from(SOURCE_TEXT).subarray(item.absolute_start, item.absolute_end).toString('utf8');
    assert.ok([proposal.attributes.definition_head_quote, proposal.attributes.limb_quote].includes(extracted));
  }
  const compiled = compileCandidateProposals({
    proposals: result.proposals,
    governed_scope: GOVERNED_SCOPE,
    producer_receipt: result.producer_receipt,
    extractor_id: 'defined-terms-family-seam',
    extractor_version: 'v1',
  });
  assert.equal(compiled.length, 1);
  assert.equal(compiled[0].ok, true);
});

test('the provider byte-verifies a Superior Proposal assertion against the full committed Landos agreement', async () => {
  const definitionHead = '“Superior Proposal” means any bona fide written proposal';
  const limb = 'is reasonably likely to be consummated in accordance with its terms and conditions';
  assert.ok(LANDOS_SOURCE.includes(definitionHead));
  assert.ok(LANDOS_SOURCE.includes(limb));
  const assertion = {
    ...response().defined_term_assertions[0],
    section_reference: 'Exhibit A',
    assertion_kind: 'SUPERIOR_QUALIFIER',
    definition_head_quote: definitionHead,
    limb_quote: limb,
    proposal_term_ref: null,
    superior_term_ref: 'Superior Proposal',
    threshold_basis: null,
    qualifier_code: 'CONSUMMATION_LIKELIHOOD',
  };
  const { result } = await run({
    defined_term_assertions: [assertion],
    open_world_candidates: [],
  }, { sourceText: LANDOS_SOURCE, sectionReference: 'Exhibit A' });
  assert.equal(result.proposals.length, 1);
  assert.deepEqual(
    result.proposals[0].evidence.map((item) => (
      Buffer.from(LANDOS_SOURCE).subarray(item.absolute_start, item.absolute_end).toString('utf8')
    )),
    [definitionHead, limb],
  );
});

test('missing additive assertions is an empty success, not a schema failure', async () => {
  const { result } = await run({ open_world_candidates: [] });
  assert.deepEqual(result.proposals, []);
  assert.deepEqual(result.evidence_residuals, []);
});

test('either unverified assertion span drops the whole assertion as a typed residual', async () => {
  const missingHead = response();
  missingHead.defined_term_assertions[0].definition_head_quote = '"Takeover Proposal" means';
  const headResult = (await run(missingHead)).result;
  assert.equal(headResult.proposals.length, 0);
  assert.equal(headResult.evidence_residuals[0].reason, 'DEFINED_TERM_HEAD_QUOTE_UNVERIFIED');

  const missingLimb = response();
  missingLimb.defined_term_assertions[0].limb_quote = 'more than 99% of the assets';
  const limbResult = (await run(missingLimb)).result;
  assert.equal(limbResult.proposals.length, 0);
  assert.equal(limbResult.evidence_residuals[0].reason, 'DEFINED_TERM_LIMB_QUOTE_UNVERIFIED');
});

test('bounded seam adds no MAE carve-out or day-count vocabulary', () => {
  const files = [
    'lib/canonical-v2/native-producer/defined-terms-producer-prompt.js',
    'lib/canonical-v2/native-producer/defined-term-threshold-parse.js',
  ];
  const source = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /PANDEMIC|_DAYS\b/);
});
