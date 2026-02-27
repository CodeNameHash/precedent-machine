import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { id } = req.query;
    if (id) {
      const { data, error } = await sb.from('deals').select('*').eq('id', id).single();
      if (error) return res.status(404).json({ error: error.message });
      return res.json({ deal: data });
    }
    const { data, error } = await sb.from('deals').select('*').order('announce_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deals: data });
  }

  if (req.method === 'POST') {
    const { acquirer, target, value_usd, announce_date, sector, metadata, created_by } = req.body;
    const { data, error } = await sb.from('deals')
      .insert({ acquirer, target, value_usd, announce_date, sector, metadata, created_by })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deal: data });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    const { data, error } = await sb.from('deals').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deal: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await sb.from('deals').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
