const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_ADMISSION_SCHEMA,
  compileMetseraExclusivityProductAdmission,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-admission',
);

test('fails closed without the exact sealed staging receipt', () => {
  assert.throws(
    () => compileMetseraExclusivityProductAdmission({}, {}),
    /does not have the exact required fields/,
  );
  assert.equal(
    METSERA_PRODUCT_ADMISSION_SCHEMA,
    'METSERA_EXCLUSIVITY_PRODUCT_ADMISSION/V1',
  );
});

test('grants no Product, release or operational authority', () => {
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-admission',
    ),
    'utf8',
  );
  assert.match(source, /compileProcessPhrasebookResultAdmission/);
  assert.match(source, /PROCESS_NARRATION_NOT_ACTUAL_DRAFTING/);
  assert.doesNotMatch(
    source,
    /service[_-]?role|supabase|canonical-writer|production.*write/i,
  );
});

test('uses the exact six-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-product-admission-v1.json',
    ),
    'utf8',
  ));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-metsera-exclusivity-product-admission-v1.json',
    'lib/canonical-v2/metsera-exclusivity-product-admission.js',
    'lib/canonical-v2/metsera-exclusivity-staging-pilot.js',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-exclusivity-product-admission.test.js',
    'tests/canonical-v2-metsera-exclusivity-staging-pilot.test.js',
  ]);
});
