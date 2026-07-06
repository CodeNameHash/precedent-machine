const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConsiderationEquityProvision,
  enforceConsiderationEquityInvariants,
} = require('../lib/parser-v2/consideration-equity');

const METSERA_203 =
  'SECTION 2.03. Treatment of Company Equity Awards. (a) Effective as of the Effective Time, ' +
  'by virtue of the Merger and without any action on the part of any holder of a Company Stock Option, ' +
  'Company Restricted Stock Award or rights under the Company ESPP, as applicable: ' +
  '(i) each Company Stock Option outstanding immediately prior to the Effective Time shall be canceled ' +
  'and converted into the right to receive a cash payment equal to the excess of the Merger Consideration ' +
  'over the exercise price. ' +
  '(ii) each Company Restricted Stock Award outstanding immediately prior to the Effective Time shall vest ' +
  'in full and be canceled and converted into the right to receive the Merger Consideration in respect of ' +
  'each share subject thereto. ' +
  '(e) Company ESPP. Prior to the Effective Time, the Company shall take all actions necessary to cause ' +
  'the Company ESPP to terminate as of immediately prior to the Effective Time and any accumulated payroll ' +
  'deductions not used to purchase shares shall be refunded to participants.';

function metseraProvision() {
  return {
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    category: 'Treatment of Company Equity Awards',
    text: METSERA_203,
    regionId: '00000000-0000-0000-0000-000000000203',
    features: {
      sectionNumber: '2.03',
      outstandingInstruments: [
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'each Company Stock Option outstanding immediately prior to the Effective Time' },
        { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', text: 'each Company Restricted Stock Award outstanding immediately prior to the Effective Time' },
        { code: 'ESPP', label: 'Employee Stock Purchase Plan rights', text: 'Company ESPP' },
      ],
      instrumentTreatments: [
        { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'shall be canceled and converted into the right to receive a cash payment equal to the excess of the Merger Consideration over the exercise price', instrumentCode: 'STOCK_OPTIONS' },
        { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cashed out at Merger Consideration', text: 'shall vest in full and be canceled and converted into the right to receive the Merger Consideration', instrumentCode: 'RESTRICTED_STOCK' },
        { code: 'CANCELLED_NO_CONSIDERATION', label: 'Cancelled without consideration', text: 'the Company ESPP to terminate as of immediately prior to the Effective Time and any accumulated payroll deductions not used to purchase shares shall be refunded to participants', instrumentCode: 'ESPP' },
      ],
      instrumentVesting: [
        { code: 'UNSPECIFIED', label: 'Unspecified', text: 'each Company Stock Option outstanding immediately prior to the Effective Time', instrumentCode: 'STOCK_OPTIONS' },
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'shall vest in full', instrumentCode: 'RESTRICTED_STOCK' },
        { code: 'UNSPECIFIED', label: 'Unspecified', text: 'Company ESPP', instrumentCode: 'ESPP' },
      ],
    },
  };
}

test('Metsera Section 2.03 becomes one equity provision with three treatments', () => {
  const extracted = buildConsiderationEquityProvision(metseraProvision());
  enforceConsiderationEquityInvariants(extracted);

  assert.equal(extracted.sectionRef, 'Section 2.03');
  assert.equal(extracted.regionId, '00000000-0000-0000-0000-000000000203');
  assert.equal(extracted.treatmentGrouping, 'SEPARATE_SUBPROVISIONS');
  assert.deepEqual(extracted.treatments.map((t) => t.instrumentType), ['STOCK_OPTIONS', 'RSA', 'ESPP']);
  assert.deepEqual(extracted.treatments.map((t) => t.spanType), ['OWN_SUBPROVISION', 'OWN_SUBPROVISION', 'OWN_SUBPROVISION']);

  for (const treatment of extracted.treatments) {
    assert.equal(
      treatment.verbatimQuote,
      extracted.regionFullText.slice(treatment.sourceSpanStart, treatment.sourceSpanEnd),
    );
  }
});

test('PSU performance greater of target and actual is not collapsed to target only', () => {
  const text =
    'SECTION 2.04. Treatment of Company Equity Awards. ' +
    'Each Company PSU outstanding immediately prior to the Effective Time shall vest and be paid based on the greater of target and actual performance.';
  const extracted = buildConsiderationEquityProvision({
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    category: 'Treatment of Company Equity Awards',
    text,
    features: {
      sectionNumber: '2.04',
      outstandingInstruments: [
        { code: 'PSU', label: 'Performance Stock Units', text: 'Each Company PSU outstanding immediately prior to the Effective Time' },
      ],
      instrumentTreatments: [
        { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cashed Out', text: 'shall vest and be paid based on the greater of target and actual performance', instrumentCode: 'PSU' },
      ],
      instrumentVesting: [
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'shall vest', instrumentCode: 'PSU' },
      ],
      performanceTreatment: { text: 'greater of target and actual performance' },
    },
  });

  enforceConsiderationEquityInvariants(extracted);
  assert.equal(extracted.treatments[0].instrumentType, 'PSU');
  assert.equal(extracted.treatments[0].performanceTreatment, 'ACTUAL_PERFORMANCE');
  assert.match(extracted.treatments[0].verbatimQuote, /greater of target and actual performance/i);
});

test('quote fidelity invariant rejects fabricated treatment quotes', () => {
  const extracted = buildConsiderationEquityProvision(metseraProvision());
  extracted.treatments[0].verbatimQuote = 'fabricated';
  assert.throws(() => enforceConsiderationEquityInvariants(extracted), /quote fidelity/i);
});
