/* Fix batch item 4 — raw enums (RBE_NOT_TO, POSITIVE_ONLY) rendered verbatim
   on live pages (Metsera no-shop affiliates standard; Intervening Event scope
   on both deals) because no taxonomy dictionary existed for
   representativesStandard / interveningEventScope. Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const taxonomy = require('../lib/taxonomy.js');

test('representativesStandard has a taxonomy dictionary covering the extractor\'s enum contract', () => {
  const dict = taxonomy.taxonomyForFeatureKey('representativesStandard');
  assert.ok(dict, 'dictionary exists');
  for (const code of ['CAUSE_NOT_TO', 'RBE_NOT_TO', 'INSTRUCT_NOT_TO', 'NA']) {
    assert.ok(taxonomy.labelForCode(code, dict), `${code} has a human label`);
  }
  assert.equal(
    taxonomy.labelForCode('RBE_NOT_TO', dict),
    'Company must use reasonable best efforts to cause Representatives not to engage',
  );
});

test('ceaseDiscussionsAffiliateStandard shares the representativesStandard dictionary', () => {
  const dict = taxonomy.taxonomyForFeatureKey('ceaseDiscussionsAffiliateStandard');
  assert.equal(taxonomy.labelForCode('RBE_NOT_TO', dict), taxonomy.labelForCode('RBE_NOT_TO', taxonomy.REPRESENTATIVES_STANDARDS));
});

test('interveningEventScope has a taxonomy dictionary covering the extractor\'s enum contract', () => {
  const dict = taxonomy.taxonomyForFeatureKey('interveningEventScope');
  assert.ok(dict, 'dictionary exists');
  for (const code of ['POSITIVE_ONLY', 'BOTH', 'NA']) {
    assert.ok(taxonomy.labelForCode(code, dict), `${code} has a human label`);
  }
  assert.match(taxonomy.labelForCode('POSITIVE_ONLY', dict), /positive/i);
});

/* prettifyEnumValue lives in components/review/shared.js, which contains JSX
   and can't be imported directly under `node --test` (documented constraint
   — see table-logic.js's header). Exercise the generic bare-enum guard
   through a dynamic import anyway: shared.js has no JSX in the functions
   under test's call graph that would need transformation to just READ the
   function bodies... in practice Node's loader still needs to parse the
   whole file, so instead pin the fix at the taxonomy layer (above) plus a
   source-text assertion that the guard is wired up, mirroring the existing
   convention (tests/audit-fix-batch-ui.test.js item 10) for JSX-adjacent
   fixes with no separately-importable pure logic. */
test('shared.js prettifyEnumValue is wired to consult taxonomyForFeatureKey + a humanize fallback', () => {
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'shared.js'), 'utf8');
  const fnStart = src.indexOf('export function prettifyEnumValue');
  assert.ok(fnStart >= 0, 'prettifyEnumValue found');
  const body = src.slice(fnStart, fnStart + 2000);
  assert.match(body, /taxonomyForFeatureKey/, 'consults the taxonomy dictionary for the feature key');
  assert.match(body, /humanizeBadgeText/, 'falls back to Title-Case humanization for undictionaried codes');
});
