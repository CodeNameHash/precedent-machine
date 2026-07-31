const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  DIRECT_BENEFICIARY_TEXT,
  DIRECT_GRANTOR_TEXT,
  EXCLUSIVITY_EXPIRY_TEXT,
  GRANT_EFFECTIVE_TEXT,
  METSERA_STAGING_PILOT_SCHEMA,
  SELECTED_PASSAGE_ID,
  compileMetseraExclusivityStagingPilot,
  validateSealedGrantEvidence,
} = require('../lib/canonical-v2/metsera-exclusivity-staging-pilot');

test('keeps the Metsera staging pilot fail-closed until every sealed source is supplied', () => {
  assert.throws(
    () => compileMetseraExclusivityStagingPilot(new Map()),
    /source bytes missing/,
  );
  assert.equal(
    METSERA_STAGING_PILOT_SCHEMA,
    'METSERA_EXCLUSIVITY_STAGING_PILOT/V1',
  );
  assert.equal(
    SELECTED_PASSAGE_ID,
    'party-2-august-17-executed-exclusivity',
  );
});

test('requires direct party-and-role evidence and separates the grant date from expiry', () => {
  assert.equal(
    DIRECT_GRANTOR_TEXT,
    'Metsera did not grant Party 2 exclusivity',
  );
  assert.equal(DIRECT_BENEFICIARY_TEXT, 'grant Party 2 exclusivity');
  assert.equal(GRANT_EFFECTIVE_TEXT, 'Later on August&nbsp;17, 2025');
  assert.equal(
    EXCLUSIVITY_EXPIRY_TEXT,
    'through 9:00 a.m. Eastern Time on September&nbsp;8,\n2025',
  );
  assert.doesNotThrow(() => validateSealedGrantEvidence({
    grantorEvidenceText: DIRECT_GRANTOR_TEXT,
    beneficiaryEvidenceText: DIRECT_BENEFICIARY_TEXT,
    grantEffectiveText: GRANT_EFFECTIVE_TEXT,
    expiryText: EXCLUSIVITY_EXPIRY_TEXT,
  }));
  assert.throws(() => validateSealedGrantEvidence({
    grantorEvidenceText: 'Metsera',
    beneficiaryEvidenceText: 'Party 2',
    grantEffectiveText: GRANT_EFFECTIVE_TEXT,
    expiryText: EXCLUSIVITY_EXPIRY_TEXT,
  }), /directly bind both entities to the grant/);
  assert.throws(() => validateSealedGrantEvidence({
    grantorEvidenceText: DIRECT_GRANTOR_TEXT,
    beneficiaryEvidenceText: DIRECT_BENEFICIARY_TEXT,
    grantEffectiveText: EXCLUSIVITY_EXPIRY_TEXT,
    expiryText: GRANT_EFFECTIVE_TEXT,
  }), /must remain distinct exact expressions/);
});

test('grants no operational authority and does not label narration as actual drafting', () => {
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-staging-pilot',
    ),
    'utf8',
  );
  assert.doesNotMatch(source, /passage_role_codes:\s*\[\s*'ACTUAL_DRAFTING'/);
  assert.match(
    source,
    /evidence:\s*evidence\('EXCLUSIVITY_GRANTED', narrationInterval\)/,
  );
  assert.doesNotMatch(
    source,
    /canonical-writer|service[_-]?role|supabase|production.*write/i,
  );
});

test('uses the exact four-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-staging-pilot-v1.json',
    ),
    'utf8',
  ));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-metsera-exclusivity-staging-pilot-v1.json',
    'lib/canonical-v2/metsera-exclusivity-staging-pilot.js',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-exclusivity-staging-pilot.test.js',
  ]);
});

test('uses the current SEC and candidate-validation receipt fields', () => {
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-staging-pilot',
    ),
    'utf8',
  );
  assert.match(source, /\.oracle_receipt_id/);
  assert.match(source, /\.candidate_validation_receipt_id/);
  assert.doesNotMatch(source, /\.sec_completeness_oracle_receipt_id/);
  assert.doesNotMatch(
    source,
    /candidate_validation_receipt\.validation_receipt_id/,
  );
});
