import { getServiceSupabase } from '../../lib/supabase.js';
import { sendBroadCorpusRouteContained } from '../../lib/broad-corpus-containment.js';

export function createCommentsHandler({ getSupabase = getServiceSupabase } = {}) {
  return async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (req.method === 'POST') return sendBroadCorpusRouteContained(res);

    const { annotation_id } = req.query;
    if (!annotation_id) return res.status(400).json({ error: 'annotation_id required' });

    const sb = getSupabase();
    if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

    const { data, error } = await sb.from('comments')
      .select('*, user:users(name)')
      .eq('annotation_id', annotation_id)
      .order('created_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ comments: data });
  };
}

export default createCommentsHandler();
