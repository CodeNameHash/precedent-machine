'use strict';

/**
 * tests/canonical-v2-proxy-meeting-reference-fixes.test.js
 *
 * docs/codex-program/notes/resolver-reference-fixes.md, fixes 1 and 3:
 * MEETING_REF_NOT_IN_QUOTE and CONTROL_PARTY_REF_NOT_IN_QUOTE.
 *
 * WHAT THIS PROVES. The committed run-receipt.json in evidence/canonical-v2/
 * modiv-proxy-meeting-20260806/ -- the already-dispatched output of the real
 * live PROXY_MEETING run against Modiv's real section 5.4, loaded verbatim,
 * never hand-edited -- is replayed through the REAL, current
 * resolveCandidates. Checked directly against the model's own recorded
 * response before writing any fix (not assumed from the brief that opened
 * this task): of the 4 candidates flagged MEETING_REF_NOT_IN_QUOTE, only 2
 * are the MAE-shape defect (a real meeting_ref narrowed out of the quote by
 * the prompt's own deliberate narrowing); the other 2 have `meeting_ref:
 * null` in the model's own recorded JSON -- the SAME null-vs-absent
 * conflation the brief names for control_party, one gate earlier in the
 * same handler. The two Boolean presence facts do not need a meeting
 * identity and resolve without one. Identity-bearing claims still require
 * the reference. A present but narrowed reference gets a section check.
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
  proxyMeetingReferenceVerifiedInSection,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-proxy-meeting-20260806');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';

const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

// The original run's own deal identity, read directly from its own
// committed validation.json (evidence/canonical-v2/modiv-proxy-meeting-
// 20260806/validation.json's publishableWriteSet.deal), not invented.
const DEAL_KEY = 'deal:modiv-proxy-meeting:32065211e4688625';
const DEAL_ADMISSION_ID = '8acbdb99da306dc19a398d255f8b440aa1a95fdab2619f8b22d73d918adad79b';

function loadJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, fileName), 'utf8'));
}

let cachedAdmittedSourceContext = null;
function buildReplaySourceContext() {
  if (cachedAdmittedSourceContext) return cachedAdmittedSourceContext;
  const rawBytes = fs.readFileSync(RAW_HTML_PATH);
  assert.equal(sha256Hex(rawBytes), EXPECTED_RAW_BYTES_SHA256, 'committed Modiv raw HTML must match the pinned hash');
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: MODIV_RETRIEVAL_URL,
    final_url: MODIV_RETRIEVAL_URL,
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-06T04:00:00.000Z',
    retrieval_policy_digest: sha256Hex('canonical-v2-proxy-meeting-reference-fixes.test.js: reuse of already-admitted raw HTML, no network fetch'),
    redirect_count: 0,
    response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  assert.equal(conversion.canonical_text_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'canonical text must match the pinned hash');
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  assert.equal(verification.verification_status, 'PASS');
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  cachedAdmittedSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admissionBundle.immutable_source_document,
    source_admission_manifest: admissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    source_ordinal: 0,
  });
  return cachedAdmittedSourceContext;
}

const CONTRACT = compileFixtureContractV34();

function runReplay(runReceipt, manifest) {
  const admittedSourceContext = buildReplaySourceContext();
  assert.equal(admittedSourceContext.document_hash, runReceipt.document_hash, 'admitted_source_context.document_hash must match run_receipt.document_hash');
  return resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admittedSourceContext,
    agreement_date: manifest.agreement_date,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Grounding: the committed (pre-fix) evidence really does carry both
// defects this file exists to prove fixed, and the recorded model response
// really does have the null-vs-narrowed split this design note names.
// Re-running the pre-fix source (done manually during this task by
// temporarily reverting candidate-resolution.js to its pre-fix HEAD
// revision and re-running this same replay) reproduces this committed file
// byte-for-byte (resolved: 0, review_queue: 13, open_world: 8).
// ─────────────────────────────────────────────────────────────────────────

test('grounding: the committed (pre-fix) resolution.json queues 4 MEETING_REF_NOT_IN_QUOTE and 1 CONTROL_PARTY_REF_NOT_IN_QUOTE, and only 2 of the 4 meeting_ref candidates are genuinely narrowed-but-present', () => {
  const committedResolution = loadJson('resolution.json');
  const recorded = loadJson('native-producer-recorded-response-5.4.json');
  const parsedResponse = JSON.parse(recorded.raw_response_text.replace(/^```json\n/, '').replace(/\n```$/, ''));

  const meetingRefFlagged = committedResolution.review_queue.filter((item) => item.reasons.includes('MEETING_REF_NOT_IN_QUOTE'));
  assert.equal(meetingRefFlagged.length, 4);
  const controlPartyFlagged = committedResolution.review_queue.filter((item) => item.reasons.includes('CONTROL_PARTY_REF_NOT_IN_QUOTE'));
  assert.equal(controlPartyFlagged.length, 1);
  assert.equal(committedResolution.resolution_receipt.counts.resolved, 0);

  const nullMeetingRef = meetingRefFlagged.filter((item) => {
    const source = parsedResponse.proxy_meeting_assertions.find((a) => a.quote === item.raw_value);
    return source && source.meeting_ref === null;
  });
  assert.equal(nullMeetingRef.length, 2, 'exactly 2 of the 4 flagged candidates have a null meeting_ref in the model\'s own output, not a narrowed-but-present one');

  const nullControlParty = parsedResponse.proxy_meeting_assertions.find((a) => a.quote === controlPartyFlagged[0].raw_value);
  assert.equal(nullControlParty.control_party, null);
});

// ─────────────────────────────────────────────────────────────────────────
// Integration: replay the real recorded run through the current resolver.
// ─────────────────────────────────────────────────────────────────────────

test('REPLAY (evidence/canonical-v2/modiv-proxy-meeting-20260806/): narrowed references and Boolean presence facts resolve, while a null control party stays held', () => {
  const runReceipt = loadJson('run-receipt.json');
  const manifest = loadJson('run-manifest.json');
  const resolution = runReplay(runReceipt, manifest);

  assert.equal(resolution.resolution_receipt.counts.compiled_candidates, 21);
  assert.equal(resolution.resolved.length, 5, 'two narrowed references, two Boolean presence facts and one supplemental-disclosure reason resolve');
  assert.equal(resolution.open_world.length, 8, 'unaffected by this fix');

  const resolvedPhrases = resolution.resolved.map((entry) => entry.claim.raw_value).sort();
  assert.deepEqual(resolvedPhrases, [
    'allow reasonable additional time for the filing and distribution of any supplemental or amended disclosure which the Company Board has determined in good faith (after consultation with its outside legal counsel) is necessary under applicable Laws or the duties of the Company’s directors',
    'commence a broker search (and any additional broker searches, if necessary) pursuant to Section 14a-13 of the Exchange Act',
    'establish a record date for and give notice of a meeting of its stockholders',
    'for the absence of a quorum',
    'if required by Law',
  ]);
  for (const entry of resolution.resolved.filter((row) => row.claim.attributes.assertion_kind === 'ADJOURNMENT_REASON')) {
    assert.equal(entry.concept_key, 'COV-MEETING');
    assert.equal(entry.claim.attributes.meeting_ref, 'the Company Common Stockholders’ Meeting');
  }

  assert.ok(resolution.review_queue.every((item) => !item.reasons.includes('MEETING_REF_NOT_IN_QUOTE')));
  assert.ok(resolution.review_queue.every((item) => !item.reasons.includes('CONTROL_PARTY_REF_NOT_IN_QUOTE')));

  const meetingRefAbsent = resolution.review_queue.filter((item) => item.reasons.includes('MEETING_REF_ABSENT'));
  assert.equal(meetingRefAbsent.length, 0);

  const controlPartyAbsent = resolution.review_queue.filter((item) => item.reasons.includes('CONTROL_PARTY_REF_ABSENT'));
  assert.equal(controlPartyAbsent.length, 1);
  assert.equal(controlPartyAbsent[0].raw_value, 'in no event shall the Company Common Stockholders’ Meeting be (I) postponed more than a total of three (3) times');
});

// ─────────────────────────────────────────────────────────────────────────
// Hostile: the gate must not be relaxed into "always true". A reference
// genuinely absent from the real section text must still be refused, even
// though it is non-null and even though the narrow-quote check already
// failed -- proving the widened check is a real, second gate, not a no-op.
// ─────────────────────────────────────────────────────────────────────────

test('HOSTILE: a fabricated meeting_ref that is genuinely absent from the real section 5.4 text still refuses, even though it is non-null', () => {
  const runReceipt = loadJson('run-receipt.json');
  const manifest = loadJson('run-manifest.json');

  const fabricated = JSON.parse(JSON.stringify(runReceipt));
  const target = fabricated.compiled_candidates.find(
    (entry) => entry.ok === true && entry.candidate?.kind === 'claim'
      && entry.candidate.claim.raw_value === 'for the absence of a quorum',
  );
  assert.ok(target, 'fixture must still contain the real quorum-absence candidate this test starts from');
  target.candidate.claim.attributes.meeting_ref = 'the Parent Special Committee Convocation';

  const resolution = runReplay(fabricated, manifest);
  const stillQueued = resolution.review_queue.find((item) => item.raw_value === 'for the absence of a quorum');
  assert.ok(stillQueued);
  assert.ok(stillQueued.reasons.includes('MEETING_REF_NOT_IN_QUOTE'), `fabricated reference must still be refused, got ${JSON.stringify(stillQueued.reasons)}`);
});

test('HOSTILE: a missing meeting_ref still holds an identity-bearing adjournment reason', () => {
  const runReceipt = loadJson('run-receipt.json');
  const manifest = loadJson('run-manifest.json');
  const fabricated = structuredClone(runReceipt);
  const target = fabricated.compiled_candidates.find(
    (entry) => entry.ok === true && entry.candidate?.kind === 'claim'
      && entry.candidate.claim.raw_value === 'for the absence of a quorum',
  );
  assert.ok(target);
  target.candidate.claim.attributes.meeting_ref = null;

  const resolution = runReplay(fabricated, manifest);
  const held = resolution.review_queue.find((item) => item.raw_value === 'for the absence of a quorum');
  assert.ok(held);
  assert.ok(held.reasons.includes('MEETING_REF_ABSENT'));
  assert.equal(held.has_resolution, false);
});

// ─────────────────────────────────────────────────────────────────────────
// Unit: the pure helper directly, against the real committed section 5.4
// text (tests/fixtures/canonical-v2/proxy-meeting-family/modiv-section-5.4.
// txt, byte-identical to the 229977-246111 span the real section-location-
// scan.json reports for this section -- re-verified below).
// ─────────────────────────────────────────────────────────────────────────

const SECTION_5_4_TEXT = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'canonical-v2', 'proxy-meeting-family', 'modiv-section-5.4.txt'), 'utf8',
);

test('unit: SECTION_5_4_TEXT fixture is byte-identical to the real section span the committed section-location-scan.json reports', () => {
  const admittedSourceContext = buildReplaySourceContext();
  const { utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
  const liveSlice = utf8Slice(admittedSourceContext.canonical_text.text, 229977, 246111);
  assert.equal(SECTION_5_4_TEXT, liveSlice);
});

test('unit: proxyMeetingReferenceVerifiedInSection finds the real, repeated defined term and refuses a fabricated one, never requiring uniqueness', () => {
  assert.equal(
    proxyMeetingReferenceVerifiedInSection({ sectionText: SECTION_5_4_TEXT, refValue: 'the Company Common Stockholders’ Meeting' }),
    true,
  );
  assert.equal(
    (SECTION_5_4_TEXT.match(/the Company Common Stockholders’ Meeting/g) || []).length > 1,
    true,
    'sanity: this defined term is genuinely repeated, not positionally unique -- the check must not require uniqueness',
  );
  assert.equal(
    proxyMeetingReferenceVerifiedInSection({ sectionText: SECTION_5_4_TEXT, refValue: 'the Parent Special Committee Convocation' }),
    false,
  );
  assert.equal(proxyMeetingReferenceVerifiedInSection({ sectionText: SECTION_5_4_TEXT, refValue: null }), false);
  assert.equal(proxyMeetingReferenceVerifiedInSection({ sectionText: null, refValue: 'the Company Common Stockholders’ Meeting' }), false);
});
