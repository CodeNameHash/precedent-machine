// GET /api/corpus-stats — corpus-wide context for one provision code.
// Powers the review page's reader sidebar: prevalence ("31 of 38 deals"),
// common feature values, and the peer-deal list, refinable by deal facts.
//
// Cheap by design: provision_cards is ~6k rows and claims ~70k; both hits
// are indexed single-column filters, the group-by happens here, and the
// response is a small summary (not row dumps). The corpus only changes on
// re-extract/correction, so the response is edge-cacheable; `v` (any
// version/cache-bust token, e.g. an extraction-run stamp) just varies the
// cache key.
import { getServiceSupabase } from '../../lib/supabase';

const CACHE = 's-maxage=3600, stale-while-revalidate=86400';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dealPassesFilters(deal, { sector, yearFrom, yearTo, minValue, maxValue }) {
  if (sector && String(deal.sector || '') !== sector) return false;
  const year = deal.announce_date ? Number(String(deal.announce_date).slice(0, 4)) : null;
  if (yearFrom && (!year || year < yearFrom)) return false;
  if (yearTo && (!year || year > yearTo)) return false;
  const value = num(deal.value_usd);
  if (minValue && (!value || value < minValue)) return false;
  if (maxValue && (!value || value > maxValue)) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'code is required' });

  const filters = {
    sector: req.query.sector ? String(req.query.sector) : null,
    yearFrom: num(req.query.yearFrom),
    yearTo: num(req.query.yearTo),
    minValue: num(req.query.minValue),
    maxValue: num(req.query.maxValue),
  };

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const [{ data: deals, error: dealsErr }, { data: cards, error: cardsErr }] = await Promise.all([
      sb.from('deals').select('id, acquirer, target, sector, value_usd, announce_date, metadata'),
      sb.from('provision_cards').select('deal_id, provision_subtype, short_title, section_ref').eq('provision_subtype', code),
    ]);
    if (dealsErr) throw new Error(dealsErr.message);
    if (cardsErr) throw new Error(cardsErr.message);

    const stagingFree = (deals || []).filter((d) => !(d.metadata && d.metadata.ingest_status === 'staging'));
    const peerSet = stagingFree.filter((d) => dealPassesFilters(d, filters));
    const peerIds = new Set(peerSet.map((d) => d.id));
    const dealsWithCode = new Set((cards || []).map((c) => c.deal_id).filter((id) => peerIds.has(id)));

    // Feature-value summary: canonical claim values on this code's cards,
    // grouped attribute → value counts. Bounded fetch; codes rarely exceed
    // a few hundred claims corpus-wide.
    const { data: claims, error: claimsErr } = await sb
      .from('claims')
      .select('deal_id, attribute, canonical')
      .eq('provenance->>code', code)
      .not('canonical', 'is', null)
      .limit(4000);
    if (claimsErr) throw new Error(claimsErr.message);

    const byAttribute = new Map();
    for (const cl of claims || []) {
      if (!peerIds.has(cl.deal_id)) continue;
      if (!byAttribute.has(cl.attribute)) byAttribute.set(cl.attribute, new Map());
      const values = byAttribute.get(cl.attribute);
      values.set(cl.canonical, (values.get(cl.canonical) || 0) + 1);
    }
    const featureSummary = [...byAttribute.entries()]
      .map(([attribute, values]) => ({
        attribute,
        values: [...values.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([value, count]) => ({ value, count })),
        total: [...values.values()].reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const peers = peerSet
      .filter((d) => dealsWithCode.has(d.id))
      .sort((a, b) => String(b.announce_date || '').localeCompare(String(a.announce_date || '')))
      .slice(0, 8)
      .map((d) => ({
        deal_id: d.id,
        acquirer: d.acquirer,
        target: d.target,
        sector: d.sector,
        value_usd: d.value_usd,
        announce_date: d.announce_date,
      }));

    const sectors = [...new Set(stagingFree.map((d) => d.sector).filter(Boolean))].sort();

    res.setHeader('Cache-Control', CACHE);
    return res.status(200).json({
      code,
      peerSetSize: peerSet.length,
      dealsWithCode: dealsWithCode.size,
      featureSummary,
      peers,
      sectors,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
