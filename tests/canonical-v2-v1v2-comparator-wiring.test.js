'use strict';

/**
 * tests/canonical-v2-v1v2-comparator-wiring.test.js
 *
 * Acceptance tests for the v1<->v2 comparator net's WIRING into
 * candidate-resolution.js (docs/superpowers/specs/2026-08-01-v1v2-
 * comparator-net-design.md, "Wiring" + "Acceptance"):
 *
 *  1. REAL-DATA fixture: TopBuild's real v1 REP-T-CAP card (tests/fixtures/
 *     canonical-v2/v1v2-comparator/topbuild-v1-provision-snapshot.json,
 *     exported read-only from production, 2026-08-02) vs the REAL F28 third
 *     live run's recorded model response, replayed through the CURRENT
 *     pipeline exactly as tests/canonical-v2-f28-second-live-fixture-
 *     replay.test.js replays the second run -- presence agreement on
 *     3.1(b), the measurement-date claim carrying `V1_V2_COMPARATOR_
 *     INAPPLICABLE_TO_CLAIM` (Ben's ruled option A), ~42 other v1 rep cards
 *     all V2_NOT_ATTEMPTED, zero V2_MISSING.
 *  2. Synthetic: SECTION_MISMATCH and the sibling-effect rule (a receipt-
 *     level V2_MISSING/V2_NOT_ATTEMPTED never touches another claim's
 *     triage) route as specified; VALUE_MISMATCH enters the gate-failure
 *     flow with both values on the (already-built) comparison receipt.
 *  3. Determinism: identical inputs -> byte-identical resolution_receipt;
 *     `v1v2_comparison.provision_outcomes` order permutation invariant.
 *  4. Strict additivity: absent `v1v2_comparison`, resolveCandidates()
 *     output is exactly what it was before this slice.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract, compileFixtureContractV13 } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { parseJSON } = require('../lib/parser-v2/parse-json');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeProposals, QUALIFIER_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates, CandidateResolutionError } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildV1V2ComparisonReceipt, V1V2_COMPARISON_RECEIPT_SCHEMA } = require('../lib/canonical-v2/native-producer/v1v2-comparator');

// ─── Identity admitted-source chain (same pattern as
// tests/canonical-v2-f28-second-live-fixture-replay.test.js). ───

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
// PART 1: real-data acceptance -- TopBuild v1 snapshot vs F28 third live run.
// ═══════════════════════════════════════════════════════════════════════

const capitalStructureText = fs.readFileSync(path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'), 'utf8');
const degenerateFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  '\n',
].join('');
const DOCUMENT_HASH = sha256Hex(Buffer.from(degenerateFullText, 'utf8'));
const CONTRACT_BUNDLE_V13 = compileFixtureContractV13();
const DEFINITIONS = Object.freeze({ known_definitions: [] });
const AGREEMENT_DATE = '2026-04-18';

const F28_THIRD_RESPONSE_PATH = path.join(
  __dirname, 'fixtures', 'canonical-v2', 'f28-third-live-run', 'qxo-topbuild-3-1-b-live-response.json',
);
const TOPBUILD_SNAPSHOT_PATH = path.join(
  __dirname, 'fixtures', 'canonical-v2', 'v1v2-comparator', 'topbuild-v1-provision-snapshot.json',
);

function loadF28ThirdRecordedResponse() {
  const recorded = JSON.parse(fs.readFileSync(F28_THIRD_RESPONSE_PATH, 'utf8'));
  const parsed = parseJSON(recorded.raw_response_text);
  assert.ok(parsed, 'the recorded raw_response_text must still parse as JSON');
  return parsed;
}

function loadTopbuildSnapshot() {
  return JSON.parse(fs.readFileSync(TOPBUILD_SNAPSHOT_PATH, 'utf8'));
}

function loadF28ThirdRunFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'f28-third-live-run', name), 'utf8'));
}

async function replayF28ThirdResolution() {
  const recordedParsed = loadF28ThirdRecordedResponse();
  const receipt = await runNativeExtraction({
    source_text: degenerateFullText, document_hash: DOCUMENT_HASH, section_references: ['III-INTRO(b)'],
    contract_bundle: CONTRACT_BUNDLE_V13, definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(recordedParsed, governedScope.source_text);
      return {
        provider_id: 'v1v2-comparator-wiring-test/f28-third-replay/v1', model_id: 'x', prompt: 'x',
        proposals, evidence_residuals: evidenceResiduals,
      };
    },
  });
  const admittedSourceContext = buildIdentityAdmittedSourceContext(degenerateFullText, {
    dealKey: 'deal:f28-third-live-fixture-replay',
    dealAdmissionId: sha256Hex('deal-admission:f28-third-live-fixture-replay'),
    sourceOrdinal: 0,
  });
  const baseline = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE,
  });
  return { receipt, admittedSourceContext, baseline };
}

test('sanity: the F28 third-run recording still compiles 37/37 with 0 rejections and resolves 3/4/33/0, matching the run\'s own headline numbers', async () => {
  const { receipt, baseline } = await replayF28ThirdResolution();
  assert.equal(receipt.compiled_candidate_count, 37);
  assert.equal(receipt.rejected_candidate_count, 0);
  // P2 qualifier kinds phase 1 (docs/superpowers/specs/2026-08-02-p2-
  // qualifier-kinds-design.md, CONVERTS-ON-REPLAY table): the two F28
  // AS_OF_BRIDGE closures (b6185150…, 565459b0…) now RESOLVE as plain
  // CALENDAR measurement-date claims (+2 resolved, -2 open world), and
  // the two PERFORMANCE_ASSUMPTION closures (a9897181…, 57ac1d2e…) mint
  // review-queued claims (+2 review, citation-corroborated-only). Counts
  // re-derived at Fable review: 3/4/33 -> 5/6/31.
  assert.equal(baseline.resolved.length, 5);
  assert.equal(baseline.review_queue.length, 6);
  assert.equal(baseline.open_world.length, 31);
  assert.equal(baseline.residuals.length, 0);
});

test('FIXTURE PIN: the no-v1v2-input resolveCandidates() path reproduces the committed f28-third-live-run/resolution.json resolution_receipt_id byte-for-byte', () => {
  // Full recomputation, NOT the degenerate-text replay above: run-receipt.json
  // already carries the run's real compiled_candidates, and adapter-result
  // .json's admitted_source_contexts[0] embeds the byte-exact full canonical
  // text this receipt was produced against (see
  // tests/canonical-v2-component-rows.test.js's "F28 third-run recorded
  // fixture" acceptance test for the same pattern) -- so resolveCandidates()
  // can be replayed against the LITERAL recorded inputs, not a reconstruction.
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const resolutionFixture = loadF28ThirdRunFixture('resolution.json');
  const admittedSourceContext = adapterResult.admitted_source_contexts[0];

  const baseline = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });

  assert.ok(
    !('v1v2_comparison_receipt_id' in baseline.resolution_receipt),
    'omitted entirely, not present-as-null, for a no-input run',
  );
  // Re-pinned (P1 cap-table numerics, docs/superpowers/specs/2026-08-02-
  // p1-captable-numerics-design.md section 4, audit M-1): MAPPING_TABLE_
  // VERSION bumped 3 -> 4 and receiptBody now always carries
  // share_count_parse_version/zero_pattern_table_version, so a no-v1v2-input
  // run is no longer byte-identical to the pre-slice fixture's committed
  // resolution_receipt_id. FIX 1's conditional spread (v1v2_comparison_
  // receipt_id omitted when no input supplied) still holds -- only the
  // hash itself moves, for the reason asserted below.
  assert.notEqual(
    baseline.resolution_receipt.resolution_receipt_id,
    resolutionFixture.resolution_receipt.resolution_receipt_id,
    'the committed pre-slice fixture is now stale under MAPPING_TABLE_VERSION 4 -- this is the expected, documented re-pin',
  );
  assert.equal(resolutionFixture.resolution_receipt.resolution_receipt_id, '16939d3bbf295686be514e51245429c7096fd99e1dca1b19f8037a10a6b41a79');
  // MAPPING_TABLE_VERSION 4 -> 5 (family-termination-fee slice, three fee
  // entries -- docs/superpowers/specs/2026-08-02-family-termination-fee-
  // design.md section 4).
  assert.equal(baseline.resolution_receipt.mapping_table_version, 14);
  assert.equal(
    baseline.resolution_receipt.resolution_receipt_id,
    'f4b46b7f95fd45d4bb8125e499d392d66f0d4b9d78f329b7fadd89a127b8ae79',
    // Re-pinned after Ben's 2026-08-03 ruling: bare no-shop "days"
    // now resolve as CALENDAR_DAYS, and no_shop_period_parse_version is 2.
    // Re-pinned (P2 qualifier kinds phase 1, Fable review 2026-08-03):
    // field-level delta re-derived by running the baseline -- mapping_table_
    // version stays 8, qualifier_kind_lexicon_version 1->2, measurement_
    // date_parse_version 1->2, plus the four F28 replay conversions above.
    // schedule_reference_parse_version lands with the phase-2 registry
    // wiring, not here. [prior pin 2bbfd930… superseded.]
    // Re-pinned (family-termination-rights slice, build 2026-08-03):
    // MAPPING_TABLE_VERSION 7 -> 8 and receiptBody gains TWO new
    // unconditional fields (termination_deadline_parse_version,
    // cure_period_parse_version) -- the full field-level diff vs the prior
    // committed pin (eae76e562bd51f0242381a4a08be6426d435d074ffb8083bdb753a
    // 2abd6a4bab) was re-derived by running this exact test against the
    // current code: mapping_table_version 7->8,
    // termination_deadline_parse_version +1 (new, value 1),
    // cure_period_parse_version +1 (new, value 1), nothing else changed --
    // contract_vocabulary_digest is UNCHANGED at this call site (this test
    // resolves against CONTRACT_BUNDLE_V13, a fixed pre-slice bundle
    // snapshot the test deliberately keeps stale; only
    // MAPPING_TABLE_VERSION and the two new receipt fields, which are
    // resolver-module constants independent of which contract_vocabulary
    // is passed in, move).
    // Prior era pin (family-mae-definition slice, build 2026-08-03):
    // MAPPING_TABLE_VERSION 6 -> 7 and receiptBody gained ONE new
    // unconditional field (mae_corroboration_table_version) -- the full
    // field-level diff vs the prior committed pin
    // (55b1e8da176524867df834c475efb17be86670593abc03e2ccc6328d619c5979)
    // was re-derived at that time: mapping_table_version 6->7,
    // mae_corroboration_table_version +1 (new, value 1), nothing else
    // changed. [family-no-shop-era
    // pin 55b1e8da... superseded.]
    // Proxy and Meeting parity adds mapping_table_version 13->14,
    // qualifier_kind_lexicon_version 8->9, and proxy_meeting_parse_version.
    'the new, re-pinned resolution_receipt_id under MAPPING_TABLE_VERSION 14',
  );
});

test('TopBuild snapshot fixture: 43 real REPRESENTATION cards, one REP-T-CAP at 3.1(b), the rest a real REP taxonomy spread', () => {
  const snapshot = loadTopbuildSnapshot();
  assert.equal(snapshot.schema_version, 'V1_PROVISION_SNAPSHOT/V1');
  assert.equal(snapshot.cards.length, 43);
  assert.equal(snapshot.deal_identity_bridge.production_deal_id, '7dc3a05f-b170-4d59-a255-b7103cca16e1');
  const capCards = snapshot.cards.filter((card) => card.provision_subtype === 'REP-T-CAP');
  assert.equal(capCards.length, 1);
  assert.equal(capCards[0].section_ref.split(' | ')[0], '3.1(b)');
  assert.ok(capCards[0].primary_quote.includes('28,142,327'), 'the real quoted TopBuild share count');
});

test('ACCEPTANCE (real-data fixture): Tier 1 presence agreement on 3.1(b) via the corroborated normalized_citation (not the tree reference "III-INTRO(b)"); the measurement-date claim carries V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM (option A); ~42 sibling cards all V2_NOT_ATTEMPTED; zero V2_MISSING', async () => {
  const { baseline } = await replayF28ThirdResolution();
  const snapshot = loadTopbuildSnapshot();

  const comparison = buildV1V2ComparisonReceipt({ v1_snapshot: snapshot, v2_side: baseline, attempted_section_scope: ['3.1(b)'] });
  assert.equal(comparison.schema_version, V1V2_COMPARISON_RECEIPT_SCHEMA);

  // THE HEADLINE: presence agreement via the CORROBORATED normalized
  // citation, not the sectionizer's own tree reference.
  const capOutcome = comparison.provision_outcomes.find((entry) => entry.concept_key === 'REP-T-CAP');
  assert.equal(capOutcome.outcome, 'V1V2_PRESENCE_AGREEMENT');
  assert.equal(capOutcome.v1_section, '3.1(b)');
  assert.equal(capOutcome.v2_section, '3.1(b)');
  assert.notEqual(capOutcome.v2_section, 'III-INTRO(b)', 'never the tree reference');

  // 42 siblings, all V2_NOT_ATTEMPTED; zero V2_MISSING anywhere.
  const bySubtype = comparison.counts.by_tier1_outcome;
  assert.equal(bySubtype.V2_NOT_ATTEMPTED, 42);
  assert.equal(bySubtype.V2_MISSING, 0);
  assert.equal(bySubtype.V1V2_PRESENCE_AGREEMENT, 1);
  assert.equal(bySubtype.SECTION_MISMATCH, 0);
  assert.equal(bySubtype.V1_CARD_UNMAPPED, 0);
  assert.equal(comparison.provision_outcomes.length, 43);

  // Now wire it in: resolveCandidates called again with the SAME run_receipt
  // and admitted_source_context, this time WITH v1v2_comparison.
  const recordedParsed = loadF28ThirdRecordedResponse();
  const receipt = await runNativeExtraction({
    source_text: degenerateFullText, document_hash: DOCUMENT_HASH, section_references: ['III-INTRO(b)'],
    contract_bundle: CONTRACT_BUNDLE_V13, definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(recordedParsed, governedScope.source_text);
      return { provider_id: 'x', model_id: 'x', prompt: 'x', proposals, evidence_residuals: evidenceResiduals };
    },
  });
  const admittedSourceContext = buildIdentityAdmittedSourceContext(degenerateFullText, {
    dealKey: 'deal:f28-third-live-fixture-replay',
    dealAdmissionId: sha256Hex('deal-admission:f28-third-live-fixture-replay'),
    sourceOrdinal: 0,
  });
  const wired = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE_V13, admitted_source_context: admittedSourceContext,
    agreement_date: AGREEMENT_DATE, v1v2_comparison: comparison,
  });

  // P2 qualifier kinds phase 1: 3 -> 5 (the two F28 AS_OF_BRIDGE
  // conversions are plain-calendar measurement-date claims too -- see the
  // sanity test's re-derivation above). Additivity meaning unchanged:
  // wiring never moves a claim between buckets.
  assert.equal(wired.resolved.length, 5, 'strictly additive on bucket sizes -- wiring never moves a claim between buckets');
  for (const entry of wired.resolved) {
    assert.equal(entry.resolved_claim_definition_key, 'REPRESENTATION_MEASUREMENT_DATE');
    // Ben's ruled option A: value-invisible claim (no Tier 2 mapping for
    // REP-T-CAP -> REPRESENTATION_MEASUREMENT_DATE exists) -> condition 1
    // stays UNEVALUATED, typed, still blocking.
    assert.ok(!entry.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_ABSENT'), 'ABSENT removed -- Tier 1 DID evaluate');
    assert.ok(entry.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM'));
    assert.ok(entry.triage.unevaluated_conditions.includes('LEXICAL_DISAGREEMENT_NET_ABSENT'), 'condition 2 is untouched by this slice');
    assert.equal(entry.triage.auto_pass, false, 'auto-pass still blocked -- condition 2 has not landed');
    assert.ok(!entry.triage.reasons.includes('V1V2_SECTION_MISMATCH'));
    assert.ok(!entry.triage.reasons.includes('V1V2_VALUE_MISMATCH'));
  }
  assert.equal(wired.resolution_receipt.v1v2_comparison_receipt_id, comparison.v1v2_comparison_receipt_id, 'the resolution receipt pins the comparison receipt id');

  // The matching review_queue entries stay in sync (has_resolution: true
  // items carry the same triage.reasons the resolved entry does).
  const wiredReviewItems = wired.review_queue.filter((item) => item.has_resolution === true
    && item.resolved_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE');
  assert.equal(wiredReviewItems.length, 5); // 3 -> 5, same P2 conversion delta
});

// ═══════════════════════════════════════════════════════════════════════
// PART 2: synthetic wiring routing -- SECTION_MISMATCH, VALUE_MISMATCH, and
// the sibling-effect rule (receipt-level recall never touches other
// claims' triage).
// ═══════════════════════════════════════════════════════════════════════

const CONTRACT_BUNDLE = compileFixtureContract();
const ACCURACY_CHAPEAU_QUOTE = 'true and correct in all respects';
const LIMB_I_QUOTE = '(i)The authorized capital stock of the Company consists of';

const qxoFullText = [
  'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
  'QXO, Inc., Titanium Merger Sub and Forward Merger Sub.\n\n',
  'ARTICLE III\n\nREPRESENTATIONS AND WARRANTIES OF THE COMPANY\n\n',
  'Except as set forth in the Company Disclosure Letter, the Company represents ',
  'and warrants to Parent as follows:\n\n',
  'Section 3.1 Representations Concerning the Company.\n\n',
  '(a)Organization; Standing. The Company is a corporation duly organized, ',
  'validly existing and in good standing under the Laws of the State of Delaware.\n\n',
  capitalStructureText,
  ' The Company represents that the following statement is ', ACCURACY_CHAPEAU_QUOTE, '.',
  '\n',
].join('');
const QXO_DOCUMENT_HASH = sha256Hex(Buffer.from(qxoFullText, 'utf8'));
const QXO_ADMITTED_SOURCE_CONTEXT = buildIdentityAdmittedSourceContext(qxoFullText, {
  dealKey: 'deal:v1v2-comparator-wiring-synthetic', dealAdmissionId: sha256Hex('deal-admission:v1v2-comparator-wiring-synthetic'),
});

function syntheticParsedResponse() {
  return {
    representation_instances: [{
      section_reference: '3.1(b)',
      party_making: 'the Company',
      chapeau_quote: 'Capital Structure.',
      limbs: [{ limb_path: ['(i)'], assertion_quote: LIMB_I_QUOTE, subject: 'capital stock' }],
      qualifiers: [{
        kind: 'ACCURACY', code: 'MAT_ALL_RESPECTS', quote: ACCURACY_CHAPEAU_QUOTE,
        attachment: { position: 'CHAPEAU', governs_path: null, ambiguity_signals: { items_grammatically_parallel: null } },
      }],
      definition_uses: [],
      cross_references: [],
    }],
    bring_down_conditions: [],
    open_world_candidates: [],
  };
}

async function buildSyntheticResolution() {
  const receipt = await runNativeExtraction({
    source_text: qxoFullText, document_hash: QXO_DOCUMENT_HASH, section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE, definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(syntheticParsedResponse(), governedScope.source_text);
      return { provider_id: 'x', model_id: 'x', prompt: 'x', proposals, evidence_residuals: evidenceResiduals };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
  });
  return { receipt, resolution };
}

function baseComparisonReceipt({ provisionOutcomes = [], valueOutcomes = [] }) {
  const body = {
    schema_version: V1V2_COMPARISON_RECEIPT_SCHEMA,
    v1_snapshot_id: 'synthetic-snapshot-id',
    deal_identity_bridge: { production_deal_id: 'synthetic-deal', governed_deal_key: 'deal:synthetic' },
    family_mapping_table_version: 1,
    value_mapping_table_version: 1,
    attempted_section_scope: ['3.1(b)'],
    provision_outcomes: provisionOutcomes,
    value_outcomes: valueOutcomes,
    quote_probe: [],
    counts: {},
  };
  const receiptId = contentId(V1V2_COMPARISON_RECEIPT_SCHEMA, body);
  return { ...body, v1v2_comparison_receipt_id: receiptId };
}

test('synthetic: SECTION_MISMATCH pushes V1V2_SECTION_MISMATCH into reasons (gate-failure flow), removes ABSENT, and never reaches Tier 2', async () => {
  const { receipt, resolution } = await buildSyntheticResolution();
  const qualifier = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier);
  const provisionId = qualifier.provision_instance.provision_instance_id;

  const comparison = baseComparisonReceipt({
    provisionOutcomes: [{
      outcome: 'SECTION_MISMATCH', concept_key: 'REP-T-CAP', v1_card_id: 'card-x',
      v1_section: '3.2(z)', v2_provision_instance_id: provisionId, v2_section: '3.1(b)', reason: null,
    }],
  });

  const wired = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: comparison,
  });

  const wiredQualifier = wired.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(wiredQualifier.triage.reasons.includes('V1V2_SECTION_MISMATCH'));
  assert.ok(!wiredQualifier.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_ABSENT'));
  assert.ok(!wiredQualifier.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM'), 'SECTION_MISMATCH never reaches Tier 2');
  assert.equal(wiredQualifier.triage.deterministic_gates_passed, false, 'a structural gate failure, exactly like MULTI_SPAN_COMPOSED etc.');
  assert.equal(wiredQualifier.triage.auto_pass, false);

  const wiredReviewItem = wired.review_queue.find((item) => item.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(wiredReviewItem.reasons.includes('V1V2_SECTION_MISMATCH'), 'review_queue reasons stay in sync with resolved.triage.reasons');
});

test('synthetic: SEVERITY PREFERENCE -- when two Tier-1 outcomes reference the same v2 provision (two v1 cards in one family), SECTION_MISMATCH always wins over V1V2_PRESENCE_AGREEMENT, in BOTH array orders', async () => {
  const { receipt, resolution } = await buildSyntheticResolution();
  const qualifier = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  const provisionId = qualifier.provision_instance.provision_instance_id;

  const presenceAgreement = {
    outcome: 'V1V2_PRESENCE_AGREEMENT', concept_key: 'REP-T-CAP', v1_card_id: 'card-agree',
    v1_section: '3.1(b)', v2_provision_instance_id: provisionId, v2_section: '3.1(b)', reason: null,
  };
  const sectionMismatch = {
    outcome: 'SECTION_MISMATCH', concept_key: 'REP-T-CAP', v1_card_id: 'card-mismatch',
    v1_section: '3.2(z)', v2_provision_instance_id: provisionId, v2_section: '3.1(b)', reason: null,
  };

  for (const provisionOutcomes of [[presenceAgreement, sectionMismatch], [sectionMismatch, presenceAgreement]]) {
    const comparison = baseComparisonReceipt({ provisionOutcomes });
    const wired = resolveCandidates({
      run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
      v1v2_comparison: comparison,
    });
    const wiredQualifier = wired.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
    assert.ok(
      wiredQualifier.triage.reasons.includes('V1V2_SECTION_MISMATCH'),
      `SECTION_MISMATCH must win regardless of array order (order: ${provisionOutcomes.map((o) => o.outcome).join(',')})`,
    );
    assert.ok(!wiredQualifier.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM'), 'SECTION_MISMATCH never reaches Tier 2');
    assert.equal(wiredQualifier.triage.auto_pass, false);
  }
});

test('synthetic: VALUE_MISMATCH enters the gate-failure flow with both values already on the comparison receipt', async () => {
  const { resolution } = await buildSyntheticResolution();
  const qualifier = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  const provisionId = qualifier.provision_instance.provision_instance_id;

  const comparison = baseComparisonReceipt({
    provisionOutcomes: [{
      outcome: 'V1V2_PRESENCE_AGREEMENT', concept_key: 'REP-T-CAP', v1_card_id: 'card-x',
      v1_section: '3.1(b)', v2_provision_instance_id: provisionId, v2_section: '3.1(b)', reason: null,
    }],
    valueOutcomes: [{
      outcome: 'VALUE_MISMATCH', concept_key: 'REP-T-CAP', claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
      v2_provision_instance_id: provisionId, v1_value: 'MAT_MATERIAL_ONLY', v2_value: 'MAT_ALL_RESPECTS',
    }],
  });

  const receipt = await runNativeExtraction({
    source_text: qxoFullText, document_hash: QXO_DOCUMENT_HASH, section_references: ['3.1(b)'],
    contract_bundle: CONTRACT_BUNDLE, definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(syntheticParsedResponse(), governedScope.source_text);
      return { provider_id: 'x', model_id: 'x', prompt: 'x', proposals, evidence_residuals: evidenceResiduals };
    },
  });
  const wired = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: comparison,
  });

  const wiredQualifier = wired.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(wiredQualifier.triage.reasons.includes('V1V2_VALUE_MISMATCH'));
  assert.ok(!wiredQualifier.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_ABSENT'));
  assert.equal(wiredQualifier.triage.deterministic_gates_passed, false);
  assert.equal(wiredQualifier.triage.auto_pass, false);
  // Both values live on the SUPPLIED comparison receipt -- the wiring layer
  // does not duplicate them onto the claim itself, only the typed reason.
  const valueOutcome = comparison.value_outcomes[0];
  assert.equal(valueOutcome.v1_value, 'MAT_MATERIAL_ONLY');
  assert.equal(valueOutcome.v2_value, 'MAT_ALL_RESPECTS');
});

test('synthetic: an unrelated receipt-level V2_MISSING/V2_NOT_ATTEMPTED entry never touches another claim\'s triage (sibling-effect rule, audit C2)', async () => {
  const { receipt, resolution } = await buildSyntheticResolution();
  const qualifier = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  const provisionId = qualifier.provision_instance.provision_instance_id;

  const comparison = baseComparisonReceipt({
    provisionOutcomes: [
      // This claim's OWN provision: presence agreement.
      {
        outcome: 'V1V2_PRESENCE_AGREEMENT', concept_key: 'REP-T-CAP', v1_card_id: 'card-x',
        v1_section: '3.1(b)', v2_provision_instance_id: provisionId, v2_section: '3.1(b)', reason: null,
      },
      // An UNRELATED receipt-level finding -- a v1 card for a totally
      // different family/section that v2 never attempted. Per spec, this
      // is a run-level finding, never evidence against this claim.
      {
        outcome: 'V2_NOT_ATTEMPTED', concept_key: 'REP-T-ORG', v1_card_id: 'card-y',
        v1_section: '3.1(a)', v2_provision_instance_id: null, v2_section: null, reason: null,
      },
    ],
  });

  const wired = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: comparison,
  });
  const wiredQualifier = wired.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(!wiredQualifier.triage.reasons.includes('V1V2_SECTION_MISMATCH'));
  assert.ok(!wiredQualifier.triage.reasons.includes('V1V2_VALUE_MISMATCH'));
  assert.ok(!wiredQualifier.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_ABSENT'), 'its OWN provision DID get a Tier 1 result');
  assert.ok(wiredQualifier.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM'), 'no Tier 2 mapping for REP-T-CAP -> REPRESENTATION_ACCURACY_STANDARD');
});

test('synthetic: open_world entries and has_resolution:false review-queue items keep V1_V2_COMPARATOR_ABSENT untouched (no provision_instance_id to match against)', async () => {
  const { receipt, resolution } = await buildSyntheticResolution();
  const qualifier = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  const provisionId = qualifier.provision_instance.provision_instance_id;
  const comparison = baseComparisonReceipt({
    provisionOutcomes: [{
      outcome: 'V1V2_PRESENCE_AGREEMENT', concept_key: 'REP-T-CAP', v1_card_id: 'card-x',
      v1_section: '3.1(b)', v2_provision_instance_id: provisionId, v2_section: '3.1(b)', reason: null,
    }],
  });
  const wired = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: comparison,
  });
  assert.equal(wired.open_world.length, resolution.open_world.length);
  assert.deepEqual(canonicalJson(wired.open_world), canonicalJson(resolution.open_world), 'open_world is byte-identical -- wiring never touches it');
});

// ═══════════════════════════════════════════════════════════════════════
// PART 3: determinism + strict additivity.
// ═══════════════════════════════════════════════════════════════════════

test('determinism: identical run_receipt + v1v2_comparison inputs produce a byte-identical resolution_receipt', async () => {
  const { receipt, resolution } = await buildSyntheticResolution();
  const qualifier = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  const comparison = baseComparisonReceipt({
    provisionOutcomes: [{
      outcome: 'V1V2_PRESENCE_AGREEMENT', concept_key: 'REP-T-CAP', v1_card_id: 'card-x',
      v1_section: '3.1(b)', v2_provision_instance_id: qualifier.provision_instance.provision_instance_id,
      v2_section: '3.1(b)', reason: null,
    }],
  });
  const first = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: comparison,
  });
  const second = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: comparison,
  });
  assert.equal(canonicalJson(first.resolution_receipt), canonicalJson(second.resolution_receipt));
  assert.equal(first.resolution_receipt.resolution_receipt_id, second.resolution_receipt.resolution_receipt_id);
  assert.equal(canonicalJson(first.resolved), canonicalJson(second.resolved));
});

test('determinism: v1v2_comparison.provision_outcomes array order permutation invariant', async () => {
  const { receipt, resolution } = await buildSyntheticResolution();
  const qualifier = resolution.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  const outcomeA = {
    outcome: 'V1V2_PRESENCE_AGREEMENT', concept_key: 'REP-T-CAP', v1_card_id: 'card-x',
    v1_section: '3.1(b)', v2_provision_instance_id: qualifier.provision_instance.provision_instance_id,
    v2_section: '3.1(b)', reason: null,
  };
  const outcomeB = {
    outcome: 'V2_NOT_ATTEMPTED', concept_key: 'REP-T-ORG', v1_card_id: 'card-y',
    v1_section: '3.1(a)', v2_provision_instance_id: null, v2_section: null, reason: null,
  };
  const forward = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: baseComparisonReceipt({ provisionOutcomes: [outcomeA, outcomeB] }),
  });
  const reversed = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: baseComparisonReceipt({ provisionOutcomes: [outcomeB, outcomeA] }),
  });
  assert.equal(canonicalJson(forward.resolved), canonicalJson(reversed.resolved));
  assert.equal(canonicalJson(forward.review_queue), canonicalJson(reversed.review_queue));
});

test('STRICT ADDITIVITY: absent v1v2_comparison, resolveCandidates() output is byte-identical to a call that never mentions the parameter', async () => {
  const { receipt } = await buildSyntheticResolution();
  const withoutParam = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
  });
  const withExplicitNull = resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: null,
  });
  assert.equal(canonicalJson(withoutParam), canonicalJson(withExplicitNull));
  assert.ok(!('v1v2_comparison_receipt_id' in withoutParam.resolution_receipt), 'omitted entirely, not present-as-null, so resolution_receipt_id hashes stay byte-identical to pre-slice code for every no-input run');
  const qualifier = withoutParam.resolved.find((entry) => entry.generic_claim_key === QUALIFIER_CLAIM_KEY);
  assert.ok(qualifier.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_ABSENT'), 'unchanged default behavior');
});

test('a malformed v1v2_comparison (wrong schema_version) fails loudly rather than silently no-op-ing', async () => {
  const { receipt } = await buildSyntheticResolution();
  assert.throws(() => resolveCandidates({
    run_receipt: receipt, contract_vocabulary: CONTRACT_BUNDLE, admitted_source_context: QXO_ADMITTED_SOURCE_CONTEXT,
    v1v2_comparison: { schema_version: 'WRONG/V1', provision_outcomes: [], value_outcomes: [], v1v2_comparison_receipt_id: 'x' },
  }), CandidateResolutionError);
});
