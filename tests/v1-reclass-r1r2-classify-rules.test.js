/* v1 reclassification (2026-08-02, R1/R2) — classify.js title-rule splits.
 * R1: REP-T-CONSENT -> REP-T-STOCKAPPROVAL / REP-T-GOVAPPROVAL.
 * R2: REP-T-REGSTATUS -> REP-T-40ACT / REP-T-ADVISERSACT / REP-T-INSREG /
 *     REP-T-CFIUS (only REP-T-40ACT has a regular-enough title for a
 *     deterministic rule per the spec; the other three stay AI-classified).
 * Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { refineSubCode, buildTypeReference } = require('../lib/parser-v2/classify');

const sec = (title) => ({ title, heading: title });

test('R1: "Requisite Stockholder Approval" title routes to REP-T-STOCKAPPROVAL', () => {
  assert.equal(refineSubCode(sec('Requisite Stockholder Approval'), 'REP-T'), 'REP-T-STOCKAPPROVAL');
});

test('R1: "Requisite Governmental Approvals" / "Governmental Authorizations" / "Government Approvals" route to REP-T-GOVAPPROVAL', () => {
  assert.equal(refineSubCode(sec('Requisite Governmental Approvals'), 'REP-T'), 'REP-T-GOVAPPROVAL');
  assert.equal(refineSubCode(sec('Governmental Authorizations'), 'REP-T'), 'REP-T-GOVAPPROVAL');
  assert.equal(refineSubCode(sec('Governmental Authorization'), 'REP-T'), 'REP-T-GOVAPPROVAL');
  assert.equal(refineSubCode(sec('Government Approvals'), 'REP-T'), 'REP-T-GOVAPPROVAL');
});

test('R2: "Investment Company Act" title routes to REP-T-40ACT', () => {
  assert.equal(refineSubCode(sec('Investment Company Act'), 'REP-T'), 'REP-T-40ACT');
});

test('R1/R2 rules only fire for REP-T, never for other resolved types (whenType discipline)', () => {
  assert.equal(refineSubCode(sec('Requisite Stockholder Approval'), 'REP-B'), null);
  assert.equal(refineSubCode(sec('Investment Company Act'), 'COV'), null);
});

test('irregular titles (the corpus grab-bag) are NOT force-routed by a deterministic rule — stay AI-classified', () => {
  // Advisers Act / insurance / CFIUS titles are irregular per the ruling
  // doc's corpus evidence — no title rule was added for them; they must
  // fall through to AI classification against the new CODES vocabulary.
  assert.equal(refineSubCode(sec('Investment Advisers Act Registration'), 'REP-T'), null);
  assert.equal(refineSubCode(sec('State Insurance Licensing'), 'REP-T'), null);
  assert.equal(refineSubCode(sec('CFIUS and National Security'), 'REP-T'), null);
});

test('buildTypeReference (the AI classify prompt) excludes retired codes from its REP-T example list', () => {
  const ref = buildTypeReference();
  assert.ok(!ref.includes('REP-T-CONSENT:'));
  assert.ok(!ref.includes('REP-T-REGSTATUS:'));
});
