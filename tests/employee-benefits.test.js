// FB3 missed item 1 — Employee Benefits: new dedicated section, registered
// like components/review/SecMeetingTable.js. lib/employee-benefits.js is the
// pure, dependency-free logic layer (same pattern as lib/sec-meeting.js);
// components/review/EmployeeBenefitsTable.js + the [id].js/shared.js wiring
// are JSX and asserted via source-text pattern matching (established
// convention — see tests/fb3-wiring.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

let eb;
test.before(async () => {
  eb = await import(path.join('..', 'lib', 'employee-benefits.js'));
});

// Metsera's real COV-EMPLOYEE provision (id d60cee3b-…), trimmed to the
// fields this section reads.
function metseraProvision() {
  return {
    id: 'd60cee3b-b699-49ec-8f6c-874c1252eafc',
    type: 'COV',
    category: 'Employee Matters; Benefits',
    ai_metadata: {
      code: 'COV-EMPLOYEE',
      features: {
        protectionPeriod: 'For a period of one year following the Effective Time',
        employeeBenefitPeriod: 12,
        protectionPeriodMonths: 12,
        compensationItems: [
          { item: 'BASE_SALARY', item_label: 'Base salary', standard_code: 'NO_LESS_FAVORABLE', standard_label: 'No less favorable than current', text: 'annual base salary or base wage that is no less favorable than that provided immediately prior to the Effective Time' },
          { item: 'TARGET_BONUS', item_label: 'Target annual bonus / cash incentive', standard_code: 'NO_LESS_FAVORABLE', standard_label: 'No less favorable than current', text: 'cash incentive opportunities that are no less favorable than those provided immediately prior to the Effective Time' },
          { item: 'LONG_TERM_INCENTIVE', item_label: 'Long-term incentive (LTI) / equity grants', standard_code: 'COMPARABLE_TO_BUYER_EMPLOYEES', standard_label: 'Comparable to similarly situated buyer employees', text: 'target equity compensation or long-term incentive opportunities that are no less favorable than those provided by Parent or its affiliates to similarly situated employees' },
          { item: 'SEVERANCE', item_label: 'Severance / change-in-control protection', standard_code: 'NO_LESS_FAVORABLE', standard_label: 'No less favorable than current', text: 'severance benefits that are no less favorable than those provided immediately prior to the Effective Time' },
          { item: 'OTHER_BENEFITS', item_label: 'Other benefits', standard_code: 'SUBSTANTIALLY_COMPARABLE', standard_label: 'Substantially comparable to current', text: 'other employee benefits that are substantially comparable in the aggregate to those provided immediately prior to the Effective Time' },
        ],
      },
    },
  };
}

test('isEmployeeBenefitsProvision matches on ai_metadata.code (Metsera type is generic COV)', () => {
  const p = metseraProvision();
  assert.equal(p.type, 'COV');
  assert.ok(eb.isEmployeeBenefitsProvision(p));
});

test('isEmployeeBenefitsProvision falls back to category regex when no code is present', () => {
  assert.ok(eb.isEmployeeBenefitsProvision({ category: 'Employee Benefits Continuation' }));
  assert.ok(eb.isEmployeeBenefitsProvision({ category: 'Continuing Employees' }));
  assert.ok(!eb.isEmployeeBenefitsProvision({ category: 'Indemnification' }));
  assert.ok(!eb.isEmployeeBenefitsProvision(null));
});

test('comparisonGroupForStandardCode: buyer-employee standard vs every pre-closing standard vs buyer discretion (no comparison)', () => {
  assert.equal(eb.comparisonGroupForStandardCode('COMPARABLE_TO_BUYER_EMPLOYEES'), 'Similarly-situated buyer employees');
  for (const code of ['NO_LESS_FAVORABLE', 'SUBSTANTIALLY_SIMILAR', 'SUBSTANTIALLY_COMPARABLE', 'IN_THE_AGGREGATE', 'TARGET_BASELINE']) {
    assert.equal(eb.comparisonGroupForStandardCode(code), 'Pre-closing arrangements', code);
  }
  assert.equal(eb.comparisonGroupForStandardCode('BUYER_DISCRETION'), null);
  assert.equal(eb.comparisonGroupForStandardCode(null), null);
});

test('formatContinuationPeriod appends "months" to a bare number, passes strings through', () => {
  assert.equal(eb.formatContinuationPeriod(12), '12 months');
  assert.equal(eb.formatContinuationPeriod(1), '1 month');
  assert.equal(eb.formatContinuationPeriod('For a period of one year following the Effective Time'), 'For a period of one year following the Effective Time');
  assert.equal(eb.formatContinuationPeriod(null), null);
});

test('deriveContinuationPeriod prefers the numeric protectionPeriodMonths, formatted with "months"', () => {
  const p = metseraProvision();
  const period = eb.deriveContinuationPeriod([p]);
  assert.equal(period.value, '12 months');
  assert.equal(period.provision, p);
});

test('buildElementRows: Metsera — one row PER compensationItems element, each carrying its own standard + comparison group', () => {
  const p = metseraProvision();
  const rows = eb.buildElementRows([p]);
  assert.equal(rows.length, 5);
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
  assert.equal(byCode.BASE_SALARY.standardLabel, 'No less favorable than current');
  assert.equal(byCode.BASE_SALARY.comparisonGroup, 'Pre-closing arrangements');
  assert.equal(byCode.LONG_TERM_INCENTIVE.standardLabel, 'Comparable to similarly situated buyer employees');
  assert.equal(byCode.LONG_TERM_INCENTIVE.comparisonGroup, 'Similarly-situated buyer employees');
  assert.equal(byCode.OTHER_BENEFITS.comparisonGroup, 'Pre-closing arrangements');
  assert.ok(rows.every((r) => !r.bundled), 'Metsera has a direct entry per element — nothing bundled');
  // Canonical order: Base salary before Target bonus before LTI before Severance before Other benefits.
  assert.deepEqual(rows.map((r) => r.code), ['BASE_SALARY', 'TARGET_BONUS', 'LONG_TERM_INCENTIVE', 'SEVERANCE', 'OTHER_BENEFITS']);
});

test('buildElementRows: a bundled clause (one entry covering two elements) gets a row for EACH element, sharing the same values and quote (shared hover)', () => {
  const bundled = {
    id: 'bundled-1',
    type: 'COV',
    ai_metadata: {
      code: 'COV-EMPLOYEE',
      features: {
        protectionPeriodMonths: 18,
        compensationItems: [
          {
            item: 'BASE_SALARY',
            standard_code: 'NO_LESS_FAVORABLE',
            standard_label: 'No less favorable than current',
            text: 'base salary and target bonus opportunity, in each case no less favorable than in effect immediately prior to the Effective Time',
          },
        ],
      },
    },
  };
  const rows = eb.buildElementRows([bundled]);
  assert.equal(rows.length, 2, 'both Base Salary (direct) and Target Bonus (bundled) get their own row');
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));
  assert.ok(byCode.BASE_SALARY, 'direct entry present');
  assert.ok(byCode.TARGET_BONUS, 'bundled reference pulled into its own row');
  assert.equal(byCode.TARGET_BONUS.bundled, true);
  assert.equal(byCode.BASE_SALARY.bundled, false);
  // Shared hover: same underlying text/standard, copied not invented.
  assert.equal(byCode.TARGET_BONUS.text, byCode.BASE_SALARY.text);
  assert.equal(byCode.TARGET_BONUS.quote, byCode.BASE_SALARY.quote);
  assert.equal(byCode.TARGET_BONUS.standardLabel, byCode.BASE_SALARY.standardLabel);
});

test('buildElementRows: a direct entry for a code always wins over a bundled guess for that same code', () => {
  const provs = [{
    id: 'p1',
    ai_metadata: {
      code: 'COV-EMPLOYEE',
      features: {
        compensationItems: [
          // Bundled mention of severance inside the base-salary clause...
          { item: 'BASE_SALARY', standard_code: 'NO_LESS_FAVORABLE', standard_label: 'No less favorable than current', text: 'base salary, with severance treated in the aggregate' },
          // ...but severance ALSO has its own direct, differently-standarded entry.
          { item: 'SEVERANCE', standard_code: 'SUBSTANTIALLY_COMPARABLE', standard_label: 'Substantially comparable to current', text: 'severance benefits substantially comparable in the aggregate to current arrangements' },
        ],
      },
    },
  }];
  const rows = eb.buildElementRows(provs);
  const severance = rows.find((r) => r.code === 'SEVERANCE');
  assert.equal(severance.bundled, false, 'the direct SEVERANCE entry wins, not the bundled guess from the salary clause');
  assert.equal(severance.standardLabel, 'Substantially comparable to current');
});

test('employeeBenefitsDisplayState collapses with "no data extracted" when the deal has no COV-EMPLOYEE provisions', () => {
  const state = eb.employeeBenefitsDisplayState([{ category: 'Indemnification' }]);
  assert.equal(state.collapsed, true);
  assert.match(state.collapsedText, /no data extracted/i);
  assert.equal(state.rows.length, 0);
});

test('employeeBenefitsDisplayState: Metsera — not collapsed, continuation period + 5 rows', () => {
  const state = eb.employeeBenefitsDisplayState([metseraProvision()]);
  assert.equal(state.collapsed, false);
  assert.equal(state.continuationPeriod.value, '12 months');
  assert.equal(state.rows.length, 5);
});

/* ── Wiring: registered like SecMeetingTable (source-text assertions — the
   review page and shared.js contain JSX and can't be imported under
   node --test; see tests/fb3-wiring.test.js for the established pattern). */
const sharedSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'shared.js'), 'utf8');
const reviewSrc = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
const tableSrc = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'EmployeeBenefitsTable.js'), 'utf8');

test('shared.js registers __EMPLOYEE_BENEFITS in SIDEBAR_GROUPS immediately before Other Covenants', () => {
  const start = sharedSrc.indexOf('export const SIDEBAR_GROUPS');
  const body = sharedSrc.slice(start, sharedSrc.indexOf('];', start));
  const ebIdx = body.indexOf("label: 'Employee Benefits'");
  const otherCovIdx = body.indexOf("label: 'Other Covenants'");
  const termfIdx = body.indexOf("label: 'Termination Fees'");
  assert.ok(ebIdx >= 0, 'Employee Benefits group present');
  assert.ok(termfIdx < ebIdx && ebIdx < otherCovIdx, 'Employee Benefits sits between Termination Fees and Other Covenants');
  assert.match(sharedSrc, /'__EMPLOYEE_BENEFITS'/);
});

test('shared.js treats __EMPLOYEE_BENEFITS as a synthetic single-page type (like __SEC_MEETING)', () => {
  assert.match(sharedSrc, /SYNTHETIC_SINGLE_PAGE_TYPES = new Set\(\[[^\]]*'__EMPLOYEE_BENEFITS'[^\]]*\]\)/);
});

test('pages/review/[id].js imports and mounts EmployeeBenefitsTable for the __EMPLOYEE_BENEFITS type', () => {
  assert.match(reviewSrc, /import \{ EmployeeBenefitsTable \} from '\.\.\/\.\.\/components\/review\/EmployeeBenefitsTable'/);
  assert.match(reviewSrc, /type === '__EMPLOYEE_BENEFITS' &&/);
  assert.match(reviewSrc, /<EmployeeBenefitsTable allProvisions=\{provisions\} \/>/);
});

test('pages/review/[id].js always synthesizes the __EMPLOYEE_BENEFITS sentinel (like __SEC_MEETING) so the sidebar entry never disappears', () => {
  const hits = reviewSrc.match(/groups\['__EMPLOYEE_BENEFITS'\] = \[\{ id: '__employee_benefits_sentinel__', type: '__EMPLOYEE_BENEFITS' \}\];/g) || [];
  assert.equal(hits.length, 2, 'synthesized in both provsByType and filteredProvsByType');
});

test('the dead EmployeeBenefitsTreatmentTable / buildEmployeeBenefitsSummary block was removed from pages/review/[id].js', () => {
  assert.ok(!/function EmployeeBenefitsTreatmentTable/.test(reviewSrc));
  assert.ok(!/function buildEmployeeBenefitsSummary/.test(reviewSrc));
});

test('EmployeeBenefitsTable.js renders a Continuation period row and per-element Standard/Comparison Group pills, no ":" in labels', () => {
  assert.match(tableSrc, /Continuation period/);
  assert.match(tableSrc, /row\.standardLabel/);
  assert.match(tableSrc, /row\.comparisonGroup/);
  assert.ok(!/label:\s*['"][^'"]*:/i.test(tableSrc), 'no ":" inside a literal row label');
});
