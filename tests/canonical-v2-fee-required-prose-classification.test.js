'use strict';

// PLAN.md Step 3J1, condition 3: "`feeRequiredIsTruthy` counts every
// non-empty string as 'required'. Decision 6 records that 5 of 28 stored
// values are prose. A prose value meaning 'no, the fee is payable after
// termination, not as a condition', paired with a miscoded concurrent
// event, passes silently... Classify prose values or route them to
// review; never auto-truthy them."
//
// No real prose `feeRequired` value is committed anywhere in this
// repository (DECISIONS.md decision 6's own "Code" note: it is a
// V1-extraction, live-database-only field). So this pins the classifier's
// behaviour against the two kinds of prose the step's own text and
// decision 6 describe -- explicit negation of "a condition", and the
// condition-precedent / concurrent-payment language decision 5's own
// representative sentence and this programme's existing tests already use
// -- and proves the one case that matters most: unrecognised prose is
// refused, never guessed at.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  feeRequiredStatus,
  classifyFeeRequiredProse,
  paymentTriggerEventAgreesWithFeeRequired,
  assertPaymentTriggerEventAgreesWithFeeRequired,
} = require('../lib/canonical-v2/termination-product-projection');

test('booleans and empty/whitespace strings classify exactly as before -- no behaviour change for the 23 of 28 real boolean values', () => {
  assert.equal(feeRequiredStatus(true), 'REQUIRED');
  assert.equal(feeRequiredStatus(false), 'NOT_REQUIRED');
  assert.equal(feeRequiredStatus(null), 'NOT_REQUIRED');
  assert.equal(feeRequiredStatus(undefined), 'NOT_REQUIRED');
  assert.equal(feeRequiredStatus(''), 'NOT_REQUIRED');
  assert.equal(feeRequiredStatus('   '), 'NOT_REQUIRED');
});

test('condition-precedent / concurrent-payment prose -- decision 5\'s own representative sentence, and both prose strings this programme\'s existing payment-timing-split tests already pin -- still classifies REQUIRED', () => {
  assert.equal(
    classifyFeeRequiredProse('prior to or substantially concurrently with such termination'),
    'REQUIRED',
  );
  assert.equal(classifyFeeRequiredProse('payable prior to termination'), 'REQUIRED');
  assert.equal(classifyFeeRequiredProse('the Company shall have previously paid or substantially concurrently pays the fee'), 'REQUIRED');
});

// The exact phrasing PLAN.md Step 3J1 itself gives as the illustrative
// defect: "no, the fee is payable after termination, not as a condition".
test('a prose value meaning "not a condition" no longer auto-truthies -- it classifies NOT_REQUIRED', () => {
  const negationProse = 'the fee is payable after termination, not as a condition to terminating';
  assert.equal(feeRequiredStatus(negationProse), 'NOT_REQUIRED');
  assert.equal(classifyFeeRequiredProse('this is not a condition precedent to termination'), 'NOT_REQUIRED');
  assert.equal(classifyFeeRequiredProse('payment of the fee is not required prior to terminating'), 'NOT_REQUIRED');
});

test('the previously-silent quadrant: negation prose paired with a miscoded concurrent event is REFUSED as a disagreement, not read as agreement', () => {
  const negationProse = 'the fee is payable after termination, not as a condition to terminating';
  // Before this step: feeRequiredIsTruthy(negationProse) === true (any
  // non-empty string), so this call would have returned `true` (agreement)
  // -- exactly the silent failure the step names.
  assert.equal(paymentTriggerEventAgreesWithFeeRequired('CONCURRENT_WITH_TERMINATION', negationProse), false);
  assert.throws(
    () => assertPaymentTriggerEventAgreesWithFeeRequired('CONCURRENT_WITH_TERMINATION', negationProse),
    /PAYMENT_TRIGGER_FEE_REQUIRED_DISAGREEMENT/,
  );
});

test('prose matching neither pattern is refused for review -- never guessed at either way', () => {
  const ambiguousProse = 'see Section 9.2 of the Merger Agreement for further detail';
  assert.equal(feeRequiredStatus(ambiguousProse), 'REVIEW_REQUIRED');
  assert.throws(
    () => paymentTriggerEventAgreesWithFeeRequired('TERMINATION', ambiguousProse),
    /FEE_REQUIRED_PROSE_UNCLASSIFIED/,
  );
  assert.throws(
    () => assertPaymentTriggerEventAgreesWithFeeRequired('TERMINATION', ambiguousProse),
    /FEE_REQUIRED_PROSE_UNCLASSIFIED/,
  );
});
