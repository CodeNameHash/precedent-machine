#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/query-demo-check.js — WP-1 (M4-03) live demo-set gate.
   ───────────────────────────────────────────────────────────────────────────
   Loads the live corpus exactly as pages/api/query/run.js does (paginated
   `provisions`, full `ai_metadata`), runs every payload in
   lib/query/fixtures/demo-set.json through the real query engine
   (lib/query/engine.js runQuery), diffs the result against each entry's
   pinned `expected`, and prints a PASS/FAIL table. Exits 1 on any FAIL (or on
   any entry erroring) so it composes as a CI/manual gate.

   Read-only against `deals`/`provisions`. Never writes to the corpus.

   Usage:
     node scripts/query-demo-check.js                 # run and grade all 20
     node scripts/query-demo-check.js --query fee-pct-of-value
     node scripts/query-demo-check.js --update         # rewrite `expected`
                                                        # in demo-set.json from
                                                        # the live answer.
                                                        # NEVER run this in CI —
                                                        # it launders a wrong
                                                        # answer into "passing".
     node scripts/query-demo-check.js --json out.json  # also emit a machine
                                                        # -readable report.

   Creds: env / .env.local (same pattern as scripts/ingest-qa.js).
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { runQuery } = require('../lib/query/engine');
const { resolveDemoPayload } = require('../lib/query/fixtures/resolve-demo-payload');
const { checkResult, computeExpected } = require('../lib/query/fixtures/demo-set-check');

const DEMO_SET_PATH = path.join(__dirname, '..', 'lib/query/fixtures/demo-set.json');
const DEAL_SELECT = 'id, acquirer, target, value_usd, announce_date, sector, metadata';
const PROVISION_SELECT = 'id, deal_id, type, category, full_text, ai_metadata, created_at';
const PAGE_SIZE = 1000;

function findDotEnvLocal(start = path.join(__dirname, '..')) {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, '.env.local');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadDotEnvLocal(envPath = findDotEnvLocal()) {
  if (!envPath || !fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { query: null, update: false, json: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--query') args.query = argv[++i];
    else if (argv[i] === '--update') args.update = true;
    else if (argv[i] === '--json') args.json = argv[++i];
  }
  return args;
}

async function fetchAllProvisions(sb) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select(PROVISION_SELECT)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

function loadDemoSet() {
  const raw = fs.readFileSync(DEMO_SET_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${DEMO_SET_PATH} must be a JSON array`);
  return parsed;
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) {
    console.error('Supabase creds required (env / .env.local).');
    process.exit(1);
  }
  const sb = createClient(dbUrl, key);

  const { data: deals, error } = await sb.from('deals').select(DEAL_SELECT).order('announce_date', { ascending: false });
  if (error) { console.error(`Deal fetch failed: ${error.message}`); process.exit(1); }
  const provisions = await fetchAllProvisions(sb);
  const context = { deals: deals || [], provisions };
  console.log(`Live corpus: ${context.deals.length} deals, ${context.provisions.length} provisions.\n`);

  let entries = loadDemoSet();
  if (args.query) entries = entries.filter((e) => e.id === args.query);
  if (entries.length === 0) {
    console.error(args.query ? `No demo-set entry with id "${args.query}".` : 'demo-set.json is empty.');
    process.exit(1);
  }

  const rows = [];
  let updated = false;

  for (const entry of entries) {
    const row = { id: entry.id, title: entry.title, kind: entry.kind, status: 'ERROR', details: [] };
    try {
      const resolvedPayload = resolveDemoPayload(entry.payload, context.deals);
      const result = await runQuery(entry.kind, resolvedPayload, { context });
      if (args.update) {
        entry.expected = computeExpected(entry.kind, result, context.deals);
        updated = true;
        row.status = 'UPDATED';
      } else {
        const { ok, details } = checkResult(entry.kind, result, entry.expected, context.deals);
        row.status = ok ? 'PASS' : 'FAIL';
        row.details = details;
      }
    } catch (err) {
      row.status = 'ERROR';
      row.details = [err.message];
    }
    rows.push(row);
  }

  if (args.update) {
    fs.writeFileSync(DEMO_SET_PATH, `${JSON.stringify(loadDemoSetMerged(entries), null, 2)}\n`);
  }

  printTable(rows);

  if (args.json) {
    fs.writeFileSync(args.json, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  }

  const passCount = rows.filter((r) => r.status === 'PASS' || r.status === 'UPDATED').length;
  console.log(`\n${passCount}/${rows.length} ${args.update ? 'updated' : 'passing'}.`);

  if (!args.update && passCount !== rows.length) process.exitCode = 1;
}

// When --update runs against a --query subset, splice the updated entries
// back into the full demo-set list rather than truncating the file.
function loadDemoSetMerged(updatedEntries) {
  const full = loadDemoSet();
  const byId = new Map(updatedEntries.map((e) => [e.id, e]));
  return full.map((e) => byId.get(e.id) || e);
}

function printTable(rows) {
  const idWidth = Math.max(2, ...rows.map((r) => r.id.length));
  for (const row of rows) {
    const status = row.status.padEnd(7);
    console.log(`${status} ${row.id.padEnd(idWidth)}  ${row.kind.padEnd(18)} ${row.title}`);
    for (const detail of row.details) console.log(`        - ${detail}`);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { loadDemoSet, findDotEnvLocal, loadDotEnvLocal };
