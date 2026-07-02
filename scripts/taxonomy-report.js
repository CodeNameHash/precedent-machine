#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/taxonomy-report.js — systematize categorization visibility.
   ───────────────────────────────────────────────────────────────────────────
   Prints, from live data:
     • the corpus-derived expected set per section type (core/common/rare), and
     • per deal, the expected-set coverage (present / missing-core) and the
       "extra" non-canonical categories, plus
     • the corpus-wide taxonomy-growth queue (recurring non-canonical categories
       to promote into the rubric — human-gated).

   Usage: node scripts/taxonomy-report.js [--deal <name>]
   Read-only. Creds from env/.env.local.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  computeExpectedSets, analyzeDealCoverage, analyzeCorpusTaxonomy, familyType,
} = require('../lib/expected-sets');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

(async () => {
  loadDotEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Supabase creds required.'); process.exit(1); }
  const sb = createClient(url, key);

  const { data: deals } = await sb.from('deals').select('id, acquirer, target');
  const { data: provisions } = await sb.from('provisions').select('deal_id, type, category, ai_metadata');
  const dealName = (id) => { const d = (deals || []).find((x) => x.id === id); return d ? `${d.acquirer} / ${d.target}` : id; };

  const registry = computeExpectedSets(provisions || []);
  const corpus = analyzeCorpusTaxonomy(provisions || [], registry);

  console.log('═══ EXPECTED-SET REGISTRY (corpus-derived, curated overrides marked *) ═══');
  for (const [type, list] of Object.entries(registry)) {
    const core = list.filter((x) => x.importance === 'core');
    if (!core.length) continue;
    console.log(`\n${type}  — core (${core.length}):`);
    for (const it of core) console.log(`  ${it.curated ? '*' : ' '} ${it.code.padEnd(22)} ${Math.round(it.dealFraction * 100)}% of deals  ${it.label}`);
  }

  const only = process.argv.includes('--deal') ? process.argv[process.argv.indexOf('--deal') + 1] : null;
  console.log('\n═══ PER-DEAL EXPECTED-SET COVERAGE ═══');
  for (const d of deals || []) {
    if (only && !`${d.acquirer} ${d.target}`.toLowerCase().includes(only.toLowerCase())) continue;
    const dp = (provisions || []).filter((p) => p.deal_id === d.id);
    const cov = analyzeDealCoverage(dp, registry);
    const missingCore = [];
    for (const [type, r] of Object.entries(cov.byType)) {
      for (const m of r.missing) if (m.importance === 'core') missingCore.push(`${type}:${m.label}`);
    }
    console.log(`\n${d.acquirer} / ${d.target}`);
    console.log(`  missing core (${missingCore.length}): ${missingCore.slice(0, 12).join(' · ') || 'none'}`);
    console.log(`  extra / non-canonical: ${cov.extra.length}`);
  }

  console.log('\n═══ TAXONOMY-GROWTH QUEUE (recurring non-canonical categories → promote?) ═══');
  for (const c of corpus.promotionCandidates.slice(0, 15)) {
    console.log(`  ${String(c.count).padStart(3)}×  [${c.type}] ${c.category}`);
  }
  if (!corpus.promotionCandidates.length) console.log('  (none — every provision maps to a canonical code)');
})().catch((e) => { console.error(e.message); process.exit(1); });
