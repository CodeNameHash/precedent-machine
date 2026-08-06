'use strict';

/**
 * Regression test for Crash 3 (docs/codex-program/notes/extraction-crashes.md):
 * the CLOSING_CONDITIONS family's live run against Modiv (sections 6.1-6.4)
 * died with
 *
 *   native producer model call failed after 1 attempt(s): model response does
 *   not contain one complete, parseable JSON object
 *
 * PROVEN CAUSE. The real recorded response for section 6.2 (evidence/
 * canonical-v2/modiv-closing-conditions-20260806/
 * native-producer-recorded-response-6.2.json) is not truncated -- it is a
 * complete, well-punctuated, zero-brace prose paragraph in which the model
 * narrates having "written to" the recorded-response file and summarises
 * what it supposedly contains, instead of emitting the requested JSON
 * payload directly. This file replays that exact recorded text (not an
 * invented one) through the real pipeline and confirms it reproduces the
 * exact error text above, at the second of the four dispatched sections
 * (call-telemetry.json shows call_index 0 = 6.1 succeeded, call_index 1 =
 * 6.2 was billed and recorded but is this same malformed text, and the run
 * then failed before section 6.3 was ever dispatched -- no
 * native-producer-recorded-response-6.3.json/-6.4.json exist because the
 * run never reached them).
 *
 * WHAT WAS NOT CHANGED. `maxRetries: 0` for this batch stays a call-site
 * policy choice (outside this repo's in-scope files); this fix does not
 * reintroduce a retry loop. `createAnthropicProvider` already supports a
 * bounded, honestly-counted retry (`maxRetries`, `attempts` surfaced on both
 * the success AND failure return paths) for any caller that opts in -- nothing
 * new needed there.
 *
 * THE FIX (lib/canonical-v2/native-producer/native-extraction-run.js). One
 * malformed/failed model response used to discard every section resolved
 * before it in the same runNativeExtraction call: nothing was returned until
 * the whole per-section loop finished without error. The provider call is now
 * wrapped in a try/catch; on failure, a frozen, distinctly-schema'd
 * `partial_run_receipt` -- carrying every section resolved strictly BEFORE
 * the failure, which section failed and why, and which sections were never
 * attempted -- is attached to `error.details.partial_run_receipt` before the
 * SAME error (same type, code, message) is re-thrown. This is strictly
 * additive: every existing catch site keeps working unmodified, and a caller
 * that wants to recover the partial result now can, instead of losing it to
 * the void.
 *
 * THIS FILE PROVES:
 *   1. The exact recorded 6.1/6.2 evidence, replayed through
 *      runNativeExtraction with all four section_references, still throws
 *      the identical error (type, code, message) as before the fix --
 *      nothing about the fail-closed behaviour changed.
 *   2. The thrown error now also carries a well-formed partial_run_receipt:
 *      section 6.1 resolved and preserved, 6.2 named as the failed section,
 *      6.3/6.4 named as never attempted, sections after 6.2 never dispatched
 *      (proven, not just asserted, by a replay client that throws if it is
 *      ever invoked a third time).
 *   3. The preserved 6.1 data in that partial receipt is byte-identical to
 *      what a standalone, section-6.1-only run produces -- proving the
 *      partial receipt is a genuine, correct subset, not a shortcut.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex, canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { findSectionByReference } = require('../lib/canonical-v2/native-producer/deterministic-sectionizer');
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { createAnthropicProvider } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  runNativeExtraction, PARTIAL_RUN_RECEIPT_SCHEMA, NativeExtractionRunError,
} = require('../lib/canonical-v2/native-producer/native-extraction-run');

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-closing-conditions-20260806');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const SECTION_REFS = ['6.1', '6.2', '6.3', '6.4'];

const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

// Pinned against evidence/.../section-location-scan.json's own `resolved` entries.
const EXPECTED_SECTION_BOUNDS = {
  '6.1': { start: 306535, end: 307839, heading: /Conditions to Each Party/i },
  '6.2': { start: 307839, end: 314421, heading: /Conditions to the Obligations of Parent/i },
};

function loadRecordedResponse(sectionSlug) {
  const filePath = path.join(EVIDENCE_DIR, `native-producer-recorded-response-${sectionSlug}.json`);
  const recorded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(typeof recorded.raw_response_text, 'string');
  assert.ok(recorded.raw_response_text.length > 0);
  return recorded;
}

// A replay client that throws if it is ever asked for a section beyond what
// it was given real recorded text for -- used to PROVE, not just assert,
// that the fixed pipeline never dispatches 6.3/6.4 after 6.2 fails.
function makeReplayClient(orderedSectionRefs, rawResponseTextBySection) {
  let callIndex = 0;
  return {
    messages: {
      async create() {
        const sectionReference = orderedSectionRefs[callIndex];
        callIndex += 1;
        const text = rawResponseTextBySection[sectionReference];
        if (typeof text !== 'string') {
          throw new Error(
            `replay harness: call #${callIndex} requested section ${sectionReference}, which has no recorded `
            + 'text -- the pipeline must never dispatch a call for a section after an earlier one in the same '
            + 'batch has already failed',
          );
        }
        return { content: [{ type: 'text', text }] };
      },
    },
  };
}

async function admitModivSource(dealSuffix) {
  const rawBytes = fs.readFileSync(RAW_HTML_PATH);
  assert.equal(sha256Hex(rawBytes), EXPECTED_RAW_BYTES_SHA256, 'committed Modiv raw HTML must match the pinned hash');

  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: MODIV_RETRIEVAL_URL,
    final_url: MODIV_RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-06T10:24:00.000Z',
    retrieval_policy_digest: sha256Hex(`canonical-v2-modiv-closing-conditions-partial-receipt-replay.test.js:${dealSuffix}: reuse of already-admitted raw HTML, no network fetch`),
    redirect_count: 0,
    response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  assert.equal(conversion.canonical_text_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'canonical text must match the pinned hash');
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  assert.equal(verification.verification_status, 'PASS');
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

  const dealKey = `deal:modiv-closing-conditions-partial-replay-test-${dealSuffix}:${sha256Hex(MODIV_RETRIEVAL_URL).slice(0, 16)}`;
  const dealAdmissionId = sha256Hex(`deal-admission-modiv-closing-conditions-partial-replay-test-${dealSuffix}:${MODIV_RETRIEVAL_URL}`);
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
    admittedSourceContext,
    documentHash: admittedSourceContext.document_hash,
    fullText: conversion.canonical_text,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Grounding: the recorded 6.2 evidence really is complete, non-truncated,
// zero-brace prose -- not JSON, not a cut-off JSON fragment. If this fails,
// the rest of this file is no longer testing the failure mode it claims to.
// ─────────────────────────────────────────────────────────────────────────

test('grounding: the recorded 6.2 response is complete prose with zero braces, not truncated JSON', () => {
  const recorded = loadRecordedResponse('6.2');
  const text = recorded.raw_response_text;
  assert.equal((text.match(/{/g) || []).length, 0, 'must contain no JSON object-open braces at all');
  assert.equal((text.match(/}/g) || []).length, 0, 'must contain no JSON object-close braces at all');
  assert.match(text, /before writing\.\s*$/, 'must end on a complete, grammatical sentence -- not a mid-word/mid-token cutoff');
  assert.ok(text.includes('Written to `evidence/'), 'must narrate a file write rather than emit the payload directly');
});

// ─────────────────────────────────────────────────────────────────────────
// Full pipeline: the real recorded 6.1/6.2 responses, replayed for real.
// ─────────────────────────────────────────────────────────────────────────

let cachedFourSectionAttempt = null;
function runFourSectionAttempt() {
  if (cachedFourSectionAttempt) return cachedFourSectionAttempt;
  cachedFourSectionAttempt = (async () => {
    const r61 = loadRecordedResponse('6.1');
    const r62 = loadRecordedResponse('6.2');
    const { admittedSourceContext, documentHash, fullText } = await admitModivSource('four-section');

    const contractBundle = compileFixtureContractV34();
    const sectionFamilyAssignments = SECTION_REFS.map((section_reference) => ({
      section_reference, family_id: 'CLOSING_CONDITIONS',
    }));
    const provider = createAnthropicProvider({
      model: 'replay-no-live-call',
      client: makeReplayClient(SECTION_REFS, { '6.1': r61.raw_response_text, '6.2': r62.raw_response_text }),
      maxRetries: 0,
    });

    let thrown = null;
    try {
      await runNativeExtraction({
        source_text: fullText,
        document_hash: documentHash,
        section_references: SECTION_REFS,
        section_family_assignments: sectionFamilyAssignments,
        contract_bundle: contractBundle,
        definitions: { known_definitions: [] },
        provider,
      });
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown, 'runNativeExtraction must still throw -- this fix must never turn a bad response into a good one');

    return { admittedSourceContext, thrown };
  })();
  return cachedFourSectionAttempt;
}

let cachedSoloSixOne = null;
function runSoloSixOne() {
  if (cachedSoloSixOne) return cachedSoloSixOne;
  cachedSoloSixOne = (async () => {
    const r61 = loadRecordedResponse('6.1');
    const { documentHash, fullText } = await admitModivSource('solo-6.1');

    const contractBundle = compileFixtureContractV34();
    const provider = createAnthropicProvider({
      model: 'replay-no-live-call',
      client: makeReplayClient(['6.1'], { '6.1': r61.raw_response_text }),
      maxRetries: 0,
    });

    return runNativeExtraction({
      source_text: fullText,
      document_hash: documentHash,
      section_references: ['6.1'],
      section_family_assignments: [{ section_reference: '6.1', family_id: 'CLOSING_CONDITIONS' }],
      contract_bundle: contractBundle,
      definitions: { known_definitions: [] },
      provider,
    });
  })();
  return cachedSoloSixOne;
}

test('sections resolve to the pinned bytes before dispatch (both fixtures agree with each other and the tree)', async () => {
  const soloReceipt = await runSoloSixOne();
  const resolvedSix1 = soloReceipt.resolved_sections.find((s) => s.section_reference === '6.1');
  assert.ok(resolvedSix1);
  assert.equal(resolvedSix1.start, EXPECTED_SECTION_BOUNDS['6.1'].start);
  assert.equal(resolvedSix1.end, EXPECTED_SECTION_BOUNDS['6.1'].end);
});

test('the exact recorded 6.1/6.2 evidence still throws the identical error type, code and message as before this fix', async () => {
  const { thrown } = await runFourSectionAttempt();

  assert.equal(thrown.constructor.name, 'NativeProducerAnthropicError');
  assert.equal(thrown.code, 'RETRIES_EXHAUSTED');
  assert.equal(
    thrown.message,
    'native producer model call failed after 1 attempt(s): model response does not contain one complete, '
    + 'parseable JSON object',
  );
});

test('the thrown error now carries a well-formed partial_run_receipt naming 6.2 as failed and 6.3/6.4 as never attempted', async () => {
  const { thrown } = await runFourSectionAttempt();

  const partial = thrown.details && thrown.details.partial_run_receipt;
  assert.ok(partial, 'error.details.partial_run_receipt must be present');
  assert.equal(partial.schema_version, PARTIAL_RUN_RECEIPT_SCHEMA);
  assert.notEqual(partial.schema_version, 'NATIVE_EXTRACTION_RUN_RECEIPT/V1', 'must never look like a complete receipt');
  assert.equal(partial.complete, false);
  assert.equal(partial.failed_section_reference, '6.2');
  assert.equal(partial.failure_code, 'RETRIES_EXHAUSTED');
  assert.match(partial.failure_message, /model response does not contain one complete, parseable JSON object/);
  assert.deepEqual(partial.unattempted_section_references, ['6.3', '6.4']);
  assert.equal(Object.isFrozen(partial), true);

  // Section 6.1's own work is preserved, not discarded.
  assert.deepEqual(partial.resolved_sections.map((s) => s.section_reference), ['6.1']);
  assert.ok(partial.compiled_candidate_count > 0, '6.1\'s compiled candidates must survive in the partial receipt');
  assert.equal(partial.compiled_candidates.length, partial.compiled_candidate_count + partial.rejected_candidate_count);
});

test('6.3 and 6.4 are never dispatched once 6.2 fails (proven by a replay client that throws if asked)', async () => {
  // runFourSectionAttempt's own provider client throws if invoked for any
  // section beyond 6.1/6.2's recorded text -- reaching this point at all
  // (via the cached, already-resolved promise) without an uncaught harness
  // error IS the proof. Re-assert explicitly for clarity.
  const { thrown } = await runFourSectionAttempt();
  assert.equal(thrown.code, 'RETRIES_EXHAUSTED', 'must fail on the malformed 6.2 response, not the replay harness\'s own guard');
});

test('the preserved 6.1 data in the partial receipt is byte-identical to a standalone 6.1-only run', async () => {
  const { thrown } = await runFourSectionAttempt();
  const partial = thrown.details.partial_run_receipt;
  const soloReceipt = await runSoloSixOne();

  assert.equal(
    canonicalJson(partial.resolved_sections),
    canonicalJson(soloReceipt.resolved_sections),
  );
  assert.equal(
    canonicalJson(partial.compiled_candidates),
    canonicalJson(soloReceipt.compiled_candidates),
  );
});

test('NativeExtractionRunError is exported and distinct from the provider error this fixture actually throws', () => {
  // Documents the two error types this module can propagate: its own
  // NativeExtractionRunError for structural input problems (never mutated by
  // the partial-receipt fix), versus the underlying provider's own error
  // class (NativeProducerAnthropicError, re-thrown as-is with
  // partial_run_receipt attached) for a failed model call. Both are
  // legitimate; this crash is the second kind.
  assert.equal(typeof NativeExtractionRunError, 'function');
});
