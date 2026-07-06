import { getServiceSupabase } from '../../lib/supabase';
import * as schemaCoverage from '../../lib/schema/coverage';

const PAGE_SIZE = 1000;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function fail(res, status, error) {
  return res.status(status).json({ error });
}

function parseLimit(value) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

function isStagingDeal(deal) {
  const metadata = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return metadata.ingest_status === 'staging';
}

async function fetchAllPages(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || String(error));
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'GET only');
  }

  const sb = getServiceSupabase();
  if (!sb) return fail(res, 500, 'Supabase not configured');

  const limit = parseLimit(req.query.limit);
  const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
  const dealId = Array.isArray(req.query.deal_id) ? req.query.deal_id[0] : req.query.deal_id;

  try {
    const deals = await fetchAllPages(() => {
      let q = sb.from('deals').select('id, acquirer, target, metadata').order('target', { ascending: true });
      if (dealId) q = q.eq('id', dealId);
      return q;
    });
    const liveDeals = deals.filter((deal) => !isStagingDeal(deal));
    const liveDealIds = liveDeals.map((deal) => deal.id).filter(Boolean);
    if (dealId && liveDealIds.length === 0) return fail(res, 404, 'Deal not found');

    const provisions = liveDealIds.length
      ? await fetchAllPages(() => sb
        .from('provisions')
        .select('id, deal_id, type, category, ai_metadata')
        .in('deal_id', liveDealIds)
        .order('deal_id', { ascending: true })
        .order('created_at', { ascending: true }))
      : [];

    const coverage = schemaCoverage.summarizeSchemaCoverage(provisions);
    const features = state
      ? coverage.features.filter((row) => Number(row[state]) > 0)
      : coverage.features;

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      deal_id: dealId || null,
      corpus: {
        deals: liveDeals.length,
        provisions: provisions.length,
      },
      totals: coverage.totals,
      features: features.slice(0, limit),
      pagination: {
        limit,
        returned: Math.min(limit, features.length),
        total_features: features.length,
        state: state || null,
      },
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
}
