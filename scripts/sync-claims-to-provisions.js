#!/usr/bin/env node
/*
 * sync-claims-to-provisions.js — generic claims → provisions.ai_metadata
 * field sync, so fields coded in the claims layer become queryable.
 *
 * Why: the corpus audit (r10, session notes) found 64 fields with ≥8-deal
 * coverage in the claims layer that the query engine cannot see, because it
 * reads provisions.ai_metadata (same failure the force-the-vote codebook
 * had — see scripts/backfill-ftv-type.js, which this generalizes).
 *
 * Discipline (same as the FTV script — never guesses):
 *   placement per deal+field, first match wins:
 *     1. the family provision whose full_text CONTAINS the claim's own
 *        evidence quote (whitespace-normalized, first 100 chars);
 *     2. the family provision already carrying the field's boolean/presence
 *        sibling (e.g. `<field minus Type/Details>` === true);
 *     3. SKIP with a warning.
 *   Existing ai_metadata values are NEVER overwritten (skip + warn on
 *   divergence) — this is additive only.
 *
 * KEY-DRIFT WARNING: some claims keys have near-miss siblings in the
 * provisions vocabulary (claims `fiduciaryOutStandard` vs provisions
 * `fiduciaryEngageStandard`/`fiduciaryFinalStandard`; claims
 * `matchingPeriod` vs provisions `subsequentMatchingPeriod`). These are
 * SEMANTICALLY DISTINCT deal points, not aliases — this script copies the
 * claims key under its own name and deliberately does NOT merge or alias
 * the pairs. Aliasing is a legal-judgment call left to Ben.
 *
 * Usage:
 *   node scripts/sync-claims-to-provisions.js                    # dry run, default field set
 *   node scripts/sync-claims-to-provisions.js --fields=a,b,c     # explicit field list
 *   node scripts/sync-claims-to-provisions.js --apply            # write
 *
 * Default field set = the top query-relevant invisible fields from the
 * audit. Requires SUPABASE env (.env.local, service key).
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
const fieldsArg = process.argv.find((a) => a.startsWith('--fields='));
const DEFAULT_FIELDS = [
  'forceTheVoteType', 'forceTheVoteDetails',
  'fiduciaryOutStandard', 'matchingPeriod', 'cureDays',
  'willfulBreachException', 'materialityStandard', 'interestRateBasis',
  'outsideDate', 'triggerEvents', 'bringDownTiers',
];
const FIELDS = fieldsArg ? fieldsArg.slice('--fields='.length).split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_FIELDS;

// Family routing: which provisions a field may land on, by claims usage.
const FAMILY_RE = {
  forceTheVoteType: /no[\s_-]*sol|NOSOL/i,
  forceTheVoteDetails: /no[\s_-]*sol|NOSOL/i,
  fiduciaryOutStandard: /no[\s_-]*sol|NOSOL/i,
  matchingPeriod: /no[\s_-]*sol|NOSOL/i,
  cureDays: /TERM/i,
  willfulBreachException: /TERM|FEE/i,
  materialityStandard: /TERM/i,
  interestRateBasis: /TERM|FEE/i,
  outsideDate: /TERM/i,
  triggerEvents: /TERM|FEE/i,
  bringDownTiers: /COND/i,
};

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function claimPayload(cl) {
  const fv = cl.provenance && typeof cl.provenance === 'object' ? cl.provenance.feature_value : null;
  if (fv !== null && fv !== undefined) return fv;
  if (cl.canonical !== null && cl.canonical !== undefined) return cl.canonical;
  return cl.verbatim || null;
}

function claimQuote(cl) {
  const fv = cl.provenance && typeof cl.provenance === 'object' ? cl.provenance.feature_value : null;
  if (fv && typeof fv === 'object') {
    if (Array.isArray(fv.quotes) && fv.quotes[0]) return String(fv.quotes[0]);
    if (typeof fv.text === 'string' && fv.text.trim()) return fv.text;
  }
  return cl.evidence_quote || cl.verbatim || null;
}


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
  console.log(`fields: ${FIELDS.join(', ')}`);

  const claims = await fetchAllRows(sb
    .from('claims')
    .select('deal_id, attribute, canonical, verbatim, evidence_quote, provenance')
    .in('attribute', FIELDS)
    .order('id'));
  console.log(`claims rows: ${(claims || []).length}`);

  const dealIds = [...new Set((claims || []).map((c) => c.deal_id))];
  const provisions = await fetchAllRows(sb
    .from('provisions')
    .select('id, deal_id, type, category, full_text, ai_metadata')
    .in('deal_id', dealIds)
    .order('id'));
  console.log(`provisions loaded: ${provisions.length}`);

  const metaOf = (p) => {
    let m = p.ai_metadata;
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch { m = {}; } }
    return m && typeof m === 'object' ? m : {};
  };

  const plan = [];
  const skips = [];
  const byDealField = new Map();
  for (const cl of claims || []) {
    const key = `${cl.deal_id}|${cl.attribute}`;
    if (!byDealField.has(key)) byDealField.set(key, cl); // one claim per deal+field (first)
  }

  for (const [key, cl] of byDealField.entries()) {
    const [dealId, field] = key.split('|');
    const famRe = FAMILY_RE[field] || /./;
    const fam = (provisions || []).filter((p) => p.deal_id === dealId && (famRe.test(String(p.type || '')) || famRe.test(String(p.category || ''))));
    if (!fam.length) { skips.push(`${dealId} ${field}: no family provisions`); continue; }
    const quote = claimQuote(cl);
    const needle = quote ? norm(quote).slice(0, 100) : null;
    let target = needle ? fam.find((p) => norm(p.full_text).includes(needle)) : null;
    let via = target ? 'quote-containment' : null;
    if (!target) {
      const presenceKey = field.replace(/(Type|Details)$/, '');
      target = fam.find((p) => {
        const feats = metaOf(p).features || {};
        const v = feats[presenceKey];
        return v === true || (v && typeof v === 'object' && v.value === true);
      });
      via = target ? 'presence-sibling' : null;
    }
    if (!target) { skips.push(`${dealId} ${field}: no placement`); continue; }
    const existing = (metaOf(target).features || {})[field];
    if (existing !== undefined) {
      const same = JSON.stringify(existing) === JSON.stringify(claimPayload(cl));
      if (!same) skips.push(`${dealId} ${field}: EXISTS with DIFFERENT value on ${target.id} — not overwriting`);
      continue;
    }
    plan.push({ dealId, field, provisionId: target.id, via, value: claimPayload(cl) });
  }

  console.log(`\nplanned writes: ${plan.length}${APPLY ? ' (APPLYING)' : ' (dry run — pass --apply to write)'}`);
  for (const p of plan) console.log(`  ${p.dealId} ${p.field} -> ${p.provisionId} [${p.via}]`);
  if (skips.length) { console.log(`\nskips (${skips.length}):`); for (const sMsg of skips) console.log(`  ${sMsg}`); }

  if (!APPLY) return;
  // group writes per provision so ai_metadata is read-modify-written once
  const byProvision = new Map();
  for (const p of plan) {
    if (!byProvision.has(p.provisionId)) byProvision.set(p.provisionId, []);
    byProvision.get(p.provisionId).push(p);
  }
  for (const [provisionId, entries] of byProvision.entries()) {
    const row = (provisions || []).find((x) => x.id === provisionId);
    const meta = metaOf(row);
    meta.features = meta.features && typeof meta.features === 'object' ? meta.features : {};
    for (const e of entries) meta.features[e.field] = e.value;
    const { error } = await sb.from('provisions').update({ ai_metadata: meta }).eq('id', provisionId);
    if (error) { console.error(`WRITE FAIL ${provisionId}: ${error.message}`); process.exit(1); }
    console.log(`  wrote ${provisionId} (${entries.map((e) => e.field).join(', ')})`);
  }
  console.log('done — verify via /api/query/field-options per provision type.');
}

main().catch((e) => { console.error(e); process.exit(1); });
