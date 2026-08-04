'use strict';

/**
 * tests/canonical-v2-skechers-replay.test.js
 *
 * Replays the RECORDED, UNMODIFIED raw model response from the Skechers/
 * Beach Acquisition first live run (commit "Skechers live run -- second
 * deal, second published claim") through the pipeline AFTER the citation-
 * derivation fix (native-extraction-run.js's per-proposal derivation +
 * citation-constructibility.js's decimal-lineage tie-break -- see those two
 * files' own headers).
 *
 * REAL PIPELINE, NOT A SYNTHETIC FIXTURE. The canonical text is reconstructed
 * from the committed raw HTML fixture (skechers-raw-fetched.htm) through the
 * SAME real admission chain scripts/canonical-v2-skechers-first-live-
 * extraction-run.mjs used for the actual live run (buildSecEdgarIntakeCapture
 * -> convertSecHtmlToCanonicalText -> verifySecHtmlCanonicalText ->
 * buildVerifiedSecSourceAdmission), re-verified against the pinned raw-bytes
 * hash in intake-pin.json before proceeding -- never assumed. The recorded
 * model response (native-producer-recorded-response.json) is replayed
 * through the real `shapeProposals` producer seam, exactly as
 * tests/canonical-v2-f28-second-live-fixture-replay.test.js replays its own
 * recording.
 *
 * THE DEFECT THIS REPLAYS THROUGH THE FIX. The live run's own commit message
 * records: 37 of 39 candidates hit CITATION_DISAGREEMENT with
 * derived_citation "III-INTRO(d)" even though the model's own citations
 * (3.7(b) etc.) were correct, because (a) derivation ran ONCE per governed
 * section rather than once per proposal's own evidence span, and (b) the
 * depth tie-break preferred the legacy, straddling lettered node
 * "III-INTRO(d)" over the correct, shallower, minted decimal SECTION "3.7"
 * node. This test asserts the citation-outcome counts observed AFTER the
 * fix, and that the measurement-date claim still resolves correctly
 * (canonical_value 2025-05-02) -- the one thing the pre-fix run already got
 * right, which must not regress.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { sectionizeAdmittedSource, findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { compileFixtureContractV13 } = require('../lib/canonical-v2/contract-bundle');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { parseJSON } = require('../lib/parser-v2/parse-json');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'skechers-first-live-run');
const RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1065837/000119312525112159/d943603dex21.htm';
const EXPECTED_RAW_BYTES_SHA256 = '3a8b8d77c126c85f4402f290da3dec43efa209d6a8a505d11d1af95fab115833';

// ─── Real admission chain, built once for every test in this file (the raw
// HTML fixture -> canonical text conversion is deterministic and somewhat
// expensive; there is no reason to repeat it per-test). ───

function buildRealAdmission() {
  const rawBytes = fs.readFileSync(path.join(FIXTURE_DIR, 'skechers-raw-fetched.htm'));
  const rawBytesSha256 = sha256Hex(rawBytes);
  assert.equal(rawBytesSha256, EXPECTED_RAW_BYTES_SHA256, 'the committed raw HTML fixture must still match the pinned hash in intake-pin.json');

  const retrievalPolicyDigest = sha256Hex(
    'Skechers first live run pinning fetch: User-Agent "precedent-machine research bengoodchild@gmail.com", no redirects followed.',
  );
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: RETRIEVAL_URL,
    final_url: RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-01T12:34:55.229Z',
    retrieval_policy_digest: retrievalPolicyDigest,
    redirect_count: 0,
    response_bytes: rawBytes,
  });

  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  assert.equal(verification.verification_status, 'PASS', 'independent canonical-text verification must PASS');
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

  const dealKey = `deal:skechers-replay-test:${sha256Hex(RETRIEVAL_URL).slice(0, 16)}`;
  const dealAdmissionId = sha256Hex('deal-admission-skechers-replay-test');

  const admittedSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admissionBundle.immutable_source_document,
    source_admission_manifest: admissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });

  return {
    documentHash: admittedSourceContext.document_hash,
    fullText: conversion.canonical_text,
    admittedSourceContext,
  };
}

function loadRecordedResponse() {
  const recorded = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'native-producer-recorded-response.json'), 'utf8'));
  const parsed = parseJSON(recorded.raw_response_text);
  assert.ok(parsed, 'the recorded raw_response_text must still parse as JSON (fence-stripped)');
  return parsed;
}

test('sanity: the recorded Skechers response is still the 39-proposal, section 3.7 response the live run actually produced', () => {
  const recordedParsed = loadRecordedResponse();
  assert.ok(Array.isArray(recordedParsed.representation_instances));
  assert.ok(Array.isArray(recordedParsed.bring_down_conditions));
  assert.ok(Array.isArray(recordedParsed.open_world_candidates));
  const totalLimbs = recordedParsed.representation_instances
    .reduce((sum, inst) => sum + (Array.isArray(inst.limbs) ? inst.limbs.length : 0), 0);
  const totalQualifiers = recordedParsed.representation_instances
    .reduce((sum, inst) => sum + (Array.isArray(inst.qualifiers) ? inst.qualifiers.length : 0), 0);
  const totalBringDownTiers = recordedParsed.bring_down_conditions
    .reduce((sum, cond) => sum + (Array.isArray(cond.tiers) ? cond.tiers.length : 0), 0);
  const totalOpenWorld = recordedParsed.open_world_candidates.length;
  assert.equal(
    totalLimbs + totalQualifiers + totalBringDownTiers + totalOpenWorld,
    39,
    'sanity: 39 total limb + qualifier + bring-down-tier + open-world proposals, matching the run receipt\'s compiled_candidate_count (37 citation-checked + 2 open-world with no section_reference)',
  );
  for (const inst of recordedParsed.representation_instances) {
    assert.ok(/^3\.7\([a-d]\)$/.test(inst.section_reference), `every representation_instance cites a real 3.7(x) subsection, got ${inst.section_reference}`);
  }
});

test('replaying the Skechers recorded raw response through the FIXED citation-derivation pipeline: citation outcomes flip from 37 CITATION_DISAGREEMENT to a strong majority AGREEMENT', async () => {
  const { documentHash, fullText, admittedSourceContext } = buildRealAdmission();

  const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });
  const node37 = findSectionByReference(tree, '3.7');
  assert.ok(node37, 'section "3.7" must resolve against the real Skechers tree');
  assert.equal(node37.kind, 'SECTION');

  // Reproduce the defect's own precondition directly against the REAL tree
  // (not the excerpt fixture): a legacy, non-decimal node whose span
  // straddles/contains "3.7" and is DEEPER than it -- the exact shape the
  // old depth-only tie-break got wrong.
  const straddlingLegacyNodes = tree.nodes.filter((n) => n.section_id !== node37.section_id
    && n.start <= node37.start && node37.end <= n.end && n.depth > node37.depth);
  assert.ok(straddlingLegacyNodes.some((n) => n.reference === 'III-INTRO(d)'), 'sanity: the real Skechers tree still contains the straddling "III-INTRO(d)" node the live run found');

  const recordedParsed = loadRecordedResponse();

  const receipt = await runNativeExtraction({
    source_text: fullText,
    document_hash: documentHash,
    section_references: ['3.7'],
    contract_bundle: compileFixtureContractV13(),
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        recordedParsed,
        governedScope.source_text,
      );
      return {
        provider_id: 'skechers-replay-test/v1',
        model_id: 'claude-sonnet-5 (recorded, Skechers first live run)',
        prompt: 'skechers-replay-test-prompt/v1',
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });

  assert.equal(receipt.evidence_residual_count, 5);
  assert.ok(receipt.evidence_residuals.every((residual) => (
    residual.reason === 'QUALIFIER_GOVERNS_PATH_OCCURRENCE_AMBIGUOUS'
  )));
  assert.equal(receipt.scope_violation_count, 0);

  const statusCounts = {};
  for (const entry of receipt.compiled_candidates) {
    const status = entry.citation_validation ? entry.citation_validation.status : 'NO_CITATION';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  // eslint-disable-next-line no-console
  console.log('[skechers-replay] citation status counts (post-fix):', JSON.stringify(statusCounts), 'total compiled:', receipt.compiled_candidates.length);

  assert.equal(receipt.compiled_candidates.length, 35);
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok === true));

  // THE HEADLINE FLIP: AGREEMENT is now the strong majority outcome (33/35
  // observed), versus the live run's own 37/39 CITATION_DISAGREEMENT. The
  // remaining 2 carry no
  // section_reference at all (NO_CITATION -- nothing to check), not a
  // disagreement. Every derived citation that agrees is a real "3.7(x)"
  // decimal reference, never the legacy straddling node.
  const agreementCount = statusCounts.AGREEMENT || 0;
  assert.equal(agreementCount, 33, `expected the strong majority AGREEMENT count observed in this replay, got ${agreementCount}/35`);
  assert.equal(statusCounts.CITATION_DISAGREEMENT || 0, 0, 'zero CITATION_DISAGREEMENT post-fix, versus the live run\'s own 37');
  assert.ok(
    receipt.compiled_candidates
      .filter((entry) => entry.citation_validation && entry.citation_validation.status === 'AGREEMENT')
      .every((entry) => /^3\.7\(/.test(entry.citation_validation.derived_citation)),
    'every AGREEMENT-status derived citation is a real "3.7(x)" decimal reference',
  );
  assert.ok(
    receipt.compiled_candidates.every((entry) => !entry.citation_validation
      || entry.citation_validation.derived_citation !== 'III-INTRO(d)'),
    'the legacy straddling node "III-INTRO(d)" is never the derived citation for any proposal post-fix',
  );

  // Resolution buckets recomputed under the final code.
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: compileFixtureContractV13(),
    admitted_source_context: admittedSourceContext,
  });
  // eslint-disable-next-line no-console
  console.log('[skechers-replay] resolution buckets (post-fix):', JSON.stringify({
    resolved: resolution.resolved.length,
    review_queue: resolution.review_queue.length,
    open_world: resolution.open_world.length,
    residuals: resolution.residuals.length,
  }));

  // The measurement-date claim still resolves, with the same canonical value
  // the live run itself published -- the fix must not regress the one
  // publishable finding the pre-fix run already got right.
  const measurementDateEntry = resolution.resolved.find(
    (entry) => entry.resolved_claim_definition_key === 'REPRESENTATION_MEASUREMENT_DATE',
  );
  assert.ok(measurementDateEntry, 'the REPRESENTATION_MEASUREMENT_DATE claim still resolves');
  assert.equal(measurementDateEntry.claim.canonical_value, '2025-05-02');
});
