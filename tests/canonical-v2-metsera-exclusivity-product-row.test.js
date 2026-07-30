const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_ROW_SCHEMA,
  compileMetseraExclusivityProductRow,
} = require('../lib/canonical-v2/metsera-exclusivity-product-row');

test('fails closed without one exact admitted Metsera result', () => {
  assert.throws(
    () => compileMetseraExclusivityProductRow({}),
    /Process admission state is invalid/,
  );
  assert.equal(
    METSERA_PRODUCT_ROW_SCHEMA,
    'METSERA_EXCLUSIVITY_PRODUCT_ROW/V1',
  );
});

test('uses the existing Product query and shared-row compilers', () => {
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-row',
    ),
    'utf8',
  );
  assert.match(source, /compileProductQueryIr/);
  assert.match(source, /compileProcessPhrasebookSharedRowBridge/);
  assert.match(source, /requestedFieldProjectionIdentity/);
  assert.doesNotMatch(
    source,
    /service[_-]?role|supabase|canonical-writer|production.*write/i,
  );
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
});

test('uses the exact four-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-product-row-v1.json',
    ),
    'utf8',
  ));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-metsera-exclusivity-product-row-v1.json',
    'lib/canonical-v2/metsera-exclusivity-product-row.js',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-exclusivity-product-row.test.js',
  ]);
});
