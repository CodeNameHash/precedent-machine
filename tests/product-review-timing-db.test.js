'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pgliteModule = process.env.TEST_PGLITE_MODULE;
const migration = fs.readFileSync(path.join(
  __dirname, '../supabase/migrations/20260905214000_product_cumulative_review_timing.sql',
), 'utf8');

const runId = '00000000-0000-4000-8000-000000000001';
const actor = 'lawyer@example.test';
let database;

test.after(async () => database?.close());

function actionId(idempotencyKey, targetRunId = runId) {
  return crypto.createHash('sha256').update(`${targetRunId}\u001f${actor}\u001f${idempotencyKey}`).digest('hex');
}

function draftState(overrides = {}) {
  return {
    schema_version: 'PRODUCT_REVIEW_STATE/V1',
    analysis_run_id: runId,
    draft_analysis_id: 'draft',
    status: 'DRAFT',
    started_at: '2026-01-02T09:00:00.000Z',
    updated_at: '2026-01-05T09:00:00.000Z',
    published_at: null,
    items: [],
    agreement_coverage: { decision: 'PENDING', reviewed_at: null },
    summary: null,
    metrics: null,
    release_evaluation_input: null,
    release_evaluation: null,
    ...overrides,
  };
}

test('restore preserves cumulative review time and the live draft anchor', { skip: !pgliteModule }, async () => {
  const { PGlite } = require(pgliteModule);
  const db = new PGlite();
  database = db;
  await db.exec(`
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.digest(data bytea, algorithm text) RETURNS bytea LANGUAGE sql IMMUTABLE
    AS $$ SELECT CASE WHEN lower(algorithm) = 'sha256' THEN pg_catalog.sha256(data)
      ELSE decode(md5(data) || md5(data), 'hex') END $$;
    CREATE SCHEMA product_private;
    DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE TABLE public.product_review_sessions (
      run_id uuid PRIMARY KEY, draft_analysis_id text NOT NULL, version integer NOT NULL,
      status text NOT NULL, state jsonb NOT NULL, started_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.product_run_access (run_id uuid NOT NULL, actor text NOT NULL, PRIMARY KEY (run_id, actor));
    CREATE TABLE public.product_review_revisions (
      run_id uuid NOT NULL, version integer NOT NULL, state jsonb NOT NULL,
      actor text NOT NULL, event_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (run_id, version)
    );
    CREATE TABLE public.product_review_actions (
      run_id uuid NOT NULL, action_id text NOT NULL, idempotency_key text NOT NULL,
      review_version integer NOT NULL, actor text NOT NULL, command jsonb NOT NULL,
      PRIMARY KEY (run_id, action_id), UNIQUE (run_id, idempotency_key)
    );
    CREATE TABLE public.product_review_publications (
      run_id uuid NOT NULL, publication_version integer NOT NULL, review_version integer NOT NULL,
      summary_id text, summary jsonb, metrics jsonb NOT NULL, published_at timestamptz,
      PRIMARY KEY (run_id, publication_version)
    );
    CREATE TABLE public.product_analysis_runs (run_id uuid PRIMARY KEY, source_document_id text NOT NULL);
    CREATE TABLE public.product_agreement_release_heads (source_document_id text PRIMARY KEY, release_id text NOT NULL);
    CREATE TABLE public.product_agreement_releases (
      release_id text PRIMARY KEY, source_document_id text NOT NULL, run_id uuid NOT NULL,
      publication_version integer NOT NULL, review_version integer NOT NULL,
      supersedes_release_id text, published_by text, published_at timestamptz
    );
    CREATE FUNCTION product_private.product_phase3_validate_review(uuid,jsonb,boolean) RETURNS void
    LANGUAGE sql AS 'SELECT';
  `);
  await db.exec(migration);
  const privileges = (await db.query(`SELECT
    has_function_privilege('anon', 'public.product_phase3_restore_review(uuid,integer,integer,text,text,text)', 'EXECUTE') AS anon_restore,
    has_function_privilege('authenticated', 'public.product_phase3_restore_review(uuid,integer,integer,text,text,text)', 'EXECUTE') AS authenticated_restore,
    has_function_privilege('anon', 'public.product_phase3_get_review(uuid,text)', 'EXECUTE') AS anon_read,
    has_function_privilege('authenticated', 'public.product_phase3_get_review(uuid,text)', 'EXECUTE') AS authenticated_read`)).rows[0];
  assert.deepEqual(privileges, {
    anon_restore: false,
    authenticated_restore: false,
    anon_read: false,
    authenticated_read: false,
  });

  const historical = draftState({
    started_at: '2025-12-31T09:00:00.000Z',
    updated_at: '2025-12-31T09:00:00.000Z',
  });
  const live = draftState({
    review_timing: {
      schema_version: 'PRODUCT_REVIEW_TIMING/V1',
      accumulated_draft_seconds: 600,
      active_draft_started_at: '2026-01-05T09:00:00.000Z',
    },
  });
  await db.query(`INSERT INTO public.product_review_sessions
    (run_id,draft_analysis_id,version,status,state,started_at,updated_at)
    VALUES ($1,'draft',4,'DRAFT',$2::jsonb,$3::timestamptz,$4::timestamptz)`,
  [runId, JSON.stringify(live), live.started_at, live.updated_at]);
  await db.query('INSERT INTO public.product_run_access(run_id,actor) VALUES ($1,$2)', [runId, actor]);
  await db.query('INSERT INTO public.product_analysis_runs(run_id,source_document_id) VALUES ($1,$2)', [runId, 'source-1']);
  await db.query(`INSERT INTO public.product_review_revisions(run_id,version,state,actor,event_type,created_at)
    VALUES ($1,0,$2::jsonb,$3,'INITIALISE',$4::timestamptz)`,
  [runId, JSON.stringify(historical), actor, historical.updated_at]);

  const key = 'restore-live-clock';
  const restored = (await db.query(`SELECT public.product_phase3_restore_review(
    $1::uuid,4,0,$2,$3,$4) AS value`, [runId, actor, actionId(key), key])).rows[0].value;

  assert.equal(restored.state.started_at, live.started_at);
  assert.equal(restored.state.review_timing.schema_version, 'PRODUCT_REVIEW_TIMING/V1');
  assert.equal(restored.state.review_timing.accumulated_draft_seconds, 600);
  assert.equal(
    Date.parse(restored.state.review_timing.active_draft_started_at),
    Date.parse(live.review_timing.active_draft_started_at),
  );
  assert.equal(restored.state.status, 'DRAFT');
  const evaluatedState = {
    ...restored.state,
    status: 'PUBLISHED',
    release_evaluation: { diagnostics: { processing_minutes: 50, effective_elapsed_minutes: 85 } },
  };
  await db.query(`INSERT INTO public.product_review_revisions(run_id,version,state,actor,event_type,created_at)
    VALUES ($1,6,$2::jsonb,$3,'EVALUATE_RELEASE','2026-01-05T09:06:00Z'::timestamptz)`,
  [runId, JSON.stringify(evaluatedState), actor]);
  const read = (await db.query('SELECT public.product_phase3_get_review($1::uuid,$2) AS value', [runId, actor])).rows[0].value;
  assert.deepEqual(read.revisions.find((revision) => revision.version === 6).release_evaluation_diagnostics, {
    processing_minutes: 50,
    effective_elapsed_minutes: 85,
  });

  const legacyRunId = '00000000-0000-4000-8000-000000000002';
  const legacyHistorical = { ...historical, analysis_run_id: legacyRunId };
  const legacyLive = {
    ...live,
    analysis_run_id: legacyRunId,
    review_timing: undefined,
  };
  delete legacyLive.review_timing;
  await db.query(`INSERT INTO public.product_review_sessions
    (run_id,draft_analysis_id,version,status,state,started_at,updated_at)
    VALUES ($1,'draft',4,'DRAFT',$2::jsonb,$3::timestamptz,$4::timestamptz)`,
  [legacyRunId, JSON.stringify(legacyLive), legacyLive.started_at, legacyLive.updated_at]);
  await db.query('INSERT INTO public.product_run_access(run_id,actor) VALUES ($1,$2)', [legacyRunId, actor]);
  await db.query(`INSERT INTO public.product_review_revisions(run_id,version,state,actor,event_type,created_at) VALUES
    ($1,0,$2::jsonb,$4,'INITIALISE',$5::timestamptz),
    ($1,2,$3::jsonb,$4,'PUBLISH','2026-01-02T09:10:00Z'::timestamptz),
    ($1,3,$2::jsonb,$4,'REOPEN','2026-01-05T09:00:00Z'::timestamptz)`,
  [legacyRunId, JSON.stringify(legacyHistorical), JSON.stringify({ ...legacyHistorical, status: 'PUBLISHED' }), actor, legacyHistorical.updated_at]);
  await db.query(`INSERT INTO public.product_review_publications
    (run_id,publication_version,review_version,metrics) VALUES ($1,1,2,'{"review_time_seconds":600}'::jsonb)`,
  [legacyRunId]);
  const legacyKey = 'restore-legacy-clock';
  const legacyRestored = (await db.query(`SELECT public.product_phase3_restore_review(
    $1::uuid,4,0,$2,$3,$4) AS value`,
  [legacyRunId, actor, actionId(legacyKey, legacyRunId), legacyKey])).rows[0].value;
  assert.equal(legacyRestored.state.review_timing.accumulated_draft_seconds, 600);
  assert.equal(
    Date.parse(legacyRestored.state.review_timing.active_draft_started_at),
    Date.parse('2026-01-05T09:00:00Z'),
  );

  const unavailableRunId = '00000000-0000-4000-8000-000000000003';
  const unavailable = { ...legacyLive, analysis_run_id: unavailableRunId };
  await db.query(`INSERT INTO public.product_review_sessions
    (run_id,draft_analysis_id,version,status,state,started_at,updated_at)
    VALUES ($1,'draft',4,'DRAFT',$2::jsonb,$3::timestamptz,$4::timestamptz)`,
  [unavailableRunId, JSON.stringify(unavailable), unavailable.started_at, unavailable.updated_at]);
  await db.query('INSERT INTO public.product_run_access(run_id,actor) VALUES ($1,$2)', [unavailableRunId, actor]);
  await db.query(`INSERT INTO public.product_review_revisions(run_id,version,state,actor,event_type,created_at)
    VALUES ($1,0,$2::jsonb,$3,'INITIALISE',$4::timestamptz)`,
  [unavailableRunId, JSON.stringify({ ...historical, analysis_run_id: unavailableRunId }), actor, historical.updated_at]);
  await db.query(`INSERT INTO public.product_review_publications
    (run_id,publication_version,review_version,metrics) VALUES ($1,1,2,'{}'::jsonb)`,
  [unavailableRunId]);
  const unavailableKey = 'restore-unavailable-clock';
  await assert.rejects(() => db.query(`SELECT public.product_phase3_restore_review(
    $1::uuid,4,0,$2,$3,$4)`,
  [unavailableRunId, actor, actionId(unavailableKey, unavailableRunId), unavailableKey]), /review timing is unavailable/);

  const malformedRunId = '00000000-0000-4000-8000-000000000004';
  const malformed = {
    ...live,
    analysis_run_id: malformedRunId,
    review_timing: {
      schema_version: 'PRODUCT_REVIEW_TIMING/V999',
      accumulated_draft_seconds: 600,
      active_draft_started_at: '2026-01-05T09:00:00.000Z',
    },
  };
  await db.query(`INSERT INTO public.product_review_sessions
    (run_id,draft_analysis_id,version,status,state,started_at,updated_at)
    VALUES ($1,'draft',4,'DRAFT',$2::jsonb,$3::timestamptz,$4::timestamptz)`,
  [malformedRunId, JSON.stringify(malformed), malformed.started_at, malformed.updated_at]);
  await db.query('INSERT INTO public.product_run_access(run_id,actor) VALUES ($1,$2)', [malformedRunId, actor]);
  await db.query(`INSERT INTO public.product_review_revisions(run_id,version,state,actor,event_type,created_at)
    VALUES ($1,0,$2::jsonb,$3,'INITIALISE',$4::timestamptz)`,
  [malformedRunId, JSON.stringify({ ...historical, analysis_run_id: malformedRunId }), actor, historical.updated_at]);
  const malformedKey = 'restore-malformed-clock';
  await assert.rejects(() => db.query(`SELECT public.product_phase3_restore_review(
    $1::uuid,4,0,$2,$3,$4)`,
  [malformedRunId, actor, actionId(malformedKey, malformedRunId), malformedKey]), /review timing is unavailable/);
});
