const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConsiderationEquityProvision,
  enforceConsiderationEquityInvariants,
} = require('../../../lib/parser-v2/consideration-equity');

const GROUPED =
  'SECTION 2.03. Treatment of Company Equity Awards. Each Company Stock Option and each Company Restricted Stock Award ' +
  'outstanding immediately prior to the Effective Time shall vest in full and be canceled and converted into the right ' +
  'to receive a cash payment equal to the Merger Consideration less any applicable exercise price.';

test('synthetic grouped-prose consideration emits shared-sentence treatment spans', () => {
  const sharedTreatment =
    'Each Company Stock Option and each Company Restricted Stock Award outstanding immediately prior to the Effective Time shall vest in full and be canceled and converted into the right to receive a cash payment equal to the Merger Consideration less any applicable exercise price';

  const extracted = buildConsiderationEquityProvision({
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    category: 'Treatment of Company Equity Awards',
    text: GROUPED,
    regionId: '00000000-0000-0000-0000-000000000302',
    features: {
      sectionNumber: '2.03',
      outstandingInstruments: [
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' },
        { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', text: 'Company Restricted Stock Award' },
      ],
      instrumentTreatments: [
        { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: sharedTreatment, instrumentCode: 'STOCK_OPTIONS' },
        { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cashed out at Merger Consideration', text: sharedTreatment, instrumentCode: 'RESTRICTED_STOCK' },
      ],
      instrumentVesting: [
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'shall vest in full', instrumentCode: 'STOCK_OPTIONS' },
        { code: 'FULLY_ACCELERATED', label: 'Fully Accelerated', text: 'shall vest in full', instrumentCode: 'RESTRICTED_STOCK' },
      ],
    },
  });

  enforceConsiderationEquityInvariants(extracted);

  assert.equal(extracted.treatmentGrouping, 'GROUPED_PROSE');
  assert.deepEqual(extracted.treatments.map((t) => t.instrumentType), ['STOCK_OPTIONS', 'RSA']);
  assert.deepEqual(extracted.treatments.map((t) => t.spanType), ['SHARED_SENTENCE', 'SHARED_SENTENCE']);
  assert.equal(extracted.treatments[0].sourceSpanStart, extracted.treatments[1].sourceSpanStart);
  assert.equal(extracted.treatments[0].sourceSpanEnd, extracted.treatments[1].sourceSpanEnd);
  assert.equal(extracted.treatments[0].verbatimQuote, extracted.treatments[1].verbatimQuote);
});

test('joint numbered limb emits shared-paragraph spans and hybrid grouping', () => {
  const text =
    'SECTION 3.06. Company RSUs; Company PSUs; Company Options. ' +
    '(i) Each Vested Company RSU or Vested Company PSU that is outstanding and has not yet been settled as of the Effective Time shall terminate and be converted into the right to receive cash. ' +
    '(ii) Each Vested Company Option that is outstanding as of immediately prior to the Effective Time shall terminate and be converted into the right to receive the Option Consideration. ' +
    '(iii) Each Unvested Company PSU or Unvested Company Option that is outstanding as of immediately prior to the Effective Time shall automatically be cancelled and no payment shall be made with respect thereto.';

  const sharedTreatment =
    'Each Unvested Company PSU or Unvested Company Option that is outstanding as of immediately prior to the Effective Time shall automatically be cancelled and no payment shall be made with respect thereto';

  const extracted = buildConsiderationEquityProvision({
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    category: 'Treatment of Company Equity Awards',
    text,
    regionId: '00000000-0000-0000-0000-000000000306',
    features: {
      sectionNumber: '3.06',
      outstandingInstruments: [
        { code: 'RSUs', label: 'Restricted Stock Units', text: 'Vested Company RSU' },
        { code: 'PSUs', label: 'Performance Stock Units', text: 'Unvested Company PSU' },
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Unvested Company Option' },
      ],
      instrumentTreatments: [
        { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cashed out at Merger Consideration', text: 'Each Vested Company RSU or Vested Company PSU that is outstanding and has not yet been settled as of the Effective Time shall terminate and be converted into the right to receive cash', instrumentCode: 'RSUs' },
        { code: 'CANCELLED_NO_CONSIDERATION', label: 'Cancelled without consideration', text: sharedTreatment, instrumentCode: 'PSUs' },
        { code: 'CANCELLED_NO_CONSIDERATION', label: 'Cancelled without consideration', text: sharedTreatment, instrumentCode: 'STOCK_OPTIONS' },
      ],
    },
  });

  enforceConsiderationEquityInvariants(extracted);

  const psu = extracted.treatments.find((t) => t.instrumentType === 'PSU');
  const option = extracted.treatments.find((t) => t.instrumentType === 'STOCK_OPTIONS');

  assert.equal(extracted.treatmentGrouping, 'HYBRID');
  assert.equal(psu.spanType, 'SHARED_PARAGRAPH');
  assert.equal(option.spanType, 'SHARED_PARAGRAPH');
  assert.equal(psu.sourceSpanStart, option.sourceSpanStart);
  assert.equal(psu.sourceSpanEnd, option.sourceSpanEnd);
  assert.equal(psu.verbatimQuote, option.verbatimQuote);
});

test('positional treatment arrays are paired before instrument display ordering', () => {
  const text =
    'SECTION 3.06. Company RSUs; Company PSUs; Company Options. ' +
    '(i) Vested Company RSUs; Vested Company PSUs. Each Vested Company RSU or Vested Company PSU shall be converted into cash. ' +
    '(ii) Vested Company Options. Each Vested Company Option shall be converted into the Option Consideration. ' +
    '(iii) Unvested Company PSUs; Unvested Company Options. Each Unvested Company PSU or Unvested Company Option shall automatically be cancelled and no payment shall be made with respect thereto. ' +
    '(iv) Unvested Company RSUs. The treatment of each Unvested Company RSU shall be determined by the committee.';

  const extracted = buildConsiderationEquityProvision({
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    category: 'Treatment of Company Equity Awards',
    text,
    features: {
      sectionNumber: '3.06',
      outstandingInstruments: [
        { code: 'RSUs', label: 'Restricted Stock Units', text: 'Each Vested Company RSU or Vested Company PSU' },
        { code: 'PSUs', label: 'Performance Stock Units', text: 'Each Vested Company RSU or Vested Company PSU' },
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Each Vested Company Option' },
        { code: 'PSUs', label: 'Performance Stock Units', text: 'Each Unvested Company PSU or Unvested Company Option' },
        { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Each Unvested Company PSU or Unvested Company Option' },
        { code: 'RSUs', label: 'Restricted Stock Units', text: 'each Unvested Company RSU' },
      ],
      instrumentTreatments: [
        { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cash', text: 'Each Vested Company RSU or Vested Company PSU shall be converted into cash' },
        { code: 'CASHED_OUT_AT_CONSIDERATION', label: 'Cash', text: 'Each Vested Company RSU or Vested Company PSU shall be converted into cash' },
        { code: 'CASHED_OUT_SPREAD', label: 'Spread', text: 'Each Vested Company Option shall be converted into the Option Consideration' },
        { code: 'CANCELLED_NO_CONSIDERATION', label: 'Cancelled', text: 'Each Unvested Company PSU or Unvested Company Option shall automatically be cancelled and no payment shall be made with respect thereto' },
        { code: 'CANCELLED_NO_CONSIDERATION', label: 'Cancelled', text: 'Each Unvested Company PSU or Unvested Company Option shall automatically be cancelled and no payment shall be made with respect thereto' },
        { code: 'OTHER', label: 'Other', text: 'The treatment of each Unvested Company RSU shall be determined by the committee' },
      ],
    },
  });

  enforceConsiderationEquityInvariants(extracted);

  assert.deepEqual(
    extracted.treatments.map((t) => [t.instrumentType, t.sourceSpanStart]),
    [
      ['RSU', text.indexOf('(i)')],
      ['PSU', text.indexOf('(i)')],
      ['STOCK_OPTIONS', text.indexOf('(ii)')],
      ['PSU', text.indexOf('(iii)')],
      ['STOCK_OPTIONS', text.indexOf('(iii)')],
      ['RSU', text.indexOf('(iv)')],
    ],
  );
});
