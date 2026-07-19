const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let mod;
let advisersFeesExpensesMod;
let antitrustRegulatoryMod;
let approvalsVotesMod;
let considerationHeroMod;
let employeeBenefitsMod;
let generalCovenantsMod;
let iocMod;
let maeDefinitionsMod;
let materialContractsMod;
let miscBoilerplateMod;
let nosolFiduciaryMod;
let nosolInterveningMod;
let nosolNoshopMod;
let nosolSuperiorMod;
let noOtherRepsFraudMod;
let representationsQualifiersMod;
let secMeetingMod;
let structureMechanicsMod;
let tailFeeMod;
let terminationFeesMod;
let terminationRightsMod;
let votesApprovalsMeetingMod;
let cardUtilsMod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-configs', 'conditions-m.config.js'));
  advisersFeesExpensesMod = await import(path.join('..', 'components', 'review', 'table-configs', 'advisers-fees-expenses.config.js'));
  antitrustRegulatoryMod = await import(path.join('..', 'components', 'review', 'table-configs', 'antitrust-regulatory.config.js'));
  approvalsVotesMod = await import(path.join('..', 'components', 'review', 'table-configs', 'approvals-votes.config.js'));
  considerationHeroMod = await import(path.join('..', 'components', 'review', 'table-configs', 'consideration-hero.config.js'));
  employeeBenefitsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'employee-benefits.config.js'));
  generalCovenantsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'general-covenants.config.js'));
  iocMod = await import(path.join('..', 'components', 'review', 'table-configs', 'ioc-exceptions.config.js'));
  maeDefinitionsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'mae-definitions.config.js'));
  materialContractsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'material-contracts.config.js'));
  miscBoilerplateMod = await import(path.join('..', 'components', 'review', 'table-configs', 'misc-boilerplate.config.js'));
  nosolFiduciaryMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-fiduciary.config.js'));
  nosolInterveningMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-intervening.config.js'));
  nosolNoshopMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-noshop.config.js'));
  nosolSuperiorMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-superior.config.js'));
  noOtherRepsFraudMod = await import(path.join('..', 'components', 'review', 'table-configs', 'no-other-reps-fraud.config.js'));
  representationsQualifiersMod = await import(path.join('..', 'components', 'review', 'table-configs', 'representations-qualifiers.config.js'));
  secMeetingMod = await import(path.join('..', 'components', 'review', 'table-configs', 'sec-meeting.config.js'));
  structureMechanicsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'structure-mechanics.config.js'));
  tailFeeMod = await import(path.join('..', 'components', 'review', 'table-configs', 'tail-fee.config.js'));
  terminationFeesMod = await import(path.join('..', 'components', 'review', 'table-configs', 'termination-fees.config.js'));
  terminationRightsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'termination-rights.config.js'));
  votesApprovalsMeetingMod = await import(path.join('..', 'components', 'review', 'table-configs', 'votes-approvals-meeting.config.js'));
  cardUtilsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'card-utils.js'));
});

// Canonical partySide (card-utils.js) — the single source of truth that
// replaced the four byte-identical copies in the nosol-*.config.js files.
// The provision CODE token is authoritative; the stored party_scope is a
// uniform 'MUTUAL' default (store-cards.js) so it is treated as no-signal
// unless it is an explicit NON-mutual value.
test('partySide derives party from the code token and ignores the MUTUAL default', () => {
  const { partySide } = cardUtilsMod;
  // code token (embedded or trailing) wins — these all carry party_scope=MUTUAL in stored data
  assert.equal(partySide({ provision_subtype: 'REP-B-ORG', party_scope: 'MUTUAL' }), 'Buyer / Parent');
  assert.equal(partySide({ provision_subtype: 'REP-T-SANCTIONS', party_scope: 'MUTUAL' }), 'Target / Company');
  assert.equal(partySide({ provision_subtype: 'COND-B-PREAMBLE', party_scope: 'MUTUAL' }), 'Buyer / Parent');
  assert.equal(partySide({ provision_subtype: 'COND-S-PREAMBLE', party_scope: 'MUTUAL' }), 'Target / Company');
  assert.equal(partySide({ provision_subtype: 'COND-M-STOCKHOLDER', party_scope: 'MUTUAL' }), 'Mutual / Either Party');
  assert.equal(partySide({ provision_subtype: 'TERMF-TARGET', party_scope: 'MUTUAL' }), 'Target / Company');
  assert.equal(partySide({ provision_subtype: 'COV-SHAPRV-PARENT', party_scope: 'MUTUAL' }), 'Buyer / Parent');
  // category-based subtypes with no party token (IOC/NOSOL) default to Target,
  // NOT Mutual — this is the regression the earlier Layer-1 version introduced
  assert.equal(partySide({ provision_subtype: 'NOSOL-PROHIBIT', party_scope: 'MUTUAL' }), 'Target / Company');
  assert.equal(partySide({ provision_subtype: 'IOC-ISSUE', party_scope: 'MUTUAL' }), 'Target / Company');
  // an explicit non-mutual party_scope is honored when the code has no token
  assert.equal(partySide({ provision_subtype: 'IOC-ISSUE', party_scope: 'PARENT' }), 'Buyer / Parent');
  assert.equal(partySide({}), 'Target / Company');
});

function card(overrides = {}) {
  return {
    id: overrides.id || 'card-1',
    provision_type: 'CLOSING_CONDITION',
    provision_subtype: overrides.provision_subtype || 'COND-M-STOCKHOLDER',
    section_ref: overrides.section_ref || 'Section 7.01',
    short_title: overrides.short_title || 'Stockholder Approval',
    primary_quote: overrides.primary_quote || 'The Company Stockholder Approval shall have been obtained.',
    ...overrides,
  };
}

test('conditions-m config maps schema cards to canonical present rows', () => {
  const rows = mod.conditionsMConfig.selectRows({
    cards: [
      card({ id: 'vote', provision_subtype: 'COND-M-STOCKHOLDER', short_title: 'Stockholder Approval' }),
      card({ id: 'legal', provision_subtype: 'COND-M-LEGAL', short_title: 'No Legal Impediment', primary_quote: 'No injunction shall be in effect.' }),
      card({ id: 'reg', provision_subtype: 'COND-M-REG', short_title: 'Regulatory Approvals', primary_quote: 'The HSR waiting period shall have expired.' }),
    ],
  });
  const present = rows.filter((row) => row.present).map((row) => row.label);
  assert.deepEqual(present, [
    'Stockholder Approval (Company)',
    'No Injunctions / Legal Restraints',
    'Antitrust',
  ]);
  assert.match(rows.find((row) => row.label === 'Antitrust').detail, /HSR waiting period/);
});

test('conditions config preserves feature-backed signals for analytical parity', () => {
  const rows = mod.conditionsMConfig.selectRows({
    cards: [
      card({
        id: 'reg',
        provision_subtype: 'COND-M-REG',
        short_title: 'Regulatory Approvals',
        primary_quote: 'The HSR waiting period and scheduled approvals shall have been obtained.',
        features: {
          effortsStandard: 'REASONABLE_BEST_EFFORTS',
          antitrustApprovals: [
            { code: 'HSR', label: 'HSR clearance', text: 'HSR waiting period' },
            { code: 'SCHEDULED_APPROVALS', label: 'Scheduled approvals', text: 'scheduled approvals' },
          ],
        },
      }),
    ],
  });
  const antitrust = rows.find((row) => row.label === 'Antitrust');
  assert.deepEqual(antitrust.signals.map((item) => item.label), [
    'COND-M-REG',
    'Efforts: Reasonable best efforts',
    'Approval: HSR clearance',
    'Approval: Scheduled approvals',
  ]);
  assert.match(antitrust.evidence, /HSR waiting period/);
});

test('conditions buyer bring-down rows expose materiality scrape badges, including false', () => {
  const rows = mod.conditionsBConfig.selectRows({
    cards: [
      card({
        id: 'rep',
        provision_subtype: 'COND-B-REP',
        short_title: 'Accuracy of Target Reps',
        primary_quote: 'The representations shall be true in all material respects.',
        features: { materialityScrapeBoolean: false },
      }),
    ],
  });
  const bringDown = rows.find((row) => row.label === 'Reps Bring-Down');
  assert.ok(bringDown.signals.some((item) => item.label === 'COND-B-REP'));
  assert.ok(bringDown.signals.some((item) => item.label === 'Scrape: No'));
});

test('conditions render cells use primitive pills and evidence hover when provided', () => {
  const rows = mod.conditionsMConfig.selectRows({
    cards: [
      card({
        id: 'reg',
        provision_subtype: 'COND-M-REG',
        short_title: 'Regulatory Approvals',
        primary_quote: 'The HSR waiting period shall have expired.',
        features: { effortsStandard: 'REASONABLE_BEST_EFFORTS' },
      }),
    ],
  });
  const antitrust = rows.find((row) => row.label === 'Antitrust');
  const signalsColumn = mod.conditionsMConfig.columns.find((column) => column.id === 'signals');
  const detailColumn = mod.conditionsMConfig.columns.find((column) => column.id === 'provision');
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const signalsHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, signalsColumn.renderCell(antitrust, { primitives })));
  assert.match(signalsHtml, /COND-M-REG/);
  assert.match(signalsHtml, /Reasonable best efforts/);
  const detailHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, detailColumn.renderCell(antitrust, { primitives })));
  assert.match(detailHtml, /data-evidence="The HSR waiting period shall have expired\."/);
});

test('consideration hero config maps cash plus CVR economics', () => {
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [
      {
        id: 'merger-consid',
        provision_subtype: 'CONSID',
        short_title: 'Merger Consideration',
        primary_quote: 'Each share shall be converted into $47.50 in cash plus one CVR.',
        features: {
          considerationType: 'cash-with-cvr',
          perShareAmount: '$47.50',
          withholdingProvision: true,
        },
      },
      {
        id: 'cvr',
        provision_subtype: 'CONSID-CVR',
        short_title: 'CVR',
        primary_quote: 'Each CVR may pay up to $17.50 on milestone achievement.',
        features: {
          triggers: ['First milestone', 'Second milestone'],
          maxPayment: '$17.50',
          term: 'five years',
          transferable: false,
        },
      },
    ],
  });
  assert.equal(rows.find((row) => row.id === 'consideration-hero-headline').detail, 'Cash + CVR');
  assert.equal(rows.find((row) => row.id === 'consideration-hero-per-share').detail, '$47.50 in cash + 1 CVR (up to $17.50)');
  assert.equal(rows.find((row) => row.id === 'consideration-hero-cvr-maxPayment').detail, '$17.50');
  assert.equal(rows.find((row) => row.id === 'consideration-hero-cvr-transferable').detail, 'No');
});

test('consideration hero config maps stock/election mechanics and tender-offer price', () => {
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [
      {
        id: 'stock',
        provision_subtype: 'CONSID',
        primary_quote: 'Each share receives 0.5 shares of Parent common stock.',
        features: {
          considerationType: 'mixed-cash-and-stock',
          exchangeRatio: '0.5 shares of Parent common stock',
          prorationMechanics: { electionType: 'CASH_OR_STOCK', oversubscriptionTreatment: 'pro rata' },
          collar: { present: true, type: 'SYMMETRIC', floor: '$10.00', cap: '$15.00' },
          walkAwayRight: { present: true, party: 'Target', trigger: 'stock price below floor' },
        },
      },
      {
        id: 'offer',
        provision_subtype: 'STRUCT-OFFER',
        features: {
          offerConsideration: 'Cash',
          offerPrice: '$12.00 per share',
        },
      },
    ],
  });
  assert.equal(rows.find((row) => row.id === 'consideration-hero-headline').detail, 'Cash / stock election');
  assert.match(rows.find((row) => row.id === 'consideration-hero-prorationMechanics').detail, /CASH_OR_STOCK/);
  assert.equal(rows.find((row) => row.id === 'consideration-hero-offerPrice').detail, '$12.00 per share');
  assert.match(rows.find((row) => row.id === 'consideration-hero-collar').detail, /SYMMETRIC/);
});

test('ELECTION-REDO-SPEC-2026-07-16: consideration hero tags per-share / exchange-ratio rows with their election option via appliesTo attribution', () => {
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [
      {
        id: 'consid',
        provision_subtype: 'CONSID',
        primary_quote: 'Each Company Share converts into $505.00 in cash or 20.200 Parent Shares.',
        features: {
          considerationType: 'mixed-cash-and-stock',
          perShareAmount: '$505.00',
          exchangeRatio: 20.2,
        },
      },
      {
        id: 'election',
        provision_subtype: 'CONSID-ELECTION',
        primary_quote: 'Cash Election or Stock Election.',
        features: {
          considerationEquity: {
            electionMechanism: {
              electionType: 'CASH_OR_STOCK',
              options: [
                { optionType: 'CASH_ELECTION', optionLabel: 'Cash Election', cashPerShare: 505, stockPerShare: null },
                { optionType: 'STOCK_ELECTION', optionLabel: 'Stock Election', cashPerShare: null, stockPerShare: 20.2 },
              ],
            },
          },
        },
      },
    ],
  });
  const perShareRow = rows.find((row) => row.id === 'consideration-hero-per-share');
  const exchangeRatioRow = rows.find((row) => row.id === 'consideration-hero-exchangeRatio');
  assert.equal(perShareRow.electionOption, 'Cash Election');
  assert.equal(exchangeRatioRow.electionOption, 'Stock Election');

  const primitives = {
    PillCell: ({ label, tone }) => React.createElement('span', { 'data-pill': tone }, label),
  };
  const detailColumn = considerationHeroMod.considerationHeroConfig.columns.find((c) => c.id === 'detail');
  const perShareHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, detailColumn.renderCell(perShareRow, { primitives })));
  assert.match(perShareHtml, /→ Cash Election/);
  const exchangeRatioHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, detailColumn.renderCell(exchangeRatioRow, { primitives })));
  assert.match(exchangeRatioHtml, /→ Stock Election/);
});

test('consideration hero excludes CONSID-EQUITY entirely (equity-awards.config.js owns it exclusively, no double-render)', () => {
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [
      {
        id: 'convert',
        provision_subtype: 'CONSID-CONVERT',
        short_title: 'Conversion of Shares',
        primary_quote: 'Company common stock converts into $47.50 cash plus one CVR.',
        features: { considerationType: 'cash-with-cvr', perShareAmount: 47.5, maxPayment: '$22.50', appraisalRightsAvailable: true },
      },
      {
        id: 'equity',
        provision_subtype: 'CONSID-EQUITY',
        short_title: 'Treatment of Equity Awards / Stock Plans',
        primary_quote: 'Company equity awards are cancelled or accelerated.',
        features: {
          considerationType: 'cash-with-cvr',
          equityAwardTreatment: { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread' },
          vestingAcceleration: { code: 'ACCEL_ELSE_DOUBLE_TRIGGER', label: 'Accelerates on double trigger' },
          optionsCvrEarnIn: { code: 'MUST_BE_ITM', label: 'Must be in-the-money' },
          outstandingInstruments: ['ESPP', 'RESTRICTED_STOCK', 'STOCK_OPTIONS'],
        },
      },
    ],
  });
  assert.ok(!rows.some((row) => row.evidence && row.evidence.includes('cancelled or accelerated')), 'no row should be sourced from the CONSID-EQUITY card');
  assert.equal(rows.find((row) => row.id === 'consideration-hero-equityAwardTreatment'), undefined);
  assert.equal(rows.find((row) => row.id === 'consideration-hero-vestingAcceleration'), undefined);
  assert.equal(rows.find((row) => row.id === 'consideration-hero-optionsCvrEarnIn'), undefined);
});

test('consideration hero computes the "Up to $X.XX / share" max on the per-share consideration row itself (not a separate row) from perShareAmount + CVR maxPayment, even when both live on the same card (Metsera shape: no separate CONSID-CVR card)', () => {
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [{
      id: 'convert',
      provision_subtype: 'CONSID-CONVERT',
      short_title: 'Conversion of Shares',
      primary_quote: 'Company common stock converts into $47.50 cash plus one CVR (up to $22.50).',
      features: { considerationType: 'cash-with-cvr', perShareAmount: 47.5, maxPayment: '$22.50' },
    }],
  });
  assert.equal(rows.find((row) => row.id === 'consideration-hero-rollup'), undefined, 'the computed max must not render as its own row');
  const perShare = rows.find((row) => row.id === 'consideration-hero-per-share');
  assert.ok(perShare, 'expected a per-share consideration row');
  assert.equal(perShare.maxDetail, 'Up to $70.00 / share');
  assert.equal(perShare.detail, '$47.50 in cash + 1 CVR (up to $22.50)');

  const primitives = {
    PillCell: ({ label, tone }) => React.createElement('span', { 'data-pill': tone }, label),
  };
  const detailColumn = considerationHeroMod.considerationHeroConfig.columns.find((c) => c.id === 'detail');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, detailColumn.renderCell(perShare, { primitives })));
  assert.match(html, /\$47\.50 in cash/, 'per-share cash pill still renders');
  assert.match(html, /1 CVR \(up to \$22\.50\)/, 'CVR pill still renders');
  assert.match(html, /Up to \$70\.00 \/ share/, 'the computed max renders in the SAME cell as the per-share pills, not a separate row');
});

test('consideration hero renders "Other provisions in this section" as a link off the CONSID-EXCHANGE card, not a Yes row', () => {
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [
      {
        id: 'convert',
        provision_subtype: 'CONSID-CONVERT',
        short_title: 'Conversion of Shares',
        primary_quote: 'Company common stock converts into $47.50 cash.',
        features: { considerationType: 'cash', perShareAmount: '$47.50' },
      },
      {
        id: 'exchange',
        provision_subtype: 'CONSID-EXCHANGE',
        short_title: 'Exchange of Certificates / Payment Mechanics',
        primary_quote: 'Payment mechanics for exchange of certificates and book-entry shares for cash.',
        features: { considerationType: 'cash' },
      },
    ],
  });
  const other = rows.find((row) => row.id === 'consideration-hero-other-provisions');
  assert.ok(other, 'expected an "other provisions" link row');
  assert.equal(other.detail, 'Exchange of Certificates / Payment Mechanics');
  assert.notEqual(other.detail, 'Yes');
  assert.equal(other.isLink, true);
  const TruncatedWithSeeText = () => null;
  const element = considerationHeroMod.considerationHeroConfig.columns.find((c) => c.id === 'detail').renderCell(other, { primitives: {} });
  assert.notEqual(element, 'Yes');
});

test('M2-08 gap configs map their core schema-card fields', () => {
  const cards = [
    { id: 'struct', provision_type: 'STRUCTURE_MECHANICS', provision_subtype: 'STRUCT-MERGER', short_title: 'Merger', features: { dealStructure: 'ONE_STEP_MERGER', closingTiming: '2 business days after conditions' } },
    { id: 'anti', provision_type: 'ANTITRUST_REGULATORY', provision_subtype: 'ANTI-HSR', short_title: 'HSR', features: { effortsStandard: 'reasonable best efforts', burdensomeConditionLimit: 'no divestiture of material assets' } },
    { id: 'mae', provision_type: 'MAE', provision_subtype: 'MAE-DEF', short_title: 'Material Adverse Effect', features: { maeLimbType: 'TWO_LIMB', disproportionateImpactClause: 'except to the extent disproportionate' } },
    { id: 'termr', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-OUTSIDE', short_title: 'Outside Date', features: { outsideDate: 'June 30, 2026', extensionAvailable: true } },
    { id: 'termf', provision_type: 'TERMINATION_FEE', provision_subtype: 'TERMF-TARGET', short_title: 'Company Fee', features: { terminationFees: { amount: '$100,000,000', triggers: [] }, feeRequired: true } },
    { id: 'cov', provision_type: 'COVENANT_OTHER', provision_subtype: 'COV-ACCESS', short_title: 'Access', features: { accessRights: 'reasonable access during normal business hours', publicStatements: 'joint consent' } },
    { id: 'vote', provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-M-STOCKHOLDER', short_title: 'Stockholder Approval', features: { approvalDefinition: 'majority of outstanding shares', voteThreshold: 'majority outstanding' } },
    { id: 'misc', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'MISC-EXPENSES', short_title: 'Fees and Expenses', features: { feeExpenseAllocation: 'each party bears its own expenses', governingLaw: 'Delaware' } },
    { id: 'rep', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-SEC', short_title: 'SEC Documents', features: { materialityQualifier: 'in all material respects', knowledgeQualifier: 'Company knowledge' } },
  ];
  const reviewDeal = { cards };
  assert.equal(structureMechanicsMod.structureMechanicsConfig.selectRows(reviewDeal)[0].detail, 'ONE_STEP_MERGER');
  assert.match(antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows(reviewDeal)[0].detail, /reasonable best/);
  assert.equal(maeDefinitionsMod.maeDefinitionsConfig.selectRows(reviewDeal)[0].detail, 'TWO_LIMB');
  // termination-rights now renders ONE consolidated grouped row (see the
  // family-grouped rebuild below) rather than a flat per-concept row list.
  const termrGroupRows = terminationRightsMod.terminationRightsConfig.selectRows(reviewDeal);
  assert.equal(termrGroupRows.length, 1);
  assert.match(terminationFeesMod.terminationFeesConfig.selectRows(reviewDeal)[0].detail, /\$100,000,000/);
  // FEEDBACK-2-PUNCHLIST.md #30/#33: general-covenants rows are LINKS now
  // (term = friendly label, not a content summary) -- the underlying
  // covenant value still survives, just moved to the row's evidence, which
  // is what the link's hover surfaces.
  const generalCovenantsRow = generalCovenantsMod.generalCovenantsConfig.selectRows(reviewDeal)[0];
  assert.equal(generalCovenantsRow.detail, 'Access / information rights');
  assert.equal(generalCovenantsRow.isLink, true);
  assert.match(generalCovenantsRow.evidence, /reasonable access/);
  assert.match(approvalsVotesMod.approvalsVotesConfig.selectRows(reviewDeal)[0].detail, /majority/);
  assert.match(advisersFeesExpensesMod.advisersFeesExpensesConfig.selectRows(reviewDeal)[0].detail, /own expenses/);
  // representations-qualifiers renders ONE row per rep card (Term |
  // Materiality Qualifier | Knowledge Qualifier | Lookback), not a flat
  // label/detail row -- the materiality cell carries the resolved text.
  const repRows = representationsQualifiersMod.representationsQualifiersConfig.selectRows(reviewDeal);
  assert.equal(repRows.length, 1);
  assert.match(repRows[0].materiality.label, /material respects/);
});

test('representations-qualifiers config resolves taxonomy-coded materiality/knowledge pills with hover evidence, and surfaces the Knowledge standard in the Knowledge sub-table (not a header note)', () => {
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [{
      id: 'rep',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-SEC',
      short_title: 'SEC Documents',
      primary_quote: 'The SEC Documents were accurate in all material respects and to the actual knowledge of the Company.',
      features: {
        mainConcept: 'The SEC Documents were accurate in all material respects and to the actual knowledge of the Company.',
        materialityQualifier: { code: 'MAT_MAE_QUALIFIED', text: 'would not have an MAE' },
        materialityScopeType: 'PARTIAL',
        knowledgeQualifier: 'KNOWLEDGE_QUALIFIED',
        knowledgeScopeType: 'PARTIAL',
        knowledgeStandard: 'actual-knowledge',
      },
    }],
  });
  const row = rows.find((r) => r.kind === 'rep');
  assert.equal(row.materiality.label, 'MAE-qualified (partial)');
  assert.equal(row.materiality.color, 'amber');
  assert.equal(row.materiality.evidence, 'would not have an MAE');
  assert.equal(row.knowledge.label, 'Knowledge-qualified (partial)');
  // R4: the Knowledge standard is no longer a section headerNote -- it's a
  // "Standard" row in the Knowledge sub-table (see renderBody tests below).
  assert.equal(representationsQualifiersMod.representationsQualifiersConfig.deriveHeaderNote, undefined);
  const knowledgeSummary = rows.find((r) => r.kind === 'knowledge-summary');
  assert.equal(knowledgeSummary.knowledgeStandard, 'Actual knowledge');

  const primitives = {
    PillCell: ({ label, evidence }) => React.createElement('span', { className: 'pill', 'data-evidence': evidence }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const materialityColumn = representationsQualifiersMod.representationsQualifiersConfig.columns.find((column) => column.id === 'materiality');
  assert.match(
    renderToStaticMarkup(React.createElement(React.Fragment, null, materialityColumn.renderCell(row, { primitives }))),
    /MAE-qualified/,
  );
  // R2: Knowledge is no longer a per-rep table COLUMN (it distorted the
  // table's formatting) -- it renders via renderKnowledgePill inside the
  // Knowledge block instead (see renderBody tests below).
  assert.equal(representationsQualifiersMod.representationsQualifiersConfig.columns.find((column) => column.id === 'knowledge'), undefined);
  assert.match(
    renderToStaticMarkup(React.createElement(React.Fragment, null, representationsQualifiersMod.renderKnowledgePill(row, { primitives }))),
    /Knowledge-qualified/,
  );
});

test('representations-qualifiers config renders ONE row per rep card, each resolving its OWN materiality/knowledge independently (Metsera regression: 16/22/37 claims were collapsing to 1)', () => {
  const repCard = (id, short_title, features) => ({
    id, provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-GENERIC', short_title, primary_quote: `${short_title} representation text.`, features,
  });
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [
      repCard('rep-org', 'Organization', { knowledgeQualifier: 'Company knowledge', materialityQualifier: 'material respects' }),
      repCard('rep-cap', 'Capitalization', { materialityQualifier: 'MAE qualified' }),
      repCard('rep-lit', 'Litigation', { knowledgeQualifier: 'to the knowledge of Parent' }),
    ],
  });
  assert.equal(rows.length, 3, 'one row per rep card, not collapsed to 1');
  assert.deepEqual(new Set(rows.map((row) => row.id)), new Set([
    'representations-qualifiers-rep-org',
    'representations-qualifiers-rep-cap',
    'representations-qualifiers-rep-lit',
  ]));
  const org = rows.find((row) => row.id === 'representations-qualifiers-rep-org');
  const cap = rows.find((row) => row.id === 'representations-qualifiers-rep-cap');
  const lit = rows.find((row) => row.id === 'representations-qualifiers-rep-lit');
  assert.equal(org.knowledge.label, 'Company knowledge');
  assert.equal(org.materiality.label, 'material respects');
  assert.equal(cap.materiality.label, 'MAE qualified');
  assert.equal(cap.knowledge, null, 'Capitalization has no knowledge qualifier of its own -- must not inherit Organization\'s');
  assert.equal(lit.knowledge.label, 'to the knowledge of Parent');
  assert.equal(lit.materiality, null, 'Litigation has no materiality qualifier of its own -- must not inherit Capitalization\'s');
});

// R1 (FEEDBACK-3-PUNCHLIST.md): General Exceptions renders as its OWN
// SEPARATE table at the TOP of the section (SEC-filings cut-off,
// portions-excluded, disclosure letter) -- no longer folded into a combined
// "Knowledge & General Exceptions" block. The SEC cut-off/portions-excluded
// carve-out is only ONE of the section's General Exceptions (alongside the
// disclosure letter) -- it must not be the section headline -- and pills
// (not a bulleted prose list) render the cut-off/portions-excluded content.
// The Company Disclosure Letter reference must render when present, never
// "Not present".
test('representations-qualifiers config title names the reps directly (not a separate "Representation Qualifiers" section) and renders General Exceptions as its OWN table ahead of the per-rep rows, with pills, and a correctly-resolved disclosure letter reference', () => {
  assert.equal(representationsQualifiersMod.representationsQualifiersConfig.title, 'Representations & Warranties — Company');
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [
      {
        id: 'preamble',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-PREAMBLE',
        short_title: 'Reps Preamble',
        features: {
          secFilingsExceptionLookback: 'at least one (1) business day prior to the date of this Agreement',
          secFilingsExcludedSections: [
            { code: 'RISK_FACTORS', text: 'disclosures contained in any part entitled "Risk Factors"' },
            { code: 'FORWARD_LOOKING', text: 'any forward-looking statements' },
          ],
          disclosureLetterReference: 'the Company Disclosure Letter',
        },
      },
      {
        id: 'org',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-ORG',
        short_title: 'Organization; Qualification; Standing',
        features: { materialityQualifier: 'except as would not be material' },
      },
    ],
  });
  assert.equal(rows[0].id, 'representations-qualifiers-general-exceptions');
  assert.equal(rows[0].kind, 'general-exceptions');
  assert.equal(rows[0].secCutoff, 'at least one (1) business day prior to the date of this Agreement');
  // Round-4 (Ben): portions-excluded entries are tightened to crisp labels
  // (and deduped) rather than the verbose verbatim excerpt text. Round-6
  // (Ben, item 1c): each entry now also carries its OWN verbatim as
  // `evidence` -- an OTHER-coded/unlabeled item's crisp display label alone
  // was an unclickable dead end (hovering it just echoed the label back).
  assert.deepEqual(rows[0].secExcluded, [
    { label: 'Risk Factors', evidence: 'disclosures contained in any part entitled "Risk Factors"' },
    { label: 'Forward-looking statements', evidence: 'any forward-looking statements' },
  ]);
  assert.equal(rows[0].disclosureLetter.label, 'the Company Disclosure Letter');
  assert.equal(rows[1].id, 'representations-qualifiers-org');
  assert.equal(rows[1].kind, 'rep');

  const primitives = {
    PillCell: ({ label, evidence }) => React.createElement('span', { className: 'pill', 'data-evidence': evidence }, label),
  };
  const bodyHtml = renderToStaticMarkup(representationsQualifiersMod.renderBody(rows, { primitives }));
  // General Exceptions is its own labelled sub-table, distinct from the
  // per-rep table below it (two separate <table> elements: General
  // Exceptions + the per-rep table).
  assert.equal((bodyHtml.match(/<table/g) || []).length, 2);
  assert.match(bodyHtml, /General Exceptions/);
  assert.match(bodyHtml, /SEC Filings/);
  assert.match(bodyHtml, /Cut-off/i);
  assert.match(bodyHtml, /<span class="pill"[^>]*>at least one \(1\) business day/);
  assert.match(bodyHtml, /Portions excluded/i);
  assert.match(bodyHtml, /<span class="pill"[^>]*>Risk Factors/);
  assert.match(bodyHtml, /Disclosure Letter/);
  assert.match(bodyHtml, /<span class="pill"[^>]*>the Company Disclosure Letter/);
  assert.doesNotMatch(bodyHtml, /Not present/);
});

// Item 12 (round 3, Theravance): secFilingsExceptionLookback stores the raw
// phrase "since the Applicable Date" -- the resolving date lives on the
// deal's own REP-T-SEC clause text ('...since January 1, 2024 (the
// "Applicable Date")...'). The General Exceptions cut-off pill must resolve
// to the actual date, with the resolving sentence (not the preamble) as its
// evidence.
test('Item 12: General Exceptions SEC cut-off resolves "since the Applicable Date" to the actual date found on another card', () => {
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [
      {
        id: 'preamble',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-PREAMBLE',
        short_title: 'Reps Preamble',
        primary_quote: 'Preamble clause text.',
        features: {
          secFilingsExceptionLookback: 'since the Applicable Date',
        },
      },
      {
        id: 'sec',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-SEC',
        short_title: 'SEC Filings',
        primary_quote: 'The Company has filed all forms, reports, schedules, statements and other documents required to be filed by it with the U.S. Securities and Exchange Commission (the "SEC") since January 1, 2024 (the "Applicable Date"), each of which complied in all material respects with the applicable requirements of the Exchange Act.',
        features: {},
      },
    ],
  });
  const row = rows.find((r) => r.kind === 'general-exceptions');
  assert.ok(row, 'expected a General Exceptions row');
  assert.equal(row.secCutoff, 'since Jan 1, 2024 (the "Applicable Date")');
  assert.match(row.secCutoffQuote, /since January 1, 2024 \(the "Applicable Date"\)/);
  assert.doesNotMatch(row.secCutoffQuote, /Preamble clause text/);
});

// No literal date found anywhere on the deal -- must keep current behavior
// (raw phrase, unresolved) rather than fabricating a date.
test('Item 12: General Exceptions SEC cut-off keeps the raw phrase when no resolving date exists on the deal', () => {
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [
      {
        id: 'preamble',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-PREAMBLE',
        short_title: 'Reps Preamble',
        features: { secFilingsExceptionLookback: 'since the Applicable Date' },
      },
    ],
  });
  const row = rows.find((r) => r.kind === 'general-exceptions');
  assert.ok(row);
  assert.equal(row.secCutoff, 'since the Applicable Date');
});

// A cut-off phrase that already carries a literal date must never be
// overwritten/re-resolved.
test('Item 12: a cut-off phrase that already has a literal date is left untouched', () => {
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [
      {
        id: 'preamble',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-PREAMBLE',
        short_title: 'Reps Preamble',
        features: { secFilingsExceptionLookback: 'since January 1, 2024' },
      },
    ],
  });
  const row = rows.find((r) => r.kind === 'general-exceptions');
  assert.ok(row);
  assert.equal(row.secCutoff, 'since January 1, 2024');
});

// Punch-list #16: when there is truly no disclosure-letter data (and no other
// General Exceptions content, and no knowledge group), the TOP row must not
// render at all -- never a fabricated "Not present" placeholder.
test('representations-qualifiers config omits the TOP row entirely when the preamble has no General-Exceptions or knowledge-group data', () => {
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [
      {
        id: 'preamble',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-PREAMBLE',
        short_title: 'Reps Preamble',
        features: {},
      },
      {
        id: 'org',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-ORG',
        short_title: 'Organization; Qualification; Standing',
        features: { materialityQualifier: 'except as would not be material' },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'representations-qualifiers-org');
});

// R4 (FEEDBACK-4-PUNCHLIST.md): the Knowledge STANDARD/PERSONS/SCOPE (who the
// qualifier attaches to and what it means) render as their own ROWS in a
// dedicated Knowledge block/table -- rows, not a squeezed per-rep column, and
// no longer a section headerNote either. The knowledge-qualified rep itself
// (SEC Documents) also gets its own ROW in that same Knowledge table.
test('representations-qualifiers config surfaces Knowledge Standard/Persons/Scope as ROWS in a dedicated Knowledge block, not a per-rep column or header note', () => {
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [
      {
        id: 'rep-sec',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-SEC',
        short_title: 'SEC Documents',
        features: {
          knowledgeQualifier: 'Company knowledge',
          knowledgeScope: '"knowledge" of any Person means, with respect to any matter in question, the actual knowledge of such Person\'s executive officers.',
          knowledgeStandard: 'actual-knowledge',
          knowledgePersons: ['EXECUTIVE_OFFICERS'],
        },
      },
    ],
  });
  const knowledgeSummary = rows.find((row) => row.kind === 'knowledge-summary');
  assert.ok(knowledgeSummary, 'knowledge-summary row should render from knowledgeStandard/knowledgePersons/knowledgeScope data');
  assert.equal(knowledgeSummary.knowledgeStandard, 'Actual knowledge');
  assert.equal(knowledgeSummary.knowledgePersons, 'Executive officers');
  assert.match(knowledgeSummary.knowledgeScope, /executive officers/);
  // The per-rep row still resolves its own knowledge qualifier data (it just
  // no longer renders as a table column -- see representations-qualifiers
  // config renders General Exceptions as its OWN table test for the column
  // removal assertion).
  const repRow = rows.find((row) => row.kind === 'rep');
  assert.equal(repRow.knowledge.label, 'Company knowledge');

  const primitives = {
    PillCell: ({ label, evidence }) => React.createElement('span', { className: 'pill', 'data-evidence': evidence }, label),
  };
  const html = renderToStaticMarkup(representationsQualifiersMod.renderBody(rows, { primitives }));
  assert.match(html, /Standard/);
  assert.match(html, /Actual knowledge/);
  assert.match(html, /Persons/);
  assert.match(html, /Executive officers/);
  // Round-4 (Ben): the standalone "Scope" row is dropped -- Standard/Persons
  // carry it and the full scope sentence survives as the pill hover evidence.
  assert.doesNotMatch(html, /<td[^>]*>Scope<\/td>/);
  assert.match(html, /of any Person means/);
  // The rep row appears as its OWN line/row in the Knowledge block too.
  assert.match(html, /SEC Documents/);
  assert.match(html, /Company knowledge/);
});

// Punch-list #17: lookback must use the absolute lookbackDateISO consistently
// -- never a raw day-count, and never a mixture of "N days" / "Since <date>"
// across rows. A rep with no lookbackDateISO renders no lookback at all
// rather than falling back to the unreliable lookbackPeriod day-count.
test('representations-qualifiers config normalizes lookback to a formatted date from lookbackDateISO, never a raw day-count', () => {
  const rows = representationsQualifiersMod.representationsQualifiersConfig.selectRows({
    cards: [
      {
        id: 'rep-with-date',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-ORG',
        short_title: 'Organization',
        features: { lookbackDateISO: '2023-01-01', lookbackPeriod: 127 },
      },
      {
        id: 'rep-with-inconsistent-days',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-CAP',
        short_title: 'Capitalization',
        features: { lookbackDateISO: '2023-01-01', lookbackPeriod: 1282 },
      },
      {
        id: 'rep-days-only',
        provision_type: 'REPRESENTATION',
        provision_subtype: 'REP-T-LIT',
        short_title: 'Litigation',
        features: { lookbackPeriod: 400 },
      },
    ],
  });
  const withDate = rows.find((row) => row.id === 'representations-qualifiers-rep-with-date');
  const withInconsistentDays = rows.find((row) => row.id === 'representations-qualifiers-rep-with-inconsistent-days');
  const daysOnly = rows.find((row) => row.id === 'representations-qualifiers-rep-days-only');
  assert.equal(withDate.lookback.label, 'Since Jan 1, 2023');
  // Same anchor date, different (unreliable) day counts -- both rows must
  // resolve to the SAME formatted date, never the raw day-count.
  assert.equal(withInconsistentDays.lookback.label, 'Since Jan 1, 2023');
  assert.doesNotMatch(withDate.lookback.label, /\d+\s*days/);
  assert.doesNotMatch(withInconsistentDays.lookback.label, /\d+\s*days/);
  // No lookbackDateISO at all -- renders no lookback rather than a day-count.
  assert.equal(daysOnly.lookback, null);
});

test('mae-definitions config exposes carve-out and definition signals with hover details', () => {
  const rows = maeDefinitionsMod.maeDefinitionsConfig.selectRows({
    cards: [{
      id: 'mae',
      provision_type: 'MAE',
      provision_subtype: 'MAE-DEF',
      short_title: 'Material Adverse Effect',
      primary_quote: 'Material Adverse Effect excludes general economic conditions except to the extent disproportionate and includes effects that prevent or materially delay closing.',
      features: {
        maeLimbType: 'TWO_LIMB',
        carveouts: [{ code: 'ECONOMY_GENERAL', label: 'General economy', text: 'general economic conditions' }],
        disproportionateImpactClause: 'except to the extent disproportionate',
        preventDelayProng: 'prevent or materially delay closing',
      },
    }],
  });
  const limbs = rows.find((row) => row.id === 'mae-definitions-limbs');
  const carveouts = rows.find((row) => row.id === 'mae-definitions-carveouts');
  // fb2 #20: the disproportionate-impact clause/scope no longer render as
  // their own summary rows -- that fact now lives ONLY as the per-carve-out
  // "Disp. carveback applies" pill inside the carve-outs table itself, so
  // there is no 'mae-definitions-disproportionate' row to find at all.
  assert.equal(rows.find((row) => row.id === 'mae-definitions-disproportionate'), undefined);
  assert.equal(rows.find((row) => row.id === 'mae-definitions-disproportionate-scope'), undefined);
  // fb3 #M3: the standalone "prevent-delay" prong row is dropped -- it
  // restated the second MAE limb already summarized by the "MAE Test" pill
  // above (TWO_LIMB means the prevent/delay prong is part of the test).
  assert.equal(rows.find((row) => row.id === 'mae-definitions-prevent-delay'), undefined);
  assert.deepEqual(limbs.signals.map((item) => item.label), ['TWO_LIMB']);
  assert.deepEqual(carveouts.signals.map((item) => item.label), ['General economic conditions']);
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const signalColumn = maeDefinitionsMod.maeDefinitionsConfig.columns.find((column) => column.id === 'signals');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(carveouts, { primitives }))), /General economic conditions/);
});

test('mae-definitions carve-outs table drops the right-hand TEXT column (fb2 #19) -- carve-out name + Disp. carveback pill only', () => {
  const rows = maeDefinitionsMod.maeDefinitionsConfig.selectRows({
    cards: [{
      id: 'mae',
      provision_type: 'MAE',
      provision_subtype: 'MAE-DEF',
      short_title: 'Material Adverse Effect',
      features: {
        carveouts: [
          { code: 'ACTS_OF_WAR_TERRORISM', text: 'acts of war or terrorism' },
        ],
        disproportionateImpactCarveouts: ['ACTS_OF_WAR_TERRORISM'],
      },
    }],
  });
  const carveouts = rows.find((row) => row.id === 'mae-definitions-carveouts');
  assert.ok(carveouts);
  const signalColumn = maeDefinitionsMod.maeDefinitionsConfig.columns.find((column) => column.id === 'signals');
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
  };
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(carveouts, { primitives })));
  assert.doesNotMatch(html, />Text</, 'no TEXT column header');
  assert.doesNotMatch(html, /acts of war or terrorism/, 'no raw carve-out clause text rendered');
  assert.match(html, /Disp\. carveback applies/);
  // fb3 #M2: no redundant "Carve-out" list header (the row above already
  // reads "Carve-outs") and no <table> wrapper -- a tight scannable <ul>.
  assert.doesNotMatch(html, /<th[^>]*>Carve-out</, 'no "Carve-out" column header');
  assert.doesNotMatch(html, /<table/, 'carve-outs render as a list, not a table');
  assert.match(html, /<ul/, 'carve-outs render as a list');
});

test('mae-definitions renderBody renders Company and Parent MAE as two separate <table> sub-sections, each headed distinctly (never repeating the section title) (fb2 #21, #22)', async () => {
  const rows = maeDefinitionsMod.maeDefinitionsConfig.selectRows({
    cards: [
      {
        id: 'mae-parent',
        provision_type: 'DEFINITION',
        provision_subtype: 'DEF-MAE',
        short_title: 'Material Adverse Effect',
        defined_term: 'Parent Material Adverse Effect',
        features: { maeLimbs: 'ONE_LIMB' },
      },
      {
        id: 'mae-company',
        provision_type: 'DEFINITION',
        provision_subtype: 'DEF-MAE',
        short_title: 'Material Adverse Effect',
        defined_term: 'Company Material Adverse Effect',
        features: { maeLimbs: 'TWO_LIMB' },
      },
    ],
  });
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children }) => React.createElement('span', null, children),
  };
  const html = renderToStaticMarkup(maeDefinitionsMod.renderBody(rows, { primitives }));
  const tableCount = (html.match(/<table/g) || []).length;
  assert.equal(tableCount, 2, 'Company and Parent must render as two separate <table> elements, not one grouped table');
  assert.match(html, /Company MAE/);
  assert.match(html, /Parent MAE/);
  // The section title "Material Adverse Effect" is rendered once by
  // ProvisionTable (above renderBody's output) -- renderBody's own markup
  // must not repeat it as an inner sub-table heading.
  assert.doesNotMatch(html, /Material Adverse Effect/);
  // Row labels inside each side's table read as the plain term ("MAE Test"),
  // not the raw "Company: MAE Test" / "Parent: MAE Test" data-layer prefix.
  assert.doesNotMatch(html, /Company: MAE Test/);
  assert.doesNotMatch(html, /Parent: MAE Test/);
});

test('mae-definitions config splits Company vs Parent DEF-MAE cards into their own row sets, not one side silently absorbing the other (Metsera regression)', () => {
  const rows = maeDefinitionsMod.maeDefinitionsConfig.selectRows({
    cards: [
      {
        id: 'mae-parent',
        provision_type: 'DEFINITION',
        provision_subtype: 'DEF-MAE',
        short_title: 'Material Adverse Effect',
        defined_term: 'Parent Material Adverse Effect',
        primary_quote: 'Parent Material Adverse Effect definition text.',
        features: { maeLimbs: 'ONE_LIMB' },
      },
      {
        id: 'mae-company',
        provision_type: 'DEFINITION',
        provision_subtype: 'DEF-MAE',
        short_title: 'Material Adverse Effect',
        defined_term: 'Company Material Adverse Effect',
        primary_quote: 'Company Material Adverse Effect definition text.',
        features: {
          maeLimbs: 'TWO_LIMB',
          carveouts: [{ code: 'ECONOMY_GENERAL', label: 'General economy', text: 'general economic conditions' }],
        },
      },
    ],
  });
  const companyLimbs = rows.find((row) => row.id === 'mae-definitions-company-limbs');
  const parentLimbs = rows.find((row) => row.id === 'mae-definitions-parent-limbs');
  const companyCarveouts = rows.find((row) => row.id === 'mae-definitions-company-carveouts');
  const parentCarveouts = rows.find((row) => row.id === 'mae-definitions-parent-carveouts');
  assert.ok(companyLimbs, 'Company side should render its own MAE-limbs row');
  assert.ok(parentLimbs, 'Parent side should render its own MAE-limbs row (previously absorbed by whichever card came first)');
  assert.equal(companyLimbs.detail, 'TWO_LIMB');
  assert.equal(parentLimbs.detail, 'ONE_LIMB');
  assert.ok(companyCarveouts, 'Company carve-outs should render');
  assert.equal(parentCarveouts, undefined, 'Parent has no carve-out data, so no Parent carve-outs row should be fabricated');
  assert.ok(companyLimbs.label.startsWith('Company:'));
  assert.ok(parentLimbs.label.startsWith('Parent:'));
});

test('antitrust-regulatory config exposes regulatory signals and hover details (consolidated per REBUILD-SPECS.md §8)', () => {
  const rows = antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows({
    cards: [{
      id: 'anti',
      provision_type: 'ANTITRUST_REGULATORY',
      provision_subtype: 'ANTI-HSR',
      short_title: 'Regulatory Efforts',
      primary_quote: 'Parent shall use reasonable best efforts to obtain HSR clearance within 10 business days and shall not agree to divest material assets.',
      features: {
        effortsStandard: { code: 'REASONABLE_BEST_EFFORTS', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
        hsrFilingDeadline: '10 business days after signing',
        antitrustApprovals: [{ code: 'HSR', label: 'HSR clearance', text: 'HSR clearance' }],
        burdensomeConditionLimit: 'no divestiture of material assets',
      },
    }],
  });
  const efforts = rows.find((row) => row.id === 'antitrust-regulatory-efforts');
  const filings = rows.find((row) => row.id === 'antitrust-regulatory-hsr-deadline');
  const divestitureCap = rows.find((row) => row.id === 'antitrust-regulatory-divestiture-cap');
  // Term column already reads "Efforts standard" / "HSR filing deadline" --
  // pills are the resolved value alone (no "term: value" doubling), and the
  // HSR deadline is normalized out of raw prose into a clean "N business
  // days" pill rather than echoing the unparsed clause.
  assert.deepEqual(efforts.signals.map((item) => item.label), ['Reasonable best efforts']);
  assert.deepEqual(filings.signals.map((item) => item.label), ['10 business days']);
  assert.deepEqual(divestitureCap.signals.map((item) => item.label), ['no divestiture of material assets']);
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const detailColumn = antitrustRegulatoryMod.antitrustRegulatoryConfig.columns.find((column) => column.id === 'detail');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, detailColumn.renderCell(divestitureCap, { primitives }))), /data-evidence="Parent shall use reasonable best efforts/);
});

test('antitrust-regulatory foreign filings row renders "Required" plus the HSR and foreign timeline limbs (Feedback-3 A1)', () => {
  const rows = antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows({
    cards: [
      {
        id: 'foreign',
        provision_type: 'ANTITRUST_REGULATORY',
        provision_subtype: 'ANTI-FOREIGN',
        short_title: 'Foreign Regulatory Approvals',
        primary_quote: 'The parties shall make all required filings under applicable foreign antitrust laws.',
        features: {
          foreignFilingsRequired: ['EU', 'China SAMR'],
        },
      },
      {
        id: 'hsr',
        provision_type: 'ANTITRUST_REGULATORY',
        provision_subtype: 'ANTI-FILING',
        short_title: 'HSR Filing Deadline',
        primary_quote: 'The parties shall file their HSR notifications within 30 business days.',
        features: {
          hsrFilingDeadlineBusinessDays: 30,
          exHsrFilingDeadline: { standard: 'as promptly as reasonably practicable' },
        },
      },
    ],
  });
  const foreign = rows.find((row) => row.id === 'antitrust-regulatory-foreign-filings');
  assert.ok(foreign, 'Foreign regulatory filings row should render');
  assert.equal(foreign.label, 'Foreign regulatory filings');
  assert.deepEqual(foreign.signals.map((item) => item.label), [
    'Required',
    '(i) HSR — 30 business days',
    '(ii) Foreign — as promptly as reasonably practicable',
  ]);
});

test('antitrust-regulatory strategy control row is labeled "Strategy control" with a bare party pill (Feedback-3 A2)', () => {
  const rows = antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows({
    cards: [{
      id: 'strategy',
      provision_type: 'ANTITRUST_REGULATORY',
      provision_subtype: 'ANTI-COOPERATE',
      short_title: 'Regulatory Strategy Control',
      primary_quote: 'Parent shall control and lead all strategy relating to obtaining Antitrust Approvals.',
      features: {
        regulatoryStrategyControlTagged: 'PARENT_CONTROL',
      },
    }],
  });
  const strategyControl = rows.find((row) => row.id === 'antitrust-regulatory-strategy-control');
  assert.ok(strategyControl, 'Strategy control row should render');
  assert.equal(strategyControl.label, 'Strategy control');
  assert.deepEqual(strategyControl.signals.map((item) => item.label), ['Parent']);
  assert.equal(rows.find((row) => row.label === 'Filing responsibility'), undefined, '"Filing responsibility" wording must not appear');
});

test('antitrust-regulatory pull-refile and timing-agreements rows surface the unilateral-withdrawal proviso (Feedback-3 A3)', () => {
  const provisoText = "Neither Party shall withdraw its notification without the prior written consent of the other Party, which consent shall not be unreasonably withheld, conditioned or delayed; provided that Parent may, without the Company's consent, voluntarily withdraw its notification, provided that it refiles within two (2) business days.";
  const rows = antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows({
    cards: [{
      id: 'timing',
      provision_type: 'ANTITRUST_REGULATORY',
      provision_subtype: 'ANTI-TIMING',
      short_title: 'Timing Agreements',
      primary_quote: provisoText,
      features: {
        pullRefile: { code: 'MUTUAL_CONSENT', label: 'Mutual consent', text: provisoText },
        timingAgreementsProhibited: { code: 'NOT_UNREASONABLY_WITHHELD', label: 'Consent not to be unreasonably withheld', text: provisoText },
        pullRefileText: provisoText,
        timingAgreementText: provisoText,
      },
    }],
  });
  const pullRefile = rows.find((row) => row.id === 'antitrust-regulatory-pull-refile');
  const timingAgreements = rows.find((row) => row.id === 'antitrust-regulatory-timing-agreements');
  assert.ok(pullRefile, 'Pull-and-refile row should render');
  assert.ok(timingAgreements, 'Timing agreements row should render');
  // Each row reads its OWN canonical code (PULL_REFILE.MUTUAL_CONSENT vs
  // TIMING_AGREEMENT.NOT_UNREASONABLY_WITHHELD) via prohibitionLabel/
  // labelForCode -- no render-time regex forces them to a single shared
  // label. The 2-business-day withdraw-and-refile proviso stays specific to
  // pull-and-refile. When extraction assigns different codes to the same
  // clause the pills legitimately differ (reconcile upstream, not here).
  assert.deepEqual(pullRefile.signals.map((item) => item.label), [
    'Mutual consent',
    'Proviso: may withdraw without consent if refiled within 2 business days',
  ]);
  assert.deepEqual(timingAgreements.signals.map((item) => item.label), [
    'Consent not to be unreasonably withheld',
  ]);
});

test('antitrust-regulatory pull-refile row does not fabricate a proviso pill when the text has no withdrawal carve-out', () => {
  const rows = antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows({
    cards: [{
      id: 'timing-plain',
      provision_type: 'ANTITRUST_REGULATORY',
      provision_subtype: 'ANTI-TIMING',
      short_title: 'Timing Agreements',
      primary_quote: 'Neither Party shall withdraw its notification without the prior written consent of the other Party.',
      features: {
        pullRefile: { code: 'MUTUAL_CONSENT', label: 'Mutual consent' },
      },
    }],
  });
  const pullRefile = rows.find((row) => row.id === 'antitrust-regulatory-pull-refile');
  assert.ok(pullRefile);
  assert.deepEqual(pullRefile.signals.map((item) => item.label), ['Mutual consent']);
});

test('structure-mechanics config exposes transaction-form signals and hover details', () => {
  const rows = structureMechanicsMod.structureMechanicsConfig.selectRows({
    cards: [{
      id: 'struct',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-MERGER',
      short_title: 'Merger',
      primary_quote: 'The merger shall be a reverse triangular merger under Section 251(h), with appraisal rights available.',
      features: {
        dealStructure: 'TWO_STEP_TENDER_OFFER',
        mergerForm: 'REVERSE_TRIANGULAR_MERGER',
        section251h: true,
        appraisalRightsAvailable: true,
      },
    }],
  });
  const dealStructure = rows.find((row) => row.id === 'structure-mechanics-deal-structure');
  const mergerForm = rows.find((row) => row.id === 'structure-mechanics-merger-form');
  const section251h = rows.find((row) => row.id === 'structure-mechanics-section-251h');
  const paymentAgent = rows.find((row) => row.id === 'structure-mechanics-payment-agent');
  assert.deepEqual(dealStructure.signals.map((item) => item.label), ['TWO_STEP_TENDER_OFFER']);
  assert.match(mergerForm.signals[0].label, /Reverse triangular/);
  assert.deepEqual(section251h.signals.map((item) => item.label), ['Yes']);
  // Payment / exchange mechanics is deliberately dropped from Structure &
  // Mechanics -- it's a link under Consideration, not a "Yes" boolean row
  // here (REBUILD-SPECS.md section 1).
  assert.equal(paymentAgent, undefined);
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const signalColumn = structureMechanicsMod.structureMechanicsConfig.columns.find((column) => column.id === 'signals');
  const detailColumn = structureMechanicsMod.structureMechanicsConfig.columns.find((column) => column.id === 'detail');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(mergerForm, { primitives }))), /Reverse triangular/);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, detailColumn.renderCell(section251h, { primitives }))), /data-evidence="The merger shall be a reverse triangular merger/);
});

// Regression: effectiveTimeShort is corrupted on some backfilled cards and
// renders "Names the Company as the surviving corporation..." instead of the
// filing mechanic. The config must never surface that sentence as the
// effective time -- it should fall back to effectiveTime / mainConcept / the
// clause instead (REBUILD-SPECS.md section 1).
//
// No primary_quote on this card -- deliberately, so this test exercises the
// STRUCTURED-key fallback tier (effectiveTimeShort -> effectiveTime ->
// mainConcept) in isolation. See the "prefers the real clause text" test
// below for the real-text-wins tier that now runs ahead of this one.
test('structure-mechanics config skips a corrupted effectiveTimeShort claim and falls back to the filing mechanic', () => {
  const rows = structureMechanicsMod.structureMechanicsConfig.selectRows({
    cards: [{
      id: 'struct-effective-time',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EFFECTIVE-TIME',
      short_title: 'Effective Time',
      features: {
        effectiveTimeShort: 'Names the Company as the surviving corporation of the Merger.',
        effectiveTime: 'Upon filing of the Certificate of Merger with the Delaware Secretary of State.',
      },
    }],
  });
  const effectiveTime = rows.find((row) => row.id === 'structure-mechanics-effective-time');
  assert.ok(effectiveTime, 'effective-time row should still render');
  assert.doesNotMatch(effectiveTime.detail, /surviving corporation/i);
  assert.match(effectiveTime.detail, /Upon filing of the Certificate of Merger/);
  assert.deepEqual(effectiveTime.signals.map((item) => item.label), ['Upon filing of the Certificate of Merger with the Delaware Secretary of State.']);
});

// Round 3 (Metsera, item 1c): the corpus reprocess fixed the corrupted
// effectiveTimeShort claims that the old clause-first tier order was a
// stopgap for, so a CLEAN effectiveTimeShort/effectiveTime AI summary must
// now win over the raw clause text once it clears the surviving-corporation
// guard -- the short claim is what Ben wants in the row; the full ~780-char
// clause dump is available behind "See provision". The clause tier is now
// the fallback for cards with no clean structured value at all (see the
// test below).
test('structure-mechanics config prefers a clean effectiveTimeShort/effectiveTime summary over the raw clause text', () => {
  const rows = structureMechanicsMod.structureMechanicsConfig.selectRows({
    cards: [{
      id: 'struct-effective-time-real-text',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EFFECTIVE-TIME',
      short_title: 'Effective Time',
      primary_quote: 'The Merger shall become effective at the Effective Time, which shall occur upon the filing of the Certificate of Merger with the Secretary of State of the State of Delaware, or at such later time as Parent and the Company shall agree and specify in the Certificate of Merger.',
      features: {
        effectiveTimeShort: 'Upon filing of the Certificate of Merger with the Delaware Secretary of State.',
        effectiveTime: 'Upon filing of the Certificate of Merger with the Delaware Secretary of State.',
      },
    }],
  });
  const effectiveTime = rows.find((row) => row.id === 'structure-mechanics-effective-time');
  assert.ok(effectiveTime, 'effective-time row should still render');
  assert.equal(
    effectiveTime.detail,
    'Upon filing of the Certificate of Merger with the Delaware Secretary of State.',
    'the short AI summary -- not the raw ~780-char clause -- must win once it clears the surviving-corporation guard',
  );
  assert.doesNotMatch(
    effectiveTime.detail,
    /or at such later time as Parent and the Company shall agree/,
    'the raw clause text must stay behind See provision, not inline in the row',
  );
});

// Regression: when EVERY effective-time key on the card is corrupted (or
// missing after filtering), the guard falls all the way back to the card's
// raw clause text rather than surfacing the corrupted sentence.
test('structure-mechanics config falls back to the clause when every effective-time key is corrupted', () => {
  const rows = structureMechanicsMod.structureMechanicsConfig.selectRows({
    cards: [{
      id: 'struct-effective-time-clause-only',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EFFECTIVE-TIME',
      short_title: 'Effective Time',
      primary_quote: 'The Merger shall become effective upon filing of the Certificate of Merger with the Delaware Secretary of State.',
      features: {
        effectiveTimeShort: 'Names the Company as the surviving corporation of the Merger.',
      },
    }],
  });
  const effectiveTime = rows.find((row) => row.id === 'structure-mechanics-effective-time');
  assert.ok(effectiveTime, 'effective-time row should still render from the clause fallback');
  assert.doesNotMatch(effectiveTime.detail, /surviving corporation/i);
  assert.match(effectiveTime.detail, /upon filing of the Certificate of Merger/i);
});

// Regression (Feedback 2, item #1): when the FIRST card's effectiveTimeShort
// is corrupted and that same card ALSO has a mainConcept, the old card-first
// scan order reached that card's mainConcept fallback before ever checking a
// SECOND card's good effectiveTimeShort -- surfacing "Defines the Delaware
// certificate of merger to be filed at closing" instead of the correct
// filing-mechanic sentence. The scan must be key-first: exhaust
// effectiveTimeShort across every card before falling to effectiveTime, then
// mainConcept.
//
// No primary_quote on either card -- deliberately, so this test exercises
// the STRUCTURED-key tier (now the first tier) in isolation from the clause
// tier, which is covered by its own dedicated tests above/below.
test('structure-mechanics config prefers a good effectiveTimeShort on a LATER card over an earlier card\'s mainConcept', () => {
  const rows = structureMechanicsMod.structureMechanicsConfig.selectRows({
    cards: [{
      id: 'struct-effective-time-corrupted',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EFFECTIVE-TIME',
      short_title: 'Effective Time',
      features: {
        effectiveTimeShort: 'Names the Company as the surviving corporation of the Merger.',
        mainConcept: 'Defines the Delaware certificate of merger to be filed at closing.',
      },
    }, {
      id: 'struct-effective-time-good',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EFFECTIVE-TIME',
      short_title: 'Effective Time',
      features: {
        effectiveTimeShort: 'Upon filing of the Certificate of Merger with the Delaware Secretary of State.',
      },
    }],
  });
  const effectiveTime = rows.find((row) => row.id === 'structure-mechanics-effective-time');
  assert.ok(effectiveTime, 'effective-time row should still render');
  assert.doesNotMatch(effectiveTime.detail, /surviving corporation/i);
  assert.doesNotMatch(effectiveTime.detail, /Defines the Delaware certificate/i);
  assert.match(effectiveTime.detail, /Upon filing of the Certificate of Merger with the Delaware Secretary of State/);
});

// Rebuilt per user feedback to match the legacy pre-schema render: ONE
// consolidated table grouped by which side may exercise the right (Mutual /
// Buyer / Target), each row a canonical termination right with a short
// bullet list of key terms -- not a flat concept-by-concept grid.
test('termination-rights config consolidates into ONE row whose groups are keyed by family (Mutual / Buyer / Target)', () => {
  const rows = terminationRightsMod.terminationRightsConfig.selectRows({
    cards: [{
      id: 'termr',
      provision_type: 'TERMINATION_RIGHT',
      provision_subtype: 'TERMR-OUTSIDE',
      short_title: 'Outside Date',
      primary_quote: 'Either party may terminate after June 30, 2026, subject to a 90-day regulatory extension.',
      features: {
        outsideDate: 'June 30, 2026',
        extensionPeriod: '90 days',
      },
    }],
  });
  assert.equal(rows.length, 1, 'termination rights render as ONE table, not one row per concept');
  assert.ok(Array.isArray(rows[0].groups), 'the single row carries the family groups for GroupedSubRows to render');
});

// WS-G T6: TERMR-SUPERIOR is no longer one of the canonical termination-rights
// rows -- "Company termination for Superior Proposal" now renders inside the
// No-Solicitation section's Superior Proposal box instead (see
// nosol-superior.config.js's terminationRow()/nosol-section.config.js). The
// Target / Company family group's only remaining canonical right is
// TERMR-BREACH-B (Parent/Buyer breach).
test('termination-rights familyGroups() groups canonical rights under Mutual / Buyer / Target headers, with absent rights flagged not-present', () => {
  const cards = [
    { id: 'outside', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-OUTSIDE', short_title: 'Outside Date', primary_quote: 'Outside date text.', features: { outsideDate: 'June 30, 2026' } },
    { id: 'breach-t', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-BREACH-T', short_title: 'Target Breach', primary_quote: 'Target breach text.', features: { curePeriod: '30 days' } },
    { id: 'breach-b', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-BREACH-B', short_title: 'Buyer Breach', primary_quote: 'Buyer breach text.', features: { curePeriod: '45 days' } },
  ];
  const groups = terminationRightsMod.familyGroups(cards);
  const mutual = groups.find((g) => g.id === 'mutual');
  const buyer = groups.find((g) => g.id === 'buyer');
  const target = groups.find((g) => g.id === 'target');
  assert.ok(mutual, 'Mutual / Either Party group should render');
  assert.ok(buyer, 'Buyer / Parent group should render');
  assert.ok(target, 'Target / Company group should render');
  const outsideRow = mutual.rows.find((r) => r.spec.key === 'outside');
  const mutualConsentRow = mutual.rows.find((r) => r.spec.key === 'mutual');
  assert.ok(outsideRow.present, 'Outside Date right has a matching card');
  assert.ok(!mutualConsentRow.present, 'Mutual consent right has no matching card and should render as not-present');
  assert.match(outsideRow.value.join(' '), /June 30, 2026/);
  const breachRow = buyer.rows.find((r) => r.spec.key === 'breachT');
  assert.match(breachRow.value.join(' '), /30 days/);
  const breachBRow = target.rows.find((r) => r.spec.key === 'breachB');
  assert.match(breachBRow.value.join(' '), /45 days/);
  const superiorRow = target.rows.find((r) => r.spec.key === 'superior');
  assert.equal(superiorRow, undefined, 'TERMR-SUPERIOR is no longer a termination-rights canonical row (moved into the Superior Proposal box, WS-G T6)');
});

test('termination-rights config renders through GroupedSubRows and preserves evidence per right', () => {
  const rows = terminationRightsMod.terminationRightsConfig.selectRows({
    cards: [{
      id: 'termr',
      provision_type: 'TERMINATION_RIGHT',
      provision_subtype: 'TERMR-LEGAL',
      short_title: 'Legal Restraint',
      primary_quote: 'Either party may terminate if a final, non-appealable legal restraint is in effect.',
      features: { restraintFinality: 'final and non-appealable' },
    }],
  });
  const GroupedSubRows = ({ groups }) => React.createElement(
    'div',
    null,
    groups.map((g) => React.createElement('div', { key: g.id }, g.label, g.rows.map((r) => React.createElement('span', { key: r.id }, r.label)))),
  );
  const bodyColumn = terminationRightsMod.terminationRightsConfig.columns.find((column) => column.id === 'body');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, bodyColumn.renderCell(rows[0], { primitives: { GroupedSubRows } })));
  assert.match(html, /Mutual \/ Either Party/);
  assert.match(html, /Legal restraint \/ order/);
});

// Punchlist T2 (round 3): the "Legal restraint / order" row's visible
// content must be ONLY the short finality phrase -- no trailing text.
// Exercises the real keyTermsNode/PillCell pipeline (not the label-only
// fake GroupedSubRows above) so the actual cell text is asserted.
test('termination-rights "legal" row renders ONLY the finality phrase, never the raw restraintFinality text as trailing content', () => {
  const PillCell = ({ label }) => React.createElement('span', { className: 'pill' }, label);
  const legalSpec = terminationRightsMod.TERMR_CANONICAL.find((spec) => spec.key === 'legal');

  const cleanCard = {
    id: 'termr-legal-clean',
    provision_type: 'TERMINATION_RIGHT',
    provision_subtype: 'TERMR-LEGAL',
    primary_quote: 'Either party may terminate if a final, non-appealable legal restraint is in effect.',
    features: { restraintFinality: 'final-and-nonappealable' },
  };
  const cleanRow = terminationRightsMod.rowForSpec(legalSpec, [cleanCard], PillCell);
  const cleanHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, cleanRow.children));
  assert.match(cleanHtml, /Final and unappealable/);
  assert.equal(cleanHtml.replace(/<[^>]+>/g, '').trim(), 'Final and unappealable');

  // Legacy/free-text extraction sometimes lands the WHOLE clause sentence
  // in restraintFinality instead of the short enum code -- the old
  // humanizeToken() fallback dumped that entire sentence into the cell.
  // Keyword matching must still resolve it to the short phrase, with
  // nothing extra trailing after it.
  const freeTextCard = {
    id: 'termr-legal-freetext',
    provision_type: 'TERMINATION_RIGHT',
    provision_subtype: 'TERMR-LEGAL',
    primary_quote: 'A final, non-appealable order of a Governmental Entity restrains the Merger.',
    features: { restraintFinality: 'A final, non-appealable order, decree, ruling or other action of any Governmental Entity of competent jurisdiction permanently restraining, enjoining or otherwise prohibiting consummation of the Merger shall be in effect.' },
  };
  const freeTextRow = terminationRightsMod.rowForSpec(legalSpec, [freeTextCard], PillCell);
  const freeTextHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, freeTextRow.children));
  const freeTextContent = freeTextHtml.replace(/<[^>]+>/g, '').trim();
  assert.equal(freeTextContent, 'Final and unappealable', 'unrecognized free-text restraintFinality must resolve to the short phrase, never leak the raw clause sentence');
});

test('sec-meeting config exposes proxy and offer signals with hover details', () => {
  const rows = secMeetingMod.secMeetingConfig.selectRows({
    cards: [{
      id: 'proxy',
      provision_subtype: 'COV-PROXY',
      primary_quote: 'The Company shall file the proxy statement within 10 business days and Parent may require one adjournment.',
      features: {
        proxyFilingDeadline: { days: 10, unit: 'BUSINESS_DAYS', trigger: 'SIGNING', text: 'file within 10 business days after signing' },
        adjournmentRights: [{ party: 'PARENT', reasons: [{ code: 'SOLICIT_VOTES', label: 'Solicit votes' }], maxDaysTotal: 30, text: 'Parent may require one adjournment to solicit votes.' }],
        schedule14D9Filing: 'Company files Schedule 14D-9 promptly after offer commencement.',
      },
    }],
  });
  const proxy = rows.find((row) => row.id === 'sec-meeting-proxy-filing');
  const adjournment = rows.find((row) => row.id === 'sec-meeting-adjournment-0');
  const schedule14d9 = rows.find((row) => row.id === 'sec-meeting-schedule14D9Filing');
  assert.match(proxy.signals[0].label, /Proxy \/ meeting: 10 business days after signing/);
  assert.match(adjournment.signals[0].label, /Solicit votes/);
  assert.match(schedule14d9.signals[0].label, /SEC \/ offer: Company files Schedule 14D-9/);
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const signalColumn = secMeetingMod.secMeetingConfig.columns.find((column) => column.id === 'signals');
  const detailColumn = secMeetingMod.secMeetingConfig.columns.find((column) => column.id === 'detail');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(proxy, { primitives }))), /10 business days after signing/);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, detailColumn.renderCell(schedule14d9, { primitives }))), /data-evidence="The Company shall file the proxy statement/);
});

test('general-covenants config excludes IOC content entirely (REBUILD-SPECS.md section 6: owned by ioc-exceptions.config.js)', () => {
  const covCard = (id, subtype, short_title, mainConcept) => ({
    id, provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: subtype, short_title, primary_quote: `${short_title} clause text.`, features: { mainConcept },
  });
  const rows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [
      covCard('cov-maintain', 'IOC-MAINTAIN', 'Maintain Insurance', 'The Company shall maintain existing insurance policies.'),
      covCard('cov-ordinary', 'IOC-ORDINARY', 'Ordinary Course', 'The Company shall conduct business in the ordinary course.'),
      covCard('cov-dividend', 'IOC-DIVIDEND', 'Dividends', 'The Company shall not declare dividends without consent.'),
      { id: 'cov-preamble', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-GENERAL-EXCEPTIONS', short_title: 'General Exceptions', primary_quote: 'Exceptions preamble.', features: {} },
    ],
  });
  assert.deepEqual(rows, [], 'every COVENANT_INTERIM_OPERATING / IOC-prefixed card must be excluded, not just the preamble container');
});

test('general-covenants config never resurrects the MISC §9.01 "No Survival" card as a row (its clause text happens to contain the word "covenant")', () => {
  const rows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [{
      id: 'misc-survival',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-SURVIVAL',
      short_title: 'No Survival / Nonsurvival',
      primary_quote: 'This Section 9.01 shall not limit any covenant or agreement of the parties which by its terms is to be performed after the Effective Time.',
      features: {
        mainConcept: 'Representations and warranties do not survive the Effective Time.',
        repsSurvivalExceptions: 'This Section 9.01 shall not limit any covenant or agreement of the parties which by its terms is to be performed after the Effective Time.',
      },
    }],
  });
  assert.deepEqual(rows, [], 'MISC_BOILERPLATE cards are not general covenants, regardless of what words their clause text contains');
});

// FEEDBACK-2-PUNCHLIST.md #30: the old signals-pill-grid summary read
// "weird" (Ben) -- every general-covenants row is now a LINK to its own
// provision instead, carrying the full clause value on `.evidence` rather
// than a per-field pill breakdown.
test('general-covenants config renders the curated efforts covenant as a link (no signals grid)', () => {
  const rows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [{
      id: 'cov-efforts',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-EFFORTS',
      short_title: 'Efforts Covenant',
      primary_quote: 'The Company shall use reasonable best efforts within five business days, subject to Parent consent.',
      features: {
        effortsStandard: { code: 'REASONABLE_BEST_EFFORTS', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
      },
    }],
  });
  const row = rows.find((entry) => entry.label === 'General efforts standard');
  assert.ok(row, 'curated efforts row should still render for a real COVENANT_OTHER card');
  assert.equal(row.kind, 'Link');
  assert.equal(row.isLink, true);
  assert.equal(row.signals, undefined, 'the signals pill grid is gone -- rows are links now');
  assert.match(row.evidence, /reasonable best efforts/);
});

test('general-covenants config renders one row PER genuine COVENANT_OTHER clause not covered by a curated row, and excludes IOC cards from the same mix', () => {
  const rows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [
      {
        id: 'cov-notice',
        provision_type: 'COVENANT_OTHER',
        provision_subtype: 'COV-NOTICE',
        short_title: 'Notice of Certain Events',
        primary_quote: 'Notice of Certain Events clause text.',
        features: { mainConcept: 'Each party must promptly notify the other of any event likely to cause a condition to fail.' },
      },
      {
        id: 'cov-maintain',
        provision_type: 'COVENANT_INTERIM_OPERATING',
        provision_subtype: 'IOC-MAINTAIN',
        short_title: 'Maintain Insurance',
        primary_quote: 'Maintain Insurance clause text.',
        features: { mainConcept: 'The Company shall maintain existing insurance policies.' },
      },
    ],
  });
  const notice = rows.find((row) => row.label === 'Notice of Certain Events');
  const maintain = rows.find((row) => row.label === 'Maintain Insurance');
  assert.ok(notice, 'a genuine COVENANT_OTHER clause not covered by a curated row should get its own per-clause link row');
  assert.equal(notice.kind, 'Link');
  assert.equal(notice.isLink, true);
  assert.match(notice.evidence, /Notice of Certain Events clause text/);
  assert.equal(maintain, undefined, 'the IOC card must not appear here -- ioc-exceptions.config.js owns it');
});

// FEEDBACK-2-PUNCHLIST.md #13/#31: Parent's adoption of the merger
// agreement moved OUT of General Covenants entirely -- it now renders only
// on votes-approvals-meeting.config.js (see the dedicated test below).
test('general-covenants config excludes Parent/Merger Sub adoption content (moved to votes-approvals-meeting.config.js)', () => {
  const rows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [{
      id: 'cov-parent-adopt',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-SHAPRV-PARENT',
      short_title: 'Parent Adoption of Merger Agreement',
      primary_quote: 'Parent Adoption of Merger Agreement clause text.',
      features: { mainConcept: 'Parent, as sole stockholder of Merger Sub, must adopt the merger agreement immediately.' },
    }],
  });
  assert.deepEqual(rows, [], 'COV-SHAPRV-PARENT must not render on General Covenants any more');
});

// FEEDBACK-2-PUNCHLIST.md #13: Parent / Merger Sub's own approval row, moved
// here from General Covenants. Wording must NOT say "written consent
// required" (that phrase describes the Company-side approval row and would
// wrongly imply the Company needs written consent too).
test('votes-approvals-meeting config renders a Parent / Merger Sub approvals row sourced from COV-SHAPRV-PARENT, worded distinctly from the Company written-consent row', () => {
  const rows = votesApprovalsMeetingMod.buildRows({
    cards: [{
      id: 'cov-parent-adopt',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-SHAPRV-PARENT',
      short_title: 'Parent Adoption of Merger Agreement',
      primary_quote: 'Parent, as the sole stockholder of Merger Sub, has adopted this Agreement by written consent concurrently with execution.',
      features: {
        parentAdoptionMechanism: { code: 'WRITTEN_CONSENT', label: 'Written consent' },
        parentAdoptionTiming: 'concurrently with execution',
      },
    }],
  });
  const row = rows.find((entry) => entry.id === 'votes-approvals-meeting-parent-approval');
  assert.ok(row, 'expected a Parent / Merger Sub approvals row');
  assert.equal(row.label, 'Parent / Merger Sub approvals');
  const primitives = { PillCell: ({ label }) => React.createElement('span', null, label) };
  const provisionColumn = votesApprovalsMeetingMod.votesApprovalsMeetingConfig.columns.find((c) => c.id === 'provision');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, provisionColumn.renderCell(row, { primitives })));
  assert.match(html, /in writing by Parent/);
  assert.match(html, /no separate Parent vote required/);
  assert.doesNotMatch(html, /written consent required/i);
});

// Item 7 (round 3, QXO card 50c90c2d): COV-SHAPRV-PARENT with NO
// parentAdoptionMechanism claim, whose clause reads "Parent will cause a
// written consent to be executed by all of the record holders of the stock
// of Titanium Merger Sub to adopt and approve this Agreement..." -- the
// existing "sole stockholder" deterministic pattern doesn't match this
// phrasing, so before the fix the row fell to the raw TruncatedWithSeeText
// clause dump instead of a short pill.
test('votes-approvals-meeting config resolves QXO\'s "written consent by all record holders" Merger Sub adoption phrasing to a short pill, not a raw clause dump', () => {
  const rows = votesApprovalsMeetingMod.buildRows({
    cards: [{
      id: 'cov-parent-adopt-qxo',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-SHAPRV-PARENT',
      short_title: 'Parent Adoption of Merger Agreement',
      primary_quote: 'Parent will cause a written consent to be executed by all of the record holders of the stock of Titanium Merger Sub to adopt and approve this Agreement immediately following the execution of this Agreement.',
      features: {},
    }],
  });
  const row = rows.find((entry) => entry.id === 'votes-approvals-meeting-parent-approval');
  assert.ok(row, 'expected a Parent / Merger Sub approvals row');
  const primitives = { PillCell: ({ label }) => React.createElement('span', null, label) };
  const provisionColumn = votesApprovalsMeetingMod.votesApprovalsMeetingConfig.columns.find((c) => c.id === 'provision');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, provisionColumn.renderCell(row, { primitives })));
  assert.match(html, /Merger Sub stockholders adopt by written consent \(immediately after signing\)/);
  assert.doesNotMatch(html, /Titanium Merger Sub to adopt and approve this Agreement/, 'the raw clause must not render inline any more');
});

// FEEDBACK-2-PUNCHLIST.md #12: the "Meeting control notes" row is gone.
test('votes-approvals-meeting config no longer renders a "Meeting control notes" row', () => {
  const rows = votesApprovalsMeetingMod.buildRows({
    cards: [{
      id: 'proxy',
      provision_subtype: 'COV-PROXY',
      primary_quote: 'The Company will control the meeting.',
      features: { meetingControlNotes: 'The Company controls the timing and conduct of the meeting.' },
    }],
  });
  assert.equal(rows.find((row) => row.label === 'Meeting control notes'), undefined);
});

// FEEDBACK-2-PUNCHLIST.md #11: adjournment rights render as three labelled
// parts -- Permitted reason / Controlling party / Restriction -- instead of
// flat sibling pills.
test('votes-approvals-meeting config renders adjournment rights as three labelled groups (reason / party / restriction)', () => {
  const rows = votesApprovalsMeetingMod.buildRows({
    cards: [{
      id: 'proxy',
      provision_subtype: 'COV-PROXY',
      primary_quote: 'meeting card',
      features: {
        adjournmentRights: [{
          party: 'COMPANY',
          reasons: [{ code: 'INSUFFICIENT_VOTES', label: 'Insufficient votes' }],
          maxDaysTotal: 15,
          text: 'The Company may adjourn the meeting due to insufficient votes for no more than fifteen (15) days in the aggregate without the prior written consent of Parent.',
        }],
      },
    }],
  });
  const row = rows.find((entry) => entry.kind === 'adjournment');
  assert.ok(row, 'expected an adjournment row');
  const primitives = { PillCell: ({ label }) => React.createElement('span', null, label) };
  const provisionColumn = votesApprovalsMeetingMod.votesApprovalsMeetingConfig.columns.find((c) => c.id === 'provision');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, provisionColumn.renderCell(row, { primitives })));
  assert.match(html, /Permitted reason/);
  assert.match(html, /Insufficient votes/);
  assert.match(html, /Controlling party/);
  assert.match(html, /Company/);
  assert.match(html, /Restriction/);
  assert.match(html, /No more than 15 days without Parent(?:&#x27;|')s consent/);
});

test('conditions-m config returns no table rows when no closing-condition cards exist', () => {
  assert.deepEqual(mod.conditionsMConfig.selectRows({ cards: [] }), []);
  assert.deepEqual(mod.conditionsMConfig.selectRows({ cards: [{ provision_type: 'REPRESENTATION' }] }), []);
});

test('conditions-b config maps schema cards to buyer-side canonical present rows', () => {
  const rows = mod.conditionsBConfig.selectRows({
    cards: [
      card({
        id: 'rep',
        provision_subtype: 'COND-B-REP',
        short_title: 'Accuracy of Target Reps',
        primary_quote: 'The representations and warranties of the Company shall be true and correct.',
      }),
      card({
        id: 'cov',
        provision_subtype: 'COND-B-COV',
        short_title: 'Target Covenant Compliance',
        primary_quote: 'The Company shall have complied with its covenants in all material respects.',
      }),
      card({
        id: 'mae',
        provision_subtype: 'COND-B-MAE',
        short_title: 'No Target MAE',
        primary_quote: 'No Company Material Adverse Effect shall have occurred.',
      }),
    ],
  });
  const present = rows.filter((row) => row.present).map((row) => row.label);
  assert.deepEqual(present, [
    'Reps Bring-Down',
    'Covenant Performance',
    'No Material Adverse Effect',
  ]);
  assert.match(rows.find((row) => row.label === 'Covenant Performance').detail, /all material respects/);
});

test('conditions-s config maps schema cards to seller-side canonical present rows', () => {
  const rows = mod.conditionsSConfig.selectRows({
    cards: [
      card({
        id: 'parent-rep',
        provision_subtype: 'COND-S-REP',
        short_title: 'Accuracy of Parent Reps',
        primary_quote: 'The representations and warranties of Parent shall be true and correct.',
      }),
      card({
        id: 'parent-cov',
        provision_subtype: 'COND-S-COV',
        short_title: 'Parent Covenant Compliance',
        primary_quote: 'Parent shall have complied with its covenants in all material respects.',
      }),
      card({
        id: 'funds',
        provision_subtype: 'COND-S-FUNDS',
        short_title: 'Sufficient Funds',
        primary_quote: 'Parent shall have sufficient funds to consummate the Merger.',
      }),
    ],
  });
  const present = rows.filter((row) => row.present).map((row) => row.label);
  assert.deepEqual(present, [
    'Reps Bring-Down (Parent)',
    'Covenant Performance (Parent)',
    'No Material Adverse Effect (Parent)',
    'Financing / Sufficient Funds',
  ]);
  assert.match(rows.find((row) => row.label === 'No Material Adverse Effect (Parent)').detail, /Not found/);
  assert.match(rows.find((row) => row.label === 'Financing / Sufficient Funds').detail, /sufficient funds/);
});

// REBUILD-SPECS.md section 6 rebuild: ioc-exceptions.config.js now owns the
// FULL 24-card IOC family (TERM|RESTRICTION negative-covenant rows, an
// "Other restrictions" collapse for the near-empty [PROPOSED] Unclassified
// fragments, an Affirmative-covenants band, and a General-Exceptions FOOTER)
// instead of just the Target/Buyer general-exceptions preamble split. These
// tests exercise the exported row-building/render helpers directly (mirrors
// how conditions.config.js's own tests exercise conditionGroups()).
const iocPrimitives = {
  // `color` (standard-colors.js palette key) surfaced as a data-attribute so
  // FEEDBACK-3 round-3 tests can assert exactly which pills carry a graded
  // standard colour vs plain tone (I3/I5/G4).
  PillCell: ({ label, tone, color }) => React.createElement('span', { className: `pill ${tone || ''}`.trim(), 'data-color': color || undefined }, label),
  EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  CoverageFooter: ({ presentCount, totalCount, absentItems, label }) => React.createElement(
    'div',
    { 'data-testid': 'fake-coverage-footer' },
    `${presentCount} of ${totalCount} ${label}`,
    (absentItems || []).map((item) => item.label).join(', '),
  ),
};

test('isIocCard matches both COVENANT_INTERIM_OPERATING cards and any IOC-prefixed canonical code', () => {
  assert.equal(iocMod.isIocCard({ provision_type: 'COVENANT_INTERIM_OPERATING' }), true);
  assert.equal(iocMod.isIocCard({ provision_subtype: 'IOC-DIVIDEND' }), true);
  assert.equal(iocMod.isIocCard({ provision_subtype: 'IOC' }), true);
  assert.equal(iocMod.isIocCard({ provision_type: 'COVENANT_OTHER', provision_subtype: 'COV-ACCESS' }), false);
});

test('formatMoney always renders IOC dollarThreshold as currency, never a bare numeral', () => {
  assert.equal(iocMod.formatMoney(2000000), '$2,000,000');
  assert.equal(iocMod.formatMoney('2000000'), '$2,000,000');
  assert.equal(iocMod.formatMoney(null), null);
  assert.equal(iocMod.formatMoney(''), null);
});

test('formatMoney recovers the figure from a verbatim-only claim (Metsera 5.01(d): dollarThreshold has 0 canonical claims)', () => {
  // Citable-wrapper shape a legacy ai_metadata.features path could still hand
  // back when canonical extraction failed but a quote was captured.
  assert.equal(iocMod.formatMoney({ value: null, quotes: ['shall not exceed $2,000,000 in the aggregate'] }), '$2,000,000');
  // A longer verbatim sentence that slipped past Number() coercion.
  assert.equal(iocMod.formatMoney('shall not exceed $2,000,000 in the aggregate'), '$2,000,000');
});

test('ioc-exceptions config groups repeated cards sharing a canonical code into ONE negative-covenant row (Metsera: 3 IOC-MERGE cards)', () => {
  const cards = [
    { id: 'merge-1', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-MERGE', short_title: 'Mergers / Acquisitions / Dispositions', features: { restrictionComponents: ['ASSET_SALES_LICENSES'], permittedExceptions: [{ code: 'ORDINARY_COURSE', label: 'Ordinary course', text: 'ordinary course of business' }], mainObligation: 'The Company may not sell material assets.' } },
    { id: 'merge-2', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-MERGE', short_title: 'Mergers / Acquisitions / Dispositions', features: { restrictionComponents: ['ACQUISITIONS'], dollarThreshold: 2000000, mainObligation: 'The Company may not acquire a business over the threshold.' } },
    { id: 'merge-3', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-MERGE', short_title: 'Mergers / Acquisitions / Dispositions', features: { restrictionComponents: ['MERGE_DISSOLVE_RECAP'], mainObligation: 'The Company may not merge or consolidate.' } },
  ];
  const groups = iocMod.negativeCovenantGroups(cards);
  assert.equal(groups.length, 1, 'the 3 same-code cards must collapse into ONE row, not 3 duplicate rows');
  assert.equal(groups[0].code, 'IOC-MERGE');
  assert.equal(groups[0].cards.length, 3);
});

test('ioc-exceptions negative-covenant row renders restrictionComponents + dollarThreshold + permittedExceptions pills, with mainObligation always behind an always-collapsed see-text (never dumped inline)', () => {
  const cards = [
    { id: 'div-1', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-DIVIDEND', short_title: 'Dividends and Distributions', features: {
      restrictionComponents: ['ACQUISITIONS'],
      dollarThreshold: 2000000,
      permittedExceptions: [{ code: 'TAX_WITHHOLDING', label: 'Tax withholding or similar mandated actions', text: 'tax withholding' }],
      mainObligation: 'The Company may not declare or pay dividends or distributions.',
    } },
  ];
  const [group] = iocMod.negativeCovenantGroups(cards);
  const row = iocMod.renderNegativeRow({ id: 'ioc-neg-IOC-DIVIDEND', code: group.code, cards: group.cards }, { primitives: iocPrimitives });
  assert.equal(row.id, 'ioc-neg-IOC-DIVIDEND');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  assert.match(html, /Acquisitions \/ business combinations/, 'restrictionComponents pill resolves via the IOC_CATEGORY taxonomy');
  assert.match(html, /\$2,000,000/, 'dollarThreshold renders as currency');
  assert.match(html, /Tax withholding/, 'permittedExceptions pill');
  // r9: the clause text rides row.seeTextContent — GroupedSubRows renders
  // the "See provision" toggle in the LEFT column with a full-width
  // expansion row; it is never inline in the content cell.
  assert.doesNotMatch(html, /<details/, 'no inline <details> in the content cell');
  assert.match(String(row.seeTextContent), /may not declare or pay dividends/);
});

test('ioc-exceptions config promotes each [PROPOSED] Unclassified fragment to its own named "Other restrictions" row (Ben r6: no "(N fragments)" bundle)', () => {
  const cards = [
    { id: 'frag-1', provision_type: 'COVENANT_INTERIM_OPERATING', features: { sectionNumber: '5.01(i)', restrictionComponents: ['INDEBTEDNESS', 'THIRD_PARTY_OBLIGATIONS'] } },
    { id: 'frag-2', provision_type: 'COVENANT_INTERIM_OPERATING', features: { sectionNumber: '5.01(k)' } },
    { id: 'real', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-DIVIDEND', short_title: 'Dividends and Distributions', features: { mainObligation: 'x' } },
  ];
  const fragments = iocMod.fragmentCards(cards);
  assert.equal(fragments.length, 2, 'only the two no-code fragments, not the named IOC-DIVIDEND card');
  const rows = iocMod.buildOtherRestrictionsRows(fragments, { primitives: iocPrimitives });
  assert.equal(rows.length, 2, 'one row per fragment, never a single bundle row');
  assert.equal(rows[0].card, fragments[0], 'each row wires its own card for the sidebar');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows.map((r, i) => React.createElement('div', { key: i }, r.label, r.children))));
  assert.doesNotMatch(html, /fragments\)/, 'no "(N fragments)" bundle label anywhere');
  assert.match(html, /Indebtedness \/ financing/, 'tagged fragment renders its restrictionComponents pills');
  assert.match(html, /5\.01\(k\)/, 'the untagged, unquotable fragment still surfaces as its own row named by section');
});

test('ioc-exceptions config renders IOC-ORDINARY/PRESERVE/MAINTAIN as an Affirmative-covenants band with appliesTo scope pills', () => {
  const cards = [
    { id: 'ord', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-ORDINARY', short_title: 'Ordinary Course Obligation', features: { ordinaryCourseCarveout: true, positiveObligations: { appliesTo: ['BUSINESS'], obligation: 'conduct its business in the ordinary course' } } },
    { id: 'pres', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-PRESERVE', short_title: 'Preservation of Business Relationships', features: { positiveObligations: { appliesTo: ['SUPPLIERS', 'LICENSORS_LICENSEES'], obligation: 'preserve relationships with suppliers and licensors' } } },
    { id: 'neg', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-DIVIDEND', short_title: 'Dividends and Distributions', features: { mainObligation: 'x' } },
  ];
  const rows = iocMod.affirmativeRows(cards, { primitives: iocPrimitives });
  assert.equal(rows.length, 2, 'one row per affirmative limb, the negative-covenant card excluded');
  const ordinaryHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, rows[0].children));
  assert.match(ordinaryHtml, /Ordinary-course carve-out applies/);
  const preserveHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, rows[1].children));
  assert.match(preserveHtml, /Suppliers/);
  assert.match(preserveHtml, /Licensors/);
});

// FEEDBACK-2-PUNCHLIST.md #29: old site rendered IocAffirmativeCovenantsTable
// ABOVE IocNegativeCovenantsTable -- the rebuilt table's group order must
// match (Affirmative first, Negative second, the near-empty fragments'
// "Other restrictions" band last), not bury the affirmative limbs at the
// bottom.
test('ioc-exceptions config body renders Affirmative covenants FIRST, then Exceptions, then Negative covenants, then Other restrictions', () => {
  const reviewDeal = {
    cards: [
      { id: 'div-1', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-DIVIDEND', short_title: 'Dividends and Distributions', features: { mainObligation: 'The Company may not declare dividends.' } },
      { id: 'frag-k', provision_type: 'COVENANT_INTERIM_OPERATING', features: { sectionNumber: '5.01(k)' } },
      { id: 'ord', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-ORDINARY', short_title: 'Ordinary Course Obligation', features: { positiveObligations: { appliesTo: ['BUSINESS'], obligation: 'conduct its business in the ordinary course' } } },
      { id: 'ge', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-GENERAL-EXCEPTIONS', features: {
        permittedExceptions: [{ code: 'REQUIRED_BY_LAW', label: 'As required by law', text: 'as required by applicable Law' }],
      } },
    ],
  };
  const GroupedSubRows = ({ groups }) => React.createElement(
    'div',
    null,
    groups.filter((g) => g.rows.length).map((g) => React.createElement('div', { key: g.id, 'data-group': g.id }, g.label)),
  );
  const rows = iocMod.iocExceptionsConfig.selectRows(reviewDeal);
  const bodyColumn = iocMod.iocExceptionsConfig.columns.find((column) => column.id === 'body');
  const html = renderToStaticMarkup(bodyColumn.renderCell(rows[0], { primitives: { ...iocPrimitives, GroupedSubRows } }));
  const affIdx = html.indexOf('Affirmative covenants');
  const excIdx = html.indexOf('>Exceptions<');
  const negIdx = html.indexOf('Negative covenants');
  const otherIdx = html.indexOf('Other restrictions');
  assert.ok(affIdx >= 0 && excIdx >= 0 && negIdx >= 0 && otherIdx >= 0, 'all four bands render when all four kinds of card are present');
  assert.ok(affIdx < excIdx, 'Affirmative covenants band renders before the Exceptions band');
  assert.ok(excIdx < negIdx, 'the Exceptions band renders before Negative covenants -- the reader sees the chapeau carve-outs before the enumerated restrictions they qualify');
  assert.ok(negIdx < otherIdx, 'Negative covenants band renders before Other restrictions');
});

// FIX (General Exceptions showing only 1 of N): the section-wide carve-outs
// used to surface ONLY through the bottom CoverageFooter strip, which just
// printed a bare "N of 4" COUNT and never listed the present items (only the
// absent ones, behind a details) -- so all 4 distinct Metsera carve-outs
// collapsed to that one summary line. They now render as real pills in the
// body's dedicated "Exceptions" group (buildIocExceptionsRows), positioned
// right after Affirmative covenants; the footer is left carrying only the
// unrelated "required-by-law carve-out" note.
test('ioc-exceptions config selectRows returns rows only when IOC cards exist, and renders the General Exceptions preamble as its own Exceptions group (not a per-row entry)', () => {
  const emptyDeal = { cards: [{ id: 'rep', provision_type: 'REPRESENTATION' }] };
  assert.deepEqual(iocMod.iocExceptionsConfig.selectRows(emptyDeal), []);

  const reviewDeal = {
    cards: [
      { id: 'ge', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-GENERAL-EXCEPTIONS', features: {
        permittedExceptions: [
          { code: 'COMPANY_DISCLOSURE_LETTER', label: 'As disclosed', text: 'except as set forth in the Company Disclosure Letter' },
          { code: 'PRIOR_WRITTEN_CONSENT', label: 'With consent', text: 'with Parent consent' },
          { code: 'REQUIRED_BY_AGREEMENT', label: 'As contemplated by this Agreement', text: 'otherwise expressly required by this Agreement' },
          { code: 'REQUIRED_BY_LAW', label: 'As required by law', text: 'as required by applicable Law' },
        ],
        requiredByLawCarveout: true,
      } },
    ],
  };
  const rows = iocMod.iocExceptionsConfig.selectRows(reviewDeal);
  assert.equal(rows.length, 1, 'selectRows returns a single synthetic body row -- the grouped table is rebuilt at render time (same contract as conditions.config.js)');
  assert.equal(rows[0].reviewDeal, reviewDeal);

  const exceptionsRows = iocMod.buildIocExceptionsRows(reviewDeal.cards, { primitives: iocPrimitives });
  assert.equal(exceptionsRows.length, 1, 'a lone positive-side preamble (no negative-side card) renders one row');
  const bodyHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, exceptionsRows.map((r) => r.children)));
  assert.match(bodyHtml, /As disclosed/, 'COMPANY_DISCLOSURE_LETTER renders');
  assert.match(bodyHtml, /With consent/, 'PRIOR_WRITTEN_CONSENT renders');
  assert.match(bodyHtml, /As contemplated by this Agreement/, 'REQUIRED_BY_AGREEMENT renders -- must NOT be aliased into COMPANY_DISCLOSURE_LETTER');
  assert.match(bodyHtml, /As required by law/, 'REQUIRED_BY_LAW renders');

  // Ben (Mergertrace round 1): the standalone footer pill was a redundant
  // display of the REQUIRED_BY_LAW carve-out the Exceptions band already
  // shows ("As required by law" pill above) — the footer now renders nothing.
  const footer = iocMod.renderIocFooter(rows, { primitives: iocPrimitives });
  assert.equal(footer, null);
});

// Metsera: the SAME 4 carve-outs are extracted on both the positive-side
// preamble (IOC-GENERAL-EXCEPTIONS) and the negative-side preamble
// (IOC-NEGATIVE-PREAMBLE), with slightly different verbatim quotes -- the two
// sides must collapse into ONE shared row (detected by comparing code SETS,
// not quote text), not render as two duplicate lists.
test('ioc-exceptions config renders ONE shared Exceptions row when the affirmative and negative preambles carry the same code set', () => {
  const cards = [
    { id: 'ge', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-GENERAL-EXCEPTIONS', features: {
      permittedExceptions: [
        { code: 'COMPANY_DISCLOSURE_LETTER', label: 'As disclosed', text: 'matters set forth in Section 5.01 of the Company Disclosure Letter' },
        { code: 'REQUIRED_BY_AGREEMENT', label: 'As contemplated by this Agreement', text: 'otherwise expressly required by this Agreement' },
        { code: 'REQUIRED_BY_LAW', label: 'As required by law', text: 'required by applicable Law' },
        { code: 'PRIOR_WRITTEN_CONSENT', label: "With Parent's consent", text: 'with the prior written consent of Parent' },
      ],
    } },
    { id: 'neg-pre', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-NEGATIVE-PREAMBLE', features: {
      permittedExceptions: [
        { code: 'COMPANY_DISCLOSURE_LETTER', label: 'As disclosed', text: 'matters set forth in Section 5.01 of the Company Disclosure Letter' },
        { code: 'REQUIRED_BY_AGREEMENT', label: 'As contemplated by this Agreement', text: 'otherwise expressly required by this Agreement' },
        { code: 'REQUIRED_BY_LAW', label: 'As required by law', text: 'required by applicable Law' },
        { code: 'PRIOR_WRITTEN_CONSENT', label: "With Parent's consent", text: 'without the prior written consent of Parent' },
      ],
    } },
  ];
  const rows = iocMod.buildIocExceptionsRows(cards, { primitives: iocPrimitives });
  assert.equal(rows.length, 1, 'equal code sets on both sides collapse to a single shared row, not two duplicate rows');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows[0].label, rows[0].children));
  assert.match(html, /applies to affirmative (&amp;|&) negative covenants/i);
  assert.match(html, /As disclosed/);
  assert.match(html, /As contemplated by this Agreement/);
  assert.match(html, /As required by law/);
  assert.match(html, /With Parent(&#x27;|')s consent/);
});

test('ioc-exceptions config renders TWO Exceptions rows when the affirmative and negative preambles carry genuinely different code sets', () => {
  const cards = [
    { id: 'ge', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-GENERAL-EXCEPTIONS', features: {
      permittedExceptions: [{ code: 'REQUIRED_BY_LAW', label: 'As required by law', text: 'as required by applicable Law' }],
    } },
    { id: 'neg-pre', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-NEGATIVE-PREAMBLE', features: {
      permittedExceptions: [{ code: 'PRIOR_WRITTEN_CONSENT', label: 'With consent', text: 'with Parent consent' }],
    } },
  ];
  const rows = iocMod.buildIocExceptionsRows(cards, { primitives: iocPrimitives });
  assert.equal(rows.length, 2, 'genuinely different code sets render as two distinct rows');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows.map((r) => React.createElement(React.Fragment, { key: r.id }, r.label, r.children))));
  assert.match(html, /Exceptions to affirmative covenants/);
  assert.match(html, /Exceptions to negative covenants/);
  assert.match(html, /As required by law/);
  assert.match(html, /With consent/);
});

// FEEDBACK-3-PUNCHLIST.md #I6: negative covenants must render as a real
// THREE-COLUMN table (General category / Specific restrictions / Exceptions)
// instead of cramming scope + exceptions into one cell.
test('I6: ioc-exceptions negative-covenant row renders Specific restrictions and Exceptions as distinct sub-columns', () => {
  const cards = [
    { id: 'merge-1', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-MERGE', short_title: 'Mergers / Acquisitions / Dispositions', features: {
      restrictionComponents: ['ASSET_SALES_LICENSES'],
      permittedExceptions: [{ code: 'ORDINARY_COURSE', label: 'Ordinary course', text: 'ordinary course of business' }],
      mainObligation: 'The Company may not sell material assets.',
    } },
  ];
  const [group] = iocMod.negativeCovenantGroups(cards);
  const row = iocMod.renderNegativeRow({ id: 'ioc-neg-IOC-MERGE', code: group.code, cards: group.cards }, { primitives: iocPrimitives });
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  const restrictionsIdx = html.indexOf('Specific restrictions');
  const exceptionsIdx = html.indexOf('Exceptions');
  const restrictionPillIdx = html.indexOf('Asset sales');
  const exceptionPillIdx = html.indexOf('Ordinary course');
  assert.ok(restrictionsIdx >= 0 && exceptionsIdx >= 0, 'both sub-column headings render');
  assert.ok(restrictionsIdx < exceptionPillIdx, 'the Specific-restrictions heading precedes the Exceptions pill');
  assert.ok(restrictionsIdx < restrictionPillIdx && restrictionPillIdx < exceptionsIdx, 'the restriction pill renders inside the Specific-restrictions sub-column, not mixed with Exceptions');
  assert.ok(exceptionsIdx < exceptionPillIdx, 'the exception pill renders after the Exceptions heading');
});

test('I6: an empty restrictions or exceptions sub-column renders an honest placeholder, not a blank cell', () => {
  const cards = [
    { id: 'div-1', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-DIVIDEND', short_title: 'Dividends and Distributions', features: {
      restrictionComponents: ['ACQUISITIONS'],
      mainObligation: 'The Company may not declare dividends.',
    } },
  ];
  const [group] = iocMod.negativeCovenantGroups(cards);
  const row = iocMod.renderNegativeRow({ id: 'ioc-neg-IOC-DIVIDEND', code: group.code, cards: group.cards }, { primitives: iocPrimitives });
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  assert.match(html, /None specified/, 'no permittedExceptions -> the Exceptions sub-column says so honestly');
});

// FEEDBACK-3-PUNCHLIST.md #I2/#I4/#I3/#I5 (G4 colouring audit): affirmative
// limbs surface their OWN efforts_standard as a coloured pill, "in all
// material respects" is pulled out of the obligation text as its own
// coloured pill, and the FLAT ordinary-course limb gets no colour at all.
test('I4: IOC-PRESERVE surfaces its efforts_standard (COMMERCIALLY_REASONABLE_EFFORTS) as a coloured standard pill', () => {
  const cards = [
    { id: 'pres', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-PRESERVE', short_title: 'Preservation of Business Relationships', features: {
      positiveObligations: [{
        appliesTo: ['SUPPLIERS', 'LICENSORS_LICENSEES'],
        obligation: 'preserve its present relationships with suppliers and licensors',
        efforts_standard: 'COMMERCIALLY_REASONABLE_EFFORTS',
      }],
    } },
  ];
  const rows = iocMod.affirmativeRows(cards, { primitives: iocPrimitives });
  assert.equal(rows.length, 1);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows[0].children));
  assert.match(html, /Commercially reasonable efforts/);
  assert.match(html, /data-color="amber"/, 'the efforts standard earns a palette colour (the efforts-ladder amber)');
});

test('I2: IOC-MAINTAIN pulls "in all material respects" out of the obligation TEXT as its own coloured pill, even though efforts_standard is FLAT', () => {
  const cards = [
    { id: 'maintain', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-MAINTAIN', short_title: 'Maintain Business Organization and Material Assets', features: {
      positiveObligations: [{
        appliesTo: ['BUSINESS_ORGANIZATION', 'ASSETS'],
        obligation: 'maintain its material assets and business organization intact in all material respects',
        efforts_standard: 'FLAT',
      }],
    } },
  ];
  const rows = iocMod.affirmativeRows(cards, { primitives: iocPrimitives });
  assert.equal(rows.length, 1);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows[0].children));
  assert.match(html, /In all material respects/, 'the materiality phrase is pulled out of the obligation text as a pill');
  assert.match(html, /data-color="sky"/, 'materiality standards use the accuracy/materiality palette colour');
  assert.doesNotMatch(html, /Flat \(unqualified obligation\)/, 'FLAT itself never renders as a pill label');
});

test('I3/I5: the plain ordinary-course limb (FLAT, no "material respects" text) never gets a standard colour', () => {
  const cards = [
    { id: 'ord', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-ORDINARY', short_title: 'Ordinary Course Obligation', features: {
      ordinaryCourseCarveout: true,
      positiveObligations: [{
        appliesTo: ['BUSINESS'],
        obligation: 'conduct its business in the ordinary course',
        efforts_standard: 'FLAT',
      }],
    } },
  ];
  const rows = iocMod.affirmativeRows(cards, { primitives: iocPrimitives });
  assert.equal(rows.length, 1);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows[0].children));
  assert.doesNotMatch(html, /data-color=/, 'no pill on the ordinary-course row carries a standard colour -- it IS the ordinary course, not a graded standard');
  assert.match(html, /Ordinary-course carve-out applies/, 'the carve-out fact still renders, just uncoloured');
});

// FEEDBACK-3-PUNCHLIST.md #I7: the "[PROPOSED] Unclassified" 5.01(k)/(l)/(o)
// fragments are a genuine extraction gap (no restrictionComponents tag) but
// their clause text is in primary_quote -- named instead of dropped or shown
// as a bare, signal-free fragment.
test('I7: unclassified fragments with no restrictionComponents tag are named from their own primary_quote (tax / Specified-Contract / insurance), never dropped', () => {
  const fragments = [
    { id: 'frag-k', provision_type: 'COVENANT_INTERIM_OPERATING', primary_quote: 'make or change any material Tax election, change any annual Tax accounting period, or settle any material Tax liability', features: { sectionNumber: '5.01(k)' } },
    { id: 'frag-l', provision_type: 'COVENANT_INTERIM_OPERATING', primary_quote: 'amend, modify or waive any material provision of any Specified Contract', features: { sectionNumber: '5.01(l)' } },
    { id: 'frag-o', provision_type: 'COVENANT_INTERIM_OPERATING', primary_quote: 'fail to maintain in effect its existing insurance policies', features: { sectionNumber: '5.01(o)' } },
  ];
  const rows = iocMod.buildOtherRestrictionsRows(fragments, { primitives: iocPrimitives });
  assert.equal(rows.length, 3, 'one row per fragment');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows.map((r, i) => React.createElement('div', { key: i }, r.label, r.children))));
  assert.match(html, /Tax matters/, '5.01(k) named as a tax covenant');
  assert.match(html, /Specified-contract amendments/, '5.01(l) named as a Specified-Contract amendment restriction');
  assert.match(html, /Insurance maintenance/, '5.01(o) named as an insurance-maintenance covenant');
});

test('I7: sniffFragmentName returns null (never a fabricated name) when the fragment carries no primary_quote to sniff', () => {
  assert.equal(iocMod.sniffFragmentName({ id: 'frag-x', features: { sectionNumber: '5.01(m)' } }), null);
});

// FEEDBACK-4-PUNCHLIST.md #I8: real Metsera cards for the unclassified
// 5.01(i)-(o) fragments carry short_title="[PROPOSED] Unclassified" and a
// pipe-delimited section_ref ("5.01(k) | [PROPOSED] Unclassified | <hash>"),
// not the features.sectionNumber shape the I7 fixtures above use. All 8
// sub-clauses must resolve a real title off section_ref, and none may ever
// render the literal short_title.
test('I8: all 8 unclassified 5.01(i)-(o) fragments resolve a readable title from section_ref, never the literal short_title', () => {
  const letters = ['i', 'ii', 'j', 'k', 'l', 'm', 'n', 'o'];
  const expected = {
    i: 'Indebtedness',
    ii: 'Debt securities issuance',
    j: 'Capital expenditures',
    k: 'Tax elections / Tax accounting',
    l: 'Specified Contracts',
    m: 'Litigation settlements',
    n: 'Prepayment of indebtedness',
    o: 'Insurance maintenance',
  };
  const fragments = letters.map((letter) => ({
    id: `frag-501-${letter}`,
    provision_type: 'COVENANT_INTERIM_OPERATING',
    short_title: '[PROPOSED] Unclassified',
    section_ref: `5.01(${letter}) | [PROPOSED] Unclassified | hash-${letter}`,
    primary_quote: `(${letter}) some clause text`,
    features: {},
  }));

  for (const card of fragments) {
    assert.equal(iocMod.section501SubclauseTitle(card), expected[card.section_ref.match(/5\.01\(([a-z]+)\)/i)[1]]);
    assert.equal(iocMod.resolveFragmentName(card), expected[card.section_ref.match(/5\.01\(([a-z]+)\)/i)[1]]);
  }

  const rows = iocMod.buildOtherRestrictionsRows(fragments, { primitives: iocPrimitives });
  assert.equal(rows.length, 8, 'all 8 sub-clauses surface as individual rows');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows.map((r, i) => React.createElement('div', { key: i }, r.label, r.children))));
  assert.doesNotMatch(html, /\[PROPOSED\] Unclassified/, 'no IOC fragment row ever renders the literal "[PROPOSED] Unclassified" short_title');
  assert.match(html, /Tax elections \/ Tax accounting/, '5.01(k) renders as a Tax-related title');
  for (const label of Object.values(expected)) {
    assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} renders as its own Other-restrictions row`);
  }
});

test('I8: an unmapped 5.01 sub-clause letter falls back to a quote-mined title, never the literal short_title', () => {
  const card = {
    id: 'frag-501-z',
    provision_type: 'COVENANT_INTERIM_OPERATING',
    short_title: '[PROPOSED] Unclassified',
    section_ref: '5.01(z) | [PROPOSED] Unclassified | hash-z',
    primary_quote: '(z) enter into any new line of business outside the ordinary course, without the prior written consent of Parent',
    features: {},
  };
  assert.equal(iocMod.section501SubclauseTitle(card), null, 'letter z is not in the deterministic map');
  const resolved = iocMod.resolveFragmentName(card);
  assert.ok(resolved, 'a title is still resolved');
  assert.notEqual(resolved, '[PROPOSED] Unclassified');
  assert.match(resolved, /new line of business/i);
});

test('material-contracts config maps hydrated buckets and thresholds, one row per contract type, no mid-table coverage row', () => {
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote: 'Material Contracts are listed.',
      features: {
        materialContractsBuckets: [
          { code: 'AGGREGATE_PAYMENTS', label: 'Aggregate payments', threshold: '$25,000,000', text: 'contracts involving aggregate payments over $25,000,000' },
          { code: 'INDEBTEDNESS', label: 'Indebtedness', text: 'contracts evidencing indebtedness' },
        ],
        materialContractsDollarThresholds: [{ bucket: 'INDEBTEDNESS', threshold: '$5,000,000' }],
      },
    }],
  });
  // No synthetic rollup/coverage row mixed into the row list -- every row is
  // a real contract-type bucket.
  assert.ok(!rows.some((row) => row.rollup), 'selectRows must not prepend a mid-table coverage row');
  assert.deepEqual(rows.map((row) => row.label), [
    'Contracts above an aggregate-payments threshold',
    'Indebtedness contracts',
  ]);
  assert.deepEqual(rows.map((row) => row.threshold), ['$25,000,000', '$5,000,000']);
});

test('material-contracts config falls back to canonical bucket synonyms in card text; each detected bucket is exactly one row (no cross-listing)', () => {
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote: 'Material Contracts include any credit agreement, joint venture agreement, and contract research organization agreement.',
    }],
  });
  assert.ok(rows.some((row) => row.label === 'Indebtedness contracts'));
  assert.ok(rows.some((row) => row.label === 'Joint ventures / partnerships'));
  assert.ok(rows.some((row) => row.label === 'Clinical research organization contracts'));
  // Ben's dedup fix: the old renderer nested every co-occurring bucket under
  // EACH OTHER row's cell (alsoCovered), so a single card mentioning three
  // types rendered each title multiple times. The new row shape carries no
  // such cross-listing field -- each bucket is its own row, once.
  assert.ok(!('alsoCovered' in rows[0]), 'rows must not carry a cross-listing alsoCovered field');
  assert.equal(rows.filter((row) => row.label === 'Indebtedness contracts').length, 1);
});

test('material-contracts render cells: one pill per row (title once), threshold and evidence primitives', () => {
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote: 'Material Contracts include credit agreements and joint venture agreements.',
      features: {
        materialContractsBuckets: [
          { code: 'INDEBTEDNESS', label: 'Indebtedness', text: 'credit agreements and joint venture agreements' },
        ],
        materialContractsDollarThresholds: [{ bucket: 'INDEBTEDNESS', threshold: '$5,000,000' }],
      },
    }],
  });
  const bucketColumn = materialContractsMod.materialContractsConfig.columns.find((column) => column.id === 'bucket');
  const thresholdColumn = materialContractsMod.materialContractsConfig.columns.find((column) => column.id === 'threshold');
  const evidenceColumn = materialContractsMod.materialContractsConfig.columns.find((column) => column.id === 'evidence');
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence, className }) => React.createElement('span', { 'data-evidence': evidence, className }, children),
  };
  const bucketHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, bucketColumn.renderCell(rows[0], { primitives })));
  assert.equal((bucketHtml.match(/Indebtedness contracts/g) || []).length, 1, 'the contract-type title renders exactly once');
  const thresholdHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, thresholdColumn.renderCell(rows[0], { primitives })));
  // MC2: threshold renders through EvidenceHoverSource in the agreement's
  // normal body font, never the mono/code style.
  assert.match(thresholdHtml, /\$5,000,000/);
  assert.doesNotMatch(thresholdHtml, /font-mono/);
  const evidenceHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, evidenceColumn.renderCell(rows[0], { primitives })));
  assert.match(evidenceHtml, /data-evidence="credit agreements and joint venture agreements"/);
});

test('material-contracts coverage footer reports "N of M contract-type buckets covered" and lists the not-covered buckets, via config.renderFooter (not a mid-table row)', () => {
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote: 'Material Contracts are listed.',
      features: {
        materialContractsBuckets: [
          { code: 'AGGREGATE_PAYMENTS', label: 'Aggregate payments', text: 'aggregate payments contracts' },
          { code: 'INDEBTEDNESS', label: 'Indebtedness', text: 'indebtedness contracts' },
        ],
      },
    }],
  });
  assert.equal(typeof materialContractsMod.materialContractsConfig.renderFooter, 'function');
  const primitives = {
    CoverageFooter: ({ presentCount, totalCount, absentItems, label }) => React.createElement(
      'div',
      { 'data-testid': 'coverage-footer' },
      `${presentCount} of ${totalCount} ${label}`,
      React.createElement('div', { className: 'absent' }, (absentItems || []).map((item) => item.label).join(' | ')),
    ),
  };
  const footerHtml = renderToStaticMarkup(React.createElement(
    React.Fragment,
    null,
    materialContractsMod.materialContractsConfig.renderFooter(rows, { primitives }),
  ));
  assert.match(footerHtml, /2 of \d+ contract-type buckets covered/);
  // The two present buckets are not in the absent list; an untouched
  // canonical bucket (never mentioned in the fixture) is.
  assert.ok(!footerHtml.includes('Contracts above an aggregate-payments threshold'));
  assert.match(footerHtml, /Joint ventures \/ partnerships/);
});

test('material-contracts config (MC1): with no structured threshold data, a bucket whose own text carries an isolatable $ figure gets it regex-mined rather than falling back', () => {
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote: 'Material Contracts include any credit agreement providing for indebtedness in excess of $2,000,000.',
      features: {
        materialContractsBuckets: [
          { code: 'INDEBTEDNESS', label: 'Indebtedness', text: 'any credit agreement providing for indebtedness in excess of $2,000,000' },
        ],
        // No materialContractsDollarThresholds -- the real-world shape: the
        // extraction never populates a structured threshold. MC1's fix is a
        // targeted regex, anchored to the bucket's own taxonomy synonym
        // ("indebtedness" / "credit agreement"), that recovers the $ figure
        // from the raw quote text instead of giving up.
      },
    }],
  });
  const row = rows.find((r) => r.code === 'INDEBTEDNESS');
  assert.ok(row);
  assert.equal(row.threshold, '$2,000,000');
  assert.match(row.evidence, /\$2,000,000/);
});

test('material-contracts config (MC3): a bucket whose own clause carries NO $ figure honestly falls back to "Any" (type-based, no dollar floor) instead of borrowing a neighboring clause\'s number or showing "see text"', () => {
  // Two-clause blob styled like real merger-agreement "Specified Contract"
  // enumerations: clause (i) names a bucket with no dollar figure of its
  // own (joint ventures), clause (ii) names a different bucket that does
  // carry one (indebtedness, $2,000,000). A naive "nearest $ anywhere in
  // the blob" search would misattribute $2,000,000 to the JV clause too --
  // the per-bucket, clause-anchored mining must not do that.
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote: '(i) each joint venture or partnership agreement to which the Company is a party; (ii) each contract evidencing indebtedness in excess of $2,000,000;',
    }],
  });
  const jvRow = rows.find((r) => r.code === 'JV_PARTNERSHIPS');
  const debtRow = rows.find((r) => r.code === 'INDEBTEDNESS');
  assert.ok(jvRow);
  assert.ok(debtRow);
  assert.equal(jvRow.threshold, 'Any');
  assert.equal(debtRow.threshold, '$2,000,000');
});

test('material-contracts config (MC1, data-grounded): mines per-bucket $ thresholds from a Metsera-shaped numbered "Specified Contract" list, matching the live card\'s clause structure', () => {
  // Trimmed, faithful excerpt of the shape found on the live Metsera
  // "Material Contracts" card (deal 885edae5-49e8-464a-9f33-edd229119d7c,
  // section 3.13) -- a numbered list of Specified Contract clauses where
  // multiple buckets share the same $2,000,000 figure in different
  // clauses, one bucket (indebtedness) carries a distinct $500,000, and one
  // clause (exclusivity/MFN) has no $ figure at all.
  const primary_quote = '(ii) each Contract that (A) materially restricts the ability of the Company to compete in any business, ' +
    '(B) requires the Company to conduct business on a "most favored nations" basis, or (C) provides for "exclusivity"; ' +
    '(vi) each Contract for the purchase, sale or lease of goods or services under which payments in excess of $2,000,000 were made; ' +
    '(x) each Contract relating to indebtedness with an outstanding principal amount in excess of $500,000; ' +
    '(xvii) each Contract which provides for a loan or advance in excess of $50,000 to any employee.';
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote,
    }],
  });
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r.threshold]));
  assert.equal(byCode.SUPPLY, '$2,000,000');
  assert.equal(byCode.INDEBTEDNESS, '$500,000');
  assert.equal(byCode.EMPLOYEE_LOANS, '$50,000');
  // Exclusivity/MFN's own clause has no $ figure and no non-dollar
  // quantitative test either -- it's type-based ("any Contract that
  // provides for exclusivity..."), so it must honestly read "Any", never
  // pick up a neighboring clause's $2,000,000 / $500,000, and never show a
  // bare "see text".
  assert.equal(byCode.EXCLUSIVITY_MFN, 'Any');
});

test('material-contracts config (MC3): non-dollar quantitative gates ("top N") render as a short described test, not "Any" and not a bare "see text"', () => {
  const primary_quote = '(vi) each supplier contract with any of the top 20 suppliers by aggregate purchase volume; ' +
    '(xii) each Contract that provides for "exclusivity" or any similar requirement in favor of any third party; ' +
    '(xxi) each partnership or joint venture agreement to which the Company is a party.';
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote,
    }],
  });
  const supplyRow = rows.find((r) => r.code === 'SUPPLY');
  assert.ok(supplyRow);
  assert.equal(supplyRow.threshold, 'Top 20');
  // Exclusivity/MFN in this same blob has no $ figure and no top-N/% test
  // of its own -- still "Any", never "see text".
  const exclusivityRow = rows.find((r) => r.code === 'EXCLUSIVITY_MFN');
  assert.ok(exclusivityRow);
  assert.equal(exclusivityRow.threshold, 'Any');
});

test('material-contracts config (MC2): a mined dollar figure with no source commas still renders comma-formatted', () => {
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote: 'Material Contracts include any credit agreement providing for indebtedness in excess of $2000000.',
    }],
  });
  const debtRow = rows.find((r) => r.code === 'INDEBTEDNESS');
  assert.ok(debtRow);
  assert.equal(debtRow.threshold, '$2,000,000', 'mined figure with no source commas must still render comma-formatted');
});

test('material-contracts config (MC2): a bare-digit structured threshold renders as currency, not a raw number', () => {
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote: 'Material Contracts are listed.',
      features: {
        materialContractsBuckets: [
          { code: 'REAL_ESTATE', label: 'Real estate', text: 'any lease with annual payments in excess of $500,000', threshold: 500000 },
        ],
      },
    }],
  });
  const leaseRow = rows.find((r) => r.code === 'REAL_ESTATE');
  assert.ok(leaseRow);
  assert.equal(leaseRow.threshold, '$500,000', 'a bare-digit structured threshold must render as currency, not "500000"');
});

test('material-contracts config (MC3): zero rows render a bare "see text" threshold, across a full Metsera-shaped bucket list', () => {
  const primary_quote = '(i) each\nContract that would be required to be filed by the Company as a "material contract" pursuant to Item 601(b)(10) of Regulation S-K under the Securities Act; ' +
    '(ii) each Contract to which the Company is a party that (A) materially restricts the ability of the Company to compete in any business, (B) requires the Company to conduct business on a "most favored nations" basis, or (C) provides for "exclusivity"; ' +
    '(vii) each Contract that is a "single source" Contract relating to the procurement of materials or services; ' +
    '(xii) each Contract containing a right of first refusal, right of first negotiation or right of first offer with respect to any equity interest or material assets of the Company; ' +
    '(xiii) each government contract to which the Company or any Company Subsidiary is a party; ' +
    '(xvi) each hedging, swap, collar, cap, derivative or similar Contract; ' +
    '(xxi) each partnership or joint venture agreement to which the Company is a party.';
  const rows = materialContractsMod.materialContractsConfig.selectRows({
    cards: [{
      id: 'material-contracts',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      short_title: 'Material Contracts',
      primary_quote,
    }],
  });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => !/see text/i.test(row.threshold)), `no row may render "see text": ${JSON.stringify(rows.map((r) => [r.code, r.threshold]))}`);
  const typeBasedCodes = ['SEC_ITEM_601', 'SINGLE_SOURCE', 'ROFR_ROFN', 'GOVERNMENT_CONTRACTS', 'HEDGING', 'JV_PARTNERSHIPS'];
  for (const code of typeBasedCodes) {
    const row = rows.find((r) => r.code === code);
    assert.ok(row, `expected a ${code} row`);
    assert.equal(row.threshold, 'Any', `${code} is type-based with no dollar floor -- must read "Any"`);
  }
});

test('tail-fee config maps nested tailProvision mechanics', () => {
  const rows = tailFeeMod.tailFeeConfig.selectRows({
    cards: [{
      id: 'tail',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-TAIL',
      primary_quote: 'If within 12 months the Company enters into a Company Takeover Proposal, the Company shall pay the fee.',
      features: {
        tailProvision: {
          period_months: 12,
          threshold_percentage: 50,
          triggers: ['Outside date termination followed by a Company Takeover Proposal'],
        },
        tailFeeSameProposalRequired: false,
      },
    }],
  });
  // Punchlist #40: the trigger-scope row no longer branches on
  // tailFeeSameProposalRequired's same-vs-any framing (that framing doesn't
  // match how a tail fee actually works) -- it always states the correct
  // mechanic: any qualifying transaction, signed by the end of the window.
  // Punchlist TF1/TF2 (round 3): the arming row's value is now an array of
  // short scenario labels (one per pill), and the trigger-scope row is one
  // short, clear statement instead of the old verbose paragraph.
  assert.deepEqual(rows.map((row) => row.value), [
    '12 months',
    '50%',
    ['Outside date termination followed by a Company Takeover Proposal'],
    'Any qualifying transaction signed within the tail period',
  ]);
});

test('tail-fee config falls back to tail language in card text', () => {
  const rows = tailFeeMod.tailFeeConfig.selectRows({
    cards: [{
      id: 'tail',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-TARGET',
      primary_quote: 'If within 9 months after termination the Company consummates a Takeover Proposal for 50% or more of its equity, the Company shall pay Parent the fee.',
    }],
  });
  assert.equal(rows.find((row) => row.id === 'tail-window').value, '9 months');
  assert.equal(rows.find((row) => row.id === 'tail-threshold').value, '50%');
});

test('termination fee and expense configs expose primitive-backed signals', () => {
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
    TruncatedWithSeeText: ({ text, evidence }) => React.createElement('span', { 'data-evidence': evidence }, text),
  };
  const terminationRows = terminationFeesMod.terminationFeesConfig.selectRows({
    cards: [{
      id: 'termf',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-TARGET',
      primary_quote: 'The Company shall pay a termination fee of $100,000,000 as a condition to termination.',
      features: {
        // Real claims-adapter shape: every TERMF card's structured fee data
        // lands under the SAME flat attribute name, differentiated by which
        // card (provision_subtype) it's attached to (see lib/termf.js's
        // routeRawTerminationFees).
        terminationFees: {
          amount: '$100,000,000',
          triggers: [{ code: 'SUPERIOR_PROPOSAL', text: 'Company terminates pursuant to Section 8.01(f)', label: 'Company terminates to accept a Superior Proposal' }],
        },
        feeRequired: true,
      },
    }],
  });
  const amount = terminationRows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  const feeRequired = terminationRows.find((row) => row.id === 'termination-fees-required');
  // row.detail is still computed (other call sites may read it) even though
  // punchlist #35 dropped its dedicated table column.
  assert.match(amount.detail, /\$100,000,000/);
  // §11 rebuild: the fee amount itself now leads the signals column as its
  // own pill (REBUILD-SPECS.md "Company Termination Fee [$ amount pill]"),
  // ahead of the trigger-name pills.
  assert.deepEqual(amount.signals.map((item) => item.label), ['$100,000,000', 'Company terminates to accept a Superior Proposal']);
  assert.deepEqual(feeRequired.signals.map((item) => item.label), ['Yes']);
  const termSignals = terminationFeesMod.terminationFeesConfig.columns.find((column) => column.id === 'signals');
  // Punchlist #35: the "Detail" column was removed -- only Term/Signals remain.
  assert.equal(terminationFeesMod.terminationFeesConfig.columns.find((column) => column.id === 'detail'), undefined);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, termSignals.renderCell(feeRequired, { primitives }))), /Yes/);

  const miscRows = advisersFeesExpensesMod.advisersFeesExpensesConfig.selectRows({
    cards: [{
      id: 'expense',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-EXPENSES',
      primary_quote: 'Each party shall bear its own fees and expenses, except HSR filing fees shall be paid by Parent.',
      features: {
        feeExpenseAllocation: 'each party bears its own expenses',
        feeExpenseExceptions: 'Parent pays HSR filing fees',
      },
    }],
  });
  const exception = miscRows.find((row) => row.id === 'advisers-fees-expenses-expense-exceptions');
  assert.deepEqual(exception.signals.map((item) => item.label), ['Parent pays HSR filing fees']);
  const miscSignals = advisersFeesExpensesMod.advisersFeesExpensesConfig.columns.find((column) => column.id === 'signals');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, miscSignals.renderCell(exception, { primitives }))), /Parent pays HSR filing fees/);
});

test('AF1: advisers-fees-expenses surfaces the FULL named exception-section list from feeExpenseAllocation, not the truncated feeExpenseAllocationExceptions phrase (real-deal shape)', () => {
  const cards = [
    {
      id: 'expenses',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-EXPENSES',
      section_ref: '8.03 | Expenses | h1',
      short_title: 'Expenses',
      primary_quote: 'SECTION 8.03. Fees and Expenses. Except as set forth in Section 6.02, Section 6.03(b), Section 6.05 and Section 8.02, all fees and expenses incurred in connection with this Agreement, the Merger and the other Transactions shall be paid by the party incurring such fees or expenses, whether or not the Merger is consummated.',
      features: {
        feeExpenseAllocation: 'Except as set forth in Section 6.02, Section 6.03(b), Section 6.05 and Section 8.02, all fees and expenses incurred in connection with this Agreement, the Merger and the other Transactions shall be paid by the party incurring such fees or expenses, whether or not the Merger is consummated.',
        // The render bug this locks in: the exceptions attribute itself is
        // truncated to just the first cited section.
        feeExpenseAllocationExceptions: 'Except as set forth in Section 6.02',
      },
    },
    {
      id: 'access',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-ACCESS',
      section_ref: '6.02 | Access to Information; Confidentiality | h2',
      short_title: 'Access to Information; Confidentiality',
      primary_quote: 'SECTION 6.02. Access to Information; Confidentiality. Except if prohibited by any applicable Law, the Company shall afford to Parent reasonable access during normal business hours.',
    },
    {
      id: 'antitrust-fee-fragment',
      // Mirrors the real-deal I7-class gap: the HSR/foreign-filing-fee
      // clause only survives as an unclassified fragment whose section_ref
      // ("6.01") and text carry no clean "SECTION 6.03(b)." heading to
      // match against -- resolvable only via the antitrust/HSR keyword tier.
      provision_type: 'ANTITRUST_REGULATORY',
      provision_subtype: null,
      section_ref: '6.01 | [PROPOSED] Regulatory Filing Fees | h3',
      short_title: '[PROPOSED] Regulatory Filing Fees',
      primary_quote: 'Each party will bear its own costs of preparing its own pre-merger notifications and similar filings and notices in other jurisdictions; provided that Parent shall bear all filing fees payable by Parent or the Company for the filings required under the HSR Act or any applicable Foreign Merger Control Law.',
    },
    {
      id: 'dno',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-DNO',
      section_ref: '6.05 | D&O Indemnification and Insurance | h4',
      short_title: 'D&O Indemnification and Insurance',
      primary_quote: 'SECTION 6.05. Indemnification. (a) All rights to indemnification and exculpation from liabilities for acts or omissions occurring at or prior to the Effective Time shall survive.',
    },
    {
      id: 'effect-of-termination',
      // Mirrors the real-deal numbering gap: this card's OWN quoted text
      // heads with "SECTION 8.02." but its section_ref column (set by
      // region-grouping, not the true document number) lags at 8.01 --
      // proving the heading tier is tried before, and wins over, section_ref.
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-EFFECT',
      section_ref: '8.01 | Effect of Termination | h5',
      short_title: 'Effect of Termination',
      primary_quote: 'SECTION 8.02. Effect of Termination. (a) In the event of termination of this Agreement by either the Company or Parent, this Agreement shall become void and have no effect.',
    },
  ];
  const rows = advisersFeesExpensesMod.advisersFeesExpensesConfig.selectRows({ cards });
  // Round-4: one clean allocation row -- base rule in Detail, named sections
  // solely as pills. No separate raw-clause row, and Detail no longer re-joins
  // the pills.
  const exceptionsRow = rows.find((row) => row.id === 'advisers-fees-expenses-expense-exceptions');
  assert.ok(exceptionsRow, 'expected the allocation/exceptions row');
  assert.equal(exceptionsRow.label, 'Fee / expense allocation');
  assert.match(exceptionsRow.detail, /each party bears its own expenses/i);
  assert.doesNotMatch(exceptionsRow.detail, /§6\.02|§6\.03|§8\.02/, 'Detail must not duplicate the section pills');
  assert.equal(rows.find((row) => row.id === 'advisers-fees-expenses-fee-expense'), undefined, 'raw-clause row dropped');
  assert.deepEqual(exceptionsRow.signals.map((item) => item.label), [
    '§6.02 — Access to Information; Confidentiality',
    '§6.03(b) — Regulatory Filing Fees',
    '§6.05 — D&O Indemnification and Insurance',
    '§8.02 — Effect of Termination',
  ]);
  exceptionsRow.signals.forEach((item) => assert.equal(item.tone, 'neutral'));
});

test('AF2: advisers-fees-expenses expense-exceptions names all four sections on the live Metsera deal shape (885edae5), not just Section 6.02 (FEEDBACK-4 punch-list, deal_id 885edae5-49e8-464a-9f33-edd229119d7c)', () => {
  // Card ids/short_titles/section_refs/primary_quote text below are copied
  // verbatim from Metsera's own provision_cards rows (deal_id
  // 885edae5-49e8-464a-9f33-edd229119d7c), including the claims-table
  // feeExpenseAllocation verbatim's real embedded line break after "Section
  // 6.02,". canonical is null on that claim (as in production) -- the row
  // must resolve purely from parsing this verbatim, never from canonical.
  const cards = [
    {
      id: 'de9bbe2a-1909-4fc4-ad5c-76d69ddb1042',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-EXPENSES',
      short_title: 'Expenses',
      section_ref: '8.03 | Expenses | 090ab0ae929e',
      primary_quote: 'SECTION 8.03. Fees and Expenses. Except as set forth in Section 6.02,\nSection 6.03(b), Section 6.05 and Section 8.02, all fees and expenses incurred in connection with this Agreement, the Merger and the other Transactions shall be paid by the party incurring such fees or expenses, whether or not the Merger is consummated.',
      features: {
        feeExpenseAllocation: 'Except as set forth in Section 6.02,\nSection 6.03(b), Section 6.05 and Section 8.02, all fees and expenses incurred in connection with this Agreement, the Merger and the other Transactions shall be paid by the party incurring such fees or expenses, whether or not the Merger is consummated.',
      },
    },
    {
      id: '3c3a7b49-4272-4a16-8f7a-ab0d782ae9ce',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-ACCESS',
      short_title: 'Access to Information; Confidentiality',
      section_ref: '6.02 | Access to Information; Confidentiality | 7974ddbe7ddc',
      primary_quote: 'SECTION 6.02. Access to Information; Confidentiality. ... provided, however, that Parent shall reimburse the Company for any reasonable out-of-pocket expenses incurred by the Company or any Company Subsidiary arising out of affording any such access, furnishing any such information and providing such access...',
    },
    {
      // Real I7-class gap: the HSR/foreign-filing-fee clause survives only
      // as an unclassified [PROPOSED] fragment whose own section_ref
      // ("6.01") doesn't carry the true "6.03(b)" document number.
      id: '71d26b88-c197-49c4-b299-019613ed1a3a',
      provision_type: 'ANTITRUST_REGULATORY',
      provision_subtype: null,
      short_title: '[PROPOSED] Regulatory Filing Fees',
      section_ref: '6.01 | [PROPOSED] Regulatory Filing Fees | bcc32649481c',
      primary_quote: 'Each party will bear its own costs of preparing its own pre-merger notifications and similar filings and notices in other jurisdictions and related expenses incurred to obtain all required regulatory approvals under the HSR Act or any applicable Foreign Merger Control Law; provided that Parent shall bear all filing fees payable by Parent or any of its affiliates or the Company or any of its affiliates for the filings required under the HSR Act or any applicable Foreign Merger Control Law.',
    },
    {
      id: 'cdf55b01-83da-496a-a39d-6a545308c505',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-DO',
      short_title: 'D&O Indemnification and Insurance',
      section_ref: '6.05 | D&O Indemnification and Insurance | f864b4997ed0',
      primary_quote: 'SECTION 6.05. Indemnification. (a) All rights to indemnification and exculpation from liabilities for acts or omissions occurring at or prior to the Effective Time (and rights to advancement of expenses) now existing in favor of any Person... (c) The Company, with Parent\'s prior written consent, may obtain, at or prior to the Effective Time, prepaid (or "tail") directors\' and officers\' liability insurance policies... (f) Parent shall pay all reasonable and documented out-of-pocket expenses, including reasonable attorneys\' fees, that may be incurred by any Indemnified Party in successfully enforcing the indemnity and other obligations provided in this Section 6.05.',
    },
    {
      // Real numbering gap: this card's own quoted text heads with
      // "SECTION 8.02." but its section_ref column lags at 8.01 (set by
      // region-grouping, not the true document number) -- proving the
      // heading tier is tried before, and wins over, section_ref.
      id: 'bb145166-b14b-49a7-b46a-65386e2cd767',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-EFFECT',
      short_title: 'Effect of Termination',
      section_ref: '8.01 | Effect of Termination | 1638d2748e0a',
      primary_quote: 'SECTION 8.02. Effect of Termination. (a) In the event of termination of this Agreement by either the Company or Parent as provided in Section 8.01, this Agreement shall forthwith become void and have no effect...',
    },
  ];
  const rows = advisersFeesExpensesMod.advisersFeesExpensesConfig.selectRows({ cards });
  const exceptionsRow = rows.find((row) => row.id === 'advisers-fees-expenses-expense-exceptions');
  assert.ok(exceptionsRow, 'expected an expense-exceptions row');
  const labels = exceptionsRow.signals.map((item) => item.label);
  assert.deepEqual(labels, [
    '§6.02 — Access to Information; Confidentiality',
    '§6.03(b) — Regulatory Filing Fees',
    '§6.05 — D&O Indemnification and Insurance',
    '§8.02 — Effect of Termination',
  ]);
  ['6.02', '6.03', '6.05', '8.02'].forEach((num) => {
    assert.ok(labels.some((label) => label.includes(num)), `expected a signal naming Section ${num}`);
  });
});

test('TB1: misc-boilerplate third-party-beneficiaries row names WHICH PARTIES benefit under WHICH provision (by subject, not a bare section number), resolving sections from sibling cards outside the Misc set (real-deal shape)', () => {
  const cards = [
    {
      id: 'anti-reliance',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-B-ANTIRELIANCE',
      short_title: 'Anti-Reliance / Exclusivity of Representations',
      primary_quote: 'SECTION 9.07. Anti-Reliance. This Agreement is not intended to confer upon any Person other than the parties any rights or remedies as a third-party beneficiary.',
      features: {
        thirdPartyBeneficiaries: [
          'holders of CVRs',
          'holders of Certificates and holders of Book-Entry Shares',
          'holders of awards under Company Stock Plans',
        ],
        thirdPartyBeneficiaryExceptions: [
          'Section 6.05',
          'the rights of holders of CVRs to receive payment in accordance with the terms of this Agreement and the CVR Agreement',
          'following the Effective Time the provisions of Article I shall be enforceable by holders of Certificates and holders of Book-Entry Shares solely to the extent necessary to receive the Merger Consideration to which such holders are entitled to thereunder',
          'the provisions of Section 2.03 shall be enforceable by holders of awards under Company Stock Plans to the extent necessary to receive the amounts to which such holders are entitled thereunder',
        ],
      },
    },
    {
      id: 'dno',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-DNO',
      section_ref: '6.05 | D&O Indemnification and Insurance | h1',
      short_title: 'D&O Indemnification and Insurance',
      primary_quote: 'SECTION 6.05. Indemnification. (a) All rights to indemnification and exculpation from liabilities for acts or omissions occurring at or prior to the Effective Time shall survive.',
    },
    {
      id: 'equity-awards',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EQUITY',
      section_ref: '2.03 | Treatment of Equity Awards / Stock Plans | h2',
      short_title: 'Treatment of Equity Awards / Stock Plans',
      primary_quote: 'SECTION 2.03. Treatment of Company Equity Awards. (a) Effective as of the Effective Time, each award shall be converted.',
    },
  ];
  const rows = miscBoilerplateMod.miscBoilerplateConfig.selectRows({ cards });
  const thirdPartyRow = rows.find((row) => row.id === 'misc-boilerplate-third-party');
  assert.ok(thirdPartyRow, 'expected a third-party-beneficiaries row');
  assert.deepEqual(thirdPartyRow.signals.map((item) => item.label), [
    'D&O Indemnification and Insurance (§6.05)',
    'holders of CVRs',
    'holders of Certificates and holders of Book-Entry Shares — Article I',
    'holders of awards under Company Stock Plans — Treatment of Equity Awards / Stock Plans (§2.03)',
  ]);
  thirdPartyRow.signals.forEach((item) => assert.equal(item.tone, 'neutral'));
});

test('termination-fees config renders structured fee-table cells, not raw JSON, across multiple TERMF cards (Metsera regression: terminationFees dumped literal JSON)', () => {
  const rows = terminationFeesMod.terminationFeesConfig.selectRows({
    cards: [
      {
        id: 'termf-target',
        provision_type: 'TERMINATION_FEE',
        provision_subtype: 'TERMF-TARGET',
        primary_quote: 'Company Termination Fee provision.',
        features: {
          terminationFees: {
            amount: '$190,000,000',
            payment_deadline: 'within two business days after termination',
            triggers: [
              { code: 'SUPERIOR_PROPOSAL', text: 'Company terminates pursuant to Section 8.01(f)', label: 'Company terminates to accept a Superior Proposal' },
              { code: 'RECOMMENDATION_CHANGE', text: 'Parent terminates pursuant to Section 8.01(d)', label: 'Parent terminates after a recommendation change' },
            ],
          },
        },
      },
      {
        id: 'termf-expense',
        provision_type: 'TERMINATION_FEE',
        provision_subtype: 'TERMF-EXPENSE',
        primary_quote: 'Expense Reimbursement provision.',
        features: {
          terminationFees: { triggers: [{ code: 'OTHER', text: 'Company fails to make a required payment', label: 'Company fails to promptly make a required payment' }] },
        },
      },
    ],
  });
  const companyFee = rows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  const expenseFee = rows.find((row) => row.id === 'termination-fees-EXPENSE_REIMBURSEMENT');
  assert.ok(companyFee, 'company termination fee row should render');
  // Punchlist #37: EXPENSE_REIMBURSEMENT rows are dropped entirely -- the
  // term reads like a naked-no-vote fee and the underlying fact (the
  // termination fee is repayable) is trivially always-true.
  assert.equal(expenseFee, undefined, 'expense reimbursement row must not render');
  // Neither row's detail is the raw claim object serialized inline.
  assert.doesNotMatch(companyFee.detail, /\{"amount"/);
  assert.doesNotMatch(companyFee.detail, /"triggers":\[/);
  assert.match(companyFee.detail, /\$190,000,000/);
  assert.match(companyFee.detail, /within two business days/);
  // Each trigger is its own short, human-readable pill — not the full
  // verbatim clause text dumped into one cell — and the amount itself leads
  // as its own pill (REBUILD-SPECS.md §11).
  assert.deepEqual(companyFee.signals.map((item) => item.label), [
    '$190,000,000',
    'Company terminates to accept a Superior Proposal',
    'Parent terminates after a recommendation change',
  ]);
});

test('tail-fee render cells use a single Signals column (punchlist #38: no separate Mechanic column)', () => {
  const rows = tailFeeMod.tailFeeConfig.selectRows({
    cards: [{
      id: 'tail',
      provision_type: 'TERMINATION_FEE',
      provision_subtype: 'TERMF-TAIL',
      primary_quote: 'If within 12 months the Company enters into a Company Takeover Proposal for 50% or more, the fee is payable.',
      features: {
        tailProvision: { period_months: 12, threshold_percentage: 50, triggers: ['Company Takeover Proposal'] },
      },
    }],
  });
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    TruncatedWithSeeText: ({ text, evidence }) => React.createElement('span', { 'data-evidence': evidence }, text),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const threshold = rows.find((row) => row.id === 'tail-threshold');
  const arming = rows.find((row) => row.id === 'tail-arming');
  const triggerScope = rows.find((row) => row.id === 'tail-trigger-scope');
  const signalColumn = tailFeeMod.tailFeeConfig.columns.find((column) => column.id === 'signals');
  // §11 tidy, revised per punchlist #38: no dedicated "Mechanic"/'value'
  // column, and no dedicated "Evidence" column -- everything routes through
  // one Signals column. Evidence is still reachable via hover on the
  // PillCell/TruncatedWithSeeText primitives (both wrap content in
  // EvidenceHoverSource already).
  assert.equal(tailFeeMod.tailFeeConfig.columns.find((column) => column.id === 'value'), undefined);
  assert.equal(tailFeeMod.tailFeeConfig.columns.find((column) => column.id === 'evidence'), undefined);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(threshold, { primitives }))), /class="pill">50%</);
  // Punchlist #39: the "termination scenarios" content lives IN the signals
  // column, not off in a second column, and not dropped. Punchlist TF1
  // (round 3): it now renders as its own pill per scenario, not prose
  // through TruncatedWithSeeText.
  const armingHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(arming, { primitives })));
  assert.match(armingHtml, /class="pill">Company Takeover Proposal</);
  // Punchlist #40/TF2 (round 3): the trigger-scope row states the
  // corrected mechanic as one short, clear statement.
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(triggerScope, { primitives }))), /Any qualifying transaction signed within the tail period/);
});

test('nosol-noshop config maps core no-shop cards', () => {
  const rows = nosolNoshopMod.nosolNoshopConfig.selectRows({
    cards: [
      {
        id: 'prohibit',
        provision_type: 'COVENANT_NO_SOLICITATION',
        provision_subtype: 'NOSOL-PROHIBIT',
        party_scope: 'COMPANY',
        primary_quote: 'The Company shall not solicit Acquisition Proposals.',
        features: { ceaseDiscussionsProhibitedList: ['solicit', 'initiate', 'knowingly encourage'] },
      },
      {
        id: 'cease',
        provision_type: 'COVENANT_NO_SOLICITATION',
        provision_subtype: 'NOSOL-CEASE',
        party_scope: 'COMPANY',
        primary_quote: 'The Company shall cease and terminate all existing discussions.',
        features: { ceaseDiscussionsProhibitedList: ['cease discussions', 'terminate access'] },
      },
    ],
  });
  assert.deepEqual(rows.map((row) => row.label), [
    'No-shop / non-solicit restriction',
    'Cease discussions',
  ]);
  assert.match(rows[0].detail, /solicit; initiate; knowingly encourage/);
});

test('nosol-noshop config falls back to no-shop quote text', () => {
  const rows = nosolNoshopMod.nosolNoshopConfig.selectRows({
    cards: [{
      id: 'fallback',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-OTHER',
      party_scope: 'COMPANY',
      short_title: 'No-Shop',
      primary_quote: 'Except as permitted by this Section, the Company shall not solicit or knowingly encourage an Acquisition Proposal.',
    }],
  });
  assert.ok(rows.some((row) => row.id === 'nosol-noshop-prohibit'));
  assert.ok(rows.some((row) => row.id === 'nosol-noshop-exceptions'));
});

test('nosol-superior config maps superior proposal features', () => {
  const rows = nosolSuperiorMod.nosolSuperiorConfig.selectRows({
    cards: [{
      id: 'superior',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-SUPERIOR',
      party_scope: 'COMPANY',
      primary_quote: 'A Superior Proposal means a bona fide written Acquisition Proposal for 50% or more of the Company assets that is more favorable from a financial point of view.',
      features: {
        superiorProposalThresholdPct: 50,
        superiorProposalTest: 'more favorable from a financial point of view',
        superiorProposalDeterminer: 'Company Board after consultation with outside legal counsel and financial advisor',
        fiduciaryEngageStandard: 'could reasonably be expected to lead to a Superior Proposal',
        fiduciaryFinalStandard: 'constitutes a Superior Proposal',
      },
    }],
  });
  assert.deepEqual(rows.map((row) => row.label), [
    'Superior Proposal threshold',
    'Superior Proposal test',
    'Determiner',
    'Engagement standard',
    'Final determination standard',
  ]);
  assert.equal(rows.find((row) => row.id === 'nosol-superior-threshold').detail, '50%');
  assert.match(rows.find((row) => row.id === 'nosol-superior-engage').detail, /could reasonably be expected/);
});

test('nosol-superior config falls back to definition quote text', () => {
  const rows = nosolSuperiorMod.nosolSuperiorConfig.selectRows({
    cards: [{
      id: 'superior',
      provision_type: 'DEFINITION',
      provision_subtype: 'DEF-SUPERIOR',
      short_title: 'Superior Proposal',
      primary_quote: 'Superior Proposal means any bona fide written proposal for 75% or more of the Company stock that the Company Board determines in good faith, after consultation with its financial advisor, would result in greater value.',
    }],
  });
  assert.equal(rows.find((row) => row.id === 'nosol-superior-threshold').detail, '75%');
  assert.match(rows.find((row) => row.id === 'nosol-superior-test').detail, /greater value/);
  // Round-6: determiner renders the clean canonical pill, not the raw sentence.
  assert.match(rows.find((row) => row.id === 'nosol-superior-determiner').detail, /Company Board — in good faith/);
});

test('nosol-intervening config maps intervening event features', () => {
  const rows = nosolInterveningMod.nosolInterveningConfig.selectRows({
    cards: [{
      id: 'intervening',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-INTERVENING',
      party_scope: 'COMPANY',
      primary_quote: 'The Company Board may make an Adverse Recommendation Change in response to an Intervening Event.',
      features: {
        boardChangeForInterveningEvent: true,
        interveningEventDefinition: 'an event unknown to the Company Board as of signing',
        interveningEventScope: 'POSITIVE_ONLY',
        interveningEventExceptions: ['Acquisition Proposal-related events'],
        interveningEventTermination: 'No termination right, recommendation change only',
      },
    }],
  });
  assert.deepEqual(rows.map((row) => row.label), [
    'Intervening Event provision',
    'Definition',
    'Scope',
    'Exceptions',
    'Termination right',
  ]);
  assert.equal(rows.find((row) => row.id === 'nosol-intervening-provision').detail, 'Yes');
  assert.match(rows.find((row) => row.id === 'nosol-intervening-scope').detail, /Positive/);
});

test('nosol-intervening config falls back to definition and exception quote text', () => {
  const rows = nosolInterveningMod.nosolInterveningConfig.selectRows({
    cards: [{
      id: 'intervening',
      provision_type: 'DEFINITION',
      provision_subtype: 'DEF-INTERVENING',
      short_title: 'Intervening Event',
      primary_quote: 'Intervening Event means any material event that was not known as of signing. Provided that an Intervening Event shall not include any event arising from an Acquisition Proposal.',
    }],
  });
  assert.match(rows.find((row) => row.id === 'nosol-intervening-definition').detail, /means any material event/);
  assert.match(rows.find((row) => row.id === 'nosol-intervening-scope').detail, /Positive/);
  assert.match(rows.find((row) => row.id === 'nosol-intervening-exceptions').detail, /shall not include/);
});

test('nosol-fiduciary config maps fiduciary-out features', () => {
  const rows = nosolFiduciaryMod.nosolFiduciaryConfig.selectRows({
    cards: [{
      id: 'match',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-MATCH',
      party_scope: 'COMPANY',
      primary_quote: 'The Company shall give Parent four Business Days notice before making a Change of Recommendation.',
      features: {
        fiduciaryEngageStandard: 'could reasonably be expected to lead to a Superior Proposal',
        fiduciaryFinalStandard: 'constitutes a Superior Proposal',
        boardChangeForSuperiorProposal: true,
        noticePeriod: 'four Business Days',
        noticeContent: 'identity of the person making the proposal and material terms',
        initialMatchPeriodDays: 4,
        subsequentMatchPeriodDays: 2,
        forceTheVote: true,
        companyTerminationForSuperior: true,
        representativesStandard: 'not permit to',
        parentTerminationRightForNonsolicitBreach: 'MATERIAL_WILLFUL_ONLY',
      },
    }],
  });
  assert.deepEqual(rows.map((row) => row.label), [
    'Engagement standard',
    'Final determination standard',
    'Board change right',
    'Notice period',
    'Notice content',
    'Initial match period',
    'Subsequent match period',
    'Force the vote',
    'Company termination for Superior Proposal',
    'Representative control standard',
    'Buyer termination for nonsolicit breach',
  ]);
  assert.equal(rows.find((row) => row.id === 'nosol-fiduciary-notice-period').detail, 'four Business Days');
});

test('nosol-fiduciary config falls back to fiduciary quote text', () => {
  const rows = nosolFiduciaryMod.nosolFiduciaryConfig.selectRows({
    cards: [{
      id: 'recommend',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-RECOMMEND',
      primary_quote: 'Before making an Adverse Recommendation Change for a Superior Proposal, the Company shall provide notice identifying the bidder identity and material terms and shall negotiate for four Business Days. The Company shall cause its Representatives not to solicit competing proposals.',
    }],
  });
  assert.match(rows.find((row) => row.id === 'nosol-fiduciary-board-change').detail, /Adverse Recommendation Change/);
  assert.equal(rows.find((row) => row.id === 'nosol-fiduciary-notice-period').detail, 'four Business Days');
  assert.match(rows.find((row) => row.id === 'nosol-fiduciary-reps').detail, /Representatives/);
});

// Item 6 (round 3, QXO): NOSOL-RECOMMEND (68d853e1, texts without
// enumerators) and NOSOL-DISCLOSE (5a9a201d, texts prefixed "(A) "/"(B) "/
// ...) carry the SAME six changeOfRecommendationItems limbs. The old
// exact-verbatim dedup in allFeatureItems() let the "(A) " prefixes defeat
// it, doubling every pill. corItemsRow must dedupe by canonical label/code
// identity, keeping the lettered entry, so each limb renders exactly once.
test('Item 6: change-of-recommendation items carried on two cards (with/without letter prefixes) dedupe to one pill per limb, keeping the lettered label', () => {
  const rows = nosolFiduciaryMod.nosolFiduciaryConfig.selectRows({
    cards: [{
      id: 'nosol-recommend-qxo',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-RECOMMEND',
      primary_quote: 'Change of Recommendation prohibitions.',
      features: {
        changeOfRecommendationItems: [
          'withdraw or modify the Board Recommendation in a manner adverse to Parent',
          'approve, recommend or declare advisable any Takeover Proposal',
        ],
      },
    }, {
      id: 'nosol-disclose-qxo',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-DISCLOSE',
      primary_quote: 'Change of Recommendation prohibitions (disclosure schedule copy).',
      features: {
        changeOfRecommendationItems: [
          '(A) withdraw or modify the Board Recommendation in a manner adverse to Parent',
          '(B) approve, recommend or declare advisable any Takeover Proposal',
        ],
      },
    }],
  });
  const row = rows.find((r) => r.id === 'nosol-fiduciary-change-of-rec-items');
  assert.ok(row, 'expected the change-of-recommendation row');
  assert.equal(row.items.length, 2, 'each limb must render exactly once, not once per source card');
  assert.deepEqual(row.items.map((i) => i.letter), ['A', 'B'], 'the lettered entry must win the dedup so A-E ordering is preserved');
});

// Item 15 (round 3, Theravance NOSOL-RECOMMEND): notChangeOfRecommendationItems
// has THREE genuinely distinct verbatims; items 1 ("stop-look-and-listen ...
// Rule 14d-9(f)") and 3 ("a position contemplated by Rule 14d-9, Rule
// 14e-2(a) or Item 1012 of Regulation M-A") both match NOT_COR_SPECS[0], so
// the SAME rendered label appeared twice even though the texts differ (a
// label collision, not a text collision -- allFeatureItems' text-keyed dedup
// can't catch it). Same fix as item 6: dedupe post-summarization.
test('Item 15: two distinct verbatims that summarize to the same label dedupe to one pill (Theravance 14d-9/14e-2 case)', () => {
  const rows = nosolFiduciaryMod.nosolFiduciaryConfig.selectRows({
    cards: [{
      id: 'nosol-recommend-thera',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-RECOMMEND',
      primary_quote: 'Not a Change of Recommendation.',
      features: {
        notChangeOfRecommendationItems: [
          'taking and disclosing a position with respect to a tender or exchange offer in a stop-look-and-listen communication pursuant to Rule 14d-9(f) under the Exchange Act',
          'informing any Person of the existence of the provisions contained in this Section',
          'taking a position contemplated by Rule 14d-9, Rule 14e-2(a) or Item 1012 of Regulation M-A under the Exchange Act',
        ],
      },
    }],
  });
  const row = rows.find((r) => r.id === 'nosol-fiduciary-not-change-of-rec-items');
  assert.ok(row, 'expected the not-change-of-recommendation row');
  const stopLookLabels = row.items.filter((i) => /14d-9 \/ 14e-2 stop-look-listen compliance/i.test(i.label));
  assert.equal(stopLookLabels.length, 1, 'the two distinct verbatims that both summarize to the 14d-9/14e-2 label must render as ONE pill, not two');
  assert.equal(row.items.length, 2, 'three source verbatims collapse to two distinct pills (14d-9/14e-2 + routine communications)');
});

test('nosol configs render signals and hover-source details with primitives', () => {
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const noShopRows = nosolNoshopMod.nosolNoshopConfig.selectRows({
    cards: [{
      id: 'prohibit',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-PROHIBIT',
      primary_quote: 'The Company shall not solicit or knowingly encourage an Acquisition Proposal.',
      features: { ceaseDiscussionsProhibitedList: ['solicit', 'knowingly encourage'] },
    }],
  });
  const noShopSignal = nosolNoshopMod.nosolNoshopConfig.columns.find((column) => column.id === 'signals');
  const noShopDetail = nosolNoshopMod.nosolNoshopConfig.columns.find((column) => column.id === 'detail');
  // WS-G #1b: each prohibited act renders as its own pill, not a
  // semicolon-joined blob.
  const noShopHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, noShopSignal.renderCell(noShopRows[0], { primitives })));
  assert.match(noShopHtml, /class="pill">solicit</);
  assert.match(noShopHtml, /class="pill">knowingly encourage</);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, noShopDetail.renderCell(noShopRows[0], { primitives }))), /data-evidence="The Company shall not solicit/);

  const superiorRows = nosolSuperiorMod.nosolSuperiorConfig.selectRows({
    cards: [{
      id: 'superior',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-SUPERIOR',
      primary_quote: 'A Superior Proposal means a proposal for 50% or more of the Company assets.',
      features: { superiorProposalThresholdPct: '50%' },
    }],
  });
  const superiorSignal = nosolSuperiorMod.nosolSuperiorConfig.columns.find((column) => column.id === 'signals');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, superiorSignal.renderCell(superiorRows[0], { primitives }))), /50%/);

  const interveningRows = nosolInterveningMod.nosolInterveningConfig.selectRows({
    cards: [{
      id: 'intervening',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-INTERVENING',
      primary_quote: 'The Company Board may act for an Intervening Event.',
      features: { interveningEventScope: 'POSITIVE_ONLY' },
    }],
  });
  const interveningSignal = nosolInterveningMod.nosolInterveningConfig.columns.find((column) => column.id === 'signals');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, interveningSignal.renderCell(interveningRows.find((row) => row.id === 'nosol-intervening-scope'), { primitives }))), /Positive \/ non-Acquisition Proposal events only/);

  const fiduciaryRows = nosolFiduciaryMod.nosolFiduciaryConfig.selectRows({
    cards: [{
      id: 'match',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: 'NOSOL-MATCH',
      primary_quote: 'The Company shall give Parent four Business Days notice.',
      features: { noticePeriod: 'four Business Days' },
    }],
  });
  const fiduciarySignal = nosolFiduciaryMod.nosolFiduciaryConfig.columns.find((column) => column.id === 'signals');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, fiduciarySignal.renderCell(fiduciaryRows[0], { primitives }))), /four Business Days/);
});

test('employee-benefits config maps structured compensation items', () => {
  const rows = employeeBenefitsMod.employeeBenefitsConfig.selectRows({
    cards: [{
      id: 'employee-benefits',
      provision_subtype: 'COV-EMPLOYEE',
      primary_quote: 'Continuing Employees shall receive compensation and benefits protections.',
      features: {
        compensationItems: [{
          benefit_types: [{ code: 'BASE_SALARY', label: 'Base salary' }, { code: 'TARGET_BONUS', label: 'Target annual bonus' }],
          standard_codes: ['NO_LESS_FAVORABLE'],
          standard_labels: ['No less favourable'],
          comparison_group: 'pre-closing target employee baseline',
          exceptions: ['equity awards'],
          bundling: 'aggregate',
          text: 'base salary and target bonus no less favourable in the aggregate',
        }],
      },
    }],
  });
  assert.deepEqual(rows.map((row) => row.benefit), ['Base salary', 'Target annual bonus']);
  assert.equal(rows[0].comparison, 'pre-closing target employee baseline');
  assert.match(rows[0].standard, /No less favourable/);
  assert.match(rows[0].detail, /Exceptions: equity awards/);
  assert.match(rows[0].detail, /Bundling: aggregate/);
});

test('employee-benefits config falls back to legacy flat standards', () => {
  const rows = employeeBenefitsMod.employeeBenefitsConfig.selectRows({
    cards: [{
      id: 'employee-benefits',
      provision_subtype: 'COV-EMPLOYEE',
      primary_quote: 'For 12 months, base salary and health benefits shall be substantially comparable.',
      features: {
        employeeBenefitPeriod: 12,
        baseSalaryStandard: 'substantially comparable base salary',
        benefitsStandard: 'substantially comparable health benefits',
      },
    }],
  });
  assert.deepEqual(rows.map((row) => row.benefit), [
    'Continuation period',
    'Base salary',
    'Health and welfare benefits',
  ]);
  assert.equal(rows.find((row) => row.id === 'employee-benefits-period').standard, '12');
});

test('sec-meeting config maps proxy deadlines and adjournment rights', () => {
  const rows = secMeetingMod.secMeetingConfig.selectRows({
    cards: [{
      id: 'proxy',
      provision_subtype: 'COV-PROXY',
      primary_quote: 'The Company shall file the proxy statement within 10 business days.',
      features: {
        proxyFilingDeadline: { days: 10, unit: 'BUSINESS_DAYS', trigger: 'SIGNING', text: 'file within 10 business days after signing' },
        mailingDeadline: { text: 'mail as promptly as practicable after SEC clearance' },
        adjournmentRights: [{ party: 'PARENT', reasons: [{ code: 'SOLICIT_VOTES', label: 'Solicit votes' }], maxDaysTotal: 30, text: 'Parent may require an adjournment to solicit votes.' }],
      },
    }],
  });
  assert.deepEqual(rows.map((row) => row.label), ['Proxy filing deadline', 'Proxy mailing', 'Adjournment rights']);
  assert.match(rows.find((row) => row.id === 'sec-meeting-proxy-filing').detail, /10 business days after signing/);
  assert.match(rows.find((row) => row.id === 'sec-meeting-adjournment-0').detail, /30 days total/);
});

test('sec-meeting config maps tender-offer SEC filing mechanics', () => {
  const rows = secMeetingMod.secMeetingConfig.selectRows({
    cards: [{
      id: 'offer',
      provision_subtype: 'STRUCT-OFFER',
      primary_quote: 'Parent shall file a Schedule TO and the Company shall file a Schedule 14D-9.',
      features: {
        scheduleTOFiling: 'Parent files Schedule TO with offer documents.',
        schedule14D9Filing: 'Company files Schedule 14D-9.',
        stockholderListCovenant: 'Company provides stockholder lists and security position listings.',
        tenderOfferMinimumCondition: 'Shares validly tendered and not withdrawn exceed 50%.',
      },
    }],
  });
  assert.deepEqual(rows.map((row) => row.label), [
    'Schedule TO / offer documents',
    'Schedule 14D-9',
    'Stockholder list / holder communications',
    'Tender-offer minimum condition',
  ]);
  assert.equal(rows.find((row) => row.id === 'sec-meeting-schedule14D9Filing').subject, 'SEC / offer');
});

test('no-other-reps fraud config maps Abry four-question summary', () => {
  const rows = noOtherRepsFraudMod.noOtherRepsFraudConfig.selectRows({
    cards: [{
      id: 'entire',
      provision_subtype: 'MISC-ENTIRE',
      short_title: 'Entire Agreement',
      primary_quote: 'Each party disclaims reliance on extra-contractual statements, except in cases of fraud.',
      features: {
        noOtherRepsPresent: true,
        noOtherRepsParty: 'BOTH',
        nonRelianceClause: 'Parent acknowledges that the Company makes no representations other than those in this Agreement.\n\nThe Company acknowledges that Parent makes no representations other than those in this Agreement.',
        extraContractualClaimsWaived: true,
        fraudCarveout: 'nothing herein limits liability for Fraud involving data room materials.\n\nnothing herein limits liability for Fraud involving management presentations.',
        willfulBreachDefinition: 'Willful Breach means an intentional and material breach of this Agreement.',
      },
    }],
  });
  assert.deepEqual(rows.map((row) => row.label), [
    'Buyer non-reliance',
    'Seller no-other-reps',
    'Seller non-reliance',
    'Buyer no-other-reps',
    'Fraud carve-out',
    'Willful breach definition',
  ]);
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-q1').status, 'Present');
  assert.match(rows.find((row) => row.id === 'no-other-reps-fraud-q2').detail, /data room/);
  assert.match(rows.find((row) => row.id === 'no-other-reps-fraud-q4').detail, /management presentations/);
  assert.match(rows.find((row) => row.id === 'no-other-reps-fraud-fraud').detail, /nothing herein limits liability for Fraud/);
  // extraContractualClaimsWaived row removed (punchlist #48): it's a
  // conclusion that follows from the non-reliance / no-other-reps rows
  // above, not a distinct fact worth its own row.
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-extra-contractual'), undefined);
  assert.match(rows.find((row) => row.id === 'no-other-reps-fraud-willful-breach').detail, /intentional and material breach/);
});

test('no-other-reps fraud config renders fraud silence as a meaningful row', () => {
  const rows = noOtherRepsFraudMod.noOtherRepsFraudConfig.selectRows({
    cards: [{
      id: 'target-norep',
      provision_subtype: 'REP-T-NOREP',
      short_title: 'No Other Representations',
      features: {
        noOtherRepsPresent: true,
        noOtherRepsParty: 'COMPANY',
        nonRelianceClause: 'Parent has not relied on any representation other than those expressly set forth in this Agreement.',
      },
    }],
  });
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-q1').status, 'Present');
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-q3').status, 'Not present');
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-fraud').status, 'Silent');
});

test('no-other-reps fraud config routes the Metsera §9.07 Anti-Reliance card (tagged noOtherRepsParty value)', () => {
  // Regression for the live-data routing bug: this card's provision_subtype
  // (REP-B-ANTIRELIANCE) is already in ABRY_CODES, but noOtherRepsParty
  // ships as a TAGGED { code, label, text, quotes } value rather than a bare
  // string, which made lib/abry.js's partyOf() silently drop the hit and
  // rendered every question row "Not present" even though the card carries
  // real non-reliance data.
  const rows = noOtherRepsFraudMod.noOtherRepsFraudConfig.selectRows({
    cards: [{
      id: 'anti-reliance',
      provision_subtype: 'REP-B-ANTIRELIANCE',
      short_title: 'Anti-Reliance / Exclusivity of Representations',
      features: {
        noOtherRepsPresent: true,
        noOtherRepsParty: { code: 'BOTH', label: 'Both', text: 'BOTH', quotes: ['SECTION 9.07...'] },
        nonRelianceClause: 'Company-side non-reliance excerpt.\n\nParent-side non-reliance excerpt.',
        extraContractualClaimsWaived: true,
        fraudCarveout: 'Except in the case of fraud, neither party has liability.',
      },
    }],
  });
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-q1').status, 'Present');
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-q3').status, 'Present');
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-fraud').status, 'Present');
  assert.equal(rows.find((row) => row.id === 'no-other-reps-fraud-extra-contractual'), undefined);
});

// QXO/TopBuild (r7): two-party IOC decks — §4.1 Interim Operations of the
// Company + §4.2 Interim Operations of Parent, every card baked
// party_scope=MUTUAL, positive covenants living on subtype-less chapeau
// cards whose limb payloads are double-JSON-encoded, and the Parent chapeau
// mis-stamped with section_ref 4.1 (party MUST resolve from the clause
// text, never the ref).
function qxoFixture() {
  return [
    {
      id: 'ch-t', provision_type: 'COVENANT_INTERIM_OPERATING', party_scope: 'MUTUAL',
      short_title: 'General / Preamble', section_ref: '4.1 | General / Preamble | h1',
      primary_quote: '4.1 Interim Operations of the Company. From the date of this Agreement the Company covenants and agrees as follows',
      features: { positiveObligations: [{ text: '{"appliesTo":["PROPERTIES","ASSETS"],"obligation":"maintain all leases and all personal property material to the Company"}' }] },
    },
    {
      id: 'ch-b', provision_type: 'COVENANT_INTERIM_OPERATING', party_scope: 'MUTUAL',
      short_title: 'General / Preamble', section_ref: '4.1 | General / Preamble | h2',
      primary_quote: '4.2 Interim Operations of Parent. From the date of this Agreement Parent covenants and agrees as follows',
      features: { positiveObligations: [{ text: '{"appliesTo":["PROPERTIES","ASSETS"],"obligation":"maintain all leases and all personal property material to Parent"}' }] },
    },
    { id: 'n-t', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-CHARTER', party_scope: 'MUTUAL', short_title: 'Charter / Bylaws Amendments', section_ref: '4.1(i) | Charter / Bylaws Amendments | h3', features: {} },
    { id: 'n-b', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-CHARTER', party_scope: 'MUTUAL', short_title: 'Charter / Bylaws Amendments', section_ref: '4.2(i) | Charter / Bylaws Amendments | h4', features: {} },
  ];
}

test('r7: two-party IOC deck resolves band->party labels from band order, chapeau party from text', () => {
  const cards = qxoFixture();
  const map = iocMod.bandPartyLabels(cards);
  assert.ok(map, 'two named-negative bands -> party map');
  assert.equal(map.get('4.1'), 'Company');
  assert.equal(map.get('4.2'), 'Parent');
  assert.equal(iocMod.cardPartyFromText(cards[0]), 'Company');
  assert.equal(iocMod.cardPartyFromText(cards[1]), 'Parent', 'Parent chapeau resolves from TEXT despite its section_ref saying 4.1');
});

test('r7/r8: chapeau positive covenants render as affirmative rows (double-encoded limbs unwrapped), never as fragments', () => {
  const cards = qxoFixture();
  assert.equal(iocMod.fragmentCards(cards).length, 0, 'chapeau cards are not unclassified fragments');
  const rows = iocMod.affirmativeRows(cards, { primitives: iocPrimitives });
  assert.equal(rows.length, 2, 'one affirmative row per party chapeau limb');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, rows.map((r, i) => React.createElement('div', { key: i }, r.label, r.children))));
  assert.match(html, /Maintain all leases and all personal property/, 'limb-derived row title (r8: no five identical "Ordinary course" rows)');
  assert.ok(rows.every((r) => r.seeTextContent), 'each limb row carries its clause via seeTextContent (left-column See provision)');
  assert.match(html, /Properties/i, 'appliesTo scope resolves to pills after unwrapping');
});

// r8: two-party decks split into two SECTIONS ("— Target" / "— Parent"),
// mirroring the reps tables, instead of per-party bands in one section.
test('r8: partitionIocCardsByParty routes chapeau cards by TEXT and enumerated cards by band; sections gate on it', () => {
  const cards = qxoFixture();
  const split = iocMod.partitionIocCardsByParty(cards);
  assert.ok(split);
  assert.deepEqual(split.Company.map((c) => c.id).sort(), ['ch-t', 'n-t']);
  assert.deepEqual(split.Parent.map((c) => c.id).sort(), ['ch-b', 'n-b'], 'Parent chapeau routed by text despite section_ref 4.1');
  const reviewDeal = { cards };
  assert.equal(iocMod.iocExceptionsConfig.selectRows(reviewDeal).length, 1, 'target section renders');
  assert.equal(iocMod.parentIocExceptionsConfig.selectRows(reviewDeal).length, 1, 'parent section renders on two-party decks');
  const singleBand = { cards: [
    { id: 'm1', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-MERGE', section_ref: '5.01(g) | M&A | x', features: {} },
  ] };
  assert.equal(iocMod.iocExceptionsConfig.selectRows(singleBand).length, 1, 'single-band deck keeps everything in the target section');
  assert.equal(iocMod.parentIocExceptionsConfig.selectRows(singleBand).length, 0, 'no parent section on single-band decks');
});

test('r7: single-band deck gets no party map and renders exactly as before', () => {
  const cards = [
    { id: 'm1', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-MERGE', section_ref: '5.01(g) | M&A | x', features: {} },
    { id: 'm2', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-DIVIDEND', section_ref: '5.01(e) | Dividends | y', features: {} },
  ];
  assert.equal(iocMod.bandPartyLabels(cards), null);
});
