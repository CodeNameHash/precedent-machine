const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-preview-access.mjs';

test('Preview access is pinned to the isolated projection database and deal-corpus Vercel project', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /prj_pseZ68ISXsxADzNcffHTO2NuGM8b/);
  assert.match(source, /projectName: 'deal-corpus'/);
  assert.match(source, /previewBranch: 'codex\/canonical-corpus-v2'/);
  assert.match(source, /56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy|beddepjkshmgenhsrnno/);
});

test('Preview role can execute exactly four current read RPCs and no tables or writer', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /REVOKE ALL ON ALL TABLES IN SCHEMA public, canonical_v2_staging/);
  assert.match(source, /canonical_v2_active_review_context/);
  assert.match(source, /canonical_v2_exact_detail/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_market_cohort/);
  assert.match(source, /GRANT EXECUTE ON FUNCTION public\.canonical_v2_active_query_page_v2/);
  assert.match(source, /queryCanonicalResultPage/);
  assert.match(source, /releaseSelector: 'ACTIVE'/);
  assert.match(source, /SELECT public\.canonical_v2_market_cohort/);
  assert.match(source, /table_privilege_count/);
  assert.match(source, /writer_allowed/);
  assert.match(source, /permissions exceed the four-function read contract/);
  assert.doesNotMatch(source, /GRANT canonical_v2_serving TO canonical_v2_preview/);
});

test('Preview access uses rollback by default, rotates on apply and never prints the credential', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /commit \? 'COMMIT;' : 'ROLLBACK;'/);
  assert.match(source, /randomBytes\(48\)\.toString\('base64url'\)/);
  assert.match(source, /CANONICAL_V2_STAGING_DATABASE_URL/);
  assert.match(source, /stdio: \['pipe', 'inherit', 'inherit'\]/);
  assert.doesNotMatch(source, /console\.log\(.*password|process\.stdout\.write\(.*connectionString/);
});

test('pooler propagation checks are bounded and isolated from the request path', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /maximumAttempts = 3/);
  assert.match(source, /setTimeout\(resolvePromise, 6000\)/);
  assert.match(source, /after bounded propagation checks/);
});

test('Preview access rejects ambiguous invocation before any database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--apply', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stdout, /Preview role applied/);
});
