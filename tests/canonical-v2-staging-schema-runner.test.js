const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-schema.mjs';

test('staging schema runner is fixed to the isolated project and rolls back by default', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /const terminal = mode === 'apply' \? 'COMMIT;' : 'ROLLBACK;'/);
  assert.match(source, /EXPECTED_DIGESTS/);
  assert.doesNotMatch(source, /precedent-machine['"]|tzulhdasmioeechxapdy/);
});

test('staging schema runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--apply', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.doesNotMatch(result.stdout, /Applying canonical/);
});

test('staging schema verification checks writer, serving RPCs and denied broad roles', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /canonical_v2_write/);
  assert.match(source, /canonical_v2_active_review_context/);
  assert.match(source, /canonical_v2_exact_detail/);
  assert.match(source, /has_function_privilege\('anon'/);
  assert.match(source, /has_function_privilege\('service_role'/);
  assert.match(source, /has_function_privilege\('canonical_v2_serving'/);
});

test('governed schema uses valid collision-safe advisory lock identities', () => {
  const foundation = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
  const serving = fs.readFileSync('supabase/canonical-v2-serving.sql', 'utf8');
  assert.doesNotMatch(foundation, /E'\\u0000'/);
  assert.doesNotMatch(serving, /E'\\u0000'/);
  assert.match(foundation, /length\(p_operation\)::text \|\| ':' \|\| p_operation/);
  assert.match(serving, /length\(NEW\.metric_slot_key\)::text \|\| ':' \|\| NEW\.metric_slot_key/);
});
