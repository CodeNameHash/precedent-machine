import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { deal_id, id } = req.query;

    // Fetch by deal_id — read from deals.metadata.full_text
    if (deal_id || id) {
      const targetId = deal_id || id;
      const { data: deal, error } = await sb.from('deals')
        .select('id, metadata')
        .eq('id', targetId)
        .single();

      if (error || !deal) {
        return res.json({ agreement_source: null });
      }

      const meta = deal.metadata || {};
      if (!meta.full_text) {
        return res.json({ agreement_source: null });
      }

      return res.json({
        agreement_source: {
          id: deal.id,
          title: meta.agreement_title || 'Agreement',
          full_text: meta.full_text,
          metadata: {
            char_count: meta.char_count,
            ingested_at: meta.ingested_at,
            pipeline: meta.pipeline,
          },
        },
      });
    }

    return res.status(400).json({ error: 'id or deal_id required' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
