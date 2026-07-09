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

test('consideration hero computes the "Up to $X.XX / share" rollup pill from perShareAmount + CVR maxPayment even when both live on the same card (Metsera shape: no separate CONSID-CVR card)', () => {
  const rows = considerationHeroMod.considerationHeroConfig.selectRows({
    cards: [{
      id: 'convert',
      provision_subtype: 'CONSID-CONVERT',
      short_title: 'Conversion of Shares',
      primary_quote: 'Company common stock converts into $47.50 cash plus one CVR (up to $22.50).',
      features: { considerationType: 'cash-with-cvr', perShareAmount: 47.5, maxPayment: '$22.50' },
    }],
  });
  const rollup = rows.find((row) => row.id === 'consideration-hero-rollup');
  assert.ok(rollup, 'expected a computed rollup row');
  assert.equal(rollup.detail, 'Up to $70.00 / share');
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
  assert.match(generalCovenantsMod.generalCovenantsConfig.selectRows(reviewDeal)[0].detail, /reasonable access/);
  assert.match(approvalsVotesMod.approvalsVotesConfig.selectRows(reviewDeal)[0].detail, /majority/);
  assert.match(advisersFeesExpensesMod.advisersFeesExpensesConfig.selectRows(reviewDeal)[0].detail, /own expenses/);
  // representations-qualifiers renders ONE row per rep card (Term |
  // Materiality Qualifier | Knowledge Qualifier | Lookback), not a flat
  // label/detail row -- the materiality cell carries the resolved text.
  const repRows = representationsQualifiersMod.representationsQualifiersConfig.selectRows(reviewDeal);
  assert.equal(repRows.length, 1);
  assert.match(repRows[0].materiality.label, /material respects/);
});

test('representations-qualifiers config resolves taxonomy-coded materiality/knowledge pills with hover evidence, and derives the section Knowledge-standard header note', () => {
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
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.materiality.label, 'MAE-qualified (partial)');
  assert.equal(row.materiality.color, 'amber');
  assert.equal(row.materiality.evidence, 'would not have an MAE');
  assert.equal(row.knowledge.label, 'Knowledge-qualified (partial)');
  assert.equal(
    representationsQualifiersMod.representationsQualifiersConfig.deriveHeaderNote(rows),
    'Knowledge standard: Actual knowledge',
  );

  const primitives = {
    PillCell: ({ label, evidence }) => React.createElement('span', { className: 'pill', 'data-evidence': evidence }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const materialityColumn = representationsQualifiersMod.representationsQualifiersConfig.columns.find((column) => column.id === 'materiality');
  const knowledgeColumn = representationsQualifiersMod.representationsQualifiersConfig.columns.find((column) => column.id === 'knowledge');
  assert.match(
    renderToStaticMarkup(React.createElement(React.Fragment, null, materialityColumn.renderCell(row, { primitives }))),
    /MAE-qualified/,
  );
  assert.match(
    renderToStaticMarkup(React.createElement(React.Fragment, null, knowledgeColumn.renderCell(row, { primitives }))),
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

test('representations-qualifiers config title names the reps directly (not a separate "Representation Qualifiers" section) and renders the SEC-filings/disclosure-schedule carve-out as a summary row ahead of the per-rep rows', () => {
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
  assert.equal(rows[0].id, 'representations-qualifiers-sec-carveout');
  assert.equal(rows[0].kind, 'summary');
  assert.equal(rows[0].secCutoff, 'at least one (1) business day prior to the date of this Agreement');
  assert.deepEqual(rows[0].secExcluded, [
    'disclosures contained in any part entitled "Risk Factors"',
    'any forward-looking statements',
  ]);
  assert.equal(rows[1].id, 'representations-qualifiers-org');

  const primitives = {
    PillCell: ({ label, evidence }) => React.createElement('span', { className: 'pill', 'data-evidence': evidence }, label),
  };
  const lookbackColumn = representationsQualifiersMod.representationsQualifiersConfig.columns.find((column) => column.id === 'lookback');
  const carveoutHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, lookbackColumn.renderCell(rows[0], { primitives })));
  assert.match(carveoutHtml, /Cut-off/);
  assert.match(carveoutHtml, /at least one \(1\) business day/);
  assert.match(carveoutHtml, /Portions excluded/);
  assert.match(carveoutHtml, /Risk Factors/);
  assert.match(carveoutHtml, /Disclosure Schedules: Not present/);
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
  const preventDelay = rows.find((row) => row.id === 'mae-definitions-prevent-delay');
  // fb2 #20: the disproportionate-impact clause/scope no longer render as
  // their own summary rows -- that fact now lives ONLY as the per-carve-out
  // "Disp. carveback applies" pill inside the carve-outs table itself, so
  // there is no 'mae-definitions-disproportionate' row to find at all.
  assert.equal(rows.find((row) => row.id === 'mae-definitions-disproportionate'), undefined);
  assert.equal(rows.find((row) => row.id === 'mae-definitions-disproportionate-scope'), undefined);
  assert.deepEqual(limbs.signals.map((item) => item.label), ['TWO_LIMB']);
  assert.deepEqual(carveouts.signals.map((item) => item.label), ['General economic conditions']);
  assert.deepEqual(preventDelay.signals.map((item) => item.label), ['prevent or materially delay closing']);
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const signalColumn = maeDefinitionsMod.maeDefinitionsConfig.columns.find((column) => column.id === 'signals');
  const detailColumn = maeDefinitionsMod.maeDefinitionsConfig.columns.find((column) => column.id === 'detail');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(carveouts, { primitives }))), /General economic conditions/);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, detailColumn.renderCell(preventDelay, { primitives }))), /data-evidence="Material Adverse Effect excludes/);
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
test('structure-mechanics config skips a corrupted effectiveTimeShort claim and falls back to the filing mechanic', () => {
  const rows = structureMechanicsMod.structureMechanicsConfig.selectRows({
    cards: [{
      id: 'struct-effective-time',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EFFECTIVE-TIME',
      short_title: 'Effective Time',
      primary_quote: 'The Merger shall become effective upon filing of the Certificate of Merger with the Delaware Secretary of State.',
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
test('structure-mechanics config prefers a good effectiveTimeShort on a LATER card over an earlier card\'s mainConcept', () => {
  const rows = structureMechanicsMod.structureMechanicsConfig.selectRows({
    cards: [{
      id: 'struct-effective-time-corrupted',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EFFECTIVE-TIME',
      short_title: 'Effective Time',
      primary_quote: 'The Certificate of Merger shall be filed at the Closing.',
      features: {
        effectiveTimeShort: 'Names the Company as the surviving corporation of the Merger.',
        mainConcept: 'Defines the Delaware certificate of merger to be filed at closing.',
      },
    }, {
      id: 'struct-effective-time-good',
      provision_type: 'STRUCTURE_MECHANICS',
      provision_subtype: 'STRUCT-EFFECTIVE-TIME',
      short_title: 'Effective Time',
      primary_quote: 'The Merger shall become effective upon filing of the Certificate of Merger with the Delaware Secretary of State.',
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

test('termination-rights familyGroups() groups canonical rights under Mutual / Buyer / Target headers, with absent rights flagged not-present', () => {
  const cards = [
    { id: 'outside', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-OUTSIDE', short_title: 'Outside Date', primary_quote: 'Outside date text.', features: { outsideDate: 'June 30, 2026' } },
    { id: 'breach-t', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-BREACH-T', short_title: 'Target Breach', primary_quote: 'Target breach text.', features: { curePeriod: '30 days' } },
    { id: 'superior', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-SUPERIOR', short_title: 'Superior Proposal', primary_quote: 'Superior proposal text.', features: { feeRequired: true } },
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
  const superiorRow = target.rows.find((r) => r.spec.key === 'superior');
  assert.match(superiorRow.value.join(' '), /fee payable/i);
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

test('general-covenants config still renders curated signals for a genuine COVENANT_OTHER card', () => {
  const rows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [{
      id: 'cov-efforts',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-EFFORTS',
      short_title: 'Efforts Covenant',
      primary_quote: 'The Company shall use reasonable best efforts within five business days, subject to Parent consent.',
      features: {
        effortsStandard: { code: 'REASONABLE_BEST_EFFORTS', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
        consentStandard: { code: 'PRIOR_WRITTEN_CONSENT', label: 'Prior written consent', text: 'Parent consent' },
        knowledgeQualifier: { code: 'KNOWLEDGE_QUALIFIED', label: 'Knowledge qualified', text: 'to the Company Knowledge' },
        dayCountDeadline: '5 business days',
      },
    }],
  });
  const row = rows.find((entry) => entry.label === 'General efforts standard');
  assert.ok(row, 'curated efforts row should still render for a real COVENANT_OTHER card');
  assert.deepEqual(row.signals.map((item) => item.label), [
    'Efforts: Reasonable best efforts',
    'Consent: Prior written consent: Parent consent',
    'Knowledge: Knowledge qualified: to the Company Knowledge',
    'Deadline: 5 business days',
  ]);
});

test('general-covenants config renders one row PER genuine COVENANT_OTHER clause not covered by a curated row, and excludes IOC cards from the same mix', () => {
  const rows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [
      {
        id: 'cov-parent-adopt',
        provision_type: 'COVENANT_OTHER',
        provision_subtype: 'COV-SHAPRV-PARENT',
        short_title: 'Parent Adoption of Merger Agreement',
        primary_quote: 'Parent Adoption of Merger Agreement clause text.',
        features: { mainConcept: 'Parent, as sole stockholder of Merger Sub, must adopt the merger agreement immediately.' },
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
  const parentAdopt = rows.find((row) => row.label === 'Parent Adoption of Merger Agreement');
  const maintain = rows.find((row) => row.label === 'Maintain Insurance');
  assert.ok(parentAdopt, 'a genuine COVENANT_OTHER clause not covered by a curated row should get its own per-clause row');
  assert.equal(parentAdopt.kind, 'General covenant');
  assert.equal(parentAdopt.detail, 'Parent, as sole stockholder of Merger Sub, must adopt the merger agreement immediately.');
  assert.equal(maintain, undefined, 'the IOC card must not appear here -- ioc-exceptions.config.js owns it');
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
  PillCell: ({ label, tone }) => React.createElement('span', { className: `pill ${tone || ''}`.trim() }, label),
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
  assert.match(html, /<details/, 'mainObligation prose sits behind a collapsed <details>');
  assert.match(html, /see text/);
});

test('ioc-exceptions config collapses [PROPOSED] Unclassified fragments into a single "Other restrictions" row, not empty per-row output', () => {
  const cards = [
    { id: 'frag-1', provision_type: 'COVENANT_INTERIM_OPERATING', features: { sectionNumber: '5.01(i)', restrictionComponents: ['INDEBTEDNESS', 'THIRD_PARTY_OBLIGATIONS'] } },
    { id: 'frag-2', provision_type: 'COVENANT_INTERIM_OPERATING', features: { sectionNumber: '5.01(k)' } },
    { id: 'real', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-DIVIDEND', short_title: 'Dividends and Distributions', features: { mainObligation: 'x' } },
  ];
  const fragments = iocMod.fragmentCards(cards);
  assert.equal(fragments.length, 2, 'only the two no-code fragments, not the named IOC-DIVIDEND card');
  const row = iocMod.buildOtherRestrictionsRow(fragments, { primitives: iocPrimitives });
  assert.equal(row.id, 'ioc-other-restrictions');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  assert.match(html, /2 unclassified fragments/);
  assert.match(html, /Indebtedness \/ financing/);
  assert.match(html, /no structured signal extracted/, 'the genuinely empty fragment (5.01(k)) says so, it does not fabricate a pill');
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

test('ioc-exceptions config selectRows returns rows only when IOC cards exist, and renders the General Exceptions preamble as a FOOTER (not a per-row entry)', () => {
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
  const footer = iocMod.renderIocFooter(rows, { primitives: iocPrimitives });
  const html = renderToStaticMarkup(footer);
  assert.match(html, /4 of 4/, 'all 4 canonical general-exception codes present');
  assert.match(html, /Required-by-law carve-out applies/);
});

test('ioc-exceptions config footer lists absent canonical exception codes when the deal only has a partial set', () => {
  const reviewDeal = {
    cards: [
      { id: 'ge', provision_type: 'COVENANT_INTERIM_OPERATING', provision_subtype: 'IOC-GENERAL-EXCEPTIONS', features: {
        permittedExceptions: [{ code: 'REQUIRED_BY_LAW', label: 'As required by law', text: 'as required by applicable Law' }],
      } },
    ],
  };
  const rows = iocMod.iocExceptionsConfig.selectRows(reviewDeal);
  const html = renderToStaticMarkup(iocMod.renderIocFooter(rows, { primitives: iocPrimitives }));
  assert.match(html, /1 of 4/);
  assert.match(html, /As disclosed/);
  assert.match(html, /As contemplated by this Agreement/);
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
    ThresholdCellWithHoverQuote: ({ threshold }) => React.createElement('span', { 'data-threshold': threshold }, threshold),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const bucketHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, bucketColumn.renderCell(rows[0], { primitives })));
  assert.equal((bucketHtml.match(/Indebtedness contracts/g) || []).length, 1, 'the contract-type title renders exactly once');
  const thresholdHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, thresholdColumn.renderCell(rows[0], { primitives })));
  assert.match(thresholdHtml, /data-threshold="\$5,000,000"/);
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

test('material-contracts config: with no structured threshold data, rows surface an honest "see text" fallback rather than a fabricated $ figure (punch-list #24)', () => {
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
        // extraction never populates a structured threshold, even though
        // the $2,000,000 figure is right there in the quote text.
      },
    }],
  });
  const row = rows.find((r) => r.code === 'INDEBTEDNESS');
  assert.ok(row);
  // No fabricated number -- an explicit "not captured" label instead.
  assert.equal(row.threshold, 'No $ threshold captured -- see text');
  // The $2,000,000 figure is not lost: it survives on row.evidence, which
  // ProvisionTable.jsx's FULL_TEXT_COLUMNS['material-contracts'] relocates
  // into a per-row "see text" expander (asserted structurally above), so
  // it's still reachable even though it can't render as a structured cell.
  assert.match(row.evidence, /\$2,000,000/);
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
  assert.deepEqual(rows.map((row) => row.value), [
    '12 months',
    '50%',
    'Outside date termination followed by a Company Takeover Proposal',
    'Any later qualifying proposal can trigger',
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
  assert.match(amount.detail, /\$100,000,000/);
  // §11 rebuild: the fee amount itself now leads the signals column as its
  // own pill (REBUILD-SPECS.md "Company Termination Fee [$ amount pill]"),
  // ahead of the trigger-name pills.
  assert.deepEqual(amount.signals.map((item) => item.label), ['$100,000,000', 'Company terminates to accept a Superior Proposal']);
  assert.deepEqual(feeRequired.signals.map((item) => item.label), ['Yes']);
  const termSignals = terminationFeesMod.terminationFeesConfig.columns.find((column) => column.id === 'signals');
  const termDetail = terminationFeesMod.terminationFeesConfig.columns.find((column) => column.id === 'detail');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, termSignals.renderCell(feeRequired, { primitives }))), /Yes/);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, termDetail.renderCell(amount, { primitives }))), /data-evidence="The Company shall pay a termination fee of \$100,000,000 as a condition to termination\."/);

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
  assert.ok(expenseFee, 'expense reimbursement row should render as its own row, not folded into the company fee row');
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
  assert.deepEqual(expenseFee.signals.map((item) => item.label), ['Company fails to promptly make a required payment']);
});

test('tail-fee render cells use threshold and evidence primitives', () => {
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
    ThresholdCellWithHoverQuote: ({ threshold, evidence }) => React.createElement('span', { 'data-threshold': threshold, 'data-evidence': evidence }, threshold),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const threshold = rows.find((row) => row.id === 'tail-threshold');
  const arming = rows.find((row) => row.id === 'tail-arming');
  const signalColumn = tailFeeMod.tailFeeConfig.columns.find((column) => column.id === 'signals');
  const mechanicColumn = tailFeeMod.tailFeeConfig.columns.find((column) => column.id === 'value');
  // §11 tidy: the old fourth "Evidence" column always-rendered the same
  // card quote verbatim on every row -- a straight text dump repeated once
  // per row. Evidence is still reachable via hover on the Signals/Mechanic
  // primitives themselves (both wrap their content in EvidenceHoverSource),
  // so there is no longer a dedicated evidence column at all.
  assert.equal(tailFeeMod.tailFeeConfig.columns.find((column) => column.id === 'evidence'), undefined);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(threshold, { primitives }))), /class="pill">50%</);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, mechanicColumn.renderCell(threshold, { primitives }))), /data-threshold="50%"/);
  // The long-prose "termination scenarios that arm the tail" row is not
  // crammed into a pill (pills are for enum/quantitative signals, not
  // full-sentence text dumps) -- its Signals cell renders nothing.
  assert.equal(signalColumn.renderCell(arming, { primitives }), null);
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
  assert.equal(rows.find((row) => row.id === 'nosol-superior-threshold').detail, '50');
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
  assert.match(rows.find((row) => row.id === 'nosol-superior-determiner').detail, /Company Board determines/);
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
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, noShopSignal.renderCell(noShopRows[0], { primitives }))), /solicit; knowingly encourage/);
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
