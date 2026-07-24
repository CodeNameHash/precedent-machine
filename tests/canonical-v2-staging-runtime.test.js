const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MODULE_PATH = path.resolve(
  'scripts/lib/canonical-v2-staging-runtime.mjs',
);

function linkedRoot({ ref = 'sjumbznveyyiizhwvixj', name = 'deal-corpus-canonical-v2-staging' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-v2-runtime-test-'));
  const directory = path.join(root, 'supabase', '.temp');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'project-ref'), `${ref}\n`);
  fs.writeFileSync(
    path.join(directory, 'linked-project.json'),
    JSON.stringify({ ref, name }),
  );
  return root;
}

test('runtime is hard-pinned to isolated staging and has no production or credential path', () => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /Refusing to run outside/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy|environment:\s*['"]production['"]/);
  assert.doesNotMatch(
    source,
    /process\.env|DATABASE_URL|SUPABASE_SERVICE|keychain|security\s+find-generic-password/i,
  );
});

test('project guard accepts only the exact linked staging project', async (t) => {
  const { createCanonicalV2StagingRuntime } = await import(MODULE_PATH);
  const exact = linkedRoot();
  const wrong = linkedRoot({ ref: 'a'.repeat(20), name: 'not-staging' });
  t.after(() => {
    fs.rmSync(exact, { recursive: true, force: true });
    fs.rmSync(wrong, { recursive: true, force: true });
  });

  const runtime = createCanonicalV2StagingRuntime({ root: exact });
  assert.equal(runtime.guardProject().ref, 'sjumbznveyyiizhwvixj');
  assert.throws(
    () => createCanonicalV2StagingRuntime({ root: wrong }).guardProject(),
    /Refusing to run outside/,
  );
});

test('transport is temp-file bounded, rollback-first, redacted and non-retrying', () => {
  const source = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.match(source, /mkdtempSync\(join\(tmpdir\(\), governedTempPrefix\)\)/);
  assert.match(source, /mode: 0o600/);
  assert.match(source, /SET LOCAL statement_timeout/);
  assert.match(source, /commit \? 'COMMIT;' : 'ROLLBACK;'/);
  assert.match(source, /maxSqlBytes/);
  assert.match(source, /maxResponseBytes/);
  assert.match(source, /maxProcessBufferBytes/);
  assert.match(source, /timeout: bounds\.processTimeoutMs/);
  assert.match(source, /shell: false/);
  assert.match(source, /redacted-database-url/);
  assert.match(source, /'\$1\[redacted\]'/);
  assert.doesNotMatch(source, /\bretry\b|setInterval|setTimeout/);
});

test('request bounds and safe SQL literals fail before database execution', async (t) => {
  const { createCanonicalV2StagingRuntime } = await import(MODULE_PATH);
  const root = linkedRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtime = createCanonicalV2StagingRuntime({
    root,
    bounds: {
      maxSqlBytes: 64,
      maxResponseBytes: 128,
      maxProcessBufferBytes: 256,
    },
  });

  assert.throws(() => runtime.runSql('x'.repeat(65)), /bounded request limit/);
  assert.equal(runtime.sqlText("Ben's"), "'Ben''s'");
  assert.match(runtime.sqlJson({ exact: true }), /^\$canonical_v2_[a-f0-9]{16}\$/);
  assert.throws(
    () => createCanonicalV2StagingRuntime({
      root,
      bounds: { maxResponseBytes: 257, maxProcessBufferBytes: 256 },
    }),
    /cannot exceed/,
  );
  assert.equal(
    runtime.safeDiagnostic(
      'ERROR: postgresql://name:pass@example.test/db token=abc service_role_key=def',
    ),
    'ERROR: [redacted-database-url] token=[redacted] service_role_key=[redacted]',
  );
});

test('RPC client exposes only governed staging writer operations and never activation', async (t) => {
  const { createCanonicalV2StagingRuntime } = await import(MODULE_PATH);
  const root = linkedRoot();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtime = createCanonicalV2StagingRuntime({ root });
  const client = runtime.sqlRpcClient();
  const unsupported = await client.rpc('canonical_v2_activate_candidate_release', {
    p_environment: 'staging',
  });
  const wrongEnvironment = await client.rpc('canonical_v2_import_candidate_release', {
    p_environment: 'production',
    p_import_plan: {},
  });
  const source = fs.readFileSync(MODULE_PATH, 'utf8');

  assert.deepEqual(unsupported, {
    data: null,
    error: { message: 'Unsupported canonical staging RPC.' },
  });
  assert.match(wrongEnvironment.error.message, /must be staging/);
  for (const operation of [
    'canonical_v2_select_candidate_inputs',
    'canonical_v2_recheck_candidate_input_head',
    'canonical_v2_write',
    'canonical_v2_import_candidate_release',
    'canonical_v2_rollback_inactive_candidate_release',
  ]) assert.match(source, new RegExp(`name === '${operation}'`));
  assert.doesNotMatch(source, /name === 'canonical_v2_activate|public\.canonical_v2_activate/);
});
