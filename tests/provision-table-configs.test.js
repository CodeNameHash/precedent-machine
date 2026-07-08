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

test('M2-08 gap configs map their core schema-card fields', () => {
  const cards = [
    { id: 'struct', provision_type: 'STRUCTURE_MECHANICS', provision_subtype: 'STRUCT-MERGER', short_title: 'Merger', features: { dealStructure: 'ONE_STEP_MERGER', closingTiming: '2 business days after conditions' } },
    { id: 'anti', provision_type: 'ANTITRUST_REGULATORY', provision_subtype: 'ANTI-HSR', short_title: 'HSR', features: { effortsStandard: 'reasonable best efforts', burdensomeConditionLimit: 'no divestiture of material assets' } },
    { id: 'mae', provision_type: 'MAE', provision_subtype: 'MAE-DEF', short_title: 'Material Adverse Effect', features: { maeLimbType: 'TWO_LIMB', disproportionateImpactClause: 'except to the extent disproportionate' } },
    { id: 'termr', provision_type: 'TERMINATION_RIGHT', provision_subtype: 'TERMR-OUTSIDE', short_title: 'Outside Date', features: { outsideDate: 'June 30, 2026', extensionAvailable: true } },
    { id: 'termf', provision_type: 'TERMINATION_FEE', provision_subtype: 'TERMF-TARGET', short_title: 'Company Fee', features: { targetTerminationFee: '$100,000,000', feeRequired: true } },
    { id: 'cov', provision_type: 'COVENANT_OTHER', provision_subtype: 'COV-ACCESS', short_title: 'Access', features: { accessRights: 'reasonable access during normal business hours', publicStatements: 'joint consent' } },
    { id: 'vote', provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-M-STOCKHOLDER', short_title: 'Stockholder Approval', features: { approvalDefinition: 'majority of outstanding shares', voteThreshold: 'majority outstanding' } },
    { id: 'misc', provision_type: 'MISC_BOILERPLATE', provision_subtype: 'MISC-EXPENSES', short_title: 'Fees and Expenses', features: { feeExpenseAllocation: 'each party bears its own expenses', governingLaw: 'Delaware' } },
    { id: 'rep', provision_type: 'REPRESENTATION', provision_subtype: 'REP-T-SEC', short_title: 'SEC Documents', features: { materialityQualifier: 'in all material respects', knowledgeQualifier: 'Company knowledge' } },
  ];
  const reviewDeal = { cards };
  assert.equal(structureMechanicsMod.structureMechanicsConfig.selectRows(reviewDeal)[0].detail, 'ONE_STEP_MERGER');
  assert.match(antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows(reviewDeal)[0].detail, /reasonable best/);
  assert.equal(maeDefinitionsMod.maeDefinitionsConfig.selectRows(reviewDeal)[0].detail, 'TWO_LIMB');
  assert.equal(terminationRightsMod.terminationRightsConfig.selectRows(reviewDeal)[0].detail, 'June 30, 2026');
  assert.equal(terminationFeesMod.terminationFeesConfig.selectRows(reviewDeal)[0].detail, '$100,000,000');
  assert.match(generalCovenantsMod.generalCovenantsConfig.selectRows(reviewDeal)[0].detail, /reasonable access/);
  assert.match(approvalsVotesMod.approvalsVotesConfig.selectRows(reviewDeal)[0].detail, /majority/);
  assert.match(advisersFeesExpensesMod.advisersFeesExpensesConfig.selectRows(reviewDeal)[0].detail, /own expenses/);
  assert.match(representationsQualifiersMod.representationsQualifiersConfig.selectRows(reviewDeal)[0].detail, /material respects/);
});

test('general-covenants config exposes efforts, consent, knowledge, and deadline signals', () => {
  const rows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [{
      id: 'cov-efforts',
      provision_type: 'COVENANT_INTERIM_OPERATING',
      provision_subtype: 'IOC-AFFIRMATIVE',
      short_title: 'Efforts Covenant',
      primary_quote: 'The Company shall use reasonable best efforts within five business days, subject to Parent consent.',
      features: {
        effortsStandard: { code: 'REASONABLE_BEST_EFFORTS', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
        consentStandard: { code: 'PRIOR_WRITTEN_CONSENT', label: 'Prior written consent', text: 'Parent consent' },
        knowledgeQualifier: { code: 'KNOWLEDGE_QUALIFIED', label: 'Knowledge qualified', text: 'to the Company Knowledge' },
        dayCountDeadline: '5 business days',
        affirmativeCovenants: 'Use reasonable best efforts within five business days.',
      },
    }],
  });
  const row = rows.find((entry) => entry.label === 'Affirmative covenants');
  assert.deepEqual(row.signals.map((item) => item.label), [
    'Efforts: Reasonable best efforts',
    'Consent: Prior written consent: Parent consent',
    'Knowledge: Knowledge qualified: to the Company Knowledge',
    'Deadline: 5 business days',
  ]);
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

test('ioc-exceptions config prefers structured feature exceptions', () => {
  const rows = iocMod.iocExceptionsConfig.selectRows({
    cards: [
      {
        id: 'ioc-general',
        provision_type: 'COVENANT_INTERIM_OPERATING',
        provision_subtype: 'IOC-GENERAL-EXCEPTIONS',
        party_scope: 'COMPANY',
        short_title: 'General Exceptions',
        features: {
          permittedExceptions: [
            { code: 'COMPANY_DISCLOSURE_LETTER', label: 'As disclosed', text: 'except as set forth in the Company Disclosure Letter' },
            { code: 'REQUIRED_BY_AGREEMENT', label: 'As contemplated by this Agreement', text: 'otherwise expressly required by this Agreement' },
            { code: 'REQUIRED_BY_LAW', label: 'As required by law', text: 'as required by applicable Law' },
            { code: 'PRIOR_WRITTEN_CONSENT', label: 'With consent', text: 'with Parent consent' },
          ],
        },
      },
      {
        id: 'ioc-neg',
        provision_type: 'COVENANT_INTERIM_OPERATING',
        provision_subtype: 'IOC-NEGATIVE-PREAMBLE',
        party_scope: 'COMPANY',
        short_title: 'Negative Preamble',
        features: {
          negativePreambleExceptions: [{ code: 'ORDINARY_COURSE', label: 'Ordinary course', text: 'ordinary course of business' }],
        },
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].party, 'Target / Company');
  assert.deepEqual(rows[0].positive.map((entry) => entry.label), [
    'As disclosed',
    'As contemplated by this Agreement',
    'As required by law',
    'With consent',
  ]);
  assert.deepEqual(rows[0].negative.map((entry) => entry.label), ['Ordinary course']);
});

test('ioc-exceptions config exposes side-level covenant signals', () => {
  const rows = iocMod.iocExceptionsConfig.selectRows({
    cards: [{
      id: 'ioc-general',
      provision_type: 'COVENANT_INTERIM_OPERATING',
      provision_subtype: 'IOC-GENERAL-EXCEPTIONS',
      party_scope: 'COMPANY',
      short_title: 'General Exceptions',
      features: {
        permittedExceptions: [{ code: 'PRIOR_WRITTEN_CONSENT', label: 'With consent', text: 'with Parent consent' }],
        effortsStandard: { code: 'REASONABLE_BEST_EFFORTS', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
        consentStandard: { code: 'PRIOR_WRITTEN_CONSENT', label: 'Prior written consent', text: 'Parent consent' },
        knowledgeQualifier: { code: 'KNOWLEDGE_QUALIFIED', label: 'Knowledge qualified', text: 'knowledge' },
        dayCountDeadline: '10 days',
      },
    }],
  });
  assert.deepEqual(rows[0].signals.map((item) => item.label), [
    'Efforts: Reasonable best efforts',
    'Consent: Prior written consent',
    'Knowledge: Knowledge qualified',
    'Deadline: 10 days',
  ]);
});

test('ioc-exceptions config falls back to splitting general-exceptions card text', () => {
  const rows = iocMod.iocExceptionsConfig.selectRows({
    cards: [
      {
        id: 'ioc-general',
        provision_type: 'COVENANT_INTERIM_OPERATING',
        provision_subtype: 'IOC-GENERAL-EXCEPTIONS',
        party_scope: 'BUYER',
        short_title: 'General Exceptions',
        primary_quote: '(i) except as set forth in the Buyer Disclosure Schedule; (ii) as required by applicable Law; (iii) with the Company consent',
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].party, 'Parent / Buyer');
  assert.deepEqual(rows[0].positive.map((entry) => entry.label), [
    'As disclosed',
    'As required by law',
    'With consent',
  ]);
});

test('ioc and covenant render cells use primitive pills and hover-source wrappers', () => {
  const primitives = {
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const iocRows = iocMod.iocExceptionsConfig.selectRows({
    cards: [{
      id: 'ioc-general',
      provision_type: 'COVENANT_INTERIM_OPERATING',
      provision_subtype: 'IOC-GENERAL-EXCEPTIONS',
      party_scope: 'BUYER',
      short_title: 'General Exceptions',
      primary_quote: 'except with Company consent',
      features: {
        permittedExceptions: [{ code: 'PRIOR_WRITTEN_CONSENT', label: 'With consent', text: 'Company consent' }],
        consentStandard: { code: 'PRIOR_WRITTEN_CONSENT', label: 'Prior written consent', text: 'Company consent' },
      },
    }],
  });
  const iocSignals = iocMod.iocExceptionsConfig.columns.find((column) => column.id === 'signals');
  const iocPositive = iocMod.iocExceptionsConfig.columns.find((column) => column.id === 'positive');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, iocSignals.renderCell(iocRows[0], { primitives }))), /Prior written consent/);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, iocPositive.renderCell(iocRows[0], { primitives }))), /data-evidence="Company consent"/);

  const covenantRows = generalCovenantsMod.generalCovenantsConfig.selectRows({
    cards: [{
      id: 'cov-efforts',
      provision_type: 'COVENANT_INTERIM_OPERATING',
      provision_subtype: 'IOC-AFFIRMATIVE',
      short_title: 'Efforts Covenant',
      primary_quote: 'The Company shall use reasonable best efforts.',
      features: {
        effortsStandard: { code: 'REASONABLE_BEST_EFFORTS', label: 'Reasonable best efforts', text: 'reasonable best efforts' },
        affirmativeCovenants: 'Use reasonable best efforts.',
      },
    }],
  });
  const covSignals = generalCovenantsMod.generalCovenantsConfig.columns.find((column) => column.id === 'signals');
  const covDetail = generalCovenantsMod.generalCovenantsConfig.columns.find((column) => column.id === 'detail');
  const row = covenantRows.find((entry) => entry.label === 'Affirmative covenants');
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, covSignals.renderCell(row, { primitives }))), /Reasonable best efforts/);
  assert.match(renderToStaticMarkup(React.createElement(React.Fragment, null, covDetail.renderCell(row, { primitives }))), /data-evidence="The Company shall use reasonable best efforts\."/);
});

test('material-contracts config maps hydrated buckets and thresholds', () => {
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
  assert.equal(rows[0].label, 'Bucket coverage');
  assert.match(rows[0].coverage, /2\/\d+ canonical buckets/);
  const bucketRows = rows.filter((row) => !row.rollup);
  assert.deepEqual(bucketRows.map((row) => row.label), [
    'Contracts above an aggregate-payments threshold',
    'Indebtedness contracts',
  ]);
  assert.deepEqual(bucketRows.map((row) => row.threshold), ['$25,000,000', '$5,000,000']);
  assert.deepEqual(bucketRows.map((row) => row.ordinal), [0, 1]);
});

test('material-contracts config falls back to canonical bucket synonyms in card text', () => {
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
  assert.ok(rows.find((row) => row.label === 'Indebtedness contracts').alsoCovered.some((item) => item.label === 'Joint ventures / partnerships'));
});

test('material-contracts render cells use rollup, ordinal, pill, checklist, threshold, and evidence primitives', () => {
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
    ComputedRollupHeader: ({ label, value }) => React.createElement('section', { 'data-rollup': label }, value),
    PillCell: ({ label }) => React.createElement('span', { className: 'pill' }, label),
    RomanNumeralOrdinal: ({ index, children }) => React.createElement('span', { 'data-ordinal': index }, children),
    CoverageChecklist: ({ items }) => React.createElement('ul', {}, items.map((item) => React.createElement('li', { key: item.id }, item.label))),
    ThresholdCellWithHoverQuote: ({ threshold }) => React.createElement('span', { 'data-threshold': threshold }, threshold),
    EvidenceHoverSource: ({ children, evidence }) => React.createElement('span', { 'data-evidence': evidence }, children),
  };
  const rollupHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, bucketColumn.renderCell(rows[0], { primitives })));
  assert.match(rollupHtml, /data-rollup="Bucket coverage"/);
  const bucketHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, bucketColumn.renderCell(rows[1], { primitives })));
  assert.match(bucketHtml, /data-ordinal="0"/);
  assert.match(bucketHtml, /Indebtedness contracts/);
  assert.match(bucketHtml, /Joint ventures \/ partnerships/);
  const thresholdHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, thresholdColumn.renderCell(rows[1], { primitives })));
  assert.match(thresholdHtml, /data-threshold="\$5,000,000"/);
  const evidenceHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, evidenceColumn.renderCell(rows[1], { primitives })));
  assert.match(evidenceHtml, /data-evidence="credit agreements and joint venture agreements"/);
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

test('nosol-noshop config maps core no-shop cards', () => {
  const rows = nosolNoshopMod.nosolNoshopConfig.selectRows({
    cards: [
      {
        id: 'prohibit',
        provision_type: 'COVENANT_NO_SOLICITATION',
        provision_subtype: 'NOSOL-PROHIBIT',
        party_scope: 'COMPANY',
        primary_quote: 'The Company shall not solicit Acquisition Proposals.',
        features: { prohibitedActions: ['solicit', 'initiate', 'knowingly encourage'] },
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
