// POST /api/corrections/submit — Correct-tab submission endpoint.
// Spec: docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md.
//
// Body: { card_id, provision_id, deal_id, target: {kind, claim_attribute?},
//         proposed, rationale, submitted_by? }
// Header: x-editor-key (optional)
//
// Thin route wrapper — all logic lives in lib/corrections/submit.js so it
// can be unit-tested against a mock Supabase client without any network or
// database access.

import { getServiceSupabase } from '../../../lib/supabase';
import { handleCorrectionSubmission } from '../../../lib/corrections/submit';

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const editorKeyHeader = req.headers['x-editor-key'];
  const result = await handleCorrectionSubmission(sb, req.body, { editorKeyHeader, ip: clientIp(req) });

  const { httpStatus, ...payload } = result;
  return res.status(httpStatus).json(payload);
}
