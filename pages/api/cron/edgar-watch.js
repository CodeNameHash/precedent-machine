import { getServiceSupabase } from '../../../lib/supabase.js';
import { discoverEdgarCandidates } from '../../../lib/edgar-catalog.js';

export const config = {
  maxDuration: 300,
};

export const DEFAULT_DAYS = 7;
export const MAX_DAYS = 30;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export function authorised(req, secret = process.env.CRON_SECRET) {
  if (!secret) return false;
  const header = req.headers.authorization || '';
  return header === `Bearer ${secret}`;
}

function boundedPositiveInteger(rawValue, fallback, maximum) {
  const value = rawValue == null || rawValue === '' ? fallback : Number(rawValue);
  if (!Number.isInteger(value) || value <= 0 || value > maximum) return null;
  return value;
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

    const days = boundedPositiveInteger(
      req.query?.days ?? process.env.EDGAR_WATCH_DAYS,
      DEFAULT_DAYS,
      MAX_DAYS,
    );
    const limit = boundedPositiveInteger(
      req.query?.limit ?? process.env.EDGAR_WATCH_LIMIT,
      DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    if (days == null || limit == null) {
      return res.status(400).json({
        error: `days must be 1-${MAX_DAYS} and limit must be 1-${MAX_LIMIT}`,
      });
    }

    const sb = getSupabase();
    if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

    try {
      const result = await discoverCandidates({
        days,
        limit,
        supabase: sb,
      });
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}

export default createEdgarWatchHandler();
