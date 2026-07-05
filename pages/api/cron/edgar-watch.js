import { getServiceSupabase } from '../../../lib/supabase';
import { discoverEdgarCandidates } from '../../../lib/edgar-catalog';

export const config = {
  maxDuration: 300,
};

function authorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.authorization || '';
  const querySecret = req.query?.secret;
  return header === `Bearer ${secret}` || querySecret === secret;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'GET or POST only' });
  }
  if (!authorised(req)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const days = Number(req.query?.days || process.env.EDGAR_WATCH_DAYS || 7);
  const limit = req.query?.limit || process.env.EDGAR_WATCH_LIMIT;

  try {
    const result = await discoverEdgarCandidates({
      days: Number.isFinite(days) && days > 0 ? days : 7,
      limit: limit ? Number(limit) : null,
      supabase: sb,
    });
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
