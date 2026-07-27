import { getServiceSupabase } from '../../lib/supabase';
import { diffCorrectionType, logCorrection } from '../../lib/corrections/log';
const { sendBroadCorpusRouteContained } = require('../../lib/broad-corpus-containment');

// Re-exported for backward compatibility (pages/api/provisions.js and other
// existing callers import these two names from this module). The
// implementations live in lib/corrections/log.js (CommonJS) so they can be
// required directly from tests and from other CommonJS lib/ modules — see
// that file's header comment.
export { diffCorrectionType, logCorrection };

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const query = req.query || {};
  const summary = query.summary === 'true' || query.summary === '1';
  if (req.method === 'POST' || summary || !(query.deal_id || query.provision_id)) {
    return sendBroadCorpusRouteContained(res);
  }

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
    const { deal_id, provision_id, correction_type, status, limit, summary, order } = req.query;
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
      // `status` is a newer column (supabase/corrections-status-schema.sql);
      // filter by it when the caller asks (the corrections-review page lists
      // status='pending' oldest-first via ?status=pending&order=asc).
      if (status) q = q.eq('status', status);
      q = q.order('created_at', { ascending: order === 'asc' }).limit(lim);
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
