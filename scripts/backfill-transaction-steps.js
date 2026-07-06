#!/usr/bin/env node
/*
  WP-SCHEMA-02 transaction-step backfill.

  Dry-run by default:
    node scripts/backfill-transaction-steps.js --deal Conoco
    node scripts/backfill-transaction-steps.js --all --apply
*/

const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const { extractTransactionSteps } = require('../lib/parser-v2/detectors/transaction-steps');
const {
  materializeTransactionSteps,
  transactionStepForProvision,
} = require('../lib/parser-v2/store');

function loadDotEnvLocal() {
  const text = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

function parseArgs(argv) {
  const args = { deal: null, all: false, apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--deal') args.deal = argv[++i];
    else if (arg === '--all') args.all = true;
    else if (arg === '--apply') args.apply = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }
  if (!args.deal && !args.all) throw new Error('Provide --deal <substring> or --all');
  return args;
}

async function fetchDeals(sb, args) {
  const { data, error } = await sb.from('deals').select('id, acquirer, target, metadata').limit(1000);
  if (error) throw new Error(error.message);
  return (data || []).filter((deal) => {
    if (args.all) return true;
    return `${deal.acquirer || ''} ${deal.target || ''}`.toLowerCase().includes(String(args.deal).toLowerCase());
  });
}

async function fetchConsiderationRows(sb, dealId) {
  const { data, error } = await sb
    .from('consideration_equity_provisions')
    .select('id, deal_id, region_full_text, transaction_step_id')
    .eq('deal_id', dealId);
  if (error) {
    if (/consideration_equity_provisions|schema cache|does not exist|Could not find/i.test(error.message || '')) return [];
    throw new Error(error.message);
  }
  return data || [];
}

async function backfillDeal(sb, deal, apply) {
  const sections = Array.isArray(deal.metadata && deal.metadata.classified_sections)
    ? deal.metadata.classified_sections
    : [];
  const model = extractTransactionSteps(sections, { fullCleanedText: deal.metadata && deal.metadata.full_text });
  const label = `${deal.acquirer || '?'} / ${deal.target || '?'}`;
  const summary = {
    deal_id: deal.id,
    label,
    topology: model.topology.topology,
    step_count: model.topology.step_count,
    steps: model.steps.map((step) => ({
      step_order: step.step_order,
      step_kind: step.step_kind,
      effective_time_ref: step.effective_time_ref,
      section_refs: step.section_refs,
    })),
    warnings: model.warnings || [],
  };
  if (!apply) return summary;

  const context = await materializeTransactionSteps(deal.id, model, sb);
  summary.written = Boolean(context);
  if (!context || context.topology.topology === 'SINGLE_MERGER') return summary;

  const rows = await fetchConsiderationRows(sb, deal.id);
  let bound = 0;
  let needsReview = 0;
  for (const row of rows) {
    const binding = transactionStepForProvision({ text: row.region_full_text }, context);
    if (!binding.id) continue;
    const { error } = await sb
      .from('consideration_equity_provisions')
      .update({
        transaction_step_id: binding.id,
      })
      .eq('id', row.id);
    if (error) throw new Error(`Failed to bind consideration row ${row.id}: ${error.message}`);
    bound += 1;
    if (binding.needsReview) needsReview += 1;
  }
  summary.consideration_rows_bound = bound;
  summary.consideration_rows_needs_review_binding = needsReview;
  return summary;
}

(async () => {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase creds required');
  const sb = createClient(url, key);
  const deals = await fetchDeals(sb, args);
  console.log(`Transaction-step backfill ${args.apply ? 'APPLY' : 'dry-run'} — ${deals.length} deal(s)`);
  for (const deal of deals) {
    console.log(JSON.stringify(await backfillDeal(sb, deal, args.apply)));
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
