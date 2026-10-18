'use strict';

// Plan finding (140): the hosted worker sandbox pool's database side,
// migration 20261018200000_product_run_sandboxes.sql on inactive Postgres.
// product_sandbox_assign is the atomic implementation of
// lib/product/sandbox-pool.js decideSandboxAssignment: every call here is
// checked against the decision made over the rows as they stood before it.
// Also: the backfill of the run live on the first sandbox at migration time,
// one live run per sandbox by index, the release with a reason, the grants,
// and the rollback.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;

const { decideSandboxAssignment, sandboxPoolNames } = require('../lib/product/sandbox-pool');

const ROOT = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261018200000_product_run_sandboxes.sql'), 'utf8');
const POOL = [...sandboxPoolNames(2)];
const [FIRST, SECOND] = POOL;

const client = () => database.getDatabaseClient();

async function execute(sql) {
  const db = client();
  if (typeof db.exec === 'function') await db.exec(sql);
  else await db.query(sql);
}

async function createRun(status, { updatedAt = 'now()' } = {}) {
  const runId = crypto.randomUUID();
  const sourceId = `source-${runId}`;
  await client().query(`INSERT INTO public.product_source_documents (source_document_id, retrieval_url, raw_sha256, payload, payload_sha256)
    VALUES ($1, $2, 'sha', '{}'::jsonb, 'sha')`, [sourceId, `https://www.sec.gov/Archives/${runId}.htm`]);
  await client().query(`INSERT INTO public.product_analysis_runs (run_id, source_document_id, retrieval_url, idempotency_key, submission_fingerprint,
    schema_version, prompt_bundle_version, model_config, explicit_generation, source_generation, max_attempts, status, stage, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'LEGAL_SCHEMA/V2', 'PRODUCT_LAYERED_COMPONENTS/V9', '{"provider_id":"ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION"}'::jsonb, 0, 1, 3, $6, 'SECTION_ANALYSIS', ${updatedAt})`,
  [runId, sourceId, `https://www.sec.gov/Archives/${runId}.htm`, `key-${runId}`, `fp-${runId}`, status]);
  return runId;
}

async function setStatus(runId, status) {
  await client().query('UPDATE public.product_analysis_runs SET status = $2, updated_at = now() WHERE run_id = $1', [runId, status]);
}

async function rows() {
  const result = await client().query(`SELECT s.run_id, s.sandbox_name, s.assigned_at, s.released_at, s.release_reason, r.status AS run_status
    FROM public.product_run_sandboxes s JOIN public.product_analysis_runs r ON r.run_id = s.run_id ORDER BY s.assigned_at, s.sandbox_name`);
  return result.rows;
}

// The function's answer, checked against the decision over the rows before
// the call, and the rows after it against the decision's effects.
async function assign(runId, pool = POOL) {
  const before = await rows();
  const run = await client().query('SELECT status FROM public.product_analysis_runs WHERE run_id = $1', [runId]);
  const expected = decideSandboxAssignment({ runId, runStatus: run.rows[0].status, pool, assignments: before.map((row) => ({ ...row, run_id: String(row.run_id) })) });
  const result = await client().query('SELECT public.product_sandbox_assign($1, $2::text[]) AS data', [runId, pool]);
  const answer = result.rows[0].data;
  assert.equal(answer.run_id, runId);
  assert.equal(answer.state, expected.state, `state for ${runId}`);
  assert.equal(answer.sandbox_name, expected.sandbox_name);
  assert.deepEqual([...answer.releases].sort(), [...expected.releases].sort());
  assert.deepEqual(answer.sandboxes.map((entry) => [entry.sandbox_name, entry.run_id, entry.run_status]), expected.sandboxes.map((entry) => [entry.sandbox_name, entry.run_id, entry.run_status]));
  const after = await rows();
  for (const released of expected.releases) {
    const row = after.find((candidate) => String(candidate.run_id) === released);
    assert.ok(row.released_at, `${released} released`);
    assert.equal(row.release_reason, row.run_status);
  }
  if (expected.state === 'ASSIGNED') {
    const row = after.find((candidate) => String(candidate.run_id) === runId);
    assert.deepEqual([row.sandbox_name, row.released_at], [expected.sandbox_name, null]);
  }
  return answer;
}

let backfilled;
let stalePartial;
let olderRunning;

test.before(async () => {
  await database.setupDatabase();
  // The run live on the one sandbox before the pool: the most recently
  // updated RUNNING or PARTIAL run is backfilled onto the first sandbox; an
  // older unfinished run (no worker: one lock, one worker) is not.
  olderRunning = await createRun('RUNNING', { updatedAt: "now() - interval '3 hours'" });
  stalePartial = await createRun('PARTIAL', { updatedAt: "now() - interval '2 hours'" });
  backfilled = await createRun('RUNNING', { updatedAt: "now() - interval '1 minute'" });
  await createRun('READY', { updatedAt: 'now()' });
  await client().query('SAVEPOINT before_run_sandboxes');
  await execute(migration);
});

test.after(async () => {
  await client().query('ROLLBACK TO SAVEPOINT before_run_sandboxes');
  const gone = await client().query(`SELECT to_regclass('public.product_run_sandboxes') AS relation,
    to_regprocedure('public.product_sandbox_assign(uuid,text[])') AS assign_function,
    to_regprocedure('product_private.product_sandbox_release(uuid,text)') AS release_function`);
  assert.deepEqual(gone.rows[0], { relation: null, assign_function: null, release_function: null });
  await client().query('RELEASE SAVEPOINT before_run_sandboxes');
  await database.teardownDatabase();
});

test('the migration backfills the run live on the first sandbox: the most recently updated unfinished run, and no other', async () => {
  const live = await rows();
  assert.deepEqual(live.map((row) => [String(row.run_id), row.sandbox_name, row.released_at]), [[backfilled, FIRST, null]]);
});

test('product_sandbox_assign follows the decision: KEPT for the owner, the next free sandbox for a new run, BUSY when the pool is full, a release when an owner ends', async () => {
  const kept = await assign(backfilled);
  assert.deepEqual([kept.state, kept.sandbox_name], ['KEPT', FIRST]);
  const second = await assign(olderRunning);
  assert.deepEqual([second.state, second.sandbox_name], ['ASSIGNED', SECOND]);
  const busy = await assign(stalePartial);
  assert.equal(busy.state, 'BUSY');
  assert.deepEqual(busy.sandboxes.map((entry) => [entry.sandbox_name, entry.run_id]), [[FIRST, backfilled], [SECOND, olderRunning]]);
  assert.equal((await rows()).some((row) => String(row.run_id) === stalePartial), false, 'BUSY writes nothing');
  // The first owner finishes: the waiting run takes its sandbox and the
  // release is recorded with the run's status.
  await setStatus(backfilled, 'READY');
  const taken = await assign(stalePartial);
  assert.deepEqual([taken.state, taken.sandbox_name, taken.releases], ['ASSIGNED', FIRST, [backfilled]]);
  const ended = (await rows()).find((row) => String(row.run_id) === backfilled);
  assert.equal(ended.release_reason, 'READY');
  // The finished run asks again: RUN_ENDED, no sandbox, nothing written.
  const finished = await assign(backfilled);
  assert.deepEqual([finished.state, finished.sandbox_name], ['RUN_ENDED', null]);
  // A FAILED owner releases too, and a retried run (RUNNING again) is placed afresh, its one row reused.
  await setStatus(olderRunning, 'FAILED');
  const after = await assign(stalePartial);
  assert.deepEqual([after.state, after.releases], ['KEPT', [olderRunning]]);
  await setStatus(olderRunning, 'RUNNING');
  const retried = await assign(olderRunning);
  assert.deepEqual([retried.state, retried.sandbox_name], ['ASSIGNED', SECOND]);
  const count = await client().query('SELECT count(*)::int AS n FROM public.product_run_sandboxes WHERE run_id = $1', [olderRunning]);
  assert.equal(count.rows[0].n, 1, 'one row per run, reused');
});

test('product_sandbox_release ends one run\'s ownership with a reason; the index allows one live run per sandbox; bad input is refused', async () => {
  const released = await client().query('SELECT public.product_sandbox_release($1, $2) AS data', [stalePartial, 'SANDBOX_GONE']);
  assert.deepEqual(released.rows[0].data, { run_id: stalePartial, released: true, sandbox_name: FIRST });
  const again = await client().query('SELECT public.product_sandbox_release($1, $2) AS data', [stalePartial, 'SANDBOX_GONE']);
  assert.deepEqual(again.rows[0].data, { run_id: stalePartial, released: false, sandbox_name: null });
  const row = (await rows()).find((candidate) => String(candidate.run_id) === stalePartial);
  assert.equal(row.release_reason, 'SANDBOX_GONE');
  // The freed sandbox goes to the next new run.
  const fresh = await createRun('QUEUED');
  assert.deepEqual([(await assign(fresh)).sandbox_name], [FIRST]);
  // Two live rows on one sandbox name are refused by the index itself.
  await client().query('SAVEPOINT duplicate_live_row');
  await assert.rejects(client().query(`INSERT INTO public.product_run_sandboxes (run_id, sandbox_name) VALUES ($1, $2)`, [stalePartial === fresh ? fresh : (await createRun('QUEUED')), FIRST]), /product_run_sandboxes_one_live_run_per_sandbox/);
  await client().query('ROLLBACK TO SAVEPOINT duplicate_live_row');
  // Input checks.
  await client().query('SAVEPOINT bad_input');
  await assert.rejects(client().query('SELECT public.product_sandbox_assign($1, $2::text[])', [fresh, ['worker-x']]), /invalid sandbox name worker-x/);
  await client().query('ROLLBACK TO SAVEPOINT bad_input');
  await client().query('SAVEPOINT bad_input');
  await assert.rejects(client().query('SELECT public.product_sandbox_assign($1, $2::text[])', [fresh, []]), /sandbox pool is empty/);
  await client().query('ROLLBACK TO SAVEPOINT bad_input');
  await client().query('SAVEPOINT bad_input');
  await assert.rejects(client().query('SELECT public.product_sandbox_assign($1, $2::text[])', [crypto.randomUUID(), POOL]), /analysis run not found/);
  await client().query('ROLLBACK TO SAVEPOINT bad_input');
  await client().query('SAVEPOINT bad_input');
  await assert.rejects(client().query('SELECT public.product_sandbox_release($1, $2)', [fresh, '']), /release reason is required/);
  await client().query('ROLLBACK TO SAVEPOINT bad_input');
  // A larger pool is only more names: a third sandbox is taken when the two are held.
  const third = await createRun('QUEUED');
  await assign(await createRun('QUEUED'));
  const wide = await assign(third, [...sandboxPoolNames(3)]);
  assert.deepEqual([wide.state, wide.sandbox_name], ['ASSIGNED', 'pm-codex-preview-worker-3']);
});

test('the service role may assign, release and read; anon and authenticated may not', async () => {
  const fresh = await createRun('QUEUED');
  const db = client();
  await db.query('SAVEPOINT grants');
  await db.query('SET LOCAL ROLE service_role');
  const assigned = await db.query('SELECT public.product_sandbox_assign($1, $2::text[]) AS data', [fresh, POOL]);
  assert.equal(assigned.rows[0].data.state, 'BUSY');
  // The table is readable by the service role (which bypasses row security
  // on Supabase; the plain test role sees no rows through RLS, so the grant
  // alone is asserted here).
  const read = await db.query('SELECT count(*)::int AS n FROM public.product_run_sandboxes');
  assert.equal(typeof read.rows[0].n, 'number');
  await db.query('ROLLBACK TO SAVEPOINT grants');
  for (const role of ['anon', 'authenticated']) {
    await db.query('SAVEPOINT grants');
    await db.query(`SET LOCAL ROLE ${role}`);
    await assert.rejects(db.query('SELECT public.product_sandbox_assign($1, $2::text[])', [fresh, POOL]), /permission denied/);
    await db.query('ROLLBACK TO SAVEPOINT grants');
    await db.query('SAVEPOINT grants');
    await db.query(`SET LOCAL ROLE ${role}`);
    await assert.rejects(db.query('SELECT * FROM public.product_run_sandboxes'), /permission denied/);
    await db.query('ROLLBACK TO SAVEPOINT grants');
  }
  await db.query('RELEASE SAVEPOINT grants');
});
