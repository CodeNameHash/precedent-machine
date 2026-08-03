'use strict';

/**
 * tests/canonical-v2-f28-second-live-fixture-replay.test.js
 *
 * Replays the RECORDED, UNMODIFIED raw model response from the F28 SECOND
 * live run (docs/handoffs/F28-SECOND-LIVE-RUN.md,
 * tests/fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json)
 * through the pipeline as it stands after this fix (citation corroboration +
 * never-silently-discard), and documents how the buckets change versus that
 * run doc's own headline numbers: 23/23 proposals rejected at the citation
 * gate, 0 compiled candidates, 0 publishable claims.
 *
 * Companion to tests/canonical-v2-f28-live-fixture-replay.test.js (which
 * replays the FIRST run's recording). This recording is PROMPT_VERSION 2
 * shaped (one representation_instance, `limb_path` arrays, representation-
 * level `qualifiers` with `attachment` objects) -- the real, unmodified
 * cause of the F28-SECOND-LIVE-RUN.md headline defect: every one of its 23
 * proposals carries `section_reference: "3.1(b)"`, a citation the
 * sectionizer's heading-only tree cannot construct on this real filing (no
 * "Section 3.1" heading anywhere -- bare lettered subsections directly under
 * ARTICLE III), which the OLD pipeline treated as grounds to silently
 * exclude every one of them before compilation.
 *
 * THE FIX, EXERCISED HERE AGAINST REAL RECORDED MODEL OUTPUT (not a
 * synthetic fixture): the governed section's own text -- tests/fixtures/
 * qxo-section-3-1-b.txt, limb (iii)'s real "as set forth in Sections
 * ‎3.1(b)(i) and ‎3.1(b)(ii)" cross-reference -- contains "3.1(b)" as a
 * literal substring in a genuine "Section(s) ..." context, so
 * citation-constructibility.js's corroboration check accepts EVERY one of
 * this run's "3.1(b)" citations as CORROBORATED_BY_DOCUMENT_TEXT. Every
 * citation-checked proposal compiles; nothing is silently dropped.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { contentId, sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { parseJSON } = require('../lib/parser-v2/parse-json');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeProposals, QUALIFIER_CLAIM_KEY, LIMB_ASSERTION_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');

// ─── Identity admitted-source chain (same pattern as
// tests/canonical-v2-f28-live-fixture-replay.test.js -- see that file for
// why a hand-built identity source map is required instead of running text
// through the real SEC-HTML converter). ───

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

// ─── Fixture: the real QXO Section 3.1(b) capital-structure text, WITHOUT a
// "Section 3.1" heading -- the actual F28 live-run document shape (see
// tests/canonical-v2-f28-live-fixture-replay.test.js for the same pattern).
// This fixture already carries the real, decoded U+200E LRM marks the second
// live run's own cross-reference prose depends on. ───

const capitalStructureText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'qxo-section-3-1-b.txt'),
  'utf8',
);

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
const CONTRACT_BUNDLE = compileFixtureContract();
const DEFINITIONS = Object.freeze({ known_definitions: [] });

const FIXTURE_PATH = path.join(
  __dirname, 'fixtures', 'canonical-v2', 'f28-second-live-run', 'qxo-topbuild-3-1-b-live-response.json',
);

function loadRecordedResponse() {
  const recorded = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const parsed = parseJSON(recorded.raw_response_text);
  assert.ok(parsed, 'the recorded raw_response_text must still parse as JSON (fence-stripped)');
  return parsed;
}

test('sanity: the recording is still the single-representation, 21-limb, 2-qualifier PROMPT_VERSION 2 response the second live run actually produced', () => {
  const recordedParsed = loadRecordedResponse();
  assert.equal(recordedParsed.representation_instances.length, 1);
  assert.equal(recordedParsed.representation_instances[0].limbs.length, 21);
  assert.equal(recordedParsed.representation_instances[0].qualifiers.length, 2);
  assert.equal(recordedParsed.representation_instances[0].section_reference, '3.1(b)');
});

test('replaying the F28 SECOND recorded raw response through the fixed pipeline: citation corroboration accepts every real citation and nothing is silently dropped', async () => {
  const recordedParsed = loadRecordedResponse();

  const receipt = await runNativeExtraction({
    source_text: degenerateFullText,
    document_hash: DOCUMENT_HASH,
    section_references: ['III-INTRO(b)'],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: DEFINITIONS,
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        recordedParsed,
        governedScope.source_text,
      );
      return {
        provider_id: 'f28-second-live-fixture-replay/v1',
        model_id: 'claude-sonnet-5 (recorded, F28 second live run)',
        prompt: 'f28-second-live-fixture-replay-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });

  // One of the 21 limb assertions fails BYTE-EXACT evidence verification: its
  // quote spans a page-break artifact (a stray "16" plus zero-width markers)
  // present in this hand-authored plain-text fixture but not quoted across by
  // the model at the time of the live run -- an artifact of replaying live
  // output against an approximated fixture, unrelated to citation validation
  // or either of this fix's two other defects. 22 of the 23 original
  // proposals (20 limbs + 2 qualifiers... actually 21-1=20 limbs + 2
  // qualifiers = 22) reach the citation check.
  assert.equal(receipt.evidence_residual_count, 1);
  assert.equal(receipt.evidence_residuals[0].reason, 'LIMB_ASSERTION_QUOTE_UNVERIFIED');
  assert.equal(receipt.scope_violation_count, 0);

  // THE HEADLINE FIX: every one of the 22 citation-checked proposals shares
  // section_reference "3.1(b)" -- CITATION_NOT_CONSTRUCTIBLE against this
  // document's real tree (governing node "III-INTRO(b)", no "3.1" heading
  // anywhere) -- but "3.1(b)" is a literal substring of the real "Sections
  // ‎3.1(b)(i) and ‎3.1(b)(ii)" cross-reference inside this same governed
  // text, in a genuine "Section(s) ..." context. Corroboration accepts every
  // one of them: zero citation_residuals, versus the original run's 23/23
  // CITATION_NOT_CONSTRUCTIBLE rejections.
  assert.equal(receipt.citation_residual_count, 0);
  assert.equal(receipt.citation_residuals.length, 0);

  // NEVER SILENTLY DISCARDED: all 22 compile. Versus the run doc's headline
  // "0 compiled candidates" this is the direct, measured reversal.
  assert.equal(receipt.compiled_candidate_count, 22);
  assert.equal(receipt.rejected_candidate_count, 0);
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok === true));
  assert.ok(receipt.compiled_candidates.every((entry) => entry.citation_validation
    && entry.citation_validation.accepted === true
    && entry.citation_validation.validation_source === 'CORROBORATED_BY_DOCUMENT_TEXT'),
  'every compiled candidate is accepted via corroboration -- the tree independently constructs none of them, matching the document\'s real drafting convention');

  const admittedSourceContext = buildIdentityAdmittedSourceContext(degenerateFullText, {
    dealKey: 'deal:f28-second-live-fixture-replay',
    dealAdmissionId: sha256Hex('deal-admission:f28-second-live-fixture-replay'),
    sourceOrdinal: 0,
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: admittedSourceContext,
  });

  // CHANGED HEADLINE (Task 3, docs/superpowers/plans/2026-08-01-claim-
  // identity-provenance-plan.md): LIMB_ASSERTION_CLAIM_KEY still has no
  // table entry at all -- unchanged, open world. QUALIFIER_CLAIM_KEY is now
  // rekeyed on the DETERMINISTIC (lexicon-derived) kind, not the model's
  // own `kind` field -- but this recording's own two qualifiers still route
  // to open_world, because the DETERMINISTIC classifier independently
  // agrees they are THRESHOLD (qualifier-kind-lexicon.js: "material to" /
  // monetary-threshold markers fire, no ACCURACY/TEMPORAL/KNOWLEDGE marker
  // present), and THRESHOLD still has NO table entry (spec section 3:
  // "THRESHOLD stays open world, feeding the commonality report"). The
  // bucket counts are therefore UNCHANGED from the pre-Task-3 numbers below
  // -- this recording simply does not contain any ACCURACY/TEMPORAL/
  // KNOWLEDGE qualifier to exercise the two NEW mappings against. See
  // tests/canonical-v2-candidate-resolution.test.js for those mappings
  // exercised against real fixture text, and the Task 3 deliverable report
  // for why the nonzero-publishable proof for THIS slice is therefore a
  // SYNTHETIC fixture, not this replay.
  //
  // UNDER-EXTRACTION BASELINE, NOT A TARGET (spec Testing section --
  // required label). This recording is itself missing ~10 of the ~12
  // qualifiers a careful read of the source flags (run-2's known
  // decomposition regression, docs/handoffs/F28-SECOND-LIVE-RUN.md
  // quality finding 2). The counts asserted below bake in that
  // impoverished extraction as a REGRESSION FLOOR for the pipeline code
  // only -- they say nothing about extraction quality, and a richer
  // future recording is expected to produce different (better) buckets.
  // The F28 THIRD live run (PROMPT_VERSION 4) already recovers 16
  // qualifiers on this same section.
  assert.equal(resolution.resolved.length, 0);
  assert.equal(resolution.review_queue.length, 0);
  assert.equal(resolution.open_world.length, 22);
  assert.equal(resolution.residuals.length, 0);
  assert.ok(resolution.open_world.every((entry) => entry.reason === 'UNMAPPED_GENERIC_CLAIM_KEY'));
  assert.ok(resolution.open_world.every((entry) => entry.citation_validation && entry.citation_validation.accepted === true));
  const openWorldGenericKeys = new Set(resolution.open_world.map((entry) => entry.claim_definition_key));
  assert.deepEqual([...openWorldGenericKeys].sort(), [LIMB_ASSERTION_CLAIM_KEY, QUALIFIER_CLAIM_KEY].sort());

  // NEW (Task 3 work item 6): a limb component tree is minted for the
  // governed representation even though every qualifier in it ends up
  // open-world -- LIMB_ASSERTION proposals "are still open-world as
  // claims, but the tree's path/assertion nodes are included in the
  // resolution result" (spec section 1). The tree reflects the recording's
  // real drafting shape: 5 top-level limbs (i)-(v), 3 of which ((i),(ii),
  // (iii)) carry lettered sub-limbs, and 20 of the 21 recorded assertions
  // survive byte-verification (see the evidence_residual_count assertion
  // above for the one page-break artifact that does not).
  assert.equal(resolution.limb_component_trees.length, 1);
  const tree = resolution.limb_component_trees[0];
  assert.equal(tree.assertion_nodes.length, 20);
  const pathLabels = tree.path_nodes.map((node) => JSON.stringify(node.limb_path)).sort();
  assert.deepEqual(pathLabels, [
    '["(i)"]', '["(i)","(A)"]', '["(i)","(B)"]',
    '["(ii)"]', '["(ii)","(A)"]', '["(ii)","(B)"]', '["(ii)","(C)"]',
    '["(iii)"]', '["(iii)","(A)"]', '["(iii)","(B)"]', '["(iii)","(C)"]',
    '["(iv)"]', '["(v)"]',
  ].sort());

  // NEW: the two REAL, RECORDED THRESHOLD qualifiers route open-world,
  // ITEM-attached to their own real limbs -- limb (ii)'s securities-Laws
  // carve-out and limb (iv)'s investment-materiality carve-out, exactly as
  // drafted (never silently reattached to a different limb, never
  // defaulted to the chapeau).
  const qualifierOpenWorld = resolution.open_world.filter((entry) => entry.claim_definition_key === QUALIFIER_CLAIM_KEY);
  assert.equal(qualifierOpenWorld.length, 2);
  const byGovernsPath = new Map(
    qualifierOpenWorld.map((entry) => [JSON.stringify(entry.attributes.attachment.governs_path), entry]),
  );
  assert.ok(byGovernsPath.has('["(ii)"]'), 'the securities-Laws carve-out attaches to limb (ii)');
  assert.ok(
    byGovernsPath.get('["(ii)"]').raw_value.includes('Securities Act'),
    'limb (ii)\'s own THRESHOLD qualifier text',
  );
  assert.ok(byGovernsPath.has('["(iv)"]'), 'the investment-materiality carve-out attaches to limb (iv)');
  assert.ok(
    byGovernsPath.get('["(iv)"]').raw_value.includes('material to the Company'),
    'limb (iv)\'s own THRESHOLD qualifier text',
  );

  // Receipt pins (Task 3 work item 1): every version that participated in
  // this resolution is traceable. MAPPING_TABLE_VERSION 3 -> 4 (P1
  // cap-table numerics, docs/superpowers/specs/2026-08-02-p1-captable-
  // numerics-design.md section 4).
  // MAPPING_TABLE_VERSION 4 -> 5 (family-termination-fee slice, three fee
  // entries -- docs/superpowers/specs/2026-08-02-family-termination-fee-
  // design.md section 4).
  assert.equal(resolution.resolution_receipt.mapping_table_version, 8);
  assert.ok(Number.isInteger(resolution.resolution_receipt.qualifier_kind_lexicon_version));
  assert.ok(Number.isInteger(resolution.resolution_receipt.measurement_date_parse_version));
  assert.ok(typeof resolution.resolution_receipt.ruling_corpus_id === 'string' && resolution.resolution_receipt.ruling_corpus_id.length > 0);

  // No registered claim definition exists yet for either generic key this
  // producer emits for a capitalisation representation's own limbs/
  // qualifiers (a separate, known, pre-existing gap in the contract
  // vocabulary -- not something citation validation or qualifier
  // decomposition changes), so publishable claims stay at 0, same as the
  // run doc -- but for a completely different reason: every candidate is
  // now visible and accounted for in open_world, not silently rejected
  // before it ever reached resolution.
  //
  // THIS RECORDING THEREFORE PROVES ZERO RESOLVABLE CLAIMS end to end (both
  // qualifiers are THRESHOLD -- see the headline comment above). Per the
  // Task 3 acceptance criteria, the nonzero-publishable proof for the new
  // mappings is a SEPARATE, SYNTHETIC fixture test in
  // tests/canonical-v2-candidate-resolution.test.js ("resolved output feeds
  // buildNativeWriteSet and passes the real validate-write-set.js" already
  // proves this for ACCURACY; the new Task 3 tests in that file prove it
  // again for TEMPORAL and KNOWLEDGE) -- NOT this replay.
  const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
  const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
  const resolvedRunReceipt = {
    ...receipt,
    compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: resolvedRunReceipt,
    source_text: degenerateFullText,
    document_hash: DOCUMENT_HASH,
    admitted_source_context: admittedSourceContext,
  });
  assert.equal(adapterResult.write_set.claims.length, 0);
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: { ...adapterResult.write_set, provisions: [] },
    contractBundle: CONTRACT_BUNDLE,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
  });
  assert.equal(validation.accepted, true);
  assert.equal(validation.publishableWriteSet.claims.length, 0);
});
