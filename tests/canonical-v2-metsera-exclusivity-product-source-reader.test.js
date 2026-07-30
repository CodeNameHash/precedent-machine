const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_SOURCE_READER_SCHEMA,
  SELECTED_SOURCE_ACTION,
  compileMetseraExclusivityProductSourceReader,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-source-reader',
);

test('fails closed without the exact candidate record and active resolution', () => {
  assert.throws(
    () => compileMetseraExclusivityProductSourceReader({}, {}, {}),
    /candidate|write set|source reader/i,
  );
  assert.equal(
    METSERA_PRODUCT_SOURCE_READER_SCHEMA,
    'METSERA_EXCLUSIVITY_PRODUCT_SOURCE_READER/V1',
  );
});

test('uses the existing source reader and grants no runtime authority', () => {
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-source-reader',
    ),
    'utf8',
  );
  assert.match(source, /compileProductSourceReaderAction/);
  assert.match(source, /validateProductActiveReleaseResolution/);
  assert.match(source, /OPEN_SELECTED_SOURCE/);
  assert.equal(SELECTED_SOURCE_ACTION, 'PROCESS_NARRATION_EVIDENCE');
  assert.deepEqual(
    new Set(Object.values(AUTHORITY_LIMITS)),
    new Set(['NONE']),
  );
  assert.doesNotMatch(
    source,
    /service[_-]?role|supabase|production.*write/i,
  );
});

test('uses the exact five-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-product-source-reader-v1.json',
    ),
    'utf8',
  ));
  assert.equal(
    allowlist.phase,
    'WP-METSERA-EXCLUSIVITY-PRODUCT-SOURCE-READER-V1',
  );
  assert.equal(allowlist.allowed.length, 5);
});
