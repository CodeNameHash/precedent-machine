#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const EXPECTED_PROJECT = Object.freeze({
  ref: 'sjumbznveyyiizhwvixj',
  name: 'deal-corpus-canonical-v2-staging',
});
const EXPECTED_DIGESTS = Object.freeze({
  'canonical-v2-foundation.sql': 'c54dff9b96fbb5db17e45cddba8e58ea93b605902b08a6eecead2408a45a455e',
  'canonical-v2-serving.sql': 'eb7070885075ddd2076a03d41d9b99ae84c321a1cf01ede57999f56e83b39250',
});
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

function readGovernedSql() {
  return Object.entries(EXPECTED_DIGESTS).map(([filename, expectedDigest]) => {
    const sql = readFileSync(join(REPOSITORY_ROOT, 'supabase', filename), 'utf8');
    const actualDigest = sha256(sql);
    if (actualDigest !== expectedDigest) {
      fail(`${filename} digest changed: expected ${expectedDigest}, received ${actualDigest}.`);
    }
    return { filename, sql, digest: actualDigest };
  });
}

function runSqlFile(sql, mode) {
  const directory = mkdtempSync(join(tmpdir(), 'canonical-v2-staging-schema-'));
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

function verifyAppliedSchema() {
  const sql = `
    select
      to_regnamespace('canonical_v2_staging') is not null as canonical_schema_exists,
      to_regclass('canonical_v2_staging.validated_semantic_graphs') is not null as semantic_graph_table_exists,
      to_regclass('canonical_v2_staging.candidate_release_semantic_graphs') is not null as release_semantic_graph_table_exists,
      to_regprocedure('public.canonical_v2_write(text,text,text,text,jsonb,jsonb,jsonb,jsonb)') is not null as writer_exists,
      to_regprocedure('public.canonical_v2_active_review_context(text,text,text,uuid,integer,text)') is not null as review_rpc_exists,
      to_regprocedure('public.canonical_v2_exact_detail(text,text,text,text,uuid,text,text)') is not null as exact_detail_rpc_exists,
      has_function_privilege('anon', 'public.canonical_v2_active_review_context(text,text,text,uuid,integer,text)', 'EXECUTE') = false as anon_review_denied,
      has_function_privilege('service_role', 'public.canonical_v2_active_review_context(text,text,text,uuid,integer,text)', 'EXECUTE') = false as service_role_review_denied,
      has_function_privilege('canonical_v2_serving', 'public.canonical_v2_active_review_context(text,text,text,uuid,integer,text)', 'EXECUTE') as serving_review_allowed,
      has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.candidate_release_semantic_graphs', 'SELECT') = false as serving_semantic_graph_table_denied;
  `;
  return spawnSync(
    'supabase',
    ['db', 'query', '--linked', sql, '--output', 'json'],
    { cwd: REPOSITORY_ROOT, stdio: 'inherit' },
  ).status;
}

const mode = process.argv[2] || '--dry-run';
if (!['--dry-run', '--apply', '--verify'].includes(mode) || process.argv.length > 3) {
  fail('Usage: node scripts/canonical-v2-staging-schema.mjs [--dry-run|--apply|--verify]');
}
readLinkedProject();
if (mode === '--verify') process.exit(verifyAppliedSchema() ?? 1);

const governedSql = readGovernedSql();
process.stdout.write(`${mode === '--apply' ? 'Applying' : 'Dry-running'} canonical v2 staging schema:\n`);
for (const item of governedSql) process.stdout.write(`  ${item.filename} ${item.digest}\n`);
const status = runSqlFile(governedSql.map((item) => item.sql).join('\n'), mode.slice(2));
if (status !== 0) process.exit(status ?? 1);
if (mode === '--apply') process.exit(verifyAppliedSchema() ?? 1);
process.stdout.write('Dry run rolled back successfully. No schema changes persisted.\n');
