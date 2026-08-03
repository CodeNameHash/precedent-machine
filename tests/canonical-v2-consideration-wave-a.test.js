'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV19 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  CONSIDERATION_CLAIM_KEY,
  shapeConsiderationProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  MAPPING_TABLE_VERSION,
  resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

const {
  PER_SHARE_CASH_PARSE_VERSION,
  parsePerShareCash,
} = require('../lib/canonical-v2/native-producer/per-share-cash-parse');
const {
  EXCHANGE_RATIO_PARSE_VERSION,
  parseExchangeRatio,
} = require('../lib/canonical-v2/native-producer/exchange-ratio-parse');

const CONTRACT_BUNDLE_V19 = compileFixtureContractV19();
const SECTION_REFERENCE = '3.1';

async function resolveConsideration(assertions, sectionBody, dealKey = 'deal:consideration-wave-a') {
  const sourceText = [
    'AGREEMENT AND PLAN OF MERGER\n\n',
    'ARTICLE III\n\n',
    'Section 3.1 Conversion of Shares.\n',
    sectionBody,
    '\n',
  ].join('');
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT_BUNDLE_V19,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeConsiderationProposals({
        consideration_assertions: assertions,
        mechanics: [],
        open_world_candidates: [],
      }, governedScope.source_text);
      return {
        provider_id: 'consideration-wave-a-test/v1',
        model_id: 'stub-model',
        prompt: 'consideration-wave-a-test-prompt/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  const admittedSourceContext = Object.freeze({
    document_hash: documentHash,
    governed_deal_key: dealKey,
    immutable_source_document_id: sha256Hex(`immutable:${dealKey}`),
    source_occurrence_id: sha256Hex(`source-occurrence:${dealKey}`),
    canonical_text_id: sha256Hex(`canonical-text:${dealKey}`),
    canonical_text: Object.freeze({ text: sourceText }),
  });
  return resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE_V19,
    admitted_source_context: admittedSourceContext,
  });
}

function assertion({
  kind,
  quote,
  considerationTerm = null,
  ratioTerm = null,
  issuerStock = null,
  appraisalStatus = null,
  statute = null,
}) {
  return {
    section_reference: SECTION_REFERENCE,
    assertion_kind: kind,
    consideration_term: considerationTerm,
    ratio_term: ratioTerm,
    issuer_stock: issuerStock,
    appraisal_status: appraisalStatus,
    statute,
    quote,
  };
}

test('per-share cash parser admits one USD literal and ignores bare ratio and CVR numerals', () => {
  assert.equal(PER_SHARE_CASH_PARSE_VERSION, 1);
  assert.deepEqual(parsePerShareCash(
    'the right to receive (i) $47.50 in cash, without interest, plus (ii) one (1) contractual contingent value right per share',
  ), {
    outcome: 'RESOLVED', canonical_value: '47.50', matched_text: '47.50', currency: 'USD',
  });
  assert.deepEqual(parsePerShareCash(
    '(x) $16.25 in cash, without interest and (y) 0.3869 of a share of Parent Common Stock',
  ), {
    outcome: 'RESOLVED', canonical_value: '16.25', matched_text: '16.25', currency: 'USD',
  });
  assert.equal(parsePerShareCash('the right to receive $\u200e47.50 in cash').canonical_value, '47.50');
});

test('per-share cash parser excludes par value and abstains on unsafe money shapes', () => {
  assert.deepEqual(parsePerShareCash(
    'one share of common stock, par value $0.01 per share, of the Surviving Corporation',
  ), { outcome: 'ABSTAIN', reason: 'NO_MONEY_LITERAL' });
  assert.deepEqual(parsePerShareCash('$63.00 or $57.00 in cash'), {
    outcome: 'ABSTAIN', reason: 'MULTIPLE_MONEY_LITERALS',
  });
  assert.deepEqual(parsePerShareCash('the right to receive €63.00 in cash'), {
    outcome: 'ABSTAIN', reason: 'NON_USD_CURRENCY', matched_text: '€63.00',
  });
  assert.deepEqual(parsePerShareCash('the right to receive $1,23.00 in cash'), {
    outcome: 'ABSTAIN', reason: 'MALFORMED_GROUPING', matched_text: '1,23.00',
  });
  assert.deepEqual(parsePerShareCash('the right to receive fifty dollars per Share'), {
    outcome: 'ABSTAIN', reason: 'NON_LITERAL_MONEY',
  });
});

test('exchange-ratio parser admits one bare decimal while excluding cash, sections, dates and percentages', () => {
  assert.equal(EXCHANGE_RATIO_PARSE_VERSION, 1);
  assert.deepEqual(parseExchangeRatio(
    '(x) $16.25 in cash and (y) 0.3869 of a share of Parent Common Stock',
  ), { outcome: 'RESOLVED', canonical_value: '0.3869', matched_text: '0.3869' });
  assert.deepEqual(parseExchangeRatio('$\u200e16.25 in cash'), {
    outcome: 'ABSTAIN', reason: 'NO_RATIO_LITERAL',
  });
  assert.deepEqual(parseExchangeRatio(
    '0.7926 shares of Parent Stock and cash in lieu pursuant to Section 1.6 on January 1, 2026',
  ), { outcome: 'RESOLVED', canonical_value: '0.7926', matched_text: '0.7926' });
  assert.deepEqual(parseExchangeRatio(
    '0.907 shares of Parent Stock, subject to a 2.5% adjustment',
  ), { outcome: 'RESOLVED', canonical_value: '0.907', matched_text: '0.907' });
});

test('exchange-ratio parser abstains on pointer, spelled and compound shapes', () => {
  assert.deepEqual(parseExchangeRatio('shares of Parent Stock equal to the Exchange Ratio'), {
    outcome: 'ABSTAIN', reason: 'NO_RATIO_LITERAL',
  });
  assert.deepEqual(parseExchangeRatio('one fully paid and nonassessable share of Holdco Common Stock'), {
    outcome: 'ABSTAIN', reason: 'NON_LITERAL_NUMERAL',
  });
  assert.deepEqual(parseExchangeRatio('0.50 Class A shares or 0.25 Class B shares'), {
    outcome: 'ABSTAIN', reason: 'MULTIPLE_RATIO_LITERALS',
  });
  assert.deepEqual(parseExchangeRatio('$15.00 in cash'), {
    outcome: 'ABSTAIN', reason: 'NO_RATIO_LITERAL',
  });
  assert.deepEqual(parseExchangeRatio('0.3869.1 shares of Parent Common Stock'), {
    outcome: 'ABSTAIN', reason: 'NO_RATIO_LITERAL',
  });
  assert.deepEqual(parseExchangeRatio('0.3869foo shares of Parent Common Stock'), {
    outcome: 'ABSTAIN', reason: 'NO_RATIO_LITERAL',
  });
});

test('resolver parses mixed cash and ratio values but blocks publication until a partyless provision schema exists', async () => {
  const quote = 'Each Share shall be converted into the right to receive (x) $16.25 in cash as the Merger Consideration and (y) 0.3869 shares of Parent Common Stock as the Exchange Ratio.';
  const result = await resolveConsideration([
    assertion({ kind: 'PER_SHARE_CASH', quote, considerationTerm: 'Merger Consideration' }),
    assertion({
      kind: 'EXCHANGE_RATIO', quote, ratioTerm: 'Exchange Ratio', issuerStock: 'Parent Common Stock',
    }),
  ], quote);

  assert.equal(MAPPING_TABLE_VERSION, 11);
  assert.equal(result.resolved.length, 0);
  assert.equal(result.review_queue.length, 2);
  assert.equal(result.open_world.length, 0);
  const byDefinition = new Map(result.review_queue.map((item) => [item.resolved_claim_definition_key, item]));
  const cash = byDefinition.get('PER_SHARE_CASH_CONSIDERATION');
  const ratio = byDefinition.get('EXCHANGE_RATIO_VALUE');
  assert.equal(cash.concept_key, 'CONS-PERSHARE');
  assert.equal(cash.canonical_value, '16.25');
  assert.equal(cash.materiality_rank, 60);
  assert.equal(cash.has_resolution, false);
  assert.deepEqual(cash.reasons, ['PARTYLESS_PROVISION_SCHEMA_UNAVAILABLE']);
  assert.equal(ratio.concept_key, 'CONS-RATIO');
  assert.equal(ratio.canonical_value, '0.3869');
  assert.deepEqual(ratio.reasons, ['PARTYLESS_PROVISION_SCHEMA_UNAVAILABLE']);
  assert.equal(result.resolution_receipt.per_share_cash_parse_version, 1);
  assert.equal(result.resolution_receipt.exchange_ratio_parse_version, 1);
});

test('resolver validates both quoted appraisal statuses but keeps them in typed review', async () => {
  const availableQuote = 'Holders of Dissenting Shares may exercise rights under Section 262 of the DGCL.';
  const unavailableQuote = "No dissenters' or appraisal rights shall be available in connection with the Merger.";
  const available = await resolveConsideration([
    assertion({
      kind: 'APPRAISAL_STATUS', quote: availableQuote, appraisalStatus: 'AVAILABLE', statute: 'Section 262 of the DGCL',
    }),
  ], availableQuote, 'deal:appraisal-available');
  assert.equal(available.resolved.length, 0);
  assert.equal(available.review_queue[0].concept_key, 'CONS-DISSENT');
  assert.equal(available.review_queue[0].resolved_claim_definition_key, 'APPRAISAL_RIGHTS_STATUS');
  assert.equal(available.review_queue[0].canonical_value, 'AVAILABLE');
  assert.deepEqual(available.review_queue[0].reasons, ['PARTYLESS_PROVISION_SCHEMA_UNAVAILABLE']);

  const unavailable = await resolveConsideration([
    assertion({ kind: 'APPRAISAL_STATUS', quote: unavailableQuote, appraisalStatus: 'NOT_AVAILABLE' }),
  ], unavailableQuote, 'deal:appraisal-unavailable');
  assert.equal(unavailable.review_queue[0].canonical_value, 'NOT_AVAILABLE');
  assert.deepEqual(unavailable.review_queue[0].reasons, ['PARTYLESS_PROVISION_SCHEMA_UNAVAILABLE']);

  const contradicted = await resolveConsideration([
    assertion({ kind: 'APPRAISAL_STATUS', quote: unavailableQuote, appraisalStatus: 'AVAILABLE' }),
  ], unavailableQuote, 'deal:appraisal-contradicted');
  assert.equal(contradicted.resolved.length, 0);
  assert.deepEqual(contradicted.review_queue[0].reasons, ['APPRAISAL_STATUS_CONTRADICTED']);
  assert.equal(contradicted.review_queue[0].materiality_rank, 60);
});

test('resolver routes unsafe Consideration candidates to typed review or open world', async () => {
  const withholdingQuote = 'The Paying Agent may deduct and withhold $10.00 from the Merger Consideration otherwise payable.';
  const withholding = await resolveConsideration([
    assertion({ kind: 'PER_SHARE_CASH', quote: withholdingQuote, considerationTerm: 'Merger Consideration' }),
  ], withholdingQuote, 'deal:withholding');
  assert.deepEqual(withholding.review_queue[0].reasons, ['PER_SHARE_CONTEXT_UNCORROBORATED']);

  const internalQuote = 'Each share shall be converted into one share of common stock of the Surviving Corporation.';
  const internal = await resolveConsideration([
    assertion({ kind: 'EXCHANGE_RATIO', quote: internalQuote, issuerStock: 'Surviving Corporation' }),
  ], internalQuote, 'deal:internal-conversion');
  assert.deepEqual(internal.review_queue[0].reasons, ['RATIO_TERM_UNIDENTIFIED']);

  const electionQuote = 'Each Share has the right to receive $63.00 or $57.00 in cash as the Merger Consideration.';
  const election = await resolveConsideration([
    assertion({ kind: 'PER_SHARE_CASH', quote: electionQuote, considerationTerm: 'Merger Consideration' }),
  ], electionQuote, 'deal:compound-election');
  assert.deepEqual(election.review_queue[0].reasons, ['MULTIPLE_MONEY_LITERALS']);

  const pointerQuote = 'Each Share has the right to receive shares of Parent Stock equal to the Exchange Ratio.';
  const pointer = await resolveConsideration([
    assertion({
      kind: 'EXCHANGE_RATIO', quote: pointerQuote, ratioTerm: 'Exchange Ratio', issuerStock: 'Parent Stock',
    }),
  ], pointerQuote, 'deal:ratio-pointer');
  assert.deepEqual(pointer.review_queue[0].reasons, ['NO_RATIO_LITERAL']);

  const badKindQuote = 'Each Share has merger consideration rights.';
  const badKind = await resolveConsideration([
    assertion({ kind: 'PRORATION', quote: badKindQuote }),
  ], badKindQuote, 'deal:open-world-kind');
  assert.equal(badKind.open_world.length, 1);
  assert.equal(badKind.open_world[0].claim_definition_key, CONSIDERATION_CLAIM_KEY);
  assert.equal(badKind.open_world[0].reason, 'ASSERTION_KIND_OUT_OF_ENUM');
});
