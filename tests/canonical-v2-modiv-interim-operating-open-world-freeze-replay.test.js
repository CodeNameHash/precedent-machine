'use strict';

/**
 * Regression test for Crash 1 (docs/codex-program/notes/extraction-crashes.md):
 * the INTERIM_OPERATING family's live run against Modiv (section 5.1) died with
 *
 *   TypeError: Cannot assign to read only property '0' of object '[object Array]'
 *
 * at candidate-resolution.js's `openWorld.splice(0, openWorld.length,
 * ...iocMechanicResolution.open_world)`.
 *
 * ROOT CAUSE. `resolveSoleRemedyOpenWorld` (sole-remedy-resolution.js) and
 * `resolveIocMechanics` (ioc-mechanic-resolution.js) each have a "disabled"
 * early-return branch (vocabulary does not support sole remedy; no IOC-surface
 * items present) that used to return `open_world: openWorld` -- the CALLER's
 * own live array, passed straight through by reference, not a copy. Both
 * functions wrap their whole return value in a recursive `freeze()` helper
 * that calls `Object.freeze()` on every array/object it finds, including
 * `open_world`. Passed the caller's own array by reference, that call froze
 * candidate-resolution.js's own `openWorld` in place. The freeze itself never
 * threw (`compileFixtureContractV34()` never registers the sole-remedy
 * concept, so `resolveSoleRemedyOpenWorld`'s disabled branch -- and hence this
 * accidental freeze of the CALLER's `openWorld` -- fires on every single
 * family's resolveCandidates() run, not just INTERIM_OPERATING's). It only
 * crashes downstream, the next time something tries to WRITE into that same
 * array. INTERIM_OPERATING is the only family whose section text produces
 * IOC-surface open_world items, so it is the only family whose
 * `resolveIocMechanics` call is ever `enabled: true` -- the only family whose
 * own code then attempts `openWorld.splice(...)` a second time, on an array
 * silently frozen out from under it by the unrelated sole-remedy step above.
 *
 * THE FIX. Both disabled branches now return `open_world: [...openWorld]`, a
 * fresh copy -- exactly what their own `enabled: true` branches already do
 * (`retainedOpenWorld` / `nextOpenWorld`, both freshly built arrays, never the
 * caller's own). freeze() then only ever freezes a copy, never the live array
 * still being mutated by resolveCandidates().
 *
 * THIS FILE PROVES TWO THINGS:
 *   1. (unit-level) the exact aliasing mechanism is fixed: neither disabled
 *      branch hands back the caller's own array, and the caller's array is
 *      never frozen as a side effect of calling either function.
 *   2. (full-pipeline replay) the real recorded model response for Modiv
 *      5.1 (evidence/canonical-v2/modiv-interim-operating-20260806/
 *      native-producer-recorded-response-5.1.json), replayed byte-for-byte
 *      through sectionizeAdmittedSource -> runNativeExtraction ->
 *      resolveCandidates against the committed Modiv HTML fixture, no longer
 *      throws, and pins the resulting counts.
 *
 * Both were confirmed, before this file's fix landed, to reproduce the exact
 * crash: TypeError: Cannot assign to read only property '0' of object
 * '[object Array]', at candidate-resolution.js:9522 (the IOC splice).
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
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { resolveSoleRemedyOpenWorld } = require('../lib/canonical-v2/native-producer/sole-remedy-resolution');
const { resolveIocMechanics } = require('../lib/canonical-v2/native-producer/ioc-mechanic-resolution');

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-interim-operating-20260806');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const SECTION_REF = '5.1';

// Independently pinned against evidence/.../source-reference.json -- this
// test does not trust that file, it re-derives and compares.
const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

// Pinned against evidence/.../section-location-scan.json's own `resolved` entry.
const EXPECTED_SECTION_BOUNDS = {
  start: 197207, end: 220216, heading: /Conduct of Business/i,
};

// ─────────────────────────────────────────────────────────────────────────
// Unit-level: the exact aliasing mechanism, isolated from the full pipeline.
// ─────────────────────────────────────────────────────────────────────────

test('resolveSoleRemedyOpenWorld disabled branch never hands back the caller\'s own open_world array', () => {
  const openWorld = [Object.freeze({ id: 'unrelated-open-world-item' })];
  const result = resolveSoleRemedyOpenWorld({
    open_world: openWorld,
    resolved_sections: [],
    admitted_source_context: { canonical_text: { text: 'irrelevant section text' } },
    // No REM-SOLE concept/claim definitions registered -> disabled branch,
    // exactly like every real contract bundle in this repo today
    // (compileFixtureContractV34() included -- see the file header).
    contract_vocabulary: { concepts: [], claim_definitions: [] },
  });
  assert.equal(result.enabled, false);
  assert.notEqual(result.open_world, openWorld, 'must return a fresh array, never the caller\'s own reference');
  assert.deepEqual([...result.open_world], [...openWorld], 'the copy must still carry the same elements');
  assert.equal(Object.isFrozen(openWorld), false, 'the CALLER\'s own array must not be frozen as a side effect');
  // This is the exact operation candidate-resolution.js performs immediately
  // afterward (openWorld.splice(...)) -- proving it no longer throws proves
  // the fix, not just that isFrozen() reports false.
  assert.doesNotThrow(() => { openWorld.splice(0, openWorld.length, { id: 'replacement' }); });
});

test('resolveIocMechanics disabled branch never hands back the caller\'s own open_world array', () => {
  const openWorld = [{
    claim_definition_key: 'SOME_OTHER_CLAIM_KEY', // not an IOC mechanic -> disabled branch
    attributes: {},
  }];
  const result = resolveIocMechanics({
    open_world: openWorld,
    resolved: [],
    ioc_restriction_components: [],
    resolved_sections: [],
    admitted_source_context: { canonical_text: { text: 'irrelevant section text' } },
  });
  assert.equal(result.enabled, false);
  assert.notEqual(result.open_world, openWorld, 'must return a fresh array, never the caller\'s own reference');
  assert.deepEqual([...result.open_world], [...openWorld], 'the copy must still carry the same elements');
  assert.equal(Object.isFrozen(openWorld), false, 'the CALLER\'s own array must not be frozen as a side effect');
  assert.doesNotThrow(() => { openWorld.splice(0, openWorld.length, { id: 'replacement' }); });
});

// ─────────────────────────────────────────────────────────────────────────
// Full pipeline: the real recorded Modiv 5.1 response, replayed for real.
// ─────────────────────────────────────────────────────────────────────────

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
      retrieved_at: '2026-08-06T10:30:00.000Z',
      retrieval_policy_digest: sha256Hex('canonical-v2-modiv-interim-operating-open-world-freeze-replay.test.js: reuse of already-admitted raw HTML, no network fetch'),
      redirect_count: 0,
      response_bytes: rawBytes,
    });
    const conversion = convertSecHtmlToCanonicalText(capture);
    assert.equal(conversion.canonical_text_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'canonical text must match the pinned hash');
    const verification = verifySecHtmlCanonicalText({ capture, conversion });
    assert.equal(verification.verification_status, 'PASS');
    const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

    const dealKey = `deal:modiv-interim-operating-freeze-replay-test:${sha256Hex(MODIV_RETRIEVAL_URL).slice(0, 16)}`;
    const dealAdmissionId = sha256Hex(`deal-admission-modiv-interim-operating-freeze-replay-test:${MODIV_RETRIEVAL_URL}`);
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
      section_family_assignments: [{ section_reference: SECTION_REF, family_id: 'INTERIM_OPERATING', covenant_side: 'TARGET' }],
      contract_bundle: contractBundle,
      definitions: { known_definitions: [] },
      provider,
    });

    // This is the call that crashed before the fix: TypeError: Cannot assign
    // to read only property '0' of object '[object Array]', at
    // candidate-resolution.js's openWorld.splice(...) inside the IOC-mechanic
    // wiring. It must now return cleanly.
    const resolution = resolveCandidates({
      run_receipt: receipt,
      contract_vocabulary: contractBundle,
      admitted_source_context: admittedSourceContext,
      agreement_date: '2026-05-03',
    });

    return { tree, receipt, resolution };
  })();
  return cachedReplay;
}

test('sectionizer: the pinned Modiv 5.1 section resolves to the same bytes as the original evidence run', async () => {
  const { tree, receipt } = await runReplay();

  const node = findSectionByReference(tree, SECTION_REF);
  assert.ok(node, 'section 5.1 must resolve against the tree');
  assert.equal(node.kind, 'SECTION');
  assert.equal(node.start, EXPECTED_SECTION_BOUNDS.start);
  assert.equal(node.end, EXPECTED_SECTION_BOUNDS.end);
  assert.match(node.heading, EXPECTED_SECTION_BOUNDS.heading);

  const resolvedSection = receipt.resolved_sections.find((s) => s.section_reference === SECTION_REF);
  assert.ok(resolvedSection);
  assert.equal(resolvedSection.start, EXPECTED_SECTION_BOUNDS.start);
  assert.equal(resolvedSection.end, EXPECTED_SECTION_BOUNDS.end);
});

test('resolveCandidates no longer throws on the real Modiv 5.1 IOC response, and resolves cleanly', async () => {
  const { resolution } = await runReplay();

  assert.equal(resolution.resolution_receipt.ioc_mechanic_resolution_schema, 'NATIVE_IOC_MECHANIC_RESOLUTION/V1');
  // Measured against this exact fixture with both fixes applied -- see the
  // file header. Not a guess: re-derive by re-running this file if the
  // upstream fixture, prompt, or resolver logic ever legitimately changes.
  // Re-measured after Step 2X-I (IOC V1×25 category corroboration rewrite):
  // the second-chance vocabulary path is gone; parent/child IOC attachment
  // scope is enforced directly against the widened V25 concept set. On this
  // same recorded Modiv 5.1 response every IOC mechanic row now queues or
  // open-worlds with IOC_PARENT_ATTACHMENT_* / IOC_ATTACHMENT_* reasons
  // instead of resolving (15 -> 0 resolved; 54 -> 37 review; 46 -> 64
  // open_world). The crash-regression property under test is unchanged: the
  // IOC splice path still runs (`enabled: true`) and must not throw.
  assert.equal(resolution.resolved.length, 0);
  assert.equal(resolution.review_queue.length, 37);
  assert.equal(resolution.open_world.length, 64);
  // The specific mechanism that crashed: IOC mechanic items must actually be
  // present in open_world (i.e. this fixture genuinely exercises the
  // resolveIocMechanics `enabled: true` path -- the ONLY path that performs
  // the second openWorld.splice() that used to crash). If this assertion
  // ever fails, the rest of this test is no longer proving anything about
  // Crash 1.
  const iocItems = resolution.open_world.filter((item) => (
    item.attributes?.structured_mechanic?.numeric_resolution !== undefined
  ));
  assert.ok(iocItems.length > 0, 'this fixture must carry at least one IOC-mechanic open_world item');
});
