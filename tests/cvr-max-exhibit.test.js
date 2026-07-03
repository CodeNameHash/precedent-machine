// Regression tests for backfillCvrMaxFromExhibit (MetsFB2 §1): the CVR max
// payment must be pulled from the Form of CVR Agreement attached as an
// exhibit when the consideration section only references it.
const test = require('node:test');
const assert = require('node:assert');

const { backfillCvrMaxFromExhibit } = require('../lib/parser-v2/extract.js');

const EXHIBIT_TAIL =
  'Exhibit B [[CENTER]]FORM OF CONTINGENT VALUE RIGHTS AGREEMENT[[/CENTER]] ' +
  'THIS CONTINGENT VALUE RIGHTS AGREEMENT ... Definitions. ' +
  '[[DEFINED]]"First Milestone Payment"[[/DEFINED]] means $5.00 per CVR, payable upon First Milestone Achievement. ' +
  '[[DEFINED]]"Second Milestone Payment"[[/DEFINED]] means $10.50 per CVR, payable upon Second Milestone Achievement. ' +
  '"Third Milestone Payment" means $7.00 per CVR, payable upon Third Milestone Achievement. ' +
  'any such CVR Holder that is due an aggregate amount in excess of $100,000 shall provide wiring instructions.';

const DOC =
  'AGREEMENT AND PLAN OF MERGER ... the right to receive the Milestone ' +
  'Payments as set forth in the CVR Agreement (a "CVR") in cash ... ' +
  EXHIBIT_TAIL;

function cvrProv() {
  return {
    type: 'CONSID',
    code: 'CONSID-CVR',
    text: 'one contractual contingent value right per share representing the right to receive the Milestone Payments as set forth in the CVR Agreement',
    features: {},
  };
}

test('sums milestone payments from the exhibit into maxPayment', () => {
  const prov = cvrProv();
  backfillCvrMaxFromExhibit([prov], DOC);
  assert.strictEqual(prov.features.maxPayment, '$22.50');
  assert.strictEqual(prov.features.cvrMilestonePayments.length, 3);
  const labels = prov.features.cvrMilestonePayments.map((i) => i.label);
  assert.deepStrictEqual(labels, [
    'First Milestone Payment',
    'Second Milestone Payment',
    'Third Milestone Payment',
  ]);
});

test('milestone text is verbatim with markers stripped', () => {
  const prov = cvrProv();
  backfillCvrMaxFromExhibit([prov], DOC);
  const first = prov.features.cvrMilestonePayments[0];
  assert.ok(first.text.includes('"First Milestone Payment" means $5.00'));
  assert.ok(!first.text.includes('[[DEFINED]]'));
});

test('ignores aggregate dollar figures (e.g. $100,000 wiring threshold)', () => {
  const prov = cvrProv();
  backfillCvrMaxFromExhibit([prov], DOC);
  assert.ok(
    prov.features.cvrMilestonePayments.every((i) => !i.text.includes('100,000'))
  );
});

test('no-op when an LLM-extracted maxPayment already exists', () => {
  const prov = cvrProv();
  prov.features.maxPayment = '$99.99';
  backfillCvrMaxFromExhibit([prov], DOC);
  assert.strictEqual(prov.features.maxPayment, '$99.99');
  assert.strictEqual(prov.features.cvrMilestonePayments, undefined);
});

test('no-op when the deal has no CVR consideration', () => {
  const prov = {
    type: 'CONSID',
    code: 'CONSID-CASH',
    text: '$63.00 in cash, without interest',
    features: {},
  };
  backfillCvrMaxFromExhibit([prov], DOC);
  assert.strictEqual(prov.features.maxPayment, undefined);
});

test('no-op when there is no CVR exhibit in the document', () => {
  const prov = cvrProv();
  backfillCvrMaxFromExhibit([prov], 'AGREEMENT AND PLAN OF MERGER ... a "CVR" in cash ... no exhibit here.');
  assert.strictEqual(prov.features.maxPayment, undefined);
});
