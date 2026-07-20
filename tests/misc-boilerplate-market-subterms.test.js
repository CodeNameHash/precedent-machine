const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let miscBoilerplateMod;
let marketMetricsMod;

test.before(async () => {
  miscBoilerplateMod = await import(path.join('..', 'components', 'review', 'table-configs', 'misc-boilerplate.config.js'));
  marketMetricsMod = await import(path.join('..', 'lib', 'market-metrics', 'adapter.js'));
});

function qxoStyleCards() {
  return [
    {
      id: 'qxo-expenses',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-EXPENSES',
      short_title: 'Expenses',
      section_ref: '4.12 | Expenses',
      primary_quote: 'Except as otherwise provided in Section 6.5, all costs and expenses shall be paid by the party incurring such expense.',
      features: {
        feeExpenseAllocation: 'Except as otherwise provided in Section 6.5, all costs and expenses shall be paid by the party incurring such expense.',
      },
    },
    {
      id: 'qxo-assignment',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-ASSIGN',
      short_title: 'Assignment; Successors',
      primary_quote: 'No party may assign without consent, except Parent may substitute a wholly owned subsidiary if doing so does not delay closing.',
      features: {
        parentAssignmentRight: true,
        parentAssignmentConditions: [{ code: 'AFFILIATE_SUBSIDIARY', label: 'Parent may assign to a wholly-owned subsidiary / affiliate' }],
        companyConsentForAssignment: true,
        assignmentRestrictions: 'No party may assign without the other parties\' prior written consent.',
        assignmentExceptions: ['Parent may substitute a wholly owned subsidiary for either merger sub.'],
        assignmentProvisos: [{ code: 'NO_DELAY_IMPEDE', label: 'Assignment must not prevent / impede / delay the closing' }],
      },
    },
    {
      id: 'qxo-third-party',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: 'MISC-THIRDPARTY',
      short_title: 'Third-Party Beneficiaries',
      primary_quote: 'There are no third-party beneficiaries except former stockholders, Financing Sources and D&O Indemnified Parties.',
      features: {
        thirdPartyBeneficiaries: ['former stockholders of the Company', 'the Financing Sources'],
        thirdPartyBeneficiaryExceptions: [
          'the right of former stockholders to receive the Per Share Merger Consideration',
          'as provided in Section 6.5 (Indemnification; Directors\' and Officers\' Insurance)',
        ],
      },
    },
    {
      id: 'qxo-dno',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: 'COV-DNO',
      short_title: 'Indemnification; Directors\' and Officers\' Insurance',
      section_ref: '6.5 | Indemnification; Directors\' and Officers\' Insurance',
      primary_quote: 'The D&O Indemnified Parties retain their indemnification rights.',
      features: {},
    },
  ];
}

function rowById(rows, id) {
  const row = rows.find((candidate) => candidate.id === id);
  assert.ok(row, `expected ${id}`);
  return row;
}

test('misc boilerplate exposes source-backed market subterms for beneficiaries, expenses and assignment', () => {
  const rows = miscBoilerplateMod.miscBoilerplateConfig.selectRows({ cards: qxoStyleCards() });
  const thirdParty = rowById(rows, 'misc-boilerplate-third-party');
  const feeExpense = rowById(rows, 'misc-boilerplate-fee-expense');
  const assignment = rowById(rows, 'misc-boilerplate-assignment');

  assert.equal(thirdParty.sourceCard.id, 'qxo-third-party');
  assert.ok(thirdParty.signals.length >= 2, 'existing beneficiary drilldown facts stay available');
  assert.deepEqual(thirdParty.marketSubterms, [
    {
      key: 'named-beneficiaries',
      label: 'Named beneficiaries',
      featureKeys: ['thirdPartyBeneficiaries'],
      kind: 'multi_select',
      role: 'treatment',
      value: {
        strategy: 'feature_value',
        featureKeys: ['thirdPartyBeneficiaries'],
        normalizer: 'third_party_beneficiary_types',
      },
    },
    {
      key: 'beneficiary-exceptions',
      label: 'Enforceable rights / carve-outs',
      featureKeys: ['thirdPartyBeneficiaryExceptions'],
      kind: 'multi_select',
      role: 'exception',
      value: {
        strategy: 'feature_value',
        featureKeys: ['thirdPartyBeneficiaryExceptions'],
        normalizer: 'third_party_enforceable_rights',
      },
    },
  ]);

  assert.equal(feeExpense.sourceCard.id, 'qxo-expenses');
  assert.match(feeExpense.baseRule, /each party bears its own expenses/i);
  assert.deepEqual(feeExpense.marketSubterms.map(({ label, featureKeys, kind, role }) => ({ label, featureKeys, kind, role })), [
    {
      label: 'Allocation terms',
      featureKeys: ['feeExpenseAllocation', 'expensesAllocation'],
      kind: 'multi_select',
      role: 'treatment',
    },
  ]);
  assert.equal(feeExpense.marketSubterms[0].value.normalizer, 'fee_expense_allocation');

  assert.equal(assignment.sourceCard.id, 'qxo-assignment');
  assert.ok(assignment.signals.some((signal) => /wholly-owned subsidiary/i.test(signal.label)));
  assert.deepEqual(assignment.marketSubterms.map(({ label, featureKeys, kind, role }) => ({ label, featureKeys, kind, role })), [
    { label: 'Assignment restrictions', featureKeys: ['assignmentRestrictions'], kind: 'multi_select', role: 'treatment' },
    { label: 'Permitted assignees / conditions', featureKeys: ['parentAssignmentConditions'], kind: 'multi_select', role: 'treatment' },
    { label: 'Consent required', featureKeys: ['companyConsentForAssignment'], kind: 'categorical', role: 'treatment' },
    { label: 'Assignment exceptions', featureKeys: ['assignmentExceptions'], kind: 'multi_select', role: 'exception' },
    { label: 'Assignment conditions / provisos', featureKeys: ['assignmentProvisos'], kind: 'multi_select', role: 'exception' },
  ]);
  assert.equal(assignment.marketSubterms[0].value.normalizer, 'assignment_restrictions');
  assert.equal(assignment.marketSubterms[3].value.normalizer, 'assignment_exceptions');
  assert.equal(assignment.marketSubterms[1].value, undefined);
  assert.equal(assignment.marketSubterms[2].value, undefined);
  assert.equal(assignment.marketSubterms[4].value, undefined);
});

test('misc boilerplate rows resolve to substantive typed market metrics, not card presence only', () => {
  const rows = miscBoilerplateMod.miscBoilerplateConfig.selectRows({ cards: qxoStyleCards() });
  const expected = new Map([
    ['misc-boilerplate-third-party', { count: 2, roles: ['treatment', 'exception'] }],
    ['misc-boilerplate-fee-expense', { count: 1, roles: ['treatment'] }],
    ['misc-boilerplate-assignment', { count: 5, roles: ['treatment', 'treatment', 'treatment', 'exception', 'exception'] }],
  ]);

  for (const [id, expectation] of expected) {
    const row = rowById(rows, id);
    const resolved = marketMetricsMod.resolveMarketMetricRow(row, { configId: 'misc-boilerplate' });
    assert.equal(resolved.resolution, 'semantic_row', `${id} should use its term-level metric manifest`);
    assert.deepEqual(resolved.errors, []);
    assert.equal(resolved.metrics.length, expectation.count + 1, 'one prevalence footer plus each substantive subterm');
    assert.equal(resolved.metrics[0].presentation.role, 'prevalence');
    assert.deepEqual(resolved.metrics.slice(1).map((metric) => metric.presentation.role), expectation.roles);
    assert.ok(resolved.metrics.slice(1).every((metric) => metric.comparison.kind !== 'presence'));
    assert.ok(resolved.metrics.slice(1).every((metric) => metric.observation.scope.provisionCodes.includes(row.sourceCard.provision_subtype)));
  }
});
