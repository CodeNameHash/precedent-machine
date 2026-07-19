import { getServiceSupabase } from '../../../../lib/supabase';
import { fetchReviewDealCards } from '../../../../lib/queries/review-deal';
import { trimReviewDealForWire } from '../../../../lib/queries/review-deal-wire';

function fail(res, status, error) {
  return res.status(status).json({ error });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'GET only');
  }

  const dealId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!dealId) return fail(res, 400, 'deal id required');
  const rawMode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;
  const mode = rawMode === 'admin' ? 'admin' : 'user';

  const sb = getServiceSupabase();
  if (!sb) return fail(res, 500, 'Supabase not configured');

  try {
    const reviewDeal = await fetchReviewDealCards(dealId, sb, { mode });
    // Q6 (perf quick-wins): response is deal_id-scoped provision-card data,
    // identical for every viewer of this deal — no user-specific content —
    // safe to cache at the CDN edge with SWR.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    // Q1/Q2: trim sections[]/definitions[]/resolvedReferences/
    // region_full_text/full provenance off the wire — see
    // lib/queries/review-deal-wire.js for what and why.
    return res.status(200).json({ reviewDeal: trimReviewDealForWire(reviewDeal) });
  } catch (error) {
    return fail(res, 500, error.message || String(error));
  }
}
