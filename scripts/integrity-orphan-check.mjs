#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/integrity-orphan-check.mjs — READ-ONLY orphan-rate check across
   canonical-corpus relationships that are not (or not fully) enforced by a
   database foreign key.

   Background (live v1 production finding, 2026-07):
     - claims.source_provision_id has NO foreign key (supabase/schema-05-claims.sql
       stores it as lineage-only: "This id is NOT stable across re-ingests and
       must never be used as a join key by the app"). Only ~98.48% of claims
       (73,712 of 74,852) resolve to a live provisions row.
     - claims.excerpt_id -> provision_cards.excerpt_id IS a real DB-enforced FK
       (ON DELETE CASCADE) and is the stable anchor claims code is supposed to
       use.
     - provisions <-> provision_cards has NO foreign key in either direction.
     - provision_cards.deal_id and provisions.deal_id ARE DB-enforced FKs to
       deals.id today; they are still checked here as a standing regression
       guard (a future migration/backfill could reintroduce orphans, or the
       constraint could be dropped without anyone noticing).

   This script never writes. It only ever issues .select(...) queries. It is
   meant to run as a release gate: pass --max-orphan-pct to set the ceiling
   (default 2.0); the process exits non-zero if ANY check's orphan rate
   exceeds it.

   Usage:
     node scripts/integrity-orphan-check.mjs
     node scripts/integrity-orphan-check.mjs --max-orphan-pct 1.5
     node scripts/integrity-orphan-check.mjs --json
     node scripts/integrity-orphan-check.mjs --project-url <url> --service-key <key>

   Config resolution (same convention as scripts/backfill-advisors.js /
   scripts/repair-stale-staging-flags.mjs / lib/supabase.js's
   getServiceSupabase — do not invent a new one):
     --project-url <url>   else SUPABASE_URL, else NEXT_PUBLIC_SUPABASE_URL
     --service-key <key>   else SUPABASE_SERVICE_ROLE_KEY
   .env.local is loaded first (without clobbering already-set env vars) so
   local runs work the same way the other scripts do.

   Exit codes:
     0   all checks resolved within --max-orphan-pct
     1   at least one check exceeded --max-orphan-pct
     2   could not run the checks at all (missing config, query failure)
   ───────────────────────────────────────────────────────────────────────── */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MAX_ORPHAN_PCT = 2.0;
const PAGE_SIZE = 1000;

// Every check reads: the child table's own key column (`childIdColumn`, used
// only to report readable sample ids) and its FK-shaped column
// (`childFkColumn`), plus the parent table's referenced column
// (`parentKeyColumn`). Nothing here is ever written to.
export const CHECKS = [
  {
    name: 'claims.source_provision_id -> provisions.id',
    childTable: 'claims',
    childIdColumn: 'id',
    childFkColumn: 'source_provision_id',
    parentTable: 'provisions',
    parentKeyColumn: 'id',
  },
  {
    name: 'claims.excerpt_id -> provision_cards.excerpt_id',
    childTable: 'claims',
    childIdColumn: 'id',
    childFkColumn: 'excerpt_id',
    parentTable: 'provision_cards',
    parentKeyColumn: 'excerpt_id',
  },
  {
    name: 'provision_cards.deal_id -> deals.id',
    childTable: 'provision_cards',
    childIdColumn: 'id',
    childFkColumn: 'deal_id',
    parentTable: 'deals',
    parentKeyColumn: 'id',
  },
  {
    name: 'provisions.deal_id -> deals.id',
    childTable: 'provisions',
    childIdColumn: 'id',
    childFkColumn: 'deal_id',
    parentTable: 'deals',
    parentKeyColumn: 'id',
  },
];

// ── pure logic (unit-testable with stubbed rows, no DB) ────────────────────

/**
 * Evaluate one orphan check from already-fetched rows.
 * @param {Array<object>} childRows - rows from the child table, each with at
 *   least [idColumn] and [fkColumn]. Rows whose fkColumn is null/undefined
 *   are excluded from `total` (an unset reference isn't an orphan).
 * @param {Set<*>} parentKeySet - set of live parent key values.
 * @param {{ idColumn: string, fkColumn: string, sampleSize?: number }} opts
 */
export function evaluateOrphanCheck(childRows, parentKeySet, { idColumn, fkColumn, sampleSize = 10 }) {
  let total = 0;
  let resolvable = 0;
  const sampleOrphanIds = [];
  for (const row of childRows || []) {
    const fkValue = row ? row[fkColumn] : undefined;
    if (fkValue === null || fkValue === undefined) continue;
    total += 1;
    if (parentKeySet.has(fkValue)) {
      resolvable += 1;
    } else if (sampleOrphanIds.length < sampleSize) {
      sampleOrphanIds.push(row[idColumn]);
    }
  }
  const orphanCount = total - resolvable;
  const orphanPct = total === 0 ? 0 : (orphanCount / total) * 100;
  return { total, resolvable, orphanCount, orphanPct, sampleOrphanIds };
}

/**
 * Decide the gate outcome from a set of already-evaluated check results.
 * @param {Array<{ name: string, orphanPct: number }>} results
 * @param {number} maxOrphanPct
 */
export function decideGate(results, maxOrphanPct) {
  const failing = results.filter((result) => result.orphanPct > maxOrphanPct);
  return { ok: failing.length === 0, failing };
}

export function parseArgs(argv) {
  const args = {
    projectUrl: null,
    serviceKey: null,
    maxOrphanPct: DEFAULT_MAX_ORPHAN_PCT,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project-url') args.projectUrl = argv[++i];
    else if (arg === '--service-key') args.serviceKey = argv[++i];
    else if (arg === '--max-orphan-pct') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`--max-orphan-pct must be a non-negative number, got ${argv[i]}`);
      }
      args.maxOrphanPct = value;
    } else if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }
  return args;
}

// ── env / config plumbing (mirrors scripts/backfill-advisors.js) ───────────

export function loadDotEnvLocal(dir = path.join(__dirname, '..'), env = process.env) {
  const envPath = path.join(dir, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in env)) env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

export function resolveSupabaseConfig(args, env = process.env) {
  const url = args.projectUrl || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || null;
  const key = args.serviceKey || env.SUPABASE_SERVICE_ROLE_KEY || null;
  return { url, key };
}

// ── DB access (paginated, read-only SELECTs only) ───────────────────────────

async function fetchAllColumn(client, table, column) {
  const values = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(column)
      .order(column, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`SELECT ${column} FROM ${table} failed: ${error.message}`);
    for (const row of data) values.add(row[column]);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return values;
}

async function fetchAllRows(client, table, idColumn, fkColumn) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select(`${idColumn},${fkColumn}`)
      .not(fkColumn, 'is', null)
      .order(idColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`SELECT ${idColumn},${fkColumn} FROM ${table} failed: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/** Runs every check in CHECKS against a live (read-only) Supabase client. */
export async function runChecks(client, checks = CHECKS) {
  const results = [];
  for (const check of checks) {
    const [parentKeySet, childRows] = await Promise.all([
      fetchAllColumn(client, check.parentTable, check.parentKeyColumn),
      fetchAllRows(client, check.childTable, check.childIdColumn, check.childFkColumn),
    ]);
    const evaluation = evaluateOrphanCheck(childRows, parentKeySet, {
      idColumn: check.childIdColumn,
      fkColumn: check.childFkColumn,
    });
    results.push({ name: check.name, ...evaluation });
  }
  return results;
}

// ── reporting ────────────────────────────────────────────────────────────

function printReport(results, maxOrphanPct, gate) {
  console.log(`Orphan check (max allowed orphan rate: ${maxOrphanPct}%)\n`);
  for (const result of results) {
    const flag = result.orphanPct > maxOrphanPct ? 'FAIL' : 'ok';
    console.log(`[${flag}] ${result.name}`);
    console.log(
      `  total=${result.total} resolvable=${result.resolvable} `
      + `orphans=${result.orphanCount} (${result.orphanPct.toFixed(2)}%)`,
    );
    if (result.sampleOrphanIds.length > 0) {
      console.log(`  sample orphan ids: ${result.sampleOrphanIds.join(', ')}`);
    }
    console.log('');
  }
  console.log(gate.ok ? 'PASS: all checks within threshold.' : 'FAIL: threshold exceeded.');
}

// ── entrypoint ───────────────────────────────────────────────────────────

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 2;
    return;
  }

  if (args.help) {
    console.log('Usage: node scripts/integrity-orphan-check.mjs [--project-url <url>] '
      + '[--service-key <key>] [--max-orphan-pct <pct>] [--json]');
    return;
  }

  loadDotEnvLocal();
  const { url, key } = resolveSupabaseConfig(args);
  if (!url || !key) {
    console.error(
      'Missing Supabase config: pass --project-url/--service-key or set '
      + 'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
    process.exitCode = 2;
    return;
  }

  const client = createClient(url, key, { auth: { persistSession: false } });

  let results;
  try {
    results = await runChecks(client);
  } catch (err) {
    console.error(`Orphan check failed: ${err.message}`);
    process.exitCode = 2;
    return;
  }

  const gate = decideGate(results, args.maxOrphanPct);

  if (args.json) {
    console.log(JSON.stringify({
      max_orphan_pct: args.maxOrphanPct,
      ok: gate.ok,
      checks: results.map((result) => ({
        name: result.name,
        total: result.total,
        resolvable: result.resolvable,
        orphan_count: result.orphanCount,
        orphan_pct: result.orphanPct,
        sample_orphan_ids: result.sampleOrphanIds,
      })),
    }, null, 2));
  } else {
    printReport(results, args.maxOrphanPct, gate);
  }

  process.exitCode = gate.ok ? 0 : 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
