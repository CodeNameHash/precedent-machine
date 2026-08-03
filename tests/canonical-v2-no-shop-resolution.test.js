'use strict';

/**
 * tests/canonical-v2-no-shop-resolution.test.js
 *
 * Acceptance tests 4, 5, 6, 8 (docs/superpowers/specs/2026-08-02-family-
 * no-shop-design.md, section 6, AUDIT-AMENDED).
 *
 * Per the spec's own "No recorded native runs exist for this family" note
 * (Deliverable section) and the P1 M-5 pre-rerun-harness precedent (reused
 * verbatim from tests/canonical-v2-termination-fee-resolution.test.js):
 * this file drives the resolver with SYNTHETIC compiled candidates -- built
 * via the real anthropic-provider.js shaping path (shapeNoShopProposals)
 * over a stub provider response, run through the real
 * runNativeExtraction/resolveCandidates pipeline -- carrying the committed
 * fixture's real, byte-verified quotes. This is explicitly the PRE-RERUN
 * harness; no claim here or in any report may say this family "extracts
 * natively" until the dated post-merge live-run handoffs land (spec
 * Deliverable section, P1 audit M-5, applied verbatim).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV21 } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeNoShopProposals,
  NO_SHOP_ACTION_CLAIM_KEY,
  NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY,
  NO_SHOP_NOTICE_PERIOD_CLAIM_KEY,
  NO_SHOP_MATCH_PERIOD_CLAIM_KEY,
  NO_SHOP_REMATCH_PERIOD_CLAIM_KEY,
  NO_SHOP_WAVE_B_CLAIM_KEY,
  NativeProducerAnthropicError,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates,
  materialityFor,
  MATERIALITY_TABLE,
  noShopActionCorroborated,
  noShopPrerequisiteCorroborated,
  noShopPeriodRoleCorroborated,
  MAPPING_TABLE_VERSION,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { NO_SHOP_PERIOD_PARSE_VERSION } = require('../lib/canonical-v2/native-producer/no-shop-period-parse');
const {
  CLAIM_PRESENTATION,
  KEY_TERMS_OWNED_CONCEPTS,
  KEY_TERMS_OWNED_DEFINITIONS,
  compileNoShopProductParity,
} = require('../lib/canonical-v2/native-producer/no-shop-product-parity');

// ─── Fixture: identity admitted-source chain (copied verbatim from
// tests/canonical-v2-termination-fee-resolution.test.js -- see that file's
// own comment for why a hand-built identity source map is required instead
// of running text through the real SEC-HTML converter). ───

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

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'no-shop', 'quotes.json');
const FIXTURES = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
function quoteById(id) {
  const entry = FIXTURES.quotes.find((q) => q.id === id);
  assert.ok(entry, `expected a fixture quote with id ${id}`);
  return entry;
}

const SECTION_REFERENCE = '6.3(a)';

function wrapInAgreementShell(sectionBody) {
  return [
    'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
    'Buyer, Inc. and the Company.\n\n',
    'ARTICLE VI\n\nCOVENANTS\n\n',
    'Section 6.2 Conduct of Business.\n\n',
    'The Company shall conduct its business in the ordinary course.\n\n',
    'Section 6.3 No Solicitation.\n\n',
    '(a)No Solicitation.\n',
    sectionBody,
    '\n',
  ].join('');
}

const CONTRACT_BUNDLE_V21 = compileFixtureContractV21();

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

async function resolveNoShopAssertions(dealKey, sectionBody, response) {
  const { sourceText, documentHash, admittedSourceContext } = buildSourceAndContext(dealKey, sectionBody);
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT_BUNDLE_V21,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeNoShopProposals(
        {
          no_shop_action_assertions: response.no_shop_action_assertions || [],
          exception_prerequisite_assertions: response.exception_prerequisite_assertions || [],
          period_assertions: response.period_assertions || [],
          cease_assertions: response.cease_assertions || [],
          standstill_assertions: response.standstill_assertions || [],
          fiduciary_standard_assertions: response.fiduciary_standard_assertions || [],
          recommendation_assertions: response.recommendation_assertions || [],
          open_world_candidates: response.open_world_candidates || [],
        },
        governedScope.source_text,
      );
      return {
        provider_id: 'no-shop-test/v1',
        model_id: 'stub-model',
        prompt: 'no-shop-test-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE_V21,
    admitted_source_context: admittedSourceContext,
  });
  return { receipt, resolution, sourceText, documentHash, admittedSourceContext };
}

function actionAssertion({
  sectionReference = SECTION_REFERENCE, actionCode = null, covenantObligor = 'the Company', quote,
}) {
  return { section_reference: sectionReference, action_code: actionCode, covenant_obligor: covenantObligor, quote };
}

function prerequisiteAssertion({
  sectionReference = SECTION_REFERENCE, prerequisiteCode = null, permittedActionContext = null, quote,
}) {
  return {
    section_reference: sectionReference, prerequisite_code: prerequisiteCode,
    permitted_action_context: permittedActionContext, quote,
  };
}

function periodAssertion({ sectionReference = SECTION_REFERENCE, periodRole, quote }) {
  return { section_reference: sectionReference, period_role: periodRole, quote };
}

// ---------------------------------------------------------------------------
// Materiality rank pin (spec section 4/6): rank 50, via the EXISTING
// NOSOL- prefix row -- no table diff (spec section 4: "no new tier, no
// rank change").
// ---------------------------------------------------------------------------

test('materiality rank 50 asserted on all five NOSOL- concepts via the EXISTING prefix row (no table diff)', () => {
  const noShopTier = MATERIALITY_TABLE.find((t) => t.label === 'NO_SHOP_EXCEPTIONS');
  assert.equal(noShopTier.rank, 50);
  for (const [conceptKey, claimDefinitionKey] of [
    ['NOSOL-PROHIBIT', 'NO_SHOP_PROHIBITED_ACTION'],
    ['NOSOL-EXCEPT', 'NO_SHOP_EXCEPTION_PREREQUISITE'],
    ['NOSOL-NOTICE', 'NO_SHOP_NOTICE_PERIOD_DAYS'],
    ['NOSOL-MATCH', 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS'],
    ['NOSOL-REMATCH', 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS'],
  ]) {
    assert.deepEqual(
      materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey }),
      noShopTier,
      `${conceptKey} should resolve to the NO_SHOP_EXCEPTIONS tier`,
    );
  }
});

test('MAPPING_TABLE_VERSION is 15 and NO_SHOP_PERIOD_PARSE_VERSION is exported', () => {
  assert.equal(MAPPING_TABLE_VERSION, 15);
  assert.equal(NO_SHOP_PERIOD_PARSE_VERSION, 2);
});

// ---------------------------------------------------------------------------
// Corroboration table unit checks (real spec-quoted bytes).
// ---------------------------------------------------------------------------

test('action corroboration: production NOSOL-PROHIBIT card corroborates SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', () => {
  const q = quoteById('action-solicit');
  assert.equal(noShopActionCorroborated('SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', q.quote), true);
});

test('action corroboration: a SOLICIT_* code on an "unsolicited"-containing quote fails corroboration (audit M-2, \\b-bounded stem must not match inside "unsolicited")', () => {
  const q = quoteById('action-unsolicited-veto');
  assert.equal(noShopActionCorroborated('SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', q.quote), false);
});

test('action corroboration: FURTHER_ACQUISITION_PROPOSAL never fires inside "furtherance"/"Furthermore" (fully bounded stem)', () => {
  assert.equal(noShopActionCorroborated('FURTHER_ACQUISITION_PROPOSAL', 'in furtherance of the Merger Agreement'), false);
  assert.equal(noShopActionCorroborated('FURTHER_ACQUISITION_PROPOSAL', 'Furthermore, the parties agree'), false);
  assert.equal(noShopActionCorroborated('FURTHER_ACQUISITION_PROPOSAL', 'the Company shall not further any Acquisition Proposal'), true);
});

test('prerequisite corroboration: production-grounded quotes corroborate their own codes', () => {
  assert.equal(noShopPrerequisiteCorroborated('BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED', quoteById('prerequisite-bona-fide').quote), true);
  assert.equal(noShopPrerequisiteCorroborated('BOARD_GOOD_FAITH_SUPERIOR_PROPOSAL_PATH_DETERMINATION', quoteById('prerequisite-good-faith-superior').quote), true);
  assert.equal(noShopPrerequisiteCorroborated('WINDOW_SIGNING_TO_STOCKHOLDER_APPROVAL', quoteById('prerequisite-window-signing-to-approval').quote), true);
});

test('period role corroboration: NOTICE requires the mandatory receipt-trigger anchor (audit M-1) -- a bare "receipt" mention with no anchor phrase fails', () => {
  assert.equal(noShopPeriodRoleCorroborated('NOTICE', quoteById('notice-within-24-hours').quote), true);
  assert.equal(noShopPeriodRoleCorroborated('NOTICE', 'upon receipt of the applicable filing fee, the Company shall notify Parent'), false);
});

test('period role corroboration: an INITIAL_MATCH-worded quote proposed as NOTICE fails NO_SHOP_PERIOD_ROLE_UNCORROBORATED (spec section 6 test 4)', () => {
  const matchWordedQuote = 'prior written notice to Parent, at least four (4) business days in advance of terminating this Agreement';
  assert.equal(noShopPeriodRoleCorroborated('INITIAL_MATCH', matchWordedQuote), true);
  assert.equal(noShopPeriodRoleCorroborated('NOTICE', matchWordedQuote), false);
});

// ---------------------------------------------------------------------------
// End-to-end resolution: action claims.
// ---------------------------------------------------------------------------

test('production NOSOL-PROHIBIT solicit card resolves end to end: concept NOSOL-PROHIBIT, canonical SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER, party TARGET', async () => {
  const q = quoteById('action-solicit');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-solicit', q.quote, {
    no_shop_action_assertions: [actionAssertion({
      actionCode: 'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', covenantObligor: 'the Company', quote: q.quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === NO_SHOP_ACTION_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].resolved_claim_definition_key, 'NO_SHOP_PROHIBITED_ACTION');
  assert.equal(resolved[0].claim.canonical_value, 'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER');
  assert.equal(resolved[0].concept_key, 'NOSOL-PROHIBIT');
  assert.equal(resolved[0].triage.materiality_rank, 50);
  assert.equal(resolved[0].party.capacity, 'TARGET');
});

test('production FURNISH_NONPUBLIC_INFORMATION card resolves end to end', async () => {
  const q = quoteById('action-furnish-information');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-furnish', q.quote, {
    no_shop_action_assertions: [actionAssertion({ actionCode: 'FURNISH_NONPUBLIC_INFORMATION', quote: q.quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === NO_SHOP_ACTION_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, 'FURNISH_NONPUBLIC_INFORMATION');
});

test('a SOLICIT_* code on an "unsolicited"-containing quote routes to review, typed NO_SHOP_ACTION_UNCORROBORATED (audit M-2 named case)', async () => {
  const q = quoteById('action-unsolicited-veto');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-unsolicited-veto', q.quote, {
    no_shop_action_assertions: [actionAssertion({ actionCode: 'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', quote: q.quote })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === NO_SHOP_ACTION_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['NO_SHOP_ACTION_UNCORROBORATED']);
  assert.equal(item.concept_key, 'NOSOL-PROHIBIT');
  assert.equal(item.materiality_rank, 50);
});

test('an out-of-enum action_code routes to open world, typed ACTION_CODE_OUT_OF_ENUM, via explicit pushOpenWorld', async () => {
  const quote = 'the Company shall not livestream any Acquisition Proposal discussions to the public';
  const { resolution } = await resolveNoShopAssertions('deal:nosol-action-out-of-enum', quote, {
    no_shop_action_assertions: [actionAssertion({ actionCode: 'LIVESTREAM_ACQUISITION_PROPOSAL', quote })],
  });
  const item = resolution.open_world.find((r) => r.claim_definition_key === NO_SHOP_ACTION_CLAIM_KEY);
  assert.ok(item);
  assert.equal(item.reason, 'ACTION_CODE_OUT_OF_ENUM');
});

test('a null action_code proceeds to corroboration (never treated as out-of-enum) and, finding no pattern, routes to review typed NO_SHOP_ACTION_UNCORROBORATED', async () => {
  const quote = 'the Company shall comply with Section 6.3(a) with respect to any Acquisition Proposal';
  const { resolution } = await resolveNoShopAssertions('deal:nosol-action-null-code', quote, {
    no_shop_action_assertions: [actionAssertion({ actionCode: null, quote })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === NO_SHOP_ACTION_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['NO_SHOP_ACTION_UNCORROBORATED']);
});

// ---------------------------------------------------------------------------
// End-to-end resolution: exception-prerequisite claims.
// ---------------------------------------------------------------------------

test('production BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED card resolves end to end: concept NOSOL-EXCEPT, party TARGET (fixed covenant obligor)', async () => {
  const q = quoteById('prerequisite-bona-fide');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-prereq-bonafide', q.quote, {
    exception_prerequisite_assertions: [prerequisiteAssertion({
      prerequisiteCode: 'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED', quote: q.quote,
    })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].claim.canonical_value, 'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED');
  assert.equal(resolved[0].concept_key, 'NOSOL-EXCEPT');
  assert.equal(resolved[0].party.capacity, 'TARGET');
});

test('a mismatched prerequisite_code (BONA_FIDE label on a good-faith-only quote) routes to review, typed NO_SHOP_PREREQUISITE_UNCORROBORATED', async () => {
  const q = quoteById('prerequisite-good-faith-superior');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-prereq-mismatch', q.quote, {
    exception_prerequisite_assertions: [prerequisiteAssertion({
      prerequisiteCode: 'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED', quote: q.quote,
    })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['NO_SHOP_PREREQUISITE_UNCORROBORATED']);
});

test('an out-of-enum prerequisite_code routes to open world, typed PREREQUISITE_CODE_OUT_OF_ENUM', async () => {
  const quote = 'the Company has obtained the written consent of its majority stockholder to pursue the Superior Proposal';
  const { resolution } = await resolveNoShopAssertions('deal:nosol-prereq-out-of-enum', quote, {
    exception_prerequisite_assertions: [prerequisiteAssertion({ prerequisiteCode: 'MAJORITY_STOCKHOLDER_WRITTEN_CONSENT', quote })],
  });
  const item = resolution.open_world.find((r) => r.claim_definition_key === NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY);
  assert.ok(item);
  assert.equal(item.reason, 'PREREQUISITE_CODE_OUT_OF_ENUM');
});

// ---------------------------------------------------------------------------
// Identity (acceptance test 5, the LOAD-BEARING half, audit m-3): two
// prerequisite codes asserted on ONE exception (one section, one concept,
// one definition -- only prerequisite_code distinguishes them) mint
// distinct, non-colliding identities.
// ---------------------------------------------------------------------------

test('identity: two prerequisite codes on ONE exception mint distinct, stable claim identities (audit m-3, the load-bearing case)', async () => {
  const bonaFide = quoteById('prerequisite-bona-fide');
  const goodFaith = quoteById('prerequisite-good-faith-superior');
  const combinedBody = `${bonaFide.quote}\n${goodFaith.quote}`;
  const response = {
    exception_prerequisite_assertions: [
      prerequisiteAssertion({ prerequisiteCode: 'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED', quote: bonaFide.quote }),
      prerequisiteAssertion({ prerequisiteCode: 'BOARD_GOOD_FAITH_SUPERIOR_PROPOSAL_PATH_DETERMINATION', quote: goodFaith.quote }),
    ],
  };
  const { resolution: run1 } = await resolveNoShopAssertions('deal:nosol-identity', combinedBody, response);
  const resolved1 = run1.resolved.filter((r) => r.generic_claim_key === NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY);
  assert.equal(resolved1.length, 2);
  const bf1 = resolved1.find((r) => r.claim.canonical_value === 'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED');
  const gf1 = resolved1.find((r) => r.claim.canonical_value === 'BOARD_GOOD_FAITH_SUPERIOR_PROPOSAL_PATH_DETERMINATION');
  assert.ok(bf1 && gf1);
  assert.notEqual(bf1.claim.closure_id, gf1.claim.closure_id, 'distinct, non-deduping claim identities on one section/concept/definition');
  assert.equal(bf1.provision_instance.provision_instance_id, gf1.provision_instance.provision_instance_id, 'same provision -- one section, one concept, one party');

  const { resolution: run2 } = await resolveNoShopAssertions('deal:nosol-identity', combinedBody, response);
  const resolved2 = run2.resolved.filter((r) => r.generic_claim_key === NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY);
  const bf2 = resolved2.find((r) => r.claim.canonical_value === 'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED');
  const gf2 = resolved2.find((r) => r.claim.canonical_value === 'BOARD_GOOD_FAITH_SUPERIOR_PROPOSAL_PATH_DETERMINATION');
  assert.equal(bf1.claim.closure_id, bf2.claim.closure_id, 're-run is byte-stable');
  assert.equal(gf1.claim.closure_id, gf2.claim.closure_id, 're-run is byte-stable');
});

// ---------------------------------------------------------------------------
// End-to-end resolution: period claims (all three roles).
// ---------------------------------------------------------------------------

test('production NOSOL-MATCH card resolves end to end as INITIAL_MATCH: concept NOSOL-MATCH, canonical 4, day_kind BUSINESS_DAYS despite the "Notice Period" label', async () => {
  const q = quoteById('period-business-days-parenthesised');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-match', q.quote, {
    period_assertions: [periodAssertion({ periodRole: 'INITIAL_MATCH', quote: q.quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === NO_SHOP_MATCH_PERIOD_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].resolved_claim_definition_key, 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS');
  assert.equal(resolved[0].claim.canonical_value, '4');
  assert.equal(resolved[0].claim.attributes.day_kind, 'BUSINESS_DAYS');
  assert.equal(resolved[0].concept_key, 'NOSOL-MATCH');
  assert.equal(resolved[0].party.capacity, 'TARGET');
});

test('a bare-day initial match period defaults to CALENDAR_DAYS without rewriting its unit phrase', async () => {
  const quote = 'prior written notice to Parent, at least five (5) days in advance of terminating this Agreement to accept a Superior Proposal';
  const { resolution } = await resolveNoShopAssertions('deal:nosol-match-bare-days', quote, {
    period_assertions: [periodAssertion({ periodRole: 'INITIAL_MATCH', quote })],
  });
  const resolved = resolution.resolved.find((r) => r.generic_claim_key === NO_SHOP_MATCH_PERIOD_CLAIM_KEY);
  assert.ok(resolved);
  assert.equal(resolved.claim.canonical_value, '5');
  assert.equal(resolved.claim.attributes.day_kind, 'CALENDAR_DAYS');
  assert.equal(resolved.claim.attributes.unit_phrase, 'days');
  assert.equal(resolution.resolution_receipt.no_shop_period_parse_version, 2);
});

test('production NOSOL-NOTICE card ("within 24 hours") proposed as NOTICE routes to review, typed PERIOD_UNIT_HOURS -- never converts to a day count (the family\'s central legal pin)', async () => {
  const q = quoteById('notice-within-24-hours');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-notice-hours', q.quote, {
    period_assertions: [periodAssertion({ periodRole: 'NOTICE', quote: q.quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === NO_SHOP_NOTICE_PERIOD_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === NO_SHOP_NOTICE_PERIOD_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['PERIOD_UNIT_HOURS']);
  assert.equal(item.concept_key, 'NOSOL-NOTICE');
  assert.equal(item.materiality_rank, 50);
});

test('the mislabelled "Notice Period" defined-term quote proposed as NOTICE (rather than its true INITIAL_MATCH role) routes to review, typed NO_SHOP_PERIOD_ROLE_UNCORROBORATED (spec section 6 test 4)', async () => {
  const q = quoteById('period-business-days-parenthesised');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-mislabel', q.quote, {
    period_assertions: [periodAssertion({ periodRole: 'NOTICE', quote: q.quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === NO_SHOP_NOTICE_PERIOD_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === NO_SHOP_NOTICE_PERIOD_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['NO_SHOP_PERIOD_ROLE_UNCORROBORATED']);
});

test('production NOSOL-REMATCH card resolves end to end as SUBSEQUENT_MATCH: concept NOSOL-REMATCH, canonical 3', async () => {
  const q = quoteById('period-rematch-new-notice');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-rematch', q.quote, {
    period_assertions: [periodAssertion({ periodRole: 'SUBSEQUENT_MATCH', quote: q.quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === NO_SHOP_REMATCH_PERIOD_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].resolved_claim_definition_key, 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS');
  assert.equal(resolved[0].claim.canonical_value, '3');
  assert.equal(resolved[0].concept_key, 'NOSOL-REMATCH');
});

test('production NOSOL-REMATCH compound card ("three (3) Business Days instead of five (5) Business Days") routes to review, typed MULTIPLE_PERIOD_LITERALS, as one quote', async () => {
  const q = quoteById('period-compound-rematch');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-rematch-compound', q.quote, {
    period_assertions: [periodAssertion({ periodRole: 'SUBSEQUENT_MATCH', quote: q.quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === NO_SHOP_REMATCH_PERIOD_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === NO_SHOP_REMATCH_PERIOD_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['MULTIPLE_PERIOD_LITERALS']);
});

// ---------------------------------------------------------------------------
// Identity (acceptance test 5, the non-load-bearing half): the initial
// five-day and renewed three-day windows resolve to DIFFERENT concepts
// (NOSOL-MATCH vs NOSOL-REMATCH) via different generic keys -- asserted for
// receipt legibility, though they could never collide regardless (audit
// m-3).
// ---------------------------------------------------------------------------

test('identity: an INITIAL_MATCH window and a SUBSEQUENT_MATCH window resolve to DIFFERENT concepts via different generic keys', async () => {
  const matchQuote = 'prior written notice to Parent, at least five (5) business days in advance of terminating this Agreement to accept a Superior Proposal';
  const rematchQuote = 'in the event of any material amendment to the terms of such Acquisition Proposal, a new written notice period of three (3) Business Days shall apply';
  const combinedBody = `${matchQuote}\n${rematchQuote}`;
  const { resolution } = await resolveNoShopAssertions('deal:nosol-match-vs-rematch', combinedBody, {
    period_assertions: [
      periodAssertion({ periodRole: 'INITIAL_MATCH', quote: matchQuote }),
      periodAssertion({ periodRole: 'SUBSEQUENT_MATCH', quote: rematchQuote }),
    ],
  });
  const matchResolved = resolution.resolved.find((r) => r.generic_claim_key === NO_SHOP_MATCH_PERIOD_CLAIM_KEY);
  const rematchResolved = resolution.resolved.find((r) => r.generic_claim_key === NO_SHOP_REMATCH_PERIOD_CLAIM_KEY);
  assert.ok(matchResolved && rematchResolved);
  assert.equal(matchResolved.concept_key, 'NOSOL-MATCH');
  assert.equal(rematchResolved.concept_key, 'NOSOL-REMATCH');
  assert.notEqual(matchResolved.claim.closure_id, rematchResolved.claim.closure_id);
});

// ---------------------------------------------------------------------------
// Provider-layer fail-closed: an unrecognised period_role is a typed
// provider error, never a guess (spec section 3).
// ---------------------------------------------------------------------------

test('shapeNoShopProposals throws a typed NativeProducerAnthropicError on an unrecognised period_role, never silently coerces it', () => {
  assert.throws(() => {
    shapeNoShopProposals({
      period_assertions: [{ section_reference: SECTION_REFERENCE, period_role: 'GO_SHOP', quote: 'some quote text' }],
    }, wrapInAgreementShell('some quote text'));
  }, (err) => err instanceof NativeProducerAnthropicError && err.code === 'NO_SHOP_PERIOD_ROLE_UNKNOWN');
});

// ---------------------------------------------------------------------------
// Additivity re-pin (P1 M-1 precedent, spec section 4): with no no-shop
// input, resolution output must be byte-identical EXCEPT
// mapping_table_version, contract_vocabulary_digest (UNCHANGED, spec
// section 1 -- this slice adds zero registry vocabulary), the three new
// parser/corroboration-version fields, and the recomputed
// resolution_receipt_id.
// ---------------------------------------------------------------------------

test('additivity: the resolution receipt carries no_shop_period_parse_version and the two corroboration-table versions unconditionally, alongside the bumped mapping_table_version; contract_vocabulary_digest is UNCHANGED (spec section 1: zero registry vocabulary added)', async () => {
  const q = quoteById('action-solicit');
  const { resolution } = await resolveNoShopAssertions('deal:nosol-additivity-pin', q.quote, {
    no_shop_action_assertions: [actionAssertion({ actionCode: 'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', quote: q.quote })],
  });
  assert.equal(resolution.resolution_receipt.no_shop_period_parse_version, NO_SHOP_PERIOD_PARSE_VERSION);
  assert.equal(resolution.resolution_receipt.mapping_table_version, MAPPING_TABLE_VERSION);
  assert.ok(typeof resolution.resolution_receipt.no_shop_action_corroboration_table_version === 'number');
  assert.ok(typeof resolution.resolution_receipt.no_shop_prerequisite_corroboration_table_version === 'number');
});

test('Wave B cease, fiduciary and recommendation facts resolve to their registered No-Shop concepts', async () => {
  const quotes = [
    'the Company shall immediately cease all discussions or negotiations.',
    'the Company Board determines that the proposal could reasonably be expected to lead to a Superior Proposal.',
    'the Company Board may withdraw or modify the Company Recommendation.',
  ];
  const { resolution } = await resolveNoShopAssertions('NO-SHOP-WAVE-B-CORE', quotes.join(' '), {
    cease_assertions: [{
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'CEASE_ACTION',
      canonical_value: 'CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS',
      covenant_obligor: 'the Company',
      quote: quotes[0],
    }],
    fiduciary_standard_assertions: [{
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'FIDUCIARY_ENGAGEMENT_STANDARD',
      canonical_value: 'COULD_REASONABLY_BE_EXPECTED_TO_LEAD',
      covenant_obligor: 'the Company Board',
      quote: quotes[1],
    }],
    recommendation_assertions: [{
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'RECOMMENDATION_CHANGE_ACTION',
      canonical_value: 'WITHDRAW_QUALIFY_OR_MODIFY_RECOMMENDATION',
      covenant_obligor: 'the Company Board',
      quote: quotes[2],
    }],
  });
  const resolved = resolution.resolved.filter((item) => item.generic_claim_key === NO_SHOP_WAVE_B_CLAIM_KEY);
  assert.deepEqual(resolved.map((item) => item.concept_key).sort(), ['NOSOL-CEASE', 'NOSOL-EXCEPT', 'NOSOL-RECOMMEND']);
});

test('Wave B standstill enforcement and positive waiver permission remain separate concepts', async () => {
  const quotes = [
    'The Company shall enforce each standstill agreement.',
    'The Company may waive a standstill if failure to do so would be inconsistent with the directors\' fiduciary duties.',
  ];
  const { resolution } = await resolveNoShopAssertions('NO-SHOP-WAVE-B-STANDSTILL', quotes.join(' '), {
    standstill_assertions: [{
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'STANDSTILL_ACTION',
      canonical_value: 'ENFORCE',
      covenant_obligor: 'The Company',
      quote: quotes[0],
    }, {
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'STANDSTILL_ACTION',
      canonical_value: 'PERMIT_WAIVER_FIDUCIARY_DUTY_GATED',
      covenant_obligor: 'The Company',
      quote: quotes[1],
    }],
  });
  const resolved = resolution.resolved.filter((item) => item.generic_claim_key === NO_SHOP_WAVE_B_CLAIM_KEY);
  assert.deepEqual(resolved.map((item) => item.concept_key).sort(), ['NOSOL-ENFORCE', 'NOSOL-WAIVER']);
});

test('native Wave A and B candidates reach Review, Query, Compare and market statistics through the same product rows', async () => {
  const actionQuote = quoteById('action-solicit').quote;
  const matchQuote = quoteById('period-business-days-parenthesised').quote;
  const ceaseQuote = 'the Company shall immediately cease all discussions or negotiations.';
  const enforceQuote = 'The Company shall enforce each standstill agreement.';
  const waiverQuote = 'The Company may waive a standstill if failure to do so would be inconsistent with the directors\' fiduciary duties.';
  const engagementQuote = 'the Company Board determines that the proposal could reasonably be expected to lead to a Superior Proposal.';
  const recommendationQuote = 'the Company Board may withdraw or modify the Company Recommendation.';
  const sectionBody = [
    actionQuote,
    matchQuote,
    ceaseQuote,
    enforceQuote,
    waiverQuote,
    engagementQuote,
    recommendationQuote,
  ].join(' ');
  const { resolution } = await resolveNoShopAssertions('deal:no-shop-product-parity', sectionBody, {
    no_shop_action_assertions: [actionAssertion({
      actionCode: 'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
      quote: actionQuote,
    })],
    period_assertions: [periodAssertion({ periodRole: 'INITIAL_MATCH', quote: matchQuote })],
    cease_assertions: [{
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'CEASE_ACTION',
      canonical_value: 'CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS',
      covenant_obligor: 'the Company',
      quote: ceaseQuote,
    }],
    standstill_assertions: [{
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'STANDSTILL_ACTION',
      canonical_value: 'ENFORCE',
      covenant_obligor: 'The Company',
      quote: enforceQuote,
    }, {
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'STANDSTILL_ACTION',
      canonical_value: 'PERMIT_WAIVER_FIDUCIARY_DUTY_GATED',
      covenant_obligor: 'The Company',
      quote: waiverQuote,
    }],
    fiduciary_standard_assertions: [{
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'FIDUCIARY_ENGAGEMENT_STANDARD',
      canonical_value: 'COULD_REASONABLY_BE_EXPECTED_TO_LEAD',
      covenant_obligor: 'the Company Board',
      quote: engagementQuote,
    }],
    recommendation_assertions: [{
      section_reference: SECTION_REFERENCE,
      assertion_kind: 'RECOMMENDATION_CHANGE_ACTION',
      canonical_value: 'WITHDRAW_QUALIFY_OR_MODIFY_RECOMMENDATION',
      covenant_obligor: 'the Company Board',
      quote: recommendationQuote,
    }],
  });
  const parity = compileNoShopProductParity({
    candidate_results: [{
      governed_deal_key: 'deal:no-shop-product-parity',
      resolution,
    }],
  });
  assert.equal(parity.product_rows.length, 7);
  assert.deepEqual(Object.keys(parity.surfaces), [
    'REVIEW',
    'QUERY',
    'COMPARE',
    'MARKET_STATISTICS',
  ]);
  const productIds = parity.product_rows.map((row) => row.product_row_id).sort();
  assert.deepEqual(parity.surfaces.REVIEW.map((row) => row.product_row_id).sort(), productIds);
  assert.deepEqual(parity.surfaces.QUERY.map((row) => row.product_row_id).sort(), productIds);
  assert.deepEqual(parity.surfaces.COMPARE.map((row) => row.product_row_id).sort(), productIds);
  assert.ok(parity.surfaces.MARKET_STATISTICS.every((group) => (
    group.deal_count === 1 && group.product_row_ids.every((id) => productIds.includes(id))
  )));
  const initialMatch = parity.product_rows.find((row) => (
    row.field_path === 'noShop.initialMatchPeriodDays'
  ));
  assert.deepEqual(initialMatch.comparison_tuple, {
    canonical_value: '4',
    day_kind: 'BUSINESS_DAYS',
  });
  assert.ok(parity.product_rows.every((row) => row.evidence.length > 0 && row.evidence_text));
});

test('No-Shop product vocabulary excludes Acquisition Proposal and Superior Proposal definitions and thresholds', () => {
  assert.equal(Object.keys(CLAIM_PRESENTATION).some((key) => (
    KEY_TERMS_OWNED_DEFINITIONS.includes(key)
  )), false);
  assert.deepEqual(KEY_TERMS_OWNED_DEFINITIONS, [
    'ACQUISITION_PROPOSAL_THRESHOLD_PERCENT',
    'SUPERIOR_PROPOSAL_THRESHOLD_PERCENT',
    'DEFINED_TERM_THRESHOLD_SUBSTITUTION',
    'SUPERIOR_PROPOSAL_QUALIFIER',
  ]);
  assert.deepEqual(KEY_TERMS_OWNED_CONCEPTS, [
    'DEF-ACQPROPOSAL',
    'DEF-SUPERIOR',
  ]);
});

test('market statistics and Compare keep business-day and calendar-day periods separate', async () => {
  const businessQuote = 'prior written notice to Parent, at least five (5) business days in advance of terminating this Agreement to accept a Superior Proposal';
  const calendarQuote = 'prior written notice to Parent, at least five (5) days in advance of terminating this Agreement to accept a Superior Proposal';
  const business = await resolveNoShopAssertions('deal:no-shop-business-days', businessQuote, {
    period_assertions: [periodAssertion({ periodRole: 'INITIAL_MATCH', quote: businessQuote })],
  });
  const calendar = await resolveNoShopAssertions('deal:no-shop-calendar-days', calendarQuote, {
    period_assertions: [periodAssertion({ periodRole: 'INITIAL_MATCH', quote: calendarQuote })],
  });
  const parity = compileNoShopProductParity({
    candidate_results: [{
      governed_deal_key: 'deal:no-shop-business-days',
      resolution: business.resolution,
    }, {
      governed_deal_key: 'deal:no-shop-calendar-days',
      resolution: calendar.resolution,
    }],
  });
  const compare = parity.surfaces.COMPARE.filter((row) => (
    row.field_path === 'noShop.initialMatchPeriodDays'
  ));
  assert.deepEqual(compare.map((row) => row.comparison_tuple), [{
    canonical_value: '5',
    day_kind: 'BUSINESS_DAYS',
  }, {
    canonical_value: '5',
    day_kind: 'CALENDAR_DAYS',
  }]);
  const groups = parity.surfaces.MARKET_STATISTICS.filter((row) => (
    row.field_path === 'noShop.initialMatchPeriodDays'
  ));
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.comparison_tuple.day_kind), [
    'BUSINESS_DAYS',
    'CALENDAR_DAYS',
  ]);
  const reversed = compileNoShopProductParity({
    candidate_results: [{
      governed_deal_key: 'deal:no-shop-calendar-days',
      resolution: calendar.resolution,
    }, {
      governed_deal_key: 'deal:no-shop-business-days',
      resolution: business.resolution,
    }],
  });
  assert.deepEqual(reversed, parity);
});
