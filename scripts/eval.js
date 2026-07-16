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

function featureBag(provision) {
  const metadata = provision && provision.ai_metadata;
  const features = metadata && typeof metadata === 'object' ? metadata.features : null;
  return features && typeof features === 'object' ? features : {};
}

function textValue(value) {
  const unwrapped = unwrap(value);
  if (unwrapped === null || unwrapped === undefined) return '';
  if (typeof unwrapped === 'string') return unwrapped;
  if (typeof unwrapped === 'object') return unwrapped.label || unwrapped.value || unwrapped.code || '';
  return String(unwrapped);
}

function carveoutCount(provision) {
  const carveouts = featureBag(provision).carveouts;
  const unwrapped = unwrap(carveouts);
  if (Array.isArray(unwrapped)) return unwrapped.length;
  if (unwrapped && Array.isArray(unwrapped.value)) return unwrapped.value.length;
  return 0;
}

function selectMaeDefinition(provisions) {
  const candidates = (provisions || []).filter((p) => {
    if (!p || p.type !== 'DEF') return false;
    const features = featureBag(p);
    const code = provisionCode(p);
    const term = textValue(features.canonicalTerm);
    const haystack = `${p.category || ''} ${term} ${code || ''}`;
    return /\bmaterial adverse effect\b/i.test(haystack) || code === 'DEF-MAE';
  });
  if (!candidates.length) return null;

  return candidates
    .map((p) => {
      const features = featureBag(p);
      const term = textValue(features.canonicalTerm).trim().toLowerCase();
      const category = String(p.category || '').trim().toLowerCase();
      const code = provisionCode(p);
      const exactTerm = term === 'material adverse effect' || category === 'material adverse effect';
      const parentSpecific = /^parent material adverse effect$/.test(term) || /^parent material adverse effect$/.test(category);
      return {
        provision: p,
        score:
          (code === 'DEF-MAE' ? 100 : 0)
          + (exactTerm ? 50 : 0)
          + (parentSpecific ? -25 : 0)
          + Math.min(carveoutCount(p), 20),
      };
    })
    .sort((a, b) => b.score - a.score)[0].provision;
}

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
    const mae = selectMaeDefinition(provs);
    const n = carveoutCount(mae);
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

  if (golden.min_nosol_provisions) {
    const n = provs.filter((p) => String(p.type).startsWith('NOSOL')).length;
    check(results, `NOSOL provisions ≥ ${golden.min_nosol_provisions}`, n >= golden.min_nosol_provisions, n);
  }

  // required_features: { TYPE: ["key" or "keyA|keyB" alternatives, ...] } —
  // each named feature must be present (non-null after citable unwrap) on AT
  // LEAST ONE provision of the type group. Mirrors how the review page's
  // mini-tables resolve rows by scanning across provisions.
  if (golden.required_features) {
    for (const [typePrefix, keys] of Object.entries(golden.required_features)) {
      const group = provs.filter((p) => String(p.type).startsWith(typePrefix));
      for (const keySpec of keys) {
        const alts = keySpec.split('|');
        const found = group.some((p) => {
          const feats = (p.ai_metadata || {}).features || {};
          return alts.some((k) => {
            const v = unwrap(feats[k]);
            return v !== null && v !== undefined && v !== '';
          });
        });
        check(results, `${typePrefix} feature "${keySpec}" present somewhere`, found, found ? 'present' : 'MISSING');
      }
    }
  }

  // feature_code_pins: { TYPE: { featureKey: "EXPECTED_CODE" } } — pins the
  // canonical code of a coded (tagged) feature. Written for codebook rollouts
  // that change FUTURE extraction only: while no provision of the type group
  // carries the feature yet (pre-re-extract), the pin passes as "armed"; the
  // moment any provision carries a non-null value, every occurrence must
  // resolve to the pinned code. Accepts tagged {code,label,text} objects,
  // bare code strings, and citable-wrapped values.
  if (golden.feature_code_pins) {
    for (const [typePrefix, pins] of Object.entries(golden.feature_code_pins)) {
      const group = provs.filter((p) => String(p.type).startsWith(typePrefix));
      for (const [key, expected] of Object.entries(pins)) {
        const codes = [];
        for (const p of group) {
          const v = unwrap(((p.ai_metadata || {}).features || {})[key]);
          if (v === null || v === undefined || v === '') continue;
          const code = typeof v === 'object' ? v.code : v;
          if (code) codes.push(String(code).trim().toUpperCase());
        }
        if (codes.length === 0) {
          check(results, `${typePrefix} "${key}" pinned to ${expected}`, true, 'not yet extracted (pin armed)');
        } else {
          const ok = codes.every((c) => c === expected);
          check(results, `${typePrefix} "${key}" pinned to ${expected}`, ok, codes.join(', '));
        }
      }
    }
  }

  if (golden.max_schema_error_rows !== undefined) {
    let errRows = 0;
    for (const p of provs) if (validateProvisionRow(p).errors.length) errRows += 1;
    check(results, `schema-error rows ≤ ${golden.max_schema_error_rows}`, errRows <= golden.max_schema_error_rows, errRows);
  }

  return results;
}

async function main() {
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
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = {
  carveoutCount,
  evalDeal,
  selectMaeDefinition,
};
