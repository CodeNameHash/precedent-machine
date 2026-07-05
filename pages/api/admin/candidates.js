import { getServiceSupabase } from '../../../lib/supabase';

const VALID_STATUSES = new Set(['pending', 'queued', 'ingested', 'skipped', 'needs_review', 'error']);

function cleanLimit(value) {
  const n = Number(value || 100);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(n, 500);
}

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const limit = cleanLimit(req.query.limit);
    const status = typeof req.query.status === 'string' ? req.query.status : '';

    let query = sb.from('deal_candidates')
      .select('*')
      .order('filing_date', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const { data: statsRows, error: statsError } = await sb
      .from('deal_candidates')
      .select('status');
    if (statsError) return res.status(500).json({ error: statsError.message });

    const stats = {};
    for (const row of statsRows || []) {
      stats[row.status] = (stats[row.status] || 0) + 1;
    }

    return res.json({ candidates: data || [], stats });
  }

  if (req.method === 'PATCH') {
    const { id, status, skip_reason, ingested_deal_id, review_notes, last_error } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (status && !VALID_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });

    const updates = {};
    if (status) updates.status = status;
    if (skip_reason !== undefined) updates.skip_reason = skip_reason || null;
    if (ingested_deal_id !== undefined) updates.ingested_deal_id = ingested_deal_id || null;
    if (review_notes !== undefined) updates.review_notes = review_notes || null;
    if (last_error !== undefined) updates.last_error = last_error || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates supplied' });
    }

    const { data, error } = await sb.from('deal_candidates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ candidate: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
