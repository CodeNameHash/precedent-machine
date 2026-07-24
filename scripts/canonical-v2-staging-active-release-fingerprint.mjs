#!/usr/bin/env node

// Additive, narrowly-scoped migration for the release-declared-fingerprint
// serving fix (2026-07-23). See
// docs/handoffs/SPEC-CONTRACT-AMENDMENT-PATH-2026-07-23.md, option 1.
//
// Applies ONLY the updated public.canonical_v2_active_query_page_v2 function
// body (extracted verbatim from supabase/canonical-v2-serving.sql, the
// single source of truth) so the ACTIVE query RPC resolves and filters
// against the fingerprint the active release itself declares (read from
// canonical_v2_staging.fixture_corpus_releases) instead of trusting the
// caller-supplied p_contract_fingerprint for equality. The function
// signature is unchanged -- this is a CREATE OR REPLACE of the same
// fourteen-plus-twenty-parameter procedure, so it never breaks existing
// callers and requires no companion DROP.
//
// Dry-run first, always. Ben runs --apply by hand after reviewing the
// diff; nothing here is invoked from CI or from any application code path.

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const EXPECTED_PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
// Pins the exact function body this script applies, extracted from
// supabase/canonical-v2-serving.sql (the governed schema file). If that
// file's function text drifts from this digest, the script refuses to run
// rather than silently apply something unreviewed.
const EXPECTED_FUNCTION_DIGEST = '2b9c22f01e9975257d8327284b9d7a3af916a62fee0c808a7c7a83f0a4f9eb14';
const START_MARKER = 'CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page_v2(\n';
const END_MARKER = 'CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page(\n';

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readLinkedProject() {
  const ref = readFileSync(join(REPOSITORY_ROOT, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
  const metadata = JSON.parse(readFileSync(
    join(REPOSITORY_ROOT, 'supabase', '.temp', 'linked-project.json'),
    'utf8',
  ));
  if (ref !== EXPECTED_PROJECT.ref
    || metadata.ref !== EXPECTED_PROJECT.ref
    || metadata.name !== EXPECTED_PROJECT.name) {
    fail(`Refusing to run outside ${EXPECTED_PROJECT.name} (${EXPECTED_PROJECT.ref}).`);
  }
}

function readGovernedFunctionSql() {
  const servingSql = readFileSync(join(REPOSITORY_ROOT, 'supabase', 'canonical-v2-serving.sql'), 'utf8');
  const start = servingSql.indexOf(START_MARKER);
  const end = servingSql.indexOf(END_MARKER);
  if (start < 0 || end <= start) {
    fail('Could not locate canonical_v2_active_query_page_v2 in supabase/canonical-v2-serving.sql.');
  }
  const functionSql = servingSql.slice(start, end).trim();
  const digest = sha256(functionSql);
  if (digest !== EXPECTED_FUNCTION_DIGEST) {
    fail(`canonical_v2_active_query_page_v2 body changed: expected ${EXPECTED_FUNCTION_DIGEST}, received ${digest}.`);
  }
  if (!functionSql.includes('release_contract_fingerprint')
    || !functionSql.includes('FROM canonical_v2_staging.fixture_corpus_releases release')) {
    fail('Extracted function body does not look like the release-declared-fingerprint fix.');
  }
  return { sql: functionSql, digest };
}

function runSqlFile(sql, mode) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-active-release-fingerprint-'));
  const file = join(directory, `${mode}.sql`);
  const terminal = mode === 'apply' ? 'COMMIT;' : 'ROLLBACK;';
  writeFileSync(file, `BEGIN;\n${sql}\n${terminal}\n`, { mode: 0o600 });
  try {
    return spawnSync(
      'supabase',
      ['db', 'query', '--linked', '--file', file],
      { cwd: REPOSITORY_ROOT, stdio: 'inherit' },
    ).status;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function verifyApplied() {
  const sql = `
    select
      to_regprocedure('public.canonical_v2_active_query_page_v2(text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric,numeric,numeric,text,text,text,text,text,text,text,text,text,text,text,integer,text,text)') is not null as active_query_rpc_exists,
      pg_get_functiondef('public.canonical_v2_active_query_page_v2(text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric,numeric,numeric,text,text,text,text,text,text,text,text,text,text,text,integer,text,text)'::regprocedure) like '%release_contract_fingerprint%' as resolves_release_declared_fingerprint,
      pg_get_functiondef('public.canonical_v2_active_query_page_v2(text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric,numeric,numeric,text,text,text,text,text,text,text,text,text,text,text,integer,text,text)'::regprocedure) like '%FROM canonical_v2_staging.fixture_corpus_releases release%' as reads_fixture_corpus_releases;
  `;
  return spawnSync(
    'supabase',
    ['db', 'query', '--linked', sql, '--output', 'json'],
    { cwd: REPOSITORY_ROOT, stdio: 'inherit' },
  ).status;
}

const mode = process.argv[2] || '--dry-run';
if (!['--dry-run', '--apply', '--verify'].includes(mode) || process.argv.length > 3) {
  fail('Usage: node scripts/canonical-v2-staging-active-release-fingerprint.mjs [--dry-run|--apply|--verify]');
}
readLinkedProject();
if (mode === '--verify') process.exit(verifyApplied() ?? 1);

const governedFunction = readGovernedFunctionSql();
process.stdout.write(`${mode === '--apply' ? 'Applying' : 'Dry-running'} canonical_v2_active_query_page_v2 (release-declared fingerprint fix):\n`);
process.stdout.write(`  canonical-v2-serving.sql#canonical_v2_active_query_page_v2 ${governedFunction.digest}\n`);
const status = runSqlFile(governedFunction.sql, mode.slice(2));
if (status !== 0) process.exit(status ?? 1);
if (mode === '--apply') process.exit(verifyApplied() ?? 1);
process.stdout.write('Dry run rolled back successfully. No schema changes persisted.\n');
