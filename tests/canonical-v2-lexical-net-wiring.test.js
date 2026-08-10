'use strict';

/**
 * tests/canonical-v2-lexical-net-wiring.test.js
 *
 * Acceptance tests for the lexical-disagreement net's WIRING into
 * candidate-resolution.js (docs/superpowers/specs/2026-08-02-lexical-
 * disagreement-net-design.md, "Wiring" + "Tests"):
 *
 * Numbered acceptance tests covered here: 4, 10, 11 (wiring half), 13, 15,
 * 16 (this file + npm test/build both green). 1, 2, 3, 5, 6, 7, 8, 9, 12
 * (module half), 14 live in tests/canonical-v2-lexical-disagreement-net.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { canonicalJson, sha256Hex, contentId } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract, compileFixtureContractV13 } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { parseJSON } = require('../lib/parser-v2/parse-json');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeProposals, QUALIFIER_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates, CandidateResolutionError } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const {
  buildLexicalDisagreementReceipt, LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA, computeCandidateDigest,
} = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');

// ─── Identity admitted-source chain (same pattern as
// tests/canonical-v2-v1v2-comparator-wiring.test.js). ───

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
  const zlib = require('node:zlib');
  const compressed = zlib.deflateRawSync(sourceMapBytes, { level: 9, windowBits: 15, memLevel: 8 });
  const sourceMapDigest = contentId('SEC_CANONICAL_TEXT_SOURCE_MAP/V2', compact);
  const sourceResponseContentId = sha256Hex(Buffer.concat([Buffer.from('RESPONSE/V1'), bytes]));
  const intakeCaptureReceiptId = sha256Hex(`INTAKE/V1:${sourceResponseContentId}`);
  const converterDigest = sha256Hex('IDENTITY_CONVERTER/V1');
  const converterConfigDigest = sha256Hex('IDENTITY_CONVERTER_CONFIG/V1');
  const verifierDigest = sha256Hex('IDENTITY_VERIFIER/V1');
  const verificationManifestId = sha256Hex(`VERIFICATION_MANIFEST/V1:${sourceResponseContentId}`);
  const canonicalTextId = contentId('SEC_CANONICAL_TEXT/V2', {
    source_response_content_id: sourceResponseContentId, converter_digest: converterDigest,
    converter_config_digest: converterConfigDigest, canonical_text_sha256: canonicalTextSha256,
    canonical_text_byte_length: byteLength, source_map_digest: sourceMapDigest,
  });
  const conversion = {
    schema_version: 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2', conversion_stage: 'CONVERSION_ONLY',
    verification_status: 'NOT_ATTEMPTED', source_admission_status: 'NOT_ATTEMPTED',
    source_response_content_id: sourceResponseContentId, intake_capture_receipt_id: intakeCaptureReceiptId,
    converter_digest: converterDigest, converter_config_digest: converterConfigDigest,
    canonical_text: text, canonical_text_sha256: canonicalTextSha256, canonical_text_byte_length: byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING, source_map_payload_base64: compressed.toString('base64'),
    source_map_compressed_sha256: sha256Hex(compressed), source_map_uncompressed_byte_length: sourceMapBytes.length,
    input_region_count: compact.input_regions.length, output_mapping_count: compact.output_mappings.length,
    source_map_digest: sourceMapDigest, canonical_text_id: canonicalTextId,
  };
  const immutableBody = {
    schema_version: 'IMMUTABLE_SOURCE_DOCUMENT/V2', source_kind: 'ORIGINAL_BYTES',
    authority_representation: 'ORIGINAL_HTTP_RESPONSE_BYTES', source_response_content_id: sourceResponseContentId,
    intake_capture_receipt_id: intakeCaptureReceiptId, response_content_type: 'text/html',
    response_bytes_sha256: sha256Hex(bytes), response_byte_length: byteLength, canonical_text_id: canonicalTextId,
    canonical_text_sha256: canonicalTextSha256, canonical_text_byte_length: byteLength,
    converter_digest: converterDigest, converter_config_digest: converterConfigDigest,
    source_map_encoding: SOURCE_MAP_ENCODING, source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length, input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length, source_map_digest: sourceMapDigest,
    verifier_digest: verifierDigest, verification_manifest_id: verificationManifestId,
  };
  const immutable = { ...immutableBody, immutable_source_document_id: contentId('IMMUTABLE_SOURCE_DOCUMENT/V2', immutableBody) };
  const coverageProofDigest = contentId('SOURCE_ADMISSION_COVERAGE_PROOF/V2', {
    canonical_text_id: canonicalTextId, canonical_text_byte_length: byteLength, source_map_digest: sourceMapDigest,
    admitted_intervals: [{ start: 0, end: byteLength }], excluded_intervals: [], discrepancy_count: 0,
  });
  const admissionBody = {
    schema_version: 'SOURCE_ADMISSION_MANIFEST/V2', admission_state: 'VERIFIED', source_kind: 'ORIGINAL_BYTES',
    immutable_source_document_id: immutable.immutable_source_document_id, source_response_content_id: sourceResponseContentId,
    canonical_text_id: canonicalTextId, verification_manifest_id: verificationManifestId,
    admitted_intervals: [{ start: 0, end: byteLength }], excluded_intervals: [], conversion_loss_residual_ids: [],
    discrepancy_count: 0, blocking_discrepancy_count: 0, coverage_proof_digest: coverageProofDigest,
  };
  const admission = { ...admissionBody, source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody) };
  const envelopeBody = {
    schema_version: 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1', input_status: 'READY_FOR_OFFLINE_PROPOSAL',
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN', immutable_source_document_id: immutable.immutable_source_document_id,
    source_admission_manifest_id: admission.source_admission_manifest_id, canonical_text_id: canonicalTextId,
    canonical_text_sha256: canonicalTextSha256, canonical_text_byte_length: byteLength,
    source_map_encoding: SOURCE_MAP_ENCODING, source_map_compressed_sha256: sha256Hex(compressed),
    source_map_uncompressed_byte_length: sourceMapBytes.length, input_region_count: compact.input_regions.length,
    output_mapping_count: compact.output_mappings.length, source_map_digest: sourceMapDigest,
    verification_manifest_id: verificationManifestId, admitted_intervals: [{ start: 0, end: byteLength }],
    excluded_intervals: [], semantic_extraction_status: 'NOT_ATTEMPTED',
  };
  const envelope = { ...envelopeBody, semantic_extraction_input_envelope_id: contentId('SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1', envelopeBody) };
  return buildAdmittedSemanticSourceContext({
    immutable_source_document: immutable, source_admission_manifest: admission,
    semantic_extraction_input_envelope: envelope, conversion, governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId, source_ordinal: sourceOrdinal,
  });
}

// ═══════════════════════════════════════════════════════════════════════
// PART 1: real-data acceptance -- F28 third-live-run REP-T-CAP section.
// ═══════════════════════════════════════════════════════════════════════

const DEFINITIONS = Object.freeze({ known_definitions: [] });
const AGREEMENT_DATE = '2026-04-18';
const CONTRACT_BUNDLE_V13 = compileFixtureContractV13();

function loadF28ThirdRunFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'f28-third-live-run', name), 'utf8'));
}

test('FIXTURE PIN (test 4, additivity): the no-lexical-input resolveCandidates() path reproduces the committed f28-third-live-run/resolution.json resolution_receipt_id byte-for-byte, and omits lexical_disagreement_counts entirely', () => {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const resolutionFixture = loadF28ThirdRunFixture('resolution.json');
  const admittedSourceContext = adapterResult.admitted_source_contexts[0];

  const baseline = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });

  assert.ok(!('lexical_disagreement_counts' in baseline.resolution_receipt), 'omitted entirely, not present-as-null, for a no-input run');
  assert.ok(!('v1v2_comparison_receipt_id' in baseline.resolution_receipt));
  // Re-pinned (phantom-citation re-derivation, docs/codex-program/notes/
  // phantom-citation-rederivation.md): tests/fixtures/canonical-v2/
  // f28-third-live-run/resolution.json was regenerated by replaying the SAME
  // recorded model response through the sectionizer fix in 63a1fe3a (the
  // 78-character title cap that swallowed TopBuild Sections 3.1/3.2 into a
  // phantom "III-INTRO(b)" chapeau child is gone; the real reference is
  // "3.1(b)", byte-identical span, byte-identical section_text_sha256).
  // Unlike the MAPPING_TABLE_VERSION-driven re-pins below, this one did NOT
  // move the version number (still 21) -- resolution_receipt is computed
  // over the run receipt's resolved_sections/compiled_candidates, which
  // embed the governed scope, which embeds section_reference and the
  // section-tree-derived section_id. The fixture was regenerated to be
  // CURRENT, not stale: a fresh baseline computed here now reproduces the
  // committed fixture's resolution_receipt_id byte-for-byte, so this
  // assertion flips from notEqual to equal.
  assert.equal(
    baseline.resolution_receipt.resolution_receipt_id,
    resolutionFixture.resolution_receipt.resolution_receipt_id,
    'the regenerated fixture is current, not stale -- a fresh baseline over its own run-receipt.json reproduces it byte-for-byte',
  );
  // Re-pinned (Step 2X-D / DECISIONS.md entry 14, 2026-08-08): 
  // QUALIFIER_KIND_LEXICON_VERSION 3 -> 4 (MAE aggregate phrase classifies
  // as MAT_MAE_QUALIFIED). Lexicon version folds into answer_provenance, so
  // claim_revision_ids and this receipt id move; fixture regenerated by
  // replaying the same run-receipt through resolveCandidates. Bucket counts
  // remain 3/6/31/1 while current evidence context and registry provenance
  // are retained in the fixture.
  assert.equal(resolutionFixture.resolution_receipt.resolution_receipt_id, '199d69445be17fbf43fe46229c6e753a3dc9c829cc8344b60e0338577fadb7f6');
  // MAPPING_TABLE_VERSION 4 -> 5 (family-termination-fee slice, three fee
  // entries -- docs/superpowers/specs/2026-08-02-family-termination-fee-
  // design.md section 4).
  assert.equal(baseline.resolution_receipt.mapping_table_version, 21);
  assert.equal(baseline.resolution_receipt.share_count_parse_version, 1);
  assert.equal(baseline.resolution_receipt.zero_pattern_table_version, 1);
  assert.equal(
    baseline.resolution_receipt.resolution_receipt_id,
    '199d69445be17fbf43fe46229c6e753a3dc9c829cc8344b60e0338577fadb7f6',
    // Re-pinned again (Stage 3, QUALIFIER_KIND_LEXICON_VERSION 2 -> 3): the
    // lexicon version is folded into every mechanically-resolved claim's
    // answer_provenance, so the version bump re-keys claim_revision_ids and
    // therefore this receipt id; the fixture was regenerated by replaying
    // the SAME recorded run through the current resolver -- counts and
    // every substantive row value are unchanged (verified field-by-field:
    // only ids, qualifier_kind_lexicon_version, and one order-only swap of
    // two identical-materiality review rows moved).
    // Re-pinned (phantom-citation re-derivation): section_reference moved
    // III-INTRO(b) -> 3.1(b) in the underlying fixture (same bytes, same
    // section_text_sha256); mapping_table_version is UNCHANGED at 21. This
    // value is now identical to the fixture's own committed
    // resolution_receipt_id (assert.equal above), not a separate baseline.
    // Re-pinned after Ben's 2026-08-03 ruling: bare no-shop "days"
    // now resolve as CALENDAR_DAYS, and no_shop_period_parse_version is 2.
    // Re-pinned (P2 qualifier kinds phase 1, Fable review 2026-08-03): delta =
    // qualifier_kind_lexicon_version 1->2, measurement_date_parse_version 1->2,
    // + four F28 replay conversions (2 resolved dates, 2 review performance rows).
    // schedule_reference_parse_version lands with phase-2 registry wiring.
    // [prior pin 2bbfd930… superseded.]
    // Re-pinned (family-termination-rights slice, build 2026-08-03):
    // MAPPING_TABLE_VERSION 7 -> 8 and receiptBody gains TWO new
    // unconditional fields (termination_deadline_parse_version,
    // cure_period_parse_version) -- the full field-level diff vs the prior
    // committed pin (eae76e562bd51f0242381a4a08be6426d435d074ffb8083bdb753a
    // 2abd6a4bab) was re-derived by running this exact test against the
    // current code: mapping_table_version 7->8,
    // termination_deadline_parse_version +1 (new, value 1),
    // cure_period_parse_version +1 (new, value 1), nothing else changed --
    // contract_vocabulary_digest is UNCHANGED at this call site
    // (CONTRACT_BUNDLE_V13 is a fixed pre-slice bundle snapshot this test
    // deliberately keeps stale; only MAPPING_TABLE_VERSION and the two new
    // receipt fields, resolver-module constants independent of which
    // contract_vocabulary is passed in, move). [family-mae-definition-era
    // pin eae76e56... superseded; family-no-shop-era pin 55b1e8da...
    // superseded before that.]
    // General Covenants parity adds mapping_table_version 15->16.
    'the re-pinned resolution_receipt_id under MAPPING_TABLE_VERSION 21, now current with the regenerated (3.1(b)) fixture',
  );

  // SOURCE_SCOPE_CERTIFICATION_ABSENT is unconditional -- present even with
  // no lexical_disagreement input at all (spec: "PERMANENT for this
  // slice ... regardless of whether either net's optional input is
  // supplied").
  for (const entry of baseline.resolved) {
    assert.ok(entry.triage.unevaluated_conditions.includes('SOURCE_SCOPE_CERTIFICATION_ABSENT'));
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'));
    assert.equal(entry.triage.auto_pass, false);
    assert.ok(!('both_nets_clean' in entry.triage), 'instrumentation marker absent entirely when never computed');
  }
});

function loadF28ThirdRunSection() {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const canonicalText = adapterResult.admitted_source_contexts[0].canonical_text.text;
  const section = runReceipt.resolved_sections[0];
  const bytes = Buffer.from(canonicalText, 'utf8');
  const sectionText = bytes.slice(section.start, section.end).toString('utf8');
  return { section_ref: section.section_reference, text: sectionText, text_sha256: section.text_sha256 };
}

test('ACCEPTANCE (real-data fixture): a bound, fresh lexical_disagreement receipt for III-INTRO(b) removes LEXICAL_DISAGREEMENT_NET_ABSENT, adds LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE (24 real unmatched REP-T-CAP hits), and disagreement excerpts travel on the matching review_queue item -- auto_pass stays false (SOURCE_SCOPE_CERTIFICATION_ABSENT is permanent)', () => {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const admittedSourceContext = adapterResult.admitted_source_contexts[0];

  const baseline = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });
  // Current ITEM evidence binding retains the three limb-grounded claims.
  assert.equal(baseline.resolved.length, 3);

  const section = loadF28ThirdRunSection();
  const candidates = baseline.resolved
    .filter((entry) => entry.concept_key === 'REP-T-CAP')
    .map((entry) => ({
      closure_id: entry.claim.closure_id, section_reference: entry.section_reference, family: entry.concept_key,
      evidence: entry.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })),
    }));
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates });
  const family = receipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  assert.equal(family.outcome, 'LEXICAL_UNMATCHED_SIGNALS');
  assert.equal(family.unmatched_count, 24, 'sanity: matches the hand-verified pure-module test');

  const wired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, lexical_disagreement: { [section.section_ref]: receipt },
  });

  assert.equal(wired.resolved.length, 3, 'strictly additive on bucket sizes');
  for (const entry of wired.resolved) {
    assert.ok(!entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'), 'ABSENT removed -- condition 2 DID evaluate');
    assert.ok(entry.triage.reasons.includes('LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE'));
    assert.equal(entry.triage.deterministic_gates_passed, false);
    assert.equal(entry.triage.auto_pass, false, 'still blocked -- SOURCE_SCOPE_CERTIFICATION_ABSENT is permanent');
    assert.ok(!('both_nets_clean' in entry.triage), 'lexical alone is not both nets');
  }
  assert.equal(wired.resolution_receipt.lexical_disagreement_counts.both_nets_clean, 0);
  assert.equal(wired.resolution_receipt.lexical_disagreement_counts.lexical_receipt_stale_sections, 0);
  assert.equal(wired.resolution_receipt.lexical_disagreement_counts.lexical_receipt_malformed_sections, 0);

  const wiredReviewItems = wired.review_queue.filter((item) => item.has_resolution === true && item.concept_key === 'REP-T-CAP');
  assert.equal(wiredReviewItems.length, 3);
  for (const item of wiredReviewItems) {
    assert.ok(item.reasons.includes('LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE'));
    assert.ok(Array.isArray(item.lexical_disagreement_excerpts), 'disagreement excerpts travel on the queue item');
    assert.equal(item.lexical_disagreement_excerpts.length, 24);
  }
});

test('TEST 11 (wiring half): CANDIDATE_SECTION_MISMATCH cannot be laundered through the wiring -- a receipt whose OWN section_ref differs from the map key it is stored under never binds', () => {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const admittedSourceContext = adapterResult.admitted_source_contexts[0];
  const section = loadF28ThirdRunSection();

  const baseline = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });
  const candidates = baseline.resolved
    .filter((entry) => entry.concept_key === 'REP-T-CAP')
    .map((entry) => ({
      closure_id: entry.claim.closure_id, section_reference: entry.section_reference, family: entry.concept_key,
      evidence: entry.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })),
    }));
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates });

  // Stored under a DIFFERENT map key than the receipt's own section_ref.
  const wired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, lexical_disagreement: { 'WRONG-SECTION-KEY': receipt },
  });
  for (const entry of wired.resolved) {
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'), 'no receipt under this claim\'s own section key -> ABSENT stays');
  }

  // Stored under the CORRECT map key, but with the receipt's own
  // section_ref field tampered to point elsewhere -- must still refuse.
  const tamperedReceipt = { ...receipt, section_ref: 'SOME-OTHER-SECTION' };
  const tamperedWired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, lexical_disagreement: { [section.section_ref]: tamperedReceipt },
  });
  for (const entry of tamperedWired.resolved) {
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'), 'tampered section_ref never binds, even under the right map key');
  }
});

test('TEST 13: wiring fail-closed on a malformed receipt and on a stale candidate_digest', () => {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const admittedSourceContext = adapterResult.admitted_source_contexts[0];
  const section = loadF28ThirdRunSection();

  const baseline = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });
  const candidates = baseline.resolved
    .filter((entry) => entry.concept_key === 'REP-T-CAP')
    .map((entry) => ({
      closure_id: entry.claim.closure_id, section_reference: entry.section_reference, family: entry.concept_key,
      evidence: entry.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })),
    }));
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates });

  // Malformed: wrong schema_version.
  const malformedWired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, lexical_disagreement: { [section.section_ref]: { ...receipt, schema_version: 'WRONG/V1' } },
  });
  for (const entry of malformedWired.resolved) {
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'));
  }
  assert.equal(malformedWired.resolution_receipt.lexical_disagreement_counts.lexical_receipt_malformed_sections, 1);
  assert.equal(malformedWired.resolution_receipt.lexical_disagreement_counts.both_nets_clean, 0);

  // Stale: candidate_digest does not match what the wiring itself
  // recomputes from this run's own resolved candidates.
  const staleWired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE,
    lexical_disagreement: { [section.section_ref]: { ...receipt, candidate_digest: computeCandidateDigest([{ closure_id: 'not-the-real-closure-id' }]) } },
  });
  for (const entry of staleWired.resolved) {
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'));
  }
  assert.equal(staleWired.resolution_receipt.lexical_disagreement_counts.lexical_receipt_stale_sections, 1);

  // Stale: text_sha256 does not match the run receipt's own section hash.
  const staleTextWired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, lexical_disagreement: { [section.section_ref]: { ...receipt, text_sha256: 'not-the-real-hash' } },
  });
  for (const entry of staleTextWired.resolved) {
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'));
  }
  assert.equal(staleTextWired.resolution_receipt.lexical_disagreement_counts.lexical_receipt_stale_sections, 1);
});

test('a malformed lexical_disagreement (not a plain object) fails loudly rather than silently no-op-ing', () => {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const admittedSourceContext = adapterResult.admitted_source_contexts[0];
  assert.throws(() => resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, lexical_disagreement: 'not-an-object',
  }), CandidateResolutionError);
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 12 (wiring half): LEXICAL_LEXICON_UNCOVERED_FAMILY -- the family is
// evaluated-but-unevaluable, stays in unevaluated_conditions (never reads
// as passed), via BOTH routes into LEXICON_FAMILY_UNCOVERED: (a) the
// receipt's own family_outcomes domain never had a REP-T-CAP row because
// the lexicon it was built under has no REP-T-CAP entries at all; (b) the
// receipt WAS built with a real REP-T-CAP row, but that row is missing
// from the receipt handed to the wiring -- `familyOutcomeFromReceipt`'s
// own uncovered-fallback is what catches it (spec audit C1: "a missing row
// can never read as clean").
// ═══════════════════════════════════════════════════════════════════════

test('TEST 12 (wiring half) (a): a receipt built under a lexicon with no REP-T-CAP entries binds fresh, but LEXICAL_LEXICON_UNCOVERED_FAMILY stays in unevaluated_conditions', () => {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const admittedSourceContext = adapterResult.admitted_source_contexts[0];
  const section = loadF28ThirdRunSection();

  const baseline = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });
  const candidates = baseline.resolved
    .filter((entry) => entry.concept_key === 'REP-T-CAP')
    .map((entry) => ({
      closure_id: entry.claim.closure_id, section_reference: entry.section_reference, family: entry.concept_key,
      evidence: entry.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })),
    }));

  // A lexicon with a real, differently-keyed entry (never REP-T-CAP) --
  // proves the domain computation itself, not just an empty-entries edge
  // case: the receipt's family_outcomes still enumerates REP-T-CAP (it is
  // in the sorted union via the CANDIDATES' own family), but with outcome
  // LEXICON_FAMILY_UNCOVERED because no lexicon entry ever covered it.
  const lexiconWithoutRepTCap = {
    schema_version: 'LEXICAL_FAMILY_LEXICON/V1',
    version: 1,
    entries: [{
      pattern_id: 'REP-T-NOCHANGE:PHRASE:MATERIAL_ADVERSE_EFFECT', family: 'REP-T-NOCHANGE', kind: 'LITERAL_PHRASE',
      value: 'material adverse effect', rationale: 'unrelated family, deliberately excludes REP-T-CAP for this test',
    }],
  };
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates, lexicon: lexiconWithoutRepTCap });
  const family = receipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  assert.ok(family, 'sanity: REP-T-CAP is still in the domain via the candidates side of the union');
  assert.equal(family.outcome, 'LEXICON_FAMILY_UNCOVERED');

  const wired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, lexical_disagreement: { [section.section_ref]: receipt },
  });
  for (const entry of wired.resolved) {
    assert.ok(!entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'), 'receipt DID bind -- ABSENT removed');
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_LEXICON_UNCOVERED_FAMILY'), 'evaluated-but-unevaluable stays blocking');
    assert.ok(!entry.triage.reasons.includes('LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE'), 'uncovered is not the same outcome as unmatched');
    assert.equal(entry.triage.auto_pass, false);
  }
});

test('TEST 12 (wiring half) (b): a bound, digest-fresh, structurally valid receipt whose REP-T-CAP row was deleted after the fact reads as uncovered via familyOutcomeFromReceipt\'s own fallback', () => {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const admittedSourceContext = adapterResult.admitted_source_contexts[0];
  const section = loadF28ThirdRunSection();

  const baseline = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });
  const candidates = baseline.resolved
    .filter((entry) => entry.concept_key === 'REP-T-CAP')
    .map((entry) => ({
      closure_id: entry.claim.closure_id, section_reference: entry.section_reference, family: entry.concept_key,
      evidence: entry.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })),
    }));

  // A NORMAL receipt, built with the real REP-T-CAP lexicon -- it DOES have
  // a REP-T-CAP row (LEXICAL_UNMATCHED_SIGNALS, per the real-data test
  // above). We then delete that row, keeping text_sha256/candidate_digest/
  // schema_version untouched -- structurally valid, still binds (the
  // wiring's own binding check never inspects family_outcomes content),
  // but the family is now missing from the domain entirely.
  const realReceipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates });
  assert.ok(realReceipt.family_outcomes.some((entry) => entry.family === 'REP-T-CAP'), 'sanity: the real receipt DOES have the row before deletion');
  const receiptWithDeletedRow = {
    ...realReceipt,
    family_outcomes: realReceipt.family_outcomes.filter((entry) => entry.family !== 'REP-T-CAP'),
  };
  assert.ok(!receiptWithDeletedRow.family_outcomes.some((entry) => entry.family === 'REP-T-CAP'), 'sanity: row genuinely absent now');

  const wired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, lexical_disagreement: { [section.section_ref]: receiptWithDeletedRow },
  });
  for (const entry of wired.resolved) {
    assert.ok(!entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'), 'receipt DID bind (text_sha256 + candidate_digest still match)');
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_LEXICON_UNCOVERED_FAMILY'), 'a missing row can never read as clean (audit C1)');
    assert.ok(!entry.triage.reasons.includes('LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE'));
    assert.equal(entry.triage.auto_pass, false);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PART 2: synthetic two-section scenario -- a CLEAN section (zero lexicon
// hits at all) and an UNMATCHED section, both governed by the same run,
// only one receipt supplied -- exercises test 10 (multi-section, only one
// section has a receipt) and test 15 (both_nets_clean, computed only when
// BOTH nets bind clean; SOURCE_SCOPE_CERTIFICATION_ABSENT still present).
// ═══════════════════════════════════════════════════════════════════════

const CONTRACT_BUNDLE = compileFixtureContract();
const CLEAN_ACCURACY_QUOTE = 'true and correct in all material respects';

const twoSectionFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  'Section 3.1 Representations Concerning the Company.\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized. ',
  'The Company represents that the foregoing is ', CLEAN_ACCURACY_QUOTE, '.\n\n',
  '(b)Capital Structure. (i)The authorized capital stock of the Company consists of common stock. ',
  'The Company represents that the foregoing is ', CLEAN_ACCURACY_QUOTE, '.\n',
].join('');
const TWO_SECTION_DOCUMENT_HASH = sha256Hex(Buffer.from(twoSectionFullText, 'utf8'));
const TWO_SECTION_ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(twoSectionFullText, {
  dealKey: 'deal:lexical-net-wiring-two-section', dealAdmissionId: sha256Hex('deal-admission:lexical-net-wiring-two-section'),
});

function twoSectionParsedResponse(sectionReference) {
  // Both sections' own QUALIFIER evidence is the SAME clean ACCURACY
  // phrase (no REP-T-CAP lexicon words at all) -- the DIFFERENCE between
  // the two sections is their surrounding governed text: section (a) has
  // no lexicon phrase anywhere in it (truly clean); section (b) has
  // "authorized capital stock" in its LIMB assertion quote, which never
  // resolves to a REP-T-CAP candidate (limb assertions are always open-
  // world -- candidate-resolution.js's own header), so that phrase is a
  // genuinely UNMATCHED hit against section (b)'s own REP-T-CAP qualifier
  // evidence.
  const limbQuote = sectionReference === '3.1(b)'
    ? '(i)The authorized capital stock of the Company consists of common stock'
    : 'The Company is a corporation duly organized';
  return {
    representation_instances: [{
      section_reference: sectionReference,
      party_making: 'the Company',
      chapeau_quote: sectionReference === '3.1(b)' ? 'Capital Structure.' : 'Organization; Standing.',
      limbs: [{ limb_path: ['(i)'], assertion_quote: limbQuote, subject: 'subject matter' }],
      qualifiers: [{
        kind: 'ACCURACY', code: 'MAT_ALL_RESPECTS', quote: CLEAN_ACCURACY_QUOTE,
        attachment: { position: 'CHAPEAU', governs_path: null, ambiguity_signals: { items_grammatically_parallel: null } },
      }],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

async function buildTwoSectionSyntheticResolution() {
  const receipt = await runNativeExtraction({
    source_text: twoSectionFullText, document_hash: TWO_SECTION_DOCUMENT_HASH, section_references: ['3.1(a)', '3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE, definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const parsed = twoSectionParsedResponse(governedScope.section_reference);
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(parsed, governedScope.source_text);
      return { provider_id: 'x', model_id: 'x', prompt: 'x', proposals, evidence_residuals: evidenceResiduals };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: TWO_SECTION_ADMITTED_SOURCE_CONTEXT,
  });
  return { receipt, resolution };
}

function sectionByRef(runReceipt, sectionReference) {
  const node = runReceipt.resolved_sections.find((section) => section.section_reference === sectionReference);
  const bytes = Buffer.from(twoSectionFullText, 'utf8');
  const text = bytes.slice(node.start, node.end).toString('utf8');
  return { section_ref: sectionReference, text, text_sha256: node.text_sha256 };
}

function candidatesForSection(resolution, sectionReference) {
  return resolution.resolved
    .filter((entry) => entry.section_reference === sectionReference && entry.concept_key === 'REP-T-CAP')
    .map((entry) => ({
      closure_id: entry.claim.closure_id, section_reference: entry.section_reference, family: entry.concept_key,
      evidence: entry.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })),
    }));
}

test('TEST 10: multi-section fixture -- only section (a) gets a receipt; section (b)\'s claim keeps LEXICAL_DISAGREEMENT_NET_ABSENT untouched', async () => {
  const { receipt, resolution } = await buildTwoSectionSyntheticResolution();
  const sectionA = sectionByRef(receipt, '3.1(a)');
  const receiptA = buildLexicalDisagreementReceipt({ governed_section: sectionA, candidates: candidatesForSection(resolution, '3.1(a)') });
  const familyA = receiptA.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  assert.equal(familyA.outcome, 'LEXICAL_ALL_SIGNALS_MATCHED', 'section (a) has zero REP-T-CAP lexicon hits at all -- vacuously clean');

  const wired = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: TWO_SECTION_ADMITTED_SOURCE_CONTEXT,
    lexical_disagreement: { '3.1(a)': receiptA },
  });

  const claimA = wired.resolved.find((entry) => entry.section_reference === '3.1(a)' && entry.concept_key === 'REP-T-CAP');
  const claimB = wired.resolved.find((entry) => entry.section_reference === '3.1(b)' && entry.concept_key === 'REP-T-CAP');
  assert.ok(claimA);
  assert.ok(claimB);
  assert.ok(!claimA.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'), 'section (a) DID get a bound, fresh receipt');
  assert.ok(claimB.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'), 'section (b) has no receipt in the map -- ABSENT stays');
});

test('TEST 15: both_nets_clean computes true only when BOTH nets bind clean; routing unchanged (still queues); SOURCE_SCOPE_CERTIFICATION_ABSENT present regardless', async () => {
  const { receipt, resolution } = await buildTwoSectionSyntheticResolution();
  const claimA = resolution.resolved.find((entry) => entry.section_reference === '3.1(a)' && entry.concept_key === 'REP-T-CAP');
  const provisionIdA = claimA.provision_instance.provision_instance_id;

  const sectionA = sectionByRef(receipt, '3.1(a)');
  const receiptA = buildLexicalDisagreementReceipt({ governed_section: sectionA, candidates: candidatesForSection(resolution, '3.1(a)') });

  // Condition 1: a genuine V1V2_VALUE_AGREEMENT for claimA's own concept +
  // claim definition (applyV1V2Wiring reads value_outcomes directly off
  // the supplied receipt -- see the next test's header comment for why
  // this is a faithful exercise without touching v1v2-comparator.js).
  const v1v2ComparisonBody = {
    schema_version: 'V1V2_COMPARISON_RECEIPT/V1',
    v1_snapshot_id: 'synthetic-snapshot-id',
    deal_identity_bridge: { production_deal_id: 'synthetic-deal', governed_deal_key: 'deal:synthetic' },
    family_mapping_table_version: 1,
    value_mapping_table_version: 1,
    attempted_section_scope: ['3.1(a)'],
    provision_outcomes: [{
      outcome: 'V1V2_PRESENCE_AGREEMENT', concept_key: 'REP-T-CAP', v1_card_id: 'card-x',
      v1_section: '3.1(a)', v2_provision_instance_id: provisionIdA, v2_section: '3.1(a)', reason: null,
    }],
    value_outcomes: [{
      outcome: 'V1V2_VALUE_AGREEMENT', concept_key: 'REP-T-CAP', claim_definition_key: claimA.resolved_claim_definition_key,
      v2_provision_instance_id: provisionIdA, v1_value: claimA.claim.canonical_value, v2_value: claimA.claim.canonical_value,
    }],
    quote_probe: [],
    counts: {},
  };
  const v1v2Comparison = { ...v1v2ComparisonBody, v1v2_comparison_receipt_id: contentId('V1V2_COMPARISON_RECEIPT/V1', v1v2ComparisonBody) };

  const wired = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: TWO_SECTION_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: v1v2Comparison, lexical_disagreement: { '3.1(a)': receiptA },
  });

  const wiredClaimA = wired.resolved.find((entry) => entry.section_reference === '3.1(a)' && entry.concept_key === 'REP-T-CAP');
  const wiredClaimB = wired.resolved.find((entry) => entry.section_reference === '3.1(b)' && entry.concept_key === 'REP-T-CAP');

  // Both nets bound clean for claim A -> both_nets_clean: true. Claim B
  // has NEITHER net wired (no v1v2 provision_outcome references it, no
  // lexical receipt for section (b)) -> marker absent entirely for it.
  assert.equal(wiredClaimA.triage.both_nets_clean, true);
  assert.ok(!('both_nets_clean' in wiredClaimB.triage));

  // ROUTING NEVER CHANGES: SOURCE_SCOPE_CERTIFICATION_ABSENT is permanent,
  // so auto_pass stays false for both claims regardless of both_nets_clean.
  assert.equal(wiredClaimA.triage.auto_pass, false, 'routing unchanged: SOURCE_SCOPE_CERTIFICATION_ABSENT is permanent');
  assert.equal(wiredClaimB.triage.auto_pass, false);
  assert.ok(wiredClaimA.triage.unevaluated_conditions.includes('SOURCE_SCOPE_CERTIFICATION_ABSENT'));
  assert.ok(wiredClaimB.triage.unevaluated_conditions.includes('SOURCE_SCOPE_CERTIFICATION_ABSENT'));

  // Every claim, bound-clean or not, still appears on the review queue --
  // "nothing skips the queue" (spec).
  const reviewQueueClaimRevisionIds = new Set(wired.review_queue.map((item) => item.claim_revision_id).filter(Boolean));
  assert.ok(reviewQueueClaimRevisionIds.has(wiredClaimA.claim.claim_revision_id));
  assert.ok(reviewQueueClaimRevisionIds.has(wiredClaimB.claim.claim_revision_id));
});

test('both_nets_clean IS true when condition 1 genuinely resolves V1V2_VALUE_AGREEMENT and condition 2 resolves LEXICAL_ALL_SIGNALS_MATCHED for the same claim; lexical-clean alone (no v1v2 input) never sets it', async () => {
  const { receipt, resolution } = await buildTwoSectionSyntheticResolution();
  const claimA = resolution.resolved.find((entry) => entry.section_reference === '3.1(a)' && entry.concept_key === 'REP-T-CAP');
  const provisionIdA = claimA.provision_instance.provision_instance_id;

  const sectionA = sectionByRef(receipt, '3.1(a)');
  const receiptA = buildLexicalDisagreementReceipt({ governed_section: sectionA, candidates: candidatesForSection(resolution, '3.1(a)') });
  assert.equal(receiptA.family_outcomes.find((entry) => entry.family === 'REP-T-CAP').outcome, 'LEXICAL_ALL_SIGNALS_MATCHED');

  // Lexical-clean alone, with NO v1v2 input at all: both_nets_clean must
  // never appear (condition 1 genuinely never evaluated).
  const wiredLexicalOnly = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: TWO_SECTION_ADMITTED_SOURCE_CONTEXT,
    lexical_disagreement: { '3.1(a)': receiptA },
  });
  const lexicalOnlyClaimA = wiredLexicalOnly.resolved.find((entry) => entry.section_reference === '3.1(a)' && entry.concept_key === 'REP-T-CAP');
  assert.ok(!('both_nets_clean' in lexicalOnlyClaimA.triage), 'lexical clean alone never sets both_nets_clean');
  assert.ok(lexicalOnlyClaimA.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_ABSENT'), 'condition 1 genuinely unevaluated here');

  // Now pair it with a v1v2 comparison receipt carrying a genuine Tier 2
  // V1V2_VALUE_AGREEMENT for this exact claim (hand-built the same way
  // tests/canonical-v2-v1v2-comparator-wiring.test.js's synthetic
  // `baseComparisonReceipt` fixtures are -- applyV1V2Wiring reads
  // `value_outcomes` directly off the supplied receipt; it never
  // re-derives them from v1v2-comparator.js's own VALUE_MAPPING_TABLE, so
  // this is a faithful exercise of the wiring's own logic without touching
  // that do-not-modify file).
  const v1v2ComparisonBody = {
    schema_version: 'V1V2_COMPARISON_RECEIPT/V1',
    v1_snapshot_id: 'synthetic-snapshot-id',
    deal_identity_bridge: { production_deal_id: 'synthetic-deal', governed_deal_key: 'deal:synthetic' },
    family_mapping_table_version: 1,
    value_mapping_table_version: 1,
    attempted_section_scope: ['3.1(a)'],
    provision_outcomes: [{
      outcome: 'V1V2_PRESENCE_AGREEMENT', concept_key: 'REP-T-CAP', v1_card_id: 'card-x',
      v1_section: '3.1(a)', v2_provision_instance_id: provisionIdA, v2_section: '3.1(a)', reason: null,
    }],
    value_outcomes: [{
      outcome: 'V1V2_VALUE_AGREEMENT', concept_key: 'REP-T-CAP', claim_definition_key: claimA.resolved_claim_definition_key,
      v2_provision_instance_id: provisionIdA, v1_value: claimA.claim.canonical_value, v2_value: claimA.claim.canonical_value,
    }],
    quote_probe: [],
    counts: {},
  };
  const v1v2Comparison = { ...v1v2ComparisonBody, v1v2_comparison_receipt_id: contentId('V1V2_COMPARISON_RECEIPT/V1', v1v2ComparisonBody) };

  const wired = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: TWO_SECTION_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: v1v2Comparison, lexical_disagreement: { '3.1(a)': receiptA },
  });
  const wiredClaimA = wired.resolved.find((entry) => entry.section_reference === '3.1(a)' && entry.concept_key === 'REP-T-CAP');
  assert.ok(!wiredClaimA.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_ABSENT'));
  assert.ok(!wiredClaimA.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM'));
  assert.ok(!wiredClaimA.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'));
  assert.ok(!wiredClaimA.triage.reasons.includes('V1V2_VALUE_MISMATCH'));
  assert.equal(wiredClaimA.triage.both_nets_clean, true, 'both conditions genuinely evaluated clean');
  assert.equal(wiredClaimA.triage.auto_pass, false, 'the marker never opens routing -- SOURCE_SCOPE_CERTIFICATION_ABSENT is still permanent');
  assert.ok(wiredClaimA.triage.unevaluated_conditions.includes('SOURCE_SCOPE_CERTIFICATION_ABSENT'));

  const wiredReviewItemA = wired.review_queue.find((item) => item.claim_revision_id === wiredClaimA.claim.claim_revision_id);
  assert.equal(wiredReviewItemA.both_nets_clean, true, 'both_nets_clean is synced onto the matching review_queue item too');
  assert.equal(wired.resolution_receipt.lexical_disagreement_counts.both_nets_clean, 1, 'the run-level count aggregates it');
});

test('STRICT ADDITIVITY: absent lexical_disagreement, resolveCandidates() output is byte-identical to a call that never mentions the parameter', async () => {
  const { receipt } = await buildTwoSectionSyntheticResolution();
  const withoutParam = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: TWO_SECTION_ADMITTED_SOURCE_CONTEXT,
  });
  const withExplicitNull = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: TWO_SECTION_ADMITTED_SOURCE_CONTEXT,
    lexical_disagreement: null,
  });
  assert.equal(canonicalJson(withoutParam), canonicalJson(withExplicitNull));
  assert.ok(!('lexical_disagreement_counts' in withoutParam.resolution_receipt));
});
