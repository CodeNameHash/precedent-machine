#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/eval.js — golden eval harness. `npm run eval`.
   ───────────────────────────────────────────────────────────────────────────
   Asserts the hand-audited golden expectations (eval/goldens.json) against
   LIVE data: provision counts, required categories/terms, MAE carve-outs,
   coverage %, quote-verification %, schema-error rows. Exit 1 on any
   failure — run before merging any prompt/model/pipeline change, and after
   any re-extraction:

     node scripts/eval.js              # all golden deals
     node scripts/eval.js --deal Landos

   Bounds are ≥/≤ so benign extraction variance passes and regressions fail.
   Read-only. Creds from env/.env.local.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { verifyDealQuotes, computeCoverage } = require('../lib/verification');
const { validateProvisionRow, unwrap } = require('../lib/feature-validation');

// Canonical code may live at features.canonicalCode (new runs) or
// ai_metadata.code (pre-P0 rows) — accept both.
const provisionCode = (p) => ((p.ai_metadata || {}).features || {}).canonicalCode || (p.ai_metadata || {}).code || null;

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const check = (results, name, ok, actual) => {
  results.push({ name, ok, actual });
};

async function evalDeal(sb, targetName, golden) {
  const results = [];
  const { data: deals } = await sb.from('deals').select('id, target, metadata').ilike('target', `%${targetName}%`);
  if (!deals || deals.length !== 1) {
    check(results, 'deal resolves uniquely', false, `${(deals || []).length} matches`);
    return results;
  }
  const deal = deals[0];
  const { data: provisions } = await sb
    .from('provisions')
    .select('id, type, category, full_text, ai_favorability, ai_metadata')
    .eq('deal_id', deal.id);
  const provs = provisions || [];

  if (golden.min_provisions) {
    check(results, `provisions ≥ ${golden.min_provisions}`, provs.length >= golden.min_provisions, provs.length);
  }

  const defs = provs.filter((p) => p.type === 'DEF');
  if (golden.min_def_count) {
    check(results, `DEF count ≥ ${golden.min_def_count}`, defs.length >= golden.min_def_count, defs.length);
  }
  if (golden.def_required_terms) {
    for (const term of golden.def_required_terms) {
      const found = defs.some((d) => {
        // canonicalTerm may be citable-wrapped; category is the fallback name.
        const t = `${String(unwrap(((d.ai_metadata || {}).features || {}).canonicalTerm) || '')} ${d.category || ''}`;
        return t.toLowerCase().includes(term.toLowerCase());
      });
      check(results, `DEF includes "${term}"`, found, found ? 'present' : 'MISSING');
    }
  }

  if (golden.mae_min_carveouts) {
    const mae = provs.find((p) => p.type === 'DEF' && /material adverse effect/i.test(p.category || ''));
    const carveouts = mae ? ((mae.ai_metadata || {}).features || {}).carveouts : null;
    const n = Array.isArray(carveouts) ? carveouts.length
      : (carveouts && Array.isArray(carveouts.value)) ? carveouts.value.length : 0;
    check(results, `MAE carve-outs ≥ ${golden.mae_min_carveouts}`, n >= golden.mae_min_carveouts, n);
  }

  if (golden.termf_required_categories) {
    const cats = new Set(provs.filter((p) => p.type === 'TERMF').map((p) => p.category));
    for (const c of golden.termf_required_categories) {
      check(results, `TERMF has "${c}"`, cats.has(c), cats.has(c) ? 'present' : 'MISSING');
    }
  }

  if (golden.min_termr_canonical_codes) {
    const codes = new Set();
    for (const p of provs) {
      if (!String(p.type).startsWith('TERMR')) continue;
      const code = provisionCode(p);
      if (code) codes.add(code);
    }
    check(results, `TERMR canonical codes ≥ ${golden.min_termr_canonical_codes}`, codes.size >= golden.min_termr_canonical_codes, codes.size);
  }

  const sourceText = (deal.metadata || {}).full_text || '';
  if (sourceText) {
    if (golden.min_coverage_pct) {
      const cov = computeCoverage(provs, sourceText);
      check(results, `coverage ≥ ${golden.min_coverage_pct}%`, cov.pct >= golden.min_coverage_pct, `${cov.pct}%`);
    }
    if (golden.min_quote_verified_pct) {
      const q = verifyDealQuotes(provs, sourceText);
      const judgeable = q.total - q.skipped;
      const pct = judgeable > 0 ? Math.round((q.verified / judgeable) * 1000) / 10 : 100;
      check(results, `quotes verified ≥ ${golden.min_quote_verified_pct}%`, pct >= golden.min_quote_verified_pct, `${pct}% (${q.unverified} flagged)`);
    }
  }

  if (golden.max_schema_error_rows !== undefined) {
    let errRows = 0;
    for (const p of provs) if (validateProvisionRow(p).errors.length) errRows += 1;
    check(results, `schema-error rows ≤ ${golden.max_schema_error_rows}`, errRows <= golden.max_schema_error_rows, errRows);
  }

  return results;
}

(async () => {
  loadDotEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Supabase creds required (env or .env.local).'); process.exit(1); }
  const sb = createClient(url, key);

  const only = process.argv.includes('--deal') ? process.argv[process.argv.indexOf('--deal') + 1] : null;
  const goldens = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eval', 'goldens.json'), 'utf-8'));

  let failed = 0;
  for (const [name, golden] of Object.entries(goldens.deals)) {
    if (only && name.toLowerCase() !== only.toLowerCase()) continue;
    const results = await evalDeal(sb, name, golden);
    console.log(`\n${name}:`);
    for (const r of results) {
      console.log(`  ${r.ok ? '✓' : '✗ FAIL'} ${r.name} (actual: ${r.actual})`);
      if (!r.ok) failed += 1;
    }
  }
  console.log(failed ? `\n${failed} golden check(s) FAILED` : '\nAll golden checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
