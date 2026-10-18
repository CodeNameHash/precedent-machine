'use strict';

// The one database harness for the product's database tests (work package
// D2, plan finding (141)): an inactive Postgres (TEST_DATABASE_URL) or
// PGlite (TEST_PGLITE_MODULE), one transaction rolled back at the end, and
// EVERY migration in supabase/migrations applied in file order, the way
// tests/product-phase-6-db.test.js first did. Finding (104) found the
// Phase 1 to 3 tests applying 16 of the 42 migrations while the runner
// records part identities only migration 20260914125500 onward admits.
//
// A test that proves one migration's own effect names it in `hooks`:
//   setupDatabase({ hooks: { '<file>.sql': { before: async (client) => {}, after: async (client) => {} } } })
// `before` runs with the estate as it stands just before that file (take a
// measurement, place a savepoint), `after` just after it. A ROLLBACK TO a
// savepoint placed in `before` undoes that migration and every later one,
// so a test's absence assertions hold on the full list as they did on a
// prefix of it.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase/migrations');
const MIGRATION_FILES = Object.freeze(fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort());

const databaseUrl = process.env.TEST_DATABASE_URL;
const pgliteModule = process.env.TEST_PGLITE_MODULE;
let client = null;

function migrationSql(file) {
  const name = path.basename(file);
  if (!MIGRATION_FILES.includes(name)) throw new Error(`unknown migration ${file}`);
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
  return pgliteModule ? sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;', '') : sql;
}

async function executeScript(sql) {
  if (!client) throw new Error('setupDatabase first');
  if (pgliteModule) await client.exec(sql);
  else await client.query(sql);
}

// Applies one migration again (a test's re-application proof).
async function applyMigration(file) {
  await executeScript(migrationSql(file));
}

async function setupDatabase({ hooks = {} } = {}) {
  if (!databaseUrl && !pgliteModule) throw new Error('TEST_DATABASE_URL or TEST_PGLITE_MODULE is required for the product database tests');
  for (const file of Object.keys(hooks)) {
    if (!MIGRATION_FILES.includes(path.basename(file))) throw new Error(`hook names an unknown migration ${file}`);
  }
  if (databaseUrl) {
    const { Client } = require('pg');
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
  } else {
    const { PGlite } = require(pgliteModule);
    client = new PGlite();
    await client.waitReady;
  }
  await client.query('BEGIN');
  await executeScript(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END $$;`);
  if (pgliteModule) {
    await executeScript(`CREATE SCHEMA IF NOT EXISTS extensions;
      CREATE FUNCTION extensions.digest(data bytea, algorithm text) RETURNS bytea LANGUAGE sql IMMUTABLE
      AS $$ SELECT CASE WHEN lower(algorithm) = 'sha256' THEN pg_catalog.sha256(data)
        ELSE decode(md5(data) || md5(data), 'hex') END $$;
      CREATE FUNCTION extensions.gen_random_uuid() RETURNS uuid LANGUAGE sql VOLATILE
      AS $$ SELECT pg_catalog.gen_random_uuid() $$;`);
  }
  const hookFor = (file) => hooks[file] || hooks[path.join('supabase/migrations', file)] || null;
  for (const file of MIGRATION_FILES) {
    const hook = hookFor(file);
    if (hook && typeof hook.before === 'function') await hook.before(client, file);
    await executeScript(migrationSql(file));
    if (hook && typeof hook.after === 'function') await hook.after(client, file);
  }
  return client;
}

async function teardownDatabase() {
  if (!client) return;
  await client.query('ROLLBACK');
  const absent = await client.query(`SELECT to_regclass('public.product_source_documents') AS first_table,
    to_regclass('public.product_draft_analyses') AS phase2_table, to_regclass('public.product_agreement_releases') AS phase3_table`);
  assert.deepEqual(absent.rows[0], { first_table: null, phase2_table: null, phase3_table: null });
  if (typeof client.end === 'function') await client.end();
  else await client.close();
  client = null;
}

function getDatabaseClient() {
  return client;
}

// Every RPC the product stores call, with its named parameters in order.
const rpcArguments = {
  product_phase1_persist_source: ['p_source'],
  product_phase1_create_run: ['p_source_document_id', 'p_retrieval_url', 'p_idempotency_key', 'p_schema_version', 'p_prompt_bundle_version', 'p_model_config', 'p_explicit_generation', 'p_max_attempts'],
  product_phase1_attach_structure: ['p_run_id', 'p_structure_id', 'p_structure', 'p_identity_review'],
  product_phase1_fail_run: ['p_run_id', 'p_stage', 'p_error'],
  product_phase1_resolve_identity: ['p_run_id', 'p_resolution'],
  product_phase1_claim_section: ['p_run_id', 'p_worker_id', 'p_lease_seconds'],
  product_phase1_recover_expired_sections: ['p_run_id'],
  product_phase1_renew_section_lease: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_lease_seconds'],
  product_phase1_complete_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_cost_microusd', 'p_input_tokens', 'p_output_tokens'],
  product_phase1_fail_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_error'],
  product_phase2_commit_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_result'],
  product_phase2_record_model_call: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_call'],
  product_phase2_fail_section: ['p_run_id', 'p_node_id', 'p_worker_id', 'p_attempt_token', 'p_error', 'p_model_calls'],
  product_phase2_finalize_draft: ['p_run_id', 'p_draft'],
  product_phase2_finalize_saved_run: ['p_run_id', 'p_finalization'],
  product_phase2_get_analysis: ['p_run_id'],
  product_phase3_register_run_access: ['p_run_id', 'p_actor'],
  product_phase3_retry_run: ['p_run_id', 'p_actor', 'p_idempotency_key'],
  product_phase3_initialise_review: ['p_run_id', 'p_state', 'p_actor'],
  product_phase3_save_review: ['p_run_id', 'p_expected_version', 'p_state', 'p_actor', 'p_event_type', 'p_action_id', 'p_idempotency_key', 'p_command'],
  product_phase3_restore_review: ['p_run_id', 'p_expected_version', 'p_restore_version', 'p_actor', 'p_action_id', 'p_idempotency_key'],
  product_phase3_get_review: ['p_run_id', 'p_actor'],
  product_phase3_list_reference_sources: ['p_actor'],
  product_sandbox_assign: ['p_run_id', 'p_pool'],
  product_sandbox_release: ['p_run_id', 'p_reason'],
};

// node-postgres sends a JavaScript array as a Postgres array literal, which
// a jsonb parameter refuses ("invalid input syntax for type json": a section
// failure's model calls, an array of objects). supabase-js sends JSON. So an
// object, and an array with anything but strings in it, go as JSON text and
// Postgres reads them as the parameter's type; an array of strings stays an
// array (text[] parameters such as the sandbox pool).
function jsonParameter(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.length > 0 && value.every((item) => typeof item === 'string') ? value : JSON.stringify(value);
  if (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) return JSON.stringify(value);
  return value;
}

// A Supabase-shaped client over the test connection: rpc(name, params) and
// from(table).select().eq().is().order().range().maybeSingle(); every
// failure comes back as { data: null, error } as supabase-js answers.
function databaseFacade(connection = null) {
  const db = () => connection || client;
  return {
    async rpc(name, parameters) {
      try {
        const names = rpcArguments[name];
        if (!names) throw new Error(`unsupported RPC ${name}`);
        const values = names.map((key) => jsonParameter(parameters[key]));
        const markers = values.map((_, index) => `$${index + 1}`).join(',');
        const result = await db().query(`SELECT public.${name}(${markers}) AS data`, values);
        return { data: result.rows[0].data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    from(table) {
      if (!/^product_[a-z_]+$/.test(table)) throw new Error('invalid table');
      let columns = '*';
      const filters = [];
      const orders = [];
      let range = null;
      const column = (name) => { if (!/^[a-z_]+$/.test(name)) throw new Error('invalid column'); return name; };
      const execute = async (single = false) => {
        try {
          const values = [];
          const where = filters.length ? ` WHERE ${filters.map((item) => {
            if (item.isNull) return `${item.column} IS NULL`;
            values.push(item.value);
            return `${item.column} = $${values.length}`;
          }).join(' AND ')}` : '';
          const order = orders.length ? ` ORDER BY ${orders.map((item) => `${item.column} ${item.ascending ? 'ASC' : 'DESC'}`).join(', ')}` : '';
          const bounded = range ? ` LIMIT ${range.to - range.from + 1} OFFSET ${range.from}` : '';
          const result = await db().query(`SELECT ${columns} FROM public.${table}${where}${order}${bounded}`, values);
          return { data: single ? (result.rows[0] || null) : result.rows, error: null };
        } catch (error) {
          return { data: null, error };
        }
      };
      const builder = {
        select(value) { columns = value; return builder; },
        eq(name, value) { filters.push({ column: column(name), value }); return builder; },
        is(name, value) {
          if (value !== null) throw new Error('the facade supports is(column, null) only');
          filters.push({ column: column(name), isNull: true }); return builder;
        },
        order(name, options = {}) { orders.push({ column: column(name), ascending: options.ascending !== false }); return builder; },
        range(from, to) { range = { from, to }; return builder; },
        maybeSingle() { return execute(true); },
        then(resolve, reject) { return execute(false).then(resolve, reject); },
      };
      return builder;
    },
  };
}

module.exports = {
  MIGRATION_FILES,
  ROOT,
  applyMigration,
  databaseFacade,
  executeScript,
  getDatabaseClient,
  migrationSql,
  setupDatabase,
  teardownDatabase,
};
