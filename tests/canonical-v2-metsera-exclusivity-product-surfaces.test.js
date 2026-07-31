const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_SURFACES_SCHEMA,
  SURFACES,
  compileMetseraExclusivityProductSurfaces,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-surfaces',
);

test('fails closed without the exact Product chain', () => {
  assert.throws(
    () => compileMetseraExclusivityProductSurfaces({}, {}, {}, {}),
    /Metsera|invalid|changed|fields|authority context and input are required/i,
  );
  assert.equal(
    METSERA_PRODUCT_SURFACES_SCHEMA,
    'METSERA_EXCLUSIVITY_PRODUCT_SURFACES/V1',
  );
});

test('uses one exact result and includes the subject with zero independent peers', () => {
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-surfaces',
    ),
    'utf8',
  );
  assert.match(source, /validateMetseraExclusivityProductPresentation/);
  assert.match(source, /SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS/);
  assert.match(source, /status: 'INCLUDED'/);
  assert.match(source, /independent_peer_count: 0/);
  assert.match(source, /validateMetseraExclusivityProductRow\([\s\S]*authorityContext[\s\S]*authorityInput/);
  assert.doesNotMatch(
    source,
    /service[_-]?role|supabase|canonical-writer|production.*write/i,
  );
  assert.deepEqual(SURFACES, [
    'COMPARE',
    'CORPUS_CONTEXT',
    'QUERY',
    'REVIEW',
  ]);
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
});

test('uses the exact four-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-product-surfaces-v1.json',
    ),
    'utf8',
  ));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-metsera-exclusivity-product-surfaces-v1.json',
    'lib/canonical-v2/metsera-exclusivity-product-surfaces.js',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-exclusivity-product-surfaces.test.js',
  ]);
});
