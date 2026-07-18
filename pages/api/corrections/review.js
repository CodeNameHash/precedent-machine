// POST /api/corrections/review — Approve/Reject actions for
// pages/corrections-review.js (the weekly review queue).
// Spec: docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md.
//
// Body: { id, action: 'approve' | 'reject', note? }
// Header: x-editor-key (required — both actions need an approved editor)

import { getServiceSupabase } from '../../../lib/supabase';
import { handleReviewAction } from '../../../lib/corrections/review';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const editorKeyHeader = req.headers['x-editor-key'];
  const result = await handleReviewAction(sb, req.body, { editorKeyHeader });

  const { httpStatus, ...payload } = result;
  return res.status(httpStatus).json(payload);
}
