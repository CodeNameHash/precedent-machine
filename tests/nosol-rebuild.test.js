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
    features: {
      changeOfRecommendationItems: [
        '(A) withdraw, amend, change, qualify or modify in a manner adverse to Parent or Merger Sub the Company Board Recommendation',
        'a one-off board action that is not in the canonical vocabulary',
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
