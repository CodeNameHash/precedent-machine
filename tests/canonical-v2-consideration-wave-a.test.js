'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV22 } = require('../lib/canonical-v2/contract-bundle');
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
  LEXICAL_FAMILY_LEXICON_VERSION,
  buildLexicalDisagreementReceipt,
} = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');

const {
  PER_SHARE_CASH_PARSE_VERSION,
  parsePerShareCash,
} = require('../lib/canonical-v2/native-producer/per-share-cash-parse');
const {
  EXCHANGE_RATIO_PARSE_VERSION,
  parseExchangeRatio,
} = require('../lib/canonical-v2/native-producer/exchange-ratio-parse');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const {
  AUTHORITY_STATE,
  ConsiderationWaveAProjectionError,
  projectConsiderationWaveAClaims,
} = require('../lib/canonical-v2/consideration-wave-a-product-projection');

const CONTRACT_BUNDLE_V22 = compileFixtureContractV22();
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
    contract_bundle: CONTRACT_BUNDLE_V22,
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
  const dealAdmissionId = sha256Hex(`deal-admission:${dealKey}`);
  const immutableSourceDocumentId = sha256Hex(`immutable:${dealKey}`);
  const sourceContentId = sha256Hex(`source-content:${dealKey}`);
  const sourceOccurrenceKey = contentId('ADMITTED_SOURCE_OCCURRENCE_KEY/V1', {
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
  });
  const canonicalTextId = sha256Hex(`canonical-text:${dealKey}`);
  const admittedSourceBody = {
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    document_hash: documentHash,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
    immutable_source_document_id: immutableSourceDocumentId,
    source_admission_manifest_id: sha256Hex(`source-admission:${dealKey}`),
    semantic_extraction_input_envelope_id: sha256Hex(`envelope:${dealKey}`),
    source_content_id: sourceContentId,
    source_occurrence_id: contentId('SOURCE_OCCURRENCE/V1', {
      source_content_id: sourceContentId,
      source_occurrence_key: sourceOccurrenceKey,
    }),
    source_occurrence_key: sourceOccurrenceKey,
    source_kind: 'ORIGINAL_BYTES',
    source_byte_length: Buffer.byteLength(sourceText, 'utf8'),
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: documentHash,
    canonical_text_byte_length: Buffer.byteLength(sourceText, 'utf8'),
    canonical_text: Object.freeze({
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: canonicalTextId,
      text: sourceText,
    }),
    converter_digest: sha256Hex('consideration-test-converter'),
    converter_config_digest: sha256Hex('consideration-test-converter-config'),
    source_map_encoding: 'GZIP_BASE64_JSON_V1',
    source_map_compressed_sha256: sha256Hex(`source-map-compressed:${dealKey}`),
    source_map_uncompressed_byte_length: 1,
    input_region_count: 1,
    output_mapping_count: 1,
    source_map_digest: sha256Hex(`source-map:${dealKey}`),
    verification_manifest_id: sha256Hex(`verification:${dealKey}`),
  };
  const admittedSourceContext = Object.freeze({
    ...admittedSourceBody,
    admitted_semantic_source_context_id: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1', admittedSourceBody,
    ),
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE_V22,
    admitted_source_context: admittedSourceContext,
  });
  return Object.freeze({
    ...resolution,
    resolution,
    receipt,
    sourceText,
    documentHash,
    admittedSourceContext,
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

function lexicalReceipt(text, family) {
  const bytes = Buffer.from(text, 'utf8');
  return buildLexicalDisagreementReceipt({
    governed_section: {
      section_ref: SECTION_REFERENCE,
      text,
      text_sha256: sha256Hex(bytes),
    },
    candidates: [{
      closure_id: sha256Hex(`closure:${family}:${text}`),
      section_reference: SECTION_REFERENCE,
      family,
      evidence: [{ start: 0, end: bytes.length }],
    }],
  });
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

test('Consideration lexical families cover grounded text and preserve defined-term case boundaries', () => {
  assert.equal(LEXICAL_FAMILY_LEXICON_VERSION, 15);
  for (const [family, text] of [
    ['CONS-PERSHARE', 'converted into the right to receive $16.25 in cash, without interest as the Merger Consideration'],
    ['CONS-RATIO', '0.3869 of a share of Parent Common Stock as the Exchange Ratio'],
    ['CONS-DISSENT', 'No dissenters\' or appraisal rights shall be available for Dissenting Shares'],
  ]) {
    const outcome = lexicalReceipt(text, family).family_outcomes.find((entry) => entry.family === family);
    assert.ok(outcome);
    assert.equal(outcome.outcome, 'LEXICAL_ALL_SIGNALS_MATCHED');
    assert.ok(outcome.pattern_hit_count > 0);
  }
  for (const [family, text] of [
    ['CONS-PERSHARE', 'merger consideration'],
    ['CONS-RATIO', 'exchange ratio'],
    ['CONS-DISSENT', 'dissenting shares'],
  ]) {
    const outcome = lexicalReceipt(text, family).family_outcomes.find((entry) => entry.family === family);
    assert.ok(outcome);
    assert.equal(outcome.pattern_hit_count, 0);
  }
});

test('resolver publishes mixed cash and ratio values through partyless structural provisions', async () => {
  const quote = 'Each Share shall be converted into the right to receive (x) $16.25 in cash as the Merger Consideration and (y) 0.3869 shares of Parent Common Stock as the Exchange Ratio.';
  const result = await resolveConsideration([
    assertion({ kind: 'PER_SHARE_CASH', quote, considerationTerm: 'Merger Consideration' }),
    assertion({
      kind: 'EXCHANGE_RATIO', quote, ratioTerm: 'Exchange Ratio', issuerStock: 'Parent Common Stock',
    }),
  ], quote);

  assert.equal(MAPPING_TABLE_VERSION, 20);
  assert.equal(result.resolved.length, 2);
  assert.equal(result.review_queue.length, 2);
  assert.equal(result.open_world.length, 0);
  const byDefinition = new Map(result.resolved.map((item) => [item.resolved_claim_definition_key, item]));
  const cash = byDefinition.get('PER_SHARE_CASH_CONSIDERATION');
  const ratio = byDefinition.get('EXCHANGE_RATIO_VALUE');
  assert.equal(cash.concept_key, 'CONS-PERSHARE');
  assert.equal(cash.claim.canonical_value, '16.25');
  assert.equal(cash.triage.materiality_rank, 60);
  assert.equal(cash.party, null);
  assert.equal(cash.provision_instance.schema_version, 'STRUCTURAL_PROVISION_INSTANCE/V1');
  assert.equal(Object.hasOwn(cash.provision_instance, 'party'), false);
  assert.equal(ratio.concept_key, 'CONS-RATIO');
  assert.equal(ratio.claim.canonical_value, '0.3869');
  assert.equal(ratio.party, null);
  assert.equal(ratio.provision_instance.schema_version, 'STRUCTURAL_PROVISION_INSTANCE/V1');
  assert.notEqual(cash.claim.claim_revision_id, ratio.claim.claim_revision_id);
  assert.ok(result.review_queue.every((item) => item.has_resolution === true));
  assert.equal(result.resolution_receipt.per_share_cash_parse_version, 1);
  assert.equal(result.resolution_receipt.exchange_ratio_parse_version, 1);
});

test('partyless Consideration provision and claim identities do not depend on proposal order', async () => {
  const quote = 'Each Share shall be converted into the right to receive (x) $16.25 in cash as the Merger Consideration and (y) 0.3869 shares of Parent Common Stock as the Exchange Ratio.';
  const assertions = [
    assertion({ kind: 'PER_SHARE_CASH', quote, considerationTerm: 'Merger Consideration' }),
    assertion({ kind: 'EXCHANGE_RATIO', quote, ratioTerm: 'Exchange Ratio', issuerStock: 'Parent Common Stock' }),
  ];
  const first = await resolveConsideration(assertions, quote, 'deal:consideration-order');
  const second = await resolveConsideration([...assertions].reverse(), quote, 'deal:consideration-order');
  const identities = (result) => Object.fromEntries(result.resolved.map((entry) => [
    entry.resolved_claim_definition_key,
    [entry.provision_instance.provision_instance_id, entry.claim.claim_revision_id],
  ]));
  assert.deepEqual(identities(first), identities(second));
});

test('resolver publishes both quoted appraisal statuses through partyless structural provisions', async () => {
  const availableQuote = 'Holders of Dissenting Shares may exercise rights under Section 262 of the DGCL.';
  const unavailableQuote = "No dissenters' or appraisal rights shall be available in connection with the Merger.";
  const available = await resolveConsideration([
    assertion({
      kind: 'APPRAISAL_STATUS', quote: availableQuote, appraisalStatus: 'AVAILABLE', statute: 'Section 262 of the DGCL',
    }),
  ], availableQuote, 'deal:appraisal-available');
  assert.equal(available.resolved.length, 1);
  assert.equal(available.resolved[0].concept_key, 'CONS-DISSENT');
  assert.equal(available.resolved[0].resolved_claim_definition_key, 'APPRAISAL_RIGHTS_STATUS');
  assert.equal(available.resolved[0].claim.canonical_value, 'AVAILABLE');
  assert.equal(available.resolved[0].provision_instance.schema_version, 'STRUCTURAL_PROVISION_INSTANCE/V1');
  assert.equal(available.review_queue[0].has_resolution, true);

  const unavailable = await resolveConsideration([
    assertion({ kind: 'APPRAISAL_STATUS', quote: unavailableQuote, appraisalStatus: 'NOT_AVAILABLE' }),
  ], unavailableQuote, 'deal:appraisal-unavailable');
  assert.equal(unavailable.resolved.length, 1);
  assert.equal(unavailable.resolved[0].claim.canonical_value, 'NOT_AVAILABLE');
  assert.equal(unavailable.resolved[0].party, null);

  const contradicted = await resolveConsideration([
    assertion({ kind: 'APPRAISAL_STATUS', quote: unavailableQuote, appraisalStatus: 'AVAILABLE' }),
  ], unavailableQuote, 'deal:appraisal-contradicted');
  assert.equal(contradicted.resolved.length, 0);
  assert.deepEqual(contradicted.review_queue[0].reasons, ['APPRAISAL_STATUS_CONTRADICTED']);
  assert.equal(contradicted.review_queue[0].materiality_rank, 60);

  const impliedWithoutStatute = await resolveConsideration([
    assertion({
      kind: 'APPRAISAL_STATUS',
      quote: 'Each Dissenting Share remains subject to the appraisal process.',
      appraisalStatus: 'AVAILABLE',
    }),
  ], 'Each Dissenting Share remains subject to the appraisal process.', 'deal:appraisal-implied-no-statute');
  assert.equal(impliedWithoutStatute.resolved.length, 0);
  assert.deepEqual(impliedWithoutStatute.review_queue[0].reasons, [
    'APPRAISAL_STATUTE_REQUIRED_FOR_NECESSARY_IMPLICATION',
  ]);

  const sectionWithoutLaw = 'Holders may exercise appraisal rights under Section 262.';
  const incompleteStatute = await resolveConsideration([
    assertion({
      kind: 'APPRAISAL_STATUS', quote: sectionWithoutLaw, appraisalStatus: 'AVAILABLE', statute: 'Section 262',
    }),
  ], sectionWithoutLaw, 'deal:appraisal-incomplete-statute');
  assert.equal(incompleteStatute.resolved.length, 0);
  assert.deepEqual(incompleteStatute.review_queue[0].reasons, [
    'APPRAISAL_STATUTE_REQUIRED_FOR_NECESSARY_IMPLICATION',
  ]);
});

test('published Wave A claims pass the native adapter and resolved canonical validator end to end', async () => {
  const quote = 'Each Share shall be converted into the right to receive (x) $16.25 in cash as the Merger Consideration and (y) 0.3869 shares of Parent Common Stock as the Exchange Ratio.';
  const result = await resolveConsideration([
    assertion({ kind: 'PER_SHARE_CASH', quote, considerationTerm: 'Merger Consideration' }),
    assertion({ kind: 'EXCHANGE_RATIO', quote, ratioTerm: 'Exchange Ratio', issuerStock: 'Parent Common Stock' }),
  ], quote, 'deal:consideration-write-set');
  const provisions = [...new Map(result.resolved.map((entry) => [
    entry.provision_instance.provision_instance_id,
    entry.provision_instance,
  ])).values()];
  const adapted = buildNativeWriteSet({
    run_receipt: {
      ...result.receipt,
      compiled_candidates: result.resolved.map((entry) => entry.compiled_candidate),
    },
    source_text: result.sourceText,
    document_hash: result.documentHash,
    admitted_source_context: result.admittedSourceContext,
    resolution: { provisions, limb_component_trees: result.limb_component_trees },
  });
  assert.equal(adapted.residuals.length, 0);
  assert.equal(adapted.write_set.claims.length, 2);
  assert.equal(adapted.write_set.provisions.length, 2);
  assert.ok(adapted.write_set.provisions.every(
    (provision) => provision.schema_version === 'STRUCTURAL_PROVISION_INSTANCE/V1'
      && !Object.hasOwn(provision, 'party'),
  ));
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: adapted.write_set,
    contractBundle: CONTRACT_BUNDLE_V22,
    admittedSourceContexts: adapted.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
  assert.equal(validation.residuals.length, 0);
  assert.equal(validation.publishableWriteSet.claims.length, 2);
});

test('grounded Wave A claims project to Review, Query, Compare and market without serving authority', async () => {
  const quote = 'Each Share shall be converted into the right to receive (x) $16.25 in cash as the Merger Consideration and (y) 0.3869 shares of Parent Common Stock as the Exchange Ratio.';
  const resolved = await resolveConsideration([
    assertion({ kind: 'PER_SHARE_CASH', quote, considerationTerm: 'Merger Consideration' }),
    assertion({ kind: 'EXCHANGE_RATIO', quote, ratioTerm: 'Exchange Ratio', issuerStock: 'Parent Common Stock' }),
  ], quote, 'deal:consideration-projection');
  const appraisalQuote = 'Holders of Dissenting Shares may exercise appraisal rights under Section 262 of the DGCL.';
  const appraisal = await resolveConsideration([
    assertion({
      kind: 'APPRAISAL_STATUS', quote: appraisalQuote, appraisalStatus: 'AVAILABLE', statute: 'Section 262 of the DGCL',
    }),
  ], appraisalQuote, 'deal:consideration-projection-appraisal');
  const entries = [...resolved.resolved, ...appraisal.resolved];
  const projection = projectConsiderationWaveAClaims({ resolved_entries: entries });
  const permuted = projectConsiderationWaveAClaims({ resolved_entries: [...entries].reverse() });

  assert.equal(projection.authority_state, AUTHORITY_STATE);
  assert.equal(projection.projection_id, permuted.projection_id);
  assert.equal(projection.records.length, 3);
  assert.ok(projection.records.every((record) => record.authority_state === 'VALIDATED_NOT_SERVED'));
  const byClaim = new Map(projection.records.map((record) => [record.claim_definition_key, record]));
  assert.deepEqual(byClaim.get('PER_SHARE_CASH_CONSIDERATION').query, {
    field_key: 'perShareAmount', value: '16.25',
  });
  assert.deepEqual(byClaim.get('PER_SHARE_CASH_CONSIDERATION').compare, {
    field_key: 'perShareAmount', value: '16.25',
  });
  assert.equal(byClaim.get('PER_SHARE_CASH_CONSIDERATION').review.display_value, '$16.25 per share');
  assert.equal(
    byClaim.get('PER_SHARE_CASH_CONSIDERATION').market.canonical_unit,
    'USD_PER_SHARE',
  );
  assert.deepEqual(byClaim.get('EXCHANGE_RATIO_VALUE').query, {
    field_key: 'exchangeRatio', value: '0.3869',
  });
  assert.equal(
    byClaim.get('EXCHANGE_RATIO_VALUE').market.metric_key,
    'EXCHANGE_RATIO_SHARES_PER_TARGET_SHARE',
  );
  assert.deepEqual(byClaim.get('APPRAISAL_RIGHTS_STATUS').query, {
    field_key: 'appraisalRightsAvailable', value: true,
  });
  assert.equal(
    byClaim.get('APPRAISAL_RIGHTS_STATUS').market.canonical_value,
    'AVAILABLE',
  );
  assert.doesNotMatch(JSON.stringify(projection), /"party"/);
});

test('Wave B and obligation-bearing provision shapes cannot enter the Wave A product projection', async () => {
  const quote = 'Each Share shall be converted into the right to receive $16.25 in cash as the Merger Consideration.';
  const result = await resolveConsideration([
    assertion({ kind: 'PER_SHARE_CASH', quote, considerationTerm: 'Merger Consideration' }),
  ], quote, 'deal:consideration-projection-guard');
  const [entry] = result.resolved;
  assert.throws(
    () => projectConsiderationWaveAClaims({
      resolved_entries: [{ ...entry, resolved_claim_definition_key: 'PRORATION_MECHANICS' }],
    }),
    (error) => error instanceof ConsiderationWaveAProjectionError
      && error.code === 'WAVE_B_OR_UNKNOWN_CLAIM',
  );
  assert.throws(
    () => projectConsiderationWaveAClaims({
      resolved_entries: [{
        ...entry,
        provision_instance: {
          ...entry.provision_instance,
          schema_version: 'PROVISION_INSTANCE/V1',
          party: { role: 'OBLIGOR', value: 'Company', capacity: 'TARGET' },
        },
      }],
    }),
    (error) => error instanceof ConsiderationWaveAProjectionError
      && error.code === 'NON_STRUCTURAL_PROVISION',
  );
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

test('Modiv defined-term replay resolves the ratio, preserves the preferred formula, and excludes fractional-share cash', async () => {
  const ratioQuote = 'each Company Common Share shall be automatically converted into the right to receive from Parent that number of validly issued, fully paid and nonassessable shares of Parent Common Stock equal to the Exchange Ratio';
  const fractionalQuote = 'plus the right to receive cash in lieu of fractional shares of Parent Common Stock, if any (the “Fractional Per Company Common Share Merger Consideration”)';
  const preferredQuote = 'each Company Preferred Share shall automatically be converted into the right to receive an amount in cash equal to the Per Preferred Share Liquidation Price (such amount, the “Per Company Preferred Share Merger Consideration”)';
  const source = [
    ratioQuote,
    fractionalQuote,
    preferredQuote,
    'Section 8.12 Definitions.',
    '(u) “Exchange Ratio” means 1.975.',
    '(zz) “Per Preferred Share Liquidation Price” means an amount in cash equal to Twenty-Five Dollars ($25.00) plus accrued and unpaid dividends, if any, to, but not including, the Closing Date.',
  ].join('\n');

  const result = await resolveConsideration([
    assertion({
      kind: 'EXCHANGE_RATIO', quote: ratioQuote, ratioTerm: 'Exchange Ratio', issuerStock: 'Parent Common Stock',
    }),
    assertion({
      kind: 'PER_SHARE_CASH', quote: fractionalQuote, considerationTerm: 'Fractional Per Company Common Share Merger Consideration',
    }),
    assertion({
      kind: 'PER_SHARE_CASH', quote: preferredQuote, considerationTerm: 'Per Company Preferred Share Merger Consideration',
    }),
  ], source, 'deal:modiv-defined-term-consideration');

  assert.equal(result.resolved.length, 1);
  assert.equal(result.resolved[0].resolved_claim_definition_key, 'EXCHANGE_RATIO_VALUE');
  assert.equal(result.resolved[0].claim.canonical_value, '1.975');
  assert.equal(result.resolved[0].claim.attributes.defined_term_value, '1.975');
  assert.equal(result.resolved[0].source_citation, SECTION_REFERENCE);
  assert.deepEqual(result.resolved[0].claim.attributes.defined_term_lineage, ['Exchange Ratio']);
  assert.deepEqual(result.resolved[0].claim.attributes.definition_source_citations, ['8.12(u)']);
  assert.deepEqual(
    result.resolved[0].claim.attributes.definition_source_quotes,
    ['“Exchange Ratio” means 1.975.'],
  );

  assert.equal(result.structured_per_share_cash_values.length, 1);
  assert.equal(
    result.structured_per_share_cash_values[0].schema_version,
    'STRUCTURED_PER_SHARE_CASH_VALUE/V2',
  );
  assert.deepEqual(
    {
      consideration_term_ref: result.structured_per_share_cash_values[0].consideration_term_ref,
      operator: result.structured_per_share_cash_values[0].operator,
      base_amount: result.structured_per_share_cash_values[0].base_amount,
      currency: result.structured_per_share_cash_values[0].currency,
      variable_component: result.structured_per_share_cash_values[0].variable_component,
      defined_term_lineage: result.structured_per_share_cash_values[0].defined_term_lineage,
    },
    {
      consideration_term_ref: 'Per Company Preferred Share Merger Consideration',
      operator: 'BASE_PLUS_VARIABLE',
      base_amount: '25.00',
      currency: 'USD',
      variable_component: 'accrued and unpaid dividends, if any, to, but not including, the Closing Date',
      defined_term_lineage: [
        'Per Company Preferred Share Merger Consideration',
        'Per Preferred Share Liquidation Price',
      ],
    },
  );
  assert.match(result.structured_per_share_cash_values[0].raw_formula, /\$25\.00.*plus accrued and unpaid dividends/i);
  assert.deepEqual(
    result.structured_per_share_cash_values[0].source_citations,
    [SECTION_REFERENCE, '8.12(zz)'],
  );
  assert.equal(
    result.structured_per_share_cash_values[0].definition_quote,
    '“Per Preferred Share Liquidation Price” means an amount in cash equal to Twenty-Five Dollars ($25.00) plus accrued and unpaid dividends, if any, to, but not including, the Closing Date.',
  );

  assert.equal(
    result.resolved.filter((entry) => entry.resolved_claim_definition_key === 'PER_SHARE_CASH_CONSIDERATION').length,
    0,
  );
  assert.equal(
    result.structured_per_share_cash_values.some((entry) => /fractional/i.test(entry.consideration_term_ref)),
    false,
  );
});

test('defined-term cash resolves only for a fixed amount and never flattens additional consideration', async () => {
  const variableQuote = 'Each Share shall be converted into the right to receive cash equal to the Additional Cash Consideration.';
  const variableSource = [
    variableQuote,
    'Section 8.12 Definitions.',
    '(aa) “Additional Cash Consideration” means an amount in cash equal to Twenty-Five Dollars ($25.00) plus accrued and unpaid dividends.',
  ].join('\n');
  const variable = await resolveConsideration([
    assertion({
      kind: 'PER_SHARE_CASH', quote: variableQuote, considerationTerm: 'Additional Cash Consideration',
    }),
  ], variableSource, 'deal:variable-defined-cash');

  assert.equal(variable.resolved.length, 0);
  assert.deepEqual(variable.review_queue[0].reasons, ['NO_MONEY_LITERAL']);

  const fixedQuote = 'Each Share shall be converted into the right to receive cash equal to the Fixed Cash Consideration.';
  const fixedSource = [
    fixedQuote,
    'Section 8.12 Definitions.',
    '(bb) “Fixed Cash Consideration” means an amount in cash equal to Twenty-Five Dollars ($25.00).',
  ].join('\n');
  const fixed = await resolveConsideration([
    assertion({
      kind: 'PER_SHARE_CASH', quote: fixedQuote, considerationTerm: 'Fixed Cash Consideration',
    }),
  ], fixedSource, 'deal:fixed-defined-cash');

  assert.equal(fixed.resolved.length, 1);
  assert.equal(fixed.resolved[0].claim.canonical_value, '25.00');
  assert.equal(fixed.resolved[0].source_citation, SECTION_REFERENCE);
  assert.deepEqual(
    fixed.resolved[0].claim.attributes.defined_term_lineage,
    ['Fixed Cash Consideration'],
  );
  assert.deepEqual(
    fixed.resolved[0].claim.attributes.definition_source_citations,
    ['8.12(bb)'],
  );
  assert.deepEqual(
    fixed.resolved[0].claim.attributes.definition_source_quotes,
    ['“Fixed Cash Consideration” means an amount in cash equal to Twenty-Five Dollars ($25.00).'],
  );
});
