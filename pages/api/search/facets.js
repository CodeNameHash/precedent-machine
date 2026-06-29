/* ─────────────────────────────────────────────────────────────────────────
   GET /api/search/facets — filter chips for cross-deal search.
   ───────────────────────────────────────────────────────────────────────────
   Returns the distinct provision types (grouped into families), canonical
   codes (with human labels), categories, and deals present in the corpus, each
   with a count, so the search UI can render filter chips without a second pass.
   The corpus is small (hundreds–low-thousands of provisions) so we select only
   the lightweight columns and aggregate in JS. Optionally scope to ?deal_id=.
   ───────────────────────────────────────────────────────────────────────── */
import { getServiceSupabase } from '../../../lib/supabase';
import { toList } from '../../../lib/search';

let CODES = {};
try {
  // Canonical code → label, for enriching the code facet. Best-effort: if the
  // rubric shape changes the facet still returns codes, just without labels.
  CODES = require('../../../lib/rubric').CODES || {};
} catch {
  CODES = {};
}

function bump(map, key) {
  if (key == null || key === '') return;
  map.set(key, (map.get(key) || 0) + 1);
}

// Collapse a per-party type to its family base: REP-T → REP, COND-M → COND.
function familyBase(type) {
  if (!type) return type;
  const i = type.indexOf('-');
  return i > 0 ? type.slice(0, i) : type;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const dealIds = toList(req.query.deal_id || req.query.deals);

  let q = sb.from('provisions').select('type, category, deal_id, code:ai_metadata->>code');
  if (dealIds.length) q = q.in('deal_id', dealIds);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  const rows = data || [];
  const types = new Map();
  const families = new Map();
  const codes = new Map();
  const categories = new Map();
  const dealCounts = new Map();

  for (const r of rows) {
    bump(types, r.type);
    bump(families, familyBase(r.type));
    bump(codes, r.code);
    bump(categories, r.category);
    bump(dealCounts, r.deal_id);
  }

  // Enrich deals with names.
  const dealIdList = [...dealCounts.keys()];
  let dealMeta = {};
  if (dealIdList.length) {
    const { data: deals } = await sb
      .from('deals')
      .select('id, acquirer, target, sector, announce_date')
      .in('id', dealIdList);
    for (const d of deals || []) dealMeta[d.id] = d;
  }

  const sortDesc = (m) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

  res.status(200).json({
    total: rows.length,
    families: sortDesc(families).map(([base, count]) => ({ base, count })),
    types: sortDesc(types).map(([type, count]) => ({ type, count, family: familyBase(type) })),
    codes: sortDesc(codes).map(([code, count]) => ({
      code,
      count,
      label: (CODES[code] && CODES[code].label) || null,
    })),
    categories: sortDesc(categories).map(([category, count]) => ({ category, count })),
    deals: sortDesc(dealCounts).map(([id, count]) => ({
      id,
      count,
      acquirer: dealMeta[id]?.acquirer || null,
      target: dealMeta[id]?.target || null,
      sector: dealMeta[id]?.sector || null,
      announce_date: dealMeta[id]?.announce_date || null,
    })),
  });
}
