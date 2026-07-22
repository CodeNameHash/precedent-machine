const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-snapshot-source.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('snapshot source runner is hard-pinned, bounded and read-only', () => {
  assert.match(source, /CANONICAL_V2_SNAPSHOT_PROJECT_DIR/);
  assert.match(source, /SNAPSHOT_PROJECT_REF/);
  assert.match(source, /SNAPSHOT_PROJECT_NAME/);
  assert.match(source, /BEGIN TRANSACTION READ ONLY/);
  assert.match(source, /statement_timeout='5000ms'/);
  assert.match(source, /WHERE id = '\$\{QXO_DEAL_ID\}'::uuid/);
  assert.match(source, /LIMIT 2/);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|TRUNCATE\s+TABLE|canonical_v2_write)\b/i);
});

test('snapshot source runner emits no source text, URL or credentials', () => {
  const attestBody = source.slice(source.indexOf('function attest'), source.indexOf('if (process.argv.length'));
  assert.doesNotMatch(attestBody, /canonical_text|source_bytes_base64|source_url[^_]|service_role|password/i);
  assert.match(attestBody, /metadata_source_url_sha256/);
  assert.match(attestBody, /promotable_to_original_source/);
  assert.match(source, /safeDiagnostic/);
  assert.match(source, /redacted-database-url/);
});

test('snapshot source runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--verify', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
