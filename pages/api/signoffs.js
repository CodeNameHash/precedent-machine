import { getServiceSupabase } from '../../lib/supabase.js';
import { sendBroadCorpusRouteContained } from '../../lib/broad-corpus-containment.js';

export function createSignoffsHandler({ getSupabase = getServiceSupabase } = {}) {
  return async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (req.method === 'POST') return sendBroadCorpusRouteContained(res);

    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id required' });
    }

    const sb = getSupabase();
    if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

    const { data, error } = await sb.from('signoffs')
      .select('*, user:users(name)')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .order('created_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ signoffs: data });
  };
}

export default createSignoffsHandler();
