'use strict';

/**
 * tests/canonical-v2-termination-limb-grant-context.test.js
 *
 * docs/codex-program/notes/resolver-reference-fixes.md, fix 2:
 * TERMINATING_PARTY_REF_NOT_IN_QUOTE, the largest single block in the whole
 * review queue across all 25 families' Modiv sweep.
 *
 * WHAT THIS PROVES. The committed run-receipt.json in evidence/canonical-v2/
 * modiv-termination-20260806/ -- the already-dispatched output of the real
 * live TERMINATION run against Modiv's real section 7.1, loaded verbatim,
 * never hand-edited -- is replayed through the REAL, current
 * resolveCandidates, exactly as scripts/canonical-v2-live-extraction-run.mjs
 * itself calls it. Modiv's termination chapeau names no party at all; the
 * party grants live in the lettered limb heads ("(b) by either the Company,
 * on the one hand, or Parent, on the other hand, ... if:", "(c) by written
 * notice from the Company to Parent, if:", "(d) by written notice from
 * Parent to the Company, if:"), each thousands of bytes from the section
 * chapeau and each naming BOTH parties, which is why the pre-fix resolver's
 * document-wide proximity search (findTerminationGrantContext) found
 * nothing here, and why a naive "does the widened text contain
 * terminating_party" substring check would corroborate the wrong party on
 * half of these limbs.
 *
 * Document identity: the same raw Modiv HTML fixture the mae-definition-
 * family and termination-fee replay tests already commit and pin
 * (tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm),
 * independently re-verified below against both hashes, not assumed.
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
  terminationLimbLetter,
  findTerminationLimbChapeau,
  parseTerminationLimbDirection,
  findTerminationLimbGrantContext,
  findTerminationSectionEitherGrantContext,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-termination-20260806');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';

// Independently re-derived, not trusted from either the evidence files or
// the sibling termination-fee replay tests' own constants.
const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

// The original run's own deal identity, read directly from its own
// committed validation.json (evidence/canonical-v2/modiv-termination-
// 20260806/validation.json's publishableWriteSet.deal), not invented --
// reusing it exactly reproduces the original run's own claim/provision
// identities rather than minting a fresh, differently-hashed identity.
const DEAL_KEY = 'deal:modiv-termination:32065211e4688625';
const DEAL_ADMISSION_ID = '504d7e495f62b27cb8cab9c9c339e5e5bc5240d15627301de48456ef39f0cd83';

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
    retrieval_policy_digest: sha256Hex('canonical-v2-termination-limb-grant-context.test.js: reuse of already-admitted raw HTML, no network fetch'),
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
// Grounding: the committed (pre-fix) evidence really does carry the defect
// this file exists to prove fixed. If this fails, the "after" half below is
// measuring the wrong thing. This is also the "proven to fail without the
// fix" evidence required for this task: this exact committed resolution.json
// was produced by the pipeline BEFORE this fix existed, and shows exactly
// the reason codes below for exactly these citations -- re-running the
// pre-fix source against the same run_receipt.json (done manually during
// this task by temporarily reverting candidate-resolution.js to its
// pre-fix HEAD revision and re-running this same replay) reproduces this
// committed file byte-for-byte (resolved: 1, review_queue: 16, open_world:
// 13), confirming this grounding is not a stale artifact.
// ─────────────────────────────────────────────────────────────────────────

test('grounding: the committed (pre-fix) resolution.json really does queue 12 TERMINATING_PARTY_REF_NOT_IN_QUOTE candidates across the (b)/(c)/(d) limbs', () => {
  const committedResolution = loadJson('resolution.json');
  const flagged = committedResolution.review_queue.filter((item) => item.reasons.includes('TERMINATING_PARTY_REF_NOT_IN_QUOTE'));
  assert.equal(flagged.length, 12);
  assert.deepEqual(
    [...new Set(flagged.map((item) => item.source_citation))].sort(),
    ['7.1(b)(i)', '7.1(b)(ii)', '7.1(b)(iii)', '7.1(c)(ii)', '7.1(c)(iii)', '7.1(d)(i)', '7.1(d)(ii)', '7.1(d)(iii)'],
  );
  assert.equal(committedResolution.resolution_receipt.counts.resolved, 1, 'only the (a) mutual-consent grant resolved pre-fix');
});

// ─────────────────────────────────────────────────────────────────────────
// Integration: replay the real recorded run through the current resolver.
// ─────────────────────────────────────────────────────────────────────────

test('REPLAY (evidence/canonical-v2/modiv-termination-20260806/): every (b)/(c)/(d) limb candidate clears TERMINATING_PARTY_REF_NOT_IN_QUOTE, and the two limbs whose party was already correct but only failed the position gate also clear TERMINATING_PARTY_REF_UNCORROBORATED', () => {
  const runReceipt = loadJson('run-receipt.json');
  const manifest = loadJson('run-manifest.json');
  const resolution = runReplay(runReceipt, manifest);

  assert.equal(resolution.resolution_receipt.counts.compiled_candidates, 29);
  // 8 at the time this fix landed (fix 2, party-scope corroboration only).
  // Step 3A (docs/core/PLAN.md; tests/canonical-v2-termination-trigger-kind-
  // vocabulary.test.js) separately widened
  // TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE and took the same replay to
  // 12 -- this assertion tracks that later count since it replays the
  // CURRENT resolver, not resolver-as-of-fix-2.
  assert.equal(resolution.resolved.length, 17, 'resolved rises from 12 post-Step-3A to 17 after Step-2X-I two-row mutual mint (+5 from EITHER_PARTY fan-out)');
  assert.ok(
    resolution.review_queue.every((item) => !item.reasons.includes('TERMINATING_PARTY_REF_NOT_IN_QUOTE')),
    'no candidate anywhere in the review queue may still carry this reason after the fix',
  );
  assert.ok(
    resolution.review_queue.every((item) => !item.reasons.includes('TERMINATING_PARTY_REF_UNCORROBORATED')),
    'the from-PARTY-to positional-gate widening also clears both pre-existing UNCORROBORATED candidates (7.1(c)(i), 7.1(d)(i) cure)',
  );

  // Every one of the 6 (b)/(c)/(d) limb citations that were flagged
  // TERMINATING_PARTY_REF_NOT_IN_QUOTE now resolves with the CORRECT party
  // and capacity -- the exact fact the fix exists to prove, not merely
  // that some gate stopped complaining.
  const bySourceCitation = new Map();
  for (const entry of resolution.resolved) {
    const citation = entry.compiled_candidate.citation_validation?.derived_citation || entry.compiled_candidate.section_reference;
    if (!bySourceCitation.has(citation)) bySourceCitation.set(citation, []);
    bySourceCitation.get(citation).push(entry);
  }

  const legalRestraint = bySourceCitation.get('7.1(b)(i)');
  assert.ok(legalRestraint && legalRestraint.length === 2);
  assert.deepEqual(legalRestraint.map((e) => e.party.capacity).sort(), ['BUYER', 'TARGET']);
  assert.ok(legalRestraint.some((e) => e.party.value === 'the Company' && e.party.capacity === 'TARGET'));
  assert.ok(legalRestraint.some((e) => e.party.value === 'Parent' && e.party.capacity === 'BUYER'));

  const outsideDate = bySourceCitation.get('7.1(b)(ii)');
  assert.ok(outsideDate && outsideDate.length === 4, 'both OUTSIDE_DATE candidates resolve as two principal-party rows each');
  for (const entry of outsideDate) {
    assert.ok(entry.party.capacity === 'TARGET' || entry.party.capacity === 'BUYER');
    assert.notEqual(entry.party.capacity, 'EITHER_PRINCIPAL_PARTY');
  }

  const companyBreach = bySourceCitation.get('7.1(c)(ii)');
  assert.ok(companyBreach && companyBreach.length >= 1);
  assert.deepEqual(companyBreach[0].party, { role: 'TERMINATION_RIGHT_HOLDER', value: 'the Company', capacity: 'TARGET' });

  const parentBreach = bySourceCitation.get('7.1(d)(i)');
  assert.ok(parentBreach && parentBreach.length >= 1);
  assert.deepEqual(parentBreach[0].party, { role: 'TERMINATION_RIGHT_HOLDER', value: 'Parent', capacity: 'BUYER' });

  const adverseRecChange = bySourceCitation.get('7.1(d)(ii)');
  // Pre-Step-3A this held only the Adverse Recommendation Change ground; its
  // three RECOMMENDATION_CHANGE/NO_SOLICITATION_BREACH siblings under the
  // same (d)(ii) limb queued TRIGGER_KIND_UNCORROBORATED for an unrelated
  // vocabulary gap (see the design note). Step 3A widened that table
  // (tests/canonical-v2-termination-trigger-kind-vocabulary.test.js), so all
  // four now resolve under this same limb and party.
  assert.equal(adverseRecChange && adverseRecChange.length, 4, 'all four (d)(ii) grounds resolve post-Step-3A');
  for (const entry of adverseRecChange) {
    assert.equal(entry.party.capacity, 'BUYER');
  }

  const superiorProposal = bySourceCitation.get('7.1(c)(i)');
  assert.ok(superiorProposal && superiorProposal.length === 1, 'the pre-existing TERMINATING_PARTY_REF_UNCORROBORATED candidate also now resolves');
  assert.deepEqual(superiorProposal[0].party, { role: 'TERMINATION_RIGHT_HOLDER', value: 'the Company', capacity: 'TARGET' });
});

test('REPLAY: the remaining candidates among (b)/(c)/(d) queue for reasons entirely unrelated to the terminating party (TRIGGER_KIND_UNCORROBORATED), never for the party gate this fix touches', () => {
  const runReceipt = loadJson('run-receipt.json');
  const manifest = loadJson('run-manifest.json');
  const resolution = runReplay(runReceipt, manifest);
  const stillQueued = resolution.review_queue.filter((item) => item.reasons.length > 0
    && ['7.1(b)(iii)', '7.1(c)(iii)', '7.1(d)(ii)', '7.1(d)(iii)'].includes(item.source_citation));
  // Pre-Step-3A this was >=5 (a vocabulary gap in
  // TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE queued 6 real grounds).
  // Step 3A (tests/canonical-v2-termination-trigger-kind-vocabulary.test.js)
  // closed that gap for four of them; only the two candidates whose
  // trigger_kind is `null` from the model itself -- not vocabulary, and
  // deliberately not forced -- remain: 7.1(c)(iii) and 7.1(d)(iii).
  assert.equal(stillQueued.length, 2);
  assert.deepEqual(stillQueued.map((item) => item.source_citation).sort(), ['7.1(c)(iii)', '7.1(d)(iii)']);
  for (const item of stillQueued) {
    assert.ok(!item.reasons.includes('TERMINATING_PARTY_REF_NOT_IN_QUOTE') && !item.reasons.includes('TERMINATING_PARTY_REF_UNCORROBORATED'));
    assert.deepEqual(item.reasons, ['TRIGGER_KIND_UNCORROBORATED']);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Hostile: the fix must not corroborate a wrong party. This is the exact
// trap the design note names -- every real limb head names BOTH parties, so
// this constructs a candidate that swaps which one the model claims
// terminates, from the SAME real (d) limb quote a genuine candidate
// resolves under above, and proves it still refuses.
// ─────────────────────────────────────────────────────────────────────────

test('HOSTILE: a swapped terminating_party on a real (d)-limb quote never resolves, even though both party names are real text near the quote', () => {
  const runReceipt = loadJson('run-receipt.json');
  const manifest = loadJson('run-manifest.json');
  const target = runReceipt.compiled_candidates.find(
    (entry) => entry.ok === true && entry.candidate?.kind === 'claim'
      && entry.candidate.claim.raw_value === 'the Company Board shall have effected an Adverse Recommendation Change',
  );
  assert.ok(target, 'fixture must still contain the real (d)(ii) Adverse Recommendation Change candidate');
  assert.equal(target.candidate.claim.attributes.terminating_party, 'Parent', 'sanity: the real, correct party for this (d)-limb ground');

  const swapped = JSON.parse(JSON.stringify(runReceipt));
  const swappedEntry = swapped.compiled_candidates.find(
    (entry) => entry.ok === true && entry.candidate?.kind === 'claim'
      && entry.candidate.claim.raw_value === 'the Company Board shall have effected an Adverse Recommendation Change',
  );
  swappedEntry.candidate.claim.attributes.terminating_party = 'the Company';
  swappedEntry.candidate.claim.attributes.terminating_party_scope = 'ONE_PARTY';

  const resolution = runReplay(swapped, manifest);
  const stillQueued = resolution.review_queue.find(
    (item) => item.source_citation === '7.1(d)(ii)' && item.normalised_phrase?.includes('Adverse Recommendation Change'),
  );
  assert.ok(stillQueued, 'the swapped candidate must still appear in the review queue, never silently dropped');
  assert.ok(
    stillQueued.reasons.includes('TERMINATING_PARTY_REF_NOT_IN_QUOTE') || stillQueued.reasons.includes('TERMINATING_PARTY_REF_UNCORROBORATED'),
    `swapped party must still be refused, got reasons ${JSON.stringify(stillQueued.reasons)}`,
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Unit: the pure helpers directly, against the real committed section 7.1
// text (tests/fixtures/canonical-v2/termination-rights-family/modiv-
// section-7.1.txt, byte-identical to the 321761-331500 span the real
// section-location-scan.json reports for this section -- re-verified below,
// not assumed), independent of a full resolveCandidates run.
// ─────────────────────────────────────────────────────────────────────────

const SECTION_7_1_TEXT = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'canonical-v2', 'termination-rights-family', 'modiv-section-7.1.txt'), 'utf8',
);

test('unit: SECTION_7_1_TEXT fixture is byte-identical to the real section span the committed section-location-scan.json reports', () => {
  const admittedSourceContext = buildReplaySourceContext();
  const { utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
  const liveSlice = utf8Slice(admittedSourceContext.canonical_text.text, 321761, 331500);
  assert.equal(SECTION_7_1_TEXT, liveSlice);
});

test('unit: terminationLimbLetter derives the one lettered limb governing a deeper citation, or null for anything else', () => {
  assert.equal(terminationLimbLetter('7.1', '7.1(d)(ii)'), 'd');
  assert.equal(terminationLimbLetter('7.1', '7.1(c)(iii)'), 'c');
  assert.equal(terminationLimbLetter('7.1', '7.1(a)'), 'a');
  assert.equal(terminationLimbLetter('7.1', '7.1'), null, 'no lettered limb at all');
  assert.equal(terminationLimbLetter('7.1', '7.2(a)'), null, 'not even a child of this section');
  assert.equal(terminationLimbLetter('7.1', null), null);
});

test('unit: findTerminationLimbChapeau locates each real limb chapeau exactly, bounded at the colon that opens its own numbered sub-list', () => {
  const admittedSourceContext = buildReplaySourceContext();
  const section = { start: 321761, end: 331500 };

  const b = findTerminationLimbChapeau({ section, admittedSourceContext, sectionReference: '7.1', citationReference: '7.1(b)(i)' });
  assert.equal(b.chapeau_text, '(b) by either the Company, on the one hand, or Parent, on the other hand, by written notice to the other, if:');

  const c = findTerminationLimbChapeau({ section, admittedSourceContext, sectionReference: '7.1', citationReference: '7.1(c)(iii)' });
  assert.equal(c.chapeau_text, '(c) by written notice from the Company to Parent, if:');

  const d = findTerminationLimbChapeau({ section, admittedSourceContext, sectionReference: '7.1', citationReference: '7.1(d)(i)' });
  assert.equal(d.chapeau_text, '(d) by written notice from Parent to the Company, if:');
});

test('unit: findTerminationLimbChapeau fails closed on an unresolvable letter and never confuses a "Section N.N(a)" cross-reference for a real limb marker', () => {
  const admittedSourceContext = buildReplaySourceContext();
  const section = { start: 321761, end: 331500 };
  // "(c)(ii)" itself is a genuine descendant citation of limb (c); the real
  // section text also contains "Section 6.3(a)" and "Section 6.2(a)"
  // cross-references inline, which a naive (non-paragraph-anchored) marker
  // search could mistake for a real "(a)" limb.
  const spurious = findTerminationLimbChapeau({ section, admittedSourceContext, sectionReference: '7.1', citationReference: '7.1(z)' });
  assert.equal(spurious, null, 'a letter with no real marker in the text at all must fail closed');
});

test('unit: parseTerminationLimbDirection recognises "from X to Y" and "either X ... or Y", and fails closed on anything else', () => {
  assert.deepEqual(
    parseTerminationLimbDirection('(c) by written notice from the Company to Parent, if:'),
    { outcome: 'ONE_PARTY', granting_party: 'the Company' },
  );
  assert.deepEqual(
    parseTerminationLimbDirection('(d) by written notice from Parent to the Company, if:'),
    { outcome: 'ONE_PARTY', granting_party: 'Parent' },
  );
  assert.deepEqual(
    parseTerminationLimbDirection('(b) by either the Company, on the one hand, or Parent, on the other hand, by written notice to the other, if:'),
    {
      outcome: 'EITHER_PARTY',
      party_a: 'the Company',
      party_b: 'Parent',
      either_phrase: 'either the Company, on the one hand, or Parent, on the other hand',
    },
  );
  assert.deepEqual(parseTerminationLimbDirection('(e) if the sky is blue, if:'), { outcome: 'UNRECOGNISED' });
});

// Stage 1 (docs/codex-program/notes/structural-inheritance-diagnosis.md):
// the corpus's single most common mutual form -- plain "by either X or Y",
// no "on the one hand" -- plus the bare one-party limb head. Real drafting
// verbatim from Concho 8.1(b) and SkyWater's Article VIII, not invented.
test('unit: parseTerminationLimbDirection recognises the plain "by either X or Y" mutual head and the bare "(x) by X:" one-party head', () => {
  assert.deepEqual(
    parseTerminationLimbDirection('(b) by either the Company or Parent:'),
    {
      outcome: 'EITHER_PARTY', party_a: 'the Company', party_b: 'Parent', either_phrase: 'either the Company or Parent',
    },
  );
  assert.deepEqual(
    parseTerminationLimbDirection('(b) by either Parent or the Company, if:'),
    {
      outcome: 'EITHER_PARTY', party_a: 'Parent', party_b: 'the Company', either_phrase: 'either Parent or the Company',
    },
  );
  // Skechers: an "at any time prior to ... if" continuation after the pair.
  assert.deepEqual(
    parseTerminationLimbDirection('(c) by either Parent or the Company, at any time prior to the Effective Time if'),
    {
      outcome: 'EITHER_PARTY', party_a: 'Parent', party_b: 'the Company', either_phrase: 'either Parent or the Company',
    },
  );
  assert.deepEqual(
    parseTerminationLimbDirection('(c) by the Company:'),
    { outcome: 'ONE_PARTY', granting_party: 'the Company' },
  );
  assert.deepEqual(
    parseTerminationLimbDirection('(e) by Parent, if'),
    { outcome: 'ONE_PARTY', granting_party: 'Parent' },
  );
});

test('HOSTILE unit: the bare one-party grammar never reads a mutual head as a one-party grant, and never fires off the limb marker anchor', () => {
  // "by Parent or the Company" without "either" -- a mutual head; reading
  // it ONE_PARTY(Parent) would mint a one-sided right from mutual text.
  assert.deepEqual(
    parseTerminationLimbDirection('(b) by Parent or the Company, if:'),
    { outcome: 'UNRECOGNISED' },
  );
  assert.deepEqual(
    parseTerminationLimbDirection('(b) by the Company and Parent;'),
    { outcome: 'UNRECOGNISED' },
  );
  // Mid-chapeau "by Parent" (not anchored at the limb marker) must not fire
  // the bare grammar: the marker anchor is what scopes it to a genuine
  // limb-head grant rather than any "by X" phrase inside the limb's prose.
  assert.deepEqual(
    parseTerminationLimbDirection('(d) upon written notice delivered by Parent within five Business Days;'),
    { outcome: 'UNRECOGNISED' },
  );
  // The mutual-consent leaf limb carries no "by <party>" grant at all.
  assert.deepEqual(
    parseTerminationLimbDirection('(a) by mutual written consent of the Company and Parent;'),
    { outcome: 'UNRECOGNISED' },
  );
  // Compound party name (Step 2X-0 WIP remediation for fc0362bb): must not
  // truncate "the Company Stockholders' Representative" to "the Company".
  assert.deepEqual(
    parseTerminationLimbDirection('(f) by the Company Stockholders\' Representative, if:'),
    { outcome: 'UNRECOGNISED' },
  );
});

// Step 2X-0 WIP remediation (fc0362bb): three behaviours landed without
// unit coverage. Pins below.

test('unit: findTerminationLimbChapeau bounds a terminal leaf at newline/section-end when neither colon nor semicolon is present', () => {
  // Concho 8.1(f) shape: a lettered limb that ends with a period at the
  // section's own end, carrying neither ':' nor ';'.
  const sectionText = '(a) by mutual written consent;\n(f) by Parent upon written notice to the Company.';
  const admittedSourceContext = {
    // canonical_text_id is asserted as a full SHA-256 digest on this branch's
    // code path (assertDigest), so the fixture carries the REAL digest of its
    // own text rather than a placeholder — a fabricated digest would pass the
    // format check while lying about what it identifies.
    canonical_text: { text: sectionText, canonical_text_id: sha256Hex(Buffer.from(sectionText, 'utf8')) },
    canonical_text_id: sha256Hex(Buffer.from(sectionText, 'utf8')),
  };
  const section = { start: 0, end: Buffer.byteLength(sectionText, 'utf8') };
  const chapeau = findTerminationLimbChapeau({
    section,
    admittedSourceContext,
    sectionReference: '8.1',
    citationReference: '8.1(f)',
  });
  assert.ok(chapeau, 'terminal leaf must bound, not fail closed for want of :/;');
  assert.match(chapeau.chapeau_text, /^\(f\) by Parent/);
});

test('unit: findTerminationSectionEitherGrantContext returns the section-chapeau mutual grant when limbs carry grounds only', () => {
  // TopBuild 6.2 shape: party grant lives in the section chapeau; lettered
  // limbs are grounds-only.
  const sectionText = [
    'This Agreement may be terminated at any time prior to the Effective Time',
    ' by either Parent or the Company if:',
    '\n(a) the Company Stockholder Approval shall not have been obtained;',
    '\n(b) any Governmental Entity shall have issued an order.',
  ].join('');
  const admittedSourceContext = {
    // canonical_text_id is asserted as a full SHA-256 digest on this branch's
    // code path (assertDigest), so the fixture carries the REAL digest of its
    // own text rather than a placeholder — a fabricated digest would pass the
    // format check while lying about what it identifies.
    canonical_text: { text: sectionText, canonical_text_id: sha256Hex(Buffer.from(sectionText, 'utf8')) },
    canonical_text_id: sha256Hex(Buffer.from(sectionText, 'utf8')),
  };
  const section = { start: 0, end: Buffer.byteLength(sectionText, 'utf8') };
  // Trigger span starts at limb (a) -- grant must sit entirely before it.
  const limbA = sectionText.indexOf('\n(a)');
  const beforeAbsoluteStart = section.start + Buffer.byteLength(sectionText.slice(0, limbA), 'utf8');
  const hit = findTerminationSectionEitherGrantContext({
    section,
    admittedSourceContext,
    beforeAbsoluteStart,
    terminatingPartyRef: 'either Parent or the Company',
    partyScope: 'EITHER_PARTY',
  });
  assert.ok(hit);
  assert.ok(hit.span.absolute_end <= beforeAbsoluteStart);

  // Fail closed: ONE_PARTY scope never uses this tier.
  assert.equal(findTerminationSectionEitherGrantContext({
    section,
    admittedSourceContext,
    beforeAbsoluteStart,
    terminatingPartyRef: 'Parent',
    partyScope: 'ONE_PARTY',
  }), null);

  // Fail closed: claimed ref must appear verbatim in the grant text.
  assert.equal(findTerminationSectionEitherGrantContext({
    section,
    admittedSourceContext,
    beforeAbsoluteStart,
    terminatingPartyRef: 'either Buyer or the Seller',
    partyScope: 'EITHER_PARTY',
  }), null);
});

test('unit: findTerminationLimbGrantContext never rescues a party/scope combination the chapeau does not structurally support', () => {
  const admittedSourceContext = buildReplaySourceContext();
  const section = { start: 321761, end: 331500 };

  // The real, correct case: (d) grants to Parent, ONE_PARTY.
  const correct = findTerminationLimbGrantContext({
    section, admittedSourceContext, sectionReference: '7.1', citationReference: '7.1(d)(ii)',
    terminatingPartyRef: 'Parent', partyScope: 'ONE_PARTY',
  });
  assert.ok(correct);
  // utf8Slice, not a plain JS .slice(): correct.span's offsets are UTF-8
  // BYTE offsets into the full document, and this document's own curly
  // quotes mean a raw JS-string character-index slice at these same numeric
  // offsets would land on the wrong bytes.
  const { utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
  assert.equal(utf8Slice(admittedSourceContext.canonical_text.text, correct.span.absolute_start, correct.span.absolute_end),
    '(d) by written notice from Parent to the Company, if:');

  // The trap: claiming "the Company" for the SAME (d) limb. "the Company"
  // is real text genuinely near this quote (it is the TO party in the same
  // chapeau), so a naive substring check would pass it; the structural
  // direction parse must not.
  const swapped = findTerminationLimbGrantContext({
    section, admittedSourceContext, sectionReference: '7.1', citationReference: '7.1(d)(ii)',
    terminatingPartyRef: 'the Company', partyScope: 'ONE_PARTY',
  });
  assert.equal(swapped, null);

  // Scope mismatch: a real ONE_PARTY chapeau claimed as EITHER_PARTY.
  const scopeMismatch = findTerminationLimbGrantContext({
    section, admittedSourceContext, sectionReference: '7.1', citationReference: '7.1(c)(i)',
    terminatingPartyRef: 'the Company', partyScope: 'EITHER_PARTY',
  });
  assert.equal(scopeMismatch, null);

  // No terminating_party proposed at all.
  const noParty = findTerminationLimbGrantContext({
    section, admittedSourceContext, sectionReference: '7.1', citationReference: '7.1(b)(i)',
    terminatingPartyRef: null, partyScope: 'EITHER_PARTY',
  });
  assert.equal(noParty, null);
});
