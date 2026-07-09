const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// FEEDBACK-2-PUNCHLIST.md #41-#43: No-Solicitation must render as ONE
// accordion section with the four family tables nested as sub-groups,
// ordered per the old-site precedent, with every fact that's claimed by
// more than one of the four *.config.js files appearing exactly once.

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-section.config.js'));
});

const primitives = {
  PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
  EvidenceHoverSource: ({ children }) => React.createElement('span', null, children),
  GroupedSubRows: ({ groups }) => React.createElement(
    'div',
    null,
    groups.map((group) => React.createElement(
      'div',
      { key: group.id },
      React.createElement('h3', null, group.label),
      group.rows.map((row) => React.createElement('div', { key: row.id }, row.label, row.children)),
    )),
  ),
};

// One card per code so the codes-based fast paths in each of the four
// underlying configs match directly (no fallback-regex dependence), plus a
// deliberately over-stuffed feature set so every documented cross-config
// duplicate (matchingPeriod, noticePeriod, boardChangeStandard,
// fiduciaryOutStandard, superiorProposalThresholdPct/Test,
// changeOfRecommendationItems) is present on more than one card, the same
// way real deals populate more than one of the four configs' claimed keys.
const CARDS = [
  {
    id: 'prohibit',
    provision_subtype: 'NOSOL-PROHIBIT',
    primary_quote: 'The Company shall not solicit or knowingly encourage an Acquisition Proposal.',
    features: {
      ceaseDiscussionsProhibitedList: ['solicit', 'knowingly encourage'],
      matchingPeriod: { value: 4, quotes: ['four (4) business days'] },
      discussionInitiationNoticeHours: 48,
      superiorProposalThresholdPct: 50,
      acquisitionTransactionPctThreshold: 20,
      fiduciaryOutStandard: 'is-superior-proposal',
      subsequentMatchPeriodDays: { value: 2, quotes: ['two (2) business days'] },
      acquisitionTransactionDefinition: 'Acquisition Proposal means any proposal for 20% or more of assets.',
      changeOfRecommendationItems: ['withdraw the recommendation', 'approve a Takeover Proposal'],
    },
  },
  {
    id: 'cease',
    provision_subtype: 'NOSOL-CEASE',
    primary_quote: 'The Company shall cease and terminate discussions with any person.',
    features: {},
  },
  {
    id: 'except',
    provision_subtype: 'NOSOL-EXCEPT',
    primary_quote: 'Except as provided in this Section, fiduciary duties are unaffected.',
    features: {},
  },
  {
    id: 'enforce',
    provision_subtype: 'NOSOL-ENFORCE',
    primary_quote: 'The Company shall not waive any standstill provision without Parent consent.',
    features: { dontAskDontWaive: true },
  },
  {
    id: 'superior',
    provision_subtype: 'NOSOL-SUPERIOR',
    primary_quote: 'A Superior Proposal means a proposal for greater value to stockholders.',
    features: {
      superiorProposalThresholdPct: 50,
      superiorProposalTest: 'would result in greater value to the stockholders of the Company.',
      superiorProposalDeterminer: 'Company Board determines in good faith after consultation with its financial advisor.',
      fiduciaryEngageStandard: 'constitutes or could reasonably be expected to lead to a Superior Proposal',
      fiduciaryFinalStandard: 'constitutes a Superior Proposal',
      boardChangeStandard: 'INCONSISTENT_FIDUCIARY',
    },
  },
  {
    id: 'intervening',
    provision_subtype: 'NOSOL-INTERVENING',
    primary_quote: 'For an Intervening Event, the Company Board may change its recommendation.',
    features: {
      interveningEventDefinition: 'Intervening Event means any material event not known to the Board at signing.',
      interveningEventScope: 'POSITIVE_ONLY',
      interveningEventExceptions: 'shall not include any Acquisition Proposal or the receipt thereof.',
      interveningEventTermination: 'the Company may terminate for an Intervening Event after notice.',
      boardChangeStandard: 'INCONSISTENT_FIDUCIARY',
      noticePeriod: { value: 4, quotes: ['four (4) Business Days'] },
      matchingPeriod: { value: 4, quotes: ['four (4) business days'] },
    },
  },
  {
    id: 'recommend',
    provision_subtype: 'NOSOL-RECOMMEND',
    primary_quote: 'The Company Board shall not withdraw the Company Board Recommendation.',
    features: {
      fiduciaryEngageStandard: 'constitutes or could reasonably be expected to lead to a Superior Proposal',
      fiduciaryFinalStandard: 'constitutes a Superior Proposal',
      boardChangeForSuperiorProposal: 'the Board may effect a Change of Recommendation for a Superior Proposal.',
      noticePeriod: { value: 4, quotes: ['four (4) Business Days'] },
      noticeContent: 'notice shall identify the third party and the material terms of the proposal.',
      initialMatchPeriodDays: 4,
      subsequentMatchPeriodDays: { value: 2, quotes: ['two (2) business days'] },
      forceTheVote: 'the Company shall submit the Agreement to stockholders notwithstanding a Change of Recommendation.',
      companyTerminationForSuperior: 'the Company may terminate to enter into a Superior Proposal.',
      representativesStandard: 'RBE_NOT_TO',
      parentTerminationRightForNonsolicitBreach: 'Parent may terminate for a material breach of this Section.',
      changeOfRecommendationItems: ['withdraw the recommendation', 'approve a Takeover Proposal'],
      notChangeOfRecommendationItems: ['disclosure describing receipt of a Takeover Proposal'],
      superiorProposalThresholdPct: 50,
      superiorProposalTest: 'would result in greater value to the stockholders of the Company.',
      fiduciaryOutStandard: 'is-superior-proposal',
      boardChangeStandard: 'INCONSISTENT_FIDUCIARY',
      acceptableConfidentialityAgreementDefinition: 'a confidentiality agreement no less favorable to the Company than the Existing NDA.',
    },
  },
];

test('nosol-section groups the four family tables under one section, in precedent order', () => {
  const groups = mod.buildGroups({ cards: CARDS }, { primitives });
  assert.deepEqual(groups.map((g) => g.id), [
    'nosol-definitions',
    'nosol-no-shop-core',
    'nosol-fiduciary-engagement',
    'nosol-notice',
    'nosol-matching',
    'nosol-superior',
    'nosol-intervening',
    'nosol-change-of-rec',
  ]);
});

test('nosol-section dedupes cross-config facts: each duplicated concept appears exactly once', () => {
  const groups = mod.buildGroups({ cards: CARDS }, { primitives });
  const allRowIds = groups.flatMap((g) => g.rows.map((r) => r.id));
  // matchingPeriod is claimed by nosol-noshop, nosol-intervening, and
  // nosol-fiduciary -- only the fiduciary copy should survive the merge.
  assert.deepEqual(allRowIds.filter((id) => /match/i.test(id)).sort(), [
    'nosol-fiduciary-initial-match',
    'nosol-fiduciary-subsequent-match',
  ]);
  // noticePeriod is claimed by nosol-intervening and nosol-fiduciary -- only
  // the fiduciary copy should survive.
  assert.equal(allRowIds.includes('nosol-intervening-notice-period'), false);
  assert.equal(allRowIds.includes('nosol-fiduciary-notice-period'), true);
  // boardChangeStandard is claimed by nosol-superior, nosol-intervening, and
  // (twice) nosol-fiduciary -- only nosol-fiduciary-board-change survives.
  assert.equal(allRowIds.includes('nosol-superior-board-change-standard'), false);
  assert.equal(allRowIds.includes('nosol-intervening-board-change-standard'), false);
  assert.equal(allRowIds.includes('nosol-fiduciary-board-change-standard'), false);
  assert.equal(allRowIds.includes('nosol-fiduciary-board-change'), true);
  // fiduciaryOutStandard is claimed by nosol-noshop, nosol-superior, and
  // nosol-fiduciary -- only the fiduciary copy survives.
  assert.equal(allRowIds.includes('nosol-noshop-fiduciary-standard'), false);
  assert.equal(allRowIds.includes('nosol-superior-fiduciary-standard'), false);
  assert.equal(allRowIds.includes('nosol-fiduciary-fiduciary-standard'), true);
  // changeOfRecommendationItems is claimed by nosol-noshop (count only) and
  // nosol-fiduciary (full item list) -- only the fuller fiduciary list
  // survives.
  assert.equal(allRowIds.includes('nosol-noshop-change-of-rec-count'), false);
  assert.equal(allRowIds.includes('nosol-fiduciary-change-of-rec-items'), true);
  // superiorProposalThresholdPct/Test claimed by nosol-superior and (twice)
  // nosol-fiduciary -- only the superior copy survives.
  assert.equal(allRowIds.includes('nosol-fiduciary-superior-threshold'), false);
  assert.equal(allRowIds.includes('nosol-fiduciary-superior-test'), false);
  assert.equal(allRowIds.includes('nosol-superior-threshold'), true);
  assert.equal(allRowIds.includes('nosol-superior-test'), true);
  // Every surviving row id is unique -- no concept renders twice anywhere in
  // the merged section.
  assert.deepEqual(allRowIds, [...new Set(allRowIds)]);
});

test('nosol-section renders as a single ProvisionTable section with a nested GroupedSubRows body', () => {
  assert.equal(mod.nosolSectionConfig.id, 'nosol');
  assert.equal(mod.nosolSectionConfig.title, 'No-Solicitation / No-Shop');
  const rows = mod.nosolSectionConfig.selectRows({ cards: CARDS });
  assert.equal(rows.length, 1, 'the whole section is ONE synthetic row whose body column renders the nested groups');
  const bodyColumn = mod.nosolSectionConfig.columns.find((c) => c.id === 'body');
  const html = renderToStaticMarkup(bodyColumn.renderCell(rows[0], { primitives }));
  assert.match(html, /No-Shop Core Mechanics/);
  assert.match(html, /Intervening Event/);
  assert.match(html, /Change of Recommendation/);
  // Sub-group ordering survives into the rendered markup: "No-Shop Core
  // Mechanics" (bucket 2) must precede "Superior Proposal" (bucket 6), which
  // must precede "Intervening Event" (bucket 7).
  const noShopIdx = html.indexOf('No-Shop Core Mechanics');
  const superiorIdx = html.indexOf('Superior Proposal');
  const interveningIdx = html.indexOf('Intervening Event');
  assert.ok(noShopIdx < superiorIdx && superiorIdx < interveningIdx);
});

test('nosol-section returns no rows when none of the four family configs have data', () => {
  assert.deepEqual(mod.nosolSectionConfig.selectRows({ cards: [] }), []);
});
