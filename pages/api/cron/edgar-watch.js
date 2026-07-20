import { getServiceSupabase } from '../../../lib/supabase.js';
import { discoverEdgarCandidates } from '../../../lib/edgar-catalog.js';

export const config = {
  maxDuration: 300,
};

export function authorised(req, secret = process.env.CRON_SECRET) {
  if (!secret) return false;
  const header = req.headers.authorization || '';
  return header === `Bearer ${secret}`;
}

export function createEdgarWatchHandler({
  getSupabase = getServiceSupabase,
  discoverCandidates = discoverEdgarCandidates,
  getCronSecret = () => process.env.CRON_SECRET,
} = {}) {
  return async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) {
      return res.status(405).json({ error: 'GET or POST only' });
    }
    if (!authorised(req, getCronSecret())) {
      return res.status(401).json({ error: 'Unauthorised' });
    }

    const sb = getSupabase();
    if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

    const days = Number(req.query?.days || process.env.EDGAR_WATCH_DAYS || 7);
    const limit = req.query?.limit || process.env.EDGAR_WATCH_LIMIT;

    try {
      const result = await discoverCandidates({
        days: Number.isFinite(days) && days > 0 ? days : 7,
        limit: limit ? Number(limit) : null,
        supabase: sb,
      });
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}

export default createEdgarWatchHandler();
