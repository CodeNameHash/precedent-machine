'use strict';

// Work package 38 (plan finding (251)): the preview read model's table,
// migration 20261025000000_product_preview_read_model.sql, on inactive
// Postgres. The store methods that use it (lib/product/phase-2-store.js
// getPreviewReadModel, savePreviewReadModel, markPreviewReadModelStale,
// getReviewVersion) are covered with fakes in
// tests/product-preview-read-model.test.js; this file proves the table the
// migration creates: its keys and checks, the cascade from a run, and that
// only the service role may touch it — the row is exactly the payload the
// preview route returns after its own access check, so a browser session
// must never read it.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

process.env.PRODUCT_PHASE2_DB_HELPER_ONLY = '1';
const database = require('./product-phase-2-db.test');
delete process.env.PRODUCT_PHASE2_DB_HELPER_ONLY;

const client = () => database.getDatabaseClient();

async function createRun() {
  const runId = crypto.randomUUID();
  const sourceId = `source-${runId}`;
  await client().query(`INSERT INTO public.product_source_documents (source_document_id, retrieval_url, raw_sha256, payload, payload_sha256)
    VALUES ($1, $2, 'sha', '{}'::jsonb, 'sha')`, [sourceId, `https://www.sec.gov/Archives/${runId}.htm`]);
  await client().query(`INSERT INTO public.product_analysis_runs (run_id, source_document_id, retrieval_url, idempotency_key, submission_fingerprint,
    schema_version, prompt_bundle_version, model_config, explicit_generation, source_generation, max_attempts, status, stage, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'LEGAL_SCHEMA/V2', 'PRODUCT_LAYERED_COMPONENTS/V9', '{"provider_id":"ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION"}'::jsonb, 0, 1, 3, 'READY', 'READY', now())`,
  [runId, sourceId, `https://www.sec.gov/Archives/${runId}.htm`, `key-${runId}`, `fp-${runId}`]);
  return runId;
}

const PAYLOAD = { schema_version: 'PRODUCT_PREVIEW_WORKSPACE/V1', analysis: {}, review: {}, progress: {} };

// The store's own write (phase-2-store.js savePreviewReadModel), as SQL.
async function save(runId, { payload = PAYLOAD, reviewVersion = 0 } = {}) {
  await client().query(`INSERT INTO public.product_preview_reads (run_id, payload, built_at, stale, review_version)
    VALUES ($1, $2::jsonb, now(), false, $3)
    ON CONFLICT (run_id) DO UPDATE SET payload = EXCLUDED.payload, built_at = EXCLUDED.built_at, stale = false, review_version = EXCLUDED.review_version`,
  [runId, JSON.stringify(payload), reviewVersion]);
}

async function row(runId) {
  const result = await client().query('SELECT run_id, payload, stale, review_version FROM public.product_preview_reads WHERE run_id = $1', [runId]);
  return result.rows[0] || null;
}

test('the preview read model stores one projection per run, marks it stale, rebuilds it, and leaves with the run', async () => {
  const runId = await createRun();
  assert.equal(await row(runId), null, 'a run has no stored projection until its first preview read');
  await save(runId, { reviewVersion: 2 });
  const stored = await row(runId);
  assert.deepEqual(stored.payload, PAYLOAD);
  assert.equal(stored.stale, false);
  assert.equal(stored.review_version, 2);
  // The stale mark the review save and the finalisation write.
  await client().query('UPDATE public.product_preview_reads SET stale = true WHERE run_id = $1', [runId]);
  assert.equal((await row(runId)).stale, true);
  assert.deepEqual((await row(runId)).payload, PAYLOAD, 'marking stale keeps the payload');
  // A rebuild clears it and replaces the payload and the review version.
  const next = { ...PAYLOAD, review: { version: 3 } };
  await save(runId, { payload: next, reviewVersion: 3 });
  const rebuilt = await row(runId);
  assert.deepEqual(rebuilt.payload, next);
  assert.equal(rebuilt.stale, false);
  assert.equal(rebuilt.review_version, 3);
  // The table refuses a payload that is not an object and a negative
  // review version: both are what the store could get wrong.
  await assert.rejects(() => client().query('UPDATE public.product_preview_reads SET payload = \'[]\'::jsonb WHERE run_id = $1', [runId]), /check constraint/i);
  await assert.rejects(() => client().query('UPDATE public.product_preview_reads SET review_version = -1 WHERE run_id = $1', [runId]), /check constraint/i);
  // The row belongs to the run: deleting the run takes it.
  await client().query('DELETE FROM public.product_analysis_runs WHERE run_id = $1', [runId]);
  assert.equal(await row(runId), null);
});

test('only the service role may read or write the stored projection', async () => {
  const privileges = await client().query(`
    SELECT r.rolname,
      has_table_privilege(r.rolname, 'public.product_preview_reads', 'SELECT') AS can_select,
      has_table_privilege(r.rolname, 'public.product_preview_reads', 'INSERT') AS can_insert,
      has_table_privilege(r.rolname, 'public.product_preview_reads', 'UPDATE') AS can_update
    FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated', 'service_role') ORDER BY r.rolname`);
  for (const grant of privileges.rows) {
    if (grant.rolname === 'service_role') {
      assert.equal(grant.can_select, true, 'the service role reads it');
      assert.equal(grant.can_insert, true);
      assert.equal(grant.can_update, true);
    } else {
      assert.equal(grant.can_select, false, `${grant.rolname} must not read the projection`);
      assert.equal(grant.can_insert, false, `${grant.rolname} must not write it`);
      assert.equal(grant.can_update, false, `${grant.rolname} must not mark it`);
    }
  }
  const rls = await client().query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public.product_preview_reads'::regclass`);
  assert.equal(rls.rows[0].relrowsecurity, true, 'row level security is on');
  const policies = await client().query(`SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_preview_reads'`);
  assert.equal(policies.rows[0].n, 0, 'no policy grants a session access');
});
