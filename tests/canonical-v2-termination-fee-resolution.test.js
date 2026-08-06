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
  feeSideFromFeeTermRef,
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

test('MAPPING_TABLE_VERSION is 20 and TERMINATION_FEE_PARSE_VERSION is exported', () => {
  assert.equal(MAPPING_TABLE_VERSION, 20);
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
// Trigger-code / corroboration cross-check. A single corroborated code used
// to publish unconditionally (matchedCodes[0]) the instant exactly one code
// matched, with `triggerCode` (what the model actually asserted) consulted
// nowhere except the out-of-enum gate above. Two live failure modes: the
// model abstains (`trigger_code: null`) and one code matches incidentally,
// or the model asserts code A and exactly one code B != A matches -- both
// used to resolve and publish a fact the model never claimed. Fixed by
// binding the single match to `triggerCode`, mirroring the fee_side gate
// above (which already checks `corroboratedSides.includes(feeSide)`): only
// when the model's own registered code IS the single matched code does this
// resolve; a null triggerCode routes to review typed TRIGGER_NOT_ASSERTED,
// a disagreeing registered triggerCode routes to review typed
// TRIGGER_CORROBORATION_DISAGREES. TRIGGER_UNCORROBORATED (zero matches) and
// AMBIGUOUS_TRIGGER_CORROBORATION (>=2 matches), pinned above, are
// unaffected -- this block only reaches the exactly-one-match case.
//
// The quote below is copied verbatim (`JSON.stringify` round-tripped, not
// retyped) from the real recorded defect: evidence/canonical-v2/modiv-
// termination-fee-scope-correction-20260805/native-producer-recorded-
// response-7.3.json `fee_trigger_assertions[2]` records the model returning
// `trigger_code: null` for this exact quote; the companion resolution.json
// shows the PRE-FIX resolver published it as canonical_value
// STOCKHOLDER_APPROVAL_FAILURE_TERMINATION anyway -- a code the model never
// asserted, minted from one incidental match: the quote's subordinate
// timing clause names the "Company Common Stockholders' Meeting", but the
// clause's own operative subject is a topping-fee condition (a Company
// Acquisition Proposal received/announced, then a definitive agreement
// signed within twelve months), not a stockholder-vote-failure ground.
// ---------------------------------------------------------------------------

const MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE = '(A) (1) by the Company or Parent pursuant to Section 7.1(b)(ii) and a Company Acquisition Proposal shall have been received by the Company or its Representatives after the date of this Agreement or (2) by the Company or Parent pursuant to Section 7.1(b)(iii) and a Person shall have publicly proposed or publicly announced, after the date hereof and prior to the Company Common Stockholders’ Meeting, an intention (whether or not conditional) to make a Company Acquisition Proposal and (B) within twelve (12) months after a termination referred to in this Section 7.3(b)(iii) the Company enters into a definitive agreement relating to, or consummates, any Company Acquisition Proposal';

test('regression pin (real recorded bytes): the Modiv 7.3(b)(iii) topping-fee quote matches exactly one trigger code, STOCKHOLDER_APPROVAL_FAILURE_TERMINATION, incidentally via its subordinate "Stockholders’ Meeting" timing clause', () => {
  assert.deepEqual(
    feeTriggerCorroboratedCodes(MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE),
    ['STOCKHOLDER_APPROVAL_FAILURE_TERMINATION'],
    'pins the real recorded quote\'s single-match shape so a future pattern-table edit cannot silently change what this fixture exercises',
  );
});

test('acceptance 1 / regression (real recorded Modiv bytes, the live wrong-answer bug): model asserts null trigger_code, patterns match exactly one code -> routes to review typed TRIGGER_NOT_ASSERTED, never resolves', async () => {
  const wrapped = `the Company shall pay Parent the Company Termination Fee if ${MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE}`;
  const { resolution } = await resolveTerminationFeeAssertions('deal:modiv-trigger-not-asserted', wrapped, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: null, quote: wrapped })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 0, 'must never publish a trigger code the model did not assert -- this exact shape published live pre-fix');
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['TRIGGER_NOT_ASSERTED']);
  assert.equal(item.concept_key, 'TERMF-TARGET');
  assert.equal(item.materiality_rank, 20);
});

test('acceptance 2: model asserts a registered code that disagrees with the single matched code -> routes to review typed TRIGGER_CORROBORATION_DISAGREES, distinct from TRIGGER_NOT_ASSERTED', async () => {
  const wrapped = `the Company shall pay Parent the Company Termination Fee if ${MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE}`;
  const { resolution } = await resolveTerminationFeeAssertions('deal:trigger-corroboration-disagrees', wrapped, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'OUTSIDE_DATE_TERMINATION', quote: wrapped })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 0, 'must not publish the model\'s disagreeing code, and must not publish the text\'s matched code either');
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['TRIGGER_CORROBORATION_DISAGREES']);
  assert.equal(item.concept_key, 'TERMF-TARGET');
  assert.equal(item.materiality_rank, 20);
});

test('acceptance 3 (no regression): model asserts a registered code that equals the single matched code -> resolves exactly as before', async () => {
  const wrapped = `the Company shall pay Parent the Company Termination Fee if ${MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE}`;
  const { resolution } = await resolveTerminationFeeAssertions('deal:trigger-corroboration-agrees', wrapped, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION', quote: wrapped })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION');
  assert.equal(resolved[0].concept_key, 'TERMF-TARGET');
  assert.equal(resolved[0].claim.attributes.trigger_code, 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION');
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

// ---------------------------------------------------------------------------
// Modiv §8.12 scope-correction regression (evidence/canonical-v2/modiv-
// termination-fee-scope-correction-20260805, 2026-08-05 -- resolution.json,
// native-producer-recorded-response-8.12.json). A live run correctly
// extracted three termination-fee amounts governed by defined terms
// "Company Base Amount" / "Parent Base Amount" and the resolver rejected
// all three FEE_SIDE_UNCORROBORATED: the corroboration table only
// recognised "Termination Fee"/"Termination Payment" as fee-noun heads,
// and handleFeeAmountCandidate (unlike handleFeeTriggerCandidate) had no
// fallback for a quote fragment that carries no party word of its own.
//
// Two changes, proved separately below:
//   1. FEE_SIDE_CORROBORATION_TABLE gained one more pattern per side,
//      generalising "Company/Parent <=1 word> Fee|Payment|Amount" instead
//      of hardcoding "Base Amount" as a fourth literal phrase.
//   2. handleFeeAmountCandidate gained feeSideFromFeeTermRef, an
//      amount-family analogue of the trigger handler's long-standing
//      feeSideFromFullPaymentContext fallback -- closing the asymmetry --
//      implemented against the candidate's OWN fee_term_ref attribute
//      rather than a whole-section scan (see that function's own comment
//      in candidate-resolution.js for why a section-text scan is unsafe
//      here: §8.12 defines BOTH sides' terms together, so "does this
//      side's pattern appear anywhere in the section" would confirm
//      either claimed side and stop discriminating at all).
//
// Every quote below is copied verbatim from the recorded model response.
// ---------------------------------------------------------------------------

const MODIV_COMPANY_BASE_X_QUOTE = '“Company Base Amount” means (x) if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii), $10,000,000';
const MODIV_COMPANY_BASE_Y_QUOTE = '(y) if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v), $15,000,000.00';
const MODIV_PARENT_BASE_QUOTE = '“Parent Base Amount” means $15,000,000.00';

test('fee_side corroboration: Modiv "Company Base Amount" (x)-limb quote corroborates SELLER via the new party-headed defined-term pattern', () => {
  assert.deepEqual(feeSideCorroboratedSides(MODIV_COMPANY_BASE_X_QUOTE), ['SELLER']);
});

test('fee_side corroboration: Modiv "Parent Base Amount" quote corroborates BUYER via the new party-headed defined-term pattern', () => {
  assert.deepEqual(feeSideCorroboratedSides(MODIV_PARENT_BASE_QUOTE), ['BUYER']);
});

test('fee_side corroboration: the Modiv (y)-limb continuation quote corroborates NEITHER side directly -- it carries no party word at all, only a $ figure and a cross-reference', () => {
  assert.deepEqual(feeSideCorroboratedSides(MODIV_COMPANY_BASE_Y_QUOTE), []);
});

test('feeSideFromFeeTermRef: the (y)-limb\'s own asserted fee_term_ref ("Company Base Amount") corroborates SELLER even though the quote itself does not', () => {
  assert.equal(feeSideFromFeeTermRef('Company Base Amount', 'SELLER'), 'SELLER');
  assert.equal(feeSideFromFeeTermRef('Parent Base Amount', 'BUYER'), 'BUYER');
});

test('feeSideFromFeeTermRef fails closed: a claimed side that contradicts its own fee_term_ref never corroborates the wrong side', () => {
  assert.equal(feeSideFromFeeTermRef('Company Base Amount', 'BUYER'), null);
  assert.equal(feeSideFromFeeTermRef('Parent Base Amount', 'SELLER'), null);
});

test('feeSideFromFeeTermRef: null, empty and undefined fee_term_ref never corroborate', () => {
  assert.equal(feeSideFromFeeTermRef(null, 'SELLER'), null);
  assert.equal(feeSideFromFeeTermRef('', 'SELLER'), null);
  assert.equal(feeSideFromFeeTermRef(undefined, 'BUYER'), null);
});

test('Modiv "Company Base Amount" (x)-limb resolves end to end: SELLER, TERMF-TARGET, canonical 10000000 (was FEE_SIDE_UNCORROBORATED live)', async () => {
  const { resolution } = await resolveTerminationFeeAssertions('deal:modiv-812-x', MODIV_COMPANY_BASE_X_QUOTE, {
    fee_amount_assertions: [feeAmountAssertion({
      sectionReference: '8.12', feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_X_QUOTE,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, '10000000');
  assert.equal(resolved[0].concept_key, 'TERMF-TARGET');
  assert.equal(resolved[0].claim.attributes.fee_side, 'SELLER');
});

test('Modiv "Parent Base Amount" limb resolves end to end: BUYER, TERMF-REVERSE, canonical 15000000.00 (was FEE_SIDE_UNCORROBORATED live)', async () => {
  const { resolution } = await resolveTerminationFeeAssertions('deal:modiv-812-parent', MODIV_PARENT_BASE_QUOTE, {
    fee_amount_assertions: [feeAmountAssertion({
      sectionReference: '8.12', feeSide: 'BUYER', payerParty: 'Parent', feeTermRef: 'Parent Base Amount', quote: MODIV_PARENT_BASE_QUOTE,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, '15000000.00');
  assert.equal(resolved[0].concept_key, 'TERMF-REVERSE');
  assert.equal(resolved[0].claim.attributes.fee_side, 'BUYER');
});

test('Modiv (y)-limb: fee_side now correctly corroborates SELLER via the new fallback (was FEE_SIDE_UNCORROBORATED live); still queues honestly on the pre-existing Dyax-shape fee_term_ref gate (spec section 1, audit M-2) rather than auto-resolving', async () => {
  const { resolution } = await resolveTerminationFeeAssertions('deal:modiv-812-y', MODIV_COMPANY_BASE_Y_QUOTE, {
    fee_amount_assertions: [feeAmountAssertion({
      sectionReference: '8.12', feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_Y_QUOTE,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 0, 'the (y)-limb quote never contains "Company Base Amount" verbatim -- the same far-side-of-the-term shape the spec already pinned for Dyax, never implementer discretion to relax');
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_TERM_NOT_IN_QUOTE'], 'right fee side, wrong-gate rejection -- NOT FEE_SIDE_UNCORROBORATED as it was live');
  assert.equal(item.concept_key, 'TERMF-TARGET', 'concept assignment happened, which only occurs AFTER fee_side corroboration passes -- proves fee_side resolved SELLER before the fee_term_ref gate ran');
});

test('genuine fee language is unaffected by the widening: a plain "Company Termination Fee" quote still resolves via the pre-existing exact-phrase pattern, not the new one', async () => {
  const quote = 'the Company shall pay Parent a fee in the amount of $12,000,000 (the "Company Termination Fee")';
  const { resolution } = await resolveTerminationFeeAssertions('deal:genuine-fee-language-unaffected', quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Termination Fee', quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, '12000000');
  assert.equal(resolved[0].concept_key, 'TERMF-TARGET');
});

// ---------------------------------------------------------------------------
// Hostile tests (brief requirement): a dollar figure that merely sits near
// party language -- an expense, a threshold, a share price -- must stay
// rejected. These exercise the SAME widened table end to end, with a
// producer that (wrongly) asserts fee_side/fee_term_ref for a quote that
// carries no genuine fee-establishing language at all.
// ---------------------------------------------------------------------------

test('hostile: a per-share consideration figure near "Company Common Stock" is still rejected FEE_SIDE_UNCORROBORATED -- a share price must never become a termination fee', async () => {
  const quote = '$50.00 in cash, without interest, for each share of Company Common Stock';
  const { resolution } = await resolveTerminationFeeAssertions('deal:hostile-share-price', quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Common Stock', quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_SIDE_UNCORROBORATED']);
  assert.equal(item.concept_key, TERMF_PENDING_CONCEPT_FAMILY);
});

test('hostile: a Company Material Adverse Effect dollar threshold is still rejected FEE_SIDE_UNCORROBORATED -- a threshold must never become a termination fee', async () => {
  const quote = 'losses arising from a Company Material Adverse Effect in excess of $50,000,000 in the aggregate';
  const { resolution } = await resolveTerminationFeeAssertions('deal:hostile-mae-threshold', quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Material Adverse Effect', quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_SIDE_UNCORROBORATED']);
});

test('hostile: an expense-reimbursement figure with a bare "Company" mention is still rejected FEE_SIDE_UNCORROBORATED -- an expense must never become a termination fee', async () => {
  const quote = 'the Company shall reimburse Parent for documented out-of-pocket expenses not to exceed $2,000,000';
  const { resolution } = await resolveTerminationFeeAssertions('deal:hostile-expense-reimbursement', quote, {
    fee_amount_assertions: [feeAmountAssertion({
      feeSide: 'BUYER', payerParty: 'the Company', feeTermRef: 'expenses', quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_SIDE_UNCORROBORATED']);
});

test('hostile: a same-shape but unrelated "Company <word> Amount" defined term two words from the party head is still rejected -- the tightened one-word cap does not extend the pattern that far', () => {
  const quote = 'the Company Working Capital Amount shall be no less than $5,000,000 as of the Measurement Time';
  assert.deepEqual(feeSideCorroboratedSides(quote), []);
});
