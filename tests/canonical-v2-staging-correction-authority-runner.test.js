const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-correction-authority.mjs';

test('correction authority runner is hard-pinned to isolated staging and the frozen contract', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d/);
  assert.match(source, /Refusing to run outside/);
  assert.match(source, /Refusing to bootstrap because the frozen contract fingerprint has drifted/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy|precedent-machine['"]/);
});

test('genesis uses the existing eight-argument writer with an explicit empty map and null predecessor', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /FIXTURE_CORRECTION_AUTHORITY/);
  assert.match(source, /const writeCall = `public\.canonical_v2_write\([\s\S]*'staging',[\s\S]*\$\{OPERATION\}/);
  assert.match(source, /const writeSet = \{[\s\S]*correction_authority_materialisations/);
  assert.match(source, /correction_materialisations: \[\]/);
  assert.match(source, /generation: 1/);
  assert.match(source, /expected_candidate_input_head: null/);
  assert.match(source, /previous_candidate_input_head_id: null/);
  assert.match(source, /predecessor_candidate_input_head: null/);
  assert.doesNotMatch(source, /INSERT INTO canonical_v2_staging/);
});

test('dry-run rolls back and apply never replaces an existing head', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /commit \? 'COMMIT;' : 'ROLLBACK;'/);
  assert.match(source, /await writeGenesis\(genesis, \{ commit: false \}\)/);
  assert.match(source, /await writeGenesis\(genesis, \{ commit: true \}\)/);
  assert.match(source, /if \(before\) \{[\s\S]*verifyCurrentAuthority\(genesis\)[\s\S]*existing head was not replaced/);
  assert.match(source, /if \(readCurrentHead\(\) !== null\)/);
  assert.doesNotMatch(source, /UPDATE canonical_v2_staging\.candidate_input_heads|DELETE FROM canonical_v2_staging/);
});

test('the write transaction and committed verification both select and exactly recheck the head', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /WITH written AS MATERIALIZED/);
  assert.match(source, /public\.canonical_v2_select_candidate_inputs/);
  assert.match(source, /public\.canonical_v2_recheck_candidate_input_head/);
  assert.match(source, /selectTrustedCandidateInputs/);
  assert.match(source, /recheckCandidateInputHead/);
  assert.match(source, /statement_timeout = '20000ms'/);
  assert.match(source, /timeout: 30000/);
  assert.doesNotMatch(source, /retry|setInterval|setTimeout/);
});

test('runner rejects ambiguous invocation before project or database access', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--apply', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stdout, /Committed and verified/);
});

test('runner never reads or emits credential-bearing configuration', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.doesNotMatch(source, /process\.env|pooler-url|DATABASE_URL|SUPABASE_SERVICE|keychain/);
  assert.match(source, /safeDatabaseDiagnostic\(`/);
  assert.match(source, /redacted-database-url/);
  assert.doesNotMatch(source, /process\.stderr\.write\(result\.stderr\)/);
  assert.match(source, /parseQueryResult\(result\.stdout\)/);
});
