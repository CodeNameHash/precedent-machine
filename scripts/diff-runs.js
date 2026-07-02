#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/diff-runs.js — inspect and diff extraction runs.
   ───────────────────────────────────────────────────────────────────────────
   Usage:
     node scripts/diff-runs.js --deal <id|name>                 # list runs
     node scripts/diff-runs.js --deal X --run <run_id>          # run vs CURRENT stored
     node scripts/diff-runs.js --deal X --run <A> --run <B>     # run A vs run B

   Reads deals.metadata.extraction_runs (written by every non-dry extraction
   since P0.2) and the live provisions table. Read-only.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { diffSnapshots, formatDiff, snapshotStoredProvision } = require('../lib/run-history');
const { expandTypeGroup } = require('../lib/parser-v2/extract');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { deal: null, runs: [] };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--deal') args.deal = argv[++i];
    else if (argv[i] === '--run') args.runs.push(argv[++i]);
    else { console.error(`Unknown arg: ${argv[i]}`); process.exit(1); }
  }
  if (!args.deal) {
    console.error('Usage: node scripts/diff-runs.js --deal <id|name> [--run <id> [--run <id>]]');
    process.exit(1);
  }
  return args;
}

(async () => {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Supabase creds required (env or .env.local).'); process.exit(1); }
  const sb = createClient(url, key);

  // Resolve deal
  let dealId = args.deal;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(dealId)) {
    const { data } = await sb.from('deals').select('id, target').ilike('target', `%${args.deal}%`);
    if (!data || data.length !== 1) {
      console.error(`Deal "${args.deal}" not found or ambiguous`);
      process.exit(1);
    }
    dealId = data[0].id;
  }
  const { data: deal, error } = await sb.from('deals').select('target, metadata').eq('id', dealId).single();
  if (error) { console.error(error.message); process.exit(1); }
  const runs = (deal.metadata && deal.metadata.extraction_runs) || [];

  if (args.runs.length === 0) {
    if (!runs.length) { console.log('No recorded runs yet (records start with P0.2 extractions).'); return; }
    console.log(`Runs for ${deal.target}:`);
    for (const r of runs) {
      console.log(`  ${r.run_id}  ${r.at.slice(0, 16)}  ${r.type.padEnd(6)} ${r.backend}/${r.model || '?'}  +${r.inserted}/-${r.deleted}  ${Math.round((r.timing_ms || 0) / 1000)}s`);
    }
    return;
  }

  const findRun = (id) => runs.find((r) => r.run_id === id || r.run_id.startsWith(id));
  const runA = findRun(args.runs[0]);
  if (!runA) { console.error(`Run ${args.runs[0]} not found`); process.exit(1); }

  let before;
  let after;
  let label;
  if (args.runs.length >= 2) {
    const runB = findRun(args.runs[1]);
    if (!runB) { console.error(`Run ${args.runs[1]} not found`); process.exit(1); }
    before = runA.snapshot;
    after = runB.snapshot;
    label = `${runA.run_id} → ${runB.run_id}`;
  } else {
    // Run vs current stored provisions of the same type group.
    const group = expandTypeGroup(runA.type);
    const { data: provs } = await sb
      .from('provisions')
      .select('type, category, full_text, ai_metadata')
      .eq('deal_id', dealId)
      .in('type', group);
    before = runA.snapshot;
    after = (provs || []).map(snapshotStoredProvision);
    label = `${runA.run_id} → current stored`;
  }

  console.log(`Diff ${label}:`);
  console.log(formatDiff(diffSnapshots(before, after)));
})().catch((e) => { console.error(e.message); process.exit(1); });
