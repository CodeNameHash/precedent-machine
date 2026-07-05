#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { discoverEdgarCandidates, DEFAULT_DAYS } = require('../lib/edgar-catalog');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const out = {
    days: DEFAULT_DAYS,
    since: null,
    until: null,
    limit: null,
    dryRun: false,
    backfill: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--backfill') {
      out.backfill = true;
      out.since = out.since || '2024-01-01';
    } else if (arg === '--days') out.days = Number(argv[++i]);
    else if (arg === '--since') out.since = argv[++i];
    else if (arg === '--until') out.until = argv[++i];
    else if (arg === '--limit') out.limit = Number(argv[++i]);
    else if (arg.startsWith('--days=')) out.days = Number(arg.slice('--days='.length));
    else if (arg.startsWith('--since=')) out.since = arg.slice('--since='.length);
    else if (arg.startsWith('--until=')) out.until = arg.slice('--until='.length);
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.slice('--limit='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(out.days) || out.days < 0) out.days = DEFAULT_DAYS;
  if (out.limit != null && (!Number.isFinite(out.limit) || out.limit <= 0)) {
    throw new Error('--limit must be a positive number');
  }
  return out;
}

function usage() {
  return [
    'Usage: node scripts/edgar-watch.js [--days 7] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--limit N] [--dry-run]',
    '',
    'Examples:',
    '  node scripts/edgar-watch.js --dry-run --days 1 --limit 5',
    '  node scripts/edgar-watch.js --since 2024-01-01 --limit 250',
    '  node scripts/edgar-watch.js --backfill',
  ].join('\n');
}

function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const supabase = args.dryRun ? null : serviceSupabase();
  if (!args.dryRun && !supabase) {
    throw new Error('Supabase service credentials are required unless --dry-run is set');
  }

  const result = await discoverEdgarCandidates({
    days: args.days,
    since: args.since,
    until: args.until,
    limit: args.limit,
    dryRun: args.dryRun,
    supabase,
  });

  const action = args.dryRun ? 'dry-run candidates' : 'inserted candidates';
  console.log(`EDGAR watch complete: scanned=${result.scanned} candidates=${result.candidates} ${action}=${args.dryRun ? result.candidates : result.inserted} duplicates=${result.duplicates} skipped=${result.skipped} errors=${result.errors.length}`);

  for (const entry of result.results) {
    if (entry.kind === 'candidate') {
      const c = entry.candidate;
      console.log([
        entry.store?.action || 'candidate',
        c.filing_date,
        c.filed_by_party || c.cik,
        c.filing_accession,
        c.agreement_exhibit_url,
      ].filter(Boolean).join(' | '));
    }
  }

  for (const err of result.errors) {
    console.warn(`ERROR ${err.cik || ''} ${err.filing_accession || ''}: ${err.message}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = { loadEnvLocal, parseArgs, serviceSupabase };
