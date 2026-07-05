/* Tests for #26/#35: canonical preamble + expenses codes and Antitrust relabel. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { CODES } = require('../lib/rubric');
const { isCanonicalCode } = require('../lib/expected-sets');
const { tryDeterministic } = require('../lib/parser-v2/classify');

test('COND/TERMR preamble + MISC-EXPENSES codes are canonical', () => {
  for (const c of ['COND-M-PREAMBLE', 'COND-B-PREAMBLE', 'COND-S-PREAMBLE', 'TERMR-PREAMBLE', 'MISC-EXPENSES']) {
    assert.ok(CODES[c], `${c} in rubric`);
    assert.equal(isCanonicalCode(c), true, `${c} canonical`);
  }
});

test('queued admin Needs Code promotions are canonical where approved', () => {
  for (const c of ['REP-B-SUBSIDIARIES', 'REP-B-REALPROPERTY', 'DEF-ENVIRONMENTAL-CLAIMS']) {
    assert.ok(CODES[c], `${c} in rubric`);
    assert.equal(isCanonicalCode(c), true, `${c} canonical`);
  }
});

test('COND-M-REG is relabeled Antitrust, code kept stable', () => {
  assert.equal(CODES['COND-M-REG'].label, 'Antitrust');
  assert.ok(CODES['COND-M-REG'].aliases.includes('Scheduled Approvals'));
});

test('"Fees and Expenses" title routes deterministically to MISC-EXPENSES when the body is boilerplate', () => {
  const sec = { number: '8.03', title: 'Fees and Expenses', heading: 'Fees and Expenses', text: 'SECTION 8.03. Fees and Expenses. Except as set forth in Section 6.02, all fees shall be paid by the party incurring them.' };
  const r = tryDeterministic(sec, 'MISC');
  assert.equal(r.type, 'MISC');
  assert.equal(r.code, 'MISC-EXPENSES');
  // "Expense Reimbursement" is body-gated by the SAME discriminator (see
  // fix/termf-body-aware): with the same boilerplate body it ALSO routes to
  // MISC-EXPENSES, not TERMF — title alone no longer decides for either.
  const reimburseBoilerplate = tryDeterministic({ ...sec, title: 'Expense Reimbursement', heading: 'Expense Reimbursement' }, null);
  assert.equal(reimburseBoilerplate.type, 'MISC');
  assert.equal(reimburseBoilerplate.code, 'MISC-EXPENSES');
  // But when the body actually carries termination-fee substance, "Expense
  // Reimbursement" (and "Fees and Expenses") both resolve TERMF.
  const feeBody = 'The Company shall pay Parent the Company Termination Fee of $10,000,000, payable upon termination of this Agreement.';
  const reimburseFee = tryDeterministic({ ...sec, title: 'Expense Reimbursement', heading: 'Expense Reimbursement', text: feeBody }, null);
  assert.equal(reimburseFee.type, 'TERMF');
});

test('amendment and extension-waiver boilerplate route to existing MISC codes', () => {
  const amend = tryDeterministic({
    number: '7.3',
    title: 'Amendment',
    heading: 'Amendment',
    text: 'SECTION 7.3 Amendment. This Agreement may be amended by the parties hereto.',
  }, 'TERMINATION');
  assert.equal(amend.type, 'MISC');
  assert.equal(amend.code, 'MISC-AMEND');

  const waiver = tryDeterministic({
    number: '7.4',
    title: 'Extension; Waiver',
    heading: 'Extension; Waiver',
    text: 'SECTION 7.4 Extension; Waiver. A party may extend the time for performance or waive compliance.',
  }, 'TERMINATION');
  assert.equal(waiver.type, 'MISC');
  assert.equal(waiver.code, 'MISC-WAIVER');
});

test('queued admin Needs Code title refinements stamp approved codes', () => {
  const { refineSubCode } = require('../lib/parser-v2/classify');
  assert.equal(refineSubCode({ title: 'Subsidiaries' }, 'REP-B'), 'REP-B-SUBSIDIARIES');
  assert.equal(refineSubCode({ title: 'Real Property' }, 'REP-B'), 'REP-B-REALPROPERTY');
  assert.equal(refineSubCode({ title: 'Environmental Claims' }, 'DEF'), 'DEF-ENVIRONMENTAL-CLAIMS');
});
