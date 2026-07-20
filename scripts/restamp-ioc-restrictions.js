#!/usr/bin/env node
/*
 * restamp-ioc-restrictions.js — deterministic, in-place refresh of
 * provisions.ai_metadata.features.restrictionComponents.
 *
 * Why this script exists (r13): the wave-3 audit found the tagger stamping
 * wrong restriction families (~214 false tags across 27 decks) and the
 * fixed classifier shipped in lib/parser-v2/extract.js — but the WRONG
 * values are already stored, and the pipeline's own
 * stampIocRestrictionComponents deliberately SKIPS rows that already carry
 * tags, so neither a re-ingest of the stamp phase nor a full
 * `reprocess.js --types IOC` (which redoes AI extraction end-to-end, hours
 * + plan usage) is the right tool. This script recomputes the field from
 * the STORED clause text with the fixed classifier and overwrites where
 * the answer changed. Zero AI calls, zero re-extraction — pure regex over
 * text already in the DB.
 *
 * Usage (Ben's machine, .env.local present):
 *   node scripts/restamp-ioc-restrictions.js            # dry run: prints the per-deal diff
 *   node scripts/restamp-ioc-restrictions.js --apply    # write the changes
 *
 * Behavior:
 *   - IOC-family provisions only (type matches /IOC/).
 *   - New tags differ from stored -> overwrite (including clearing stored
 *     tags the fixed classifier no longer supports — the UI renders nothing
 *     for an empty list, never "Not specified").
 *   - Stored == recomputed -> untouched.
 *   - dollarThresholdsByCategory and every other feature are untouched.
 */
// Plain `node` never loads .env.local (only Next.js does) -- same tiny
// loader every other DB script in scripts/ carries (see scripts/eval.js).
const fs = require('fs');
const path = require('path');
(() => {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
})();
const { getServiceSupabase } = require('../lib/supabase');
const { classifyIocRestrictionComponents } = require('../lib/parser-v2/extract');

const APPLY = process.argv.includes('--apply');

const metaOf = (p) => {
  let m = p.ai_metadata;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch { m = {}; } }
  return m && typeof m === 'object' ? m : {};
};

const sameTags = (a, b) => {
  const av = Array.isArray(a) ? [...a].sort() : [];
  const bv = Array.isArray(b) ? [...b].sort() : [];
  return JSON.stringify(av) === JSON.stringify(bv);
};


// Supabase caps every query at 1000 rows by default -- a multi-deal
// provisions fetch silently truncates past that (the bug that made this
// script report "no NOSOL provisions" for deals whose rows fell beyond the
// cap). Page through with .range() until a short page.
async function fetchAllRows(query) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

async function main() {
  const sb = getServiceSupabase();
  if (!sb) { console.error('Supabase not configured (need .env.local)'); process.exit(1); }

  const provisions = await fetchAllRows(sb
    .from('provisions')
    .select('id, deal_id, type, full_text, ai_metadata')
    .ilike('type', '%IOC%')
    .order('id'));
  console.log(`IOC-family provisions: ${(provisions || []).length}`);

  const plan = [];
  for (const p of provisions || []) {
    const meta = metaOf(p);
    const features = meta.features && typeof meta.features === 'object' ? meta.features : {};
    const stored = features.restrictionComponents;
    const text = String(p.full_text || '');
    if (!text.trim()) continue;
    const fresh = classifyIocRestrictionComponents(text);
    if (sameTags(stored, fresh)) continue;
    plan.push({ p, meta, features, stored: stored || [], fresh });
  }

  const byDeal = new Map();
  for (const entry of plan) {
    if (!byDeal.has(entry.p.deal_id)) byDeal.set(entry.p.deal_id, []);
    byDeal.get(entry.p.deal_id).push(entry);
  }
  console.log(`\nchanges: ${plan.length} provisions across ${byDeal.size} deals${APPLY ? ' (APPLYING)' : ' (dry run — pass --apply to write)'}`);
  for (const [dealId, entries] of byDeal.entries()) {
    console.log(`\n${dealId}`);
    for (const e of entries) {
      console.log(`  ${e.p.id} [${e.p.type}]  ${JSON.stringify(e.stored)} -> ${JSON.stringify(e.fresh)}`);
    }
  }

  if (!APPLY) return;
  let written = 0;
  for (const e of plan) {
    const meta = e.meta;
    meta.features = e.features;
    if (e.fresh.length) meta.features.restrictionComponents = e.fresh;
    else delete meta.features.restrictionComponents;
    const { error: wErr } = await sb.from('provisions').update({ ai_metadata: meta }).eq('id', e.p.id);
    if (wErr) { console.error(`WRITE FAIL ${e.p.id}: ${wErr.message}`); process.exit(1); }
    written += 1;
  }
  console.log(`\nwrote ${written} provisions. Spot-check a Heinz/QXO dividends row on the review page.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
