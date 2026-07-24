const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-active-release-fingerprint.mjs';

test('active-release-fingerprint runner is hard-pinned to isolated staging and rolls back by default', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /const terminal = mode === 'apply' \? 'COMMIT;' : 'ROLLBACK;'/);
  assert.match(source, /EXPECTED_FUNCTION_DIGEST/);
  assert.doesNotMatch(source, /precedent-machine['"]|tzulhdasmioeechxapdy/);
});

test('runner extracts canonical_v2_active_query_page_v2 verbatim from the governed schema file and pins its digest', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  const servingSql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const start = servingSql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page_v2(\n');
  const end = servingSql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page(\n');
  assert.ok(start >= 0 && end > start);
  const functionSql = servingSql.slice(start, end).trim();
  const digest = crypto.createHash('sha256').update(functionSql).digest('hex');
  const pinnedMatch = source.match(/EXPECTED_FUNCTION_DIGEST = '([a-f0-9]{64})'/);
  assert.ok(pinnedMatch, 'runner must pin EXPECTED_FUNCTION_DIGEST');
  assert.equal(pinnedMatch[1], digest, 'pinned digest must match the current governed function body');
  assert.match(functionSql, /release_contract_fingerprint/);
  assert.match(functionSql, /FROM canonical_v2_staging\.fixture_corpus_releases release/);
  assert.match(functionSql, /p_contract_fingerprint => release_contract_fingerprint/);
});

test('runner refuses to apply if the extracted function body drifts from what it pins', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /Refusing to run outside/);
  assert.match(source, /body changed: expected/);
  assert.match(source, /does not look like the release-declared-fingerprint fix/);
});

test('runner rejects ambiguous invocation before project or database access', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--apply', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stdout, /Applying canonical_v2_active_query_page/);
});

test('the migrated function body preserves the frozen structural shape of the active query RPC', () => {
  const servingSql = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  const start = servingSql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page_v2(\n');
  const end = servingSql.indexOf('CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page(\n');
  const activeFunction = servingSql.slice(start, end);
  assert.match(activeFunction, /FROM canonical_v2_staging\.active_corpus_release_pointers/);
  assert.match(activeFunction, /public\.canonical_v2_query_page_v2\(/);
  assert.match(activeFunction, /p_serving_namespace_id => active_pointer\.serving_namespace_id/);
  assert.match(activeFunction, /p_corpus_release_id => active_pointer\.corpus_release_id/);
  assert.match(activeFunction, /jsonb_build_object\('pointer_id', active_pointer\.pointer_id\)/);
  assert.doesNotMatch(activeFunction, /p_serving_namespace_id text|p_corpus_release_id text/);
});
