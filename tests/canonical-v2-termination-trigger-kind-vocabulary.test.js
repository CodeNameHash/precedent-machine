'use strict';

/**
 * Step 3A (docs/core/PLAN.md, "Widen the termination trigger-kind vocabulary
 * for the four phrasings that miss"). Four real Modiv phrasings, each
 * recorded verbatim in docs/codex-program/notes/resolver-reference-fixes.md
 * (search "table's pattern misses it"), matched nothing in
 * TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE
 * (lib/canonical-v2/native-producer/candidate-resolution.js), so six
 * legitimate termination grounds queued under TRIGGER_KIND_UNCORROBORATED
 * instead of resolving:
 *
 *   - VOTE_FAILURE:            "the Company Requisite Vote shall not have
 *                               been obtained..." (7.1(b)(iii))
 *   - RECOMMENDATION_CHANGE:   "...failed to publicly reaffirm the Company
 *                               Recommendation..." (7.1(d)(ii)) -- omits
 *                               "Board" from the table's literal phrase
 *   - RECOMMENDATION_CHANGE:   "...failed to publicly recommend against any
 *                               tender offer..." (7.1(d)(ii)) -- no pattern
 *                               at all
 *   - NO_SOLICITATION_BREACH:  "the Company enters into an Alternative
 *                               Acquisition Agreement..." (7.1(d)(ii)) --
 *                               structurally different from a Section-
 *                               obligation breach
 *
 * Two further 7.1 candidates (7.1(c)(iii), 7.1(d)(iii)) carry a `null`
 * trigger_kind from the model itself -- not a vocabulary gap, and this fix
 * must not force them. They are asserted to still queue below.
 *
 * This file proves three things separately:
 *   1. Unit-level: each widened pattern corroborates the exact real quote it
 *      was added for, AND a hostile check that the SAME quote under a
 *      different (wrong) trigger_kind still fails to corroborate -- proving
 *      the widening is scoped to its own trigger_kind, not a blanket
 *      "matches something" bypass.
 *   2. End-to-end: the committed evidence/canonical-v2/modiv-termination-
 *      20260806/run-receipt.json replayed through the real resolveCandidates
 *      (real SEC HTML admission of the pinned Modiv raw HTML, no
 *      reconstruction) resolves 17 termination-right candidates (post-2X-I mutual fan-out), up from the
 *      8 the same replay produced before this fix, and the two null-
 *      trigger_kind candidates still queue.
 *   3. Step 3A1 (docs/core/PLAN.md, "Close the fiduciary-out false positive
 *      Step 3A opened"): part 1's eight hostile checks are all
 *      *quote-fixed, kind-varied* -- one real quote, tested against several
 *      wrong trigger_kinds whose own vocabulary is disjoint from that
 *      quote's, so they pass by construction and prove only that the
 *      widening does not leak across unrelated kinds. They do not test
 *      whether a DIFFERENT ground that happens to share vocabulary with a
 *      widened pattern is wrongly accepted under the SAME kind. Two such
 *      false positives existed:
 *        - NO_SOLICITATION_BREACH's "enters into ... Alternative
 *          Acquisition Agreement" alternative also matched the Company's own
 *          fiduciary-out ground (terminating to accept a Superior Proposal),
 *          the adjacent ground in every Article VII and the one a model
 *          most plausibly confuses it with.
 *        - RECOMMENDATION_CHANGE's bare "Company Recommendation" /
 *          "Company Board Recommendation" alternatives also matched a Board
 *          *reaffirming* its recommendation, the opposite of a change.
 *      The tests below are *kind-fixed, quote-varied*: the SAME trigger_kind
 *      each widening was added for, tested against a quote that is a
 *      different, adjacent ground, real filed text where the corpus has it
 *      (Skechers Inc.'s merger agreement, `tests/fixtures/canonical-v2/
 *      skechers-first-live-run/skechers-raw-fetched.htm`, section 5.3(d),
 *      for the fiduciary-out ground -- Modiv's own 7.1(c)(i) fiduciary-out
 *      ground never says the defined term "Alternative Acquisition
 *      Agreement" and so does not itself expose this defect, "safe only by
 *      drafting luck" per the plan). No committed corpus text pairs a bare
 *      (non-"failed to") Board reaffirmation with "Company Recommendation",
 *      so that probe uses the plan's own illustrative quote instead.
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
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const {
  resolveCandidates,
  terminationTriggerKindCorroborated,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

// ─────────────────────────────────────────────────────────────────────────
// Part 1: unit-level, real quotes copied verbatim from
// docs/codex-program/notes/resolver-reference-fixes.md and cross-checked
// against evidence/canonical-v2/modiv-termination-20260806/run-receipt.json's
// own compiled_candidates[*].candidate.claim.raw_value.
// ─────────────────────────────────────────────────────────────────────────

const VOTE_FAILURE_QUOTE = 'the Company Requisite Vote shall not have been obtained at a duly held Company Common '
  + 'Stockholders’ Meeting or any adjournment or postponement thereof at which the Company Merger is voted upon';

const RECOMMENDATION_NO_BOARD_QUOTE = 'the Company Board shall have failed to publicly reaffirm the Company '
  + 'Recommendation within ten (10) Business Days after the date a Company Acquisition Proposal shall have been '
  + 'publicly announced';

const RECOMMENDATION_TENDER_OFFER_QUOTE = 'the Company shall have failed to publicly recommend against any tender '
  + 'offer or exchange offer subject to Regulation 14D under the Exchange Act that constitutes a Company '
  + 'Acquisition Proposal (including, for these purposes, by taking no position with respect to the acceptance of '
  + 'such tender offer or exchange offer by the Company’s stockholders) within ten (10) Business Days after '
  + 'the commencement (pursuant to Rule 14d-2 of the Exchange Act) of such tender offer or exchange offer';

const NO_SOLICITATION_ENTERS_AGREEMENT_QUOTE = 'the Company enters into an Alternative Acquisition Agreement '
  + '(other than an Acceptable Confidentiality Agreement entered into in compliance with Section 5.6)';

test('VOTE_FAILURE: real Modiv "Company Requisite Vote" quote now corroborates', () => {
  assert.ok(terminationTriggerKindCorroborated('VOTE_FAILURE', VOTE_FAILURE_QUOTE));
});

test('hostile: the VOTE_FAILURE quote under a wrong trigger_kind still fails to corroborate', () => {
  assert.equal(terminationTriggerKindCorroborated('BREACH', VOTE_FAILURE_QUOTE), false);
  assert.equal(terminationTriggerKindCorroborated('RECOMMENDATION_CHANGE', VOTE_FAILURE_QUOTE), false);
});

test('RECOMMENDATION_CHANGE: real Modiv quote omitting "Board" ("the Company Recommendation") now corroborates', () => {
  assert.ok(terminationTriggerKindCorroborated('RECOMMENDATION_CHANGE', RECOMMENDATION_NO_BOARD_QUOTE));
});

test('hostile: the Board-omitting Recommendation quote under a wrong trigger_kind still fails to corroborate', () => {
  assert.equal(terminationTriggerKindCorroborated('VOTE_FAILURE', RECOMMENDATION_NO_BOARD_QUOTE), false);
  assert.equal(terminationTriggerKindCorroborated('NO_SOLICITATION_BREACH', RECOMMENDATION_NO_BOARD_QUOTE), false);
});

test('RECOMMENDATION_CHANGE: real Modiv "failed to publicly recommend against any tender offer" quote now corroborates', () => {
  assert.ok(terminationTriggerKindCorroborated('RECOMMENDATION_CHANGE', RECOMMENDATION_TENDER_OFFER_QUOTE));
});

test('hostile: the tender-offer Recommendation quote under a wrong trigger_kind still fails to corroborate', () => {
  assert.equal(terminationTriggerKindCorroborated('BREACH', RECOMMENDATION_TENDER_OFFER_QUOTE), false);
  assert.equal(terminationTriggerKindCorroborated('VOTE_FAILURE', RECOMMENDATION_TENDER_OFFER_QUOTE), false);
});

test('NO_SOLICITATION_BREACH: real Modiv "enters into an Alternative Acquisition Agreement" quote now corroborates', () => {
  assert.ok(terminationTriggerKindCorroborated('NO_SOLICITATION_BREACH', NO_SOLICITATION_ENTERS_AGREEMENT_QUOTE));
});

test('hostile: the Alternative Acquisition Agreement quote under a wrong trigger_kind still fails to corroborate', () => {
  assert.equal(terminationTriggerKindCorroborated('BREACH', NO_SOLICITATION_ENTERS_AGREEMENT_QUOTE), false);
  assert.equal(terminationTriggerKindCorroborated('RECOMMENDATION_CHANGE', NO_SOLICITATION_ENTERS_AGREEMENT_QUOTE), false);
});

test('the original Section-4.4 NO_SOLICITATION_BREACH alternative is untouched by the new one', () => {
  assert.ok(terminationTriggerKindCorroborated(
    'NO_SOLICITATION_BREACH',
    'the Company materially breaches its obligations under Section 4.4',
  ));
  // A generic string carrying neither alternative still refuses, same as
  // before this fix (audit M-3's original hostile check, still true even
  // though the reason it is true has changed).
  assert.equal(terminationTriggerKindCorroborated('NO_SOLICITATION_BREACH', 'anything at all, even the word breach'), false);
});

// ─────────────────────────────────────────────────────────────────────────
// Step 3A1: kind-fixed, quote-varied hostile tests. Same trigger_kind each
// widening was added for; the quote is a DIFFERENT, adjacent ground rather
// than a different kind's disjoint vocabulary. This is the axis part 1's
// eight hostile checks do not exercise -- see the file header.
// ─────────────────────────────────────────────────────────────────────────

// Real filed text, Skechers Inc.'s merger agreement (Skechers/3G Capital,
// 2026), tests/fixtures/canonical-v2/skechers-first-live-run/
// skechers-raw-fetched.htm, section 5.3(d): the Company's OWN fiduciary-out
// ground -- the Board authorising termination to enter into an Alternative
// Acquisition Agreement BECAUSE an Acquisition Proposal has been determined
// to be a Superior Proposal. This is legally the opposite ground from
// NO_SOLICITATION_BREACH (Parent's right arising from the Company's breach
// of the no-shop standstill) even though it shares the "enters into an
// Alternative Acquisition Agreement" vocabulary the Step 3A widening added.
const SKECHERS_FIDUCIARY_OUT_QUOTE = 'if the Company has received a bona fide Acquisition Proposal after the date hereof that the Company Board '
  + 'has concluded in good faith (after consultation with its financial advisor and outside legal counsel) is a Superior Proposal, then the '
  + 'Company Board may (A) effect a Company Board Recommendation Change with respect to such Acquisition Proposal; or (B) authorize the Company '
  + 'to terminate this Agreement to enter into an Alternative Acquisition Agreement with respect to such Acquisition Proposal';

test('HOSTILE (kind-fixed, quote-varied): the Company\'s own fiduciary-out ground (real Skechers text) does NOT '
  + 'corroborate NO_SOLICITATION_BREACH, even though it carries "enters into an Alternative Acquisition Agreement"', () => {
  assert.equal(terminationTriggerKindCorroborated('NO_SOLICITATION_BREACH', SKECHERS_FIDUCIARY_OUT_QUOTE), false);
});

// The real Modiv NO_SOLICITATION_BREACH ground (Parent's right, from
// resolver-reference-fixes.md) must still corroborate: this is the
// discriminating pair the fix has to get right in both directions.
test('the real Modiv NO_SOLICITATION_BREACH ground still corroborates after the fiduciary-out exclusion', () => {
  assert.ok(terminationTriggerKindCorroborated('NO_SOLICITATION_BREACH', NO_SOLICITATION_ENTERS_AGREEMENT_QUOTE));
});

// No committed corpus text pairs a bare (non-"failed to") Board
// reaffirmation with the "Company Recommendation" defined term -- both real
// instances found in the fixture corpus (Modiv 7.1(d)(ii), Skechers 5.3(c))
// only ever use "failed to publicly reaffirm". This probe is the plan's own
// illustrative quote (docs/core/PLAN.md, Step 3A1), not corpus text.
const REAFFIRMED_RECOMMENDATION_INTERVENING_EVENT_QUOTE =
  'the Company Board shall have publicly reaffirmed the Company Recommendation following an Intervening Event';

test('HOSTILE (kind-fixed, quote-varied): a Board reaffirming (not "failed to reaffirm") the Company Recommendation '
  + 'does NOT corroborate RECOMMENDATION_CHANGE', () => {
  assert.equal(terminationTriggerKindCorroborated('RECOMMENDATION_CHANGE', REAFFIRMED_RECOMMENDATION_INTERVENING_EVENT_QUOTE), false);
});

// The real Modiv "failed to publicly reaffirm" ground must still
// corroborate: the discriminator is "failed", not the word "reaffirm"
// itself.
test('the real Modiv "failed to publicly reaffirm" RECOMMENDATION_CHANGE ground still corroborates after the reaffirm exclusion', () => {
  assert.ok(terminationTriggerKindCorroborated('RECOMMENDATION_CHANGE', RECOMMENDATION_NO_BOARD_QUOTE));
});

// ─────────────────────────────────────────────────────────────────────────
// Part 2: end-to-end replay of the real committed evidence through the real
// resolveCandidates. Same admission pattern as
// tests/canonical-v2-modiv-closing-conditions-partial-receipt-replay.test.js
// -- real SEC HTML conversion of the pinned Modiv raw HTML, no
// reconstruction of the run receipt or its candidates.
// ─────────────────────────────────────────────────────────────────────────

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-termination-20260806');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';

const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

function loadRunReceipt() {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'run-receipt.json'), 'utf8'));
}

function admitModivSource() {
  const rawBytes = fs.readFileSync(RAW_HTML_PATH);
  assert.equal(sha256Hex(rawBytes), EXPECTED_RAW_BYTES_SHA256, 'committed Modiv raw HTML must match the pinned hash');

  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: MODIV_RETRIEVAL_URL,
    final_url: MODIV_RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-06T10:24:00.000Z',
    retrieval_policy_digest: sha256Hex('canonical-v2-termination-trigger-kind-vocabulary.test.js: reuse of already-admitted raw HTML, no network fetch'),
    redirect_count: 0,
    response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  assert.equal(conversion.canonical_text_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'canonical text must match the pinned hash');
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  assert.equal(verification.verification_status, 'PASS');
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

  const dealKey = `deal:termination-trigger-kind-vocabulary-test:${sha256Hex(MODIV_RETRIEVAL_URL).slice(0, 16)}`;
  const dealAdmissionId = sha256Hex(`deal-admission-termination-trigger-kind-vocabulary-test:${MODIV_RETRIEVAL_URL}`);
  return buildAdmittedSemanticSourceContext({
    immutable_source_document: admissionBundle.immutable_source_document,
    source_admission_manifest: admissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: dealKey,
    deal_admission_id: dealAdmissionId,
    source_ordinal: 0,
  });
}

test('replay: the committed Modiv termination run-receipt now resolves 17 termination-right candidates after Step 2X-I mutual two-row mint', () => {
  const runReceipt = loadRunReceipt();
  const admittedSourceContext = admitModivSource();
  assert.equal(admittedSourceContext.document_hash, runReceipt.document_hash);

  const resolution = resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: compileFixtureContractV34(),
    admitted_source_context: admittedSourceContext,
    agreement_date: '2026-05-03',
  });

  assert.equal(resolution.resolution_receipt.counts.resolved, 17);

  const resolvedCitations = resolution.resolved
    .filter((row) => row.generic_claim_key === 'NATIVE_TERMINATION_RIGHT_CANDIDATE')
    .map((row) => `${row.source_citation}:${row.concept_key}`)
    .sort();
  // The four newly-resolved grounds: VOTE_FAILURE (7.1(b)(iii)), two
  // RECOMMENDATION_CHANGE grounds and one NO_SOLICITATION_BREACH ground
  // (all three 7.1(d)(ii)).
  assert.ok(resolvedCitations.includes('7.1(b)(iii):TERMR-NOVOTE'));
  assert.equal(resolvedCitations.filter((c) => c === '7.1(d)(ii):TERMR-RECOMMEND').length, 3);
  assert.ok(resolvedCitations.includes('7.1(d)(ii):TERMR-NOSOL-BREACH'));

  // The two null-trigger_kind candidates must NOT be forced -- they still
  // queue under TRIGGER_KIND_UNCORROBORATED exactly as before this fix.
  const stillQueuedNullTrigger = resolution.review_queue.filter((item) => (
    (item.reasons || []).includes('TRIGGER_KIND_UNCORROBORATED')
    && (item.source_citation === '7.1(c)(iii)' || item.source_citation === '7.1(d)(iii)')
  ));
  assert.equal(stillQueuedNullTrigger.length, 2);
});
