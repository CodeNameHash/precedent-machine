import { getServiceSupabase } from '../../lib/supabase';
const { fetchHomeData } = require('../../lib/home-data');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const payload = await fetchHomeData(sb);

    // F4: this endpoint is not user-personalized — let the Vercel CDN cache
    // it and revalidate in the background instead of hitting Supabase cold
    // on every request. No cookies/auth/headers influence the response (the
    // service-role client reads the same public rows for every caller), so
    // it's safe to cache at the edge without a Vary header.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'home failed' });
  }
}
