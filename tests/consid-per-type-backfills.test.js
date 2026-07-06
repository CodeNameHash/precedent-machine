// Audit-2 item 1 (SYSTEMIC): extractProvisionsForType (the per-type path used
// by scripts/reprocess.js and POST /api/ingest/extract-type) must run the
// same deterministic CONSID backfills as the full-pipeline extractProvisions
// — otherwise every CONSID reprocess clobbers the instrument-mention backstop
// and the CVR-exhibit sum (this happened twice in production before the fix
// in lib/parser-v2/extract.js's CONSID branch of extractProvisionsForType).
//
// This is an integration test against the real per-type entry point with a
// STUBBED LLM client that reproduces the actual failure mode: the model only
// noticed the Stock Options instrument (options-only), exactly like the live
// Metsera bug the backstop exists for.
const test = require('node:test');
const assert = require('node:assert/strict');

const { extractProvisionsForType } = require('../lib/parser-v2/extract.js');

// Metsera-shaped Section 2.03: enumerates Stock Options AND Restricted Stock
// Awards, and pays a CVR per share — same shape as the live regression.
const SECTION_TEXT =
  'SECTION 2.03. Treatment of Company Equity Awards. (a) Effective as of the ' +
  'Effective Time, by virtue of the Merger and without any action on the part ' +
  'of any holder of a Company Stock Option or Company Restricted Stock Award, ' +
  'as applicable: (i) each Company Stock Option, whether vested or unvested, ' +
  'outstanding and unexercised immediately prior to the Effective Time shall ' +
  'be canceled at the Effective Time and the holder thereof shall become ' +
  'entitled to receive a cash payment plus one (1) CVR. (ii) each Company ' +
  'Restricted Stock Award outstanding immediately prior to the Effective Time ' +
  'shall vest in full and be canceled and converted into the right to receive ' +
  'the Merger Consideration plus one (1) CVR in respect of each share subject thereto.';

const EXHIBIT_TAIL =
  'Exhibit B FORM OF CONTINGENT VALUE RIGHTS AGREEMENT ' +
  'THIS CONTINGENT VALUE RIGHTS AGREEMENT ... Definitions. ' +
  '"First Milestone Payment" means $5.00 per CVR, payable upon First Milestone Achievement. ' +
  '"Second Milestone Payment" means $10.50 per CVR, payable upon Second Milestone Achievement. ' +
  '"Third Milestone Payment" means $7.00 per CVR, payable upon Third Milestone Achievement.';

const FULL_CLEANED_TEXT =
  'AGREEMENT AND PLAN OF MERGER ... ' + SECTION_TEXT + ' ... ' + EXHIBIT_TAIL;

const classifiedSections = [
  {
    provision_type: 'CONSID',
    number: '2.03',
    title: 'Treatment of Company Equity Awards',
    text: SECTION_TEXT,
    startChar: 0,
  },
];

// Stub LLM: reproduces the real bug — only the Stock Options instrument made
// it into outstandingInstruments, the RSA vanished from the model's output.
function makeOptionsOnlyClient() {
  return {
    messages: {
      create: async () => ({
        content: [{
          text: JSON.stringify({
            results: [{
              idx: 0,
              code: 'CONSID-EQUITY',
              category: 'Treatment of Equity Awards / Stock Plans',
              favorability: 'neutral',
              features: {
                outstandingInstruments: [
                  { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'each Company Stock Option, whether vested or unvested' },
                ],
                instrumentTreatments: [
                  { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'canceled ... cash payment' },
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

test('per-type CONSID extract runs the instrument-mention backstop (RSA row is not dropped)', async () => {
  const client = makeOptionsOnlyClient();
  const provisions = await extractProvisionsForType(classifiedSections, 'CONSID', client, FULL_CLEANED_TEXT);

  const equity = provisions.find((p) => p.code === 'CONSID-EQUITY');
  const codes = ((equity && equity.features && equity.features.considerationTreatments) || [])
    .map((t) => t.instrumentType);
  assert.ok(codes.includes('STOCK_OPTIONS'), `expected STOCK_OPTIONS treatment, got ${codes}`);
  assert.ok(codes.includes('RSA'), `text-detected RSA treatment must not be dropped by the per-type path, got ${codes}`);
});

test('per-type CONSID extract runs the CVR-exhibit sum backfill (maxPayment = exhibit sum, not the LLM default)', async () => {
  const client = makeOptionsOnlyClient();
  const provisions = await extractProvisionsForType(classifiedSections, 'CONSID', client, FULL_CLEANED_TEXT);

  const withMax = provisions.find((p) => p.features && p.features.maxPayment);
  assert.ok(withMax, 'expected at least one provision with features.maxPayment stamped from the exhibit');
  assert.equal(withMax.features.maxPayment, '$22.50');
  assert.equal(withMax.features.cvrMilestonePayments.length, 3);
});
