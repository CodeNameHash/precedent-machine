const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractProvisions,
  extractProvisionsForType,
} = require('../lib/parser-v2/extract.js');

const EQUITY_TEXT =
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

const CLASSIFIED = [{
  provision_type: 'CONSID',
  number: '2.03',
  title: 'Treatment of Company Equity Awards',
  text: EQUITY_TEXT,
  startChar: 0,
}];

function optionsOnlyClient() {
  return {
    messages: {
      create: async () => ({
        content: [{
          text: JSON.stringify({
            results: [{
              idx: 0,
              code: 'CONSID-EQUITY',
              category: 'Treatment of Company Equity Awards',
              favorability: 'neutral',
              features: {
                outstandingInstruments: [
                  { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'each Company Stock Option outstanding immediately prior to the Effective Time' },
                ],
                instrumentTreatments: [
                  { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'shall be canceled and converted into the right to receive a cash payment equal to the excess of the Merger Consideration over the exercise price', instrumentCode: 'STOCK_OPTIONS' },
                ],
              },
              isNewCode: false,
            }],
          }),
        }],
      }),
    },
  };
}

function equityRowByInstrument(provisions, code) {
  return provisions.find((p) =>
    p.code === 'CONSID-EQUITY' &&
    p.features &&
    p.features.instrumentType &&
    p.features.instrumentType.code === code);
}

test('full CONSID extraction backfills RSA and ESPP treatment values before row expansion', async () => {
  const provisions = await extractProvisions(CLASSIFIED, optionsOnlyClient(), EQUITY_TEXT);

  const rsa = equityRowByInstrument(provisions, 'RESTRICTED_STOCK');
  const espp = equityRowByInstrument(provisions, 'ESPP');

  assert.ok(rsa, 'RSA row should be present');
  assert.ok(espp, 'ESPP row should be present');
  assert.equal(rsa.features.equityAwardTreatment.code, 'ACCELERATED_VESTING');
  assert.match(rsa.features.equityAwardTreatment.text, /Restricted Stock Award.*shall vest in full/i);
  assert.equal(espp.features.equityAwardTreatment.code, 'CANCELLED_NO_CONSIDERATION');
  assert.match(espp.features.equityAwardTreatment.text, /Company ESPP.*terminate/i);
});

test('per-type CONSID extraction uses the same instrument backfill path as full ingest', async () => {
  const provisions = await extractProvisionsForType(CLASSIFIED, 'CONSID', optionsOnlyClient(), EQUITY_TEXT);
  const codes = provisions
    .map((p) => p.features && p.features.instrumentType && p.features.instrumentType.code)
    .filter(Boolean);

  assert.deepEqual(new Set(codes), new Set(['STOCK_OPTIONS', 'RESTRICTED_STOCK', 'ESPP']));
  assert.equal(equityRowByInstrument(provisions, 'RESTRICTED_STOCK').features.equityAwardTreatment.code, 'ACCELERATED_VESTING');
  assert.equal(equityRowByInstrument(provisions, 'ESPP').features.equityAwardTreatment.code, 'CANCELLED_NO_CONSIDERATION');
});
