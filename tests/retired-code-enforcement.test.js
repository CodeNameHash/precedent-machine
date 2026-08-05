/* v1 reclassification (2026-08-02) — retired-code enforcement (audit A-C2).
 * Acceptance: extract prompts contain zero retired codes; a synthetic model
 * response emitting a retired code produces the typed remap/rejection.
 * Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { getCodesForType, isValidCode, isRetiredCode, getSupersededBy, CODES } = require('../lib/rubric');
const { enforceCanonicalCodes, buildCodesList } = require('../lib/parser-v2/extract');

const RETIRED = ['REP-T-CONSENT', 'REP-T-REGSTATUS', 'REP-B-ANTIRELIANCE', 'REP-B-NOREP', 'REP-T-NOREP'];

test('the five ruling-retired codes are marked retired but stay registered', () => {
  for (const code of RETIRED) {
    assert.ok(isValidCode(code), `${code} must stay registered`);
    assert.ok(isRetiredCode(code), `${code} must be marked retired`);
    assert.equal(CODES[code].retired, '2026-08-02');
    assert.ok(Array.isArray(getSupersededBy(code)) && getSupersededBy(code).length > 0);
  }
});

test('the 14 new v1 reclassification codes are registered and not retired', () => {
  const NEW_CODES = [
    'REP-T-STOCKAPPROVAL', 'REP-T-GOVAPPROVAL',
    'REP-T-40ACT', 'REP-T-ADVISERSACT', 'REP-T-INSREG', 'REP-T-CFIUS',
    'REP-B-NOOTHERREPS', 'REP-B-NONRELIANCE', 'REP-B-INDEPINVEST', 'REP-B-FRAUDCARVEOUT',
    'REP-T-NOOTHERREPS', 'REP-T-NONRELIANCE', 'REP-T-INDEPINVEST', 'REP-T-FRAUDCARVEOUT',
  ];
  assert.equal(NEW_CODES.length, 14);
  for (const code of NEW_CODES) {
    assert.ok(isValidCode(code), `${code} must be registered`);
    assert.ok(!isRetiredCode(code), `${code} must not be retired`);
  }
});

test('getCodesForType excludes retired codes by default (extract prompt vocabulary)', () => {
  const repT = getCodesForType('REP-T').map((c) => c.code);
  assert.ok(!repT.includes('REP-T-CONSENT'));
  assert.ok(!repT.includes('REP-T-REGSTATUS'));
  assert.ok(!repT.includes('REP-T-NOREP'));
  assert.ok(repT.includes('REP-T-STOCKAPPROVAL'));
  assert.ok(repT.includes('REP-T-GOVAPPROVAL'));
  assert.ok(repT.includes('REP-T-40ACT'));

  const repB = getCodesForType('REP-B').map((c) => c.code);
  assert.ok(!repB.includes('REP-B-ANTIRELIANCE'));
  assert.ok(!repB.includes('REP-B-NOREP'));
  assert.ok(repB.includes('REP-B-NOOTHERREPS'));
});

test('getCodesForType({ includeRetired: true }) still returns retired codes for admin/audit tooling', () => {
  const repT = getCodesForType('REP-T', { includeRetired: true }).map((c) => c.code);
  assert.ok(repT.includes('REP-T-CONSENT'));
  assert.ok(repT.includes('REP-T-REGSTATUS'));
});

test('buildCodesList (the actual extract-prompt vocabulary string) contains zero retired codes', () => {
  for (const type of ['REP-T', 'REP-B']) {
    const list = buildCodesList(type);
    for (const code of RETIRED) {
      assert.ok(!list.includes(code), `${type} codes list must not mention retired code ${code}`);
    }
  }
});

test('enforceCanonicalCodes: an unambiguous retired code (single successor) is a typed remap', async () => {
  const prov = { type: 'REP-B', code: 'REP-B-NOREP', category: 'No Other Representations or Warranties', text: 'x' };
  const report = await enforceCanonicalCodes([prov], null);
  assert.equal(prov.code, 'REP-B-NOOTHERREPS');
  assert.equal(prov.retiredCodeRemappedFrom, 'REP-B-NOREP');
  assert.equal(report.retiredRemapped, 1);
});

test('enforceCanonicalCodes: an ambiguous retired code (multiple successors) is a typed rejection to review, never silent acceptance', async () => {
  const prov = { type: 'REP-T', code: 'REP-T-CONSENT', category: 'Consents and Approvals', text: 'x' };
  const report = await enforceCanonicalCodes([prov], null);
  assert.notEqual(prov.code, 'REP-T-CONSENT'); // never silently kept
  assert.equal(prov.code, null); // no client to reassign — left null, not silently retired
  assert.equal(prov.retiredCodeFlag, 'REP-T-CONSENT');
  assert.equal(report.retiredAmbiguousToReview, 1);
});

test('enforceCanonicalCodes: an anti-reliance-family provision the element scan already flagged needs_review is left untouched (no double-processing)', async () => {
  const prov = { type: 'REP-B', code: 'REP-B-ANTIRELIANCE', category: 'Anti-Reliance', text: 'x', needs_review: true };
  const report = await enforceCanonicalCodes([prov], null);
  assert.equal(prov.code, 'REP-B-ANTIRELIANCE'); // unchanged — the scan already made this call
  assert.equal(report.retiredRemapped, 0);
  assert.equal(report.retiredAmbiguousToReview, 0);
});
