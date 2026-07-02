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

test('COND-M-REG is relabeled Antitrust, code kept stable', () => {
  assert.equal(CODES['COND-M-REG'].label, 'Antitrust');
  assert.ok(CODES['COND-M-REG'].aliases.includes('Scheduled Approvals'));
});

test('"Fees and Expenses" title routes deterministically to MISC-EXPENSES', () => {
  const sec = { number: '8.03', title: 'Fees and Expenses', heading: 'Fees and Expenses', text: 'SECTION 8.03. Fees and Expenses. Except as set forth in Section 6.02, all fees shall be paid by the party incurring them.' };
  const r = tryDeterministic(sec, 'MISC');
  assert.equal(r.type, 'MISC');
  assert.equal(r.code, 'MISC-EXPENSES');
  // "Expense Reimbursement" must NOT match (TERMF territory).
  assert.notEqual((tryDeterministic({ ...sec, title: 'Expense Reimbursement', heading: 'Expense Reimbursement' }, null) || {}).code, 'MISC-EXPENSES');
});
