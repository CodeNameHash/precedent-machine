#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/extract-local.js — run extraction on subscriptions, not tokens.
   ───────────────────────────────────────────────────────────────────────────
   Runs the identical extraction phase as POST /api/ingest/extract-type, but
   locally: LLM calls go through `claude -p` (Claude Max) or `codex exec`
   (ChatGPT plan) via lib/llm-cli-client.js, so re-extraction costs zero API
   tokens and has no 300s serverless budget.

   Usage:
     SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
       node scripts/extract-local.js --deal <id|target-name> --type TERMR \
         [--type COND …] [--backend claude|codex] [--model sonnet|opus|…]

   Credentials come from env vars (or .env.local if present). They are never
   written to disk by this script.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createClaudeCliClient, createCodexCliClient } = require('../lib/llm-cli-client');
const { runExtractTypePhase, markExtractFailed } = require('../lib/parser-v2/run-extract');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { types: [], backend: 'claude', model: null, deal: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--type') args.types.push(argv[++i]);
    else if (a === '--backend') args.backend = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  if (!args.deal || args.types.length === 0) {
    console.error('Usage: node scripts/extract-local.js --deal <id|target-name> --type <TYPE> [--type …] [--backend claude|codex] [--model …]');
    process.exit(1);
  }
  return args;
}

async function resolveDeal(sb, dealArg) {
  // UUID → direct; otherwise match on target name (case-insensitive).
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(dealArg)) return dealArg;
  const { data, error } = await sb
    .from('deals')
    .select('id, target, acquirer')
    .ilike('target', `%${dealArg}%`);
  if (error) throw new Error(`Deal lookup failed: ${error.message}`);
  if (!data || data.length === 0) throw new Error(`No deal matching "${dealArg}"`);
  if (data.length > 1) {
    throw new Error(`Ambiguous deal "${dealArg}": ${data.map((d) => d.target).join(', ')}`);
  }
  console.log(`Deal: ${data[0].acquirer} / ${data[0].target} (${data[0].id})`);
  return data[0].id;
}

(async () => {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (env or .env.local).');
    process.exit(1);
  }
  const sb = createClient(url, key);

  const client = args.backend === 'codex'
    ? createCodexCliClient({ model: args.model || undefined })
    : createClaudeCliClient({ model: args.model || 'sonnet' });
  console.log(`Backend: ${client.backend}${args.model ? ` (${args.model})` : ''}`);

  const dealId = await resolveDeal(sb, args.deal);

  for (const type of args.types) {
    const t0 = Date.now();
    process.stdout.write(`→ ${type} … `);
    try {
      const r = await runExtractTypePhase({ dealId, type, sb, client, dryRun: args.dryRun });
      if (r.dry_run) {
        console.log(`dry-run done in ${Math.round(r.timing_ms / 1000)}s: would insert ${r.would_insert}`);
        for (const p of r.provisions) {
          console.log(`    [${p.type}] ${p.category || '?'} (${p.text_chars} chars, features: ${p.feature_keys.slice(0, 6).join(',')})`);
        }
      } else {
        console.log(
          `done in ${Math.round(r.timing_ms / 1000)}s: +${r.provisions_inserted} / -${r.provisions_deleted}` +
          (r.errors && r.errors.length ? ` (${r.errors.length} errors)` : ''),
        );
      }
    } catch (err) {
      console.log(`FAILED after ${Math.round((Date.now() - t0) / 1000)}s: ${err.message}`);
      await markExtractFailed(sb, dealId, type, err.message);
      process.exitCode = 1;
    }
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
