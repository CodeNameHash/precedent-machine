'use strict';

/**
 * tests/canonical-v2-termination-fee-producer-prompt.test.js
 *
 * Covers the PROMPT_VERSION 2 change to termination-fee-producer-prompt.js:
 * the old ONE AMOUNT PER QUOTE rule is renamed SPLIT COMPOUND SENTENCES BY
 * LIMB and reworked so a split limb's quote can never sever the fee_term_ref
 * that defines it. The defect this fixes is real, not hypothetical: a
 * recorded Modiv/Global Net Lease run (evidence/canonical-v2/modiv-
 * termination-fee-scope-correction-20260805/native-producer-recorded-
 * response-8.12.json) split "Company Base Amount" 's (y) branch into a
 * bare-fragment quote with no defining term in it at all, and (separately,
 * the deeper problem) let the (x) branch resolve alone to a flat
 * $10,000,000 even though the real amount is conditional on which of six
 * termination grounds fires.
 *
 * Two kinds of coverage:
 *  - text-content guards on INSTRUCTIONS/RESPONSE_SHAPE (mirrors
 *    tests/canonical-v2-capitalisation-producer-prompt.test.js's own style
 *    of tying a phrase to the rule it belongs to, not just asserting
 *    presence);
 *  - end-to-end resolution tests proving what the NEW rule's shape does
 *    against the REAL, unmodified resolver -- candidate-resolution.js is
 *    NOT touched by this change. The harness below is copied from
 *    tests/canonical-v2-termination-fee-resolution.test.js, which itself
 *    documents copying it from tests/canonical-v2-p1-captable-numerics-
 *    resolution.test.js -- per-file duplication of this identity-admitted-
 *    source-context builder is this repo's own established precedent, not
 *    a new pattern introduced here.
 *
 * No live model call is made anywhere in this file: every fee_amount_
 * assertions payload below is a synthetic, hand-built stand-in for what the
 * new rule ASKS the model to produce. That proves the rule is unambiguous
 * against real examples and that the downstream shape resolves -- or fails
 * closed, honestly -- as intended IF the model obeys it. It cannot prove
 * the model WILL obey the reworded rule; only a live run could show that,
 * and none was made for this change.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

const {
  PROMPT_ID,
  PROMPT_VERSION,
  RESPONSE_SHAPE,
  INSTRUCTIONS,
  buildTerminationFeeProducerPrompt,
} = require('../lib/canonical-v2/native-producer/termination-fee-producer-prompt');

const { sha256Hex, canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV15 } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeTerminationFeeProposals,
  FEE_AMOUNT_CLAIM_KEY,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { resolveFeeAmount } = require('../lib/canonical-v2/native-producer/termination-fee-parse');

// ---------------------------------------------------------------------------
// Text-content guards on the rendered prompt.
// ---------------------------------------------------------------------------

function renderedPromptText() {
  const built = buildTerminationFeeProducerPrompt({
    source_text: 'Section 8.12. Definitions. Placeholder source text.',
    governed_scope: { deal_key: 'test-deal:termination-fee-producer-prompt', governed_intervals: ['8.12'] },
  });
  assert.equal(built.messages.length, 1);
  return built.messages[0].content;
}

test('PROMPT_VERSION is 3 (Modiv per-limb amount: LIMB_AMOUNT_QUOTE)', () => {
  assert.equal(PROMPT_VERSION, 3);
});

test('PROMPT_ID is unchanged by the rewording', () => {
  assert.equal(PROMPT_ID, 'native-producer-termination-fee/v1');
});

test('INSTRUCTIONS carries the renamed rule; the old ONE AMOUNT PER QUOTE heading is gone', () => {
  assert.match(INSTRUCTIONS, /SPLIT COMPOUND SENTENCES BY LIMB/);
  assert.equal(INSTRUCTIONS.includes('ONE AMOUNT PER QUOTE'), false);
});

test('RESPONSE_SHAPE\'s quote hint no longer promises exactly one dollar amount per quote, and cross-references the renamed rule', () => {
  assert.equal(RESPONSE_SHAPE.includes('exactly ONE dollar amount'), false);
  assert.match(RESPONSE_SHAPE, /SPLIT COMPOUND SENTENCES BY LIMB/);
});

test('the rule distinguishes shape (a) two-sided/two-fact from shape (b) one-sided/conditional', () => {
  assert.match(INSTRUCTIONS, /\(a\) TWO SIDES, TWO FACTS/);
  assert.match(INSTRUCTIONS, /\(b\) ONE SIDE, ONE CONDITIONAL FACT/);
});

test('shape (a) may still keep a minimal per-limb quote when that limb already reaches its own defining term', () => {
  assert.match(INSTRUCTIONS, /keep that limb's quote to its own minimal span/);
});

test('shape (b) requires every limb to quote the entire defining sentence, identically, tied to the conditional-fact reasoning', () => {
  const paragraphs = INSTRUCTIONS.split('\n\n');
  const shapeBParagraph = paragraphs.find((p) => p.startsWith('SHAPE (b) ONLY'));
  assert.ok(shapeBParagraph, 'expected a "SHAPE (b) ONLY" paragraph');
  assert.match(shapeBParagraph, /entire defining sentence, identically/);
  assert.match(shapeBParagraph, /conditional/i);
});

test('the rule states plainly that byte-identical quotes across sibling assertions are correct and required, not a mistake', () => {
  const paragraphs = INSTRUCTIONS.split('\n\n');
  const identityParagraph = paragraphs.find((p) => /byte-for-byte identical quotes/.test(p));
  assert.ok(identityParagraph, 'expected a paragraph covering identical-quote siblings');
  assert.match(identityParagraph, /correct and required/);
  assert.match(identityParagraph, /Do not treat identical quotes as a mistake/);
});

test('the rule still forbids repurposing section_reference/payer_party/fee_term_ref to fake a "which limb" signal, now because a dedicated field (limb_amount_quote) exists instead', () => {
  assert.match(
    INSTRUCTIONS,
    /do not invent one by repurposing section_reference, payer_party or fee_term_ref/,
  );
  assert.match(INSTRUCTIONS, /limb_amount_quote \(below\) is the ONLY field for "which figure in this shared quote is this assertion's own"/);
});

test('the rendered prompt contains the source text verbatim and the renamed rule', () => {
  const rendered = renderedPromptText();
  assert.match(rendered, /Placeholder source text/);
  assert.match(rendered, /SPLIT COMPOUND SENTENCES BY LIMB/);
});

// ---------------------------------------------------------------------------
// PROMPT_VERSION 3: limb_amount_quote (docs/codex-program/notes/per-limb-
// fee-amount.md).
// ---------------------------------------------------------------------------

test('RESPONSE_SHAPE carries the new limb_amount_quote field on fee_amount_assertions, cross-referencing the LIMB_AMOUNT_QUOTE rule', () => {
  assert.match(RESPONSE_SHAPE, /"limb_amount_quote":/);
  assert.match(RESPONSE_SHAPE, /see LIMB_AMOUNT_QUOTE below/);
});

test('INSTRUCTIONS carries the LIMB_AMOUNT_QUOTE paragraph, tied to the whole-quote money-literal count', () => {
  const paragraphs = INSTRUCTIONS.split('\n\n');
  const limbAmountParagraph = paragraphs.find((p) => p.startsWith('LIMB_AMOUNT_QUOTE'));
  assert.ok(limbAmountParagraph, 'expected a "LIMB_AMOUNT_QUOTE" paragraph');
  assert.match(limbAmountParagraph, /more than one dollar figure/);
  assert.match(limbAmountParagraph, /smallest verbatim span/);
  assert.match(limbAmountParagraph, /Leave limb_amount_quote null when quote already carries only one dollar figure/);
});

// ---------------------------------------------------------------------------
// End-to-end: what the new rule's OUTPUT SHAPE does against the real,
// unmodified resolver. candidate-resolution.js is not part of this change;
// these tests document its existing behaviour against the new input shape,
// using synthetic candidates built the same way
// tests/canonical-v2-termination-fee-resolution.test.js builds its own.
// ---------------------------------------------------------------------------

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
        provider_id: 'termination-fee-producer-prompt-test/v1',
        model_id: 'stub-model',
        prompt: 'termination-fee-producer-prompt-test/v1',
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
  return { receipt, resolution };
}

function feeAmountAssertion({
  sectionReference = SECTION_REFERENCE, feeSide, payerParty, feeTermRef, quote, limbAmountQuote,
}) {
  return {
    section_reference: sectionReference,
    fee_side: feeSide,
    payer_party: payerParty,
    fee_term_ref: feeTermRef,
    quote,
    // Omitted entirely (not present-as-null) when the caller doesn't pass
    // it, matching what an un-upgraded/PROMPT_VERSION-2 model response
    // shape actually looks like -- every pre-existing call site in this
    // file keeps producing byte-identical assertion objects.
    ...(limbAmountQuote !== undefined ? { limb_amount_quote: limbAmountQuote } : {}),
  };
}

// Modiv "Company Base Amount" (evidence/canonical-v2/modiv-termination-fee-
// scope-correction-20260805/native-producer-recorded-response-8.12.json):
// one payer (the Company/SELLER), one defined term, two conditional limbs.
const MODIV_COMPANY_BASE_FULL_SENTENCE = '“Company Base Amount” means (x) if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii), $10,000,000, or (y) if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v), $15,000,000.00.';

test('shape (b) as instructed: both Modiv limbs sharing the identical full sentence both fail closed, MULTIPLE_MONEY_LITERALS, no resolved amount, no silent collision', async () => {
  const { resolution } = await resolveTerminationFeeAssertions('deal:modiv-shape-b', MODIV_COMPANY_BASE_FULL_SENTENCE, {
    fee_amount_assertions: [
      feeAmountAssertion({
        feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      }),
      feeAmountAssertion({
        feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 0, 'neither limb may silently resolve to a flat number -- the true amount is conditional on which ground fires');

  const reviewed = resolution.review_queue.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(reviewed.length, 2, 'both limbs must survive independently to the review queue -- a shared subject identity must not collide/dedupe them');
  for (const item of reviewed) {
    assert.deepEqual(item.reasons, ['MULTIPLE_MONEY_LITERALS']);
    assert.equal(item.has_resolution, false);
  }
});

test('shape (b) pre-fix contrast, pinned so the historical bug cannot silently return: narrow (x) fragment resolves ALONE to a flat 10000000; narrow (y) fragment queues FEE_TERM_NOT_IN_QUOTE', async () => {
  const xFragment = '“Company Base Amount” means (x) if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii), $10,000,000';
  const yFragment = '(y) if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v), $15,000,000.00';
  const { resolution } = await resolveTerminationFeeAssertions('deal:modiv-pre-fix-shape', MODIV_COMPANY_BASE_FULL_SENTENCE, {
    fee_amount_assertions: [
      feeAmountAssertion({
        feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: xFragment,
      }),
      feeAmountAssertion({
        feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: yFragment,
      }),
    ],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(
    resolved[0].claim.canonical_value,
    '10000000',
    'the historical defect: a conditional fee silently resolves to just one of its two possible values, looking unconditional',
  );

  const unresolved = resolution.review_queue.filter(
    (r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY && r.has_resolution === false,
  );
  assert.equal(unresolved.length, 1);
  assert.deepEqual(unresolved[0].reasons, ['FEE_TERM_NOT_IN_QUOTE']);
});

// Dyax (docs/superpowers/specs/2026-08-02-family-termination-fee-design.md,
// "Dyax (defined term, two-sided)"): two payers, one shared label, two
// independent unconditional facts -- the OTHER shape the split rule covers.
const DYAX_FULL_SENTENCE = '"Termination Fee" means (x) with respect to a payment required to be made by the Company an amount equal to $180,000,000 and (y) with respect to a payment required to be made by Parent an amount equal to $280,000,000.';
const DYAX_SELLER_MINIMAL_QUOTE = '"Termination Fee" means (x) with respect to a payment required to be made by the Company an amount equal to $180,000,000';

test('shape (a) as instructed: the first/SELLER limb stays minimal and keeps resolving cleanly (no regression); the BUYER limb widens to the full sentence and fails closed with a legible reason instead of an unfixable fragment', async () => {
  const { resolution } = await resolveTerminationFeeAssertions('deal:dyax-shape-a', DYAX_FULL_SENTENCE, {
    fee_amount_assertions: [
      feeAmountAssertion({
        feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Termination Fee', quote: DYAX_SELLER_MINIMAL_QUOTE,
      }),
      feeAmountAssertion({
        feeSide: 'BUYER', payerParty: 'Parent', feeTermRef: 'Termination Fee', quote: DYAX_FULL_SENTENCE,
      }),
    ],
  });

  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1, 'the SELLER limb, an independent unconditional fact, should still resolve on its own');
  assert.equal(resolved[0].claim.canonical_value, '180000000');
  assert.equal(resolved[0].concept_key, 'TERMF-TARGET');

  const unresolved = resolution.review_queue.filter(
    (r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY && r.has_resolution === false,
  );
  assert.equal(unresolved.length, 1);
  // Pre-fix, a BUYER limb narrowed to a term-less fragment dead-ends on
  // FEE_TERM_UNIDENTIFIED/FEE_TERM_NOT_IN_QUOTE -- unfixable even by a human,
  // since the term never appears in the quote at all. Widened to the full
  // sentence, the text corroborating the OTHER side now also appears in
  // this quote, so the honest failure becomes AMBIGUOUS_FEE_SIDE instead --
  // a reason a human reviewer can actually resolve by reading the (now
  // complete) quote, rather than a reason that can never be fixed.
  assert.deepEqual(unresolved[0].reasons, ['AMBIGUOUS_FEE_SIDE']);
});

// ---------------------------------------------------------------------------
// PROMPT_VERSION 3: limb_amount_quote. Two layers are testable directly
// against the real, unmodified code in this session: the SHAPING layer
// (anthropic-provider.js's shapeTerminationFeeProposals, called directly
// below) and the PURE parse layer (termination-fee-parse.js's
// resolveFeeAmount, unit-tested on its own in tests/canonical-v2-
// termination-fee-parse.test.js). The RESOLVER (candidate-resolution.js) is
// locked this session; its one-line wiring change
// (parseFeeAmount(claim.raw_value) -> resolveFeeAmount(claim.raw_value,
// attrs.limb_amount_quote) inside handleFeeAmountCandidate) is specified,
// UNAPPLIED, as a fenced diff in docs/codex-program/notes/per-limb-fee-
// amount.md. Until that diff is applied, the real, unmodified end-to-end
// pipeline (resolveTerminationFeeAssertions, used by every other test in
// this file) still abstains MULTIPLE_MONEY_LITERALS on both Modiv limbs
// even when limb_amount_quote is present and verified -- the last test in
// this section pins that this is still true today, so a future run of this
// suite (once the diff lands) is EXPECTED to need that one test updated,
// not surprised by it.
// ---------------------------------------------------------------------------

function shapeSourceAndAssertions(sourceText, assertions) {
  return shapeTerminationFeeProposals({
    fee_amount_assertions: assertions,
    fee_trigger_assertions: [],
    tail_period_assertions: [],
    open_world_candidates: [],
  }, sourceText);
}

test('shaping layer: a byte-verified, uniquely-nested limb_amount_quote is attached to attributes and allowed_attributes, for both Modiv limbs', () => {
  const { proposals, evidence_residuals: residuals } = shapeSourceAndAssertions(MODIV_COMPANY_BASE_FULL_SENTENCE, [
    feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      limbAmountQuote: '$10,000,000',
    }),
    feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      limbAmountQuote: '$15,000,000.00',
    }),
  ]);
  assert.equal(proposals.length, 2);
  assert.equal(proposals[0].attributes.limb_amount_quote, '$10,000,000');
  assert.equal(proposals[1].attributes.limb_amount_quote, '$15,000,000.00');
  for (const proposal of proposals) {
    assert.ok(proposal.allowed_attributes.includes('limb_amount_quote'));
    // The whole-sentence evidence is untouched -- raw_value/evidence stay
    // the full defining sentence; the sub-quote is an additional attribute,
    // never a replacement for the operative text a human reviewer reads.
    assert.equal(proposal.raw_value, MODIV_COMPANY_BASE_FULL_SENTENCE);
  }
  assert.deepEqual(residuals, []);
});

test('shaping layer: no limb_amount_quote supplied -- the attribute key is omitted entirely (not present-as-null), byte-identical to pre-PROMPT_VERSION-3 shaping', () => {
  const { proposals, evidence_residuals: residuals } = shapeSourceAndAssertions(MODIV_COMPANY_BASE_FULL_SENTENCE, [
    feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
    }),
  ]);
  assert.equal(proposals.length, 1);
  assert.equal(Object.hasOwn(proposals[0].attributes, 'limb_amount_quote'), false);
  assert.ok(proposals[0].allowed_attributes.includes('limb_amount_quote'), 'always allowed, even when unused -- allowed_attributes carries no identity/hash weight (design note section 6)');
  assert.deepEqual(residuals, []);
});

test('shaping layer safety: a hallucinated limb_amount_quote (absent from source entirely) is dropped as an attribute only -- the whole candidate still survives with its whole-sentence evidence', () => {
  const { proposals, evidence_residuals: residuals } = shapeSourceAndAssertions(MODIV_COMPANY_BASE_FULL_SENTENCE, [
    feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      limbAmountQuote: '$99,999,999',
    }),
  ]);
  assert.equal(proposals.length, 1, 'the candidate is not dropped just because its new, optional sub-quote could not be verified');
  assert.equal(Object.hasOwn(proposals[0].attributes, 'limb_amount_quote'), false);
  assert.equal(residuals.length, 1);
  assert.equal(residuals[0].reason, 'FEE_AMOUNT_LIMB_QUOTE_UNVERIFIED');
});

test('shaping layer safety: limb_amount_quote text that exists elsewhere in the source but NOT nested inside this assertion\'s own quote still verifies correctly -- proves the check is nesting-specific, not "appears somewhere in the document"', () => {
  const sourceText = `A recital elsewhere in this agreement separately mentions $10,000,000 for an unrelated escrow. ${MODIV_COMPANY_BASE_FULL_SENTENCE}`;
  // "$10,000,000" genuinely occurs twice in sourceText -- once outside the
  // limb's own quote (the recital), once inside it (the real figure). Only
  // the one nested inside the located outer-quote span may count.
  const { proposals, evidence_residuals: residuals } = shapeSourceAndAssertions(sourceText, [
    feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      limbAmountQuote: '$10,000,000',
    }),
  ]);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].attributes.limb_amount_quote, '$10,000,000', 'a duplicate occurrence OUTSIDE the limb quote must not block the one genuinely nested inside it');
  assert.deepEqual(residuals, []);
});

test('shaping layer safety: the limb\'s own whole-sentence quote occurring twice in the source (e.g. restated in an exhibit) makes the nesting ambiguous -- fails closed, never guesses which occurrence', () => {
  const sourceText = `${MODIV_COMPANY_BASE_FULL_SENTENCE}\n\nExhibit A restates: ${MODIV_COMPANY_BASE_FULL_SENTENCE}`;
  const { proposals, evidence_residuals: residuals } = shapeSourceAndAssertions(sourceText, [
    feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      limbAmountQuote: '$10,000,000',
    }),
  ]);
  assert.equal(proposals.length, 1, 'the whole-sentence claim still gets its own evidence fine -- the main evidenceFromQuote check only requires ONE occurrence to exist, not a unique one');
  assert.equal(Object.hasOwn(proposals[0].attributes, 'limb_amount_quote'), false, 'nested inside BOTH occurrences of the outer quote -- ambiguous, so the sub-quote attribute is dropped rather than picking one arbitrarily');
  assert.equal(residuals.length, 1);
  assert.equal(residuals[0].reason, 'FEE_AMOUNT_LIMB_QUOTE_UNVERIFIED');
});

test('simulated full chain (shaping -> resolveFeeAmount): feeding the REAL shaped output through the exact call the unapplied resolver diff makes resolves both Modiv limbs to their own distinct amounts', () => {
  const { proposals } = shapeSourceAndAssertions(MODIV_COMPANY_BASE_FULL_SENTENCE, [
    feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      limbAmountQuote: '$10,000,000',
    }),
    feeAmountAssertion({
      feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
      limbAmountQuote: '$15,000,000.00',
    }),
  ]);
  assert.equal(proposals.length, 2);
  // Exactly the call handleFeeAmountCandidate makes in the unapplied diff,
  // in place of today's bare parseFeeAmount(claim.raw_value) -- proven here
  // against the real, unmodified shaping output, not a hand-built stand-in.
  const results = proposals.map((p) => resolveFeeAmount(p.raw_value, p.attributes.limb_amount_quote));
  assert.equal(results[0].outcome, 'RESOLVED');
  assert.equal(results[0].canonical_value, '10000000');
  assert.equal(results[0].used_limb_amount_quote, true);
  assert.equal(results[1].outcome, 'RESOLVED');
  assert.equal(results[1].canonical_value, '15000000.00');
  assert.equal(results[1].used_limb_amount_quote, true);
});

// Inverted on 2026-08-05, when the resolver diff this test was written to
// describe was actually applied (candidate-resolution.js handleFeeAmountCandidate
// now calls resolveFeeAmount(claim.raw_value, attrs.limb_amount_quote)).
//
// The previous version of this test asserted ZERO resolved amounts and two
// MULTIPLE_MONEY_LITERALS review rows, and said so in its own failure message:
// "the resolver does not read limb_amount_quote yet -- see the unapplied diff".
// It existed to prove the shaping-layer change was inert on its own, and to pin
// precisely what the diff still owed. The diff has landed, so it now pins the
// wired result instead. The pin moved because the behaviour genuinely changed,
// not to make a failing test pass: the shape (b) baseline test above still
// proves that WITHOUT a limb_amount_quote both limbs fail closed exactly as
// before, which is the guarantee that actually matters.
test('real end-to-end pipeline, resolver wired: a byte-verified limb_amount_quote resolves both Modiv limbs to their own distinct amounts, and each carries the audit breadcrumb saying the fallback fired', async () => {
  const { resolution } = await resolveTerminationFeeAssertions('deal:modiv-limb-amount-quote-pre-wiring', MODIV_COMPANY_BASE_FULL_SENTENCE, {
    fee_amount_assertions: [
      feeAmountAssertion({
        feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
        limbAmountQuote: '$10,000,000',
      }),
      feeAmountAssertion({
        feeSide: 'SELLER', payerParty: 'the Company', feeTermRef: 'Company Base Amount', quote: MODIV_COMPANY_BASE_FULL_SENTENCE,
        limbAmountQuote: '$15,000,000.00',
      }),
    ],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY);
  assert.equal(resolved.length, 2, 'both limbs resolve now that the resolver consults limb_amount_quote');

  // Sorted so the assertion does not depend on emission order.
  const values = resolved.map((r) => r.claim.canonical_value).sort();
  assert.deepEqual(values, ['10000000', '15000000.00'], 'each limb resolves to its OWN figure, not to whichever dollar amount appears first in the shared sentence');

  // The breadcrumb is present only when the fallback actually fired, so a
  // reviewer can tell a directly-resolved amount from a disambiguated one.
  for (const item of resolved) {
    assert.equal(item.claim.attributes.limb_amount_disambiguated, true);
  }

  // has_resolution === false is the file's own convention for "queued because
  // it could NOT be resolved", as distinct from a resolved claim that is also
  // surfaced for human confirmation on materiality. Both limbs resolved, so
  // nothing should remain unresolved.
  const unresolved = resolution.review_queue.filter(
    (r) => r.generic_claim_key === FEE_AMOUNT_CLAIM_KEY && r.has_resolution === false,
  );
  assert.equal(unresolved.length, 0, 'neither limb should still be UNRESOLVED once both resolve');
});
