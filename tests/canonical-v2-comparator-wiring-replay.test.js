'use strict';

/**
 * tests/canonical-v2-comparator-wiring-replay.test.js
 *
 * Comparator + lexical-net WIRING across all three recorded live runs
 * (docs/superpowers/specs/2026-08-02-comparator-wiring-design.md, section
 * 3). For each of TopBuild/F28, Skechers, and Modiv:
 *
 *  1. load the run's committed artifacts (run-receipt.json +
 *     adapter-result.json's admitted_source_contexts[0], the same loader
 *     pattern tests/canonical-v2-v1v2-comparator-wiring.test.js's FIXTURE
 *     PIN test uses) -- EXCEPT Skechers, whose committed run-receipt.json
 *     is the pre-citation-fix recording (tests/canonical-v2-skechers-
 *     replay.test.js); Skechers is replayed through the real admission
 *     chain + the recorded raw model response instead, exactly as that
 *     test does, using the LITERAL recorded governed_deal_key so the
 *     re-exported snapshot's deal_identity_bridge actually binds;
 *  2. resolveCandidates() PLAIN (no optional inputs);
 *  3. mint one lexical-disagreement receipt per governed section via
 *     computeSectionCandidatesForLexicalDigest (candidate-resolution.js,
 *     exported for exactly this) + buildLexicalDisagreementReceipt
 *     (lexical-disagreement-net.js), and build the v1v2 comparison receipt
 *     via buildV1V2ComparisonReceipt (v1v2-comparator.js) against this
 *     deal's re-exported real snapshot;
 *  4. resolveCandidates() AGAIN with BOTH v1v2_comparison and
 *     lexical_disagreement supplied.
 *
 * PINNED COUNTS -- DERIVATION NOTE (read before touching any assertion
 * below): every literal in this file was produced by actually running this
 * exact two-pass flow against the committed fixtures + the re-exported
 * snapshots (scratch derivation script, 2026-08-02) and transcribing the
 * output, per the spec's "hand-derived, pinned as literals with derivation
 * comments" instruction -- never invented.
 *
 * DEPARTURE FROM THE SPEC'S NARRATIVE TEXT ON SKECHERS/MODIV TIER 1 (flagged
 * for review, not silently reconciled): the design doc's prose describes
 * Skechers as "1 PRESENCE_AGREEMENT (3.7) + 1 SECTION_MISMATCH (3.8)" and
 * TopBuild/Modiv as both having "one CAP card each -- clean" (i.e.
 * agreement). Actually running the real, fixed pipeline against the
 * re-exported snapshots produces a DIFFERENT split for Skechers and Modiv:
 * v1v2-comparator.js's Tier 1 agreement test is EXACT STRING EQUALITY
 * between the v1 card's parsed `section_ref` and the v2 candidate's
 * citation-validation comparison string (the module's own pinned rule,
 * out of scope to change here). TopBuild's real REP-T-CAP card is already
 * recorded at SUBSECTION granularity ("3.1(b)"), matching the run's own
 * CORROBORATED_BY_DOCUMENT_TEXT normalized_citation "3.1(b)" exactly --
 * genuine agreement. Skechers' and Modiv's REP-T-CAP v1 cards are recorded
 * at SECTION granularity only ("3.7", "3.2" -- no subsection letter), while
 * both runs' own resolved REP-T-CAP claim (the measurement-date qualifier)
 * carries a citation at SUBSECTION granularity ("3.7(b)", "3.2(c)") via
 * CONSTRUCTED_FROM_TREE, never CORROBORATED_BY_DOCUMENT_TEXT for this
 * claim -- so neither string equals the v1 card's bare section number, and
 * BOTH deals' single CAP claim genuinely routes SECTION_MISMATCH under the
 * module's own strict-equality rule, verified by literally running it.
 * (For Skechers specifically, its snapshot's TWO REP-T-CAP cards --3.7 and
 * 3.8-- both then mismatch against the SAME lone v2 provision, same
 * severity-preference outcome the spec's own text describes: 2
 * SECTION_MISMATCH Tier-1 outcomes, not 1 agreement + 1 mismatch.) The
 * CLAIM-level consequence the spec's text emphasizes --
 * V1V2_SECTION_MISMATCH-blocked, deterministic_gates_passed false -- is
 * IDENTICAL either way and is exactly what is asserted below; only the
 * Tier-1 provision_outcomes split differs from the design doc's prose.
 * Everything else the spec pins (UNMAPPED sets/totals, both_nets_clean
 * zero everywhere, SOURCE_SCOPE_CERTIFICATION_ABSENT blocking, byte-
 * identical no-input additivity) reproduces exactly as stated below.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV13 } = require('../lib/canonical-v2/contract-bundle');
const { buildAdmittedSemanticSourceContext } = require('../lib/canonical-v2/admitted-semantic-source');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { verifySecHtmlCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text-verifier');
const { buildVerifiedSecSourceAdmission } = require('../lib/canonical-v2/sec-source-admission');
const { parseJSON } = require('../lib/parser-v2/parse-json');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  resolveCandidates, computeSectionCandidatesForLexicalDigest,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildLexicalDisagreementReceipt } = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');
const { buildV1V2ComparisonReceipt } = require('../lib/canonical-v2/native-producer/v1v2-comparator');

const AGREEMENT_DATE = '2026-04-18';
const CONTRACT_BUNDLE_V13 = compileFixtureContractV13();

function loadFixtureJson(dealDir, name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', dealDir, name), 'utf8'));
}

function loadSnapshot(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'v1v2-comparator', name), 'utf8'));
}

function sectionBodyText(canonicalText, section) {
  return Buffer.from(canonicalText, 'utf8').slice(section.start, section.end).toString('utf8');
}

// ─── TopBuild/F28 and Modiv: committed run-receipt.json's own
// compiled_candidates already carry the FIXED, correct citation_validation
// (both extracted after the citation-derivation fix landed) -- loaded
// directly, the same loader pattern as tests/canonical-v2-v1v2-comparator-
// wiring.test.js's FIXTURE PIN test. ───

function loadDirectRun(dealDir) {
  const runReceipt = loadFixtureJson(dealDir, 'run-receipt.json');
  const adapterResult = loadFixtureJson(dealDir, 'adapter-result.json');
  return { runReceipt, admittedSourceContext: adapterResult.admitted_source_contexts[0] };
}

// ─── Skechers: committed run-receipt.json is the STALE PRE-FIX recording
// (tests/canonical-v2-skechers-replay.test.js's own header) -- replayed
// through the real admission chain + the recorded raw model response,
// exactly as that test does, but with the LITERAL recorded governed_deal_key
// so the re-exported snapshot's deal_identity_bridge binds. ───

async function loadSkechersReplayRun() {
  const dealDir = 'skechers-first-live-run';
  const retrievalUrl = 'https://www.sec.gov/Archives/edgar/data/1065837/000119312525112159/d943603dex21.htm';
  const rawBytes = fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', dealDir, 'skechers-raw-fetched.htm'));
  const retrievalPolicyDigest = sha256Hex(
    'Skechers first live run pinning fetch: User-Agent "precedent-machine research bengoodchild@gmail.com", no redirects followed.',
  );
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: retrievalUrl, final_url: retrievalUrl, status_code: 200,
    content_type: 'text/html; charset=UTF-8', retrieved_at: '2026-08-01T12:34:55.229Z',
    retrieval_policy_digest: retrievalPolicyDigest, redirect_count: 0, response_bytes: rawBytes,
  });
  const conversion = convertSecHtmlToCanonicalText(capture);
  const verification = verifySecHtmlCanonicalText({ capture, conversion });
  assert.equal(verification.verification_status, 'PASS', 'independent canonical-text verification must PASS');
  const admissionBundle = buildVerifiedSecSourceAdmission({ capture, conversion, verification });
  const admittedSourceContext = buildAdmittedSemanticSourceContext({
    immutable_source_document: admissionBundle.immutable_source_document,
    source_admission_manifest: admissionBundle.source_admission_manifest,
    semantic_extraction_input_envelope: admissionBundle.semantic_extraction_input_envelope,
    conversion,
    // THE LITERAL RECORDED adapter-result governed_deal_key (spec audit
    // B-M3) -- matches the re-exported snapshot's deal_identity_bridge.
    governed_deal_key: 'deal:skechers-first-live-run:5e1d6f13ab83e3f9',
    deal_admission_id: sha256Hex('deal-admission:skechers-first-live-run'),
    source_ordinal: 0,
  });
  const recorded = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'canonical-v2', dealDir, 'native-producer-recorded-response.json'), 'utf8',
  ));
  const recordedParsed = parseJSON(recorded.raw_response_text);
  const runReceipt = await runNativeExtraction({
    source_text: conversion.canonical_text, document_hash: admittedSourceContext.document_hash,
    section_references: ['3.7'], contract_bundle: CONTRACT_BUNDLE_V13,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => {
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(recordedParsed, governedScope.source_text);
      return {
        provider_id: 'comparator-wiring-replay-test/skechers/v1', model_id: 'x', prompt: 'x',
        proposals, evidence_residuals: evidenceResiduals,
      };
    },
  });
  return { runReceipt, admittedSourceContext };
}

// ─── Shared two-pass flow: plain resolve -> mint lexical receipts per
// governed section + v1v2 comparison receipt -> resolve again with BOTH. ───

async function runTwoPassFlow({ runReceipt, admittedSourceContext, snapshot }) {
  const canonicalText = admittedSourceContext.canonical_text.text;

  const plain = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });

  const lexicalDisagreement = {};
  for (const section of runReceipt.resolved_sections) {
    const candidates = computeSectionCandidatesForLexicalDigest(plain.resolved, section.section_reference);
    const governedSection = {
      section_ref: section.section_reference,
      text: sectionBodyText(canonicalText, section),
      text_sha256: section.text_sha256,
    };
    lexicalDisagreement[section.section_reference] = buildLexicalDisagreementReceipt({
      governed_section: governedSection, candidates,
    });
  }

  // attempted_section_scope: the declared set of comparison strings this run
  // actually attempted, derived from the plain pass's own resolved claims
  // (the same v2-side comparison string v1v2-comparator.js's Tier 1 itself
  // reads -- citation_validation.normalized_citation when corroborated,
  // else derived_citation).
  const attemptedSectionScope = [...new Set(plain.resolved.map((entry) => {
    const citationValidation = entry.compiled_candidate && entry.compiled_candidate.citation_validation;
    if (!citationValidation) return null;
    if (citationValidation.validation_source === 'CORROBORATED_BY_DOCUMENT_TEXT'
      && typeof citationValidation.normalized_citation === 'string') return citationValidation.normalized_citation;
    return typeof citationValidation.derived_citation === 'string' ? citationValidation.derived_citation : null;
  }).filter(Boolean))];

  const comparison = buildV1V2ComparisonReceipt({
    v1_snapshot: snapshot, v2_side: plain, attempted_section_scope: attemptedSectionScope,
  });
  // Fable-review Finding 2: the receipt must pin the bumped table version.
  assert.equal(comparison.family_mapping_table_version, 2);

  const wired = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
    v1v2_comparison: comparison, lexical_disagreement: lexicalDisagreement,
  });

  return {
    plain, wired, comparison, lexicalDisagreement,
  };
}

// Programmatic UNMAPPED-set derivation (spec section "Sequencing"): the SET
// is computed from (snapshot subtypes minus the mapping table), not
// hardcoded card ids, so a later re-export/re-classification changes data,
// not test logic -- only the per-run TOTAL is pinned as a literal.
function unmappedSubtypeSummary(snapshot, mappedSubtypes) {
  const mappedSet = new Set(mappedSubtypes.map((entry) => entry.v1_provision_subtype));
  return snapshot.cards
    .filter((card) => card.provision_subtype == null || !mappedSet.has(card.provision_subtype))
    .map((card) => ({ id: card.id, subtype: card.provision_subtype, section_ref: card.section_ref }));
}

const { FAMILY_MAPPING_TABLE } = require('../lib/canonical-v2/native-producer/v1v2-comparator');

// ═══════════════════════════════════════════════════════════════════════
// TopBuild / F28 third live run.
// ═══════════════════════════════════════════════════════════════════════

test('TopBuild: two-pass wiring -- 1 PRESENCE_AGREEMENT (3.1(b)), 0 SECTION_MISMATCH, 0 UNMAPPED, both_nets_clean 0, auto_pass blocked on all resolved claims', async () => {
  const { runReceipt, admittedSourceContext } = loadDirectRun('f28-third-live-run');
  const snapshot = loadSnapshot('topbuild-v1-provision-snapshot.json');
  const { plain, wired, comparison } = await runTwoPassFlow({ runReceipt, admittedSourceContext, snapshot });

  assert.equal(plain.resolved.length, 3);
  assert.equal(plain.review_queue.length, 4);
  assert.equal(plain.open_world.length, 33);

  // Tier 1 (v1v2-comparator.js), pinned: 1 agreement (TopBuild's real CAP
  // card is already recorded at subsection granularity "3.1(b)", matching
  // the run's own CORROBORATED_BY_DOCUMENT_TEXT normalized_citation exactly).
  assert.deepEqual(comparison.counts.by_tier1_outcome, {
    V1V2_PRESENCE_AGREEMENT: 1, V1_MISSING: 0, V2_NOT_ATTEMPTED: 42, V2_MISSING: 0,
    SECTION_MISMATCH: 0, V1_CARD_UNMAPPED: 0,
  });
  assert.equal(comparison.provision_outcomes.length, 43, 'TopBuild snapshot: 43 real REPRESENTATION cards');

  // Programmatically-derived UNMAPPED set: pinned total 0 (every one of
  // TopBuild's 43 subtypes is in the version-2 mapping table).
  const unmapped = unmappedSubtypeSummary(snapshot, FAMILY_MAPPING_TABLE);
  assert.equal(unmapped.length, 0, 'TopBuild: 0 UNMAPPED cards');

  assert.equal(wired.resolved.length, 3, 'strictly additive on bucket sizes');
  for (const entry of wired.resolved) {
    assert.equal(entry.resolved_claim_definition_key, 'REPRESENTATION_MEASUREMENT_DATE');
    assert.ok(!entry.triage.reasons.includes('V1V2_SECTION_MISMATCH'));
    assert.ok(!('both_nets_clean' in entry.triage), 'condition 2 never evaluates clean -- REP-T-CAP has real lexical hits in this section');
    assert.ok(entry.triage.unevaluated_conditions.includes('SOURCE_SCOPE_CERTIFICATION_ABSENT'), 'M3 gate stays closed');
    assert.equal(entry.triage.auto_pass, false);
  }
  assert.equal(wired.resolution_receipt.lexical_disagreement_counts.both_nets_clean, 0);

  // Additivity: the plain (no-input) pass byte-identically reproduces a
  // fresh no-input call.
  const rerun = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });
  assert.equal(canonicalJson(rerun), canonicalJson(plain), 'no-input pins byte-identical');
});

// ═══════════════════════════════════════════════════════════════════════
// Skechers first live run.
// ═══════════════════════════════════════════════════════════════════════

test('Skechers: two-pass wiring -- 2 SECTION_MISMATCH Tier-1 outcomes (severity preference), 5 UNMAPPED (pinned set), both_nets_clean 0, resolved claim V1V2_SECTION_MISMATCH-blocked', async () => {
  const { runReceipt, admittedSourceContext } = await loadSkechersReplayRun();
  const snapshot = loadSnapshot('skechers-v1-provision-snapshot.json');
  assert.equal(snapshot.deal_identity_bridge.governed_deal_key, 'deal:skechers-first-live-run:5e1d6f13ab83e3f9');
  const { plain, wired, comparison } = await runTwoPassFlow({ runReceipt, admittedSourceContext, snapshot });

  assert.equal(plain.resolved.length, 1);
  assert.equal(plain.review_queue.length, 1);

  // Tier 1: BOTH of Skechers' two real REP-T-CAP cards (section refs "3.7"
  // and "3.8", both SECTION-granularity in v1) reference the run's single
  // resolved REP-T-CAP claim, whose own citation is SUBSECTION-granularity
  // ("3.7(b)", CONSTRUCTED_FROM_TREE, never CORROBORATED_BY_DOCUMENT_TEXT
  // for this specific claim) -- neither string equals either card's bare
  // section number under the module's exact-equality rule, so both cards
  // genuinely mismatch against the same lone v2 provision (see file header
  // for the full derivation and the departure from the design doc's prose).
  assert.deepEqual(comparison.counts.by_tier1_outcome, {
    V1V2_PRESENCE_AGREEMENT: 0, V1_MISSING: 0, V2_NOT_ATTEMPTED: 40, V2_MISSING: 0,
    SECTION_MISMATCH: 2, V1_CARD_UNMAPPED: 5,
  });
  assert.equal(comparison.provision_outcomes.length, 47);
  const mismatches = comparison.provision_outcomes.filter((o) => o.outcome === 'SECTION_MISMATCH');
  assert.deepEqual(mismatches.map((o) => o.v1_section).sort(), ['3.7', '3.8']);
  assert.ok(mismatches.every((o) => o.v2_provision_instance_id === mismatches[0].v2_provision_instance_id), 'both mismatches reference the SAME v2 provision -- severity preference applies');

  // Programmatically-derived UNMAPPED set: pinned total 5 -- null-subtype
  // cards (4.13, 4.10) + the held-back REP-T-CONSENT (3.4, 3.6) +
  // REP-B-ANTIRELIANCE (4.17) subtypes (docs/acks/FAMILY-MAPPING-RULINGS-
  // 2026-08-02.md).
  const unmapped = unmappedSubtypeSummary(snapshot, FAMILY_MAPPING_TABLE);
  assert.equal(unmapped.length, 5, 'Skechers: 5 UNMAPPED cards');
  assert.deepEqual(
    unmapped.map((c) => `${c.subtype || 'NULL'}@${c.section_ref.split(' | ')[0]}`).sort(),
    ['NULL@4.10', 'NULL@4.13', 'REP-B-ANTIRELIANCE@4.17', 'REP-T-CONSENT@3.4', 'REP-T-CONSENT@3.6'],
  );

  // Claim-level consequence, IDENTICAL to the spec's described outcome
  // regardless of the Tier-1 provision_outcomes split: severity preference
  // makes SECTION_MISMATCH win, the resolved claim is V1V2_SECTION_MISMATCH
  // blocked, deterministic_gates_passed false, auto_pass false.
  assert.equal(wired.resolved.length, 1);
  const claim = wired.resolved[0];
  assert.equal(claim.resolved_claim_definition_key, 'REPRESENTATION_MEASUREMENT_DATE');
  assert.ok(claim.triage.reasons.includes('V1V2_SECTION_MISMATCH'));
  assert.equal(claim.triage.deterministic_gates_passed, false, 'expected, not a bug -- spec section 3');
  assert.equal(claim.triage.auto_pass, false);
  assert.ok(!('both_nets_clean' in claim.triage));
  assert.ok(claim.triage.unevaluated_conditions.includes('SOURCE_SCOPE_CERTIFICATION_ABSENT'));
  assert.equal(wired.resolution_receipt.lexical_disagreement_counts.both_nets_clean, 0);

  const rerun = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });
  assert.equal(canonicalJson(rerun), canonicalJson(plain), 'no-input pins byte-identical');
});

// ═══════════════════════════════════════════════════════════════════════
// Modiv first live run.
// ═══════════════════════════════════════════════════════════════════════

test('Modiv: two-pass wiring -- 1 SECTION_MISMATCH Tier-1 outcome (same granularity mismatch as Skechers), 4 UNMAPPED (pinned set), both_nets_clean 0, resolved claim V1V2_SECTION_MISMATCH-blocked', async () => {
  const { runReceipt, admittedSourceContext } = loadDirectRun('modiv-first-live-run');
  const snapshot = loadSnapshot('modiv-v1-provision-snapshot.json');
  assert.equal(snapshot.deal_identity_bridge.governed_deal_key, 'deal:modiv-first-live-run:32065211e4688625');
  const { plain, wired, comparison } = await runTwoPassFlow({ runReceipt, admittedSourceContext, snapshot });

  assert.equal(plain.resolved.length, 1);
  assert.equal(plain.review_queue.length, 1);
  assert.equal(plain.open_world.length, 65);

  // Tier 1: Modiv's single real REP-T-CAP card is section-granularity
  // ("3.2"); the run's resolved claim carries subsection-granularity
  // citation "3.2(c)" -- same structural mismatch as Skechers (see file
  // header derivation note), so the sole card mismatches.
  assert.deepEqual(comparison.counts.by_tier1_outcome, {
    V1V2_PRESENCE_AGREEMENT: 0, V1_MISSING: 0, V2_NOT_ATTEMPTED: 43, V2_MISSING: 0,
    SECTION_MISMATCH: 1, V1_CARD_UNMAPPED: 4,
  });
  assert.equal(comparison.provision_outcomes.length, 48);
  const mismatch = comparison.provision_outcomes.find((o) => o.outcome === 'SECTION_MISMATCH');
  assert.equal(mismatch.v1_section, '3.2');
  assert.equal(mismatch.v2_section, '3.2(c)');

  // Programmatically-derived UNMAPPED set: pinned total 4 -- null-subtype
  // cards (4.16, 4.19) + REP-T-REGSTATUS (3.22) + REP-B-ANTIRELIANCE
  // (4.21), matching docs/acks/FAMILY-MAPPING-RULINGS-2026-08-02.md.
  const unmapped = unmappedSubtypeSummary(snapshot, FAMILY_MAPPING_TABLE);
  assert.equal(unmapped.length, 4, 'Modiv: 4 UNMAPPED cards');
  assert.deepEqual(
    unmapped.map((c) => `${c.subtype || 'NULL'}@${c.section_ref.split(' | ')[0]}`).sort(),
    ['NULL@4.16', 'NULL@4.19', 'REP-B-ANTIRELIANCE@4.21', 'REP-T-REGSTATUS@3.22'],
  );

  assert.equal(wired.resolved.length, 1);
  const claim = wired.resolved[0];
  assert.equal(claim.resolved_claim_definition_key, 'REPRESENTATION_MEASUREMENT_DATE');
  assert.ok(claim.triage.reasons.includes('V1V2_SECTION_MISMATCH'));
  assert.equal(claim.triage.deterministic_gates_passed, false);
  assert.equal(claim.triage.auto_pass, false);
  assert.ok(!('both_nets_clean' in claim.triage));
  assert.ok(claim.triage.unevaluated_conditions.includes('SOURCE_SCOPE_CERTIFICATION_ABSENT'));
  assert.equal(wired.resolution_receipt.lexical_disagreement_counts.both_nets_clean, 0);

  const rerun = resolveCandidates({
    run_receipt: runReceipt, contract_vocabulary: CONTRACT_BUNDLE_V13,
    admitted_source_context: admittedSourceContext, agreement_date: AGREEMENT_DATE,
  });
  assert.equal(canonicalJson(rerun), canonicalJson(plain), 'no-input pins byte-identical');
});

// ═══════════════════════════════════════════════════════════════════════
// Cross-run pin: both_nets_clean is ZERO on every claim in all three runs,
// BY CONSTRUCTION this slice (spec "Why" -- Ben's option A, every resolved
// claim is REP-family, REP cards carry no Tier 2 values, so condition 1
// stays V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM whenever it is not already
// blocked by a SECTION_MISMATCH).
// ═══════════════════════════════════════════════════════════════════════

test('cross-run pin: both_nets_clean is zero on every resolved claim across all three deals', async () => {
  const runs = await Promise.all([
    (async () => ({ ...loadDirectRun('f28-third-live-run'), snapshot: loadSnapshot('topbuild-v1-provision-snapshot.json') }))(),
    (async () => ({ ...(await loadSkechersReplayRun()), snapshot: loadSnapshot('skechers-v1-provision-snapshot.json') }))(),
    (async () => ({ ...loadDirectRun('modiv-first-live-run'), snapshot: loadSnapshot('modiv-v1-provision-snapshot.json') }))(),
  ]);
  let totalBothNetsClean = 0;
  for (const run of runs) {
    const { wired } = await runTwoPassFlow(run);
    totalBothNetsClean += wired.resolution_receipt.lexical_disagreement_counts.both_nets_clean;
    for (const entry of wired.resolved) {
      assert.ok(!entry.triage.both_nets_clean, 'zero by construction this slice -- Ben\'s option A');
    }
  }
  assert.equal(totalBothNetsClean, 0);
});
