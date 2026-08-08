/* PLAN.md Step 3D hostile test: a quote whose governing negation has been
   trimmed off must be refused at the RESOLVER
   (lib/canonical-v2/native-producer/candidate-resolution.js), not only at
   the ingestion gate (lib/verification.js, covered by
   tests/negation-boundary-guard.test.js) or at a preview bridge (covered
   by tests/canonical-v2-representations-dark-bridge.test.js's "FIXED"
   tests).

   ALL source text below is REAL, committed merger-agreement text --
   TopBuild's actually-filed SEC merger agreement
   (tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm),
   run through this repo's own real HTML-to-canonical-text pipeline
   (convertSecHtmlToCanonicalText, via buildSecEdgarIntakeCapture -- the
   same conversion tests/negation-boundary-guard.test.js and
   tests/canonical-v2-native-sectionizer.test.js's REAL_FILINGS already
   use). No invented contract prose. The two quotes this file compares
   (GENUINE_TIER_QUOTE and ATTACK_TIER_QUOTE) are both computed by locating
   real byte offsets inside that converted text, not hand-typed, so a
   future re-conversion that shifts the document cannot silently make this
   test compare against stale text.

   See docs/codex-program/notes/negation-reversal.md for the original
   investigation (verification.js and representations-dark-bridge.js) and
   docs/codex-program/notes/step-3d-3i.md for what this file adds: the
   resolver-side half of the fix, at BRING_DOWN_TIER_CLAIM_KEY, and why the
   same fix was investigated and deliberately NOT wired into
   handleRepresentationQualifierCarrier's ACCURACY path (a real,
   corpus-proven false-positive, documented in candidate-resolution.js
   itself at that function).

   Run: CI=true node --test tests/canonical-v2-negation-boundary-resolver.test.js
*/
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const {
  shapeProposals,
  BRING_DOWN_TIER_CLAIM_KEY,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { hasUnclosedNegationBeforeSpan } = require('../lib/negation-boundary-guard');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family');

function realFilingCanonicalText(filename) {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, filename));
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/negation-boundary-resolver-test.htm',
    final_url: 'https://www.sec.gov/Archives/edgar/data/1/negation-boundary-resolver-test.htm',
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-07T00:00:00.000Z',
    retrieval_policy_digest: sha256Hex('tests/canonical-v2-negation-boundary-resolver.test.js'),
    redirect_count: 0,
    response_bytes: raw,
  });
  return convertSecHtmlToCanonicalText(capture).canonical_text;
}

// Converted once: TopBuild's real filing, same conversion
// tests/negation-boundary-guard.test.js already pays for independently.
const TOPBUILD = realFilingCanonicalText('topbuild-raw-fetched.htm');

// ─── Locate the real clause by real anchor strings, never by hand-typed
// full text (TopBuild's own smart quotes/dashes are easy to mistranscribe;
// this makes a mismatch fail loudly instead of silently comparing against
// invented prose). ───

function realIndexOf(haystack, needle, label) {
  const idx = haystack.indexOf(needle);
  assert.ok(idx !== -1, `expected to find real TopBuild text for ${label}: ${JSON.stringify(needle)}`);
  return idx;
}

const CLAUSE_D_START = '(D) any of the other representations and';
const NEGATION_LEAD_IN = 'would not, individually or in the aggregate, reasonably be expected to ';
const NEGATION_TAIL = 'have a Company Material Adverse Effect';
const PROVIDED_CLAUSE = '; provided, however, that, with respect to clauses (A), (B), (C) and (D) above, '
  + 'representations and warranties that are made as of a particular date or period shall be true and correct '
  + '(in the manner set forth in clause (A), (B), (C) or (D), as applicable) only as of such date or period.';

const sentenceStart = realIndexOf(TOPBUILD, CLAUSE_D_START, 'clause (D) sentence start');
// The identical negation lead-in occurs twice in the real filing (a
// Company Material Adverse Effect clause and a parallel Parent Material
// Adverse Effect clause); searching from sentenceStart finds clause (D)'s
// own occurrence, not the other one.
const negationStart = TOPBUILD.indexOf(NEGATION_LEAD_IN, sentenceStart);
assert.ok(negationStart >= sentenceStart, 'expected to find the real MAE negation lead-in inside clause (D)\'s own sentence');
const negationTailStart = negationStart + NEGATION_LEAD_IN.length;
assert.ok(TOPBUILD.startsWith(NEGATION_TAIL, negationTailStart),
  `expected the real negated MAE tail immediately after the lead-in: ${JSON.stringify(NEGATION_TAIL)}`);
const providedClauseStart = realIndexOf(TOPBUILD, PROVIDED_CLAUSE, 'the trailing "provided, however" clause');
assert.ok(providedClauseStart >= negationTailStart + NEGATION_TAIL.length,
  'the "provided, however" clause must follow the negated MAE tail in the real document');

// GENUINE: the whole real clause (D) sentence, exactly as a correct
// extraction would quote it -- the accuracy standard together with the MAE
// qualifier that actually governs it.
const GENUINE_TIER_QUOTE = TOPBUILD.slice(sentenceStart, negationTailStart + NEGATION_TAIL.length);

// ATTACK: a genuine, byte-verifiable, word-boundary-aligned CONTIGUOUS
// substring of the identical real sentence -- but starting exactly where
// the real negation lead-in ends, so the text immediately before its own
// start in the filed document is "...would not, individually or in the
// aggregate, reasonably be expected to ". Reads as an unqualified
// assertion ("have a Company Material Adverse Effect...") where the real
// clause is a NEGATED carve-out ("would NOT... have a MAE"). This is not
// hypothetical: checkEvidenceScope (native-extraction-run.js) only ever
// requires raw_value to reproduce the source bytes at its own claimed
// span -- it has no opinion on whether that span's start is a sound place
// to begin quoting from.
const ATTACK_TIER_QUOTE = TOPBUILD.slice(negationTailStart, providedClauseStart + PROVIDED_CLAUSE.length);

// The real sentence, in full, through its own trailing "provided, however"
// clause -- this is what actually sits in the filed document and is what
// gets embedded as the section's own body text below. Both GENUINE_TIER_
// QUOTE and ATTACK_TIER_QUOTE are contiguous substrings of this same real
// text, differing only in where the extraction's own span starts.
const FULL_REAL_SENTENCE = TOPBUILD.slice(sentenceStart, providedClauseStart + PROVIDED_CLAUSE.length);
assert.ok(FULL_REAL_SENTENCE.includes(GENUINE_TIER_QUOTE));
assert.ok(FULL_REAL_SENTENCE.includes(ATTACK_TIER_QUOTE));

test('sanity: the guard itself flags the real attack position and clears the real genuine position', () => {
  const attackPos = realIndexOf(TOPBUILD, ATTACK_TIER_QUOTE, 'ATTACK_TIER_QUOTE');
  const genuinePos = realIndexOf(TOPBUILD, GENUINE_TIER_QUOTE, 'GENUINE_TIER_QUOTE');
  assert.equal(hasUnclosedNegationBeforeSpan(TOPBUILD, attackPos), true);
  assert.equal(hasUnclosedNegationBeforeSpan(TOPBUILD, genuinePos), false);
});

// ─── A minimal, realistic document shell embedding the real clause as the
// body of a closing-conditions section, converted through the real
// deterministic sectionizer and candidate-resolution pipeline -- not a
// hand-built run_receipt. Mirrors
// tests/canonical-v2-candidate-resolution.test.js's own qxoFullText shell
// (same ARTICLE/Section header shape), swapped to a closing-conditions
// article since that is BRING_DOWN_TIER_CLAIM_KEY's real home. ───

function buildDocumentText(clauseText) {
  return [
    'This AGREEMENT AND PLAN OF MERGER, dated as of June 19, 2023, by and among ',
    'TopBuild Corp. and SPI Holdco, Inc.\n\n',
    'ARTICLE VIII\n\nCONDITIONS TO THE MERGER\n\n',
    'Section 8.2 Conditions to Obligations of Parent and Merger Sub.\n\n',
    '(a)Representations and Warranties. ', clauseText, '\n\n',
    '(b)Other Conditions. Reserved.\n\n',
  ].join('');
}

const SECTION_REFERENCE = '8.2(a)';
const CONTRACT_BUNDLE = compileFixtureContract();

function parsedResponse(quote) {
  return {
    representation_instances: [],
    bring_down_conditions: [{
      section_reference: SECTION_REFERENCE,
      condition_obligor: 'the Company',
      beneficiary: 'Parent',
      measurement_date_quote: null,
      tiers: [{
        accuracy_standard: 'MAT_MAE_QUALIFIED',
        covered_scope_quote: quote,
        covered_limb_references: [],
        scrape_quote: null,
        exception_quote: null,
      }],
      nested_definitions: [],
    }],
    open_world_candidates: [],
  };
}

function realProducerProvider(quote) {
  return async ({ governed_scope: governedScope }) => {
    const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
      parsedResponse(quote),
      governedScope.source_text,
    );
    return {
      provider_id: 'negation-boundary-resolver-test/v1',
      model_id: 'stub-model',
      prompt: 'negation-boundary-resolver-test-prompt/v1',
      proposals,
      evidence_residuals: evidenceResiduals,
    };
  };
}

async function resolveTier(clauseText, quote) {
  const documentText = buildDocumentText(clauseText);
  const documentHash = sha256Hex(Buffer.from(documentText, 'utf8'));
  const receipt = await runNativeExtraction({
    source_text: documentText,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: CONTRACT_BUNDLE,
    definitions: { known_definitions: [] },
    provider: realProducerProvider(quote),
  });
  const admittedSourceContext = buildIdentityAdmittedSourceContext(documentText, {
    dealKey: 'deal:negation-boundary-resolver-test',
    dealAdmissionId: sha256Hex(`deal-admission:negation-boundary-resolver-test:${sha256Hex(quote)}`),
    sourceOrdinal: 0,
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: CONTRACT_BUNDLE,
    admitted_source_context: admittedSourceContext,
  });
  return { receipt, resolution };
}

test('BRING_DOWN_TIER_CLAIM_KEY: a genuine, real, unnegated bring-down clause resolves normally', async () => {
  const { receipt, resolution } = await resolveTier(FULL_REAL_SENTENCE, GENUINE_TIER_QUOTE);
  assert.equal(receipt.compiled_candidates.filter((entry) => entry.ok).length, 1, 'the tier proposal compiled');
  const tier = resolution.resolved.find((entry) => entry.generic_claim_key === BRING_DOWN_TIER_CLAIM_KEY);
  assert.ok(tier, 'the genuine bring-down tier resolved');
  assert.equal(tier.resolved_claim_definition_key, 'REPRESENTATION_ACCURACY_STANDARD');
  assert.equal(tier.claim.canonical_value, 'MAT_MAE_QUALIFIED');
  assert.equal(
    resolution.review_queue.some((item) => item.reasons.includes('REPRESENTATION_ACCURACY_STANDARD_GOVERNING_NEGATION_TRIMMED')),
    false,
    'a genuine, unnegated quote must never be flagged as negation-trimmed',
  );
});

test('PLAN.md Step 3D FIXED: BRING_DOWN_TIER_CLAIM_KEY refuses a real, byte-verified quote whose governing MAE negation was trimmed off its own front', async () => {
  const { receipt, resolution } = await resolveTier(FULL_REAL_SENTENCE, ATTACK_TIER_QUOTE);
  assert.equal(receipt.compiled_candidates.filter((entry) => entry.ok).length, 1, 'the attack proposal still compiled -- checkEvidenceScope has no opinion on where a span starts');

  // The defect this step closes: absent the fix, this exact candidate
  // resolves to REPRESENTATION_ACCURACY_STANDARD/MAT_MAE_QUALIFIED with no
  // review flag at all -- BRING_DOWN_TIER_CLAIM_KEY's own table entry is
  // "gated only by allowed-values membership" (candidate-resolution.js's
  // own comment on that table entry), with no lexicon or pattern check
  // tying raw_value's text to canonical_value's code. Proved never
  // resolved, after the fix:
  const tier = resolution.resolved.find((entry) => entry.generic_claim_key === BRING_DOWN_TIER_CLAIM_KEY);
  assert.equal(tier, undefined, 'a negation-trimmed quote must never reach `resolved`');

  const flagged = resolution.review_queue.find(
    (item) => item.generic_claim_key === BRING_DOWN_TIER_CLAIM_KEY
      && item.reasons.includes('REPRESENTATION_ACCURACY_STANDARD_GOVERNING_NEGATION_TRIMMED'),
  );
  assert.ok(flagged, 'the attack must be refused with the negation-trimmed reason, in review_queue');
  assert.equal(flagged.raw_value, ATTACK_TIER_QUOTE, 'the refused item still carries its own text for a human to check');
});

// ─── Regression: a REAL false-positive shape found while investigating
// this step (see candidate-resolution.js's own comment at
// handleRepresentationQualifierCarrier, and docs/codex-program/notes/
// step-3d-3i.md) -- Modiv's real filed bring-down clause has "...(y) that
// are NOT qualified by materiality or Company Material Adverse Effect
// shall be true and correct in all material respects..." where "are not"
// genuinely precedes "true and correct in all material respects" within
// the guard's lookback window, but negates "qualified by materiality" (a
// different clause, describing which reps this tier covers), not the
// accuracy standard itself. That shape false-positives ONLY when the
// negation-adjacent "(y) that are not qualified..." lead-in is trimmed
// OFF the quote (exactly the same trim shape as an attack) -- a realistic,
// CONTEXTUAL bring-down quote that includes its own scope lead-in, the
// normal shape for this claim type, is unaffected because the guard never
// looks inside the quote itself. Proved directly against the real Modiv
// text, not asserted. ───

test('regression: the real Modiv "(y) that are not qualified..." shape is unaffected when quoted with its own real lead-in', () => {
  const MODIV = realFilingCanonicalText('modiv-raw-fetched.htm');
  const leadIn = '(y) that are not qualified by materiality or Company Material Adverse Effect shall be true and '
    + 'correct in all material respects';
  const pos = realIndexOf(MODIV, leadIn, 'the real Modiv "(y)" bring-down clause');
  assert.equal(hasUnclosedNegationBeforeSpan(MODIV, pos), false,
    'a quote that includes its own real scope lead-in must not be flagged');

  // The bare whitelist phrase alone, WITHOUT that lead-in, real and
  // present at a different, later byte position in the identical
  // sentence -- this is the shape that DOES false-positive, and is
  // exactly why the fix was not wired into
  // handleRepresentationQualifierCarrier's ACCURACY path (see that
  // function's own comment).
  const barePhrase = 'true and correct in all material respects';
  const barePos = MODIV.indexOf(barePhrase, pos);
  assert.ok(barePos > pos);
  assert.equal(hasUnclosedNegationBeforeSpan(MODIV, barePos), true,
    'documents the known residual false-positive shape this step deliberately left out of scope');
});
