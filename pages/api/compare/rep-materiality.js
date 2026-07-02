/* ─────────────────────────────────────────────────────────────────────────
   GET /api/compare/rep-materiality — DEMO endpoint for the flagship
   qualitative comparison, a thin skin over the general engine.
   ───────────────────────────────────────────────────────────────────────────
   "Across the selected deals, how is each representation qualified — MAE-level,
   material-to-the-company, in-all-material-respects, or unqualified?"

     ?repCode=REP-T-IP[&side=&sector=&sizeBand=&year=&dealIds=]
                     → the materiality distribution for that rep over the cohort
     ?side=REP-B     → all buyer reps' materiality over the cohort
     (default)       → all target reps' materiality over the cohort

   This just calls compareRepMateriality (which delegates to compareFeature).
   The general endpoint is /api/compare/features. Read-only, service-role.
   ───────────────────────────────────────────────────────────────────────── */
import { getServiceSupabase } from '../../../lib/supabase';
import { compareRepMateriality } from '../../../lib/rep-materiality';

const PROVISION_SELECT = 'id, deal_id, type, category, full_text, ai_metadata';
const DEAL_SELECT = 'id, acquirer, target, sector, value_usd, announce_date';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const repCode = (req.query.repCode || req.query.code || '').toString().trim() || null;
  const side = (req.query.side || '').toString().trim() || null;
  const dealIds = (req.query.dealIds || req.query.deals || '')
    .toString().split(',').map((s) => s.trim()).filter(Boolean);
  const filters = {
    sector: (req.query.sector || '').toString().trim() || null,
    sizeBand: (req.query.sizeBand || req.query.size || '').toString().trim() || null,
    year: req.query.year != null && req.query.year !== '' ? Number(req.query.year) : null,
    dealIds: dealIds.length ? dealIds : null,
  };

  try {
    const [{ data: deals, error: dErr }, { data: provisions, error: pErr }] = await Promise.all([
      sb.from('deals').select(DEAL_SELECT),
      sb.from('provisions').select(PROVISION_SELECT).or('type.eq.REP-T,type.eq.REP-B'),
    ]);
    if (dErr) throw new Error(dErr.message);
    if (pErr) throw new Error(pErr.message);

    const result = compareRepMateriality(provisions || [], deals || [], { side, repCode, filters });
    return res.status(200).json({ mode: 'distribution', ...result });
  } catch (err) {
    const msg = (err && err.message) || 'rep-materiality comparison failed';
    if (/unknown provision type|not comparable/.test(msg)) return res.status(400).json({ error: msg });
    return res.status(500).json({ error: msg });
  }
}
