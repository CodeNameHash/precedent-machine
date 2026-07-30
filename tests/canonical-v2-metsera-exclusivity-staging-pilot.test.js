const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_STAGING_PILOT_SCHEMA,
  SELECTED_PASSAGE_ID,
  compileMetseraExclusivityStagingPilot,
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

test('grants no operational authority and does not label narration as actual drafting', () => {
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-staging-pilot',
    ),
    'utf8',
  );
  assert.doesNotMatch(source, /passage_role_codes:\s*\[\s*'ACTUAL_DRAFTING'/);
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
