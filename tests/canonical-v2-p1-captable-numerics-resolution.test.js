'use strict';

/**
 * tests/canonical-v2-p1-captable-numerics-resolution.test.js
 *
 * Acceptance tests 3, 4, 5 (docs/superpowers/specs/2026-08-02-p1-captable-
 * numerics-design.md, section 5): resolution end to end over the coverage
 * map's real sub-quotes, write-path, and identity.
 *
 * Per the spec's own "Golden evals" note (section 3): the three recorded
 * live-run responses predate PROMPT_VERSION 5's share_count_assertions
 * array, so this file drives the resolver with SYNTHETIC compiled
 * candidates -- built via the real anthropic-provider.js shaping path
 * (shapeProposals) over a stub provider response, run through the real
 * runNativeExtraction/resolveCandidates pipeline -- carrying the coverage
 * map's real, byte-verified sub-quotes (each asserted a substring of BOTH
 * the committed canonical text and its parent fixture quote, per audit
 * M-5's honesty pin). This is explicitly the PRE-RERUN harness; no claim
 * here or in any report may say C1/C8/C9/C11 have "converted" until the
 * dated live-rerun handoffs land (spec deliverable, audit M-5).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV14 } = require('../lib/canonical-v2/contract-bundle');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const {
  shapeProposals,
  SHARE_COUNT_CLAIM_KEY,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates,
  materialityFor,
  MATERIALITY_TABLE,
  CAPITAL_STRUCTURE_MATERIALITY_TIER,
  shareCountKindCorroborated,
  GENERIC_CLAIM_KEY_RESOLUTION_TABLE,
  MAPPING_TABLE_VERSION,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { SHARE_COUNT_PARSE_VERSION, ZERO_PATTERN_TABLE_VERSION } = require('../lib/canonical-v2/native-producer/share-count-parse');

// ─── Fixture: identity admitted-source chain (copied from
// tests/canonical-v2-candidate-resolution.test.js -- see that file's own
// comment for why a hand-built identity source map is required instead of
// running text through the real SEC-HTML converter). ───

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
// Real fixture text, sliced at test time (never retyped) into governed
// section bodies wrapped in a small synthetic agreement shell. Every
// coverage-map sub-quote used below is a substring of these real slices.
// ---------------------------------------------------------------------------

function loadFixtureJson(dealDir, name) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', dealDir, name), 'utf8'),
  );
}

function loadCanonicalText(dealDir) {
  return loadFixtureJson(dealDir, 'adapter-result.json').admitted_source_contexts[0].canonical_text.text;
}

function loadOpenWorldQuote(dealDir, closureId) {
  const entry = loadFixtureJson(dealDir, 'resolution.json').open_world.find((item) => item.closure_id === closureId);
  assert.ok(entry, `expected open_world closure_id ${closureId} in ${dealDir}`);
  return entry.raw_value;
}

function sliceReal(text, startAnchor, endAnchor) {
  const s = text.indexOf(startAnchor);
  assert.ok(s >= 0, `start anchor not found: ${startAnchor}`);
  const e = text.indexOf(endAnchor, s) + endAnchor.length;
  assert.ok(e > s, `end anchor not found after start: ${endAnchor}`);
  return text.slice(s, e);
}

// The sectionizer derives section_reference from real heading/lettered-
// subsection structure in the text, not from a caller-supplied label -- so
// every deal's real paragraph is wrapped under the SAME synthetic
// "(b)Capital Structure." lettered heading (mirroring tests/fixtures/
// qxo-section-3-1-b.txt's own real structure) and every test below requests
// the resulting '3.1(b)' reference uniformly, regardless of which deal's
// real prose the paragraph itself is (F28's own numbering is already
// '3.1(b)'; Skechers/Modiv's real section numbers do not survive this
// synthetic wrapping, which is expected -- this harness proves the
// resolver/parser layers, not a live sectionizer run against each deal's
// real document structure).
const SECTION_REFERENCE = '3.1(b)';

function wrapInAgreementShell(sectionBody) {
  return [
    'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
    'Buyer, Inc. and the Company.\n\n',
    'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
    'Section 3.1 Representations Concerning the Company.\n\n',
    '(a)Organization; Standing. The Company is a corporation duly organized, ',
    'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
    '(b)Capital Structure.\n',
    sectionBody,
    '\n',
  ].join('');
}

const F28_PARAGRAPH = sliceReal(
  loadCanonicalText('f28-third-live-run'),
  '(i) The authorized capital stock',
  'the Company has no Company Shares reserved for issuance.',
);
const SKECHERS_PARAGRAPH = sliceReal(
  loadCanonicalText('skechers-first-live-run'),
  'The authorized capital stock',
  'reserved and available for issuance under the Company ESPP.',
);
const MODIV_PARAGRAPH = sliceReal(
  loadCanonicalText('modiv-first-live-run'),
  'The authorized capital stock',
  'except as set forth in Section 3.2(b) of the Company Disclosure Letter.',
);

const CONTRACT_BUNDLE_V14 = compileFixtureContractV14();

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

async function resolveShareCountAssertions(dealKey, sectionBody, assertions) {
  const { sourceText, documentHash, admittedSourceContext } = buildSourceAndContext(dealKey, sectionBody);
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT_BUNDLE_V14,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        {
          representation_instances: [],
          bring_down_conditions: [],
          open_world_candidates: [],
          share_count_assertions: assertions,
        },
        governedScope.source_text,
      );
      return {
        provider_id: 'p1-captable-numerics-test/v1',
        model_id: 'stub-model',
        prompt: 'p1-captable-numerics-test-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE_V14,
    admitted_source_context: admittedSourceContext,
  });
  return { receipt, resolution, sourceText, documentHash, admittedSourceContext };
}

function shareCountAssertion({
  sectionReference, countKind, shareClass, plan = null, quote, partyMaking = 'the Company',
}) {
  return {
    section_reference: sectionReference, party_making: partyMaking, count_kind: countKind,
    share_class: shareClass, plan, quote,
  };
}

// ---------------------------------------------------------------------------
// Acceptance test 3: resolution end to end.
// ---------------------------------------------------------------------------

test('F28 C1: AUTHORIZED and ISSUED_OUTSTANDING sub-quotes resolve end to end with exact canonical values, correct definitions, materiality rank 52', async () => {
  const authorizedQuote = 'The authorized capital stock of the Company consists of (A) 250,000,000 Company Shares';
  const outstandingQuote = '28,142,327 Company Shares were outstanding as of the close of business on April 17, 2026';
  assert.ok(F28_PARAGRAPH.includes(authorizedQuote));
  assert.ok(F28_PARAGRAPH.includes(outstandingQuote));
  const parentQuote = loadOpenWorldQuote(
    'f28-third-live-run', '7ec6ef38a8d6b66bb6b48b32d813bf1642f6466fee5571c8041bc50270aa60fe',
  );
  const canonicalText = loadCanonicalText('f28-third-live-run');
  assert.ok(canonicalText.includes(authorizedQuote) && canonicalText.includes(parentQuote));
  assert.ok(canonicalText.includes(outstandingQuote) && canonicalText.includes(parentQuote));

  const { resolution } = await resolveShareCountAssertions('deal:f28-authorized-outstanding', F28_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'AUTHORIZED', shareClass: 'Company Shares', quote: authorizedQuote,
    }),
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'ISSUED_OUTSTANDING', shareClass: 'Company Shares', quote: outstandingQuote,
    }),
  ]);

  const resolved = resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.equal(resolved.length, 2);

  const authorized = resolved.find((entry) => entry.claim.raw_value === authorizedQuote);
  assert.equal(authorized.resolved_claim_definition_key, 'CAPITALIZATION_SHARE_COUNT');
  assert.equal(authorized.claim.canonical_value, '250000000');
  assert.equal(authorized.triage.materiality_rank, 52);
  assert.equal(authorized.triage.materiality_label, 'CAPITAL_STRUCTURE');
  assert.equal(authorized.claim.attributes.count_kind, 'AUTHORIZED');
  assert.equal(authorized.claim.attributes.share_class_ref, 'Company Shares');

  const outstanding = resolved.find((entry) => entry.claim.raw_value === outstandingQuote);
  assert.equal(outstanding.resolved_claim_definition_key, 'CAPITALIZATION_SHARE_COUNT');
  assert.equal(outstanding.claim.canonical_value, '28142327');
  assert.equal(outstanding.triage.materiality_rank, 52);
});

test('F28: the parent compound quote (idx1, anchored/extended per re-audit finding 1 to include the kind-bearing "authorized ... consists of" words so it can even reach the parser) resolves nothing -- MULTIPLE_NUMERIC_LITERALS, routed to REVIEW with the typed reason preserved (Fable review F-1: parser ABSTAINs are review, never open_world)', async () => {
  // idx1's own raw_value ("250,000,000 Company Shares, of which 28,142,327
  // ...") carries NO corroborating word for AUTHORIZED on its own -- exactly
  // the re-audit finding 1 case: the kind-bearing words sit ADJACENT to,
  // not inside, the parent limb quote. The coverage map's own parent-ABSTAIN
  // test therefore extends into the adjacent canonical text (still a real,
  // contiguous, byte-verified substring, never retyped) so the candidate
  // even reaches the parser, which is where MULTIPLE_NUMERIC_LITERALS must
  // fire -- a corroboration-gate rejection would prove nothing about the
  // parser's own one-number rule.
  const parentQuote = loadOpenWorldQuote(
    'f28-third-live-run', '7ec6ef38a8d6b66bb6b48b32d813bf1642f6466fee5571c8041bc50270aa60fe',
  );
  const extendedQuote = F28_PARAGRAPH.slice(
    F28_PARAGRAPH.indexOf('The authorized capital stock'),
    F28_PARAGRAPH.indexOf(parentQuote) + parentQuote.length,
  );
  assert.ok(F28_PARAGRAPH.includes(extendedQuote));
  assert.ok(extendedQuote.includes(parentQuote), 'anchored: still overlaps the parent quote on its full numeric tokens');
  const { resolution } = await resolveShareCountAssertions('deal:f28-parent-abstain', F28_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'AUTHORIZED', shareClass: 'Company Shares', quote: extendedQuote,
    }),
  ]);
  assert.equal(resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY).length, 0);
  assert.equal(
    resolution.open_world.some((entry) => entry.raw_value === extendedQuote),
    false,
    'a parser ABSTAIN must never land in open_world',
  );
  const reviewEntry = resolution.review_queue.find((entry) => entry.raw_value === extendedQuote);
  assert.ok(reviewEntry);
  assert.deepEqual(reviewEntry.reasons, ['MULTIPLE_NUMERIC_LITERALS']);
  assert.equal(reviewEntry.materiality_rank, 52);
});

test('F28: the preferred-stock parent quote (idx2), proposed as ISSUED_OUTSTANDING, ABSTAINs AMBIGUOUS_LITERAL_AND_ZERO and routes to REVIEW with the typed reason (Fable review F-1)', async () => {
  const parentQuote = loadOpenWorldQuote(
    'f28-third-live-run', '3e0ca2109043920cf37b6f6e095aadd006f109c25561e2753eb0644361fbcd24',
  );
  assert.ok(F28_PARAGRAPH.includes(parentQuote));
  const { resolution } = await resolveShareCountAssertions('deal:f28-ambiguous-zero', F28_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE,
      countKind: 'ISSUED_OUTSTANDING',
      shareClass: 'preferred stock, par value $0.01 per share',
      quote: parentQuote,
    }),
  ]);
  assert.equal(resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY).length, 0);
  assert.equal(
    resolution.open_world.some((entry) => entry.raw_value === parentQuote),
    false,
    'a parser ABSTAIN must never land in open_world',
  );
  const reviewEntry = resolution.review_queue.find((entry) => entry.raw_value === parentQuote);
  assert.ok(reviewEntry);
  assert.deepEqual(reviewEntry.reasons, ['AMBIGUOUS_LITERAL_AND_ZERO']);
});

test('Skechers C8/C11: RESERVED (Company ESPP) sub-quote resolves to RESERVED_SHARE_POOL with plan_ref, materiality rank 52', async () => {
  const quote = '3,360,412 shares of Company Common Stock reserved and available for issuance under the Company ESPP';
  assert.ok(SKECHERS_PARAGRAPH.includes(quote));
  const { resolution } = await resolveShareCountAssertions('deal:skechers-reserved-espp', SKECHERS_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'RESERVED', shareClass: 'Company Common Stock', plan: 'the Company ESPP', quote,
    }),
  ]);
  const resolved = resolution.resolved.find((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.ok(resolved);
  assert.equal(resolved.resolved_claim_definition_key, 'RESERVED_SHARE_POOL');
  assert.equal(resolved.claim.canonical_value, '3360412');
  assert.equal(resolved.claim.attributes.plan_ref, 'the Company ESPP');
  assert.equal(resolved.triage.materiality_rank, 52);
});

test('Skechers: RESERVED with no plan named in the quote routes to review, typed RESERVED_POOL_PLAN_UNIDENTIFIED, never resolves with an empty ref', async () => {
  const quote = '3,360,412 shares of Company Common Stock reserved and available for issuance under the Company ESPP';
  const { resolution } = await resolveShareCountAssertions('deal:skechers-reserved-no-plan', SKECHERS_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'RESERVED', shareClass: 'Company Common Stock', plan: null, quote,
    }),
  ]);
  assert.equal(resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY).length, 0);
  const reviewEntry = resolution.review_queue.find((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.ok(reviewEntry);
  assert.ok(reviewEntry.reasons.includes('RESERVED_POOL_PLAN_UNIDENTIFIED'));
  assert.equal(reviewEntry.materiality_rank, 52);
});

test('Skechers: TREASURY zero sub-quote resolves to 0 under CAPITALIZATION_SHARE_COUNT', async () => {
  const quote = 'no shares of Company Common Stock were held by the Company as treasury shares';
  assert.ok(SKECHERS_PARAGRAPH.includes(quote));
  const { resolution } = await resolveShareCountAssertions('deal:skechers-treasury-zero', SKECHERS_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'TREASURY', shareClass: 'Company Common Stock', quote,
    }),
  ]);
  const resolved = resolution.resolved.find((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.ok(resolved);
  assert.equal(resolved.resolved_claim_definition_key, 'CAPITALIZATION_SHARE_COUNT');
  assert.equal(resolved.claim.canonical_value, '0');
});

test('Modiv: "classified and designated as" AUTHORIZED sub-quote fails corroboration -- typed COUNT_KIND_UNCORROBORATED, never publishes under the wrong kind', async () => {
  const quote = '1,677,588 shares are classified and designated as Company Preferred Shares';
  assert.ok(MODIV_PARAGRAPH.includes(quote));
  assert.equal(shareCountKindCorroborated('AUTHORIZED', quote), false);
  const { resolution } = await resolveShareCountAssertions('deal:modiv-uncorroborated', MODIV_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'AUTHORIZED', shareClass: 'Company Preferred Shares', quote,
    }),
  ]);
  assert.equal(resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY).length, 0);
  const reviewEntry = resolution.review_queue.find((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.ok(reviewEntry);
  assert.ok(reviewEntry.reasons.includes('COUNT_KIND_UNCORROBORATED'));
});

test('Modiv C1: ISSUED_OUTSTANDING sub-quote resolves 10323670', async () => {
  const quote = '10,323,670 Class C Common Shares were issued and outstanding,';
  assert.ok(MODIV_PARAGRAPH.includes(quote));
  const { resolution } = await resolveShareCountAssertions('deal:modiv-issued-outstanding', MODIV_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'ISSUED_OUTSTANDING', shareClass: 'Class C Common Shares', quote,
    }),
  ]);
  const resolved = resolution.resolved.find((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.ok(resolved);
  assert.equal(resolved.claim.canonical_value, '10323670');
});

test('Modiv: RESERVED zero with NO plan_ref supplied at all routes to review, typed RESERVED_POOL_PLAN_UNIDENTIFIED (named case)', async () => {
  const quote = 'the Company had no Company Common Shares or Company Preferred Shares reserved for issuance';
  assert.ok(MODIV_PARAGRAPH.includes(quote));
  const { resolution } = await resolveShareCountAssertions('deal:modiv-reserved-no-plan', MODIV_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'RESERVED', shareClass: 'Company Preferred Shares', plan: null, quote,
    }),
  ]);
  assert.equal(resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY).length, 0);
  const reviewEntry = resolution.review_queue.find((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.ok(reviewEntry);
  assert.ok(reviewEntry.reasons.includes('RESERVED_POOL_PLAN_UNIDENTIFIED'));
});

test('out-of-enum count_kind exercises the explicit pushOpenWorld path (main loop\'s proposal_kind routing does not catch SHARE_COUNT)', async () => {
  const quote = 'The authorized capital stock of the Company consists of (A) 250,000,000 Company Shares';
  const { resolution } = await resolveShareCountAssertions('deal:f28-out-of-enum', F28_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'FULLY_DILUTED', shareClass: 'Company Shares', quote,
    }),
  ]);
  assert.equal(resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY).length, 0);
  const openWorldEntry = resolution.open_world.find((entry) => entry.raw_value === quote);
  assert.ok(openWorldEntry);
  assert.equal(openWorldEntry.reason, 'SHARE_COUNT_KIND_OUT_OF_ENUM');
});

test('SHARE_CLASS_REF_NOT_IN_QUOTE: a share_class not actually present in the byte-verified quote routes to review, typed', async () => {
  const quote = 'The authorized capital stock of the Company consists of (A) 250,000,000 Company Shares';
  const { resolution } = await resolveShareCountAssertions('deal:f28-class-ref-mismatch', F28_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'AUTHORIZED', shareClass: 'Series X Preferred Stock', quote,
    }),
  ]);
  assert.equal(resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY).length, 0);
  const reviewEntry = resolution.review_queue.find((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.ok(reviewEntry);
  assert.ok(reviewEntry.reasons.includes('SHARE_CLASS_REF_NOT_IN_QUOTE'));
});

test('MAPPING_TABLE_VERSION is 17; GENERIC_CLAIM_KEY_RESOLUTION_TABLE carries exactly ONE SHARE_COUNT entry and no duplicate generic keys anywhere (audit M-2)', () => {
  assert.equal(MAPPING_TABLE_VERSION, 17);
  const shareCountEntries = GENERIC_CLAIM_KEY_RESOLUTION_TABLE.filter(
    (entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY,
  );
  assert.equal(shareCountEntries.length, 1);
  assert.equal(shareCountEntries[0].deterministic_kind, null);
  assert.equal(shareCountEntries[0].attachment_position, null);
  // No duplicate (generic_claim_key, deterministic_kind, attachment_position)
  // triple anywhere in the table -- a second entry for the same key would
  // silently last-win in whichever Map (RESOLUTION_UNCONDITIONAL/
  // RESOLUTION_BY_KIND_ANY_POSITION/RESOLUTION_BY_KIND_AND_POSITION) it
  // landed in.
  const seen = new Set();
  for (const entry of GENERIC_CLAIM_KEY_RESOLUTION_TABLE) {
    const key = `${entry.generic_claim_key}::${entry.deterministic_kind}::${entry.attachment_position}`;
    assert.equal(seen.has(key), false, `duplicate table entry: ${key}`);
    seen.add(key);
  }
});

test('materialityFor: the definition-key override map wins for both P1 claim definitions, regardless of concept_key, and is unaffected for other definitions', () => {
  assert.deepEqual(
    materialityFor({ conceptKey: 'REP-T-CAP', canonicalValue: '1', claimDefinitionKey: 'CAPITALIZATION_SHARE_COUNT' }),
    CAPITAL_STRUCTURE_MATERIALITY_TIER,
  );
  assert.deepEqual(
    materialityFor({ conceptKey: 'REP-T-CAP', canonicalValue: '0', claimDefinitionKey: 'RESERVED_SHARE_POOL' }),
    CAPITAL_STRUCTURE_MATERIALITY_TIER,
  );
  assert.deepEqual(
    materialityFor({ conceptKey: 'REP-T-CAP', canonicalValue: null, claimDefinitionKey: 'REPRESENTATION_ACCURACY_STANDARD' }),
    MATERIALITY_TABLE.find((tier) => tier.label === 'REPRESENTATIONS'),
    'a definition with no override falls through to concept-key prefix matching unchanged',
  );
  assert.equal(CAPITAL_STRUCTURE_MATERIALITY_TIER.rank, 52);
});

test('the resolution receipt carries share_count_parse_version and zero_pattern_table_version', async () => {
  const quote = 'The authorized capital stock of the Company consists of (A) 250,000,000 Company Shares';
  const { resolution } = await resolveShareCountAssertions('deal:f28-receipt-pins', F28_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'AUTHORIZED', shareClass: 'Company Shares', quote,
    }),
  ]);
  assert.equal(resolution.resolution_receipt.share_count_parse_version, SHARE_COUNT_PARSE_VERSION);
  assert.equal(resolution.resolution_receipt.zero_pattern_table_version, ZERO_PATTERN_TABLE_VERSION);
  assert.equal(resolution.resolution_receipt.mapping_table_version, 17);
});

// ---------------------------------------------------------------------------
// Acceptance test 4: write-path.
// ---------------------------------------------------------------------------

test('a resolved share-count claim travels adapter -> validation -> publishableWriteSet via the component-rows machinery', async () => {
  const authorizedQuote = 'The authorized capital stock of the Company consists of (A) 250,000,000 Company Shares';
  const { receipt, resolution, sourceText, documentHash, admittedSourceContext } = await resolveShareCountAssertions(
    'deal:f28-write-path', F28_PARAGRAPH, [
      shareCountAssertion({
        sectionReference: SECTION_REFERENCE, countKind: 'AUTHORIZED', shareClass: 'Company Shares', quote: authorizedQuote,
      }),
    ],
  );
  const resolved = resolution.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.equal(resolved.length, 1);

  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: sourceText,
    document_hash: documentHash,
    admitted_source_context: admittedSourceContext,
  });
  assert.equal(adapterResult.residuals.length, 0);

  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const writeSet = { ...adapterResult.write_set, provisions: [...provisionsById.values()] };

  const validation = validateResolvedCanonicalWriteSet({
    writeSet,
    contractBundle: CONTRACT_BUNDLE_V14,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });

  assert.equal(validation.accepted, true);
  assert.equal(validation.residuals.length, 0);
  assert.equal(validation.quarantines.length, 0);

  const shareCountWritten = adapterResult.write_set.claims.find(
    (claim) => claim.claim_definition_key === 'CAPITALIZATION_SHARE_COUNT',
  );
  assert.ok(shareCountWritten, 'the resolved share-count claim reached the write set');
  assert.equal(shareCountWritten.canonical_value, '250000000');
  const publishableIds = validation.publishableWriteSet.claims.map((claim) => claim.claim_revision_id);
  assert.ok(publishableIds.includes(shareCountWritten.claim_revision_id), 'reached the publishable write set');
});

// ---------------------------------------------------------------------------
// Acceptance test 5: identity.
// ---------------------------------------------------------------------------

test('two same-section counts differing only in share_class_ref/count_kind mint distinct, stable claim identities', async () => {
  const authorizedQuote = 'The authorized capital stock of the Company consists of (i) 500,000,000 shares of Company Class A Common Stock';
  const outstandingQuote = '130,289,468 shares of Company Class A Common Stock were issued and outstanding';
  const { resolution: run1 } = await resolveShareCountAssertions('deal:identity-same-section', SKECHERS_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'AUTHORIZED', shareClass: 'Company Class A Common Stock', quote: authorizedQuote,
    }),
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'ISSUED_OUTSTANDING', shareClass: 'Company Class A Common Stock', quote: outstandingQuote,
    }),
  ]);
  const resolved1 = run1.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.equal(resolved1.length, 2);
  const [claimA, claimB] = resolved1;
  assert.notEqual(claimA.claim.claim_revision_id, claimB.claim.claim_revision_id);
  assert.notEqual(claimA.claim.closure_id, claimB.claim.closure_id);
  // Same provision (same section/concept/party) -- distinct claims within it.
  assert.equal(claimA.provision_instance.provision_instance_id, claimB.provision_instance.provision_instance_id);

  // Determinism: an identical run mints byte-identical identities.
  const { resolution: run2 } = await resolveShareCountAssertions('deal:identity-same-section', SKECHERS_PARAGRAPH, [
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'AUTHORIZED', shareClass: 'Company Class A Common Stock', quote: authorizedQuote,
    }),
    shareCountAssertion({
      sectionReference: SECTION_REFERENCE, countKind: 'ISSUED_OUTSTANDING', shareClass: 'Company Class A Common Stock', quote: outstandingQuote,
    }),
  ]);
  const resolved2 = run2.resolved.filter((entry) => entry.generic_claim_key === SHARE_COUNT_CLAIM_KEY);
  assert.deepEqual(
    resolved2.map((entry) => entry.claim.claim_revision_id).sort(),
    resolved1.map((entry) => entry.claim.claim_revision_id).sort(),
  );
});
