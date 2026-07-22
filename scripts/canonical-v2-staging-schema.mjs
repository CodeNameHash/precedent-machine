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
  'canonical-v2-foundation.sql': 'a6d1337792d1929b175692133a222b5db6ee1010f8a50ba4584d79573328cfab',
  'canonical-v2-serving.sql': '0cc018538748d7e28f9a07f963385216ffd1eada4f1686b11900e63631b157dc',
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
      to_regclass('canonical_v2_staging.intake_capture_receipts') is not null as intake_capture_receipt_table_exists,
      to_regclass('canonical_v2_staging.source_artifact_manifests') is not null as source_artifact_manifest_table_exists,
      to_regclass('canonical_v2_staging.source_artifact_chunks') is not null as source_artifact_chunk_table_exists,
      to_regclass('canonical_v2_staging.canonical_text_conversions') is not null as canonical_text_conversion_table_exists,
      to_regclass('canonical_v2_staging.canonical_text_verification_manifests') is not null as canonical_text_verification_table_exists,
      to_regclass('canonical_v2_staging.source_admission_preparation_receipts') is not null as source_admission_preparation_table_exists,
      to_regclass('canonical_v2_staging.semantic_extraction_input_envelopes') is not null as semantic_extraction_input_table_exists,
      to_regclass('canonical_v2_staging.candidate_release_semantic_graphs') is not null as release_semantic_graph_table_exists,
      to_regclass('canonical_v2_staging.candidate_release_correction_input_seals') is not null as correction_seal_table_exists,
      to_regclass('canonical_v2_staging.candidate_release_correction_discharges') is not null as correction_discharge_table_exists,
      to_regclass('canonical_v2_staging.correction_authority_materialisations') is not null as correction_authority_materialisation_table_exists,
      to_regclass('canonical_v2_staging.correction_discharge_maps') is not null as correction_discharge_map_table_exists,
      to_regclass('canonical_v2_staging.candidate_input_events') is not null as candidate_input_event_table_exists,
      to_regclass('canonical_v2_staging.candidate_input_head_versions') is not null as candidate_input_head_version_table_exists,
      to_regclass('canonical_v2_staging.candidate_input_heads') is not null as candidate_input_head_pointer_table_exists,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'canonical_v2_staging'
          and table_name = 'candidate_release_import_receipts'
          and column_name = 'correction_input_seal_id'
      ) as receipt_correction_seal_exists,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'canonical_v2_staging'
          and table_name = 'candidate_release_import_receipts'
          and column_name = 'candidate_input_head_id'
      ) as receipt_candidate_input_head_exists,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'canonical_v2_staging'
          and table_name = 'candidate_release_import_receipts'
          and column_name = 'correction_discharge_map_id'
      ) as receipt_correction_discharge_map_exists,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'canonical_v2_staging'
          and table_name = 'active_corpus_release_pointers'
          and column_name = 'correction_input_root'
      ) as active_pointer_correction_root_exists,
      to_regprocedure('public.canonical_v2_write(text,text,text,text,jsonb,jsonb,jsonb,jsonb)') is not null as writer_exists,
      to_regprocedure('public.canonical_v2_select_candidate_inputs(text,text)') is not null as candidate_input_selector_exists,
      to_regprocedure('public.canonical_v2_recheck_candidate_input_head(text,text,text,text)') is not null as candidate_input_recheck_exists,
      to_regprocedure('public.canonical_v2_rollback_inactive_candidate_release(text,text,text,text,text)') is not null as inactive_candidate_rollback_exists,
      to_regprocedure('public.canonical_v2_market_cohort(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric)') is not null as market_rpc_exists,
      to_regprocedure('public.canonical_v2_active_review_context(text,text,text,uuid,integer,text)') is not null as review_rpc_exists,
      to_regprocedure('public.canonical_v2_exact_detail(text,text,text,text,uuid,text,text)') is not null as exact_detail_rpc_exists,
      has_function_privilege('anon', 'public.canonical_v2_market_cohort(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric)', 'EXECUTE') = false as anon_market_denied,
      has_function_privilege('service_role', 'public.canonical_v2_market_cohort(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric)', 'EXECUTE') = false as service_role_market_denied,
      has_function_privilege('canonical_v2_serving', 'public.canonical_v2_market_cohort(text,text,text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric)', 'EXECUTE') as serving_market_allowed,
      has_function_privilege('anon', 'public.canonical_v2_active_review_context(text,text,text,uuid,integer,text)', 'EXECUTE') = false as anon_review_denied,
      has_function_privilege('service_role', 'public.canonical_v2_active_review_context(text,text,text,uuid,integer,text)', 'EXECUTE') = false as service_role_review_denied,
      has_function_privilege('canonical_v2_serving', 'public.canonical_v2_active_review_context(text,text,text,uuid,integer,text)', 'EXECUTE') as serving_review_allowed,
      has_function_privilege('service_role', 'public.canonical_v2_select_candidate_inputs(text,text)', 'EXECUTE') = false as service_role_candidate_input_selector_denied,
      has_function_privilege('canonical_v2_serving', 'public.canonical_v2_select_candidate_inputs(text,text)', 'EXECUTE') = false as serving_candidate_input_selector_denied,
      has_function_privilege('canonical_v2_writer', 'public.canonical_v2_select_candidate_inputs(text,text)', 'EXECUTE') as writer_candidate_input_selector_allowed,
      has_function_privilege('service_role', 'public.canonical_v2_recheck_candidate_input_head(text,text,text,text)', 'EXECUTE') = false as service_role_candidate_input_recheck_denied,
      has_function_privilege('canonical_v2_serving', 'public.canonical_v2_recheck_candidate_input_head(text,text,text,text)', 'EXECUTE') = false as serving_candidate_input_recheck_denied,
      has_function_privilege('canonical_v2_writer', 'public.canonical_v2_recheck_candidate_input_head(text,text,text,text)', 'EXECUTE') as writer_candidate_input_recheck_allowed,
      has_function_privilege('service_role', 'public.canonical_v2_rollback_inactive_candidate_release(text,text,text,text,text)', 'EXECUTE') = false as service_role_inactive_candidate_rollback_denied,
      has_function_privilege('canonical_v2_serving', 'public.canonical_v2_rollback_inactive_candidate_release(text,text,text,text,text)', 'EXECUTE') = false as serving_inactive_candidate_rollback_denied,
      has_function_privilege('canonical_v2_writer', 'public.canonical_v2_rollback_inactive_candidate_release(text,text,text,text,text)', 'EXECUTE') as writer_inactive_candidate_rollback_allowed,
      has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.candidate_release_semantic_graphs', 'SELECT') = false as serving_semantic_graph_table_denied,
      has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.candidate_release_correction_input_seals', 'SELECT') = false as serving_correction_seal_table_denied,
      has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.candidate_release_correction_discharges', 'SELECT') = false as serving_correction_discharge_table_denied,
      has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.candidate_input_heads', 'SELECT') = false as writer_candidate_input_head_table_denied,
      has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.candidate_input_heads', 'SELECT') = false as serving_candidate_input_head_table_denied,
      (has_table_privilege('service_role', 'canonical_v2_staging.intake_capture_receipts', 'SELECT') = false
        and has_table_privilege('service_role', 'canonical_v2_staging.intake_capture_receipts', 'INSERT') = false
        and has_table_privilege('service_role', 'canonical_v2_staging.intake_capture_receipts', 'UPDATE') = false
        and has_table_privilege('service_role', 'canonical_v2_staging.intake_capture_receipts', 'DELETE') = false) as service_role_intake_capture_table_denied,
      (has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.intake_capture_receipts', 'SELECT') = false
        and has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.intake_capture_receipts', 'INSERT') = false
        and has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.intake_capture_receipts', 'UPDATE') = false
        and has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.intake_capture_receipts', 'DELETE') = false) as serving_intake_capture_table_denied,
      (has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.intake_capture_receipts', 'SELECT') = false
        and has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.intake_capture_receipts', 'INSERT') = false
        and has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.intake_capture_receipts', 'UPDATE') = false
        and has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.intake_capture_receipts', 'DELETE') = false) as writer_intake_capture_table_denied,
      (has_table_privilege('service_role', 'canonical_v2_staging.source_artifact_manifests', 'SELECT') = false
        and has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.source_artifact_chunks', 'SELECT') = false
        and has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.source_artifact_manifests', 'INSERT') = false
        and has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.source_artifact_chunks', 'INSERT') = false) as source_artifact_tables_denied,
      (has_table_privilege('service_role', 'canonical_v2_staging.canonical_text_conversions', 'SELECT') = false
        and has_table_privilege('canonical_v2_serving', 'canonical_v2_staging.canonical_text_verification_manifests', 'SELECT') = false
        and has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.source_admission_preparation_receipts', 'SELECT') = false
        and has_table_privilege('canonical_v2_writer', 'canonical_v2_staging.semantic_extraction_input_envelopes', 'INSERT') = false) as source_admission_tables_denied;
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
