/* Tests for lib/canonical-conditions.js — condition-row matching.
   Run: npm test
   Guards the bug where rows matched provision.category by regex and dropped
   present conditions ("No Legal Impediment" / "Accuracy of Target Reps") to
   "Not present" because the label wording diverged from the row wording. */
const test = require('node:test');
const assert = require('node:assert/strict');
// canonical-conditions.js uses ESM `export`; require the transpiled shape via
// a tiny interop: node:test runs CJS, so pull named exports through require.
const path = require('path');

// The module is authored with ESM export syntax; load it through a dynamic
// import so this test works under `node --test` without a build step.
let mod;
test.before(async () => {
  mod = await import(path.join('..', 'lib', 'canonical-conditions.js'));
});

const prov = (category, code) => ({ category, ai_metadata: { features: { canonicalCode: code } } });

test('code match fills the row regardless of category wording', () => {
  const { CANONICAL_CONDITIONS_M, conditionRowMatches } = mod;
  const noInj = CANONICAL_CONDITIONS_M.find((r) => /Injunction/i.test(r.label));
  // Red Hat's condition: category "No Legal Impediment", code COND-M-LEGAL.
  assert.equal(conditionRowMatches(noInj, prov('No Legal Impediment', 'COND-M-LEGAL'), 'COND-M-LEGAL'), true);
});

test('Reps Bring-Down matches COND-B-REP even when category says "Reps" not "representations"', () => {
  const { CANONICAL_CONDITIONS_B, conditionRowMatches } = mod;
  const bringDown = CANONICAL_CONDITIONS_B.find((r) => /Bring[\s-]*Down/i.test(r.label));
  assert.equal(conditionRowMatches(bringDown, prov('Accuracy of Target Reps', 'COND-B-REP'), 'COND-B-REP'), true);
});

test("Officer's Certificate now has a row and matches COND-B-CERT (was previously absent)", () => {
  const { CANONICAL_CONDITIONS_B, conditionRowMatches } = mod;
  const cert = CANONICAL_CONDITIONS_B.find((r) => /Certificate/i.test(r.label));
  assert.ok(cert, "Officer's Certificate row must exist");
  assert.equal(conditionRowMatches(cert, prov("Officer's Certificate (Target)", 'COND-B-CERT'), 'COND-B-CERT'), true);
});

test('regex fallback still works for provisions with no canonical code', () => {
  const { CANONICAL_CONDITIONS_M, conditionRowMatches } = mod;
  const stockholder = CANONICAL_CONDITIONS_M.find((r) => /Stockholder Approval \(Company\)/.test(r.label));
  assert.equal(conditionRowMatches(stockholder, { category: 'Stockholder Approval' }, null), true);
});

test('a row does not match an unrelated condition by code', () => {
  const { CANONICAL_CONDITIONS_B, conditionRowMatches } = mod;
  const bringDown = CANONICAL_CONDITIONS_B.find((r) => /Bring[\s-]*Down/i.test(r.label));
  // A covenant-performance provision must not fill the bring-down row.
  assert.equal(conditionRowMatches(bringDown, prov('Target Covenant Compliance', 'COND-B-COV'), 'COND-B-COV'), false);
});
