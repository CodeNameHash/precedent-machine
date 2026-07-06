#!/usr/bin/env node
/*
  WP-SCHEMA-01 consideration backfill.

  Dry-run by default. This creates consideration_equity_provisions /
  consideration_treatments from existing legacy CONSID-EQUITY rows only as a
  bridge. Rows derived from incomplete legacy data are marked
  needs_reextraction so the Codex CONSID re-run can replace them with true
  source spans.
*/

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  buildConsiderationEquityProvision,
  canonicalInstrumentType,
  enforceConsiderationEquityInvariants,
} = require('../lib/parser-v2/consideration-equity');
const { firstAffirmativeMention } = require('../lib/instrument-negation');

const INSTRUMENT_MENTION_RES = {
  STOCK_OPTIONS: /\b(?:Company\s+)?Stock\s+Options?\b/i,
  RSA: /\b(?:Company\s+)?Restricted\s+Stock\s+Awards?\b|\bRSAs?\b/,
  RSU: /\b(?:Company\s+)?Restricted\s+Stock\s+Units?\b|\bRSUs?\b/,
  PSU: /\b(?:Company\s+)?Performance\s+(?:Stock\s+|Share\s+)?Units?\b|\bPSUs?\b/,
  ESPP: /\b(?:Company\s+)?ESPP\b|\bEmployee\s+Stock\s+Purchase\s+Plan\b/i,
  SAR: /\bStock\s+Appreciation\s+Rights?\b|\bSARs?\b/,
  PHANTOM_STOCK: /\bphantom\s+stock\b/i,
};

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { deal: null, all: false, apply: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--apply') args.apply = true;
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  if (!args.deal && !args.all) {
    console.error('Usage: node scripts/backfill-consideration.js (--deal <substring> | --all) [--apply]');
    process.exit(1);
  }
  return args;
}

async function fetchDeals(sb, args) {
  const { data, error } = await sb.from('deals').select('id,acquirer,target,metadata');
  if (error) throw new Error(error.message);
  return (data || []).filter((deal) => {
    if (args.all) return true;
    return `${deal.acquirer || ''} ${deal.target || ''}`.toLowerCase().includes(args.deal.toLowerCase());
  });
}

async function fetchEquityRows(sb, dealId) {
  const { data, error } = await sb
    .from('provisions')
    .select('id,type,category,full_text,ai_metadata,region_id,consideration_equity_provision_id')
    .eq('deal_id', dealId)
    .eq('type', 'CONSID');
  if (error) throw new Error(error.message);
  return (data || []).filter((row) => row.ai_metadata && row.ai_metadata.code === 'CONSID-EQUITY');
}

function legacyProvisionFromRow(row) {
  const meta = row.ai_metadata || {};
  const features = meta.features || {};
  return {
    id: row.id,
    type: row.type,
    code: meta.code,
    category: row.category,
    text: row.full_text,
    full_text: row.full_text,
    regionId: row.region_id || features.regionId || null,
    features,
  };
}

function mentionedInstrumentCodes(text) {
  const found = new Set();
  for (const [code, re] of Object.entries(INSTRUMENT_MENTION_RES)) {
    if (firstAffirmativeMention(re, String(text || ''))) found.add(code);
  }
  return found;
}

function conversionNeedsReextraction(row, extracted) {
  const features = row.ai_metadata && row.ai_metadata.features ? row.ai_metadata.features : {};
  const insts = Array.isArray(features.outstandingInstruments) ? features.outstandingInstruments : [];
  const treatments = Array.isArray(features.instrumentTreatments) ? features.instrumentTreatments : [];
  const structured = new Set(insts.map(canonicalInstrumentType));
  for (const mentioned of mentionedInstrumentCodes(row.full_text)) {
    if (!structured.has(mentioned)) return true;
  }
  if (insts.length !== treatments.length) return true;
  if ((extracted.treatments || []).some((t) => t.spanType !== 'OWN_SUBPROVISION')) return true;
  return false;
}

async function writeExtracted(sb, dealId, row, extracted, needsReextraction) {
  enforceConsiderationEquityInvariants(extracted);
  const { data, error } = await sb
    .from('consideration_equity_provisions')
    .upsert({
      deal_id: dealId,
      section_ref: extracted.sectionRef || null,
      region_id: extracted.regionId || null,
      region_full_text: extracted.regionFullText,
      region_hash: extracted.regionHash,
      treatment_grouping: extracted.treatmentGrouping,
      needs_reextraction: !!needsReextraction,
      extracted_by: extracted.extractedBy || 'CODEX',
      extraction_version: extracted.extractionVersion || 'consideration-equity-v1',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'deal_id,region_hash' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const provisionId = data.id;
  const { error: delErr } = await sb.from('consideration_treatments').delete().eq('provision_id', provisionId);
  if (delErr) throw new Error(delErr.message);
  const treatmentRows = extracted.treatments.map((t) => ({
    provision_id: provisionId,
    instrument_type: t.instrumentType,
    vesting_treatment: t.vestingTreatment,
    consideration_type: t.considerationType,
    cash_formula: t.cashFormula,
    stock_formula: t.stockFormula,
    in_the_money_only: t.inTheMoneyOnly,
    performance_treatment: t.performanceTreatment,
    tax_treatment_note: t.taxTreatmentNote,
    span_type: t.spanType,
    source_span_start: t.sourceSpanStart,
    source_span_end: t.sourceSpanEnd,
    verbatim_quote: t.verbatimQuote,
    bring_down_section_ref: t.bringDownSectionRef,
    bring_down_verbatim_quote: t.bringDownVerbatimQuote,
    bring_down_region_id: t.bringDownRegionId,
    extracted_by: extracted.extractedBy || 'CODEX',
    confidence: t.confidence,
  }));
  const { error: insErr } = await sb.from('consideration_treatments').insert(treatmentRows);
  if (insErr) throw new Error(insErr.message);

  const meta = row.ai_metadata || {};
  const features = {
    ...(meta.features || {}),
    considerationEquityProvisionId: provisionId,
  };
  await sb.from('provisions').update({
    consideration_equity_provision_id: provisionId,
    ai_metadata: { ...meta, features },
  }).eq('id', row.id);
  return provisionId;
}

async function backfillDeal(sb, deal, apply) {
  const rows = await fetchEquityRows(sb, deal.id);
  const results = [];
  for (const row of rows) {
    const extracted = buildConsiderationEquityProvision(legacyProvisionFromRow(row));
    if (!extracted) {
      results.push({ row_id: row.id, skipped: true, reason: 'could not build extracted consideration provision' });
      continue;
    }
    const needsReextraction = conversionNeedsReextraction(row, extracted);
    const summary = {
      row_id: row.id,
      section_ref: extracted.sectionRef,
      treatment_grouping: extracted.treatmentGrouping,
      treatments: extracted.treatments.map((t) => t.instrumentType),
      needs_reextraction: needsReextraction,
    };
    if (apply) summary.consideration_equity_provision_id = await writeExtracted(sb, deal.id, row, extracted, needsReextraction);
    results.push(summary);
  }
  return results;
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase creds required');
  const sb = createClient(url, key);
  const deals = await fetchDeals(sb, args);
  console.log(`Backfill consideration — ${deals.length} deal(s), ${args.apply ? 'APPLY' : 'dry-run'}`);
  for (const deal of deals) {
    const result = await backfillDeal(sb, deal, args.apply);
    console.log(`${deal.acquirer || '?'} / ${deal.target || '?'} (${deal.id}): ${JSON.stringify(result)}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = {
  backfillDeal,
  conversionNeedsReextraction,
  legacyProvisionFromRow,
  mentionedInstrumentCodes,
  parseArgs,
};
