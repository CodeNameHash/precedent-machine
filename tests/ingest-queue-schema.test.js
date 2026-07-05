const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'ingest-queue-schema.sql'), 'utf8');
const compact = sql.toLowerCase().replace(/\s+/g, ' ');

test('queue schema creates the required tables', () => {
  for (const table of [
    'public.ingest_runs',
    'public.ingest_jobs',
    'public.ingest_job_dependencies',
    'public.ingest_job_artifacts',
    'public.ingest_job_events',
  ]) {
    assert.match(compact, new RegExp(`create table if not exists ${table.replace('.', '\\.')}`));
  }
});

test('deal candidates get review state columns and needs_review status', () => {
  assert.match(compact, /alter table public\.deal_candidates/);
  assert.match(compact, /add column if not exists review_notes text/);
  assert.match(compact, /add column if not exists last_error text/);
  assert.match(compact, /'needs_review'/);
});

test('jobs use the staged ingest graph and bounded attempts', () => {
  const jobsTable = compact.match(/create table if not exists public\.ingest_jobs \((.*?)\);/);
  assert.ok(jobsTable, 'ingest_jobs table definition not found');
  for (const kind of ['deal-prepare', 'family-extract', 'deal-qa', 'finalize-candidate']) {
    assert.match(jobsTable[1], new RegExp(`'${kind}'`));
  }
  for (const status of ['pending', 'running', 'succeeded', 'needs_review', 'failed', 'cancelled']) {
    assert.match(jobsTable[1], new RegExp(`'${status}'`));
  }
  assert.match(jobsTable[1], /attempts int not null default 0/);
  assert.match(jobsTable[1], /max_attempts int not null default 1/);
});

test('claim RPC is lease-based, dependency-gated, and run-scoped', () => {
  assert.match(compact, /create or replace function public\.claim_ingest_jobs/);
  assert.match(compact, /p_run_id text default null/);
  assert.match(compact, /returns setof public\.ingest_jobs/);
  assert.match(compact, /j\.status = 'pending'/);
  assert.match(compact, /p_run_id is null or j\.run_id = p_run_id/);
  assert.match(compact, /j\.attempts < j\.max_attempts/);
  assert.match(compact, /for update skip locked/);
  assert.match(compact, /dep\.status <> 'succeeded'/);
  assert.match(compact, /set status = 'running'/);
  assert.match(compact, /attempts = j\.attempts \+ 1/);
});

test('schema enables RLS without adding client policies', () => {
  for (const table of [
    'ingest_runs',
    'ingest_jobs',
    'ingest_job_dependencies',
    'ingest_job_artifacts',
    'ingest_job_events',
  ]) {
    assert.match(compact, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.doesNotMatch(compact, /create policy/);
});

test('schema adds run, claim, dependency, event, and artifact indexes', () => {
  for (const index of [
    'idx_ingest_runs_status_created',
    'idx_ingest_jobs_run_status',
    'idx_ingest_jobs_claim',
    'idx_ingest_job_dependencies_depends',
    'idx_ingest_job_events_run_created',
    'idx_ingest_job_artifacts_run_created',
  ]) {
    assert.match(compact, new RegExp(`create index if not exists ${index}`));
  }
});
