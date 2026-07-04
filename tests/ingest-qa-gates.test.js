const test = require('node:test');
const assert = require('node:assert');

test('duplicate gate ignores instrument- and code-differentiated sibling rows', () => {
  const { computeDuplicateCount } = require('../scripts/ingest-qa');
  const text = 'SECTION 2.03. Treatment of Company Equity Awards. ' + 'x'.repeat(80);
  const sib = (inst) => ({ full_text: text, ai_metadata: { code: 'CONSID-EQUITY', features: { instrumentType: { code: inst } } } });
  assert.strictEqual(computeDuplicateCount([sib('STOCK_OPTIONS'), sib('ESPP'), sib('RESTRICTED_STOCK')]), 0);
  const coded = (code) => ({ full_text: text, ai_metadata: { code, features: {} } });
  assert.strictEqual(computeDuplicateCount([coded('ANTI-EFFORTS'), coded('ANTI-BURDEN')]), 0);
  assert.strictEqual(computeDuplicateCount([coded('ANTI-EFFORTS'), coded('ANTI-EFFORTS')]), 1);
});

// CSRA (Section 3.2: Company RSU / Company 2018 RSU / Director RSU) and
// Covance (Section 2.03: Company Restricted Stock / Rollover Restricted
// Stock) both decompose one section into several per-instrument sibling
// rows that share instrumentType.code (a coarse family code — "RSUs" and
// "RESTRICTED_STOCK" respectively cover multiple distinct award classes with
// different treatment). Keying only on instrumentType.code false-flagged
// those legitimate siblings as duplicates. instrumentType.text carries the
// specific instrument reference and must break the tie.
test('duplicate gate distinguishes same-family-code siblings by instrumentType.text', () => {
  const { computeDuplicateCount } = require('../scripts/ingest-qa');
  const text = 'SECTION 3.2 Treatment of Equity Compensation Awards. ' + 'x'.repeat(80);
  const row = (instText) => ({
    full_text: text,
    ai_metadata: { code: 'CONSID-EQUITY', features: { instrumentType: { code: 'RSUs', text: instText } } },
  });
  // CSRA: three genuine siblings, same family code, distinct instrument text.
  assert.strictEqual(
    computeDuplicateCount([
      row('each such Company RSU outstanding immediately prior to the Effective Time'),
      row('each Company 2018 RSU'),
      row('each such Director RSU outstanding immediately prior to the Effective Time'),
    ]),
    0,
  );
  // A genuine re-ingest duplicate (same instrument, same text) must still count.
  assert.strictEqual(
    computeDuplicateCount([row('each Company 2018 RSU'), row('each Company 2018 RSU')]),
    1,
  );
});
