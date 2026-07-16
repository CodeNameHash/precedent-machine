/* Tests for NOSOL-T / NOSOL-B / NOSOL-M — party-scoped no-solicitation
   subtypes (reciprocal / reverse-merger no-shops). The DEFAULT plain no-shop
   MUST stay bare 'NOSOL' (unchanged — most deals must keep working); only
   EXPLICITLY buyer-scoped or mutual/reciprocal titles route to NOSOL-B /
   NOSOL-M. Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { tryDeterministic } = require('../lib/parser-v2/classify');
const { PROVISION_TYPES, getCodesForType } = require('../lib/rubric');
const { expandTypeGroup } = require('../lib/parser-v2/extract');

const sec = (number, title, text) => ({
  number, title, heading: title,
  articleNumber: number.split('.')[0], startChar: 0,
  text: text || `Section ${number} ${title}. ${'Substantive obligations of the parties follow herein. '.repeat(10)}`,
});

test('PROVISION_TYPES declares NOSOL-T / NOSOL-B / NOSOL-M', () => {
  const keys = PROVISION_TYPES.map((t) => t.key);
  assert.ok(keys.includes('NOSOL-T'));
  assert.ok(keys.includes('NOSOL-B'));
  assert.ok(keys.includes('NOSOL-M'));
  const nosolT = PROVISION_TYPES.find((t) => t.key === 'NOSOL-T');
  const nosolB = PROVISION_TYPES.find((t) => t.key === 'NOSOL-B');
  const nosolM = PROVISION_TYPES.find((t) => t.key === 'NOSOL-M');
  assert.equal(nosolT.party, 'target');
  assert.equal(nosolB.party, 'buyer');
  assert.equal(nosolM.party, 'mutual');
});

test('default plain no-shop titles stay bare NOSOL (unchanged, most deals)', () => {
  for (const [num, title] of [
    ['6.3', 'No Solicitation'],
    ['6.3', 'No-Shop'],
    ['6.02', 'Unsolicited Proposals'],
    ['6.3', 'Acquisition Proposals'],
    ['6.3', 'Company Board Recommendation'],
  ]) {
    assert.equal(tryDeterministic(sec(num, title), 'COV').type, 'NOSOL', `${title} -> NOSOL (default)`);
  }
});

test('explicit buyer-side no-shop titles route to NOSOL-B', () => {
  for (const [num, title] of [
    ['6.4', 'No Solicitation by Parent'],
    ['6.4', 'No-Shop by Buyer'],
    ['6.4', "Parent's Non-Solicitation"],
    ['6.4', 'Reverse No-Shop'],
  ]) {
    assert.equal(tryDeterministic(sec(num, title), 'COV').type, 'NOSOL-B', `${title} -> NOSOL-B`);
  }
});

test('explicit mutual/reciprocal no-shop titles route to NOSOL-M', () => {
  for (const [num, title] of [
    ['6.3', 'Mutual Non-Solicitation'],
    ['6.3', 'Reciprocal Non-Solicitation'],
    ['6.3', 'No Solicitation by Either Party'],
  ]) {
    assert.equal(tryDeterministic(sec(num, title), 'COV').type, 'NOSOL-M', `${title} -> NOSOL-M`);
  }
});

test('getCodesForType normalizes NOSOL-T/NOSOL-B/NOSOL-M to the base NOSOL code family', () => {
  const baseCodes = getCodesForType('NOSOL').map((c) => c.code).sort();
  assert.ok(baseCodes.includes('NOSOL-PROHIBIT'));
  for (const t of ['NOSOL-T', 'NOSOL-B', 'NOSOL-M']) {
    const codes = getCodesForType(t).map((c) => c.code).sort();
    assert.deepEqual(codes, baseCodes, `${t} codes must match base NOSOL codes`);
  }
});

test('expandTypeGroup("NOSOL") fans in every party subtype (store/extract symmetry)', () => {
  const group = expandTypeGroup('NOSOL');
  assert.deepEqual(group.sort(), ['NOSOL', 'NOSOL-B', 'NOSOL-M', 'NOSOL-T'].sort());
});

test('store-cards.js maps NOSOL-T/NOSOL-B/NOSOL-M to the SAME card provision_type as bare NOSOL (COVENANT_NO_SOLICITATION) — the four nosol-*.config.js SOURCES match on this constant', () => {
  const { provisionType } = require('../lib/parser-v2/store-cards');
  const expected = provisionType({ type: 'NOSOL' });
  assert.equal(expected, 'COVENANT_NO_SOLICITATION');
  for (const t of ['NOSOL-T', 'NOSOL-B', 'NOSOL-M']) {
    assert.equal(provisionType({ type: t }), expected, `${t} card must map to ${expected}`);
  }
});
