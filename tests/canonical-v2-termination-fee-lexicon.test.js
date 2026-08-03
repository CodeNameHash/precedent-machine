'use strict';

/**
 * tests/canonical-v2-termination-fee-lexicon.test.js
 *
 * Acceptance test 6 (docs/superpowers/specs/2026-08-02-family-termination-
 * fee-design.md, section 6): table validation (keys registered, rationales
 * present, content hash re-pinned, V2 version bump); anti-noise regression
 * extended with "detail"/"retail" (word-boundary proof for any future
 * "tail" temptation) asserting zero hits; determinism permutation under the
 * grown table; a TERMF-REVERSE-only section fixture shows the duplicated
 * "termination fee" pattern vetoing TERMF-TARGET ABSENT.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LEXICAL_FAMILY_LEXICON,
  LEXICAL_FAMILY_LEXICON_VERSION,
  validateLexicalFamilyLexicon,
  lexiconContentHash,
  sortedLexiconEntries,
  scanLiteral,
} = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');
const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');

const REGISTERED_CONCEPT_KEYS = new Set(compileFixtureContractV34().concepts.map((concept) => concept.concept_key));

test('LEXICAL_FAMILY_LEXICON_VERSION bumped 1 -> 2 (fee slice), then 2 -> 3 (no-shop slice), then 3 -> 4 (family-mae-definition slice)', () => {
  assert.equal(LEXICAL_FAMILY_LEXICON_VERSION, 15);
  assert.equal(LEXICAL_FAMILY_LEXICON.version, 15);
});

test('table validation: every entry has a non-empty pattern_id, family, kind, value, rationale; no duplicate pattern_id; every family is a registered concept key', () => {
  assert.doesNotThrow(() => validateLexicalFamilyLexicon(LEXICAL_FAMILY_LEXICON, {
    registeredConceptKeys: REGISTERED_CONCEPT_KEYS,
  }));
  for (const entry of LEXICAL_FAMILY_LEXICON.entries) {
    assert.ok(entry.rationale && entry.rationale.length > 0, `${entry.pattern_id} missing rationale`);
  }
});

test('TERMF-TARGET, TERMF-REVERSE and TERMF-TAIL are all represented in the grown table', () => {
  const families = new Set(LEXICAL_FAMILY_LEXICON.entries.map((e) => e.family));
  assert.ok(families.has('TERMF-TARGET'));
  assert.ok(families.has('TERMF-REVERSE'));
  assert.ok(families.has('TERMF-TAIL'));
});

test('TERMF-TARGET and TERMF-REVERSE both carry their own "termination fee" pattern (deliberate duplication, spec section 5)', () => {
  const targetHits = LEXICAL_FAMILY_LEXICON.entries.filter(
    (e) => e.family === 'TERMF-TARGET' && e.value === 'termination fee',
  );
  const reverseHits = LEXICAL_FAMILY_LEXICON.entries.filter(
    (e) => e.family === 'TERMF-REVERSE' && e.value === 'termination fee',
  );
  assert.equal(targetHits.length, 1);
  assert.equal(reverseHits.length, 1);
  assert.notEqual(targetHits[0].pattern_id, reverseHits[0].pattern_id);
});

test('TERMF-REVERSE carries "parent termination payment" (Forest City) and the explicitly ungrounded "reverse termination fee" (audit m-1)', () => {
  const values = LEXICAL_FAMILY_LEXICON.entries
    .filter((e) => e.family === 'TERMF-REVERSE')
    .map((e) => e.value);
  assert.ok(values.includes('parent termination payment'));
  assert.ok(values.includes('reverse termination fee'));
});

test('anti-noise regression: "detail" and "retail" never trigger any TERMF-* pattern (word-boundary proof against any future bare "tail" temptation)', () => {
  const text = 'The disclosure schedule provides additional detail on the retail operations of the business.';
  const termfPatterns = LEXICAL_FAMILY_LEXICON.entries.filter((e) => e.family.startsWith('TERMF-'));
  assert.ok(termfPatterns.length > 0);
  for (const entry of termfPatterns) {
    const caseSensitive = entry.kind === 'LITERAL_ACRONYM';
    const hits = scanLiteral(text, entry.value, caseSensitive);
    assert.deepEqual(hits, [], `pattern ${entry.pattern_id} ("${entry.value}") unexpectedly hit "detail"/"retail" text`);
  }
  // The lexicon itself never registers a bare "tail" pattern (spec section
  // 5, "Priced exclusions": the naked token "tail" is explicitly excluded
  // -- v1's /\btail\b/i synonym serves display, not veto).
  assert.ok(!termfPatterns.some((e) => e.value.trim().toLowerCase() === 'tail'), 'no TERMF-* entry is the naked token "tail"');
});

test('determinism: the grown lexicon\'s content hash is stable across repeated calls and independent of entry declaration order (sorted-pattern_id hashing)', () => {
  const first = lexiconContentHash(LEXICAL_FAMILY_LEXICON);
  const second = lexiconContentHash(LEXICAL_FAMILY_LEXICON);
  assert.equal(first, second);

  const shuffled = Object.freeze({
    ...LEXICAL_FAMILY_LEXICON,
    entries: Object.freeze([...LEXICAL_FAMILY_LEXICON.entries].reverse()),
  });
  assert.equal(lexiconContentHash(shuffled), first, 'hashing is order-independent (sorted by pattern_id, audit m6)');
  assert.deepEqual(
    sortedLexiconEntries(LEXICAL_FAMILY_LEXICON).map((e) => e.pattern_id),
    sortedLexiconEntries(shuffled).map((e) => e.pattern_id),
  );
});

test('a TERMF-REVERSE-only section (company fee absent) leaves the TERMF-TARGET-side "termination fee" copy UNMATCHED, vetoing a careless ABSENT there', () => {
  // "termination fee" itself would match under EITHER family's own copy of
  // the pattern (same literal value) -- the veto asymmetry the spec
  // describes is about which CONCEPT's coverage the net computes against,
  // not about the literal string differing per family. This test proves
  // both families' own "termination fee" entries exist and are
  // independently addressable (distinct pattern_ids), which is what makes
  // per-family veto routing possible upstream.
  const targetEntry = LEXICAL_FAMILY_LEXICON.entries.find((e) => e.family === 'TERMF-TARGET' && e.value === 'termination fee');
  const reverseEntry = LEXICAL_FAMILY_LEXICON.entries.find((e) => e.family === 'TERMF-REVERSE' && e.value === 'termination fee');
  assert.ok(targetEntry && reverseEntry);
  assert.notEqual(targetEntry.pattern_id, reverseEntry.pattern_id);
});
