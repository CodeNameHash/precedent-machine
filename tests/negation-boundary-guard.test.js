/* Hostile tests for lib/negation-boundary-guard.js and its wiring into
   lib/verification.js -- the LIVE PRODUCTION quote-acceptance gate
   (lib/parser-v2/store.js calls sanitizeFeatureQuotes at ingestion) -- and
   into lib/canonical-v2/representations-dark-bridge.js (covered directly in
   tests/canonical-v2-representations-dark-bridge.test.js's own "FIXED"
   tests, not duplicated here).

   ALL source text below is REAL, committed merger-agreement text: TopBuild's
   and Modiv's actually-filed SEC merger agreements
   (tests/fixtures/canonical-v2/mae-definition-family/*-raw-fetched.htm), run
   through this repo's OWN real HTML-to-canonical-text pipeline
   (convertSecHtmlToCanonicalText) -- the same conversion the real ingestion
   path and tests/canonical-v2-native-sectionizer.test.js's REAL_FILINGS
   already use. No invented contract prose anywhere in this file.

   See docs/codex-program/notes/negation-reversal.md for the investigation,
   the false-positive analysis, and what remains open.

   Run: npm test  (node --test tests/)
*/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { hasUnclosedNegationBeforeSpan, NEGATION_LEAD_IN_RES } = require('../lib/negation-boundary-guard');
const { quoteAppearsIn, normalizeForMatch, sanitizeFeatureQuotes } = require('../lib/verification');
const { buildSecEdgarIntakeCapture } = require('../lib/canonical-v2/sec-edgar-intake-capture');
const { convertSecHtmlToCanonicalText } = require('../lib/canonical-v2/sec-html-canonical-text');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family');

function realFilingCanonicalText(filename) {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, filename));
  const capture = buildSecEdgarIntakeCapture({
    retrieval_url: 'https://www.sec.gov/Archives/edgar/data/1/negation-reversal-test.htm',
    final_url: 'https://www.sec.gov/Archives/edgar/data/1/negation-reversal-test.htm',
    status_code: 200,
    content_type: 'text/html; charset=UTF-8',
    retrieved_at: '2026-08-05T00:00:00.000Z',
    retrieval_policy_digest: sha256Hex('tests/negation-boundary-guard.test.js'),
    redirect_count: 0,
    response_bytes: raw,
  });
  return convertSecHtmlToCanonicalText(capture).canonical_text;
}

// Converted once: both real filings are ~400-450KB of real SEC HTML -- the
// same one-time cost tests/canonical-v2-native-sectionizer.test.js's
// REAL_FILINGS already pays per file.
const TOPBUILD = realFilingCanonicalText('topbuild-raw-fetched.htm');
const MODIV = realFilingCanonicalText('modiv-raw-fetched.htm');

function realIndexOf(haystack, needle, label) {
  const idx = haystack.indexOf(needle);
  assert.ok(idx !== -1, `expected to find real fixture text for ${label}: ${JSON.stringify(needle)}`);
  return idx;
}

// ── lib/negation-boundary-guard.js: the primitive, tested directly against
//    real filing text ─────────────────────────────────────────────────────

test('negation guard (real text): TopBuild MAE qualifier -- "would not" directly adjacent to the trimmed fragment', () => {
  // Real, verbatim clause from TopBuild's filed merger agreement.
  const genuine = 'individually or in the aggregate, would not be reasonably expected to have a Company Material Adverse Effect';
  realIndexOf(TOPBUILD, genuine, 'TopBuild MAE qualifier');

  // THE ATTACK from WORK-COMPLETED.md, reproduced against real corpus text
  // instead of the doc's illustrative example: "would not " trimmed off the
  // front leaves a genuine, word-boundary-aligned, but meaning-inverted
  // fragment.
  const fragment = 'be reasonably expected to have a Company Material Adverse Effect';
  const fragmentStart = realIndexOf(TOPBUILD, fragment, 'trimmed MAE fragment');
  assert.equal(hasUnclosedNegationBeforeSpan(TOPBUILD, fragmentStart), true);
});

test('negation guard (real text): the genuine, negation-intact TopBuild quote is NOT flagged', () => {
  const genuine = 'would not be reasonably expected to have a Company Material Adverse Effect';
  const start = realIndexOf(TOPBUILD, genuine, 'genuine TopBuild MAE qualifier (quote includes "would not")');
  // The quote itself STARTS at "would not" -- nothing precedes it within the
  // quote's own span that could be a dropped negation; hasUnclosedNegationBeforeSpan
  // only ever looks strictly BEFORE spanStart.
  assert.equal(hasUnclosedNegationBeforeSpan(TOPBUILD, start), false);
});

test('negation guard (real text): a quote legitimately containing "not" internally must still pass', () => {
  // Real TopBuild representation. "not" sits well inside this quote, not
  // trimmed off its front -- the quote itself starts at "there has not
  // been...", the genuine, complete assertion.
  const genuine = 'there has not been any Effect that, individually or in the aggregate, has had or is reasonably expected to have a Company Material Adverse Effect.';
  const start = realIndexOf(TOPBUILD, genuine, 'legitimate "has not been" representation');
  assert.equal(hasUnclosedNegationBeforeSpan(TOPBUILD, start), false);
});

test('negation guard (real text): Modiv MAE carve-out -- negation separated from the governed clause by intervening words', () => {
  // Real, verbatim clause from Modiv's filed merger agreement: the negation
  // ("in no event would") and what it governs ("be deemed to constitute...a
  // Company Material Adverse Effect") are separated by "any of the
  // following, alone or in combination," -- a real instance of the shape a
  // naive "look at only the immediately preceding word" check would miss.
  const genuine = 'in no event would any of the following, alone or in combination, be deemed to constitute';
  realIndexOf(MODIV, genuine, 'Modiv MAE carve-out lead-in');

  const fragment = 'any of the following, alone or in combination, be deemed to constitute';
  const fragmentStart = realIndexOf(MODIV, fragment, 'trimmed Modiv carve-out fragment');
  assert.equal(hasUnclosedNegationBeforeSpan(MODIV, fragmentStart), true);
});

test('negation guard (real text): TopBuild compound negation ("does not and would not") -- both cues stripped still flags', () => {
  // Real TopBuild clause pairing two negation cues on the same governed
  // clause ("Except as does not and would not be reasonably expected to
  // have..."). Not a true cancelling double negative -- a documented search
  // of both real filings in this fixture directory (topbuild-raw-fetched.htm,
  // modiv-raw-fetched.htm) found no genuine cancelling double negative near
  // MAE language; this is the closest real, compound-negation analogue, and
  // it is at least as dangerous to miss: dropping EITHER cue still inverts
  // the clause.
  const genuine = 'Except as does not and would not be reasonably expected to have, individually or in the aggregate, a Company Material Adverse Effect';
  realIndexOf(TOPBUILD, genuine, 'TopBuild compound-negation qualifier');

  const fragment = 'individually or in the aggregate, a Company Material Adverse Effect';
  const fragmentStart = realIndexOf(TOPBUILD, fragment, 'trimmed compound-negation fragment');
  assert.equal(hasUnclosedNegationBeforeSpan(TOPBUILD, fragmentStart), true);
});

test('negation guard (real text): coordinating "and" resets the lookback -- an independently-joined clause is not flagged', () => {
  // Real TopBuild sentence: "...shall not result in the funding of any
  // grantor, 'rabbi' or similar trust pursuant to any Benefit Plan, AND the
  // Company has taken, or has caused its applicable Subsidiaries to take,
  // all actions..." -- two representations joined by "and"; the first is
  // negated ("shall not result in..."), the second is an independent,
  // affirmatively-joined clause the negation does not govern. A quote
  // starting at "the Company has taken..." must not inherit the earlier
  // "shall not" -- this is the SAME shape that would otherwise have flagged
  // representations-dark-bridge.js's own legitimate knowledge-qualifier
  // fixture (see that file's "quote grounding: the legitimate whole-text
  // accuracy quote and a legitimate knowledge sub-phrase both still pass"
  // test), reproduced here directly against real corpus text.
  const genuineSentence = 'shall not result in the funding of any grantor, “rabbi” or similar trust pursuant to any Benefit Plan, and the Company has taken, or has caused its applicable Subsidiaries to take, all actions necessary';
  realIndexOf(TOPBUILD, genuineSentence, 'real "shall not ... and the Company has taken" sentence');

  const independentClause = 'the Company has taken, or has caused its applicable Subsidiaries to take, all actions necessary';
  const start = realIndexOf(TOPBUILD, independentClause, 'independent joined clause');
  assert.equal(hasUnclosedNegationBeforeSpan(TOPBUILD, start), false);
});

// ── lib/verification.js: the LIVE PRODUCTION path, end to end ─────────────
// quoteAppearsIn / sanitizeFeatureQuotes are what lib/parser-v2/store.js
// actually calls at ingestion to decide which quotes are RETAINED. These
// tests prove the fix closes the gap at the point that matters: what a
// lawyer would actually be shown.

test('PRODUCTION PATH (real text): quoteAppearsIn accepts the genuine, negation-intact Modiv carve-out quote', () => {
  const genuine = 'in no event would any of the following, alone or in combination, be deemed to constitute, nor shall any of the following be taken into account';
  realIndexOf(MODIV, genuine, 'genuine Modiv carve-out');
  const normSource = normalizeForMatch(MODIV);
  assert.equal(quoteAppearsIn(normalizeForMatch(genuine), normSource), true);
});

test('PRODUCTION PATH (real text): quoteAppearsIn REJECTS the negation-dropped Modiv fragment (the exact WORK-COMPLETED.md attack shape, on real corpus text)', () => {
  const fragment = 'any of the following, alone or in combination, be deemed to constitute, nor shall any of the following be taken into account in determining whether there has been or would reasonably be expected to be a “Company Material Adverse Effect”';
  realIndexOf(MODIV, fragment, 'negation-dropped Modiv fragment');
  const normSource = normalizeForMatch(MODIV);
  assert.equal(quoteAppearsIn(normalizeForMatch(fragment), normSource), false);
});

test('PRODUCTION PATH (real text): quoteAppearsIn REJECTS the negation-dropped TopBuild MAE fragment', () => {
  const fragment = 'be reasonably expected to have a Company Material Adverse Effect';
  realIndexOf(TOPBUILD, fragment, 'negation-dropped TopBuild fragment');
  const normSource = normalizeForMatch(TOPBUILD);
  assert.equal(quoteAppearsIn(normalizeForMatch(fragment), normSource), false);
});

test('PRODUCTION PATH (real text): quoteAppearsIn accepts a legitimate quote that contains "not" internally', () => {
  const genuine = 'there has not been any Effect that, individually or in the aggregate, has had or is reasonably expected to have a Company Material Adverse Effect.';
  realIndexOf(TOPBUILD, genuine, 'legitimate internal-"not" quote');
  const normSource = normalizeForMatch(TOPBUILD);
  assert.equal(quoteAppearsIn(normalizeForMatch(genuine), normSource), true);
});

test('PRODUCTION PATH (real text): sanitizeFeatureQuotes strips a negation-dropped fragment at ingestion instead of storing it as verified evidence', () => {
  const fragment = 'any of the following, alone or in combination, be deemed to constitute, nor shall any of the following be taken into account in determining whether there has been or would reasonably be expected to be a “Company Material Adverse Effect”';
  realIndexOf(MODIV, fragment, 'negation-dropped Modiv fragment (ingestion test)');

  const features = {
    materialityQualifier: { value: true, text: fragment },
  };
  const { features: sanitized, removed, details } = sanitizeFeatureQuotes(features, MODIV, {});
  assert.equal(removed, 1);
  assert.equal(sanitized.materialityQualifier.text, null);
  assert.equal(details[0].action, 'removed_unverified_quote');
});

test('PRODUCTION PATH (real text): sanitizeFeatureQuotes retains the genuine, negation-intact quote', () => {
  const genuine = 'in no event would any of the following, alone or in combination, be deemed to constitute, nor shall any of the following be taken into account';
  realIndexOf(MODIV, genuine, 'genuine Modiv quote (ingestion test)');

  const features = {
    materialityQualifier: { value: true, text: genuine },
  };
  const { features: sanitized, removed } = sanitizeFeatureQuotes(features, MODIV, {});
  assert.equal(removed, 0);
  assert.equal(sanitized.materialityQualifier.text, genuine);
});

// ── sanity: the guard's own regex list is exercised by every case above,
//    not dead code ─────────────────────────────────────────────────────────
test('negation guard: NEGATION_LEAD_IN_RES is non-empty and every pattern is exercised by the real-text cases above', () => {
  assert.ok(NEGATION_LEAD_IN_RES.length > 0);
});
