'use strict';

/**
 * tests/canonical-v2-no-shop-lexicon.test.js
 *
 * Acceptance test 7 (docs/superpowers/specs/2026-08-02-family-no-shop-
 * design.md, section 6, AUDIT-AMENDED): table validation (keys registered,
 * rationales present, content hash re-pinned, V3 version bump); the
 * anti-noise regression pinned in section 5 (three sentences, each with its
 * exact expected hit set); determinism permutation under the grown table.
 * Also: the byte-equality test between the prompt module's imported
 * controlled vocabularies and the registry's own compiled claim
 * definitions (spec section 3, "verified at build").
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
const { compileFixtureContractV25 } = require('../lib/canonical-v2/contract-bundle');
const {
  CONTROLLED_VOCABULARIES,
} = require('../lib/canonical-v2/native-producer/no-shop-producer-prompt');

const REGISTERED_CONCEPT_KEYS = new Set([
  'REP-T-CAP', 'TERMF-TARGET', 'TERMF-REVERSE', 'TERMF-TAIL',
  'NOSOL-PROHIBIT', 'NOSOL-EXCEPT', 'NOSOL-NOTICE', 'NOSOL-MATCH', 'NOSOL-REMATCH',
  // family-mae-definition slice (LEXICAL_FAMILY_LEXICON_VERSION 3 -> 4):
  // DEF-MAE, registered in contract-bundle.js's V16 concept table in the
  // same slice.
  'DEF-MAE',
  // family-termination-rights slice (LEXICAL_FAMILY_LEXICON_VERSION 4 ->
  // 5): TERMR-MUTUAL/TERMR-LEGAL (newly registered) plus the six
  // already-registered TERMR families the lexicon now also covers.
  'TERMR-MUTUAL', 'TERMR-LEGAL',
  'TERMR-OUTSIDE', 'TERMR-NOVOTE', 'TERMR-BREACH', 'TERMR-SUPERIOR', 'TERMR-RECOMMEND',
  'TERMR-NOSOL-BREACH',
  'ANTI-EFFORTS', 'ANTI-BURDEN', 'ANTI-LITIGATION', 'ANTI-TIMING', 'ANTI-FILING',
  'CONS-PERSHARE', 'CONS-RATIO', 'CONS-DISSENT',
  'IOC-ACCOUNTING', 'IOC-CAPEX', 'IOC-CHARTER', 'IOC-COMP', 'IOC-CONTRACT',
  'IOC-DEBT', 'IOC-DIVIDEND', 'IOC-ISSUE', 'IOC-MERGE', 'IOC-SETTLE', 'IOC-TAX',
]);

test('LEXICAL_FAMILY_LEXICON_VERSION bumped 2 -> 3 (no-shop), then 3 -> 4 (family-mae-definition slice)', () => {
  assert.equal(LEXICAL_FAMILY_LEXICON_VERSION, 8);
  assert.equal(LEXICAL_FAMILY_LEXICON.version, 8);
});

test('table validation: every entry has a non-empty pattern_id, family, kind, value, rationale; no duplicate pattern_id; every family is a registered concept key; BOUNDED_REGEX patterns stay <= 128 static max', () => {
  assert.doesNotThrow(() => validateLexicalFamilyLexicon(LEXICAL_FAMILY_LEXICON, {
    registeredConceptKeys: REGISTERED_CONCEPT_KEYS,
  }));
  for (const entry of LEXICAL_FAMILY_LEXICON.entries) {
    assert.ok(entry.rationale && entry.rationale.length > 0, `${entry.pattern_id} missing rationale`);
  }
});

test('all five NOSOL- families are represented in the grown table', () => {
  const families = new Set(LEXICAL_FAMILY_LEXICON.entries.map((e) => e.family));
  for (const family of ['NOSOL-PROHIBIT', 'NOSOL-EXCEPT', 'NOSOL-NOTICE', 'NOSOL-MATCH', 'NOSOL-REMATCH']) {
    assert.ok(families.has(family), `expected family ${family} to be represented`);
  }
});

test('every BOUNDED_REGEX pattern in the table carries its own explicit \\b prefix (audit C-2 -- the module does not auto-bound)', () => {
  const regexEntries = LEXICAL_FAMILY_LEXICON.entries.filter((e) => e.kind === 'BOUNDED_REGEX');
  assert.ok(regexEntries.length >= 2, 'expected at least the NOSOL-PROHIBIT solicit stem and NOSOL-NOTICE notify stem');
  for (const entry of regexEntries) {
    assert.ok(entry.value.startsWith('\\b'), `${entry.pattern_id} value "${entry.value}" is missing its own leading \\b`);
  }
});

// ---------------------------------------------------------------------------
// Anti-noise regression (spec section 5, audit C-2 amendment): three
// sentences, EACH with its EXACT expected hit set pinned per sentence.
// ---------------------------------------------------------------------------

function hitsFor(text) {
  return LEXICAL_FAMILY_LEXICON.entries
    .filter((e) => {
      if (e.kind === 'BOUNDED_REGEX') return new RegExp(e.value, 'i').test(text);
      return scanLiteral(text, e.value, e.kind === 'LITERAL_ACRONYM').length > 0;
    })
    .map((e) => e.pattern_id)
    .sort();
}

test('anti-noise: "solicitation of proxies" -- the NOSOL-PROHIBIT \\bsolicit stem fires (known queue cost, pinned); no phrase entry fires', () => {
  assert.deepEqual(hitsFor('solicitation of proxies'), ['NOSOL-PROHIBIT:REGEX:SOLICIT_STEM']);
});

test('anti-noise: "unsolicited communications" -- the NOSOL-EXCEPT "unsolicited" phrase fires (known queue cost, pinned); the NOSOL-PROHIBIT \\bsolicit stem does NOT fire (word boundary)', () => {
  assert.deepEqual(hitsFor('unsolicited communications'), ['NOSOL-EXCEPT:PHRASE:UNSOLICITED']);
});

test('anti-noise: "notify the other party pursuant to Section 9.02" -- the NOSOL-NOTICE \\bnotif stem fires (known queue cost, pinned); no other entry fires', () => {
  assert.deepEqual(hitsFor('notify the other party pursuant to Section 9.02'), ['NOSOL-NOTICE:REGEX:NOTIFY_STEM']);
});

test('all three anti-noise hits are known-queue costs, never silent surprises; every non-hit is asserted absent by the exact-set pin above', () => {
  // The three tests above ARE the exact-set assertion (spec: "all hits are
  // known-queue costs, not silent surprises; all non-hits are asserted
  // absent") -- this test exists only to name that invariant explicitly.
  assert.ok(true);
});

// ---------------------------------------------------------------------------
// Determinism (order-independent content hash, sorted-pattern_id hashing).
// ---------------------------------------------------------------------------

test('determinism: the grown lexicon\'s content hash is stable across repeated calls and independent of entry declaration order', () => {
  const first = lexiconContentHash(LEXICAL_FAMILY_LEXICON);
  const second = lexiconContentHash(LEXICAL_FAMILY_LEXICON);
  assert.equal(first, second);

  const shuffled = Object.freeze({
    ...LEXICAL_FAMILY_LEXICON,
    entries: Object.freeze([...LEXICAL_FAMILY_LEXICON.entries].reverse()),
  });
  assert.equal(lexiconContentHash(shuffled), first, 'hashing is order-independent (sorted by pattern_id)');
  assert.deepEqual(
    sortedLexiconEntries(LEXICAL_FAMILY_LEXICON).map((e) => e.pattern_id),
    sortedLexiconEntries(shuffled).map((e) => e.pattern_id),
  );
});

// ---------------------------------------------------------------------------
// Ungrounded market-standard tells (audit M-5): "fiduciary out", "right to
// match", "matching rights" are retained as priced dead weight, honestly
// documented as ungrounded, never silently presented as corpus-grounded.
// ---------------------------------------------------------------------------

test('ungrounded market-standard tells are present but their rationale honestly says so (audit M-5)', () => {
  const ungrounded = ['fiduciary out', 'right to match', 'matching rights'];
  for (const value of ungrounded) {
    const entry = LEXICAL_FAMILY_LEXICON.entries.find((e) => e.value === value);
    assert.ok(entry, `expected an entry for "${value}"`);
    assert.match(entry.rationale, /ungrounded/i);
  }
});

// ---------------------------------------------------------------------------
// Registry vocabulary single-sourcing (spec section 3): the no-shop
// producer prompt's own CONTROLLED_VOCABULARIES must be a byte-equal
// superset-of-nothing (exact match) against the compiled bundle's own
// registered claim-definition enums -- drift is a silent corruption path
// this test makes loud.
// ---------------------------------------------------------------------------

test('no-shop-producer-prompt.js ACTION_CODE / PREREQUISITE_CODE vocabularies are byte-identical to the compiled V15 bundle\'s own registered claim-definition enums', () => {
  const bundle = compileFixtureContractV25();
  const actionDefinition = bundle.claim_definitions.find((d) => d.claim_definition_key === 'NO_SHOP_PROHIBITED_ACTION');
  const prerequisiteDefinition = bundle.claim_definitions.find((d) => d.claim_definition_key === 'NO_SHOP_EXCEPTION_PREREQUISITE');
  assert.ok(actionDefinition && prerequisiteDefinition);
  assert.deepEqual([...CONTROLLED_VOCABULARIES.ACTION_CODE], [...actionDefinition.allowed_canonical_values]);
  assert.deepEqual([...CONTROLLED_VOCABULARIES.PREREQUISITE_CODE], [...prerequisiteDefinition.allowed_canonical_values]);
});
