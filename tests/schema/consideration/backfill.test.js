const test = require('node:test');
const assert = require('node:assert/strict');

const {
  conversionNeedsReextraction,
  legacyProvisionFromRow,
  mentionedInstrumentCodes,
  parseArgs,
} = require('../../../scripts/backfill-consideration');
const { buildConsiderationEquityProvision } = require('../../../lib/parser-v2/consideration-equity');

const METSERA_203 =
  'SECTION 2.03. Treatment of Company Equity Awards. (i) each Company Stock Option outstanding immediately prior to the Effective Time shall be canceled for cash. ' +
  '(ii) each Company Restricted Stock Award outstanding immediately prior to the Effective Time shall vest in full and be canceled for cash. ' +
  '(e) Company ESPP. Prior to the Effective Time, the Company shall cause the Company ESPP to terminate.';

test('consideration backfill detects loose RSA and ESPP mentions as re-extraction needed', () => {
  const row = {
    id: 'legacy',
    type: 'CONSID',
    category: 'Treatment of Company Equity Awards',
    full_text: METSERA_203,
    ai_metadata: {
      code: 'CONSID-EQUITY',
      features: {
        outstandingInstruments: [
          { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'Company Stock Option' },
        ],
        instrumentTreatments: [
          { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'each Company Stock Option outstanding immediately prior to the Effective Time shall be canceled for cash', instrumentCode: 'STOCK_OPTIONS' },
        ],
      },
    },
  };
  const extracted = buildConsiderationEquityProvision(legacyProvisionFromRow(row));

  assert.deepEqual(mentionedInstrumentCodes(row.full_text), new Set(['STOCK_OPTIONS', 'RSA', 'ESPP']));
  assert.equal(conversionNeedsReextraction(row, extracted), true);
});

test('consideration backfill supports clean-only mode', () => {
  const args = parseArgs(['node', 'script', '--all', '--clean-only', '--apply']);

  assert.equal(args.all, true);
  assert.equal(args.cleanOnly, true);
  assert.equal(args.apply, true);
});
