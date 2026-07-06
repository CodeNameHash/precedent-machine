const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConsiderationEquityProvision,
  enforceConsiderationEquityInvariants,
} = require('../../../lib/parser-v2/consideration-equity');

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

test('Metsera Section 2.03 emits one equity provision with three own-subprovision treatments', () => {
  const extracted = buildConsiderationEquityProvision({
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
  });

  enforceConsiderationEquityInvariants(extracted);

  assert.equal(extracted.sectionRef, 'Section 2.03');
  assert.equal(extracted.treatmentGrouping, 'SEPARATE_SUBPROVISIONS');
  assert.deepEqual(extracted.treatments.map((t) => t.instrumentType), ['STOCK_OPTIONS', 'RSA', 'ESPP']);
  assert.deepEqual(extracted.treatments.map((t) => t.spanType), ['OWN_SUBPROVISION', 'OWN_SUBPROVISION', 'OWN_SUBPROVISION']);
  assert.match(extracted.treatments[1].verbatimQuote, /Restricted Stock Award.*shall vest in full/i);
  assert.match(extracted.treatments[2].verbatimQuote, /Company ESPP.*terminate/i);
});

test('Metsera-shaped options and ESPP map to sane consideration treatment enums', () => {
  const text =
    'SECTION 2.03. Treatment of Company Equity Awards. ' +
    '(i) each Company Stock Option, whether vested or unvested, outstanding and unexercised immediately prior to the Effective Time shall be canceled at the Effective Time and the holder thereof shall then become entitled to receive (A) a cash payment equal to the excess of the Closing Amount over the exercise price and (B) one (1) CVR for each share subject to such Company Stock Option; provided that any Company Stock Option that has an exercise price per share that is greater than or equal to the Closing Amount shall be canceled at the Effective Time for no consideration or payment; ' +
    '(e) Company ESPP. Prior to the Effective Time, the Company shall provide that the Company ESPP shall terminate effective no later than ten (10) business days prior to the Effective Time. The Company shall determine the rights of participants in the Company ESPP by treating a shortened offering period as a fully effective and completed offering period.';
  const extracted = buildConsiderationEquityProvision({
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    category: 'Treatment of Company Equity Awards',
    text,
    features: {
      sectionNumber: '2.03',
      outstandingInstruments: [
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'each Company Stock Option' },
        { code: 'ESPP', label: 'Employee Stock Purchase Plan rights', text: 'Company ESPP' },
      ],
      instrumentTreatments: [
        { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'each Company Stock Option, whether vested or unvested, outstanding and unexercised immediately prior to the Effective Time shall be canceled at the Effective Time and the holder thereof shall then become entitled to receive (A) a cash payment equal to the excess of the Closing Amount over the exercise price and (B) one (1) CVR for each share subject to such Company Stock Option; provided that any Company Stock Option that has an exercise price per share that is greater than or equal to the Closing Amount shall be canceled at the Effective Time for no consideration or payment', instrumentCode: 'STOCK_OPTIONS' },
        { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cashed out at Merger Consideration', text: 'The Company shall determine the rights of participants in the Company ESPP by treating a shortened offering period as a fully effective and completed offering period', instrumentCode: 'ESPP' },
      ],
      instrumentVesting: [
        { code: 'ACCEL_ELSE_DOUBLE_TRIGGER', label: 'Accelerates if it vests by its terms; otherwise rolls over subject to double-trigger vesting', text: 'same vesting schedule and terms (including double-trigger vesting protection)', instrumentCode: 'STOCK_OPTIONS' },
        { code: 'FULLY_ACCELERATED', label: 'Fully accelerated at closing', text: 'fully effective and completed offering period for all purposes under the Company ESPP', instrumentCode: 'ESPP' },
      ],
    },
  });

  const options = extracted.treatments.find((t) => t.instrumentType === 'STOCK_OPTIONS');
  const espp = extracted.treatments.find((t) => t.instrumentType === 'ESPP');

  assert.equal(options.considerationType, 'CASH');
  assert.equal(options.vestingTreatment, 'CONTINUED_VESTING');
  assert.equal(espp.considerationType, 'CANCELLATION');
  assert.equal(espp.vestingTreatment, 'CANCELLED_NO_CONSIDERATION');
});
