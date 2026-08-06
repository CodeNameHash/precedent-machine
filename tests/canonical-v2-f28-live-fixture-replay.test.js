'use strict';

/**
 * tests/canonical-v2-f28-live-fixture-replay.test.js
 *
 * Replays the RECORDED, UNMODIFIED raw model response from the F28 first
 * live run (docs/archive/handoffs/F28-FIRST-LIVE-RUN.md,
 * tests/fixtures/canonical-v2/f28-live-run/qxo-topbuild-3-1-b-live-response.json)
 * through the pipeline as it stands AFTER the defect 1/2/3/4 fixes, and
 * documents how the buckets change versus the run doc's own numbers
 * (15 review_queue / 18 open_world / 15 quarantined / 0 publishable).
 *
 * IMPORTANT HONESTY NOTE. The recorded response was produced under
 * PROMPT_VERSION 1 -- the OLD schema (`limb_reference`, qualifiers NESTED
 * inside each limb, a flat string `attachment`). It is replayed VERBATIM,
 * byte-for-byte, with no reshaping or "upgrading" to the new schema: that
 * is the whole point of a replay-of-a-recording. Two consequences follow
 * directly from that, not from any bug in this test:
 *
 *  1. All 15 of its qualifiers live at `limbs[].qualifiers` (the OLD
 *     location). PROMPT_VERSION 2's shaping code reads qualifiers from
 *     `representation_instances[].qualifiers` (the NEW, representation-
 *     level location -- see anthropic-provider.js's file header and
 *     capitalisation-producer-prompt.js's RESPONSE_SHAPE). Under the new
 *     schema that top-level field is simply absent from this recording, so
 *     none of the 15 qualifiers are seen at all -- not "rejected as
 *     malformed" (that path is for a `qualifiers` array that IS present at
 *     the new location but carries the old flat-string `attachment`; see
 *     canonical-v2-native-provider.test.js's dedicated
 *     QUALIFIER_ATTACHMENT_MALFORMED test for that case on a conforming,
 *     new-location response). This is defect 2's fix interacting with
 *     stale input in a way this run doc could not have anticipated (the
 *     response-shape restructuring is itself part of the defect 1/2 fix);
 *     it is NOT a demonstration of defect 2's actual effect on live
 *     extraction quality, which only shows up on a FRESH model call made
 *     under the new PROMPT_VERSION 2 contract.
 *  2. Defect 1 (structural fragmentation into 12 representation_instances,
 *     each reusing bare limb labels) is a MODEL BEHAVIOUR fix, not a
 *     data-repair fix: replaying the same already-fragmented recording
 *     cannot un-fragment it. The 12 instances stay 12 instances here. Only
 *     a fresh call under PROMPT_VERSION 2's new instructions can produce
 *     the single-instance shape the fix is meant to produce.
 *
 * What THIS replay DOES exercise directly, unaffected by the schema
 * mismatch above:
 *  - Defect 3 (citation constructibility, plus corroboration -- docs/
 *    handoffs/F28-SECOND-LIVE-RUN.md): every one of the 12 instances'
 *    `section_reference` ("3.1(b)(i)", "3.1(b)(ii)", ...) is checked
 *    against the real document's sectionizer tree, which -- exactly as the
 *    live run's own Step 5 finding 3 describes -- has no "Section 3.1"
 *    numbering anywhere (the governed node's own discovered reference is
 *    "III-INTRO(b)"), so the tree alone constructs NONE of them. But this
 *    fixture's governed text (capitalStructureText, limb (iii)) ITSELF
 *    contains the real, printed cross-reference "as set forth in Sections
 *    ‎3.1(b)(i) and ‎3.1(b)(ii)" (with a genuine U+200E LRM before each
 *    number) -- so citation-constructibility.js's corroboration check (see
 *    that module's header) ACCEPTS the "3.1(b)(i)" and "3.1(b)(ii)"
 *    citations as `CORROBORATED_BY_DOCUMENT_TEXT`, even though the tree
 *    cannot construct them either. "3.1(b)(iii)", "3.1(b)(iv)" and
 *    "3.1(b)(v)" are corroborated by nothing in this fixture's text, so they
 *    stay unaccepted. One of the 18 limb assertions the run doc counted
 *    separately fails BYTE-EXACT evidence verification first (see the
 *    "entity-decoding note" below), so only 17 of the 18 reach the citation
 *    check at all. NEVER SILENTLY DISCARDED (docs/archive/handoffs/
 *    F28-SECOND-LIVE-RUN.md): every one of those 17, accepted or not,
 *    still COMPILES -- an unaccepted citation is recorded as a typed
 *    `citation_residuals` entry (9 of the 17: the three uncorroborated
 *    citations, several of them repeated across the run's fragmented
 *    representation_instances) and as a `citation_validation` object on the
 *    compiled candidate, never excluded from `compiled_candidates` the way
 *    an earlier version of this pipeline did.
 *  - Defect 4 (kind-aware mapping table): moot on THIS replay, because
 *    every qualifier that would have exercised it is already invisible per
 *    (1) above -- see canonical-v2-candidate-resolution.test.js's
 *    dedicated TEMPORAL-qualifier test for defect 4 exercised on a
 *    conforming, PROMPT_VERSION-2-shaped response instead.
 *
 * ENTITY-DECODING NOTE (do not confuse this with defect 3 above). The run
 * doc's own Step 5 finding 3 (`"Hallucinated section numbering"`) is WRONG
 * on ITS OWN TERMS, for a reason that has nothing to do with citation
 * constructibility: `sec-html-canonical-text.js`'s HTML-entity decoding was
 * incomplete (`&lrm;`, the LEFT-TO-RIGHT MARK entity SEC filings use before
 * cross-reference numbers, was not in `NAMED_ENTITIES` and so survived into
 * canonical text as the literal 5-character string "&lrm;"), which is why
 * the recorded model response's own quotes read "Section &lrm;3.1(b)(i)"
 * verbatim -- the model was quoting real document bytes correctly; the
 * CONVERTER, not the model, produced the corrupted "Section 3." string that
 * the run doc searched for and found zero occurrences of. That converter
 * defect is now fixed (`lib/canonical-v2/sec-html-canonical-text.js` and its
 * independent verifier both decode `&lrm;`/`&rlm;`/`&zwj;`/`&zwnj;` and
 * their numeric equivalents to nothing, and whitespace-width entities to a
 * real space -- see `tests/canonical-v2-sec-html-canonical-text.test.js`'s
 * "decodes zero-width/bidi entities..." test for the proof, and this
 * commit's docs for a real-filing before/after). Re-fetching and
 * re-converting the actual QXO/TopBuild filing with the fix confirms
 * "Section 3.1" now appears as contiguous canonical text 29 times (was 0),
 * with zero residual literal entity artifacts.
 *
 * THAT FIX DOES NOT CHANGE THIS TEST'S CITATION_NOT_CONSTRUCTIBLE
 * ASSERTIONS, and they were never "wrong" in the way defect 3's fix
 * description above might suggest at a skim: constructibility depends on
 * whether the SECTIONIZER discovers a "3.1" *heading* node, which depends on
 * `lib/parser-v2/structural.js`'s heading detection, not on entity decoding.
 * Independently re-running the fixed sectionizer against the real,
 * fully-decoded QXO/TopBuild filing confirms the document has no numbered
 * "Section 3.1" HEADING anywhere -- every one of the 29 "Section 3.1"
 * occurrences is a mid-sentence cross-reference inside a representation's
 * body text (e.g. "...set forth in Section 3.1(d)(ii)..."), never a heading
 * line, exactly matching this filing's real drafting convention (bare
 * lettered sub-items directly under each ARTICLE, no decimal section
 * numbers -- see F28-FIRST-LIVE-RUN.md's "Structural degeneracy" note,
 * which was correct and remains correct after the entity fix). So
 * CITATION_NOT_CONSTRUCTIBLE is the true, correct verdict for these
 * citations on THIS filing, for a reason unrelated to the entity bug, and
 * this test's fixture (a hand-authored, already-decoded plain-text excerpt
 * routed through an identity admission chain, never through the real HTML
 * converter -- see `buildIdentityAdmittedSourceContext` below) was never
 * exercising the entity-decoding path in the first place, so there is
 * nothing here for that fix to change.
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
const { shapeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');

// ─── Identity admitted-source chain (same pattern as
// tests/canonical-v2-candidate-resolution.test.js / tests/canonical-v2-
// native-write-set-adapter.test.js -- see those files for why a hand-built
// identity source map is required instead of running text through the real
// SEC-HTML converter). ───

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

// ─── Fixture: the real QXO Section 3.1(b) capital-structure text, embedded
// WITHOUT a "Section 3.1" heading -- the actual F28 live-run document shape
// (no decimal section numbering anywhere; see docs/archive/handoffs/
// F28-FIRST-LIVE-RUN.md's "Structural degeneracy" note), unlike
// tests/canonical-v2-candidate-resolution.test.js's synthetic wrapper, which
// DOES include a real "Section 3.1" heading and so is not representative of
// this specific defect. ───

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
  __dirname, 'fixtures', 'canonical-v2', 'f28-live-run', 'qxo-topbuild-3-1-b-live-response.json',
);

function loadRecordedResponse() {
  const recorded = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const parsed = parseJSON(recorded.raw_response_text);
  assert.ok(parsed, 'the recorded raw_response_text must still parse as JSON (fence-stripped)');
  return parsed;
}

test('sanity: this document has no "Section 3." numbering anywhere, exactly like the live run', () => {
  assert.equal(degenerateFullText.includes('Section 3.'), false);
});

test('replaying the F28 recorded raw response through the fixed pipeline: defect 3 corroborates the citations the document text supports and never silently drops the rest, defect 2 refuses to guess at the stale attachment shape', async () => {
  const recordedParsed = loadRecordedResponse();
  assert.equal(recordedParsed.representation_instances.length, 12, 'sanity: the recording is still the 12-fragment response the live run actually produced');

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
        provider_id: 'f28-live-fixture-replay/v1',
        model_id: 'claude-sonnet-5 (recorded, F28 live run)',
        prompt: 'f28-live-fixture-replay-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });

  // Defect 2, exercised against stale (PROMPT_VERSION 1) input: none of the
  // recording's 15 qualifiers are even seen, because they live at the OLD
  // per-limb location and the new shaping code reads the new
  // representation-level location instead (see the file header). Zero
  // qualifier proposals, zero qualifier-shaped residuals -- the 15 simply
  // never enter the pipeline under the new contract.
  assert.equal(receipt.evidence_residuals.filter((r) => r.reason.startsWith('QUALIFIER_')).length, 0);

  // One of the 18 limb assertions the run doc counted fails byte-exact
  // evidence verification first: its assertion_quote reads "Section
  // &lrm;3.1(b)(ii) of the Company Disclosure Letter..." -- the model
  // quoting the OLD, entity-decoding-bugged canonical text verbatim (see the
  // ENTITY-DECODING NOTE in the file header) -- against THIS fixture's
  // hand-authored, already-decoded plain text, which never contained the
  // literal "&lrm;" artifact to begin with. This is an expected consequence
  // of replaying a response recorded under the (now-fixed) entity bug
  // against a clean fixture, unrelated to any of the four architectural
  // defects (see the file header).
  assert.equal(receipt.evidence_residual_count, 1);
  assert.equal(receipt.evidence_residuals[0].reason, 'LIMB_ASSERTION_QUOTE_UNVERIFIED');

  // Defect 3: every one of the remaining 17 limb assertions' inherited
  // section_reference ("3.1(b)(i)" etc.) fails to CONSTRUCT against this
  // document's real tree, whose governing node is discovered as
  // "III-INTRO(b)" -- exactly the live run's own finding 3, and STILL true
  // after the entity-decoding fix (see the ENTITY-DECODING NOTE in the file
  // header): this document genuinely has no numbered "Section 3.1" heading,
  // independent of entity decoding. But "3.1(b)(i)" and "3.1(b)(ii)" ARE
  // corroborated by this fixture's own governed text (limb (iii)'s real
  // "Sections ‎3.1(b)(i) and ‎3.1(b)(ii)" cross-reference), so only the
  // OTHER three distinct citations -- "3.1(b)(iii)", "3.1(b)(iv)",
  // "3.1(b)(v)" -- remain as unaccepted citation_residuals (9 occurrences
  // total across the run's 12 fragmented, label-reusing representation
  // instances).
  assert.equal(receipt.citation_residual_count, 9);
  assert.equal(receipt.citation_residuals.length, 9);
  assert.ok(receipt.citation_residuals.every((r) => r.reason === 'CITATION_NOT_CONSTRUCTIBLE'));
  // Per-proposal citation derivation (Skechers citation fix): each residual
  // now carries the node containing ITS OWN evidence span -- the governed
  // section's nested lettered markers III-INTRO(b)(i)/(iii)/(iv)/(v) --
  // instead of the old once-per-section constant 'III-INTRO(b)'. Strictly
  // more precise information in the same typed residual.
  assert.ok(receipt.citation_residuals.every((r) => /^III-INTRO\(b\)(\([ivx]+\))?$/.test(r.derived_citation)),
    `unexpected derived citation: ${receipt.citation_residuals.map((r) => r.derived_citation).join(', ')}`);
  assert.ok(receipt.citation_residuals.some((r) => r.derived_citation !== 'III-INTRO(b)'),
    'per-proposal derivation must resolve at least some residuals to their own deeper limb node');
  const distinctModelCitations = new Set(receipt.citation_residuals.map((r) => r.model_citation));
  assert.deepEqual(
    [...distinctModelCitations].sort(),
    ['3.1(b)(iii)', '3.1(b)(iv)', '3.1(b)(v)'],
  );

  // Net effect: NEVER SILENTLY DISCARDED. Every one of the 18 citation-
  // checked proposals still compiles -- accepted (via corroboration) or
  // not -- so compiled_candidate_count is 18, not 0. Each compiled entry
  // carries its own citation_validation record; 9 of the 18 (the "(i)"/
  // "(ii)" citations, repeated across fragments, plus the zero-share row) are accepted via
  // CORROBORATED_BY_DOCUMENT_TEXT, the other 9 stay unaccepted.
  assert.equal(receipt.compiled_candidate_count, 18);
  assert.equal(receipt.rejected_candidate_count, 0, 'nothing fails compilation on its own terms');
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok === true));
  const acceptedCount = receipt.compiled_candidates.filter(
    (entry) => entry.citation_validation && entry.citation_validation.accepted === true,
  ).length;
  assert.equal(acceptedCount, 9);
  assert.ok(
    receipt.compiled_candidates
      .filter((entry) => entry.citation_validation && entry.citation_validation.accepted === true)
      .every((entry) => entry.citation_validation.validation_source === 'CORROBORATED_BY_DOCUMENT_TEXT'),
  );

  const admittedSourceContext = buildIdentityAdmittedSourceContext(degenerateFullText, {
    dealKey: 'deal:f28-live-fixture-replay',
    dealAdmissionId: sha256Hex('deal-admission:f28-live-fixture-replay'),
    sourceOrdinal: 0,
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: admittedSourceContext,
  });

  // Every one of the 17 compiled candidates is a bare limb assertion
  // (LIMB_ASSERTION_CLAIM_KEY, unmapped by design -- see candidate-
  // resolution.js's own table comments), so all 17 land in open_world
  // regardless of citation outcome, exactly as before this fix -- citation
  // validation changes WHETHER a candidate compiles and what it carries,
  // never which resolution bucket an already-unmapped generic key lands in.
  // What DOES change: none of them vanish, and each open_world entry now
  // carries its own citation_validation record for visibility.
  assert.equal(resolution.resolved.length, 0);
  assert.equal(resolution.review_queue.length, 0);
  assert.equal(resolution.open_world.length, 17);
  assert.equal(resolution.residuals.length, 1);
  assert.ok(resolution.open_world.every((entry) => entry.reason === 'UNMAPPED_GENERIC_CLAIM_KEY'));
  assert.ok(resolution.open_world.every((entry) => entry.citation_validation != null));
});
