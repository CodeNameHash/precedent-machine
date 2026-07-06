const test = require('node:test');
const assert = require('node:assert/strict');

const { assertCanonicalFamilyQuality } = require('../lib/parser-v2/run-extract');

test('assertCanonicalFamilyQuality fails family output with uncoded provisions', () => {
  assert.throws(
    () => assertCanonicalFamilyQuality('COND', [
      { type: 'COND-B', category: 'Unclassified', code: null },
      { type: 'COND-M', category: 'No Legal Restraints', code: null },
    ], {
      report: {
        code_enforcement: { failures: [], uncodedRemaining: 0 },
      },
    }),
    /Canonical code quality failed for COND: 2 uncoded provision/,
  );
});

test('assertCanonicalFamilyQuality fails family output with enforcement failures', () => {
  assert.throws(
    () => assertCanonicalFamilyQuality('REP-T', [
      { type: 'REP-T', category: 'Organization', code: 'REP-T-ORG' },
    ], {
      report: {
        code_enforcement: {
          failures: [{ type: 'REP-T', reason: 'ai-call-failed' }],
          uncodedRemaining: 1,
        },
      },
    }),
    /enforcement uncoded remaining, 1 enforcement failure/,
  );
});

test('assertCanonicalFamilyQuality allows clean and catch-all family output', () => {
  assert.doesNotThrow(() => assertCanonicalFamilyQuality('DEF', [
    { type: 'DEF', category: 'General Definition', code: 'DEF-GENERAL' },
    { type: 'DEF', category: '[PROPOSED] Bespoke Definition', code: null, isNewCode: true, proposedCode: 'DEF-BESPOKE' },
  ], {
    report: {
      code_enforcement: { failures: [], uncodedRemaining: 0 },
    },
  }));
  assert.doesNotThrow(() => assertCanonicalFamilyQuality('OTHER', [
    { type: 'OTHER', category: 'Uncovered text', code: null },
  ], {
    report: {
      code_enforcement: { failures: [{ reason: 'ignored' }], uncodedRemaining: 12 },
    },
  }));
});
