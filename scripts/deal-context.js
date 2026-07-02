#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/deal-context.js — compact deal digest for LLM context (/deal skill).
   ───────────────────────────────────────────────────────────────────────────
   Prints a deal's extracted provisions as a digest sized for a model context
   window, NOT for human reading: deal header, then per provision-type the
   category, canonical code, favorability, provision id, and key feature
   values (citable {value, quotes} wrappers unwrapped to their value).

   Usage:
     node scripts/deal-context.js --deal <id|target-name> [--type TERMR] [--full]

     --type   filter to one type group (TERMR expands to TERMR-M/-B/-T, etc.)
     --full   include each provision's full clause text (default omits it)

   Read-only: no writes anywhere. Credentials come from env vars (or
   .env.local if present); they are never printed or written by this script.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { expandTypeGroup } = require('../lib/parser-v2/extract');
const { canonicalFavorability } = require('../lib/search');

const PROD_URL = 'https://precedent-machine.vercel.app';

// Digest budgets (default mode). Tuned so a 300-provision deal stays well
// under ~15k tokens: ~90 chars per feature value, ~360 chars of features per
// provision, and DEF collapsed to term names only.
const VALUE_MAX = 90;
const FEATURES_MAX = 360;
const FULL_TEXT_MAX = 4000; // per-provision cap even with --full

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { deal: null, type: null, full: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--type') args.type = argv[++i];
    else if (a === '--full') args.full = true;
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  if (!args.deal) {
    console.error('Usage: node scripts/deal-context.js --deal <id|target-name> [--type TERMR] [--full]');
    process.exit(1);
  }
  return args;
}

async function resolveDeal(sb, dealArg) {
  // UUID → direct; otherwise match on target name (case-insensitive).
  // Never select deals.metadata here — it holds the full agreement text.
  const cols = 'id, acquirer, target, value_usd, announce_date, sector';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(dealArg)) {
    const { data, error } = await sb.from('deals').select(cols).eq('id', dealArg).single();
    if (error) throw new Error(`Deal lookup failed: ${error.message}`);
    return data;
  }
  const { data, error } = await sb.from('deals').select(cols).ilike('target', `%${dealArg}%`);
  if (error) throw new Error(`Deal lookup failed: ${error.message}`);
  if (!data || data.length === 0) throw new Error(`No deal matching "${dealArg}"`);
  if (data.length > 1) {
    throw new Error(`Ambiguous deal "${dealArg}": ${data.map((d) => d.target).join(', ')}`);
  }
  return data[0];
}

/* ── Value rendering ──
   Mirrors lib/citable.js discriminators (that module is ESM-only, so the two
   we need are restated here): citable wrapper {value, quotes|text} unwraps to
   .value; tagged item {code, label} renders as its label (or code). */
function isCitable(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) && 'value' in v && !('code' in v);
}

function truncate(s, max) {
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function renderValue(v, max) {
  if (v == null) return null;
  if (isCitable(v)) return renderValue(v.value, max);
  if (Array.isArray(v)) {
    const items = v.map((it) => renderValue(it, max)).filter((x) => x != null && x !== '');
    if (items.length === 0) return null;
    const shown = items.slice(0, 8);
    const suffix = items.length > 8 ? ` (+${items.length - 8} more)` : '';
    return truncate(shown.join(' | '), max * 3) + suffix;
  }
  if (typeof v === 'object') {
    if (typeof v.code === 'string' && v.code) return truncate(v.label || v.code, max);
    return truncate(JSON.stringify(v), max);
  }
  return truncate(v, max);
}

function renderFeatures(meta) {
  const feats = meta && meta.features;
  if (!feats || typeof feats !== 'object' || Array.isArray(feats)) return null;
  const parts = [];
  let used = 0;
  const keys = Object.keys(feats);
  for (const k of keys) {
    const rendered = renderValue(feats[k], VALUE_MAX);
    if (rendered == null || rendered === '') continue;
    const piece = `${k}=${rendered}`;
    if (used + piece.length > FEATURES_MAX) {
      parts.push(`(+${keys.length - parts.length} more features — use --type for detail)`);
      break;
    }
    parts.push(piece);
    used += piece.length + 2;
  }
  return parts.length ? parts.join('; ') : null;
}

function parseMeta(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

function fmtValue(usd) {
  if (usd == null) return null;
  const n = Number(usd);
  if (Number.isNaN(n)) return String(usd);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2).replace(/\.?0+$/, '')}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  return `$${n.toLocaleString('en-US')}`;
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

  const deal = await resolveDeal(sb, args.deal);

  // Structure is not a deals column — it lives (when present) in the metadata
  // JSON. Select just that key so we never pull metadata.full_text (the whole
  // agreement) into memory. A missing key is null, not an error.
  let structure = null;
  {
    const { data } = await sb.from('deals')
      .select('structure:metadata->structure').eq('id', deal.id).single();
    if (data && typeof data.structure === 'string' && data.structure) structure = data.structure;
  }

  const cols = args.full
    ? 'id, type, category, ai_favorability, ai_metadata, full_text'
    : 'id, type, category, ai_favorability, ai_metadata';
  let q = sb.from('provisions').select(cols).eq('deal_id', deal.id)
    .order('type', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(2000);
  if (args.type) q = q.in('type', expandTypeGroup(args.type));
  const { data: provisions, error: pErr } = await q;
  if (pErr) throw new Error(`Provisions fetch failed: ${pErr.message}`);

  /* ── Header ── */
  const headerBits = [
    `${deal.acquirer || '?'} / ${deal.target || '?'}`,
    fmtValue(deal.value_usd),
    structure,
    deal.sector,
    deal.announce_date ? `announced ${deal.announce_date}` : null,
  ].filter(Boolean);
  console.log(`DEAL ${deal.id}`);
  console.log(headerBits.join(' | '));
  console.log(`provisions: ${provisions.length}${args.type ? ` (filtered to ${expandTypeGroup(args.type).join('/')})` : ''}`);
  console.log('');

  /* ── Group by type ── */
  const byType = new Map();
  for (const p of provisions) {
    const t = p.type || 'UNTYPED';
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(p);
  }

  const explicitDef = args.type === 'DEF';
  for (const [type, rows] of byType) {
    // DEF collapses to term names in the default digest; --type DEF expands it.
    if (type === 'DEF' && !explicitDef) {
      const terms = rows.map((r) => r.category || '(unnamed)').sort();
      console.log(`== DEF (${rows.length} defined terms — run with --type DEF for entries) ==`);
      console.log(truncate(terms.join(', '), 3000));
      console.log('');
      continue;
    }
    console.log(`== ${type} (${rows.length}) ==`);
    for (const p of rows) {
      const meta = parseMeta(p.ai_metadata);
      const code = meta && meta.code ? meta.code : null;
      const fav = canonicalFavorability(p.ai_favorability);
      const line = [
        p.id,
        p.category || '(uncategorised)',
        code ? `code=${code}` : null,
        fav ? `fav=${fav}` : null,
      ].filter(Boolean).join(' | ');
      console.log(`- ${line}`);
      const feats = renderFeatures(meta);
      if (feats) console.log(`    ${feats}`);
      if (args.full && p.full_text) {
        console.log(`    TEXT: ${truncate(p.full_text, FULL_TEXT_MAX)}`);
      }
    }
    console.log('');
  }

  /* ── Trust report pointer ──
     Coverage/quote numbers are computed on demand, not stored — point at the
     API instead of recomputing here. */
  console.log('TRUST REPORT (computed on demand, not stored):');
  console.log(`  ${PROD_URL}/api/trust/report?deal_id=${deal.id}`);
  console.log('  summary one-liner:');
  console.log(
    `  node -e "fetch('${PROD_URL}/api/trust/report?deal_id=${deal.id}')` +
    `.then(r=>r.json()).then(j=>console.log(JSON.stringify({quotes:j.quotes&&{total:j.quotes.total,` +
    `verified:j.quotes.verified,verified_pct:j.quotes.verified_pct},coverage:j.coverage&&{pct:j.coverage.pct,` +
    `located:j.coverage.located,unlocated:j.coverage.unlocated}})))"`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
