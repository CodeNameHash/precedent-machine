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
  indexFeeTriggerCandidatesBySection,
  resolveCitationFollowupTriggerCode,
  factKeyForResolvedEntry,
  isCitationFollowupSighting,
  sectionReferenceDepth,
  longestEvidenceSpan,
  compareFeeSightingRank,
  reconcileDuplicateTerminationFeeSightings,
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
// Multi-section fixture (docs/codex-program/notes/fee-side-scope-fix.md):
// the fallback this section tests only fires when a candidate's own
// dispatched section is silent, so it structurally cannot be exercised by
// the single-section harness above (SECTION_REFERENCE, resolveTermination
// FeeAssertions). Three lettered sub-clauses under ONE "Section 3.1"
// heading, each independently dispatchable as "3.1(a)"/"3.1(b)"/"3.1(c)" --
// mirroring how the single-section harness above already dispatches
// "3.1(b)" alone -- so each can carry its own section_family assignment and
// its own (possibly empty) set of proposals. This stands in for Modiv's
// real, separate Sections 7.1/7.3/8.12: resolveCandidates reads
// section_reference/start/end/section_family/section_family_provenance off
// run_receipt.resolved_sections and does not care whether the underlying
// text used sub-clause letters or full "Section N.N" headings to get there.
// ---------------------------------------------------------------------------

function wrapMultiClauseAgreementShell(clauseBodiesByLetter) {
  const clauseText = Object.entries(clauseBodiesByLetter)
    .map(([letter, body]) => `(${letter})${body}\n\n`)
    .join('');
  return [
    'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
    'Buyer, Inc. and the Company.\n\n',
    'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
    'Section 3.1 Representations Concerning the Company.\n\n',
    clauseText,
  ].join('');
}

// `familyByReference`: { "3.1(a)": "TERMINATION_FEE", ... } -- omit entirely
// (pass {}) to leave EVERY dispatched section at native-extraction-run.js's
// own backward-compatible default (family CAPITALISATION, provenance null,
// the "no manifest, no classifier" case): `section_family_assignments`
// itself must cover every requested reference or none at all
// (requireSectionFamilyAssignments), so this helper only sends it when at
// least one entry is supplied, matching how the single-section harness
// above never sends it.
// `responsesByReference`: { "3.1(a)": { fee_trigger_assertions: [...] } }
// -- a section named here with no entry gets an all-empty response (real
// text, no candidates of its own), standing in for a sibling section
// dispatched only so its BODY TEXT is available to the widened scan.
async function resolveMultiSectionTerminationFeeAssertions(dealKey, clauseBodiesByLetter, {
  familyByReference = {}, responsesByReference = {},
} = {}) {
  const sourceText = wrapMultiClauseAgreementShell(clauseBodiesByLetter);
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));
  const admittedSourceContext = buildIdentityAdmittedSourceContext(sourceText, {
    dealKey, dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`), sourceOrdinal: 0,
  });
  const sectionReferences = Object.keys(clauseBodiesByLetter).map((letter) => `3.1(${letter})`);
  const familyEntries = Object.keys(familyByReference);
  const sectionFamilyAssignments = familyEntries.length === 0
    ? undefined
    : sectionReferences.map((ref) => ({ section_reference: ref, family_id: familyByReference[ref] }));

  let callIndex = 0;
  const receipt = await runNativeExtraction({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: sectionReferences,
    ...(sectionFamilyAssignments ? { section_family_assignments: sectionFamilyAssignments } : {}),
    contract_bundle: CONTRACT_BUNDLE_V15,
    definitions: Object.freeze({ known_definitions: [] }),
    provider: async ({ governed_scope: governedScope }) => {
      // Sequential, in section_references order (native-extraction-run.js
      // dispatches its `resolved` list, itself `references.map(...)`, in
      // request order) -- mirrors the real replay harness's own
      // callIndex-based makeReplayClient rather than trying to recover the
      // current section identity from governed_scope's own shape.
      const sectionReference = sectionReferences[callIndex];
      callIndex += 1;
      const response = responsesByReference[sectionReference] || {};
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
  return {
    receipt, resolution, sourceText, documentHash, admittedSourceContext,
  };
}

// Real, byte-identical recorded bytes (docs/codex-program/notes/fee-side-
// scope-fix.md; evidence/canonical-v2/modiv-termination-fee-promptv3-
// 20260805/resolution.json review_queue[0].raw_value AND
// native-producer-recorded-response-7.1.json fee_trigger_assertions[0].quote
// -- both files carry this identical string). The model coded this
// correctly, unprompted, with no citation and no defined fee term in its
// own quote: SUPERIOR_PROPOSAL_TERMINATION, SELLER. It was rejected
// FEE_SIDE_UNCORROBORATED live because feeSideFromFullPaymentContext scans
// only the candidate's own dispatched section, and Modiv's payment-
// direction sentence sits in a DIFFERENT section (7.3), not this one (7.1).
const MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE = 'the Company Board has approved, and substantially concurrently with '
  + 'the termination of this Agreement, the Company enters into, a definitive agreement providing for the '
  + 'implementation of a Superior Proposal';

// Copied verbatim from FEE_SIDE_FULL_PAYMENT_CONTEXT_PATTERNS in
// candidate-resolution.js (the exact, already-committed, already-tested
// production regex this fallback reads through, not a new phrase invented
// for this test) -- independently confirmed, this session, to match
// Modiv's real Section 7.3 text byte-for-byte via a direct read of the
// committed HTML fixture through the real sectionizer.
const SELLER_FULL_PAYMENT_SENTENCE = 'the Company shall pay (or cause to be paid) as directed by Parent the '
  + 'Company Termination Fee by wire transfer of same day funds to an account designated by Parent.';
const BUYER_FULL_PAYMENT_SENTENCE = 'Parent shall pay (or cause to be paid) as directed by the Company the '
  + 'Parent Termination Fee by wire transfer of same day funds to an account designated by the Company.';

test('fee-side-scope-fix: the real Section 7.1(c)(i) Superior Proposal trigger resolves SELLER via the section-family fallback when its OWN section is silent and a sibling section in the same family carries the payment sentence', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:fee-side-scope-superior-proposal', {
    a: ` Termination Rights. ${MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE}.`,
    b: ` Termination Fees. ${SELLER_FULL_PAYMENT_SENTENCE}`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION',
          quote: MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE,
        })],
      },
    },
  });

  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 1, `expected exactly one resolved trigger claim, got ${JSON.stringify(resolution.review_queue, null, 2)}`);
  assert.equal(resolved[0].claim.canonical_value, 'SUPERIOR_PROPOSAL_TERMINATION');
  assert.equal(resolved[0].concept_key, 'TERMF-TARGET');
  assert.equal(resolved[0].claim.attributes.fee_side, 'SELLER');
  assert.equal(
    resolved[0].claim.attributes.fee_side_corroboration_scope, 'SECTION_FAMILY',
    'must be distinguishable from a same-section corroboration in the resolved claim\'s own output',
  );
  assert.equal(resolved[0].claim.attributes.fee_side_corroboration_section_reference, '3.1(b)');
  assert.equal(resolved[0].claim.attributes.fee_side_corroboration_quote, SELLER_FULL_PAYMENT_SENTENCE);
});

test('fee-side-scope-fix: distinguishability -- a same-section corroboration (direct quote) never carries fee_side_corroboration_scope', async () => {
  const quote = 'the Company shall pay Parent the Company Termination Fee if the Company terminates for a Superior Proposal';
  const { resolution } = await resolveTerminationFeeAssertions('deal:fee-side-scope-same-section-direct', quote, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION', quote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 1);
  assert.equal('fee_side_corroboration_scope' in resolved[0].claim.attributes, false);
  assert.equal('fee_side_corroboration_section_reference' in resolved[0].claim.attributes, false);
});

test('fee-side-scope-fix: distinguishability -- a same-section corroboration (whole-section fallback, today\'s pre-existing feeSideFromFullPaymentContext path) never carries fee_side_corroboration_scope either', async () => {
  const bareQuote = 'by the Company pursuant to Section 3.1(c) for a Superior Proposal';
  const sectionBody = `${bareQuote}\n\n${SELLER_FULL_PAYMENT_SENTENCE}`;
  const { resolution } = await resolveTerminationFeeAssertions('deal:fee-side-scope-same-section-fallback', sectionBody, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION', quote: bareQuote })],
  });
  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 1, `expected the pre-existing same-section fallback to resolve this, got ${JSON.stringify(resolution.review_queue, null, 2)}`);
  assert.equal('fee_side_corroboration_scope' in resolved[0].claim.attributes, false);
});

test('fee-side-scope-fix hostile: a fee-side phrase in an UNRELATED section_family must NOT corroborate', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:fee-side-scope-hostile-unrelated-family', {
    a: ` Termination Rights. ${MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE}.`,
    b: ` Material Adverse Effect. ${SELLER_FULL_PAYMENT_SENTENCE}`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'MAE_DEFINITION' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION',
          quote: MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE,
        })],
      },
    },
  });

  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 0, 'a sibling section in a DIFFERENT family must never corroborate, even though it shares this run and carries the matching sentence');
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_SIDE_UNCORROBORATED']);
});

test('fee-side-scope-fix hostile: evidence for both sides, in TWO DIFFERENT sibling sections, gives AMBIGUOUS_FEE_SIDE -- never a coin flip', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:fee-side-scope-hostile-both-sides', {
    a: ` Termination Rights. ${MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE}.`,
    b: ` Company Fee Payment. ${SELLER_FULL_PAYMENT_SENTENCE}`,
    c: ` Parent Fee Payment. ${BUYER_FULL_PAYMENT_SENTENCE}`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE', '3.1(c)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION',
          quote: MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE,
        })],
      },
    },
  });

  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 0, 'clean, single-sided support for each side in two SEPARATE sections must never resolve to either side by default');
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['AMBIGUOUS_FEE_SIDE']);
});

test('fee-side-scope-fix: both sides\' sentences in the SAME sibling section is NOT ambiguous -- each is its own complete, self-attributing sentence, exactly the shape Modiv\'s real Section 7.3 has', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:fee-side-scope-same-section-both-sides', {
    a: ` Termination Rights. ${MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE}.`,
    b: ` Termination Fees. ${SELLER_FULL_PAYMENT_SENTENCE} ${BUYER_FULL_PAYMENT_SENTENCE}`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION',
          quote: MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE,
        })],
      },
    },
  });

  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 1, `Section 7.3's real shape (both sentences, one section) must still let the claimed side resolve, got ${JSON.stringify(resolution.review_queue, null, 2)}`);
  assert.equal(resolved[0].claim.attributes.fee_side, 'SELLER');
  assert.equal(resolved[0].claim.attributes.fee_side_corroboration_scope, 'SECTION_FAMILY');
});

test('fee-side-scope-fix hostile: a candidate with no corroboration anywhere in the family still rejects FEE_SIDE_UNCORROBORATED, exactly as today', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:fee-side-scope-hostile-no-corroboration', {
    a: ` Termination Rights. ${MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE}.`,
    b: ' Definitions. "Material Adverse Effect" means any change that is materially adverse to the business of the Company.',
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION',
          quote: MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE,
        })],
      },
    },
  });

  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 0);
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_SIDE_UNCORROBORATED']);
});

test('fee-side-scope-fix hostile: with NO section_family_assignments supplied at all (every section defaults to CAPITALISATION, provenance null), the fallback must NOT fire even though a sibling section carries the payment sentence', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:fee-side-scope-hostile-default-family', {
    a: ` Termination Rights. ${MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE}.`,
    b: ` Termination Fees. ${SELLER_FULL_PAYMENT_SENTENCE}`,
  }, {
    // familyByReference deliberately omitted: resolveMultiSectionTerminationFeeAssertions
    // then never sends section_family_assignments at all, leaving both
    // sections at native-extraction-run.js's own DEFAULT_SECTION_FAMILY
    // (CAPITALISATION, provenance null) -- the exact bucket
    // SECTION_FAMILY_REAL_PROVENANCES exists to keep out.
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION',
          quote: MODIV_SUPERIOR_PROPOSAL_TRIGGER_QUOTE,
        })],
      },
    },
  });

  const resolved = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(resolved.length, 0, 'an unclassified (CAPITALISATION-default) section family must never be trusted as a real grouping, even when every section in the run shares the same default label');
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['FEE_SIDE_UNCORROBORATED']);
});

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
// Citation-following (docs/codex-program/notes/citation-scope-design.md
// Part 6.3; docs/codex-program/notes/citation-following-implementation.md).
// handleFeeTriggerCandidate's new branch: a bare cross-reference quote
// borrows a CITED, independently-dispatched section's own (raw_value,
// trigger_code) for the SAME matchedCodes/triggerCode gate every other
// candidate in this file already goes through, unmodified. These tests
// use resolveMultiSectionTerminationFeeAssertions (defined above, built
// for the fee-side-scope-fix tests) precisely because citation-following,
// like that fix, structurally cannot be exercised by the single-section
// harness: it needs a SECOND, independently-dispatched section in the SAME
// run.
//
// docs/codex-program/notes/claim-identity-reconciliation.md: whenever a
// citing candidate's borrow succeeds, the section it borrowed FROM is --
// by resolveCitationFollowupTriggerCode's own gate -- always present this
// run as its own, independently (non-bare) corroborated candidate, sharing
// the citing claim's own concept_key/party/canonical_value. That is exactly
// factKeyForResolvedEntry's grouping condition, so every test below that
// used to assert "the citing candidate resolves, carrying a TRIGGERED_BY
// relationship to what it cited" now asserts the corrected outcome:
// reconcileDuplicateTerminationFeeSightings folds the citing sighting into
// the cited one (never operative on its own -- see isCitationFollowupSighting's
// own comment for why it never wins), and mintPendingCitationRelationships
// then finds no citing entry left to mint a relationship FROM, so none is
// minted (CITATION_RELATIONSHIP_MINT_FAILED, reason CITING_CLAIM_NOT_
// PUBLISHED, not a dangling reference). This is not a weaker test of the
// same mechanism -- these are, structurally, the SAME "one legal fact,
// several rows" defect the reconciliation was built to fix, in miniature.
// ---------------------------------------------------------------------------

test('citation-following + reconciliation: a bare citation borrows a cited section\'s code, then the citing sighting merges into the cited one -- no separate row, no relationship', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:citation-following-clean-resolve', {
    a: ` Termination Fee. In the event this Agreement is terminated by Parent pursuant to Section 3.1(b), then ${SELLER_FULL_PAYMENT_SENTENCE}`,
    b: ` Grounds. the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: null, quote: 'by Parent pursuant to Section 3.1(b)',
        })],
      },
      '3.1(b)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(b)', feeSide: 'SELLER', triggerCode: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
          quote: 'the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.',
        })],
      },
    },
  });

  // The citing candidate (3.1(a)) is no longer its own row: it shares
  // TERMF-TARGET/the Company/TERMINATION_FEE_TRIGGER/CHANGE_IN_RECOMMENDATION_
  // TERMINATION with 3.1(b), so reconcileDuplicateTerminationFeeSightings
  // folds it away. Confirmed both directions: absent from resolved...
  const citing = resolution.resolved.find((r) => r.section_reference === '3.1(a)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(citing, undefined, 'the citing sighting must not survive as its own row once its cited target resolved');

  // ...and the cited candidate (3.1(b)) is the sole survivor, carrying an
  // additive attribute naming exactly what merged into it.
  const cited = resolution.resolved.find((r) => r.section_reference === '3.1(b)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(cited, `expected 3.1(b) to be the sole surviving row, got resolved ${JSON.stringify(resolution.resolved.map((r) => r.section_reference))}`);
  assert.equal(cited.claim.canonical_value, 'CHANGE_IN_RECOMMENDATION_TERMINATION');
  assert.equal(cited.concept_key, 'TERMF-TARGET');
  assert.equal(cited.claim.attributes.trigger_code, 'CHANGE_IN_RECOMMENDATION_TERMINATION');
  assert.equal(
    'trigger_code_corroboration_scope' in cited.claim.attributes, false,
    '3.1(b) corroborated on its own text -- it was never itself a citation-followup borrower',
  );
  assert.equal(cited.claim.attributes.duplicate_sightings_merged.length, 1);
  assert.equal(cited.claim.attributes.duplicate_sightings_merged[0].section_reference, '3.1(a)');
  assert.equal(cited.claim.attributes.duplicate_sightings_merged[0].raw_value, 'by Parent pursuant to Section 3.1(b)');

  // No relationship: the only candidate that could have been its source
  // (3.1(a)) was merged away before mintPendingCitationRelationships ran.
  assert.equal(resolution.relationships, undefined, 'nothing left to mint a TRIGGERED_BY relationship FROM');
  assert.equal('relationships' in resolution.resolution_receipt.counts, false);

  // Both the fold and the mint-skip are explainable in resolution.residuals,
  // not silently absorbed -- and the merged claim's own id, independently
  // recorded by the residual, must be the SAME id the winner's own
  // attribute names (internal consistency, not just two separate shapes).
  const mergeResidual = resolution.residuals.find((r) => r.residual_type === 'DUPLICATE_FACT_SIGHTING_MERGED');
  assert.ok(mergeResidual);
  assert.equal(mergeResidual.merged_section_reference, '3.1(a)');
  assert.equal(mergeResidual.merged_claim_occurrence_id, cited.claim.attributes.duplicate_sightings_merged[0].claim_occurrence_id);
  assert.equal(mergeResidual.winning_section_reference, '3.1(b)');
  assert.equal(mergeResidual.winning_claim_occurrence_id, cited.claim.claim_occurrence_id);
  const mintFailedResidual = resolution.residuals.find((r) => r.residual_type === 'CITATION_RELATIONSHIP_MINT_FAILED');
  assert.ok(mintFailedResidual);
  assert.equal(mintFailedResidual.section_reference, '3.1(a)');
  assert.equal(mintFailedResidual.cited_reference, '3.1(b)');
  assert.equal(mintFailedResidual.reason, 'CITING_CLAIM_NOT_PUBLISHED');
});

test('citation-following + reconciliation: a disjunctive bare citation naming two sections that AGREE collapses all three sightings into one row', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:citation-following-disjunctive-agree', {
    a: ` Termination Fee. by the Company pursuant to Section 3.1(b) or Section 3.1(c). ${SELLER_FULL_PAYMENT_SENTENCE}`,
    b: ` Ground One. the Company Board has approved a Superior Proposal.`,
    c: ` Ground Two. the Company Board has approved, substantially concurrently, a Superior Proposal transaction.`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE', '3.1(c)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: null, quote: 'by the Company pursuant to Section 3.1(b) or Section 3.1(c)',
        })],
      },
      '3.1(b)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(b)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION', quote: 'the Company Board has approved a Superior Proposal.',
        })],
      },
      '3.1(c)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(c)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION', quote: 'the Company Board has approved, substantially concurrently, a Superior Proposal transaction.',
        })],
      },
    },
  });

  // All three of 3.1(a) (citation-followup), 3.1(b) and 3.1(c) (both direct)
  // agree on TERMF-TARGET/the Company/SUPERIOR_PROPOSAL_TERMINATION -- one
  // fact key, one surviving row. 3.1(a) always loses (isCitationFollowup
  // Sighting). Between 3.1(b) and 3.1(c), equally direct and equally
  // specific (both one paren-group deep), longestEvidenceSpan decides:
  // 3.1(c)'s quote is the longer of the two.
  const triggerRows = resolution.resolved.filter((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(triggerRows.length, 1, `expected exactly one surviving TRIGGER row, got ${JSON.stringify(triggerRows.map((r) => r.section_reference))}`);
  const [winner] = triggerRows;
  assert.equal(winner.section_reference, '3.1(c)', 'the longer, equally-specific direct sighting wins the tiebreak');
  assert.equal(winner.claim.canonical_value, 'SUPERIOR_PROPOSAL_TERMINATION');
  assert.deepEqual(
    winner.claim.attributes.duplicate_sightings_merged.map((m) => m.section_reference).sort(),
    ['3.1(a)', '3.1(b)'],
  );

  // No relationship: 3.1(a), the only possible source, did not survive.
  assert.equal(resolution.relationships, undefined);
  const mintFailedReasons = resolution.residuals
    .filter((r) => r.residual_type === 'CITATION_RELATIONSHIP_MINT_FAILED')
    .map((r) => ({ cited_reference: r.cited_reference, reason: r.reason }));
  assert.deepEqual(
    mintFailedReasons.sort((x, y) => x.cited_reference.localeCompare(y.cited_reference)),
    [
      { cited_reference: '3.1(b)', reason: 'CITING_CLAIM_NOT_PUBLISHED' },
      { cited_reference: '3.1(c)', reason: 'CITING_CLAIM_NOT_PUBLISHED' },
    ],
    'one mint-failed residual per originally-cited reference, both explained the same way',
  );
});

test('citation-following hostile: a disjunctive bare citation naming two sections that DISAGREE on the code never resolves -- falls through unchanged, TRIGGER_UNCORROBORATED, no relationship', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:citation-following-disjunctive-disagree', {
    a: ` Termination Fee. by the Company pursuant to Section 3.1(b) or Section 3.1(c). ${SELLER_FULL_PAYMENT_SENTENCE}`,
    b: ` Ground One. the Company Board has approved a Superior Proposal.`,
    c: ` Ground Two. the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE', '3.1(c)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: null, quote: 'by the Company pursuant to Section 3.1(b) or Section 3.1(c)',
        })],
      },
      '3.1(b)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(b)', feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION', quote: 'the Company Board has approved a Superior Proposal.',
        })],
      },
      '3.1(c)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(c)', feeSide: 'SELLER', triggerCode: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
          quote: 'the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.',
        })],
      },
    },
  });

  const citing = resolution.resolved.find((r) => r.section_reference === '3.1(a)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(citing, undefined, 'must never guess between two genuinely disagreeing cited grounds');
  const item = resolution.review_queue.find((r) => r.section_reference === '3.1(a)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['TRIGGER_UNCORROBORATED'], 'byte-identical to the ordinary bare-quote outcome -- no new reason code');
  assert.equal(resolution.relationships, undefined, 'omitted entirely -- nothing was minted');
});

test('citation-following + reconciliation: a chained citation (the cited section\'s own answer is ITSELF still bare) never resolves for 3.1(a); 3.1(b) merges into 3.1(c) instead of carrying its own relationship', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:citation-following-chained', {
    a: ` Termination Fee. by Parent pursuant to Section 3.1(b). ${SELLER_FULL_PAYMENT_SENTENCE}`,
    b: ` by Parent pursuant to Section 3.1(c).`, // itself still bare
    c: ` the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE', '3.1(c)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: null, quote: 'by Parent pursuant to Section 3.1(b)',
        })],
      },
      '3.1(b)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(b)', feeSide: 'SELLER', triggerCode: null, quote: 'by Parent pursuant to Section 3.1(c)',
        })],
      },
      '3.1(c)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(c)', feeSide: 'SELLER', triggerCode: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
          quote: 'the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.',
        })],
      },
    },
  });

  // From 3.1(a)'s OWN point of view, the chain is correctly refused: the
  // only candidate resolveCitationFollowupTriggerCode finds for its cited
  // reference (3.1(b)) is bare, so it is filtered out of the candidate
  // pool entirely (zero usable candidates, not one) -- 3.1(a) can never
  // see two hops away into 3.1(c).
  const citingA = resolution.resolved.find((r) => r.section_reference === '3.1(a)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(citingA, undefined, 'a chained citation (one hop short of real ground text) must never resolve in v1');
  const itemA = resolution.review_queue.find((r) => r.section_reference === '3.1(a)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.deepEqual(itemA.reasons, ['TRIGGER_UNCORROBORATED']);

  // 3.1(b) is not ONLY "the cited target of 3.1(a)'s citation" -- it is
  // ALSO its own independently-dispatched candidate this same run, and ITS
  // bare quote cites 3.1(c), which DOES have real, cleanly-resolving
  // ground text. This is hop limit 1 working exactly as designed: nobody
  // ever sees two hops away, but the section one hop away gets its own,
  // independent, single hop -- using data already dispatched for a
  // different reason, at zero extra cost. This is not a shortfall of the
  // hop-limit design; it is what "each dispatched section is asked the
  // same question every other dispatched section is asked" (Part 6.1)
  // means when the SAME document happens to chain through it twice. But
  // 3.1(b)'s own borrow is, itself, exactly the same "citing sighting of a
  // fact its own cited section already states" shape as the top-level test
  // above -- so it merges into 3.1(c) the same way, leaving 3.1(c) as the
  // one surviving row for this ground and no relationship for either hop.
  const citingB = resolution.resolved.find((r) => r.section_reference === '3.1(b)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(citingB, undefined, '3.1(b) must not survive as its own row once 3.1(c), what it cited, resolved');

  const citedC = resolution.resolved.find((r) => r.section_reference === '3.1(c)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(citedC, `expected 3.1(c) to be the sole surviving row, got resolved ${JSON.stringify(resolution.resolved.map((r) => r.section_reference))}`);
  assert.equal(citedC.claim.canonical_value, 'CHANGE_IN_RECOMMENDATION_TERMINATION');
  assert.equal(
    'trigger_code_corroboration_scope' in citedC.claim.attributes, false,
    '3.1(c) corroborated on its own text -- it was never itself a citation-followup borrower',
  );
  assert.deepEqual(citedC.claim.attributes.duplicate_sightings_merged.map((m) => m.section_reference), ['3.1(b)']);

  assert.equal(resolution.relationships, undefined, 'neither hop leaves a citing row to mint a relationship FROM');
  const mintFailed = resolution.residuals.find((r) => r.residual_type === 'CITATION_RELATIONSHIP_MINT_FAILED');
  assert.ok(mintFailed);
  assert.equal(mintFailed.section_reference, '3.1(b)');
  assert.equal(mintFailed.cited_reference, '3.1(c)');
  assert.equal(mintFailed.reason, 'CITING_CLAIM_NOT_PUBLISHED');
});

test('citation-following: the cited section resolving to a DIFFERENT code than its own text supports (a live disagreement) never resolves the citing candidate either', async () => {
  const { resolution } = await resolveMultiSectionTerminationFeeAssertions('deal:citation-following-cited-disagrees', {
    a: ` Termination Fee. by Parent pursuant to Section 3.1(b). ${SELLER_FULL_PAYMENT_SENTENCE}`,
    b: ` Ground. the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.`,
  }, {
    familyByReference: { '3.1(a)': 'TERMINATION_FEE', '3.1(b)': 'TERMINATION_FEE' },
    responsesByReference: {
      '3.1(a)': {
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(a)', feeSide: 'SELLER', triggerCode: null, quote: 'by Parent pursuant to Section 3.1(b)',
        })],
      },
      '3.1(b)': {
        // The model asserts a code that disagrees with what its OWN text's
        // pattern match supports (mirrors acceptance 2 above, one level
        // removed) -- must not be borrowed.
        fee_trigger_assertions: [feeTriggerAssertion({
          sectionReference: '3.1(b)', feeSide: 'SELLER', triggerCode: 'OUTSIDE_DATE_TERMINATION',
          quote: 'the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.',
        })],
      },
    },
  });

  const citing = resolution.resolved.find((r) => r.section_reference === '3.1(a)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.equal(citing, undefined);
  const item = resolution.review_queue.find((r) => r.section_reference === '3.1(a)' && r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.deepEqual(item.reasons, ['TRIGGER_UNCORROBORATED']);
});

test('citation-following inertness: a bare citation whose target section was never dispatched this run behaves BYTE-IDENTICALLY to before this feature existed (single-section harness, unaffected)', async () => {
  // The single-section harness (resolveTerminationFeeAssertions) dispatches
  // ONLY SECTION_REFERENCE ('3.1(b)') -- nothing this quote cites is ever
  // present in feeTriggerCandidatesBySection, so citationFollowup must be
  // null and every branch below must be untouched. This is the SAME real
  // shape as every pre-existing TRIGGER_UNCORROBORATED test in this file
  // (e.g. the Bioverativ test above) -- restated here explicitly as a
  // citation-following inertness proof, not a new behaviour.
  const quote = 'the Company shall pay Parent if the Company terminates by Parent pursuant to Section 9.9(z)';
  const { resolution } = await resolveTerminationFeeAssertions('deal:citation-following-inert-single-section', quote, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: null, quote })],
  });
  const item = resolution.review_queue.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(item);
  assert.deepEqual(item.reasons, ['TRIGGER_UNCORROBORATED'], 'exactly one reason -- no CITATION_* code ever leaks into review_queue.reasons');
  assert.equal(resolution.relationships, undefined);
  assert.equal('relationships' in resolution.resolution_receipt.counts, false);
});

test('resolveCitationFollowupTriggerCode (exported, direct): reuses the identical matchedCodes.length===1 && triggerCode===matchedCodes[0] gate against a hand-built candidate index', () => {
  const clean = new Map([
    ['3.1(b)', [{
      entry: { section_reference: '3.1(b)' },
      claim: { raw_value: 'the Company Board has approved a Superior Proposal.', attributes: { trigger_code: 'SUPERIOR_PROPOSAL_TERMINATION' } },
    }]],
  ]);
  assert.deepEqual(
    Object.keys(resolveCitationFollowupTriggerCode(['3.1(b)'], clean)).sort(),
    ['citedCandidates', 'triggerCode'],
  );
  assert.equal(resolveCitationFollowupTriggerCode(['3.1(b)'], clean).triggerCode, 'SUPERIOR_PROPOSAL_TERMINATION');

  // Not resolved this run at all.
  assert.equal(resolveCitationFollowupTriggerCode(['9.9(z)'], new Map()), null);

  // Cited candidate itself null trigger_code (matchedCodes.length===1 but
  // the model abstained) -- must not borrow a code the model never
  // asserted, even at one remove.
  const modelSilent = new Map([
    ['3.1(b)', [{
      entry: { section_reference: '3.1(b)' },
      claim: { raw_value: 'the Company Board has approved a Superior Proposal.', attributes: { trigger_code: null } },
    }]],
  ]);
  assert.equal(resolveCitationFollowupTriggerCode(['3.1(b)'], modelSilent), null);

  // Cited candidate's own text matches ZERO codes.
  const vocabGap = new Map([
    ['3.1(b)', [{
      entry: { section_reference: '3.1(b)' },
      claim: { raw_value: 'the conditions in Section 6.1 were satisfied and the Company failed to close.', attributes: { trigger_code: 'OUTSIDE_DATE_TERMINATION' } },
    }]],
  ]);
  assert.equal(resolveCitationFollowupTriggerCode(['3.1(b)'], vocabGap), null);

  // Cited candidate's own text matches >=2 codes (ambiguous on its own).
  const ambiguous = new Map([
    ['3.1(b)', [{
      entry: { section_reference: '3.1(b)' },
      claim: { raw_value: 'a breach of the Outside Date provision occurred.', attributes: { trigger_code: 'OUTSIDE_DATE_TERMINATION' } },
    }]],
  ]);
  assert.equal(resolveCitationFollowupTriggerCode(['3.1(b)'], ambiguous), null);

  // Cited reference resolves to MORE than one candidate for that section --
  // fails closed rather than picking one.
  const multipleCandidates = new Map([
    ['3.1(b)', [
      {
        entry: { section_reference: '3.1(b)' },
        claim: { raw_value: 'the Company Board has approved a Superior Proposal.', attributes: { trigger_code: 'SUPERIOR_PROPOSAL_TERMINATION' } },
      },
      {
        entry: { section_reference: '3.1(b)' },
        claim: { raw_value: 'a second, unrelated Superior Proposal ground exists here too.', attributes: { trigger_code: 'SUPERIOR_PROPOSAL_TERMINATION' } },
      },
    ]],
  ]);
  assert.equal(resolveCitationFollowupTriggerCode(['3.1(b)'], multipleCandidates), null);

  // Cited candidate itself still bare (chained) -- excluded from the
  // candidate pool entirely, so it resolves to zero candidates for that
  // reference, not one.
  const chained = new Map([
    ['3.1(b)', [{
      entry: { section_reference: '3.1(b)' },
      claim: { raw_value: 'by Parent pursuant to Section 3.1(c)', attributes: { trigger_code: null } },
    }]],
  ]);
  assert.equal(resolveCitationFollowupTriggerCode(['3.1(b)'], chained), null);
});

test('indexFeeTriggerCandidatesBySection (exported, direct): indexes only ok===true FEE_TRIGGER_CLAIM_KEY claim candidates, by section_reference', () => {
  const compiledCandidates = [
    {
      ok: true, section_reference: '3.1(a)', candidate: { kind: 'claim', claim: { claim_definition_key: FEE_TRIGGER_CLAIM_KEY, raw_value: 'x', attributes: {} } },
    },
    {
      ok: true, section_reference: '3.1(a)', candidate: { kind: 'claim', claim: { claim_definition_key: FEE_TRIGGER_CLAIM_KEY, raw_value: 'y', attributes: {} } },
    },
    { ok: false, section_reference: '3.1(a)' },
    {
      ok: true, section_reference: '3.1(b)', candidate: { kind: 'claim', claim: { claim_definition_key: FEE_AMOUNT_CLAIM_KEY, raw_value: 'z', attributes: {} } },
    },
    { ok: true, section_reference: '3.1(c)', candidate: { kind: 'relationship' } },
  ];
  const index = indexFeeTriggerCandidatesBySection(compiledCandidates);
  assert.deepEqual([...index.keys()], ['3.1(a)']);
  assert.equal(index.get('3.1(a)').length, 2);
  assert.equal(index.get('3.1(b)'), undefined);
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

// ---------------------------------------------------------------------------
// Duplicate-fact reconciliation (docs/codex-program/notes/claim-identity-
// reconciliation.md). Unit tests for the pure ranking/grouping helpers
// first (hermetic, hand-built minimal fixtures -- these functions only ever
// read a small, fixed subset of a resolved entry's own fields, listed in
// each helper's own comment in candidate-resolution.js), then integration
// tests for reconcileDuplicateTerminationFeeSightings itself against REAL
// resolvedEntry objects produced by this file's own harness (relabelled
// only on the few fields needed to force a synthetic group -- every
// identity value asserted below is the harness's own real, computed value,
// captured before reconciliation runs, never predicted or hand-typed).
// ---------------------------------------------------------------------------

test('sectionReferenceDepth: counts bracketed sub-clause groups, not string length', () => {
  assert.equal(sectionReferenceDepth('7.1'), 0);
  assert.equal(sectionReferenceDepth('7.3'), 0);
  assert.equal(sectionReferenceDepth('7.1(c)'), 1);
  assert.equal(sectionReferenceDepth('7.1(c)(i)'), 2);
  assert.equal(sectionReferenceDepth('7.3(b)(iii)'), 2);
  assert.equal(sectionReferenceDepth('9.9(z)'), 1, 'depth is purely syntactic -- it does not require a real ancestor relationship to any other reference');
  assert.equal(sectionReferenceDepth(null), 0);
  assert.equal(sectionReferenceDepth(undefined), 0);
  assert.equal(sectionReferenceDepth(''), 0);
});

test('isCitationFollowupSighting: true only for trigger_code_corroboration_scope === CITATION_FOLLOWUP, never confused with the unrelated fee_side_corroboration_scope marker', () => {
  assert.equal(isCitationFollowupSighting({ claim: { attributes: { trigger_code_corroboration_scope: 'CITATION_FOLLOWUP' } } }), true);
  assert.equal(isCitationFollowupSighting({ claim: { attributes: {} } }), false);
  assert.equal(isCitationFollowupSighting({ claim: { attributes: { fee_side_corroboration_scope: 'SECTION_FAMILY' } } }), false);
  assert.equal(isCitationFollowupSighting({ claim: { attributes: null } }), false);
  assert.equal(isCitationFollowupSighting({ claim: null }), false);
});

test('longestEvidenceSpan: the widest single edge, not the sum of edges; zero for no evidence', () => {
  assert.equal(longestEvidenceSpan({ evidence: [{ absolute_start: 100, absolute_end: 140 }, { absolute_start: 500, absolute_end: 520 }] }), 40);
  assert.equal(longestEvidenceSpan({ evidence: [{ absolute_start: 0, absolute_end: 5 }] }), 5);
  assert.equal(longestEvidenceSpan({ evidence: [] }), 0);
  assert.equal(longestEvidenceSpan({ evidence: undefined }), 0);
});

test('factKeyForResolvedEntry: groups TRIGGER/TAIL entries by (concept_key, party, claim definition, canonical_value); never groups TERMINATION_FEE_AMOUNT at all', () => {
  const trigger = (overrides) => ({
    resolved_claim_definition_key: 'TERMINATION_FEE_TRIGGER',
    concept_key: 'TERMF-TARGET',
    party: { value: 'the Company' },
    claim: { canonical_value: 'SUPERIOR_PROPOSAL_TERMINATION' },
    ...overrides,
  });
  const a = trigger({});
  const b = trigger({ party: { value: 'the Company' } });
  assert.equal(factKeyForResolvedEntry(a), factKeyForResolvedEntry(b), 'identical (concept, party, definition, value) must produce the identical key');

  const differentParty = trigger({ party: { value: 'Parent' } });
  assert.notEqual(factKeyForResolvedEntry(a), factKeyForResolvedEntry(differentParty));

  const differentValue = trigger({ claim: { canonical_value: 'CHANGE_IN_RECOMMENDATION_TERMINATION' } });
  assert.notEqual(factKeyForResolvedEntry(a), factKeyForResolvedEntry(differentValue));

  // The one legitimate non-duplicate the brief names explicitly: two
  // TERMINATION_FEE_AMOUNT claims sharing a dollar figure but differing on
  // concept_key must never share a key -- and, more fundamentally, amount
  // claims are never grouped by this function at all.
  const targetAmount = {
    resolved_claim_definition_key: 'TERMINATION_FEE_AMOUNT', concept_key: 'TERMF-TARGET',
    party: { value: 'the Company' }, claim: { canonical_value: '15000000.00' },
  };
  const reverseAmount = {
    resolved_claim_definition_key: 'TERMINATION_FEE_AMOUNT', concept_key: 'TERMF-REVERSE',
    party: { value: 'Parent' }, claim: { canonical_value: '15000000.00' },
  };
  assert.equal(factKeyForResolvedEntry(targetAmount), null);
  assert.equal(factKeyForResolvedEntry(reverseAmount), null);

  const tail = trigger({ resolved_claim_definition_key: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS', concept_key: 'TERMF-TAIL', claim: { canonical_value: '12' } });
  assert.notEqual(factKeyForResolvedEntry(tail), null);
});

test('compareFeeSightingRank: followup always loses to direct, regardless of depth or span', () => {
  const followup = { entry: { section_reference: '7.1(c)(i)(iv)', claim: { attributes: { trigger_code_corroboration_scope: 'CITATION_FOLLOWUP' }, evidence: [{ absolute_start: 0, absolute_end: 10000 }] } }, index: 0 };
  const direct = { entry: { section_reference: '7.1', claim: { attributes: {}, evidence: [{ absolute_start: 0, absolute_end: 1 }] } }, index: 1 };
  assert.ok(compareFeeSightingRank(direct, followup) < 0, 'direct, even shallower and shorter, must sort before followup');
  assert.ok(compareFeeSightingRank(followup, direct) > 0);
});

test('compareFeeSightingRank: among direct sightings, deeper section_reference wins', () => {
  const shallow = { entry: { section_reference: '7.1', claim: { attributes: {}, evidence: [{ absolute_start: 0, absolute_end: 5000 }] } }, index: 0 };
  const deep = { entry: { section_reference: '7.1(c)(i)', claim: { attributes: {}, evidence: [{ absolute_start: 0, absolute_end: 1 }] } }, index: 1 };
  assert.ok(compareFeeSightingRank(deep, shallow) < 0, 'deeper, even with far less evidence, wins the depth tiebreak');
});

test('compareFeeSightingRank: among equally-deep direct sightings, longer evidence span wins', () => {
  const shorter = { entry: { section_reference: '3.1(b)', claim: { attributes: {}, evidence: [{ absolute_start: 0, absolute_end: 40 }] } }, index: 0 };
  const longer = { entry: { section_reference: '3.1(c)', claim: { attributes: {}, evidence: [{ absolute_start: 0, absolute_end: 90 }] } }, index: 1 };
  assert.ok(compareFeeSightingRank(longer, shorter) < 0);
});

test('compareFeeSightingRank: a true tie on every criterion falls back to processing order (index), never Map/sort non-determinism', () => {
  const first = { entry: { section_reference: '3.1(b)', claim: { attributes: {}, evidence: [{ absolute_start: 0, absolute_end: 40 }] } }, index: 0 };
  const second = { entry: { section_reference: '3.1(c)', claim: { attributes: {}, evidence: [{ absolute_start: 0, absolute_end: 40 }] } }, index: 1 };
  assert.ok(compareFeeSightingRank(first, second) < 0);
  assert.ok(compareFeeSightingRank(second, first) > 0);
});

test('reconcileDuplicateTerminationFeeSightings: two independent real resolutions, relabelled into one fact, merge to one survivor with occurrence identity preserved and revision identity changed', async () => {
  // Two genuinely independent resolveCandidates runs -- different deals,
  // different documents, different real ids -- each producing exactly one
  // resolved TRIGGER claim on its own terms (neither has anything to merge
  // with in its own run). Relabelling copies of both onto the SAME
  // (concept_key, party, canonical_value) is what manufactures the group;
  // every identity value asserted below still comes from each entry's own,
  // real, already-computed fields, never predicted.
  const quoteA = `the Company shall pay Parent the Company Termination Fee if ${MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE}`;
  const runA = await resolveTerminationFeeAssertions('deal:reconcile-fixture-a', quoteA, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION', quote: quoteA })],
  });
  const quoteB = 'the Company Board has approved a Superior Proposal, and the Company shall pay (or cause to be paid) as directed by Parent the Company Termination Fee.';
  const runB = await resolveTerminationFeeAssertions('deal:reconcile-fixture-b', quoteB, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION', quote: quoteB })],
  });

  const entryA = runA.resolution.resolved.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  const entryBReal = runB.resolution.resolved.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(entryA && entryBReal, 'grounding: both fixture runs must independently resolve');

  // entryB is a shallow-cloned, relabelled COPY -- entryA and the real
  // runB.resolution.resolved array are never mutated by this test.
  const entryB = {
    ...entryBReal,
    section_reference: '7.1(c)(i)', // deeper than entryA's own SECTION_REFERENCE -- must win
    concept_key: entryA.concept_key,
    party: entryA.party,
    claim: { ...entryBReal.claim, canonical_value: entryA.claim.canonical_value },
  };
  assert.equal(factKeyForResolvedEntry(entryA), factKeyForResolvedEntry(entryB), 'grounding: relabelling must actually produce one shared fact key');

  const beforeWinnerOccurrenceId = entryB.claim.claim_occurrence_id;
  const beforeWinnerSubjectId = entryB.claim.subject_occurrence_id;
  const beforeWinnerEvidenceIds = entryB.claim.evidence_ids;
  const beforeWinnerRevisionId = entryB.claim.claim_revision_id;
  const beforeLoserOccurrenceId = entryA.claim.claim_occurrence_id;

  const resolved = [entryA, entryB];
  const reviewQueue = [];
  const residuals = [];
  reconcileDuplicateTerminationFeeSightings({ resolved, reviewQueue, residuals });

  assert.equal(resolved.length, 1, 'the group must collapse to exactly one entry');
  const [survivor] = resolved;
  assert.equal(survivor.section_reference, '7.1(c)(i)', 'the deeper section reference wins');

  // Occurrence identity: byte-identical to entryB's own, pre-reconciliation
  // value -- never re-derived, never guessed.
  assert.equal(survivor.claim.claim_occurrence_id, beforeWinnerOccurrenceId);
  assert.equal(survivor.claim.subject_occurrence_id, beforeWinnerSubjectId);
  assert.deepEqual(survivor.claim.evidence_ids, beforeWinnerEvidenceIds);
  // Revision identity: MUST change -- attributes grew duplicate_sightings_merged.
  assert.notEqual(survivor.claim.claim_revision_id, beforeWinnerRevisionId);

  assert.equal(survivor.claim.attributes.duplicate_sightings_merged.length, 1);
  assert.equal(survivor.claim.attributes.duplicate_sightings_merged[0].claim_occurrence_id, beforeLoserOccurrenceId);
  assert.equal(survivor.claim.attributes.duplicate_sightings_merged[0].section_reference, entryA.section_reference);

  assert.equal(residuals.length, 1);
  assert.equal(residuals[0].residual_type, 'DUPLICATE_FACT_SIGHTING_MERGED');
  assert.equal(residuals[0].merged_claim_occurrence_id, beforeLoserOccurrenceId);
  assert.equal(residuals[0].winning_claim_occurrence_id, beforeWinnerOccurrenceId);
});

test('reconcileDuplicateTerminationFeeSightings: also removes the merged claim\'s own reviewQueue mirror, and repoints the survivor\'s mirror at its new revision/closure id', async () => {
  const quoteA = `the Company shall pay Parent the Company Termination Fee if ${MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE}`;
  const runA = await resolveTerminationFeeAssertions('deal:reconcile-fixture-rq-a', quoteA, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION', quote: quoteA })],
  });
  const quoteB = 'the Company Board has approved a Superior Proposal, and the Company shall pay (or cause to be paid) as directed by Parent the Company Termination Fee.';
  const runB = await resolveTerminationFeeAssertions('deal:reconcile-fixture-rq-b', quoteB, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION', quote: quoteB })],
  });
  const entryA = runA.resolution.resolved.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  const entryBReal = runB.resolution.resolved.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  const entryB = {
    ...entryBReal,
    section_reference: '7.1(c)(i)',
    concept_key: entryA.concept_key,
    party: entryA.party,
    claim: { ...entryBReal.claim, canonical_value: entryA.claim.canonical_value },
  };

  // Real reviewQueue mirrors, mimicking finalizeResolvedCandidate's own
  // shape (matched by claim_revision_id, its documented cross-reference
  // field) -- one per fixture entry, plus an UNRELATED third entry that
  // must survive completely untouched.
  const unrelatedQueueItem = Object.freeze({ claim_revision_id: 'unrelated-revision-id', closure_id: 'unrelated-closure-id', section_reference: 'UNRELATED', reasons: [] });
  const reviewQueue = [
    { claim_revision_id: entryA.claim.claim_revision_id, closure_id: entryA.claim.closure_id, section_reference: entryA.section_reference, reasons: [] },
    { claim_revision_id: entryB.claim.claim_revision_id, closure_id: entryB.claim.closure_id, section_reference: entryB.section_reference, reasons: [] },
    unrelatedQueueItem,
  ];
  const resolved = [entryA, entryB];
  const residuals = [];
  reconcileDuplicateTerminationFeeSightings({ resolved, reviewQueue, residuals });

  assert.equal(reviewQueue.length, 2, 'the loser\'s own mirror is removed; the unrelated entry and the survivor\'s mirror remain');
  assert.ok(reviewQueue.includes(unrelatedQueueItem), 'an unrelated reviewQueue entry must be untouched, same object reference');
  const survivorMirror = reviewQueue.find((item) => item.section_reference === '7.1(c)(i)');
  assert.ok(survivorMirror);
  assert.equal(survivorMirror.claim_revision_id, resolved[0].claim.claim_revision_id, 'the mirror must be repointed at the NEW (post-merge) revision id');
  assert.equal(survivorMirror.closure_id, resolved[0].claim.closure_id);
  const loserMirror = reviewQueue.find((item) => item.claim_revision_id === entryA.claim.claim_revision_id);
  assert.equal(loserMirror, undefined, 'the merged-away claim\'s own OLD reviewQueue mirror must not survive under its old identity either');
});

test('reconcileDuplicateTerminationFeeSightings: entries that do NOT share a fact key are left completely untouched -- same array length, same object references, zero residuals', async () => {
  // The named legitimate non-duplicate: two TERMINATION_FEE_AMOUNT claims
  // valued identically but under different concept_key (TARGET vs REVERSE)
  // must never be treated as a group at all.
  const targetAmount = Object.freeze({
    resolved_claim_definition_key: 'TERMINATION_FEE_AMOUNT', concept_key: 'TERMF-TARGET',
    section_reference: '8.12', party: { value: 'the Company' },
    claim: Object.freeze({ canonical_value: '15000000.00', claim_occurrence_id: 'fixture-target-id' }),
  });
  const reverseAmount = Object.freeze({
    resolved_claim_definition_key: 'TERMINATION_FEE_AMOUNT', concept_key: 'TERMF-REVERSE',
    section_reference: '8.12', party: { value: 'Parent' },
    claim: Object.freeze({ canonical_value: '15000000.00', claim_occurrence_id: 'fixture-reverse-id' }),
  });
  const resolved = [targetAmount, reverseAmount];
  const reviewQueue = [];
  const residuals = [];
  reconcileDuplicateTerminationFeeSightings({ resolved, reviewQueue, residuals });

  assert.equal(resolved.length, 2);
  assert.equal(resolved[0], targetAmount, 'untouched entries keep their exact object reference, not merely equal fields');
  assert.equal(resolved[1], reverseAmount);
  assert.equal(residuals.length, 0, 'nothing to explain -- nothing was merged');
});

test('reconcileDuplicateTerminationFeeSightings: a three-way group collapses to one winner and exactly two DUPLICATE_FACT_SIGHTING_MERGED residuals', async () => {
  const quoteA = `the Company shall pay Parent the Company Termination Fee if ${MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE}`;
  const runA = await resolveTerminationFeeAssertions('deal:reconcile-fixture-3way-a', quoteA, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION', quote: quoteA })],
  });
  const quoteB = 'the Company Board has approved a Superior Proposal, and the Company shall pay (or cause to be paid) as directed by Parent the Company Termination Fee.';
  const runB = await resolveTerminationFeeAssertions('deal:reconcile-fixture-3way-b', quoteB, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'SUPERIOR_PROPOSAL_TERMINATION', quote: quoteB })],
  });
  const quoteC = 'the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote, and the Company shall pay (or cause to be paid) as directed by Parent the Company Termination Fee.';
  const runC = await resolveTerminationFeeAssertions('deal:reconcile-fixture-3way-c', quoteC, {
    fee_trigger_assertions: [feeTriggerAssertion({ feeSide: 'SELLER', triggerCode: 'CHANGE_IN_RECOMMENDATION_TERMINATION', quote: quoteC })],
  });

  const entryA = runA.resolution.resolved.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  const entryBReal = runB.resolution.resolved.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  const entryCReal = runC.resolution.resolved.find((r) => r.generic_claim_key === FEE_TRIGGER_CLAIM_KEY);
  assert.ok(entryA && entryBReal && entryCReal, 'grounding: all three fixture runs must independently resolve');

  const relabel = (entry, sectionReference) => ({
    ...entry,
    section_reference: sectionReference,
    concept_key: entryA.concept_key,
    party: entryA.party,
    claim: { ...entry.claim, canonical_value: entryA.claim.canonical_value },
  });
  const entryB = relabel(entryBReal, '7.1');
  const entryC = relabel(entryCReal, '7.1(c)(i)');

  const resolved = [entryA, entryB, entryC];
  const reviewQueue = [];
  const residuals = [];
  reconcileDuplicateTerminationFeeSightings({ resolved, reviewQueue, residuals });

  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].section_reference, '7.1(c)(i)', 'the deepest reference among the three wins');
  assert.equal(resolved[0].claim.attributes.duplicate_sightings_merged.length, 2);
  assert.equal(residuals.filter((r) => r.residual_type === 'DUPLICATE_FACT_SIGHTING_MERGED').length, 2);
});
