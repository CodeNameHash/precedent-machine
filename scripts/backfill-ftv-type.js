#!/usr/bin/env node
/*
 * backfill-ftv-type.js — copy the force-the-vote strength codebook from the
 * CLAIMS layer into provisions.ai_metadata.features so the QUERY engine can
 * see it.
 *
 * Why: the FTV codebook (forceTheVoteType: FTV_HARD / FTV_SOFT / FTV_NONE,
 * Ben-gated taxonomy in lib/taxonomy.js) was written to claims only. The
 * query engine reads provisions.ai_metadata (lib/query/context), so
 * `forceTheVoteType` had zero corpus coverage on the query surface —
 * /api/query/field-options returned no options and FILTER_THEN_LIST matched
 * nothing. This copies the verified claims values across. Deterministic
 * placement, no LLM calls.
 *
 * Placement per deal (first match wins):
 *   1. the NOSOL provision whose full_text CONTAINS the deal's
 *      forceTheVoteDetails verbatim slice (whitespace-normalized, first 100
 *      chars) — the clause the codebook was coded FROM;
 *   2. the NOSOL provision already carrying features.forceTheVote === true;
 *   3. otherwise SKIP with a warning (never guess).
 *
 * Usage:
 *   node scripts/backfill-ftv-type.js            # dry run (default): prints plan
 *   node scripts/backfill-ftv-type.js --apply    # writes ai_metadata updates
 *
 * Requires SUPABASE env (.env.local) with the service key.
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

const APPLY = process.argv.includes('--apply');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();


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

  const { data: claims, error: cErr } = await sb
    .from('claims')
    .select('deal_id, attribute, canonical, verbatim, provenance')
    .in('attribute', ['forceTheVoteType', 'forceTheVoteDetails']);
  if (cErr) throw new Error(cErr.message);

  const byDeal = new Map();
  for (const cl of claims || []) {
    if (!byDeal.has(cl.deal_id)) byDeal.set(cl.deal_id, {});
    const slot = byDeal.get(cl.deal_id);
    const fv = cl.provenance && typeof cl.provenance === 'object' ? cl.provenance.feature_value : null;
    if (cl.attribute === 'forceTheVoteType') {
      slot.type = fv && typeof fv === 'object' ? fv : (cl.canonical ? { code: cl.canonical } : null);
    } else {
      slot.details = (fv && typeof fv === 'object' ? fv.text : null) || cl.verbatim || null;
    }
  }
  console.log(`deals with forceTheVoteType claims: ${[...byDeal.values()].filter((s) => s.type).length}`);

  const provisions = await fetchAllRows(sb
    .from('provisions')
    .select('id, deal_id, type, category, full_text, ai_metadata')
    .in('deal_id', [...byDeal.keys()])
    .order('id'));
  console.log(`provisions loaded: ${provisions.length}`);

  const NOSOL_RE = /no[\s_-]*sol|NOSOL|COVENANT_NO_SOLICITATION/i;
  const plan = [];
  for (const [dealId, slot] of byDeal.entries()) {
    if (!slot.type) continue;
    const dealProvisions = (provisions || []).filter((p) => p.deal_id === dealId && (NOSOL_RE.test(String(p.type || '')) || NOSOL_RE.test(String(p.category || ''))));
    if (!dealProvisions.length) { console.warn(`SKIP ${dealId}: no NOSOL provisions`); continue; }
    const needle = slot.details ? norm(slot.details).slice(0, 100) : null;
    let target = needle ? dealProvisions.find((p) => norm(p.full_text).includes(needle)) : null;
    let via = target ? 'details-containment' : null;
    if (!target) {
      target = dealProvisions.find((p) => {
        let meta = p.ai_metadata;
        if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { return false; } }
        return meta && meta.features && meta.features.forceTheVote === true;
      });
      via = target ? 'forceTheVote-flag' : null;
    }
    if (!target) { console.warn(`SKIP ${dealId}: no placement (no details containment, no forceTheVote flag)`); continue; }
    plan.push({ dealId, provisionId: target.id, via, code: slot.type.code, details: slot.details ? `${norm(slot.details).slice(0, 60)}…` : null });
  }

  console.log(`\nplanned writes: ${plan.length}${APPLY ? ' (APPLYING)' : ' (dry run — pass --apply to write)'}`);
  for (const p of plan) console.log(`  ${p.dealId} -> provision ${p.provisionId} [${p.via}] ${p.code}`);

  if (!APPLY) return;
  for (const p of plan) {
    const row = (provisions || []).find((x) => x.id === p.provisionId);
    let meta = row.ai_metadata;
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
    meta = meta && typeof meta === 'object' ? meta : {};
    meta.features = meta.features && typeof meta.features === 'object' ? meta.features : {};
    const slot = byDeal.get(p.dealId);
    meta.features.forceTheVoteType = slot.type;
    if (slot.details && !meta.features.forceTheVoteDetails) meta.features.forceTheVoteDetails = slot.details;
    const { error } = await sb.from('provisions').update({ ai_metadata: meta }).eq('id', p.provisionId);
    if (error) { console.error(`WRITE FAIL ${p.provisionId}: ${error.message}`); process.exit(1); }
    console.log(`  wrote ${p.provisionId}`);
  }
  console.log('done — verify with: /api/query/field-options?provision_type=COVENANT_NO_SOLICITATION (forceTheVoteType should list options)');
}

main().catch((e) => { console.error(e); process.exit(1); });
