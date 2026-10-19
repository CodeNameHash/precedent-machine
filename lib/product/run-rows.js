'use strict';

// Rows of one analysis run, read the same way by every analysis script in
// scripts/product (the Q5 limb harvest, the UNRESOLVED fact-type reading,
// the sample reconciliation): from the database through supabase-js, paged
// per table, or from a snapshot file of the same rows. Ben: "everything to
// be driven by coding and not just a layer on top so all edits need to be
// repeatable across corpus". A snapshot is the rows as the tables hold
// them ({ run_id, tables: { <table>: [row, ...] } }), so a script's reading
// of a snapshot is its reading of the database; the snapshot exists for a
// session that can read the preview branch only through SQL (the branch
// keys are not in the repository's environment) and for the tests.

const fs = require('fs');

const SNAPSHOT_VERSION = 'PRODUCT_RUN_SNAPSHOT/V1';

// The order each table pages in, as lib/product/phase-2-store.js orders
// its own reads (a stable order makes paging exact).
const TABLE_ORDER = Object.freeze({
  product_analysis_runs: ['run_id'],
  product_proposals: ['proposal_id'],
  product_coverage_assertions: ['coverage_assertion_id'],
  product_issues: ['issue_id'],
  product_source_closures: ['structure_node_id'],
  product_section_routings: ['section_routing_id'],
  product_model_calls: ['model_call_id'],
  product_section_work: ['node_id'],
  // Work package E1 (implementer E): the tables the cost ledger and the
  // replay harness read, in the store's own order.
  product_source_spans: ['span_id'],
  product_source_closure_spans: ['source_closure_id', 'span_id'],
  product_section_results: ['structure_node_id'],
  product_residual_passes: ['structure_node_id'],
  product_proposition_groups: ['proposition_group_id'],
  product_fact_links: ['fact_link_id'],
  product_fact_components: ['proposal_id', 'component_id'],
  product_fact_headlines: ['proposal_id'],
  product_fact_conclusions: ['proposal_id'],
});

// The run's context as lib/product/phase-2-store.js getRunContext returns
// it (the run row, the source document payload and the AgreementStructure
// payload), read through supabase-js by the run's own ids; neither the
// source document nor the structure carries a run_id, so they are not
// run tables. A snapshot carries them under `context`.
async function loadRunContext(client, runId) {
  const id = assertRunId(runId);
  const run = await client.from('product_analysis_runs').select('*').eq('run_id', id).maybeSingle();
  if (run.error) throw new Error(`product_analysis_runs: ${run.error.message}`);
  if (!run.data) throw new Error(`analysis run not found: ${id}`);
  const source = await client.from('product_source_documents').select('payload').eq('source_document_id', run.data.source_document_id).maybeSingle();
  if (source.error || !source.data) throw new Error(`product_source_documents: ${source.error?.message || 'not found'}`);
  const mapping = await client.from('product_run_structures').select('structure_id').eq('run_id', id).maybeSingle();
  if (mapping.error || !mapping.data) throw new Error(`product_run_structures: ${mapping.error?.message || 'not found'}`);
  const structure = await client.from('product_agreement_structures').select('payload').eq('structure_id', mapping.data.structure_id).maybeSingle();
  if (structure.error || !structure.data) throw new Error(`product_agreement_structures: ${structure.error?.message || 'not found'}`);
  return { run: run.data, sourceDocument: source.data.payload, agreementStructure: structure.data.payload };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertRunId(runId) {
  if (!UUID_PATTERN.test(String(runId || ''))) throw new TypeError(`run id must be a uuid: ${runId}`);
  return String(runId).toLowerCase();
}

// One table's rows for a run, paged. `filter` narrows by equality on
// columns ({ subject_kind: 'FACT_TYPE' }); `columns` is the select list
// (default every column). product_model_calls carries whole responses,
// so it pages in 50s as the store does.
// A list filter longer than IN_FILTER_CHUNK values goes to the database
// in chunks of that many and the pages are joined, sorted by the table's
// order: the whole-agreement ablation (plan finding (189), sections
// 'all') asked for NCS generation 5's thousand-odd proposal ids in one
// `in` filter and PostgREST refused the request's length with an empty
// message ("product_fact_components: ", jobs pm-ablation-20261019T112716Z
// and ...122058Z, finding (215)).
const IN_FILTER_CHUNK = 150;

async function loadTableRows(client, table, runId, { filter = {}, columns = '*', pageSize } = {}) {
  if (!TABLE_ORDER[table]) throw new TypeError(`unknown run table: ${table}`);
  const long = Object.entries(filter).find(([, value]) => Array.isArray(value) && value.length > IN_FILTER_CHUNK);
  if (long) {
    const [column, values] = long;
    const joined = [];
    for (let at = 0; at < values.length; at += IN_FILTER_CHUNK) {
      joined.push(...await loadTableRows(client, table, runId, { filter: { ...filter, [column]: values.slice(at, at + IN_FILTER_CHUNK) }, columns, pageSize }));
    }
    const order = TABLE_ORDER[table];
    return joined.sort((left, right) => {
      for (const key of order) {
        const a = left[key]; const b = right[key];
        if (a === b) continue;
        if (a === null || a === undefined) return 1;
        if (b === null || b === undefined) return -1;
        return a < b ? -1 : 1;
      }
      return 0;
    });
  }
  const size = pageSize || (table === 'product_model_calls' ? 50 : 500);
  const rows = [];
  for (;;) {
    let query = client.from(table).select(columns).eq('run_id', runId);
    for (const [column, value] of Object.entries(filter)) {
      query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
    }
    for (const column of TABLE_ORDER[table]) query = query.order(column);
    const result = await query.range(rows.length, rows.length + size - 1);
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    const page = result.data || [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

// { run_id, tables: { <table>: rows } } for the tables asked for.
// `tables` is a list of table names or a map of table name to
// loadTableRows options.
async function loadRunRows({ client, runId, tables }) {
  const id = assertRunId(runId);
  const entries = Array.isArray(tables) ? tables.map((table) => [table, {}]) : Object.entries(tables || {});
  const out = { schema_version: SNAPSHOT_VERSION, run_id: id, tables: {} };
  for (const [table, options] of entries) {
    out.tables[table] = await loadTableRows(client, table, id, options || {});
  }
  return out;
}

function readRunSnapshot(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !parsed.tables || typeof parsed.tables !== 'object') {
    throw new TypeError(`${filePath}: a run snapshot is { run_id, tables: { <table>: rows } }`);
  }
  const runId = assertRunId(parsed.run_id);
  for (const [table, rows] of Object.entries(parsed.tables)) {
    if (!Array.isArray(rows)) throw new TypeError(`${filePath}: tables.${table} must be an array of rows`);
    for (const row of rows) {
      if (row && row.run_id && String(row.run_id).toLowerCase() !== runId) {
        throw new TypeError(`${filePath}: tables.${table} holds a row of run ${row.run_id}`);
      }
    }
  }
  // A snapshot may carry the run's context (the run row, the source
  // document and the AgreementStructure, as loadRunContext returns them)
  // for the scripts that rebuild a run's analysis without the database.
  const context = parsed.context && typeof parsed.context === 'object' ? parsed.context : undefined;
  return { schema_version: parsed.schema_version || SNAPSHOT_VERSION, run_id: runId, tables: parsed.tables, ...(context ? { context } : {}) };
}

function writeRunSnapshot(filePath, snapshot) {
  fs.writeFileSync(filePath, `${JSON.stringify({ schema_version: SNAPSHOT_VERSION, ...snapshot })}\n`);
}

// The environment's supabase-js client, as scripts/product/estimate-run-cost.js
// builds it. Throws when the environment has no database.
function createEnvironmentClient(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to read a run from the database (or pass --snapshot <file>)');
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Resolves the rows a script works on: every --snapshot file as it is, and
// every --run id read from the database with the script's table list.
async function resolveRunRows({ runIds = [], snapshotFiles = [], tables, client = null, createClient = createEnvironmentClient }) {
  const runs = snapshotFiles.map((file) => readRunSnapshot(file));
  if (runIds.length) {
    const db = client || createClient();
    for (const runId of runIds) runs.push(await loadRunRows({ client: db, runId, tables }));
  }
  if (!runs.length) throw new TypeError('at least one --run <id> or --snapshot <file> is required');
  return runs;
}

// Section reference by structure node for a run's rows (from the source
// closures, which carry the reference the structure gave the node).
function sectionReferencesByNode(run) {
  const byNode = new Map();
  for (const closure of run.tables.product_source_closures || []) {
    if (closure.structure_node_id && closure.section_reference) byNode.set(closure.structure_node_id, closure.section_reference);
  }
  return byNode;
}

// A short label for a run in a report: the exhibit file name and the
// source generation when the run row is present, else the run id.
function runLabel(run) {
  const row = (run.tables.product_analysis_runs || [])[0];
  if (!row) return run.run_id.slice(0, 8);
  const file = String(row.retrieval_url || '').split('/').pop() || row.source_document_id || run.run_id.slice(0, 8);
  return `${file} generation ${row.source_generation ?? '?'} (${run.run_id.slice(0, 8)})`;
}

module.exports = {
  IN_FILTER_CHUNK,
  SNAPSHOT_VERSION,
  TABLE_ORDER,
  assertRunId,
  createEnvironmentClient,
  loadRunContext,
  loadRunRows,
  loadTableRows,
  readRunSnapshot,
  resolveRunRows,
  runLabel,
  sectionReferencesByNode,
  writeRunSnapshot,
};
