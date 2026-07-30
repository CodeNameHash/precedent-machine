const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_PRESENTATION_SCHEMA,
  compileMetseraExclusivityProductPresentation,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-presentation',
);

test('fails closed without one exact Product row and result set', () => {
  assert.throws(
    () => compileMetseraExclusivityProductPresentation({}, {}),
    /row and result-set binding is invalid/,
  );
  assert.equal(
    METSERA_PRODUCT_PRESENTATION_SCHEMA,
    'METSERA_EXCLUSIVITY_PRODUCT_PRESENTATION/V1',
  );
});

test('uses one full field catalogue and the existing presentation compiler', () => {
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-presentation',
    ),
    'utf8',
  );
  assert.match(source, /buildPilotProductFieldCatalogueManifest/);
  assert.match(source, /compileProcessPhrasebookProductResultPresentation/);
  assert.doesNotMatch(
    source,
    /service[_-]?role|supabase|canonical-writer|production.*write/i,
  );
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
});

test('uses the exact seven-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-product-presentation-v1.json',
    ),
    'utf8',
  ));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-metsera-exclusivity-product-presentation-v1.json',
    'lib/canonical-v2/metsera-exclusivity-product-presentation.js',
    'lib/canonical-v2/metsera-exclusivity-product-row.js',
    'lib/canonical-v2/pilot-product-field-catalogue.js',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-exclusivity-product-presentation.test.js',
    'tests/canonical-v2-pilot-product-field-catalogue.test.js',
  ]);
});
