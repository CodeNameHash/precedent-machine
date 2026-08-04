'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  APPRAISAL_STATUS_VALUES,
  CONSIDERATION_ASSERTION_KINDS,
  CONSIDERATION_CLAIM_KEY,
  CONSIDERATION_PROPOSAL_KIND,
  createAnthropicProvider,
  shapeConsiderationProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  buildConsiderationProducerPrompt,
} = require('../lib/canonical-v2/native-producer/consideration-producer-prompt');
const {
  bindNativePromptToGovernedScope,
} = require('../lib/canonical-v2/native-producer/native-prompt-binding');
const {
  compileCandidateProposals,
} = require('../lib/canonical-v2/native-producer/candidate-proposal-compiler');
const {
  getProducerPromptModule,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const {
  produceCandidateProposals,
} = require('../lib/canonical-v2/native-producer/provider-interface');
const {
  SECTION_FAMILY_RULE_CLASSIFIED,
  classifySectionFamily,
} = require('../lib/canonical-v2/native-producer/section-family-classifier');

const SOURCE_TEXT = 'Each Share shall be converted into the right to receive $63.00 per Share in cash, without interest (the "Merger Consideration").';
const GOVERNED_SCOPE = Object.freeze({
  deal_key: 'deal:consideration-seam',
  section_reference: '2.1',
  source_text: SOURCE_TEXT,
});
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const CONTRACT_BUNDLE = compileFixtureContract();

test('CONSIDERATION uses the repository prompt registry and preserves the controlled taxonomy boundary', () => {
  assert.equal(getProducerPromptModule('CONSIDERATION'), buildConsiderationProducerPrompt);
  const prompt = buildConsiderationProducerPrompt({
    source_text: SOURCE_TEXT,
    governed_scope: GOVERNED_SCOPE,
    known_definitions: [],
  });
  assert.equal(prompt.prompt_id, 'native-producer-consideration/v1');
  assert.match(prompt.messages[0].content, /PER_SHARE_CASH \| EXCHANGE_RATIO \| APPRAISAL_STATUS/);
  assert.match(prompt.messages[0].content, /Never emit fixed or floating ratio type/);
  assert.match(prompt.messages[0].content, /NEVER ASSERT A NEGATIVE FROM SILENCE/);
  assert.match(prompt.messages[0].content, /ELECTION_ALLOCATION/);
  assert.match(prompt.messages[0].content, /cash_alternatives/);
  assert.match(prompt.messages[0].content, /same quote identifies an appraisal statute/);
  assert.deepEqual(CONSIDERATION_ASSERTION_KINDS, [
    'PER_SHARE_CASH', 'EXCHANGE_RATIO', 'APPRAISAL_STATUS',
  ]);
  assert.deepEqual(APPRAISAL_STATUS_VALUES, ['AVAILABLE', 'NOT_AVAILABLE']);
});

test('CVR and election mechanics remain exact open-world evidence and never become per-share claims', async () => {
  const sourceText = 'If the aggregate number of Mixed Election Shares exceeds the Maximum Equity Election Cap, the remaining shares receive Cash Election Consideration.';
  const provider = createAnthropicProvider({
    model: 'consideration-seam-test',
    maxRetries: 0,
    client: { messages: { async create() {
      return { content: [{ text: JSON.stringify({
        consideration_assertions: [],
        consideration_mechanics: [{
          surface: 'ELECTION_ALLOCATION', quote: sourceText,
          detail: 'Cap-based allocation between mixed and cash elections.',
        }],
        open_world_candidates: [],
      }) }] };
    } } },
  });
  const produced = await produceCandidateProposals({
    governed_scope: { ...GOVERNED_SCOPE, source_text: sourceText },
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    section_family: 'CONSIDERATION',
    provider,
  });
  assert.equal(produced.proposals.length, 1);
  assert.equal(produced.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION');
  assert.equal(produced.proposals[0].canonical_value, null);
  assert.match(produced.proposals[0].attributes.why_unmapped, /^ELECTION_ALLOCATION:/);
});

test('consideration provider keeps only quote-local election object fields and keeps CVR presence-only', () => {
  const electionQuote = 'A holder may make a Cash Election to receive $63.00 in cash or a Stock Election to receive one Parent Share.';
  const cvrQuote = 'Each Share shall receive one contractual contingent value right pursuant to the CVR Agreement.';
  const shaped = shapeConsiderationProposals({
    consideration_assertions: [],
    consideration_mechanics: [
      {
        surface: 'ELECTION_ALTERNATIVE', quote: electionQuote, detail: 'two choices',
        election_choice: 'may make a Cash Election to receive $63.00 in cash or a Stock Election to receive one Parent Share',
        cash_alternatives: ['Cash Election to receive $63.00 in cash', 'invented cash alternative'],
        stock_alternatives: ['Stock Election to receive one Parent Share'],
      },
      { surface: 'CVR', quote: cvrQuote, detail: 'separate agreement right' },
    ],
    open_world_candidates: [],
  }, `${electionQuote}\n${cvrQuote}`);
  const election = shaped.proposals.find((proposal) => proposal.raw_value === electionQuote);
  assert.deepEqual(election.attributes.structured_mechanic, {
    surface: 'ELECTION_ALTERNATIVE',
    election_choice: 'may make a Cash Election to receive $63.00 in cash or a Stock Election to receive one Parent Share',
    cash_alternatives: ['Cash Election to receive $63.00 in cash'],
    stock_alternatives: ['Stock Election to receive one Parent Share'],
  });
  const cvr = shaped.proposals.find((proposal) => proposal.raw_value === cvrQuote);
  assert.deepEqual(cvr.attributes.structured_mechanic, { surface: 'CVR' });
});

test('consideration titles classify at stage 1 without capturing capitalisation or termination titles', async () => {
  const titles = [
    'Conversion of Shares',
    'Effect of the Merger on Capital Stock',
    'Exchange of Certificates',
    'Treatment of Company Equity Awards',
    'Withholding Rights',
    'Adjustments to Prevent Dilution',
  ];
  for (const title of titles) {
    const result = await classifySectionFamily({ title });
    assert.equal(result.section_family, 'CONSIDERATION', title);
    assert.equal(result.provenance, SECTION_FAMILY_RULE_CLASSIFIED, title);
  }
  assert.equal((await classifySectionFamily({ title: 'Dissenters’ Rights' })).section_family, 'APPRAISAL_DISSENTERS_RIGHTS');
  assert.notEqual((await classifySectionFamily({ title: 'Capitalization' })).section_family, 'CONSIDERATION');
  assert.notEqual((await classifySectionFamily({ title: 'Termination Rights' })).section_family, 'CONSIDERATION');
});

test('live provider sends the consideration prompt and shapes a byte-evidenced generic candidate', async () => {
  let request = null;
  const response = {
    consideration_assertions: [{
      section_reference: '2.1',
      assertion_kind: 'PER_SHARE_CASH',
      consideration_term: 'Merger Consideration',
      ratio_term: null,
      issuer_stock: null,
      appraisal_status: null,
      statute: null,
      quote: SOURCE_TEXT,
    }],
    open_world_candidates: [],
  };
  const provider = createAnthropicProvider({
    model: 'consideration-seam-test',
    maxRetries: 0,
    client: { messages: { async create(value) {
      request = value;
      return { content: [{ text: JSON.stringify(response) }] };
    } } },
  });
  const produced = await produceCandidateProposals({
    governed_scope: GOVERNED_SCOPE,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    section_family: 'CONSIDERATION',
    provider,
  });

  const expectedPrompt = bindNativePromptToGovernedScope({
    prompt: buildConsiderationProducerPrompt({
      source_text: SOURCE_TEXT,
      governed_scope: GOVERNED_SCOPE,
      known_definitions: [],
    }),
    governed_scope: GOVERNED_SCOPE,
  });
  assert.deepEqual(request.messages, expectedPrompt.messages);
  assert.equal(produced.proposals.length, 1);
  assert.equal(produced.proposals[0].claim_definition_key, CONSIDERATION_CLAIM_KEY);
  assert.equal(produced.proposals[0].proposal_kind, CONSIDERATION_PROPOSAL_KIND);
  assert.equal(produced.proposals[0].attributes.consideration_term_ref, 'Merger Consideration');
  assert.equal(produced.proposals[0].raw_value, SOURCE_TEXT);
  const evidence = produced.proposals[0].evidence[0];
  assert.equal(Buffer.from(SOURCE_TEXT, 'utf8').subarray(
    evidence.absolute_start, evidence.absolute_end,
  ).toString('utf8'), SOURCE_TEXT);

  const compiled = compileCandidateProposals({
    proposals: produced.proposals,
    governed_scope: GOVERNED_SCOPE,
    producer_receipt: produced.producer_receipt,
    extractor_id: 'consideration-seam-test',
    extractor_version: 'v1',
  });
  assert.equal(compiled.length, 1);
  assert.equal(compiled[0].ok, true);
});

test('a pre-consideration response remains valid and produces no invented consideration claim', async () => {
  const provider = createAnthropicProvider({
    model: 'consideration-seam-test',
    maxRetries: 0,
    client: { messages: { async create() {
      return { content: [{ text: JSON.stringify({ open_world_candidates: [] }) }] };
    } } },
  });
  const produced = await produceCandidateProposals({
    governed_scope: GOVERNED_SCOPE,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    section_family: 'CONSIDERATION',
    provider,
  });
  assert.deepEqual(produced.proposals, []);
  assert.equal(produced.evidence_residuals.length, 0);
});

test('unverifiable consideration evidence becomes a typed residual, never a silent omission', async () => {
  const provider = createAnthropicProvider({
    model: 'consideration-seam-test',
    maxRetries: 0,
    client: { messages: { async create() {
      return { content: [{ text: JSON.stringify({
        consideration_assertions: [{
          section_reference: '2.1', assertion_kind: 'PER_SHARE_CASH',
          consideration_term: 'Merger Consideration', ratio_term: null,
          issuer_stock: null, appraisal_status: null, statute: null,
          quote: 'a quote absent from the licensed source',
        }],
        open_world_candidates: [],
      }) }] };
    } } },
  });
  const produced = await produceCandidateProposals({
    governed_scope: GOVERNED_SCOPE,
    definitions: DEFINITIONS,
    contract_bundle: CONTRACT_BUNDLE,
    section_family: 'CONSIDERATION',
    provider,
  });
  assert.equal(produced.proposals.length, 0);
  assert.equal(produced.evidence_residuals[0].reason, 'CONSIDERATION_QUOTE_UNVERIFIED');
});
