'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const {
  MATERIALITY_TABLE,
  materialityFor,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { GENERAL_COVENANT_CODES } = require('../lib/canonical-v2/native-producer/general-covenants-producer-prompt');

const APPROVED_FAMILY_RANKS = Object.freeze([
  { rank: 10, matches: (key) => key.startsWith('TERMR-') },
  { rank: 20, matches: (key) => key.startsWith('TERMF-') || key === 'DEF-WILLFUL' },
  { rank: 25, matches: (key) => key.startsWith('REM-') || key.startsWith('REMEDY-') },
  { rank: 30, matches: (key) => key === 'DEF-MAE' },
  { rank: 40, matches: (key) => ['DEF-ACQPROPOSAL', 'DEF-SUPERIOR', 'DEF-INTERVENING'].includes(key) },
  { rank: 50, matches: (key) => key.startsWith('NOSOL-') },
  // Owner ruling, 2026-08-05: Material Contracts ~55, between no-shop and
  // consideration. Must be checked (and stay listed) before the rank-55
  // DEF-KNOWLEDGE/REP-T-/REP-B- entry below: REP-T-CONTRACTS starts with
  // the same REP-T- prefix REPRESENTATIONS claims, so which one wins is an
  // array-order question, not a rank-number one -- see the "resolves to
  // MATERIAL_CONTRACTS, not REPRESENTATIONS" assertion below.
  { rank: 54, matches: (key) => key === 'REP-T-CONTRACTS' },
  { rank: 55, matches: (key) => key === 'DEF-KNOWLEDGE' },
  { rank: 60, matches: (key) => key.startsWith('CONS-') },
  { rank: 63, matches: (key) => key.startsWith('ANTI-') },
  { rank: 65, matches: (key) => key.startsWith('IOC-') },
  // Owner ruling, 2026-08-05: Made Available and Ordinary Course near 66,
  // alongside the interim operating covenants they sit within.
  { rank: 66, matches: (key) => key === 'DEF-MADE-AVAILABLE' || key === 'DEF-ORDINARY-COURSE' },
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
  // Owner ruling, 2026-08-05: General Covenants ranks last (highest number
  // of any entry) -- a catch-all router that must never beat a specific
  // family to a clause. GENERAL_COVENANT_CODES is the general-covenants
  // producer's own follow-on code list, so this predicate tracks the same
  // codes the production table's catch-all tier matches, no hand-copy.
  { rank: 95, matches: (key) => GENERAL_COVENANT_CODES.includes(key) },
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

test('the four owner-approved family ranks (2026-08-05) are present and ordered as ruled', () => {
  // Material Contracts ~55, between no-shop (50) and consideration (60).
  assert.equal(MATERIALITY_TABLE.some((tier) => tier.label === 'MATERIAL_CONTRACTS'), true);
  assert.equal(materialityFor({ conceptKey: 'REP-T-CONTRACTS' }).rank, 54);
  assert.ok(materialityFor({ conceptKey: 'REP-T-CONTRACTS' }).rank > materialityFor({ conceptKey: 'NOSOL-CEASE' }).rank);
  assert.ok(materialityFor({ conceptKey: 'REP-T-CONTRACTS' }).rank < materialityFor({ conceptKey: 'CONS-PERSHARE' }).rank);
  // Resolves to MATERIAL_CONTRACTS specifically, not the broader REP-T-
  // prefix REPRESENTATIONS also claims -- the collision this family's own
  // concept key creates with REPRESENTATIONS is resolved correctly.
  assert.equal(materialityFor({ conceptKey: 'REP-T-CONTRACTS' }).label, 'MATERIAL_CONTRACTS');
  assert.equal(materialityFor({ conceptKey: 'REP-T-ORG' }).label, 'REPRESENTATIONS');

  // Made Available and Ordinary Course near 66, alongside the interim
  // operating covenants (65) they sit within.
  assert.equal(MATERIALITY_TABLE.some((tier) => tier.label === 'MADE_AVAILABLE_AND_ORDINARY_COURSE'), true);
  assert.equal(materialityFor({ conceptKey: 'DEF-MADE-AVAILABLE' }).rank, 66);
  assert.equal(materialityFor({ conceptKey: 'DEF-ORDINARY-COURSE' }).rank, 66);
  assert.equal(materialityFor({ conceptKey: 'IOC-MERGE' }).rank, 65);

  // General Covenants ranks last (highest number of any entry): a catch-all
  // router that must never beat a specific family to a clause.
  assert.equal(MATERIALITY_TABLE.some((tier) => tier.label === 'GENERAL_COVENANTS'), true);
  const generalCovenants = MATERIALITY_TABLE.find((tier) => tier.label === 'GENERAL_COVENANTS');
  const maxRank = Math.max(...MATERIALITY_TABLE.map((tier) => tier.rank));
  assert.equal(generalCovenants.rank, maxRank);
  assert.equal(materialityFor({ conceptKey: 'COV-ACCESS' }).rank, generalCovenants.rank);
  assert.equal(materialityFor({ conceptKey: 'COV-PUBLICITY' }).rank, generalCovenants.rank);
  // Codes already owned by a dedicated family still resolve to that
  // family's own, more specific tier -- the catch-all never beats them.
  assert.equal(materialityFor({ conceptKey: 'COV-EMPLOYEE' }).label, 'EMPLOYEE_MATTERS');
  assert.equal(materialityFor({ conceptKey: 'COV-FINANCING' }).label, 'FINANCING_COVENANTS');
  assert.equal(materialityFor({ conceptKey: 'COV-PROXY' }).label, 'PROXY_MEETING_COVENANTS');
});
