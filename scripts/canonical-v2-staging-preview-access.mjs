#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { compileActiveReviewContextRequest } = require('../lib/canonical-v2/review-context');
const { Client } = pg;

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, '..');
const EXPECTED_PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
  poolerHost: 'aws-1-us-west-2.pooler.supabase.com',
});
const EXPECTED_VERCEL = Object.freeze({
  projectId: 'prj_pseZ68ISXsxADzNcffHTO2NuGM8b',
  projectName: 'deal-corpus',
  previewBranch: 'codex/canonical-corpus-v2',
});
const ROLE_NAME = 'canonical_v2_preview';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readGuardedConfiguration() {
  const projectRef = readFileSync(join(REPOSITORY_ROOT, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
  const linked = JSON.parse(readFileSync(
    join(REPOSITORY_ROOT, 'supabase', '.temp', 'linked-project.json'),
    'utf8',
  ));
  const vercel = JSON.parse(readFileSync(join(REPOSITORY_ROOT, '.vercel', 'project.json'), 'utf8'));
  const pooler = new URL(readFileSync(
    join(REPOSITORY_ROOT, 'supabase', '.temp', 'pooler-url'),
    'utf8',
  ).trim());
  if (projectRef !== EXPECTED_PROJECT.ref
    || linked.ref !== EXPECTED_PROJECT.ref
    || linked.name !== EXPECTED_PROJECT.name
    || pooler.hostname !== EXPECTED_PROJECT.poolerHost
    || vercel.projectId !== EXPECTED_VERCEL.projectId
    || vercel.projectName !== EXPECTED_VERCEL.projectName) {
    fail('Refusing to provision Preview access outside the guarded staging projects.');
  }
  return pooler;
}

function roleSql(password) {
  const literal = password.replaceAll("'", "''");
  return `
    DO $role$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE_NAME}') THEN
        CREATE ROLE ${ROLE_NAME}
          LOGIN INHERIT CONNECTION LIMIT 2 PASSWORD '${literal}';
      END IF;
    END
    $role$;
    ALTER ROLE ${ROLE_NAME}
      WITH LOGIN INHERIT CONNECTION LIMIT 2
      PASSWORD '${literal}';
    REVOKE canonical_v2_writer FROM ${ROLE_NAME};
    REVOKE canonical_v2_serving FROM ${ROLE_NAME};
    REVOKE ALL ON ALL TABLES IN SCHEMA public, canonical_v2_staging FROM ${ROLE_NAME};
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public, canonical_v2_staging FROM ${ROLE_NAME};
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${ROLE_NAME};
    GRANT USAGE ON SCHEMA public TO ${ROLE_NAME};
    GRANT EXECUTE ON FUNCTION public.canonical_v2_active_review_context(text, text, text, uuid, integer, text)
      TO ${ROLE_NAME};
    GRANT EXECUTE ON FUNCTION public.canonical_v2_exact_detail(text, text, text, text, uuid, text, text)
      TO ${ROLE_NAME};
  `;
}

function verificationSql() {
  return `
    SELECT jsonb_build_object(
      'role_exists', EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = '${ROLE_NAME}'
          AND rolcanlogin
          AND NOT rolsuper
          AND NOT rolcreatedb
          AND NOT rolcreaterole
          AND NOT rolreplication
          AND NOT rolbypassrls
          AND rolconnlimit = 2
      ),
      'executable_public_functions', (
        SELECT coalesce(jsonb_agg(p.proname ORDER BY p.proname), '[]'::jsonb)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND has_function_privilege('${ROLE_NAME}', p.oid, 'EXECUTE')
      ),
      'table_privilege_count', (
        SELECT count(*)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('public', 'canonical_v2_staging')
          AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
          AND has_table_privilege('${ROLE_NAME}', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      ),
      'writer_allowed', has_function_privilege('${ROLE_NAME}', 'public.canonical_v2_write(text,text,text,text,jsonb,jsonb,jsonb,jsonb)', 'EXECUTE')
    ) AS verification;
  `;
}

function parseRows(stdout) {
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error('Supabase returned a non-JSON response.');
  }
  if (!payload || !Array.isArray(payload.rows)) throw new Error('Supabase response has no rows array.');
  return payload.rows;
}

function runSql(sql, { commit }) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-preview-access-'));
  const file = join(directory, commit ? 'commit.sql' : 'rollback.sql');
  writeFileSync(
    file,
    `BEGIN;\n${sql}\n${verificationSql()}\n${commit ? 'COMMIT;' : 'ROLLBACK;'}\n`,
    { mode: 0o600 },
  );
  try {
    const result = spawnSync(
      'supabase',
      ['db', 'query', '--linked', '--file', file, '--output', 'json'],
      { cwd: REPOSITORY_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    if (result.status !== 0) throw new Error('Preview access SQL failed.');
    return parseRows(result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function assertVerification(value) {
  const expectedFunctions = ['canonical_v2_active_review_context', 'canonical_v2_exact_detail'];
  if (!value?.role_exists
    || value.table_privilege_count !== 0
    || value.writer_allowed !== false
    || JSON.stringify(value.executable_public_functions) !== JSON.stringify(expectedFunctions)) {
    throw new Error('Preview role permissions exceed the two-function read contract.');
  }
}

function buildConnectionString(pooler, password) {
  const connection = new URL(pooler.toString());
  connection.username = `${ROLE_NAME}.${EXPECTED_PROJECT.ref}`;
  connection.password = password;
  connection.port = '6543';
  connection.pathname = '/postgres';
  connection.search = '';
  connection.searchParams.set('sslmode', 'require');
  connection.searchParams.set('uselibpqcompat', 'true');
  return connection.toString();
}

async function verifyRuntimeConnectionOnce(connectionString) {
  const request = compileActiveReviewContextRequest({
    contract_fingerprint: '7a869d03bbfd0adc9992f61b2c579fb6d82506755bcf4e8d5116442c4462aa50',
    application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
    page_size: 100,
    after_row_serving_key: null,
  });
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 8000,
    query_timeout: 3000,
    statement_timeout: 2500,
    application_name: 'canonical-v2-preview-provisioner',
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const result = await client.query({
      text: 'SELECT public.canonical_v2_active_review_context($1::text, $2::text, $3::text, $4::uuid, $5::integer, $6::text) AS data',
      values: [
        'staging',
        request.contract_fingerprint,
        request.request_digest,
        request.application_deal_id,
        request.page_size,
        request.after_row_serving_key,
      ],
    });
    if (result.rowCount !== 1
      || result.rows[0]?.data?.schema_version !== 'ACTIVE_REVIEW_CONTEXT_RESULT/V1'
      || result.rows[0]?.data?.page_count !== 2) {
      throw new Error('Preview role did not return the complete reviewed QXO page.');
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function verifyRuntimeConnection(connectionString) {
  const maximumAttempts = 3;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      await verifyRuntimeConnectionOnce(connectionString);
      return;
    } catch {
      if (attempt === maximumAttempts) {
        throw new Error('Preview role was not available through the transaction pooler after bounded propagation checks.');
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 6000));
    }
  }
}

function setVercelPreviewSecret(value) {
  const result = spawnSync(
    'vercel',
    [
      'env',
      'add',
      'CANONICAL_V2_STAGING_DATABASE_URL',
      'preview',
      EXPECTED_VERCEL.previewBranch,
      '--force',
      '--sensitive',
      '--yes',
    ],
    { cwd: REPOSITORY_ROOT, input: value, encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] },
  );
  if (result.status !== 0) throw new Error('Vercel Preview credential update failed.');
}

function verifyStoredRole() {
  const rows = runSql('', { commit: false });
  if (rows.length !== 1) throw new Error('Preview role verification returned an unexpected row count.');
  assertVerification(rows[0].verification);
  process.stdout.write('Preview role remains limited to two read RPCs and zero tables.\n');
}

const mode = process.argv[2] || '--dry-run';
if (!['--dry-run', '--apply', '--verify'].includes(mode) || process.argv.length > 3) {
  fail('Usage: node scripts/canonical-v2-staging-preview-access.mjs [--dry-run|--apply|--verify]');
}
const pooler = readGuardedConfiguration();

try {
  if (mode === '--verify') {
    verifyStoredRole();
  } else {
    const password = randomBytes(48).toString('base64url');
    const rows = runSql(roleSql(password), { commit: mode === '--apply' });
    if (rows.length !== 1) throw new Error('Preview role provisioning returned an unexpected row count.');
    assertVerification(rows[0].verification);
    if (mode === '--dry-run') {
      process.stdout.write('Preview role dry-run passed and rolled back.\n');
    } else {
      const connectionString = buildConnectionString(pooler, password);
      await verifyRuntimeConnection(connectionString);
      setVercelPreviewSecret(connectionString);
      process.stdout.write('Preview role applied, runtime-verified and stored in Vercel Preview.\n');
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : 'Preview access command failed.');
}
