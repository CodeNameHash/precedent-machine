// POST /api/corrections/review — Approve/Reject actions for
// pages/corrections-review.js (the weekly review queue).
// Spec: docs/archive/handoffs/CORRECT-TAB-SPEC-2026-07-17.md.
//
// Body: { id, action: 'approve' | 'reject', note? }
// Header: x-editor-key (required — both actions need an approved editor)

import { getServiceSupabase } from '../../../lib/supabase';
import { handleReviewAction } from '../../../lib/corrections/review';
const { resolveEditorKey } = require('../../../lib/corrections/editor-keys');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const editor = resolveEditorKey(req.headers['x-editor-key']);
  if (!editor) return res.status(403).json({ error: 'editor key required' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const result = await handleReviewAction(sb, req.body, { editor });

  const { httpStatus, ...payload } = result;
  return res.status(httpStatus).json(payload);
}
