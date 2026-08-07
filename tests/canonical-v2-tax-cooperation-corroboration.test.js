'use strict';

/**
 * tests/canonical-v2-tax-cooperation-corroboration.test.js
 *
 * Unit tests for tax-cooperation-corroboration.js (PLAN.md Step 3G, defect
 * 4) -- the lexicon that replaced handleTaxMattersCandidate's inline
 * hardcoded regexes for TAX_OPINION_COOPERATION and TRANSFER_COOPERATION,
 * including the literal `/tax opinion/i` bigram that never matched Modiv's
 * own drafting.
 *
 * Positive cases are drawn verbatim from
 * evidence/canonical-v2/modiv-tax-matters-20260807-replay's own candidates.
 * Hostile cases test real filed text from the SAME run that is genuinely a
 * DIFFERENT TAX_MATTERS assertion kind (TREATMENT_PROTECTION,
 * INTENDED_TREATMENT) against these two corroborators, proving the widened
 * vocabulary does not degrade into "any tax covenant matches".
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  taxOpinionCooperationCorroborated,
  transferCooperationCorroborated,
} = require('../lib/canonical-v2/native-producer/tax-cooperation-corroboration');

// Real quotes, copied verbatim from
// evidence/canonical-v2/modiv-tax-matters-20260807-replay/run-receipt.json.
const REAL_TAX_OPINION_COOPERATION_QUOTE = 'The Company shall use reasonable best efforts to (A) deliver to '
  + 'Morrison & Foerster LLP (or other counsel described in Section 6.3(d)) and Paul, Weiss, Rifkind, Wharton & '
  + 'Garrison LLP (or other counsel described in Section 6.2(d)) officer’s certificates, dated as of the '
  + 'Closing Date (and, if required, as of the effective date of the Form S-4), signed by an officer of the '
  + 'Company (a “Company Tax Representation Letter”), containing customary representations of the '
  + 'Company as shall be reasonably necessary or appropriate to enable Morrison & Foerster LLP (or other counsel '
  + 'described in Section 6.3(d)) to render the opinion described in Section 6.3(d) on the Closing Date';
const REAL_TAX_OPINION_COOPERATION_QUOTE_2 = '(B) deliver to Morrison & Foerster LLP (or other counsel described '
  + 'in Section 6.2(c)) (“Company’s REIT Counsel”) and Greenberg Traurig, LLP (or other counsel '
  + 'described in Section 6.3(c)) (“Parent’s REIT Counsel”) an officer’s certificate ... '
  + 'enable the Company’s REIT Counsel to render the opinion described in Section 6.2(c)';
const REAL_TRANSFER_COOPERATION_QUOTE = 'Parent shall, with the Company’s good faith cooperation and '
  + 'assistance, prepare, execute and file, or cause to be prepared, executed and filed, all returns, '
  + 'questionnaires, applications or other documents regarding Transfer Taxes, and Parent and the Company shall '
  + 'reasonably cooperate to minimize the amount of such Transfer Taxes to the extent permitted by applicable Law.';

// Real filed text, but a DIFFERENT TAX_MATTERS assertion kind -- genuinely
// wrong candidates for either cooperation corroborator.
const REAL_TREATMENT_PROTECTION_QUOTE = 'The Company shall use reasonable best efforts to take all actions, and '
  + 'refrain from taking all actions, as are reasonably necessary to ensure that the Company (and any Company '
  + 'Subsidiary that is classified as a REIT) (i) will qualify for taxation as a REIT for U.S. federal income tax '
  + 'purposes for its current taxable year and any other taxable year that includes the Closing Date, and (ii) '
  + 'will not become liable for U.S. federal income Tax under Section 857(b) or 4981 of the Code.';
const REAL_INTENDED_TREATMENT_QUOTE = 'The Company is not aware of any fact or circumstance that could reasonably '
  + 'be expected to prevent or impede qualification for the Intended Income Tax Treatment.';

test('real Modiv TAX_OPINION_COOPERATION candidates corroborate (no literal "tax opinion" bigram present)', () => {
  assert.equal(/tax opinion/i.test(REAL_TAX_OPINION_COOPERATION_QUOTE), false, 'test fixture must NOT contain the old literal bigram');
  assert.equal(taxOpinionCooperationCorroborated(REAL_TAX_OPINION_COOPERATION_QUOTE), true);
  assert.equal(taxOpinionCooperationCorroborated(REAL_TAX_OPINION_COOPERATION_QUOTE_2), true);
});

test('real Modiv TRANSFER_COOPERATION candidate corroborates ("prepare"/"file", not "preparation"/"filing")', () => {
  assert.equal(/\bpreparation\b|\bfiling\b/i.test(REAL_TRANSFER_COOPERATION_QUOTE), false, 'test fixture must NOT contain the old literal word forms');
  assert.equal(transferCooperationCorroborated(REAL_TRANSFER_COOPERATION_QUOTE), true);
});

test('HOSTILE: real TREATMENT_PROTECTION text (REIT-qualification covenant) does not corroborate as either cooperation covenant', () => {
  assert.equal(taxOpinionCooperationCorroborated(REAL_TREATMENT_PROTECTION_QUOTE), false);
  assert.equal(transferCooperationCorroborated(REAL_TREATMENT_PROTECTION_QUOTE), false);
});

test('HOSTILE: real INTENDED_TREATMENT text (a representation, not a cooperation covenant) does not corroborate as either', () => {
  assert.equal(taxOpinionCooperationCorroborated(REAL_INTENDED_TREATMENT_QUOTE), false);
  assert.equal(transferCooperationCorroborated(REAL_INTENDED_TREATMENT_QUOTE), false);
});

test('HOSTILE: the real TAX_OPINION_COOPERATION quote (cooperative verbs, no Transfer Tax vocabulary) does not corroborate as TRANSFER_COOPERATION', () => {
  assert.equal(transferCooperationCorroborated(REAL_TAX_OPINION_COOPERATION_QUOTE), false);
});

test('HOSTILE: the real TRANSFER_COOPERATION quote (Transfer Taxes, cooperate) does not corroborate as TAX_OPINION_COOPERATION', () => {
  assert.equal(taxOpinionCooperationCorroborated(REAL_TRANSFER_COOPERATION_QUOTE), false);
});

test('HOSTILE: subject-matter vocabulary alone, with no cooperative action verb, refuses', () => {
  // Real drafting shape: a bare statement describing an opinion/REIT
  // Counsel with no delivery/cooperation obligation attached.
  const bareDescription = 'The opinion of Company’s REIT Counsel referenced above shall be conclusive and '
    + 'binding on the parties for all purposes of this Agreement.';
  assert.equal(taxOpinionCooperationCorroborated(bareDescription), false);
});

test('HOSTILE: Transfer Tax vocabulary alone, with no preparation/filing/cooperation verb, refuses', () => {
  // Real drafting shape: a bare allocation statement, not a cooperation
  // covenant (this is TRANSFER_ALLOCATION's own territory, handled by a
  // separate branch in handleTaxMattersCandidate).
  const bareAllocation = 'All Transfer Taxes incurred in connection with the Mergers shall be borne equally by '
    + 'Parent and the Company.';
  assert.equal(transferCooperationCorroborated(bareAllocation), false);
});

test('quote must be a non-empty string', () => {
  assert.throws(() => taxOpinionCooperationCorroborated(''), TypeError);
  assert.throws(() => transferCooperationCorroborated(''), TypeError);
});
