'use strict';

// The move of the product to another database, prepared for Ben's
// decision (plan finding (166), verbatim: "I'm not sure what you mean but
// I don't care boaut the old site, you can move over whener you like"):
// (a) the product migrations, every file under supabase/migrations in
// order, applied to the target and recorded in Supabase's own ledger
// (supabase_migrations.schema_migrations, the table the CLI keeps);
// (b) the rows of one run carried from the source database to the
// target, table by table in dependency order, each row inserted once
// (ON CONFLICT DO NOTHING on the table's own keys) so a second run inserts
// nothing, with a row already there compared to the source's; (c) the
// proof that the target reads as the source does: the product's own
// analysis read, review read and published read, through the stores over
// each connection, compared whole. A dry run reads and reports; only
// --apply writes, inside one transaction on the target. The old site's
// tables (claims, provisions, deals, ...) are never touched: the move
// knows only the product_ tables the migrations create.
//
// Nothing here decides a review item: the release carried is the one Ben's
// decisions produced on the source.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { ProductPhase3Store } = require('./phase-3-store');
const { createPgStoreFacade } = require('./pg-store-facade');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');

// The tables of one run, in the order their foreign keys need. `where`
// selects the run's rows by the run id ($1) or by its source document
// ($2); the structures table through the run's structure mapping.
const MOVE_TABLES = Object.freeze([
  { table: 'product_source_documents', where: 'source_document_id = $2::text' },
  { table: 'product_agreement_structures', where: 'structure_id IN (SELECT structure_id FROM public.product_run_structures WHERE run_id = $1::uuid)' },
  { table: 'product_analysis_runs', where: 'run_id = $1::uuid' },
  { table: 'product_submission_requests', where: 'run_id = $1::uuid' },
  { table: 'product_run_structures', where: 'run_id = $1::uuid' },
  { table: 'product_document_identity_reviews', where: 'run_id = $1::uuid' },
  { table: 'product_section_work', where: 'run_id = $1::uuid' },
  { table: 'product_model_calls', where: 'run_id = $1::uuid', order: 'created_at, model_call_id' },
  { table: 'product_source_closures', where: 'run_id = $1::uuid' },
  { table: 'product_source_spans', where: 'run_id = $1::uuid' },
  { table: 'product_source_closure_spans', where: 'run_id = $1::uuid' },
  { table: 'product_section_routings', where: 'run_id = $1::uuid' },
  { table: 'product_section_results', where: 'run_id = $1::uuid' },
  { table: 'product_residual_passes', where: 'run_id = $1::uuid' },
  { table: 'product_proposition_groups', where: 'run_id = $1::uuid' },
  { table: 'product_proposals', where: 'run_id = $1::uuid' },
  { table: 'product_proposal_spans', where: 'run_id = $1::uuid' },
  { table: 'product_fact_components', where: 'run_id = $1::uuid' },
  { table: 'product_fact_headlines', where: 'run_id = $1::uuid' },
  { table: 'product_fact_conclusions', where: 'run_id = $1::uuid' },
  { table: 'product_fact_links', where: 'run_id = $1::uuid' },
  { table: 'product_fact_link_spans', where: 'run_id = $1::uuid' },
  { table: 'product_issues', where: 'run_id = $1::uuid' },
  { table: 'product_coverage_assertions', where: 'run_id = $1::uuid' },
  { table: 'product_drafts', where: 'run_id = $1::uuid' },
  { table: 'product_draft_revisions', where: 'draft_id IN (SELECT draft_id FROM public.product_drafts WHERE run_id = $1::uuid)' },
  { table: 'product_draft_audit_events', where: 'draft_id IN (SELECT draft_id FROM public.product_drafts WHERE run_id = $1::uuid)' },
  { table: 'product_draft_analyses', where: 'run_id = $1::uuid' },
  { table: 'product_run_access', where: 'run_id = $1::uuid' },
  { table: 'product_run_retry_events', where: 'run_id = $1::uuid' },
  { table: 'product_review_sessions', where: 'run_id = $1::uuid' },
  { table: 'product_review_revisions', where: 'run_id = $1::uuid', order: 'version' },
  { table: 'product_review_actions', where: 'run_id = $1::uuid' },
  { table: 'product_review_publications', where: 'run_id = $1::uuid', order: 'publication_version' },
  { table: 'product_agreement_releases', where: 'run_id = $1::uuid', order: 'publication_version' },
  // The source's current-release pointer travels only when it selects a
  // release of this run; a pointer at another run's release is reported.
  { table: 'product_agreement_release_heads', where: 'source_document_id = $2::text AND release_id IN (SELECT release_id FROM public.product_agreement_releases WHERE run_id = $1::uuid)' },
]);

// Every query names both parameters with their types, because Postgres
// refuses a parameter a where clause does not mention.
const BOTH_PARAMETERS_TYPED = '$1::uuid IS NOT NULL AND $2::text IS NOT NULL';

// Environment-bound rows that never move: which hosted sandbox a run holds.
const SKIPPED_TABLES = Object.freeze(['product_run_sandboxes']);

function migrationFiles(dir = MIGRATIONS_DIR) {
  return fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort().map((file) => {
    const match = file.match(/^(\d{14})_(.+)\.sql$/);
    if (!match) throw new Error(`migration file name not understood: ${file}`);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    return { file, version: match[1], name: match[2], sql, sha256: crypto.createHash('sha256').update(sql).digest('hex') };
  });
}

async function tableExists(client, schema, table) {
  const result = await client.query('SELECT to_regclass($1) AS relation', [`${schema}.${table}`]);
  return result.rows[0].relation !== null;
}

// Supabase's ledger: a file is applied when a row carries its name (the
// branch runner records its own versions, so the name is the stable key)
// or its version.
async function readLedger(client) {
  if (!(await tableExists(client, 'supabase_migrations', 'schema_migrations'))) return { exists: false, rows: [] };
  const result = await client.query('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version');
  return { exists: true, rows: result.rows };
}

function migrationStatus(files, ledger) {
  const names = new Set(ledger.rows.map((row) => row.name).filter(Boolean));
  const versions = new Set(ledger.rows.map((row) => row.version));
  return files.map((migration) => ({
    file: migration.file, version: migration.version, name: migration.name, sha256: migration.sha256,
    applied: names.has(migration.name) || versions.has(migration.version),
  }));
}

async function ensureRoles(client) {
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END $$;`);
}

// Applies the migrations the ledger does not carry, in order, inside the
// caller's transaction, and records each in the ledger as the CLI would.
async function applyMigrations(client, { files = migrationFiles(), createRoles = false } = {}) {
  if (createRoles) await ensureRoles(client);
  await client.query('CREATE SCHEMA IF NOT EXISTS supabase_migrations');
  await client.query('CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text)');
  const status = migrationStatus(files, await readLedger(client));
  const applied = [];
  for (const migration of status) {
    if (migration.applied) continue;
    const source = files.find((candidate) => candidate.file === migration.file);
    await client.query(source.sql);
    await client.query('INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING', [source.version, [source.sql], source.name]);
    applied.push(migration.file);
  }
  return { applied, status };
}

async function runOf(client, runId) {
  const result = await client.query('SELECT run_id, source_document_id, source_generation, status, schema_version FROM public.product_analysis_runs WHERE run_id = $1::uuid', [runId]);
  return result.rows[0] || null;
}

async function primaryKey(client, table) {
  const result = await client.query(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = ('public.' || $1)::regclass AND i.indisprimary ORDER BY array_position(i.indkey, a.attnum)`, [table]);
  return result.rows.map((row) => row.attname);
}

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function rowKey(row, pk) { return pk.map((column) => String(row[column])).join('\u001f'); }

// A timestamp travels as the database's own text (microseconds and zone
// kept): the driver's Date would round it to milliseconds and the review
// read, which carries revision times, would then differ between the two.
async function columnList(client, table) {
  const result = await client.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position', ['public', table]);
  if (result.rows.length === 0) throw new Error(`table public.${table} has no columns on this connection`);
  return result.rows.map((row) => (/^timestamp/.test(row.data_type) ? `${row.column_name}::text AS ${row.column_name}` : row.column_name)).join(', ');
}

async function selectRows(client, spec, runId, sourceDocumentId) {
  const order = spec.order ? ` ORDER BY ${spec.order}` : '';
  const columns = await columnList(client, spec.table);
  const result = await client.query(`SELECT ${columns} FROM public.${spec.table} WHERE (${spec.where}) AND ${BOTH_PARAMETERS_TYPED}${order}`, [runId, sourceDocumentId]);
  return result.rows;
}

async function selectRowsByKey(client, table, pk, rows) {
  if (rows.length === 0) return [];
  const columns = await columnList(client, table);
  const join = pk.map((column) => `t.${column} = k.${column}`).join(' AND ');
  const keys = rows.map((row) => Object.fromEntries(pk.map((column) => [column, row[column]])));
  const result = await client.query(`SELECT ${columns.replace(/(^|, )([a-z_]+)(::text AS [a-z_]+)?/g, (match, lead, name, cast) => `${lead}t.${name}${cast || ''}`)} FROM public.${table} t JOIN jsonb_populate_recordset(NULL::public.${table}, $1::jsonb) k ON ${join}`, [JSON.stringify(keys)]);
  return result.rows;
}

async function countRows(client, spec, runId, sourceDocumentId) {
  if (!(await tableExists(client, 'public', spec.table))) return null;
  const result = await client.query(`SELECT count(*)::int AS n FROM public.${spec.table} WHERE (${spec.where}) AND ${BOTH_PARAMETERS_TYPED}`, [runId, sourceDocumentId]);
  return result.rows[0].n;
}

// Inserts the source rows the target lacks; a row the target has is
// compared to the source's, column by column.
async function copyTable(source, target, spec, runId, sourceDocumentId) {
  const rows = await selectRows(source, spec, runId, sourceDocumentId);
  const pk = await primaryKey(target, spec.table);
  let inserted = 0;
  if (rows.length) {
    const result = await target.query(
      `INSERT INTO public.${spec.table} SELECT * FROM jsonb_populate_recordset(NULL::public.${spec.table}, $1::jsonb) ON CONFLICT DO NOTHING RETURNING 1`,
      [JSON.stringify(rows.map(canonical))],
    );
    inserted = result.rowCount;
  }
  // The target's copies, by the source rows' own keys (a table selected
  // through another table's rows, the structures through the run's
  // mapping, is read before that other table is copied).
  const after = await selectRowsByKey(target, spec.table, pk, rows);
  const byKey = new Map(after.map((row) => [rowKey(row, pk), row]));
  let missing = 0;
  let differing = 0;
  const differences = [];
  for (const row of rows) {
    const stored = byKey.get(rowKey(row, pk));
    if (stored === undefined) { missing += 1; continue; }
    const columns = Object.keys(row).filter((column) => JSON.stringify(canonical(row[column])) !== JSON.stringify(canonical(stored[column])));
    if (columns.length === 0) continue;
    differing += 1;
    if (differences.length < 3) differences.push({ key: rowKey(row, pk).slice(0, 48), columns });
  }
  return { table: spec.table, source_rows: rows.length, inserted, already_there: rows.length - inserted - missing, missing, differing, differences, target_rows: after.length };
}

// The product's own reads on one connection: the analysis read, the review
// read for every actor with access, the published read for the source.
async function productReads(client, runId, sourceDocumentId) {
  const store = new ProductPhase3Store({ client: createPgStoreFacade(client) });
  const analysis = await store.getAgreementAnalysis(runId);
  const actors = (await client.query('SELECT actor FROM public.product_run_access WHERE run_id = $1 ORDER BY actor', [runId])).rows.map((row) => row.actor);
  const reviews = {};
  for (const actor of actors) reviews[actor] = await store.getReview({ runId, actor });
  const published = (await store.listPublishedLayeredFacts()).find((entry) => entry.source_document_id === sourceDocumentId) || null;
  return { analysis: canonical(analysis), reviews: canonical(reviews), published: canonical(published) };
}

function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

// moveRunToTarget({ source, target, runId, apply, createRoles }) -> report.
// `source` and `target` are connected node-postgres clients. With apply
// false nothing is written to the target.
async function moveRunToTarget({ source, target, runId, apply = false, createRoles = false, files = migrationFiles() } = {}) {
  if (!source || !target) throw new TypeError('source and target clients are required');
  if (typeof runId !== 'string') throw new TypeError('runId is required');
  const run = await runOf(source, runId);
  if (!run) throw new Error(`run ${runId} is not on the source`);
  const sourceDocumentId = run.source_document_id;
  const ledger = await readLedger(target);
  const status = migrationStatus(files, ledger);
  const report = {
    run: { run_id: run.run_id, source_document_id: sourceDocumentId, generation: run.source_generation, status: run.status, schema_version: run.schema_version },
    apply,
    migrations: { total: files.length, applied_before: status.filter((item) => item.applied).length, to_apply: status.filter((item) => !item.applied).map((item) => item.file), applied_now: [], ledger_exists: ledger.exists },
    tables: [],
    skipped_tables: SKIPPED_TABLES,
    head_elsewhere: null,
    proof: null,
  };
  const headResult = await source.query('SELECT h.release_id, r.run_id FROM public.product_agreement_release_heads h JOIN public.product_agreement_releases r ON r.release_id = h.release_id WHERE h.source_document_id = $1', [sourceDocumentId]);
  if (headResult.rows[0] && headResult.rows[0].run_id !== runId) report.head_elsewhere = { release_id: headResult.rows[0].release_id, run_id: headResult.rows[0].run_id };

  if (!apply) {
    for (const spec of MOVE_TABLES) {
      report.tables.push({ table: spec.table, source_rows: await countRows(source, spec, runId, sourceDocumentId), target_rows: await countRows(target, spec, runId, sourceDocumentId) });
    }
    return report;
  }

  await target.query('BEGIN');
  try {
    const migrated = await applyMigrations(target, { files, createRoles });
    report.migrations.applied_now = migrated.applied;
    for (const spec of MOVE_TABLES) report.tables.push(await copyTable(source, target, spec, runId, sourceDocumentId));
    await target.query('COMMIT');
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  }
  const left = await productReads(source, runId, sourceDocumentId);
  const right = await productReads(target, runId, sourceDocumentId);
  report.proof = {
    analysis_read_equal: same(left.analysis, right.analysis),
    review_reads_equal: same(left.reviews, right.reviews),
    published_read_equal: same(left.published, right.published),
    published_on_source: left.published ? { run_id: left.published.run_id, facts: left.published.facts.length, released_at: left.published.released_at } : null,
    published_on_target: right.published ? { run_id: right.published.run_id, facts: right.published.facts.length, released_at: right.published.released_at } : null,
    review_actors: Object.keys(left.reviews),
  };
  report.inserted_total = report.tables.reduce((sum, entry) => sum + entry.inserted, 0);
  report.differing_total = report.tables.reduce((sum, entry) => sum + entry.differing, 0);
  report.missing_total = report.tables.reduce((sum, entry) => sum + entry.missing, 0);
  report.complete = Object.values(report.proof).filter((value) => typeof value === 'boolean').every(Boolean) && report.missing_total === 0 && report.differing_total === 0;
  return report;
}

function renderMoveReport(report) {
  const lines = [];
  lines.push(`run ${report.run.run_id}: generation ${report.run.generation}, ${report.run.status}, ${report.run.schema_version}; source document ${report.run.source_document_id.slice(0, 12)}`);
  lines.push(`migrations: ${report.migrations.total} files, ${report.migrations.applied_before} already on the target${report.migrations.ledger_exists ? '' : ' (no ledger yet)'}, ${report.migrations.to_apply.length} to apply${report.apply ? `, ${report.migrations.applied_now.length} applied now` : ''}`);
  for (const file of report.migrations.to_apply) lines.push(`  ${report.apply ? (report.migrations.applied_now.includes(file) ? 'applied' : 'not applied') : 'would apply'} ${file}`);
  lines.push(report.apply ? 'tables (source rows / inserted / already there / differing / target rows):' : 'tables (source rows / target rows; a target without the table reads "absent"):');
  for (const entry of report.tables) {
    lines.push(report.apply
      ? `  ${entry.table}: ${entry.source_rows} / ${entry.inserted} / ${entry.already_there} / ${entry.differing} / ${entry.target_rows}`
      : `  ${entry.table}: ${entry.source_rows} / ${entry.target_rows === null ? 'absent' : entry.target_rows}`);
    for (const difference of entry.differences || []) lines.push(`    differs ${difference.key}: ${difference.columns.join(', ')}`);
  }
  lines.push(`skipped (environment-bound): ${report.skipped_tables.join(', ')}`);
  if (report.head_elsewhere) lines.push(`note: the source's current-release pointer selects release ${report.head_elsewhere.release_id.slice(0, 12)} of run ${report.head_elsewhere.run_id}, not this run's; it does not travel with this run`);
  if (report.proof) {
    for (const [check, value] of Object.entries(report.proof)) if (typeof value === 'boolean') lines.push(`  ${value ? 'pass' : 'FAIL'} ${check.replaceAll('_', ' ')}`);
    lines.push(`published read: source ${JSON.stringify(report.proof.published_on_source)}; target ${JSON.stringify(report.proof.published_on_target)}`);
    lines.push(`inserted ${report.inserted_total} rows, ${report.differing_total} differing, ${report.missing_total} missing`);
    lines.push(report.complete ? 'move complete: the target reads as the source does' : 'move INCOMPLETE: see the failed checks');
  } else lines.push('dry run: nothing written');
  return lines.join('\n');
}

module.exports = { MOVE_TABLES, SKIPPED_TABLES, applyMigrations, migrationFiles, migrationStatus, moveRunToTarget, productReads, readLedger, renderMoveReport };
