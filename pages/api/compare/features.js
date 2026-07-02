/* ─────────────────────────────────────────────────────────────────────────
   GET /api/compare/features — GENERAL, DYNAMIC cross-deal feature comparison.
   ───────────────────────────────────────────────────────────────────────────
     (no type/featureKey)      → INDEX of comparable features per provision
                                 type, with the cohort `n` for each.
     ?type=REP-T&featureKey=materialityQualifier
                               → the DISTRIBUTION for that feature over the
                                 selected cohort (with per-point quotes +
                                 provision_id for clickthrough).

   COHORT (fully dynamic, recomputed every request — no cached global stats):
     dealIds     explicit hand-picked comparison set (comma list) — wins
     sector      e.g. pharma
     sizeBand    "<$1B" | "$1B–$10B" | ">$10B"
     year        announce year
     side        party-suffixed provision type (e.g. IOC-T, REP-B)
     code        canonical code narrowing (e.g. REP-T-IP)

   Read-only. Service-role Supabase (server side only).
   ───────────────────────────────────────────────────────────────────────── */
import { getServiceSupabase } from '../../../lib/supabase';
import {
  comparableFeatures,
  compareFeature,
  cohortFeatureStats,
} from '../../../lib/feature-compare';

const PROVISION_SELECT = 'id, deal_id, type, category, full_text, ai_metadata';
const DEAL_SELECT = 'id, acquirer, target, sector, value_usd, announce_date';

function parseCohort(q) {
  const dealIds = (q.dealIds || q.deal_ids || q.deals || '')
    .toString().split(',').map((s) => s.trim()).filter(Boolean);
  return {
    dealIds: dealIds.length ? dealIds : null,
    sector: (q.sector || '').toString().trim() || null,
    sizeBand: (q.sizeBand || q.size || '').toString().trim() || null,
    year: q.year != null && q.year !== '' ? Number(q.year) : null,
    side: (q.side || '').toString().trim() || null,
    code: (q.code || q.repCode || '').toString().trim() || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const type = (req.query.type || '').toString().trim() || null;
  const featureKey = (req.query.featureKey || req.query.feature || '').toString().trim() || null;
  const filters = parseCohort(req.query);

  try {
    // Provisions can be a large table; pull the columns the engine reads. The
    // engine filters to the requested type/family in-process (cheap grouping).
    const [{ data: deals, error: dErr }, { data: provisions, error: pErr }] = await Promise.all([
      sb.from('deals').select(DEAL_SELECT),
      sb.from('provisions').select(PROVISION_SELECT),
    ]);
    if (dErr) throw new Error(dErr.message);
    if (pErr) throw new Error(pErr.message);

    if (type && featureKey) {
      const result = compareFeature(provisions || [], deals || [], { type, featureKey, filters });
      return res.status(200).json({ mode: 'distribution', ...result });
    }

    // INDEX: comparable features per type, each annotated with the cohort n.
    const catalog = comparableFeatures();
    const stats = cohortFeatureStats(provisions || [], deals || [], { filters });
    const nByKey = new Map(stats.map((s) => [`${s.type}::${s.featureKey}`, s.n]));
    const index = {};
    for (const [t, feats] of Object.entries(catalog)) {
      index[t] = feats.map((f) => ({ ...f, n: nByKey.get(`${t}::${f.key}`) || 0 }));
    }
    return res.status(200).json({
      mode: 'index',
      dealCount: (deals || []).length,
      filters,
      features: index,
    });
  } catch (err) {
    const msg = (err && err.message) || 'feature comparison failed';
    if (/unknown provision type|not comparable/.test(msg)) return res.status(400).json({ error: msg });
    return res.status(500).json({ error: msg });
  }
}
