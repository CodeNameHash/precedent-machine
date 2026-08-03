'use strict';

/**
 * tests/canonical-v2-termination-fee-resolution.test.js
 *
 * Acceptance tests 4, 5 (docs/superpowers/specs/2026-08-02-family-
 * termination-fee-design.md, section 6): resolution end to end over the
 * committed fixture quotes (tests/fixtures/canonical-v2/termination-fee/
 * quotes.json), and identity.
 *
 * Per the spec's own "No recorded native runs exist for this family" note
 * (Deliverable section) and the P1 M-5 pre-rerun-harness precedent: this
 * file drives the resolver with SYNTHETIC compiled candidates -- built via
 * the real anthropic-provider.js shaping path (shapeTerminationFeeProposals)
 * over a stub provider response, run through the real
 * runNativeExtraction/resolveCandidates pipeline -- carrying the committed
 * fixture's real, byte-verified quotes. This is explicitly the PRE-RERUN
 * harness; no claim here or in any report may say this family "extracts
 * natively" until the dated post-merge live-run handoffs land.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV15 } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeTerminationFeeProposals,
  FEE_AMOUNT_CLAIM_KEY,
  FEE_TRIGGER_CLAIM_KEY,
  FEE_TAIL_PERIOD_CLAIM_KEY,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates,
  materialityFor,
  MATERIALITY_TABLE,
  TERMF_PENDING_CONCEPT_FAMILY,
  feeSideCorroboratedSides,
  feeTriggerCorroboratedCodes,
  MAPPING_TABLE_VERSION,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { TERMINATION_FEE_PARSE_VERSION } = require('../lib/canonical-v2/native-producer/termination-fee-parse');

// ─── Fixture: identity admitted-source chain (copied from
// tests/canonical-v2-p1-captable-numerics-resolution.test.js -- see that
// file's own comment for why a hand-built identity source map is required
// instead of running text through the real SEC-HTML converter). ───

function buildIdentityAdmittedSourceContext(text, { dealKey, dealAdmissionId, sourceOrdinal = 0 }) {
  const bytes = Buffer.from(text, 'utf8');
  const byteLength = bytes.length;
  const canonicalTextSha256 = sha256Hex(bytes);
  const compact = {
    schema_version: 'SEC_CANONICAL_TEXT_SOURCE_MAP/V2',
    input_regions: [[0, byteLength, 'TEXT', null]],
    output_mappings: [[0, byteLength, 0, byteLength, 'TEXT']],
  };
  const sourceMapBytes = Buffer.from(canonicalJson(compact), 'utf8');
  const compressed = zlib.deflateRawSync(sourceMapBytes, { level: 9, windowBits: 15, memLevel: 8 });
  const sourceMapDigest = contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', compact);

  const sourceResponseContentId = sha256Hex(Buffer.concat([Buffer.from('RESPONSE/V1'), bytes]));
  const intakeCaptureReceiptId = sha256Hex(`INTAKE/V1:${sourceResponseContentId}`);
  const converterDigest = sha256Hex('IDENTITY_CONVERTER/V1');
  const converterConfigDigest = sha256Hex('IDENTITY_CONVERTER_CONFIG/V1');
  const verifierDigest = sha256Hex('IDENTITY_VERIFIER/V1');
  const verificationManifestId = sha256Hex(`VERIFICATION_MANIFEST/V1:${sourceResponseContentId}`);

  const canonicalTextId = contentId('SEC_CANONICAL_TEXT/V2', {
    source_response_content_id: sourceResponseContentId,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_digest: sourceMapDigest,
  });

  const conversion = {
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2',
    conversion_stage: 'CONVERSION_ONLY',
    verification_status: 'NOT_ATTEMPTED',
    source_admission_status: 'NOT_ATTEMPTED',
    source_response_content_id: sourceResponseContentId,
    intake_capture_receipt_id: intakeCaptureReceiptId,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    canonical_text: text,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_payload_base64: compressed.toString('base64'),
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    canonical_text_id: canonicalTextId,
  };

  const immutableBody = {
    schema_version: 'IMMUTABLE_SOURCE_DOCUMENT/V2',
    source_kind: 'ORIGINAL_BYTES',
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES',
    source_response_content_id: sourceResponseContentId,
    intake_capture_receipt_id: intakeCaptureReceiptId,
    response_content_type: 'text/html',
    response_bytes_sha256: sha256Hex(bytes),
    response_byte_length: byteLength,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    verifier_digest: verifierDigest,
    verification_manifest_id: verificationManifestId,
  };
  const immutable = {
    ...immutableBody,
    immutable_source_document_id: contentId('IMMUTABLE_SOURCE_DOCUMENT/V2', immutableBody),
  };

  const coverageProofDigest = contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
    canonical_text_id: canonicalTextId,
    canonical_text_byte_length: byteLength,
    source_map_digest: sourceMapDigest,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    discrepancy_count: 0,
  });
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2',
    admission_state: 'VERIFIED',
    source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_response_content_id: sourceResponseContentId,
    canonical_text_id: canonicalTextId,
    verification_manifest_id: verificationManifestId,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    conversion_loss_residual_ids: [],
    discrepancy_count: 0,
    blocking_discrepancy_count: 0,
    coverage_proof_digest: coverageProofDigest,
  };
  const admission = {
    ...admissionBody,
    source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody),
  };

  const envelopeBody = {
    schema_version: 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
    input_status: 'READY_FOR_OFFLINE_PROPOSAL',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    immutable_source_document_id: immutable.immutable_source_document_id,
    source_admission_manifest_id: admission.source_admission_manifest_id,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING,
    source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest,
    verification_manifest_id: verificationManifestId,
    admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [],
    semantic_extraction_status: 'NOT_ATTEMPTED',
  };
  const envelope = {
    ...envelopeBody,
    semantic_extraction_input_envelope_id: contentId('SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1', envelopeBody),
  };

  return buildAdmittedSemanticSourceContext({
    immutable_source_document: immutable,
    source_admission_manifest: admission,
    semantic_extraction_input_envelope: envelope,
    conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: sourceOrdinal,
  });
}

// ---------------------------------------------------------------------------
// Fixture quotes (committed verbatim from the spec -- see the fixture
// file's own header note).
// ---------------------------------------------------------------------------

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'termination-fee', 'quotes.json');
const FIXTURES = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
function quoteById(id) {
  const entry = FIXTURES.quotes.find((q) => q.id === id);
  assert.ok(entry, `expected a fixture quote with id ${id}`);
  return entry;
}

const SECTION_REFERENCE = '3.1(b)';

function wrapInAgreementShell(sectionBody) {
  return [
    'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
    'Buyer, Inc. and the Company.\n\n',
    'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
    'Section 3.1 Representations Concerning the Company.\n\n',
    '(a)Organization; Standing. The Company is a corporation duly organized, ',
    'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
    '(b)Termination Fee.\n',
    sectionBody,
    '\n',
  ].join('');
}

const CONTRACT_BUNDLE_V15 = compileFixtureContractV15();

function buildSourceAndContext(dealKey, sectionBody) {
  const sourceText = wrapInAgreementShell(sectionBody);
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));
  const admittedSourceContext = buildIdentityAdmittedSourceContext(sourceText, {
    dealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
    sourceOrdinal: 0,
  });
  return { sourceText, documentHash, admittedSourceContext };
}

async function resolveTerminationFeeAssertions(dealKey, sectionBody, response) {
  const { sourceText, documentHash, admittedSourceContext } = buildSourceAndContext(dealKey, sectionBody);
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT_BUNDLE_V15,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationFeeProposals(
        {
          fee_amount_assertions: response.fee_amount_assertions || [],
          fee_trigger_assertions: response.fee_trigger_assertions || [],
          tail_period_assertions: response.tail_period_assertions || [],
          open_world_candidates: response.open_world_candidates || [],
        },
        governedScope.source_text,
      );
      return {
        provider_id: 'termination-fee-test/v1',
        model_id: 'stub-model',
        prompt: 'termination-fee-test-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE_V15,
    admitted_source_context: admittedSourceContext,
  });
  return { receipt, resolution, sourceText, documentHash, admittedSourceContext };
}

function feeAmountAssertion({
  sectionReference = SECTION_REFERENCE, feeSide, payerParty, feeTermRef, quote,
}) {
  return {
    section_reference: sectionReference, fee_side: feeSide, payer_party: payerParty, fee_term_ref: feeTermRef, quote,
  };
}

function feeTriggerAssertion({ sectionReference = SECTION_REFERENCE, feeSide, triggerCode = null, quote }) {
  return { section_reference: sectionReference, fee_side: feeSide, trigger_code: triggerCode, quote };
}

function tailPeriodAssertion({ sectionReference = SECTION_REFERENCE, quote }) {
  return { section_reference: sectionReference, quote };
}

// ---------------------------------------------------------------------------
// Materiality rank pin (spec section 4/6): rank 20, via the existing
// TERMF- prefix -- BOTH on a resolved claim AND on a pre-concept review
// item carrying conceptFamily TERMF-PENDING (audit M-3 refactor-proof pin).
// ---------------------------------------------------------------------------

test('materiality rank 20 asserted on TERMF-TARGET/TERMF-REVERSE/TERMF-TAIL and on the TERMF-PENDING routing token', () => {
  const feesTier = MATERIALITY_TABLE.find((t) => t.label === 'FEES');
  assert.equal(feesTier.rank, 20);
  assert.deepEqual(
    materialityFor({ conceptKey: 'TERMF-TARGET', canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT' }),
    feesTier,
  );
  assert.deepEqual(
    materialityFor({ conceptKey: 'TERMF-REVERSE', canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT' }),
    feesTier,
  );
  assert.deepEqual(
    materialityFor({ conceptKey: 'TERMF-TAIL', canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS' }),
    feesTier,
  );
  assert.deepEqual(
    materialityFor({ conceptKey: TERMF_PENDING_CONCEPT_FAMILY, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT' }),
    feesTier,
    'TERMF-PENDING is a routing token that prefix-matches TERMF- -> rank 20 (audit M-3)',
  );
});

test('MAPPING_TABLE_VERSION is 18 and TERMINATION_FEE_PARSE_VERSION is exported', () => {
  assert.equal(MAPPING_TABLE_VERSION, 18);
  assert.equal(TERMINATION_FEE_PARSE_VERSION, 1);
});

// ---------------------------------------------------------------------------
// Corroboration table unit checks (real spec-quoted bytes).
// ---------------------------------------------------------------------------

test('fee_side corroboration: Bioverativ-style SELLER quote corroborates SELLER only', () => {
  const q = quoteById('bioverativ-target-amount');
  assert.deepEqual(feeSideCorroboratedSides(q.quote), ['SELLER']);
});

test('fee_side corroboration: Covance trigger-only quote corroborates NEITHER side', () => {
  const q = quoteById('covance-reverse-extended');
  assert.deepEqual(feeSideCorroboratedSides(q.trigger_only_subquote), []);
});

test('fee_side corroboration: Covance extended (pay-limb-included) quote corroborates BUYER', () => {
  const q = quoteById('covance-reverse-extended');
  assert.deepEqual(feeSideCorroboratedSides(q.quote), ['BUYER']);
});

test('fee_side corroboration: Concho two-sided quote corroborates BOTH sides (AMBIGUOUS_FEE_SIDE case)', () => {
  const q = quoteById('concho-two-sided-fee-side');
  assert.deepEqual([...feeSideCorroboratedSides(q.quote)].sort(), ['BUYER', 'SELLER']);
});

test('trigger corroboration: Bioverativ section-cite-only quote matches ZERO trigger codes', () => {
  const q = quoteById('bioverativ-trigger-section-cite-only');
  assert.deepEqual(feeTriggerCorroboratedCodes(q.quote), []);
});

test('trigger corroboration: Concho full multi-ground quote matches >=2 codes; narrowed sub-quote matches exactly CHANGE_IN_RECOMMENDATION_TERMINATION', () => {
  const q = quoteById('concho-target-trigger');
  const fullMatches = feeTriggerCorroboratedCodes(q.quote);
  assert.ok(fullMatches.length >= 2, `expected >=2 matches, got ${JSON.stringify(fullMatches)}`);
  const narrowedMatches = feeTriggerCorroboratedCodes(q.narrowed_subquote);
  assert.deepEqual(narrowedMatches, ['CHANGE_IN_RECOMMENDATION_TERMINATION']);
});

// ---------------------------------------------------------------------------
// End-to-end resolution: fee amount claims.
// ---------------------------------------------------------------------------

test('Bioverativ TERMF-TARGET amount resolves end to end: SELLER side, concept TERMF-TARGET, canonical 326000000', async () => {
  const q = quoteById('bioverativ-target-amount');
  const { resolution } = await resolveTerminationFeeAssertions('deal:bioverativ', q.quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Termination Fee', quote: q.quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].resolved_claim_definition_key, 'TERMINATION_FEE_AMOUNT');
  assert.equal(resolved[0].claim.canonical_value, '326000000');
  assert.equal(resolved[0].concept_key, 'TERMF-TARGET');
  assert.equal(resolved[0].triage.materiality_rank, 20);
});

test('European Wax Center TERMF-REVERSE amount resolves end to end: BUYER side, concept TERMF-REVERSE, canonical 19000000', async () => {
  const q = quoteById('ewc-reverse-amount');
  const { resolution } = await resolveTerminationFeeAssertions('deal:ewc', q.quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'BUYER', payerParty: 'Parent', feeTermRef: 'Parent Termination Fee', quote: q.quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, '19000000');
  assert.equal(resolved[0].concept_key, 'TERMF-REVERSE');
});

test('Covance extended fixture resolves TERMF-REVERSE via its own pay limb (audit M-6)', async () => {
  const q = quoteById('covance-reverse-extended');
  const { resolution } = await resolveTerminationFeeAssertions('deal:covance', q.quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'BUYER', payerParty: 'Parent', feeTermRef: 'Parent Termination Fee', quote: q.quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, q.expected_amount_canonical);
  assert.equal(resolved[0].concept_key, 'TERMF-REVERSE');
});

test('CSRA cross-reference-only quote routes to review, typed NO_MONEY_LITERAL, concept TERMF-TARGET (fee_side already corroborated)', async () => {
  const q = quoteById('csra-cross-reference-only');
  const { resolution } = await resolveTerminationFeeAssertions('deal:csra', `the Company shall pay Parent as provided in ${q.quote}`, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Termination Fee',
      quote: `the Company shall pay Parent as provided in ${q.quote}`,
    })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item, 'expected a review_queue item');
  assert.ok(item.reasons.includes('NO_MONEY_LITERAL'));
  assert.equal(item.concept_key, 'TERMF-TARGET');
  assert.equal(item.materiality_rank, 20);
});

test('Concho §8.3(e)/(f) two-sided fee_side text routes to review, typed AMBIGUOUS_FEE_SIDE, concept TERMF-PENDING, never resolves', async () => {
  const q = quoteById('concho-two-sided-fee-side');
  const { resolution } = await resolveTerminationFeeAssertions('deal:concho-ambiguous-side', q.quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Termination Fee', quote: q.quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['AMBIGUOUS_FEE_SIDE']);
  assert.equal(item.concept_key, TERMF_PENDING_CONCEPT_FAMILY);
  assert.equal(item.materiality_rank, 20);
});

test('Dyax BUYER split limb routes to review, typed FEE_TERM_UNIDENTIFIED (audit M-2 named case)', async () => {
  const q = quoteById('dyax-compound-two-sided');
  const { resolution } = await resolveTerminationFeeAssertions('deal:dyax-buyer-limb', q.buyer_split_subquote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'BUYER', payerParty: 'Parent', feeTermRef: null, quote: q.buyer_split_subquote,
    })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_TERM_UNIDENTIFIED']);
});

test('a fee_term_ref not present in the quote routes to review, typed FEE_TERM_NOT_IN_QUOTE', async () => {
  const q = quoteById('bioverativ-target-amount');
  const { resolution } = await resolveTerminationFeeAssertions('deal:fee-term-not-in-quote', q.quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Break-Up Fee', quote: q.quote,
    })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_TERM_NOT_IN_QUOTE']);
});

test('an out-of-enum fee_side routes to open world, typed FEE_SIDE_OUT_OF_ENUM', async () => {
  const q = quoteById('bioverativ-target-amount');
  const { resolution } = await resolveTerminationFeeAssertions('deal:fee-side-out-of-enum', q.quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'MERGER_SUB', payerParty: 'the Company', feeTermRef: 'Termination Fee', quote: q.quote,
    })],
  });
  const item = resolution.open_world.find((r) => r.claim_definition_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item);
  assert.equal(item.reason, 'FEE_SIDE_OUT_OF_ENUM');
});

// ---------------------------------------------------------------------------
// End-to-end resolution: fee trigger claims.
// ---------------------------------------------------------------------------

test('Bioverativ section-cite-only trigger quote routes to review, typed TRIGGER_UNCORROBORATED', async () => {
  const q = quoteById('bioverativ-trigger-section-cite-only');
  const wrappedQuote = `the Company shall pay Parent if the Company terminates ${q.quote}`;
  const { resolution } = await resolveTerminationFeeAssertions('deal:bioverativ-trigger', wrappedQuote, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: null, quote: wrappedQuote })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['TRIGGER_UNCORROBORATED']);
});

test('Concho full multi-ground trigger quote routes to review, typed AMBIGUOUS_TRIGGER_CORROBORATION; the narrowed sub-quote resolves CHANGE_IN_RECOMMENDATION_TERMINATION', async () => {
  const q = quoteById('concho-target-trigger');
  const fullWrapped = `the Company shall pay Parent the Company Termination Fee if ${q.quote}`;
  const { resolution: fullResolution } = await resolveTerminationFeeAssertions('deal:concho-trigger-full', fullWrapped, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'CHANGE_IN_RECOMMENDATION_TERMINATION', quote: fullWrapped })],
  });
  const fullItem = fullResolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(fullItem);
  assert.deepEqual(fullItem.reasons, ['AMBIGUOUS_TRIGGER_CORROBORATION']);

  const narrowedWrapped = `the Company shall pay Parent the Company Termination Fee ${q.narrowed_subquote}`;
  const { resolution: narrowedResolution } = await resolveTerminationFeeAssertions('deal:concho-trigger-narrowed', narrowedWrapped, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'CHANGE_IN_RECOMMENDATION_TERMINATION', quote: narrowedWrapped })],
  });
  const resolved = narrowedResolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, 'CHANGE_IN_RECOMMENDATION_TERMINATION');
  assert.equal(resolved[0].concept_key, 'TERMF-TARGET');
});

test('an out-of-enum trigger_code routes to open world, typed TRIGGER_CODE_OUT_OF_ENUM, via explicit pushOpenWorld', async () => {
  const quote = 'the Company shall pay Parent the Company Termination Fee if the Company terminates due to a regulatory antitrust failure';
  const { resolution } = await resolveTerminationFeeAssertions('deal:trigger-out-of-enum', quote, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'ANTITRUST_FAILURE', quote })],
  });
  const item = resolution.open_world.find((r) => r.claim_definition_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.equal(item.reason, 'TRIGGER_CODE_OUT_OF_ENUM');
});

// ---------------------------------------------------------------------------
// End-to-end resolution: tail-period claims.
// ---------------------------------------------------------------------------

test('Cooper Tire tail quote routes to review, typed ANNIVERSARY_PHRASE, concept TERMF-TAIL', async () => {
  const q = quoteById('cooper-tail-anniversary');
  const { resolution } = await resolveTerminationFeeAssertions('deal:cooper-tail', q.quote, {
    tail_period_assertions: [tailPeriodAssertion({ quote: q.quote })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TAIL_PERIOD_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['ANNIVERSARY_PHRASE']);
  assert.equal(item.concept_key, 'TERMF-TAIL');
  assert.equal(item.materiality_rank, 20);
});

test('a plain twelve-month tail quote resolves end to end: concept TERMF-TAIL, canonical 12, SELLER-side FEE_PAYER party', async () => {
  const quote = 'if within twelve (12) months following such termination the Company enters into a definitive agreement with respect to a Company Takeover Proposal, the Company shall pay Parent the Termination Fee';
  const { resolution } = await resolveTerminationFeeAssertions('deal:tail-twelve-months', quote, {
    tail_period_assertions: [tailPeriodAssertion({ quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TAIL_PERIOD_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, '12');
  assert.equal(resolved[0].concept_key, 'TERMF-TAIL');
  assert.equal(resolved[0].party.capacity, 'TARGET');
});

test('Concho mixed-unit tail quote routes to review, typed MULTIPLE_PERIOD_LITERALS (audit M-4)', async () => {
  const q = quoteById('concho-tail-mixed-units');
  const { resolution } = await resolveTerminationFeeAssertions('deal:concho-tail-mixed', q.quote, {
    tail_period_assertions: [tailPeriodAssertion({ quote: q.quote })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TAIL_PERIOD_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['MULTIPLE_PERIOD_LITERALS']);
});

test('a BUYER-pattern tail quote routes to review, typed TAIL_SIDE_BEARING, never resolves (audit m-4)', async () => {
  const quote = 'if within twelve (12) months following such termination Parent shall pay the Company an amount equal to the fee';
  const { resolution } = await resolveTerminationFeeAssertions('deal:tail-side-bearing', quote, {
    tail_period_assertions: [tailPeriodAssertion({ quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TAIL_PERIOD_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TAIL_PERIOD_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['TAIL_SIDE_BEARING']);
});

// ---------------------------------------------------------------------------
// Identity (acceptance test 5): Concho's $300M SELLER + $450M BUYER
// same-article claims mint distinct stable identities.
// ---------------------------------------------------------------------------

test('identity: SELLER + BUYER amounts in the same article mint distinct, stable claim identities; re-run is byte-stable', async () => {
  const q = quoteById('concho-two-defined-term-amounts');
  const combinedBody = `${q.seller_quote}\n${q.buyer_quote}`;
  const response = {
    fee_amount_assertions: [
      feeAmountAssertion({ feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Termination Fee', quote: q.seller_quote }),
      feeAmountAssertion({ feeSide: 'BUYER', payerParty: 'Parent', feeTermRef: 'Parent Termination Fee', quote: q.buyer_quote }),
    ],
  };
  const { resolution: run1 } = await resolveTerminationFeeAssertions('deal:concho-identity', combinedBody, response);
  const resolved1 = run1.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved1.length, 2);
  const seller1 = resolved1.find((r) => r.claim.canonical_value === q.expected_seller_amount_canonical);
  const buyer1 = resolved1.find((r) => r.claim.canonical_value === q.expected_buyer_amount_canonical);
  assert.ok(seller1 && buyer1);
  assert.notEqual(seller1.claim.closure_id, buyer1.claim.closure_id, 'distinct, non-deduping claim identities');

  const { resolution: run2 } = await resolveTerminationFeeAssertions('deal:concho-identity', combinedBody, response);
  const resolved2 = run2.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  const seller2 = resolved2.find((r) => r.claim.canonical_value === q.expected_seller_amount_canonical);
  const buyer2 = resolved2.find((r) => r.claim.canonical_value === q.expected_buyer_amount_canonical);
  assert.equal(seller1.claim.closure_id, seller2.claim.closure_id, 're-run is byte-stable (SELLER)');
  assert.equal(buyer1.claim.closure_id, buyer2.claim.closure_id, 're-run is byte-stable (BUYER)');
});

// ---------------------------------------------------------------------------
// Additivity re-pin (P1 M-1 precedent, spec section 4): with no
// termination-fee input, resolution output must be byte-identical EXCEPT
// mapping_table_version, contract_vocabulary_digest (V15), the new parser-
// version field, and the recomputed resolution_receipt_id.
// ---------------------------------------------------------------------------

test('additivity: the resolution receipt carries termination_fee_parse_version unconditionally, alongside the bumped mapping_table_version', async () => {
  const q = quoteById('bioverativ-target-amount');
  const { resolution } = await resolveTerminationFeeAssertions('deal:additivity-pin', q.quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Termination Fee', quote: q.quote,
    })],
  });
  assert.equal(resolution.resolution_receipt.termination_fee_parse_version, TERMINATION_FEE_PARSE_VERSION);
  assert.equal(resolution.resolution_receipt.mapping_table_version, MAPPING_TABLE_VERSION);
});

