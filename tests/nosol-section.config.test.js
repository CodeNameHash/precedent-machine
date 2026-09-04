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
  // WS-G T6: TERMR-SUPERIOR card so "Company termination for Superior
  // Proposal" folds into the Superior Proposal box (nosol-superior-
  // termination), sourced by exact code match rather than nosol-fiduciary's
  // cross-family regex fallback.
  {
    id: 'termr-superior',
    provision_type: 'TERMINATION_RIGHT',
    provision_subtype: 'TERMR-SUPERIOR',
    primary_quote: 'The Company may terminate this Agreement to enter into a Superior Proposal only if the Company Board has authorized entry into a definitive agreement and the Company has paid the termination fee due under Section 8.02.',
  },
  // WS-G #4: DEFINITION cards driving the new Acquisition Proposal -
  // Definition sub-block.
  {
    id: 'def-acqproposal',
    provision_type: 'DEFINITION',
    provision_subtype: 'DEF-ACQPROPOSAL',
    defined_term: 'Company Takeover Proposal',
    primary_quote: '"Company Takeover Proposal" means any inquiry, proposal or offer relating to (i) any direct or indirect acquisition, purchase, sale, license, lease or other disposition of twenty percent (20%) or more of the assets of the Company, (ii) any merger, consolidation, business combination or tender offer, exchange offer that would result in any Person owning twenty percent (20%) or more of the aggregate voting power of the capital stock of the Company, or (iii) any combination of the foregoing, other than, in each case, the Transactions.',
  },
  {
    id: 'def-qualifying-acqproposal',
    provision_type: 'DEFINITION',
    provision_subtype: 'DEF-ACQPROPOSAL',
    defined_term: 'Qualifying Company Takeover Proposal',
    defined_value: 'a Company Takeover Proposal that the Company Board determines in good faith, after consultation with outside counsel and its financial advisor, constitutes or could reasonably be expected to lead to a Superior Proposal and in respect of which failure to act would be inconsistent with its fiduciary duties.',
  },
];

test('nosol-section groups the four family tables under one section, in precedent order', () => {
  const groups = mod.buildGroups({ cards: CARDS }, { primitives });
  assert.deepEqual(groups.map((g) => g.id), [
    // Ben (round 6): Go-Shop leads the section (renders "None" when absent).
    'nosol-go-shop',
    'nosol-no-shop-core',
    'nosol-fiduciary-engagement',
    'nosol-acquisition-proposal',
    'nosol-notice',
    'nosol-matching',
    'nosol-superior',
    'nosol-intervening',
    'nosol-change-of-rec',
  ]);
});

test('nosol-section: No-Shop Core Mechanics leads with cease, then the prohibited acts, then the folded-in Representatives control standard (T4) directly under the restriction it enforces, then exceptions', () => {
  const groups = mod.buildGroups({ cards: CARDS }, { primitives });
  const noShopCore = groups.find((g) => g.id === 'nosol-no-shop-core');
  assert.ok(noShopCore, 'No-Shop Core Mechanics must lead the substantive groups');
  // Go-Shop leads with its "None" row; No-Shop Core is the first substantive group.
  assert.equal(groups[0].id, 'nosol-go-shop');
  assert.equal(groups[1].id, 'nosol-no-shop-core');
  assert.deepEqual(noShopCore.rows.map((r) => r.id), [
    'nosol-noshop-cease',
    'nosol-noshop-prohibit',
    'nosol-fiduciary-reps',
    'nosol-noshop-exceptions',
    'nosol-noshop-standstill-enforce',
  ]);
});

test('nosol-section: Acquisition Proposal - Definition surfaces the 20% trigger, transaction types, and the "other than the Transactions" exclusion', () => {
  const groups = mod.buildGroups({ cards: CARDS }, { primitives });
  const acqGroup = groups.find((g) => g.id === 'nosol-acquisition-proposal');
  assert.ok(acqGroup, 'Acquisition Proposal - Definition group must render');
  const takeoverRow = acqGroup.rows.find((r) => r.id === 'nosol-acqprop-company-takeover');
  assert.ok(takeoverRow);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, takeoverRow.children));
  assert.match(html, /Trigger: 20%/);
  assert.match(html, /Merger, consolidation or business combination/);
  assert.match(html, /Excludes: the Transactions/);
  const qualifyingRow = acqGroup.rows.find((r) => r.id === 'nosol-acqprop-qualifying');
  assert.ok(qualifyingRow, 'Qualifying Company Takeover Proposal row must render');
  const qualifyingHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, qualifyingRow.children));
  assert.match(qualifyingHtml, /inconsistent with its fiduciary duties/);
});

// Item 14 (round 3, Theravance NOSOL-ACQPROPOSAL): limbs (1)-(4) all use
// "20% or more" of revenues/assets/voting power; the 80% appears ONLY in a
// definitional continuity-of-ownership carve-out ("...shareholders of the
// Company immediately prior to such transaction will not own, directly or
// indirectly, at least 80% of the surviving company...") -- not a trigger.
// The old harvest-every-percentage regex rendered both "Trigger: 20%" and
// "Trigger: 80%"; only the "NN% or more" trigger phrasing should chip.
test('nosol-section extractPctTriggers only chips "NN% or more" trigger phrasing, not an unrelated "at least NN%" continuity-of-ownership carve-out', () => {
  const clause = '"Company Takeover Proposal" means any inquiry, proposal or offer relating to (i) any direct or indirect acquisition of assets representing 20% or more of the consolidated assets of the Company, (ii) any acquisition of 20% or more of the outstanding voting power of the Company, (iii) any tender or exchange offer that if consummated would result in beneficial ownership of 20% or more of the Company, or (iv) any merger, consolidation, business combination, recapitalization, liquidation, dissolution or similar transaction involving the Company in which the shareholders of the Company immediately prior to such transaction will not own, directly or indirectly, at least 80% of the surviving company.';
  const triggers = mod.extractPctTriggers(clause);
  assert.deepEqual(triggers, ['20%'], 'only the "20% or more" trigger limbs chip -- the 80% continuity carve-out is not a trigger');
});

test('nosol-section places the Acquisition Proposal - Definition group after Fiduciary-Out / Engagement and before Notice', () => {
  const groups = mod.buildGroups({ cards: CARDS }, { primitives });
  const ids = groups.map((g) => g.id);
  const engagementIdx = ids.indexOf('nosol-fiduciary-engagement');
  const acqIdx = ids.indexOf('nosol-acquisition-proposal');
  const noticeIdx = ids.indexOf('nosol-notice');
  assert.ok(engagementIdx < acqIdx && acqIdx < noticeIdx);
});

test('nosol-section: T6 folds "Company termination for Superior Proposal" INSIDE the Superior Proposal box, not as a standalone row', () => {
  const groups = mod.buildGroups({ cards: CARDS }, { primitives });
  const superior = groups.find((g) => g.id === 'nosol-superior');
  assert.ok(superior);
  const terminationRow = superior.rows.find((r) => r.id === 'nosol-superior-termination');
  assert.ok(terminationRow, 'Company termination for Superior Proposal must render inside the Superior Proposal box');
  assert.match(terminationRow.seeTextContent, /terminate this Agreement to enter into a Superior Proposal/);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, terminationRow.children));
  // Round-6: renders the crisp "Yes — if it concurrently signs ..." summary.
  assert.match(html, /Yes — if it concurrently signs the alternative agreement/);
  // Not duplicated elsewhere in the section.
  const allRowIds = groups.flatMap((g) => g.rows.map((r) => r.id));
  assert.equal(allRowIds.filter((id) => id === 'nosol-superior-termination').length, 1);
  assert.equal(allRowIds.includes('nosol-fiduciary-termination'), false, 'the fiduciary-sourced duplicate must not also render');
});

test('nosol-section suppresses only the Superior Proposal termination duplicate when V2 owns that right', () => {
  const groups = mod.buildGroups({
    cards: CARDS,
    canonical_v2_termination_rights_review_rows: {
      schema_version: 'TERMINATION_RIGHTS_REVIEW_ROWS/V2',
      agreement_analysis_id: 'analysis:1',
      agreement_projection_id: 'projection:1',
      rows: [{ subtype_key: 'SUPERIOR_PROPOSAL_RIGHT' }],
      general_review_items: [],
    },
  }, { primitives });
  const superior = groups.find((group) => group.id === 'nosol-superior');
  const rowIds = superior.rows.map((row) => row.id);

  assert.equal(rowIds.includes('nosol-superior-termination'), false);
  assert.equal(rowIds.includes('nosol-superior-threshold'), true);
  assert.equal(rowIds.includes('nosol-superior-test'), true);
  assert.equal(rowIds.includes('nosol-superior-determiner'), true);
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

// Item 8 (round 3): rowNode() used to append the relocated 'detail' clause
// AFTER the signal pill inside the row's value cell. Item 2 (r6): the
// relocated detail is now passed RAW as row.seeTextContent -- GroupedSubRows
// owns the toggle and the shared full-width block-below-the-row expansion
// (no more per-config in-cell <details>); children stays the value-cell
// content (the signal pill only).
test('Item 8/r6-2: buildGroups rows carry raw seeTextContent SEPARATELY from children (no in-cell details node)', () => {
  const groups = mod.buildGroups({ cards: CARDS }, { primitives });
  const noShopCore = groups.find((g) => g.id === 'nosol-no-shop-core');
  assert.ok(noShopCore, 'No-Shop Core Mechanics group must render');
  const prohibitRow = noShopCore.rows.find((r) => r.id === 'nosol-noshop-prohibit');
  assert.ok(prohibitRow, 'expected the prohibited-acts row');
  assert.equal(prohibitRow.seeText, undefined, 'legacy pre-rendered seeText must be gone');
  assert.ok(prohibitRow.seeTextContent, 'the row must carry raw seeTextContent for the shared full-width expansion');
  const contentHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, prohibitRow.seeTextContent));
  // Raw detail content only -- the toggle/summary chrome belongs to
  // GroupedSubRows now, so the content itself must NOT ship its own
  // <details>/"See provision" affordance.
  assert.doesNotMatch(contentHtml, /term-cell-seetext/);
  assert.doesNotMatch(contentHtml, />See provision</);
  assert.ok(contentHtml.length > 0, 'detail content must be non-empty');
});
