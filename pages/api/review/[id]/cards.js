import { getServiceSupabase } from '../../../../lib/supabase';
import { fetchReviewDealCards } from '../../../../lib/queries/review-deal';

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

  const sb = getServiceSupabase();
  if (!sb) return fail(res, 500, 'Supabase not configured');

  try {
    const reviewDeal = await fetchReviewDealCards(dealId, sb);
    return res.status(200).json({ reviewDeal });
  } catch (error) {
    return fail(res, 500, error.message || String(error));
  }
}
