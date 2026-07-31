const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA,
  compileMetseraExclusivityProcessPhrasebookAdmission,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission',
);
const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  MATERIALISATION_RECEIPT_SCHEMA,
  compileProcessExclusivityPilotMaterialisation,
} = require('../lib/canonical-v2/process-exclusivity-pilot');

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function materialisationInputFixture() {
  const fixturePath = path.join(
    __dirname,
    'canonical-v2-process-exclusivity-pilot.test.js',
  );
  const source = fs.readFileSync(fixturePath, 'utf8');
  const end = source.indexOf('\nfunction setPredicateDimensions');
  const fixtureModule = new Module(fixturePath);
  fixtureModule.filename = fixturePath;
  fixtureModule.paths = Module._nodeModulePaths(__dirname);
  fixtureModule._compile(
    `${source.slice(0, end)}\nmodule.exports = { metseraFixture };`,
    fixturePath,
  );
  return fixtureModule.exports.metseraFixture();
}

test('fails closed without a full real materialisation receipt', () => {
  assert.equal(
    METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA,
    'METSERA_EXCLUSIVITY_PROCESS_PHRASEBOOK_ADMISSION/V1',
  );
  assert.throws(
    () => compileMetseraExclusivityProcessPhrasebookAdmission({}),
    /exact required fields/,
  );
  assert.throws(
    () => compileMetseraExclusivityProcessPhrasebookAdmission({
      materialisation_input: {},
      materialisation_receipt: null,
      candidate_release_binding: {
        candidate_release_manifest_id: '0'.repeat(64),
        candidate_release_manifest_payload_digest: '1'.repeat(64),
        corpus_release_id: '2'.repeat(64),
      },
      pilot_product_authority_context: {},
      pilot_product_authority_input: {},
    }),
    /Materialisation receipt/,
  );
  assert.throws(
    () => compileMetseraExclusivityProcessPhrasebookAdmission({
      materialisation_input: {},
      materialisation_receipt: null,
      candidate_release_binding: {
        candidate_release_manifest_id: '0'.repeat(64),
        candidate_release_manifest_payload_digest: '1'.repeat(64),
        corpus_release_id: '2'.repeat(64),
      },
      pilot_product_authority_context: {},
      pilot_product_authority_input: {},
      product_query_definition_id: '0'.repeat(64),
    }),
    /exact required fields/,
  );
});

test('rejects a correctly rehashed receipt that does not rebuild from its retained input', () => {
  const materialisationInput = materialisationInputFixture();
  const substitutedReceipt = clone(
    compileProcessExclusivityPilotMaterialisation(materialisationInput),
  );
  substitutedReceipt.revisions.narration_revisions[0].source_backed_attributes
    .verbatim_text = 'substituted';
  const receiptBody = clone(substitutedReceipt);
  delete receiptBody.materialisation_receipt_id;
  substitutedReceipt.materialisation_receipt_id = contentId(
    MATERIALISATION_RECEIPT_SCHEMA,
    receiptBody,
  );
  assert.throws(
    () => compileMetseraExclusivityProcessPhrasebookAdmission({
      materialisation_input: materialisationInput,
      materialisation_receipt: substitutedReceipt,
      candidate_release_binding: {
        candidate_release_manifest_id: '0'.repeat(64),
        candidate_release_manifest_payload_digest: '1'.repeat(64),
        corpus_release_id: '2'.repeat(64),
      },
      pilot_product_authority_context: {},
      pilot_product_authority_input: {},
    }),
    /does not rebuild from its retained input/,
  );
});

test('derives admission-only state from the materialisation receipt', () => {
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
  const source = fs.readFileSync(require.resolve(
    '../lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission',
  ), 'utf8');
  assert.match(source, /MATERIALISATION_RECEIPT_SCHEMA/);
  assert.match(source, /exact_source_slices/);
  assert.match(source, /materialisation_receipt_id/);
  assert.match(source, /NOT_RELEASE_BOUND/);
  assert.match(source, /eventDateFromReceipt/);
  assert.match(source, /validateProcessExclusivityPilotMaterialisation/);
  assert.doesNotMatch(source, /metsera-gold-evidence|loadSealedMetseraGoldEvidence|exclusivityGold/);
  assert.doesNotMatch(source, /buildMetseraAuthorityBoundProcessAdmission/);
  assert.doesNotMatch(source, /buildFixtureCandidateRelease/);
  assert.doesNotMatch(source, /canonical-writer|supabase|production.*write/i);
  const stagingSource = fs.readFileSync(path.join(
    __dirname,
    '../scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
  ), 'utf8');
  assert.doesNotMatch(stagingSource, /--product-query-definition-id/);
  assert.match(stagingSource, /--materialisation-input/);
  assert.match(stagingSource, /pilot_product_authority_context/);
});

test('uses the query-cycle correction phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-p8-metsera-query-cycle-fix-v1.json',
  ), 'utf8'));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-metsera-query-cycle-fix-v1.json',
    'lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission.js',
    'lib/canonical-v2/metsera-exclusivity-product-row.js',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-exclusivity-process-phrasebook-admission.test.js',
    'tests/canonical-v2-metsera-exclusivity-product-row.test.js',
  ]);
});

test('uses the P8 real-source bridge phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-p8-metsera-real-admission-bridge-v1.json',
  ), 'utf8'));
  assert.equal(allowlist.allowed.includes(
    'lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission.js',
  ), true);
  assert.equal(allowlist.allowed.includes(
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
  ), true);
});
