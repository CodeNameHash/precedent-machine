const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let mod;
let iocMod;
let materialContractsMod;
let nosolFiduciaryMod;
let nosolInterveningMod;
let nosolNoshopMod;
let nosolSuperiorMod;
let tailFeeMod;
test.before(async () => {
  mod = await import(path.join('..', 'components', 'review', 'table-configs', 'conditions-m.config.js'));
  iocMod = await import(path.join('..', 'components', 'review', 'table-configs', 'ioc-exceptions.config.js'));
  materialContractsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'material-contracts.config.js'));
  nosolFiduciaryMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-fiduciary.config.js'));
  nosolInterveningMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-intervening.config.js'));
  nosolNoshopMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-noshop.config.js'));
  nosolSuperiorMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-superior.config.js'));
  tailFeeMod = await import(path.join('..', 'components', 'review', 'table-configs', 'tail-fee.config.js'));
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
  assert.deepEqual(rows.map((row) => row.label), [
    'Contracts above an aggregate-payments threshold',
    'Indebtedness contracts',
  ]);
  assert.deepEqual(rows.map((row) => row.threshold), ['$25,000,000', '$5,000,000']);
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
