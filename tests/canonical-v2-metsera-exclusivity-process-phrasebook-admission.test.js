const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PROCESS_PHRASEBOOK_ADMISSION_SCHEMA,
  compileMetseraExclusivityProcessPhrasebookAdmission,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission',
);

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
      materialisation_receipt: null,
      candidate_release_binding: {
        candidate_release_manifest_id: '0'.repeat(64),
        candidate_release_manifest_payload_digest: '1'.repeat(64),
        corpus_release_id: '2'.repeat(64),
      },
      product_query_definition_id: '0'.repeat(64),
    }),
    /Materialisation receipt/,
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
  assert.doesNotMatch(source, /buildMetseraAuthorityBoundProcessAdmission/);
  assert.doesNotMatch(source, /buildFixtureCandidateRelease/);
  assert.doesNotMatch(source, /canonical-writer|supabase|production.*write/i);
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
