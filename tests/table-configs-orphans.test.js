// WP-PARITY-ORPHANS — tests for the render homes added to close the
// "whole sub-sections legacy showed that NO current config renders" gap
// found by the Metsera parity audit (root cause 4), plus the nosol-noshop
// stale-key reconciliation. Each test asserts: attribute present on a
// realistic card -> row renders (not just that selectRows doesn't throw).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let structureMechanicsMod;
let employeeBenefitsMod;
let advisersFeesExpensesMod;
let miscBoilerplateMod;
let nosolFiduciaryMod;
let nosolNoshopMod;
let conditionsMod;
let antitrustRegulatoryMod;
let representationsQualifiersMod;

test.before(async () => {
  structureMechanicsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'structure-mechanics.config.js'));
  employeeBenefitsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'employee-benefits.config.js'));
  advisersFeesExpensesMod = await import(path.join('..', 'components', 'review', 'table-configs', 'advisers-fees-expenses.config.js'));
  miscBoilerplateMod = await import(path.join('..', 'components', 'review', 'table-configs', 'misc-boilerplate.config.js'));
  nosolFiduciaryMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-fiduciary.config.js'));
  nosolNoshopMod = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-noshop.config.js'));
  conditionsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'conditions-m.config.js'));
  antitrustRegulatoryMod = await import(path.join('..', 'components', 'review', 'table-configs', 'antitrust-regulatory.config.js'));
  representationsQualifiersMod = await import(path.join('..', 'components', 'review', 'table-configs', 'representations-qualifiers.config.js'));
});

test('employee-benefits renders the ERISA checklist even when compensationItems takes the structured path (Metsera regression: erisa* was unread anywhere)', () => {
  const benefitsCard = {
    id: 'employee-benefits',
    provision_subtype: 'COV-EMPLOYEE',
    primary_quote: 'Continuing Employees shall receive compensation and benefits protections.',
    features: {
      compensationItems: [{
        benefit_types: [{ code: 'BASE_SALARY', label: 'Base salary' }],
        standard_codes: ['NO_LESS_FAVORABLE'],
        standard_labels: ['No less favourable'],
        text: 'base salary no less favourable',
      }],
    },
  };
  const erisaCard = {
    id: 'erisa-rep',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-T-BENEFITS',
    short_title: 'Employee Benefit Plans; ERISA',
    primary_quote: 'Each material Company Benefit Plan is and has at all times been maintained in compliance with ERISA.',
    features: {
      erisaCompliance: 'maintained, operated and administered in compliance with ERISA',
      erisaParachutePayments: 'could constitute an "excess parachute payment" within the meaning of Section 280G',
      erisaPlansListed: true,
      erisaTitleIVPlans: true,
      erisaMultiemployer: true,
    },
  };
  const rows = employeeBenefitsMod.employeeBenefitsConfig.selectRows({ cards: [benefitsCard, erisaCard] });
  assert.ok(rows.some((row) => row.benefit === 'Base salary'), 'structured compensationItems row should still render');
  // ERISA checklist is intentionally HIDDEN per review ("not important; just
  // hide it"). The keys/isErisaCard remain in the config for a possible future
  // standalone table, but no ERISA row is emitted into the benefits table.
  const erisaRows = rows.filter((row) => row.id.startsWith('employee-benefits-erisa'));
  assert.equal(erisaRows.length, 0, 'ERISA checklist rows must not render in the benefits table (hidden per review)');
});

test('employee-benefits renders 401(k) continuation (Skechers cross-deal gap) alongside fallback rows', () => {
  const benefitsCard = {
    id: 'employee-benefits-401k',
    provision_subtype: 'COV-EMPLOYEE',
    primary_quote: 'If Parent gives notice, the Company shall terminate its 401(k) plan.',
    features: {
      continued401k: 'If Parent gives notice at least ten Business Days before the Effective Time, the Company must terminate its 401(k) plan',
    },
  };
  const rows = employeeBenefitsMod.employeeBenefitsConfig.selectRows({ cards: [benefitsCard] });
  const row = rows.find((r) => r.id === 'employee-benefits-continued401k');
  assert.ok(row, 'continued401k should render a row');
  assert.match(row.detail, /401\(k\)/);
});

// FEEDBACK-2-PUNCHLIST.md item 45: Specific performance and the Assignment
// group don't belong on Advisers / Fees / Expenses -- they're Miscellaneous
// / boilerplate provisions. These two regression tests moved to
// misc-boilerplate accordingly (5-key intent preserved).
test('misc-boilerplate renders the Assignment group (5 keys, Metsera regression: whole sub-section had no rows)', () => {
  const assignmentCard = {
    id: 'assignment',
    provision_type: 'MISC_BOILERPLATE',
    provision_subtype: 'MISC-ASSIGN',
    short_title: 'Assignment; Successors',
    primary_quote: 'Neither this Agreement nor any rights hereunder shall be assigned without prior written consent, except that Merger Sub may assign to an affiliate.',
    features: {
      parentAssignmentRight: true,
      parentAssignmentConditions: 'Merger Sub may assign, in its sole discretion, any of or all its rights, interests and obligations under this Agreement to an affiliate',
      companyConsentForAssignment: true,
      assignmentExceptions: 'Merger Sub may assign to an affiliate without Company consent',
      assignmentRestrictions: 'Neither this Agreement nor any rights, interests or obligations shall be assigned without prior written consent',
    },
  };
  const rows = miscBoilerplateMod.miscBoilerplateConfig.selectRows({ cards: [assignmentCard] });
  const assignmentRows = rows.filter((row) => row.kind === 'Assignment');
  assert.equal(assignmentRows.length, 5, 'all five Assignment-group keys should render rows');
  assert.deepEqual(new Set(assignmentRows.map((row) => row.label)), new Set([
    'Parent assignment right',
    'Parent assignment conditions',
    'Company consent for assignment',
    'Assignment exceptions',
    'Assignment restrictions',
  ]));
});

test('misc-boilerplate renders specific performance limitations (Skechers cross-deal gap)', () => {
  const spCard = {
    id: 'sp',
    provision_type: 'MISC_BOILERPLATE',
    provision_subtype: 'MISC-SPECIFIC',
    short_title: 'Specific Performance; Enforcement',
    primary_quote: 'Although the Company may pursue both a grant of specific performance and monetary damages, under no circumstances shall the Company be entitled to receive both.',
    features: {
      specificPerformanceLimitations: 'under no circumstances shall the Company be entitled to receive both a grant of specific performance and monetary damages',
    },
  };
  const rows = miscBoilerplateMod.miscBoilerplateConfig.selectRows({ cards: [spCard] });
  const row = rows.find((r) => r.label === 'Specific performance limitations');
  assert.ok(row, 'specificPerformanceLimitations should render a row');
});

test('nosol-fiduciary renders changeOfRecommendationItems and notChangeOfRecommendationItems (Metsera regression: dropped, no row)', () => {
  const recCard = {
    id: 'change-of-rec',
    provision_type: 'COVENANT_NO_SOLICITATION',
    provision_subtype: 'NOSOL-RECOMMEND',
    short_title: 'Change of Recommendation',
    primary_quote: 'The Company Board shall not withdraw, amend, or qualify the Company Board Recommendation.',
    features: {
      changeOfRecommendationItems: [
        'withdraw, amend, change, qualify or modify in a manner adverse to Parent',
        'fail to make the Company Board Recommendation in the Proxy Statement',
      ],
      notChangeOfRecommendationItems: [
        "disclosure of information to the Company's stockholders that solely describes the Company's position",
      ],
    },
  };
  const rows = nosolFiduciaryMod.nosolFiduciaryConfig.selectRows({ cards: [recCard] });
  const changeRow = rows.find((row) => row.id === 'nosol-fiduciary-change-of-rec-items');
  const notChangeRow = rows.find((row) => row.id === 'nosol-fiduciary-not-change-of-rec-items');
  // Round-5 (Ben): the A–E list is summarized to one crisp pill per limb
  // (verbatim kept as each pill's hover evidence), not a single first-limb
  // "see text" pill.
  assert.ok(changeRow, 'changeOfRecommendationItems should render a row');
  assert.equal(changeRow.items.length, 2);
  const changeLabels = changeRow.items.map((item) => item.label);
  assert.ok(changeLabels.some((l) => /Withdraw, qualify or modify the Board Recommendation/.test(l)));
  assert.ok(changeLabels.some((l) => /Recommendation in the Proxy Statement/.test(l)));
  assert.match(changeRow.items[0].evidence, /withdraw, amend/);
  assert.ok(notChangeRow, 'notChangeOfRecommendationItems should render a row');
  assert.match(notChangeRow.items[0].label, /Factual disclosures to stockholders/);
});

test('nosol-noshop prohibit row reads the real ceaseDiscussionsProhibitedList attribute, not the stale noShopType/prohibitedActions/mainRestriction keys', () => {
  const prohibitCard = {
    id: 'prohibit',
    provision_type: 'COVENANT_NO_SOLICITATION',
    provision_subtype: 'NOSOL-PROHIBIT',
    short_title: 'Solicitation Prohibition',
    primary_quote: 'The Company shall not directly or indirectly solicit, initiate or knowingly encourage the making of a Company Takeover Proposal.',
    features: {
      ceaseDiscussionsProhibitedList: [
        'directly or indirectly participate in any discussions or negotiations',
        'directly or indirectly solicit, initiate or knowingly encourage',
      ],
      // Stale keys the old ROWS entry used to read — should have NO effect.
      noShopType: 'should not be read',
      prohibitedActions: ['should not be read either'],
      mainRestriction: 'should not be read either',
    },
  };
  const rows = nosolNoshopMod.nosolNoshopConfig.selectRows({ cards: [prohibitCard] });
  const prohibit = rows.find((row) => row.id === 'nosol-noshop-prohibit');
  assert.ok(prohibit);
  assert.match(prohibit.detail, /directly or indirectly participate/);
  assert.doesNotMatch(prohibit.detail, /should not be read/);
});

// FEEDBACK-4-PUNCHLIST.md WS-G #1b: real deals (Metsera) leave
// ceaseDiscussionsProhibitedList unpopulated, so the individual prohibited
// acts have to come from keyword detection over the verbatim "shall not ...
// solicit, initiate or knowingly facilitate ... furnish ... information ...
// participate in discussions" clause -- each act renders as its own pill,
// never one semicolon-joined blob.
test('nosol-noshop prohibit row splits the verbatim prohibition clause into individual act pills when no structured claim exists', () => {
  const prohibitCard = {
    id: 'prohibit-metsera-shaped',
    provision_type: 'COVENANT_NO_SOLICITATION',
    provision_subtype: 'NOSOL-PROHIBIT',
    short_title: 'Solicitation Prohibition',
    primary_quote: 'The Company shall not, directly or indirectly, (i) solicit, initiate or knowingly encourage or knowingly facilitate the making of any inquiry, offer or proposal which constitutes a Company Takeover Proposal or (ii) participate in any discussions or negotiations regarding, or furnish to any Person any information with respect to, any Company Takeover Proposal.',
    features: {},
  };
  const rows = nosolNoshopMod.nosolNoshopConfig.selectRows({ cards: [prohibitCard] });
  const prohibit = rows.find((row) => row.id === 'nosol-noshop-prohibit');
  assert.ok(prohibit);
  assert.ok(Array.isArray(prohibit.acts), 'row.acts should be populated from keyword detection');
  assert.deepEqual(prohibit.acts.map((act) => act.label), [
    'Solicit',
    'Initiate',
    'Knowingly facilitate / encourage',
    'Provide information',
    'Engage in discussions or negotiations',
  ]);

  const PillCell = ({ label }) => React.createElement('span', { className: 'pill' }, label);
  const signalColumn = nosolNoshopMod.nosolNoshopConfig.columns.find((column) => column.id === 'signals');
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, signalColumn.renderCell(prohibit, { primitives: { PillCell } })));
  assert.equal((html.match(/class="pill"/g) || []).length, 5, 'each prohibited act renders as its own pill, not one joined string');
  assert.match(html, /class="pill">Solicit</);
  assert.match(html, /class="pill">Engage in discussions or negotiations</);
});

// WS-G #1c: exceptions must read as plain lawyer language describing what
// the exception actually permits, not the raw statutory clause dumped
// inline.
test('nosol-noshop exceptions row describes each carve-out in plain lawyer language, not raw statutory text', () => {
  const exceptCard = {
    id: 'except-metsera-shaped',
    provision_type: 'COVENANT_NO_SOLICITATION',
    provision_subtype: 'NOSOL-EXCEPT',
    short_title: 'Exceptions / Fiduciary Out',
    primary_quote: 'the Company may contact the Person making any Company Takeover Proposal solely to clarify the terms and conditions thereof, and in response to a Qualifying Company Takeover Proposal, the Company may (A) furnish information with respect to the Company to such Person pursuant to an Acceptable Confidentiality Agreement so long as the Company also provides Parent, within twenty-four (24) hours, and (B) participate in discussions or negotiations with such Person regarding such Qualifying Company Takeover Proposal.',
    features: {},
  };
  const rows = nosolNoshopMod.nosolNoshopConfig.selectRows({ cards: [exceptCard] });
  const exceptions = rows.find((row) => row.id === 'nosol-noshop-exceptions');
  assert.ok(exceptions);
  assert.deepEqual(exceptions.exceptionItems, [
    "Contact the bidder solely to clarify the proposal's terms, or request that an oral proposal be put in writing",
    'Furnish confidential information to a Qualifying bidder under an Acceptable Confidentiality Agreement (Parent must receive the same information within 24 hours)',
    'Participate in discussions or negotiations with a Qualifying bidder',
  ]);
  for (const item of exceptions.exceptionItems) {
    assert.doesNotMatch(item, /Person making|thereof|pursuant to/i, 'exception text must be plain language, not lifted statutory phrasing');
  }
});

test('nosol-noshop renders the dontAskDontWaive standstill-enforcement row (Skechers cross-deal gap)', () => {
  const enforceCard = {
    id: 'enforce',
    provision_type: 'COVENANT_NO_SOLICITATION',
    provision_subtype: 'NOSOL-ENFORCE',
    short_title: 'Enforcement of Standstills',
    primary_quote: 'The Company shall not waive, terminate, modify or fail to enforce any standstill provision.',
    features: {
      dontAskDontWaive: false,
    },
  };
  const rows = nosolNoshopMod.nosolNoshopConfig.selectRows({ cards: [enforceCard] });
  const row = rows.find((r) => r.id === 'nosol-noshop-standstill-enforce');
  assert.ok(row, "don't-ask-don't-waive row should render");
  assert.equal(row.detail, 'No');
});

test('conditions-m surfaces governmentProceedingConditionPresent as a signal on the No Legal Impediment row (Skechers cross-deal gap)', () => {
  const legalCard = {
    id: 'legal',
    provision_type: 'CLOSING_CONDITION',
    provision_subtype: 'COND-M-LEGAL',
    short_title: 'No Legal Impediment',
    primary_quote: 'No injunction, order, or Legal Restraint of a Governmental Authority shall be in effect, and no Action by a Governmental Authority shall be pending.',
    features: {
      governmentProceedingConditionPresent: true,
    },
  };
  const rows = conditionsMod.conditionsMConfig.selectRows({ cards: [legalCard] });
  const row = rows.find((r) => r.label === 'No Injunctions / Legal Restraints');
  assert.ok(row);
  assert.ok(row.signals.some((signal) => signal.label.startsWith('Government proceeding')), 'governmentProceedingConditionPresent should surface as a signal');
});

test('antitrust-regulatory renders divestitureInCondition as a qualifier on the Divestiture cap row (Skechers cross-deal gap; consolidated per REBUILD-SPECS.md §8)', () => {
  const burdenCard = {
    id: 'burden',
    provision_type: 'ANTITRUST_REGULATORY',
    provision_subtype: 'ANTI-BURDEN',
    short_title: 'Burden Cap / Divestiture Limits',
    primary_quote: "Buyer's remedy obligation is capped by adverse effect on the Company Group, taken as a whole.",
    features: {
      divestitureInCondition: true,
    },
  };
  const rows = antitrustRegulatoryMod.antitrustRegulatoryConfig.selectRows({ cards: [burdenCard] });
  const row = rows.find((r) => r.label === 'Divestiture cap');
  assert.ok(row, 'divestitureInCondition should still surface a row even with no divestitureCapDescription claim');
  assert.ok(
    row.signals.some((signal) => signal.label === 'Required before consummation'),
    'divestitureInCondition should render as a qualifier pill on the consolidated Divestiture cap row',
  );
});

test('representations-qualifiers renders the solvency representation (Skechers cross-deal gap, PE financing) even with no materiality/knowledge/lookback qualifier data', () => {
  const solvencyCard = {
    id: 'solvency',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-B-SOLVENCY',
    short_title: 'Solvency',
    primary_quote: 'Neither Parent nor Merger Sub is entering into this Agreement with the intent to hinder, delay or defraud creditors.',
    features: {
      solvencyRepPresent: true,
      solvencyRepIncluded: true,
      solvencyRepDetails: 'Neither Parent nor Merger Sub is entering into this Agreement or the transactions contemplated hereby with the intent to hinder, delay or defraud creditors',
    },
  };
  // R5 (Feedback round 4): REP-B-SOLVENCY is a Parent/Buyer rep -- it renders
  // on parentRepresentationsConfig now, not the Company table.
  const rows = representationsQualifiersMod.parentRepresentationsConfig.selectRows({ cards: [solvencyCard] });
  const row = rows.find((r) => r.card && r.card.id === 'solvency');
  assert.ok(row, 'solvency representation should render a row even without a materiality/knowledge/lookback claim');
  assert.match(row.label, /Solvency/);
  assert.equal(row.party, 'Parent');
  assert.match(row.mainConcept, /hinder, delay or defraud/);
});
