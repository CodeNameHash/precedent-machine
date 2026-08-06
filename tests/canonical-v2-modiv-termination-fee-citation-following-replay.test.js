'use strict';

/**
 * tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js
 *
 * docs/codex-program/notes/claim-identity-reconciliation.md, acceptance
 * criteria 1 and 4: "Replaying the committed citation-following run yields
 * one row per distinct fact... Tests use the real recorded bytes from the
 * committed run."
 *
 * WHAT THIS PROVES. The committed run-receipt.json in evidence/canonical-v2/
 * modiv-termination-fee-citation-following-20260806/ -- the ALREADY-DISPATCHED
 * output of a live 14-call citation-following run, loaded verbatim, never
 * hand-edited -- is replayed through the REAL, current resolveCandidates,
 * buildNativeWriteSet and validateResolvedCanonicalWriteSet, exactly as
 * scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs itself
 * calls them. This file does not re-simulate the citation-following DISPATCH
 * orchestration (native-extraction-run-citation-followup.js has its own,
 * separate tests for that); it starts from the already-recorded receipt and
 * isolates what reconcileDuplicateTerminationFeeSightings and
 * mintPendingCitationRelationships do with it.
 *
 * Two things are checked against the COMMITTED evidence.json files
 * themselves (loaded, not retyped) rather than hand-copied hex literals:
 * every UNMERGED claim's occurrence identity (claim_occurrence_id,
 * subject_occurrence_id, evidence_ids) must be byte-identical to what the
 * original run published, and every MERGED claim's own attribute must name
 * the exact claim_occurrence_id the original run gave the sighting that got
 * folded into it. A hand-typed expected hex string proves nothing was
 * silently retyped to make the test pass; a live comparison against the
 * committed file does.
 *
 * Document identity: the same raw Modiv HTML fixture already committed for
 * tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js
 * (its own EXPECTED_RAW_BYTES_SHA256/EXPECTED_CANONICAL_TEXT_SHA256 are the
 * same two hashes this evidence run's own run-manifest.json records as
 * document_hash/source_sha256 -- re-asserted below, not assumed).
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
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');

const RAW_HTML_PATH = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const EVIDENCE_DIR = path.join(__dirname, '..', 'evidence', 'canonical-v2', 'modiv-termination-fee-citation-following-20260806');
const MODIV_RETRIEVAL_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';

// Same document as tests/canonical-v2-modiv-termination-fee-scope-correction-
// replay.test.js -- independently re-derived below, not trusted from either
// file's own constants.
const EXPECTED_RAW_BYTES_SHA256 = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';
const EXPECTED_CANONICAL_TEXT_SHA256 = '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e';

function loadJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, fileName), 'utf8'));
}

let cachedReplay = null;
function runReplay() {
  if (cachedReplay) return cachedReplay;
  cachedReplay = (async () => {
    const runReceipt = loadJson('run-receipt.json');
    const manifest = loadJson('run-manifest.json');
    const committedResolution = loadJson('resolution.json');
    const committedValidation = loadJson('validation.json');

    const rawBytes = fs.readFileSync(RAW_HTML_PATH);
    assert.equal(sha256Hex(rawBytes), EXPECTED_RAW_BYTES_SHA256, 'committed Modiv raw HTML must match the pinned hash');
    assert.equal(manifest.document_hash, EXPECTED_RAW_BYTES_SHA256, 'run-manifest.json document_hash must match the same raw-bytes hash');
    assert.equal(manifest.source_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'run-manifest.json source_sha256 must match the same canonical-text hash the scope-correction replay pins');

    const capture = buildSecEdgarIntakeCapture({
      retrieval_url: MODIV_RETRIEVAL_URL,
      final_url: MODIV_RETRIEVAL_URL,
      status_code: 200,
      content_type: 'text/html; charset=UTF-8',
      retrieved_at: '2026-08-06T04:00:00.000Z',
      retrieval_policy_digest: sha256Hex('canonical-v2-modiv-termination-fee-citation-following-replay.test.js: reuse of already-admitted raw HTML, no network fetch'),
      redirect_count: 0,
      response_bytes: rawBytes,
    });
    const conversion = convertSecHtmlToCanonicalText(capture);
    assert.equal(conversion.canonical_text_sha256, EXPECTED_CANONICAL_TEXT_SHA256, 'canonical text must match the pinned hash');
    const verification = verifySecHtmlCanonicalText({ capture, conversion });
    assert.equal(verification.verification_status, 'PASS');
    const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });

    // The ORIGINAL run's own deal identity, read from its own committed
    // validation.json (never hand-typed) -- source_occurrence_id, and
    // everything downstream of it (every provision_instance_id, every
    // claim_occurrence_id), is a content hash that includes deal_key and
    // deal_admission_id, so reproducing the original run's own exact,
    // already-published ids (the whole point of the byte-identity
    // assertions below) requires reusing them exactly, not inventing a
    // fresh, equally-valid but differently-hashed identity.
    const dealKey = committedValidation.publishableWriteSet.deal.deal_key;
    const dealAdmissionId = committedValidation.publishableWriteSet.deal.deal_admission_id;
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

    const contractBundle = compileFixtureContractV34();

    const resolution = resolveCandidates({
      run_receipt: runReceipt,
      contract_vocabulary: contractBundle,
      admitted_source_context: admittedSourceContext,
      agreement_date: manifest.agreement_date,
    });

    const resolvedRunReceipt = {
      ...runReceipt,
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
      runReceipt, manifest, committedResolution, committedValidation, resolution, adapterResult, writeSet, validation,
    };
  })();
  return cachedReplay;
}

function findResolved(resolution, sectionReference, claimDefinitionKey) {
  return resolution.resolved.find(
    (r) => r.section_reference === sectionReference && r.resolved_claim_definition_key === claimDefinitionKey,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Grounding: the evidence bundle really does carry the defects this file
// exists to prove fixed. If either of these fails, this file's own "before"
// half is measuring the wrong thing.
// ─────────────────────────────────────────────────────────────────────────

test('grounding: the committed (pre-fix) resolution.json really does publish the Superior Proposal ground three times and the tail period twice', async () => {
  const { committedResolution } = await runReplay();
  const triggerRows = committedResolution.resolved.filter(
    (r) => r.resolved_claim_definition_key === 'TERMINATION_FEE_TRIGGER' && r.claim.canonical_value === 'SUPERIOR_PROPOSAL_TERMINATION',
  );
  assert.equal(triggerRows.length, 3, 'the committed evidence must show the exact defect this fix addresses');
  assert.deepEqual(triggerRows.map((r) => r.section_reference).sort(), ['7.1', '7.1(c)(i)', '7.3']);

  const tailRows = committedResolution.resolved.filter(
    (r) => r.resolved_claim_definition_key === 'TERMINATION_FEE_TAIL_PERIOD_MONTHS' && r.claim.canonical_value === '12',
  );
  assert.equal(tailRows.length, 2);
  assert.deepEqual(tailRows.map((r) => r.section_reference).sort(), ['7.3', '7.3(b)(iii)']);

  assert.equal(committedResolution.resolved.length, 9);
});

test('grounding: the committed (pre-fix) validation.json really does carry one quarantined SEMANTIC_REFERENCE_UNRESOLVED relationship', async () => {
  const { committedValidation } = await runReplay();
  assert.equal(committedValidation.quarantines.length, 1);
  assert.equal(committedValidation.quarantines[0].reason_code, 'UNRESOLVED_RESIDUAL');
  const residual = committedValidation.residuals.find((r) => r.reason_code === 'SEMANTIC_REFERENCE_UNRESOLVED');
  assert.ok(residual, 'the committed evidence must show the exact dangling relationship this fix addresses');
  assert.equal(residual.source_kind, 'relationships');
});

// ─────────────────────────────────────────────────────────────────────────
// Acceptance criterion 1: one row per distinct fact.
// ─────────────────────────────────────────────────────────────────────────

test('acceptance 1: resolved claims go from 9 to 6 -- exactly the Superior Proposal and tail-period duplicates merge, nothing else moves', async () => {
  const { resolution, committedResolution } = await runReplay();

  assert.equal(committedResolution.resolved.length, 9, 'grounding: original committed count');
  assert.equal(resolution.resolved.length, 6, 'fixed: reconciled count');

  // The two genuinely different $15,000,000.00 facts must both still be
  // present and still distinguished by concept_key -- the one merge this
  // fix must never perform.
  const amountRows = resolution.resolved.filter((r) => r.resolved_claim_definition_key === 'TERMINATION_FEE_AMOUNT');
  assert.equal(amountRows.length, 3);
  const amountsByConceptAndValue = amountRows
    .map((r) => `${r.concept_key}:${r.claim.canonical_value}`)
    .sort();
  assert.deepEqual(amountsByConceptAndValue, ['TERMF-REVERSE:15000000.00', 'TERMF-TARGET:10000000', 'TERMF-TARGET:15000000.00']);

  // The Change-in-Recommendation ground was sighted only once in this run
  // (7.1(d)(ii)) -- untouched, still its own row.
  const changeInRecRows = resolution.resolved.filter((r) => r.claim.canonical_value === 'CHANGE_IN_RECOMMENDATION_TERMINATION');
  assert.equal(changeInRecRows.length, 1);
  assert.equal(changeInRecRows[0].section_reference, '7.1(d)(ii)');

  // Exactly one Superior Proposal trigger row, exactly one tail-period row.
  const triggerRows = resolution.resolved.filter(
    (r) => r.resolved_claim_definition_key === 'TERMINATION_FEE_TRIGGER' && r.claim.canonical_value === 'SUPERIOR_PROPOSAL_TERMINATION',
  );
  assert.equal(triggerRows.length, 1);
  assert.equal(triggerRows[0].section_reference, '7.1(c)(i)', 'the cited sub-clause -- direct corroboration, most specific reference -- wins');

  const tailRows = resolution.resolved.filter((r) => r.resolved_claim_definition_key === 'TERMINATION_FEE_TAIL_PERIOD_MONTHS');
  assert.equal(tailRows.length, 1);
  assert.equal(tailRows[0].section_reference, '7.3(b)(iii)', 'the cited sub-clause wins here too, same reasoning');
});

// NOTE ON IDENTITY ACROSS RUNS. The original run's own admission (scripts/
// canonical-v2-modiv-termination-fee-scope-correction-run.mjs) stamps
// retrieved_at: new Date().toISOString() -- a live timestamp, not recorded
// verbatim in any committed evidence file -- into the document admission
// this replay independently rebuilds. source_occurrence_id, and everything
// hashed from it (every provision_instance_id, every claim_occurrence_id),
// is therefore NEVER expected to come out byte-identical to the committed
// resolution.json's own ids, in this run or any other replay of it: that is
// a property of the admission event, not of document content, and this
// replay intentionally re-admits the same bytes as its own, fresh event
// (still checked, above, against the same document_hash/canonical_text
// hashes -- what must never drift). The tests below instead prove identity
// stability WITHIN this one fresh run (a merged-away sighting's id, as
// independently recorded by the winner's own attribute AND by its own
// residual, must agree with each other) and prove exact, hermetic
// occurrence-identity preservation directly against
// reconcileDuplicateTerminationFeeSightings in tests/canonical-v2-claim-
// identity-reconciliation.test.js, where a hand-built, fully-known input
// makes an exact-id assertion meaningful.

test('acceptance 1 (named): the Superior Proposal winner (7.1(c)(i)) names both merged sightings by section, internally consistent with its own residuals', async () => {
  const { resolution } = await runReplay();
  const winner = findResolved(resolution, '7.1(c)(i)', 'TERMINATION_FEE_TRIGGER');
  assert.ok(winner);
  const merged = winner.claim.attributes.duplicate_sightings_merged;
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((m) => m.section_reference).sort(), ['7.1', '7.3']);

  // Every id the winner's own attribute names must be independently
  // corroborated by this SAME run's own DUPLICATE_FACT_SIGHTING_MERGED
  // residuals -- two independently-computed records of the same fold must
  // agree with each other.
  const mergeResiduals = resolution.residuals.filter(
    (r) => r.residual_type === 'DUPLICATE_FACT_SIGHTING_MERGED' && r.winning_claim_occurrence_id === winner.claim.claim_occurrence_id,
  );
  assert.equal(mergeResiduals.length, 2);
  assert.deepEqual(
    mergeResiduals.map((r) => r.merged_claim_occurrence_id).sort(),
    merged.map((m) => m.claim_occurrence_id).sort(),
  );
});

test('acceptance 1 (named): the tail-period winner (7.3(b)(iii)) names its one merged sighting the same way, internally consistent with its own residual', async () => {
  const { resolution } = await runReplay();
  const winner = findResolved(resolution, '7.3(b)(iii)', 'TERMINATION_FEE_TAIL_PERIOD_MONTHS');
  assert.ok(winner);
  const merged = winner.claim.attributes.duplicate_sightings_merged;
  assert.equal(merged.length, 1);
  assert.equal(merged[0].section_reference, '7.3');

  const mergeResidual = resolution.residuals.find(
    (r) => r.residual_type === 'DUPLICATE_FACT_SIGHTING_MERGED' && r.winning_claim_occurrence_id === winner.claim.claim_occurrence_id,
  );
  assert.ok(mergeResidual);
  assert.equal(mergeResidual.merged_claim_occurrence_id, merged[0].claim_occurrence_id);
});

test('acceptance 1: every claim NOT part of a merge resolves under the SAME content identity (section, concept, party, value) the committed run gave it, and carries no merge attribute', async () => {
  const { resolution, committedResolution } = await runReplay();
  const untouched = [
    ['8.12', 'TERMINATION_FEE_AMOUNT', 'TERMF-TARGET', '10000000'],
    ['8.12', 'TERMINATION_FEE_AMOUNT', 'TERMF-TARGET', '15000000.00'],
    ['8.12', 'TERMINATION_FEE_AMOUNT', 'TERMF-REVERSE', '15000000.00'],
    ['7.1(d)(ii)', 'TERMINATION_FEE_TRIGGER', 'TERMF-TARGET', 'CHANGE_IN_RECOMMENDATION_TERMINATION'],
  ];
  for (const [sectionReference, claimDefinitionKey, conceptKey, canonicalValue] of untouched) {
    const fresh = resolution.resolved.find(
      (r) => r.section_reference === sectionReference && r.resolved_claim_definition_key === claimDefinitionKey
        && r.concept_key === conceptKey && r.claim.canonical_value === canonicalValue,
    );
    const committed = committedResolution.resolved.find(
      (r) => r.section_reference === sectionReference && r.resolved_claim_definition_key === claimDefinitionKey
        && r.concept_key === conceptKey && r.claim.canonical_value === canonicalValue,
    );
    assert.ok(fresh, `expected ${sectionReference}/${claimDefinitionKey}/${conceptKey}/${canonicalValue} to still resolve`);
    assert.ok(committed, `grounding: expected the committed run to also carry ${sectionReference}/${claimDefinitionKey}/${conceptKey}/${canonicalValue}`);
    assert.equal('duplicate_sightings_merged' in fresh.claim.attributes, false, `${sectionReference} must not carry a merge attribute -- it was never part of a group`);
    assert.equal(fresh.party.value, committed.party.value, `${sectionReference} party is unaffected by reconciliation`);
    assert.equal(fresh.claim.raw_value, committed.claim.raw_value, `${sectionReference} raw_value is byte-identical to the committed run's own recorded quote`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Grounds-to-amount mapping (docs/codex-program/notes/grounds-to-amount-
// mapping.md; acceptance criterion 1 of that task): replaying THIS SAME
// committed run -- no prompt change, no new field the model was ever
// asked for, the identical frozen recorded responses already loaded above
// -- now associates each Modiv Company Base Amount limb with its own
// grounds, derived entirely from the model's own already-extracted
// fee_trigger_assertions (evidence/canonical-v2/modiv-termination-fee-
// citation-following-20260806/native-producer-recorded-response-8.12.json),
// never from a hardcoded Modiv literal.
// ─────────────────────────────────────────────────────────────────────────

test('grounds-to-amount mapping: each Modiv Company Base Amount limb resolves with its OWN, distinct grounds; the unconditional Parent Base Amount carries none', async () => {
  const { resolution } = await runReplay();

  const tenMillion = resolution.resolved.find(
    (r) => r.section_reference === '8.12' && r.resolved_claim_definition_key === 'TERMINATION_FEE_AMOUNT'
      && r.concept_key === 'TERMF-TARGET' && r.claim.canonical_value === '10000000',
  );
  assert.ok(tenMillion);
  assert.equal(tenMillion.claim.attributes.grounds_quote, 'if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii)');
  assert.deepEqual(tenMillion.claim.attributes.grounds_cited_references, ['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)']);

  const fifteenMillionTarget = resolution.resolved.find(
    (r) => r.section_reference === '8.12' && r.resolved_claim_definition_key === 'TERMINATION_FEE_AMOUNT'
      && r.concept_key === 'TERMF-TARGET' && r.claim.canonical_value === '15000000.00',
  );
  assert.ok(fifteenMillionTarget);
  assert.equal(fifteenMillionTarget.claim.attributes.grounds_quote, 'if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v)');
  assert.deepEqual(fifteenMillionTarget.claim.attributes.grounds_cited_references, ['7.3(b)(iv)', '7.3(b)(v)']);

  // The unconditional Parent Base Amount (BUYER side) shares section 8.12
  // with both SELLER-side grounds candidates above -- proves the mapping is
  // keyed on textual nesting within THIS claim's own quote, never merely
  // "some bare citation exists somewhere in the same section".
  const parentAmount = resolution.resolved.find(
    (r) => r.section_reference === '8.12' && r.resolved_claim_definition_key === 'TERMINATION_FEE_AMOUNT'
      && r.concept_key === 'TERMF-REVERSE',
  );
  assert.ok(parentAmount);
  assert.equal('grounds_quote' in parentAmount.claim.attributes, false);
  assert.equal('grounds_cited_references' in parentAmount.claim.attributes, false);

  // Every cited reference resolved cleanly this run (7.3(b)(i)-(v) are all
  // real, dispatched sections) -- no FEE_AMOUNT_GROUNDS_* residual, and the
  // total residual count is unchanged from the pre-existing "acceptance 1 +
  // 2 combined" test's own pin (4), proving this feature added nothing to
  // account for on the one run that matters most.
  assert.equal(resolution.residuals.filter((r) => r.residual_type.startsWith('FEE_AMOUNT_GROUNDS')).length, 0);
  assert.equal(resolution.residuals.length, 4);
});

// ─────────────────────────────────────────────────────────────────────────
// Acceptance criterion 2: no quarantined relationship, achieved by not
// minting a dangling one.
// ─────────────────────────────────────────────────────────────────────────

test('acceptance 2: no relationship is minted at all -- the only candidate that could have been its source (7.3\'s citing claim) was merged away', async () => {
  const { resolution } = await runReplay();
  assert.equal(resolution.relationships, undefined, 'omitted entirely, same convention as every other run that mints nothing');
  assert.equal('relationships' in resolution.resolution_receipt.counts, false);

  const mintFailed = resolution.residuals.find((r) => r.residual_type === 'CITATION_RELATIONSHIP_MINT_FAILED');
  assert.ok(mintFailed, 'the decision not to mint must be explainable, not silent');
  assert.equal(mintFailed.section_reference, '7.3');
  assert.equal(mintFailed.cited_reference, '7.1(c)(i)');
  assert.equal(mintFailed.reason, 'CITING_CLAIM_NOT_PUBLISHED');
});

test('acceptance 2: the full write set validates clean -- zero residuals, zero quarantines, publishable', async () => {
  const { validation } = await runReplay();
  assert.equal(validation.accepted, true);
  assert.equal(validation.residuals.length, 0, 'no dangling reference of any kind reaches the validator');
  assert.equal(validation.quarantines.length, 0, 'nothing is quarantined -- this is the direct fix for the committed run\'s own SEMANTIC_REFERENCE_UNRESOLVED quarantine');
  assert.ok(validation.publishableWriteSet);
  assert.equal(validation.publishableWriteSet.claims.length, 6);
  assert.equal((validation.publishableWriteSet.relationships || []).length, 0);
});

test('acceptance 1 + 2 combined: every DUPLICATE_FACT_SIGHTING_MERGED and CITATION_RELATIONSHIP_MINT_FAILED residual is accounted for, none extra, none missing', async () => {
  const { resolution } = await runReplay();
  const mergeResiduals = resolution.residuals.filter((r) => r.residual_type === 'DUPLICATE_FACT_SIGHTING_MERGED');
  assert.equal(mergeResiduals.length, 3, 'two Superior Proposal sightings plus one tail-period sighting merged away');
  assert.deepEqual(
    mergeResiduals.map((r) => r.merged_section_reference).sort(),
    ['7.1', '7.3', '7.3'],
  );
  assert.ok(mergeResiduals.every((r) => r.winning_section_reference === '7.1(c)(i)' || r.winning_section_reference === '7.3(b)(iii)'));

  const mintFailedResiduals = resolution.residuals.filter((r) => r.residual_type === 'CITATION_RELATIONSHIP_MINT_FAILED');
  assert.equal(mintFailedResiduals.length, 1);

  assert.equal(resolution.residuals.length, 4, 'exactly these four, nothing else');
});
