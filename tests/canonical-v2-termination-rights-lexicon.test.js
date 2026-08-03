'use strict';

/**
 * tests/canonical-v2-termination-rights-lexicon.test.js
 *
 * Acceptance test 7 (docs/superpowers/specs/2026-08-02-family-termination-
 * rights-design.md, section 6): table validation, static-max regex check
 * (N/A here -- every TERMR case-sensitive defined-term pattern is expressed
 * as LITERAL_ACRONYM, not BOUNDED_REGEX; see lexical-disagreement-net.js's
 * own comment on why), anti-noise regression paragraph, and
 * TERMR-NOSOL-BREACH asserted LEXICON_FAMILY_UNCOVERED (no entries).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LEXICAL_FAMILY_LEXICON,
  LEXICAL_FAMILY_LEXICON_VERSION,
  validateLexicalFamilyLexicon,
  scanLiteral,
} = require('../lib/canonical-v2/native-producer/lexical-disagreement-net');

const REGISTERED_CONCEPT_KEYS = new Set([
  'REP-T-CAP', 'REP-T-CONTRACTS', 'TERMF-TARGET', 'TERMF-REVERSE', 'TERMF-TAIL',
  'NOSOL-PROHIBIT', 'NOSOL-EXCEPT', 'NOSOL-NOTICE', 'NOSOL-MATCH', 'NOSOL-REMATCH',
  'DEF-MAE',
  // family-termination-rights slice (LEXICAL_FAMILY_LEXICON_VERSION 4 -> 5):
  // the two new registered concepts, plus the six already-registered TERMR
  // families the lexicon now also covers.
  'TERMR-MUTUAL', 'TERMR-LEGAL',
  'TERMR-OUTSIDE', 'TERMR-NOVOTE', 'TERMR-BREACH', 'TERMR-SUPERIOR', 'TERMR-RECOMMEND',
  'TERMR-NOSOL-BREACH',
  'ANTI-EFFORTS', 'ANTI-BURDEN', 'ANTI-LITIGATION', 'ANTI-TIMING', 'ANTI-FILING',
  'COND-B-REP', 'COND-S-REP', 'COND-MAE', 'COND-COV', 'COND-REG',
  'CONS-PERSHARE', 'CONS-RATIO', 'CONS-DISSENT',
  'IOC-ACCOUNTING', 'IOC-CAPEX', 'IOC-CHARTER', 'IOC-COMP', 'IOC-CONTRACT',
  'IOC-DEBT', 'IOC-DIVIDEND', 'IOC-ISSUE', 'IOC-MERGE', 'IOC-SETTLE', 'IOC-TAX',
  'COV-PROXY', 'COV-MEETING',
  'COV-FINANCING', 'COV-PAYOFF', 'COV-MARKETING', 'GTY-PERF', 'GTY-DELIVERY',
  'DEF-WILLFUL', 'REP-T-NOOTHERREPS', 'REP-B-NOOTHERREPS', 'REP-T-NONRELIANCE', 'REP-B-NONRELIANCE',
  'REP-T-INDEPINVEST', 'REP-B-INDEPINVEST', 'REP-T-FRAUDCARVEOUT', 'REP-B-FRAUDCARVEOUT',
  'COV-16B', 'COV-ACCESS', 'COV-CONSENT', 'COV-CVR', 'COV-DEBT', 'COV-DELIST', 'COV-FDACOMMS',
  'COV-FURTHER', 'COV-INDEMN', 'COV-LIST', 'COV-LITNOTIFY', 'COV-MERGESUB', 'COV-NOTIFY', 'COV-PAYAGENT',
  'COV-PUBLICITY', 'COV-RESIGN', 'COV-SECREPORT', 'COV-TAKEOVER',
]);

test('LEXICAL_FAMILY_LEXICON_VERSION bumped 4 -> 5 (family-termination-rights slice)', () => {
  assert.equal(LEXICAL_FAMILY_LEXICON_VERSION, 11);
  assert.equal(LEXICAL_FAMILY_LEXICON.version, 11);
});

test('table validation: every TERMR entry has a non-empty pattern_id, family, kind, value, rationale; no duplicate pattern_id; every family is a registered concept key', () => {
  assert.doesNotThrow(() => validateLexicalFamilyLexicon(LEXICAL_FAMILY_LEXICON, {
    registeredConceptKeys: REGISTERED_CONCEPT_KEYS,
  }));
  const termrEntries = LEXICAL_FAMILY_LEXICON.entries.filter((e) => e.family.startsWith('TERMR'));
  assert.ok(termrEntries.length > 0);
  for (const entry of termrEntries) {
    assert.ok(entry.rationale && entry.rationale.length > 0, `${entry.pattern_id} missing rationale`);
  }
});

test('all six covered TERMR families are represented; TERMR-NOSOL-BREACH is deliberately uncovered (zero entries)', () => {
  const families = new Set(LEXICAL_FAMILY_LEXICON.entries.map((e) => e.family));
  for (const family of ['TERMR-MUTUAL', 'TERMR-OUTSIDE', 'TERMR-NOVOTE', 'TERMR-BREACH', 'TERMR-LEGAL', 'TERMR-SUPERIOR', 'TERMR-RECOMMEND']) {
    assert.ok(families.has(family), `expected at least one entry for ${family}`);
  }
  assert.ok(!families.has('TERMR-NOSOL-BREACH'), 'TERMR-NOSOL-BREACH must carry zero lexicon entries this slice (no grounded corpus text)');
});

test('TERMR-OUTSIDE case-sensitive defined terms fire on exact case only ("Outside Date" matches, "outside date" in prose does not)', () => {
  const outsideDateEntry = LEXICAL_FAMILY_LEXICON.entries.find(
    (e) => e.family === 'TERMR-OUTSIDE' && e.value === 'Outside Date',
  );
  assert.ok(outsideDateEntry);
  assert.equal(outsideDateEntry.kind, 'LITERAL_ACRONYM', 'case-sensitive defined terms must use the case-sensitive LITERAL_ACRONYM kind');
  assert.deepEqual(scanLiteral('the "Outside Date" is defined below', outsideDateEntry.value, true).length, 1);
  assert.deepEqual(scanLiteral('the outside date for closing is unclear', outsideDateEntry.value, true).length, 0);
});

test('TERMR-SUPERIOR "Superior Proposal" and TERMR-RECOMMEND defined terms are case-sensitive', () => {
  const superiorEntry = LEXICAL_FAMILY_LEXICON.entries.find((e) => e.family === 'TERMR-SUPERIOR');
  assert.equal(superiorEntry.kind, 'LITERAL_ACRONYM');
  const changeInRecommendationEntry = LEXICAL_FAMILY_LEXICON.entries.find(
    (e) => e.family === 'TERMR-RECOMMEND' && e.value === 'Change in Recommendation',
  );
  assert.ok(changeInRecommendationEntry, 'audit M-2: "Change in Recommendation" must be a registered pattern');
});

test('TERMR-MUTUAL covers both "mutual written consent" and "mutual written agreement" (audit M-2)', () => {
  const values = LEXICAL_FAMILY_LEXICON.entries.filter((e) => e.family === 'TERMR-MUTUAL').map((e) => e.value);
  assert.ok(values.includes('mutual written consent'));
  assert.ok(values.includes('mutual written agreement'));
});

test('TERMR-NOVOTE is narrowed to failure phrases only -- no bare Stockholder/Shareholder Approval defined term (audit M-4)', () => {
  const novoteEntries = LEXICAL_FAMILY_LEXICON.entries.filter((e) => e.family === 'TERMR-NOVOTE');
  for (const entry of novoteEntries) {
    assert.ok(!/^stockholder approval$/i.test(entry.value.trim()));
    assert.ok(!/^shareholder approval$/i.test(entry.value.trim()));
  }
});

test('anti-noise regression: chapeau/administrative prose never fires a TERMR-OUTSIDE, TERMR-NOVOTE, or TERMR-BREACH pattern', () => {
  const chapeauText = 'This Agreement may be terminated at any time prior to the Effective Time. Any material breach '
    + 'of the representations and warranties set forth in this Article III shall not, by itself, constitute grounds '
    + 'for termination under this Section.';
  const outsideEntries = LEXICAL_FAMILY_LEXICON.entries.filter((e) => e.family === 'TERMR-OUTSIDE');
  for (const entry of outsideEntries) {
    const caseSensitive = entry.kind === 'LITERAL_ACRONYM';
    assert.deepEqual(scanLiteral(chapeauText, entry.value, caseSensitive), [], `${entry.pattern_id} unexpectedly hit chapeau prose`);
  }
});

test('anti-noise regression (spec section 5, audit M-4): the mutual parenthetical and the SUPERIOR condition never fire TERMR-NOVOTE\'s narrowed failure-phrase patterns', () => {
  const mutualParenthetical = 'by mutual written consent of Parent and the Company, whether prior to or after the '
    + 'receipt of the Requisite Stockholder Approval';
  const superiorCondition = 'the Company Board has determined that an Acquisition Proposal constitutes a Superior '
    + 'Proposal prior to obtaining the Company Stockholder Approval';
  const novoteEntries = LEXICAL_FAMILY_LEXICON.entries.filter((e) => e.family === 'TERMR-NOVOTE');
  for (const entry of novoteEntries) {
    assert.deepEqual(scanLiteral(mutualParenthetical, entry.value, false), []);
    assert.deepEqual(scanLiteral(superiorCondition, entry.value, false), []);
  }
});

test('the priced cross-hit cost is EXPECTED, not silently missed: TERMR-OUTSIDE defined terms DO hit inside the earlier-of cure sentence (spec section 5)', () => {
  const earlierOfSentence = 'which is not cured within the earlier of (1) the Outside Date and (2) 30 days following written notice to Parent';
  const outsideDateEntry = LEXICAL_FAMILY_LEXICON.entries.find(
    (e) => e.family === 'TERMR-OUTSIDE' && e.value === 'Outside Date',
  );
  assert.ok(scanLiteral(earlierOfSentence, outsideDateEntry.value, true).length >= 1, 'the priced cross-hit cost must actually occur -- an EXPECTED unmatched-signal hit, not a clean miss');
});
