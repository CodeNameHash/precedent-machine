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
