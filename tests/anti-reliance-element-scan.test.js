/* v1 reclassification (2026-08-02, R3) — the anti-reliance family element
 * scan. docs/superpowers/specs/2026-08-02-v1-reclassification-design.md
 * §2/Acceptance item 2 pins: compound Skechers section yields NOOTHERREPS +
 * NONRELIANCE cards with disjoint spans; an independent-investigation
 * section yields INDEPINVEST; a fraud-carveout section yields
 * FRAUDCARVEOUT; an unboundable compound yields the typed unsplit flag
 * (needs_review, family code kept unless the no-other-reps phrase class
 * itself matched).
 *
 * This slice is CODE ONLY / offline (no DB reads) — the Skechers text below
 * is the REAL corpus text, taken verbatim from the committed comparator
 * fixture (tests/fixtures/canonical-v2/v1v2-comparator/
 * skechers-v1-provision-snapshot.json, section_ref "3.28 | No Other
 * Representations or Warranties"). The ruling doc's acceptance criteria
 * reference "§4.17" for this deal and cite two other deals (0d38cc1f §4.12
 * independent-investigation, 885edae5 §9.07 fraud-carveout) whose text is
 * NOT available in any committed fixture under this offline-only slice —
 * those two cases are covered with representative synthetic text below,
 * flagged as such; confirming them against the real corpus text is exactly
 * the 29-card hand review the spec's apply procedure (§4) calls for before
 * Ben's morning gate, not something this slice can do without a DB read.
 * Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {
  expandAntiRelianceElements,
  splitIntoSubclauseBlocks,
  ANTI_RELIANCE_ELEMENT_PATTERNS,
} = require('../lib/parser-v2/extract');

function loadSkechersNorepText() {
  const p = path.join(__dirname, 'fixtures/canonical-v2/v1v2-comparator/skechers-v1-provision-snapshot.json');
  const fixture = JSON.parse(fs.readFileSync(p, 'utf8'));
  const rows = Array.isArray(fixture) ? fixture : (fixture.cards || fixture.provisions || []);
  const row = rows.find((r) => r.provision_subtype === 'REP-T-NOREP');
  assert.ok(row, 'fixture must carry a REP-T-NOREP row for this test to be grounded in real corpus text');
  return row.primary_quote;
}

test('compound Skechers §3.28 (no-other-reps + no-reliance) yields two disjoint element cards', () => {
  const text = loadSkechersNorepText();
  const out = expandAntiRelianceElements([{ type: 'REP-T', code: 'REP-T-NOREP', text, startChar: 100, features: {} }]);
  assert.equal(out.length, 2);
  const codes = out.map((p) => p.code).sort();
  assert.deepEqual(codes, ['REP-T-NONRELIANCE', 'REP-T-NOOTHERREPS']);
  for (const p of out) assert.equal(p.needs_review, undefined);

  // Disjoint spans: neither element's text is a substring of the other,
  // and their startChar-derived ranges do not overlap.
  const noOtherReps = out.find((p) => p.code === 'REP-T-NOOTHERREPS');
  const nonReliance = out.find((p) => p.code === 'REP-T-NONRELIANCE');
  assert.ok(!noOtherReps.text.includes(nonReliance.text));
  assert.ok(!nonReliance.text.includes(noOtherReps.text));
  const noOtherEnd = noOtherReps.startChar + noOtherReps.text.length;
  assert.ok(nonReliance.startChar >= noOtherReps.startChar);
  assert.ok(nonReliance.startChar >= noOtherEnd - 5, 'element spans should not meaningfully overlap');
});

test('independent-investigation clause yields REP-B-INDEPINVEST (synthetic text — see file header)', () => {
  const text = [
    '9.07 Entire Agreement; No Other Representations or Warranties.',
    '',
    '(a) No Other Representations. Except for the representations and warranties expressly set forth in this Agreement, neither party makes any representation or warranty, and each party disclaims any other or implied representations or warranties.',
    '',
    '(b) Independent Investigation. Each party acknowledges that it has conducted its own independent investigation, review and analysis of the business of the other party and its results.',
  ].join('\n\n');
  const out = expandAntiRelianceElements([{ type: 'REP-B', code: 'REP-B-ANTIRELIANCE', text, startChar: 0, features: {} }]);
  const codes = out.map((p) => p.code).sort();
  assert.deepEqual(codes, ['REP-B-INDEPINVEST', 'REP-B-NOOTHERREPS']);
  const indep = out.find((p) => p.code === 'REP-B-INDEPINVEST');
  assert.match(indep.text, /independent investigation/i);
});

test('fraud carve-out clause yields REP-B-FRAUDCARVEOUT (synthetic text — see file header)', () => {
  const text = [
    '9.07 Entire Agreement; No Other Representations or Warranties.',
    '',
    '(a) No Other Representations. Except for the representations and warranties expressly set forth in this Agreement, neither party makes any representation or warranty, and each party disclaims any other or implied representations or warranties.',
    '',
    '(b) Fraud Carve-Out. Notwithstanding the foregoing, nothing in this Section shall limit any party\'s remedies for common law fraud.',
  ].join('\n\n');
  const out = expandAntiRelianceElements([{ type: 'REP-B', code: 'REP-B-ANTIRELIANCE', text, startChar: 0, features: {} }]);
  const codes = out.map((p) => p.code).sort();
  assert.deepEqual(codes, ['REP-B-FRAUDCARVEOUT', 'REP-B-NOOTHERREPS']);
});

test('unboundable single-sentence compound yields the typed unsplit flag (needs_review, NOOTHERREPS recode since that phrase matched)', () => {
  const text = 'Exclusivity of Representations. Except as expressly set forth herein, no other representations or warranties are made and each party acknowledges it is not relying on any statements outside this Agreement in connection with its own independent investigation, other than claims for fraud.';
  const out = expandAntiRelianceElements([{ type: 'REP-B', code: 'REP-B-ANTIRELIANCE', text, startChar: 0, features: {} }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].needs_review, true);
  assert.equal(out[0].code, 'REP-B-NOOTHERREPS');
});

test('unboundable compound WITHOUT a no-other-reps signal keeps the family-level legacy code, flagged for review', () => {
  const text = 'Reliance. Each party acknowledges it is not relying on any statements outside this Agreement in connection with its own independent investigation of the other party.';
  const out = expandAntiRelianceElements([{ type: 'REP-B', code: 'REP-B-ANTIRELIANCE', text, startChar: 0, features: {} }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].needs_review, true);
  assert.equal(out[0].code, 'REP-B-ANTIRELIANCE'); // unchanged — never a specific element the scan did not establish
});

test('REP-B-NOREP folds into REP-B-NOOTHERREPS when the section is purely no-other-reps (no heading structure needed)', () => {
  const text = 'No Other Representations or Warranties. Except for the representations and warranties expressly set forth in this Agreement, the Company makes no other representation or warranty of any kind.';
  const out = expandAntiRelianceElements([{ type: 'REP-B', code: 'REP-B-NOREP', text, startChar: 0, features: {} }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'REP-B-NOOTHERREPS');
  assert.equal(out[0].needs_review, undefined);
});

test('provisions coded outside the anti-reliance family pass through unchanged', () => {
  const p = { type: 'REP-T', code: 'REP-T-FDA', text: 'FDA compliance language.', startChar: 0, features: {} };
  const out = expandAntiRelianceElements([p]);
  assert.equal(out.length, 1);
  assert.equal(out[0], p);
});

test('splitIntoSubclauseBlocks falls back to one whole-text block when no heading structure is present', () => {
  const blocks = splitIntoSubclauseBlocks('No headings here at all, just running prose.');
  assert.equal(blocks.length, 1);
});

test('all four element regexes are independently exercised (sanity)', () => {
  assert.match('no other representations or warranties', ANTI_RELIANCE_ELEMENT_PATTERNS.NOOTHERREPS);
  assert.match('the parties acknowledge non-reliance on any estimates', ANTI_RELIANCE_ELEMENT_PATTERNS.NONRELIANCE);
  assert.match('based on its own independent investigation', ANTI_RELIANCE_ELEMENT_PATTERNS.INDEPINVEST);
  assert.match('except in the case of fraud', ANTI_RELIANCE_ELEMENT_PATTERNS.FRAUDCARVEOUT);
});
