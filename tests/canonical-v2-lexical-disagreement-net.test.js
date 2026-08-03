'use strict';

/**
 * tests/canonical-v2-lexical-disagreement-net.test.js
 *
 * Unit tests for lib/canonical-v2/native-producer/lexical-disagreement-net.js
 * (docs/superpowers/specs/2026-08-02-lexical-disagreement-net-design.md) --
 * the PURE module: lexicon matching, offset mapping, receipt determinism,
 * table validation, and the `absentConclusionPermitted` helper. Wiring
 * tests against candidate-resolution.js live in
 * tests/canonical-v2-lexical-net-wiring.test.js.
 *
 * Numbered acceptance tests covered here (spec "Tests" section): 1, 2, 3,
 * 5, 6, 7, 8, 9, 12, 14. (4, 10, 11, 13, 15, 16 are wiring-layer tests.)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA,
  LEXICAL_FAMILY_LEXICON_SCHEMA,
  LEXICAL_FAMILY_LEXICON,
  LEXICAL_FAMILY_LEXICON_VERSION,
  PER_FAMILY_OUTCOMES,
  HIT_OFFSET_IRREPRODUCIBLE,
  LexicalDisagreementNetError,
  buildLexicalDisagreementReceipt,
  computeCandidateDigest,
  isStructurallyValidReceipt,
  absentConclusionPermitted,
  validateLexicalFamilyLexicon,
  validateBoundedRegexPattern,
  BOUNDED_REGEX_MAX_MATCH_LENGTH,
  buildPositionMap,
  mapHitToByteOffsets,
} = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');

function sha256Hex(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function governedSection(sectionRef, text) {
  return { section_ref: sectionRef, text, text_sha256: sha256Hex(text) };
}

// ═══════════════════════════════════════════════════════════════════════
// Real F28 third-live-run fixture loading (the section's own text lives in
// adapter-result.json's admitted_source_contexts[0].canonical_text.text;
// the section's own {start,end,text_sha256} live in run-receipt.json's
// resolved_sections[0] -- same fixture pair the wiring tests use).
// ═══════════════════════════════════════════════════════════════════════
function loadF28ThirdRunFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'f28-third-live-run', name), 'utf8'));
}

function loadF28ThirdRunSection() {
  const runReceipt = loadF28ThirdRunFixture('run-receipt.json');
  const adapterResult = loadF28ThirdRunFixture('adapter-result.json');
  const canonicalText = adapterResult.admitted_source_contexts[0].canonical_text.text;
  const section = runReceipt.resolved_sections[0];
  const bytes = Buffer.from(canonicalText, 'utf8');
  const sectionText = bytes.slice(section.start, section.end).toString('utf8');
  assert.equal(sha256Hex(sectionText), section.text_sha256, 'sanity: recomputed section hash matches the committed fixture');
  return { section_ref: section.section_reference, text: sectionText, text_sha256: section.text_sha256 };
}

// The real F28 third-run resolved[] entries' own claim.evidence spans
// (section-local, from resolution.json) -- used to build REP-T-CAP
// candidates for the real-fixture tests below.
function loadF28ThirdRunRepTCapCandidates() {
  const resolutionFixture = loadF28ThirdRunFixture('resolution.json');
  return resolutionFixture.resolved
    .filter((entry) => entry.concept_key === 'REP-T-CAP')
    .map((entry) => ({
      closure_id: entry.claim.closure_id,
      section_reference: entry.section_reference,
      family: entry.concept_key,
      evidence: entry.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })),
    }));
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 1: real recorded governed section + its recorded candidates --
// every lexicon hit enumerated; matched/unmatched split asserted against
// HAND-VERIFIED expectations.
//
// HAND-ENUMERATION (recorded here, not derived from the module under
// test): reading tests/fixtures/canonical-v2/f28-third-live-run's section
// III-INTRO(b) text by eye against LEXICAL_FAMILY_LEXICON/V1's REP-T-CAP
// patterns finds these case-insensitive, word-boundary-respecting hits, in
// left-to-right (byte-offset) order (acronyms RSU/PSU appear inside "RSU
// Awards"/"PSU Awards" three times each; "stock appreciation rights" --
// PLURAL -- never fires the singular "stock appreciation right" pattern,
// by the boundary rule; "warrants" appears only as the bare noun, which is
// ruled out by spec design, so it never fires either):
//   1.  "authorized capital stock" @31   (para (i), opening clause)
//   2.  "capital stock"            @42   (substring of hit 1's own span)
//   3.  "Restricted Stock"         @266  ("Company Restricted Stock Awards", para (i))
//   4.  "preferred stock"          @320  (para (i), share-class B)
//   5.  "par value"                @337  (para (i), preferred-stock clause)
//   6.  "reserved for issuance"    @594  (para (i), incentive-plan clause)
//   7.  "incentive plan"           @680  (para (i), "...Long Term Stock Incentive Plan")
//   8.  "reserved for issuance"    @756  (para (i), closing clause, 2nd occurrence)
//   9.  "RSU"                      @994  (para (ii), "RSU Awards", 1st of 3)
//  10.  "PSU"                      @1069 (para (ii), "PSU Awards", 1st of 3)
//  11.  "Restricted Stock"         @1280 ("Company Restricted Stock Awards", 2nd occurrence)
//  12.  "RSU"                      @1305 (2nd occurrence)
//  13.  "PSU"                      @1320 (2nd occurrence)
//  14.  "Restricted Stock"         @1546 (3rd occurrence)
//  15.  "RSU"                      @1571 (3rd occurrence)
//  16.  "PSU"                      @1585 (3rd occurrence)
//  17.  "capital stock"            @1790 (para (ii), "capital stock or other equity securities")
//  18.  "capital stock"            @2629 (para (iii), opening clause)
//  19.  "capital stock"            @2996 (para (iii), clause (A))
//  20.  "convertible"              @3124 (para (iii), clause (C))
//  21.  "capital stock"            @3619 (para (iii), closing sentence)
//  22.  "capital stock"            @3932 (para (iv), "any shares of capital stock")
//  23.  "convertible"              @4307 (para (iv), "convertible into or exercisable for")
//  24.  "capital stock"            @4594 (para (v), closing sentence)
// 24 total pattern hits (AUTHORIZED_CAPITAL_STOCK x1, CAPITAL_STOCK x7,
// RESTRICTED_STOCK x3, PREFERRED_STOCK x1, PAR_VALUE x1, RESERVED_FOR_
// ISSUANCE x2, INCENTIVE_PLAN x1, RSU x3, PSU x3, CONVERTIBLE x2), all
// UNMATCHED against the recorded run's own REP-T-CAP candidates -- the
// real run only extracted two narrow MEASUREMENT_DATE evidence spans ("as
// of the date hereof" and "As of April 17, 2026,"), neither of which
// byte-overlaps any of the 24 hits above. This is exactly the real-world
// disagreement the net exists to surface: a genuine capitalisation
// representation with 24 lexicon tells and only 2 (date-only) candidate
// evidence spans recorded against it.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 1 (real fixture, hand-verified): every REP-T-CAP lexicon hit in the F28 third-run section is enumerated and, given the run\'s own (date-only) candidate evidence, every hit is UNMATCHED', () => {
  const section = loadF28ThirdRunSection();
  const candidates = loadF28ThirdRunRepTCapCandidates();
  assert.equal(candidates.length, 3, 'sanity: 3 REP-T-CAP resolved entries in the committed fixture');

  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates });
  const family = receipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');

  assert.equal(family.pattern_hit_count, 24, 'hand-enumerated total hit count');
  assert.equal(family.matched_count, 0, 'hand-verified: none of the 24 hits overlap the two date-only evidence spans');
  assert.equal(family.unmatched_count, 24);
  assert.equal(family.outcome, 'LEXICAL_UNMATCHED_SIGNALS');
  assert.equal(family.disagreement_set.length, 24);

  const patternIdCounts = {};
  for (const hit of family.disagreement_set) {
    patternIdCounts[hit.pattern_id] = (patternIdCounts[hit.pattern_id] || 0) + 1;
  }
  assert.deepEqual(patternIdCounts, {
    'REP-T-CAP:PHRASE:AUTHORIZED_CAPITAL_STOCK': 1,
    'REP-T-CAP:PHRASE:CAPITAL_STOCK': 7,
    'REP-T-CAP:PHRASE:RESTRICTED_STOCK': 3,
    'REP-T-CAP:PHRASE:PREFERRED_STOCK': 1,
    'REP-T-CAP:PHRASE:PAR_VALUE': 1,
    'REP-T-CAP:PHRASE:RESERVED_FOR_ISSUANCE': 2,
    'REP-T-CAP:PHRASE:INCENTIVE_PLAN': 1,
    'REP-T-CAP:PHRASE:CONVERTIBLE': 2,
    'REP-T-CAP:ACRONYM:RSU': 3,
    'REP-T-CAP:ACRONYM:PSU': 3,
  }, 'hand-enumerated per-pattern hit counts');

  // Disagreement-set entries are in left-to-right byte-order (deterministic
  // sort), and every excerpt round-trips (offset_reproducible: true) --
  // the real fixture text has no zero-width marks landing inside a hit.
  for (let i = 1; i < family.disagreement_set.length; i += 1) {
    assert.ok(family.disagreement_set[i].start >= family.disagreement_set[i - 1].start, 'left-to-right order');
    assert.equal(family.disagreement_set[i].offset_reproducible, true);
    assert.equal(family.disagreement_set[i].failure_code, null);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 2: zero-candidate section (covered family) -> all hits unmatched;
// absentConclusionPermitted refuses.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 2: zero candidates for a covered family -> every hit unmatched (not an error), and absentConclusionPermitted refuses', () => {
  const text = 'The authorized capital stock of the Company consists of common stock and preferred stock.';
  const section = governedSection('3.1(b)', text);
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates: [] });
  const family = receipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  assert.equal(family.outcome, 'LEXICAL_UNMATCHED_SIGNALS');
  assert.ok(family.unmatched_count > 0);
  assert.equal(family.matched_count, 0);

  const decision = absentConclusionPermitted({
    receipt, family: 'REP-T-CAP',
    current_section_sha256: section.text_sha256, current_candidate_digest: computeCandidateDigest([]),
  });
  assert.equal(decision.permitted, false);
  assert.equal(decision.reason, 'LEXICAL_UNMATCHED_SIGNALS');
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 3: determinism -- candidate-order AND lexicon-entry-order
// permutations -> byte-identical receipts.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 3: determinism under candidate-order and lexicon-entry-order permutation', () => {
  const text = 'The authorized capital stock of the Company consists of RSU Awards and PSU Awards and preferred stock.';
  const section = governedSection('3.1(b)', text);
  const candidateA = { closure_id: 'closure-a', section_reference: '3.1(b)', family: 'REP-T-CAP', evidence: [{ start: 4, end: 29 }] };
  const candidateB = { closure_id: 'closure-b', section_reference: '3.1(b)', family: 'REP-T-CAP', evidence: [{ start: 58, end: 68 }] };

  const forward = buildLexicalDisagreementReceipt({ governed_section: section, candidates: [candidateA, candidateB] });
  const reversed = buildLexicalDisagreementReceipt({ governed_section: section, candidates: [candidateB, candidateA] });
  assert.equal(canonicalJson(forward), canonicalJson(reversed));
  assert.equal(forward.lexical_disagreement_receipt_id, reversed.lexical_disagreement_receipt_id);

  const shuffledLexicon = {
    schema_version: LEXICAL_FAMILY_LEXICON_SCHEMA,
    version: LEXICAL_FAMILY_LEXICON_VERSION,
    entries: [...LEXICAL_FAMILY_LEXICON.entries].reverse(),
  };
  const withShuffledLexicon = buildLexicalDisagreementReceipt({
    governed_section: section, candidates: [candidateA, candidateB], lexicon: shuffledLexicon,
  });
  assert.equal(canonicalJson(forward), canonicalJson(withShuffledLexicon), 'lexicon-entry-order permutation invariant (audit m6)');
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 5: cross-family evidence never matches a hit.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 5: cross-family evidence does not match a same-byte-range hit', () => {
  const text = 'The authorized capital stock of the Company is as follows.';
  const section = governedSection('3.1(b)', text);
  const hitStart = text.indexOf('capital stock');
  const hitEnd = hitStart + 'capital stock'.length;
  // A candidate whose evidence exactly overlaps the hit byte range, but
  // whose family is something else entirely -- must never count as a match.
  const candidates = [{
    closure_id: 'closure-other-family', section_reference: '3.1(b)', family: 'REP-T-NOCHANGE',
    evidence: [{ start: hitStart, end: hitEnd }],
  }];
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates });
  const family = receipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  assert.equal(family.matched_count, 0);
  assert.ok(family.disagreement_set.some((hit) => hit.pattern_id === 'REP-T-CAP:PHRASE:CAPITAL_STOCK'));
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 6: overlap-not-containment -- clipping span matches; disjoint does
// not.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 6: overlap-not-containment -- a clipping (partially overlapping) evidence span matches; a disjoint span does not', () => {
  // "preferred stock" fires exactly one REP-T-CAP pattern (PREFERRED_STOCK)
  // in this text, unlike "capital stock" which also overlaps the longer
  // AUTHORIZED_CAPITAL_STOCK pattern -- isolating one pattern keeps this
  // test's match count unambiguous.
  const text = 'The Company holds preferred stock only, with plenty of trailing words to leave room for a clipping span.';
  const section = governedSection('3.1(b)', text);
  const hitStart = text.indexOf('preferred stock');
  const hitEnd = hitStart + 'preferred stock'.length;

  const clippingCandidates = [{
    closure_id: 'closure-clip', section_reference: '3.1(b)', family: 'REP-T-CAP',
    // Starts a few bytes before the hit ends and extends past it -- clips
    // the hit's tail, no containment.
    evidence: [{ start: hitEnd - 3, end: hitEnd + 10 }],
  }];
  const clippingReceipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates: clippingCandidates });
  const clippingFamily = clippingReceipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  assert.equal(clippingFamily.matched_count, 1, 'clipping span byte-overlaps the hit -> matched, containment not required');

  const disjointCandidates = [{
    closure_id: 'closure-disjoint', section_reference: '3.1(b)', family: 'REP-T-CAP',
    evidence: [{ start: hitEnd + 5, end: hitEnd + 15 }],
  }];
  const disjointReceipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates: disjointCandidates });
  const disjointFamily = disjointReceipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  assert.equal(disjointFamily.matched_count, 0, 'disjoint span never matches');
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 7: table validation -- keys are registered concept keys; regexes
// syntactically restricted with static max <= 128; every pattern has id +
// rationale; content hash pinned.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 7: table validation', () => {
  // Bumped V13 -> V16 -> V17 (family-mae-definition, then family-
  // termination-rights slice): the lexicon now carries DEF-MAE entries
  // (registered from V16 onward) and TERMR-MUTUAL/TERMR-LEGAL entries
  // (registered from V17 onward) -- a stale bundle would fail this test's
  // own registered-key assertion on every new pattern_id.
  const { compileFixtureContractV17 } = require('../lib/canonical-v2/contract-bundle');
  const bundle = compileFixtureContractV17();
  const registeredConceptKeys = new Set(bundle.concepts.map((entry) => entry.concept_key));

  assert.doesNotThrow(() => validateLexicalFamilyLexicon(LEXICAL_FAMILY_LEXICON, { registeredConceptKeys }));

  for (const entry of LEXICAL_FAMILY_LEXICON.entries) {
    assert.ok(entry.pattern_id && entry.pattern_id.length > 0, `entry missing pattern_id: ${JSON.stringify(entry)}`);
    assert.ok(entry.rationale && entry.rationale.length > 0, `entry missing rationale: ${entry.pattern_id}`);
    assert.ok(registeredConceptKeys.has(entry.family), `entry family not a registered concept key: ${entry.family}`);
  }

  // An unknown family fails the table, never silently scans nothing.
  const badLexicon = {
    schema_version: LEXICAL_FAMILY_LEXICON_SCHEMA, version: 1,
    entries: [{ pattern_id: 'X:PHRASE:1', family: 'NOT-A-REAL-CONCEPT-KEY', kind: 'LITERAL_PHRASE', value: 'x', rationale: 'r' }],
  };
  assert.throws(() => validateLexicalFamilyLexicon(badLexicon, { registeredConceptKeys }), LexicalDisagreementNetError);

  // BOUNDED_REGEX static-max-length validator, exercised directly since
  // this V1 table registers no BOUNDED_REGEX entries (spec's "option"
  // ruling excludes the one candidate use case).
  assert.equal(validateBoundedRegexPattern('\\boptions?\\b'), 9, 'conservative static upper bound over the literal atoms plus the bounded "s?"');
  assert.throws(() => validateBoundedRegexPattern('a+'), LexicalDisagreementNetError, 'unbounded + rejected');
  assert.throws(() => validateBoundedRegexPattern('a*'), LexicalDisagreementNetError, 'unbounded * rejected');
  assert.throws(() => validateBoundedRegexPattern('a{2,}'), LexicalDisagreementNetError, 'unbounded {m,} rejected');
  // Hardening: an unbounded quantifier immediately after an ESCAPED
  // backslash atom (source string `\\+`, i.e. an escaped backslash
  // followed by an unbounded +) must still be caught -- a naive "character
  // before the quantifier isn't a backslash" check is fooled here because
  // the character before the `+` IS a backslash (the second char of the
  // `\\` escape), not an escaping one.
  assert.throws(() => validateBoundedRegexPattern('\\\\+'), LexicalDisagreementNetError, 'unbounded quantifier after an escaped backslash rejected');
  const longPattern = 'a'.repeat(BOUNDED_REGEX_MAX_MATCH_LENGTH + 1);
  const tooLongLexicon = {
    schema_version: LEXICAL_FAMILY_LEXICON_SCHEMA, version: 1,
    entries: [{ pattern_id: 'X:REGEX:1', family: 'REP-T-CAP', kind: 'BOUNDED_REGEX', value: longPattern, rationale: 'r' }],
  };
  assert.throws(() => validateLexicalFamilyLexicon(tooLongLexicon, { registeredConceptKeys }), LexicalDisagreementNetError);

  // Content hash pinned: deterministic and non-empty.
  const receipt1 = buildLexicalDisagreementReceipt({
    governed_section: governedSection('3.1(b)', 'nothing relevant here'), candidates: [],
  });
  const receipt2 = buildLexicalDisagreementReceipt({
    governed_section: governedSection('3.1(b)', 'nothing relevant here'), candidates: [],
  });
  assert.equal(receipt1.lexicon_content_hash, receipt2.lexicon_content_hash);
  assert.ok(typeof receipt1.lexicon_content_hash === 'string' && receipt1.lexicon_content_hash.length > 0);
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 8: anti-noise regression -- every pattern run against a pinned
// prose paragraph containing "pursuant", "necessary", "Sarbanes-Oxley",
// "represents and warrants", "optionally" -- asserted hit set exactly
// empty.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 8: anti-noise regression -- no lexicon pattern fires on pursuant/necessary/Sarbanes-Oxley/represents and warrants/optionally', () => {
  const text = 'Pursuant to this Agreement, and as necessary under Sarbanes-Oxley, '
    + 'the Company represents and warrants that it may optionally elect to proceed.';
  const section = governedSection('X', text);
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates: [] });
  const family = receipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  assert.equal(family.pattern_hit_count, 0);
  assert.deepEqual(family.disagreement_set, []);
  assert.equal(family.outcome, 'LEXICAL_ALL_SIGNALS_MATCHED', 'zero hits at all -> vacuously clean');
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 9: offset fixture -- a multi-byte character BEFORE the hit and a
// zero-width mark INSIDE the hit phrase -- byte offsets and round-trip
// predicate asserted.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 9: offset mapping -- multi-byte char before the hit, zero-width mark inside the hit phrase', () => {
  // "é" is 2 UTF-8 bytes; U+200E (LRM) sits inside "capital<LRM> stock".
  const text = 'Café: authorized capital‎ stock of the Company.';
  const section = governedSection('X', text);
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates: [] });
  const family = receipt.family_outcomes.find((entry) => entry.family === 'REP-T-CAP');
  const bytes = Buffer.from(text, 'utf8');

  const authorizedHit = family.disagreement_set.find((hit) => hit.pattern_id === 'REP-T-CAP:PHRASE:AUTHORIZED_CAPITAL_STOCK');
  assert.ok(authorizedHit);
  // "Café: " = C(1)+a(1)+f(1)+é(2 bytes)+:(1)+space(1) = 7 bytes before "authorized" begins.
  assert.equal(authorizedHit.start, 7);
  assert.equal(authorizedHit.offset_reproducible, true);
  assert.equal(authorizedHit.failure_code, null, 'a successful round-trip carries no failure_code');
  const authorizedSlice = bytes.slice(authorizedHit.start, authorizedHit.end).toString('utf8');
  assert.equal(authorizedSlice, 'authorized capital‎ stock', 'the zero-width mark inside the phrase is included in the byte span');

  const capitalStockHit = family.disagreement_set.find((hit) => hit.pattern_id === 'REP-T-CAP:PHRASE:CAPITAL_STOCK');
  assert.ok(capitalStockHit);
  const capitalStockSlice = bytes.slice(capitalStockHit.start, capitalStockHit.end).toString('utf8');
  assert.equal(capitalStockSlice, 'capital‎ stock');
  assert.equal(capitalStockHit.offset_reproducible, true);
  assert.equal(capitalStockHit.failure_code, null);
});

// ═══════════════════════════════════════════════════════════════════════
// HIT_OFFSET_IRREPRODUCIBLE: the typed, consumer-facing failure_code a
// disagreement entry carries when the round-trip predicate fails (spec
// section 3, offset mapping). Every hit this module's own matching path
// produces round-trips by construction (the offsets are derived FROM the
// same position map that produced the normalised match) -- so the failure
// path is exercised directly against `mapHitToByteOffsets`, the exact
// function `matchFamily` calls per hit, with a deliberately mismatched
// `matchedNormalisedText` (simulating what a corrupted/foreign offset
// would look like) to prove the predicate -- and the failure_code it
// drives -- actually fires rather than being dead code.
// ═══════════════════════════════════════════════════════════════════════
test('HIT_OFFSET_IRREPRODUCIBLE: mapHitToByteOffsets reports reproducible: false when the round-trip predicate fails, and buildLexicalDisagreementReceipt stamps failure_code from it', () => {
  const text = 'authorized capital stock of the Company';
  const positionMap = buildPositionMap(text);
  const hit = { start: 0, end: 'authorized capital stock'.length };

  // Correct case: matchedNormalisedText genuinely equals the slice -> reproducible.
  const ok = mapHitToByteOffsets({ original: text, positionMap, hit, matchedNormalisedText: 'authorized capital stock' });
  assert.equal(ok.reproducible, true);

  // Deliberately WRONG matchedNormalisedText (as if a caller's own offset
  // bookkeeping drifted) -> the round-trip predicate must catch it.
  const broken = mapHitToByteOffsets({ original: text, positionMap, hit, matchedNormalisedText: 'something else entirely' });
  assert.equal(broken.reproducible, false);

  assert.equal(HIT_OFFSET_IRREPRODUCIBLE, 'HIT_OFFSET_IRREPRODUCIBLE', 'the pinned spec typed code name');
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 12 (module-level half): a family entirely missing from the
// receipt's own outcome domain reads as uncovered via
// familyOutcomeFromReceipt / absentConclusionPermitted, never as clean.
// (The wiring-layer half of test 12 lives in the wiring test file.)
// ═══════════════════════════════════════════════════════════════════════
test('TEST 12: a family missing from the receipt outcome domain entirely is treated as uncovered by absentConclusionPermitted, never as clean', () => {
  const text = 'Nothing capitalisation-related here at all.';
  const section = governedSection('X', text);
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates: [] });
  assert.ok(!receipt.family_outcomes.some((entry) => entry.family === 'REP-T-NOCHANGE'), 'sanity: family genuinely absent from the domain');

  const decision = absentConclusionPermitted({
    receipt, family: 'REP-T-NOCHANGE',
    current_section_sha256: receipt.text_sha256, current_candidate_digest: receipt.candidate_digest,
  });
  assert.equal(decision.permitted, false);
  assert.equal(decision.reason, 'LEXICON_FAMILY_UNCOVERED');
});

// ═══════════════════════════════════════════════════════════════════════
// TEST 14: absentConclusionPermitted helper -- stale, uncovered, malformed,
// missing-current-state -> refused; fresh-and-clean -> permitted.
// ═══════════════════════════════════════════════════════════════════════
test('TEST 14: absentConclusionPermitted -- stale, uncovered, malformed, missing-current-state all refuse; fresh-and-clean permits', () => {
  const text = 'Nothing about capitalisation appears in this section at all, only boilerplate.';
  const section = governedSection('X', text);
  const candidates = [];
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates });

  // Fresh and clean: zero hits at all -> ALL_SIGNALS_MATCHED -> permitted.
  const clean = absentConclusionPermitted({
    receipt, family: 'REP-T-CAP',
    current_section_sha256: receipt.text_sha256, current_candidate_digest: receipt.candidate_digest,
  });
  assert.deepEqual(clean, { permitted: true });

  // Stale: text hash mismatch.
  const staleText = absentConclusionPermitted({
    receipt, family: 'REP-T-CAP',
    current_section_sha256: 'different-hash', current_candidate_digest: receipt.candidate_digest,
  });
  assert.equal(staleText.permitted, false);
  assert.equal(staleText.reason, 'RECEIPT_STALE');

  // Stale: candidate digest mismatch.
  const staleDigest = absentConclusionPermitted({
    receipt, family: 'REP-T-CAP',
    current_section_sha256: receipt.text_sha256, current_candidate_digest: 'different-digest',
  });
  assert.equal(staleDigest.permitted, false);
  assert.equal(staleDigest.reason, 'RECEIPT_STALE');

  // Missing current-state inputs entirely -> absence of proof of freshness IS staleness.
  const missingCurrentState = absentConclusionPermitted({ receipt, family: 'REP-T-CAP' });
  assert.equal(missingCurrentState.permitted, false);
  assert.equal(missingCurrentState.reason, 'RECEIPT_STALE');

  // Malformed receipt.
  const malformed = absentConclusionPermitted({
    receipt: { schema_version: 'WRONG/V1' }, family: 'REP-T-CAP',
    current_section_sha256: 'x', current_candidate_digest: 'y',
  });
  assert.equal(malformed.permitted, false);
  assert.equal(malformed.reason, 'RECEIPT_MALFORMED');

  // Uncovered family.
  const capitalStockText = 'The authorized capital stock of the Company is as follows.';
  const capitalSection = governedSection('X', capitalStockText);
  const capitalReceipt = buildLexicalDisagreementReceipt({ governed_section: capitalSection, candidates: [] });
  const uncovered = absentConclusionPermitted({
    receipt: capitalReceipt, family: 'REP-T-NOCHANGE',
    current_section_sha256: capitalReceipt.text_sha256, current_candidate_digest: capitalReceipt.candidate_digest,
  });
  assert.equal(uncovered.permitted, false);
  assert.equal(uncovered.reason, 'LEXICON_FAMILY_UNCOVERED');

  // Unmatched signals -> refused with the typed reason.
  const unmatchedDecision = absentConclusionPermitted({
    receipt: capitalReceipt, family: 'REP-T-CAP',
    current_section_sha256: capitalReceipt.text_sha256, current_candidate_digest: capitalReceipt.candidate_digest,
  });
  assert.equal(unmatchedDecision.permitted, false);
  assert.equal(unmatchedDecision.reason, 'LEXICAL_UNMATCHED_SIGNALS');
});

// ═══════════════════════════════════════════════════════════════════════
// Structural / input validation (fail-closed rejections, spec section 1).
// ═══════════════════════════════════════════════════════════════════════
test('SECTION_HASH_MISMATCH: a governed_section whose text_sha256 does not match its own text is rejected, fail-closed', () => {
  assert.throws(() => buildLexicalDisagreementReceipt({
    governed_section: { section_ref: 'X', text: 'some text', text_sha256: 'not-the-real-hash' }, candidates: [],
  }), (error) => error instanceof LexicalDisagreementNetError && error.code === 'SECTION_HASH_MISMATCH');
});

test('CANDIDATE_SECTION_MISMATCH: a candidate whose section_reference differs from governed_section.section_ref is rejected even when its offsets fit the frame', () => {
  const section = governedSection('3.1(b)', 'The authorized capital stock of the Company.');
  assert.throws(() => buildLexicalDisagreementReceipt({
    governed_section: section,
    candidates: [{ closure_id: 'c1', section_reference: 'OTHER-SECTION', family: 'REP-T-CAP', evidence: [{ start: 0, end: 5 }] }],
  }), (error) => error instanceof LexicalDisagreementNetError && error.code === 'CANDIDATE_SECTION_MISMATCH');
});

test('EVIDENCE_OUT_OF_FRAME: an evidence span outside 0 <= start < end <= section byte length is rejected', () => {
  const section = governedSection('3.1(b)', 'The authorized capital stock of the Company.');
  const byteLength = Buffer.byteLength(section.text, 'utf8');
  assert.throws(() => buildLexicalDisagreementReceipt({
    governed_section: section,
    candidates: [{ closure_id: 'c1', section_reference: '3.1(b)', family: 'REP-T-CAP', evidence: [{ start: 0, end: byteLength + 5 }] }],
  }), (error) => error instanceof LexicalDisagreementNetError && error.code === 'EVIDENCE_OUT_OF_FRAME');
});

test('isStructurallyValidReceipt rejects malformed shapes and accepts a real receipt', () => {
  const receipt = buildLexicalDisagreementReceipt({
    governed_section: governedSection('X', 'authorized capital stock'), candidates: [],
  });
  assert.equal(isStructurallyValidReceipt(receipt), true);
  assert.equal(isStructurallyValidReceipt(null), false);
  assert.equal(isStructurallyValidReceipt({}), false);
  assert.equal(isStructurallyValidReceipt({ ...receipt, schema_version: 'WRONG/V1' }), false);
  assert.equal(isStructurallyValidReceipt({ ...receipt, family_outcomes: 'not-an-array' }), false);
});

test('PER_FAMILY_OUTCOMES enumerates exactly the three pinned outcome codes', () => {
  assert.deepEqual([...PER_FAMILY_OUTCOMES].sort(), [
    'LEXICAL_ALL_SIGNALS_MATCHED', 'LEXICAL_UNMATCHED_SIGNALS', 'LEXICON_FAMILY_UNCOVERED',
  ].sort());
});

test('contentId over the receipt body is what mints lexical_disagreement_receipt_id (content-addressed)', () => {
  const section = governedSection('X', 'authorized capital stock');
  const receipt = buildLexicalDisagreementReceipt({ governed_section: section, candidates: [] });
  const { lexical_disagreement_receipt_id: id, ...body } = receipt;
  assert.equal(contentId(LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA, body), id);
});
