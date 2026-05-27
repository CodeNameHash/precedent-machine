import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { deal_id, id } = req.query;

    // Fetch by agreement_source ID directly
    if (id) {
      const { data, error } = await sb.from('agreement_sources')
        .select('id, title, full_text, metadata')
        .eq('id', id).single();
      if (error) return res.status(404).json({ error: error.message });
      return res.json({ agreement_source: data });
    }

    // Fetch by deal_id — find agreement_source_id from provisions linked to this deal
    if (deal_id) {
      const { data: provs, error: provErr } = await sb.from('provisions')
        .select('agreement_source_id')
        .eq('deal_id', deal_id)
        .not('agreement_source_id', 'is', null)
        .limit(1);
      if (provErr || !provs || provs.length === 0) {
        return res.json({ agreement_source: null });
      }
      const srcId = provs[0].agreement_source_id;
      const { data, error } = await sb.from('agreement_sources')
        .select('id, title, full_text, metadata')
        .eq('id', srcId).single();
      if (error) return res.json({ agreement_source: null });
      return res.json({ agreement_source: data });
    }

    return res.status(400).json({ error: 'id or deal_id required' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
