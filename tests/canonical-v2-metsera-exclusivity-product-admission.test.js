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
    () => compileMetseraExclusivityProductAdmission({}),
    /exact required fields/,
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
  assert.match(source, /validateProcessPhrasebookResultAdmissionReceipt/);
  assert.match(source, /NOT_RELEASE_BOUND/);
  assert.match(source, /PROCESS_NARRATION_NOT_ACTUAL_DRAFTING/);
  assert.doesNotMatch(source, /validation_receipt_ids/);
  assert.doesNotMatch(source, /buildMembership/);
  assert.doesNotMatch(
    source,
    /service[_-]?role|supabase|canonical-writer|production.*write/i,
  );
});

test('accepts only one checked Process admission envelope', () => {
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-admission',
    ),
    'utf8',
  );
  assert.match(source, /process_admission_input/);
  assert.match(source, /process_admission_receipt/);
  assert.doesNotMatch(source, /candidateReleaseBinding/);
  assert.doesNotMatch(source, /compileMetseraExclusivityStagingPilot/);
  assert.throws(
    () => compileMetseraExclusivityProductAdmission({
      process_admission_input: {},
      process_admission_receipt: {},
      invented_authority: true,
    }),
    /exact required fields/,
  );
});

test('uses the active P8 phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-p8-process-admission-validation-membership-v1.json',
    ),
    'utf8',
  ));
  assert.equal(
    allowlist.allowed.includes(
      'lib/canonical-v2/metsera-exclusivity-product-admission.js',
    ),
    true,
  );
  assert.equal(
    allowlist.allowed.includes(
      'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    ),
    true,
  );
});
