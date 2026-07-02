/**
 * extract-type.js — Phase 3+5 for a SINGLE provision type.
 *
 * Thin HTTP wrapper. The orchestration itself lives in
 * lib/parser-v2/run-extract.js (CommonJS) so the local runner
 * (scripts/extract-local.js) can run the identical phase through the
 * subscription-backed CLI clients instead of the metered API.
 *
 * Input: POST { deal_id, type }
 *   - type is a canonical provision type ('REP-T', 'IOC', 'DEF', etc.)
 */

import { getAnthropic } from '../../../lib/anthropic';
import { getServiceSupabase } from '../../../lib/supabase';

const { runExtractTypePhase, markExtractFailed } = require('../../../lib/parser-v2/run-extract');

export const config = {
  maxDuration: 300,
  api: { bodyParser: { sizeLimit: '50mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { deal_id, type } = req.body || {};
  if (!deal_id || !type) {
    return res.status(400).json({ error: 'deal_id and type are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const client = getAnthropic();

  try {
    const result = await runExtractTypePhase({ dealId: deal_id, type, sb, client });
    return res.status(200).json({
      success: true,
      deal_id,
      ...result,
    });
  } catch (err) {
    console.error('[ingest/extract-type] error:', err);
    await markExtractFailed(sb, deal_id, type, err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      deal_id,
      type,
      error: err.message || 'Extract failed',
    });
  }
}

export { runExtractTypePhase, markExtractFailed };
