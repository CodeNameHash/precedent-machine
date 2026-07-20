const test = require('node:test');
const assert = require('node:assert/strict');

const { extractClaimValues } = require('../lib/row-market-stats/observations');

function observedValues(normalizer, featureKey, raw, linkedEvidence = null) {
  const claim = {
    id: `${featureKey}-claim`,
    deal_id: 'deal-1',
    attribute: featureKey,
    canonical: null,
    verbatim: typeof raw === 'string' ? raw : JSON.stringify(raw),
    evidence_quote: linkedEvidence,
    provenance: { feature_value: raw },
  };
  const metric = {
    comparison: { kind: 'multi_select' },
    observation: {
      value: {
        strategy: 'feature_value',
        featureKeys: [featureKey],
        normalizer,
      },
    },
  };
  return extractClaimValues(claim, metric, linkedEvidence).map((item) => item.value);
}

function assertFiniteCodes(values, rawFragments) {
  assert.ok(values.length > 0);
  assert.ok(values.every((value) => /^[A-Z0-9_]+$/.test(value)));
  for (const fragment of rawFragments) {
    assert.ok(values.every((value) => !String(value).includes(fragment)));
  }
}

test('third-party beneficiary normalizers compare beneficiary and enforceable-right types, never names or clauses', () => {
  const beneficiaries = observedValues('third_party_beneficiary_types', 'thirdPartyBeneficiaries', [
    'former stockholders of the Company',
    'holders of Company Options and Company RSUs',
    'D&O Indemnified Parties',
    'Debt Financing Sources',
    'Continuing Employees',
    'the Special Committee',
    'the Rights Agent under the CVR Agreement',
  ]);
  assert.deepEqual(beneficiaries, [
    'TARGET_SECURITYHOLDERS',
    'EQUITY_AWARD_HOLDERS',
    'INDEMNIFIED_PERSONS',
    'FINANCING_SOURCES',
    'EMPLOYEES_OR_SERVICE_PROVIDERS',
    'SPECIAL_COMMITTEE',
    'CVR_RIGHTS_PARTIES',
  ]);
  assertFiniteCodes(beneficiaries, ['stockholders of the Company', 'Debt Financing Sources']);

  const rights = observedValues('third_party_enforceable_rights', 'thirdPartyBeneficiaryExceptions', [
    'the right of former stockholders to receive the Merger Consideration',
    'the right of Company Options and RSUs to receive payment',
    'D&O Indemnified Parties may enforce their indemnification and insurance rights',
    'the Debt Financing Sources may enforce the financing provisions',
    'rights under the CVR Agreement',
    'the Company may pursue damages based on loss of the economic benefit of the transaction',
  ]);
  assert.deepEqual(rights, [
    'MERGER_CONSIDERATION_RIGHTS',
    'EQUITY_AWARD_PAYMENT_RIGHTS',
    'CVR_PAYMENT_OR_AGREEMENT_RIGHTS',
    'INDEMNIFICATION_AND_INSURANCE_RIGHTS',
    'FINANCING_SOURCE_PROTECTIONS',
    'DAMAGES_OR_TERMINATION_PAYMENT_RIGHTS',
  ]);
  assertFiniteCodes(rights, ['receive the Merger Consideration', 'financing provisions']);
});

test('fee and expense normalizer emits the base rule plus payer-specific exception categories', () => {
  const clause = 'Each party shall bear its own expenses, except that all printing and mailing costs for the Form S-4 and all HSR filing fees shall be borne by Parent. Transfer taxes shall be paid by Parent. Parent shall pay all Paying Agent fees.';
  const values = observedValues('fee_expense_allocation', 'feeExpenseAllocation', clause);
  assert.deepEqual(values, [
    'EACH_PARTY_BEARS_OWN_EXPENSES',
    'BUYER_BEARS_TRANSFER_TAXES',
    'BUYER_BEARS_REGULATORY_FILING_FEES',
    'BUYER_BEARS_PROXY_AND_REGISTRATION_COSTS',
    'BUYER_BEARS_PAYING_AGENT_FEES',
  ]);
  assertFiniteCodes(values, ['Each party shall bear', 'Form S-4']);

  const shared = observedValues(
    'fee_expense_allocation',
    'feeExpenseAllocation',
    'The parties shall share equally all fees and expenses for printing and filing the Form S-4 and Joint Proxy Statement.',
  );
  assert.deepEqual(shared, ['SHARED_PROXY_AND_REGISTRATION_COSTS']);
});

test('assignment normalizers expose restriction mechanics and exception types without raw prose', () => {
  const restrictions = observedValues(
    'assignment_restrictions',
    'assignmentRestrictions',
    'Neither this Agreement nor any rights, interests or obligations may be assigned, delegated or otherwise transferred by any party without the prior written consent of the other parties; any purported assignment is void.',
  );
  assert.deepEqual(restrictions, [
    'MUTUAL_ASSIGNMENT_RESTRICTION',
    'PRIOR_WRITTEN_CONSENT_REQUIRED',
    'RIGHTS_AND_OBLIGATIONS_RESTRICTED',
    'DELEGATION_OR_TRANSFER_RESTRICTED',
    'NONCOMPLIANT_ASSIGNMENT_VOID',
  ]);
  assertFiniteCodes(restrictions, ['Neither this Agreement', 'prior written consent']);

  const exceptions = observedValues('assignment_exceptions', 'assignmentExceptions', [
    'Parent may assign its rights but not its obligations to a wholly owned Subsidiary.',
    'Parent may pledge this Agreement to a Financing Source as collateral.',
    'Following the Effective Time, assignment is permitted in connection with a merger or consolidation or a disposition of all or substantially all assets.',
    'Parent may designate another wholly owned subsidiary in lieu of Merger Sub.',
  ]);
  assert.deepEqual(exceptions, [
    'FINANCING_SOURCE_OR_COLLATERAL_ASSIGNMENT',
    'BUYER_AFFILIATE_OR_SUBSIDIARY_ASSIGNMENT',
    'MERGER_SUB_REPLACEMENT',
    'POST_CLOSING_SUCCESSOR_TRANSACTION',
    'RIGHTS_ONLY_ASSIGNMENT',
  ]);
  assertFiniteCodes(exceptions, ['wholly owned Subsidiary', 'Financing Source']);

  const fallback = observedValues('assignment_exceptions', 'assignmentExceptions', 'assignment permitted in the circumstances described in Section 9.7');
  assert.deepEqual(fallback, ['OTHER_EXPRESS_ASSIGNMENT_EXCEPTION']);
});
