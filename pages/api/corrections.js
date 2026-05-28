import { getServiceSupabase } from '../../lib/supabase';

/**
 * Determine the correction_type from a before/after diff.
 * Exported-ish helper used by both this route and provisions.js.
 */
export function diffCorrectionType(before, after) {
  const tracked = ['type', 'category', 'full_text', 'ai_favorability', 'features'];
  const changed = tracked.filter(k => {
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;
    // Treat null/undefined/'' as equivalent for comparison purposes
    const norm = v => (v === null || v === undefined ? '' : v);
    if (Array.isArray(b) || Array.isArray(a)) {
      return JSON.stringify(b || []) !== JSON.stringify(a || []);
    }
    if (typeof b === 'object' || typeof a === 'object') {
      return JSON.stringify(b) !== JSON.stringify(a);
    }
    return norm(b) !== norm(a);
  });

  if (changed.length === 0) return null;
  if (changed.length > 1) return 'multi_change';
  switch (changed[0]) {
    case 'type': return 'type_change';
    case 'category': return 'category_change';
    case 'full_text': return 'text_change';
    case 'ai_favorability': return 'favorability_change';
    case 'features': return 'feature_change';
    default: return 'multi_change';
  }
}

/**
 * Best-effort insert into the corrections table.
 * If the table doesn't exist (or any other error), log to console and
 * return null without throwing — Phase 1 must not break edits.
 */
export async function logCorrection(sb, payload) {
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('corrections')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.warn('[corrections] insert failed (table may not exist yet):', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[corrections] insert threw:', err?.message || err);
    return null;
  }
}

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'POST') {
    const {
      provision_id,
      deal_id,
      correction_type,
      before,
      after,
      reason,
      context,
      user_id,
    } = req.body || {};

    if (!correction_type) {
      return res.status(400).json({ error: 'correction_type is required' });
    }

    const correction = await logCorrection(sb, {
      provision_id: provision_id || null,
      deal_id: deal_id || null,
      correction_type,
      before: before || null,
      after: after || null,
      context: context || null,
      reason: reason || null,
      user_id: user_id || null,
    });

    // Always return success — even if the table doesn't exist yet,
    // we don't want to break callers in Phase 1.
    return res.json({ success: true, correction });
  }

  if (req.method === 'GET') {
    const { deal_id, provision_id, correction_type, limit, summary } = req.query;
    const lim = Math.min(parseInt(limit, 10) || 100, 1000);

    // Summary mode: aggregate stats
    if (summary === 'true' || summary === '1') {
      try {
        let q = sb.from('corrections').select('*');
        if (deal_id) q = q.eq('deal_id', deal_id);
        const { data, error } = await q;
        if (error) {
          console.warn('[corrections] summary read failed:', error.message);
          return res.json({
            total_corrections: 0,
            by_type: {},
            most_corrected_provision_types: [],
            recent: [],
          });
        }

        const rows = data || [];
        const by_type = {};
        const provTypeCounts = {};

        rows.forEach(r => {
          by_type[r.correction_type] = (by_type[r.correction_type] || 0) + 1;
          // Try to figure out what provision-type was being corrected.
          // Prefer "before.type" (the original AI classification), then "after.type".
          const pt = (r.before && r.before.type) || (r.after && r.after.type);
          if (pt) provTypeCounts[pt] = (provTypeCounts[pt] || 0) + 1;
        });

        const most_corrected_provision_types = Object.entries(provTypeCounts)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const recent = [...rows]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);

        return res.json({
          total_corrections: rows.length,
          by_type,
          most_corrected_provision_types,
          recent,
        });
      } catch (err) {
        console.warn('[corrections] summary threw:', err?.message || err);
        return res.json({
          total_corrections: 0,
          by_type: {},
          most_corrected_provision_types: [],
          recent: [],
        });
      }
    }

    // List mode
    try {
      let q = sb.from('corrections').select('*');
      if (deal_id) q = q.eq('deal_id', deal_id);
      if (provision_id) q = q.eq('provision_id', provision_id);
      if (correction_type) q = q.eq('correction_type', correction_type);
      q = q.order('created_at', { ascending: false }).limit(lim);
      const { data, error } = await q;
      if (error) {
        console.warn('[corrections] list read failed:', error.message);
        return res.json({ corrections: [] });
      }
      return res.json({ corrections: data || [] });
    } catch (err) {
      console.warn('[corrections] list threw:', err?.message || err);
      return res.json({ corrections: [] });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
