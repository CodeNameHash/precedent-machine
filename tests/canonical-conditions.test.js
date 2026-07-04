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

/* ── Regression: Metsera (deal 64d894e4) rendered ALL Mutual Conditions rows
   as "Not present in this agreement" even though the deal has stockholder-
   approval, no-injunction, and antitrust conditions. The rows MATCHED fine;
   the Standard/Detail cell builder only looked at threshold / cure / scrape
   features, found none, and fell through to the absent copy — a false
   affirmative absence. conditionDetailLines (extracted pure) must produce
   displayable lines from the real Metsera feature shapes, and empty lines on
   a MATCHED row must never be conflated with absence (the component renders
   "Present (detail not extracted)" for that case). */

// The exact ai_metadata.features shapes from the live Metsera COND-M rows.
const METSERA_STOCKHOLDER_FEATURES = {
  hsrClearance: false,
  mainCondition: 'The Company Stockholder Approval must have been duly obtained in accordance with applicable law, the Company Charter, and the Company By-laws at the Company Stockholder Meeting.',
  stockholderApprovalRequired: true,
};
const METSERA_LEGAL_FEATURES = {
  hsrClearance: false,
  mainCondition: 'No judgment issued by any court of competent jurisdiction or law enacted by any Governmental Entity that prevents or prohibits consummation of the Merger shall be in effect at closing.',
  stockholderApprovalRequired: false,
  absenceOfEnjoiningOrderPresent: { value: true, quotes: ['No Judgment issued by any court of competent jurisdiction or Law…'] },
};
const METSERA_REG_FEATURES = {
  hsrClearance: true,
  mainCondition: 'The HSR Act waiting period must have expired or been terminated, and any additional antitrust approvals must have been obtained.',
  scheduleReference: 'Section 7.01(a) of the Company Disclosure Letter',
  stockholderApprovalRequired: false,
};

test('Metsera mutual rows match by canonical code (Stockholder / Legal / Reg)', () => {
  const { CANONICAL_CONDITIONS_M, conditionRowMatches } = mod;
  const stockholder = CANONICAL_CONDITIONS_M.find((r) => /Stockholder Approval \(Company\)/.test(r.label));
  const noInj = CANONICAL_CONDITIONS_M.find((r) => /Injunction/i.test(r.label));
  const antitrust = CANONICAL_CONDITIONS_M.find((r) => /Antitrust/i.test(r.label));
  assert.equal(conditionRowMatches(stockholder, prov('Stockholder Approval', 'COND-M-STOCKHOLDER'), 'COND-M-STOCKHOLDER'), true);
  assert.equal(conditionRowMatches(noInj, prov('No Legal Impediment', 'COND-M-LEGAL'), 'COND-M-LEGAL'), true);
  assert.equal(conditionRowMatches(antitrust, prov('Regulatory Approvals', 'COND-M-REG'), 'COND-M-REG'), true);
});

test('conditionDetailLines surfaces the mainCondition summary (Metsera stockholder approval)', () => {
  const { conditionDetailLines } = mod;
  const lines = conditionDetailLines(METSERA_STOCKHOLDER_FEATURES);
  assert.ok(lines.length > 0, 'a matched provision with a mainCondition summary must produce detail lines');
  assert.equal(lines[0].label, 'Condition');
  assert.match(lines[0].value, /Company Stockholder Approval/);
});

test('conditionDetailLines surfaces summary for the no-injunction condition', () => {
  const { conditionDetailLines } = mod;
  const lines = conditionDetailLines(METSERA_LEGAL_FEATURES);
  assert.ok(lines.some((l) => /No judgment/i.test(String(l.value))));
});

test('conditionDetailLines includes the schedule reference (Metsera antitrust)', () => {
  const { conditionDetailLines } = mod;
  const lines = conditionDetailLines(METSERA_REG_FEATURES);
  assert.ok(lines.some((l) => l.label === 'Condition' && /HSR Act/.test(String(l.value))));
  assert.ok(lines.some((l) => l.label === 'Schedule reference' && /7\.01\(a\)/.test(String(l.value))));
});

test('conditionDetailLines unwraps citable {value, quotes} wrappers', () => {
  const { conditionDetailLines } = mod;
  const lines = conditionDetailLines({ mainCondition: { value: 'HSR clearance obtained.', quotes: ['…'] } });
  assert.deepEqual(lines[0], { label: 'Condition', value: 'HSR clearance obtained.' });
});

test('conditionDetailLines returns [] for featureless provisions (General / Preamble shape)', () => {
  const { conditionDetailLines } = mod;
  // Empty lines on a MATCHED row means "present, detail not extracted" —
  // the UI must not render the absent copy for it.
  assert.deepEqual(conditionDetailLines({}), []);
  assert.deepEqual(conditionDetailLines(undefined), []);
});

test('CONDITION_ABSENT_COPY does not assert absence as fact', () => {
  const { CONDITION_ABSENT_COPY } = mod;
  assert.equal(CONDITION_ABSENT_COPY, 'Not found (may not be present, or not yet extracted)');
  assert.ok(!/not present in this agreement/i.test(CONDITION_ABSENT_COPY));
});

/* ── Audit-2 item 1: deriveMaeContinuing — the structured continuingRequirement
   feature must win over the regex fallback. Regression: a provision whose
   condition text read "...Material Adverse Effect that is continuing" (MAE-
   first word order) rendered "Continuing requirement not specified" because
   the old regex only matched the continuing-first order ("continuing to be
   material adverse effect"), even though the structured feature was
   already Yes. */

test('deriveMaeContinuing trusts an explicit true structured feature, no regex needed', () => {
  const { deriveMaeContinuing } = mod;
  assert.equal(deriveMaeContinuing([{ continuingRequirement: true, mainCondition: '', fullText: '' }]), true);
});

test('deriveMaeContinuing trusts an explicit false structured feature over a matching fullText regex', () => {
  const { deriveMaeContinuing } = mod;
  // fullText would regex-match ("continuing to be"), but the structured
  // field is authoritative and says false — must not be overridden.
  assert.equal(
    deriveMaeContinuing([{ continuingRequirement: false, mainCondition: '', fullText: 'shall be continuing to be in effect' }]),
    false
  );
});

test('deriveMaeContinuing falls back to regex when the structured field is absent (legacy provision)', () => {
  const { deriveMaeContinuing } = mod;
  assert.equal(
    deriveMaeContinuing([{ mainCondition: '', fullText: 'there shall not have occurred any Company Material Adverse Effect that is continuing' }]),
    true,
    'trailing "MAE ... that is continuing" word order must match'
  );
});

test('deriveMaeContinuing regex fallback still matches the original continuing-first order', () => {
  const { deriveMaeContinuing } = mod;
  assert.equal(
    deriveMaeContinuing([{ mainCondition: '', fullText: 'no Material Adverse Effect continuing to exist as of the Closing' }]),
    true
  );
});

test('deriveMaeContinuing regex fallback matches "has occurred and is continuing"', () => {
  const { deriveMaeContinuing } = mod;
  assert.equal(
    deriveMaeContinuing([{ mainCondition: '', fullText: 'any Company Material Adverse Effect that has occurred and is continuing' }]),
    true
  );
});

test('deriveMaeContinuing returns null (not specified) when neither structured field nor regex has anything', () => {
  const { deriveMaeContinuing } = mod;
  assert.equal(
    deriveMaeContinuing([{ mainCondition: '', fullText: 'there shall not have occurred any Company Material Adverse Effect' }]),
    null
  );
});
