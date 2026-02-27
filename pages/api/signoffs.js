import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' });
    const { data, error } = await sb.from('signoffs')
      .select('*, user:users(name)')
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .order('created_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ signoffs: data });
  }

  if (req.method === 'POST') {
    const { entity_type, entity_id, user_id, prior_value, new_value } = req.body;
    const { data, error } = await sb.from('signoffs')
      .insert({ entity_type, entity_id, user_id, prior_value, new_value })
      .select('*, user:users(name)').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ signoff: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
