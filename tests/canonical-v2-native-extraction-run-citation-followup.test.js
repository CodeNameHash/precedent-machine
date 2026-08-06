'use strict';

/**
 * tests/canonical-v2-native-extraction-run-citation-followup.test.js
 *
 * docs/codex-program/notes/citation-scope-design.md Part 6, implementing
 * `runNativeExtractionWithCitationFollowup` /
 * `mergeNativeExtractionReceipts` (lib/canonical-v2/native-producer/
 * native-extraction-run-citation-followup.js). Three tiers:
 *
 *   1. Pure unit tests against hand-built inputs (mergeNativeExtractionReceipts,
 *      collectBareCitationTargets, classifyCitedReferences) -- no model call,
 *      no real document, deterministic by construction. This is also where
 *      the AMBIGUOUS-reference branch is proven: the real Modiv document has
 *      zero reference collisions (confirmed directly, see below), so an
 *      end-to-end proof of that branch needs a hand-built tree, not real
 *      text.
 *   2. A small, fully synthetic multi-section fixture proving the HOP LIMIT
 *      in isolation: section A bare-cites section B, B's own text is ALSO
 *      bare-citation-shaped (cites section C) -- C is never dispatched, and
 *      exactly two calls to the underlying `runNativeExtraction` dispatch
 *      loop happen, confirmed by counting every individual provider
 *      invocation.
 *   3. Real Modiv document, real recorded promptv3 responses replayed for
 *      pass A, exercising the actual dispatch-selection decision against
 *      real bare citations and the real sectionizer tree.
 *
 * SECTION-ADDRESSING RE-VERIFICATION. Before relying on any of this, the
 * claim that all 11 distinct references the real promptv3 bare citations
 * name resolve (and that 8.12(gg)/8.12(vv) do not) was re-derived directly
 * against the CURRENT tree in this session (not assumed from
 * docs/codex-program/notes/citation-scope-design.md, which analysed a
 * DIFFERENT recorded run, modiv-termination-fee-scope-correction-20260805,
 * whose Section 7.3 response had six fee_trigger_assertions entries where
 * promptv3's has five, and whose Section 8.12 response had five SEPARATE
 * entries where promptv3's has two disjunctive ones). See this file's own
 * "section-addressing re-verification" test below, which performs that
 * derivation as an executable assertion, not a comment.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const {
  contentId, canonicalJson, sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { SOURCE_MAP_ENCODING } = require('../lib/canonical-v2/sec-html-canonical-text');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const {
  sectionizeAdmittedSource, findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { runNativeExtraction, RUN_RECEIPT_SCHEMA } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeTerminationFeeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  CITATION_FOLLOWUP_HOP_LIMIT,
  CITATION_FOLLOWUP_SECTION_FAMILY,
  mergeNativeExtractionReceipts,
  runNativeExtractionWithCitationFollowup,
  collectBareCitationTargets,
  classifyCitedReferences,
} = require('../lib/canonical-v2/native-producer/native-extraction-run-citation-followup');

// ─── Real Modiv admission (byte-identical reproduction pattern to
// scripts/canonical-v2-citation-scope-resolution-harness.mjs and
// tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js
// -- reused, not re-derived from scratch, deliberately: an independent
// re-derivation of the SAME pin adds no evidentiary value over what those
// two already established, and this file's own job is the dispatch logic,
// not re-litigating source admission). ───

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const PROMPTV3_EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-termination-fee-promptv3-20260805');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';
const ORIGINAL_SECTION_REFS = ['7.1', '7.3', '8.12'];

function loadModivDocument() {
  const rawBytes = fs.readFileSync(RAW_HTML_PATH);
  assert.equal(sha256Hex(rawBytes), EXPECTED_RAW_BYTES_SHA256, 'committed Modiv raw HTML must match the pinned hash');
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: MODIV_RETRIEVAL_URL,
    final_url: MODIV_RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-06T00:00:00.000Z',
    retrieval_policy_digest: sha256Hex('canonical-v2-native-extraction-run-citation-followup.test.js: reuse of committed raw HTML, no network fetch'),
    redirect_count: 0,
    response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  assert.equal(conversion.canonical_text_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'canonical text must match the pinned hash');
  return { fullText: conversion.canonical_text, documentHash: sha256Hex(rawBytes) };
}

function loadRecordedResponse(sectionSlug) {
  const filePath = path.join(PROMPTV3_EVIDENCE_DIR, `native-producer-recorded-response-${sectionSlug}.json`);
  const recorded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const stripped = recorded.raw_response_text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(stripped);
}

// ─── Section-addressing re-verification (executable, not a comment) ───

test('section-addressing re-verification: every distinct reference the real promptv3 bare citations name resolves against the CURRENT tree; 8.12(gg)/8.12(vv) still do not; zero whole-tree collisions', () => {
  const { fullText, documentHash } = loadModivDocument();
  const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });

  const refCounts = new Map();
  for (const node of tree.nodes) {
    if (!node.reference) continue;
    refCounts.set(node.reference, (refCounts.get(node.reference) || 0) + 1);
  }
  const collisions = [...refCounts.entries()].filter(([, count]) => count >= 2);
  assert.deepEqual(collisions, [], 'Modiv tree must have zero reference collisions (matches the design doc\'s own exhaustive scan)');

  const parsed73 = loadRecordedResponse('7.3');
  const parsed812 = loadRecordedResponse('8.12');
  const compiled = [...parsed73.fee_trigger_assertions, ...parsed812.fee_trigger_assertions];
  assert.equal(compiled.length, 7, 'promptv3 evidence: 5 bare candidates in 7.3 + 2 in 8.12 = 7 fee_trigger_assertions entries');
  assert.ok(compiled.every((entry) => entry.trigger_code === null), 'every one of these must carry trigger_code: null');

  const citedRefPattern = /Section\s+(\d+(?:\.\d+)?(?:\([A-Za-z0-9]+\))*)/g;
  const distinctCited = new Set();
  for (const entry of compiled) {
    for (const match of entry.quote.matchAll(citedRefPattern)) distinctCited.add(match[1]);
  }
  const expectedCited = [
    '7.1(d)(ii)', '7.1(c)(i)', '7.1(d)(i)', '7.1(d)(iii)', '7.1(c)(ii)', '7.1(c)(iii)',
    '7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)', '7.3(b)(iv)', '7.3(b)(v)',
  ];
  assert.deepEqual([...distinctCited].sort(), [...expectedCited].sort(), '11 distinct references cited across the real promptv3 bare candidates');

  for (const ref of expectedCited) {
    const node = findSectionByReference(tree, ref);
    assert.ok(node, `${ref} must resolve against the current tree`);
    assert.equal(refCounts.get(ref), 1, `${ref} must resolve to exactly one node`);
  }
  for (const ref of ['8.12(gg)', '8.12(vv)']) {
    assert.equal(findSectionByReference(tree, ref), null, `${ref} must still fail to resolve (SEC2, unfixed, confirmed not on this feature's path)`);
    assert.equal(refCounts.get(ref) || 0, 0);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Tier 1: pure unit tests, hand-built inputs
// ═══════════════════════════════════════════════════════════════════════

function minimalReceipt(overrides = {}) {
  return {
    schema_version: RUN_RECEIPT_SCHEMA,
    document_hash: 'doc-hash-1',
    source_sha256: 'source-sha-1',
    source_byte_length: 1000,
    root_section_id: 'root-1',
    requested_section_references: [],
    resolved_sections: [],
    compiled_candidates: [],
    evidence_residuals: [],
    scope_violations: [],
    citation_residuals: [],
    coverage_proxies: [],
    limb_enumeration_scan: [],
    undispatched_sections: [],
    evidence_residual_count: 0,
    scope_violation_count: 0,
    citation_residual_count: 0,
    undispatched_section_count: 0,
    compiled_candidate_count: 0,
    rejected_candidate_count: 0,
    run_receipt_id: 'placeholder',
    ...overrides,
  };
}

test('mergeNativeExtractionReceipts: two hand-built minimal receipts merge into one, content-addressed and order-stable (A before B)', () => {
  const a = minimalReceipt({
    requested_section_references: ['7.1'],
    resolved_sections: [{ section_reference: '7.1', start: 0, end: 10 }],
    compiled_candidates: [{ ok: true, section_reference: '7.1', candidate: { kind: 'claim' } }],
  });
  const b = minimalReceipt({
    requested_section_references: ['7.1(d)(ii)'],
    resolved_sections: [{ section_reference: '7.1(d)(ii)', start: 20, end: 30 }],
    compiled_candidates: [{ ok: false, section_reference: '7.1(d)(ii)' }],
  });

  const merged = mergeNativeExtractionReceipts(a, b);
  assert.deepEqual(merged.requested_section_references, ['7.1', '7.1(d)(ii)']);
  assert.deepEqual(merged.resolved_sections.map((s) => s.section_reference), ['7.1', '7.1(d)(ii)']);
  assert.equal(merged.compiled_candidates.length, 2);
  assert.equal(merged.compiled_candidate_count, 1, 'only the ok:true candidate counts');
  assert.equal(merged.rejected_candidate_count, 1);
  assert.equal(merged.document_hash, 'doc-hash-1');
  assert.ok(Object.isFrozen(merged));
  assert.ok(Object.isFrozen(merged.resolved_sections));

  // Content-addressed and order-stable: re-merging the same two inputs
  // produces the byte-identical id.
  const mergedAgain = mergeNativeExtractionReceipts(a, b);
  assert.equal(mergedAgain.run_receipt_id, merged.run_receipt_id);

  // A different concatenation order is a genuinely different receipt.
  const swapped = mergeNativeExtractionReceipts(b, a);
  assert.notEqual(swapped.run_receipt_id, merged.run_receipt_id);
});

test('mergeNativeExtractionReceipts: extraFields are folded into the SAME content-id computation, not a second hash', () => {
  const a = minimalReceipt();
  const b = minimalReceipt();
  const withoutExtra = mergeNativeExtractionReceipts(a, b);
  const withExtra = mergeNativeExtractionReceipts(a, b, { citation_followup_dispatched_references: ['7.1(d)(ii)'] });
  assert.notEqual(withExtra.run_receipt_id, withoutExtra.run_receipt_id, 'extraFields must participate in the hash');
  assert.deepEqual(withExtra.citation_followup_dispatched_references, ['7.1(d)(ii)']);
  assert.equal('citation_followup_dispatched_references' in withoutExtra, false);
});

test('mergeNativeExtractionReceipts: refuses to merge receipts for different documents', () => {
  const a = minimalReceipt({ document_hash: 'doc-A' });
  const b = minimalReceipt({ document_hash: 'doc-B' });
  assert.throws(() => mergeNativeExtractionReceipts(a, b), TypeError);
});

test('collectBareCitationTargets: finds bare candidates, ignores non-bare and non-null-trigger_code ones, tracks which section(s) cited each reference', () => {
  const compiledCandidates = [
    {
      ok: true, section_reference: '7.3',
      candidate: {
        kind: 'claim',
        claim: {
          claim_definition_key: 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE',
          raw_value: 'by Parent pursuant to Section 7.1(d)(ii)',
          attributes: { trigger_code: null },
        },
      },
    },
    {
      ok: true, section_reference: '8.12',
      candidate: {
        kind: 'claim',
        claim: {
          claim_definition_key: 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE',
          raw_value: 'if payable pursuant to Section 7.1(d)(ii) or Section 7.1(c)(i)',
          attributes: { trigger_code: null },
        },
      },
    },
    // Already coded -- not a citation-following candidate.
    {
      ok: true, section_reference: '7.1',
      candidate: {
        kind: 'claim',
        claim: {
          claim_definition_key: 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE',
          raw_value: 'the Company Board has approved a Superior Proposal',
          attributes: { trigger_code: 'SUPERIOR_PROPOSAL_TERMINATION' },
        },
      },
    },
    // Real descriptive text alongside a citation -- not bare, must be excluded.
    {
      ok: true, section_reference: '7.3',
      candidate: {
        kind: 'claim',
        claim: {
          claim_definition_key: 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE',
          raw_value: 'a Company Acquisition Proposal shall have been received pursuant to Section 7.1(b)(ii)',
          attributes: { trigger_code: null },
        },
      },
    },
    // Not ok -- must be ignored entirely.
    { ok: false, section_reference: '7.3' },
    // Different claim key -- must be ignored.
    {
      ok: true,
      section_reference: '7.3',
      candidate: { kind: 'claim', claim: { claim_definition_key: 'NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE', raw_value: 'x', attributes: {} } },
    },
  ];

  const result = collectBareCitationTargets(compiledCandidates);
  assert.deepEqual([...result.keys()].sort(), ['7.1(c)(i)', '7.1(d)(ii)']);
  assert.deepEqual([...result.get('7.1(d)(ii)')].sort(), ['7.3', '8.12'], 'cited from both 7.3 and 8.12');
  assert.deepEqual([...result.get('7.1(c)(i)')].sort(), ['8.12']);
});

test('classifyCitedReferences: routes already-dispatched, unresolved, ambiguous and dispatchable references correctly, against a hand-built tree', () => {
  // Hand-built tree: proves the AMBIGUOUS branch directly (the real Modiv
  // document has zero reference collisions -- see the section-addressing
  // re-verification test above -- so this decision can only be exercised
  // end-to-end against a document that does not exist; classifyCitedReferences
  // is factored out of runNativeExtractionWithCitationFollowup specifically
  // so this branch is still directly testable).
  const tree = {
    nodes: [
      { reference: '7.1' },
      { reference: '7.1(c)(i)' }, // resolves cleanly
      { reference: '9.9(a)' }, // a real node, but not cited by anything below
      { reference: '9.9(z)' },
      { reference: '9.9(z)' }, // deliberate collision: two nodes, same reference string
    ],
  };
  const citedFromByReference = new Map([
    ['7.1', new Set(['7.3'])], // already in the caller's own original request
    ['7.1(c)(i)', new Set(['7.3'])], // resolves cleanly -> dispatched
    ['8.12(gg)', new Set(['8.12'])], // not in the tree at all -> unresolved
    ['9.9(z)', new Set(['7.3', '8.12'])], // two citing sections, both recorded
  ]);
  const originalReferences = new Set(['7.1', '7.3', '8.12']);

  const { followupBatch, residuals } = classifyCitedReferences({ citedFromByReference, tree, originalReferences });

  assert.deepEqual(followupBatch, ['7.1(c)(i)']);
  const byRef = Object.fromEntries(residuals.map((r) => [r.cited_reference, r]));
  assert.equal(byRef['7.1'].reason, 'CITATION_ALREADY_DISPATCHED');
  assert.equal(byRef['8.12(gg)'].reason, 'CITATION_REFERENCE_UNRESOLVED');
  assert.equal(byRef['9.9(z)'].reason, 'CITATION_REFERENCE_AMBIGUOUS');
  assert.deepEqual(byRef['9.9(z)'].cited_from_section_references, ['7.3', '8.12']);
  assert.equal(residuals.length, 3);
  for (const entry of residuals) assert.ok(Object.isFrozen(entry));
});

test('classifyCitedReferences: accepts a plain array tree too (findSectionByReference\'s own accepted shape)', () => {
  const tree = [{ reference: '7.1(c)(i)' }];
  const { followupBatch, residuals } = classifyCitedReferences({
    citedFromByReference: new Map([['7.1(c)(i)', new Set(['7.3'])]]),
    tree,
    originalReferences: new Set(),
  });
  assert.deepEqual(followupBatch, ['7.1(c)(i)']);
  assert.deepEqual(residuals, []);
});

// ═══════════════════════════════════════════════════════════════════════
// Tier 2: hop limit, proven in isolation on a small synthetic fixture
// ═══════════════════════════════════════════════════════════════════════

const SELLER_FULL_PAYMENT_SENTENCE = 'the Company shall pay (or cause to be paid) as directed by Parent the '
  + 'Company Termination Fee by wire transfer of same day funds to an account designated by Parent.';

function wrapMultiClauseAgreementShell(clauseBodiesByLetter) {
  const clauseText = Object.entries(clauseBodiesByLetter)
    .map(([letter, body]) => `(${letter})${body}\n\n`)
    .join('');
  return [
    'This AGREEMENT AND PLAN OF MERGER, dated as of April 18, 2026, by and among ',
    'Buyer, Inc. and the Company.\n\n',
    'ARTICLE III\n\nFEES AND TERMINATION\n\n',
    'Section 3.1 Fees and Termination.\n\n',
    clauseText,
  ].join('');
}

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
  const immutable = { ...immutableBody, immutable_source_document_id: contentId('IMMUTABLE_SOURCE_DOCUMENT/V2', immutableBody) };
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
  const admission = { ...admissionBody, source_admission_manifest_id: contentId('SOURCE_ADMISSION_MANIFEST/V2', admissionBody) };
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
  const envelope = { ...envelopeBody, semantic_extraction_input_envelope_id: contentId('SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1', envelopeBody) };
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

const CONTRACT_BUNDLE_V34 = compileFixtureContractV34();

test('hop limit: a chained citation (A cites B, B is itself bare and cites C) dispatches B but never C -- exactly 2 total passes, 2 provider calls', async () => {
  const sourceText = wrapMultiClauseAgreementShell({
    a: ` Termination Fee. In the event terminated by Parent pursuant to Section 3.1(b), then ${SELLER_FULL_PAYMENT_SENTENCE}`,
    b: ` by Parent pursuant to Section 3.1(c),`, // itself still bare -- chained
    c: ` the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.`,
  });
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));

  const seenSectionReferences = [];
  async function provider({ governed_scope: governedScope }) {
    seenSectionReferences.push(governedScope.section_reference);
    let response = { fee_amount_assertions: [], fee_trigger_assertions: [], tail_period_assertions: [], open_world_candidates: [] };
    if (governedScope.section_reference === '3.1(a)') {
      response.fee_trigger_assertions = [{
        section_reference: '3.1(a)', fee_side: 'SELLER', trigger_code: null, quote: 'terminated by Parent pursuant to Section 3.1(b)',
      }];
    } else if (governedScope.section_reference === '3.1(b)') {
      // B's own dispatched answer is ITSELF bare-citation-shaped -- a real
      // chained citation, matching Modiv's own 7.3(b)(i)-(v) shape.
      response.fee_trigger_assertions = [{
        section_reference: '3.1(b)', fee_side: 'SELLER', trigger_code: null, quote: 'by Parent pursuant to Section 3.1(c)',
      }];
    }
    // 3.1(c) must NEVER be dispatched -- if this branch is reached the hop
    // limit has been violated.
    const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationFeeProposals(response, governedScope.source_text);
    return {
      provider_id: 'hop-limit-test/v1', model_id: 'stub', prompt: 'hop-limit-test-prompt/v1', proposals, evidence_residuals: evidenceResiduals,
    };
  }

  const receipt = await runNativeExtractionWithCitationFollowup({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: ['3.1(a)'],
    section_family_assignments: [{ section_reference: '3.1(a)', family_id: CITATION_FOLLOWUP_SECTION_FAMILY }],
    contract_bundle: CONTRACT_BUNDLE_V34,
    definitions: { known_definitions: [] },
    provider,
  });

  assert.equal(CITATION_FOLLOWUP_HOP_LIMIT, 1);
  assert.deepEqual(seenSectionReferences.sort(), ['3.1(a)', '3.1(b)'], 'exactly 2 provider calls -- 3.1(c) is never dispatched');
  assert.deepEqual(receipt.citation_followup_dispatched_references, ['3.1(b)']);
  assert.deepEqual(receipt.requested_section_references, ['3.1(a)', '3.1(b)']);

  // The residual is recorded against 3.1(b) -- the section this module
  // actually dispatched and whose OWN answer turned out to still be bare
  // -- not against 3.1(c), which this module never looked at (hop limit).
  // `chains_to` names 3.1(c) purely informationally.
  const chainResidual = receipt.citation_followup_residuals.find((r) => r.reason === 'CITATION_CHAIN_NOT_FOLLOWED');
  assert.ok(chainResidual, 'the chained target must be recorded, typed, never silently dropped');
  assert.equal(chainResidual.cited_reference, '3.1(b)');
  assert.deepEqual(chainResidual.cited_from_section_references, ['3.1(a)']);
  assert.deepEqual(chainResidual.chains_to, ['3.1(c)'], 'informational only -- this module never dispatches a call for it');
});

test('inert: zero bare citations produces a byte-identical receipt to a plain runNativeExtraction call (same run_receipt_id)', async () => {
  const sourceText = wrapMultiClauseAgreementShell({
    a: ` Termination Fee. ${SELLER_FULL_PAYMENT_SENTENCE} the Company Board has approved a Superior Proposal.`,
  });
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));

  async function provider({ governed_scope: governedScope }) {
    const response = {
      fee_amount_assertions: [],
      fee_trigger_assertions: [{
        section_reference: '3.1(a)', fee_side: 'SELLER', trigger_code: 'SUPERIOR_PROPOSAL_TERMINATION', quote: 'the Company Board has approved a Superior Proposal.',
      }],
      tail_period_assertions: [],
      open_world_candidates: [],
    };
    const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationFeeProposals(response, governedScope.source_text);
    return {
      provider_id: 'inert-test/v1', model_id: 'stub', prompt: 'inert-test-prompt/v1', proposals, evidence_residuals: evidenceResiduals,
    };
  }

  const args = {
    source_text: sourceText,
    document_hash: documentHash,
    section_references: ['3.1(a)'],
    section_family_assignments: [{ section_reference: '3.1(a)', family_id: CITATION_FOLLOWUP_SECTION_FAMILY }],
    contract_bundle: CONTRACT_BUNDLE_V34,
    definitions: { known_definitions: [] },
    provider,
  };

  const plainReceipt = await runNativeExtraction(args);
  const followupReceipt = await runNativeExtractionWithCitationFollowup(args);

  assert.equal(followupReceipt.run_receipt_id, plainReceipt.run_receipt_id, 'must be byte-identical when nothing cites anything');
  assert.equal('citation_followup_dispatched_references' in followupReceipt, false);
  assert.equal('citation_followup_residuals' in followupReceipt, false);
});

test('bare citations exist but nothing is dispatchable: zero extra provider calls, but NOT silent -- residuals are attached and run_receipt_id differs from the inert case', async () => {
  const sourceText = wrapMultiClauseAgreementShell({
    a: ` Termination Fee. In the event terminated by Parent pursuant to Section 99.99(zz), then ${SELLER_FULL_PAYMENT_SENTENCE}`,
  });
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));

  let callCount = 0;
  async function provider({ governed_scope: governedScope }) {
    callCount += 1;
    const response = {
      fee_amount_assertions: [],
      fee_trigger_assertions: [{
        section_reference: '3.1(a)', fee_side: 'SELLER', trigger_code: null, quote: 'terminated by Parent pursuant to Section 99.99(zz)',
      }],
      tail_period_assertions: [],
      open_world_candidates: [],
    };
    const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationFeeProposals(response, governedScope.source_text);
    return {
      provider_id: 'unresolvable-test/v1', model_id: 'stub', prompt: 'unresolvable-test-prompt/v1', proposals, evidence_residuals: evidenceResiduals,
    };
  }

  const args = {
    source_text: sourceText,
    document_hash: documentHash,
    section_references: ['3.1(a)'],
    section_family_assignments: [{ section_reference: '3.1(a)', family_id: CITATION_FOLLOWUP_SECTION_FAMILY }],
    contract_bundle: CONTRACT_BUNDLE_V34,
    definitions: { known_definitions: [] },
    provider,
  };

  const plainReceipt = await runNativeExtraction(args);
  callCount = 0; // reset -- only count calls made by the followup orchestrator below
  const followupReceipt = await runNativeExtractionWithCitationFollowup(args);

  assert.equal(callCount, 1, 'zero EXTRA calls -- only the original pass-A dispatch');
  assert.deepEqual(followupReceipt.citation_followup_dispatched_references, []);
  assert.equal(followupReceipt.citation_followup_residuals.length, 1);
  assert.equal(followupReceipt.citation_followup_residuals[0].reason, 'CITATION_REFERENCE_UNRESOLVED');
  assert.equal(followupReceipt.citation_followup_residuals[0].cited_reference, '99.99(zz)');
  assert.notEqual(followupReceipt.run_receipt_id, plainReceipt.run_receipt_id, 'must NOT be silently identical to the inert case -- a citation WAS attempted');
});

test('already-dispatched dedup: a bare citation naming a section the caller ALREADY requested is never re-dispatched, and the resolver can still see it', async () => {
  // Sequential lettering (a, b) -- the sectionizer's own marker-depth
  // heuristic (the SAME mechanism behind the real Modiv 8.12(gg)/8.12(vv)
  // defect, SEC2) is sensitive to gaps in a lettered run; this fixture
  // does not exercise that defect, so it stays sequential.
  const sourceText = wrapMultiClauseAgreementShell({
    a: ` Termination Fee. In the event terminated by Parent pursuant to Section 3.1(b), then ${SELLER_FULL_PAYMENT_SENTENCE}`,
    b: ` the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.`,
  });
  const documentHash = sha256Hex(Buffer.from(sourceText, 'utf8'));

  const seenSectionReferences = [];
  async function provider({ governed_scope: governedScope }) {
    seenSectionReferences.push(governedScope.section_reference);
    let response = { fee_amount_assertions: [], fee_trigger_assertions: [], tail_period_assertions: [], open_world_candidates: [] };
    if (governedScope.section_reference === '3.1(a)') {
      response.fee_trigger_assertions = [{
        section_reference: '3.1(a)', fee_side: 'SELLER', trigger_code: null, quote: 'terminated by Parent pursuant to Section 3.1(b)',
      }];
    } else if (governedScope.section_reference === '3.1(b)') {
      response.fee_trigger_assertions = [{
        section_reference: '3.1(b)', fee_side: 'SELLER', trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION', quote: 'the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.',
      }];
    }
    const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationFeeProposals(response, governedScope.source_text);
    return {
      provider_id: 'dedup-test/v1', model_id: 'stub', prompt: 'dedup-test-prompt/v1', proposals, evidence_residuals: evidenceResiduals,
    };
  }

  // 3.1(b) is ALREADY in the caller's own original request -- the follow-up
  // must not dispatch it a second time.
  const receipt = await runNativeExtractionWithCitationFollowup({
    source_text: sourceText,
    document_hash: documentHash,
    section_references: ['3.1(a)', '3.1(b)'],
    section_family_assignments: [
      { section_reference: '3.1(a)', family_id: CITATION_FOLLOWUP_SECTION_FAMILY },
      { section_reference: '3.1(b)', family_id: CITATION_FOLLOWUP_SECTION_FAMILY },
    ],
    contract_bundle: CONTRACT_BUNDLE_V34,
    definitions: { known_definitions: [] },
    provider,
  });

  assert.equal(seenSectionReferences.length, 2, 'exactly the 2 originally-requested calls -- no third call for 3.1(b)');
  assert.deepEqual(receipt.citation_followup_dispatched_references, []);
  const residual = receipt.citation_followup_residuals.find((r) => r.cited_reference === '3.1(b)');
  assert.equal(residual.reason, 'CITATION_ALREADY_DISPATCHED');
});

// ═══════════════════════════════════════════════════════════════════════
// Tier 3: real Modiv document, real recorded promptv3 responses for pass A
// ═══════════════════════════════════════════════════════════════════════

test('real Modiv promptv3 evidence: dispatch selects exactly the 11 resolvable cited references, refuses none as unresolved/ambiguous, and never re-dispatches 7.1/7.3/8.12', async () => {
  const { fullText, documentHash } = loadModivDocument();
  const recorded = {
    '7.1': loadRecordedResponse('7.1'),
    '7.3': loadRecordedResponse('7.3'),
    '8.12': loadRecordedResponse('8.12'),
  };

  // The 5 sub-clauses of 7.3(b), when dispatched on their own, are given a
  // SYNTHETIC response whose OWN quote is bare (matching every real,
  // directly-observed instance in this evidence of the model isolating a
  // bare citation cleanly from surrounding prose, even when the raw node
  // text also carries payment mechanics -- see bare-citation-trigger-
  // parser.js's own file header). This is NOT a claim about what a live
  // model would say (no live call was made) -- it is what lets this test
  // prove the CHAIN-DETECTION mechanics against a realistic, evidence-
  // shaped input.
  const CHAINED_TARGET_QUOTES = {
    '7.3(b)(i)': 'by Parent pursuant to Section 7.1(d)(ii)',
    '7.3(b)(ii)': 'by the Company pursuant to Section 7.1(c)(i)',
    // Must byte-verify against 7.3(b)(iii)'s own real (longer, non-bare-
    // as-a-whole) node text -- shapeTerminationFeeProposals rejects a
    // quote that is not an exact substring (FEE_TRIGGER_QUOTE_UNVERIFIED),
    // exactly the byte-exact discipline this whole feature exists to
    // respect. This is a real, verbatim substring of the real node
    // (confirmed directly against the committed fixture), narrowed to just
    // its own bare-citation-shaped opening clause.
    '7.3(b)(iii)': 'by the Company or Parent pursuant to Section 7.1(b)(ii)',
    '7.3(b)(iv)': 'by Parent pursuant to Section 7.1(d)(i)',
    '7.3(b)(v)': 'by Parent pursuant to Section 7.1(d)(iii)',
  };
  // The 6 one-hop targets get a SYNTHETIC, clean, agreeing response for
  // exactly one of them (7.1(d)(ii): a real, cleanly-corroborating pattern
  // match) so the resolver-level substitution path has something concrete
  // to exercise end-to-end; the rest stay silent (no fee_trigger_assertions
  // entry at all) -- also a real, honest possibility (see this file's own
  // header note and citation-following-implementation.md: whether a model
  // shown an isolated sub-clause reliably reports it as a fee trigger is
  // unverified without a live call).
  const ONE_HOP_TARGETS = ['7.1(c)(i)', '7.1(c)(ii)', '7.1(c)(iii)', '7.1(d)(i)', '7.1(d)(ii)', '7.1(d)(iii)'];

  const seenSectionReferences = [];
  async function provider({ governed_scope: governedScope }) {
    const ref = governedScope.section_reference;
    seenSectionReferences.push(ref);
    if (recorded[ref]) {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationFeeProposals(recorded[ref], governedScope.source_text);
      return {
        provider_id: 'modiv-replay/v1', model_id: 'stub', prompt: 'modiv-replay-prompt/v1', proposals, evidence_residuals: evidenceResiduals,
      };
    }
    let response = { fee_amount_assertions: [], fee_trigger_assertions: [], tail_period_assertions: [], open_world_candidates: [] };
    if (CHAINED_TARGET_QUOTES[ref]) {
      response.fee_trigger_assertions = [{
        section_reference: ref, fee_side: 'SELLER', trigger_code: null, quote: CHAINED_TARGET_QUOTES[ref],
      }];
    } else if (ref === '7.1(d)(ii)') {
      response.fee_trigger_assertions = [{
        section_reference: ref, fee_side: 'SELLER', trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION', quote: 'the Company Board shall have effected an Adverse Recommendation Change prior to the Company Requisite Vote.',
      }];
    } else if (!ONE_HOP_TARGETS.includes(ref)) {
      assert.fail(`unexpected section dispatched: ${ref}`);
    }
    const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationFeeProposals(response, governedScope.source_text);
    return {
      provider_id: 'modiv-synthetic-followup/v1', model_id: 'stub', prompt: 'modiv-synthetic-followup-prompt/v1', proposals, evidence_residuals: evidenceResiduals,
    };
  }

  const receipt = await runNativeExtractionWithCitationFollowup({
    source_text: fullText,
    document_hash: documentHash,
    section_references: ORIGINAL_SECTION_REFS,
    section_family_assignments: ORIGINAL_SECTION_REFS.map((ref) => ({ section_reference: ref, family_id: CITATION_FOLLOWUP_SECTION_FAMILY })),
    contract_bundle: CONTRACT_BUNDLE_V34,
    definitions: { known_definitions: [] },
    provider,
  });

  const EXPECTED_FOLLOWUP = [
    '7.1(c)(i)', '7.1(c)(ii)', '7.1(c)(iii)', '7.1(d)(i)', '7.1(d)(ii)', '7.1(d)(iii)',
    '7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)', '7.3(b)(iv)', '7.3(b)(v)',
  ].sort();
  assert.deepEqual(receipt.citation_followup_dispatched_references.slice().sort(), EXPECTED_FOLLOWUP);
  assert.equal(seenSectionReferences.length, 3 + EXPECTED_FOLLOWUP.length, `3 original + ${EXPECTED_FOLLOWUP.length} follow-up = ${3 + EXPECTED_FOLLOWUP.length} total provider calls`);
  assert.deepEqual(
    seenSectionReferences.slice(0, 3),
    ORIGINAL_SECTION_REFS,
    'pass A dispatches in the caller\'s own requested order, unaffected by follow-up',
  );

  // No reference is refused as unresolved or ambiguous -- all 11 are real,
  // resolvable Modiv sections (matches the section-addressing
  // re-verification test above).
  const unresolvedOrAmbiguous = receipt.citation_followup_residuals.filter(
    (r) => r.reason === 'CITATION_REFERENCE_UNRESOLVED' || r.reason === 'CITATION_REFERENCE_AMBIGUOUS',
  );
  assert.deepEqual(unresolvedOrAmbiguous, []);

  // The 5 sub-clauses of 7.3(b) are each dispatched (hop 1) but their own
  // answer is itself bare -- hop 2 is never taken, and this is recorded.
  const chainResiduals = receipt.citation_followup_residuals.filter((r) => r.reason === 'CITATION_CHAIN_NOT_FOLLOWED');
  assert.deepEqual(
    chainResiduals.map((r) => r.cited_reference).sort(),
    ['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)', '7.3(b)(iv)', '7.3(b)(v)'],
  );
  // 7.1(d)(ii) is cited BOTH directly (from 7.3) and as a hop-2 target
  // (from 7.3(b)(i)) -- it must never appear as a chain residual itself
  // (it has real, non-bare ground text once dispatched on its own).
  assert.ok(!chainResiduals.some((r) => r.cited_reference === '7.1(d)(ii)'));

  // 8.12(gg)/8.12(vv) are never cited by any real bare candidate in this
  // evidence (the run script that produced it deliberately pins whole
  // Section 8.12 rather than a sub-clause of it) -- confirm they are
  // genuinely absent from this run's citation surface, not merely
  // unresolved.
  assert.ok(!receipt.citation_followup_residuals.some((r) => r.cited_reference.startsWith('8.12(')));

  // Merged receipt carries both passes' own resolved_sections, in order.
  assert.deepEqual(
    receipt.resolved_sections.map((s) => s.section_reference).slice(0, 3),
    ORIGINAL_SECTION_REFS,
  );
  assert.equal(receipt.resolved_sections.length, 3 + EXPECTED_FOLLOWUP.length);
});

test('call-count projection: the real Modiv termination-fee run goes from 3 calls today to 14 under this change (+11, the deduplicated distinct one-hop targets; the 5 chained ones stop at hop 1 and add no further calls)', async () => {
  const { fullText, documentHash } = loadModivDocument();
  const recorded = {
    '7.1': loadRecordedResponse('7.1'),
    '7.3': loadRecordedResponse('7.3'),
    '8.12': loadRecordedResponse('8.12'),
  };
  let callCount = 0;
  async function provider({ governed_scope: governedScope }) {
    callCount += 1;
    const ref = governedScope.section_reference;
    const response = recorded[ref] || { fee_amount_assertions: [], fee_trigger_assertions: [], tail_period_assertions: [], open_world_candidates: [] };
    const { proposals, evidence_residuals: evidenceResiduals } = shapeTerminationFeeProposals(response, governedScope.source_text);
    return {
      provider_id: 'call-count-test/v1', model_id: 'stub', prompt: 'call-count-test-prompt/v1', proposals, evidence_residuals: evidenceResiduals,
    };
  }

  await runNativeExtractionWithCitationFollowup({
    source_text: fullText,
    document_hash: documentHash,
    section_references: ORIGINAL_SECTION_REFS,
    section_family_assignments: ORIGINAL_SECTION_REFS.map((ref) => ({ section_reference: ref, family_id: CITATION_FOLLOWUP_SECTION_FAMILY })),
    contract_bundle: CONTRACT_BUNDLE_V34,
    definitions: { known_definitions: [] },
    provider,
  });

  assert.equal(callCount, 14, '3 today (7.1, 7.3, 8.12) + 11 deduplicated distinct cited references, in exactly one follow-up pass');
});
