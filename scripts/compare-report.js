#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/compare-report.js — prove the general comparison engine on live data.
   ───────────────────────────────────────────────────────────────────────────
   Prints, from the live corpus:
     • comparableFeatures() — the schema-derived catalog of every distributable
       feature per provision type (with the current-cohort n each), and
     • a few SAMPLE distributions that show the different kinds working:
         - REP-T materialityQualifier   (coded / taxonomy)
         - IOC   permittedExceptions    (set membership)
         - ANTI  effortsStandard        (enum, ordinal)
       plus a materiality-outliers pass demonstrating the n<12 guardrail.

   The corpus is thin today (a few deals) — that's expected. The point is the
   machinery is correct and lights up as deals accumulate. Everything is
   recomputed dynamically; pass --sector <x> to re-scope the cohort.

   Usage: node scripts/compare-report.js [--sector pharma]
   Read-only. Creds from env/.env.local. Mirrors scripts/taxonomy-report.js.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  comparableFeatures, compareFeature, cohortFeatureStats, featureOutliers,
} = require('../lib/feature-compare');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function truncate(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function printDistribution(dist) {
  console.log(`  ${dist.label}  [${dist.type} · ${dist.featureKey} · ${dist.kind}]`);
  console.log(`  cohort n = ${dist.n} deal(s) with a cited datapoint (cohortSize=${dist.cohortSize})`);
  if (dist.kind === 'numeric') {
    console.log(`    median=${dist.median}  IQR=[${dist.q1}, ${dist.q3}]  min=${dist.min}  max=${dist.max}  (count=${dist.count})`);
    return;
  }
  if (!dist.distribution.length) { console.log('    (no cited datapoints)'); return; }
  for (const b of dist.distribution) {
    const key = b.value !== undefined ? b.value : b.code;
    console.log(`    ▸ ${truncate(b.label, 40).padEnd(40)} ${key === undefined ? '' : `[${key}] `}count=${b.count} dealFraction=${b.dealFraction}`);
    const pt = (b.points || [])[0];
    if (pt) console.log(`        e.g. ${pt.target || pt.deal_id}: “${truncate(pt.quotes[0], 120)}”`);
  }
}

(async () => {
  loadDotEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Supabase creds required.'); process.exit(1); }
  const sb = createClient(url, key);

  const sector = process.argv.includes('--sector') ? process.argv[process.argv.indexOf('--sector') + 1] : null;
  const filters = sector ? { sector } : {};

  const { data: deals } = await sb.from('deals').select('id, acquirer, target, sector, value_usd, announce_date');
  const { data: provisions } = await sb.from('provisions').select('id, deal_id, type, category, full_text, ai_metadata');

  console.log('═══ COMPARABLE FEATURES (schema-derived catalog, cohort n annotated) ═══');
  console.log(`corpus: ${(deals || []).length} deal(s), ${(provisions || []).length} provision(s)${sector ? ` · cohort sector=${sector}` : ''}\n`);
  const catalog = comparableFeatures();
  const stats = cohortFeatureStats(provisions || [], deals || [], { filters });
  const nByKey = new Map(stats.map((s) => [`${s.type}::${s.featureKey}`, s.n]));
  for (const [type, feats] of Object.entries(catalog)) {
    const withData = feats.filter((f) => (nByKey.get(`${type}::${f.key}`) || 0) > 0);
    const kinds = feats.reduce((acc, f) => { acc[f.kind] = (acc[f.kind] || 0) + 1; return acc; }, {});
    const kindStr = Object.entries(kinds).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`  ${type.padEnd(9)} ${String(feats.length).padStart(2)} comparable (${kindStr})  — ${withData.length} populated in cohort`);
  }

  const samples = [
    { type: 'REP-T', featureKey: 'materialityQualifier' },
    { type: 'IOC', featureKey: 'permittedExceptions' },
    { type: 'ANTI', featureKey: 'effortsStandard' },
  ];
  console.log('\n═══ SAMPLE DISTRIBUTIONS (dynamic over the cohort) ═══');
  for (const s of samples) {
    console.log('');
    try {
      const dist = compareFeature(provisions || [], deals || [], { ...s, filters });
      printDistribution(dist);
    } catch (e) {
      console.log(`  ${s.type} · ${s.featureKey}: ${e.message}`);
    }
  }

  console.log('\n═══ MATERIALITY OUTLIERS — per deal vs cohort (n<12 guardrail active) ═══');
  for (const d of deals || []) {
    const dp = (provisions || []).filter((p) => p.deal_id === d.id);
    const outliers = featureOutliers(dp, stats.filter((x) => x.featureKey === 'materialityQualifier'), {});
    if (!outliers.length) continue;
    console.log(`\n${d.acquirer} / ${d.target}`);
    for (const o of outliers) {
      const verdict = o.offMarket ? 'OFF-MARKET' : `differs from ${o.differsFrom} of ${o.ofDeals} in cohort (info only, n<12)`;
      console.log(`  ${o.label}: this deal=${o.dealLabel} vs mode=${o.modeLabel} → ${verdict}`);
    }
  }
  console.log('');
})().catch((e) => { console.error(e.message); process.exit(1); });
