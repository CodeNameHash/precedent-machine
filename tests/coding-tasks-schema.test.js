const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'coding-tasks-schema.sql'), 'utf8');
const compact = sql.toLowerCase().replace(/\s+/g, ' ');

test('coding tasks schema creates a durable queue table', () => {
  assert.match(compact, /create table if not exists public\.coding_tasks/);
  for (const column of [
    'status text not null default',
    'suggested_action text not null',
    'deal_id uuid not null references public.deals',
    'provision_id uuid references public.provisions',
    'current_type text',
    'current_category text',
    'current_code text',
    'full_text text not null default',
    'note text not null default',
    'payload jsonb not null default',
    'result jsonb not null default',
    'lock_key text not null',
  ]) {
    assert.match(compact, new RegExp(column.replace(/[.]/g, '\\.')));
  }
});

test('coding tasks schema constrains status and suggested action', () => {
  for (const status of ['pending', 'claimed', 'needs_review', 'applied', 'ignored', 'failed', 'cancelled']) {
    assert.match(compact, new RegExp(`'${status}'`));
  }
  for (const action of ['assign_existing', 'split', 'ignore', 'propose_new_code']) {
    assert.match(compact, new RegExp(`'${action}'`));
  }
});

test('claim_coding_tasks is lease-based and pending-only', () => {
  assert.match(compact, /create or replace function public\.claim_coding_tasks/);
  assert.match(compact, /returns setof public\.coding_tasks/);
  assert.match(compact, /t\.status = 'pending'/);
  assert.match(compact, /t\.attempts < t\.max_attempts/);
  assert.match(compact, /for update skip locked/);
  assert.match(compact, /set status = 'claimed'/);
  assert.match(compact, /attempts = t\.attempts \+ 1/);
});

test('coding tasks schema enables RLS without client policies', () => {
  assert.match(compact, /alter table public\.coding_tasks enable row level security/);
  assert.doesNotMatch(compact, /create policy/);
});

test('coding tasks schema adds queue indexes', () => {
  for (const index of [
    'idx_coding_tasks_status_created',
    'idx_coding_tasks_claim',
    'idx_coding_tasks_deal',
    'idx_coding_tasks_provision',
    'idx_coding_tasks_action',
  ]) {
    assert.match(compact, new RegExp(`create index if not exists ${index}`));
  }
});
