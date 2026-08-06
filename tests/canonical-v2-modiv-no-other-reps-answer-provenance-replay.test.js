'use strict';

/**
 * Regression test for Crash 2 (docs/codex-program/notes/extraction-crashes.md):
 * the NO_OTHER_REPS_FRAUD family's live run against Modiv (section 3.25) died
 * during write-set validation with
 *
 *   CanonicalValidationError: writeSet.claims[<id>].attributes.answer_provenance
 *   is required: this write set originates from the native producer
 *   (write_set_origin: 'NATIVE_PRODUCER').
 *
 * thrown by validateAnswerProvenanceRow (lib/canonical-v2/validate-write-set.js).
 *
 * ROOT CAUSE. candidate-resolution.js's `handleNoOtherRepsCandidate` -- the
 * handler for the NO_OTHER_REPS / NON_RELIANCE / EXTRA_CONTRACTUAL generic
 * claim keys -- builds its claim's final attributes with `rebuildClaim({...,
 * attributesReplace: governedAttributes})`. `attributesReplace` is a full
 * REPLACE, not a merge (see rebuildClaim), and `governedAttributes` never
 * included `answer_provenance`. Every OTHER `attributesReplace` call site in
 * the file (SHARE_COUNT, bring-down tiers, antitrust-regulatory, defined
 * terms) folds `answer_provenance: buildMechanicalAnswerProvenance({...})`
 * into the replacement set; this was the one handler that omitted it, so
 * every claim it resolved published with no answer_provenance attribute at
 * all. resolveCandidates() itself never checks for the field (it is not one
 * of its own gates), so the bad claim sailed through resolution untouched and
 * only surfaced downstream, in validateResolvedCanonicalWriteSet.
 *
 * THE FIX. `handleNoOtherRepsCandidate` now attaches
 * `answer_provenance: buildMechanicalAnswerProvenance({})` -- MECHANICAL, no
 * extra pins, the same tag IOC_RESTRICTION_PRESENT uses immediately above it
 * in the same file: this handler's canonical_value is always the fixed
 * constant `true`, gated only by verbatim quote/attribute checks, never a
 * model judgement call, so MECHANICAL is the correct provenance tag.
 *
 * THIS FILE PROVES: the real recorded model response for Modiv 3.25
 * (evidence/canonical-v2/modiv-no-other-reps-20260806/
 * native-producer-recorded-response-3.25.json), replayed byte-for-byte
 * through sectionizeAdmittedSource -> runNativeExtraction -> resolveCandidates
 * -> buildNativeWriteSet -> validateResolvedCanonicalWriteSet against the
 * committed Modiv HTML fixture, publishes cleanly all the way through
 * validation. Confirmed, before this file's fix landed, to reproduce the
 * exact CanonicalValidationError above.
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
const {
  sectionizeAdmittedSource, findSectionByReference,
} = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { resolveCandidates, buildMechanicalAnswerProvenance } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-no-other-reps-20260806');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const SECTION_REF = '3.25';

const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

// Pinned against evidence/.../section-location-scan.json's own `resolved` entry.
const EXPECTED_SECTION_BOUNDS = {
  start: 144571, end: 148688, heading: /No Other Representations/i,
};

function loadRecordedResponse() {
  const filePath = path.join(EVIDENCE_DIR, `native-producer-recorded-response-${SECTION_REF}.json`);
  const recorded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(typeof recorded.raw_response_text, 'string');
  assert.ok(recorded.raw_response_text.length > 0);
  return recorded;
}

function makeReplayClient(rawResponseText) {
  return {
    messages: {
      async create() {
        return { content: [{ type: 'text', text: rawResponseText }] };
      },
    },
  };
}

let cachedReplay = null;
function runReplay() {
  if (cachedReplay) return cachedReplay;
  cachedReplay = (async () => {
    const recorded = loadRecordedResponse();

    const rawBytes = fs.readFileSync(RAW_HTML_PATH);
    assert.equal(sha256Hex(rawBytes), EXPECTED_RAW_BYTES_SHA256, 'committed Modiv raw HTML must match the pinned hash');

    const capture = buildSecEdgarIntakeCapture({
      retrieval_url: MODIV_RETRIEVAL_URL,
      final_url: MODIV_RETRIEVAL_URL,
      status_code: 200,
      content_type: 'text/html; charset=UTF-8',
      retrieved_at: '2026-08-06T10:29:00.000Z',
      retrieval_policy_digest: sha256Hex('canonical-v2-modiv-no-other-reps-answer-provenance-replay.test.js: reuse of already-admitted raw HTML, no network fetch'),
      redirect_count: 0,
      response_bytes: rawBytes,
    });
    const conversion = convertSecHtmlToCanonicalText(capture);
    assert.equal(conversion.canonical_text_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'canonical text must match the pinned hash');
    const verification = verifySecHtmlCanonicalText({ capture, conversion });
    assert.equal(verification.verification_status, 'PASS');
    const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

    const dealKey = `deal:modiv-no-other-reps-provenance-replay-test:${sha256Hex(MODIV_RETRIEVAL_URL).slice(0, 16)}`;
    const dealAdmissionId = sha256Hex(`deal-admission-modiv-no-other-reps-provenance-replay-test:${MODIV_RETRIEVAL_URL}`);
    const admittedSourceContext = buildAdmittedSemanticSourceContext({
      immutable_source_document: admissionBundle.immutable_source_document,
      source_admission_manifest: admissionBundle.source_admission_manifest,
      semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
      conversion,
      governed_deal_key: dealKey,
      deal_admission_id: dealAdmissionId,
      source_ordinal: 0,
    });
    const documentHash = admittedSourceContext.document_hash;
    const fullText = conversion.canonical_text;

    const tree = sectionizeAdmittedSource({ source_text: fullText, document_hash: documentHash });

    const contractBundle = compileFixtureContractV34();
    const provider = createAnthropicProvider({
      model: 'replay-no-live-call',
      client: makeReplayClient(recorded.raw_response_text),
      maxRetries: 0,
    });

    const receipt = await runNativeExtraction({
      source_text: fullText,
      document_hash: documentHash,
      section_references: [SECTION_REF],
      section_family_assignments: [{ section_reference: SECTION_REF, family_id: 'NO_OTHER_REPS_FRAUD' }],
      contract_bundle: contractBundle,
      definitions: { known_definitions: [] },
      provider,
    });

    const resolution = resolveCandidates({
      run_receipt: receipt,
      contract_vocabulary: contractBundle,
      admitted_source_context: admittedSourceContext,
      agreement_date: '2026-05-03',
    });

    const resolvedRunReceipt = {
      ...receipt,
      compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
    };
    const adapterResult = buildNativeWriteSet({
      run_receipt: resolvedRunReceipt,
      source_text: fullText,
      document_hash: documentHash,
      admitted_source_context: admittedSourceContext,
      resolution,
    });
    const provisionsById = new Map(
      resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
    );
    const writeSet = {
      ...adapterResult.write_set,
      provisions: [...provisionsById.values()],
      components: adapterResult.write_set.components || [],
    };

    // This is the call that crashed before the fix: CanonicalValidationError,
    // writeSet.claims[<id>].attributes.answer_provenance is required. It must
    // now return cleanly.
    const validation = validateResolvedCanonicalWriteSet({
      writeSet, contractBundle, admittedSourceContexts: adapterResult.admitted_source_contexts,
    });

    return {
      tree, receipt, resolution, adapterResult, validation,
    };
  })();
  return cachedReplay;
}

test('sectionizer: the pinned Modiv 3.25 section resolves to the same bytes as the original evidence run', async () => {
  const { tree, receipt } = await runReplay();

  const node = findSectionByReference(tree, SECTION_REF);
  assert.ok(node, 'section 3.25 must resolve against the tree');
  assert.equal(node.kind, 'SECTION');
  assert.equal(node.start, EXPECTED_SECTION_BOUNDS.start);
  assert.equal(node.end, EXPECTED_SECTION_BOUNDS.end);
  assert.match(node.heading, EXPECTED_SECTION_BOUNDS.heading);

  const resolvedSection = receipt.resolved_sections.find((s) => s.section_reference === SECTION_REF);
  assert.ok(resolvedSection);
  assert.equal(resolvedSection.start, EXPECTED_SECTION_BOUNDS.start);
  assert.equal(resolvedSection.end, EXPECTED_SECTION_BOUNDS.end);
});

test('resolveCandidates resolves all three NO_OTHER_REPS disclaimers, each carrying a MECHANICAL answer_provenance', async () => {
  const { resolution } = await runReplay();

  assert.equal(resolution.resolved.length, 3);
  // The exact value the fix attaches, recomputed independently rather than
  // hand-copied, so this assertion tracks the real helper's output even if
  // its pins ever change.
  const expectedProvenance = buildMechanicalAnswerProvenance({});
  for (const entry of resolution.resolved) {
    assert.equal(entry.generic_claim_key, 'NATIVE_NO_OTHER_REPS_DISCLAIMER_CANDIDATE');
    assert.equal(entry.resolved_claim_definition_key, 'NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT');
    // The exact field that was missing before the fix.
    assert.deepEqual(entry.claim.attributes.answer_provenance, expectedProvenance);
  }
});

test('write-set validation no longer throws CanonicalValidationError, and publishes all 3 claims clean', async () => {
  const { adapterResult, validation } = await runReplay();

  assert.equal(adapterResult.write_set.claims.length, 3);
  assert.equal(validation.accepted, true);
  assert.equal(validation.residuals.length, 0);
  assert.equal(validation.quarantines.length, 0);
  assert.ok(validation.publishableWriteSet);
  assert.equal(validation.publishableWriteSet.claims.length, 3);
  for (const claim of validation.publishableWriteSet.claims) {
    assert.ok(claim.attributes.answer_provenance, `claim ${claim.claim_revision_id} must carry answer_provenance`);
  }
});
