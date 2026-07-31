const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_RESULT_SET_SCHEMA,
  compileMetseraExclusivityProductResultSet,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-result-set',
);

test('fails closed without the exact Product row and Process admission', () => {
  assert.throws(
    () => compileMetseraExclusivityProductResultSet({}, {}),
    /Product row binding is invalid|authority context and input are required/,
  );
  assert.equal(
    METSERA_PRODUCT_RESULT_SET_SCHEMA,
    'METSERA_EXCLUSIVITY_PRODUCT_RESULT_SET/V1',
  );
});

test('delegates ordering and final slots to the existing compilers', () => {
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-result-set',
    ),
    'utf8',
  );
  assert.match(source, /PROCESS_ORDERING_VALIDATOR_STABLE_ID/);
  assert.match(source, /compileProcessPhrasebookProductResultSetBridge/);
  assert.doesNotMatch(
    source,
    /service[_-]?role|supabase|canonical-writer|production.*write/i,
  );
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
});

test('uses the exact six-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-product-result-set-v1.json',
    ),
    'utf8',
  ));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-metsera-exclusivity-product-result-set-v1.json',
    'lib/canonical-v2/metsera-exclusivity-product-result-set.js',
    'lib/canonical-v2/metsera-exclusivity-product-row.js',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-exclusivity-product-row.test.js',
    'tests/canonical-v2-metsera-exclusivity-product-result-set.test.js',
  ]);
});

test('requires explicit authority-context propagation', () => {
  const source = fs.readFileSync(
    require.resolve('../lib/canonical-v2/metsera-exclusivity-product-result-set'),
    'utf8',
  );
  assert.match(source, /validateMetseraExclusivityProductRow\([\s\S]*authorityContext[\s\S]*authorityInput/);
});
