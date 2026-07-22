const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-candidate.mjs';

test('candidate runner is fixed to the isolated project and reviewed multi-deal candidate', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /buildMultiDealCandidateReleaseFixture/);
  assert.match(source, /EXPECTED_CANDIDATE/);
  assert.match(source, /correction_input_seal_id/);
  assert.match(source, /correction_input_root/);
  assert.match(source, /correction_input_seal_records/);
  assert.match(source, /correction_discharge_records/);
  assert.match(source, /Refusing to import because the reviewed multi-deal candidate identity has drifted/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy|precedent-machine['"]/);
});

test('candidate dry-run rolls back and import uses one authoritative RPC', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /commit \? 'COMMIT;' : 'ROLLBACK;'/);
  assert.match(source, /importCandidateRelease\(\{ client: sqlRpcClient\(\{ commit: false \}\), release \}\)/);
  assert.match(source, /public\.canonical_v2_import_candidate_release/);
  assert.doesNotMatch(source, /INSERT INTO canonical_v2_staging/);
});

test('candidate activation is a guarded compare-and-swap and will not replace an unexpected release', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /activateCandidateRelease/);
  assert.match(source, /EXPECTED_PRIOR_POINTER/);
  assert.match(source, /EXPECTED_ACTIVE_POINTER/);
  assert.match(source, /FIXTURE_ACTIVE_RELEASE_POINTER\/V2/);
  assert.match(source, /Refusing to activate without the pinned prior release/);
  assert.match(source, /Refusing to replace an unexpected active staging release/);
  assert.match(source, /public\.canonical_v2_activate_candidate_release/);
});

test('candidate runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--import', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stdout, /Imported multi-deal candidate/);
});
