'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const {
  MATERIALITY_TABLE,
  materialityFor,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

const APPROVED_FAMILY_RANKS = Object.freeze([
  { rank: 10, matches: (key) => key.startsWith('TERMR-') },
  { rank: 20, matches: (key) => key.startsWith('TERMF-') || key === 'DEF-WILLFUL' },
  { rank: 25, matches: (key) => key.startsWith('REM-') || key.startsWith('REMEDY-') },
  { rank: 30, matches: (key) => key === 'DEF-MAE' },
  { rank: 40, matches: (key) => ['DEF-ACQPROPOSAL', 'DEF-SUPERIOR', 'DEF-INTERVENING'].includes(key) },
  { rank: 50, matches: (key) => key.startsWith('NOSOL-') },
  { rank: 55, matches: (key) => key === 'DEF-KNOWLEDGE' },
  { rank: 60, matches: (key) => key.startsWith('CONS-') },
  { rank: 63, matches: (key) => key.startsWith('ANTI-') },
  { rank: 65, matches: (key) => key.startsWith('IOC-') },
  { rank: 70, matches: (key) => key.startsWith('COND-') },
  { rank: 74, matches: (key) => key.startsWith('GTY-') },
  { rank: 75, matches: (key) => ['COV-FINANCING', 'COV-PAYOFF', 'COV-MARKETING'].includes(key) },
  { rank: 80, matches: (key) => key.startsWith('COV-PROXY') || key === 'COV-MEETING' },
  { rank: 81, matches: (key) => key.startsWith('TAXM-') || ['DEF-TAX', 'DEF-TAX-RETURN'].includes(key) },
  { rank: 82, matches: (key) => key === 'COV-EMPLOYEE' },
  { rank: 84, matches: (key) => key.startsWith('DIVD-') },
  { rank: 85, matches: (key) => key.startsWith('DNO-') },
  { rank: 87, matches: (key) => key === 'MERGER-STRUCTURE' },
  { rank: 88, matches: (key) => key.startsWith('APPR-') },
  { rank: 90, matches: (key) => key === 'MISC-BOILERPLATE' || key.startsWith('ADMIN-') },
]);

test('every registered concept with an approved family rank avoids rank 99', () => {
  const conceptKeys = compileFixtureContractV38().concepts.map((concept) => concept.concept_key);
  const checked = [];

  for (const conceptKey of conceptKeys) {
    const approved = APPROVED_FAMILY_RANKS.find((entry) => entry.matches(conceptKey));
    if (!approved) continue;
    checked.push(conceptKey);
    assert.equal(materialityFor({ conceptKey }).rank, approved.rank, conceptKey);
  }

  assert.ok(checked.length > 0);
  assert.equal(materialityFor({ conceptKey: 'REM-PENDING' }).rank, 25);
  assert.equal(materialityFor({ conceptKey: 'ADMIN-PENDING' }).rank, 90);
});

test('unadjudicated family ranks remain explicit gaps', () => {
  assert.equal(materialityFor({ conceptKey: 'DEF-MADE-AVAILABLE' }).rank, 99);
  assert.equal(materialityFor({ conceptKey: 'DEF-ORDINARY-COURSE' }).rank, 99);
  assert.equal(materialityFor({ conceptKey: 'COV-ACCESS' }).rank, 99);
  assert.equal(MATERIALITY_TABLE.some((tier) => tier.label === 'MATERIAL_CONTRACTS'), false);
  assert.equal(MATERIALITY_TABLE.some((tier) => tier.label === 'GENERAL_COVENANTS'), false);
});
