// Regression tests for backfillMissingInstrumentMentions (MetsFB2 §1):
// Metsera's Section 2.03 enumerates "(i) each Company Stock Option ...
// (ii) each Company Restricted Stock Award ..." but only STOCK_OPTIONS made
// it into outstandingInstruments — the RSA row vanished from the equity
// table. The backstop must add a minimal entry for any instrument named in
// the text but missing from the features.
const test = require('node:test');
const assert = require('node:assert');

const { backfillMissingInstrumentMentions } = require('../lib/parser-v2/extract.js');

const METSERA_203 =
  'SECTION 2.03. Treatment of Company Equity Awards. (a) Effective as of the ' +
  'Effective Time, by virtue of the Merger and without any action on the part ' +
  'of any holder of a Company Stock Option or Company Restricted Stock Award, ' +
  'as applicable: (i) each Company Stock Option, whether vested or unvested, ' +
  'outstanding and unexercised immediately prior to the Effective Time shall ' +
  'be canceled at the Effective Time and the holder thereof shall become ' +
  'entitled to receive a cash payment plus one (1) CVR. (ii) each Company ' +
  'Restricted Stock Award outstanding immediately prior to the Effective Time ' +
  'shall vest in full and be canceled and converted into the right to receive ' +
  'the Merger Consideration in respect of each share subject thereto.';

function equityProv(features) {
  return {
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    category: 'Treatment of Equity Awards / Stock Plans',
    text: METSERA_203,
    features,
  };
}

test('adds RESTRICTED_STOCK when named in text but missing from features', () => {
  const prov = equityProv({
    outstandingInstruments: [
      { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'each Company Stock Option, whether vested or unvested' },
    ],
    instrumentTreatments: [
      { code: 'CASHED_OUT_SPREAD', label: 'Cashed Out at Spread', text: 'canceled ... cash payment' },
    ],
  });
  backfillMissingInstrumentMentions([prov]);
  const codes = prov.features.outstandingInstruments.map((i) => i.code);
  assert.ok(codes.includes('STOCK_OPTIONS'));
  assert.ok(codes.includes('RESTRICTED_STOCK'), `RSA row must exist, got ${codes}`);
  const rsa = prov.features.outstandingInstruments.find((i) => i.code === 'RESTRICTED_STOCK');
  assert.ok(rsa.text.includes('Restricted Stock Award'), 'verbatim naming sentence');
  assert.strictEqual(rsa.label, 'Restricted Stock Awards');
});

test('no duplicate entry when the instrument is already present', () => {
  const prov = equityProv({
    outstandingInstruments: [
      { code: 'STOCK_OPTIONS', label: 'Stock Options', text: '...' },
      { code: 'RESTRICTED_STOCK', label: 'Restricted Stock Awards', text: '...' },
    ],
  });
  backfillMissingInstrumentMentions([prov]);
  const rsaRows = prov.features.outstandingInstruments.filter((i) => i.code === 'RESTRICTED_STOCK');
  assert.strictEqual(rsaRows.length, 1);
});

test('does not fire on non-equity CONSID sections', () => {
  const prov = {
    type: 'CONSID',
    code: 'CONSID-CONVERT',
    category: 'Conversion of Shares / Effect on Capital Stock',
    text: METSERA_203,
    features: {},
  };
  backfillMissingInstrumentMentions([prov]);
  assert.strictEqual(prov.features.outstandingInstruments, undefined);
});

test('"represents and warrants" does not create a WARRANTS instrument', () => {
  const prov = equityProv({
    outstandingInstruments: [],
  });
  prov.text += ' The Company represents and warrants that the foregoing is accurate.';
  backfillMissingInstrumentMentions([prov]);
  const codes = (prov.features.outstandingInstruments || []).map((i) => i.code);
  assert.ok(!codes.includes('WARRANTS'), `no phantom warrants, got ${codes}`);
});

/* ─────────────────────────────────────────────────────────────────────────
 * Fix batch item 2 — negation guard. A bare name hit is not evidence the
 * instrument is outstanding: merger agreements routinely name an instrument
 * only to negate its existence (real Metsera capitalization-rep boilerplate:
 * "there have been no issuances ... of ... stock appreciation rights ...").
 * ───────────────────────────────────────────────────────────────────────── */

test('a negated mention ("no ... stock appreciation rights ... outstanding") does NOT add the instrument', () => {
  const prov = equityProv({
    outstandingInstruments: [
      { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'each Company Stock Option' },
    ],
  });
  prov.text +=
    ' Since the Measurement Date, there have been no issuances by the Company of ' +
    'restricted shares, stock appreciation rights, contingent value rights or other rights.';
  backfillMissingInstrumentMentions([prov]);
  const codes = (prov.features.outstandingInstruments || []).map((i) => i.code);
  assert.ok(!codes.includes('SARS'), `no phantom SARs from a negated mention, got ${codes}`);
});

test('an affirmative mention still adds the instrument even when unrelated negated boilerplate is also present', () => {
  const prov = equityProv({
    outstandingInstruments: [
      { code: 'STOCK_OPTIONS', label: 'Stock Options', text: 'each Company Stock Option' },
    ],
  });
  prov.text +=
    ' There have been no issuances of stock appreciation rights. ' +
    'Each Company Warrant outstanding immediately prior to the Effective Time shall be canceled ' +
    'in exchange for the Merger Consideration.';
  backfillMissingInstrumentMentions([prov]);
  const codes = (prov.features.outstandingInstruments || []).map((i) => i.code);
  assert.ok(codes.includes('WARRANTS'), `genuinely-mentioned Warrants must still be added, got ${codes}`);
  assert.ok(!codes.includes('SARS'), `negated SARs must still be excluded, got ${codes}`);
});
