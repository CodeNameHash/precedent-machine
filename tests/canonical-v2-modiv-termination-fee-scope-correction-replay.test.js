'use strict';

/**
 * P1-PLAN.md Part 7's outstanding deliverable: "Build a single regression
 * test now that loads all three of tonight's recorded responses plus the
 * committed HTML fixture and runs them through sectionize -> resolve ->
 * validate with each fix applied, asserting the new expected counts."
 * Lane SEC's half of that already exists
 * (tests/canonical-v2-native-sectionizer.test.js). This is Lane RES's half.
 *
 * WHAT THIS PROVES. All three recorded responses in
 * evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/
 * (native-producer-recorded-response-7.1.json, -7.3.json, -8.12.json) are
 * replayed, byte-for-byte, through the REAL pipeline -- sectionizeAdmittedSource,
 * runNativeExtraction (via createAnthropicProvider, so JSON-fence-stripping and
 * response-shape validation run exactly as they do live), resolveCandidates,
 * buildNativeWriteSet, and validateResolvedCanonicalWriteSet -- against the
 * committed Modiv HTML fixture (tests/fixtures/canonical-v2/mae-definition-family/
 * modiv-raw-fetched.htm). No network call, no live model call: the "model" is a
 * canned client whose messages.create returns each recorded raw_response_text in
 * section order. Every count below was read off a real run of this file, never
 * copied from a plan document -- see the discrepancy notes inline where a
 * measured number disagrees with docs/codex-program/P1-PLAN.md.
 *
 * WHAT THIS DOES NOT PROVE -- THE PROMPT-VERSION TRAP. The three recorded
 * responses were produced under termination-fee-producer-prompt.js
 * PROMPT_VERSION 1 (2026-08-05, see each fixture's own "note" field). That
 * prompt module is now at PROMPT_VERSION 3: version 2 requires every limb of a
 * split, conditional defined-term amount to quote its WHOLE defining sentence
 * (not a fragment); version 3 adds an optional limb_amount_quote field naming
 * which dollar figure in that whole-sentence quote belongs to which limb. The
 * grounding test below confirms mechanically that none of the three recorded
 * responses contains the string "limb_amount_quote" -- they cannot, a
 * PROMPT_VERSION-1 response predates the field by two prompt revisions. That
 * means this file measures ONE thing only: what TODAY's resolver does with
 * YESTERDAY's extraction shape. It is a real, worthwhile regression pin --
 * this is genuinely what would run if these exact three responses were
 * replayed again tomorrow -- but it is NOT a prediction of what a fresh model
 * call under PROMPT_VERSION 3 would produce, and nothing here should be read
 * as evidence either way about whether a live model will populate
 * limb_amount_quote correctly. Any future edit to this file that regenerates
 * the fixtures under a newer prompt must also rewrite every count below from a
 * fresh measurement, not adjust them to keep the file passing.
 *
 * A SEPARATE TRAP THIS FILE DELIBERATELY DOES NOT WALK INTO. P1-PLAN.md Part 7
 * describes RES1's "done when" as a five-way replay of 7.3's bare-citation
 * triggers with a "corrected mixed outcome": one resolves, two route
 * AMBIGUOUS_TRIGGER_CORROBORATION, two stay TRIGGER_UNCORROBORATED -- via
 * citation-following (looking up the section a bare cross-reference names and
 * running the trigger table against ITS text). That citation-following half of
 * RES1 has NOT landed as of this test (confirmed by reading
 * candidate-resolution.js in full: handleFeeTriggerCandidate never calls
 * findSectionByReference or reads any section other than the candidate's own).
 * Only the OTHER half of RES1 has landed: handleFeeTriggerCandidate now refuses
 * to resolve a single incidental pattern match unless the model's own asserted
 * trigger_code agrees with it (TRIGGER_NOT_ASSERTED / TRIGGER_CORROBORATION_DISAGREES,
 * see docs/codex-program/notes/trigger-override-fix.md). So this file measures,
 * and asserts, that all five of 7.3's bare-citation triggers still resolve
 * nothing -- four stay TRIGGER_UNCORROBORATED and the fifth (which incidentally
 * matches exactly one code) now correctly stays unresolved too, typed
 * TRIGGER_NOT_ASSERTED instead of publishing. That is the correct, current
 * measured state, not a shortfall of this test: it would be wrong for this file
 * to assert Part 7's "mixed outcome" prediction, because that outcome belongs to
 * a feature that has not been built yet.
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
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-termination-fee-scope-correction-20260805');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const SECTION_REFS = ['7.1', '7.3', '8.12'];

// Independently pinned against evidence/.../source-reference.json and
// scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs's own
// EXPECTED_RAW_BYTES_SHA256 / EXPECTED_CANONICAL_TEXT_SHA256 constants -- this
// test does not trust either file, it re-derives and compares.
const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

// Pinned against the sectionizer's own resolution this session, cross-checked
// against BOTH run-manifest.json's own header comment AND the OLD (pre-fix)
// run-receipt.json's resolved_sections -- byte-identical in all three places,
// which is the direct evidence for this file's claim that only the resolver,
// not the sectionizer, changed behaviour on Modiv between the recorded run and
// today (P1-PLAN.md Lane SEC: SEC1's article-chapeau fix does not reach Modiv,
// because Modiv's own sections use the blank-line-anchored heading style the
// base classifier already handles).
const EXPECTED_SECTION_BOUNDS = {
  '7.1': { start: 321761, end: 331500, heading: /Termination/i },
  '7.3': { start: 333615, end: 340109, heading: /Fees/i },
  '8.12': { start: 360030, end: 414712, heading: /Definitions/i },
};

function loadRecordedResponseFile(sectionSlug) {
  const filePath = path.join(EVIDENCE_DIR, `native-producer-recorded-response-${sectionSlug}.json`);
  const recorded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(typeof recorded.raw_response_text, 'string', `${sectionSlug}: raw_response_text must be a string`);
  assert.ok(recorded.raw_response_text.length > 0, `${sectionSlug}: raw_response_text must be non-empty`);
  return recorded;
}

// Used ONLY by the grounding test below, to inspect the fixture's own raw
// shape independently of the real pipeline (which does its own, separate,
// unexported fence-stripping inside anthropic-provider.js's
// extractSingleJsonObject -- this local helper is deliberately not a
// dependency of the main replay below, just a direct check on the fixture).
function stripFenceAndParse(rawResponseText) {
  const stripped = rawResponseText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  return JSON.parse(stripped);
}

function makeReplayClient(orderedSectionRefs, rawResponseTextBySection) {
  let callIndex = 0;
  return {
    messages: {
      async create() {
        const sectionReference = orderedSectionRefs[callIndex];
        callIndex += 1;
        const text = rawResponseTextBySection[sectionReference];
        assert.ok(typeof text === 'string' && text.length > 0, `no recorded raw_response_text for section ${sectionReference}`);
        return { content: [{ type: 'text', text }] };
      },
    },
  };
}

// The full sectionize -> extract -> resolve -> write-set -> validate pipeline,
// run exactly once and memoized: every test below reads a different slice of
// the SAME real run rather than re-deriving it, so a failure in one assertion
// block cannot be explained by a different run than the others saw.
let cachedReplay = null;
function runReplay() {
  if (cachedReplay) return cachedReplay;
  cachedReplay = (async () => {
    const recordedFiles = {
      '7.1': loadRecordedResponseFile('7.1'),
      '7.3': loadRecordedResponseFile('7.3'),
      '8.12': loadRecordedResponseFile('8.12'),
    };
    const rawResponseTextBySection = Object.fromEntries(
      Object.entries(recordedFiles).map(([ref, recorded]) => [ref, recorded.raw_response_text]),
    );

    const rawBytes = fs.readFileSync(RAW_HTML_PATH);
    assert.equal(sha256Hex(rawBytes), EXPECTED_RAW_BYTES_SHA256, 'committed Modiv raw HTML must match the pinned hash');

    const capture = buildSecEdgarIntakeCapture({
      retrieval_url: MODIV_RETRIEVAL_URL,
      final_url: MODIV_RETRIEVAL_URL,
      status_code: 200,
      content_type: 'text/html; charset=UTF-8',
      retrieved_at: '2026-08-05T23:00:00.000Z',
      retrieval_policy_digest: sha256Hex('canonical-v2-modiv-termination-fee-scope-correction-replay.test.js: reuse of already-admitted raw HTML, no network fetch'),
      redirect_count: 0,
      response_bytes: rawBytes,
    });
    const conversion = convertSecHtmlToCanonicalText(capture);
    assert.equal(conversion.canonical_text_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'canonical text must match the pinned hash');
    const verification = verifySecHtmlCanonicalText({ capture, conversion });
    assert.equal(verification.verification_status, 'PASS');
    const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

    const dealKey = `deal:modiv-termfee-scope-replay-test:${sha256Hex(MODIV_RETRIEVAL_URL).slice(0, 16)}`;
    const dealAdmissionId = sha256Hex(`deal-admission-modiv-termfee-scope-replay-test:${MODIV_RETRIEVAL_URL}`);
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
    const sectionFamilyAssignments = SECTION_REFS.map((section_reference) => ({
      section_reference, family_id: 'TERMINATION_FEE',
    }));
    const provider = createAnthropicProvider({
      model: 'replay-no-live-call',
      client: makeReplayClient(SECTION_REFS, rawResponseTextBySection),
      maxRetries: 0,
    });

    const receipt = await runNativeExtraction({
      source_text: fullText,
      document_hash: documentHash,
      section_references: SECTION_REFS,
      section_family_assignments: sectionFamilyAssignments,
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
    const validation = validateResolvedCanonicalWriteSet({
      writeSet, contractBundle, admittedSourceContexts: adapterResult.admitted_source_contexts,
    });

    return {
      recordedFiles, tree, receipt, resolution, adapterResult, validation,
    };
  })();
  return cachedReplay;
}

// Groups review_queue entries the same way a reviewer would need to: which
// claim shape, which side/concept, and the exact reason set -- not just a
// bare count, so a claim resolving for the WRONG reason (right total, wrong
// composition) cannot hide inside a passing length assertion.
function tallyReviewQueueByClaimConceptAndReasons(reviewQueue) {
  const tally = {};
  for (const item of reviewQueue) {
    const key = `${item.generic_claim_key}|${item.concept_key}|${JSON.stringify(item.reasons)}`;
    tally[key] = (tally[key] || 0) + 1;
  }
  return tally;
}

// ─────────────────────────────────────────────────────────────────────────
// Grounding: the fixtures this file replays really are what the header
// comment says they are. If this test ever fails, every other test in this
// file is measuring something other than what its own comments claim.
// ─────────────────────────────────────────────────────────────────────────

test('grounding: all three recorded responses predate limb_amount_quote (PROMPT_VERSION 1, not 2 or 3)', () => {
  for (const slug of ['7.1', '7.3', '8.12']) {
    const recorded = loadRecordedResponseFile(slug);
    assert.ok(
      !recorded.raw_response_text.includes('limb_amount_quote'),
      `${slug}: recorded raw_response_text must not mention limb_amount_quote -- if this fails, the fixture `
      + 'has been regenerated under PROMPT_VERSION 3 and this whole file\'s "yesterday\'s extraction" premise no longer holds',
    );
  }
});

test('grounding: all six of 7.3\'s recorded trigger assertions carry trigger_code: null, confirmed not assumed', () => {
  const recorded73 = loadRecordedResponseFile('7.3');
  const parsed = stripFenceAndParse(recorded73.raw_response_text);
  assert.equal(parsed.fee_trigger_assertions.length, 6);
  assert.ok(
    parsed.fee_trigger_assertions.every((assertion) => assertion.trigger_code === null),
    'every one of 7.3\'s six fee_trigger_assertions must carry trigger_code: null -- this is the exact shape '
    + 'docs/codex-program/notes/trigger-override-fix.md and P1-PLAN.md Part 6 RES1 both depend on',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Sectionizer: confirms Modiv's tree is untouched, so everything measured
// below isolates resolver behaviour, not a moving section boundary.
// ─────────────────────────────────────────────────────────────────────────

test('sectionizer: the three pinned Modiv sections resolve to the same bytes before AND after dispatch', async () => {
  const { tree, receipt } = await runReplay();

  for (const ref of SECTION_REFS) {
    const expected = EXPECTED_SECTION_BOUNDS[ref];
    const node = findSectionByReference(tree, ref);
    assert.ok(node, `section ${ref} must resolve against the tree`);
    assert.equal(node.kind, 'SECTION');
    assert.equal(node.start, expected.start, `section ${ref} start`);
    assert.equal(node.end, expected.end, `section ${ref} end`);
    assert.match(node.heading, expected.heading, `section ${ref} heading`);

    const resolvedSection = receipt.resolved_sections.find((s) => s.section_reference === ref);
    assert.ok(resolvedSection, `receipt must carry a resolved_sections entry for ${ref}`);
    assert.equal(resolvedSection.start, expected.start);
    assert.equal(resolvedSection.end, expected.end);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Extraction receipt: pins that compilation/citation behaviour is unchanged
// from the original evidence run (evidence/.../run-receipt.json), so the
// counts below are attributable to the resolver fixes alone.
// ─────────────────────────────────────────────────────────────────────────

test('extraction receipt: compiled-candidate and residual counts match the original evidence run exactly', async () => {
  const { receipt } = await runReplay();

  assert.equal(receipt.compiled_candidate_count, 32);
  assert.equal(receipt.rejected_candidate_count, 0);
  assert.equal(receipt.evidence_residual_count, 0);
  assert.equal(receipt.scope_violation_count, 0);
  assert.equal(receipt.citation_residual_count, 0);
  assert.equal(receipt.undispatched_section_count, 0);
});

// ─────────────────────────────────────────────────────────────────────────
// Resolution: the counts this test exists to pin. Every number below was
// read off a real run (see the header comment) -- P1-PLAN.md Part 3's
// original count (14 of 16 review_queue entries were resolver-narrowness,
// 2 of 16 were already-resolved mirrors) describes the OLD, pre-fix code
// against this same fixture; the numbers here are the NEW, post-fix code
// against the identical fixture, measured today.
// ─────────────────────────────────────────────────────────────────────────

test('resolution: exactly 3 claims resolve -- the tail period and both fee amounts, never a trigger', async () => {
  const { resolution } = await runReplay();

  assert.equal(resolution.resolved.length, 3);
  assert.equal(
    resolution.resolved.filter((e) => e.generic_claim_key === 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE').length,
    0,
    'no trigger claim may resolve against this fixture -- the pre-fix code resolved exactly one '
    + '(STOCKHOLDER_APPROVAL_FAILURE_TERMINATION, the published-wrong-answer bug), and this is the regression pin for its absence',
  );

  const tailClaim = resolution.resolved.find((e) => e.generic_claim_key === 'NATIVE_TERMINATION_FEE_TAIL_PERIOD_CANDIDATE');
  assert.ok(tailClaim);
  assert.equal(tailClaim.concept_key, 'TERMF-TAIL');
  assert.equal(tailClaim.claim.claim_definition_key, 'TERMINATION_FEE_TAIL_PERIOD_MONTHS');
  assert.equal(tailClaim.claim.canonical_value, '12');

  const amountClaims = resolution.resolved.filter((e) => e.generic_claim_key === 'NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE');
  assert.equal(amountClaims.length, 2);

  const sellerAmount = amountClaims.find((e) => e.concept_key === 'TERMF-TARGET');
  assert.ok(sellerAmount, 'the "Company Base Amount" (x)-limb must resolve SELLER/10000000');
  assert.equal(sellerAmount.claim.canonical_value, '10000000');
  assert.equal(sellerAmount.claim.attributes.fee_side, 'SELLER');
  assert.equal(sellerAmount.claim.attributes.fee_term_ref, 'Company Base Amount');
  assert.equal(sellerAmount.claim.attributes.payer_party, 'the Company');
  assert.equal(
    'limb_amount_disambiguated' in sellerAmount.claim.attributes, false,
    'this claim\'s quote carries exactly one dollar figure -- resolveFeeAmount\'s limb_amount_quote fallback must never fire',
  );

  const buyerAmount = amountClaims.find((e) => e.concept_key === 'TERMF-REVERSE');
  assert.ok(buyerAmount, '"Parent Base Amount" must resolve BUYER/15000000.00');
  assert.equal(buyerAmount.claim.canonical_value, '15000000.00');
  assert.equal(buyerAmount.claim.attributes.fee_side, 'BUYER');
  assert.equal(buyerAmount.claim.attributes.fee_term_ref, 'Parent Base Amount');
  assert.equal(buyerAmount.claim.attributes.payer_party, 'Parent');
  assert.equal(
    'limb_amount_disambiguated' in buyerAmount.claim.attributes, false,
    'this claim\'s quote carries exactly one dollar figure -- resolveFeeAmount\'s limb_amount_quote fallback must never fire',
  );
});

test('resolution: review_queue is 16 items, with the exact reason-code x concept-key composition', async () => {
  const { resolution } = await runReplay();

  assert.equal(resolution.review_queue.length, 16);

  const tally = tallyReviewQueueByClaimConceptAndReasons(resolution.review_queue);
  assert.deepEqual(tally, {
    // Six FEE_SIDE_UNCORROBORATED trigger candidates: the five bare
    // "Section 7.3(b)(x)" cross-reference fragments from 8.12, PLUS Section
    // 7.1(c)(i)'s Superior Proposal ground (P1-PLAN.md Part 2.3's
    // "fourteenth" residual, confirmed here by its own source_citation:
    // "7.1(c)(i)"). All six share the same underlying cause:
    // feeSideFromFullPaymentContext scans only the candidate's own
    // dispatched section, and none of these six quotes carries
    // payment-direction language of its own.
    'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE|TERMF-PENDING|["FEE_SIDE_UNCORROBORATED"]': 6,
    // Mirrors of the 3 resolved claims: review_queue carries every resolved
    // claim too (has_resolution: true, reasons: []), not just rejections --
    // see the header comment's own note on this shape.
    'NATIVE_TERMINATION_FEE_TAIL_PERIOD_CANDIDATE|TERMF-TAIL|[]': 1,
    'NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE|TERMF-REVERSE|[]': 1,
    'NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE|TERMF-TARGET|[]': 1,
    // The five genuinely bare "by Parent pursuant to Section 7.1(d)(ii)"-shaped
    // quotes from 7.3: zero trigger-code patterns match their own text at all
    // (citation-following, which would look up 7.1's own text, has not landed
    // -- see the header comment's second trap note). Split TERMF-TARGET/
    // TERMF-REVERSE by the fee_side the model asserted on each.
    'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE|TERMF-TARGET|["TRIGGER_UNCORROBORATED"]': 4,
    'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE|TERMF-REVERSE|["TRIGGER_UNCORROBORATED"]': 1,
    // The sixth 7.3 trigger quote (the compound "Stockholders' Meeting" one):
    // model asserted trigger_code: null, exactly one pattern matches
    // incidentally -- this is the live bug docs/codex-program/notes/
    // trigger-override-fix.md fixed. Must route to review, never resolve.
    'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE|TERMF-TARGET|["TRIGGER_NOT_ASSERTED"]': 1,
    // The 8.12 (y)-limb amount ($15,000,000.00 "if payable pursuant to
    // Section 7.3(b)(iv) or Section 7.3(b)(v)"): now correctly corroborates
    // SELLER via the new fee_term_ref fallback (concept TERMF-TARGET, not
    // TERMF-PENDING), then honestly fails the separate, unchanged
    // claim.raw_value.includes(feeTermRef) gate, because "Company Base
    // Amount" never appears in this limb's own quote, only its sibling's.
    'NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE|TERMF-TARGET|["FEE_TERM_NOT_IN_QUOTE"]': 1,
  });
});

test('resolution: open_world and the Modiv REIT-cap side channel are unaffected by the resolver fixes', async () => {
  const { resolution } = await runReplay();

  // 12 raw open_world_candidates (1 from 7.1 + 3 from 7.3 + 8 from 8.12) plus
  // 7.3's 4 wave_b_mechanics entries, which resolveCandidates also routes
  // into open_world as evidence-only by design (P1-PLAN.md Part 4).
  assert.equal(resolution.open_world.length, 16);
  assert.equal(resolution.residuals.length, 0);
  // resolveModivConditionalFees runs unconditionally and is untouched by any
  // of today's fixes (RES1/RES2 are candidate-resolution.js's ordinary
  // per-claim handlers; the Modiv REIT-cap side channel is a separate code
  // path entirely) -- unchanged from the original evidence run's own count.
  assert.equal((resolution.conditional_termination_fee_values || []).length, 6);
});

// ─────────────────────────────────────────────────────────────────────────
// Validate-write-set: the 3 resolved claims are not just "resolved" in the
// resolver's own bookkeeping, they clear the governed write-set validator
// cleanly, with zero residuals and zero quarantines.
// ─────────────────────────────────────────────────────────────────────────

test('validation: all 3 resolved claims publish clean, zero residuals, zero quarantines', async () => {
  const { validation, adapterResult } = await runReplay();

  assert.equal(adapterResult.write_set.claims.length, 3);
  assert.equal(adapterResult.residuals.length, 0);
  assert.equal(validation.accepted, true);
  assert.equal(validation.residuals.length, 0);
  assert.equal(validation.quarantines.length, 0);
  assert.ok(validation.publishableWriteSet);
  assert.equal(validation.publishableWriteSet.claims.length, 3);
});
