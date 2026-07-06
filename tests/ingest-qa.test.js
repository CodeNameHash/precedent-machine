/* Tests for scripts/ingest-qa.js — pure computation helpers only (no DB). */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  familyBaseOf,
  countByExactType,
  countByFamily,
  computeCounts,
  normalizeForDupe,
  computeDuplicateCount,
  provisionCode,
  computeCanonicalRate,
  evaluateGates,
  DEFAULT_GATES,
} = require('../scripts/ingest-qa');

function prov(type, overrides = {}) {
  return { id: overrides.id || Math.random().toString(36).slice(2), type, full_text: '', ai_metadata: {}, ...overrides };
}

test('familyBaseOf collapses party-suffixed types, leaves bare types alone', () => {
  assert.equal(familyBaseOf('COND-M'), 'COND');
  assert.equal(familyBaseOf('COND-B'), 'COND');
  assert.equal(familyBaseOf('COND-S'), 'COND');
  assert.equal(familyBaseOf('COND'), 'COND');
  assert.equal(familyBaseOf('IOC-T'), 'IOC');
  assert.equal(familyBaseOf('TERMR-M'), 'TERMR');
  assert.equal(familyBaseOf('REP-T'), 'REP');
  assert.equal(familyBaseOf(null), '');
  assert.equal(familyBaseOf(undefined), '');
});

test('countByExactType only matches the exact type string', () => {
  const provs = [prov('REP-T'), prov('REP-T'), prov('REP-B'), prov('DEF')];
  assert.equal(countByExactType(provs, 'REP-T'), 2);
  assert.equal(countByExactType(provs, 'REP-B'), 1);
  assert.equal(countByExactType(provs, 'TERMF'), 0);
});

test('countByFamily sums every party variant of a base', () => {
  const provs = [prov('COND'), prov('COND-M'), prov('COND-B'), prov('COND-S'), prov('COND-B'), prov('DEF')];
  assert.equal(countByFamily(provs, 'COND'), 5);
  assert.equal(countByFamily(provs, 'DEF'), 1);
});

test('computeCounts tallies every gated + informational family correctly', () => {
  const provs = [
    ...Array(16).fill(0).map(() => prov('REP-T')),
    ...Array(6).fill(0).map(() => prov('REP-B')),
    ...Array(42).fill(0).map(() => prov('DEF')),
    prov('COND-M'), prov('COND-B'), prov('COND-S'),
    ...Array(5).fill(0).map(() => prov('COND')),
    prov('IOC-T'), prov('IOC-B'),
    prov('NOSOL'),
    prov('TERMR-M'), prov('TERMR-B'), prov('TERMR-T'), prov('TERMR'),
    prov('TERMF'), prov('TERMF'),
  ];
  const counts = computeCounts(provs);
  assert.equal(counts.total, provs.length);
  assert.equal(counts.repT, 16);
  assert.equal(counts.repB, 6);
  assert.equal(counts.def, 42);
  assert.equal(counts.cond, 8); // COND-M + COND-B + COND-S + 5×COND
  assert.equal(counts.ioc, 2);
  assert.equal(counts.nosol, 1);
  assert.equal(counts.termr, 4);
  assert.equal(counts.termf, 2);
});

test('computeCounts on empty input is all zeros', () => {
  const counts = computeCounts([]);
  assert.deepEqual(counts, { total: 0, repT: 0, repB: 0, def: 0, cond: 0, ioc: 0, nosol: 0, termr: 0, termf: 0 });
});

test('normalizeForDupe strips markers, collapses whitespace, lowercases', () => {
  assert.equal(
    normalizeForDupe('[[SECTION]] The   Company  shall  [[/SECTION]]  Comply.'),
    'the company shall comply.',
  );
  assert.equal(normalizeForDupe(null), '');
  assert.equal(normalizeForDupe(undefined), '');
});

test('computeDuplicateCount counts redundant copies, not distinct groups', () => {
  const text = 'The Company shall use commercially reasonable efforts to close the transaction promptly.';
  const provs = [
    prov('REP-T', { full_text: text }),
    prov('REP-T', { full_text: text }), // dup of above
    prov('REP-T', { full_text: text }), // dup of above (2 extra copies total for this group)
    prov('REP-B', { full_text: 'A totally different clause about something else entirely here.' }),
  ];
  assert.equal(computeDuplicateCount(provs), 2);
});

test('computeDuplicateCount ignores short/empty text (no false positives)', () => {
  const provs = [
    prov('DEF', { full_text: 'means the above.' }),
    prov('DEF', { full_text: 'means the above.' }),
  ];
  // Both texts are < 20 normalized chars — treated as unjudgeable, not dups.
  assert.equal(computeDuplicateCount(provs), 0);
});

test('computeDuplicateCount is 0 when every clause is unique', () => {
  const provs = [
    prov('REP-T', { full_text: 'The Company represents and warrants that it is duly organized and validly existing.' }),
    prov('REP-B', { full_text: 'Parent represents and warrants that it has full corporate power and authority to enter into this Agreement.' }),
  ];
  assert.equal(computeDuplicateCount(provs), 0);
});

test('provisionCode reads canonicalCode first, falls back to ai_metadata.code', () => {
  assert.equal(provisionCode(prov('REP-T', { ai_metadata: { features: { canonicalCode: 'REP-T-ORG' }, code: 'REP-T-OTHER' } })), 'REP-T-ORG');
  assert.equal(provisionCode(prov('REP-T', { ai_metadata: { code: 'REP-T-ORG' } })), 'REP-T-ORG');
  assert.equal(provisionCode(prov('REP-T', { ai_metadata: {} })), null);
  assert.equal(provisionCode(prov('REP-T', { ai_metadata: null })), null);
});

test('computeCanonicalRate excludes DEF and penalizes [PROPOSED and missing codes', () => {
  const provs = [
    prov('REP-T', { ai_metadata: { code: 'REP-T-ORG' } }),
    prov('REP-T', { ai_metadata: { code: 'REP-T-CAP' } }),
    prov('REP-T', { ai_metadata: { code: '[PROPOSED] something novel' } }),
    prov('REP-T', { ai_metadata: {} }),
    prov('DEF', { ai_metadata: {} }), // excluded from denominator entirely
  ];
  // 2 canonical out of 4 eligible (DEF excluded) = 0.5
  assert.equal(computeCanonicalRate(provs), 0.5);
});

test('computeCanonicalRate is vacuously 1 when there are no non-DEF provisions', () => {
  assert.equal(computeCanonicalRate([prov('DEF'), prov('DEF')]), 1);
  assert.equal(computeCanonicalRate([]), 1);
});

test('evaluateGates: all-pass metrics evaluate to ok=true', () => {
  const metrics = {
    counts: { repT: 20, repB: 8, def: 50, cond: 10, ioc: 3, nosol: 1, termr: 4, termf: 1, total: 97 },
    coveragePct: 96,
    unverified: 0,
    duplicates: 0,
    canonicalRate: 0.85,
  };
  const result = evaluateGates(metrics);
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 8);
  assert.ok(result.checks.every((c) => c.pass));
});

test('evaluateGates flags a below-threshold count and an unverified quote', () => {
  const metrics = {
    counts: { repT: 5, repB: 8, def: 50, cond: 10, ioc: 0, nosol: 0, termr: 0, termf: 0, total: 5 },
    coveragePct: 96,
    unverified: 2,
    duplicates: 0,
    canonicalRate: 0.85,
  };
  const result = evaluateGates(metrics);
  assert.equal(result.ok, false);
  const repTCheck = result.checks.find((c) => c.label === 'REP-T');
  assert.equal(repTCheck.pass, false);
  const unverifiedCheck = result.checks.find((c) => c.label === 'unverified quotes');
  assert.equal(unverifiedCheck.pass, false);
  const failed = result.checks.filter((c) => !c.pass);
  assert.equal(failed.length, 2);
});

test('evaluateGates honors gate overrides (e.g. --min-rep-t)', () => {
  const metrics = {
    counts: { repT: 5, repB: 8, def: 50, cond: 10, ioc: 0, nosol: 0, termr: 0, termf: 0, total: 5 },
    coveragePct: 96,
    unverified: 0,
    duplicates: 0,
    canonicalRate: 0.85,
  };
  const strict = evaluateGates(metrics);
  assert.equal(strict.ok, false); // fails default REP-T >= 15

  const relaxed = evaluateGates(metrics, { repT: 5 });
  assert.equal(relaxed.ok, true);
});

test('DEFAULT_GATES matches the documented thresholds', () => {
  assert.deepEqual(DEFAULT_GATES, {
    repT: 15,
    repB: 5,
    def: 40,
    cond: 8,
    coverage: 95,
    canonicalRate: 0.7,
  });
});
