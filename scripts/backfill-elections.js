#!/usr/bin/env node
/*
  WP-SCHEMA-02 election backfill.

  Dry-run by default:
    node scripts/backfill-elections.js --deal Skechers
    node scripts/backfill-elections.js --all --apply
*/

const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const { buildElectionCarrierProvision } = require('../lib/parser-v2/consideration-equity');
const { buildElectionMechanism } = require('../lib/parser-v2/elections');
const {
  fetchTransactionContext,
  writeConsiderationEquity,
  writeElectionMechanism,
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
  const { data, error } = await sb.from('deals').select('id, acquirer, target').limit(1000);
  if (error) throw new Error(error.message);
  return (data || []).filter((deal) => {
    if (args.all) return true;
    return `${deal.acquirer || ''} ${deal.target || ''}`.toLowerCase().includes(String(args.deal).toLowerCase());
  });
}

async function fetchConsiderationRows(sb, dealId) {
  let result = await sb
    .from('consideration_equity_provisions')
    .select('id, deal_id, region_full_text, transaction_step_id')
    .eq('deal_id', dealId);
  if (result.error && /transaction_step_id|schema cache|does not exist|Could not find/i.test(result.error.message || '')) {
    result = await sb
      .from('consideration_equity_provisions')
      .select('id, deal_id, region_full_text')
      .eq('deal_id', dealId);
  }
  const { data, error } = result;
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchProvisionRows(sb, dealId) {
  const { data, error } = await sb
    .from('provisions')
    .select('id, deal_id, type, category, full_text, ai_metadata, region_id, consideration_equity_provision_id')
    .eq('deal_id', dealId)
    .eq('type', 'CONSID');
  if (error) throw new Error(error.message);
  return data || [];
}

function metaObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function legacyProvisionFromRow(row) {
  const meta = metaObject(row.ai_metadata);
  const features = metaObject(meta.features);
  return {
    id: row.id,
    type: row.type,
    code: meta.code || null,
    category: row.category,
    text: row.full_text,
    full_text: row.full_text,
    regionId: row.region_id || features.regionId || null,
    features,
  };
}

async function linkProvisionToConsideration(sb, row, provisionId) {
  const meta = metaObject(row.ai_metadata);
  const features = {
    ...metaObject(meta.features),
    considerationEquityProvisionId: provisionId,
  };
  const { error } = await sb
    .from('provisions')
    .update({
      consideration_equity_provision_id: provisionId,
      ai_metadata: { ...meta, features },
    })
    .eq('id', row.id);
  if (error) throw new Error(`Failed to link provision ${row.id} to consideration row ${provisionId}: ${error.message}`);
}

(async () => {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase creds required');
  const sb = createClient(url, key);
  const deals = await fetchDeals(sb, args);
  console.log(`Election backfill ${args.apply ? 'APPLY' : 'dry-run'} — ${deals.length} deal(s)`);
  for (const deal of deals) {
    const context = args.apply ? await fetchTransactionContext(deal.id, sb) : null;
    const rows = await fetchConsiderationRows(sb, deal.id);
    const summaries = [];
    for (const row of rows) {
      const election = buildElectionMechanism({
        regionFullText: row.region_full_text,
      });
      if (!election) continue;
      if (args.apply) {
        await writeElectionMechanism(row.id, election, row.region_full_text, sb, row.transaction_step_id || null);
      }
      summaries.push({
        provision_id: row.id,
        election_type: election.electionType,
        options: election.options.map((option) => option.optionType),
        is_prorated: election.isProrated,
      });
    }
    const existingIds = new Set(rows.map((row) => row.id).filter(Boolean));
    const provisionRows = await fetchProvisionRows(sb, deal.id);
    for (const row of provisionRows) {
      if (row.consideration_equity_provision_id && existingIds.has(row.consideration_equity_provision_id)) continue;
      const carrier = buildElectionCarrierProvision(legacyProvisionFromRow(row));
      if (!carrier) continue;
      let provisionId = row.consideration_equity_provision_id || null;
      if (args.apply) {
        const prov = legacyProvisionFromRow(row);
        prov.features = {
          ...(prov.features || {}),
          considerationEquity: carrier,
          considerationTreatments: [],
          treatmentGrouping: carrier.treatmentGrouping,
          regionHash: carrier.regionHash,
        };
        provisionId = await writeConsiderationEquity(deal.id, prov, sb, context);
        await linkProvisionToConsideration(sb, row, provisionId);
      }
      summaries.push({
        source_provision_id: row.id,
        provision_id: provisionId,
        election_type: carrier.electionMechanism.electionType,
        options: carrier.electionMechanism.options.map((option) => option.optionType),
        is_prorated: carrier.electionMechanism.isProrated,
      });
    }
    console.log(JSON.stringify({
      deal_id: deal.id,
      label: `${deal.acquirer || '?'} / ${deal.target || '?'}`,
      election_mechanisms: summaries.length,
      mechanisms: summaries,
    }));
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
