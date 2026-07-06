const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

const METSERA_NOSOL = [
  {
    category: 'Notice to Counterparty',
    features: {
      noticePeriod: {
        text: 'The Company shall as promptly as reasonably practicable (and in any event within forty-eight (48) hours after knowledge of receipt by an executive officer or director of the Company) advise Parent.',
        value: 48,
        quotes: ['as promptly as reasonably practicable (and in any event within forty-eight (48) hours after knowledge of receipt)'],
      },
    },
  },
  {
    category: 'Superior Proposal Definition',
    features: {
      superiorProposalTest: '(i) on terms which the Company Board determines, in good faith, after consultation with its outside counsel and financial advisor, would result in greater value to the stockholders of the Company from a financial point of view than the Transactions, taking into account all the terms and conditions of such proposal and this Agreement and (ii) that, relative to the Transactions, is reasonably likely to be completed on the terms proposed, taking into account all financial, regulatory, financing, timing, conditionality, legal and other aspects of such proposal.',
    },
  },
  {
    category: 'Change of Recommendation',
    full_text: '(e) Neither the Company Board nor any committee thereof shall ...',
    features: {
      changeOfRecommendationItems: [
        '(A) withdraw, amend, change, qualify or modify in a manner adverse to Parent or Merger Sub the Company Board Recommendation',
        '(B) fail to make the Company Board Recommendation in the Proxy Statement',
        '(C) approve, recommend or declare advisable any Company Takeover Proposal',
        '(D) fail to publicly recommend against such Company Takeover Proposal within ten (10) business days of the request of Parent',
        '(E) fail to recommend against a tender or exchange offer related to a Company Takeover Proposal',
        'a one-off board action that is not in the canonical vocabulary',
      ],
    },
  },
  {
    category: 'Change of Recommendation General Override',
    full_text: '(g) Nothing contained in this Section 5.02 ...',
    features: {
      tenderOfferDisclosureScope: 'taking and disclosing to its stockholders a position contemplated by Rule 14d-9 or Rule 14e-2(a) under the Exchange Act',
      legallyRequiredDisclosurePermitted: {
        value: true,
        quotes: ['making any disclosure to its stockholders if the Company Board or a committee thereof determines, after consultation with outside counsel, is required by applicable Law'],
      },
      notChangeOfRecommendationItems: [
        "any disclosure of information to the Company's stockholders that solely (i) describes the Company's receipt of a Company Takeover Proposal and the operation of this Agreement with respect thereto and (ii) contains a statement reaffirming the Company Board Recommendation shall not be deemed to be an Adverse Recommendation Change",
      ],
    },
  },
];

test('NOSOL CoR framework labels stay in lifecycle order', () => {
  assert.deepEqual(mod.NOSOL_COR_LIFECYCLE_LABELS, [
    'What constitutes a Change of Recommendation',
    'What does NOT constitute a Change of Recommendation',
    'Engagement standard (to discuss with a third party)',
    'Notice period',
    'Notice content',
    'Standstill waiver permitted',
    'Anti-clubbing waiver permitted',
    'Initial match period',
    'Subsequent match period',
    'Change-of-recommendation standard',
    'Material improvement standard',
  ]);
});

test('promptly plus 48-hour hard cap renders as two notice-period elements', () => {
  const hit = mod.pickNosolFeature(METSERA_NOSOL, ['noticePeriod']);
  const parts = mod.noticePeriodParts(hit.value);
  assert.deepEqual(parts.map((p) => p.label), ['Promptly', '48 hours']);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Audit-2 item 2 — live regression: Metsera and Skechers both rendered
 * "4 hours" for a match-period notice the source states in BUSINESS DAYS.
 * The old regex required a bare digit immediately adjacent to the unit word
 * ("4 business days") and fell back to assuming hours when it didn't find
 * one — real agreements spell the number out, sometimes with a parenthetical
 * numeral, so it never matched. Fixed shapes below are the ACTUAL verbatim
 * quotes stored on each deal's NOSOL-MATCH provision.
 * ───────────────────────────────────────────────────────────────────────── */

test('Metsera NOSOL-MATCH: "four (4) business days" renders as "4 business days", not "4 hours"', () => {
  const value = {
    value: 4,
    quotes: ['the Company has provided prior written notice to Parent, at least four (4) business days in advance (the "Notice Period"), of its intention to take such action with respect to such Superior Company Proposal'],
  };
  const parts = mod.noticePeriodParts(value);
  assert.deepEqual(parts.map((p) => p.label), ['4 business days']);
});

test('Skechers NOSOL-MATCH: spelled-out "four Business Days" (no numeral at all) renders as "4 business days", not "4 hours"', () => {
  const value = {
    value: 4,
    quotes: ['the Company has provided prior written notice to Parent at least four Business Days in advance (the "Notice Period") to the effect that the Company Board has (A) received a bona fide Acquisition Proposal'],
  };
  const parts = mod.noticePeriodParts(value);
  assert.deepEqual(parts.map((p) => p.label), ['4 business days']);
});

test('a genuinely hour-denominated period (no day wording anywhere) still renders in hours', () => {
  const value = { value: 24, quotes: ['the Company will promptly (and, in any event, within 24 hours) notify Parent'] };
  const parts = mod.noticePeriodParts(value);
  assert.deepEqual(parts.map((p) => p.label), ['Promptly', '24 hours']);
});

test('a bare number with no unit word anywhere never fabricates "hours"', () => {
  const value = { value: 4, quotes: ['the Company shall notify Parent within the period set out in Schedule 5.02'] };
  const parts = mod.noticePeriodParts(value);
  assert.deepEqual(parts.map((p) => p.label), ['4 (unit not stated in source)']);
});

test('superior-proposal test renders as value and deliverability limbs', () => {
  const hit = mod.pickNosolFeature(METSERA_NOSOL, ['superiorProposalTest']);
  const limbs = mod.superiorProposalLimbs(hit.value);
  assert.equal(limbs.length, 2);
  assert.equal(limbs[0].label, 'Value limb');
  assert.match(limbs[0].text, /greater value to the stockholders/i);
  assert.equal(limbs[1].label, 'Deliverability limb');
  assert.match(limbs[1].text, /reasonably likely to be completed/i);
});

test('key-definition rows are collapsed by default', () => {
  const collapsed = mod.nosolDefinitionInitialState([
    'Company Takeover Proposal / Acquisition Proposal',
    'Acceptable Confidentiality Agreement',
  ]);
  assert.equal(collapsed.has('Company Takeover Proposal / Acquisition Proposal'), true);
  assert.equal(collapsed.has('Acceptable Confidentiality Agreement'), true);
});

test('go-shop absent returns the No go-shop branch', () => {
  const display = mod.goShopDisplay(METSERA_NOSOL);
  assert.equal(display.present, false);
});

test('synthetic go-shop fixture returns the three top rows', () => {
  const display = mod.goShopDisplay([
    {
      features: {
        goShopPresent: true,
        goShopPeriodDays: { value: 30, quotes: ['for thirty (30) days after signing'] },
        goShopExcludedParties: 'Excluded Party that made a qualified proposal during the go-shop period',
        extendedNegotiatingPeriodDays: 10,
      },
    },
  ]);
  assert.equal(display.present, true);
  assert.deepEqual(display.rows.map((r) => r.label), [
    'Go-Shop Period',
    'Go-Shop Excluded Parties',
    'Extended Negotiating Period',
  ]);
});

test('canonical pill vocabulary falls back to OTHER with verbatim hover text', () => {
  const pills = mod.canonicalizeNosolPills(
    METSERA_NOSOL[2].features.changeOfRecommendationItems,
    'changeOfRecommendationItems',
  );
  assert.equal(pills[0].code, 'WITHDRAW_OR_ADVERSE_MODIFY_RECOMMENDATION');
  const other = pills.find((p) => p.code === 'OTHER');
  assert.ok(other);
  assert.equal(other.label, 'Other');
  assert.match(other.quote, /one-off board action/);
});

test('changeOfRecommendationItemRows preserves each Metsera A-E item as full text', () => {
  const rows = mod.changeOfRecommendationItemRows(METSERA_NOSOL);
  assert.deepEqual(rows.slice(0, 5).map((r) => r.label), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(rows.length, 6);
  assert.match(rows[3].text, /ten \(10\) business days/);
  assert.match(rows[4].text, /tender or exchange offer/);
});

test('notChangeOfRecommendationItemRows preserves 14d-9, required-law, and reaffirmation carve-outs separately', () => {
  const rows = mod.notChangeOfRecommendationItemRows(METSERA_NOSOL);
  assert.deepEqual(rows.map((r) => r.label), [
    '14d-9 / 14e-2 disclosure',
    'Required by law',
    'Proposal receipt + reaffirmation',
  ]);
  assert.match(rows[0].text, /Rule 14d-9 or Rule 14e-2/);
  assert.match(rows[1].text, /required by applicable Law/);
  assert.match(rows[2].text, /statement reaffirming the Company Board Recommendation/);
});

test('bare Conoco-shaped NOSOL rows route to Company or Parent display sections', () => {
  assert.equal(
    mod.displayTypeForProvision({
      type: 'NOSOL',
      full_text: '6.3 No Solicitation by the Company. The Company Board may make a Company Change of Recommendation after notice to Parent.',
    }),
    'NOSOL-T',
  );
  assert.equal(
    mod.displayTypeForProvision({
      type: 'NOSOL',
      full_text: '6.4 No Solicitation by Parent. The Parent Board may make a Parent Change of Recommendation after notice to the Company.',
    }),
    'NOSOL-B',
  );
  assert.equal(
    mod.displayTypeForProvision({
      type: 'NOSOL',
      full_text: 'Parent shall promptly notify the Company of any Parent Competing Proposal received by Parent.',
    }),
    'NOSOL-B',
  );
  assert.equal(
    mod.displayTypeForProvision({
      type: 'NOSOL',
      ai_metadata: { features: { sectionNumber: '6.4(f)' } },
      full_text: 'During the period commencing with execution, Parent shall not waive any standstill agreement.',
    }),
    'NOSOL-B',
  );
});
